from __future__ import annotations

from typing import Any

from .adapter import RobotAdapter
from .errors import BridgeError, ProtocolError
from .safety import MotionWatchdog


class BridgeSession:
    """Transport-neutral protocol handler shared by WebSocket and test clients."""

    MOTION_COMMANDS = frozenset({"drive", "turn", "setMotor"})

    def __init__(self, adapter: RobotAdapter, watchdog: MotionWatchdog | None = None) -> None:
        self.adapter = adapter
        self.watchdog = watchdog or MotionWatchdog()

    async def handle(self, message: dict[str, Any]) -> dict[str, Any]:
        request_id = message.get("id") if isinstance(message, dict) else None
        try:
            self._validate(message)
            result = await self._dispatch(message)
            return {"id": request_id, "ok": True, "result": result}
        except BridgeError as error:
            return {"id": request_id, "ok": False, "error": {"code": error.code, "message": str(error)}}
        except Exception as error:
            return {
                "id": request_id,
                "ok": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": f"{type(error).__name__}: {error or 'robot adapter failed'}",
                },
            }

    async def watchdog_tick(self) -> bool:
        if not self.watchdog.expired():
            return False
        await self.adapter.stop_all()
        self.watchdog.motion_stopped()
        return True

    @staticmethod
    def _validate(message: dict[str, Any]) -> None:
        if not isinstance(message, dict):
            raise ProtocolError("message must be an object")
        if message.get("version") != "1.0":
            raise ProtocolError("version must be 1.0")
        if not isinstance(message.get("id"), str) or not message["id"]:
            raise ProtocolError("id must be a non-empty string")
        if message.get("type") not in {
            "capabilities",
            "connect",
            "disconnect",
            "status",
            "heartbeat",
            "command",
            "sensor",
            "stopAll",
        }:
            raise ProtocolError("unknown message type")

    async def _dispatch(self, message: dict[str, Any]) -> Any:
        message_type = message["type"]
        if message_type == "capabilities":
            return self.adapter.manifest.to_dict()
        if message_type == "connect":
            return await self.adapter.connect()
        if message_type == "disconnect":
            await self.adapter.disconnect()
            self.watchdog.motion_stopped()
            return {"connected": False}
        if message_type == "status":
            return await self.adapter.status()
        if message_type == "heartbeat":
            self.watchdog.heartbeat()
            return {"accepted": True}
        if message_type == "stopAll":
            await self.adapter.stop_all()
            self.watchdog.motion_stopped()
            return {"stopped": True}
        if message_type == "sensor":
            sensor = self._required_string(message, "sensor")
            return {"value": await self.adapter.read_sensor(sensor, self._params(message))}

        command = self._required_string(message, "command")
        result = await self.adapter.execute(command, self._params(message))
        if command in self.MOTION_COMMANDS:
            self.watchdog.motion_started()
        return result

    @staticmethod
    def _required_string(message: dict[str, Any], key: str) -> str:
        value = message.get(key)
        if not isinstance(value, str) or not value:
            raise ProtocolError(f"{key} must be a non-empty string")
        return value

    @staticmethod
    def _params(message: dict[str, Any]) -> dict[str, Any]:
        params = message.get("params", {})
        if not isinstance(params, dict):
            raise ProtocolError("params must be an object")
        return params
