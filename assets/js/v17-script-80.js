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
      const drift=obj(s.longestDrift);
      groups.push(group('Longest drift',[
        metric('Car',drift.name||drift.car,v=>typeof v==='string'?(drift.name||carName(v)):'Not recorded'),
        metric('Time',drift.seconds,duration),
        metric('Distance',drift.metres,v=>num(v)===null?'Not recorded':number(v)+' m')
      ]));
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
    const term=String(query).trim().toLocaleLowerCase();return entries.filter(e=>!term||[e.title,e.version,e.summary,...arr(e.details),...arr(e.sections).flatMap(s=>[s.title,...arr(s.items)])].join(' ').toLocaleLowerCase().includes(term)).sort((a,b)=>(sort==='oldest'?1:-1)*((Date.parse(a.date)||0)-(Date.parse(b.date)||0)||Number(a.version)-Number(b.version)));
  }
  function safeImage(url) {return typeof url==='string'&&(/^(data:image\/(png|jpeg|webp);base64,|https:\/\/)/i.test(url))?url:null;}
  function renderUpdates(container,options={}) {
    destroy(container);const view={kind:'updates',options,query:'',sort:'newest',disposed:false,expanded:new Set(),openComments:new Set(options.openCommentId?[options.openCommentId]:[]),drafts:updateDrafts};views.set(container,view);container.replaceChildren();
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
        const copy=el('div','ph-update-copy');copy.append(el('p','ph-update-version','Update V '+entry.version),el('h3','',entry.title));if(entry.summary)copy.append(el('p','',entry.summary));top.append(copy);card.append(top);
        const notes=el('div','ph-release-full');
        notes.id='ph-notes-'+entry.id;
        if(arr(entry.details).length){const details=el('ul');for(const detail of entry.details)details.append(el('li','',detail));notes.append(details);}
        for(const section of arr(entry.sections)){
          const block=el('section','ph-release-section'),list=el('ul');
          block.append(el('h4','',section.title),list);
          for(const item of arr(section.items))list.append(el('li','',item));
          notes.append(block);
        }
        if(notes.childElementCount){
          const toggle=button('',()=>{if(view.expanded.has(entry.id))view.expanded.delete(entry.id);else view.expanded.add(entry.id);syncNotes();});
          toggle.setAttribute('aria-controls',notes.id);
          function syncNotes(){const open=view.expanded.has(entry.id);notes.hidden=!open;toggle.textContent=open?'Show less':'More…';toggle.setAttribute('aria-expanded',String(open));}
          syncNotes();copy.append(toggle);card.append(notes);
        }
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
