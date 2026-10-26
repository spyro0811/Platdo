
/* Offline conversation composition. Actual observations, stable voices, exact non-repetition.
 * History belongs to Platdo City's existing storage namespace; no network service is used. */
(function(root,factory){const api=factory(root.CityConfig||(typeof require==='function'?require('./config.js'):null),root);if(typeof module==='object'&&module.exports)module.exports=api;root.CityDialogue=api;})(typeof window!=='undefined'?window:globalThis,function(C,root){
'use strict';
const MAX_RESPONSES=2048,MAX_TEXT=320,MAX_STORAGE_BYTES=1100000;
let storage=null,stopped=false;
const cache=new Map(),sessions=new WeakMap();
const safe=s=>String(s||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,90);
const present=n=>n&&n.health>0&&!['dead','incapacitated'].includes(n.mode);
function empty(profile){return{version:1,profileId:profile.id,entries:[]};}
function validate(raw,profile){
 if(!raw||raw.version!==1||raw.profileId!==profile.id||!Array.isArray(raw.entries)||raw.entries.length>MAX_RESPONSES)throw Error('Invalid conversation history.');
 const seen=new Set(),entries=[];
 for(const row of raw.entries){
  if(!row||typeof row.speaker!=='string'||!row.speaker.length||row.speaker.length>160||/[\u0000-\u001f]/.test(row.speaker)||typeof row.text!=='string'||!row.text.trim()||row.text.length>MAX_TEXT||/[\u0000-\u001f]/.test(row.text)||seen.has(row.text)||!Array.isArray(row.topics)||row.topics.length>3||row.topics.some(t=>typeof t!=='string'||!/^[a-z0-9:-]{1,70}$/.test(t))||!Number.isFinite(row.time)||row.time<0||row.time>1e8)throw Error('Invalid conversation entry.');
  seen.add(row.text);entries.push({speaker:row.speaker,text:row.text,topics:row.topics.slice(),time:row.time});
 }
 return{version:1,profileId:profile.id,entries};
}
function connect(scopedStorage){storage=scopedStorage;stopped=false;cache.clear();}
function key(profile){return profile.mode+'-dialogue';}
function history(profile){
 const id=profile.mode+':'+profile.id;
 let state=cache.get(id);
 if(!state){
  state={data:empty(profile),seen:new Set(),blocked:false,counts:new Map(),recent:new Map()};
  const absorb=data=>{for(const e of data.entries)if(!state.seen.has(e.text)&&state.data.entries.length<MAX_RESPONSES){state.data.entries.push(e);state.seen.add(e.text);}};
  if(profile.dialogue)absorb(validate(profile.dialogue,profile));
  if(storage)try{const raw=storage.get(key(profile));if(raw){if(raw.length>MAX_STORAGE_BYTES)throw Error('Conversation history is too large.');const parsed=JSON.parse(raw);if(parsed.profileId===profile.id)absorb(validate(parsed,profile));}}catch(_){state.blocked=true;}
  for(const e of state.data.entries)for(const topic of e.topics){const k=e.speaker+':'+topic;state.counts.set(k,(state.counts.get(k)||0)+1);state.recent.set(k,e.time);}
  cache.set(id,state);
 }
 profile.dialogue=state.data;
 return state;
}
function reset(mode){for(const id of cache.keys())if(id.startsWith(mode+':'))cache.delete(id);if(!stopped)storage?.remove(mode+'-dialogue');}
function stop(){stopped=true;}
if(root.addEventListener)root.addEventListener('platdo:beforereset',stop);
function visible(sim,n,target,range=38){
 const d=C.flatDist(n,target);if(d>range||Math.abs((n.y||0)-(target.y||0))>15)return false;
 if(d>3){const yaw=Math.atan2(target.x-n.x,target.z-n.z);if(Math.abs(C.wrap(yaw-(n.yaw||0)))>1.65)return false;}
 return !sim.world.lineOfSight||sim.world.lineOfSight({...n,y:(n.y||0)+1.5},{...target,y:(target.y||0)+.9});
}
const voices={
 mara:['I still check the tires before I check the paint.','A quiet engine is usually a happier engine.','You can learn a lot about a car by how it comes to a stop.','I keep the workshop tools in the same places. Saves an argument later.','My favorite jobs end with somebody driving home safely.','Every repair has a story. Usually two versions of it.','A clean workbench never lasts very long around me.','I have a soft spot for the cars everybody else has given up on.'],
 soren:['The diner is where half this neighborhood catches its breath.','I write the delivery address down before I touch the keys.','An extra napkin can solve more problems than you would think.','I have heard some excellent excuses for being late with a parcel.','My favorite table has a view of the street.','A short route is not always the quick route.','I like a job where the person at the other end is pleased to see you.','I can remember an order better than I can remember a birthday.'],
 inez:['I check the mooring before I set one foot on the dock.','The bay makes more sense when you stop rushing it.','You can turn a boat quickly; stopping it takes a little more thought.','I would take a quiet crossing over a fast one.','Dock lines have a habit of finding your ankles.','I like bringing a boat in so gently nobody notices.','A good landing starts before you get near the slip.','I always leave room for the wake to catch up.'],
 cass:['I like to know where I am landing before I leave the ground.','A smooth takeoff is worth being patient for.','The runway is no place to decide you have forgotten something.','A little trim is better than wrestling the controls.','My favorite part of a flight is the moment the wheels settle.','I check the instruments even when the view looks perfect.','The sky makes this city look like a very different place.','There is no prize for hurrying a landing.'],
 police:['I would rather give directions than chase anyone.','Keep the crossings clear and we will get along.','If you see trouble, give people space to get out.','I pay more attention to a moving crowd than a noisy engine.','This job involves a surprising number of lost visitors.','People notice when you slow down for them.','An empty road can still have someone about to cross it.','Most of my good shifts are the uneventful ones.'],
 practical:['I take the long way if it means fewer junctions.','I keep a spare key somewhere sensible. Learned that lesson once.','A walk clears my head better than sitting in traffic.','I like knowing the route before I set off.','The best shoes I own are the ones I can walk home in.','I try to finish my errands before the streets get busy.','You notice more of a neighborhood when you stop looking at your phone.','I always leave myself a little extra time for the trip back.'],
 curious:['I like finding a street I have not walked down yet.','I keep meaning to get a photograph from the relay lookout.','I wonder how different the bay looks from a small plane.','I can get distracted by a good view halfway through an errand.','I would love to know the story behind every old workshop here.','I like watching where people choose to sit when they have a moment.','A new route home makes an ordinary day more interesting.','I am trying to learn the city by its corners, not just its map.'],
 warm:['I like it when someone stops for a proper conversation.','A little patience goes a long way around here.','I try to leave a place a little tidier than I found it.','The best part of a walk is running into someone you know.','I hope the rest of your day gives you a chance to slow down.','I always make time for a meal with a friend.','A quiet minute outside can change your whole afternoon.','I like a neighborhood where people look out for one another.'],
 dry:['I have become very good at pretending I know a shortcut.','My errands have a way of turning into a tour of the city.','I came out for one thing. I will remember what it was eventually.','I can find the diner with considerably more confidence than my keys.','I keep telling myself the walk counts as a plan.','I trust my feet more than my sense of direction.','I had a very organized morning in mind when I woke up.','Somehow the journey back always feels longer.']
};
function voiceFor(n){const contact=String(n.name||'').toLowerCase();if(voices[contact])return contact;if(n.role==='police')return'police';return['practical','curious','warm','dry'][C.hash(n.id)%4];}
function observe(sim,n){
 const facts=[],p=sim.player,w=sim.world,add=(id,lines,priority=1,group='ordinary')=>facts.push({id,lines,priority,group});
 const interior=w.interiorAt?.(n.x,n.z,n.y),wet=sim.weather==='rain',hour=(sim.dayTime??.34)*24;
 if(wet&&!interior)add('rain',['That rain is really finding its way into everything.','The pavement is wet; watch your footing.','You can hear the rain before you step outside.','I am keeping clear of those shiny, wet corners.','This is weather for taking the turns gently.','The rain has changed the sound of the whole street.'],2);
 else if(wet)add('rain-inside',['I can hear the rain outside from here.','It is a relief to be under a roof in this weather.','I am waiting for the rain to ease before heading out.','The rain sounds a lot nicer from indoors.']);
 else if(sim.weather==='overcast')add('overcast',['There is a blanket of cloud over the city today.','The bay looks softer under all that cloud.','At least the cloud takes the glare off the road.','I keep looking up to see whether those clouds will clear.']);
 else if(!interior)add('clear',['There is a clear view of the sky today.','It is a good day to be outside for a while.','The skyline is easy to pick out in this weather.','I like seeing the city without a sheet of rain in front of it.']);
 if(hour<6||hour>=20)add('night',['It is properly dark out now.','The city feels different after dark.','I am watching the crossings a little more carefully tonight.','Those late walks have a mood all their own.'],2);
 else if(hour<11)add('morning',['There is still plenty of morning left.','I am trying to get a good start on the day.','Morning is my favorite time to get moving.','It feels early enough to change the plan.']);
 else if(hour<17)add('afternoon',['The afternoon is moving along.','This is a good point in the day to take a breather.','I could make a decent afternoon out of a walk and a meal.','I am deciding what still needs doing before evening.']);
 else add('evening',['Evening is drawing in.','I am thinking about the trip home now.','The light is starting to change on the buildings.','This part of the day always seems to go quickly.']);
 const playerSeen=visible(sim,n,p,10);
 if(playerSeen&&p.health<45)add('hurt',['You look hurt. Get somewhere safe for a minute.','That looks painful; do you have a recovery kit?','I would see to those injuries before taking another job.','You need a chance to recover before heading back out.'],7,'urgent');
 if(playerSeen&&p.mode==='swimming')add('swimming',['You can get out using a dock ladder.','Find a ladder before you wear yourself out in the water.','The dock ladders will get you back onto dry ground.'],7,'urgent');
 const armed=playerSeen&&!sim.profile.inventory.holstered&&sim.profile.inventory.selected!=='unarmed';
 if(armed)add(n.role==='police'?'police-weapon':'weapon',n.role==='police'?['Put the weapon away while we talk.','Keep that weapon lowered.','I need you to holster that before this goes any further.']:['Could you put that weapon away while we talk?','I would feel better if you holstered that.','You have my attention; you do not need the weapon out.','I am keeping a bit of distance while you are holding that.'],8,'urgent');
 if(n.role==='police'&&sim.wanted.level)add('pursuit',['Stop here and keep your hands clear.','There is an active pursuit. Do not make this harder.','Stay where I can see you.','We need to settle this before you go anywhere.'],9,'urgent');
 const seenNPCs=(sim.npcs||[]).filter(other=>other!==n&&visible(sim,n,other,28));
 if(seenNPCs.some(a=>a.health<=0||a.mode==='incapacitated'))add('injured-neighbor',['Someone over there is down. Give them some room.','There is an injured person nearby. Please keep the way clear.','I can see somebody on the ground; this is not a good place to linger.'],9,'urgent');
 else if(seenNPCs.some(a=>a.panic>0||a.mode==='panic'))add('crowd-panic',['People nearby are trying to get away from something.','Look at the people running; we should give them room.','The crowd is nervous. I am staying out of their way.'],7,'urgent');
 else if(seenNPCs.filter(present).length>=4)add('crowd',['There are quite a few people around this corner.','This little stretch has become a busy one.','I am leaving room for everyone to get past.','It is easy to lose your place in a crowd like this.']);
 if(seenNPCs.some(a=>present(a)&&a.role==='police')&&n.role!=='police')add('officer',['There is an officer just over there.','The police are close by if you need directions.','I can see an officer watching this stretch.'],3);
 const cars=(sim.vehicles||[]).filter(v=>visible(sim,n,v,42));
 const wreck=cars.find(v=>v.health<=0),fire=cars.find(v=>v.health>0&&v.health/v.maxHealth<.18),damaged=cars.find(v=>v.health>0&&v.health/v.maxHealth<.6);
 if(wreck)add('wreck',['That wreck is going nowhere; keep clear of it.','There is a wreck nearby. Watch for anyone around it.','I would leave plenty of room around that destroyed vehicle.','That vehicle has had the last trip it is going to have.'],9,'urgent');
 else if(fire)add('fire',['That engine looks in a very bad way. Get clear of it.','I would not stand beside that vehicle in that condition.','That vehicle is badly damaged; do not wait around beside it.'],9,'urgent');
 else if(damaged)add('damaged-car',['That vehicle could use a visit to the workshop.','I would get that damage checked before a long drive.','You can see that vehicle has had a rough trip.','That is the sort of damage I would let a mechanic look at.'],4);
 if(cars.some(v=>v.health>0&&Math.abs(v.speed||0)>12))add('traffic-fast',['The traffic is moving quickly here.','I am checking twice before I cross with cars coming through like that.','That is a quick stretch of road; keep an eye on it.'],4);
 else if(cars.some(v=>v.health>0&&v.category==='land'&&Math.abs(v.speed||0)>1))add('traffic',['There is traffic coming through; mind the curb.','I am waiting for a gap in those cars.','The road has a steady little stream of traffic.','You can watch half the neighborhood go past here.']);
 if(cars.some(v=>v.health>0&&v.category==='boat'))add('boat',['There is a boat nearby; I like watching them settle in the water.','Those boats always remind me to leave room for the wake.','A boat changes the way you see the edges of this city.','The water route looks tempting with a boat close by.']);
 if(cars.some(v=>v.health>0&&['plane','heli'].includes(v.category)))add('aircraft',['That aircraft makes me want a look at the city from above.','There is something about seeing an aircraft up close.','I would give that aircraft plenty of room to move.','The trip looks very different once you leave the ground.']);
 const audible=(sim.events||[]).filter(e=>sim.time-e.time>=0&&sim.time-e.time<12&&Number.isFinite(e.x)&&C.flatDist(n,e)<(e.type==='explosion'?95:55));
 if(audible.some(e=>e.type==='explosion'))add('heard-explosion',['I heard that explosion. I am getting away from it.','That blast was much too close for comfort.','I heard a blast nearby; this conversation can wait.'],10,'urgent');
 else if(audible.some(e=>e.type==='shot'))add('heard-shots',['Those shots were close enough to hear clearly.','I heard gunfire. Find somewhere safe.','I am not staying in the open after hearing shots.'],10,'urgent');
 const horn=sim.lifeDirector?.lastHorn;if(horn&&sim.time-horn.time<8&&C.flatDist(n,horn)<30)add('horn',['I heard the horn; I am keeping an eye on the road.','That horn certainly got my attention.','Someone is impatient with the traffic.'],3);
 const services=(w.services||[]).filter(s=>C.flatDist(n,s.interaction)<45).sort((a,b)=>C.flatDist(n,a.interaction)-C.flatDist(n,b.interaction));
 for(const s of services.slice(0,2)){const name=safe(s.displayName);if(!name)continue;const id='service-'+s.type;
  const tips={garage:[`${name} is close if you need repairs.`,`I would start at ${name} for anything mechanical.`,`The workshop nearby is ${name}.`],diner:[`${name} is nearby if you want to sit down for a meal.`,`You can get a meal at ${name}.`,`I am tempted to stop at ${name} before I head home.`],marina:[`${name} is where I would start a trip across the bay.`,`There is a way onto the water near ${name}.`,`If you are looking for boats, try ${name}.`],hangar:[`${name} is the place to ask about flying.`,`The airfield is near ${name}.`,`You can get started with aircraft at ${name}.`],clothing:[`${name} is nearby if you want a change of clothes.`,`The clothing shop here is ${name}.`,`I like having ${name} within walking distance.`],equipment:[`${name} sells equipment if you need supplies.`,`You can pick up supplies at ${name}.`,`The equipment shop nearby is ${name}.`],safehouse:[`${name} gives you somewhere to rest.`,`You can take a break at ${name}.`,`It helps knowing ${name} is nearby.`]};if(tips[s.type])add(id,tips[s.type]);
 }
 const voice=voiceFor(n);voices[voice].forEach((line,i)=>add('personal-'+voice+'-'+i,[line],.6,'personal'));
 // Only a contact knows their own work with this player. Strangers do not read quest state.
 if(n.role==='contact'){
  const done=sim.profile.missions.completed.length;if(done===12)add('story-complete',['You got the whole handoff finished. Take a moment to enjoy that.','We have no final delivery hanging over us now.','You earned a little time to explore without a job on your back.'],3);
  const job=sim.content?.missions?.find(m=>m.id===sim.mission?.id);if(job?.contact===n.name){const title=safe(job.title);add('current-job',[`We still have ${title} to finish. The next stop is marked on your phone.`,`If you need the next step for ${title}, check the marker on your map.`,`Let us get ${title} finished before we take on something else.`],3);}
 }
 return facts;
}
function generate(sim,n){
 if(stopped||!present(n)||!sim.profile)return null;
 const state=history(sim.profile);if(state.blocked||state.data.entries.length>=MAX_RESPONSES)return null;
 let session=sessions.get(sim);if(!session){session=new Map();sessions.set(sim,session);}const last=session.get(n.id);if(last!==undefined&&sim.time-last<1.1)return null;
 const previous=state.data.entries.filter(e=>e.speaker===n.id),facts=observe(sim,n),turn=previous.length,seed=C.hash(n.id+':'+turn);
 const recentlySaid=[...previous.slice(-2),...state.data.entries.slice(-1)];
 // Rotate observations rather than opening with the same weather sentence every time.
 const score=f=>f.priority-2*(state.counts.get(n.id+':'+f.id)||0)+((C.hash(f.id+':'+seed)%101)/101);
 const urgent=facts.filter(f=>f.group==='urgent').sort((a,b)=>b.priority-a.priority);
 const pool=urgent.length?facts.filter(f=>f.group!=='personal'&&f.id!=='clear'&&!['morning','afternoon','evening'].includes(f.id)):facts;
 const ordered=pool.slice().sort((a,b)=>score(b)-score(a));
 for(let attempt=0;attempt<600;attempt++){
  const first=attempt<ordered.length?ordered[attempt]:ordered[(seed+attempt*7)%ordered.length];
  if(!first)break;
  const candidates=ordered.filter(f=>f.id!==first.id&&!(f.group==='personal'&&first.group==='personal'));
  const second=candidates[(Math.floor(attempt/Math.max(1,ordered.length))+(seed%Math.max(1,candidates.length)))%Math.max(1,candidates.length)];
  const a=first.lines[(turn+attempt)%first.lines.length],b=second?.lines[(Math.floor(turn/2)+Math.floor(attempt/3))%second.lines.length];
  const text=a+(b?' '+b:'');
  if(text.length>MAX_TEXT||state.seen.has(text)||recentlySaid.some(e=>e.text.includes(a)||b&&e.text.includes(b)))continue;
  const row={speaker:n.id,text,topics:[first.id,...(second?[second.id]:[])],time:sim.time};
  state.data.entries.push(row);state.seen.add(text);for(const topic of row.topics){const k=n.id+':'+topic;state.counts.set(k,(state.counts.get(k)||0)+1);state.recent.set(k,sim.time);}session.set(n.id,sim.time);sim.profile.dialogue=state.data;sim.dirty=true;
  if(storage&&!stopped)try{storage.set(key(sim.profile),JSON.stringify(state.data));}catch(_){if(!session.get('saveWarning')){session.set('saveWarning',true);sim.emit?.('notice',{message:'Conversation history could not be saved. Export your City save to keep it.'});}}
  return row;
 }
 return null; // Never reset/recycle the history or synthesize numbered filler on exhaustion.
}
function talk(sim,n){const row=generate(sim,n);if(!row)return null;sim.emit('dialogue',{speaker:n.name||(n.role==='police'?'Officer':'Local'),text:row.text,topics:row.topics});return row.text;}
function diagnostics(profile){const h=history(profile);return{responses:h.data.entries.length,limit:MAX_RESPONSES,blocked:h.blocked,voices:Object.keys(voices).length};}
return{connect,stop,reset,validate,empty,history:profile=>history(profile).data,observe,generate,talk,voiceFor,visible,diagnostics,limits:{responses:MAX_RESPONSES,text:MAX_TEXT}};
});

