/** Browser-local sensor mounting overrides. These never alter Blockly/server configuration. */
export interface SensorMount {
    x: number;
    y: number;
    theta?: number;
}

interface StoredMounts {
    version: 1;
    sensors: { [key: string]: SensorMount };
}

const STORAGE_KEY = 'codeon.sensorMounts.v1';
const MAX_OFFSET = 100;

function makeKey(robotGroup: string, sensorId: string, sensorType: string): string | undefined {
    const group = String(robotGroup || '').toLowerCase();
    if ((group !== 'rcx' && group !== 'rcj') || !sensorId || !sensorType) {
        return undefined;
    }
    return [group, String(sensorId), String(sensorType).toUpperCase()].join('|');
}

function isValidMount(value: any): value is SensorMount {
    return (
        value &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y) &&
        Math.abs(value.x) <= MAX_OFFSET &&
        Math.abs(value.y) <= MAX_OFFSET &&
        (value.theta === undefined || (Number.isFinite(value.theta) && Math.abs(value.theta) <= Math.PI * 2))
    );
}

function readAll(): StoredMounts {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { version: 1, sensors: {} };
        }
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 1 || !parsed.sensors || typeof parsed.sensors !== 'object') {
            return { version: 1, sensors: {} };
        }
        const sensors: { [key: string]: SensorMount } = {};
        Object.keys(parsed.sensors).forEach((key) => {
            if (isValidMount(parsed.sensors[key])) {
                sensors[key] = parsed.sensors[key];
            }
        });
        return { version: 1, sensors };
    } catch (_error) {
        // Storage can be disabled (for example in private browsing); SIM must still work.
        return { version: 1, sensors: {} };
    }
}

export function getSensorMount(robotGroup: string, sensorId: string, sensorType: string, fallback: SensorMount): SensorMount {
    const key = makeKey(robotGroup, sensorId, sensorType);
    const saved = key ? readAll().sensors[key] : undefined;
    return saved && isValidMount(saved) ? { ...fallback, ...saved } : fallback;
}

export function setSensorMount(robotGroup: string, sensorId: string, sensorType: string, mount: SensorMount): boolean {
    const key = makeKey(robotGroup, sensorId, sensorType);
    if (!key || !isValidMount(mount)) {
        return false;
    }
    try {
        const current = readAll();
        current.sensors[key] = { x: mount.x, y: mount.y, theta: mount.theta };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        return true;
    } catch (_error) {
        return false;
    }
}

export function removeSensorMount(robotGroup: string, sensorId: string, sensorType: string): void {
    const key = makeKey(robotGroup, sensorId, sensorType);
    if (!key) {
        return;
    }
    try {
        const current = readAll();
        delete current.sensors[key];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (_error) {
        // Best-effort reset: simulator's built-in placement remains the fallback.
    }
}
