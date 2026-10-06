'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const relative='js/app/simulation/simulationLogic/robot.sensor.geometry.js';
assert.equal(fs.readFileSync(path.join(base,'application/staticResources',relative),'utf8'),fs.readFileSync(path.join(base,'OpenRobertaServer/staticResources',relative),'utf8'));
const THREE=require('../application/staticResources/libs/three.min.js');
const geometry=require('../application/staticResources/js/app/simulation/simulationLogic/robot.sensor.geometry.js');
const sensor=(id,type,x,y,theta=0,side)=>Object.freeze({id,type,x,y,mountX:x,mountY:y,theta,side});
const descriptors=Object.freeze([
    sensor('a','TOUCH',25,0,0,'front'),sensor('b','TOUCH',25,0,0,'front'),
    Object.freeze({...sensor('c','TOUCH',-25,0,Math.PI,'back'),mountX:-32}),sensor('d','LIGHT',9,2),
    sensor('e','COLOUR',9,-2),sensor('f','ULTRASONIC',14,0,Math.PI/2),sensor('g','INDUCTIVE',14,0),
    Object.freeze({...sensor('h','TOUCH',25,-6,0,'front'),mountY:-6}),Object.freeze({...sensor('i','TOUCH',25,6,0,'front'),mountY:6})
]);
const before=JSON.stringify(descriptors),parent=new THREE.Group();
assert.deepEqual(geometry.update(THREE,parent,descriptors,0),{count:9,groups:8,revision:1});
const group=parent.children[0];
assert.deepEqual(group.children[0].userData.sensorIds,['a','b']);
assert.deepEqual(group.children.filter(child=>child.userData.type==='TOUCH').map(child=>child.userData.sensorIds.length),[2,1,1,1]);
assert.ok(group.children[2].rotation.y===0);
assert.deepEqual(geometry.update(THREE,parent,descriptors,2),{count:9,groups:8,revision:1});
assert.equal(parent.children[0],group,'reuse unchanged geometry');
assert.equal(group.position.z,-2,'offset can change without rebuilding');
assert.equal(JSON.stringify(descriptors),before);
// Match 2D coordinates after adapter scale, heading and chassis correction.
for(const heading of [0,Math.PI/2,-1.13])for(const scale of [.04,.1])for(const correction of [0,.3]){
    const visualScale=45*scale/3.3;
    parent.scale.setScalar(visualScale);parent.rotation.y=-heading-Math.PI/2;
    parent.position.set(12-Math.cos(heading)*correction,0,7-Math.sin(heading)*correction);
    geometry.update(THREE,parent,descriptors,correction/visualScale);parent.updateMatrixWorld(true);
    for(const child of group.children){
        const d=descriptors.find(d=>d.id===child.userData.sensorIds[0]);
        const pos=child.getWorldPosition(new THREE.Vector3());
        assert.ok(Math.abs(pos.x-(12+(d.mountX*Math.cos(heading)-d.mountY*Math.sin(heading))*scale))<1e-9);
        assert.ok(Math.abs(pos.z-(7+(d.mountX*Math.sin(heading)+d.mountY*Math.cos(heading))*scale))<1e-9);
        const forward=new THREE.Vector3(0,0,-1).transformDirection(child.matrixWorld);
        assert.ok(Math.abs(forward.x-Math.cos(heading+d.theta))<1e-9);
        assert.ok(Math.abs(forward.z-Math.sin(heading+d.theta))<1e-9);
    }
}
const disposed=new Map();
group.traverse(node=>{for(const value of [node.geometry,node.material])if(value&&!disposed.has(value)){
    disposed.set(value,0);value.addEventListener('dispose',()=>disposed.set(value,disposed.get(value)+1));
}});
assert.deepEqual(geometry.update(THREE,parent,[descriptors[3]],0),{count:1,groups:1,revision:2});
assert.equal(group.parent,null);assert.ok([...disposed.values()].every(n=>n===1),'dispose shared resources exactly once');
const replacement=parent.children[0];
assert.deepEqual(geometry.update(THREE,parent,[],0),{count:0,groups:0,revision:3});
assert.equal(replacement.parent,null);assert.equal(parent.children.length,0);
assert.deepEqual(geometry.update(THREE,parent,[],0),{count:0,groups:0,revision:3});
const chassis=new THREE.Group();parent.add(chassis);
geometry.update(THREE,parent,[sensor('same','LIGHT',1,2)],0);
assert.equal(geometry.update(THREE,parent,[sensor('same','LIGHT',2,2)],0).revision,5,'pose change rebuilds even with unchanged slot ID');
geometry.update(THREE,parent,[],0);
assert.deepEqual(parent.children,[chassis],'unrelated chassis is preserved');
const custom=[
    Object.freeze({...sensor('side','ULTRASONIC',25,0),mountPosition:'right',mountX:-9,mountY:18,mountHeight:1.65,mountPitch:0,theta:Math.PI/2}),
    Object.freeze({...sensor('up','LIGHT',9,0),mountPosition:'up',mountX:-9,mountY:0,mountHeight:1.35,mountPitch:Math.PI/2}),
    Object.freeze({...sensor('down','INDUCTIVE',9,0),mountPosition:'down',mountX:-9,mountY:0,mountHeight:.3,mountPitch:-Math.PI/2})
];
geometry.update(THREE,parent,custom,0);
const mounted=parent.children[1];
assert.deepEqual(mounted.children[0].children.map(child=>child.position.toArray()),[[0,-.03,-.32],[0,.15,-.62],[-.14,.15,-.875],[.14,.15,-.875]],'Side sensor uses an outboard bracket and pod above the wheel envelope');
assert.deepEqual(mounted.children[0].position.toArray(),[18*.07333333333333333,1.65,-(-9)*.07333333333333333]);
assert.deepEqual(mounted.children.slice(1).map(child=>child.position.toArray()),[[0,1.35,-(-9)*.07333333333333333],[0,.3,-(-9)*.07333333333333333]]);
assert.deepEqual(mounted.children.map(child=>child.rotation.toArray().slice(0,2).map(value=>Math.abs(value)<1e-12?0:value)),[[0,-Math.PI/2],[Math.PI/2,0],[-Math.PI/2,0]]);
assert.deepEqual(geometry.update(THREE,parent,[],0),{count:0,groups:0,revision:8});
console.log('PASS sensor geometry: transforms, grouped bumpers, reuse, replacement and disposal.');
