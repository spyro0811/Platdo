/* PLATDO's shared front door. Gameplay and saves remain owned by each game. */
(function (global) {
 'use strict';
 if (global.PlatdoHub) return;
 const routes={'platdo-city':'city','platdo-drive':'drive','platdo-jump':'platdo','platdo-swing':'swing','code-platdo':'field','platdo-god-core':'god-core'};
 const aliases={city:'platdo-city',drive:'platdo-drive',jump:'platdo-jump',swing:'platdo-swing',code:'code-platdo',godcore:'platdo-god-core'};
 const titles={'platdo-jump':'PLATDO Jump','platdo-swing':'PLATDO Swing','code-platdo':'Code Platdo','platdo-god-core':'PLATDO God Core'};
 const launchers={'platdo-jump':'openPlatdoBtn','platdo-swing':'openSwingBtn','code-platdo':'openFieldBtn','platdo-god-core':'openGodCoreBtn'};
 let disposeAccount=null;
 let home,panel,body,heading,badge,ready=false,screen=null,stack=[],previousFocus=null,computerReturn=null,computerSession=false,routeGeneration=0;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const avatar='<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14" r="7"/><path d="M7 36c0-9 5-14 13-14s13 5 13 14"/></svg>';
 const icons={stats:'<path d="M5 20V10m7 10V4m7 16v-7"/>',settings:'<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>',updates:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4M12 2v2"/>'};
 const icon=name=>'<svg class="pp-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
 function state(){return global.PlatdoAccount?.getState?.()||{status:'loading',user:null,syncStatus:'local'};}
 function safePhoto(url){try{const u=new URL(url,location.href);return ['https:','data:','blob:'].includes(u.protocol)?url:'';}catch{return '';}}
 function avatarHTML(user,cls=''){const src=safePhoto(user?.photoURL);return '<span class="pp-avatar '+cls+'">'+(src?'<img src="'+escape(src)+'" alt="">':avatar)+'</span>';}
 function clearInputs(){global.Platdo?.controls?.clear?.();document.activeElement?.blur?.();if(document.pointerLockElement)document.exitPointerLock?.();}
 function accountBadge(){if(!badge)return;const s=state(),user=s.user;badge.innerHTML='<span><strong>'+escape(user?.displayName||'Log In')+'</strong><small>'+escape(user?syncLabel(s):'Save across devices')+'</small></span>'+avatarHTML(user);badge.setAttribute('aria-label',user?'Account settings for '+user.displayName:'Log In');const create=home?.querySelector('#ppCreateAccount');if(create)create.hidden=!!user;}
 function syncLabel(s){const labels={saved:'Cloud saved',synced:'Cloud saved',syncing:'Saving to cloud…',offline:'Offline · saved here',local:'Saved on this device',conflict:'Choose a save',error:'Cloud needs attention',loading:'Checking cloud saves…',pending:'Waiting to sync',ready:'Cloud ready'};return labels[s.syncStatus]||s.syncStatus||'Saved on this device';}
 function showPanel(kind,title,render,{push=true}={}) {
  if(!screen)previousFocus=document.activeElement;clearInputs();
  if(screen&&push)stack.push({...screen});
  if(disposeAccount){disposeAccount();disposeAccount=null;}global.PlatdoPages?.destroy?.(body);screen={kind,title,render};panel.hidden=false;home?.setAttribute('inert','');
  document.getElementById('cityRoot')?.setAttribute('inert','');document.getElementById('driveRoot')?.setAttribute('inert','');
  document.documentElement.dataset.platformPanel=kind;heading.textContent=title;body.replaceChildren();render(body);panel.querySelector('.pp-back').focus({preventScroll:true});
 }
 function closePanel(){if(!panel)return;if(disposeAccount){disposeAccount();disposeAccount=null;}global.PlatdoPages?.destroy?.(body);screen=null;stack=[];panel.hidden=true;delete document.documentElement.dataset.platformPanel;home?.removeAttribute('inert');document.getElementById('cityRoot')?.removeAttribute('inert');document.getElementById('driveRoot')?.removeAttribute('inert');clearInputs();if(previousFocus?.isConnected&&!previousFocus.closest('[hidden]'))previousFocus.focus({preventScroll:true});}
 function back(){if(stack.length){const next=stack.pop();showPanel(next.kind,next.title,next.render,{push:false});}else{const fromComputer=screen?.kind==='computer';closePanel();if(fromComputer&&computerReturn){const callback=computerReturn;computerReturn=null;computerSession=false;callback();}}}
 function openStats(){showPanel('stats','Statistics',el=>global.PlatdoPages.renderStats(el,'platdo-drive'));}
 function renderUpdates(el,context={}){global.PlatdoPages.renderUpdates(el,{currentRelease:global.PlatdoReleaseData[0],...context,onSignIn:request=>{if(screen?.kind==='updates')screen={...screen,render:target=>renderUpdates(target,{focusUpdateId:request.updateId,openCommentId:request.action==='comment'?request.updateId:null})};openAccount();}});}
 function openUpdates(context={}){showPanel('updates','Plato Update Hub',el=>renderUpdates(el,context));}
 function openSettings(){closePanel();clearInputs();document.getElementById('mainSettingsDialog').showModal();}
 function errorText(error){return typeof error==='string'?error:error?.message||error?.code||'';}
 function openAccount(initial='account'){
  showPanel('account',initial==='create'?'Create Account':initial==='login'?'Log In':'Account settings',target=>{disposeAccount=global.PlatdoAccountView.mount(target,initial);});
 }
 function multiplayer(game='city'){
  if(global.PlatdoFriends)return global.PlatdoFriends.open(game);
  const title=game==='drive'?'Drive multiplayer':'City multiplayer';
  showPanel('multiplayer',title,el=>{el.innerHTML='<div class="pp-lobby"><div class="pp-lobby-intro"><span class="pp-chip">Coming soon</span><h2>One lobby. City and Drive.</h2><p>City and Drive will share the same servers. Choose where to start playing with your group.</p></div><div class="pp-lobby-actions"><button id="ppHost">Host a lobby</button><button id="ppPrivate">Join private</button></div><section class="pp-server-list" aria-label="Public servers"><div class="pp-list-heading"><h3>Public servers</h3><span>Up to 30 players</span></div><p>Multiplayer servers are not connected yet. Public lobbies will appear here when multiplayer launches.</p></section><p class="pp-note">Single-player City and solo Drive remain available independently.</p></div>';el.querySelector('#ppHost').onclick=()=>host(game);el.querySelector('#ppPrivate').onclick=()=>privateLobby(game);});
 }
 function host(game){showPanel('host','Host a lobby',el=>{el.innerHTML='<form class="pp-lobby-form"><span class="pp-chip">Coming soon</span><h2>Lobby settings</h2><fieldset><legend>Visibility</legend><label><input name="visibility" type="radio" value="public" checked> Public</label><label><input name="visibility" type="radio" value="private"> Private · five-digit code</label></fieldset><label>Maximum players<input id="ppLobbyPlayers" type="number" min="2" max="30" value="8" inputmode="numeric"></label><label>Start in<select id="ppLobbyDestination"><option value="city" '+(game==='city'?'selected':'')+'>Platdo City</option><option value="drive" '+(game==='drive'?'selected':'')+'>Platdo Drive</option></select></label><label>Game mode<select id="ppLobbyMode"></select></label><button type="submit" disabled>Start · Coming soon</button><p role="status">Lobby hosting will be enabled when servers are connected. No lobby or join code has been created.</p></form>';const select=el.querySelector('#ppLobbyDestination'),mode=el.querySelector('#ppLobbyMode');const modes=()=>{mode.innerHTML=select.value==='city'?'<option>Sandbox</option>':'<option>Free Drive</option><option>Time Trial</option><option>Traffic Rush</option>';};select.onchange=modes;modes();el.querySelector('form').onsubmit=e=>e.preventDefault();el.querySelector('#ppLobbyPlayers').onchange=e=>e.target.value=Math.max(2,Math.min(30,Number(e.target.value)||2));});}
 function privateLobby(game){showPanel('private','Join a private lobby',el=>{el.innerHTML='<div class="pp-private"><span class="pp-chip">Coming soon</span><h2>Enter the lobby code</h2><p>Use the five-digit code shared by your host.</p><input id="ppPrivateCode" aria-label="Five-digit lobby code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="off" placeholder="— — — — —"><div class="pp-keypad" aria-label="Lobby code keypad">'+[1,2,3,4,5,6,7,8,9,'Clear',0,'⌫'].map(v=>'<button data-digit="'+v+'" aria-label="'+(v==='⌫'?'Delete last digit':v)+'">'+v+'</button>').join('')+'</div><button id="ppJoinPrivate" disabled>Join · Coming soon</button><p role="status">Codes cannot be checked until multiplayer servers are connected.</p></div>';const input=el.querySelector('#ppPrivateCode');input.oninput=()=>input.value=input.value.replace(/\D/g,'').slice(0,5);el.querySelectorAll('[data-digit]').forEach(b=>b.onclick=()=>{input.value=b.dataset.digit==='Clear'?'':b.dataset.digit==='⌫'?input.value.slice(0,-1):(input.value+b.dataset.digit).slice(0,5);input.dispatchEvent(new Event('input'));});});}
 function computer(callback){computerReturn=callback;computerSession=true;showPanel('computer','Gaming computer',el=>{el.innerHTML='<p class="pp-library-intro">Choose a game. Your City character will stay at the desk.</p><div class="pp-library">'+Object.entries(titles).map(([id,title])=>{const img=document.getElementById(launchers[id])?.querySelector('img');return '<button data-play-game="'+id+'">'+(img?'<img src="'+escape(img.src)+'" alt="">':'')+'<strong>'+title+'</strong><span>Play</span></button>';}).join('')+'</div>';el.querySelectorAll('[data-play-game]').forEach(b=>b.onclick=()=>openGame(b.dataset.playGame,{fromCity:true}));});}
 function openGame(id,options={}){id=aliases[id]||id;if(!routes[id])return false;if(global.PlatdoAccount&&!global.PlatdoAccount.canPlay()){openAccount();return false;}if(options.fromCity&&options.returnToCity){computerReturn=options.returnToCity;computerSession=true;}else if(!options.fromCity){computerReturn=null;computerSession=false;}closePanel();clearInputs();global.PlatdoCity?.stopMenuPreview?.();if(id==='platdo-city')global.PlatdoCity?.enableSound?.();global.Platdo?.playGameOpenSound?.();location.hash=routes[id];return true;}
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
  if(document.querySelector('dialog.pg-backdrop[open],.premium-overlay'))return;
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
  home=document.createElement('section');home.id='platdoPlatformHome';home.className='pp-ui';home.innerHTML='<header class="pp-home-header"><h1>PLATDO<span>CITY</span></h1><div class="pp-account-nav"><button id="ppCreateAccount" class="pp-secondary">Create Account</button><button id="ppAccount" class="pp-account-button"></button></div></header><nav class="pp-primary-nav" aria-label="Play"><button id="ppEnterCity">Enter City<span aria-hidden="true">→</span></button><button id="ppJustDrive">Just Drive<span aria-hidden="true">→</span></button></nav><p id="ppWorldStatus" role="status"></p><footer class="pp-home-footer"><span class="pp-version">PLATDO · V'+global.PlatdoReleaseData[0].version+'</span><nav aria-label="Main menu pages"><button id="ppFriends" data-pf-main>Friends</button><button id="ppStats">Stats</button><span id="ppSettingsSlot"></span><button id="ppUpdates">Updates</button><button id="ppShop">Shop</button></nav></footer>';hub.append(home);home.querySelector('#ppFriends').onclick=()=>multiplayer('city');home.querySelector('#ppShop').onclick=()=>global.PlatdoPremiumShop?.open();const admin=document.createElement('button');admin.type='button';admin.textContent='Mega Admin';admin.className='pp-secondary';admin.onclick=()=>{settings.close();global.PlatdoPremiumShop?.openAdmin();};settings.append(admin);
  home.querySelector('#ppSettingsSlot').replaceWith(settingsButton);settingsButton.hidden=false;settingsButton.removeAttribute('aria-hidden');settingsButton.removeAttribute('style');settingsButton.textContent='Settings';
  settingsButton.innerHTML=icon('settings')+'Settings';home.querySelector('#ppStats').innerHTML=icon('stats')+'Stats';home.querySelector('#ppUpdates').innerHTML=icon('updates')+'Updates';
  badge=home.querySelector('#ppAccount');badge.onclick=()=>openAccount();home.querySelector('#ppCreateAccount').onclick=()=>openAccount('create');home.querySelector('#ppEnterCity').onclick=()=>openGame('platdo-city');home.querySelector('#ppJustDrive').onclick=()=>openGame('platdo-drive');home.querySelector('#ppStats').onclick=openStats;home.querySelector('#ppUpdates').onclick=()=>openUpdates();
  // The old audio is intentionally retired; keep its unused settings hidden so older save schemas still round-trip.
  document.querySelector('[data-main-tab="audio"]').hidden=true;document.getElementById('main-audio-panel').hidden=true;
  panel=document.createElement('section');panel.id='platdoPlatformPanel';panel.className='pp-ui';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','ppPanelTitle');panel.innerHTML='<header class="pp-panel-header"><button class="pp-back" aria-label="Back">×</button><h1 id="ppPanelTitle"></h1></header><div id="platdoPlatformBody"></div>';document.body.append(panel);body=panel.querySelector('#platdoPlatformBody');heading=panel.querySelector('#ppPanelTitle');panel.querySelector('.pp-back').onclick=back;
  global.addEventListener('hashchange',refreshRoute);global.addEventListener('platdo:ready',()=>{ready=true;refreshRoute();});
  global.addEventListener('platdo:computeropen',e=>{e.preventDefault();computer(e.detail?.returnToCity);});
  global.addEventListener('platdo:computerlaunch',e=>{if(!routes[aliases[e.detail?.game]])return;e.preventDefault();openGame(e.detail.game,{fromCity:true,returnToCity:e.detail.returnToCity});});
  global.addEventListener('platdo:multiplayer',e=>{e.preventDefault();multiplayer(e.detail?.game||'city');});
  global.Platdo.getSaveRegistry=()=>Object.entries(resetGameCatalog).map(([id,game])=>({id,name:game.name,keys:[...game.keys]}));
  global.Platdo.canApplyCloudSave=()=>(!location.hash||global.PlatdoLoading?.pending)&&(!screen||screen.kind==='account')&&!document.getElementById('mainSettingsDialog')?.open;
  global.Platdo.prepareCloudSaveReload=()=>{global.PlatdoCity?.stopMenuPreview?.();fullSaveReady=false;clearInterval(scheduledSaveTimer);clearInputs();global.dispatchEvent(new CustomEvent('platdo:beforereset',{detail:{cloudRestore:true,games:[],all:false}}));};
  global.PlatdoAccount?.subscribe?.(accountBadge);accountBadge();global.PlatdoAccount?.initialize?.();
  if(global.PlatdoLoading?.ready){ready=true;refreshRoute();}
 }
 global.PlatdoHub={openGame,openAccount,openStats,openUpdates,openSettings,openMultiplayer:multiplayer,handleKey,back,get panel(){return screen?.kind||null;},get ready(){return ready;},get computerSession(){return computerSession;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
