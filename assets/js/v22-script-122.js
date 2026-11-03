
/* All dimensions and interaction anchors are in the same house-local metres.
   Only installation transforms colliders to world space. The renderer uses
   the identical recipe below a Three.js group with that same transform. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object')module.exports=api;
  root.CityHomes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const FLOOR=3.24, CEILING=6.24;
const defaultRoot={x:-187,y:2.58,z:157,yaw:Math.PI};
const stairs={left:5.35,right:6.85,start:3,end:8.10,rise:.18,depth:.30,count:17,railXs:[5.30,6.90],opening:[5.15,7.10,3,8.10]};
const roomData=[
  ['Living room',0,4.9,0,5.9,0],['Dining room',0,4.9,6.1,12,0],
  ['Foyer',5.1,8.7,0,12,0],['Computer room',8.9,14,0,3.5,0],
  ['Utility passage',8.9,14,3.7,5.1,0],['Half-bath',8.9,11,5.3,7.3,0],
  ['Laundry',11.2,14,5.3,7.3,0],['Kitchen',8.9,14,7.5,12,0],
  ['Front-left bedroom',0,4.9,0,5.9,FLOOR],['Primary bedroom',0,4.9,6.1,12,FLOOR],
  ['Upstairs landing',5.1,8.7,0,12,FLOOR],['Front-right bedroom',8.9,14,0,5.9,FLOOR],
  ['Linen and dressing room',8.9,14,6.1,8.3,FLOOR],['Upstairs bathroom',8.9,14,8.5,12,FLOOR]
];
function point(p,x,y,z){
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
 return {x:p.x-c*x+s*z,y:p.y+y,z:p.z+s*x+c*z};
}
function inverse(p,x,y,z){
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
 return {x:-(x-p.x)*c+(z-p.z)*s,y:y-p.y,z:(x-p.x)*s+(z-p.z)*c};
}
function buildPlan(size={}){
 const width=Math.max(6.6,size.width||0),depth=Math.max(7.6,size.depth||0),west=14.2,east=west+width;
 const parts=[],doors=[],windows=[],rooms=roomData.concat([['Garage',west,east,0,depth,0]]);
 function add(id,x,y,z,w,h,d,color,solid=false,extra={}){
   if(w<1e-5||h<1e-5||d<1e-5)return;
   const p={id:'home:'+id,x,y,z,w,h,d,color,solid,...extra};
   parts.push(p);return p;
 }
 function cuboid(id,x0,x1,y0,y1,z0,z1,color,solid=true,extra={}){
   return add(id,(x0+x1)/2,y0,(z0+z1)/2,x1-x0,y1-y0,z1-z0,color,solid,extra);
 }
 function beam(id,a,b,w,d,color,solid=false){
   const h=Math.hypot(b.y-a.y,b.z-a.z);
   return add(id,(a.x+b.x)/2,(a.y+b.y-h)/2,(a.z+b.z)/2,w,h,d,color,solid,{rx:Math.atan2(b.z-a.z,b.y-a.y),rail:true});
 }
 const D=(id,center,width,hinge,swing,label)=>({id,center,width,hinge,swing,label,kind:'door',bottom:0,top:2.20});
 const O=(id,center,width)=>({id,center,width,kind:'open',bottom:0,top:2.20});
 const W=(id,center,width,bottom=1.02,top=2.28,privacy=false)=>({id,center,width,kind:'window',bottom,top,privacy});
 function wall(name,axis,coord,lo,hi,base,height,holes=[],outer=false){
   const wallTone=outer?'#ede6d6':'#e9dfce',span=(id,a,b,y,h,thick,color,solid,extra={},shift=0)=>{
     if(b-a<=1e-5||h<=1e-5)return;
     return axis==='x'?add(id,(a+b)/2,y,coord+shift,b-a,h,thick,color,solid,extra):add(id,coord+shift,y,(a+b)/2,thick,h,b-a,color,solid,extra);
   };
   const segment=(suffix,a,b,y,h)=>span(name+suffix,a,b,y,h,.20,wallTone,true,{wall:true});
   let start=lo;
   for(const r of [...holes].sort((a,b)=>a.center-b.center)){
     const a=r.center-r.width/2,b=r.center+r.width/2,bot=base+r.bottom,top=base+r.top;
     segment('-wall-to-'+r.id,start,a,base,height);segment('-below-'+r.id,a,b,base,r.bottom);
     segment('-above-'+r.id,a,b,top,height-r.top);
     for(const side of [a,b])span(r.id+'-jamb'+side,side-.034,side+.034,bot,r.top-r.bottom,.236,'#faf4e6',false);
     span(r.id+'-casing',a-.065,b+.065,top,.075,.24,'#faf4e6',false);
     if(r.kind==='window'){
       windows.push({...r,axis,coord,base});
       span(r.id+'-glass',a+.025,b-.025,bot,r.top-r.bottom,.026,r.privacy?'#d6e4dc':'#b7d8df',true,{glass:true,privacy:r.privacy});
       span(r.id+'-sill',a-.09,b+.09,bot-.055,.075,.32,'#f5ecdb',false);
       span(r.id+'-mullion',r.center-.022,r.center+.022,bot,r.top-r.bottom,.065,'#f3ebdd',false);
       span(r.id+'-transom',a,b,bot+(top-bot)*.58,.045,.065,'#f3ebdd',false);
     }else if(r.kind==='door'){
       doors.push({...r,id:'home:'+r.id,x:axis==='x'?r.center:coord,y:base,z:axis==='z'?r.center:coord,axis,w:r.width,h:r.top,open:false,progress:0});
     }
     if(a>start)span(name+'-base-'+r.id,start,a,base+.015,.095,.216,'#bcad96',false);
     start=b;
   }
   segment('-tail',start,hi,base,height);
   span(name+'-base-tail',start,hi,base+.015,.095,.216,'#bcad96',false);
 }
 const slabs={architecturePart:true,floor:true};
 cuboid('lower-floor',-.2,14.2,-.16,0,-.2,12.2,'#c2a37d',true,slabs);
 cuboid('upper-west',-.2,5.15,3.04,FLOOR,-.2,12.2,'#c6aa85',true,slabs);
 cuboid('upper-east',7.1,14.2,3.04,FLOOR,-.2,12.2,'#c6aa85',true,slabs);
 cuboid('upper-front',5.15,7.1,3.04,FLOOR,-.2,3,'#c6aa85',true,slabs);
 cuboid('upper-back',5.15,7.1,3.04,FLOOR,8.1,12.2,'#c6aa85',true,slabs);
 cuboid('attic-floor',-.2,14.2,CEILING,CEILING+.14,-.2,12.2,'#eee6d9',true,slabs);
 for(const [name,a,b,c,d,f] of rooms){
   if(name==='Garage'||name==='Foyer'||name==='Upstairs landing')continue;
   const tiled=/bath|Laundry|Kitchen/.test(name),color=tiled?'#bdc5b9':f?'#bb997a':'#bfa17d';
   cuboid('finish-'+name,a,b,f+.001,f+.009,c,d,color,false);
   const spacing=tiled?.56:.25;
   for(let i=1;a+i*spacing<b;i++)add('joint-'+name+i,a+i*spacing,f+.01,(c+d)/2,.009,.002,d-c,tiled?'#a9b1a6':'#af916f');
   if(tiled)for(let i=1;c+i*spacing<d;i++)add('crossjoint-'+name+i,(a+b)/2,f+.01,c+i*spacing,b-a,.002,.009,'#a9b1a6');
 }
 wall('front','x',-.1,-.20,14.2,0,3.04,[W('living-front-west',.9,.82),W('living-front-east',4.0,.85),D('frontdoor',7,1.2,'high',1,'front door'),W('study-front',11.4,2.35)],true);
 wall('rear','x',12.1,-.20,14.2,0,3.04,[W('dining-rear',2.45,2.65),D('rear-sliding',7.9,1.2,'high',1,'patio door'),W('kitchen-rear',11.2,2.15,1.12,2.38)],true);
 wall('west','z',-.1,0,12,0,3.04,[W('living-side',3.0,1.95),W('dining-side',9.35,1.7)],true);
 wall('east','z',14.1,0,12,0,3.04,[D('garage-house',4.4,1.1,'low',1,'garage door'),...(depth<8.8?[W('kitchen-side',10.6,1.6,1.48,2.48)]:[])],true);
 wall('front-up','x',-.1,-.2,14.2,FLOOR,3,[W('bed-left-front',2.45,2.15),W('landing-front',6.9,1.45),W('bed-right-front',11.45,2.15)],true);
 wall('rear-up','x',12.1,-.2,14.2,FLOOR,3,[W('primary-rear',2.45,2.3),W('landing-rear',7.7,1.25),W('bathroom-privacy',10.3,1.6,1.6,2.45,true)],true);
 wall('west-up','z',-.1,0,12,FLOOR,3,[W('bedroom-west',3.6,1.5),W('primary-west',8.7,1.45)],true);
 wall('east-up','z',14.1,0,12,FLOOR,3,[W('bedroom-east',3.3,1.6),W('ensuite-east',9.3,.7,1.65,2.35,true)],true);
 wall('living-hall','z',5,0,12,0,3.04,[O('living-opening',2.1,1.4),O('dining-opening',10,1.4)]);
 wall('living-dining','x',6,0,4.9,0,3.04);
 wall('service-hall','z',8.8,0,12,0,3.04,[D('gaming-door',1.9,1.2,'low',1,'computer room door'),O('passage-opening',4.4,1.1),O('kitchen-opening',10,1.4)]);
 wall('study-passage','x',3.6,8.9,14,0,3.04);
 wall('bath-passage','x',5.2,8.9,14,0,3.04,[D('ground-bath',9.5,1,'low',1,'bathroom door'),O('laundry-opening',12.55,1.65)]);
 wall('powder-laundry','z',11.1,5.3,7.3,0,3.04);
 wall('utility-kitchen','x',7.4,8.9,14,0,3.04);
 wall('up-left-hall','z',5,0,12,FLOOR,3,[D('bedroom-second',2.1,1.2,'low',-1,'bedroom door'),D('bedroom-main',10,1.2,'low',-1,'primary bedroom door')]);
 wall('up-left-rooms','x',6,0,4.9,FLOOR,3);
 wall('up-right-hall','z',8.8,0,12,FLOOR,3,[D('bedroom-right',1.9,1.2,'low',1,'bedroom door'),D('linen-door',7.2,1,'low',1,'linen room door'),D('upbath-door',10,1,'low',1,'bathroom door')]);
 wall('bed-linen','x',6,8.9,14,FLOOR,3);wall('linen-bath','x',8.4,8.9,14,FLOOR,3);
 // Use the specified nosing line both for the handrail and every baluster.
 const railY=z=>1.08+.60*(z-stairs.start);
 for(let i=0;i<stairs.count;i++){
   const z=stairs.start+i*stairs.depth,top=(i+1)*stairs.rise;
   cuboid('stair-'+i,stairs.left,stairs.right,0,top,z,z+stairs.depth,'#b38c63',true,slabs);
   add('stair-nosing-'+i,6.1,top-.025,z+.018,1.5,.025,.038,'#e0bd8a');
 }
 for(const x of stairs.railXs){
   beam('stringer-'+x,{x,y:.06,z:3},{x,y:3.12,z:8.1},.13,.15,'#a17c59',true);
   beam('stair-rail-'+x,{x,y:railY(3),z:3},{x,y:railY(8.1),z:8.1},.07,.07,'#70523c',true);
   for(let i=0;i<stairs.count;i++){
     const z=3+(i+.40)*.3,foot=(i+1)*.18;
     add('stair-bracket-'+x+'-'+i,x,foot-.075,z,.19,.075,.1,'#896b4e');
     add('stair-post-'+x+'-'+i,x,foot,z,.045,railY(z)-foot,.045,'#605c50',true);
   }
   add('rail-return-'+x,x,FLOOR-.17,8.1,.085,1.22,.085,'#826348',true);
 }
 cuboid('west-gap',5.10,5.15,3.035,FLOOR,3,8.10,'#bc9d7c',true,slabs);
 function guard(id,alongX,fixed,from,to){
   const span=to-from;const w=alongX?span:.074,d=alongX?.074:span;
   add('guard-'+id,alongX?(from+to)/2:fixed,FLOOR+1.015,alongX?fixed:(from+to)/2,w,.07,d,'#85664b',true);
   const n=Math.ceil(span/.29);
   for(let i=0;i<=n;i++){
     const at=from+span*i/n;
     add('guard-post-'+id+i,alongX?at:fixed,FLOOR,alongX?fixed:at,.045,1.05,.045,'#625f55',true);
   }
 }
 guard('east',false,7.10,3,8.1);guard('front',true,3,5.15,7.1);
 // Pitch the actual two roof planes. Their common ridge runs along +Z.
 const slope=Math.atan2(2.35,7.55),panel=Math.hypot(7.55,2.35);
 for(const side of [-1,1])add('roof-main-'+side,7+side*3.775,7.415,6,panel,.19,12.95,'#47555b',true,{rz:-side*slope});
 for(const z of [-.11,12.11])add('gable-'+z,7,6.29,z,14.3,2.34,.18,'#e7ddc8',false,{shape:'roof'});
 add('roof-ridge',7,8.61,6,.20,.17,13.0,'#35434b');
 for(const x of [-.5,14.5])add('roof-fascia-'+x,x,6.17,6,.13,.20,12.9,'#ded5c1');
 cuboid('garage-slab',west-.2,east+.2,-.16,0,-.2,depth+.2,'#999d99',true,slabs);
 const middle=(west+east)/2,garageH=3.10;
 wall('garage-front','x',-.1,west,east+.2,0,garageH,[O('overhead-opening',middle,4.60)]);
 // The trim opening is 2.50 high; backfill only above the actual leaf.
 const lintel=parts.find(p=>p.id==='home:garage-front-above-overhead-opening');lintel.y=2.50;lintel.h=garageH-2.50;
 for(const p of parts.filter(p=>p.id.startsWith('home:overhead-opening-jamb'))){p.h=2.50;}
 parts.find(p=>p.id==='home:overhead-opening-casing').y=2.50;
 doors.push({id:'home:garage-overhead',garage:true,axis:'x',x:middle,y:0,z:-.1,w:4.6,h:2.5,open:false,progress:0,label:'overhead garage door'});
 wall('garage-exposed','z',east+.1,0,depth,0,garageH,[W('garage-window',depth*.58,1.9,1.25,2.35)],true);
 wall('garage-rear','x',depth+.1,west,east+.2,0,garageH,[],true);
 if(depth>12)wall('garage-west-tail','z',14.1,12,depth,0,garageH);
 cuboid('garage-ceiling',west-.1,east+.2,garageH,garageH+.12,-.2,depth+.2,'#d8d5c7',true,slabs);
 const gw=width/2+.40,gh=.88,ga=Math.atan2(gh,gw);
 for(const side of [-1,1])add('roof-garage-'+side,middle+side*gw/2,garageH+.56,depth/2,Math.hypot(gw,gh),.13,depth+.8,'#506069',true,{rz:-side*ga});
 for(const z of [-.11,depth+.11])add('gable-garage-'+z,middle,garageH+.10,z,width+.30,.88,.18,'#e7ddc8',false,{shape:'roof'});
 for(const x of [middle-2.37,middle+2.37]){
  add('garage-track-v'+x,x,.06,.08,.055,2.52,.055,'#79827e');
  add('garage-track-z'+x,x,2.61,1.43,.065,.06,2.78,'#79827e');
 }
 // The ground plate also prevents terrain seams at the threshold.
 cuboid('porch',5.1,8.9,-.10,0,-2.2,0,'#c7bcaa',true,slabs);
 cuboid('driveway',west-.08,east+.16,-.08,-.015,-16,0,'#9e9f97',false);
 cuboid('side-parking',east+.18,east+3.95,-.08,-.013,-10,0,'#a8aa9f',false);
 cuboid('garden-walk',6.25,7.75,-.07,-.009,-15,-2.2,'#c9baa2',false);
 cuboid('patio',3,11,-.08,.004,12.2,16,'#c1b39a',true,slabs);
 cuboid('porch-canopy',4.9,9.1,2.65,2.8,-2.5,.1,'#657171',true);
 for(const x of [5.36,8.64]){
  add('porch-post'+x,x,0,-1.96,.15,2.65,.15,'#ae8967',true);
  add('porch-foot'+x,x,0,-1.96,.26,.18,.26,'#ded5c4',true);
 }
 for(const x of [6.12,7.89])add('porch-lamp-'+x,x,1.79,-.235,.12,.23,.105,'#ffe5ae',false,{emissive:true});
 const extra=root.CityHomeFurnishings||(typeof require==='function'?require('./home-furnishings'):null);
 const furnishing=extra?.recipe({garageWidth:width,garageDepth:depth,windows,doors})||{parts:[],seats:[],items:[]};
 parts.push(...furnishing.parts.map(p=>({...p,id:'home:'+p.id})));
 for(const [name,ax,bx,az,bz,level] of rooms){
   const x=(ax+bx)/2,z=(az+bz)/2,top=level?(CEILING-.085):name==='Garage'?(garageH-.085):(3.04-.085);
   if(name==='Dining room'||name==='Foyer'||name==='Upstairs landing')continue;
   add('light-'+name,x,top,z,.38,.07,.38,'#ffebca',false,{emissive:true,shape:'cylinder'});
 }
 for(const [id,x,y,z] of [['foyer',6.8,2.90,1.0],['landing',7.85,6.10,8.8],['porch',7,2.58,-1.2]])add('light-'+id,x,y,z,.34,.065,.34,'#ffe8bd',false,{emissive:true,shape:'cylinder'});
 for(const [id,x,y,z,axis] of [['entry',6.23,1.28,.03,'x'],['computer',8.94,1.08,2.7,'z'],['study',13.96,1.23,4.98,'z'],['kitchen',8.94,1.25,9.15,'z'],['landing',8.63,4.52,6.5,'z']])add('switch-'+id,x,y,z,axis==='x'?.09:.025,.13,axis==='z'?.09:.025,'#fcf8ec');
 return{parts,doors,windows,rooms,seats:furnishing.seats,items:furnishing.items,width,depth,carWidth:size.carWidth||2,carLength:size.carLength||4.5};
}
// Mesh Euler rotations are XYZ. The world OBB stores its six actual planes,
// including sloping handrails, so capsule queries never use a rail's tall AABB.
function axes(rx,ry,rz,yaw){
 const a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),e=Math.cos(rz),f=Math.sin(rz);
 const cos=Math.cos(yaw),sin=Math.sin(yaw),turn=(x,y,z)=>({x:-cos*x+sin*z,y,z:sin*x+cos*z});
 return [turn(c*e,a*f+b*e*d,b*f-a*e*d),turn(-c*f,a*e-b*f*d,b*e+a*f*d),turn(d,-b*c,a*c)];
}
function shapeAt(p,r){
 const m=point(r,p.x,p.y+p.h/2,p.z),dirs=axes(p.rx||0,p.ry||0,p.rz||0,r.yaw),half=[p.w/2,p.h/2,p.d/2];
 const ext=k=>dirs.reduce((v,n,i)=>v+Math.abs(n[k])*half[i],0);
 const ex=ext('x'),ey=ext('y'),ez=ext('z'),shape={x:m.x,y:m.y-ey,z:m.z,w:2*ex,h:2*ey,d:2*ez};
 if(dirs.every(v=>Math.max(Math.abs(v.x),Math.abs(v.y),Math.abs(v.z))>.9999999))return shape;
 const planes=[];for(let i=0;i<3;i++)for(const a of[-1,1])planes.push({x:a*dirs[i].x,y:a*dirs[i].y,z:a*dirs[i].z,c:half[i]});
 shape.span={convex:true,x:m.x,y:m.y,z:m.z,tx:1,tz:0,slope:0,planes};
 return shape;
}
function doorPanels(d,t){
 if(d.garage){
   // Four short sections follow the same vertical-to-horizontal track. Both
   // collider planes and the visible panels use these poses on every tick.
   const step=d.h/4,arc=.52,startCorner=d.h-arc+.04;
   return Array.from({length:4},(_,i)=>{
     const s=(i+.5)*step+t*(startCorner+Math.PI*arc/2+.21);
     const angle=Math.min(Math.PI/2,Math.max(0,(s-startCorner)/arc));
     const y=s<startCorner?s:startCorner+arc*Math.sin(angle);
     const z=.06+arc*(1-Math.cos(angle))+Math.max(0,s-startCorner-Math.PI*arc/2);
     return{id:d.id+'-'+i,x:d.x,y:d.y+y-step/2,z:d.z+z,w:d.w,h:step,d:.095,rx:angle};
   });
 }
 const high=d.hinge==='high',s=high?-1:1,axis=d.axis;
 const hingeX=d.x-(axis==='x'?s*d.w/2:0),hingeZ=d.z-(axis==='z'?s*d.w/2:0);
 const angle=t*Math.PI/2;
 const vx=axis==='x'?s*Math.cos(angle):d.swing*Math.sin(angle),vz=axis==='z'?s*Math.cos(angle):d.swing*Math.sin(angle);
 return[{id:d.id,x:hingeX+vx*d.w/2,y:d.y,z:hingeZ+vz*d.w/2,w:d.w,h:d.h,d:.075,ry:Math.atan2(-vz,vx)}];
}
function installWorld(w,api){
 const layout=w.homeRoot||defaultRoot,r={...layout};
 const garageAPI=root.CityHomeGarage||(typeof require==='function'?require('./home-garage'):null);
 const reference=garageAPI?.dimensions?.()||{};
 const home={id:'safehouse-1',name:'Your home',displayName:'Your home',type:'safehouse',customHome:true,district:'old-quay',root:r,revision:0,fixtures:[],furnishings:[],seats:[]};
 home.toWorld=(x,y,z)=>point(r,x,y,z);home.worldYaw=localYaw=>Math.atan2(Math.sin(r.yaw-localYaw),Math.cos(r.yaw-localYaw));home.toLocal=(x,y,z)=>inverse(r,x,y,z);
 const colliders=new Map(),installedDoors=new Map();
 function syncBox(p,extra){
   const q=shapeAt(p,r),b=colliders.get(p.id);
   if(b){api.reshape(b,q);return b;}
   const box=api.box(p.id,q.x,q.y,q.z,q.w,q.h,q.d,'wood',{...extra,home:true,span:q.span});
   colliders.set(p.id,box);return box;
 }
 function clearDoor(d){
   const poses=doorPanels(d.def,d.progress);d.poses=poses;
   d.leaves=poses.map(q=>syncBox(q,{door:true}));d.collider=d.leaves[0];
 }
 function syncDoors(){
   for(const def of home.plan.doors){
     let d=installedDoors.get(def.id);
     if(!d){d={...def,serviceId:def.id==='home:frontdoor'?'safehouse-1':def.id};w.doors.push(d);installedDoors.set(d.id,d);}
     Object.assign(d,home.toWorld(def.x,def.y,def.z),{def,w:def.w,h:def.h,
       setProgress(t){d.progress=Math.max(0,Math.min(1,t));clearDoor(d);}});
     clearDoor(d);
   }
 }
 function occupantGap(poses,a){
   const p=home.toLocal(a.x,a.y,a.z),radius=a.width?Math.hypot(a.width,a.length||a.width)/2:.38,height=a.height||1.8;
   let min=Infinity;
   for(const q of poses){
     const sin=Math.sin(q.ry||0),cos=Math.cos(q.ry||0),dx=p.x-q.x,dz=p.z-q.z;
     const cx=dx*cos-dz*sin,cz=dx*sin+dz*cos;
     const halfZ=(Math.abs(Math.sin(q.rx||0))*q.h+Math.abs(Math.cos(q.rx||0))*q.d)/2;
     const halfY=(Math.abs(Math.cos(q.rx||0))*q.h+Math.abs(Math.sin(q.rx||0))*q.d)/2;
     const cy=q.y+q.h/2;if(cy+halfY<p.y+.02||cy-halfY>p.y+height-.02)continue;
     min=Math.min(min,Math.hypot(Math.max(0,Math.abs(cx)-q.w/2),Math.max(0,Math.abs(cz)-halfZ))-radius);
   }
   return min;
 }
 home.stepDoors=(dt,actor,npcs=[],cars=[])=>{for(const d of installedDoors.values()){
   const t=d.open?1:0;if(d.progress===t)continue;
   const v=dt*(d.garage?.8:2.2),next=t>d.progress?Math.min(t,d.progress+v):Math.max(t,d.progress-v);
   const nextPose=doorPanels(d.def,next),blocks=a=>{
     if(!a||a.vehicleId||Math.abs(a.y-d.y)>4||Math.hypot(a.x-d.x,a.z-d.z)>d.w+Math.max(a.length||0,2))return false;
     const gap=occupantGap(nextPose,a);
     return gap<-.0001&&gap<occupantGap(d.poses,a)-.000001;
   };
   if(blocks(actor)||npcs.some(blocks)||cars.some(blocks))continue;
   d.setProgress(next);
 }};

 home.roomAt=(x,y,z)=>{const p=home.toLocal(x,y,z);return home.rooms.find(q=>p.x>=q.bounds[0]&&p.x<=q.bounds[1]&&p.z>=q.bounds[2]&&p.z<=q.bounds[3]&&p.y>=q.level-.17&&p.y<q.level+(q.level?3.10:3.07))||null;};
 home.containsProperty=(x,z)=>{const p=home.toLocal(x,home.y,z);return p.x>=-.8&&p.x<=Math.max(14.8,14.2+home.garage.width+.8)&&p.z>=-2.65&&p.z<=Math.max(16.25,home.garage.depth+.45);};
 function apply(size){
   const p=home.plan=buildPlan(size),loc=home.toWorld;
   home.garage={width:p.width,depth:p.depth,carWidth:p.carWidth,carLength:p.carLength};
   home.parts=p.parts;
   const center=loc(7,0,6);Object.assign(home,{x:center.x,y:center.y,z:center.z,w:14.4,d:12.4,h:CEILING+.2});
   home.rooms=p.rooms.map(([name,a,b,c,d,f])=>({name,...loc((a+b)/2,f,(c+d)/2),level:f,bounds:[a,b,c,d]}));
   home.entrance=loc(7,0,-.9);home.interaction=loc(7,0,1.46);home.approach=loc(7,0,-16.7);
   home.parking={...loc(14.2+p.width+1.9,0,-5.5),yaw:home.worldYaw(Math.PI)};
   home.launcher={...loc(14.2+p.width/2,0,p.depth/2),yaw:home.worldYaw(Math.PI)};
   home.garageStand={...loc(14.2+p.width/2-p.carWidth/2-.7,0,p.depth/2),yaw:home.worldYaw(Math.PI/2)};
   home.seats=p.seats.map(s=>({...s,x:loc(s.position.x,s.position.y,s.position.z).x,y:loc(s.position.x,s.position.y,s.position.z).y,z:loc(s.position.x,s.position.y,s.position.z).z,
     yaw:home.worldYaw(s.yaw),approach:loc(s.approach.x,s.approach.y,s.approach.z),stand:loc(s.stand.x,s.stand.y,s.stand.z)}));
   home.computer=home.computerSeat=home.seats.find(s=>s.id==='computer')||{...loc(12.35,0,1.75),yaw:home.worldYaw(Math.PI/2),seatHeight:.46,stand:loc(11.2,0,1.75)};
   home.computerStand=home.computer.stand;
   home.wardrobe=loc(10.15,FLOOR,7.23);
   home.doorById=installedDoors;
   w.spawn={...loc(7,0,-3),yaw:home.worldYaw(Math.PI)};
   w.spawn.y=Math.max(w.spawn.y,api.terrainHeight(w.spawn.x,w.spawn.z));
   const pending=new Set(colliders.keys());
   for(const part of p.parts)if(part.solid){
     pending.delete(part.id);syncBox(part,{architecturePart:!!part.architecturePart,floor:!!part.floor,furniture:!part.wall&&!part.floor&&!part.rail});}
   const body={id:'home:launcher-body',x:14.2+p.width/2,y:0,z:p.depth/2,w:p.carWidth,h:1.3,d:p.carLength};
   pending.delete(body.id);syncBox(body,{furniture:true});
   syncDoors();
   for(const d of installedDoors.values())for(const b of d.leaves)pending.delete(b.id);
   for(const id of pending){api.removeBox(colliders.get(id));colliders.delete(id);}
   home.revision++;if(home.node)Object.assign(home.node,home.entrance);
 }
 home.resizeGarage=(width,depth,carWidth=home.garage.carWidth,carLength=home.garage.carLength)=>{
   if(![width,depth,carWidth,carLength].every(v=>Number.isFinite(v)&&v>0))return false;
   width=Math.max(6.6,width,carWidth+2.4);depth=Math.max(7.6,depth,carLength+2.2);
   if(['width','depth','carWidth','carLength'].every((k,i)=>Math.abs(home.garage[k]-[width,depth,carWidth,carLength][i])<.0001))return false;
   apply({width,depth,carWidth,carLength});return true;
 };
 home.setRoot=pose=>{if(!['x','y','z','yaw'].every(k=>Number.isFinite(pose[k])))return false;Object.assign(r,pose);apply(home.garage);return true;};
 apply(reference);
 w.home=home;w.services.push(home);w.interiors.push(home);w.buildings.push({...home,interior:true,style:'safehouse'});
 const nearest=w.pedNodes.reduce((n,b)=>Math.hypot(b.x-home.approach.x,b.z-home.approach.z)<Math.hypot(n.x-home.approach.x,n.z-home.approach.z)?b:n,w.pedNodes[0]);
 if(nearest){const cost=Math.hypot(nearest.x-home.entrance.x,nearest.z-home.entrance.z),n={id:'entrance:safehouse-1',...home.entrance,layer:'ground',links:[{to:nearest.id,cost}],entrance:home.id};nearest.links.push({to:n.id,cost});w.pedNodes.push(n);api.pmap?.set(n.id,n);home.node=n;}
 return home;
}
function prompt(sim){
 const p=sim.player,h=sim.world.home;
 if(!h||p.health<=0||p.mode!=='onFoot'||p.transition||p.physical)return null;
 const near=(q,r)=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<r;
 const seen=q=>sim.world.lineOfSight({...p,y:p.y+1.15},{...q,y:q.y+1.15});
 const facing=q=>{const d=Math.hypot(q.x-p.x,q.z-p.z);return d<.6||((q.x-p.x)*Math.sin(sim.camera.yaw)+(q.z-p.z)*Math.cos(sim.camera.yaw))/d>-.15;};
 const local=h.toLocal(p.x,p.y,p.z),front=h.doorById.get('home:frontdoor');
 if(front&&local.y<1.2&&Math.abs(local.x-7)<1.05&&(sim.homeInstance?local.z>=-.15&&local.z<1.88:local.z<=.16&&local.z>-2.03)&&(sim.homeInstance||facing(front)))return{action:'interact',text:sim.homeInstance?'Leave your home':'Enter your home',kind:'portal'};
 const room=h.roomAt(p.x,p.y,p.z)?.name;
 if(room==='Computer room'&&near(h.computer,1.75)&&seen(h.computer))return{action:'vehicle',text:'Use Computer',kind:'computer'};
 if(room==='Garage'&&near(h.garageStand,1.7)&&seen(h.garageStand)&&facing(h.launcher))return{action:'vehicle',text:'Play Platdo Drive',kind:'drive'};
 const wardrobe=room==='Primary bedroom'?h.toWorld(2.6,FLOOR,7.40):room==='Linen and dressing room'?h.wardrobe:null;
 if(wardrobe&&near(wardrobe,2)&&seen(wardrobe))return{action:'vehicle',text:'Open wardrobe',kind:'wardrobe'};
 for(const d of h.doorById.values()){
   if(d.id==='home:frontdoor'||!near(d,d.garage?2.85:1.64)||!facing(d))continue;
   const ids=d.leaves.map(b=>b.id);
   const delta={x:d.x-p.x,y:d.y+1.12-(p.y+1.15),z:d.z-p.z};
   if(sim.world.raycast({...p,y:p.y+1.15},delta,Math.hypot(delta.x,delta.y,delta.z)-.06,0,{ignoreIds:ids,terrain:false}))continue;
   return{action:'vehicle',text:(d.open?'Close ':'Open ')+d.label,kind:'door',door:d};
 }
 if(room?.includes('bedroom')){
   for(const b of h.parts.filter(s=>/mattress$/i.test(s.id))){
     const bed=h.toWorld(b.x,b.y,b.z);if(near(bed,2)&&seen(bed))return{action:'vehicle',text:'Sleep until morning',kind:'sleep'};
   }
 }
 return null;
}
function interact(sim){
 const action=prompt(sim);if(!action)return null;
 if(action.kind==='sleep'){sim.profile.world.time=7/24;sim.player.health=100;sim.dirty=true;sim.emit('notice',{message:'Good morning.'});}
 if(action.kind==='portal'){enterPrivateHome(sim,!sim.homeInstance);}
 if(action.kind==='door'){
   const d=action.door;sim.world.setDoorOpen(d.id,!d.open);sim.profile.world.doors[d.id]=d.open;sim.dirty=true;
 }
 return action;
}
function privateIdentity(sim){return{id:'home:'+sim.profile.id,ownerId:sim.profile.id,scope:'local-private'};}
function setPlayer(sim,at){
 const p=sim.player;
 if(p.vehicleId){const v=sim.currentVehicle();if(v?.seatOccupants)v.seatOccupants[p.seat||0]=null;}
 Object.assign(p,at,{mode:'onFoot',vehicleId:null,seat:0,vx:0,vy:0,vz:0,roll:0,pitch:0,speed:0,transition:null,physical:null,ragdoll:null,grounded:true,lastSafe:{...at}});
 sim.camera.yaw=at.yaw;sim.camera.pitch=-.1;sim.clearRequested=true;sim.dirty=true;
}
function enterPrivateHome(sim,enter=true){
 const h=sim.world.home;
 sim.homeInstance=enter?privateIdentity(sim):null;
 setPlayer(sim,{...(enter?h.interaction:h.entrance),yaw:h.worldYaw(enter?0:Math.PI)});
 sim.world.setDoorOpen('home:frontdoor',enter);sim.profile.world.doors['home:frontdoor']=enter;
 return sim.homeInstance;
}
function returnHome(sim,garage=false){
 sim.homeInstance=garage?privateIdentity(sim):null;
 sim.world.setDoorOpen('home:frontdoor',false);sim.profile.world.doors['home:frontdoor']=false;
 setPlayer(sim,garage?sim.world.home.garageStand:sim.world.spawn);
}
// Older builds saved world coordinates for a completely different floor plan.
function restorePose(sim,snapshot){
 const h=sim.world.home,p=sim.player;if(!h||p.vehicleId||p.mode!=='onFoot')return;
 const local=h.toLocal(p.x,p.y,p.z);
 const oldLot=p.x>=-189.5&&p.x<=-170.6&&p.z>=142.6&&p.z<=157.7;
 if(snapshot.houseRevision!==22&&oldLot){returnHome(sim);return;}
 if(!h.containsProperty(p.x,p.z))return;
 const support=sim.world.groundHeight(p.x,p.z,p.y);
 if(!sim.world.capsuleClear(p,.35,1.78)||p.y<support-.15||p.y>support+.55){returnHome(sim);return;}
 if(snapshot.privateHome&&local.y>=-.1)sim.homeInstance=privateIdentity(sim);
}
class Renderer{
 constructor(scene){
   this.s=scene;this.T=scene.T;this.group=new this.T.Group();this.group.name='authored-starter-home';scene.environment.add(this.group);
   this.doorMeshes=[];this.lights=[];this.launcher=null;this.launcherKey='';
   this.rebuildFinishes();
 }
 clearMesh(group){
   if(!group)return;
   group.removeFromParent();
   group.traverse(o=>{
     if(o.isInstancedMesh){o.dispose();return;}
     if(o.userData?.owned){o.geometry.dispose();o.material.dispose();}
   });
 }
 meshBox(parent,w,h,d,color,extra={}){
   const T=this.T,m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.68,...extra}));
   m.userData.owned=true;parent.add(m);return m;
 }
 rebuildFinishes(){
   const scene=this.s,T=this.T,h=scene.world.home,finishes=root.PlatdoHomeFinishes;
   this.clearMesh(this.finishGroup);this.finishGroup=new T.Group();this.group.add(this.finishGroup);this.finishSignature=finishes?.signature()||'original:original';this.revision=h.revision;
   this.group.position.set(h.root.x,h.root.y,h.root.z);this.group.rotation.y=h.root.yaw;this.group.scale.x=-1;
   const batch=scene.batch();
   for(const original of [...h.parts,...(finishes?.decorations(undefined,h.garage)||[])]){
     const p=finishes?.finish(original)||original;if(p.noRender)continue;
     if(p.glass){
       const m=this.meshBox(this.finishGroup,p.w,p.h,p.d,p.color,{transparent:true,opacity:p.privacy?.68:.20,roughness:.16,metalness:.06,depthWrite:false});
       m.position.set(p.x,p.y+p.h/2,p.z);m.rotation.set(p.rx||0,p.ry||0,p.rz||0);continue;
     }
     const type=p.shape==='sphere'?'sphere':p.shape==='cylinder'?'cylinder':p.shape==='cone'?'cone':p.shape==='roof'?'roof':'box';
     scene.part(batch,type,p.color,p.x,type==='roof'?p.y:p.y+p.h/2,p.z,p.w,p.h,p.d,p.rx||0,p.ry||0,p.rz||0,p.emissive?'glow':'matte');
   }
   scene.bake(batch,this.finishGroup);
   for(const q of this.doorMeshes)this.clearMesh(q.group);
   this.doorMeshes=[];
   for(const d of h.doorById.values())for(const pose of d.poses){
     const group=new T.Group();this.group.add(group);
     const color=d.garage?'#aebbb7':d.id==='home:frontdoor'?'#58788a':d.id==='home:rear-sliding'?'#789387':'#ae8a62';
     this.meshBox(group,pose.w,pose.h,pose.d,color);
     if(d.garage){
       for(let n=0;n<4;n++){const panel=this.meshBox(group,pose.w/4-.12,pose.h-.14,.024,'#bbc6bd');panel.position.set((n-1.5)*pose.w/4,0,-.05);}
     }else{
       for(const sign of[-1,1]){
         for(const offset of[-.40,.27]){const panel=this.meshBox(group,pose.w-.21,.74,.02,'#ffffff',{color,roughness:.85});panel.position.set(0,offset,sign*.045);}
         const knob=this.meshBox(group,.13,.055,.085,'#4d5452');knob.position.set(pose.w*.36,-.09,sign*.076);
       }
     }
     this.doorMeshes.push({group,d,id:pose.id});
   }
   for(const l of this.lights)l.removeFromParent();this.lights=[];
   for(const v of [[2.45,2.70,3],[7.65,2.65,4.45],[11.5,2.7,9.9],[7.82,5.9,8.9],[14.2+h.garage.width/2,2.95,h.garage.depth-.85]]){
     const l=new T.PointLight('#ffe5bd',.60,8,2);l.position.set(...v);this.group.add(l);this.lights.push(l);
   }
 }
 update(sim,dt){
   const h=sim.world.home,distance=Math.hypot(sim.player.x-h.x,sim.player.z-h.z);
   this.group.visible=distance<500;if(!this.group.visible)return;
   const garage=root.CityHomeGarage;
   if((root.PlatdoHomeFinishes?.signature()||'original:original')!==this.finishSignature||h.revision!==this.revision)this.rebuildFinishes();
   // Network mirrors do not step a local character simulation. Advance the same
   // door trajectory used for collision when the room sets its open target.
   if(sim.onlineRoom)h.stepDoors(dt,sim.player,sim.npcs,sim.vehicles);
   for(const q of this.doorMeshes){
     const p=q.d.poses.find(p=>p.id===q.id);if(!p)continue;
     q.group.position.set(p.x,p.y+p.h/2,p.z);q.group.rotation.set(p.rx||0,p.ry||0,0);
   }
   const night=sim.dayTime<.25||sim.dayTime>.75;
   for(const l of this.lights){l.visible=distance<35;l.intensity=night?1.1:.5;}
   garage?.update(this,sim);
 }
 dispose(){
   root.CityHomeGarage?.clear(this);this.clearMesh(this.finishGroup);
   for(const q of this.doorMeshes)this.clearMesh(q.group);
   this.group.removeFromParent();
 }
}
let legacyPlan,legacyParts;
function recipe(){if(!legacyPlan)legacyPlan=buildPlan();return legacyPlan;}
const api={installWorld,prompt,interact,returnHome,enterPrivateHome,privateIdentity,restorePose,Renderer,recipe,buildPlan,stairs,defaultRoot,point,inverse,doorPanels};
Object.defineProperties(api,{
 parts:{get(){return legacyParts||(legacyParts=recipe().parts.map(p=>({...p,...point(defaultRoot,p.x,p.y,p.z),ry:defaultRoot.yaw-(p.ry||0)})));}},
 doors:{get(){return recipe().doors.map(d=>({...d,...point(defaultRoot,d.x,d.y,d.z)}));}},
 rooms:{get(){return recipe().rooms;}}
});
return api;
});

