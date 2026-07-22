export interface RobotBridgeManifest {
    robot: string;
    adapterVersion: string;
    protocolVersion: '1.0';
    capabilities: { [name: string]: any };
    limits: { [name: string]: any };
}

interface BridgeResponse<T> {
    id: string;
    ok: boolean;
    result?: T;
    error?: { code: string; message: string };
}

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason: Error) => void;
    timeout: number;
}

export class RobotBridgeError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
        this.name = 'RobotBridgeError';
    }
}

/** Browser client shared by all adapters implementing Robot Bridge Protocol 1.0. */
export class RobotBridgeClient {
    private socket: WebSocket | undefined;
    private sequence = 0;
    private pending = new Map<string, PendingRequest>();
    private heartbeatTimer: number | undefined;

    constructor(
        private readonly url = 'ws://127.0.0.1:2223',
        private readonly requestTimeoutMs = 3000,
        private readonly heartbeatIntervalMs = 400
    ) {}

    public open(): Promise<void> {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(this.url);
            this.socket = socket;
            socket.onopen = () => resolve();
            socket.onerror = () => reject(new RobotBridgeError('TRANSPORT_ERROR', 'Robot bridge is not reachable'));
            socket.onmessage = (event) => this.handleResponse(event.data);
            socket.onclose = () => this.handleClose();
        });
    }

    public capabilities(): Promise<RobotBridgeManifest> {
        return this.request<RobotBridgeManifest>('capabilities');
    }

    public connectRobot(): Promise<{ connected: boolean; serial?: string }> {
        // Starting PyCozmo and discovering the robot can take noticeably
        // longer after a Wi-Fi switch. Keep ordinary commands on the short
        // timeout, but give initial hardware discovery enough time to finish.
        return this.request('connect', {}, 30000);
    }

    public status(): Promise<{ connected: boolean; robot: string }> {
        return this.request('status');
    }

    public async command(command: string, params: { [name: string]: any } = {}): Promise<any> {
        const result = await this.request('command', { command, params });
        if (command === 'drive' || command === 'turn') {
            this.startHeartbeat();
        }
        return result;
    }

    public sensor<T>(sensor: string, params: { [name: string]: any } = {}): Promise<{ value: T }> {
        return this.request('sensor', { sensor, params });
    }

    public async stopAll(): Promise<void> {
        this.stopHeartbeat();
        await this.request('stopAll');
    }

    public async disconnectRobot(): Promise<void> {
        this.stopHeartbeat();
        await this.request('disconnect');
    }

    public close(): void {
        this.stopHeartbeat();
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close();
        }
        this.socket = undefined;
    }

    private request<T>(type: string, values: { [name: string]: any } = {}, timeoutMs = this.requestTimeoutMs): Promise<T> {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return Promise.reject(new RobotBridgeError('TRANSPORT_CLOSED', 'Robot bridge connection is closed'));
        }
        const id = 'codeon-' + ++this.sequence;
        const message = Object.assign({ id, version: '1.0', type }, values);
        return new Promise<T>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                this.pending.delete(id);
                reject(new RobotBridgeError('REQUEST_TIMEOUT', 'Robot bridge did not answer in time'));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timeout });
            this.socket!.send(JSON.stringify(message));
        });
    }

    private handleResponse(rawMessage: any): void {
        let response: BridgeResponse<any>;
        try {
            response = JSON.parse(String(rawMessage));
        } catch (_) {
            return;
        }
        const pending = this.pending.get(response.id);
        if (!pending) {
            return;
        }
        window.clearTimeout(pending.timeout);
        this.pending.delete(response.id);
        if (response.ok) {
            pending.resolve(response.result);
        } else {
            const error = response.error || { code: 'BRIDGE_ERROR', message: 'Robot bridge rejected the request' };
            pending.reject(new RobotBridgeError(error.code, error.message));
        }
    }

    private startHeartbeat(): void {
        if (this.heartbeatTimer !== undefined) {
            return;
        }
        this.heartbeatTimer = window.setInterval(() => {
            this.request('heartbeat').catch(() => this.stopHeartbeat());
        }, this.heartbeatIntervalMs);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer !== undefined) {
            window.clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
    }

    private handleClose(): void {
        this.stopHeartbeat();
        this.socket = undefined;
        this.pending.forEach((pending) => {
            window.clearTimeout(pending.timeout);
            pending.reject(new RobotBridgeError('TRANSPORT_CLOSED', 'Robot bridge connection was closed'));
        });
        this.pending.clear();
    }
}
