/**
 * mission-sim3d.js
 * Standalone Three.js 3D simulation for the Mission App.
 * Requires THREE to be globally available (loaded via script tag).
 *
 * API:
 *   MissionSim3D.init(containerId)
 *   MissionSim3D.reset()
 *   MissionSim3D.runCommands(cmds, onDone)
 *   MissionSim3D.stop()
 */
window.MissionSim3D = (function () {
    'use strict';

    // ── Scene state ────────────────────────────────────────────────
    var scene, camera, renderer, robot, animId;
    var isRunning = false;
    var container;

    // Robot start position in 3D world
    var START_X = 0;
    var START_Z = 8;   // robot starts near bottom of scene, facing forward (-Z)

    // Animation queue
    var commandQueue = [];
    var onDoneCallback = null;

    // Scale: 1 cm = 0.15 Three.js units
    var UNIT = 0.15;

    // Obstacle bounding boxes for collision detection [{minX, maxX, minZ, maxZ}]
    var obstacles = [];

    // Robot half-extents (body half-width + some margin)
    var ROBOT_HW = 1.3;  // half-width  (X)
    var ROBOT_HD = 1.7;  // half-depth  (Z)


    // ── Init ───────────────────────────────────────────────────────
    function init(containerId) {
        container = document.getElementById(containerId);
        if (!container) {
            console.error('[MissionSim3D] Container not found:', containerId);
            return;
        }

        // Hide loading message
        var loadingMsg = document.getElementById('loading-msg');
        if (loadingMsg) loadingMsg.style.display = 'none';

        var W = container.clientWidth || 800;
        var H = container.clientHeight || 400;

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111827);
        scene.fog = new THREE.FogExp2(0x111827, 0.018);

        // Camera – nice angled view from behind/above
        camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
        camera.position.set(0, 18, 22);
        camera.lookAt(0, 0, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // ── Lights ────────────────────────────────────────────────
        var ambient = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambient);

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

        // ── Floor ─────────────────────────────────────────────────
        var floorGeo = new THREE.PlaneGeometry(80, 80);
        var floorMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        var floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Grid
        var grid = new THREE.GridHelper(80, 40, 0x334466, 0x222f44);
        grid.position.y = 0.01;
        scene.add(grid);

        // ── Robot model ───────────────────────────────────────────
        robot = buildEV3Robot();
        robot.position.set(START_X, 0, START_Z);
        scene.add(robot);

        // ── Obstacles & targets (placed in robot's forward path = -Z) ──
        // Robot faces -Z (theta=0), so obstacles are at lower Z values
        addObstacle(0, -5, 4);          // blue box: x=0, Z=-5
        addTarget(0, -14, 0x22c55e);    // green target: x=0, Z=-14

        // ── Animate ───────────────────────────────────────────────
        animate();

        // Resize handler
        window.addEventListener('resize', onResize);
        console.log('[MissionSim3D] Initialized');
    }

    // ── EV3 Robot ─────────────────────────────────────────────────
    function buildEV3Robot() {
        var group = new THREE.Group();

        var bodyMat = new THREE.MeshPhongMaterial({ color: 0x8a9bb5, shininess: 60 });
        var darkMat = new THREE.MeshPhongMaterial({ color: 0x1a2233, shininess: 30 });
        var redMat = new THREE.MeshPhongMaterial({ color: 0xdd2244 });
        var yellowMat = new THREE.MeshPhongMaterial({ color: 0xf5a623, emissive: 0xf5a623, emissiveIntensity: 0.3 });
        var screenMat = new THREE.MeshPhongMaterial({ color: 0x1155aa });

        // Body brick
        var bodyGeo = new THREE.BoxGeometry(2.4, 1.3, 3.2);
        var body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.05;
        body.castShadow = true;
        group.add(body);

        // Top panel (darker)
        var topGeo = new THREE.BoxGeometry(2.2, 0.18, 3.0);
        var top = new THREE.Mesh(topGeo, new THREE.MeshPhongMaterial({ color: 0x2d3f5a }));
        top.position.y = 1.72;
        group.add(top);

        // Display (front face = -Z side)
        var screenGeo = new THREE.BoxGeometry(1.5, 0.75, 0.12);
        var screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(0, 1.1, -1.62);
        group.add(screen);

        // Status LED (green dot on front)
        var ledGeo = new THREE.SphereGeometry(0.16, 8, 8);
        var led = new THREE.Mesh(ledGeo, yellowMat);
        led.position.set(0.6, 1.65, -1.62);
        group.add(led);
        group.userData.led = led;

        // Drive wheels (left/right) – cylinders rotated to horizontal
        function makeWheel(side) {
            // Outer tire
            var tireGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.55, 16);
            var tire = new THREE.Mesh(tireGeo, darkMat);
            tire.rotation.z = Math.PI / 2;
            tire.position.set(side * 1.58, 0.95, 0.1);
            tire.castShadow = true;
            group.add(tire);
            // Hub
            var hubGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.58, 10);
            var hub = new THREE.Mesh(hubGeo, new THREE.MeshPhongMaterial({ color: 0xd0d8e8 }));
            hub.rotation.z = Math.PI / 2;
            hub.position.set(side * 1.59, 0.95, 0.1);
            group.add(hub);
            return tire;
        }
        group.userData.wheelL = makeWheel(-1);
        group.userData.wheelR = makeWheel(+1);

        // Rear caster ball
        var casterGeo = new THREE.SphereGeometry(0.28, 8, 8);
        var caster = new THREE.Mesh(casterGeo, new THREE.MeshPhongMaterial({ color: 0xaabbcc }));
        caster.position.set(0, 0.28, 1.4);
        group.add(caster);

        // Red accent strip (front bottom)
        var stripGeo = new THREE.BoxGeometry(2.4, 0.22, 0.18);
        var strip = new THREE.Mesh(stripGeo, redMat);
        strip.position.set(0, 0.6, -1.62);
        group.add(strip);

        return group;
    }

    // ── Obstacles ─────────────────────────────────────────────────
    // xWorld, zWorld are direct Three.js world coordinates
    function addObstacle(xWorld, zWorld, color) {
        var geo = new THREE.BoxGeometry(3, 3.5, 3);
        var mat = new THREE.MeshPhongMaterial({ color: color || 0x3b82f6, shininess: 40 });
        var box = new THREE.Mesh(geo, mat);
        box.position.set(xWorld, 1.75, zWorld);
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);

        // Register AABB for collision (obstacle half-size = 1.5 in X and Z)
        obstacles.push({
            minX: xWorld - 1.5,
            maxX: xWorld + 1.5,
            minZ: zWorld - 1.5,
            maxZ: zWorld + 1.5
        });
    }

    function addTarget(xWorld, zWorld, color) {
        // Flat ring on the ground
        var ringGeo = new THREE.RingGeometry(1.5, 2.2, 24);
        var ringMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
        var ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(xWorld, 0.04, zWorld);
        scene.add(ring);
        // inner transparent fill
        var fillGeo = new THREE.CircleGeometry(1.4, 24);
        var fillMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
        var fill = new THREE.Mesh(fillGeo, fillMat);
        fill.rotation.x = -Math.PI / 2;
        fill.position.set(xWorld, 0.05, zWorld);
        scene.add(fill);
    }

    // ── Reset ─────────────────────────────────────────────────────
    function reset() {
        stop();
        if (robot) {
            robot.position.set(START_X, 0, START_Z);
            robot.rotation.set(0, 0, 0);
        }
        commandQueue = [];
        onDoneCallback = null;
        console.log('[MissionSim3D] Reset');
    }

    // ── Collision helper ──────────────────────────────────────────
    function collidesAt(x, z) {
        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (x + ROBOT_HW > o.minX && x - ROBOT_HW < o.maxX &&
                z + ROBOT_HD > o.minZ && z - ROBOT_HD < o.maxZ) {
                return true;
            }
        }
        return false;
    }

    // ── Run commands ──────────────────────────────────────────────
    /**
     * @param {Array} cmds  - Commands from MissionInterpreter
     * @param {Function} onDone - Called when all commands finish
     */
    function runCommands(cmds, onDone) {
        if (!cmds || cmds.length === 0) {
            if (onDone) onDone();
            return;
        }
        stop(); // clear any running animation
        commandQueue = cmds.slice();
        onDoneCallback = onDone || null;
        isRunning = true;
        executeNextCommand();
    }

    function stop() {
        isRunning = false;
        // commandQueue intentionally not cleared so stop just pauses
    }

    // ── Command execution ─────────────────────────────────────────
    var _currentTween = null;

    function executeNextCommand() {
        if (!isRunning || commandQueue.length === 0) {
            isRunning = false;
            if (onDoneCallback) {
                onDoneCallback();
                onDoneCallback = null;
            }
            return;
        }

        var cmd = commandQueue.shift();
        console.log('[MissionSim3D] Executing command:', cmd);

        if (cmd.type === 'drive') {
            animateDrive(cmd.distance, cmd.speed, executeNextCommand);

        } else if (cmd.type === 'turn') {
            animateTurn(cmd.degrees, cmd.speed, executeNextCommand);

        } else if (cmd.type === 'stop') {
            // Just continue
            executeNextCommand();

        } else if (cmd.type === 'wait') {
            setTimeout(function () {
                if (isRunning) executeNextCommand();
            }, cmd.ms);

        } else {
            executeNextCommand();
        }
    }

    // ── Drive animation ───────────────────────────────────────────
    function animateDrive(distanceCm, speedPct, onComplete) {
        // Duration based on speed (50% speed → ~2s for 30cm)
        var durationMs = Math.abs(distanceCm) * (3000 / 50) * (50 / Math.max(speedPct, 5));
        durationMs = Math.min(durationMs, 8000); // cap at 8s

        var startX = robot.position.x;
        var startZ = robot.position.z;
        var theta = robot.rotation.y; // current heading

        // Robot faces -Z at theta=0. When turning right, theta goes negative (Three.js clockwise).
        // Correct forward vector: dx = -sin(theta), dz = -cos(theta)
        // Check: theta=0  → dx=0,  dz=-dist  ✓ (moves forward = -Z)
        //        theta=-π/2 → dx=+dist, dz=0 ✓ (moves right = +X after right turn)
        var dx = -Math.sin(theta) * distanceCm * UNIT;
        var dz = -Math.cos(theta) * distanceCm * UNIT;

        var targetX = startX + dx;
        var targetZ = startZ + dz;

        var startTime = null;
        var stalledX = null;  // set when robot hits obstacle (null = free)
        var stalledZ = null;

        function frame(ts) {
            if (!isRunning) return;
            if (!startTime) startTime = ts;
            var elapsed = ts - startTime;
            var t = Math.min(elapsed / durationMs, 1);

            // Ease in-out (only applied while not stalled)
            var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            if (stalledX !== null) {
                // ── STALLED: robot is pressed against obstacle ──────────────
                // Wheels spin (stall effect) but robot doesn't move
                // The motors are "trying" – wheels keep rotating
                var stallWheelSpin = (distanceCm * UNIT / 0.9) * ease;
                if (robot.userData.wheelL) robot.userData.wheelL.rotation.x = stallWheelSpin;
                if (robot.userData.wheelR) robot.userData.wheelR.rotation.x = stallWheelSpin;

                if (t >= 1) {
                    console.log('[MissionSim3D] Motor stall complete – next command.');
                    onComplete();
                } else {
                    requestAnimationFrame(frame);
                }
                return;
            }

            var newX = startX + (targetX - startX) * ease;
            var newZ = startZ + (targetZ - startZ) * ease;

            if (collidesAt(newX, newZ)) {
                // ── First collision: find contact point and stall ──────────
                // Binary search: find the last step-fraction that is collision-free
                var lo = 0, hi = ease;
                for (var iter = 0; iter < 12; iter++) {
                    var mid = (lo + hi) / 2;
                    var cx = startX + (targetX - startX) * mid;
                    var cz = startZ + (targetZ - startZ) * mid;
                    if (collidesAt(cx, cz)) { hi = mid; } else { lo = mid; }
                }
                stalledX = startX + (targetX - startX) * lo;
                stalledZ = startZ + (targetZ - startZ) * lo;
                robot.position.x = stalledX;
                robot.position.z = stalledZ;
                console.log('[MissionSim3D] Collision! Motors stalling against obstacle…');
                requestAnimationFrame(frame);
                return;
            }

            robot.position.x = newX;
            robot.position.z = newZ;

            // Wheels spinning normally
            var wheelSpin = (distanceCm * UNIT / 0.9) * ease;
            if (robot.userData.wheelL) robot.userData.wheelL.rotation.x = wheelSpin;
            if (robot.userData.wheelR) robot.userData.wheelR.rotation.x = wheelSpin;

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                robot.position.x = targetX;
                robot.position.z = targetZ;
                onComplete();
            }
        }

        requestAnimationFrame(frame);
    }

    // ── Turn animation ────────────────────────────────────────────
    function animateTurn(degrees, speedPct, onComplete) {
        var durationMs = Math.abs(degrees) * (2000 / 90) * (50 / Math.max(speedPct, 5));
        durationMs = Math.min(durationMs, 6000);

        var startAngle = robot.rotation.y;
        // Three.js rotation.y: positive = counter-clockwise (left in world view).
        // Robot convention: positive degrees = turn RIGHT (clockwise).
        // So we NEGATE to match: right=90 → delta=-PI/2 (clockwise).
        var deltaAngle = -(degrees * Math.PI) / 180;
        var targetAngle = startAngle + deltaAngle;

        var startTime = null;

        function frame(ts) {
            if (!isRunning) return;
            if (!startTime) startTime = ts;
            var elapsed = ts - startTime;
            var t = Math.min(elapsed / durationMs, 1);
            var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            robot.rotation.y = startAngle + deltaAngle * ease;

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                robot.rotation.y = targetAngle;
                onComplete();
            }
        }

        requestAnimationFrame(frame);
    }

    // ── Render loop ───────────────────────────────────────────────
    var clock = new THREE.Clock();

    function animate() {
        animId = requestAnimationFrame(animate);

        var dt = clock.getDelta();

        // Idle LED pulse
        if (robot && robot.userData.led) {
            var t = Date.now() * 0.002;
            robot.userData.led.material.emissiveIntensity = 0.3 + 0.3 * Math.sin(t);
        }

        if (renderer && scene && camera) {
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

    // ── Public API ────────────────────────────────────────────────
    return {
        init: init,
        reset: reset,
        runCommands: runCommands,
        stop: stop
    };
})();
