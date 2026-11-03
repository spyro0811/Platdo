
/* Original route data, shared by road meshes, traffic, navigation and events.
 * Heights and interval descriptors are metres and normalized route fractions.
 * Coastline retains the original road; other layouts are not transformed copies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DriveMaps=api;})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
 // Route offsets use the unchanged geometric LEFT normal (tz, -tx).
 // Legal right-hand lanes therefore have negative offsets when travelling +s.
 const drivingSide='right';
 function createLanes(offsets,roadId='main'){
  return [1,-1].flatMap(direction=>offsets.filter(offset=>(drivingSide==='right'?-1:1)*Math.sign(offset)===direction).sort((a,b)=>Math.abs(a)-Math.abs(b)).map((offset,index)=>Object.freeze({id:roadId+':'+(direction>0?'forward':'reverse')+':'+index,roadId,offset,direction,index})));
 }
 const maps=[
  {id:'coastline',name:'Coastline Run',theme:'coast',description:'Flowing ocean roads, a waterfront village and a wooded headland.',character:'Flowing bends · 2.6 km circuit',length:2600,width:16,laneOffsets:[2,6,-2,-6],trafficSpeed:1,trafficDensity:1,
   points:[[0,400],[185,395],[365,325],[420,140],[335,-40],[435,-230],[245,-400],[20,-440],[-215,-360],[-300,-190],[-400,0],[-325,210],[-180,365]],height:'original',
   zones:[{name:'COASTAL STRETCH',start:0,end:.35},{name:'WOODLAND BENDS',start:.35,end:.7},{name:'TUNNEL & OUTSKIRTS',start:.7,end:1}],tunnel:{start:.72,end:.77},bridge:{start:.16,end:.20},
   landmarks:[{id:'lighthouse',name:'Beacon Point',s:.125,side:-1},{id:'village',name:'Harbour Village',s:.86,side:1},{id:'overlook',name:'Headland Lookout',s:.47,side:1}],
   connectors:[{id:'harbour-link',name:'Harbour Link',start:.065,end:.86,width:9,bend:.14}],medals:{compact:[104,125,150],vektor:[96,115,139],apex:[95,114,137]}},
  {id:'metro',name:'Metro District',theme:'city',description:'Broad downtown avenues, a canal quarter and an elevated industrial connector.',character:'Precision corners · 4.4 km circuit',length:4400,width:14,laneOffsets:[1.75,5.25,-1.75,-5.25],trafficSpeed:.82,trafficDensity:.85,
   points:[[-420,360],[-160,360],[90,360],[365,360],[455,280],[455,60],[455,-230],[355,-330],[100,-330],[-160,-330],[-300,-270],[-300,-70],[-475,-70],[-475,190]],
   heights:[[0,2],[.36,2],[.43,13],[.55,13],[.63,2],[1,2]],
   zones:[{name:'DOWNTOWN AVENUE',start:0,end:.29},{name:'CANAL QUARTER',start:.29,end:.44},{name:'ELEVATED CONNECTOR',start:.44,end:.64},{name:'INDUSTRIAL EDGE',start:.64,end:.81},{name:'OLD TOWN',start:.81,end:1}],tunnel:{start:.50,end:.54},bridge:{start:.42,end:.61},
   landmarks:[{id:'plaza',name:'Civic Plaza',s:.16,side:1},{id:'canal',name:'Canal Quay',s:.35,side:-1},{id:'warehouse',name:'Foundry Yards',s:.73,side:1}],
   connectors:[{id:'market-street',name:'Market Street',start:.105,end:.725,width:10,bend:0},{id:'canal-street',name:'Canal Street',start:.27,end:.63,width:10,bend:.08}],medals:{compact:[190,228,275],vektor:[188,226,273],apex:[188,226,273]}},
  {id:'pinecrest',name:'Pinecrest Pass',theme:'mountain',description:'A valley road climbs through forest, linked switchbacks and a high rock pass.',character:'Climbs and switchbacks · 4.8 km circuit',length:4800,width:12,laneOffsets:[3,-3],trafficSpeed:.76,trafficDensity:.65,
   points:[[0,470],[270,425],[425,260],[445,40],[260,-45],[330,-190],[135,-250],[205,-390],[-40,-450],[-260,-340],[-430,-140],[-380,115],[-200,340]],
   heights:[[0,8],[.15,10],[.26,35],[.39,74],[.52,109],[.60,120],[.68,92],[.81,44],[.93,14],[1,8]],
   zones:[{name:'VALLEY ROAD',start:0,end:.22},{name:'PINE ASCENT',start:.22,end:.40},{name:'SUMMIT SWITCHBACKS',start:.40,end:.64},{name:'ROCK PASS',start:.64,end:.80},{name:'FOREST DESCENT',start:.80,end:1}],tunnel:{start:.66,end:.71},bridge:{start:.29,end:.325},
   landmarks:[{id:'lodge',name:'Valley Lodge',s:.08,side:1},{id:'overlook',name:'Eagle Lookout',s:.58,side:1},{id:'rockpass',name:'Granite Gate',s:.69,side:1}],
   connectors:[{id:'overlook-road',name:'Lookout Road',start:.54,end:.62,width:8,bend:.26}],medals:{compact:[213,256,309],vektor:[210,252,305],apex:[210,252,305]}},
  {id:'sunridge',name:'Sunridge Expressway',theme:'highway',description:'A wide multi-lane expressway with long curves, raised crossings and a service loop.',character:'Fast sweepers · 6.2 km circuit',length:6200,width:24,laneOffsets:[2,6,10,-2,-6,-10],trafficSpeed:1.4,trafficDensity:1,
   points:[[-110,550],[300,530],[690,370],[805,50],[650,-330],[250,-540],[-230,-490],[-640,-270],[-795,30],[-650,350],[-380,480]],
   heights:[[0,3],[.12,3],[.22,12],[.30,12],[.42,4],[.55,8],[.67,18],[.75,18],[.88,5],[1,3]],
   zones:[{name:'SUNRIDGE STRAIGHT',start:0,end:.22},{name:'EAST INTERCHANGE',start:.22,end:.42},{name:'HIGH DESERT SWEEP',start:.42,end:.64},{name:'RIDGE TUNNEL',start:.64,end:.78},{name:'SERVICE LOOP',start:.78,end:1}],tunnel:{start:.67,end:.73},bridge:{start:.22,end:.30},
   landmarks:[{id:'interchange',name:'East Interchange',s:.25,side:1},{id:'windfarm',name:'Sunridge Fields',s:.52,side:1},{id:'service',name:'Cedar Services',s:.84,side:1}],
   connectors:[{id:'service-road',name:'Cedar Service Road',start:.80,end:.89,width:10,bend:.30}],medals:{compact:[211,254,306],vektor:[174,209,252],apex:[173,208,251]}}
 ];
 for(const m of maps){m.routeId='main';m.drivingSide=drivingSide;m.lanes=createLanes(m.laneOffsets,m.routeId);m.events=['free','rush','trial'];m.barrierOffset=m.width/2+(m.theme==='city'?2.2:m.theme==='mountain'?3:5);}
 const byId=Object.fromEntries(maps.map(m=>[m.id,m]));
 return {drivingSide,createLanes,list:maps,get:id=>byId[id]||byId.coastline,has:id=>Object.prototype.hasOwnProperty.call(byId,id)};
});

