/* Published release facts from the verified V10/V11 release reports. Images are unmodified in-game captures. */
window.PlatdoReleaseData=[{"id":"v11-home-phone","version":11,"date":"2026-10-28","major":true,"title":"Home, style and the city in your pocket","summary":"Your starter house connects a personal garage, wardrobe and functional phone to the rest of Platdo.","details":["Explore the furnished two-storey starter house and enter Drive with your current garage car.","Buy and equip clothing, save outfits, and share your appearance between City and Drive.","Take rear-camera and selfie photos, record and play videos, and keep albums in the phone gallery.","Shop for owned vehicles and arrange delivery with LINK. Customize vehicles at the mechanic and choose saved finishes in Drive.","Choose Touch or Keyboard independently for each game; City adds analog mobile movement and simultaneous driving and camera controls.","City and Drive skies include changing weather; City adds distant birds."],"thumbnailAlt":"The actual Platdo City starter house and front garden","thumbnail":"assets/images/2aed43d5ac43af8da53a.png"},{"id":"v10-injuries","version":10,"date":"2026-10-26","major":true,"title":"Crash occupants and localized impacts","summary":"City injury settings and physical Drive occupants respond to the actual impact.","details":["City graphics adds four injury-effect settings with localized impacts and bounded detached-part effects.","Drive gains configurable vehicle occupants and a Traffic drivers only override.","Occupants react to crashes using passive articulated bodies, cabin and road contacts, settling and windshield ejection.","Settings apply immediately and preserve your selected intensity through graphics recommendations."],"thumbnailAlt":"Passengers seated in an actual Platdo Drive touring car","thumbnail":"assets/images/a09aa4773af5f56d58e5.png"}];

