
/* Quality tiers: real render budgets and effects, independent of simulation. */
(()=>{'use strict';
const T=window.THREE,Scene=window.DriveScene;if(!T||!Scene)return;
const profiles={
  potato:{label:'Potato',scale:.25,shadow:0,near:35,far:150,grass:0,shrubs:0,trees:.08,aniso:1,reflection:0,ao:0,bloom:0,effects:0,description:'Quarter-resolution, sparse scenery, simple surfaces, no dynamic shadows.'},
  low:{label:'Low',scale:.75,shadow:0,near:90,far:390,grass:0,shrubs:0,trees:.45,aniso:2,reflection:0,ao:0,bloom:0,effects:.4,description:'Light scenery and contact shadows. Built for slower computers.'},
  medium:{label:'Medium',scale:1,shadow:1024,near:130,far:530,grass:0,shrubs:0,trees:.75,aniso:4,reflection:0,ao:0,bloom:0,effects:.7,description:'Balanced detail and dynamic shadows.'},
  high:{label:'High',scale:1,shadow:2048,near:130,far:670,grass:1200,shrubs:80,trees:1,aniso:8,reflection:0,ao:0,bloom:0,effects:1,description:'Detailed cars, road surfaces, roadside grass and crisp sun shadows.'},
  epic:{label:'Epic',scale:1,shadow:4096,near:170,far:850,grass:7000,shrubs:250,trees:1,aniso:8,reflection:128,reflectionDelay:2,ao:8,msaa:2,bloom:0,effects:1,description:'HDR reflections, surface relief, contact shading and multisample antialiasing.'},
  ultra:{label:'Ultra',scale:1,shadow:4096,near:220,far:1100,grass:20000,shrubs:650,trees:1,aniso:16,reflection:256,reflectionDelay:1.2,ao:16,msaa:4,bloom:0,effects:1,description:'Finer car and roadside detail, dense foliage and sharper reflections. Demanding.'},
  insane:{label:'Insane',scale:1,shadow:4096,near:270,far:1450,grass:48000,shrubs:1500,trees:1,aniso:16,reflection:512,reflectionDelay:.7,ao:24,msaa:4,bloom:0,effects:1,description:'Maximum geometry, foliage, reflection resolution and contact shading. Very demanding.'}
};
window.DriveGraphicsProfiles=profiles;
function seedRandom(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function texture(size,draw){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
function makeSurfaceTextures(){const rng=seedRandom(62491);const road=texture(512,(c,n)=>{c.fillStyle='#a6a6a6';c.fillRect(0,0,n,n);for(let i=0;i<42000;i++){const v=70+rng()*165;c.fillStyle=`rgb(${v},${v},${v})`;const r=.3+rng()*1.1;c.fillRect(rng()*n,rng()*n,r,r);}});
  // Height and roughness are different physical quantities. Reusing dark height
  // noise as roughness had made the upgraded dry road look polished and wet.
  const roadRoughness=texture(512,(c,n)=>{c.fillStyle='#eeeeee';c.fillRect(0,0,n,n);for(let i=0;i<16000;i++){const v=215+rng()*40;c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(rng()*n,rng()*n,1+rng()*2,1+rng()*2);}});
  const water=texture(256,(c,n)=>{const im=c.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=x/n*Math.PI*2,v=y/n*Math.PI*2,i=(y*n+x)*4;im.data[i]=128+Math.sin(u*8+Math.sin(v*3))*22+Math.sin(v*15)*12;im.data[i+1]=128+Math.cos(v*6+Math.cos(u*4))*20;im.data[i+2]=249;im.data[i+3]=255;}c.putImageData(im,0,0);});water.repeat.set(500,500);return{road,roadRoughness,water};}
function createPlants(s,g){if(g.plants)return;const rng=seedRandom(831994),dummy=new T.Object3D(),color=new T.Color(),count=48000,halfWidth=s.route.halfWidth||s.route.map?.width/2||8;
  const covered=p=>[s.route.map?.bridge,s.route.map?.tunnel].some(range=>range&&p.s/s.route.length>=range.start&&p.s/s.route.length<=range.end);
  const buildingCells=new Map();for(const b of s.buildingFootprints||[]){const radius=Math.hypot(b.w,b.d)*.5+1;for(let x=Math.floor((b.x-radius)/32);x<=Math.floor((b.x+radius)/32);x++)for(let z=Math.floor((b.z-radius)/32);z<=Math.floor((b.z+radius)/32);z++){const key=x+','+z;if(!buildingCells.has(key))buildingCells.set(key,[]);buildingCells.get(key).push(b);}}
  const insideBuilding=(x,z)=>(buildingCells.get(Math.floor(x/32)+','+Math.floor(z/32))||[]).some(b=>{const dx=x-b.x,dz=z-b.z,c=Math.cos(b.ry),n=Math.sin(b.ry);return Math.abs(dx*c-dz*n)<b.w*.5+.8&&Math.abs(dx*n+dz*c)<b.d*.5+.8;});
  const blade=new T.BufferGeometry();blade.setAttribute('position',new T.Float32BufferAttribute([-.05,0,0,.05,0,0,.02,.5,.04,.02,.5,.04,.05,0,0,.055,.25,.01],3));blade.computeVertexNormals();
  const material=new T.MeshStandardMaterial({color:'#92a267',roughness:1,side:T.DoubleSide});
  const wind={value:0};material.onBeforeCompile=shader=>{shader.uniforms.driveWind=wind;shader.vertexShader='uniform float driveWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(driveWind + instanceMatrix[3].x*.33 + instanceMatrix[3].z*.21)*position.y*position.y*.20;');};
  const grass=new T.InstancedMesh(blade,material,count);grass.receiveShadow=true;grass.castShadow=false;grass.count=0;
  // Spread deterministic patches around the entire route, with readable clear shoulders.
  for(let i=0;i<count;i++){const p=s.route.at(rng()*s.route.length),side=rng()<.5?-1:1,offset=side*(halfWidth+2.8+rng()*22),x=p.x+p.nx*offset,z=p.z+p.nz*offset,y=s.groundHeight(x,z);dummy.position.set(x,y,z);dummy.rotation.set(0,rng()*Math.PI*2,0);const height=.4+rng()*.9;dummy.scale.set(.6+rng(),height,.7+rng());if(y<-2||covered(p)||insideBuilding(x,z))dummy.scale.setScalar(0);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);color.setHSL(.20+rng()*.055,.28+rng()*.2,.23+rng()*.13);grass.setColorAt(i,color);}
  grass.computeBoundingSphere();s.scene.add(grass);
  // Quality-only low groundcover remains below 0.15m and does not block cars.
  // Actual bushes live in the persistent world scenery registry. Three lobes use 60 triangles
  // instead of the former single 80-triangle ellipsoid. Still one instanced draw.
  const bushPositions=[];for(const [cx,cy,cz,scale]of[[-.38,-.08,.09,.66],[.31,-.02,.14,.73],[0,.19,-.26,.61]]){const lobe=new T.IcosahedronGeometry(1,0),a=lobe.attributes.position;for(let i=0;i<a.count;i++)bushPositions.push(cx+a.getX(i)*scale,cy+a.getY(i)*scale,cz+a.getZ(i)*scale);lobe.dispose();}const bushGeometry=new T.BufferGeometry();bushGeometry.setAttribute('position',new T.Float32BufferAttribute(bushPositions,3));bushGeometry.computeVertexNormals();
  const bushMaterial=new T.MeshStandardMaterial({color:'#5d7740',roughness:.96});const bushes=new T.InstancedMesh(bushGeometry,bushMaterial,1500);bushes.castShadow=true;bushes.receiveShadow=true;bushes.count=0;
  for(let i=0;i<1500;i++){const p=s.route.at(rng()*s.route.length),offset=(rng()<.5?-1:1)*(halfWidth+8+rng()*27),x=p.x+p.nx*offset,z=p.z+p.nz*offset,y=s.groundHeight(x,z),size=.25+rng()*.65;dummy.position.set(x,y+size*.045,z);dummy.rotation.set(0,rng()*6,0);dummy.scale.set(size*.55,size*.075,size*.42);if(y<-1||covered(p)||insideBuilding(x,z))dummy.scale.setScalar(0);dummy.updateMatrix();bushes.setMatrixAt(i,dummy.matrix);color.setHSL(.18+rng()*.07,.25+rng()*.15,.22+rng()*.15);bushes.setColorAt(i,color);}bushes.computeBoundingSphere();s.scene.add(bushes);g.plants={grass,bushes,wind};
}
function graphics(s){if(s.graphics)return s.graphics;const g=s.graphics={profile:profiles.medium,key:'',reflectionClock:Infinity,reflection:null,post:null,plants:null,surfaces:null,decor:[],size:new T.Vector2(),frames:0};
  for(const m of s.scene.children)if(m.isInstancedMesh&&m.userData.environmentTier===undefined&&['IcosahedronGeometry','DodecahedronGeometry','CylinderGeometry'].includes(m.geometry.type))g.decor.push({mesh:m,count:m.count,array:m.instanceMatrix.array.slice()});
  return g;
}
function supportsHDR(s){return s.renderer.capabilities.isWebGL2&&s.renderer.extensions.has('EXT_color_buffer_float');}
function setReflection(s,g,size){
  size=Math.min(size,s.renderer.capabilities.maxCubemapSize||512);if(g.reflection?.size===size)return;
  if(g.reflection){s.scene.environment=null;const r=g.reflection;if(r.filtered){r.filtered.texture.dispose();r.filtered.dispose();}r.target.texture.dispose();r.target.dispose();s.scene.remove(r.camera);g.reflection=null;}
  if(!size)return;
  // A captured environment is radiance, not a display image. Preserve values above
  // one so metals receive a highlight instead of a flat, clipped white reflection.
  const target=new T.WebGLCubeRenderTarget(size,{generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter,type:supportsHDR(s)?T.HalfFloatType:T.UnsignedByteType,colorSpace:T.LinearSRGBColorSpace});
  // The sky sphere is 2100 m across its radius; a 900 m reflection far plane
  // dropped it entirely and gave the paint a featureless grey environment.
  const camera=new T.CubeCamera(.3,Math.max(2300,s.camera.far),target);s.scene.add(camera);
  // Own the filtered target explicitly: r159's automatic dynamic cubemap path
  // does not attach its usual disposal listener and leaks a target per switch.
  if(!g.pmrem)g.pmrem=new T.PMREMGenerator(s.renderer);
  g.reflection={size,target,camera,filtered:null};g.reflectionClock=Infinity;
}
function tuneReflections(s){
  const seen=new Set();s.scene.traverse(o=>{for(const m of(o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){
    if(!m.isMeshStandardMaterial||seen.has(m))continue;seen.add(m);
    const kind=m.userData.driveReflective;
    // Diffuse daylight already comes from the hemisphere and sun. The capture adds
    // restrained material reflections, not another full-strength ambient light.
    m.envMapIntensity=m.userData.driveWrap?m.userData.driveWrapIntensity:kind==='paint'?.42:kind==='glass'||m===s.water.material?.32:m.metalness>.65?.55:m.metalness>.15?.28:.075;
  }});
}
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const fragment=`uniform sampler2D colorMap;uniform sampler2D depthMap;uniform vec2 pixel;uniform float cameraFar;uniform int samples;uniform mat4 projection;uniform mat4 inverseProjection;varying vec2 vUv;
vec3 positionAt(vec2 uv){float depth=texture2D(depthMap,clamp(uv,vec2(0.),vec2(1.))).r;vec4 p=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/p.w;}
void main(){
  vec3 color=texture2D(colorMap,vUv).rgb;
  vec3 center=positionAt(vUv);float occlusion=0.;
  if(samples>0&&-center.z<min(cameraFar*.96,180.)){
    // Pick the nearer depth derivative at silhouettes; distant sky/road must not
    // create a broad dark fringe around cars and roadside foliage.
    vec3 left=center-positionAt(vUv-vec2(pixel.x,0.)),right=positionAt(vUv+vec2(pixel.x,0.))-center;
    vec3 down=center-positionAt(vUv-vec2(0.,pixel.y)),up=positionAt(vUv+vec2(0.,pixel.y))-center;
    vec3 normal=normalize(cross(abs(left.z)<abs(right.z)?left:right,abs(down.z)<abs(up.z)?down:up));
    if(dot(normal,-center)<0.)normal=-normal;
    vec3 tangent=normalize(cross(abs(normal.z)>.9?vec3(0.,1.,0.):vec3(0.,0.,1.),normal));
    vec3 bitangent=cross(normal,tangent);
    for(int i=0;i<24;i++){
      if(i>=samples)break;
      float f=float(i)+.5,a=f*2.399963;
      float radius=.12+.8*sqrt(f/float(samples));
      vec3 direction=(tangent*cos(a)+bitangent*sin(a))*.83+normal*.56;
      vec3 probe=center+direction*radius;
      vec4 clip=projection*vec4(probe,1.);vec2 uv=clip.xy/clip.w*.5+.5;
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
      vec3 found=positionAt(uv);float separation=length(found-center);
      occlusion+=smoothstep(.025,.12,found.z-probe.z)*(1.-smoothstep(.55,1.2,separation));
    }
    occlusion/=float(samples);
  }
  color*=1.-occlusion*.36;
  gl_FragColor=vec4(color,1.);
  // Three r159 deliberately leaves offscreen scene renders linear and untone-
  // mapped. Exactly one final ACES + sRGB conversion matches the direct path.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function supportedSamples(s,requested){
  const gl=s.renderer.getContext(),available=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]).filter(n=>n>0);
  if(!requested||!available.length)return 0;
  // Some drivers expose 4x as their only HDR sample count. Use it rather than
  // silently dropping Epic's requested 2x to no antialiasing at all.
  const within=available.filter(n=>n<=requested);return within.length?Math.max(...within):Math.min(...available);
}
function setPost(s,g,enabled){
  const samples=enabled?supportedSamples(s,g.profile.msaa||0):0;
  if(g.post&&(!enabled||g.post.target.samples!==samples)){
    g.post.target.depthTexture.dispose();g.post.target.texture.dispose();g.post.target.dispose();g.post.mesh.geometry.dispose();g.post.material.dispose();g.post=null;
  }
  if(!enabled||g.post)return;
  const target=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,type:T.HalfFloatType,colorSpace:T.LinearSRGBColorSpace,samples});
  target.texture.name='Drive linear HDR scene';target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  const material=new T.ShaderMaterial({name:'Drive HDR output',uniforms:{colorMap:{value:target.texture},depthMap:{value:target.depthTexture},pixel:{value:new T.Vector2()},cameraFar:{value:2300},samples:{value:g.profile.ao},projection:{value:new T.Matrix4()},inverseProjection:{value:new T.Matrix4()}},vertexShader:vertex,fragmentShader:fragment,depthWrite:false,depthTest:false,toneMapped:true});
  const scene=new T.Scene(),camera=new T.Camera(),mesh=new T.Mesh(new T.PlaneGeometry(2,2),material);scene.add(mesh);g.post={target,material,scene,camera,mesh};resizePost(s,g);
}
function resizePost(s,g){if(!g.post)return;s.renderer.getDrawingBufferSize(g.size);if(g.post.target.width!==g.size.x||g.post.target.height!==g.size.y)g.post.target.setSize(g.size.x,g.size.y);g.post.material.uniforms.pixel.value.set(1/g.size.x,1/g.size.y);}
function apply(s,key){const g=graphics(s);restoreCull(g);const v=s.settings.graphicsValues,base=profiles[v?.detail]||profiles[key]||profiles.medium,p={...base};if(v){p.far=v.distance;p.near=Math.min(p.near,p.far*.45);p.shadow=v.lighting==='simple'?0:Number(v.shadows);p.reflection=Number(v.reflections);p.ao=Number(v.ao);p.effects={off:0,low:.35,medium:.7,high:1}[v.particles]??.7;p.reflectionDelay=p.reflection>=512?.7:p.reflection>=256?1.2:2;}g.profile=p;g.key=key;s.settings.damageEffectScale=p.effects;s.sun.visible=v?.lighting!=='simple';if(s.tunnelLight)s.tunnelLight.visible=v?.lighting!=='simple';
  // Quality changes detail budgets, never the daylight exposure or black level.
  s.renderer.toneMapping=T.ACESFilmicToneMapping;s.renderer.toneMappingExposure=1.04;s.renderer.outputColorSpace=T.SRGBColorSpace;
  const shadow=Math.min(p.shadow,s.renderer.capabilities.maxTextureSize||4096);s.renderer.shadowMap.enabled=shadow>0;if(shadow&&s.sun.shadow.mapSize.x!==shadow){s.sun.shadow.map?.dispose();s.sun.shadow.map=null;s.sun.shadow.mapSize.set(shadow,shadow);}s.scene.fog.near=p.near;s.scene.fog.far=p.far;
  for(const d of g.decor){const count=Math.max(1,Math.floor(d.count*p.trees));for(let i=0;i<count;i++){const start=Math.floor(i*d.count/count)*16;d.mesh.instanceMatrix.array.set(d.array.subarray(start,start+16),i*16);}d.mesh.count=count;d.mesh.instanceMatrix.needsUpdate=true;d.mesh.visible=p.trees>0;}
  if(p.grass)createPlants(s,g);if(g.plants){g.plants.grass.count=p.grass;g.plants.bushes.count=p.shrubs;g.plants.grass.visible=p.grass>0;g.plants.bushes.visible=p.shrubs>0;}
  const detailed=p.reflection>0,surfaceDetail=p.shadow>=2048||detailed;if(surfaceDetail&&!g.surfaces)g.surfaces=makeSurfaceTextures();s.materials.road.bumpMap=surfaceDetail?g.surfaces.road:null;s.materials.road.bumpScale=.012;s.materials.road.roughnessMap=surfaceDetail?g.surfaces.roadRoughness:null;s.materials.road.roughness=surfaceDetail?.75:.7;s.materials.road.needsUpdate=true;
  s.water.material.normalMap=detailed?g.surfaces.water:null;s.water.material.normalScale.set(.23,.23);s.water.material.roughness=detailed?.28:.48;s.water.material.metalness=.02;s.water.material.needsUpdate=true;
  s.terrain.material.map=key==='potato'?null:s.materials.grass.map;s.terrain.material.needsUpdate=true;s.sky.visible=key!=='potato';
  s.scene.traverse(o=>{const materials=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of materials){for(const field of['map','bumpMap','normalMap','roughnessMap'])if(m[field]){m[field].anisotropy=Math.min(p.aniso,s.renderer.capabilities.getMaxAnisotropy());m[field].needsUpdate=true;}}});
  if(s.setVisualQuality)s.setVisualQuality(v?.detail||key);if(s.setEnvironmentQuality)s.setEnvironmentQuality(v?.detail||key);tuneReflections(s);
  setReflection(s,g,p.reflection);setPost(s,g,(detailed||p.ao>0)&&supportsHDR(s));if(g.post)g.post.material.uniforms.samples.value=p.ao;
  g.cull=null;g.cullAt=-Infinity;g.stats={preset:key,modelDetail:s.modelDetailLevel,lighting:s.sun.visible?'sun + ambient':'ambient only',requestedContactSamples:p.ao,renderScale:p.scale,shadowSize:shadow,grassInstances:p.grass,shrubInstances:p.shrubs,reflectionSize:g.reflection?.size||0,contactSamples:g.post?p.ao:0,antialiasSamples:g.post?.target.samples||0,hdrPost:!!g.post,exposure:s.renderer.toneMappingExposure,bloom:0};
}
// Immutable instance sources and spatial cells avoid submitting the whole route's
// trees at every frame. No simulation entity or collision shape is removed.
function restoreCull(g){if(!g.cull)return;for(const r of g.cull.instances){r.mesh.instanceMatrix.array.set(r.matrix);if(r.color)r.mesh.instanceColor.array.set(r.color);r.mesh.count=r.count;r.mesh.instanceMatrix.needsUpdate=true;if(r.color)r.mesh.instanceColor.needsUpdate=true;r.mesh.visible=r.visible;r.mesh.frustumCulled=r.frustum;}for(const r of g.cull.props)r.mesh.visible=r.visible;g.cull=null;}
function prepareCull(s,g){const dynamic=new Set([s.playerCar,s.cockpit,s.sky,s.terrain,s.water,s.checkpoint,s.engineSmoke,s.collisionEffects,s.tireEffects,s.connectorClosures,...s.trafficMeshes.values()]),instances=[],props=[],box=new T.Box3(),sphere=new T.Sphere();s.scene.updateMatrixWorld(true);for(const mesh of s.scene.children){if(dynamic.has(mesh)||mesh.userData.sceneryDynamic||mesh.isLight||mesh.isCamera||!mesh.visible)continue;if(mesh.isInstancedMesh&&mesh.instanceMatrix.usage!==T.DynamicDrawUsage){const matrix=mesh.instanceMatrix.array.slice(),count=mesh.count,color=mesh.instanceColor?.array.slice(),cells=new Map();for(let i=0;i<count;i++){const j=i*16,x=matrix[j+12],z=matrix[j+14],key=Math.floor(x/128)+','+Math.floor(z/128);let cell=cells.get(key);if(!cell){cell={x:Math.floor(x/128)*128+64,z:Math.floor(z/128)*128+64,ids:[]};cells.set(key,cell);}cell.ids.push(i);}instances.push({mesh,matrix,color,count,cells,visible:mesh.visible,frustum:mesh.frustumCulled});mesh.frustumCulled=false;}else if(!mesh.isInstancedMesh&&(mesh.isMesh||mesh.isGroup)){box.setFromObject(mesh);box.getBoundingSphere(sphere);if(Number.isFinite(sphere.radius)&&sphere.radius<300)props.push({mesh,x:sphere.center.x,z:sphere.center.z,radius:sphere.radius,visible:mesh.visible});}}g.cull={instances,props};}
function updateCull(s,g,sim,view){const preview=s.route.at(18),p=view==='playing'?sim?.player:preview;if(!p)return;const distance=Math.max(g.profile.far,Math.abs(p.speed||0)*2.5+80),now=performance.now();s.effectiveRenderDistance=distance;s.scene.fog.far=distance;if(g.cull&&now-g.cullAt<120&&Math.hypot(p.x-g.cullX,p.z-g.cullZ)<6)return;if(!g.cull)prepareCull(s,g);g.cullAt=now;g.cullX=p.x;g.cullZ=p.z;let shown=0,total=0;for(const r of g.cull.instances){let n=0;const limit=distance+28;for(const cell of r.cells.values()){if((cell.x-p.x)**2+(cell.z-p.z)**2>(limit+91)**2)continue;for(const i of cell.ids){const j=i*16;if((r.matrix[j+12]-p.x)**2+(r.matrix[j+14]-p.z)**2>limit*limit)continue;r.mesh.instanceMatrix.array.set(r.matrix.subarray(j,j+16),n*16);if(r.color)r.mesh.instanceColor.array.set(r.color.subarray(i*3,i*3+3),n*3);n++;}}r.mesh.count=n;r.mesh.visible=n>0;r.mesh.instanceMatrix.needsUpdate=true;if(r.color)r.mesh.instanceColor.needsUpdate=true;shown+=n;total+=r.count;}let props=0;for(const r of g.cull.props){const margin=r.mesh.visible?25:0;r.mesh.visible=(r.x-p.x)**2+(r.z-p.z)**2<(distance+r.radius+margin)**2;if(r.mesh.visible)props++;}Object.assign(g.stats,{distance,effectiveDistance:distance,visibleInstances:shown,availableInstances:total,visibleProps:props,availableProps:g.cull.props.length});}
const originalSettings=Scene.prototype.setSettings,originalResize=Scene.prototype.resize,originalRender=Scene.prototype.render,originalDispose=Scene.prototype.dispose;
Scene.prototype.setSettings=function(settings){originalSettings.call(this,settings);apply(this,this.settings.quality);};
Scene.prototype.resize=function(w,h){originalResize.call(this,w,h);if(this.graphics)resizePost(this,this.graphics);};
Scene.prototype.render=function(sim,cameraMode,dt,view='playing'){const g=graphics(this);if(!g.key)apply(this,this.settings.quality);const p=g.profile;updateCull(this,g,sim,view);g.frames++;if(g.plants)g.plants.wind.value=this.settings.reducedMotion?0:this.time*.9;if(g.surfaces&&dt>0){g.surfaces.water.offset.x+=dt*.002;g.surfaces.water.offset.y+=dt*.0006;}g.reflectionClock+=dt;
  if(g.reflection&&g.reflectionClock>=p.reflectionDelay){g.reflectionClock=0;const r=g.reflection,preview=this.route.at(18),position=view==='playing'?sim?.player:{x:preview.x-preview.nx*2,y:preview.y,z:preview.z-preview.nz*2};r.camera.position.set(position?.x||0,(position?.y||0)+1.3,position?.z||0);const visible=this.playerCar.visible,cockpitVisible=this.cockpit.visible;this.playerCar.visible=false;this.cockpit.visible=false;this.scene.environment=null;tuneReflections(this);try{r.camera.update(this.renderer,this.scene);r.filtered=g.pmrem.fromCubemap(r.target.texture,r.filtered);}finally{this.playerCar.visible=visible;this.cockpit.visible=cockpitVisible;this.scene.environment=r.filtered?.texture||null;}}
  if(g.post){resizePost(this,g);this.renderer.setRenderTarget(g.post.target);try{originalRender.call(this,sim,cameraMode,dt,view);g.stats.drawCalls=this.renderer.info.render.calls;g.stats.triangles=this.renderer.info.render.triangles;}finally{this.renderer.setRenderTarget(null);}const u=g.post.material.uniforms;u.cameraFar.value=this.camera.far;u.projection.value.copy(this.camera.projectionMatrix);u.inverseProjection.value.copy(this.camera.projectionMatrixInverse);this.renderer.render(g.post.scene,g.post.camera);g.stats.drawCalls+=this.renderer.info.render.calls;g.stats.triangles+=this.renderer.info.render.triangles;}else{originalRender.call(this,sim,cameraMode,dt,view);g.stats.drawCalls=this.renderer.info.render.calls;g.stats.triangles=this.renderer.info.render.triangles;}
};
Scene.prototype.dispose=function(){const g=this.graphics;if(g){setReflection(this,g,0);setPost(this,g,false);g.pmrem?.dispose();if(g.surfaces)for(const t of Object.values(g.surfaces))t.dispose();}originalDispose.call(this);};
})();



