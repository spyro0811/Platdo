/* Account-owned City vehicle finishes. The regular vehicle save never grants access. */
(function(root){
'use strict';
const paints=[['Sunburst',0xe79e36],['Lagoon',0x288982]];
const designs=['Original','Voltage','Dust Devil','Sticker Storm','Blackline'];
// Corners follow the outside edge of each model's fairing or battery cover.
const panels={
  'kestrel-s':[[.218,.42,-.25],[.293,.44,.31],[.328,.77,.36],[.251,.83,-.08]],
  'volt-rs':[[.223,.40,-.23],[.294,.44,.33],[.336,.79,.40],[.251,.85,-.065]],
  'sir_ron_buzz_x':[[.108,.45,-.095],[.134,.45,.092],[.140,.71,.16],[.113,.64,-.088]],
  'stork_vargle_mx':[[.190,.68,-.16],[.208,.63,.18],[.213,.87,.20],[.193,.83,-.15]]
};
const premium=root.PlatdoPremium;
let uid=null,canBuggy=false,canDress=false,choice={paint:0,design:0},revision=0,dialog=null,stopped=false;
function prefs(){return root.Platdo?.storage('premium');}
function refresh(){
  const user=premium.getState().uid,identity=user?user+(root.PlatdoCity?.progressSuffix||''):null;
  if(identity!==uid){
    uid=identity;choice={paint:0,design:0};
    if(uid){try{const saved=JSON.parse(prefs()?.get('city-fleet:'+uid)||'{}');
      if(paints[saved.paint])choice.paint=saved.paint;
      if(designs[saved.design])choice.design=saved.design;
    }catch{}}
  }
  canBuggy=premium.access('CITY-08').allowed;canDress=premium.access('CITY-03').allowed;revision++;if(root.PlatdoCity?.sim)reconcile(root.PlatdoCity.sim);
  if(dialog&&!(dialog.product==='CITY-08'?canBuggy:canDress))close();
}
function buggy(){return canBuggy?{id:'premium-sunrunner',typeId:'sunrunner',customization:{paint:paints[choice.paint][1]}}:null;}
function applyLivery(model,type,design){
  const quad=panels[type],T=root.THREE;
  if(!quad||!designs[design]||!design)return;
  const layer=new T.Group();layer.name='Stunt Crew '+designs[design];model.add(layer);
  const colors=[null,['#12283b','#008bf9','#a5eeff'],['#552f23','#e6792d','#ebce91'],['#294054','#77cf94','#ffd65c','#f5797a'],['#15171a','#8a949f','#c6cbd1']][design];
  const materials=colors.map((color,i)=>new T.MeshStandardMaterial({color,roughness:design===4&&i===0?.94:.48,metalness:design===4&&i>0?.7:.12,side:T.DoubleSide}));
  for(const sign of[-1,1]){
    function patch(index,points){
      const verts=[];
      for(let k=1;k<points.length-1;k++)for(const [u,v] of[points[0],points[k],points[k+1]]){
        for(let j=0;j<3;j++){
          const value=(1-v)*(quad[0][j]*(1-u)+quad[1][j]*u)+v*(quad[3][j]*(1-u)+quad[2][j]*u);
          verts.push(j===0?sign*(value+.014+index*.0015):value);
        }
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();
      const mesh=new T.Mesh(g,materials[index]);mesh.receiveShadow=true;layer.add(mesh);
    }
    patch(0,[[0,0],[1,0],[1,1],[0,1]]);
    if(design===1){patch(1,[[.04,.12],[.42,.79],[.63,.79],[.41,.48]]);patch(2,[[.36,.30],[.64,.70],[.57,.56],[.96,.91],[.61,.32]]);}
    if(design===2){patch(1,[[0,.16],[.64,.78],[1,.6],[1,.36],[.65,.55],[0,.05]]);patch(2,[[.15,0],[.68,.43],[.86,.34],[.47,0]]);}
    if(design===3){patch(1,[[.07,.40],[.26,.74],[.42,.57],[.24,.24]]);patch(2,[[.46,.17],[.66,.18],[.72,.55],[.53,.50]]);patch(3,[[.72,.55],[.82,.87],[.96,.74],[.93,.49]]);patch(0,[[.17,.42],[.24,.61],[.30,.54]]);}
    if(design===4){patch(1,[[.04,.24],[.84,.64],[.97,.65],[.96,.70],[.82,.70],[.04,.29]]);patch(2,[[.61,.39],[.94,.53],[.94,.55],[.61,.41]]);}
  }
  return layer;
}
function dress(model,e){
  if(!panels[e.typeId])return;
  const d=canDress&&e.owned?choice.design:0,data=model.userData;
  if((data.cityLiveryIndex||0)===d)return;
  if(data.cityLivery){const materials=new Set();data.cityLivery.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());data.cityLivery.removeFromParent();}
  data.cityLivery=applyLivery(model,e.typeId,d);data.cityLiveryIndex=d;
}
function reconcile(sim){
  if(sim._premiumFleetRevision===revision)return;sim._premiumFleetRevision=revision;
  const cars=sim.vehicles?.filter(v=>v.typeId==='sunrunner');if(!cars?.length)return;
  if(canBuggy){for(const car of cars){car.customization??={};car.customization.paint=paints[choice.paint][1];}return;}
  if(cars.some(car=>sim.player.vehicleId===car.id||sim.player.transition?.vehicleId===car.id))sim.returnToCity();
  sim.vehicles=sim.vehicles.filter(v=>v.typeId!=='sunrunner');
}
function close(){if(!dialog)return;const d=dialog;dialog=null;d.preview?.dispose();cancelAnimationFrame(d.frame);d.element.remove();root.dispatchEvent(new CustomEvent('platdo:premiumactivitychange',{detail:{active:false,id:d.product}}));}
function open(product){
  if(!premium.access(product).allowed)throw Error('Ownership could not be verified.');
  close();const isBuggy=product==='CITY-08',field=isBuggy?'paint':'design',element=document.createElement('dialog');
  element.className='premium-home-panel';element.setAttribute('aria-label',isBuggy?'Sunrunner Buggy':'Stunt Crew Liveries');
  function add(tag,text){const item=document.createElement(tag);if(text)item.textContent=text;element.append(item);return item;}
  add('h2',isBuggy?'Sunrunner Buggy':'Stunt Crew Liveries');const canvas=add('canvas'),select=add('select');select.setAttribute('aria-label','Finish');
  const choices=isBuggy?paints.map(p=>p[0]):designs;
  for(const [i,name] of choices.entries())select.add(new Option(name,String(i)));
  select.selectedIndex=choice[field];let type='kestrel-s';
  if(!isBuggy){const bikes=add('select');bikes.setAttribute('aria-label','Compatible bike');for(const id of Object.keys(panels))bikes.add(new Option(root.CityVehicles.byId[id].name,id));bikes.onchange=()=>{type=bikes.value;draw();};}
  add('p',isBuggy?'Deliver the buggy from your City phone under Motors → My Vehicles.':'Applies to your own compatible bikes. Choose Original to restore their factory graphics.');
  const apply=add('button','Apply finish'),exit=add('button','Close'),message=add('p');
  const d=dialog={element,product,preview:null,frame:0};function draw(){d.preview?.dispose();d.preview=root.PlatdoPremiumArt.create(canvas,{id:product,mode:'CITY'},{variant:select.selectedIndex,bikeType:type});}
  apply.onclick=()=>{if(stopped||!uid||!premium.access(product).allowed)return close();choice[field]=select.selectedIndex;prefs()?.set('city-fleet:'+uid,JSON.stringify(choice));revision++;if(root.PlatdoCity?.sim)reconcile(root.PlatdoCity.sim);message.textContent=choices[choice[field]]+' equipped.';};
  select.onchange=draw;exit.onclick=close;element.oncancel=e=>{e.preventDefault();close();};document.body.append(element);element.showModal();draw();
  let last=-1000;function tick(t){if(dialog!==d)return;d.frame=requestAnimationFrame(tick);if(!document.hidden&&t-last>=1000/(root.Platdo?.frameRate||60)){d.preview.render(t/1000);last=t;}}tick(0);
  root.dispatchEvent(new CustomEvent('platdo:premiumactivitychange',{detail:{active:true,id:product}}));return{close};
}
root.PlatdoCityFleet={buggy,dress,reconcile,applyLivery,paints,panels,designs};
for(const id of['CITY-03','CITY-08'])premium.registerAdapter(id,{open:()=>open(id),actionLabel:'Choose finish',description:id==='CITY-08'?'Includes two paint presets and City phone delivery.':'Voltage, Dust Devil, Sticker Storm and Blackline on four compatible bikes.'});
premium.subscribe(refresh);root.addEventListener('platdo:citymodechange',refresh);root.addEventListener('platdo:beforereset',()=>{stopped=true;close();});
})(window);
