import math

obstacles = [
    {"minX": -2.25, "maxX": 2.25, "minZ": -2, "maxZ": -1.8, "maxY": 2.2}
]

ROBOT_HW = 1.35
ROBOT_HD = 1.8

def test_collide(x, z, testTheta):
    cosT = math.cos(testTheta)
    sinT = math.sin(testTheta)
    ux, uz = cosT, -sinT
    vx, vz = sinT, cosT

    absUx, absUz = abs(ux), abs(uz)
    absVx, absVz = abs(vx), abs(vz)

    for o in obstacles:
        ocx = (o["minX"] + o["maxX"]) / 2
        ocz = (o["minZ"] + o["maxZ"]) / 2
        ohw = (o["maxX"] - o["minX"]) / 2
        ohd = (o["maxZ"] - o["minZ"]) / 2

        tx = ocx - x
        tz = ocz - z

        ax1 = abs(tx) > ohw + ROBOT_HW * absUx + ROBOT_HD * absVx
        ax2 = abs(tz) > ohd + ROBOT_HW * absUz + ROBOT_HD * absVz
        ax3 = abs(tx * ux + tz * uz) > ROBOT_HW + ohw * absUx + ohd * absUz
        ax4 = abs(tx * vx + tz * vz) > ROBOT_HD + ohw * absVx + ohd * absVz
        
        print(f"x: {x} z: {z} tx: {tx:.2f} tz: {tz:.2f}")
        print(f"ax1: {ax1} | ax2: {ax2} | ax3: {ax3} | ax4: {ax4}")

        if ax1 or ax2 or ax3 or ax4:
            print("Separated!")
        else:
            print("COLLIDED!")

test_collide(0, -0.5, 0)
test_collide(0, -0.9, 0)
test_collide(0, -1.0, 0)
test_collide(0, -1.5, 0)
test_collide(0, -2.5, 0)
