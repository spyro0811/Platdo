/* The arrest is a local presentation of an already committed server result. */
(function(root){
'use strict';
const duration=20;
const shots=[
  {at:0,id:'approach'}, {at:3,id:'step-out'}, {at:6,id:'surrender'},
  {at:9,id:'handcuffs'}, {at:12.5,id:'escort'}, {at:18,id:'secured'}
];
const cues=[
  [.5,'idle'],[.8,'siren'],[1,'step'],[1.5,'step'],[2,'step'],[2.5,'step'],
  [3.34,'latch'],[4.36,'step'],[4.95,'step'],[5.52,'door'],[6.8,'step'],[7.15,'step'],
  [8.2,'cloth'],[9.57,'metal'],[10.08,'click'],[10.93,'click'],[11.28,'metal'],
  [12.92,'step'],[13.39,'step'],[13.87,'step'],[14.34,'step'],[14.8,'step'],
  [15.15,'latch'],[15.72,'step'],[16.22,'cloth'],[17.3,'cloth'],[18.69,'door'],[18.88,'resolve']
];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),mix=(a,b,t)=>a+(b-a)*t;
function beat(t,a,b){const x=clamp((t-a)/(b-a));return x*x*(3-2*x);}
function track(t,keys){
  for(let i=1;i<keys.length;i++)if(t<keys[i][0])return mix(keys[i-1][1],keys[i][1],beat(t,keys[i-1][0],keys[i][0]));
  return keys[keys.length-1][1];
}
function staging(p,core){
  const x=Number.isFinite(p?.x)?p.x:0,z=Number.isFinite(p?.z)?p.z:-core.block;
  const street=v=>Math.round(v/core.block)*core.block,alongZ=Math.abs(x-street(x))<=Math.abs(z-street(z));
  const limit=v=>clamp(v,-core.edge+12,core.edge-12);
  return {x:limit(alongZ?street(x):x),z:limit(alongZ?z:street(z)),yaw:alongZ?(Math.cos(p?.yaw||0)<0?Math.PI:0):(Math.sin(p?.yaw||0)<0?-Math.PI/2:Math.PI/2)};
}
// The stock car is a single sculpted shell. Split its exterior in the shader so
// the moving panel carries the actual paint, side glass, trim and police decal.
function articulateDoor(car,side,rear){
  const T=root.THREE,d=car.userData,layout=d.occupantLayout,hingeZ=rear?-.20:layout.frontBase-.12;
  const endZ=rear?layout.rearBase+.05:Math.max(layout.rearBase+.06,-.99);
  const nearX=.59*d.width/2,hingeX=side*d.width*.48;
  const hinge=new T.Group();hinge.position.set(hingeX,0,hingeZ);
  car.updateWorldMatrix(true,true);
  const inverse=car.matrixWorld.clone().invert(),objects=[],changed=[],mats=new Map(),copies=[];
  const fixed=new Set();for(const w of d.wheels||[])w.pivot.traverse(o=>fixed.add(o));
  car.traverseVisible(o=>{if((o.isMesh||o.isLine)&&!fixed.has(o))objects.push(o);});
  const local=[
    new T.Plane(new T.Vector3(side,.24,0),-(d.width*.46+.09)).normalize(),
    new T.Plane(new T.Vector3(0,rear?.85:0,1),-endZ-(rear?.67:0)).normalize(),
    new T.Plane(new T.Vector3(0,0,-1),hingeZ),new T.Plane(new T.Vector3(0,1,0),-.37),
    new T.Plane(new T.Vector3(0,-1,0),d.height-.045)
  ];
  const planeWorld=local.map(p=>p.clone()),hole=local.map(p=>p.clone());
  for(let i=0;i<local.length;i++)hole[i].copy(local[i]).negate().applyMatrix4(car.matrixWorld);
  const bounds=new T.Box3();
  const range=new T.Box3(new T.Vector3(side>0?nearX:-d.width,.37,endZ),new T.Vector3(side>0?d.width:-nearX,d.height-.045,hingeZ));
  function pair(m){if(!mats.has(m)){
    const outer=m.clone(),inner=m.clone();
    outer.clippingPlanes=hole;outer.clipIntersection=true;inner.clippingPlanes=planeWorld;
    mats.set(m,[outer,inner]);
  }return mats.get(m);}
  for(const o of objects){
    const g=o.geometry;if(!g?.attributes?.position)continue;
    if(!g.boundingBox)g.computeBoundingBox();
    const matrix=inverse.clone().multiply(o.matrixWorld);bounds.copy(g.boundingBox).applyMatrix4(matrix);
    if(!bounds.intersectsBox(range))continue;
    const original=o.material,part=o.clone(false);
    const mat=Array.isArray(original)?original:[original],pairs=mat.map(pair);
    o.material=Array.isArray(original)?pairs.map(q=>q[0]):pairs[0][0];
    part.material=Array.isArray(original)?pairs.map(q=>q[1]):pairs[0][1];
    matrix.premultiply(new T.Matrix4().makeTranslation(-hingeX,0,-hingeZ));
    part.matrixAutoUpdate=false;part.matrix.copy(matrix);hinge.add(part);copies.push(part);changed.push([o,original]);
  }
  hinge.name=rear?'rear-passenger-door':'driver-door';car.add(hinge);
  // An inner liner gives the open stock bodywork depth, without a second outer skin.
  const innerMat=new T.MeshStandardMaterial({color:'#232b30',roughness:.91});
  const lining=new T.Shape(),tail=hingeZ-endZ-.03;
  lining.moveTo(.03,.405);lining.lineTo(tail-(rear?.39:0),.405);lining.lineTo(tail,d.belt-.035);lining.lineTo(.03,d.belt-.035);lining.closePath();
  const liner=new T.Mesh(new T.ExtrudeGeometry(lining,{depth:.035,bevelEnabled:false}),innerMat);
  liner.rotation.y=Math.PI/2;liner.position.x=-side*.055;hinge.add(liner);
  const translation=new T.Matrix4().makeTranslation(-hingeX,0,-hingeZ),transform=new T.Matrix4();
  return {set(angle){
    hinge.rotation.y=-side*angle;hinge.updateWorldMatrix(true,false);transform.copy(hinge.matrixWorld).multiply(translation);
    local.forEach((p,i)=>planeWorld[i].copy(p).applyMatrix4(transform));
  },close(){for(const [o,m] of changed)o.material=m;hinge.removeFromParent();innerMat.dispose();liner.geometry.dispose();for(const pair of mats.values())for(const m of pair)m.dispose();}};
}
function makeCast(T,stage,robberAppearance,officerAppearance){
  const people=root.CityPeopleModels;
  const cop=people.create(officerAppearance,{lod:0,modelDetail:3}),robber=people.create(robberAppearance,{lod:0,modelDetail:3});
  cop.name='arrest-officer';robber.name='arrest-robber';stage.add(cop,robber);
  const materials=[],geometries=[];
  function mesh(geo,color,parent,metal=.15){
    const mat=new T.MeshStandardMaterial({color,roughness:metal>.4?.23:.72,metalness:metal});
    const m=new T.Mesh(geo,mat);parent.add(m);materials.push(mat);geometries.push(geo);return m;
  }
  const badge=mesh(new T.CylinderGeometry(.035,.029,.009,6),'#e4be6e',cop.userData.rig.spine,.7);badge.rotation.x=Math.PI/2;badge.position.set(-.083,.24,.147);
  const radio=mesh(new T.BoxGeometry(.054,.079,.041),'#24303b',cop.userData.rig.spine);radio.position.set(.13,.235,.13);
  const metal='#c6d5db',cuffs=[];
  for(const id of ['L','R']){
    const cuff=new T.Group();cuff.name='cuff-'+id;stage.add(cuff);
    const frame=mesh(new T.TorusGeometry(.047,.009,7,28,Math.PI*1.2),metal,cuff,.8);
    frame.rotation.x=Math.PI/2;
    const clasp=mesh(new T.TorusGeometry(.047,.008,7,24,Math.PI*.87),metal,cuff,.8);clasp.rotation.x=Math.PI/2;
    const lock=mesh(new T.BoxGeometry(.028,.022,.030),'#86969f',cuff,.7);lock.position.x=-.043;
    cuffs.push({cuff,clasp});
  }
  const chain=Array.from({length:5},(_,i)=>{const link=mesh(new T.TorusGeometry(.014,.004,5,12),metal,stage,.76);link.scale.y=.68;return link;});
  return {cop,robber,cuffs,chain,close(){
    for(const a of [cop,robber]){people.dispose(a);a.removeFromParent();}
    for(const m of materials)m.dispose();for(const g of geometries)g.dispose();
  }};
}
function create(options){
  const {scene,camera,renderer,cars,occupants,appearance,role,overlay,shot,audio,onFinish}=options;
  const T=root.THREE,stage=new T.Group(),point=(x,y,z)=>new T.Vector3(x,y,z);
  const where=staging(shot.robber,root.PlatdoCopChaseCore);
  stage.name='arrest-stage';stage.position.set(where.x,0,where.z);stage.rotation.y=where.yaw;scene.add(stage);
  let cast,driverDoor,rearDoor,destroyed=false,t=0,previous=performance.now(),nextCue=0,blurred=false;
  const hud=document.createElement('div');hud.className='arrest-hud';hud.innerHTML='<div class="arrest-fade"></div><span class="arrest-sub" aria-live="polite"></span><strong class="arrest-verdict"></strong><button type="button" hidden>Skip <kbd>Enter</kbd></button>';
  const sub=hud.querySelector('span'),verdict=hud.querySelector('strong'),skip=hud.querySelector('button'),fade=hud.firstChild;
  const previousClip=renderer.localClippingEnabled,previousFov=camera.fov;
  const original=Object.values(cars).map(c=>[c,c.parent,c.position.clone(),c.quaternion.clone()]);
  const hidden=occupants.map(o=>[o.root,o.root.visible]);
  const aborted=new AbortController(),events={signal:aborted.signal};
  function close(){
    if(destroyed)return;destroyed=true;aborted.abort();hud.remove();overlay.classList.remove('arrest-playing','arrest-reduced');delete overlay.dataset.arrestShot;
    audio.stopArrest?.();driverDoor?.close();rearDoor?.close();cast?.close();
    for(const [c,parent,pos,q] of original){parent.add(c);c.position.copy(pos);c.quaternion.copy(q);}
    for(const [o,v] of hidden)o.visible=v;
    stage.removeFromParent();renderer.localClippingEnabled=previousClip;camera.fov=previousFov;camera.updateProjectionMatrix();
  }
  function finish(){if(destroyed)return;close();onFinish();}
  try{
    const spot={robber:[-2.05,0],cop:[2.05,-1.43]};
    for(const r of ['cop','robber']){
      const model=cars[r];stage.add(model);model.position.set(spot[r][0],.022,spot[r][1]);model.rotation.set(0,0,0);model.userData.body.rotation.set(0,0,0);
    }
    hidden.forEach(([o])=>o.visible=false);
    stage.updateMatrixWorld(true);renderer.localClippingEnabled=true;
    driverDoor=articulateDoor(cars.robber,1,false);rearDoor=articulateDoor(cars.cop,-1,true);
    cast=makeCast(T,stage,appearance,options.uniform);
    overlay.classList.add('arrest-playing');overlay.append(hud);
    skip.addEventListener('click',e=>{if(!skip.hidden&&(!e.detail||pointerReady))finish();},events);
    let pointerReady=false;
    skip.addEventListener('pointerdown',()=>{pointerReady=!skip.hidden;},events);
    let enterReady=false;
    root.addEventListener('keydown',e=>{if(e.code!=='Enter'||e.repeat)return;e.preventDefault();e.stopImmediatePropagation();enterReady=!skip.hidden;}, {capture:true,...events});
    root.addEventListener('keyup',e=>{if(e.code!=='Enter')return;e.preventDefault();e.stopImmediatePropagation();if(enterReady)finish();enterReady=false;}, {capture:true,...events});
    function resetClock(){previous=performance.now();enterReady=false;pointerReady=false;}
    root.addEventListener('blur',()=>{blurred=true;resetClock();audio.stopArrest?.();},events);
    root.addEventListener('focus',()=>{blurred=false;resetClock();},events);
    document.addEventListener('visibilitychange',()=>{resetClock();if(document.hidden)audio.stopArrest?.();},events);
  }catch(error){close();throw error;}
  const reduced=!!root.PlatdoDrive?.save?.settings?.reducedMotion||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;overlay.classList.toggle('arrest-reduced',!!reduced);
  const {cop,robber,cuffs,chain}=cast,rig=robber.userData.rig,off=cop.userData.rig;
  const seats=cars.robber.userData.occupantLayout,driverSeat=seats.seats[0];
  const back=cars.cop.userData.occupantLayout,backSeat=back.seats[3]||{x:-back.seats[0].x,y:.49,z:back.rearBase+.45};
  const driverX=-2.05+driverSeat.x,driverZ=driverSeat.z,backX=2.05+backSeat.x,backZ=-1.43+backSeat.z;
  function pose(model,x,z,yaw,seatY,sit,walk,phase){
    const r=model.userData.rig;model.position.set(x,mix(0,seatY-.87,sit),z);model.rotation.y=yaw;
    r.pelvis.position.y=.89+Math.abs(Math.sin(phase))*walk*.023;r.spine.rotation.x=sit*.30;
    for(const [i,id] of ['L','R'].entries()){
      const step=Math.sin(phase+i*Math.PI)*walk;
      r['thigh'+id].rotation.x=mix(-step*.38,-1.38,sit);
      r['calf'+id].rotation.x=mix(Math.max(0,-step)*.63,1.40,sit);
      r['foot'+id].rotation.x=mix(step*.20-.09,0,sit);
      r['arm'+id].rotation.set(step*.20-.06,0,i?.11:-.11);r['forearm'+id].rotation.set(-.25,0,0);
    }
  }
  function aim(model,id,p){root.CityPeopleModels.aimArm(model,id,p);}
  const world=(x,y,z)=>stage.localToWorld(point(x,y,z));
  function render(time){
    const k=(a,b)=>beat(time,a,b),v=keys=>track(time,keys);
    const shotId=shots.reduce((s,row)=>time>=row.at?row.id:s,'approach');overlay.dataset.arrestShot=shotId;
    const exit=k(3.65,5.25),escort=k(12.53,15.0),enter=k(15.82,17.83);
    const rx=v([[0,driverX],[3.62,driverX],[4.25,driverX+.23],[4.92,-.65],[5.3,-.55],[12.52,-.55],[15.0,.55],[15.8,.59],[16.65,1.12],[17.72,backX]]);
    const rz=v([[0,driverZ],[3.67,driverZ],[4.68,-.53],[5.28,-.61],[12.52,-.61],[15.0,backZ-.43],[16.02,backZ-.50],[17.72,backZ]]);
    const ryaw=v([[0,0],[3.7,0],[4.65,1.47],[6.05,1.47],[7.62,Math.PI],[12.45,Math.PI],[13.06,2.59],[15.12,2.59],[15.82,-Math.PI/2+Math.PI*2],[16.74,4.85],[17.86,Math.PI*2]]);
    const rSit=1-k(4.35,5.22)+k(16.0,16.93),rWalk=Math.sin(Math.PI*escort)+.40*Math.sin(Math.PI*k(6.21,7.67));
    pose(robber,rx,rz,ryaw,time<15?driverSeat.y:backSeat.y,rSit,rWalk,time*8.6);
    rig.head.rotation.y=-.79*k(.55,2.65)*(1-k(3.75,4.69));
    rig.head.rotation.x=.15*k(11.26,12.35);rig.spine.rotation.x+=.095*k(11.12,12.32);
    // Stagger the feet clearing each sill. Both feet enter before the door moves.
    for(const [i,id] of ['L','R'].entries()){
      const lift=Math.sin(Math.PI*k(3.74+i*.38,4.66+i*.36))+.95*Math.sin(Math.PI*k(16.48+i*.41,17.34+i*.40));
      rig['thigh'+id].rotation.x-=.4*lift;rig['thigh'+id].rotation.z=(i?1:-1)*.19*lift;rig['calf'+id].rotation.x+=.34*lift;
    }
    const cx=v([[0,.83],[2.43,.16],[3.46,.16],[3.92,.34],[6.54,.36],[8.91,-.35],[12.40,-.35],[14.82,.88],[15.18,.75],[16.1,.18],[18.32,.26],[19.42,-.02]]);
    const cz=v([[0,-2.45],[2.45,-.73],[3.91,-.89],[6.35,-.91],[8.9,-.09],[12.45,-.09],[14.86,backZ+.09],[15.34,backZ+.04],[16.14,backZ-.48],[18.4,backZ-.41],[19.40,backZ-.7]]);
    const cyaw=v([[0,-.37],[2.6,-1.7],[6.42,-1.7],[9.03,-2.83],[12.35,-2.83],[13.12,-3.66],[15,-3.66],[15.73,-4.62],[18.82,-4.78],[19.58,-5.0]]);
    const walking=Math.sin(Math.PI*k(0,2.49))+Math.sin(Math.PI*k(6.48,8.91))+.94*Math.sin(Math.PI*k(12.5,15.12))+.36*Math.sin(Math.PI*k(18.7,19.50));
    pose(cop,cx,cz,cyaw,.51,0,walking,time*8.4);
    driverDoor.set(1.12*(k(3.25,3.91)-k(5.18,5.57)));rearDoor.set(1.10*(k(15.00,15.65)-k(18.09,18.70)));
    stage.updateMatrixWorld(true);
    // Animate from relaxed to raised palms, then reach back to the small of the back.
    const handsUp=k(4.8,5.91)*(1-k(7.11,8.32)),handsBack=k(7.12,8.57);
    for(const [i,id] of ['L','R'].entries()){
      const side=i?1:-1;
      const local=point(side*mix(.245,.328,handsUp),mix(.94,1.52,handsUp),mix(.075,.14,handsUp));
      local.lerp(point(side*.074,1.025,-.207),handsBack);
      if(time<4.85)local.lerp(point(side*.19,1.15,.25),1-exit);
      aim(robber,id,robber.localToWorld(local));rig['hand'+id].rotation.x=-.32*handsUp;
    }
    stage.updateMatrixWorld(true);
    const wrists=['L','R'].map(id=>rig['hand'+id].localToWorld(point(0,.021,0)));
    for(const [i,id] of ['L','R'].entries()){
      const gest=(i===0?k(3.05,3.48)*(1-k(3.65,4.28)):0);
      const hand=cop.localToWorld(point((i?1:-1)*(.22-.07*gest),.91+.4*gest,.06+.34*gest));
      const reach=k(8.8+i*.34,9.76+i*.86)*(1-k(11.19+i*.18,11.73+i*.14));
      hand.lerp(wrists[i],reach);
      const guided=k(12.48,12.88)*(1-k(14.92,15.30));
      if(i===0)hand.lerp(robber.localToWorld(point(.20,1.32,-.025)),guided);
      if(i===1){
        const handle=world(1.10,back.belt-.1,backZ-.07);
        hand.lerp(handle,k(14.62,15.04)*(1-k(15.42,15.92)));
        hand.lerp(handle,k(17.92,18.34)*(1-k(18.61,18.98)));
      }
      aim(cop,id,hand);
    }
    stage.updateMatrixWorld(true);
    const points=cuffs.map(({cuff,clasp},i)=>{
      const claspAt=i?10.93:10.08,carry=k(9.45+i*.62,claspAt);
      const from=off[i?'handR':'handL'].localToWorld(point(0,-.027,.015));
      const target=from.lerp(wrists[i],carry);cuff.position.copy(stage.worldToLocal(target.clone()));
      cuff.visible=time>=9.23;cuff.rotation.y=-ryaw;clasp.rotation.z=Math.PI*(1.59-.38*k(claspAt-.23,claspAt));
      return cuff.position;
    });
    chain.forEach((link,i)=>{const f=(i+1)/6;link.visible=time>9.57;link.position.copy(points[0]).lerp(points[1],f);link.position.y-=.018*Math.sin(f*Math.PI);link.rotation.set(i%2?.15:1.19,0,-.26);});
    let eye,look,lens=44;
    if(time<3){eye=point(3.06-(reduced?0:.27*k(0,3)),2.00,4.28-(reduced?0:.38*k(0,3)));look=point(-.58,.84,-.78);}
    else if(time<6){eye=point(.40,1.57,-4.95);look=point(-.63,.82,-.34);lens=38;}
    else if(time<9){eye=point(-.30,1.61,-3.62);look=point(-.34,1.01,-.55);lens=43;}
    else if(time<12.5){look=points[0].clone().lerp(points[1],.5);eye=look.clone().add(point(-.69,.20,.86));lens=29;}
    else if(time<18){eye=point(-.65+escort*.11,1.46,-5.52-escort*.85);look=point((cx+rx)*.5, .94-.20*enter,(cz+rz)*.5);lens=39;}
    else{eye=point(-1.24,1.52,-6.35);look=point(1.03,.87,-2.45);lens=39;}
    // Retreat along the same sight line for portrait screens, keeping the actors in frame.
    eye.sub(look).multiplyScalar(clamp(1.05/camera.aspect,1,2.05)).add(look);
    camera.position.copy(stage.localToWorld(eye));camera.lookAt(stage.localToWorld(look));camera.fov=lens;camera.updateProjectionMatrix();
    fade.style.opacity=String(1-k(0,.36));skip.hidden=time<1;
    const line=time>=3&&time<5.72?'Chase is over. Step out.':time>=6&&time<8.85?'Turn around. Hands behind your back.':time>=9&&time<11.65?'You’re under arrest.':'';
    if(sub.textContent!==line){sub.textContent=line;sub.hidden=!line;}
    if(time>=18.85&&!verdict.textContent)verdict.textContent=role==='cop'?'SUSPECT ARRESTED':'BUSTED';
    const flashes=Math.floor(time*8)%4;
    options.lights[0].material.color.set(flashes<2?'#ff344c':'#591a25');options.lights[1].material.color.set(flashes>=2?'#3d95ff':'#142b54');
    while(nextCue<cues.length&&cues[nextCue][0]<=time){const sound=cues[nextCue++][1];try{audio.arrestCue?.(sound);}catch{/* Audio failure does not stop animation. */}}
  }
  return {close,step(now,paused){
    if(destroyed)return;
    const delta=Math.max(0,(now-previous)/1000);previous=now;
    if(document.hidden||blurred||paused)return;
    t=Math.min(duration,t+delta);render(t);if(t>=duration)finish();
  }};
}
root.PlatdoArrestCinematic={create,staging,duration,shots};
})(window);
