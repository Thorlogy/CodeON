'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const relative = 'staticResources/js/app/simulation/simulationLogic/robot.sensor.visuals.js';
const api = require(path.join(root, 'OpenRobertaServer', relative));
const types = {rcx: class e {}, rcj: class e {}, sensors:{}};
for(const name of ['TouchSensor','LightSensor','ColorSensor','ColorSensorHex','UltrasonicSensor','InductiveSensor']) types.sensors[name]=class e {};
const describe = robot => api.describe(robot,types);
assert.equal(fs.readFileSync(path.join(root,'OpenRobertaServer',relative),'utf8'), fs.readFileSync(path.join(root,'application',relative),'utf8'));
// Source-derived configuration fixtures, NOT a recorded compiler response.
// Project.configurationAst2JSON keys by user-defined name; PORT is a property.
function robot(family = 'RobotRcj') {
    const type = family==='RobotRcx'?types.rcx:family==='RobotRcj'?types.rcj:class e {};
    return Object.assign(new type(),{configuration:{SENSORS:{}},chassis:{geom:{x:-32,y:-18,w:46,h:36},frontLeft:{x:25,y:-22.5},frontRight:{x:25,y:22.5},backLeft:{x:-32,y:-18},backRight:{x:-32,y:18}}});
}
const classNames = {TOUCH:'TouchSensor',LIGHT:'LightSensor',COLOUR:'ColorSensorHex',ULTRASONIC:'UltrasonicSensor',INDUCTIVE:'InductiveSensor'};
function add(r, key, type, pose = {}, hardwarePort) {
    r.configuration.SENSORS[key] = {TYPE:type};
    if(hardwarePort !== undefined) r.configuration.SENSORS[key].PORT=hardwarePort;
    r[key]=Object.assign(new types.sensors[classNames[type]](),{port:key,x:15,y:0,theta:0,...pose});
    return r;
}
let r=robot('RobotRcx');
assert.deepEqual(describe(r),[]);
add(r,'1','TOUCH',{x:25,position:'front',theta:undefined});add(r,'2','LIGHT');
const before=JSON.stringify(r);
assert.deepEqual(describe(r).map(s=>s.type),['TOUCH','LIGHT']);
assert.equal(describe(r)[0].side,'front');
assert.equal(describe(r)[0].hardwarePort,null,'No invented physical port');
assert.equal(JSON.stringify(r),before);
const rcxTouch=robot('RobotRcx');
add(rcxTouch,'S1','TOUCH',{x:25,y:-6,position:'front'});add(rcxTouch,'S2','TOUCH',{x:25,y:6,position:'front'});
assert.deepEqual(describe(rcxTouch).map(sensor=>sensor.mountY),[-6,6],'RCX touch visuals retain independent display positions on the same front edge');
add(r,'3','ULTRASONIC'); assert.equal(describe(r).length,2,'RCX has no ultrasonic visual');
delete r.configuration.SENSORS['1'];assert.equal(describe(r).length,1,'Removed config hides stale sensor');
r.configuration.SENSORS['2'].TYPE='TOUCH';assert.equal(describe(r).length,0,'Type mismatch skipped');
r=robot();add(r,'Distance','ULTRASONIC',{x:25},'D');
assert.equal(describe(r)[0].configurationKey,'Distance');assert.equal(describe(r)[0].hardwarePort,'D');
assert.equal(describe(r)[0].simulationPort,'Distance');
const mountable=robot();add(mountable,'U','ULTRASONIC',{x:25,y:0,theta:0});
const originalSensor=JSON.stringify(mountable.U), originalDescriptors=describe(mountable);
const moved=api.applyMounts(mountable,originalDescriptors,{[originalDescriptors[0].id]:'right'});
assert.deepEqual([moved[0].mountX,moved[0].mountY,moved[0].theta,moved[0].mountPosition],[ 10,18,Math.PI/2,'right' ]);
assert.equal(JSON.stringify(mountable.U),originalSensor,'Moving a visual mount never changes the sensor instance');
assert.deepEqual([originalDescriptors[0].mountX,originalDescriptors[0].mountY,originalDescriptors[0].theta],[25,0,0],'Base descriptor remains unchanged');
assert.equal(api.applyMounts(mountable,originalDescriptors,{[originalDescriptors[0].id]:'invalid'})[0],originalDescriptors[0],'Unknown saved positions fail closed');
for(const position of ['front','right','back','left','up','down']) {
    const placed=api.applyMounts(mountable,originalDescriptors,{[originalDescriptors[0].id]:position})[0];
    assert.equal(placed.mountPosition,position);
    assert.ok(Number.isFinite(placed.mountX)&&Number.isFinite(placed.mountY)&&Number.isFinite(placed.mountHeight)&&Number.isFinite(placed.mountPitch));
}
for(const position of ['right','left']) {
    const placed=api.applyMounts(mountable,originalDescriptors,{[originalDescriptors[0].id]:position})[0];
    assert.equal(placed.mountHeight,2.1,'RCJ lateral sensors clear the larger wheel envelope');
    assert.equal(placed.mountX,10,'RCJ lateral sensor pod sits ahead of the side wheel');
}
const rcxMountable=robot('RobotRcx');add(rcxMountable,'1','LIGHT');
const rcxDescriptor=describe(rcxMountable)[0];
assert.equal(api.applyMounts(rcxMountable,[rcxDescriptor],{[rcxDescriptor.id]:'right'})[0].mountHeight,1.65,'RCX retains the accepted side mounting height');
assert.equal(api.applyMounts(rcxMountable,[rcxDescriptor],{[rcxDescriptor.id]:'right'})[0].mountX,-9,'RCX retains the accepted side mounting location');
const originalId=describe(r)[0].id;r.configuration.SENSORS.Distance.PORT='C';
assert.equal(describe(r)[0].hardwarePort,'C');assert.equal(describe(r)[0].id,originalId);
add(r,'Rear','TOUCH',{x:-25,position:'back',theta:undefined},'E');
add(r,'Ground','COLOUR',{},'B');add(r,'Metal','INDUCTIVE',{theta:undefined},'F');
assert.equal(describe(r).length,4);assert.equal(describe(r).find(s=>s.type==='TOUCH').theta,Math.PI);
assert.equal(describe(r).find(s=>s.type==='TOUCH').x,-25,'Nominal sensor pose is preserved');
assert.equal(describe(r).find(s=>s.type==='TOUCH').mountX,-32,'Drawing follows the real contact edge');
assert.equal(describe(r).find(s=>s.type==='INDUCTIVE').theta,0);
r.configuration.SENSORS.Ground.TYPE='COLOR';
assert.equal(describe(r).find(s=>s.type==='COLOUR').configurationKey,'Ground','Server COLOR spelling normalized for an existing colour sensor');
delete r.Ground;
assert.ok(!describe(r).some(s=>s.type==='COLOUR'),'Never invent a missing runtime colour sensor');
// Runtime poses are authoritative, including 1/2/3/4 differently aimed sensors.
for(let count=1;count<=4;count++) {
    const multi=robot();
    for(let i=0;i<count;i++) add(multi,'U'+i,'ULTRASONIC',{x:i-2,y:i*7,theta:i*Math.PI/4});
    assert.equal(describe(multi).length,count);
    describe(multi).forEach((s,i)=>assert.deepEqual([s.x,s.y,s.theta],[i-2,i*7,i*Math.PI/4]));
}
const same=robot();add(same,'T1','TOUCH',{position:'back'});add(same,'T2','TOUCH',{position:'back'});
assert.notEqual(describe(same)[0].id,describe(same)[1].id);
same.chassis.backLeft.x=NaN;assert.deepEqual(describe(same),[],'Invalid touch anchor fails closed');
for(const family of ['RobotCozmo','RobotEdison','RobotApitor','constructor','Unknown']) {
    assert.deepEqual(describe(add(robot(family),'1','LIGHT')),[]);
}
for(const bad of [NaN,Infinity,'15',null,10001]) {
    assert.deepEqual(describe(add(robot(),'U','ULTRASONIC',{x:bad})),[]);
}
for(const bad of [null,{}, {configuration:{SENSORS:[]}},undefined]) assert.deepEqual(describe(bad),[]);
const absent=robot();absent.configuration.SENSORS.U={TYPE:'ULTRASONIC'};assert.deepEqual(describe(absent),[]);
assert.deepEqual(api.describe(r),[],'Missing class registry fails closed');
const impostor={constructor:{name:'RobotRcx'},configuration:{SENSORS:{}}};
assert.deepEqual(describe(impostor),[],'Names alone do not establish robot type');
const wrongClass=add(robot(),'U','ULTRASONIC');Object.setPrototypeOf(wrongClass.U,types.sensors.TouchSensor.prototype);
assert.deepEqual(describe(wrongClass),[],'Wrong sensor instance rejected');
const invalid=add(robot(),'U','ULTRASONIC');invalid.U.port='V';assert.deepEqual(describe(invalid),[]);
invalid.U.port='U';invalid.U.theta=NaN;assert.deepEqual(describe(invalid),[]);
const frozen=add(robot('RobotRcx'),'1','LIGHT');
Object.freeze(frozen['1']);Object.freeze(frozen.configuration.SENSORS['1']);Object.freeze(frozen.configuration.SENSORS);Object.freeze(frozen.configuration);Object.freeze(frozen);
assert.equal(describe(frozen).length,1);
assert.throws(()=>{describe(frozen)[0].x=100;},TypeError);
const hostile=robot();hostile.configuration.SENSORS=JSON.parse('{"__proto__":{"TYPE":"LIGHT"},"constructor":{"TYPE":"LIGHT"}}');
assert.deepEqual(describe(hostile),[]);assert.equal({}.TYPE,undefined);
for(const tree of ['application','OpenRobertaServer']) {
    const html=fs.readFileSync(path.join(root,tree,'staticResources/index.html'),'utf8');
    for(const script of ['robot.sensor.visuals.js','robot.sensor.geometry.js','robot.sensor.mounts.js']) assert.ok(html.indexOf(script)>0 && html.indexOf(script)<html.indexOf('simulation3d.adapter.js'),'Sensor helpers load before adapter');
}
console.log('PASS sensor descriptors: allowlists, type/port/pose, additions/removals, multiple sensors, invalid input, unchanged/frozen state, resource parity and isolation.');
