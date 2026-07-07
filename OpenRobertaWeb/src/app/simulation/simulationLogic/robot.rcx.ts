import RobotEv3 from 'robot.ev3';
import { NXTChassis } from 'robot.actuators';
import { EV3Keys, LightSensor, Timer, TouchSensor } from 'robot.sensors';

export default class RobotRcx extends RobotEv3 {
    override timer: Timer = new Timer(1);

    protected override configure(configuration: object): void {
        this.chassis = new NXTChassis(this.id, configuration, 2, this.pose);
        let sensors: object = configuration['SENSORS'];
        for (const c in sensors) {
            switch (sensors[c]['TYPE']) {
                case 'TOUCH':
                    this[c] = new TouchSensor(c, 25, 0, this.chassis.geom.color);
                    break;
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
    }
}
