
/* Original procedural environment and bounded rendering adapter. Three.js r158. */

(function(root){'use strict';

const C=(n,a,b)=>Math.max(a,Math.min(b,n));
const projectionFov=raw=>root.PlatdoGraphics?.projectFov(raw)??Math.min(179,Math.max(1,Number(raw)||70));

class CityScene{

 constructor(canvas,world,options={}){

  const T=root.THREE;if(!T)throw new Error('The locally bundled Three.js runtime is missing.');this.T=T;this.world=world;this.canvas=canvas;this.options=options;this.disposed=false;this.meshes={people:new Map(),vehicles:new Map(),pickups:new Map()};this.peopleLODCache=new Map();this.peopleModelBuilds=0;this.detailChunks=new Map();this.detailQueue=[];this.lastChunk='';this.materials=new Map();this.geometries=new Map();this.modelDetail=5;this.signTextures=[];this.doorMeshes=new Map();this.time=0;this.lastSky=-1;this.cameraDistance=7;this.wetness=0;this.casings=[];this.casingEvents=new Set();

  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;

  this.scene=new T.Scene();this.scene.background=new T.Color('#9ecbd7');this.scene.fog=new T.Fog('#b5d4d8',650,3100);this.camera=new T.PerspectiveCamera(68,1,.08,4800);this.camera.position.set(-178,8,182);this.target=new T.Vector3();this.sun=new T.DirectionalLight('#ffe4bb',2.8);this.sun.position.set(-180,390,-210);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1536,1536);Object.assign(this.sun.shadow.camera,{left:-95,right:95,top:95,bottom:-95,near:1,far:1000});this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.035;this.scene.add(this.sun,this.sun.target);this.hemi=new T.HemisphereLight('#d8e8f0','#8d886e',2.1);this.scene.add(this.hemi);this.fill=new T.AmbientLight('#d6dbdc',.15);this.scene.add(this.fill);

  this.sun.shadow.camera.layers.enable(1);this.environment=new T.Group();this.scene.add(this.environment);this.dynamic=new T.Group();this.scene.add(this.dynamic);this.createBlood();this.createTireSmoke();this.breakup=root.CityVehicleBreakup?.create(T,this.dynamic,this.world);this.breakupTime=null;this.effects=new Map();this.targets=new Map();this.objectiveMarker=new T.Group();this.scene.add(this.objectiveMarker);this.buildTerrain();this.buildBase();this.buildWater();this.buildRain();this.buildSignals();this.buildStreetSigns();this.headlights=[];for(let i=0;i<2;i++){const light=new T.SpotLight('#fff2cf',0,55,.4,.55,1.2);this.scene.add(light,light.target);this.headlights.push(light);}this.resize();

 }

 async prepare(sim,report=()=>{}){
  const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
  this.applySettings(sim.settings||{});
  report({progress:0,label:'City districts'});await yieldTask();
  await this.prepareDistricts((progress)=>report({progress:progress*.42,label:'City districts'}));
  // Compile shared previews below; live actor rigs are allocated only when
  // their conservative bounds enter the camera view. Simulation stays intact.
  this.render(sim,0);report({progress:.46,label:'City characters'});await yieldTask();
  // All six selectable characters stay cached; changing the character card never
  // constructs another rig. Procedural future citizens remain population bounded.
  for(let i=0;i<root.CityPeople.presets.length;i++){this.previewCharacter(root.CityPeople.presets[i],0);report({progress:.46+(i+1)/root.CityPeople.presets.length*.08,label:'City characters'});await yieldTask();}
  this.endPreview();
  const fleet=root.CityVehicles.definitions;
  for(let i=0;i<fleet.length;i++){this.vehiclePreview(fleet[i].id);report({progress:.54+(i+1)/fleet.length*.30,label:'City vehicle previews'});await yieldTask();}
  const weapons=root.CityConfig.weapons.filter(w=>w.id!=='unarmed');
  for(let i=0;i<weapons.length;i++){this.weaponPreview(weapons[i].id);report({progress:.84+(i+1)/weapons.length*.08,label:'City equipment'});await yieldTask();}
  report({progress:.94,label:'City shaders'});await yieldTask();
  this.render(sim,0);
  // Include retained off-camera district materials in shader compilation without
  // making the whole city visible or leaving another renderer/context alive.
  const parked=[];for(const variants of this.preparedDistricts.values())for(const group of new Set(Object.values(variants)))if(!group.parent){parked.push(group);this.scene.add(group);}
  try{if(this.renderer.compileAsync)await this.renderer.compileAsync(this.scene,this.camera);else this.renderer.compile(this.scene,this.camera);}finally{for(const group of parked)group.removeFromParent();}
  this.prepared=true;report({progress:1,label:'City world ready'});
 }

 async prepareDistricts(report=()=>{}){
  const signature=JSON.stringify([this.graphics?.materialDetail,this.graphics?.detailFraction,this.modelDetail]);
  if(this.preparedDistrictSignature===signature){report(1);return;}
  this.clearPreparedDistricts();this.buildingsByCell=new Map();
  for(const building of this.world.buildings){const key=Math.floor(building.x/128)+','+Math.floor(building.z/128);if(!this.buildingsByCell.has(key))this.buildingsByCell.set(key,[]);this.buildingsByCell.get(key).push(building);}
  for(const group of this.detailChunks.values()){this.environment.remove(group);group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}this.detailChunks.clear();this.detailQueue=[];
  const cells=[...this.buildingsByCell],preset=this.graphics||root.CityGraphics.get(this.quality);this.preparedDistricts=new Map();
  for(let index=0;index<cells.length;index++){
   const [key,buildings]=cells[index],variants={};
   for(const kind of ['far','near']){if(kind==='near'&&!preset.materialDetail){variants.near=variants.far;continue;}const batch=this.batch(),group=new this.T.Group();group.name='prepared-district:'+key+':'+kind;group.userData.nearDetail=kind==='near';for(const building of buildings)if(kind==='near'||(root.CityConfig.hash(building.id)%100)/100<preset.detailFraction)this.buildBuilding(batch,building,true);this.bake(batch,group);group.updateMatrixWorld(true);variants[kind]=group;}
   this.preparedDistricts.set(key,variants);report((index+1)/cells.length);if(index%3===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  this.preparedDistrictSignature=signature;this.lastChunk='';
 }

 clearPreparedDistricts(){
  if(!this.preparedDistricts)return;
  for(const variants of this.preparedDistricts.values())for(const group of new Set(Object.values(variants))){group.removeFromParent();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
  this.preparedDistricts.clear();this.preparedDistrictSignature=null;this.detailChunks.clear();this.lastChunk='';
 }

 resetSession(){
  // Keep static scenery, previews, renderer, shaders and undamaged actor meshes.
  // Damaged/detached car models must not leak into a new or restored session.
  this.breakup?.clear();this.breakupTime=null;this.blood?.clear();this.bloodTime=null;this.clearTireSmoke();this.casings.forEach(s=>s.mesh.removeFromParent());this.casings=[];this.casingEvents.clear();
  for(const[id,r]of this.meshes.vehicles){const v=r.lastVehicle;if(v&&(v.health<v.maxHealth||v.destroyed||Object.values(v.damage||{}).some(n=>n>0))){r.mesh.removeFromParent();root.CityVehicleModels.dispose(r.mesh);this.meshes.vehicles.delete(id);}}
  // Match normal expiry ownership: projectile shapes/materials are shared;
  // tracer buffers, effect materials, target and cash geometry are per instance.
  for(const mesh of this.effects.values()){mesh.removeFromParent();if(!mesh.userData.projectile)mesh.children.forEach(p=>p.material.dispose());if(mesh.userData.tracer)mesh.children[0].geometry.dispose();}this.effects.clear();
  for(const map of [this.targets,this.meshes.pickups]){for(const mesh of map.values()){mesh.removeFromParent();mesh.traverse(o=>o.geometry?.dispose());}map.clear();}
  this.lastSky=-1;this.cameraDistance=7;this.playerMesh=null;
 }

 material(color,kind='matte'){

  const key=color+':'+kind;if(this.materials.has(key))return this.materials.get(key);const T=this.T,opts={color,roughness:.88,metalness:0};if(kind==='glass')Object.assign(opts,{roughness:.22,metalness:.35,color,transparent:false,opacity:1,side:T.DoubleSide});if(kind==='metal'||kind==='ramp')Object.assign(opts,{roughness:.48,metalness:.5});if(kind==='glow')Object.assign(opts,{emissive:color,emissiveIntensity:.55,roughness:.5});if(kind==='foliage'||kind==='cloth'||kind==='ramp')opts.side=T.DoubleSide;const m=new T.MeshStandardMaterial(opts);

  if(kind==='brick'||color==='#414e54'){m.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vCityWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 cityPosition = vec4(transformed,1.0);\n#ifdef USE_INSTANCING\ncityPosition=instanceMatrix*cityPosition;\n#endif\nvCityWorld=(modelMatrix*cityPosition).xyz;');shader.fragmentShader='varying vec3 vCityWorld;\n'+shader.fragmentShader;const pattern=kind==='brick'?'float cityRow=floor(vCityWorld.y/.28);vec2 cityUv=vec2(fract((vCityWorld.x+vCityWorld.z)/.74+mod(cityRow,2.0)*.5),fract(vCityWorld.y/.28));float cityMortar=smoothstep(.0,.055,cityUv.x)*smoothstep(.0,.085,cityUv.y);float cityGrain=fract(sin(dot(floor(vCityWorld*8.0),vec3(12.9898,78.233,37.719)))*43758.5453);diffuseColor.rgb*=mix(.73,.95+cityGrain*.08,cityMortar);':'float cityGrain=fract(sin(dot(floor(vCityWorld.xz*32.0),vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb*=.965+cityGrain*.065;';shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+pattern);};m.customProgramCacheKey=()=>kind==='brick'?'city-brick-v1':'city-asphalt-v1';}

  if(kind==='foliage'||kind==='cloth'){

   m.onBeforeCompile=shader=>{shader.uniforms.cityWind={value:this.time};m.userData.windUniform=shader.uniforms.cityWind;shader.vertexShader='uniform float cityWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec3 cityWindAnchor=vec3(0.0);\n#ifdef USE_INSTANCING\ncityWindAnchor=instanceMatrix[3].xyz;\n#endif\nfloat cityWindPhase=cityWind*1.2+cityWindAnchor.x*.071+cityWindAnchor.z*.053;transformed.x+=sin(cityWindPhase+position.y*2.5)*.012;transformed.z+=cos(cityWindPhase*.83+position.x*2.0)*.009;');};m.customProgramCacheKey=()=>kind+'-gentle-wind-v1';

  }

  this.materials.set(key,m);return m;

 }

 geometry(type){if(this.geometries.has(type))return this.geometries.get(type);const T=this.T;let g;if(type==='cylinder')g=new T.CylinderGeometry(.5,.5,1,[0,5,6,7,8,10][this.modelDetail]);else if(type==='cone')g=new T.ConeGeometry(.5,1,[0,4,5,6,7,8][this.modelDetail]);else if(type==='sphere')g=new T.IcosahedronGeometry(.5,this.modelDetail<=2?0:1);else if(type==='panel')g=new T.PlaneGeometry(1,1);else if(type==='frond'){const positions=[],indices=[];for(let i=0,n=[0,2,3,4,6,8][this.modelDetail];i<=n;i++){const t=i/n,width=Math.sin(Math.PI*t)*.5;positions.push(-width,.17*Math.sin(Math.PI*t)-.36*t*t,t-.5,width,.17*Math.sin(Math.PI*t)-.36*t*t,t-.5);if(i)indices.push(2*i-2,2*i,2*i-1,2*i-1,2*i,2*i+1);}g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();}else if(type==='roof'){const s=new T.Shape();s.moveTo(-.5,0);s.lineTo(.5,0);s.lineTo(0,1);s.closePath();g=new T.ExtrudeGeometry(s,{depth:1,bevelEnabled:false});g.translate(0,0,-.5);}else g=new T.BoxGeometry(1,1,1);g.userData.citySharedShape=type;this.geometries.set(type,g);return g;}

 batch(){return{parts:new Map(),signs:[]};}

 part(batch,type,color,x,y,z,w,h,d,rx=0,ry=0,rz=0,kind='matte'){

  const key=type+'|'+color+'|'+kind;if(!batch.parts.has(key))batch.parts.set(key,[]);batch.parts.get(key).push([x,y,z,w,h,d,rx,ry,rz]);

 }

 bake(batch,parent){const T=this.T,tmp=new T.Object3D(),spatial=parent===this.environment,groups=new Map(),merged=new Map();for(const[key,parts]of batch.parts){const[type,color,kind]=key.split('|'),tint=kind==='glow'||color==='#414e54'?color:'#ffffff',combined=type+'|'+tint+'|'+kind;if(!merged.has(combined))merged.set(combined,[]);for(const part of parts)merged.get(combined).push([...part,color]);}for(const [key,parts]of merged){
  // Whole-city material batches prevent frustum culling. Keep the same shared
  // geometry/materials, but group instances into spatially bounded batches.
  const sections=new Map();for(const part of parts){const cell=spatial?Math.floor(part[0]/256)+','+Math.floor(part[2]/256):'local';if(!sections.has(cell))sections.set(cell,[]);sections.get(cell).push(part);}
  for(const[cell,items]of sections){let target=parent;if(spatial){if(!groups.has(cell)){const group=new T.Group();group.name='static-cell:'+cell;groups.set(cell,group);parent.add(group);}target=groups.get(cell);}const[type,color,kind]=key.split('|'),mesh=new T.InstancedMesh(this.geometry(type),this.material(color,kind),items.length);for(let i=0;i<items.length;i++){const[x,y,z,w,h,d,rx,ry,rz,tint]=items[i];tmp.position.set(x,y,z);tmp.scale.set(w,h,d);tmp.rotation.set(rx,ry,rz);tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix);if(color==='#ffffff')mesh.setColorAt(i,new T.Color(tint));}mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();mesh.matrixAutoUpdate=false;target.add(mesh);}}
  for(const group of groups.values()){const bounds=new T.Box3().setFromObject(group);this.trackStatic(group,bounds);}return parent;}

 trackStatic(object,bounds){if(!bounds||bounds.isEmpty())return;this.staticRanges??=[];this.staticRanges.push({object,minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z});}

 cullStatic(position){const distance=this.graphics?.distance||4800;for(const r of this.staticRanges||[]){const dx=Math.max(r.minX-position.x,0,position.x-r.maxX),dz=Math.max(r.minZ-position.z,0,position.z-r.maxZ),margin=r.object.visible?32:0;r.object.visible=dx*dx+dz*dz<(distance+margin)*(distance+margin);}}

 box(b,c,x,y,z,w,h,d,ry=0,kind='matte'){this.part(b,'box',c,x,y,z,w,h,d,0,ry,0,kind);}

 cylinder(b,c,x,y,z,r,h,ry=0){this.part(b,'cylinder',c,x,y,z,r*2,h,r*2,0,ry);}

 buildTerrain(){const T=this.T,step=20,n=200,paths=this.world.roads.filter(r=>r.pathId),fine=new Set(),key=(x,z)=>x+','+z;

  for(const r of paths){const pad=r.width/2+42;for(let x=Math.max(0,Math.floor((Math.min(r.a.x,r.b.x)-pad+2000)/step));x<=Math.min(n-1,Math.floor((Math.max(r.a.x,r.b.x)+pad+2000)/step));x++)for(let z=Math.max(0,Math.floor((Math.min(r.a.z,r.b.z)-pad+2000)/step));z<=Math.min(n-1,Math.floor((Math.max(r.a.z,r.b.z)+pad+2000)/step));z++)fine.add(key(x,z));}

  const positions=[],colors=[],indices=[],vertices=new Map(),vertex=(x,z)=>{const k=key(x,z);if(vertices.has(k))return vertices.get(k);let y=this.world.terrainHeight(x,z);for(const r of paths){if(x<Math.min(r.a.x,r.b.x)-r.width||x>Math.max(r.a.x,r.b.x)+r.width||z<Math.min(r.a.z,r.b.z)-r.width||z>Math.max(r.a.z,r.b.z)+r.width)continue;const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,t=C(((x-r.a.x)*dx+(z-r.a.z)*dz)/(dx*dx+dz*dz),0,1);if(Math.hypot(x-r.a.x-dx*t,z-r.a.z-dz*t)<r.width/2+2.8){y-=.16;break;}}

  const shore=root.CityWorld.landHeight(x,z),color=new T.Color(shore<0?'#8b9e8c':shore<2.5?'#d4c294':z<-450?(y>48?'#718476':'#819575'):x>800?'#8a9b7d':'#929a88');color.multiplyScalar(.97+.03*Math.sin(x*.032)*Math.cos(z*.021));const id=positions.length/3;positions.push(x,y,z);colors.push(color.r,color.g,color.b);vertices.set(k,id);return id;};

  for(let ix=0;ix<n;ix++)for(let iz=0;iz<n;iz++){const x=-2000+ix*step,z=-2000+iz*step;if(fine.has(key(ix,iz))){for(let a=0;a<5;a++)for(let b=0;b<5;b++){const px=x+a*4,pz=z+b*4,v=[vertex(px,pz),vertex(px+4,pz),vertex(px+4,pz+4),vertex(px,pz+4)];indices.push(v[0],v[2],v[1],v[0],v[3],v[2]);}}else{const ring=[],edges=[[0,0,1,0,ix,iz-1],[20,0,0,1,ix+1,iz],[20,20,-1,0,ix,iz+1],[0,20,0,-1,ix-1,iz]];for(const[ox,oz,dx,dz,nx,nz]of edges){const count=fine.has(key(nx,nz))?5:1;for(let j=0;j<count;j++)ring.push(vertex(x+ox+dx*j*20/count,z+oz+dz*j*20/count));}const center=vertex(x+10,z+10);for(let j=0;j<ring.length;j++)indices.push(center,ring[(j+1)%ring.length],ring[j]);}}

  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  // Share terrain vertex buffers across bounded index chunks. The authoritative
  // graded surface is unchanged, including fine road edges and all collisions.
  const cells=new Map(),material=new T.MeshStandardMaterial({vertexColors:true,roughness:1}),group=new T.Group();group.name='terrain-graded';for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,key=Math.floor((positions[a]+positions[b]+positions[c])/768)+','+Math.floor((positions[a+2]+positions[b+2]+positions[c+2])/768);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(indices[i],indices[i+1],indices[i+2]);}
  for(const[key,list]of cells){const geo=new T.BufferGeometry();for(const name of ['position','normal','color'])geo.setAttribute(name,g.attributes[name]);geo.setIndex(list);const bounds=new T.Box3();for(const i of list)bounds.expandByPoint(new T.Vector3(positions[i*3],positions[i*3+1],positions[i*3+2]));geo.boundingBox=bounds;geo.boundingSphere=bounds.getBoundingSphere(new T.Sphere());const mesh=new T.Mesh(geo,material);mesh.name='terrain:'+key;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;group.add(mesh);this.trackStatic(mesh,bounds);}this.environment.add(group);this.terrain=group;

 }

 roadBox(batch,road,width,height,offset,color,lateral=0,trimA=0,trimB=0){const a=road.a,b=road.b,dx=b.x-a.x,dz=b.z-a.z,dy=b.y-a.y,len=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),pitch=-Math.atan2(dy,len),t=.5+(trimA-trimB)/(2*len);if(len<=trimA+trimB)return;this.part(batch,'box',color,a.x+dx*t-dz/len*lateral,a.y+dy*t+offset,a.z+dz*t+dx/len*lateral,width,height,Math.hypot(len,dy)*(1-(trimA+trimB)/len),pitch,yaw);}

 buildRoadSurface(b,r){const junctionTrim=n=>n.links.length>=3?Math.max(...n.links.map(l=>this.world.roads.find(r=>r.id===l.road).width/2))+2.7:0,a=junctionTrim(r.a),c=junctionTrim(r.b);this.roadBox(b,r,r.width,.1,-.05,'#414e54');for(const side of[-1,1]){this.roadBox(b,r,2.7,.15,.045,'#b8b6a9',side*(r.width/2+1.35),a,c);this.roadBox(b,r,.18,.18,.03,'#ded9c6',side*(r.width/2+.09),a,c);this.roadBox(b,r,.10,.014,.015,'#e5e3ce',side*(r.width/2-.48),a+3,c+3);}}

 roadFurniture(b,r){if(r.length<25)return;const len=r.length,tx=(r.b.x-r.a.x)/len,tz=(r.b.z-r.a.z)/len,yaw=Math.atan2(tx,tz),pitch=-Math.atan2(r.b.y-r.a.y,len);for(let along=18;along<len-14;along+=18){const x=r.a.x+tx*along,z=r.a.z+tz*along,y=r.a.y+(r.b.y-r.a.y)*along/len;for(const side of[-1,1]){const off=side*(r.width/2+1.3);this.part(b,'box','#929b95',x-tz*off,y+.121,z+tx*off,2.45,.006,.028,pitch,yaw);if(Math.floor(along/18)%3===1){const curb=side*(r.width/2-.36),xx=x-tz*curb,zz=z+tx*curb;this.part(b,'box','#344b50',xx,y+.009,zz,.48,.008,.9,pitch,yaw);for(let n=-2;n<=2;n++)this.part(b,'box','#899992',xx+tx*n*.15,y+.016,zz+tz*n*.15,.45,.008,.04,pitch,yaw);}}}const cx=(r.a.x+r.b.x)/2,cz=(r.a.z+r.b.z)/2,cy=(r.a.y+r.b.y)/2;this.cylinder(b,'#536267',cx,cy+.006,cz,.37,.008);}

 buildCrossings(b){const roads=new Map(this.world.roads.map(r=>[r.id,r])),nodes=new Map(this.world.nodes.map(n=>[n.id,n])),way=r=>r.pathId||r.bridgeId||r.name;

  // Follow the authored curve instead of extrapolating its first short sample.

  const along=(origin,link,distance)=>{let a=origin,r=roads.get(link.road),end=nodes.get(link.to),remaining=distance;for(let count=0;count<60;count++){const len=Math.hypot(end.x-a.x,end.z-a.z);if(remaining<=len||end.links.length!==2){const f=Math.min(1,remaining/len);return{x:a.x+(end.x-a.x)*f,y:a.y+(end.y-a.y)*f,z:a.z+(end.z-a.z)*f,dx:(end.x-a.x)/len,dz:(end.z-a.z)/len,slope:(end.y-a.y)/len};}remaining-=len;const next=end.links.find(l=>l.to!==a.id);a=end;end=nodes.get(next.to);r=roads.get(next.road);}return null;};

  const inOtherRoad=(p,own)=>this.world.roads.some(r=>{if(way(r)===own||Math.abs((r.a.y+r.b.y)/2-p.y)>.8)return false;const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,t=C(((p.x-r.a.x)*dx+(p.z-r.a.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(p.x-r.a.x-dx*t,p.z-r.a.z-dz*t)<r.width/2+.25;});

  for(const n of this.world.nodes){if(n.links.length<3||n.layer!=='ground')continue;const half=Math.max(...n.links.map(l=>roads.get(l.road).width/2));for(const link of n.links){const r=roads.get(link.road);let offset=half+1.2,p=along(n,link,offset);if(r.pathId)for(;offset<42;offset+=2){p=along(n,link,offset);if(!p)break;const clear=[-.45,-.225,0,.225,.45].every(side=>!inOtherRoad({...p,x:p.x-p.dz*r.width*side,z:p.z+p.dx*r.width*side},way(r)));if(clear)break;}if(!p||offset>=42)continue;const yaw=Math.atan2(p.dx,p.dz),pitch=-Math.atan(p.slope);for(let s=-r.width/2+1.2;s<r.width/2-1;s+=1.15)this.part(b,'box','#e5e3ce',p.x-p.dz*s,p.y+.024,p.z+p.dx*s,.60,.018,2.6,pitch,yaw);const stop=along(n,link,offset+2.4);if(stop)this.part(b,'box','#e5e3ce',stop.x,stop.y+.025,stop.z,r.width-1.5,.016,.22,-Math.atan(stop.slope),Math.atan2(stop.dx,stop.dz));}}

 }

 // Bridge deck, markings and edges share the authoritative curved centerline.

 buildCurvedBridges(batch){const T=this.T,junctions=this.world.nodes.filter(n=>n.layer==='ground'&&n.links.length>=3);

  const cutPolygon=(polygon,plane,inside)=>{const output=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=plane(a),db=plane(b),keepA=inside?da>=-.00001:da<=.00001,keepB=inside?db>=-.00001:db<=.00001;if(keepA)output.push(a);if(keepA!==keepB){const t=da/(da-db);output.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}}return output;};

  const masksFor=(bridge)=>this.world.roads.filter(r=>(r.pathId||r.bridgeId)!==bridge.id&&junctions.some(n=>n.links.some(l=>bridge.roadIds.includes(l.road))&&Math.hypot((r.a.x+r.b.x)/2-n.x,(r.a.z+r.b.z)/2-n.z)<55)).map(r=>{const tx=(r.b.x-r.a.x)/r.length,tz=(r.b.z-r.a.z)/r.length,ja=r.jointA||{x:tx,z:tz},jb=r.jointB||{x:tx,z:tz},half=r.width/2+.035;return{minX:Math.min(r.a.x,r.b.x)-r.width,maxX:Math.max(r.a.x,r.b.x)+r.width,minZ:Math.min(r.a.z,r.b.z)-r.width,maxZ:Math.max(r.a.z,r.b.z)+r.width,y:(r.a.y+r.b.y)/2,planes:[p=>(p.x-r.a.x)*ja.x+(p.z-r.a.z)*ja.z,p=>-(p.x-r.b.x)*jb.x-(p.z-r.b.z)*jb.z,p=>half+(p.x-r.a.x)*tz-(p.z-r.a.z)*tx,p=>half-(p.x-r.a.x)*tz+(p.z-r.a.z)*tx]};});

  for(const bridge of [...(this.world.bridges||[]),...(this.world.roadPaths||[])]){

   const points=bridge.points,total=[0],frames=points.map((p,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],ax=p.x-prev.x,az=p.z-prev.z,bx=next.x-p.x,bz=next.z-p.z,al=Math.hypot(ax,az)||1,bl=Math.hypot(bx,bz)||1;let nx=-(i?az/al:bz/bl)-(i<points.length-1?bz/bl:az/al),nz=(i?ax/al:bx/bl)+(i<points.length-1?bx/bl:ax/al),length=Math.hypot(nx,nz)||1;nx/=length;nz/=length;const divisor=Math.max(.8,i<points.length-1?nx*(-bz/bl)+nz*(bx/bl):1);if(i)total.push(total[i-1]+Math.hypot(ax,az));return{nx:nx/divisor,nz:nz/divisor};});

   const offset=(i,side,y=0)=>({x:points[i].x+frames[i].nx*side,y:points[i].y+y,z:points[i].z+frames[i].nz*side});

   const masks=masksFor(bridge);

   const ribbon=(name,lo,hi,top,bottom,color)=>{const positions=[],indices=[],solid=bottom!==null,trim=/^(walk|curb|edge-line):/.test(name),emit=polygon=>{const base=positions.length/3;for(const p of polygon)positions.push(p.x,p.y,p.z);for(let i=1;i<polygon.length-1;i++)indices.push(base,base+i,base+i+1);},face=polygon=>{let pieces=[polygon];if(trim)for(const mask of masks){const relevant=polygon.some(p=>p.x>=mask.minX&&p.x<=mask.maxX&&p.z>=mask.minZ&&p.z<=mask.maxZ&&Math.abs(p.y-mask.y)<3);if(!relevant)continue;const outside=[];for(const piece of pieces){let remaining=piece;for(const plane of mask.planes){const part=cutPolygon(remaining,plane,false);if(part.length>=3)outside.push(part);remaining=cutPolygon(remaining,plane,true);if(remaining.length<3)break;}}pieces=outside;if(!pieces.length)break;}for(const piece of pieces)emit(piece);};

    for(let i=1;i<points.length;i++){const a=offset(i-1,lo,top),b=offset(i-1,hi,top),c=offset(i,lo,top),d=offset(i,hi,top);face([a,b,d,c]);if(solid){const e=offset(i-1,lo,bottom),f=offset(i-1,hi,bottom),g=offset(i,lo,bottom),h=offset(i,hi,bottom);face([e,g,h,f]);face([a,c,g,e]);face([b,f,h,d]);if(i===1)face([a,e,f,b]);if(i===points.length-1)face([c,d,h,g]);}}

    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new T.Mesh(g,this.material(color));mesh.name=(bridge.supports?'bridge:':'road:')+bridge.id+':'+name;mesh.castShadow=mesh.receiveShadow=true;this.environment.add(mesh);};

   const half=bridge.width/2,walk=bridge.sidewalkWidth||2.8,rail=bridge.railOffset||half+walk+.3;

   ribbon('deck',-half-walk,half+walk,-.1,-(bridge.deckDepth||.65),'#87918c');

   ribbon('asphalt',-half,half,0,null,'#414e54');

   for(const side of[-1,1]){const lo=side<0?-half-walk:half,hi=side<0?-half:half+walk;ribbon('walk:'+side,lo,hi,.12,-.1,'#b8b6a9');ribbon('curb:'+side,side*half-.09,side*half+.09,.14,0,'#ded9c6');ribbon('edge-line:'+side,side*(half-.48)-.055,side*(half-.48)+.055,.012,null,'#e5e3ce');}

   const beam=(a,b,width,height,color)=>{const delta=new T.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),length=delta.length();if(!length)return;const e=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),delta.normalize()));this.part(batch,'box',color,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,width,height,length,e.x,e.y,e.z,'metal');};

   const at=(distance,side=0,y=0)=>{let i=1;while(i<total.length-1&&total[i]<distance)i++;const f=(distance-total[i-1])/(total[i]-total[i-1]),a=offset(i-1,side,y),b=offset(i,side,y);return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f};};

   const length=total[total.length-1];for(let d=10;d<length-12;d+=16){const p=at(d,0,.016);if(junctions.some(n=>Math.hypot(p.x-n.x,p.z-n.z)<18&&Math.abs(p.y-n.y)<1))continue;beam(p,at(Math.min(d+5,length),0,.016),.18,.018,'#d7c784');}

   if(!bridge.supports)continue;

   // Open ends join the junctions; outer parapets leave continuous sidewalks.

   for(const side of[-1,1]){for(let i=1;i<points.length-2;i++){beam(offset(i,side*rail,.34),offset(i+1,side*rail,.34),.28,.68,'#8a9c9a');beam(offset(i,side*rail,1.08),offset(i+1,side*rail,1.08),.26,.16,'#d5dacf');}for(let d=18;d<length-18;d+=6){const p=at(d,side*rail,.74);this.box(batch,'#657f82',p.x,p.y,p.z,.16,.65,.16,0,'metal');}for(let d=46;d<length-40;d+=76){const p=at(d,side*(bridge.lightOffset||half+walk));this.box(batch,'#557277',p.x,p.y+3.7,p.z,.16,7.4,.16,0,'metal');this.box(batch,'#dce5d8',p.x,p.y+7.35,p.z,.55,.12,.55,0,'glow');}}

   for(const support of bridge.supports||[]){const i=support.pointIndex,p=points[i],height=support.deckY-support.y-(bridge.deckDepth||.65);this.box(batch,'#8f9c94',support.x,support.y+height/2,support.z,3,height,9);const left=offset(i,-rail,-1),right=offset(i,rail,-1);beam(left,right,1.1,1.2,'#7f918e');}

   if(bridge.kind==='cable-bridge')for(const fraction of[.3,.7]){const index=Math.round((points.length-1)*fraction),base=points[index];for(const side of[-1,1]){const foot=offset(index,side*(rail+.4)),top={...foot,y:base.y+32};beam({...foot,y:base.y-1},top,1.35,1.35,'#5b7b81');for(const step of[-12,-9,-6,-3,3,6,9,12]){const j=index+step;if(j>2&&j<points.length-3)beam(top,offset(j,side*rail,1.1),.085,.085,'#c5d3ce');}}beam(offset(index,-rail-.4,29),offset(index,rail+.4,29),1.15,1.15,'#5b7b81');}

   else for(const support of bridge.supports||[]){const i=support.pointIndex;for(const side of[-1,1]){const base=offset(i,side*rail,-2.2);for(const direction of[-1,1]){const j=i+direction*3;if(j>0&&j<points.length-1)beam(base,offset(j,side*rail,-.72),.8,.8,'#71908b');}}}

  }

 }

 buildBase(){const b=this.batch(),T=this.T,w=this.world;

  for(const r of w.roads){if(r.layer==='bridge'&&w.bridges?.length||r.pathId&&w.roadPaths?.length)continue;this.buildRoadSurface(b,r);this.roadFurniture(b,r);const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,len=r.length,n=Math.floor(len/16),yaw=Math.atan2(dx,dz),pitch=-Math.atan2(r.b.y-r.a.y,len);for(let i=1;i<n;i++){const t=i/n;this.part(b,'box','#d7c784',r.a.x+dx*t,r.a.y+(r.b.y-r.a.y)*t+.016,r.a.z+dz*t,.18,.018,5,pitch,yaw);}}

  this.buildCurvedBridges(b);

  this.buildCrossings(b);

  for(const building of w.buildings)this.buildBuilding(b,building,false);

  for(const p of w.props)if(!p.breakable)this.buildProp(b,p,false);

  const rw=w.runway;this.box(b,'#3c484c',rw.x,rw.y-.06,rw.z,rw.width,.12,rw.length);for(let z=rw.z-rw.length/2+25;z<rw.z+rw.length/2-20;z+=36)this.box(b,'#efe9d7',rw.x,rw.y+.015,z,.5,.02,16);for(const z of[rw.z-rw.length/2+17,rw.z+rw.length/2-17])for(let i=-5;i<=5;i++)this.box(b,'#e4e4d6',rw.x+i*2.2,rw.y+.015,z,1.3,.02,15);for(const side of[-1,1])this.box(b,'#ecebdc',rw.x+(rw.width/2-1.4)*side,rw.y+.015,rw.z,.35,.02,rw.length-5);this.box(b,'#8d958d',1095,2.46,-120,170,.08,330);for(let z=-265;z<30;z+=25)this.box(b,'#e1c475',1140,2.59,z,.25,.02,17);

  for(const j of w.jumps)this.buildRamp(b,j);

  this.bake(b,this.environment);this.buildBreakables();

  for(const s of w.services){const tex=this.sign(s.name,s.signSubtitle||(s.type==='safehouse'?'HOME':s.type.toUpperCase()));const mesh=new T.Mesh(new T.PlaneGeometry(Math.min(s.w-1,s.type==='safehouse'?7:18),s.type==='safehouse'?.82:1.7),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));mesh.position.set(s.x,s.y+(s.type==='hangar'?13:s.type==='garage'?5.6:3.6),s.z+s.d/2+(s.shopKind?.50:.3));this.environment.add(mesh);const d=w.doors.find(d=>d.serviceId===s.id);const doorMesh=new T.Mesh(new T.BoxGeometry(d.w,d.h,.12),this.material(['garage','hangar','warehouse'].includes(s.type)?'#81938e':'#66908d','metal'));const pivot=new T.Group();pivot.position.set(d.x-d.w/2,d.y,d.z+.12);doorMesh.position.set(d.w/2,d.h/2,0);pivot.add(doorMesh);const doorBatch=this.batch(),industrial=['garage','hangar','warehouse'].includes(s.type);if(industrial){for(let yy=.4;yy<d.h;yy+=.5)this.box(doorBatch,'#60777a',d.w/2,yy,.065,d.w-.15,.045,.025);}else{this.box(doorBatch,'#304e58',d.w/2,d.h*.64,.067,d.w*.60,d.h*.44,.02,0,'glass');for(const xx of[d.w*.19,d.w*.81])this.box(doorBatch,'#bec7bb',xx,d.h*.64,.071,.06,d.h*.48,.02);this.box(doorBatch,'#c9c0a3',d.w*.83,d.h*.40,.075,.06,.25,.025);}this.bake(doorBatch,pivot);pivot.rotation.y=-Math.PI/2;this.environment.add(pivot);this.doorMeshes.set(d.id,pivot);}

  this.buildShopDisplays();

 }

 buildShopDisplays(){

  const T=this.T,P=root.CityPeopleModels,A=root.CityPeople;if(!P||!A)return;this.shopDisplays=[];

  const label=(group,title,subtitle,x,y,z,width=6,height=.85)=>{const m=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:this.sign(title,subtitle),side:T.DoubleSide}));m.position.set(x,y,z);group.add(m);};

  for(const service of this.world.services.filter(s=>s.shopKind)){

   const g=new T.Group();g.name='shop-displays:'+service.id;g.position.set(service.x,service.y,service.z);g.userData.serviceId=service.id;g.userData.models=[];this.environment.add(g);this.shopDisplays.push(g);

   label(g,service.name,service.signSubtitle,0,3.45,-service.d/2+.28,service.w*.72,1.25);

   const stands=service.furnishings.filter(f=>f.kind==='mannequin'||f.kind==='armorstand');

   stands.forEach((f,i)=>{const a={...A.presets[i%3],id:service.id+'-display-'+i,accessory:0,hat:i===0?3:0,upper:[0,3,6][i],lower:[0,1,4][i],shoe:[0,3,1][i],topColor:['#d7b28b','#557b7b','#a67d65'][i],topAccentColor:'#e4d5b6',topPattern:['stripe','chevron','plain'][i]};if(service.shopKind==='equipment'){Object.assign(a,{upper:0,lower:1,hat:0,topColor:'#c8c5b2',armorVest:['simple','reinforced','swat'][i]});}a.appearanceKey=A.appearanceKey(a);const model=P.create(a,{lod:0});model.name='shop-'+f.kind+':'+(a.armorVest||i);P.animate(model,{mode:'idle',speed:0,weapon:null},0,0);model.position.set(f.x-service.x,.28,f.z-service.z);model.rotation.y=(i-1)*-.15;g.add(model);g.userData.models.push(model);if(service.shopKind==='equipment')label(g,['Simple vest','Reinforced vest','SWAT vest'][i],'ARMOR',f.x-service.x,2.6,f.z-service.z,2.8,.45);});

   if(service.shopKind==='clothing'){

    label(g,'HEADWEAR','CAPS · BEANIES',-9,2.9,-9,4.5,.6);label(g,'FOOTWEAR','SHOES · BOOTS',8,2.8,-1,4.5,.6);label(g,'Everyday layers','TEES · HOODIES · JACKETS',-8,2.55,0,5.5,.7);

   }else{

    const board=service.furnishings.find(f=>f.kind==='weaponboard');

    for(const [i,id]of ['swift','kestrel','ridgeline','breakwater','horizon','comet'].entries()){

     // Same weapon meshes as held in gameplay, displayed broadside on brackets.

     const gun=P.weaponModel(id);gun.name='shop-weapon:'+id;gun.rotation.y=Math.PI/2;gun.scale.setScalar(1.45);gun.position.set(board.x-service.x-3.3+(i%3)*3.15,1.0+Math.floor(i/3)*1.1,board.z-service.z+.65);g.add(gun);g.userData.models.push(gun);

    }

    label(g,'AMMUNITION','ROUNDS · SHELLS · ROCKETS',-9,2.9,3,5.2,.7);

    label(g,'WEAPONS','FIELD SUPPLY',3.5,3.6,-8.4,7,.6);

    const caseGun=P.weaponModel('swift');caseGun.name='shop-weapon:counter';caseGun.rotation.y=Math.PI/2;caseGun.position.set(8,1.18,4.7);g.add(caseGun);g.userData.models.push(caseGun);const glass=new T.Mesh(new T.BoxGeometry(4.18,.43,1.48),new T.MeshStandardMaterial({color:'#9ac5c6',transparent:true,opacity:.12,roughness:.18,metalness:.10,depthWrite:false}));glass.name='shop-glass-case';glass.position.set(8,1.24,4.7);g.add(glass);

   }

  }

 }

 buildRamp(batch,j){const T=this.T,positions=[],indices=[];const face=(a,b,c,d)=>{const n=positions.length/3;for(const p of[a,b,c,d])positions.push(p.x,p.y,p.z);indices.push(n,n+2,n+1,n,n+3,n+2);};for(let i=1;i<j.profile.length;i++){const a=j.profile[i-1],b=j.profile[i],x=j.width/2;face({...a,x:a.x-x},{...a,x:a.x+x},{...b,x:b.x+x},{...b,x:b.x-x});face({...a,x:a.x-x,y:a.y-j.deckThickness},{...b,x:b.x-x,y:b.y-j.deckThickness},{...b,x:b.x+x,y:b.y-j.deckThickness},{...a,x:a.x+x,y:a.y-j.deckThickness});for(const side of[-1,1])face({...a,x:a.x+side*x},{...b,x:b.x+side*x},{...b,x:b.x+side*x,y:b.y-j.deckThickness},{...a,x:a.x+side*x,y:a.y-j.deckThickness});}for(const p of[j.profile[0],j.profile.at(-1)])face({...p,x:p.x-j.width/2},{...p,x:p.x-j.width/2,y:p.y-j.deckThickness},{...p,x:p.x+j.width/2,y:p.y-j.deckThickness},{...p,x:p.x+j.width/2});const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new T.Mesh(geo,this.material('#6d797b','ramp'));mesh.name=j.id+':authoritative-deck';mesh.castShadow=mesh.receiveShadow=true;this.environment.add(mesh);

  for(const c of j.structure){if(c.floor&&!c.structure)continue;if(c.span){const q=c.span,mid=(q.startU+q.endU)/2;this.part(batch,'box','#455d63',q.x+q.tx*mid,q.y+q.slope*mid+(q.base+q.top)/2,q.z+q.tz*mid,q.halfWidth*2,q.top-q.base,Math.hypot(q.endU-q.startU,q.slope*(q.endU-q.startU)),-Math.atan(q.slope),Math.atan2(q.tx,q.tz),0,'metal');}else this.box(batch,'#455d63',c.x,c.y+c.h/2,c.z,c.w,c.h,c.d,0,'metal');}

  for(let z=j.z-j.length/2+1;z<j.z+j.length/2-.15;z+=.75){const a=this.world.rampHeight(j,z),slope=(this.world.rampHeight(j,z+.05)-a)/.05;for(const side of[-1,1])this.part(batch,'box','#e3bf63',j.x+side*(j.width/2-.15),a+.009,z,.12,.012,.34,-Math.atan(slope),0);this.part(batch,'box','#879296',j.x,a+.006,z,j.width-.6,.009,.035,-Math.atan(slope),0);}

 }

 // Essential construction remains at every LOD. Optional facade detail adds

 // upper storeys; it never substitutes the basic street-facing architecture.

 buildingConstruction(b,s){const{x,y,z,w,d,h,style}=s,trim='#d3c6af',metal='#536871',glass='#547582',bay=s.bays||Math.max(3,Math.floor(w/5));for(const side of[-1,1]){const face=z+side*(d/2+(s.shopKind?.30:.15));for(let i=0;i<bay;i++){const xx=x-w/2+(i+.5)*w/bay;if(s.interior&&side===1&&Math.abs(xx-x)<s.doorWidth/2+.6)continue;this.box(b,glass,xx,y+1.65,face,w/bay*.68,2.2,.06,0,'glass');for(const k of[-1,1])this.box(b,trim,xx+k*w/bay*.36,y+1.65,face+side*.025,.10,2.45,.10);this.box(b,metal,xx,y+2.86,face+side*.04,w/bay*.77,.12,.13);this.box(b,trim,xx,y+.49,face+side*.035,w/bay*.77,.14,.12);}for(let xx=x-w/2+.18;xx<x+w/2;xx+=w/Math.max(2,Math.round(w/8)))this.box(b,style==='industrial'?metal:trim,xx,y+h/2,face,.18,h,.13);}

  for(const side of[-1,1])for(let zz=z-d/2+3;zz<z+d/2-2;zz+=5){this.box(b,glass,x+side*(w/2+.16),y+2,zz,.07,1.8,2.7,0,'glass');this.box(b,trim,x+side*(w/2+.20),y+1.02,zz,.13,.12,2.92);}

  const rows=Math.min(14,Math.floor((h-3.5)/3.5)),bays=s.bays||Math.floor(w/4.5),bayW=w/bays;

  for(const side of[-1,1])for(let row=0;row<rows;row++){for(let col=0;col<bays;col++){const xx=x-w/2+(col+.5)*bayW,zz=z+side*(d/2+(s.interior?.31:style==='tower'?.22:.04)),lit=((col*17+row*13+(s.tint||0)*7)%9)<3;this.part(b,'panel',lit?'#d0bf83':'#476e7c',xx,y+5+row*3.5,zz,bayW*.56,1.7,1,0,side<0?Math.PI:0,0,lit?'glow':'glass');}for(let col=0;col<Math.floor(d/5.4);col++){const zz=z-d/2+(col+.5)*d/Math.floor(d/5.4);this.part(b,'panel','#547783',x+side*(w/2+(s.interior?.31:style==='tower'?.22:.045)),y+5+row*3.5,zz,2.3,1.7,1,0,side*Math.PI/2,0,'glass');}if(style==='tower'){this.box(b,'#a4b9b7',x,y+3.7+row*3.5,z+side*(d/2+.23),w+.35,.10,.08);this.box(b,'#a4b9b7',x+side*(w/2+.23),y+3.7+row*3.5,z,.08,.10,d+.35);}}

  if(!s.interior){for(const side of[-1,1])this.box(b,metal,x+side*w*.36,y+h+.42,z,w*.12,.42,d*.6);if(style==='industrial'){for(let zz=z-d*.3;zz<=z+d*.31;zz+=d*.3)this.box(b,'#879b9b',x,y+h+.3,zz,w*.62,.3,.75,0,'glass');}else if(style==='tower'){for(const side of[-1,1])for(let k=-1;k<=1;k++)this.box(b,'#bdc9c5',x+side*(w/2+.18),y+h*.53,z+k*d*.29,.10,h*.76,.20,0,'metal');}else{this.box(b,'#736c61',x-w*.25,y+h+(style==='townhouse'||s.roof===1?2.15:.8),z-d*.25,.8,1.6,.85);this.box(b,trim,x-w*.25,y+h+(style==='townhouse'||s.roof===1?2.99:1.64),z-d*.25,1,.15,1.05);}}

 }

 buildArchitecture(batch,s,detail){
  const a=s.architecture,style=s.style;
  const palettes={brick:['#a97155','#b47d65','#975f4d','#ba9279','#936953'],tower:['#748d92','#809a9e','#657e87','#9aa9a6','#789596'],townhouse:['#a47162','#b6987a','#967563','#bc9778','#a9907b'],industrial:['#7f8d87','#999b8b','#62777b','#998e74','#718183'],coast:['#d8ccb0','#c5c6af','#e0d6ba','#c8b9a6','#b9c9bd']};
  const wall=(palettes[style]||palettes.brick)[s.tint||0],trim=style==='tower'?'#b3c1bb':style==='industrial'?'#6e7978':'#d2c3a4';
  const colors={wall,roof:style==='industrial'?'#5f6e72':style==='coast'?'#a98069':'#655f58',trim,metal:'#4c6267',accent:['#597b70','#8d664e','#bd995c','#486874'][a.ordinal%4]};
  if(!detail)for(const p of a.parts){
   const color=colors[p.role]||wall;
   if(p.type==='gable')this.part(batch,'roof',color,s.x+p.x,s.y+p.y,s.z+p.z,p.w,p.h,p.d,0,0,0,'matte');
   else this.box(batch,color,s.x+p.x,s.y+p.y+p.h/2,s.z+p.z,p.w,p.h,p.d,0,p.role==='wall'&&style!=='tower'?'brick':p.role==='metal'?'metal':'matte');
  }
  if(s.interior)return;
  const front=a.volumes[0],doorX=front.x+(a.entry-1)*front.w*.10;
  const place=(f,color,along,yy,ww,hh,depth=.07,out=.055,material='matte')=>{
   const x=s.x+f.x+(f.axis==='z'?along:f.side*out),z=s.z+f.z+(f.axis==='x'?along:f.side*out);
   this.box(batch,color,x,s.y+yy,z,f.axis==='z'?ww:depth,hh,f.axis==='x'?ww:depth,0,material);
  };
  const exposed=(f,along,yy,width=0)=>{
   for(const t of[-.48,0,.48]){
    const x=f.x+(f.axis==='z'?along+width*t:f.side*.13),z=f.z+(f.axis==='x'?along+width*t:f.side*.13);
    if(a.volumes.some((v,i)=>i!==f.volume&&x>v.x-v.w/2-.015&&x<v.x+v.w/2+.015&&z>v.z-v.d/2-.015&&z<v.z+v.d/2+.015&&yy>v.y-.02&&yy<v.y+v.h+.15))return false;
   }return true;
  };
  for(const f of a.faces){
   const cols=Math.max(1,Math.floor(f.w/a.bayWidth)),bay=f.w/cols,rows=Math.max(1,Math.min(16,Math.floor(f.h/a.storeyHeight))),storey=f.h/rows;
   for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const along=-f.w/2+(col+.5)*bay,yy=f.y+(row+.5)*storey;
    const isDoor=f.volume===0&&f.axis==='z'&&f.side===1&&row===0&&Math.abs(f.x+along-doorX)<bay*.65;
    const rhythm=(col+row*(a.rhythm===2?1:0)+a.ordinal)%5;
    if(!exposed(f,along,yy,bay*.83))continue;
    const windowW=style==='tower'&&a.facade!=='punched'?bay*(a.facade==='vertical'?.66:.96):Math.min(bay*.82,bay*a.windowRatio*(a.rhythm===1&&col%2===0?1.30:1)),windowH=style==='tower'&&a.facade!=='punched'?storey*(a.facade==='ribbon'?.67:.95):Math.min(style==='industrial'?2.5:2.05,storey*.67);
    const glass=(row+col*3+a.ordinal)%11<2?'#979c87':style==='tower'?'#4b6c78':'#3f5b62';
    if(!detail){
     if(isDoor){
      place(f,'#293f42',along,f.y+1.30,Math.min(bay*.7,2.5),2.6,.09,.06);
      place(f,trim,along,f.y+2.65,Math.min(bay*.86,2.9),.16,.12,.12);
      place(f,'#bda97e',along+Math.min(bay*.22,.65),f.y+1.25,.07,.35,.09,.13);
     }else if(style==='industrial'&&row===0&&col%3!==2){
      place(f,'#4b5e60',along,yy,bay*.80,storey*.84,.09,.05,'metal');
      for(let rib=0;rib<3;rib++)place(f,'#86938c',along,yy-windowH*.38+rib*windowH*.38,bay*.79,.06,.10,.11);
     }else{
      place(f,glass,along,yy,windowW,windowH,.065,.045,'glass');
      // Deeply readable rhythm remains at base LOD; only tiny frames stream with distance.
      if(style==='tower'&&a.facade==='vertical'&&col%2===0)place(f,trim,along+bay*.42,yy,.16,storey,.10,.10);
      if(style==='brick'||style==='townhouse')place(f,trim,along,yy+windowH/2+.13,windowW+.24,.20,.15,.12);
      if(style==='coast'||a.rhythm===3)for(const side of[-1,1])place(f,colors.accent,along+side*(windowW/2+.16),yy,.22,windowH,.08,.10);
      if(a.rhythm===4&&rhythm===0)place(f,trim,along,yy,.12,windowH,.12,.12);
     }
    }else if(!isDoor&&!(style==='tower'&&a.facade!=='punched')){
     for(const side of[-1,1])place(f,trim,along+side*(windowW/2+.045),yy,.09,windowH+.16,.10,.12);
     place(f,trim,along,yy-windowH/2-.065,windowW+.24,.13,.24,.15);
     if(a.rhythm===1||a.rhythm===2)place(f,'#788c88',along,yy,windowW,.075,.10,.12);
    }
   }
   if(!detail){
    // Short individual bays keep bands out of courts and adjoining upper wings.
    const every=style==='tower'?(a.facade==='ribbon'?1:a.facade==='vertical'?6:3):style==='industrial'?2:1;
    for(let row=1;row<=rows;row+=every){
     const yy=f.y+row*storey-.12;let start=-1;
     for(let col=0;col<=cols;col++){
      const clear=col<cols&&exposed(f,-f.w/2+(col+.5)*bay,yy,bay*.98);
      if(clear&&start<0)start=col;
      if(!clear&&start>=0){place(f,trim,-f.w/2+(start+col)*bay/2,yy,(col-start)*bay,.16,.14,.09);start=-1;}
     }
    }
    if(style==='industrial')for(let col=0;col<=cols;col++){
     const along=-f.w/2+col*bay,yy=f.y+f.h/2;
     if(exposed(f,along,yy,.2))place(f,'#54666a',along,yy,.16,f.h,.16,.12);
    }
   }
  }
 }

 buildBuilding(b,s,detail){if(s.architecture){this.buildArchitecture(b,s,detail);if(!s.interior)return;}const x=s.x,y=s.y,z=s.z,w=s.w,d=s.d,h=s.h,style=s.style;const palettes={brick:['#b47e65','#ac715a','#be8d75','#c2a088','#93796d'],tower:['#7896a1','#6a8893','#90aab0','#a4b5b7','#728c98'],townhouse:['#ad7767','#bf9a80','#a7856e','#b18f78','#d0b39a'],industrial:['#8a9695','#989d92','#697f85','#a79a83','#758a8c'],coast:['#ded2b0','#c9c1a6','#b7c1b3','#dab599','#b3c3c0']};const c=(palettes[style]||palettes.brick)[s.tint||0];

  if(!detail){if(s.interior){const door=s.doorWidth,side=(w-door)/2,dh=style==='hangar'?12:style==='garage'||style==='warehouse'?5:2.8;this.box(b,c,x-w/2,y+h/2,z,.45,h,d,0,'brick');this.box(b,c,x+w/2,y+h/2,z,.45,h,d,0,'brick');this.box(b,c,x,y+h/2,z-d/2,w,h,.45,0,'brick');this.box(b,c,x-door/2-side/2,y+h/2,z+d/2,side,h,.45,0,'brick');this.box(b,c,x+door/2+side/2,y+h/2,z+d/2,side,h,.45,0,'brick');this.box(b,c,x,y+dh+(h-dh)/2,z+d/2,door,h-dh,.45,0,'brick');this.box(b,'#bcb9a5',x,y-.035,z,w,.1,d);this.box(b,'#ddd5bd',x,y+h-.1,z,w,.22,d);for(const f of s.furnishings)this.furniture(b,f);}

   else{this.box(b,c,x,y+h/2,z,w,h,d,0,style==='tower'?'matte':'brick');this.box(b,'#d1c3a9',x,y+1.7,z,w+.25,3.4,d+.25);if(style==='tower'){this.box(b,'#517786',x,y+h*.52,z,w+.3,h*.76,d+.3,0,'glass');const setback=w*.72;this.box(b,'#b2c3c1',x,y+h+3,z,setback,6,d*.72);this.box(b,'#8caaab',x,y+h+7,z,setback*.68,2,d*.6);}if(style==='townhouse'||s.roof===1){this.part(b,'roof','#71675d',x,y+h,z,w+1.3,3.5,d+1.3);}else this.box(b,'#787d74',x,y+h+.18,z,w+1,.36,d+1);}

   this.box(b,'#d3c6af',x,y+h-.5,z,w+.5,.35,d+.5);this.buildingConstruction(b,s);if(s.shopKind){const retail=s.shopKind==='clothing',accent=retail?'#4e7c7c':'#d0ae64';for(let tileX=-w/2+2;tileX<w/2-1;tileX+=2.6){this.box(b,retail?'#aaa78e':'#909a92',x+tileX,y+.019,z,.022,.006,d-.5);}for(let tileZ=-d/2+2;tileZ<d/2-1;tileZ+=2.6)this.box(b,retail?'#aaa78e':'#909a92',x,y+.019,z+tileZ,w-.5,.006,.022);this.box(b,retail?'#f0dec0':'#30464c',x,y+3.6,z+d/2+.20,w-.8,2.0,.12);this.box(b,accent,x,y+2.78,z+d/2+.37,w-.6,.14,.62);for(const side of[-1,1]){this.box(b,accent,x+side*(w/2-.6),y+1.45,z+d/2+.27,.22,2.7,.18);this.box(b,'#e2d8b8',x+side*(w/2-1.5),y+.06,z+d/2+.9,2.4,.12,1.7);}for(let xx=-w*.38;xx<w*.39;xx+=w*.19)this.box(b,'#e6dfc9',x+xx,y+h-.25,z-2,.9,.09,1.5,0,'glow');}return;}

  const rows=Math.min(14,Math.floor((h-3.5)/3.5)),bays=s.bays||Math.floor(w/4.5),bayW=w/bays;

  for(const side of[-1,1])for(let row=0;row<rows;row++)for(let col=0;col<bays;col++){const wx=x-w/2+(col+.5)*bayW,wy=y+5+row*3.5,wz=z+side*(d/2+(s.interior?.31:style==='tower'?.22:.04)),lit=((col*17+row*13+(s.tint||0)*7)%9)<3;this.box(b,'#ccbaa0',wx,wy-.96,wz+side*.16,bayW*.67,.18,.36);this.box(b,'#b5ada0',wx,wy,wz+side*.08,.085,1.8,.08);if(style==='brick'||style==='townhouse'){this.box(b,'#7b665b',wx,wy+1.04,wz+side*.09,bayW*.68,.18,.14);}if(style==='townhouse'&&row===0){this.box(b,'#475f64',wx,wy-.7,wz+side*.9,bayW*.77,.1,1.8);this.box(b,'#516966',wx,wy-.24,wz+side*1.7,bayW*.77,.1,.1);}}

  for(const side of[-1,1])for(let row=0;row<rows;row++)for(let col=0;col<Math.floor(d/5.4);col++){const wz=z-d/2+(col+.5)*d/Math.floor(d/5.4);this.box(b,'#ccbaa0',x+side*(w/2+(s.interior?.36:style==='tower'?.27:.095)),y+4.04+row*3.5,wz,.16,.12,2.6);this.box(b,'#b5ada0',x+side*(w/2+(s.interior?.36:style==='tower'?.27:.095)),y+5+row*3.5,wz,.09,1.8,.085);}

  if(!s.interior){if(style!=='tower'&&style!=='industrial'){this.part(b,'box',['#7c9b91','#b78969','#e2c07b'][s.tint%3||0],x,y+3.13,z+d/2+1.1,w*.94,.13,2.4,-.12);for(let i=0;i<Math.floor(w/2);i++)this.box(b,'#d7cab0',x-w*.46+i*2,y+2.95,z+d/2+2.15,.75,.32,.16);}this.box(b,'#5a665f',x+w*.22,y+h+.7,z-d*.2,3,1.1,4);}

 }

 furniture(b,f){const{x,y,z,w,h,d,kind}=f,c=f.color||'#a29b83',metal='#4b6164',wood='#a99271';const box=(color,dx,dy,dz,ww,hh,dd,material='matte')=>this.box(b,color,x+dx,y+dy,z+dz,ww,hh,dd,0,material),legs=(height,width=.10)=>{for(const a of[-1,1])for(const b of[-1,1])box(metal,a*(w/2-width),height/2,b*(d/2-width),width,height,width,'metal');};

  if(kind==='rug'){box(c,0,h/2,0,w,h,d);for(const side of[-1,1]){box('#cfb78e',side*(w/2-.16),h+.005,0,.1,.009,d-.2);box('#cfb78e',0,h+.005,side*(d/2-.16),w-.2,.009,.1);}return;}

  if(kind==='bed'){legs(.18,.15);box('#756956',0,.27,0,w,.25,d);box('#e6dcc5',0,.44,0,w*.98,.23,d*.95);box(c,0,.57,d*.14,w*.99,.09,d*.65);for(const side of[-1,1])box('#eee5cf',side*w*.24,.56,-d*.34,w*.43,.08,d*.19);return;}

  if(kind==='sofa'||kind==='booth'){legs(h*.15,.12);box(c,0,h*.4,0,w,h*.5,d);box(c,0,h*.75,-d*.4,w,h*.5,d*.2);for(const side of[-1,1])box(c,side*w*.46,h*.64,0,w*.08,h*.62,d);const sections=Math.max(1,Math.round(w/1.1));for(let i=0;i<sections;i++)box('#8ea09a',-w*.4+(i+.5)*w*.8/sections,h*.67,d*.08,w*.77/sections,h*.06,d*.65);return;}

  if(['table','diner-table','workbench','counter'].includes(kind)){legs(h*.9,kind==='workbench'?.13:.10);box(kind==='counter'?c:'#daceb2',0,h-.07,0,w,.14,d);if(kind==='counter')box(c,0,h*.5,-d*.36,w,h*.8,.1);if(kind==='workbench'){box(metal,0,h*.26,0,w*.86,.10,d*.74);for(let n=0;n<3;n++)box('#9ab0ac',(n-1)*w*.23,h-.16,d*.38,w*.18,.07,.05);}return;}

  if(['shelf','rack','toolcabinet','wardrobe','display'].includes(kind)){for(const side of[-1,1])box(metal,side*(w/2-.06),h/2,0,.12,h,d);box(c,0,h/2,-d/2+.05,w,.98*h,.1);for(let n=0;n<4;n++)box(wood,0,.07+n*(h-.12)/3,0,w,.10,d);if(kind==='wardrobe'||kind==='toolcabinet'){for(const side of[-1,1]){box(c,side*w*.246,h*.51,d*.47,w*.48,h*.94,.08);box('#d0c3a1',side*w*.08,h*.55,d*.5,.05,h*.17,.05);}}else for(let row=0;row<3;row++)for(let n=0;n<3;n++){const ww=Math.min(w*.23,.4);box(['#ba8060','#8da497','#cebd86'][(row+n)%3],(n-1)*w*.28,.24+row*h*.28,d*.1,ww,h*.18,d*.5);}return;}

  if(kind==='clothesrack'){for(const side of[-1,1]){box(metal,side*w*.45,h/2,0,.06,h,.06);box(metal,side*w*.45,.06,0,.12,.12,d);}box(metal,0,h-.04,0,w,.055,.055);for(let n=0;n<5;n++){const xx=-w*.37+n*w*.185,col=['#bd795c','#557f8c','#ddd0a9','#546c59','#393f57'][n],yy=h*.55;box(col,xx,yy,0,.44,.66,.12,'cloth');for(const side of[-1,1])this.part(b,'box',col,x+xx+side*.27,y+yy+.17,z,.19,.29,.13,0,0,side*.50,'cloth');box(metal,xx,h*.87,0,.025,h*.21,.025);box('#ddc7a2',xx,h*.75,.003,.45,.025,.04);box('#ddd1b8',xx,yy+.33,.07,.13,.028,.025);}return;}

  if(kind==='retailcounter'){box(c,0,h*.45,0,w,h*.9,d*.94);box('#d8cbb0',0,h-.045,0,w+.12,.09,d+.12);for(let i=0;i<9;i++)box('#786f5b',-w*.45+i*w*.1125,h*.43,d*.479,.035,h*.72,.025);box('#1f343c',w*.30,h+.07,-.07,.50,.14,.36);box('#354e55',w*.30,h+.29,-.10,.46,.35,.075);box('#a2c3b0',w*.30,h+.30,-.055,.37,.24,.015);box('#dbd3b6',-w*.25,h+.035,.14,.36,.035,.48);return;}

  if(kind==='mannequin'||kind==='armorstand'){box(c,0,.10,0,w,.20,d);box('#56656a',0,.23,0,w*.65,.06,d*.65);return;}

  if(kind==='weaponboard'){box(c,0,h/2,0,w,h,d);for(let row=0;row<7;row++)for(let col=0;col<23;col++)box('#7b898b',-w*.46+col*w*.042,h*.10+row*h*.13,d*.505,.025,.025,.01);return;}

  if(kind==='weaponcase'){box(c,0,.48,0,w,.96,d);box('#1d343b',0,1.0,0,w*.96,.08,d*.94);for(const side of[-1,1]){box('#819ca2',side*w*.48,1.24,0,.045,.44,.045);for(const front of[-1,1])box('#819ca2',side*w*.48,1.24,front*d*.48,.045,.44,.045);box('#b9c7c0',side*w*.48,1.45,0,.045,.045,d);box('#b9c7c0',0,1.45,side*d*.48,w,.045,.045);}return;}

  if(['ammodisplay','shoedisplay','hatdisplay','foldeddisplay','foldedtable'].includes(kind)){

   const table=kind==='foldedtable',levels=table?1:3;for(const side of[-1,1])box(metal,side*w*.48,h/2,0,.08,h,d);if(!table)box(c,0,h/2,-d*.46,w,h,.08);

   for(let row=0;row<levels;row++){const yy=table?h-.05:.18+row*(h-.30)/3;box('#c8b596',0,yy,0,w,.075,d);for(let n=0;n<4;n++){const xx=(n-1.5)*w*.23,col=['#527b87','#b58b67','#65775d','#d8c195'][(n+row)%4];if(kind==='ammodisplay'){for(let layer=0;layer<2;layer++){box(['#63735d','#b5a36e','#77544c'][row],xx,yy+.11+layer*.19,0,w*.20,.18,d*.59);box('#eee0b4',xx,yy+.12+layer*.19,d*.30,w*.12,.075,.012);}for(let k=0;k<4;k++)this.cylinder(b,'#ba9654',x+xx+(k-1.5)*.08,y+yy+.49,z+.02,.025,.20);}else if(kind==='shoedisplay'){for(const side of[-1,1]){box('#ded7be',xx+side*.13,yy+.065,.07,.19,.085,.42);box(col,xx+side*.13,yy+.17,.02,.18,.18,.31);box(col,xx+side*.13,yy+.12,.18,.18,.12,.17);for(let k=0;k<3;k++)box('#ece6d6',xx+side*.13,yy+.263,-.01+k*.055,.14,.017,.018);}}else if(kind==='hatdisplay'){this.part(b,'sphere',col,x+xx,y+yy+.19,z,.36,.32,.38);box(col,xx,yy+.075,.21,.33,.035,.25);}else{for(let layer=0;layer<3;layer++){box(col,xx,yy+.05+layer*.07,0,w*.19,.066,d*.56,'cloth');box('#ddd2b8',xx,yy+.085+layer*.07,d*.28,.08,.009,.025);}}}}

   return;

  }

  if(kind==='lamp'){this.cylinder(b,metal,x,y+.04,z,w*.43,.08);this.cylinder(b,metal,x,y+h*.46,z,.035,h*.86);this.part(b,'cone',c,x,y+h*.85,z,w,h*.29,d,0,0,0,'cloth');return;}

  if(kind==='tires'){for(let n=0;n<4;n++){this.cylinder(b,'#28383d',x,y+(n+.5)*h/4,z,w*.46,h*.23);this.cylinder(b,metal,x,y+(n+.96)*h/4,z,w*.20,.018);}return;}

  if(kind==='lift'){box(c,0,h/2,0,w,h,d);for(const side of[-1,1])box('#777e78',side*w*.30,h+.005,0,w*.22,.008,d*.94);return;}

  if(kind==='fuel-cart'){legs(.35,.17);box(c,0,h*.52,0,w*.94,h*.6,d*.90);for(const side of[-1,1])for(const front of[-1,1])this.part(b,'cylinder','#293c41',x+side*w*.46,y+.28,z+front*d*.35,.5,.18,.5,0,0,Math.PI/2);box(metal,0,h*.9,0,w*.36,.15,d*.30);box('#e3cf97',0,h*.57,d*.46,w*.55,.16,.03);return;}

  if(kind==='crate'){box(c,0,h/2,0,w,h,d);for(const side of[-1,1]){for(let n=0;n<4;n++)box('#c0a577',0,h*(n+.5)/4,side*d*.501,w*.96,.06,.03);for(const a of[-1,1])box('#675b48',a*w*.44,h/2,side*d*.502,.16,h,.04);}return;}

  if(kind==='console'){legs(h*.7,.14);box(c,0,h*.74,0,w,h*.48,d);box('#304b56',0,h*.93,-d*.20,w*.78,h*.13,d*.35);for(let n=0;n<8;n++)box('#b1b994',-w*.32+n*w*.09,h*.992,d*.18,.10,.016,.09);return;}

  box(c,0,h/2,0,w,h,d);if(kind==='office'){for(const side of[-1,1])box('#718f97',side*w*.26,h*.6,d*.501,w*.43,h*.52,.025,'glass');box(metal,0,h*.53,d*.501,.12,h*.88,.04);}

 }

 beam(batch,a,b,width,color,kind='metal'){const T=this.T,delta=new T.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),length=delta.length();if(length<.001)return;const e=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),delta.normalize()));this.part(batch,'box',color,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,width,width,length,e.x,e.y,e.z,kind);}

 buildProp(b,p,detail){const{x,y,z,w,d,h,kind}=p;

  if(kind==='woodcrate'){for(const side of[-1,1])for(let n=1;n<5;n++)this.box(b,'#675b48',x,y+n*h/5,z+side*(d/2+.015),w*.94,.02,.03);this.box(b,'#a98b61',x,y+h/2,z,w,h,d);for(const side of[-1,1]){this.box(b,'#675b48',x+side*w*.38,y+h/2,z,w*.10,h*1.04,d*1.02);this.box(b,'#cfb482',x,y+h/2,z+side*d*.51,w*.94,.09,.06);}}

  if(kind==='bin'){this.cylinder(b,'#5e8380',x,y+h*.46,z,w*.48,h*.92);this.cylinder(b,'#345a5c',x,y+h*.96,z,w*.54,.12);this.box(b,'#d6c8a2',x,y+h*.65,z+w*.49,w*.32,.20,.03);for(const side of[-1,1])this.box(b,'#345a5c',x+side*w*.42,y+h*.77,z,.06,.16,.23);for(let n=0;n<8;n++){const a=n*Math.PI/4;this.box(b,'#345a5c',x+Math.sin(a)*w*.465,y+h*.46,z+Math.cos(a)*w*.465,.035,h*.72,.035);}}

  if(kind==='cone'){this.box(b,'#3a5559',x,y+.055,z,w,.11,d);this.part(b,'cone','#c28a56',x,y+h*.5,z,w*.65,h,w*.65);this.cylinder(b,'#e8d7ad',x,y+h*.54,z,w*.12,.11);this.cylinder(b,'#e8d7ad',x,y+h*.32,z,w*.19,.08);for(const side of[-1,1])this.box(b,'#263c43',x+side*w*.40,y+.065,z,.04,.14,d*.75);}

  if(kind==='planter'){this.box(b,'#a4aaa0',x,y+h/2,z,w,h,d);this.box(b,'#c6c8b5',x,y+h-.08,z,w+.12,.18,d+.12);this.box(b,'#59694e',x,y+h+.02,z,w-.25,.12,d-.25);for(let n=0;n<5;n++)this.part(b,'sphere','#698462',x-w*.37+n*w*.185,y+h+.22,z,.65,.40,.7);}

  if(kind==='tree'){this.part(b,'cone','#766b52',x,y+h*.24,z,.44,h*.48,.44);for(let n=0;n<5;n++){const a=n*2.399,px=x+Math.cos(a)*w*.22,pz=z+Math.sin(a)*w*.22,py=y+h*(.57+.045*(n%3));this.beam(b,{x,y:y+h*.31,z},{x:px,y:py,z:pz},.12,'#766b52','matte');this.part(b,'sphere',['#54765d','#67826a','#719078'][n%3],px,py+h*.14,pz,w*.65,h*.42,w*.65,0,a,0,'foliage');}this.part(b,'sphere','#719078',x+w*.2,y+h*.93,z,w*.56,h*.38,w*.56,0,0,0,'foliage');}

  if(kind==='palm'){this.part(b,'cone','#a39470',x,y+h*.46,z,.38,h*.93,.38);for(let n=0;n<9;n++)this.cylinder(b,'#817759',x,y+.3+n*h*.096,z,.175-n*.004,.055);for(let i=0;i<8;i++){const a=i*Math.PI/4;this.part(b,'frond',i%2?'#6d8768':'#56795e',x+Math.sin(a)*1.0,y+h-.02,z+Math.cos(a)*1.0,1.15,.82,2.65,0,a,0,'foliage');}for(let i=0;i<3;i++)this.part(b,'sphere','#8c7853',x+Math.sin(i*2.1)*.20,y+h-.4,z+Math.cos(i*2.1)*.20,.28,.35,.28);}

  if(kind==='streetlight'){this.cylinder(b,'#536368',x,y+h/2,z,.095,h);this.cylinder(b,'#43585c',x,y+.2,z,.14,.4);this.box(b,'#63797b',x,y+h,z-1.2,.12,.12,2.4);this.box(b,'#394f54',x,y+h-.105,z-2.3,.6,.17,.75,0,'metal');this.box(b,'#f8d99f',x,y+h-.195,z-2.3,.48,.025,.62,0,'glow');}

  if(kind==='dock'){this.box(b,'#987e58',x,y-.2,z,w,.4,d);for(let px=x-w/2+.15;px<x+w/2;px+=.45)this.box(b,'#766c52',px,y-.003,z,.025,.006,d-.02);for(let px=x-w/2+3;px<x+w/2;px+=9){this.cylinder(b,'#5f6f65',px,y-5,z,.24,10);for(const side of[-1,1])this.box(b,'#766c52',px,y-.32,z+side*(d/2-.16),.4,.15,.28);}}

  if(kind==='container'){const c=p.color||'#66868a';this.box(b,c,x,y+h/2,z,w,h,d);for(const side of[-1,1]){for(let i=0;i<Math.floor(w/.65);i++)this.box(b,'#617b7b',x-w/2+.3+i*.65,y+h/2,z+side*(d/2-.018),.065,h*.95,.065);for(const top of[.10,h-.1])this.box(b,'#445b60',x,y+top,z+side*(d/2-.04),w,.12,.12);for(let i=0;i<2;i++){const zz=z+(i===0?-.24:.24)*d;this.box(b,'#445b60',x+w/2+.014,y+h/2,zz,.028,h*.94,d*.47);this.box(b,'#b5b7a2',x+w/2+.033,y+h/2,zz,.025,h*.86,.06);}}}

  if(kind==='bench'){for(let n=0;n<5;n++)this.box(b,'#a6956f',x,y+.45,z-.28+n*.14,w,.14,.12);for(let n=0;n<3;n++)this.box(b,'#a6956f',x,y+.65+n*.16,z-.27,w,.13,.12);for(const side of[-1,1]){this.box(b,'#52625c',x+side*w*.37,y+.22,z,.15,.45,.7);this.box(b,'#52625c',x+side*w*.37,y+.61,z-.27,.10,.82,.08);}}

  if(kind==='umbrella'){this.cylinder(b,'#e1d2a8',x,y+1.25,z,.05,2.5);this.part(b,'cone','#d8ad74',x,y+2.6,z,4,.6,4,0,0,0,'cloth');for(let n=0;n<8;n++){const a=n*Math.PI/4;this.beam(b,{x,y:y+2.87,z},{x:x+Math.sin(a)*1.7,y:y+2.30,z:z+Math.cos(a)*1.7},.025,'#806f56');}}

  if(kind==='crane'){this.box(b,'#bb9a65',x-5,y+h/2,z,1.3,h,1.3);this.box(b,'#bb9a65',x+5,y+h/2,z,1.3,h,1.3);this.box(b,'#bb9a65',x,y+h-2,z,30,1.5,1.4);this.box(b,'#bb9a65',x,y+h-10,z+14,1.2,1.2,36);this.box(b,'#6c7e7b',x,y+h-7,z+5,4,4,5);this.cylinder(b,'#505f62',x,y+h*.58,z+28,.05,h*.67);for(const side of[-1,1]){for(let n=1;n<8;n++){const yy=y+n*h/8;this.box(b,'#ddbc7d',x+side*5,yy,z,1.31,.09,1.31);}}for(let n=-14;n<14;n+=2)this.beam(b,{x:x+n,y:y+h-2.65,z:z+.65},{x:x+n+2,y:y+h-1.35,z:z+.65},.10,'#dec48a');this.box(b,'#345561',x,y+h-6.8,z+7.51,3.2,2.4,.04,0,'glass');for(let yy=8;yy<h-12;yy+=6){this.beam(b,{x:x-4.5,y:y+yy,z},{x:x+4.5,y:y+yy+6,z},.18,'#bb9a65');this.beam(b,{x:x+4.5,y:y+yy,z},{x:x-4.5,y:y+yy+6,z},.18,'#bb9a65');}}

  if(kind==='tower'){for(const side of[-1,1])this.box(b,'#778f90',x+side*2,y+h/2,z, .6,h,.6);for(let sy=4;sy<h;sy+=5)this.box(b,'#9da49b',x,y+sy,z,4.5,.2,.4);this.part(b,'sphere','#d7cec1',x+2,y+h*.75,z,3,3,.4);for(let yy=4;yy<h-5;yy+=5)this.beam(b,{x:x-1.8,y:y+yy,z},{x:x+1.8,y:y+yy+5,z},.12,'#778f90');this.cylinder(b,'#475f68',x,y+h*.5,z,.07,h);}

  if(kind==='helipad'){this.box(b,'#687976',x,y+.06,z,w,.12,d);this.box(b,'#dbc77f',x-2,y+.14,z,1,.02,8);this.box(b,'#dbc77f',x+2,y+.14,z,1,.02,8);this.box(b,'#dbc77f',x,y+.14,z,5,.02,1);for(const side of[-1,1]){this.box(b,'#a1a994',x+side*(w/2-.3),y+.123,z,.09,.006,d-.6);this.box(b,'#a1a994',x,y+.123,z+side*(d/2-.3),w-.6,.006,.09);}for(let n=-3;n<=3;n++){this.box(b,'#344e55',x+n*w*.12,y+.121,z,.018,.005,d);this.box(b,'#344e55',x,y+.121,z+n*d*.12,w,.005,.018);}}

  if(kind==='windsock'){this.cylinder(b,'#c2c4b7',x,y+4,z,.06,8);this.part(b,'cone','#d79972',x+1.1,y+7.65,z,.8,2.2,.8,0,0,-Math.PI/2,'cloth');for(let n=0;n<3;n++)this.part(b,'cylinder','#e5d7b7',x+.27+n*.63,y+7.65,z,.71-n*.19,.23,.71-n*.19,0,0,-Math.PI/2,'cloth');}

 }

 buildBreakables(){this.breakableMeshes=new Map();for(const p of this.world.props.filter(p=>p.breakable)){const group=new this.T.Group(),intact=new this.T.Group(),broken=new this.T.Group(),normalBatch=this.batch(),debrisBatch=this.batch();this.buildProp(normalBatch,p,false);this.bake(normalBatch,intact);for(let n=0;n<4;n++){const a=n*2.399;this.part(debrisBatch,'box',p.kind==='woodcrate'?'#947750':p.kind==='bin'?'#557873':'#bd895c',p.x+Math.cos(a)*.46,p.y+.045+n*.014,p.z+Math.sin(a)*.44,p.w*.68,.07,p.d*.18,0,a,.025*n);}this.bake(debrisBatch,broken);group.add(intact,broken);this.environment.add(group);this.breakableMeshes.set(p.id,{group,intact,broken,p,collider:this.world.colliders.find(c=>c.id===p.id)});}this.syncBreakables(this.world.spawn);}

 syncBreakables(position){for(const r of this.breakableMeshes.values()){r.group.visible=Math.hypot(r.p.x-position.x,r.p.z-position.z)<180;const broken=r.collider.enabled===false;r.intact.visible=!broken;r.broken.visible=broken;}}

 sign(title,subtitle){const T=this.T,c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#243d43';ctx.fillRect(0,0,1024,128);ctx.strokeStyle='#c5aa74';ctx.lineWidth=6;ctx.strokeRect(8,8,1008,112);ctx.fillStyle='#eee1bd';ctx.font='600 49px Georgia';ctx.textAlign='center';ctx.fillText(title,512,65);ctx.fillStyle='#b6c8c5';ctx.font='18px sans-serif';ctx.letterSpacing='4px';ctx.fillText(subtitle,512,102);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;this.signTextures.push(t);return t;}

 buildWater(){const T=this.T,g=new T.PlaneGeometry(4000,4000,100,100);g.rotateX(-Math.PI/2);const m=new T.MeshStandardMaterial({color:'#477f8b',roughness:.28,metalness:.22,transparent:true,opacity:.94,side:T.DoubleSide});this.water=new T.Mesh(g,m);this.water.receiveShadow=true;this.environment.add(this.water);this.waterLast=-1;}

 buildRain(){const T=this.T,n=350,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=(Math.sin(i*127.1)*.5)*70;a[i*3+1]=(i*7.71)%35;a[i*3+2]=(Math.cos(i*311.7)*.5)*70;}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(a,3));const m=new T.PointsMaterial({color:'#c5d6d8',size:.075,transparent:true,opacity:.5,depthWrite:false});this.rain=new T.Points(g,m);this.rain.visible=false;this.scene.add(this.rain);}

 buildSignals(){const T=this.T,b=this.batch();this.signals=[];for(const n of this.world.nodes){if(n.links.length<3||n.layer!=='ground'||n.x>800||n.z<-450)continue;for(const heading of[0,Math.PI/2]){const x=n.x+10.9,z=n.z+(heading===0?-10.9:10.9);this.cylinder(b,'#596b6b',x,n.y+2.2,z,.08,4.4);this.box(b,'#2c4248',x,n.y+3.9,z,.55,1.35,.5,heading);for(let i=0;i<3;i++)this.signals.push({x:x+Math.sin(heading)*.28,y:n.y+4.34-i*.43,z:z+Math.cos(heading)*.28,heading,color:['red','amber','green'][i]});}}this.bake(b,this.environment);const mat=new T.MeshStandardMaterial({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:.8,roughness:.5});this.signalMesh=new T.InstancedMesh(this.geometry('sphere'),mat,this.signals.length);const dummy=new T.Object3D();this.signals.forEach((s,i)=>{dummy.position.set(s.x,s.y,s.z);dummy.scale.set(.23,.23,.23);dummy.updateMatrix();this.signalMesh.setMatrixAt(i,dummy.matrix);});this.environment.add(this.signalMesh);}

 updateSignals(sim){const T=this.T,signalTime=Math.floor((sim.time||0)%24);if(signalTime!==this.lastSignalTime){this.lastSignalTime=signalTime;this.signals.forEach((s,i)=>{const phase=((sim.time||0)%24+24)%24,ns=Math.abs(Math.cos(s.heading))>.5,signal=root.CityLife?.signalState?root.CityLife.signalState(sim.time||0,s.heading):ns?(phase<8?'green':phase<10?'amber':'red'):(phase>=12&&phase<20?'green':phase<22&&phase>=20?'amber':'red');this.signalMesh.setColorAt(i,new T.Color(s.color===signal?{red:'#e1745e',amber:'#edd080',green:'#82c4ad'}[s.color]:'#253c3e'));});if(this.signalMesh.instanceColor)this.signalMesh.instanceColor.needsUpdate=true;}const v=(sim.vehicles||[]).find(v=>v.id===sim.player?.vehicleId);for(let i=0;i<this.headlights.length;i++){const l=this.headlights[i];const mode=v?(v.headlightMode??((v.lights??v.headlights??(sim.dayTime<.24||sim.dayTime>.78))?1:0)):0;l.intensity=mode===2?68:mode===1?38:0;l.distance=mode===2?100:55;l.angle=mode===2?.25:.38;if(v){const side=i===0?-.6:.6,forward=(v.length||4)*.49,yaw=v.yaw||0,x=v.x+Math.sin(yaw)*forward+Math.cos(yaw)*side,z=v.z+Math.cos(yaw)*forward-Math.sin(yaw)*side;l.position.set(x,v.y+.7,z);const reach=mode===2?75:35;l.target.position.set(x+Math.sin(yaw)*reach,v.y-.1,z+Math.cos(yaw)*reach);}}}

 stream(position,speed=0){if(this.disposed)return;if(this.preparedDistricts?.size){const cx=Math.floor(position.x/128),cz=Math.floor(position.z/128),radius=(this.graphics||root.CityGraphics.get(this.quality)).detailRadius;for(const[key,variants]of this.preparedDistricts){const[x,z]=key.split(',').map(Number),d=Math.max(Math.abs(x-cx),Math.abs(z-cz)),chosen=d<=radius?(d<=1?variants.near:variants.far):null,previous=this.detailChunks.get(key);if(previous!==chosen){previous?.removeFromParent();if(chosen){this.environment.add(chosen);this.detailChunks.set(key,chosen);}else this.detailChunks.delete(key);}}this.lastChunk=cx+','+cz;return;}const cx=Math.floor(position.x/128),cz=Math.floor(position.z/128),key=cx+','+cz;const preset=this.graphics||root.CityGraphics.get(this.quality),radius=preset.detailRadius;if(!this.buildingsByCell){this.buildingsByCell=new Map();for(const building of this.world.buildings){const k=Math.floor(building.x/128)+','+Math.floor(building.z/128);if(!this.buildingsByCell.has(k))this.buildingsByCell.set(k,[]);this.buildingsByCell.get(k).push(building);}}if(this.lastChunk!==key){this.lastChunk=key;this.detailQueue=[];for(let x=cx-radius;x<=cx+radius;x++)for(let z=cz-radius;z<=cz+radius;z++){const k=x+','+z,existing=this.detailChunks.get(k),near=Math.max(Math.abs(x-cx),Math.abs(z-cz))<=1&&preset.materialDetail>0;if(existing&&near&&!existing.userData.nearDetail){this.environment.remove(existing);existing.traverse(o=>{if(o.isInstancedMesh)o.dispose();});this.detailChunks.delete(k);}if(!this.detailChunks.has(k))this.detailQueue.push({key:k,x,z,d:Math.hypot(x-cx,z-cz)});}this.detailQueue.sort((a,b)=>a.d-b.d);for(const[k,g]of this.detailChunks){const[x,z]=k.split(',').map(Number);if(Math.abs(x-cx)>radius+1||Math.abs(z-cz)>radius+1){this.environment.remove(g);g.traverse(o=>{if(o.isInstancedMesh)o.dispose();});this.detailChunks.delete(k);}}}

  for(let count=0;count<2&&this.detailQueue.length;count++){const job=this.detailQueue.shift();if(this.disposed)return;const b=this.batch(),g=new this.T.Group();g.userData.nearDetail=Math.max(Math.abs(job.x-cx),Math.abs(job.z-cz))<=1&&preset.materialDetail>0;for(const s of this.buildingsByCell.get(job.key)||[])if((Math.max(Math.abs(job.x-cx),Math.abs(job.z-cz))<=1&&preset.materialDetail>0||(root.CityConfig.hash(s.id)%100)/100<preset.detailFraction))this.buildBuilding(b,s,true);this.bake(b,g);this.environment.add(g);this.detailChunks.set(job.key,g);}

 }

 appearance(entity){if(entity.appearance)return entity.appearance;const P=root.CityPeople;if(P){if(entity.appearanceId&&P.catalog)return P.catalog.find(a=>a.id===entity.appearanceId)||P.catalog[0];if(P.generate)return P.generate(entity.seed||0);if(P.presets)return P.presets[0]?.appearance;}return null;}

 personLOD(entity,sim,previous){

  if(entity._player)return 0;

  const limits=(this.graphics||root.CityGraphics.get(sim.settings?.quality)).peopleLOD,p=sim.player||this.camera?.position||entity;

  const distance=Math.hypot((entity.x||0)-(p.x||0),(entity.y||0)-(p.y||0),(entity.z||0)-(p.z||0));

  if(previous===undefined)return distance<limits[0]?0:distance<limits[1]?1:2;

  let lod=previous;while(lod<2&&distance>limits[lod]*1.15)lod++;while(lod>0&&distance<limits[lod-1]*.85)lod--;return lod;

 }

 updateViewFrustum(){
  const T=this.T;this.camera.updateMatrixWorld(true);this.actorFrustum??=new T.Frustum();this.actorSphere??=new T.Sphere();this.actorProjection??=new T.Matrix4();this.actorProjection.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);this.actorFrustum.setFromProjectionMatrix(this.actorProjection);
 }

 actorInView(actor,radius,distance){
  if(!this.actorFrustum)return true;const center=this.actorSphere.center;center.set(actor.x||0,(actor.y||0)+(actor.height||1.8)*.5,actor.z||0);if(center.distanceToSquared(this.camera.position)>(distance+radius)**2)return false;
  // A small conservative margin prevents edge popping, while completely hidden
  // actors never build a rig or run skeletal/model animation. Collision and AI
  // remain authoritative in Simulation, including behind the player.
  this.actorSphere.radius=radius+.65;return this.actorFrustum.intersectsSphere(this.actorSphere);
 }

 createBlood(){
  if(!root.CityBlood)return;const T=this.T;this.blood=new root.CityBlood.Fluid(this.world);this.bloodGroup=new T.Group();this.bloodGroup.name='surface-fluid';this.dynamic.add(this.bloodGroup);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d');context.fillStyle='#fff';context.beginPath();for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2,r=36+Math.sin(angle*5)*7+Math.cos(angle*9)*4, x=64+Math.cos(angle)*r,y=64+Math.sin(angle)*r;if(i)context.lineTo(x,y);else context.moveTo(x,y);}context.closePath();context.fill();for(let i=0;i<13;i++){const angle=i*2.399,r=43+i%3*4;context.beginPath();context.ellipse(64+Math.cos(angle)*r,64+Math.sin(angle)*r,1.5+i%3,1+i%2,angle,0,Math.PI*2);context.fill();}
  this.bloodTexture=new T.CanvasTexture(canvas);this.bloodTexture.colorSpace=T.SRGBColorSpace;this.bloodTexture.needsUpdate=true;
  this.bloodDropMesh=new T.InstancedMesh(new T.SphereGeometry(1,7,5),new T.MeshStandardMaterial({color:'#6e0710',roughness:.23,metalness:0}),224);this.bloodDropMesh.count=0;this.bloodDropMesh.frustumCulled=false;
  this.bloodStainMesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:'#790a12',map:this.bloodTexture,transparent:true,opacity:.88,alphaTest:.03,depthWrite:false,roughness:.35,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),144);this.bloodStainMesh.count=0;this.bloodStainMesh.frustumCulled=false;this.bloodStainMesh.receiveShadow=true;
  this.bloodGroup.add(this.bloodDropMesh,this.bloodStainMesh);this.bloodTransform=new T.Object3D();this.bloodUp=new T.Vector3(0,1,0);this.bloodForward=new T.Vector3(0,0,1);this.bloodVector=new T.Vector3();this.bloodColor=new T.Color();
 }

 syncBlood(sim,dt){
  if(!this.blood)return;const active=sim.settings?.effects!==false;this.bloodGroup.visible=active;if(!active){this.blood.clear();this.bloodDropMesh.count=this.bloodStainMesh.count=0;return;}this.blood.budget(this.graphics?.particles||5);
  for(const event of sim.effects||[])if(event.type==='blood')this.blood.emit(event);const elapsed=this.bloodTime===undefined||this.bloodTime===null?0:Math.max(0,Math.min(.075,(sim.time||0)-this.bloodTime));this.bloodTime=sim.time||0;this.blood.step(elapsed,sim.vehicles||[]);const m=this.bloodTransform,v=this.bloodVector;let count=0;
  for(const drop of this.blood.drops){if(!this.actorInView(drop,.1,180))continue;v.set(drop.vx,drop.vy,drop.vz);const speed=v.length();m.position.set(drop.x,drop.y,drop.z);m.quaternion.setFromUnitVectors(this.bloodUp,v.normalize());m.scale.set(drop.radius,drop.radius*Math.min(2.3,1+speed*.08),drop.radius);m.updateMatrix();this.bloodDropMesh.setMatrixAt(count++,m.matrix);}this.bloodDropMesh.count=count;this.bloodDropMesh.instanceMatrix.needsUpdate=true;
  count=0;for(const stain of this.blood.stains){if(!this.actorInView(stain.point,stain.size,180))continue;const s=stain.size*(.55+.45*Math.min(1,stain.age/.26))*Math.min(1,(stain.life-stain.age)/5),normal=stain.normal;m.position.set(stain.point.x+normal.x*.012,stain.point.y+normal.y*.012,stain.point.z+normal.z*.012);v.set(normal.x,normal.y,normal.z);m.quaternion.setFromUnitVectors(this.bloodForward,v);m.rotateZ(stain.angle);m.scale.set(s*2,s*(Math.abs(normal.y)<.45?2.4:1.65),1);m.updateMatrix();this.bloodStainMesh.setMatrixAt(count,m.matrix);this.bloodColor.setRGB(.55+stain.wet*.45,.55+stain.wet*.45,.55+stain.wet*.45);this.bloodStainMesh.setColorAt(count++,this.bloodColor);}this.bloodStainMesh.count=count;this.bloodStainMesh.instanceMatrix.needsUpdate=true;if(this.bloodStainMesh.instanceColor)this.bloodStainMesh.instanceColor.needsUpdate=true;
 }

 // Recently used LODs are retained independently of camera visibility. Bound the
 // cache and evict on actor removal so death/respawn cannot accumulate models.
 cachePersonLOD(id,record){const key=id+'\0'+record.key+'\0'+record.lod;this.peopleLODCache.delete(key);this.peopleLODCache.set(key,{...record,id});while(this.peopleLODCache.size>24){const oldest=this.peopleLODCache.keys().next().value;root.CityPeopleModels.dispose(this.peopleLODCache.get(oldest).mesh);this.peopleLODCache.delete(oldest);}}
 takePersonLOD(id,key,lod){const cacheKey=id+'\0'+key+'\0'+lod,record=this.peopleLODCache.get(cacheKey);if(record)this.peopleLODCache.delete(cacheKey);return record;}
 clearPersonLODs(id){for(const[key,record]of this.peopleLODCache)if(record.id===id){root.CityPeopleModels.dispose(record.mesh);this.peopleLODCache.delete(key);}}

 syncPeople(sim,dt){const P=root.CityPeopleModels;if(!P)return;this.peopleLODCache??=new Map();this.peopleModelBuilds??=0;const entities=[...(sim.npcs||sim.people||[])];if(sim.player)entities.push({...sim.player,id:sim.player.id||'player',_player:true});for(const v of sim.vehicles||[]){const occupant=v.seatOccupants?.[0];if(occupant&&occupant!=='player'&&v.driverAppearance&&!entities.some(e=>e.id===occupant||e.vehicleId===v.id&&(v.seatOccupants?.indexOf(e.id)===0||!v.seatOccupants?.includes(e.id)&&(e.seatIndex??e.seat??0)===0))){const seat=root.CityVehicles.getSeatTransform(v,0);entities.push({id:occupant,...seat,yaw:v.yaw,appearance:v.driverAppearance,vehicleId:v.id,seatIndex:0,mode:'driver',health:100});}}const live=new Set();for(const e of entities){if(e.hidden)continue;const id=e.id;live.add(id);let record=this.meshes.people.get(id);const limit=Math.max(160,this.graphics?.distance||4800),visible=e._player||this.actorInView(e,Math.max(1.25,e.ragdoll?2.8:1.25),limit+40);if(!visible){if(record)record.mesh.visible=false;continue;}const appearance=this.appearance(e),key=appearance?.appearanceKey||appearance?.id||e.appearanceId||'default',lod=this.personLOD(e,sim,record?.lod);let motion=null;if(record&&(record.key!==key||record.lod!==lod||record.modelDetail!==(this.modelDetail||5))){if(record.key===key){const rig=record.mesh.userData.rig;motion={};for(const field of['phase','travel','blendSpeed','mode','landTime','lastGrounded','flashTime','lastRecoil'])if(rig&&rig[field]!==undefined)motion[field]=rig[field];}this.dynamic.remove(record.mesh);if(record.key===key&&record.modelDetail===(this.modelDetail||5))this.cachePersonLOD(id,record);else{P.dispose?.(record.mesh);this.clearPersonLODs(id);}this.meshes.people.delete(id);record=null;}if(!record){record=this.takePersonLOD(id,key,lod);if(!record){record={mesh:P.create(appearance,{lod,modelDetail:this.modelDetail||5}),key,lod,modelDetail:this.modelDetail||5};this.peopleModelBuilds++;}const mesh=record.mesh;if(motion)Object.assign(mesh.userData.rig,motion);this.meshes.people.set(id,record);this.dynamic.add(mesh);}const mesh=record.mesh;mesh.position.set(e.x||0,e.y||0,e.z||0);mesh.rotation.set(0,e.yaw??e.heading??0,0,'YXZ');const rawMode=e.animation?.mode||e.anim?.mode||e.animState||e.pose||((e.health??100)<=0?'dead':e.mode)||'idle',mode=({onFoot:'idle','on-foot':'idle',swimming:'swim',falling:'fall',vaulting:'vault',parachuting:'parachute',panic:'sprint',handsUp:'handsup'})[rawMode]||rawMode,state={...e,...e.animation,...e.anim,mode,crouching:e.crouched||e.crouching,velocityY:e.vy,lookPitch:e.pitch||sim.camera?.pitch||0,reloadProgress:e.reload?e.reloadProgress:null,weapon:e.weapon||sim.weapon?.id||null};const vehicle=(sim.vehicles||[]).find(v=>v.id===e.vehicleId);if(vehicle&&!['entering','exiting'].includes(mode)){const seat=root.CityVehicles.getSeatTransform(vehicle,vehicle.seatOccupants?.includes(e.id)?vehicle.seatOccupants.indexOf(e.id):(e.seatIndex??e.seat??0));if(seat){mesh.position.set(seat.x,seat.y,seat.z);mesh.rotation.set(-vehicle.pitch,vehicle.yaw,-vehicle.roll,'YXZ');state.mode='seated';state.seatPose=seat.pose;state.steer=vehicle.visual?.steer||0;state.bikeLean=vehicle.bikeBalance?.lean||0;state.bikeTuck=vehicle.bikeBalance?.tuck||0;state.bikeSport=root.CityVehicles.definition(vehicle).bikeSport||false;state.bikeTargets=root.CityVehicles.bikeRiderTargets?.(vehicle,e.seatIndex??e.seat??0);}}P.animate(mesh,state,sim.time||this.time,dt);mesh.visible=true;if(e._player){P.setFirstPerson?.(mesh,this.firstPerson);this.playerMesh=mesh;}}

  for(const[id,r]of this.meshes.people)if(!live.has(id)){this.dynamic.remove(r.mesh);P.dispose?.(r.mesh);this.meshes.people.delete(id);this.clearPersonLODs(id);}

 }

 syncVehicles(sim,dt){const V=root.CityVehicleModels;if(!V)return;const live=new Set();for(const e of sim.vehicles||[]){live.add(e.id);let r=this.meshes.vehicles.get(e.id);const visible=e.id===sim.player?.vehicleId||this.actorInView(e,Math.max(2,Math.hypot(e.length||4,e.width||2,e.height||1.5)*.55),(this.graphics?.distance||4800)+80);if(!visible){if(r)r.mesh.visible=false;continue;}if(r&&(r.type!==e.typeId||r.modelDetail!==(this.modelDetail||5))){this.dynamic.remove(r.mesh);V.dispose?.(r.mesh);this.meshes.vehicles.delete(e.id);r=null;}if(!r){const mesh=V.create(e.typeId||e.type||'pebble',e.customization||{paint:e.color||e.paint},{modelDetail:this.modelDetail||5});r={mesh,type:e.typeId,modelDetail:this.modelDetail||5,details:[]};mesh.traverse(part=>{if(part.userData.cityDetail!==undefined)r.details.push(part);});this.meshes.vehicles.set(e.id,r);this.dynamic.add(mesh);}r.lastVehicle=e;const m=r.mesh;m.visible=true;m.position.set(e.x||0,e.y||0,e.z||0);m.rotation.set(e.pitch||0,e.yaw||0,e.roll||0,'YXZ');if(V.animate)V.animate(m,e,sim.time||this.time,dt);else if(V.update)V.update(m,e,dt,{lights:e.lights??e.headlights??(sim.dayTime<.24||sim.dayTime>.78)});this.breakup?.sync(m,e,{effects:sim.settings?.effects!==false});if(r.detailLevel!==this.graphics?.materialDetail){r.detailLevel=this.graphics?.materialDetail;for(const part of r.details)part.visible=part.userData.cityDetail<=(r.detailLevel||0);}}

  for(const[id,r]of this.meshes.vehicles)if(!live.has(id)){this.dynamic.remove(r.mesh);V.dispose?.(r.mesh);this.meshes.vehicles.delete(id);}

 }

 syncPickups(sim){const T=this.T,live=new Set();for(const p of sim.pickups||sim.drops||[]){if(p.claimed)continue;live.add(p.id);let m=this.meshes.pickups.get(p.id);if(!m){m=new T.Group();const cash=new T.Mesh(new T.BoxGeometry(.32,.12,.22),this.material('#829876'));cash.castShadow=true;m.add(cash);const band=new T.Mesh(new T.BoxGeometry(.075,.125,.23),this.material('#e2cc92'));m.add(band);this.dynamic.add(m);this.meshes.pickups.set(p.id,m);}m.position.set(p.x,p.y+.12+Math.abs(Math.sin((p.age||0)*9))*.18*Math.exp(-(p.age||0)*2),p.z);m.rotation.y=this.time*.5;}for(const[id,m]of this.meshes.pickups)if(!live.has(id)){this.dynamic.remove(m);m.traverse(n=>n.geometry?.dispose());this.meshes.pickups.delete(id);}}

 updateSwimmingCamera(sim,dt){

  const T=this.T,p=sim.player,c=sim.camera,water=this.world.waterHeight(p.x,p.z,sim.time),yaw=c.yaw,pitch=C(c.pitch,-1.15,1.15),under=p.y+.9<water;

  this.firstPerson=['first','first-person','cockpit','hood',2].includes(c.mode);

  const pivot=new T.Vector3(p.x,p.y+.72,p.z),forward=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));

  if(this.firstPerson)this.camera.position.copy(pivot);else{

   const distance=under?2.6:4.0,desired=pivot.clone().addScaledVector(forward,-distance);desired.x+=Math.cos(yaw)*.24;desired.z-=Math.sin(yaw)*.24;desired.y=pivot.y+(under?.35:1.0)-Math.sin(pitch)*distance*.35;

   desired.y=under?Math.min(desired.y,water-.18):Math.max(desired.y,water+.3);

   const offset=desired.clone().sub(pivot),length=offset.length(),hit=this.world.raycast(pivot,offset,length,.18);if(hit)desired.copy(pivot).add(offset.normalize().multiplyScalar(Math.max(.15,hit.distance-.2)));

   this.camera.position.lerp(desired,1-Math.exp(-dt*12));

  }

  this.camera.position.y=Math.max(this.camera.position.y,this.world.terrainHeight(this.camera.position.x,this.camera.position.z)+.2);

  // Keep the camera with the diver rather than orbiting several metres above

  // the surface when looking down. The waterline is decided by actual depth.

  if(under)this.camera.position.y=Math.min(this.camera.position.y,water-.12);

  this.target.copy(pivot).addScaledVector(forward,4);this.camera.lookAt(this.target);

  const fov=projectionFov(sim.settings?.fov||68);if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}

  this.sun.position.set(p.x-180,390,p.z-210);this.sun.target.position.copy(pivot);

 }

 updatePhoneCamera(sim,dt){

  const T=this.T,p=sim.player,yaw=p.yaw||0,right=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),forward=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));

  this.firstPerson=false;

  const pivot=new T.Vector3(p.x,p.y+1.28,p.z),desired=pivot.clone().addScaledVector(right,1.7).addScaledVector(forward,2.55);desired.y+=.42;

  const direction=desired.clone().sub(pivot),distance=direction.length(),hit=this.world.raycast(pivot,direction,distance,.18);

  if(hit)desired.copy(pivot).add(direction.normalize().multiplyScalar(Math.max(.55,hit.distance-.2)));

  desired.y=Math.max(desired.y,this.world.terrainHeight(desired.x,desired.z)+.3);

  this.camera.position.lerp(desired,1-Math.exp(-dt*10));this.target.copy(pivot);

  // Leave the head and held phone above the device UI on narrow portrait screens.

  if(this.canvas.clientWidth<560&&this.canvas.clientHeight>this.canvas.clientWidth)this.target.y-=1.25;

  this.camera.lookAt(this.target);

  const fov=projectionFov(sim.settings?.fov||68);if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}

  this.sun.position.set(p.x-180,390,p.z-210);this.sun.target.position.copy(pivot);

 }

 updateCamera(sim,dt){const T=this.T,p=sim.player||this.world.spawn,c=sim.camera||{},v=(sim.vehicles||[]).find(v=>v.id===p.vehicleId),mode=p.ragdoll?'third':c.mode??p.cameraMode??0;if(sim.phoneOpen&&!v){this.updatePhoneCamera(sim,dt);return;}if(p.mode==='swimming'&&!v){this.updateSwimmingCamera(sim,dt);return;}this.firstPerson=mode===2||mode==='first'||mode==='first-person'||mode==='cockpit'||mode==='hood';const yaw=c.yaw??p.cameraYaw??p.yaw??0,pitch=C(c.pitch??p.cameraPitch??.1,-1.15,1.15),aim=p.aiming||c.aiming;let pivot=new T.Vector3(p.x||0,(p.y||0)+(p.crouching||p.crouched?1.05:1.5),p.z||0),dist=mode===1||mode==='far'?10:mode==='near'?3.5:5.2;if(aim)dist=3.1;if(v){pivot.set(v.x,v.y+Math.max(1.2,(v.height||1.5)*.75),v.z);dist=Math.max(7,(v.length||4)*1.5)+(Math.abs(v.speed||0)*.035);const socket=root.CityVehicles?.byId[v.typeId]?.cameraSockets?.[mode==='hood'?'hood':'cockpit'];if(this.firstPerson&&socket&&root.CityVehicles?.worldPoint){const socketWorld=root.CityVehicles.worldPoint(v,socket);pivot.set(socketWorld.x,socketWorld.y,socketWorld.z);}}

  if(this.firstPerson){this.camera.position.copy(pivot);this.target.set(pivot.x+Math.sin(yaw)*Math.cos(pitch)*20,pivot.y+Math.sin(pitch)*20,pivot.z+Math.cos(yaw)*Math.cos(pitch)*20);}else{const shoulder=(c.shoulder??1)*(aim?.64:.3),offset=new T.Vector3(-Math.sin(yaw)*Math.cos(pitch)*dist+Math.cos(yaw)*shoulder,2-Math.sin(pitch)*dist,-Math.cos(yaw)*Math.cos(pitch)*dist-Math.sin(yaw)*shoulder),desired=pivot.clone().add(offset),dir=desired.clone().sub(pivot),max=dir.length(),hit=this.world.raycast(pivot,dir,max,.22),allowed=hit?Math.max(.45,hit.distance-.3):max;this.cameraDistance=allowed<this.cameraDistance?allowed:this.cameraDistance+(allowed-this.cameraDistance)*(1-Math.exp(-dt*4));dir.normalize().multiplyScalar(Math.min(max,this.cameraDistance));desired.copy(pivot).add(dir);desired.y=Math.max(desired.y,this.world.terrainHeight(desired.x,desired.z)+.3);this.camera.position.lerp(desired,1-Math.exp(-dt*14));const smoothed=this.camera.position.clone().sub(pivot),smoothLength=smoothed.length(),smoothHit=this.world.raycast(pivot,smoothed,smoothLength,.22);if(smoothHit&&smoothHit.distance<smoothLength)this.camera.position.copy(pivot).add(smoothed.normalize().multiplyScalar(Math.max(.025,smoothHit.distance-.04)));this.target.copy(pivot).add(new T.Vector3(Math.sin(yaw)*4,Math.sin(pitch)*4,Math.cos(yaw)*4));}

  const settings=sim.settings||{},motion=settings.reducedMotion?0:1;if(this.firstPerson&&!v&&motion){const bob=(settings.bob??.25)*C(p.speed||0,0,7)*.005*Math.sin(this.time*11);this.camera.position.y+=bob;this.target.y+=bob;}if(motion&&(settings.shake??.35)>0){const strength=C(p.recoil||0,0,1)*(settings.shake??.35)*.022;this.camera.position.x+=Math.sin(this.time*71)*strength;this.camera.position.y+=Math.cos(this.time*57)*strength;}this.camera.lookAt(this.target);const fov=projectionFov(settings.fov||settings.fieldOfView||68)*(aim?.86:1);if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}this.sun.position.set(pivot.x-180,390,pivot.z-210);this.sun.target.position.copy(pivot);

 }

 atmosphere(sim,dt){const time=sim.dayTime??sim.worldTime??(sim.timeOfDay??.5),hour=time<=1?time*24:time>24?(time/90)%24:time,daylight=C(Math.sin((hour-6)/24*Math.PI*2)*.7+.45,.08,1),dusk=1-Math.abs(daylight-.42)*2;this.hemi.intensity=.5+daylight*1.65;this.sun.intensity=.14+daylight*2.7;const color=new this.T.Color('#102a41').lerp(new this.T.Color('#a9d0db'),daylight);if(hour>16&&hour<20)color.lerp(new this.T.Color('#d1a88c'),C(dusk,0,.32));this.scene.background.copy(color);this.scene.fog.color.copy(color);this.water.material.color.copy(new this.T.Color('#234a64').lerp(new this.T.Color('#568d94'),daylight));this.renderer.toneMappingExposure=(sim.settings?.brightness||1)*(1+daylight*.08);

  const cameraWater=this.world.waterHeight(this.camera.position.x,this.camera.position.z,this.time);this.underwater=Number.isFinite(cameraWater)&&this.camera.position.y<cameraWater-.04&&this.camera.position.y>this.world.terrainHeight(this.camera.position.x,this.camera.position.z);const altitude=this.graphicsValues?Math.max(0,(sim.player?.y||0)-this.world.groundHeight(sim.player?.x||0,sim.player?.z||0)):0;this.scene.fog.near=this.underwater?1.8:this.graphicsValues?this.graphicsValues.distance*.65+altitude:650;this.scene.fog.far=this.underwater?46:this.graphicsValues?this.graphicsValues.distance+128+altitude:3100;if(this.graphicsValues){const far=Math.max(600,this.graphicsValues.distance+400+altitude);if(Math.abs(this.camera.far-far)>2){this.camera.far=far;this.camera.updateProjectionMatrix();}}this.water.material.opacity=this.underwater?.72:.94;if(this.underwater){const blue=new this.T.Color('#164857').multiplyScalar(.75+daylight*.25);this.scene.background.copy(blue);this.scene.fog.color.copy(blue);this.hemi.intensity=.85;this.sun.intensity*=.55;}

  if(this.graphics?.lighting==='ambient'){this.hemi.intensity=1.3+daylight*1.4;this.fill.intensity=.25;}else this.fill.intensity=.15;
  const raining=sim.weather==='rain'||sim.weather==='light-rain';this.wetness+=( (raining?1:0)-this.wetness)*(1-Math.exp(-dt*.6));

  for(const[key,m]of this.materials){if(m.userData.windUniform)m.userData.windUniform.value=this.time;if(key.startsWith('#414e54:')){m.roughness=.88-this.wetness*.25;m.color.set('#414e54').multiplyScalar(1-this.wetness*.12);}}

  for(const[key,m]of this.materials)if(key.endsWith(':glow'))m.emissiveIntensity=.15+(1-daylight)*1.7;

  if(this.time-this.waterLast>(this.graphicsValues?.detail==='low'?.3:.12)){const a=this.water.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,.08*Math.sin(a.getX(i)*.025+this.time*.7)+.055*Math.sin(a.getZ(i)*.032-this.time*.5));a.needsUpdate=true;this.waterLast=this.time;}

  const p=sim.player||this.world.spawn,interior=this.world.interiorAt(p.x,p.z,p.y);this.rain.visible=(sim.weather==='rain'||sim.weather==='light-rain')&&!interior;if(this.rain.visible){this.rain.position.set(p.x,p.y,p.z);const a=this.rain.geometry.attributes.position;for(let i=0;i<Math.min(a.count,this.rain.geometry.drawRange.count);i++){let y=a.getY(i)-dt*18;if(y<0)y+=35;a.setY(i,y);}a.needsUpdate=true;}

 }

 render(sim={},dt=1/60){if(this.disposed)return;this.time=sim.time??this.time+dt;this.applySettings(sim.settings||{});this.endPreview();const p=sim.player||this.world.spawn;this.stream(p,p.speed||0);this.cullStatic(p);this.updateCamera(sim,dt);this.updateViewFrustum();this.syncVehicles(sim,dt);if(this.breakup){const elapsed=this.breakupTime===null?0:Math.max(0,this.time-this.breakupTime);this.breakup.update(elapsed);this.breakup.group.visible=true;this.breakupTime=this.time;}this.syncPeople(sim,dt);this.syncPickups(sim);this.syncBreakables(p);for(const display of this.shopDisplays||[])display.visible=Math.hypot(display.position.x-p.x,display.position.z-p.z)<100;this.syncEffects(sim);this.syncBlood(sim,dt);this.syncTireSmoke(sim);this.syncCasings(sim,dt);this.updateObjective(sim);this.updatePhysicalDebug(sim);this.atmosphere(sim,dt);this.updateSignals(sim);for(const d of this.world.doors){const m=this.doorMeshes.get(d.id);if(m)m.rotation.y+=( (d.open?-Math.PI/2:0)-m.rotation.y)*(1-Math.exp(-dt*9));}this.renderer.render(this.scene,this.camera);}

 syncEffects(sim){const T=this.T,live=new Set(),visualEffects=(sim.settings?.effects===false?[]:(sim.effects||[]).filter(e=>e.type!=='blood')).slice(-(this.graphics?.effectCap||32));visualEffects.push(...(sim.projectiles||[]).map(p=>({...p,_projectile:true})));for(const e of visualEffects){live.add(e.id);let m=this.effects.get(e.id);const explosion=e.type==='explosion',age=e.age||0,life=e.life||.4;if(!m){m=new T.Group();if(e.type==='tracer'&&e.end){const geometry=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(e.end.x-e.x,e.end.y-e.y,e.end.z-e.z)]);m.add(new T.Line(geometry,new T.LineBasicMaterial({color:'#e6c98c',transparent:true,opacity:.7})));m.userData.tracer=true;}else if(e._projectile){m.add(new T.Mesh(this.geometry(e.type==='rocket'?'cylinder':'sphere'),this.material(e.type==='rocket'?'#ba9365':'#7f8a63','metal')));m.children[0].scale.set(e.type==='rocket'?.13:.23,e.type==='rocket'?.65:.23,e.type==='rocket'?.13:.23);m.userData.projectile=true;}else for(let i=0;i<(explosion?(this.graphics?.particles||5):Math.max(1,Math.ceil((this.graphics?.particles||5)/3)));i++){const part=new T.Mesh(this.geometry('sphere'),new T.MeshBasicMaterial({color:explosion?'#e6ae5c':e.material==='metal'?'#e8cf8c':e.material==='water'?'#a1cbd1':'#b8b49c',transparent:true,opacity:1,depthWrite:false}));part.userData.phase=i*2.399;m.add(part);}this.effects.set(e.id,m);this.dynamic.add(m);}m.position.set(e.x,e.y,e.z);if(m.userData.projectile){m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(e.vx,e.vy,e.vz).normalize());continue;}if(m.userData.tracer){m.children[0].material.opacity=C(1-age/life,0,1)*.7;continue;}for(let i=0;i<m.children.length;i++){const p=m.children[i],a=p.userData.phase,r=age*(explosion?6:2);p.position.set(Math.cos(a)*r,age*(explosion?4:1.4)+(i%3)*.1,Math.sin(a)*r);p.scale.setScalar(explosion?.4+age*2.3:.025+age*.1);p.material.opacity=C(1-age/life,0,1);if(explosion&&age>life*.2)p.material.color.set('#74796e');}if(e.normal&&!explosion)m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(e.normal.x,e.normal.y,e.normal.z).normalize());}for(const[id,m]of this.effects)if(!live.has(id)){this.dynamic.remove(m);if(!m.userData.projectile)m.children.forEach(p=>p.material.dispose());if(m.userData.tracer)m.children[0].geometry.dispose();this.effects.delete(id);}

  const targets=new Set();for(const e of sim.targets||[]){if(e.destroyed)continue;targets.add(e.id);let m=this.targets.get(e.id);if(!m){m=new T.Group();const plate=new T.Mesh(new T.CylinderGeometry(.5,.5,.07,20),this.material('#d6ad78'));plate.rotation.x=Math.PI/2;plate.position.y=1.3;m.add(plate);const bull=new T.Mesh(new T.CylinderGeometry(.19,.19,.08,18),this.material('#a35645'));bull.rotation.x=Math.PI/2;bull.position.set(0,1.3,.015);m.add(bull);const stand=new T.Mesh(new T.BoxGeometry(.1,1.15,.1),this.material('#5c7876'));stand.position.y=.58;m.add(stand);this.targets.set(e.id,m);this.dynamic.add(m);}m.position.set(e.x,e.y-1.3,e.z);m.rotation.y=e.yaw||0;}for(const[id,m]of this.targets)if(!targets.has(id)){this.dynamic.remove(m);m.traverse(o=>o.geometry?.dispose());this.targets.delete(id);}

 }

 buildStreetSigns(){

  const T=this.T,b=this.batch();this.streetSignMeshes=[];const posts=new Set();

  for(const sign of this.world.streetSigns||[]){

   const key=sign.x+','+sign.z;if(!posts.has(key)){posts.add(key);this.cylinder(b,'#657778',sign.x,sign.y-1.6,sign.z,.045,3.2);}

   const c=document.createElement('canvas');c.width=768;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#234c48';ctx.fillRect(0,0,768,96);ctx.strokeStyle='#ecedd6';ctx.lineWidth=5;ctx.strokeRect(5,5,758,86);ctx.fillStyle='#f4efd9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 40px sans-serif';ctx.fillText(sign.name,384,49,714);

   const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;this.signTextures.push(texture);const mesh=new T.Mesh(new T.PlaneGeometry(4.8,.60),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));mesh.position.set(sign.x,sign.y,sign.z);mesh.rotation.y=sign.yaw;mesh.userData={roadId:sign.roadId,streetName:sign.name};this.environment.add(mesh);this.streetSignMeshes.push(mesh);

  }

  this.bake(b,this.environment);

 }

 createTireSmoke(){
  if(this.tireSmoke)return;const T=this.T,canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d');for(const[x,y,r]of[[25,29,25],[38,25,23],[34,39,24]]){const gradient=ctx.createRadialGradient(x,y,1,x,y,r);gradient.addColorStop(0,'rgba(228,232,233,.82)');gradient.addColorStop(.42,'rgba(208,216,221,.58)');gradient.addColorStop(1,'rgba(182,194,201,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);}
  this.tireSmokeTexture=new T.CanvasTexture(canvas);this.tireSmokeTexture.colorSpace=T.SRGBColorSpace;
  this.tireSmokeGroup=new T.Group();this.tireSmokeGroup.name='Tire smoke';this.dynamic.add(this.tireSmokeGroup);
  this.tireSmoke=Array.from({length:72},()=>{const mesh=new T.Sprite(new T.SpriteMaterial({map:this.tireSmokeTexture,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));mesh.visible=false;this.tireSmokeGroup.add(mesh);return{mesh,age:10,life:1,vx:0,vz:0,strength:0};});
  this.smokeEmitterClocks=new Map();this.tireSmokeTime=null;this.smokeSequence=0;
 }
 clearTireSmoke(){if(!this.tireSmoke)return;for(const p of this.tireSmoke){p.age=p.life;p.mesh.visible=false;}this.smokeEmitterClocks.clear();this.tireSmokeTime=null;}
 syncTireSmoke(sim){
  if(!this.tireSmoke)this.createTireSmoke();const elapsed=this.tireSmokeTime===null?0:C((sim.time||0)-this.tireSmokeTime,0,.12);this.tireSmokeTime=sim.time||0;
  if(sim.settings?.effects===false){this.clearTireSmoke();return;}
  const detail=this.graphics?.particles||2,cap=Math.max(0,Math.min(1000,Math.round(this.graphics?.smokeParticleBudget??(detail<=2?32:detail<=5?72:128))));if(cap===0){this.clearTireSmoke();return;}while(this.tireSmoke.length<cap){const mesh=new this.T.Sprite(new this.T.SpriteMaterial({map:this.tireSmokeTexture,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));mesh.visible=false;this.tireSmokeGroup.add(mesh);this.tireSmoke.push({mesh,age:10,life:1,vx:0,vz:0,strength:0});}
  for(let i=0;i<this.tireSmoke.length;i++){const p=this.tireSmoke[i];if(i>=cap){p.mesh.visible=false;p.age=p.life;continue;}if(p.age>=p.life)continue;p.age+=elapsed;const t=p.age/p.life;p.mesh.visible=t<1;if(!p.mesh.visible)continue;p.mesh.position.x+=p.vx*elapsed;p.mesh.position.z+=p.vz*elapsed;p.mesh.position.y+=elapsed*(.22+t*.34);p.mesh.scale.setScalar(.3+t*2.35);p.mesh.material.opacity=p.strength*Math.sin(Math.PI*Math.min(1,t))*.82;}
  const live=new Set();for(const v of sim.vehicles||[]){if(v.category!=='land'||v.health<=0||!v.grounded||v.rollover||v.bikeFallen||Math.hypot(v.x-sim.player.x,v.z-sim.player.z)>100||!this.actorInView(v,8,120))continue;
   const speed=Math.hypot(v.vx,v.vz),slip=Math.abs(v.vx*Math.cos(v.yaw)-v.vz*Math.sin(v.yaw)),intensity=C(Math.max(v.driftIntensity||0,(slip-1.5)/5),0,1);if(speed<5||intensity<.18)continue;
   live.add(v.id);let clock=(this.smokeEmitterClocks.get(v.id)||0)+elapsed;const interval=Math.max(.018,.075*Math.sqrt(72/cap)),definition=root.CityVehicles.byId[v.typeId],s=Math.sin(v.yaw),c=Math.cos(v.yaw),sides=v.kind==='bike'?[0]:[-1,1];
   while(clock>=interval){clock-=interval;for(const side of sides){let puff=this.tireSmoke.find((p,index)=>index<cap&&p.age>=p.life);if(!puff)puff=this.tireSmoke[this.smokeSequence%cap];const phase=++this.smokeSequence*2.399,axle=-definition.wheelbase*.5,track=side*definition.track*.48,x=v.x+s*axle+c*track,z=v.z+c*axle-s*track;puff.mesh.position.set(x,this.world.groundHeight(x,z,v.y)+.15,z);puff.age=0;puff.life=1.3+intensity*.6;puff.strength=(.3+intensity*.7)*(sim.weather==='rain'?.55:1);puff.vx=v.vx*.035+Math.cos(phase)*.22;puff.vz=v.vz*.035+Math.sin(phase)*.22;puff.mesh.scale.setScalar(.24);puff.mesh.material.rotation=phase;puff.mesh.material.opacity=0;puff.mesh.visible=true;}}
   this.smokeEmitterClocks.set(v.id,clock);
  }for(const id of this.smokeEmitterClocks.keys())if(!live.has(id))this.smokeEmitterClocks.delete(id);
 }

 syncCasings(sim,dt){

  const T=this.T,enabled=sim.settings?.effects!==false;

  // Cosmetic only: capped meshes, short lifetimes, no simulation bodies or save data.

  for(const event of sim.events||[]){if(!enabled||event.type!=='shot'||event.weapon==='comet'||event.weapon==='unarmed'||this.time-event.time>.15||this.casingEvents.has(event.id))continue;this.casingEvents.add(event.id);while(this.casingEvents.size>256)this.casingEvents.delete(this.casingEvents.values().next().value);if(this.casings.length>=48){this.dynamic.remove(this.casings.shift().mesh);}const mesh=new T.Mesh(this.geometry('cylinder'),this.material(event.weapon==='breakwater'?'#a26448':'#bfa365','metal'));mesh.scale.set(.035,.11,.035);mesh.position.set(event.x,event.y,event.z);this.dynamic.add(mesh);const yaw=sim.camera?.yaw||0,phase=this.casings.length*2.399;this.casings.push({mesh,age:0,bounces:0,vx:Math.cos(yaw)*1.35+Math.sin(phase)*.2,vz:-Math.sin(yaw)*1.35,vy:1.7,spin:phase});}

  const step=C(dt,0,.05);for(let i=this.casings.length-1;i>=0;i--){const shell=this.casings[i];shell.age+=step;if(!enabled||shell.age>5){this.dynamic.remove(shell.mesh);this.casings.splice(i,1);continue;}if(shell.bounces<3){const p=shell.mesh.position;shell.vy-=9.8*step;p.x+=shell.vx*step;p.y+=shell.vy*step;p.z+=shell.vz*step;const floor=this.world.groundHeight(p.x,p.z,p.y)+.022;if(p.y<=floor){p.y=floor;shell.vy=Math.abs(shell.vy)*.28;shell.vx*=.38;shell.vz*=.38;shell.bounces++;}shell.mesh.rotation.set(shell.age*11,shell.spin+shell.age*8,Math.PI/2);}else shell.mesh.rotation.x=Math.PI/2;}

 }

 observations(npcs,player){this.camera.updateMatrixWorld();const T=this.T,cam=this.camera.position,out=[];for(const n of npcs){const distance=Math.hypot(n.x-cam.x,n.y-cam.y,n.z-cam.z),head=new T.Vector3(n.x,n.y+1.7,n.z).project(this.camera),feet=new T.Vector3(n.x,n.y,n.z).project(this.camera),onScreen=head.z>-1&&head.z<1&&Math.abs(head.x)<1.05&&head.y>-1.1&&feet.y<1.1,screenHeight=Math.abs(head.y-feet.y)/2,occluded=onScreen&&distance<100?!this.world.lineOfSight({x:cam.x,y:cam.y,z:cam.z},{x:n.x,y:n.y+1.25,z:n.z}):true;out.push({id:n.id,entityId:n.id,onScreen,screenHeight,distance,occluded,readable:onScreen&&!occluded&&screenHeight>.025,playerPosition:{x:player.x,y:player.y,z:player.z}});}return out;}

 previewCharacter(appearance,time=0){const P=root.CityPeopleModels;if(!P)return;const key=appearance.appearanceKey||appearance.id;if(this.previewKey!==key){if(this.preview)this.preview.visible=false;this.characterPreviews??=new Map();this.preview=this.characterPreviews.get(key);if(!this.preview){this.preview=P.create(appearance,{lod:0,modelDetail:this.modelDetail});this.characterPreviews.set(key,this.preview);}this.previewKey=key;this.preview.position.set(-181,2.56,174);this.scene.add(this.preview);}this.dynamic.visible=false;this.preview.visible=true;this.preview.rotation.y=.3+Math.sin(time*.15)*.3;P.animate(this.preview,{mode:'idle',speed:0},time,1/60);this.stream(this.preview.position,0);this.camera.position.set(-179.1,3.88,178.1);this.camera.lookAt(-181,3.5,174);const width=this.canvas.clientWidth||1440,height=this.canvas.clientHeight||900;this.camera.setViewOffset(width,height,width*.24,0,width,height);this.renderer.render(this.scene,this.camera);}

 endPreview(){if(this.preview)this.preview.visible=false;this.dynamic.visible=true;if(this.camera.view?.enabled)this.camera.clearViewOffset();}

 vehiclePreview(typeId,customization={}){

  if(this.disposed||!root.CityVehicles.byId[typeId])return '';

  // Render the same fleet model used in the world. Only cosmetic choices affect

  // the thumbnail; the bounded cache never stores another live WebGL model.

  const appearance={paint:customization.paint,wheelStyle:customization.wheelStyle||0,trim:customization.trim||0},key=JSON.stringify([typeId,appearance]);

  this.vehiclePreviews??=new Map();if(this.vehiclePreviews.has(key))return this.vehiclePreviews.get(key);

  const T=this.T,size=root.Platdo?.renderSize?.(480,300)||{width:480,height:300},width=Math.max(1,Math.round(size.width||size.w||480)),height=Math.max(1,Math.round(size.height||size.h||300)),model=root.CityVehicleModels.create(typeId,appearance),preview=new T.Scene(),camera=new T.PerspectiveCamera(32,width/height,.01,1000),target=new T.WebGLRenderTarget(width,height),renderer=this.renderer,previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),shadows=renderer.shadowMap.enabled;

  const parts=model.userData.parts;for(const o of [...parts.blur,parts.wake,parts.downwash])if(o)o.visible=false;

  // Bounding only visible detailed geometry excludes hidden smoke and the far

  // LOD copy, keeping bikes and the largest aircraft equally well framed.

  const lod=model.userData.lod;lod.autoUpdate=false;lod.levels.forEach((l,i)=>l.object.visible=i===0);model.updateMatrixWorld(true);

  const bounds=new T.Box3();model.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});

  const center=bounds.getCenter(new T.Vector3());model.position.sub(center);

  const direction=new T.Vector3(1,.65,1.35).normalize();camera.position.copy(direction);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);

  const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1),tanV=Math.tan(16*Math.PI/180),tanH=tanV*camera.aspect;let distance=1;

  for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){const corner=new T.Vector3(x,y,z).sub(center),depth=corner.dot(direction);distance=Math.max(distance,depth+Math.abs(corner.dot(right))*1.12/tanH,depth+Math.abs(corner.dot(up))*1.12/tanV);}

  camera.position.copy(direction).multiplyScalar(distance);camera.lookAt(0,0,0);camera.far=Math.max(100,distance*5);camera.updateProjectionMatrix();

  target.texture.colorSpace=T.SRGBColorSpace;preview.background=new T.Color('#102a32');preview.add(model,new T.HemisphereLight('#e9f4ff','#5a6966',2.5));const light=new T.DirectionalLight('#fff0d7',3);light.position.set(3,6,5);preview.add(light);const rim=new T.DirectionalLight('#8ac5ea',1.7);rim.position.set(-4,2,-3);preview.add(rim);

  try{renderer.shadowMap.enabled=false;renderer.setRenderTarget(target);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.render(preview,camera);const pixels=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(data,0,0);const image=canvas.toDataURL('image/png');if(this.vehiclePreviews.size>=48)this.vehiclePreviews.delete(this.vehiclePreviews.keys().next().value);this.vehiclePreviews.set(key,image);return image;}

  finally{renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.shadowMap.enabled=shadows;target.dispose();root.CityVehicleModels.dispose(model);}

 }

 renderShopPreview(appearance,weaponId=null){

  if(this.disposed||!appearance||!root.CityPeopleModels||root.CityPeople?.validateAppearance(appearance).length)return '';

  if(weaponId)return this.weaponPreview(weaponId);

  const key=JSON.stringify(appearance);this.shopPreviewCache??=new Map();

  if(this.shopPreviewCache.has(key)){const image=this.shopPreviewCache.get(key);this.shopPreviewCache.delete(key);this.shopPreviewCache.set(key,image);return image;}

  // A separate actor, scene, camera and render target make browsing side-effect

  // free. Only PNGs are cached; no extra character/target survives rendering.

  const T=this.T,P=root.CityPeopleModels,width=360,height=420,model=P.create({...appearance},{lod:0}),scene=new T.Scene(),camera=new T.PerspectiveCamera(31,width/height,.01,30),target=new T.WebGLRenderTarget(width,height),renderer=this.renderer,previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),shadows=renderer.shadowMap.enabled;

  model.rotation.y=.24;P.animate(model,{mode:'idle',speed:0,weapon:null},0,0);model.updateMatrixWorld(true);const bounds=new T.Box3();model.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());model.position.sub(center);const distance=Math.max(size.y/(2*Math.tan(31*Math.PI/360))*1.13,size.x/(2*Math.tan(31*Math.PI/360)*camera.aspect)*1.13);camera.position.set(0,.05,distance);camera.lookAt(0,0,0);

  target.texture.colorSpace=T.SRGBColorSpace;scene.background=new T.Color('#142b32');scene.add(model,new T.HemisphereLight('#e7f4f2','#596873',2.4));const keyLight=new T.DirectionalLight('#fff0d7',3.2);keyLight.position.set(-2,4,5);const rim=new T.DirectionalLight('#9bbecb',2);rim.position.set(3,2,-4);scene.add(keyLight,rim);

  try{renderer.shadowMap.enabled=false;renderer.setRenderTarget(target);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.render(scene,camera);const pixels=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height);for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(image,0,0);const url=canvas.toDataURL('image/png');if(this.shopPreviewCache.size>=48)this.shopPreviewCache.delete(this.shopPreviewCache.keys().next().value);this.shopPreviewCache.set(key,url);return url;}

  finally{renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.shadowMap.enabled=shadows;target.dispose();P.dispose(model);scene.clear();}

 }

 weaponPreview(id){

  if(id==='unarmed'||this.disposed)return '';this.weaponPreviews??=new Map();if(this.weaponPreviews.has(id))return this.weaponPreviews.get(id);

  const T=this.T,width=320,height=128,model=root.CityPeopleModels.weaponModel(id),preview=new T.Scene(),camera=new T.PerspectiveCamera(32,width/height,.01,20),target=new T.WebGLRenderTarget(width,height),previous=this.renderer.getRenderTarget(),viewport=this.renderer.getViewport(new T.Vector4());

  target.texture.colorSpace=T.SRGBColorSpace;preview.background=new T.Color('#12343d');preview.add(model,new T.HemisphereLight('#eef6ff','#536369',3));const light=new T.DirectionalLight('#fff0d8',3);light.position.set(2,3,4);preview.add(light);

  const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());model.position.sub(center);const distance=Math.max(.45,size.y/(2*Math.tan(16*Math.PI/180))*1.25,Math.max(size.x,size.z)/(2*Math.tan(16*Math.PI/180)*(width/height))*1.35);camera.position.set(1,.25,.35).normalize().multiplyScalar(distance);camera.lookAt(0,0,0);

  try{this.renderer.setRenderTarget(target);this.renderer.render(preview,camera);const pixels=new Uint8Array(width*height*4);this.renderer.readRenderTargetPixels(target,0,0,width,height,pixels);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(data,0,0);const image=canvas.toDataURL('image/png');this.weaponPreviews.set(id,image);return image;}

  finally{this.renderer.setRenderTarget(previous);this.renderer.setViewport(viewport);target.dispose();root.CityPeopleModels.dispose(model);}

 }

 updatePhysicalDebug(sim){if(this.physicalDebug){this.scene.remove(this.physicalDebug);this.physicalDebug.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.physicalDebug=null;}if(sim.debugPhysics!==true||!root.CityPhysicalReactions)return;const T=this.T,R=root.CityPhysicalReactions,group=new T.Group();group.name='physical-diagnostics';this.scene.add(group);this.physicalDebug=group;const p=sim.player,actors=[p,...sim.npcs].filter(n=>n.physical&&Math.hypot(n.x-p.x,n.z-p.z)<30).slice(0,4),addLine=(a,b,color)=>{const g=new T.BufferGeometry().setFromPoints([new T.Vector3(a.x,a.y,a.z),new T.Vector3(b.x,b.y,b.z)]),m=new T.LineBasicMaterial({color,depthTest:false});group.add(new T.Line(g,m));};for(const n of actors){for(const body of R.bodies(n)){addLine(body.start,body.end,'#fb74d8');for(const endpoint of[body.start,body.end]){const ring=[];for(let i=0;i<=16;i++)ring.push(new T.Vector3(endpoint.x+Math.cos(i*Math.PI/8)*body.radius,endpoint.y,endpoint.z+Math.sin(i*Math.PI/8)*body.radius));group.add(new T.Line(new T.BufferGeometry().setFromPoints(ring),new T.LineBasicMaterial({color:'#fb74d8',depthTest:false})));}}for(const point of Object.values(n.physical.points))if(point.contact)addLine(point,{...point,y:point.y+.15},'#ffe152');const hit=n.physical.lastImpact;if(hit)addLine(hit.point,{x:hit.point.x+hit.direction.x,y:hit.point.y+hit.direction.y,z:hit.point.z+hit.direction.z},'#52ddff');}}

 updateObjective(sim){const T=this.T,o=root.CityMissions?.objective?root.CityMissions.objective(sim):null;let pos=o?.pos;if(o?.type==='board'){const candidates=(sim.vehicles||[]).filter(v=>v.health>0&&(o.typeId?v.typeId===o.typeId:v.category==='land'));candidates.sort((a,b)=>Math.hypot(a.x-sim.player.x,a.z-sim.player.z)-Math.hypot(b.x-sim.player.x,b.z-sim.player.z));pos=candidates[0];}const cargo=!!o&&['interact','deliver'].includes(o.type)&&o.key!=='clue',key=o?(o.id||sim.mission?.id+':'+sim.mission?.index):'';this.objectiveMarker.visible=!!pos;if(!pos)return;if(this.objectiveKey!==key){this.objectiveKey=key;for(const m of [...this.objectiveMarker.children]){this.objectiveMarker.remove(m);m.geometry?.dispose();m.material?.dispose();}const air=o.type==='gate'&&o.category==='plane',radius=air?o.radius:Math.max(1.2,Math.min(o.radius||2.8,o.type==='gate'?14:9));const ring=new T.Mesh(new T.TorusGeometry(radius,air?.48:.075,6,air?48:32),new T.MeshBasicMaterial({color:cargo?'#66dfef':'#e6c270',transparent:true,opacity:.9,depthWrite:false}));if(!air)ring.rotation.x=Math.PI/2;this.objectiveMarker.add(ring);if(!air){const marker=new T.Mesh(new T.ConeGeometry(.35,.75,5),new T.MeshBasicMaterial({color:cargo?'#66dfef':'#e6c270'}));marker.rotation.x=Math.PI;marker.position.y=3;this.objectiveMarker.add(marker);}if(cargo&&o.type==='interact'){const crate=new T.Mesh(new T.BoxGeometry(.8,.56,.6),new T.MeshStandardMaterial({color:'#326d81',roughness:.6,metalness:.2}));crate.position.y=.35;this.objectiveMarker.add(crate);for(const x of[-.26,.26]){const stripe=new T.Mesh(new T.BoxGeometry(.08,.59,.63),new T.MeshStandardMaterial({color:'#8aecf0',emissive:'#8aecf0',emissiveIntensity:.35}));stripe.position.set(x,.35,0);this.objectiveMarker.add(stripe);}}this.objectiveMarker.userData.air=air;this.objectiveMarker.userData.cargo=cargo;}const air=this.objectiveMarker.userData.air;this.objectiveMarker.position.set(pos.x,air?pos.y:Math.max(pos.y||0,this.world.groundHeight(pos.x,pos.z,pos.y??Infinity))+.13,pos.z);if(air){const normal=sim.mission?.gateNormal||o.normal||{x:0,z:1};this.objectiveMarker.rotation.y=Math.atan2(normal.x,normal.z);}else{this.objectiveMarker.rotation.y=0;if(this.objectiveMarker.children[1])this.objectiveMarker.children[1].position.y=2.8+Math.sin(this.time*2)*.2;}}

 aimRay(){const v=new this.T.Vector3();this.camera.getWorldDirection(v);return{origin:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z},direction:{x:v.x,y:v.y,z:v.z}};}

 setGraphics(values,controller){this.graphicsValues=values;this.graphicsController=controller||this.graphicsController;this.applySettings(this.lastSettings||{});this.resize();}

 applySettings(settings){this.lastSettings=settings;const values=this.graphicsValues,quality=values?JSON.stringify([values.preset,values.distance,values.lighting,values.shadows,values.detail,values.particles,values.reflections,values.modelDetail,values.modelDetailLevel,values.modelDetailPreset,values.smokeParticles,values.smokeParticleBudget]):settings.quality||'medium',preset=values?root.CityGraphics.resolve(values):root.CityGraphics.get(quality),scale=values?1:Math.min(C(settings.scale??1,.25,1),preset.scale);if(quality!==this.quality){

  const rebuild=!this.graphics||['detailRadius','materialDetail','detailFraction'].some(k=>this.graphics[k]!==preset[k]);this.quality=quality;this.graphics=preset;this.setModelDetail(preset.modelDetail);if(rebuild){this.clearPreparedDistricts();this.lastChunk='';for(const g of this.detailChunks.values()){this.environment.remove(g);g.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}this.detailChunks.clear();this.detailQueue=[];}

  this.renderer.shadowMap.enabled=!!preset.shadowSize;this.renderer.shadowMap.type=preset.shadowFilter==='soft'?this.T.PCFSoftShadowMap:this.T.PCFShadowMap;this.sun.shadow.radius=preset.shadowRadius;this.sun.shadow.normalBias=.055;this.sun.shadow.bias=-.0003;this.sun.visible=preset.lighting!=='ambient';for(const light of this.headlights||[])light.visible=!values||preset.lighting==='full';

  const shadowSize=Math.min(preset.shadowSize||512,this.renderer.capabilities.maxTextureSize);if(this.sun.shadow.mapSize.x!==shadowSize||!preset.shadowSize){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(shadowSize,shadowSize);}const extent=Math.max(1,preset.shadowExtent);Object.assign(this.sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});this.sun.shadow.camera.updateProjectionMatrix();this.renderer.shadowMap.needsUpdate=true;

  if(this.environmentSize!==preset.environmentSize){this.setEnvironment(preset.environmentSize);this.environmentSize=preset.environmentSize;}for(const texture of this.signTextures){texture.anisotropy=Math.min(preset.anisotropy,this.renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;}this.rain.geometry.setDrawRange(0,values?.particles==='low'?80:values?.particles==='medium'?180:350);this.camera.far=values?Math.max(600,values.distance+400):4800;this.camera.updateProjectionMatrix();

  this.scene.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.needsUpdate=true;});});

 }if(scale!==this.resolutionScale){this.resolutionScale=scale;this.resize();}}

 setModelDetail(level=5){level=C(Math.round(level||5),1,5);if(level===this.modelDetail)return;this.modelDetail=level;
  // Shared scenery geometry is replaced in place; authoritative world colliders never change.
  const old=new Map(this.geometries),replacements=new Map();this.geometries.clear();for(const[type,geo]of old)replacements.set(geo,this.geometry(type));this.scene.traverse(o=>{if(replacements.has(o.geometry)){o.geometry=replacements.get(o.geometry);if(o.isInstancedMesh){o.computeBoundingSphere();o.computeBoundingBox();}}});for(const geo of old.values())geo.dispose();
  const water=this.water.geometry,n=[0,20,32,50,72,100][level];this.water.geometry=new this.T.PlaneGeometry(4000,4000,n,n);this.water.geometry.rotateX(-Math.PI/2);water.dispose();this.waterLast=-Infinity;
  for(const r of this.peopleLODCache.values())root.CityPeopleModels.dispose(r.mesh);this.peopleLODCache.clear();
  for(const display of this.shopDisplays||[])display.userData.models=display.userData.models.map(model=>{const appearance=model.userData.rig?.appearance;if(!appearance)return model;const replacement=root.CityPeopleModels.create(appearance,{lod:0,modelDetail:level});replacement.position.copy(model.position);replacement.quaternion.copy(model.quaternion);replacement.name=model.name;display.remove(model);root.CityPeopleModels.dispose(model);display.add(replacement);return replacement;});
  if(this.characterPreviews){for(const model of this.characterPreviews.values()){model.removeFromParent();root.CityPeopleModels.dispose(model);}this.characterPreviews.clear();}else if(this.preview){this.preview.removeFromParent();root.CityPeopleModels.dispose(this.preview);}this.preview=null;this.previewKey=null;this.vehiclePreviews?.clear();this.shopPreviewCache?.clear();
 }

 setEnvironment(size){this.environmentMap?.dispose();this.environmentMap=null;this.scene.environment=null;if(!size)return;const canvas=document.createElement('canvas');canvas.width=size*2;canvas.height=size;const c=canvas.getContext('2d'),sky=c.createLinearGradient(0,0,0,size);sky.addColorStop(0,'#597a91');sky.addColorStop(.46,'#d3dfdf');sky.addColorStop(.53,'#939484');sky.addColorStop(1,'#3e4744');c.fillStyle=sky;c.fillRect(0,0,canvas.width,size);for(let i=0;i<28;i++){const height=(.02+(i*17%23)/300)*size;c.fillStyle=i%2?'#a7b8ba':'#85999e';c.fillRect(i*canvas.width/28,size*.49-height,canvas.width/29,height);}const texture=new this.T.CanvasTexture(canvas);texture.mapping=this.T.EquirectangularReflectionMapping;texture.colorSpace=this.T.SRGBColorSpace;this.environmentMap=texture;this.scene.environment=texture;}

 resize(){const w=this.canvas.clientWidth||window.innerWidth,h=this.canvas.clientHeight||window.innerHeight;const size=this.graphicsController?this.graphicsController.renderSize(w,h):root.Platdo?.renderSize?root.Platdo.renderSize(w,h):{width:w,height:h},scale=this.resolutionScale||1;this.renderer.setPixelRatio(1);this.renderer.setSize(Math.max(1,Math.round((size.width||size.w||w)*scale)),Math.max(1,Math.round((size.height||size.h||h)*scale)),false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}

 stats(){return{...this.renderer.info.render,width:this.canvas.width,height:this.canvas.height,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,detailChunks:this.detailChunks.size,preparedDistricts:this.preparedDistricts?.size||0,prepared:this.prepared===true,staticVisible:(this.staticRanges||[]).filter(r=>r.object.visible).length,staticTotal:this.staticRanges?.length||0,people:this.meshes.people.size,cachedPeopleLODs:this.peopleLODCache.size,peopleModelBuilds:this.peopleModelBuilds,blood:this.blood?.diagnostics(),viewCulling:true,vehicles:this.meshes.vehicles.size,collisionReady:true,tireSmoke:this.tireSmoke.filter(p=>p.mesh.visible).length,smokeEmitted:this.smokeSequence,shadowSize:this.renderer.shadowMap.enabled?this.sun.shadow.mapSize.x:0,lighting:this.graphics?.lighting||'full',modelDetail:this.modelDetail,waterVertices:this.water.geometry.attributes.position.count,peopleVisible:[...this.meshes.people.values()].filter(r=>r.mesh.visible).length,vehiclesVisible:[...this.meshes.vehicles.values()].filter(r=>r.mesh.visible).length};}

 dispose(){if(this.disposed)return;this.disposed=true;this.clearPreparedDistricts();this.shopPreviewCache?.clear();this.vehiclePreviews?.clear();this.weaponPreviews?.clear();this.breakup?.dispose();this.detailQueue.length=0;for(const r of this.peopleLODCache.values())root.CityPeopleModels?.dispose?.(r.mesh);this.peopleLODCache.clear();for(const r of this.meshes.people.values())root.CityPeopleModels?.dispose?.(r.mesh);for(const r of this.meshes.vehicles.values())root.CityVehicleModels?.dispose?.(r.mesh);const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.signTextures.forEach(t=>t.dispose());this.tireSmokeTexture?.dispose();this.bloodTexture?.dispose();this.environmentMap?.dispose();this.renderer.dispose();this.scene.clear();}

}

CityScene.create=(canvas,world,options)=>new CityScene(canvas,world,options);root.CityScene=CityScene;

})(typeof globalThis!=='undefined'?globalThis:this);


























