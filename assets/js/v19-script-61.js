/* Harbor After Dark. Detection, sustained light and tracking each use distance and aim. */
(function(root){'use strict';
const P=root.PlatdoPark||(typeof require==='function'&&require('./premium-park-runtime.js'));
const types=[
 {name:'Hide-and-Peep',color:'#9eedd3',pitch:390,habitat:'Delivery bins behind shops',nature:'Curious until noticed',tip:'Watch for a lid that lifts by itself.',behavior:'Bolts between the parked cars after the lid opens.'},
 {name:'Dashgeist',color:'#80b9ff',pitch:530,habitat:'The narrow east lane',nature:'Impatient courier',tip:'Vacuum during its look-back pauses.',behavior:'Dashes through the alley and pauses to look back.'},
 {name:'Cluttergeist',color:'#ffac72',pitch:230,habitat:'Spare crates at the loading bay',nature:'Mischievous collector',tip:'Sidestep the flying scraps and keep the beam on its face.',behavior:'Tosses harmless junk toward the hunter.'},
 {name:'Snoozeboo',color:'#c9aeed',pitch:160,habitat:'Benches beneath the lamps',nature:'A remarkably light sleeper',tip:'Get close before switching on your reveal light.',behavior:'Wakes slowly, then floats back toward its bench.'},
 {name:'Peekaboo Pair',color:'#e9cd76',pitch:640,habitat:'The double arch',nature:'A practiced impersonator',tip:'The original gives the strongest detector pulse.',behavior:'A pale double copies the original a few steps away.'}];
const routes=[
 ['After Closing',[0]],['Express Lane',[1]],['Paper Chase',[2,0]],['Sleeping District',[3,1]],['Echo Courtyard',[4,2]],['Long Night',[0,4,3,1,2]]
].map(([name,order],i)=>({id:'hunt-'+(i+1),name,order}));
const lairs=[[-4,3],[0,7],[4,4],[-6,7],[5,8]];
function hunt(route,seed=0){const order=route?.order||[seed%5,(seed+2)%5,(seed+4)%5];return{order:order.slice(),index:0,seed,elapsed:0,huntTime:0,stage:'search',tool:0,reveal:0,capture:0,loss:0,breaks:0,age:0,contact:false,shots:[],throwTime:1.2,phase:0,lastPulse:0,found:[],finished:false};}
function position(s,double=false){const type=s.order[s.index],l=lairs[(type+(s.seed%3))%lairs.length],t=s.age;
  let x=l[0],z=l[1],y=type===3?.95:1.2;if(s.stage==='chase'){
    const speed=[1.35,2.1,.62,.66,.9][type],a=t*speed;
    if(type===1){const segment=Math.floor(a/3)%4,travel=Math.min(1,(a%3)/1.65),path=[[0,0],[3,0],[3,3],[0,3]],u=path[segment],v=path[(segment+1)%4];x+=u[0]+(v[0]-u[0])*travel;z+=u[1]+(v[1]-u[1])*travel;}
    else {x+=Math.sin(a)*(type===0?2.3:1.2);z+=(1-Math.cos(a))*(type===0?1.05:.6);}
    y+=Math.sin(a*2)*.24+.4;}
  if(double){x+=2.1;z-=.75;}return{x,y,z};}
function reading(p,q){const dx=q.x-p.x,dy=q.y-1.5,dz=q.z-p.z,d=Math.max(.01,Math.hypot(dx,dy,dz)),angle=(dx*Math.sin(p.yaw)*Math.cos(p.pitch)+dz*Math.cos(p.yaw)*Math.cos(p.pitch)+dy*Math.sin(p.pitch))/d;
  return{d,angle,strength:P.clamp(1-d/21,0,1)*(.35+.65*Math.max(0,angle))};}
function step(s,p,held,dt){if(s.finished)return;const type=s.order[s.index],q=position(s),read=reading(p,q);s.elapsed+=dt;s.huntTime+=dt;s.age+=dt;
  if(s.stage==='search'){s.reveal=P.clamp(s.reveal+((held&&s.tool===1&&read.d<7.3&&read.angle>.956)?dt:-dt*.55),0,1.3);
    if(s.reveal>=1.29){s.stage='chase';s.age=0;}}
  else if(s.stage==='chase'){const valid=held&&s.tool===2&&read.d<7.2&&read.angle>.945;
    if(valid){s.capture+=dt*.48;s.loss=0;s.contact=true;}
    else{if(s.contact){s.breaks++;s.contact=false;}s.loss+=dt;s.capture=Math.max(0,s.capture-dt*(s.loss>.75?.16:.035));}
    if(s.loss>3&&s.capture>0){s.capture=0;s.age=0;s.loss=0;}
    if(type===2){s.throwTime-=dt;if(s.throwTime<=0){const angle=Math.atan2(p.x-q.x,p.z-q.z);s.shots.push({x:q.x,y:q.y,z:q.z,vx:Math.sin(angle)*3.1,vz:Math.cos(angle)*3.1,age:0});s.throwTime=1.8;}}
    if(s.capture>=1){const event={type,seconds:s.huntTime,perfect:s.breaks===0};s.found.push(event);s.index++;s.huntTime=s.age=s.reveal=s.capture=s.loss=s.breaks=0;s.contact=false;s.stage='search';s.shots=[];s.finished=s.index===s.order.length;return event;}}
  for(const v of s.shots){v.age+=dt;v.x+=v.vx*dt;v.z+=v.vz*dt;v.y=1.4+.5*Math.sin(v.age*3);if(v.age<2.7&&P.dist(v,p)<.37){s.capture=Math.max(0,s.capture-.09);v.age=4;}}
  s.shots=s.shots.filter(o=>o.age<3);
}
function create(g){let selected=routes[0],s=hunt(selected),held=false,book=false,pulse=0,ghostType=-1,ghost=null,echo=null,ringTime=0,ambient=0;
  const T=g.T;g.data.book||={};g.box(0,-.12,0,32,.24,32,'#404b57');
  const walls=[[-8,4,3.8,12],[9,6,3.4,9],[0,12,13,2]];for(const [x,z,w,d]of walls){g.box(x,2.1,z,w,4.2,d,'#685965');g.solid.push({x,z,w,d});for(let i=0;i<3;i++)g.box(x-w*.25+i*w*.25,2.7,z-d/2-.035,.46,.7,.08,'#edc77a');}
  g.sign('WATER STREET  ·  GOODS IN',0,3.8,10.75);const lids=[];
  for(const x of[-5.3,-4,-2.7]){g.box(x,.44,3,1,.86,1,'#436259');lids.push(g.box(x,.91,3,1.08,.12,1.08,'#728b77'));}
  g.box(-6,.48,7,2.2,.25,.7,'#987251');g.box(-6,.88,7.36,2.2,.8,.11,'#987251');
  for(const x of[-2.8,2.1]){g.box(x,.56,6.5,1.5,.9,3,'#637b89');g.box(x,1.15,6.5,1.25,.5,1.5,'#687a7a');}
  for(const x of[-6.8,6.8]){g.box(x,1.5,-2,.1,3,.1,'#4d4544');g.ball(x,3.04,-2,.21,'#ffe288',g.scene,{emissive:0xb79b49});}
  function figure(type,copy){const c=types[type].color,group=new T.Group();g.scene.add(group);const opts=copy?{transparent:true,opacity:.33,depthWrite:false}:{emissive:new T.Color(c).multiplyScalar(.18)};
    const size=[.49,.34,.56,.58,.43][type],body=g.ball(0,0,0,size,c,group,opts);body.scale.set(1,type===1?1.55:type===3?.78:1,1);
    for(const side of[-1,1]){const eye=g.ball(side*.16,.10,-size*.85,.091,'#252c49',group);eye.scale.y=type===3?.25:1.4;
      const arm=g.ball(side*size*.94,-.07,0,.15,c,group,opts);arm.scale.x=type===2?2:.9;}
    for(let i=0;i<(type===0?3:5);i++)g.ball((i-2)*.14,-size*.72,0,.13,c,group,opts);
    const mouth=g.ball(0,-.105,-size*.89,.061,'#542746',group);mouth.scale.x=1.6;
    if(type===2)for(let i=0;i<3;i++){const box=g.box((i-1)*.31,.42,0,.24,.19,.23,'#b19169',group);box.rotation.z=.22*(i-1);}
    if(type===1){const cone=g.mesh('cone',[.19,.55,7],c,group,opts);cone.rotation.z=.8;cone.position.set(-.12,.55,0);}
    if(type===3){const hat=g.mesh('cone',[.37,.46,14],'#637790',group);hat.position.y=.47;hat.rotation.z=.33;}
    return group;}
  const trail=Array.from({length:5},()=>g.ball(0,0,0,.13,'#6c96e4',g.scene,{transparent:true,opacity:.42}));
  const scraps=Array.from({length:4},()=>g.box(0,0,0,.14,.17,.14,'#d1b58c'));
  const ray=g.mesh('cylinder',[.035,.12,1,10],'#aeedbf',g.scene,{transparent:true,opacity:.55});ray.visible=false;
  g.scene.add(g.camera);const kit=new T.Group();kit.position.set(.29,-.27,-.47);g.camera.add(kit);
  g.box(0,0,0,.22,.15,.33,'#43535e',kit);g.box(0,.085,0,.18,.02,.19,'#8cd9a7',kit);const tube=g.mesh('cylinder',[.085,.085,.21,10],'#9aa9ae',kit);tube.rotation.x=Math.PI/2;tube.position.z=-.18;
  function panel(){g.panel(book?'Field journal':'Night dispatch');if(book){for(let i=0;i<types.length;i++){const t=types[i],r=g.data.book[i];g.para(r?t.name+' · '+r.count+' catches · best '+r.best.toFixed(1)+' s. '+t.nature+'. '+t.behavior+' '+t.tip:'Unknown silhouette · '+t.habitat+'.');}g.button('Return to hunt',()=>{book=false;panel();});return;}
    g.select('Night route',[...routes.map(r=>[r.id,r.name]),['ambient','Roaming encounters']],selected?.id||'ambient',id=>{selected=routes.find(r=>r.id===id);restart();});
    g.para('WASD and drag to search. 1 detector, 2 reveal light, 3 vacuum. Hold Space on target. A continuous vacuum beam fills the trap in just over two seconds.');
    g.button('Detector',()=>s.tool=0);g.button('Reveal light',()=>s.tool=1);g.button('Capture vacuum',()=>s.tool=2);g.button('Collection book',()=>{book=true;panel();});
    g.button('Restart hunt',restart);const old=g.data.records?.[selected?.id];if(old)g.para('Fastest route '+old.score.toFixed(1)+' s.');}
  function restart(){ambient++;s=hunt(selected,selected?0:ambient%5);g.player.x=0;g.player.z=-4;g.yaw=0;g.pitch=0;ghostType=-1;book=false;held=false;panel();}
  function input(id,on){if(id==='use'){held=on;return;}if(!on)return;if(id==='tool')s.tool=(s.tool+1)%3;else if(id==='book'){book=!book;panel();}else if(['detector','light','vacuum'].includes(id))s.tool=['detector','light','vacuum'].indexOf(id);}
  restart();return{input,clear(){held=false;},step(dt){if(!book)g.move(dt,3.7,13);g.follow();if(book||s.finished){g.hud(book?'Field journal':('Night complete · '+s.found.length+' captures'));ray.visible=false;return;}
    const p={...g.player,yaw:g.yaw,pitch:g.pitch},read=reading(p,position(s)),type=s.order[s.index];if(type!==ghostType){ghost?.removeFromParent();echo?.removeFromParent();ghost=figure(type,false);echo=type===4?figure(type,true):null;ghostType=type;}
    const q=position(s),reveal=s.stage==='chase';ghost.position.set(q.x,q.y,q.z);ghost.visible=reveal;ghost.rotation.y=Math.atan2(g.player.x-q.x,g.player.z-q.z)+Math.PI;
    ghost.scale.set(1-s.capture*.26,1+s.capture*.65,1-s.capture*.22);if(echo){const d=position(s,true);echo.position.set(d.x,d.y,d.z);echo.visible=reveal;}
    lids.forEach((m,i)=>m.rotation.z=type===0&&i===1&&!reveal?Math.sin(s.age*13)*.075:0);
    trail.forEach((m,i)=>{m.visible=type===1&&reveal;if(m.visible){const a=position({...s,age:Math.max(0,s.age-(i+1)*.1)});m.position.set(a.x,a.y,a.z);}});
    scraps.forEach((m,i)=>{m.visible=!!s.shots[i];if(m.visible){const a=s.shots[i];m.position.set(a.x,a.y,a.z);m.rotation.z=a.age*5;}});
    ray.visible=held&&s.tool>0&&read.angle>.94&&read.d<7.3;if(ray.visible){const a=kit.getWorldPosition(new T.Vector3()),b=new T.Vector3(q.x,q.y,q.z),delta=b.sub(a);ray.position.copy(a).addScaledVector(delta,.5);ray.scale.y=delta.length();ray.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());}
    pulse-=dt;if(s.tool===0&&pulse<=0){const near=read.strength;g.tone(types[type].pitch+200*near,.055,'sine');pulse=1.2-near*1.03;}
    const caught=step(s,p,held,dt);if(caught){const old=g.data.book[caught.type];g.data.book[caught.type]={count:(old?.count||0)+1,best:Math.min(old?.best??Infinity,caught.seconds),unbroken:(old?.unbroken||0)+(caught.perfect?1:0)};g.save();g.note(types[caught.type].name+' captured'+(caught.perfect?' with an unbroken beam!':'.'));g.tone(760,.2);
      if(s.finished){if(selected)g.record(selected.id,{score:s.elapsed,perfect:s.found.every(f=>f.perfect)});g.data.nights||=0;g.data.nights++;if(new Set(s.found.map(f=>f.type)).size>=3)g.data.threeTypeNight=true;g.save();panel();}}
    g.hud(['Detector','Reveal light','Capture vacuum'][s.tool]+' · Signal '+Math.round(read.strength*100)+'%\n'+(s.stage==='search'?'Find the disturbed prop · Reveal '+Math.floor(s.reveal/1.3*100)+'%':'Track the moving ghost · Capture '+Math.floor(s.capture*100)+'%'));}};}
P.register({id:'CITY-12',name:'Ghost Hunter Kit',launch:'Start a night hunt',description:'Search a harbor alley, reveal five ghost species, and track them into your capture vacuum across six routes.',
 keys:{Digit1:'detector',Digit2:'light',Digit3:'vacuum',Space:'use',KeyJ:'book'},buttons:[['tool','Switch tool'],['use','Use tool',true],['book','Journal']],create,sky:'#283341'});
if(typeof module==='object')module.exports={types,routes,hunt,position,reading,step};
})(typeof globalThis==='undefined'?window:globalThis);
