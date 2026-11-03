
/* Shared cosmetic identity. Gameplay health, equipment and money remain game-owned. */
(function(root){'use strict';if(root.PlatdoAvatar)return;const listeners=new Set();let current,installed=false,registeredReset=false,stopped=false,store=null;const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
function clear(){current=null;store?.remove('identity');for(const fn of listeners)fn(null);}
function install(p=root.Platdo){if(!p?.storage)return;if(!installed){installed=true;store=p.storage('avatar');try{const v=JSON.parse(store.get('identity')||'null');if(v?.version===1&&v.appearance)current=v;}catch(_){}root.addEventListener?.('platdo:save',()=>{if(!stopped&&current)store.set('identity',JSON.stringify(current));});}if(!registeredReset&&p.registerResetHandler){registeredReset=true;p.registerResetHandler('avatar',()=>{stopped=true;clear();});}}
function get(){install();return clone(current);}
function set(v){install();if(stopped||!v||!v.appearance)return false;const appearance=clone(v.appearance);delete appearance.armorVest;const next={version:1,character:v.character,appearance,wardrobe:clone(v.wardrobe)};if(JSON.stringify(next)===JSON.stringify(current))return true;current=next;store?.set('identity',JSON.stringify(next));for(const fn of listeners)fn(clone(next));root.dispatchEvent?.(new CustomEvent('platdo:avatarchange',{detail:clone(next)}));return true;}
root.PlatdoAvatar={install,get,set,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},reset:clear};
// The collection reloads after any reset. Freeze old in-memory callbacks until
// then, but preserve the identity itself when only a game is being erased.
root.addEventListener?.('platdo:beforereset',()=>{stopped=true;});
root.addEventListener?.('platdo:controlsready',()=>install());install();
})(typeof globalThis!=='undefined'?globalThis:this);

