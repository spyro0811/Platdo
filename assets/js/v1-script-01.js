/* Central local/cloud save coordinator. Firebase is injected by account-manager.js. */
(function(root){
  'use strict';
  const META='platdo:cloud-meta:v1', REGISTRY='platdo:registered-save-keys:v1';
  const KNOWN=['platdo-jump','field','god-core','platdo-drive','platdo-swing','platdo-city','avatar','main-settings','main-controls'];
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function safeJSON(v,fallback){try{return JSON.parse(v);}catch(_){return fallback;}}
  function enumerate(storage){const result={};for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k)result[k]=storage.getItem(k);}return result;}
  const initial=(()=>{try{return enumerate(root.localStorage);}catch(_){return {};}})();
  function canonical(value){return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));}
  async function fingerprint(value){const bytes=new TextEncoder().encode(typeof value==='string'?value:canonical(value));const digest=await root.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');}
  function friendly(error){const code=error?.code||'';if(/permission-denied/.test(code))return 'Cloud access was denied. Your local progress is safe. Check the Firebase security rules.';if(/unavailable|network|offline/.test(code)||root.navigator?.onLine===false)return 'Offline — progress is saved on this device and will sync when the connection returns.';return error?.message||'Cloud save could not finish. Your local progress is safe.';}
  function error(code,message){return Object.assign(new Error(message),{code});}
  function validId(id){return typeof id==='string'&&/^[a-z0-9-]{1,100}$/.test(id);}
  // Only the owner vault contains device backups. It is never uploaded as game data.
  function createVault(){
    const DB='platdo-account-vault-v1';let opening;
    function open(){return opening||(opening=new Promise((resolve,reject)=>{if(!root.indexedDB)return reject(error('storage/unavailable','This browser cannot make an account backup. Sign-in cannot switch saved progress safely.'));const q=root.indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore('records');q.onsuccess=()=>resolve(q.result);q.onerror=()=>{opening=null;reject(q.error);};}));}
    async function run(mode,key,value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('records',mode),s=tx.objectStore('records');const q=mode==='readonly'?s.get(key):value===undefined?s.delete(key):s.put(value,key);let result;q.onsuccess=()=>result=q.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Account backup was interrupted.'));});}
    return {get:k=>run('readonly',k),put:(k,v)=>run('readwrite',k,v),remove:k=>run('readwrite',k),database:DB};
  }
  function create(options={}){
    const storage=options.storage||root.localStorage,vault=options.vault||createVault(),groups=new Map(),listeners=new Set();
    let meta=safeJSON(storage.getItem(META),null)||{schema:1,owner:'guest',accounts:{},pendingResets:{}};
    if(meta.schema!==1||!meta.accounts||!meta.pendingResets)meta={schema:1,owner:'guest',accounts:{},pendingResets:{}};
    let transport=options.transport||null,uid=null,generation=0,timer=null,retryTimer=null,retryDelay=15000,firstDirtyAt=0,chain=Promise.resolve(),transition=null,stopped=false,applying=false,ready=false;
    const state={status:'local',lastSynced:null,error:null,conflicts:[],pendingReset:false};
    const boot=options.initial||initial;let bootHadProgress=false;
    const signals=new Map(), dirty=new Set(), handles=[];let previousSet,previousRemove;
    const notify=()=>{state.pendingReset=!!(uid&&meta.pendingResets[uid]?.length);for(const fn of listeners)try{fn({...state,conflicts:[...state.conflicts]});}catch(_){}};
    const persist=()=>storage.setItem(META,JSON.stringify(meta));
    const names=id=>groups.get(id)?.name||({'field':'Code Platdo','god-core':'God Core','main-settings':'Main settings','main-controls':'Controls','avatar':'Shared character'})[id]||id;
    function register(id,name=id,keys=[]){if(!validId(id))throw Error('Invalid save namespace.');const entry=groups.get(id)||{name,keys:new Set()};entry.name=name||entry.name;for(const key of keys)if(typeof key==='string'&&!key.startsWith('firebase:')&&key!==META&&key!==REGISTRY)entry.keys.add(key);groups.set(id,entry);}
    KNOWN.forEach(id=>register(id));
    function groupForKey(key){if(typeof key!=='string'||key===META||key===REGISTRY)return null;const m=/^platdo:game:([a-z0-9-]+):/.exec(key);if(m){if(!groups.has(m[1]))register(m[1]);return m[1];}for(const[id,g]of groups)if(g.keys.has(key))return id;if(key==='platdo:settings:v1')return 'main-settings';return null;}
    function discover(){const legacy=safeJSON(storage.getItem(REGISTRY),[]);for(const key of Array.isArray(legacy)?legacy:[])if(!groupForKey(key))groups.get('platdo-jump').keys.add(key);for(const k of Object.keys(enumerate(storage)))groupForKey(k);}
    function snapshot(id,source){discover();const out={};for(const[k,v]of Object.entries(source||enumerate(storage)))if(groupForKey(k)===id&&typeof v==='string')out[k]=v;return out;}
    function snapshotAll(){discover();return Object.fromEntries([...groups.keys()].map(id=>[id,snapshot(id)]));}
    function validate(id,data){if(!validId(id)||!data||Object.getPrototypeOf(data)!==Object.prototype||Object.keys(data).length>4000)throw error('save/invalid','The cloud save has an unsupported format. Local progress was preserved.');for(const[k,v]of Object.entries(data)){if(groupForKey(k)!==id||typeof v!=='string'||new TextEncoder().encode(v).byteLength>32*1024*1024)throw error('save/invalid','The cloud save contains invalid data. Local progress was preserved.');if((v.startsWith('{')||v.startsWith('['))&&safeJSON(v,undefined)===undefined)throw error('save/invalid','The cloud save contains damaged JSON. Local progress was preserved.');}return data;}
    function account(){return meta.accounts[uid]||(meta.accounts[uid]={groups:{},lastSynced:null});}
    function active(token,user){if(stopped||applying||!ready||meta.owner!==user||token!==generation||uid!==user)throw error('save/cancelled','The account changed; the old save operation was cancelled.');}
    function queue(fn){const next=chain.catch(()=>{}).then(fn);chain=next;return next;}
    function schedule(){if(!uid||!ready||stopped||applying)return;clearTimeout(timer);if(!firstDirtyAt)firstDirtyAt=Date.now();const delay=Math.min(options.debounceMs??6000,Math.max(0,30000-(Date.now()-firstDirtyAt)));timer=setTimeout(()=>{firstDirtyAt=0;sync().catch(()=>{});},delay);}
    function mark(key){const id=groupForKey(key);if(id&&!applying){dirty.add(id);if(uid){if(state.status!=='pending'){state.status='pending';notify();}schedule();}}}
    async function captureMedia(){if(options.captureMedia)return options.captureMedia();if(!root.CityPhoneMedia)return [];await Promise.all([]);return root.CityPhoneMedia.list();}
    async function restoreMedia(records){if(options.restoreMedia)return options.restoreMedia(records);if(!root.CityPhoneMedia)return;await root.CityPhoneMedia.reset();if(records?.length){const db=await root.CityPhoneMedia.open();await new Promise((resolve,reject)=>{const tx=db.transaction('media','readwrite');for(const record of records)tx.objectStore('media').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}}
    async function backup(owner=meta.owner){const record={schema:1,owner,savedAt:Date.now(),groups:snapshotAll(),media:await captureMedia()};await vault.put('owner:'+owner,record);return record;}
    async function safeApply(replacements,{owner=meta.owner,media,reason='cloud',expected}={}){
      if(options.canApply&&!options.canApply())throw error('save/menu-required','Return to the main menu to load cloud progress safely.');
      for(const[id,data]of Object.entries(replacements))validate(id,data);
      const before=await backup();await vault.put('recovery:'+meta.owner,before);
      const unchanged=()=>!expected||Object.entries(expected).every(([id,value])=>canonical(snapshot(id))===value);
      if(!unchanged())throw error('save/conflict','Local progress changed while cloud data was loading. Sync again to review the latest versions.');
      applying=true;generation++;clearTimeout(timer);
      let mutated=false;
      try{
        await options.beforeApply?.({reason,groups:Object.keys(replacements),owner});
        if(!unchanged())throw error('save/conflict','Local progress changed during the restore. It has been preserved.');
        mutated=true;
        for(const[id,data]of Object.entries(replacements)){for(const key of Object.keys(snapshot(id)))if(!own(data,key))storage.removeItem(key);for(const[k,v]of Object.entries(data))storage.setItem(k,v);}
        if(media!==undefined)await restoreMedia(media);
        meta.owner=owner;persist();
      }catch(e){try{if(mutated){for(const[id,data]of Object.entries(before.groups)){for(const k of Object.keys(snapshot(id)))if(!own(data,k))storage.removeItem(k);for(const[k,v]of Object.entries(data))storage.setItem(k,v);}meta.owner=before.owner;persist();await restoreMedia(before.media);}}finally{applying=false;await options.afterApply?.({reason:'restore-rolled-back',error:friendly(e)});}throw e;}
      state.status='reloading';notify();await options.afterApply?.({reason});
      if(!options.afterApply)applying=false;
      return true;
    }
    async function switchOwner(user){
      const wanted=user||'guest';if(meta.owner===wanted)return false;
      if(meta.owner==='guest'&&user){await backup('guest');meta.owner=wanted;persist();return false;}
      const saved=await vault.get('owner:'+wanted);const next={};for(const id of groups.keys())next[id]=saved?.groups?.[id]||{};
      // Account B must never inherit account A's in-memory or disk state.
      await safeApply(next,{owner:wanted,media:saved?.media||[],reason:'account-switch'});return true;
    }
    function describe(id,data,remote){let value;for(const key of Object.keys(data)){const parsed=safeJSON(data[key],null);if(parsed&&typeof parsed==='object'&&(key.endsWith(':profile')||key==='platdo_full_save_v1')){value=parsed;break;}}
      const result={name:names(id),entries:Object.keys(data).length,updatedAt:remote?.updatedAt||null};if(value){const money=value.money??value.credits??value.wallet??value.score;if(Number.isFinite(money))result.money=money;const level=value.maxUnlockedLevel??value.level;if(Number.isFinite(level))result.level=level;}return result;
    }
    function conflict(id,local,remote){const entry={id,name:names(id),local:describe(id,local),cloud:describe(id,remote.data,remote),remoteRevision:remote.revision};state.conflicts=state.conflicts.filter(c=>c.id!==id).concat(entry);}
    async function readAndSync(token,user,{only,resolve}={}){
      active(token,user);if(!transport)throw error('save/unavailable','Cloud saving is not connected.');
      const resets=meta.pendingResets[user]||[];
      if(resets.length){for(const id of resets){active(token,user);await transport.erase(user,id);active(token,user);meta.pendingResets[user]=meta.pendingResets[user].filter(v=>v!==id);delete account().groups[id];persist();}}
      const replacements={},expected={},acc=JSON.parse(JSON.stringify(account()));let wrote=false;
      for(const id of only||[...groups.keys()]){
        active(token,user);let local=snapshot(id),hash=await fingerprint(local);const base=acc.groups[id],remote=await transport.read(user,id);active(token,user);
        if(remote)validate(id,remote.data);
        const remoteHash=remote?.hash||await fingerprint(remote?.data||{}),latest=snapshot(id);
        if(canonical(latest)!==canonical(local)){local=latest;hash=await fingerprint(local);dirty.add(id);}
        const localEmpty=Object.keys(local).length===0;
        if(resolve?.[id]==='cloud'){if(!remote)throw error('save/conflict','The cloud save changed. Sync again before choosing a version.');replacements[id]=remote.data;expected[id]=canonical(local);acc.groups[id]={revision:remote.revision,hash:remoteHash};state.conflicts=state.conflicts.filter(c=>c.id!==id);continue;}
        if(remote&&remoteHash===hash){acc.groups[id]={revision:remote.revision,hash};state.conflicts=state.conflicts.filter(c=>c.id!==id);dirty.delete(id);continue;}
        if(resolve?.[id]==='local'){
          if(signals.get(id)?.revision!==remote?.revision)throw error('save/conflict','The cloud save changed again. Review the refreshed versions before replacing it.');
        }else if(remote){
          const localUnchanged=base?.hash===hash;
          if(localUnchanged||(!base&&!bootHadProgress&&!dirty.has(id)&&meta.owner===user)||(localEmpty&&!dirty.has(id))){replacements[id]=remote.data;expected[id]=canonical(local);acc.groups[id]={revision:remote.revision,hash:remoteHash};continue;}
          if(!base||base.revision!==remote.revision){signals.set(id,remote);conflict(id,local,remote);continue;}
        }else if(base?.revision&&!localEmpty){
          // A missing previously-existing manifest is a cloud deletion, not permission to resurrect it.
          signals.set(id,{revision:null,data:{}});conflict(id,local,{revision:null,data:{},updatedAt:null});continue;
        }
        if(localEmpty&&!remote){acc.groups[id]={revision:null,hash};dirty.delete(id);continue;}
        active(token,user);const result=await transport.write(user,id,{schema:1,data:local,hash,expectedRevision:remote?.revision||null,clientUpdatedAt:Date.now()});active(token,user);
        acc.groups[id]={revision:result.revision,hash};state.conflicts=state.conflicts.filter(c=>c.id!==id);if(canonical(snapshot(id))===canonical(local))dirty.delete(id);else dirty.add(id);wrote=true;
      }
      active(token,user);
      if(Object.keys(replacements).length&&options.canApply&&!options.canApply())throw error('save/menu-required','Return to the main menu to load cloud progress safely.');
      acc.lastSynced=Date.now();state.lastSynced=acc.lastSynced;const previous=meta.accounts[user];meta.accounts[user]=acc;
      if(Object.keys(replacements).length){try{await safeApply(replacements,{reason:'cloud-load',expected});}catch(e){meta.accounts[user]=previous;persist();throw e;}return;}
      persist();
      state.status=state.conflicts.length?'conflict':dirty.size?'pending':'saved';state.error=null;notify();if(dirty.size&&!state.conflicts.length)schedule();return {wrote,conflicts:state.conflicts.length};
    }
    function sync(params={}){return queue(async()=>{if(!uid||stopped||applying)return false;clearTimeout(timer);clearTimeout(retryTimer);firstDirtyAt=0;state.status='syncing';state.error=null;notify();try{if(transition)await transition;if(!ready||meta.owner!==uid){if(await switchOwner(uid))return false;ready=true;}if(applying)return false;const token=generation,user=uid;const result=await readAndSync(token,user,params);retryDelay=15000;return result;}catch(e){if(e.code==='save/cancelled')return false;state.status=e.code==='save/menu-required'?'awaiting-menu':root.navigator?.onLine===false||/unavailable|network/.test(e.code||'')?'offline':'error';state.error=friendly(e);notify();if(state.status==='offline'&&!stopped){retryTimer=setTimeout(()=>sync().catch(()=>{}),retryDelay);retryDelay=Math.min(retryDelay*2,120000);}throw e;}});}
    async function connect(user,newTransport=transport){generation++;clearTimeout(timer);clearTimeout(retryTimer);uid=user||null;transport=newTransport;ready=false;state.conflicts=[];signals.clear();transition=switchOwner(uid);let changed;try{changed=await transition;}catch(e){state.status=e.code==='save/menu-required'?'awaiting-menu':'error';state.error=friendly(e);notify();throw e;}finally{transition=null;}if(changed)return;ready=true;state.lastSynced=uid?account().lastSynced:null;state.status=uid?'pending':'local';notify();if(uid)return sync();}
    async function resolveConflict(id,choice){if(!['local','cloud'].includes(choice)||!state.conflicts.some(c=>c.id===id))throw Error('Choose an existing save conflict.');if(choice==='local')await backup();return sync({only:[id],resolve:{[id]:choice}});}
    async function reset(ids){clearTimeout(timer);clearTimeout(retryTimer);generation++;stopped=true;const affected=ids==null?[...groups.keys()].filter(id=>!['main-settings','main-controls'].includes(id)):ids;
      await chain.catch(()=>{});const owner=meta.owner;
      const resetOwner=owner!=='guest'?owner:null;
      if(resetOwner){meta.pendingResets[resetOwner]=[...new Set([...(meta.pendingResets[resetOwner]||[]),...affected])];persist();}
      // Purge all backups for these games so neither a later account switch nor recovery resurrects a reset.
      for(const key of ['owner:'+owner,'recovery:'+owner]){const saved=await vault.get(key);if(saved){for(const id of affected)delete saved.groups[id];if(affected.includes('platdo-city'))saved.media=[];await vault.put(key,saved);}}
      if(resetOwner&&uid===resetOwner&&transport&&root.navigator?.onLine!==false){try{for(const id of affected){await transport.erase(uid,id);meta.pendingResets[resetOwner]=meta.pendingResets[resetOwner].filter(v=>v!==id);delete account().groups[id];persist();}}catch(e){state.error='Reset saved locally. Cloud deletion is queued and will finish when the connection is available.';}}
      state.status=resetOwner&&meta.pendingResets[resetOwner]?.length?'offline':'local';notify();
    }
    function install(P){
      for(const entry of P.getSaveRegistry?.()||[])register(entry.id,entry.name,entry.keys||[]);
      discover();bootHadProgress=Object.keys(boot).some(k=>groupForKey(k)&&!['main-settings','main-controls'].includes(groupForKey(k)));
      const oldRegister=P.registerGame?.bind(P);P.registerGame=(id,name,keys=[])=>{oldRegister?.(id,name,keys);register(id,name,keys);};
      const oldReset=P.resetGameData?.bind(P);P.resetGameData=async ids=>{await reset(ids);return oldReset?.(ids);};
      // Game stores and the legacy Jump saver all use Storage.setItem; observe successful writes only.
      if(root.Storage&&storage===root.localStorage){previousSet=root.Storage.prototype.setItem;previousRemove=root.Storage.prototype.removeItem;root.Storage.prototype.setItem=function(k,v){const old=this.getItem(k);const result=previousSet.call(this,k,v);if(this===storage&&old!==String(v))mark(String(k));return result;};root.Storage.prototype.removeItem=function(k){const existed=this.getItem(k)!==null;const result=previousRemove.call(this,k);if(this===storage&&existed)mark(String(k));return result;};}
      const onSave=()=>schedule(),onOnline=()=>{if(uid)sync().catch(()=>{});},onStorage=e=>{if(e.key===META){const next=safeJSON(e.newValue,null);if(next?.owner!==meta.owner){stopped=true;generation++;clearTimeout(timer);state.status='error';state.error='Your account changed in another tab. Reloading to protect its saved progress.';notify();Promise.resolve(options.beforeApply?.({reason:'account-changed-in-another-tab'})).then(()=>options.afterApply?.({reason:'account-changed-in-another-tab'})).catch(()=>{});}}else if(groupForKey(e.key))mark(e.key);};
      root.addEventListener?.('platdo:save',onSave);root.addEventListener?.('online',onOnline);root.addEventListener?.('storage',onStorage);
      handles.push(()=>{root.removeEventListener?.('platdo:save',onSave);root.removeEventListener?.('online',onOnline);root.removeEventListener?.('storage',onStorage);});
      return api;
    }
    const api={install,register,connect,sync,resolveConflict,reset,backup,markDirty:mark,snapshot,snapshotAll,validate,
      getState:()=>({...state,owner:meta.owner,uid,conflicts:[...state.conflicts]}),subscribe(fn){listeners.add(fn);fn(api.getState());return()=>listeners.delete(fn);},
      setTransport(value){transport=value;},dispose(){clearTimeout(timer);clearTimeout(retryTimer);stopped=true;generation++;for(const fn of handles)fn();if(previousSet)root.Storage.prototype.setItem=previousSet;if(previousRemove)root.Storage.prototype.removeItem=previousRemove;},
      save(id,value){register(id);storage.setItem('platdo:game:'+id+':cloud-data',JSON.stringify(value));mark('platdo:game:'+id+':cloud-data');},load(id){return safeJSON(storage.getItem('platdo:game:'+id+':cloud-data'),null);}
    };return api;
  }
  root.PlatdoCloudSave={create,createVault,fingerprint,canonical,friendly,META,initial};
})(typeof window!=='undefined'?window:globalThis);
