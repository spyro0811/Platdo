
/* Platdo City original appearance library and observation policy. No renderer/storage dependency. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CityPeople=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let s=typeof seed==='number'?seed>>>0:hash(seed);return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pick=(list,r)=>list[Math.floor(r()*list.length)];
const headBases=[
 ['oval',.95,1.04,.83,1.02,.93],['square',1.08,.97,1.12,.96,1.05],['long',.87,1.16,.88,1.1,.92],['round',1.1,.92,.97,.87,1.12],
 ['heart',1.05,1.02,.76,.98,1.06],['angular',.97,1.09,.96,1.12,.86],['broad',1.14,.99,1.07,.98,1.1],['slender',.85,1.04,.82,1.04,.9],
 ['soft-square',1.04,1.02,1.02,.92,1.08],['diamond',.97,1.08,.8,1.08,1.16],['oblong',.93,1.12,1.02,1.02,.97],['tapered',1.01,.98,.78,.94,.96]
].map((a,i)=>({id:i,name:a[0],width:a[1],length:a[2],jaw:a[3],nose:a[4],cheek:a[5]}));
const faceProfiles=Array.from({length:144},(_,i)=>{const r=rng('face'+i),b=headBases[i%12];return {id:i,base:b.id,width:b.width*(.965+r()*.07),length:b.length*(.975+r()*.05),jaw:b.jaw*(.95+r()*.1),cheek:b.cheek*(.955+r()*.09),nose:b.nose*(.9+r()*.2),noseWidth:.82+r()*.34,eyeSpacing:.9+r()*.19,brow:.82+r()*.4,mouth:.83+r()*.29,chin:.86+r()*.24,hairline:.88+r()*.2};});
const bodies=[
 {id:0,name:'slender',height:1.77,shoulders:.40,waist:.255,hips:.29,limb:.90},
 {id:1,name:'athletic',height:1.81,shoulders:.49,waist:.29,hips:.31,limb:1.05},
 {id:2,name:'broad',height:1.85,shoulders:.54,waist:.37,hips:.35,limb:1.15},
 {id:3,name:'compact',height:1.64,shoulders:.42,waist:.3,hips:.33,limb:1.02},
 {id:4,name:'curved',height:1.73,shoulders:.41,waist:.27,hips:.39,limb:1.06},
 {id:5,name:'tall',height:1.91,shoulders:.45,waist:.30,hips:.32,limb:.99},
 {id:6,name:'full',height:1.74,shoulders:.48,waist:.41,hips:.41,limb:1.19},
 {id:7,name:'lean-compact',height:1.68,shoulders:.37,waist:.25,hips:.285,limb:.91}
];
const hairNames=['bald','close-crop','side-part','short-waves','coils','rounded-afro','high-top','swept-back','short-bob','long-bob','shoulder-length','long-straight','ponytail','high-bun','low-bun','braids','locs','mohawk','receding','curly-crop'];
const hair=hairNames.map((name,id)=>({id,name,long:[9,10,11,12,15,16].includes(id),hatSafe:[0,1,2,3,7,18,19].includes(id)}));
const upperSpecs=[
 ['crew-tee','tee',.19,0],['v-neck','vneck',.17,0],['polo','polo',.20,0],['henley','henley',.32,0],
 ['oxford-shirt','shirt',.51,0],['rolled-shirt','shirt',.29,0],['linen-shirt','linen',.24,0],['dress-shirt','formal',.51,0],
 ['hoodie','hoodie',.52,.04],['zip-hoodie','ziphood',.52,.04],['crew-sweater','sweater',.52,.025],['cardigan','cardigan',.5,.028],
 ['denim-jacket','denim',.51,.04],['bomber','bomber',.5,.05],['field-jacket','field',.52,.055],['blazer','blazer',.52,.035],
 ['long-coat','coat',.52,.035],['rain-shell','rain',.52,.04],['track-jacket','track',.5,.025],['running-vest','running',0,0],
 ['work-vest','workvest',0,.04],['apron-shirt','apron',.2,.015],['utility-overall','overall',.52,.02],['knit-tunic','tunic',.36,.015]
];
const uppers=upperSpecs.map((v,id)=>({id,name:v[0],shape:v[1],sleeve:v[2],ease:v[3],length:[16,23].includes(id)?.72:.48}));
const lowerSpecs=[['straight-denim','straight',1],['tapered-denim','taper',1],['chinos','chino',1],['formal-trousers','formal',1],['cargo-trousers','cargo',1],['wide-trousers','wide',1],['joggers','jogger',1],['track-pants','track',1],['walking-shorts','shorts',.56],['sport-shorts','sport',.43],['skirt','skirt',.68],['cropped-trousers','cropped',.82]];
const lowers=lowerSpecs.map((v,id)=>({id,name:v[0],shape:v[1],length:v[2]}));
const footwear=['canvas-low','runner','leather-shoe','ankle-boot','work-boot','loafer','sandal','high-top'].map((name,id)=>({id,name}));
const accessories=['none','glasses','sunglasses','cap','beanie','brim-hat','backpack','crossbody','handbag','scarf','watch','headphones','camera'].map((name,id)=>({id,name}));
const movements=[
 ['easy',.95,.8,0],['brisk',1.12,1.1,.03],['measured',.87,.7,0],['long-stride',.92,1.12,.02],
 ['light-step',1.08,.88,.01],['relaxed',.9,.95,-.015],['purposeful',1.04,1.05,.04],['jogger',1.16,1.12,.055]
].map((a,id)=>({id,name:a[0],cadence:a[1],swing:a[2],lean:a[3]}));
const palettes=[
 {name:'harbor',upper:'#316d78',lower:'#273d4b',accent:'#d9c4a0'}, {name:'brick',upper:'#a45943',lower:'#344451',accent:'#e4cbaa'},
 {name:'stone',upper:'#d6cabc',lower:'#464d51',accent:'#80523d'}, {name:'olive',upper:'#6d795c',lower:'#393f3c',accent:'#d2b788'},
 {name:'navy',upper:'#35475c',lower:'#948b78',accent:'#e3d3b7'}, {name:'plum',upper:'#785974',lower:'#373e4c',accent:'#ceb0a1'},
 {name:'ochre',upper:'#b38b47',lower:'#3e4a50',accent:'#d7c09c'}, {name:'cream',upper:'#d9d6ca',lower:'#597181',accent:'#9a5345'},
 {name:'mint',upper:'#6c9c91',lower:'#e0d5bc',accent:'#4d555e'}, {name:'charcoal',upper:'#454951',lower:'#263443',accent:'#beb49f'},
 {name:'cobalt',upper:'#416881',lower:'#a6a08d',accent:'#e0c093'}, {name:'burgundy',upper:'#854c59',lower:'#77776c',accent:'#d2baa1'}
];
const skinPalettes=['#e8bfa2','#d6a887','#c58d69','#ad7455','#916049','#754b3a','#573e32','#e5b398','#b98167','#996b53','#694b3b','#c4a087'];
const hairPalettes=['#211c1a','#382921','#604031','#926c47','#bf9b64','#75695d','#bdb9ad','#453734'];
const families=[
 {id:'workwear',up:[3,10,12,20,22],low:[0,4,2],shoe:[3,4,7],acc:[0,3,6,10]},
 {id:'business-casual',up:[2,4,5,11,15],low:[2,3,11],shoe:[2,5,3],acc:[0,1,7,10]},
 {id:'formal-office',up:[7,15,16],low:[3,5,10],shoe:[2,5,3],acc:[0,1,8,10]},
 {id:'athletic',up:[0,8,18,19],low:[6,7,9],shoe:[1,7],acc:[0,3,11,10]},
 {id:'beach-leisure',up:[0,1,6,19],low:[8,9,10],shoe:[0,6],acc:[0,2,5,12]},
 {id:'street-casual',up:[0,1,8,9,12,13],low:[0,1,6],shoe:[0,1,7],acc:[0,3,4,6,11]},
 {id:'service',up:[2,5,21],low:[2,3,11],shoe:[0,2,5],acc:[0,1,10]},
 {id:'dock-worker',up:[3,14,20,22],low:[0,4],shoe:[3,4],acc:[0,3,4,10]},
 {id:'delivery',up:[2,9,13,17],low:[0,2,4],shoe:[1,3,7],acc:[0,3,6,7]},
 {id:'maintenance',up:[4,14,20,22],low:[2,4],shoe:[3,4],acc:[0,3,10]},
 {id:'nightlife',up:[1,7,13,15,23],low:[1,3,5,10],shoe:[2,3,5],acc:[0,1,7,8,10]},
 {id:'weekend',up:[3,6,10,11,16,23],low:[2,5,8,11],shoe:[0,3,5,6],acc:[0,1,4,5,7,9,12]}
];
function validateAppearance(a){const errors=[];if(!a||typeof a!=='object')return ['Appearance must be an object'];
 for(const [key,list] of Object.entries({body:bodies,face:faceProfiles,skin:skinPalettes,hair,hairColor:hairPalettes,upper:uppers,lower:lowers,shoe:footwear,accessory:accessories,movement:movements,palette:palettes}))if(!Number.isInteger(a[key])||!list[a[key]]&&list[a[key]]!==0)errors.push('Invalid '+key);
 if(errors.length)return errors;
 if(!Number.isFinite(a.heightScale)||a.heightScale<.965||a.heightScale>1.035)errors.push('Height outside adult fitted range');
 if(!Number.isFinite(a.widthScale)||a.widthScale<.95||a.widthScale>1.05)errors.push('Width outside fitted range');
 if([3,4,5].includes(a.accessory)&&!hair[a.hair].hatSafe)errors.push('Hat incompatible with hair');
 if(a.accessory===9&&[8,9,16,17].includes(a.upper))errors.push('Scarf incompatible with collar');
 if(a.shoe===4&&[5,10].includes(a.lower)&&a.cosmeticShoe===undefined&&a.cosmeticBottom===undefined)errors.push('Boot/hem conflict');
 if(!Number.isInteger(a.age)||a.age<21||a.age>78)errors.push('Adult age missing');
 for(const key of cosmeticColorKeys)if(a[key]!==undefined&&(typeof a[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(a[key])))errors.push('Invalid '+key);
 for(const key of ['cosmeticHat','cosmeticTop','cosmeticBottom','cosmeticShoe'])if(a[key]!==undefined&&(!Number.isInteger(a[key])||a[key]<0||a[key]>=104))errors.push('Invalid garment geometry');
 if(a.facialHair!==undefined&&(!Number.isInteger(a.facialHair)||a.facialHair<0||a.facialHair>29))errors.push('Invalid facial hair');
 if(a.hat!==undefined&&![0,3,4,5].includes(a.hat))errors.push('Invalid fitted headwear');
 if(a.topPattern!==undefined&&!['plain','stripe','chevron','panel'].includes(a.topPattern))errors.push('Invalid top pattern');
 if(a.armorVest!=null&&!['simple','reinforced','swat'].includes(a.armorVest))errors.push('Invalid armor vest');
 return errors;
}
const cosmeticColorKeys=['hairHex','beardHex','topColor','topAccentColor','bottomColor','bottomAccentColor','shoeColor','shoeAccentColor','hatColor'];
const cosmeticAppearanceKeys=[...cosmeticColorKeys,'hat','topPattern','armorVest','cosmeticHat','cosmeticTop','cosmeticBottom','cosmeticShoe'];
function appearanceKey(a){const base=['look',a.body,a.face,a.skin,a.hair,a.hairColor,a.brows,a.facialHair,a.upper,a.lower,a.shoe,a.accessory,a.palette,Math.round(a.heightScale*20),Math.round(a.widthScale*20)].join(':');const worn=cosmeticAppearanceKeys.filter(key=>a[key]!=null).map(key=>key+'='+a[key]);return worn.length?base+'|'+worn.join('|'):base;}
function similarityKey(a){return [Math.floor(a.body/2),faceProfiles[a.face].base,Math.floor(a.hair/3),uppers[a.upper].shape,lowers[a.lower].shape].join(':');}
function generate(seed){const r=rng(seed),family=pick(families,r);let a={id:'citizen-look-'+seed,body:Math.floor(r()*bodies.length),face:Math.floor(r()*faceProfiles.length),skin:Math.floor(r()*skinPalettes.length),hair:Math.floor(r()*hair.length),hairColor:Math.floor(r()*hairPalettes.length),brows:Math.floor(r()*3),facialHair:Math.floor(r()*6)===0?1+Math.floor(r()*3):0,upper:pick(family.up,r),lower:pick(family.low,r),shoe:pick(family.shoe,r),accessory:pick(family.acc,r),movement:Math.floor(r()*8),palette:Math.floor(r()*palettes.length),heightScale:Math.round((.97+r()*.06)*1000)/1000,widthScale:Math.round((.96+r()*.08)*1000)/1000,age:21+Math.floor(r()*58),family:family.id};
 if([3,4,5].includes(a.accessory)&&!hair[a.hair].hatSafe)a.accessory=1;
 if(a.accessory===9&&[8,9,16,17].includes(a.upper))a.accessory=10;
 if(a.shoe===4&&[5,10].includes(a.lower))a.shoe=3;
 const clothing=globalThis.CityCosmetics||(typeof require==='function'?require('./cosmetic-catalog.js'):null);if(clothing&&seed%3===0){const category=['tops','bottoms','shoes','hats'][seed%4],choices=clothing.items.filter(x=>x.category===category&&(!x.novelty||seed%41===0));Object.assign(a,choices[seed%choices.length]?.appearance||{});if(a.shoe===4&&[5,10].includes(a.lower)&&a.cosmeticShoe===undefined)a.shoe=3;}a.appearanceKey=appearanceKey(a);a.similarityKey=similarityKey(a);return Object.freeze(a);
}
const catalog=[];const seen=new Set();for(let seed=1;catalog.length<4096;seed++){const a=generate(seed);if(!validateAppearance(a).length&&!seen.has(a.appearanceKey)){seen.add(a.appearanceKey);catalog.push(a);}}
const presets=[['Avery Vale',1,{body:1,face:26,skin:3,hair:2,hairColor:1,upper:12,lower:1,shoe:3,palette:3,accessory:10}],['Quinn Mercer',43,{body:4,face:43,skin:7,hair:8,hairColor:2,upper:13,lower:2,shoe:1,palette:11,accessory:0}],['Jules Vega',118,{body:7,face:71,skin:5,hair:4,hairColor:0,upper:9,lower:7,shoe:7,palette:7,accessory:0}],['Remy Stone',273,{body:2,face:49,skin:1,hair:18,hairColor:5,upper:3,lower:4,shoe:4,palette:4,accessory:1}],['Sasha Reid',382,{body:0,face:129,skin:9,hair:13,hairColor:1,upper:15,lower:3,shoe:5,palette:2,accessory:0}],['Morgan Cross',791,{body:6,face:80,skin:6,hair:19,hairColor:6,upper:10,lower:0,shoe:0,palette:1,accessory:10}]].map(([name,i,look],id)=>{const a={...catalog[i],...look,id:'player-'+id,name};a.appearanceKey=appearanceKey(a);a.similarityKey=similarityKey(a);return Object.freeze(a);});
const weapons=[
 {id:'swift',name:'Swift Sidearm',category:'sidearm',length:.23,aimMuzzle:[.22,1.36,.71],supportGrip:[-.01,-.045,.045],primaryGrip:[0,-.04,0]},
 {id:'kestrel',name:'Kestrel Compact',category:'compact',length:.48,aimMuzzle:[.22,1.37,.86],supportGrip:[-.025,.01,.20],primaryGrip:[0,-.05,0]},
 {id:'ridgeline',name:'Ridgeline Carbine',category:'carbine',length:.84,aimMuzzle:[.22,1.38,1.05],supportGrip:[-.025,.01,.32],primaryGrip:[0,-.055,0]},
 {id:'breakwater',name:'Breakwater Shotgun',category:'shotgun',length:.96,aimMuzzle:[.22,1.36,1.15],supportGrip:[-.025,.015,.37],primaryGrip:[0,-.055,0]},
 {id:'horizon',name:'Horizon Precision',category:'precision',length:1.05,aimMuzzle:[.22,1.39,1.24],supportGrip:[-.025,.01,.4],primaryGrip:[0,-.06,0]},
 {id:'comet',name:'Comet Launcher',category:'launcher',length:.95,aimMuzzle:[.26,1.47,1.11],supportGrip:[-.025,-.045,.32],primaryGrip:[0,-.105,0]}
].map(w=>Object.freeze({...w,crouchOffset:[0,-.36,0]}));
function weaponDefinition(id){return weapons.find(w=>w.id===id||w.category===id)||weapons[0];}
const pos=p=>({x:Number(p?.x)||0,y:Number(p?.y)||0,z:Number(p?.z)||0});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
class EncounterLedger{
 constructor(options={}){this.windowSeconds=options.windowSeconds||600;this.dwellSeconds=options.dwellSeconds||.75;this.cap=5;this.time=0;this.entries=[];this.head=0;this.counts=new Map();this.clusters=new Map();this.views=new Map();this.reservations=[];this.stats={introduced:0,persistentExceptions:0,continuityReturns:0,rejectedCandidates:0,maximumRepetitions:0,violations:0};this.playing=true;}
 advance(dt,context={playing:true}){this.playing=context.playing!==false;if(this.playing&&Number.isFinite(dt)&&dt>0)this.time+=Math.min(dt,1);this.expire();return this.time;}
 expire(){const cut=this.time-this.windowSeconds;while(this.head<this.entries.length&&this.entries[this.head].time<=cut){const e=this.entries[this.head++];if(e.type==='introduction'){this.increment(this.counts,e.appearanceKey,-1);this.increment(this.clusters,e.similarityKey,-1);}}if(this.head>256){this.entries=this.entries.slice(this.head);this.head=0;}this.reservations=this.reservations.filter(e=>e.time>cut);for(const [id,v]of this.views)if(this.time-(v.lastObserved??v.lastReadable)>this.windowSeconds+30&&!v.persistent)this.views.delete(id);while(this.views.size>8192)this.views.delete(this.views.keys().next().value);}
 increment(map,key,n){const v=(map.get(key)||0)+n;if(v>0)map.set(key,v);else map.delete(key);}
 observe(entity,observation,dt){if(!this.playing||!entity||!entity.id||!entity.appearance)return null;const o=observation||{},id=String(entity.id);let view=this.views.get(id);if(!view){view={lastReadable:-1e9,lastObserved:this.time,dwell:0,encountered:false,persistent:!!entity.persistent,position:pos(entity.position),lastPlayer:pos(o.playerPosition)};this.views.set(id,view);}view.lastObserved=this.time;const readable=o.readable!==false&&o.onScreen===true&&o.occluded===false&&Number.isFinite(o.distance)&&o.distance<=70&&o.distance>=0&&Number.isFinite(o.screenHeight)&&o.screenHeight>=.028;
 if(!readable){view.dwell=0;return null;}const absence=this.time-view.lastReadable;if(absence>Math.max(.25,(Number(dt)||0)*2.1))view.dwell=0;
 if(view.encountered&&absence>=30&&(distance(pos(o.playerPosition),view.lastPlayer)>=18||distance(pos(entity.position||entity),view.position)>=18))view.encountered=false;
 view.lastReadable=this.time;view.dwell+=clamp(Number(dt)||0,0,.1);if(view.encountered||view.dwell+1e-8<this.dwellSeconds)return null;
 const first=!view.everSeen,type=entity.persistent?'persistent-exception':first?'introduction':'continuity-return',a=entity.appearance,e={time:this.time,entityId:id,appearanceKey:appearanceKey(a),similarityKey:similarityKey(a),type};view.encountered=true;view.everSeen=true;view.position=pos(entity.position||entity);view.lastPlayer=pos(o.playerPosition);view.dwell=0;
 if(type==='introduction'){this.increment(this.counts,e.appearanceKey,1);this.increment(this.clusters,e.similarityKey,1);this.stats.introduced++;const n=this.counts.get(e.appearanceKey);this.stats.maximumRepetitions=Math.max(this.stats.maximumRepetitions,n);if(n>this.cap)this.stats.violations++;const reservation=this.reservations.findIndex(r=>r.appearanceKey===e.appearanceKey);if(reservation>=0)this.reservations.splice(reservation,1);}else if(type==='persistent-exception')this.stats.persistentExceptions++;else this.stats.continuityReturns++;
 this.entries.push(e);if(this.entries.length-this.head>16384){const removed=this.entries[this.head++];if(removed.type==='introduction'){this.increment(this.counts,removed.appearanceKey,-1);this.increment(this.clusters,removed.similarityKey,-1);}}return e;
 }
 select(pool=catalog,nearby=[],seed=this.stats.introduced+this.reservations.length){this.expire();const nearbyExact=new Map(),nearbySimilar=new Map(),reserved=new Map();for(const e of nearby){const a=e.appearance||e;this.increment(nearbyExact,appearanceKey(a),1);this.increment(nearbySimilar,similarityKey(a),1);}for(const e of this.reservations)this.increment(reserved,e.appearanceKey,1);const r=rng(seed),offset=Math.floor(r()*pool.length);let best=null,bestScore=Infinity;
 for(let i=0;i<pool.length;i++){const a=pool[(offset+i)%pool.length],key=appearanceKey(a),similar=similarityKey(a),exact=this.counts.get(key)||0,pending=reserved.get(key)||0,near=nearbySimilar.get(similar)||0;if(exact+pending>=this.cap||near>=2){this.stats.rejectedCandidates++;continue;}const score=exact*10000+pending*5000+(nearbyExact.get(key)||0)*10000+(this.clusters.get(similar)||0)*90+near*900;if(score<bestScore){best=a;bestScore=score;if(score===0)break;}}
 if(!best){for(let i=0;i<4096;i++){const a=generate('extension-'+seed+'-'+i),k=appearanceKey(a);if((this.counts.get(k)||0)+(reserved.get(k)||0)<this.cap&&(nearbySimilar.get(similarityKey(a))||0)<2){best=a;break;}}}
 if(!best)throw new Error('No valid population appearance candidate; defer spawn');this.reservations.push({appearanceKey:appearanceKey(best),time:this.time});return best;
 }
 release(appearance){const key=appearanceKey(appearance),i=this.reservations.findIndex(r=>r.appearanceKey===key);if(i>=0)this.reservations.splice(i,1);}
 diagnostics(){return {...this.stats,activeSeconds:this.time,recentIntroductions:Array.from(this.counts.values()).reduce((a,b)=>a+b,0),exactAppearances:this.counts.size,perceptualClusters:this.clusters.size,recentMax:Math.max(0,...this.counts.values()),trackedEntities:this.views.size,pendingSelections:this.reservations.length};}
 serialize(){return {version:1,time:this.time,entries:this.entries.slice(this.head),views:Array.from(this.views.entries()),reservations:this.reservations.slice(),stats:{...this.stats}};}
 restore(data){if(!data||data.version!==1||!Number.isFinite(data.time)||data.time<0||!Array.isArray(data.entries)||data.entries.length>16384||!Array.isArray(data.views)||data.views.length>8192)throw new Error('Invalid encounter history');this.time=data.time;this.entries=[];this.head=0;this.counts.clear();this.clusters.clear();for(const e of data.entries){if(!e||!Number.isFinite(e.time)||e.time>this.time||typeof e.entityId!=='string'||typeof e.appearanceKey!=='string'||typeof e.similarityKey!=='string'||!['introduction','persistent-exception','continuity-return'].includes(e.type))throw new Error('Invalid encounter entry');this.entries.push({...e});if(e.type==='introduction'){this.increment(this.counts,e.appearanceKey,1);this.increment(this.clusters,e.similarityKey,1);}}
 this.views=new Map(data.views.filter(([k,v])=>typeof k==='string'&&v&&Number.isFinite(v.lastReadable)).map(([k,v])=>[k,{...v,position:pos(v.position),lastPlayer:pos(v.lastPlayer)}]));this.reservations=Array.isArray(data.reservations)?data.reservations.filter(r=>r&&typeof r.appearanceKey==='string'&&Number.isFinite(r.time)&&r.time<=this.time).slice(0,8192):[];for(const key of Object.keys(this.stats))this.stats[key]=Math.max(0,Number(data.stats?.[key])||0);this.expire();return this;}
}
function validateCatalog(){const invalid=catalog.flatMap(a=>validateAppearance(a).map(error=>({id:a.id,error})));return {count:catalog.length,uniqueLooks:new Set(catalog.map(appearanceKey)).size,faceBases:headBases.length,faceProfiles:faceProfiles.length,bodies:bodies.length,hair:hair.length,uppers:uppers.length,lowers:lowers.length,footwear:footwear.length,accessories:accessories.length-1,movements:movements.length,coverage:Object.fromEntries(['body','face','hair','upper','lower','shoe','accessory','movement'].map(key=>[key,new Set(catalog.map(a=>a[key])).size])),invalid};}
// Bounded visual secondary dynamics. The central simulation calls this at its fixed step;
// all contact samples use the same world's ground and obstruction queries as living actors.
const ragdollLayout={pelvis:[0,.88,0],chest:[0,1.35,0],head:[0,1.65,.01],shoulderL:[-.23,1.36,0],shoulderR:[.23,1.36,0],elbowL:[-.25,1.08,.035],elbowR:[.25,1.08,.035],handL:[-.24,.82,.06],handR:[.24,.82,.06],hipL:[-.10,.88,0],hipR:[.10,.88,0],kneeL:[-.10,.48,.03],kneeR:[.10,.48,.03],ankleL:[-.10,.09,0],ankleR:[.10,.09,0]};
const ragdollLinks=[['pelvis','chest'],['chest','head'],['chest','shoulderL'],['chest','shoulderR'],['shoulderL','shoulderR'],['shoulderL','elbowL'],['shoulderR','elbowR'],['elbowL','handL'],['elbowR','handR'],['pelvis','hipL'],['pelvis','hipR'],['hipL','hipR'],['hipL','kneeL'],['hipR','kneeR'],['kneeL','ankleL'],['kneeR','ankleR'],['chest','hipL'],['chest','hipR'],['shoulderL','hipL'],['shoulderR','hipR']];
function createRagdoll(entity,pose){const origin=pos(entity.position||entity),yaw=entity.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),height=entity.appearance?bodies[entity.appearance.body].height*entity.appearance.heightScale/1.8:1,points={};for(const [name,p]of Object.entries(ragdollLayout)){const v=pose?.[name]||{x:origin.x+p[0]*c+p[2]*s,y:origin.y+p[1]*height,z:origin.z+p[2]*c-p[0]*s};points[name]={x:v.x,y:v.y,z:v.z,px:v.x-clamp(entity.vx||0,-10,10)/60,py:v.y-clamp(entity.vy||0,-8,8)/60,pz:v.z-clamp(entity.vz||0,-10,10)/60};}const constraints=ragdollLinks.map(([a,b])=>({a,b,length:Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y,points[a].z-points[b].z)}));const result={points,constraints,age:0,quiet:0,sleeping:false};entity.ragdoll=result;return result;}
function stepRagdoll(entity,dt,world){const r=entity.ragdoll;if(!r||r.sleeping||!Number.isFinite(dt)||dt<=0)return r;dt=Math.min(dt,1/30);r.age+=dt;let energy=0;for(const p of Object.values(r.points)){const vx=clamp((p.x-p.px)*.986,-.22,.22),vy=clamp((p.y-p.py)*.986,-.28,.28),vz=clamp((p.z-p.pz)*.986,-.22,.22);p.px=p.x;p.py=p.y;p.pz=p.z;p.x+=vx;p.y+=vy-9.81*dt*dt;p.z+=vz;energy+=vx*vx+vy*vy+vz*vz;}
 for(let iter=0;iter<6;iter++){for(const link of r.constraints){const a=r.points[link.a],b=r.points[link.b],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz)||1,f=(d-link.length)/d*.48;a.x+=dx*f;a.y+=dy*f;a.z+=dz*f;b.x-=dx*f;b.y-=dy*f;b.z-=dz*f;}for(const [name,p]of Object.entries(r.points)){const radius=name==='head'?.12:name==='pelvis'||name==='chest'?.13:.065,ground=world?.groundHeight?world.groundHeight(p.x,p.z,p.y+.3):0;if(p.y<ground+radius){p.y=ground+radius;p.px=mixScalar(p.px,p.x,.2);p.pz=mixScalar(p.pz,p.z,.2);p.py=p.y;}if(world?.lineOfSight&&world.lineOfSight({x:p.px,y:p.py,z:p.pz},p)===false){p.x=p.px;p.z=p.pz;}}}
 if(energy<.00008)r.quiet+=dt;else r.quiet=0;if(r.quiet>.5||r.age>9){r.sleeping=true;for(const p of Object.values(r.points)){p.px=p.x;p.py=p.y;p.pz=p.z;}}return r;}
const mixScalar=(a,b,t)=>a+(b-a)*t;
return {catalog,presets,headBases,faceProfiles,bodies,hair,uppers,lowers,footwear,accessories,movements,palettes,skinPalettes,hairPalettes,families,weapons,weaponDefinition,generate,createAppearance:generate,appearanceKey,similarityKey,validateAppearance,validateCatalog,EncounterLedger,createRagdoll,stepRagdoll,hash,rng};
});

