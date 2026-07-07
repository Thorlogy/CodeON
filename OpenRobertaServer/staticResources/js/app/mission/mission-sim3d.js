/**
 * mission-sim3d.js  –  v3: Differential-Drive + Cannon-es Physics
 * ──────────────────────────────────────────────────────────────────
 *
 * Physics model: Differential-Drive robot (like a real LEGO EV3)
 * Physics engine: Cannon-es (rigid body dynamics, collision solver)
 *
 *   Each frame (dt seconds):
 *     vL = ωL × WHEEL_RADIUS          (left wheel linear speed)
 *     vR = ωR × WHEEL_RADIUS          (right wheel linear speed)
 *     v     = (vL + vR) / 2           (robot center linear speed)
 *     omega = (vR - vL) / WHEEL_BASE  (angular rate, rad/s)
 *
 *   Robot body is a CANNON.BODY_TYPES.KINEMATIC body.
 *   We set its velocity each frame; Cannon resolves collisions.
 *   The Three.js mesh is then synced from the Cannon body position.
 *
 * API:
 *   MissionSim3D.init(containerId)
 *   MissionSim3D.reset()
 *   MissionSim3D.runCommands(cmds, onDone)
 *   MissionSim3D.stop()
 */
window.MissionSim3D = (function () {
    'use strict';

    // ── Scene state ─────────────────────────────────────────────────
    var scene, camera, renderer, robot, animId;
    var container;

    // Robot start pose
    var START_X = 0;
    var START_Z = 8;   // robot starts near bottom, facing -Z

    // ── Camera Orbit State ───────────────────────────────────────────
    var camAngleX = 0;              // Azimuth (around Y axis)
    var camAngleY = Math.PI / 3;    // Polar (angle from top, approx 60 deg)
    var camRadius = 24;             // Distance from target
    var isDragging = false;
    var lastMousePos = { x: 0, y: 0 };

    // Command queue
    var commandQueue = [];
    var onDoneCallback = null;
    var isRunning = false;

    // ── Scale ────────────────────────────────────────────────────────
    // 1 Three.js unit = 1/0.15 cm  →  1 cm = 0.15 units
    var UNIT = 0.15;

    // ── Robot Profiles ────────────────────────────────────────────────
    var DEG_TO_RAD = Math.PI / 180;
    var RAMP_TIME = 0.25;    // seconds to reach full speed (motor acceleration)
    var GROUND_FRICTION = 4.0; // deceleration factor (1/s)

    var ROBOT_PROFILES = {
        ev3: {
            id: 'ev3',
            name: '🤖 EV3 Driving Base',
            wheelRadius: 0.95,    // Three.js units (≈ 6.3 cm)
            wheelBase: 3.16,      // Three.js units (≈ 11.5 cm)
            halfWidth: 1.35,      // collision box half-width (X)
            halfDepth: 1.8,       // collision box half-depth (Z)
            maxRadPerSec: 5.5,    // rad/s at 100% speed
            trackHalfWidth: 1.58, // half track width for 3-point contact
            wheelZOffset: 0.1,    // drive wheels behind center
            frontContactZ: -1.4,  // front contact point Z
            ultrasonicY: 1.3,     // ultrasonic sensor height
            colorSensorZ: -1.3,   // color sensor Z offset
            buildFn: 'buildEV3Robot'
        },
        spike: {
            id: 'spike',
            name: '⚙️ Spike Prime',
            wheelRadius: 1.1,     // slightly larger wheels
            wheelBase: 3.0,       // narrower track
            halfWidth: 1.2,
            halfDepth: 1.6,
            maxRadPerSec: 5.0,
            trackHalfWidth: 1.45,
            wheelZOffset: 0.1,
            frontContactZ: -1.3,
            ultrasonicY: 1.2,
            colorSensorZ: -1.1,
            buildFn: 'buildSpikePrimeRobot'
        },
        custom: {
            id: 'custom',
            name: '📦 Custom Bot',
            wheelRadius: 0.8,
            wheelBase: 2.8,
            halfWidth: 1.1,
            halfDepth: 1.5,
            maxRadPerSec: 6.0,
            trackHalfWidth: 1.3,
            wheelZOffset: 0.1,
            frontContactZ: -1.4,
            ultrasonicY: 1.1,
            colorSensorZ: -1.0,
            buildFn: 'buildCustomBot'
        },
        mbot: {
            id: 'mbot',
            name: '🤖 mBot (Makeblock)',
            wheelRadius: 0.85,
            wheelBase: 2.6,
            halfWidth: 1.0,
            halfDepth: 1.4,
            maxRadPerSec: 6.5,
            trackHalfWidth: 1.25,
            wheelZOffset: 0.2,
            frontContactZ: -1.2,
            ultrasonicY: 1.2,
            colorSensorZ: -1.1,
            buildFn: 'buildMBotRobot'
        },
        edison: {
            id: 'edison',
            name: '🧱 Edison (Microbric)',
            wheelRadius: 0.45,
            wheelBase: 1.6,
            halfWidth: 0.65,
            halfDepth: 0.75,
            maxRadPerSec: 8.0,
            trackHalfWidth: 0.75,
            wheelZOffset: 0.05,
            frontContactZ: -0.6,
            ultrasonicY: 0.6,
            colorSensorZ: -0.5,
            buildFn: 'buildEdisonRobot'
        }
    };

    var activeProfile = ROBOT_PROFILES.ev3;

    // Convenience accessors (used throughout physics code)
    function WHEEL_RADIUS() { return activeProfile.wheelRadius; }
    function WHEEL_BASE() { return activeProfile.wheelBase; }
    function MAX_RAD_PER_SEC() { return activeProfile.maxRadPerSec; }
    function ROBOT_HW() { return activeProfile.halfWidth; }
    function ROBOT_HD() { return activeProfile.halfDepth; }

    // ── Robot dynamics state ─────────────────────────────────────────
    var robotState = {
        x: START_X, z: START_Z, theta: 0,   // pose (Three.js units + radians)
        omegaL: 0,               // left  wheel angular velocity (rad/s)
        omegaR: 0,               // right wheel angular velocity (rad/s)
        wheelPosL: 0,            // accumulated wheel angle for visual spin
        wheelPosR: 0,

        // Physics / Velocity state
        vx: 0,
        vy: 0,
        vz: 0,
        vw: 0,                   // angular velocity
        isFalling: false,

        sensors: { ultrasonic: 255, color: 'none', touch: false }
    };

    // ── Obstacles (legacy AABB – kept for Touch sensor lookahead) ──────
    var obstacles = [];
    var lastHitLocalX = 0; // Tracks the lateral offset of the last collision (for asymmetric torque)

    // ── Ramps ─────────────────────────────────────────────────────────
    // Each ramp: { x0,z0=foot,  x1,z1=top,  height, width, slopeAngle,
    //              dirX, dirZ,  len,  perpX, perpZ }
    var ramps = [];

    // Track dynamically added objects to clear them on reset
    var dynamicMeshes = [];

    // ════════════════════════════════════════════════════════════════
    // CANNON-ES PHYSICS
    // ════════════════════════════════════════════════════════════════
    var cannonWorld = null;     // CANNON.World
    var robotBody = null;       // CANNON.Body for the robot chassis
    var vehicle = null;         // CANNON.RaycastVehicle (used in Hard Mode)
    var staticBodies = [];      // CANNON.Body[] for obstacles, platforms, ramps

    // ════════════════════════════════════════════════════════════════
    // WORLD BUILDER STATE
    // ════════════════════════════════════════════════════════════════
    // Each entry: { mesh, type:'obstacle'|'ramp'|'target'|'robot',
    //               physicsData: (the obstacle/ramp record to update on drop) }
    var worldObjects = [];      // all draggable objects
    var raycaster = new THREE.Raycaster();
    var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0 plane
    var dragObject = null;      // currently dragged object record
    var dragOffset = new THREE.Vector3(); // mouse-to-object-center offset on XZ
    var isDraggingObject = false;


    // ════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ════════════════════════════════════════════════════════════════
    function init(containerId) {
        container = document.getElementById(containerId);
        if (!container) {
            console.error('[MissionSim3D] Container not found:', containerId);
            return;
        }

        var loadingMsg = document.getElementById('loading-msg');
        if (loadingMsg) loadingMsg.style.display = 'none';

        var W = container.clientWidth || 800;
        var H = container.clientHeight || 400;

        // ── Scene ──────────────────────────────────────────────────
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111827);
        scene.fog = new THREE.FogExp2(0x111827, 0.018);

        // ── Camera ─────────────────────────────────────────────────
        camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);

        // ── Custom Orbit & Drag Controls ──────────────────────────────
        container.addEventListener('mousedown', function (e) {
            // First: try to pick a world object (robot or placed objects)
            var rect = renderer.domElement.getBoundingClientRect();
            var mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera);

            // Collect all draggable meshes
            var draggables = [robot];
            for (var i = 0; i < worldObjects.length; i++) {
                draggables.push(worldObjects[i].mesh);
            }

            var intersects = raycaster.intersectObjects(draggables, true);
            if (intersects.length > 0) {
                // Find the worldObject record for the hit mesh (or its ancestor)
                var hitObject = intersects[0].object;
                var record = null;

                // Walk up to find if it's the robot group or a tracked object
                var cur = hitObject;
                while (cur) {
                    if (cur === robot) { record = { mesh: robot, type: 'robot' }; break; }
                    for (var j = 0; j < worldObjects.length; j++) {
                        if (cur === worldObjects[j].mesh) { record = worldObjects[j]; break; }
                    }
                    if (record) break;
                    cur = cur.parent;
                }

                if (record) {
                    isDraggingObject = true;
                    dragObject = record;
                    renderer.domElement.style.cursor = 'grabbing';
                    // Freeze the Cannon body while dragging the robot so physics doesn't fight the drag
                    if (record.type === 'robot' && robotBody) {
                        robotBody.type = CANNON.Body.STATIC;
                        robotBody.velocity.set(0, 0, 0);
                        robotBody.angularVelocity.set(0, 0, 0);
                        robotBody.sleep();
                    }
                    // Compute where on the ground plane the ray hits
                    var groundHit = new THREE.Vector3();
                    raycaster.ray.intersectPlane(groundPlane, groundHit);
                    dragOffset.set(
                        record.mesh.position.x - groundHit.x,
                        0,
                        record.mesh.position.z - groundHit.z
                    );
                    e.stopPropagation();
                    return;
                }
            }

            // No object hit – start orbit
            isDragging = true;
            renderer.domElement.style.cursor = 'default';
            lastMousePos = { x: e.clientX, y: e.clientY };
        });
        // Hover cursor: change to 'grab' when mouse is over a draggable object
        container.addEventListener('mousemove', function (e) {
            if (isDraggingObject || isDragging) return; // handled in window mousemove
            var rect = renderer.domElement.getBoundingClientRect();
            var mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera);
            var draggables = [robot];
            for (var i = 0; i < worldObjects.length; i++) draggables.push(worldObjects[i].mesh);
            var hits = raycaster.intersectObjects(draggables, true);
            renderer.domElement.style.cursor = hits.length > 0 ? 'grab' : 'default';
        });
        window.addEventListener('mousemove', function (e) {
            if (isDraggingObject && dragObject) {
                var rect = renderer.domElement.getBoundingClientRect();
                var mouse = new THREE.Vector2(
                    ((e.clientX - rect.left) / rect.width) * 2 - 1,
                    -((e.clientY - rect.top) / rect.height) * 2 + 1
                );
                raycaster.setFromCamera(mouse, camera);
                var groundHit = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(groundPlane, groundHit)) {
                    var newX = snapGrid(groundHit.x + dragOffset.x);
                    var newZ = snapGrid(groundHit.z + dragOffset.z);

                    // Overlap check for Ramps, Platforms and Robot
                    if (dragObject.type === 'ramp' || dragObject.type === 'platform' || dragObject.type === 'robot') {
                        var isColliding = function (px, pz) {
                            var fp = getFootprint(dragObject, px, pz);
                            if (!fp) return false;

                            // Build list of all solid objects - include robot only when we are NOT dragging it
                            var solidRecords = [];
                            if (dragObject.type !== 'robot') {
                                solidRecords.push({ type: 'robot', mesh: robot });
                            }
                            solidRecords = solidRecords.concat(worldObjects);

                            for (var i = 0; i < solidRecords.length; i++) {
                                var other = solidRecords[i];
                                // Skip self by mesh reference
                                if (other.mesh === dragObject.mesh) continue;
                                if (other.type !== 'ramp' && other.type !== 'platform' && other.type !== 'robot') continue;

                                var otherFp = getFootprint(other, other.mesh.position.x, other.mesh.position.z);
                                if (otherFp && checkOverlap(fp, otherFp)) {
                                    return true;
                                }
                            }
                            return false;
                        };

                        var curX = dragObject.mesh.position.x;
                        var curZ = dragObject.mesh.position.z;

                        if (!isColliding(newX, newZ)) {
                            dragObject.mesh.position.x = newX;
                            dragObject.mesh.position.z = newZ;
                        } else if (!isColliding(newX, curZ)) {
                            dragObject.mesh.position.x = newX;
                        } else if (!isColliding(curX, newZ)) {
                            dragObject.mesh.position.z = newZ;
                        }
                    } else {
                        dragObject.mesh.position.x = newX;
                        dragObject.mesh.position.z = newZ;
                    }
                }
                return;
            }
            if (!isDragging) return;
            var dx = e.clientX - lastMousePos.x;
            var dy = e.clientY - lastMousePos.y;
            lastMousePos = { x: e.clientX, y: e.clientY };

            camAngleX -= dx * 0.01;
            camAngleY -= dy * 0.01;

            // Limit polar angle from 0.1 (almost top-down) to PI/2 - 0.05 (almost horizontal)
            camAngleY = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, camAngleY));
        });
        window.addEventListener('mouseup', function () {
            if (isDraggingObject && dragObject) {
                // Sync physics data to new position
                var m = dragObject.mesh;
                if (dragObject.type === 'robot') {
                    START_X = m.position.x;
                    START_Z = m.position.z;
                    robotState.x = m.position.x;
                    robotState.z = m.position.z;

                    // Reset physics state so it doesn't snap back or fly away
                    robotState.vx = 0;
                    robotState.vz = 0;
                    robotState.vw = 0;
                    robotState.omegaL = 0;
                    robotState.omegaR = 0;

                    if (robotBody) {
                        // Restore to dynamic body so physics simulation works again
                        robotBody.type = CANNON.Body.DYNAMIC;
                        robotBody.position.set(robotState.x, 1.0, robotState.z);
                        robotBody.velocity.set(0, 0, 0);
                        robotBody.angularVelocity.set(0, 0, 0);
                        robotBody.force.set(0, 0, 0);
                        robotBody.torque.set(0, 0, 0);
                        robotBody.wakeUp(); // ensure the body processes the new position
                    }
                } else if (dragObject.type === 'platform') {
                    var m = dragObject.mesh;
                    var rmp = null;
                    ramps.forEach(function (r) {
                        if (r._platformOwner === dragObject) rmp = r;
                    });
                    if (rmp) {
                        var oldCx = (rmp.x0 + rmp.x1) / 2;
                        var oldCz = (rmp.z0 + rmp.z1) / 2;
                        var ddx = m.position.x - oldCx;
                        var ddz = m.position.z - oldCz;

                        obstacles.forEach(function (o) {
                            if (o._platformOwner === dragObject) {
                                o.minX += ddx; o.maxX += ddx;
                                o.minZ += ddz; o.maxZ += ddz;
                            }
                        });
                        rmp.x0 += ddx; rmp.x1 += ddx;
                        rmp.z0 += ddz; rmp.z1 += ddz;
                    }
                } else if (dragObject.type === 'ramp') {
                    var m = dragObject.mesh;
                    var pd = dragObject.physicsData;
                    var ddx = m.position.x - (pd.x0 + pd.x1) / 2;
                    var ddz = m.position.z - (pd.z0 + pd.z1) / 2;
                    pd.x0 += ddx; pd.x1 += ddx;
                    pd.z0 += ddz; pd.z1 += ddz;

                    obstacles.forEach(function (o) {
                        if (o._rampOwner === pd) {
                            o.minX += ddx; o.maxX += ddx;
                            o.minZ += ddz; o.maxZ += ddz;
                        }
                    });
                } else if (dragObject.type === 'obstacle' && dragObject.physicsData) {
                    var p = dragObject.physicsData;
                    var hw = (p.maxX - p.minX) / 2;
                    var hd = (p.maxZ - p.minZ) / 2;
                    p.minX = m.position.x - hw;
                    p.maxX = m.position.x + hw;
                    p.minZ = m.position.z - hd;
                    p.maxZ = m.position.z + hd;
                }
                isDraggingObject = false;
                dragObject = null;
                renderer.domElement.style.cursor = 'default';
                return;
            }
            isDragging = false;
        });


        container.addEventListener('wheel', function (e) {
            e.preventDefault();
            camRadius += e.deltaY * 0.05;
            camRadius = Math.max(8, Math.min(100, camRadius)); // limit zoom bounds
        }, { passive: false });

        // ── Renderer ───────────────────────────────────────────────
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
        initSensorHud();  // must be AFTER innerHTML='' so the HUD div isn't wiped

        // ── Lights ─────────────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));

        var sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
        sun.position.set(8, 20, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 100;
        sun.shadow.camera.left = -25;
        sun.shadow.camera.right = 25;
        sun.shadow.camera.top = 25;
        sun.shadow.camera.bottom = -25;
        scene.add(sun);

        var fill = new THREE.DirectionalLight(0xaaccff, 0.5);
        fill.position.set(-8, 8, -8);
        scene.add(fill);

        // ── Floor ──────────────────────────────────────────────────
        var floorGeo = new THREE.PlaneGeometry(90, 90);
        var floorMat = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });
        var floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // 90 units total / 20 divisions = 4.5 units per tile (30cm exactly)
        var grid = new THREE.GridHelper(90, 20, 0x000000, 0xdddddd);
        grid.position.y = 0.01;
        scene.add(grid);

        // ── Robot ──────────────────────────────────────────────────
        if (activeProfile.buildFn === 'buildSpikePrimeRobot') robot = buildSpikePrimeRobot();
        else if (activeProfile.buildFn === 'buildCustomBot') robot = buildCustomBot();
        else robot = buildEV3Robot();
        scene.add(robot);
        applyRobotPose();

        // ── Cannon-es Physics World ────────────────────────────────
        initPhysicsWorld();

        // ── World objects ──────────────────────────────────────────
        addTarget(0, -18, 0x22c55e);    // green ring further back

        // ── Render loop ────────────────────────────────────────────
        clock = new THREE.Clock();
        animate();

        window.addEventListener('resize', onResize);
        console.log('[MissionSim3D] Initialized (v3 Cannon-es Physics)');
    }


    // ════════════════════════════════════════════════════════════════
    // EV3 ROBOT MODEL
    // ════════════════════════════════════════════════════════════════
    function buildEV3Robot() {
        var group = new THREE.Group();

        var bodyMat = new THREE.MeshPhongMaterial({ color: 0x8a9bb5, shininess: 60 });
        var darkMat = new THREE.MeshPhongMaterial({ color: 0x1a2233, shininess: 30 });
        var redMat = new THREE.MeshPhongMaterial({ color: 0xdd2244 });
        var yellowMat = new THREE.MeshPhongMaterial({ color: 0xf5a623, emissive: 0xf5a623, emissiveIntensity: 0.3 });
        var screenMat = new THREE.MeshPhongMaterial({ color: 0x1155aa });

        // Body
        var body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 3.2), bodyMat);
        body.position.y = 1.05;
        body.castShadow = true;
        group.add(body);

        // Top panel
        var top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 3.0),
            new THREE.MeshPhongMaterial({ color: 0x2d3f5a }));
        top.position.y = 1.72;
        group.add(top);

        // Display (front = -Z)
        var screen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.12), screenMat);
        screen.position.set(0, 1.1, -1.62);
        group.add(screen);

        // LED
        var led = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), yellowMat);
        led.position.set(0.6, 1.65, -1.62);
        group.add(led);
        group.userData.led = led;

        // Wheels
        function makeWheel(side) {
            var tire = new THREE.Mesh(
                new THREE.CylinderGeometry(0.95, 0.95, 0.55, 16),
                darkMat);
            tire.rotation.z = Math.PI / 2;
            tire.position.set(side * 1.58, 0.95, 0.1);
            tire.castShadow = true;
            group.add(tire);
            var hub = new THREE.Mesh(
                new THREE.CylinderGeometry(0.45, 0.45, 0.58, 10),
                new THREE.MeshPhongMaterial({ color: 0xd0d8e8 }));
            hub.rotation.z = Math.PI / 2;
            hub.position.set(side * 1.59, 0.95, 0.1);
            group.add(hub);
            return tire;
        }
        group.userData.wheelL = makeWheel(-1);
        group.userData.wheelR = makeWheel(+1);

        // Rear caster
        var caster = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0xaabbcc }));
        caster.position.set(0, 0.28, 1.4);
        group.add(caster);

        // Red strip (front)
        var strip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.18), redMat);
        strip.position.set(0, 0.6, -1.62);
        group.add(strip);

        // ── Ultraschall-Sensor (front) ──────────────────────────────
        var usMat = new THREE.MeshPhongMaterial({ color: 0x9da8b5, shininess: 80 });
        var usBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.24), usMat);
        usBody.position.set(0, 1.3, -1.74);
        group.add(usBody);
        // Two "eyes" of the ultrasonic sensor
        var eyeMat = new THREE.MeshPhongMaterial({ color: 0x334466, emissive: 0x1122aa, emissiveIntensity: 0.5 });
        [-0.45, 0.45].forEach(function (ox) {
            var eye = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), eyeMat);
            eye.rotation.x = Math.PI / 2;
            eye.position.set(ox, 1.3, -1.87);
            group.add(eye);
        });

        // ── Farbsensor (bottom-front) ─────────────────────────────
        var csMat = new THREE.MeshPhongMaterial({ color: 0xdd2244, emissive: 0xdd0000, emissiveIntensity: 0.3 });
        var csBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.3, 10), csMat);
        csBody.position.set(0, 0.18, -1.3);
        group.add(csBody);

        return group;
    }

    // ════════════════════════════════════════════════════════════════
    // SPIKE PRIME ROBOT MODEL
    // ════════════════════════════════════════════════════════════════
    function buildSpikePrimeRobot() {
        var group = new THREE.Group();

        var bodyMat = new THREE.MeshPhongMaterial({ color: 0xf5f7fa, shininess: 30 }); // white Spike hub
        var accentMat = new THREE.MeshPhongMaterial({ color: 0xfde047 }); // yellow accent
        var darkMat = new THREE.MeshPhongMaterial({ color: 0x27272a, shininess: 20 }); // dark grey wheels
        var screenMat = new THREE.MeshPhongMaterial({ color: 0x18181b }); // LED matrix off

        // Main Hub (more cubic than EV3)
        var body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), bodyMat);
        body.position.set(0, 1.2, 0);
        body.castShadow = true;
        group.add(body);

        // Yellow accent strip
        var strip = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.4, 2.42), accentMat);
        strip.position.set(0, 0.8, 0);
        group.add(strip);

        // LED Matrix Screen (Top)
        var screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), screenMat);
        screen.rotation.x = -Math.PI / 2;
        screen.position.set(0, 2.01, 0);
        group.add(screen);

        // Single LED (Top corner)
        var led = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshPhongMaterial({ color: 0xfca5a5 }));
        led.position.set(0.9, 2.01, -0.9);
        group.add(led);
        group.userData.led = led;

        // Wheels (slightly larger, different hub)
        function makeWheel(side) {
            var wr = activeProfile.wheelRadius;
            var wDist = activeProfile.wheelBase / 2;

            var wheelGroup = new THREE.Group();
            wheelGroup.position.set(side * wDist, wr, 0.1);

            var tire = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.6, 16), darkMat);
            tire.rotation.z = Math.PI / 2;
            tire.castShadow = true;
            wheelGroup.add(tire);

            var hub = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.6, wr * 0.6, 0.62, 12), accentMat);
            hub.rotation.z = Math.PI / 2;
            wheelGroup.add(hub);

            group.add(wheelGroup);
            return wheelGroup;
        }
        group.userData.wheelL = makeWheel(-1);
        group.userData.wheelR = makeWheel(+1);

        // Rear / Front casters (Spike often uses ball casters front and back for stability)
        var casterGeo = new THREE.SphereGeometry(0.3, 8, 8);
        var casterMat = new THREE.MeshPhongMaterial({ color: 0xaabbcc });
        var rearCaster = new THREE.Mesh(casterGeo, casterMat);
        rearCaster.position.set(0, 0.3, 1.2);
        group.add(rearCaster);

        var frontCaster = new THREE.Mesh(casterGeo, casterMat);
        frontCaster.position.set(0, 0.3, -1.2);
        group.add(frontCaster);

        // Ultrasonic Sensor (distinctive "eyes")
        var usMat = new THREE.MeshPhongMaterial({ color: 0xe5e7eb });
        var usBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.4), usMat);
        usBody.position.set(0, activeProfile.ultrasonicY, -1.4);
        group.add(usBody);

        var eyeMat = new THREE.MeshPhongMaterial({ color: 0x1e3a8a, emissive: 0x1e3a8a, emissiveIntensity: 0.2 });
        [-0.4, 0.4].forEach(function (ox) {
            var eye = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16), eyeMat);
            eye.rotation.x = Math.PI / 2;
            eye.position.set(ox, activeProfile.ultrasonicY, -1.6);
            group.add(eye);
        });

        // Color Sensor (bottom-front)
        var csMat = new THREE.MeshPhongMaterial({ color: 0xe5e7eb });
        var csBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), csMat);
        csBody.position.set(0, 0.2, activeProfile.colorSensorZ);
        group.add(csBody);

        return group;
    }

    // ════════════════════════════════════════════════════════════════
    // CUSTOM / GENERIC ROBOT MODEL
    // ════════════════════════════════════════════════════════════════
    function buildCustomBot() {
        var group = new THREE.Group();

        var bodyMat = new THREE.MeshPhongMaterial({ color: 0x14b8a6, shininess: 50 }); // teal
        var darkMat = new THREE.MeshPhongMaterial({ color: 0x1c1917 });

        var hw = activeProfile.halfWidth;
        var hd = activeProfile.halfDepth;

        // Main Body matching exact collision bounds
        var body = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 1.2, hd * 2), bodyMat);
        body.position.set(0, 1.0, 0);
        body.castShadow = true;
        group.add(body);

        // Direction indicator (Arrow on top)
        var arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        var arrowGeo = new THREE.ConeGeometry(0.3, 0.8, 4); // 4-sided pyramid for cleaner look
        var arrow = new THREE.Mesh(arrowGeo, arrowMat);
        // Default points +Y. Rotate +PI/2 on X to face -Z (forward)
        arrow.rotation.x = Math.PI / 2;
        arrow.position.set(0, 1.61, -0.6);
        group.add(arrow);

        var led = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshPhongMaterial({ color: 0xef4444 }));
        led.position.set(0, 1.6, 0.6); // Rear
        group.add(led);
        group.userData.led = led;

        function makeWheel(side) {
            var wr = activeProfile.wheelRadius;
            var wDist = activeProfile.wheelBase / 2;

            var wheelGroup = new THREE.Group();
            wheelGroup.position.set(side * wDist, wr, activeProfile.wheelZOffset);

            var tire = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.4, 16), darkMat);
            tire.rotation.z = Math.PI / 2;
            tire.castShadow = true;
            wheelGroup.add(tire);

            group.add(wheelGroup);
            return wheelGroup;
        }
        group.userData.wheelL = makeWheel(-1);
        group.userData.wheelR = makeWheel(+1);

        // Simple caster
        var caster = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), darkMat);
        // Match frontContactZ (-1.4) so it looks like it's supporting the physics point
        caster.position.set(0, 0.3, activeProfile.frontContactZ);
        group.add(caster);

        return group;
    }

    // ════════════════════════════════════════════════════════════════
    // MBOT (MAKEBLOCK) MODEL
    // ════════════════════════════════════════════════════════════════
    function buildMBotRobot() {
        var group = new THREE.Group();

        var mbotBlue = new THREE.MeshPhongMaterial({ color: 0x3b82f6, shininess: 80 }); // bright blue
        var darkMat = new THREE.MeshPhongMaterial({ color: 0x1c1917 });
        var silverMat = new THREE.MeshPhongMaterial({ color: 0x9ca3af, shininess: 100 });

        var hw = activeProfile.halfWidth;
        var hd = activeProfile.halfDepth;

        // Main Chassis (slightly curved/rounded look)
        var body = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.6, hd * 2), mbotBlue);
        body.position.set(0, 0.8, 0);
        body.castShadow = true;
        group.add(body);

        // Top plate (Battery/Electronics)
        var top = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.6, 0.4, hd * 1.6), darkMat);
        top.position.set(0, 1.2, 0);
        group.add(top);

        // Ultrasonic "Eyes"
        var usBody = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.2, 0.6, 0.2), darkMat);
        usBody.position.set(0, 1.1, -hd);
        group.add(usBody);

        [-0.3, 0.3].forEach(function (ox) {
            var eye = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 16), silverMat);
            eye.rotation.x = Math.PI / 2;
            eye.position.set(ox, 1.1, -hd - 0.15);
            group.add(eye);
        });

        function makeWheel(side) {
            var wr = activeProfile.wheelRadius;
            var wDist = activeProfile.wheelBase / 2;

            var wheelGroup = new THREE.Group();
            wheelGroup.position.set(side * wDist, wr, activeProfile.wheelZOffset);

            var tire = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.4, 16), darkMat);
            tire.rotation.z = Math.PI / 2;
            tire.castShadow = true;
            wheelGroup.add(tire);

            var hub = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.7, wr * 0.7, 0.42, 12), mbotBlue);
            hub.rotation.z = Math.PI / 2;
            wheelGroup.add(hub);

            group.add(wheelGroup);
            return wheelGroup;
        }
        group.userData.wheelL = makeWheel(-1);
        group.userData.wheelR = makeWheel(+1);

        // Front caster
        var caster = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), silverMat);
        caster.position.set(0, 0.25, activeProfile.frontContactZ);
        group.add(caster);

        return group;
    }

    // ════════════════════════════════════════════════════════════════
    // EDISON (MICROBRIC) MODEL
    // ════════════════════════════════════════════════════════════════
    function buildEdisonRobot() {
        var group = new THREE.Group();

        var edisonOrange = new THREE.MeshPhongMaterial({ color: 0xf97316, shininess: 40 }); // vibrant orange
        var darkMat = new THREE.MeshPhongMaterial({ color: 0x262626 });

        var hw = activeProfile.halfWidth;
        var hd = activeProfile.halfDepth;

        // Main orange brick
        var body = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.4, hd * 2), edisonOrange);
        body.position.set(0, 0.45, 0);
        body.castShadow = true;
        group.add(body);

        // Simulated Lego Studs on top
        var studGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
        for (var x = -0.4; x <= 0.4; x += 0.4) {
            for (var z = -0.4; z <= 0.4; z += 0.4) {
                var stud = new THREE.Mesh(studGeo, edisonOrange);
                stud.position.set(x, 0.7, z);
                group.add(stud);
            }
        }

        // Front "visor" (Infrared)
        var visor = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.8, 0.2, 0.1), darkMat);
        visor.position.set(0, 0.45, -hd - 0.02);
        group.add(visor);

        function makeWheel(side) {
            var wr = activeProfile.wheelRadius;
            var wDist = activeProfile.wheelBase / 2;

            var wheelGroup = new THREE.Group();
            wheelGroup.position.set(side * wDist, wr, activeProfile.wheelZOffset);

            var tire = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.25, 16), darkMat);
            tire.rotation.z = Math.PI / 2;
            tire.castShadow = true;
            wheelGroup.add(tire);

            group.add(wheelGroup);
            return wheelGroup;
        }
        group.userData.wheelL = makeWheel(-1);
        group.userData.wheelR = makeWheel(+1);

        // Edison slides on front/rear skids, simplified to a small caster
        var caster = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), darkMat);
        caster.position.set(0, 0.1, activeProfile.frontContactZ);
        group.add(caster);

        return group;
    }



    // ════════════════════════════════════════════════════════════════
    // CANNON-ES WORLD INIT
    // ════════════════════════════════════════════════════════════════
    function initPhysicsWorld() {
        cannonWorld = new CANNON.World({
            gravity: new CANNON.Vec3(0, -20, 0) // strong gravity for snappy feel
        });
        cannonWorld.broadphase = new CANNON.SAPBroadphase(cannonWorld);
        cannonWorld.allowSleep = true;

        // ─ Materials & ContactMaterial ────────────────────────────────
        var groundMat = new CANNON.Material('ground');
        var robotMat = new CANNON.Material('robot');
        var wallMat = new CANNON.Material('wall');

        // Robot vs Ground: no Cannon friction (handled manually in physicsStep)
        cannonWorld.addContactMaterial(new CANNON.ContactMaterial(groundMat, robotMat, {
            friction: 0.0,
            restitution: 0.0
        }));
        // Robot vs Walls: low friction (sliding), no bounce
        cannonWorld.addContactMaterial(new CANNON.ContactMaterial(wallMat, robotMat, {
            friction: 0.05,
            restitution: 0.0
        }));

        // ─ Ground plane (infinite, static) ──────────────────────────
        var groundBody = new CANNON.Body({
            mass: 0,
            material: groundMat,
            shape: new CANNON.Plane()
        });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        cannonWorld.addBody(groundBody);

        // ─ Robot Body (unified for both modes) ──────────────────
        // Physics engine is always kinematic; Hard Mode effects are applied
        // at the velocity/force level rather than via RaycastVehicle,
        // because executeDrive controls velocity directly each frame.
        robotBody = new CANNON.Body({
            mass: 2,
            material: robotMat,
            shape: new CANNON.Box(new CANNON.Vec3(ROBOT_HW(), 1.0, ROBOT_HD())),
            linearDamping: 0.05,
            angularDamping: 0.99
        });
        robotBody.linearFactor.set(1, 0, 1);
        robotBody.angularFactor.set(0, 1, 0);
        robotBody.position.set(START_X, 1.0, START_Z);
        robotBody.quaternion.setFromEuler(0, robotState.theta, 0);
        cannonWorld.addBody(robotBody);
        vehicle = null;

        cannonWorld._robotMat = robotMat;
        cannonWorld._wallMat = wallMat;
        cannonWorld._groundMat = groundMat;

        console.log('[Physics] Cannon-es world initialized.');
    }

    /**
     * Register a static rigid body in Cannon for an axis-aligned box obstacle.
     * (x,z) = centre, (w,d,h) = dimensions (Three.js units).
     */
    function addCannonBox(x, y, z, hw, hy, hz) {
        if (!cannonWorld) return null;
        var body = new CANNON.Body({
            mass: 0,
            material: cannonWorld._wallMat,
            shape: new CANNON.Box(new CANNON.Vec3(hw, hy, hz))
        });
        body.position.set(x, y, z);
        cannonWorld.addBody(body);
        staticBodies.push(body);
        return body;
    }

    // ════════════════════════════════════════════════════════════════
    // WORLD OBJECTS
    // ════════════════════════════════════════════════════════════════
    function addObstacle(x, z, w, d, h, color) {
        var geo = new THREE.BoxGeometry(w, h, d);
        var mat = new THREE.MeshPhongMaterial({ color: color || 0x3b82f6, shininess: 40 });
        var m = new THREE.Mesh(geo, mat);
        m.position.set(x, h / 2, z);
        m.castShadow = true;
        m.receiveShadow = true;
        scene.add(m);

        // Legacy AABB (Touch sensor)
        var rec = {
            minX: x - w / 2, maxX: x + w / 2,
            minZ: z - d / 2, maxZ: z + d / 2,
            minY: 0, maxY: h
        };
        obstacles.push(rec);

        // Cannon static body
        addCannonBox(x, h / 2, z, w / 2, h / 2, d / 2);

        return m;
    }

    /**
     * addPlatform(x, z, w, d, h) – a raised flat platform the robot can drive on top of.
     * Registers four side-wall AABBs (with correct height) AND a flat ramp record
     * so getRampState returns elevation=h when the robot is on top.
     * Also registers Cannon-es static bodies for all walls and the top surface.
     */
    function addPlatform(x, z, w, d, h, color) {
        // Visual mesh
        var geo = new THREE.BoxGeometry(w, h, d);
        var mat = new THREE.MeshPhongMaterial({ color: color || 0xf8f9fa, shininess: 50 });
        var m = new THREE.Mesh(geo, mat);
        m.position.set(x, h / 2, z);
        m.castShadow = true;
        m.receiveShadow = true;
        scene.add(m);

        // ─ Legacy AABB side walls (Touch sensor) ──────────────────────
        var t = 0.5; // wall thickness for AABB
        obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2 - t, maxZ: z - d / 2 + t, minY: 0, maxY: h, _platformSide: true });
        obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z + d / 2 - t, maxZ: z + d / 2 + t, minY: 0, maxY: h, _platformSide: true });
        obstacles.push({ minX: x - w / 2 - t, maxX: x - w / 2 + t, minZ: z - d / 2, maxZ: z + d / 2, minY: 0, maxY: h, _platformSide: true });
        obstacles.push({ minX: x + w / 2 - t, maxX: x + w / 2 + t, minZ: z - d / 2, maxZ: z + d / 2, minY: 0, maxY: h, _platformSide: true });

        // Flat ramp record (constant elevation = h) so getRampState works on top
        var hd = d / 2 - 0.1;
        ramps.push({
            x0: x, z0: z - hd, x1: x, z1: z + hd,
            y0: h, y1: h, width: w, len: d,
            dirX: 0, dirZ: 1, perpX: 1, perpZ: 0,
            slopeAngle: 0,
            _platform: true
        });

        // Also register the top surface AABB (for robots coming from the side at full height)
        var surfRec = {
            minX: x - w / 2, maxX: x + w / 2,
            minZ: z - d / 2, maxZ: z + d / 2,
            minY: 0, maxY: h,
            _platformBase: true
        };
        obstacles.push(surfRec);
        window.__GET_ROBOT_STATE__ = function () { return robotState; };

        // ─ Cannon-es: one solid box for the entire platform ───────────────
        // The robot can drive on top because its collider sits at y=1.0
        // and the platform top is at y=h. If h ≈ 2.2 and robot is 1.0 above y,
        // the robot body will be pushed onto the surface automatically.
        addCannonBox(x, h / 2, z, w / 2, h / 2, d / 2);

        return { mesh: m, physicsRec: surfRec };
    }

    /**
     * addLineTile
     * ──────────────
     * Creates a flat 30x30cm (4.5 units) white tile with a black line on it.
     * This is strictly visual (for color sensor tracking) and has NO collisions.
     */
    function addLineTile(x, z, yaw) {
        var group = new THREE.Group();
        group.position.set(x, 0.02, z); // Slightly above ground to prevent z-fighting
        group.rotation.y = yaw || 0;

        // White base tile (30x30cm)
        var tileGeo = new THREE.PlaneGeometry(4.5, 4.5);
        var tileMat = new THREE.MeshPhongMaterial({ color: 0xf8f9fa });
        var tile = new THREE.Mesh(tileGeo, tileMat);
        tile.rotation.x = -Math.PI / 2;
        tile.receiveShadow = true;
        group.add(tile);

        // Black line down the center (Y axis of the plane is Z axis of world)
        var lineGeo = new THREE.PlaneGeometry(0.2, 4.5);
        var lineMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        var line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.y = 0.01; // Slightly above tile base
        group.add(line);

        // Subtle border to see the tile on the white floor
        var borderGeo = new THREE.EdgesGeometry(tileGeo);
        var borderMat = new THREE.LineBasicMaterial({ color: 0xcccccc });
        var border = new THREE.LineSegments(borderGeo, borderMat);
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.01;
        group.add(border);

        // Add to selectable objects for World Builder
        worldObjects.push({ mesh: group, type: 'tile' });
        scene.add(group);
    }

    /**
     * addCurveTile
     * ──────────────
     * Creates a white 30x30cm tile with a 90-degree black curve.
     */
    function addCurveTile(x, z, yaw) {
        var group = new THREE.Group();
        group.position.set(x, 0.02, z);
        group.rotation.y = yaw || 0;

        var tileGeo = new THREE.PlaneGeometry(4.5, 4.5);
        var tileMat = new THREE.MeshPhongMaterial({ color: 0xf8f9fa });
        var tile = new THREE.Mesh(tileGeo, tileMat);
        tile.rotation.x = -Math.PI / 2;
        tile.receiveShadow = true;
        group.add(tile);

        // 90 degree black arc from mid-edge to mid-edge
        var curveGeo = new THREE.RingGeometry(2.15, 2.35, 16, 1, 0, Math.PI / 2);
        var curveMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
        var curve = new THREE.Mesh(curveGeo, curveMat);
        curve.rotation.x = -Math.PI / 2;
        // Position at one of the corners to draw arc through adjacent edges
        curve.position.set(-2.25, 0.01, -2.25);
        group.add(curve);

        var borderGeo = new THREE.EdgesGeometry(tileGeo);
        var borderMat = new THREE.LineBasicMaterial({ color: 0xcccccc });
        var border = new THREE.LineSegments(borderGeo, borderMat);
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.01;
        group.add(border);

        worldObjects.push({ mesh: group, type: 'tile' });
        scene.add(group);
    }

    /**
     * addIntersectionTile
     * ──────────────
     * Creates a white 30x30cm tile with a black cross.
     */
    function addIntersectionTile(x, z, yaw) {
        var group = new THREE.Group();
        group.position.set(x, 0.02, z);
        group.rotation.y = yaw || 0;

        var tileGeo = new THREE.PlaneGeometry(4.5, 4.5);
        var tileMat = new THREE.MeshPhongMaterial({ color: 0xf8f9fa });
        var tile = new THREE.Mesh(tileGeo, tileMat);
        tile.rotation.x = -Math.PI / 2;
        tile.receiveShadow = true;
        group.add(tile);

        var lineMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        var hLineGeo = new THREE.PlaneGeometry(4.5, 0.2);
        var hLine = new THREE.Mesh(hLineGeo, lineMat);
        hLine.rotation.x = -Math.PI / 2;
        hLine.position.y = 0.01;
        group.add(hLine);

        var vLineGeo = new THREE.PlaneGeometry(0.2, 4.5);
        var vLine = new THREE.Mesh(vLineGeo, lineMat);
        vLine.rotation.x = -Math.PI / 2;
        vLine.position.y = 0.01;
        group.add(vLine);

        var borderGeo = new THREE.EdgesGeometry(tileGeo);
        var borderMat = new THREE.LineBasicMaterial({ color: 0xcccccc });
        var border = new THREE.LineSegments(borderGeo, borderMat);
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.01;
        group.add(border);

        worldObjects.push({ mesh: group, type: 'tile' });
        scene.add(group);
    }

    /**
     * addGreenMarker
     * ──────────────
     * Creates a 5x5cm green marker for intersections (RoboCup Maze tracking).
     */
    function addGreenMarker(x, z, yaw) {
        var group = new THREE.Group();
        // Slightly higher to sit on top of tiles if dropped there
        group.position.set(x, 0.04, z);
        group.rotation.y = yaw || 0;

        // 5cm = 0.75 units
        var markerGeo = new THREE.PlaneGeometry(0.75, 0.75);
        var markerMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        var marker = new THREE.Mesh(markerGeo, markerMat);
        marker.rotation.x = -Math.PI / 2;
        group.add(marker);

        var borderGeo = new THREE.EdgesGeometry(markerGeo);
        var borderMat = new THREE.LineBasicMaterial({ color: 0x005500 });
        var border = new THREE.LineSegments(borderGeo, borderMat);
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.01;
        group.add(border);

        worldObjects.push({ mesh: group, type: 'marker' });
        scene.add(group);
    }

    function addTarget(xWorld, zWorld, color) {
        var ringGeo = new THREE.RingGeometry(1.5, 2.2, 24);
        var ringMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
        var ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(xWorld, 0.04, zWorld);
        scene.add(ring);

        var fillGeo = new THREE.CircleGeometry(1.4, 24);
        var fillMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
        var fill = new THREE.Mesh(fillGeo, fillMat);
        fill.rotation.x = -Math.PI / 2;
        fill.position.set(xWorld, 0.05, zWorld);
        scene.add(fill);
    }


    // ════════════════════════════════════════════════════════════════
    // RAMP
    // ════════════════════════════════════════════════════════════════
    /**
     * addRamp({ x0, z0, x1, z1, height, width })
     * (x0,z0) = foot (ground level), (x1,z1) = top (elevated end)
     */
    function addRamp(cfg) {
        var x0 = cfg.x0, z0 = cfg.z0;
        var x1 = cfg.x1, z1 = cfg.z1;
        var y0 = cfg.y0 !== undefined ? cfg.y0 : 0;
        var y1 = cfg.y1 !== undefined ? cfg.y1 : (cfg.height !== undefined ? cfg.height : 2);
        var h = y1 - y0;
        var w = cfg.width || 4;

        var dx = x1 - x0, dz = z1 - z0;
        var len = Math.sqrt(dx * dx + dz * dz);
        var dirX = dx / len, dirZ = dz / len;
        var perpX = -dirZ, perpZ = dirX;
        var slopeAngle = Math.atan2(h, len);
        var hyp = Math.sqrt(len * len + h * h);

        var midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
        var midY = (y0 + y1) / 2;
        var rampGroup = new THREE.Group();
        rampGroup.position.set(midX, midY, midZ);

        // ── Slope surface ────────────────────────────────────────
        var surfMat = new THREE.MeshPhongMaterial({ color: 0xf8f9fa, shininess: 20, side: THREE.DoubleSide });
        var surf = new THREE.Mesh(new THREE.PlaneGeometry(w, hyp, 2, 12), surfMat);
        surf.receiveShadow = surf.castShadow = true;
        var yaw = Math.atan2(dirX, dirZ);
        surf.rotation.order = 'YXZ';
        surf.rotation.y = yaw;
        surf.rotation.x = -Math.PI / 2 - slopeAngle;
        rampGroup.add(surf);

        // ── Black center line (Line Tracking) ──────────────────
        var stripeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        var stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.2, hyp), stripeMat);
        // Parent to the surface so it perfectly matches its rotation and slope
        // Set at x=0 (center), z=0.01 (slightly above surface to prevent Z-fighting)
        stripe.position.set(0, 0, 0.01);
        surf.add(stripe);

        // (Triangular side-walls removed: the wedge underside geometry now includes them)

        scene.add(rampGroup);

        // ── Wedge underside (proper triangular prism, NO vertical front wall) ──
        // Vertices (in ramp-local space, foot at origin, top at (0, h, len)):
        //   v0 = foot-left  bottom  (0, 0, -w/2)
        //   v1 = foot-right bottom  (0, 0, +w/2)
        //   v2 = top-left   top     (len, h, -w/2)
        //   v3 = top-right  top     (len, h, +w/2)
        // Those four form the sloped top face (same as the surface).
        // Bottom face is y=0, from x=0..len, z=-w/2..+w/2 (flat ground contact).
        // The prism is simply: left wall + right wall + bottom + sloped top.
        // We reuse rampGroup and build the solid as a BufferGeometry.
        (function buildWedge() {
            var positions = [];
            var lH = -w / 2, rH = w / 2;

            function v(al, wy, side) {
                var lx = -midX + x0 + al * dirX - side * perpX;
                var ly = wy - midY;
                var lz = -midZ + z0 + al * dirZ - side * perpZ;
                positions.push(lx, ly, lz);
            }

            // Left wall (facing -X local side, which is actually side=lH)
            // Points: A(0,0,lH), B(len,0,lH), C(len,y1,lH), D(0,y0,lH)
            // Winding: from outside (looking +ve along lH's normal), CCW is A -> B -> C and A -> C -> D
            v(0, 0, lH); v(len, 0, lH); v(len, y1, lH);
            v(0, 0, lH); v(len, y1, lH); v(0, y0, lH);

            // Right wall (facing +X local side, which is side=rH)
            // Points: A(0,0,rH), B(len,0,rH), C(len,y1,rH), D(0,y0,rH)
            // Winding: from outside, CCW is A -> D -> C and A -> C -> B
            v(0, 0, rH); v(0, y0, rH); v(len, y1, rH);
            v(0, 0, rH); v(len, y1, rH); v(len, 0, rH);

            // Front wall (at al=0, facing -Z local), if y0 > 0:
            // Points: A(0,0,rH), B(0,y0,rH), C(0,y0,lH), D(0,0,lH)
            if (y0 > 0) {
                v(0, 0, rH); v(0, y0, rH); v(0, y0, lH);
                v(0, 0, rH); v(0, y0, lH); v(0, 0, lH);
            }

            // Back wall (at al=len, facing +Z local), if y1 > 0:
            // Points: A(len,0,lH), B(len,y1,lH), C(len,y1,rH), D(len,0,rH)
            if (y1 > 0) {
                v(len, 0, lH); v(len, y1, lH); v(len, y1, rH);
                v(len, 0, lH); v(len, y1, rH); v(len, 0, rH);
            }

            var geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.computeVertexNormals();
            var mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0x1f2937, side: THREE.DoubleSide }));
            mesh.castShadow = true;
            rampGroup.add(mesh);
        })();

        ramps.push({
            x0: x0, z0: z0, x1: x1, z1: z1,
            y0: y0, y1: y1, width: w, len: len,
            dirX: dirX, dirZ: dirZ,
            perpX: perpX, perpZ: perpZ,
            slopeAngle: slopeAngle
        });

        // ── Side-wall collision: two thin AABBs, one per side ────────────
        // This prevents the robot from clipping through the ramp side triangles
        // We extend the walls the full length of the ramp (sideShrink = 0) and make them thick
        // enough (sideThickness = 1.2) to intercept the robot's chassis bounding box before
        // its wider mathematical wheels can hang off the edge of the ramp.
        var sideThickness = 1.2;
        var sideShrink = 0.0;
        var sideLen = Math.max(0, len - 2 * sideShrink);

        var invMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });

        [-1, 1].forEach(function (s) {
            // Centre of this side wall in world XZ (midpoint along ramp, offset by +-w/2)
            var cx = (x0 + x1) / 2 + perpX * s * (w / 2);
            var cz = (z0 + z1) / 2 + perpZ * s * (w / 2);
            // Half-extents: along ramp dir = sideLen/2, perp = sideThickness/2
            var hw = Math.abs(dirX) * sideLen / 2 + Math.abs(perpX) * sideThickness / 2;
            var hd = Math.abs(dirZ) * sideLen / 2 + Math.abs(perpZ) * sideThickness / 2;
            obstacles.push({
                minX: cx - hw, maxX: cx + hw,
                minZ: cz - hd, maxZ: cz + hd,
                maxY: Math.max(y0, y1),
                _rampSide: true,   // tag so we can distinguish if needed
                _rampOwner: ramps[ramps.length - 1]
            });

            // Create invisible mesh for raycasting (ultrasonic sensor)
            var sideGeo = new THREE.BoxGeometry(hw * 2, Math.max(y0, y1), hd * 2);
            var sideMesh = new THREE.Mesh(sideGeo, invMat);
            sideMesh.position.set(cx - midX, Math.max(y0, y1) / 2 - midY, cz - midZ);
            rampGroup.add(sideMesh);
        });

        // ── Front/Back-wall collision ────────────
        // Ramps need solid walls at their elevated ends to prevent driving into them from the back.
        // We use Math.abs to ensure dimensions are positive regardless of ramp orientation.
        //
        // Additionally we add a thin entry-wall at the FOOT (low end, y=0) of the ramp so the
        // robot cannot drive sideways into the wedge geometry. This wall is the same width as the
        // ramp but very thin (0.15 units) and only as tall as the ramp (maxY). It is tagged
        // _rampEntryWall so collidesAt can choose to skip it when the robot is climbing normally.
        var ENTRY_THICKNESS = 0.2; // units – thin wall at ramp foot
        if (y0 <= 0.05) {
            // Foot is at ground level – add entry wall here to stop lateral intrusion
            var ew_hw = Math.abs(dirX) * ENTRY_THICKNESS / 2 + Math.abs(perpX) * w / 2;
            var ew_hd = Math.abs(dirZ) * ENTRY_THICKNESS / 2 + Math.abs(perpZ) * w / 2;
            var ecx = x0 - dirX * ENTRY_THICKNESS / 2;  // slightly outside the foot
            var ecz = z0 - dirZ * ENTRY_THICKNESS / 2;
            obstacles.push({
                minX: Math.min(ecx - ew_hw, ecx + ew_hw), maxX: Math.max(ecx - ew_hw, ecx + ew_hw),
                minZ: Math.min(ecz - ew_hd, ecz + ew_hd), maxZ: Math.max(ecz - ew_hd, ecz + ew_hd),
                maxY: y1,   // as tall as the highest end so robots can't drive under it from the side
                _rampEntryWall: true,
                _rampOwner: ramps[ramps.length - 1]
            });

            // Create invisible mesh for raycasting
            var ewGeo = new THREE.BoxGeometry(ew_hw * 2, y1, ew_hd * 2);
            var ewMesh = new THREE.Mesh(ewGeo, invMat);
            ewMesh.position.set(ecx - midX, y1 / 2 - midY, ecz - midZ);
            rampGroup.add(ewMesh);
        }
        if (y1 <= 0.05) {
            // Top is at ground level (downward ramp) – add entry wall at the top end (z1 side)
            var ew_hw = Math.abs(dirX) * ENTRY_THICKNESS / 2 + Math.abs(perpX) * w / 2;
            var ew_hd = Math.abs(dirZ) * ENTRY_THICKNESS / 2 + Math.abs(perpZ) * w / 2;
            var ecx = x1 + dirX * ENTRY_THICKNESS / 2;
            var ecz = z1 + dirZ * ENTRY_THICKNESS / 2;
            obstacles.push({
                minX: Math.min(ecx - ew_hw, ecx + ew_hw), maxX: Math.max(ecx - ew_hw, ecx + ew_hw),
                minZ: Math.min(ecz - ew_hd, ecz + ew_hd), maxZ: Math.max(ecz - ew_hd, ecz + ew_hd),
                maxY: y0,
                _rampEntryWall: true,
                _rampOwner: ramps[ramps.length - 1]
            });

            // Create invisible mesh for raycasting
            var ewGeo = new THREE.BoxGeometry(ew_hw * 2, y0, ew_hd * 2);
            var ewMesh = new THREE.Mesh(ewGeo, invMat);
            ewMesh.position.set(ecx - midX, y0 / 2 - midY, ecz - midZ);
            rampGroup.add(ewMesh);
        }

        if (y0 > 0.1) {
            var b0_hw = Math.abs(dirX) * 0.1 + Math.abs(perpX) * w / 2;
            var b0_hd = Math.abs(dirZ) * 0.1 + Math.abs(perpZ) * w / 2;
            // Shift the center slightly inwards (towards the ramp) so it flush-mounts the end
            var cx0 = x0 + dirX * 0.1;
            var cz0 = z0 + dirZ * 0.1;
            obstacles.push({
                minX: Math.min(cx0 - b0_hw, cx0 + b0_hw), maxX: Math.max(cx0 - b0_hw, cx0 + b0_hw),
                minZ: Math.min(cz0 - b0_hd, cz0 + b0_hd), maxZ: Math.max(cz0 - b0_hd, cz0 + b0_hd),
                maxY: y0,
                _rampOwner: ramps[ramps.length - 1]
            });
        }
        if (y1 > 0.1) {
            var b1_hw = Math.abs(dirX) * 0.1 + Math.abs(perpX) * w / 2;
            var b1_hd = Math.abs(dirZ) * 0.1 + Math.abs(perpZ) * w / 2;
            var cx1 = x1 - dirX * 0.1;
            var cz1 = z1 - dirZ * 0.1;
            obstacles.push({
                minX: Math.min(cx1 - b1_hw, cx1 + b1_hw), maxX: Math.max(cx1 - b1_hw, cx1 + b1_hw),
                minZ: Math.min(cz1 - b1_hd, cz1 + b1_hd), maxZ: Math.max(cz1 - b1_hd, cz1 + b1_hd),
                maxY: y1,
                _rampOwner: ramps[ramps.length - 1]
            });
        }

        console.log('[MissionSim3D] Ramp added. slope=' + (slopeAngle * 180 / Math.PI).toFixed(1) + '° len=' + len.toFixed(1));

        // ─ Cannon-es: Physics for ramps ───────────────────────────────────────
        if (window.SIM_HARD_MODE && cannonWorld) {
            // Rebuild the identical vertices for the Trimesh, but relative to the mid-point.
            // The BufferGeometry positions array was flat. We can regenerate it.
            var positions = [];
            var lH = -w / 2, rH = w / 2;
            function addV(al, wy, side) {
                var lx = -midX + x0 + al * dirX - side * perpX;
                var ly = wy - midY;
                var lz = -midZ + z0 + al * dirZ - side * perpZ;
                positions.push(lx, ly, lz);
            }
            // Top Slope (Triangles: left-bottom, right-bottom, right-top, left-top)
            addV(0, y0, lH); addV(0, y0, rH); addV(len, y1, rH);
            addV(0, y0, lH); addV(len, y1, rH); addV(len, y1, lH);

            // Bottom Floor
            addV(0, 0, rH); addV(0, 0, lH); addV(len, 0, lH);
            addV(0, 0, rH); addV(len, 0, lH); addV(len, 0, rH);

            // Left Wall
            addV(0, 0, lH); addV(len, 0, lH); addV(len, y1, lH);
            addV(0, 0, lH); addV(len, y1, lH); addV(0, y0, lH);

            // Right Wall
            addV(0, 0, rH); addV(0, y0, rH); addV(len, y1, rH);
            addV(0, 0, rH); addV(len, y1, rH); addV(len, 0, rH);

            var indices = [];
            for (var i = 0; i < positions.length / 3; i++) indices.push(i);

            var trimesh = new CANNON.Trimesh(positions, indices);
            var rampBody = new CANNON.Body({ mass: 0, material: cannonWorld._groundMat });
            rampBody.addShape(trimesh);
            rampBody.position.set(midX, midY, midZ);
            cannonWorld.addBody(rampBody);
            staticBodies.push(rampBody);
            console.log('[MissionSim3D] Added Cannon Trimesh for ramp.');
        } else {
            // The robot's Y position is driven manually by getRampState elevation.
            // Physical collision on ramps is handled by the existing AABB obstacle arrays
            // (side walls + front/back walls) which are used for Touch sensor detection.
        }

        return rampGroup;
    }

    /**
     * getRampState(x, z, theta, currentY, isPoint)
     */
    function getRampState(x, z, theta, currentY, isPoint) {
        var activeRamps = [];
        for (var i = 0; i < ramps.length; i++) {
            var r = ramps[i];
            var relX = x - r.x0, relZ = z - r.z0;
            var along = relX * r.dirX + relZ * r.dirZ;
            var perp = relX * r.perpX + relZ * r.perpZ;

            var inBounds = false;
            if (isPoint) {
                // Strict point check: no padding. The wheel must mathematically touch the ramp surface.
                inBounds = (along >= -0.1 && along <= r.len + 0.1 && Math.abs(perp) <= r.width / 2);
            } else {
                // Robot volume check: allow some off-center driving for the main body
                inBounds = (along >= -ROBOT_HD() && along <= r.len + ROBOT_HD() && Math.abs(perp) <= r.width / 2 + 1.2);
            }

            if (inBounds) {
                // Simple linear interpolation along the ramp
                var t = Math.max(0, Math.min(along / r.len, 1));
                if (along < 0 && r.y0 === 0) t = 0;
                if (along > r.len && r.y1 === 0) t = 1;
                var testElev = r.y0 + t * (r.y1 - r.y0);

                // FIX: Platform records (flat, y0===y1===h) should NOT elevate the robot
                // when it's next to the platform at ground level. Only apply if robot
                // is already at height (came from a ramp) or is truly on top.
                if (r._platform && currentY !== undefined && currentY < r.y0 - 0.5) continue;

                // Ignore ramps that are too high above our current elevation to mount,
                // but ONLY if we are at the very bottom edge approaching it.
                if (currentY !== undefined && along < 0.5 && testElev > currentY + 0.6) continue;

                activeRamps.push({ r: r, along: along, testElev: testElev });
            }
        }

        if (activeRamps.length === 0) {
            window.__GET_ROBOT_STATE__ = function () { return robotState; };
            return { onRamp: false, elevation: 0, slopeAngle: 0, speedFactor: 1.0 };
        }

        activeRamps.sort(function (a, b) {
            var distA = Math.max(0, 0 - a.along, a.along - a.r.len);
            var distB = Math.max(0, 0 - b.along, b.along - b.r.len);
            return distA - distB;
        });

        var best = activeRamps[0];
        var r = best.r;
        var along = best.along;
        var elevation = best.testElev;

        var dotFwd = (-Math.sin(theta)) * r.dirX + (-Math.cos(theta)) * r.dirZ;
        var speedFactor = 1.0 - dotFwd * Math.sin(r.slopeAngle) * 0.45;
        speedFactor = Math.max(0.35, Math.min(1.55, speedFactor));

        window.__GET_ROBOT_STATE__ = function () { return robotState; };

        return {
            onRamp: true,
            elevation: elevation,
            slopeAngle: r.slopeAngle,
            dirX: r.dirX, dirZ: r.dirZ,
            speedFactor: (along >= 0 && along <= r.len) ? speedFactor : 1.0
        };
    }
    // ════════════════════════════════════════════════════════════════
    function reset() {
        stop();
        robotState.x = START_X;
        robotState.z = START_Z;
        robotState.theta = 0;
        robotState.omegaL = 0;
        robotState.omegaR = 0;
        robotState.wheelPosL = 0;
        robotState.wheelPosR = 0;

        robotState.vx = 0;
        robotState.vy = 0;
        robotState.vz = 0;
        robotState.vw = 0;
        robotState.isFalling = false;

        robotState.sensors = { ultrasonic: 255, color: 'none', touch: false };
        programRunnerActive = null;
        onDoneCallback = null;

        // Reset Cannon body
        if (robotBody) {
            robotBody.position.set(START_X, 1.0, START_Z);
            robotBody.velocity.set(0, 0, 0);
            robotBody.angularVelocity.set(0, 0, 0);
            robotBody.force.set(0, 0, 0);
            robotBody.torque.set(0, 0, 0);
            robotBody.quaternion.setFromEuler(0, 0, 0);
            robotBody.wakeUp();
        }

        // Do NOT clear dynamicMeshes, obstacles or ramps here, otherwise user-placed objects
        // disappear when you click Start! (Use clearWorldObjects for that).

        applyRobotPose();
        console.log('[MissionSim3D] Reset');
    }

    function applyRobotPose() {
        if (!robot) return;

        // Note: position and quaternion (yaw/tilt) are now strictly 
        // managed by physicsStep. This function only handles wheel animations.
        if (robot.userData.wheelL) robot.userData.wheelL.rotation.x = robotState.wheelPosL;
        if (robot.userData.wheelR) robot.userData.wheelR.rotation.x = robotState.wheelPosR;
    }


    // ════════════════════════════════════════════════════════════════
    function getTerrainElevation(rx, rz, theta, currentY, isPoint) {
        if (currentY === undefined) currentY = 0;

        var rs = getRampState(rx, rz, theta, currentY, isPoint);
        if (rs.onRamp) return rs.elevation;

        var maxEl = 0;
        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            // Only skip walls related to ramps, do NOT skip _platformBase
            // We want the robot to read the maxY of the platform it's driving on.
            if (o._rampOwner || o._rampSide || o._platformSide) continue;

            var hit = false;
            if (isPoint) {
                hit = (rx > o.minX && rx < o.maxX && rz > o.minZ && rz < o.maxZ);
            } else {
                hit = (rx + ROBOT_HW() > o.minX && rx - ROBOT_HW() < o.maxX &&
                    rz + ROBOT_HD() > o.minZ && rz - ROBOT_HD() < o.maxZ);
            }

            if (hit) {
                // Only step up if the obstacle isn't too high to mount instantaneously
                var oY = o.maxY || 0;
                if (oY <= currentY + 0.6) {
                    maxEl = Math.max(maxEl, oY);
                }
            }
        }
        return maxEl;
    }

    // ════════════════════════════════════════════════════════════════
    // COLLISION
    // ════════════════════════════════════════════════════════════════
    /**
     * collidesAt(x, z, testTheta) – returns true if the robot hits an obstacle.
     * Obstacles with maxY <= current_elevation are "below" the robot and are skipped.
     */
    function collidesAt(x, z, testTheta) {
        if (testTheta === undefined) testTheta = robotState.theta;

        // Use the robot's TEST elevation (where it's trying to go!).
        var testElev = getTerrainElevation(x, z, testTheta, robot.position.y);
        var testOnAnyRamp = getRampState(x, z, testTheta, robot.position.y).onRamp;

        // Using Separating Axis Theorem (SAT) for OBB (Robot) vs AABB (Obstacle)
        var cosT = Math.cos(testTheta);
        var sinT = Math.sin(testTheta);
        // Local axes of the robot
        var ux = cosT, uz = -sinT;   // Local X axis (Right)
        var vx = sinT, vz = cosT;    // Local Z axis (Backward)

        var absUx = Math.abs(ux), absUz = Math.abs(uz);
        var absVx = Math.abs(vx), absVz = Math.abs(vz);

        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];

            // Height-aware skip: robot must be STRICTLY above this obstacle's roof.
            var obstacleRoof = (o.maxY !== undefined) ? o.maxY : 999;

            // Platform side walls require very strict height verification because they rise straight up
            // from the flat plane where testElev can falsely look ahead and assume we have climbed it.
            var isPlatformWall = (o._platformBase || o._platformSide);

            if (isPlatformWall) {
                // Ignore the ghost base record completely
                if (o._platformBase) continue;

                // Only skip platform walls if we are physically on top of the platform already
                if (robot.position.y >= obstacleRoof - 0.1) continue;

                // Or if we are currently on a ramp AND our projected elevation brings us up to the platform roughly
                if (testOnAnyRamp && obstacleRoof <= testElev + 0.85) continue;

                // Otherwise, even if testElev is high, DO NOT SKIP. We are driving into the side!
            } else {
                // Non-platform walls (ramps) can be skipped via testElev natively
                if (testElev >= obstacleRoof - 0.05) continue;

                // Entry walls at the ramp foot are special: they must NOT be skipped by the
                // broad ramp skip below. Handle them here with direction-aware logic.
                if (o._rampEntryWall && o._rampOwner) {
                    // Allow passage only when robot is moving toward the uphill end
                    // (i.e. approaching the ramp from the front, not crashing into it from the side)
                    var rd = o._rampOwner;
                    var moveX = x - robotState.x;
                    var moveZ = z - robotState.z;
                    var moveDot = moveX * rd.dirX + moveZ * rd.dirZ;
                    if (moveDot > 0.02) continue; // moving in ramp direction → skip (legitimate entry)
                    // Otherwise fall through to SAT check → blocked (lateral approach)
                } else {
                    // Skip ramp walls (including neighboring ramps) when already climbing or entering
                    if ((o._rampSide || o._rampOwner) && testOnAnyRamp) continue;

                    // Skip ramp back-walls if we are on a platform and approaching the ramp from above
                    if (o._rampOwner && obstacleRoof <= testElev + 0.85) continue;
                }
            }

            // Obstacle AABB center and half-extents
            var ocx = (o.minX + o.maxX) / 2;
            var ocz = (o.minZ + o.maxZ) / 2;
            var ohw = (o.maxX - o.minX) / 2;
            var ohd = (o.maxZ - o.minZ) / 2;

            // Vector from robot center to obstacle center
            var tx = ocx - x;
            var tz = ocz - z;

            // Realism tracking: Where is the obstacle relative to our right-facing vector?
            // If localX > 0, the obstacle is mainly on the right side of the robot.
            lastHitLocalX = tx * ux + tz * uz;

            // SAT Test
            // Axis 1: World X
            if (Math.abs(tx) > ohw + ROBOT_HW() * absUx + ROBOT_HD() * absVx) continue;
            // Axis 2: World Z
            if (Math.abs(tz) > ohd + ROBOT_HW() * absUz + ROBOT_HD() * absVz) continue;
            // Axis 3: Robot Local X
            if (Math.abs(tx * ux + tz * uz) > ROBOT_HW() + ohw * absUx + ohd * absUz) continue;
            // Axis 4: Robot Local Z
            if (Math.abs(tx * vx + tz * vz) > ROBOT_HD() + ohw * absVx + ohd * absVz) continue;

            // If we are overlapping (SAT failed to separate), check if we are moving strictly AWAY 
            // from the obstacle center. If so, permit the movement to allow extraction from snags
            // (e.g. the robot's long tail snagging a platform edge when dropping off).
            // BUT do not bypass if we are hitting the SIDE of an obstacle and aren't on top of it!
            if (o._platformSide || o._rampSide || o._rampOwner) {
                var oldTx = ocx - robotState.x;
                var oldTz = ocz - robotState.z;
                var oldDistSq = oldTx * oldTx + oldTz * oldTz;
                var newDistSq = tx * tx + tz * tz;

                // For ANY side wall (platform or ramp), ONLY allow bypass if we are already
                // securely ABOVE the base. Otherwise, driving past the wall's center will 
                // trigger this bypass maliciously and let the robot clip inside the ramp/platform.
                var allowBypass = true;
                if (robot.position.y < (o.maxY || 0) - 0.1) {
                    allowBypass = false;
                }

                if (allowBypass && newDistSq > oldDistSq + 1e-5) {
                    continue; // Bypass this collision, we are sliding off safely from ABOVE
                }
            }

            console.log("[MissionSim3D] Collision detected! x:", Math.round(x * 10) / 10, "z:", Math.round(z * 10) / 10);
            console.log("  Obstacle:", JSON.stringify(o));
            console.log("  testElev:", Math.round(testElev * 10) / 10, "obstacleRoof:", Math.round(obstacleRoof * 10) / 10, "testOnAnyRamp:", testOnAnyRamp);
            return true;
        }
        return false;
    }


    // ════════════════════════════════════════════════════════════════
    // PROGRAM RUNNER (AST-based dynamic executor)
    // ════════════════════════════════════════════════════════════════
    var programRunnerActive = null;  // reference to active runner cancellation token
    var MAX_ITERATIONS = 10000;      // safety guard against infinite loops

    /**
     * Evaluate an expression AST node against current sensor state.
     * Returns a JS value (number, boolean, string).
     */
    function evalExpr(expr) {
        if (!expr) return 0;
        switch (expr.type) {
            case 'number': return expr.value;
            case 'string': return expr.value;
            case 'boolean': return expr.value;
            case 'sensor_ultrasonic': return robotState.sensors.ultrasonic;
            case 'sensor_color': return robotState.sensors.color;
            case 'sensor_touch': return robotState.sensors.touch;
            case 'not': return !evalExpr(expr.expr);
            case 'logic': {
                var l = evalExpr(expr.left), r = evalExpr(expr.right);
                return expr.op === 'AND' ? (l && r) : (l || r);
            }
            case 'compare': {
                var l = evalExpr(expr.left), r = evalExpr(expr.right);
                switch (expr.op) {
                    case 'EQ': case '=': return l == r;
                    case 'NEQ': case '!=': return l != r;
                    case 'LT': case '<': return l < r;
                    case 'LTE': case '<=': return l <= r;
                    case 'GT': case '>': return l > r;
                    case 'GTE': case '>=': return l >= r;
                    default: return l == r;
                }
            }
            case 'arithmetic': {
                var l = evalExpr(expr.left), r = evalExpr(expr.right);
                switch (expr.op) {
                    case 'ADD': return l + r;
                    case 'MINUS': return l - r;
                    case 'MULTIPLY': return l * r;
                    case 'DIVIDE': return r !== 0 ? l / r : 0;
                    default: return l + r;
                }
            }
            default:
                console.warn('[ProgramRunner] Unknown expr:', expr.type);
                return 0;
        }
    }

    /**
     * Execute an AST node, calling done() when finished.
     * token: object with .cancelled flag for early stop.
     */
    function execNode(node, token, done) {
        if (!isRunning || token.cancelled) return;
        if (!node) { done(); return; }
        console.log('[ProgramRunner] exec:', node.type);

        switch (node.type) {

            case 'sequence': {
                var i = 0;
                var nodes = node.body || [];
                function next() {
                    if (!isRunning || token.cancelled) return;
                    if (i >= nodes.length) { done(); return; }
                    execNode(nodes[i++], token, next);
                }
                next();
                break;
            }

            case 'repeat': {
                var count = Math.min(Math.floor(node.times) || 0, MAX_ITERATIONS);
                var iter = 0;
                function loop() {
                    if (!isRunning || token.cancelled) return;
                    if (iter >= count) { done(); return; }
                    iter++;
                    execNode(node.body, token, loop);
                }
                loop();
                break;
            }

            case 'repeat_forever': {
                var iterGuard = 0;
                function loopFwd() {
                    if (!isRunning || token.cancelled) return;
                    if (++iterGuard > MAX_ITERATIONS) {
                        console.warn('[ProgramRunner] MAX_ITERATIONS reached in repeat_forever');
                        done(); return;
                    }
                    execNode(node.body, token, loopFwd);
                }
                loopFwd();
                break;
            }

            case 'repeat_until': {
                var iterGuard2 = 0;
                function loopUntil() {
                    if (!isRunning || token.cancelled) return;
                    if (++iterGuard2 > MAX_ITERATIONS) { done(); return; }
                    var condVal = evalExpr(node.cond);
                    // mode 'UNTIL': keep going until cond is true; 'WHILE': keep going while cond is true
                    var shouldContinue = (node.mode === 'UNTIL') ? !condVal : !!condVal;
                    if (!shouldContinue) { done(); return; }
                    execNode(node.body, token, loopUntil);
                }
                loopUntil();
                break;
            }

            case 'if': {
                var condVal = evalExpr(node.cond);
                if (condVal) {
                    execNode(node.thenBody, token, done);
                } else if (node.elseBody) {
                    execNode(node.elseBody, token, done);
                } else {
                    done();
                }
                break;
            }

            case 'drive': {
                executeDrive(node.distance, node.speed, done);
                break;
            }
            case 'turn': {
                executeTurn(node.degrees, node.speed, done);
                break;
            }
            case 'stop': {
                robotState.omegaL = 0;
                robotState.omegaR = 0;
                done();
                break;
            }
            case 'wait': {
                setTimeout(function () {
                    if (isRunning && !token.cancelled) done();
                }, node.ms);
                break;
            }
            default:
                console.warn('[ProgramRunner] Unknown node type:', node.type);
                done();
        }
    }

    /**
     * Stop the currently running program.
     */
    function stop() {
        if (programRunnerActive) {
            programRunnerActive.cancelled = true;
            programRunnerActive = null;
        }
        isRunning = false;
        robotState.omegaL = 0;
        robotState.omegaR = 0;
        // Don't call applyRobotPose() here – the physics loop (physicsStep)
        // already handles position/elevation. Calling applyRobotPose() uses
        // a different elevation calculation that causes the robot to "jump".
        console.log('[MissionSim3D] Execution stopped by user.');
    }

    /**
     * Run an AST program. onDone() called when finished.
     * Accepts both the new AST format and old flat-array for backward compat.
     */
    function runProgram(ast, onDone) {
        stop();
        if (!ast) { if (onDone) onDone(); return; }

        // Legacy backward-compat: flat array of {type,..} command objects
        if (Array.isArray(ast)) {
            ast = { type: 'sequence', body: ast };
        }

        var token = { cancelled: false };
        programRunnerActive = token;
        isRunning = true;
        onDoneCallback = onDone || null;

        execNode(ast, token, function () {
            isRunning = false;
            robotState.omegaL = 0;
            robotState.omegaR = 0;
            if (onDoneCallback) {
                onDoneCallback();
                onDoneCallback = null;
            }
        });
    }

    // Shim: keep runCommands working (used by mission-app.js)
    function runCommands(cmds, onDone) {
        runProgram({ type: 'sequence', body: Array.isArray(cmds) ? cmds : [] }, onDone);
    }


    // ════════════════════════════════════════════════════════════════
    // DIFFERENTIAL DRIVE – KINEMATICS ENGINE
    // ════════════════════════════════════════════════════════════════

    /**
     * executeDrive
     * ─────────────
     * Both wheels spin at the same speed → straight line.
     * Actual speed = speedPct/100 × MAX_RAD_PER_SEC
     * Stops when the accumulated distance ≥ |distanceCm| × UNIT.
     *
     * Collision: translatory motion is blocked, wheels keep "stalling"
     * until the target distance is logically consumed.
     */
    function executeDrive(distanceCm, speedExpr, onComplete) {
        var targetDist = Math.abs(distanceCm) * UNIT;
        var fwdSign = distanceCm >= 0 ? 1 : -1;   // +1 = forward, -1 = backward

        var distTravelled = 0;
        var startTime = null;
        var stalled = false;   // true once robot has hit obstacle
        var lastTs = null;

        function step(ts) {
            if (!isRunning) return;
            if (!startTime) startTime = ts;
            var elapsed = (ts - startTime) / 1000;  // seconds

            // Dynamic speed update
            var currentSpeedPct = typeof speedExpr === 'number' ? speedExpr : evalExpr(speedExpr);
            var targetOmega = (currentSpeedPct / 100) * MAX_RAD_PER_SEC() * fwdSign;

            // Acceleration ramp: ease up to target omega
            var ramp = Math.min(elapsed / RAMP_TIME, 1.0);
            var omegaEff = targetOmega * ramp;

            // Apply ramp (slope) speed modulation ONLY when actually on ramp (along >= 0)
            var rampState = getRampState(robotState.x, robotState.z, robotState.theta);
            if (rampState.onRamp) {
                omegaEff *= rampState.speedFactor;

                // HARD MODE: Apply gravity resistance on slopes.
                // g * sin(angle) ≈ deceleration force the motor must fight.
                // On a ~20° ramp this subtracts roughly 30% of the motor's power.
                if (window.SIM_HARD_MODE) {
                    var G = 9.81 * 0.6; // scaled gravity (units/s²)
                    var gravDecel = G * Math.sin(rampState.slopeAngle || 0.35) * fwdSign;
                    // gravDecel > 0 means gravity helps going downhill, fights going uphill
                    // When going forward (fwdSign=+1) up a ramp omegaEff should be reduced
                    var gravOmegaLoss = gravDecel / WHEEL_RADIUS();
                    omegaEff -= gravOmegaLoss;
                }
            }

            var vL = omegaEff * WHEEL_RADIUS();
            var vR = omegaEff * WHEEL_RADIUS();
            var vTarget = (vL + vR) / 2;

            var v;
            if (window.SIM_HARD_MODE) {
                // HARD MODE: Velocity Inertia – don't jump instantly to target speed.
                // Lerp from current velocity magnitude to target with a time constant.
                var currentV = Math.sqrt(robotState.vx * robotState.vx + robotState.vz * robotState.vz) * fwdSign;
                // Inertia time constant: bigger = slower to accelerate (~0.3s to reach full speed)
                var INERTIA_K = 3.5; // per-second convergence rate
                v = currentV + (vTarget - currentV) * Math.min(1.0, INERTIA_K * 0.016);
            } else {
                v = vTarget;
            }

            // Set the target velocities for the physics engine
            robotState.vx = v * (-Math.sin(robotState.theta));
            robotState.vz = v * (-Math.cos(robotState.theta));
            robotState.vw = 0; // driving straight

            if (isNaN(v)) {
                console.error('[MissionSim3D] NaN detected in executeDrive! speedExpr:', speedExpr, 'pct:', currentSpeedPct, 'omegaEff:', omegaEff, 'targetOmega:', targetOmega);
            }

            // Robust dt calculation:
            if (!lastTs) lastTs = ts;
            var dt = (ts - lastTs) / 1000;
            lastTs = ts;
            if (dt > 0.1) dt = 0.1;
            if (dt <= 0) dt = 0.016;

            // Accumulate logical distance (even if physics is blocked, motors keep "trying")
            var distStep = Math.abs(v * dt);
            distTravelled += distStep;

            // Spin wheels (visual – always, even when stalled)
            robotState.wheelPosL += omegaEff * dt;
            robotState.wheelPosR += omegaEff * dt;

            // Update robotState.omegaL/R for visual wheel spin based on effective speed
            robotState.omegaL = omegaEff;
            robotState.omegaR = omegaEff;

            // PREDICTIVE STOP: Calculate how much further we will roll if we stop pushing NOW.
            // Under friction a = -v * f, stop distance is s = v / f.
            var stopDist = Math.abs(v / GROUND_FRICTION);

            if (distTravelled + stopDist >= targetDist) {
                // Let the physics engine handle the slow down by just stopping active pushing
                robotState.omegaL = 0;
                robotState.omegaR = 0;
                distTravelled = targetDist; // Ensure it reaches the goal for logging/completion
                console.log('[MissionSim3D] Drive complete. dist=' + (distTravelled / UNIT).toFixed(1) + 'cm');
                onComplete();
            } else {
                requestAnimationFrame(step);
            }
        }

        requestAnimationFrame(step);
    }


    /**
     * executeTurn
     * ─────────────
     * Left and right wheels spin in opposite directions → in-place rotation
     * (pivot turn – same as EV3's "turn" command with both wheels).
     *
     *   Right turn (degrees > 0):  omegaL = +ω, omegaR = -ω
     *   Left  turn (degrees < 0):  omegaL = -ω, omegaR = +ω
     *
     * Stops when |Δθ| ≥ |targetRad|.
     */
    function executeTurn(degrees, speedExpr, onComplete) {
        var targetRad = Math.abs(degrees) * DEG_TO_RAD;
        var turnSign = degrees >= 0 ? 1 : -1;   // +1 = right, -1 = left

        var angleAccum = 0;
        var startTime = null;
        var stalled = false;
        var lastTs = null;

        function step(ts) {
            if (!isRunning) return;
            if (!startTime) startTime = ts;
            var elapsed = (ts - startTime) / 1000;

            // Dynamic speed update
            var currentSpeedPct = typeof speedExpr === 'number' ? speedExpr : evalExpr(speedExpr);
            var omegaBase = (currentSpeedPct / 100) * MAX_RAD_PER_SEC();

            // Ramp
            var ramp = Math.min(elapsed / RAMP_TIME, 1.0);
            var omegaEff = omegaBase * ramp;

            // Robust dt calculation:
            if (!lastTs) lastTs = ts;
            var dt = (ts - lastTs) / 1000;
            lastTs = ts;
            if (dt > 0.1) dt = 0.1;
            if (dt <= 0) dt = 0.016;

            // Differential drive angular rate:
            var omegaRobot = (-2 * omegaEff * turnSign * WHEEL_RADIUS()) / WHEEL_BASE();

            // Set the target angular velocity for the physics engine
            robotState.vw = omegaRobot;
            robotState.vx = 0;
            robotState.vz = 0;
            // Signal to physicsStep that motors are active (for friction bypass)
            robotState.omegaL = omegaEff * turnSign;
            robotState.omegaR = -omegaEff * turnSign;

            angleAccum += Math.abs(omegaRobot * dt);

            // Wheel visual spin (opposite directions)
            robotState.wheelPosL += omegaEff * turnSign * dt;
            robotState.wheelPosR += omegaEff * -turnSign * dt;

            // (physicsStep handles mesh sync – no applyRobotPose() needed here)

            // PREDICTIVE STOP: Calculate how much further we will rotate if we stop pushing NOW.
            var stopAngle = Math.abs(omegaRobot / GROUND_FRICTION);

            if (angleAccum + stopAngle >= targetRad) {
                robotState.omegaL = 0;
                robotState.omegaR = 0;
                console.log('[MissionSim3D] Turn complete. angle=' + (angleAccum * 180 / Math.PI).toFixed(1) + '° stalled=' + stalled);
                onComplete();
            } else {
                requestAnimationFrame(step);
            }
        }

        requestAnimationFrame(step);
    }


    // ════════════════════════════════════════════════════════════════
    // SENSOR SIMULATION
    // ════════════════════════════════════════════════════════════════
    var sensorRaycaster = new THREE.Raycaster();
    // Conversion: Three.js units → centimeters.  1 unit = 1/UNIT cm = ~6.67 cm
    var UNITS_TO_CM = 1 / UNIT;
    var sensorHud = null;  // DOM element for live sensor display

    function initSensorHud() {
        sensorHud = document.createElement('div');
        sensorHud.style.cssText = [
            'position:absolute', 'bottom:8px', 'left:8px',
            'background:rgba(0,0,0,0.55)', 'color:#a0c4ff',
            'font:11px/1.5 monospace', 'padding:4px 8px',
            'border-radius:6px', 'pointer-events:none',
            'white-space:pre', 'z-index:20'
        ].join(';');
        container.style.position = 'relative';
        container.appendChild(sensorHud);
    }

    function updateSensors() {
        if (!robot || !scene) return;
        var theta = robotState.theta;

        // ── Ultrasonic (front-facing raycaster) ─────────────────
        var sinT = Math.sin(theta), cosT = Math.cos(theta);
        var originUS = new THREE.Vector3(
            robotState.x,
            robot.position.y + 1.3,  // height of ultrasonic sensor on robot
            robotState.z
        );
        var dirUS = new THREE.Vector3(-sinT, 0, -cosT).normalize();
        sensorRaycaster.set(originUS, dirUS);
        sensorRaycaster.far = 255 / UNITS_TO_CM;  // max 255 cm

        // Intersect with world object meshes
        var wMeshes = worldObjects.map(function (o) { return o.mesh; });
        var hits = sensorRaycaster.intersectObjects(wMeshes, true);
        if (hits.length > 0) {
            var rawDist = hits[0].distance * UNITS_TO_CM;
            // Realism: Ultrasonic Sensor Noise (1.0% to 1.5% random variance)
            var noiseFactor = 1.0 + (Math.random() * 0.03 - 0.015);
            robotState.sensors.ultrasonic = Math.round(rawDist * noiseFactor);
        } else {
            robotState.sensors.ultrasonic = 255;  // no object in range
        }

        // ── Color sensor (downward raycaster) ──────────────────
        // Detect green target rings
        var originCS = new THREE.Vector3(robotState.x, robot.position.y + 0.18, robotState.z);
        var dirCS = new THREE.Vector3(0, -1, 0);
        sensorRaycaster.set(originCS, dirCS);
        sensorRaycaster.far = 2.0;
        var csHits = sensorRaycaster.intersectObjects(scene.children, true);
        robotState.sensors.color = 'none';
        for (var ci = 0; ci < csHits.length; ci++) {
            var hitObj = csHits[ci].object;
            if (!hitObj.material) continue;
            var col = hitObj.material.color;
            if (!col) continue;
            // Green ring → 'green', floor grid → 'black'
            if (col.r < 0.2 && col.g > 0.5 && col.b < 0.3) {
                robotState.sensors.color = 'green'; break;
            } else if (col.r < 0.15 && col.g < 0.2 && col.b < 0.25) {
                robotState.sensors.color = 'black'; break;
            } else {
                robotState.sensors.color = 'none'; break;
            }
        }

        // ── Touch / Bumper (would-next-step collide?) ────────────
        var bump = 0.5;  // look ahead 0.5 units
        var nextX = robotState.x + bump * (-sinT);
        var nextZ = robotState.z + bump * (-cosT);
        robotState.sensors.touch = collidesAt(nextX, nextZ);

        // ── HUD update ─────────────────────────────────────────
        if (sensorHud) {
            sensorHud.textContent =
                '🔊 Abstand: ' + robotState.sensors.ultrasonic + ' cm\n' +
                '🎨 Farbe:   ' + robotState.sensors.color + '\n' +
                '👋 Taster:  ' + (robotState.sensors.touch ? 'JA' : 'nein');
        }
    }

    // ════════════════════════════════════════════════════════════════
    // RENDER LOOP
    // ════════════════════════════════════════════════════════════════
    var clock = new THREE.Clock();

    // ── PHYSICS INTEGRATOR (Cannon-es) ─────────────────────────────
    function physicsStep(dt) {
        if (!robot || !scene || !cannonWorld || !robotBody) return;

        // NOTE: Hard Mode effects are applied in executeDrive (inertia, slope gravity)
        // and below (friction decay, sliding on ramps). There is no separate code path
        // here for Hard Mode since both modes share the same Kinematic body pipeline.

        var isActivelyDriving = isRunning && (Math.abs(robotState.omegaL) > 0.01 || Math.abs(robotState.omegaR) > 0.01);

        if (!isActivelyDriving) {
            // HARD MODE: More friction drift = slower decay = longer slide
            var GROUND_FRICTION_DECAY = window.SIM_HARD_MODE ? 1.8 : 4.0;
            robotState.vx -= robotState.vx * GROUND_FRICTION_DECAY * dt;
            robotState.vz -= robotState.vz * GROUND_FRICTION_DECAY * dt;
            robotState.vw -= robotState.vw * GROUND_FRICTION_DECAY * dt;
            if (Math.abs(robotState.vx) < 0.04) { robotState.vx = 0; robotState.vz = 0; }
            if (Math.abs(robotState.vw) < 0.02) robotState.vw = 0;

            // HARD MODE: If coasting on a slope, apply gravitational slide downhill
            if (window.SIM_HARD_MODE) {
                var rampSlide = getRampState(robotState.x, robotState.z, robotState.theta);
                if (rampSlide.onRamp && rampSlide.slopeAngle > 0.1) {
                    var slideSpeed = 9.81 * 0.35 * Math.sin(rampSlide.slopeAngle) * dt;
                    // dirX/dirZ points uphill; sliding goes in the opposite direction
                    robotState.vx -= rampSlide.dirX * slideSpeed;
                    robotState.vz -= rampSlide.dirZ * slideSpeed;
                }
            }
        }

        // ── Position integration with collidesAt sliding ───────────────────
        var newX = robotState.x + robotState.vx * dt;
        var newZ = robotState.z + robotState.vz * dt;
        var newTheta = robotState.theta + robotState.vw * dt;

        if (isNaN(newX) || isNaN(newZ)) {
            console.error('[MissionSim3D] NaN detected in physicsStep! x:', robotState.x, 'vx:', robotState.vx, 'dt:', dt, 'omegaL:', robotState.omegaL, 'omegaR:', robotState.omegaR);
        }

        if (!collidesAt(newX, newZ, newTheta)) {
            robotState.x = newX;
            robotState.z = newZ;
        } else {
            // Sliding: try X-axis alone, then Z-axis alone
            if (!collidesAt(newX, robotState.z, newTheta)) {
                robotState.x = newX;
                robotState.vz = 0;
            } else if (!collidesAt(robotState.x, newZ, newTheta)) {
                robotState.z = newZ;
                robotState.vx = 0;
            } else {
                robotState.vx = 0;
                robotState.vz = 0;
            }

            // Realism: Asymmetric Collision Torque (Spin-out)
            var isPushingForward = isRunning && (robotState.omegaL > 0.01 || robotState.omegaR > 0.01);
            if (isPushingForward) {
                if (lastHitLocalX > 0.4) {
                    robotState.vw += 4.5 * dt;
                } else if (lastHitLocalX < -0.4) {
                    robotState.vw -= 4.5 * dt;
                }
            }
        }
        robotState.theta = newTheta;

        // ── Sync Cannon body to manual position (passively) ────────────────
        if (robotBody && !window.SIM_HARD_MODE) {
            robotBody.position.x = robotState.x;
            robotBody.position.z = robotState.z;
            robotBody.velocity.set(robotState.vx, 0, robotState.vz);
            robotBody.quaternion.setFromEuler(0, robotState.theta, 0);
            if (cannonWorld) cannonWorld.fixedStep(1 / 60, dt);
        }

        // ══════════════════════════════════════════════════════════════
        // 3-POINT CONTACT PHYSICS
        // ══════════════════════════════════════════════════════════════
        // Uses ANALYTICAL ramp heights (no AABB flicker) at the 3 wheel
        // contact positions, then fits a plane through them to get:
        //   (a) the robot's body Y  — via plane equation, NO max-clamping
        //   (b) the surface normal  — via cross product (correctly captures
        //       lateral tilt when straddling a ramp)
        // Additionally: if the resulting lateral tilt exceeds the robot's
        // stability limit (~35°), a smooth tip-over animation is triggered.

        var cosA = Math.cos(robotState.theta);
        var sinA = Math.sin(robotState.theta);

        var HW = activeProfile.trackHalfWidth;
        var WZ = activeProfile.wheelZOffset;
        var CZ = activeProfile.frontContactZ;
        // Placing the 3rd contact ahead lets the 3-point plane
        // detect the ramp slope BEFORE the wheels reach it,
        // naturally tilting the robot nose-up so the body mesh
        // doesn't clip into the ramp wedge.

        // Analytical ramp height at any XZ position (no AABB boundary issues)
        function heightAt(x, z) {
            for (var ri = 0; ri < ramps.length; ri++) {
                var r = ramps[ri];
                var relX = x - r.x0, relZ = z - r.z0;
                var along = relX * r.dirX + relZ * r.dirZ;
                var perp = relX * r.perpX + relZ * r.perpZ;
                // Use 0.05 padding - enough lookahead to prevent clipping, 
                // but small enough to avoid floating "air-walk".
                if (along >= -0.05 && along <= r.len + 0.05 && Math.abs(perp) <= r.width / 2 + 0.05) {
                    var t = Math.max(0, Math.min(1, along / r.len));
                    return r.y0 + t * (r.y1 - r.y0);
                }
            }
            // Platform tops
            for (var oi = 0; oi < obstacles.length; oi++) {
                var o = obstacles[oi];
                if (o._rampOwner || o._rampSide || o._platformSide || o._platformBase) continue;
                if (x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ) {
                    var oY = o.maxY || 0;
                    if (oY > 0 && oY <= robot.position.y + 0.8) return oY;
                }
            }
            return 0;
        }

        // 3 contact point world positions
        var lX = robotState.x + cosA * (-HW) + sinA * WZ;
        var lZ = robotState.z - sinA * (-HW) + cosA * WZ;
        var rX = robotState.x + cosA * HW + sinA * WZ;
        var rZ = robotState.z - sinA * HW + cosA * WZ;
        var cX = robotState.x + sinA * CZ;
        var cZ = robotState.z + cosA * CZ;

        // Analytical heights at contact points + body center for safety
        var yL = heightAt(lX, lZ);
        var yR = heightAt(rX, rZ);
        var yC = heightAt(cX, cZ);
        var yBody = heightAt(robotState.x, robotState.z);

        // ── Surface normal via cross-product of the 3 contact triangle ──
        // vA = Right wheel relative to Left wheel
        // vB = Caster relative to Left wheel
        var vAx = rX - lX, vAy = yR - yL, vAz = rZ - lZ;
        var vBx = cX - lX, vBy = yC - yL, vBz = cZ - lZ;
        // normal = vA × vB
        var nx = vAy * vBz - vAz * vBy;
        var ny = vAz * vBx - vAx * vBz;
        var nz = vAx * vBy - vAy * vBx;
        var nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (nLen > 0.001) { nx /= nLen; ny /= nLen; nz /= nLen; }
        else { nx = 0; ny = 1; nz = 0; }
        if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }  // always point up

        // ── Body Y from plane equation through (lX, yL, lZ) ──────────
        // Plane: nx*(X-lX) + ny*(Y-yL) + nz*(Z-lZ) = 0
        // → Y = yL + (-nx*(mx-lX) - nz*(mz-lZ)) / ny
        var targetBodyY = (yL + yR) / 2;  // fallback: axle mid-height
        if (Math.abs(ny) > 0.05) {
            targetBodyY = yL + (-nx * (robotState.x - lX) - nz * (robotState.z - lZ)) / ny;
        }
        // Clamp: body centre must sit at or above the floor directly beneath it
        // and also above the average of its 3 contact points.
        var minSafeY = Math.max(0, yBody, (yL + yR + yC) / 3 - 0.2);
        if (targetBodyY < minSafeY) targetBodyY = minSafeY;

        // (Nose-lift hack removed – the front contact point (CZ < 0) now
        //  naturally tilts the robot when approaching a ramp, preventing
        //  clipping into the wedge without causing floating.)

        // ── Gravity / Falling ─────────────────────────────────────────
        if (robot.position.y > targetBodyY + 0.05 && !robotState.isTipping) {
            robotState.isFalling = true;
            robotState.vy -= 15.0 * dt; // slightly stronger gravity for snappier falls
            robot.position.y += robotState.vy * dt;
            if (robot.position.y <= targetBodyY) {
                robot.position.y = targetBodyY;
                robotState.vy = 0;
                robotState.isFalling = false;
            }
        } else if (!robotState.isTipping) {
            robotState.isFalling = false;
            robotState.vy = 0;
            robot.position.y = targetBodyY;
        }

        // ── Orientation alignment ─────────────────────────────────────
        // Clamp the surface normal: maximum tilt of 35° from vertical.
        // This prevents the sinking/inversion bugs while still showing
        // realistic lateral and longitudinal tilt on ramps.
        var MAX_TILT = 0.61;  // 35 degrees in radians
        var tiltAngle = Math.acos(Math.max(0.001, Math.min(1, ny)));
        if (tiltAngle > MAX_TILT) {
            // Scale normal back so tilt = MAX_TILT
            var scale = Math.sin(MAX_TILT) / Math.sqrt(nx * nx + nz * nz + 0.0001);
            nx *= scale; nz *= scale;
            ny = Math.cos(MAX_TILT);
        }

        var upN = new THREE.Vector3(nx, ny, nz).normalize();
        var fwdH = new THREE.Vector3(-sinA, 0, -cosA);
        var rightV = new THREE.Vector3().crossVectors(fwdH, upN).normalize();
        if (rightV.lengthSq() < 0.001) rightV.set(cosA, 0, -sinA);
        var trueF = new THREE.Vector3().crossVectors(upN, rightV).normalize();

        var m = new THREE.Matrix4();
        m.makeBasis(rightV, upN, trueF.clone().negate());
        var targetQ = new THREE.Quaternion().setFromRotationMatrix(m);

        // Rate-limit: max 6°/frame to prevent oscillation, min snap for smoothness
        var MAX_RAD_PER_FRAME = 6.0 * (Math.PI / 180);
        var qAngle = robot.quaternion.angleTo(targetQ);
        var slerpT = (qAngle > 0.001) ? Math.min(1.0, MAX_RAD_PER_FRAME / qAngle) : 1.0;
        robot.quaternion.slerp(targetQ, slerpT);

        // ── Three.js mesh sync ──────────────────────────────────────────
        robot.position.x = robotState.x;
        robot.position.z = robotState.z;
    }

    function animate() {
        animId = requestAnimationFrame(animate);

        var dt = clock.getDelta();
        if (dt > 0.1) dt = 0.1;

        // Apply continuous physics (momentum, gravity, collision resolution)
        physicsStep(dt);

        // Update virtual sensors every frame
        updateSensors();

        // Update robot visual mesh (elevation, tilt, and wheel spin)
        applyRobotPose();

        // Idle LED pulse
        if (robot && robot.userData.led) {
            var t = Date.now() * 0.002;
            robot.userData.led.material.emissiveIntensity = 0.3 + 0.3 * Math.sin(t);
        }

        if (renderer && scene && camera) {
            // Apply Orbit Camera (targeting the robot or center)
            var targetX = robot ? robot.position.x : 0;
            var targetY = robot ? robot.position.y : 0;
            var targetZ = robot ? robot.position.z : 0;

            camera.position.x = targetX + camRadius * Math.sin(camAngleY) * Math.sin(camAngleX);
            camera.position.y = targetY + camRadius * Math.cos(camAngleY);
            camera.position.z = targetZ + camRadius * Math.sin(camAngleY) * Math.cos(camAngleX);

            camera.lookAt(targetX, targetY, targetZ);

            renderer.render(scene, camera);
        }
    }

    function onResize() {
        if (!container || !camera || !renderer) return;
        var W = container.clientWidth;
        var H = container.clientHeight;
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        renderer.setSize(W, H);
    }


    // ════════════════════════════════════════════════════════════════
    // WORLD BUILDER HELPERS
    // ════════════════════════════════════════════════════════════════

    function snapGrid(v) { return Math.round(v * 2) / 2; }  // snap to 0.5 grid

    function checkOverlap(a, b) {
        if (!a || !b) return false;
        // Strict overlap (edge-to-edge touching is allowed)
        return (a.maxX > b.minX && a.minX < b.maxX &&
            a.maxZ > b.minZ && a.minZ < b.maxZ);
    }

    function getFootprint(record, cx, cz) {
        if (!record) return null;
        if (record.type === 'robot') {
            return { minX: cx - ROBOT_HW(), maxX: cx + ROBOT_HW(), minZ: cz - ROBOT_HD(), maxZ: cz + ROBOT_HD() };
        } else if (record.type === 'ramp') {
            // Ramps span from cz-3 to cz+3 (len 6) and width 4.5
            var w = 4.5, d = 6.0;
            return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
        } else if (record.type === 'platform') {
            // Platform dims are stored in the record (default 4.5 x 5.0)
            var w = record.dims ? record.dims.w : 4.5;
            var d = record.dims ? record.dims.d : 5.0;
            return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
        }
        return null;
    }

    /**
     * Spawn a draggable obstacle box at (x, z) in world space.
     */
    /**
     * Spawn a platform obstacle: same width (4.5) and height (2.2) as a ramp so the
     * robot can drive up a ramp and onto the platform seamlessly.
     */
    function spawnObstacle(x, z) {
        x = x !== undefined ? x : 8;
        z = z !== undefined ? z : 0;
        var RAMP_W = 4.5, RAMP_H = 2.2, PLATFORM_D = 5.0;
        var result = addPlatform(x, z, RAMP_W, PLATFORM_D, RAMP_H);
        // Tag all new side-wall records so they can be relocated on drag-drop
        var woRecord = {
            mesh: result.mesh, type: 'platform', physicsData: result.physicsRec,
            dims: { w: RAMP_W, d: PLATFORM_D, h: RAMP_H }
        };
        // Re-tag newly added obstacles and the ramp record
        for (var i = obstacles.length - 5; i < obstacles.length; i++) {
            if (obstacles[i]) obstacles[i]._platformOwner = woRecord;
        }
        for (var ri = ramps.length - 1; ri >= 0; ri--) {
            if (ramps[ri]._platform) { ramps[ri]._platformOwner = woRecord; break; }
        }
        worldObjects.push(woRecord);
        console.log('[WorldBuilder] Platform spawned at', x, z);
    }

    /**
     * Spawn a ramp.
     * type = 'up'   → foot at +Z side (cz+3), peak at -Z side (cz-3)  (robot approaches from +Z)
     * type = 'down' → peak at +Z side (cz+3), foot at -Z side (cz-3)  (robot approaches from +Z)
     */
    function spawnRamp(cx, cz, type) {
        // Both ramp types spawn centered at X=0 (directly in the robot's path)
        cx = cx !== undefined ? cx : 0;
        cz = cz !== undefined ? cz : -5;
        var cfg;
        if (type === 'down') {
            // Robot enters at ground level (entry y0=0 at z0=cz+3) and descends
            // to a lower point — we simulate descent from a raised floor to ground.
            // Since the world floor is at y=0, we invert: entry is high end,
            // robot comes from +Z direction (z=8) and goes -Z:
            // z0=cz+3 (entry, high y=2.2 → robot must be ON a platform to start)
            // For simplicity: same as up-ramp but mirrored → y0=2.2, y1=0 going -Z
            cfg = { x0: cx, y0: 2.2, z0: cz + 3, x1: cx, y1: 0, z1: cz - 3, width: 4.5 };
        } else {
            // Default 'up' – starts low at entry (z0=cz+3 nearest robot), ends high
            cfg = { x0: cx, y0: 0, z0: cz + 3, x1: cx, y1: 2.2, z1: cz - 3, width: 4.5 };
        }
        var mesh = addRamp(cfg);
        var physRec = ramps[ramps.length - 1];
        worldObjects.push({ mesh: mesh, type: 'ramp', physicsData: physRec });
        console.log('[WorldBuilder] Ramp (' + (type || 'up') + ') spawned at cx=' + cx + ' cz=' + cz);
    }

    /**
     * Spawn a draggable target ring at (x, z).
     */
    function spawnTarget(x, z) {
        x = x !== undefined ? x : 0;
        z = z !== undefined ? z : -15;

        // Build a simple group so we can drag it as one object
        var group = new THREE.Group();
        group.position.set(x, 0, z);

        var ringGeo = new THREE.RingGeometry(1.5, 2.2, 24);
        var ringMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
        var ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;
        group.add(ring);

        var fillGeo = new THREE.CircleGeometry(1.4, 24);
        var fillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
        var fill = new THREE.Mesh(fillGeo, fillMat);
        fill.rotation.x = -Math.PI / 2;
        fill.position.y = 0.05;
        group.add(fill);

        scene.add(group);
        worldObjects.push({ mesh: group, type: 'target', physicsData: null });
        console.log('[WorldBuilder] Target spawned at', x, z);
    }

    function spawnLineTile() {
        var zPos = robot ? robotState.z - 8 : -8;
        addLineTile(0, zPos, 0);
        console.log('[WorldBuilder] LineTile spawned');
    }

    function spawnCurveTile() {
        var zPos = robot ? robotState.z - 8 : -8;
        addCurveTile(0, zPos, 0);
        console.log('[WorldBuilder] CurveTile spawned');
    }

    function spawnIntersectionTile() {
        var zPos = robot ? robotState.z - 8 : -8;
        addIntersectionTile(0, zPos, 0);
        console.log('[WorldBuilder] IntersectionTile spawned');
    }

    function spawnGreenMarker() {
        var zPos = robot ? robotState.z - 8 : -8;
        addGreenMarker(0, zPos, 0);
        console.log('[WorldBuilder] GreenMarker spawned');
    }

    /**
     * Remove all user-placed world objects (obstacles, ramps, targets).
     * Does NOT reset the robot.
     */
    function clearWorldObjects() {
        for (var i = 0; i < worldObjects.length; i++) {
            scene.remove(worldObjects[i].mesh);
        }
        worldObjects = [];
        // Remove from legacy physics arrays
        obstacles = [];
        ramps = [];
        // Remove Cannon static bodies (keep ground + robot body)
        if (cannonWorld) {
            for (var bi = 0; bi < staticBodies.length; bi++) {
                cannonWorld.removeBody(staticBodies[bi]);
            }
        }
        staticBodies = [];
        console.log('[WorldBuilder] All world objects cleared.');
    }

    /**
     * Change the active robot profile and rebuild the robot mesh/physics.
     */
    function setRobotProfile(profileId) {
        if (!ROBOT_PROFILES[profileId]) {
            console.error('Unknown robot profile:', profileId);
            return;
        }

        activeProfile = ROBOT_PROFILES[profileId];
        console.log('[MissionSim3D] Switched to robot profile:', activeProfile.name);

        // 1. Remove old robot mesh
        if (robot && scene) {
            scene.remove(robot);
        }

        // 2. Build new robot mesh
        if (activeProfile.buildFn === 'buildSpikePrimeRobot') robot = buildSpikePrimeRobot();
        else if (activeProfile.buildFn === 'buildCustomBot') robot = buildCustomBot();
        else if (activeProfile.buildFn === 'buildMBotRobot') robot = buildMBotRobot();
        else if (activeProfile.buildFn === 'buildEdisonRobot') robot = buildEdisonRobot();
        else robot = buildEV3Robot();

        if (scene) {
            scene.add(robot);
            applyRobotPose();
        }

        // 3. Update Physics Body
        if (cannonWorld && robotBody) {
            cannonWorld.removeBody(robotBody);

            robotBody = new CANNON.Body({
                mass: window.SIM_HARD_MODE ? 5.0 : 0,
                // Match mesh height (0.6 half-extent for 1.2 total height)
                shape: new CANNON.Box(new CANNON.Vec3(ROBOT_HW(), 0.6, ROBOT_HD())),
                position: new CANNON.Vec3(robotState.x, 1.0, robotState.z)
            });
            // Fixed rotation in easy mode
            if (!window.SIM_HARD_MODE) {
                robotBody.angularFactor.set(0, 1, 0);
            }
            cannonWorld.addBody(robotBody);
        }
    }


    // ════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════════════════
    window.__GET_ROBOT_STATE__ = function () { return robotState; };

    return {
        init: init,
        reset: reset,
        runProgram: runProgram,
        runCommands: runCommands,
        stop: stop,
        clearWorldObjects: clearWorldObjects,
        setRobotProfile: setRobotProfile,
        // -- EXPOSED FOR AUTOMATED TESTING / UI --
        addRamp: addRamp,
        addPlatform: addPlatform,
        spawnRamp: spawnRamp,
        spawnObstacle: spawnObstacle,
        spawnTarget: spawnTarget,
        spawnLineTile: spawnLineTile,
        spawnCurveTile: spawnCurveTile,
        spawnIntersectionTile: spawnIntersectionTile,
        spawnGreenMarker: spawnGreenMarker,
        get robotState() { return robotState; },
        get worldObjects() { return worldObjects; },
        get obstacles() { return obstacles; },
        get ramps() { return ramps; }
    };
})();
