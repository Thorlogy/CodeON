(function () {
    'use strict';

    var enabled = false;
    var initialized = false;
    var simModule = null;
    var scene;
    var camera;
    var renderer;
    var robotMesh;
    var cozmoCube;
    var cozmoCubePlaced = false;
    var cozmoCubeHeld = false;
    var fieldMesh;
    var poseHud;
    var sceneLabel;
    var worldObjectGroup;
    var worldObjectRecords = {};
    var raycaster;
    var groundPlane;
    var objectDrag = null;
    var robotDrag = null;
    var groundBackup = null;
    var spawnCounter = 0;
    var lastWidth = 0;
    var lastHeight = 0;
    var lastWorldScale = 1;
    var lastRearwardCorrection = 0;
    // Same low, robot-centred starting perspective as the 3D-RoboMission scene.
    var orbit = { yaw: 0, pitch: 0.52, distance: 7, targetX: 0, targetZ: 0, panned: false };
    var drag = null;
    var lastRobotPose = null;
    var wheelRotation = { left: 0, right: 0 };
    var STRUCTURE_HEIGHT = 0.5;
    var SNAP_DISTANCE = 0.7;

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

    function isApitorSelected(robot) {
        var robotButton = getElement('simRobot');
        if (robotButton && robotButton.classList.contains('typcn-apitor')) return true;
        var robotType = robot
            ? [robot.constructor && robot.constructor.name, robot.chassis && robot.chassis.constructor && robot.chassis.constructor.name].join(' ')
            : '';
        return /apitor/i.test(robotType);
    }

    function isCozmoSelected(robot) {
        var robotButton = getElement('simRobot');
        if (robotButton && robotButton.classList.contains('typcn-cozmo')) return true;
        var robotType = robot
            ? [robot.constructor && robot.constructor.name, robot.chassis && robot.chassis.constructor && robot.chassis.constructor.name].join(' ')
            : '';
        return /cozmo/i.test(robotType);
    }

    function updateRobotAppearance(robot) {
        if (!robotMesh) return;
        var isRcx = isRcxSelected(robot);
        var isApitor = isApitorSelected(robot);
        var isCozmo = isCozmoSelected(robot);
        var body = robotMesh.getObjectByName('robotBody');
        var display = robotMesh.getObjectByName('robotDisplay');
        var direction = robotMesh.getObjectByName('directionMarker');
        if (body) body.material.color.setHex(isCozmo ? 0xe7ebef : isApitor ? 0xf58220 : isRcx ? 0xf7d900 : 0xd8d8d8);
        if (display) display.material.color.setHex(isCozmo ? 0x132530 : isApitor ? 0x24b7c7 : isRcx ? 0xbfc5c9 : 0x1155aa);
        if (direction) direction.visible = !isRcx && !isApitor && !isCozmo;
    }

    function getRobotSensorState(robot) {
        var state = { touch: false, touchFound: false, light: null };
        if (!robot) return state;
        Object.keys(robot).forEach(function (key) {
            var component = robot[key];
            if (!component || typeof component !== 'object') return;
            if (component.position === 'front' && typeof component.value === 'boolean') {
                state.touchFound = true;
                state.touch = state.touch || component.value;
            }
            if (typeof component.lightValue === 'number') {
                state.light = component.lightValue;
            }
        });
        return state;
    }

    function updateRobotSensorsAppearance(robot) {
        if (!robotMesh) return;
        var state = getRobotSensorState(robot);
        var bumper = robotMesh.getObjectByName('touchBumper');
        var lightLens = robotMesh.getObjectByName('lightSensorLens');
        if (bumper && bumper.material) {
            bumper.material.color.setHex(state.touch ? 0xe5484d : 0xb8c0c8);
            if (bumper.material.emissive) bumper.material.emissive.setHex(state.touch ? 0x661111 : 0x000000);
        }
        if (lightLens && lightLens.material) {
            var light = state.light === null ? 55 : Math.max(0, Math.min(100, state.light));
            var level = Math.round(30 + light * 2.1);
            lightLens.material.color.setRGB(level / 255, level / 255, level / 255);
        }
        return state;
    }

    function buildCozmoRobot() {
        var group = new THREE.Group();
        var shell = new THREE.MeshPhongMaterial({ color: 0xe7ebef, shininess: 62 });
        var dark = new THREE.MeshPhongMaterial({ color: 0x121619, shininess: 22 });
        var grey = new THREE.MeshPhongMaterial({ color: 0x737d84, shininess: 36 });
        var cyan = new THREE.MeshPhongMaterial({ color: 0x36d5e8, emissive: 0x0b5260, shininess: 80 });
        var orange = new THREE.MeshPhongMaterial({ color: 0xf39c12, shininess: 45 });

        var body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.9, 2.5), shell);
        body.name = 'robotBody';
        body.position.set(0, 0.92, 0.05);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        var rear = new THREE.Mesh(new THREE.BoxGeometry(1.72, 1.12, 1.05), shell);
        rear.position.set(0, 1.35, 0.72);
        rear.castShadow = true;
        group.add(rear);

        var head = new THREE.Mesh(new THREE.BoxGeometry(1.72, 1.12, 0.72), dark);
        head.name = 'robotDisplay';
        head.position.set(0, 2.12, -0.42);
        head.rotation.x = -0.12;
        head.castShadow = true;
        group.add(head);
        [-0.43, 0.43].forEach(function (x) {
            var eye = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.04), cyan);
            eye.position.set(x, 2.18, -0.79);
            eye.rotation.x = -0.12;
            group.add(eye);
        });

        function makeTrack(side, x) {
            var track = new THREE.Group();
            track.position.x = x;
            var belt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.82, 2.85), dark);
            belt.position.y = 0.61;
            belt.castShadow = true;
            track.add(belt);
            [-0.9, 0, 0.9].forEach(function (z, index) {
                var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.49, 18), grey);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(0, 0.61, z);
                wheel.castShadow = true;
                track.add(wheel);
                if (index === 1) group.userData[side + 'Wheel'] = wheel;
            });
            for (var z = -1.25; z <= 1.25; z += 0.31) {
                var tread = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.18), grey);
                tread.position.set(0, 1.04, z);
                track.add(tread);
            }
            group.add(track);
        }
        makeTrack('left', -1.23);
        makeTrack('right', 1.23);

        var lift = new THREE.Group();
        lift.name = 'cozmoLift';
        lift.position.set(0, 0.62, -1.18);
        [-0.72, 0.72].forEach(function (x) {
            var arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.65), orange);
            arm.position.set(x, 0, -0.76);
            arm.castShadow = true;
            lift.add(arm);
            var fork = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.78), grey);
            fork.position.set(x, -0.05, -1.72);
            fork.castShadow = true;
            lift.add(fork);
        });
        var crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.2, 0.22), orange);
        crossbar.position.z = -0.35;
        crossbar.castShadow = true;
        lift.add(crossbar);
        group.add(lift);
        group.userData.cozmoLift = lift;
        group.userData.isCozmo = true;
        return group;
    }

    function createCozmoCube() {
        var material = new THREE.MeshPhongMaterial({ color: 0xf4a62a, shininess: 42 });
        var cube = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), material);
        cube.name = 'cozmoCube';
        cube.castShadow = true;
        cube.receiveShadow = true;
        return cube;
    }

    function buildRobot() {
        if (isCozmoSelected()) return buildCozmoRobot();
        var group = new THREE.Group();
        var isRcx = isRcxSelected();
        var isApitor = isApitorSelected();

        var bodyMaterial = new THREE.MeshPhongMaterial({
            color: isApitor ? 0xf58220 : isRcx ? 0xf7d900 : 0x8a9bb5,
            shininess: 55,
        });
        var darkMaterial = new THREE.MeshPhongMaterial({ color: 0x172033, shininess: 30 });
        var displayMaterial = new THREE.MeshPhongMaterial({ color: isApitor ? 0x24b7c7 : isRcx ? 0xbfc5c9 : 0x1155aa, shininess: 65 });

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
        screen.name = 'robotDisplay';
        screen.position.set(0, 1.78, -0.48);
        screen.castShadow = true;
        group.add(screen);

        var wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x111827, shininess: 18 });
        var hubMaterial = new THREE.MeshPhongMaterial({ color: isRcx ? 0x555b62 : 0xd0d8e8, shininess: 45 });
        var treadMaterial = new THREE.MeshPhongMaterial({ color: 0x8592a3, shininess: 12 });
        function makeWheel(name, x) {
            var wheelGroup = new THREE.Group();
            wheelGroup.name = name;
            wheelGroup.position.set(x, 0.78, 0.28);
            var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.5, 24), wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheelGroup.add(wheel);
            var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.54, 16), hubMaterial);
            hub.rotation.z = Math.PI / 2;
            hub.castShadow = true;
            wheelGroup.add(hub);
            [-1, 1].forEach(function (side) {
                var tread = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.18), treadMaterial);
                tread.position.set(side * 0.29, 0.76, 0);
                tread.castShadow = true;
                wheelGroup.add(tread);
            });
            group.add(wheelGroup);
            return wheelGroup;
        }
        group.userData.leftWheel = makeWheel('leftWheel', -1.38);
        group.userData.rightWheel = makeWheel('rightWheel', 1.38);

        var bumperMaterial = new THREE.MeshPhongMaterial({ color: 0xb8c0c8, shininess: 75, emissive: 0x000000 });
        var frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.22, 0.22), bumperMaterial);
        frontBumper.name = 'touchBumper';
        frontBumper.position.set(0, 0.58, -2.05);
        frontBumper.castShadow = true;
        group.add(frontBumper);

        [-0.92, 0.92].forEach(function (x) {
            var bumperSupport = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.78), bumperMaterial);
            bumperSupport.position.set(x, 0.58, -1.72);
            bumperSupport.castShadow = true;
            group.add(bumperSupport);
        });

        var lightSensorBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.64), darkMaterial);
        lightSensorBody.position.set(0, 0.35, -1.7);
        lightSensorBody.castShadow = true;
        group.add(lightSensorBody);

        var lightLens = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 0.12, 18),
            new THREE.MeshPhongMaterial({ color: 0x777777, shininess: 90 })
        );
        lightLens.name = 'lightSensorLens';
        lightLens.position.set(0, 0.1, -1.72);
        group.add(lightLens);

        var caster = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), hubMaterial);
        caster.position.set(0, 0.3, 1.25);
        caster.castShadow = true;
        group.add(caster);

        var direction = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 24), new THREE.MeshPhongMaterial({ color: 0x33b8ca }));
        direction.name = 'directionMarker';
        direction.rotation.x = -Math.PI / 2;
        direction.position.set(0, 1.82, -1.75);
        direction.visible = !isRcx && !isApitor;
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

    function updateContainerState(objectCount) {
        var container = getElement('sim3dDiv');
        if (!container) return;
        container.setAttribute('data-codeon-3d-ready', initialized ? 'true' : 'false');
        container.setAttribute('data-codeon-3d-object-count', String(objectCount || 0));
        container.setAttribute('data-codeon-3d-ground-expanded', groundBackup ? 'true' : 'false');
    }

    function getObjectShape(source) {
        if (typeof source.r === 'number') return 'circle';
        if (typeof source.ax === 'number') return 'triangle';
        return 'rectangle';
    }

    function getStructureType(source) {
        if (source && source.codeOn3dStructure) return source.codeOn3dStructure;
        if (source && source.type === 'OBSTACLE' && getObjectShape(source) === 'triangle') return 'ramp-up';
        return null;
    }

    function getObjectCenter(source) {
        var shape = getObjectShape(source);
        if (shape === 'circle') return { x: source.x, y: source.y };
        if (shape === 'triangle') {
            return { x: (source.ax + source.bx + source.cx) / 3, y: (source.ay + source.by + source.cy) / 3 };
        }
        return { x: source.x + source.w / 2, y: source.y + source.h / 2 };
    }

    function moveObjectCenter(source, x, y) {
        var shape = getObjectShape(source);
        if (shape === 'triangle') {
            var center = getObjectCenter(source);
            var dx = x - center.x;
            var dy = y - center.y;
            source.ax += dx;
            source.ay += dy;
            source.bx += dx;
            source.by += dy;
            source.cx += dx;
            source.cy += dy;
            if (source.corners && source.corners.length === 3) {
                source.corners.forEach(function (corner) {
                    corner.x += dx;
                    corner.y += dy;
                });
            }
        } else if (typeof source.moveTo === 'function') {
            source.moveTo({ x: x, y: y });
        } else if (shape === 'circle') {
            source.x = x;
            source.y = y;
        } else {
            source.x = x - source.w / 2;
            source.y = y - source.h / 2;
        }
        if (source.myScene) {
            if (source.type === 'OBSTACLE') source.myScene.redrawObstacles = true;
            if (source.type === 'COLORAREA') source.myScene.redrawColorAreas = true;
        }
    }

    function objectSignature(source, scale) {
        var shape = getObjectShape(source);
        var structure = getStructureType(source) || '';
        var rotation = source.codeOn3dRotation || 0;
        if (shape === 'circle') return [shape, source.type, source.r, structure, rotation, scale].join(':');
        if (shape === 'triangle') {
            return [
                shape,
                source.type,
                source.bx - source.ax,
                source.by - source.ay,
                source.cx - source.ax,
                source.cy - source.ay,
                structure,
                rotation,
                scale,
            ].join(':');
        }
        return [shape, source.type, source.w, source.h, structure, rotation, scale].join(':');
    }

    function createRampGeometry(width, depth, height, descending) {
        var x0 = -width / 2;
        var x1 = width / 2;
        var zFront = depth / 2;
        var zBack = -depth / 2;
        var yFront = descending ? height : 0;
        var yBack = descending ? 0 : height;
        var positions = [];
        function triangle(a, b, c) {
            positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        }
        var fl = [x0, yFront, zFront];
        var fr = [x1, yFront, zFront];
        var bl = [x0, yBack, zBack];
        var br = [x1, yBack, zBack];
        var gfl = [x0, 0, zFront];
        var gfr = [x1, 0, zFront];
        var gbl = [x0, 0, zBack];
        var gbr = [x1, 0, zBack];
        triangle(fl, fr, br); triangle(fl, br, bl);
        triangle(gfr, gfl, gbl); triangle(gfr, gbl, gbr);
        triangle(gfl, fl, bl); triangle(gfl, bl, gbl);
        triangle(fr, gfr, gbr); triangle(fr, gbr, br);
        if (yFront > 0) { triangle(gfl, gfr, fr); triangle(gfl, fr, fl); }
        if (yBack > 0) { triangle(gbr, gbl, bl); triangle(gbr, bl, br); }
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        return geometry;
    }

    function getStructureConnectorDefinitions(structure, width, depth, height) {
        if (structure === 'ramp-up') {
            return [{ x: 0, z: -depth / 2, y: height, nx: 0, nz: -1 }];
        }
        if (structure === 'ramp-down') {
            return [{ x: 0, z: depth / 2, y: height, nx: 0, nz: 1 }];
        }
        return [
            { x: 0, z: -depth / 2, y: height, nx: 0, nz: -1 },
            { x: 0, z: depth / 2, y: height, nx: 0, nz: 1 },
            { x: -width / 2, z: 0, y: height, nx: -1, nz: 0 },
            { x: width / 2, z: 0, y: height, nx: 1, nz: 0 },
        ];
    }

    function addStructureConnectors(root, structure, width, depth, height) {
        var material = new THREE.MeshPhongMaterial({ color: 0x334155, shininess: 65 });
        getStructureConnectorDefinitions(structure, width, depth, height).forEach(function (connector) {
            var marker = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16), material);
            marker.position.set(connector.x, connector.y + 0.035, connector.z);
            marker.castShadow = true;
            root.add(marker);
        });
    }

    function disposeObjectRecord(record) {
        if (!record || !record.root) return;
        record.root.traverse(function (node) {
            if (node.geometry && typeof node.geometry.dispose === 'function') node.geometry.dispose();
            if (node.material) {
                var materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach(function (material) {
                    if (material && typeof material.dispose === 'function') material.dispose();
                });
            }
        });
        worldObjectGroup.remove(record.root);
    }

    function createWorldObjectRecord(source, scale) {
        var shape = getObjectShape(source);
        var isColorArea = source.type === 'COLORAREA';
        var structure = getStructureType(source);
        var flatColorArea = isColorArea && !structure;
        var height = flatColorArea ? 0.08 : (structure ? STRUCTURE_HEIGHT : 1.25);
        var geometry;
        var center = getObjectCenter(source);
        var structureWidth = 0;
        var structureDepth = 0;

        if (structure) {
            structureWidth = Math.max((source.w || 80) * scale, 0.8);
            structureDepth = Math.max((source.h || 130) * scale, 1.0);
            geometry = structure === 'plateau'
                ? new THREE.BoxGeometry(structureWidth, height, structureDepth)
                : createRampGeometry(structureWidth, structureDepth, height, structure === 'ramp-down');
        } else if (shape === 'circle') {
            var radius = Math.max(source.r * scale, 0.22);
            geometry = isColorArea ? new THREE.CircleGeometry(radius, 32) : new THREE.CylinderGeometry(radius, radius, height, 32);
        } else if (shape === 'triangle') {
            var ax = (source.ax - center.x) * scale;
            var az = (source.ay - center.y) * scale;
            var bx = (source.bx - center.x) * scale;
            var bz = (source.by - center.y) * scale;
            var cx = (source.cx - center.x) * scale;
            var cz = (source.cy - center.y) * scale;
            if (isColorArea) {
                geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute([ax, 0, az, bx, 0, bz, cx, 0, cz], 3));
                geometry.computeVertexNormals();
            } else {
                var radiusTriangle = Math.max(
                    Math.sqrt(ax * ax + az * az),
                    Math.sqrt(bx * bx + bz * bz),
                    Math.sqrt(cx * cx + cz * cz),
                    0.35
                );
                geometry = new THREE.ConeGeometry(radiusTriangle, height, 3);
            }
        } else {
            var width = Math.max(source.w * scale, 0.3);
            var depth = Math.max(source.h * scale, 0.3);
            geometry = isColorArea ? new THREE.PlaneGeometry(width, depth) : new THREE.BoxGeometry(width, height, depth);
        }

        var color = source.color || (isColorArea ? '#fbed00' : '#33b8ca');
        var material = flatColorArea
            ? new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
            : new THREE.MeshPhongMaterial({ color: color, shininess: 42 });
        var mesh = new THREE.Mesh(geometry, material);
        if (flatColorArea && shape !== 'triangle') mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = flatColorArea ? 0.055 : (structure && structure !== 'plateau' ? 0 : height / 2);
        mesh.castShadow = !flatColorArea;
        mesh.receiveShadow = true;

        var selectionMaterial = new THREE.MeshBasicMaterial({ color: 0x172033, wireframe: true, transparent: true, opacity: 0.85 });
        var selection = new THREE.Mesh(geometry, selectionMaterial);
        if (flatColorArea && shape !== 'triangle') selection.rotation.x = -Math.PI / 2;
        selection.position.y = flatColorArea ? 0.075 : (structure && structure !== 'plateau' ? 0.02 : height / 2 + 0.02);
        selection.scale.set(1.05, 1.05, 1.05);
        selection.visible = !!source.selected;

        var root = new THREE.Group();
        root.add(mesh);
        root.add(selection);
        if (structure) addStructureConnectors(root, structure, structureWidth, structureDepth, height);
        var record = {
            root: root,
            mesh: mesh,
            selection: selection,
            source: source,
            signature: objectSignature(source, scale),
            scale: scale,
            structure: structure,
            width: structureWidth,
            depth: structureDepth,
            height: structure ? height : 0,
        };
        root.userData.codeOnRecord = record;
        mesh.userData.codeOnRecord = record;
        selection.userData.codeOnRecord = record;
        worldObjectGroup.add(root);
        return record;
    }

    function placeNewObjectNearRobot(source, robot) {
        if (!robot || !robot.pose) return;
        var lane = (spawnCounter % 3) - 1;
        var distance = 115 + Math.floor(spawnCounter / 3) % 3 * 45;
        var lateral = lane * 150;
        var theta = robot.pose.theta || 0;
        var x = robot.pose.x + Math.cos(theta) * distance - Math.sin(theta) * lateral;
        var y = robot.pose.y + Math.sin(theta) * distance + Math.cos(theta) * lateral;
        moveObjectCenter(source, x, y);
        spawnCounter += 1;
    }

    function isOutsideOriginalGround(source) {
        if (!groundBackup) return false;
        var center = getObjectCenter(source);
        return (
            center.x < groundBackup.x - 50 ||
            center.x > groundBackup.x + groundBackup.w + 50 ||
            center.y < groundBackup.y - 50 ||
            center.y > groundBackup.y + groundBackup.h + 50
        );
    }

    function syncWorldObjects(simScene, robot, size, scale) {
        if (!worldObjectGroup || !simScene) return;
        var sources = (simScene.obstacleList || []).concat(simScene.colorAreaList || []);
        var live = {};

        sources.forEach(function (source) {
            var id = String(source.myId);
            live[id] = true;
            var record = worldObjectRecords[id];
            if (!record || record.source !== source || record.signature !== objectSignature(source, scale)) {
                if (record) disposeObjectRecord(record);
                if (!record && isOutsideOriginalGround(source)) placeNewObjectNearRobot(source, robot);
                record = createWorldObjectRecord(source, scale);
                worldObjectRecords[id] = record;
            }

            var center = getObjectCenter(source);
            record.root.position.set((center.x - size.width / 2) * scale, 0, (center.y - size.height / 2) * scale);
            record.root.rotation.y = (source.codeOn3dRotation || 0) * Math.PI / 2;
            if (record.mesh.material && record.mesh.material.color) record.mesh.material.color.set(source.color || '#33b8ca');
            record.selection.visible = !!source.selected;
        });

        Object.keys(worldObjectRecords).forEach(function (id) {
            if (!live[id]) {
                disposeObjectRecord(worldObjectRecords[id]);
                delete worldObjectRecords[id];
            }
        });
        updateContainerState(Object.keys(worldObjectRecords).length);
    }

    function expandSimulationGround(simScene) {
        var ground = simScene && simScene.ground;
        if (!ground) return;
        if (!groundBackup || groundBackup.ground !== ground) {
            restoreSimulationGround();
            groundBackup = { ground: ground, x: ground.x, y: ground.y, w: ground.w, h: ground.h };
        }
        ground.x = -100000;
        ground.y = -100000;
        ground.w = 200000;
        ground.h = 200000;
        updateContainerState(Object.keys(worldObjectRecords).length);
    }

    function restoreSimulationGround() {
        if (!groundBackup || !groundBackup.ground) return;
        groundBackup.ground.x = groundBackup.x;
        groundBackup.ground.y = groundBackup.y;
        groundBackup.ground.w = groundBackup.w;
        groundBackup.ground.h = groundBackup.h;
        groundBackup = null;
        updateContainerState(Object.keys(worldObjectRecords).length);
    }

    function findObjectRecord(object) {
        var current = object;
        while (current) {
            if (current.userData && current.userData.codeOnRecord) return current.userData.codeOnRecord;
            current = current.parent;
        }
        return null;
    }

    function pointerOnGround(event) {
        var rect = renderer.domElement.getBoundingClientRect();
        var mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);
        var point = new THREE.Vector3();
        return raycaster.ray.intersectPlane(groundPlane, point) ? point : null;
    }

    function beginObjectDrag(event) {
        if (event.button !== 0 || event.shiftKey || !worldObjectGroup) return false;
        var rect = renderer.domElement.getBoundingClientRect();
        var mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);
        var hits = raycaster.intersectObjects(worldObjectGroup.children, true);
        if (!hits.length) return false;
        var record = findObjectRecord(hits[0].object);
        var point = pointerOnGround(event);
        if (!record || !point) return false;
        record.source.selected = true;
        objectDrag = {
            record: record,
            offsetX: point.x - record.root.position.x,
            offsetZ: point.z - record.root.position.z,
        };
        renderer.domElement.focus();
        renderer.domElement.style.cursor = 'grabbing';
        return true;
    }

    function beginRobotDrag(event) {
        if (event.button !== 0 || event.shiftKey || !robotMesh || !lastWidth || !lastHeight) return false;
        var sim = getSimulationInstance();
        if (sim && typeof sim.isInterpreterRunning === 'function' && sim.isInterpreterRunning()) return false;
        var simScene = getSimulationScene();
        var robot = simScene && simScene.robots && simScene.robots[0];
        if (!robot || !robot.pose) return false;
        var rect = renderer.domElement.getBoundingClientRect();
        var mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);
        if (!raycaster.intersectObject(robotMesh, true).length) return false;
        var point = pointerOnGround(event);
        if (!point) return false;
        robotDrag = {
            robot: robot,
            offsetX: point.x - robotMesh.position.x,
            offsetZ: point.z - robotMesh.position.z,
        };
        robot.selected = true;
        renderer.domElement.style.cursor = 'grabbing';
        return true;
    }

    function rotateStructureVector(x, z, turns) {
        var angle = (turns || 0) * Math.PI / 2;
        return {
            x: Math.cos(angle) * x + Math.sin(angle) * z,
            z: -Math.sin(angle) * x + Math.cos(angle) * z,
        };
    }

    function getStructureFootprint(record, centerX, centerZ) {
        var turns = (record.source.codeOn3dRotation || 0) % 2;
        var width = turns ? record.depth : record.width;
        var depth = turns ? record.width : record.depth;
        return {
            minX: centerX - width / 2,
            maxX: centerX + width / 2,
            minZ: centerZ - depth / 2,
            maxZ: centerZ + depth / 2,
        };
    }

    function footprintsOverlap(a, b) {
        var epsilon = 0.035;
        return a.minX < b.maxX - epsilon && a.maxX > b.minX + epsilon &&
            a.minZ < b.maxZ - epsilon && a.maxZ > b.minZ + epsilon;
    }

    function structureWouldOverlap(record, centerX, centerZ) {
        var footprint = getStructureFootprint(record, centerX, centerZ);
        return Object.keys(worldObjectRecords).some(function (id) {
            var other = worldObjectRecords[id];
            if (!other || other === record || !other.structure) return false;
            return footprintsOverlap(footprint, getStructureFootprint(other, other.root.position.x, other.root.position.z));
        });
    }

    function getWorldConnectors(record, centerX, centerZ) {
        var turns = record.source.codeOn3dRotation || 0;
        return getStructureConnectorDefinitions(record.structure, record.width, record.depth, record.height).map(function (connector) {
            var position = rotateStructureVector(connector.x, connector.z, turns);
            var normal = rotateStructureVector(connector.nx, connector.nz, turns);
            return {
                x: centerX + position.x,
                z: centerZ + position.z,
                y: connector.y,
                nx: normal.x,
                nz: normal.z,
            };
        });
    }

    function snapStructurePosition(record, centerX, centerZ) {
        var best = null;
        var ownConnectors = getWorldConnectors(record, centerX, centerZ);
        Object.keys(worldObjectRecords).forEach(function (id) {
            var other = worldObjectRecords[id];
            if (!other || other === record || !other.structure) return;
            var otherConnectors = getWorldConnectors(other, other.root.position.x, other.root.position.z);
            ownConnectors.forEach(function (own) {
                otherConnectors.forEach(function (target) {
                    if (Math.abs(own.y - target.y) > 0.08) return;
                    if (own.nx * target.nx + own.nz * target.nz > -0.8) return;
                    var dx = target.x - own.x;
                    var dz = target.z - own.z;
                    var distance = Math.sqrt(dx * dx + dz * dz);
                    if (distance <= SNAP_DISTANCE && (!best || distance < best.distance)) {
                        best = { x: centerX + dx, z: centerZ + dz, distance: distance };
                    }
                });
            });
        });
        if (best && !structureWouldOverlap(record, best.x, best.z)) return best;
        return { x: centerX, z: centerZ, distance: null };
    }

    function moveDraggedObject(event) {
        if (!objectDrag || !lastWidth || !lastHeight) return false;
        var point = pointerOnGround(event);
        if (!point) return true;
        var scale = objectDrag.record.scale;
        var worldX = point.x - objectDrag.offsetX;
        var worldZ = point.z - objectDrag.offsetZ;
        if (objectDrag.record.structure) {
            var snapped = snapStructurePosition(objectDrag.record, worldX, worldZ);
            worldX = snapped.x;
            worldZ = snapped.z;
            objectDrag.record.root.userData.codeOnSnapped = snapped.distance !== null;
            if (structureWouldOverlap(objectDrag.record, worldX, worldZ)) return true;
        }
        moveObjectCenter(
            objectDrag.record.source,
            worldX / scale + lastWidth / 2,
            worldZ / scale + lastHeight / 2
        );
        return true;
    }

    function moveDraggedRobot(event) {
        if (!robotDrag || !lastWorldScale) return false;
        var point = pointerOnGround(event);
        if (!point) return true;
        var robot = robotDrag.robot;
        var visibleX = point.x - robotDrag.offsetX;
        var visibleZ = point.z - robotDrag.offsetZ;
        robot.pose.xOld = robot.pose.x;
        robot.pose.yOld = robot.pose.y;
        robot.pose.x = (visibleX + Math.cos(robot.pose.theta) * lastRearwardCorrection) / lastWorldScale + lastWidth / 2;
        robot.pose.y = (visibleZ + Math.sin(robot.pose.theta) * lastRearwardCorrection) / lastWorldScale + lastHeight / 2;
        if (robot.chassis && typeof robot.chassis.transformNewPose === 'function') {
            robot.chassis.transformNewPose(robot.pose, robot.chassis);
        }
        return true;
    }

    function finishRobotDrag() {
        if (!robotDrag) return;
        var robot = robotDrag.robot;
        if (robot.initialPose) {
            robot.initialPose.x = robot.pose.x;
            robot.initialPose.y = robot.pose.y;
            robot.initialPose.theta = robot.pose.theta;
        }
        robot.pose.xOld = robot.pose.x;
        robot.pose.yOld = robot.pose.y;
        lastRobotPose = { x: robot.pose.x, y: robot.pose.y, theta: robot.pose.theta };
        robotDrag = null;
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

    function rotateSelectedStructure(turns) {
        var record = null;
        Object.keys(worldObjectRecords).some(function (id) {
            var candidate = worldObjectRecords[id];
            if (candidate && candidate.structure && candidate.source.selected) {
                record = candidate;
                return true;
            }
            return false;
        });
        if (!record) return false;
        var oldTurns = record.source.codeOn3dRotation || 0;
        record.source.codeOn3dRotation = turns;
        var centerX = record.root.position.x;
        var centerZ = record.root.position.z;
        if (structureWouldOverlap(record, centerX, centerZ)) {
            record.source.codeOn3dRotation = oldTurns;
            return true;
        }
        var snapped = snapStructurePosition(record, centerX, centerZ);
        moveObjectCenter(
            record.source,
            snapped.x / record.scale + lastWidth / 2,
            snapped.z / record.scale + lastHeight / 2
        );
        if (typeof record.source.updateCorners === 'function') record.source.updateCorners();
        return true;
    }

    function attachNavigation() {
        var canvas = renderer.domElement;
        canvas.style.touchAction = 'none';
        canvas.tabIndex = 0;
        canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
        canvas.addEventListener('pointerdown', function (event) {
            if (!enabled) return;
            if (beginObjectDrag(event)) {
                canvas.setPointerCapture(event.pointerId);
                return;
            }
            if (beginRobotDrag(event)) {
                canvas.setPointerCapture(event.pointerId);
                return;
            }
            drag = { x: event.clientX, y: event.clientY, pan: event.button === 2 || event.shiftKey };
            canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener('pointermove', function (event) {
            if (moveDraggedObject(event)) return;
            if (moveDraggedRobot(event)) return;
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
            if (objectDrag && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            if (robotDrag && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            drag = null;
            objectDrag = null;
            finishRobotDrag();
            canvas.style.cursor = 'default';
        }
        canvas.addEventListener('pointerup', stopDrag);
        canvas.addEventListener('pointercancel', stopDrag);
        canvas.addEventListener('wheel', function (event) {
            if (!enabled) return;
            event.preventDefault();
            orbit.distance = Math.max(5, Math.min(60, orbit.distance * (event.deltaY > 0 ? 1.1 : 0.9)));
            updateCamera();
        }, { passive: false });
        canvas.addEventListener('keydown', function (event) {
            var turnsByKey = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
            if (!Object.prototype.hasOwnProperty.call(turnsByKey, event.key)) return;
            if (rotateSelectedStructure(turnsByKey[event.key])) {
                event.preventDefault();
                event.stopPropagation();
            }
        });
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

        worldObjectGroup = new THREE.Group();
        worldObjectGroup.name = 'codeOnWorldObjects';
        scene.add(worldObjectGroup);
        raycaster = new THREE.Raycaster();
        groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        robotMesh = buildRobot();
        scene.add(robotMesh);
        if (robotMesh.userData.isCozmo) {
            cozmoCube = createCozmoCube();
            scene.add(cozmoCube);
            cozmoCubePlaced = false;
            cozmoCubeHeld = false;
        }

        attachNavigation();
        initialized = true;
        updateContainerState(0);
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

    function normalizeAngleDelta(value) {
        while (value > Math.PI) value -= Math.PI * 2;
        while (value < -Math.PI) value += Math.PI * 2;
        return value;
    }

    function updateWheelAnimation(robot, scale, robotVisualScale) {
        var pose = robot.pose;
        if (!lastRobotPose || robotDrag) {
            lastRobotPose = { x: pose.x, y: pose.y, theta: pose.theta };
            return false;
        }
        var dx = pose.x - lastRobotPose.x;
        var dy = pose.y - lastRobotPose.y;
        var dTheta = normalizeAngleDelta(pose.theta - lastRobotPose.theta);
        var jump = Math.sqrt(dx * dx + dy * dy) > 80;
        if (jump) {
            lastRobotPose = { x: pose.x, y: pose.y, theta: pose.theta };
            return false;
        }
        var heading = pose.theta - dTheta / 2;
        var forwardDistance = dx * Math.cos(heading) + dy * Math.sin(heading);
        var trackWidth = robot.chassis && robot.chassis.TRACKWIDTH ? robot.chassis.TRACKWIDTH : 45;
        var leftDistance = forwardDistance - dTheta * trackWidth / 2;
        var rightDistance = forwardDistance + dTheta * trackWidth / 2;
        var visualRadius = Math.max(0.78 * robotVisualScale, 0.001);
        wheelRotation.left += leftDistance * scale / visualRadius;
        wheelRotation.right += rightDistance * scale / visualRadius;
        if (robotMesh.userData.leftWheel) robotMesh.userData.leftWheel.rotation.x = wheelRotation.left;
        if (robotMesh.userData.rightWheel) robotMesh.userData.rightWheel.rotation.x = wheelRotation.right;
        lastRobotPose = { x: pose.x, y: pose.y, theta: pose.theta };
        return Math.abs(forwardDistance) > 0.01 || Math.abs(dTheta) > 0.0005;
    }

    function syncCozmoLift(robot) {
        if (!robotMesh || !robotMesh.userData.isCozmo) return null;
        var lift = robotMesh.userData.cozmoLift;
        var height = robot.chassis && typeof robot.chassis.liftPosition === 'number' ? robot.chassis.liftPosition : 0;
        if (lift) lift.rotation.x = height * 0.68;
        robotMesh.updateMatrixWorld(true);

        if (cozmoCube && !cozmoCubePlaced) {
            var start = new THREE.Vector3(0, 0.34, -3.12).applyMatrix4(robotMesh.matrixWorld);
            cozmoCube.position.copy(start);
            cozmoCubePlaced = true;
        }
        if (cozmoCube && lift) {
            var forkPosition = new THREE.Vector3(0, 0, -1.78).applyMatrix4(lift.matrixWorld);
            if (!cozmoCubeHeld && height > 0.28 && cozmoCube.position.distanceTo(forkPosition) < 0.85) {
                cozmoCubeHeld = true;
                // Attach the cube to the moving lift instead of merely copying
                // one world position. It then inherits every drive and turn of
                // the robot until the lift puts it down again.
                lift.attach(cozmoCube);
                cozmoCube.position.set(0, 0.18 / Math.max(robotMesh.scale.y, 0.001), -1.78);
            } else if (cozmoCubeHeld && height < 0.12) {
                scene.attach(cozmoCube);
                cozmoCube.position.y = Math.max(0.31, cozmoCube.position.y);
                cozmoCubeHeld = false;
            }
            if (cozmoCubeHeld) {
                cozmoCube.position.x = 0;
                cozmoCube.position.z = -1.78;
            }
        }
        return height;
    }

    function getStructureSurface(worldX, worldZ) {
        var best = { elevation: 0, uphillX: 0, uphillZ: 0, slope: 0, structure: null };
        Object.keys(worldObjectRecords).forEach(function (id) {
            var record = worldObjectRecords[id];
            if (!record || !record.structure) return;
            var turns = record.source.codeOn3dRotation || 0;
            var angle = turns * Math.PI / 2;
            var dx = worldX - record.root.position.x;
            var dz = worldZ - record.root.position.z;
            var localX = Math.cos(angle) * dx - Math.sin(angle) * dz;
            var localZ = Math.sin(angle) * dx + Math.cos(angle) * dz;
            if (Math.abs(localX) > record.width / 2 || Math.abs(localZ) > record.depth / 2) return;
            var elevation = record.height;
            var uphillLocalZ = 0;
            var slope = 0;
            if (record.structure === 'ramp-up') {
                elevation = record.height * (record.depth / 2 - localZ) / record.depth;
                uphillLocalZ = -1;
                slope = Math.atan2(record.height, record.depth);
            } else if (record.structure === 'ramp-down') {
                elevation = record.height * (record.depth / 2 + localZ) / record.depth;
                uphillLocalZ = 1;
                slope = Math.atan2(record.height, record.depth);
            }
            if (elevation >= best.elevation) {
                var uphill = rotateStructureVector(0, uphillLocalZ, turns);
                best = {
                    elevation: Math.max(0, Math.min(record.height, elevation)),
                    uphillX: uphill.x,
                    uphillZ: uphill.z,
                    slope: slope,
                    structure: record.structure,
                };
            }
        });
        return best;
    }

    function syncRobotPose() {
        if (!robotMesh) return;
        var simScene = getSimulationScene();
        var robot = simScene && simScene.robots && simScene.robots.length ? simScene.robots[0] : null;
        if (!robot || !robot.pose) return;

        updateRobotAppearance(robot);
        var sensorState = updateRobotSensorsAppearance(robot) || { touch: false, touchFound: false, light: null };
        expandSimulationGround(simScene);

        var size = getCanvasSize(simScene);
        lastWidth = size.width;
        lastHeight = size.height;
        var scale = 18 / Math.max(lastWidth, lastHeight);
        // The 2D RCX collision body is 55 x 45 simulation units. Keep the complete
        // visible 3D robot (including its wheels) inside that footprint so a
        // collision and the rendered contact point agree.
        var robotVisualScale = (45 * scale) / 3.3;
        var frontVisual = 2.16 * robotVisualScale;
        var frontCollision = 25 * scale;
        var rearwardCorrection = Math.max(0, frontVisual - frontCollision);
        lastWorldScale = scale;
        lastRearwardCorrection = rearwardCorrection;
        var moving = updateWheelAnimation(robot, scale, robotVisualScale);
        robotMesh.scale.set(robotVisualScale, robotVisualScale, robotVisualScale);
        robotMesh.position.x = (robot.pose.x - lastWidth / 2) * scale - Math.cos(robot.pose.theta) * rearwardCorrection;
        robotMesh.position.z = (robot.pose.y - lastHeight / 2) * scale - Math.sin(robot.pose.theta) * rearwardCorrection;
        syncWorldObjects(simScene, robot, size, scale);
        var surface = getStructureSurface(robotMesh.position.x, robotMesh.position.z);
        robotMesh.position.y = surface.elevation;
        // In the Three.js model the front points towards local -Z; in the 2D
        // simulation heading 0 points towards +X.
        var pitch = surface.slope * (
            Math.cos(robot.pose.theta) * surface.uphillX + Math.sin(robot.pose.theta) * surface.uphillZ
        );
        robotMesh.rotation.order = 'YXZ';
        robotMesh.rotation.set(pitch, -robot.pose.theta - Math.PI / 2, 0);
        var cozmoLiftHeight = syncCozmoLift(robot);

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
                'Richtung: ' + degrees + '°\n' +
                'Fahrt: ' + (moving ? 'aktiv' : 'steht') + '\n' +
                'Hoehe: ' + surface.elevation.toFixed(1) + '\n' +
                (cozmoLiftHeight === null ? '' : 'Lift: ' + Math.round(cozmoLiftHeight * 100) + ' %\n') +
                'Taster: ' + (sensorState.touchFound ? (sensorState.touch ? 'JA' : 'nein') : '--') +
                '   Licht: ' + (sensorState.light === null ? '--' : Math.round(sensorState.light) + ' %');
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
            restoreSimulationGround();
            if (sim3dDiv) sim3dDiv.style.display = 'none';
            if (canvasDiv) canvasDiv.style.display = '';
            if (toggle) toggle.classList.remove('active');
            requestAnimationFrame(restore2dLayout);
        }
    }

    function toggle() {
        setMode(!enabled);
    }

    function add3dStructure(type) {
        var sim = getSimulationInstance();
        var simScene = getSimulationScene();
        if (!sim || !simScene || typeof sim.addColorArea !== 'function') return;
        // Structures deliberately live outside the 2D obstacle collision list.
        // Their height and slope are handled analytically by this 3D adapter.
        sim.addColorArea('RECTANGLE');
        var source = simScene.colorAreaList && simScene.colorAreaList[simScene.colorAreaList.length - 1];
        var robot = simScene.robots && simScene.robots[0];
        if (!source) return;
        source.codeOn3dStructure = type;
        source.codeOn3dRotation = 0;
        source.w = 80;
        source.h = type === 'plateau' ? 85 : 130;
        if (typeof source.updateCorners === 'function') source.updateCorners();
        placeNewObjectNearRobot(source, robot);
        if (typeof source.updateCorners === 'function') source.updateCorners();
        simScene.redrawColorAreas = true;
        if (typeof sim.enableChangeObjectButtons === 'function') sim.enableChangeObjectButtons();
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var structureButton = target.closest('[data-codeon-3d-structure]');
        if (structureButton) {
            event.preventDefault();
            add3dStructure(structureButton.getAttribute('data-codeon-3d-structure'));
            return;
        }
        if (target.closest('#simObstacleDeleteAll')) {
            var simScene = getSimulationScene();
            if (simScene && simScene.colorAreaList) {
                simScene.colorAreaList = simScene.colorAreaList.filter(function (source) {
                    return !getStructureType(source);
                });
                simScene.redrawColorAreas = true;
            }
            return;
        }
        if (!target.closest('#sim3dToggle')) return;
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
        getDebugState: function () {
            return {
                enabled: enabled,
                initialized: initialized,
                objectCount: Object.keys(worldObjectRecords).length,
                groundExpanded: !!groundBackup,
                robotDraggable: true,
                wheelAnimation: true,
                wheelRotation: { left: wheelRotation.left, right: wheelRotation.right },
                structures: Object.keys(worldObjectRecords).map(function (id) {
                    var record = worldObjectRecords[id];
                    if (!record || !record.structure) return null;
                    return {
                        type: record.structure,
                        x: record.root.position.x,
                        z: record.root.position.z,
                        width: record.width,
                        depth: record.depth,
                        rotation: record.source.codeOn3dRotation || 0,
                        snapped: !!record.root.userData.codeOnSnapped,
                    };
                }).filter(Boolean),
            };
        },
    };
})();
