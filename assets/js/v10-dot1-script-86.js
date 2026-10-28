
(function(root){'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function open({sim,scene,container,onClose=()=>{},onSave=()=>{},storeId=null,ownedOnly=false}){
 const C=root.CityConfig,S=root.CityStyle,library=root.CityCosmetics,P=root.CityPeople,p=sim.profile,store=sim.world.serviceById[storeId];
 let w=S.ensure(p);let category='tops',page=0,selected=null,preview={...w.equipped},angle=.24,message='',disposed=false;const shopping=!!store&&store.type==='clothing'&&!ownedOnly;
 const el=document.createElement('section');el.className='city-wardrobe';el.setAttribute('aria-label',shopping?store.name:'Wardrobe');el.addEventListener('click',e=>e.stopPropagation());container.replaceChildren(el);
 const categories=['hats','tops','bottoms','shoes','outfits','appearance'],matches=(item,c)=>item.slot===({hats:'hat',tops:'upper',bottoms:'lower',shoes:'shoe'})[c];
 function appearance(){return S.preview(p,preview);}
 function image(a){try{return scene.renderShopPreview(a,null,angle);}catch(_){return ''}}
 function refreshPlayer(){sim.player.appearance=root.CityEconomy.playerAppearance(p);sim.dirty=true;S.publish(p);onSave();}
 function close(){if(disposed)return;disposed=true;el.remove();onClose();}
 function list(){return C.cosmetics.filter(x=>matches(x,category)&&(shopping?S.available(x,storeId):w.owned.includes(x.id)));}
 function thumb(item){const a=S.preview(p,{...preview,[item.slot]:item.id});return image(a);}
 function render(){if(disposed)return;w=S.ensure(p);const entries=list(),pages=Math.max(1,Math.ceil(entries.length/12));page=Math.min(page,pages-1);const a=appearance();
  el.innerHTML=`<header><div><small>${shopping?'CITY CLOTHING / '+esc(store.name):'HOME / OWNED WARDROBE'}</small><h2>${shopping?'Find your look.':'Make it yours.'}</h2></div><strong>$${p.wallet.toLocaleString()}</strong><button type="button" data-action="close">Back</button></header><div class="wardrobe-layout"><div class="wardrobe-model"><img alt="Actual character outfit preview" src="${image(a)}"><label>Rotate preview<input aria-label="Rotate character preview" type="range" min="-3.14" max="3.14" step=".12" value="${angle}" data-rotate></label><p>Preview only until you equip it.</p><button data-action="equip">Equip this outfit</button><button data-action="normal">Normal Random</button><button data-action="chaos">Chaos Random</button><div class="wardrobe-message" role="status">${esc(message)}</div></div><div class="wardrobe-browser"><nav>${categories.map(x=>`<button data-category="${x}" class="${category===x?'selected':''}">${x.toUpperCase()}</button>`).join('')}</nav><div class="wardrobe-content"></div></div></div>`;
  const content=el.querySelector('.wardrobe-content');
  if(category==='appearance'){
   content.innerHTML=`<h3>Appearance — always free</h3><div class="wardrobe-fields"><label>Skin tone<select data-look="skin">${P.skinPalettes.slice(0,10).map((x,i)=>`<option value="${i}" ${a.skin===i?'selected':''}>Tone ${i+1}</option>`).join('')}</select></label><label>Hairstyle<select data-look="hair">${P.hair.map(x=>`<option value="${x.id}" ${a.hair===x.id?'selected':''}>${esc(x.name.replaceAll('-',' '))}</option>`).join('')}</select></label><label>Facial hair<select data-look="facialHair">${library.beardNames.map((x,i)=>`<option value="${i}" ${a.facialHair===i?'selected':''}>${x}</option>`).join('')}</select></label><label>Hair color<input type="color" data-look="hairHex" value="${a.hairHex||P.hairPalettes[a.hairColor]}"></label><label>Facial hair color<input type="color" data-look="beardHex" value="${a.beardHex||a.hairHex||P.hairPalettes[a.hairColor]}"></label>${[['topColor','Top fabric'],['topAccentColor','Top trim'],['bottomColor','Bottom fabric'],['shoeColor','Footwear'],['hatColor','Headwear']].map(([key,label])=>`<label>${label}<input type="color" data-fabric="${key}" value="${a[key]||'#546a7b'}"></label>`).join('')}</div><p>Appearance and colors stay with your character in City and Drive.</p>`;
  }else if(category==='outfits'){
   content.innerHTML=`<h3>Your five outfit slots</h3><div class="wardrobe-presets">${w.presets.map((x,i)=>`<article><strong>${esc(x?.name||'Outfit '+(i+1))}</strong><button data-load="${i}" ${x?'':'disabled'}>Wear</button><button data-save="${i}">Save current outfit</button></article>`).join('')}</div><h3>Complete looks</h3><div class="wardrobe-grid">${library.outfits.map(o=>{const eq={...preview};for(const id of o.items)eq[C.shopItemById[id].slot]=id;return`<button class="wardrobe-card" data-outfit="${o.id}"><img loading="lazy" alt="${esc(o.name)} outfit" src="${image(S.preview(p,eq))}"><strong>${esc(o.name)}</strong><small>${o.items.every(id=>w.owned.includes(id))?'OWNED':'Preview • individual items sold in stores'}</small></button>`}).join('')}</div>`;
  }else{
   content.innerHTML=`<div class="wardrobe-pager"><button data-action="previous" ${page===0?'disabled':''}>Previous</button><span>${entries.length} items · ${page+1} / ${pages}</span><button data-action="next" ${page>=pages-1?'disabled':''}>Next</button></div><div class="wardrobe-grid">${entries.slice(page*12,page*12+12).map(item=>`<button class="wardrobe-card ${selected===item.id?'selected':''}" data-item="${item.id}"><img loading="lazy" alt="${esc(item.name)} on the character" src="${thumb(item)}"><strong>${esc(item.name)}</strong><small>${w.owned.includes(item.id)?'OWNED':'$'+item.price.toLocaleString()} · ${item.rarity||'CLASSIC'}</small></button>`).join('')}</div>${!entries.length?'<p>Nothing owned in this category yet. Visit a clothing store to shop.</p>':''}<div class="wardrobe-detail"></div>`;
   const item=C.shopItemById[selected];if(item){content.querySelector('.wardrobe-detail').innerHTML=`<h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><p>${w.owned.includes(item.id)?'OWNED':'$'+item.price+' · '+(item.stores||['clothing']).map(id=>esc(library.stores.find(s=>s.id===id)?.name||id)).join(', ')}</p>${shopping&&!w.owned.includes(item.id)?`<button data-action="buy">BUY — $${item.price}</button>`:'<button data-action="equip">EQUIP</button>'}`;}
  }
  el.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;page=0;selected=null;render();});
  el.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{selected=b.dataset.item;const item=C.shopItemById[selected];preview[item.slot]=item.id;message='';render();});
  el.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action));
  el.querySelector('[data-rotate]').oninput=e=>{angle=Number(e.target.value);el.querySelector('.wardrobe-model img').src=image(appearance());};
  el.querySelectorAll('[data-look]').forEach(input=>input.onchange=()=>{try{S.setAppearance(p,{[input.dataset.look]:input.type==='color'?input.value:Number(input.value)});refreshPlayer();message='Appearance saved.';}catch(e){message=e.message;}render();});
  el.querySelectorAll('[data-fabric]').forEach(input=>input.onchange=()=>{w.colors[input.dataset.fabric]=input.value;refreshPlayer();render();});
  el.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const index=+b.dataset.save;const result=S.savePreset(p,index,'Outfit '+(index+1));message=result.message;refreshPlayer();render();});
  el.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{const result=S.loadPreset(p,+b.dataset.load);message=result.message;preview={...w.equipped};if(result.ok)refreshPlayer();render();});
  el.querySelectorAll('[data-outfit]').forEach(b=>b.onclick=()=>{for(const id of library.outfits.find(x=>x.id===b.dataset.outfit).items)preview[C.shopItemById[id].slot]=id;message='Previewing a complete look. Every item must be owned before equipping.';render();});
 }
 function act(action){if(action==='close')return close();if(action==='previous')page--;if(action==='next')page++;if(action==='normal'||action==='chaos'){preview=S.randomLook(p,action==='chaos',shopping);message=shopping?'Random store preview. Purchase unowned pieces before equipping.':'Randomized from your owned items.';if(!shopping){const q=S.equipLook(p,preview);message=q.message;if(q.ok)refreshPlayer();}}
  if(action==='equip'){const q=S.equipLook(p,preview);message=q.message;if(q.ok)refreshPlayer();}
  if(action==='buy'){const q=S.buy(sim,selected,'clothing-'+Date.now()+'-'+p.revision,storeId);message=q.message;if(q.ok)refreshPlayer();}render();
 }
 el.addEventListener('keydown',e=>{if(e.code==='Escape'){e.stopPropagation();e.preventDefault();close();}});render();return{close,element:el};
}
root.CityWardrobeUI={open};
})(typeof globalThis!=='undefined'?globalThis:this);

