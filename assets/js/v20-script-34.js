
/* Rendering is a consumer of vehicle-owned occupant state, never its owner. */
(function(){
'use strict';
const T=window.THREE,Physics=window.DriveOccupantPhysics,Scene=window.DriveScene,P=Scene.prototype;
Physics.install(window.DriveCore);
const oldSettings=P.setSettings,oldEffects=P.updateOccupantEffects,oldDispose=P.dispose;
function dispose(rig){rig.root.removeFromParent();if(rig.avatar)window.CityPeopleModels.dispose(rig.root);else Scene.disposeOccupant(rig);}
function avatarAppearance(){const base=window.PlatdoAvatar?.get()?.appearance||window.CityPeople?.presets?.[0];return window.PlatdoPremiumCity?.resolveAppearance(base)||base;}
function visibleBounds(model){const box=new T.Box3(),part=new T.Box3();model.updateMatrixWorld(true);model.traverseVisible(node=>{if(!node.isMesh||!node.geometry)return;if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();part.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);box.union(part);});return box;}
function makeRig(rec,sim){
 if(rec.owner!==sim.player||rec.seatIndex!==0||!window.CityPeopleModels)return Scene.createOccupant(rec.seatIndex,rec.seat,rec.scale,rec.seatIndex===0,rec.role);
 const a=avatarAppearance(),model=window.CityPeopleModels.create(a,{lod:0,modelDetail:window.CityPeopleModels.modelDetail||3}),height=window.CityPeople.bodies[a.body].height*a.heightScale;
 model.scale.multiplyScalar(1.65*rec.scale/height);model.position.set(rec.seat.x,rec.seat.top+.07*rec.scale,rec.seat.z);model.userData.noBatch=model.userData.noDent=true;model.userData.sceneryDynamic=true;model.userData.occupantRole=rec.role;
 window.CityPeopleModels.animate(model,{mode:'driver',seatPose:'driver',speed:0},0,0);model.updateMatrixWorld(true);
 // Fit the full seated outfit, including helmets, below the actual cabin roof.
 // Scale about the pelvis anchor so the seat contact and avatar proportions survive.
 window.PlatdoPremiumCity?.decorateModel(model,a);
 const layout=rec.layout||Physics.layoutFor(rec.owner,sim.config);
 if(!layout.openRoof){const bounds=visibleBounds(model),headroom=layout.roof-.045-model.position.y,extent=bounds.max.y-model.position.y;if(headroom>0&&extent>headroom){model.scale.multiplyScalar(headroom/extent);model.updateMatrixWorld(true);}model.userData.cabinFitTop=layout.roof-.045;model.userData.cabinFitBoundsTop=visibleBounds(model).max.y;}
 const points=window.CityPeopleModels.ragdollPose(model),map={pelvis:'pelvis',chest:'chest',head:'head',ls:'shoulderR',rs:'shoulderL',le:'elbowR',re:'elbowL',lw:'handR',rw:'handL',lh:'hipR',rh:'hipL',lk:'kneeR',rk:'kneeL',la:'ankleR',ra:'ankleL'};
 rec.avatarPose=Object.fromEntries(Object.entries(map).map(([to,from])=>[to,{...points[from]}]));
 const bones=model.userData.rig,wound=new T.Mesh(new T.SphereGeometry(1,8,6),new T.MeshStandardMaterial({color:'#731a19',roughness:.9}));wound.position.set(-.065,.23,.15);wound.scale.set(.038,.065,.005);wound.visible=false;bones.spine.add(wound);
 return{root:model,upper:bones.spine,head:bones.head,arms:[bones.armL,bones.armR],wound,seat:{...rec.seat},driver:true,role:rec.role,scale:rec.scale,avatar:true,avatarKey:window.CityPeople.appearanceKey(a),injury:0,ejected:false,record:rec};
}
function avatarPhysicalPose(rig){const p=rig.record.ragdoll.points,map={pelvis:'pelvis',chest:'chest',head:'head',shoulderL:'rs',shoulderR:'ls',elbowL:'re',elbowR:'le',handL:'rw',handR:'lw',hipL:'rh',hipR:'lh',kneeL:'rk',kneeR:'lk',ankleL:'ra',ankleR:'la'},points=Object.fromEntries(Object.entries(map).map(([to,from])=>[to,p[from]]));window.CityPeopleModels.animate(rig.root,{mode:'dead',ragdoll:{points},speed:0},0,0);rig.wound.visible=rig.record.injury>.1;}

// The passive crash rig replaces the old renderer, so seated animation must live
// here too. Keep the pelvis on its seat; springs move only the upper body.
function seatedPose(rig,body,mesh,dt,time){
 const step=Math.min(.04,Math.max(0,dt)),clamp=window.DriveCore.clamp;
 rig.roll??=0;rig.pitch??=0;rig.vRoll??=0;rig.vPitch??=0;
 const speed=body.speed||0,acceleration=step>0&&rig.lastSpeed!==undefined?clamp((speed-rig.lastSpeed)/Math.max(step,.008),-18,18):0;
 rig.lastSpeed=speed;
 const roll=clamp(-(body.yawRate||0)*Math.abs(speed)*.012,-.25,.25),pitch=clamp(-acceleration*.012+(body.brake||0)*.07,-.18,.22);
 rig.vRoll+=((roll-rig.roll)*65-rig.vRoll*10)*step;rig.vPitch+=((pitch-rig.pitch)*65-rig.vPitch*10)*step;
 rig.roll=clamp(rig.roll+rig.vRoll*step,-.3,.3);rig.pitch=clamp(rig.pitch+rig.vPitch*step,-.25,.25);
 if(rig.avatar)window.CityPeopleModels.animate(rig.root,{mode:'driver',seatPose:'driver',speed:0,steer:body.steer||0},time,step);
 rig.upper.rotation.z=rig.roll;rig.upper.rotation.x=rig.pitch;rig.head.rotation.z=-rig.roll*.28;rig.head.rotation.x=-rig.pitch*.32;
 const wheel=mesh.userData.interior?.steeringWheel;
 if(!rig.driver||!wheel){rig.arms.forEach((arm,i)=>{arm.rotation.z=rig.roll*(i?.3:-.3);arm.rotation.x=rig.pitch*.24;});return;}
 wheel.rotation.z=-(body.steer||0)*(wheel.userData.visualRatio||6);mesh.updateWorldMatrix(true,true);
 // Two-bone arm IK keeps palms attached to the rotating wheel even while the
 // chest leans. Use the actual wheel transform, including its cabin tilt.
 for(const side of[-1,1]){
  const bones=rig.avatar?rig.root.userData.rig:null,arm=bones?bones[side<0?'armL':'armR']:rig.arms.find(a=>a.name==='arm'+side),fore=bones?bones[side<0?'forearmL':'forearmR']:arm.children.find(a=>a.name==='forearm'+side),hand=bones?bones[side<0?'handL':'handR']:null;
  if(!arm||!fore)continue;
  const start=arm.getWorldPosition(new T.Vector3()),target=wheel.localToWorld(new T.Vector3(side*.12*rig.scale,-.025*rig.scale,-.035)),upper=fore.position.clone(),lower=hand?hand.position.clone():new T.Vector3(...fore.userData.bindDirection),scale=arm.getWorldScale(new T.Vector3()).x,l1=upper.length()*scale,l2=lower.length()*scale;
  const direction=target.clone().sub(start),distance=Math.min(direction.length(),(l1+l2)*.995);direction.normalize();const bend=new T.Vector3(0,-1,0).addScaledVector(direction,direction.y).normalize(),along=(l1*l1-l2*l2+distance*distance)/(2*Math.max(.001,distance)),height=Math.sqrt(Math.max(0,l1*l1-along*along)),elbow=start.clone().addScaledVector(direction,along).addScaledVector(bend,height);
  const orient=(bone,bind,end)=>{const local=bone.parent.worldToLocal(end.clone()).sub(bone.position);bone.quaternion.setFromUnitVectors(bind.clone().normalize(),local.normalize());bone.updateWorldMatrix(false,true);};
  orient(arm,upper,elbow);orient(fore,lower,target);
 }
 // Capture the live pose, not the original idle pose, if this car crashes next.
 if(rig.avatar){const p=window.CityPeopleModels.ragdollPose(rig.root),map={pelvis:'pelvis',chest:'chest',head:'head',ls:'shoulderR',rs:'shoulderL',le:'elbowR',re:'elbowL',lw:'handR',rw:'handL',lh:'hipR',rh:'hipL',lk:'kneeR',rk:'kneeL',la:'ankleR',ra:'ankleL'};rig.record.avatarPose=Object.fromEntries(Object.entries(map).map(([to,from])=>[to,Physics.transform(p[from],body,true)]));}
}

function split(rig,record){
 if(rig.avatar){rig.root.removeFromParent();rig.root.position.set(0,0,0);rig.root.quaternion.identity();rig.pieces={avatar:true};rig.record=record;rig.ejected=true;return rig;}
 const pieces={},root=rig.root,names=['head','forearm-1','forearm1','arm-1','arm1','shin-1','shin1','thigh-1','thigh1','torso','pelvis'];
 for(const name of names){const node=root.getObjectByName(name);if(node){pieces[name]=node;root.add(node);node.position.set(0,0,0);node.quaternion.identity();}}
 root.removeFromParent();root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);for(const node of Object.values(pieces))node.scale.setScalar(record.scale);root.userData.sceneryDynamic=true;rig.pieces=pieces;rig.record=record;rig.ejected=true;return rig;
}
function physicalPose(rig){if(rig.avatar)return avatarPhysicalPose(rig);const rec=rig.record,r=rec.ragdoll;if(!r)return;const p=r.points,scale=rec.scale,position=(node,a)=>node.position.set(a.x,a.y,a.z),orient=(node,a,b,rest)=>node.quaternion.setFromUnitVectors(new T.Vector3(...rest).normalize(),new T.Vector3(b.x-a.x,b.y-a.y,b.z-a.z).normalize()),node=rig.pieces;
 const up=new T.Vector3(p.chest.x-p.pelvis.x,p.chest.y-p.pelvis.y,p.chest.z-p.pelvis.z).normalize(),across=new T.Vector3(p.ls.x-p.rs.x,p.ls.y-p.rs.y,p.ls.z-p.rs.z).normalize(),front=new T.Vector3().crossVectors(across,up).normalize();across.crossVectors(up,front).normalize();const q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(across,up,front));
 for(const name of['pelvis','torso','head']){node[name].quaternion.copy(q);position(node[name],p[name==='torso'?'pelvis':name]);}
 node.pelvis.position.addScaledVector(up,-.035*scale);node.torso.position.addScaledVector(up,.005*scale);
 for(const [side,k]of[[1,'l'],[-1,'r']]){const arm=node['arm'+side],fore=node['forearm'+side],thigh=node['thigh'+side],shin=node['shin'+side],driver=rec.seatIndex===0;position(arm,p[k+'s']);orient(arm,p[k+'s'],p[k+'e'],arm.userData.bindDirection);position(fore,p[k+'e']);orient(fore,p[k+'e'],p[k+'w'],fore.userData.bindDirection);position(thigh,p[k+'h']);orient(thigh,p[k+'h'],p[k+'k'],[0,-.07,.28]);position(shin,p[k+'k']);orient(shin,p[k+'k'],p[k+'a'],[0,-.25,.07]);}
 rig.wound.visible=rec.injury>.1;rig.wound.scale.y=.065*(.7+rec.injury);
}
P.setSettings=function(settings){oldSettings.call(this,settings);if(this.activeSim){const engine=Physics.ensure(this.activeSim,this.settings);this.updateOccupants(this.playerCar,this.activeSim.player,0);for(const body of this.activeSim.traffic){const mesh=this.trafficMeshes.get(body.id);if(mesh)this.updateOccupants(mesh,body,0);}this.syncPhysicalOccupants(engine,false);} };
P.updateOccupants=function(mesh,body,dt){
 const sim=this.activeSim;if(!sim)return;const engine=Physics.ensure(sim,this.settings),owner=mesh===this.playerCar?sim.player:body;if((owner===sim.player?sim.config.id:owner.type)===mesh.userData.kind)owner._occupantLayout=mesh.userData.occupantLayout;if(owner.occupancy?.layout!==Physics.layoutFor(owner,owner===sim.player?sim.config:null))engine.sync();const state=owner.occupancy;if(!state)return;
 const current=mesh.userData.occupants||[],next=[];this.physicalOccupants??=new Map();
 for(const rig of current){const rec=rig.record;if(!rec||rec.removed||!state.people.includes(rec)){if(!rig.pieces)dispose(rig);} }
 for(const rec of state.people){let rig=current.find(r=>r.record===rec);if(rig?.avatar&&!rec.ragdoll&&rig.avatarKey!==window.CityPeople.appearanceKey(avatarAppearance())){dispose(rig);rig=null;}if(rec.ragdoll){if(rig&&!rig.pieces&&this.physicalOccupants.has(rec.id))dispose(rig);if(!this.physicalOccupants.has(rec.id)){if(!rig)rig=makeRig(rec,sim);split(rig,rec);this.scene.add(rig.root);this.physicalOccupants.set(rec.id,rig);}continue;}if(rec.location!=='seated'||rec.removed)continue;
  if(!rig&&owner!==sim.player&&Math.hypot(owner.x-sim.player.x,owner.z-sim.player.z)>40)continue;if(!rig){rig=makeRig(rec,sim);rig.record=rec;mesh.userData.interior.root.add(rig.root);}rig.root.visible=true;rig.injury=rec.injury;rig.wound.visible=rec.injury>.1;rig.wound.scale.y=.065*(.7+rec.injury);seatedPose(rig,body,mesh,dt,this.time);next.push(rig);
 }
 mesh.userData.occupants=next;mesh.userData.interior.occupants=next;
 mesh.userData.cabin?.traverse(o=>{if(o.userData.occupantWindshield)o.visible=!state.windshieldBroken;});if(state.windshieldBroken)for(const mark of mesh.userData.damageVisual?.crackMeshes||[])if(mark.zone==='front')mark.mesh.visible=false;
};
P.syncPhysicalOccupants=function(engine,playing){this.physicalOccupants??=new Map();for(const rec of engine.records.values())if(rec.ragdoll&&!this.physicalOccupants.has(rec.id)&&Math.hypot(rec.ragdoll.points.pelvis.x-engine.sim.player.x,rec.ragdoll.points.pelvis.z-engine.sim.player.z)<150){const rig=split(makeRig(rec,engine.sim),rec);this.physicalOccupants.set(rec.id,rig);this.scene.add(rig.root);}
 for(const[id,rig]of this.physicalOccupants){if(rig.record.removed||!rig.record.ragdoll||!engine.records.has(id)){dispose(rig);this.physicalOccupants.delete(id);continue;}rig.root.visible=playing;physicalPose(rig);} };
