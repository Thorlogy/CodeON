"""Exercise the real WebSocket server on an ephemeral loopback port, never hardware.

Requires the existing [server] extra; adapter constructors are replaced before
_serve starts, including when selecting the Cozmo and Apitor routes.
"""
import argparse
import asyncio
import json
import logging
import unittest
from contextlib import asynccontextmanager
from unittest.mock import patch

from websockets.asyncio.client import connect
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosedError

from codeon_robot_bridge import server
from codeon_robot_bridge.bridge import BridgeSession
from codeon_robot_bridge.fake_adapter import FakeRobotAdapter
from codeon_robot_bridge.safety import MotionWatchdog


class ObservableAdapter(FakeRobotAdapter):
    def __init__(self):
        super().__init__()
        self.executing = asyncio.Event()
        self.release_command = asyncio.Event()
        self.stopped = asyncio.Event()
        self.stop_failure = None

    async def execute(self, command, params):
        result = await super().execute(command, params)
        self.executing.set()
        await self.release_command.wait()
        return result

    async def stop_all(self):
        self.stopped.set()
        if self.stop_failure:
            raise self.stop_failure
        await super().stop_all()


class ErrorRecords(logging.Handler):
    def __init__(self):
        super().__init__(logging.ERROR)
        self.records = []
        self.received = asyncio.Event()

    def emit(self, record):
        self.records.append(record)
        self.received.set()


class WebSocketSafetyTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.adapter = ObservableAdapter()
        self.ready = asyncio.Event()
        self.now = 0.0
        self.session = BridgeSession(self.adapter, MotionWatchdog(1.0, lambda: self.now))
        self.errors = ErrorRecords()
        self.logger = logging.getLogger("websockets.server")
        self.logger.addHandler(self.errors)
        self.addCleanup(self.logger.removeHandler, self.errors)
        self.superseded = asyncio.Event()
        self.logs = []
        self.clients = []
        self.handlers = []
        self.server_task = None

    async def start_server(self, adapter_name="fake"):
        @asynccontextmanager
        async def capture_server(*args, **kwargs):
            async def observed_handler(connection):
                self.handlers.append(asyncio.current_task())
                await args[0](connection)

            async with serve(observed_handler, *args[1:], **kwargs) as listener:
                self.uri = "ws://127.0.0.1:" + str(listener.sockets[0].getsockname()[1])
                self.ready.set()
                yield listener

        def record_log(message):
            self.logs.append(message)
            if message.startswith("superseded browser connection closed"):
                self.superseded.set()

        # No real robot constructor, OS signal handler, fixed port or live bridge.
        for target, replacement in (
            ("websockets.asyncio.server.serve", capture_server),
            ("codeon_robot_bridge.server.FakeRobotAdapter", lambda: self.adapter),
            ("codeon_robot_bridge.server.CozmoAdapter", lambda: self.adapter),
            ("codeon_robot_bridge.server.ApitorAdapter", lambda device: self.adapter),
            ("codeon_robot_bridge.server.BridgeSession", lambda adapter: self.session),
            ("codeon_robot_bridge.server._log", record_log),
        ):
            patcher = patch(target, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)
        signal_patch = patch.object(asyncio.get_running_loop(), "add_signal_handler")
        signal_patch.start()
        self.addCleanup(signal_patch.stop)
        args = argparse.Namespace(adapter=adapter_name, device=None, host="127.0.0.1", port=0,
                                  origin=list(server.DEFAULT_ORIGINS))
        self.server_task = asyncio.create_task(server._serve(args))
        try:
            await asyncio.wait_for(self.ready.wait(), 5)
        except asyncio.TimeoutError:
            # Surface startup failures (including sandbox socket restrictions).
            if self.server_task.done():
                await self.server_task
            raise

    async def browser(self):
        client = await connect(self.uri, origin="http://localhost:1999")
        self.clients.append(client)
        return client

    async def request(self, client, kind, **values):
        await client.send(json.dumps({"version": "1.0", "id": "test", "type": kind, **values}))
        return json.loads(await asyncio.wait_for(client.recv(), 3))

    async def pending_command(self, client):
        self.assertTrue((await self.request(client, "connect"))["ok"])
        await client.send(json.dumps({"version": "1.0", "id": "move", "type": "command",
                                      "command": "drive", "params": {"left": 20, "right": 20}}))
        await asyncio.wait_for(self.adapter.executing.wait(), 3)

    async def close_during_reply(self, adapter_name, code):
        await self.start_server(adapter_name)
        client = await self.browser()
        await self.pending_command(client)
        await client.close(code=code)
        self.adapter.release_command.set()
        await asyncio.wait_for(self.adapter.stopped.wait(), 3)
        self.assertEqual(1, self.adapter.stop_count)
        self.assertEqual([], self.errors.records, "Normal close must not log a handler traceback")
        self.assertTrue(any("controlling browser connection closed; motors stopped" in log for log in self.logs))

    async def test_cozmo_normal_close_during_reply_still_stops(self):
        await self.close_during_reply("cozmo", 1000)

    async def test_apitor_navigation_close_during_reply_still_stops(self):
        # Non-Cozmo (user-configurable) route must retain the same safety contract.
        await self.close_during_reply("apitor", 1001)

    async def test_clean_iterator_exit_stops_without_error(self):
        await self.start_server()
        client = await self.browser()
        self.assertTrue((await self.request(client, "connect"))["ok"])
        await client.close()
        await asyncio.wait_for(self.adapter.stopped.wait(), 3)
        self.assertEqual(1, self.adapter.stop_count)
        self.assertEqual([], self.errors.records)

    async def test_abnormal_disconnect_is_still_reported_and_stops(self):
        await self.start_server()
        client = await self.browser()
        await self.pending_command(client)
        client.transport.abort()
        await client.wait_closed()
        self.adapter.release_command.set()
        await asyncio.wait_for(self.errors.received.wait(), 3)
        self.assertEqual(1, self.adapter.stop_count)
        self.assertTrue(any(isinstance(record.exc_info[1], ConnectionClosedError) for record in self.errors.records))

    async def test_stop_failure_is_not_hidden_by_normal_close_handling(self):
        await self.start_server()
        client = await self.browser()
        await self.pending_command(client)
        self.adapter.stop_failure = RuntimeError("stop fixture failed")
        await client.close()
        self.adapter.release_command.set()
        await asyncio.wait_for(self.errors.received.wait(), 3)
        self.assertTrue(any(isinstance(record.exc_info[1], RuntimeError) for record in self.errors.records))
        self.assertFalse(any("motors stopped" in log for log in self.logs))

    async def test_superseded_close_does_not_stop_new_controller(self):
        await self.start_server()
        old = await self.browser()
        await self.pending_command(old)
        newest = await self.browser()
        self.assertTrue((await self.request(newest, "connect"))["ok"])
        await old.close()
        self.adapter.release_command.set()
        await asyncio.wait_for(self.superseded.wait(), 3)
        self.assertEqual(0, self.adapter.stop_count)
        self.assertEqual([], self.errors.records)
        await newest.close()
        await asyncio.wait_for(self.adapter.stopped.wait(), 3)
        self.assertEqual(1, self.adapter.stop_count)

    async def test_explicit_stop_then_disconnect_remain_effective(self):
        await self.start_server()
        client = await self.browser()
        self.assertTrue((await self.request(client, "connect"))["ok"])
        self.assertTrue((await self.request(client, "stopAll"))["ok"])
        self.assertEqual(1, self.adapter.stop_count)
        self.assertTrue((await self.request(client, "disconnect"))["ok"])
        self.assertFalse(self.adapter.connected)
        self.assertEqual(2, self.adapter.stop_count)

    async def test_real_watchdog_task_stops_without_browser_close(self):
        await self.start_server()
        client = await self.browser()
        await self.pending_command(client)
        self.adapter.release_command.set()
        self.assertTrue(json.loads(await asyncio.wait_for(client.recv(), 3))["ok"])
        self.now = 1.1
        await asyncio.wait_for(self.adapter.stopped.wait(), 3)
        self.assertEqual(1, self.adapter.stop_count)
        self.assertTrue((await self.request(client, "heartbeat"))["ok"])

    async def test_cancelled_handler_still_runs_safety_stop(self):
        await self.start_server()
        client = await self.browser()
        await self.pending_command(client)
        self.handlers[0].cancel()
        await asyncio.wait_for(self.adapter.stopped.wait(), 3)
        self.assertEqual(1, self.adapter.stop_count)

    async def test_server_shutdown_stops_and_disconnects_adapter(self):
        await self.start_server()
        client = await self.browser()
        self.assertTrue((await self.request(client, "connect"))["ok"])
        self.server_task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await asyncio.wait_for(self.server_task, 5)
        self.assertFalse(self.adapter.connected)
        self.assertGreaterEqual(self.adapter.stop_count, 2)
        self.assertEqual([], self.errors.records)

    async def assert_protocol_error(self, client, payload, request_id=None):
        await client.send(payload)
        response = json.loads(await asyncio.wait_for(client.recv(), 3))
        self.assertFalse(response["ok"])
        self.assertEqual(request_id, response["id"])
        self.assertEqual("PROTOCOL_ERROR", response["error"]["code"])
        self.assertEqual([], self.errors.records)
        return response

    async def test_malformed_first_message_is_rejected_without_closing_connection(self):
        await self.start_server()
        client = await self.browser()
        for payload in ("{", "", '{"type":', b"\xff", "{" + '"x":' + "9" * 5000 + "}"):
            with self.subTest(payload=repr(payload[:20])):
                await self.assert_protocol_error(client, payload)
        self.assertFalse(self.adapter.connected)
        self.assertEqual([], self.adapter.commands)
        self.assertTrue((await self.request(client, "connect"))["ok"])

    async def non_object_messages(self, adapter_name):
        await self.start_server(adapter_name)
        client = await self.browser()
        for value in (None, [], ["connect"], "connect", 1, 1.5, True, False):
            with self.subTest(value=value):
                await self.assert_protocol_error(client, json.dumps(value))
        self.assertEqual([], self.adapter.commands)
        self.assertFalse(self.adapter.connected)
        self.assertTrue((await self.request(client, "connect"))["ok"])
        self.assertTrue((await self.request(client, "stopAll"))["ok"])

    async def test_non_object_messages_on_cozmo_route(self):
        await self.non_object_messages("cozmo")

    async def test_non_object_messages_on_apitor_route(self):
        await self.non_object_messages("apitor")

    async def test_invalid_message_fields_never_reach_adapter(self):
        await self.start_server()
        client = await self.browser()
        values = [{"type": value} for value in ([], {}, None, 1, True, "unknown")]
        values += [{"type": "command", "command": value} for value in ([], {}, None, 1, "")]
        values += [{"type": "command", "command": "drive", "params": []}, {"version": "2.0"}]
        for value in values:
            with self.subTest(value=value):
                message = {"version": "1.0", "id": "bad", "type": "connect", **value}
                await self.assert_protocol_error(client, json.dumps(message), "bad")
        self.assertFalse(self.adapter.connected)
        self.assertEqual([], self.adapter.commands)
        self.assertTrue((await self.request(client, "connect"))["ok"])

    async def test_bad_message_after_motion_is_not_replayed_and_does_not_renew_watchdog(self):
        await self.start_server()
        client = await self.browser()
        await self.pending_command(client)
        self.adapter.release_command.set()
        self.assertTrue(json.loads(await asyncio.wait_for(client.recv(), 3))["ok"])
        self.now = 0.8
        await self.assert_protocol_error(client, '{"type":"heartbeat",')
        self.assertIn("request invalid: PROTOCOL_ERROR", self.logs[-1])
        self.assertEqual([("drive", {"left": 20, "right": 20})], self.adapter.commands)
        self.now = 1.1
        await asyncio.wait_for(self.adapter.stopped.wait(), 3)
        self.assertEqual(1, self.adapter.stop_count)
        self.assertTrue((await self.request(client, "heartbeat"))["ok"])

    async def test_excessive_json_nesting_is_a_protocol_error(self):
        await self.start_server()
        client = await self.browser()
        await self.assert_protocol_error(client, "[" * 2000 + "0" + "]" * 2000)
        self.assertEqual([], self.adapter.commands)
        self.assertTrue((await self.request(client, "connect"))["ok"])

    async def test_valid_json_binary_frame_remains_supported(self):
        await self.start_server()
        client = await self.browser()
        await client.send(b'{"version":"1.0","id":"binary","type":"connect"}')
        response = json.loads(await asyncio.wait_for(client.recv(), 3))
        self.assertTrue(response["ok"])
        self.assertEqual("binary", response["id"])
        self.assertTrue(self.adapter.connected)

    async def asyncTearDown(self):
        self.adapter.stop_failure = None
        self.adapter.release_command.set()
        for client in self.clients:
            await client.close()
        if self.server_task:
            self.server_task.cancel()
            try:
                await asyncio.wait_for(self.server_task, 5)
            except asyncio.CancelledError:
                pass
            self.assertFalse(self.adapter.connected)
