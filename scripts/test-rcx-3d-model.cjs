// Real Three.js geometry and adapter lifecycle; no DOM renderer or hardware.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = 'staticResources/js/app/simulation/simulationLogic/';
const THREE = require(path.join(root, 'application/staticResources/libs/three.min.js'));
for (const name of ['robot.rcx.visual.js', 'robot.apitor.visual.js', 'robot.edison.visual.js', 'simulation3d.adapter.js']) {
    assert.equal(fs.readFileSync(path.join(root,'OpenRobertaServer',base,name),'utf8'),fs.readFileSync(path.join(root,'application',base,name),'utf8'));
}
const window = {addEventListener(){}};
const document = {addEventListener(){},getElementById(){return {classList:{contains(name){return name==='typcn-cozmo';}}};}};
const context = vm.createContext({window,document,THREE,Set,console});
vm.runInContext(fs.readFileSync(path.join(root,'application',base,'robot.rcx.visual.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'application',base,'robot.apitor.visual.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'application',base,'robot.edison.visual.js'),'utf8'),context);
let source=fs.readFileSync(path.join(root,'application',base,'simulation3d.adapter.js'),'utf8');
assert.ok(source.includes('    window.CodeOnSim3D = {'));
source=source.replace('    window.CodeOnSim3D = {',`    window.test = {
    init: function(){ scene = new THREE.Scene(); }, ensure: ensureRobotModel,
    mesh: function(){return robotMesh;}, cube: function(){return cozmoCube;},
    wheels: updateWheelAnimation, lift: syncCozmoLift,
    placeCube: function(){robotMesh.updateMatrixWorld(true);cozmoCube.position.copy(new THREE.Vector3(0,0,-1.78).applyMatrix4(robotMesh.userData.cozmoLift.matrixWorld));cozmoCubePlaced=true;}
    };
    window.CodeOnSim3D = {`);
