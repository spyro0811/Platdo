
/* Palm Cove uses City world metres. Its front faces positive world Z. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.CityCasinoWorld=api;})(globalThis,function(){'use strict';
function point(site,x,z,height=0){return{x:site.x+x,y:site.y+height,z:site.z+9-z};}
function install(world,box,ground){
 const site={id:'palm-cove-casino',name:'Palm Cove Casino',type:'casino',casino:true,x:-40,z:697,y:ground(-40,697),w:24.6,d:18.6,h:5.2,stations:[]};
 world.casino=site;site.entrance=point(site,0,-1);site.approach={x:site.x,y:site.y+.06,z:720};
 world.facilities.push(site);world.interiors.push(site);
 world.buildings.push({...site,interior:true,style:'casino',roofY:site.y+5.48});
 const solid=(id,x,z,w,h,d,bottom=0,material='masonry',extra={})=>{const p=point(site,x,z,bottom);return box('casino:'+id,p.x,p.y,p.z,w,h,d,material,extra);};
 solid('floor',0,9,24.6,.1,18.6,-.1,'cloth',{floor:true});solid('roof',0,9,24.6,.28,18.6,5.2,'masonry',{floor:true});
 solid('canopy',0,-1.31,8,.47,2.64,3.60,'metal',{floor:true});
 for(const side of [-1,1]){solid('parapet-side'+side,side*12.16,9,.30,.55,18.4,5.48);solid('parapet-end'+side,0,9+side*9.18,24.56,.55,.30,5.48);}
 solid('back',0,18.15,24.6,5.45,.3);solid('lintel',0,-.15,4,2.25,.3,3.2);
 for(const side of [-1,1]){solid('side'+side,side*12.15,9,.3,5.45,18.6);solid('front'+side,side*7.15,-.15,10.3,5.45,.3);}
 const door={...point(site,0,-.12),id:'casino:entrance',serviceId:site.id,w:4,h:3.2,open:true,progress:1,slide:1,panels:[]};
 for(const side of [-1,1])door.panels.push(solid('glass'+side,3*side,-.12,2,3.2,.12,0,'glass',{door:true}));
 // Existing door API expects a primary collider. The two actual panels follow the slide continuously.
 door.collider=door.panels[0];site.door=door;world.doors.push(door);
 solid('welcome',-8.5,2.8,3,1.05,1);solid('roulette',-6,10,4.8,1,2.8);
 site.stations.push({id:'roulette',...point(site,-4.9,7.8)});
 for(const [bank,x,stool,approach] of [['A',6.2,4.9,3.9],['B',7.2,8.5,9.5]]){
  [6.2,8,9.8,11.6].forEach((z,i)=>{const id='slot-'+bank+(i+1);solid(id,x,z,.9,2.1,1);solid(id+'-stool',stool,z,.6,.55,.6);site.stations.push({id,...point(site,approach,z)});});
 }
 for(const x of [-3,3]){solid('bench'+x,x,16.8,3,1,1);solid('table'+x,x,15.4,1.2,.48,.7);}
 for(const [x,z] of [[-10.5,5.3],[-10.5,15.5],[10.5,3],[10.5,15.5]])solid('planter'+x+'_'+z,x,z,.8,.8,.8);
 return site;
}
function slide(site,dt,player){
 const door=site.door,to=Number(door.open),sign=Math.sign(to-door.slide);
 if(!sign)return;
 if(!door.open&&player&&Math.abs(player.z-door.z)<.55&&Math.abs(player.x-door.x)<2.45){door.open=true;return;}
 door.slide+=sign*Math.min(Math.abs(to-door.slide),dt*2.8);
 door.panels.forEach((b,i)=>{const side=i?1:-1;b.enabled=true;b.x=door.x+side*(1+2*door.slide);b.minX=b.x-1;b.maxX=b.x+1;});
}
function station(sim){
 const site=sim.world.casino,p=sim.player;
 if(!site||p.mode!=='onFoot'||p.transition||p.health<=0||Math.abs(p.y-site.y)>.7||Math.abs(p.x-site.x)>12||Math.abs(p.z-site.z)>9)return null;
 let best=null,dist=Infinity;
 for(const s of site.stations){const dx=p.x-s.x,dz=p.z-s.z;if(s.id!=='roulette'&&(Math.abs(dz)>.83||Math.abs(dx)>1.1))continue;const d=Math.hypot(dx,dz);if(d<(s.id==='roulette'?1.3:1.12)&&d<dist){best=s;dist=d;}}
 return best;
}
return{install,point,slide,station};
});