P.updateOccupantEffects=function(sim,dt,playing){const engine=Physics.ensure(sim,this.settings);this.syncPhysicalOccupants(engine,playing);const fx=this.occupantEffects();if(this.occupantRun!==sim){this.occupantRun=sim;for(const p of fx.particles)p.age=p.life+1;fx.run=sim;}
 for(const event of engine.events.splice(0)){const rec=engine.records.get(event.id);if(!rec||rec.removed)continue;if(event.type==='ejected')fx.ejected++;if(event.type==='blood'){const point=rec.ragdoll?.points.head||Physics.transform(Physics.pose(rec.seat,rec.scale,rec.seatIndex===0).head,rec.owner);this.emitOccupantBlood(new T.Vector3(point.x,point.y,point.z),rec.owner,event.amount);} }
 if(engine.settings.vehicleOccupants==='none')for(const p of fx.particles)p.age=p.life+1;oldEffects.call(this,sim,dt,playing);this.occupantStats={...this.occupantStats,...engine.stats,visualRagdolls:this.physicalOccupants.size,solver:'passive articulated constraints',collisionBodies:engine.ragdolls.length*15};
};
P.dispose=function(){for(const rig of this.physicalOccupants?.values()||[])dispose(rig);this.physicalOccupants?.clear();oldDispose.call(this);};
})();

