/* Two-player bank chase. The room host advances this simulation. Both clients
   use its street plan and scripted shots; clients only submit control axes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PlatdoCopChaseCore=api;})(globalThis,function(){
'use strict';
const block=68,street=22,edge=215,intro=6,outro=4.2,stepSize=1/100;
const tune={cop:{max:40,engine:8.5,brake:24,grip:9.2,turn:1.35},robber:{max:60,engine:12,brake:17,grip:5.8,turn:1.08}};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=v=>Number.isFinite(v)?v:0;
const buildings=[];
for(let x=-3;x<3;x++)for(let z=-3;z<3;z++){
  const seed=(x+3)*17+(z+3)*31;
  buildings.push({x:(x+.5)*block,z:(z+.5)*block,w:block-street-4,l:block-street-4,height:7+(seed%7)*3.4,
    style:x===-1&&z===-2?'bank':(x===1&&z===0)||(x===-2&&z===1)?'park':['brick','office','shop','apartments'][seed%4],seed});
}
function vehicle(x,z){return {x,y:0,z,yaw:0,speed:0,vx:0,vz:0,steer:0,impact:0};}
function scripted(t){
  const robber=vehicle(3.4,-102),cop=vehicle(3.4,-102);
  // Runner reaches the passenger door before the getaway car launches.
  const launch=3.4,r=clamp((t-launch)/(intro-launch),0,1);
  robber.speed=30*r;robber.z+=.5*30*(intro-launch)*r*r;robber.vz=robber.speed;
  cop.speed=20+10*t/intro;cop.z=-239.6+20*t+5*t*t/intro;cop.vz=cop.speed;
  return {cop,robber};
}
function contact(a,b){
  if(Math.hypot(a.x-b.x,a.z-b.z)>4.7)return false;
  const basis=p=>[[Math.cos(p.yaw),-Math.sin(p.yaw)],[Math.sin(p.yaw),Math.cos(p.yaw)]];
  const A=basis(a),B=basis(b),project=(axis,set)=>Math.abs(axis[0]*set[0][0]+axis[1]*set[0][1])*.97+Math.abs(axis[0]*set[1][0]+axis[1]*set[1][1])*2.12;
  return [...A,...B].every(axis=>Math.abs((a.x-b.x)*axis[0]+(a.z-b.z)*axis[1])<=project(axis,A)+project(axis,B));
}
// The bank district supplies flat intersecting streets to the same chassis, tire,
// gearbox and swept collision solver used by solo Drive.
const runs=new WeakMap();
let district;
function makeDistrict(Drive){
  const route={
    map:{id:'bank-district'},length:edge*2,width:street,halfWidth:street/2,barrierOffset:street/2,
    at(s){return {x:0,y:0,z:s,s,offset:0,tx:0,tz:1,nx:1,nz:0,yaw:0};},
    nearest(x,z){
      const dx=x-Math.round(x/block)*block,dz=z-Math.round(z/block)*block;
      return Math.abs(dx)<=Math.abs(dz)?{...this.at(z),x:x-dx,offset:dx}:
        {x,y:0,z:z-dz,s:x,offset:-dz,tx:1,tz:0,nx:0,nz:-1,yaw:Math.PI/2};
    },
    sceneryNear:Drive.Route.prototype.sceneryNear
  };
  const geometry=buildings.filter(b=>b.style!=='park').map((b,i)=>({id:'bank-building-'+i,kind:'building',x:b.x,z:b.z,width:b.w,length:b.l,height:b.height}));
  for(const sign of [-1,1]){
    geometry.push({id:'wall-x:'+sign,kind:'building',x:sign*(edge+.3),z:0,width:.6,length:edge*2+2,height:1.04},
      {id:'wall-z:'+sign,kind:'building',x:0,z:sign*(edge+.3),width:edge*2+2,length:.6,height:1.04});
  }
  Drive.Route.prototype.registerScenery.call(route,geometry);return route;
}
function advance(car,input,role,dt){
  let run=runs.get(car);
  if(!run){
    const Drive=typeof module==='object'&&module.exports?require('../platdo-drive/src/core.js'):globalThis.DriveCore;
    district??=makeDistrict(Drive);
    const spec=tune[role],base=Drive.getConfig(role==='cop'?'vektor':'apex');
    run=new Drive.Simulation(district,{...base,maxSpeed:spec.max,accel:spec.engine,brake:spec.brake,grip:spec.grip},{mode:'free',trafficCount:0,damageMode:'cosmetic'});
    Object.assign(run.player,car);runs.set(car,run);
  }
  run.transmission=input.manual?'manual':'automatic';run.step(dt,input);
  const p=run.player;
  for(const name of ['x','y','z','vx','vz','yaw','speed','steer','slip','roll','pitch','wheelSpin','driftIntensity','rpm','brake','gear','engineRPM','shifting','engineLoad','throttle','yawRate'])car[name]=p[name];
  car.impact=run.events.some(e=>e.type==='collision')?1:Math.max(0,car.impact-dt*3);run.events.length=0;
}
const empty=()=>({steer:0,throttle:0,brake:0,handbrake:false});
function create(map,durationSeconds=180){
  const duration=clamp(Number(durationSeconds)||180,60,600),keys={cop:empty(),robber:empty()};
  let time=0,phase='intro',phaseTime=0,remaining=duration,outcome=null,cars=scripted(0),carry=0;
  function finish(result){outcome=result;phase='outro';phaseTime=0;keys.cop=empty();keys.robber=empty();}
  function update(dt){
    if(phase==='ended')return;time+=dt;phaseTime+=dt;
    if(phase==='intro'){
      cars=scripted(Math.min(phaseTime,intro));
      if(phaseTime+1e-8>=intro){phase='chase';phaseTime=0;}
    }else if(phase==='chase'){
      for(const role of ['cop','robber'])advance(cars[role],keys[role],role,dt);
      remaining=Math.max(0,duration-phaseTime);
      if(contact(cars.cop,cars.robber))finish('captured');else if(remaining<1e-7){remaining=0;finish('escaped');}
    }else{
      advance(cars.cop,{...empty(),brake:cars.cop.speed>0?.85:0},'cop',dt);
      advance(cars.robber,{...empty(),throttle:outcome==='escaped'?1:0,brake:outcome==='captured'&&cars.robber.speed>0?.9:0},'robber',dt);
      if(phaseTime>=outro){phase='ended';phaseTime=outro;}
    }
  }
  return {
    input(role,raw){if(!tune[role]||!raw||phase!=='chase')return;keys[role]={steer:clamp(finite(raw.steer),-1,1),throttle:clamp(finite(raw.throttle),0,1),brake:clamp(finite(raw.brake),0,1),handbrake:raw.handbrake===true,manual:raw.manual===true,gear:Number.isInteger(raw.gear)?clamp(raw.gear,1,6):1};},
    step(dt){if(!Number.isFinite(dt)||dt<=0)return;carry+=Math.min(dt,610);while(carry+1e-10>=stepSize&&phase!=='ended'){update(stepSize);carry-=stepSize;}},
    snapshot(){return {phase,time,duration,remaining,outcome,phaseTime,cop:{...cars.cop},robber:{...cars.robber}};}
  };
}
return {create,contact,buildings,block,street,edge,intro,outro,tune};
});
