import { BridgeState, ConnectionDiagnostics, DiagnosticError } from 'connectionDiagnostics';

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
    type: string;
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
    private openedAt: number | undefined;
    private lastResponseAt: number | undefined;
    private lastHeartbeatAt: number | undefined;
    private lastClosedAt: number | undefined;
    private lastError: DiagnosticError | undefined;

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
            socket.onopen = () => {
                this.openedAt = Date.now();
                resolve();
            };
            socket.onerror = () => {
                const error = new RobotBridgeError('TRANSPORT_ERROR', 'Robot bridge is not reachable');
                this.recordError(error);
                reject(error);
            };
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
        if (command === 'drive' || command === 'turn' || command === 'setMotor') {
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

    public getDiagnostics(): ConnectionDiagnostics {
        return {
            connectionKind: 'local-bridge',
            connectionName: 'CodeON Robot Bridge Protocol 1.0',
            endpoint: this.url,
            bridgeState: this.getBridgeState(),
            robotConnected: false,
            connecting: this.getBridgeState() === 'connecting',
            retryScheduled: false,
            healthMonitorActive: false,
            heartbeatActive: this.heartbeatTimer !== undefined,
            openedAt: this.openedAt,
            lastResponseAt: this.lastResponseAt,
            lastHeartbeatAt: this.lastHeartbeatAt,
            lastClosedAt: this.lastClosedAt,
            lastError: this.lastError && { ...this.lastError },
        };
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
                const error = new RobotBridgeError('REQUEST_TIMEOUT', 'Robot bridge did not answer in time');
                this.recordError(error);
                reject(error);
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timeout, type });
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
            this.lastResponseAt = Date.now();
            if (pending.type === 'heartbeat') this.lastHeartbeatAt = this.lastResponseAt;
            pending.resolve(response.result);
        } else {
            const error = response.error || { code: 'BRIDGE_ERROR', message: 'Robot bridge rejected the request' };
            const bridgeError = new RobotBridgeError(error.code, error.message);
            this.recordError(bridgeError);
            pending.reject(bridgeError);
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
        this.lastClosedAt = Date.now();
        this.socket = undefined;
        if (this.pending.size > 0) this.recordError(new RobotBridgeError('TRANSPORT_CLOSED', 'Robot bridge connection was closed'));
        this.pending.forEach((pending) => {
            window.clearTimeout(pending.timeout);
            pending.reject(new RobotBridgeError('TRANSPORT_CLOSED', 'Robot bridge connection was closed'));
        });
        this.pending.clear();
    }

    private getBridgeState(): BridgeState {
        if (!this.socket) return 'closed';
        if (this.socket.readyState === 0) return 'connecting';
        if (this.socket.readyState === 1) return 'open';
        if (this.socket.readyState === 2) return 'closing';
        return 'closed';
    }

    private recordError(error: RobotBridgeError): void {
        this.lastError = { code: String(error.code || 'BRIDGE_ERROR'), message: String(error.message || 'Robot bridge error'), at: Date.now() };
    }
}
