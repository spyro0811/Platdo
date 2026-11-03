
(function(root){'use strict';class CityAudio{
 constructor(){this.context=null;this.nodes=new Set();this.active=false;this.paused=false;this.clock=0;this.note=0;this.step=0;this.settings={};this.buses={};this.lastBark=-10;this.bank=root.CityAudioAssets||{assets:{},shot:{},reload:{}};this.buffers=new Map();this.sampleVoices=new Map();this.failedSamples=new Set();this.generation=0;this.sampleCount=0;this.lastSamples=[];this.waterBuffers=new Map();this.waterVoices=new Map();this.lastSwimStroke=-10;this.waterStep=0;this.ready=Promise.resolve();this.driving=null;this.drivingCharacter=null;this.drivingState={active:false,loops:0};this.focusSuspended=false;this.deferred=new Set();this.pendingSounds=new Map();this.history=[];this.decodeHistory={};this.phase='idle';this.decoderMode='none';this.peakConcurrent=0;this.unlocked=false;this.autoRecovery=false;this.disposed=false;
  this._onBlur=()=>{this.focusSuspended=true;this.suspendAudio();};
  this._onFocus=()=>{this.focusSuspended=false;if(this.canPlay()&&this.unlocked){this.apply(this.settings);this.resumePlayback();}};
  this._onVisibility=()=>{if(root.document?.hidden)this._onBlur();else this._onFocus();};
  this._onGesture=event=>{if(!event.isTrusted||root.document?.hidden)return;this.focusSuspended=false;if(this.canPlay()&&(this.context?.state!=='running'||!this.autoRecovery&&this.missing().length))this.unlock();};
  this._listen();
 }
 _listen(){if(this.listening)return;root.addEventListener?.('blur',this._onBlur);root.addEventListener?.('focus',this._onFocus);root.document?.addEventListener?.('visibilitychange',this._onVisibility);
  for(const event of ['pointerdown','touchend','keydown'])root.addEventListener?.(event,this._onGesture,true);this.listening=true;
 }
 canPlay(){return this.active&&!this.paused&&!this.disposed&&!this.focusSuspended&&!root.document?.hidden;}
 missing(){return Object.keys(this.bank.assets).filter(id=>!this.buffers.has(id));}
 notify(kind,id,detail){
  this.history.push({at:Date.now(),kind,id:id||null,detail:detail||null});if(this.history.length>48)this.history.shift();
  try{this.onStatusChange?.(this.status());}catch(_){}
 }
 report(callback,progress,label){try{callback?.({progress,label,...this.status()});}catch(_){}}
 panner(context,pan){
  const x=Math.max(-1,Math.min(1,pan));
  if(context.createStereoPanner){const node=context.createStereoPanner();node.pan.value=x;return node;}
  if(!context.createPanner)return context.createGain();
  const node=context.createPanner();node.panningModel='equalpower';node.rolloffFactor=0;
  node.setPosition(x,0,-Math.sqrt(Math.max(0,1-x*x)));
  return node;
 }
 ensurePlayback(){
  if(this.context&&this.context.state!=='closed')return this.context;
  const Context=root.AudioContext||root.webkitAudioContext;if(!Context)throw Error('Web Audio playback is unavailable.');
  const c=new Context();this.context=c;this.master=c.createGain();this.master.gain.value=this.settings.mute?0:(this.settings.master??.65);this.master.connect(c.destination);
  for(const name of ['music','sfx','ambience','dialogue','radio','menuMusic']){const g=c.createGain();g.gain.value=this.active?(this.settings[name]??.3):0;g.connect(this.master);this.buses[name]=g;}
  this.engine=c.createOscillator();this.engine.type='sawtooth';this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain);this.engineGain.connect(this.buses.sfx);this.engine.start();this.createDriving();this.apply(this.settings);
  c.onstatechange=()=>{if(this.context!==c||this.disposed)return;if(c.state==='running'){this.unlocked=true;this.resumeError=null;this.flushSounds();}this.notify('context',null,c.state);};
  return c;
 }
 resumePlayback(forEntry=false){
  const c=this.context;if(!c||!(this.canPlay()||forEntry&&!this.disposed&&!this.focusSuspended&&!root.document?.hidden))return;
  clearTimeout(this.suspendTimer);
  if(c.state==='running'){this.unlocked=true;this.resumeError=null;return;}
  if(this.resumeAttempt)return;
  const attempt={};this.resumeAttempt=attempt;
  const finish=error=>{if(this.resumeAttempt!==attempt)return;clearTimeout(attempt.timer);this.resumeAttempt=null;
   if(this.context!==c||this.disposed)return;this.unlocked=c.state==='running';
   if(this.unlocked)this.flushSounds();
   this.resumeError=this.unlocked?null:(error?.message||'Tap to enable City audio.');this.notify(this.unlocked?'playback-ready':'playback-deferred',null,this.resumeError);
  };
  attempt.timer=setTimeout(()=>finish(Error('Audio activation timed out. Tap to retry.')),1100);
  try{
   // Both calls happen on the trusted event stack. WebKit can require a source kick.
   const promise=c.resume();const kick=c.createBufferSource();kick.buffer=c.createBuffer(1,1,c.sampleRate);kick.connect(this.master);kick.onended=()=>kick.disconnect();kick.start(0);
   Promise.resolve(promise).then(()=>finish(),finish);
  }catch(e){finish(e);}
 }
 unlockForEntry(){
  if(this.disposed)this.rearm();
  if(root.document?.hidden||this.settings.mute)return false;
  this.focusSuspended=false;
  return this.activatePlayback(true);
 }
 unlock(resume=true){
  if(this.disposed)return false;
  if(!resume)return this.prepare();
  if(!this.canPlay())return false;
  return this.activatePlayback(false);
 }
 activatePlayback(forEntry){
  try{this.ensurePlayback();this.resumePlayback(forEntry);
   if(!this.batch&&!this.autoRecovery&&this.missing().length){this.autoRecovery=true;this.startDecode(this.context,4500);}
   return true;
  }catch(e){this.resumeError=e.message;this.notify('playback-error',null,e.message);return false;}
 }
 retryFailed(){
  if(this.disposed)return Promise.resolve(this.status());
  // A fresh tap may retry a native resume that never settled.
  if(this.resumeAttempt)clearTimeout(this.resumeAttempt.timer);this.resumeAttempt=null;
  if(this.batch&&this.decoderMode==='offline')this.batch.cancel('Retry requested from the playback context.');
  this.autoRecovery=true;this.unlock();if(this.context&&this.missing().length&&!this.batch)this.startDecode(this.context,4500);
  return this.ready;
 }
 apply(settings){this.settings=settings||{};if(!this.context)return;const time=this.context.currentTime;this.master.gain.setTargetAtTime(this.settings.mute?0:this.settings.master??.65,time,.03);for(const[k,g]of Object.entries(this.buses))g.gain.setTargetAtTime(this.canPlay()?(this.settings[k]??.3):0,time,.04);}
 suspendAudio(){
  this.generation++;this.pendingSounds.clear();this.stopWater();this.silenceDriving();
  for(const stop of [...this.sampleVoices.values()])stop();
  for(const source of [...this.nodes]){try{source.stop();}catch(_){}source.onended?.();}
  if(this.resumeAttempt)clearTimeout(this.resumeAttempt.timer);this.resumeAttempt=null;
  const c=this.context;if(!c)return;
  for(const bus of Object.values(this.buses)){bus.gain.cancelScheduledValues(c.currentTime);bus.gain.setValueAtTime(0,c.currentTime);}
  for(const layer of [this.engineGain,this.driving?.engineGain,this.driving?.tires.gain])if(layer){layer.gain.cancelScheduledValues(c.currentTime);layer.gain.setValueAtTime(0,c.currentTime);}
  clearTimeout(this.suspendTimer);
  // Let the mixer apply the zero gains before the native audio clock stops.
  if(!this.disposed)this.suspendTimer=setTimeout(()=>{
   if(this.context!==c||this.canPlay()||c.state==='closed'||c.state==='suspended')return;
   const timer=setTimeout(()=>{if(this.context===c&&!this.canPlay())this.notify('suspend-timeout',null,c.state);},1100);
   try{Promise.resolve(c.suspend()).then(()=>clearTimeout(timer),error=>{clearTimeout(timer);this.notify('suspend-error',null,error.message);});}
   catch(error){clearTimeout(timer);this.notify('suspend-error',null,error.message);}
  },32);
 }
 rearm(){this.disposed=false;this.phase='idle';this.warmComplete=false;this.autoRecovery=false;this.unlocked=false;this.resumeError=this.decodeError=null;this.focusSuspended=false;this.decodeHistory={};this._listen();}
 setActive(value){if(value&&this.disposed)this.rearm();this.active=!!value;if(!this.active)this.suspendAudio();else {clearTimeout(this.suspendTimer);if(this.canPlay()&&this.unlocked)this.resumePlayback();this.apply(this.settings);}}
 async prepare(options={}){
  if(this.disposed)return this.status();
  const progress=typeof options==='function'?options:options.onProgress;
  if(this.warmComplete){this.report(progress,1,'City sound bank prepared');return this.status();}
  if(!this.batch){
   const Offline=root.OfflineAudioContext||root.webkitOfflineAudioContext;
   try{if(!Offline)throw Error('Decoding deferred until City audio is activated.');
    this.startDecode(new Offline(1,1,44100),Number(options.timeoutMs)>0?Math.min(Number(options.timeoutMs),8000):1800,progress);
   }catch(e){for(const id of this.missing())this.deferred.add(id);this.phase='deferred';this.decodeError=e.message;this.notify('decode-deferred',null,e.message);}
  }
  await this.ready;this.warmComplete=true;const result=this.status();
  this.report(progress,1,this.missing().length?'City ready · some sounds deferred':'City sounds ready');
  if(this.context&&!this.autoRecovery&&this.missing().length&&!this.disposed){this.autoRecovery=true;this.startDecode(this.context,4500);}
  return result;
 }
 preload(){if(!this.batch&&this.missing().length&&this.context)this.startDecode(this.context,4500);return this.ready;}
 startDecode(decoder,timeout,progress){
  if(this.batch||this.disposed)return this.ready;
  // WebKit cannot cancel a native decode. If both workers got stuck, give
  // clips that never had a turn priority on the next bounded pass.
  const ids=this.missing().sort((a,b)=>(this.decodeHistory[a]?.attempts||0)-(this.decodeHistory[b]?.attempts||0));
  if(!ids.length){this.phase='ready';return Promise.resolve(this.status());}
  const batch={waiting:ids.slice(),running:new Set(),ids,finished:false};
  this.batch=batch;this.phase='decoding';this.decoderMode=decoder===this.context?'playback':'offline';
  this.ready=new Promise(resolve=>batch.resolve=resolve);
  const report=(id)=>this.report(progress,(ids.length-batch.waiting.length-batch.running.size)/ids.length,id?'City sound · '+id:'Preparing City sounds');
  const finish=(reason)=>{
   if(batch.finished)return;batch.finished=true;clearTimeout(batch.timer);this.batch=null;
   for(const id of [...batch.running,...batch.waiting]){this.deferred.add(id);const record=this.decodeHistory[id];record.state='deferred';record.endedAt=Date.now();record.error=batch.running.has(id)?reason:'Waiting for a decoder slot';}
   batch.running.clear();batch.waiting.length=0;
   this.phase=this.disposed?'disposed':this.missing().length?(this.buffers.size?'partial':this.failedSamples.size?'failed':'deferred'):'ready';
   if(reason)this.decodeError=reason;else if(!this.missing().length)this.decodeError=null;
   if(!this.disposed)this.notify('decode-'+this.phase,null,reason);batch.resolve(this.status());
  };
  batch.cancel=finish;
  for(const id of ids){const prior=this.decodeHistory[id];this.decodeHistory[id]={state:'queued',attempts:prior?.attempts||0};}
  const next=()=>{
   if(batch.finished)return;
   while(batch.running.size<2&&batch.waiting.length){
    const id=batch.waiting.shift(),record=this.decodeHistory[id];batch.running.add(id);record.state='decoding';record.attempts++;record.startedAt=Date.now();this.peakConcurrent=Math.max(this.peakConcurrent,batch.running.size);
    const settle=(buffer,error)=>{
     if(batch.finished||!batch.running.delete(id))return;
     record.endedAt=Date.now();this.deferred.delete(id);
     if(buffer){this.buffers.set(id,buffer);this.failedSamples.delete(id);record.state='ready';}
     else{this.failedSamples.add(id);record.state='failed';record.error=error?.message||String(error||'No decoded audio');this.decodeError=id+': '+record.error;}
     if(buffer)this.flushSounds();else this.pendingSounds.delete(id);
     report(id);next();
    };
    try{
     const ok=buffer=>settle(buffer),fail=error=>settle(null,error);
     fetch(this.bank.assets[id].url).then(response=>{if(!response.ok)throw new Error('City sound could not load: '+id);return response.arrayBuffer();}).then(bytes=>{
      if(batch.finished)return;
      // Preserve callback and promise support for WebKit decoders.
      const result=decoder.decodeAudioData(bytes,ok,fail);result?.then?.(ok,fail);
     }).catch(fail);
    }catch(e){settle(null,e);}
   }
   if(!batch.waiting.length&&!batch.running.size)finish();
  };
  batch.timer=setTimeout(()=>finish('Audio decoding timed out. Remaining sounds can be retried.'),timeout);report();next();return this.ready;
 }
 flushSounds(){
  if(!this.canPlay()||this.context?.state!=='running')return;
  for(const [id,cue] of this.pendingSounds){
   if(cue.generation!==this.generation||performance.now()-cue.at>=250){this.pendingSounds.delete(id);continue;}
   if(this.buffers.has(id)){this.pendingSounds.delete(id);this.sample(...cue.args);}
  }
 }
 sample(id,gain=1,pan=0,muffled=false,maxDuration=0){
  if(!this.context||!this.canPlay()||!this.bank.assets[id]||this.failedSamples.has(id))return false;
  const buffer=this.buffers.get(id),context=this.context;
  if(!buffer||context.state!=='running'){if(!buffer&&!this.batch||context.state!=='running'&&!this.resumeAttempt)return false;this.pendingSounds.set(id,{generation:this.generation,at:performance.now(),args:[id,gain,pan,muffled,maxDuration]});return true;}
  // A fresh source per sound allows automatic fire and explosions to overlap.
  // Retire the oldest voice at the shared cap so a new explosion is not lost.
  if(this.nodes.size>=32){const oldest=this.nodes.values().next().value;try{oldest.stop();}catch(_){}oldest.onended?.();}
  const source=context.createBufferSource(),volume=context.createGain(),panner=this.panner(context,pan),filter=muffled?context.createBiquadFilter():null;
  source.buffer=buffer;volume.gain.value=Math.max(0,gain)*(this.bank.assets[id].gain??.75);source.connect(volume);
  if(filter){filter.type='lowpass';filter.frequency.value=900;volume.connect(filter);filter.connect(panner);}else volume.connect(panner);
  panner.connect(this.buses.sfx);let ended=false;
  const cleanup=()=>{if(ended)return;ended=true;source.disconnect();volume.disconnect();panner.disconnect();filter?.disconnect();this.nodes.delete(source);this.sampleVoices.delete(source);};
  this.nodes.add(source);this.sampleVoices.set(source,()=>{try{source.stop();}catch(_){}cleanup();});source.onended=cleanup;source.start();
  // Keep the existing weapon reload time; gently trim longer borrowed recordings.
  if(maxDuration>0&&buffer.duration>maxDuration){const end=context.currentTime+maxDuration;volume.gain.setValueAtTime(volume.gain.value,Math.max(context.currentTime,end-.05));volume.gain.linearRampToValueAtTime(0,end);source.stop(end);}
  this.sampleCount++;this.lastSamples.push(id);if(this.lastSamples.length>16)this.lastSamples.shift();return true;
 }
 status(){return{loaded:[...this.buffers.keys()],failed:[...this.failedSamples],deferred:[...this.deferred],pending:this.batch?[...this.batch.running,...this.batch.waiting]:[],
  phase:this.phase,decoderMode:this.decoderMode,peakConcurrent:this.peakConcurrent,contextState:this.context?.state||'uninitialized',needsGesture:!this.disposed&&this.active&&!this.paused&&!this.settings.mute&&this.context?.state!=='running',
  lastError:this.resumeError||this.decodeError||null,attempts:Object.fromEntries(Object.entries(this.decodeHistory).map(([id,r])=>[id,{...r}])),events:this.history.slice(),
  voices:this.sampleVoices.size,plays:this.sampleCount,recent:this.lastSamples.slice()};}
 sampleDiagnostics(){return this.status();}
 stopWater(){for(const stop of [...this.waterVoices.values()])stop();this.lastSwimStroke=-10;}
 // Water visuals and physics remain; City deliberately has no water audio.
 waterCue(){return false;}
 setPaused(value){value=!!value;if(this.paused===value)return;this.paused=value;if(value)this.suspendAudio();else if(this.canPlay()){this.apply(this.settings);if(this.unlocked)this.resumePlayback();}}
 tone(freq,duration=.15,gain=.06,type='sine',bus='sfx',end=null,pan=0,muffled=false){if(!this.context||!this.canPlay()||this.context.state!=='running'||this.nodes.size>=32)return;const c=this.context,t=c.currentTime,o=c.createOscillator(),g=c.createGain(),p=this.panner(c,pan);o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,gain),t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);const filter=muffled?c.createBiquadFilter():null;if(filter){filter.type='lowpass';filter.frequency.value=900;g.connect(filter);filter.connect(p);}else g.connect(p);p.connect(this.buses[bus]||this.buses.sfx);this.nodes.add(o);o.onended=()=>{o.disconnect();g.disconnect();filter?.disconnect();p.disconnect();this.nodes.delete(o);};o.start(t);o.stop(t+duration+.02);}
 event(e,sim){if(this.paused||sim.paused||e.material==='water'||['swimStroke','waterEnter','dive','resurface','splash','waterImpact'].includes(e.type))return;const distance=e.x===undefined?0:Math.hypot(e.x-sim.player.x,e.z-sim.player.z),volume=1/(1+distance*.12),pan=e.x===undefined?0:Math.sin(Math.atan2(e.x-sim.player.x,e.z-sim.player.z)-sim.camera.yaw);const muffled=e.x!==undefined&&!sim.world.lineOfSight({x:sim.player.x,y:sim.player.y+1.5,z:sim.player.z},{x:e.x,y:(e.y||0)+.1,z:e.z});const cues={VehicleDamaged:[65,.24,.12,'triangle',30],footstep:[e.material==='wood'?105:70,.045,.07,'triangle'],jump:[130,.12,.05,'triangle',210],land:[60,.14,.1,'triangle'],shot:[e.weapon==='comet'?45:90,.14,.14,'sawtooth',30],reload:[320,.08,.07,'square',220],empty:[180,.04,.025,'square'],equip:[300,.08,.04,'triangle'],cash:[740,.16,.08,'sine',990],wallet:[650,.16,.055],door:[120,.14,.05,'triangle',60],vehicleEntry:[140,.1,.05],vehicleEntered:[75,.15,.06],vehicleExit:[100,.13,.05],horn:[330,.4,.11,'sawtooth'],explosion:[45,.65,.22,'sawtooth',20],damage:[110,.1,.06],missionComplete:[660,.6,.1],checkpoint:[440,.3,.07],achievement:[780,.6,.08],cache:[880,.4,.08],parachute:[160,.3,.06],notice:[400,.08,.02]};const sampleId=e.type==='shot'?this.bank.shot?.[e.weapon]:e.type==='reload'?this.bank.reload?.[e.weapon]:e.type==='explosion'?this.bank.explosion:null;const sampled=sampleId&&this.sample(sampleId,volume,pan,muffled,e.type==='reload'?(root.CityConfig?.weaponById[e.weapon]?.reload||0):0);const q=cues[e.type];if(q&&!sampled)this.tone(q[0],q[1],q[2]*volume,q[3]||'sine','sfx',q[4],pan,muffled);if(e.type==='missionComplete'||e.type==='ending'){for(let i=0;i<4;i++)this.tone(220*2**([0,4,7,12][i]/12),.6,.025,'triangle','music');}if(e.type==='dialogue'&&this.context&&this.context.currentTime-this.lastBark>3){this.lastBark=this.context.currentTime;this.duckUntil=this.context.currentTime+3;this.tone(145,.2,.07,'triangle','dialogue',200,pan);}}
 update(dt,sim,menu=false){if(!this.context||!this.canPlay()||this.context.state!=='running')return;const c=this.context;this.buses.radio.gain.setTargetAtTime((this.settings.radio??.28)*(c.currentTime<(this.duckUntil||0)?.35:1),c.currentTime,.2);const v=sim?.currentVehicle(),rate=v?Math.abs(v.speed||0):0;this.updateDriving(v,menu);const legacy=!menu&&!this.focusSuspended&&!document.hidden&&v?.category!=='land'&&v?.engine&&v.health>0;this.engine.frequency.setTargetAtTime(v?(v.category==='heli'?40:v.category==='boat'?60:85)+(v.visual?.rpm||800)/35:40,c.currentTime,.08);this.engineGain.gain.setTargetAtTime(legacy?.05+Math.min(.06,rate*.002):0,c.currentTime,this.drivingState.character==='bicycle'?.012:.12);this.clock-=dt;if(this.clock>0)return;this.clock=.27;const station=sim?.profile.radio??-1,radio=!menu&&v&&station>=0,bus=menu?'menuMusic':radio?'radio':'ambience';const motifs=[[[0,7,12,3,10,7,5,2],[0,12,7,14,10,5,3,7]],[[0,4,7,9,7,4,2,5],[0,7,9,12,4,2,5,7]],[[0,7,10,14,12,7,3,5],[0,5,10,12,7,3,8,5]]],part=Math.floor(this.note/32)%2,notes=motifs[radio?station%3:2][part],base=menu?130.81:radio?146.83:98,note=notes[this.note%8];if(menu||radio){this.tone(base*2**(note/12),radio?.35:.7,.025,'triangle',bus);if(this.note%4===0)this.tone(base/2,.5,.045,'sine',bus);if(this.note%2)this.tone(65,.04,.018,'triangle',bus);}else if(sim?.mission&&this.note%4===0){this.tone(65.4*2**(note/12),.9,.025,'triangle','music');}else if(this.note%12===0)this.tone(520+this.note%5*80,.16,.008,'sine','ambience',900);this.note++;}
 createDriving(){const A=root.PlatdoVehicleAudio,c=this.context;if(!A||!c||this.driving)return;const n={...A.engine(c,this.buses.sfx),...A.noise(c)};for(const[name,type,freq,q]of[['intake','bandpass',580,.7],['mechanical','bandpass',180,2.1],['tires','bandpass',2100,1.8],['rumble','lowpass',190,.4]])n[name]=A.texture(c,n.noise,type,freq,q,this.buses.sfx);n.noise.start();this.driving=n;this.drivingCharacter=null;this.drivingState={active:false,loops:4};}
 drivingTarget(param,value,time=.06){if(this.context&&param)param.setTargetAtTime(value,this.context.currentTime,time);}
 silenceDriving(){this.silenceElectric();root.PlatdoVehicleAudio?.silence(this.driving,this.drivingTarget.bind(this));if(this.context&&this.engineGain)this.engineGain.gain.setTargetAtTime(0,this.context.currentTime,.012);this.drivingGear=undefined;this.drivingShiftUntil=0;this.drivingState={...this.drivingState,active:false,engineTarget:0,tireTarget:0};}
 updateDriving(v,menu=false){const A=root.PlatdoVehicleAudio,n=this.driving;if(!A||!n)return;const active=!menu&&!this.focusSuspended&&!document.hidden&&v?.category==='land'&&v.engine!==false&&v.health>0;if(!active){this.silenceDriving();return;}const def=root.CityVehicles?.definition(v);if(def?.pedalOnly){this.updatePedalBike(v);return;}if(def?.electric){this.updateElectric(v,def);return;}this.silenceElectric();const id=def?.topSpeed>=70?'apex':def?.topSpeed>=50?'vektor':'compact',p=A.characters[id],target=this.drivingTarget.bind(this);if(id!==this.drivingCharacter){A.applyCharacter(this.context,n,id,target);this.drivingCharacter=id;}const rpm=Math.max(p.idle*.8,Math.min(p.redline*1.04,Number(v.visual?.rpm)||p.idle)),load=Math.max(0,Math.min(1,Math.abs(Number(v.throttle)||0))),gear=v.gear||1;if(this.drivingGear!==undefined&&gear!==this.drivingGear&&Math.abs(v.speed)>3)this.drivingShiftUntil=this.context.currentTime+.16;this.drivingGear=gear;const shifting=this.context.currentTime<(this.drivingShiftUntil||0),engine=A.engineTargets(p,{rpm,load,shifting,time:this.context.currentTime}),tires=A.tireTargets({speed:v.speed,slip:v.slip,slipAngle:v.slipAngle,grounded:v.grounded,surface:v.surface});A.applyEngine(n,engine,target,shifting);A.applyTires(n,tires,target);this.drivingState={active:true,loops:4,character:id,rpm,load,gear,sliding:tires.sliding,grounded:tires.grounded,engineTarget:engine.gain,tireTarget:tires.tireGain};}
 updatePedalBike(v){
  const audio=root.PlatdoVehicleAudio,n=this.driving,target=this.drivingTarget.bind(this);
  this.silenceElectric();
  // The same graph handles the next vehicle, so silence both combustion and
  // motor layers when the rider changes from a powered vehicle to pedals.
  for(const output of [n.engineGain,n.intake.gain,n.mechanical.gain])target(output.gain,0,.012);
  const tires=audio.tireTargets(v);
  audio.applyTires(n,tires,target);
  this.drivingGear=undefined;this.drivingShiftUntil=0;
  this.drivingState={active:true,loops:4,character:'bicycle',engineTarget:0,tireTarget:tires.tireGain,sliding:tires.sliding,grounded:tires.grounded};
 }
 silenceElectric(){if(!this.context||!this.electricNodes)return;for(const n of this.electricNodes)this.drivingTarget(n.gain.gain,0,.015);}
 updateElectric(v,d){const A=root.PlatdoVehicleAudio,c=this.context,n=this.driving,target=this.drivingTarget.bind(this);if(!this.electricNodes){this.electricNodes=[0,1].map(i=>{const o=c.createOscillator(),gain=c.createGain();o.type=i?'triangle':'sine';gain.gain.value=0;o.connect(gain);gain.connect(this.buses.sfx);o.start();return{o,gain};});}A.silence(n,target);const speed=Math.abs(v.speed||0),load=Math.min(1,Math.abs(v.throttle||0)),s=d.bikeSpec,moving=Math.min(1,speed/2),drive=load*.75+moving*.25,base=s.bicycle?170:s.shape==='full-mx'?125:150,hz=base+speed*(s.bicycle?14:24),level=(s.motorGain||.04)*drive*(v.grounded===false?.7:1);this.electricNodes.forEach((voice,i)=>{target(voice.o.frequency,hz*(i?2.01:1),.07);target(voice.gain.gain,level*(i?.18:1),.055);});const tires=A.tireTargets({speed:v.speed,slip:v.slip,slipAngle:v.slipAngle,grounded:v.grounded,surface:v.surface});A.applyTires(n,tires,target);target(n.mechanical.gain.gain,s.chain?Math.min(.015,speed*.00045)*(load*.7+.3):.001*moving);target(n.mechanical.filter.frequency,250+speed*9);this.drivingGear=1;this.drivingShiftUntil=0;this.drivingState={active:true,loops:6,character:d.audioProfile,electric:true,rpm:v.visual?.rpm||0,load,gear:1,shifting:false,engineTarget:level,tireTarget:tires.tireGain,grounded:v.grounded};}
 drivingDiagnostics(){return{...this.drivingState,engineGain:this.driving?.engineGain.gain.value||0,tireGain:this.driving?.tires.gain.gain.value||0,sharedRecipe:!!root.PlatdoVehicleAudio,legacyEngineGain:this.engineGain?.gain.value||0};}
 dispose(){this.disposed=true;this.active=false;this.suspendAudio();this.batch?.cancel();this.phase='disposed';this.deferred.clear();this.pendingSounds.clear();this.onStatusChange=null;
  for(const e of ['pointerdown','touchend','keydown'])root.removeEventListener?.(e,this._onGesture,true);root.document?.removeEventListener?.('visibilitychange',this._onVisibility);
  root.removeEventListener?.('blur',this._onBlur);root.removeEventListener?.('focus',this._onFocus);this.listening=false;root.PlatdoVehicleAudio?.dispose(this.driving);this.driving=null;if(this.electricNodes){for(const voice of this.electricNodes){try{voice.o.stop();}catch(_){}voice.o.disconnect();voice.gain.disconnect();}this.electricNodes=null;}this.drivingState={active:false,loops:0};this.generation++;this.active=false;this.stopWater();this.waterBuffers.clear();for(const stop of [...this.sampleVoices.values()])stop();for(const n of this.nodes)try{n.stop();}catch(_){}try{this.engine?.stop();}catch(_){}if(this.context){this.context.onstatechange=null;Promise.resolve(this.context.close()).catch(()=>{});}this.context=null;this.nodes.clear();this.buffers.clear();this.failedSamples.clear();this.loadingContext=null;}
}root.CityAudio=CityAudio;})(typeof window!=='undefined'?window:globalThis);

