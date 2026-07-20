class BridgeError(Exception):
    """Base class for errors that are safe to return to a bridge client."""

    code = "BRIDGE_ERROR"


class ProtocolError(BridgeError):
    code = "PROTOCOL_ERROR"


class AdapterError(BridgeError):
    code = "ADAPTER_ERROR"


class NotConnectedError(AdapterError):
    code = "NOT_CONNECTED"


class UnsupportedCommandError(AdapterError):
    code = "UNSUPPORTED_COMMAND"
