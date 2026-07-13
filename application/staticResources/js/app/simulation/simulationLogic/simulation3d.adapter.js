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
    var lastWidth = 0;
    var lastHeight = 0;
    var orbit = { yaw: 0.55, pitch: 0.78, distance: 29, targetX: 0, targetZ: 0 };
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
        var body = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.6, 2.0),
            new THREE.MeshPhongMaterial({ color: isRcx ? 0xf7d900 : 0xd8d8d8 })
        );
        body.name = 'robotBody';
        body.position.y = 0.45;
        body.castShadow = true;
        group.add(body);

        var screen = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.5), new THREE.MeshPhongMaterial({ color: 0x222222 }));
        screen.position.set(0, 0.78, -0.45);
        group.add(screen);

        var wheelGeometry = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 24);
        var wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
        var leftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        var rightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        leftWheel.rotation.z = Math.PI / 2;
        rightWheel.rotation.z = Math.PI / 2;
        leftWheel.position.set(-0.92, 0.28, 0.35);
        rightWheel.position.set(0.92, 0.28, 0.35);
        leftWheel.castShadow = true;
        rightWheel.castShadow = true;
        group.add(leftWheel);
        group.add(rightWheel);

        var direction = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 24), new THREE.MeshPhongMaterial({ color: 0x33b8ca }));
        direction.name = 'directionMarker';
        direction.rotation.x = -Math.PI / 2;
        direction.position.set(0, 0.8, -1.15);
        direction.visible = !isRcx;
        group.add(direction);

        return group;
    }

    function updateCamera() {
        if (!camera) return;
        var horizontal = Math.cos(orbit.pitch) * orbit.distance;
        camera.position.set(
            orbit.targetX + Math.sin(orbit.yaw) * horizontal,
            Math.sin(orbit.pitch) * orbit.distance,
            orbit.targetZ + Math.cos(orbit.yaw) * horizontal
        );
        camera.lookAt(orbit.targetX, 0, orbit.targetZ);
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
        scene.background = new THREE.Color(0xf3f5f7);

        camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        updateCamera();

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.shadowMap.enabled = true;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x777788, 0.9));
        var sun = new THREE.DirectionalLight(0xffffff, 0.65);
        sun.position.set(8, 18, 12);
        sun.castShadow = true;
        scene.add(sun);

        var grid = new THREE.GridHelper(40, 20, 0x888888, 0xd0d0d0);
        scene.add(grid);

        fieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), new THREE.MeshPhongMaterial({ color: 0xffffff }));
        fieldMesh.rotation.x = -Math.PI / 2;
        fieldMesh.receiveShadow = true;
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

        if (fieldMesh) {
            fieldMesh.scale.set(Math.max(lastWidth / lastHeight, 1), Math.max(lastHeight / lastWidth, 1), 1);
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
