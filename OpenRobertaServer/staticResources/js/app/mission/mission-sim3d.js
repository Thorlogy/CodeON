/**
 * mission-sim3d.js  –  v2: Differential-Drive Kinematics
 * ──────────────────────────────────────────────────────
 *
 * Physics model: Differential-Drive robot (like a real LEGO EV3)
 *
 *   Each frame (dt seconds):
 *     vL = ωL × WHEEL_RADIUS          (left wheel linear speed)
 *     vR = ωR × WHEEL_RADIUS          (right wheel linear speed)
 *     v     = (vL + vR) / 2           (robot center linear speed)
 *     omega = (vR - vL) / WHEEL_BASE  (angular rate, rad/s)
 *     x     += v × (-sin θ) × dt
 *     z     += v × (-cos θ) × dt
 *     θ     += omega × dt
 *
 * EV3 reference values:
 *   WHEEL_RADIUS  = 0.028 m  (56 mm diameter, large LEGO tire, Three.js units)
 *   WHEEL_BASE    = 0.115 m  (axle distance ≈ 11.5 cm)
 *   MAX_RAD_PER_SEC = 17.8  (170 rpm ≈ 17.8 rad/s → 100% speed)
 *
 * Backup of v1 (keyframe interpolation) is:
 *   mission-sim3d.v1-keyframe.js
 *
 * See PHYSICS_README.md for full documentation.
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

    // ── EV3 Physical Constants ───────────────────────────────────────
    var WHEEL_RADIUS = 0.95;   // Three.js units (≈ 6.3 cm radius in scene scale)
    var WHEEL_BASE = 3.16;   // Three.js units (≈ 11.5 cm in scene scale)
    var MAX_RAD_PER_SEC = 5.5;    // rad/s at 100% speed (tuned for visible motion)
    var RAMP_TIME = 0.25;   // seconds to reach full speed (motor acceleration)

    // ── Robot dynamics state ─────────────────────────────────────────
    var robotState = {
        x: 0, z: 0, theta: 0,   // pose (Three.js units + radians)
        omegaL: 0,               // left  wheel angular velocity (rad/s)
        omegaR: 0,               // right wheel angular velocity (rad/s)
        wheelPosL: 0,            // accumulated wheel angle for visual spin
        wheelPosR: 0
    };

    // ── Obstacles ────────────────────────────────────────────────────
    var obstacles = [];
    var ROBOT_HW = 1.35;   // robot half-width  (collision box X)
    var ROBOT_HD = 1.8;    // robot half-depth  (collision box Z)

    // ── Ramps ─────────────────────────────────────────────────────────
    // Each ramp: { x0,z0=foot,  x1,z1=top,  height, width, slopeAngle,
    //              dirX, dirZ,  len,  perpX, perpZ }
    var ramps = [];

    // Track dynamically added objects to clear them on reset
    var dynamicMeshes = [];

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
            lastMousePos = { x: e.clientX, y: e.clientY };
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
                    dragObject.mesh.position.x = newX;
                    dragObject.mesh.position.z = newZ;
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
                } else if (dragObject.type === 'obstacle' && dragObject.physicsData) {
                    var p = dragObject.physicsData;
                    var hw = (p.maxX - p.minX) / 2;
                    var hd = (p.maxZ - p.minZ) / 2;
                    p.minX = m.position.x - hw;
                    p.maxX = m.position.x + hw;
                    p.minZ = m.position.z - hd;
                    p.maxZ = m.position.z + hd;
                } else if (dragObject.type === 'ramp' && dragObject.physicsData) {
                    var pd = dragObject.physicsData;
                    var ddx = m.position.x - (pd.x0 + pd.x1) / 2;
                    var ddz = m.position.z - (pd.z0 + pd.z1) / 2;
                    pd.x0 += ddx; pd.x1 += ddx;
                    pd.z0 += ddz; pd.z1 += ddz;
                }
                isDraggingObject = false;
                dragObject = null;
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
        var floorGeo = new THREE.PlaneGeometry(80, 80);
        var floorMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        var floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        var grid = new THREE.GridHelper(80, 40, 0x334466, 0x222f44);
        grid.position.y = 0.01;
        scene.add(grid);

        // ── Robot ──────────────────────────────────────────────────
        robot = buildEV3Robot();
        scene.add(robot);
        applyRobotPose();

        // ── World objects ──────────────────────────────────────────
        addTarget(0, -18, 0x22c55e);    // green ring further back

        // Use the initial load objects simply as defaults (though now they can be empty!)
        // I will leave an example ramp for testing, but they will be overridable by code soon
        // addRamp({ x0: 0, y0: 0, z0: -3, x1: 0, y1: 2.2, z1: -9, width: 4.5 }); // Up
        // addRamp({ x0: 0, y0: 2.2, z0: -9, x1: 0, y1: 2.2, z1: -14, width: 4.5 }); // Flat
        // addRamp({ x0: 0, y0: 2.2, z0: -14, x1: 0, y1: 0, z1: -20, width: 4.5 }); // Down

        // ── Render loop ────────────────────────────────────────────
        clock = new THREE.Clock();
        animate();

        window.addEventListener('resize', onResize);
        console.log('[MissionSim3D] Initialized (v2 Differential Drive)');
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

        return group;
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

        obstacles.push({
            minX: x - w / 2, maxX: x + w / 2,
            minZ: z - d / 2, maxZ: z + d / 2,
            h: h
        });

        return m;
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
        var surfMat = new THREE.MeshPhongMaterial({ color: 0x4b5563, shininess: 20, side: THREE.DoubleSide });
        var surf = new THREE.Mesh(new THREE.PlaneGeometry(w, hyp, 2, 12), surfMat);
        surf.receiveShadow = surf.castShadow = true;
        var yaw = Math.atan2(dirX, dirZ);
        surf.rotation.order = 'YXZ';
        surf.rotation.y = yaw;
        surf.rotation.x = -Math.PI / 2 - slopeAngle;
        rampGroup.add(surf);

        // ── Yellow edge stripes ──────────────────────────────────
        var stripeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
        [-1, 1].forEach(function (s) {
            var stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, hyp), stripeMat);
            // Parent to the surface so it perfectly matches its rotation and slope
            // The PlaneGeometry is created in the XY plane by default.
            // We just shift it left/right along its local X, and slightly up along its local Z (normal)
            stripe.position.set(s * (w / 2 - 0.1), 0, 0.01);
            surf.add(stripe);
        });

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
        var sideThickness = 0.4;
        [-1, 1].forEach(function (s) {
            // Centre of this side wall in world XZ (midpoint along ramp, offset by +-w/2)
            var cx = (x0 + x1) / 2 + perpX * s * (w / 2);
            var cz = (z0 + z1) / 2 + perpZ * s * (w / 2);
            // Half-extents: along ramp dir = len/2, perp = sideThickness/2
            var hw = Math.abs(dirZ) * len / 2 + Math.abs(perpX) * sideThickness / 2 + 0.3;
            var hd = Math.abs(dirX) * len / 2 + Math.abs(perpZ) * sideThickness / 2 + 0.3;
            obstacles.push({
                minX: cx - hw, maxX: cx + hw,
                minZ: cz - hd, maxZ: cz + hd,
                _rampSide: true   // tag so we can distinguish if needed
            });
        });

        console.log('[MissionSim3D] Ramp added. slope=' + (slopeAngle * 180 / Math.PI).toFixed(1) + '° len=' + len.toFixed(1));
        return rampGroup;
    }

    /**
     * getRampState(x, z, theta) → { onRamp, elevation, slopeAngle, dirX, dirZ, speedFactor }
     * For any world position, returns whether robot is on a ramp and relevant physics data.
     */
    function getRampState(x, z, theta) {
        var activeRamps = [];
        for (var i = 0; i < ramps.length; i++) {
            var r = ramps[i];
            var relX = x - r.x0, relZ = z - r.z0;
            var along = relX * r.dirX + relZ * r.dirZ;
            var perp = relX * r.perpX + relZ * r.perpZ;

            if (along >= -ROBOT_HD && along <= r.len + ROBOT_HD &&
                Math.abs(perp) <= r.width / 2 + 0.2) {
                activeRamps.push({ r: r, along: along });
            }
        }

        if (activeRamps.length === 0) {
            return { onRamp: false, elevation: 0, slopeAngle: 0, speedFactor: 1.0 };
        }

        // Sort by how close 'along' is to the valid surface [0, len]
        activeRamps.sort(function (a, b) {
            var distA = Math.max(0, 0 - a.along, a.along - a.r.len);
            var distB = Math.max(0, 0 - b.along, b.along - b.r.len);
            return distA - distB;
        });

        var best = activeRamps[0];
        var r = best.r;
        var along = best.along;

        var t = Math.max(0, Math.min(along / r.len, 1));
        // We only do smooth entry rounding at boundaries where y=0 to prevent early floating
        if (along < 0 && r.y0 === 0) t = 0;
        if (along > r.len && r.y1 === 0) t = 1;

        var elevation = r.y0 + t * (r.y1 - r.y0);

        var dotFwd = (-Math.sin(theta)) * r.dirX + (-Math.cos(theta)) * r.dirZ;
        var speedFactor = 1.0 - dotFwd * Math.sin(r.slopeAngle) * 0.45;
        speedFactor = Math.max(0.35, Math.min(1.55, speedFactor));

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
        commandQueue = [];
        onDoneCallback = null;

        // Clear dynamic world objects
        for (var i = 0; i < dynamicMeshes.length; i++) {
            scene.remove(dynamicMeshes[i]);
        }
        dynamicMeshes = [];
        // Reset collision maps (keeping targets/permanent bounds if any, but clearing blocks)
        obstacles = [];
        ramps = [];

        applyRobotPose();
        console.log('[MissionSim3D] Reset');
    }

    function applyRobotPose() {
        if (!robot) return;
        robot.position.x = robotState.x;
        robot.position.z = robotState.z;
        robot.rotation.y = robotState.theta;

        // ── Ramp: elevate Y and tilt robot along slope ───────────────────
        var rs = getRampState(robotState.x, robotState.z, robotState.theta);
        robot.position.y = rs.elevation;
        if (rs.onRamp) {
            // Tilt the robot: rotate around its local X-axis (perpendicular to travel)
            // slopeAngle > 0 → nose up, slopeAngle < 0 → nose down
            // dotFwd used to flip sign when going down
            var dotFwd = (-Math.sin(robotState.theta)) * rs.dirX + (-Math.cos(robotState.theta)) * rs.dirZ;
            robot.rotation.x = dotFwd * rs.slopeAngle;
        } else {
            robot.rotation.x = 0;
        }

        if (robot.userData.wheelL) robot.userData.wheelL.rotation.x = robotState.wheelPosL;
        if (robot.userData.wheelR) robot.userData.wheelR.rotation.x = robotState.wheelPosR;
    }


    // ════════════════════════════════════════════════════════════════
    // COLLISION
    // ════════════════════════════════════════════════════════════════
    function collidesAt(x, z, theta) {
        // Check if robot is on a ramp – if so, skip side-wall obstacles for that ramp
        var onAnyRamp = false;
        for (var r = 0; r < ramps.length; r++) {
            var rr = ramps[r];
            var relX = x - rr.x0, relZ = z - rr.z0;
            var along = relX * rr.dirX + relZ * rr.dirZ;
            var perp = relX * rr.perpX + relZ * rr.perpZ;
            if (along >= -ROBOT_HD && along <= rr.len + ROBOT_HD && Math.abs(perp) <= rr.width / 2 + 0.3) {
                onAnyRamp = true;
                break;
            }
        }

        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            // Skip ramp side-walls while robot is travelling on the ramp surface
            if (o._rampSide && onAnyRamp) continue;
            if (x + ROBOT_HW > o.minX && x - ROBOT_HW < o.maxX &&
                z + ROBOT_HD > o.minZ && z - ROBOT_HD < o.maxZ) {
                return true;
            }
        }
        return false;
    }


    // ════════════════════════════════════════════════════════════════
    // COMMAND QUEUE
    // ════════════════════════════════════════════════════════════════
    function runCommands(cmds, onDone) {
        if (!cmds || cmds.length === 0) {
            if (onDone) onDone();
            return;
        }
        stop();
        commandQueue = cmds.slice();
        onDoneCallback = onDone || null;
        isRunning = true;
        executeNextCommand();
    }

    function stop() {
        isRunning = false;
        robotState.omegaL = 0;
        robotState.omegaR = 0;
    }

    function executeNextCommand() {
        if (!isRunning || commandQueue.length === 0) {
            isRunning = false;
            robotState.omegaL = 0;
            robotState.omegaR = 0;
            if (onDoneCallback) {
                onDoneCallback();
                onDoneCallback = null;
            }
            return;
        }

        var cmd = commandQueue.shift();
        console.log('[MissionSim3D] Executing:', cmd);

        if (cmd.type === 'build_ramp') {
            var rMesh = addRamp(cmd);
            dynamicMeshes.push(rMesh);
            executeNextCommand();
            return;
        }

        if (cmd.type === 'build_obstacle') {
            var oMesh = addObstacle(cmd.x, cmd.z, cmd.w, cmd.d, cmd.h, cmd.color);
            dynamicMeshes.push(oMesh);
            executeNextCommand();
            return;
        }

        if (cmd.type === 'drive') {
            executeDrive(cmd.distance, cmd.speed, executeNextCommand);
        } else if (cmd.type === 'turn') {
            executeTurn(cmd.degrees, cmd.speed, executeNextCommand);
        } else if (cmd.type === 'stop') {
            robotState.omegaL = 0;
            robotState.omegaR = 0;
            executeNextCommand();
        } else if (cmd.type === 'wait') {
            setTimeout(function () {
                if (isRunning) executeNextCommand();
            }, cmd.ms);
        } else {
            executeNextCommand();
        }
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
    function executeDrive(distanceCm, speedPct, onComplete) {
        var targetDist = Math.abs(distanceCm) * UNIT;
        var fwdSign = distanceCm >= 0 ? 1 : -1;   // +1 = forward, -1 = backward
        var targetOmega = (speedPct / 100) * MAX_RAD_PER_SEC * fwdSign;

        var distTravelled = 0;
        var startTime = null;
        var stalled = false;   // true once robot has hit obstacle

        robotState.omegaL = targetOmega;
        robotState.omegaR = targetOmega;

        function step(ts) {
            if (!isRunning) return;
            if (!startTime) startTime = ts;
            var elapsed = (ts - startTime) / 1000;  // seconds

            // Acceleration ramp: ease up to target omega
            var ramp = Math.min(elapsed / RAMP_TIME, 1.0);
            var omegaEff = targetOmega * ramp;

            // Apply ramp (slope) speed modulation
            var rampState = getRampState(robotState.x, robotState.z, robotState.theta);
            omegaEff *= rampState.speedFactor;

            var vL = omegaEff * WHEEL_RADIUS;
            var vR = omegaEff * WHEEL_RADIUS;
            var v = (vL + vR) / 2;

            // Use Three.js clock delta for accurate time
            var dt = clock.getDelta();
            if (dt > 0.1) dt = 0.1;   // clamp large frames (tab unfocused etc)

            // ── Tentative new position ─────────────────────────────
            var newX = robotState.x + v * (-Math.sin(robotState.theta)) * dt;
            var newZ = robotState.z + v * (-Math.cos(robotState.theta)) * dt;

            // ── Collision response ─────────────────────────────────
            if (!stalled && collidesAt(newX, newZ)) {
                stalled = true;
                // Find closest position just before wall (bisection)
                var lo = robotState.x, loZ = robotState.z;
                for (var i = 0; i < 8; i++) {
                    var midX = (lo + newX) / 2;
                    var midZ = (loZ + newZ) / 2;
                    if (collidesAt(midX, midZ)) { newX = midX; newZ = midZ; }
                    else { lo = midX; loZ = midZ; }
                }
                robotState.x = lo;
                robotState.z = loZ;
                console.log('[MissionSim3D] Stall: obstacle at contact surface');
            }

            if (!stalled) {
                robotState.x = newX;
                robotState.z = newZ;
            }

            // Accumulate logical distance (even when stalled – motors keep "trying")
            var distStep = Math.abs(v * dt);
            distTravelled += distStep;

            // Spin wheels (visual – always, even when stalled)
            robotState.wheelPosL += omegaEff * dt;
            robotState.wheelPosR += omegaEff * dt;

            applyRobotPose();

            if (distTravelled >= targetDist) {
                robotState.omegaL = 0;
                robotState.omegaR = 0;
                console.log('[MissionSim3D] Drive complete. dist=' + (distTravelled / UNIT).toFixed(1) + 'cm stalled=' + stalled);
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
    function executeTurn(degrees, speedPct, onComplete) {
        var targetRad = Math.abs(degrees) * Math.PI / 180;
        var turnSign = degrees >= 0 ? 1 : -1;   // +1 = right, -1 = left
        var omega = (speedPct / 100) * MAX_RAD_PER_SEC;

        // Right turn: left wheel forward (+), right wheel backward (-)
        var omegaL = omega * turnSign;   // left  wheel
        var omegaR = -omega * turnSign;   // right wheel

        robotState.omegaL = omegaL;
        robotState.omegaR = omegaR;

        var angleAccum = 0;
        var startTime = null;

        function step(ts) {
            if (!isRunning) return;
            if (!startTime) startTime = ts;
            var elapsed = (ts - startTime) / 1000;

            // Ramp
            var ramp = Math.min(elapsed / RAMP_TIME, 1.0);
            var omegaEff = omega * ramp;

            var dt = clock.getDelta();
            if (dt > 0.1) dt = 0.1;

            // Differential drive angular rate:
            //   omega_robot = (vR - vL) / WHEEL_BASE
            //   vR = -omegaEff × turnSign × WHEEL_RADIUS
            //   vL = +omegaEff × turnSign × WHEEL_RADIUS
            //   → omega_robot = (-2 × omegaEff × turnSign × WHEEL_RADIUS) / WHEEL_BASE
            var omegaRobot = (-2 * omegaEff * turnSign * WHEEL_RADIUS) / WHEEL_BASE;

            robotState.theta += omegaRobot * dt;
            angleAccum += Math.abs(omegaRobot * dt);

            // Wheel visual spin (opposite directions)
            robotState.wheelPosL += omegaEff * turnSign * dt;
            robotState.wheelPosR += omegaEff * -turnSign * dt;

            applyRobotPose();

            if (angleAccum >= targetRad) {
                robotState.omegaL = 0;
                robotState.omegaR = 0;
                // Snap to exact heading to avoid float drift
                var startTheta = robot.rotation.y - (angleAccum - targetRad) * Math.sign(omegaRobot);
                // (optional exact snap – just log for now)
                console.log('[MissionSim3D] Turn complete. angle=' + (angleAccum * 180 / Math.PI).toFixed(1) + '°');
                onComplete();
            } else {
                requestAnimationFrame(step);
            }
        }

        requestAnimationFrame(step);
    }


    // ════════════════════════════════════════════════════════════════
    // RENDER LOOP
    // ════════════════════════════════════════════════════════════════
    var clock;

    function animate() {
        animId = requestAnimationFrame(animate);

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

    /**
     * Spawn a draggable obstacle box at (x, z) in world space.
     */
    function spawnObstacle(x, z) {
        x = x !== undefined ? x : 4;
        z = z !== undefined ? z : 0;
        var w = 2.5, h = 3, d = 2.5;
        var mesh = addObstacle(x, z, w, d, h);
        // Track last physics record (addObstacle pushes to obstacles[])
        var physRec = obstacles[obstacles.length - 1];
        worldObjects.push({ mesh: mesh, type: 'obstacle', physicsData: physRec });
        console.log('[WorldBuilder] Obstacle spawned at', x, z);
    }

    /**
     * Spawn a draggable ramp group at position (cx, cz) facing -Z.
     */
    function spawnRamp(cx, cz) {
        cx = cx !== undefined ? cx : 0;
        cz = cz !== undefined ? cz : -5;
        var cfg = { x0: cx, y0: 0, z0: cz + 3, x1: cx, y1: 2.2, z1: cz - 3, width: 4.5 };
        var mesh = addRamp(cfg);
        // Track last ramp physics record
        var physRec = ramps[ramps.length - 1];
        worldObjects.push({ mesh: mesh, type: 'ramp', physicsData: physRec });
        console.log('[WorldBuilder] Ramp spawned at', cx, cz);
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

    /**
     * Remove all user-placed world objects (obstacles, ramps, targets).
     * Does NOT reset the robot.
     */
    function clearWorldObjects() {
        for (var i = 0; i < worldObjects.length; i++) {
            scene.remove(worldObjects[i].mesh);
        }
        worldObjects = [];
        // Also remove from physics arrays (keep permanent ones added in init)
        obstacles = [];
        ramps = [];
        console.log('[WorldBuilder] All world objects cleared.');
    }


    // ════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════════════════
    return {
        init: init,
        reset: reset,
        runCommands: runCommands,
        stop: stop,
        addRamp: addRamp,
        addObstacle: addObstacle,
        spawnRamp: spawnRamp,
        spawnObstacle: spawnObstacle,
        spawnTarget: spawnTarget,
        clearWorldObjects: clearWorldObjects
    };
})();
