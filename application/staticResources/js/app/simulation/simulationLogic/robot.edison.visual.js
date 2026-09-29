/* Edison visual geometry. Wheel/helper conventions adapted from CodeON's
 * RCX model / Thorlogy 3D-RoboMission, CC BY-SA 4.0.
 * See licenses/edison-visual-model.md. No simulation or hardware behavior.
 */
(function(root) {
    'use strict';
    root.CodeOnEdisonVisual = function(THREE) {
        const group=new THREE.Group();group.name='edisonVisualGeometry';
        const mat=color=>new THREE.MeshPhongMaterial({color,shininess:45});
        const orange=mat(0xf45b12),board=mat(0xe16b24),dark=mat(0x343b40),grey=mat(0x818c91),metal=mat(0xd1c9a4);
        const glass=new THREE.MeshPhongMaterial({color:0xe5f3f6,transparent:true,opacity:.26,shininess:100,depthWrite:false});
        function mesh(name,geometry,material,x,y,z,parent=group) {
            const object=new THREE.Mesh(geometry,material);object.name=name;
            object.position.set(x,y,z);object.castShadow=material!==glass;object.receiveShadow=true;
            parent.add(object);return object;
        }
        const box=(name,w,h,d,m,x,y,z,parent)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
        box('robotBody',2.68,.78,3.1,orange,0,.66,0);
        box('circuitBoard',2.5,.04,2.91,board,0,1.065,0);
        // Passive visual details of the built-in electronics, not new sensors.
        for(const [x,z] of [[-.8,-.65],[.68,-.6],[-.73,.43],[.8,.7]]) {
            box('chip',.3,.055,.23,dark,x,1.12,z);
            box('trace',.018,.012,.55,metal,x+.22,1.1,z);
            box('component',.1,.06,.16,metal,x-.22,1.13,z+.2);
        }
        box('clearCover',2.72,.12,3.14,glass,0,1.19,0);
        for(const x of [-1.12,-.75,.75,1.12]) for(let i=0;i<7;i++) {
            const stud=mesh('mountingStud',new THREE.TorusGeometry(.105,.035,6,16),glass,x,1.3,-1.22+i*.405);
            stud.rotation.x=Math.PI/2;
        }
        box('controlRecess',.72,.07,1.4,grey,0,1.29,.3);
        mesh('recordButton',new THREE.CylinderGeometry(.25,.25,.07,24),dark,0,1.36,.73);
        box('stopButton',.47,.07,.4,dark,0,1.36,.23);
        const triangle=new THREE.Shape();triangle.moveTo(-.25,0);triangle.lineTo(.25,0);triangle.lineTo(0,.38);triangle.closePath();
        const play=mesh('playButton',new THREE.ExtrudeGeometry(triangle,{depth:.07,bevelEnabled:false}),dark,0,1.32,-.04);
        play.rotation.x=-Math.PI/2;
        mesh('soundGrille',new THREE.CylinderGeometry(.22,.22,.055,24),metal,-.65,1.24,-.75);
        box('frontWindow',1.35,.24,.11,dark,0,1.01,-1.59);
        box('frontClearRim',2.6,.15,.12,glass,0,1.21,-1.59);
        for(const side of [-1,1]) for(const z of [-.9,-.48,-.06]) {
            const port=mesh('constructionSocket',new THREE.CylinderGeometry(.09,.09,.025,12),dark,side*1.345,.66,z);
            port.rotation.z=Math.PI/2;
        }
        function wheel(side) {
            const assembly=new THREE.Group();assembly.name=side<0?'leftWheel':'rightWheel';
            assembly.position.set(side*1.5,.8,.65);group.add(assembly);
            for(const [name,radius,width,material] of [['tire',.78,.28,dark],['wheelHub',.59,.3,grey],['axle',.12,.34,dark]]) {
                const part=mesh(name,new THREE.CylinderGeometry(radius,radius,width,32),material,0,0,0,assembly);
                part.rotation.z=Math.PI/2;
            }
            for(let i=0;i<16;i++) {
                const a=i*Math.PI/8;
                const tread=box('wheelTread',.28,.04,.1,dark,0,.78*Math.cos(a),.78*Math.sin(a),assembly);
                tread.rotation.x=a;
            }
            return assembly;
        }
        const left=wheel(-1),right=wheel(1);
        box('frontSkid',.5,.14,.45,dark,0,.2,-1.13);
        const normalized=new THREE.Group();normalized.name='edisonVisualModel';
        const scale=3.3/new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).x;
        group.scale.setScalar(scale);normalized.add(group);
        Object.assign(normalized.userData,{leftWheel:left,rightWheel:right,wheelRotationSign:-1,visualWheelRadius:.8*scale,frontExtent:1.66*scale});
        return normalized;
    };
})(window);
