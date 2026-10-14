import { Pose, RobotBaseMobile } from 'robot.base.mobile';
import { ColorSensor, ColorSensorHex, DistanceSensor, EV3Keys, GyroSensor, InductiveSensor, Timer, TouchSensor, UltrasonicSensor } from 'robot.sensors';
import { ChassisDiffDrive, RCJChassis, StatusLed, WebAudio } from 'robot.actuators';
import { getSensorMount } from 'robot.sensor.points';
import * as $ from 'jquery';

export default class RobotRcj extends RobotBaseMobile {
    chassis: ChassisDiffDrive;
    led: StatusLed;
    override timer: Timer = new Timer(5);
    buttons: EV3Keys;
    gyro: GyroSensor;
    webAudio: WebAudio = new WebAudio();
    sensorMountOverlay: { drawPriority: number; draw: (ctx: CanvasRenderingContext2D, robot: RobotRcj) => void };

    protected configure(configuration: object): void {
        let rcj = this;
        this.chassis = new RCJChassis(this.id, configuration, 1.75, this.pose);
        this.led = new StatusLed({ x: -5, y: 0 }, this.chassis.geom.color, '#EBC300');
        let sensors: object = configuration['SENSORS'];
        for (const c in sensors) {
            switch (sensors[c]['TYPE']) {
                case 'TOUCH':
                    // only one is drawable as bumper
                    const touchMount = getSensorMount('rcj', c, 'TOUCH', { x: -25, y: 0 });
                    this[c] = new TouchSensor(c, touchMount.x, touchMount.y, this.chassis.geom.color);
                    break;
                case 'INDUCTIVE':
                    const inductiveMount = getSensorMount('rcj', c, 'INDUCTIVE', { x: 14, y: 0 });
                    this[c] = new InductiveSensor(c, inductiveMount.x, inductiveMount.y, 60);
                    break;
                case 'COLOR': // Current server type; retain legacy COLOUR configurations.
                case 'COLOUR':
                    let myColorSensors = [];
                    Object.keys(this).forEach((x) => {
                        if (rcj[x] && rcj[x] instanceof ColorSensor) {
                            myColorSensors.push(rcj[x]);
                        }
                    });
                    const ord = myColorSensors.length + 1;
                    const id = Object.keys(sensors).filter((port) => ['COLOR', 'COLOUR'].includes(sensors[port]['TYPE'])).length;
                    let y = ord * 10 - 5 * (id + 1);
                    const colorMount = getSensorMount('rcj', c, 'COLOR', { x: 9, y, theta: 0 });
                    this[c] = new ColorSensorHex(c, colorMount.x, colorMount.y, colorMount.theta || 0, 5);
                    break;
                case 'ULTRASONIC': {
                    let mySensors = [];
                    let rcj = this;
                    Object.keys(this).forEach((x) => {
                        if (rcj[x] && rcj[x] instanceof DistanceSensor) {
                            mySensors.push(rcj[x]);
                        }
                    });
                    const ord = mySensors.length + 1;
                    const num = Object.keys(sensors).filter((port) => sensors[port]['TYPE'] == 'ULTRASONIC').length;
                    let position: Pose = new Pose(this.chassis.geom.x + this.chassis.geom.w, 0, 0);
                    if (num == 3) {
                        if (ord == 1) {
                            position = new Pose(this.chassis.geom.h / 2, -this.chassis.geom.h / 2, -Math.PI / 4);
                        } else if (ord == 2) {
                            position = new Pose(this.chassis.geom.h / 2, this.chassis.geom.h / 2, Math.PI / 4);
                        }
                    } else if (num % 2 === 0) {
                        switch (ord) {
                            case 1:
                                position = new Pose(this.chassis.geom.x + this.chassis.geom.w, -this.chassis.geom.h / 2, -Math.PI / 4);
                                break;
                            case 2:
                                position = new Pose(this.chassis.geom.x + this.chassis.geom.w, this.chassis.geom.h / 2, Math.PI / 4);
                                break;
                            case 3:
                                position = new Pose(this.chassis.geom.x, -this.chassis.geom.h / 2, (-3 * Math.PI) / 4);
                                break;
                            case 4:
                                position = new Pose(this.chassis.geom.x, this.chassis.geom.h / 2, (3 * Math.PI) / 4);
                                break;
                        }
                    }
                    const ultrasonicMount = getSensorMount('rcj', c, 'ULTRASONIC', { x: position.x, y: position.y, theta: position.theta });
                    this[c] = new UltrasonicSensor(c, ultrasonicMount.x, ultrasonicMount.y, ultrasonicMount.theta || 0, 250);
                    break;
                }
            }
        }
        let myButtons = [
            {
                name: 'rcjButtonLeft',
                value: false,
            },
            {
                name: 'rcjButtonRight',
                value: false,
            },
        ];
        this.buttons = new EV3Keys(myButtons, this.id);
        let $stopButton = $('#rcjButtonStop' + this.id);
        $stopButton.on('mousedown touchstart', function () {
            rcj.interpreter.terminate();
        });
        for (let property in this['buttons']['keys']) {
            let $property = $('#' + this['buttons']['keys'][property].name + rcj.id);
            $property.on('mousedown touchstart', function () {
                rcj['buttons']['keys'][this.id.replace(/\d+$/, '')]['value'] = true;
            });
            $property.on('mouseup touchend', function () {
                rcj['buttons']['keys'][this.id.replace(/\d+$/, '')]['value'] = false;
            });
        }
        this.gyro = new GyroSensor();
        this.sensorMountOverlay = {
            drawPriority: 99,
            draw: (ctx: CanvasRenderingContext2D, robot: RobotRcj) => {
                const overlay = (window as any).CodeOnSensorOverlay2D;
                if (overlay) overlay.draw(ctx, robot, {
                    rcx: null, rcj: RobotRcj,
                    sensors: { TouchSensor, ColorSensor, ColorSensorHex, UltrasonicSensor, InductiveSensor },
                });
            },
        };
    }
}
