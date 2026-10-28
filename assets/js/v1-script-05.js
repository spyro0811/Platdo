/* Shared input ownership and multi-touch controls for every PLATDO game. */
(function(global){
 'use strict';
 if(global.PlatdoControls)return;
 const defaultMode=()=>global.matchMedia?.('(pointer: coarse)').matches?'mobile':'pc';
 function install(P,options={}){
  if(P.controls)return P.controls;
  let saved=null;
  if(!options.save)try{saved=P.storage('main-controls').get('mode');}catch(_){}
  let fallback=['pc','mobile'].includes(options.mode||saved)?options.mode||saved:defaultMode();
  const methods=new Map([['mobile',{label:'Touch'}],['pc',{label:'Keyboard'}]]),games=new Map(),preferences={};
  const names={'platdo-jump':'PLATDO jump!','field':'code PLATDO','god-core':'platdo god core','platdo-drive':'platdo Drive','platdo-swing':'PLATDO SWING','platdo-city':'Platdo City'};
  if(!options.save)try{Object.assign(preferences,JSON.parse(P.storage('main-controls').get('games')||'{}'));}catch(_){}
  for(const id of Object.keys(preferences))if(!/^[a-z0-9-]+$/.test(id)||!methods.has(preferences[id]))delete preferences[id];
  let mode=fallback,updating=false,chartSignature='';
  const adapters=new Map(),pointers=new Map();let current=null,currentId='',signature='',live=false,expanded=false,stopped=false,lastTick=0;
  const root=document.createElement('div');root.id='platdoTouchControls';root.hidden=true;root.setAttribute('aria-label','Mobile game controls');
  root.innerHTML='<div class="pt-look" aria-label="Drag to look"><span>Drag to look</span></div><div class="pt-top"></div><div class="pt-left"></div><div class="pt-stick" aria-label="Movement joystick"><span class="pt-stick-label">Move</span><i></i></div><div class="pt-right"></div><div class="pt-steering"></div><div class="pt-pedals"></div><div class="pt-extra" hidden></div>';
  document.body.append(root);
  const stick=root.querySelector('.pt-stick'),thumb=stick.querySelector('i'),look=root.querySelector('.pt-look'),extra=root.querySelector('.pt-extra');
  const picker=document.createElement('label');picker.id='platdoStandaloneControls';picker.hidden=true;picker.innerHTML='Controls <select aria-label="Control mode"><option value="pc">Keyboard</option><option value="mobile">Touch</option></select>';document.body.append(picker);
  const select=picker.querySelector('select');select.addEventListener('change',()=>api.setGameMode(activeEntry().id,select.value));
  const safe=(adapter,name,...args)=>{if(typeof adapter?.[name]==='function')return adapter[name](...args);};
  function clear(){
   for(const [id,p]of pointers){if(p.kind==='button')safe(p.adapter,'action',p.action,false);try{p.element.releasePointerCapture(id);}catch(_){}}
   pointers.clear();thumb.style.transform='translate(-50%,-50%)';root.querySelectorAll('[aria-pressed]').forEach(b=>b.setAttribute('aria-pressed','false'));
   for(const adapter of adapters.values())safe(adapter,'clear');
   safe(current,'move',0,0);
  }
  function activeEntry(){const pair=[...adapters].find(([,a])=>safe(a,'visible'));return{adapter:pair?.[1]||null,id:pair?(safe(pair[1],'gameId')||pair[0]):''};}
  function getMode(id){return methods.has(preferences[id])?preferences[id]:fallback;}
  function persist(){if(stopped)return;try{if(options.save)options.save(fallback,{...preferences});else{P.storage('main-controls').set('mode',fallback);P.storage('main-controls').set('games',JSON.stringify(preferences));}}catch(_){const n=document.getElementById('controlModeStatus');if(n)n.textContent='Controls changed for this session. Browser storage is unavailable.';}}
  function declareGame(id,name){if(!/^[a-z0-9-]+$/.test(id))return false;games.set(id,name||names[id]||id);renderChart();return true;}
  function renderChart(){const host=document.getElementById('perGameControlChart');if(!host)return;const stamp=JSON.stringify([[...games],[...methods].map(([id,m])=>[id,m.label])]);if(stamp!==chartSignature){chartSignature=stamp;host.replaceChildren();const table=document.createElement('table');table.className='pt-method-table';table.setAttribute('aria-label','Control method for each game');const head=document.createElement('thead'),heading=document.createElement('tr'),first=document.createElement('th');first.textContent='Game';first.scope='col';heading.append(first);for(const [id,m]of methods){const cell=document.createElement('th');cell.scope='col';cell.textContent=m.label;heading.append(cell);}head.append(heading);table.append(head);const body=document.createElement('tbody');for(const [id,name]of games){const row=document.createElement('tr'),title=document.createElement('th');title.scope='row';title.textContent=name;row.append(title);for(const [method,m]of methods){const cell=document.createElement('td'),label=document.createElement('label'),input=document.createElement('input'),mark=document.createElement('span');input.type='radio';input.name='control-method-'+id;input.value=method;input.dataset.controlGame=id;input.setAttribute('aria-label',name+' — '+m.label);mark.textContent=m.label;label.append(input,mark);cell.append(label);row.append(cell);}body.append(row);}table.append(body);host.append(table);host.onchange=e=>{const input=e.target.closest('[data-control-game]');if(input)api.setGameMode(input.dataset.controlGame,input.value);};}for(const input of host.querySelectorAll('[data-control-game]'))input.checked=getMode(input.dataset.controlGame)===input.value;}
  function changed(){signature='';expanded=false;renderChart();update();global.dispatchEvent(new CustomEvent('platdo:controlspreferenceschange',{detail:{preferences:{...preferences},fallback}}));}
  function setGameMode(id,value,{persist:save=true}={}){if(!/^[a-z0-9-]+$/.test(id)||!methods.has(value))return false;if(preferences[id]===value)return true;preferences[id]=value;if(save)persist();changed();return true;}
  // Compatibility API changes only the inherited default; explicit game choices
  // stay independent. The chart always changes one game through setGameMode.
  function setMode(value,{persist:save=true}={}){if(!methods.has(value))return false;fallback=value;if(save)persist();changed();return true;}
  function setPreferences(value,{persist:save=true}={}){for(const key of Object.keys(preferences))delete preferences[key];if(value&&typeof value==='object'&&!Array.isArray(value))for(const [id,method]of Object.entries(value))if(/^[a-z0-9-]+$/.test(id)&&methods.has(method))preferences[id]=method;if(save)persist();changed();}
  function resetPreferences(){fallback=defaultMode();setPreferences({});}
  function iconSVG(id){const paths={left:'M16 4 6 12l10 8V4Z',right:'m8 4 10 8-10 8V4Z',gas:'M8 3h8l1 18H7L8 3Zm1 4h6m-6 4h6m-6 4h6',brake:'M4 6h16v12H4V6Zm4 2v8m4-8v8m4-8v8',handbrake:'M5 4a11 11 0 0 0 0 16M19 4a11 11 0 0 1 0 16M9 17V7h4a3 3 0 0 1 0 6H9',jump:'m5 11 7-7 7 7M12 4v16M5 21h14',crouch:'M12 3a2 2 0 1 0 .01 0M11 8l-3 5 6 2 3 5M8 13l-4 4m7-9 6 3',aim:'M12 3v4m0 10v4M3 12h4m10 0h4M12 6a6 6 0 1 0 .01 0',fire:'M5 4h14v6h-7l-2 10H6l2-10H5V4Z',reload:'M5 9a8 8 0 1 1-1 7M5 3v6h6',interact:'M8 19V8a2 2 0 0 1 4 0v5-9a2 2 0 0 1 4 0v9l2-5a2 2 0 0 1 3 2l-3 9H8l-5-6a2 2 0 0 1 3-2l2 2',vehicle:'M5 8 7 3h10l2 5M3 9h18v10H3V9Zm3 10v3m12-3v3M6 12h3m6 0h3',pause:'M8 4v16m8-16v16',more:'M4 12h1m6 0h1m6 0h1',seatbelt:'M7 4v6l10 10M17 4 7 20M5 12h14',wheelie:'M5 16a3 3 0 1 0 .01 0M17 7a3 3 0 1 0 .01 0M7 17l6-9 5 1',tuck:'M9 4a2 2 0 1 0 .01 0M9 9l7 2-5 4 5 5M9 9l-6 6'};return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[id]||paths.interact)+'"/></svg>';}
  function button(spec,group){
   const node=document.createElement('button');node.type='button';node.dataset.touchAction=spec.id;node.textContent=spec.label;node.setAttribute('aria-label',spec.label);node.setAttribute('aria-pressed','false');
   if(spec.hold)node.dataset.hold='true';if(spec.icon){node.classList.add('pt-icon-button');node.dataset.icon=spec.icon;node.innerHTML=iconSVG(spec.icon)+'<span>'+spec.label+'</span>';}if(spec.shape)node.dataset.shape=spec.shape;group.append(node);return node;
  }
  function render(layout){
   for(const name of ['top','left','right','extra','steering','pedals'])root.querySelector('.pt-'+name).replaceChildren();
   const buttons=layout.buttons||[],secondary=buttons.filter(b=>b.secondary);
   for(const b of buttons)button(b,root.querySelector('.pt-'+(b.secondary?'extra':['left','top','steering','pedals'].includes(b.side)?b.side:'right')));
   if(secondary.length){const more=button({id:'__more',label:expanded?'Close actions':'More'},root.querySelector('.pt-top'));more.setAttribute('aria-expanded',String(expanded));}
   extra.hidden=!expanded||!secondary.length;
   stick.hidden=layout.move===false;stick.querySelector('.pt-stick-label').textContent=layout.moveLabel||'Move';
   look.hidden=!layout.look;look.querySelector('span').textContent=layout.lookLabel||'Drag to look';root.dataset.game=currentId;root.dataset.layout=layout.key||'';root.dataset.design=layout.design||'';
   root.setAttribute('aria-label',(layout.help||currentId)+' mobile controls');
  }
  function update(){
   if(updating)return;updating=true;
   try{const entry=activeEntry(),id=entry.id,adapter=entry.adapter,nextMode=getMode(id),playing=!!adapter&&!!safe(adapter,'playing'),visible=!stopped&&nextMode==='mobile'&&playing&&!document.hidden;
   const transition=current!==adapter||currentId!==id||mode!==nextMode;
   if(transition||live!==visible){clear();if(transition)safe(methods.get(mode),'deactivate',currentId);current=adapter;currentId=id;mode=nextMode;signature='';expanded=false;}
   live=visible;root.hidden=!visible;root.inert=!visible;document.documentElement.dataset.controlMode=mode;select.value=mode;picker.hidden=!!document.getElementById('gameHub')||!adapter||playing;
   if(transition){if(document.pointerLockElement)try{document.exitPointerLock();}catch(_){}safe(methods.get(mode),'activate',id);global.dispatchEvent(new CustomEvent('platdo:controlsmodechange',{detail:{mode,controlMode:mode,gameId:id}}));global.dispatchEvent(new CustomEvent('platdo:settingschange',{detail:{controlMode:mode,gameId:id}}));}
   if(visible){const layout=safe(adapter,'layout')||{},next=JSON.stringify(layout);if(next!==signature){clear();signature=next;render(layout);}}
   renderChart();}finally{updating=false;}
  }
  function begin(e){
    if(e.pointerType==='mouse')return;
   if(!live||e.button!==0||getMode(activeEntry().id)!=='mobile')return;
   const action=e.target.closest('[data-touch-action]'),target=action||e.target.closest('.pt-stick,.pt-look');if(!target)return;
   e.preventDefault();e.stopPropagation();
   if(action?.dataset.touchAction==='__more'){clear();expanded=!expanded;signature='';update();return;}
   const kind=action?'button':target===stick?'move':'look';
   if(kind!=='button'&&[...pointers.values()].some(p=>p.kind===kind))return;
   try{target.setPointerCapture(e.pointerId);}catch(_){}
   const p={kind,element:target,adapter:current,action:action?.dataset.touchAction,x:e.clientX,y:e.clientY};pointers.set(e.pointerId,p);
   if(kind==='button'){action.setAttribute('aria-pressed','true');safe(current,'action',p.action,true);}
   else if(kind==='move')move(e,p);
  }
  function move(e,p){
   if(p.kind==='move'){
    const rect=stick.getBoundingClientRect(),radius=rect.width*.34,dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2,length=Math.hypot(dx,dy),scale=Math.max(1,length/radius);
    const x=dx/scale/radius,y=-dy/scale/radius;thumb.style.transform=`translate(calc(-50% + ${dx/scale}px),calc(-50% + ${dy/scale}px))`;safe(p.adapter,'move',currentId==='platdo-city'?x:Math.abs(x)<.1?0:x,currentId==='platdo-city'?y:Math.abs(y)<.1?0:y);
   }else if(p.kind==='look'){safe(p.adapter,'look',Math.max(-150,Math.min(150,e.clientX-p.x)),Math.max(-150,Math.min(150,e.clientY-p.y)));p.x=e.clientX;p.y=e.clientY;}
  }
  root.addEventListener('pointerdown',begin);
  root.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;e.preventDefault();e.stopPropagation();move(e,p);});
  function end(e){const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);e.preventDefault();e.stopPropagation();if(p.kind==='button'){p.element.setAttribute('aria-pressed','false');if(![...pointers.values()].some(q=>q.action===p.action))safe(p.adapter,'action',p.action,false);}else if(p.kind==='move'){safe(p.adapter,'move',0,0);thumb.style.transform='translate(-50%,-50%)';}try{p.element.releasePointerCapture(e.pointerId);}catch(_){}}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,end);
  root.addEventListener('contextmenu',e=>e.preventDefault());root.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
  const gameplayCanvas='#gameCanvas,#fieldCanvas,#cityCanvas,.drive-canvas,.sw-canvas';
  function suppress(e){e.preventDefault();e.stopImmediatePropagation();}
  function blockKeyboard(e){
   if(getMode(activeEntry().id)==='pc'||e.target?.closest?.('input,textarea,select,[contenteditable="true"]')||['Escape','Tab'].includes(e.code))return;if(e.target?.closest?.('button,a,[role="dialog"]')&&['Enter','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))return;
   const game=[...adapters.values()].some(a=>safe(a,'visible')&&safe(a,'playing')),reset=document.getElementById('resetFlow');
   if(game||reset&&!reset.hidden)suppress(e);
  }
  global.addEventListener('keydown',blockKeyboard,true);global.addEventListener('keyup',blockKeyboard,true);
  // Only the shared touch layer owns gameplay gestures in Mobile. Menu buttons
  // and text fields remain normal browser UI in either mode.
  for(const type of ['pointerdown','pointermove','pointerup','mousedown','mousemove','mouseup','wheel','touchstart','touchmove','touchend'])global.addEventListener(type,e=>{
   if(!e.target?.closest?.(gameplayCanvas))return;
   if(getMode(activeEntry().id)!=='pc'||e.pointerType==='touch'||type.startsWith('touch'))suppress(e);
  },{capture:true,passive:false});
  global.addEventListener('blur',clear);global.addEventListener('hashchange',()=>{clear();update();});global.addEventListener('resize',clear);
  document.addEventListener('fullscreenchange',()=>{clear();const parent=document.fullscreenElement||document.body;parent.append(root,picker);update();});
  document.addEventListener('visibilitychange',()=>{clear();update();});global.addEventListener('platdo:beforereset',()=>{stopped=true;clear();update();});
  const api={get mode(){return getMode(activeEntry().id);},get isMobile(){return getMode(activeEntry().id)==='mobile';},get preferences(){return {...preferences};},get fallbackMode(){return fallback;},get methods(){return [...methods].map(([id,m])=>({id,label:m.label}));},get defaultMode(){return defaultMode();},get activeGame(){return activeEntry().id;},setMode,setGameMode,getMode,setPreferences,resetPreferences,declareGame,clear,refresh:update,renderChart,registerMethod(id,descriptor){if(!/^[a-z][a-z0-9-]*$/.test(id)||!descriptor?.label)return false;methods.set(id,descriptor);changed();return true;},
   register(id,adapter){if(adapters.has(id))safe(adapters.get(id),'clear');adapters.set(id,adapter);declareGame(id,adapter.name);update();return()=>{safe(adapter,'clear');adapters.delete(id);update();};},
   diagnostics(){return{mode:getMode(activeEntry().id),fallback,preferences:{...preferences},activeGame:activeEntry().id,visible:!root.hidden,pointers:pointers.size,games:[...adapters.keys()]};}};
  if(!P.registerResetHandler){const handlers=new Map();P.registerResetHandler=(id,handler)=>{if(!/^[a-z0-9-]+$/.test(id)||typeof handler!=='function')throw new Error('Invalid reset handler');let group=handlers.get(id);if(!group)handlers.set(id,group=new Set());group.add(handler);return()=>group.delete(handler);};P.resetGameData=async(ids)=>{const selected=ids==null?[...handlers.keys()]:[...new Set(ids)];for(const id of selected)for(const handler of handlers.get(id)||[])await handler({all:ids==null,gameId:id});};}
  P.controls=api;document.documentElement.dataset.controlMode=mode;select.value=mode;renderChart();
  function tick(now){requestAnimationFrame(tick);if(now-lastTick<60)return;lastTick=now;update();}requestAnimationFrame(tick);
  global.dispatchEvent(new Event('platdo:controlsready'));return api;
 }
 global.PlatdoControls={install};
})(window);
