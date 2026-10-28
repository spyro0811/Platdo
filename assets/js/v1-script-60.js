
/* Fitted cosmetic geometry stays below the existing articulated region nodes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CityCosmeticModels=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function beard(T,parent,a,h){
 const {rings,curve,sphere,material}=h,id=a.facialHair||0;if(!id)return;
 const face=h.faceProfile||{width:1,jaw:1,length:1},m=material(a.beardHex||a.hairHex||h.hairColor||'#382921'),g=new T.Group();parent.add(g);g.name='facial-hair-'+id;
 const moustache=[8,9,15,16,17,18,19,20,21,22].includes(id),full=[1,2,3,4,5,11,12,25,26,27,28,29].includes(id),goatee=[6,7,8,9,10,24].includes(id);
 if(full){const length=id<=5?[0,.004,.010,.026,.047,.105][id]:({11:.012,12:.031,25:.076,26:.065,27:.037,28:.055,29:.039})[id],width=Math.max(id===11?.067:id===25?.065:id===29?.086:.080,.112*face.width*.85*face.jaw)+.003;rings(g,m,[[-.060*face.length-length,width*(id===25?.35:id===29?.91:.68),.056,.019],[-.025*face.length,width,.094,.019],[.013*face.length,width*1.02,.096,.017],[(id===12?.022:.029)*face.length,width*1.03,.092,.016]],16);if(id===27)for(const x of[-.023,0,.023])curve(g,m,[[x,-.028,.08],[x*.8,-.075,.079],[x*.5,-.13,.055]],.013);if(id===26)for(const s of[-1,1])curve(g,m,[[s*.027,-.025,.09],[s*.034,-.085,.065],[s*.041,-.11,.04]],.019);}
 if(id===12)for(const side of[-1,1])curve(g,m,[[side*.087,.065,.018],[side*.084,.010,.045],[side*.070,-.025,.058]],.013);
 if(goatee){const length=id===24?.048:id===8?.054:id===9?.036:id===10?.016:.025;rings(g,m,[[-.035-length,id===10?.035:.019,.015,.085],[-.028,id===10?.045:.038,.022,.095],[.020,id===9?.025:.030,.015,.105]],12);}
 if([13,14].includes(id))for(const s of[-1,1])sphere(g,m,s*.079,.038,.035,.024,.063,.051);
 if(moustache||[3,4,5,7,14,25,26,28,29].includes(id)){const y=.058,r=id===16?.003:id===19?.014:id===20?.010:.007;for(const s of[-1,1]){const points=[[0,y+.003,.126],[s*.025,y,.118],[s*.043,y-(id===18?.045:0),.105]];if([17,20,21,22].includes(id))points.push([s*(id===22?.09:id===21?.080:.065),y+(id===22?.045:id===20?.038:id===21?.002:.014),.102]);curve(g,m,points,r);}}
 if(id===23)sphere(g,m,0,.010,.107,.012,.013,.005);
}
function decorate(T,rig,a,h){
 const {material,sphere,box,rings,curve,cylinder,group}=h,metal=material('#8c989e',.7,.3),dark=material('#252e35'),gold=material('#dcb44c',.65,.25),white=material('#e8e4d9'),body=h.body;
 const moving=rig.clothMotion=[];
 const cone=(g,m,x,y,z,r,height,n=8)=>{const mesh=new T.Mesh(new T.ConeGeometry(r,height,n),m);mesh.position.set(x,y,z);g.add(mesh);return mesh;};
 const patch=(g,m,x,y,z,w,hh,d)=>box(g,m,x,y,z,w,hh,d);
 const id=a.cosmeticHat;
 if(Number.isInteger(id)){
  const f=Math.floor(id/4),v=id%4,g=group(rig.head,'catalog-hat-'+id),m=material(a.hatColor||'#44617a'),trim=v===2?gold:dark;g.scale.setScalar(v===3?1.24:1);g.position.y=.014-(v===3?.22*.24:0);
  const brim=(r=.18,depth=.14)=>{const o=cylinder(g,m,0,.225,0,r,.018);o.scale.z=depth/r;return o;};
  const crown=(height=.095,r=.116)=>rings(g,m,[[.22,r,.105],[.22+height,r*.86,.094],[.235+height,r*.70,.078]],16);
  if([0,3,4,10,11].includes(f)){brim(f===11?.24:f===3?.16:f===0?.13:.19);crown(f===10?.20:f===4?.11:.085);if(f===0)patch(g,m,0,.23,.15,.18,.012,.15);if(f===4||f===10)rings(g,trim,[[.241,.117,.107],[.26,.113,.104]],16);}
  else if(f===1){sphere(g,m,0,.26,-.008,.124,.095,.112);rings(g,trim,[[.208,.126,.113],[.24,.126,.113]],16);if(v>0)sphere(g,trim,0,.35,0,.027,.031,.027);}
  else if(f===2){const o=brim(.23,.17);o.rotation.z=.06;crown(.13,.105);for(const s of[-1,1]){const b=patch(g,m,s*.19,.25,0,.08,.022,.27);b.rotation.z=s*.28;}rings(g,trim,[[.236,.105,.101],[.255,.103,.10]],16);}
  else if(f===5){sphere(g,m,-.018,.27,0,.146,.045,.12);cylinder(g,trim,-.03,.315,0,.009,.018);}
  else if(f===6){rings(g,m,[[.226,.123,.113],[.251,.123,.113]],16);patch(g,m,0,.239,.15,.18,.014,.15);}
  else if(f===7){sphere(g,m,0,.27,0,.135,.075,.12);for(const s of[-1,1])patch(g,trim,s*.125,.17,0,.034,.16,.09);}
  else if([8,18,20,21,24].includes(f)){
   const shell=f===20?metal:f===21?material('#879a9d',.65,.4):f===24?material('#7ca67a'):m;
   sphere(g,shell,0,.235,-.028,f===18?.159:.133,f===18?.168:.115,.128);
   // Visor assembly is open at the facial center; it does not erase facial features.
   for(const s of[-1,1])patch(g,shell,s*.123,.14,.045,.032,.12,.095);
   patch(g,dark,0,.241,.117,.18,.033,.025);patch(g,metal,0,.075,.092,.20,.025,.06);
   if(f===18){const visor=new T.Mesh(new T.SphereGeometry(.154,16,10,0,Math.PI),new T.MeshStandardMaterial({color:'#8fc7d6',transparent:true,opacity:.23,roughness:.16,metalness:.2,depthWrite:false}));visor.position.set(0,.188,0);g.add(visor);rings(g,white,[[.035,.132,.125],[.075,.139,.129]],16);}
   if(f===20)for(const s of[-1,1])patch(g,metal,s*.065,.15,.121,.064,.035,.025);
   if(f===21){for(const s of[-1,1])sphere(g,material('#7edbe9',.2,.3),s*.064,.185,.116,.025,.016,.018);cylinder(g,metal,0,.385,0,.008,.12);sphere(g,gold,0,.449,0,.018,.018,.018);}
   if(f===24)for(const s of[-1,1]){curve(g,shell,[[s*.06,.31,0],[s*.10,.40,0],[s*.14,.42,0]],.014);sphere(g,gold,s*.14,.42,0,.023,.023,.023);}
  }
  else if(f===9){rings(g,gold,[[.23,.128,.114],[.29,.133,.119]],16);for(let i=0;i<7;i++){const th=i/7*Math.PI*2;cone(g,gold,Math.sin(th)*.13,.326,Math.cos(th)*.116,.036,.10,4);sphere(g,material(i%2?'#4bc3df':'#d1576c'),Math.sin(th)*.13,.285,Math.cos(th)*.125,.013,.014,.009);}}
  else if(f===12){const yellow=material('#f0d343');curve(g,yellow,[[-.15,.25,0],[-.15,.35,0],[-.06,.44,0],[.08,.45,0],[.17,.41,0]],.050);for(const s of[-1,1])cone(g,dark,s*.16,s<0?.24:.41,0,.018,.04);}
  else if(f===13){const shape=new T.Shape();shape.moveTo(-.17,0);shape.lineTo(.17,0);shape.lineTo(0,.30);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.034,bevelEnabled:true,bevelThickness:.005,bevelSize:.005,bevelSegments:1,steps:1});const p=new T.Mesh(geo,material('#e8c55b'));p.position.set(0,.25,-.02);g.add(p);curve(g,material('#b27a46'),[[-.17,.25,.012],[0,.24,.012],[.17,.25,.012]],.026);for(let i=0;i<5;i++)sphere(g,material('#b94f3c'),(i%2?-.05:.04),.28+i*.041,.020,.021,.022,.01);}
  else if(f===14){cone(g,material('#f49a43'),0,.415,0,.15,.39);rings(g,white,[[.33,.112,.112],[.36,.095,.095]],16);patch(g,dark,0,.22,0,.34,.022,.30);}
  else if(f===15){const kraft=material('#b79568');patch(g,kraft,0,.37,0,.31,.02,.28);for(const s of[-1,1])patch(g,kraft,s*.15,.275,0,.018,.20,.28);patch(g,kraft,0,.275,-.14,.30,.20,.018);patch(g,dark,0,.32,.144,.11,.035,.006);}
  else if(f===16||f===17){const m2=f===16?material('#6f9a56'):white;sphere(g,m2,0,.28,0,.14,.095,.13);for(const s of[-1,1])sphere(g,white,s*.09,.30,.10,.028,.029,.026);for(const s of[-1,1])sphere(g,dark,s*.09,.30,.123,.011,.012,.005);if(f===17){cone(g,material('#e2a544'),0,.23,.165,.05,.13).rotation.x=Math.PI/2;for(let i=0;i<4;i++)sphere(g,material('#b64b49'),0,.37,-.07+i*.04,.027,.04,.028);}else for(let i=0;i<4;i++)cone(g,gold,0,.38,-.09+i*.06,.028,.075);}
  else if(f===19){brim(.21);crown(.10,.115);for(let i=0;i<3;i++){const th=i*2*Math.PI/3,o=patch(g,m,Math.sin(th)*.145,.28,Math.cos(th)*.145,.17,.07,.02);o.rotation.y=th;o.rotation.x=.5;}sphere(g,white,0,.29,.16,.028,.027,.012);}
  else if(f===22){for(let i=0;i<10;i++){const th=i/10*Math.PI*2;sphere(g,material(['#ba4b65','#e2b854','#479ba7'][i%3]),Math.sin(th)*.13,.265,Math.cos(th)*.11,.042,.047,.04);}}
  else if(f===23){brim(.22);cone(g,m,.015,.42,0,.14,.38);for(let i=0;i<4;i++)sphere(g,gold,(i%2?-.04:.06),.31+i*.05,.10-i*.01,.012,.013,.005);}
  else if(f===25){sphere(g,metal,0,.27,0,.13,.08,.12);for(const s of[-1,1])curve(g,white,[[s*.10,.28,0],[s*.19,.32,0],[s*.21,.40,0]],.023);}
  if(v===1)for(const s of[-1,1])patch(g,dark,s*.118,.235,-.015,.025,.04,.045);
  if(v===2)for(let i=0;i<5;i++)sphere(g,gold,(i-2)*.036,.249,.118,.009,.010,.006);
 }
 if(Number.isInteger(a.cosmeticTop)){
  const f=Math.floor(a.cosmeticTop/4),v=a.cosmeticTop%4,g=group(rig.spine,'catalog-top-'+a.cosmeticTop),m=material(a.topColor||'#44617a'),trim=material(a.topAccentColor||'#cfbd8d');
  const width=Math.max(body.shoulders*.40,body.waist*.60),depth=.151;
  if(v===1)for(const s of[-1,1]){patch(g,trim,s*width*.52,.15,depth,.075,.095,.014);patch(g,m,s*width*.52,.195,depth+.012,.079,.021,.016);}
  if(v===2){for(const s of[-1,1])curve(g,trim,[[s*.04,.33,.105],[s*width*.62,.18,depth+.008],[s*width*.86,-.1,.15]],.008);for(let i=0;i<4;i++)sphere(g,gold,0,-.04+i*.07,depth+.012,.007,.008,.005);}
  if(v===3){rings(g,m,[[-.19,width*1.12,.17],[-.04,width*1.18,.176],[.13,width*1.15,.169],[.29,width*1.04,.14]],18);for(const s of['L','R'])rings(rig['arm'+s],m,[[.012,.082,.084],[-.08,.084,.087],[-.20,.075,.079]],12);}
  if([14,20].includes(f))for(const s of[-1,1])patch(g,trim,s*.10,-.035,.16,.075,.10,.025);
  if(f===7){patch(g,trim,0,.17,.156,.095,.27,.009);for(const s of[-1,1]){const collar=patch(g,m,s*.033,.32,.136,.048,.10,.018);collar.rotation.z=s*.48;}}
  if(f===19){patch(g,trim,0,.18,.151,.07,.10,.009);curve(g,trim,[[-.12,.30,.13],[0,.25,.153],[.12,.30,.13]],.007);}
  if(f===21){const lapel=material('#202733',.05,.35);for(const s of[-1,1]){const p=patch(g,lapel,s*.052,.25,.15,.047,.20,.012);p.rotation.z=s*.28;}for(const s of[-1,1])sphere(rig.chest,dark,s*.027,.315,.12,.03,.015,.009);}
  if(f===22){const tail=group(rig.pelvis,'dino-tail',0,-.025,-.13);curve(tail,m,[[0,0,0],[0,-.12,-.18],[0,-.28,-.39],[0,-.33,-.61]],.055);moving.push({node:tail,kind:'tail'});for(let i=0;i<4;i++)cone(g,trim,0,.03+i*.09,-.17,.035,.08).rotation.x=-Math.PI/2;}
  if(f===23)for(const s of['L','R']){const wing=group(rig['arm'+s],'feather-wing');for(let i=0;i<4;i++)sphere(wing,white,(s==='L'?-1:1)*.048,-.04-i*.048,-.025,.040,.105,.025);}
  if(f===24){patch(g,white,0,.12,.17,.20,.20,.045);for(let i=0;i<3;i++)sphere(g,material(['#cf554f','#4fada4','#ceba62'][i]),(i-1)*.048,.16,.2,.014,.014,.008);const pack=group(rig.spine,'suit-pack',0,.13,-.19);patch(pack,white,0,0,0,.22,.31,.12);for(const s of[-1,1])curve(g,dark,[[s*.12,.18,.17],[s*.20,.03,.10],[s*.16,-.08,-.14]],.016);}
  if(f===25){rings(g,metal,[[-.11,width,.16],[.05,width*1.05,.175],[.22,width*1.13,.17],[.29,width,.13]],18);for(const s of['L','R'])sphere(rig['arm'+s],metal,0,-.02,0,.094,.066,.09);}
 }
 if(Number.isInteger(a.cosmeticBottom)){
  const f=Math.floor(a.cosmeticBottom/4),v=a.cosmeticBottom%4,m=material(a.bottomColor||'#334352'),trim=material(a.bottomAccentColor||'#b7a37b');
  for(const side of[-1,1]){const k=side<0?'L':'R',th=rig['thigh'+k],calf=rig['calf'+k];
   if(v===1||[4,14,24].includes(f)){patch(th,trim,side*.084,-.17,.01,.035,.12,.10);patch(th,m,side*.104,-.12,.01,.038,.024,.103);}
   if(v===1)patch(th,trim,side*.09,-.31,.035,.042,.075,.084);
   if(v===2||[7,12,13].includes(f))curve(th,trim,[[side*.085,.015,.02],[side*.086,-.17,.02],[side*.071,-.36,.02]],.008);
   if(v===2)rings(calf,trim,[[-.23,.065,.071],[-.245,.065,.071]],14);
   if(v===3||f===17){rings(th,m,[[.01,.101,.11],[-.16,.11,.12],[-.33,.095,.105],[-.39,.068,.07]],14);}
   if([20,21,24].includes(f)){rings(calf,f===20?metal:f===21?material('#81999d',.5,.45):white,[[.02,.085,.080],[-.12,.084,.085],[-.30,.061,.062]],12);sphere(calf,metal,0,0,.062,.060,.055,.021);}
   if(f===22)for(let i=0;i<3;i++)cone(th,trim,side*.074,-.07-i*.10,-.085,.025,.060).rotation.x=-Math.PI/2;
   if(f===23)for(let i=0;i<3;i++)sphere(th,white,side*.03,-.08-i*.09,0,.086,.085,.086);
   if(f===2)curve(th,trim,[[side*.073,-.04,.068],[side*.035,-.11,.079]],.005);
   if(f===12){sphere(calf,dark,0,.012,.075,.068,.079,.027);patch(th,dark,side*.056,-.20,.071,.039,.13,.016);}
   if(f===13)for(let i=0;i<3;i++)patch(th,trim,0,-.09-i*.10,.081,.132,.021,.010);
   if(f===14){curve(th,dark,[[side*.055,.08,.079],[side*.078,-.20,.078]],.010);patch(th,metal,side*.061,.035,.089,.026,.028,.008);}
   if(f===15)curve(th,trim,[[side*.09,.04,-.016],[side*.094,-.18,-.016],[side*.077,-.36,-.016]],.012);
   if(f===16)for(let i=0;i<5;i++)rings(th,trim,[[-.03-i*.066,.090,.091],[-.044-i*.066,.090,.091]],12);
   if(f===17)rings(calf,trim,[[-.25,.080,.075],[-.32,.067,.064]],14);
   if(f===19){rings(calf,m,[[.03,.090,.086],[-.08,.093,.088]],12);for(let i=0;i<3;i++)sphere(calf,gold,side*.08,-.01-i*.028,.045,.008,.008,.006);}
  }
  if([18,25].includes(f)){const skirt=group(rig.pelvis,'catalog-long-skirt');rings(skirt,m,[[.10,.19,.14],[-.13,.22,.16],[-.40,.28,.21],[-.72,.34,.27]],22);moving.push({node:skirt,kind:'skirt'});}
  if(f===25)for(const side of[-1,1])curve(rig.pelvis,trim,[[side*.08,.08,.15],[side*.16,-.35,.21],[side*.28,-.70,.26]],.012);
  if(v===3){rings(rig.pelvis,trim,[[.075,body.hips*.62,.157],[.11,body.hips*.62,.157]],18);patch(rig.pelvis,metal,0,.093,.165,.055,.043,.012);}
 }
 if(Number.isInteger(a.cosmeticShoe)){
  const f=Math.floor(a.cosmeticShoe/4),v=a.cosmeticShoe%4,m=material(a.shoeColor||'#46505f'),trim=material(a.shoeAccentColor||'#c9ba9e');
  for(const s of['L','R']){const foot=rig['foot'+s],g=group(foot,'catalog-shoe-'+a.cosmeticShoe);
   if(v===3){g.scale.set(1.12,1.08,1.12);rings(g,trim,[[-.037,.084,.155,.068],[-.052,.087,.16,.068]],16);}
   if([3,4,9,10,14,15,16,19,21].includes(f))rings(g,[14,15].includes(f)?metal:m,[[0,.065,.11,.04],[.10,.063,.075,.01],[.19+(f===19?.08:0),.060,.061]],14);
   if(v===1)for(let i=0;i<3;i++)patch(g,trim,0,.055+i*.034,.062,.102,.015,.025);
   if(v===2){for(const side of[-1,1])curve(g,trim,[[side*.058,.02,-.05],[side*.064,.02,.075],[side*.04,.02,.17]],.007);}
   if(v===3||[11,13].includes(f))sphere(g,m,0,-.003,.13,.082,.050,.135);
   if(f===11)patch(g,dark,0,-.075,.05,.14,.075,.29);
   if(f===12){const yellow=material('#e7b849');sphere(g,yellow,0,-.015,.15,.13,.035,.13);for(const side of[-1,1])sphere(g,yellow,side*.08,-.02,.21,.045,.025,.065);}
   if([17,18].includes(f))for(const side of[-1,0,1]){sphere(g,f===18?gold:m,side*.047,-.015,.14,.027,.03,.085);cone(g,white,side*.047,-.01,.225,.018,.06).rotation.x=Math.PI/2;}
   if(f===20){const toe=curve(g,m,[[0,0,.12],[0,.015,.22],[0,.065,.25]],.036);moving.push({node:toe,kind:'toe'});}
   if(f===25)for(const x of[-.061,.061])for(const z of[-.045,.14]){const wh=cylinder(g,trim,x,-.063,z,.028,.021,0);wh.rotation.z=Math.PI/2;}
   if([0,1,7,8,22,24].includes(f))for(let i=0;i<4;i++)curve(g,trim,[[-.039,.038-i*.003,.04+i*.022],[.039,.038-i*.003,.052+i*.022]],.0035);
   if(f===2||f===23){curve(g,trim,[[-.060,.008,.15],[0,.028,.13],[.060,.008,.15]],.004);for(let i=0;i<7;i++)sphere(g,dark,(i-3)*.015,.022,.16+Math.abs(i-3)*.006,.003,.003,.003);if(f===23)rings(g,trim,[[.018,.066,.069,-.035],[.052,.061,.061,-.035]],12);}
   if(f===5){patch(g,trim,0,.045,.10,.13,.016,.038);for(const x of[-.02,.02])curve(g,dark,[[x,.056,.09],[x,.034,.15]],.006);}
   if(f===8)rings(g,m,[[.01,.075,.073,-.03],[.115,.073,.071,-.03]],16);
   if(f===15){for(let i=0;i<3;i++)patch(g,metal,0,.04+i*.055,.074,.13,.045,.025);patch(g,metal,0,.01,.16,.13,.04,.085);}
   if(f===16){rings(g,white,[[.02,.082,.083],[.16,.080,.081],[.22,.070,.070]],16);for(const x of[-.065,.065])patch(g,dark,x,.01,.14,.022,.050,.11);}
   if(f===21){const heel=patch(g,dark,0,-.055,-.035,.11,.09,.09);curve(g,m,[[0,.015,.13],[0,.005,.22]],.040);}
   if(f===22)for(const x of[-.052,.052])for(let i=0;i<5;i++)patch(g,dark,x,-.046,-.015+i*.043,.033,.025,.029);
   if(f===24)for(const side of[-1,1]){const fin=patch(g,metal,side*.064,.04,.05,.017,.065,.12);fin.rotation.z=side*.35;}
  }
 }
}
function animate(rig,actor,t){for(const part of rig.clothMotion||[]){const amount=Math.min(1,Math.abs(actor.speed||0)/6);if(part.kind==='tail')part.node.rotation.y=Math.sin(t*6)*.15*amount;else if(part.kind==='skirt')part.node.rotation.z=Math.sin(t*5)*.025*amount;}}
return{decorate,beard,animate};
});

