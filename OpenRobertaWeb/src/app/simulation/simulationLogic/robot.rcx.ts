import RobotEv3 from 'robot.ev3';
import { RCXChassis } from 'robot.actuators';
import { EV3Keys, LightSensor, Timer, TouchSensor } from 'robot.sensors';

export default class RobotRcx extends RobotEv3 {
    override timer: Timer = new Timer(1);
    override readonly imgList = ['simpleBackground', 'drawBackground', 'robertaBackground', 'rescueBackground', 'maze', 'blank', 'mathBackground'];
    sensorMountOverlay: { drawPriority: number; draw: (ctx: CanvasRenderingContext2D, robot: RobotRcx) => void };

    /** The physical RCX keeps its motor outputs active when task main ends. */
    override resetOnProgramEnd(): void {}

    protected override configure(configuration: object): void {
        this.chassis = new RCXChassis(this.id, configuration, 2, this.pose);
        let sensors: object = configuration['SENSORS'];
        const touchPorts = Object.keys(sensors).filter((port) => sensors[port]['TYPE'] === 'TOUCH').sort();
        for (const c in sensors) {
            switch (sensors[c]['TYPE']) {
                case 'TOUCH': {
                    const index = touchPorts.indexOf(c);
                    const y = touchPorts.length > 1 ? (index - (touchPorts.length - 1) / 2) * 12 : 0;
                    this[c] = new TouchSensor(c, 25, y, this.chassis.geom.color, touchPorts.length > 1);
                    break;
                }
                case 'LIGHT': {
                    let myColorLightSensors = [];
                    let rcx = this;
                    Object.keys(this).forEach((x) => {
                        if (rcx[x] && rcx[x] instanceof LightSensor) {
                            myColorLightSensors.push(rcx[x]);
                        }
                    });
                    const ord = myColorLightSensors.length + 1;
                    const id = Object.keys(sensors).filter((sensor) => sensors[sensor]['TYPE'] == 'LIGHT').length;
                    let y = ord * 10 - 5 * (id + 1);
                    this[c] = new LightSensor(c, 15, y, 0, 5);
                    break;
                }
            }
        }
        let myButtons = [];
        this.buttons = new EV3Keys(myButtons, this.id);
        this.sensorMountOverlay = {
            drawPriority: 99,
            draw: (ctx: CanvasRenderingContext2D, robot: RobotRcx) => {
                const overlay = (window as any).CodeOnSensorOverlay2D;
                if (overlay) overlay.draw(ctx, robot, { rcx: RobotRcx, rcj: null, sensors: { TouchSensor, LightSensor } });
            },
        };
    }
}
