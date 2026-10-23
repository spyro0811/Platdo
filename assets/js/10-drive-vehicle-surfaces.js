
/* Authored vehicle surfaces and fit-aware customization. Metres, +Z forward, +X driver-left. */
(function(){
'use strict';
const T=window.THREE,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
// Independent section curves: rear/shoulder/waist/front widths and deck heights,
// cabin glazing extents, roof taper and fascia identity. These are not scale variants.
const profiles={
compact:{belt:.96,cabin:[.19,.055,-.40,-.30,.355],widths:[.79,.98,1,.97,1,.87],tops:[-.04,.01,.01,0,-.07,-.15],nose:.10,flare:.012,face:'city',seat:-.39},
nova:{belt:.99,cabin:[.18,.015,-.31,-.20,.35],widths:[.82,.98,.97,.98,1,.86],tops:[-.06,.02,.015,0,-.04,-.12],nose:.09,flare:.018,face:'round',seat:-.40},
vektor:{belt:.91,cabin:[.20,-.015,-.35,-.19,.345],widths:[.79,1,.955,.97,1,.81],tops:[-.065,.02,0,.005,-.055,-.15],nose:.15,flare:.025,face:'coupe',seat:-.40,sport:true},
corsa:{belt:.88,cabin:[.185,.02,-.30,-.15,.33],widths:[.77,.99,.93,.97,1,.77],tops:[-.08,.01,-.02,-.025,-.09,-.20],nose:.18,flare:.028,face:'italian',seat:-.34,sport:true},
rally:{belt:.98,cabin:[.225,.085,-.39,-.28,.365],widths:[.87,1,.96,.97,1,.90],tops:[-.01,.025,.01,.02,-.02,-.09],nose:.065,flare:.045,face:'rally',seat:-.38},
apex:{belt:.86,cabin:[.255,.075,-.265,-.11,.34],widths:[.78,1,.94,.955,1,.75],tops:[-.06,.025,-.01,-.035,-.10,-.22],nose:.22,flare:.034,face:'blade',seat:-.23,sport:true,mid:true},
muscle:{belt:1.01,cabin:[.13,-.025,-.31,-.19,.35],widths:[.86,1,.99,.98,1,.92],tops:[-.02,.025,.025,.06,.015,-.085],nose:.055,flare:.026,face:'muscle',seat:-.48,sport:true},
roadster:{belt:.81,cabin:[.16,.035,-.265,-.105,.32],widths:[.76,.99,.91,.96,1,.76],tops:[-.045,.035,-.02,-.02,-.08,-.19],nose:.17,flare:.035,face:'roadster',seat:-.34,sport:true,targa:true},
touring:{belt:.93,cabin:[.205,.005,-.345,-.19,.345],widths:[.80,1,.97,.98,1,.82],tops:[-.06,.025,.01,.01,-.04,-.14],nose:.13,flare:.02,face:'gt',seat:-.42,sport:true},
zenith:{belt:.78,cabin:[.255,.08,-.245,-.075,.32],widths:[.82,1,.88,.96,1,.70],tops:[-.075,.03,-.035,-.04,-.14,-.27],nose:.27,flare:.045,face:'super',seat:-.23,sport:true,mid:true},
volt:{belt:.91,cabin:[.26,.08,-.39,-.20,.35],widths:[.82,.98,.96,.97,1,.79],tops:[-.075,.01,.015,-.015,-.055,-.15],nose:.16,flare:.018,face:'electric',seat:-.28,sport:true},
stratos:{belt:.75,cabin:[.28,.105,-.23,-.06,.31],widths:[.88,1,.87,.94,1,.66],tops:[-.045,.045,-.02,-.055,-.17,-.30],nose:.29,flare:.05,face:'wedge',seat:-.20,sport:true,mid:true},
hyperion:{belt:.73,cabin:[.29,.11,-.22,-.045,.30],widths:[.83,1,.855,.92,1,.65],tops:[-.03,.055,-.04,-.07,-.18,-.31],nose:.31,flare:.052,face:'hyper',seat:-.18,sport:true,mid:true}
};
const knots=[-.5,-.39,-.17,.11,.34,.49];
function at(z,values){for(let i=0;i<knots.length-1;i++)if(z<knots[i+1]){const t=clamp((z-knots[i])/(knots[i+1]-knots[i]),0,1),s=t*t*(3-2*t);return mix(values[i],values[i+1],s);}return values.at(-1);}
const mat=(color,roughness=.5,metalness=.2)=>new T.MeshStandardMaterial({color,roughness,metalness,envMapIntensity:.28});
function mesh(positions,indices,material,uv){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();const m=new T.Mesh(g,material);m.castShadow=m.receiveShadow=true;return m;}
function line(parent,points,r,material){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),m=new T.Mesh(new T.TubeGeometry(curve,Math.max(8,points.length*4),r,5,false),material);m.castShadow=true;parent.add(m);return m;}
function block(parent,w,h,d,x,y,z,material){const g=new T.BoxGeometry(w,h,d,2,2,2),p=g.attributes.position,r=Math.min(w,h,d)*.22;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),q=new T.Vector3(clamp(v.x,-w/2+r,w/2-r),clamp(v.y,-h/2+r,h/2-r),clamp(v.z,-d/2+r,d/2-r));v.sub(q).normalize().multiplyScalar(r).add(q);p.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();const m=new T.Mesh(g,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function sectionBody(L,W,belt,bottom,R,axles,kind,cabinSpan,detail){
 const p=profiles[kind]||profiles.compact,pos=[],ix=[],uv=[],sections=detail?84:40;
 // Rounded rocker, shoulder and crown with a deliberately sharp shoulder crease.
 const ring=[[-.70,0],[-.89,.03],[-.965,.12],[-.995,.28],[-1,.55],[-.985,.79],[-.945,.91],[-.86,.97],[-.64,1.015],[-.32,1.038],[0,1.045],[.32,1.038],[.64,1.015],[.86,.97],[.945,.91],[.985,.79],[1,.55],[.995,.28],[.965,.12],[.89,.03],[.70,0],[-.70,0]],N=ring.length;
 for(let j=0;j<=sections;j++){const t=j/sections,z=mix(-L*.5,L*.49,t),f=z/L,shoulder=at(f,p.widths),top=belt+at(f,p.tops),flare=Math.max(...axles.map(a=>Math.exp(-Math.pow((z-a)/.43,2))))*p.flare;
  let arch=bottom;for(const a of axles){const dz=z-a,r=R+.055;if(Math.abs(dz)<r)arch=Math.max(arch,R+Math.sqrt(r*r-dz*dz));}
  for(let k=0;k<N;k++){const [rx,ry]=ring[k],x=rx*W*.5*(shoulder+flare),arcWeight=clamp((Math.abs(rx)-.86)/.125,0,1);let y=mix(bottom,top,ry);y=Math.max(y,mix(bottom,arch,arcWeight));if(ry>.9)y=Math.max(y,mix(bottom,arch+.045,clamp((Math.abs(rx)-.55)/.27,0,1)));const nose=Math.max(0,(f-.32)/.17),rear=Math.max(0,(-f-.39)/.11);pos.push(x,y,z-nose*nose*Math.abs(rx)**2*p.nose+rear*rear*Math.abs(rx)**2*.08);uv.push(k/(N-1),t);
   if(j<sections&&k<N-1){const mid=(z+L*.99/sections*.5);if(cabinSpan&&mid>cabinSpan[0]&&mid<cabinSpan[1]&&k>=7&&k<=12)continue;const a=j*N+k;ix.push(a,a+N+1,a+1,a,a+N,a+N+1);}
  }
 }
 const shell=mesh(pos,ix,null,uv).geometry;shell.userData.sculpted=true;
 shell._driveCaps=[];for(const [row,front]of[[0,false],[sections,true]]){const cp=[],cu=[],ci=[];for(let k=0;k<N-1;k++){const b=(row*N+k)*3;cp.push(pos[b],pos[b+1],pos[b+2]);cu.push(pos[b]/W+.5,(pos[b+1]-bottom)/(belt-bottom));}for(let k=1;k<N-2;k++)front?ci.push(0,k,k+1):ci.push(0,k+1,k);shell._driveCaps.push({geometry:mesh(cp,ci,null,cu).geometry,surface:front?'front':'rear'});}return shell;
}
function paintable(m,id){m.userData.paintSurface=id;m.userData.noBatch=true;return m;}
function fitPaint(root,state){
 const d=root.userData;if(!d.paintSurfaces){d.paintSurfaces=new Map();root.traverse(o=>{if(o.userData.paintSurface){const id=o.userData.paintSurface;o.material=o.material.clone();d.paintSurfaces.set(id,{mesh:o,canvas:null,texture:null,key:''});}});}
 const color=/^#[\da-f]{6}$/i.test(state?.baseColor||'')?state.baseColor:(d.basePaintColor||'#b9543d'),dots=Array.isArray(state?.strokes)?state.strokes.slice(0,1400):[],bySurface=new Map();for(const dot of dots){if(!bySurface.has(dot.surface))bySurface.set(dot.surface,[]);bySurface.get(dot.surface).push(dot);}
 root.traverse(o=>{if(o.material&&o.material.userData.driveBasePaint&&!o.userData.paintSurface)o.material.color.set(color);});
 for(const [id,s]of d.paintSurfaces){const list=bySurface.get(id)||[],key=color+JSON.stringify(list);if(key===s.key)continue;s.key=key;d.paintTextureUpdates=(d.paintTextureUpdates||0)+1;
  if(!list.length){s.mesh.material.color.set(color);s.mesh.material.map=null;s.mesh.material.needsUpdate=true;continue;}
  if(!s.canvas){s.canvas=document.createElement('canvas');s.canvas.width=id==='shell'?1024:512;s.canvas.height=id==='shell'?1024:512;s.texture=new T.CanvasTexture(s.canvas);s.texture.colorSpace=T.SRGBColorSpace;s.texture.anisotropy=4;s.texture.userData.drivePaintTexture=true;}
  const c=s.canvas.getContext('2d'),w=s.canvas.width,h=s.canvas.height;c.fillStyle=color;c.fillRect(0,0,w,h);for(const q of list){if(!Number.isFinite(q.u)||!Number.isFinite(q.v)||!/^#[\da-f]{6}$/i.test(q.color||''))continue;c.fillStyle=q.color;c.beginPath();c.ellipse(clamp(q.u,0,1)*w,(1-clamp(q.v,0,1))*h,clamp(q.r||.02,.005,.12)*w,clamp(q.r||.02,.005,.12)*h,0,0,Math.PI*2);c.fill();}s.texture.needsUpdate=true;s.mesh.material.color.set('#ffffff');s.mesh.material.map=s.texture;s.mesh.material.needsUpdate=true;
 }d.paintState=state;d.paintDotCount=dots.length;
}
function wheelSet(root,option,helper){
 if(!option)return;const design=option.visual?.design??option.design??0,d=root.userData,R=d.wheels[0].pivot.userData.wheelRadius,alloy=mat(option.visual?.color||'#a6adb0',.24,.8),dark=mat('#242a2e',.8,.08),rotor=mat('#626c70',.55,.68),accent=mat(option.visual?.accent||'#b53b25',.48,.45),counts=[5,12,16,12,8,8,20,7,5,10],count=counts[design]||5;
 for(const w of d.wheels){const spin=w.spin;for(const child of [...spin.children]){if(child.geometry?.type==='TorusGeometry'&&child===spin.children[0])continue;child.traverse(m=>m.geometry?.dispose());spin.remove(child);}const side=w.side,face=side*.135,base=new T.Mesh(new T.CylinderGeometry(R*.62,R*.62,.18,40,1,true),dark);base.rotation.z=Math.PI/2;spin.add(base);
  const ring=new T.Mesh(new T.TorusGeometry(R*.635,.018,8,48),alloy);ring.rotation.y=Math.PI/2;ring.position.x=face;spin.add(ring);const disc=new T.Mesh(new T.CylinderGeometry(R*.50,R*.50,.015,32),rotor);disc.rotation.z=Math.PI/2;disc.position.x=side*.10;spin.add(disc);
  const spokeGeometries=[];for(let j=0;j<count;j++){const a=j*Math.PI*2/count,pair=design===3||design===6?((j%2)*.095-.047):0,sweep=design===1?.20:design===8?.26:0,start=.065,end=R*.60,steps=4,ps=[],ix=[];for(let k=0;k<=steps;k++){const r=mix(start,end,k/steps),angle=a+pair+sweep*k/steps,width=design===4?.069:design===8?.048:design===2?.009:design===1?.017:.020;for(const e of[-1,1])ps.push(face+side*(Math.sin(k/steps*Math.PI)*.023),Math.cos(angle)*r+Math.sin(angle)*width*e,Math.sin(angle)*r-Math.cos(angle)*width*e);if(k<steps){const n=k*2;ix.push(n,n+1,n+3,n,n+3,n+2);}}const m=mesh(ps,ix,alloy);m.material.side=T.DoubleSide;spin.add(m);}
  if(design===4||design===8){const plate=new T.Mesh(new T.CylinderGeometry(R*(design===4?.47:.30),R*(design===4?.47:.30),.012,40),alloy);plate.rotation.z=Math.PI/2;plate.position.x=face;spin.add(plate);}
  const hub=new T.Mesh(new T.CylinderGeometry(R*(design===9?.16:.13),R*.13,.035,design===9?6:20),design===9?accent:alloy);hub.rotation.z=Math.PI/2;hub.position.x=face+side*.015;spin.add(hub);
  if(design!==9)for(let j=0;j<5;j++){const a=j*Math.PI*2/5,b=new T.Mesh(new T.CylinderGeometry(.011,.011,.02,6),dark);b.rotation.z=Math.PI/2;b.position.set(face+side*.018,Math.cos(a)*R*.2,Math.sin(a)*R*.2);spin.add(b);}helper.batchFixedMeshes(spin);w.pivot.userData.wheelDesign=design;
 }d.wheelDesign=design;
}
function spoiler(root,option,helper){
 if(!option)return;const d=root.userData,L=d.length,W=d.width,p=profiles[d.kind]||profiles.compact,design=option.visual?.design??option.design??0,trim=mat('#20282b',.43,.5),paint=d.paint.clone(),g=new T.Group();g.name='equipped spoiler '+design;g.userData.breakawayPart='spoiler';g.userData.keepSeparate=true;d.body.add(g);const roofWing=design===6,deck=roofWing?d.height+.035:d.belt+at(-.40,p.tops)+.05,z=roofWing?L*p.cabin[3]-.045:-L*.415,heights=[.10,.045,.22,.30,.35,.19,.06,.13,.29,.37],height=heights[design],span=W*[.78,.76,.84,.94,.91,.86,.75,.83,.92,.98][design],chord=[.18,.12,.22,.31,.29,.24,.22,.30,.28,.35][design];
 const wing=(y,width,depth,delta=0)=>{const positions=[],ix=[],uv=[];for(let j=0;j<=24;j++){const x=(j/24-.5)*width,curve=(design===0?.095:design===7?.035:.018)*(1-(x/(width*.5))**2);for(let k=0;k<=8;k++){const t=k/8;positions.push(x,deck+y+curve+Math.sin(t*Math.PI)*.035,z+delta+(t-.5)*depth);uv.push(j/24,t);if(j<24&&k<8){const a=j*9+k;ix.push(a,a+1,a+10,a,a+10,a+9);}}}const m=mesh(positions,ix,design===0||design===1?paint:trim,uv);m.material.side=T.DoubleSide;g.add(m);return m;};
 if(design<2){wing(height,span,chord);for(const side of[-1,1])line(g,[[side*span*.49,deck,z-chord*.45],[side*span*.49,deck+height*.7,z],[side*span*.49,deck+height,z+chord*.42]],.022,paint);}
 else{const supports=design===9?[-.35,.35]:[-.29,.29];for(const fraction of supports){const x=W*fraction;if(design===4)line(g,[[x,deck,z+.04],[x,deck+height+.09,z+.06],[x,deck+height+.08,z-chord*.36],[x,deck+height,z-chord*.36]],.018,trim);else line(g,[[x,deck,z+.03],[x,deck+height*.65,z-.025],[x,deck+height,z]],.022,trim);}if(design===5){const left=wing(height,span*.46,chord);left.position.x=-span*.27;const right=wing(height,span*.46,chord);right.position.x=span*.27;}else wing(height,span,chord);if(design===8)wing(height-.12,span*.88,chord*.8,.035);if([3,4,8,9].includes(design))for(const side of[-1,1])block(g,.016,.14,chord*1.15,side*span*.5,deck+height,z,trim);}
 helper.batchFixedMeshes(g);d.spoilerDesign=design;d.spoilerAnchor={x:0,y:deck,z};
}
function signature(root,ctx){
 const d=root.userData,p=profiles[d.kind];if(!p)return;const {body,width:W,length:L,belt,height}=d,{trim,chrome,paintDark}=ctx,g=new T.Group();g.name=d.kind+' sculpted detail';body.add(g);const dark=mat('#151e23',.58,.12),lens=mat('#dbe5e9',.18,.30);lens.emissive=new T.Color('#c3def0');lens.emissiveIntensity=.1;const red=mat('#a92829',.22,.24);red.emissive=new T.Color('#c31b13');red.emissiveIntensity=.08;const fp=L*.49,rp=-L*.50;
 // Bumper skins follow the authored end section, including corner wrap, instead
 // of leaving a rectangular bumper floating ahead of a tapered bonnet.
 const faceZ=x=>fp-p.nose*Math.pow(x/(W*.5),2)+.012;
 const hoodY=(x,z)=>{const axles=d.wheels.filter(w=>w.side===1),flare=Math.max(...axles.map(w=>Math.exp(-Math.pow((z-w.basePosition.z)/.43,2))))*p.flare,rx=clamp(Math.abs(x)/(W*.5*(at(z/L,p.widths)+flare)),0,1),keys=[0,.32,.64,.86,.945,.985,1],vals=[1.045,1.038,1.015,.97,.91,.79,.55];let ry=.55;for(let i=0;i<keys.length-1;i++)if(rx<=keys[i+1]){ry=mix(vals[i],vals[i+1],(rx-keys[i])/(keys[i+1]-keys[i]));break;}const bottom=p.mid?.245:p.targa?.27:.3;let y=mix(bottom,belt+at(z/L,p.tops),ry),arch=bottom;for(const w of axles){const dz=z-w.basePosition.z,R=w.pivot.userData.wheelRadius,r=R+.055;if(Math.abs(dz)<r)arch=Math.max(arch,R+Math.sqrt(r*r-dz*dz));}if(ry>.9)y=Math.max(y,mix(bottom,arch+.045,clamp((rx-.55)/.27,0,1)));return y;};
 // The windshield and rear window sit on actual closed cowls, even when the
 // bonnet/deck sections are lower than the side beltline.
 for(const [front,zbase]of[[true,L*p.cabin[0]],[false,L*p.cabin[2]]]){const ps=[],ix=[],uv=[];for(let i=0;i<=32;i++){const x=(i/32-.5)*W*.90,zend=zbase+(front?.14:-.13);for(let j=0;j<2;j++){ps.push(x,j?hoodY(x,zend)+.002:belt,zbase+(j?(front?.14:-.13):0));uv.push(i/32,j);}if(i<32){const a=i*2;ix.push(a,a+1,a+3,a,a+3,a+2);}}const cowl=mesh(ps,ix,d.paint,uv);cowl.material.side=T.DoubleSide;paintable(cowl,front?'cowl-front':'cowl-rear');g.add(cowl);}
 for(const side of[-1,1]){const ps=[],ix=[],uv=[];for(let j=0;j<=30;j++){const z=mix(L*p.cabin[2],L*p.cabin[0],j/30),x=side*W*.45;const outer=side*W*.5*at(z/L,p.widths)*.975;ps.push(x,belt,z,outer,Math.min(belt-.025,hoodY(outer,z)),z);uv.push(j/30,1,j/30,0);if(j<30){const a=j*2;ix.push(a,a+1,a+3,a,a+3,a+2);}}const sill=mesh(ps,ix,d.paint,uv);sill.material.side=T.DoubleSide;paintable(sill,side>0?'belt-left':'belt-right');g.add(sill);line(g,[[side*W*.45,belt+.007,L*p.cabin[2]],[side*W*.45,belt+.007,L*p.cabin[0]]],.009,trim);}
 const strip=(parent,x1,x2,y1,y2,zfn,material)=>{const ps=[],ix=[];for(let j=0;j<=24;j++){const x=mix(x1,x2,j/24);for(const y of[y1,y2])ps.push(x,y,zfn(x));if(j<24){const a=j*2;ix.push(a,a+1,a+3,a,a+3,a+2);}}const m=mesh(ps,ix,material);m.material.side=T.DoubleSide;parent.add(m);return m;};
 for(const [bumper,front]of[[d.frontBumper,true],[d.rearBumper,false]]){const ps=[],ix=[],uv=[];for(let j=0;j<=28;j++){const x=(j/28-.5)*W*(front?.84:.86),end=Math.abs(x)/(W*.45);for(let k=0;k<4;k++){const y=[.295,.325,.41,.47][k]+end*end*.025,z=front?faceZ(x)+Math.sin(k/3*Math.PI)*.018:rp+end*end*.08-.012-Math.sin(k/3*Math.PI)*.014;ps.push(x,y,z);uv.push(j/28,k/3);}if(j<28)for(let k=0;k<3;k++){const a=j*4+k;ix.push(a,a+1,a+5,a,a+5,a+4);}}bumper.geometry.dispose();bumper.geometry=mesh(ps,ix,d.paint,uv).geometry;bumper.material=d.paint;bumper.material.side=T.DoubleSide;bumper.position.set(0,0,0);paintable(bumper,front?'front-bumper':'rear-bumper');}
 const frontTop=belt+at(.49,p.tops);strip(g,-W*.22,W*.22,.38,p.mid?Math.max(.49,frontTop-.045):Math.min(.56,frontTop-.045),x=>faceZ(x)+.022,dark);if(!p.mid&&p.face!=='electric')strip(g,-W*.17,W*.17,frontTop-.095,frontTop-.045,x=>faceZ(x)+.018,dark);
 for(let j=0;j<4;j++)strip(g,-W*.20,W*.20,.405+j*.027,.410+j*.027,x=>faceZ(x)+.025,p.face==='muscle'||p.face==='gt'?chrome:trim);
 for(const side of[-1,1]){strip(g,side*W*.275,side*W*.385,.36,.47,x=>faceZ(x)+.020,dark);for(let i=0;i<3;i++)strip(g,side*W*.285,side*W*.375,.38+i*.028,.386+i*.028,x=>faceZ(x)+.026,trim);}
 const splitter=[];for(let j=0;j<=20;j++){const x=(j/20-.5)*W*.87;splitter.push([x,.295,faceZ(x)+.030]);}line(g,splitter,.017,dark);
 strip(g,-W*.38,W*.38,.32,.44,x=>rp+.08*Math.pow(x/(W*.45),2)-.021,dark);for(let i=-3;i<=3;i++)block(g,.014,.095,.24,i*W*.10,.30,-L*.465,dark);
 // Interior wheel wells close the fender cavity while leaving suspension clearance.
 for(const w of d.wheels){const R=w.pivot.userData.wheelRadius+.045,ps=[],ix=[];for(let j=0;j<=24;j++){const a=j*Math.PI/24;for(const x of[w.side*W*.42,w.side*W*.49])ps.push(x,w.pivot.userData.wheelRadius+Math.sin(a)*R,w.basePosition.z+Math.cos(a)*R);if(j<24){const i=j*2;ix.push(i,i+1,i+3,i,i+3,i+2);}}const well=mesh(ps,ix,dark);well.material.side=T.DoubleSide;g.add(well);}
 // Every model gets fitted hood and rear-deck shut lines following its own section curve.
 for(const side of[-1,1]){const hood=[];for(let j=0;j<=9;j++){const z=mix(L*p.cabin[0]+.035,L*.425,j/9),x=side*W*(.29-.055*j/9);hood.push([x,hoodY(x,z)+.006,z]);}line(g,hood,.004,trim);line(g,[[side*W*.40,belt+.01,L*p.cabin[2]-.035],[side*W*.37,belt+at(-.40,p.tops)+.018,-L*.40],[side*W*.30,belt+at(-.455,p.tops)+.01,-L*.455]],.004,trim);}
 // Authored lamp signatures: circular classics, separated rally projectors, slashed
 // supercar blades and flush electric lighting. Their housings have physical depth.
 for(const side of[-1,1]){const z=fp-.018,y=frontTop-.035;
  if(['round','muscle','roadster','rally'].includes(p.face)){for(let j=0;j<(p.face==='roadster'?1:2);j++){const radius=p.face==='rally'?.049:p.face==='muscle'?.058:.051,x=side*(W*.30+(j-.5)*.125),housing=new T.Mesh(new T.CylinderGeometry(radius+.013,radius+.012,.027,24),dark),light=new T.Mesh(new T.CylinderGeometry(radius,radius,.008,24),lens.clone());for(const m of[housing,light]){m.rotation.x=Math.PI/2;m.position.set(x,y,faceZ(x)+(m===light?.024:.009));g.add(m);}light.userData.noBatch=true;d.lamps.push({mesh:light,front:true,side,original:light.material.color.clone()});}}
  else{const x1=side*W*.17,x2=side*W*.39,y0=frontTop-.015,rise=p.mid?.035:.018,points=[[x1,y0-.025,faceZ(x1)+.013],[x2,y0+rise-.025,faceZ(x2)+.013],[x2,y0+rise+.024,faceZ(x2)+.013],[x1,y0+.024,faceZ(x1)+.013]],housing=mesh(points.flat(),[0,1,2,0,2,3],dark);housing.material.side=T.DoubleSide;g.add(housing);const cx=(x1+x2)/2,cy=y0+rise/2,lps=points.map(([x,y,z])=>[mix(cx,x,.83),mix(cy,y,.46),faceZ(mix(cx,x,.83))+.020]),light=mesh(lps.flat(),[0,1,2,0,2,3],lens.clone());light.material.side=T.DoubleSide;light.userData.noBatch=true;g.add(light);d.lamps.push({mesh:light,front:true,side,original:light.material.color.clone()});}
  const rearX=side*W*.27,tail=strip(g,rearX-W*.115,rearX+W*.115,belt-.13,belt-.075,x=>rp+.08*Math.pow(x/(W*.45),2)-.012,red.clone());tail.userData.noBatch=true;d.lamps.push({mesh:tail,front:false,side,original:tail.material.color.clone()});
  const exhaust=new T.Mesh(new T.CylinderGeometry(.049,.049,.17,20),chrome);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*W*.30,.33,rp-.015);g.add(exhaust);const bore=new T.Mesh(new T.CircleGeometry(.035,20),dark);bore.rotation.y=Math.PI;bore.position.set(side*W*.30,.33,rp-.102);g.add(bore);
  if(p.mid){const surfaceX=z=>side*W*.5*at(z/L,p.widths),points=[[-L*.22,.46],[-L*.22,.64],[-L*.105,.65],[-L*.10,.49]].map(([z0,y0])=>[surfaceX(z0)+side*.007,y0,z0]),intake=mesh(points.flat(),[0,1,2,0,2,3],dark);intake.material.side=T.DoubleSide;g.add(intake);line(g,[...points,points[0]],.014,paintDark);for(let j=1;j<4;j++){const z0=mix(-L*.21,-L*.115,j/4);line(g,[[surfaceX(z0)+side*.013,.49,z0],[surfaceX(z0)+side*.013,.63,z0]],.008,trim);}}
  if(p.face==='muscle'){const ps=[];for(const [x,z0]of[[side*W*.09,L*.32],[side*W*.28,L*.32],[side*W*.28,L*.16],[side*W*.09,L*.16]])ps.push(x,belt+at(z0/L,p.tops)+.048,z0);const scoop=mesh(ps,[0,1,2,0,2,3],paintDark);scoop.material.side=T.DoubleSide;g.add(scoop);}
  if(p.face==='rally'){for(let j=0;j<3;j++){const vent=block(g,.012,.014,.19,side*(W*.22+j*.025),belt+.06,L*.30,trim);vent.rotation.y=side*.10;}block(g,.035,.10,.24,side*W*.50,.27,-L*.25,dark);}
 }
 if(p.face==='electric'||p.mid){block(g,W*.76,.018,.025,0,belt-.09,rp-.015,red);}
 if(p.mid){for(let i=0;i<7;i++){const z=-L*.28-i*.065;block(g,W*.42,.012,.024,0,belt+at(z/L,p.tops)+.035,z,trim);}for(const side of[-1,1])line(g,[[side*W*.31,height-.03,L*p.cabin[3]],[side*W*.36,belt+.06,-L*.32],[side*W*.40,belt+.04,-L*.40]],.029,paintDark);}
 if(p.face==='gt'){for(let i=-5;i<=5;i++){const x=i*W*.035;line(g,[[x,.40,faceZ(x)+.029],[x,frontTop-.055,faceZ(x)+.029]],.005,chrome);}}
 if(p.targa){const hoop=mat('#293337',.35,.62);line(g,[[-W*.35,belt,L*p.cabin[3]],[ -W*.31,height,L*p.cabin[3]],[0,height+.025,L*p.cabin[3]],[W*.31,height,L*p.cabin[3]],[W*.35,belt,L*p.cabin[3]]],.04,hoop);}
 d.modelVersion=3;d.modelIdentity=p.face;d.sculptedSections=84;d.vehicleProfile=p;return g;
}
window.DriveVehicleModels={profiles,sectionBody,paintable,fitPaint,wheelSet,spoiler,signature};
})();

