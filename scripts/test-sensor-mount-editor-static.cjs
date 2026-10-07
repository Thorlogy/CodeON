'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const tree of ['OpenRobertaServer','application']){
    const html=fs.readFileSync(path.join(root,tree,'staticResources/index.html'),'utf8');
    assert.match(html,/<button[^>]*hidden[^>]*id='simSensorMounts'/);
    assert.match(html,/#simSensorMounts\s*\{\s*vertical-align:\s*top;/);
    assert.ok(html.indexOf('robot.sensor.mounts.js')<html.indexOf('simulation3d.adapter.js'));
    assert.match(html,/robot\.sensor\.mounts\.js\?v=codeon-sensor-mounts-4/);
    const module=fs.readFileSync(path.join(root,tree,'staticResources/js/app/simulation/simulationLogic/robot.sensor.mounts.js'),'utf8');
    assert.match(module,/FAMILIES = \['rcx', 'rcj'\]/);
    assert.match(module,/Saved only in this browser|Speicherung nur in diesem Browser/);
    assert.match(module,/Measurements, detection and robot configuration stay unchanged|Messwerte, Erkennung und Roboterkonfiguration bleiben unverändert/);
    assert.match(module,/setSensorMount\(selected, positionSelect\.value \|\| 'default'\)/);
    assert.match(module,/aria-live/);
    assert.match(module,/button\.style\.fontSize = '12px'/);
    assert.match(module,/button\.style\.minWidth = '76px'/);
}
const adapter=fs.readFileSync(path.join(root,'OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js'),'utf8');
assert.match(adapter,/CodeOnSensorVisuals\.applyMounts/);
assert.match(adapter,/CodeOnSensorMounts\.write/);
const geometry=fs.readFileSync(path.join(root,'OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.sensor.geometry.js'),'utf8');
assert.match(geometry,/mountPitch/);
console.log('PASS sensor mount editor static contract: RCX/RCJ only, browser-local, accessible, visual-only, packaged resources wired.');
