import * as C from './interpreter.constants';
import { RobotSimBehaviour } from './interpreter.robotSimBehaviour';
import { RobotBridgeClient } from 'robotBridge';
import { State } from './interpreter.state';

/**
 * Hardware behaviour shared by differential-drive robots using Robot Bridge 1.0.
 * Robot-specific limits remain in the adapter; the browser only converts the
 * stack-machine percentages and distances into protocol values.
 */
export class RobotBridgeBehaviour extends RobotSimBehaviour {
    private readonly maxWheelSpeedMmPerSec: number;
    private readonly trackWidthMm: number;
    private motionGeneration = 0;
    private sensorSnapshot: any = {};
    private sensorTimer: number | undefined;
    private lastAction = '';
    private lastError = '';
    private taskContext: { id: string; name: string; priority: number } | undefined;
    private readonly resourceOwners: {
        [resource: string]: { taskId: string; taskName: string; priority: number; validUntil: number };
    } = {};
    private taskConflictReported = false;
    private cameraRequested = false;

    constructor(private readonly bridge: RobotBridgeClient, maxWheelSpeedMmPerSec = 150, trackWidthMm = 70, private readonly onError?: (error: Error) => void) {
        super();
        this.maxWheelSpeedMmPerSec = maxWheelSpeedMmPerSec;
        this.trackWidthMm = trackWidthMm;
        this.updateStatusPanel();
        this.pollSensors();
    }

    override driveAction(_name: string, direction: string, speed: number, distance: number, time: number): number {
        const signedSpeed = this.directionSign(direction) * this.toWheelSpeed(speed);
        if (distance === 0) {
            this.stopMotion(this.taskContext?.id);
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
            this.stopMotion(this.taskContext?.id);
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
            this.stopMotion(this.taskContext?.id);
            return 0;
        }
        const duration =
            time !== undefined
                ? Math.max(0, time)
                : angle === undefined
                  ? 0
                  : this.travelTimeMs((Math.PI * this.trackWidthMm * Math.abs(angle) / 360) * (90 / 70), wheelSpeed);
        this.startMotion(left, right, duration);
        return duration;
    }

    override driveStop(_name: string): void {
        this.stopMotion(this.taskContext?.id);
    }

    override close(): void {
        if (this.sensorTimer !== undefined) window.clearInterval(this.sensorTimer);
        this.send('camera', { enabled: false });
        this.cameraRequested = false;
        this.setCameraPrivacyIndicator(false);
        this.stopMotion();
        this.lastAction = this.isGerman() ? 'Programm beendet' : 'Program finished';
        this.updateStatusPanel();
    }

    override motorOnAction(name: string, port: any, durationType: string, duration: number, speed: number, time: number): number {
        const normalizedPort = String(port || '').toLowerCase();
        const percent = Math.max(0, Math.min(100, Number(speed) || 0));
        if (normalizedPort === 'h') {
            if (this.claimResource('HEAD', 650)) this.send('setHead', { angle: -0.4 + percent * 0.011 });
            // Position blocks are complete actions: allow Cozmo enough time
            // to reach the requested position before executing the next block.
            return 650;
        }
        if (normalizedPort === 'a') {
            if (this.claimResource('LIFT', 2200)) this.send('setLift', { height: 32 + percent * 0.6 });
            return 2200;
        }
        return super.motorOnAction(name, port, durationType, duration, speed, time);
    }

    override toneAction(_name: string, frequency: number, duration: number): number {
        if (this.claimResource('AUDIO', Math.max(0, Number(duration) || 0))) this.send('tone', { frequency, duration });
        return Math.max(0, Number(duration) || 0);
    }

    override sayTextAction(text: string, speed: number, _pitch: number): number {
        const duration = Math.max(500, String(text).length * 75);
        if (this.claimResource('AUDIO', duration)) this.send('speak', { text: String(text), speed });
        return duration;
    }

    override ledOnAction(_name: string, _port: number, color: any): void {
        if (this.claimResource('BACKPACK_LIGHT', 250)) this.send('setBackpackLight', { color });
    }

    override ledOffAction(_name: string, _port: number): void {
        if (this.claimResource('BACKPACK_LIGHT', 250)) this.send('setBackpackLight', { color: '#000000' });
    }