vm.runInContext(source,context);const t=window.test;t.init();
function robot(name){return {constructor:{name},chassis:{TRACKWIDTH:45,liftPosition:0},pose:{x:0,y:0,theta:0}};}
const rcx=robot('RobotRcx'); t.ensure(rcx);let mesh=t.mesh();
assert.equal(window.CodeOnSim3D.getDebugState().robotModel,'rcx','actual robot overrides stale Cozmo DOM icon');
const box=new THREE.Box3().setFromObject(mesh);
assert.ok(Math.abs(box.getSize(new THREE.Vector3()).x-3.3)<1e-6);
assert.ok(box.min.y>=-1e-6);
assert.ok(-box.min.z<=mesh.userData.frontExtent+1e-6);
assert.ok(!mesh.getObjectByName('cozmoLift') && !mesh.getObjectByName('touchBumper'));
t.wheels(rcx,1,1);rcx.pose.x=10;t.wheels(rcx,1,1);
assert.ok(mesh.userData.leftWheel.rotation.x<0);assert.equal(mesh.userData.leftWheel.rotation.x,mesh.userData.rightWheel.rotation.x);
// The bottom tire surface must move towards local +Z, opposite forward (-Z).
const contact=new THREE.Vector3(0,-1,0).applyAxisAngle(new THREE.Vector3(1,0,0),mesh.userData.wheelRotationSign*.01);
assert.ok(contact.z>0,'rolling contact opposes forward travel');
const before=JSON.stringify(rcx);t.wheels(rcx,1,1);assert.equal(JSON.stringify(rcx),before);
const oldLeft=mesh.userData.leftWheel.rotation.x;rcx.pose.theta=.3;t.wheels(rcx,1,1);
assert.ok(mesh.userData.leftWheel.rotation.x>oldLeft);
assert.ok(mesh.userData.rightWheel.rotation.x<oldLeft);
t.ensure(rcx);assert.equal(t.mesh(),mesh,'same model is preserved on restart');
for(const name of ['RobotCozmo','RobotRcx','RobotApitor','RobotEdison','RobotRcj','RobotRcx','RobotCozmo']){
    const r=robot(name);t.ensure(r);const debug=window.CodeOnSim3D.getDebugState();
    assert.equal(debug.robotModel,name==='RobotCozmo'?'cozmo':name==='RobotRcx'?'rcx':name==='RobotApitor'?'apitor':name==='RobotEdison'?'edison':'generic');
    assert.equal(debug.cozmoCubePresent,name==='RobotCozmo');
    assert.equal(t.mesh().userData.isCozmo===true,name==='RobotCozmo');
}
const cozmo=robot('RobotCozmo');cozmo.chassis.liftPosition=.4;t.placeCube();t.lift(cozmo);
assert.equal(window.CodeOnSim3D.getDebugState().cozmoCubeHeld,true);
const held=t.cube();const oldPos=held.getWorldPosition(new THREE.Vector3());t.mesh().position.x+=2;t.mesh().updateMatrixWorld(true);
assert.ok(Math.abs(held.getWorldPosition(new THREE.Vector3()).x-oldPos.x-2)<1e-6);
t.ensure(cozmo);assert.equal(t.cube(),held,'same Cozmo model keeps held object across restart');
cozmo.chassis.liftPosition=0;t.lift(cozmo);assert.equal(window.CodeOnSim3D.getDebugState().cozmoCubeHeld,false);
cozmo.chassis.liftPosition=.4;t.placeCube();t.lift(cozmo);
let disposed=0;held.geometry.addEventListener('dispose',()=>disposed++);t.ensure(rcx);
assert.equal(disposed,1,'held cube disposed exactly once');assert.equal(t.cube(),null);
console.log('PASS RCX geometry/footprint/wheels, stale icon, all model transitions, Cozmo pickup/transport/release/restart/disposal.');
const apitor=robot('RobotApitor');t.ensure(apitor);const apitorMesh=t.mesh();
const apitorBox=new THREE.Box3().setFromObject(apitorMesh);
assert.ok(Math.abs(apitorBox.getSize(new THREE.Vector3()).x-3.3)<1e-6);
assert.ok(apitorBox.min.y>=-1e-6);
assert.ok(-apitorBox.min.z<=apitorMesh.userData.frontExtent+1e-6);
for(const absent of ['cozmoLift','touchBumper','lightSensorLens','robotDisplay']) assert.ok(!apitorMesh.getObjectByName(absent));
t.wheels(apitor,1,1);apitor.pose.x=10;t.wheels(apitor,1,1);
assert.ok(apitorMesh.userData.leftWheel.rotation.x<0);
assert.equal(apitorMesh.userData.leftWheel.rotation.x,apitorMesh.userData.rightWheel.rotation.x);
const angle=apitorMesh.userData.leftWheel.rotation.x;apitor.pose.x=0;t.wheels(apitor,1,1);
assert.ok(apitorMesh.userData.leftWheel.rotation.x>angle,'reverse travel reverses wheels');
const snapshot=JSON.stringify(apitor);t.ensure(apitor);assert.equal(t.mesh(),apitorMesh);assert.equal(JSON.stringify(apitor),snapshot);
console.log('PASS Apitor footprint, no invented sensors/display/gripper, wheel directions, restart state.');
const edison=robot('RobotEdison');t.ensure(edison);const em=t.mesh(),eb=new THREE.Box3().setFromObject(em);
assert.ok(Math.abs(eb.getSize(new THREE.Vector3()).x-3.3)<1e-6);
assert.ok(eb.min.y>=-1e-6 && -eb.min.z<=em.userData.frontExtent+1e-6);
for(const part of ['clearCover','mountingStud','playButton','stopButton','recordButton']) assert.ok(em.getObjectByName(part));
for(const part of ['cozmoLift','touchBumper','lightSensorLens','robotDisplay']) assert.ok(!em.getObjectByName(part));
t.wheels(edison,1,1);edison.pose.x=10;t.wheels(edison,1,1);
assert.ok(em.userData.leftWheel.rotation.x<0 && em.userData.leftWheel.rotation.x===em.userData.rightWheel.rotation.x);
const ea=em.userData.leftWheel.rotation.x;edison.pose.x=0;t.wheels(edison,1,1);
assert.ok(em.userData.leftWheel.rotation.x>ea);
const es=JSON.stringify(edison);t.ensure(edison);assert.equal(t.mesh(),em);assert.equal(JSON.stringify(edison),es);
console.log('PASS Edison geometry, controls, wheel directions, no invented gripper/display, unchanged state.');
