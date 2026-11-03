
/* Original P17 formula chassis, built in metres with +Z forward. All views use this maker. */
(function(root){
'use strict';
const T=root.THREE;
function build(paintColor,detail,config,helpers){
  const {createOccupant,batchFixedMeshes,prepareCarDamage,steps}=helpers,car=new T.Group(),body=new T.Group(),cockpit=new T.Group(),cabin=new T.Group();
  car.add(body);body.add(cockpit,cabin);cockpit.userData.noDent=true;cockpit.userData.noBatch=true;
  const paint=new T.MeshStandardMaterial({color:config?.paint?.baseColor||paintColor||'#df322c',metalness:.35,roughness:.26});paint.userData.driveBasePaint=true;
  const surface=(color,roughness=.65,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  const carbon=surface('#212831',.53,.32),black=surface('#151b22'),rubber=surface('#202023',.97),rim=surface('#414953',.38,.76),alloy=surface('#aeb4b3',.31,.66),cream=surface('#f6e7ca',.42,.23),trim=surface('#da8a46',.42,.46);
  const wheels=[],lamps=[],V=(x,y,z)=>new T.Vector3(x,y,z);
  function mesh(parent,g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function box(parent,w,h,l,m,x,y,z){return mesh(parent,new T.BoxGeometry(w,h,l),m,x,y,z);}
  function capsule(parent,points,r,m,rings=12){const c=new T.CatmullRomCurve3(points.map(p=>V(...p)));return mesh(parent,new T.TubeGeometry(c,steps(rings,4),r,steps(8,4),false),m);}
  function link(parent,a,b,r,m){const av=V(...a),bv=V(...b),dir=bv.clone().sub(av),o=mesh(parent,new T.CylinderGeometry(r,r,dir.length(),steps(10,5)),m);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V(0,1,0),dir.normalize());return o;}
  // Smoothly varying cross sections; the lower edge flattens into the underfloor.
  function hull(parent,stations,m,name,x=0){
    const sides=steps(28,10),count=Math.max(stations.length*3,steps(48,14)),verts=[],uv=[],indices=[];
    const rails=new T.CatmullRomCurve3(stations.map(([z,y,w])=>V(w,y,z))),radii=new T.CatmullRomCurve3(stations.map(([z,y,w,h])=>V(h,0,z)));
    for(let j=0;j<=count;j++){const t=j/count,a=rails.getPoint(t),h=radii.getPoint(t).x;for(let i=0;i<=sides;i++){
      const q=i/sides*Math.PI*2,c=Math.cos(q),s=Math.sin(q);verts.push(a.x*Math.sign(c)*Math.abs(c)**.76,a.y+h*(s<0?-.88*Math.abs(s)**.65:s),a.z);uv.push(i/sides,t);
      if(i&&j){const b=j*(sides+1)+i;indices.push(b-sides-2,b-sides-1,b,b-sides-2,b,b-1);}
    }}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.sculpted=true;
    const o=mesh(parent,g,m,x);o.name=name;return o;
  }
  function paintPanel(o,id){return root.DriveVehicleModels.paintable(o,id);}
  const floor=hull(body,[[-2.28,.17,.32,.04],[-1.62,.19,.76,.065],[-.54,.19,.80,.06],[.55,.20,.74,.045],[.96,.24,.35,.06],[2.12,.26,.14,.045]],carbon,'Venturi underfloor');
  const nose=paintPanel(hull(body,[[.18,.40,.31,.155],[.49,.46,.335,.16],[.83,.48,.24,.142],[1.49,.44,.17,.105],[2.09,.35,.12,.08],[2.43,.32,.055,.035]],paint,'Tapered P17 nose'),'shell');
  const cover=paintPanel(hull(body,[[-2.22,.37,.13,.08],[-1.83,.48,.25,.215],[-1.20,.59,.27,.29],[-.83,.75,.235,.30],[-.62,.76,.19,.295],[-.53,.60,.17,.17]],paint,'Engine spine'),'trunk');
  hull(body,[[-1.67,.71,.016,.03],[-1.26,.83,.023,.06],[-.74,.94,.024,.10],[-.58,.97,.02,.09]],cream,'Engine cover flash');
  hull(body,[[-.70,.94,.125,.094],[-.59,.986,.148,.117],[-.52,.98,.145,.115]],carbon,'Overhead air box');
  for(const side of [-1,1]){
    paintPanel(hull(body,[[-1.74,.32,.06,.07],[-1.44,.38,.14,.12],[-.83,.41,.22,.155],[-.2,.44,.235,.175],[.31,.47,.21,.16],[.53,.49,.17,.119]],paint,'Sculpted sidepod',side*.50),side<0?'leftDoor':'rightDoor');
    hull(body,[[.504,.478,.143,.08],[.54,.478,.147,.088],[.546,.478,.142,.081]],black,'Sidepod cooling inlet',side*.50);
    capsule(body,[[side*.59,.45,.48],[side*.71,.42,.18],[side*.70,.40,-.39],[side*.60,.37,-1.19]],.013,cream,17);
    hull(body,[[-.68,.42,.085,.15],[-.39,.46,.08,.15],[-.03,.46,.081,.14],[.38,.47,.086,.12]],paint,'Cockpit sill',side*.285);
    link(body,[side*.31,.55,-.45],[side*.27,.82,-.43],.03,carbon);
  }
  capsule(body,[[-.30,.56,-.46],[-.31,.82,-.43],[-.29,.91,-.24],[-.22,.90,.14],[0,.86,.34],[.22,.90,.14],[.29,.91,-.24],[.31,.82,-.43],[.30,.56,-.46]],.027,carbon,40);
  link(body,[0,.56,.37],[0,.855,.335],.024,carbon);
  function wing(z,y,span,chord,m,sweep,crown){
    const v=[],ix=[],per=12;
    for(let j=0;j<=22;j++){const unit=j/11-1,x=unit*span*.5;for(let i=0;i<per;i++){
      const a=i/per*Math.PI*2,q=(Math.cos(a)+1)*.5;
      v.push(x,y+crown*unit*unit+Math.sin(a)*(.013+.026*(1-q))+.038*(1-q)**2,z-q*chord+sweep*Math.abs(unit)**1.65);
      if(j){const a0=(j-1)*per+i,a1=(j-1)*per+(i+1)%per,b0=j*per+i,b1=j*per+(i+1)%per;ix.push(a0,a1,b0,a1,b1,b0);}
    }}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();const w=mesh(body,g,m);return w;
  }
  const front=wing(2.70,.14,1.94,.38,carbon,-.13,.055);front.name='Front wing mainplane';front.userData.breakawayPart='front-bumper';
  wing(2.5,.224,1.91,.24,carbon,-.21,.09);wing(2.35,.28,1.77,.19,cream,-.23,.10);
  const rear=wing(-2.10,.865,1.57,.42,carbon,.035,.035);rear.name='Rear wing mainplane';rear.userData.breakawayPart='rear-bumper';
  wing(-2.26,.965,1.57,.18,paint,.035,.015);
  for(const side of [-1,1]){
    link(body,[side*.10,.32,2.33],[side*.15,.145,2.48],.036,carbon);
    link(body,[side*.23,.36,-1.95],[side*.31,.865,-2.24],.036,carbon);
    hull(body,[[2.04,.23,.014,.073],[2.34,.263,.026,.126],[2.55,.24,.017,.094]],paint,'Front wing endplate',side*.947);
    hull(body,[[-2.56,.77,.016,.18],[-2.33,.79,.023,.215],[-2.08,.78,.017,.15]],paint,'Rear wing endplate',side*.784);
    for(const z of [-1.63,1.55]){
      const front=z>0,r=front?.355:.37,thick=front?.30:.37,hubX=side*(1-thick/2);
      const pivot=new T.Group(),spin=new T.Group();pivot.position.set(hubX,r,z);pivot.userData.wheelRadius=r;pivot.userData.noBatch=true;pivot.name=(front?'Front':'Rear')+(side>0?' left':' right')+' wheel';car.add(pivot);pivot.add(spin);
      const tireProfile=[[.167,-.494],[r-.084,-.50],[r-.035,-.45],[r-.006,-.35],[r,-.25],[r,.25],[r-.006,.35],[r-.035,.45],[r-.084,.50],[.167,.494],[.167,-.494]].map(([radius,lat])=>new T.Vector2(radius,lat*thick));
      const tire=mesh(spin,new T.LatheGeometry(tireProfile,steps(48,16)),rubber);tire.rotation.z=Math.PI/2;
      const xx=side*thick*.5,ring=mesh(spin,new T.TorusGeometry(.22,.021,steps(9,4),steps(40,14)),rim,xx,0,0);ring.rotation.y=Math.PI/2;
      const band=mesh(spin,new T.TorusGeometry(r-.047,.005,4,steps(40,16)),trim,xx,0,0);band.rotation.y=Math.PI/2;
      for(let k=0;k<10;k++){const a=k*Math.PI/5;link(spin,[xx,Math.sin(a)*.063,Math.cos(a)*.063],[xx-side*.014,Math.sin(a+.22)*.207,Math.cos(a+.22)*.207],.012,rim);}
      const hub=mesh(spin,new T.CylinderGeometry(.068,.069,.065,steps(14,6)),alloy,xx);hub.rotation.z=Math.PI/2;
      const nut=mesh(spin,new T.CylinderGeometry(.036,.036,.018,6),side>0?trim:paint,xx+side*.037);nut.rotation.z=Math.PI/2;
      wheels.push({pivot,spin,side,front,basePosition:pivot.position.clone(),damageIndex:front?(side>0?1:0):(side>0?3:2)});
      const inner=side*.21,outer=hubX-side*thick*.36;
      for(const y of [.25,.43])for(const spread of [-.26,.25])link(body,[inner,y,z+spread],[outer,r+(y-.34)*.6,z],.016,carbon);
      link(body,[side*.19,.54,z-.11],[outer,.25,z],.018,alloy);
    }
    for(const z of [-2.22,-2.41])link(body,[side*.37,.23,z],[side*.59,.30,z-.05],.036,carbon);
  }
  for(let i=-3;i<=3;i++){const fin=box(body,.024,.14,.55,carbon,i*.145,.23,-2.11);fin.rotation.x=-.15;}
  const lamp=box(body,.125,.103,.056,surface('#be241b',.35,.18),0,.48,-2.23);lamps.push({mesh:lamp,front:false,side:0,original:lamp.material.color.clone()});
  const chair=mesh(cockpit,new T.SphereGeometry(1,16,12),black,0,.31,-.22);chair.scale.set(.229,.11,.33);
  const back=mesh(cockpit,new T.SphereGeometry(1,16,12),black,0,.48,-.39);back.scale.set(.232,.24,.085);back.rotation.x=-.20;
  const wheel=new T.Group();wheel.position.set(0,.568,.08);wheel.rotation.x=-.15;wheel.userData.visualRatio=2.9;cockpit.add(wheel);
  capsule(wheel,[[-.17,.065,0],[-.18,-.06,0],[-.10,-.092,0],[.12,-.092,0],[.18,-.06,0],[.17,.065,0],[0,.084,0],[-.17,.065,0]],.018,black,28);
  box(wheel,.22,.14,.036,carbon,0,0,0);const c=document.createElement('canvas');c.width=256;c.height=80;const digitalTexture=new T.CanvasTexture(c);digitalTexture.colorSpace=T.SRGBColorSpace;
  const dash=mesh(wheel,new T.PlaneGeometry(.145,.05),new T.MeshBasicMaterial({map:digitalTexture}),0,.016,-.021);dash.rotation.y=Math.PI;
  for(const side of [-1,1])for(let i=0;i<3;i++)box(wheel,.017,.015,.011,[trim,cream,paint][i],side*.102,.032-i*.029,-.023);
  const eye=new T.Object3D();eye.position.set(0,.776,-.268);eye.rotation.x=.075;cockpit.add(eye);
  const layout=root.DriveOccupantPhysics.formulaLayout(),seat=layout.seats[0];
  const driver=createOccupant(0,seat,.78,true,'male');driver.root.name='Formula display driver';cockpit.add(driver.root);
  for(const side of [-1,1]){link(body,[side*.30,.54,.23],[side*.53,.68,.21],.013,carbon);box(body,.11,.065,.09,paint,side*.54,.68,.21);}
  const label=(text,w,h,parent,x,y,z,rotation,back)=>{
    const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');if(back){ctx.fillStyle=back;ctx.fillRect(0,0,256,64);}
    ctx.fillStyle='#fff1dc';ctx.font='italic 900 53px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,32,245);
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const decal=mesh(parent,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide}),x,y,z);decal.rotation.set(...rotation);
  };
  label('P17',.255,.105,body,0,.591,1.21,[-1.44,0,0]);label('PLATDO',1.06,.135,body,0,.966,-2.38,[-Math.PI/2,0,0]);
  for(const side of [-1,1])label('PLATDO',.82,.10,body,side*.714,.462,-.25,[0,side*Math.PI/2,0]);
  const contact=mesh(car,new T.PlaneGeometry(1.8,4.1),new T.MeshBasicMaterial({color:'#191e22',transparent:true,opacity:.18,depthWrite:false}),0,.018,0);contact.rotation.x=-Math.PI/2;
  const interior={root:cockpit,driverEyeAnchor:eye,seat,wheelCenter:seat.wheel,steeringWheel:wheel,needles:[],dialTextures:{},dialMaterial:null,digitalTexture,layout:'single-center'};
  const corners={fl:[-.20,.54,.34],fr:[.20,.54,.34],tl:[-.20,.62,.27],tr:[.20,.62,.27],bl:[-.18,.54,-.4],br:[.18,.54,-.4],ul:[-.18,.61,-.39],ur:[.18,.61,-.39]};
  car.userData={kind:'f1',modelIdentity:'P17 formula',length:5.5,width:2,height:1.08,belt:.58,paint,basePaintColor:paint.color.getStyle(),body,cabin,wheels,lamps,frontBumper:front,rearBumper:rear,contact,occupants:[],seatCount:1,occupantLayout:layout,simulationWheelRadius:.355,displayDriver:driver.root,interior,cabinEnvelope:{dash:layout.dash},damageSetup:{shell:nose,corners,lamps,shape:layout,detail}};
  batchFixedMeshes(body);for(const w of wheels)batchFixedMeshes(w.spin);if(detail)prepareCarDamage(car,nose,corners,lamps,layout,true);
  root.DriveVehicleModels.fitPaint(car,config?.paint||{baseColor:paintColor||'#df322c',strokes:[]});root.DriveOccupantPhysics?.registerLayout('f1',layout);
  return car;
}
root.DriveFormulaModel={build};
})(window);

