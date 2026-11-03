/* Nameplates belong to the viewing player. Identity comes from the host's roster. */
(function(root){
  'use strict';
  const plates=new Map();
  const sight=new Map();
  let layer,point,enabled;
  const storage=()=>root.Platdo.storage('main-settings');
  function clear(resetSight=true){for(const plate of plates.values())plate.remove();plates.clear();if(resetSight)sight.clear();layer?.remove();layer=null;}
  function setting(){
    const panel=document.getElementById('main-display-panel');
    if(!root.Platdo?.storage||!panel||panel.querySelector('#platdoPlayerNames'))return;
    const label=document.createElement('label'),input=document.createElement('input');
    label.style.cssText='display:flex;align-items:center;gap:.65rem;margin:1rem 0';
    input.id='platdoPlayerNames';input.type='checkbox';input.checked=isEnabled();
    input.onchange=()=>{enabled=input.checked;storage().set('multiplayerNames',String(enabled));if(!enabled)clear();};
    label.append(input,'Show multiplayer usernames above players');panel.append(label);
  }
  function isEnabled(){return enabled??(enabled=storage().get('multiplayerNames')!=='false');}
  function draw(canvas,camera,actors){
    if(!canvas?.isConnected||!camera||!actors.length||!isEnabled()){clear(false);return;}
    const social=root.PlatdoFriends?.getState().social,roster=social?.session?.players||[];
    const visible=new Set(),rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height||document.hidden){clear();return;}
    if(!layer){layer=document.createElement('div');layer.id='platdoPlayerNameplates';layer.setAttribute('aria-hidden','true');layer.style.cssText='position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:8';canvas.parentElement.append(layer);}
    if(layer.parentElement!==canvas.parentElement)canvas.parentElement.append(layer);
    point??=new root.THREE.Vector3();
    for(const actor of actors){
      const member=roster.find(m=>m.code===actor.code);
      if(!member||member.code===social.me?.code||!member.name)continue;
      point.set(actor.x,actor.y,actor.z).project(camera);
      if(!(Math.abs(point.x)<=1&&Math.abs(point.y)<=1&&Math.abs(point.z)<=1))continue;
      let plate=plates.get(actor.code);
      if(!plate){plate=document.createElement('span');plate.style.cssText='position:absolute;transform:translate(-50%,-100%);font:700 14px system-ui;color:white;text-shadow:0 1px 3px #000,0 0 4px #000;white-space:nowrap;max-width:16em;overflow:hidden;text-overflow:ellipsis';layer.append(plate);plates.set(actor.code,plate);}
      if(plate.textContent!==member.name)plate.textContent=member.name;
      plate.style.left=(rect.left+(.5+point.x*.5)*rect.width)+'px';plate.style.top=(rect.top+(.5-point.y*.5)*rect.height)+'px';visible.add(actor.code);
    }
    for(const [code,plate] of plates)if(!visible.has(code)){plate.remove();plates.delete(code);}
  }
  function world(mode,sim,camera,canvas){
    const city=mode==='city',actors=[];
    if(city?root.PlatdoCity?.screen!=='play':root.PlatdoDrive?.state!=='playing'){clear();return;}
    if(isEnabled())for(const p of root.PlatdoFriends?.getState()?.social?.session?.players||[]){
      const actor=city?sim.npcs.find(n=>n.id===p.code):sim.traffic.find(car=>car.id==='p:'+p.code);
      if(!actor)continue;
      const car=city&&actor.vehicleId&&sim.vehicles.find(v=>v.id===actor.vehicleId);
      const anchor=car||actor;
      const label={code:p.code,x:anchor.x,y:(anchor.y||0)+(car||!city?2.25:(actor.ragdoll?.active ? .8 : 2.05)),z:anchor.z};
      if(city&&sim.world.lineOfSight){
        let probe=sight.get(p.code);const now=performance.now();
        if(!probe||now>=probe.until){probe={visible:sim.world.lineOfSight(camera.position,label),until:now+150};sight.set(p.code,probe);}
        if(!probe.visible)continue;
      }
      actors.push(label);
    }
    draw(canvas,camera,actors);
  }
  root.PlatdoNameplates={draw,world,clear};
  root.addEventListener('hashchange',clear);root.addEventListener('blur',clear);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setting,{once:true});else setting();
})(window);
