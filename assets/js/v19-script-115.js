
/* The island is data, not a map illustration: roads, facilities, navigation,
 * collision, map layers and save migration consume this same layout. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.CityIsland=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION=3,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const coastline=[[-1740,-350],[-1750,-980],[-1600,-1400],[-1300,-1760],[-700,-1900],[-200,-1840],[300,-1910],[850,-1790],[1200,-1500],[1460,-1100],[1630,-550],[1650,200],[1500,760],[1200,950],[930,860],[860,680],[860,-300],[800,-500],[620,-580],[400,-550],[330,-440],[330,200],[360,620],[280,900],[-200,1010],[-750,920],[-950,850],[-1085,690],[-1160,690],[-1260,730],[-1650,800],[-1780,350]].map(([x,z])=>({x,z}));
const districts=[
 {id:'old-quay',name:'Old Quay',x:-170,z:155,color:'#bc7958',style:'brick',landmark:'Lantern Court'},
 {id:'glassline',name:'Glassline',x:90,z:-160,color:'#74a6b5',style:'tower',landmark:'Meridian Exchange'},
 {id:'palmstrand',name:'Palmstrand',x:90,z:640,color:'#d5b887',style:'coast',landmark:'Coast Boulevard'},
 {id:'redbrick-heights',name:'Redbrick Heights',x:-455,z:-170,color:'#ac6d61',style:'townhouse',landmark:'Redfern Gardens'},
 {id:'ironworks',name:'Ironworks',x:-120,z:465,color:'#8c9797',style:'industrial',landmark:'Foundry Cranes'},
 {id:'verdant-hills',name:'Verdant Range',x:-540,z:-850,color:'#66816c',style:'hill',landmark:'Lookout Relay'},
 {id:'northpoint',name:'Northpoint Airport',x:-1320,z:310,color:'#819da2',style:'airport',landmark:'Northpoint 14/32'},
 {id:'northhaven',name:'Northhaven',x:-100,z:-1430,color:'#9b8a68',style:'townhouse',landmark:'Northhaven Green'},
 {id:'east-recreation',name:'Eastbank Recreation',x:1260,z:90,color:'#c39158',style:'coast',landmark:'Eastbank Dirt Circuit'}];
const serviceMoves={
 'clothing-luxury':{x:45,z:640},'clothing-oddball':{x:25,z:-1437},
 'safehouse-2':{x:-486,z:-1430},'garage-2':{x:-390,z:-1435},
 hangar:{x:-1190,z:170}
};
const legacyServices={
 'clothing-luxury':{x:45,z:-205},'clothing-oddball':{x:205,z:290},
 'safehouse-2':{x:-486,z:-180},'garage-2':{x:-390,z:-205},hangar:{x:1080,z:-250}
};
const parks=[
 {id:'city-park',name:'Exchange Gardens',x:-530,z:-150,w:120,d:130},
 {id:'town-green',name:'Northhaven Green',x:-120,z:-1485,w:130,d:90},
 {id:'mountain-overlook',name:'Relay Overlook',x:-610,z:-825,w:45,d:35},
 {id:'neighborhood-green',name:'Lantern Pocket Green',x:-345,z:110,w:50,d:45}
];
const facilities=[
 {id:'airport-terminal',name:'Northpoint Terminal',type:'terminal',x:-1080,z:300,w:44,d:32,h:9},
 {id:'dirt-track',name:'Eastbank Dirt Circuit',type:'track',x:1380,z:105,entrance:{x:1280,z:-105},approach:{x:1240,z:-195}},
 {id:'mega-ramp',name:'Eastbank Mega Ramp',type:'ramp',x:1050,z:85,entrance:{x:1016,z:-110},approach:{x:1020,z:-195}},
 {id:'beach',name:'Seaglass Beach',type:'beach',x:-60,z:830,entrance:{x:-80,z:788},approach:{x:-80,z:720}}
];
const indexes=new WeakMap();
function projection(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(len*len),0,1);return{t,d:Math.hypot(x-a.x-dx*t,z-a.z-dz*t),x:a.x+dx*t,z:a.z+dz*t};}
function shoreline(x,z){let inside=false,edge2=Infinity;for(let i=0,j=coastline.length-1;i<coastline.length;j=i++){const a=coastline[i],b=coastline[j],dx=b.x-a.x,dz=b.z-a.z;if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),ex=x-a.x-dx*t,ez=z-a.z-dz*t;edge2=Math.min(edge2,ex*ex+ez*ez);}return(inside?1:-1)*Math.sqrt(edge2);}
function terrain(x,z){const shore=shoreline(x,z);if(shore<=-40)return-14;if(shore<0)return mix(-14,-.2,(shore+40)/40);let y=shore<25?mix(-.2,2.5,shore/25):2.5;
 // A real continuous ridge, with a low saddle for the direct Mountain Link.
 if(z<-440&&z>-1240){const fade=clamp((-z-440)/160,0,1)*clamp((z+1240)/180,0,1),saddle=1-.87*Math.exp(-(((x+260)/130)**2));
 y+=fade*saddle*(106*Math.exp(-(((x+580)/380)**2)-((z+865)/250)**2)+123*Math.exp(-(((x-230)/540)**2)-((z+870)/250)**2));}
 return y;
}
function districtAt(world,x,z){if(x<-900&&z>-300)return world.districts[6];if(z<-1220)return world.districts[7];if(x>810&&z>-500)return world.districts[8];if(z<-510)return world.districts[5];if(z>590)return world.districts[2];if(x>170&&z>30)return world.districts[2];if(z>350)return world.districts[4];if(x<-320)return world.districts[3];if(z<40)return world.districts[1];return world.districts[0];}
function configure(world){world.layoutVersion=VERSION;world.extent=2300;world.navigationRevision=VERSION;world.districts=districts.map(d=>({...d}));world.coastline=coastline.map(p=>({...p}));world.parks=parks.map(p=>({...p}));world.facilities=facilities.map(f=>JSON.parse(JSON.stringify(f)));world.facilitySurfaces=[];world.facilityParts=[];world.runway={id:'runway',x:-1435,z:365,width:42,length:840,y:2.58,heading:Math.PI/4};world.airport={apron:{x:-1240,z:300,w:190,d:210,y:2.58},taxiway:{...runwayPoint(world,0,85),w:18,d:720,y:2.58,heading:Math.PI/4},parking:{x:-1055,z:365,w:105,d:56,y:2.58}};world.mapRevision='island-'+VERSION;}
// Local runway coordinates are shared by collision, map, placement and missions.
function runwayPoint(world,along,cross=0){const r=world.runway,s=Math.sin(r.heading||0),c=Math.cos(r.heading||0);return{x:r.x+s*along+c*cross,y:r.y,z:r.z+c*along-s*cross};}
function runwayCoordinates(world,x,z){const r=world.runway,s=Math.sin(r.heading||0),c=Math.cos(r.heading||0),dx=x-r.x,dz=z-r.z;return{along:dx*s+dz*c,cross:dx*c-dz*s};}
function onRunway(world,x,z,margin=0){const p=runwayCoordinates(world,x,z);return Math.abs(p.along)<=world.runway.length/2-margin&&Math.abs(p.cross)<=world.runway.width/2-margin;}
function renderAirport(scene,b){const w=scene.world,r=w.runway,box=(along,cross,width,height,depth,color,y=.025)=>{const p=runwayPoint(w,along,cross);scene.box(b,color,p.x,r.y+y,p.z,width,height,depth,r.heading);};box(0,0,r.width,.12,r.length,'#3c484c',-.06);for(let along=-r.length/2+35;along<r.length/2-25;along+=36)box(along,0,.5,.025,16,'#efe9d7');for(const end of[-1,1]){for(let i=-5;i<=5;i++)box(end*(r.length/2-17),i*2.2,1.3,.025,15,'#e4e4d6');for(let cross of[-r.width/2-2,r.width/2+2])for(let along=-r.length/2+6;along<r.length/2;along+=30){const p=runwayPoint(w,along,cross);scene.box(b,'#d6e5cb',p.x,r.y+.12,p.z,.35,.15,.35,0,'glow');}}for(const side of[-1,1])box(0,side*(r.width/2-1.4),.35,.025,r.length-5,'#ecebdc');const t=w.airport.taxiway;for(let along=-t.d/2+15;along<t.d/2-10;along+=25)box(along,85,.25,.025,17,'#e1c475');}
function addRoads(world,{road}){
 const add=(id,name,anchors,width=14,speed=16)=>{const pts=[];for(let k=1;k<anchors.length;k++){const a=anchors[k-1],b=anchors[k],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/30));if(!pts.length)pts.push([a[0],a[1],a[2]??terrain(a[0],a[1])+.06]);for(let j=1;j<=n;j++){const t=j/n,x=mix(a[0],b[0],t),z=mix(a[1],b[1],t);pts.push([x,z,a[2]!=null&&b[2]!=null?mix(a[2],b[2],t):terrain(x,z)+.06]);}}const before=world.roads.length;road(name,pts,width,speed,'ground','island-road',pts.slice(1).map((_,i)=>id+':'+i));for(const r of world.roads.slice(before))r.pathId=id;world.roadPaths.push({id,name,kind:'island-road',width,sidewalkWidth:2.8,points:pts.map(([x,z,y])=>({x,y,z})),roadIds:world.roads.slice(before).map(r=>r.id)});};
 // The existing city intersections remain stable; the outer network joins them explicitly.
 for(const r of world.roads){if(r.name==='Northgate Avenue')r.name='Northern City Bypass';if(r.name==='Quay Boulevard')r.name='City Avenue';if(r.name==='Northpoint Service Road')r.name='Eastern Coastal Road';if(r.name==='Hangar Access')r.name='Recreation Road';}
 add('coast-boulevard','Coast Boulevard',[[-620,580],[-620,720],[-440,720],[-260,720],[-80,720],[100,720],[260,720],[260,580]],18,17);
 add('beach-avenue','Beach Avenue',[[-80,580],[-80,720]],14,12);
 add('airport-road','Airport Road',[[-620,360],[-820,360],[-960,400],[-1055,400],[-1190,400]],16,19);
 add('airport-forecourt','Airport Forecourt',[[-1190,400],[-1190,250],[-1040,250],[-1040,400]],12,8);
 add('mountain-link','Mountain Link',[[-260,-420],[-260,-600],[-260,-800],[-260,-1000],[-260,-1220],[-260,-1370],[-260,-1540]],16,18);
 add('scenic-pass','Scenic Pass',[[-665,-950],[-820,-1040],[-730,-1120],[-900,-1200],[-710,-1280],[-620,-1370],[-620,-1540]],12,11);
 add('northhaven-main','Northhaven Main Street',[[-620,-1370],[-440,-1370],[-260,-1370],[-80,-1370],[100,-1370],[330,-1370],[500,-1370]],16,13);
 add('northhaven-north','Northhaven Crescent',[[-620,-1540],[-440,-1540],[-260,-1540],[-80,-1540],[100,-1540],[330,-1540],[500,-1540],[500,-1370]],14,11);
 for(const x of[-440,-80,330])add('town-cross-'+x,'Northhaven Lane',[[x,-1370],[x,-1540]],12,10);
 add('east-coast','Eastern Coastal Road',[[960,-420],[1040,-420],[1040,-650],[1190,-880],[1180,-1110],[980,-1290],[760,-1370],[500,-1370]],16,17);
 add('recreation-access','Recreation Road',[[1138,-195],[1240,-195],[1380,-195]],14,9);
 world.regionalRoutes=['mountain-link','scenic-pass','east-coast'];
}
function moveServices(list){for(const s of list){const p=serviceMoves[s[0]];if(p){s[3]=p.x;s[4]=p.z;}}const f=facilities[0];list.push([f.id,f.name,f.type,f.x,f.z,f.w,f.d,f.h]);return list;}
function decorateBuildings(world,terrainHeight){let i=0;for(const x of[-560,-490,-350,-285,-190,40,180,250,390,450])for(const z of[-1410,-1496]){if(world.services.some(s=>Math.abs(x-s.x)<(s.w+30)/2+8&&Math.abs(z-s.z)<(s.d+26)/2+8)||parks.some(p=>Math.abs(x-p.x)<p.w/2+20&&Math.abs(z-p.z)<p.d/2+20))continue;world.buildings.push({id:'northhaven-house-'+i++,x,y:terrainHeight(x,z),z,w:26,d:24,h:7+(i%3)*1.8,style:'townhouse',district:'northhaven',tint:i%5,roof:i%3,bays:4,interior:false});}}
function protectedParcel(x,z,w,d){return parks.some(p=>Math.abs(x-p.x)<(p.w+w)/2&&Math.abs(z-p.z)<(p.d+d)/2);}
function decorateProps(world,addProp){for(const park of parks){for(const sx of[-1,1])for(const sz of[-1,1]){addProp('tree',park.x+sx*(park.w/2-9),park.z+sz*(park.d/2-9),7,7,10);addProp('bench',park.x+sx*7,park.z+sz*(park.d/2-13),3,1.2,1);} }for(let i=0;i<16;i++){addProp('palm',-470+i*43,790,5,5,10);if(i%2===0)addProp('umbrella',-450+i*43,824,5,5,3);}for(const z of[-1480,-1410])for(const x of[-580,-320,210,420])addProp('tree',x,z,6,6,9);}
function installFacilities(world,{box,spanBox}){
 const surface=(id,points,width,color='#AF7955',terrainSupport=true)=>{const p={id,points,width,color,terrainSupport};world.facilitySurfaces.push(p);for(let i=1;i<points.length;i++)spanBox(id+':'+i,points[i-1],points[i],width,-.22,.22,0,'masonry',{floor:true,facility:true,bank:((points[i-1].bank||0)+(points[i].bank||0))/2});return p;};
 const part=(id,color,x,y,z,w,h,d,solid=true)=>{world.facilityParts.push({id,color,x,y,z,w,h,d});if(solid)box(id,x,y-h/2,z,w,h,d,'masonry',{facility:true,floor:h<.4,roofSupport:h<.4});};
 const poly=(anchors,step=3)=>{const points=[];for(let i=1;i<anchors.length;i++){const a=anchors[i-1],b=anchors[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/step));if(!points.length)points.push({...a});for(let j=1;j<=n;j++){const t=j/n;points.push({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t)});}}return points;};
 // Clockwise 1 km circuit. Height is shared by rendering and support queries.
 const anchors=[[1320,-40],[1440,-40],[1515,0],[1535,100],[1500,200],[1440,250],[1365,215],[1320,250],[1260,215],[1225,120],[1240,25],[1280,-25]],circuit=[];
 const cat=(a,b,c,d,t)=>(2*t*t*t-3*t*t+1)*b+(t*t*t-2*t*t+t)*(c-a)*.5+(-2*t*t*t+3*t*t)*c+(t*t*t-t*t)*(d-b)*.5;
 for(let i=0;i<anchors.length;i++){const a=anchors[(i+anchors.length-1)%anchors.length],b=anchors[i],c=anchors[(i+1)%anchors.length],d=anchors[(i+2)%anchors.length],n=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/4);for(let j=0;j<n;j++){const t=j/n;circuit.push({x:i===0?mix(b[0],c[0],t):cat(a[0],b[0],c[0],d[0],t),z:i===0?mix(b[1],c[1],t):cat(a[1],b[1],c[1],d[1],t),y:2.6});}}circuit.push({...circuit[0]});let circuitDistance=0;
 for(let i=0;i<circuit.length;i++){if(i)circuitDistance+=Math.hypot(circuit[i].x-circuit[i-1].x,circuit[i].z-circuit[i-1].z);const p=circuit[i],d=circuitDistance;p.distance=d;p.bank=d>120&&d<215?-.13*Math.sin((d-120)/95*Math.PI):d>820&&d<930?-.11*Math.sin((d-820)/110*Math.PI):0;if(d>225&&d<305)p.y+=.65*(1-Math.cos((d-225)/80*Math.PI*8));if(d>400&&d<470)p.y+=3*Math.min(1,(d-400)/20,(470-d)/20);}
 const count=circuit.length-1;
 const track=surface('dirt-circuit',circuit,10);track.length=circuit.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-circuit[i].x,p.z-circuit[i].z),0);track.features=['start straight','banked first corner','four rollers','sweeper','beginner tabletop and bypass','recovery straight','alternating bends','optional jump line','final berm'];
 // Straight start segment and a parallel pit lane, connected at shallow merge angles.
 surface('start-straight',poly([{x:1300,y:2.6,z:-40},{x:1420,y:2.6,z:-40}]),10);
 surface('pit-entry',poly([{x:1260,y:2.6,z:9},{x:1268,y:2.6,z:-77},{x:1380,y:2.6,z:-77},{x:1457,y:2.6,z:-20}]),6,'#ad9475');
 surface('pit-public-access',poly([{x:1240,y:2.6,z:-195},{x:1240,y:2.6,z:-110},{x:1320,y:2.6,z:-110}]),8,'#8b9391');
 const begin=circuit.find(p=>p.distance>=397),end=circuit.find(p=>p.distance>=473);surface('tabletop-bypass',poly([{...begin},{x:begin.x+17,y:2.6,z:begin.z},{x:end.x+17,y:2.6,z:end.z},{...end}]),6);
 surface('optional-jump',poly([{x:1300,y:2.6,z:235},{x:1265,y:3,z:210},{x:1246,y:7,z:190},{x:1243,y:7.8,z:186}]),8);surface('optional-jump-landing',poly([{x:1219,y:6,z:166},{x:1207,y:2.6,z:144},{x:1225,y:2.6,z:113}]),12);
 // Mega ramp faces south. The launch arc is C1 smooth; the separate landing
 // continues into a 90 m braking apron with a ground-level exit at both sides.
 const launch=[];for(let i=0;i<=72;i++){const t=i/72,z=-110+t*190;let y;if(t<.65){const u=t/.65;y=2.7+30*(.5+.5*Math.cos(u*Math.PI));}else{const u=(t-.65)/.35;y=2.7+5*u*u;}launch.push({x:1050,z,y});}surface('mega-launch',launch,16,'#c3c6ba',false);
 surface('mega-landing',poly([{x:1050,y:6.3,z:112},{x:1050,y:3.8,z:142},{x:1050,y:2.6,z:184},{x:1050,y:2.6,z:278}],3),26,'#adb7ad');
 surface('mega-return',poly([{x:1050,y:2.6,z:278},{x:1130,y:2.6,z:278},{x:1175,y:2.6,z:220},{x:1175,y:2.6,z:-160},{x:1100,y:2.6,z:-160}]),8,'#8b9391');
 // 450 m rideable access at 6.7% average grade, with broad turning landings.
 const ascent=[{x:925,y:2.6,z:-195},{x:925,y:2.6,z:-135},{x:1010,y:10.1,z:-135},{x:1010,y:10.1,z:-158},{x:925,y:17.6,z:-158},{x:925,y:17.6,z:-181},{x:1010,y:25.1,z:-181},{x:1030,y:27,z:-181},{x:1030,y:32.7,z:-110},{x:1050,y:32.7,z:-110}];surface('mega-ascent',poly(ascent),7,'#b3b8b0',false);
 part('mega-top-deck','#c3c6ba',1050,32.55,-123,30,.3,26);
 for(const z of[-134,-111])for(const x of[1036,1064])part('mega-support-'+x+z,'#596a6c',x,16.2,z,.65,32.4,.65);
 for(const x of[1035,1065])part('mega-deck-rail-'+x,'#efc878',x,33.25,-123,.16,1.1,26);
 part('mega-deck-back-rail','#efc878',1050,33.25,-136,30,1.1,.16);
 // Separate public 2.8 m stair with eight flights, seven intermediate landings.
 let stairY=2.6,stairs=[];for(let flight=0;flight<8;flight++){const east=flight%2===0,startX=east?985:1005,startZ=-105+flight*4.6;const rise=30.1/8,steps=23;for(let j=0;j<steps;j++){stairY+=rise/steps;const x=startX+(east?1:-1)*(j+.5)*20/steps,z=startZ;part('home:stair-island-'+flight+'-'+j,'#b9bdb0',x,stairY-.1,z,20/steps+.04,.2,2.8);stairs.push({x,y:stairY,z});}if(flight<7){const x=east?1005:985;surface('mega-stair-landing-'+flight,[{x,y:stairY,z:startZ},{x,y:stairY,z:startZ+4.6}],2.8,'#b9bdb0',false);}for(const sz of[-1,1]){const a={x:startX,y:stairY-rise+1,z:startZ+sz*1.4},b={x:east?1005:985,y:stairY+1,z:startZ+sz*1.4};surface('mega-stair-rail-'+flight+'-'+sz,[a,b],.1,'#e8c375',false);}}
 surface('mega-stair-top',poly([{x:985,y:32.7,z:-72.8},{x:978,y:32.7,z:-72.8},{x:978,y:32.7,z:-105},{x:1050,y:32.7,z:-105}]),2.8,'#b9bdb0',false);world.megaRamp={height:30.1,deck:{x:1050,y:32.7,z:-123},stairTreads:stairs,ascent,launch,landing:world.facilitySurfaces.find(p=>p.id==='mega-landing').points};
 // Public recreation furniture never occupies racing or landing envelopes.
 part('pit-shelter-roof','#6f9c95',1340,5.5,-113,26,.22,14);for(const x of[1328,1352])for(const z of[-119,-107])part('pit-shelter-post-'+x+z,'#58686a',x,3.9,z,.2,3.1,.2);
 for(let i=0;i<4;i++)part('spectator-bench-'+i,'#bc9568',1420,3+i*.36,-110+i*2.6,30,.35,1.3);
 // Airport paths and apron use the exact same dimensions as the map.
 const ap=world.airport.apron,pk=world.airport.parking;part('airport-parking','#777f80',pk.x,pk.y-.05,pk.z,pk.w,.1,pk.d,false);
 surface('airport-apron',[{x:ap.x,y:ap.y,z:ap.z-ap.d/2},{x:ap.x,y:ap.y,z:ap.z+ap.d/2}],ap.w,'#939b96');
 surface('airport-taxiway',[runwayPoint(world,-360,85),runwayPoint(world,360,85)],18,'#939b96');
 for(const along of[-300,300])surface('airport-taxi-exit-'+along,[runwayPoint(world,along),runwayPoint(world,along,85)],18,'#939b96');
 surface('airport-apron-access',[runwayPoint(world,80,85),{x:ap.x,y:ap.y,z:ap.z}],20,'#939b96');
 // Build a compact spatial lookup once. Per-frame ground queries inspect nearby spans only.
 const grid=new Map();for(const s of world.facilitySurfaces)for(let i=1;i<s.points.length;i++){const a=s.points[i-1],b=s.points[i],p={a,b,width:s.width,terrainSupport:s.terrainSupport,id:s.id};const pad=s.width/2+2;for(let ix=Math.floor((Math.min(a.x,b.x)-pad)/64);ix<=Math.floor((Math.max(a.x,b.x)+pad)/64);ix++)for(let iz=Math.floor((Math.min(a.z,b.z)-pad)/64);iz<=Math.floor((Math.max(a.z,b.z)+pad)/64);iz++){const k=ix+','+iz;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);}}indexes.set(world,grid);
}
function facilityHeight(world,x,z,referenceY=Infinity,terrainOnly=false){let h=-Infinity;for(const s of indexes.get(world)?.get(Math.floor(x/64)+','+Math.floor(z/64))||[]){if(terrainOnly&&!s.terrainSupport)continue;const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,len2=dx*dx+dz*dz,u=((x-s.a.x)*dx+(z-s.a.z)*dz)/(len2||1);if(u<-.002||u>1.002)continue;const p=projection(x,z,s.a,s.b),side=(-(x-s.a.x)*dz+(z-s.a.z)*dx)/Math.sqrt(len2||1),y=mix(s.a.y,s.b.y,p.t)+mix(s.a.bank||0,s.b.bank||0,p.t)*side;if(p.d<=s.width/2&&y<=referenceY+.65)h=Math.max(h,y);}return h;}
function renderFacilities(scene,b){const T=scene.T;for(const s of scene.world.facilitySurfaces||[]){const vertices=[],indices=[];for(let i=0;i<s.points.length;i++){const p=s.points[i],a=s.points[Math.max(0,i-1)],c=s.points[Math.min(s.points.length-1,i+1)],dx=c.x-a.x,dz=c.z-a.z,len=Math.hypot(dx,dz)||1;for(const side of[-1,1]){const v=side*s.width/2,x=p.x-dz/len*v,z=p.z+dx/len*v,y=p.y+(p.bank||0)*v;vertices.push(x,y,z,x,s.terrainSupport?Math.min(2.45,y-.22):y-.22,z);}}for(let i=1;i<s.points.length;i++){const a=(i-1)*4,c=i*4;indices.push(a,a+2,c+2,a,c+2,c,a,c,c+1,a,c+1,a+1,a+2,a+3,c+3,a+2,c+3,c+2,a+1,c+1,c+3,a+1,c+3,a+3);}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,scene.material(s.color));mesh.receiveShadow=true;mesh.castShadow=!s.terrainSupport;mesh.name=s.id;scene.environment.add(mesh);}for(const p of scene.world.facilityParts||[])scene.box(b,p.color,p.x,p.y,p.z,p.w,p.h,p.d);}

function marker(world,item){const s=world.serviceById?.[typeof item==='string'?item:item.id]||item;if(!s)return null;return{id:s.id,name:s.name,type:s.type,x:s.x,z:s.z,entrance:{...(s.entrance||s.approach||s)},approach:{...(s.approach||s.entrance||s)},interaction:s.interaction?{...s.interaction}:null};}
function markers(world){return[...world.services.map(s=>marker(world,s)),...world.facilities.filter(f=>!world.services.some(s=>s.id===f.id)).map(f=>marker(world,f)),...world.parks.map(p=>marker(world,{...p,type:'park',entrance:{x:p.x,z:p.z+p.d/2},approach:{x:p.x,z:p.z+p.d/2}}))];}
function migrateProfile(profile,world){if(!profile||!profile.world)return{changed:false};const from=profile.world.layoutVersion||1;if(from>=VERSION)return{changed:false,from,to:VERSION};const sn=profile.snapshot,log=[];
 const resetMotion=e=>{for(const k of['vx','vy','vz','pitch','roll'])if(k in e)e[k]=0;};
 const shift=(e,dx,dz)=>{const oldY=e.y;e.x+=dx;e.z+=dz;if(Number.isFinite(e.y))e.y=world.groundHeight(e.x,e.z)+.15;const dy=e.y-oldY;for(const rig of[e.physical,e.ragdoll])for(const p of Object.values(rig?.points||{})){p.x+=dx;p.z+=dz;p.y+=dy;for(const k of['vx','vy','vz'])p[k]=0;}if(e.lastSafe){e.lastSafe.x+=dx;e.lastSafe.z+=dz;e.lastSafe.y=world.groundHeight(e.lastSafe.x,e.lastSafe.z)+.1;}resetMotion(e);};
 if(sn){const entities=[sn.player,...(sn.vehicles||[]),...(sn.npcs||[]),...(sn.drops||[])].filter(Boolean);for(const e of entities){let moved=false;for(const[id,old]of Object.entries(legacyServices)){const s=world.serviceById[id];if(!s)continue;const associated=e.interior===id||e.interiorId===id||e.serviceId===id||e.service===id||e.home===id;const inside=Math.abs(e.x-old.x)<s.w/2+6&&Math.abs(e.z-old.z)<s.d/2+6;if(associated||inside){shift(e,s.x-old.x,s.z-old.z);log.push(e.id||'player');moved=true;break;}}
 if(!moved&&e.x>930&&e.x<1500&&e.z>-850&&e.z<700&&(e.category==='plane'||e.category==='heli')){shift(e,-2530,510);moved=true;}
 // Only obsolete ground positions are relocated. Boats stay afloat and airborne craft keep their state.
 if(!moved&&e.y<world.groundHeight(e.x,e.z)-3&&!(e.category==='boat')){e.y=world.groundHeight(e.x,e.z)+.2;resetMotion(e);}if(!Number.isFinite(e.x)||!Number.isFinite(e.z)){Object.assign(e,world.spawn);resetMotion(e);}
 for(const k of['route','walkRoute'])if(Array.isArray(e[k]))e[k]=[];if(e.pursuitPath)e.pursuitPath=null;
 }for(const e of [sn.player,...(sn.npcs||[])].filter(Boolean)){const vehicle=e.vehicleId&&(sn.vehicles||[]).find(v=>v.id===e.vehicleId);if(vehicle){e.x=vehicle.x;e.y=vehicle.y+1;e.z=vehicle.z;}}sn.projectiles=[];sn.pendingReports=[];if(sn.mission){sn.mission.previousPosition={...sn.player};if(sn.mission.gatePrevious)sn.mission.gatePrevious={...sn.player};const checkpoint=sn.mission.checkpoint;if(checkpoint?.profile&&checkpoint.snapshot){checkpoint.profile.snapshot=checkpoint.snapshot;migrateProfile(checkpoint.profile,world);checkpoint.snapshot=checkpoint.profile.snapshot;checkpoint.profile.snapshot=null;}}if(sn.player&&!sn.player.vehicleId){sn.player.pitch=0;sn.player.roll=0;}}
 profile.world.layoutVersion=VERSION;profile.world.layoutMigration={from,to:VERSION,relocated:log.length};return{changed:true,from,to:VERSION,relocated:log};}
function relocateInitialVehicles(sim){let plane=0,heli=0;for(const v of sim.vehicles||[]){if(v.category==='plane'){v.x=-1290+(plane%2)*55;v.z=300+Math.floor(plane/2)*45;v.y=2.8;v.yaw=0;plane++;}else if(v.category==='heli'){v.x=-1280+heli*40;v.z=405;v.y=2.8;heli++;}}}
return{VERSION,coastline,districts,parks,facilities,serviceMoves,legacyServices,terrain,shoreline,configure,addRoads,moveServices,decorateBuildings,decorateProps,protectedParcel,districtAt,installFacilities,facilityHeight,renderFacilities,renderAirport,runwayPoint,runwayCoordinates,onRunway,markers,marker,migrateProfile,relocateInitialVehicles};
});

