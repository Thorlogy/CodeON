import * as C from './interpreter.constants';
import { RobotSimBehaviour } from './interpreter.robotSimBehaviour';
import { RobotBridgeClient } from 'robotBridge';

/**
 * Hardware behaviour shared by differential-drive robots using Robot Bridge 1.0.
 * Robot-specific limits remain in the adapter; the browser only converts the
 * stack-machine percentages and distances into protocol values.
 */
export class RobotBridgeBehaviour extends RobotSimBehaviour {
    private readonly maxWheelSpeedMmPerSec: number;
    private readonly trackWidthMm: number;
    private motionGeneration = 0;

    constructor(private readonly bridge: RobotBridgeClient, maxWheelSpeedMmPerSec = 150, trackWidthMm = 70, private readonly onError?: (error: Error) => void) {
        super();
        this.maxWheelSpeedMmPerSec = maxWheelSpeedMmPerSec;
        this.trackWidthMm = trackWidthMm;
    }

    override driveAction(_name: string, direction: string, speed: number, distance: number, time: number): number {
        const signedSpeed = this.directionSign(direction) * this.toWheelSpeed(speed);
        if (distance === 0) {
            this.stopMotion();
            return 0;
        }
        const duration = time !== undefined ? Math.max(0, time) : distance === undefined ? 0 : this.travelTimeMs(distance * 10, signedSpeed);
        this.startMotion(signedSpeed, signedSpeed, duration);
        return duration;
    }

    override curveAction(_name: string, direction: string, speedL: number, speedR: number, distance: number, time: number): number {
        const sign = this.directionSign(direction);
        const left = sign * this.toWheelSpeed(speedL);
        const right = sign * this.toWheelSpeed(speedR);
        if (distance === 0) {
            this.stopMotion();
            return 0;
        }
        const duration =
            time !== undefined ? Math.max(0, time) : distance === undefined ? 0 : this.travelTimeMs(distance * 10, (Math.abs(left) + Math.abs(right)) / 2);
        this.startMotion(left, right, duration);
        return duration;
    }

    override turnAction(_name: string, direction: string, speed: number, angle: number, time: number): number {
        const wheelSpeed = this.toWheelSpeed(speed);
        const left = direction === C.LEFT ? -wheelSpeed : wheelSpeed;
        const right = -left;
        if (angle === 0) {
            this.stopMotion();
            return 0;
        }
        const duration =
            time !== undefined
                ? Math.max(0, time)
                : angle === undefined
                  ? 0
                  : this.travelTimeMs(Math.PI * this.trackWidthMm * Math.abs(angle) / 360, wheelSpeed);
        this.startMotion(left, right, duration);
        return duration;
    }

    override driveStop(_name: string): void {
        this.stopMotion();
    }

    override close(): void {
        this.stopMotion();
    }

    private startMotion(left: number, right: number, durationMs: number): void {
        const generation = ++this.motionGeneration;
        this.send('drive', { left, right });
        if (durationMs > 0) {
            window.setTimeout(() => {
                if (generation === this.motionGeneration) this.stopMotion();
            }, durationMs);
        }
    }

    private stopMotion(): void {
        ++this.motionGeneration;
        this.bridge.stopAll().catch((error) => this.report(error));
    }

    private send(command: string, params: { [name: string]: number }): void {
        this.bridge.command(command, params).catch((error) => this.report(error));
    }

    private toWheelSpeed(percent: number): number {
        return Math.max(-100, Math.min(100, Number(percent) || 0)) * this.maxWheelSpeedMmPerSec / 100;
    }

    private directionSign(direction: string): number {
        return direction === C.FORWARD || direction === C.FOREWARD ? 1 : -1;
    }

    private travelTimeMs(distanceMm: number, speedMmPerSec: number): number {
        return speedMmPerSec === 0 ? 0 : Math.abs(distanceMm / speedMmPerSec) * 1000;
    }

    private report(error: Error): void {
        if (this.onError) this.onError(error);
        else console.error(error);
    }
}
