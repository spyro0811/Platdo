
/* Sky Scout uses City's active world, collision map and renderer. The pilot never
   becomes the drone and its transform is never included in a game save. */
(function(root){
'use strict';
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const shells=['#53a8bc','#c98b4b','#9a8bb9'];
function model(T,shell=0){
  const drone=new T.Group(),rotors=[];
  function part(geometry,color,x,y,z,parent=drone){
    const object=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.65,metalness:.22}));
    object.position.set(x,y,z);parent.add(object);return object;
  }
  const box=(x,y,z,w,h,d,color)=>part(new T.BoxGeometry(w,h,d),color,x,y,z);
  const body=box(0,0,0,.56,.19,.36,shells[shell]||shells[0]);
  box(0,.13,0,.25,.07,.22,'#243847');box(0,-.15,.2,.18,.14,.15,'#273e4d');
  for(const x of[-.42,.42])for(const z of[-.35,.35]){
    const arm=box(x/2,0,z/2,Math.hypot(x,z),.06,.06,'#3a4f5e');arm.rotation.y=-Math.atan2(z,x);
    part(new T.CylinderGeometry(.09,.09,.14,14),'#354c58',x,.06,z);
    rotors.push(box(x,.14,z,.55,.015,.045,'#657c86'));
    box(x,-.12,z,.04,.25,.04,'#576971');
  }
  drone.name='Sky Scout';return{drone,body,rotors};
}
function clearance(world,origin,direction,distance,radius){
  const hit=world.raycast(origin,direction,distance,radius,{allowSeparating:true});
  return hit?Math.max(0,hit.distance-.04):distance;
}
class Flight{
  constructor(scene,sim,shell){
    const T=scene.T,p=sim.player,w=sim.world;
    this.pilot={x:p.x,y:p.y,z:p.z};this.yaw=p.yaw;this.pitch=-.12;
    this.velocity=new T.Vector3();this.direction=new T.Vector3();this.targetVelocity=new T.Vector3();
    this.position=new T.Vector3(p.x,p.y+1.65,p.z);
    const car=sim.currentVehicle(),reach=car?(car.length||4)/2+2:2;
    if(car)this.position.y+=Math.max(1,car.height||1.6);
    this.direction.set(Math.sin(this.yaw),0,Math.cos(this.yaw));
    this.position.addScaledVector(this.direction,clearance(w,this.position,this.direction,reach,.38));
    this.view={position:new T.Vector3(),target:new T.Vector3(),fov:62};
    this.oldCamera={position:scene.camera.position.clone(),quaternion:scene.camera.quaternion.clone(),target:scene.target.clone(),fov:scene.camera.fov};
    Object.assign(this,model(T,shell));scene.scene.add(this.drone);this.updateView(w);
  }
  look(dx,dy){this.yaw-=dx;this.pitch=clamp(this.pitch-dy,-1.25,1.25);}
  step(sim,dt,side,forward,vertical){
    const w=sim.world,dx=Math.sin(this.yaw),dz=Math.cos(this.yaw),length=Math.max(1,Math.hypot(side,forward));
    this.targetVelocity.set((dx*forward-dz*side)*12/length,vertical*7,(dz*forward+dx*side)*12/length);
    this.velocity.lerp(this.targetVelocity,1-Math.exp(-dt*5));
    for(const axis of ['x','z','y']){
      const distance=Math.abs(this.velocity[axis]*dt);
      if(distance<.00001)continue;
      this.direction.set(0,0,0);this.direction[axis]=Math.sign(this.velocity[axis]);
      const travel=clearance(w,this.position,this.direction,distance,.38);
      this.position[axis]+=this.direction[axis]*travel;if(travel<distance)this.velocity[axis]=0;
    }
    const pos=this.position,edge=w.extent-.6;
    pos.x=clamp(pos.x,-edge,edge);pos.z=clamp(pos.z,-edge,edge);
    const surface=Math.max(w.terrainHeight(pos.x,pos.z),w.waterHeight(pos.x,pos.z,sim.time)??-Infinity);
    pos.y=clamp(pos.y,surface+.42,Math.max(surface+145,this.pilot.y+145));
    const range=pos.distanceTo(this.pilot);
    if(range>160)pos.sub(this.pilot).multiplyScalar(160/range).add(this.pilot);
    this.drone.rotation.set((this.velocity.x*dx+this.velocity.z*dz)*.016,this.yaw,(this.velocity.x*dz-this.velocity.z*dx)*-.016,'YXZ');
    this.rotors.forEach((r,i)=>{r.rotation.y+=dt*(i===0||i===3?62:-62);});
    this.updateView(w);
  }
  updateView(w){
    const pos=this.position,c=this.view,cp=Math.cos(this.pitch);
    this.drone.position.copy(pos);this.direction.set(Math.sin(this.yaw)*cp,Math.sin(this.pitch),Math.cos(this.yaw)*cp);
    c.target.copy(pos).addScaledVector(this.direction,4);
    c.position.copy(this.direction).multiplyScalar(-2.7);c.position.y+=.75;
    const distance=c.position.length();c.position.normalize();
    c.position.multiplyScalar(clearance(w,pos,c.position,distance,.12)).add(pos);
    this.drone.visible=c.position.distanceTo(pos)>.56;
  }
  close(scene){
    this.drone.removeFromParent();
    this.drone.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    scene.camera.position.copy(this.oldCamera.position);scene.camera.quaternion.copy(this.oldCamera.quaternion);
    scene.target.copy(this.oldCamera.target);scene.camera.fov=this.oldCamera.fov;scene.camera.updateProjectionMatrix();
  }
}
function syncRemote(scene,sim,dt){
  const drones=scene.remoteScouts??=new Map(),live=new Set();
  for(const actor of sim.npcs||[]){
    const pose=actor.scout;if(!pose)continue;live.add(actor.id);
    let mesh=drones.get(actor.id);
    if(!scene.actorInView(pose,1,220)){if(mesh)mesh.drone.visible=false;continue;}
    if(!mesh){mesh=model(scene.T);scene.scene.add(mesh.drone);mesh.drone.position.set(pose.x,pose.y,pose.z);drones.set(actor.id,mesh);}
    mesh.drone.visible=true;
    const k=1-Math.exp(-dt*15),p=mesh.drone.position;
    p.x+=(pose.x-p.x)*k;p.y+=(pose.y-p.y)*k;p.z+=(pose.z-p.z)*k;mesh.drone.rotation.y=pose.yaw;
    mesh.rotors.forEach((r,i)=>{r.rotation.y+=(i===0||i===3?62:-62)*dt;});
  }
  for(const [key,mesh] of drones)if(!live.has(key)){
    mesh.drone.removeFromParent();mesh.drone.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});drones.delete(key);
  }
}
root.CityDrone={Flight,model,syncRemote};
})(globalThis);

