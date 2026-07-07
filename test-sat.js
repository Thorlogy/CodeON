const obstacles = [
    { minX: -2.25, maxX: 2.25, minZ: -2, maxZ: -1.7999999999999998, maxY: 2.2, _rampOwner: {} }
];

const ROBOT_HW = 0.6; // half-width
const ROBOT_HD = 0.75; // half-depth

function testCollide(x, z, testTheta) {
    var cosT = Math.cos(testTheta);
    var sinT = Math.sin(testTheta);
    var ux = cosT, uz = -sinT;
    var vx = sinT, vz = cosT;

    var absUx = Math.abs(ux), absUz = Math.abs(uz);
    var absVx = Math.abs(vx), absVz = Math.abs(vz);

    for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        var ocx = (o.minX + o.maxX) / 2;
        var ocz = (o.minZ + o.maxZ) / 2;
        var ohw = (o.maxX - o.minX) / 2;
        var ohd = (o.maxZ - o.minZ) / 2;

        var tx = ocx - x;
        var tz = ocz - z;

        var ax1 = Math.abs(tx) > ohw + ROBOT_HW * absUx + ROBOT_HD * absVx;
        var ax2 = Math.abs(tz) > ohd + ROBOT_HW * absUz + ROBOT_HD * absVz;
        var ax3 = Math.abs(tx * ux + tz * uz) > ROBOT_HW + ohw * absUx + ohd * absUz;
        var ax4 = Math.abs(tx * vx + tz * vz) > ROBOT_HD + ohw * absVx + ohd * absVz;

        console.log("x:", x, "z:", z, "tx:", tx.toFixed(2), "tz:", tz.toFixed(2));
        console.log("ax1:", ax1, "| ax2:", ax2, "| ax3:", ax3, "| ax4:", ax4);

        if (ax1 || ax2 || ax3 || ax4) {
            console.log("Separated!");
        } else {
            console.log("COLLIDED!");
        }
    }
}

testCollide(0, -0.5, 0); // Robot going straight at theta=0
testCollide(0, -0.9, 0);
testCollide(0, -1.0, 0);
testCollide(0, -1.1, 0);
testCollide(0, -1.5, 0);
testCollide(0, -2.5, 0);
