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

    function buildRobot() {
        var group = new THREE.Group();

        var body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.0), new THREE.MeshPhongMaterial({ color: 0xd8d8d8 }));
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
        direction.rotation.x = -Math.PI / 2;
        direction.position.set(0, 0.8, -1.15);
        group.add(direction);

        return group;
    }

    function init() {
        if (initialized) return;
        var container = getElement('sim3dDiv');
        if (!container || !window.THREE) return;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf3f5f7);

        camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        camera.position.set(0, 22, 20);
        camera.lookAt(0, 0, 0);

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
    }

    function syncRobotPose() {
        if (!robotMesh) return;
        var simScene = getSimulationScene();
        var robot = simScene && simScene.robots && simScene.robots.length ? simScene.robots[0] : null;
        if (!robot || !robot.pose) return;

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

    function setMode(nextEnabled) {
        enabled = nextEnabled;
        var canvasDiv = getElement('canvasDiv');
        var sim3dDiv = getElement('sim3dDiv');
        var toggle = getElement('sim3dToggle');
        if (enabled) {
            init();
            if (canvasDiv) canvasDiv.style.display = 'none';
            if (sim3dDiv) sim3dDiv.style.display = 'block';
            if (toggle) toggle.classList.add('active');
            resize();
        } else {
            if (canvasDiv) canvasDiv.style.display = 'block';
            if (sim3dDiv) sim3dDiv.style.display = 'none';
            if (toggle) toggle.classList.remove('active');
        }
    }

    function toggle() {
        setMode(!enabled);
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || target.id !== 'sim3dToggle') return;
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
