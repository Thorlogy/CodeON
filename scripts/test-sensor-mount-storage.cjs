'use strict';
const assert = require('node:assert/strict');
const mounts = require('../OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.sensor.mounts.js');
function memoryStorage(seed) {
    const values = new Map(seed ? [[mounts.STORAGE_KEY, seed]] : []);
    return { getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),value:()=>values.get(mounts.STORAGE_KEY) };
}
const rcx=[
    {id:'["rcx","S1","TOUCH"]',family:'rcx',type:'TOUCH',configurationKey:'S1'},
    {id:'["rcx","S2","LIGHT"]',family:'rcx',type:'LIGHT',configurationKey:'S2'}
];
const rcj=[{id:'["rcj","C","ULTRASONIC"]',family:'rcj',type:'ULTRASONIC',configurationKey:'C'}];
const storage=memoryStorage();
assert.deepEqual(Object.keys(mounts.read(storage,'rcx',rcx)),[]);
assert.equal(mounts.write(storage,'rcx',rcx[0].id,'left',rcx),true);
assert.equal(mounts.read(storage,'rcx',rcx)[rcx[0].id],'left');
assert.deepEqual(Object.keys(mounts.read(storage,'rcj',rcj)),[]);
assert.equal(mounts.write(storage,'rcx',rcx[1].id,'up',rcx),true);
assert.equal(mounts.read(storage,'rcx',rcx)[rcx[1].id],'up');
assert.equal(mounts.resetSensor(storage,'rcx',rcx[0].id,rcx),true);
assert.equal(mounts.read(storage,'rcx',rcx)[rcx[0].id],undefined);
assert.equal(mounts.read(storage,'rcx',rcx)[rcx[1].id],'up','Resetting one sensor preserves its peers');
assert.equal(mounts.write(storage,'rcx',rcx[0].id,'left',rcx),true);
assert.equal(mounts.write(storage,'rcx','unconfigured','front',rcx),false);
assert.equal(mounts.write(storage,'cozmo',rcx[0].id,'front',rcx),false);
assert.equal(mounts.write(storage,'rcx',rcx[0].id,'diagonal',rcx),false);
assert.equal(mounts.write(storage,'rcx',rcx[0].id,'front',rcj),false);
assert.notEqual(mounts.configurationId('rcx',rcx),mounts.configurationId('rcx',[rcx[0]]));
assert.equal(mounts.clear(storage,'rcx',[rcx[0]]),true);
assert.equal(mounts.read(storage,'rcx',rcx)[rcx[0].id],'left');
assert.equal(mounts.clear(storage,'rcx',rcx),true);
assert.deepEqual(Object.keys(mounts.read(storage,'rcx',rcx)),[]);
assert.equal(storage.value(),undefined);
assert.deepEqual(Object.keys(mounts.read(memoryStorage('{not-json'),'rcx',rcx)),[]);
assert.deepEqual(Object.keys(mounts.read(memoryStorage(JSON.stringify({version:99,configurations:{}})),'rcx',rcx)),[]);
const immutable=Object.freeze(rcx.map(Object.freeze));
assert.equal(mounts.write(storage,'rcx',immutable[0].id,'down',immutable),true);
assert.equal(immutable[0].id,'["rcx","S1","TOUCH"]');
console.log('PASS local sensor mount storage: scoped by robot/config, allowlisted positions, malformed data, clear, immutable inputs.');