/* Read-only collection statistics and the release feed. Saved values are never invented. */
(function (global) {
  'use strict';
  const games = [['platdo-drive','Drive'],['platdo-jump','Jump'],['platdo-swing','Swing'],['field','Code Platdo'],['platdo-city','City'],['god-core','Godcore']];
  const views = new Map();
  const updateDrafts = new Map();
  let serial = 0;
  const own = (v,k) => !!v && Object.prototype.hasOwnProperty.call(v,k);
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const arr = v => Array.isArray(v) ? v : [];
  const num = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  const number = v => num(v) === null ? 'Not recorded' : v.toLocaleString(undefined,{maximumFractionDigits:2});
  const count = v => Array.isArray(v) ? v.length : null;
  const duration = v => num(v) === null ? 'Not recorded' : (v >= 3600 ? Math.floor(v/3600)+':' : '') + String(Math.floor(v/60)%60).padStart(v>=3600?2:1,'0')+':'+(v%60).toFixed(2).padStart(5,'0');
  const date = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString() : 'Not recorded';
  const human = v => typeof v === 'string' ? v.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : 'Not recorded';
  const sum = (items,key) => items.every(v=>num(v[key])!==null) ? items.reduce((a,v)=>a+v[key],0) : null;
  const accuracy = (hits,shots) => num(hits)===null || num(shots)===null ? 'Not recorded' : shots===0 ? 'No shots fired' : (Math.min(1,hits/shots)*100).toFixed(1)+'%';
  function read(id,key,legacy=false) {
    try {
      const raw = legacy ? global.localStorage.getItem(key) : global.Platdo?.storage(id).get(key);
      if (raw == null) return {value:null,status:'missing'};
      const value=JSON.parse(raw);
      return value && typeof value==='object' ? {value,status:'saved'} : {value:null,status:'invalid'};
    } catch (_) { return {value:null,status:'unreadable'}; }
  }
  const metric = (label,value,format=number) => ({label,value:format(value)});
  const group = (title,metrics=[],table=null,note='') => ({title,metrics,table,note});
  const table = (columns,rows) => ({columns,rows});
  const sourceNote = status => status==='missing' ? 'No saved progress yet. Play this game to begin recording statistics.' : status==='saved' ? 'From recorded game saves. Missing fields are shown as “Not recorded”.' : 'This saved progress could not be read. It has not been changed.';
  function drive() {
    const source=read('platdo-drive','progress-v1'),s=obj(source.value),groups=[];
    if(source.value) {
      const names=global.DriveCore?.CARS||{},carName=id=>names[id]?.name||human(id);
      groups.push(group('Garage and progress',[
        metric('Balance',s.credits,v=>num(v)===null?'Not recorded':number(v)+' CR'),metric('Owned vehicles',count(s.owned)),
        metric('Selected vehicle',s.selected,carName),metric('Last road',s.selectedMap,human),
        metric('Drift distance',s.lifetimeDriftMetres,v=>num(v)===null?'Not recorded':(s.settings?.units==='kmh'?(v/1000).toFixed(2)+' km':(v/1609.344).toFixed(2)+' mi')),
        metric('Owned smoke colors',count(s.ownedSmoke)),metric('Owned finishes',count(s.ownedWraps))
      ],table(['Vehicle','Engine level','Tire level','Brake level','Smoke / finish'],arr(s.owned).map(id=>[carName(id),number(s.upgrades?.[id]?.engine),number(s.upgrades?.[id]?.tires),number(s.upgrades?.[id]?.brakes),human(s.smoke?.[id])+' / '+human(typeof s.wraps?.[id]==='string'?s.wraps[id]:s.wraps?.[id]?.finishId)]))));
      const rows=[];
      for(const [kind,items] of Object.entries(obj(s.records)))for(const [key,value] of Object.entries(obj(items))) {
        const split=key.split(':'),map=split[1],setup=split[3],damage=split[4];
        rows.push([kind==='trial'?'Time Trial':'Traffic Rush',global.DriveMaps?.get?.(map)?.name||human(map),setup||key,kind==='trial'?duration(typeof value==='number'?value:value?.time):number(typeof value==='number'?value:value?.score),human(damage)]);
      }
      groups.push(group('Driving records',[],table(['Mode','Road','Vehicle setup','Best result','Damage rule'],rows),'Records remain separate for different cars, parts, roads and driving rules.'));
      const old=Object.entries(obj(s.bestTimes)).map(([key,v])=>[key,duration(v)]);
      if(old.length||num(s.bestRush)>0)groups.push(group('Earlier driving rules',[metric('Original Traffic Rush best',s.bestRush)],table(['Setup','Time'],old),'These preserved records use the previous driving rules.'));
    }
    return {id:'platdo-drive',title:'Drive',status:source.status,groups};
  }
  function jump() {
    const source=read(null,'platdo_full_save_v1',true),s=obj(source.value),high=read(null,'platdo_level_high_scores',true),records=obj(high.value||s.levelHighScores),groups=[];
    if(source.value||high.value) {
      const campaign=Object.entries(records).filter(([k,v])=>k.startsWith('campaign:')&&num(v)!==null),custom=Object.entries(records).filter(([k,v])=>k.startsWith('custom:')&&num(v)!==null);
      const hasScores=!!(high.value||s.levelHighScores),money=v=>num(v)===null?'Not recorded':'$'+number(v);
      groups.push(group('Campaign and collection',[metric('Cash',s.score,money),metric('Highest unlocked level',num(s.maxUnlockedLevel)===null?null:s.maxUnlockedLevel+1),metric('Levels with a saved best score',hasScores?campaign.length:null),metric('Campaign best-score total',hasScores?campaign.reduce((a,[,v])=>a+v,0):null,money),metric('Custom levels saved',count(s.customLevels)),metric('Custom best-score total',hasScores?custom.reduce((a,[,v])=>a+v,0):null,money),metric('Colors unlocked',count(s.unlockedColors)),metric('Trails unlocked',count(s.unlockedTrails)),metric('Themes unlocked',count(s.unlockedThemes))]));
      groups.push(group('Saved level scores',[],table(['Level','Best score'],[...campaign.map(([k,v])=>['Campaign '+(Number(k.split(':')[1])+1),'$'+number(v)]),...custom.map(([k,v])=>[arr(s.customLevels).find(l=>l.id===k.slice(7))?.name||'Custom '+k.slice(7),'$'+number(v)])]),'Only completed levels with a stored best score appear here.'));
      groups.push(group('Loadout',[],table(['Weapon','Ammunition','Magazine'],Object.entries(obj(s.inventory)).map(([id,v])=>[human(id),number(v),number(s.magazines?.[id])]))));
    }
    return {id:'platdo-jump',title:'Jump',status:source.value||high.value?'saved':source.status,groups};
  }
  function swing() {
    const source=read('platdo-swing','profile-v1'),s=obj(source.value),levels=Object.entries(obj(s.levels)),groups=[];
    if(source.value) {
      const hasLevels=!!s.levels,stars=hasLevels?levels.reduce((a,[,v])=>a+arr(v.stars).filter(x=>x===true).length,0):null;
      groups.push(group('Canopy progress',[metric('Paths completed',hasLevels?levels.filter(([,v])=>v.stars?.[0]===true).length:null),metric('Stars collected',stars),metric('Golden seeds',hasLevels?levels.filter(([,v])=>v.stars?.[2]===true).length:null),metric('Achievements',count(s.achievements)),metric('Monkeys used',count(s.usedMonkeys)),metric('Current monkey',s.selected,human)]));
      groups.push(group('Path records',[],table(['Path','Stars','Best bananas','Best score','Standard time','Assisted time'],levels.map(([id,v])=>[human(id),arr(v.stars).filter(x=>x===true).length+'/3',number(v.bestBananas),number(v.bestScore),duration(v.times?.standard),duration(v.times?.assisted)]))));
      const endless=[];for(const kind of ['standard','assisted'])for(const r of arr(s.endless?.[kind]))endless.push([human(kind),number(r.distance)+' m',number(r.score),number(r.bananas),number(r.seed)]);
      groups.push(group('Endless Canopy',[],table(['Rules','Distance','Score','Bananas','Seed'],endless),'Standard and assisted records are kept separate. The game retains up to five runs per category.'));
      groups.push(group('Achievements',[],table(['Unlocked'],arr(s.achievements).map(id=>[human(id)]))));
    }
    return {id:'platdo-swing',title:'Swing',status:source.status,groups};
  }
  const wave = r => Math.max(num(r.wave)||0,num(r.completedWaves)||0);
  const ratio = r => num(r.shots)>0 && num(r.hits)!==null ? Math.min(1,r.hits/r.shots) : 0;
  const ranked = (a,b) => wave(b)-wave(a)||ratio(b)-ratio(a)||(num(b.hits)||0)-(num(a.hits)||0)||(num(a.seconds)??Infinity)-(num(b.seconds)??Infinity);
  function shooter(id) {
    const god=id==='god-core',source=read(id,'runs'),all=arr(source.value).filter(r=>r&&typeof r==='object'),groups=[];
    const runs=god?all.filter(r=>r.completed===true&&num(r.seconds)>0&&r.assisted!==true).sort((a,b)=>a.seconds-b.seconds):all;
    if(source.value) {
      groups.push(group(god?'Completed speedruns':'Recorded runs',[
        metric(god?'Ranked finishes':'Runs recorded',runs.length),metric(god?'Fastest gameplay time':'Recorded play time',god?(runs[0]?.seconds??null):sum(runs,'seconds'),duration),
        ...(!god?[metric('Highest wave',runs.length?Math.max(...runs.map(wave)):null),metric('Shots fired',sum(runs,'shots')),metric('Shots that hit',sum(runs,'hits')),metric('Shot accuracy',accuracy(sum(runs,'hits'),sum(runs,'shots')),v=>v),metric('Enemies defeated',sum(runs,'kills')),metric('Targets hit',sum(runs,'targets'))]:[])
      ],null,god?'Only completed, unassisted runs rank here. Shortest gameplay time is first; cutscenes and pauses are excluded.':'Totals cover saved run history. Rank is highest wave, then accuracy, then hits and time.'));
      if(god)groups.push(group('Leaderboard',[],table(['Rank','Gameplay time','Finished'],runs.map((r,i)=>[i+1,duration(r.seconds),date(r.ended)]))));
      else for(const mode of ['normal','friendly','retro','practice']) {
        const subset=runs.filter(r=>mode==='friendly'?r.friendly===true:r.mode===mode&&r.friendly!==true).sort(ranked);
        groups.push(group(human(mode)+' runs',[],table(['Rank','Wave','Accuracy','Hits / shots','Defeated','Time','Finished'],subset.map((r,i)=>[i+1,num(r.wave)===null&&num(r.completedWaves)===null?'Not recorded':wave(r),accuracy(r.hits,r.shots),number(r.hits)+' / '+number(r.shots),number(r.kills),duration(r.seconds),date(r.ended)]))));
      }
      if(!god) {
        const totals={};for(const r of runs)for(const [key,value] of Object.entries(obj(r.weapons)))if(num(value)!==null)totals[key]=(totals[key]||0)+value;
        groups.push(group('Shots by weapon',[],table(['Weapon','Shots'],Object.entries(totals).map(([id,v])=>[human(id),number(v)]))));
      }
    }
    const active=read(id,'active-run');if(active.value)groups.push(group('Unfinished run',[metric('Wave',active.value.wave),metric('Gameplay time',active.value.seconds,duration)],null,'This checkpoint is not a completed leaderboard result.'));
    return {id,title:god?'Godcore':'Code Platdo',status:source.status,groups};
  }
  function city() {
    const groups=[];let status='missing';
    for(const slot of ['story','sandbox']) {
      const source=read('platdo-city',slot),s=obj(source.value);
      if(source.status==='saved')status='saved';else if(status==='missing'&&source.status!=='missing')status=source.status;
      if(!source.value)continue;
      const stats=obj(s.stats),title=slot==='story'?'City adventure':'Sandbox';
      groups.push(group(title,[metric('Player',s.displayName,v=>typeof v==='string'?v:'Not recorded'),metric('Balance',s.wallet,v=>num(v)===null?'Not recorded':'$'+number(v)),metric('Active play time',stats.playTime,duration),metric('Jobs completed',stats.jobs),metric('Deaths',stats.deaths),metric('Shots fired',stats.shots),metric('Hits',stats.hits),metric('Shot accuracy',accuracy(stats.hits,stats.shots),v=>v),metric('Vehicles owned',count(s.owned)),metric('Clothing owned',count(s.wardrobe?.owned)),metric('Achievements',count(s.achievements)),metric('Caches found',count(s.caches)),metric('Jumps completed',count(s.jumps)),metric('Last saved',s.savedAt,date)]));
      const rows=[];for(const [rules,items] of Object.entries(obj(s.records)))for(const [id,r] of Object.entries(obj(items)))rows.push([human(rules),human(id),duration(r.time),number(r.bestScore)]);
      groups.push(group(title+' · job records',[],table(['Rules','Job','Best time','Best score'],rows)));
      groups.push(group(title+' · vehicles',[],table(['Vehicle','Ownership ID'],arr(s.owned).map(v=>[human(v.typeId),typeof v.id==='string'?v.id:'Not recorded']))));
      groups.push(group(title+' · milestones',[],table(['Category','Completed'],[...arr(s.missions?.completed).map(id=>['Mission',human(id)]),...arr(s.achievements).map(id=>['Achievement',human(id)])])));
    }
    return {id:'platdo-city',title:'City',status,groups};
  }
  function statistics(id) { const readers={'platdo-drive':drive,'platdo-jump':jump,'platdo-swing':swing,field:()=>shooter('field'),'god-core':()=>shooter('god-core'),'platdo-city':city};return id?readers[id]?.():Object.fromEntries(games.map(([id])=>[id,readers[id]()])); }
  function el(tag,className,text) {const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node;}
  function button(label,fn,className='ph-page-button') {const node=el('button',className,label);node.type='button';node.addEventListener('click',fn);return node;}
  function destroy(container) { const v=views.get(container);if(v){v.disposed=true;v.unsubscribe?.();views.delete(container);} }
  function renderStats(container,gameId='platdo-drive') {
    destroy(container);const view={kind:'stats',gameId:games.some(([id])=>id===gameId)?gameId:'platdo-drive'};views.set(container,view);container.replaceChildren();
    const root=el('section','ph-pages ph-statistics'),header=el('div','ph-page-heading'),heading=el('h2','','Statistics');
    header.append(heading,button('Refresh',()=>select(view.gameId)));root.append(header);
    const tabs=el('div','ph-stats-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Game statistics');
    const body=el('div','ph-statistics-body');body.setAttribute('role','tabpanel');body.id='ph-statistics-panel-'+(++serial);body.tabIndex=0;
    const buttons=[];
    for(const [id,label] of games) {const b=button(label,()=>select(id));b.dataset.game=id;b.id=body.id+'-'+id;b.setAttribute('role','tab');b.setAttribute('aria-controls',body.id);tabs.append(b);buttons.push(b);}
    tabs.addEventListener('keydown',event=>{let index=buttons.indexOf(document.activeElement);if(index<0)return;if(event.key==='ArrowRight')index=(index+1)%buttons.length;else if(event.key==='ArrowLeft')index=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=buttons.length-1;else return;event.preventDefault();buttons[index].click();buttons[index].focus();});
    root.append(tabs,body);container.append(root);
    function select(id) {
      view.gameId=id;const data=statistics(id);body.replaceChildren();
      for(const b of buttons){const selected=b.dataset.game===id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;if(selected)body.setAttribute('aria-labelledby',b.id);}
      body.append(el('p','ph-page-note',sourceNote(data.status)));
      for(const g of data.groups){const section=el('section','ph-stat-group');section.append(el('h3','',g.title));if(g.note)section.append(el('p','ph-page-note',g.note));
        if(g.metrics.length){const metrics=el('dl','ph-stat-metrics');for(const m of g.metrics){const cell=el('div','ph-stat-metric');cell.append(el('dt','',m.label),el('dd',m.value==='Not recorded'?'ph-unavailable':'',m.value));metrics.append(cell);}section.append(metrics);}
        if(g.table){if(!g.table.rows.length)section.append(el('p','ph-empty','No recorded results yet.'));else{const wrap=el('div','ph-table-scroll'),t=el('table','ph-data-table'),thead=el('thead'),tr=el('tr');for(const c of g.table.columns){const th=el('th','',c);th.scope='col';tr.append(th);}thead.append(tr);const tbody=el('tbody');for(const row of g.table.rows){const line=el('tr');for(const value of row)line.append(el('td',value==='Not recorded'?'ph-unavailable':'',value));tbody.append(line);}t.append(thead,tbody);wrap.append(t);section.append(wrap);}}
        body.append(section);
      }
    }
    view.refresh=()=>select(view.gameId);select(view.gameId);return view;
  }
  function releaseEntries(options={}) {
    const entries=arr(global.PlatdoReleaseData).map(e=>({...e}));
    const current=options.currentRelease;
    if(current?.version && !entries.some(e=>String(e.version)===String(current.version)))entries.unshift({id:'v'+current.version+'-living-hub',version:current.version,date:current.date||'2026-10-28',major:true,title:'A new home for Platdo',summary:'A living City menu, shared navigation and a statistics and update hub.',details:['Enter City or Just Drive from the new house-front menu.','Browse recorded progress across Drive, Jump, Swing, Code Platdo, City and Godcore.','Find release notes with search and sorting in the Plato Update Hub.','Account Settings adds Google sign-in and cloud-save support. Online account services are awaiting setup; guest progress still saves on this device.','Multiplayer is marked Coming soon.'],thumbnail:current.thumbnail||entries.find(e=>e.id==='v11-home-phone')?.thumbnail||'',...current});
    return entries.filter(e=>e&&typeof e.id==='string'&&typeof e.title==='string');
  }
  function filteredEntries(entries,query='',sort='newest') {
    const term=String(query).trim().toLocaleLowerCase();return entries.filter(e=>!term||[e.title,e.version,e.summary,...arr(e.details)].join(' ').toLocaleLowerCase().includes(term)).sort((a,b)=>(sort==='oldest'?1:-1)*((Date.parse(a.date)||0)-(Date.parse(b.date)||0)||Number(a.version)-Number(b.version)));
  }
  function safeImage(url) {return typeof url==='string'&&(/^(data:image\/(png|jpeg|webp);base64,|https:\/\/)/i.test(url))?url:null;}
  function renderUpdates(container,options={}) {
    destroy(container);const view={kind:'updates',options,query:'',sort:'newest',disposed:false,openComments:new Set(options.openCommentId?[options.openCommentId]:[]),drafts:updateDrafts};views.set(container,view);container.replaceChildren();
    const root=el('section','ph-pages ph-updates'),sidebar=el('aside','ph-updates-sidebar');sidebar.append(el('h2','','Plato Update Hub'));
    const search=el('input','ph-page-input');search.type='search';search.placeholder='Search updates';search.setAttribute('aria-label','Search updates');
    const sort=el('select','ph-page-input');sort.setAttribute('aria-label','Sort updates');for(const [value,label]of[['newest','Latest → Oldest'],['oldest','Oldest → Latest']]){const o=el('option','',label);o.value=value;sort.append(o);}
    sidebar.append(el('label','ph-field-label','Search'),search,el('label','ph-field-label','Sort by'),sort);
    const countNode=el('p','ph-page-note');countNode.setAttribute('aria-live','polite');sidebar.append(countNode);
    const feed=el('div','ph-updates-feed');feed.setAttribute('aria-label','Release notes');root.append(sidebar,feed);container.append(root);
    const entries=releaseEntries(options);search.addEventListener('input',()=>{view.query=search.value;draw();});sort.addEventListener('change',()=>{view.sort=sort.value;draw();});
    function signedIn() {return !!global.PlatdoAccount?.getState?.().user;}
    async function requireAccount(entry,action) {
      if(signedIn())return true;
      view.pending={updateId:entry.id,action};
      if(options.onSignIn)options.onSignIn(view.pending);
      else if(global.PlatdoAccount?.signIn)await global.PlatdoAccount.signIn();
      return false;
    }
    function draw() {
      view.generation=(view.generation||0)+1;const generation=view.generation;feed.replaceChildren();
      const entriesNow=filteredEntries(entries,view.query,view.sort);countNode.textContent=entriesNow.length+' update'+(entriesNow.length===1?'':'s');
      if(!entriesNow.length){feed.append(el('p','ph-empty','No updates match your search.'));return;}
      let lastMonth='';for(const entry of entriesNow){const parsed=new Date(entry.date+'T12:00:00'),month=Number.isFinite(parsed.valueOf())?parsed.toLocaleDateString(undefined,{month:'long',year:'numeric'}):'Release notes';if(month!==lastMonth){feed.append(el('h3','ph-update-month',month));lastMonth=month;}
        const card=el('article','ph-update-card '+(entry.major?'ph-update-major':'ph-update-minor'));card.dataset.updateId=entry.id;card.tabIndex=-1;
        const top=el('div','ph-update-top'),img=safeImage(options.thumbnails?.[entry.id]||entry.thumbnail);if(img){const thumbnail=el('img','ph-update-thumbnail');thumbnail.src=img;thumbnail.alt=entry.thumbnailAlt||entry.title;thumbnail.loading='lazy';top.append(thumbnail);}
        const copy=el('div','ph-update-copy');copy.append(el('p','ph-update-version','Update V '+entry.version),el('h3','',entry.title));if(entry.summary)copy.append(el('p','',entry.summary));const details=el('ul');for(const detail of arr(entry.details))details.append(el('li','',detail));copy.append(details);top.append(copy);card.append(top);
        const bottom=el('div','ph-update-bottom'),published=el('time','ph-page-note',Number.isFinite(parsed.valueOf())?parsed.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}):'Publication date unavailable');published.dateTime=entry.date;bottom.append(published);card.append(bottom);
        const community=el('div','ph-update-community'),actions=el('div','ph-update-actions'),status=el('p','ph-page-note','Loading community responses…');status.setAttribute('role','status');
        let engagement=null,busy=false;const like=button('Like',()=>react('like')),dislike=button('Dislike',()=>react('dislike')),comment=button('Comment',async()=>{try{if(!await requireAccount(entry,'comment'))return;view.openComments.add(entry.id);drawComments();}catch(e){status.textContent=e.message;}});
        like.setAttribute('aria-pressed','false');dislike.setAttribute('aria-pressed','false');actions.append(like,dislike,comment);community.append(actions,status);const comments=el('section','ph-comments');community.append(comments);card.append(community);feed.append(card);
        function current(){return !view.disposed&&view.generation===generation&&card.isConnected;}
        function drawComments(){comments.replaceChildren();if(!view.openComments.has(entry.id))return;comments.append(el('h4','','Comments'));
          if(engagement){if(!engagement.comments.length)comments.append(el('p','ph-page-note','No comments yet.'));for(const c of engagement.comments){const row=el('article','ph-comment'),name=el('strong','',c.displayName||'Player');row.append(name,el('p','',c.text),el('small','ph-page-note',typeof c.createdAt==='number'?new Date(c.createdAt).toLocaleString():date(c.createdAt)));if(c.uid===global.PlatdoAccount?.getState?.().user?.uid)row.append(button('Delete',async()=>{try{await global.PlatdoAccount.deleteOwnComment(entry.id,c.id);await load();}catch(e){status.textContent=e.message;}}));comments.append(row);}}
          if(signedIn()){const form=el('form','ph-comment-form'),input=el('textarea','ph-page-input');input.placeholder='Write a comment';input.setAttribute('aria-label','Comment on '+entry.title);input.maxLength=1200;input.value=view.drafts.get(entry.id)||'';input.addEventListener('input',()=>view.drafts.set(entry.id,input.value));const submit=button('Post comment',()=>{});submit.type='submit';form.append(input,submit);form.addEventListener('submit',async e=>{e.preventDefault();if(!input.value.trim())return;submit.disabled=true;try{if(!await requireAccount(entry,'comment'))return;if(!global.PlatdoAccount?.addUpdateComment)throw Error('Community comments are unavailable.');await global.PlatdoAccount.addUpdateComment(entry.id,input.value.trim());view.drafts.delete(entry.id);await load();}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});comments.append(form);}else comments.append(button('Sign in to comment',()=>requireAccount(entry,'comment')));
        }
        async function load(){try{if(!global.PlatdoAccount?.getUpdateEngagement)throw Error('Community responses are unavailable until the account service is connected.');const response=await global.PlatdoAccount.getUpdateEngagement(entry.id);if(!current())return;engagement={...response,comments:arr(response.comments)};like.textContent='Like · '+number(response.likes);dislike.textContent='Dislike · '+number(response.dislikes);comment.textContent=engagement.comments.length>=50?'Comments · latest 50':'Comment · '+engagement.comments.length;like.setAttribute('aria-pressed',String(response.myReaction==='like'));dislike.setAttribute('aria-pressed',String(response.myReaction==='dislike'));status.textContent=signedIn()?'':'Sign in to react or comment.';drawComments();}catch(error){if(!current())return;status.replaceChildren(document.createTextNode('Community unavailable: '+error.message+' '),button('Retry',load));drawComments();}}
        async function react(kind){if(busy)return;try{if(!await requireAccount(entry,kind))return;if(!engagement)throw Error('Load community responses before reacting.');busy=true;like.disabled=dislike.disabled=true;await global.PlatdoAccount.reactToUpdate(entry.id,engagement.myReaction===kind?null:kind);await load();}catch(error){if(current())status.textContent=error.message;}finally{busy=false;like.disabled=dislike.disabled=false;}}
        load();drawComments();
      }
    }
    // Autosave status emissions must not rebuild an open comment form or refetch every card.
    const accountStamp=s=>String(s?.user?.uid||'guest')+'|'+String(!!s?.ready);
    let lastAccountStamp=accountStamp(global.PlatdoAccount?.getState?.());
    if(global.PlatdoAccount?.subscribe)view.unsubscribe=global.PlatdoAccount.subscribe(s=>{const next=accountStamp(s);if(next!==lastAccountStamp&&!view.disposed){lastAccountStamp=next;draw();}});
    view.refresh=draw;draw();if(options.focusUpdateId){const target=[...feed.querySelectorAll('[data-update-id]')].find(node=>node.dataset.updateId===options.focusUpdateId);target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true});}return view;
  }
  function refresh(){for(const [container,view]of views){if(!container.isConnected){destroy(container);continue;}view.refresh?.();}}
  global.PlatdoPages={renderStats,renderUpdates,statistics,destroy,refresh,games:games.map(g=>g.slice()),releaseEntries,filteredEntries};
  global.addEventListener?.('platdo:save',()=>setTimeout(()=>{for(const [container,view]of views)if(container.isConnected&&view.kind==='stats')view.refresh?.();},0));
  global.addEventListener?.('storage',refresh);
  global.addEventListener?.('platdo:beforereset',()=>{for(const container of views.keys())destroy(container);});
})(typeof window!=='undefined'?window:globalThis);

