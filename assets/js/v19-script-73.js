/* Run the shipped activity in a disposable frame. It owns no account or save data. */
(function (root) {
  'use strict';
  const cityModules = {
    'CITY-11':'gravity', 'CITY-12':'ghost', 'CITY-13':'activities', 'CITY-14':'bubble',
    'CITY-15':'treasure', 'CITY-16':'golf', 'CITY-17':'drone', 'CITY-18':'performer', 'CITY-19':'museum'
  };
  const park = new Set(['gravity','ghost','bubble','treasure','performer']);
  const isDrive = id => /^DRIVE-(1[1-9]|20)$/.test(id);
  function label(id) {
    if(root.PlatdoPremiumCatalog?.byId[id]?.availability==='retired')return null;
    if (id==='CITY-19') return 'Tour museum';
    return cityModules[id] || isDrive(id) ? 'Try activity' : null;
  }
  let session = null;
  function close() {
    if (!session) return;
    const previous=session;
    session=null;
    root.removeEventListener('message',previous.receive);
    previous.dialog.remove();
    previous.onClose?.();
  }
  function initialize(config) {
    const stores=new Map(), adapters=new Map();
    window.Platdo={
      frameRate:config.frameRate,
      renderSize(w,h){const scale=Math.min(config.ratio,config.maxWidth/Math.max(1,w),config.maxHeight/Math.max(1,h));return {width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale))};},
      storage(id){if(!stores.has(id))stores.set(id,new Map());const map=stores.get(id);return {get:k=>map.get(k)??null,set:(k,v)=>map.set(k,String(v)),remove:k=>map.delete(k)};}
    };
    Platdo.storage('main-controls').set('mode',config.controls);
    window.PlatdoPremium={
      getState:()=>({uid:'trial'}),access:id=>({allowed:id===config.id}),
      registerAdapter:(id,adapter)=>adapters.set(id,adapter),subscribe:()=>()=>{},
      use:id=>{if(id!==config.id||!adapters.has(id))throw Error('Activity is unavailable.');return adapters.get(id).open();}
    };
    window.PlatdoCity={sim:{profile:{mode:'trial',phone:{settings:{}}},settings:{mute:config.mute}}};
    window.CityPhoneMedia={epoch:0,async add(photo){
      const image=document.createElement('img');image.src=URL.createObjectURL(photo.thumbnail||photo.blob);image.alt='Sky Scout trial photo';
      const gallery=document.getElementById('trialPhotos');gallery.hidden=false;gallery.append(image);return true;
    }};
    window.addEventListener('platdo:premiumactivitychange',event=>{if(!event.detail.active)parent.postMessage('platdo-trial-close','*');});
  }
  function markup(id) {
    const drive=isDrive(id), suffix=cityModules[id], game=drive?'platdo-drive':'platdo-city';
    const config={id,controls:root.Platdo.controls.getMode(game),frameRate:root.Platdo.frameRate||60,
      mute:!!root.PlatdoCity?.sim?.settings?.mute,ratio:devicePixelRatio||1};
    const cap=root.Platdo.renderSize(innerWidth,innerHeight);
    config.maxWidth=cap.width;config.maxHeight=cap.height;
    const scripts=['input-bindings.js','shared-controls.js','avatar.js','three.min.js','cosmetic-catalog.js','people.js','cosmetic-models.js','people-models.js'];
    if(drive)scripts.push('maps.js','wraps.js','core.js','occupant-physics.js','vehicle-models.js','scene.js');
    const shared=drive?['drive-activity-data','drive-activity-core','drive-activity-view','drive-activities']:[...(park.has(suffix)?['park-runtime']:[]),suffix];
    function source(selector){const node=document.querySelector(selector);if(!node)throw Error('Missing trial resource '+selector);return node.textContent;}
    const js=code=>'<script>'+code.replace(/<\/script/gi,'<\\/script')+'</scr'+'ipt>';
    const styles=['premium-shop.css','premium-museum.css','premium-park.css','premium-drive-activities.css'].map(name=>source('[data-platform-style="'+name+'"]')).join('\n') + source('[data-drive-style="touch"]');
    const launch='try{const result=PlatdoPremium.use('+JSON.stringify(id)+');if(result?.ok===false)throw Error(result.reason);parent.postMessage("platdo-trial-ready","*");}catch(e){parent.postMessage({type:"platdo-trial-error",message:e.message},"*");}';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\';script-src \'unsafe-inline\';style-src \'unsafe-inline\';img-src data: blob:;media-src blob: data:"><style>body{margin:0;background:#121820;color:white;font:16px system-ui}button{font:inherit}#trialPhotos{position:fixed;z-index:30000;right:4px;bottom:4px;max-width:30vw;background:#15222e}#trialPhotos img{width:60px}'+styles+'</style></head><body><details id="trialPhotos" hidden><summary>Trial photos</summary></details>'+
      js('('+initialize.toString()+')('+JSON.stringify(config)+')')+scripts.map(name=>js(source('[data-drive-module="'+name+'"]'))).join('')+
      shared.map(name=>js(source('[data-platform-module="premium-'+name+'.js"]'))).join('')+js(launch)+'</body></html>';
  }
  function open(id,{onClose}={}) {
    if(!label(id))throw Error('This item has no activity trial.');
    const html=markup(id);
    close();
    const dialog=document.createElement('dialog'),bar=document.createElement('header'),exit=document.createElement('button'),title=document.createElement('span'),frame=document.createElement('iframe');
    dialog.className='premium-activity-trial';dialog.setAttribute('aria-label','Shop trial');
    title.textContent=root.PlatdoPremiumCatalog.byId[id].name+' · Trial progress resets on exit';
    exit.textContent='Exit trial';exit.onclick=close;bar.append(title,exit);dialog.append(bar,frame);
    frame.title=root.PlatdoPremiumCatalog.byId[id].name+' trial';frame.setAttribute('sandbox','allow-scripts');
    function receive(e){if(e.source!==frame.contentWindow)return;if(e.data==='platdo-trial-close')close();else if(e.data==='platdo-trial-ready')frame.focus();else if(e.data?.type==='platdo-trial-error')title.textContent='Could not open trial. '+e.data.message;}
    session={dialog,onClose,receive};root.addEventListener('message',receive);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});document.body.append(dialog);dialog.showModal();frame.srcdoc=html;
    return {close};
  }
  root.PlatdoShopActivityTrial={label,open,close,get active(){return !!session;}};
})(window);
