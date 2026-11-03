
/* Standalone PLATDO adapter. The hub supplies the same API in the integrated build. */
(()=>{
  if(window.Platdo)return;
  const sharedKey='platdo:settings:v1';let shared={frameRate:60,resolution:'auto'};
  try{Object.assign(shared,JSON.parse(localStorage.getItem(sharedKey)||'{}'));}catch(_){}
  window.Platdo={
    get frameRate(){return [30,60,120,240].includes(shared.frameRate)?shared.frameRate:60;},
    setFrameRate(value){shared.frameRate=[30,60,120,240].includes(value)?value:60;try{localStorage.setItem(sharedKey,JSON.stringify(shared));}catch(_){throw new Error('Browser storage is unavailable.');}window.dispatchEvent(new Event('platdo:settingschange'));},
    storage(id){if(!/^[a-z0-9-]+$/.test(id))throw new Error('Invalid game id');const prefix='platdo:game:'+id+':';return{get:key=>localStorage.getItem(prefix+key),set:(key,value)=>localStorage.setItem(prefix+key,value),remove:key=>localStorage.removeItem(prefix+key)};},
    registerGame(){},registerSaveKeys(){},playGameOpenSound(){},
    renderSize(width,height){let scale=Math.min(devicePixelRatio||1,1.5);if(shared.resolution!=='auto'&&Number.isFinite(Number(shared.resolution)))scale=Math.min(scale,Number(shared.resolution)/height);return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
  };
  window.PlatdoDriveStandalone=true;
})();

