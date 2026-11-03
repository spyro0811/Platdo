
/* Three-dimensional jungle graphics, independent of authoritative 2D traversal. */
(()=>{'use strict';
window.createSwingGraphicsControl=function(hooks){
 const presets={potato:{scale:.5,distance:4,lighting:'simple',shadows:0,detail:'low',particles:'off',background:'low'},low:{scale:.72,distance:7,lighting:'simple',shadows:0,detail:'low',particles:'low',background:'low'},medium:{scale:.88,distance:14,lighting:'standard',shadows:1024,detail:'medium',particles:'high',background:'medium'},high:{scale:1,distance:24,lighting:'standard',shadows:2048,detail:'high',particles:'high',background:'high'},ultra:{scale:1.2,distance:50,lighting:'standard',shadows:2048,detail:'ultra',particles:'high',background:'high'}};
 const legacy=Object.hasOwn(presets,hooks.legacy)?hooks.legacy:'medium';
 return Platdo.graphics.register('platdo-swing',{name:'Platdo Swing',defaults:{...presets[legacy],preset:legacy},presets,fields:{
  distance:{type:'range',min:4,max:70,step:1,default:14,label:'Render distance',unit:'world units beyond screen',help:'Changes the offscreen world margin. Platforms, vines, hazards and pickups inside the viewport always remain visible and simulated.'},
  lighting:{type:'select',options:[{value:'simple',label:'Ambient only'},{value:'standard',label:'Sun + ambient'}],default:'standard',label:'Lighting',help:'Ambient is cheaper; sunlight adds directional shape and shading.'},
  shadows:{type:'select',options:[{value:0,label:'Off'},512,1024,2048],default:1024,label:'Shadow map',help:'Off stops shadow rendering. Sun shadows require Sun + ambient lighting.'},
  detail:{type:'select',options:['low','medium','high','ultra'],default:'medium',label:'Vine detail',help:'Changes rendered vine segments and decorative vine leaves; the catch path and swing physics are unchanged.'},
  particles:{type:'select',options:['off','low','high'],default:'high',label:'Celebration particles',help:'Limits decorative pickup and landing particles. Collectibles and grip markers remain readable.'},
  background:{type:'select',options:['low','medium','high'],default:'medium',label:'Background foliage',help:'Controls canopy layers, crown density and foreground foliage.'}
 },apply:hooks.apply,measure:hooks.measure});
};
})();

