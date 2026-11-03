/* Rolling sphere motion, airborne inertia and touchdown judging. */
(function(root){'use strict';const P=root.PlatdoPark||(typeof require==='function'&&require('./premium-park-runtime.js'));
const courses=[];
for(let n=1;n<=3;n++){courses.push({id:'slalom-'+n,type:'slalom',n,name:'Park Slalom '+n,start:[0,-18],gates:Array.from({length:3+n},(_,i)=>({z:-12+i*5,x:(i%2?1:-1)*(n*.6),w:4.8-n*.3}))});
  courses.push({id:'land-'+n,type:'land',n,name:'Perfect Landing '+n,start:[8,-12],target:{x:8+(n-2)*.7,z:9+n*.7}});
  courses.push({id:'stair-'+n,type:'stairs',n,name:'Stair Bounce '+n,start:[-8,-12],gates:Array.from({length:3+n},(_,i)=>({z:-7+i*4,x:-8+(i%2?.35:-.35)*(n-1),w:4.5-n*.25}))});}
function terrain(x,z){if(x>4.5&&x<11.5){if(z>=-3&&z<=3)return(z+3)*.48;return 0;}
  if(x< -4.9&&x> -11.2){if(z< -8)return 3.4;if(z<12)return Math.max(0,3.4-Math.floor((z+8)/1.9)*.32);return 0;}
  return P.clamp((-z+2)*.16,0,3.3);}
function initial(c){const[x,z]=c?.start||[0,-16];return{x,z,y:terrain(x,z)+1,vx:0,vz:0,vy:0,yaw:0,roll:0,pitch:0,lean:0,spin:0,
  age:0,gate:0,misses:0,ground:true,air:0,hadAir:false,landing:null,hold:0,finished:false,inflated:true,status:'',squash:0,lastSafe:{x,z},course:c};}
function step(s,input,dt){if(!s.inflated||s.finished)return;const c=s.course;s.age+=dt;s.squash*=Math.exp(-dt*6);const sub=Math.max(1,Math.ceil(dt*100)),h=dt/sub;
  for(let j=0;j<sub;j++){
    const prevZ=s.z,prevY=s.y,v=Math.hypot(s.vx,s.vz),fx=Math.sin(input.yaw||0),fz=Math.cos(input.yaw||0);
    const force=s.ground?7.4:1.1,drag=s.ground?(input.brake?3.45:.32):.06,ax=(fx*input.forward+fz*input.side)*force,az=(fz*input.forward-fx*input.side)*force;
    if(s.ground){const gx=P.clamp((terrain(s.x+.2,s.z)-terrain(s.x-.2,s.z))/.4,-.9,.9),gz=P.clamp((terrain(s.x,s.z+.2)-terrain(s.x,s.z-.2))/.4,-.9,.9);
      s.vx-=gx*9.1*h;s.vz-=gz*9.1*h;}
    s.vx=(s.vx+ax*h)*Math.exp(-drag*h);s.vz=(s.vz+az*h)*Math.exp(-drag*h);const lim=Math.max(1,Math.hypot(s.vx,s.vz)/17);s.vx/=lim;s.vz/=lim;
    s.x+=s.vx*h;s.z+=s.vz*h;s.vy-=12*h;s.y+=s.vy*h;
    for(const a of ['x','z']){const bound=a==='x'?15:23;if(Math.abs(s[a])>bound){s[a]=Math.sign(s[a])*bound;s['v'+a]*=-.63;s.squash=.23;}}
    const floor=terrain(s.x,s.z)+1;
    if(s.y<=floor+.006){const impact=Math.max(0,-s.vy);s.y=floor;
      if(!s.ground&&s.air>.07&&impact>2.7){s.squash=Math.min(.35,impact*.032);s.spin+=Math.sign(s.vz||1)*impact*.16;
        if(c?.type==='land'&&!s.landing&&s.hadAir&&s.z>3)s.landing={x:s.x,z:s.z,error:Math.hypot(s.x-c.target.x,s.z-c.target.z)};}
      const climb=P.clamp((floor-prevY)/h,-6,7.4);s.vy=(!s.ground&&impact>3.8)?impact*.27:Math.max(0,climb);
      s.ground=s.vy<1||climb>0;s.air=0;
      if(Math.abs(s.vx)+Math.abs(s.vz)<4)s.lastSafe={x:s.x,z:s.z};
    }else{s.ground=false;s.air+=h;if(s.air>.17)s.hadAir=true;}
    s.roll+=Math.hypot(s.vx,s.vz)*h;s.pitch+=s.spin*h;s.spin*=Math.exp(-h*(s.ground?4:.5));s.lean+=(P.clamp((input.brake?v*.075:-input.forward*.24),-.5,.65)-s.lean)*(1-Math.exp(-h*5));
    if(c?.gates){const gate=c.gates[s.gate];if(gate&&prevZ<=gate.z&&s.z>gate.z){if(Math.abs(s.x-gate.x)>gate.w/2){s.misses++;s.status='Missed gate · +3 s';}else s.status='Gate cleared';s.gate++;if(s.gate===c.gates.length)s.finished=true;}}
    if(c?.type==='land'&&s.landing){s.hold+=h;if(s.hold>=1.5){s.control=Math.hypot(s.x-c.target.x,s.z-c.target.z)<2.5;s.finished=true;}}
  }}
function create(g){const T=g.T;let c=null,s=initial(null),brake=false,recorded=false,markers=[];g.box(0,-.25,0,32,.49,48,'#82994d');
  const geo=new T.BufferGeometry(),verts=[],inds=[];
  for(let j=0;j<=184;j++)for(let i=0;i<=64;i++){const x=-16+i*.5,z=-23+j*.25;verts.push(x,terrain(x,z)-.01,z);if(i&&j){const n=j*65+i;inds.push(n-66,n-1,n,n-66,n,n-65);}}
  geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(inds);geo.computeVertexNormals();
  const mat=new T.MeshStandardMaterial({color:'#86a665',side:T.DoubleSide,roughness:1}),hill=new T.Mesh(geo,mat);g.scene.add(hill);
  for(const x of[-15,15])g.box(x,.55,0,.4,1.1,46,'#829190');
  for(const z of[-23,23])g.box(0,.55,z,30,1.1,.4,'#829190');
  for(let i=0;i<10;i++)g.box(-8,terrain(-8,-6.2+i*1.9)-.07,-6.2+i*1.9,5.5,.12,.23,'#c3b499');
  g.sign('LAUNCH LAWN',8,2,-7);g.sign('THE LONG STEPS',-8,5,-11);
  const sphere=new T.Group(),rider=new T.Group();g.scene.add(sphere,rider);
  const skin=g.ball(0,0,0,1,'#a9e7ed',sphere,{transparent:true,opacity:.21,metalness:.23,roughness:.16,depthWrite:false,side:T.DoubleSide});
  for(let i=0;i<3;i++){const band=g.mesh('ring',[1.002,.012,6,64],'#8abec6',sphere);band.rotation.set(i===1?Math.PI/2:0,i===2?Math.PI/2:0,0);}
  const person=T.Group&&root.CityPeopleModels&&root.CityPeople?.presets?.[0]?root.CityPeopleModels.create(root.PlatdoCity?.sim?.player?.appearance||root.CityPeople.presets[0],{lod:0,modelDetail:3}):null;
  if(person){person.scale.setScalar(.8);person.position.y=-.73;rider.add(person);}
  else{g.ball(0,.3,0,.18,'#ba896a',rider);g.box(0,-.02,0,.35,.42,.24,'#c8813b',rider);for(const side of[-1,1]){g.box(side*.12,-.43,0,.15,.4,.17,'#384e65',rider);g.box(side*.25,-.02,0,.1,.35,.13,'#b99879',rider);}}
  function start(id){c=courses.find(q=>q.id===id)||null;s=initial(c);recorded=false;brake=false;g.yaw=0;for(const m of markers)m.removeFromParent();markers=[];
    for(const [i,gate]of(c?.gates||[]).entries()){for(const sign of[-1,1])markers.push(g.box(gate.x+sign*gate.w/2,terrain(gate.x,gate.z)+1,gate.z,.16,2,.16,sign>0?'#f8d268':'#4eacb6'));markers.push(g.sign(String(i+1),gate.x,terrain(gate.x,gate.z)+2.65,gate.z,.36));}
    if(c?.target){for(const radius of[1,2,3]){const m=g.mesh('ring',[radius,.055,6,60],radius===1?'#ec9b42':'#fff1a1');m.rotation.x=-Math.PI/2;m.position.set(c.target.x,.08,c.target.z);markers.push(m);}}
    panel();}
  function panel(){g.panel('Hillside rolling park');g.select('Course',[['free','Free rolling'],...courses.map(c=>[c.id,c.name])],c?.id||'free',start);
    g.para('WASD to roll. Drag to look. Space slows the ball. R recovers, E deflates or reinflates. High-speed turns need more room.');
    g.para(c?.type==='land'?'Launch from the marked ramp. First touchdown sets your ring score. Staying on target adds 15 control points.':c?'Cross numbered gates in order. Passing outside a gate adds three seconds.':'Try the hill, the stairs on the left, and the launch ramp on the right.');
    g.button('Recover ball',()=>input('recover',true));g.button(s.inflated?'Deflate':'Inflate',()=>input('inflate',true));g.button('Restart layout',()=>start(c?.id));
    const r=g.data.records?.[c?.id];if(r)g.para('Personal best '+r.score.toFixed(1)+(c.type==='land'?' points':' seconds')+' · '+r.medal);}
  function input(id,on){if(id==='brake'){brake=on;return;}if(!on)return;if(id==='recover'){const pos=s.lastSafe;Object.assign(s,{x:pos.x,z:pos.z,y:terrain(pos.x,pos.z)+1,vx:0,vy:0,vz:0,ground:true,air:0,pitch:0,spin:0,inflated:true});}
    if(id==='inflate'){if(s.inflated&&(!s.ground||Math.hypot(s.vx,s.vz)>2.5||Math.abs(s.x)>14.6||Math.abs(s.z)>22.6)){g.note('Stop on clear ground before deflating, or use Recover.');return;}s.inflated=!s.inflated;g.note(s.inflated?'Ball inflated.':'Standing safely outside the ball.');}panel();}
  start(null);return{input,clear(){brake=false;},dispose(){geo.dispose();mat.dispose();if(person)root.CityPeopleModels.dispose(person);},step(dt){
    const f=(g.keys.has('KeyW')?1:0)-(g.keys.has('KeyS')?1:0)-g.axes.z,side=(g.keys.has('KeyD')?1:0)-(g.keys.has('KeyA')?1:0)+g.axes.x;
    step(s,{forward:f,side:-side,yaw:g.yaw,brake},dt);sphere.visible=s.inflated;sphere.position.set(s.x,s.y,s.z);sphere.scale.set(1+s.squash*.5,1-s.squash,1+s.squash*.5);sphere.rotation.set(s.roll,0,s.roll*.24);
    rider.position.copy(sphere.position);rider.rotation.set(s.lean+s.pitch,g.yaw,-side*.15);g.player={x:s.x,y:s.y,z:s.z};g.follow(1,5.4);
    if(s.finished&&!recorded){recorded=true;let score,medal;if(c.type==='land'){score=Math.max(0,100-s.landing.error*12)+(s.control?15:0);medal=score>90?'Gold':score>60?'Silver':'Bronze';}else{score=s.age+s.misses*3;medal=!s.misses&&score<20?'Gold':s.misses<2?'Silver':'Bronze';}
      g.record(c.id,{score,medal},c.type==='land'?'high':'low');g.note(medal+' · '+score.toFixed(1)+(c.type==='land'?' points':' seconds'));panel();}
    g.hud((c?.name||'Free roll')+' · '+Math.hypot(s.vx,s.vz).toFixed(1)+' m/s\n'+(s.finished?'Finished':c?.gates?'Gate '+Math.min(s.gate+1,c.gates.length)+' / '+c.gates.length+' · '+s.misses+' misses':s.ground?'On ground':'Airborne')+(s.status?' · '+s.status:''));}};}
P.register({id:'CITY-14',name:'Bubble Ball',launch:'Roll into the park',description:'Roll a transparent sphere down hills, across the stairs, through slaloms and off a launch ramp.',
 keys:{Space:'brake',KeyR:'recover',KeyE:'inflate'},buttons:[['brake','Brake',true],['recover','Recover'],['inflate','Inflate / Deflate']],create});
if(typeof module==='object')module.exports={courses,terrain,initial,step};})(typeof globalThis==='undefined'?window:globalThis);
