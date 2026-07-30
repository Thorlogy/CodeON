import { RobotSimBehaviour } from './interpreter.robotSimBehaviour';
import { RobotBridgeClient } from 'robotBridge';

/** Stack-machine behaviour for the three independently controlled Apitor ports. */
export class ApitorRobotBridgeBehaviour extends RobotSimBehaviour {
    private lastAction = '';

    constructor(private readonly bridge: RobotBridgeClient, private readonly onError?: (error: Error) => void) {
        super();
        this.updateStatus();
    }

    override motorOnAction(_name: string, port: any, _durationType: string, _duration: number, speed: number, _time: number): number {
        const numericSpeed = Number(speed) || 0;
        const level = Math.max(1, Math.min(12, Math.round(Math.abs(numericSpeed))));
        const direction = numericSpeed < 0 ? 2 : 1;
        const normalizedPort = String(port || '').toUpperCase();
        this.lastAction = `${normalizedPort} · ${direction === 1 ? this.label('vorwärts', 'forward') : this.label('rückwärts', 'backward')} · ${level}`;
        this.updateStatus();
        this.bridge.command('setMotor', { port: normalizedPort, direction, speed: level }).catch((error) => this.report(error));
        return 0;
    }

    override motorStopAction(_name: string, port: any): number {
        const normalizedPort = String(port || '').toUpperCase();
        this.lastAction = `${normalizedPort} · ${this.label('gestoppt', 'stopped')}`;
        this.updateStatus();
        this.bridge.command('stopMotor', { port: normalizedPort }).catch((error) => this.report(error));
        return 0;
    }

    override close(): void {
        this.bridge.stopAll().catch((error) => this.report(error));
        this.lastAction = this.label('Alle Motoren gestoppt', 'All motors stopped');
        this.updateStatus();
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
        panel.textContent = `🤖 Apitor ${this.label('Status', 'status')}\n${this.label('Aktion', 'Action')}: ${this.lastAction || this.label('Bereit', 'Ready')}`;
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
