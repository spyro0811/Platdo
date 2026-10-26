
/* PLATDO DRIVE: deterministic, renderer-independent simulation. World units are meters.
 * UMD export DriveCore (also require('./core.js')). getConfig(save) resolves car + upgrades.
 * new Route(): samples, length, width, halfWidth, barrierOffset; at(s), nearest(x,z,hint).
 * new Simulation(route, config, {mode:'free'|'rush'|'trial',density:'low'|'medium'|'high'}).
 * step(seconds,{throttle,brake,steer,handbrake}) subdivides at 120 Hz; callers pause by not stepping.
 * player / traffic are render state. events is bounded and can be drained with splice(0).
 * recovery() preserves damage; finish() returns one immutable result. settleResult(save,result)
 * grants that result once. settleFreeDriveCredits(save,sim) banks 50 CR per eligible 100m.
 * All save helpers mutate only their explicit save argument; no storage.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DriveCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const wrap = (v, range) => ((v % range) + range) % range;
  const shortest = (d, range) => wrap(d + range / 2, range) - range / 2;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const MapCatalog = typeof DriveMaps !== 'undefined' ? DriveMaps : typeof require === 'function' ? require('./maps.js') : null;
  const DEFAULT_MAP = {id:'coastline',name:'Coastline Run',theme:'coast',length:2600,width:16,barrierOffset:13,laneOffsets:[2,6,-2,-6],height:'original',points:[[0,400],[185,395],[365,325],[420,140],[335,-40],[435,-230],[245,-400],[20,-440],[-215,-360],[-300,-190],[-400,0],[-325,210],[-180,365]],zones:[{name:'COASTAL STRETCH',start:0,end:.35},{name:'WOODLAND BENDS',start:.35,end:.7},{name:'TUNNEL & OUTSKIRTS',start:.7,end:1}]};
  const MAPS = MapCatalog ? MapCatalog.list : [DEFAULT_MAP];
  // One directed lane model drives spawns, AI, recovery, signage and rewards.
  // The geometry's normal remains LEFT; never mirror the scenery to change traffic.
  const createLanes=MapCatalog?.createLanes||((offsets,roadId='main')=>[1,-1].flatMap(direction=>offsets.filter(offset=>-Math.sign(offset)===direction).sort((a,b)=>Math.abs(a)-Math.abs(b)).map((offset,index)=>({id:roadId+':'+(direction>0?'forward':'reverse')+':'+index,roadId,offset,direction,index}))));
  const routeLanes=route=>route.lanes||createLanes(route.laneOffsets||[-2,-6,2,6]);
  const RULES_VERSION = 'drive4';
  // Metres/seconds. Normal contact speed, not dashboard speed or accumulated damage.
  const RAIL_TUNING=Object.freeze({span:4,breakSpeed:8.5,resistance:.22,debrisLimit:192,debrisLife:24,launchMin:2.8,launchMax:8,ccdStep:.32});
  const SCENERY_TUNING=Object.freeze({cellSize:32,debrisLimit:192,debrisLife:24,contactEpsilon:1e-7,separation:.002,maxContacts:20});
  const SCENERY_KINDS=Object.freeze({building:{breakable:false,resistance:1},fixed:{breakable:false,resistance:1},rock:{breakable:true,resistance:1.15},tree:{breakable:true,resistance:.9},bush:{breakable:true,resistance:.25},prop:{breakable:true,resistance:.55}});
  const BREAKAWAY_PARTS = [
    {id:'front-bumper',threshold:.30},{id:'rear-bumper',threshold:.30},
    {id:'left-mirror',threshold:.23},{id:'right-mirror',threshold:.23},
    {id:'left-sill',threshold:.47},{id:'right-sill',threshold:.47},
    {id:'front-left-wheel',threshold:.82},{id:'front-right-wheel',threshold:.82},
    {id:'rear-left-wheel',threshold:.82},{id:'rear-right-wheel',threshold:.82}
  ];
  // Stable IDs are save identities. Object insertion order is the garage progression.
  // P1 matches the frozen pre-update stock Vektor drivetrain, speed, grip and brakes.
  const vehicle = (id,name,description,price,color,accel,maxSpeed,brake,grip,steerRate,width,length,height,wheelbase,wheelRadius,mass,rearBias) => ({id,name,description,price,color,accel,maxSpeed,brake,grip,steerRate,width,length,height,wheelbase,wheelRadius,mass,rearBias,ratings:{acceleration:accel,speed:maxSpeed/10,handling:grip,braking:brake/2}});
  const CARS = {
    compact:vehicle('compact','P1 COMPACT','A nimble hatch with GT pace and forgiving grip. Your first great drive.',0,'#e6e1d5',7.5,58,15.2,11.8,9.2,1.78,4.12,1.48,2.52,.35,1120,.1),
    nova:vehicle('nova','NOVA S','A clean fastback: eager acceleration, crisp turn-in and everyday composure.',600,'#79a9b9',8,61,15.8,12.1,9.4,1.82,4.28,1.43,2.59,.35,1220,.16),
    vektor:vehicle('vektor','VEKTOR GT','A balanced grand-touring coupe with effortless pace and sharp responses.',1200,'#b44d32',8.6,64,16.4,12.4,9.6,1.88,4.52,1.34,2.65,.35,1330,.25),
    corsa:vehicle('corsa','CORSA 200','A compact mid-engine wedge. Light, precise and beautifully direct.',1650,'#e3bc4d',9.1,67,17,12.8,9.8,1.87,4.38,1.30,2.62,.345,1205,.28),
    rally:vehicle('rally','RALLY RS','Wide arches, a tall cabin and surefooted traction on demanding roads.',2100,'#4269b8',9.8,70,17.7,13.3,10,1.91,4.36,1.47,2.58,.36,1370,.12),
    apex:vehicle('apex','APEX R','A broad-shouldered rear-drive coupe. Strong power with room to slide.',2600,'#31565e',10.6,74,18.3,13.5,10.2,1.96,4.68,1.32,2.72,.36,1410,.48),
    muscle:vehicle('muscle','MAMMOTH V8','A long hood and deep torque, with brakes to match its presence.',3350,'#a33e32',11.7,78,19,13.7,10.4,2,4.90,1.39,2.88,.37,1640,.44),
    roadster:vehicle('roadster','SOLAR ROADSTER','A low open cockpit and short wheelbase make every corner vivid.',4150,'#e0d8c1',12.8,82,20,14.3,10.7,1.90,4.37,1.22,2.57,.35,1190,.31),
    touring:vehicle('touring','ATLAS GTR','A sweeping four-seat grand tourer with long legs and serious brakes.',5000,'#4c6377',14,87,21,14.7,10.9,1.96,4.90,1.34,2.91,.37,1570,.30),
    zenith:vehicle('zenith','ZENITH S10','The tenth-car milestone: a low mid-engine super sports car with formidable pace.',6200,'#ee7b36',15.7,94,22,15.4,11.3,2.02,4.70,1.17,2.76,.37,1390,.34),
    volt:vehicle('volt','VOLT XR','A sculpted electric performance coupe with immediate, relentless acceleration.',7600,'#8ab9b3',17,100,23,15.9,11.6,1.99,4.82,1.30,2.89,.37,1790,.22),
    stratos:vehicle('stratos','STRATOS LM','A compact endurance special: deep aero channels and remarkable precision.',9200,'#cbdd63',18.6,107,24,16.4,12,2.06,4.64,1.13,2.79,.37,1285,.37),
    hyperion:vehicle('hyperion','HYPERION X','The collection flagship. A dramatic long-tail body and immense capability.',11000,'#8b79b7',20.4,114,25,17,12.3,2.10,4.84,1.10,2.85,.38,1440,.4)
  };
  const PART_CATEGORIES = Object.freeze(['spoilers','wheels','engines','transmissions','brakes']);
  const part=(id,name,description,price,modifiers,design,style,color='#d0d4d8',accent='#c46040')=>({id,name,description,price,modifiers,visual:{design,style,color,accent}});
  const PARTS = {
    spoilers:[
      part('ducktail','Ducktail','A curved, integrated kick-up; a light aero speed gain.',160,{speed:1.025,drag:.98},0,'ducktail'),
      part('lip','Touring Lip','A discreet rear edge with low drag.',210,{speed:1.032,drag:.975},1,'lip'),
      part('twin-post','Twin Post','A raised blade on two narrow supports.',280,{speed:1.04,drag:.97},2,'twin-post'),
      part('gt-wing','GT Wing','A deep motorsport wing with pronounced endplates.',360,{speed:1.048,drag:.965},3,'gt-wing'),
      part('swan-neck','Swan Neck','Top-mounted supports leave the lower blade clean.',450,{speed:1.057,drag:.96},4,'swan-neck'),
      part('split-wing','Split Wing','Twin aero blades around an open center.',540,{speed:1.064,drag:.955},5,'split-wing'),
      part('roof-wing','High Arch','An elevated curved blade with broad supports.',630,{speed:1.072,drag:.95},6,'roof-wing'),
      part('active-blade','Active Blade','A swept low-profile performance blade.',730,{speed:1.081,drag:.945},7,'active-blade'),
      part('double-deck','Double Deck','Two stacked blades with linked endplates.',850,{speed:1.09,drag:.94},8,'double-deck'),
      part('endurance','Endurance Aero','A wide competition blade with split endplates.',990,{speed:1.10,drag:.93},9,'endurance')
    ],
    wheels:[
      part('five-spoke','Sport Five','Five broad spokes; more grip and quicker response.',180,{grip:1.04,steering:1.04},0,'five-spoke','#c6cdd4'),
      part('turbine','Turbine','Directional turbine spokes with a bright machined face.',230,{grip:1.065,steering:1.055},1,'turbine','#a6b7c5'),
      part('mesh','Classic Mesh','Dense cross-spokes and a polished deep rim.',300,{grip:1.09,steering:1.07},2,'mesh','#c6aa70'),
      part('split-six','Split Six','Twelve slim arms from six sculpted roots.',380,{grip:1.115,steering:1.085},3,'split-six','#7f8995'),
      part('disc','Retro Disc','A nearly closed wheel with circular cooling ports.',470,{grip:1.14,steering:1.10},4,'disc','#c7cbd0'),
      part('rally','Rally White','Strong rally spokes and a tough rim.',560,{grip:1.17,steering:1.12},5,'rally','#ecece4'),
      part('split-ten','Split Ten','Fine split spokes with a dark contrast barrel.',670,{grip:1.195,steering:1.14},6,'split-ten','#a7a9ae'),
      part('forged-seven','Forged Seven','Seven concave forged spokes in bronze.',790,{grip:1.22,steering:1.16},7,'forged-seven','#ae895c'),
      part('aero','Aero Carbon','Carbon-faced aero spokes with exposed outer channels.',920,{grip:1.245,steering:1.18},8,'aero','#3d434c'),
      part('centerlock','Centerlock Pro','Light competition spokes and a single center nut.',1080,{grip:1.28,steering:1.21},9,'centerlock','#d2d9df')
    ],
    engines:[
      part('sport-intake','Sport Intake','A freer-breathing engine with extra speed and useful torque.',220,{speed:1.04,accel:1.04},0,'intake'),
      part('cam-pack','Cam Pack','Revised valve timing extends the useful power range.',300,{speed:1.06,accel:1.065},1,'cam'),
      part('high-flow','High Flow','Intake, exhaust and calibration work together.',390,{speed:1.08,accel:1.09},2,'high-flow'),
      part('balanced-six','Balanced Six','A smooth, responsive fast-road power unit.',490,{speed:1.105,accel:1.12},3,'six'),
      part('sport-turbo','Sport Turbo','A compact turbo adds strong high-speed performance.',610,{speed:1.13,accel:1.15},4,'turbo'),
      part('twin-scroll','Twin Scroll','Broad torque and improved breathing at speed.',740,{speed:1.155,accel:1.18},5,'twin-scroll'),
      part('supercharged','Supercharged','A positive-pressure package with a strong pull.',890,{speed:1.18,accel:1.21},6,'supercharged'),
      part('race-built','Race Built','A strengthened competition power unit.',1060,{speed:1.21,accel:1.25},7,'race'),
      part('twin-turbo','Twin Turbo','Two compact turbos deliver serious high-speed power.',1250,{speed:1.24,accel:1.29},8,'twin-turbo'),
      part('works-power','Works Power','The complete works package, calibrated for maximum pace.',1470,{speed:1.28,accel:1.34},9,'works')
    ],
    transmissions:[
      part('sport-five','Sport Five','Shorter launch ratios and cleaner shifts.',170,{accel:1.035,shift: .95},0,'five'),
      part('close-six','Close Six','Closer ratios keep the engine pulling.',230,{accel:1.055,shift:.90},1,'six'),
      part('touring-six','Touring Six','A smooth fast-road gearset with stronger pickup.',300,{accel:1.075,shift:.85},2,'touring'),
      part('rally-box','Rally Box','Tight ratios for decisive acceleration.',380,{accel:1.095,shift:.80},3,'rally'),
      part('sport-seven','Sport Seven','A broad seven-speed performance calibration.',470,{accel:1.12,shift:.75},4,'seven'),
      part('quickshift','Quickshift','Faster shifts and improved torque delivery.',570,{accel:1.145,shift:.70},5,'quickshift'),
      part('dual-clutch','Dual Clutch','Preselected ratios reduce the interruption in power.',690,{accel:1.17,shift:.62},6,'dual-clutch'),
      part('sequential','Sequential','A competition box with short, direct shifts.',820,{accel:1.20,shift:.55},7,'sequential'),
      part('track-eight','Track Eight','A close competition calibration across the speed range.',970,{accel:1.23,shift:.48},8,'eight'),
      part('works-box','Works Box','The quickest launch and least interruption between ratios.',1140,{accel:1.27,shift:.40},9,'works')
    ],
    brakes:[
      part('sport-pads','Sport Pads','Higher-friction pads improve stopping force.',140,{brake:1.045},0,'pads'),
      part('vented','Vented','Vented rotors and matched pads.',190,{brake:1.075},1,'vented'),
      part('slotted','Slotted','Slotted rotors for consistent hard braking.',250,{brake:1.105},2,'slotted'),
      part('four-piston','Four Piston','More clamping force with predictable modulation.',320,{brake:1.14},3,'four'),
      part('big-disc','Big Disc','Larger rotors increase braking leverage.',400,{brake:1.175},4,'big'),
      part('six-piston','Six Piston','A powerful, balanced performance brake kit.',490,{brake:1.21},5,'six'),
      part('two-piece','Two Piece','Light floating rotors and stronger calipers.',600,{brake:1.25},6,'floating'),
      part('ceramic','Ceramic','High-performance ceramic friction surfaces.',720,{brake:1.29},7,'ceramic'),
      part('endurance-brake','Endurance','Competition rotors for forceful, stable stops.',860,{brake:1.33},8,'endurance'),
      part('carbon-race','Carbon Race','The strongest complete braking package.',1020,{brake:1.38},9,'carbon')
    ]
  };
  const PAINT_LIMIT=1400;
  const blankCustomization=(baseColor=null)=>({equipped:Object.fromEntries(PART_CATEGORIES.map(k=>[k,null])),ownedParts:Object.fromEntries(PART_CATEGORIES.map(k=>[k,[]])),baseColor,strokes:[]});
  const PAINTS = [
    { id: 'chalk', name: 'Chalk', color: '#e6e1d5' }, { id: 'ember', name: 'Ember', color: '#b44d32' },
    { id: 'tide', name: 'Tide', color: '#315f77' }, { id: 'pine', name: 'Pine', color: '#375c48' },
    { id: 'graphite', name: 'Graphite', color: '#353b42' }, { id: 'sunflower', name: 'Sunflower', color: '#d2a638' }
  ];
  const DEFAULT_BINDINGS = { throttle: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD', handbrake: 'Space', camera: 'KeyC', recover: 'KeyR', horn: 'KeyH', headlights:'KeyE', map:'KeyM', pause: 'KeyP' };
  const MEDAL_THRESHOLDS = { gold: 85, silver: 105, bronze: 140 };
  const UPGRADE_PRICES = { engine: [300, 500, 800], tires: [250, 450, 700], brakes: [200, 350, 550] };
  function createDefaultSave() {
    return { version: 2, credits: 0, owned: ['compact'], selected: 'compact', selectedMap:'coastline', lastMode:'free', firstPlayDone: false,
      upgrades: Object.fromEntries(Object.keys(CARS).map(id=>[id,{engine:0,tires:0,brakes:0}])),
      paints: Object.fromEntries(Object.keys(CARS).map(id=>[id,id==='vektor'?'ember':id==='apex'?'tide':'chalk'])), customization:Object.fromEntries(Object.keys(CARS).map(id=>[id,blankCustomization(['compact','vektor','apex'].includes(id)?null:CARS[id].color)])), bestRush: 0, bestTimes: {}, records:{trial:{},rush:{}}, settledRuns: [], navigation:{},smoke:{},ownedSmoke:['white'],
      settings: { licensePlate:'PLATDO', units: 'mph', tips: true, graphics: 'medium', resolution: 1, fov: 68, reducedMotion: false, showFPS: false, damageMode:'standard',trafficDensity:'medium',trafficCount:null,chaseDistance:6.2,chaseHeight:3.05,cameraShake:.35,speedFov:true,headlights:1, master: .8, effects: .8,engine:.8,tires:.8,impacts:.8,environment:.8, music: .35, mute: false, autosave: 3 },
      bindings: { ...DEFAULT_BINDINGS } };
  }
  function validateSave(data, strict = false) {
    strict = typeof strict === 'object' ? !!strict.strict : !!strict;
    const save = createDefaultSave();
    const fail = label => { if (strict) throw new Error('Invalid save: ' + label); };
    if (!plain(data)) { fail('expected a save object'); return save; }
    if (strict && ['version', 'credits', 'owned', 'selected'].some(key => !own(data, key))) fail('missing version or vehicle progress');
    if (data.version !== undefined && ![0,1,2].includes(data.version)) { fail('unsupported version'); return save; }
    const value = (source, key, valid, fallback) => {
      if (!own(source, key)) return fallback;
      if (valid(source[key])) return source[key];
      fail(key); return fallback;
    };
    save.credits = value(data, 'credits', v => Number.isInteger(v) && Number.isFinite(v) && v >= 0, 0);
    save.ownedSmoke=Array.isArray(data.ownedSmoke)?[...new Set(['white',...data.ownedSmoke.filter(id=>SMOKE_COLORS.some(c=>c.id===id))])]:['white'];
    if(plain(data.smoke))for(const [id,color]of Object.entries(data.smoke))if(own(CARS,id)&&save.ownedSmoke.includes(color))save.smoke[id]=color;
    save.firstPlayDone = value(data, 'firstPlayDone', v => typeof v === 'boolean', false);
    if (own(data, 'owned')) {
      if (!Array.isArray(data.owned) || !data.owned.length || data.owned.some(id => !own(CARS, id)) || !data.owned.includes('compact')) fail('owned vehicles');
      else save.owned = [...new Set(data.owned)];
    }
    save.selected = value(data, 'selected', v => own(CARS, v) && save.owned.includes(v), 'compact');
    save.selectedMap = value(data,'selectedMap',v=>MAPS.some(m=>m.id===v),'coastline');
    save.lastMode = value(data,'lastMode',v=>['free','rush','trial'].includes(v),'free');
    for (const id of Object.keys(CARS)) {
      if (own(data, 'upgrades') && !plain(data.upgrades)) fail('upgrades');
      const upgrade = plain(data.upgrades) && own(data.upgrades, id) ? data.upgrades[id] : {};
      if (!plain(upgrade)) fail('vehicle upgrades');
      else for (const kind of Object.keys(UPGRADE_PRICES)) save.upgrades[id][kind] = value(upgrade, kind, v => Number.isInteger(v) && v >= 0 && v <= 3, 0);
      if (own(data, 'paints') && !plain(data.paints)) fail('paints');
      if (plain(data.paints)) save.paints[id] = value(data.paints, id, v => PAINTS.some(p => p.id === v), save.paints[id]);
      // New fields are optional on old saves. Paid legacy levels are retained and
      // are the stock fallback whenever a replacement part is not selected.
      if(own(data,'customization')&&!plain(data.customization))fail('customization');
      if(plain(data.customization)&&own(data.customization,id)){
        const src=data.customization[id],dest=save.customization[id];
        if(!plain(src)){fail('vehicle customization');continue;}
        if(own(src,'baseColor')){if(src.baseColor===null||validColor(src.baseColor))dest.baseColor=src.baseColor;else fail('paint color');}
        for(const category of PART_CATEGORIES){
          if(own(src,'ownedParts')&&!plain(src.ownedParts))fail('owned parts');
          const ids=src.ownedParts?.[category];
          if(ids!==undefined){if(!Array.isArray(ids)||ids.length>10||ids.some(partId=>!findPart(category,partId)))fail('owned '+category);else dest.ownedParts[category]=[...new Set(ids)];}
          if(own(src,'equipped')&&!plain(src.equipped))fail('equipped parts');
          const selected=src.equipped?.[category];
          if(selected!==undefined&&selected!==null){if(!findPart(category,selected)||!dest.ownedParts[category].includes(selected))fail('equipped '+category);else dest.equipped[category]=selected;}
        }
        if(own(src,'strokes')){if(!Array.isArray(src.strokes)||src.strokes.length>PAINT_LIMIT)fail('paint strokes');if(Array.isArray(src.strokes))for(const dot of src.strokes.slice(0,PAINT_LIMIT)){if(!validPaintDot(dot)){fail('paint dot');continue;}dest.strokes.push(copyPaintDot(dot));}}
      }
    }
    save.bestRush = value(data, 'bestRush', v => Number.isInteger(v) && v >= 0 && v <= 1e9, 0);
    if (own(data, 'bestTimes')) {
      if (!plain(data.bestTimes)) fail('best times');
      else for (const [key, time] of Object.entries(data.bestTimes)) {
        if (!validConfigKey(key) || !finite(time) || time < 1 || time > 86400) { fail('best time'); continue; }
        save.bestTimes[key] = time;
      }
    }
    if (own(data, 'settledRuns')) {
      if (!Array.isArray(data.settledRuns) || data.settledRuns.some(v => typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(v))) fail('settled runs');
      else save.settledRuns = [...new Set(data.settledRuns)];
    }
    if(own(data,'records')){if(!plain(data.records))fail('records');else for(const mode of ['trial','rush']){if(!own(data.records,mode))continue;if(!plain(data.records[mode])){fail('record table');continue;}for(const [key,n]of Object.entries(data.records[mode])){if(!validRecordKey(key)||!finite(n)||n<0||n>(mode==='trial'?86400:1e9)){fail('record');continue;}save.records[mode][key]=n;}}}
    const enums = { units: ['kmh', 'mph'], graphics: ['potato', 'low', 'medium', 'high', 'epic', 'ultra', 'insane'],damageMode:['standard','cosmetic'],trafficDensity:['low','medium','high'] };
    const ranges = { resolution: [.5, 1.5], fov: [1, 1000000000],headlights:[0,2],chaseDistance:[2.5,18],chaseHeight:[1.5,5],cameraShake:[0,1], master: [0, 1], effects: [0, 1],engine:[0,1],tires:[0,1],impacts:[0,1],environment:[0,1], music: [0, 1], autosave: [1, 10] };
    if (own(data, 'settings')) {
      if (!plain(data.settings)) fail('settings');
      else for (const key of Object.keys(save.settings)) {
        const good = key==='trafficCount' ? v=>v===null||Number.isInteger(v)&&v>=0&&v<=500 : key==='licensePlate' ? v=>typeof v==='string'&&/^[A-Z0-9 -]{1,8}$/.test(v) : enums[key] ? v => enums[key].includes(v) : ranges[key] ? v => finite(v) && v >= ranges[key][0] && v <= ranges[key][1] && (key !== 'autosave' || Number.isInteger(v)) : v => typeof v === 'boolean';
        save.settings[key] = value(data.settings, key, good, save.settings[key]);
      }
      if(plain(data.settings))for(const key of ['engine','tires','impacts','environment'])if(!own(data.settings,key)&&finite(data.settings.effects))save.settings[key]=clamp(data.settings.effects,0,1);
    }
    if(plain(data.navigation))for(const [id,n]of Object.entries(data.navigation)){if(!MAPS.some(m=>m.id===id)||!plain(n))continue;const clean={};for(const k of ['waypoint','recoveryPoint'])if(plain(n[k])&&finite(n[k].x)&&finite(n[k].z)){clean[k]={x:n[k].x,z:n[k].z,label:String(n[k].label||'Destination').slice(0,80)};}save.navigation[id]=clean;}
    if (own(data, 'bindings')) {
      if (!plain(data.bindings)) fail('controls');
      else {
        const used = new Set();
        for (const action of Object.keys(DEFAULT_BINDINGS)) {
          const code = value(data.bindings, action, v => typeof v === 'string' && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|Tab|Enter|Backspace|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash|Backslash|Minus|Equal|Backquote)$/.test(v), !own(data.bindings,action)&&Object.values(data.bindings).includes(DEFAULT_BINDINGS[action])?['KeyN','KeyB','KeyV','KeyG','KeyL','KeyJ'].find(k=>!Object.values(data.bindings).includes(k)&&!Object.values(DEFAULT_BINDINGS).includes(k))||DEFAULT_BINDINGS[action]:DEFAULT_BINDINGS[action]);
          if (used.has(code)) { fail('duplicate controls'); save.bindings = { ...DEFAULT_BINDINGS }; break; }
          used.add(code); save.bindings[action] = code;
        }
      }
    }
    return save;
  }
  function purchaseCar(save, id) {
    if (!own(CARS, id)) return { ok: false, reason: 'Unknown vehicle.' };
    if (save.owned.includes(id)) return { ok: false, reason: 'Already owned.' };
    const price = CARS[id].price;
    if (!Number.isInteger(save.credits) || save.credits < price) return { ok: false, reason: 'Not enough credits.' };
    save.credits -= price; save.owned.push(id); save.selected = id;
    return { ok: true, price, id };
  }
  function buyUpgrade(save, kind, id = save.selected) {
    if (!own(CARS, id) || !save.owned.includes(id) || !own(UPGRADE_PRICES, kind)) return { ok: false, reason: 'Upgrade unavailable.' };
    const level = save.upgrades[id][kind];
    if (level >= 3) return { ok: false, reason: 'Fully upgraded.' };
    const price = UPGRADE_PRICES[kind][level];
    if (!Number.isInteger(save.credits) || save.credits < price) return { ok: false, reason: 'Not enough credits.' };
    save.credits -= price; save.upgrades[id][kind]++;
    return { ok: true, price, level: level + 1 };
  }
  const validColor=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
  const findPart=(category,id)=>PARTS[category]?.find(p=>p.id===id)||null;
  const validPaintDot=dot=>plain(dot)&&typeof dot.surface==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(dot.surface)&&finite(dot.u)&&dot.u>=0&&dot.u<=1&&finite(dot.v)&&dot.v>=0&&dot.v<=1&&finite(dot.r)&&dot.r>=.005&&dot.r<=.12&&validColor(dot.color)&&(dot.stroke===undefined||Number.isInteger(dot.stroke)&&dot.stroke>=0&&dot.stroke<=1e9);
  const copyPaintDot=dot=>({surface:dot.surface,u:dot.u,v:dot.v,r:dot.r,color:dot.color.toLowerCase(),stroke:dot.stroke||0});
  function customizationFor(save,id){if(!save.customization)save.customization={};if(!save.customization[id])save.customization[id]=blankCustomization();return save.customization[id];}
  function equipPart(save,category,partId,id=save.selected){
    if(!own(CARS,id)||!save.owned.includes(id)||!PART_CATEGORIES.includes(category))return{ok:false,reason:'Part unavailable.'};
    const custom=customizationFor(save,id);
    if(partId!==null&&(!findPart(category,partId)||!custom.ownedParts[category].includes(partId)))return{ok:false,reason:'Buy this part before equipping it.'};
    custom.equipped[category]=partId;return{ok:true,id:partId,carId:id,category};
  }
  function purchasePart(save,category,partId,id=save.selected){
    if(!own(CARS,id)||!save.owned.includes(id)||!PART_CATEGORIES.includes(category))return{ok:false,reason:'Own this car before customizing it.'};
    const item=findPart(category,partId);if(!item)return{ok:false,reason:'Unknown part.'};
    const custom=customizationFor(save,id);if(custom.ownedParts[category].includes(partId))return equipPart(save,category,partId,id);
    if(!Number.isInteger(save.credits)||save.credits<item.price)return{ok:false,reason:'Not enough credits.'};
    save.credits-=item.price;custom.ownedParts[category].push(partId);custom.equipped[category]=partId;return{ok:true,id:partId,carId:id,category,price:item.price};
  }
  function setPaintColor(save,color,id=save.selected){
    if(!own(CARS,id)||!save.owned.includes(id))return{ok:false,reason:'Own this car before painting it.'};
    const preset=PAINTS.find(p=>p.id===color),resolved=preset?.color||color;if(!validColor(resolved))return{ok:false,reason:'Choose a valid paint color.'};
    customizationFor(save,id).baseColor=resolved.toLowerCase();if(preset)save.paints[id]=preset.id;return{ok:true};
  }
  function addPaintStroke(save,dots,id=save.selected){
    if(!own(CARS,id)||!save.owned.includes(id))return{ok:false,reason:'Own this car before painting it.'};
    const list=Array.isArray(dots)?dots:[dots],custom=customizationFor(save,id);
    if(!list.length||list.some(dot=>!validPaintDot(dot)))return{ok:false,reason:'Invalid paint stroke.'};
    if(custom.strokes.length+list.length>PAINT_LIMIT)return{ok:false,reason:'Paint is full. Undo or clear some markings first.'};
    const group=Math.min(1e9,(custom.strokes.reduce((n,d)=>Math.max(n,d.stroke||0),0)+1));
    for(const dot of list)custom.strokes.push({...copyPaintDot(dot),stroke:dot.stroke===undefined?group:dot.stroke});
    return{ok:true,count:list.length};
  }
  function undoPaint(save,id=save.selected){if(!own(CARS,id)||!save.owned.includes(id))return{ok:false};const custom=customizationFor(save,id);if(!custom.strokes.length)return{ok:false,reason:'Nothing to undo.'};const group=custom.strokes[custom.strokes.length-1].stroke;let count=0;while(custom.strokes.length&&custom.strokes[custom.strokes.length-1].stroke===group){custom.strokes.pop();count++;}return{ok:true,count};}
  function clearPaint(save,id=save.selected){if(!own(CARS,id)||!save.owned.includes(id))return{ok:false};customizationFor(save,id).strokes=[];return{ok:true};}
  function getConfig(saveOrId = 'compact', upgrades) {
    const id = typeof saveOrId === 'string' ? saveOrId : saveOrId.selected;
    const base = CARS[id] || CARS.compact;
    const u = upgrades || (plain(saveOrId) && saveOrId.upgrades?.[base.id]) || { engine: 0, tires: 0, brakes: 0 };
    const e = clamp(u.engine || 0, 0, 3), t = clamp(u.tires || 0, 0, 3), b = clamp(u.brakes || 0, 0, 3);
    const custom=plain(saveOrId)&&saveOrId.customization?.[base.id]||blankCustomization(),parts={},equipped={};
    for(const category of PART_CATEGORIES){parts[category]=findPart(category,custom.equipped?.[category]);equipped[category]=parts[category]?.id||null;}
    const engine=parts.engines?.modifiers||{accel:1+e*.095,speed:1+e*.045},wheels=parts.wheels?.modifiers||{grip:1+t*.075,steering:1},brakes=parts.brakes?.modifiers||{brake:1+b*.12},spoiler=parts.spoilers?.modifiers||{speed:1,drag:1},transmission=parts.transmissions?.modifiers||{accel:1,shift:1};
    const configKey = `${base.id}-e${parts.engines?0:e}-t${parts.wheels?0:t}-b${parts.brakes?0:b}`+(PART_CATEGORIES.some(k=>equipped[k])?'~'+PART_CATEGORIES.map(k=>equipped[k]||'stock').join('.'):'');
    const redline=base.id==='compact'?7200:7200+Object.keys(CARS).indexOf(base.id)*85,gearRatios=[3.48,2.18,1.52,1.18,.96,.80],maxSpeed=base.maxSpeed*engine.speed*spoiler.speed;
    // At higher effective speeds the final drive is lengthened, so upgraded cars
    // do not sit at the rev limiter. Acceleration gain is the transmission's real
    // force multiplier, while shift duration remains part of the same drivetrain.
    const finalDrive=Math.min(3.48,redline*.94*TAU*base.wheelRadius/(maxSpeed*60*gearRatios[gearRatios.length-1]));
    const preset=plain(saveOrId)&&PAINTS.find(p=>p.id===saveOrId.paints?.[base.id]);
    const paintColor=custom.baseColor||preset?.color||base.color,paint={baseColor:paintColor,strokes:(custom.strokes||[]).map(copyPaintDot)};
    return {...base,gearRatios,finalDrive,idleRPM:900,redlineRPM:redline,shiftRPM:redline*(6450/7200),shiftDuration:.16*transmission.shift,ratings:{...base.ratings},accel:base.accel*engine.accel*transmission.accel,maxSpeed,grip:base.grip*wheels.grip,steerRate:base.steerRate*wheels.steering,steeringMultiplier:wheels.steering,brake:base.brake*brakes.brake,dragCoefficient:.0013*spoiler.drag,upgrades:{engine:e,tires:t,brakes:b},parts,equipped,paint,paintColor,smokeColor:plain(saveOrId)?saveOrId.smoke?.[base.id]||'white':'white',dimensions:{width:base.width,length:base.length,height:base.height,wheelbase:base.wheelbase,wheelRadius:base.wheelRadius},key:configKey,configKey};
  }
  function validConfigKey(key){if(typeof key!=='string'||key.length>240)return false;const [legacy,equipment,...extra]=key.split('~'),match=/^([a-z]+)-e[0-3]-t[0-3]-b[0-3]$/.exec(legacy);if(extra.length||!match||!own(CARS,match[1]))return false;if(equipment===undefined)return true;const ids=equipment.split('.');return ids.length===5&&ids.every((id,i)=>id==='stock'||!!findPart(PART_CATEGORIES[i],id));}
  function validRecordKey(key){if(typeof key!=='string')return false;const p=key.split(':');return p.length===6&&/^drive[234]$/.test(p[0])&&MAPS.some(m=>m.id===p[1])&&p[2]==='main'&&validConfigKey(p[3])&&['standard','cosmetic'].includes(p[4])&&['low','medium','high'].includes(p[5]);}
  function recordKey(routeOrMap,config,damageMode='standard',density='medium'){const id=typeof routeOrMap==='string'?routeOrMap:routeOrMap.mapId||routeOrMap.map?.id||'coastline',key=typeof config==='string'?config:config.configKey||config.key;return `${RULES_VERSION}:${id}:main:${key}:${damageMode==='cosmetic'?'cosmetic':'standard'}:${['low','medium','high'].includes(density)?density:'medium'}`;}
  function bestRecord(save,mode,route,config,damageMode='standard',density='medium'){return save.records?.[mode]?.[recordKey(route,config,damageMode,mode==='trial'?'medium':density)]||null;}
  function catmull(a, b, c, d, t) {
    const t2 = t * t, t3 = t2 * t;
    return .5 * ((2 * b) + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }
  function sceneryDescriptor(source){
    if(!plain(source)||typeof source.id!=='string'||!/^[\w:./|,-]{1,180}$/.test(source.id)||!own(SCENERY_KINDS,source.kind))throw new Error('Invalid scenery identity or kind');
    const shape=s=>{const out={x:s.x,y:s.y??0,z:s.z,yaw:s.yaw??0,width:s.width,length:s.length,height:s.height};if(Object.values(out).some(v=>!finite(v))||out.width<=0||out.length<=0||out.height<=0||Math.max(out.width,out.length,out.height)>4096)throw new Error('Invalid scenery collider: '+source.id);return out;};
    const base=shape(source),colliders=(source.colliders===undefined?[base]:source.colliders);
    if(!Array.isArray(colliders)||!colliders.length||colliders.length>128)throw new Error('Invalid compound scenery: '+source.id);
    // Exact duplicate child shapes carry no extra mass. Cap the remaining sum
    // by the physical collider envelope, never by a tree's visual crown bounds.
    const seen=new Set(),normalized=colliders.map(shape).filter(c=>{const key=JSON.stringify(c);if(seen.has(key))return false;seen.add(key);return true;}),bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};let volume=0;
    for(const c of normalized){const rx=Math.abs(Math.cos(c.yaw))*c.width/2+Math.abs(Math.sin(c.yaw))*c.length/2,rz=Math.abs(Math.sin(c.yaw))*c.width/2+Math.abs(Math.cos(c.yaw))*c.length/2;bounds.minX=Math.min(bounds.minX,c.x-rx);bounds.maxX=Math.max(bounds.maxX,c.x+rx);bounds.minY=Math.min(bounds.minY,c.y);bounds.maxY=Math.max(bounds.maxY,c.y+c.height);bounds.minZ=Math.min(bounds.minZ,c.z-rz);bounds.maxZ=Math.max(bounds.maxZ,c.z+rz);volume+=c.width*c.height*c.length;}
    volume=Math.min(volume,(bounds.maxX-bounds.minX)*(bounds.maxY-bounds.minY)*(bounds.maxZ-bounds.minZ));
    const out={id:source.id,kind:source.kind,...base,colliders:normalized,breakable:SCENERY_KINDS[source.kind].breakable,resistance:finite(source.resistance)?clamp(source.resistance,.1,3):SCENERY_KINDS[source.kind].resistance,color:validColor(source.color)?source.color:({rock:'#838477',tree:'#65533d',bush:'#526b3c',prop:'#9a9e91'}[source.kind]||'#969b92'),size:Math.cbrt(volume),bounds};
    out.signature=JSON.stringify(out);return out;
  }
  class Route {
    constructor(mapId='coastline') {
      this.map=MapCatalog?MapCatalog.get(mapId):DEFAULT_MAP;this.mapId=this.map.id;
      this.width = this.map.width; this.halfWidth = this.width/2; this.barrierOffset = this.map.barrierOffset;
      this.laneOffsets=this.map.laneOffsets.slice();this.zones=this.map.zones;
      this.drivingSide=MapCatalog?.drivingSide||'right';this.lanes=this.map.lanes||createLanes(this.laneOffsets);this.forwardLanes=this.lanes.filter(lane=>lane.direction===1);
      this.connectors=[];this.obstacles=[];this.rails=[];this.railGrid=new Map();this.scenery=[];this.sceneryById=new Map();this.sceneryGrid=new Map();this.sceneryRevision=0;
      const points = this.map.points;
      const raw = [], n = points.length, count = n * 100;
      let distance = 0;
      for (let i = 0; i <= count; i++) {
        const u = i / count * n, k = Math.floor(u) % n, t = u - Math.floor(u);
        const a = points[(k + n - 1) % n], b = points[k], c = points[(k + 1) % n], d = points[(k + 2) % n];
        const p = { x: catmull(a[0], b[0], c[0], d[0], t), z: catmull(a[1], b[1], c[1], d[1], t) };
        if (i) distance += Math.hypot(p.x - raw[i - 1].x, p.z - raw[i - 1].z);
        p.s = distance; raw.push(p);
      }
      const scale = this.map.length / distance;
      for (const p of raw) { p.x *= scale; p.z *= scale; p.s *= scale; }
      this.length = this.map.length; this.spacing = 2; this.samples = [];
      let cursor = 0;
      for (let s = 0; s < this.length; s += this.spacing) {
        while (cursor + 1 < raw.length && raw[cursor + 1].s < s) cursor++;
        const a = raw[cursor], b = raw[cursor + 1], t = (s - a.s) / Math.max(.0001, b.s - a.s), u = s / this.length;
        let y = 1.5 + 15.5 * smooth(.3, .46, u) * (1 - smooth(.72, .96, u)) + 2.1 * Math.sin(u * TAU * 3) * smooth(.35, .45, u) * (1 - smooth(.62, .72, u));
        if(this.map.heights){const heights=this.map.heights;for(let k=0;k<heights.length-1;k++)if(u>=heights[k][0]&&u<=heights[k+1][0]){y=mix(heights[k][1],heights[k+1][1],smooth(heights[k][0],heights[k+1][0],u));break;}}
        this.samples.push({ x: mix(a.x, b.x, t), y, z: mix(a.z, b.z, t), s });
      }
      for (let i = 0; i < this.samples.length; i++) {
        const p = this.samples[i], prev = this.samples[(i + this.samples.length - 1) % this.samples.length], next = this.samples[(i + 1) % this.samples.length];
        const len = Math.hypot(next.x - prev.x, next.z - prev.z);
        p.tx = (next.x - prev.x) / len; p.tz = (next.z - prev.z) / len;
        p.nx = p.tz; p.nz = -p.tx; p.yaw = Math.atan2(p.tx, p.tz);
      }
      for(const descriptor of this.map.connectors||[])this.connectors.push(makeConnector(this,descriptor));
      // Solid shoulder objects share one descriptor with renderer and collision tests.
      if(this.map.theme==='mountain')for(const [fraction,side]of [[.37,1],[.49,-1],[.79,1]]){const p=this.at(this.length*fraction),offset=side*(this.halfWidth+1.8);this.obstacles.push({id:'shoulder-rock-'+fraction,kind:'rock',x:p.x+p.nx*offset,y:p.y,z:p.z+p.nz*offset,yaw:p.yaw,width:1.15,length:2.5,height:1.05,s:p.s});}
      this._buildRails();this.registerScenery(this.obstacles);
    }
    registerScenery(descriptors){
      if(!Array.isArray(descriptors))throw new Error('Expected scenery descriptors');
      const incoming=descriptors.map(sceneryDescriptor);let added=0,updated=0;
      if(!this.sceneryById){this.scenery=[];this.sceneryById=new Map();this.sceneryGrid=new Map();this.sceneryRevision=0;}
      for(const object of incoming){const old=this.sceneryById.get(object.id);if(old?.signature===object.signature)continue;
        if(old){for(const key of old.cells){const cell=this.sceneryGrid.get(key);cell?.delete(old);if(!cell?.size)this.sceneryGrid.delete(key);}this.scenery[this.scenery.indexOf(old)]=object;updated++;}else{this.scenery.push(object);added++;}
        const b=object.bounds,cell=SCENERY_TUNING.cellSize;object.cells=[];
        for(let x=Math.floor(b.minX/cell);x<=Math.floor(b.maxX/cell);x++)for(let z=Math.floor(b.minZ/cell);z<=Math.floor(b.maxZ/cell);z++){const key=x+':'+z;if(!this.sceneryGrid.has(key))this.sceneryGrid.set(key,new Set());this.sceneryGrid.get(key).add(object);object.cells.push(key);}
        this.sceneryById.set(object.id,object);
      }
      if(added||updated)this.sceneryRevision++;return{added,updated,total:this.scenery.length,revision:this.sceneryRevision};
    }
    sceneryNear(x,z,radius=8){const found=new Set(),cell=SCENERY_TUNING.cellSize;for(let a=Math.floor((x-radius)/cell);a<=Math.floor((x+radius)/cell);a++)for(let b=Math.floor((z-radius)/cell);b<=Math.floor((z+radius)/cell);b++)for(const object of this.sceneryGrid?.get(a+':'+b)||[])found.add(object);return found;}
    _buildRails(){
      for(const path of [this,...this.connectors])for(let s=0;s<path.length;s+=RAIL_TUNING.span)for(const side of[-1,1]){
        const tunnel=path===this&&this.map.tunnel&&s/this.length>this.map.tunnel.start&&s/this.length<this.map.tunnel.end;
        if(!tunnel&&!this.barrierVisible(path,s,side,RAIL_TUNING.span))continue;
        const a=path.at(s),b=path.at(Math.min(s+RAIL_TUNING.span,path.length-.001)),offset=side*(tunnel?this.halfWidth+2:path.barrierOffset),ax=a.x+a.nx*offset,az=a.z+a.nz*offset,bx=b.x+b.nx*offset,bz=b.z+b.nz*offset;
        const rail={id:(path.id||'main')+':'+s+':'+side,index:this.rails.length,pathId:path.id||'main',s,side,x:(ax+bx)/2,y:(a.y+b.y)/2,z:(az+bz)/2,yaw:Math.atan2(bx-ax,bz-az),pitch:-Math.atan2(b.y-a.y,Math.hypot(bx-ax,bz-az)),width:tunnel?.3:.14,length:Math.hypot(bx-ax,bz-az)+.02,height:tunnel?7.5:.83,breakable:!tunnel,ax,az,bx,bz};
        this.rails.push(rail);for(let x=Math.floor(Math.min(ax,bx)/16);x<=Math.floor(Math.max(ax,bx)/16);x++)for(let z=Math.floor(Math.min(az,bz)/16);z<=Math.floor(Math.max(az,bz)/16);z++){const key=x+':'+z;if(!this.railGrid.has(key))this.railGrid.set(key,[]);this.railGrid.get(key).push(rail);}
      }
    }
    railsNear(x,z,radius=8){const found=new Set();for(let a=Math.floor((x-radius)/16);a<=Math.floor((x+radius)/16);a++)for(let b=Math.floor((z-radius)/16);b<=Math.floor((z+radius)/16);b++)for(const rail of this.railGrid.get(a+':'+b)||[])found.add(rail);return found;}
    _rawGround(x,z){
      const p=this.driveNearest(x,z),d=p.distance,edge=p.barrierOffset,f=p.s/this.length,map=this.map,connector=p.roadId!=='main',bridge=map.bridge;
      if(!connector&&bridge&&f>bridge.start&&f<bridge.end&&d<(map.theme==='coast'?35:28))return map.theme==='coast'?-3.2:Math.max(-.3,p.y-9);
      if(map.theme==='city'&&!connector&&f>.30&&f<.40&&p.offset<-25&&p.offset>-75)return-2;
      if(d<edge+2)return p.y-.25;
      if(map.theme==='coast'){
        const noise=Math.sin(x*.017)*Math.cos(z*.022)+.37*Math.sin(x*.037+z*.011);
        if(p.offset>0){const hill=8+Math.max(0,noise)*28+24*Math.exp(-(x*x+z*z)/80000);return mix(p.y-.25,hill,smooth(edge+2,90,d));}
        const high=p.y-.25+Math.max(0,noise)*8*smooth(edge+2,45,d);return mix(high,-8,smooth(edge+2,f<.36?52:95,d));
      }
      const h=map.theme==='city'?1:map.theme==='mountain'?p.y+14+Math.sin(x*.012)*Math.cos(z*.01)*37+Math.sin(z*.022+x*.014)*12:2+Math.sin(x*.008)*Math.cos(z*.009)*10;
      return mix(p.y-.25,h,smooth(edge+2,edge+72,d));
    }
    terrainGrid(){
      if(this._terrainGrid)return this._terrainGrid;
      const extent=Math.max(960,...this.samples.map(p=>Math.max(Math.abs(p.x),Math.abs(p.z))+280)),steps=Math.ceil(extent*2/7),spacing=extent*2/steps,heights=new Float32Array((steps+1)**2);
      for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++)heights[z*(steps+1)+x]=this._rawGround(-extent+x*spacing,-extent+z*spacing);
      return this._terrainGrid={extent,steps,spacing,heights};
    }
    groundHeight(x,z){
      // Same two triangles as the rendered heightfield: no hidden flat plane or independent approximation.
      const g=this.terrainGrid(),u=clamp((x+g.extent)/g.spacing,0,g.steps-.000001),v=clamp((z+g.extent)/g.spacing,0,g.steps-.000001),ix=Math.floor(u),iz=Math.floor(v),a=u-ix,b=v-iz,i=iz*(g.steps+1)+ix,h=g.heights;
      return a+b<=1?h[i]+a*(h[i+1]-h[i])+b*(h[i+g.steps+1]-h[i]):h[i+g.steps+2]+(1-a)*(h[i+g.steps+1]-h[i+g.steps+2])+(1-b)*(h[i+1]-h[i+g.steps+2]);
    }
    surfaceHeight(x,z,hint){const p=this.driveNearest(x,z,hint),ground=this.groundHeight(x,z);return p.distance<=p.halfWidth+2?Math.max(ground,p.y):ground;}
    at(s) {
      s = wrap(s, this.length);
      const u = s / this.spacing, i = Math.floor(u), t = u - i, a = this.samples[i], b = this.samples[(i + 1) % this.samples.length];
      let tx = mix(a.tx, b.tx, t), tz = mix(a.tz, b.tz, t); const len = Math.hypot(tx, tz); tx /= len; tz /= len;
      return { s, x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t), tx, tz, nx: tz, nz: -tx, yaw: Math.atan2(tx, tz),roadId:'main',halfWidth:this.halfWidth,width:this.width,barrierOffset:this.barrierOffset };
    }
    nearest(x, z, hint) {
      const count = this.samples.length;
      let best = Infinity, bestS = 0;
      const check = i => {
        i = wrap(i, count); const a = this.samples[i], b = this.samples[(i + 1) % count], dx = b.x - a.x, dz = b.z - a.z;
        const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
        const distance = (x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2;
        if (distance < best) { best = distance; bestS = (i + t) * this.spacing; }
      };
      if (finite(hint)) {
        const index = Math.floor(wrap(hint, this.length) / this.spacing);
        for (let i = index - 24; i <= index + 24; i++) check(i);
      }
      if (!finite(hint) || best > 1600) for (let i = 0; i < count; i++) check(i);
      const p = this.at(bestS); p.offset = (x - p.x) * p.nx + (z - p.z) * p.nz; p.distance = Math.sqrt(best); return p;
    }
    laneForOffset(offset){return this.lanes.reduce((best,lane)=>Math.abs(lane.offset-offset)<Math.abs(best.offset-offset)?lane:best,this.lanes[0]);}
    laneAt(s,laneOrId=this.forwardLanes[0]){
      const lane=typeof laneOrId==='string'?this.lanes.find(item=>item.id===laneOrId):laneOrId;
      if(!lane||!this.lanes.includes(lane))throw new Error('Unknown driving lane');
      const p=this.at(s),direction=lane.direction,tx=p.tx*direction,tz=p.tz*direction,grade=(this.at(s+2).y-this.at(s-2).y)/4*direction,scale=Math.hypot(1,grade);
      return {...p,x:p.x+p.nx*lane.offset,z:p.z+p.nz*lane.offset,centerX:p.x,centerZ:p.z,centerYaw:p.yaw,offset:lane.offset,laneId:lane.id,direction,tx,tz,ty:grade,yaw:Math.atan2(tx,tz),rightX:-tz,rightZ:tx,forward:{x:tx/scale,y:grade/scale,z:tz/scale}};
    }
    widthAt(){return this.width;}
    halfWidthAt(){return this.halfWidth;}
    barrierAt(){return this.barrierOffset;}
    surfaceAt(offset,s=0){const half=this.halfWidthAt(s);return Math.abs(offset)<=half+.1?'asphalt':Math.abs(offset)<=half+1.65?'gravel':'grass';}
    isJunction(s){return this.connectors.some(c=>Math.abs(shortest(s-c.startS,this.length))<c.width+5||Math.abs(shortest(s-c.endS,this.length))<c.width+5);}
    // A join belongs to both roads. Clip rails against the other road's full
    // shoulder corridor, so tangent merges do not leave metal across asphalt.
    barrierVisible(path,s,side,span=4){
      const tunnel=this.map.tunnel;if(path===this&&tunnel&&s/this.length>tunnel.start&&s/this.length<tunnel.end)return false;
      const roads=[this,...this.connectors],end=Math.min(s+span,path.length);
      for(let at=s;at<=end+.001;at+=Math.max(.25,(end-s)/4)){
        const p=path.at(at),x=p.x+p.nx*side*path.barrierOffset,z=p.z+p.nz*side*path.barrierOffset;
        for(const other of roads){if(other===path)continue;if(other.bounds&&(x<other.bounds.minX-other.barrierOffset-2||x>other.bounds.maxX+other.barrierOffset+2||z<other.bounds.minZ-other.barrierOffset-2||z>other.bounds.maxZ+other.barrierOffset+2))continue;const n=other.nearest(x,z);if(n.distance<other.barrierOffset+.7&&Math.abs(n.y-p.y)<2.2)return false;}
      }
      return true;
    }
    driveNearest(x,z,hint){let best=this.nearest(x,z,hint);for(const c of this.connectors){if(x<c.bounds.minX-20||x>c.bounds.maxX+20||z<c.bounds.minZ-20||z>c.bounds.maxZ+20)continue;const p=c.nearest(x,z);if(p.distance-p.halfWidth<best.distance-best.halfWidth)best=p;}return best;}
    zone(s) { const u = wrap(s, this.length) / this.length; return (this.zones.find(z => u >= z.start && u < z.end)||this.zones[0]).name; }
  }
  function makeConnector(route,d){
    const startS=d.start*route.length,endS=d.end*route.length,a=route.at(startS),b=route.at(endS),distance=Math.hypot(b.x-a.x,b.z-a.z),bend=(d.bend||0)*distance;
    // One tangent-continuous curve avoids the old short control-point reversals
    // that folded connector shoulders/guardrails back across their own road.
    const ca={x:a.x+a.tx*distance*.4,z:a.z+a.tz*distance*.4},cb={x:b.x-b.tx*distance*.4,z:b.z-b.tz*distance*.4};
    const samples=[],raw=[],steps=Math.max(30,Math.ceil(distance/2));let length=0;
    for(let i=0;i<=steps;i++){const t=i/steps,u=1-t,bow=bend*Math.sin(Math.PI*t)**2,x=u*u*u*a.x+3*u*u*t*ca.x+3*u*t*t*cb.x+t*t*t*b.x-(b.z-a.z)/distance*bow,z=u*u*u*a.z+3*u*u*t*ca.z+3*u*t*t*cb.z+t*t*t*b.z+(b.x-a.x)/distance*bow;if(i)length+=Math.hypot(x-raw[i-1].x,z-raw[i-1].z);raw.push({x,z,distance:length});}
    for(let i=0;i<raw.length;i++){const p=raw[i],u=p.distance/length,prev=raw[Math.max(0,i-1)],next=raw[Math.min(raw.length-1,i+1)],n=Math.hypot(next.x-prev.x,next.z-prev.z),tx=(next.x-prev.x)/n,tz=(next.z-prev.z)/n,main=route.nearest(p.x,p.z),baseY=mix(a.y,b.y,smooth(0,1,u)),merge=1-smooth(route.barrierOffset+d.width/2,route.barrierOffset+d.width/2+24,main.distance),y=mix(baseY,main.y,merge);samples.push({...p,y,s:p.distance,mainS:wrap(startS+shortest(endS-startS,route.length)*u,route.length),tx,tz,nx:tz,nz:-tx,yaw:Math.atan2(tx,tz),roadId:d.id,width:d.width,halfWidth:d.width/2,barrierOffset:d.width/2+2});}
    const connector={...d,startS,endS,length,samples,halfWidth:d.width/2,barrierOffset:d.width/2+2,bounds:{minX:Math.min(...samples.map(p=>p.x)),maxX:Math.max(...samples.map(p=>p.x)),minZ:Math.min(...samples.map(p=>p.z)),maxZ:Math.max(...samples.map(p=>p.z))}};
    connector.at=s=>{s=clamp(s,0,length);let i=Math.min(samples.length-2,Math.floor(s/length*(samples.length-1)));while(i&&samples[i].s>s)i--;while(i<samples.length-2&&samples[i+1].s<s)i++;const A=samples[i],B=samples[i+1],t=(s-A.s)/Math.max(.001,B.s-A.s);return{...A,x:mix(A.x,B.x,t),y:mix(A.y,B.y,t),z:mix(A.z,B.z,t),s,mainS:wrap(A.mainS+shortest(B.mainS-A.mainS,route.length)*t,route.length)};};
    connector.nearest=(x,z)=>{let best=Infinity,result=null;for(let i=0;i<samples.length-1;i++){const A=samples[i],B=samples[i+1],dx=B.x-A.x,dz=B.z-A.z,t=clamp(((x-A.x)*dx+(z-A.z)*dz)/(dx*dx+dz*dz),0,1),px=mix(A.x,B.x,t),pz=mix(A.z,B.z,t),q=(x-px)**2+(z-pz)**2;if(q<best){best=q;result={...A,x:px,y:mix(A.y,B.y,t),z:pz,connectorS:mix(A.s,B.s,t),s:wrap(A.mainS+shortest(B.mainS-A.mainS,route.length)*t,route.length),offset:(x-px)*A.nx+(z-pz)*A.nz,distance:Math.sqrt(q)};}}return result;};
    return connector;
  }
  let runCounter = 0;
  function makeRunId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'drive-' + Date.now().toString(36) + '-' + (++runCounter).toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  const steeringLimit = speed => .48 / (1 + Math.pow(Math.abs(speed) / 13, 1.55));
  const inertia = (mass, width, length) => mass * (width * width + length * length) / 12;
  const angular = body => (body.yawRate || 0) + (body.crashYawRate || 0);
  function corners(body, width, length) {
    const rx = Math.cos(body.yaw), rz = -Math.sin(body.yaw), fx = -rz, fz = rx;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({ x: body.x + rx * x * width / 2 + fx * z * length / 2, z: body.z + rz * x * width / 2 + fz * z * length / 2 }));
  }
  function freshDamage() {
    return { front: 0, rear: 0, left: 0, right: 0, frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0, glass: 0, engine: 0, wheels: [0, 0, 0, 0], parts: BREAKAWAY_PARTS.map(()=>0) };
  }
  function initializeDamage(body) {
    if (!body.damage) body.damage = freshDamage();
    if (!body.damage.parts) body.damage.parts = BREAKAWAY_PARTS.map(()=>0);
    if (!body.impacts) body.impacts = [];
    if (!body.suspensionKick) body.suspensionKick = { roll: 0, pitch: 0, heave: 0 };
    if (!finite(body.damageRevision)) body.damageRevision = 0;
    if (!finite(body.condition)) body.condition = 100;
  }
  function applyBodyDamage(body, width, length, impact, scrape, details, priorPeak, time, conditionFloor = 0, conditionScale = 1) {
    initializeDamage(body);
    const effective = Math.sqrt(Math.max(0, impact * impact - priorPeak * priorPeak));
    const energy = (finite(details.energy) ? details.energy : .5 * body.mass * impact * impact) * (1 - priorPeak * priorPeak / Math.max(.01, impact * impact));
    const specific = energy / body.mass, strength = clamp(1 - Math.exp(-(specific / 190 + effective / 95)), .012, 1);
    const damage = Math.max(0, effective - .9) * (scrape ? .63 : 1.02) + specific * (scrape ? .05 : .09);
    body.condition = Math.max(conditionFloor, body.condition - damage * conditionScale);
    const fx = Math.sin(body.yaw), fz = Math.cos(body.yaw), rx = fz, rz = -fx;
    const wx = finite(details.x) ? details.x : body.x + fx * length / 2, wz = finite(details.z) ? details.z : body.z + fz * length / 2;
    const nx = finite(details.nx) ? details.nx : -fx, nz = finite(details.nz) ? details.nz : -fz;
    const x = clamp((wx - body.x) * rx + (wz - body.z) * rz, -width / 2, width / 2);
    const z = clamp((wx - body.x) * fx + (wz - body.z) * fz, -length / 2, length / 2);
    const localNX = nx * rx + nz * rz, localNZ = nx * fx + nz * fz;
    const longitudinal = clamp(Math.abs(z) / (length / 2), 0, 1), lateral = clamp(Math.abs(x) / (width / 2), 0, 1);
    const front = z >= 0, right = x >= 0, end = front ? 'front' : 'rear', side = right ? 'right' : 'left';
    const add = (key, amount) => { body.damage[key] = 1 - (1 - body.damage[key]) * (1 - clamp(amount, 0, 1)); };
    add(end, strength * longitudinal); add(side, strength * lateral);
    const frontWeight = .5 + .5 * z / (length / 2), rightWeight = .5 + .5 * x / (width / 2);
    add('frontLeft', strength * 1.3 * frontWeight * (1 - rightWeight)); add('frontRight', strength * 1.3 * frontWeight * rightWeight);
    add('rearLeft', strength * 1.3 * (1 - frontWeight) * (1 - rightWeight)); add('rearRight', strength * 1.3 * (1 - frontWeight) * rightWeight);
    if (impact > 5) add('glass', strength * (front ? .58 : .25) * Math.max(.3, longitudinal));
    if (front) add('engine', strength * longitudinal * .68);
    if (lateral > .3) { const wheel = (front ? 0 : 2) + (right ? 1 : 0); body.damage.wheels[wheel] = 1 - (1 - body.damage.wheels[wheel]) * (1 - strength * lateral * .72); }
    // Mounts fail where the contact actually lands. Broad deformation fields
    // still dent adjacent panels, but cannot eject an untouched wheel or bumper.
    const addPart=(index,amount)=>{body.damage.parts[index]=1-(1-body.damage.parts[index])*(1-clamp(amount,0,1));};
    if(longitudinal>.55)addPart(front?0:1,strength*longitudinal*(.35+.65*Math.abs(localNZ)));
    if(lateral>.55){const sideAmount=strength*lateral*(.25+.75*Math.abs(localNX));addPart(right?5:4,sideAmount);if(z>-length*.18&&z<length*.30)addPart(right?3:2,sideAmount);if(longitudinal>.28)addPart(6+(front?0:2)+(right?1:0),sideAmount*Math.min(1,longitudinal*1.6));}
    const radius = .38 + strength * .88;
    retainImpact(body.impacts, { x, z, strength, radius, normalX: localNX, normalZ: localNZ }); body.damageRevision++;
    body.suspensionKick.roll = clamp(body.suspensionKick.roll - localNX * strength * .12, -.16, .16);
    body.suspensionKick.pitch = clamp(body.suspensionKick.pitch + localNZ * strength * .13, -.17, .17); body.suspensionKick.heave = Math.min(.14, body.suspensionKick.heave + strength * .085);
    const result = { impact, scrape: scrape || impact < 3.5, damage, severity: strength, strength, energy, x: wx, y: (body.y || 0) + .65, z: wz, nx, nz, localX: x, localZ: z, normalX: localNX, normalZ: localNZ, radius, tangentSpeed: details.tangentSpeed || 0 };
    body.lastImpact = { ...result, revision: body.damageRevision, time };
    return result;
  }
  function retainImpact(impacts, impact) {
    impacts.push(impact);
    if (impacts.length <= 12) return;
    // Merge nearby scars rather than deleting an old dent when the buffer fills.
    let ai = 0, bi = 1, best = Infinity;
    for (let i = 0; i < impacts.length; i++) for (let j = i + 1; j < impacts.length; j++) {
      const a = impacts[i], b = impacts[j], score = Math.hypot(a.x - b.x, a.z - b.z) + (a.normalX * b.normalX + a.normalZ * b.normalZ < 0 ? 5 : 0);
      if (score < best) { best = score; ai = i; bi = j; }
    }
    const a = impacts[ai], b = impacts[bi], total = a.strength + b.strength;
    const x = (a.x * a.strength + b.x * b.strength) / total, z = (a.z * a.strength + b.z * b.strength) / total;
    const nx = a.normalX * a.strength + b.normalX * b.strength, nz = a.normalZ * a.strength + b.normalZ * b.strength, len = Math.hypot(nx, nz) || 1;
    impacts[ai] = { x, z, strength: 1 - (1 - a.strength) * (1 - b.strength), radius: Math.max(a.radius + Math.hypot(a.x - x, a.z - z), b.radius + Math.hypot(b.x - x, b.z - z)), normalX: nx / len, normalZ: nz / len };
    impacts.splice(bi, 1);
  }
  // Contact-space impulse solver. Positive yaw turns +Z toward +X, so angular point
  // velocity is (omega * rz, -omega * rx). Impulses conserve both bodies' momentum.
  function resolveImpulse(a, b, contact, options = {}) {
    const nx = contact.nx, nz = contact.nz, ax = contact.x - a.x, az = contact.z - a.z;
    const bx = b ? contact.x - b.x : 0, bz = b ? contact.z - b.z : 0;
    const invA = 1 / a.mass, invB = b ? 1 / b.mass : 0, invIA = 1 / a.inertia, invIB = b ? 1 / b.inertia : 0;
    const omegaA = angular(a), omegaB = b ? angular(b) : 0;
    const rvx = a.vx + omegaA * az - (b ? b.vx + omegaB * bz : 0), rvz = a.vz - omegaA * ax - (b ? b.vz - omegaB * bx : 0);
    const normalSpeed = rvx * nx + rvz * nz;
    if (normalSpeed >= -.015) return { impact: 0, impulse: 0, energy: 0, friction: 0 };
    const ca = az * nx - ax * nz, cb = bz * nx - bx * nz;
    const denominator = invA + invB + ca * ca * invIA + cb * cb * invIB;
    const impact = -normalSpeed, restitution = impact > 6 ? .025 : .075;
    const j = (1 + restitution) * impact / denominator;
    const tx = -nz, tz = nx, ta = az * tx - ax * tz, tb = bz * tx - bx * tz;
    const tangentDenominator = invA + invB + ta * ta * invIA + tb * tb * invIB;
    const apply = (jx, jz) => {
      a.vx += jx * invA; a.vz += jz * invA; a.crashYawRate = (a.crashYawRate || 0) + (az * jx - ax * jz) * invIA;
      if (b) { b.vx -= jx * invB; b.vz -= jz * invB; b.crashYawRate = (b.crashYawRate || 0) - (bz * jx - bx * jz) * invIB; }
    };
    apply(nx * j, nz * j);
    // Friction is solved after the normal impulse so off-center contacts cannot
    // gain kinetic energy through cross-coupled angular/tangential response.
    const tangentialSpeed = (a.vx + angular(a) * az - (b ? b.vx + angular(b) * bz : 0)) * tx + (a.vz - angular(a) * ax - (b ? b.vz - angular(b) * bx : 0)) * tz;
    const friction = clamp(-tangentialSpeed / tangentDenominator, -j * (options.friction || .32), j * (options.friction || .32));
    apply(tx * friction, tz * friction);
    a.crashYawRate = clamp(a.crashYawRate, -3.4, 3.4); if (b) b.crashYawRate = clamp(b.crashYawRate, -3, 3);
    return { impact, impulse: j, energy: .5 * impact * impact / denominator * (1 - restitution * restitution), friction: Math.abs(friction * tangentialSpeed) };
  }
  function boxContact(a, b, aw, al, bw, bl) {
    const arx = Math.cos(a.yaw), arz = -Math.sin(a.yaw), afx = Math.sin(a.yaw), afz = Math.cos(a.yaw);
    const brx = Math.cos(b.yaw), brz = -Math.sin(b.yaw), bfx = Math.sin(b.yaw), bfz = Math.cos(b.yaw);
    const dx = a.x - b.x, dz = a.z - b.z;
    let depth = Infinity, nx = 0, nz = 0;
    const axes = [[arx, arz], [afx, afz], [brx, brz], [bfx, bfz]];
    for (const axis of axes) {
      const x = axis[0], z = axis[1], center = dx * x + dz * z;
      const radiusA = Math.abs(arx * x + arz * z) * aw / 2 + Math.abs(afx * x + afz * z) * al / 2;
      const radiusB = Math.abs(brx * x + brz * z) * bw / 2 + Math.abs(bfx * x + bfz * z) * bl / 2;
      const overlap = radiusA + radiusB - Math.abs(center);
      if (overlap <= 0) return null;
      if (overlap < depth) { depth = overlap; const sign = center >= 0 ? 1 : -1; nx = x * sign; nz = z * sign; }
    }
    // Contact manifold midpoint: centered hits stay centered; an overlapping corner
    // generates an offset lever arm instead of arbitrary artificial rotation.
    const ac = corners(a, aw, al), bc = corners(b, bw, bl), tx = -nz, tz = nx;
    const an = Math.min(...ac.map(p => p.x * nx + p.z * nz)), bn = Math.max(...bc.map(p => p.x * nx + p.z * nz));
    const af = ac.filter(p => p.x * nx + p.z * nz < an + .035).map(p => p.x * tx + p.z * tz);
    const bf = bc.filter(p => p.x * nx + p.z * nz > bn - .035).map(p => p.x * tx + p.z * tz);
    const low = Math.max(Math.min(...af), Math.min(...bf)), high = Math.min(Math.max(...af), Math.max(...bf)), tangent = (low + high) / 2, normal = (an + bn) / 2;
    return { depth, nx, nz, x: normal * nx + tangent * tx, z: normal * nz + tangent * tz };
  }
  // Continuous SAT for a translating oriented vehicle and a static OBB. Unlike
  // expanded world AABBs it preserves rotated walls, narrow gaps and open doors.
  function sweepBox(a,b,aw,al,dx,dz){
    const overlap=boxContact(a,b,aw,al,b.width,b.length);if(overlap)return{...overlap,t:0};
    const arx=Math.cos(a.yaw),arz=-Math.sin(a.yaw),afx=-arz,afz=arx,brx=Math.cos(b.yaw),brz=-Math.sin(b.yaw),bfx=-brz,bfz=brx;
    let enter=-Infinity,leave=Infinity,nx=0,nz=0;
    for(const [x,z]of[[arx,arz],[afx,afz],[brx,brz],[bfx,bfz]]){
      const center=(a.x-b.x)*x+(a.z-b.z)*z,movement=dx*x+dz*z,radius=(Math.abs(arx*x+arz*z)*aw+Math.abs(afx*x+afz*z)*al+Math.abs(brx*x+brz*z)*b.width+Math.abs(bfx*x+bfz*z)*b.length)/2;
      if(Math.abs(movement)<1e-12){if(Math.abs(center)>radius+1e-9)return null;continue;}
      const t1=(-radius-center)/movement,t2=(radius-center)/movement,first=Math.min(t1,t2),last=Math.max(t1,t2);
      if(first>enter){enter=first;const sign=movement>0?-1:1;nx=x*sign;nz=z*sign;}leave=Math.min(leave,last);if(enter>leave+1e-10)return null;
    }
    if(enter< -1e-8||enter>1+1e-9||leave<0||!finite(enter))return null;
    const t=clamp(enter,0,1),pose={x:a.x+dx*t,yaw:a.yaw,z:a.z+dz*t},ac=corners(pose,aw,al),bc=corners(b,b.width,b.length),tx=-nz,tz=nx;
    const an=Math.min(...ac.map(p=>p.x*nx+p.z*nz)),bn=Math.max(...bc.map(p=>p.x*nx+p.z*nz)),af=ac.filter(p=>p.x*nx+p.z*nz<an+.035).map(p=>p.x*tx+p.z*tz),bf=bc.filter(p=>p.x*nx+p.z*nz>bn-.035).map(p=>p.x*tx+p.z*tz),tangent=(Math.max(Math.min(...af),Math.min(...bf))+Math.min(Math.max(...af),Math.max(...bf)))/2,normal=(an+bn)/2;
    return{t,depth:0,nx,nz,x:normal*nx+tangent*tx,z:normal*nz+tangent*tz};
  }
  const sceneryBodyHeight=body=>body.height||({truck:2.85,van:2.12,suv:1.82}[body.type]||1.48);
  const verticallyTouches=(body,height,shape)=>(body.y||0)<shape.y+shape.height-.001&&(body.y||0)+height>shape.y+.001;
  class Simulation {
    constructor(route = new Route(), config = getConfig(), options = {}) {
      this.route = route; this.config = config; this.mode = ['free', 'rush', 'trial'].includes(options.mode) ? options.mode : 'free';
      this.density = ['low', 'medium', 'high'].includes(options.density) ? options.density : 'medium';
      this.trafficCount=Number.isInteger(options.trafficCount)?clamp(options.trafficCount,0,500):null;
      this.damageMode=options.damageMode==='cosmetic'?'cosmetic':'standard';this.recordKey=recordKey(route,config,this.damageMode,this.mode==='trial'?'medium':this.density);
      const targets=route.map?.medals?.[config.id];this.medalThresholds = { ...(targets?{gold:targets[0],silver:targets[1],bronze:targets[2]}:MEDAL_THRESHOLDS), ...(options.medalThresholds || {}) }; this.reset();
    }
    reset() {
      const start = this.route.at(0), offset = routeLanes(this.route).find(lane=>lane.direction===1).offset;
      this.player = { x: start.x + start.nx * offset, y: start.y, z: start.z + start.nz * offset, yaw: start.yaw, vx: 0, vz: 0, speed: 0, steer: 0, slip: 0, roll: 0, pitch: 0, wheelSpin: 0, s: 0, offset, gear: 0, condition: 100, yawRate: 0, throttle: 0, brake: 0, rpm: .16 };
      Object.assign(this.player, { mass: this.config.mass, inertia: inertia(this.config.mass, this.config.width, this.config.length), crashYawRate: 0, damage: freshDamage(), damageRevision: 0, impacts: [], suspensionKick: { roll: 0, pitch: 0, heave: 0 }, driftIntensity: 0, offRoad: false });
      Object.assign(this.player,{engineRPM:this.config.idleRPM||850,engineLoad:0,shiftRemaining:0,shifting:false,grounded:true,surface:'asphalt',roadId:'main'});this.previousPlayer={...this.player};this.renderPlayer=null;
      this.time = 0; this.remaining = 120; this.score = 0; this.multiplier = 1; this.overtakes = 0; this.nearMisses = 0; this.distance = 0; this.checkpointIndex = 0;
      this.eligibleDistance = 0; this.freeDriveCredits = 0;this.driftDistance=0;this.driftCredits=0; this._lastRoadContact = -Infinity;
      this.oncomingDistance=0;this.oncomingPoints=0;this._oncomingProgress=0;this.player.oncoming=false;
      this.checkpoints = Array.from({ length: 8 }, (_, i) => this.route.length * (i + 1) / 8);
      this.penalty = 0; this.finished = false; this.result = null; this.events = []; this.id = makeRunId(); this.traffic = [];
      this.brokenRails=new Set();this.railDebris=[];this.railRevision=0;this.railBreakCount=0;this.brokenScenery=new Set();this.sceneryRevision=0;this.sceneryBreakCount=0;this.sceneryDebris=[];this._encounters = new Map(); this._passed = new Set(); this._collisionTimes = new Map(); this._contacts = new Map(); this._lastAction = 0; this._offroadTime = 0; this._decayAt = 8; this._recoveryCooldown = 0; this._trialTravel = 0;
      this.looseBlockers=[];this.recoveryPoint=null;this.waypoint=null;if(this.mode==='rush'&&this.trafficCount!==null)this.assisted=true;
      if (this.mode !== 'trial') this._createTraffic();
      return this;
    }
    _emit(event) { this.events.push(event); if (this.events.length > 64) this.events.shift(); }
    _road(x,z,hint){const p=this.mode==='free'&&this.route.driveNearest?this.route.driveNearest(x,z,hint):this.route.nearest(x,z,hint);return{roadId:'main',halfWidth:this.route.halfWidth,width:this.route.width,barrierOffset:this.route.barrierOffset,...p};}
    interpolate(alpha=1){const p=this.player,old=this.previousPlayer||p,t=clamp(alpha,0,1),out=this.renderPlayer||{};Object.assign(out,p);for(const key of ['x','y','z','steer','roll','pitch','wheelSpin'])out[key]=mix(old[key]||0,p[key]||0,t);out.yaw=(old.yaw||0)+shortest((p.yaw||0)-(old.yaw||0),TAU)*t;this.renderPlayer=out;return out;}
    applyGarageConfig(config){
      if(!config||!own(CARS,config.id)||!finite(config.width)||!finite(config.length)||config.width<=0||config.length<=0)return false;
      const p=this.player,old=this.config,dimensionChange=old.id!==config.id||old.width!==config.width||old.length!==config.length;
      const clear=candidate=>{
        if(this.traffic.some(other=>Math.abs((other.y||0)-(candidate.y||0))<2.5&&boxContact(candidate,other,config.width,config.length,other.width,other.length)))return false;
        if(!this._sceneryClear(candidate,config.width,config.length,config.height))return false;
        if((this.route.obstacles||[]).some(other=>!this.route.sceneryById?.has(other.id)&&!other.destroyed&&Math.abs((other.y||0)-(candidate.y||0))<(other.height||2)+1&&boxContact(candidate,other,config.width,config.length,other.width,other.length)))return false;
        for(const rail of this.route.railsNear?.(candidate.x,candidate.z,Math.hypot(config.width,config.length)/2+3)||[])if(!this.brokenRails.has(rail.id)&&candidate.y<rail.y+rail.height&&candidate.y+config.height>rail.y&&boxContact(candidate,rail,config.width,config.length,rail.width,rail.length))return false;
        return true;
      };
      let placement=null;
      if(dimensionChange||!clear(p)){
        const offsets=routeLanes(this.route).filter(lane=>lane.direction===1).map(lane=>lane.offset);
        for(let tries=0;tries<Math.ceil(this.route.length/12)&&!placement;tries++)for(const offset of offsets){const at=this.route.at(wrap(p.s-tries*12,this.route.length)),candidate={x:at.x+at.nx*offset,y:at.y,z:at.z+at.nz*offset,yaw:at.yaw,s:at.s,offset,roadId:'main'};if(Math.abs(offset)+config.width/2<this.route.halfWidth-.05&&clear(candidate)){placement=candidate;break;}}
        if(!placement)return false;
      }
      this.config=config;p.mass=config.mass;p.inertia=inertia(config.mass,config.width,config.length);
      if(placement){Object.assign(p,placement,{vx:0,vz:0,speed:0,steer:0,slip:0,yawRate:0,crashYawRate:0,roll:0,pitch:0,driftIntensity:0,gear:0,engineRPM:config.idleRPM,rpm:config.idleRPM/config.redlineRPM,shiftRemaining:0,shifting:false,offRoad:false,oncoming:false});this._contacts.clear();this._encounters.clear();this._oncomingProgress=0;}
      if(old.configKey!==config.configKey){if(this.mode!=='free')this.assisted=true;this.recordKey=recordKey(this.route,config,this.damageMode,this.mode==='trial'?'medium':this.density);}
      Object.assign(this.previousPlayer,p);this.renderPlayer=null;return true;
    }
    setTrafficCount(value){
      if(value!==null&&(!Number.isInteger(value)||value<0||value>500))return false;this.trafficCount=value;
      if(this.mode==='trial')return true;const old=new Map(this.traffic.map(car=>[car.id,car]));this.traffic=[];this._createTraffic();this.traffic=this.traffic.map(car=>old.get(car.id)||car);if(this.mode==='rush'&&value!==null)this.assisted=true;return true;
    }
    _createTraffic() {
      const count = this.trafficCount??Math.round({ low: 12, medium: 24, high: 40 }[this.density]*(this.route.map?.trafficDensity||1));
      const types = [{ type: 'compact', width: 1.75, length: 4.1, mass: 1120 }, { type: 'sedan', width: 1.86, length: 4.7, mass: 1500 }, { type: 'suv', width: 1.98, length: 4.75, mass: 1950 }, { type: 'van', width: 2.03, length: 5.25, mass: 2200 }, { type: 'truck', width: 2.25, length: 7.3, mass: 4600 }];
      const lanes = routeLanes(this.route);
      for (let i = 0; i < count; i++) {
        // A weighted fleet cycle remains varied on two-, four- and six-lane roads;
        // coupling type selection to lane count can accidentally eliminate classes.
        const lane = i % lanes.length, intent=lanes[lane], spec = types[[0,1,2,0,3,1,0,4,2,1,3,0][i%12]];
        let s = 100 + Math.floor(i / lanes.length) * (this.route.length - 230) / Math.ceil(count / lanes.length) + lane * 43;
        s = clamp(s, 85, this.route.length - 85);
        const speed=(12 + ((i * 11) % 10))*(this.route.map?.trafficSpeed||1);
        const car = { ...spec, id: 'traffic-' + i, roadId:intent.roadId,laneId:intent.id,s, offset:intent.offset, laneOffset:intent.offset, deflectVelocity: 0, yawOffset: 0, crashYawRate: 0, direction:intent.direction, speed, desiredSpeed:speed, colorIndex: i % 7, wheelSpin: 0, brake: 0, disturbed: 0 };
        car.inertia = inertia(car.mass, car.width, car.length);
        this._locateTraffic(car); this.traffic.push(car);
      }
    }
    _locateTraffic(car) {
      const p = this.route.at(car.s);
      initializeDamage(car);
      if (!finite(car.mass)) car.mass = { compact: 1120, sedan: 1500,suv:1950, van: 2200, truck: 4600 }[car.type] || 1400;
      if (!finite(car.inertia)) car.inertia = inertia(car.mass, car.width, car.length);
      if (!finite(car.laneOffset)) car.laneOffset = car.offset;
      car.roadId=car.roadId||'main';
      car.deflectVelocity = car.deflectVelocity || 0; car.yawOffset = car.yawOffset || 0; car.crashYawRate = car.crashYawRate || 0; car.disturbed = car.disturbed || 0;
      car.x = p.x + p.nx * car.offset; car.y = p.y; car.z = p.z + p.nz * car.offset; car.yaw = p.yaw + (car.direction < 0 ? Math.PI : 0) + car.yawOffset;
      car.vx = p.tx * car.speed * car.direction + p.nx * car.deflectVelocity; car.vz = p.tz * car.speed * car.direction + p.nz * car.deflectVelocity;
    }
    _trafficStep(dt) {
      const p = this.player;
      for (const car of this.traffic) {
        this._looseBlockerContact(car,car.width,car.length,{x:car.x-car.vx*dt,z:car.z-car.vz*dt,yaw:car.yaw});
        initializeDamage(car);
        const wheelDamage = car.damage.wheels.reduce((sum, value) => sum + value, 0) / 4;
        let target = car.wrecked ? 0 : car.desiredSpeed * (1 - car.damage.engine * .55) * (1 - wheelDamage * .18);
        for (const other of this.traffic) {
          if (other === car || (other.roadId||'main')!==car.roadId || Math.abs(other.offset - car.offset) > (car.width + other.width) / 2 + .7) continue;
          const ahead = wrap((other.s - car.s) * car.direction, this.route.length);
          const sameLane=other.direction===car.direction&&Math.abs((other.laneOffset??other.offset)-car.laneOffset)<.25;
          if (sameLane && ahead > 0 && ahead < 58 && Math.abs(other.y-this.route.at(other.s).y)<2.5) target = Math.min(target, Math.max(0, (ahead - (car.length + other.length) / 2 - 5) / 1.6));
          else if(other.crashActive||other.wrecked||other.disturbed>0)target=Math.min(target,this._trafficObstructionSpeed(car,other,other.width,other.length));
        }
        const aheadPlayer = wrap((p.s - car.s) * car.direction, this.route.length);
        if ((p.roadId||'main')===car.roadId && Math.abs(p.offset - car.offset) < (car.width + this.config.width) / 2 + .3){
          const road=this.route.at(p.s),aligned=(Math.sin(p.yaw)*road.tx+Math.cos(p.yaw)*road.tz)*car.direction>.5;
          if(aligned&&aheadPlayer>0&&aheadPlayer<65&&Math.abs(p.y-road.y)<2.5)target=Math.min(target,Math.max(0,(aheadPlayer-(car.length+this.config.length)/2-6)/1.65));
          else target=Math.min(target,this._trafficObstructionSpeed(car,p,this.config.width,this.config.length));
        }
        car.disturbed = Math.max(0, (car.disturbed || 0) - dt);
        const decay = Math.exp(-5.5 * dt); car.suspensionKick.roll *= decay; car.suspensionKick.pitch *= decay; car.suspensionKick.heave *= decay;
        if (car.crashActive) { this._advanceTrafficCrash(car, target, wheelDamage, dt); continue; }
        if (car.disturbed > 0) target = Math.min(target, 5);
        car.brake = target < car.speed - 1 ? 1 : 0;
        car.speed += clamp(target - car.speed, -(car.disturbed > 0 ? 3.5 : 8) * dt, 2.5 * dt);
        car.deflectVelocity += (-(car.offset - car.laneOffset) * (car.disturbed > .5 ? .45 : 1.2) - car.deflectVelocity * 1.8) * dt;
        car.offset += car.deflectVelocity * dt;
        car.crashYawRate += (-car.yawOffset * 2.2 - car.crashYawRate * 2.4) * dt;
        car.yawOffset = clamp(car.yawOffset + car.crashYawRate * dt, -1.25, 1.25);
        const relativeYaw = car.yawOffset, footprint = Math.abs(Math.cos(relativeYaw)) * car.width / 2 + Math.abs(Math.sin(relativeYaw)) * car.length / 2;
        const limit = this.route.barrierOffset - footprint - .05;
        if (Math.abs(car.offset) > limit) { car.offset = Math.sign(car.offset) * limit; car.deflectVelocity *= -.15; }
        car.s = wrap(car.s + car.speed * dt * car.direction, this.route.length); car.wheelSpin += car.speed * dt / .34; this._locateTraffic(car);
      }
      this._trafficPileups();
      for (const car of this.traffic) if (car.crashActive) {this._trafficBarrierCollisions(car);this._sceneryCollisions(car);this._syncTrafficPose(car);}
    }
    _trafficObstructionSpeed(car,other,width,length){
      // A wreck or a wrong-way player physically blocking this lane is an emergency,
      // not a leader on another lane/road. Use real separation and road elevation.
      const road=this.route.at(car.s),fx=road.tx*car.direction,fz=road.tz*car.direction,dx=other.x-car.x,dz=other.z-car.z,ahead=dx*fx+dz*fz,side=dx*fz-dz*fx;
      if(ahead<=0||ahead>Math.min(45,8+Math.max(0,car.speed)*1.3)||Math.abs(side)>(car.width+width)/2+.25||Math.abs(other.y-this.route.at(car.s+ahead*car.direction).y)>2.5)return Infinity;
      return Math.max(0,(ahead-(car.length+length)/2-3)/1.1);
    }
    _syncTrafficPose(car) {
      const road = this.route.nearest(car.x, car.z, car.s);
      car.s = wrap(road.s, this.route.length); car.offset = road.offset; car.y = road.y;
      car.speed = (car.vx * road.tx + car.vz * road.tz) * car.direction;
      car.deflectVelocity = car.vx * road.nx + car.vz * road.nz;
      car.yawOffset = shortest(car.yaw - road.yaw - (car.direction < 0 ? Math.PI : 0), TAU);
      return road;
    }
    _advanceTrafficCrash(car, target, wheelDamage, dt) {
      const road = this.route.at(car.s), fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), rx = fz, rz = -fx;
      const forward = car.vx * fx + car.vz * fz, lateral = car.vx * rx + car.vz * rz;
      if (!car.wrecked && car.disturbed <= 0 && Math.abs(car.crashYawRate) < .28 && Math.abs(lateral) < 1.2) car.recovering = true;
      if (car.recovering && !car.wrecked) {
        const correction = clamp((car.laneOffset - car.offset) * .65, -4, 4), lookSpeed = Math.max(5, Math.abs(forward));
        const desiredYaw = Math.atan2(road.tx * car.direction * lookSpeed + road.nx * correction, road.tz * car.direction * lookSpeed + road.nz * correction);
        const desiredRate = clamp(shortest(desiredYaw - car.yaw, TAU) * 2.1, -.8, .8);
        car.crashYawRate += (desiredRate - car.crashYawRate) * (1 - Math.exp(-3 * dt));
      } else car.crashYawRate *= Math.exp(-1.6 * dt);
      car.brake = car.wrecked || target < forward - 1 ? 1 : 0;
      const rolling = Math.sign(forward) * Math.min(Math.abs(forward) / dt, car.wrecked ? 3.4 : .55);
      const drive = car.recovering && !car.wrecked ? clamp(target - forward, -6, 2.5 * (1 - car.damage.engine * .55)) : 0;
      const lateralForce = clamp(-lateral * 4, -6 * (1 - wheelDamage * .35), 6 * (1 - wheelDamage * .35));
      car.vx += (fx * (drive - rolling) + rx * lateralForce) * dt;
      car.vz += (fz * (drive - rolling) + rz * lateralForce) * dt;
      car.yaw = shortest(car.yaw + car.crashYawRate * dt, TAU);
      this._moveSceneryBody(car,car.width,car.length,sceneryBodyHeight(car),dt);car.wheelSpin += forward * dt / .34;
      this._syncTrafficPose(car);
      // Rejoin lane following only when position, heading and lateral momentum agree.
      if (car.recovering && Math.abs(car.offset - car.laneOffset) < .06 && Math.abs(car.yawOffset) < .025 && Math.abs(car.deflectVelocity) < .12 && Math.abs(car.crashYawRate) < .08) {
        car.crashActive = false; car.recovering = false; car.offset = car.laneOffset;
        car.yawOffset = 0; car.crashYawRate = 0; car.deflectVelocity = 0; this._locateTraffic(car);
      }
    }
    _trafficBarrierCollisions(car) {
      if(!this.route.railsNear)return;
      for(const rail of this.route.railsNear(car.x,car.z,8)){
        if(this.brokenRails.has(rail.id)||car.y>rail.y+rail.height||car.y+2<rail.y)continue;
        const contact=boxContact(car,rail,car.width,car.length,rail.width,rail.length);if(!contact)continue;
        const impact=Math.max(0,-car.vx*contact.nx-car.vz*contact.nz);
        if(this._breakRail(rail,car,impact,contact)){car.vx+=contact.nx*impact*RAIL_TUNING.resistance;car.vz+=contact.nz*impact*RAIL_TUNING.resistance;continue;}
        const response=resolveImpulse(car,null,contact,{friction:.2}),prior=this._recordContact('traffic-rail:'+car.id+':'+rail.id,response.impact);if(prior!==null)this._damageTraffic(car,response.impact,false,{...contact,...response},prior);car.x+=contact.nx*(contact.depth+.003);car.z+=contact.nz*(contact.depth+.003);
      }this._syncTrafficPose(car);
    }
    _trafficPileups() {
      for (let i = 0; i < this.traffic.length; i++) for (let j = i + 1; j < this.traffic.length; j++) {
        const a = this.traffic[i], b = this.traffic[j];
        const radius = (Math.hypot(a.width, a.length) + Math.hypot(b.width, b.length)) / 2;
        if (Math.abs(shortest(a.s - b.s, this.route.length)) > radius + 2 || (a.x - b.x) ** 2 + (a.z - b.z) ** 2 > radius * radius) continue;
        const contact = boxContact(a, b, a.width, a.length, b.width, b.length); if (!contact) continue;
        const tangentSpeed = Math.abs((a.vx - b.vx) * -contact.nz + (a.vz - b.vz) * contact.nx);
        const response = resolveImpulse(a, b, contact, { friction: .34 }), scrape = response.impact < 4 && tangentSpeed > response.impact * 2;
        const priorPeak = this._recordContact('traffic-pair:' + [a.id, b.id].sort().join(':'), response.impact);
        if (priorPeak !== null) {
          this._damageTraffic(a, response.impact, scrape, { ...contact, ...response, tangentSpeed }, priorPeak);
          this._damageTraffic(b, response.impact, scrape, { ...contact, ...response, nx: -contact.nx, nz: -contact.nz, tangentSpeed }, priorPeak);
        }
        const shareA = b.mass / (a.mass + b.mass), separation = contact.depth + .008;
        a.x += contact.nx * separation * shareA; a.z += contact.nz * separation * shareA;
        b.x -= contact.nx * separation * (1 - shareA); b.z -= contact.nz * separation * (1 - shareA);
        this._syncTrafficPose(a); this._syncTrafficPose(b);
      }
    }
    step(dt, input = {}) {
      if (this.finished || !finite(dt) || dt <= 0) return;
      dt = Math.min(dt, .1);
      const count = Math.max(1, Math.ceil(dt * 120 - 1e-9)), slice = dt / count;
      for (let i = 0; i < count && !this.finished; i++) this._step(slice, input);
    }
    _step(dt, input) {
      const p = this.player, c = this.config, oldS = p.s, oldX = p.x, oldZ = p.z, oldOffset = p.offset, oldYaw = p.yaw;
      Object.assign(this.previousPlayer,p);this.renderPlayer=null;
      this.time += dt; if (this.mode === 'rush') this.remaining = Math.max(0, this.remaining - dt);
      this._recoveryCooldown = Math.max(0, this._recoveryCooldown - dt);
      this._trafficStep(dt);this._stepRailDebris(dt);this._stepSceneryDebris(dt);this._stepLooseBlockers(dt);
      const throttle = clamp(Number(input.throttle) || 0, 0, 1), brake = clamp(Number(input.brake) || 0, 0, 1), steering = clamp(Number(input.steer) || 0, -1, 1), hand = input.handbrake ? 1 : 0;
      p.throttle = throttle; p.brake = brake;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = fz, rz = -fx;
      const forward = p.vx * fx + p.vz * fz, lateral = p.vx * rx + p.vz * rz;
      const contactRoad=this._road(p.x,p.z,p.s),halfWidth=contactRoad.halfWidth||this.route.halfWidth;
      const offroad = Math.abs(contactRoad.offset) > halfWidth + .1;
      p.surface=offroad?(Math.abs(contactRoad.offset)<halfWidth+1.65?'gravel':'grass'):'asphalt';
      const wheelDamage = this.damageMode==='cosmetic'?0:p.damage.wheels.reduce((sum, n) => sum + n, 0) / 4;
      const engineDamage=this.damageMode==='cosmetic'?0:p.damage.engine;
      const surface = offroad ? (p.surface==='gravel'?.72:.61) : 1, grip = c.grip * surface * (1 - wheelDamage * .085), engineFactor = 1 - engineDamage * .18;
      const steerMax = steeringLimit(forward)*(this.admin?.steering??1), targetSteer = steering * steerMax;
      // Full keyboard input builds gently; releasing or countersteering straightens
      // the wheels sooner. High speed reduces actual angle, not just its display.
      const returning = Math.abs(targetSteer) < Math.abs(p.steer) || targetSteer * p.steer < 0;
      const steerResponse = (returning ? 9 : 3.2 + (c.steerRate - 8.6) * .15)*(c.steeringMultiplier||1);
      const steeringRate = .9*(c.steeringMultiplier||1) / (1 + Math.abs(forward) / 18);
      p.steer += clamp((targetSteer - p.steer) * (1 - Math.exp(-steerResponse * dt)), -steeringRate * dt, steeringRate * dt);
      let force = 0;
      if (throttle) force += forward < -.6 ? c.brake * throttle : forward < c.maxSpeed * (1 - engineDamage * .08) ? c.accel * engineFactor * throttle * (1 - .35 * Math.pow(Math.max(0, forward) / c.maxSpeed, 2)) * (offroad?.9:surface) * (p.shiftRemaining>0?.76:1) : 0;
      if (brake) force -= forward > .6 ? c.brake * brake : forward > -8 ? c.accel * .55 * brake : 0;
      if (hand && Math.abs(forward) > .05) force -= Math.sign(forward) * 5.8;
      force -= forward * Math.abs(forward) * (c.dragCoefficient||.0013) + Math.sign(forward) * (.19 + (offroad ? .55 : 0));
      // Mild longitudinal gravity matters on mountain climbs without feeding visual suspension back into physics.
      const path=contactRoad.roadId==='main'?this.route:(this.route.connectors||[]).find(q=>q.id===contactRoad.roadId)||this.route,distanceOnPath=contactRoad.connectorS??p.s;
      const behind=path.at(distanceOnPath-2),ahead=path.at(distanceOnPath+2),grade=offroad&&this.route.surfaceHeight?(this.route.surfaceHeight(p.x+fx*2,p.z+fz*2,p.s)-this.route.surfaceHeight(p.x-fx*2,p.z-fz*2,p.s))/4:(ahead.y-behind.y)/4;
      if(Math.abs(forward)>.15||throttle||brake)force-=9.81*clamp(grade,offroad?-.8:-.18,offroad?.8:.18)*(offroad?1:fx*contactRoad.tx+fz*contactRoad.tz);
      if (!throttle && !brake && Math.abs(forward) < .12) force = -forward / dt;
      // Prevent braking across zero within one step; reverse begins on the following step.
      if (forward > .6 && brake && forward + force * dt < 0) force = -forward / dt;
      if (forward < -.6 && throttle && forward + force * dt > 0) force = -forward / dt;
      // Original handbrake/sliding model restored from work/drive-before-damage.html.
      // Keep the newer gentle keyboard steering above and independent crash spin.
      const lateralLimit = grip * (hand ? .34 : 1.3) * (1 - c.rearBias * throttle * Math.abs(steering) * .15);
      const lateralForce = clamp(-lateral * (hand ? 2.4 : 10.5), -lateralLimit, lateralLimit);
      p.vx += (fx * force + rx * lateralForce) * dt; p.vz += (fz * force + rz * lateralForce) * dt;
      const turningLimit = grip / (Math.abs(forward) + 3) * (hand ? 1.6 : 1);
      const desiredYaw = clamp(forward / c.wheelbase * Math.tan(p.steer), -turningLimit, turningLimit);
      p.yawRate += (desiredYaw - p.yawRate) * (1 - Math.exp(-(hand ? 5 : 8) * dt));
      p.crashYawRate *= Math.exp(-(hand ? 1.05 : 2.15) * dt);
      p.yaw = shortest(p.yaw + (p.yawRate + p.crashYawRate) * dt, TAU);
      const decay = Math.exp(-5.5 * dt); p.suspensionKick.roll *= decay; p.suspensionKick.pitch *= decay; p.suspensionKick.heave *= decay;
      this._movePlayer(dt);
      const drivenStep = Math.hypot(p.x - oldX, p.z - oldZ);
      let road = this._road(p.x, p.z, oldS);
      p.s = road.s; p.offset = road.offset;p.roadId=road.roadId;
      this._looseBlockerContact(p,c.width,c.length,this.previousPlayer);
      this._barrierCollisions();
      this._trafficCollisions();
      this._obstacleCollisions();
      this._barrierCollisions();
      road = this._road(p.x, p.z, p.s); p.s = road.s; p.offset = road.offset;p.roadId=road.roadId;
      p.offRoad = Math.abs(p.offset) > road.halfWidth + .1;this._supportPlayer(dt,road);
      const nfx = Math.sin(p.yaw), nfz = Math.cos(p.yaw);
      p.speed = p.vx * nfx + p.vz * nfz; p.slip = p.vx * nfz - p.vz * nfx;
      const slipSignal = smooth(1.1, 5, Math.abs(p.slip)) * smooth(5, 11, Math.hypot(p.vx, p.vz));
      p.driftIntensity += (slipSignal - p.driftIntensity) * (1 - Math.exp(-7 * dt));
      p.roll += (clamp(-p.yawRate * p.speed * .006, -.095, .095) - p.roll) * (1 - Math.exp(-6 * dt));
      p.pitch += (clamp(-force * .007, -.075, .075) - p.pitch) * (1 - Math.exp(-6 * dt));
      p.wheelSpin += p.speed * dt / (c.wheelRadius||.34);
      this._drivetrain(dt,throttle,brake);
      this.distance += Math.hypot(p.vx, p.vz) * dt;
      if(p.grounded&&!p.destroyed&&!p.offRoad&&Math.abs(p.speed)>5&&Math.abs(p.slip)>1.8&&p.driftIntensity>.28&&this.time-this._lastRoadContact>.5)this.driftDistance+=Math.min(drivenStep,Math.hypot(p.x-oldX,p.z-oldZ));
      if (this.mode === 'free' && p.roadId==='main' && p.speed > 1 && this.time - this._lastRoadContact > 1 && drivenStep > 0) {
        const before = this.route.at(oldS), after = this.route.at(p.s), delta = Math.abs(shortest(p.s - oldS, this.route.length));
        const footprint = yaw => Math.abs(Math.cos(yaw)) * c.width / 2 + Math.abs(Math.sin(yaw)) * c.length / 2;
        const startedOnRoad = Math.abs(oldOffset) + footprint(oldYaw - before.yaw) <= this.route.halfWidth - .05;
        const endedOnRoad = Math.abs(p.offset) + footprint(p.yaw - after.yaw) <= this.route.halfWidth - .05;
        if (startedOnRoad && endedOnRoad && delta >= drivenStep * .6 && delta < 12) this.eligibleDistance += Math.min(drivenStep, Math.hypot(p.x - oldX, p.z - oldZ));
      }
      if (p.offRoad) this._offroadTime += dt; else this._offroadTime = 0;
      if (this._offroadTime > .8) this.multiplier = 1;
      if(p.condition<=0&&!p.destroyed){p.destroyed=true;p.wrecked=true;this._emit({type:'explosion',bodyId:'player',x:p.x,y:p.y,z:p.z});this.finish('wrecked');return;}
      this._scoreOncoming(road,contactRoad,oldX,oldZ,drivenStep);
      if (this.mode === 'rush') {
        this._scorePasses();
        if (this.time > this._decayAt) { this.multiplier = Math.max(1, this.multiplier - .25); this._decayAt = this.time + 4; }
        if (this.remaining <= 1e-7 || p.condition <= 0) this.finish(p.condition <= 0 ? 'wrecked' : 'complete');
      }
      if (this.mode === 'trial') this._checkpoints(oldS, p.s);
    }
    // A finished wreck no longer earns or changes the captured result. Road traffic
    // and physical wreck momentum continue behind the recovery menu.
    stepAfterWreck(dt){
      if(!this.player.destroyed||!this.finished||!finite(dt)||dt<=0)return;
      const count=Math.max(1,Math.ceil(Math.min(dt,.1)*120)),slice=Math.min(dt,.1)/count,p=this.player;
      for(let i=0;i<count;i++){
        Object.assign(this.previousPlayer,p);this.renderPlayer=null;this.time+=slice;
        this._trafficStep(slice);this._stepRailDebris(slice);this._stepSceneryDebris(slice);this._stepLooseBlockers(slice);this._looseBlockerContact(p,this.config.width,this.config.length,this.previousPlayer);p.vx*=Math.exp(-2.8*slice);p.vz*=Math.exp(-2.8*slice);
        // The wreck continues moving behind the recovery menu, but retains the
        // same swept solid/destructible contacts as the live car.
        this._movePlayer(slice);const road=this._road(p.x,p.z,p.s);p.s=road.s;p.offset=road.offset;this._supportPlayer(slice,road);
        p.speed=Math.hypot(p.vx,p.vz);p.throttle=0;p.engineLoad=0;p.engineRPM=0;
      }
    }
    // Result menus keep the road alive without awarding the same completed run twice.
    stepAmbient(dt){
      if(!this.finished){this.step(dt,{});return;}if(this.player.destroyed){this.stepAfterWreck(dt);return;}
      const frozen=Object.fromEntries(['remaining','score','multiplier','overtakes','nearMisses','distance','checkpointIndex','eligibleDistance','freeDriveCredits','penalty','oncomingDistance','oncomingPoints','_trialTravel'].map(k=>[k,this[k]])),result=this.result;
      this.finished=false;this.step(dt,{});this.finished=true;this.result=result;Object.assign(this,frozen);
    }
    _ensureLooseBlockers(){for(const item of this.route.looseBlockers||[])if(!this.looseBlockers.some(b=>b.id===item.id))this.looseBlockers.push({...item,baseY:item.y||0,vx:0,vy:0,vz:0,roll:0,pitch:0,spin:0,active:false,fallen:false});}
    _looseBlockerContact(body,width,length,previous=body){
      this._ensureLooseBlockers();const speed=Math.hypot(body.vx||0,body.vz||0);
      for(const b of this.looseBlockers){if(b.active||b.fallen||Math.abs((body.y||0)-b.y)>3)continue;const radius=(Math.hypot(width,length)+Math.hypot(b.width,b.length))/2+speed/120+1;if(Math.hypot(body.x-b.x,body.z-b.z)>radius)continue;
        if(!boxContact(body,b,width,length,b.width,b.length)&&!sweepBox(previous,b,width,length,body.x-previous.x,body.z-previous.z))continue;
        const dx=speed>.01?(body.vx||0)/speed:Math.sin(body.yaw),dz=speed>.01?(body.vz||0)/speed:Math.cos(body.yaw);b.active=true;b.fallen=true;b.vx=dx*(speed>8?speed*.65:Math.max(.5,speed*.45));b.vz=dz*(speed>8?speed*.65:Math.max(.5,speed*.45));b.vy=speed>8?Math.min(18,speed*.16):.25;b.spin=speed>8?speed*.18:1.9;this._emit({type:'blockerBreak',x:b.x,y:b.y,z:b.z,impact:speed});
      }
    }
    _stepLooseBlockers(dt){this._ensureLooseBlockers();for(const b of this.looseBlockers){if(!b.active)continue;b.vy-=9.81*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;b.pitch+=b.spin*dt;b.yaw+=b.spin*.31*dt;const ground=this.route.surfaceHeight?.(b.x,b.z)??b.baseY;if(b.y<=ground){b.y=ground;b.vy=Math.abs(b.vy)>1?-b.vy*.25:0;b.vx*=Math.exp(-5*dt);b.vz*=Math.exp(-5*dt);b.spin*=Math.exp(-4*dt);b.pitch+=(Math.PI/2-b.pitch%(Math.PI*2))*(1-Math.exp(-4*dt));if(Math.hypot(b.vx,b.vz)<.08&&Math.abs(b.vy)<.1&&Math.abs(b.spin)<.08){b.active=false;b.pitch=Math.PI/2;}}}}
    setWaypoint(x,z,label='Destination'){if(!finite(x)||!finite(z))return false;const road=this.route.driveNearest?.(x,z)||this.route.nearest(x,z);this.waypoint={x:road.x,z:road.z,label:String(label).slice(0,80),roadId:road.roadId||'main'};return this.waypoint;}
    setRecoveryPoint(x,z,label='Travel checkpoint'){if(!finite(x)||!finite(z))return false;const road=this.route.driveNearest?.(x,z)||this.route.nearest(x,z);this.recoveryPoint={x:road.x,z:road.z,label:String(label).slice(0,80)};return this.recoveryPoint;}
    _placeAtRecoveryPoint(repair=false){
      if(!this.recoveryPoint)return false;const target=this.route.driveNearest?.(this.recoveryPoint.x,this.recoveryPoint.z)||this.route.nearest(this.recoveryPoint.x,this.recoveryPoint.z),path=target.roadId&&target.roadId!=='main'?(this.route.connectors||[]).find(r=>r.id===target.roadId):this.route;if(!path)return false;
      const half=path.halfWidth||this.route.halfWidth,offset=-Math.min(half*.5,Math.max(1,half-this.config.width/2-.3)),base=target.connectorS??target.s;let placement=null;
      for(let i=0;i<80;i++){const at=path.at(base+(i%2?-1:1)*Math.ceil(i/2)*6),candidate={x:at.x+at.nx*offset,y:at.y,z:at.z+at.nz*offset,yaw:at.yaw};if(!this._sceneryClear(candidate,this.config.width,this.config.length,this.config.height)||this.traffic.some(t=>Math.abs(t.y-candidate.y)<3&&boxContact(candidate,t,this.config.width+1,this.config.length+3,t.width,t.length)))continue;placement=candidate;break;}if(!placement)return false;
      const p=this.player,road=this._road(placement.x,placement.z,p.s);Object.assign(p,placement,{s:road.s,offset:road.offset,roadId:road.roadId,vx:0,vz:0,vy:0,speed:0,steer:0,slip:0,yawRate:0,crashYawRate:0,roll:0,pitch:0,gear:0,grounded:true,offRoad:false,driftIntensity:0,suspensionKick:{roll:0,pitch:0,heave:0}});if(repair){p.condition=100;p.damage=freshDamage();p.impacts=[];p.damageRevision++;}Object.assign(this.previousPlayer,p);this.renderPlayer=null;this._contacts.clear();this._encounters.clear();this._recoveryCooldown=1;return true;
    }
    quickTravel(x,z,label='Travel checkpoint'){if(this.finished)return false;const previous=this.recoveryPoint;this.setRecoveryPoint(x,z,label);if(!this._placeAtRecoveryPoint(false)){this.recoveryPoint=previous;return false;}if(this.mode!=='free')this.assisted=true;this._emit({type:'quickTravel',text:'CHECKPOINT SET'});return true;}
    _drivetrain(dt,throttle,brake){
      const p=this.player,c=this.config,ratios=c.gearRatios||[3.36,2.09,1.48,1.12,.88],idle=c.idleRPM||850,redline=c.redlineRPM||6500,final=c.finalDrive||3.45;
      const roadRPM=Math.abs(p.speed)/(TAU*(c.wheelRadius||.34))*60*final;
      let gear=p.gear;if(p.speed<-.45)gear=-1;else if(Math.abs(p.speed)<.30&&!throttle)gear=0;else if(gear<=0)gear=1;
      p.shiftRemaining=Math.max(0,p.shiftRemaining-dt);
      if(gear>0&&p.shiftRemaining<=0){const rpm=roadRPM*ratios[gear-1],up=(c.shiftRPM||5700)*(throttle>.7?1:.84);if(rpm>up&&gear<ratios.length)gear++;else if(gear>1&&rpm<redline*.31&&roadRPM*ratios[gear-2]<redline*.82)gear--;}
      if(gear!==p.gear&&p.gear>0&&gear>0){p.shiftRemaining=c.shiftDuration??.16;p.lastShift=this.time;}
      p.gear=gear;p.shifting=p.shiftRemaining>0;
      const coupled=roadRPM*(gear<0?ratios[0]:ratios[Math.max(0,gear-1)]),launch=idle+throttle*(gear===0?1700:1050),spin=throttle*p.driftIntensity*550;
      const target=clamp(Math.max(launch,coupled+spin)*(p.shifting?.91:1),idle,redline);
      p.engineRPM+=(target-p.engineRPM)*(1-Math.exp(-12*dt));p.rpm=clamp(p.engineRPM/redline,0,1);
      p.engineLoad+=(clamp(throttle*(p.shifting?.35:1)*(1-.2*brake),0,1)-p.engineLoad)*(1-Math.exp(-9*dt));
    }
    _recordContact(id, impact) {
      const previous = this._contacts.get(id), continuous = previous && this.time - previous.lastSeen < .2;
      const priorPeak = continuous ? previous.peak : 0;
      this._contacts.delete(id); this._contacts.set(id, { lastSeen: this.time, peak: Math.max(priorPeak, impact) });
      // Cover the whole 40-car fleet while keeping history bounded on long drives.
      if (this._contacts.size > 1024) this._contacts.delete(this._contacts.keys().next().value);
      if (impact < .8 || continuous && priorPeak > .8 && impact < priorPeak + 3.5) return null;
      return priorPeak;
    }
    _collision(id, impact, scrape = false, details = {}) {
      this._lastRoadContact = this.time;
      this._oncomingProgress=0;this.player.oncoming=false;
      const encounter = this._encounters.get(id); if (encounter) encounter.dirty = true;
      const priorPeak = this._recordContact(id, impact);
      if (priorPeak === null) return null;
      this._collisionTimes.delete(id); this._collisionTimes.set(id, this.time);
      if (this._collisionTimes.size > 128) this._collisionTimes.delete(this._collisionTimes.keys().next().value);
      const event = this.admin?.invincible ? {impact,scrape,damage:0,severity:0,...details} : applyBodyDamage(this.player, this.config.width, this.config.length, impact, scrape, details, priorPeak, this.time, 0, this.damageMode==='cosmetic'?0:this.mode === 'free' ? .5 : 1);
      if (impact > 2) this.multiplier = 1;
      for (const item of this._encounters.values()) item.dirty = true;
      this._emit({ type: 'collision', ...event });
      return priorPeak;
    }
    _damageTraffic(car, impact, scrape, details, priorPeak) {
      applyBodyDamage(car, car.width, car.length, impact, scrape, details, priorPeak, this.time);
      car.crashActive = true; car.recovering = false;
      car.disturbed = Math.max(car.disturbed || 0, Math.min(5, Math.max(1.2, impact * .1)));
      car.wrecked = car.condition <= 12;
      if(car.condition<=0&&!car.destroyed){car.destroyed=true;this._emit({type:'explosion',bodyId:car.id,x:car.x,y:car.y,z:car.z});}
    }
    _sceneryClear(candidate,width,length,height){
      for(const object of this.route.sceneryNear?.(candidate.x,candidate.z,Math.hypot(width,length)/2+1)||[]){if(this.brokenScenery.has(object.id))continue;for(const shape of object.colliders)if(verticallyTouches(candidate,height,shape)&&boxContact(candidate,shape,width,length,shape.width,shape.length))return false;}return true;
    }
    _sceneryDamage(body,width,length,impact,details,once=false,objectId=''){
      const player=body===this.player;
      if(!once){if(player)return this._collision('scenery:'+objectId,impact,impact<3.5,details);const previous=this._recordContact('traffic-scenery:'+body.id+':'+objectId,impact);if(previous!==null)this._damageTraffic(body,impact,impact<3.5,details,previous);return previous;}
      // Fracture has its own exact-once object transition. Do not discard gentle
      // contacts via the old .8m/s repeated-wall-contact gate.
      let event;
      if(player){this._lastRoadContact=this.time;this._oncomingProgress=0;body.oncoming=false;if(impact>2)this.multiplier=1;for(const encounter of this._encounters.values())encounter.dirty=true;
        event=this.admin?.invincible?{impact,damage:0,severity:0,...details}:applyBodyDamage(body,width,length,impact,impact<3.5,details,0,this.time,0,this.damageMode==='cosmetic'?0:this.mode==='free'?.5:1);
        this._emit({type:'collision',...event});
      }else{event=applyBodyDamage(body,width,length,impact,impact<3.5,details,0,this.time);body.crashActive=true;body.recovering=false;body.disturbed=Math.max(body.disturbed||0,.6);body.wrecked=body.condition<=12;if(body.condition<=0&&!body.destroyed){body.destroyed=true;this._emit({type:'explosion',bodyId:body.id,x:body.x,y:body.y,z:body.z});}}
      return event;
    }
    _sceneryContact(body,width,length,object,contact){
      if(this.brokenScenery.has(object.id))return false;
      const preVX=body.vx,preVZ=body.vz,speed=Math.hypot(preVX,preVZ),normalSpeed=Math.max(0,-preVX*contact.nx-preVZ*contact.nz);
      if(object.breakable){
        if(normalSpeed<=SCENERY_TUNING.contactEpsilon)return false;
        // One bounded partial normal impulse breaks the material. It preserves
        // tangential velocity, cannot reverse or add speed, and is never followed
        // by a second wall impulse. Material supports actual scale and speed.
        const fraction=clamp((.018+.028*object.size)*object.resistance*(1+Math.min(75,normalSpeed)*.007),.004,.38);
        this.brokenScenery.add(object.id);this.sceneryRevision++;this.sceneryBreakCount++;
        body.vx+=contact.nx*normalSpeed*fraction;body.vz+=contact.nz*normalSpeed*fraction;
        const afterSpeed=Math.hypot(body.vx,body.vz),energy=Math.max(0,.5*body.mass*(speed*speed-afterSpeed*afterSpeed)),equivalentImpact=Math.sqrt(2*energy/body.mass),condition=body.condition;
        const details={...contact,energy,impulse:body.mass*normalSpeed*fraction,surface:object.kind,objectId:object.id,normalSpeed,speed,tangentSpeed:Math.abs(preVX*-contact.nz+preVZ*contact.nx)};
        this._sceneryDamage(body,width,length,equivalentImpact,details,true,object.id);
        const event={type:'sceneryBreak',id:object.id,objectId:object.id,bodyId:body===this.player?'player':body.id,kind:object.kind,x:object.x,y:object.y,z:object.z,yaw:object.yaw,width:object.width,height:object.height,length:object.length,normalSpeed,speed,size:object.size,damage:Math.max(0,condition-body.condition),velocityLoss:speed-afterSpeed,nx:contact.nx,nz:contact.nz,preVX,preVZ,energy,revision:this.sceneryRevision};
        this._spawnSceneryDebris(object,event);this._emit(event);
      }else{
        const response=resolveImpulse(body,null,contact,{friction:.22});this._sceneryDamage(body,width,length,response.impact,{...contact,...response,surface:object.kind},false,object.id);
        body.x+=contact.nx*(contact.depth+SCENERY_TUNING.separation);body.z+=contact.nz*(contact.depth+SCENERY_TUNING.separation);
      }
      if(body===this.player)body.speed=body.vx*Math.sin(body.yaw)+body.vz*Math.cos(body.yaw);return true;
    }
    _sceneryCollisions(body=this.player,width=body===this.player?this.config.width:body.width,length=body===this.player?this.config.length:body.length,height=body===this.player?this.config.height:sceneryBodyHeight(body)){
      for(const object of this.route.sceneryNear?.(body.x,body.z,Math.hypot(width,length)/2+1)||[]){if(this.brokenScenery.has(object.id))continue;for(const shape of object.colliders){if(!verticallyTouches(body,height,shape))continue;const contact=boxContact(body,shape,width,length,shape.width,shape.length);if(contact&&this._sceneryContact(body,width,length,object,contact)&&object.breakable)break;}}
    }
    _moveSceneryBody(body,width,length,height,dt){
      let remaining=dt,iterations=0;
      while(remaining>1e-10&&iterations++<SCENERY_TUNING.maxContacts){
        const dx=body.vx*remaining,dz=body.vz*remaining;let first=null;
        for(const object of this.route.sceneryNear?.(body.x+dx/2,body.z+dz/2,Math.hypot(width,length)/2+Math.hypot(dx,dz)/2+.01)||[]){
          if(this.brokenScenery.has(object.id))continue;
          for(const shape of object.colliders){if(!verticallyTouches(body,height,shape))continue;const hit=sweepBox(body,shape,width,length,dx,dz);if(!hit)continue;
            const approaching=-body.vx*hit.nx-body.vz*hit.nz>SCENERY_TUNING.contactEpsilon;
            if(object.breakable&&!approaching)continue;if(!object.breakable&&!approaching&&hit.depth<1e-7)continue;
            if(!first||hit.t<first.contact.t-1e-9||Math.abs(hit.t-first.contact.t)<1e-9&&object.id<first.object.id)first={object,contact:hit};
          }
        }
        if(!first){body.x+=dx;body.z+=dz;break;}
        body.x+=dx*first.contact.t;body.z+=dz*first.contact.t;remaining*=1-first.contact.t;
        this._sceneryContact(body,width,length,first.object,first.contact);
      }
      // If a pathological compound traps us, discard only this remaining step;
      // never teleport through the next wall to escape a contact-iteration limit.
    }
    _spawnSceneryDebris(object,event){
      let seed=2166136261;for(const char of object.id)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},direction=Math.hypot(event.preVX,event.preVZ)||1,fallX=event.preVX/direction,fallZ=event.preVZ/direction;
      const push=(kind,index,x,y,z,width,height,length)=>{const a=random()*TAU,launch=Math.min(5,event.normalSpeed*.09),piece={id:object.id+':'+index,objectId:object.id,kind,x,y,z,rx:0,ry:object.yaw,rz:0,width,height,length,vx:fallX*launch+Math.sin(a)*(.3+random()),vy:.4+Math.min(3,event.normalSpeed*.04)+random(),vz:fallZ*launch+Math.cos(a)*(.3+random()),wx:(random()-.5)*3,wy:(random()-.5)*3,wz:(random()-.5)*3,age:0,life:SCENERY_TUNING.debrisLife,settled:false,bounces:0,color:object.color};this.sceneryDebris.push(piece);return piece;};
      if(object.kind==='tree'){
        const tree=push('tree','tree',object.x,object.y,object.z,object.width,object.height,object.length);Object.assign(tree,{rx:0,ry:0,rz:0,vx:0,vy:0,vz:0,wx:0,wy:0,wz:0,fallX,fallZ,fallAngle:0,fallDuration:clamp(1.1+object.height*.035,1.2,2.1)});
        for(let i=0;i<2;i++)push('branch',i,object.x,object.y+Math.min(object.height*.25,2),object.z,.09,.1,Math.min(1.5,object.height*.14));
      }else{const count=object.kind==='rock'?6:object.kind==='bush'?6:5;for(let i=0;i<count;i++){const angle=i/count*TAU,x=object.x+Math.sin(angle)*object.width*.18,z=object.z+Math.cos(angle)*object.length*.18,kind=object.kind==='rock'?'rock':object.kind==='bush'?(i<4?'foliage':'branch'):(object.height>object.width*3?(i<2?'post':'panel'):'panel'),scale=.20+random()*.15;push(kind,i,x,object.y+object.height*(.25+random()*.4),z,Math.max(.04,object.width*scale),Math.max(.04,Math.min(object.height*.32,kind==='post'?2:1.4)),Math.max(.04,object.length*scale));}}
      if(this.sceneryDebris.length>SCENERY_TUNING.debrisLimit)this.sceneryDebris.splice(0,this.sceneryDebris.length-SCENERY_TUNING.debrisLimit);
    }
    _stepSceneryDebris(dt){
      for(const p of this.sceneryDebris){p.age+=dt;if(p.kind==='tree'){const t=clamp(p.age/p.fallDuration,0,1);p.fallAngle=1.48*(t*t*(3-2*t));p.settled=t===1;continue;}if(p.settled)continue;
        p.vy-=9.81*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.rx+=p.wx*dt;p.ry+=p.wy*dt;p.rz+=p.wz*dt;
        const floor=(this.route.surfaceHeight?this.route.surfaceHeight(p.x,p.z):this.route.nearest(p.x,p.z).y)+Math.min(p.width,p.height,p.length)*.3;
        if(p.y<floor){p.y=floor;p.vy=Math.abs(p.vy)*.20;p.vx*=.64;p.vz*=.64;p.wx*=.5;p.wy*=.5;p.wz*=.5;p.bounces++;if(Math.hypot(p.vx,p.vy,p.vz)<.35||p.bounces>12){p.settled=true;p.vx=p.vy=p.vz=p.wx=p.wy=p.wz=0;}}
      }this.sceneryDebris=this.sceneryDebris.filter(p=>p.age<p.life);
    }
    _movePlayer(dt){
      const p=this.player,steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vz)*dt/RAIL_TUNING.ccdStep)),slice=dt/steps;
      for(let i=0;i<steps;i++){this._moveSceneryBody(p,this.config.width,this.config.length,this.config.height,slice);this._barrierCollisions();}
    }
    _supportPlayer(dt,road){
      const p=this.player,c=this.config;
      if(!this.route.surfaceHeight){p.y=road.y;return;}
      // Match the visible wheel pivots; their tire/rim envelopes stay within width.
      const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),rx=fz,rz=-fx,half=c.wheelbase*.5,track=c.width*.435;
      const wheels=[];for(const front of[1,-1])for(const side of[-1,1]){const x=p.x+fx*half*front+rx*track*side,z=p.z+fz*half*front+rz*track*side;wheels.push({x,z,y:this.route.surfaceHeight(x,z,p.s)});}
      p.wheelContacts=wheels;
      const target=wheels.reduce((sum,w)=>sum+w.y,0)/4,pitch=-Math.atan2((wheels[0].y+wheels[1].y-wheels[2].y-wheels[3].y)/2,c.wheelbase),roll=Math.atan2((wheels[1].y+wheels[3].y-wheels[0].y-wheels[2].y)/2,track*2);
      if(!finite(p.vy))p.vy=0;const drop=p.y-target;
      if(drop<.18&&p.vy<=Math.max(1,(target-p.y)/Math.max(dt,.001))){p.vy=0;p.y=target;p.grounded=true;}else{p.vy-=9.81*dt;p.y+=p.vy*dt;p.grounded=false;if(p.y<=target){p.y=target;p.vy=0;p.grounded=true;}}
      p.terrainPitch=pitch;p.terrainRoll=roll;
      const extent=this.route.terrainGrid().extent-3;
      if(Math.abs(p.x)>extent){p.x=clamp(p.x,-extent,extent);p.vx*=-.15;}if(Math.abs(p.z)>extent){p.z=clamp(p.z,-extent,extent);p.vz*=-.15;}
    }
    _breakRail(rail,body,impact,contact){
      if(this.admin?.invincibleRailGuards||!rail.breakable||this.brokenRails.has(rail.id)||impact<RAIL_TUNING.breakSpeed)return false;
      this.brokenRails.add(rail.id);this.railRevision++;this.railBreakCount++;
      const fx=Math.sin(rail.yaw),fz=Math.cos(rail.yaw),power=clamp(impact,0,40),seed=rail.index*2.399;
      for(let i=0;i<3;i++){
        const along=i<2?(i-.5)*rail.length*.5:-rail.length*.4,phase=seed+i*2.19;
        this.railDebris.push({kind:i<2?'beam':'post',id:rail.id+':'+i,x:rail.x+fx*along,y:rail.y+(i<2?.69:.4),z:rail.z+fz*along,length:i<2?rail.length*.5:.78,rx:0,ry:rail.yaw,rz:0,vx:body.vx*(.48+i*.06)+Math.sin(phase)*1.4,vy:clamp(2.2+power*.12+(i%2)*.8,RAIL_TUNING.launchMin,RAIL_TUNING.launchMax),vz:body.vz*(.48+i*.06)+Math.cos(phase)*1.4,wx:Math.sin(phase)*3,wz:Math.cos(phase)*3,wy:clamp(((contact.x-rail.x)*body.vz-(contact.z-rail.z)*body.vx)*.1,-4,4),age:0,settled:false,bounces:0});
      }
      while(this.railDebris.length>RAIL_TUNING.debrisLimit)this.railDebris.shift();
      this._emit({type:'railBreak',id:rail.id,impact,x:contact.x,y:rail.y+.6,z:contact.z});return true;
    }
    _stepRailDebris(dt){
      const surface=(x,z)=>this.route.surfaceHeight?this.route.surfaceHeight(x,z):this.route.nearest(x,z).y;
      for(const piece of this.railDebris){piece.age+=dt;if(piece.settled)continue;piece.vy-=9.81*dt;piece.x+=piece.vx*dt;piece.y+=piece.vy*dt;piece.z+=piece.vz*dt;piece.rx+=piece.wx*dt;piece.ry+=piece.wy*dt;piece.rz+=piece.wz*dt;
        const reach=piece.length*.5,ax=Math.cos(piece.rx),bx=Math.sin(piece.rx),cy=Math.cos(piece.ry),dy=Math.sin(piece.ry),ez=Math.cos(piece.rz),fz=Math.sin(piece.rz),dx=(piece.kind==='beam'?dy*ax:dy*bx*ez-cy*fz)*reach,dz=(piece.kind==='beam'?cy*ax:dy*fz+cy*bx*ez)*reach,vertical=(piece.kind==='beam'?-bx:ax*ez)*reach,floor=Math.max(surface(piece.x,piece.z),surface(piece.x+dx,piece.z+dz)-vertical,surface(piece.x-dx,piece.z-dz)+vertical)+.06;
        if(piece.y<floor){piece.y=floor;piece.vy=Math.abs(piece.vy)*.25;piece.vx*=.71;piece.vz*=.71;piece.wx*=.56;piece.wy*=.56;piece.wz*=.56;piece.bounces++;if(Math.hypot(piece.vx,piece.vy,piece.vz)<.5||piece.bounces>16){piece.settled=true;piece.vx=piece.vy=piece.vz=piece.wx=piece.wy=piece.wz=0;}}
      }
      this.railDebris=this.railDebris.filter(p=>p.age<RAIL_TUNING.debrisLife);
    }
    _barrierCollisions() {
      const p=this.player,c=this.config;
      if(!this.route.railsNear)return;
      for(const rail of this.route.railsNear(p.x,p.z,Math.hypot(c.width,c.length)*.5+5)){
        if(this.brokenRails.has(rail.id)||p.y>rail.y+rail.height||p.y+1.4<rail.y)continue;
        const contact=boxContact(p,rail,c.width,c.length,rail.width,rail.length);if(!contact)continue;
        const impact=Math.max(0,-p.vx*contact.nx-p.vz*contact.nz),tangentSpeed=Math.abs(p.vx*-contact.nz+p.vz*contact.nx);
        if(this._breakRail(rail,p,impact,contact)){
          // Fracture before the solid-wall impulse: preserve useful forward momentum.
          p.vx+=contact.nx*impact*RAIL_TUNING.resistance;p.vz+=contact.nz*impact*RAIL_TUNING.resistance;
          this._collision('rail-'+rail.id,impact*.42,false,{...contact,surface:'guardrail'});continue;
        }
        const response=resolveImpulse(p,null,contact,{friction:.2});this._collision('rail-'+rail.id,response.impact,response.impact<5&&tangentSpeed>response.impact*2,{...contact,...response,tangentSpeed,surface:rail.breakable?'guardrail':'tunnel'});p.x+=contact.nx*(contact.depth+.003);p.z+=contact.nz*(contact.depth+.003);
      }
    }
    _obstacleCollisions(){this._sceneryCollisions();const p=this.player,c=this.config;for(const obstacle of this.route.obstacles||[]){if(this.route.sceneryById?.has(obstacle.id))continue;const radius=(Math.hypot(c.width,c.length)+Math.hypot(obstacle.width,obstacle.length))/2;if((p.x-obstacle.x)**2+(p.z-obstacle.z)**2>radius*radius||!verticallyTouches(p,c.height,{y:obstacle.y||0,height:obstacle.height||3}))continue;const contact=boxContact(p,obstacle,c.width,c.length,obstacle.width,obstacle.length);if(!contact)continue;const response=resolveImpulse(p,null,contact,{friction:.3});this._collision(obstacle.id,response.impact,false,{...contact,...response,surface:obstacle.kind});p.x+=contact.nx*(contact.depth+.003);p.z+=contact.nz*(contact.depth+.003);}}
    _trafficCollisions() {
      const p = this.player, c = this.config;
      for (const car of this.traffic) {
        const radius = Math.hypot(c.width, c.length) / 2 + Math.hypot(car.width, car.length) / 2 + .05;
        if (Math.abs((car.y||0)-(p.y||0))>2.5 || p.roadId==='main'&&Math.abs(shortest(car.s - p.s, this.route.length)) > 13 || (car.x - p.x) ** 2 + (car.z - p.z) ** 2 > radius * radius) continue;
        const contact = boxContact(p, car, c.width, c.length, car.width, car.length);
        if (!contact) continue;
        if (!finite(car.vx) || !finite(car.mass)) this._locateTraffic(car);
        const tangentSpeed = Math.abs((p.vx - car.vx) * -contact.nz + (p.vz - car.vz) * contact.nx);
        const response = resolveImpulse(p, car, contact, { friction: .34 });
        const scrape = response.impact < 4 && tangentSpeed > response.impact * 2;
        const priorPeak = this._collision(car.id, response.impact, scrape, { ...contact, ...response, tangentSpeed });
        if (priorPeak !== null) this._damageTraffic(car, response.impact, scrape, { ...contact, ...response, nx: -contact.nx, nz: -contact.nz, tangentSpeed }, priorPeak);
        const playerShare = car.mass / (p.mass + car.mass), otherShare = 1 - playerShare;
        p.x += contact.nx * (contact.depth + .008) * playerShare; p.z += contact.nz * (contact.depth + .008) * playerShare;
        car.x -= contact.nx * (contact.depth + .008) * otherShare; car.z -= contact.nz * (contact.depth + .008) * otherShare;
        this._syncTrafficPose(car);
        if (response.impact > 1) car.disturbed = Math.max(car.disturbed || 0, Math.min(4, response.impact * .1));
        if (car.crashActive) {this._trafficBarrierCollisions(car);this._sceneryCollisions(car);this._syncTrafficPose(car);}
      }
    }
    _scoreOncoming(road,previousRoad,oldX,oldZ,drivenStep){
      const p=this.player,c=this.config,speed=Math.hypot(p.vx,p.vz),forward=p.vx*road.tx+p.vz*road.tz,heading=shortest(p.yaw-road.yaw,TAU),footprint=Math.abs(Math.cos(heading))*c.width/2+Math.abs(Math.sin(heading))*c.length/2;
      const lanes=routeLanes(this.route),lane=lanes.reduce((best,lane)=>Math.abs(lane.offset-road.offset)<Math.abs(best.offset-road.offset)?lane:best,lanes[0]),laneDirection=lane.direction,travelDirection=Math.sign(forward),moved=Math.hypot(p.x-oldX,p.z-oldZ);
      p.oncoming=this.mode!=='trial'&&road.roadId==='main'&&previousRoad.roadId==='main'&&p.speed>10&&speed>10&&Math.abs(forward)>speed*.8&&travelDirection!==laneDirection&&Math.sign(previousRoad.offset)===Math.sign(road.offset)&&Math.abs(road.offset)>footprint+.15&&Math.abs(road.offset)+footprint<road.halfWidth-.05&&this.time-this._lastRoadContact>1&&drivenStep>0&&moved<=drivenStep+.05;
      if(!p.oncoming){this._oncomingProgress=0;return;}
      const distance=Math.min(moved,drivenStep);this.oncomingDistance+=distance;this._oncomingProgress+=distance;
      if(this._oncomingProgress>=25){const count=Math.floor(this._oncomingProgress/25),points=count*Math.round(50*(this.mode==='rush'?this.multiplier:1));this._oncomingProgress-=count*25;this.oncomingPoints+=points;this.score+=points;this._emit({type:'oncoming',points,text:'ONCOMING +'+points+' PTS'});}
    }
    _scorePasses() {
      const p = this.player;
      for (const car of this.traffic) {
        if (this._passed.has(car.id)) continue;
        const relative = shortest(car.s - p.s, this.route.length);
        let encounter = this._encounters.get(car.id);
        if (!encounter && relative > 9 && relative < 64) {
          encounter = { minGap: Infinity, dirty: false, armedAt: this.time, speed: 0 }; this._encounters.set(car.id, encounter);
        }
        if (!encounter) continue;
        if (Math.abs(relative) < (car.length + this.config.length) / 2 + 2) {
          encounter.minGap = Math.min(encounter.minGap, Math.abs(car.offset - p.offset) - (car.width + this.config.width) / 2);
          encounter.speed = Math.max(encounter.speed, p.speed);
          if (Math.abs(p.offset) > this.route.halfWidth + .1) encounter.dirty = true;
        }
        if (relative < -(car.length + this.config.length) / 2 - 2 && relative > -65) {
          this._passed.add(car.id); this._encounters.delete(car.id);
          if (encounter.dirty || encounter.minGap < .05 || encounter.minGap > 7 || encounter.speed < 60 / 3.6 || p.speed < 60 / 3.6 || Math.abs(p.offset) > this.route.halfWidth + .1 || this._offroadTime > 0) continue;
          const points = Math.round(100 * this.multiplier); this.score += points; this.overtakes++;
          this._emit({ type: 'pass', points, text: 'CLEAN PASS +' + points });
          if (encounter.minGap < 1.3) { const bonus = Math.round(150 * this.multiplier); this.score += bonus; this.nearMisses++; this._emit({ type: 'nearMiss', points: bonus, text: 'NEAR MISS +' + bonus }); }
          if (this.overtakes % 3 === 0) this.multiplier = Math.min(5, this.multiplier + .25);
          this._lastAction = this.time; this._decayAt = this.time + 8;
        } else if (relative > 100 || this.time - encounter.armedAt > 30) this._encounters.delete(car.id);
      }
    }
    _checkpoints(previousS, currentS) {
      if (this.checkpointIndex >= this.checkpoints.length) return;
      const delta = shortest(currentS - previousS, this.route.length);
      if (delta <= 0 || delta > 12 || Math.abs(this.player.offset) > this.route.halfWidth + .35) return;
      const target = wrap(this.checkpoints[this.checkpointIndex], this.route.length);
      const ahead = wrap(target - previousS, this.route.length);
      if (ahead > delta + 1e-6 || ahead < 1e-7 && this.checkpointIndex === 0) return;
      this.checkpointIndex++;
      this._emit({ type: 'checkpoint', index: this.checkpointIndex, text: this.checkpointIndex === this.checkpoints.length ? 'FINISH' : 'CHECKPOINT ' + this.checkpointIndex + ' / ' + this.checkpoints.length });
      if (this.checkpointIndex === this.checkpoints.length) this.finish('complete');
    }
    recovery() {
      if (this.finished || this._recoveryCooldown > 0) return false;
      if(this.recoveryPoint){const moved=this._placeAtRecoveryPoint(this.mode==='free');if(moved){if(this.mode!=='free')this.assisted=true;this._emit({type:'recovery',penalty:0,repaired:this.mode==='free',text:'BACK TO TRAVEL CHECKPOINT'});}return moved;}
      const p = this.player, condition = this.mode==='free'?100:p.condition;
      let s = this.mode === 'trial' ? (this.checkpointIndex ? this.checkpoints[this.checkpointIndex - 1] + 8 : 0) : p.s;
      const safeLanes=routeLanes(this.route).filter(lane=>lane.direction===1).map(lane=>lane.offset);let laneIndex=0,offset=safeLanes[0],clear=false;
      // A nearby empty forward-lane position, never into another road user.
      for (let tries = 0; tries < Math.ceil(this.route.length/12)*safeLanes.length; tries++) {
        const candidate=this.route.at(s),x=candidate.x+candidate.nx*offset,z=candidate.z+candidate.nz*offset;
        if (this._sceneryClear({x,y:candidate.y,z,yaw:candidate.yaw},this.config.width,this.config.length,this.config.height)&&!this.traffic.some(t => Math.abs(t.y-candidate.y)<2.5 && (Math.abs(shortest(t.s - s, this.route.length)) < 32 && Math.abs(t.offset - offset) < 2.5 || Math.hypot(t.x-x,t.z-z)<(t.length+this.config.length)/2+2))) {clear=true;break;}
        laneIndex++;if(laneIndex>=safeLanes.length){laneIndex=0;s=wrap(s-12,this.route.length);}offset=safeLanes[laneIndex];
      }
      if(!clear)return false;
      const road = this.route.at(s);
      Object.assign(p, { x: road.x + road.nx * offset, y: road.y, z: road.z + road.nz * offset, yaw: road.yaw, s: road.s, offset, vx: 0, vz: 0, speed: 0, steer: 0, slip: 0, yawRate: 0, crashYawRate: 0, suspensionKick: { roll: 0, pitch: 0, heave: 0 }, driftIntensity: 0, offRoad: false, roll: 0, pitch: 0, gear: 0, condition });
      Object.assign(p,{roadId:'main',engineRPM:this.config.idleRPM||850,rpm:(this.config.idleRPM||850)/(this.config.redlineRPM||6500),shiftRemaining:0,shifting:false});
      if(this.mode==='free'){p.damage=freshDamage();p.impacts=[];p.damageRevision++;}
      Object.assign(this.previousPlayer,p);this.renderPlayer=null;
      this._contacts.clear();
      this.multiplier = 1; this._offroadTime = 0; this._encounters.clear(); this._recoveryCooldown = 1;this._oncomingProgress=0;p.oncoming=false;
      if (this.mode === 'trial') this.penalty += 5;
      if (this.mode === 'rush') { this.penalty += 5; this.remaining = Math.max(0, this.remaining - 5); this.score = Math.max(0, this.score - 200); }
      this._emit({ type: 'recovery', penalty: this.mode === 'free' ? 0 : 5,repaired:this.mode==='free', text: this.mode === 'trial' ? 'RECOVERY +5.00 s' : this.mode === 'rush' ? 'RECOVERY −200 POINTS / −5 s' : 'REPAIRED · BACK ON THE ROAD' });
      if (this.mode === 'rush' && this.remaining <= 0) this.finish('complete');
      return true;
    }
    finish(reason = 'complete') {
      if (this.result) return this.result;
      if (reason==='complete' && this.mode === 'trial' && this.checkpointIndex < this.checkpoints.length) return null;
      this.finished = true;
      const time = this.time + (this.mode === 'trial' ? this.penalty : 0);
      const medal = this.mode !== 'trial' ? null : time <= this.medalThresholds.gold ? 'gold' : time <= this.medalThresholds.silver ? 'silver' : time <= this.medalThresholds.bronze ? 'bronze' : 'finisher';
      this.result = Object.freeze({ id: this.id, mode: this.mode, reason, completed: reason === 'complete', assisted:this.assisted===true, time, rawTime: this.time, penalty: this.penalty, score: Math.round(this.score), overtakes: this.overtakes, nearMisses: this.nearMisses, distance: this.distance, condition: this.player.condition, medal, configKey: this.config.configKey || this.config.key,mapId:this.route.mapId||'coastline',routeId:'main',damageMode:this.damageMode,rulesVersion:RULES_VERSION,recordKey:this.recordKey });
      this._emit({ type: 'finish', result: this.result }); return this.result;
    }
  }
  const SMOKE_COLORS=[{id:'white',name:'Factory white',color:'#d9dedb',price:0},...Object.entries({red:'#ef4841',orange:'#fa9138',yellow:'#ffe051',green:'#6ae476',blue:'#45a9ff',purple:'#ad72f2',pink:'#ff7bb7'}).map(([id,color])=>({id,name:id[0].toUpperCase()+id.slice(1),color,price:300})),{id:'galaxy',name:'Galaxy · stars & planets',color:'#ad67ed',price:1800},{id:'gold',name:'Golden · sparkles',color:'#ffd56b',price:1200}];
  function purchaseSmoke(save,color,car=save.selected){const item=SMOKE_COLORS.find(x=>x.id===color);if(!item||!save.owned.includes(car))return{ok:false,reason:'Own this car first.'};save.ownedSmoke??=['white'];save.smoke??={};if(!save.ownedSmoke.includes(color)){if(save.credits<item.price)return{ok:false,reason:'More credits needed.'};save.credits-=item.price;save.ownedSmoke.push(color);}save.smoke[car]=color;return{ok:true};}
  function settleDriftCredits(save,sim){if(!(sim instanceof Simulation)||!finite(sim.driftDistance)||sim.driftDistance<0)return{awarded:false,credits:0};const total=Math.floor(sim.driftDistance)*2,owed=total-(sim.driftCredits||0);if(owed<=0||!Number.isFinite(save.credits+owed))return{awarded:false,credits:0};save.credits+=owed;sim.driftCredits=total;return{awarded:true,credits:owed,totalEarned:total};}
  function settleFreeDriveCredits(save, sim) {
    const eligible = sim instanceof Simulation && sim.mode === 'free' ? sim.eligibleDistance : 0;
    const remainder = eligible % 100, nextRewardDistance = remainder < 1e-7 || 100 - remainder < 1e-7 ? 100 : 100 - remainder;
    const report = { awarded: false, credits: 0, totalEarned: sim instanceof Simulation && sim.mode === 'free' ? sim.freeDriveCredits : 0, nextRewardDistance, eligibleDistance: eligible };
    if (!(sim instanceof Simulation) || sim.mode !== 'free' || !finite(eligible) || eligible < 0 || !Number.isInteger(save.credits) || save.credits < 0) return report;
    const earned = Math.floor((eligible + 1e-7) / 100) * 50, owed = earned - sim.freeDriveCredits;
    if (owed <= 0) return report;
    const credits = Number.isFinite(save.credits+owed)?owed:0;
    save.credits += credits; sim.freeDriveCredits = earned;
    return { ...report, awarded: credits > 0, credits, totalEarned: sim.freeDriveCredits };
  }
  function settleResult(save, result, configKey = result && result.configKey) {
    const scoped=!!result?.recordKey,key=result?.recordKey;
    if(!save.records)save.records={trial:{},rush:{}};
    const values=()=>({bestScore:scoped?save.records.rush[key]||0:save.bestRush,bestTime:scoped?save.records.trial[key]||null:save.bestTimes[configKey]||null});
    const none = { awarded: false, credits: 0, record: false,...values() };
    if (!result || typeof result.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(result.id) || !['rush', 'trial'].includes(result.mode) || save.settledRuns.includes(result.id)) return none;
    if (!finite(result.time) || result.time < 0 || !finite(result.score) || result.score < 0 || !finite(result.distance) || result.distance < 0 || !Number.isInteger(result.overtakes) || result.overtakes < 0) return none;
    if(scoped&&!validRecordKey(key))return none;
    if (result.mode === 'trial' && (!result.completed || !validConfigKey(configKey))) return none;
    let credits = 0, record = false;
    if (result.mode === 'rush') {
      credits = Math.min(7200, Math.floor((result.completed ? 660 : 150) + result.score * .24 + Math.min(result.distance, 6000) * .075));
      if(!result.assisted&&scoped){if(result.score>(save.records.rush[key]||0)){save.records.rush[key]=Math.round(result.score);record=true;}}else if (!result.assisted&&result.score > save.bestRush) { save.bestRush = Math.round(result.score); record = true; }
    } else {
      credits = 1050 + ({ gold: 660, silver: 360, bronze: 150, finisher: 0 }[result.medal] || 0);
      if(!result.assisted&&scoped){if(!save.records.trial[key]||result.time<save.records.trial[key]){save.records.trial[key]=result.time;record=true;}}else if (!result.assisted&&(!save.bestTimes[configKey] || result.time < save.bestTimes[configKey])) { save.bestTimes[configKey] = result.time; record = true; }
    }
    // Keep every settlement ID: pruning old entries would allow an old result to pay twice.
    if(Number.isFinite(save.credits+credits))save.credits += credits; save.settledRuns.push(result.id);
    return { awarded: true, credits, record,...values() };
  }
  const performanceCache=new Map();
  function getPerformanceStats(config){
    const key=[config.configKey,config.accel,config.maxSpeed,config.brake,config.grip,config.steerRate,config.steeringMultiplier,config.dragCoefficient,config.shiftDuration].join(':');
    if(performanceCache.has(key))return{...performanceCache.get(key)};
    const straight={length:1e6,width:20000,halfWidth:10000,barrierOffset:10002,mapId:'coastline',at(s){return{s,x:0,y:0,z:s,yaw:0,tx:0,tz:1,nx:1,nz:0};},nearest(x,z){return{...this.at(z),offset:x,distance:Math.abs(x)};}};
    const run=new Simulation(straight,config,{mode:'trial'});let zeroTo100=null;
    for(let i=0;i<2400;i++){run.step(1/120,{throttle:1});if(run.player.speed>=100/3.6){zeroTo100=run.time;break;}}
    const stop=new Simulation(straight,config,{mode:'trial'});Object.assign(stop.player,{vx:0,vz:100/3.6,speed:100/3.6});const start=stop.player.z;
    for(let i=0;i<1800&&stop.player.speed>.6;i++)stop.step(1/120,{brake:1});
    const result={topSpeed:Math.min(config.maxSpeed,Math.sqrt(Math.max(0,config.accel-.19)/((config.dragCoefficient||.0013)+.35*config.accel/config.maxSpeed**2))),acceleration:config.accel-.19,traction:config.grip,steering:(3.2+(config.steerRate-8.6)*.15)*(config.steeringMultiplier||1),braking:config.brake,zeroTo100,stoppingDistance:stop.player.z-start};
    if(performanceCache.size>=256)performanceCache.delete(performanceCache.keys().next().value);performanceCache.set(key,result);return{...result};
  }
  return { SMOKE_COLORS,purchaseSmoke,settleDriftCredits,RAIL_TUNING,SCENERY_TUNING,SCENERY_KINDS,CARS, PAINTS,PARTS,PART_CATEGORIES,PAINT_LIMIT,MAPS,RULES_VERSION,BREAKAWAY_PARTS,recordKey,bestRecord,validRecordKey,validConfigKey, DEFAULT_BINDINGS, MEDAL_THRESHOLDS, UPGRADE_PRICES, createDefaultSave, validateSave, purchaseCar, buyUpgrade,purchasePart,equipPart,setPaintColor,addPaintStroke,undoPaint,clearPaint,getPerformanceStats, getConfig, Route, Simulation, settleResult, settleFreeDriveCredits, clamp, wrap, shortest, steeringLimit, Collision: { boxContact,sweepBox, resolveImpulse, corners, inertia } };
});


