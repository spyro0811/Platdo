
/* Render-only City damage fragments. Durable missing parts are derived from the
 * validated vehicle condition; particles never enter a save or damage another car. */
(function(root){'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function ratio(e){return clamp(Number.isFinite(e.health)&&e.maxHealth>0?e.health/e.maxHealth:1,0,1);}
  function disposePiece(p){p.object.removeFromParent();p.object.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();});}
  class Breakup {
    constructor(T,parent,world={}){this.T=T;this.world=world;this.group=new T.Group();this.group.name='City detached vehicle parts';parent.add(this.group);this.pieces=[];this.fires=[];this.limit=96;this.emitted=0;this.shatters=0;this.states=new WeakMap();}
    addPiece(source,e,label,explosion=false,geometry=null){
      const T=this.T,object=new T.Group();source.updateWorldMatrix(true,true);
      const center=new T.Box3().setFromObject(source).getCenter(new T.Vector3());
      if(geometry){geometry.computeBoundingBox();center.copy(geometry.boundingBox.getCenter(new T.Vector3())).applyMatrix4(source.matrixWorld);}
      const add=(part,geo)=>{const g=geo||part.geometry.clone();g.applyMatrix4(part.matrixWorld);g.translate(-center.x,-center.y,-center.z);const materials=(Array.isArray(part.material)?part.material:[part.material]).map(m=>{const c=m.clone();c.side=T.DoubleSide;return c;});const fragment=new T.Mesh(g,Array.isArray(part.material)?materials:materials[0]);fragment.castShadow=true;fragment.receiveShadow=true;object.add(fragment);};
      if(geometry)add(source,geometry);else source.traverseVisible(o=>{if(o.isMesh)add(o);});
      if(!object.children.length)return;
      object.position.copy(center);object.name=label;this.group.add(object);const n=++this.emitted,angle=n*2.39996323,dx=center.x-e.x,dz=center.z-e.z,d=Math.hypot(dx,dz)||1,force=explosion?3.4+n%4*.6:1.1;
      const size=new T.Box3().setFromObject(object).getSize(new T.Vector3()),radius=label.startsWith('wheel')?clamp(size.y*.4,.12,.32):clamp(Math.min(size.x,size.y,size.z)*.5,.045,.22);
      const p={object,label,owner:e,age:0,life:explosion?15:12,settled:false,bounces:0,radius,velocity:new T.Vector3((e.vx||0)*.55+dx/d*force+Math.sin(angle)*.7,(explosion?3.6:1.2)+n%4*.4+Math.max(0,e.vy||0)*.25,(e.vz||0)*.55+dz/d*force+Math.cos(angle)*.7),spin:new T.Vector3(Math.sin(angle)*3,Math.cos(angle)*2,Math.sin(angle*1.7)*3)};
      object.traverse(o=>{if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.userData.cityDebrisOpacity=m.opacity;});
      this.pieces.push(p);while(this.pieces.length>this.limit)disposePiece(this.pieces.shift());return p;
    }
    // Clip original triangles into bounded panel sections. This retains actual
    // body/window geometry without throwing a second whole vehicle into the air.
    shatterMesh(source,e,label){
      const T=this.T,g=source.geometry,position=g.attributes.position;if(!position)return;
      g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3());
      if(Math.max(size.x,size.y,size.z)<1.3){this.addPiece(source,e,label,true);return;}
      const attrs=Object.entries(g.attributes),index=g.index,count=index?index.count:position.count,min=g.boundingBox.min;
      const vertex=i=>Object.fromEntries(attrs.map(([name,a])=>[name,Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize))]));
      const clip=(polygon,axis,plane,sign)=>{const out=[];for(let k=0;k<polygon.length;k++){const a=polygon[k],b=polygon[(k+1)%polygon.length],da=(a.position[axis]-plane)*sign,db=(b.position[axis]-plane)*sign;if(da>=-1e-7)out.push(a);if(da>1e-7&&db< -1e-7||da< -1e-7&&db>1e-7){const t=da/(da-db);out.push(Object.fromEntries(attrs.map(([name])=>[name,a[name].map((v,j)=>v+(b[name][j]-v)*t)])));}}return out;};
      const nx=size.x>1?2:1,nz=size.z>2?3:1;
      for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){
        const values=Object.fromEntries(attrs.map(([name])=>[name,[]])),x0=min.x+size.x*x/nx,x1=min.x+size.x*(x+1)/nx,z0=min.z+size.z*z/nz,z1=min.z+size.z*(z+1)/nz;
        for(let i=0;i<count;i+=3){let poly=[0,1,2].map(k=>vertex(index?index.getX(i+k):i+k));if(nx>1){poly=clip(poly,0,x0,1);poly=clip(poly,0,x1,-1);}if(nz>1){poly=clip(poly,2,z0,1);poly=clip(poly,2,z1,-1);}for(let k=1;k<poly.length-1;k++)for(const v of[poly[0],poly[k],poly[k+1]])for(const[name]of attrs)values[name].push(...v[name]);}
        if(!values.position.length)continue;const fragment=new T.BufferGeometry();for(const[name,a]of attrs)fragment.setAttribute(name,new T.Float32BufferAttribute(values[name],a.itemSize));this.addPiece(source,e,label+'-'+x+'-'+z,true,fragment);
      }
    }
    wreck(mesh){
      if(mesh.userData.cityWreck)return mesh.userData.cityWreck;const T=this.T,d=mesh.userData.definition,w=d.bodyWidth||d.dimensions.width,l=d.dimensions.length,frame=new T.Group(),m=new T.MeshStandardMaterial({color:0x302b29,roughness:.96,metalness:.25});frame.name='Scorched '+d.name+' chassis';
      const box=(x,y,z,a,b,c)=>{const o=new T.Mesh(new T.BoxGeometry(a,b,c),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;frame.add(o);};
      if(d.kind==='bike'){box(0,.3,0,.15,.12,l*.72);box(0,.48,0,.28,.34,.47);for(const side of[-1,1])box(side*.1,.49,.18,.045,.45,.06);}
      else{for(const side of[-1,1])box(side*w*.35,.25,0,.12,.15,l*.82);for(const z of[-l*.34,0,l*.34])box(0,.25,z,w*.84,.14,.12);box(0,.34,-l*.05,w*.67,.10,l*.45);box(0,.51,l*.29,w*.42,.37,l*.17);}
      mesh.add(frame);mesh.userData.cityWreck=frame;return frame;
    }
    fireTexture(smoke){
      const key=smoke?'smokeTexture':'flameTexture';if(this[key])return this[key];const T=this.T,w=32,h=64,pixels=new Uint8Array(w*h*4);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=(x+.5)/w*2-1,t=(y+.5)/h,width=smoke?.95:Math.max(.08,.85*(1-t)),edge=clamp(1-Math.abs(nx)/width,0,1),vertical=smoke?Math.sin(t*Math.PI):Math.min(1,t*8)*(1-t),a=Math.pow(edge,.65)*vertical,i=(y*w+x)*4;pixels[i]=smoke?70:255;pixels[i+1]=smoke?65:Math.round(70+165*edge*(1-t));pixels[i+2]=smoke?62:Math.round(15+90*edge*(1-t));pixels[i+3]=Math.round(a*255);}
      const texture=new T.DataTexture(pixels,w,h);texture.needsUpdate=true;texture.magFilter=texture.minFilter=T.LinearFilter;this[key]=texture;return texture;
    }
    startFire(e){
      const T=this.T,group=new T.Group(),sprites=[];group.position.set(e.x,e.y+(e.bodyLift||0),e.z);group.name='Short-lived wreck fire';this.group.add(group);
      for(let i=0;i<10;i++){const smoke=i>=5,material=new T.SpriteMaterial({map:this.fireTexture(smoke),transparent:true,depthWrite:false,color:0xffffff,opacity:smoke?.5:.9}),sprite=new T.Sprite(material);group.add(sprite);sprites.push({sprite,smoke,index:i});}
      this.fires.push({group,sprites,ownerId:e.id,age:0,life:12});while(this.fires.length>6)this.removeFire(this.fires.shift());
    }
    removeFire(f){f.group.removeFromParent();for(const{sprite}of f.sprites)sprite.material.dispose();}
    sync(mesh,e,options={}){
      if(!mesh?.userData.parts)return;const data=mesh.userData,health=ratio(e),parts=data.parts.breakaway||[];let state=this.states.get(mesh);
      // Render interpolation creates a fresh vehicle object every frame. Keep a
      // stable ID within this scene; a new scene/clear handles save-load identity.
      if(!state||state.vehicleId!==e.id||state.model!==data){if(state)this.pieces=this.pieces.filter(p=>{if(p.owner.id!==state.vehicleId)return true;disposePiece(p);return false;});state={vehicleId:e.id,model:data,health,dead:health<=0||!!data.shattered,missing:new Set(parts.filter(p=>health<=0||(e.componentDamage?.[p.id]||0)>=1).map(p=>p.id))};this.states.set(mesh,state);}
      this.group.visible=true;for(const fire of this.fires)if(fire.ownerId===e.id)fire.group.position.set(e.x,e.y+(e.bodyLift||0),e.z);
      // Saved condition never replays destruction. Effects only control new
      // transient fragments/fire; permanent missing geometry still updates.
      const emit=options.effects!==false,dead=health<=0;
      if(health>state.health){this.pieces=this.pieces.filter(p=>{if(p.owner.id!==e.id)return true;disposePiece(p);return false;});this.fires=this.fires.filter(f=>{if(f.ownerId!==e.id)return true;this.removeFire(f);return false;});}
      if(!dead&&state.dead){for(const o of data.cityDestroyedHidden||[])o.visible=true;if(data.cityWreck)data.cityWreck.visible=false;if(data.lod)data.lod.visible=true;}
      mesh.updateWorldMatrix(true,true);let changed=false;
      // The detailed branch may be hidden by LOD; temporarily expose it only to
      // collect debris and rebuild its distant batch from the same missing parts.
      const detailed=data.detailed,wasDetailed=detailed?.visible;if(detailed)detailed.visible=true;
      for(const p of parts){const missing=dead||(e.componentDamage?.[p.id]||0)>=1;if(p.object.visible===missing)changed=true;if(missing&&!state.missing.has(p.id)&&emit){p.object.visible=true;this.addPiece(p.object,e,p.id,dead);}p.object.visible=!missing;if(missing)state.missing.add(p.id);else state.missing.delete(p.id);}
      if(dead){
        if(!state.dead&&emit&&options.effects!==false){const excluded=new Set([...parts.map(p=>p.object),...data.parts.smoke,...data.parts.blur]);const candidates=[];const collect=o=>{if(excluded.has(o)||!o.visible)return;if(o.isMesh)candidates.push(o);else for(const child of o.children)collect(child);};for(const child of detailed?.children||[])collect(child);for(const child of mesh.children)if(child!==data.lod&&child!==data.cityWreck)collect(child);for(const source of candidates.slice(0,32))this.shatterMesh(source,e,'body-panel');this.shatters++;this.startFire(e);}
        const frame=this.wreck(mesh);frame.visible=true;data.cityDestroyedHidden=mesh.children.filter(o=>o!==frame);for(const o of data.cityDestroyedHidden)o.visible=false;
      }else if(changed)root.CityVehicleModels.refreshDamageLOD(mesh);
      if(detailed)detailed.visible=wasDetailed;state.health=health;state.dead=dead;data.missingParts=parts.filter(p=>dead||(e.componentDamage?.[p.id]||0)>=1).map(p=>p.id);data.shattered=dead;
    }
    update(dt){
      dt=clamp(Number.isFinite(dt)?dt:0,0,.1);if(!dt)return;const T=this.T,world=this.world;
      for(const p of this.pieces){p.age+=dt;if(!p.settled){const steps=Math.max(1,Math.ceil(dt*90)),slice=dt/steps;for(let i=0;i<steps;i++){
        const previous=p.object.position.clone();p.velocity.y-=9.81*slice;const delta=p.velocity.clone().multiplyScalar(slice),length=delta.length(),hit=length>1e-5&&world.raycast?.(previous,delta,length,p.radius,{terrain:false,ignoreFloors:true,allowSeparating:true});
        if(hit?.normal){const n=new T.Vector3(hit.normal.x,hit.normal.y,hit.normal.z),travel=Math.max(0,Math.min(length,hit.distance||0)-.01);p.object.position.addScaledVector(delta,travel/length);const dot=p.velocity.dot(n);if(dot<0)p.velocity.addScaledVector(n,-dot*1.3);p.velocity.multiplyScalar(.68);p.spin.multiplyScalar(.65);}
        else p.object.position.add(delta);
        p.object.rotation.x+=p.spin.x*slice;p.object.rotation.y+=p.spin.y*slice;p.object.rotation.z+=p.spin.z*slice;
        const point=p.object.position,height=world.groundHeight?.(point.x,point.z,Math.max(previous.y,point.y))??0,floor=(Number.isFinite(height)?height:0)+p.radius;
        if(point.y<=floor){point.y=floor;p.velocity.y=Math.abs(p.velocity.y)*.28;p.velocity.x*=.62;p.velocity.z*=.62;p.spin.multiplyScalar(.5);p.bounces++;if(p.velocity.length()<.6||p.bounces>12){p.settled=true;p.velocity.set(0,0,0);p.spin.set(0,0,0);}}
      }}
      if(p.age>p.life-2){const alpha=clamp((p.life-p.age)/2,0,1);p.object.traverse(o=>{if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.transparent=true;m.opacity=m.userData.cityDebrisOpacity*alpha;}});}}
      this.pieces=this.pieces.filter(p=>{if(p.age<p.life)return true;disposePiece(p);return false;});
      for(const f of this.fires){f.age+=dt;const fade=clamp((f.life-f.age)/3,0,1);for(const{sprite,smoke,index}of f.sprites){const phase=(f.age*(smoke?.27:1.15)+index*.173)%1,angle=index*2.399,spread=smoke?.5+phase*.7:.45;sprite.position.set(Math.sin(angle)*spread,.3+phase*(smoke?3.8:1.9),Math.cos(angle)*spread);const size=smoke?1.1+phase*1.8:(1-phase*.6)*1.05;sprite.scale.set(size,size*(smoke?1.1:1.7),1);sprite.material.opacity=fade*Math.sin(phase*Math.PI)*(smoke?.52:.96);sprite.material.rotation=smoke?angle+f.age*.07:Math.sin(f.age*3+index)*.13;}}
      this.fires=this.fires.filter(f=>{if(f.age<f.life)return true;this.removeFire(f);return false;});
    }
    clear(){for(const p of this.pieces)disposePiece(p);for(const f of this.fires)this.removeFire(f);this.pieces=[];this.fires=[];this.states=new WeakMap();this.emitted=this.shatters=0;}
    dispose(){this.clear();this.group.removeFromParent();this.flameTexture?.dispose();this.smokeTexture?.dispose();}
  }
  root.CityVehicleBreakup={create:(T,parent,world)=>new Breakup(T,parent,world),ratio};
})(typeof globalThis!=='undefined'?globalThis:this);