    override lightAction(mode: string, _color: string, port: string): void {
        if (String(port).toLowerCase() === 'behavior') {
            if (String(mode).toLowerCase() === 'start') {
                const ownsDrive = this.claimResource('DRIVE', Number.POSITIVE_INFINITY);
                const ownsCamera = ownsDrive && this.claimResource('CAMERA', Number.POSITIVE_INFINITY);
                if (ownsDrive && ownsCamera) {
                    this.send('startBehavior', { preset: 'faceSearchAndFollow' });
                    this.cameraRequested = true;
                    this.setCameraPrivacyIndicator(true);
                } else if (ownsDrive) {
                    this.releaseResource('DRIVE');
                }
            } else if (this.claimResource('DRIVE', 250) && this.claimResource('CAMERA', 250)) {
                this.send('stopBehavior', {});
                this.cameraRequested = false;
                this.releaseResource('DRIVE');
                this.releaseResource('CAMERA');
                this.setCameraPrivacyIndicator(false);
            }
            return;
        }
        if (String(port).toLowerCase() === 'display') {
            if (this.claimResource('DISPLAY', 1000)) this.send('displayFace', { face: String(mode).toUpperCase() });
            return;
        }
        if (String(port).toLowerCase() === 'headlight') {
            if (this.claimResource('HEAD_LIGHT', 250)) this.send('setHeadLight', { enabled: String(mode).toLowerCase() === 'on' });
            return;
        }
        const cubeMatch = String(port).toLowerCase().match(/^cube([123])$/);
        if (cubeMatch) {
            if (this.claimResource(`CUBE_${cubeMatch[1]}_LIGHT`, 250)) {
                this.send('setCubeLight', { cube: Number(cubeMatch[1]), color: String(mode).toLowerCase() === 'off' ? '#000000' : _color });
            }
            return;
        }
        if (String(port).toLowerCase() !== 'camera') {
            super.lightAction(mode, _color, port);
            return;
        }
        const normalizedMode = String(mode).toLowerCase();
        if (normalizedMode === 'track') {
            if (this.claimResource('CAMERA', Number.POSITIVE_INFINITY)) {
                this.send('trackFace', {});
                this.cameraRequested = true;
                this.setCameraPrivacyIndicator(true);
            }
        }
        else {
            const enabled = normalizedMode === 'start' || normalizedMode === 'on';
            if (enabled && this.claimResource('CAMERA', Number.POSITIVE_INFINITY)) {
                this.send('camera', { enabled });
                this.cameraRequested = true;
                this.setCameraPrivacyIndicator(true);
            } else if (!enabled && this.claimResource('CAMERA', 250)) {
                this.send('camera', { enabled: false });
                this.cameraRequested = false;
                this.releaseResource('CAMERA');
                this.setCameraPrivacyIndicator(false);
            }
        }
    }

