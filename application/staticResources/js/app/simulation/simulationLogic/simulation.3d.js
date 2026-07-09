define(['three'], function (THREE) {
    var scene, camera, renderer, robotMesh;
    var isInitialized = false;

    function init(containerId) {
        console.log("Initializing 3D Simulation in " + containerId);
        var container = document.getElementById(containerId);
        if (!container) {
            console.error("3D Container not found: " + containerId);
            return;
        }

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);

        // Camera setup
        camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 20, 20); // Top-down-ish view
        camera.lookAt(0, 0, 0);

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.shadowMap.enabled = true;
        container.innerHTML = ''; // Clear loading message
        container.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x606060);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 0.5).normalize();
        scene.add(directionalLight);

        // Ground (Grid)
        const gridHelper = new THREE.GridHelper(100, 20);
        scene.add(gridHelper);

        // Axes Helper
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);

        // Robot Model (Simple Cube for now)
        // Robot Construction
        robotMesh = new THREE.Group();

        // 1. Main Body (Grey Box)
        const bodyGeo = new THREE.BoxGeometry(4, 4, 4);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xcccccc }); // Light Grey
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 2;
        robotMesh.add(body);

        // 2. Wheels (Black Cylinders)
        const wheelGeo = new THREE.CylinderGeometry(2, 2, 1, 32);
        const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111 }); // Dark Grey/Black

        const leftWheel = new THREE.Mesh(wheelGeo, wheelMat);
        leftWheel.rotation.z = Math.PI / 2; // Rotate cylinder to face sideways
        leftWheel.position.set(-2.5, 2, 0); // Left side
        robotMesh.add(leftWheel);

        const rightWheel = new THREE.Mesh(wheelGeo, wheelMat);
        rightWheel.rotation.z = Math.PI / 2;
        rightWheel.position.set(2.5, 2, 0); // Right side
        robotMesh.add(rightWheel);

        // 3. Direction Indicator (Face/Screen)
        const faceGeo = new THREE.BoxGeometry(3, 2, 0.5);
        const faceMat = new THREE.MeshPhongMaterial({ color: 0x333333 }); // Screen
        const face = new THREE.Mesh(faceGeo, faceMat);
        face.position.set(0, 2.5, -2); // Front
        robotMesh.add(face);

        scene.add(robotMesh);

        isInitialized = true;
        animate();

        // Handle Resize
        window.addEventListener('resize', onWindowResize, false);

        function onWindowResize() {
            if (!camera || !renderer) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    function update(robotState) {
        if (!robotMesh || !robotState) return;

        // Debug log (throttled/once)
        if (!window.sim3dLogged) {
            console.log("3D Update called with state:", robotState);
            window.sim3dLogged = true;
        }

        // Map 2D robot state (x, y, theta) to 3D world
        // 2D Sim: x, y in pixels (or relative units). 0,0 is top-left?
        // Three.js: 0,0,0 is center. +y is up. +x is right. +z is forward/backward.

        // Scale factor: Experiments needed. simulating 1 pixel = 1 unit for now.
        // Centering offset might be needed.

        // Simple mapping:
        robotMesh.position.x = robotState.x - 200; // Offset to center roughly
        robotMesh.position.z = robotState.y - 200;
        // Rotate -90 deg (-PI/2) to align -Z face with +X axis
        robotMesh.rotation.y = -robotState.theta - Math.PI / 2;
    }

    function addObstacle(param) {
        if (!scene) return;
        var w = param.w || 10;
        var h = param.h || 10;
        var d = param.d || 10;
        var x = param.x || 0;
        var y = param.y || 0;
        var color = param.color || 0xff0000;

        var geo = new THREE.BoxGeometry(w, h, d);
        var mat = new THREE.MeshPhongMaterial({ color: color });
        var mesh = new THREE.Mesh(geo, mat);

        // Position (sim coordinates to 3D coordinates)
        mesh.position.x = x - 200;
        mesh.position.z = y - 200;
        mesh.position.y = h / 2; // Sit on ground

        scene.add(mesh);
        console.log("Added Obstacle at ", x, y);
    }

    function addTarget(param) {
        if (!scene) return;
        var w = param.w || 20;
        var h = param.h || 20; // 2D footprint
        var x = param.x || 0;
        var y = param.y || 0;

        // Target is a flat plane on the ground
        var geo = new THREE.PlaneGeometry(w, h);
        var mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        var mesh = new THREE.Mesh(geo, mat);

        mesh.rotation.x = -Math.PI / 2;
        mesh.position.x = x - 200;
        mesh.position.z = y - 200;
        mesh.position.y = 0.1; // Just above grid

        scene.add(mesh);
        console.log("Added Target at ", x, y);
    }

    return {
        init: init,
        update: update,
        addObstacle: addObstacle,
        addTarget: addTarget
    };
});
