// Real Three.js geometry and adapter lifecycle; no DOM renderer or hardware.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = 'staticResources/js/app/simulation/simulationLogic/';
const THREE = require(path.join(root, 'application/staticResources/libs/three.min.js'));
for (const name of ['robot.rcx.visual.js', 'simulation3d.adapter.js']) {
    assert.equal(fs.readFileSync(path.join(root,'OpenRobertaServer',base,name),'utf8'),fs.readFileSync(path.join(root,'application',base,name),'utf8'));
}
const window = {addEventListener(){}};
const document = {addEventListener(){},getElementById(){return {classList:{contains(name){return name==='typcn-cozmo';}}};}};
const context = vm.createContext({window,document,THREE,Set,console});
vm.runInContext(fs.readFileSync(path.join(root,'application',base,'robot.rcx.visual.js'),'utf8'),context);
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
    assert.equal(debug.robotModel,name==='RobotCozmo'?'cozmo':name==='RobotRcx'?'rcx':'generic');
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
