/* Visual-only sensor attachments. No collision geometry or sensor updates. */
(function(root,factory){
    if(typeof module==='object' && module.exports) module.exports=factory();
    else root.CodeOnSensorGeometry=factory();
})(typeof window!=='undefined'?window:globalThis,function(){
    'use strict';
    const records=new WeakMap();
    const units=3.3/45; // Established adapter scale: 45 simulation units = 3.3 model units.
    function dispose(group){
        const geometries=new Set(),materials=new Set();
        group.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.material)materials.add(node.material);});
        geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());
    }
    function build(THREE,descriptors){
        const root=new THREE.Group();root.name='configuredSensors';
        const bumpers=new Map();
        const touchCounts=new Map();
        descriptors.filter(d=>d.family==='rcx'&&d.type==='TOUCH').forEach(d=>touchCounts.set(d.side,(touchCounts.get(d.side)||0)+1));
        for(const d of descriptors){
            const sideMount=d.mountPosition==='right'||d.mountPosition==='left';
            const bumperKey=JSON.stringify([d.mountX,d.mountY,d.theta,d.side]);
            if(d.type==='TOUCH' && bumpers.has(bumperKey)){
                bumpers.get(bumperKey).userData.sensorIds.push(d.id);continue;
            }
            const group=new THREE.Group();group.name='configuredSensor:'+d.type;
            group.userData.sensorIds=[d.id];group.userData.type=d.type;
            group.position.set(d.mountY*units,d.mountHeight||0,-d.mountX*units);group.rotation.y=-d.theta;group.rotation.x=d.mountPitch||0;
            root.add(group);
            if(d.type==='TOUCH')bumpers.set(bumperKey,group);
            const dark=new THREE.MeshPhongMaterial({color:0x26384b,shininess:30});
            const shell=new THREE.MeshPhongMaterial({color:0xe2e8ed,shininess:45});
            const accent=new THREE.MeshPhongMaterial({color:d.type==='TOUCH'?0xc84138:d.type==='INDUCTIVE'?0xf2aa25:0x00acc1,shininess:70});
            function mesh(geometry,material,x,y,z){
                const item=new THREE.Mesh(geometry,material);item.position.set(x,y,z);item.castShadow=true;group.add(item);return item;
            }
            const box=(w,h,l,mat,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,l),mat,x,y,z);
            if(d.mountPosition){
                if(sideMount){
                    // Bridge the gap from the chassis side to a pod above the
                    // wheel's top edge. Local -Z faces outboard after rotation.
                    box(.18,.12,.64,dark,0,-.03,-.32);
                }
                if(d.type==='TOUCH'){
                    box(.5,.24,.18,dark,0,.12,sideMount?-.66:.02);
                    box(.42,.2,.12,accent,0,.12,sideMount?-.8:-.12);
                    box(.3,.2,.22,shell,0,.1,sideMount?-.5:.14);
                }else{
                    const podZ=sideMount?-.62:0;
                    box(.5,.3,.48,shell,0,.15,podZ);
                    if(d.type==='ULTRASONIC'){
                        const lens=(x,r)=>{const item=mesh(new THREE.CylinderGeometry(r,r,.07,20),accent,x,.15,podZ-.255);item.rotation.x=Math.PI/2;};
                        lens(-.14,.1);lens(.14,.1);
                    }else{
                        const lens=mesh(new THREE.CylinderGeometry(.11,.11,.07,20),accent,0,.15,podZ-.255);lens.rotation.x=Math.PI/2;
                    }
                }
            }else if(d.type==='TOUCH'){
                const individual=d.family==='rcx'&&(touchCounts.get(d.side)||0)>1;
                box(individual ? .52 : 1.15,.24,.18,dark,0,.57,.1);
                box(individual ? .44 : 1.05,.2,.12,accent,0,.57,-.05);
                // Small housing behind the collision-side indicator.
                box(individual ? .3 : .38,.22,.26,shell,0,.55,.22);
            }else{
                // Elevated schematic housing keeps under-body measurement origins
                // visible from above; its x/z location is the unchanged sensor origin.
                // RCJ may place induction and ultrasound at the same x/y.
                // Separate their housings vertically, never their measurement origins.
                const height=d.type==='ULTRASONIC'?2.65:d.type==='INDUCTIVE'?2.05:2.25;
                box(.12,height-.4,.12,dark,0,(height+.2)/2,0);
                box(d.type==='ULTRASONIC'?.66:.42,.32,.32,shell,0,height,0);
                const lens=(x,r)=>{
                    const item=mesh(new THREE.CylinderGeometry(r,r,.07,20),accent,x,height,-.195);
                    item.rotation.x=Math.PI/2;
                };
                if(d.type==='ULTRASONIC'){lens(-.17,.12);lens(.17,.12);}
                else if(d.type==='INDUCTIVE')lens(0,.13);
                else {
                    lens(0,.1);
                    // Ground-facing marker is decorative, never used for sampling.
                    mesh(new THREE.CylinderGeometry(.1,.1,.04,16),dark,0,.12,0);
                }
            }
        }
        return root;
    }
    function update(THREE,parent,descriptors,offset){
        const signature=JSON.stringify(descriptors);
        let record=records.get(parent);
        if(!record || record.signature!==signature){
            const next=descriptors.length?build(THREE,descriptors):null;
            if(record && record.group){parent.remove(record.group);dispose(record.group);}
            if(next)parent.add(next);
            record={signature,group:next,revision:(record?record.revision:0)+1};records.set(parent,record);
        }
        // Counteract the adapter's visual chassis offset; match the 2D origin.
        if(record.group)record.group.position.z=-offset;
        return {count:descriptors.length,groups:record.group?record.group.children.length:0,revision:record.revision};
    }
    return Object.freeze({update});
});
