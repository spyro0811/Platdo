/* Bank getaway. Cars, input authority, clock and outcomes arrive from the shared room. */
(function(root){
'use strict';
let active=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const heading=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
function letters(text,background,color,width=384,height=80){
  const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 '+Math.floor(height*.53)+'px system-ui';ctx.fillText(text,width/2,height*.5,width*.94);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;return map;
}
function citySet(scene){
  const T=root.THREE,core=root.PlatdoCopChaseCore,geometry=new T.BoxGeometry(),slabs=new Map(),textures=new Map(),transform=new T.Object3D();
  function slab(x,y,z,w,h,l,color){
    if(!slabs.has(color))slabs.set(color,[]);slabs.get(color).push([x,y,z,w,h,l]);
  }
  function flush(){for(const [color,items] of slabs){const mat=new T.MeshStandardMaterial({color,roughness:.82});const batch=new T.InstancedMesh(geometry,mat,items.length);
    items.forEach(([x,y,z,w,h,l],i)=>{transform.position.set(x,y,z);transform.scale.set(w,h,l);transform.updateMatrix();batch.setMatrixAt(i,transform.matrix);});batch.receiveShadow=true;scene.add(batch);
  }}
  function sign(name,x,y,z,w,h,angle,background='#273f47',color='#ffe9b5'){
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:letters(name,background,color),side:T.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=angle;scene.add(mesh);
  }
  function facade(seed,style){
    const key=style+seed%4;if(textures.has(key))return textures.get(key);
    const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');
    g.fillStyle={brick:'#ab7160',office:'#52727e',shop:'#c6a477',apartments:'#9f9d99'}[style];g.fillRect(0,0,256,256);
    for(let row=0;row<6;row++){g.fillStyle=style==='office'?'#8e9fa2':'#7c7971';g.fillRect(0,row*43,256,3);
      for(let col=0;col<6;col++){const x=col*42+6,y=row*43+9,lit=(row*7+col*23+seed)%5;g.fillStyle='#3b545d';g.fillRect(x-2,y-2,32,28);
        g.fillStyle=lit===1?'#e6c78b':lit===2?'#c1baa5':'#6d929c';g.fillRect(x,y,28,24);
        g.fillStyle='#445965';g.fillRect(x+13,y,2,24);g.fillRect(x,y+13,28,2);}}
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const mat=new T.MeshStandardMaterial({map,roughness:.75});textures.set(key,mat);return mat;
  }
  const roof=new T.MeshStandardMaterial({color:'#767f7d',roughness:.87});
  slab(0,-.25,0,450,.5,450,'#49515b');
  for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
    const x=i*core.block,z=j*core.block;
    for(let m=16;m<core.block-12;m+=9){
      if(j<3){slab(x-.19,.012,z+m,.115,.018,4.4,'#e4b65f');slab(x+.19,.012,z+m,.115,.018,4.4,'#e4b65f');}
      if(i<3){slab(x+m,.012,z-.19,4.4,.018,.115,'#e4b65f');slab(x+m,.012,z+.19,4.4,.018,.115,'#e4b65f');}
    }
    for(let k=-4;k<=4;k++){slab(x+k*1.6,.018,z+10,.45,.015,2.25,'#c2c2b4');slab(x+10,.018,z+k*1.6,2.25,.015,.45,'#c2c2b4');}
  }
  for(const b of core.buildings){
    const park=b.style==='park';slab(b.x,.05,b.z,b.w+3,.10,b.l+3,park?'#719276':'#b1aba1');
    if(park){for(const n of [-1,1])for(const m of [-1,1]){slab(b.x+n*12,1.4,b.z+m*11,.8,2.8,.8,'#65564c');slab(b.x+n*12,3.9,b.z+m*11,5,4.6,5,'#54765e');}continue;}
    if(b.style==='bank'){
      slab(b.x,4.1,b.z,b.w,8.2,b.l,'#bbb7a2');slab(b.x,8.3,b.z,b.w+.8,.75,b.l+.8,'#8f978f');
      const face=b.x+b.w/2;
      slab(face+.11,2.5,b.z,.24,5,10,'#3b555f');slab(face+.36,3.8,b.z,.18,.18,10,'#a0b0ad');
      for(const k of [-14,-7,0,7,14])slab(face+.42,3.4,b.z+k,.68,6.8,.68,'#d1cbb6');
      sign('UNION BANK',face+.5,6.95,b.z,22,2.1,Math.PI/2);continue;
    }
    const wall=facade(b.seed,b.style),mesh=new T.Mesh(geometry,[wall,wall,roof,roof,wall,wall]);mesh.scale.set(b.w,b.height,b.l);mesh.position.set(b.x,b.height/2,b.z);scene.add(mesh);
    slab(b.x,b.height+.16,b.z,b.w+.32,.32,b.l+.32,'#879092');slab(b.x-7,b.height+1,b.z+3,5,2,7,'#6f8181');
    if(b.style==='shop')sign(['ELM MARKET','AUTO PARTS','DINER','METRO RADIO'][b.seed%4],b.x,2.9,b.z+b.l/2+.03,17,1.65,0);
  }
  for(const n of [-1,1]){slab(n*(core.edge+.3),.52,0,.6,1.04,core.edge*2,'#aeaba2');slab(0,.52,n*(core.edge+.3),core.edge*2,1.04,.6,'#aeaba2');}
  flush();
}
function soundtrack(){
  let ctx,master,next=0,index=0;const arrestVoices=new Set();const bass=[43,43,46,41,43,48,46,39];
  function tone(f,d,t,type,level,end=f){
    const voice=ctx.createOscillator(),gain=ctx.createGain();voice.type=type;voice.frequency.setValueAtTime(f,t);voice.frequency.exponentialRampToValueAtTime(end,t+d);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(level,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+d);voice.connect(gain).connect(master);voice.start(t);voice.stop(t+d+.02);
  }
  return {unlock(){if(!ctx){const C=root.AudioContext||root.webkitAudioContext;if(!C)return;ctx=new C();master=ctx.createGain();master.gain.value=.33;master.connect(ctx.destination);}if(ctx.state!=='running')ctx.resume().catch(()=>{});},
    tick(playing){if(!ctx||ctx.state!=='running')return;if(!playing){next=ctx.currentTime;return;}const vol=root.PlatdoDrive?.save?.settings;
      master.gain.value=vol?.mute?0:.28*clamp(Number(vol?.musicVolume??.9),0,1);
      if(next<ctx.currentTime)next=ctx.currentTime+.012;while(next<ctx.currentTime+.13){const beat=index%16;
        if(beat%4===0)tone(112,.16,next,'sine',.88,38);
        if(beat%2===0)tone(440*Math.pow(2,(bass[Math.floor(index/2)%8]-69)/12),.19,next,'triangle',.4);
        if(beat===4||beat===12)tone(179,.095,next,'triangle',.21,75);tone(beat%2?2410:1940,.026,next,'square',.027);
        if(beat===3||beat===7||beat===14)tone([261.6,311.1,349.2][(index>>3)%3],.10,next,'triangle',.13);next+=.119;index++;}},
    arrestCue(id){
      if(!ctx||ctx.state!=='running')return;
      const settings=root.PlatdoDrive?.save?.settings||{},levels={
        idle:[55,43,.55,.08,'triangle'],siren:[450,630,.48,.021,'sine'],step:[125,45,.12,.21,'triangle'],
        latch:[461,140,.07,.14,'square'],door:[130,29,.24,.35,'triangle'],cloth:[192,118,.15,.032,'sawtooth'],
        metal:[1620,1020,.10,.075,'triangle'],click:[2370,690,.09,.19,'square'],resolve:[247,123,.74,.18,'triangle']
      },cue=levels[id];if(!cue)return;
      const volume=(settings.mute?0:settings.master??.8)*(id==='resolve'?(settings.music??.35):(settings.effects??.8));
      if(volume<=0)return;
      const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=cue[4];osc.frequency.setValueAtTime(cue[0],now);osc.frequency.exponentialRampToValueAtTime(cue[1],now+cue[2]);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.00011,volume*cue[3]),now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+cue[2]);
      osc.connect(gain).connect(ctx.destination);arrestVoices.add(osc);osc.onended=()=>{arrestVoices.delete(osc);osc.disconnect();gain.disconnect();};osc.start();osc.stop(now+cue[2]+.01);
    },
    stopArrest(){for(const voice of arrestVoices)try{voice.stop();}catch{}},
    close(){ctx?.close().catch(()=>{});}};
}
function open({role,input,onExit,onResult,alreadyShown=false}){
  if(!['cop','robber'].includes(role)||typeof input!=='function')throw Error('A chase role and an active room are required.');
  active?.close();
  const T=root.THREE,core=root.PlatdoCopChaseCore,overlay=document.createElement('section');
  overlay.className='drive-chase';overlay.setAttribute('aria-label','Cop Chase');
  overlay.innerHTML='<canvas aria-label="Bank district chase"></canvas><div class="drive-chase-hud"><div class="drive-chase-header"><small>PLATDO DRIVE / ONLINE</small><strong></strong></div><output class="drive-chase-time"></output><div class="drive-chase-card"><b></b><span></span></div></div><button type="button">Leave chase</button>';
  document.body.append(overlay);const canvas=overlay.querySelector('canvas'),roleName=overlay.querySelector('strong'),clock=overlay.querySelector('output'),caption=overlay.querySelector('b'),hint=overlay.querySelector('.drive-chase-card span');
  roleName.textContent=role==='cop'?'INTERCEPTOR 01':'GETAWAY DRIVER';caption.textContent='Union Bank';hint.textContent='Waiting for the starting shot';
  let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});}catch(e){overlay.remove();throw e;}
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(57,1,.08,580),aim=new T.Vector3(),eye=new T.Vector3(),cameraAim=new T.Vector3();
  scene.background=new T.Color('#aec6ce');scene.fog=new T.FogExp2('#b8c4c5',.0039);scene.add(new T.HemisphereLight('#fff2e2','#7a8898',1.85));
  const sun=new T.DirectionalLight('#ffd5ae',2.5);sun.position.set(-75,100,-40);scene.add(sun);citySet(scene);
  const cars={},occupants=[],lights=[],audio=soundtrack(),engine=new root.DriveAudio(),meshes=[];engine.setSettings(root.PlatdoDrive?.save?.settings||{});
  function box(parent,w,h,l,color,x,y,z,emissive=false){
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,l),emissive?new T.MeshBasicMaterial({color}):new T.MeshStandardMaterial({color,roughness:.62}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  const appearance={...root.CityPeople.presets[0],topColor:'#313840',bottomColor:'#27323a',shoeColor:'#202733',hatColor:'#353f47'};
  const uniform={...root.CityPeople.presets[0],topColor:'#263b54',bottomColor:'#1c2c42',shoeColor:'#1c252b',hat:3,hatColor:'#243346',accessory:0};
  for(const r of ['cop','robber']){
    const model=root.DriveScene.createCar(r==='cop'?'vektor':'apex',r==='cop'?'#e8e5d7':'#b23a33',true,null,3);
    cars[r]=model;scene.add(model);const d=model.userData,seats=d.occupantLayout;
    for(const [i,seat] of (seats?.seats||[]).slice(0,r==='cop'?1:2).entries()){
      if(i===0){
        const driver=root.CityPeopleModels.create(r==='cop'?uniform:appearance,{lod:1,modelDetail:2});driver.position.set(seat.x,seat.y,seat.z);driver.scale.multiplyScalar(Math.min(1,seats.adultScale||1));d.body.add(driver);
        root.CityPeopleModels.animate(driver,{mode:'driver'},0,.016);occupants.push({root:driver});if(r==='robber')meshes.push(driver);
      }else{
        const passenger=root.DriveScene.createOccupant(i,seat,seats.adultScale||1,false,'woman');d.body.add(passenger.root);occupants.push(passenger);
      }
    }
    if(r==='cop'){
      box(d.body,d.width*.73,.08,.28,'#293741',0,d.height+.02,0);
      lights.push(box(d.body,d.width*.31,.115,.24,'#fc454e',-.36,d.height+.105,0,true),box(d.body,d.width*.31,.115,.24,'#458aff',.36,d.height+.105,0,true));
      for(const side of [-1,1]){const badge=new T.Mesh(new T.PlaneGeometry(1.18,.31),new T.MeshBasicMaterial({map:letters('POLICE','#172934','#f8f3de'),side:T.DoubleSide}));
        badge.position.set(side*d.width*.503,d.belt*.75,-.02);badge.rotation.y=side*Math.PI/2;d.body.add(badge);}
    }
  }
  const runner=root.CityPeopleModels.create(appearance,{lod:0,modelDetail:3});scene.add(runner);
  const bagMaterial=new T.MeshStandardMaterial({color:'#52614d',roughness:.97});for(const hand of ['handL','handR']){
    const bag=new T.Mesh(new T.CapsuleGeometry(.12,.23,3,8),bagMaterial);bag.rotation.z=Math.PI/2;bag.position.y=-.19;runner.userData.rig[hand].add(bag);
  }
  const noteTexture=letters('$100','#b8c8a2','#375f49',96,48),money=new T.InstancedMesh(new T.PlaneGeometry(.19,.09),new T.MeshBasicMaterial({map:noteTexture,side:T.DoubleSide}),60);money.frustumCulled=false;money.count=0;scene.add(money);
  const bits=[],dummy=new T.Object3D();let seed=0,spill=0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function cash(dt,shot){
    const p=shot.robber,outOfBag=shot.phase==='intro'&&shot.phaseTime<3.4,turn=shot.phase==='chase'&&Math.abs(p.steer)>.025&&Math.abs(p.speed)>4;
    if(outOfBag||turn){spill+=dt*(outOfBag?13:Math.min(16,90*Math.abs(p.steer)));while(spill>=1){spill--;const sign=p.steer>0?-1:1,side=sign*1.02;
      if(bits.length<60)bits.push({x:outOfBag?runner.position.x:p.x+Math.cos(p.yaw)*side,y:outOfBag?1.05:1.03,z:outOfBag?runner.position.z:p.z-Math.sin(p.yaw)*side,
        vx:outOfBag?rand()-.5:p.vx*.62+Math.cos(p.yaw)*sign*(2+rand()*2),vz:outOfBag?rand()-.5:p.vz*.62-Math.sin(p.yaw)*sign*2,vy:rand()+.25,age:0,spin:rand()*7});}}
    for(let i=bits.length-1;i>=0;i--){const n=bits[i];n.age+=dt;if(n.age>3){bits.splice(i,1);continue;}n.x+=n.vx*dt;n.z+=n.vz*dt;n.vx*=Math.exp(-dt*2.3);n.vz*=Math.exp(-dt*2.3);n.vy-=dt*2.55;n.y=Math.max(.035,n.y+n.vy*dt);}
    bits.forEach((n,i)=>{dummy.position.set(n.x,n.y,n.z);dummy.rotation.set(n.y<.04?-Math.PI/2:n.age*5+n.spin,n.spin+n.age,n.y<.04?0:n.age*3);dummy.updateMatrix();money.setMatrixAt(i,dummy.matrix);});
    money.count=bits.length;money.instanceMatrix.needsUpdate=true;
  }
  let driveView=root.PlatdoDrive?.camera||'chase',distance=root.PlatdoDrive?.save?.settings?.chaseDistance||6.2,orbit=0,lookPitch=0,lookTime=0,drag=false,gear=1;
  let stopped=false,suspended=false,linkDown=false,latest=null,previous=null,received=0,previousTime=0,lastFrame=0,frame=0,first=true,lastSend=0,lastAxes='',lastCaption='',touchSteer=0;
  let arrest=null,arrestShown=alreadyShown;
  function finishArrest(){if(arrestShown||stopped)return;arrestShown=true;arrest=null;first=true;lastCaption='';onResult?.(latest?.round);root.Platdo.controls?.refresh?.();}
  const keys=new Set(),touch=new Set(),networkSkids=new root.DriveScene.NetworkSkids(scene);
  const pausePanel=document.createElement('section');pausePanel.className='drive-chase-pause';pausePanel.hidden=true;
  pausePanel.innerHTML='<article><small>PLATDO DRIVE / ONLINE</small><h2>Paused</h2><p>The other driver is still on the road.</p><button data-chase-resume>Resume</button><button data-chase-room>Room &amp; friends</button></article>';
  overlay.append(pausePanel);
  function localPause(open){clear();pausePanel.hidden=!open;root.Platdo.controls?.refresh?.();if(open)pausePanel.querySelector('button').focus();}
  pausePanel.querySelector('[data-chase-resume]').onclick=()=>localPause(false);
  pausePanel.querySelector('[data-chase-room]').onclick=()=>{localPause(false);root.PlatdoFriendsPanel?.open('drive');};
  const arrow={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'throttle',ArrowDown:'brake'};
  const buttons=(id,bindings)=>[bindings[id]].flat().filter(Boolean);
  function mapped(key,id,bindings){return buttons(id,bindings).includes(key)||arrow[key]===id&&!Object.keys(bindings).some(action=>!['slowFaster','slowSlower'].includes(action)&&buttons(action,bindings).includes(key));}
  function axes(){const bind=root.PlatdoDrive?.save?.bindings||root.DriveCore.DEFAULT_BINDINGS,held=id=>touch.has(id)||[...keys].some(key=>mapped(key,id,bind));
    return {gear,manual:root.PlatdoDrive?.save?.settings?.transmission==='manual',steer:clamp(-touchSteer+Number(held('left'))-Number(held('right')),-1,1),throttle:Number(held('throttle')),brake:Number(held('brake')),handbrake:held('handbrake')};}
  function send(force=false){if(stopped||suspended||linkDown||latest?.reconnecting||latest?.outcome)return;const next=pausePanel.hidden?axes():{steer:0,throttle:0,brake:0,handbrake:false},serial=JSON.stringify(next),now=performance.now();if(force||serial!==lastAxes||now-lastSend>180){input(next);lastAxes=serial;lastSend=now;}}
  function clear(){keys.clear();touch.clear();touchSteer=0;send(true);}
  function key(e){if(!active||stopped||suspended||linkDown||latest?.reconnecting||e.target?.closest?.('input,textarea,select,[contenteditable=true]'))return;if(e.code==='Escape'||buttons('pause',root.PlatdoDrive?.save?.bindings||root.DriveCore.DEFAULT_BINDINGS).includes(e.code)){if(e.type==='keydown'&&!e.repeat){if(latest?.outcome)leave();else localPause(pausePanel.hidden);}e.preventDefault();e.stopImmediatePropagation();return;}
    if(latest?.outcome)return;
    if((root.Platdo.controls?.getMode?.('platdo-drive')||root.Platdo.controls?.mode)==='mobile')return;
    const b=root.PlatdoDrive?.save?.bindings||root.DriveCore.DEFAULT_BINDINGS;
    if(!pausePanel.hidden)return;const extra=['camera','horn',...Array.from({length:6},(_,i)=>'gear'+(i+1))].find(id=>mapped(e.code,id,b));if(extra){e.preventDefault();e.stopImmediatePropagation();if(e.type==='keydown'&&!e.repeat)auxiliary(extra);return;}
    if(!['throttle','brake','left','right','handbrake'].some(id=>mapped(e.code,id,b)))return;
    e.preventDefault();e.stopImmediatePropagation();if(e.repeat&&!keys.has(e.code))return;audio.unlock();engine.unlock();if(e.type==='keydown')keys.add(e.code);else keys.delete(e.code);send();
  }
  function auxiliary(id){if(id==='camera'){driveView=['chase','hood','cockpit'][(['chase','hood','cockpit'].indexOf(driveView)+1)%3];first=true;orbit=lookPitch=0;}else if(id==='horn'){engine.unlock();engine.horn();}else if(id.startsWith('gear')){gear=id==='gearUp'?Math.min(6,gear+1):id==='gearDown'?Math.max(1,gear-1):Number(id.slice(4));send(true);}}
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{if(e.button===2){drag=true;canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(drag&&pausePanel.hidden){orbit-=e.movementX*.007;lookPitch=clamp(lookPitch-e.movementY*.005,-.5,.65);lookTime=performance.now();}});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{drag=false;});
  canvas.addEventListener('wheel',e=>{if(driveView==='chase'&&pausePanel.hidden){distance=clamp(distance+Math.sign(e.deltaY)*.65,2.5,18);e.preventDefault();}},{passive:false});
  const unregister=root.Platdo.controls?.register('drive-cop-chase',{name:'Cop Chase',priority:105,gameId:()=>'platdo-drive',visible:()=>!stopped&&!suspended&&pausePanel.hidden&&!latest?.outcome,playing:()=>!stopped&&!suspended&&!latest?.outcome&&!linkDown&&!latest?.reconnecting,
    layout:()=>({key:'chase',move:true,look:false,buttons:[{id:'throttle',label:'Gas',hold:true},{id:'brake',label:'Brake',hold:true},{id:'handbrake',label:'Drift',hold:true},{id:'pause',label:'Pause',side:'top'},{id:'camera',label:'Camera',side:'top'},{id:'horn',label:'Horn'},...(root.PlatdoDrive?.save?.settings?.transmission==='manual'?[{id:'gearUp',label:'Gear +'},{id:'gearDown',label:'Gear −'}]:[])]}),
    move(x){touchSteer=x;send();},action(id,held){if(id==='pause'){if(held)localPause(true);return;}if(['camera','horn','gearUp','gearDown'].includes(id)){if(held)auxiliary(id);return;}audio.unlock();if(held)touch.add(id);else touch.delete(id);send();},clear});
  const unlock=()=>{audio.unlock();engine.unlock();};root.addEventListener('keydown',key,true);root.addEventListener('keyup',key,true);root.addEventListener('blur',clear);root.addEventListener('platdo:controlsmodechange',clear);overlay.addEventListener('pointerdown',unlock);
  const history=[];let renderClock=0,lastSample=0;
  function shotAt(now){
    if(!latest)return null;
    const s={...latest},elapsed=linkDown||s.reconnecting?0:clamp((now-received)/1000,0,.16);
    if(s.phase==='chase'&&history.length){
      const target=s.time+elapsed-.09,dt=Math.max(0,(now-lastSample)/1000);
      renderClock=Math.abs(target-renderClock)>.4?target:renderClock+clamp(target-renderClock,0,dt*1.12);
      lastSample=now;
      const at=history.findIndex(v=>v.time>=renderClock);
      for(const role of ['cop','robber']){
        if(at===0)s[role]=history[0][role];
        else if(at<0){const p=s[role],t=clamp(renderClock-s.time,0,.065);s[role]={...p,x:p.x+p.vx*t,z:p.z+p.vz*t,yaw:p.yaw+(p.yawRate||0)*t};}
        else{const before=history[at-1],after=history[at],f=clamp((renderClock-before.time)/(after.time-before.time||1),0,1),a=before[role],b=after[role];
          s[role]={...b,x:mix(a.x,b.x,f),z:mix(a.z,b.z,f),yaw:heading(a.yaw,b.yaw,f),steer:mix(a.steer,b.steer,f)};}
      }
    }else if(previous&&previous.phase===s.phase){const f=clamp((now-received)/Math.max(16,received-previousTime),0,1);
      for(const role of ['cop','robber']){const a=previous[role],b=latest[role];s[role]={...b,x:mix(a.x,b.x,f),z:mix(a.z,b.z,f),yaw:heading(a.yaw,b.yaw,f)};}
    }
    s.phaseTime+=elapsed;s.time+=elapsed;return s;
  }
  function setCamera(shot,dt){
    const p=shot[role],r=shot.robber,c=shot.cop,t=shot.phaseTime,follow=(a,dist=7)=>{eye.set(a.x-Math.sin(a.yaw)*dist,3.05,a.z-Math.cos(a.yaw)*dist);aim.set(a.x+Math.sin(a.yaw)*3,.95,a.z+Math.cos(a.yaw)*3);};
    follow(p);
    if(shot.phase==='chase'){
      const prefs=root.PlatdoDrive?.save?.settings||{};
      if(!drag&&performance.now()-lookTime>2200&&prefs.cameraRecenter!==false){orbit*=Math.exp(-dt*3.6);lookPitch*=Math.exp(-dt*3.6);}
      const h=p.yaw+orbit,s=Math.sin(h),c=Math.cos(h);
      if(driveView==='chase'){
        eye.set(p.x-s*distance,(prefs.chaseHeight||3.05)+lookPitch*3,p.z-c*distance);
        aim.set(p.x+Math.sin(p.yaw)*2,1.05,p.z+Math.cos(p.yaw)*2);
      }else{
        if(driveView==='cockpit')cars[role].userData.driverEyeAnchor.getWorldPosition(eye);
        else eye.set(p.x+Math.sin(p.yaw)*.57,cars[role].userData.belt+.31,p.z+Math.cos(p.yaw)*.57);
        aim.set(eye.x+s*20,eye.y+lookPitch*20-.1,eye.z+c*20);
      }
      const driver=occupants[role==='cop'?0:1]?.root;
      if(driver?.userData.rig)root.CityPeopleModels.setFirstPerson(driver,driveView==='cockpit');
      const fov=clamp((Number(prefs.fov)||72)+(prefs.speedFov&&driveView!=='hood'?Math.abs(p.speed)*.13:0),1,170);
      if(Math.abs(camera.fov-fov)>.05){camera.fov=fov;camera.updateProjectionMatrix();}
    }
    if(shot.phase==='intro'){
      if(t<3.4){eye.set(7.6+.18*t,2.0+.13*t,-96.9);aim.set(mix(-12,2.8,clamp(t/3.2,0,1)),1.08,-102);}
      else{const blend=clamp((t-3.4)/2.25,0,1),smooth=blend*blend*(3-2*blend);eye.lerpVectors(new T.Vector3(7.9,2.65,-96.7),eye.clone(),smooth);aim.lerpVectors(new T.Vector3(r.x,1,-101),aim.clone(),smooth);}
    }else if(shot.phase==='outro'||shot.phase==='ended'){
      if(shot.outcome==='escaped'){eye.set(c.x+Math.cos(c.yaw)*4,1.35,c.z-Math.sin(c.yaw)*4);aim.set(mix(c.x,r.x,clamp(t/3,.3,1)),.93,mix(c.z,r.z,clamp(t/3,.3,1)));}
      else{eye.set(r.x+Math.cos(r.yaw)*6,2.1+t*.18,r.z-Math.sin(r.yaw)*6);aim.set((r.x+c.x)/2,.89,(r.z+c.z)/2);}
    }
    const k=first||shot.phase==='chase'&&driveView!=='chase'?1:1-Math.exp(-dt*(shot.phase==='chase'?11:8));camera.position.lerp(eye,k);cameraAim.lerp(aim,k);camera.lookAt(cameraAim);first=false;
  }
  function frameLoop(now){if(stopped)return;frame=requestAnimationFrame(frameLoop);if(document.hidden||now-lastFrame<1000/(root.Platdo.frameRate||60)-1)return;
    const dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;const shot=shotAt(now);if(!shot)return;
    const size=root.Platdo.renderSize(canvas.clientWidth||640,canvas.clientHeight||360);
    if(canvas.width!==size.width||canvas.height!==size.height){renderer.setSize(size.width,size.height,false);camera.aspect=size.width/size.height;camera.updateProjectionMatrix();}
    if(shot.outcome==='captured'&&!arrestShown){engine.silence();
      try{
        if(!arrest){
          clear();money.count=0;runner.visible=false;audio.tick(false);root.Platdo.controls?.refresh?.();
          arrest=root.PlatdoArrestCinematic.create({scene,camera,renderer,cars,occupants,appearance,uniform,lights,role,overlay,shot,audio,onFinish:finishArrest});
        }
        arrest.step(now,suspended||linkDown||shot.reconnecting);if(!stopped)renderer.render(scene,camera);
        root.PlatdoNameplates?.draw(canvas,camera,[]);return;
      }catch(error){console.error('Could not present the arrest',error);arrest?.close();finishArrest();}
    }
    for(const r of ['cop','robber']){const p=shot[r],model=cars[r];model.position.set(p.x,(p.y||0)+.02,p.z);model.rotation.y=p.yaw;model.userData.body.rotation.z=p.roll||0;model.userData.body.rotation.x=p.pitch||0;
      for(const w of model.userData.wheels||[]){if(w.front)w.pivot.rotation.y=p.steer;if(w.wheel)w.wheel.rotation.x+=dt*p.speed*3;}}
    if(shot.phase==='chase')networkSkids.draw(['cop','robber'].map(id=>({...shot[id],id})));
    const flash=Math.floor(shot.time*8)%4;lights[0].material.color.set(flash<=1?'#ff3346':'#681e2b');lights[1].material.color.set(flash>=2?'#3989ff':'#163e76');
    runner.visible=shot.phase==='intro'&&shot.phaseTime<3.4;for(const m of meshes)m.visible=!runner.visible;
    if(runner.visible){const t=clamp(shot.phaseTime/3.4,0,1);runner.position.set(mix(-12.6,2.45,t),.10,-102+Math.sin(t*Math.PI)*.85);runner.rotation.y=Math.PI/2;root.CityPeopleModels.animate(runner,{mode:'onFoot',speed:4.6,grounded:true},shot.time,dt);}
    const interrupted=linkDown||shot.reconnecting;
    engine.update(shot[role],axes(),shot.phase==='chase'&&!suspended&&!interrupted?'playing':'hidden',dt,{carId:role==='cop'?'vektor':'apex',mapId:'metro',traffic:[]});
    cash(interrupted?0:dt,shot);setCamera(shot,dt);audio.tick(!suspended&&!interrupted&&(shot.phase==='chase'||shot.phase==='intro'));send();
    overlay.dataset.phase=shot.phase;const seconds=Math.max(0,Math.ceil(shot.remaining));clock.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
    const state=shot.phase+shot.outcome+Boolean(interrupted);
    if(lastCaption!==state){lastCaption=state;
      caption.textContent=shot.phase==='intro'?'Union Bank':shot.phase==='chase'?(role==='cop'?'Intercept the getaway car':'Lose the interceptor'):shot.outcome==='captured'?'Getaway intercepted':'Robber escaped';
      hint.textContent=interrupted?'Waiting for both drivers to reconnect':shot.phase==='intro'?'Bank District · Downtown':shot.phase==='chase'?(role==='cop'?'Make contact before time expires':'Keep clear until time expires'):(role==='cop')===(shot.outcome==='captured')?'You won the chase':'Your opponent won the chase';}
    renderer.render(scene,camera);
    const peer=role==='cop'?'robber':'cop';
    root.PlatdoNameplates?.draw(canvas,camera,shot.phase==='chase'&&!suspended&&!linkDown&&!shot.reconnecting&&shot.roles?[{code:shot.roles[peer],x:shot[peer].x,y:(shot[peer].y||0)+2.1,z:shot[peer].z}]:[]);
  }
  function accept(s){if(stopped||!s?.cop||!s?.robber||!Number.isFinite(s.time)||latest&&s.time<latest.time)return;
    const changed=Boolean(s.reconnecting)!==Boolean(latest?.reconnecting);if(changed)clear();
    if(changed||s.phase!==latest?.phase){history.length=0;lastSample=performance.now();renderClock=s.time-.09;}if(s.phase==='chase'){history.push(s);if(history.length>8)history.shift();}
    previous=changed?null:latest;latest=s;previousTime=received;received=performance.now();if(changed)root.Platdo.controls?.refresh?.();
  }
  function suspend(on,reason){clear();if(reason==='network')linkDown=!!on;else suspended=!!on;root.Platdo.controls?.refresh?.();}
  function leave(){if(stopped)return;if(latest?.outcome==='captured'&&!arrestShown){arrest?.close();finishArrest();}close();onExit?.();}
  function close(){if(stopped)return;clear();stopped=true;networkSkids.dispose();engine.shutdown();arrest?.close();arrest=null;active=null;cancelAnimationFrame(frame);unregister?.();audio.close();root.removeEventListener('keydown',key,true);root.removeEventListener('keyup',key,true);root.removeEventListener('blur',clear);
    root.removeEventListener('platdo:controlsmodechange',clear);root.CityPeopleModels.dispose(runner);runner.removeFromParent();for(const car of Object.values(cars)){car.removeFromParent();root.DriveScene.disposeCar(car);}
    const materials=new Set(),geometries=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const mat of [o.material].flat()){if(!mat)continue;materials.add(mat);if(mat.map)textures.add(mat.map);}});textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
    renderer.dispose();renderer.forceContextLoss();overlay.remove();
  }
  overlay.querySelector('button').onclick=leave;audio.unlock();active={accept,suspend,close};frame=requestAnimationFrame(frameLoop);return active;
}
root.PlatdoCopChase={open,close:()=>active?.close()};
})(window);
