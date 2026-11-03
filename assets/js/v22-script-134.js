
/* Receipts belong to the existing City transaction ledger. A complete profile write
   is the commit boundary for both the balance and its chosen outcome. */
(function(root,factory){const api=factory(root);if(typeof module==='object')module.exports=api;root.CityCasinoRounds=api;})(globalThis,function(root){'use strict';
const rules=Object.freeze({maxMoney:999999999,minBet:1,rouletteMs:4000,slotsMs:2800,sectors:Object.freeze(['GREEN',...Array.from({length:7},()=>['RED','BLACK']).flat()]),colors:Object.freeze({RED:2,BLACK:2,GREEN:14}),marks:Object.freeze({RED:'◆',BLACK:'●',GREEN:'▲'}),symbols:Object.freeze(['CHERRY','BELL','DIAMOND']),slots:Object.freeze({CHERRY:5,BELL:8,DIAMOND:12})});
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const station=id=>id==='roulette'||typeof id==='string'&&/^slot-[AB][1-4]$/.test(id);
const balanceError='You do not have enough money for that bet.';
function quote(balance,stationId,raw,color){
 if(!station(stationId))return{error:'Choose a casino station.'};
 if(typeof raw!=='string'||!/^\d{1,15}$/.test(raw))return{error:'Enter a whole amount of at least 1.'};
 const wager=Number(raw);
 if(!Number.isSafeInteger(wager)||wager<rules.minBet||wager>rules.maxMoney)return{error:'Enter a whole amount of at least 1 within the wallet limit.'};
 if(wager>balance)return{error:balanceError};
 if(stationId==='roulette'&&!Object.hasOwn(rules.colors,color))return{error:'Choose RED, BLACK, or GREEN.'};
 const multiplier=stationId==='roulette'?rules.colors[color]:12,total=wager*multiplier;
 if(total>rules.maxMoney||balance-wager+total>rules.maxMoney)return{error:'The potential return exceeds the City wallet limit.'};
 return{wager,multiplier,total};
}
function uniform(n){const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{root.crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
function result(stationId,color,wager,sector,reels){
 if(stationId==='roulette'){
  if(!Number.isInteger(sector)||sector<0||sector>=rules.sectors.length||reels!=null||!Object.hasOwn(rules.colors,color))throw Error('Invalid roulette receipt.');
  return rules.sectors[sector]===color?wager*rules.colors[color]:0;
 }
 if(color!==null||sector!=null||!Array.isArray(reels)||reels.length!==3||!reels.every(v=>rules.symbols.includes(v)))throw Error('Invalid slot receipt.');
 return reels.every(v=>v===reels[0])?wager*rules.slots[reels[0]]:0;
}
const prefix='casino:',clock=()=>Date.now()/1000,index=new WeakMap();
function presentation(receipt){
 if(!receipt)return null;
 const startedAt=Math.round(receipt.accepted*1000);return{...receipt,startedAt,endsAt:startedAt+(receipt.stationId==='roulette'?rules.rouletteMs:rules.slotsMs)};
}
function latest(p,stationId){
 let state=index.get(p);
 if(!state||state.revision!==p.revision){state={revision:p.revision,global:null,byStation:{}};for(const tx of Object.values(p.transactions)){if(!tx.casino)continue;if(!state.global||tx.revision>state.global.revision)state.global=tx;const old=state.byStation[tx.casino.stationId];if(!old||old.revision<tx.revision)state.byStation[tx.casino.stationId]=tx;}index.set(p,state);}
 return presentation((stationId?state.byStation[stationId]:state.global)?.casino);
}
function intent(input){
 if(!input||!validId(input.id)||!station(input.stationId)||!Number.isSafeInteger(input.wager)||input.wager<1||input.wager>rules.maxMoney||(input.stationId==='roulette'?!Object.hasOwn(rules.colors,input.color):input.color!==null))throw Error('Invalid pending casino bet.');
 return{id:input.id,stationId:input.stationId,wager:input.wager,color:input.color};
}
function restore(input,p){
 if(input.casinoDeclined!=null){if(!validId(input.casinoDeclined))throw Error('Invalid declined casino request.');p.casinoDeclined=input.casinoDeclined;}
 if(input.casinoPending!=null)p.casinoPending=intent(input.casinoPending);
 let balance=p.mode==='sandbox'?100000:750;
 for(const [id,tx] of Object.entries(p.transactions).sort((a,b)=>a[1].revision-b[1].revision)){
  if(id.startsWith(prefix)){
   const r=input.transactions[id].casino,i=intent(r);
   if(id!==prefix+r.id||r.id===p.casinoPending?.id||!Number.isFinite(r.accepted)||r.accepted<=0||r.accepted>1e11||quote(balance,r.stationId,String(r.wager),r.color).error)throw Error('Invalid saved casino round.');
   const returned=result(r.stationId,r.color,r.wager,r.sector,r.reels);
   if(r.returned!==returned||r.net!==returned-r.wager||tx.amount!==r.net||r.balance!==balance+r.net)throw Error('Casino receipt does not match the wallet.');
   tx.casino={...i,accepted:r.accepted,sector:r.sector,reels:r.reels,returned,net:r.net,balance:r.balance};
  }
  balance+=tx.amount;
 }
}
function accept(p,request,commit,applyTransaction){
 if(p.casinoDeclined===request?.id)throw Error('This request was declined. Start a new bet.');
 if(!validId(request?.id))throw Error('Invalid casino request ID.');
 const key=prefix+request.id,known=p.transactions[key]?.casino;
 if(known)return presentation(known);
 if(p.casinoPending&&p.casinoPending.id!==request.id)throw Error('Finish the pending round first.');
 const previous=latest(p);if(previous&&Date.now()<previous.endsAt)throw Error('A casino round is still spinning.');
 if(!p.casinoPending){
  const q=quote(p.wallet,request.stationId,request.raw,request.color);if(q.error)throw Error(q.error);
  p.casinoPending=intent({id:request.id,stationId:request.stationId,wager:q.wager,color:request.stationId==='roulette'?request.color:null});
  if(!commit()){delete p.casinoPending;throw Error('The request could not be saved. Check City save storage.');}
 }
 const i=p.casinoPending,q=quote(p.wallet,i.stationId,String(i.wager),i.color);
 function decline(message){const prior=p.casinoDeclined;delete p.casinoPending;p.casinoDeclined=i.id;if(!commit()){if(prior)p.casinoDeclined=prior;else delete p.casinoDeclined;p.casinoPending=i;}throw Error(message);}
 if(q.error)decline(q.error);
 const sector=i.stationId==='roulette'?uniform(15):null,reels=i.stationId==='roulette'?null:Array.from({length:3},()=>rules.symbols[uniform(3)]);
 const returned=result(i.stationId,i.color,i.wager,sector,reels),net=returned-i.wager,balance=p.wallet;
 const receipt={...i,accepted:clock(),sector,reels,returned,net,balance:balance+net};
 if(!applyTransaction(p,key,net,'Palm Cove Casino'))decline('The City wallet could not record this bet.');
 p.transactions[key].casino=receipt;delete p.casinoPending;
 if(!commit()){delete p.transactions[key];p.revision--;p.wallet=balance;p.casinoPending=i;index.delete(p);throw Error('Settlement could not be saved. Retry this same request.');}
 return presentation(receipt);
}
// A stale city tab must never replace newer accepted receipts or a pending intent.
function compatible(previous,next){
 if(previous.id!==next.id)return true;
 if(previous.casinoPending&&previous.casinoPending.id!==next.casinoPending?.id&&previous.casinoPending.id!==next.casinoDeclined&&!next.transactions[prefix+previous.casinoPending.id])return false;
 for(const [id,tx] of Object.entries(previous.transactions||{}))if(id.startsWith(prefix)&&JSON.stringify(tx.casino)!==JSON.stringify(next.transactions[id]?.casino))return false;
 return true;
}
return{rules,quote,result,restore,latest,accept,compatible,newId:()=>root.crypto.randomUUID()};
});

