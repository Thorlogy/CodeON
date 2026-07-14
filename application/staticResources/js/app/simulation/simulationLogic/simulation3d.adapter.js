(function () {
    'use strict';

    var enabled = false;
    var initialized = false;
    var simModule = null;
    var scene;
    var camera;
    var renderer;
    var robotMesh;
    var fieldMesh;
    var poseHud;
    var sceneLabel;
    var lastWidth = 0;
    var lastHeight = 0;
    // Same low, robot-centred starting perspective as the 3D-RoboMission scene.
    var orbit = { yaw: 0, pitch: 0.52, distance: 17, targetX: 0, targetZ: 0, panned: false };
    var drag = null;

    function getElement(id) {
        return document.getElementById(id);
    }

    function getSimulationInstance() {
        if (simModule && simModule.SimulationRoberta) {
            return simModule.SimulationRoberta.Instance;
        }
        if (window.require) {
            try {
                window.require(['simulation.roberta'], function (module) {
                    simModule = module;
                });
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    function getSimulationScene() {
        var sim = getSimulationInstance();
        return sim && sim.scene ? sim.scene : null;
    }

    function getCanvasSize(simScene) {
        var canvas = simScene && simScene.uCanvas ? simScene.uCanvas : getElement('robotLayer');
        return {
            width: canvas && canvas.width ? canvas.width : 800,
            height: canvas && canvas.height ? canvas.height : 600,
        };
    }

    function isRcxSelected(robot) {
        var robotButton = getElement('simRobot');
        if (robotButton && robotButton.classList.contains('typcn-rcx')) return true;
        var robotType = robot
            ? [robot.constructor && robot.constructor.name, robot.chassis && robot.chassis.constructor && robot.chassis.constructor.name].join(' ')
            : '';
        return /rcx/i.test(robotType);
    }

    function updateRobotAppearance(robot) {
        if (!robotMesh) return;
        var isRcx = isRcxSelected(robot);
        var body = robotMesh.getObjectByName('robotBody');
        var direction = robotMesh.getObjectByName('directionMarker');
        if (body) body.material.color.setHex(isRcx ? 0xf7d900 : 0xd8d8d8);
        if (direction) direction.visible = !isRcx;
    }

    function buildRobot() {
        var group = new THREE.Group();
        var isRcx = isRcxSelected();

        var bodyMaterial = new THREE.MeshPhongMaterial({
            color: isRcx ? 0xf7d900 : 0x8a9bb5,
            shininess: 55,
        });
        var darkMaterial = new THREE.MeshPhongMaterial({ color: 0x172033, shininess: 30 });
        var displayMaterial = new THREE.MeshPhongMaterial({ color: isRcx ? 0xbfc5c9 : 0x1155aa, shininess: 65 });

        var body = new THREE.Mesh(
            new THREE.BoxGeometry(2.35, 1.15, 3.0),
            bodyMaterial
        );
        body.name = 'robotBody';
        body.position.y = 1.02;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        var topPanel = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.16, 2.72), darkMaterial);
        topPanel.position.y = 1.66;
        topPanel.castShadow = true;
        group.add(topPanel);

        var screen = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.72), displayMaterial);
        screen.position.set(0, 1.78, -0.48);
        screen.castShadow = true;
        group.add(screen);

        var wheelGeometry = new THREE.CylinderGeometry(0.78, 0.78, 0.5, 24);
        var wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x111827, shininess: 18 });
        var hubMaterial = new THREE.MeshPhongMaterial({ color: isRcx ? 0x555b62 : 0xd0d8e8, shininess: 45 });
        var leftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        var rightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        leftWheel.rotation.z = Math.PI / 2;
        rightWheel.rotation.z = Math.PI / 2;
        leftWheel.position.set(-1.38, 0.78, 0.28);
        rightWheel.position.set(1.38, 0.78, 0.28);
        leftWheel.castShadow = true;
        rightWheel.castShadow = true;
        group.add(leftWheel);
        group.add(rightWheel);

        [-1.38, 1.38].forEach(function (x) {
            var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.54, 16), hubMaterial);
            hub.rotation.z = Math.PI / 2;
            hub.position.set(x, 0.78, 0.28);
            hub.castShadow = true;
            group.add(hub);
        });

        var frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, 0.22), darkMaterial);
        frontBumper.position.set(0, 0.62, -1.58);
        frontBumper.castShadow = true;
        group.add(frontBumper);

        var caster = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), hubMaterial);
        caster.position.set(0, 0.3, 1.25);
        caster.castShadow = true;
        group.add(caster);

        var direction = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 24), new THREE.MeshPhongMaterial({ color: 0x33b8ca }));
        direction.name = 'directionMarker';
        direction.rotation.x = -Math.PI / 2;
        direction.position.set(0, 1.82, -1.75);
        direction.visible = !isRcx;
        group.add(direction);

        return group;
    }

    function createOverlay(container) {
        poseHud = document.createElement('div');
        poseHud.id = 'sim3dPoseHud';
        poseHud.style.cssText = [
            'position:absolute',
            'bottom:66px',
            'left:12px',
            'z-index:20',
            'pointer-events:none',
            'white-space:pre',
            'border:1px solid rgba(255,255,255,.22)',
            'border-radius:6px',
            'padding:6px 9px',
            'background:rgba(17,32,55,.72)',
            'box-shadow:0 5px 14px rgba(15,23,42,.18)',
            'color:#dbeafe',
            'font:600 11px/1.45 monospace',
        ].join(';');
        poseHud.textContent = 'POSITION\nX: 0.0   Y: 0.0\nRichtung: 0°';
        container.appendChild(poseHud);

        sceneLabel = document.createElement('div');
        sceneLabel.style.cssText = [
            'position:absolute',
            'top:12px',
            'right:14px',
            'z-index:20',
            'pointer-events:none',
            'color:#46627f',
            'font:700 11px/1 sans-serif',
            'letter-spacing:.16em',
        ].join(';');
        sceneLabel.textContent = '3D SIMULATION';
        container.appendChild(sceneLabel);
    }

    function updateCamera() {
        if (!camera) return;
        var horizontal = Math.cos(orbit.pitch) * orbit.distance;
        camera.position.set(
            orbit.targetX + Math.sin(orbit.yaw) * horizontal,
            Math.sin(orbit.pitch) * orbit.distance,
            orbit.targetZ + Math.cos(orbit.yaw) * horizontal
        );
        camera.lookAt(orbit.targetX, 0.75, orbit.targetZ);
    }

    function attachNavigation() {
        var canvas = renderer.domElement;
        canvas.style.touchAction = 'none';
        canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
        canvas.addEventListener('pointerdown', function (event) {
            if (!enabled) return;
            drag = { x: event.clientX, y: event.clientY, pan: event.button === 2 || event.shiftKey };
            canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener('pointermove', function (event) {
            if (!drag) return;
            var dx = event.clientX - drag.x;
            var dy = event.clientY - drag.y;
            drag.x = event.clientX;
            drag.y = event.clientY;
            if (drag.pan) {
                var panScale = orbit.distance / 800;
                orbit.targetX -= dx * panScale;
                orbit.targetZ += dy * panScale;
                orbit.panned = true;
            } else {
                orbit.yaw -= dx * 0.012;
                orbit.pitch = Math.max(0.18, Math.min(1.48, orbit.pitch - dy * 0.012));
            }
            updateCamera();
        });
        function stopDrag(event) {
            if (drag && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            drag = null;
        }
        canvas.addEventListener('pointerup', stopDrag);
        canvas.addEventListener('pointercancel', stopDrag);
        canvas.addEventListener('wheel', function (event) {
            if (!enabled) return;
            event.preventDefault();
            orbit.distance = Math.max(8, Math.min(60, orbit.distance * (event.deltaY > 0 ? 1.1 : 0.9)));
            updateCamera();
        }, { passive: false });
    }

    function init() {
        if (initialized) return;
        var container = getElement('sim3dDiv');
        if (!container || !window.THREE) return;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xe8edf3);
        scene.fog = new THREE.Fog(0xe8edf3, 32, 72);

        camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
        updateCamera();

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.innerHTML = '';
        container.style.position = 'absolute';
        container.appendChild(renderer.domElement);
        createOverlay(container);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x7f91aa, 0.72));
        var sun = new THREE.DirectionalLight(0xfff8e7, 1.18);
        sun.position.set(10, 22, 11);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 80;
        sun.shadow.camera.left = -24;
        sun.shadow.camera.right = 24;
        sun.shadow.camera.top = 24;
        sun.shadow.camera.bottom = -24;
        scene.add(sun);

        var fill = new THREE.DirectionalLight(0xbed8ff, 0.32);
        fill.position.set(-9, 7, -10);
        scene.add(fill);

        var floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshLambertMaterial({ color: 0xf7f9fb }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.035;
        floor.receiveShadow = true;
        scene.add(floor);

        var grid = new THREE.GridHelper(64, 32, 0x5c6b7a, 0xc9d1da);
        grid.position.y = 0.01;
        scene.add(grid);

        fieldMesh = new THREE.Group();
        var fieldSurface = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 14),
            new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 })
        );
        fieldSurface.rotation.x = -Math.PI / 2;
        fieldSurface.position.y = 0.018;
        fieldSurface.receiveShadow = true;
        fieldMesh.add(fieldSurface);

        var fieldBorder = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.PlaneGeometry(20, 14)),
            new THREE.LineBasicMaterial({ color: 0x8a99a8 })
        );
        fieldBorder.rotation.x = -Math.PI / 2;
        fieldBorder.position.y = 0.035;
        fieldMesh.add(fieldBorder);
        scene.add(fieldMesh);

        robotMesh = buildRobot();
        scene.add(robotMesh);

        attachNavigation();
        initialized = true;
        resize();
        animate();
    }

    function resize() {
        if (!renderer || !camera) return;
        var container = getElement('sim3dDiv');
        if (!container) return;
        var width = container.clientWidth || 800;
        var height = container.clientHeight || 600;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        updateCamera();
    }

    function syncRobotPose() {
        if (!robotMesh) return;
        var simScene = getSimulationScene();
        var robot = simScene && simScene.robots && simScene.robots.length ? simScene.robots[0] : null;
        if (!robot || !robot.pose) return;

        updateRobotAppearance(robot);

        var size = getCanvasSize(simScene);
        lastWidth = size.width;
        lastHeight = size.height;
        var scale = 18 / Math.max(lastWidth, lastHeight);
        robotMesh.position.x = (robot.pose.x - lastWidth / 2) * scale;
        robotMesh.position.z = (robot.pose.y - lastHeight / 2) * scale;
        robotMesh.rotation.y = -robot.pose.theta + Math.PI / 2;

        if (!orbit.panned) {
            orbit.targetX = robotMesh.position.x;
            orbit.targetZ = robotMesh.position.z;
            updateCamera();
        }

        if (poseHud) {
            var degrees = Math.round((((robot.pose.theta || 0) * 180) / Math.PI + 360) % 360);
            poseHud.textContent =
                'POSITION\n' +
                'X: ' + robotMesh.position.x.toFixed(1) + '   Y: ' + robotMesh.position.z.toFixed(1) + '\n' +
                'Richtung: ' + degrees + '°';
        }

        if (fieldMesh) {
            fieldMesh.scale.set(Math.max(lastWidth / lastHeight, 1), 1, Math.max(lastHeight / lastWidth, 1));
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        if (!enabled || !renderer || !scene || !camera) return;
        syncRobotPose();
        renderer.render(scene, camera);
    }

    function restore2dLayout() {
        var simScene = getSimulationScene();
        if (simScene && typeof simScene.centerBackground === 'function') {
            simScene.centerBackground(false);
        }
    }

    function setMode(nextEnabled) {
        enabled = nextEnabled;
        var canvasDiv = getElement('canvasDiv');
        var sim3dDiv = getElement('sim3dDiv');
        var toggle = getElement('sim3dToggle');
        if (enabled) {
            orbit.panned = false;
            init();
            if (!initialized) {
                enabled = false;
                return;
            }
            updateRobotAppearance();
            if (canvasDiv) canvasDiv.style.display = 'none';
            if (sim3dDiv) sim3dDiv.style.display = 'block';
            if (toggle) toggle.classList.add('active');
            requestAnimationFrame(resize);
        } else {
            if (sim3dDiv) sim3dDiv.style.display = 'none';
            if (canvasDiv) canvasDiv.style.display = '';
            if (toggle) toggle.classList.remove('active');
            requestAnimationFrame(restore2dLayout);
        }
    }

    function toggle() {
        setMode(!enabled);
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest || !target.closest('#sim3dToggle')) return;
        event.preventDefault();
        toggle();
    });

    window.addEventListener('resize', resize);
    document.addEventListener('DOMContentLoaded', function () {
        var simDiv = getElement('simDiv');
        if (!simDiv || !window.MutationObserver) return;
        new MutationObserver(function () {
            if (enabled && !simDiv.classList.contains('rightActive')) {
                setMode(false);
            }
        }).observe(simDiv, { attributes: true, attributeFilter: ['class'] });
    });

    window.CodeOnSim3D = {
        init: init,
        resize: resize,
        setMode: setMode,
        toggle: toggle,
        isEnabled: function () {
            return enabled;
        },
    };
})();