    override getSample(state: State, name: string, sensor: string, port: any, mode: string, slot: string): void {
        if (sensor !== 'cozmo' && sensor !== 'gyro') {
            super.getSample(state, name, sensor, port, mode, slot);
            return;
        }
        const key = String(mode || '').toLowerCase();
        if ((key.startsWith('face') || key.startsWith('cubemarker')) && !this.cameraRequested) {
            this.cameraRequested = true;
            this.send('camera', { enabled: true });
            this.setCameraPrivacyIndicator(true);
        }
        const face = this.sensorSnapshot.face || {};
        const cubeMarker = this.sensorSnapshot.cubeMarker || {};
        const cubeMatch = key.match(/^cube([123])(available|connected|moving|tapped|factoryid|battery|tapcount|accelx|accely|accelz)$/);
        if (cubeMatch) {
            const cube = (this.sensorSnapshot.cubes || {})[cubeMatch[1]] || {};
            const cubeKeys: { [key: string]: string } = {
                available: 'available',
                connected: 'connected',
                moving: 'moving',
                tapped: 'tapped',
                factoryid: 'factoryId',
                battery: 'battery',
                tapcount: 'tapCount',
                accelx: 'accelX',
                accely: 'accelY',
                accelz: 'accelZ',
            };
            const value = cube[cubeKeys[cubeMatch[2]]];
            state.push(value !== undefined ? value : false);
            return;
        }
        const values: { [key: string]: any } = {
            battery: this.sensorSnapshot.battery,
            headangle: this.sensorSnapshot.headAngle,
            liftheight: this.sensorSnapshot.liftHeight,
            accelx: this.sensorSnapshot.accelX,
            accely: this.sensorSnapshot.accelY,
            accelz: this.sensorSnapshot.accelZ,
            gyrox: this.sensorSnapshot.gyroX,
            gyroy: this.sensorSnapshot.gyroY,
            gyroz: this.sensorSnapshot.gyroZ,
            leftwheelspeed: this.sensorSnapshot.leftWheelSpeed,
            rightwheelspeed: this.sensorSnapshot.rightWheelSpeed,
            posex: this.sensorSnapshot.poseX,
            posey: this.sensorSnapshot.poseY,
            poseheading: this.sensorSnapshot.poseHeading,
            pickedup: !!this.sensorSnapshot.pickedUp,
            moving: !!this.sensorSnapshot.moving,
            oncharger: !!this.sensorSnapshot.onCharger,
            facedetected: !!face.detected,
            facecount: Number(face.count) || 0,
            facex: Number(face.x) || 0,
            facey: Number(face.y) || 0,
            facesize: Number(face.size) || 0,
            faceposition: face.position || 'NONE',
            cubemarkervisible: !!cubeMarker.detected,
            cubemarkerx: Number(cubeMarker.x) || 0,
            cubemarkery: Number(cubeMarker.y) || 0,
            cubemarkersize: Number(cubeMarker.size) || 0,
            angle: this.sensorSnapshot.gyroZ,
            rate: this.sensorSnapshot.gyroZ,
        };
        state.push(values[key] !== undefined ? values[key] : 0);
    }

    private pollSensors(): void {
        // Sensor data is informative. A single delayed sample must never stop
        // an otherwise healthy robot program or lock the editor.
        const update = () =>
            this.bridge
                .sensor<any>('snapshot')
                .then((response) => {
                    this.sensorSnapshot = response.value || {};
                    this.updateStatusPanel();
                })
                .catch((error) => console.warn('Cozmo sensor sample delayed:', error));
        update();
        this.sensorTimer = window.setInterval(update, 150);
    }

    public setTaskContext(id: string, name: string, priority: number): void {
        if (this.taskContext && this.taskContext.id === id && this.taskContext.name === name && this.taskContext.priority === priority) return;
        this.taskContext = { id, name, priority };
        this.updateStatusPanel();
    }

    public releaseTask(taskId: string): void {
        if (this.resourceOwners.DRIVE?.taskId === taskId) this.stopMotion(taskId);
        if (this.resourceOwners.CAMERA?.taskId === taskId) {
            this.send('stopBehavior', {});
            this.send('camera', { enabled: false });
            this.setCameraPrivacyIndicator(false);
        }
        Object.keys(this.resourceOwners).forEach((resource) => {
            if (this.resourceOwners[resource].taskId === taskId) delete this.resourceOwners[resource];
        });
    }

    private startMotion(left: number, right: number, durationMs: number): void {
        if (!this.claimResource('DRIVE', durationMs)) return;
        const ownerTaskId = this.taskContext?.id;
        const generation = ++this.motionGeneration;
        this.send('drive', { left, right });
        if (durationMs > 0) {
            window.setTimeout(() => {
                if (generation === this.motionGeneration) this.stopMotion(ownerTaskId);
            }, durationMs);
        }
    }

    private stopMotion(ownerTaskId?: string): void {
        if (ownerTaskId && this.resourceOwners.DRIVE && this.resourceOwners.DRIVE.taskId !== ownerTaskId) return;
        ++this.motionGeneration;
        delete this.resourceOwners.DRIVE;
        this.bridge.command('stopDrive', {}).catch((error) => this.report(error));
    }

