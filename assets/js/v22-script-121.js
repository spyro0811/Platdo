
/* Starter-house props are authored in real meters. Every model's front is
 * local +Z. The same yaw transforms its geometry, seat and collision pieces. */
(function(root, factory) {
  const api=factory();
  if(typeof module==='object')module.exports=api;
  root.CityHomeFurnishings=api;
})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const upstairs=3.24;
const directions={'+Z':0,'+X':Math.PI/2,'-Z':Math.PI,'-X':-Math.PI/2};
const colors={
  walnut:'#725140',oak:'#b08460',oakLight:'#c39c74',cream:'#f1e8d7',ink:'#283438',
  stone:'#d5c7ad',slate:'#45575c',metal:'#b1bcbb',brass:'#ba9259',sage:'#687f69',
  teal:'#3f7272',sky:'#8ea9ae',rust:'#b36649',white:'#f5f3e9',rose:'#b69183'
};
function recipe({garageWidth=6.6,garageDepth=7.6,windows=[],doors=[]}={}){
  const parts=[],seats=[],items=[];
  const {walnut,oak,oakLight,cream,ink,stone,slate,metal,brass,sage,teal,sky,rust,white,rose}=colors;
  // y is ALWAYS the object's bottom. Local +Z points out of a cabinet, away
  // from a chair back, or toward the foot of a bed.
  function object(id,x,z,facing='+Z',y=0){
    const yaw=directions[facing],sin=Math.round(Math.sin(yaw)),cos=Math.round(Math.cos(yaw));
    const origin={id,x,y,z,yaw,facing:{x:sin,z:cos}};
    items.push(origin);
    function point(u,v,h=0){return{x:x+cos*u+sin*v,y:y+h,z:z-sin*u+cos*v};}
    function part(key,u,b,v,w,h,d,color,solid=false,extra={}){
      const p={id:id+'-'+key,...point(u,v,b),w,h,d,color,solid,ry:yaw,...extra};
      parts.push(p);return p;
    }
    return {...origin,point,part};
  }
  const tone=s=>({finishTone:s}),shape=s=>({shape:s}),both=(s,t)=>({shape:s,finishTone:t});
  function table(o,w,d,top,thick=.085,color=oak){
    const p=o.part,leg=.075,base=top-thick;
    for(const u of [-1,1])for(const v of [-1,1])
      p('leg'+u+v,u*(w/2-.085),0,v*(d/2-.085),leg,base,leg,walnut,true,tone('timber'));
    p('top',0,base,0,w,thick,d,color,true,tone('timber'));
    p('apron',0,base-.11,0,w-.17,.11,d-.17,oak,false,tone('timber'));
  }
  function rug(o,w,d,body,border){
    const p=o.part;
    p('hem',0,.008,0,w,.01,d,border,false,tone('rug'));
    p('field',0,.018,0,w-.075,.009,d-.075,body,false,tone('rug'));
    for(const s of [-1,1]){
      p('stripe'+s,0,.027,s*(d/2-.15),w-.18,.003,.025,border);
      for(let i=0;i<9;i++)p('fringe'+s+i,(i-4)*w/10,.008,s*(d/2+.017),.025,.008,.034,border);
    }
  }
  function plant(o,u,base,v,scale=1,standing=false){
    const p=o.part,s=scale;
    p('pot',u,base,v,.25*s,.22*s,.25*s,cream,standing,shape('cylinder'));
    p('potrim',u,base+.20*s,v,.28*s,.045*s,.28*s,rust,false,shape('cylinder'));
    p('soil',u,base+.244*s,v,.23*s,.01*s,.23*s,walnut,false,shape('cylinder'));
    p('stem',u,base+.245*s,v,.032*s,.26*s,.032*s,sage);
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      p('leaves'+i,u+Math.sin(a)*.095*s,base+(.31+.045*(i%2))*s,v+Math.cos(a)*.095*s,.25*s,(.16+.06*(i%2))*s,.23*s,i%2?sage:'#86a67b',false,shape('sphere'));
    }
  }
  function lamp(o,u,base,v,h){
    const p=o.part;
    p('lampfoot',u,base,v,.25,.055,.25,brass,false,shape('cylinder'));
    p('lampstem',u,base+.055,v,.038,h*.68-.055,.038,brass,false,shape('cylinder'));
    p('shade',u,base+h*.62,v,.40,h*.38,.40,cream,false,shape('cylinder'));
    p('shadetrim',u,base+h*.62,v,.406,.018,.406,oakLight,false,shape('cylinder'));
  }
  function chair(id,x,z,face,{deck=false,computer=false}={}){
    const o=object(id,x,z,face),p=o.part,w=.50,depth=.50,frame=deck?teal:walnut;
    const back=-depth/2+.04;
    for(const s of [-1,1])for(const t of [-1,1]){
      const h=t===-1?.93:.40;
      p('leg'+s+t,s*.193,0,t*.205,.055,h,.055,frame,true);
    }
    p('seat',0,.39,0,w,computer?.03:.07,depth,computer?ink:deck?teal:oakLight,true);
    if(computer)p('seatpad',0,.42,.006,.44,.04,.43,teal);
    if(computer){
      p('back',0,.51,back,.48,.45,.085,ink,true);
      p('backpad',0,.55,back+.043,.42,.34,.05,teal);
    }else{
      p('back',0,.82,back,.50,.12,.075,frame,true);
      for(const s of [-1,0,1])p('spindle'+s,s*.10,.46,back,.035,.36,.045,frame);
    }
    const stand=computer?{x:11.20,y:0,z:1.75}:o.point(0,-.82);
    seats.push({id,position:o.point(0,0),yaw:o.yaw,facing:o.facing,seatHeight:.46,approach:{...stand},stand});
    return o;
  }
  function wardrobe(id,x,z,face,w,floor){
    const p=object(id,x,z,face,floor).part;
    p('carcase',0,0,0,w,1.92,.57,oak,true,tone('timber'));
    for(const side of [-1,1]){
      p('door'+side,side*w*.244,.075,.291,w*.476,1.78,.032,cream,false,tone('cabinet'));
      p('pull'+side,side*.069,.91,.322,.032,.17,.04,brass);
    }
    p('cornice',0,1.92,0,w+.045,.055,.61,walnut,false,tone('timber'));
  }
  function roomArt(id,x,z,face,base,w,h){
    const p=object(id,x,z,face).part;
    p('frame',0,base,0,w,h,.035,walnut,false,tone('timber'));
    p('paper',0,base+.034,.021,w-.068,h-.068,.009,cream);
    p('sky',0,base+h*.22,.029,w*.75,h*.62,.006,sky);
    p('sun',w*.14,base+h*.56,.034,w*.18,h*.18,.012,'#dca45f',false,shape('sphere'));
    p('farhill',-w*.115,base+h*.20,.037,w*.53,h*.25,.012,sage,false,shape('sphere'));
    p('nearhill',w*.105,base+h*.19,.044,w*.53,h*.17,.012,teal,false,shape('sphere'));
    p('caption',-w*.08,base+h*.10,.029,w*.32,.012,.014,walnut);
  }
  function mirror(o,u,b,v,w,h){
    o.part('mirrorframe',u,b,v,w,h,.042,brass);
    o.part('mirror',u,b+.028,v+.027,w-.055,h-.055,.014,'#b8d0d1');
    o.part('mirrorglint',u-w*.24,b+.10,v+.037,.023,h-.20,.008,'#dce7df');
  }
  function books(o,u,b,v,size=.30){
    const p=o.part;
    for(const [i,c] of [rust,cream,teal].entries()){
      p('book'+i,u+.012*i,b+i*.053,v,size-i*.018,.048,size*.73,c);
      p('pages'+i,u+.012*i,b+i*.053+.009,v+.008,size-i*.018-.012,.030,size*.73-.008,cream);
    }
  }
  const foyer=object('entry-console',8.45,3.15,'-X');
  table(foyer,.80,.35,.79,.07);
  plant(foyer,0,.79,0,.74);
  mirror(foyer,0,1.02,-.18,.65,.81);
  const hooks=object('foyer-hooks',5.14,.64,'+X');
  hooks.part('board',0,1.44,0,.70,.11,.075,oak);
  for(let i=-1;i<=1;i++)hooks.part('peg'+i,i*.19,1.42,.045,.036,.08,.095,brass);
  rug(object('door-mat',6.95,.61),.81,.61,'#918669','#6d6352');
  rug(object('porch-mat',7,-.57),1.04,.61,'#848670','#5d655a');
  for(const x of [5.55,8.47])plant(object('porch-planter'+x,x,-.62),0,0,0,2.2,true);

  // Living room: a framed landscape on the television faces the actual sofa.
  rug(object('living-rug',2.45,3.04),3.42,2.39,'#6e9392','#c4bc9e');
  const tv=object('tv',2.45,.24);
  tv.part('console',0,.08,0,2.2,.42,.45,walnut,true,tone('timber'));
  for(const s of [-1,1])tv.part('cabinet'+s,s*.59,.17,.228,.90,.25,.021,oak);
  tv.part('base',0,.50,0,.54,.055,.32,ink);
  tv.part('support',0,.555,0,.09,.26,.07,ink);
  tv.part('frame',0,.81,0,1.90,1.08,.078,ink,true);
  tv.part('screen',0,.855,.044,1.82,.99,.012,'#7fadb0');
  tv.part('sun',.46,1.49,.055,.22,.22,.012,'#ebb97b',false,shape('sphere'));
  tv.part('mountain',-.37,.865,.055,.95,.33,.018,'#627e7c',false,shape('sphere'));
  tv.part('coast',.35,.865,.071,1.04,.22,.018,teal,false,shape('sphere'));
  const couch=object('sofa',2.45,4.15,'-Z'),cp=couch.part;
  for(const side of [-1,1])for(const end of [-1,1])cp('foot'+side+end,side*1.18,0,end*.32,.095,.14,.095,walnut);
  cp('base',0,.14,0,2.78,.30,.94,teal,true,tone('fabric'));
  cp('back',0,.44,-.38,2.76,.53,.22,teal,true,tone('fabric'));
  for(const side of [-1,1])cp('arm'+side,side*1.28,.42,0,.22,.27,.99,teal,true,tone('fabric'));
  for(let i=-1;i<=1;i++){
    cp('cushion'+i,i*.77,.44,.07,.74,.115,.71,'#73958b',true,tone('soft'));
    cp('backpad'+i,i*.77,.555,-.28,.72,.35,.16,'#72938a',false,tone('fabric'));
    const stand=couch.point(i*.77,.84);
    seats.push({id:'sofa-'+i,position:couch.point(i*.77,.07),yaw:couch.yaw,facing:couch.facing,seatHeight:.555,approach:{...stand},stand});
  }
  cp('throw',.84,.56,-.13,.42,.35,.12,'#d6a37d');
  const coffee=object('coffee',2.45,2.60);table(coffee,1.40,.70,.42);
  books(coffee,-.28,.42,0,.32);
  const side=object('side-table',.61,4.10);table(side,.62,.58,.56);plant(side,0,.56,0,1.0);
  lamp(object('floorlamp',.59,5.49),0,0,0,1.54);
  roomArt('living-print',4.86,4.82,'-X',1.08,.85,.88);

  const dining=object('dining',2.45,9.10);table(dining,1,2.20,.76);
  plant(dining,0,.76,.06,.78);
  [ [1.35,8.50,'+X'],[1.35,9.70,'+X'],[3.55,8.50,'-X'],[3.55,9.70,'-X'],
    [2.45,7.40,'+Z'],[2.45,10.80,'-Z'] ].forEach(([x,z,f],i)=>chair('dining-chair-'+i,x,z,f));
  rug(object('dining-rug',2.45,9.10),3.33,4.08,'#a99c78','#d7ccac');
  const pendant=object('dining-pendant',2.45,9.10);
  pendant.part('rosette',0,2.98,0,.22,.06,.22,brass,false,shape('cylinder'));
  pendant.part('cord',0,2.51,0,.022,.47,.022,ink);
  pendant.part('shade',0,2.32,0,.46,.21,.46,brass,false,shape('cone'));
  pendant.part('diffuser',0,2.313,0,.408,.01,.408,cream,false,shape('cylinder'));
  roomArt('dining-print',2.48,6.145,'+Z',1.15,.69,.90);

  function cabinets(o,w,d,height=.92){
    const p=o.part,base=height-.075;
    p('plinth',0,0,-.02,w-.085,.09,d-.08,walnut,true);
    p('case',0,.09,0,w-.035,base-.09,d-.045,sage,true,tone('cabinet'));
    p('worktop',0,base,0,w,.075,d,stone,true,tone('stone'));
    const n=Math.max(1,Math.round(w/.70));
    for(let i=0;i<n;i++){
      const u=(i+.5)*w/n-w/2;
      p('front'+i,u,.12,d/2-.006,w/n-.034,base-.15,.024,sage,false,tone('cabinet'));
      p('handle'+i,u,base-.12,d/2+.018,.18,.024,.047,brass);
    }
  }
  function sink(o,u,b,v,w=.62){
    const p=o.part;
    p('sinklip',u,b,v,w,.018,.43,metal);
    p('sinkbowl',u,b+.018,v,w-.065,.013,.36,'#849999');
    p('drain',u,b+.032,v,.055,.009,.055,ink,false,shape('cylinder'));
    p('tapstem',u,b+.018,v-.21,.038,.25,.04,metal);
    p('tapspout',u,b+.24,v-.13,.042,.036,.19,metal);
  }
  const rear=object('kitchen-rear',12.10,11.65,'-Z');
  cabinets(rear,3.8,.70);sink(rear,.90,.92,0,.76);
  const micro=rear.part;
  micro('microwave',-.66,.92,0,.63,.37,.44,'#b7c3b9',true);
  micro('microglass',-.71,.985,.224,.45,.22,.018,ink);
  micro('microdisplay',-.424,1.08,.225,.074,.05,.018,teal);
  const east=object('kitchen-east',13.65,9.95,'-X');
  cabinets(east,2.70,.70);
  east.part('range',-.05,.925,0,.69,.018,.56,ink);
  for(const sx of [-1,1])for(const sz of [-1,1])east.part('burner'+sx+sz,-.05+sx*.17,.948,sz*.14,.18,.01,.18,slate,false,shape('cylinder'));
  east.part('oven',-.05,.14,.358,.70,.58,.035,ink);
  east.part('ovenglass',-.05,.23,.38,.50,.32,.012,slate);
  east.part('ovenbar',-.05,.626,.386,.53,.034,.065,metal);
  east.part('hood',-.05,1.69,-.015,.83,.13,.55,metal);
  east.part('duct',-.05,1.82,-.19,.36,1.22,.28,metal);
  cabinets(object('island',11.30,9.75),1.40,.80);
  const prep=object('prep',11.30,9.75);prep.part('board',.18,.92,0,.37,.028,.29,oak);
  prep.part('fruit',.17,.948,.014,.14,.13,.14,rust,false,shape('sphere'));
  const fridge=object('fridge',9.60,7.95);
  fridge.part('case',0,0,0,.92,1.87,.75,metal,true);
  fridge.part('panel',0,.66,.379,.87,1.16,.029,'#c8d0c8');
  fridge.part('handle',.31,.89,.406,.04,.44,.04,ink);
  fridge.part('freezer',0,.12,.379,.87,.49,.029,metal);
  wardrobe('pantry',10.70,7.84,'+Z',.75,0);

  function toilet(id,x,z,face,floor=0){
    const o=object(id,x,z,face,floor),p=o.part;
    p('base',0,0,.05,.39,.27,.53,white,true,shape('sphere'));
    p('bowl',0,.19,.07,.52,.23,.61,white,true,shape('sphere'));
    p('seat',0,.389,.07,.52,.045,.59,cream,false,shape('cylinder'));
    p('recess',0,.427,.07,.31,.016,.38,'#92a8aa',false,shape('cylinder'));
    p('tank',0,.30,-.29,.50,.46,.205,white,true);
    p('lid',0,.76,-.29,.525,.05,.224,white);
    p('flush',.145,.81,-.29,.065,.012,.045,metal);
  }
  function vanity(id,x,z,face,w,floor=0){
    const o=object(id,x,z,face,floor);
    cabinets(o,w,.52,.82);
    const n=w>1.50?2:1;
    for(let i=0;i<n;i++){
      const u=(i-(n-1)/2)*.91;
      const at=o.point(u,0),detail=object(id+'-basin'+i,at.x,at.z,face,floor);
      sink(detail,0,.82,-.005,.55);
    }
    mirror(o,0,1.08,-.225,w*.86,.72);
  }
  function towel(o,u,b,v,col){
    o.part('rod',u,b+.32,v-.025,.53,.035,.07,brass);
    o.part('cloth',u,b,v,.34,.35,.038,col);
    o.part('selvage',u,b+.041,v+.019,.34,.018,.008,cream);
  }
  toilet('half-toilet',9.55,6.85,'-Z');
  vanity('half-vanity',10.72,5.95,'-X',.94);
  const accessories=object('half-accessories',10.96,6.79,'-X');
  towel(accessories,0,.91,.035,teal);
  const paper=object('half-paper',9.02,6.72,'+X');
  paper.part('holder',0,.63,.04,.22,.035,.12,metal);
  paper.part('roll',0,.60,.13,.11,.12,.12,white,false,shape('cylinder'));
  const bin=object('half-bin',10.43,7.03);bin.part('bin',0,0,0,.23,.29,.23,slate,true,shape('cylinder'));

  function machine(id,x){
    const o=object(id,x,6.88,'-Z'),p=o.part;
    p('case',0,0,0,.90,.91,.74,cream,true);
    p('cap',0,.91,0,.92,.033,.75,white);
    p('panel',0,.73,.379,.86,.15,.03,metal);
    p('dial',-.26,.765,.40,.105,.08,.033,slate,false,shape('sphere'));
    p('display',.15,.77,.40,.20,.055,.015,ink);
    p('port-ring',0,.16,.38,.55,.52,.08,metal,false,shape('sphere'));
    p('port-glass',0,.214,.42,.42,.405,.08,slate,false,shape('sphere'));
    p('port-glint',-.065,.43,.457,.21,.038,.024,sky,false,shape('sphere'));
    return o;
  }
  machine('washer',11.80);machine('dryer',13.10);
  const shelf=object('laundry-shelf',12.57,7.11,'-Z');
  shelf.part('shelf',0,1.56,0,2.37,.065,.32,oak,true);
  for(const s of [-1,1])shelf.part('bracket'+s,s*.85,1.35,-.065,.07,.21,.21,brass);
  for(let i=0;i<3;i++)shelf.part('folded'+i,-.40,1.625+i*.062,0,.64,.059,.23,[teal,white,cream][i]);
  for(let i=0;i<2;i++){
    shelf.part('bottle'+i,.49+i*.24,1.625,0,.16,.24,.15,i?sky:rust);
    shelf.part('cap'+i,.49+i*.24,1.865,0,.08,.045,.09,ink);
  }
  const basket=object('laundry-basket',13.63,5.69);
  basket.part('bask',0,0,0,.46,.42,.47,oakLight,true);
  for(let i=0;i<4;i++)basket.part('weave'+i,0,.05+i*.087,0,.465,.021,.475,walnut);
  const coats=object('mudroom-pegs',12.45,5.34,'+Z');coats.part('bar',0,1.41,0,.76,.10,.065,oak);
  for(let i=0;i<3;i++)coats.part('hook'+i,(i-1)*.22,1.38,.055,.04,.085,.09,metal);
  const desk=object('computer-desk',13.45,1.75,'-X');
  table(desk,2,.80,.76);
  const p=desk.part;
  p('monitorfoot',0,.76,-.15,.42,.025,.27,ink);
  p('monitorstem',0,.785,-.15,.075,.225,.065,slate);
  p('monitor',0,.995,-.15,.83,.51,.058,ink,true);
  p('screen',0,1.025,-.117,.77,.45,.011,'#487f95');
  p('screenbar',0,1.031,-.109,.75,.036,.009,teal);
  for(let i=0;i<3;i++){
    p('app'+i,-.287,1.37-i*.084,-.108,.061,.051,.012,[cream,rust,'#86ba98'][i]);
    p('caption'+i,-.208,1.39-i*.084,-.104,.057,.009,.009,white);
  }
  p('keyboard',0,.76,.23,.54,.030,.15,ink);
  for(let row=0;row<3;row++)for(let col=0;col<8;col++)
    p('key'+row+'-'+col,(col-3.5)*.057,.791,.23+(row-1)*.038,.043,.010,.026,slate);
  p('mousepad',-.48,.76,.23,.28,.008,.23,teal);
  p('mouse',-.48,.768,.225,.077,.051,.118,ink,false,shape('sphere'));
  for(const s of [-1,1]){
    p('speaker'+s,s*.56,.76,-.17,.13,.22,.14,slate);
    p('speakercone'+s,s*.56,.819,-.096,.085,.089,.018,ink,false,shape('sphere'));
  }
  lamp(desk,.84,.76,-.06,.45);
  p('tower',-.71,.015,-.03,.235,.56,.42,ink,true);
  p('towerled',-.71,.42,.183,.14,.027,.016,sky);
  chair('computer',12.35,1.75,'+X',{computer:true});
  const shelfPC=object('study-books',10.16,3.27,'-Z');
  shelfPC.part('case',0,0,0,1.43,.76,.39,walnut,true);
  shelfPC.part('cavity',0,.13,.201,1.28,.52,.018,ink);
  for(let i=0;i<6;i++)shelfPC.part('spine'+i,(i-2.5)*.12,.14,.226,.105,.32+(i%3)*.065,.071,[sage,teal,cream,rust][i%4]);
  roomArt('study-print',10.30,3.44,'-Z',1.10,.83,.72);

  function bed(id,x,z,w,face,bedding){
    const o=object(id,x,z,face,upstairs),p=o.part,d=2.20;
    p('frame',0,.12,0,w,.29,d,oak,true,tone('timber'));
    for(const s of [-1,1])for(const t of [-1,1])p('feet'+s+t,s*(w/2-.135),0,t*(d/2-.135),.14,.12,.14,walnut);
    p('head',0,.12,-d/2+.070,w,1.00,.14,walnut,true,tone('timber'));
    p('inset',0,.66,-d/2+.148,w-.15,.35,.023,oakLight,false,tone('timber'));
    p('mattress',0,.41,.018,w-.055,.25,d-.18,white,true);
    p('blanket',0,.66,.39,w-.041,.086,1.24,bedding,false,tone('fabric'));
    p('cuff',0,.747,-.113,w-.040,.022,.18,cream);
    for(let i=0;i<3;i++)p('hem'+i,0,.746,.78+i*.055,w-.077,.009,.023,[cream,oakLight,cream][i]);
    for(const s of [-1,1])p('pillow'+s,s*w*.235,.66,-.681,w*.42,.15,.45,cream,false,shape('sphere'));
  }
  function bedside(id,x,z,face){
    const o=object(id,x,z,face,upstairs),p=o.part;
    p('plinth',0,0,0,.45,.06,.42,walnut);
    p('case',0,.06,0,.52,.44,.46,oak,true,tone('timber'));
    p('front',0,.14,.233,.44,.26,.022,oakLight);
    p('knob',0,.27,.263,.058,.038,.045,brass);
    p('top',0,.50,0,.57,.055,.50,walnut,true);
    lamp(o,0,.555,0,.44);
  }
  bed('bed-front-left',2.45,1.35,1.60,'+Z',teal);
  bedside('nightstand-front-left',1.25,.81,'+Z');
  wardrobe('left-wardrobe',2.12,5.56,'-Z',1.63,upstairs);
  rug(object('left-rug',2.39,2.97,'+Z',upstairs),2.14,1.23,'#8b9c84','#c0b396');
  roomArt('left-print',2.20,5.855,'-Z',upstairs+1.99,.63,.52);
  bed('bed-front-right',11.45,1.35,1.60,'+Z',rose);
  bedside('nightstand-front-right',12.74,.88,'+Z');
  wardrobe('right-wardrobe',12.36,5.56,'-Z',1.63,upstairs);
  rug(object('right-rug',11.55,3.12,'+Z',upstairs),2.05,1.23,'#ad8b73','#d2bca2');
  roomArt('right-print',13.955,4.98,'-X',upstairs+1.15,.89,.75);
  bed('bed-primary',2.45,10.75,2.0,'-Z',sage);
  bedside('nightstand-primary-left',.90,11.37,'-Z');
  bedside('nightstand-primary-right',4.0,11.37,'-Z');
  wardrobe('primary-wardrobe',2.60,6.44,'+Z',1.82,upstairs);
  const dresser=object('primary-dresser',.36,7.22,'+X',upstairs);
  dresser.part('body',0,0,0,1.55,.86,.60,oak,true,tone('timber'));
  for(let i=0;i<3;i++){
    dresser.part('drawer'+i,0,.12+i*.223,.31,1.47,.199,.027,oakLight);
    for(const s of [-1,1])dresser.part('pull'+i+s,s*.41,.20+i*.223,.335,.13,.025,.034,brass);
  }
  mirror(dresser,0,1.05,-.288,1.07,.70);
  rug(object('primary-rug',2.45,9.62,'-Z',upstairs),2.62,1.74,'#99a195','#cbbba5');

  function linen(id,x,z,face,w){
    const o=object(id,x,z,face,upstairs),p=o.part,d=.45;
    for(const s of [-1,1])p('upright'+s,s*(w/2-.028),0,0,.055,2.03,d,oak,true);
    for(const [i,b] of [.11,.68,1.27,1.93].entries())p('shelf'+i,0,b,0,w,.050,d,oakLight,true);
    if(id==='linen-east'){
      for(let i=0;i<3;i++){
        p('linen'+i,-.14,.73+i*.07,.015,w*.42,.065,.35,[cream,sky,white][i]);
        p('box'+i,(i-1)*w/3,1.32,0,w*.27,.23,.32,[teal,cream,sage][i]);
      }
    }else if(id==='linen-north'){
      for(let i=0;i<6;i++){
        const u=(i-2.5)*w*.13;
        p('hanger'+i,u,1.80,0,.035,.13,.035,metal);
        p('coat'+i,u,1.35,.02,.27,.45,.16,[sage,rust,cream,teal][i%4]);
      }
    }else{
      for(let i=0;i<2;i++){
        p('drawer'+i,0,.16+i*.25,.03,w-.14,.23,.38,cream,true);
        p('knob'+i,0,.24+i*.25,.23,.15,.025,.035,brass);
      }
      p('spare-duvet',0,1.32,0,w*.68,.19,.37,sky,false,shape('sphere'));
    }
  }
  linen('linen-east',13.75,7.19,'-X',1.82);
  linen('linen-north',11.37,8.05,'-Z',1.78);
  linen('linen-south',11.52,6.35,'+Z',1.63);

  vanity('full-vanity',11.09,8.80,'+Z',2.06,upstairs);
  toilet('full-toilet',13.50,9.20,'-X',upstairs);
  const tub=object('full-tub',10.36,11.49,'-Z',upstairs),tp=tub.part;
  tp('base',0,0,0,2.28,.43,.89,cream,true);
  tp('rim',0,.43,0,2.32,.09,.95,white,true);
  tp('basin',0,.52,0,2.08,.018,.70,'#b3c6c2',false,shape('sphere'));
  tp('tapstem',-.82,.52,-.35,.044,.19,.045,metal);
  tp('tapspout',-.82,.67,-.25,.048,.04,.23,metal);
  const shower=object('full-shower',13.12,11.13,'-Z',upstairs),sp=shower.part;
  sp('tray',0,0,0,1.59,.095,1.59,stone,true);
  sp('drain',0,.095,.10,.15,.008,.15,metal,false,shape('cylinder'));
  // Fixed rear/side glazing. The near-left entrance stays open from outside.
  sp('screen',-.77,.095,0,.035,1.89,1.56,sky,true,{glass:true});
  sp('return',-.47,.095,.77,.62,1.89,.035,sky,true,{glass:true});
  sp('rail',-.77,1.985,0,.046,.045,1.59,metal);
  sp('returntop',-.47,1.985,.77,.63,.045,.046,metal);
  sp('pipe',-.69,.78,-.64,.035,1.21,.035,metal);
  sp('showerarm',-.69,1.96,-.54,.038,.038,.26,metal);
  sp('head',-.69,1.91,-.418,.19,.04,.19,metal,false,shape('cylinder'));
  sp('control',-.69,1.04,-.63,.080,.075,.075,brass);
  towel(object('full-towels',9.02,8.925,'+Z',upstairs),.44,1.01,-.35,rust);
  rug(object('bathmat',11.97,10.58,'+Z',upstairs),.84,1.0,'#959f95','#bfbcaa');

  // The west shared wall and entry stay fixed when a longer Drive car is shown.
  const bench=object('garage-workbench',14.57,garageDepth-1.04,'+X');
  table(bench,1.70,.67,.89,.09);
  bench.part('toolboard',0,1.03,-.32,1.58,.85,.045,slate);
  for(let i=0;i<5;i++){
    const u=(i-2)*.235,metallic=i%2?metal:brass;
    bench.part('tool'+i,u,1.19+i%2*.15,-.281,.043,.29,.037,metallic);
    bench.part('head'+i,u,1.44+i%2*.15,-.278,.12,.079,.037,metallic);
  }
  bench.part('vice',.53,.89,.04,.28,.11,.21,teal);
  // Keep the cabinet below the equipment rack on the opposite wall. The
  // western bench, its legs and the route from the pedestrian door stay clear.
  const cabinet=object('garage-cabinet',14.2+garageWidth-.29,garageDepth-1.12,'-X');
  cabinet.part('body',0,0,0,.68,1.45,.53,slate,true);
  cabinet.part('handle',.16,.62,.281,.038,.18,.05,metal);
  const rack=object('garage-rack',14.20+garageWidth-.16,garageDepth-1.12,'-X');
  rack.part('bar',0,1.49,0,1.32,.075,.21,slate,true);
  for(let i=0;i<3;i++){
    rack.part('tire'+i,(i-1)*.395,1.565,.07,.24,.50,.49,ink,true,shape('sphere'));
    rack.part('rim'+i,(i-1)*.395,1.715,.289,.15,.20,.054,slate,false,shape('sphere'));
  }
  const branding=object('garage-brand',14.20+garageWidth*.50,garageDepth-.036,'-Z');
  branding.part('plaque',0,1.39,0,1.86,.54,.038,teal);
  // A small painted slalom graphic sits beside the DRIVE lettering.
  // House-local +X is viewer-right from the street. From the decorated
  // face of a model, increasing its local u axis therefore reads right to left.
  for(let i=0;i<3;i++)branding.part('slash'+i,.70-i*.145,1.48,0.023,.072,.29,.01,cream);
  const letters=['110101101101110','110101110101101','111010010010111','101101101101010','111100110100111'];
  for(let j=0;j<letters.length;j++)for(let i=0;i<15;i++)if(letters[j][i]==='1')
    branding.part('letter'+j+'-'+i,.265-j*.194-(i%3)*.043,1.53+(4-Math.floor(i/3))*.054,.025,.037,.047,.012,cream);
  const centerX=14.20+garageWidth/2,centerZ=garageDepth/2;
  for(const s of [-1,1])for(const t of [-1,1]){
    const mark=object('garage-mark'+s+t,centerX+s*(garageWidth/2-.96),centerZ+t*(garageDepth/2-.88));
    mark.part('x',s*-.16,.012,0,.352,.009,.028,'#c8be96');
    mark.part('z',0,.012,t*-.18,.028,.009,.38,'#c8be96');
  }
  const outdoor=object('patio-table',5.12,14.35);
  table(outdoor,1.21,1.0,.745,.073,teal);
  plant(outdoor,0,.745,0,.66);
  for(const [i,[x,z,f]] of [[4.05,14.35,'+X'],[6.19,14.35,'-X'],[5.12,13.42,'+Z'],[5.12,15.28,'-Z']].entries())
    chair('patio-chair-'+i,x,z,f,{deck:true});
  const grill=object('patio-grill',10.04,15.02,'-Z');
  grill.part('stand',0,.10,0,.79,.62,.48,slate,true);
  grill.part('tray',0,.72,0,1.16,.09,.63,ink,true);
  grill.part('lid',0,.81,0,.96,.40,.60,slate,true,shape('sphere'));
  grill.part('grip',0,.94,.298,.41,.048,.059,metal);
  for(const s of [-1,1])grill.part('foot'+s,s*.30,0,0,.09,.10,.38,ink);
  for(const win of windows){
    if(!/^(living-|dining-|bed-left-|bed-right-|bedroom-|primary-)/.test(win.id))continue;
    const alongX=win.axis==='x',front=win.coord<0;
    const face=alongX?(front?'+Z':'-Z'):(front?'+X':'-X'),center=win.coord+(front?.215:-.215);
    const o=object('curtain-'+win.id,alongX?win.center:center,alongX?center:win.center,face,win.base);
    const cloth=win.base===0?'#c4ccba':'#d7c9b2',height=win.top-win.bottom+.055;
    o.part('rail',0,win.top+.068,0,win.width+.27,.024,.024,brass);
    for(const sign of [-1,1]){
      const position=sign*(win.width/2-.005);
      o.part('panel'+sign,position,win.bottom+.013,.012,.21,height,.032,cloth,false,tone('soft'));
      for(let i=-1;i<=1;i++)o.part('fold'+sign+i,position+i*.063,win.bottom+.02,.034,.023,height-.018,.024,cream);
    }
  }
  // Clapboards stop at the same window and door casings used by the walls.
  // Their slightly darker lower lips define individual courses in sunlight.
  function siding(id,axis,coord,outward,lo,hi,base,height){
    const alongX=axis==='x',surface=coord+outward*.113;
    const facade=object('siding-'+id,alongX?0:surface,alongX?surface:0);
    const openings=[
      ...windows.filter(w=>w.axis===axis&&Math.abs(w.coord-coord)<.001)
        .map(w=>({c:w.center,w:w.width,b:w.base+w.bottom,t:w.base+w.top})),
      ...doors.filter(d=>d.axis===axis&&Math.abs((alongX?d.z:d.x)-coord)<.001)
        .map(d=>({c:alongX?d.x:d.z,w:d.w,b:d.y,t:d.y+d.h}))
    ].sort((a,b)=>a.c-b.c);
    const put=(k,a,b,y)=>{
      if(b-a<.04)return;
      const center=(a+b)/2;
      facade.part(k,alongX?center:0,y,alongX?0:center,alongX?b-a:.018,.018,alongX?.018:b-a,'#b5ad9a');
    };
    for(let i=1;i*.265<height-.10;i++){
      const y=base+i*.265;let start=lo,n=0;
      for(const op of openings){
        if(y<op.b-.065||y>op.t+.11||op.c-op.w/2>hi||op.c+op.w/2<lo)continue;
        put('lip'+i+'-'+(n++),start,Math.min(hi,op.c-op.w/2-.085),y);
        start=Math.max(start,op.c+op.w/2+.085);
      }
      put('lip'+i+'-end',start,hi,y);
    }
  }
  siding('front','x',-.1,-1,.14,13.86,0,6.24);
  siding('back','x',12.1,1,.14,13.86,0,6.24);
  siding('west','z',-.1,-1,.14,11.86,0,6.24);
  siding('east-upper','z',14.1,1,.14,11.86,3.24,3);
  if(garageDepth<11.83)siding('east-lower','z',14.1,1,garageDepth+.13,11.86,0,3.04);
  siding('garage-front','x',-.1,-1,14.32,14.2+garageWidth-.12,0,2.96);
  siding('garage-side','z',14.2+garageWidth+.1,1,.12,garageDepth-.12,0,2.96);
  const facade=object('gable',7,-.224,'-Z');
  facade.part('vent-frame',0,6.65,0,1.12,.54,.055,cream);
  facade.part('vent-shadow',0,6.69,.032,.99,.46,.016,slate);
  for(let i=0;i<5;i++)facade.part('louver'+i,0,6.724+i*.081,.05,.975,.034,.037,oakLight);
  for(const w of windows.filter(w=>w.id==='bed-left-front'||w.id==='bed-right-front')){
    const o=object('shutters-'+w.id,w.center,-.226,'-Z',w.base);
    for(const s of [-1,1]){
      const u=s*(w.width/2+.245);
      o.part('board'+s,u,w.bottom,0,.30,w.top-w.bottom,.055,sage);
      for(let i=0;i<8;i++)o.part('slat'+s+i,u,w.bottom+.10+i*.135,.032,.25,.049,.02,'#7e9180');
    }
  }
  for(const [name,x,z,w,d] of [['front',2.46,-.80,4.42,.85],['rear',1.53,13.12,2.50,1.24]]){
    const o=object('garden-'+name,x,z),p=o.part;
    p('soil',0,.004,0,w,.047,d,'#796650');
    for(const s of [-1,1]){
      p('end'+s,s*(w/2-.028),.02,0,.056,.07,d,oakLight);
      p('edge'+s,0,.02,s*(d/2-.025),w,.07,.05,oakLight);
    }
    const n=Math.max(3,Math.ceil(w/.90));
    for(let i=0;i<n;i++){
      const u=(i-(n-1)/2)*(w-.62)/(n-1);
      p('stem'+i,u,.05,.04,.085,.25,.085,walnut);
      p('leaf'+i,u,.22,.04,.61,.39+.09*(i%2),.59,i%2?'#617b58':'#748b63',true,shape('sphere'));
      for(let k=0;k<3;k++)
        p('flower'+i+k,u+(k-1)*.123,.49+.08*(i%2),-.076+(k%2)*.13,.095,.067,.095,i%2?'#ddaf76':'#c9816c',false,shape('sphere'));
    }
  }
  return {parts,seats,items};
}
return {recipe,directions,upstairs};
});

