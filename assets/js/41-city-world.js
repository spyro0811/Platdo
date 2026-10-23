
/* Platdo City: original deterministic world. One metre/unit, +Y up, +Z forward.

 * This module is the authoritative static collision/navigation source. Render LOD

 * never removes collision. Dynamic contacts belong to the central simulation.

 */

(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CityWorld=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){

'use strict';

const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),lerp=(a,b,t)=>a+(b-a)*t;

function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}

function distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}

function segmentPoint(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return{t,x:a.x+dx*t,z:a.z+dz*t,d:Math.hypot(x-a.x-dx*t,z-a.z-dz*t)};}

const DISTRICTS=[

{id:'old-quay',name:'Old Quay',x:-170,z:155,color:'#bc7958',style:'brick',landmark:'Lantern Court'},

{id:'glassline',name:'Glassline',x:90,z:-160,color:'#74a6b5',style:'tower',landmark:'Meridian Exchange'},

{id:'palmstrand',name:'Palmstrand',x:230,z:240,color:'#d5b887',style:'coast',landmark:'Seaglass Promenade'},

{id:'redbrick-heights',name:'Redbrick Heights',x:-455,z:-170,color:'#ac6d61',style:'townhouse',landmark:'Redfern Gardens'},

{id:'ironworks',name:'Ironworks',x:-120,z:465,color:'#8c9797',style:'industrial',landmark:'Foundry Cranes'},

{id:'verdant-hills',name:'Verdant Hills',x:-540,z:-850,color:'#66816c',style:'hill',landmark:'Lookout Relay'},

{id:'northpoint',name:'Northpoint Airfield',x:1170,z:80,color:'#819da2',style:'airport',landmark:'Northpoint 18/36'}];

function coastX(z){return 306+24*Math.sin(z/270)+14*Math.sin(z/83);}

function landHeight(x,z){

 const coast=coastX(z),south=725+55*Math.sin(x/260),west=-1610;

 const mainland=Math.min(coast-x,south-z,x-west,z+1540);

 const island=Math.min(x-850,1510-x,z+850,700-z);

 const shore=Math.max(mainland,island);

 if(shore<-35)return-14; if(shore<0)return lerp(-14,-.2,(shore+35)/35);

 let h=shore<24?lerp(-.2,2.5,shore/24):2.5;

 if(mainland>0){const hill=72*Math.exp(-((x+565)**2/255000+(z+960)**2/110000));h+=hill*clamp((-z-400)/220,0,1);}

 return h;

}

// Architecture recipes use a separate seed so changes never reshuffle roads, props or saves.
function architectureFor(b, seed, ordinal) {
 let hash = 2166136261;
 for (const c of b.id + ':' + seed) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
 const random = rng(hash >>> 0), parts = [], volumes = [], faces = [];
 const style = b.style, family = ordinal % 6, roof = Math.floor(ordinal / 6) % 4;
 const rhythm = Math.floor(ordinal / 24) % 5, entry = Math.floor(ordinal / 120) % 3;
 const w = b.w, d = b.d, h = b.h, split = .30 + random() * .10;
 const add = (key, x, y, z, ww, hh, dd, role = 'wall', type = 'box') => {
  const p = {key, x, y, z, w:ww, h:hh, d:dd, role, type}; parts.push(p); return p;
 };
 const volume = (key, x, y, z, ww, hh, dd) => {
  const p = add(key,x,y,z,ww,hh,dd); volumes.push(p); return p;
 };
 let court = null;
 if (b.interior) {
  // Authored walls, shop fittings, thresholds and doors remain the authority below the roof.
  const industrial = ['garage','warehouse','hangar'].includes(style);
  if (industrial) {
   const n = style === 'hangar' ? 4 : style === 'warehouse' ? (b.id.endsWith('2')?4:3) : (b.id.endsWith('2')?3:2);
   for(let i=0;i<n;i++) add('shed-roof-'+i,-w/2+(i+.5)*w/n,h,0,w/n,.8+random()*1.6,d*.98,'roof','gable');
   add('clerestory',w*.22,h+.4,-d*.20,w*.20,1.3,d*.40,'metal');
  } else if (style === 'safehouse' || style === 'relay') {
   if(b.id==='safehouse-2')for(let i=0;i<3;i++)add('house-roof-'+i,-w/2+(i+.5)*w/3,h,0,w/3,1.8+i*.3,d,'roof','gable');
   else add('house-roof',-w*.12,h,0,w*.73,2+random()*1.4,d,'roof','gable');
   add('house-roof-wing',w*.36,h+.05,d*.11,w*.28,1.4,d*.72,'roof','gable');
   add('chimney',-w*.27,h+1.6,-d*.25,1.05,2,1.1,'wall');
  } else {
   add('roof-cap',0,h,0,w,.3,d,'roof');
   add('raised-pavilion',-w*.20,h+.3,-d*.20,w*.42,.8+random()*1.2,d*.33,'trim');
   add('front-parapet',0,h+.3,d/2-.16,w,.7,.30,'trim');
   if(style==='diner') for(let i=0;i<5;i++)add('diner-fin-'+i,-w*.35+i*w*.175,h+.3,d*.25,.4,1.4,3,'metal');
   if(style==='marina')add('lookout',w*.25,h+.3,-d*.1,w*.25,2.6,d*.26,'metal');
  }
  const dh=style==='hangar'?12:style==='garage'||style==='warehouse'?5:2.8;
  const ew=Math.min(w*.7,b.doorWidth+3);
  add('entry-canopy',0,dh+.32,d/2+.6,ew,.22,1.8,'accent');
  for(const side of[-1,1])add('entry-pier-'+side,side*(b.doorWidth/2+.55),0,d/2+.24,.32,Math.min(h,dh+.5),.4,'trim');
 } else {
  // Six genuinely different parcel plans. Open courts and gaps have no hidden full-parcel box.
  if(family===0){
   const podium=Math.min(h*.36,7.2);
   volume('podium',0,0,0,w,podium,d);
   volume('setback',-w*.11,podium,-d*.10,w*.73,h-podium,d*.76);
   if(style==='tower')volume('side-spire',w*.35,podium,-d*.22,w*.22,(h-podium)*.78,d*.46);
  }else if(family===1){
   const wing=w*split,back=d*.30;
   volume('west-wing',-(w-wing)/2,0,0,wing,h,d);
   volume('east-wing',(w-wing)/2,0,d*.06,wing,h*(.68+random()*.20),d*.88);
   volume('court-back',0,0,-(d-back)/2,w-2*wing,h*.68,back);
   court={x:0,z:d*.23,width:w-2*wing,depth:d*.55,open:'south'};
  }else if(family===2){
   const wing=w*(split+.05),back=d*(split+.02);
   volume('long-wing',-(w-wing)/2,0,0,wing,h,d);
   volume('cross-wing',wing/2,0,-(d-back)/2,w-wing,h*.76,back);
   court={x:w*.23,z:d*.2,width:w-wing,depth:d-back,open:'southeast'};
  }else if(family===3){
   const baseH=Math.min(h*.28,5.8),topW=w*(.40+random()*.07);
   volume('low-hall',0,0,0,w,baseH,d);
   volume('offset-tower',-(w-topW)/2,baseH,-d*.06,topW,h-baseH,d*.86);
   volume('terrace-wing',(w-topW)/2,baseH,-d*.25,topW*.74,(h-baseH)*.45,d*.48);
  }else if(family===4){
   const wing=w*.40,gap=w-wing*2;
   volume('twin-west',-(w-wing)/2,0,0,wing,h,d);
   volume('twin-east',(w-wing)/2,0,-d*.07,wing,h*(.70+random()*.22),d*.86);
   volume('link',0,0,-d*.40,gap,h*.30,d*.20);
   court={x:0,z:d*.17,width:gap,depth:d*.67,open:'south'};
  }else{
   const n=style==='industrial'?3:2,step=w/n;
   for(let i=0;i<n;i++)volume('terrace-'+i,-w/2+(i+.5)*step,0,(i%2?-.10:0)*d,step,h*(1-i*.16),d*(i%2?.80:1));
  }
  const roofKind=style==='townhouse'?['gable','dual-gable','dormer-gable','stepped-gable'][roof]:style==='industrial'?['sheds','monitor','stepped-sheds','factory-flat'][roof]:style==='tower'?['parapet','crown','terrace','crown'][roof]:['parapet','gable','terrace','crown'][roof];
  for(let i=0;i<volumes.length;i++){
   const v=volumes[i],top=v.y+v.h;
   // Every exposed volume gets its own roof; later adjoining taller volumes occlude overlaps.
   if(roofKind==='gable'||roofKind==='dormer-gable'){
    add(v.key+'-roof',v.x,top,v.z,v.w,Math.min(3.6,v.w*.18),v.d,'roof','gable');
    if(roofKind==='dormer-gable')for(const side of[-1,1]){
     const dw=Math.min(2.3,v.w*.22),dx=v.x+side*v.w*.24;
     add(v.key+'-dormer-'+side,dx,top+1.05,v.z+v.d*.33,dw,1.25,3,'trim');
     add(v.key+'-dormer-roof-'+side,dx,top+2.30,v.z+v.d*.33,dw,.65,3,'roof','gable');
    }
   }else if(roofKind==='dual-gable'){
    for(const side of[-1,1])add(v.key+'-paired-roof-'+side,v.x+side*v.w*.25,top,v.z,v.w*.5,Math.min(2.7,v.w*.12),v.d,'roof','gable');
   }else if(roofKind==='stepped-gable'){
    add(v.key+'-low-roof',v.x,top,v.z,v.w,1.3,v.d,'roof','gable');
    add(v.key+'-attic',v.x-v.w*.13,top+1.1,v.z-v.d*.10,v.w*.48,1.2,v.d*.62,'trim');
    add(v.key+'-attic-roof',v.x-v.w*.13,top+2.3,v.z-v.d*.10,v.w*.48,1.5,v.d*.62,'roof','gable');
   }else if(roofKind==='sheds'||roofKind==='stepped-sheds'){
    const n=Math.max(1,Math.min(3,Math.round(v.w/10)));
    for(let j=0;j<n;j++){
     const lift=roofKind==='stepped-sheds'?j*.7:0,xx=v.x-v.w/2+(j+.5)*v.w/n;
     if(lift)add(v.key+'-shed-lift-'+j,xx,top,v.z,v.w/n,lift,v.d,'metal');
     add(v.key+'-saw-roof-'+j,xx,top+lift,v.z,v.w/n,1.2+((j+ordinal)%3)*.45,v.d,'roof','gable');
    }
   }else if(roofKind==='monitor'||roofKind==='factory-flat'){
    add(v.key+'-factory-cap',v.x,top,v.z,v.w,.26,v.d,'roof');
    if(roofKind==='monitor'){
     add(v.key+'-monitor',v.x,top+.26,v.z,v.w*.36,1.5,v.d*.84,'metal');
     add(v.key+'-monitor-roof',v.x,top+1.76,v.z,v.w*.42,1.1,v.d*.88,'roof','gable');
    }else for(const side of[-1,1])add(v.key+'-air-handler-'+side,v.x+side*v.w*.27,top+.26,v.z-v.d*.19,v.w*.18,1.6,v.d*.36,'metal');
   }else{
    add(v.key+'-roof',v.x,top,v.z,v.w,.22,v.d,'roof');
    for(const side of[-1,1]){
     add(v.key+'-parapet-z'+side,v.x,top+.22,v.z+side*(v.d/2-.12),v.w,.65,.24,'trim');
     add(v.key+'-parapet-x'+side,v.x+side*(v.w/2-.12),top+.22,v.z,.24,.65,v.d,'trim');
    }
    if((roofKind==='crown'||roofKind==='terrace')&&i===volumes.length-1){
     const cw=v.w*(roofKind==='crown'?.62:.42),cd=v.d*.58,ch=style==='tower'?3.8:1.6;
     add(v.key+'-penthouse',v.x-v.w*.10,top+.22,v.z-v.d*.12,cw,ch,cd,'metal');
     add(v.key+'-penthouse-cap',v.x-v.w*.10,top+ch+.22,v.z-v.d*.12,cw,.22,cd,'trim');
    }
   }
   // Facade edges are stored once. Renderer only decorates exposed sections of these faces.
   for(const side of[-1,1]){
    faces.push({volume:i,axis:'z',side,x:v.x,z:v.z+side*v.d/2,y:v.y,w:v.w,h:v.h});
    faces.push({volume:i,axis:'x',side,x:v.x+side*v.w/2,z:v.z,y:v.y,w:v.d,h:v.h});
   }
  }
  if(style==='tower'){
   const v=volumes.reduce((a,v)=>v.y+v.h>a.y+a.h?v:a),top=v.y+v.h+.25;
   const crown=ordinal%4,height=Math.min(9,2.5+h*.10);
   if(crown===0){
    add('sky-lantern',v.x-v.w*.10,top,v.z-v.d*.06,v.w*.56,height,v.d*.46,'metal');
    add('sky-cap',v.x-v.w*.10,top+height,v.z-v.d*.06,v.w*.60,.38,v.d*.50,'trim');
   }else if(crown===1){
    for(let tier=0;tier<3;tier++)add('sky-step-'+tier,v.x+v.w*.10-tier*v.w*.035,top+tier*height*.38,v.z-v.d*.08,v.w*(.68-tier*.16),height*.38,v.d*(.62-tier*.13),'metal');
    add('sky-mast',v.x+v.w*.03,top+height*1.14,v.z-v.d*.08,.8,4.4,.8,'metal');
   }else if(crown===2){
    for(const side of[-1,1])add('sky-fin-'+side,v.x+side*v.w*.30,top,v.z-v.d*.04,v.w*.18,height,v.d*.48,'trim');
    add('sky-crossbar',v.x,top+height-.5,v.z-v.d*.04,v.w*.78,.5,v.d*.48,'metal');
   }else{
    add('sky-terrace-low',v.x-v.w*.15,top,v.z-v.d*.18,v.w*.65,height*.48,v.d*.52,'trim');
    add('sky-terrace-high',v.x-v.w*.29,top+height*.48,v.z-v.d*.25,v.w*.32,height*.55,v.d*.36,'metal');
   }
  }
  // Structural balconies and entrance canopies survive LOD changes and have matching collision.
  const front=volumes[0],frontZ=front.z+front.d/2;
  const ew=Math.min(front.w*.60,7.5),ex=front.x+(entry-1)*front.w*.10;
  if(style!=='industrial'){
   add('entrance-canopy',ex,3.05,frontZ+.38,ew,.18,.90,'accent');
   if(style==='coast'||style==='townhouse'){
    const count=Math.min(3,Math.floor((front.h-3.5)/3.6));
    for(let i=0;i<count;i++){
     const yy=4+i*3.6;
     add('balcony-floor-'+i,front.x,yy,frontZ+.40,front.w*.65,.18,.96,'trim');
     add('balcony-rail-'+i,front.x,yy+.95,frontZ+.84,front.w*.65,.11,.12,'metal');
     for(const side of[-1,1])add('balcony-post-'+i+':'+side,front.x+side*front.w*.31,yy+.18,frontZ+.84,.09,.85,.09,'metal');
    }
   }
  }
 }
 const a={version:1,ordinal,signature:[b.district,style,family,roof,rhythm,entry].join(':'),family:['setback','courtyard','corner-wing','split-terrace','twin-court','row-halls'][family],roof,facade:['ribbon','vertical','curtain','punched'][ordinal%4], rhythm,entry,parts,volumes,faces,court,bayWidth:4.5+random()*1.8,windowRatio:.40+random()*.26,storeyHeight:style==='industrial'?4.1:3.35+random()*.4};
 return a;
}