/* PLATDO's shared front door. Gameplay and saves remain owned by each game. */
(function (global) {
 'use strict';
 if (global.PlatdoHub) return;
 const routes={'platdo-city':'city','platdo-drive':'drive','platdo-jump':'platdo','platdo-swing':'swing','code-platdo':'field','platdo-god-core':'god-core'};
 const aliases={city:'platdo-city',drive:'platdo-drive',jump:'platdo-jump',swing:'platdo-swing',code:'code-platdo',godcore:'platdo-god-core'};
 const titles={'platdo-jump':'PLATDO Jump','platdo-swing':'PLATDO Swing','code-platdo':'Code Platdo','platdo-god-core':'PLATDO God Core'};
 const launchers={'platdo-jump':'openPlatdoBtn','platdo-swing':'openSwingBtn','code-platdo':'openFieldBtn','platdo-god-core':'openGodCoreBtn'};
 let home,panel,body,heading,badge,ready=false,screen=null,stack=[],previousFocus=null,computerReturn=null,computerSession=false,routeGeneration=0;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const avatar='<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14" r="7"/><path d="M7 36c0-9 5-14 13-14s13 5 13 14"/></svg>';
 const icons={stats:'<path d="M5 20V10m7 10V4m7 16v-7"/>',settings:'<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>',updates:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4M12 2v2"/>'};
 const icon=name=>'<svg class="pp-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
 function state(){return global.PlatdoAccount?.getState?.()||{status:'loading',user:null,syncStatus:'local'};}
 function safePhoto(url){try{const u=new URL(url,location.href);return ['https:','data:','blob:'].includes(u.protocol)?url:'';}catch{return '';}}
 function avatarHTML(user,cls=''){const src=safePhoto(user?.photoURL);return '<span class="pp-avatar '+cls+'">'+(src?'<img src="'+escape(src)+'" alt="">':avatar)+'</span>';}
 function clearInputs(){global.Platdo?.controls?.clear?.();document.activeElement?.blur?.();if(document.pointerLockElement)document.exitPointerLock?.();}
 function accountBadge(){if(!badge)return;const s=state(),user=s.user;badge.innerHTML='<span><strong>'+escape(user?.displayName||'Sign in')+'</strong><small>'+escape(user?syncLabel(s):'Save across devices')+'</small></span>'+avatarHTML(user);badge.setAttribute('aria-label',user?'Account settings for '+user.displayName:'Sign in with Google');}
 function syncLabel(s){const labels={saved:'Cloud saved',synced:'Cloud saved',syncing:'Saving to cloud…',offline:'Offline · saved here',local:'Saved on this device',conflict:'Choose a save',error:'Cloud needs attention',loading:'Checking cloud saves…',pending:'Waiting to sync',ready:'Cloud ready'};return labels[s.syncStatus]||s.syncStatus||'Saved on this device';}
 function showPanel(kind,title,render,{push=true}={}) {
  if(!screen)previousFocus=document.activeElement;clearInputs();
  if(screen&&push)stack.push({...screen});
  global.PlatdoPages?.destroy?.(body);screen={kind,title,render};panel.hidden=false;home?.setAttribute('inert','');
  document.getElementById('cityRoot')?.setAttribute('inert','');document.getElementById('driveRoot')?.setAttribute('inert','');
  document.documentElement.dataset.platformPanel=kind;heading.textContent=title;body.replaceChildren();render(body);panel.querySelector('.pp-back').focus({preventScroll:true});
 }
 function closePanel(){if(!panel)return;global.PlatdoPages?.destroy?.(body);screen=null;stack=[];panel.hidden=true;delete document.documentElement.dataset.platformPanel;home?.removeAttribute('inert');document.getElementById('cityRoot')?.removeAttribute('inert');document.getElementById('driveRoot')?.removeAttribute('inert');clearInputs();if(previousFocus?.isConnected&&!previousFocus.closest('[hidden]'))previousFocus.focus({preventScroll:true});}
 function back(){if(stack.length){const next=stack.pop();showPanel(next.kind,next.title,next.render,{push:false});}else{const fromComputer=screen?.kind==='computer';closePanel();if(fromComputer&&computerReturn){const callback=computerReturn;computerReturn=null;computerSession=false;callback();}}}
 function openStats(){showPanel('stats','Statistics',el=>global.PlatdoPages.renderStats(el,'platdo-drive'));}
 function renderUpdates(el,context={}){global.PlatdoPages.renderUpdates(el,{currentRelease:{version:12},...context,onSignIn:request=>{if(screen?.kind==='updates')screen={...screen,render:target=>renderUpdates(target,{focusUpdateId:request.updateId,openCommentId:request.action==='comment'?request.updateId:null})};openAccount();}});}
 function openUpdates(context={}){showPanel('updates','Plato Update Hub',el=>renderUpdates(el,context));}
 function openSettings(){closePanel();clearInputs();document.getElementById('mainSettingsDialog').showModal();}
 function errorText(error){return typeof error==='string'?error:error?.message||error?.code||'';}
 function accountRender(el){
  const s=state(),u=s.user;el.innerHTML='<div class="pp-account-layout"><div class="pp-profile">'+avatarHTML(u,'pp-avatar-large')+(u?'<label class="pp-file-button">Change picture<input id="ppProfileFile" type="file" accept="image/*" aria-label="Choose a profile picture"></label>':'')+'</div><div class="pp-account-details"><h2>'+escape(u?.displayName||'Your PLATDO account')+'</h2>'+(u?'<p>'+escape(u.email||'Google account')+'</p>':'<p>Sign in with Google to keep your game progress across devices. You can keep playing as a guest.</p>')+'<div class="pp-account-status" role="status" aria-live="polite"><strong>'+escape(u?syncLabel(s):'Guest · saved on this device')+'</strong>'+(s.lastSynced?'<p>Last cloud save: '+escape(new Date(s.lastSynced).toLocaleString())+'</p>':'')+(s.error?'<p class="pp-error">'+escape(errorText(s.error))+'</p>':'')+'</div><div class="pp-account-actions">'+(u?'<button data-account="sync">Sync now</button><button class="pp-secondary" data-account="out">Sign out</button>':'<button data-account="in">Continue with Google</button>')+'</div><p class="pp-note">Game progress and settings save locally while offline. Phone photo and video files stay on the device where they were captured.</p><div id="ppAccountConflicts"></div><p id="ppAccountActionStatus" role="status"></p></div></div>';
  const conflicts=Array.isArray(s.conflicts)?s.conflicts:Object.values(s.conflicts||{});const list=el.querySelector('#ppAccountConflicts');
  for(const conflict of conflicts){const id=conflict.groupId||conflict.id||conflict.group;const row=document.createElement('section');row.className='pp-conflict';row.innerHTML='<h3>'+escape(conflict.label||conflict.name||id||'Save conflict')+'</h3><p>This device and the cloud have different progress. Choose the save you want to use.</p><div class="pp-account-actions"><button data-choice="local">Keep this device’s save</button><button data-choice="cloud">Load cloud save</button></div>';row.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>accountAction(()=>global.PlatdoAccount.resolveConflict(id,b.dataset.choice)));list.append(row);}
  if(!u&&/popup|blocked/i.test(errorText(s.error))){const fallback=document.createElement('button');fallback.dataset.account='redirect';fallback.className='pp-secondary';fallback.textContent='Continue in this tab';el.querySelector('.pp-account-actions').append(fallback);}
  el.querySelectorAll('[data-account]').forEach(b=>{b.disabled=s.status==='signing-in'||s.syncStatus==='syncing';b.onclick=()=>accountAction(()=>b.dataset.account==='in'?global.PlatdoAccount.signIn():b.dataset.account==='redirect'?global.PlatdoAccount.signIn({redirect:true}):b.dataset.account==='out'?global.PlatdoAccount.signOut():global.PlatdoAccount.syncNow());});
  el.querySelector('#ppProfileFile')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(file)accountAction(()=>global.PlatdoAccount.updateProfilePicture(file));});
 }
 async function accountAction(action){const status=document.getElementById('ppAccountActionStatus');if(status)status.textContent='Working…';try{await action();if(screen?.kind==='account')accountRender(body);}catch(e){const target=document.getElementById('ppAccountActionStatus');if(target)target.textContent=global.PlatdoAccount?.formatError?.(e)||errorText(e)||'That could not finish. Your local progress is safe.';}}
 function openAccount(){showPanel('account','Account settings',accountRender);}
 function multiplayer(game='city'){
  const title=game==='drive'?'Drive multiplayer':'City multiplayer';
  showPanel('multiplayer',title,el=>{el.innerHTML='<div class="pp-lobby"><div class="pp-lobby-intro"><span class="pp-chip">Coming soon</span><h2>One lobby. City and Drive.</h2><p>City and Drive will share the same servers. Choose where to start playing with your group.</p></div><div class="pp-lobby-actions"><button id="ppHost">Host a lobby</button><button id="ppPrivate">Join private</button></div><section class="pp-server-list" aria-label="Public servers"><div class="pp-list-heading"><h3>Public servers</h3><span>Up to 30 players</span></div><p>Multiplayer servers are not connected yet. Public lobbies will appear here when multiplayer launches.</p></section><p class="pp-note">Single-player City and solo Drive remain available independently.</p></div>';el.querySelector('#ppHost').onclick=()=>host(game);el.querySelector('#ppPrivate').onclick=()=>privateLobby(game);});
 }
 function host(game){showPanel('host','Host a lobby',el=>{el.innerHTML='<form class="pp-lobby-form"><span class="pp-chip">Coming soon</span><h2>Lobby settings</h2><fieldset><legend>Visibility</legend><label><input name="visibility" type="radio" value="public" checked> Public</label><label><input name="visibility" type="radio" value="private"> Private · five-digit code</label></fieldset><label>Maximum players<input id="ppLobbyPlayers" type="number" min="2" max="30" value="8" inputmode="numeric"></label><label>Start in<select id="ppLobbyDestination"><option value="city" '+(game==='city'?'selected':'')+'>Platdo City</option><option value="drive" '+(game==='drive'?'selected':'')+'>Platdo Drive</option></select></label><label>Game mode<select id="ppLobbyMode"></select></label><button type="submit" disabled>Start · Coming soon</button><p role="status">Lobby hosting will be enabled when servers are connected. No lobby or join code has been created.</p></form>';const select=el.querySelector('#ppLobbyDestination'),mode=el.querySelector('#ppLobbyMode');const modes=()=>{mode.innerHTML=select.value==='city'?'<option>Sandbox</option>':'<option>Free Drive</option><option>Time Trial</option><option>Traffic Rush</option>';};select.onchange=modes;modes();el.querySelector('form').onsubmit=e=>e.preventDefault();el.querySelector('#ppLobbyPlayers').onchange=e=>e.target.value=Math.max(2,Math.min(30,Number(e.target.value)||2));});}
 function privateLobby(game){showPanel('private','Join a private lobby',el=>{el.innerHTML='<div class="pp-private"><span class="pp-chip">Coming soon</span><h2>Enter the lobby code</h2><p>Use the five-digit code shared by your host.</p><input id="ppPrivateCode" aria-label="Five-digit lobby code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="off" placeholder="— — — — —"><div class="pp-keypad" aria-label="Lobby code keypad">'+[1,2,3,4,5,6,7,8,9,'Clear',0,'⌫'].map(v=>'<button data-digit="'+v+'" aria-label="'+(v==='⌫'?'Delete last digit':v)+'">'+v+'</button>').join('')+'</div><button id="ppJoinPrivate" disabled>Join · Coming soon</button><p role="status">Codes cannot be checked until multiplayer servers are connected.</p></div>';const input=el.querySelector('#ppPrivateCode');input.oninput=()=>input.value=input.value.replace(/\D/g,'').slice(0,5);el.querySelectorAll('[data-digit]').forEach(b=>b.onclick=()=>{input.value=b.dataset.digit==='Clear'?'':b.dataset.digit==='⌫'?input.value.slice(0,-1):(input.value+b.dataset.digit).slice(0,5);input.dispatchEvent(new Event('input'));});});}
 function computer(callback){computerReturn=callback;computerSession=true;showPanel('computer','Gaming computer',el=>{el.innerHTML='<p class="pp-library-intro">Choose a game. Your City character will stay at the desk.</p><div class="pp-library">'+Object.entries(titles).map(([id,title])=>{const img=document.getElementById(launchers[id])?.querySelector('img');return '<button data-play-game="'+id+'">'+(img?'<img src="'+escape(img.src)+'" alt="">':'')+'<strong>'+title+'</strong><span>Play</span></button>';}).join('')+'</div>';el.querySelectorAll('[data-play-game]').forEach(b=>b.onclick=()=>openGame(b.dataset.playGame,{fromCity:true}));});}
 function openGame(id,options={}){id=aliases[id]||id;if(!routes[id])return false;if(options.fromCity&&options.returnToCity){computerReturn=options.returnToCity;computerSession=true;}else if(!options.fromCity){computerReturn=null;computerSession=false;}closePanel();clearInputs();global.PlatdoCity?.stopMenuPreview?.();global.Platdo?.playGameOpenSound?.();location.hash=routes[id];return true;}
 async function refreshRoute(){
  const generation=++routeGeneration;closePanel();if(!ready)return;
  if(!location.hash||location.hash==='#'){
   if(computerSession&&computerReturn){const callback=computerReturn;computerReturn=null;computerSession=false;callback();return;}
   home.hidden=false;document.title='PLATDO City';
   try{await global.PlatdoCity?.startMenuPreview?.('front');if(generation!==routeGeneration)return;document.getElementById('ppWorldStatus').textContent='';}catch(e){document.getElementById('ppWorldStatus').textContent='City preview unavailable. You can still open a game or change Graphics in Settings.';}
  }else{home.hidden=true;}
 }
 function handleKey(e){
  // Graphics owns its nested modal, including Escape and its focus trap.
  // Let its later capture handler run before considering the underlying menu.
  if(document.querySelector('dialog.pg-backdrop[open]'))return;
  const settings=document.getElementById('mainSettingsDialog');
  if(settings?.open){if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();settings.close();}else if(e.target?.closest?.('#mainSettingsDialog'))e.stopPropagation();return;}
  if(!screen)return;
  if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();back();return;}
  if(e.code==='Tab'){const items=[...panel.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 }
 function install(){
  const hub=document.getElementById('gameHub');if(!hub)return;
  document.documentElement.classList.add('platdo-platform');
  const settings=document.getElementById('mainSettingsDialog'),settingsButton=document.getElementById('mainSettingsBtn');document.body.append(settings);settings.classList.add('pp-settings');document.getElementById('closeMainSettingsBtn').textContent='Back';
  hub.setAttribute('aria-label','PLATDO City main menu');hub.querySelectorAll(':scope > *').forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true');});
  home=document.createElement('section');home.id='platdoPlatformHome';home.className='pp-ui';home.innerHTML='<header class="pp-home-header"><h1>PLATDO<span>CITY</span></h1><button id="ppAccount" class="pp-account-button"></button></header><nav class="pp-primary-nav" aria-label="Play"><button id="ppEnterCity">Enter City<span aria-hidden="true">→</span></button><button id="ppJustDrive">Just Drive<span aria-hidden="true">→</span></button></nav><p id="ppWorldStatus" role="status"></p><footer class="pp-home-footer"><span class="pp-version">PLATDO · V12</span><nav aria-label="Main menu pages"><button id="ppStats">Stats</button><span id="ppSettingsSlot"></span><button id="ppUpdates">Updates</button></nav></footer>';hub.append(home);
  home.querySelector('#ppSettingsSlot').replaceWith(settingsButton);settingsButton.hidden=false;settingsButton.removeAttribute('aria-hidden');settingsButton.removeAttribute('style');settingsButton.textContent='Settings';
  settingsButton.innerHTML=icon('settings')+'Settings';home.querySelector('#ppStats').innerHTML=icon('stats')+'Stats';home.querySelector('#ppUpdates').innerHTML=icon('updates')+'Updates';
  badge=home.querySelector('#ppAccount');badge.onclick=openAccount;home.querySelector('#ppEnterCity').onclick=()=>openGame('platdo-city');home.querySelector('#ppJustDrive').onclick=()=>openGame('platdo-drive');home.querySelector('#ppStats').onclick=openStats;home.querySelector('#ppUpdates').onclick=()=>openUpdates();
  // The old audio is intentionally retired; keep its unused settings hidden so older save schemas still round-trip.
  document.querySelector('[data-main-tab="audio"]').hidden=true;document.getElementById('main-audio-panel').hidden=true;
  panel=document.createElement('section');panel.id='platdoPlatformPanel';panel.className='pp-ui';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','ppPanelTitle');panel.innerHTML='<header class="pp-panel-header"><button class="pp-back" aria-label="Back">×</button><h1 id="ppPanelTitle"></h1></header><div id="platdoPlatformBody"></div>';document.body.append(panel);body=panel.querySelector('#platdoPlatformBody');heading=panel.querySelector('#ppPanelTitle');panel.querySelector('.pp-back').onclick=back;
  global.addEventListener('hashchange',refreshRoute);global.addEventListener('platdo:ready',()=>{ready=true;refreshRoute();});
  global.addEventListener('platdo:computeropen',e=>{e.preventDefault();computer(e.detail?.returnToCity);});
  global.addEventListener('platdo:computerlaunch',e=>{if(!routes[aliases[e.detail?.game]])return;e.preventDefault();openGame(e.detail.game,{fromCity:true,returnToCity:e.detail.returnToCity});});
  global.addEventListener('platdo:multiplayer',e=>{e.preventDefault();multiplayer(e.detail?.game||'city');});
  global.Platdo.getSaveRegistry=()=>Object.entries(resetGameCatalog).map(([id,game])=>({id,name:game.name,keys:[...game.keys]}));
  global.Platdo.canApplyCloudSave=()=>!location.hash&&(!screen||screen.kind==='account')&&!document.getElementById('mainSettingsDialog')?.open;
  global.Platdo.prepareCloudSaveReload=()=>{global.PlatdoCity?.stopMenuPreview?.();fullSaveReady=false;clearInterval(scheduledSaveTimer);clearInputs();global.dispatchEvent(new CustomEvent('platdo:beforereset',{detail:{cloudRestore:true,games:[],all:false}}));};
  global.PlatdoAccount?.subscribe?.(()=>{accountBadge();if(screen?.kind==='account'){const focused=document.activeElement?.dataset?.account;accountRender(body);if(focused)body.querySelector('[data-account="'+focused+'"]')?.focus({preventScroll:true});}});accountBadge();global.PlatdoAccount?.initialize?.();
  if(global.PlatdoLoading?.ready){ready=true;refreshRoute();}
 }
 global.PlatdoHub={openGame,openAccount,openStats,openUpdates,openSettings,openMultiplayer:multiplayer,handleKey,back,get panel(){return screen?.kind||null;},get ready(){return ready;},get computerSession(){return computerSession;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
