
/* PLATDO DRIVE — procedural scene. No network resources or independent frame loop.
 * new DriveScene(canvas, route); setCar(config, CSS color); setSettings(settings);
 * resize(pixelWidth,pixelHeight); render(sim,'chase'|'hood'|'cockpit',dt,view).
 * Vehicle coordinates use +Z forward, +Y up, +X driver-left (view-right is -X). All distances are metres. */
(function () {
  'use strict';
  const T = window.THREE;
  const VehicleModels=window.DriveVehicleModels,modelGeometry=window.DriveModelGeometry,modelSteps=(n,min=3)=>modelGeometry?.steps(n,min)||n;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const mix = (a,b,t) => a+(b-a)*t;
  const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  let seed=941;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const mat=(color,roughness=.7,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness,envMapIntensity:metalness>.65?.55:metalness>.15?.28:.075});
  const vertexMesh=(positions,indices,material,colors,uvs)=>{
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);
    if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));if(uvs)g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();
    const m=new T.Mesh(g,material);m.receiveShadow=true;return m;
  };
  const quad=(a,b,c,d,material)=>vertexMesh([...a,...b,...c,...d],[0,1,2,0,2,3],material);
  function canvasTexture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
  function addBox(parent,w,h,d,x,y,z,material,shadow=true){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;}
  function roundedBoxGeometry(w,h,d,r=.035){const g=new T.BoxGeometry(w,h,d,modelSteps(5,2),modelSteps(4,2),modelSteps(5,2)),p=g.attributes.position,n=g.attributes.normal,half=new T.Vector3(w*.5,h*.5,d*.5),v=new T.Vector3(),q=new T.Vector3();r=Math.min(r,w*.22,h*.22,d*.22);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);q.set(clamp(v.x,-half.x+r,half.x-r),clamp(v.y,-half.y+r,half.y-r),clamp(v.z,-half.z+r,half.z-r));v.sub(q).normalize();n.setXYZ(i,v.x,v.y,v.z);q.addScaledVector(v,r);p.setXYZ(i,q.x,q.y,q.z);}return g;}
  function addSoftBox(parent,w,h,d,x,y,z,material,r=.035){const mesh=new T.Mesh(roundedBoxGeometry(w,h,d,r),material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function curvedPanel(a,b,c,d,material,bulge=.025){const positions=[],indices=[],uv=[],rows=modelSteps(7,2),cols=modelSteps(12,3);for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const u=i/cols,v=j/rows;uv.push(u,v);positions.push(mix(mix(a[0],b[0],u),mix(d[0],c[0],u),v),mix(mix(a[1],b[1],u),mix(d[1],c[1],u),v)+Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*bulge,mix(mix(a[2],b[2],u),mix(d[2],c[2],u),v));if(i<cols&&j<rows){const k=j*(cols+1)+i;indices.push(k,k+1,k+cols+2,k,k+cols+2,k+cols+1);}}const m=vertexMesh(positions,indices,material,null,uv);m.castShadow=true;return m;}
  function sculptedBody(length,width,belt,bottom,wheelRadius,axles,kind,cabinSpan=null,detail=true){
    const pos=[],ix=[],steps=modelSteps(detail?60:32,16),profile=[[-.72,0],[-.92,.025],[-.995,.13],[-1,.55],[-.97,.84],[-.89,.96],[-.64,1.035],[-.31,1.06],[0,1.07],[.31,1.06],[.64,1.035],[.89,.96],[.97,.84],[1,.55],[.995,.13],[.92,.025],[.72,0]],N=profile.length;
    for(let j=0;j<=steps;j++){const t=j/steps,z=mix(-length*.5,length*.49,t),front=smooth(.67,1,t),rear=1-smooth(0,.22,t),waist=kind==='apex'?1-.045*Math.exp(-Math.pow((t-.49)/.18,2)):1;const flare=Math.max(...axles.map(a=>Math.exp(-Math.pow((z-a)/.48,2))))*(kind==='apex'?.028:kind==='vektor'?.018:.008);const w=width*.5*(1-.11*front*front-.10*rear*rear)*(waist+flare),top=belt-(kind==='apex'?.18:.12)*front*front-.045*rear*rear;
      let arch=bottom;for(const axle of axles){const dz=z-axle,r=wheelRadius+.05;if(Math.abs(dz)<r)arch=Math.max(arch,wheelRadius+Math.sqrt(r*r-dz*dz));}
      for(const [x,y]of profile){let py=mix(bottom,top,y);if(Math.abs(x)>.9)py=Math.max(py,mix(bottom,arch,smooth(.88,.98,Math.abs(x))));pos.push(x*w,py,z-front**4*Math.abs(x)**2*(kind==='apex'?.20:.10)+rear**4*Math.abs(x)**2*.08);}
      if(j<steps)for(let k=0;k<N;k++){const nextZ=mix(-length*.5,length*.49,(j+.5)/steps);if(cabinSpan&&nextZ>cabinSpan[0]&&nextZ<cabinSpan[1]&&k>=5&&k<=10)continue;const a=j*N+k,b=j*N+(k+1)%N;ix.push(a,b+N,b,a,a+N,b+N);}
    }for(let k=1;k<N-1;k++){ix.push(0,k,k+1);const a=steps*N;ix.push(a,a+k+1,a+k);}const mesh=vertexMesh(pos,ix,null);mesh.geometry.userData.sculpted=true;return mesh.geometry;
  }
  function rod(parent,a,b,r,material,segments=7){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),m=new T.Mesh(new T.CylinderGeometry(r,r,d.length(),modelSteps(segments,5)),material);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());m.castShadow=true;parent.add(m);return m;}
  const qualityRanks={potato:0,low:1,medium:2,high:3,epic:4,ultra:5,insane:6};
  // Merge small solid details by material, keeping improved geometry inexpensive to draw.
  function detailBatch(parent,geometries,material,tier=4){
    const positions=[],indices=[];for(const g of geometries){const start=positions.length/3;positions.push(...g.attributes.position.array);if(g.index)for(const i of g.index.array)indices.push(i+start);else for(let i=0;i<g.attributes.position.count;i++)indices.push(i+start);g.dispose();}
    const mesh=vertexMesh(positions,indices,material);mesh.castShadow=true;mesh.userData.qualityTier=tier;parent.add(mesh);return mesh;
  }
  function detailBox(w,h,d,x,y,z,rx=0,ry=0,rz=0){const g=new T.BoxGeometry(w,h,d);g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1)));return g;}
  function modelQuality(root,rank){root.traverse(o=>{if(o.userData.qualityTier!==undefined)o.visible=rank>=o.userData.qualityTier;if(o.userData.qualityMaxTier!==undefined)o.visible=rank<=o.userData.qualityMaxTier;});}
  function disposeModel(root){const geometries=new Set(),materials=new Set(),textures=new Set();for(const t of Object.values(root.userData.interior?.dialTextures||{}))textures.add(t);for(const s of root.userData.paintSurfaces?.values()||[])if(s.texture)textures.add(s.texture);root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);});for(const m of materials){for(const key of['map','normalMap','roughnessMap'])if(m[key])textures.add(m[key]);m.dispose();}geometries.forEach(g=>g.dispose());textures.forEach(t=>{if(!t.isRenderTargetTexture)t.dispose();});}

  // Dents are a bounded displacement field on the original car, not a soft-body solver.
  // All panels and attached trim sample the same field so a bumper cannot float outside a dent.
  function subdivideSurface(geometry,levels){
    let p=Array.from(geometry.attributes.position.array),uv=geometry.attributes.uv?Array.from(geometry.attributes.uv.array):null,ix=geometry.index?Array.from(geometry.index.array):Array.from({length:p.length/3},(_,i)=>i);
    for(let level=0;level<levels;level++){const midpoint=new Map(),next=[];const mid=(a,b)=>{const key=a<b?a+':'+b:b+':'+a;if(midpoint.has(key))return midpoint.get(key);const n=p.length/3;p.push((p[a*3]+p[b*3])*.5,(p[a*3+1]+p[b*3+1])*.5,(p[a*3+2]+p[b*3+2])*.5);if(uv)uv.push((uv[a*2]+uv[b*2])*.5,(uv[a*2+1]+uv[b*2+1])*.5);midpoint.set(key,n);return n;};
      for(let i=0;i<ix.length;i+=3){const a=ix[i],b=ix[i+1],c=ix[i+2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}ix=next;
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
  }
  function crackTexture(detail=true){return canvasTexture(detail?768:256,detail?384:128,(c,w,h)=>{
    // Fractures stay at the glass edges, preserving a clear centre of the windshield.
    if(!detail)c.scale(1/3,1/3);w=768;h=384;
    const noise=n=>{const v=Math.sin(n*127.1+91.7)*43758.5453;return v-Math.floor(v);};
    for(const [cx,cy,phase] of[[w*.16,h*.77,3],[w*.86,h*.22,17]]){const rings=[];for(let ray=0;ray<11;ray++){const a=ray*Math.PI*2/11+noise(ray+phase)*.18,len=35+noise(ray+phase+1)*110,points=[];c.beginPath();c.moveTo(cx,cy);
        for(let j=1;j<=5;j++){const r=len*j/5,twist=(noise(ray*8+j+phase)-.5)*.20,x=cx+Math.cos(a+twist)*r,y=cy+Math.sin(a+twist)*r*.70;points.push([x,y]);c.lineTo(x,y);}c.strokeStyle='rgba(223,235,230,.86)';c.lineWidth=1.25;c.stroke();rings.push(points);}
      for(let j=1;j<4;j++){c.beginPath();for(let k=0;k<rings.length;k++){const p=rings[k][j];k?c.lineTo(...p):c.moveTo(...p);}c.closePath();c.strokeStyle='rgba(174,206,211,.56)';c.lineWidth=.85;c.stroke();}
      c.fillStyle='rgba(216,229,228,.44)';c.beginPath();c.arc(cx,cy,3,0,Math.PI*2);c.fill();}
  });}
  function dentPoint(x,y,z,d,impacts,shape,out){
    const L=shape.length,W=shape.width,belt=shape.belt,sx=clamp(W/1.75,.85,1.35),sz=clamp(L/4.1,.9,1.6),sy=clamp(belt/.96,.8,1.35);
    const cabinSupport=1-smooth(belt+.08,shape.height,y),upper=smooth(belt-.31,belt-.03,y);
    const front=smooth(L*.14,L*.49,z),rear=smooth(L*.17,L*.5,-z),right=smooth(W*.15,W*.49,x),left=smooth(W*.15,W*.49,-x);
    let dx=(left*(d.left||0)-right*(d.right||0))*.20*(1-Math.pow(Math.min(1,Math.abs(z)/(L*.55)),4));
    let dz=rear*(d.rear||0)*.34-front*(d.front||0)*.43;
    const frontCorner=left*(d.frontLeft||0)+right*(d.frontRight||0),rearCorner=left*(d.rearLeft||0)+right*(d.rearRight||0);
    dz-=front*frontCorner*.21;dz+=rear*rearCorner*.17;
    dx+=(x>0?-1:1)*(front*frontCorner+rear*rearCorner)*.10;
    let dy=upper*((d.front||0)*(.25*Math.exp(-Math.pow((z-L*.30)/(L*.075),2))-.12*front*front)+(d.rear||0)*(.16*Math.exp(-Math.pow((z+L*.32)/(L*.07),2))-.07*rear));
    dy+=upper*.055*(front*frontCorner+rear*rearCorner)*Math.sin(x*6+z*9);
    let scar=0;
    for(const impact of impacts){const radius=clamp(impact.radius||.7,.35,1.25)*Math.sqrt(sx*sz),q=(x-impact.x)**2/(radius*radius)+(z-impact.z)**2/(radius*radius)+(y-Math.min(belt-.16,.66*sy))**2/(.55*sy)**2,weight=Math.exp(-q*1.6),strength=clamp(impact.strength||0,0,1),depth=.31*strength*weight;
      dx+=(impact.normalX||0)*depth;dz+=(impact.normalZ||0)*depth;
      // A raised shoulder around a compressed panel catches the light like folded sheet metal.
      dy+=upper*strength*.09*Math.exp(-Math.pow(Math.sqrt(q)-.8,2)*9)*Math.cos(x*4+z*6);
      // A narrow buckled crease follows the struck part of the bonnet or boot.
      const endImpact=Math.abs(impact.normalZ||0),end=impact.z>=0?1:-1,crease=Math.max(0,1-Math.abs(z-end*L*.30)/(L*.085)),local=Math.exp(-Math.pow((x-impact.x)/(radius*.85),2));
      dy+=upper*endImpact*strength*strength*crease*local*.12;
      scar=Math.max(scar,weight*strength);
    }
    out.set(x+clamp(dx*cabinSupport,-.48,.48)*sx,Math.max(.18,y+clamp(dy*cabinSupport,-.16,.34)*sy),z+clamp(dz*cabinSupport,-.68,.55)*sz);return scar;
  }
  function prepareCarDamage(root,shell,corners,lamps,shape,detail=true){
    const body=root.userData.body,records=[],crackMeshes=[],texture=crackTexture(detail);
    const originalShell=shell.geometry;if(!originalShell.userData.sculpted){shell.geometry=subdivideSurface(originalShell,modelGeometry.level<3?1:detail?3:2);originalShell.dispose();}
    body.traverse(mesh=>{if(!mesh.userData.damagePanel)return;const original=mesh.geometry;mesh.geometry=subdivideSurface(original,modelGeometry.level<3?1:2);original.dispose();});
    const addCrackedGlass=(a,b,c,d,zone)=>{const m=quad(a,b,c,d,new T.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));m.geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));body.add(m);crackMeshes.push({mesh:m,zone});};
    addCrackedGlass(corners.fl,corners.fr,corners.tr,corners.tl,'front');addCrackedGlass(corners.br,corners.bl,corners.ul,corners.ur,'rear');addCrackedGlass(corners.bl,corners.fl,corners.tl,corners.ul,'left');addCrackedGlass(corners.fr,corners.br,corners.ur,corners.tr,'right');
    body.updateMatrixWorld(true);const bodyInverse=body.matrixWorld.clone().invert(),v=new T.Vector3();
    body.traverse(mesh=>{if(!mesh.geometry||!mesh.geometry.attributes.position)return;for(let parent=mesh;parent&&parent!==body;parent=parent.parent)if(parent.userData.noDent)return;const position=mesh.geometry.attributes.position;
      const transform=new T.Matrix4().multiplyMatrices(bodyInverse,mesh.matrixWorld),inverse=transform.clone().invert(),baseline=new Float32Array(position.count*3);
      for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(transform);baseline.set([v.x,v.y,v.z],i*3);}
      records.push({mesh,baseline,inverse,isShell:mesh===shell});
    });
    shell.material=shell.material.clone();shell.material.vertexColors=true;shell.material.needsUpdate=true;shell.geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(shell.geometry.attributes.position.count*3).fill(1),3));
    const scars=new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.16,envMapIntensity:.28,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3}));scars.visible=false;body.add(scars);
    root.userData.damageVisual={revision:-1,state:null,records,crackMeshes,scars,lamps,shape,maxDisplacement:0,damagedVertexCount:0,applications:0};
  }
  function rebuildScuffs(data,damage,impacts){
    const positions=[],colors=[],indices=[],shape=data.shape,temp=new T.Vector3();const noise=n=>{const a=Math.sin(n*78.233+31.41)*43758.5453;return a-Math.floor(a);};
    const knots=[-.5,-.455,-.32,.12,.39,.49],widths=[.76,.98,1,1,.96,.78],tops=[-.05,.025,.03,.02,-.07,-.15];
    const at=(z,values)=>{const t=z/shape.length;for(let j=0;j<knots.length-1;j++)if(t<=knots[j+1])return mix(values[j],values[j+1],clamp((t-knots[j])/(knots[j+1]-knots[j]),0,1));return values[values.length-1];};
    const surface=(zone,u,v)=>{let x,y,z;if(zone==='front'||zone==='rear'){x=clamp(u,-shape.width*.35,shape.width*.35);y=clamp(v,.40,shape.belt-.14);z=zone==='front'?shape.length*.49:-shape.length*.5;}
      else if(zone==='hood'){x=clamp(u,-shape.width*.34,shape.width*.34);z=clamp(v,shape.length*.205,shape.length*.45);y=shape.belt+at(z,tops);}
      else{z=clamp(u,-shape.length*.42,shape.length*.40);x=(zone==='right'?1:-1)*shape.width*.5*at(z,widths);y=clamp(v,.445,shape.belt-.17);}
      dentPoint(x,y,z,damage,impacts,shape,temp);if(zone==='front')temp.z+=.008;if(zone==='rear')temp.z-=.008;if(zone==='right')temp.x+=.008;if(zone==='left')temp.x-=.008;if(zone==='hood')temp.y+=.009;return [temp.x,temp.y,temp.z];};
    const stamp=(zone,cx,cy,strength,index)=>{for(let j=0;j<8+Math.floor(strength*28);j++){const r=index*101+j*17,center=cx+(noise(r)-.5)*(.28+strength*.65),height=cy+(noise(r+1)-.5)*.22,length=.035+noise(r+2)*(.11+strength*.2),thick=.002+noise(r+3)*.012,slope=(noise(r+4)-.5)*.13,base=positions.length/3;
        for(const [u,v]of[[center-length,height-thick],[center+length,height+slope-thick],[center+length,height+slope+thick],[center-length,height+thick]])positions.push(...surface(zone,u,v));
        const shade=j%4===0?.54:j%3===0?.17:.29;for(let k=0;k<4;k++)colors.push(shade,shade*.98,shade*.92);indices.push(base,base+1,base+2,base,base+2,base+3);}
    };
    impacts.forEach((hit,i)=>{if(hit.strength<.075)return;const end=Math.abs(hit.normalZ)>Math.abs(hit.normalX),zone=end?(hit.z>0?'front':'rear'):(hit.x>0?'right':'left');stamp(zone,end?hit.x:hit.z,Math.min(shape.belt-.16,.66*shape.belt/.96),hit.strength,i);if(zone==='front'&&hit.strength>.32)stamp('hood',hit.x,shape.length*.37,hit.strength*.75,i+20);});
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();data.scars.geometry.dispose();data.scars.geometry=g;data.scars.visible=positions.length>0;
  }
  function applyCarDamage(root,player){
    const data=root.userData.damageVisual;if(!data)return;const damage=player.damage||null,revision=damage?(player.damageRevision||0):0;if(data.state===damage&&data.revision===revision)return;
    data.state=damage;data.revision=revision;data.maxDisplacement=0;data.damagedVertexCount=0;data.applications++;const d=damage||{},impacts=damage?(player.impacts||[]):[],v=new T.Vector3();
    for(const record of data.records){const attr=record.mesh.geometry.attributes.position,colors=record.isShell?record.mesh.geometry.attributes.color:null;
      for(let i=0;i<attr.count;i++){const k=i*3,x=record.baseline[k],y=record.baseline[k+1],z=record.baseline[k+2];let scar=0;if(damage)scar=dentPoint(x,y,z,d,impacts,data.shape,v);else v.set(x,y,z);
        if(record.isShell){const distance=Math.hypot(v.x-x,v.y-y,v.z-z);data.maxDisplacement=Math.max(data.maxDisplacement,distance);if(distance>.005)data.damagedVertexCount++;const dark=1-scar*.29;colors.setXYZ(i,dark,dark*(1-scar*.005),dark*(1-scar*.02));}
        v.applyMatrix4(record.inverse);attr.setXYZ(i,v.x,v.y,v.z);
      }attr.needsUpdate=true;if(colors)colors.needsUpdate=true;if(record.mesh.isMesh)record.mesh.geometry.computeVertexNormals();record.mesh.geometry.computeBoundingBox();record.mesh.geometry.computeBoundingSphere();
    }
    for(const item of data.crackMeshes){const amount=item.zone==='front'?(d.glass||0):Math.min(d.glass||0,(d[item.zone]||0)*.7);item.mesh.material.opacity=smooth(.10,.72,amount)*.85;item.mesh.visible=amount>.10;}
    for(const light of data.lamps){const zone=light.front?'front':'rear',corner=zone+(light.side>0?'Right':'Left'),strength=clamp((d[zone]||0)*.38+(d[corner]||0)*.85,0,1);light.mesh.material.color.copy(light.original).lerp(new T.Color('#1b2224'),smooth(.25,.7,strength));light.mesh.material.roughness=mix(.26,.87,strength);}
    rebuildScuffs(data,d,impacts);
  }

  // Geometry is authored in the vehicle frame: +X is the left seat when looking +Z.
  // Static detail shares a draw call by material/tier; animation and breakaway pivots stay separate.
  function batchFixedMeshes(group){
    group.updateMatrixWorld(true);const inv=group.matrixWorld.clone().invert(),groups=new Map(),skip=o=>{for(let p=o;p&&p!==group;p=p.parent)if(p.userData.keepSeparate||p.userData.breakawayPart||p.userData.noBatch||p.userData.licensePlate)return true;return false;};
    group.traverse(o=>{if(!o.isMesh||!o.geometry||Array.isArray(o.material)||o.material.transparent||skip(o))return;const key=o.material.uuid+':'+(o.userData.qualityTier??0)+':'+(o.userData.qualityMaxTier??9);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);});
    for(const list of groups.values()){if(list.length<2)continue;const ps=[],ns=[],uv=[],ix=[],source=list[0],tier=source.userData.qualityTier,max=source.userData.qualityMaxTier;
      for(const mesh of list){const g=mesh.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv,mesh.matrixWorld)),p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,offset=ps.length/3;for(let i=0;i<p.count;i++){ps.push(p.getX(i),p.getY(i),p.getZ(i));ns.push(n?.getX(i)||0,n?.getY(i)||0,n?.getZ(i)||0);uv.push(u?.getX(i)||0,u?.getY(i)||0);}if(g.index)for(const i of g.index.array)ix.push(i+offset);else for(let i=0;i<p.count;i++)ix.push(i+offset);g.dispose();mesh.geometry.dispose();mesh.removeFromParent();}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('normal',new T.Float32BufferAttribute(ns,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);const mesh=new T.Mesh(g,source.material);mesh.castShadow=mesh.receiveShadow=true;if(tier!==undefined)mesh.userData.qualityTier=tier;if(max!==undefined)mesh.userData.qualityMaxTier=max;group.add(mesh);
    }
  }
  function upgradeExterior(root,p){
    const d=root.userData,{body,length:L,width:W,belt,kind,height}=d,{trim,chrome,paintDark,frontBase,rearBase,wBase,detail}=p,compact=kind==='compact',sport=kind==='vektor'||kind==='apex',apex=kind==='apex',utility=['suv','van','truck'].includes(kind);
    const extras=new T.Group();extras.name='Exterior coachwork and lamp housings';body.add(extras);
    const dark=[],bright=[],painted=[];
    // Chamfered bumper cheeks and separate apertures define each model's face.
    for(const side of[-1,1]){
      const cheek=addSoftBox(extras,W*(apex?.16:.13),apex?.19:.21,.17,side*W*.35,.51,L*.455,paintDark,.045);cheek.rotation.y=side*.14;body.updateMatrixWorld(true);d.frontBumper.attach(cheek);
      const intake=addSoftBox(extras,W*(sport?.18:.12),.12,.026,side*W*.29,.51,L*.501,trim,.02);body.updateMatrixWorld(true);d.frontBumper.attach(intake);
      if(side===1){const lip=addSoftBox(extras,W*.88,.045,.16,0,.325,L*.448,paintDark,.015);body.updateMatrixWorld(true);d.frontBumper.attach(lip);}
      // Layered projector barrels are backed by a dark lamp pocket, not flat painted dots.
      for(let j=0;j<(compact?1:2);j++){const lens=new T.CylinderGeometry(compact?.038:.027,compact?.04:.032,.035,detail?16:10);lens.rotateX(Math.PI/2);lens.translate(side*(W*.25+(j-.5)*.075),belt-.15,L*.485+.043);bright.push(lens);}
      // Hood cut, boot cut and recessed beltline weather strip continue around the cabin.
      dark.push(detailBox(.014,.025,Math.abs(frontBase-rearBase)*.98,side*wBase,belt+.006,(frontBase+rearBase)*.5));
      if(sport){dark.push(detailBox(.035,.095,.29,side*W*.493,.59,-L*.15,0,0,side*.08));const blade=roundedBoxGeometry(.05,.12,L*.61,.015);blade.translate(side*W*.487,.34,-L*.03);painted.push(blade);}
      if(utility){const rail=roundedBoxGeometry(.05,.045,L*(kind==='suv'?.48:.26),.015);rail.translate(side*W*.34,height+.08,-L*.10);bright.push(rail);}
      // Stamped fender contour follows the wheel opening instead of intersecting the tire.
      for(const wheel of d.wheels.filter(w=>w.side===side)){const z=wheel.basePosition.z,r=wheel.pivot.userData.wheelRadius+.08,curve=[];for(let i=0;i<=18;i++){const a=i*Math.PI/18;curve.push(new T.Vector3(side*W*.508,wheel.pivot.userData.wheelRadius+Math.sin(a)*r,z+Math.cos(a)*r));}const tube=new T.TubeGeometry(new T.CatmullRomCurve3(curve),18,.015,4,false);painted.push(tube);}
    }
    // A visible rear valance and longitudinal ribs give the coupe/performance models different tails.
    dark.push(detailBox(W*.74,.11,.15,0,.37,-L*.465));for(let i=-2;i<=2;i++)dark.push(detailBox(.019,.095,.20,i*W*.105,.34,-L*.478));
    for(let j=0;j<(compact?3:sport?5:7);j++)bright.push(detailBox(W*.29,.009,.019,0,.56+j*.025,L*.524));
    if(kind==='suv'){for(const side of[-1,1])painted.push(detailBox(.06,.08,L*.55,side*W*.48,.34,-.12));}
    if(kind==='van'){for(const side of[-1,1]){dark.push(detailBox(.014,.55,.018,side*W*.465,1.32,-L*.20));dark.push(detailBox(.017,.025,L*.42,side*W*.468,.95,-L*.20));bright.push(detailBox(.025,.045,.18,side*W*.47,1.10,-L*.12));}dark.push(detailBox(.022,1.40,.018,0,1.34,-L*.455));}
    if(kind==='truck'){for(const side of[-1,1]){bright.push(detailBox(.14,.045,.45,side*W*.49,.47,L*.25));bright.push(detailBox(.14,.045,.45,side*W*.49,.67,L*.25));}for(let j=0;j<10;j++)dark.push(detailBox(W*.82,.018,.02,0,.90+j*.14,-L*.492));}
    detailBatch(extras,dark,trim,0);detailBatch(extras,painted,paintDark,1);detailBatch(extras,bright,chrome,2);
    root.userData.modelVersion=2;root.userData.mirrorMode='live rear-facing world cameras';
  }

  // Articulated seated adults. Pelvis/legs stay on the seat; only upper-body
  // springs respond to acceleration until an actual severe impact ejects them.
  function createOccupant(index,seat,scale=1,driver=false){
    const root=new T.Group();root.name=driver?'Seated driver':'Seated passenger '+index;root.userData.noBatch=true;root.userData.noDent=true;root.position.set(seat.x,seat.y+.07,seat.z);
    const skin=mat(['#c68b65','#77503b','#e0ae85','#aa7957'][index%4],.83),shirt=mat(['#435c6a','#ac684e','#777f55','#8b7697'][index%4],.94),trousers=mat(['#2d3745','#343b38','#49414a','#293e51'][index%4],.96),hair=mat(['#30251f','#171c20','#805835','#44392a'][index%4],.96),shoe=mat('#242727',.9),eye=mat('#e4ded1',.76),pupil=mat('#242a2b',.8);
    const mesh=(parent,geometry,material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
    const oval=(parent,material,x,y,z,sx,sy,sz)=>{const m=mesh(parent,new T.SphereGeometry(1,modelSteps(12,7),modelSteps(10,6)),material,x,y,z);m.scale.set(sx,sy,sz);return m;};
    const lower=new T.Group();root.add(lower);oval(lower,trousers,0,.035,0,.16,.105,.14);
    for(const side of[-1,1]){const x=side*.105;rod(lower,[x,.015,.02],[x,-.055,.30],.070,trousers,9);oval(lower,trousers,x,-.055,.30,.074,.078,.075);rod(lower,[x,-.07,.30],[x,-.32,.37],.052,trousers,8);oval(lower,shoe,x,-.34,.43,.073,.049,.13);}
    const upper=new T.Group();upper.position.y=.04;root.add(upper);
    const torso=new T.LatheGeometry([new T.Vector2(.125,0),new T.Vector2(.15,.07),new T.Vector2(.18,.28),new T.Vector2(.155,.34),new T.Vector2(.08,.37)],modelSteps(14,8));torso.scale(1,1,.60);mesh(upper,torso,shirt);rod(upper,[-.13,.33,.015],[.13,.33,.015],.053,shirt,8);
    oval(upper,skin,0,.386,.005,.056,.073,.053);
    const head=new T.Group();head.position.set(0,.485,.018);upper.add(head);oval(head,skin,0,0,0,.087,.115,.088);oval(head,skin,0,-.055,.018,.075,.064,.070);oval(head,hair,0,.063,-.009,.092,.063,.091);
    if(index%3===1)oval(head,hair,0,.014,-.068,.09,.105,.035);
    oval(head,skin,0,-.012,.086,.020,.031,.025);
    for(const side of[-1,1]){oval(head,skin,side*.086,-.005,-.004,.018,.034,.022);oval(head,eye,side*.034,.019,.078,.022,.011,.007);oval(head,pupil,side*.034,.019,.084,.008,.009,.004);rod(head,[side*.018,.044,.079],[side*.054,.046,.074],.006,hair,5);}
    rod(head,[-.026,-.056,.080],[.026,-.056,.080],.004,mat('#774c43',.9),5);
    const arms=[];for(const side of[-1,1]){const arm=new T.Group();arm.position.set(side*.17,.31,.003);upper.add(arm);rod(arm,[0,0,0],[side*.024,-.17,driver?.12:.025],.052,shirt,8);oval(arm,skin,side*.024,-.18,driver?.12:.025,.047,.048,.045);rod(arm,[side*.024,-.18,driver?.12:.025],[-side*.035,-.12,driver?.35:.18],.037,skin,8);oval(arm,skin,-side*.035,-.12,driver?.35:.18,.046,.032,.052);arms.push(arm);}
    // A dark diagonal belt has its own buckle and follows the chest's motion.
    rod(upper,[-.13,.31,.105],[.12,.03,.095],.013,mat('#242827',.95),5);mesh(lower,new T.BoxGeometry(.036,.022,.025),mat('#8d9291',.4,.5),.12,.065,.11);
    const wound=oval(upper,mat('#731a19',.9),-.065,.23,.115,.038,.065,.005);wound.visible=false;wound.userData.injuryMark=true;
    batchFixedMeshes(lower);batchFixedMeshes(head); // upper pivots and wound remain independently animated.
    root.scale.setScalar(scale);return{root,upper,head,arms,wound,seat:{...seat},driver,injury:0,ejected:false,pitch:0,roll:0,vPitch:0,vRoll:0,damage:null,lastImpact:null};
  }
  function installOccupants(car,interior,seatX,seatY,seatZ,rearBase,hasRear){
    const top=car.userData.height,headroom=Math.max(.40,top-seatY-.10),scale=Math.min(1,headroom/.69),seats=[{x:seatX,y:seatY,z:seatZ},{x:-seatX,y:seatY,z:seatZ}];
    if(hasRear)seats.push({x:seatX,y:seatY,z:rearBase+.40},{x:-seatX,y:seatY,z:rearBase+.40});
    interior.occupants=seats.map((seat,i)=>{const o=createOccupant(i,seat,scale,i===0);interior.root.add(o.root);return o;});car.userData.occupants=interior.occupants;car.userData.seatCount=seats.length;
  }
  function liveMirrorSurface(parent,w,h,x,y,z,name){
    const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:'#c9d8dd',toneMapped:false}));m.rotation.y=Math.PI;m.position.set(x,y,z);m.name=name;m.userData.noBatch=true;m.userData.noDent=true;m.userData.liveMirror=true;parent.add(m);return m;
  }

  function createVehicleInterior(car,shape){
    const d=car.userData,{width:W,length:L,belt,height,kind}=d,{frontBase,rearBase,frontTop,rearTop,wTop,detail}=shape;
    const root=new T.Group();root.name=kind+' physical cabin';root.userData.noDent=true;root.userData.noBatch=true;root.userData.vehicleInterior=true;
    const profile=VehicleModels?.profiles[kind],sport=profile?.sport||kind==='vektor'||kind==='apex',apex=!!profile?.mid||kind==='apex',utility=['suv','van','truck'].includes(kind),floor=.30,seatY=apex?.39:utility?.64:profile?.targa?.43:.51,seatZ=profile?.seat??(apex?-.23:kind==='vektor'?-.40:-.43),seatX=W*.235;
    const topY=belt-.025,dashFront=frontBase-.04,dashBack=frontBase-(apex?.58:.49),wheelZ=dashBack-.035,wheelY=topY-.055;
    const driverEyeAnchor=new T.Object3D();driverEyeAnchor.name='driverEyeAnchor';driverEyeAnchor.position.set(seatX,height-(apex?.18:.25),seatZ+.03);driverEyeAnchor.rotation.x=.055;root.add(driverEyeAnchor);car.userData.driverEyeAnchor=driverEyeAnchor;car.userData.driverSeat={x:seatX,y:seatY,z:seatZ};car.userData.cabinEnvelope={minX:-shape.wBase,maxX:shape.wBase,minY:floor,maxY:height,minZ:rearBase,maxZ:frontBase};car.userData.vehicleAxes={forward:[0,0,1],up:[0,1,0],right:[-1,0,0]};
    const trim=mat('#171e22',.92,.01),soft=mat(sport?'#303235':'#373c3b',.97),cloth=mat(apex?'#343038':'#484c49',.98),metal=mat(sport?'#707b80':'#697170',.43,.63),accent=mat(apex?'#9e422d':sport?'#806052':'#666a5e',.8,.08),headliner=mat('#5d615e',.98),mirror=mat('#788b91',.27,.80);
    const staticRoot=new T.Group();root.add(staticRoot);const box=(w,h,l,x,y,z,m=trim,r=.025)=>addSoftBox(staticRoot,w,h,l,x,y,z,m,r);
    // Enclosed floor, transmission tunnel, rear bulkhead and roof/headliner: no missing underside.
    box(W*.84,.07,Math.abs(frontBase-rearBase),0,floor,(frontBase+rearBase)*.5,trim);
    box(.21,.20,Math.max(.7,frontBase-seatZ+.35),0,.44,(frontBase+seatZ)*.5,soft);
    box(W*.81,.26,.09,0,.60,rearBase+.065,soft);
    if(!profile?.targa)box(wTop*2-.055,.025,Math.max(.18,frontTop-rearTop),0,height-.025,(frontTop+rearTop)*.5,headliner);
    // Molded dash with lower knee bolster and a projecting padded brow.
    box(W*.82,.17,dashFront-dashBack,0,topY-.10,(dashFront+dashBack)*.5,trim,.065);
    box(W*.80,.12,.14,0,topY-.25,dashBack+.08,soft,.035);
    box(W*.80,.045,.13,0,topY-.005,dashBack+.08,soft,.018);
    for(const side of[-1,1]){
      const sx=side*seatX;box(W*.30,.14,.48,sx,seatY,seatZ,cloth,.05);
      const back=box(W*.29,.45,.14,sx,seatY+.27,seatZ-.23,cloth,.06);back.rotation.x=-.13;
      box(.22,.15,.13,sx,seatY+.58,seatZ-.27,soft,.045);
      for(const seam of[-1,1])box(.006,.008,.35,sx+seam*W*.09,seatY+.073,seatZ,soft,.001);if(sport){for(const b of[-1,1]){box(.09,.19,.43,sx+b*W*.145,seatY+.04,seatZ,soft,.035);box(.07,.39,.16,sx+b*W*.13,seatY+.27,seatZ-.19,soft,.025);}}
      box(.07,.26,Math.abs(frontBase-rearBase)*.86,side*W*.427,belt-.19,(frontBase+rearBase)*.5,soft);
      box(.095,.06,.44,side*W*.388,belt-.20,seatZ+.18,trim);
      box(.027,.033,.13,side*W*.378,belt-.09,seatZ+.29,metal,.008);
      box(.035,.018,.11,side*W*.366,belt-.16,seatZ+.25,trim,.004);
      box(.025,.085,.30,side*W*.389,.45,seatZ+.03,trim);
      // Rear bench and parcel shelf remain visible when looking back.
      if(!apex&&!profile?.targa){box(W*.32,.12,.38,sx,seatY,rearBase+.40,cloth);box(W*.31,.35,.12,sx,seatY+.20,rearBase+.19,cloth);}
      // Visors and pillar inner faces fit the exterior windshield, no camera overlay.
      box(W*.25,.016,.11,side*W*.21,height-.025,frontTop-.055,headliner,.006);
      rod(staticRoot,[side*(shape.wBase-.025),belt,frontBase-.015],[side*(wTop-.026),height-.02,frontTop-.01],.025,headliner,6);
      rod(staticRoot,[side*(shape.wBase-.025),belt,rearBase+.015],[side*(wTop-.025),height-.02,rearTop+.01],.024,headliner,6);
    }
    if(!detail){batchFixedMeshes(staticRoot);return{root,driverEyeAnchor,seat:{x:seatX,y:seatY,z:seatZ},layout:'left-hand drive',trafficSimplified:true};}
    // Recessed vents with batched fins, passenger glovebox seam and stitched dash strip.
    for(const x of[-W*.35,-W*.10,W*.08,W*.36]){box(.15,.072,.038,x,topY-.08,dashBack-.008,trim,.012);for(let i=-2;i<=2;i++)box(.125,.005,.013,x,topY-.08+i*.011,dashBack-.032,metal,.001);}
    box(W*.28,.009,.009,-W*.24,topY-.23,dashBack+.001,trim,.001);
    box(W*.78,.012,.015,0,topY-.15,dashBack-.009,accent,.003);
    // Driver cluster above the steering column; passengers never inherit the driver instruments.
    const clusterZ=dashBack-.033,clusterY=topY+.015;
    box(.49,.18,.13,seatX,clusterY,clusterZ+.04,trim,.045);
    box(.53,.035,.18,seatX,clusterY+.10,clusterZ+.045,soft,.018);
    const gaugeTexture=units=>canvasTexture(512,192,(c,w,h)=>{c.fillStyle='#10191d';c.fillRect(0,0,w,h);c.textAlign='center';for(const [x,index]of[[127,0],[385,1]]){c.lineWidth=3;c.strokeStyle='#bac6c4';c.beginPath();c.arc(x,104,81,.76*Math.PI,2.24*Math.PI);c.stroke();for(let n=0;n<=8;n++){const a=(.76+n*1.48/8)*Math.PI;c.beginPath();c.moveTo(x+Math.cos(a)*70,104+Math.sin(a)*70);c.lineTo(x+Math.cos(a)*78,104+Math.sin(a)*78);c.stroke();c.font='16px sans-serif';c.fillStyle='#dbe3df';c.fillText(index?n:(units==='mph'?n*20:n*30),x+Math.cos(a)*55,110+Math.sin(a)*55);}c.font='12px sans-serif';c.fillText(index?'RPM ×1000':units==='mph'?'MPH':'KM/H',x,145);}c.fillStyle='#91b7af';c.font='bold 14px sans-serif';c.fillText(kind.toUpperCase(),256,180);});
    const dialTextures={mph:gaugeTexture('mph'),kmh:gaugeTexture('kmh')},dialMaterial=new T.MeshBasicMaterial({map:dialTextures.mph}),dial=new T.Mesh(new T.PlaneGeometry(.45,.169),dialMaterial);dial.position.set(seatX,clusterY,clusterZ-.029);dial.rotation.y=Math.PI;dial.userData.noBatch=true;root.add(dial);
    const needles=[];for(const px of[127,385]){const pivot=new T.Group();pivot.position.set(seatX-(px/512-.5)*.45,clusterY+(.5-104/192)*.169,clusterZ-.032);pivot.rotation.y=Math.PI;root.add(pivot);const needle=addBox(pivot,.003,.047,.002,0,.021,0,new T.MeshBasicMaterial({color:'#e9b07a'}),false);needles.push(pivot);}
    const steeringMount=new T.Group();steeringMount.name='steeringColumn';steeringMount.position.set(seatX,wheelY,wheelZ);steeringMount.rotation.x=-.26;root.add(steeringMount);
    const steeringWheel=new T.Group();steeringWheel.name='steeringWheel';steeringMount.add(steeringWheel);steeringWheel.userData.visualRatio=6;
    const wr=apex?.159:.17,rim=new T.Mesh(new T.TorusGeometry(wr,.018,modelSteps(8,4),modelSteps(32,10)),trim);steeringWheel.add(rim);for(const a of[0,Math.PI*.73,Math.PI*1.27]){const spoke=addBox(steeringWheel,.035,.12,.025,Math.sin(a)*.065,Math.cos(a)*.065,0,metal,false);spoke.rotation.z=-a;}
    addSoftBox(steeringWheel,.13,.095,.065,0,0,0,soft,.03);const emblem=addSoftBox(steeringWheel,.028,.023,.006,0,0,-.035,metal,.005);
    rod(staticRoot,[seatX,wheelY,wheelZ+.02],[seatX,topY-.12,dashBack+.16],.034,trim,10);
    for(const side of[-1,1])rod(staticRoot,[seatX+side*.035,wheelY,wheelZ+.05],[seatX+side*.19,wheelY+.01,wheelZ+.08],.012,trim,6);
    // A passenger-side stack, physical rotary controls, shifter, handbrake and cup wells.
    box(.27,.26,.10,0,topY-.18,dashBack+.001,soft,.026);
    const displayTex=canvasTexture(512,256,(c,w,h)=>{c.fillStyle='#15212d';c.fillRect(0,0,w,h);});
    const panel=new T.Mesh(new T.PlaneGeometry(.235,.117),new T.MeshBasicMaterial({map:displayTex}));panel.rotation.y=Math.PI;panel.position.set(0,topY-.13,dashBack-.053);root.add(panel);
    for(const x of[-.085,0,.085]){const control=new T.Mesh(new T.CylinderGeometry(.023,.023,.025,modelSteps(16,6)),metal);control.rotation.x=Math.PI/2;control.position.set(x,topY-.235,dashBack-.053);staticRoot.add(control);}
    box(.23,.12,.55,0,seatY-.005,seatZ+.28,soft,.035);rod(staticRoot,[0,seatY+.05,seatZ+.43],[0,seatY+.18,seatZ+.45],.018,metal,8);box(.06,.065,.07,0,seatY+.20,seatZ+.45,trim,.023);
    box(.20,.065,.23,0,seatY+.055,seatZ-.12,cloth,.035);box(.035,.035,.18,seatX*.30,seatY+.075,seatZ+.08,trim,.012);
    for(const z of[seatZ+.02,seatZ+.16]){const cup=new T.Mesh(new T.CylinderGeometry(.041,.035,.023,modelSteps(20,6)),trim);cup.position.set(-.045,seatY+.065,z);staticRoot.add(cup);const ring=new T.Mesh(new T.TorusGeometry(.039,.005,4,modelSteps(20,8)),metal);ring.rotation.x=Math.PI/2;ring.position.set(-.045,seatY+.079,z);staticRoot.add(ring);}
    // The rear display is a live view of the same world, including traffic.
    rod(staticRoot,[0,height-.04,frontTop-.08],[0,height-.19,frontTop-.15],.014,trim,6);box(.28,.093,.035,0,height-.19,frontTop-.17,trim,.018);const rearMirror=liveMirrorSurface(root,.25,.071,0,height-.19,frontTop-.191,'Interior rear-view mirror');
    const digitalTexture=canvasTexture(256,80,()=>{}),digitalMaterial=new T.MeshBasicMaterial({map:digitalTexture}),digital=new T.Mesh(new T.PlaneGeometry(.105,.033),digitalMaterial);digital.rotation.y=Math.PI;digital.position.set(seatX,clusterY-.043,clusterZ-.034);root.add(digital);
    batchFixedMeshes(staticRoot);batchFixedMeshes(steeringWheel);
    return{root,driverEyeAnchor,seat:{x:seatX,y:seatY,z:seatZ},wheelCenter:{x:seatX,y:wheelY,z:wheelZ},cluster:{x:seatX,y:clusterY,z:clusterZ},steeringWheel,needles,dialTextures,dialMaterial,digitalTexture,lastDigital:'',gpsTexture:displayTex,gpsPanel:panel,rearMirror,layout:'left-hand drive',mirrorMode:'live world camera'};
  }

  function createCar(kind,paintColor,detail=true,dimensions=null,level=5){return modelGeometry.withLevel(level,()=>{const root=buildCar(kind,paintColor,detail,dimensions);root.userData.modelDetailLevel=level;root.userData.sourceDimensions=dimensions;root.userData.sourceColor=paintColor;return root;});}
  function buildCar(kind,paintColor,detail=true,dimensions=null){
    paintColor=dimensions?.paint?.baseColor||paintColor;
    const root=new T.Group(),body=new T.Group(),lamps=[];root.add(body);
    const profile=VehicleModels?.profiles[kind],isVan=kind==='van',isTruck=kind==='truck',isSuv=kind==='suv',isCompact=kind==='compact'||kind==='p1',isApex=!!profile?.mid||kind==='apex',isSport=!!profile?.sport||kind==='vektor'||isApex;
    const length=dimensions?.length||(isTruck?7.1:isVan?5.25:isSuv?4.75:isCompact?4.05:isApex?4.55:4.62);
    const width=dimensions?.width||(isTruck?2.32:isVan?2.06:isSuv?1.98:isCompact?1.75:1.94);
    const height=dimensions?.height||(isTruck?2.85:isVan?2.12:isSuv?1.82:isCompact?1.48:isApex?1.2:1.37);
    const paint=detail?new T.MeshPhysicalMaterial({color:paintColor||'#b64632',roughness:.34,metalness:.38,clearcoat:.65,clearcoatRoughness:.24}):mat(paintColor||'#b64632',.34,.38),paintDark=mat(new T.Color(paintColor||'#b64632').multiplyScalar(.68),.45,.38);
    paint.userData.driveReflective='paint';paint.userData.driveBasePaint=true;paint.envMapIntensity=.42;
    const rubber=mat('#171a1a',.92),trim=mat('#22282b',.63,.12),glass=mat('#28404b',.17,.5),chrome=mat('#adb6b9',.27,.78),lamp=mat('#eee3c5',.26,.12),red=mat('#9d201e',.3,.2);
    glass.userData.driveReflective='glass';glass.envMapIntensity=.32;chrome.userData.driveReflective='metal';
    glass.transparent=true;glass.opacity=detail?.28:.22;glass.depthWrite=false;glass.metalness=.08;glass.side=T.DoubleSide;
    const wheelRadius=dimensions?.wheelRadius||(isTruck?.49:isVan||isSuv?.4:isApex?.36:isSport?.35:.34);
    const wheelbase=dimensions?.wheelbase||(isCompact?2.52:isApex?2.72:2.65),axlePositions=isTruck?[-length*.36,-length*.21,length*.32]:[-wheelbase*.5,wheelbase*.5];
    const bottom=profile?.mid?.245:profile?.targa?.27:.3, belt=profile?.belt??(isVan?1.15:isTruck?1.37:isSuv?1.10:isApex?.78:.96);
    const zList=[-.5,-.455,-.32,.12,.39,.49].map(v=>v*length),widthFactors=[.76,.98,1,1,.96,.78];
    const positions=[],indices=[];
    zList.forEach((z,i)=>{const w=width*.5*widthFactors[i],top=belt+([-.05,.025,.03,.02,-.07,-.15][i]);
      [[-.78*w,bottom],[-w,bottom+.13],[-w,top-.15],[-.9*w,top],[.9*w,top],[w,top-.15],[w,bottom+.13],[.78*w,bottom]].forEach(([x,y])=>positions.push(x,y,z));
    });
    for(let i=0;i<zList.length-1;i++)for(let k=0;k<8;k++){const a=i*8+k,b=i*8+(k+1)%8,c=b+8,d=a+8;indices.push(a,c,b,a,d,c);}
    for(let k=1;k<7;k++){indices.push(0,k,k+1);const b=(zList.length-1)*8;indices.push(b,b+k+1,b+k);}
    const cabinRange=profile?[length*profile.cabin[2],length*profile.cabin[0]]:[isTruck?length*.03:isVan?-length*.43:isSuv?-length*.42:isCompact?-length*.40:isApex?-length*.25:-length*.34,isTruck?length*.39:isVan?length*.28:isSuv?length*.22:isApex?length*.255:length*.19];
    const shell=new T.Mesh((profile?VehicleModels.sectionBody:sculptedBody)(length,width,belt,bottom,wheelRadius,axlePositions,kind,cabinRange,detail),paint);shell.userData.keepSeparate=true;shell.castShadow=shell.receiveShadow=true;body.add(shell);if(profile){VehicleModels.paintable(shell,'shell');for(const cap of shell.geometry._driveCaps||[]){const m=new T.Mesh(cap.geometry,paint);m.castShadow=m.receiveShadow=true;VehicleModels.paintable(m,cap.surface);body.add(m);}delete shell.geometry._driveCaps;}
    // Separate cabin, inclined windshield, rear glass, painted roof and pillars.
    const cabin=new T.Group();body.add(cabin);
    const frontBase=profile?length*profile.cabin[0]:isTruck?length*.39:isVan?length*.28:isSuv?length*.22:isApex?length*.255:length*.19;
    const rearBase=profile?length*profile.cabin[2]:isTruck?length*.03:isVan?-length*.43:isSuv?-length*.42:isCompact?-length*.40:isApex?-length*.25:-length*.34;
    const frontTop=profile?length*profile.cabin[1]:isTruck?length*.34:isVan?length*.2:isSuv?length*.10:isCompact?length*.06:isApex?length*.075:-length*.02;
    const rearTop=profile?length*profile.cabin[3]:isTruck?length*.045:isVan?-length*.42:isSuv?-length*.34:isCompact?-length*.30:isApex?-length*.10:-length*.22;
    const wBase=width*.45,wTop=width*(profile?.cabin[4]??(isTruck||isVan?.435:isSuv?.395:.355)),roof=height;
    const corners={fl:[-wBase,belt,frontBase],fr:[wBase,belt,frontBase],tl:[-wTop,roof,frontTop],tr:[wTop,roof,frontTop],bl:[-wBase,belt,rearBase],br:[wBase,belt,rearBase],ul:[-wTop,roof,rearTop],ur:[wTop,roof,rearTop]};
    cabin.add(quad(corners.fl,corners.fr,corners.tr,corners.tl,glass));
    cabin.add(quad(corners.br,corners.bl,corners.ul,corners.ur,glass));
    cabin.add(quad(corners.bl,corners.fl,corners.tl,corners.ul,glass));
    cabin.add(quad(corners.fr,corners.br,corners.ur,corners.tr,glass));
    const roofMesh=curvedPanel(corners.tl,corners.tr,corners.ur,corners.ul,paint,isApex?.035:.055);roofMesh.castShadow=true;if(!profile?.targa)cabin.add(roofMesh);if(profile)VehicleModels.paintable(roofMesh,'roof');
    [['fl','tl'],['fr','tr'],['bl','ul'],['br','ur'],['tl','ul'],['tr','ur']].forEach(([a,b])=>{if(!profile)return rod(cabin,corners[a],corners[b],isSport?.045:.055,paint);const av=new T.Vector3(...corners[a]),bv=new T.Vector3(...corners[b]),delta=bv.clone().sub(av),m=new T.Mesh(roundedBoxGeometry(.055,delta.length()+.025,isSport?.073:.085,.012),paint);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());m.castShadow=true;cabin.add(m);});
    if(!isSport){for(const side of[-1,1])rod(cabin,[side*wBase,belt,-length*.08],[side*wTop,roof,-length*.075],.036,trim);}
    for(const side of[-1,1]){
      // Flush mirrors, door seams, handles and lower sill.
      const mirror=new T.Group();mirror.userData.breakawayPart=side>0?'right-mirror':'left-mirror';body.add(mirror);
      rod(mirror,[side*wBase,belt+.07,frontBase-.1],[side*(width*.56),belt+.12,frontBase-.16],.028,trim);
      addSoftBox(mirror,.17,.105,.25,side*width*.552,belt+.135,frontBase-.16,paint,.035);const mirrorFace=liveMirrorSurface(mirror,.145,.078,side*width*.552,belt+.135,frontBase-.298,side>0?'Left side rear-view mirror':'Right side rear-view mirror');mirrorFace.userData.mirrorSide=side;
      addBox(body,.018,.04,.16,side*(width*.502),belt-.115,-length*.105,chrome,false);
      addBox(body,.04,.085,length*.67,side*width*.48,.31,-length*.04,trim).userData.breakawayPart=side>0?'right-sill':'left-sill';
      const seam=new T.BufferGeometry().setFromPoints([new T.Vector3(side*width*.503,.42,frontBase-.07),new T.Vector3(side*width*.503,belt-.035,frontBase-.07),new T.Vector3(side*width*.48,belt-.035,rearBase+.09),new T.Vector3(side*width*.503,.43,rearBase+.09)]);
      body.add(new T.Line(seam,new T.LineBasicMaterial({color:'#263032',transparent:true,opacity:.48})));
    }
    const frontBumper=addSoftBox(body,width*.81,.14,.085,0,.42,length*.495,trim,.025),rearBumper=addSoftBox(body,width*.71,.10,.07,0,.47,-length*.502,trim,.022);
    if(detail)for(const bumper of[frontBumper,rearBumper]){const original=bumper.geometry;bumper.geometry=subdivideSurface(original,modelGeometry.level<3?1:2);original.dispose();}
    else for(const bumper of[frontBumper,rearBumper])bumper.userData.damagePanel=true;
    if(!profile){addBox(body,width*.36,.12,.045,0,.64,length*.495,trim);
    for(let i=-2;i<=2;i++)addBox(body,width*.35,.008,.052,0,.59+i*.022,length*.499,chrome,false);
    for(const side of[-1,1]){
      const headlights=addSoftBox(body,width*(isApex?.225:.205),isApex?.048:.10,.072,side*width*.25,belt-.155,length*.485,lamp.clone(),.025);headlights.rotation.y=side*.16;
      const rearLight=addSoftBox(body,width*.22,isApex?.045:.085,.065,side*width*.25,belt-.15,-length*.503,red.clone(),.022);
      const reverseLight=addSoftBox(body,.075,.047,.065,side*width*.13,belt-.15,-length*.503,lamp.clone(),.012);
      lamps.push({mesh:headlights,front:true,side,original:lamp.color.clone()},{mesh:rearLight,front:false,side,original:red.color.clone()},{mesh:reverseLight,front:false,reverse:true,side,original:lamp.color.clone()});
      if(detail)addBox(body,.08,.04,.065,side*width*.413,.62,length*.472,mat('#d29c40'),false);
    }}
    const plateTexture=canvasTexture(256,64,(c,w,h)=>{c.fillStyle='#d8d6c4';c.fillRect(0,0,w,h);c.fillStyle='#293132';c.font='bold 33px monospace';c.textAlign='center';c.fillText('PLATDO',w/2,46);});
    const plate=new T.Mesh(new T.PlaneGeometry(.48,.135),new T.MeshStandardMaterial({map:plateTexture,roughness:.8,envMapIntensity:.075}));plate.position.set(0,.59,-length*.505);plate.rotation.y=Math.PI;body.add(plate);plate.userData.licensePlate=true;
    frontBumper.userData.breakawayPart='front-bumper';rearBumper.userData.breakawayPart='rear-bumper';
    // Longitudinal bonnet creases make the front read as sculpted bodywork.
    if(!profile)for(const side of[-1,1]){const p1=new T.Vector3(side*width*.28,belt+.018,frontBase+.05),p2=new T.Vector3(side*width*.22,belt-.066,length*.365);body.add(new T.Line(new T.BufferGeometry().setFromPoints([p1,p2]),new T.LineBasicMaterial({color:new T.Color(paintColor||'#b64632').multiplyScalar(1.3)})));}
    if(isApex&&!profile){
      for(const side of[-1,1]){addBox(body,.06,.18,.12,side*.56,1.0,-length*.385,trim);addBox(body,.27,.028,.33,side*.59,.84,length*.20,trim);}
      addBox(body,width*.88,.045,.27,0,1.1,-length*.395,paintDark);
    }
    if(isVan){addBox(body,width*.91,height-belt,.08,0,(height+belt)*.5,-length*.41,paint).userData.damagePanel=true;for(const side of[-1,1])addBox(body,.025,.52,1.1,side*width*.453,1.54,-.9,paint).userData.damagePanel=true;}
    if(isTruck){
      addBox(body,width*.99,2.35,length*.63,0,1.75,-length*.17,mat('#c6c3b7',.83)).userData.damagePanel=true;
      const stripe=mat('#656f6e');for(const side of[-1,1]){addBox(body,.018,.14,length*.61,side*width*.5,1.13,-length*.17,stripe,false);for(let j=0;j<6;j++)addBox(body,.018,1.7,.018,side*width*.5,1.9,-length*.45+j*.55,chrome,false);}
    }
    if(detail&&!profile){
      const darkParts=[],metalParts=[],lensParts=[];
      // Recessed lamp lenses, physical lamp dividers and a inset rear plate surround.
      for(const side of[-1,1]){
        for(let k=-2;k<=2;k++)lensParts.push(detailBox(.008,isApex?.038:.079,.012,side*width*.25+k*width*.028,belt-.155,length*.485+.040));
        for(let k=-1;k<=1;k++)darkParts.push(detailBox(.011,isApex?.04:.077,.01,side*width*.25+k*width*.06,belt-.15,-length*.503-.037));
        // Twin barrel exhausts have a dark recessed bore, not a painted rectangle.
        const exhaust=new T.CylinderGeometry(.047,.047,.17,16);exhaust.rotateX(Math.PI/2);exhaust.translate(side*width*.32,.34,-length*.515);metalParts.push(exhaust);
        const bore=new T.CircleGeometry(.033,16);bore.rotateY(Math.PI);bore.translate(side*width*.32,.34,-length*.515-.086);darkParts.push(bore);
        // Narrow roof weather seals and wiper blades catch silhouettes in garage views.
        darkParts.push(detailBox(.021,.018,(frontTop-rearTop)*.99,side*wTop,roof+.006,(frontTop+rearTop)*.5));
        const a=new T.Vector3(...corners.fl).lerp(new T.Vector3(...corners.tl),.07),b=new T.Vector3(...corners.fr).lerp(new T.Vector3(...corners.tr),.07);
        const wiper=detailBox(width*.22,.016,.026,side*width*.205,mix(a.y,b.y,.5)+.014,mix(a.z,b.z,.5)+.02,0,side*.16);darkParts.push(wiper);
      }
      for(const side of[-1,1]){darkParts.push(detailBox(.39,.016,.015,0,.59+side*.057,-length*.505-.006));darkParts.push(detailBox(.017,.1,.015,side*.18,.59,-length*.505-.006));}
      detailBatch(body,darkParts,trim,4);detailBatch(body,metalParts,chrome,4);detailBatch(body,lensParts,mat('#b4b7a9',.33,.13),5);
    }
    const wheels=[];
    for(const z of axlePositions)for(const side of[-1,1]){
      const pivot=new T.Group();pivot.userData.wheelRadius=wheelRadius;pivot.userData.breakawayPart=(z>0?'front':'rear')+'-'+(side>0?'right':'left')+'-wheel';pivot.userData.wheelPart=true;pivot.position.set(side*(width*(profile?.435:.485)),wheelRadius,z);root.add(pivot);
      const spin=new T.Group();pivot.add(spin);
      const tire=new T.Mesh(new T.TorusGeometry(wheelRadius*.77,wheelRadius*.23,modelSteps(detail?10:6,4),modelSteps(detail?40:24,10)),rubber);tire.rotation.y=Math.PI/2;tire.scale.z=.235/(wheelRadius*.46);tire.castShadow=true;spin.add(tire);
      const rim=new T.Mesh(new T.CylinderGeometry(wheelRadius*.65,wheelRadius*.65,.205,modelSteps(detail?24:16,8)),trim);rim.rotation.z=Math.PI/2;if(detail)rim.userData.qualityMaxTier=3;rim.userData.wheelRim=true;spin.add(rim);
      const faceX=side*.13;
      const spokeParts=[],spokeCount=isCompact?6:isApex?10:isTruck?8:5;for(let j=0;j<spokeCount;j++){const a=j*Math.PI*2/spokeCount;spokeParts.push(detailBox(.020,wheelRadius*.48,isCompact?.039:.027,faceX,Math.cos(a)*wheelRadius*.35,Math.sin(a)*wheelRadius*.35,a));}detailBatch(spin,spokeParts,chrome,0);
      const caliper=addSoftBox(pivot,.055,.12,.07,side*.102,.03,-wheelRadius*.44,isApex?mat('#a83b27',.58,.3):trim,.012);caliper.userData.qualityTier=2;const hub=new T.Mesh(new T.CylinderGeometry(wheelRadius*.15,wheelRadius*.15,.27,8),chrome);hub.rotation.z=Math.PI/2;spin.add(hub);
      if(detail){
        const detailGroup=new T.Group();detailGroup.userData.qualityTier=4;spin.add(detailGroup);
        const rotor=new T.CylinderGeometry(wheelRadius*.53,wheelRadius*.53,.015,modelSteps(32,8));rotor.rotateZ(Math.PI/2);rotor.translate(side*.112,0,0);detailBatch(detailGroup,[rotor],mat('#626866',.56,.66),4);
        const alloy=new T.TorusGeometry(wheelRadius*.61,.022,modelSteps(6,4),modelSteps(40,10));alloy.rotateY(Math.PI/2);alloy.translate(side*.126,0,0);detailBatch(detailGroup,[alloy],chrome,4);
        const rings=[];for(const radius of[wheelRadius*.70,wheelRadius*.90]){const ring=new T.TorusGeometry(radius,.005,4,modelSteps(40,10));ring.rotateY(Math.PI/2);ring.translate(side*.12,0,0);rings.push(ring);}detailBatch(detailGroup,rings,mat('#333737',.92),4);
        const lugs=[];for(let j=0;j<5;j++){const a=j*Math.PI*2/5,bolt=new T.CylinderGeometry(.012,.012,.018,6);bolt.rotateZ(Math.PI/2);bolt.translate(side*.151,Math.sin(a)*wheelRadius*.24,Math.cos(a)*wheelRadius*.24);lugs.push(bolt);}detailBatch(detailGroup,lugs,chrome,5);
        // Tread notches are merged into one mesh per wheel and remain below the rubber silhouette.
        const tread=[];for(let j=0;j<28;j++){const a=j*Math.PI*2/28;tread.push(detailBox(.15,.007,.035,0,Math.cos(a)*(wheelRadius+.001),Math.sin(a)*(wheelRadius+.001),a));}detailBatch(detailGroup,tread,mat('#101312',.98),6);
      }
      wheels.push({pivot,spin,front:z>0,side,basePosition:pivot.position.clone(),damageIndex:z>0?(side>0?1:0):(side>0?3:2)});
      const ap=[],ai=[],r=wheelRadius+.055,outer=r+.065;
      for(let j=0;j<=18;j++){const angle=Math.PI*j/18;for(const rad of[r,outer])ap.push(side*width*.506,wheelRadius+Math.sin(angle)*rad,z+Math.cos(angle)*rad);if(j<18){const a=j*2;ai.push(a,a+1,a+3,a,a+3,a+2);}}
      const arch=vertexMesh(ap,ai,new T.MeshStandardMaterial({color:'#212628',roughness:.8,envMapIntensity:.075,side:T.DoubleSide}));body.add(arch);
    }
    // Soft contact shadow remains available with the low preset.
    const contactTexture=canvasTexture(64,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,3,w/2,h/2,h*.53);g.addColorStop(0,'rgba(0,0,0,.46)');g.addColorStop(.55,'rgba(0,0,0,.28)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
    const contact=new T.Mesh(new T.PlaneGeometry(width*1.5,length*1.14),new T.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));contact.rotation.x=-Math.PI/2;contact.position.y=.024;root.add(contact);
    root.userData={body,cabin,wheels,lamps,plate,frontBumper,rearBumper,length,width,height,belt,kind,paint,contact,basePaintColor:paintColor,simulationWheelRadius:dimensions?.wheelRadius||.34,damageSetup:{shell,corners,lamps,shape:{length,width,height,belt},detail}};const helpers={batchFixedMeshes};if(!profile)upgradeExterior(root,{frontBase,rearBase,frontTop,rearTop,wBase,wTop,roof,trim,chrome,paintDark,detail});if(profile){VehicleModels.signature(root,{trim,chrome,paintDark});VehicleModels.wheelSet(root,dimensions?.parts?.wheels||{visual:{design:profile.mid?9:profile.sport?0:5}},helpers);VehicleModels.spoiler(root,dimensions?.parts?.spoilers,helpers);}batchFixedMeshes(body);if(detail)prepareCarDamage(root,shell,corners,lamps,{length,width,height,belt});const interior=createVehicleInterior(root,{frontBase,rearBase,frontTop,rearTop,wBase,wTop,roof,detail});root.userData.interior=interior;body.add(interior.root);installOccupants(root,interior,interior.seat.x,interior.seat.y,interior.seat.z,rearBase,!isApex&&!profile?.targa);if(profile)VehicleModels.fitPaint(root,dimensions?.paint||{baseColor:paintColor,strokes:[]});return root;
  }

  class DriveScene {
    constructor(canvas,route,options={}){
      if(!T)throw new Error('The local 3D engine is unavailable.');
      this.canvas=canvas;this.route=route;this.time=0;this.settings={quality:'high',scale:1,fov:72,reducedMotion:false,units:'mph',chaseDistance:6.2,chaseHeight:3.05,cameraShake:.35,speedFov:true};this.cameraMode='';this.lastView='';this.trafficMeshes=new Map();this.vector=new T.Vector3();this.target=new T.Vector3();this.dummy=new T.Object3D();this.cameraClipStats={limited:false};
      this.ownsRenderer=!options.renderer;this.renderer=options.renderer||new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
      this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
      this.scene=new T.Scene();this.scene.background=new T.Color('#bacdd4');this.scene.fog=new T.Fog('#c5d1d0',130,670);
      this.camera=new T.PerspectiveCamera(72,1,.07,2300);this.scene.add(this.camera);
      this.scene.add(new T.HemisphereLight('#c3dce7','#655f40',1.7));
      this.sun=new T.DirectionalLight('#ffe9ce',2.65);this.sun.position.set(-130,190,80);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-34;this.sun.shadow.camera.right=34;this.sun.shadow.camera.top=34;this.sun.shadow.camera.bottom=-34;this.sun.shadow.camera.near=10;this.sun.shadow.camera.far=430;this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.035;this.scene.add(this.sun,this.sun.target);
      this.materials={grass:mat('#647d50'),rail:mat('#a9afa5',.4,.58),post:mat('#797d73',.65,.3),road:mat('#62676a'),mark:mat('#d4d0b9'),shoulder:mat('#a59e85'),bark:mat('#71634c'),leaf:mat('#405a39'),rock:mat('#8e9081'),building:mat('#d1c6b0'),roof:mat('#736759')};
      this.buildSky();this.buildTerrain();this.buildRoad();this.buildLandscape();this.buildTunnel();this.buildCheckpoint();this.buildCockpit();this.buildEngineSmoke();this.buildCollisionEffects();this.buildTireEffects();this.setCar({id:'compact'},'#b9543d');this.resize(canvas.clientWidth||1280,canvas.clientHeight||720);
    }
    buildSky(){
      const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#5488b9')},horizon:{value:new T.Color('#dedacc')}},vertexShader:'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vPosition;uniform vec3 top;uniform vec3 horizon;void main(){float h=clamp(normalize(vPosition).y,0.,1.);gl_FragColor=vec4(mix(horizon,top,pow(h,.48)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
      this.sky=new T.Mesh(new T.SphereGeometry(2100,24,16),skyMat);this.sky.renderOrder=-100;this.scene.add(this.sky);
      const sunDisk=new T.Mesh(new T.SphereGeometry(14,16,12),new T.MeshBasicMaterial({color:'#fff0c5',fog:false}));sunDisk.position.set(-1200,950,900);this.sky.add(sunDisk);
      const cloudtex=canvasTexture(256,128,(c,w,h)=>{for(let j=0;j<11;j++){const x=25+j*20,y=65+Math.sin(j*2)*9,r=24+random()*13,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.2)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}});
      const cloudmat=new T.SpriteMaterial({map:cloudtex,color:'#fff6e5',transparent:true,opacity:.42,depthWrite:false,fog:false});
      for(let i=0;i<10;i++){const c=new T.Sprite(cloudmat);c.position.set(Math.cos(i*2.399)*1500,250+random()*230,Math.sin(i*2.399)*1500);c.scale.set(500+random()*400,120+random()*100,1);this.sky.add(c);}
    }
    roadPoint(s,offset=0,raise=0){const p=this.route.at(s);return new T.Vector3(p.x+p.nx*offset,p.y+raise,p.z+p.nz*offset);}
    nearest(x,z){let best=Infinity,out=null,connector=false;const paths=[this.route,...(this.route.connectors||[])];for(const path of paths){if(path!==this.route&&path.bounds&&(x<path.bounds.minX-35||x>path.bounds.maxX+35||z<path.bounds.minZ-35||z>path.bounds.maxZ+35))continue;const samples=path.samples;for(let i=0;i<samples.length;i+=4){const p=samples[i],d=(p.x-x)**2+(p.z-z)**2;if(d<best){best=d;out=p;connector=path!==this.route;}}}return {p:out,d:Math.sqrt(best),offset:(x-out.x)*out.nx+(z-out.z)*out.nz,connector};}
    groundHeight(x,z){return this.route.groundHeight(x,z);}
    buildTerrain(){
      const {extent,steps,heights}=this.route.terrainGrid(),positions=[],colors=[],indices=[],terrainUV=[];const color=new T.Color();
      for(let iz=0;iz<=steps;iz++)for(let ix=0;ix<=steps;ix++){const x=-extent+ix*extent*2/steps,z=-extent+iz*extent*2/steps,y=heights[iz*(steps+1)+ix];positions.push(x,y,z);terrainUV.push(x/36,z/36);const shade=(Math.sin(x*.05)*Math.sin(z*.043)+1)*.04;
        color.set(y<-.4?'#b2ab8c':y>29?'#687a53':'#708557');color.offsetHSL(0,0,shade-.04);colors.push(color.r,color.g,color.b);if(ix<steps&&iz<steps){const a=iz*(steps+1)+ix;indices.push(a,a+steps+1,a+1,a+1,a+steps+1,a+steps+2);}}
      const grassTexture=canvasTexture(256,256,(c,w,h)=>{c.fillStyle='#c9c9ba';c.fillRect(0,0,w,h);for(let i=0;i<9500;i++){const v=90+random()*130;c.fillStyle=`rgba(${v},${v},${v*.87},.18)`;c.fillRect(random()*w,random()*h,1+random()*3,1+random()*6);}});grassTexture.wrapS=grassTexture.wrapT=T.RepeatWrapping;grassTexture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());this.materials.grass.map=grassTexture;
      this.terrain=vertexMesh(positions,indices,new T.MeshStandardMaterial({vertexColors:true,roughness:1,map:grassTexture}),colors,terrainUV);this.scene.add(this.terrain);
      const watertex=canvasTexture(256,256,(c,w,h)=>{c.fillStyle='#97aeb0';c.fillRect(0,0,w,h);for(let i=0;i<900;i++){const a=random()*.15;c.strokeStyle=`rgba(240,238,207,${a})`;c.lineWidth=1;c.beginPath();const x=random()*w,y=random()*h;c.moveTo(x,y);c.lineTo(x+random()*18,y+random()*2);c.stroke();}});watertex.wrapS=watertex.wrapT=T.RepeatWrapping;watertex.repeat.set(220,220);
      this.water=new T.Mesh(new T.PlaneGeometry(10000,10000),new T.MeshStandardMaterial({color:'#89b4be',map:watertex,roughness:.48,metalness:.02}));this.water.rotation.x=-Math.PI/2;this.water.position.y=-3.8;this.scene.add(this.water);
    }
    ribbon(a,b,height,material,start=0,end=this.route.length,step=3){
      const positions=[],indices=[],uv=[],count=Math.ceil((end-start)/step);
      for(let i=0;i<=count;i++){const s=mix(start,end,i/count),p=this.route.at(s);for(const offset of[a,b]){positions.push(p.x+p.nx*offset,p.y+height,p.z+p.nz*offset);uv.push((offset-a)/4,s/6);}if(i<count){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}}
      const mesh=vertexMesh(positions,indices,material,null,uv);this.scene.add(mesh);return mesh;
    }
    buildRoad(){
      const asphalt=canvasTexture(256,256,(c,w,h)=>{c.fillStyle='#777873';c.fillRect(0,0,w,h);for(let i=0;i<13000;i++){const v=90+Math.floor(random()*90);c.fillStyle=`rgba(${v},${v},${v},.22)`;c.fillRect(random()*w,random()*h,1+random()*1.3,1+random()*1.3);}});asphalt.wrapS=asphalt.wrapT=T.RepeatWrapping;asphalt.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
      this.materials.road.map=asphalt;
      this.ribbon(-10.6,10.6,-.017,this.materials.shoulder);this.ribbon(-8.2,8.2,0,this.materials.road);
      for(const side of[-1,1]){this.ribbon(side*7.9-.065,side*7.9+.065,.013,this.materials.mark);this.ribbon(side*.115-.035,side*.115+.035,.015,mat('#c7b78a'));}
      const dashPositions=[],dashIndices=[];
      for(let s=0;s<this.route.length;s+=10)for(const offset of[-4,4]){const base=dashPositions.length/3;for(const [at,off] of[[s,offset-.065],[s+4,offset-.065],[s+4,offset+.065],[s,offset+.065]]){const p=this.roadPoint(at,off,.016);dashPositions.push(p.x,p.y,p.z);}dashIndices.push(base,base+1,base+2,base,base+2,base+3);}
      this.scene.add(vertexMesh(dashPositions,dashIndices,this.materials.mark));
      // Continuous rail ribbons with posts: exact same centreline as collision boundaries.
      const railPositions=[],railIndices=[],posts=[];
      for(const side of[-1,1])for(let s=0;s<this.route.length;s+=4){if(s>this.route.length*.72&&s<this.route.length*.77)continue;const a=this.roadPoint(s,side*13),b=this.roadPoint(Math.min(s+4,this.route.length),side*13),i=railPositions.length/3;
        railPositions.push(a.x,a.y+.57,a.z,b.x,b.y+.57,b.z,b.x,b.y+.84,b.z,a.x,a.y+.84,a.z);railIndices.push(i,i+1,i+2,i,i+2,i+3);if(s%8===0)posts.push({x:a.x,y:a.y+.38,z:a.z,ry:this.route.at(s).yaw});}
      this.materials.rail.side=T.DoubleSide;this.scene.add(vertexMesh(railPositions,railIndices,this.materials.rail));
      this.instances(new T.BoxGeometry(.1,.8,.13),this.materials.post,posts);
      for(let s=70;s<this.route.length;s+=115){const p=this.route.at(s),side=-1;this.addRoadSign(s,side,s/this.route.length<.35?'MORROW COAST':s/this.route.length<.7?'CEDAR RIDGE':'EASTPORT',Math.ceil(s/100)*100);}
      // Small edge reflectors create readable distance cues without glowing.
      const reflectors=[];for(let s=0;s<this.route.length;s+=24)for(const side of[-1,1]){const p=this.roadPoint(s,side*12.9,.87);reflectors.push({x:p.x,y:p.y,z:p.z,ry:this.route.at(s).yaw});}this.instances(new T.BoxGeometry(.13,.07,.08),mat('#e1d9b6'),reflectors,false);
    }
    instances(geometry,material,items,cast=true){const mesh=new T.InstancedMesh(geometry,material,items.length);const d=this.dummy;
      items.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(p.rx||0,p.ry||0,p.rz||0);d.scale.set(p.sx||1,p.sy||1,p.sz||1);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});mesh.castShadow=cast;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.scene.add(mesh);return mesh;}
    buildSurfaceDetail(){
      if(this.surfaceDetail)return;
      // These are surface decorations only. The route and its collision bounds stay unchanged.
      const roadHalf=this.route.halfWidth,roadEdge=this.route.barrierOffset;const groups={4:new T.Group(),5:new T.Group(),6:new T.Group()};for(const [tier,group]of Object.entries(groups)){group.userData.qualityTier=Number(tier);this.scene.add(group);}
      let localSeed=14721;const rng=()=>{localSeed=(Math.imul(localSeed,1664525)+1013904223)>>>0;return localSeed/4294967296;};
      const patches=[],patchIndices=[],cracks=[],crackIndices=[],drainFrames=[],drainSlots=[],studs=[],bolts=[];
      const surfaceQuad=(positions,indices,s,offset,width,length,height)=>{const base=positions.length/3;for(const [at,off]of[[s,offset-width*.5],[s+length,offset-width*.5],[s+length,offset+width*.5],[s,offset+width*.5]]){const p=this.roadPoint(at,off,height);positions.push(p.x,p.y,p.z);}indices.push(base,base+1,base+2,base,base+2,base+3);};
      for(let s=21;s<this.route.length-14;s+=47){
        // Narrow asphalt repairs, with irregular sealed joints rather than repeated black rectangles.
        const offset=(rng()<.5?-1:1)*(1.1+rng()*(roadHalf-2.1)),length=1.1+rng()*3.4,width=.55+rng()*.9;
        surfaceQuad(patches,patchIndices,s,offset,width,length,.009);
        for(let j=0;j<3;j++)surfaceQuad(cracks,crackIndices,s+j*length/3,offset-width*.5+(rng()-.5)*.08,.018,length/3+.02,.012);
        if(s%141<48){const side=rng()<.5?-1:1,p=this.roadPoint(s,side*(roadHalf+1.2),.002),yaw=this.route.at(s).yaw;drainFrames.push({x:p.x,y:p.y,z:p.z,ry:yaw});for(let j=0;j<7;j++){const q=this.roadPoint(s-.31+j*.10,side*(roadHalf+1.2),.01);drainSlots.push({x:q.x,y:q.y,z:q.z,ry:yaw});}}
      }
      const repair=mat('#454a4b',.96),joint=mat('#343937',.96);repair.map=this.materials.road.map;
      // Road ribbons use opposite UV axes; retain a close-grained albedo without stretching large repairs.
      const patchUV=[];for(let i=0;i<patches.length;i+=3)patchUV.push(patches[i]/4,patches[i+2]/4);const patchMesh=vertexMesh(patches,patchIndices,repair,null,patchUV);patchMesh.castShadow=false;groups[4].add(patchMesh);
      const crackMesh=vertexMesh(cracks,crackIndices,joint);crackMesh.castShadow=false;groups[5].add(crackMesh);
      groups[4].add(this.instances(new T.BoxGeometry(.44,.025,.82),mat('#656a65',.8,.15),drainFrames,false));
      groups[4].add(this.instances(new T.BoxGeometry(.34,.007,.035),mat('#252e2a',1),drainSlots,false));
      // Raised pavement reflectors are solid housings with restrained reflective inserts, not bloom emitters.
      for(let s=9;s<this.route.length;s+=12){const p=this.roadPoint(s,0,.034);studs.push({x:p.x,y:p.y,z:p.z,ry:this.route.at(s).yaw});}
      groups[5].add(this.instances(new T.BoxGeometry(.10,.045,.15),mat('#837b64',.52,.18),studs,false));
      const studFaces=studs.map(p=>({...p,y:p.y+.024,sz:.44}));groups[5].add(this.instances(new T.BoxGeometry(.068,.006,.09),mat('#d3b36f',.29,.3),studFaces,false));
      // Shoulder gravel uses clustered, centimetre-sized pebbles: visible relief at the edge of the tarmac.
      const gravel=[];for(let i=0;i<5200;i++){const s=rng()*this.route.length,side=rng()<.5?-1:1,offset=side*(roadHalf+.45+rng()*2),p=this.roadPoint(s,offset,.006),size=.025+rng()*.065;gravel.push({x:p.x,y:p.y,z:p.z,ry:rng()*Math.PI,sx:size,sy:size*.23,sz:size*(.6+rng())});}
      const gravelMaterial=mat('#827f71',.99);groups[5].add(this.instances(new T.IcosahedronGeometry(1,0),gravelMaterial,gravel.slice(0,1800),false));groups[6].add(this.instances(new T.IcosahedronGeometry(1,0),gravelMaterial,gravel.slice(1800),false));
      for(let s=0;s<this.route.length;s+=8){const tunnel=this.route.map?.tunnel||{start:.72,end:.77};if(this.route.isJunction?.(s)||(s>this.route.length*tunnel.start&&s<this.route.length*tunnel.end))continue;for(const side of[-1,1]){const p=this.roadPoint(s,side*(roadEdge-.01),.7);bolts.push({x:p.x,y:p.y,z:p.z,ry:this.route.at(s).yaw});}}
      groups[6].add(this.instances(new T.BoxGeometry(.026,.026,.028),mat('#7a827e',.49,.5),bolts,false));
      this.surfaceDetail={groups,counts:{repairs:patchIndices.length/6,drains:drainFrames.length,reflectors:studs.length,gravel:gravel.length,railBolts:bolts.length}};
    }
    setVisualQuality(key){
      const rank=qualityRanks[key]??3;if(rank>=4)this.buildSurfaceDetail();
      if(this.surfaceDetail)for(const [tier,group]of Object.entries(this.surfaceDetail.groups))group.visible=rank>=Number(tier);
      if(this.playerCar)modelQuality(this.playerCar,rank);for(const car of this.trafficMeshes.values()){modelQuality(car,rank);car.userData.lastLOD=-1;}
      this.scene.traverse(o=>{if(o.userData.buildingDetail)o.visible=rank>=4;});
      this.visualDetailStats={tier:key,carDetail:rank>=4,lampLensDetail:rank>=5,tireTreadDetail:rank>=6,roadRepairs:rank>=4?this.surfaceDetail?.counts.repairs||0:0,roadReflectors:rank>=5?this.surfaceDetail?.counts.reflectors||0:0,shoulderPebbles:rank>=6?5200:rank>=5?1800:0};
    }
    addRoadSign(s,side,text,distance){const p=this.route.at(s),group=new T.Group();group.position.copy(this.roadPoint(s,side*10.65));group.rotation.y=p.yaw;const tex=canvasTexture(512,200,(c,w,h)=>{c.fillStyle='#315456';c.fillRect(0,0,w,h);c.strokeStyle='#d9decc';c.lineWidth=8;c.strokeRect(10,10,w-20,h-20);c.textAlign='center';c.fillStyle='#f0ecd9';c.font='bold 34px Arial';c.fillText(text,w/2,79);c.font='26px Arial';c.fillText(distance?`${distance} m    ↗`:'COAST ROAD',w/2,143);});
      addBox(group,2.6,1,.10,0,2.25,0,this.materials.rail);const face=new T.Mesh(new T.PlaneGeometry(2.54,.96),new T.MeshStandardMaterial({map:tex,roughness:.8}));face.rotation.y=Math.PI;face.position.set(0,2.25,-.056);group.add(face);for(const x of[-.85,.85])addBox(group,.07,2.2,.08,x,1.1,0,this.materials.post);this.scene.add(group);
    }
    buildLandscape(){
      const trunks=[],crowns=[],upper=[],rocks=[];
      for(let s=4;s<this.route.length;s+=10){const f=s/this.route.length,wood=f>.32&&f<.73;for(let side of[-1,1]){const count=wood?4:side>0?2:1;for(let j=0;j<count;j++){if(!wood&&side<0&&random()>.18)continue;const offset=side*(21+j*15+random()*9),p=this.roadPoint(s+random()*8,offset),h=wood?5+random()*6:4+random()*3,y=this.groundHeight(p.x,p.z);if(y<-1)continue;trunks.push({x:p.x,y:y+h*.34,z:p.z,sx:.17+random()*.12,sy:h*.67,sz:.17+random()*.12});crowns.push({x:p.x,y:y+h*.66,z:p.z,sx:h*.28,sy:h*.7,sz:h*.28,ry:random()*Math.PI});upper.push({x:p.x,y:y+h*.86,z:p.z,sx:h*.22,sy:h*.57,sz:h*.22,ry:random()*Math.PI});}}}
      crowns.forEach(p=>{p.sy*=.48;p.sx*=1.22;p.sz*=1.22;});upper.forEach(p=>{p.sy*=.40;p.sx*=1.12;p.sz*=1.12;});
      this.instances(new T.CylinderGeometry(.65,1,1,6),this.materials.bark,trunks);this.instances(new T.IcosahedronGeometry(1,1),this.materials.leaf,crowns);this.instances(new T.IcosahedronGeometry(1,1),mat('#587343'),upper);
      for(let s=15;s<this.route.length;s+=24){const side=random()>.4?1:-1,p=this.roadPoint(s,side*(18+random()*20)),y=this.groundHeight(p.x,p.z);if(y<-3)continue;rocks.push({x:p.x,y:y-.5,z:p.z,sx:1.1+random()*2.5,sy:.8+random()*1.5,sz:1+random()*2,ry:random()*6});}this.instances(new T.DodecahedronGeometry(1,0),this.materials.rock,rocks);
      // A lighthouse anchors the open coast. It is an original procedural landmark.
      const lightPos=this.roadPoint(this.route.length*.125,-41),lh=new T.Group();lh.position.set(lightPos.x,Math.max(-.5,this.groundHeight(lightPos.x,lightPos.z)),lightPos.z);
      const tower=new T.Mesh(new T.CylinderGeometry(1.25,1.95,13,18),mat('#e4dcca'));tower.position.y=6.5;tower.castShadow=true;lh.add(tower);
      const stripe=new T.Mesh(new T.CylinderGeometry(1.52,1.62,1.5,18),mat('#9a5946'));stripe.position.y=6.5;lh.add(stripe);
      const rail=new T.Mesh(new T.CylinderGeometry(2,2,.18,18),mat('#505b58'));rail.position.y=12.55;lh.add(rail);
      const lantern=new T.Mesh(new T.CylinderGeometry(1.12,1.12,1.9,12),mat('#5f838e',.23,.45));lantern.position.y=13.6;lh.add(lantern);
      const cap=new T.Mesh(new T.ConeGeometry(1.6,1.1,12),mat('#5a6158'));cap.position.y=15.1;lh.add(cap);addBox(lh,.75,1.65,.1,0,.85,1.94,mat('#525e5b'));this.scene.add(lh);
      this.addBuilding(this.route.length*.11,29,14,5.5,8,'#c5b8a0','#81755c');
      // The outskirts have modest service buildings and a clear shoulder, never road obstacles.
      for(let i=0;i<9;i++)this.addBuilding(this.route.length*(.80+i*.014),i%2?31:-31,10+random()*8,4+random()*4,8+random()*9,i%2?'#b5b7a6':'#c8bfa8',i%2?'#787b72':'#8b7462');
      this.addRoadSign(this.route.length*.795,-1,'EASTPORT / HARBOR',0);
    }
    addBuilding(s,offset,w,h,d,color,roofColor){const p=this.roadPoint(s,offset),g=new T.Group();g.position.set(p.x,this.groundHeight(p.x,p.z),p.z);g.rotation.y=this.route.at(s).yaw;addBox(g,w,h,d,0,h*.5,0,mat(color));
      const roofmat=mat(roofColor),rp=[-w*.55,h,-d*.55,w*.55,h,-d*.55,0,h+1.9,-d*.55,-w*.55,h,d*.55,w*.55,h,d*.55,0,h+1.9,d*.55],roof=vertexMesh(rp,[0,3,5,0,5,2,2,5,4,2,4,1,0,2,1,3,4,5],roofmat);roof.castShadow=true;g.add(roof);
      const windowmat=mat('#46626a',.25,.4);for(let x=-w*.35;x<w*.45;x+=2.5)for(const side of[-1,1])addBox(g,1.2,1.35,.045,x,h*.58,side*(d*.5+.025),windowmat,false);addBox(g,1.25,2.5,.08,0,1.25,-d*.5-.05,mat('#746f61'));
      const trimParts=[],roofParts=[],detailGroup=new T.Group();detailGroup.userData.buildingDetail=true;detailGroup.visible=false;g.add(detailGroup);
      for(let x=-w*.35;x<w*.45;x+=2.5)for(const side of[-1,1]){
        for(const edge of[-1,1]){trimParts.push(detailBox(.065,1.48,.13,x+edge*.63,h*.58,side*(d*.5+.044)));trimParts.push(detailBox(1.32,.065,.13,x,h*.58+edge*.707,side*(d*.5+.044)));}
        trimParts.push(detailBox(.032,1.36,.11,x,h*.58,side*(d*.5+.061)));trimParts.push(detailBox(1.44,.09,.23,x,h*.58-.77,side*(d*.5+.11)));
      }
      for(const side of[-1,1]){trimParts.push(detailBox(.11,h,.12,side*w*.5,h*.5,-d*.5));roofParts.push(detailBox(.15,.16,d*1.1,side*w*.55,h-.04,0));}
      const roofAngle=Math.atan2(1.9,w*.55);for(let z=-d*.52;z<d*.54;z+=.85)for(const side of[-1,1])roofParts.push(detailBox(Math.hypot(w*.55,1.9),.032,.045,side*w*.275,h+.96,z,0,0,-side*roofAngle));
      detailBatch(detailGroup,trimParts,mat('#bbb7a9',.86),4);detailBatch(detailGroup,roofParts,mat(roofColor,.91),4);this.scene.add(g);
    }
    buildTunnel(){const start=this.route.length*.72,end=this.route.length*.77,positions=[],indices=[],count=Math.ceil((end-start)/3),archSteps=16;
      for(let i=0;i<=count;i++){const p=this.route.at(mix(start,end,i/count));for(let j=0;j<=archSteps;j++){const a=Math.PI*j/archSteps,offset=Math.cos(a)*14,raise=1.45+Math.sin(a)*6.7;positions.push(p.x+p.nx*offset,p.y+raise,p.z+p.nz*offset);}if(i<count)for(let j=0;j<archSteps;j++){const b=i*(archSteps+1)+j;indices.push(b,b+1,b+archSteps+2,b,b+archSteps+2,b+archSteps+1);}}
      const concrete=new T.MeshStandardMaterial({color:'#7d817a',roughness:.97,side:T.DoubleSide});this.scene.add(vertexMesh(positions,indices,concrete));
      for(const side of[-1,1]){const ps=[],is=[];for(let i=0;i<=count;i++){const p=this.route.at(mix(start,end,i/count));ps.push(p.x+p.nx*side*14,p.y,p.z+p.nz*side*14,p.x+p.nx*side*14,p.y+1.46,p.z+p.nz*side*14);if(i<count){const a=i*2;is.push(a,a+1,a+3,a,a+3,a+2);}}this.scene.add(vertexMesh(ps,is,concrete));}
      // Pale ribs and segmented ceiling lights make the tunnel legible in natural light.
      for(let s=start;s<=end;s+=11){const p=this.route.at(s),g=new T.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=p.yaw;for(let j=0;j<16;j++){const a=Math.PI*j/16,b=Math.PI*(j+1)/16;rod(g,[Math.cos(a)*13.96,1.45+Math.sin(a)*6.68,0],[Math.cos(b)*13.96,1.45+Math.sin(b)*6.68,0],.075,this.materials.rail,5);}for(const side of[-1,1])addBox(g,.20,.045,1.9,side*5,7.6,0,mat('#e8dcc3'),false);this.scene.add(g);}
      for(const s of[start-1,end+1]){const p=this.route.at(s),g=new T.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=p.yaw;for(const side of[-1,1])addBox(g,2.3,7,1,side*15,3.5,0,mat('#999d91'));addBox(g,31,1.6,1.2,0,8.5,0,mat('#9b9e90'));this.scene.add(g);}
    }
    buildCheckpoint(){this.checkpoint=new T.Group();const postmat=mat('#e0c389',.5),flagmat=mat('#3c787a',.6);for(const side of[-1,1]){addBox(this.checkpoint,.12,4.1,.12,side*9.4,2.05,0,postmat,false);addBox(this.checkpoint,1,2,.025,side*8.95,3.0,0,flagmat,false);}this.checkpoint.visible=false;this.scene.add(this.checkpoint);}
    buildCockpit(){this.cockpitLook={yaw:0,pitch:0};}
    setCameraLook(yaw=0,pitch=0){
      const look=this.cameraLook||(this.cameraLook={yaw:0,pitch:0});look.yaw=Number.isFinite(yaw)?yaw:0;look.pitch=clamp(Number.isFinite(pitch)?pitch:0,-1.1,1.1);
      this.setCockpitLook(look.yaw,-look.pitch);
    }
    setCockpitLook(yaw=0,pitch=0){this.cockpitLook={yaw:clamp(Number(yaw)||0,-2.6,2.6),pitch:clamp(Number(pitch)||0,-.7,.65)};}
    buildEngineSmoke(){
      const texture=canvasTexture(64,64,(c,w,h)=>{const grad=c.createRadialGradient(w/2,h/2,1,w/2,h/2,w*.49);grad.addColorStop(0,'rgba(170,174,169,.55)');grad.addColorStop(.38,'rgba(137,142,138,.34)');grad.addColorStop(1,'rgba(122,125,122,0)');c.fillStyle=grad;c.fillRect(0,0,w,h);});
      this.engineSmoke=new T.Group();this.scene.add(this.engineSmoke);this.smokeParticles=[];this.trafficSmokeParticles=[];this.smokeNext=0;this.smokeClock=0;this.trafficSmokeNext=0;this.trafficSmokeClock=0;this.trafficSmokeSource=0;
      for(const [pool,limit] of[[this.smokeParticles,24],[this.trafficSmokeParticles,32]])for(let i=0;i<limit;i++){const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,color:'#737a76'}));sprite.visible=false;this.engineSmoke.add(sprite);pool.push({sprite,age:9,life:2,vx:0,vy:0,vz:0,traffic:pool===this.trafficSmokeParticles});}
    }
    emitEngineSmoke(p,mesh,particle,index){
      const engine=clamp(p.damage?.engine||0,0,1),shape=mesh.userData.damageVisual.shape,side=((p.damage.frontRight||0)-(p.damage.frontLeft||0))*shape.width*.24,source=this.vector;
      dentPoint(side,shape.belt+.04,shape.length*(mesh.userData.kind==='truck'?.44:.32),p.damage,p.impacts||[],shape,source);const x=source.x,z=source.z,sin=Math.sin(p.yaw||0),cos=Math.cos(p.yaw||0);
      particle.sprite.position.set(p.x+cos*x+sin*z,(p.y||0)+source.y,p.z-sin*x+cos*z);particle.sprite.visible=true;particle.age=0;particle.life=1.9+(index%5)*.16;particle.vx=-(p.vx||0)*.065+Math.sin(index*2.4)*.12;particle.vz=-(p.vz||0)*.065+Math.cos(index*1.7)*.12;particle.vy=.48+engine*.3;
    }
    updateDamageEffects(sim,p,dt,playing,cameraMode){
      const engine=playing&&p.damage?clamp(p.damage.engine||0,0,1):0,effectScale=clamp(this.settings.damageEffectScale??1,0,1);
      if(this.damageRun!==sim){this.damageRun=sim;this.smokeClock=this.trafficSmokeClock=0;for(const pool of[this.smokeParticles,this.trafficSmokeParticles])for(const particle of pool){particle.age=9;particle.sprite.visible=false;}}
      this.engineSmoke.visible=playing&&effectScale>0;if(effectScale===0){if(!this.smokeSuppressed){for(const pool of[this.smokeParticles,this.trafficSmokeParticles])for(const particle of pool){particle.age=9;particle.sprite.visible=false;}this.smokeSuppressed=true;}return;}this.smokeSuppressed=false;this.smokeClock+=playing?dt:0;this.trafficSmokeClock+=playing?dt:0;
      if(playing&&dt>0&&effectScale>0&&engine>.52&&this.smokeClock>.095/effectScale){this.smokeClock=0;this.emitEngineSmoke(p,this.playerCar,this.smokeParticles[this.smokeNext++%this.smokeParticles.length],this.smokeNext);}
      if(playing&&dt>0&&effectScale>0&&this.trafficSmokeClock>.085/effectScale){
        this.trafficSmokeClock=0;const candidates=(sim?.traffic||[]).slice(0,40).filter(t=>(t.damage?.engine||0)>.52&&(t.x-p.x)**2+(t.z-p.z)**2<150**2&&this.trafficMeshes.get(t.id)?.userData.damageVisual);
        for(let i=0;i<Math.min(2,candidates.length);i++){const t=candidates[this.trafficSmokeSource++%candidates.length];this.emitEngineSmoke(t,this.trafficMeshes.get(t.id),this.trafficSmokeParticles[this.trafficSmokeNext++%this.trafficSmokeParticles.length],this.trafficSmokeNext);}
      }
      if(playing&&dt>0)for(const pool of[this.smokeParticles,this.trafficSmokeParticles])for(const particle of pool){if(particle.age>=particle.life){particle.sprite.visible=false;continue;}particle.age+=dt;const t=particle.age/particle.life;particle.sprite.position.x+=particle.vx*dt;particle.sprite.position.y+=particle.vy*dt;particle.sprite.position.z+=particle.vz*dt;const size=.19+particle.age*.55;particle.sprite.scale.set(size,size,1);particle.sprite.material.opacity=Math.sin(Math.min(1,t)*Math.PI)*.30*(particle.traffic||cameraMode==='chase'?1:.42);}
      const glass=playing&&p.damage?p.damage.glass||0:0;this.cockpitCracks.visible=glass>.10;this.cockpitCracks.material.opacity=smooth(.10,.72,glass)*.8;
    }
    buildCollisionEffects(){
      this.collisionEffects=new T.Group();this.scene.add(this.collisionEffects);this.collisionPools=[];
      for(const [spark,limit] of[[false,32],[true,64]]){const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),spark?new T.MeshBasicMaterial({color:'#ffd393'}):mat('#424b4b',.56,.32),limit);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.collisionEffects.add(mesh);this.collisionPools.push({spark,mesh,cursor:0,particles:Array.from({length:limit},()=>({active:false,age:0}))});}
      this.collisionEffectStats={limit:96,active:0,emitted:0};this.resetCollisionEffects();
    }
    resetCollisionEffects(){
      this.seenImpacts=new WeakMap();this.dummy.position.set(0,0,0);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(0,0,0);this.dummy.updateMatrix();
      for(const pool of this.collisionPools){pool.cursor=0;pool.particles.forEach((p,i)=>{p.active=false;p.age=0;pool.mesh.setMatrixAt(i,this.dummy.matrix);});pool.mesh.instanceMatrix.needsUpdate=true;}this.collisionEffectStats.active=this.collisionEffectStats.emitted=0;
    }
    updateCollisionEffects(sim,p,dt,playing){
      if(this.collisionRun!==sim){this.collisionRun=sim;this.resetCollisionEffects();}const effectScale=clamp(this.settings.damageEffectScale??1,0,1);this.collisionEffects.visible=playing&&effectScale>0;if(effectScale===0){if(!this.collisionSuppressed)this.resetCollisionEffects();this.collisionSuppressed=true;return;}this.collisionSuppressed=false;if(!playing||dt<=0)return;
      for(const body of[p,...(sim?.traffic||[]).slice(0,40)]){const hit=body.lastImpact;if(!hit||this.seenImpacts.get(body)===hit.revision)continue;this.seenImpacts.set(body,hit.revision);
        const strength=clamp(hit.severity??hit.strength??0,0,1);if(effectScale<=0||strength<.09||(sim.time||0)-(hit.time||0)>.35||(body.x-p.x)**2+(body.z-p.z)**2>125**2)continue;
        for(const pool of this.collisionPools){const count=Math.min(pool.spark?13:7,Math.ceil(strength*(pool.spark?15:8)*effectScale));for(let i=0;i<count;i++){const particle=pool.particles[pool.cursor++%pool.particles.length],phase=pool.cursor*2.399,spread=pool.spark?2.8:1.4,power=.7+strength*(pool.spark?5:2.8);Object.assign(particle,{active:true,age:0,life:pool.spark?.22+strength*.26:.75+strength*.6,x:hit.x,y:hit.y||((body.y||0)+.65),z:hit.z,floor:(body.y||0)+.025,vx:-(hit.nx||0)*power+Math.sin(phase)*spread+(body.vx||0)*.12,vy:1+strength*2+Math.sin(phase*1.8)*.6,vz:-(hit.nz||0)*power+Math.cos(phase)*spread+(body.vz||0)*.12,phase,size:pool.spark?.017:.027+strength*.04});this.collisionEffectStats.emitted++;}}
      }
      let active=0;for(const pool of this.collisionPools){for(let i=0;i<pool.particles.length;i++){const particle=pool.particles[i];if(particle.active){particle.age+=dt;if(particle.age>=particle.life)particle.active=false;}
          if(particle.active){particle.vy-=9.8*dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.z+=particle.vz*dt;if(particle.y<particle.floor){particle.y=particle.floor;particle.vy=Math.abs(particle.vy)*.22;particle.vx*=.62;particle.vz*=.62;}const fade=1-smooth(.62,1,particle.age/particle.life),size=particle.size*fade;this.dummy.position.set(particle.x,particle.y,particle.z);this.dummy.rotation.set(pool.spark?Math.atan2(particle.vy,Math.hypot(particle.vx,particle.vz)):particle.phase+particle.age*5,Math.atan2(particle.vx,particle.vz),pool.spark?0:particle.phase+particle.age*3);this.dummy.scale.set(size,pool.spark?size:size*.44,pool.spark?(.075+Math.hypot(particle.vx,particle.vz)*.019)*fade:size*1.7);active++;}
          else this.dummy.scale.set(0,0,0);this.dummy.updateMatrix();pool.mesh.setMatrixAt(i,this.dummy.matrix);
        }pool.mesh.instanceMatrix.needsUpdate=true;}this.collisionEffectStats.active=active;
    }
    buildTireEffects(){
      const group=new T.Group();this.scene.add(group);this.tireEffects=group;
      this.skidMesh=new T.InstancedMesh(new T.BoxGeometry(.165,.003,1),new T.MeshBasicMaterial({color:'#101411',transparent:true,opacity:.43,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),320);this.skidMesh.frustumCulled=false;group.add(this.skidMesh);
      this.skidMarks=Array.from({length:320},()=>({active:false,age:0}));this.skidCursor=0;this.skidClock=0;this.lastTireContacts=null;
      const texture=canvasTexture(64,64,(c,w,h)=>{const grad=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.49);grad.addColorStop(0,'rgba(207,209,202,.48)');grad.addColorStop(.45,'rgba(180,187,179,.18)');grad.addColorStop(1,'rgba(160,170,162,0)');c.fillStyle=grad;c.fillRect(0,0,w,h);});
      this.tireSmoke=[];this.tireSmokeCursor=0;this.tireSmokeClock=0;
      for(let i=0;i<28;i++){const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,color:'#b3b9b3',transparent:true,opacity:0,depthWrite:false}));sprite.visible=false;group.add(sprite);this.tireSmoke.push({sprite,age:2,life:1,vx:0,vz:0,intensity:0});}
      this.tireEffectStats={skidLimit:320,smokeLimit:28,activeSkids:0,activeSmoke:0,emittedSkids:0,emittedSmoke:0};this.resetTireEffects();
    }
    resetTireEffects(){
      this.skidCursor=0;this.skidClock=0;this.tireSmokeCursor=0;this.tireSmokeClock=0;this.lastTireContacts=null;this.dummy.position.set(0,0,0);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(0,0,0);this.dummy.updateMatrix();
      this.skidMarks.forEach((mark,i)=>{mark.active=false;mark.age=0;this.skidMesh.setMatrixAt(i,this.dummy.matrix);});this.skidMesh.instanceMatrix.needsUpdate=true;
      for(const particle of this.tireSmoke){particle.age=2;particle.sprite.visible=false;}Object.assign(this.tireEffectStats,{activeSkids:0,activeSmoke:0,emittedSkids:0,emittedSmoke:0});
    }
    updateTireEffects(sim,p,dt,playing){
      if(this.tireRun!==sim){this.tireRun=sim;this.resetTireEffects();}const effectScale=clamp(this.settings.damageEffectScale??1,0,1);this.tireEffects.visible=playing&&effectScale>0;if(effectScale===0){if(!this.tireSuppressed)this.resetTireEffects();this.tireSuppressed=true;return;}this.tireSuppressed=false;if(!playing||dt<=0)return;
      let matricesDirty=false,activeSkids=0,activeSmoke=0;
      for(let i=0;i<this.skidMarks.length;i++){const mark=this.skidMarks[i];if(!mark.active)continue;mark.age+=dt;if(mark.age>18){mark.active=false;this.dummy.scale.set(0,0,0);this.dummy.updateMatrix();this.skidMesh.setMatrixAt(i,this.dummy.matrix);matricesDirty=true;}else activeSkids++;}
      const speed=Math.abs(p.speed||0),intensity=clamp(Number.isFinite(p.driftIntensity)?p.driftIntensity:(Math.abs(p.slip||0)-1.1)/4,0,1),onAsphalt=Math.abs(p.offset||0)<8.05;
      const skidding=intensity>.10&&speed>4&&onAsphalt;
      if(skidding){const sin=Math.sin(p.yaw||0),cos=Math.cos(p.yaw||0),contacts=this.playerCar.userData.wheels.filter(w=>!w.front).map(w=>({x:p.x+cos*w.pivot.position.x+sin*w.pivot.position.z,y:(p.y||0)+.023,z:p.z-sin*w.pivot.position.x+cos*w.pivot.position.z}));
        this.skidClock+=dt;this.tireSmokeClock+=dt;if(!this.lastTireContacts)this.lastTireContacts=contacts;
        if(this.skidClock>.035){this.skidClock=0;for(let i=0;i<contacts.length;i++){const a=this.lastTireContacts[i],b=contacts[i],dx=b.x-a.x,dz=b.z-a.z,distance=Math.hypot(dx,dz);if(distance<.08||distance>3.5)continue;const index=this.skidCursor++%this.skidMarks.length,mark=this.skidMarks[index];if(!mark.active)activeSkids++;mark.active=true;mark.age=0;this.dummy.position.set((a.x+b.x)*.5,(a.y+b.y)*.5,(a.z+b.z)*.5);this.dummy.rotation.set(0,Math.atan2(dx,dz),0);this.dummy.scale.set(.65+intensity*.5,1,distance+.055);this.dummy.updateMatrix();this.skidMesh.setMatrixAt(index,this.dummy.matrix);this.tireEffectStats.emittedSkids++;matricesDirty=true;}this.lastTireContacts=contacts;}
        if(this.tireSmokeClock>.065&&intensity>.16){this.tireSmokeClock=0;for(const contact of contacts){const particle=this.tireSmoke[this.tireSmokeCursor++%this.tireSmoke.length];particle.sprite.position.set(contact.x,contact.y+.11,contact.z);particle.age=0;particle.life=1.3+(this.tireSmokeCursor%4)*.12;particle.vx=(p.vx||0)*.08;particle.vz=(p.vz||0)*.08;particle.intensity=intensity;particle.sprite.visible=true;this.tireEffectStats.emittedSmoke++;}}
      }else{this.lastTireContacts=null;this.skidClock=0;this.tireSmokeClock=0;}
      for(const particle of this.tireSmoke){if(particle.age>=particle.life){particle.sprite.visible=false;continue;}particle.age+=dt;const t=Math.min(1,particle.age/particle.life);particle.sprite.position.x+=particle.vx*dt;particle.sprite.position.z+=particle.vz*dt;particle.sprite.position.y+=dt*.32;const size=.18+particle.age*.85;particle.sprite.scale.set(size,size,1);particle.sprite.material.opacity=Math.sin(t*Math.PI)*.62*(.3+particle.intensity*.7);activeSmoke++;}
      if(matricesDirty)this.skidMesh.instanceMatrix.needsUpdate=true;this.tireEffectStats.activeSkids=activeSkids;this.tireEffectStats.activeSmoke=activeSmoke;
    }

    updateOccupants(mesh,p,dt){
      const occupants=mesh.userData.occupants||[],impact=p.lastImpact;
      for(const o of occupants){
        if(o.damage!==p.damage){o.damage=p.damage;o.ejected=false;o.injury=0;o.wound.visible=false;o.root.visible=true;o.lastImpact=null;o.pitch=o.roll=o.vPitch=o.vRoll=0;}
        const hit=impact&&o.lastImpact!==impact;o.lastImpact=impact;
        if(hit&&(impact.severity||0)>.16){o.injury=clamp(o.injury+(impact.severity||0)*.48,0,1);o.wound.visible=true;o.wound.scale.y=.7+o.injury;o.vPitch+=(impact.normalZ||impact.nz||1)*(impact.severity||0)*2.2;o.vRoll+=(impact.normalX||impact.nx||.3)*(impact.severity||0)*1.6;
          mesh.updateWorldMatrix(true,true);this.emitOccupantBlood(o.upper.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.24,0)),p,Math.ceil(4+o.injury*9));}
        if(!o.ejected&&p.damage&&(p.destroyed||hit&&(impact.severity||0)>.78)){
          mesh.updateWorldMatrix(true,true);this.ejectOccupant(o,p);o.ejected=true;o.root.visible=false;
        }
        if(o.ejected){o.root.visible=false;continue;}
        if(dt>0){const targetRoll=clamp(-(p.yawRate||0)*Math.abs(p.speed||0)*.009,-.23,.23),targetPitch=clamp((p.pitch||0)*1.8+(p.brake||0)*.08,-.17,.21),step=Math.min(dt,.04);o.vRoll+=((targetRoll-o.roll)*65-o.vRoll*9)*step;o.vPitch+=((targetPitch-o.pitch)*65-o.vPitch*9)*step;o.roll=clamp(o.roll+o.vRoll*step,-.42,.42);o.pitch=clamp(o.pitch+o.vPitch*step,-.38,.38);}
        o.upper.rotation.z=o.roll;o.upper.rotation.x=o.pitch;o.head.rotation.z=-o.roll*.28;o.head.rotation.x=-o.pitch*.32;
        o.arms.forEach((arm,i)=>{arm.rotation.z=o.roll*(i?.3:-.3);arm.rotation.x=o.pitch*.24;});
      }
    }
    occupantEffects(){
      if(this.occupantFX)return this.occupantFX;const group=new T.Group();group.name='Occupant impact effects';this.scene.add(group);
      const blood=new T.InstancedMesh(new T.SphereGeometry(1,5,4),new T.MeshStandardMaterial({color:'#831e20',roughness:.79}),160);blood.frustumCulled=false;group.add(blood);const particles=Array.from({length:160},()=>({age:10,life:0}));const dummy=new T.Object3D();dummy.scale.set(0,0,0);dummy.updateMatrix();particles.forEach((p,i)=>blood.setMatrixAt(i,dummy.matrix));blood.instanceMatrix.needsUpdate=true;
      return this.occupantFX={group,blood,particles,run:this.activeSim,cursor:0,ragdolls:[],emitted:0,ejected:0,dummy};
    }
    emitOccupantBlood(position,p,count){
      const fx=this.occupantEffects();for(let i=0;i<count;i++){const index=fx.cursor++,particle=fx.particles[index%fx.particles.length],a=index*2.399;Object.assign(particle,{x:position.x,y:position.y,z:position.z,vx:(p.vx||0)*.16+Math.sin(a)*(1+i*.12),vy:1.5+(i%4)*.55,vz:(p.vz||0)*.16+Math.cos(a)*(1+i*.12),age:0,life:8,size:.018+(i%3)*.009,floor:(p.y||0)+.015,settled:false});fx.emitted++;}
    }
    ejectOccupant(o,p){
      const fx=this.occupantEffects(),object=o.root.clone(true);object.name='Ejected occupant';object.traverse(n=>{if(n.geometry)n.geometry=n.geometry.clone();if(n.material)n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();});o.root.matrixWorld.decompose(object.position,object.quaternion,object.scale);object.visible=true;fx.group.add(object);
      const a=fx.ejected++*2.399,velocity=new T.Vector3((p.vx||0)*.75+Math.sin(a)*3.3,4.5+fx.ejected%3,(p.vz||0)*.75+Math.cos(a)*3.3),spin=new T.Vector3(1.8+Math.sin(a),Math.cos(a)*1.7,Math.sin(a)*2.3);
      fx.ragdolls.push({object,velocity,spin,age:0,life:20,settled:false,floor:(p.y||0)+.23,bounces:0,upper:object.children[1]});this.emitOccupantBlood(object.position,p,24);
      while(fx.ragdolls.length>16)this.disposeOccupantEffect(fx.ragdolls.shift());
    }
    disposeOccupantEffect(r){const geometries=new Set(),materials=new Set();r.object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());r.object.removeFromParent();}
    updateOccupantEffects(sim,dt,playing){
      const fx=this.occupantFX;if(!fx)return;if(fx.run!==sim){for(const r of fx.ragdolls)this.disposeOccupantEffect(r);fx.ragdolls=[];fx.particles.forEach(p=>p.age=p.life+1);fx.run=sim;fx.emitted=fx.ejected=0;}
      fx.group.visible=playing;if(!playing||dt<=0)return;
      for(const r of fx.ragdolls){r.age+=dt;if(!r.settled){r.velocity.y-=9.81*dt;r.object.position.addScaledVector(r.velocity,dt);r.object.rotation.x+=r.spin.x*dt;r.object.rotation.z+=r.spin.z*dt;r.object.rotation.y+=r.spin.y*dt;const n=this.nearest(r.object.position.x,r.object.position.z);r.floor=(n.connector||Math.abs(n.offset)<this.route.halfWidth+1?n.p.y:this.groundHeight(r.object.position.x,r.object.position.z))+.22;
          if(r.upper){r.upper.rotation.x=Math.sin(r.age*11)*.55;r.upper.rotation.z=Math.cos(r.age*9)*.38;}
          if(r.object.position.y<r.floor){r.object.position.y=r.floor;r.velocity.y=Math.abs(r.velocity.y)*.28;r.velocity.x*=.64;r.velocity.z*=.64;r.spin.multiplyScalar(.55);r.bounces++;if(r.velocity.length()<.7||r.bounces>8){r.settled=true;r.object.rotation.x=Math.PI*.5;}}}
        if(r.age>r.life-2)r.object.traverse(o=>{if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.transparent=true;m.opacity=clamp((r.life-r.age)/2,0,1);}});
      }fx.ragdolls=fx.ragdolls.filter(r=>{if(r.age<r.life)return true;this.disposeOccupantEffect(r);return false;});
      let active=0;for(let i=0;i<fx.particles.length;i++){const p=fx.particles[i];p.age+=dt;if(p.age<p.life){if(!p.settled){p.vy-=9.81*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<p.floor){p.y=p.floor;p.settled=true;}}const fade=clamp((p.life-p.age)/2,0,1),size=p.size*fade;fx.dummy.position.set(p.x,p.y,p.z);fx.dummy.scale.set(size*(p.settled?3.5:1),size*(p.settled?.10:1),size*(p.settled?2.4:1));active++;}else fx.dummy.scale.set(0,0,0);fx.dummy.updateMatrix();fx.blood.setMatrixAt(i,fx.dummy.matrix);}fx.blood.instanceMatrix.needsUpdate=true;this.occupantStats={ragdolls:fx.ragdolls.length,bloodParticles:active,emitted:fx.emitted,ejected:fx.ejected,ragdollLimit:16,particleLimit:160};
    }
    updateGPS(sim,player,dt){
      const interior=this.playerCar.userData.interior,texture=interior?.gpsTexture;if(!texture)return;interior.gpsClock=(interior.gpsClock||0)+dt;const waypoint=sim?.waypoint,key=[Math.round(player.x/2),Math.round(player.z/2),Math.round(player.yaw*30),waypoint?.x,waypoint?.z].join('/');if(interior.gpsKey===key&&interior.gpsClock<.2)return;interior.gpsKey=key;interior.gpsClock=0;
      const c=texture.image.getContext('2d'),w=512,h=256,scale=1.28,sin=Math.sin(player.yaw||0),cos=Math.cos(player.yaw||0),project=p=>{const dx=p.x-player.x,dz=p.z-player.z,forward=dx*sin+dz*cos,right=-dx*cos+dz*sin;return{x:w*.5+right*scale,y:h*.74-forward*scale*.66};};
      c.fillStyle='#14212b';c.fillRect(0,0,w,h);c.save();c.beginPath();c.rect(0,30,w,h-30);c.clip();c.strokeStyle='#223440';c.lineWidth=1;for(let x=0;x<w;x+=42){c.beginPath();c.moveTo(x,30);c.lineTo(x,h);c.stroke();}for(let y=32;y<h;y+=34){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
      const trace=(path,color,width)=>{c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.beginPath();let begun=false;for(const point of path.samples||[]){const p=project(point);if(!begun){c.moveTo(p.x,p.y);begun=true;}else c.lineTo(p.x,p.y);}c.stroke();};
      for(const path of[this.route,...this.route.connectors||[]]){trace(path,'#0b131a',(path.width||12)*scale+5);trace(path,'#60717b',Math.max(5,(path.width||12)*scale));trace(path,'#7e8e95',2);}
      let distance=0;if(waypoint){distance=Math.hypot(waypoint.x-player.x,waypoint.z-player.z);const start=this.route.driveNearest(player.x,player.z),end=this.route.driveNearest(waypoint.x,waypoint.z),path=start.roadId===end.roadId&&start.connectorS!=null?this.route.connectors.find(p=>p.id===start.roadId):this.route,a=start.connectorS??start.s,b=end.connectorS??end.s,span=path===this.route?((b-a+path.length*1.5)%path.length-path.length*.5):b-a;c.strokeStyle='#49bdf4';c.lineWidth=6;c.lineCap='round';c.beginPath();for(let i=0;i<=60;i++){const p=project(path.at(a+span*i/60));if(i===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}const pin=project(waypoint);c.lineTo(pin.x,pin.y);c.stroke();c.fillStyle='#f4cf64';c.beginPath();c.arc(pin.x,pin.y,8,0,Math.PI*2);c.fill();}
      c.translate(w*.5,h*.74);c.fillStyle='#d5f5ff';c.strokeStyle='#163847';c.lineWidth=2;c.beginPath();c.moveTo(0,-12);c.lineTo(9,10);c.lineTo(0,5);c.lineTo(-9,10);c.closePath();c.fill();c.stroke();c.restore();c.fillStyle='#10191f';c.fillRect(0,0,w,31);c.fillStyle='#d4e5e9';c.font='bold 18px sans-serif';c.textAlign='left';c.fillText(waypoint?'ROUTE GUIDANCE':'PLATDO NAV',14,22);c.textAlign='right';c.fillStyle='#7cccf0';c.fillText(waypoint?(this.settings.units==='kmh'?(distance/1000).toFixed(1)+' km':(distance/1609.344).toFixed(1)+' mi'):this.route.map.name.toUpperCase(),w-12,22);texture.needsUpdate=true;this.gpsStats={waypoint:waypoint?{x:waypoint.x,z:waypoint.z}:null,distance,updates:(this.gpsStats?.updates||0)+1};
    }
    updateLiveMirrors(dt,playing,cameraMode){
      if(!playing||cameraMode!=='cockpit'||this.playerCar.userData.breakState?.exploded)return;
      const quality=qualityRanks[this.settings.graphicsValues?.detail||this.settings.quality]??2,size=quality<2?128:quality<4?256:512,interval=quality<2?1/10:quality<4?1/18:1/30;
      let state=this.liveMirrors;if(!state){state=this.liveMirrors={clock:1,targets:[],cameras:[],frames:0};for(let i=0;i<3;i++){const target=new T.WebGLRenderTarget(size,Math.round(size*.5),{minFilter:T.LinearFilter,magFilter:T.LinearFilter});target.texture.colorSpace=T.SRGBColorSpace;target.texture.repeat.x=-1;target.texture.offset.x=1;state.targets.push(target);state.cameras.push(new T.PerspectiveCamera(i===2?70:64,2,.05,Math.min(750,this.effectiveRenderDistance||530)));}}
      state.clock+=dt;if(state.clock<interval&&state.car===this.playerCar)return;state.clock=0;state.car=this.playerCar;const faces=[];this.playerCar.traverse(o=>{if(o.userData.liveMirror)faces.push(o);});faces.sort((a,b)=>(b.userData.mirrorSide??-2)-(a.userData.mirrorSide??-2));
      const oldTarget=this.renderer.getRenderTarget(),auto=this.renderer.shadowMap.autoUpdate,skyPosition=this.sky.position.clone();this.renderer.shadowMap.autoUpdate=false;const hidden=[];this.scene.traverse(o=>{if(o.userData.liveMirror){hidden.push([o,o.visible]);o.visible=false;}});
      try{this.playerCar.updateWorldMatrix(true,true);for(let i=0;i<faces.length&&i<3;i++){const face=faces[i];let detached=false;for(let n=face;n;n=n.parent)if(n.userData.driveDetached)detached=true;if(detached)continue;const target=state.targets[i],camera=state.cameras[i];if(target.width!==size)target.setSize(size,Math.round(size*.5));face.material.map=target.texture;face.material.needsUpdate=true;const q=this.playerCar.getWorldQuaternion(new T.Quaternion()),position=face.getWorldPosition(new T.Vector3()),side=face.userData.mirrorSide||0,forward=new T.Vector3(side*.25,.02,-1).applyQuaternion(q).normalize(),up=new T.Vector3(0,1,0).applyQuaternion(q);camera.position.copy(position).addScaledVector(forward,.045);camera.up.copy(up);camera.lookAt(position.clone().addScaledVector(forward,30));camera.far=Math.min(750,this.effectiveRenderDistance||530);camera.updateProjectionMatrix();this.sky.position.copy(camera.position);this.renderer.setRenderTarget(target);this.renderer.render(this.scene,camera);state.frames++;}}
      finally{hidden.forEach(([o,visible])=>o.visible=visible);this.sky.position.copy(skyPosition);this.renderer.shadowMap.autoUpdate=auto;this.renderer.setRenderTarget(oldTarget);}
      this.mirrorStats={views:faces.length,frames:state.frames,size,refreshHz:Math.round(1/interval),source:'live scene cameras'};
    }

    setCar(config,color,preserveVisualState=false){
      const id=String(config&&(config.id||config.key||config.type)||'compact').toLowerCase(),kind=VehicleModels?.profiles[id]?id:id.includes('apex')?'apex':id.includes('vektor')?'vektor':'compact',old=this.playerCar;
      this.playerConfig=config;this.playerColor=color;this.modelDetailLevel=modelGeometry.resolve(this.settings.graphicsValues,this.settings.quality);
      const key=[kind,this.modelDetailLevel,config.equipped?.wheels||'',config.equipped?.spoilers||''].join('/'),cache=this.carCache;
      this.playerCar=!preserveVisualState&&cache?.get(key)||createCar(kind,color||config?.paint?.baseColor||'#b9543d',true,config,this.modelDetailLevel);
      if(old&&old!==this.playerCar){if(preserveVisualState)this.transferModelState(old,this.playerCar);this.scene.remove(old);if(!cache||![...cache.values()].includes(old))disposeModel(old);}
      if(cache){const previous=cache.get(key);if(previous&&previous!==this.playerCar){previous.removeFromParent();disposeModel(previous);}cache.set(key,this.playerCar);while(cache.size>40){const oldest=[...cache.keys()].find(k=>k!==key&&!cache.get(k).parent);if(!oldest)break;disposeModel(cache.get(oldest));cache.delete(oldest);}}
      if(!preserveVisualState){this.playerCar.traverse(o=>{if(o.userData.driveDetached){o.userData.driveDetached=false;o.visible=true;}});this.playerCar.userData.breakState=null;if(this.playerCar.userData.charredFrame){this.playerCar.userData.charredFrame.removeFromParent();delete this.playerCar.userData.charredFrame;}applyCarDamage(this.playerCar,{});this.playerCar.visible=true;VehicleModels?.fitPaint(this.playerCar,config.paint||{baseColor:color,strokes:[]});}
      modelQuality(this.playerCar,qualityRanks[this.settings.graphicsValues?.detail||this.settings.quality]??3);this.scene.add(this.playerCar);
      const interior=this.playerCar.userData.interior;this.cockpit=interior.root;this.steeringWheel=interior.steeringWheel;this.instrumentNeedles=interior.needles;this.dialTextures=interior.dialTextures;this.dialMaterial=interior.dialMaterial;this.cockpitCracks=this.playerCar.userData.damageVisual.crackMeshes.find(c=>c.zone==='front').mesh;this.driverEyeAnchor=interior.driverEyeAnchor;if(!preserveVisualState)this.cameraMode='';this.setCameraLook(this.cameraLook?.yaw||0,this.cameraLook?.pitch||0);this.carKind=kind;this.carColor=color;
    }
    transferModelState(old,next){
      const detached=new Set();old.traverse(o=>{if(o.userData.driveDetached&&o.userData.breakawayPart)detached.add(o.userData.breakawayPart);});
      next.position.copy(old.position);next.quaternion.copy(old.quaternion);next.visible=old.visible;next.userData.breakState=old.userData.breakState;
      for(let i=0;i<(next.userData.occupants||[]).length;i++){const previous=old.userData.occupants?.[i],o=next.userData.occupants[i];if(!previous)continue;for(const key of['damage','lastImpact','ejected','injury','pitch','roll','vPitch','vRoll'])o[key]=previous[key];o.wound.visible=previous.wound.visible;o.root.visible=previous.root.visible;}
      if(old.userData.simulationBody)this.updateCar(next,old.userData.simulationBody,0);
      next.traverse(o=>{if(detached.has(o.userData.breakawayPart)){o.userData.driveDetached=true;o.visible=false;}});
      if(old.userData.breakState?.exploded){next.userData.body.traverse(o=>{if(o.isMesh||o.isLine){o.userData.driveDetached=true;o.visible=false;}});for(const w of next.userData.wheels){w.pivot.userData.driveDetached=true;w.pivot.visible=false;}next.userData.contact.visible=false;}
      if(old.userData.charredFrame){next.userData.charredFrame=old.userData.charredFrame;next.add(old.userData.charredFrame);}
    }
    setModelDetail(level){
      if(this.modelDetailLevel===level)return;this.modelDetailLevel=level;
      if(this.carCache){for(const [key,model]of this.carCache)if(model!==this.playerCar){model.removeFromParent();disposeModel(model);this.carCache.delete(key);}if(this.playerCar)for(const [key,model]of this.carCache)if(model===this.playerCar)this.carCache.delete(key);}
      if(this.playerCar)this.setCar({...this.playerConfig,paint:this.playerCar.userData.paintState||this.playerConfig?.paint},this.playerColor,true);
      for(const [id,old]of this.trafficMeshes){const d=old.userData,next=createCar(d.kind,d.sourceColor,false,d.sourceDimensions,level);this.transferModelState(old,next);modelQuality(next,qualityRanks[this.settings.graphicsValues?.detail||this.settings.quality]??2);this.scene.add(next);this.scene.remove(old);disposeModel(old);this.trafficMeshes.set(id,next);}
    }
    setPlayerCar(config,color){this.setCar(config,color);}
    setPaint(paint){if(this.playerCar&&VehicleModels)VehicleModels.fitPaint(this.playerCar,paint);}
    pickPaint(clientX,clientY){
      if(!this.playerCar)return null;const rect=this.canvas.getBoundingClientRect();if(clientX<rect.left||clientX>rect.right||clientY<rect.top||clientY>rect.bottom)return null;
      this.playerCar.updateWorldMatrix(true,true);this.camera.updateMatrixWorld(true);this.paintRaycaster||=new T.Raycaster();this.paintRaycaster.setFromCamera(new T.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),this.camera);
      const candidates=[];this.playerCar.traverse(o=>{if(!o.isMesh||o===this.playerCar.userData.contact)return;for(let a=o;a;a=a.parent)if(!a.visible)return;if(o.material?.opacity===0)return;candidates.push(o);});
      const hit=this.paintRaycaster.intersectObjects(candidates,false)[0];if(!hit||!hit.object.userData.paintSurface||!hit.uv)return null;
      return {surface:hit.object.userData.paintSurface,u:clamp(hit.uv.x,0,1),v:clamp(hit.uv.y,0,1)};
    }
    updateCockpitTelemetry(player,dt){
      const interior=this.playerCar.userData.interior,mph=this.settings.units!=='kmh',speed=Math.abs(player.speed||0)*(mph?2.2369362921:3.6),rpm=Number.isFinite(player.engineRPM)?player.engineRPM:0;
      // Dials share the HUD's real speed/engine telemetry; smoothing never feeds physics.
      const alpha=dt>0?1-Math.exp(-18*dt):1;interior.displaySpeed=mix(interior.displaySpeed??speed,speed,alpha);interior.displayRPM=mix(interior.displayRPM??rpm,rpm,alpha);
      for(const [i,value]of [[0,interior.displaySpeed/(mph?160:240)],[1,interior.displayRPM/8000]])this.instrumentNeedles[i].rotation.z=-(.76+clamp(value,0,1)*1.48)*Math.PI-Math.PI/2;
      const desiredTexture=this.dialTextures[mph?'mph':'kmh'];if(this.dialMaterial.map!==desiredTexture){this.dialMaterial.map=desiredTexture;this.dialMaterial.needsUpdate=true;}
      const gear=(player.speed||0)<-.4?'R':Math.abs(player.speed||0)<.4?'N':String(player.gear||1),label=Math.round(speed)+' '+(mph?'MPH':'KM/H')+'  '+gear;
      if(interior.lastDigital!==label){const c=interior.digitalTexture.image.getContext('2d');c.fillStyle='#10201d';c.fillRect(0,0,256,80);c.fillStyle='#b8d4b6';c.font='bold 29px monospace';c.textAlign='center';c.fillText(label,128,52);interior.digitalTexture.needsUpdate=true;interior.lastDigital=label;}
    }
    setSettings(settings){Object.assign(this.settings,settings);const q=this.settings.quality,profile=window.DriveGraphicsProfiles?.[q],size=Math.min(profile?.shadow??(q==='low'||q==='potato'?0:q==='high'?2048:1024),this.renderer.capabilities.maxTextureSize||4096);this.renderer.shadowMap.enabled=size>0;if(size&&this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}}
      this.scene.fog.near=profile?.near??(q==='low'?90:130);this.scene.fog.far=profile?.far??(q==='low'?390:q==='medium'?530:670);
      this.camera.fov=this.settings.fov||72;this.camera.updateProjectionMatrix();
      if(this.dialMaterial){this.dialMaterial.map=this.dialTextures[this.settings.units==='kmh'?'kmh':'mph'];this.dialMaterial.needsUpdate=true;}
      this.setModelDetail(modelGeometry.resolve(this.settings.graphicsValues,q));this.worldModels?.setModelDetail(this.modelDetailLevel);this.setVisualQuality(q);
    }
    resize(w,h){w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
    safeCamera(player,x,y,z){
      const start={x:player.x,y:(player.y||0)+1.1,z:player.z},safe={x,y,z};let limited=false;
      for(let i=1;i<=12;i++){const t=i/12,px=mix(start.x,x,t),py=mix(start.y,y,t),pz=mix(start.z,z,t),n=this.nearest(px,pz);let blocked=py<this.groundHeight(px,pz)+.24;
        const tunnel=this.route.map?.tunnel||{start:.72,end:.77},f=n.p.s/this.route.length,radius=this.route.halfWidth+2;if(!n.connector&&f>tunnel.start&&f<tunnel.end&&Math.abs(n.offset)<radius){const ceiling=n.p.y+1.45+Math.sqrt(Math.max(0,1-(n.offset/radius)**2))*6.7;if(py>ceiling-.3)blocked=true;}
        for(const o of this.route.obstacles||[]){const dx=px-o.x,dz=pz-o.z,c=Math.cos(o.yaw||0),s=Math.sin(o.yaw||0);if(Math.abs(dx*c-dz*s)<o.width*.5+.3&&Math.abs(dx*s+dz*c)<o.length*.5+.3&&py<(o.y||n.p.y)+(o.height||3)+.3){blocked=true;break;}}
        if(blocked){const safeT=Math.max(.12,(i-1)/12);safe.x=mix(start.x,x,safeT);safe.y=mix(start.y,y,safeT);safe.z=mix(start.z,z,safeT);limited=true;break;}
      }safe.y=Math.max(safe.y,this.groundHeight(safe.x,safe.z)+.26);this.cameraClipStats={limited};return safe;
    }
    updateCar(mesh,p,dt){const d=mesh.userData;d.simulationBody=p;if(!d.damageVisual&&p.damage&&(p.damageRevision||0)>0){const setup=d.damageSetup;modelGeometry.withLevel(d.modelDetailLevel,()=>prepareCarDamage(mesh,setup.shell,setup.corners,setup.lamps,setup.shape,setup.detail));}applyCarDamage(mesh,p);for(const lamp of d.lamps||[]){const material=lamp.mesh.material,zone=lamp.front?'front':'rear',damage=clamp((p.damage?.[zone]||0)*.5+(p.damage?.[zone+(lamp.side>0?'Right':'Left')]||0)*.7,0,1);material.emissive.set(lamp.front?'#efe4ca':lamp.reverse?'#ddd9c7':'#dc160b');material.emissiveIntensity=(lamp.front?.08:lamp.reverse?(p.gear<0||p.speed<-.5?1.1:0):(p.brake>.08&&p.speed>-.5?1.45:.08))*(1-damage);}mesh.position.set(p.x,p.y||0,p.z);mesh.rotation.set(p.terrainPitch||0,p.yaw||0,p.terrainRoll||0,'YXZ');const kick=p.suspensionKick||{};if(d.body){d.body.rotation.z=clamp((p.roll||0)+(kick.roll||0),-.15,.15);d.body.rotation.x=clamp((p.pitch||0)+(kick.pitch||0),-.14,.14);d.body.position.y=clamp(kick.heave||0,-.045,.065);}for(const w of d.wheels){const damage=p.damage&&p.damage.wheels?clamp(p.damage.wheels[w.damageIndex]||0,0,1):0;w.pivot.position.copy(w.basePosition);w.pivot.position.x-=w.side*damage*.045;w.pivot.position.z+=damage*(w.front?-.055:.04);w.pivot.rotation.y=(w.front?(p.steer||0):0)+w.side*damage*.10;w.pivot.rotation.z=w.side*damage*.085;w.spin.rotation.x=Number.isFinite(p.wheelSpin)?p.wheelSpin*(d.simulationWheelRadius||.34)/(w.pivot.userData.wheelRadius||.34):0;}this.updateOccupants(mesh,p,dt); }
    render(sim,cameraMode,dt,view='playing'){
      dt=Math.min(Math.max(dt||0,0),.075);this.time+=dt;this.activeSim=sim;if(this.occupantFX&&this.occupantFX.run!==sim)this.updateOccupantEffects(sim,0,view==='playing');const playing=view==='playing',preview=this.route.at(18),input=sim&&(sim.renderPlayer||sim.player);
      const previewLane=this.route.laneAt&&this.route.forwardLanes?.length?this.route.laneAt(18,this.route.forwardLanes[0]):{x:preview.x-preview.nx*2,y:preview.y,z:preview.z-preview.nz*2,yaw:preview.yaw};const player=playing&&input?input:{...previewLane,speed:0,steer:0};
      this.updateCar(this.playerCar,player,dt);this.playerCar.userData.body.visible=true;for(const w of this.playerCar.userData.wheels)w.pivot.visible=!w.pivot.userData.driveDetached;this.cockpit.visible=true;this.steeringWheel.rotation.z=-(player.steer||0)*(this.steeringWheel.userData.visualRatio||6);this.updateCockpitTelemetry(player,dt);this.updateGPS(sim,player,dt);this.updateTireEffects(sim,player,dt,playing);
      
      const changed=this.cameraMode!==cameraMode||this.lastView!==view;this.cameraMode=cameraMode;this.lastView=view;
      const yaw=player.yaw||0,sin=Math.sin(yaw),cos=Math.cos(yaw),speed=Math.abs(player.speed||0),motion=this.settings.reducedMotion?0:1,shake=motion*clamp(Number(this.settings.cameraShake)||0,0,1);
      const look=this.cameraLook||{yaw:0,pitch:0},heading=yaw+look.yaw;
      let cx,cy,cz,tx,tz,ty;
      if(!playing){const angle=yaw+(view==='garage'?(this.inspection?.yaw??(.3+this.time*.13*motion)):.63+Math.sin(this.time*.09)*.12*motion);const distance=view==='garage'?clamp(this.inspection?.distance||6.2,3.7,9)*(this.camera.aspect<.9?1.35:1):6.8;cx=player.x+Math.sin(angle)*distance;cz=player.z+Math.cos(angle)*distance;cy=player.y+(view==='garage'?clamp(this.inspection?.elevation??2.6,.7,7):2.6);tx=player.x;tz=player.z;ty=player.y+this.playerCar.userData.height*.48;}
      else if(cameraMode==='cockpit'){this.playerCar.updateWorldMatrix(true,true);const eye=this.driverEyeAnchor.getWorldPosition(new T.Vector3()),q=this.driverEyeAnchor.getWorldQuaternion(new T.Quaternion()),look=this.cockpitLook||{yaw:0,pitch:0},localLook=new T.Quaternion().setFromEuler(new T.Euler(look.pitch,look.yaw,0,'YXZ'));q.multiply(localLook);const forward=new T.Vector3(0,0,1).applyQuaternion(q),up=new T.Vector3(0,1,0).applyQuaternion(q);eye.addScaledVector(up,Math.sin(this.time*12)*Math.min(speed/100,1)*.003*shake);cx=eye.x;cy=eye.y;cz=eye.z;tx=cx+forward.x*20;ty=cy+forward.y*20;tz=cz+forward.z*20;this.camera.up.copy(up);}
      else if(cameraMode==='hood'){cx=player.x+sin*.57;cz=player.z+cos*.57;cy=player.y+this.playerCar.userData.belt+.31;tx=cx+Math.sin(heading)*Math.cos(look.pitch)*60;tz=cz+Math.cos(heading)*Math.cos(look.pitch)*60;ty=cy-.15+Math.sin(look.pitch)*60;}
      else {const distance=player.destroyed?9.8:clamp(this.settings.chaseDistance||6.2,4,10)+Math.min(speed*.014,.8),anticipation=clamp((player.yawRate||0)*.12,-.09,.09),kick=player.suspensionKick||{};const height=(player.destroyed?4.6:clamp(this.settings.chaseHeight||3.05,1.5,5))+(kick.heave||0)*shake*.3,baseElevation=Math.atan2(height-1.05,distance),radius=Math.hypot(distance,height-1.05),elevation=clamp(baseElevation-look.pitch,-.15,1.25),horizontal=radius*Math.cos(elevation);cx=player.x-Math.sin(heading)*horizontal;cz=player.z-Math.cos(heading)*horizontal;cy=player.y+1.05+radius*Math.sin(elevation);tx=player.x+Math.sin(heading+anticipation)*8;tz=player.z+Math.cos(heading+anticipation)*8;ty=player.y+1.05;}
      const damping=changed?1:playing&&cameraMode==='chase'?1-Math.exp(-dt*(motion?10:24)):1;
      this.vector.set(cx,cy,cz);this.camera.position.lerp(this.vector,damping);if(playing&&cameraMode==='chase'){const safe=this.safeCamera(player,this.camera.position.x,this.camera.position.y,this.camera.position.z);this.camera.position.set(safe.x,safe.y,safe.z);}this.vector.set(tx,ty,tz);if(changed)this.target.copy(this.vector);else this.target.lerp(this.vector,playing&&cameraMode==='chase'?1-Math.exp(-dt*18):1);
      if(!playing||cameraMode!=='cockpit')this.camera.up.set(0,1,0);this.camera.lookAt(this.target);const baseFov=playing&&cameraMode==='cockpit'?clamp(this.settings.fov||66,55,70):(this.settings.fov||72),fov=baseFov+(playing&&cameraMode!=='cockpit'&&this.settings.speedFov!==false?Math.min(speed*.10,6)*motion:0);if(Math.abs(this.camera.fov-fov)>.05){this.camera.fov=mix(this.camera.fov,fov,changed?1:1-Math.exp(-dt*5));this.camera.updateProjectionMatrix();}
      if(view==='garage'&&!this.inspection?.embedded){const w=this.renderer.domElement.width,h=this.renderer.domElement.height;if(this.camera.aspect<.9)this.camera.setViewOffset(w,h,0,h*.15,w,h);else this.camera.setViewOffset(w,h,-w*.20,0,w,h);}else if(this.camera.view?.enabled)this.camera.clearViewOffset();
      this.sky.position.copy(this.camera.position);this.sun.position.set(player.x-130,player.y+190,player.z+80);this.sun.target.position.set(player.x,player.y,player.z);this.sun.target.updateMatrixWorld();
      this.updateLooseBlockers?.(sim,playing);
      if(this.tunnelLight){const t=this.route.map?.tunnel,at=this.nearest(player.x,player.z),s=at.p.s,edge=20,amount=playing&&t&&!at.connector?smooth(t.start*this.route.length-edge,t.start*this.route.length+edge,s)*(1-smooth(t.end*this.route.length-edge,t.end*this.route.length+edge,s)):0;this.tunnelLight.position.set(player.x,player.y+4.3,player.z);this.tunnelLight.intensity=amount*32;for(const light of this.playerCar.userData.lamps||[])if(light.front)light.mesh.material.emissiveIntensity=Math.max(light.mesh.material.emissiveIntensity,.08+amount*.3);}
      if(this.trafficRun!==sim){this.trafficRun=sim;for(const m of this.trafficMeshes.values()){this.scene.remove(m);disposeModel(m);}this.trafficMeshes.clear();}
      const traffic=playing&&sim&&sim.traffic?sim.traffic:[],alive=new Set();
      for(const t of traffic){alive.add(t.id);const dist=(t.x-player.x)**2+(t.z-player.z)**2;let m=this.trafficMeshes.get(t.id);if(!m&&dist>=(this.effectiveRenderDistance||570)**2)continue;if(!m){const palette=['#a2aba4','#4c7376','#b38d63','#77524b','#d4ccb8','#56738c','#8e9c70'];m=createCar(t.type||'compact',palette[(t.colorIndex||0)%palette.length],false,t,this.modelDetailLevel);this.trafficMeshes.set(t.id,m);modelQuality(m,qualityRanks[this.settings.graphicsValues?.detail||this.settings.quality]??2);this.scene.add(m);}m.visible=dist<(this.effectiveRenderDistance||570)**2;if(m.visible){this.updateCar(m,t,dt);const rank=qualityRanks[this.settings.graphicsValues?.detail||this.settings.quality]??2,lod=dist>170**2?0:dist>75**2?Math.min(rank,1):rank;if(m.userData.lastLOD!==lod){modelQuality(m,lod);m.userData.lastLOD=lod;}m.userData.interior.root.visible=dist<35**2&&rank>=2;}}
      for(const [id,m] of this.trafficMeshes)if(!alive.has(id)){m.visible=false;if(playing){this.scene.remove(m);disposeModel(m);this.trafficMeshes.delete(id);}}
      this.updateOccupantEffects(sim,dt,playing);this.updateRails?.(sim,playing);this.updateBreakup?.(sim,player,dt,playing);this.updateDamageEffects(sim,player,dt,playing,cameraMode);this.updateCollisionEffects(sim,player,dt,playing);
      this.checkpoint.visible=false;if(playing&&sim&&sim.mode==='trial'&&sim.checkpoints&&sim.checkpoints.length&&sim.checkpointIndex<sim.checkpoints.length){const s=sim.checkpoints[sim.checkpointIndex],p=this.route.at(typeof s==='number'?s:s.s);this.checkpoint.position.set(p.x,p.y,p.z);this.checkpoint.rotation.y=p.yaw;this.checkpoint.visible=true;}
      this.updateLiveMirrors(dt,playing,cameraMode);const driver=this.playerCar.userData.occupants?.[0],headVisible=driver?.head.visible;if(driver&&!driver.ejected)driver.head.visible=!(playing&&cameraMode==='cockpit');try{this.renderer.render(this.scene,this.camera);}finally{if(driver)driver.head.visible=headVisible;}
    }
    dispose(){if(this.liveMirrors){this.liveMirrors.targets.forEach(t=>t.dispose());this.liveMirrors=null;}if(this.occupantFX){for(const r of this.occupantFX.ragdolls)this.disposeOccupantEffect(r);this.occupantFX.ragdolls=[];}const geometries=new Set(),materials=new Set(),textures=new Set(Object.values(this.dialTextures||{}));this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);});for(const m of materials){for(const key of['map','normalMap','roughnessMap'])if(m[key])textures.add(m[key]);m.dispose();}geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());if(this.ownsRenderer)this.renderer.dispose();}
  }
  window.DriveScene=DriveScene;
})();

