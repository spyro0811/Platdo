/* City home finishes affect the authored render recipe only. All collision and doors
 * stay owned by CityHomes. The two choices are independent and account-scoped. */
(function(root){
'use strict';
const defaultChoice={house:'original',garage:'original'};
const palettes={
  modern:{wall:'#edeae2',timber:'#c29d73',trim:'#303d40',roof:'#495250',cabinet:'#dadfd7',stone:'#9eaaa6',rug:'#719792',fabric:'#78908b',soft:'#ddd2b8',metal:'#506360'},
  cozy:{wall:'#a58670',timber:'#875f42',trim:'#534538',roof:'#4d403c',cabinet:'#8f9780',stone:'#b5a28c',rug:'#b17359',fabric:'#805d51',soft:'#d2aa80',metal:'#6a6554'}
};
const names={original:'Original',modern:'Modern Retreat',cozy:'Cozy Hideout',hangout:'Garage Hangout'};
let chosen={...defaultChoice},current={...defaultChoice},signature='original:original',uid=null,panel=null,display=null,stopped=false;
const storage=()=>root.Platdo?.storage?.('premium');
function allowed(id){return root.PlatdoPremium?.access(id)?.allowed===true;}
function normalize(input){return{house:palettes[input?.house]?input.house:'original',garage:input?.garage==='hangout'?'hangout':'original'};}
function refresh(account){
  const key=account.uid?account.uid+(root.PlatdoCity?.progressSuffix||''):null;if(key!==uid){uid=key;chosen={...defaultChoice};if(uid)try{chosen=normalize(JSON.parse(storage()?.get('home-finishes:'+uid)||'null'));}catch{}close();}
  current={house:allowed('CITY-07')?chosen.house:'original',garage:allowed('CITY-06')?chosen.garage:'original'};
  signature=current.house+':'+current.garage;
}
function set(pack,value){const house=pack==='CITY-07';if(stopped||!uid||!['CITY-06','CITY-07'].includes(pack)||!allowed(pack)||!(house?['original','modern','cozy']:['original','hangout']).includes(value))return false;
 const old=chosen;chosen={...chosen,[house?'house':'garage']:value};try{storage().set('home-finishes:'+uid,JSON.stringify(chosen));}catch{chosen=old;return false;}refresh(root.PlatdoPremium.getState());return true;}
function finish(part,choice=current){const p=palettes[choice.house];if(!p||part.glass)return part;const id=part.id.slice(5);let color;
 if(part.wall||id.endsWith('lintel'))color=p.wall;
 else if(/window.*(?:edge|frame|trim|sill|mullion|top)|porch-lamp-(?:back|cap)/.test(id))color=p.trim;
 else if(/roof-|ridge|canopy/.test(id))color=p.roof;
 else if(/siding-|ground-oak|wardrobe$|stair-\d|stair-rail|porch-post|bedframe|bedhead|tabletop|coffeetop|nightstand|entry-console/.test(id))color=p.timber;
 else if(/(?:kitchencab|uppercab|island-cabinet|island-door)/.test(id))color=p.cabinet;
 else if(/^(counter|island-counter|kitchen-tile|backsplash|patio$)/.test(id))color=p.stone;
 else if(/rug/.test(id))color=p.rug;
 else if(/^(sofa-|lounge(?:seat|back))|blanket/.test(id))color=id.includes('cushion')?p.soft:p.fabric;
 else if(/baluster|railing|^drain|^gutter/.test(id))color=p.metal;
 return color?{...part,color}:part;}
const origin={x:-180,y:2.58,z:150};
function decorations(choice=current){const parts=[];const box=(id,x,y,z,w,h,d,color,extra={})=>parts.push({id:'finish:'+id,x:origin.x+x,y:origin.y+y,z:origin.z+z,w,h,d,color,solid:false,...extra});
 if(choice.house!=='original'){const p=palettes[choice.house];for(const side of[-1,1])for(let i=0;i<6;i++)box('entry-batten-'+side+'-'+i,1.25+side*(.9+i*.045),.15,7.19,.024,2.42,.045,p.timber);for(let i=0;i<3;i++){box('art-border-'+i,3.15+i*.65,.98,6.864,.55,.85,.025,p.trim);box('art-field-'+i,3.15+i*.65,1.025,6.841,.46,.76,.019,p.soft);box('art-motif-'+i,3.15+i*.65,1.13+i*.08,6.823,.26,.24,.016,i%2?p.rug:p.fabric,{rz:.23*i});}}
 if(choice.garage==='hangout'){
  // Graphics lie on the floor and against the walls, away from the vehicle bay.
  for(let row=0;row<15;row++)for(let col=0;col<8;col++)box('tile-'+row+'-'+col,-8.62+col*.64,.033,-2.53+row*.645,.636,.008,.641,(row+col)%2?'#4c5659':'#657173');
  for(const x of[-7.88,-4.92])box('bay-line'+x,x,.044,2.15,.038,.006,7.6,'#ecbb67');
  box('equipment-rail',-8.85,1.55,-.35,.08,.18,2.55,'#303f48');for(let i=0;i<4;i++){box('rack-hook'+i,-8.77,1.53,-1.2+i*.53,.17,.055,.045,'#c8c3ad');box('rack-handle'+i,-8.71,1.07,-1.2+i*.53,.06,.49,.07,'#c89959');box('rack-head'+i,-8.7,1.56,-1.2+i*.53,.055,.115,.2,'#83959b');}
  // Bench fits the otherwise unoccupied rear-right corner of the garage.
  box('bench-seat',-4.43,.43,-1.8,.95,.13,.52,'#af7961');box('bench-back',-4.43,.53,-2.07,.95,.43,.09,'#97634e');for(const dx of[-.37,.37])box('bench-foot'+dx,-4.43+dx,.02,-1.8,.07,.41,.42,'#384448');
  box('trophy-shelf',-6.7,2.38,-2.78,2.45,.08,.37,'#b38c5f');for(const [i,h]of[.21,.32,.24].entries()){const x=-7.35+i*.65;box('trophy-plinth'+i,x,2.46,-2.71,.23,.055,.21,'#353638');box('trophy-stem'+i,x,2.51,-2.71,.055,h*.44,.055,'#c4a163');box('trophy-cup'+i,x,2.51+h*.42,-2.71,.19,h*.64,.19,'#d8bd74',{shape:'sphere'});}
  for(const x of[-8.8,-4.0]){box('light-channel'+x,x,2.52,1.97,.09,.06,8.5,'#35454a');box('light-lens'+x,x,2.50,1.97,.052,.023,8.4,'#ebbc7b',{emissive:true});}
 }
 return parts;}
function preview(canvas,pack,selection,{tour=false}={}){const T=root.THREE,H=root.CityHomes;if(!T||!H)return{available:false,render(){},dispose(){}};H.recipe();const garage=pack==='CITY-06',choice=selection||{...current,[garage?'garage':'house']:garage?'hangout':'modern'};const r=new T.WebGLRenderer({canvas,antialias:true,alpha:false}),scene=new T.Scene(),camera=new T.PerspectiveCamera(garage?55:36,1,.06,120);const geometry={box:new T.BoxGeometry(1,1,1),sphere:new T.SphereGeometry(.5,12,8),cylinder:new T.CylinderGeometry(.5,.5,1,12)},mats=new Map(),temp=new T.Object3D(),batches=new Map();r.setPixelRatio(1);r.setClearColor(garage?'#35464d':'#b2d1d3');const leaves=H.doors.filter(d=>!tour&&(!garage||!d.garage)).map(d=>({id:d.id,x:d.x,y:d.y,z:d.z,w:d.axis==='z'?.11:d.w,h:d.h,d:d.axis==='z'?d.w:.11,color:d.garage?'#aab3ad':d.sliding?'#b6d3d4':'#8d735a',glass:d.sliding}));for(const original of [...H.parts,...leaves,...decorations(choice)]){if(original.noRender)continue;const p=finish(original,choice),shape=geometry[p.shape]?p.shape:'box',key=[shape,p.color,p.glass?'glass':p.emissive?'glow':'matte'].join('|');if(!batches.has(key))batches.set(key,[]);batches.get(key).push(p);}for(const [key,group]of batches){const [shape,color,kind]=key.split('|');const mat=new T.MeshStandardMaterial({color,roughness:.72,transparent:kind==='glass',opacity:kind==='glass'?.32:1,emissive:kind==='glow'?color:'#000000',emissiveIntensity:.4});mats.set(key,mat);const mesh=new T.InstancedMesh(geometry[shape],mat,group.length);group.forEach((p,i)=>{temp.position.set(p.x-origin.x,p.y-origin.y+p.h/2,p.z-origin.z);temp.scale.set(p.w,p.h,p.d);temp.rotation.set(p.rx||0,0,p.rz||0);temp.updateMatrix();mesh.setMatrixAt(i,temp.matrix);});scene.add(mesh);}scene.add(new T.HemisphereLight('#f2f7ff','#9c8776',2));const sun=new T.DirectionalLight('#ffe9c5',2.8);sun.position.set(7,12,13);scene.add(sun);if(garage){camera.position.set(-5.9,1.9,6.74);camera.lookAt(-6.72,1.16,-1.45);}else{camera.position.set(14,9.5,26);camera.lookAt(0,2.3,0);}let drawn=false;return{available:true,scene,camera,origin:{...origin},render(force=false){const s=root.Platdo?.renderSize?.(canvas.clientWidth||540,canvas.clientHeight||300)||{width:540,height:300};const w=Math.min(tour?1600:800,s.width),h=Math.max(1,Math.round(w*s.height/s.width));if(force!==true&&drawn&&canvas.width===w&&canvas.height===h)return;drawn=true;r.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();r.render(scene,camera);},dispose(){scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();});Object.values(geometry).forEach(g=>g.dispose());mats.forEach(m=>m.dispose());r.dispose();r.forceContextLoss();}};}
function close(){display?.dispose();display=null;panel?.remove();panel=null;}
function open(pack){if(!allowed(pack))throw Error('This appearance pack is not owned.');close();let selected=current[pack==='CITY-07'?'house':'garage'];panel=document.createElement('dialog');panel.className='premium-home-panel';panel.setAttribute('aria-label',pack==='CITY-06'?'Garage Hangout':'Home Makeover');let canvas=document.createElement('canvas');const title=document.createElement('h2'),controls=document.createElement('div'),apply=document.createElement('button'),exit=document.createElement('button'),message=document.createElement('p');title.textContent=panel.getAttribute('aria-label');panel.append(title,canvas,controls,message,apply,exit);document.body.append(panel);panel.showModal();panel.oncancel=e=>{e.preventDefault();close();};const select=value=>{selected=value;if(display){display.dispose();const next=document.createElement('canvas');canvas.replaceWith(next);canvas=next;}display=preview(canvas,pack,{...current,[pack==='CITY-07'?'house':'garage']:value});display.render();for(const b of controls.children)b.setAttribute('aria-pressed',String(b.dataset.finish===value));message.textContent='Previewing '+names[value];};for(const value of pack==='CITY-07'?['original','modern','cozy']:['original','hangout']){const b=document.createElement('button');b.textContent=names[value];b.dataset.finish=value;b.onclick=()=>select(value);controls.append(b);}apply.textContent='Apply appearance';apply.onclick=()=>{message.textContent=set(pack,selected)?'Applied '+names[selected]:'Unable to save this appearance.';};exit.textContent='Close';exit.onclick=close;select(selected);}
function initialize(){for(const id of['CITY-06','CITY-07'])root.PlatdoPremium?.registerAdapter(id,{actionLabel:'Choose appearance',open:()=>open(id),description:'Preview finishes on your home. Choose Original to restore it.',previewLabel:'Starter home appearance preview'});}
root.PlatdoHomeFinishes={signature:()=>signature,current:()=>({...current}),finish,decorations,preview,set,open,close};root.PlatdoPremium?.subscribe(refresh);root.addEventListener('platdo:citymodechange',()=>{if(root.PlatdoPremium)refresh(root.PlatdoPremium.getState());});root.addEventListener('platdo:beforereset',()=>{stopped=true;chosen={...defaultChoice};current={...defaultChoice};signature='original:original';close();});root.addEventListener('platdo:ready',initialize,{once:true});initialize();
})(typeof window==='undefined'?globalThis:window);