/* Apitor visual model, derived from CodeON's RCX model / Thorlogy
 * 3D-RoboMission buildEV3Robot, commit 08747705dd366590a10692d4215a82f4537581fc.
 * CC BY-SA 4.0. See licenses/apitor-visual-model.md.
 * Illustrative wheeled build, not a precise hardware replica.
 * Geometry only; no invented sensor, screen, gripper or hardware behavior.
 */
(function (root) {
    'use strict';
    root.CodeOnApitorVisual = function (THREE) {
        const group = new THREE.Group();
        group.name = 'apitorVisualGeometry';
        const material = color => new THREE.MeshPhongMaterial({color, shininess: 35});
        const orange = material(0xffbb16), white = material(0xf1f4f5);
        const cyan = material(0x00b8cf), navy = material(0x172e4b);
        function mesh(name, geometry, mat, x, y, z, parent = group) {
            const object = new THREE.Mesh(geometry, mat);
            object.name = name; object.position.set(x,y,z);
            object.castShadow = object.receiveShadow = true;
            parent.add(object); return object;
        }
        function box(name,w,h,d,mat,x,y,z,parent) {
            return mesh(name,new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);
        }
        box('chassis',2.15,.35,2.8,navy,0,.74,.05);
        box('robotBody',1.9,.68,1.85,orange,0,1.73,.05);
        box('hubBase',2.04,.14,1.96,white,0,1.34,.05);
        box('hubButton',.46,.08,.21,white,-.2,2.11,-.25);
        for(let i=0;i<3;i++) mesh('hubIndicator'+i,new THREE.CylinderGeometry(.035,.035,.03,12),cyan,.35+i*.15,2.09,-.25);
        // Construction beams and connector inserts, not simulated sensors.
        for(const side of [-1,1]) {
            box('sideBeam',.25,.32,2.9,white,side*1.1,1.18,.05);
            box('rearSupport',.25,.8,.25,white,side*1.1,1.7,1.2);
            for(let i=0;i<6;i++) {
                const pin=mesh('beamPin',new THREE.CylinderGeometry(.09,.09,.27,12),navy,side*1.1,1.18,-1.07+i*.44);
                pin.rotation.z=Math.PI/2;
            }
            box('frontCoupler',.32,.38,.36,cyan,side*1.05,.97,-1.25);
        }
        box('frontBeam',2.05,.28,.25,white,0,.98,-1.35);
        for(let i=0;i<5;i++) {
            const pin=mesh('frontPin',new THREE.CylinderGeometry(.075,.075,.27,12),navy,-.72+i*.36,.98,-1.35);
            pin.rotation.x=Math.PI/2;
        }
        function wheel(side) {
            const assembly=new THREE.Group();
            assembly.name=side<0?'leftWheel':'rightWheel';
            assembly.position.set(side*1.58,.983,.1);group.add(assembly);
            for(const part of [
                ['tire',.95,.55,navy],['rim',.68,.58,white],
                ['hub',.46,.61,cyan],['hubCap',.23,.64,orange]
            ]) {
                const cylinder=mesh(part[0],new THREE.CylinderGeometry(part[1],part[1],part[2],32),part[3],0,0,0,assembly);
                cylinder.rotation.z=Math.PI/2;
            }
            for(let i=0;i<16;i++) {
                const a=i*Math.PI/8;
                const tread=box('wheelTread',.56,.065,.17,navy,0,.95*Math.cos(a),.95*Math.sin(a),assembly);
                tread.rotation.x=a;
            }
            return assembly;
        }
        const left=wheel(-1),right=wheel(1);
        mesh('rearCaster',new THREE.SphereGeometry(.28,16,12),navy,0,.28,1.4);
        const normalized=new THREE.Group();normalized.name='apitorVisualModel';
        const normalization=3.3/new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).x;
        group.scale.setScalar(normalization);normalized.add(group);
        normalized.userData.leftWheel=left;normalized.userData.rightWheel=right;
        normalized.userData.wheelRotationSign=-1;
        normalized.userData.visualWheelRadius=.983*normalization;
        normalized.userData.frontExtent=1.5*normalization;
        return normalized;
    };
})(window);
