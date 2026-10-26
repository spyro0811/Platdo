
/* Original fictional electric-bike specifications. All dimensions are metres;
 * outer tire radii, not nominal wheel labels, drive contact and wheel speed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CityElectricBikes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const rows=[
 ['tootio_sol_1','Tootio Sol-1','compact-dirt',1.55,1.05,.73,.70,1.06,67,7.2,11.2,.67,8.4,40,195,2900,0x333b3c,0xf07936,.256,.244,.1778,.1524,.083,.105,.13,1.02,84,14,.98,.91,.33,.055],
 ['sir_ron_buzz_x','Sir-Ron Buzz X','open-trail',1.87,1.25,.83,.75,1.19,63,8.8,12.8,.64,9.4,52,205,4900,0x343e40,0x4baca4,.312,.300,.2413,.2286,.075,.090,.19,1.07,76,13,1.09,1.02,.35,.045],
 ['stork_vargle_mx','Stork Vargle MX','full-mx',2.17,1.48,.95,.84,1.37,118,12.5,15.5,.52,9.7,82,285,11400,0xe5e0d4,0xda482f,.350,.338,.2667,.2413,.090,.120,.27,.87,64,12,1.24,1.16,.39,.07],
 ['souper_74_rx','SOUPER 74 RX','fat-cruiser',1.76,1.19,.81,.73,1.13,39,4.7,9.4,.61,8.1,30,180,3400,0x626b4e,0xe8ddc0,.285,.285,.2032,.2032,.120,.130,.085,.72,108,18,1.08,1.01,.34,.025],
 ['r2r_ripster','R2R Ripster','pit-performance',1.61,1.13,.76,.72,1.13,70,9.5,12.2,.69,8.8,50,210,4300,0x44434a,0x8c61bb,.247,.233,.1778,.1524,.080,.105,.165,1.15,88,13,1.04,.97,.34,.055],
 ['razzler','The Razzler','stunt-mini',1.49,1.11,.68,.70,1.02,66,8.9,10.6,.75,8.2,44,225,3900,0x343739,0x79708d,.179,.179,.0762,.0762,.145,.145,.095,1.28,118,18,.97,.91,.32,.06]
];
const definitions=rows.map(r=>{const[id,name,shape,length,wheelbase,seat,width,height,mass,acceleration,braking,steering,traction,mph,health,price,color,accent,frontRadius,rearRadius,frontRim,rearRim,frontWidth,rearWidth,travel,lift,spring,damping,gripY,headY,gripX,motorGain]=r;
 const bicycle=shape==='fat-cruiser',mini=shape==='stunt-mini',mx=shape==='full-mx';
 const seatZ=mini?-.14:bicycle?-.16:mx?-.12:-.15,gripZ=wheelbase*.5-(bicycle?.34:mx?.30:.24),pegY=bicycle?.32:mini?.24:mx?.40:.29,pegZ=bicycle?.015:mini?.055:-.025;
 return{id,name,category:'land',kind:'bike',silhouette:shape,electric:true,dimensions:{width,length,height},mass,acceleration,braking,steering,traction,topSpeed:mph*.44704,health,seatCount:1,price,color,bikeSpec:{shape,accent,wheelbase,seatHeight:seat,frontRadius,rearRadius,frontRim,rearRim,frontWidth,rearWidth,travel,lift,spring,damping,bicycle,mini,chain:!bicycle,motorGain,inertia:mx?1.28:mini?.83:bicycle?1.02:.93,centerOfMass:{x:0,y:mini?.40:bicycle?.51:mx?.60:.48,z:-.06},motorMount:mini||shape==='pit-performance'?'swingarm':'frame',anchors:{seat:{x:0,y:seat,z:seatZ},gripL:{x:-gripX,y:gripY,z:gripZ},gripR:{x:gripX,y:gripY,z:gripZ},footL:{x:-(bicycle?.18:.19),y:pegY,z:pegZ+(bicycle?.12:0)},footR:{x:bicycle?.18:.19,y:pegY,z:pegZ-(bicycle?.12:0)},standing:{x:0,y:seat+(mx?.24:.17),z:seatZ+.09},camera:{x:0,y:seat+.73,z:seatZ+.12},steering:{x:0,y:headY,z:wheelbase*.5-.155},crank:{x:0,y:pegY,z:pegZ}},frontBrakeShare:bicycle?.65:.73,description:bicycle?'Fat-tire city cruiser · pedals + rear hub motor':mini?'Low bench · broad tires · stunt torque':mx?'Full-size motocross · long-travel suspension':shape==='open-trail'?'Light trail frame · tall wheels':shape==='pit-performance'?'Performance pit bike · compact punch':'Compact dirt bike · forgiving balance'}};});
return{definitions,ids:definitions.map(d=>d.id)};
});

