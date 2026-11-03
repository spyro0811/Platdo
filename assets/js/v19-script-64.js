/* Six timing and balance games, a shared scorecard, three stages. */
(function(root){'use strict';const P=root.PlatdoPark||(typeof require==='function'&&require('./premium-park-runtime.js'));
const acts=['Juggling','Plate spinning','Yo-yo tricks','Ribbon dance','Mime wall','Comic balance'];
const venues=['Market square','Boardwalk bandstand','Park pavilion'];
const routines=[
 ['First bus',[0,3],0],['Window shopping',[4,2],0],['Teacup finale',[1,0,5],0],
 ['Pier parade',[3,4],1],['High tide',[2,5,0],1],['Lantern matinee',[1,3,2,0],1],
 ['Sunday in the park',[5,4,1],2],['The ribbon relay',[3,2,1,5],2],['Closing night',[0,1,2,3,4,5],2]
].map(([name,order,venue],i)=>({id:'show-'+(i+1),name,order,venue,level:1+Math.floor(i/3)}));
const modes={standard:.24,relaxed:.44};const lanes=['left','center','right'];
function stage(show,timing='standard'){return{show,timing,part:0,cue:0,time:0,points:0,possible:0,chain:0,finished:false,held:null,
  feedback:'Watch the first cue',plates:[.74,.79,.9],balance:0,pressed:new Set(),lead:1.65,lastBeat:0,lastFeedback:0};}
function beat(s){return(1.12-s.show.level*.10);}
function target(s){const kind=s.show.order[s.part],i=s.cue,sequence=[[0,2,1,0,2,1],[0,1,2,1,0,2],[1,1,1,1,1,1],[0,1,2,2,1,0],[0,2,0,1,2,1],[1,1,1,1,1,1]];
  return{act:kind,lane:lanes[sequence[kind][i%6]],at:s.lead+(i+1)*beat(s),requiredHold:kind===2?.36:kind===4?.48:0};}
function resolve(s,quality,feedback){s.possible+=100;s.points+=Math.round(100*quality);s.chain=quality>=.52?s.chain+1:0;s.feedback=feedback;s.lastFeedback=s.time;s.held=null;s.cue++;
  if(s.cue>=6){s.part++;s.cue=0;s.time=0;s.lead=1.45;s.plates=[.8,.85,.9];s.balance=0;s.pressed.clear();s.lastFeedback=0;if(s.part>=s.show.order.length)s.finished=true;}}
function input(s,id,on){if(s.finished)return;if(on)s.pressed.add(id);else s.pressed.delete(id);const cue=target(s),a=cue.act,window=modes[s.timing]||modes.standard;
  if(a===5){if(on&&(id==='left'||id==='right'))s.balance+=id==='left'?-.24:.24;return;}
  if(a===1){if(on&&lanes.includes(id)){const i=lanes.indexOf(id);s.plates[i]=Math.min(1,s.plates[i]+.48);}return;}
  if(id!==cue.lane)return;const diff=Math.abs(s.time-cue.at);
  if(cue.requiredHold){if(on&&diff<=window){s.held={since:s.time,id};s.feedback=a===2?'Yo-yo down · release on the return':'Palm against the wall · hold still';}
    if(!on&&s.held?.id===id){const err=Math.abs(s.time-s.held.since-cue.requiredHold);resolve(s,P.clamp(1-err/(window*1.3),0,1),err<=window?'Clean release':'Missed the release');}return;}
  if(on&&diff<=window)resolve(s,P.clamp(1-diff/(window*1.5),0,1),a===0?'Caught!':'Ribbon in time');}
function step(s,dt){if(s.finished)return;s.time+=dt;const cue=target(s),a=cue.act,w=modes[s.timing]||modes.standard;
  if(a===1){s.plates=s.plates.map((v,i)=>P.clamp(v-dt*(.09+s.show.level*.025+i*.009),0,1));
    if(s.time>=cue.at){const health=Math.min(...s.plates);resolve(s,P.clamp(health*1.65,0,1),health>.25?'All plates spinning':'A plate wobbled off');}return;}
  if(a===5){s.balance+=dt*(.34*Math.sin(s.time*2.3)+.20*Math.cos(s.time*1.22)+s.balance*.28);s.balance=P.clamp(s.balance,-1.45,1.45);
    if(s.time>=cue.at){const abs=Math.abs(s.balance);resolve(s,P.clamp(1-abs*.71,0,1),abs<.6?'Balanced':'Nearly toppled');}return;}
  if(s.time>cue.at+w+cue.requiredHold+(s.held?.1:0))resolve(s,0,a===0?'Dropped a ball':a===3?'Missed the turn':'Missed the hold');}
function create(g){let selected=routines[0],timing=g.data.timing==='relaxed'?'relaxed':'standard',s=stage(selected,timing),running=false,recorded=false,decor=[],aud=[],mode='',props=[];
  const T=g.T;g.box(0,-.28,0,32,.55,27,'#88a183');g.box(0,.15,0,8,.35,5,'#967554');g.box(0,.38,0,7.8,.13,4.85,'#be955d');
  const person=root.CityPeopleModels&&root.CityPeople?.presets?.[0]?root.CityPeopleModels.create(root.CityPeople.presets[0],{lod:0,modelDetail:3}):new T.Group();
  g.scene.add(person);person.position.set(0,.45,0);if(!person.children.length){g.ball(0,1.55,0,.23,'#b88362',person);g.box(0,.95,0,.48,.65,.27,'#468c90',person);for(const x of[-.14,.14])g.box(x,.4,0,.17,.65,.22,'#31475a',person);}
  function location(){for(const o of decor)o.removeFromParent();decor=[];const colors=[['#bf806a','#668e96'],['#7199a7','#d4a967'],['#86a178','#d9bb8e']][selected.venue];
    for(let i=0;i<9;i++){const x=-12+i*3;if(selected.venue===2){const tree=g.mesh('cone',[1.1,3,9],colors[0]);tree.position.set(x,1.5,8+i%2);decor.push(tree);}else{decor.push(g.box(x,2,8.6,2.8,4,2.2,colors[i%2]));for(const side of[-1,1])decor.push(g.box(x+side*.6,2.4,7.46,.55,.82,.07,'#516c74'));}}
    decor.push(g.sign(venues[selected.venue].toUpperCase(),0,3.7,4.5));}
  for(let i=0;i<8;i++){const group=new T.Group();g.scene.add(group);const x=(i%4-1.5)*1.2,z=-3.6-Math.floor(i/4)*1.1;group.position.set(x,0,z);
    g.ball(0,1.42,0,.18,['#ad8568','#c69c74','#916952'][i%3],group);g.box(0,.96,0,.39,.51,.28,['#435970','#a46c58','#809266'][i%3],group);
    for(const side of[-1,1])g.box(side*.1,.44,0,.16,.62,.18,'#414e59',group);aud.push(group);}
  function showAct(kind){if(mode===kind)return;mode=kind;for(const p of props)p.removeFromParent();props=[];
    if(kind===0)for(let i=0;i<3;i++)props.push(g.ball(0,2,0,.11,['#e67352','#f0c467','#5993ad'][i]));
    if(kind===1)for(let i=0;i<3;i++){const stick=g.box(i-.95,1.03,-.55,.04,1.14,.04,'#84694b');const plate=g.mesh('cylinder',[.28,.21,.048,20],['#e3bc69','#b7d9d1','#cf8a6b'][i]);plate.position.set(i-.95,1.64,-.55);props.push(stick,plate);}
    if(kind===2){props.push(g.box(.39,1.45,-.28,.018,1,.018,'#eee1b7'));const yoyo=g.mesh('cylinder',[.13,.13,.16,18],'#e04755');yoyo.rotation.x=Math.PI/2;props.push(yoyo);}
    if(kind===3)for(let i=0;i<16;i++)props.push(g.ball(0,0,0,.062,['#eaaa72','#dc7596','#b198d4','#74b0b7'][Math.floor(i/4)]));
    if(kind===4){const wall=g.mesh('box',[1.6,1.3,.04],'#84bec5',g.scene,{transparent:true,opacity:.17});wall.position.set(0,1.5,-.5);props.push(wall);}
    if(kind===5){props.push(g.box(0,.47,0,2,.12,.35,'#a56a45'));const roll=g.mesh('cylinder',[.18,.18,.5,16],'#639db3');roll.rotation.x=Math.PI/2;roll.position.set(0,.58,0);props.push(roll);}}
  function restart(){s=stage(selected,timing);running=true;recorded=false;mode='';g.note('Ready · watch the upcoming cues.');panel();}
  function panel(){g.panel('Street Performer Studio');g.select('Routine',[...routines.map(r=>[r.id,r.name]),...acts.map((a,i)=>['practice-'+i,'Practice · '+a])],selected.id,id=>{
      selected=routines.find(r=>r.id===id)||{id,name:acts[Number(id.slice(9))]+' practice',level:1,venue:selected.venue,order:[Number(id.slice(9))]};running=false;s=stage(selected,timing);location();panel();});
    g.select('Timing conditions',[['standard','Standard window'],['relaxed','Relaxed window']],timing,v=>{timing=v;g.data.timing=v;g.save();s=stage(selected,timing);running=false;panel();});
    g.para(venues[selected.venue]+' · '+selected.order.map(i=>acts[i]).join(' → '));g.para('Use J / K / L for left, center and right. Catch on the beat, keep weak plates spinning, hold and release the yo-yo or mime pose, or correct your balance. Each timing mode has its own record.');
    g.button(running?'Restart routine':'Start routine',restart);const old=g.data.records?.[selected.id+'/'+timing];if(old)g.para('Best '+old.score+'% · '+old.medal);}
  location();panel();return{input(id,on){if(id==='start'&&on){restart();return;}if(running)input(s,id,on);},clear(){s.pressed.clear();s.held=null;},dispose(){if(person.userData.rig)root.CityPeopleModels.dispose(person);},step(dt){if(running)step(s,dt);
    if(s.finished&&!recorded){recorded=true;running=false;const score=Math.round(100*s.points/s.possible),medal=score>=88?'Gold':score>=65?'Silver':'Bronze';g.record(selected.id+'/'+timing,{score,medal},'high');g.data.completed||={};g.data.completed[selected.id]=true;g.save();g.note(medal+' · '+score+'% · '+timing+' timing');g.tone(740,.19);panel();}
    const cue=s.finished?null:target(s),kind=cue?.act??selected.order[0];showAct(kind);const clock=s.time;person.rotation.z=kind===5?s.balance*.34:Math.sin(clock*1.9)*.035;
    if(person.userData.rig){root.CityPeopleModels.animate(person,{mode:'idle',speed:0},clock,dt);const rig=person.userData.rig;if(rig.armL&&rig.armR){rig.armL.rotation.x=-.45-.55*Math.abs(Math.sin(clock*(kind===0?3:1.9)));rig.armR.rotation.x=-.48-.60*Math.abs(Math.cos(clock*(kind===0?3:1.9)));}}
    if(kind===0)props.forEach((p,i)=>{const a=clock*3+i*2.09;p.position.set(Math.sin(a)*.57,1.55+Math.abs(Math.cos(a))*.94,-.24);});
    if(kind===1)for(let i=0;i<3;i++)props[i*2+1].rotation.z=Math.sin(clock*7+i)*(1-s.plates[i])*.7;
    if(kind===2){const d=s.held?Math.min(1,(clock-s.held.since)*3):.13+.12*Math.sin(clock*4);props[0].position.set(.39,1.68-d*.49,-.28);props[0].scale.y=d;props[1].position.set(.39,1.66-d,-.28);}
    if(kind===3)props.forEach((p,i)=>p.position.set(.20+.056*i,1.51+Math.sin(clock*5-i*.52)*(.10+i*.018),-.3+Math.cos(clock*4-i*.29)*.22));
    if(kind===4)props[0].rotation.y=.17*Math.sin(clock*2);if(kind===5)props[0].rotation.z=s.balance*.24;
    aud.forEach((o,i)=>{o.position.y=running&&s.chain>1?Math.abs(Math.sin(clock*4+i))*.14:0;o.rotation.z=(100*s.points/(s.possible||100)<45?.08:.025)*Math.sin(clock*2+i);});
    g.camera.position.set(3.3,3.1,-5.9);g.camera.lookAt(0,1.45,0);if(!running){g.hud(s.finished?'Curtain call · '+Math.round(100*s.points/s.possible)+'%':selected.name+' · Ready');return;}
    const remaining=cue.at-s.time;let tip=cue.lane.toUpperCase()+' · '+(remaining>0?remaining.toFixed(1)+'s':'NOW');if(kind===1)tip='Plates L '+Math.round(s.plates[0]*100)+' / C '+Math.round(s.plates[1]*100)+' / R '+Math.round(s.plates[2]*100);if(kind===5)tip=s.balance>.12?'Lean LEFT':s.balance<-.12?'Lean RIGHT':'Steady';if(s.held)tip='Release in '+Math.max(0,cue.requiredHold-s.time+s.held.since).toFixed(1)+'s';
    g.hud(acts[kind]+' · '+(s.cue+1)+'/6 · '+timing+'\n'+tip+'\n'+s.feedback);}};}
P.register({id:'CITY-18',name:'Street Performer Studio',launch:'Take the stage',description:'Perform six interactive acts across nine routines at three city stages.',move:false,look:false,keys:{KeyJ:'left',KeyK:'center',KeyL:'right',Enter:'start'},buttons:[['left','Left',true],['center','Center',true],['right','Right',true],['start','Restart']],create});
if(typeof module==='object')module.exports={acts,venues,routines,stage,target,beat,input,step};})(typeof globalThis==='undefined'?window:globalThis);
