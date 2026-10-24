/* Shared input ownership and multi-touch controls for every PLATDO game. */
(function(global){
 'use strict';
 if(global.PlatdoControls)return;
 const defaultMode=()=>global.matchMedia?.('(pointer: coarse)').matches?'mobile':'pc';
 function install(P,options={}){
  if(P.controls)return P.controls;
  let saved=null;
  if(!options.save)try{saved=P.storage('main-controls').get('mode');}catch(_){}
  let mode=['pc','mobile'].includes(options.mode||saved)?options.mode||saved:defaultMode();
  const adapters=new Map(),pointers=new Map();let current=null,currentId='',signature='',live=false,expanded=false,stopped=false,lastTick=0;
  const root=document.createElement('div');root.id='platdoTouchControls';root.hidden=true;root.setAttribute('aria-label','Mobile game controls');
  root.innerHTML='<div class="pt-look" aria-label="Drag to look"><span>Drag to look</span></div><div class="pt-top"></div><div class="pt-left"></div><div class="pt-stick" aria-label="Movement joystick"><span class="pt-stick-label">Move</span><i></i></div><div class="pt-right"></div><div class="pt-extra" hidden></div>';
  document.body.append(root);
  const stick=root.querySelector('.pt-stick'),thumb=stick.querySelector('i'),look=root.querySelector('.pt-look'),extra=root.querySelector('.pt-extra');
  const picker=document.createElement('label');picker.id='platdoStandaloneControls';picker.hidden=true;picker.innerHTML='Controls <select aria-label="Control mode"><option value="pc">PC</option><option value="mobile">Mobile</option></select>';document.body.append(picker);
  const select=picker.querySelector('select');select.addEventListener('change',()=>api.setMode(select.value));
  const safe=(adapter,name,...args)=>{if(typeof adapter?.[name]==='function')return adapter[name](...args);};
  function clear(){
   for(const [id,p]of pointers){if(p.kind==='button')safe(p.adapter,'action',p.action,false);try{p.element.releasePointerCapture(id);}catch(_){}}
   pointers.clear();thumb.style.transform='translate(-50%,-50%)';root.querySelectorAll('[aria-pressed]').forEach(b=>b.setAttribute('aria-pressed','false'));
   for(const adapter of adapters.values())safe(adapter,'clear');
   safe(current,'move',0,0);
  }
  function setMode(value,{persist=true}={}){
   if(!['pc','mobile'].includes(value))return false;
   clear();mode=value;signature='';expanded=false;
   if(document.pointerLockElement)try{document.exitPointerLock();}catch(_){}
   document.documentElement.dataset.controlMode=mode;select.value=mode;
   const main=document.getElementById('controlModeSelect');if(main)main.value=mode;
   if(persist&&!stopped){try{if(options.save)options.save(mode);else P.storage('main-controls').set('mode',mode);}catch(_){const notice=document.getElementById('controlModeStatus');if(notice)notice.textContent='Controls changed for this session. Browser storage is unavailable.';}}
   global.dispatchEvent(new CustomEvent('platdo:controlsmodechange',{detail:{mode,controlMode:mode}}));
   global.dispatchEvent(new CustomEvent('platdo:settingschange',{detail:{controlMode:mode}}));
   update();return true;
  }
  function button(spec,group){
   const node=document.createElement('button');node.type='button';node.dataset.touchAction=spec.id;node.textContent=spec.label;node.setAttribute('aria-label',spec.label);node.setAttribute('aria-pressed','false');
   if(spec.hold)node.dataset.hold='true';group.append(node);return node;
  }
  function render(layout){
   for(const name of ['top','left','right','extra'])root.querySelector('.pt-'+name).replaceChildren();
   const buttons=layout.buttons||[],secondary=buttons.filter(b=>b.secondary);
   for(const b of buttons)button(b,root.querySelector('.pt-'+(b.secondary?'extra':['left','top'].includes(b.side)?b.side:'right')));
   if(secondary.length){const more=button({id:'__more',label:expanded?'Close actions':'More'},root.querySelector('.pt-top'));more.setAttribute('aria-expanded',String(expanded));}
   extra.hidden=!expanded||!secondary.length;
   stick.hidden=layout.move===false;stick.querySelector('.pt-stick-label').textContent=layout.moveLabel||'Move';
   look.hidden=!layout.look;look.querySelector('span').textContent=layout.lookLabel||'Drag to look';root.dataset.game=currentId;
   root.setAttribute('aria-label',(layout.help||currentId)+' mobile controls');
  }
  function update(){
   const entries=[...adapters],entry=entries.find(([,a])=>safe(a,'visible')),id=entry?.[0]||'',adapter=entry?.[1]||null;
   const playing=!!adapter&&!!safe(adapter,'playing'),visible=!stopped&&mode==='mobile'&&playing&&!document.hidden;
   if(current!==adapter||live!==visible){clear();current=adapter;currentId=id;signature='';expanded=false;}
   live=visible;root.hidden=!visible;root.inert=!visible;picker.hidden=!!document.getElementById('gameHub')||!adapter||playing;
   if(visible){const layout=safe(adapter,'layout')||{},next=JSON.stringify(layout);if(next!==signature){clear();signature=next;render(layout);}}
  }
  function begin(e){
    if(e.pointerType==='mouse')return;
   if(!live||e.button!==0||mode!=='mobile')return;
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
    const x=dx/scale/radius,y=-dy/scale/radius;thumb.style.transform=`translate(calc(-50% + ${dx/scale}px),calc(-50% + ${dy/scale}px))`;safe(p.adapter,'move',Math.abs(x)<.1?0:x,Math.abs(y)<.1?0:y);
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
   if(mode!=='mobile'||e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
   const game=[...adapters.values()].some(a=>safe(a,'visible')),reset=document.getElementById('resetFlow');
   if(game||reset&&!reset.hidden)suppress(e);
  }
  global.addEventListener('keydown',blockKeyboard,true);global.addEventListener('keyup',blockKeyboard,true);
  // Only the shared touch layer owns gameplay gestures in Mobile. Menu buttons
  // and text fields remain normal browser UI in either mode.
  for(const type of ['pointerdown','pointermove','pointerup','mousedown','mousemove','mouseup','wheel','touchstart','touchmove','touchend'])global.addEventListener(type,e=>{
   if(!e.target?.closest?.(gameplayCanvas))return;
   if(mode==='mobile'||e.pointerType==='touch'||type.startsWith('touch'))suppress(e);
  },{capture:true,passive:false});
  global.addEventListener('blur',clear);global.addEventListener('hashchange',()=>{clear();update();});global.addEventListener('resize',clear);
  document.addEventListener('fullscreenchange',()=>{clear();const parent=document.fullscreenElement||document.body;parent.append(root,picker);update();});
  document.addEventListener('visibilitychange',()=>{clear();update();});global.addEventListener('platdo:beforereset',()=>{stopped=true;clear();update();});
  const api={get mode(){return mode;},get isMobile(){return mode==='mobile';},get defaultMode(){return defaultMode();},get activeGame(){return currentId;},setMode,clear,refresh:update,
   register(id,adapter){if(adapters.has(id))safe(adapters.get(id),'clear');adapters.set(id,adapter);update();return()=>{safe(adapter,'clear');adapters.delete(id);update();};},
   diagnostics(){return{mode,activeGame:currentId,visible:!root.hidden,pointers:pointers.size,games:[...adapters.keys()]};}};
  P.controls=api;document.documentElement.dataset.controlMode=mode;select.value=mode;
  function tick(now){requestAnimationFrame(tick);if(now-lastTick<60)return;lastTick=now;update();}requestAnimationFrame(tick);
  global.dispatchEvent(new Event('platdo:controlsready'));return api;
 }
 global.PlatdoControls={install};
})(window);

