'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const file='staticResources/js/app/simulation/simulationLogic/robot.rcj.js';
const server=fs.readFileSync(path.join(root,'application',file),'utf8');
if(!process.argv.includes('--baseline')) assert.ok(server===fs.readFileSync(path.join(root,'OpenRobertaServer',file),'utf8'),'Resource parity');
class ColorSensor {constructor(port,x,y,theta,r){Object.assign(this,{port,x,y,theta,r});}}
class ColorSensorHex extends ColorSensor {}
class DistanceSensor extends ColorSensor {}
class UltrasonicSensor extends DistanceSensor {}
class TouchSensor extends ColorSensor {}
class InductiveSensor extends ColorSensor {}
function RobotBaseMobile() {}
const robotExports={};
const modules={require(){},exports:robotExports,
    'robot.base.mobile':{RobotBaseMobile,Pose:class {constructor(x,y,theta){Object.assign(this,{x,y,theta});}}},
    'robot.sensors':{ColorSensor,ColorSensorHex,DistanceSensor,UltrasonicSensor,TouchSensor,InductiveSensor,EV3Keys:class {constructor(){this.keys=[];}},GyroSensor:class {},Timer:class {}},
    'robot.actuators':{RCJChassis:class {constructor(){this.geom={x:-20,y:-20,w:34,h:40,color:'yellow'};}},StatusLed:class {},WebAudio:class {}},
    jquery:()=>({on(){}})};
vm.runInNewContext(server,{define:(deps,factory)=>factory(...deps.map(key=>{assert.ok(key in modules,key);return modules[key];}))});
for(const types of [['COLOR'],['COLOUR'],['COLOR','COLOUR'],['COLOUR','COLOR','COLOR']]){
    const robot=Object.create(robotExports.default.prototype);Object.assign(robot,{id:0,pose:{x:0,y:0,theta:0}});
    const SENSORS={};types.forEach((TYPE,i)=>SENSORS['F'+i]={TYPE,PORT:String.fromCharCode(67+i)});
    const config={SENSORS};const before=JSON.stringify(config);
    robotExports.default.prototype.configure.call(robot,config);
    types.forEach((_,i)=>{
        assert.ok(robot['F'+i] instanceof ColorSensorHex,'Missing colour instance for '+types[i]);
        assert.equal(robot['F'+i].port,'F'+i);
        assert.equal(robot['F'+i].x,9);
        assert.equal(robot['F'+i].y,(i+1)*10-5*(types.length+1),'Count both spellings symmetrically');
    });
    assert.equal(JSON.stringify(config),before);
}
console.log('PASS actual RCJ configure: COLOR/COLOUR, mixed multiple sensors, correct positions/keys, immutable configuration, resource parity.');
