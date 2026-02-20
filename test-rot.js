const THREE = require('three');

let yaw = Math.PI;
let slopeAngle = Math.atan2(2.2, 6); // ~20 deg
let pitch = -Math.PI / 2 + slopeAngle;

let euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
let v = new THREE.Vector3(0, 3, 0); // Top edge of plane (y=hyp/2=3)

v.applyEuler(euler);
console.log("Top edge goes to:", v);

let v2 = new THREE.Vector3(0, -3, 0); // Bottom edge of plane
v2.applyEuler(euler);
console.log("Bottom edge goes to:", v2);
