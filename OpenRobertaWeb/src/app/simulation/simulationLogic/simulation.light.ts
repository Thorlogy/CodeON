export interface AmbientLightSource {
    x: number;
    y: number;
    range: number;
    intensity: number;
}

/** Calculate the combined light level seen inside a directional sensor cone. */
export function calculateAmbientLight(
    sensorX: number,
    sensorY: number,
    viewDirection: number,
    lights: AmbientLightSource[],
    halfConeAngle: number = Math.PI / 8
): number {
    return Math.min(
        100,
        lights.reduce((sum, lamp) => {
            const dx = lamp.x - sensorX;
            const dy = lamp.y - sensorY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (lamp.range <= 0 || distance > lamp.range) {
                return sum;
            }
            const direction = Math.atan2(dy, dx);
            const angle = Math.atan2(Math.sin(direction - viewDirection), Math.cos(direction - viewDirection));
            if (Math.abs(angle) > halfConeAngle) {
                return sum;
            }
            return sum + Math.max(0, lamp.intensity) * Math.max(0, 1 - distance / lamp.range);
        }, 0)
    );
}
