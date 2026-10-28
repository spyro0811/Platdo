/* Real Firebase Google accounts. No server credentials or fabricated local authentication. */
(function(root){
  'use strict';
  const config=Object.freeze({apiKey:'AIzaSyCc4JFX2b_k3mnOHrJHjGsfffDvYUvBRB8',authDomain:'platdo-f227c.firebaseapp.com',projectId:'platdo-f227c',storageBucket:'platdo-f227c.firebasestorage.app',messagingSenderId:'288421495462',appId:'1:288421495462:web:a9b6412241f5346f502a67',measurementId:'G-4WD4NKG3FG'});
  const SDK='https://www.gstatic.com/firebasejs/13.1.0/';
  const listeners=new Set();let started,modules,auth,db,engine,authGeneration=0,authWork=Promise.resolve(),communityBusy=false;
  const state={status:'guest',user:null,syncStatus:'local',lastSynced:null,error:null,conflicts:[],ready:false,mediaNote:'Phone photos and recordings stay on this device. Other saved game progress syncs with your account.'};
  const clone=()=>({...state,user:state.user?{...state.user}:null,conflicts:[...state.conflicts]});
  function emit(){for(const fn of listeners)try{fn(clone());}catch(_){}root.dispatchEvent?.(new CustomEvent('platdo:accountchange',{detail:clone()}));}
  function fail(code,message){return Object.assign(new Error(message),{code});}
  function authError(e){
    const code=e?.code||'';
    if(code==='auth/unauthorized-domain')return 'Google sign-in is not authorized for this website yet. Add both platdo-collection-download.nate63537464.chatgpt.site and platdo-collection-download.calm-moon-0318.chatgpt.site in Firebase Authentication → Settings → Authorized domains.';
    if(code==='auth/popup-closed-by-user'||code==='auth/cancelled-popup-request')return 'Sign-in was cancelled. You can keep playing as a guest.';
    if(code==='auth/popup-blocked')return 'The browser blocked Google sign-in. Allow the sign-in popup or use Continue in this tab.';
    if(code==='auth/operation-not-allowed')return 'Google sign-in must be enabled in this project’s Firebase Authentication settings.';
    if(code==='auth/account-exists-with-different-credential')return 'This email already uses a different sign-in method. Use its original provider in Firebase.';
    if(code==='auth/network-request-failed'||root.navigator?.onLine===false)return 'Offline — local progress is safe. Connect to the internet to sign in and sync.';
    return root.PlatdoCloudSave?.friendly(e)||e?.message||'Sign-in could not finish.';
  }
  function publicUser(user,profile={}){return{uid:user.uid,displayName:profile.displayName||user.displayName||'Platdo player',email:user.email||'',photoURL:profile.photoDataURL||user.photoURL||'',createdAt:user.metadata?.creationTime||null,lastSignInAt:user.metadata?.lastSignInTime||null};}
  function assertUser(uid){if(!auth?.currentUser||auth.currentUser.uid!==uid)throw fail('save/cancelled','Your account changed; this operation was cancelled.');}
  function timestamp(value){return typeof value?.toMillis==='function'?value.toMillis():null;}
  function bytesToBase64(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
  function base64ToBytes(text){const raw=atob(text),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}
  function makeTransport(F){
    const ref=(uid,id)=>F.doc(db,'users',uid,'experiences',id), chunks=(uid,id)=>F.collection(db,'users',uid,'experiences',id,'chunks');
    const revision=()=>root.crypto.randomUUID().replace(/-/g,'');
    async function removeCapturedChunks(uid,docs){for(let n=0;n<docs.length;n+=200){assertUser(uid);const batch=F.writeBatch(db);for(const d of docs.slice(n,n+200))batch.delete(d.ref);await batch.commit();}}
    return{
      async read(uid,id){assertUser(uid);const manifest=await F.getDocFromServer(ref(uid,id));assertUser(uid);if(!manifest.exists())return null;const m=manifest.data();if(m.schema!==1||typeof m.revision!=='string'||!Number.isInteger(m.chunks)||m.chunks<0||m.chunks>1024)throw fail('save/invalid','This cloud save uses an unsupported format. Local progress is unchanged.');if(m.deleted)return{revision:m.revision,data:{},hash:await root.PlatdoCloudSave.fingerprint({}),updatedAt:timestamp(m.updatedAt)};
        const parts=[];let length=0;for(let i=0;i<m.chunks;i++){assertUser(uid);const part=await F.getDocFromServer(F.doc(chunks(uid,id),m.revision+'-'+String(i).padStart(4,'0')));if(!part.exists()||part.data().revision!==m.revision||part.data().index!==i)throw fail('save/incomplete','The cloud save is incomplete. Your local progress has been kept.');const bytes=base64ToBytes(part.data().data);parts.push(bytes);length+=bytes.length;if(length>64*1024*1024)throw fail('save/invalid','The cloud save is too large.');}
        const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));const hash=await root.PlatdoCloudSave.fingerprint(data);if(hash!==m.hash)throw fail('save/invalid','The cloud save failed its integrity check. Local progress is unchanged.');assertUser(uid);return{revision:m.revision,data,hash,updatedAt:timestamp(m.updatedAt)};
      },
      async write(uid,id,save){assertUser(uid);const rev=revision(),text=root.PlatdoCloudSave.canonical(save.data),bytes=new TextEncoder().encode(text),size=180*1024,count=Math.ceil(bytes.length/size);if(bytes.length>64*1024*1024)throw fail('save/too-large','This save exceeds the 64 MB cloud limit. It remains saved locally.');
        // Upload immutable chunks first; only a successful compare-and-swap exposes the new snapshot.
        for(let i=0;i<count;i++){assertUser(uid);await F.setDoc(F.doc(chunks(uid,id),rev+'-'+String(i).padStart(4,'0')),{schema:1,revision:rev,index:i,data:bytesToBase64(bytes.subarray(i*size,(i+1)*size))});}
        await F.runTransaction(db,async tx=>{assertUser(uid);const current=await tx.get(ref(uid,id));const actual=current.exists()?current.data().revision:null;if(actual!==save.expectedRevision)throw fail('save/conflict','Another device saved newer progress. Sync again to choose which version to keep.');tx.set(ref(uid,id),{schema:1,revision:rev,chunks:count,bytes:bytes.length,hash:save.hash,deleted:false,clientUpdatedAt:save.clientUpdatedAt,updatedAt:F.serverTimestamp()});});
        // Old chunks are retained until the next reset; deleting after commit would race a second device reading them.
        return{revision:rev};
      },
      async erase(uid,id){assertUser(uid);const captured=await F.getDocsFromServer(chunks(uid,id));assertUser(uid);await F.setDoc(ref(uid,id),{schema:1,revision:revision(),chunks:0,bytes:0,hash:await root.PlatdoCloudSave.fingerprint({}),deleted:true,clientUpdatedAt:Date.now(),updatedAt:F.serverTimestamp()});await removeCapturedChunks(uid,captured.docs);}
    };
  }
  async function initialize(){
    if(started)return started;
    started=(async()=>{
      if(!root.PlatdoCloudSave||!root.Platdo)throw Error('Platdo save platform is not ready.');
      if(!engine){engine=root.PlatdoCloudSave.create({canApply:()=>root.Platdo.canApplyCloudSave?.()!==false,beforeApply:async details=>{if(typeof root.Platdo.prepareCloudSaveReload!=='function')throw fail('save/menu-required','This game build cannot safely reload cloud saves yet.');await root.Platdo.prepareCloudSaveReload(details);},afterApply:()=>root.location.reload()});
        engine.install(root.Platdo);root.PlatdoSaveManager=engine;
        engine.subscribe(s=>{state.syncStatus=s.status;state.lastSynced=s.lastSynced;state.conflicts=s.conflicts;if(s.error)state.error=s.error;else if(s.status==='saved'||s.status==='local')state.error=null;emit();});}
      if(root.location.protocol==='file:'){state.status='guest';state.ready=true;state.error='Offline HTML keeps local saves. Open the online Platdo website to use Google sign-in and cloud saves.';emit();return false;}
      state.status='connecting';emit();
      try{
        const [A,U,F]=await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),import(SDK+'firebase-firestore.js')]);modules={A,U,F};const app=A.getApps().find(a=>a.name==='platdo-accounts')||A.initializeApp(config,'platdo-accounts');auth=U.getAuth(app);db=F.getFirestore(app);await U.setPersistence(auth,U.browserLocalPersistence);engine.setTransport(makeTransport(F));
        U.onAuthStateChanged(auth,user=>{const token=++authGeneration;authWork=authWork.catch(()=>{}).then(async()=>{
          if(token!==authGeneration)return;state.user=user?publicUser(user):null;state.status=user?'signed-in':'guest';state.ready=true;state.error=null;emit();
          try{await engine.connect(user?.uid||null);if(user&&token===authGeneration){const userRef=F.doc(db,'users',user.uid);const existing=await F.getDocFromServer(userRef);assertUser(user.uid);const profile=existing.exists()?existing.data():{};await F.setDoc(userRef,{schema:1,displayName:user.displayName||profile.displayName||'Platdo player',email:user.email||'',lastSignInAt:F.serverTimestamp(),...(existing.exists()?{}:{createdAt:F.serverTimestamp()})},{merge:true});if(token===authGeneration){state.user=publicUser(user,profile);emit();}}}
          catch(e){if(token!==authGeneration)return;state.error=authError(e);emit();}
        });},e=>{state.status='error';state.ready=true;state.error=authError(e);emit();});
        await U.getRedirectResult(auth).catch(e=>{state.error=authError(e);emit();});return true;
      }catch(e){state.status='error';state.ready=true;state.error=authError(e);console.error('PLATDO Firebase initialization failed:',e.code||e.message);started=null;emit();return false;}
    })();return started;
  }
  async function requireFirebase(){await initialize();if(!modules||!auth)throw fail('auth/unavailable',state.error||'Connect to the internet to use Google sign-in.');return modules;}
  async function signIn(options={}){await requireFirebase();state.error=null;state.status='signing-in';emit();const provider=new modules.U.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
    try{if(options.redirect)return await modules.U.signInWithRedirect(auth,provider);await modules.U.signInWithPopup(auth,provider);await authWork;return true;}catch(e){state.status=auth.currentUser?'signed-in':'guest';state.error=authError(e);emit();throw e;}}
  async function syncNow(){root.Platdo?.saveProgress?.();if(!engine)return false;return engine.sync();}
  async function signOut(){await requireFirebase();if(root.Platdo.canApplyCloudSave?.()===false)throw fail('save/menu-required','Return to the main menu before signing out.');root.Platdo?.saveProgress?.();await engine.backup();try{await engine.sync();}catch(e){state.error=authError(e);}await modules.U.signOut(auth);await authWork;}
  async function updateProfilePicture(file){await requireFirebase();const user=auth.currentUser;if(!user)throw fail('auth/sign-in-required','Sign in to change your profile picture.');if(!(file instanceof Blob)||!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>12*1024*1024)throw Error('Choose a PNG, JPEG, WebP, or GIF image under 12 MB.');
    const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),side=Math.min(bitmap.width,bitmap.height);c.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);bitmap.close();const data=canvas.toDataURL('image/jpeg',.82);if(data.length>200000)throw Error('This image is too large after resizing. Try a smaller image.');assertUser(user.uid);await modules.F.setDoc(modules.F.doc(db,'users',user.uid),{schema:1,photoDataURL:data,updatedAt:modules.F.serverTimestamp()},{merge:true});assertUser(user.uid);state.user={...state.user,photoURL:data};emit();return data;
  }
  function updateId(id){if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Invalid update.');return id;}
  async function communityUser(){await requireFirebase();const user=auth.currentUser;if(!user)throw fail('auth/sign-in-required','Sign in to join the discussion.');return user;}
  async function getUpdateEngagement(id){await requireFirebase();updateId(id);const F=modules.F,base=F.collection(db,'updates',id,'reactions');
    const [likes,dislikes,comments,mine]=await Promise.all([F.getCountFromServer(F.query(base,F.where('value','==','like'))),F.getCountFromServer(F.query(base,F.where('value','==','dislike'))),F.getDocsFromServer(F.query(F.collection(db,'updates',id,'comments'),F.orderBy('createdAt','desc'),F.limit(50))),auth.currentUser?F.getDocFromServer(F.doc(base,auth.currentUser.uid)):Promise.resolve(null)]);
    return{likes:likes.data().count,dislikes:dislikes.data().count,myReaction:mine?.exists()?mine.data().value:null,comments:comments.docs.map(d=>({id:d.id,...d.data(),createdAt:timestamp(d.data().createdAt)}))};
  }
  async function reactToUpdate(id,value){const user=await communityUser();updateId(id);if(!['like','dislike',null].includes(value))throw Error('Invalid reaction.');const F=modules.F,ref=F.doc(db,'updates',id,'reactions',user.uid);assertUser(user.uid);if(value===null)await F.deleteDoc(ref);else await F.setDoc(ref,{uid:user.uid,value,updatedAt:F.serverTimestamp()});return getUpdateEngagement(id);}
  async function addUpdateComment(id,text){const user=await communityUser();updateId(id);text=String(text).trim();if(!text||text.length>1200)throw Error('Write a comment between 1 and 1,200 characters.');if(communityBusy)throw Error('Please wait for your previous comment to finish.');communityBusy=true;try{const F=modules.F;assertUser(user.uid);await F.addDoc(F.collection(db,'updates',id,'comments'),{uid:user.uid,displayName:state.user?.displayName||'Platdo player',photoURL:/^https:\/\//.test(user.photoURL||'')?user.photoURL:'',text,createdAt:F.serverTimestamp()});return getUpdateEngagement(id);}finally{communityBusy=false;}}
  async function deleteOwnComment(id,commentId){const user=await communityUser();updateId(id);updateId(commentId);const F=modules.F,ref=F.doc(db,'updates',id,'comments',commentId),item=await F.getDocFromServer(ref);if(!item.exists()||item.data().uid!==user.uid)throw Error('Only the author can remove this comment.');await F.deleteDoc(ref);return getUpdateEngagement(id);}
  const api={initialize,getState:clone,subscribe(fn){listeners.add(fn);fn(clone());return()=>listeners.delete(fn);},signIn,signOut,syncNow,updateProfilePicture,resolveConflict:(id,choice)=>engine.resolveConflict(id,choice),getUpdateEngagement,reactToUpdate,addUpdateComment,deleteOwnComment,config,SDK_VERSION:'13.1.0',formatError:authError};
  root.PlatdoAccount=api;
  root.addEventListener?.('online',()=>{if(!auth&&root.Platdo&&root.location.protocol!=='file:')initialize().catch(()=>{});});
})(typeof window!=='undefined'?window:globalThis);
