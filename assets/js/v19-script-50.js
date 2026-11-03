/* Ownership comes from a protected service. Normal saves contain progress, never grants. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.PlatdoPremium=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
const notDeveloper='bro ur not even the dev u think we would let u have ts? oh nah ur dumb asf!';
function create({catalog,identity,read,adminRequest,onChange=()=>{}}){let generation=0,uid=null,status='checking-account',record=null,error=null,admin=null,development=false;
const copy=x=>x?JSON.parse(JSON.stringify(x)):x;
function sameAccount(){const a=identity();return a.ready&&a.permanent&&!!uid&&a.uid===uid;}
function state(){
 if(uid&&(record||admin)&&!sameAccount())return{uid:null,status:'checking-account',error:null,record:null,admin:null,development,verified:false};
 return{uid,status,error,record:copy(record),admin:admin?{expiresAt:admin.expiresAt}:null,development,verified:status==='ready'};
}
function emit(){onChange(state());}
function valid(data,owner){return data?.schema===1&&data.uid===owner&&data.items&&typeof data.items==='object'&&!Array.isArray(data.items)&&data.vip&&typeof data.vip.active==='boolean';}
function invalidate(){generation++;uid=null;record=null;admin=null;error=null;status='checking-account';emit();}
async function refresh(){const account=identity(),next=account.uid||null;if(next!==uid){generation++;uid=next;record=null;admin=null;error=null;}const token=++generation;if(!account.ready){status='checking-account';emit();return state();}if(!account.permanent||!uid){status='guest';record=null;admin=null;emit();return state();}status='checking-ownership';error=null;emit();try{const found=await read(uid);if(token!==generation||identity().uid!==uid)return state();if(!valid(found,uid))throw Error('The ownership service returned an invalid record.');record=copy(found);status='ready';error=null;}catch(e){if(token!==generation)return state();status='unavailable';error=e.message||'Ownership is temporarily unavailable.';admin=null;}emit();return state();}
function access(id){const p=catalog.byId[id];if(!p)return{state:'incompatible',allowed:false};if(status!=='ready')return{state:status,allowed:false,error};if(!sameAccount())return{state:'checking-account',allowed:false};if(p.type==='membership')return{state:record.vip.active?(record.vip.source==='admin-test'?'admin-test':'owned'):'unowned',allowed:record.vip.active,development};const owned=p.itemIds.map(item=>record.items[item]).filter(Boolean),allowed=owned.length===p.itemIds.length;return{state:allowed?(owned.every(x=>x.adminTest)?'admin-test':'owned'):'unowned',allowed,partial:owned.length>0&&!allowed,ownedCount:owned.length,totalCount:p.itemIds.length,development};}
function quote(id) {
  const product = catalog.byId[id];
  if (!product) return null;
  const account = identity();
  const verified = status === 'ready' && account.ready && account.permanent && uid === account.uid;
  const itemIds = [...new Set(product.itemIds)];
  const owned = new Set(verified ? itemIds.filter(item => record.items[item]) : []);
  const baseCents = product.priceCents;
  const complete = itemIds.length > 0 && owned.size === itemIds.length;
  let priceCents = baseCents;
  if (product.includes.length && owned.size) {
    // Price each entitlement once even if it has multiple grant sources.
    const values = new Map();
    for (const componentId of product.includes) {
      const component = catalog.byId[componentId];
      const items = [...new Set(component.itemIds)];
      for (const item of items) values.set(item, component.priceCents / items.length);
    }
    let totalValue = 0, remainingValue = 0;
    for (const [item, value] of values) {
      totalValue += value;
      if (!owned.has(item)) remainingValue += value;
    }
    priceCents = complete ? 0 : Math.round(baseCents * remainingValue / totalValue);
  }
  return {baseCents, priceCents, discountCents:baseCents-priceCents, ownedCount:owned.size,
    totalCount:itemIds.length, complete, verified};
}
async function unlock(code){if(!adminRequest)throw Error('Protected production admin service is not configured.');const a=identity();if(!a.ready||!a.permanent||!a.uid)throw Error(notDeveloper);const token=generation,owner=uid;const response=await adminRequest('/admin/unlock',{code});if(token!==generation||owner!==uid||identity().uid!==owner)throw Error('Account changed. The admin response was discarded.');if(!response?.token||!Number.isFinite(response.expiresAt))throw Error('Invalid admin session.');admin=response;emit();return{expiresAt:admin.expiresAt};}
async function request(path,body){
 const session=admin,owner=uid,stamp=generation,a=identity();
 if(!session||session.expiresAt<=Date.now()||!a.ready||!a.permanent||!owner||a.uid!==owner){admin=null;emit();throw Error('Unlock Mega Admin again.');}
 let result;
 try{result=await adminRequest(path,body,session.token);}catch(e){
   if(admin===session&&(e.code==='permission-denied'||e.code==='unauthenticated')){
     admin=null;emit();throw Error('Your admin session ended. Enter your password again.');
   }
   throw e;
 }
 if(stamp!==generation||owner!==uid||identity().uid!==owner||session!==admin)throw Error('Account or session changed. The operation response was discarded.');
 return result;
}
async function action(value){const result=await request('/admin/action',value);if(!valid(result,uid))throw Error('Invalid ownership response.');record=copy(result);status='ready';emit();return state();}
return{state,refresh,access,quote,invalidate,unlock,action,directory:()=>request('/admin/directory'),endAdmin(){const token=admin?.token;admin=null;emit();if(token&&adminRequest)adminRequest('/admin/end',{},token).catch(()=>{});},setDevelopment(value){development=value===true;}};
}
if(typeof window==='undefined')return{create};
const catalog=root.PlatdoPremiumCatalog,listeners=new Set(),adapters=new Map();let initialized=false,manager,dev=null,lastAccount=null;
function eligibility(){if(dev)return{ready:true,uid:'local-development-owner',permanent:true,isAnonymous:false};const a=root.PlatdoAccount?.getAccountEligibility?.();if(a)return a;const s=root.PlatdoAccount?.getState?.();return{ready:s?.ready===true,uid:s?.user?.uid||null,permanent:s?.status==='signed-in'&&s?.user?.isAnonymous===false,isAnonymous:s?.user?.isAnonymous!==false};}
function emit(s){for(const fn of listeners)fn(s);root.dispatchEvent(new CustomEvent('platdo:premiumchange',{detail:s}));}
async function devRequest(route,body,session){if(!dev)throw Error('No protected admin service is connected.');const r=await fetch(dev.endpoint+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+dev.capability,'Content-Type':'application/json',...(session?{'X-Platdo-Admin':session}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});const result=await r.json();if(!r.ok)throw Error(result.error||'The protected request failed.');if(result.mode!=='isolated-development'||result.uid!=='local-development-owner')throw Error('Unexpected development service response.');return result.data;}

const denied=e=>e?.code==='permission-denied'||e?.code==='unauthenticated';
async function cloud(){
  if(root.location.protocol==='file:')throw Error('Open the online game to verify your account.');
  const sdk='https://www.gstatic.com/firebasejs/13.1.0/';
  const [A,F]=await Promise.all([import(sdk+'firebase-app.js'),import(sdk+'firebase-firestore.js')]);
  return {F,db:F.getFirestore(A.getApp('platdo-accounts'))};
}
function decodeOwnership(uid,receipt,bonus){
  const data=receipt.exists()?receipt.data():{schema:1,uid,sources:{}};
  if(data.schema!==1||data.uid!==uid||!data.sources)throw Error('Unsupported entitlement record.');
  const items={},known=new Set(catalog.products.flatMap(p=>p.itemIds));
  for(const [item,sources] of Object.entries(data.sources)){
    if(!known.has(item))continue;
    const active=Object.entries(sources||{}).filter(([,s])=>s&&['admin-test','verified-purchase'].includes(s.kind));
    if(active.length)items[item]={sources:active.map(([id,s])=>({id,kind:s.kind,productId:s.productId})),adminTest:active.every(([,s])=>s.kind==='admin-test')};
  }
  let vip={active:data.vip?.active===true,source:data.vip?.source||null};
  if(bonus?.exists()){
    const grant=bonus.data();
    if(grant.schema!==1||grant.uid!==uid||grant.kind!=='admin-test'||grant.vip!==true||!Array.isArray(grant.itemIds))throw Error('Invalid shop grant record.');
    for(const item of new Set(grant.itemIds)){
      if(!known.has(item))continue;
      const owned=items[item]??={sources:[],adminTest:true};
      owned.sources.push({id:'admin-shop',kind:'admin-test'});
    }
    if(!vip.active)vip={active:true,source:'admin-test'};
  }
  return {schema:1,uid,revision:data.revision||0,items,vip};
}
async function readCloud(uid){
  if(dev)return devRequest('/ownership');
  const {F,db}=await cloud(),get=collection=>F.getDocFromServer(F.doc(db,collection,uid));
  const [receipt,bonus]=await Promise.all([get('premiumEntitlements'),get('premiumShopGrants').catch(e=>{
    if(denied(e))return null;
    throw e;
  })]);
  return decodeOwnership(uid,receipt,bonus);
}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
async function adminRequest(route,body,token){
  if(dev)return devRequest(route,body,token);
  const account=eligibility(),uid=account.uid;
  if(!account.ready||!account.permanent||!uid)throw Error(notDeveloper);
  const {F,db}=await cloud(),operator=(...path)=>F.doc(db,'premiumOperators',uid,...path);
  const sameOwner=()=>{const a=eligibility();if(!a.ready||!a.permanent||a.uid!==uid)throw Error('Your account changed. Open Mega Admin again.');};
  sameOwner();
  if(route==='/admin/unlock'){
    const marker=await F.getDocFromServer(operator('access','status')).catch(e=>{if(denied(e))throw Error(notDeveloper);throw e;});
    if(!marker.exists()||marker.data().enabled!==true)throw Error(notDeveloper);
    const bytes=new TextEncoder().encode('PLATDO-MEGA-ADMIN-V1\n'+uid+'\n'+body.code);
    const digest=hex(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)));
    sameOwner();
    await F.setDoc(operator('attempts','current'),{digest,at:F.serverTimestamp()}).catch(e=>{
      if(denied(e))throw Error('Wait five seconds before trying again.');
      throw e;
    });
    const verifier=await F.getDocFromServer(operator('codes',digest)).catch(e=>{if(denied(e))throw Error('Incorrect admin password.');throw e;});
    const proof=verifier.exists()&&verifier.data().proof;
    if(typeof proof!=='string'||!/^[a-f0-9]{64}$/.test(proof))throw Error('Incorrect admin password.');
    sameOwner();
    const token=hex(root.crypto.getRandomValues(new Uint8Array(16)));
    await F.setDoc(operator('sessions','current'),{token,proof,openedAt:F.serverTimestamp()});
    return {token,expiresAt:Date.now()+600000};
  }
  if(route==='/admin/end'){
    await F.setDoc(operator('sessions','current'),{token,closed:true});
    return;
  }
  if(route!=='/admin/action'||body.type!=='unlock-shop-items')throw Error('This action is only available on the protected development server.');
  const catalogItems=catalog.products.filter(p=>p.availability!=='retired'&&p.type==='one-time').flatMap(p=>p.itemIds);
  const grantRef=F.doc(db,'premiumShopGrants',uid);
  await F.runTransaction(db,async tx=>{
    const prior=await tx.get(grantRef),existing=prior.exists()?prior.data():null;
    sameOwner();
    if(existing&&(!Array.isArray(existing.itemIds)||existing.uid!==uid||existing.schema!==1||existing.kind!=='admin-test'))throw Error('Invalid shop grant record.');
    const itemIds=[...new Set([...(existing?.itemIds||[]),...catalogItems])].sort();
    if(existing?.vip===true&&catalogItems.every(item=>existing.itemIds.includes(item)))return;
    tx.set(grantRef,{schema:1,uid,kind:'admin-test',itemIds,vip:true,token,updatedAt:F.serverTimestamp()});
  });
  sameOwner();
  return readCloud(uid);
}
function initialize(){if(initialized)return;initialized=true;manager=create({catalog,identity:eligibility,read:readCloud,adminRequest,onChange:emit});root.Platdo?.registerGame?.('premium','Premium activity progress',[]);root.PlatdoAccount?.subscribe?.(()=>{const a=eligibility(),signature=[a.ready,a.uid,a.permanent].join(':');if(signature!==lastAccount){lastAccount=signature;manager.refresh();}});root.addEventListener('platdo:beforereset',()=>{manager.invalidate();root.PlatdoPremiumActivities?.close?.();});manager.refresh();}
const api={create,initialize,subscribe(fn){listeners.add(fn);if(manager)fn(manager.state());return()=>listeners.delete(fn);},getState(){initialize();return manager.state();},refresh(){initialize();return manager.refresh();},access(id){initialize();return manager.access(id);},unlock(code){initialize();return manager.unlock(code);},adminAction(value){initialize();return manager.action(value);},directory(){initialize();return manager.directory();},endAdmin(){manager?.endAdmin();},registerAdapter(id,adapter){adapters.set(id,adapter);},adapter:id=>adapters.get(id),async use(id,options={}){const access=api.access(id);if(!access.allowed)throw Error(access.error||'This content is not available to this account.');const adapter=adapters.get(id);if(!adapter?.open)throw Error('This product is not implemented yet. No content has been equipped.');return adapter.open(options);},async connectDevelopment({endpoint,capability}){const url=new URL(endpoint);if(!['localhost','127.0.0.1'].includes(location.hostname)||location.protocol!=='http:'||url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!capability||capability.length<40)throw Error('An operator-started local service and its temporary capability are required.');manager?.invalidate();dev={endpoint:url.origin,capability};initialize();manager.setDevelopment(true);return manager.refresh();},disconnectDevelopment(){manager?.invalidate();dev=null;manager?.setDevelopment(false);manager?.refresh();}};
api.quote=function(id){initialize();return manager.quote(id);};
root.addEventListener?.('platdo:ready',initialize,{once:true});return api;
});
