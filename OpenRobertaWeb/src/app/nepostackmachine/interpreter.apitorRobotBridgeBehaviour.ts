import { RobotSimBehaviour } from './interpreter.robotSimBehaviour';
import { RobotBridgeClient } from 'robotBridge';
import { State } from './interpreter.state';

/** Stack-machine behaviour for the three independently controlled Apitor ports. */
export class ApitorRobotBridgeBehaviour extends RobotSimBehaviour {
    private lastAction = '';
    private sensorSnapshot: any = {};
    private sensorTimer: number | undefined;
    private motorStates = new Map<string, string>();

    constructor(private readonly bridge: RobotBridgeClient, private readonly onError?: (error: Error) => void) {
        super();
        this.pollSensors();
        this.updateStatus();
    }

    override motorOnAction(_name: string, port: any, _durationType: string, _duration: number, speed: number, _time: number): number {
        const numericSpeed = Number(speed) || 0;
        const level = Math.max(1, Math.min(12, Math.round(Math.abs(numericSpeed))));
        const direction = numericSpeed < 0 ? 2 : 1;
        const normalizedPort = String(port || '').toUpperCase();
        const nextState = `${direction}:${level}`;
        if (this.motorStates.get(normalizedPort) === nextState) {
            return 0;
        }
        this.motorStates.set(normalizedPort, nextState);
        this.lastAction = `${normalizedPort} · ${direction === 1 ? this.label('vorwärts', 'forward') : this.label('rückwärts', 'backward')} · ${level}`;
        this.updateStatus();
        this.bridge.command('setMotor', { port: normalizedPort, direction, speed: level }).catch((error) => {
            if (this.motorStates.get(normalizedPort) === nextState) {
                this.motorStates.delete(normalizedPort);
            }
            this.report(error);
        });
        return 0;
    }

    override motorStopAction(_name: string, port: any): number {
        const normalizedPort = String(port || '').toUpperCase();
        if (this.motorStates.get(normalizedPort) === 'stopped') {
            return 0;
        }
        this.motorStates.set(normalizedPort, 'stopped');
        this.lastAction = `${normalizedPort} · ${this.label('gestoppt', 'stopped')}`;
        this.updateStatus();
        this.bridge.command('stopMotor', { port: normalizedPort }).catch((error) => {
            if (this.motorStates.get(normalizedPort) === 'stopped') {
                this.motorStates.delete(normalizedPort);
            }
            this.report(error);
        });
        return 0;
    }

    override close(): void {
        if (this.sensorTimer !== undefined) {
            window.clearInterval(this.sensorTimer);
            this.sensorTimer = undefined;
        }
        this.motorStates.clear();
        this.bridge.stopAll().catch((error) => this.report(error));
        this.lastAction = this.label('Alle Motoren gestoppt', 'All motors stopped');
        this.updateStatus();
    }

    override getSample(state: State, name: string, sensor: string, port: any, mode: string, slot: string): void {
        if (sensor !== 'apitor') {
            super.getSample(state, name, sensor, port, mode, slot);
            return;
        }
        const key = String(mode || '');
        if (key === 'infrared1Line' || key === 'infrared2Line' || key === 'infrared1Outside' || key === 'infrared2Outside') {
            const isOutside = key.endsWith('Outside');
            const rawKey = key.startsWith('infrared1') ? 'infrared1' : 'infrared2';
            const isOnLine = Number(this.sensorSnapshot[rawKey]) >= 5;
            state.push(isOutside ? !isOnLine : isOnLine);
            return;
        }
        const value = this.sensorSnapshot[key];
        state.push(value === undefined || value === null ? 0 : Number(value));
    }

    private pollSensors(): void {
        const update = () =>
            this.bridge
                .sensor<any>('sensorSnapshot')
                .then((response) => {
                    this.sensorSnapshot = response.value || {};
                    this.updateStatus();
                })
                .catch((error) => console.warn('Apitor sensor sample delayed:', error));
        update();
        this.sensorTimer = window.setInterval(update, 200);
    }

    private updateStatus(): void {
        const id = 'codeon-apitor-status';
        let panel = document.getElementById(id);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = id;
            Object.assign(panel.style, {
                position: 'fixed', right: '18px', top: '64px', zIndex: '9999',
                padding: '10px 14px', borderRadius: '6px', color: '#ffffff',
                background: 'rgba(0, 52, 74, 0.92)', fontSize: '13px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)', pointerEvents: 'none'
            });
            document.body.appendChild(panel);
        }
        const sensorLine = this.sensorSnapshot.colorRaw === undefined
            ? this.label('Sensoren: noch keine Daten', 'Sensors: no data yet')
            : `${this.label('Sensoren', 'Sensors')}: Farbe ${this.sensorSnapshot.colorRaw}/${this.sensorSnapshot.colorGroup} · S1 ${this.sensorSnapshot.infrared1} · S2 ${this.sensorSnapshot.infrared2}`;
        panel.textContent = `🤖 Apitor ${this.label('Status', 'status')}\n${this.label('Aktion', 'Action')}: ${this.lastAction || this.label('Bereit', 'Ready')}\n${sensorLine}`;
    }

    private label(de: string, en: string): string {
        const language = (document.documentElement.lang || navigator.language || 'de').toLowerCase();
        return language.startsWith('de') ? de : en;
    }

    private report(error: unknown): void {
        const normalized = error instanceof Error ? error : new Error(String(error));
        if (this.onError) this.onError(normalized);
        else console.error(normalized);
    }
}
