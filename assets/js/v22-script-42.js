
/* Authored content and deterministic, bounded traversal chunks. World units are metres. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.SwingContent=value;})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
const MONKEYS=[
 {id:'pogo',name:'Pogo',stars:0,fur:0x8c4c26,face:0xffd398,belly:0xf7d595,accent:0x734020,kind:'capuchin',personality:'A curious capuchin with a looping tail.'},
 {id:'pip',name:'Pip',stars:0,fur:0xdc9c2f,face:0xffdaa0,belly:0xffdf87,accent:0xab4d23,kind:'tamarin',personality:'A golden tamarin with an untamable copper mane.'},
 {id:'zip',name:'Zip',stars:3,fur:0x37343b,face:0xdba88b,belly:0x6b5b56,accent:0x201e2b,kind:'spider',personality:'Long limbs, a curling tail, and boundless curiosity.'},
 {id:'momo',name:'Momo',stars:6,fur:0x94959c,face:0xe9a4a5,belly:0xc6c8cb,accent:0x737780,kind:'macaque',personality:'Soft cheeks and a sleepy, easygoing smile.'},
 {id:'riff',name:'Riff',stars:10,fur:0x67503f,face:0x9abfdd,belly:0xd7c18a,accent:0xe35859,kind:'mandrill',personality:'A bold muzzle and the confidence of a canopy king.'},
 {id:'nori',name:'Nori',stars:15,fur:0xa65335,face:0xf1ba88,belly:0xf4d2a2,accent:0x82331d,kind:'proboscis',personality:'A grand nose, warm heart, and wonderfully goofy grin.'},
 {id:'kiki',name:'Kiki',stars:24,fur:0x8f9843,face:0xffeac0,belly:0xe9c95a,accent:0x5c692f,kind:'squirrel',personality:'A bright mask and quick, inquisitive head turns.'},
 {id:'luna',name:'Luna',stars:36,fur:0x242938,face:0x9fadc0,belly:0xe9eee9,accent:0xffffff,kind:'colobus',personality:'A flowing white mantle and a graceful tufted tail.'}
];
const BIOMES=[
 {id:'canopy',name:'Sunlit Canopy',sky:0xa4dcce,fog:0xb4dbbd,leaf:0x428b46,leaf2:0x8ab64b,bark:0x805130,ground:0x8d6542,accent:0xffde75,water:0x379cab,light:0xffe6b0,mood:0},
 {id:'gorge',name:'Waterfall Gorge',sky:0x89c9db,fog:0xb4e0e3,leaf:0x297b68,leaf2:0x78bca2,bark:0x675947,ground:0x98b7b0,accent:0x8eeadd,water:0x389fc2,light:0xe2fbef,mood:1},
 {id:'grove',name:'Ancient Grove',sky:0xb4bcb0,fog:0xc7c7a3,leaf:0x47704c,leaf2:0x859955,bark:0x5f4936,ground:0x8a937d,accent:0xffbb59,water:0x537b72,light:0xffd28c,mood:2},
 {id:'hollow',name:'Firefly Hollow',sky:0x1b294d,fog:0x34365b,leaf:0x344b72,leaf2:0x677aaa,bark:0x504965,ground:0x655c80,accent:0xb9ffe4,water:0x334d8d,light:0xb8d6ff,mood:3},
 {id:'cloud',name:'Cloudtop Sanctuary',sky:0xc7d6ea,fog:0xe8dee0,leaf:0x6e9892,leaf2:0xb2bc87,bark:0x837766,ground:0xa29580,accent:0xffda7b,water:0xb4c8de,light:0xffe4b6,mood:4}
];
const LEVEL_SPECS=[
 ['First Swing',0,10,24,2,'gentle,cadence,gentle,rise,cadence,gentle,rise,cadence,gentle,finale'],
 ['Canopy Cadence',0,14,32,2,'cadence,low,rise,cadence,high,low,cadence,rise,high,cadence,low,rise,cadence,finale'],
 ['Crown of the Canopy',0,18,40,3,'rise,cadence,high,low,rise,back,cadence,high,low,rise,cadence,back,high,cadence,rise,cadence,high,finale'],
 ['River Run',1,15,36,2,'gentle,move,cadence,low,move,rise,cadence,move,low,high,cadence,move,rise,cadence,finale'],
 ['Misty Momentum',1,18,42,3,'cadence,move,rise,move,low,cadence,move,high,move,low,rise,move,cadence,high,move,rise,cadence,finale'],
 ['Falls and Flight',1,20,45,3,'high,drop,move,low,rise,move,drop,cadence,rise,high,move,drop,low,rise,move,cadence,high,drop,rise,finale'],
 ['Lantern Stones',2,16,40,2,'gentle,arch,low,cadence,arch,rise,high,arch,low,cadence,rise,arch,high,low,cadence,finale'],
 ['The Living Bridge',2,20,48,3,'gentle,fragile,cadence,arch,low,fragile,rise,moving,high,cadence,fragile,arch,low,rise,moving,fragile,cadence,high,rise,finale'],
 ['Temple of Tangles',2,24,50,3,'arch,cadence,move,rise,fragile,low,arch,high,cadence,move,fragile,rise,arch,low,moving,cadence,high,fragile,move,arch,low,rise,cadence,finale'],
 ['Moonlit Echo',3,18,42,3,'gentle,rise,cadence,high,low,cadence,move,rise,high,cadence,low,arch,rise,move,cadence,high,rise,finale'],
 ['Firefly Flight',3,22,50,3,'gentle,wind,cadence,rise,low,wind,high,cadence,move,rise,wind,low,cadence,high,wind,move,rise,cadence,wind,high,rise,finale'],
 ['Night Canopy Circuit',3,24,54,3,'rise,wind,high,low,cadence,move,wind,rise,arch,high,cadence,wind,low,rise,move,high,wind,cadence,arch,low,wind,rise,high,finale'],
 ['Cloudline Climb',4,20,48,3,'climb,cadence,climb,rise,high,climb,move,cadence,climb,rise,high,climb,cadence,move,climb,rise,high,climb,cadence,finale'],
 ['Storm Before Sunrise',4,26,56,3,'climb,move,cadence,wind,rise,fragile,high,climb,move,low,wind,cadence,rise,moving,fragile,climb,high,wind,cadence,move,rise,fragile,climb,high,cadence,finale'],
 ['Heart of the Jungle',4,30,60,4,'gentle,climb,cadence,high,rise,move,low,climb,cadence,wind,rise,arch,high,fragile,climb,cadence,moving,wind,rise,move,high,climb,fragile,cadence,rise,wind,high,climb,cadence,finale']
];
// Every pattern has a generous rest branch. Their 8.5–9.0 unit gaps are
// validated against the real controller, not merely anchor separation.
const PATTERNS={gentle:{span:14,gap:8.5,len:7},cadence:{span:14,gap:9,len:7.3},low:{span:14,gap:9,len:6.1},rise:{span:14,gap:9,len:7.2,dy:.35},high:{span:14,gap:9,len:8},back:{span:14,gap:9,len:7.8},move:{span:14,gap:9,len:7.4,motion:{axis:'x',amp:.9,period:5.5}},drop:{span:14,gap:9,len:7.7,dy:-.5},arch:{span:14,gap:9,len:6.6,arch:true},fragile:{span:14,gap:9,len:7.4,breakAfter:2.7},moving:{span:14,gap:9,len:7.2,moving:true},wind:{span:14,gap:9,len:7.4,wind:true},climb:{span:14,gap:9,len:7.4,dy:.5},finale:{span:14,gap:9,len:7.5}};
function rng(seed){let n=(seed>>>0)||1;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function makeRoute(spec,index=0){const[name,biome,count,bananaCount,cpCount,sequence]=spec,level={id:'level-'+(index+1),index,name,biome,seed:8317+index*1927,start:{x:1.5,y:.68},platforms:[],vines:[],hazards:[],bananas:[],checkpoints:[],winds:[],bounds:{minX:-5,maxX:0,minY:-9,maxY:20},tutorial:index===0};let x=0,y=0;const names=sequence.split(',');
 level.platforms.push({id:'start',x:-5,y:0,w:10,h:1.2,oneWay:false});
 for(let i=0;i<count;i++){const kind=names[i%names.length],p=PATTERNS[kind],dy=p.dy||0,nextY=y+dy;const center=x+7;level.vines.push({id:'v'+i,x:center,y:y+p.len+1.9,length:p.len,motion:p.motion?{...p.motion,phase:i*.73}:null,breakAfter:p.breakAfter||0,kind,section:i});
  const start=x+5,end=start+p.gap;level.platforms.push({id:'p'+i,x:end,y:nextY,w:p.span+5-end+x,h:.85,oneWay:true,motion:p.moving?{axis:'x',amp:.65,period:5.8,phase:i}:null});
  if(index===0&&i===0)level.platforms.push({id:'tutorial-safety',x:4.7,y:-1.8,w:9.3,h:.7,oneWay:true});
  if((index===3&&i===names.indexOf('move'))||(index===7&&i===names.indexOf('fragile')))level.platforms.push({id:'mechanic-safety',x:x+4.7,y:y-1.8,w:p.gap+1,h:.7,oneWay:true});
  if(p.arch)level.platforms.push({id:'arch'+i,x:x+2,y:y+9.5,w:3.5,h:1.5,oneWay:false,decor:'ruin'});
  if(p.wind)level.winds.push({id:'wind'+i,x:x+3,y:y-2,w:10,h:12,strength:i%2?2.4:-2.2,period:7,phase:i});
  if(index>2&&i%6===4)level.hazards.push({id:'thorn'+i,x:x+10,y:y-2.3,w:2,h:.75});
  x+=p.span;y=nextY;
 }
 level.goal={id:'goal',x:x-1,y:y+.8};level.platforms.push({id:'goal-platform',x:x-5,y,w:12,h:1.5,oneWay:false});level.bounds.maxX=x+9;level.bounds.maxY=Math.max(...level.vines.map(v=>v.y))+4;
 for(let i=1;i<=cpCount;i++){const p=level.platforms.find(p=>p.id==='p'+Math.min(count-2,Math.floor(i*count/(cpCount+1))));level.checkpoints.push({id:'cp'+i,x:p.x+Math.min(1.8,p.w/2),y:p.y+.68,platform:p.id});}
 // Hand-authored rhythmic arcs follow each route's actual anchor and platform elevations.
 for(let i=0;i<bananaCount;i++){const v=level.vines[Math.floor(i/bananaCount*count)],slot=i%3;level.bananas.push({id:'banana'+i,x:v.x-1.3+slot*1.35,y:v.y-v.length+.35+(slot===1?.2:0)});}
 const rv=level.vines[Math.max(2,Math.floor(count*.65))];level.relic={id:'relic',x:rv.x+1.8,y:rv.y-rv.length+4.0};return level;
}
const LEVELS=LEVEL_SPECS.map(makeRoute);
function practice(){const l=makeRoute(['Practice Grove',0,5,12,0,'gentle,cadence,move,fragile,rise'],0);l.id='practice';l.name='Practice Grove';l.tutorial=false;l.platforms.push({id:'safe-ground',x:-6,y:-2.3,w:l.bounds.maxX+12,h:2,oneWay:false});l.goal=null;l.relic=null;l.bounds.minY=-7;return l;}
function endlessChunk(seed,index){const r=rng((seed+Math.imul(index+1,7919))>>>0),difficulty=Math.min(4,Math.floor(index/5)),pool=['gentle','cadence','low','rise',...(difficulty>0?['high','move']:[]),...(difficulty>1?['fragile','wind']:[])],kind=pool[Math.floor(r()*pool.length)];const l=makeRoute(['Endless',Math.floor(index/6)%5,3,6,0,[kind,'cadence','finale'].join(',')],0);l.id='chunk'+index;l.chunk=index;l.seed=seed;l.kind=kind;l.entry={x:0,y:0};l.exit={x:42,y:0};const shift=index*42;l.start.x+=shift;for(const key of ['platforms','vines','hazards','bananas','winds'])for(const object of l[key]){object.id='c'+index+'-'+object.id;object.x+=shift;}l.platforms.push({id:'join'+index,x:shift+37,y:0,w:10,h:1,oneWay:true});l.relic=null;l.goal=null;l.checkpoints=[];l.bounds={minX:shift-5,maxX:shift+47,minY:-9,maxY:21};return l;}
const ACHIEVEMENTS=[['first','First Flight','Finish First Swing.'],['chain','Chain Reaction','Catch five distinct vines in one aerial chain.'],['bananas','Banana Bunch','Collect 30 bananas in a campaign run.'],['flawless','Flawless Finish','Finish a later level without a death or reset.'],['treasure','Treasure Hunter','Secure five distinct relics.'],['ranger','Relic Ranger','Secure all 15 relics.'],['collector','Canopy Collector','Earn all 45 stars.'],['party','Primate Party','Play with all eight monkeys.'],['river','River Rider','Restore the Gorge signal tree.'],['temple','Temple Explorer','Restore the Grove signal tree.'],['sun','Sun Chaser','Finish Heart of the Jungle.'],['endless','Endless Explorer','Reach 1,000 units in one endless run.']];
function validateLevel(l){const errors=[],ids=new Set();for(const key of ['platforms','vines','hazards','bananas','checkpoints','winds'])for(const o of l[key]){if(ids.has(o.id))errors.push('Duplicate '+o.id);ids.add(o.id);if(!Number.isFinite(o.x)||!Number.isFinite(o.y))errors.push('Invalid '+o.id);}for(const v of l.vines)if(v.length<2||v.length>8.5||v.motion&&(v.motion.amp>1.4||v.motion.period<4.5))errors.push('Vine bounds '+v.id);for(const c of l.checkpoints){const p=l.platforms.find(p=>p.id===c.platform);if(!p||c.x<p.x||c.x>p.x+p.w||Math.abs(c.y-p.y-.68)>.01)errors.push('Unsafe checkpoint '+c.id);}if(!l.start||!l.bounds)errors.push('Missing start/bounds');if(l.index>=0&&l.id.startsWith('level')&&!l.goal)errors.push('Missing goal');return errors;}
return{MONKEYS,BIOMES,LEVELS,LEVEL_SPECS,PATTERNS,ACHIEVEMENTS,rng,practice,endlessChunk,validateLevel};
});

