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
function wall(car,axis,normal){
  const v=axis==='x'?'vx':'vz',impact=car[v]*normal;
  if(impact<0){car[v]-=1.1*impact*normal;car.impact=Math.max(car.impact,Math.min(1,-impact/25));}
}
function confine(car){
  const hx=Math.abs(Math.cos(car.yaw))*.88+Math.abs(Math.sin(car.yaw))*1.86,hz=Math.abs(Math.cos(car.yaw))*1.86+Math.abs(Math.sin(car.yaw))*.88;
  for(const b of buildings){if(b.style==='park')continue;
    const dx=car.x-b.x,dz=car.z-b.z,overX=b.w/2+hx-Math.abs(dx),overZ=b.l/2+hz-Math.abs(dz);
    if(overX<=0||overZ<=0)continue;
    if(overX<overZ){const n=Math.sign(dx)||1;car.x+=n*overX;wall(car,'x',n);}
    else{const n=Math.sign(dz)||1;car.z+=n*overZ;wall(car,'z',n);}
  }
  for(const [axis,half] of [['x',hx],['z',hz]]){
    const limit=edge-half;if(Math.abs(car[axis])<=limit)continue;
    const sign=Math.sign(car[axis]);car[axis]=sign*limit;wall(car,axis,-sign);
  }
}
function advance(car,input,role,dt){
  const spec=tune[role],sin=Math.sin(car.yaw),cos=Math.cos(car.yaw);
  let forward=car.vx*sin+car.vz*cos,lateral=car.vx*cos-car.vz*sin;
  if(input.brake>0)forward=Math.max(-9,forward-(forward>0?spec.brake:spec.engine*.62)*input.brake*dt);
  if(input.throttle>0)forward+=spec.engine*input.throttle*dt*(1-.4*Math.max(0,forward/spec.max));
  forward*=Math.exp(-dt*(input.throttle?.012:.07));forward=clamp(forward,-9,spec.max);
  car.steer+=(input.steer-car.steer)*(1-Math.exp(-9*dt));const bend=car.steer*Math.min(1,Math.abs(forward)/7)*Math.sign(forward);
  const yawRate=bend*spec.turn*(input.handbrake?1.45:1)/(1+Math.abs(forward)*.014);
  car.yaw+=yawRate*dt;lateral-=yawRate*forward*dt;lateral*=Math.exp(-dt*(input.handbrake?1.7:spec.grip));
  const s=Math.sin(car.yaw),c=Math.cos(car.yaw);car.vx=forward*s+lateral*c;car.vz=forward*c-lateral*s;
  car.x+=car.vx*dt;car.z+=car.vz*dt;car.impact=Math.max(0,car.impact-dt*3);confine(car);car.speed=car.vx*s+car.vz*c;
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
    input(role,raw){if(!tune[role]||!raw||phase!=='chase')return;keys[role]={steer:clamp(finite(raw.steer),-1,1),throttle:clamp(finite(raw.throttle),0,1),brake:clamp(finite(raw.brake),0,1),handbrake:raw.handbrake===true};},
    step(dt){if(!Number.isFinite(dt)||dt<=0)return;carry+=Math.min(dt,610);while(carry+1e-10>=stepSize&&phase!=='ended'){update(stepSize);carry-=stepSize;}},
    snapshot(){return {phase,time,duration,remaining,outcome,phaseTime,cop:{...cars.cop},robber:{...cars.robber}};}
  };
}
return {create,contact,buildings,block,street,edge,intro,outro,tune};
});
