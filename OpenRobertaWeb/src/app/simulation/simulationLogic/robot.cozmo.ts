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

    /** A new program keeps the physical lift state instead of lowering it for one frame. */
    override reset(): void {
        const chassis = this.chassis as CozmoChassis;
        const liftPosition = chassis.liftPosition;
        super.reset();
        chassis.holdLiftPosition(liftPosition);
    }

    /** Program end stops the tracks but is not an implicit lift-down command. */
    override resetOnProgramEnd(): void {
        this.reset();
    }
}
