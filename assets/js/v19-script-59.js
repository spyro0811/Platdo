/* Shared input, account-bound records and Three.js stage for City side activities. */
(function (root) {
  'use strict';
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  const dist = (a, b) => Math.hypot(a.x-b.x, a.z-b.z);
  const element = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  let active = null;
  function close(event) {
    const previous = active;
    if (!previous) return;
    if(event?.type!=='platdo:beforereset')previous.flush();
    active = null;
    previous.stop();
  }
  function register(spec) {
    if (!root.addEventListener) return;
    const install = () => root.PlatdoPremium?.registerAdapter(spec.id, {
      open: () => open(spec), actionLabel: spec.launch, description: spec.description, previewLabel: spec.name
    });
    install();
    root.addEventListener('platdo:ready', install, {once: true});
  }
  function open(spec) {
    const ownership = root.PlatdoPremium;
    if (!ownership?.access(spec.id).allowed) throw Error('Verified ownership is required.');
    close();
    const owner = ownership.getState().uid, store = root.Platdo.storage('premium');
    const key = 'activity:' + spec.id + ':' + owner + (root.PlatdoCity?.progressSuffix||''), T = root.THREE;
    let data = {}, storageError = '';
    try { data = JSON.parse(store.get(key) || '{}'); if (!data || Array.isArray(data) || typeof data!=='object') throw Error(); }
    catch { data = {}; storageError = 'Saved records could not be read. New results will stay in this session.'; }
    const overlay=element('section','premium-activity premium-park'), header=element('header','premium-activity-header');
    const title=element('h2',null,spec.name), layout=element('div','premium-museum-layout'), stage=element('div','premium-museum-stage');
    const controls=element('div','premium-museum-panel'), canvas=element('canvas'), hud=element('output','premium-park-hud');
    const message=element('p','premium-status',storageError), exit=element('button','premium-secondary','Exit activity');
    const focus=document.activeElement;
    exit.onclick=close; header.append(title,exit); stage.append(canvas,hud); layout.append(stage,controls); overlay.append(header,layout,message);
    canvas.tabIndex=0; document.body.append(overlay);
    let renderer;
    try { renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false}); } catch(e) { overlay.remove(); throw e; }
    renderer.setPixelRatio(1); renderer.outputColorSpace=T.SRGBColorSpace;
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(56,1,.08,180);
    const sky=spec.sky||'#aacad0'; scene.background=new T.Color(sky); scene.fog=new T.Fog(sky,38,115);
    scene.add(new T.HemisphereLight(0xfff3e4,0x697668,2));
    const sun=new T.DirectionalLight(0xffe7bd,2.1); sun.position.set(-8,20,9); scene.add(sun);
    const materials=new Map(), geos=new Map(), textures=[];
    function mesh(kind, dimensions, color, parent=scene, options={}) {
      const gkey=kind+'/'+dimensions.join(':'), mkey=color+'/'+JSON.stringify(options);
      if (!geos.has(gkey)) {
        const ctor={box:T.BoxGeometry,ball:T.SphereGeometry,cylinder:T.CylinderGeometry,ring:T.TorusGeometry,cone:T.ConeGeometry}[kind];
        geos.set(gkey,new ctor(...dimensions));
      }
      if (!materials.has(mkey)) materials.set(mkey,new T.MeshStandardMaterial({color,roughness:.72,...options}));
      const m=new T.Mesh(geos.get(gkey),materials.get(mkey));parent.add(m);return m;
    }
    function sign(text,x,y,z,scale=1) {
      const surface=document.createElement('canvas');surface.width=512;surface.height=80;
      const ctx=surface.getContext('2d');ctx.fillStyle='#162c31';ctx.fillRect(0,0,512,80);ctx.font='bold 31px system-ui';
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff6d5';ctx.fillText(text,256,40,492);
      const texture=new T.CanvasTexture(surface);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
      const mat=new T.SpriteMaterial({map:texture,depthWrite:false});materials.set('label'+textures.length,mat);
      const sprite=new T.Sprite(mat);sprite.position.set(x,y,z);sprite.scale.set(4*scale,.625*scale,1);scene.add(sprite);return sprite;
    }
    function box(x,y,z,w,h,d,color,parent=scene) {
      const m=mesh('box',[w,h,d],color,parent);m.position.set(x,y,z);return m;
    }
    function ball(x,y,z,r,color,parent=scene,options={}) {
      const m=mesh('ball',[r,20,14],color,parent,options);m.position.set(x,y,z);return m;
    }
    const api={T,scene,camera,canvas,stage,controls,overlay,data,mesh,sign,box,ball,
      keys:new Set(),axes:{x:0,z:0},player:{x:0,z:-5,y:0,yaw:0},yaw:0,pitch:0,solid:[],
      note(text){message.textContent=text;},hud(text){if(hud.textContent!==text)hud.textContent=text;},
      panel(text){controls.replaceChildren();controls.append(element('h3',null,text));},
      para(text){controls.append(element('p','premium-notice',text));},
      button(text,fn){const b=element('button','premium-secondary',text);b.onclick=fn;controls.append(b);return b;},
      select(label,items,current,change){const l=element('label','premium-field',label),s=element('select');for(const [id,text] of items){const opt=element('option',null,text);opt.value=id;s.append(opt);}s.value=String(current);s.onchange=()=>change(s.value);l.append(s);controls.append(l);return s;},
      save(){if(storageError||active?.owner!==owner||ownership.getState().uid!==owner)return;try{store.set(key,JSON.stringify(data));}catch{message.textContent='Storage is full. This session can still be played.';}},
      record(id,value,better='low'){data.records ||= {};const old=data.records[id];if(!old||(better==='high'?value.score>old.score:value.score<old.score))data.records[id]=value;api.save();},
      move(dt,speed=4,bound=19){const p=api.player,angle=api.yaw,axes=api.axes,down=api.keys;
        const f=(down.has('KeyW')?1:0)-(down.has('KeyS')?1:0)-axes.z,s=(down.has('KeyD')?1:0)-(down.has('KeyA')?1:0)+axes.x;
        const den=Math.max(1,Math.hypot(f,s)),dx=(Math.sin(angle)*f-Math.cos(angle)*s)*dt*speed/den,dz=(Math.cos(angle)*f+Math.sin(angle)*s)*dt*speed/den;
        const valid=(x,z)=>Math.abs(x)<=bound&&Math.abs(z)<=bound&&!api.solid.some(b=>Math.abs(x-b.x)<b.w/2+.29&&Math.abs(z-b.z)<b.d/2+.29);
        if(valid(p.x+dx,p.z))p.x+=dx;if(valid(p.x,p.z+dz))p.z+=dz;p.yaw=angle;return Math.hypot(f,s);},
      follow(height=1.55,distance=0){const p=api.player,y=p.y||0;camera.position.set(p.x-Math.sin(api.yaw)*distance,y+height+distance*.48,p.z-Math.cos(api.yaw)*distance);
        camera.lookAt(p.x+Math.sin(api.yaw)*5,y+height+Math.sin(api.pitch)*5,p.z+Math.cos(api.yaw)*5);},
      tone(hz=.5,length=.08,shape='sine'){if(!audio||audio.state!=='running'||root.PlatdoCity?.sim?.settings?.mute)return;const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime;
        osc.type=shape;osc.frequency.value=hz;gain.gain.setValueAtTime(.045*(root.PlatdoCity?.sim?.settings?.sfx??.65),at);gain.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(gain).connect(audio.destination);osc.start(at);osc.stop(at+length+.01);}
    };
    let frame=0,last=0,lastDraw=0,size='',drag=null,audio=null,action=null,unregister=null,unsubscribe=null;
    function unlock(){try{if(!audio)audio=new (root.AudioContext||root.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
    function clear(){api.keys.clear();api.axes.x=api.axes.z=0;drag=null;action?.clear?.();}
    function look(dx,dy){api.yaw-=dx*.006;api.pitch=clamp(api.pitch-dy*.006,-1.05,1.05);}
    function keyboard(e,down){if(!active||active.element!==overlay)return;
      if(e.code==='Escape'&&down){e.stopImmediatePropagation();close();return;}
      if(root.Platdo.controls?.mode==='mobile'||e.target?.matches('input,textarea,select'))return;
      if(!['KeyW','KeyS','KeyA','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown',...Object.keys(spec.keys)].includes(e.code))return;
      e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(down){unlock();api.keys.add(e.code);}else api.keys.delete(e.code);const id=spec.keys[e.code];if(id)action?.input(id,down);}
    const keyDown=e=>keyboard(e,true),keyUp=e=>keyboard(e,false);
    const touch=()=>root.Platdo.controls?.mode==='mobile';
    canvas.onpointerdown=e=>{if(touch())return;unlock();canvas.focus();drag=e.pointerId;canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(drag===e.pointerId&&!touch())look(e.movementX,e.movementY);};
    canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
    function stop(){clear();cancelAnimationFrame(frame);unregister?.();unsubscribe?.();action?.dispose?.();audio?.close()?.catch(()=>{});
      if(touchLayer?.parentNode===stage)(touchParent?.isConnected?touchParent:document.body).append(touchLayer);
      document.removeEventListener('keydown',keyDown,true);document.removeEventListener('keyup',keyUp,true);root.removeEventListener('blur',clear);
      root.removeEventListener('platdo:controlsmodechange',clear);root.removeEventListener('platdo:beforereset',close);root.removeEventListener('platdo:save',api.save);root.removeEventListener('pagehide',api.save);
      for(const v of geos.values())v.dispose();for(const v of materials.values())v.dispose();for(const v of textures)v.dispose();
      renderer.dispose();renderer.forceContextLoss();overlay.remove();root.dispatchEvent(new CustomEvent('platdo:premiumactivitychange',{detail:{id:spec.id,active:false}}));focus?.focus?.();
    }
    const touchLayer=document.getElementById('platdoTouchControls'),touchParent=touchLayer?.parentNode;
    if(touchLayer)stage.append(touchLayer);
    active={element:overlay,owner,stop,flush:api.save};
    try{action=spec.create(api);}catch(e){close();throw e;}
    document.addEventListener('keydown',keyDown,true);document.addEventListener('keyup',keyUp,true);root.addEventListener('blur',clear);
    root.addEventListener('platdo:controlsmodechange',clear);root.addEventListener('platdo:beforereset',close);root.addEventListener('platdo:save',api.save);root.addEventListener('pagehide',api.save);
    unregister=root.Platdo.controls?.register('park-'+spec.id,{name:spec.name,priority:101,gameId:()=>'platdo-city',visible:()=>active?.element===overlay,playing:()=>active?.element===overlay,
      layout:()=>({key:spec.id,move:spec.move!==false,look:spec.look!==false,buttons:spec.buttons.map(([id,label,hold],i)=>({id,label,hold:!!hold,secondary:i>=4}))}),
      move(x,y){api.axes={x,z:-y};},look,action(id,on){unlock();action.input(id,on);},clear});
    unsubscribe=ownership.subscribe(()=>{if(ownership.getState().uid!==owner||!ownership.access(spec.id).allowed)close();});
    root.dispatchEvent(new CustomEvent('platdo:premiumactivitychange',{detail:{id:spec.id,active:true}}));
    function tick(now){if(active?.element!==overlay)return;frame=requestAnimationFrame(tick);const dt=last?Math.min(.075,(now-last)/1000):0;last=now;
      if(document.hidden){clear();return;}if(api.keys.has('ArrowLeft'))api.yaw+=dt*1.6;if(api.keys.has('ArrowRight'))api.yaw-=dt*1.6;
      if(api.keys.has('ArrowUp'))api.pitch=clamp(api.pitch+dt*1.2,-1,1);if(api.keys.has('ArrowDown'))api.pitch=clamp(api.pitch-dt*1.2,-1,1);
      action.step(dt);if(now-lastDraw<1000/(root.Platdo.frameRate||60))return;lastDraw=now;
      const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
      if(size!==w+'/'+h){size=w+'/'+h;const r=root.Platdo.renderSize(w,h);renderer.setSize(r.width,r.height,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
      renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(tick);return {close};
  }
  const api={clamp,dist,register,open,close};root.PlatdoPark=api;
  if(typeof module==='object')module.exports=api;
})(typeof globalThis==='undefined'?window:globalThis);
