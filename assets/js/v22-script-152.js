
/* A focused City menu over the actual table or cabinet. The same recorded round
   drives the three-dimensional model, enlarged display, sounds and receipts. */
(function(root){'use strict';
const rounds=root.CityCasinoRounds,rules=rounds.rules;
const money=v=>'$'+v.toLocaleString('en-US'),icons={CHERRY:'🍒',BELL:'🔔',DIAMOND:'◆'};
function create(ctx){
 let sim,station,choice=null,amount='10',phase='ready',receipt=null,lastTick=-1,lastPhase='',error='',busy=false,lastRoomNote=0,request=null;
 function latest(s,id){return s.onlineRoom?(id?s.roomCasino?.stations?.[id]:s.roomCasino?.latest):rounds.latest(s.profile,id);}
 const panel=()=>ctx.host.querySelector('.casino-panel');
 const q=sel=>panel()?.querySelector(sel);
 function open(s,target){
  if(s!==sim){choice=null;amount='10';request=null;}
  sim=s;station=target.id;sim.casinoView=station;receipt=latest(sim,station);
  if(receipt){amount=String(receipt.wager);if(station==='roulette')choice=receipt.color;sim.casinoPresentation=receipt;}
  phase='ready';error='';lastTick=-1;lastPhase='';ctx.screen('casino');
  if(sim.profile.casinoPending)submit(true);
 }
 function close(){if(sim)sim.casinoView=null;station=null;}
 function render(){
  const table=station==='roulette',label=table?'Roulette':'Slots · '+station.slice(5);
  ctx.host.innerHTML='<div class="casino-dock"><section class="casino-panel" aria-labelledby="casino-title"><header><div><span class="eyebrow">PALM COVE CASINO</span><h2 id="casino-title">'+label+'</h2></div><button type="button" data-casino="close" aria-label="Close casino game">Close</button></header><p class="casino-cash">City cash <strong data-balance></strong></p>'+
   (table?'<div role="group" aria-label="Bet on one color" class="casino-colors">'+Object.keys(rules.colors).map(c=>'<button data-casino="color" data-value="'+c+'" class="casino-'+c+'">'+rules.marks[c]+' '+c+'</button>').join('')+'</div>':'<div class="casino-reels" aria-label="Center payline"></div>')+
   '<label class="casino-wager">Wager <input type="text" inputmode="numeric" autocomplete="off" aria-describedby="casino-help" id="casino-wager" maxlength="24"></label><div class="casino-quick">'+[10,50,100].map(n=>'<button data-casino="quick" data-value="'+n+'">'+money(n)+'</button>').join('')+'</div>'+
   (table?'<p class="casino-terms" data-terms></p>':'<p class="casino-terms">Three matching symbols on the center line return the stake multiplied by<br>'+rules.symbols.map(v=>icons[v]+' '+v+' ×'+rules.slots[v]).join('　')+'</p>')+
   '<p id="casino-help" role="status"></p><button class="casino-spin" data-casino="spin">SPIN</button><div class="casino-result" role="status"></div><small class="casino-fiction">Fictional City cash · No cash value</small></section></div>';
  q('#casino-wager').value=amount;
  panel().addEventListener('input',e=>{if(e.target.id==='casino-wager'){amount=e.target.value;error='';refresh();}});
  panel().addEventListener('click',e=>{const b=e.target.closest('[data-casino]');if(!b)return;switch(b.dataset.casino){
   case 'close':ctx.screen('play');break;
   case 'color':choice=b.dataset.value;error='';refresh();break;
   case 'quick':amount=b.dataset.value;q('#casino-wager').value=amount;error='';refresh();break;
   case 'spin':submit();break;
  }});
  update(Date.now());panel().querySelector('[data-casino=close]').focus({preventScroll:true});
 }
 function refresh(now=Date.now()){
  if(!panel()||!sim)return;
  const p=sim.profile,table=station==='roulette',active=latest(sim),locked=!!(busy||p.casinoPending||active&&active.endsAt>now),quote=rounds.quote(p.wallet,station,amount,choice);
  sim.casinoWager=/^\d+$/.test(amount)&&Number.isSafeInteger(Number(amount))?Number(amount):0;sim.casinoColor=choice;
  q('[data-balance]').textContent=phase==='animating'?'Resolving…':money(p.wallet);
  q('#casino-wager').disabled=locked;
  for(const b of panel().querySelectorAll('[data-casino=color]')){b.disabled=locked;b.setAttribute('aria-pressed',String(choice===b.dataset.value));}
  for(const b of panel().querySelectorAll('[data-casino=quick]'))b.disabled=locked||!!rounds.quote(p.wallet,station,b.dataset.value,table?(choice||'RED'):null).error;
  q('[data-casino=spin]').disabled=busy||!!(active&&active.endsAt>now)||!p.casinoPending&&!!quote.error;
  q('[data-casino=spin]').textContent=busy?'Submitting…':p.casinoPending?'Retry request':locked?'Spinning…':'SPIN';
  q('#casino-help').textContent=error||(locked?'':quote.error||'');
  if(table)q('[data-terms]').textContent=quote.total?'Return on '+choice+'　×'+quote.multiplier+'　'+money(quote.total):'RED and BLACK return 2× · GREEN returns 14×';
  const final=phase==='result'&&receipt;
  q('.casino-result').classList.toggle('paid',!!(final&&receipt.returned));
  q('.casino-result').textContent=final?('Last round · '+(table?rules.sectors[receipt.sector]:receipt.reels.join(' / '))+' · '+(receipt.returned?'Winning round':'Loss')+' · Wager '+money(receipt.wager)+' · Returned '+money(receipt.returned)+' · Net '+(receipt.net>=0?'+':'−')+money(Math.abs(receipt.net))+' · Balance after round '+money(receipt.balance)):phase==='animating'?'Round in progress…':'';
 }
 async function submit(recover=false){
  if(busy||!sim||!station)return;
  const s=sim,p=s.profile,pending=p.casinoPending;
  if(!pending&&!recover&&rounds.quote(p.wallet,station,amount,choice).error){refresh();return;}
  request=pending||(s.onlineRoom&&request?.stationId===station&&request?.raw===amount&&request?.color===(station==='roulette'?choice:null)?request:null)||{id:rounds.newId(),stationId:station,raw:amount,color:station==='roulette'?choice:null};
  busy=true;phase='submitting';error='';refresh();
  function commit(){
   // A normal mission retry may rewind the economy. Anchor a checkpoint after a
   // paid round so it cannot erase money that was already won or spent.
   const cp=s.mission?.checkpoint;
   if(s.mission&&!p.casinoPending)root.CityMissions.checkpoint(s);
   if(ctx.save())return true;
   // If a read failed immediately after setItem, resolve that same request from the main slot before rolling back.
   try{const main=JSON.parse(ctx.storage.get(p.mode)||'null'),id=request?.id;if(main?.id===p.id&&id){if(p.casinoPending?.id===id&&main.casinoPending?.id===id)return true;const tx=p.transactions['casino:'+id];if(tx&&JSON.stringify(main.transactions?.['casino:'+id]?.casino)===JSON.stringify(tx.casino))return true;}}catch(_){}
   if(s.mission)s.mission.checkpoint=cp;return false;
  }
  const settle=()=>{
   if(ctx.sim()!==s||!ctx.active())throw Error('Return to this City save to continue the round.');
   const main=ctx.storage.get(p.mode);
   if(main){const saved=JSON.parse(main);
    if(saved.id===p.id&&(saved.revision>p.revision||!rounds.compatible(saved,p)||Object.entries(saved.transactions||{}).some(([id,tx])=>p.transactions[id]?.revision!==tx.revision||p.transactions[id]?.amount!==tx.amount)))throw Error('The cash balance changed in another session. Reload the current City save.');
   }
   const fixed=rounds.accept(p,request,commit,root.CityEconomy.transaction);
   s.casinoPresentation=fixed;if(station===fixed.stationId)receipt=fixed;
  };
  try{if(s.onlineRoom){
    const result=await ctx.roomBet(request);
    if(ctx.sim()===s){s.roomCasino={latest:result,stations:{...s.roomCasino?.stations,[result.stationId]:result}};s.casinoPresentation=result;s.profile.wallet=result.balance;if(station===result.stationId)receipt=result;}
  }else if(root.navigator?.locks)await root.navigator.locks.request('platdo-city-casino-'+p.mode,settle);else settle();request=null;}
  catch(e){error=e.message;}
  finally{busy=false;lastPhase='';if(station)update(Date.now());}
 }
 function update(now){
  if(!station||!panel())return;
  const active=latest(sim),state=busy?'submitting':active&&now<active.endsAt?'animating':receipt?'result':'ready';
  if(state!==lastPhase){
   if(lastPhase==='animating'&&state==='result'){ctx.audio.tone(receipt.returned?660:180,.18,.035,'sine','sfx',receipt.returned?880:135);}
   phase=lastPhase=state;refresh(now);
  }
  if(phase==='animating'&&active&&active.stationId===station){
   const t=(now-active.startedAt)/(active.endsAt-active.startedAt),tick=Math.floor((1-(1-Math.max(0,t))**2)*22);
   if(tick!==lastTick){ctx.audio.tone(station==='roulette'?650:390,.035,.014,'triangle','sfx',240);lastTick=tick;}
  }
  if(station!=='roulette'){
   const visible=receipt?(root.CityCasinoModel?.symbolsFor?.(receipt,now)||receipt.reels):rules.symbols;
   const el=q('.casino-reels'),line=visible.join(' ');
   if(el.dataset.line!==line){el.dataset.line=line;el.innerHTML=visible.map(v=>'<span><b>'+icons[v]+'</b>'+v+'</span>').join('');}
  }
 }
 function tick(s,now,playing){
  if(station)update(ctx.frameTime()||now);
  if(!playing||now<lastRoomNote+3200||!s?.world?.casino)return;
  const site=s.world.casino,p=s.player;
  if(Math.abs(p.x-site.x)<12&&Math.abs(p.z-site.z)<9&&Math.abs(p.y-site.y)<4){lastRoomNote=now;ctx.audio.tone(196,.95,.012,'sine','ambience',205);}
 }
 return{open,close,render,tick};
}
root.CityCasinoUI={create};
})(globalThis);

