/* Shop test sessions own their scene, inputs and physics. No save or entitlement adapter is installed. */
(function (root) {
'use strict';
const tourIds = new Set(['CITY-06', 'CITY-07']);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
let session = null;
function label(id) {
  if (tourIds.has(id)) return 'Tour';
  if(id==='DRIVE-23')return root.PlatdoPremium?.access(id)?.allowed===true?'Test Drive':'';
  return id === 'CITY-03' || id === 'CITY-08' || /^DRIVE-0[1-9]$/.test(id) ? 'Test Drive' : '';
}
function staticMesh(T, scene, geometry, color, x, y, z) {
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({color, roughness:.88}));
  mesh.position.set(x,y,z); scene.add(mesh); return mesh;
}
function disposeStage(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
function tour(canvas, id, options) {
  const T=root.THREE, H=root.CityHomes, garage=id==='CITY-06';
  const choice={house:garage?'original':options.variant===1?'cozy':'modern',garage:garage?'hangout':'original'};
  const view=root.PlatdoHomeFinishes.preview(canvas,id,choice,{tour:true});
  if (!view.available) throw Error('The home model is unavailable.');
  const stage=new T.Group(); view.scene.add(stage);
  const box=(x,y,z,w,h,d,c)=>staticMesh(T,stage,new T.BoxGeometry(w,h,d),c,x,y,z);
  box(0,-.19,2,38,.17,44,'#d2d8d7');
  for(const side of [-1,1]) {box(19*side,1.65,2,.24,3.3,44,'#dce3e2');box(0,1.65,2+22*side,38,3.3,.24,'#dce3e2');}
  const {origin,camera}=view;
  const solids=H.parts.filter(p=>p.solid&&!p.noRender).map(p=>({
    x:p.x-origin.x,z:p.z-origin.z,bottom:p.y-origin.y,top:p.y-origin.y+p.h,
    hx:p.w/2,hz:p.d/2,floor:p.floor
  }));
  let x,y,z,yaw,pitch;
  function reset(){x=garage?-6.4:1.25;y=0;z=garage?5.7:11;yaw=0;pitch=0;}
  reset(); camera.fov=66;
  function fits(nx,nz) {
    if(Math.abs(nx)>18.5||Math.abs(nz-2)>21.5)return false;
    return !solids.some(p=>p.bottom<y+1.63&&p.top>y+.225&&Math.abs(nx-p.x)<p.hx+.19&&Math.abs(nz-p.z)<p.hz+.19);
  }
  function walk(dt,input) {
    const length=Math.max(1,Math.hypot(input.forward,input.side));
    const stride=(input.fast?5.2:3.1)*dt/length;
    const dx=(Math.cos(yaw)*input.side-Math.sin(yaw)*input.forward)*stride;
    const dz=(-Math.sin(yaw)*input.side-Math.cos(yaw)*input.forward)*stride;
    if(fits(x+dx,z))x+=dx;
    if(fits(x,z+dz))z+=dz;
    let floor=0;
    for(const p of solids)if(p.floor&&p.top<=y+.225&&Math.abs(x-p.x)<=p.hx+.05&&Math.abs(z-p.z)<=p.hz+.05)floor=Math.max(floor,p.top);
    y=floor>=y?floor:Math.max(floor,y-dt*5);
    camera.position.set(x,y+1.63,z);camera.rotation.set(pitch,yaw,0,'YXZ');
    view.render(true);return garage?'Garage Hangout':choice.house==='cozy'?'Cozy Hideout':'Modern Retreat';
  }
  return {step:walk,look(dx,dy){yaw-=dx*.004;pitch=clamp(pitch-dy*.004,-1.25,1.25);},reset,
    snapshot:()=>({x,y,z,yaw,pitch,finish:choice}),dispose(){disposeStage(stage);view.dispose();}};
}
// The production Drive controller samples a route for its wheel contacts.
// On the test pad the surface and tangent are constant and there are no opponents or rewards to settle.
function padRoute() {
  const at=s=>({x:0,y:0,z:s,s,yaw:0,tx:0,tz:1,nx:1,nz:0,offset:0});
  return {id:'showroom-pad',length:2400,width:1400,halfWidth:700,barrierOffset:705,
    at,nearest:(x,z)=>({...at(z),offset:x,distance:Math.abs(x)}),surfaceHeight:()=>0,
    terrainGrid:()=>({extent:700}),obstacles:[]};
}
function cityDriver(id,variant,bikeType) {
  const V=root.CityVehicles, M=root.CityVehicleModels, fleet=root.PlatdoCityFleet;
  const type=id==='CITY-08'?'sunrunner':Object.hasOwn(fleet.panels,bikeType)?bikeType:'kestrel-s';
  const customization=id==='CITY-08'?{paint:fleet.paints[variant]?.[1]??fleet.paints[0][1]}:{};
  const make=()=>{const e=V.createVehicle(type,'shop-trial',{customization});e.seatOccupants[0]='player';return e;};
  let body=make();
  const model=M.create(type,body.customization,{modelDetail:3});
  if(id==='CITY-03')fleet.applyLivery(model,type,variant||1);
  const people=root.CityPeopleModels,appearance=root.PlatdoAvatar?.get()?.appearance||root.CityPeople?.presets?.[0];
  const rider=people&&appearance?people.create(appearance,{lod:0,modelDetail:3}):null;
  if(rider)model.add(rider);
  return {model,get body(){return body;},reset(){body=make();},dispose(){if(rider){rider.removeFromParent();people.dispose(rider);}M.dispose(model);},
    step(dt,input){const count=Math.max(1,Math.ceil(dt*60));for(let i=0;i<count;i++)V.stepVehicle(body,dt/count,{
      throttle:input.forward,steer:-input.side,handbrake:input.brake,jump:input.jump,leanBack:input.leanBack,leanForward:input.leanForward
    });M.update(model,body,dt);
    if(rider){rider.visible=!!body.seatOccupants[0];const d=V.definition(body),seat=d.seats[0];rider.position.set(seat.position.x,seat.position.y,seat.position.z);
      people.animate(rider,{mode:'seated',seatPose:seat.pose,steer:body.visual?.steer||0,bikeLean:body.bikeBalance?.lean||0,bikeTuck:body.bikeBalance?.tuck||0,
        bikeSport:d.bikeSport||false,bikeTargets:V.bikeRiderTargets?.(body,0),carTargets:V.carRiderTargets?.(body,0)},body.simTime,dt);}
    }};
}
function driveDriver(id,variant,options) {
  const C=root.DriveCore, D=root.DriveScene;
  const type=id==='DRIVE-23'?'f1':id==='DRIVE-09'?'compact':'vektor',config=C.getConfig(type);
  const sim=new C.Simulation(padRoute(),config,{mode:'free',trafficCount:0});
  const model=D.createCar(type,'#e2a342',true,config,3);
  root.PlatdoPremiumDrive.decorate(model,id,variant,options.driveSettings||{});
  const controller={playerCar:model,settings:{graphicsValues:{effects:'high'}},time:0,updateOccupants:D.prototype.updateOccupants};
  return {model,get body(){return sim.player;},reset(){sim.reset();},dispose:()=>D.disposeCar(model),
    step(dt,input){sim.step(dt,{throttle:Math.max(0,input.forward),brake:Math.max(0,-input.forward),steer:-input.side,handbrake:input.brake});
      controller.time+=dt;D.prototype.updateCar.call(controller,model,sim.player,dt);}};
}
function tireEffects(T,stage,driver,color) {
  const effects=Object.create(root.DriveScene.prototype);
  Object.assign(effects,{scene:stage,dummy:new T.Object3D(),playerCar:driver.model,settings:{graphicsValues:{smokeParticleBudget:36}}});
  effects.buildTireEffects();
  return {update(dt,body){
    // Every point on the pad is asphalt, including positions off the marked slalom.
    effects.updateTireEffects(driver,{...body,offset:0},dt,true);
    if(color)for(const p of effects.tireSmoke)if(p.sprite.visible)p.sprite.material.color.set(color);
  },clear:()=>effects.resetTireEffects(),stats:()=>({...effects.tireEffectStats}),dispose:()=>effects.tireSmokeTexture.dispose()};
}
function vehicle(canvas,id,options) {
  const T=root.THREE,variant=Number(options.variant)||0,isCity=id.startsWith('CITY');
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'}),scene=new T.Scene(),stage=new T.Group(),camera=new T.PerspectiveCamera(56,1,.03,520);
  let driver,smoke;
  function dispose(){smoke?.dispose();driver?.dispose();disposeStage(stage);renderer.dispose();renderer.forceContextLoss();}
  try {
    scene.add(stage);scene.background=new T.Color('#e9f0f5');scene.fog=new T.Fog('#e9f0f5',125,430);
    scene.add(new T.HemisphereLight('#ffffff','#bdc4ce',2));
    const light=new T.DirectionalLight('#fff4d9',2.5);light.position.set(28,40,19);scene.add(light);
    const ground=staticMesh(T,stage,new T.PlaneGeometry(1420,1420),'#ffffff',0,-.025,0);ground.rotation.x=-Math.PI/2;
    const grid=new T.GridHelper(1400,280,0x93a8b1,0xd3dde1);grid.position.y=-.015;stage.add(grid);
    const coneGeometry=new T.ConeGeometry(.31,.78,12);
    for(let z=-300;z<=300;z+=18)for(const x of [-8,8])staticMesh(T,stage,coneGeometry,'#dd743d',x,.39,z);
    driver=isCity?cityDriver(id,variant,options.bikeType):driveDriver(id,variant,options);scene.add(driver.model);
    if(!isCity)smoke=tireEffects(T,stage,driver,id==='DRIVE-06'?root.PlatdoPremiumDrive.smokeColors[variant]:null);
    let orbit=0,elevation=.24,cockpit=id==='DRIVE-07',elapsed=0;
    const eye=new T.Vector3(),forward=new T.Vector3();
    function reset(){driver.reset();orbit=0;elevation=.24;smoke?.clear();}
    function step(dt,input) {
      elapsed+=dt;driver.step(dt,input);
      if(Math.max(Math.abs(driver.body.x),Math.abs(driver.body.z))>650)reset();
      const b=driver.body, angle=b.yaw+orbit;smoke?.update(dt,b,input);
      if(cockpit&&driver.model.userData.driverEyeAnchor){
        driver.model.updateMatrixWorld(true);driver.model.userData.driverEyeAnchor.getWorldPosition(eye);
        camera.position.copy(eye);forward.set(Math.sin(angle),Math.sin(elevation-.26),Math.cos(angle));camera.lookAt(eye.add(forward));
      }else{
        const distance=isCity&&id==='CITY-03'?4.8:7.4,arm=distance*Math.cos(elevation);
        camera.position.set(b.x-Math.sin(angle)*arm,b.y+1.12+Math.sin(elevation)*distance,b.z-Math.cos(angle)*arm);
        camera.lookAt(b.x,b.y+.90,b.z);
      }
      const size=root.Platdo?.renderSize?.(canvas.clientWidth,canvas.clientHeight)||{width:canvas.clientWidth,height:canvas.clientHeight};
      const w=Math.max(1,Math.min(size.width,1600)),h=Math.max(1,Math.round(w*size.height/Math.max(1,size.width)));
      if(canvas.width!==w||canvas.height!==h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
      renderer.render(scene,camera);return Math.round(Math.abs(b.speed)*2.23694)+' MPH';
    }
    return {step,reset,look(dx,dy){orbit-=dx*.006;elevation=clamp(elevation+dy*.004,cockpit?-.55:.08,1.12);},
      view:driver.model.userData.driverEyeAnchor?()=>{cockpit=!cockpit;orbit=0;elevation=.24;}:null,
      snapshot:()=>({x:driver.body.x,y:driver.body.y,z:driver.body.z,yaw:driver.body.yaw,speed:driver.body.speed,variant,cockpit,elapsed,tireEffects:smoke?.stats()}),dispose};
  } catch(error){dispose();throw error;}
}
function open(id,options={}) {
  if(!label(id))throw Error('This product has no vehicle or building trial.');
  session?.close();
  const isTour=tourIds.has(id),isBike=id==='CITY-03',city=id.startsWith('CITY');
  const host=document.createElement('dialog');host.className='platdo-shop-trial';host.dataset.premiumTrial=id;
  const product=root.PlatdoPremiumCatalog?.byId?.[id], title=product?.name||label(id);
  host.setAttribute('aria-label',title+' '+label(id));
  host.innerHTML='<canvas tabindex="0" aria-label="Interactive test area"></canvas><header><div><small></small><h2></h2></div><button type="button" data-leave>Back to shop</button></header><footer><div><output></output><p></p></div><div class="trial-actions"></div></footer><div class="trial-touch" hidden><div data-direction></div><div data-actions></div></div>';
  const canvas=host.querySelector('canvas'),hint=host.querySelector('p'),touch=host.querySelector('.trial-touch'),readout=host.querySelector('output');
  host.querySelector('small').textContent=isTour?'PROPERTY TOUR':'TEST TRACK';host.querySelector('h2').textContent=title;
  const opener=document.activeElement;document.body.append(host);host.showModal();
  let world;
  try{world=isTour?tour(canvas,id,options):vehicle(canvas,id,options);}
  catch(error){host.close();host.remove();opener?.focus?.({preventScroll:true});throw error;}
  let frame=0,last=null,closed=false,mobile=false,drag=null;
  const controller=new AbortController(), keys=new Set(), touches=new Map();
  function on(target,type,handler,extra={}){target.addEventListener(type,handler,{...extra,signal:controller.signal});}
  function clear(){keys.clear();touches.clear();drag=null;for(const b of touch.querySelectorAll('[aria-pressed="true"]'))b.setAttribute('aria-pressed','false');}
  function close(){if(closed)return;closed=true;session=null;cancelAnimationFrame(frame);controller.abort();clear();
    try{world.dispose();}finally{if(host.open)host.close();host.remove();if(opener?.isConnected)opener.focus({preventScroll:true});options.onClose?.();}}
  function addButton(parent,title,action){const b=document.createElement('button');b.type='button';b.textContent=title;parent.append(b);if(action)b.onclick=action;return b;}
  const actions=host.querySelector('.trial-actions');
  if(world.view)addButton(actions,'Camera',world.view);
  addButton(actions,isTour?'Back to entrance':'Reset vehicle',world.reset);
  function control(name,title,side){const b=addButton(touch.querySelector(side?'[data-actions]':'[data-direction]'),title);b.dataset.trialInput=name;b.setAttribute('aria-pressed','false');
    on(b,'pointerdown',e=>{if(!mobile)return;e.preventDefault();b.setPointerCapture(e.pointerId);touches.set(e.pointerId,name);b.setAttribute('aria-pressed','true');});
    const release=e=>{touches.delete(e.pointerId);b.setAttribute('aria-pressed',String([...touches.values()].includes(name)));};
    on(b,'pointerup',release);on(b,'pointercancel',release);on(b,'lostpointercapture',release);
  }
  control('left',isTour?'Move left':'Steer left');control('right',isTour?'Move right':'Steer right');
  control('forward',isTour?'Forward':'Accelerate',true);control('back',isTour?'Back':'Reverse / brake',true);
  if(!isTour)control('brake','Handbrake',true);
  if(city&&!isTour)control('jump','Jump',true);
  if(isBike){control('leanBack','Lean back',true);control('leanForward','Lean forward',true);}
  const keyMap={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'brake',KeyJ:'jump',ShiftLeft:'fast',ShiftRight:'fast',KeyQ:'leanBack',KeyE:'leanForward'};
  function setMode(){
    const next=(root.Platdo?.controls?.getMode?.(city?'platdo-city':'platdo-drive')||root.Platdo?.controls?.mode)==='mobile';
    if(next!==mobile)clear();mobile=next;touch.hidden=!mobile;host.dataset.controlMode=mobile?'mobile':'pc';
    hint.textContent=mobile?'Drag the view to look around.':isTour?'WASD to walk · Drag to look · Shift to run':
      'WASD to drive · Space for handbrake · Drag to look'+(city?' · J to jump':'')+(isBike?' · Q/E to lean':'');
  }
  function key(e){if(closed)return;
    if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(e.type==='keydown'&&!e.repeat)close();return;}
    const name=keyMap[e.code];if(!name)return;e.preventDefault();e.stopImmediatePropagation();if(!mobile){if(e.type==='keydown')keys.add(e.code);else keys.delete(e.code);}}
  on(root,'keydown',key,{capture:true});on(root,'keyup',key,{capture:true});
  on(root,'blur',clear);on(document,'visibilitychange',()=>{clear();last=null;});on(root,'platdo:settingschange',setMode);on(root,'platdo:controlspreferenceschange',setMode);
  on(root,'platdo:beforereset',close);on(host,'cancel',e=>{e.preventDefault();close();});
  host.querySelector('[data-leave]').onclick=close;
  on(canvas,'pointerdown',e=>{if((e.pointerType==='touch')!==mobile||drag||(!mobile&&e.button!==0&&e.button!==2))return;
    e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};});
  on(canvas,'pointermove',e=>{if(drag?.id!==e.pointerId)return;world.look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])on(canvas,event,e=>{if(e.pointerId===drag?.id)drag=null;});
  on(canvas,'contextmenu',e=>e.preventDefault());
  function held(action){return mobile?[...touches.values()].includes(action):[...keys].some(code=>keyMap[code]===action);}
  function draw(dt){const str=world.step(dt,{forward:Number(held('forward'))-Number(held('back')),side:Number(held('right'))-Number(held('left')),brake:held('brake'),
    jump:held('jump'),fast:held('fast'),leanBack:+held('leanBack'),leanForward:+held('leanForward')});if(readout.textContent!==str)readout.textContent=str;}
  function tick(now){if(closed)return;frame=requestAnimationFrame(tick);if(document.hidden)return;
    if(last!==null&&now-last<1000/(root.Platdo?.frameRate||60)-.4)return;
    const dt=last===null?0:Math.min(.08,(now-last)/1000);last=now;draw(dt);}
  session={close,snapshot:()=>({id,mode:mobile?'mobile':'pc',...world.snapshot()})};setMode();canvas.focus();
  try{draw(0);frame=requestAnimationFrame(tick);}catch(error){close();throw error;}
  return session;
}
root.PlatdoPremiumTrials={label,open,close:()=>session?.close(),get active(){return !!session;},snapshot:()=>session?.snapshot()||null};
root.PlatdoPremium?.subscribe?.(()=>{if(session?.snapshot().id==='DRIVE-23'&&!label('DRIVE-23'))session.close();});
})(window);
