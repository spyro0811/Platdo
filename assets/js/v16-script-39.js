
/* Presentation-only budgets. Shared Platdo resolution/FPS remain authoritative. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.CityGraphics=api;})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
const rows=[
 ['potato',.5,0,0,0,.05,[12,30],8,2,0,0],
 ['low',.65,512,45,1,.15,[18,45],16,3,64,1],
 ['medium',.8,1024,65,2,.35,[26,65],32,5,128,2],
 ['high',1,2048,95,3,.6,[38,95],64,7,256,3],
 ['expert',1,2048,114,3,.75,[44,110],80,9,512,4],
 ['ultra',1,4096,133,4,.9,[52,130],96,12,512,5],
 ['insane',1,4096,152,5,1,[61,152],100,16,1024,6]
];
const presets=Object.freeze(Object.fromEntries(rows.map(([id,scale,shadowSize,shadowExtent,detailRadius,detailFraction,peopleLOD,effectCap,particles,environmentSize,materialDetail])=>[id,Object.freeze({id,label:id[0].toUpperCase()+id.slice(1),scale,shadowSize,shadowExtent,detailRadius,detailFraction,peopleLOD:Object.freeze(peopleLOD),effectCap,particles,environmentSize,materialDetail,shadowFilter:materialDetail>=4?'soft':'pcf',shadowRadius:materialDetail>=5?2:1,anisotropy:[1,2,4,8,8,12,16][materialDetail]})])));
const profiles={
 potato:{scale:.5,distance:160,lighting:'ambient',shadows:'off',detail:'low',particles:'low',reflections:'off'},
 low:{scale:.65,distance:320,lighting:'sun',shadows:'off',detail:'low',particles:'low',reflections:'off'},
 medium:{scale:.8,distance:800,lighting:'sun',shadows:'medium',detail:'medium',particles:'medium',reflections:'low'},
 high:{scale:1,distance:1200,lighting:'full',shadows:'high',detail:'high',particles:'high',reflections:'low'},
 expert:{scale:1,distance:1600,lighting:'full',shadows:'high',detail:'high',particles:'high',reflections:'high'},
 ultra:{scale:1.1,distance:2000,lighting:'full',shadows:'ultra',detail:'high',particles:'high',reflections:'high'},
 insane:{scale:1.25,distance:2400,lighting:'full',shadows:'ultra',detail:'high',particles:'high',reflections:'high'}
};
const fields={
 pedestrians:{type:'range',label:'Pedestrian density',min:0,max:44,step:1,default:44,unit:'peds',help:'0–44 ambient pedestrians; 44 is the original population budget. Story contacts, shop staff, mission actors, police and seated vehicle occupants remain available.'},
 distance:{type:'range',label:'Render distance',min:160,max:2400,step:40,default:800,unit:'m',help:'Distant buildings, terrain chunks and props stop drawing. Physics, NPC state and collisions remain active. Nearby threats stay visible.'},
 lighting:{type:'select',label:'Lighting',options:[{value:'ambient',label:'Ambient (fastest)'},{value:'sun',label:'Sunlight'},{value:'full',label:'Sunlight + headlights'}],default:'sun',help:'Ambient removes directional and spot-light work; full adds vehicle headlights. Brightness is separate.'},
 shadows:{type:'select',label:'Shadows',options:['off','low','medium','high','ultra'],default:'medium',help:'Off stops the shadow pass. Low–Ultra use 512–4096 pixel maps, limited by your browser.'},
 detail:{type:'select',label:'World detail',options:['low','medium','high'],default:'medium',help:'Changes optional facade range and distant character detail. Nearby actors and collisions stay intact.'},
 modelDetail:globalThis.PlatdoGraphics?.modelDetailField||{type:'range',label:'Model detail (faces)',min:0,max:5,step:1,default:0,help:'Automatic follows the recommended quality preset. Lower values use fewer geometry segments on characters, vehicles and curved scenery; collision shapes and controls stay the same.'},
 smokeParticles:globalThis.PlatdoGraphics?.smokeParticleField||{type:'range',label:'Drift smoke particles',min:-1,max:1000,step:1,default:-1,help:'Automatic follows the detected hardware. 0 turns drift smoke off.'},
 particles:{type:'select',label:'Effects detail',options:['low','medium','high'],default:'medium',help:'Reduces decorative impact particles, rain and casings. Projectiles and essential hit feedback remain visible.'},
 reflections:{type:'select',label:'Material reflections',options:['off','low','high'],default:'low',help:'Controls the procedural environment reflection map. This is not a real-time mirror.'}
};
function modelLevel(v,preset){return Math.max(1,Math.min(5,Math.round(Number(v.modelDetailLevel)||(Number(v.modelDetail)>0?Number(v.modelDetail):({potato:1,low:2,medium:3,high:4,expert:4,epic:4,ultra:5,insane:5}[v.modelDetailPreset||preset]||3)))));}
function resolve(v){const source=v.preset==='custom'?v.modelDetailPreset:v.preset,level=v.detail==='low'?(source==='potato'?presets.potato:presets.low):v.detail==='high'?presets.high:presets.medium,shadow={off:0,low:512,medium:1024,high:2048,ultra:4096}[v.shadows]||0;return{...level,id:v.preset||'custom',modelDetail:modelLevel(v,v.preset),smokeParticleBudget:Math.max(0,Math.min(1000,Number.isFinite(v.smokeParticleBudget)?v.smokeParticleBudget:Number(v.smokeParticles)>=0?Number(v.smokeParticles):({potato:12,low:32,medium:72,high:128,expert:192,ultra:256,insane:384}[source]||72))),scale:v.scale,shadowSize:v.lighting==='ambient'?0:shadow,shadowExtent:Math.min(v.distance*.4,shadow>=4096?133:shadow>=2048?95:65),environmentSize:{off:0,low:128,high:512}[v.reflections]||0,effectCap:{low:8,medium:32,high:64}[v.particles]||8,particles:{low:2,medium:5,high:9}[v.particles]||2,distance:v.distance,lighting:v.lighting,detailRadius:Math.min(level.detailRadius,Math.ceil(v.distance/128)),materialDetail:v.detail==='high'?5:level.materialDetail};}
return{presets,profiles,fields,resolve,modelLevel,names:Object.keys(presets),get:id=>{const p=presets[id]||presets.medium;return{...p,modelDetail:modelLevel({},p.id)};}};});

