import RobotEv3 from 'robot.ev3';
import { CozmoChassis } from 'robot.actuators';
import { EV3Keys, Timer } from 'robot.sensors';

/** Cozmo simulation with a differential tracked drive and fixed front lift. */
export default class RobotCozmo extends RobotEv3 {
    override timer: Timer = new Timer(1);
    override readonly imgList = ['simpleBackground', 'drawBackground', 'robertaBackground', 'rescueBackground', 'maze', 'blank', 'mathBackground'];

    protected override configure(configuration: object): void {
        this.chassis = new CozmoChassis(this.id, configuration, 2, this.pose);
        this.buttons = new EV3Keys([], this.id);
    }
}
