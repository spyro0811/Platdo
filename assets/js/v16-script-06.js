
/* Shared, renderer-backed graphics preferences. Gameplay and save data stay independent. */
(function (global) {
  'use strict';
  if (global.PlatdoGraphics) return;
  // Installed before legacy gameplay scripts so Escape cannot also resume/exit a game.
  global.addEventListener('keydown',event=>{
    const dialog=document.querySelector('dialog.pg-backdrop[open]');if(!dialog)return;
    event.stopImmediatePropagation();
    if(event.code==='Escape'){event.preventDefault();global.Platdo?.graphics?.close();}
    else if(event.code==='Tab'){
      const all=[...dialog.querySelectorAll('button,select,input')].filter(n=>!n.disabled),first=all[0],last=all[all.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  },true);
  global.addEventListener('keyup',event=>{if(document.querySelector('dialog.pg-backdrop[open]'))event.stopImmediatePropagation();},true);
  const KEY = 'graphics:v1', MAX_PIXELS = 8294400;
  const modelLevels={potato:1,low:2,medium:3,high:4,epic:4,expert:4,ultra:5,insane:5};
  const modelLabels=['Automatic','Lowest','Low','Medium','High','Highest'];
  const smokeBudgets={potato:12,low:32,medium:72,high:128,epic:192,expert:192,ultra:256,insane:384};
  function resolveSmokeParticles(value,preset){const n=Number(value);return Number.isFinite(n)&&n>=0?Math.max(0,Math.min(1000,Math.round(n))):(smokeBudgets[preset]??72);}
  const smokeParticleField={type:'range',label:'Tire smoke particles',min:-1,max:1000,step:1,default:-1,help:'Automatic follows the device-recommended graphics preset. Choose 0 to turn tire smoke off, or set a maximum particle count. Higher counts cost more rendering time.',format:(value,values)=>Number(value)<0?'Automatic ('+resolveSmokeParticles(-1,values.smokeParticlePreset)+' particles)':Number(value)===0?'Off':Math.round(value)+' particles'};
  function sanitizeFov(value,fallback=70){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(1000000000,n)):fallback;}
  // A perspective lens cannot cross 180 degrees. Extended values remain
  // meaningful, monotonic wide-lens strength instead of inverting the view.
  function projectFov(value){const n=sanitizeFov(value);return n<=150?n:150+29*(-Math.expm1(-(n-150)/100));}
  function resolveModelDetail(value,preset){const level=Number(value);return Number.isFinite(level)&&level>0?Math.max(1,Math.min(5,Math.round(level))):(modelLevels[preset]||3);}
  const modelDetailField={type:'range',label:'Model detail (faces)',min:0,max:5,step:1,default:0,help:'Automatic follows the selected graphics preset, initially recommended from your device capacity. Lower levels draw fewer model polygons; collisions and handling stay unchanged.',format:(value,values)=>Number(value)===0?'Automatic ('+modelLabels[resolveModelDetail(0,values.modelDetailPreset)]+')':modelLabels[Number(value)]};
  const common = {
    resolution: {type:'select',label:'Internal resolution ceiling',options:[{value:'auto',label:'Display size'},...['360','540','720','900','1080','1440','2160'].map(value=>({value,label:value+'p'}))],default:'auto',help:'The actual drawing size is shown below. The display aspect ratio is preserved.'},
    scale: {type:'range',label:'Render scale',min:.25,max:1.25,step:.05,default:1,unit:'×'},
    pixelRatio: {type:'range',label:'Pixel density limit',min:1,max:2,step:.25,default:1,unit:'×'},
    dynamic: {type:'checkbox',label:'Adaptive render scale',default:false,help:'Optional: adjusts only the drawing size after sustained slow frames. Your saved quality and maximum scale stay unchanged.'},
    dynamicMin: {type:'range',label:'Adaptive minimum scale',min:.25,max:1.25,step:.05,default:.5,unit:'×'},
    overlay: {type:'checkbox',label:'Performance overlay',default:false}
  };
  const presetCommon = {potato:{resolution:'540',scale:.6,pixelRatio:1},low:{resolution:'720',scale:.8,pixelRatio:1},medium:{resolution:'1080',scale:1,pixelRatio:1},high:{resolution:'1440',scale:1,pixelRatio:1.5},epic:{resolution:'1440',scale:1,pixelRatio:1.5},expert:{resolution:'1440',scale:1,pixelRatio:1.5},ultra:{resolution:'2160',scale:1,pixelRatio:2},insane:{resolution:'2160',scale:1.25,pixelRatio:2}};
  function install(P) {
    if (P.graphics) return P.graphics;
    const entries=new Map(); let stopped=false, modal=null, overlay=null, active=null, ticker=0, previousFocus=null;
    const memory=Number(global.navigator?.deviceMemory)||4,cores=Number(global.navigator?.hardwareConcurrency)||4;
    let globalPrefs={preset:memory<=2||cores<=2?'potato':memory<=4||cores<=4?'low':'medium',values:{}}, storageNotice='';
    const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
    function read(id) { try {const raw=P.storage(id).get(KEY); return raw?JSON.parse(raw):null;}catch(_){return null;} }
    function write(id,value) { if(stopped)return; try {if(value===null)P.storage(id).remove(KEY);else P.storage(id).set(KEY,JSON.stringify(value));}catch(_){storageNotice='Saved for this session only: browser storage is unavailable.';} }
    function options(field) { return (field.options||[]).map(x=>typeof x==='object'?x:{value:x,label:String(x)}); }
    function validate(field,value) {
      if(field.type==='checkbox')return typeof value==='boolean'?value:field.default;
      if(field.type==='select')return options(field).find(o=>o.value===value||String(o.value)===String(value))?.value??field.default;
      let n=Number(value); if(!Number.isFinite(n)||value===null||value==='')n=Number(field.default);
      const step=field.step||1; return Math.min(field.max,Math.max(field.min,Math.round((n-field.min)/step)*step+field.min));
    }
    function clean(e,values) { const out={}; for(const [key,field]of Object.entries(e.fields))out[key]=validate(field,values?.[key]??field.default);return out; }
    const savedGlobal=read('main-settings');
    if(savedGlobal?.version===1){globalPrefs={preset:own(presetCommon,savedGlobal.preset)?savedGlobal.preset:'medium',values:{}};for(const[k,v]of Object.entries(savedGlobal.values||{}))if(common[k])globalPrefs.values[k]=validate(common[k],v);}
    function base(e) {const preset=own(e.presets,globalPrefs.preset)?globalPrefs.preset:own(e.presets,'medium')?'medium':Object.keys(e.presets)[0];return {...e.defaults,...presetCommon[preset],...e.presets[preset],...globalPrefs.values,preset};}
    function resolve(e) {const b=base(e), raw=e.override?{...b,...e.override.values}:b;return {...clean(e,raw),preset:e.override?.preset||b.preset};}
    function effective(e) {return {...e.values,...(e.fields.modelDetail?{modelDetailLevel:resolveModelDetail(e.values.modelDetail,e.sourcePreset),modelDetailPreset:e.sourcePreset}:{}),...(e.fields.smokeParticles?{smokeParticleBudget:resolveSmokeParticles(e.values.smokeParticles,e.sourcePreset),smokeParticlePreset:e.sourcePreset}:{}),dynamicScale:e.values.dynamic?Math.min(e.values.scale,Math.max(Math.min(e.values.dynamicMin,e.values.scale),e.dynamicScale)):e.values.scale};}
    function notify(e,reason) {global.dispatchEvent(new CustomEvent('platdo:graphicschange',{detail:{id:e.id,values:effective(e),reason}}));}
    function apply(e,next,reason,sourcePreset=e.sourcePreset) {
      const old=e.values, oldScale=e.dynamicScale,oldSource=e.sourcePreset;e.values=next;e.sourcePreset=sourcePreset;e.dynamicScale=next.scale;
      try {if(e.adapter.apply?.(effective(e),reason)===false)throw new Error('The renderer could not apply that setting.');e.lastGood={...next};e.failure='';e.samples=[];e.slowFrames=0;e.windowAt=e.changedAt=performance.now();notify(e,reason);return true;}
      catch(error){e.values=old;e.sourcePreset=oldSource;e.dynamicScale=oldScale;e.failure='Graphics restored to the previous working settings. '+String(error?.message||error);try{e.adapter.apply?.(effective(e),'rollback');}catch(_){}return false;}
    }
    function persist(e) {write(e.id,e.override?{version:1,preset:e.override.preset,sourcePreset:e.sourcePreset,values:e.override.values}:null);}
    function set(id,patch) {
      const e=entries.get(id);if(!e||stopped)return false;
      let raw={...e.values,...patch},preset=e.values.preset,sourcePreset=e.sourcePreset;
      if(patch.preset&&own(e.presets,patch.preset)){preset=patch.preset;sourcePreset=preset;raw={...e.defaults,...presetCommon[preset],...e.presets[preset],...patch};}
      else if(Object.keys(patch).some(k=>!['overlay','dynamic','dynamicMin'].includes(k)))preset='custom';
      const next={...clean(e,raw),preset};
      if(!apply(e,next,'change',sourcePreset)){refresh();return false;}
      e.override={preset,values:clean(e,next)};persist(e);refresh();return true;
    }
    function useGlobal(id){const e=entries.get(id);if(!e)return false;const old=e.override;e.override=null;if(!apply(e,resolve(e),'global',base(e).preset)){e.override=old;return false;}persist(e);refresh();return true;}
    function reset(id){const e=entries.get(id);if(!e)return false;const preset=own(e.presets,'medium')?'medium':Object.keys(e.presets)[0];return set(id,{...Object.fromEntries(Object.entries(e.fields).map(([k,f])=>[k,f.default])),...e.defaults,...presetCommon[preset],...e.presets[preset],preset,dynamic:false,overlay:false});}
    function renderSize(id,w,h){
      const e=entries.get(id);w=Math.max(1,Number(w)||1);h=Math.max(1,Number(h)||1);const v=e?effective(e):{...Object.fromEntries(Object.entries(common).map(([k,f])=>[k,f.default])),dynamicScale:1};
      const dpr=Math.min(Math.max(1,global.devicePixelRatio||1),v.pixelRatio), cap=Number(v.resolution)||Infinity;
      const shared=P.renderSize?.(w,h)||{width:w*dpr,height:h*dpr};
      let ratio=Math.min(dpr,cap/h,cap*16/9/w)*v.dynamicScale;
      ratio=Math.min(ratio,shared.width/w,shared.height/h,Math.sqrt(MAX_PIXELS/(w*h)),8192/w,8192/h);
      const result={width:Math.max(1,Math.floor(w*ratio)),height:Math.max(1,Math.floor(h*ratio))};
      if(e)e.size=result;return result;
    }
    function sample(id,frameMs,cpuMs,now=performance.now()) {
      const e=entries.get(id);if(!e||stopped)return;e.lastSample=now;active=id;
      if(Number.isFinite(frameMs)&&frameMs>0&&frameMs<=5000){e.frame=e.frame?e.frame*.9+frameMs*.1:frameMs;e.cpu=Number.isFinite(cpuMs)?(e.cpu||cpuMs)*.9+cpuMs*.1:e.cpu;}
      if(!e.values.dynamic||document.hidden||!Number.isFinite(frameMs)||frameMs<=0||frameMs>2000){e.samples=[];e.slowFrames=0;return;}
      // One loading hitch is not a slow device. Repeated slow frames are real workload.
      if(frameMs>200){e.slowFrames=(e.slowFrames||0)+1;if(e.slowFrames<3)return;}else e.slowFrames=0;
      if(now-e.changedAt<5000)return;
      e.samples.push(frameMs);if(e.samples.length<12||now-e.windowAt<2500)return;
      const samples=e.samples.sort((a,b)=>a-b),mean=samples.slice(0,Math.ceil(samples.length*.9)).reduce((a,b)=>a+b,0)/Math.ceil(samples.length*.9);
      const target=1000/Math.min(120,P.frameRate||60),minimum=Math.min(e.values.dynamicMin,e.values.scale);
      let next=e.dynamicScale;if(mean>target*1.18)next=Math.max(minimum,next-.05);else if(mean<target*1.04)next=Math.min(e.values.scale,next+.025);
      e.samples=[];e.windowAt=now;
      if(Math.abs(next-e.dynamicScale)>.001){const old=e.dynamicScale;e.dynamicScale=next;try{if(e.adapter.apply?.(effective(e),'adaptive')===false)throw Error('Rejected');e.changedAt=now;notify(e,'adaptive');}catch(_){e.dynamicScale=old;}}
    }
    function reportFailure(id,error){const e=entries.get(id);if(!e)return;e.failure='Renderer needs recovery: '+String(error?.message||error||'graphics context unavailable')+'. Choose Potato or reset graphics, then retry the game.';refresh();}
    function attachContext(id,canvas){const e=entries.get(id);if(!e||!canvas||e.contexts.has(canvas))return;e.contexts.add(canvas);canvas.addEventListener('webglcontextlost',ev=>{ev.preventDefault();reportFailure(id,'graphics context lost');});canvas.addEventListener('webglcontextrestored',()=>{e.samples=[];try{e.adapter.apply?.(effective(e),'context-restored');e.failure='';}catch(err){reportFailure(id,err);}refresh();});}
    function recommended(id){const e=entries.get(id);if(!e)return;const memory=Number(global.navigator?.deviceMemory)||4,cores=Number(global.navigator?.hardwareConcurrency)||4;let preset=memory<=2||cores<=2?'potato':memory<=4||cores<=4?'low':'medium';if(!own(e.presets,preset))preset=Object.keys(e.presets)[0];set(id,{preset});e.note='Conservative starting recommendation based on broad device capacity, not a performance guarantee. Every preset remains available.';refresh();}
    function register(id,adapter={}) {
      if(entries.has(id))return entries.get(id).handle;
      const fields={...common,...adapter.fields},defaults={...Object.fromEntries(Object.entries(fields).map(([k,f])=>[k,f.default])),...adapter.defaults};
      const e={id,adapter,name:adapter.name||id,fields,defaults,presets:adapter.presets||{low:{},medium:{},high:{}},values:{},override:null,dynamicScale:1,samples:[],windowAt:0,changedAt:performance.now(),contexts:new WeakSet(),failure:'',note:'',size:null};
      const saved=read(id);if(saved?.version===1&&saved.values&&typeof saved.values==='object')e.override={preset:saved.preset==='custom'||own(e.presets,saved.preset)?saved.preset:'custom',values:clean(e,saved.values)};
      e.sourcePreset=own(e.presets,saved?.sourcePreset)?saved.sourcePreset:own(e.presets,saved?.preset)?saved.preset:base(e).preset;
      e.values=resolve(e);e.dynamicScale=e.values.scale;e.lastGood={...e.values};
      e.handle={get:()=>effective(e),set:patch=>set(id,patch),open:opts=>open(id,opts),renderSize:(w,h)=>renderSize(id,w,h),sample:(...args)=>sample(id,...args),reportFailure:error=>reportFailure(id,error),attachContext:canvas=>attachContext(id,canvas),reset:()=>reset(id),useGlobal:()=>useGlobal(id)};
      entries.set(id,e);
      // Callbacks may capture the returned handle; initial application runs after registration returns.
      queueMicrotask(()=>{if(!stopped)apply(e,e.values,'initial');});return e.handle;
    }
    function make(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
    function close(){if(!modal)return;const callback=modal._onClose;modal.close?.();modal.remove();modal=null;clearInterval(ticker);ticker=0;previousFocus?.focus?.();callback?.();}
    function open(id,opts={}) {
      if(!entries.has(id))return false;close();previousFocus=document.activeElement;P.controls?.clear?.();
      modal=make('dialog','pg-backdrop');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',entries.get(id).name+' graphics');modal._id=id;modal._onClose=opts.onClose;modal.addEventListener('cancel',event=>{event.preventDefault();close();});
      const panel=make('section','pg-panel');modal.append(panel);document.body.append(modal);modal.showModal();refresh();ticker=setInterval(refreshMetrics,500);modal.querySelector('button')?.focus();return true;
    }
    function refreshMetrics(){
      if(!modal)return;const e=entries.get(modal._id);if(!e)return;const output=modal.querySelector('.pg-metrics');let m={};try{m=e.adapter.measure?.()||{};}catch(_){}
      const size=m.width&&m.height?m:e.size;output.textContent=(size?`${size.width} × ${size.height} drawing pixels`:'Drawing size appears when the game starts')+` · scale ${effective(e).dynamicScale.toFixed(2)}× · ${P.frameRate||60} FPS cap`+(m.calls!==undefined?` · ${m.calls} draw calls`:'')+(m.triangles!==undefined?` · ${Math.round(m.triangles).toLocaleString()} triangles`:'');
      modal.querySelector('.pg-status').textContent=e.failure||storageNotice||e.note||(e.override?'Saved for this game.':'Following global defaults.');
    }
    function refresh(){
      if(!modal)return;const e=entries.get(modal._id),panel=modal.firstChild,oldFocus=document.activeElement,scroll=panel.scrollTop;
      const focus=panel.contains(oldFocus)?{key:oldFocus.dataset.graphicsKey,label:oldFocus.getAttribute('aria-label'),tag:oldFocus.tagName,text:oldFocus.textContent}:null;
      panel.replaceChildren();
      const head=make('header','pg-head'),heading=make('div');heading.append(make('small','','GRAPHICS'),make('h2','',e.name));const back=make('button','','Back');back.type='button';back.onclick=close;head.append(heading,back);panel.append(head);
      panel.append(make('p','pg-metrics'),make('p','pg-status'));
      const presetLabel=make('label','pg-row');presetLabel.append(make('span','','Quality preset'));const preset=make('select');preset.setAttribute('aria-label','Quality preset');for(const value of Object.keys(e.presets))preset.add(new Option(value[0].toUpperCase()+value.slice(1),value));preset.add(new Option('Custom','custom'));preset.value=e.values.preset;preset.onchange=()=>{if(preset.value!=='custom')set(e.id,{preset:preset.value});};presetLabel.append(preset);panel.append(presetLabel);
      const grid=make('div','pg-grid');
      for(const [key,field]of Object.entries(e.fields)){
        const row=make('label','pg-row'),text=make('span','pg-label',field.label||key);row.append(text);
        if(field.help||field.reason)text.append(make('small','',field.reason||field.help));
        let input;if(field.type==='select'){input=make('select');for(const o of options(field))input.add(new Option(o.label,o.value));input.value=e.values[key];}
        else{input=make('input');input.type=field.type==='checkbox'?'checkbox':'range';if(input.type==='checkbox')input.checked=e.values[key];else{input.min=field.min;input.max=field.max;input.step=field.step||1;input.value=e.values[key];const label=value=>field.format?field.format(value,effective(e)):Number(value).toFixed(field.step<1?2:0)+(field.unit?' '+field.unit:'');const value=make('output','',label(e.values[key]));input.setAttribute('aria-valuetext',label(e.values[key]));row.append(value);input.oninput=()=>{value.textContent=label(Number(input.value));input.setAttribute('aria-valuetext',value.textContent);};}}
        input.dataset.graphicsKey=key;input.setAttribute('aria-label',field.label||key);input.disabled=field.supported===false;
        input.onchange=()=>set(e.id,{[key]:field.type==='checkbox'?input.checked:field.type==='range'?Number(input.value):input.value});row.append(input);grid.append(row);
      }
      const fpsRow=make('label','pg-row');fpsRow.append(make('span','','Frame-rate cap · all games'));const fps=make('select');fps.setAttribute('aria-label','Frame-rate cap');for(const n of [30,60,120,240])fps.add(new Option(n+' FPS',n));fps.value=P.frameRate||60;fps.disabled=typeof P.setFrameRate!=='function';fps.onchange=()=>{P.setFrameRate?.(Number(fps.value));refreshMetrics();};fpsRow.append(fps);grid.append(fpsRow);panel.append(grid);
      const actions=make('div','pg-actions');for(const [label,fn]of [['Recommended',()=>recommended(e.id)],['Use global defaults',()=>useGlobal(e.id)],['Reset graphics',()=>reset(e.id)]]){const b=make('button','',label);b.type='button';b.onclick=fn;actions.append(b);}panel.append(actions,make('p','pg-footnote','Population controls change live traffic or roaming pedestrians. Other graphics controls preserve gameplay and progress. Resolution uses the shared display ceiling and an 8.3-million-pixel safety budget.'));
      refreshMetrics();panel.scrollTop=scroll;
      if(focus){const replacement=[...panel.querySelectorAll('button,select,input')].find(n=>focus.key?n.dataset.graphicsKey===focus.key:focus.label?n.getAttribute('aria-label')===focus.label:n.tagName===focus.tag&&n.textContent===focus.text);replacement?.focus({preventScroll:true});}
    }
    function mountGlobal(container){
      if(typeof container==='string')container=document.querySelector(container);if(!container)return;
      container.replaceChildren(make('h3','','Graphics'),make('p','','Choose defaults for games without a saved override, or open a game’s full graphics settings before playing.'));
      const row=make('label','pg-row');row.append(make('span','','Default preset'));const select=make('select');select.dataset.globalGraphicsPreset='true';select.setAttribute('aria-label','Default graphics preset');for(const v of ['potato','low','medium','high','ultra'])select.add(new Option(v[0].toUpperCase()+v.slice(1),v));select.value=globalPrefs.preset;select.onchange=()=>setGlobal({preset:select.value});row.append(select);container.append(row);
      const list=make('div','pg-game-list');for(const e of entries.values()){const b=make('button','',e.name+' graphics');b.type='button';b.onclick=()=>open(e.id);list.append(b);}container.append(list);
      const resetButton=make('button','','Reset global graphics defaults');resetButton.onclick=()=>setGlobal({preset:'medium',values:{}},{replace:true});container.append(resetButton);
    }
    function setGlobal(patch,{replace=false}={}){if(stopped)return;const next=replace?{preset:'medium',values:{}}:{preset:globalPrefs.preset,values:{...globalPrefs.values}};if(own(presetCommon,patch.preset)){next.preset=patch.preset;if(!patch.values)next.values={};}for(const[k,v]of Object.entries(patch.values||{}))if(common[k])next.values[k]=validate(common[k],v);globalPrefs=next;write('main-settings',{version:1,...globalPrefs});for(const e of entries.values())if(!e.override)apply(e,resolve(e),'global',base(e).preset);for(const select of document.querySelectorAll('[data-global-graphics-preset]'))select.value=next.preset;refresh();}
    // One lightweight overlay timer, no background animation loop or repeated listeners per menu.
    const overlayTimer=setInterval(()=>{
      const e=entries.get(active),visible=e?.values.overlay&&!document.hidden&&performance.now()-e.lastSample<1200;
      if(!visible){if(overlay)overlay.hidden=true;return;}
      if(!overlay){overlay=make('output','pg-overlay');overlay.setAttribute('aria-label','Graphics performance');document.body.append(overlay);}overlay.hidden=false;
      const size=e.size;overlay.textContent=`${e.name}\n${Math.round(1000/(e.frame||1000/60))} FPS · ${(e.cpu||0).toFixed(1)} ms CPU submit\n${size?size.width+' × '+size.height:'Starting'} · ${effective(e).dynamicScale.toFixed(2)}×`;
    },500);
    document.addEventListener('keydown',event=>{if(!modal)return;if(event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.code==='Tab'){const all=[...modal.querySelectorAll('button,select,input')].filter(n=>!n.disabled);const first=all[0],last=all[all.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}},true);
    document.addEventListener('visibilitychange',()=>{for(const e of entries.values()){e.samples=[];e.windowAt=performance.now();e.changedAt=performance.now();}});
    global.addEventListener('platdo:beforereset',()=>{stopped=true;clearInterval(overlayTimer);close();if(overlay)overlay.hidden=true;});
    const api=P.graphics={register,get:id=>entries.get(id)?effective(entries.get(id)):null,set,open,close,reset,useGlobal,renderSize,sample,reportFailure,attachContext,recommended,mountGlobal,setGlobal,getGlobal:()=>JSON.parse(JSON.stringify(globalPrefs)),list:()=>[...entries.values()].map(e=>({id:e.id,name:e.name,override:!!e.override,fields:e.fields,presets:Object.keys(e.presets)})),maxPixels:MAX_PIXELS};return api;
  }
  global.PlatdoGraphics={install,modelDetailField,resolveModelDetail,smokeParticleField,resolveSmokeParticles,sanitizeFov,projectFov};
})(window);

window.PlatdoGraphics.install(window.Platdo);
