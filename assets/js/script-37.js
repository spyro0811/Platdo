
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.CityConfig=api;})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
const VERSION='0.1.0',DT=1/60;
const T={dt:DT,gravity:22,jump:7,walk:2,jog:4.5,sprint:7,crouch:1.4,swim:2,acceleration:25,radius:.35,height:1.78,crouchHeight:1.13,coyote:.10,jumpBuffer:.12,interact:2.2,pickup:1.5,daySeconds:2160,worldLimit:1920,maxNPC:44,maxTraffic:22,maxDrops:40,maxProjectiles:48};
const bindings={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',jump:'Space',crouch:'ControlLeft',reload:'KeyR',interact:'KeyF',vehicle:'KeyE',vehicleJump:'KeyJ',seatbelt:'KeyT',leanBack:'ArrowDown',leanForward:'ArrowUp',previousItem:'WheelUp',nextItem:'WheelDown',throw:'KeyG',holster:'KeyH',cover:'KeyQ',shoulder:'KeyV',camera:'KeyC',map:'KeyM',phone:'Tab',wheel:'KeyP',lights:'KeyL',radio:'KeyB'};
const settings={difficulty:'normal',hints:true,subtitles:true,assist:false,autoParachute:false,effects:true,autosave:true,autosaveMinutes:5,quality:'medium',scale:1,fps:false,fov:70,brightness:1,shake:.35,bob:.25,reducedMotion:false,highContrast:false,uiScale:1,master:.65,music:.25,sfx:.65,ambience:.35,dialogue:.5,radio:.28,menuMusic:.25,mute:false,sensitivity:1,invertY:false,toggleAim:false,toggleCrouch:false,steeringAssist:true,flightAssist:true,autoCenter:true,bindingsVersion:4,bindings};
const weapons=[
 {id:'unarmed',name:'Fists',category:'unarmed',capacity:0,reserveLimit:0,damage:12,range:1.8,cooldown:.55,reload:0,commit:0,automatic:false,price:0},
 {id:'swift',name:'Swift Sidearm',category:'pistol',capacity:9,reserveLimit:180,damage:24,range:130,cooldown:.23,reload:1.55,commit:1.12,automatic:false,spread:.009,price:250},
 {id:'kestrel',name:'Kestrel Compact',category:'smg',capacity:30,reserveLimit:300,damage:12,range:110,cooldown:60/700,reload:1.8,commit:1.32,automatic:true,spread:.025,price:650},
 {id:'ridgeline',name:'Ridgeline Carbine',category:'rifle',capacity:30,reserveLimit:240,damage:20,range:240,cooldown:60/450,reload:2.1,commit:1.58,automatic:true,spread:.012,price:950},
 {id:'breakwater',name:'Breakwater Shotgun',category:'shotgun',capacity:6,reserveLimit:60,damage:13,pellets:7,range:48,cooldown:.85,reload:2.5,commit:1.9,automatic:false,spread:.07,price:800},
 {id:'horizon',name:'Horizon Precision',category:'precision',capacity:5,reserveLimit:40,damage:70,range:450,cooldown:1.15,reload:2.7,commit:2.05,automatic:false,spread:.0015,price:1400},
 {id:'comet',name:'Comet Launcher',category:'launcher',capacity:1,reserveLimit:8,damage:120,range:500,cooldown:1,reload:3,commit:2.2,automatic:false,spread:0,price:2200}
];
const weaponById=Object.fromEntries(weapons.map(w=>[w.id,w]));
// One authoritative catalog drives prices, exact pack quantities, ownership and previews.
const cosmeticSlots=['upper','lower','shoe','hat','accessory'];
const cosmetic=(id,name,category,slot,price,description,appearance)=>({id,name,kind:'cosmetic',category,slot,price,description,appearance,store:'clothing'});
const cosmetics=[
 ...cosmeticSlots.map(slot=>({...cosmetic('default-'+slot,({upper:'Original top',lower:'Original bottoms',shoe:'Original footwear',hat:'Original headwear',accessory:'Original accessory'})[slot],'owned',slot,0,'Your starting outfit. Always yours to wear.',{}),starter:true})),
 cosmetic('hat-quay-cap','Quay cap','hats','hat',45,'A fitted six-panel cap with a curved brim.',{hat:3,hatColor:'#294c61'}),
 cosmetic('hat-dock-beanie','Dock beanie','hats','hat',55,'A close-knit wool cap with a rolled edge.',{hat:4,hatColor:'#b36c43'}),
 cosmetic('hat-traveler','Traveler hat','hats','hat',95,'A broad brim and a dark woven band.',{hat:5,hatColor:'#c3a980'}),
 cosmetic('shoe-canvas','Quay canvas shoes','shoes','shoe',70,'Low canvas shoes with cream soles.',{shoe:0,shoeColor:'#35546b',shoeAccentColor:'#e1d5bb'}),
 cosmetic('shoe-runners','Track runners','shoes','shoe',115,'Light running shoes with sculpted contrast soles.',{shoe:1,shoeColor:'#d0d3ca',shoeAccentColor:'#b8593c'}),
 cosmetic('shoe-boots','Redbrick work boots','shoes','shoe',155,'Sturdy ankle-height leather boots.',{shoe:4,shoeColor:'#6b4934',shoeAccentColor:'#252d30'}),
 cosmetic('pants-denim','Straight indigo jeans','pants','lower',95,'Straight-cut denim with visible pocket stitching.',{lower:0,bottomColor:'#314c69',bottomAccentColor:'#c5a36c'}),
 cosmetic('pants-chinos','Sand chinos','pants','lower',110,'Tapered casual trousers with a clean silhouette.',{lower:2,bottomColor:'#b6a581',bottomAccentColor:'#786a54'}),
 cosmetic('pants-cargo','Field cargo pants','pants','lower',145,'Utility trousers with raised side pockets.',{lower:4,bottomColor:'#58634c',bottomAccentColor:'#343d32'}),
 cosmetic('tee-quay','Quay crew T-shirt','tshirts','upper',50,'A cream short-sleeve crew tee with blue chest stripes.',{upper:0,topColor:'#d6d4c2',topAccentColor:'#365d73',topPattern:'stripe'}),
 cosmetic('tee-rust','Rust V-neck T-shirt','tshirts','upper',65,'A warm rust V-neck with a contrasting chevron.',{upper:1,topColor:'#a34f3b',topAccentColor:'#e0bd82',topPattern:'chevron'}),
 cosmetic('tee-night','Night panel T-shirt','tshirts','upper',75,'A charcoal crew tee with a bold cobalt panel.',{upper:0,topColor:'#303744',topAccentColor:'#407e99',topPattern:'panel'}),
 cosmetic('outer-hoodie','Harbor hoodie','outerwear','upper',150,'A substantial hood and long sleeves in deep teal.',{upper:8,topColor:'#326b70',topAccentColor:'#c0d0c4',topPattern:'plain'}),
 cosmetic('outer-bomber','Nightshift bomber','outerwear','upper',220,'A cropped bomber with fitted cuffs and a raised collar.',{upper:13,topColor:'#4c5149',topAccentColor:'#b49469',topPattern:'plain'}),
 cosmetic('shorts-walking','Summer walking shorts','shorts','lower',80,'Knee-length shorts in pale stone.',{lower:8,bottomColor:'#b5b8a7',bottomAccentColor:'#576b65'}),
 cosmetic('shorts-track','Track shorts','shorts','lower',70,'Shorter athletic shorts with bright edging.',{lower:9,bottomColor:'#334b60',bottomAccentColor:'#d2b56c'}),
 cosmetic('accessory-glasses','Clear-frame glasses','accessories','accessory',60,'Everyday glasses attached to the face.',{accessory:1}),
 cosmetic('accessory-sunglasses','City sunglasses','accessories','accessory',90,'Dark lenses with a strong frame.',{accessory:2}),
 cosmetic('accessory-crossbody','Crossbody satchel','accessories','accessory',125,'A compact bag on a diagonal shoulder strap.',{accessory:7})
];
const armorVests=[
 {id:'simple',name:'Simple armor vest',price:180,armorMax:40,description:'Light torso protection with a plain carrier. Absorbs up to 40 eligible damage.'},
 {id:'reinforced',name:'Reinforced armor vest',price:420,armorMax:75,description:'Thicker protective panels and reinforced straps. Absorbs up to 75 eligible damage.'},
 {id:'swat',name:'SWAT armor vest',price:950,armorMax:100,description:'Heavy tactical panels, pouches and shoulder protection. Absorbs up to 100 eligible torso damage.'}
];
const armorById=Object.fromEntries(armorVests.map(v=>[v.id,v]));
const ammoPacks={swift:{quantity:27,price:25,unit:'rounds'},kestrel:{quantity:90,price:52,unit:'rounds'},ridgeline:{quantity:90,price:76,unit:'rounds'},breakwater:{quantity:18,price:64,unit:'shells'},horizon:{quantity:15,price:112,unit:'rounds'},comet:{quantity:3,price:176,unit:'rockets'}};
const shopItems=[...cosmetics,
 ...weapons.filter(w=>w.capacity).map(w=>({id:'weapon-'+w.id,kind:'weapon',category:'weapons',store:'equipment',name:w.name,weaponId:w.id,price:w.price,magazine:w.capacity,startingReserve:Math.min(w.reserveLimit,w.capacity*3),description:`${w.automatic?'Automatic':'Single-fire'} ${w.category}. Includes ${w.capacity} loaded and ${Math.min(w.reserveLimit,w.capacity*3)} reserve rounds. Buying does not equip it.`})),
 ...armorVests.map(v=>({...v,id:'armor-'+v.id,vestId:v.id,kind:'armor',category:'armor',store:'equipment',appearance:{armorVest:v.id}})),
 ...Object.entries(ammoPacks).map(([id,p])=>({id:'ammo-'+id,kind:'ammo',category:'ammunition',store:'equipment',name:weaponById[id].name+' ammunition',weaponId:id,description:`${p.quantity} ${p.unit} for ${weaponById[id].name}. Added to reserve; does not reload your weapon.`,...p})),
 {id:'supply-medkit',kind:'supply',supply:'medkit',category:'supplies',store:'equipment',name:'Recovery kit',price:50,quantity:1,description:'One recovery kit. Use it separately from your inventory; maximum 3.'},
 {id:'supply-parachute',kind:'supply',supply:'parachute',category:'supplies',store:'equipment',name:'Parachute',price:200,quantity:1,description:'Reusable parachute equipment. Buying does not change your health.'},
 {id:'supply-throwables',kind:'supply',supply:'throwables',category:'ammunition',store:'equipment',name:'Three fragmentation grenades',price:90,quantity:3,unit:'grenades',description:'Three throwable grenades for the Throw control. Maximum 12.'}
];
const shopItemById=Object.fromEntries(shopItems.map(item=>[item.id,item]));
const achievements=[['first-job','New keys'],['land-classes','Street collection'],['air-classes','Above the city'],['boat-job','Harbor hand'],['five-caches','Curious visitor'],['all-caches','Every corner'],['plane-landed','A soft arrival'],['five-jumps','Long way down'],['all-jumps','Clear air'],['story','City of your own'],['all-presets','Six perspectives'],['job-chain','Honest work']];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,dist=(a,b)=>Math.hypot(a.x-b.x,(a.y||0)-(b.y||0),a.z-b.z),flatDist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
function clone(v){return JSON.parse(JSON.stringify(v));}
return{VERSION,T,DT,settings,bindings,weapons,weaponById,cosmeticSlots,cosmetics,armorVests,armorById,shopItems,shopItemById,achievements,clamp,mix,dist,flatDist,wrap,hash,rng,clone};});

