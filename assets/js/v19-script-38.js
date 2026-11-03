
/* Standalone shared-platform adapter; the collection supplies the real API. */
(()=>{'use strict';if(window.Platdo)return;const key='platdo:settings:v1';let settings={frameRate:60,resolution:'auto'};try{Object.assign(settings,JSON.parse(localStorage.getItem(key)||'{}'));}catch(_){}
window.Platdo={
 get frameRate(){return[30,60,120,240].includes(settings.frameRate)?settings.frameRate:60;},
 setFrameRate(value){settings.frameRate=[30,60,120,240].includes(value)?value:60;try{localStorage.setItem(key,JSON.stringify(settings));}catch(_){}window.dispatchEvent(new Event('platdo:settingschange'));},
 storage(id){if(!/^[a-z0-9-]+$/.test(id))throw new Error('Invalid game id');const prefix='platdo:game:'+id+':';return{get:name=>localStorage.getItem(prefix+name),set:(name,value)=>localStorage.setItem(prefix+name,value),remove:name=>localStorage.removeItem(prefix+name)};},
 registerGame(){},registerSaveKeys(){},playGameOpenSound(){},
 renderSize(width,height){let scale=Math.min(devicePixelRatio||1,2);const resolution=String(settings.resolution);if(/^\d+x\d+$/.test(resolution)){const[w,h]=resolution.split('x').map(Number);scale=Math.min(scale,w/width,h/height);}else if(resolution!=='auto'&&Number.isFinite(Number(resolution))){const cap=Number(resolution);scale=Math.min(scale,cap/height,cap*16/9/width);}return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
};window.PlatdoSwingStandalone=true;
})();