function create(seed=204819){

 const random=rng(seed),world={seed,extent:2000,chunkSize:128,districts:DISTRICTS.map(d=>({...d})),roads:[],bridges:[],roadPaths:[],navigationRevision:2,nodes:[],lanes:[],pedNodes:[],buildings:[],interiors:[],services:[],props:[],colliders:[],caches:[],jumps:[],doors:[],waterExits:[],cover:[],runway:{id:'runway',x:1200,z:100,width:34,length:800,y:2.58,heading:0},spawn:{x:-180,y:2.5,z:173,yaw:Math.PI},stats:{queries:0,candidates:0}};

 const grid=new Map(),CELL=64,nmap=new Map(),pmap=new Map(),roadGrid=new Map();let roadSerial=0;

 function box(id,x,y,z,w,h,d,material='masonry',extra={}){const b={id,x,y,z,w,h,d,minX:x-w/2,maxX:x+w/2,minY:y,maxY:y+h,minZ:z-d/2,maxZ:z+d/2,material,enabled:true,...extra};world.colliders.push(b);for(let ix=Math.floor(b.minX/CELL);ix<=Math.floor(b.maxX/CELL);ix++)for(let iz=Math.floor(b.minZ/CELL);iz<=Math.floor(b.maxZ/CELL);iz++){const k=ix+','+iz;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(b);}return b;}

 // AABB broadphase encloses an exact oriented, graded prism. Narrowphase uses

 // its local tangent, sideways coordinate and height above the road grade.

 function spanBox(id,a,b,width,base,height,offset=0,material='masonry',extra={}){

  const length=distance(a,b),tx=(b.x-a.x)/length,tz=(b.z-a.z)/length,ox=a.x-tz*offset,oz=a.z+tx*offset,overlap=.06,slope=(b.y-a.y)/length,{joints,...metadata}=extra;

  const cut=j=>j?-(-tz*j.x+tx*j.z)/(tx*j.x+tz*j.z):0,cutA=cut(joints?.a),cutB=cut(joints?.b),startU=cutA*offset-overlap,endU=length+cutB*offset+overlap,halfWidth=width/2;

  const local=[{x:startU-cutA*halfWidth,z:-halfWidth},{x:endU-cutB*halfWidth,z:-halfWidth},{x:endU+cutB*halfWidth,z:halfWidth},{x:startU+cutA*halfWidth,z:halfWidth}],corners=local.map(p=>({x:ox+tx*p.x-tz*p.z,z:oz+tz*p.x+tx*p.z,y:a.y+slope*p.x}));

  const minX=Math.min(...corners.map(p=>p.x)),maxX=Math.max(...corners.map(p=>p.x)),minZ=Math.min(...corners.map(p=>p.z)),maxZ=Math.max(...corners.map(p=>p.z)),minY=Math.min(...corners.map(p=>p.y))+base,maxY=Math.max(...corners.map(p=>p.y))+base+height;

  const planes=[{x:-1,y:0,z:cutA,c:-startU},{x:1,y:0,z:-cutB,c:endU},{x:0,y:-1,z:0,c:-base},{x:0,y:1,z:0,c:base+height},{x:0,y:0,z:-1,c:halfWidth},{x:0,y:0,z:1,c:halfWidth}];

  return box(id,(minX+maxX)/2,minY,(minZ+maxZ)/2,maxX-minX,maxY-minY,maxZ-minZ,material,{...metadata,span:{x:ox,y:a.y,z:oz,tx,tz,slope,length,halfWidth,startU,endU,cutA,cutB,base,top:base+height,local,planes}});

 }

 function candidates(x0,z0,x1,z1){const found=new Set();for(let ix=Math.floor(x0/CELL);ix<=Math.floor(x1/CELL);ix++)for(let iz=Math.floor(z0/CELL);iz<=Math.floor(z1/CELL);iz++)for(const b of grid.get(ix+','+iz)||[])if(b.enabled)found.add(b);world.stats.queries++;world.stats.candidates+=found.size;return found;}

 function roadNode(x,z,y=2.56,layer='ground'){const id=layer+':'+x+','+z;let n=nmap.get(id);if(!n){n={id,x,y,z,layer,links:[]};nmap.set(id,n);world.nodes.push(n);}return n;}

 function road(name,pts,width=16,speed=14,layer='ground',kind='street',ids=null){

  for(let i=1;i<pts.length;i++){const aa=pts[i-1],bb=pts[i],a=roadNode(aa[0],aa[1],aa[2]??landHeight(aa[0],aa[1])+.06,aa[3]||layer),b=roadNode(bb[0],bb[1],bb[2]??landHeight(bb[0],bb[1])+.06,bb[3]||layer);const len=distance(a,b),r={id:ids?ids[i-1]:'road-'+roadSerial++,name,a,b,width,speed,layer,kind,length:len};world.roads.push(r);a.links.push({to:b.id,cost:len,road:r.id});b.links.push({to:a.id,cost:len,road:r.id});const dx=(b.x-a.x)/len,dz=(b.z-a.z)/len;

  for(const direction of[1,-1]){const s=direction===1?a:b,e=direction===1?b:a,offset=width*.23*direction;world.lanes.push({id:r.id+':'+direction,roadId:r.id,from:s.id,to:e.id,a:{x:s.x-dz*offset,y:s.y,z:s.z+dx*offset},b:{x:e.x-dz*offset,y:e.y,z:e.z+dx*offset},width:3.4,speed,stopLine:len-5,direction,layer,turns:[]});}

  for(const side of[-1,1]){const off=(width/2+2.1)*side;const pa={id:r.id+':side'+side+':a',x:a.x-dz*off,z:a.z+dx*off,y:a.y+.12,layer,links:[],road:r.id,intersection:a.id},pb={id:r.id+':side'+side+':b',x:b.x-dz*off,z:b.z+dx*off,y:b.y+.12,layer,links:[],road:r.id,intersection:b.id};pa.links.push({to:pb.id,cost:len});pb.links.push({to:pa.id,cost:len});world.pedNodes.push(pa,pb);pmap.set(pa.id,pa);pmap.set(pb.id,pb);}

 }}

 // Curved land roads retain authored junctions and stable original road identities.

 function curvedRoad(id,name,anchors,width,speed,kind='hill',legacyCount=anchors.length-1){

  const knots=anchors.map(([x,z,y])=>({x,z,y:y??nmap.get('ground:'+x+','+z)?.y??landHeight(x,z)+.06})),points=[],ids=[],base=roadSerial;roadSerial+=legacyCount;

  const mix=(a,b,c,d,t)=>{const t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*b+(t3-2*t2+t)*(c-a)*.5+(-2*t3+3*t2)*c+(t3-t2)*(d-b)*.5;};

  for(let i=0;i<knots.length-1;i++){const a=knots[Math.max(0,i-1)],b=knots[i],c=knots[i+1],d=knots[Math.min(knots.length-1,i+2)],count=Math.max(4,Math.ceil(distance(b,c)/4.5));if(!i)points.push({...b});for(let j=1;j<=count;j++){const t=j/count,p={};for(const key of['x','y','z'])p[key]=mix(a[key],b[key],c[key],d[key],t);if(j===count)Object.assign(p,c);points.push(p);ids.push(j===1&&i<legacyCount?'road-'+(base+i):id+':segment:'+i+':'+j);}}

  const path={id,name,kind,width,points,roadIds:ids,sidewalkWidth:2.8};world.roadPaths.push(path);road(name,points.map(p=>[p.x,p.z,p.y]),width,speed,'ground',kind,ids);

  const tangent=i=>{const a=points[Math.max(0,i-1)],b=points[i],c=points[Math.min(points.length-1,i+1)],ab=distance(a,b)||1,bc=distance(b,c)||1;return{x:(b.x-a.x)/ab+(c.x-b.x)/bc,z:(b.z-a.z)/ab+(c.z-b.z)/bc};};

  const offset=(i,amount)=>{const t=tangent(i),p=points[i],a=points[i===points.length-1?i-1:i],b=points[i===points.length-1?i:i+1],len=distance(a,b),scale=amount/((b.x-a.x)/len*t.x+(b.z-a.z)/len*t.z);return{x:p.x-t.z*scale,y:p.y,z:p.z+t.x*scale};};

  for(let i=0;i<ids.length;i++){const r=world.roads.find(r=>r.id===ids[i]);r.pathId=id;r.jointA=tangent(i);r.jointB=tangent(i+1);for(const l of world.lanes.filter(l=>l.roadId===r.id)){l.pathId=id;const off=width*.23*l.direction;l.a=offset(l.direction===1?i:i+1,off);l.b=offset(l.direction===1?i+1:i,off);}for(const side of[-1,1])for(const[end,index]of[['a',i],['b',i+1]]){const p=pmap.get(r.id+':side'+side+':'+end);Object.assign(p,offset(index,(width/2+2.1)*side),{pathId:id,side});p.y+=.12;}}

 }

 const xs=[-620,-440,-260,-80,100,260],zs=[-420,-240,-60,180,360,580];

 for(let j=0;j<zs.length;j++)road(['Northgate Avenue','Redfern Street','Exchange Avenue','Lantern Street','Harbor Avenue','Foundry Way'][j],xs.map(x=>[x,zs[j]]),j===2||j===4?22:16,j===2?19:13);

 for(let i=0;i<xs.length;i++)road(['West Circuit','Redfern Road','Quay Boulevard','Market Street','Glass Avenue','Seaglass Drive'][i],zs.map(z=>[xs[i],z]),i===2?22:16,i===2?19:13);

 // Curves leave the mainland eastbound, then meet Northpoint's north/south

 // road tangentially. Arc-length ramps keep both ends level and the bay open.

 for(const [id,z,name,kind,bow]of[['larkspan',-420,'Larkspan Bridge','cable-bridge',-230],['foundry',580,'Foundry Viaduct','arch-bridge',230]]){

  const count=64,points=[],lengths=[0],smooth=t=>t*t*(3-2*t);for(let i=0;i<=count;i++){const t=i/count,u=1-t,p={x:260*u*u*u+3*580*u*u*t+3*960*u*t*t+960*t*t*t,y:2.56,z:z+3*bow*u*t*t};points.push(p);if(i)lengths.push(lengths[i-1]+distance(points[i-1],p));}const length=lengths[count],startY=nmap.get('ground:260,'+z).y,endY=landHeight(960,z)+.06;for(let i=0;i<=count;i++)points[i].y=lengths[i]<200?lerp(startY,12,smooth(clamp((lengths[i]-20)/180,0,1))):length-lengths[i]<200?lerp(endY,12,smooth(clamp((length-lengths[i]-20)/180,0,1))):12;

  // Added samples have bridge-specific IDs; original downstream road IDs stay stable.

  const legacy=roadSerial;roadSerial+=3;const roadIds=points.slice(1).map((_,i)=>i===0?'road-'+legacy:i===Math.floor(count/2)?'road-'+(legacy+1):i===count-1?'road-'+(legacy+2):id+':segment:'+i),bridge={id,name,kind,width:20,points,roadIds,deckDepth:.65,sidewalkWidth:2.8,railOffset:13.1,lightOffset:12.8,length,supports:[]};world.bridges.push(bridge);road(name,points.map((p,i)=>[p.x,p.z,p.y,i===0||i===count?'ground':'bridge']),20,18,'bridge',kind,roadIds);

  const bridgeRoads=world.roads.slice(-count);for(const r of bridgeRoads)r.bridgeId=id;

  // Miter lane and pedestrian endpoints so adjacent samples share positions.

  const offsetPoint=(i,offset)=>{const p=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(count,i+1)],al=distance(prev,p)||1,bl=distance(p,next)||1,ax=i?(p.x-prev.x)/al:(next.x-p.x)/bl,az=i?(p.z-prev.z)/al:(next.z-p.z)/bl,bx=i<count?(next.x-p.x)/bl:ax,bz=i<count?(next.z-p.z)/bl:az,scale=offset/(1+ax*bx+az*bz);return{x:p.x-(az+bz)*scale,y:p.y,z:p.z+(ax+bx)*scale};};

  const jointTangent=i=>{const prev=points[Math.max(0,i-1)],p=points[i],next=points[Math.min(count,i+1)],al=distance(prev,p)||1,bl=distance(p,next)||1;return{x:(i?(p.x-prev.x)/al:0)+(i<count?(next.x-p.x)/bl:0),z:(i?(p.z-prev.z)/al:0)+(i<count?(next.z-p.z)/bl:0)};};

  for(let i=0;i<count;i++){const r=bridgeRoads[i];r.jointA=jointTangent(i);r.jointB=jointTangent(i+1);for(const l of world.lanes.filter(l=>l.roadId===r.id)){l.bridgeId=id;const off=r.width*.23*l.direction;l.a=offsetPoint(l.direction===1?i:i+1,off);l.b=offsetPoint(l.direction===1?i+1:i,off);}for(const side of[-1,1])for(const[end,index]of[['a',i],['b',i+1]]){const p=pmap.get(r.id+':side'+side+':'+end);Object.assign(p,offsetPoint(index,(r.width/2+2.1)*side),{bridgeId:id,side});p.y+=.12;}}

  for(const ratio of(kind==='cable-bridge'?[.24,.77]:[.19,.36,.71,.86])){const pointIndex=lengths.reduce((best,n,i)=>Math.abs(n-length*ratio)<Math.abs(lengths[best]-length*ratio)?i:best,0),p=points[pointIndex];bridge.supports.push({x:p.x,y:-14,z:p.z,deckY:p.y,pointIndex});}

 }

 road('Northpoint Service Road',[[960,-420],[960,-195],[960,180],[960,580]],18,16);

 road('Hangar Access',[[960,-195],[1080,-195],[1138,-195]],16,10);

 road('Apron Road',[[960,180],[1060,180],[1100,180]],16,10);

 curvedRoad('verdant-serpentine','Verdant Serpentine',[[-620,-420],[-710,-510],[-765,-615],[-660,-705],[-470,-745],[-400,-840],[-540,-895],[-665,-950]],14,12);

 curvedRoad('relay-spur','Relay Spur',[[-540,-895],[-575,-881],[-579,-827,landHeight(-540,-846)+.06],[-540,-817,landHeight(-540,-846)+.06]],12,8,'hill',1);

 road('Marina Approach',[[260,180],[282,145],[310,145]],12,8);

 // Branches share a short level junction before their smooth grade resumes.

 const pathJunctions=world.nodes.filter(n=>n.layer==='ground'&&n.links.length>=3&&n.links.some(l=>world.roads.find(r=>r.id===l.road).pathId));

 for(const path of world.roadPaths)for(const p of path.points){const junction=pathJunctions.find(n=>distance(n,p)<32);if(junction){const t=clamp((distance(junction,p)-12)/20,0,1);p.y=lerp(junction.y,p.y,t*t*(3-2*t));nmap.get('ground:'+p.x+','+p.z).y=p.y;}}

 for(const r of world.roads.filter(r=>r.pathId)){for(const l of world.lanes.filter(l=>l.roadId===r.id)){l.a.y=l.direction===1?r.a.y:r.b.y;l.b.y=l.direction===1?r.b.y:r.a.y;}for(const side of[-1,1]){pmap.get(r.id+':side'+side+':a').y=r.a.y+.12;pmap.get(r.id+':side'+side+':b').y=r.b.y+.12;}}

 // Collision and support lookup are independent of renderer streaming and quality.

 for(const r of world.roads){const pad=r.width/2+16;for(let ix=Math.floor((Math.min(r.a.x,r.b.x)-pad)/CELL);ix<=Math.floor((Math.max(r.a.x,r.b.x)+pad)/CELL);ix++)for(let iz=Math.floor((Math.min(r.a.z,r.b.z)-pad)/CELL);iz<=Math.floor((Math.max(r.a.z,r.b.z)+pad)/CELL);iz++){const key=ix+','+iz;if(!roadGrid.has(key))roadGrid.set(key,[]);roadGrid.get(key).push(r);}}

 const roadsAt=(x,z)=>roadGrid.get(Math.floor(x/CELL)+','+Math.floor(z/CELL))||[];

 world.streetSigns=[];for(const n of world.nodes){if(n.layer!=='ground'||n.links.length<3)continue;const roads=[...new Map(n.links.map(l=>{const r=world.roads.find(r=>r.id===l.road);return[r.name,r];})).values()],half=Math.max(...roads.map(r=>r.width/2));roads.slice(0,2).forEach((r,i)=>world.streetSigns.push({id:'sign:'+n.id+':'+i,roadId:r.id,name:r.name,x:n.x-half-2.4,y:n.y+3.25+i*.47,z:n.z+half+2.4,yaw:Math.atan2(r.b.x-r.a.x,r.b.z-r.a.z)}));}

 for(const bridge of world.bridges){for(const id of bridge.roadIds){const r=world.roads.find(r=>r.id===id);spanBox(r.id+':deck',r.a,r.b,r.width+bridge.sidewalkWidth*2,-bridge.deckDepth,bridge.deckDepth,0,'masonry',{floor:true,bridgeId:bridge.id,joints:{a:r.jointA,b:r.jointB}});if(r.a.layer!=='bridge'||r.b.layer!=='bridge')continue;for(const side of[-1,1]){spanBox(r.id+':walk:'+side,r.a,r.b,bridge.sidewalkWidth,0,.12,(r.width/2+bridge.sidewalkWidth/2)*side,'masonry',{floor:true,bridgeId:bridge.id,joints:{a:r.jointA,b:r.jointB}});const pa=pmap.get(r.id+':side'+side+':a'),pb=pmap.get(r.id+':side'+side+':b'),scale=bridge.railOffset/(r.width/2+2.1),a={x:r.a.x+(pa.x-r.a.x)*scale,y:r.a.y,z:r.a.z+(pa.z-r.a.z)*scale},b={x:r.b.x+(pb.x-r.b.x)*scale,y:r.b.y,z:r.b.z+(pb.z-r.b.z)*scale};spanBox(r.id+':rail:'+side,a,b,.28,.12,1.15,0,'metal',{bridgeId:bridge.id});}}for(const[supportIndex,p]of bridge.supports.entries())box(bridge.roadIds[p.pointIndex-1]+':pier:'+supportIndex,p.x,p.y,p.z,3,p.deckY-bridge.deckDepth-p.y,9,'masonry',{bridgeId:bridge.id});}

 // Visible bridge furnishings share the rendered centerline and spacing.

 for(const bridge of world.bridges){const points=bridge.points,total=[0],frames=points.map((p,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],al=distance(prev,p)||1,bl=distance(p,next)||1,ax=i?(p.x-prev.x)/al:(next.x-p.x)/bl,az=i?(p.z-prev.z)/al:(next.z-p.z)/bl,bx=i<points.length-1?(next.x-p.x)/bl:ax,bz=i<points.length-1?(next.z-p.z)/bl:az,scale=1/(1+ax*bx+az*bz);if(i)total.push(total[i-1]+distance(prev,p));return{x:-(az+bz)*scale,z:(ax+bx)*scale};}),offset=(i,side,y=0)=>({x:points[i].x+frames[i].x*side,y:points[i].y+y,z:points[i].z+frames[i].z*side}),at=(d,side=0,y=0)=>{let i=1;while(i<total.length-1&&total[i]<d)i++;const t=(d-total[i-1])/(total[i]-total[i-1]),a=offset(i-1,side,y),b=offset(i,side,y);return{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:lerp(a.z,b.z,t)};},beam=(id,a,b,w,h)=>spanBox(bridge.id+':'+id,a,b,w,-h/2,h,0,'metal',{bridgeId:bridge.id});

  for(const side of[-1,1])for(let d=46;d<bridge.length-40;d+=76){const p=at(d,side*bridge.lightOffset);box(bridge.id+':light:'+side+':'+d,p.x,p.y,p.z,.16,7.4,.16,'metal',{bridgeId:bridge.id});box(bridge.id+':light-head:'+side+':'+d,p.x,p.y+7.29,p.z,.55,.12,.55,'metal',{bridgeId:bridge.id});}

  for(const support of bridge.supports)beam('cap:'+support.pointIndex,offset(support.pointIndex,-bridge.railOffset,-1),offset(support.pointIndex,bridge.railOffset,-1),1.1,1.2);

  if(bridge.kind==='cable-bridge')for(const fraction of[.3,.7]){const i=Math.round((points.length-1)*fraction),base=points[i];for(const side of[-1,1]){const foot=offset(i,side*(bridge.railOffset+.4)),top={...foot,y:base.y+32};box(bridge.id+':tower:'+i+':'+side,foot.x,base.y-1,foot.z,1.35,33,1.35,'metal',{bridgeId:bridge.id});for(const step of[-12,-9,-6,-3,3,6,9,12]){const j=i+step;if(j>2&&j<points.length-3)beam('cable:'+i+':'+side+':'+j,top,offset(j,side*bridge.railOffset,1.1),.085,.085);}}beam('tower-crossbar:'+i,offset(i,-bridge.railOffset-.4,29),offset(i,bridge.railOffset+.4,29),1.15,1.15);}

  else for(const support of bridge.supports)for(const side of[-1,1])for(const direction of[-1,1]){const i=support.pointIndex,j=i+direction*3;if(j>0&&j<points.length-1)beam('brace:'+i+':'+side+':'+direction,offset(i,side*bridge.railOffset,-2.2),offset(j,side*bridge.railOffset,-.72),.8,.8);}

 }

 // Turn connections follow graph topology, so overlapping levels never join.

 for(const l of world.lanes)l.turns=world.lanes.filter(o=>o.from===l.to&&o.to!==l.from).map(o=>o.id);

 const intersectionGroups=new Map();for(const p of world.pedNodes){if(!intersectionGroups.has(p.intersection))intersectionGroups.set(p.intersection,[]);intersectionGroups.get(p.intersection).push(p);}

 for(const list of intersectionGroups.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j],sameBridge=a.bridgeId&&a.bridgeId===b.bridgeId||a.pathId&&a.pathId===b.pathId;if(sameBridge&&(a.layer==='bridge'&&b.layer==='bridge'||a.pathId&&nmap.get(a.intersection)?.links.length===2)&&a.side!==b.side)continue;const crossing=sameBridge?a.side!==b.side:a.road!==b.road||a.id.split(':side')[1][0]!==b.id.split(':side')[1][0];a.links.push({to:b.id,cost:distance(a,b),crossing});b.links.push({to:a.id,cost:distance(a,b),crossing});}

 function nearestRoad(x,z){let best=null;for(const r of world.roads){const p=segmentPoint(x,z,r.a,r.b);if(!best||p.d<best.distance)best={...p,distance:p.d,road:r,y:lerp(r.a.y,r.b.y,p.t)};}return best;}

 function terrainHeight(x,z){let h=landHeight(x,z),best=null;for(const j of world.jumps){if(!j.graded)continue;const blend=Math.min(clamp((13-Math.abs(x-j.x))/6,0,1),clamp((48-Math.abs(z-j.z))/10,0,1));if(blend>0)h=lerp(h,j.y,blend);}for(const r of roadsAt(x,z)){if(r.layer==='bridge')continue;const p=segmentPoint(x,z,r.a,r.b),edge=p.d-r.width/2;if(edge<15&&(!best||edge<best.edge))best={r,p,edge};}if(best){const{r,p,edge}=best,t=clamp((edge-3)/12,0,1),blend=t*t*(3-2*t);h=lerp(lerp(r.a.y,r.b.y,p.t)-.06,h,blend);}for(const s of world.services){const edge=Math.max(Math.abs(x-s.x)-s.w/2,Math.abs(z-s.z)-s.d/2);if(edge<7){const t=clamp((edge-1.5)/5.5,0,1);h=lerp(s.y-.08,h,t*t*(3-2*t));}}return h;}

 function groundHeight(x,z,referenceY=Infinity){let h=terrainHeight(x,z),roadY=-Infinity,walkY=-Infinity;for(const r of roadsAt(x,z)){let p;if(r.jointA){const ax=x-r.a.x,az=z-r.a.z,bx=x-r.b.x,bz=z-r.b.z;if(ax*r.jointA.x+az*r.jointA.z<-.001||bx*r.jointB.x+bz*r.jointB.z>.001)continue;const tx=(r.b.x-r.a.x)/r.length,tz=(r.b.z-r.a.z)/r.length;p={t:(ax*tx+az*tz)/r.length,d:Math.abs(-ax*tz+az*tx)};}else p=segmentPoint(x,z,r.a,r.b);if(p.d<=r.width/2+(r.jointA?2.8:2.7)){const y=lerp(r.a.y,r.b.y,p.t);if(y<=referenceY+.6){if(p.d<=r.width/2)roadY=Math.max(roadY,y);else walkY=Math.max(walkY,y+.12);}}}h=Math.max(h,Number.isFinite(roadY)?roadY:walkY);if(Math.abs(x-world.runway.x)<=world.runway.width/2&&Math.abs(z-world.runway.z)<=world.runway.length/2)h=Math.max(h,world.runway.y);for(const s of world.interiors)if(Math.abs(x-s.x)<=s.w/2&&Math.abs(z-s.z)<=s.d/2&&s.y<=referenceY+.6)h=Math.max(h,s.y);for(const p of world.props)if((p.kind==='dock'||p.kind==='helipad')&&Math.abs(x-p.x)<=p.w/2&&Math.abs(z-p.z)<=p.d/2&&p.y<=referenceY+.6)h=Math.max(h,p.y+(p.kind==='helipad'?.12:0));for(const j of world.jumps){if(Math.abs(x-j.x)<j.width/2&&z>=j.z-j.length/2&&z<=j.z+j.length/2){const y=rampHeight(j,z);if(y<=referenceY+.65)h=Math.max(h,y);}}
  // Explicit height references support standing/landing on solid architecture. The default
  // terrain/route query stays unchanged, so ground-level spawns never appear on roofs.
  if(Number.isFinite(referenceY))for(const c of candidates(x,z,x,z)){
   if(!(c.architecturePart||c.roofSupport)||x<c.minX||x>c.maxX||z<c.minZ||z>c.maxZ)continue;
   let top=c.maxY;
   if(c.span?.convex){const s=c.span,u=x-s.x,v=z-s.z;top=Infinity;for(const p of s.planes)if(p.y>0)top=Math.min(top,s.y+(p.c-p.x*u-p.z*v)/p.y);}
   if(top<=referenceY+.6&&top>h)h=top;
  }
  return h;}

 function rampHeight(j,z){const t=clamp((z-j.z+j.length/2)/j.length,0,1),profile=j.profile;if(!profile)return j.y+j.height*t;const index=Math.min(profile.length-2,Math.floor(t*(profile.length-1))),a=profile[index],b=profile[index+1],u=clamp((z-a.z)/(b.z-a.z),0,1);return lerp(a.y,b.y,u);}

 function waterHeight(x,z,time=0){if(landHeight(x,z)>.05)return null;return .08*Math.sin(x*.025+time*.7)+.055*Math.sin(z*.032-time*.5);}

 function districtAt(x,z){if(x>800)return world.districts[6];if(z< -510)return world.districts[5];if(x>170&&z>30)return world.districts[2];if(z>350)return world.districts[4];if(x< -320)return world.districts[3];if(z<40)return world.districts[1];return world.districts[0];}

 const services=[['safehouse-1','Lantern Apartment','safehouse',-180,150,24,24,7],['garage-1','Mara’s Motor House','garage',-229,145,31,34,6],['diner','The Copper Kettle','diner',-112,150,32,25,5],['clothing','Thread & Tide','clothing',-117,216,27,25,5],['equipment','Field Supply','equipment',27,150,27,25,5],['safehouse-2','Redfern Home','safehouse',-486,-180,25,28,7],['garage-2','Redfern Motors','garage',-390,-205,36,38,7],['marina','Inez Marina Office','marina',233,119,27,26,5],['warehouse-1','Warehouse Nine','warehouse',-147,475,53,60,11],['warehouse-2','Warehouse Twelve','warehouse',30,475,58,58,13],['hangar','Cass Flight Services','hangar',1080,-250,92,86,19],['relay','Lookout Relay','relay',-540,-846,25,28,7]];

 for(const [id,name,type,x,z,w,d,h]of services){const y=terrainHeight(x,z)+.08,doorW=type==='hangar'?48:type==='garage'?10:type==='warehouse'?9:3.2;const s={id,name,displayName:name,type,x,y,z,w,d,h,district:districtAt(x,z).id,entrance:{x,y,z:z+d/2+.8},interaction:{x:x+(type==='garage'?w*.31:0),y,z:z+d*.22},doorWidth:doorW,furnishings:[],seats:[]};if(type==='clothing'||type==='equipment'){s.shopKind=type;s.mapLabel=type==='clothing'?'Clothing store':'Weapons · armor · ammo';s.signSubtitle=type==='clothing'?'CLOTHING · SHOES · ACCESSORIES':'WEAPONS · ARMOR · AMMUNITION';}world.services.push(s);world.interiors.push(s);world.buildings.push({...s,interior:true,style:type,roofY:y+h});const wall=.45,front=z+d/2;

  box(id+':back',x,y,z-d/2,w,h,wall);box(id+':left',x-w/2,y,z,wall,h,d);box(id+':right',x+w/2,y,z,wall,h,d);const side=(w-doorW)/2;box(id+':front-l',x-doorW/2-side/2,y,front,side,h,wall);box(id+':front-r',x+doorW/2+side/2,y,front,side,h,wall);const dh=type==='hangar'?12:type==='garage'||type==='warehouse'?5:2.8;box(id+':lintel',x,y+dh,front,doorW,h-dh,wall);box(id+':ceiling',x,y+h,z,w,.28,d);const door={id:id+':door',serviceId:id,x,y,z:front,w:doorW,h:dh,open:true,progress:1};world.doors.push(door);door.collider=box(door.id,x,y,front,doorW,dh,.15,'wood',{enabled:false,door:true});

  const furn=(kind,fx,fz,fw,fh,fd,color,solid=true)=>{const f={id:id+':'+kind+'-'+s.furnishings.length,kind,x:x+fx,y,z:z+fz,w:fw,h:fh,d:fd,color};s.furnishings.push(f);if(solid)box(f.id,f.x,y,f.z,fw,fh,fd,kind==='toolcabinet'?'metal':'wood',{furniture:true});return f;};

  if(type==='safehouse'){furn('bed',-w*.28,-d*.22,3,0.6,4,'#bdad8b');furn('wardrobe',w*.33,-d*.28,2.8,2.3,1.1,'#654c3f');furn('sofa',w*.25,d*.05,4,0.9,1.5,'#698b89');furn('table',0,-d*.16,2.6,.65,1.5,'#a7845a');furn('rug',0,0,8,.02,6,'#ab6b51',false);furn('lamp',-w*.37,d*.12,.5,1.8,.5,'#f4db9d',false);}

  if(type==='garage'){furn('toolcabinet',-w*.4,-d*.3,2.1,2,4,'#bb654c');furn('workbench',w*.39,-d*.2,2,1,7,'#556b68');furn('lift',0,-4,3.1,.12,6,'#d0a858',false);furn('tires',-w*.37,d*.17,2,1.4,2,'#303d43');}

  if(type==='clothing'){

   // The checkout faces the existing interaction point; the central entrance

   // aisle stays clear. Fixtures have matching resident collision geometry.

   furn('retailcounter',0,2.7,6.4,1.05,1.45,'#b98a68');

   for(const dz of[-2,5])furn('clothesrack',-8,dz,4.1,1.85,1.25,'#d7ad79');

   furn('shoedisplay',8,-1,4.3,2.1,1.4,'#b8a485');

   furn('foldedtable',8,5,3.7,.85,2.1,'#bdab8d');

   furn('hatdisplay',-9,-9,4.5,2.3,1.3,'#b8a485');

   furn('foldeddisplay',8,-9,4.5,2.3,1.3,'#b8a485');

   for(const fx of[-4.6,0,4.6])furn('mannequin',fx,-5.8,1.3,2.2,1.3,'#d0b991');

   furn('rug',0,7,5,.035,8,'#527b7c',false);s.staff={x:x+2.2,y,z:z+1.1};

  }

  if(type==='equipment'){

   furn('retailcounter',0,2.7,7,1.12,1.5,'#41565b');

   furn('ammodisplay',-9,0,4.8,2.35,1.5,'#55665e');

   furn('ammodisplay',-9,6,4.8,2.35,1.5,'#55665e');

   furn('weaponcase',8,4.7,4.4,1.45,1.6,'#4d6268');

   furn('weaponboard',3.5,-9,10,3.15,.8,'#3c5158');

   for(const fx of[-8,-4.8,-1.6])furn('armorstand',fx,-5,1.25,2.2,1.25,'#758080');

   furn('rug',0,7,5,.035,8,'#556163',false);s.staff={x:x+2.4,y,z:z+1.1};

  }

  if(type==='marina'){furn('counter',0,-d*.2,w*.56,1.1,1.5,'#836d55');furn('shelf',-w*.41,-d*.05,1.2,2.4,d*.58,'#71908f');furn('shelf',w*.41,-d*.05,1.2,2.4,d*.58,'#71908f');furn('display',-w*.23,d*.19,2.1,1.6,1.2,'#c49874');s.staff={x,y,z:z-d*.3};}

  if(type==='diner'){furn('counter',w*.29,-d*.12,2,1.1,d*.64,'#c89569');for(let n=0;n<3;n++){const f=furn('diner-table',-w*.22,-d*.3+n*5.5,3,.8,1.8,'#e5cdaa');furn('booth',-w*.39,f.z-z,1.1,1.1,2.2,'#ae594e');furn('booth',-w*.05,f.z-z,1.1,1.1,2.2,'#ae594e');s.seats.push({x:x-w*.36,y:y+.5,z:f.z,yaw:Math.PI/2},{x:x-w*.09,y:y+.5,z:f.z,yaw:-Math.PI/2});}s.staff={x:x+w*.4,y,z};}

  if(type==='warehouse'){for(let row=0;row<3;row++)for(const side of[-1,1]){const f=furn('crate',side*w*.3,-d*.32+row*d*.25,7,2.8+row*.4,7,'#8b785d');world.cover.push({id:f.id,x:f.x,y,z:f.z+w*.01,width:7,height:f.h});}furn('office',w*.33,d*.31,6,2.4,5,'#a6b8b4');}

  if(type==='hangar'){furn('toolcabinet',-w*.43,-d*.27,3,2.5,8,'#507785');furn('workbench',w*.41,-d*.27,3,1.2,10,'#b79c73');furn('fuel-cart',w*.38,d*.05,3,2,4,'#bdad55');}

  if(type==='relay'){furn('rack',-w*.35,-d*.18,2.5,2.5,6,'#38545a');furn('rack',w*.35,-d*.18,2.5,2.5,6,'#38545a');furn('console',0,-d*.29,6,1.2,2,'#788a87');}

  const pn={id:'entrance:'+id,x:s.entrance.x,y,z:s.entrance.z,layer:'ground',links:[],entrance:id};

  let approach=null;for(const r of world.roads){if(r.layer==='bridge')continue;const sp=segmentPoint(pn.x,pn.z,r.a,r.b),dx=(r.b.x-r.a.x)/r.length,dz=(r.b.z-r.a.z)/r.length;for(const side of[-1,1]){const q={x:sp.x-dz*(r.width/2+2.1)*side,z:sp.z+dx*(r.width/2+2.1)*side,y:lerp(r.a.y,r.b.y,sp.t)+.12},len=distance(pn,q);let clear=true;for(let t=0;t<=1;t+=1/Math.max(2,Math.ceil(len))){if(!capsuleClear({x:lerp(pn.x,q.x,t),y:terrainHeight(lerp(pn.x,q.x,t),lerp(pn.z,q.z,t))+.15,z:lerp(pn.z,q.z,t)},.5,1.8)){clear=false;break;}}if(clear&&(!approach||len<approach.distance))approach={...q,road:r,side,distance:len};}}

  if(approach){s.approach={x:approach.x,y:approach.y,z:approach.z};const link={id:'approach:'+id,x:approach.x,y:approach.y,z:approach.z,layer:'ground',links:[{to:pn.id,cost:approach.distance}]};pn.links.push({to:link.id,cost:approach.distance});for(const suffix of['a','b']){const side=pmap.get(approach.road.id+':side'+approach.side+':'+suffix);if(side){link.links.push({to:side.id,cost:distance(link,side)});side.links.push({to:link.id,cost:distance(link,side)});}}world.pedNodes.push(link);pmap.set(link.id,link);}world.pedNodes.push(pn);pmap.set(pn.id,pn);

 }

 // Original city parcels use facade/roof variations, not arbitrary random scatter.

 for(let ix=0;ix<xs.length-1;ix++)for(let iz=0;iz<zs.length-1;iz++){

  const x0=xs[ix],x1=xs[ix+1],z0=zs[iz],z1=zs[iz+1];

  for(let bx=0;bx<3;bx++)for(let bz=0;bz<3;bz++){const x=lerp(x0,x1,(bx+.5)/3),z=lerp(z0,z1,(bz+.5)/3),dist=districtAt(x,z);let w=28+random()*8,d=26+random()*6;if((ix===0&&iz===1)||(ix===3&&iz===1&&bx>0)||(ix===4&&iz===3))continue;if(world.services.some(s=>Math.abs(x-s.x)<(w+s.w)/2+4&&Math.abs(z-s.z)<(d+s.d)/2+4))continue;

   if(world.services.some(s=>s.approach&&segmentPoint(x,z,s.entrance,s.approach).d<Math.hypot(w,d)/2+2))continue;

   // Keep generated footprints behind the complete sidewalk plus a facade setback.

   // Apply after selection to preserve building IDs and the seeded random sequence.

   for(const r of world.roads){if(r.layer!=='ground')continue;const setback=r.width/2+3.3;if(Math.abs(r.a.x-r.b.x)<.01&&z>=Math.min(r.a.z,r.b.z)&&z<=Math.max(r.a.z,r.b.z))w=Math.min(w,2*(Math.abs(x-r.a.x)-setback));if(Math.abs(r.a.z-r.b.z)<.01&&x>=Math.min(r.a.x,r.b.x)&&x<=Math.max(r.a.x,r.b.x))d=Math.min(d,2*(Math.abs(z-r.a.z)-setback));}

   let h=dist.style==='tower'?17+random()*67:dist.style==='industrial'?8+random()*12:dist.style==='townhouse'?8+random()*8:10+random()*16;const b={id:'building-'+world.buildings.length,x,y:terrainHeight(x,z),z,w,d,h,style:dist.style,district:dist.id,tint:Math.floor(random()*5),roof:Math.floor(random()*3),bays:Math.max(3,Math.round(w/5)),interior:false};world.buildings.push(b);

  }

 }

 // One structural recipe drives rendering and collision, including open courtyards and roof slopes.
 const districtOrdinals=new Map();
 for(const b of world.buildings){
  const districtKey=b.district+':'+b.style,ordinal=districtOrdinals.get(districtKey)||0;
  districtOrdinals.set(districtKey,ordinal+1);
  b.architecture=architectureFor(b,seed,ordinal);
  if(b.interior){box(b.id+':floor',b.x,b.y-.085,b.z,b.w,.1,b.d,'masonry',{floor:true});const ceiling=world.colliders.find(c=>c.id===b.id+':ceiling');if(ceiling)ceiling.roofSupport=true;}
  for(const p of b.architecture.parts){
   const x=b.x+p.x,y=b.y+p.y,z=b.z+p.z,id=b.id+':architecture:'+p.key;
   const extra={architecturePart:true,buildingId:b.id,partKey:p.key};
   if(p.type==='gable'){
    const slope=2*p.h/p.w;
    const planes=[{x:-1,y:0,z:0,c:p.w/2},{x:1,y:0,z:0,c:p.w/2},{x:0,y:-1,z:0,c:0},{x:-slope,y:1,z:0,c:p.h},{x:slope,y:1,z:0,c:p.h},{x:0,y:0,z:-1,c:p.d/2},{x:0,y:0,z:1,c:p.d/2}];
    box(id,x,y,z,p.w,p.h,p.d,'masonry',{...extra,span:{convex:true,x,y,z,tx:1,tz:0,slope:0,length:p.w,halfWidth:p.d/2,startU:-p.w/2,endU:p.w/2,cutA:0,cutB:0,base:0,top:p.h,local:[{x:-p.w/2,z:-p.d/2},{x:p.w/2,z:-p.d/2},{x:p.w/2,z:p.d/2},{x:-p.w/2,z:p.d/2}],planes}});
   }else box(id,x,y,z,p.w,p.h,p.d,p.role==='metal'?'metal':'masonry',extra);
  }
 }

 const addProp=(kind,x,z,w=1,d=1,h=1,color)=>{const p={id:'prop-'+world.props.length,kind,x,y:terrainHeight(x,z),z,w,d,h,color};world.props.push(p);return p;};

 // Docks sit above shared water; deck is a surface, piles are spatial obstacles.

 for(const z of[88,112,136]){const p=addProp('dock',337,z,62,4,.5);p.y=1.1;world.waterExits.push({id:'ladder-'+z,x:338,y:1.1,z:z+2.4,top:{x:338,y:1.1,z},water:{x:338,y:0,z:z+4}});for(const x of[310,333,358])box(p.id+':pile:'+x,x,-10,z,.5,11.1,.5,'wood');}

 const dock=addProp('dock',863,-115,54,5,.5);dock.y=1.1;world.waterExits.push({id:'airfield-ladder',x:850,y:1.1,z:-112,top:{x:850,y:1.1,z:-115},water:{x:850,y:0,z:-108}});

 for(let x=-600;x<270;x+=32)for(const z of[-60,180]){if(world.services.some(s=>distance(s.entrance,{x,z:z+13})<7))continue;addProp('streetlight',x,z+13,.3,.3,7);}

 for(let i=0;i<28;i++){const x=-594+(i%7)*21,z=-213+Math.floor(i/7)*35;addProp('tree',x,z,4,4,7+random()*3);}

 for(let i=0;i<24;i++)addProp('palm',279+Math.sin(i)*3,205+i*11,3,3,7+random()*3);

 for(let i=0;i<48;i++){const a=i*2.399,r=100+random()*260;addProp('tree',-540+Math.cos(a)*r,-880+Math.sin(a)*r,5,5,8+random()*6);}

 for(let i=0;i<10;i++){addProp('umbrella',287,245+i*17,4,4,2.9);addProp('bench',281,251+i*17,2.5,.7,.8);}

 for(const x of[-220,-20,150])addProp('crane',x,660,20,20,47);

 for(let i=0;i<18;i++){const x=-190+(i%6)*17,z=615+Math.floor(i/6)*10;const p=addProp('container',x,z,12,5,5,['#8a5c48','#457e86','#bba05d'][i%3]);box(p.id,x,p.y,z,p.w,p.h,p.d,'metal',{breakable:false});}

 addProp('tower',-540,-859,5,5,34);addProp('helipad',1050,190,26,26,.1);addProp('helipad',-570,-902,22,22,.1);addProp('windsock',1150,-290,1,1,8);

 // Placed discoveries have descriptions and intentional approaches.

 const cacheSpots=[[-181,145,'The lamp in your first home'],[-232,141,'Behind Mara’s workbench'],[-114,142,'Coffee and brass'],[25,142,'Field notes'],[-475,-178,'A redbrick window'],[-388,-208,'The second workshop'],[-587,-183,'Redfern garden'],[49,-141,'Exchange plaza'],[222,111,'Marina charts'],[337,88,'End of the first pier'],[285,287,'Palm shade'],[258,534,'Southern seawall'],[-151,463,'Warehouse Nine aisle'],[32,460,'Warehouse Twelve aisle'],[-200,668,'Beside the dock crane'],[-540,-843,'Relay console'],[-650,-945,'Serpentine overlook'],[1070,-239,'Flight workshop'],[1050,203,'Helipad perimeter'],[873,-115,'Across the bay']];

 cacheSpots.forEach(([x,z,clue],i)=>{if(i===2){x=-116;z=153;}if(i===8){x=236;z=124;}world.caches.push({id:'cache-'+String(i+1).padStart(2,'0'),x,y:groundHeight(x,z)+.3,z,clue,reward:75,district:districtAt(x,z).id});});

 const jumpSpots=[[-624,40],[-444,40],[-264,40],[-624,270],[-444,270],[-264,270],[-624,465],[-444,465],[-264,465],[-680,-585],[-650,-625],[1000,330]];

 jumpSpots.forEach(([x,z],i)=>{const j={id:'jump-'+(i+1),x,y:groundHeight(x,z),z,width:5,length:12,height:1.6,heading:0,approach:{x,z:z-32},landing:{x,z:z+29,radius:18},minimumDistance:8,graded:i===9||i===10};const entry=.18,den=2*entry-entry*entry;j.deckThickness=.12;j.profile=Array.from({length:13},(_,n)=>{const t=n/12,rise=t<entry?t*t/den:(2*entry*t-entry*entry)/den;return{x:j.x,y:j.y+j.height*rise,z:j.z-j.length/2+j.length*t};});world.jumps.push(j);});

 // Fit solid structure to visible props. Relocate legacy vegetation and poles

 // that occupied travel lanes before enabling their authoritative collision.

 const obstacleKinds=new Set(['tree','palm','streetlight','helipad']);

 for(const p of world.props){p.collisionIds=[];if(obstacleKinds.has(p.kind)){const clearance=p.kind==='helipad'?Math.max(p.w,p.d)/2+3.4:3.4,valid=(x,z)=>landHeight(x,z)>.2&&roadsAt(x,z).every(r=>segmentPoint(x,z,r.a,r.b).d>r.width/2+clearance)&&world.services.every(s=>Math.abs(x-s.x)>s.w/2+clearance||Math.abs(z-s.z)>s.d/2+clearance)&&world.services.every(s=>!s.approach||segmentPoint(x,z,s.entrance,s.approach).d>1)&&world.caches.every(c=>distance(c,{x,z})>1.3)&&world.jumps.every(j=>Math.abs(x-j.x)>14||Math.abs(z-j.z)>55);if(!valid(p.x,p.z)){let placed=false;for(let ring=1;ring<=14&&!placed;ring++)for(let angle=0;angle<16;angle++){const x=p.x+Math.cos(angle*Math.PI/8)*ring*3,z=p.z+Math.sin(angle*Math.PI/8)*ring*3;if(valid(x,z)){p.x=x;p.z=z;p.y=terrainHeight(x,z);placed=true;break;}}}}

  const part=(key,dx,dy,dz,w,h,d,material='metal',extra={})=>{const c=box(p.id+':'+key,p.x+dx,p.y+dy,p.z+dz,w,h,d,material,{propId:p.id,...extra});p.collisionIds.push(c.id);return c;},w=p.w,h=p.h,d=p.d;

  if(p.kind==='tree'){part('trunk',0,0,0,.44,h*.48,.44,'wood');part('crown',0,h*.38,0,w*.8,h*.64,w*.8,'wood');part('crown-top',w*.2,h*.705,0,w*.56,h*.43,w*.56,'wood');}

  if(p.kind==='palm'){part('trunk',0,0,0,.4,h*.95,.4,'wood');for(let i=0;i<6;i++)part('leaf-'+i,Math.sin(i*Math.PI/3)*1.1,h-.2,Math.cos(i*Math.PI/3)*1.1,1.8,.4,1.8,'wood');}

  if(p.kind==='streetlight'){part('post',0,0,0,.19,h,.19);part('arm',0,h-.06,-1.2,.12,.12,2.4);part('head',0,h-.2,-2.3,.6,.16,.75);}

  if(p.kind==='bench'){part('seat',0,.375,0,w,.15,.7,'wood');part('back',0,.58,-.27,w,.5,.12,'wood');for(const side of[-1,1])part('leg'+side,side*w*.37,0,0,.15,.45,.7);}

  if(p.kind==='umbrella'){part('pole',0,0,0,.1,2.5,.1);part('canopy',0,2.3,0,3.4,.6,3.4,'cloth');}

  if(p.kind==='crane'){for(const side of[-1,1])part('leg'+side,side*5,0,0,1.3,h,1.3);part('crossbeam',0,h-2.75,0,30,1.5,1.4);part('boom',0,h-10.6,14,1.2,1.2,36);part('cab',0,h-9,5,4,4,5);part('cable',0,h*.245,28,.1,h*.67,.1);for(let yy=8;yy<h-12;yy+=6)for(const side of[-1,1]){const c=spanBox(p.id+':gantry:'+yy+':'+side,{x:p.x-side*4.5,y:p.y+yy,z:p.z},{x:p.x+side*4.5,y:p.y+yy+6,z:p.z},.18,-.09,.18,0,'metal',{propId:p.id});p.collisionIds.push(c.id);}}

  if(p.kind==='tower'){for(const side of[-1,1])part('post'+side,side*2,0,0,.6,h,.6);for(let y=4;y<h;y+=5)part('brace'+y,0,y-.1,0,4.5,.2,.4);part('dish',2,h*.75-1.5,0,3,3,.4);part('core',0,0,0,.14,h,.14);for(let yy=4;yy<h-5;yy+=5){const c=spanBox(p.id+':diagonal:'+yy,{x:p.x-1.8,y:p.y+yy,z:p.z},{x:p.x+1.8,y:p.y+yy+5,z:p.z},.12,-.06,.12,0,'metal',{propId:p.id});p.collisionIds.push(c.id);}}

  if(p.kind==='windsock'){part('post',0,0,0,.12,8,.12);part('sock',1.1,7.25,0,2.2,.8,.8,'cloth');}

  if(p.kind==='dock'){part('deck',0,-.4,0,w,.4,d,'wood',{floor:true});for(let x=-w/2+3;x<w/2;x+=9)part('pile'+x,x,-10,0,.48,10,.48,'wood');}

  if(p.kind==='helipad')part('pad',0,0,0,w,.12,d,'masonry',{floor:true});

  if(p.kind==='container')p.collisionIds.push(p.id);

 }

 for(const s of world.services)for(const f of s.furnishings){if(world.colliders.some(c=>c.id===f.id))continue;box(f.id,f.x,f.y,f.z,f.w,f.h,f.d,f.kind==='rug'?'cloth':'metal',{furniture:true,floor:f.h<.15});}

 const signPosts=new Set();for(const sign of world.streetSigns){const key=sign.x+','+sign.z;if(!signPosts.has(key)){signPosts.add(key);box(sign.id+':post',sign.x,sign.y-3.2,sign.z,.09,3.2,.09,'metal');}const x=Math.cos(sign.yaw)*2.4,z=-Math.sin(sign.yaw)*2.4;spanBox(sign.id+':board',{x:sign.x-x,y:sign.y,z:sign.z-z},{x:sign.x+x,y:sign.y,z:sign.z+z},.035,-.3,.6,0,'metal');}

 for(const node of world.nodes){if(node.links.length<3||node.layer!=='ground'||node.x>800||node.z< -450)continue;for(const heading of[0,Math.PI/2]){const x=node.x+10.9,z=node.z+(heading===0?-10.9:10.9);box('signal:'+node.id+':'+heading,x,node.y,z,.16,4.4,.16,'metal');box('signal-head:'+node.id+':'+heading,x,node.y+3.225,z,.55,1.35,.5,'metal');}}

 box('runway:surface',world.runway.x,world.runway.y-.12,world.runway.z,world.runway.width,.12,world.runway.length,'masonry',{floor:true});box('apron:surface',1095,2.42,-120,170,.08,330,'masonry',{floor:true});

 // The renderer and wheel support use these same sampled deck planes. The first

 // 2 m ease into the grade; every join shares an exact endpoint, with no toe lip.

 for(const j of world.jumps){j.structure=[];for(let i=1;i<j.profile.length;i++){const a=j.profile[i-1],b=j.profile[i];j.structure.push(spanBox(j.id+':ramp:'+i,a,b,j.width,-j.deckThickness,j.deckThickness,0,'metal',{floor:true,rampId:j.id}));for(const side of[-1,1])j.structure.push(spanBox(j.id+':edge:'+side+':'+i,a,b,.12,-.22,.10,side*(j.width/2-.12),'metal',{floor:true,rampId:j.id,structure:true}));}for(const i of[4,7,10,12]){const p=j.profile[i],height=Math.max(.05,p.y-j.y-j.deckThickness);for(const side of[-1,1]){j.structure.push(box(j.id+':leg:'+side+':'+i,j.x+side*(j.width/2-.3),j.y-.04,p.z,.16,height+.04,.16,'metal',{floor:true,rampId:j.id,structure:true}));}j.structure.push(box(j.id+':brace:'+i,j.x,p.y-.22,p.z,j.width-.4,.1,.16,'metal',{floor:true,rampId:j.id,structure:true}));} }



 // Small destructible props occupy authored work yards, never traffic, doors or stunts.

 // Their stable IDs are shared by rendering, projectile collision and saved deltas.

 function propSite(x,z,r=1.2){const p={x,y:groundHeight(x,z)+.025,z},road=nearestRoad(x,z);return terrainHeight(x,z)>1&&capsuleClear(p,r,2)&&road.distance>road.road.width/2+r+3&&world.services.every(s=>!s.approach||segmentPoint(x,z,s.entrance,s.approach).d>r+2)&&world.caches.every(c=>distance(c,p)>r+2)&&world.jumps.every(j=>Math.abs(x-j.x)>r+14||Math.abs(z-j.z)>55)&&world.props.every(q=>!['helipad','dock'].includes(q.kind)||Math.abs(x-q.x)>q.w/2+r||Math.abs(z-q.z)>q.d/2+r);}

 const workYards=[[-175,516],[-1,516],[-206,650],[1108,-168],[206,95],[-590,-202],[-563,-872]];

 for(let i=0;i<28;i++){const yard=workYards[Math.floor(i/4)],kind=['woodcrate','woodcrate','bin','cone'][i%4],w=kind==='woodcrate'?1.35:kind==='bin'?.8:.6,h=kind==='woodcrate'?1.2:kind==='bin'?1.05:.85;let site=null;for(let ring=0;ring<8&&!site;ring++)for(let k=0;k<(ring?8:1);k++){const x=yard[0]+(i%4)*3.8+Math.cos(k*Math.PI/4)*ring*2.4,z=yard[1]+Math.sin(k*Math.PI/4)*ring*2.4;if(propSite(x,z,w*.8)){site={x,z};break;}}if(!site)throw new Error('No safe authored destructible site '+i);const p=addProp(kind,site.x,site.z,w,w,h);p.id='destructible-'+String(i+1).padStart(2,'0');p.breakable=true;p.y=groundHeight(p.x,p.z);box(p.id,p.x,p.y,p.z,p.w,p.h,p.d,kind==='woodcrate'?'wood':kind==='bin'?'metal':'plastic',{breakable:true,prop:true});}

 // Low planters provide readable crouching cover; warehouse stacks provide tall cover.

 for(const[x,z]of[[-568,-188],[-548,-160],[44,-161],[69,-110],[-184,519],[69,517]]){if(!propSite(x,z,2.5))continue;const p=addProp('planter',x,z,4,1.4,1.12);p.y=groundHeight(x,z);box(p.id,x,p.y,z,p.w,p.h,p.d,'masonry',{cover:true,prop:true});}

 world.cover.length=0;

 for(const c of world.colliders.filter(c=>c.cover||c.furniture&&c.id.includes(':crate-'))){for(const[nx,nz,span]of[[0,1,c.w/2-.45],[0,-1,c.w/2-.45],[1,0,c.d/2-.45],[-1,0,c.d/2-.45]]){const x=c.x+nx*(c.w/2+.52),z=c.z+nz*(c.d/2+.52),p={x,y:groundHeight(x,z),z};if(!capsuleClear(p,.38,1.8)||!capsuleClear({x:x+nx*.8,y:p.y,z:z+nz*.8},.38,1.8))continue;const normal={x:nx,z:nz},tangent={x:nz,z:-nx};world.cover.push({id:c.id+':cover:'+nx+':'+nz,colliderId:c.id,...p,width:span*2,height:c.h,span,normal,tangent,low:c.h<1.5,approach:{x:x+nx*.8,y:p.y,z:z+nz*.8}});}}

 function rayBox(o,d,max,b,r=0){if(b.span){

  const s=b.span,u=(o.x-s.x)*s.tx+(o.z-s.z)*s.tz,v=-(o.x-s.x)*s.tz+(o.z-s.z)*s.tx,du=d.x*s.tx+d.z*s.tz,dv=-d.x*s.tz+d.z*s.tx,local={x:u,y:o.y-s.y-s.slope*u,z:v},direction={x:du,y:d.y-s.slope*du,z:dv};let near=0,far=max,enter=null,closest=null,closestDistance=Infinity;

  for(const plane of s.planes){const normal={x:plane.x*s.tx-plane.z*s.tz-plane.y*s.slope*s.tx,y:plane.y,z:plane.x*s.tz+plane.z*s.tx-plane.y*s.slope*s.tz},scale=Math.hypot(normal.x,normal.y,normal.z),gap=plane.c+r*scale-plane.x*local.x-plane.y*local.y-plane.z*local.z,velocity=plane.x*direction.x+plane.y*direction.y+plane.z*direction.z;for(const key of['x','y','z'])normal[key]/=scale;if(gap/scale<closestDistance){closestDistance=gap/scale;closest=normal;}if(Math.abs(velocity)<1e-8){if(gap<0)return null;continue;}const t=gap/velocity;if(velocity<0){if(t>near){near=t;enter=normal;}}else far=Math.min(far,t);if(near>far)return null;}

  if(near<0||near>max)return null;return{distance:near,startedInside:!enter,point:{x:o.x+d.x*near,y:o.y+d.y*near,z:o.z+d.z*near},normal:enter||closest,collider:b,id:b.id,material:b.material};

 }let near=0,far=max,axis=null,sign=1;for(const [k,mn,mx]of[['x','minX','maxX'],['y','minY','maxY'],['z','minZ','maxZ']]){const lo=b[mn]-r,hi=b[mx]+r;if(Math.abs(d[k])<1e-8){if(o[k]<lo||o[k]>hi)return null;}else{let a=(lo-o[k])/d[k],z=(hi-o[k])/d[k],sg=-Math.sign(d[k]);if(a>z)[a,z]=[z,a];if(a>near){near=a;axis=k;sign=sg;}far=Math.min(far,z);if(near>far)return null;}}if(near<0||near>max)return null;const startedInside=axis===null;if(startedInside){const faces=[['x',o.x-(b.minX-r),-1],['x',b.maxX+r-o.x,1],['y',o.y-(b.minY-r),-1],['y',b.maxY+r-o.y,1],['z',o.z-(b.minZ-r),-1],['z',b.maxZ+r-o.z,1]].sort((a,c)=>Math.abs(a[1])-Math.abs(c[1]));axis=faces[0][0];sign=faces[0][2];}const normal={x:0,y:0,z:0};normal[axis]=sign;return{distance:near,startedInside,point:{x:o.x+d.x*near,y:o.y+d.y*near,z:o.z+d.z*near},normal,collider:b,id:b.id,material:b.material};}

 function raycast(origin,direction,maxDistance=500,radius=0,options={}){const len=Math.hypot(direction.x,direction.y,direction.z)||1,d={x:direction.x/len,y:direction.y/len,z:direction.z/len};let hit=null;const end={x:origin.x+d.x*maxDistance,z:origin.z+d.z*maxDistance};for(const b of candidates(Math.min(origin.x,end.x)-radius,Math.min(origin.z,end.z)-radius,Math.max(origin.x,end.x)+radius,Math.max(origin.z,end.z)+radius)){if(options.ignoreIds&&options.ignoreIds.includes(b.id)||options.ignoreFloors&&b.floor)continue;const h=rayBox(origin,d,hit?hit.distance:maxDistance,b,radius);if(h&&!(options.allowSeparating&&h.startedInside&&d.x*h.normal.x+d.y*h.normal.y+d.z*h.normal.z>0)&&(!hit||h.distance<hit.distance))hit=h;}

  if(options.terrain!==false){const limit=hit?hit.distance:maxDistance,step=Math.max(.4,Math.min(3,limit/180));for(let t=.08;t<limit;t+=step){const x=origin.x+d.x*t,z=origin.z+d.z*t,y=origin.y+d.y*t;if(y-radius<terrainHeight(x,z)){let lo=Math.max(0,t-step),hi=t;for(let j=0;j<6;j++){const mid=(lo+hi)/2;if(origin.y+d.y*mid-radius<terrainHeight(origin.x+d.x*mid,origin.z+d.z*mid))hi=mid;else lo=mid;}hit={distance:hi,point:{x:origin.x+d.x*hi,y:origin.y+d.y*hi,z:origin.z+d.z*hi},normal:surfaceNormal(x,z),material:'ground',id:'terrain'};break;}}}return hit;

 }

 function capsuleClear(p,r=.36,h=1.8,options={}){for(const b of candidates(p.x-r,p.z-r,p.x+r,p.z+r)){if(options.ignoreIds&&options.ignoreIds.includes(b.id))continue;if(p.y+h<=b.minY+.025||p.y>=b.maxY-(b.floor?.18:.025))continue;if(b.span?.convex){const s=b.span;
   // Match the flat-foot support used on graded bridge spans. A walkable roof top
   // must not suspend the controller above its actual support surface.
   if(p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ){let top=Infinity;for(const plane of s.planes)if(plane.y>0)top=Math.min(top,s.y+(plane.c-plane.x*(p.x-s.x)-plane.z*(p.z-s.z))/plane.y);if(p.y>=top-.18)continue;}
   let lo=0,hi=Math.max(0,h-2*r),inside=true;const local={x:p.x-s.x,y:p.y+r-s.y,z:p.z-s.z};for(const plane of s.planes){const gap=plane.c+r*Math.hypot(plane.x,plane.y,plane.z)-plane.x*local.x-plane.y*local.y-plane.z*local.z;if(Math.abs(plane.y)<1e-9){if(gap<0){inside=false;break;}}else if(plane.y>0)hi=Math.min(hi,gap/plane.y);else lo=Math.max(lo,gap/plane.y);if(lo>hi){inside=false;break;}}if(inside)return false;continue;}if(b.span){const s=b.span,u=(p.x-s.x)*s.tx+(p.z-s.z)*s.tz,v=-(p.x-s.x)*s.tz+(p.z-s.z)*s.tx,inside=Math.abs(v)<=s.halfWidth&&u>=s.startU+s.cutA*v&&u<=s.endU+s.cutB*v;let nearest={x:u,z:v,d:0};if(!inside){nearest={d:Infinity};for(let i=0;i<s.local.length;i++){const q=segmentPoint(u,v,s.local[i],s.local[(i+1)%s.local.length]);if(q.d<nearest.d)nearest=q;}}if(nearest.d>=r)continue;const y=s.y+s.slope*nearest.x;if(p.y+h<=y+s.base+.025||p.y>=y+s.top-(b.floor?.18:.025))continue;return false;}const cx=clamp(p.x,b.minX,b.maxX),cz=clamp(p.z,b.minZ,b.maxZ);if((p.x-cx)**2+(p.z-cz)**2<r*r)return false;}return true;}

 function moveCapsule(position,delta,r=.36,h=1.8,options={}){const p={x:position.x,y:position.y,z:position.z},steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.y||0,delta.z)/.35)),contacts=[];for(let i=0;i<steps;i++){for(const axis of['x','z','y']){const v=(delta[axis]||0)/steps;if(!v)continue;const candidate={...p,[axis]:p[axis]+v};

   // Resolve a crossed support plane before rejecting the downward axis step.

   // Otherwise a fast descent can stop one whole substep above a thin floor.

   if(axis==='y'&&v<0){const support=groundHeight(p.x,p.z,p.y);if(p.y>=support-.18&&candidate.y<support){candidate.y=support;contacts.push('y');}}

   if(capsuleClear(candidate,r,h,options))p[axis]=candidate[axis];else contacts.push(axis);}const ground=groundHeight(p.x,p.z,p.y);if(p.y<ground&&ground-p.y<.65)p.y=ground;}return{...p,position:p,blocked:contacts.length>0,contacts,ground:groundHeight(p.x,p.z,p.y)};}

 function surfaceNormal(x,z){const e=.25,a=terrainHeight(x-e,z)-terrainHeight(x+e,z),b=terrainHeight(x,z-e)-terrainHeight(x,z+e),len=Math.hypot(a,e*2,b);return{x:a/len,y:e*2/len,z:b/len};}

 function lineOfSight(a,b){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=Math.hypot(dx,dy,dz);const h=raycast(a,{x:dx,y:dy,z:dz},len);return!h||h.distance>=len-.12;}

 // Resolve tiny accumulated motion too: a millimetre dead zone lets sustained thrust creep through walls.

 function resolveVehicle(e,previous,dt){const radius=e.radius||1,height=e.height||1.6,origin={x:previous.x,y:previous.y+height/2,z:previous.z},delta={x:e.x-previous.x,y:e.y-previous.y,z:e.z-previous.z},len=Math.hypot(delta.x,delta.y,delta.z),impacts=[];if(len>0){const hit=raycast(origin,delta,len,radius,{terrain:false,ignoreFloors:true,allowSeparating:true});if(hit&&hit.distance<len&&origin.y+height>hit.collider.minY){const t=clamp((hit.distance-.04)/(len||1),0,1);e.x=previous.x+delta.x*t;e.z=previous.z+delta.z*t;if(hit.normal.y)e.y=previous.y+delta.y*t;const speed=Math.hypot(e.vx||0,e.vy||0,e.vz||0);impacts.push({id:hit.id,speed,normal:hit.normal,point:hit.point,material:hit.material});if(e.vx!==undefined)e.vx*=.12;if(e.vz!==undefined)e.vz*=.12;if(e.speed!==undefined)e.speed*=.12;}}

  // Wingtip casts share the same static query; visibly wide aircraft cannot cut towers.

  if(e.wingRadius&&e.wingRadius>radius&&len>0){const yaw=e.yaw||0;for(const side of[-1,1]){const off={x:Math.cos(yaw)*e.wingRadius*side,z:-Math.sin(yaw)*e.wingRadius*side},hit=raycast({x:previous.x+off.x,y:previous.y+height*.6,z:previous.z+off.z},delta,len,.22,{terrain:false,allowSeparating:true});if(hit){e.x=previous.x;e.z=previous.z;impacts.push({id:hit.id,speed:Math.hypot(e.vx||0,e.vz||0),normal:hit.normal,point:hit.point,material:hit.material});e.vx=(e.vx||0)*.1;e.vz=(e.vz||0)*.1;break;}}}return impacts;

 }

 const pedestrianEdges=new Map();

 function walkLine(a,b,r=.31){const len=distance(a,b),steps=Math.max(1,Math.ceil(len/1.5)),ay=Number.isFinite(a.y)?a.y:groundHeight(a.x,a.z),by=Number.isFinite(b.y)?b.y:groundHeight(b.x,b.z);for(let i=0;i<=steps;i++){const t=i/steps,x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t),reference=lerp(ay,by,t),y=groundHeight(x,z,reference+.25),water=waterHeight(x,z);if(Math.abs(y-reference)>.8||water!==null&&y<water-.1||!capsuleClear({x,y:y+.065,z},r,1.75))return false;}return true;}

 function pedestrianEdge(a,b){const key=a.id<b.id?a.id+'|'+b.id:b.id+'|'+a.id,known=pedestrianEdges.get(key);if(known?.revision===world.navigationRevision)return known.clear;const clear=walkLine(a,b);pedestrianEdges.set(key,{revision:world.navigationRevision,clear});return clear;}

 function route(from,to,kind='road',options={}){const nodes=kind==='ped'?world.pedNodes:world.nodes,map=kind==='ped'?pmap:nmap;if(!nodes.length)return[];const nearest=p=>typeof p==='string'?map.get(p):nodes.reduce((a,b)=>distance(b,p)<distance(a,p)?b:a,nodes[0]),start=nearest(from),end=nearest(to);if(!start||!end)return[];const costs=new Map([[start.id,0]]),parent=new Map(),open=new Set([start.id]);while(open.size){let id=null;for(const k of open)if(id===null||costs.get(k)<costs.get(id))id=k;open.delete(id);if(id===end.id)break;for(const l of map.get(id).links){if(options.blockedEdges?.includes(id+'|'+l.to)||kind==='ped'&&!pedestrianEdge(map.get(id),map.get(l.to)))continue;const c=costs.get(id)+l.cost;if(!costs.has(l.to)||c<costs.get(l.to)){costs.set(l.to,c);parent.set(l.to,id);open.add(l.to);}}}if(!costs.has(end.id))return[];const path=[];let id=end.id;while(id){const n=map.get(id);path.push({x:n.x,y:n.y,z:n.z,id:n.id,layer:n.layer});id=parent.get(id);}return path.reverse();}

 function interiorAt(x,z,y=2.5){return world.interiors.find(s=>Math.abs(x-s.x)<s.w/2-.2&&Math.abs(z-s.z)<s.d/2-.2&&y>=s.y-.6&&y<s.y+s.h)||null;}

 function setDoorOpen(id,open){const d=world.doors.find(d=>d.id===id||d.serviceId===id);if(!d)return false;d.open=!!open;d.collider.enabled=!open;world.navigationRevision++;return true;}

 function validate(){const issues=[];for(const s of world.services){if(!route(world.spawn,s.entrance).length)issues.push('Unreachable road: '+s.id);if(!route(world.spawn,s.entrance,'ped').length)issues.push('Unreachable pedestrian entrance: '+s.id);const p={x:s.x,y:s.y+.01,z:s.z+s.d/2};if(!capsuleClear(p,.36,1.8))issues.push('Blocked doorway: '+s.id);}if(world.runway.length<700||world.runway.length>900)issues.push('Runway length outside target');return{ok:!issues.length,issues,counts:{districts:world.districts.length,interiors:world.interiors.length,roads:world.roads.length,lanes:world.lanes.length,pedNodes:world.pedNodes.length,buildings:world.buildings.length,colliders:world.colliders.length,caches:world.caches.length,jumps:world.jumps.length},collision:'all-resident AABB broadphase with oriented graded bridge prisms, swept rays, axis-sliding capsules; dynamic arcade simulation owns contacts'};}

 world.activityPoints=world.services.filter(s=>s.approach).map(s=>({id:'visit:'+s.id,nodeId:'approach:'+s.id,name:s.name,kind:['diner','clothing','equipment'].includes(s.type)?'shop':'visit'}));

 for(const district of world.districts){const point=world.pedNodes.filter(n=>!n.entrance&&capsuleClear(n,.35,1.75)).reduce((best,n)=>!best||distance(n,district)<distance(best,district)?n:best,null);if(point)world.activityPoints.push({id:'district:'+district.id,nodeId:point.id,name:district.landmark,kind:district.id==='palmstrand'||district.id==='verdant-hills'?'view':'walk'});}

 world.regionRoutes=world.districts.map(d=>{const destination=world.services.filter(s=>s.district===d.id).sort((a,b)=>distance(a,d)-distance(b,d))[0]?.entrance||d,drive=route(world.spawn,destination),walk=route(world.spawn,destination,'ped');return{id:d.id,name:d.name,destination,roadNodeIds:drive.map(n=>n.id),pedestrianNodeIds:walk.map(n=>n.id),connections:[...new Set(drive.slice(1).flatMap((n,i)=>{const link=nmap.get(drive[i].id).links.find(l=>l.to===n.id);return link?[world.roads.find(r=>r.id===link.road).name]:[];}))]};});

 return Object.assign(world,{rampHeight,terrainHeight,groundHeight,waterHeight,surfaceNormal,walkLine,raycast,lineOfSight,capsuleClear,moveCapsule,resolveVehicle,nearestRoad,districtAt,interiorAt,route,setDoorOpen,validate,queryAABB:(a,b)=>Array.from(candidates(a.x,a.z,b.x,b.z)).filter(c=>c.maxX>=a.x&&c.minX<=b.x&&c.maxZ>=a.z&&c.minZ<=b.z),serviceById:Object.fromEntries(world.services.map(s=>[s.id,s]))});

}

return{create,DISTRICTS,rng,clamp,distance,segmentPoint,coastX,landHeight};

});






