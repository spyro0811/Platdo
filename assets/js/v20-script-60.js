/* Gravity yard: bounded loose-body dynamics use the same solver for held props and challenges. */
(function(root){'use strict';
const P=root.PlatdoPark||(typeof require==='function'&&require('./premium-park-runtime.js'));
const kinds={
  basketball:['ball',.28,.63,'#d47a34',.75],football:['ball',.25,.42,'#925630',.48],beachball:['ball',.40,.24,'#e8c15d',.80],
  crate:['box',.53,8,'#96633e',.09],carton:['box',.39,2.4,'#c99d69',.08],cone:['cone',.27,1.3,'#ee733a',.18],
  sign:['box',.35,3,'#d7a74a',.10],tire:['ring',.35,4,'#303b39',.32],bin:['cylinder',.4,3,'#427c71',.13],
  barrel:['cylinder',.46,6,'#aa6950',.15],rock:['ball',.22,4,'#788185',.16]};
const families=['Dumpster Dunk','Junk Tower','Roof Balancer','Trick Shot'];
const challenges=families.flatMap((name,f)=>Array.from({length:3},(_,i)=>({id:f+'-'+i,name:name+' '+(i+1),family:f,rank:i+1})));
function prop(type,x,z,serial,y=kinds[type][1]){return {type,x,y,z,id:serial,r:kinds[type][1],mass:kinds[type][2],bounce:kinds[type][4],
  vx:0,vy:0,vz:0,rx:0,ry:0,rz:0,spin:0,held:false,lastHit:null};}
function yard(challenge=null){
  const rank=challenge?.rank||1,bin={x:rank===1?0:rank===2?3.5:-3,z:5+rank*1.4};
  const solids=[{x:-5,y:.65,z:1,w:.22,h:1.3,d:7,kind:'fence'},{x:5,y:.75,z:3,w:2,h:1.5,d:3.7,kind:'car'},
    {x:-4,y:.25,z:6,w:2.3,h:.5,d:.7,kind:'bench'},{x:bin.x-1.6,y:.62,z:bin.z,w:.14,h:1.24,d:3.2,kind:'bin'},
    {x:bin.x+1.6,y:.62,z:bin.z,w:.14,h:1.24,d:3.2,kind:'bin'},{x:bin.x,y:.62,z:bin.z-1.6,w:3.2,h:1.24,d:.14,kind:'bin'},
    {x:bin.x,y:.62,z:bin.z+1.6,w:3.2,h:1.24,d:.14,kind:'bin'}];
  const objects=[prop('basketball',0,-2,0),prop('basketball',1.3,-2,1),prop('crate',-1.7,-2,2),prop('crate',-3,-2,3),prop('crate',-4.3,-2,4),
    prop('crate',-4.3,-4,5),...Object.keys(kinds).filter(k=>!['basketball','crate'].includes(k)).map((k,i)=>prop(k,-6+(i%5)*2,-5-Math.floor(i/5)*1.7,6+i))];
  return {challenge,solids,objects,bin,held:null,range:3,height:1.4,charge:0,charging:false,snap:false,elapsed:0,stable:0,complete:false,lastThrow:null};
}
function overlap(a,b){return Math.abs(a.x-b.x)<a.r+b.w/2&&Math.abs(a.z-b.z)<a.r+b.d/2&&Math.abs(a.y-b.y)<a.r+b.h/2;}
function holdTarget(player,state){return{x:player.x+Math.sin(player.yaw)*state.range,y:Math.max(.3,state.height+Math.sin(player.pitch||0)*state.range),z:player.z+Math.cos(player.yaw)*state.range};}
function target(s,p){let best=null,score=.89;for(const o of s.objects){const dx=o.x-p.x,dy=o.y-1.4,dz=o.z-p.z,d=Math.hypot(dx,dy,dz);if(d>12||d<.001)continue;
  const dot=(Math.sin(p.yaw)*Math.cos(p.pitch||0)*dx+Math.sin(p.pitch||0)*dy+Math.cos(p.yaw)*Math.cos(p.pitch||0)*dz)/d;
  const value=dot-.002*d;if(value>score){let clear=true;for(let t=.15;t<d-o.r;t+=.2){const a={x:p.x+dx*t/d,y:1.4+dy*t/d,z:p.z+dz*t/d,r:.02};if(s.solids.some(b=>overlap(a,b))){clear=false;break;}}
    if(clear){best=o;score=value;}}}return best;}
function release(s,p,launch){const o=s.held;if(!o)return;const speed=launch?(4+17*s.charge)/Math.sqrt(.7+o.mass*.25):0;
  o.vx=Math.sin(p.yaw)*Math.cos(p.pitch||0)*speed;o.vz=Math.cos(p.yaw)*Math.cos(p.pitch||0)*speed;o.vy=Math.sin(p.pitch||0)*speed+(launch?2:0);
  o.spin=launch?speed*.16:0;o.held=false;s.lastThrow=launch?o.id:null;s.held=null;s.charge=0;s.charging=false;}
function step(s,player,dt){
  const n=Math.max(1,Math.ceil(dt*100)),h=dt/n;s.elapsed+=dt;if(s.charging)s.charge=Math.min(1,s.charge+dt*.7);
  for(let iter=0;iter<n;iter++){
    for(const o of s.objects){if(o.held){const pos=holdTarget(player,s);for(const a of ['x','y','z'])o['v'+a]=P.clamp((pos[a]-o[a])*10,-8,8);}else{o.vy-=10*h;}
      for(const a of ['x','z','y']){const old=o[a];o[a]+=o['v'+a]*h;for(const b of s.solids){if(!overlap(o,b))continue;o[a]=old;o['v'+a]*=o.held?0:-o.bounce;break;}}
      if(o.y<=o.r){o.y=o.r;if(o.vy<0)o.vy=Math.abs(o.vy)>.75?-o.vy*o.bounce:0;const drag=o.type==='tire'||kinds[o.type][0]==='ball'?1.1:6;o.vx*=Math.exp(-drag*h);o.vz*=Math.exp(-drag*h);}
      for(const a of ['x','z'])if(Math.abs(o[a])>12-o.r){o[a]=Math.sign(o[a])*(12-o.r);o['v'+a]*=-o.bounce;}
      o.rx+=o.spin*h;o.spin*=Math.exp(-h*(o.y<=o.r+.01?1.9:.25));
    }
    for(let i=0;i<s.objects.length;i++)for(let j=i+1;j<s.objects.length;j++){
      const a=s.objects[i],b=s.objects[j],sum=a.r+b.r,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
      const boxy=kinds[a.type][0]==='box'&&kinds[b.type][0]==='box',distance=Math.hypot(dx,dy,dz);
      if(boxy?Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))>=sum:distance>=sum)continue;
      let nx=dx/(distance||1),ny=dy/(distance||1),nz=dz/(distance||1),pen=sum-distance;
      if(boxy){const axis=Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz));nx=Math.abs(dx)===axis?Math.sign(dx):0;ny=!nx&&Math.abs(dy)===axis?Math.sign(dy):0;nz=!nx&&!ny?Math.sign(dz):0;pen=sum-axis;}
      const ia=a.held?0:1/a.mass,ib=b.held?0:1/b.mass,den=ia+ib;if(!den)continue;
      const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny+(b.vz-a.vz)*nz,impulse=Math.max(0,-rel)*(1+Math.min(a.bounce,b.bounce))/den;
      for(const [axis,norm] of [['x',nx],['y',ny],['z',nz]]){a[axis]-=norm*pen*ia/den;b[axis]+=norm*pen*ib/den;a['v'+axis]-=norm*impulse*ia;b['v'+axis]+=norm*impulse*ib;}
      a.y=Math.max(a.y,a.r);b.y=Math.max(b.y,b.r);if(impulse>1.1){a.lastHit=b.id;b.lastHit=a.id;}
    }
  }
  const c=s.challenge;if(!c||s.complete)return;const inBin=o=>Math.abs(o.x-s.bin.x)<1.3&&Math.abs(o.z-s.bin.z)<1.3&&o.y<1.4&&!o.held;
  if(c.family===0)s.complete=s.objects.some(o=>o.type==='basketball'&&inBin(o)&&s.lastThrow===o.id);
  if(c.family===3)s.complete=s.objects.some(o=>inBin(o)&&o.lastHit!==null&&o.lastHit===s.lastThrow&&o.id!==s.lastThrow);
  if(c.family===1||c.family===2){let ok=false;if(c.family===1){const crates=s.objects.filter(o=>o.type==='crate'&&!o.held);
    ok=crates.some(o=>o.y+o.r>=(c.rank+1)*1.06-.18&&crates.filter(b=>Math.abs(b.x-o.x)<.75&&Math.abs(b.z-o.z)<.75&&Math.hypot(b.vx,b.vz)<.15).length>=c.rank+1);}
    else{ok=s.objects.filter(o=>!o.held&&Math.abs(o.x-5)<1.05&&Math.abs(o.z-3)<1.85&&Math.abs(o.y-o.r-1.5)<.18&&Math.hypot(o.vx,o.vz)<.14).length>=c.rank;}
    s.stable=ok?s.stable+dt:0;s.complete=s.stable>=(c.family===1?5:10);}
}
function create(g){let s=yard(),models=[],blocks=[],highlight=null,won=false,selected=null;g.box(0,-.17,0,25,.3,25,'#8a9684');
  const T=g.T;g.scene.add(g.camera);const hand=new T.Group();g.camera.add(hand);hand.position.set(.29,-.26,-.53);
  g.box(0,0,0,.17,.13,.28,'#344656',hand);for(let i=0;i<4;i++)g.box(-.06+i*.04,.025,-.16,.03,.07,.13,'#7bb8b2',hand);
  g.ball(0,.083,0,.045,'#8df5db',hand,{emissive:0x397b70});const beam=g.mesh('cylinder',[.022,.022,1,6],'#94efce');beam.visible=false;
  const guide=Array.from({length:8},()=>g.ball(0,0,0,.043,'#f3c569'));
  const rim=g.mesh('ring',[.46,.021,6,28],'#fff0a0');rim.visible=false;
  const info=['Land a thrown basketball in the dumpster.','Stack '+(s.challenge?.rank||1)+' crates and keep the tower free of the glove for five seconds.','Leave the required props resting on the car for ten seconds.','Launch one prop into another so the second lands in the dumpster.'];
  function rerender(){for(const m of [...models,...blocks])m.removeFromParent();models=[];blocks=[];
    for(const b of s.solids)blocks.push(g.box(b.x,b.y,b.z,b.w,b.h,b.d,b.kind==='car'?'#6b97ab':b.kind==='bin'?'#4c7168':'#8d6c4a'));
    for(const o of s.objects){const[k,r,,color]=kinds[o.type],dims=k==='ball'?[r,18,14]:k==='box'?[r*2,r*2,r*2]:k==='ring'?[r*.70,r*.30,9,20]:k==='cone'?[r,2*r,12]:[r,r,2*r,16];const m=g.mesh(k,dims,color);models.push(m);}
    g.solid=s.solids;g.player.x=0;g.player.z=-7;g.yaw=0;g.pitch=-.14;won=false;selected=null;highlight=null;}
  function reset(v){s=yard(challenges.find(c=>c.id===v)||null);rerender();panel();}
  function panel(){g.panel('Freight yard');g.select('Layout',[['free','Open laboratory'],...challenges.map(c=>[c.id,c.name])],s.challenge?.id||'free',reset);
    g.para(s.challenge?(s.challenge.family===1?'Stack '+(s.challenge.rank+1)+' crates for 5 seconds.':s.challenge.family===2?'Balance '+s.challenge.rank+' props on the car for 10 seconds.':info[s.challenge.family]):'Stack crates, park a ball on the car, or bank a throw into the dumpster.');
    g.para('Walk with WASD, drag to look. E grabs or places. R/F move in or out, T/G lift or lower. Z/X/C rotate around each axis. Q toggles 45° snapping. Hold Space to charge and release.');
    g.button('Reset props',()=>reset(s.challenge?.id));const r=g.data.records?.[s.challenge?.id];if(r)g.para('Best '+r.score.toFixed(1)+' s · '+r.medal);}
  function input(id,on){const p={...g.player,yaw:g.yaw,pitch:g.pitch};
    if(id==='launch'){if(!s.held)return;if(on){s.charging=true;s.charge=0;}else if(s.charging)release(s,p,true);return;}if(!on)return;
    if(id==='grab'){if(s.held)release(s,p,false);else if((selected=target(s,p))){s.held=selected;selected.held=true;s.range=P.clamp(P.dist(p,selected),1,8);s.height=1.4;}}else if(id==='snap')s.snap=!s.snap;
    else if(s.held){if(id==='near'||id==='far')s.range=P.clamp(s.range+(id==='far'?.55:-.55),.7,10);if(id==='up'||id==='down')s.height=P.clamp(s.height+(id==='up'?.45:-.45),.3,7);if(['rx','ry','rz'].includes(id))s.held[id]+=s.snap?Math.PI/4:.2;}}
  rerender();panel();return {input,clear(){if(s.held)release(s,g.player,false);},step(dt){g.move(dt,4,12);g.follow();const p={...g.player,pitch:g.pitch,yaw:g.yaw};step(s,p,dt);highlight=s.held||target(s,p);
    models.forEach((m,i)=>{const o=s.objects[i];m.position.set(o.x,o.y,o.z);m.rotation.set(o.rx,o.ry,o.rz);});rim.visible=!!highlight;if(highlight){rim.position.set(highlight.x,highlight.y,highlight.z);rim.quaternion.copy(g.camera.quaternion);rim.scale.setScalar((highlight.r+.13)/.46);}
    beam.visible=!!s.held;if(s.held){const a=hand.getWorldPosition(new T.Vector3()),b=models[s.objects.indexOf(s.held)].position,delta=b.clone().sub(a);beam.position.copy(a).addScaledVector(delta,.5);beam.scale.y=delta.length();beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());}
    for(let i=0;i<guide.length;i++){const m=guide[i];m.visible=s.charging;if(!m.visible)continue;const t=(i+1)*.085,v=(4+17*s.charge)/Math.sqrt(.7+s.held.mass*.25);m.position.set(s.held.x+Math.sin(g.yaw)*Math.cos(g.pitch)*v*t,s.held.y+(Math.sin(g.pitch)*v+2)*t-5*t*t,s.held.z+Math.cos(g.yaw)*Math.cos(g.pitch)*v*t);}
    g.hud((s.held?'Holding '+s.held.type:highlight?'E · Grab '+highlight.type:'Gravity glove')+(s.charging?' · '+Math.round(s.charge*100)+'%':'')+(s.stable?' · Stable '+s.stable.toFixed(1)+' s':'')+(s.snap?' · Snap 45°':''));
    if(s.complete&&!won){won=true;const medal=s.elapsed<30?'Gold':s.elapsed<65?'Silver':'Bronze';g.record(s.challenge.id,{score:s.elapsed,medal});g.note(s.challenge.name+' complete · '+medal);g.tone(680,.18);panel();}}};}
const spec={id:'CITY-11',name:'Gravity Glove',launch:'Enter gravity yard',description:'Experiment with eleven loose prop types or play twelve gravity-yard challenges.',
  keys:{KeyE:'grab',KeyQ:'snap',KeyR:'near',KeyF:'far',KeyT:'up',KeyG:'down',KeyZ:'rx',KeyX:'ry',KeyC:'rz',Space:'launch'},
  buttons:[['grab','Grab / Place'],['launch','Launch',true],['near','Nearer'],['far','Farther'],['up','Lift'],['down','Lower'],['rx','Pitch'],['ry','Turn'],['rz','Roll'],['snap','Snap']],create};
P.register(spec);if(typeof module==='object')module.exports={yard,step,target,release,challenges,prop,holdTarget};
})(typeof globalThis==='undefined'?window:globalThis);
