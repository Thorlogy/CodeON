import RobotEv3 from 'robot.ev3';
import { ApitorChassis } from 'robot.actuators';
import { EV3Keys, Timer } from 'robot.sensors';

/** Robot X standard-model simulation (M2 left, M3 right, M1 auxiliary). */
export default class RobotApitor extends RobotEv3 {
    override timer: Timer = new Timer(1);
    override readonly imgList = ['simpleBackground', 'drawBackground', 'robertaBackground', 'rescueBackground', 'maze', 'blank', 'mathBackground'];

    protected override configure(configuration: object): void {
        this.chassis = new ApitorChassis(this.id, configuration, 2, this.pose);
        this.buttons = new EV3Keys([], this.id);
    }
}
