
/* Moving support adapter for the central Simulation, installed after CityLife.
 * Vehicle tops use the same +Y up/+Z forward transform as their visible models.
 * Carries feet once after vehicle integration; seating never participates.
 */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./vehicles.js'):root.CityVehicles);if(typeof module==='object'&&module.exports)module.exports=api;else root.CitySupport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(V){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function patches(type){const d=V.definition(type),{width:w,length:l,height:h}=d.dimensions,s=d.silhouette;if(d.kind==='bike'||d.category==='plane'||d.category==='heli'||s==='convertible')return[];
 if(d.category==='boat'){const large=s==='cruiser'||s==='fishing';return[{id:'deck',y:.41,minX:-w*(large?.32:.35),maxX:w*(large?.32:.35),minZ:-l*(large?.365:.36),maxZ:large?-l*.23:l*.12,exclude:large?[]:[...d.seats.map(seat=>({minX:seat.position.x-.36,maxX:seat.position.x+.36,minZ:seat.position.z-.41,maxZ:seat.position.z+.41})),{minX:-w*.24,maxX:w*.24,minZ:.45,maxZ:.95}]}];}
 const truck=s==='truck',van=s==='van'||s==='ambulance',sport=['sport','wedge','coupe'].includes(s),front=l*(truck?.29:van?.30:s==='muscle'?.01:s==='pickup'?.08:s==='wedge'?.16:.18),rear=l*(truck?.01:s==='pickup'?-.21:van?-.38:s==='wagon'?-.36:s==='hatch'?-.32:-.26),half=w*(sport?.37:.40)-.12;
 const tops=[{id:'roof',y:(d.cabinRoofY||(truck?1.89:h*.98))+.025,minX:-half,maxX:half,minZ:rear+.38,maxZ:front-.48}];
 if(truck)tops.push({id:'cargo-roof',y:3.03,minX:-w*.43,maxX:w*.43,minZ:-l*.47,maxZ:l*.065});return tops.filter(p=>p.maxZ>p.minZ);
}
const patchCache=new Map();function tops(v){if(!patchCache.has(v.typeId))patchCache.set(v.typeId,patches(v.typeId));return patchCache.get(v.typeId);}
function basis(v){const o=V.worldPoint(v,{x:0,y:0,z:0}),axis=k=>{const p=V.worldPoint(v,{x:k==='x'?1:0,y:k==='y'?1:0,z:k==='z'?1:0});return{x:p.x-o.x,y:p.y-o.y,z:p.z-o.z};};return{o,x:axis('x'),y:axis('y'),z:axis('z')};}
function localPoint(v,p){const b=basis(v),x=p.x-b.o.x,y=p.y-b.o.y,z=p.z-b.o.z;return{x:x*b.x.x+y*b.x.y+z*b.x.z,y:x*b.y.x+y*b.y.y+z*b.y.z,z:x*b.z.x+y*b.z.y+z*b.z.z};}
function surface(v,x,z,referenceY=Infinity,drop=.45){if(v.health<=0||v.rollover||v.overturned||Math.abs(v.pitch)>.55||Math.abs(v.roll)>.55)return null;const b=basis(v);let best=null;for(const patch of tops(v)){const y=b.o.y+(patch.y-(x-b.o.x)*b.y.x-(z-b.o.z)*b.y.z)/b.y.y;if(y>referenceY+drop)continue;const p=localPoint(v,{x,y,z});if(p.x<patch.minX||p.x>patch.maxX||p.z<patch.minZ||p.z>patch.maxZ||patch.exclude?.some(q=>p.x>q.minX&&p.x<q.maxX&&p.z>q.minZ&&p.z<q.maxZ))continue;if(!best||y>best.y)best={vehicleId:v.id,patchId:patch.id,x,y,z,local:p};}return best;}
function query(vehicles,x,z,referenceY=Infinity,drop=.45){let best=null;for(const v of vehicles){if(Math.hypot(v.x-x,v.z-z)>(v.length||10))continue;const hit=surface(v,x,z,referenceY,drop);if(hit&&(!best||hit.y>best.y))best=hit;}return best;}
function motionAt(v,local,dt=1/60){const now=V.worldPoint(v,local),next=V.worldPoint({...v,x:v.x+(v.vx||0)*dt,y:v.y+(v.vy||0)*dt,z:v.z+(v.vz||0)*dt,yaw:v.yaw+(v.yawRate||0)*dt,pitch:v.pitch+(v.pitchRate||0)*dt,roll:v.roll+(v.rollRate||0)*dt},local);return{x:(next.x-now.x)/dt,y:(next.y-now.y)/dt,z:(next.z-now.z)/dt};}
function eligible(p){return p.health>0&&!p.vehicleId&&!p.transition&&['onFoot','falling','vaulting'].includes(p.mode);}
function inherit(sim,state,dt){if(!state||state.inherited)return;state.inherited=true;const p=sim.player,vel=state.velocity||{x:0,y:0,z:0};p.vx+=vel.x;p.vy+=vel.y;p.vz+=vel.z;const moved=sim.world.moveCapsule(p,{x:vel.x*dt,y:vel.y*dt,z:vel.z*dt},.36,p.crouched?1.2:1.8);p.x=moved.x;p.y=moved.y;p.z=moved.z;if(moved.contacts.includes('x'))p.vx=0;if(moved.contacts.includes('z'))p.vz=0;p.grounded=false;sim.emit('supportLeft',{vehicle:state.vehicleId,velocity:{...vel}});}
function install(Simulation){const proto=Simulation.prototype;if(proto._citySupportInstalled)return;proto._citySupportInstalled=true;const move=proto.movePlayer,vehicles=proto.stepVehicles,deepWater=proto.deepWater,restore=proto.restore;
 proto.getMovingSupport=function(){const s=this._movingSupport;return s?{vehicleId:s.vehicleId,patchId:s.patchId,local:{...s.local},velocity:{...s.velocity}}:null;};
 proto.isAboveVehicleSupport=function(v,actor){const top=surface(v,actor.x,actor.z,actor.y,.05);return!!top&&actor.y>=top.y-.035;};
 proto.deepWater=function(p){if(this._supportContext&&p===this.player){const s=query(this.vehicles,p.x,p.z,p.y,.12);if(s&&p.y>=s.y-.12)return false;}return deepWater.call(this,p);};
 proto.movePlayer=function(dt,input={}){const p=this.player;if(!eligible(p)){this._movingSupport=null;return move.call(this,dt,input);}let old=this._movingSupport;const under=query(this.vehicles,p.x,p.z,p.y,.16);if(under&&Math.abs(p.y-under.y)<.18&&p.vy<=.2){const v=this.vehicles.find(v=>v.id===under.vehicleId);old={...under,velocity:old?.vehicleId===under.vehicleId?old.velocity:motionAt(v,under.local),inherited:false};this._movingSupport=old;p.grounded=true;p.y=under.y;p.mode='onFoot';}else{this._movingSupport=null;old=null;}
  const ground=this.world.groundHeight;this._supportContext=true;this.world.groundHeight=(x,z,ref=p.y)=>{const floor=ground(x,z,ref),hit=query(this.vehicles,x,z,Number.isFinite(ref)?ref:p.y);return hit?Math.max(floor,hit.y):floor;};
  try{move.call(this,dt,input);}finally{this.world.groundHeight=ground;this._supportContext=false;}
  const after=query(this.vehicles,p.x,p.z,p.y,.18),jumped=old&&p.vy>0&&!p.grounded;if(after&&p.grounded&&Math.abs(p.y-after.y)<.2&&!jumped){const v=this.vehicles.find(v=>v.id===after.vehicleId);this._movingSupport={...after,velocity:old?.vehicleId===after.vehicleId?old.velocity:motionAt(v,after.local),inherited:false};}else{this._movingSupport=null;if(old&&(jumped||!after))inherit(this,old,dt);}
 };
 proto.stepVehicles=function(dt,input={}){let s=this._movingSupport;const p=this.player;if(!eligible(p)){this._movingSupport=null;s=null;}const before=s?this.vehicles.find(v=>v.id===s.vehicleId):null,oldPoint=before?V.worldPoint(before,s.local):null;vehicles.call(this,dt,input);if(!s||!oldPoint||!eligible(p)||this._movingSupport!==s)return;const v=this.vehicles.find(v=>v.id===s.vehicleId);if(!v||v.health<=0||v.rollover||v.overturned||Math.abs(v.pitch)>.55||Math.abs(v.roll)>.55){this._movingSupport=null;inherit(this,s,0);return;}const to=V.worldPoint(v,s.local),delta={x:to.x-oldPoint.x,y:to.y-oldPoint.y,z:to.z-oldPoint.z},m=this.world.moveCapsule(p,delta,.36,p.crouched?1.2:1.8);p.x=m.x;p.y=m.y;p.z=m.z;s.velocity={x:delta.x/dt,y:delta.y/dt,z:delta.z/dt};if(m.blocked){this._movingSupport=null;inherit(this,s,0);return;}p.y=to.y;p.grounded=true;p.mode='onFoot';p.vy=0;s.local=localPoint(v,p);p.lastSafe={x:p.x,y:p.y,z:p.z};
 };
 proto.restore=function(snapshot){this._movingSupport=null;this._supportContext=false;return restore.call(this,snapshot);};
}
return{install,patches,surface,query,localPoint,motionAt};
});

