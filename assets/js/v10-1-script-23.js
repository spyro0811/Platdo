
/* Rendering is a consumer of vehicle-owned occupant state, never its owner. */
(function(){
'use strict';
const T=window.THREE,Physics=window.DriveOccupantPhysics,Scene=window.DriveScene,P=Scene.prototype;
Physics.install(window.DriveCore);
const oldSettings=P.setSettings,oldEffects=P.updateOccupantEffects,oldDispose=P.dispose;
function dispose(rig){rig.root.removeFromParent();Scene.disposeOccupant(rig);}
function split(rig,record){
 const pieces={},root=rig.root,names=['head','forearm-1','forearm1','arm-1','arm1','shin-1','shin1','thigh-1','thigh1','torso','pelvis'];
 for(const name of names){const node=root.getObjectByName(name);if(node){pieces[name]=node;root.add(node);node.position.set(0,0,0);node.quaternion.identity();}}
 root.removeFromParent();root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);for(const node of Object.values(pieces))node.scale.setScalar(record.scale);root.userData.sceneryDynamic=true;rig.pieces=pieces;rig.record=record;rig.ejected=true;return rig;
}
function physicalPose(rig){const rec=rig.record,r=rec.ragdoll;if(!r)return;const p=r.points,scale=rec.scale,position=(node,a)=>node.position.set(a.x,a.y,a.z),orient=(node,a,b,rest)=>node.quaternion.setFromUnitVectors(new T.Vector3(...rest).normalize(),new T.Vector3(b.x-a.x,b.y-a.y,b.z-a.z).normalize()),node=rig.pieces;
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
 for(const rec of state.people){let rig=current.find(r=>r.record===rec);if(rec.ragdoll){if(rig&&!rig.pieces&&this.physicalOccupants.has(rec.id))dispose(rig);if(!this.physicalOccupants.has(rec.id)){if(!rig)rig=Scene.createOccupant(rec.seatIndex,rec.seat,rec.scale,rec.seatIndex===0,rec.role);split(rig,rec);this.scene.add(rig.root);this.physicalOccupants.set(rec.id,rig);}continue;}if(rec.location!=='seated'||rec.removed)continue;
  if(!rig&&owner!==sim.player&&Math.hypot(owner.x-sim.player.x,owner.z-sim.player.z)>40)continue;if(!rig){rig=Scene.createOccupant(rec.seatIndex,rec.seat,rec.scale,rec.seatIndex===0,rec.role);rig.record=rec;mesh.userData.interior.root.add(rig.root);}rig.root.visible=true;rig.injury=rec.injury;rig.wound.visible=rec.injury>.1;rig.wound.scale.y=.065*(.7+rec.injury);next.push(rig);
 }
 mesh.userData.occupants=next;mesh.userData.interior.occupants=next;
 mesh.userData.cabin?.traverse(o=>{if(o.userData.occupantWindshield)o.visible=!state.windshieldBroken;});if(state.windshieldBroken)for(const mark of mesh.userData.damageVisual?.crackMeshes||[])if(mark.zone==='front')mark.mesh.visible=false;
};
P.syncPhysicalOccupants=function(engine,playing){this.physicalOccupants??=new Map();for(const rec of engine.records.values())if(rec.ragdoll&&!this.physicalOccupants.has(rec.id)&&Math.hypot(rec.ragdoll.points.pelvis.x-engine.sim.player.x,rec.ragdoll.points.pelvis.z-engine.sim.player.z)<150){const rig=split(Scene.createOccupant(rec.seatIndex,rec.seat,rec.scale,rec.seatIndex===0,rec.role),rec);this.physicalOccupants.set(rec.id,rig);this.scene.add(rig.root);}
 for(const[id,rig]of this.physicalOccupants){if(rig.record.removed||!rig.record.ragdoll||!engine.records.has(id)){dispose(rig);this.physicalOccupants.delete(id);continue;}rig.root.visible=playing;physicalPose(rig);} };
P.updateOccupantEffects=function(sim,dt,playing){const engine=Physics.ensure(sim,this.settings);this.syncPhysicalOccupants(engine,playing);const fx=this.occupantEffects();if(this.occupantRun!==sim){this.occupantRun=sim;for(const p of fx.particles)p.age=p.life+1;fx.run=sim;}
 for(const event of engine.events.splice(0)){const rec=engine.records.get(event.id);if(!rec||rec.removed)continue;if(event.type==='ejected')fx.ejected++;if(event.type==='blood'){const point=rec.ragdoll?.points.head||Physics.transform(Physics.pose(rec.seat,rec.scale,rec.seatIndex===0).head,rec.owner);this.emitOccupantBlood(new T.Vector3(point.x,point.y,point.z),rec.owner,event.amount);} }
 if(engine.settings.vehicleOccupants==='none')for(const p of fx.particles)p.age=p.life+1;oldEffects.call(this,sim,dt,playing);this.occupantStats={...this.occupantStats,...engine.stats,visualRagdolls:this.physicalOccupants.size,solver:'passive articulated constraints',collisionBodies:engine.ragdolls.length*15};
};
P.dispose=function(){for(const rig of this.physicalOccupants?.values()||[])dispose(rig);this.physicalOccupants?.clear();oldDispose.call(this);};
})();

