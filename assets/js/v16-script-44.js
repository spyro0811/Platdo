
/* Original authored electric-bike assemblies. No downloaded meshes or logos. */
(function(root){'use strict';const T=root.THREE,up=new T.Vector3(0,1,0),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function build(g,d,m,p,c,k){const s=d.bikeSpec,a=s.anchors,h=s.seatHeight,half=s.wheelbase/2,detail=k.detail,steps=n=>Math.max(5,Math.round(n*(.25+detail*.15))),{box,tube,mesh,loft,material,sphere,mergeStatic}=k;
 const ac=material(s.accent,.39,.3),frame=material(c.paint??d.color,.49,.62),black=material(0x15191c,.66,.3),vinyl=material(0x151819,.93),brake=material(0x919a9d,.36,.82),seam=material(0x777d76,.79),copper=material(0xb88556,.39,.7);m.electricAccent=ac;m.electricFrame=frame;
 const E=p.electric={dynamic:[],fork:null,swing:null,shock:null,chains:[],spec:s,frontRadius:s.frontRadius,rearRadius:s.rearRadius};
 const mark=(o,name)=>{o.name=name;return o;},dyn=(o,name)=>{mark(o,name);E.dynamic.push(o);return o;};
 function axisCyl(parent,mat,x,y,z,r,w){const o=mesh(new T.CylinderGeometry(r,r,w,steps(24)),mat,parent,x,y,z);o.rotation.z=Math.PI/2;return o;}
 function curve(parent,mat,points,r=.008){const path=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)),false,'catmullrom',.12);return mesh(new T.TubeGeometry(path,steps(points.length*5),r,detail>3?6:4,false),mat,parent);}
 function bolt(parent,x,y,z,size=.012){return axisCyl(parent,m.metal,x,y,z,size,.012);}
 function tire(parent,front){const radius=front?s.frontRadius:s.rearRadius,rimR=front?s.frontRim:s.rearRim,width=front?s.frontWidth:s.rearWidth,pivot=new T.Group(),spin=new T.Group();parent.add(pivot);pivot.add(spin);mark(pivot,(front?'front':'rear')+'-axle');mark(spin,(front?'front':'rear')+'-wheel');
  const sidewall=Math.min(radius-rimR,.067),rubber=mesh(new T.TorusGeometry(radius-sidewall,sidewall,detail>3?12:7,steps(40)),m.rubber,spin);rubber.rotation.y=Math.PI/2;rubber.scale.z=width/(sidewall*2);
  const treadRows=s.mini?2:3,count=detail<3?12:s.mini?26:34;for(let n=0;n<count;n++)for(let row=0;row<treadRows;row++){const q=(n+(row%2)*.45)*Math.PI*2/count,rr=radius-(s.mini?.0045:.0075),knob=box(spin,m.rubber,(row-(treadRows-1)/2)*width*.27,Math.cos(q)*rr,Math.sin(q)*rr,width*(s.mini?.36:.27),s.mini?.009:.015,s.mini?.023:.031,.003);knob.rotation.x=q;if(s.mini)knob.rotation.y=row%2?.28:-.28;}
  for(const side of[-1,1]){const rim=mesh(new T.TorusGeometry(rimR,.009,6,steps(36)),s.shape==='compact-dirt'?ac:m.metal,spin,side*width*.34,0,0);rim.rotation.y=Math.PI/2;}
  if(s.mini){axisCyl(spin,brake,0,0,0,rimR*.93,width*.62);for(let n=0;n<6;n++){const q=n*Math.PI/3;for(const side of[-1,1]){axisCyl(spin,black,side*width*.325,Math.cos(q)*rimR*.62,Math.sin(q)*rimR*.62,.013,.003);bolt(spin,side*width*.34,Math.cos(q)*rimR*.37,Math.sin(q)*rimR*.37,.008);}}}
  else{const spokes=detail<3?12:28;for(let n=0;n<spokes;n++){const q=n*2*Math.PI/spokes,side=n%2?1:-1; tube(spin,m.metal,[side*width*.33,Math.cos(q)*rimR,Math.sin(q)*rimR],[-side*width*.2,Math.cos(q+.40)*.035,Math.sin(q+.40)*.035],detail<3?.0035:.0023);}}
  axisCyl(spin,s.bicycle&&!front?black:m.metal,0,0,0,s.bicycle&&!front?.105:s.mini?.034:.033,width*.65);
  const discR=Math.min(radius*.44,s.mini?.075:.125),disc=mesh(new T.RingGeometry(discR*.37,discR,steps(32)),brake,spin,width*.55,0,0);disc.rotation.y=Math.PI/2;disc.material.side=T.DoubleSide;
  if(detail>2)for(let n=0;n<12;n++){const q=n*Math.PI/6;const hole=mesh(new T.CircleGeometry(.005,5),black,spin,width*.55+.001,Math.cos(q)*discR*.78,Math.sin(q)*discR*.78);hole.rotation.y=Math.PI/2;}
  axisCyl(spin,black,0,0,0,.017,width+.045);for(const side of[-1,1])bolt(spin,side*(width*.5+.028),0,0,.017);
  tube(spin,black,[-width*.25,rimR*.87,0],[-width*.25,rimR-.012,0],.004);
  const caliper=box(pivot,black,width*.61,discR*.68,-discR*.56,.035,.065,.04,.01);mark(caliper,'stationary-brake-caliper');
  const baked=mergeStatic(spin);spin.clear();spin.add(...baked.children.slice());p.wheels.push({pivot,spin,front,baseY:0,radius,electric:true});return pivot;
 }
 // Separate front upper tubes, telescoping lower assembly and steered handlebar.
 const st=a.steering,axle=[0,s.frontRadius,half],fork=new T.Group();fork.position.set(st.x,st.y,st.z);const axis=new T.Vector3(0,st.y-s.frontRadius,st.z-half).normalize();fork.quaternion.setFromUnitVectors(up,axis);E.forkBase=fork.quaternion.clone();g.add(dyn(fork,'inclined-steering-axis'));E.fork=fork;
 const inv=fork.quaternion.clone().invert(),local=v=>new T.Vector3(...v).sub(fork.position).applyQuaternion(inv).toArray(),slide=new T.Group();mark(slide,'telescoping-fork-lowers');fork.add(slide);E.slider=slide;
 const forkX=s.mini?.105:s.bicycle?.087:.075,frontWheel=tire(slide,true);frontWheel.position.fromArray(local(axle));E.frontWheel=frontWheel;
 for(const side of[-1,1]){tube(fork,m.metal,local([side*forkX,st.y+.035,st.z]),local([side*forkX,s.frontRadius+.21,half-.045]),s.shape==='full-mx'?.025:.020);tube(slide,black,local([side*forkX,s.frontRadius,half]),local([side*forkX,s.frontRadius+.29,half-.055]),s.shape==='full-mx'?.032:.025);tube(slide,ac,local([side*forkX,s.frontRadius+.04,half+.018]),local([side*forkX,s.frontRadius+.20,half-.01]),.016);bolt(slide,...local([side*(forkX+.015),s.frontRadius,half]),.017);}
 for(const y of[st.y-.025,st.y-.15])tube(fork,black,local([-forkX-.035,y,st.z+.025]),local([forkX+.035,y,st.z+.025]),.025);
 const grips=[a.gripL,a.gripR];curve(fork,black,[local([a.gripL.x,a.gripL.y,a.gripL.z]),local([-.15,a.gripL.y-.055,a.gripL.z-.025]),local([0,st.y+.06,st.z]),local([.15,a.gripR.y-.055,a.gripR.z-.025]),local([a.gripR.x,a.gripR.y,a.gripR.z])],.014);
 for(const[side,grip]of[[-1,grips[0]],[1,grips[1]]]){const c0=local([grip.x,grip.y,grip.z]),handle=axisCyl(fork,m.rubber,...c0,.023,.12);mark(handle,side<0?'left-grip':'right-grip');curve(fork,brake,[local([grip.x-side*.075,grip.y,grip.z]),local([grip.x-side*.04,grip.y-.015,grip.z+.07]),local([grip.x+side*.025,grip.y-.025,grip.z+.075])],.006);if(detail>2)for(let j=-3;j<=3;j++)axisCyl(fork,black,c0[0]+j*.012,c0[1],c0[2],.024,.003);curve(fork,black,[local([grip.x-side*.07,grip.y,grip.z+.015]),local([side*.12,st.y-.13,st.z+.12]),local([side*.08,s.frontRadius+.22,half+.045])],.004);}
 const displayPoint=local([0,st.y+.095,st.z+.018]);box(fork,black,...displayPoint,.13,.055,.065,.012);box(fork,material(0x74c4b6,.22,.1,{emissive:0x21483e,emissiveIntensity:.3}),displayPoint[0],displayPoint[1]+.029,displayPoint[2],.082,.003,.041,.002);
 if(s.mini||s.shape==='pit-performance'){tube(fork,black,local([-.19,st.y+.07,st.z]),local([.19,st.y+.07,st.z]),.018);const bp=local([0,st.y+.07,st.z]);box(fork,ac,...bp,.21,.06,.055,.015);}
 // Swingarm preserves rear axle, motor (on pit/minibike), caliper and sprocket alignment.
 const pivotY=s.mini?.28:s.bicycle?.38:s.shape==='full-mx'?.43:.35,pivotZ=s.mini?.02:s.bicycle?.03:.035,swing=new T.Group();swing.position.set(0,pivotY,pivotZ);g.add(dyn(swing,'rear-swingarm-pivot'));E.swing=swing;E.swingLength=half+pivotZ;E.swingOrigin=swing.position.clone();
 const rearLocal=[0,s.rearRadius-pivotY,-half-pivotZ],rearWheel=tire(swing,false);rearWheel.position.fromArray(rearLocal);E.rearWheel=rearWheel;for(const side of[-1,1]){tube(swing,frame,[side*.11,0,0],[side*(s.rearWidth*.5+.035),rearLocal[1],rearLocal[2]],s.mini?.026:.021);tube(swing,m.metal,[side*.11,-.025,-.04],[side*(s.rearWidth*.5+.035),rearLocal[1]-.02,rearLocal[2]+.025],.014);}axisCyl(g,m.metal,0,pivotY,pivotZ,.035,.32);
 const sprocket=axisCyl(rearWheel.children[0],brake,-s.rearWidth*.5-.025,0,0,s.bicycle?.04:s.mini?.055:.085,.009);mark(sprocket,'rear-drive-sprocket');
 let motorParent=s.motorMount==='swingarm'?swing:g,motorY=s.motorMount==='swingarm'?-.01:pivotY-.035,motorZ=s.motorMount==='swingarm'?-.075:.10;
 if(!s.bicycle){axisCyl(motorParent,black,0,motorY,motorZ,s.mini?.072:s.shape==='full-mx'?.112:.087,.24);for(const side of[-1,1]){axisCyl(motorParent,m.metal,side*.124,motorY,motorZ,.058,.012);for(let n=0;n<6;n++){const q=n*Math.PI/3;bolt(motorParent,side*.134,motorY+Math.cos(q)*.047,motorZ+Math.sin(q)*.047,.007);}}if(detail>2)for(let n=-3;n<=3;n++)axisCyl(motorParent,black,n*.027,motorY,motorZ,.091,.008);}
 // Chain runs have separate stretch/tension segments, with no decorative physics bodies.
 const chainX=-Math.max(s.rearWidth/2+.033,.139),motorPoint=s.bicycle?new T.Vector3(0,a.crank.y,a.crank.z):new T.Vector3(0,motorY,motorZ);if(motorParent===swing&&!s.bicycle)motorPoint.add(swing.position);motorPoint.x=chainX;
 if(!s.bicycle)axisCyl(motorParent,brake,chainX,motorY,motorZ,.045,.008);E.motorPoint=motorPoint;E.chainX=chainX;E.motorOnSwing=motorParent===swing&&!s.bicycle;E.motorLocal=motorPoint.clone().sub(swing.position);
 for(const side of[-1,1]){const chain=mesh(new T.CylinderGeometry(.006,.006,1,4),black,g);dyn(chain,'chain-'+(side>0?'upper':'lower'));E.chains.push({mesh:chain,side});}
 const guard=box(swing,black,chainX,rearLocal[1]+.115,rearLocal[2]*.53,.035,.025,Math.abs(rearLocal[2])*.75,.008);mark(guard,'chain-guard');
 const top=new T.Vector3(0,h-.10,-.16),bottom=new T.Vector3(0,.07,-E.swingLength*.44);E.shockTop=top;E.shockBottom=bottom;
 for(const side of[-1,1])tube(swing,brake,[side*.11,rearLocal[1]*.44,-E.swingLength*.44],[0,.07,-E.swingLength*.44],.014);axisCyl(swing,m.metal,0,.07,-E.swingLength*.44,.021,.13);tube(g,frame,[-.11,top.y,top.z],[.11,top.y,top.z],.019);
 const shock=new T.Group();g.add(dyn(shock,'rear-shock'));E.shock=shock;const piston=mesh(new T.CylinderGeometry(.018,.018,1,10),m.metal,shock);E.shockPiston=piston;
 const helix=[];for(let j=0;j<=96;j++){const q=j/96;helix.push([Math.sin(q*Math.PI*16)*.034,q-.5,Math.cos(q*Math.PI*16)*.034]);}curve(shock,s.shape==='full-mx'?copper:ac,helix,.006);axisCyl(g,black,0,top.y,top.z,.024,.15);
 if(s.bicycle){const reservoir=mesh(new T.CylinderGeometry(.024,.024,.13,12),black,g,.07,h-.19,-.23);reservoir.rotation.x=.6;}
 // Individually authored frames, open spaces and fitted center housings.
 function frameTube(points,r=.024,mat=frame){return curve(g,mat,points,r);}
 const neck=[0,st.y-.12,st.z-.035],back=[0,h-.075,-half*.72],base=[0,pivotY-.08,.04];
 for(const side of[-1,1]){const x=side*(s.mini?.14:s.bicycle?.095:.105);
  if(s.bicycle){frameTube([[x,.31,.07],[x,.68,.39],[x,.75,-.35]],.024);frameTube([[x,.31,.07],[x,h-.10,-.30],[x,.75,-.35]],.023);frameTube([[x,.69,.40],[x,.74,-.38]],.026);frameTube([[x,h-.09,-.38],[x,h-.09,-.56]],.021);}
  else if(s.mini){frameTube([[x,pivotY-.08,.14],[x,.66,.34],[x,.58,.19],[x,.58,-.53],[x,.27,-.13],[x,pivotY-.08,.14]],.025);frameTube([[x,.58,-.20],[x,.58,-.60],[x,.60,-.65]],.023);}
  else if(s.shape==='open-trail'){const rail=loft(g,frame,[[.37,.035,.67,.76,.79],[.13,.047,.44,.67,.70],[-.06,.04,.34,.55,.59]]);rail.position.x=x;frameTube([[x,.45,-.03],[x,h-.07,-.35],[x,h-.075,-.53]],.020);frameTube([[x,.36,-.02],[x,.71,.30]],.022);}
  else{frameTube([[x,pivotY-.09,.20],[x,.36,-.17],[x,h-.11,-.40],[x,h-.11,s.shape==='full-mx'?.30:.18],[x,neck[1],neck[2]],[x,pivotY-.09,.20]],.025);frameTube([[x,h-.10,-.03],[x,h-.09,-half*.84]],.019);}
 }
 if(s.bicycle){loft(g,ac,[[.40,.065,.77,.87,.89],[.23,.13,.75,.91,.94],[-.08,.11,.75,.91,.92],[-.14,.065,.76,.86,.88]]);box(g,black,0,.74,.12,.18,.03,.48,.012);}
 else if(s.shape==='open-trail'){loft(g,black,[[.26,.075,.46,.76,.80],[.10,.13,.39,.73,.76],[-.09,.105,.38,.64,.67],[-.15,.06,.40,.59,.62]]);for(const x of[-.132,.132])tube(g,ac,[x,.44,.08],[x,.68,.19],.008);box(g,black,0,.75,.20,.14,.025,.13,.012);}
 else if(s.mini){loft(g,black,[[.27,.10,.29,.56,.58],[.13,.14,.27,.58,.60],[-.30,.14,.28,.56,.58],[-.39,.10,.31,.53,.55]]);for(let z=-.27;z<.24;z+=.065)for(const side of[-1,1])box(g,frame,side*.145,.43,z,.012,.19,.013,.004);}
 else if(s.shape==='full-mx'){loft(g,black,[[.40,.07,.43,.82,.86],[.20,.17,.30,.85,.89],[-.15,.17,.32,.76,.80],[-.28,.10,.39,.66,.69]]);for(let n=0;n<7;n++)box(g,frame,0,.36+n*.044,.06,.35,.014,.38,.005);for(const side of[-1,1]){const sh=loft(g,m.body,[[.42,.025,.73,.85,.89],[.19,.046,.59,.90,.94],[-.16,.034,.67,.85,.87],[-.30,.018,.76,.81,.83]]);sh.position.x=side*.15;const slash=box(g,ac,side*.194,.76,.13,.012,.16,.25,.015);slash.rotation.x=-.32;}}
 else if(s.shape==='pit-performance'){loft(g,black,[[.30,.055,.38,.71,.74],[.11,.135,.30,.69,.72],[-.14,.12,.34,.63,.67],[-.24,.055,.43,.58,.61]]);for(const side of[-1,1]){const cover=loft(g,ac,[[.24,.02,.51,.70,.73],[.04,.028,.38,.67,.71],[-.20,.018,.49,.59,.63]]);cover.position.x=side*.127;for(let j=0;j<3;j++){const rib=box(g,black,side*.156,.52+j*.046,.035,.01,.012,.17,.003);rib.rotation.x=-.33;}}}
 else{loft(g,black,[[.28,.07,.36,.67,.70],[.14,.13,.29,.67,.70],[-.12,.13,.30,.64,.67],[-.25,.07,.37,.57,.61]]);for(const side of[-1,1]){box(g,frame,side*.137,.49,.02,.025,.29,.29,.035);for(let j=0;j<2;j++){const stripe=box(g,ac,side*.152,.48+j*.06,.025,.006,.018,.25,.003);stripe.rotation.x=.24;}}}
 // Underside skid plate, real fasteners and separate saddle cushion/base.
 if(!s.bicycle)loft(g,brake,[[.26,.09,pivotY-.13,pivotY-.09,pivotY-.075],[.06,.14,pivotY-.17,pivotY-.12,pivotY-.10],[-.20,.10,pivotY-.12,pivotY-.08,pivotY-.06]]);
 const seatRear=s.mini?-.59:s.bicycle?-.58:-half*.82,seatFront=s.mini?.21:s.bicycle?-.09:s.shape==='full-mx'?.30:.18,seatWidth=s.mini?.145:s.bicycle?.14:s.shape==='full-mx'?.095:.10;
 const seatRings=[[seatRear,.065,h-.06,h-.005,h+.012],[seatRear+.06,seatWidth,h-.064,h-.012,h+.012],[(seatRear+seatFront)*.5,seatWidth*.92,h-.075,h-.026,h],[seatFront,seatWidth*.55,h-.09,h-.045,h-.025]];
 loft(g,black,seatRings.map(r=>[r[0],r[1]+.005,r[2]-.018,r[3]-.036,r[4]-.037]));loft(g,vinyl,seatRings);
 for(const side of[-1,1])curve(g,seam,[ [side*seatWidth*.78,h-.013,seatRear+.055],[side*seatWidth*.94,h-.017,seatRear+.12],[side*seatWidth*.79,h-.028,seatFront-.04]],.0025);
 if(detail>2)for(let z=seatRear+.08;z<seatFront-.06;z+=.065){const middle=(seatRear+seatFront)*.5,y=h+.009-.025*clamp((z-middle)/(seatFront-middle),0,1);tube(g,black,[-seatWidth*.78,y,z],[seatWidth*.78,y,z],.0025);}
 if(s.mini)frameTube([[-.14,h-.07,-.45],[-.17,h-.04,-.66],[0,h-.03,-.69],[.17,h-.04,-.66],[.14,h-.07,-.45]],.022);
 const fenderH=s.frontRadius+(s.mini?.22:s.bicycle?.12:s.shape==='full-mx'?.52:.37),fenderStart=half-.18,fenderEnd=half+(s.shape==='full-mx'?.29:s.mini?.16:.20);
 const fd=loft(fork,s.bicycle?frame:ac,[[fenderStart,.048,fenderH-.023,fenderH-.009,fenderH],[half,.075,fenderH-.025,fenderH-.01,fenderH+.015],[fenderEnd,.040,fenderH-.04,fenderH-.02,fenderH-.01]]); // Convert authored whole mesh to steering-local space.
 fd.geometry.applyMatrix4(new T.Matrix4().compose(fork.position,fork.quaternion,new T.Vector3(1,1,1)).invert());
 if(!s.mini&&!s.bicycle)loft(g,s.shape==='full-mx'?m.body:ac,[[seatRear-.15,.035,h-.035,h-.025,h-.015],[seatRear-.03,.075,h-.065,h-.04,h-.025],[seatRear+.12,.075,h-.08,h-.065,h-.05]]);
 else{const hug=loft(swing,frame,[[-half-pivotZ-.13,.065,s.rearRadius-pivotY+.19,s.rearRadius-pivotY+.21,s.rearRadius-pivotY+.22],[-half-pivotZ,.09,s.rearRadius-pivotY+.22,s.rearRadius-pivotY+.24,s.rearRadius-pivotY+.25],[-half-pivotZ+.16,.07,s.rearRadius-pivotY+.18,s.rearRadius-pivotY+.21,s.rearRadius-pivotY+.22]]);mark(hug,'rear-tire-hugger');}
 // Original front surrounds: twin slot / rectangle / retro compact / MX plate.
 const plateY=st.y-.10,plateZ=st.z+.10,plateLocal=local([0,plateY,plateZ]);const plate=box(fork,s.shape==='full-mx'?m.body:ac,...plateLocal,s.mini?.25:s.bicycle?.22:.24,s.mini?.13:s.bicycle?.19:.25,.055,.035);
 if(s.shape==='open-trail'){for(const x of[-.052,.052])box(fork,m.head,plateLocal[0]+x,plateLocal[1],plateLocal[2]+.030,.066,.038,.012,.008);}
 else if(s.mini)box(fork,m.head,plateLocal[0],plateLocal[1]+.035,plateLocal[2]+.035,.18,.044,.017,.008);
 else if(s.bicycle){const lamp=mesh(new T.CircleGeometry(.062,steps(24)),m.head,fork,plateLocal[0],plateLocal[1],plateLocal[2]+.032);}
 else{box(fork,black,plateLocal[0],plateLocal[1],plateLocal[2]+.03,.13,.023,.006,.004);box(fork,m.head,plateLocal[0],plateLocal[1]-.08,plateLocal[2]+.032,.11,.025,.010,.005);}
 box(g,m.tail,0,h-.06,seatRear-.015,s.mini?.12:.09,.025,.015,.008);
 for(const side of[-1,1]){if(!s.bicycle){tube(g,black,[side*.09,a.footL.y,a.footL.z],[side*.24,a.footL.y,a.footL.z],.014);box(g,brake,side*.195,a.footL.y,a.footL.z,.11,.025,.075,.006);if(detail>2)for(let j=-2;j<=2;j++)box(g,black,side*.195+j*.02,a.footL.y+.015,a.footL.z,.006,.008,.068,0);}
  const fixings=s.bicycle?[[.81,.30],[.80,.0]]:s.mini?[[.42,-.25],[.42,.21],[.55,.1]]:s.shape==='open-trail'?[[.49,.12],[.63,.12]]:s.shape==='full-mx'?[[.76,.19],[.76,.0]]:s.shape==='pit-performance'?[[.55,.07],[.63,.10]]:[[.49,-.08],[.59,.08]];
  for(const[y,z]of fixings)bolt(g,side*(s.bicycle?.133:s.mini?.15:s.shape==='open-trail'?.132:s.shape==='full-mx'?.198:s.shape==='pit-performance'?.156:.153),y,z,.009);
 }
 if(s.bicycle){const crank=new T.Group();crank.position.set(a.crank.x,a.crank.y,a.crank.z);g.add(dyn(crank,'bicycle-crank'));E.crank=crank;axisCyl(crank,black,-.14,0,0,.075,.012);for(const side of[-1,1]){tube(crank,brake,[side*.15,0,0],[side*.17,0,side<0?.12:-.12],.012);box(crank,black,side*.18,0,side<0?.12:-.12,.12,.025,.072,.006);}}
 // Manufactured fictional badge/wordmark on each side, with retained UVs after batching.
 if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=s.mini?'#c5df73':s.bicycle?'#26382c':'#e7dfc3';ctx.fillRect(0,0,512,128);ctx.fillStyle='#222b2e';ctx.font='900 37px sans-serif';ctx.textAlign='center';ctx.fillText(d.name.toUpperCase(),277,72);ctx.beginPath();if(s.bicycle){ctx.arc(56,58,25,0,Math.PI);ctx.lineTo(31,58);}else{ctx.moveTo(44,20);ctx.lineTo(75,51);ctx.lineTo(57,51);ctx.lineTo(71,103);ctx.lineTo(32,61);ctx.lineTo(49,61);}ctx.fill();const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;const badgeMat=material(0xffffff,.65,0,{map:texture,side:T.DoubleSide});for(const side of[-1,1]){const badge=mesh(new T.PlaneGeometry(s.bicycle?.30:.25,.065),badgeMat,g,side*(s.bicycle?.135:s.mini?.151:s.shape==='full-mx'?.20:.156),s.bicycle?.84:s.mini?.48:h-.22,s.bicycle?.15:.03);badge.rotation.y=side*Math.PI/2;mark(badge,'fictional-brand-badge');}}
 // Batch nonmoving spokes/tread and fixed parts while retaining all articulated roots.
 for(const rootPart of[fork,slide,swing]){const staticGroup=new T.Group();for(const child of rootPart.children.slice())if(child!==slide&&child!==frontWheel&&child!==rearWheel)staticGroup.add(child);rootPart.add(mergeStatic(staticGroup));}
 update(g,{visual:{wheelSpin:0,steer:0,suspension:[0,0]}},0,p);
}
function update(g,e,dt,parts){const E=parts.electric;if(!E)return;const s=E.spec,v=e.visual||{},fc=clamp(v.suspension?.[0]||0,0,s.travel),rc=clamp(v.suspension?.[1]||0,0,s.travel);
 for(const reduced of E.lodModels||[]){update(reduced,e,dt,reduced.userData.parts);const color=e.customization?.paint;if(Number.isInteger(color)){reduced.userData.materials.body.color.setHex(color);reduced.userData.materials.electricFrame.color.setHex(color);}}
 E.fork.quaternion.copy(E.forkBase).multiply(new T.Quaternion().setFromAxisAngle(up,v.steer||0));E.slider.position.y=fc;E.swing.rotation.x=Math.asin(clamp(rc/E.swingLength,-.4,.4));
 for(const w of parts.wheels)if(w.electric)w.spin.rotation.x=(v.wheelSpin||0)*s.rearRadius/w.radius;
 const end=E.shockBottom.clone().applyAxisAngle(new T.Vector3(1,0,0),E.swing.rotation.x).add(E.swingOrigin),dir=end.clone().sub(E.shockTop),length=dir.length();E.shock.position.copy(end).add(E.shockTop).multiplyScalar(.5);E.shock.quaternion.setFromUnitVectors(up,dir.normalize());E.shock.scale.y=length;
 const rear=new T.Vector3(E.chainX,s.rearRadius-E.swingOrigin.y,-s.wheelbase/2-E.swingOrigin.z).applyAxisAngle(new T.Vector3(1,0,0),E.swing.rotation.x).add(E.swingOrigin),motor=E.motorOnSwing?E.motorLocal.clone().applyAxisAngle(new T.Vector3(1,0,0),E.swing.rotation.x).add(E.swingOrigin):E.motorPoint;
 for(const part of E.chains){const a=motor.clone(),b=rear.clone();a.y+=part.side*(s.bicycle?.071:.045);b.y+=part.side*(s.bicycle?.035:s.mini?.05:.079);const span=b.clone().sub(a);part.mesh.position.copy(a).add(b).multiplyScalar(.5);part.mesh.quaternion.setFromUnitVectors(up,span.clone().normalize());part.mesh.scale.y=span.length();}
 // Electric coasting keeps pedals at the authored opposite-phase anchors.
 if(E.crank)E.crank.rotation.x=0;
}
root.CityElectricBikeModels={build,update};
})(typeof globalThis!=='undefined'?globalThis:this);

