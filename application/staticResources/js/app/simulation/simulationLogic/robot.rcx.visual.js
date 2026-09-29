/* RCX visual model, adapted from Thorlogy/3D-RoboMission buildEV3Robot.
 * Source commit 08747705dd366590a10692d4215a82f4537581fc.
 * This adapted model: CC BY-SA 4.0; no warranty.
 * https://creativecommons.org/licenses/by-sa/4.0/
 * Source: https://github.com/Thorlogy/3D-RoboMission
 * Changes: RCX shell/controls, wheel groups, removed fixed sensors.
 * See licenses/rcx-visual-model.md. This file is not Apache-2.0 licensed.
 * Geometry only: no physics, hardware, sensor readings or simulation state.
 */
(function (root) {
    'use strict';
    root.CodeOnRcxVisual = function (THREE) {
        const group = new THREE.Group();
        group.name = 'rcxVisualGeometry';
        const yellow = new THREE.MeshPhongMaterial({color: 0xf5c900, shininess: 40});
        const dark = new THREE.MeshPhongMaterial({color: 0x202933, shininess: 16});
        const grey = new THREE.MeshPhongMaterial({color: 0x7e8b94, shininess: 45});
        const lcd = new THREE.MeshPhongMaterial({color: 0xb9c5ab, shininess: 12});
        function mesh(name, geometry, material, x, y, z, parent = group) {
            const object = new THREE.Mesh(geometry, material);
            object.name = name; object.position.set(x, y, z);
            object.castShadow = true; object.receiveShadow = true;
            parent.add(object); return object;
        }
        function box(name, w, h, d, material, x, y, z, parent) {
            return mesh(name, new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
        }
        box('chassis', 2.3, .35, 2.9, dark, 0, .67, .05);
        box('robotBody', 2.4, 1.1, 3.2, yellow, 0, 1.38, 0);
        box('topPanel', 2.12, .12, 2.95, yellow, 0, 1.99, 0);
        box('displayFrame', 1.48, .09, .86, dark, 0, 2.1, -.36);
        box('robotDisplay', 1.26, .035, .64, lcd, 0, 2.16, -.36);
        // Physical controls, not sensors or status lights.
        const buttons = [0xe95142, 0x74b83a, 0x88939e, 0x88939e];
        buttons.forEach((color, i) => {
            mesh('controlButton' + i, new THREE.CylinderGeometry(.16, .16, .08, 16),
                new THREE.MeshPhongMaterial({color}), -.69 + i * .46, 2.13, .52);
        });
        // Connection sockets without attached/imagined sensors.
        [-.7, 0, .7].forEach((x, i) => {
            box('frontSocket' + i, .46, .13, .31, dark, x, 2.1, -1.25);
            box('rearSocket' + i, .46, .13, .31, dark, x, 2.1, 1.24);
        });
        function wheel(side) {
            const assembly = new THREE.Group();
            assembly.name = side < 0 ? 'leftWheel' : 'rightWheel';
            assembly.position.set(side * 1.58, .983, .1);
            group.add(assembly);
            const tire = mesh('tire', new THREE.CylinderGeometry(.95, .95, .55, 32), dark, 0, 0, 0, assembly);
            tire.rotation.z = Math.PI / 2;
            const hub = mesh('hub', new THREE.CylinderGeometry(.46, .46, .59, 20), grey, 0, 0, 0, assembly);
            hub.rotation.z = Math.PI / 2;
            // Short tread blocks make these visibly separate wheels, not tracks.
            for (let i = 0; i < 16; i++) {
                const a = i * Math.PI / 8;
                const tread = box('wheelTread', .56, .065, .17, dark, 0,
                    .95 * Math.cos(a), .95 * Math.sin(a), assembly);
                tread.rotation.x = a;
            }
            const cap = mesh('hubCap', new THREE.CylinderGeometry(.17, .17, .63, 16), yellow, 0, 0, 0, assembly);
            cap.rotation.z = Math.PI / 2;
            return assembly;
        }
        group.userData.leftWheel = wheel(-1);
        group.userData.rightWheel = wheel(1);
        mesh('rearCaster', new THREE.SphereGeometry(.28, 16, 12), grey, 0, .28, 1.4);
        // Keep the complete model inside the adapter's established 3.3-unit
        // width contract. Do not change the 2D chassis/collision/sensor geometry.
        const normalized = new THREE.Group();
        normalized.name = 'rcxVisualModel';
        const normalization = 3.3 / new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).x;
        group.scale.setScalar(normalization);
        normalized.add(group);
        normalized.userData.leftWheel = group.userData.leftWheel;
        normalized.userData.wheelRotationSign = -1; // Contact surface rolls opposite travel.
        normalized.userData.rightWheel = group.userData.rightWheel;
        normalized.userData.visualWheelRadius = .983 * normalization;
        normalized.userData.frontExtent = 1.6 * normalization;
        return normalized;
    };
})(window);
