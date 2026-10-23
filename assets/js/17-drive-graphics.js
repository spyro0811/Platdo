
/* Shared, device-local graphics preferences. Simulation and garage saves are separate. */
(()=>{'use strict';
window.createDriveGraphicsControl=function(hooks){
 const options=Object.keys(window.DriveGraphicsProfiles),presets={};
 for(const [id,p] of Object.entries(window.DriveGraphicsProfiles))presets[id]={scale:p.scale,distance:p.far,lighting:id==='potato'?'simple':'standard',shadows:p.shadow,detail:id,particles:p.effects===0?'off':p.effects<=.4?'low':p.effects<1?'medium':'high',reflections:p.reflection,ao:p.ao};
 const saved=hooks.legacy||'medium',defaults={...presets[saved]||presets.medium,preset:options.includes(saved)?saved:'medium'};
 return Platdo.graphics.register('platdo-drive',{name:'platdo Drive',defaults,presets,fields:{
  distance:{type:'range',min:150,max:1600,step:10,default:530,label:'Render distance',unit:'m',help:'Culls distant scenery and traffic meshes. Roads, collision and traffic simulation stay active; high speed adds a safe visual margin.'},
  lighting:{type:'select',options:[{value:'simple',label:'Ambient only'},{value:'standard',label:'Sun + ambient'}],default:'standard',label:'Lighting',help:'Ambient keeps the road readable; sun lighting adds directional shading.'},
  shadows:{type:'select',options:[{value:0,label:'Off'},512,1024,2048,4096],default:1024,label:'Shadow map',help:'Off stops shadow-map drawing. Ambient-only lighting disables sun shadows.'},
  detail:{type:'select',options,default:'medium',label:'Scenery and model detail',help:'Controls foliage density, car components and road-surface details.'},
  particles:{type:'select',options:['off','low','medium','high'],default:'medium',label:'Cosmetic particles',help:'Limits tire smoke, damage smoke and sparks. Physical car parts and collision stay active.'},
  reflections:{type:'select',options:[{value:0,label:'Off'},{value:128,label:'Low · 128 px'},{value:256,label:'Medium · 256 px'},{value:512,label:'High · 512 px'}],default:0,label:'Reflections',help:'Optional cubemap reflections; supported HDR is used when available.'},
  ao:{type:'select',options:[{value:0,label:'Off'},{value:8,label:'Low · 8 samples'},{value:16,label:'Medium · 16 samples'},{value:24,label:'High · 24 samples'}],default:0,label:'Contact shading',help:'Requires WebGL 2 with floating-point render targets. Unsupported devices use the direct renderer.'}
 },apply:hooks.apply,measure:hooks.measure});
};
})();