    private claimResource(resource: string, durationMs: number): boolean {
        if (!this.taskContext) return true;
        const now = Date.now();
        const existing = this.resourceOwners[resource];
        if (existing && existing.validUntil <= now) delete this.resourceOwners[resource];
        const owner = this.resourceOwners[resource];
        if (owner && owner.taskId !== this.taskContext.id) {
            if (owner.priority > this.taskContext.priority) {
                this.lastAction = `${this.taskContext.name} · ${this.isGerman() ? 'wartet auf' : 'waiting for'} ${resource}`;
                this.updateStatusPanel();
                return false;
            }
            if (owner.priority === this.taskContext.priority) {
                if (!this.taskConflictReported) {
                    this.taskConflictReported = true;
                    this.report(
                        new Error(
                            `${this.isGerman() ? 'Task-Konflikt' : 'Task conflict'}: ${owner.taskName} / ${this.taskContext.name} · ${resource} · ${this.taskContext.priority}`
                        )
                    );
                }
                return false;
            }
        }
        this.resourceOwners[resource] = {
            taskId: this.taskContext.id,
            taskName: this.taskContext.name,
            priority: this.taskContext.priority,
            validUntil: Number.isFinite(durationMs) ? now + Math.max(50, durationMs) : Number.POSITIVE_INFINITY,
        };
        return true;
    }

    private releaseResource(resource: string): void {
        const owner = this.resourceOwners[resource];
        if (!owner || !this.taskContext || owner.taskId === this.taskContext.id) delete this.resourceOwners[resource];
    }

