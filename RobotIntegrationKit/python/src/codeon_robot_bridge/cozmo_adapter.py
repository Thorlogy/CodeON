from __future__ import annotations

import asyncio
import math
import platform
import struct
import subprocess
import socket
import tempfile
import threading
import time
import wave
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

from .adapter import RobotAdapter
from .capabilities import CapabilityManifest
from .behavior import BehaviorScheduler
from .behavior_runtime import BehaviorRuntime
from .cozmo_behaviors import cozmo_face_behaviors
from .errors import AdapterError, NotConnectedError, UnsupportedCommandError


def _default_client_factory():
    try:
        import pycozmo
    except ImportError as error:
        raise AdapterError("PyCozmo is not installed; install the 'cozmo' extra") from error
    # PyCozmo sends robot audio through its animation controller. Animations
    # must therefore remain enabled even though CodeON does not use Cozmo's
    # procedural face animation.
    return pycozmo.Client(enable_animations=True, enable_procedural_face=False)


class CozmoAdapter(RobotAdapter):
    """Minimal PyCozmo adapter. Physical limits require hardware verification."""

    _manifest = CapabilityManifest(
        robot="cozmo",
        adapter_version="0.2.0",
        capabilities={
            "differentialDrive": True,
            "head": True,
            "lift": True,
            "lights": ["backpack", "head"],
            "display": ["facePresets"],
            "audio": ["tone", "localTextToSpeech"],
            "camera": {"localFaceDetection": True, "imagesLeaveBridge": False},
            "lightCubes": {"count": 3, "discovery": True, "lights": True, "motion": True, "tap": True, "localMarkerDetection": True},
            "behaviors": ["faceSearchAndFollow"],
            "sensors": ["battery", "accelerometer", "gyroscope", "wheelSpeed", "pose", "snapshot", "face"],
        },
        limits={
            "wheelSpeedMmPerSec": 150,
            "headAngleRadians": {"min": -0.40, "max": 0.70},
            "liftHeightMm": {"min": 32.0, "max": 92.0},
            "heartbeatTimeoutMs": 1000,
            "connectionMayMoveActuators": True,
            "verification": "hardware-required",
        },
    )

    def __init__(self, client_factory: Callable[[], Any] = _default_client_factory) -> None:
        self._client_factory = client_factory
        self._client = None
        self._connected = False
        self._connect_lock = asyncio.Lock()
        self._local_address: str | None = None
        self._camera_enabled = False
        self._camera_handler = None
        self._face_tracking_task: asyncio.Task | None = None
        self._tracking_motion = False
        self._face_lock = threading.Lock()
        self._last_frame_time = 0.0
        self._camera_frames = 0
        self._face_detections = 0
        self._camera_error: str | None = None
        self._last_face_time = 0.0
        self._face = self._empty_face()
        self._cube_marker = self._empty_cube_marker()
        self._last_cube_marker_time = 0.0
        self._cv2 = None
        self._numpy = None
        self._face_detector = None
        self._audio_lock = asyncio.Lock()
        self._audio_tasks: set[asyncio.Task] = set()
        self._last_audio_error: str | None = None
        self._behavior_runtime: BehaviorRuntime | None = None
        self._last_received_frames = 0
        self._last_robot_packet_at = 0.0
        self._cube_lock = threading.Lock()
        self._cube_command_lock = threading.Lock()
        self._cubes = {number: self._empty_cube(number) for number in range(1, 4)}

    @property
    def manifest(self) -> CapabilityManifest:
        return self._manifest

    @property
    def connected(self) -> bool:
        return self._connected

    async def connect(self) -> dict[str, Any]:
        async with self._connect_lock:
            if self.connected:
                if self._robot_link_alive():
                    return self._connection_result()
                await self.disconnect()
            self._local_address = None
            client = self._client_factory()
            try:
                self._bind_to_cozmo_network(client)
                await asyncio.to_thread(client.start)
                await asyncio.to_thread(client.connect)
                await asyncio.to_thread(client.wait_for_robot, 8.0)
            except Exception as error:
                diagnostics = self._connection_diagnostics(client)
                await self._close_failed_client(client)
                raise AdapterError(f"failed to connect to Cozmo; transport={diagnostics}") from error
            self._client = client
            self._connected = True
            await asyncio.to_thread(client.set_volume, 65535)
            # Connecting initializes Cozmo's motor controllers. Release head
            # and lift immediately so an idle CodeON connection does not
            # resist safe manual movement before a program is started.
            await asyncio.to_thread(client.stop_all_motors)
            await asyncio.to_thread(self._start_cube_support, client)
            self._last_received_frames = self._received_frames(client)
            self._last_robot_packet_at = time.monotonic()
            return self._connection_result()

    async def status(self) -> dict[str, Any]:
        if self.connected and not self._robot_link_alive():
            await self.disconnect()
        return {"connected": self.connected, "robot": self.manifest.robot}

    async def disconnect(self) -> None:
        client = self._client
        if client is None:
            return
        try:
            try:
                await self._stop_face_tracking()
                await self._stop_behavior_control()
                await self._stop_camera()
                await asyncio.to_thread(client.stop_all_motors)
            finally:
                await asyncio.to_thread(client.disconnect)
        finally:
            try:
                await asyncio.to_thread(client.stop)
            finally:
                for task in tuple(self._audio_tasks):
                    task.cancel()
                self._audio_tasks.clear()
                self._client = None
                self._connected = False
                self._last_received_frames = 0
                self._last_robot_packet_at = 0.0
                with self._cube_lock:
                    self._cubes = {number: self._empty_cube(number) for number in range(1, 4)}

    async def execute(self, command: str, params: dict[str, Any]) -> Any:
        client = self._require_client()
        if command == "drive":
            await self._stop_behavior_before_direct_drive()
            left = self._clamp_number(params, "left", -150.0, 150.0)
            right = self._clamp_number(params, "right", -150.0, 150.0)
            await asyncio.to_thread(client.drive_wheels, left, right)
        elif command == "stopDrive":
            await asyncio.to_thread(client.drive_wheels, 0.0, 0.0)
        elif command == "turn":
            await self._stop_behavior_before_direct_drive()
            speed = self._clamp_number(params, "speed", -150.0, 150.0)
            await asyncio.to_thread(client.drive_wheels, -speed, speed)
        elif command == "setHead":
            angle = self._clamp_number(params, "angle", -0.40, 0.70)
            await asyncio.to_thread(client.set_head_angle, angle)
        elif command == "setLift":
            height = self._clamp_number(params, "height", 32.0, 92.0)
            # PyCozmo acknowledges SetLiftHeight before the firmware has
            # actually moved the arm. Endpoint blocks are more reliable with
            # the same direct motor command used by Anki's remote control.
            speed = 4.0 if height >= 62.0 else -4.0
            await asyncio.to_thread(client.move_lift, speed)
            try:
                await asyncio.sleep(0.8)
            finally:
                await asyncio.to_thread(client.move_lift, 0.0)
        elif command == "setBackpackLight":
            color = self._parse_color(params.get("color", "#ffffff"))
            await asyncio.to_thread(client.set_all_backpack_lights, color)
        elif command == "setHeadLight":
            await asyncio.to_thread(client.set_head_light, bool(params.get("enabled", True)))
        elif command == "setCubeLight":
            cube = self._cube_number(params.get("cube"))
            color = self._parse_color(params.get("color", "#ffffff"))
            await asyncio.to_thread(self._set_cube_light, client, cube, color)
        elif command == "tone":
            frequency = self._clamp_number(params, "frequency", 40.0, 4000.0)
            duration = self._clamp_number(params, "duration", 10.0, 10000.0)
            self._queue_audio(self._play_tone, client, frequency, duration)
        elif command == "speak":
            text = str(params.get("text", "")).strip()[:250]
            if text:
                speed = self._clamp_number(params, "speed", 1.0, 100.0) if "speed" in params else 50.0
                self._queue_audio(self._speak, client, text, speed)
        elif command == "displayFace":
            await asyncio.to_thread(self._display_face, client, str(params.get("face", "HAPPY")))
        elif command == "camera":
            if bool(params.get("enabled", True)):
                await self._start_camera(client)
            else:
                await self._stop_face_tracking()
                await self._stop_camera()
        elif command == "trackFace":
            await self._start_camera(client)
            self._start_face_tracking(client)
        elif command == "startBehavior":
            preset = str(params.get("preset", "faceSearchAndFollow"))
            if preset != "faceSearchAndFollow":
                raise UnsupportedCommandError(f"unsupported behavior preset: {preset}")
            await self._start_behavior_control(client)
        elif command == "stopBehavior":
            await self._stop_behavior_control()
        else:
            raise UnsupportedCommandError(f"unsupported command: {command}")
        return {"accepted": True}

    async def read_sensor(self, sensor: str, params: dict[str, Any]) -> Any:
        client = self._require_client()
        if sensor == "battery":
            for _ in range(20):
                value = float(client.battery_voltage)
                if value > 0.0:
                    return value
                await asyncio.sleep(0.05)
            return float(client.battery_voltage)
        if sensor == "snapshot":
            return self._snapshot(client)
        if sensor == "face":
            with self._face_lock:
                return dict(self._face)
        raise UnsupportedCommandError(f"unsupported sensor: {sensor}")

    async def stop_all(self) -> None:
        await self._stop_behavior_control()
        await self._stop_face_tracking()
        await self._stop_camera()
        if self._client is not None:
            # Stop direct velocity commands explicitly as well as sending the
            # firmware-wide stop. This is intentionally redundant: PyCozmo's
            # StopAllMotors acknowledgement alone does not prove that a prior
            # direct wheel/lift/head velocity has been released.
            await asyncio.to_thread(self._client.drive_wheels, 0.0, 0.0)
            await asyncio.to_thread(self._client.move_lift, 0.0)
            await asyncio.to_thread(self._client.move_head, 0.0)
            await asyncio.to_thread(self._client.stop_all_motors)

    def _snapshot(self, client) -> dict[str, Any]:
        with self._face_lock:
            face = dict(self._face)
            cube_marker = dict(self._cube_marker)
        cubes = self._cube_snapshot()
        pose = getattr(client, "pose", None)
        accel = getattr(client, "accelerometer", getattr(client, "accel", None))
        gyro = getattr(client, "gyro", None)
        status = getattr(client, "robot_status", None)
        head_angle = getattr(client, "head_angle", 0.0)
        lift_position = getattr(client, "lift_position", 0.0)
        lift_height = getattr(getattr(lift_position, "height", None), "mm", lift_position)
        return {
            "battery": float(getattr(client, "battery_voltage", 0.0) or 0.0),
            "headAngle": self._number(getattr(head_angle, "radians", head_angle)),
            "liftHeight": self._number(lift_height),
            "leftWheelSpeed": self._number(getattr(client, "left_wheel_speed", 0.0)),
            "rightWheelSpeed": self._number(getattr(client, "right_wheel_speed", 0.0)),
            "poseX": self._component(pose, "x"),
            "poseY": self._component(pose, "y"),
            "poseHeading": self._component(pose, "angle_z", "angle"),
            "accelX": self._component(accel, "x"),
            "accelY": self._component(accel, "y"),
            "accelZ": self._component(accel, "z"),
            "gyroX": self._component(gyro, "x"),
            "gyroY": self._component(gyro, "y"),
            "gyroZ": self._component(gyro, "z"),
            "pickedUp": self._status(status, "is_picked_up", "picked_up"),
            "moving": self._status(status, "is_moving", "moving"),
            "onCharger": self._status(status, "is_on_charger", "on_charger"),
            "cameraEnabled": self._camera_enabled,
            "cameraFrames": self._camera_frames,
            "faceDetections": self._face_detections,
            "cameraError": self._camera_error,
            "faceTracking": self._face_tracking_task is not None and not self._face_tracking_task.done(),
            "audioBusy": bool(self._audio_tasks),
            "audioError": self._last_audio_error,
            "behaviorControl": self._behavior_runtime.status() if self._behavior_runtime is not None else {"running": False},
            "face": face,
            "cubes": cubes,
            "cubeMarker": cube_marker,
        }

    async def _start_behavior_control(self, client) -> None:
        await self._stop_face_tracking()
        await self._start_camera(client)
        if self._behavior_runtime is None:
            self._behavior_runtime = BehaviorRuntime(
                BehaviorScheduler(cozmo_face_behaviors()),
                lambda: self._behavior_snapshot(client),
                lambda command, params: self._send_behavior_command(client, command, params),
                lambda: asyncio.to_thread(client.stop_all_motors),
            )
        await self._behavior_runtime.start()

    async def _stop_behavior_control(self) -> None:
        runtime = self._behavior_runtime
        if runtime is not None:
            await runtime.stop()

    async def _stop_behavior_before_direct_drive(self) -> None:
        runtime = self._behavior_runtime
        if runtime is not None and runtime.running:
            await runtime.stop()

    async def _behavior_snapshot(self, client) -> dict[str, Any]:
        snapshot = self._snapshot(client)
        snapshot["snapshotAgeMs"] = 0
        return snapshot

    @staticmethod
    async def _send_behavior_command(client, command: str, params: Mapping[str, Any]) -> None:
        if command != "drive":
            raise UnsupportedCommandError(f"unsupported behavior command: {command}")
        await asyncio.to_thread(
            client.drive_wheels,
            float(params.get("left", 0.0)),
            float(params.get("right", 0.0)),
        )

    def _queue_audio(self, function, *args) -> None:
        task = asyncio.create_task(self._run_audio(function, *args))
        self._audio_tasks.add(task)
        task.add_done_callback(self._audio_tasks.discard)

    async def _run_audio(self, function, *args) -> None:
        async with self._audio_lock:
            self._last_audio_error = None
            try:
                await asyncio.to_thread(function, *args)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                self._last_audio_error = str(error)

    async def _start_camera(self, client) -> None:
        if self._camera_enabled:
            return
        try:
            import cv2
            import numpy
            import pycozmo
        except ImportError as error:
            raise AdapterError("Local face detection requires the 'cozmo-vision' extra") from error
        detector_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
        detector = cv2.CascadeClassifier(str(detector_path))
        if detector.empty():
            raise AdapterError("Local face detector could not be loaded")
        self._cv2, self._numpy, self._face_detector = cv2, numpy, detector
        self._camera_frames = 0
        self._face_detections = 0
        self._camera_error = None
        self._last_face_time = 0.0
        event = pycozmo.event.EvtNewRawCameraImage
        self._camera_handler = client.add_handler(event, self._on_camera_frame)
        await asyncio.to_thread(client.enable_camera, True, False)
        self._camera_enabled = True

    async def _stop_camera(self) -> None:
        client = self._client
        if client is None or not self._camera_enabled:
            return
        try:
            await asyncio.to_thread(client.enable_camera, False, False)
        except Exception:
            pass
        if self._camera_handler is not None:
            try:
                import pycozmo
                client.del_handler(pycozmo.event.EvtNewRawCameraImage, self._camera_handler)
            except Exception:
                pass
        self._camera_handler = None
        self._camera_enabled = False
        with self._face_lock:
            self._face = self._empty_face()
            self._cube_marker = self._empty_cube_marker()

    def _start_face_tracking(self, client) -> None:
        if self._face_tracking_task is None or self._face_tracking_task.done():
            self._face_tracking_task = asyncio.create_task(self._face_tracking_loop(client))

    async def _stop_face_tracking(self) -> None:
        task = self._face_tracking_task
        self._face_tracking_task = None
        if task is not None and task is not asyncio.current_task():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self._tracking_motion = False

    async def _face_tracking_loop(self, client) -> None:
        try:
            while self.connected and self._camera_enabled:
                await self._track_face_once(client)
                await asyncio.sleep(0.15)
        except asyncio.CancelledError:
            raise
        finally:
            if self._tracking_motion:
                try:
                    await asyncio.to_thread(client.stop_all_motors)
                except Exception:
                    pass
            self._tracking_motion = False

    def _on_camera_frame(self, *args) -> None:
        now = time.monotonic()
        if now - self._last_frame_time < 0.15 or not self._camera_enabled:
            return
        self._last_frame_time = now
        image = args[-1]
        try:
            frame = self._numpy.asarray(image)
            gray = self._cv2.cvtColor(frame, self._cv2.COLOR_RGB2GRAY) if frame.ndim == 3 else frame
            gray = self._cv2.equalizeHist(gray)
            faces = self._face_detector.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(20, 20))
            cube_marker = self._detect_cube_marker(gray)
            height, width = gray.shape[:2]
            self._camera_frames += 1
            self._camera_error = None
            result = self._empty_face()
            result["count"] = int(len(faces))
            if len(faces):
                self._face_detections += 1
                x, y, w, h = max(faces, key=lambda item: int(item[2]) * int(item[3]))
                center_x, center_y = (x + w / 2) / width, (y + h / 2) / height
                result.update({
                    "detected": True,
                    "x": round(float(center_x), 3),
                    "y": round(float(center_y), 3),
                    "size": round(float(w * h / (width * height)), 4),
                    "position": "LEFT" if center_x < 0.4 else "RIGHT" if center_x > 0.6 else "CENTER",
                    "ageMs": 0,
                })
                self._last_face_time = now
            elif now - self._last_face_time < 1.2:
                with self._face_lock:
                    result = dict(self._face)
                result["ageMs"] = round((now - self._last_face_time) * 1000)
            with self._face_lock:
                self._face = result
                if cube_marker["detected"]:
                    self._cube_marker = cube_marker
                    self._last_cube_marker_time = now
                elif now - self._last_cube_marker_time < 0.8:
                    retained_marker = dict(self._cube_marker)
                    retained_marker["ageMs"] = round((now - self._last_cube_marker_time) * 1000)
                    self._cube_marker = retained_marker
                else:
                    self._cube_marker = self._empty_cube_marker()
        except Exception as error:
            # A malformed camera frame must never stop the robot program.
            self._camera_error = f"{type(error).__name__}: {error}"
            return

    @staticmethod
    def _display_face(client, face: str) -> None:
        from PIL import Image, ImageDraw

        image = Image.new("1", (128, 32), color=0)
        draw = ImageDraw.Draw(image)
        expression = face.upper()
        if expression == "BLINK":
            draw.line((25, 13, 49, 13), fill=1, width=3)
            draw.line((79, 13, 103, 13), fill=1, width=3)
        else:
            draw.ellipse((27, 5, 47, 19), outline=1, width=3)
            draw.ellipse((81, 5, 101, 19), outline=1, width=3)
            draw.ellipse((34, 9, 40, 15), fill=1)
            draw.ellipse((88, 9, 94, 15), fill=1)
        if expression == "SURPRISED":
            draw.ellipse((58, 19, 70, 30), outline=1, width=2)
        elif expression == "SAD":
            draw.line((51, 29, 58, 24, 64, 22, 70, 24, 77, 29), fill=1, width=2)
        elif expression == "NEUTRAL":
            draw.line((52, 25, 76, 25), fill=1, width=2)
        else:
            draw.line((51, 22, 58, 27, 64, 29, 70, 27, 77, 22), fill=1, width=2)
        client.display_image(image)

    async def _track_face_once(self, client) -> None:
        with self._face_lock:
            face = dict(self._face)
        if not face.get("detected"):
            if self._tracking_motion:
                await asyncio.to_thread(client.drive_wheels, 0.0, 0.0)
                self._tracking_motion = False
            return
        x_error = float(face["x"]) - 0.5
        y_error = 0.5 - float(face["y"])
        if abs(x_error) > 0.10:
            turn = max(-45.0, min(45.0, x_error * 100.0))
            await asyncio.to_thread(client.drive_wheels, turn, -turn)
            self._tracking_motion = True
        else:
            if self._tracking_motion:
                await asyncio.to_thread(client.drive_wheels, 0.0, 0.0)
                self._tracking_motion = False
        head_angle = getattr(client, "head_angle", 0.0) or 0.0
        current = self._number(getattr(head_angle, "radians", head_angle))
        await asyncio.to_thread(client.set_head_angle, max(-0.4, min(0.7, current + y_error * 0.35)))

    @staticmethod
    def _play_tone(client, frequency: float, duration_ms: float) -> None:
        sample_rate = 22050
        frame_count = max(1, int(sample_rate * duration_ms / 1000.0))
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temporary:
            path = Path(temporary.name)
        try:
            with wave.open(str(path), "wb") as output:
                output.setparams((1, 2, sample_rate, frame_count, "NONE", "not compressed"))
                amplitude = 9000
                output.writeframes(b"".join(struct.pack("<h", int(amplitude * math.sin(2 * math.pi * frequency * i / sample_rate))) for i in range(frame_count)))
            client.play_audio(str(path))
        finally:
            path.unlink(missing_ok=True)

    @staticmethod
    def _speak(client, text: str, speed: float) -> None:
        if platform.system() != "Darwin":
            raise AdapterError("Local Cozmo speech is currently available on macOS")
        words_per_minute = round(90 + speed * 1.8)
        with tempfile.TemporaryDirectory(prefix="codeon-cozmo-speech-") as directory:
            wav_path = Path(directory) / "speech.wav"
            subprocess.run(
                ["say", "-r", str(words_per_minute), "-o", str(wav_path), "--file-format=WAVE", "--data-format=LEI16@22050", "--channels=1", text],
                check=True,
                timeout=30,
            )
            with wave.open(str(wav_path), "rb") as audio_file:
                if audio_file.getnframes() == 0:
                    raise AdapterError("macOS speech synthesis produced no audio data")
            client.play_audio(str(wav_path))

    @staticmethod
    def _parse_color(value: Any):
        try:
            from pycozmo import protocol_encoder
            from pycozmo.lights import Color
        except ImportError as error:
            raise AdapterError("PyCozmo is not installed") from error
        text = str(value).lstrip("#")
        if len(text) != 6:
            text = "ffffff"
        try:
            rgb = tuple(int(text[index:index + 2], 16) for index in (0, 2, 4))
        except ValueError:
            rgb = (255, 255, 255)
        color = Color(rgb=rgb)
        encoded = color.to_int16()
        return protocol_encoder.LightState(on_color=encoded, off_color=encoded)

    def _start_cube_support(self, client) -> None:
        """Discover all three Light Cubes and subscribe to their local events."""
        try:
            import pycozmo
        except ImportError as error:
            raise AdapterError("PyCozmo is not installed") from error
        encoder = pycozmo.protocol_encoder
        for event, handler in (
            (encoder.ObjectAvailable, self._on_cube_available),
            (encoder.ObjectConnectionState, self._on_cube_connection),
            (encoder.ObjectMoved, self._on_cube_moved),
            (encoder.ObjectStoppedMoving, self._on_cube_stopped),
            (encoder.ObjectTapped, self._on_cube_tapped),
            (encoder.ObjectPowerLevel, self._on_cube_power),
            (encoder.ObjectAccel, self._on_cube_accel),
        ):
            client.add_handler(event, handler)
        client.conn.send(encoder.SetAccessoryDiscovery(enable=True))
        for factory_id, obj in dict(getattr(client, "available_objects", {})).items():
            self._register_available_cube(client, factory_id, getattr(obj, "object_type", 0), 0)

    def _on_cube_available(self, *args) -> None:
        packet = args[-1]
        client = self._client or (args[0] if len(args) > 1 else None)
        if client is not None:
            self._register_available_cube(
                client,
                getattr(packet, "factory_id", 0),
                getattr(packet, "object_type", 0),
                getattr(packet, "rssi", 0),
            )

    def _register_available_cube(self, client, factory_id: Any, object_type: Any, rssi: Any) -> None:
        cube = self._cube_type_number(object_type)
        if cube is None:
            return
        should_connect = False
        with self._cube_lock:
            state = self._cubes[cube]
            state.update({"available": True, "factoryId": int(factory_id), "rssi": int(rssi or 0)})
            if not state["connected"] and not state["connecting"]:
                state["connecting"] = True
                should_connect = True
        if should_connect:
            import pycozmo
            client.conn.send(pycozmo.protocol_encoder.ObjectConnect(factory_id=int(factory_id), connect=True))

    def _on_cube_connection(self, *args) -> None:
        packet = args[-1]
        cube = self._cube_type_number(getattr(packet, "object_type", 0))
        if cube is None:
            return
        connected = bool(getattr(packet, "connected", False))
        object_id = int(getattr(packet, "object_id", 0) or 0)
        with self._cube_lock:
            self._cubes[cube].update(
                {
                    "available": True,
                    "connected": connected,
                    "connecting": False,
                    "factoryId": int(getattr(packet, "factory_id", 0) or self._cubes[cube]["factoryId"]),
                    "objectId": object_id if connected else 0,
                    "moving": False if not connected else self._cubes[cube]["moving"],
                }
            )
        if connected:
            client = self._client or (args[0] if len(args) > 1 else None)
            if client is not None:
                import pycozmo
                client.conn.send(pycozmo.protocol_encoder.StreamObjectAccel(object_id=object_id, enable=True))

    def _on_cube_moved(self, *args) -> None:
        packet = args[-1]
        self._update_cube_by_object_id(getattr(packet, "object_id", 0), moving=True)

    def _on_cube_stopped(self, *args) -> None:
        packet = args[-1]
        self._update_cube_by_object_id(getattr(packet, "object_id", 0), moving=False)

    def _on_cube_tapped(self, *args) -> None:
        packet = args[-1]
        cube = self._cube_for_object_id(getattr(packet, "object_id", 0))
        if cube is None:
            return
        with self._cube_lock:
            self._cubes[cube]["lastTapAt"] = time.monotonic()
            self._cubes[cube]["tapCount"] += max(1, int(getattr(packet, "num_taps", 1) or 1))

    def _on_cube_power(self, *args) -> None:
        packet = args[-1]
        self._update_cube_by_object_id(getattr(packet, "object_id", 0), battery=int(getattr(packet, "battery_level", 0) or 0))

    def _on_cube_accel(self, *args) -> None:
        packet = args[-1]
        self._update_cube_by_object_id(
            getattr(packet, "object_id", 0),
            accelX=self._number(getattr(packet, "accel_x", 0.0)),
            accelY=self._number(getattr(packet, "accel_y", 0.0)),
            accelZ=self._number(getattr(packet, "accel_z", 0.0)),
        )

    def _update_cube_by_object_id(self, object_id: Any, **values: Any) -> None:
        cube = self._cube_for_object_id(object_id)
        if cube is not None:
            with self._cube_lock:
                self._cubes[cube].update(values)

    def _cube_for_object_id(self, object_id: Any) -> int | None:
        with self._cube_lock:
            for cube, state in self._cubes.items():
                if state["objectId"] and state["objectId"] == int(object_id or 0):
                    return cube
        return None

    def _cube_snapshot(self) -> dict[str, dict[str, Any]]:
        now = time.monotonic()
        with self._cube_lock:
            return {
                str(cube): {
                    key: value
                    for key, value in state.items()
                    if key not in {"connecting", "lastTapAt"}
                }
                | {"tapped": bool(state["lastTapAt"] and now - state["lastTapAt"] <= 1.0)}
                for cube, state in self._cubes.items()
            }

    def _set_cube_light(self, client, cube: int, light_state: Any) -> None:
        with self._cube_lock:
            object_id = int(self._cubes[cube]["objectId"] or 0)
        if not object_id:
            raise AdapterError(f"Light Cube {cube} is not connected")
        import pycozmo
        with self._cube_command_lock:
            client.conn.send(pycozmo.protocol_encoder.CubeId(object_id=object_id))
            client.conn.send(pycozmo.protocol_encoder.CubeLights(states=(light_state,) * 4))

    def _detect_cube_marker(self, gray) -> dict[str, Any]:
        """Locate the strongest square Cozmo-style fiducial without exporting images."""
        cv2 = self._cv2
        height, width = gray.shape[:2]
        if height < 20 or width < 20:
            return self._empty_cube_marker()
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        binary = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 7)
        contours, hierarchy = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is None:
            return self._empty_cube_marker()
        frame_area = float(width * height)
        best = None
        best_score = 0.0
        for index, contour in enumerate(contours):
            area = float(cv2.contourArea(contour))
            if area < frame_area * 0.004 or area > frame_area * 0.45:
                continue
            perimeter = cv2.arcLength(contour, True)
            polygon = cv2.approxPolyDP(contour, 0.045 * perimeter, True)
            if len(polygon) != 4 or not cv2.isContourConvex(polygon):
                continue
            x, y, box_width, box_height = cv2.boundingRect(polygon)
            aspect = box_width / max(1.0, float(box_height))
            if not 0.65 <= aspect <= 1.35:
                continue
            child = int(hierarchy[0][index][2])
            nested = 0
            while child >= 0 and nested < 4:
                nested += 1
                child = int(hierarchy[0][child][2])
            if nested < 2:
                continue
            score = area * (1.0 - abs(1.0 - aspect)) * (1.0 + 0.15 * nested)
            if score > best_score:
                best_score = score
                best = (x, y, box_width, box_height, area)
        if best is None:
            return self._empty_cube_marker()
        x, y, box_width, box_height, area = best
        return {
            "detected": True,
            "x": round((x + box_width / 2) / width, 3),
            "y": round((y + box_height / 2) / height, 3),
            "size": round(area / frame_area, 4),
            "ageMs": 0,
        }

    @staticmethod
    def _cube_type_number(value: Any) -> int | None:
        try:
            number = int(getattr(value, "value", value))
        except (TypeError, ValueError):
            return None
        return number if number in (1, 2, 3) else None

    @staticmethod
    def _cube_number(value: Any) -> int:
        try:
            cube = int(value)
        except (TypeError, ValueError) as error:
            raise AdapterError("cube must be 1, 2 or 3") from error
        if cube not in (1, 2, 3):
            raise AdapterError("cube must be 1, 2 or 3")
        return cube

    @staticmethod
    def _component(value: Any, *names: str) -> float:
        for name in names:
            component = getattr(value, name, None)
            if component is not None:
                try:
                    return float(component)
                except (TypeError, ValueError):
                    pass
        return 0.0

    @staticmethod
    def _number(value: Any) -> float:
        if callable(value):
            return 0.0
        try:
            return float(value or 0.0)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _status(value: Any, *names: str) -> bool:
        for name in names:
            component = getattr(value, name, None)
            if component is not None:
                return bool(component() if callable(component) else component)
        return False

    @staticmethod
    def _empty_face() -> dict[str, Any]:
        return {"detected": False, "count": 0, "x": 0.5, "y": 0.5, "size": 0.0, "position": "NONE", "ageMs": 0}

    @staticmethod
    def _empty_cube_marker() -> dict[str, Any]:
        return {"detected": False, "x": 0.5, "y": 0.5, "size": 0.0, "ageMs": 0}

    @staticmethod
    def _empty_cube(number: int) -> dict[str, Any]:
        return {
            "number": number,
            "available": False,
            "connected": False,
            "connecting": False,
            "factoryId": 0,
            "objectId": 0,
            "rssi": 0,
            "moving": False,
            "lastTapAt": 0.0,
            "tapCount": 0,
            "battery": 0,
            "accelX": 0.0,
            "accelY": 0.0,
            "accelZ": 0.0,
        }

    def _require_client(self):
        if not self.connected or self._client is None:
            raise NotConnectedError("Cozmo is not connected")
        return self._client

    def _connection_result(self) -> dict[str, Any]:
        serial = getattr(self._client, "serial_number", None)
        return {"connected": self.connected, "serial": str(serial) if serial is not None else None}

    def _robot_link_alive(self) -> bool:
        client = self._client
        if client is None:
            return False
        connection = getattr(client, "conn", None)
        connected_state = getattr(connection, "CONNECTED", 3)
        if getattr(connection, "state", connected_state) != connected_state:
            return False
        received_frames = self._received_frames(client)
        now = time.monotonic()
        if received_frames > self._last_received_frames:
            self._last_received_frames = received_frames
            self._last_robot_packet_at = now
        return now - self._last_robot_packet_at <= 3.0

    @staticmethod
    def _received_frames(client) -> int:
        connection = getattr(client, "conn", None)
        receiver = getattr(connection, "recv_thread", None)
        try:
            return int(getattr(receiver, "received_frames", 0) or 0)
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _clamp_number(params: dict[str, Any], key: str, minimum: float, maximum: float) -> float:
        value = params.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise AdapterError(f"{key} must be a number")
        return max(minimum, min(maximum, float(value)))

    @staticmethod
    async def _close_failed_client(client) -> None:
        try:
            await asyncio.to_thread(client.disconnect)
        except Exception:
            pass
        try:
            await asyncio.to_thread(client.stop)
        except Exception:
            pass
        # PyCozmo's Connection.stop() cannot join threads that were never
        # started. That happens when CodeON polls while the Mac is still on
        # its normal Wi-Fi. Close the already-created UDP socket explicitly so
        # a later attempt on Cozmo Wi-Fi starts with a clean transport.
        connection = getattr(client, "conn", None)
        robot_socket = getattr(connection, "sock", None)
        if isinstance(robot_socket, socket.socket):
            try:
                robot_socket.close()
            except OSError:
                pass

    def _connection_diagnostics(self, client) -> dict[str, Any]:
        connection = getattr(client, "conn", None)
        receiver = getattr(connection, "recv_thread", None)
        sender = getattr(connection, "send_thread", None)
        return {
            "state": getattr(connection, "state", None),
            "receivedFrames": getattr(receiver, "received_frames", None),
            "receivedPackets": getattr(receiver, "received_packets", None),
            "discardedFrames": getattr(receiver, "discarded_frames", None),
            "sentFrames": getattr(sender, "sent_frames", None),
            "firmware": getattr(client, "robot_fw_sig", None),
            "headSerialSeen": getattr(client, "serial_number_head", None) is not None,
            "bodySerialSeen": getattr(client, "serial_number", None) is not None,
            "localAddress": self._local_address,
        }

    def _bind_to_cozmo_network(self, client) -> None:
        """Pin PyCozmo's UDP socket to the active Cozmo Wi-Fi interface.

        This is important on laptops that retain another default route while
        connected to Cozmo's internet-less WLAN.
        """
        connection = getattr(client, "conn", None)
        robot_socket = getattr(connection, "sock", None)
        if not isinstance(robot_socket, socket.socket):
            return
        local_address = self._route_to_robot()
        if not local_address.startswith("172.31.1."):
            robot_socket.close()
            raise AdapterError(
                f"Mac is not routed through Cozmo Wi-Fi (local address: {local_address})"
            )
        self._pin_socket_to_macos_wifi(robot_socket)
        robot_socket.bind((local_address, 0))
        self._local_address = local_address

    @staticmethod
    def _pin_socket_to_macos_wifi(robot_socket) -> None:
        """Keep Cozmo UDP traffic on Wi-Fi when another interface has internet.

        macOS uses ``IP_BOUND_IF`` (25) to bind IPv4 traffic to an interface.
        Cozmo's WLAN is reached through the Mac's standard Wi-Fi interface
        while USB tethering may remain the default internet route.
        """
        if platform.system() != "Darwin":
            return
        try:
            wifi_index = socket.if_nametoindex("en0")
            robot_socket.setsockopt(socket.IPPROTO_IP, 25, wifi_index)
        except OSError as error:
            raise AdapterError(f"failed to bind Cozmo transport to Wi-Fi interface en0: {error}") from error

    @staticmethod
    def _route_to_robot() -> str:
        route_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            route_socket.connect(("172.31.1.1", 5551))
            return str(route_socket.getsockname()[0])
        finally:
            route_socket.close()
