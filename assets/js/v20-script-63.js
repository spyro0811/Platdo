/* The landmarks, clues and keepsakes are fixed for each trail; hints never cost currency. */
(function(root){'use strict';const P=root.PlatdoPark||(typeof require==='function'&&require('./premium-park-runtime.js'));
const districts=['Northhaven','City Centre','Mountain park','Boardwalk beach'];
const entries=[
 ['First Post','Brass post horn','mailbox','The blue post box outside the north-town row houses bears a brass stamp.','A worn compass cut into the paving points east.'],
 ['Last Tram','Enamel tram token','tram sign','Find the stop that still lists the final evening service.','A ticket corner is pressed against the orange bench.'],
 ['Under the Pines','Carved jay','pine','Count the tallest pine beside the park path.','A feather mark faces the low stone wall.'],
 ['Sea Watch','Tide key','clock','Follow the clock that watches the sea.','Find the marked stone below the clock. A notch points toward the tide stairs.'],
 ['Foundry Bell','Pocket bell','bell','The old town bell rang only at shift changes.','Read the scratch behind the bell stand.'],
 ['Paper Rounds','Copper nib','news kiosk','Follow yesterday’s paper to the brick newspaper kiosk.','A constellation of ink drops points between two poles.'],
 ['Bridge Keeper','Painted trout','bridge','Look for the narrow wooden footbridge.','Find the carved scales near the water-facing end.'],
 ['Salt and Signal','Glass buoy','beacon','Look where the green harbor beacon faces open water.','Three pebbles make a triangle in the shadow of the lamp.'],
 ['North Wind','Silver weathercock','weathervane','Above the old workshop a rooster never leaves its post.','Find the marked brick at the turn of the path.'],
 ['Meridian','Folding sundial','sundial','A city dial casts a shadow even when no clock chimes.','The engraved noon line crosses a row of brass studs.'],
 ['Summit Letter','Survey compass','cairn','Follow the mountain-marker cairn above the switchbacks.','Find the flat stone with a needle scratched into it.'],
 ['Twelve Fathoms','Tiny anchor','anchor','An anchor on the promenade is too small for any ship here.','Read the distance marks on the mooring posts.']
];
const trails=entries.map((e,i)=>{const tier=Math.floor(i/4),region=i%4;return{id:'trail-'+(i+1),name:e[0],reward:e[1],landmark:e[2],intro:e[3],clue:e[4],tier,region,
  mark:{x:-5+(i%3),z:2+(i%2)},stone:{x:-2+(i%4)*.7,z:5-(i%3)},dig:{x:1.5+(i%4)*1.1,z:4+(i*7%6)},anchors:[{x:-5,z:8},{x:7,z:8},{x:2,z:-2}]};});
function blank(){return{phase:0,seconds:0,hint:0,mistakes:0,found:false};}
function progress(trail,state,point,button){if(state.found)return'done';if(button==='hint'){state.hint=Math.min(3,state.hint+1);return'hint';}
  if(button==='inspect'){if(state.phase===0&&P.dist(point,trail.mark)<=2.1){state.phase=1;return'mark';}
    if(state.phase===1&&P.dist(point,trail.stone)<=1.7){state.phase=2;return'stone';}return'look';}
  if(button==='dig'){if(state.phase<2)return'early';if(P.dist(point,trail.dig)<(1.45-trail.tier*.18)){state.found=true;return'found';}state.mistakes++;return'empty';}}
function create(g){let t=trails[0],s,group,labels=[],pulse=0,journal=false,standItems=[],theme,stand;
  g.data.trails||={};g.data.keepsakes||={};function current(){return g.data.trails[t.id]||=(blank());}
  const colors=['#c8b898','#a6afb9','#7d9b69','#dcc99c'];
  const pad=g.box(0,-.14,0,30,.26,30,colors[0]);
  function thing(kind,x,z,i,group){const hue=['#93a48c','#7396a4','#c4a167','#a36349'][i%4];
    const b=(xx,y,zz,w,h,d,color)=>g.box(x+xx,y,z+zz,w,h,d,color,group),sphere=(xx,y,zz,r,color)=>g.ball(x+xx,y,z+zz,r,color,group);
    if(kind==='clock'||kind==='sundial'||kind==='weathervane'){b(0,1,0,.26,2,.26,'#556767');if(kind==='clock'){const face=g.mesh('cylinder',[.57,.57,.16,26],'#eee1bc',group);face.rotation.x=Math.PI/2;face.position.set(x,2.15,z);b(0,2.25,-.1,.055,.3,.04,'#354957');b(.11,2.12,-.1,.27,.04,.04,'#354957');}
      else if(kind==='weathervane'){b(0,2.3,0,1.25,.08,.1,'#a8873e');sphere(.25,2.55,0,.20,'#bd9651');}else{b(0,1.1,0,1.25,.15,1.25,hue);const tip=g.mesh('cone',[.10,.62,4],'#d3a967',group);tip.position.set(x,1.45,z);}}
    else if(kind==='pine'||kind==='cairn'){for(let j=0;j<3;j++){const part=g.mesh(kind==='pine'?'cone':'ball',kind==='pine'?[.95-j*.19,1.4,9]:[.65-j*.14,9,6],kind==='pine'?'#497b54':'#929189',group);part.position.set(x,.6+j*.63,z);}}
    else if(kind==='bridge'){b(0,.32,0,2.6,.34,1.35,'#9b7b56');for(const side of[-1,1]){b(0,.95,side*.69,2.8,.13,.12,hue);for(const v of[-1,1])b(v,.66,side*.69,.13,1.1,.13,hue);}}
    else if(kind==='beacon'||kind==='bell'){b(0,.7,0,.58,1.4,.58,'#79694e');const bell=g.mesh('cone',[.52,.68,12],kind==='bell'?'#be9858':'#7bd4a3',group);bell.position.set(x,1.75,z);sphere(0,2.15,0,.14,hue);}
    else if(kind==='anchor'){b(0,.92,0,.17,1.8,.19,'#475863');b(0,.45,0,1.45,.16,.2,'#475863');for(const side of[-1,1]){const prong=b(.65*side,.56,0,.13,.52,.2,'#475863');prong.rotation.z=-.4*side;}}
    else if(kind==='tram sign'){b(0,1,0,.12,2,.12,'#526364');b(0,2.05,0,1.2,.5,.14,'#5c8b98');}
    else{b(0,.67,0,kind==='news kiosk'?1.8:.75,1.3,.75,kind==='mailbox'?'#487cb1':hue);b(0,1.4,0,kind==='news kiosk'?2.2:.90,.22,.94,'#c29e62');b(0,1,-.40,.45,.10,.05,'#2d4048');}}
  function layout(){group?.removeFromParent();for(const l of labels)l.removeFromParent();labels=[];group=new g.T.Group();g.scene.add(group);pad.material=g.mesh('box',[.01,.01,.01],colors[t.region],group).material;
    thing(t.landmark,t.mark.x,t.mark.z,t.region,group);labels.push(g.sign(districts[t.region].toUpperCase(),0,3.7,11));
    const stone=g.ball(t.stone.x,.20,t.stone.z,.42,'#828983',group);stone.scale.set(1.4,.52,1);g.box(t.stone.x,.43,t.stone.z,.31,.025,.04,'#f2c951',group);
    for(const [i,q]of t.anchors.entries()){thing(['tram sign','cairn','weathervane'][i],q.x,q.z,i,group);labels.push(g.sign(['A · Post','B · Stones','C · Vane'][i],q.x,2.8,q.z,.6));}
    for(let i=0;i<6;i++){const x=-10+i*4,z=12;
      if(t.region<2){g.box(x,1.8,z,3.5,3.6,2.9,i%2?'#c38c71':'#c1b9a3',group);for(const a of[-.86,.86])g.box(x+a,2,z-1.48,.6,.8,.07,'#577685',group);}
      if(t.region===2)thing('pine',x,z,i,group);if(t.region===3){g.box(x,.22,z,3.99,.23,2.3,'#9d805b',group);g.box(x+.9,.68,z,.17,1.3,.17,'#978063',group);}}
    if(t.region===3)g.box(0,-.03,14.2,28,.18,2.5,'#759faa',group);
    stand=g.box(7,.56,-6,4,.2,1.8,'#9a7954',group);standItems=[];Object.keys(g.data.keepsakes).forEach((id,i)=>{const m=g.mesh(i%3===0?'ring':i%3===1?'ball':'cone',i%3===0?[.18,.055,7,16]:i%3===1?[.21,12,8]:[.2,.4,8],['#c7a653','#829ba8','#ae7757'][i%3],group);m.position.set(5.45+(i%6)*.56,.87,-6.4+Math.floor(i/6)*.72);standItems.push(m);});labels.push(g.sign('SOCIETY COLLECTION',7,1.7,-6,.7));}
  function panel(){g.panel(journal?'Society field journal':'Trail office');g.select('Choose a trail',trails.map(r=>[r.id,('★'.repeat(r.tier+1))+' '+r.name]),t.id,id=>start(trails.find(r=>r.id===id)));
    g.para(districts[t.region]+' · '+t.intro);if(s.phase>=1)g.para(t.clue);
    if(s.phase>=2){const distances=t.anchors.map(a=>P.dist(a,t.dig).toFixed(1)+' m');g.para('Triangulation readings from A, B and C: '+distances.join(' / ')+'. Scan for the strongest pulse and dig.');}
    if(s.hint)g.para('Hint '+s.hint+' · '+[districts[t.region],t.landmark,'Search by the eastern half of the triangle, '+P.dist(t.dig,t.anchors[1]).toFixed(1)+' m from B.'][s.hint-1]);
    if(!journal){g.button('Inspect nearby clue',()=>interact('inspect'));g.button('Dig here',()=>interact('dig'));}else{for(const r of trails)g.para((g.data.keepsakes[r.id]?'◆ '+r.reward:'◇ Unfound')+' · '+r.name);g.para('Collection stand: the wooden table by the entrance displays every recovered keepsake.');}
    g.button(journal?'Back to trail':'Open journal',()=>{journal=!journal;panel();});g.button('Free hint',()=>interact('hint'));g.button('Restart this trail',()=>{g.data.trails[t.id]=blank();start(t);g.save();});}
  function start(trail){t=trail;s=current();g.data.activeTrail=t.id;g.save();g.player.x=0;g.player.z=-5;g.yaw=-.35;g.pitch=-.08;layout();panel();}
  function interact(button){const out=progress(t,s,g.player,button);const status={hint:'Journal hint added.',mark:'Landmark confirmed. A second clue is in your journal.',stone:'Three triangulation distances recorded.',look:'Move beside the landmark or marked stone to inspect.',early:'Follow the landmark clue before digging.',empty:'Nothing buried here. Try following a stronger signal.',done:'Keepsake recovered. Select another trail or restart this one.'};
    if(out==='found'){g.data.keepsakes[t.id]=t.reward;g.record(t.id,{score:s.seconds,hints:s.hint});g.note('Recovered '+t.reward+' · '+s.seconds.toFixed(1)+' seconds');layout();g.tone(760,.16);}else g.note(status[out]||'Check the trail journal.');g.save();panel();}
  start(trails.find(trail=>trail.id===g.data.activeTrail)||trails[0]);return{input(id,on){if(!on)return;if(id==='journal'){journal=!journal;panel();}else interact(id);},step(dt){if(!journal){g.move(dt,4,12);if(!s.found)s.seconds+=dt;}g.follow(1.55,1.4);const distance=P.dist(g.player,t.dig),strength=s.phase===2&&!s.found?P.clamp(1-distance/12,0,1):0;
    pulse-=dt;if(strength>.1&&pulse<=0){g.tone(230+strength*480,.05);pulse=1.08-strength*.9;}
    g.hud(t.name+' · '+districts[t.region]+'\n'+(s.found?'Recovered '+t.reward:s.phase<2?'Clues '+s.phase+'/2':'Detector '+Math.round(strength*100)+'%')+' · '+Object.keys(g.data.keepsakes).length+'/12 keepsakes');}};}
P.register({id:'CITY-15',name:'Treasure Trail Society',launch:'Open trail journal',description:'Twelve landmark trails, three clue levels, a reusable detector and a permanent twelve-piece collection.',keys:{KeyE:'inspect',KeyF:'dig',KeyH:'hint',KeyJ:'journal'},buttons:[['inspect','Inspect'],['dig','Dig'],['hint','Hint'],['journal','Journal']],create});
if(typeof module==='object')module.exports={trails,blank,progress};})(typeof globalThis==='undefined'?window:globalThis);