    private send(command: string, params: { [name: string]: any }): void {
        const german = this.isGerman();
        const labels: { [name: string]: string } = {
            drive: german ? 'Fahren' : 'Driving',
            setHead: german ? 'Kopf positionieren' : 'Positioning head',
            setLift: german ? 'Lift positionieren' : 'Positioning lift',
            tone: german ? 'Ton abspielen' : 'Playing tone',
            speak: german ? 'Text sprechen' : 'Speaking text',
            setBackpackLight: german ? 'Statusleuchte setzen' : 'Setting status light',
            setHeadLight: german ? 'IR-Scheinwerfer schalten' : 'Switching IR head light',
            setCubeLight: german ? `Würfel ${params.cube} beleuchten` : `Lighting Cube ${params.cube}`,
            camera: params.enabled ? (german ? 'Kamera starten' : 'Starting camera') : german ? 'Kamera stoppen' : 'Stopping camera',
            trackFace: german ? 'Gesicht fortlaufend verfolgen' : 'Tracking face continuously',
            displayFace: german ? 'Gesicht anzeigen' : 'Showing face',
            startBehavior: german ? 'Parallele Tasks starten' : 'Starting parallel tasks',
            stopBehavior: german ? 'Parallele Tasks stoppen' : 'Stopping parallel tasks',
        };
        this.lastAction = labels[command] || command;
        this.lastError = '';
        this.updateStatusPanel();
        this.bridge.command(command, params).catch((error) => {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.updateStatusPanel();
            this.report(error);
        });
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

    private setCameraPrivacyIndicator(enabled: boolean): void {
        const id = 'codeon-cozmo-camera-privacy';
        document.getElementById(id)?.remove();
        if (!enabled) return;
        const indicator = document.createElement('div');
        indicator.id = id;
        indicator.textContent = this.isGerman()
            ? '🔒 Privacy Mode aktiv · Cozmo-Kamera wird nur lokal ausgewertet'
            : '🔒 Privacy Mode active · Cozmo camera is processed locally only';
        Object.assign(indicator.style, {
            position: 'fixed',
            right: '18px',
            top: '18px',
            zIndex: '10000',
            padding: '10px 14px',
            borderRadius: '6px',
            color: '#ffffff',
            background: '#006b73',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            fontSize: '14px',
            fontWeight: '600',
            pointerEvents: 'none',
        });
        document.body.appendChild(indicator);
    }

    private updateStatusPanel(): void {
        const id = 'codeon-cozmo-status';
        let panel = document.getElementById(id);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = id;
            Object.assign(panel.style, {
                position: 'fixed',
                right: '18px',
                top: '64px',
                zIndex: '9999',
                minWidth: '250px',
                maxWidth: '360px',
                padding: '10px 14px',
                borderRadius: '6px',
                color: '#ffffff',
                background: 'rgba(0, 52, 74, 0.92)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                fontSize: '13px',
                lineHeight: '1.45',
                whiteSpace: 'pre-line',
                pointerEvents: 'none',
            });
            document.body.appendChild(panel);
        }
        const german = this.isGerman();
        const face = this.sensorSnapshot.face || {};
        const camera = this.sensorSnapshot.cameraEnabled
            ? this.sensorSnapshot.faceTracking
                ? german
                    ? 'aktiv · Gesicht verfolgen'
                    : 'active · tracking face'
                : german
                  ? 'aktiv'
                  : 'active'
            : german
              ? 'aus'
              : 'off';
        const audio = this.sensorSnapshot.audioBusy
            ? german
                ? 'wird abgespielt'
                : 'playing'
            : this.sensorSnapshot.audioError
              ? german
                  ? 'Fehler'
                  : 'error'
              : german
                ? 'bereit'
                : 'ready';
        const head = Number(this.sensorSnapshot.headAngle);
        const lift = Number(this.sensorSnapshot.liftHeight);
        const position =
            (Number.isFinite(head) ? `${german ? 'Kopf' : 'Head'} ${head.toFixed(2)} rad` : `${german ? 'Kopf' : 'Head'} –`) +
            ' · ' +
            (Number.isFinite(lift) ? `Lift ${lift.toFixed(0)} mm` : 'Lift –');
        const error = this.lastError || this.sensorSnapshot.audioError;
        const cameraFrames = Number(this.sensorSnapshot.cameraFrames) || 0;
        const faceDetections = Number(this.sensorSnapshot.faceDetections) || 0;
        const cameraDetail = ` · ${cameraFrames} ${german ? 'Bilder' : 'frames'}`;
        const cameraError = this.sensorSnapshot.cameraError;
        const behavior = this.sensorSnapshot.behaviorControl || {};
        const cubes = this.sensorSnapshot.cubes || {};
        const cubeSummary = ['1', '2', '3']
            .map((cube) => `${cube}:${cubes[cube]?.connected ? '●' : cubes[cube]?.available ? '◐' : '○'}`)
            .join(' ');
        const cubeMarker = this.sensorSnapshot.cubeMarker || {};
        const driveDecision = behavior.decisions && behavior.decisions.DRIVE;
        const behaviorStatus = behavior.running
            ? `${driveDecision && driveDecision.owner ? driveDecision.owner : german ? 'läuft' : 'running'} · Tick ${Number(behavior.tickId) || 0}`
            : german
              ? 'aus'
              : 'off';
        const visualTask = this.taskContext
            ? `${this.taskContext.name} · ${this.isGerman() ? 'Priorität' : 'priority'} ${this.taskContext.priority}`
            : behaviorStatus;
        panel.textContent =
            `🤖 Cozmo ${german ? 'Status' : 'status'}\n${german ? 'Aktion' : 'Action'}: ${this.lastAction || (german ? 'Bereit' : 'Ready')}\n` +
            `${german ? 'Kamera' : 'Camera'}: ${camera}${cameraDetail}\n${german ? 'Gesicht' : 'Face'}: ${
                face.detected
                    ? german
                        ? 'gerade erkannt'
                        : 'detected now'
                    : faceDetections > 0
                      ? german
                          ? `erkannt · ${faceDetections} Treffer`
                          : `detected · ${faceDetections} hits`
                      : german
                        ? 'noch nicht erkannt'
                        : 'not detected yet'
            }\n` +
            `${german ? 'Audio' : 'Audio'}: ${audio}\n${position}` +
            `\n${german ? 'Würfel' : 'Cubes'}: ${cubeSummary} · ${german ? 'Marker' : 'marker'} ${cubeMarker.detected ? '●' : '○'}` +
            `\n${german ? 'Task' : 'Task'}: ${visualTask}` +
            (error || cameraError ? `\n⚠ ${error || cameraError}` : '');
    }

    private isGerman(): boolean {
        const pageLanguage = document.documentElement.lang || '';
        return pageLanguage.toLowerCase().startsWith('de') || navigator.language.toLowerCase().startsWith('de');
    }

    private report(error: Error): void {
        if (this.onError) this.onError(error);
        else console.error(error);
    }
}
