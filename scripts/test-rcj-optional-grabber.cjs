'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),relative='staticResources/js/app/simulation/simulationLogic/robot.actuators.js';
const source=fs.readFileSync(path.join(base,'OpenRobertaServer',relative),'utf8');
assert.equal(source,fs.readFileSync(path.join(base,'application',relative),'utf8'));
const exported={};let display='old';
const jquery=()=>({html(value){if(value===undefined)return display;display=value;return this;}});
vm.runInNewContext(source,{define(names,factory){factory(()=>{},exported,{}, {epsilonEqual:(a,b,e)=>Math.abs(a-b)<e},{},{},{},jquery,{});}});
// Isolate the RCJ override: shared drive behaviour is covered by browser tests.
let driveCalls=0;
exported.ChassisDiffDrive.prototype.updateAction=function(){driveCalls++;};
const behaviour={getActionState:()=>({clear:true}),setBlocking(value){this.blocked=value;}};
function fixture(motor){
    return Object.assign(Object.create(exported.RCJChassis.prototype),{id:0,manipulator:motor,
        grabberAngle:1,grabberWidth:10,grabber:{w:-31,x:1},frontLeft:{y:-18},frontRight:{y:18},geom:{w:46},
        grabberLeft:{},grabberRight:{}});
}
for(const motor of [undefined,{port:'E',speed:20,angle:10}]){
    const chassis=fixture(motor),robot={chassis,interpreter:{getRobotBehaviour:()=>behaviour}};
    chassis.reset();chassis.reset();
    assert.equal(chassis.grabberAngle,0);assert.equal(chassis.grabberWidth,-31);
    assert.equal(chassis.grabberLeft,null);assert.equal(chassis.grabberRight,null);assert.equal(display,'');
    if(motor){assert.equal(motor.speed,0);assert.equal(motor.angle,0);}
    else assert.equal(chassis.manipulator,undefined,'No fictitious motor is created');
    display='stale';chassis.updateAction(robot,.1,true);assert.equal(display,'','Display actions still run');
    chassis.updateAction(robot,.1,false);
}
const motor={port:'E',speed:20,angle:10},chassis=fixture(motor),robot={chassis,interpreter:{getRobotBehaviour:()=>behaviour}};
chassis.updateAction(robot,.1,true);
assert.ok(chassis.grabberAngle>1,'Existing grabber moves');assert.ok(motor.angle<10);
motor.speed=-20;motor.angle=.01;behaviour.blocked=true;
chassis.updateAction(robot,.1,true);
assert.equal(motor.speed,0);assert.equal(motor.angle,null);assert.equal(behaviour.blocked,false,'Existing completion unblocks interpreter');
assert.equal(driveCalls,6,'Shared drive updates are never skipped');
console.log('PASS RCJ optional grabber: reset twice, running/stopped updates, display, unchanged motor movement/completion.');
