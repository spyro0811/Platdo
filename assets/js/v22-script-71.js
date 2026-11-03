/* Shop displays are read-only. Models and effects use the same makers as gameplay. */
(function(root){
'use strict';
const activity=id=>/^(CITY-1[1-9]|DRIVE-(1[1-9]|20))$/.test(id);
const lookup=id=>root.PlatdoPremiumCatalog.byId[id];
function options(id,mode){
  const product=lookup(id);if(!product||product.availability==='retired')return [];
  if(product.includes?.length)return product.includes.flatMap(member=>options(member,mode).map(o=>({...o,label:lookup(member).name+' · '+o.label})));
  const city=root.PlatdoPremiumCity,fleet=root.PlatdoCityFleet,drive=root.PlatdoPremiumDrive;
  const wrap=(labels,extra={})=>labels.map((label,variant)=>({label,variant,productId:id,...extra}));
  if(city?.outfits[id])return wrap(city.outfits[id].map(item=>item.name));
  if(id==='CITY-04')return wrap(city.emotes.map(pair=>pair[1]));
  if(id==='CITY-03')return Object.keys(fleet.panels).flatMap(bikeType=>fleet.designs.slice(1).map((name,i)=>({productId:id,bikeType,variant:i+1,label:name+' · '+(root.CityVehicles?.byId?.[bikeType]?.name||bikeType)})));
  if(id==='CITY-06')return wrap(['Garage hangout']);
  if(id==='CITY-07')return wrap(['Modern','Cozy']);
  if(id==='CITY-08')return wrap(fleet.paints.map(p=>p[0]));
  if(id==='DRIVE-07')return ['Charcoal','Warm tan','Black stitching'].flatMap((trim,i)=>drive.choices[id].map((label,variant)=>({productId:id,variant,label:label+' · '+trim,driveSettings:{trim:i}})));
  if(drive?.choices[id])return wrap(drive.choices[id]);
  return wrap([product.name]);
}
function input(canvas,rotate,reset){
  const previous=canvas.style.touchAction,priorTab=canvas.getAttribute('tabindex');canvas.tabIndex=0;canvas.style.touchAction='none';
  let pointer=null,x=0,y=0;
  const down=e=>{if(pointer!==null||e.button!==0)return;pointer=e.pointerId;x=e.clientX;y=e.clientY;canvas.setPointerCapture?.(pointer);canvas.focus({preventScroll:true});};
  const move=e=>{if(e.pointerId!==pointer)return;const dx=e.clientX-x,dy=e.clientY-y;x=e.clientX;y=e.clientY;rotate(dx,dy);};
  const up=e=>{if(e.pointerId!==pointer)return;pointer=null;if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
  const key=e=>{const d={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[e.key];if(!d&&e.key!=='Home')return;e.preventDefault();e.stopPropagation();if(d)rotate(...d);else reset();};
  const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:up,lostpointercapture:up,keydown:key};
  for(const [event,fn] of Object.entries(events))canvas.addEventListener(event,fn);
  return ()=>{for(const [event,fn] of Object.entries(events))canvas.removeEventListener(event,fn);canvas.style.touchAction=previous;if(priorTab===null)canvas.removeAttribute('tabindex');else canvas.setAttribute('tabindex',priorTab);};
}
function orbit(canvas,camera,target,redraw){
  const T=root.THREE,start=new T.Spherical().setFromVector3(camera.position.clone().sub(target)),s=start.clone();
  function update(){camera.position.setFromSpherical(s).add(target);camera.lookAt(target);redraw();}
  const dispose=input(canvas,(x,y)=>{s.theta-=x*.009;s.phi=Math.max(.1,Math.min(Math.PI*.91,s.phi-y*.009));update();},()=>{s.copy(start);update();});
  return {dispose,angle:()=>s.theta};
}
function observe(canvas,redraw){const observer=new ResizeObserver(redraw);observer.observe(canvas);return ()=>observer.disconnect();}
function poster(id){const product=lookup(id);return product&&product.availability!=='retired'?(root.PlatdoShopCaptures?.posters?.[id]||''):'';}
function panorama(canvas,id){
  const entry=root.PlatdoShopCaptures?.views?.[id];if(!entry)throw Error('Missing activity photograph: '+id);
  const image=new Image(),ctx=canvas.getContext('2d');let angle=0,disposed=false;
  function render(){if(disposed||!image.complete||!image.naturalWidth)return;
    const w=Math.max(1,Math.round(canvas.clientWidth||480)),h=Math.max(1,Math.round(canvas.clientHeight||270));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const n=entry.frames,i=(Math.round(angle)%n+n)%n,sw=image.width/entry.columns,sh=image.height/Math.ceil(n/entry.columns);
    const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
    ctx.fillStyle='#14212b';ctx.fillRect(0,0,w,h);ctx.drawImage(image,i%entry.columns*sw,Math.floor(i/entry.columns)*sh,sw,sh,(w-dw)/2,(h-dh)/2,dw,dh);
  }
  const stopResize=observe(canvas,render),release=input(canvas,x=>{angle-=x/22;render();},()=>{angle=0;render();});image.onload=render;image.src=entry.image;render();
  return {available:true,animated:false,render,cameraAngle:()=>angle,dispose(){disposed=true;image.onload=null;stopResize();release();}};
}
function create(canvas,option){
  const id=option.productId,v=option.variant||0,T=root.THREE,city=root.PlatdoPremiumCity;
  if(!lookup(id)||lookup(id).availability==='retired')throw Error('This item is no longer in the shop.');
  if(activity(id))return panorama(canvas,id);
  if(id==='CITY-06'||id==='CITY-07'){
    const garage=id==='CITY-06',selection={garage:garage?'hangout':'original',house:garage?'original':v?'cozy':'modern'};
    const stage=root.PlatdoHomeFinishes.preview(canvas,id,selection),target=garage?new T.Vector3(stage.reflectX-14.64,1.43,stage.plan.depth-1.10):new T.Vector3(stage.reflectX-8.5,2.75,5);
    const controls=orbit(canvas,stage.camera,target,()=>stage.render(true)),stopResize=observe(canvas,()=>stage.render(true));stage.render(true);
    return {available:true,animated:false,render(){stage.render();},cameraAngle:controls.angle,dispose(){stopResize();controls.dispose();stage.dispose();}};
  }
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false}),scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.015,100);
  const dark=id==='DRIVE-03',target=new T.Vector3();scene.background=new T.Color(dark?'#1b222b':'#c9d4da');
  scene.add(new T.HemisphereLight(0xf0f7ff,0x657077,1.65));const key=new T.DirectionalLight(0xfff1d7,2.2);key.position.set(3,7,5);scene.add(key);
  const floor=new T.Mesh(new T.PlaneGeometry(180,180),new T.MeshStandardMaterial({color:dark?'#20262e':'#aebec6',roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-.014;scene.add(floor);
  let model,smoke,tryMode=0,lastTime=.36,width=0,height=0,animated=false,freeModel,disposed=false;
  if(city.outfits[id]||id==='CITY-04'){
    const appearance=city.previewAppearance(id,v);model=root.CityPeopleModels.create(appearance,{lod:0,modelDetail:5});city.decorateModel(model,appearance);freeModel=()=>root.CityPeopleModels.dispose(model);
    target.set(0,.99,0);camera.position.set(.45,1.17,3.38);animated=true;
  }else if(id==='CITY-03'||id==='CITY-08'){
    const buggy=id==='CITY-08',type=buggy?'sunrunner':option.bikeType||'kestrel-s',fleet=root.PlatdoCityFleet;
    model=root.CityVehicleModels.create(type,buggy?{paint:fleet.paints[v][1]}:{});if(!buggy)fleet.applyLivery(model,type,v);
    target.set(0,buggy?.65:.66,0);camera.position.set(buggy?3.6:2.8,buggy?1.9:1.55,buggy?4:2.2);freeModel=()=>root.CityVehicleModels.dispose(model);
  }else if(id==='DRIVE-23'||/^DRIVE-0[1-9]$/.test(id)){
    model=root.DriveScene.createCar(id==='DRIVE-23'?'f1':id==='DRIVE-09'?'compact':'vektor',id==='DRIVE-23'?'#df322c':'#426b82',true,null,3);
    root.PlatdoPremiumDrive.decorate(model,id,v,option.driveSettings);freeModel=()=>root.DriveScene.disposeCar(model);
    const d=model.userData;target.set(0,.66,0);camera.position.set(4.8,2.5,5.4);
    if(id==='DRIVE-23'){target.set(0,.45,.05);camera.position.set(3.46,1.85,4.35);}
    if(id==='DRIVE-03'){camera.position.set(3.8,.72,3.6);}
    if(id==='DRIVE-04'){target.set(d.width*.48,.42,d.length*.20);camera.position.set(d.width*1.64,.88,d.length*.42);}
    if(id==='DRIVE-05'){camera.position.z*=-1;}
    if(id==='DRIVE-07'){const group=model.getObjectByName('premium-'+id);group.getWorldPosition(target);target.y+=.065;camera.position.copy(target).add(new T.Vector3(.17,.20,-.43));}
    if(id==='DRIVE-08'){target.set(d.width*.32,.33,-d.length*.49);camera.position.copy(target).add(new T.Vector3(.76,.39,-1.5));if(d.premiumFlame)d.premiumFlame.visible=true;}
    if(id==='DRIVE-06'){
      // The exact game emitter, advanced to a controlled moment in a drift.
      const effect=Object.create(root.DriveScene.prototype);Object.assign(effect,{scene,dummy:new T.Object3D(),settings:{damageEffectScale:1},playerCar:model,setTireSmokeBudget:null,styleTireParticle:null});
      effect.buildTireEffects();const sim={},pose={x:0,y:0,z:0,speed:23,driftIntensity:.9,vz:-12,vx:9};
      for(let i=0;i<135;i++)effect.updateTireEffects(sim,pose,1/60,true);
      for(const p of effect.tireSmoke)p.sprite.material.color.set(root.PlatdoPremiumDrive.smokeColors[v]);smoke=effect;
      camera.position.set(4.75,2.05,-5.2);target.z=-.68;
    }
  }else{renderer.dispose();renderer.forceContextLoss();throw Error('No display model for '+id);}
  scene.add(model);camera.lookAt(target);
  function render(time=lastTime){if(disposed)return;const dt=Math.min(.1,Math.max(0,time-lastTime));lastTime=time;
    const w=Math.max(1,canvas.clientWidth||640),h=Math.max(1,canvas.clientHeight||360);
    if(w!==width||h!==height){width=w;height=h;const size=root.Platdo?.renderSize?.(w,h)||{width:w,height:h};renderer.setSize(Math.min(1200,size.width),Math.max(1,Math.round(Math.min(1200,size.width)*h/w)),false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    if(city.outfits[id]||id==='CITY-04'){
      const speed=tryMode===1?2:tryMode===2?5.6:0;root.CityPeopleModels.animate(model,{mode:'onFoot',speed,grounded:true},time,dt);
      if(id==='CITY-04')city.poseEmote(model.userData.rig,city.emotes[v][0],time);
    }
    renderer.render(scene,camera);
  }
  const controls=orbit(canvas,camera,target,()=>render()),stopResize=observe(canvas,()=>render());render();
  return {available:true,animated,render,cameraAngle:()=>controls.angle(),
    tryLabels:city.outfits[id]?['Stand','Walk','Run']:[],
    tryAction(i){tryMode=i;render();},
    dispose(){if(disposed)return;disposed=true;stopResize();controls.dispose();freeModel();
    if(smoke){smoke.tireEffects.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});smoke.tireSmokeTexture.dispose();}
    floor.geometry.dispose();floor.material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
root.PlatdoShopPreviews={create,options,poster,orbit};
})(window);
