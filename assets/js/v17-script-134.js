
/* Palm Cove's plan uses metres measured inward from its south-facing doors. */
(function(root){'use strict';
const TAU=Math.PI*2, cream='#e8d8bb',teal='#135d64',ink='#172d39',gold='#c8a65a',coral='#d77967',navy='#1c263d';
const red='#b83948',black='#20212d',green='#148152',slotSymbols=root.CityCasinoRounds.rules.symbols;
const clamp=n=>Math.max(0,Math.min(1,n));
function symbolsFor(round,now=Date.now()){
 const elapsed=clamp((now-round.startedAt)/Math.max(1,round.endsAt-round.startedAt));
 return [0,1,2].map(i=>elapsed>=[.73,.865,1][i]?round.reels[i]:slotSymbols[(Math.floor(elapsed*28)+i*2)%3]);
}
function sectorPose(round,now){
 const t=clamp((now-round.startedAt)/Math.max(1,round.endsAt-round.startedAt)),ease=1-(1-t)**3;
 const wheel=TAU*(2+1/8)*ease,sector=(round.sector+.5)*TAU/15;
 return {wheel,angle:(sector+TAU/8-4*TAU)*ease,radius:.675+(1-ease)*.07};
}
function icon(ctx,name,x,y,s){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 const line=(points,color,width)=>{ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
 const circle=(a,b,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(a,b,r,0,TAU);ctx.fill();};
 if(name==='CHERRY'){
  ctx.strokeStyle='#276650';ctx.lineWidth=.075;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-.21,.12);ctx.quadraticCurveTo(.05,-.16,.14,-.42);ctx.quadraticCurveTo(.3,-.22,.23,.18);ctx.stroke();
  ctx.fillStyle='#487451';ctx.beginPath();ctx.ellipse(.27,-.32,.17,.065,-.35,0,TAU);ctx.fill();
  for(const [a,b]of [[-.22,.17],[.21,.23]]){circle(a,b,.20,'#ae2941');circle(a-.066,b-.075,.05,'#ffe9d4');}
 }else if(name==='BELL'){
  circle(0,-.34,.09,'#97651d');circle(0,.31,.12,'#9f6827');ctx.fillStyle='#e8ad40';ctx.strokeStyle='#a06928';ctx.lineWidth=.045;
  ctx.beginPath();ctx.moveTo(-.39,.25);ctx.quadraticCurveTo(-.25,.14,-.245,-.09);ctx.bezierCurveTo(-.23,-.42,.23,-.42,.245,-.09);ctx.quadraticCurveTo(.25,.14,.39,.25);ctx.closePath();ctx.fill();ctx.stroke();
  line([[-.34,.19],[.34,.19]],'#fff0a3',.055);
 }else{
  ctx.fillStyle='#29a5af';ctx.strokeStyle='#1d687b';ctx.lineWidth=.045;ctx.beginPath();[[-.42,-.15],[-.24,-.34],[.24,-.34],[.42,-.15],[0,.39]].forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.fill();ctx.stroke();
  line([[-.42,-.15],[.42,-.15]],'#c8f8ef',.048);line([[-.16,-.33],[-.19,-.15],[0,.38],[.19,-.15],[.14,-.33]],'#b2e8e2',.035);
 }
 ctx.restore();
}
function palm(ctx,x,y,s){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=coral;ctx.beginPath();ctx.arc(0,-.06,.38,Math.PI,2*Math.PI);ctx.fill();
 ctx.strokeStyle=gold;ctx.lineWidth=.035;
 for(let n=0;n<3;n++){const yy=.015+n*.09,ww=.35-n*.055;ctx.beginPath();ctx.moveTo(-ww,yy);ctx.lineTo(ww,yy);ctx.stroke();}
 ctx.fillStyle=cream;ctx.beginPath();ctx.moveTo(-.07,.28);ctx.quadraticCurveTo(.015,-.03,-.012,-.23);ctx.lineTo(.025,-.255);ctx.quadraticCurveTo(.12,-.04,.015,.28);ctx.fill();
 for(const [ex,ey]of [[-.35,-.31],[-.3,-.5],[-.17,-.6],[.15,-.58],[.35,-.45],[.32,-.25]]){
  ctx.beginPath();ctx.moveTo(0,-.22);ctx.quadraticCurveTo(ex*.57,ey-.15,ex,ey);ctx.quadraticCurveTo(ex*.52,ey+.025,0,-.22);ctx.fill();
 }
 ctx.restore();
}
function artAtlas(T){
 const c=document.createElement('canvas');c.width=c.height=2048;const g=c.getContext('2d'),tiles={};
 let xx=2,yy=2,row=0;
 function tile(key,w,h,paint){
  if(xx+w+3>2048){xx=2;yy+=row+4;row=0;}if(yy+h+3>2048)throw Error('Casino artwork atlas overflow');
  g.save();g.translate(xx,yy);g.beginPath();g.rect(0,0,w,h);g.clip();paint(w,h);g.restore();
  tiles[key]=[(xx+.5)/2048,1-(yy+h-.5)/2048,(xx+w-.5)/2048,1-(yy+.5)/2048];xx+=w+4;row=Math.max(row,h);
 }
 const bg=(w,h,color)=>{g.fillStyle=color;g.fillRect(0,0,w,h);},txt=(str,x,y,size,color=cream,family='bold Georgia,serif')=>{g.font=family.replace(' ', ' '+size+'px ');g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.fillText(str,x,y);},
 line=(x1,y1,x2,y2,color,width=2)=>{g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();},
 border=(w,h,color,pad,width)=>{g.lineWidth=width;g.strokeStyle=color;g.strokeRect(pad,pad,w-2*pad,h-2*pad);};
 tile('facade',1024,216,(w,h)=>{bg(w,h,teal);border(w,h,gold,8,3);palm(g,125,120,154);txt('P A L M   C O V E',610,68,49,cream);txt('C A S I N O',610,147,84,'#fff1cc');for(const x of [242,916])line(x,108,x+39,108,gold,4);});
 tile('mural',916,314,(w,h)=>{bg(w,h,teal);border(w,h,gold,9,3);palm(g,w/2,142,185);txt('P A L M    C O V E',w/2,238,52);for(const flip of [0,1]){g.save();if(flip){g.translate(w,0);g.scale(-1,1);}for(let i=0;i<3;i++){g.strokeStyle=i===1?coral:gold;g.lineWidth=4;g.beginPath();g.arc(30,94,102+i*23,-.8,1.15);g.stroke();}g.restore();}});
 tile('roulette',640,126,(w,h)=>{bg(w,h,teal);border(w,h,gold,5,2);txt('R O U L E T T E',w/2,42,40);txt('◆ RED     ● BLACK     ▲ GREEN',w/2,89,23,'#f2d9a4','bold Arial,sans-serif');});
 tile('slots',364,98,(w,h)=>{bg(w,h,teal);border(w,h,gold,4,2);txt('S L O T S',w/2,49,46);});
 tile('information',534,322,(w,h)=>{bg(w,h,'#eee1c3');border(w,h,gold,9,3);txt('PALM COVE',w/2,52,38,teal);txt('G A M E   G U I D E',w/2,99,21,ink,'bold Arial,sans-serif');line(60,127,w-60,127,gold,3);txt('Roulette   ·   Choose a color',w/2,165,27,ink);txt('Slots   ·   Match three symbols',w/2,207,27,ink);txt('Fictional in-game money only',w/2,271,24,teal,'bold Arial,sans-serif');});
 tile('welcome',350,90,(w,h)=>{bg(w,h,teal);border(w,h,gold,5,2);txt('W E L C O M E',w/2,h/2,31);});
 for(const [key,bgColor,sym]of [['RED',red,'◆'],['BLACK',black,'●'],['GREEN',green,'▲']])tile(key,268,102,(w,h)=>{bg(w,h,bgColor);border(w,h,'#ffdf9c',5,3);txt(sym+'  '+key,w/2,h/2,35,'#fff5e5','bold Arial,sans-serif');});
 tile('marquee',264,84,(w,h)=>{bg(w,h,teal);border(w,h,gold,4,2);txt('C O V E   3',w/2,h/2,35,'#ffe2a2');});
 tile('spin',104,59,(w,h)=>{bg(w,h,coral);txt('SPIN',w/2,h/2,27,ink,'bold Arial,sans-serif');});
 tile('bet',87,52,(w,h)=>{bg(w,h,ink);txt('BET',w/2,h/2,27,'#efbd73','bold Arial,sans-serif');});
 for(const symbol of slotSymbols)tile(symbol,112,144,(w,h)=>{bg(w,h,'#f6ebd3');g.fillStyle='#e2d0b8';g.fillRect(0,0,w,8);g.fillRect(0,h-8,w,8);icon(g,symbol,w/2,h/2,104);});
 for(const d of '0123456789 ')tile('digit'+d,29,48,(w,h)=>{bg(w,h,ink);txt(d,w/2,h/2,34,'#efbd73','bold Arial,sans-serif');});
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 return {texture,tiles};
}
function create(host,site){
 const T=host.T, group=new T.Group(), exterior=new T.Group(),furniture=new T.Group(),roof=new T.Group();
 group.name='Palm Cove Casino';exterior.name='Casino exterior';furniture.name='Casino furnishings';roof.name='Casino roof';
 group.position.set(site.x,site.y,site.z+9);group.add(exterior,furniture,roof);host.environment.add(group);
 const artwork=artAtlas(T);host.signTextures.push(artwork.texture);
 const artMat=new T.MeshBasicMaterial({map:artwork.texture,toneMapped:false});
 const mats={
  matte:new T.MeshStandardMaterial({roughness:.9}),metal:new T.MeshStandardMaterial({roughness:.33,metalness:.49}),
  fabric:new T.MeshStandardMaterial({roughness:1}),wood:new T.MeshStandardMaterial({roughness:.55}),
  lamp:new T.MeshBasicMaterial({toneMapped:false}),glass:new T.MeshStandardMaterial({color:'#6bb5b9',transparent:true,opacity:.32,roughness:.17,metalness:.09,depthWrite:false}),
 };
 const cube=new T.BoxGeometry(1,1,1),disc=new T.CylinderGeometry(.5,.5,1,28),pot=new T.CylinderGeometry(.5,.4,1,20),
 leaf=new T.LatheGeometry([new T.Vector2(.015,-.5),new T.Vector2(.39,-.28),new T.Vector2(.50,.01),new T.Vector2(.32,.28),new T.Vector2(.006,.5)],6),
 geos=new Map(),batches=new Map(),labels=new Map(),dynamic=new Map(),dummy=new T.Object3D();
 function roundedPath(w,d,r){
  const s=new T.Shape(),a=w/2,b=d/2;s.moveTo(-a+r,-b);s.lineTo(a-r,-b);s.quadraticCurveTo(a,-b,a,-b+r);s.lineTo(a,b-r);s.quadraticCurveTo(a,b,a-r,b);s.lineTo(-a+r,b);s.quadraticCurveTo(-a,b,-a,b-r);s.lineTo(-a,-b+r);s.quadraticCurveTo(-a,-b,-a+r,-b);
  return s;
 }
 function rounded(w,d,r){
  const key=[w,d,r].join('/');if(geos.has(key))return geos.get(key);
  const geom=new T.ExtrudeGeometry(roundedPath(w,d,r),{depth:1,bevelEnabled:false,curveSegments:5});geom.translate(0,0,-.5);geom.rotateX(-Math.PI/2);geos.set(key,geom);return geom;
 }
 let part=exterior;
 function place(geom,c,x,y,z,w,h,d,kind='matte',rx=0,ry=0,rz=0){
  let bucket=batches.get(part);if(!bucket)batches.set(part,bucket=new Map());const k=geom.uuid+kind;
  if(!bucket.has(k))bucket.set(k,{geom,kind,items:[]});dummy.position.set(x,y,-z);dummy.scale.set(w,h,d);dummy.rotation.set(rx,ry,rz,'YXZ');dummy.updateMatrix();bucket.get(k).items.push([dummy.matrix.clone(),c]);
 }
 const box=(c,x,y,z,w,h,d,k='matte',ry=0)=>place(cube,c,x,y,z,w,h,d,k,0,ry),
  drum=(c,x,y,z,diam,h,depth=diam,k='matte')=>place(disc,c,x,y,z,diam,h,depth,k),
  slab=(c,x,y,z,w,h,d,r,k='matte')=>place(rounded(w,d,r),c,x,y,z,1,h,1,k);
 function plate(key,x,y,z,w,h,yaw=0,tilt=0,mutable){
  const target=mutable?dynamic:labels;if(!target.has(part))target.set(part,[]);const list=target.get(part);
  const rot=new T.Euler(tilt,yaw,0,'YXZ'),points=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([a,b])=>new T.Vector3(a*w,b*h,0).applyEuler(rot).add(new T.Vector3(x,y,-z)));
  list.push({key,points,mutable});
 }
 // Operating wing walls have genuine window and doorway openings.
 function pier(x,y,z,w,h,d){box(cream,x,y,z,w,h,d);}
 function frontWing(x){
  pier(x,.625,-.15,10,1.25,.30);pier(x,4.525,-.15,10,1.35,.30);
  for(const dx of [-3.95,3.95])pier(x+dx,2.55,-.15,2.1,2.6,.3);
  box('#8ac2c1',x,2.55,-.15,5.78,2.58,.075,'glass');
  for(const dx of [-2.91,0,2.91])box(teal,x+dx,2.55,-.15,.12,2.67,.40);
  box(teal,x,3.39,-.15,5.8,.074,.21);
  for(const yy of [1.26,3.84])box(teal,x,yy,-.15,5.95,.13,.48);
  box(cream,x,1.17,-.24,6.26,.11,.62);box(gold,x,3.97,-.26,6.18,.063,.45,'metal');
  for(const dx of [-4.83,4.83]){box(teal,x+dx,2.62,-.25,.28,5.24,.46);box(gold,x+dx,2.6,-.498,.065,4.78,.038,'metal');}
  box(teal,x,.52,-.17,9.95,1.03,.38);box(gold,x,1.08,-.17,9.96,.07,.41,'metal');
 }
 frontWing(-7);frontWing(7);pier(0,4.2,-.15,4,2,.30);
 for(const sign of [-1,1]){
  const x=sign*12.15;box(teal,x,.6,9,.30,1.2,18.6);box(gold,x,1.23,9,.31,.065,18.60,'metal');
  pier(x,1.48,9,.30,.44,18.6);pier(x,4.49,9,.30,1.42,18.6);
  for(const [start,end]of [[-.3,2.4],[6,7.4],[11,12.4],[16,18.3]])pier(x,2.74,(start+end)/2,.30,2.08,end-start);
  for(const z of [4.2,9.2,14.2]){
   box('#87bdbc',x,2.74,z,.08,2.05,3.57,'glass');
   for(const off of [-1.8,0,1.8])box(teal,x,2.74,z+off,.38,2.13,.12);
   for(const yy of [1.70,3.78])box(teal,x,yy,z,.40,.12,3.73);
  }
  for(const z of [.22,17.76])slab(teal,sign*11.93,2.608,z,.76,5.216,.89,.29);
 }
 pier(0,3.22,18.15,24,3.96,.30);box(teal,0,.60,18.15,24,1.2,.30);box(gold,0,1.23,18.15,24,.07,.32,'metal');
 // Level paving connects the opening to the coast sidewalk.
 slab('#cfbea0',0,-.038,-2.22,5.5,.07,4.55,.23);
 for(const sx of [-2.60,2.60])box(gold,sx,.004,-2.10,.06,.008,4.2,'metal');
 for(const z of [-1.4,-2.9])box('#ab9c83',0,.004,z,5.18,.008,.035);
 slab(teal,0,3.77,-1.31,8,.34,2.64,.4);slab(gold,0,3.94,-1.31,8.05,.095,2.69,.40,'metal');slab(cream,0,4.025,-1.31,7.92,.09,2.58,.38);
 for(const x of [-3,-1.3,1.3,3])drum('#ffe4aa',x,3.59,-1.6,.24,.035,.24,'lamp');
 for(const x of [-2.25,2.25]){box(teal,x,2.18,-.38,.45,4.36,.65);box(gold,x,2.18,-.73,.075,3.98,.045,'metal');place(cube,teal,x,3.23,-.95,.19,.19,1.45,'matte',-.48);box(gold,x,3.48,-1.42,.19,.07,.43,'metal');}
 box(teal,0,3.27,-.20,4.24,.14,.46);
 slab(teal,0,4.86,-.34,7.36,1.66,.46,.12);slab(gold,0,4.89,-.56,7.06,1.53,.18,.08,'metal');
 box(teal,0,5.73,-.34,5.5,.17,.46);plate('facade',0,4.89,-.66,6.94,1.43);
 const doors=[];for(const side of [-1,1]){
  const door=new T.Group();door.name='Sliding glass '+side;exterior.add(door);part=door;
  box('#accfc8',0,1.6,0,1.91,3.12,.07,'glass');for(const dx of [-.969,.969])box(teal,dx,1.6,0,.064,3.2,.10);
  for(const yy of [.07,1.05,3.14])box(yy===1.05?gold:teal,0,yy,0,1.96,.083,.106);
  box(gold,-side*.68,1.35,-.095,.055,.44,.06,'metal');doors.push(door);
 }
 part=roof;slab(cream,0,5.34,9,24.56,.28,18.55,.30);
 for(const z of [-.18,18.18]){box(teal,0,5.67,z,24.53,.66,.27);box(gold,0,5.995,z,24.56,.07,.30,'metal');}
 for(const x of [-12.16,12.16]){box(teal,x,5.67,9,.27,.66,18.2);box(gold,x,5.995,9,.30,.07,18.4,'metal');}
 for(const x of [-6,0,6])for(const z of [3.2,9.2,15.2]){
  slab('#c8b998',x,5.15,z,5.25,.10,4.45,.22);slab('#e0d2b5',x,5.088,z,5.03,.055,4.23,.2);
  if(x!==0||z!==9.2){drum(teal,x,5.018,z,1.24,.09,.66);drum('#ffe1af',x,4.953,z,1.09,.06,.51,'lamp');}
 }
 for(const x of [-11.86,11.86])box(teal,x,5.01,9,.25,.36,18);for(const z of [.1,17.9])box(teal,0,5.01,z,24,.36,.22);
 // One carpeted hall. Inlays are flat and use the same finished floor level.
 part=exterior;box(navy,0,-.052,9,24.02,.108,18.02);
 part=furniture;slab('#d6c6a8',0,.009,1.99,6,.012,4,.09);
 for(const x of [-1.56,1.56])box('#ac985e',x,.018,9,.046,.012,17.94);
 for(const z of [5.65,8.1,10.55,13,15.45]){
  for(const x of [-.73,.73])box('#374554',x,.018,z,.04,.009,1.83,'matte',x<0?.88:-.88);
 }
 for(const [x,z,w,d]of [[-6,10,7.25,5.6],[6.7,8.9,6.72,9.13]]){
  slab('#695f51',x,.012,z,w,.012,d,.48);slab('#253247',x,.022,z,w-.105,.012,d-.105,.43);
 }
 // Welcome and lounge furnishings.
 slab(teal,-8.5,.43,2.85,2.76,.86,.82,.17);slab('#ad8656',-8.5,.91,2.8,3,.24,1,.19,'wood');slab(gold,-8.5,1.022,2.8,3,.026,1,.18,'metal');slab('#9b785a',-8.5,1.04,2.8,2.96,.02,.96,.17,'wood');
 box('#257077',-8.5,.5,2.42,2.36,.52,.04);plate('welcome',-8.5,.54,2.389,1.33,.34);
 box(teal,11.91,2.28,1.26,.15,1.29,2.21);plate('information',11.821,2.28,1.26,2.12,1.17,-Math.PI/2);
 for(const x of [-3,3]){
  for(const a of [-1.17,1.17])for(const b of [-.31,.31])drum('#765e45',x+a,.14,16.8+b,.16,.28);
  slab('#987951',x,.29,16.8,3,.2,1,.12,'wood');slab('#307074',x,.51,16.78,2.92,.28,.97,.16,'fabric');
  slab('#226366',x,.86,17.15,2.95,.66,.26,.12,'fabric');
  for(const a of [-1.41,1.41])slab('#347779',x+a,.64,16.8,.14,.30,.90,.065,'fabric');
  for(const a of [-.42,.42])for(const b of [-.20,.20])drum('#a28150',x+a,.235,15.4+b,.09,.47);
  slab('#a98557',x,.49,15.4,1.2,.11,.70,.12,'wood');
 }
 box(ink,0,3.28,17.90,5.8,1.98,.14);plate('mural',0,3.28,17.815,5.69,1.89);
 for(const x of [-7.5,7.5]){
  box(teal,x,2.63,17.93,.46,.95,.12);box('#f8dfab',x,2.64,17.82,.29,.66,.13,'lamp');
  for(const yy of [2.28,2.99])box(gold,x,yy,17.82,.40,.08,.17,'metal');
  for(const off of [-.115,.115])box(gold,x+off,2.64,17.74,.021,.65,.025,'metal');
 }
 for(const [x,z] of [[-10.5,5.3],[-10.5,15.5],[10.5,3],[10.5,15.5]]){
  place(pot,coral,x,.40,z,.77,.72,.77);drum(gold,x,.75,z,.80,.09,.80,'metal');drum('#594f40',x,.799,z,.69,.018);
  for(let i=0;i<7;i++){const a=i*TAU/7;place(leaf,i%2?'#3f7e61':'#598c63',x+.14*Math.sin(a),1.10+(i%3)*.05,z-.14*Math.cos(a),.20,.88,.085,'matte',.49,a,0);}
 }
 // Radius and felt/pad heights are in metres to match the city character.
 for(const x of [-7.35,-4.65]){
  slab('#665142',x,.08,10,1.03,.16,1.58,.24,'wood');slab('#795c47',x,.47,10,.73,.67,1.19,.23,'wood');slab(gold,x,.78,10,.87,.08,1.30,.20,'metal');
 }
 slab('#67483b',-6,.815,10,4.68,.14,2.66,.39,'wood');
 slab(gold,-6,.937,10,4.56,.014,2.57,.33,'metal');slab('#175c4d',-6,.945,10,4.48,.010,2.50,.31);
 // Cut the rail's center out so the .95 m felt and its brass lip are exposed.
 const outline=roundedPath(4.8,2.8,.44);outline.holes.push(roundedPath(4.51,2.52,.32));const railGeom=new T.ExtrudeGeometry(outline,{depth:.094,bevelEnabled:true,bevelSize:.018,bevelThickness:.012,bevelSegments:2,curveSegments:6});railGeom.rotateX(-Math.PI/2);place(railGeom,'#4c3032',-6,.913,10,1,1,1,'fabric');
 const colors=[['RED',9.1],['BLACK',10],['GREEN',10.9]],select=new T.Group();furniture.add(select);select.name='Selected roulette pad';
 part=select;for(const sx of [-.83,.83])box('#ffe6a0',sx,.967,0,.035,.015,.70,'lamp');for(const sz of [-.349,.349])box('#ffe6a0',0,.967,sz,1.69,.015,.035,'lamp');part=furniture;select.visible=false;
 for(const [key,z]of colors)plate(key,-4.9,.958,z,1.6,.65,0,-Math.PI/2);
 drum('#594438',-7.2,.995,10,1.80,.094,1.80,'wood');drum(gold,-7.2,1.048,10,1.74,.044,1.74,'metal');drum('#442d2b',-7.2,1.073,10,1.65,.026,1.65,'wood');
 const rotor=new T.Group();rotor.name='15-sector roulette rotor';rotor.position.set(-7.2,1.093,-10);furniture.add(rotor);part=rotor;
 const sectorGeom=new T.RingGeometry(.445,.774,8,1,.012,TAU/15-.024);sectorGeom.rotateX(-Math.PI/2);
 for(let i=0;i<15;i++)place(sectorGeom,i===0?green:i%2?red:black,0,0,0,1,1,1,'matte',0,i*TAU/15);
 for(const r of [.435,.794]){const tor=new T.TorusGeometry(r,.022,8,64);tor.rotateX(-Math.PI/2);place(tor,gold,0,0,0,1,1,1,'metal');}
 drum('#b88b5b',0,.012,0,.83,.074,.83,'wood');place(pot,'#9b7148',0,.082,0,.51,.14,.51,'wood');
 drum(gold,0,.20,0,.105,.20,.105,'metal');for(const yaw of [0,Math.PI/2])box(gold,0,.23,0,.36,.055,.055,'metal',yaw);
 const ball=new T.Mesh(new T.SphereGeometry(.059,16,12),new T.MeshStandardMaterial({color:'#fff9dc',emissive:'#d6cfa3',emissiveIntensity:.27,roughness:.26}));ball.name='Roulette ball';furniture.add(ball);
 part=furniture;box(teal,-8.77,3.54,13.11,3.51,.76,.13);plate('roulette',-8.77,3.54,13.030,3.41,.68);
 for(const x of [-10,-7.54])drum(gold,x,4.36,13.11,.036,1.45,.036,'metal');
 // Outward rows use the same silhouette, shelf, screen, and data atlas.
 const stations=new Map();box(ink,6.70,.73,8.9,.098,1.46,6.40);
 for(const [bank,cx,dir]of [['A',6.2,-1],['B',7.2,1]])for(let i=0;i<4;i++){
  const z=6.2+i*1.8,id='slot-'+bank+(i+1),yaw=dir*Math.PI/2,tint=i%2?teal:'#1d5667';
  const at=depth=>cx+dir*depth,front=(key,depth,y,offset,w,h,tilt=0,mutable)=>plate(key,at(depth),y,z+offset*dir,w,h,yaw,tilt,mutable);
  slab(ink,cx,.070,z,.90,.14,1,.07);slab(tint,cx,.57,z,.81,.91,.96,.09);
  box('#273743',at(.12),1.46,z,.54,.89,.96);box('#344854',at(-.18),1.49,z,.46,1.04,.96);
  for(const off of [-.465,.465]){
   box(gold,at(.331),1.50,z+off,.06,.79,.045,'metal');
   box(tint,at(.016),1.72,z+off,.69,.42,.065);box(gold,at(.10),.17,z+off,.61,.037,.040,'metal');
  }
  box('#193040',at(.421),.59,z,.037,.57,.71);box(coral,at(.445),.67,z,.014,.046,.46);
  for(const off of [-.205,0,.205])box(gold,at(.444),.47,z+off,.018,.04,.112,'metal');
  place(cube,ink,at(.245),1.01,z,.40,.12,.98,'matte',0,0,dir*-.13);box(gold,at(.455),1.001,z,.030,.07,.95,'metal');
  front('bet',.432,1.085,-.235,.104,.057,-.78);
  for(let j=0;j<9;j++)front('digit'+(j===8?'1':' '),.432,1.085,-.163+j*.026,.026,.054,-.78,id+':digit:'+j);
  front('spin',.44,1.079,.286,.218,.111,-.78);
  box('#131e2a',at(.381),1.493,z,.050,.499,.89);
  for(const h of [1.283,1.705])box(gold,at(.408),h,z,.024,.021,.85,'metal');
  for(let j=0;j<3;j++)front(slotSymbols[j],.409,1.495,(j-1)*.269,.250,.365,0,id+':reel:'+j);
  for(const edge of [-.426,.426])box(coral,at(.418),1.493,z+edge,.025,.036,.033,'lamp');
  box(gold,at(.02),1.931,z,.77,.32,.985,'metal');box(tint,at(.02),2.055,z,.75,.09,1);
  front('marquee',.413,1.931,0,.900,.221);
  const stoolX=cx+dir*1.30;drum('#635b50',stoolX,.051,z,.51,.10,.51,'metal');drum(gold,stoolX,.275,z,.105,.40,.105,'metal');drum(teal,stoolX,.466,z,.59,.13,.59,'fabric');drum('#32777a',stoolX,.535,z,.565,.041,.565,'fabric');
  stations.set(id,{cx,dir,z,symbols:slotSymbols.slice(),wager:1});
 }
 box(teal,6.70,3.42,13.21,2.49,.66,.14);plate('slots',6.70,3.42,13.13,2.39,.57);
 for(const x of [5.94,7.46])drum(gold,x,4.43,13.21,.036,1.87,.036,'metal');
 const buffers=new Map(),rect=(uv,offset,key)=>{const [u0,v0,u1,v1]=artwork.tiles[key];uv.set([u0,v0,u1,v0,u1,v1,u0,v1],offset);};
 const mergedMaterials=new Map();
 function mount(parent,mesh,kind){mesh.receiveShadow=true;mesh.castShadow=parent===exterior&&kind!=='glass';parent.add(mesh);}
 for(const [parent,bucket]of batches){
  const singles=new Map();
  for(const {geom,kind,items}of bucket.values()){
   // One-off trim shapes share a draw with other fittings of the same finish.
   // More frequent repetition, including cabinet shells, stays instanced.
   if(items.length>=8||kind==='glass'){
    const mesh=new T.InstancedMesh(geom,mats[kind],items.length);
    for(const [i,[matrix,color]]of items.entries()){mesh.setMatrixAt(i,matrix);if(kind!=='glass')mesh.setColorAt(i,new T.Color(color));}
    mesh.computeBoundingSphere();mount(parent,mesh,kind);continue;
   }
   if(!singles.has(kind))singles.set(kind,{positions:[],normals:[],colors:[],indices:[]});
   const batch=singles.get(kind);
   for(const [matrix,hex]of items){
    const transformed=geom.clone().applyMatrix4(matrix),pos=transformed.attributes.position,offset=batch.positions.length/3,color=new T.Color(hex);
    batch.positions.push(...pos.array);batch.normals.push(...transformed.attributes.normal.array);
    for(let i=0;i<pos.count;i++)batch.colors.push(color.r,color.g,color.b);
    const indices=transformed.index;for(let i=0,n=indices?indices.count:pos.count;i<n;i++)batch.indices.push(offset+(indices?indices.getX(i):i));
    transformed.dispose();
   }
  }
  for(const [kind,b]of singles){
   const geom=new T.BufferGeometry();geom.setIndex(b.indices);
   for(const [name,array]of [['position',b.positions],['normal',b.normals],['color',b.colors]])geom.setAttribute(name,new T.Float32BufferAttribute(array,3));
   if(!mergedMaterials.has(kind)){const m=mats[kind].clone();m.vertexColors=true;mergedMaterials.set(kind,m);}
   mount(parent,new T.Mesh(geom,mergedMaterials.get(kind)),kind);
  }
 }
 for(const source of [labels,dynamic])for(const [parent,quads]of source){
  const positions=[],indices=[],uv=new Float32Array(quads.length*8),geo=new T.BufferGeometry();
  for(const [i,q]of quads.entries()){for(const v of q.points)positions.push(v.x,v.y,v.z);indices.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);rect(uv,i*8,q.key);if(q.mutable)buffers.set(q.mutable,{geo,uv,offset:i*8,key:q.key});}
  geo.setIndex(indices);geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.BufferAttribute(uv,2));parent.add(new T.Mesh(geo,artMat));
 }
 const setTile=(id,key)=>{const e=buffers.get(id);if(e&&e.key!==key){rect(e.uv,e.offset,key);e.key=key;e.geo.attributes.uv.needsUpdate=true;}};
 function slotDigits(id,input){const str=/^[0-9]{1,9}$/.test(String(input))?String(Number(input)).padStart(9,' '):'         ';for(let i=0;i<9;i++)setTile(id+':digit:'+i,'digit'+str[i]);}
 let profile=null,revision=-1,latestRoulette=null,lastBook=null,lastTime=-1;
 function reset(){profile=null;revision=-1;latestRoulette=null;lastBook=null;lastTime=-1;for(const [id,s]of stations){s.round=null;s.presentedAt=0;s.wager=1;slotDigits(id,1);s.symbols=slotSymbols.slice();s.symbols.forEach((v,i)=>setTile(id+':reel:'+i,v));}}
 function update(sim,now=Date.now()){
  const p=sim.player||host.world.spawn,dx=p.x-site.x,dz=p.z-site.z,d2=dx*dx+dz*dz;
  group.visible=d2<(host.graphics?.distance||2400)**2;
  furniture.visible=d2<65**2;if(!group.visible||!furniture.visible)return;
  host.casinoRenderTime=now;
  if(Math.abs(host.camera.position.x-site.x)<12&&Math.abs(host.camera.position.z-site.z)<9&&host.camera.position.y<site.y+5.2)host.fill.intensity+=.24;
  const door=site.door,slide=clamp(Number.isFinite(door?.slide)?door.slide:(door?.open?1:0));
  for(const [i,side]of [-1,1].entries())doors[i].position.set(side*(1+2*slide),0,.12);
  const focused=sim.casinoView;
  if(sim.profile){
   if(profile!==sim.profile){reset();profile=sim.profile;}
   if(revision!==profile.revision){
    const latest=id=>root.CityCasinoRounds.latest(profile,id);
    latestRoulette=latest('roulette');
    for(const [id,s]of stations){const r=latest(id);if(r&&r.id!==s.round?.id){s.round=r;s.presentedAt=-1;}}
    revision=profile.revision;
   }
  }else if(sim.casinoPresentation){
   const r=sim.casinoPresentation,s=stations.get(r.stationId);
   if(r.stationId==='roulette')latestRoulette=r;
   else if(s&&r.reels?.length===3&&s.round!==r){s.round=r;s.presentedAt=-1;}
  }
  if(latestRoulette!==lastBook||latestRoulette&&lastTime<latestRoulette.endsAt||lastTime<0){
   const pose=latestRoulette?sectorPose(latestRoulette,now):{wheel:0,angle:TAU/30,radius:.675};
   rotor.rotation.y=pose.wheel;ball.position.set(-7.2+Math.cos(pose.angle)*pose.radius,1.160,-10-Math.sin(pose.angle)*pose.radius);
   lastBook=latestRoulette;lastTime=now;
  }
  for(const [id,s]of stations){
   const r=s.round;if(!r||s.presentedAt>=r.endsAt)continue;s.presentedAt=now;
   const shown=symbolsFor(r,now);shown.forEach((v,i)=>setTile(id+':reel:'+i,v));s.symbols=shown;
   if(s.wager!==r.wager){s.wager=r.wager;slotDigits(id,r.wager);}
  }
  if(stations.has(focused)&&sim.casinoWager!=null&&now>=(stations.get(focused).round?.endsAt||0)){
   const s=stations.get(focused);if(s.wager!==sim.casinoWager){s.wager=sim.casinoWager;slotDigits(focused,sim.casinoWager);}
  }
  const selected=focused==='roulette'&&colors.find(e=>e[0]===sim.casinoColor);select.visible=Boolean(selected);if(selected)select.position.set(-4.9,0,-selected[1]);
 }
 function focus(sim){
  const id=sim.casinoView;if(id!=='roulette'&&!stations.has(id))return false;
  const camera=host.camera,w=host.canvas.clientWidth||1280,h=host.canvas.clientHeight||720,portrait=w<h;
  let eye,target,corners;
  if(id==='roulette'){
   eye=[-6,4.56,6.22];target=[-6,.95,9.83];corners=[];
   for(const x of [-8.44,-3.56])for(const z of [8.56,11.44])corners.push([x,1.04,z]);
  }else{
   const s=stations.get(id);eye=[s.cx+s.dir*2.32,1.64,s.z];target=[s.cx+s.dir*.38,1.55,s.z];corners=[];
   for(const z of [s.z-.53,s.z+.53])for(const y of [.87,2.15])corners.push([s.cx+s.dir*.45,y,z]);
  }
  camera.position.set(site.x+eye[0],site.y+eye[1],site.z+9-eye[2]);host.target.set(site.x+target[0],site.y+target[1],site.z+9-target[2]);
  host.firstPerson=true;camera.lookAt(host.target);camera.updateMatrixWorld();
  // Fit the actual near edges into the part of the scene left open by the betting panel.
  const aspect=w/h,usableW=portrait?.92:.58,usableH=portrait?.42:.85;
  let tangent=.22;for(const [x,y,z]of corners){
   const v=new T.Vector3(site.x+x,site.y+y,site.z+9-z).applyMatrix4(camera.matrixWorldInverse);
   tangent=Math.max(tangent,Math.abs(v.x)/(-v.z*aspect*usableW),Math.abs(v.y)/(-v.z*usableH));
  }
  camera.fov=2*Math.atan(tangent)*180/Math.PI;camera.setViewOffset(w,h,portrait?0:w*.185,portrait?h*.265:0,w,h);return true;
 }
 update({player:site});return {group,exterior,roof,furniture,stations,rotor,ball,update,focus,reset};
}
root.CityCasinoModel={create,symbolsFor,sectorPose};
})(typeof window==='undefined'?globalThis:window);

