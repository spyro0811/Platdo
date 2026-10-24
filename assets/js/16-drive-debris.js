
/* Actual model pieces, bounded rigid-fragment effects, and readable custom plates.
 * Debris collides with the road/terrain; it is not a soft-body solver.
 * Uses the owner's render clock: pauses freeze it; the wreck menu keeps it alive. */
(()=>{'use strict';
const T=window.THREE,Scene=window.DriveScene,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const disposePiece=p=>{p.object.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();});p.object.removeFromParent();};
function effects(s){
 if(s.breakup)return s.breakup;
 const group=new T.Group();s.scene.add(group);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
 c.beginPath();c.moveTo(64,125);c.bezierCurveTo(8,112,26,73,40,51);c.bezierCurveTo(37,75,55,73,51,46);c.bezierCurveTo(47,26,72,21,70,3);c.bezierCurveTo(105,41,72,63,90,78);c.bezierCurveTo(105,63,98,51,99,49);c.bezierCurveTo(131,91,115,119,64,125);c.closePath();c.clip();
 const glow=c.createRadialGradient(65,98,3,63,89,83);glow.addColorStop(0,'rgba(255,248,166,1)');glow.addColorStop(.26,'rgba(255,192,53,.97)');glow.addColorStop(.6,'rgba(245,75,8,.78)');glow.addColorStop(1,'rgba(170,30,0,0)');c.fillStyle=glow;c.fillRect(0,0,128,128);
 const flameTexture=new T.CanvasTexture(canvas);flameTexture.colorSpace=T.SRGBColorSpace;
 const smokeCanvas=document.createElement('canvas');smokeCanvas.width=smokeCanvas.height=64;const q=smokeCanvas.getContext('2d'),smoke=q.createRadialGradient(32,32,0,32,32,31);smoke.addColorStop(0,'rgba(37,31,29,.72)');smoke.addColorStop(.55,'rgba(37,31,29,.35)');smoke.addColorStop(1,'rgba(37,31,29,0)');q.fillStyle=smoke;q.fillRect(0,0,64,64);const smokeTexture=new T.CanvasTexture(smokeCanvas);
 return s.breakup={group,pieces:[],fires:[],flameTexture,smokeTexture,emitted:0,explosions:0,limit:160,run:null};
}
function floorAt(s,x,z){const near=s.nearest(x,z);return Math.abs(near.offset)<(s.route.barrierOffset||13)+1?near.p.y:s.groundHeight(x,z);}
function addPiece(s,source,body,label,explosion=false,geometry=null){
 const b=effects(s),object=new T.Group();source.updateWorldMatrix(true,true);
 const center=new T.Box3().setFromObject(source).getCenter(new T.Vector3());
 const add=(mesh,geo)=>{if(!mesh.isMesh&&!mesh.isLine)return;const g=geo||mesh.geometry.clone();g.applyMatrix4(mesh.matrixWorld);g.translate(-center.x,-center.y,-center.z);const mats=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>{const n=m.clone();n.side=T.DoubleSide;return n;});const clone=mesh.isLine?new T.Line(g,mats[0]):new T.Mesh(g,Array.isArray(mesh.material)?mats:mats[0]);clone.castShadow=true;clone.receiveShadow=true;object.add(clone);};
 if(geometry){geometry.computeBoundingBox();center.copy(geometry.boundingBox.getCenter(new T.Vector3())).applyMatrix4(source.matrixWorld);add(source,geometry);}
 else source.traverseVisible(o=>{if(o.geometry&&o.material)add(o);});
 if(!object.children.length)return;
 object.position.copy(center);b.group.add(object);
 const index=++b.emitted,angle=index*2.39996323,dx=center.x-body.x,dz=center.z-body.z,radial=Math.hypot(dx,dz)||1;
 const outward=explosion?3.2+(index%5)*.62:1.8+(body.lastImpact?.severity||.3)*2.2;
 const hit=body.lastImpact||{},velocity=new T.Vector3((body.vx||0)*.56+dx/radial*outward+(explosion?Math.sin(angle)*2:-(hit.nx||0)),explosion?4.2+(index%5)*.65:1.3+(index%4)*.35,(body.vz||0)*.56+dz/radial*outward+(explosion?Math.cos(angle)*2:-(hit.nz||0)));
 const bounds=new T.Box3().setFromObject(object),size=bounds.getSize(new T.Vector3()),radius=source.userData.wheelPart?.28:clamp(Math.min(size.x,size.y,size.z)*.5,.055,.26);
 const p={object,velocity,spin:new T.Vector3(Math.sin(angle)*3,Math.cos(angle)*2,Math.sin(angle*1.7)*3),radius,age:0,settled:false,bounces:0,floor:floorAt(s,center.x,center.z)+radius,floorClock:0,life:explosion?23:20,label,owner:body.damage,clip:geometry?.userData.fragmentClip||null};b.pieces.push(p);
 while(b.pieces.length>b.limit)disposePiece(b.pieces.shift());
 return p;
}
// Clip original triangles at the fragment boundaries, retaining paint/normals/UVs.
// Centroid bucketing would split the long underside triangles into serrated combs.
function shatterMesh(s,mesh,body,label){
 const source=mesh.geometry,index=source.index,positions=source.attributes.position;if(!positions)return;
 source.computeBoundingBox();const size=source.boundingBox.getSize(new T.Vector3());
 if(label!=='body-panel'||Math.max(size.x,size.y,size.z)<1.1){addPiece(s,mesh,body,label,true);return;}
 const attrs=Object.entries(source.attributes),n=index?index.count:positions.count,min=source.boundingBox.min;
 const vertex=i=>Object.fromEntries(attrs.map(([name,a])=>[name,Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize))]));
 const cut=(polygon,axis,plane,sign)=>{const out=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=(a.position[axis]-plane)*sign,db=(b.position[axis]-plane)*sign;if(da>=-1e-7)out.push(a);if((da>1e-7&&db< -1e-7)||(da< -1e-7&&db>1e-7)){const t=da/(da-db);out.push(Object.fromEntries(attrs.map(([name])=>[name,a[name].map((v,j)=>v+(b[name][j]-v)*t)])));}}return out;};
 for(let x=0;x<2;x++)for(let z=0;z<3;z++){
  const values=Object.fromEntries(attrs.map(([name])=>[name,[]])),x0=min.x+size.x*x/2,x1=min.x+size.x*(x+1)/2,z0=min.z+size.z*z/3,z1=min.z+size.z*(z+1)/3;
  for(let i=0;i<n;i+=3){let polygon=[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j));polygon=cut(polygon,0,x0,1);polygon=cut(polygon,0,x1,-1);polygon=cut(polygon,2,z0,1);polygon=cut(polygon,2,z1,-1);
   for(let j=1;j<polygon.length-1;j++)for(const v of[polygon[0],polygon[j],polygon[j+1]])for(const [name]of attrs)values[name].push(...v[name]);
  }
  if(!values.position.length)continue;const g=new T.BufferGeometry();for(const [name,a]of attrs)g.setAttribute(name,new T.Float32BufferAttribute(values[name],a.itemSize));g.computeBoundingBox();g.userData.fragmentClip={expected:{x0,x1,z0,z1},actual:{x0:g.boundingBox.min.x,x1:g.boundingBox.max.x,z0:g.boundingBox.min.z,z1:g.boundingBox.max.z}};addPiece(s,mesh,body,label+'-'+(x+z*2),true,g);
 }
}
function startFire(s,body){
 const b=effects(s),group=new T.Group(),sprites=[];group.position.set(body.x,body.y||0,body.z);b.group.add(group);
 for(let i=0;i<21;i++){const smoke=i>=10,material=new T.SpriteMaterial({map:smoke?b.smokeTexture:b.flameTexture,transparent:true,depthWrite:false,blending:T.NormalBlending,color:smoke?'#534b48':'#ffffff'}),sprite=new T.Sprite(material);group.add(sprite);sprites.push({sprite,smoke,index:i});}
 const light=new T.PointLight('#ff8a28',0,15,2);group.add(light);b.fires.push({group,sprites,light,age:0,body});b.explosions++;
 while(b.fires.length>5){const f=b.fires.shift();f.group.removeFromParent();f.sprites.forEach(p=>p.sprite.material.dispose());}
}
function restore(mesh){
 mesh.traverse(o=>{if(o.userData.driveDetached){o.visible=true;delete o.userData.driveDetached;}});
 if(mesh.userData.contact)mesh.userData.contact.visible=true;
 if(mesh.userData.charredFrame)mesh.userData.charredFrame.visible=false;
 if(mesh.userData.breakState){mesh.userData.breakState.exploded=false;mesh.userData.breakState.damage=null;}
}
function breakModel(s,mesh,body){
 if(!mesh||!body.damage)return;
 const data=mesh.userData,old=data.breakState;
 if(old&&old.damage!==body.damage){const prior=old.damage,b=effects(s);b.pieces=b.pieces.filter(p=>{if(p.owner!==prior)return true;disposePiece(p);return false;});restore(mesh);}
 const state=data.breakState||(data.breakState={exploded:false,damage:body.damage});state.damage=body.damage;
 mesh.updateWorldMatrix(true,true);
 if(body.destroyed&&!state.exploded){
  state.exploded=true;
  // Wheels retain their tire/rim/hub assemblies when ejected.
  for(const wheel of data.wheels){const p=wheel.pivot;if(!p.userData.driveDetached){p.visible=true;addPiece(s,p,body,'wheel',true);p.userData.driveDetached=true;}}
  const candidates=[];data.body.traverseVisible(o=>{if(o.isMesh&&!o.userData.driveDetached&&!o.userData.licensePlate){o.geometry.computeBoundingBox();const size=o.geometry.boundingBox.getSize(new T.Vector3());if(Math.max(size.x,size.y,size.z)>.22)candidates.push(o);}});
  for(const meshPart of candidates.slice(0,28)){shatterMesh(s,meshPart,body,meshPart===data.damageSetup.shell?'body-panel':'car-part');}
  data.body.traverse(o=>{if(o.isMesh||o.isLine){o.visible=false;o.userData.driveDetached=true;}});startFire(s,body);
  // The scorched chassis remains visible after particles expire, matching the
  // stopped wreck's collision footprint instead of leaving an invisible obstacle.
  if(!data.charredFrame){const frame=new T.Group(),metal=new T.MeshStandardMaterial({color:'#292725',roughness:.98,metalness:.35});
   for(const x of[-data.width*.36,data.width*.36]){const beam=new T.Mesh(new T.BoxGeometry(.11,.13,data.length*.82),metal);beam.position.set(x,.26,0);frame.add(beam);}
   for(const z of[-data.length*.36,0,data.length*.36]){const beam=new T.Mesh(new T.BoxGeometry(data.width*.9,.12,.13),metal);beam.position.set(0,.26,z);frame.add(beam);}
   const floor=new T.Mesh(new T.BoxGeometry(data.width*.65,.08,data.length*.46),metal),engine=new T.Mesh(new T.BoxGeometry(data.width*.43,.37,data.length*.19),metal);floor.position.y=.31;engine.position.set(0,.47,data.length*.28);frame.add(floor,engine);mesh.add(frame);data.charredFrame=frame;
  }data.charredFrame.visible=true;
 }else if(!state.exploded){
  const parts=window.DriveCore.BREAKAWAY_PARTS,candidates=[];mesh.traverse(o=>{if(o.userData.breakawayPart&&!o.userData.driveDetached)candidates.push(o);});
  for(const piece of candidates){const id=piece.userData.breakawayPart,index=parts.findIndex(p=>p.id===id),part=parts[index];if(part&&(body.damage.parts?.[index]||0)>=part.threshold){piece.visible=true;addPiece(s,piece,body,id);piece.userData.driveDetached=true;}}
 }
 mesh.traverse(o=>{if(o.userData.driveDetached)o.visible=false;});
 if(state.exploded)data.contact.visible=false;
}
Scene.prototype.clearBreakup=function(){if(!this.breakup)return;const b=this.breakup;for(const p of b.pieces)disposePiece(p);b.pieces=[];for(const f of b.fires){f.group.removeFromParent();f.sprites.forEach(p=>p.sprite.material.dispose());}b.fires=[];b.emitted=b.explosions=0;};
Scene.prototype.updateBreakup=function(sim,player,dt,playing){
 const b=effects(this);if(b.run!==sim){this.clearBreakup();b.run=sim;restore(this.playerCar);}
 b.group.visible=playing;if(!playing){restore(this.playerCar);return;}
 breakModel(this,this.playerCar,sim.player);for(const body of sim.traffic||[])breakModel(this,this.trafficMeshes.get(body.id),body);
 if(dt<=0)return;
 for(const p of b.pieces){p.age+=dt;if(p.age>=p.life)continue;if(!p.settled){const steps=Math.max(1,Math.ceil(dt*120)),slice=dt/steps;for(let i=0;i<steps;i++){p.velocity.y-=9.81*slice;p.object.position.addScaledVector(p.velocity,slice);p.object.rotation.x+=p.spin.x*slice;p.object.rotation.y+=p.spin.y*slice;p.object.rotation.z+=p.spin.z*slice;p.floorClock+=slice;if(p.floorClock>.12){p.floorClock=0;p.floor=floorAt(this,p.object.position.x,p.object.position.z)+p.radius;}
   if(p.object.position.y<=p.floor){p.object.position.y=p.floor;p.velocity.y=Math.abs(p.velocity.y)*.32;p.velocity.x*=.64;p.velocity.z*=.64;p.spin.multiplyScalar(.5);p.bounces++;if(p.velocity.length()<.8||p.bounces>12){p.settled=true;p.velocity.set(0,0,0);p.spin.set(0,0,0);}}
  }}
  if(p.age>p.life-2){const alpha=clamp((p.life-p.age)/2,0,1);p.object.traverse(o=>{if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.transparent=true;m.opacity=alpha;}});}
 }
 b.pieces=b.pieces.filter(p=>{if(p.age<p.life)return true;disposePiece(p);return false;});
 for(const f of b.fires){f.age+=dt;const fade=clamp((20-f.age)/5,0,1);f.group.position.set(f.body.x,f.body.y||0,f.body.z);f.light.intensity=fade*(f.age<.4?40:8+Math.sin(f.age*23)*2);
  for(const {sprite,smoke,index}of f.sprites){const phase=(f.age*(smoke?.27:1.35)+index*.157)%1,angle=index*2.399;const base=smoke?.45:1;const spread=smoke?.6+phase*.85:.6;
   sprite.position.set(Math.sin(angle)*spread+(smoke?phase*.8:0),base+phase*(smoke?5.3:2.1),Math.cos(angle)*spread);const size=smoke?1.1+phase*2.8:(f.age<.25?2.8:1.1)*(1-phase*.7);sprite.scale.set(size,size*(smoke?1:1.75),1);sprite.material.opacity=fade*Math.sin(phase*Math.PI)*(smoke?.58:.82);sprite.material.rotation=smoke?angle+f.age*.1:Math.sin(f.age*4+index)*.12;
  }
 }
 b.fires=b.fires.filter(f=>{if(f.age<20)return true;f.group.removeFromParent();f.sprites.forEach(p=>p.sprite.material.dispose());return false;});
};
Scene.prototype.setLicensePlate=function(text){
 const car=this.playerCar,plate=car?.userData.plate;if(!plate)return;
 text=String(text||'PLATDO').toUpperCase().replace(/[^A-Z0-9 -]/g,'').slice(0,8)||'PLATDO';if(plate.userData.text===text)return;
 const texture=plate.material.map,canvas=texture.image,c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.fillStyle='#ede4c8';c.fillRect(0,0,w,h);c.strokeStyle='#373936';c.lineWidth=4;c.strokeRect(4,4,w-8,h-8);c.fillStyle='#293132';c.font='bold '+(text.length>6?30:35)+'px monospace';c.textAlign='center';c.fillText(text,w/2,45);texture.needsUpdate=true;plate.userData.text=text;
};
const originalSetCar=Scene.prototype.setCar,originalSettings=Scene.prototype.setSettings,originalDispose=Scene.prototype.dispose;
Scene.prototype.setCar=function(...args){if(!args[2])this.clearBreakup();originalSetCar.apply(this,args);this.setLicensePlate(this.settings.licensePlate);};
Scene.prototype.setSettings=function(...args){originalSettings.apply(this,args);this.setLicensePlate(this.settings.licensePlate);};
Scene.prototype.dispose=function(){if(this.breakup){this.clearBreakup();this.breakup.flameTexture.dispose();this.breakup.smokeTexture.dispose();}originalDispose.call(this);};
})();

