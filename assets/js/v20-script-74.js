/* Premium browsing never starts checkout or mutates ownership. */
(function(root){'use strict';const catalog=root.PlatdoPremiumCatalog,ownership=root.PlatdoPremium;let overlay=null,preview=null,frame=0,unsub=null,returnFocus=null,detailId=null,adminVisible=false;const view={mode:'CITY',filter:'All',query:'',scroll:0};let optionIndex=0,trial=null,posterObserver=null;const filters=['All','Vehicles','Cosmetics','Gadgets','Activities','Editors','Worlds','Bundles','Membership','My Content'];
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
function button(label,fn,cls='premium-secondary'){const b=el('button',cls,label);b.type='button';b.onclick=fn;return b;}
function stopPreview(){cancelAnimationFrame(frame);frame=0;preview?.dispose();preview=null;}
function close(){const previous=trial;trial=null;previous?.close();posterObserver?.disconnect();stopPreview();unsub?.();unsub=null;overlay?.remove();overlay=null;detailId=null;adminVisible=false;document.removeEventListener('keydown',onKey,true);const activity=document.querySelector('.premium-activity,dialog.premium-home-panel[open]');if(activity){activity.tabIndex=-1;activity.focus({preventScroll:true});}else{returnFocus?.focus?.();}root.dispatchEvent(new CustomEvent('platdo:premiumoverlaychange',{detail:{active:false}}));}
function onKey(e){if(e.key!=='Escape'||!overlay||root.PlatdoPremiumTrials?.active||root.PlatdoShopActivityTrial?.active)return;e.preventDefault();e.stopImmediatePropagation();if(detailId){detailId=null;drawShop();}else close();}
function shell(title){close();returnFocus=document.activeElement;overlay=el('section','premium-overlay');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',title);const head=el('header','premium-header'),heading=el('div');heading.append(el('span','premium-eyebrow','PLATDO COLLECTION'),el('h1',null,title));head.append(heading,button('Close',close));overlay.append(head);document.body.append(overlay);document.addEventListener('keydown',onKey,true);root.dispatchEvent(new CustomEvent('platdo:premiumoverlaychange',{detail:{active:true}}));return overlay;}
function message(text,cls='premium-notice'){return el('p',cls,text);}
function labelFor(p){const s=ownership.access(p.id);if(s.state==='admin-test')return'Admin-test owned';if(s.state==='owned')return p.type==='membership'?'VIP active':'Owned';if(s.state==='unavailable')return'Ownership unavailable';if(s.state==='guest')return'Sign in for future ownership';if(s.state.startsWith('checking'))return'Checking ownership…';return s.partial?'Some items already owned':'Coming Soon';}
const usd=cents=>'$'+(cents/100).toFixed(2)+' USD';
function priceLine(p){
  const quote=ownership.quote(p.id),line=el('strong','premium-price');
  if(quote.discountCents>0)line.append(el('s','premium-list-price',usd(quote.baseCents)));
  line.append(el('span','premium-current',usd(quote.priceCents)+(p.type==='membership'?'/month':'')));
  return line;
}
function art(p){
  const box=el('div','premium-card-art'),img=el('img');
  box.dataset.product=p.id;img.alt=p.name+' preview';box.append(img);
  posterObserver.observe(box);
  return box;
}
function observePosters(){
  posterObserver?.disconnect();
  const mode=view.mode;
  posterObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const box=entry.target;
      posterObserver.unobserve(box);
      Promise.resolve().then(()=>box.isConnected&&root.PlatdoShopPreviews.poster(box.dataset.product,mode)).then(url=>{
        if(url&&box.isConnected)box.firstChild.src=url;
      }).catch(()=>{if(box.isConnected)box.textContent='Open for preview';});
    }
  });
}
function open(initialProduct){
  shell('Shop');
  if(typeof initialProduct==='string'&&catalog.byId[initialProduct]){
    detailId=initialProduct;optionIndex=0;
    if(catalog.byId[initialProduct].mode!=='BOTH')view.mode=catalog.byId[initialProduct].mode;
  }
  let stamp=null;
  unsub=ownership.subscribe(state=>{
    if(!overlay||adminVisible)return;
    const next=JSON.stringify([state.uid,state.status,state.record,state.development]);
    if(next===stamp)return;
    stamp=next;
    if(!trial){if(detailId)drawDetail(detailId);else drawShop();}
  });
  if(!overlay.querySelector('.premium-content')){if(detailId)drawDetail(detailId);else drawShop();}
}
function matchesShopFilter(product){
  if(product.availability==='retired')return false;
  if(view.filter==='My Content')return ownership.access(product.id).allowed;
  return view.filter==='All'||product.category===view.filter;
}
function content(){let c=overlay.querySelector('.premium-content');if(c)c.remove();c=el('div','premium-content');overlay.append(c);return c;}
function drawShop(){if(!overlay)return;stopPreview();detailId=null;const c=content(),tabs=el('nav','premium-tabs');tabs.setAttribute('aria-label','Game');for(const mode of['CITY','DRIVE'])tabs.append(button(mode,()=>{view.mode=mode;view.scroll=0;drawShop();},'premium-tab'+(mode===view.mode?' active':'')));c.append(tabs,message(catalog.notice));const state=ownership.getState();if(state.status==='guest')c.append(message(catalog.guestNotice));if(state.development)c.append(message('LOCAL ADMIN TEST · These test grants do not affect production accounts.','premium-test-banner'));if(state.status==='unavailable')c.append(message('Ownership could not be checked. Saved selections and progress are retained. '+(state.error||'')));const tools=el('div','premium-tools'),search=el('input');search.type='search';search.placeholder='Search packs';search.value=view.query;search.setAttribute('aria-label','Search premium catalog');search.oninput=()=>{view.query=search.value;view.scroll=0;drawGrid();};tools.append(search,button('Refresh ownership',()=>ownership.refresh()));const controls=el('nav','premium-filters');controls.setAttribute('aria-label','Catalog filters');for(const f of filters)controls.append(button(f,()=>{view.filter=f;view.scroll=0;drawShop();},'premium-filter'+(view.filter===f?' active':'')));c.append(tools,controls);const grid=el('div','premium-grid');c.append(grid);
function drawGrid(){observePosters();grid.replaceChildren();const products=catalog.products.filter(p=>(p.mode===view.mode||p.mode==='BOTH')&&matchesShopFilter(p)&&(p.name+' '+p.details).toLowerCase().includes(view.query.toLowerCase()));if(!products.length)grid.append(message(view.filter==='My Content'?'No verified content is available in this account. Test grants are available only through authorized Mega Admin.':'No packs match your search.'));for(const p of products){const card=button('',()=>{view.scroll=c.scrollTop;optionIndex=0;drawDetail(p.id);},'premium-card');const text=el('div','premium-card-copy');text.append(el('span','premium-category',p.category),el('h3',null,p.name),el('p',null,p.summary.slice(0,180)),priceLine(p),el('span','premium-entitlement',labelFor(p)),el('small',null,p.type==='membership'?'One membership for both games':'One-time · Permanent unlock · Unlimited use'));card.append(art(p),text);grid.append(card);}c.scrollTop=view.scroll;}
drawGrid();}
function drawDetail(id){
  if(!overlay)return;
  const product=catalog.byId[id];
  if(!product||product.availability==='retired')return drawShop();
  posterObserver?.disconnect();stopPreview();detailId=id;
  const p=catalog.byId[id],c=content(),adapter=ownership.adapter(id);
  c.append(button('← Back to '+view.mode,drawShop));
  const layout=el('div','premium-detail'),visual=el('div','premium-preview'),copy=el('div','premium-detail-copy');
  let canvas=el('canvas');const caption=el('p','premium-preview-caption'),choices=el('div','premium-preview-options');
  const tryButton=button('',startTrial,'premium-primary'),status=message('','premium-status');
  status.setAttribute('role','status');canvas.tabIndex=0;
  const demos=el('div','premium-preview-options');visual.append(canvas,caption,choices,demos,tryButton);
  copy.append(el('span','premium-category',p.mode+' / '+p.category),el('h2',null,p.name),
    priceLine(p),
    message(p.type==='membership'?catalog.vipTerms:catalog.terms),message(labelFor(p),'premium-entitlement'),el('p',null,p.details));
  if(p.includes?.length){
    copy.append(el('h3',null,'Included packs'));
    for(const item of p.includes)copy.append(el('div','premium-included',catalog.byId[item].name+' · '+labelFor(catalog.byId[item])));
    const quote=ownership.quote(id);
    const credit=quote.ownedCount===quote.totalCount?'All included packs owned':quote.ownedCount+' of '+quote.totalCount+' packs owned';
    copy.append(message(quote.verified&&quote.ownedCount>0
      ?credit+' · Ownership credit '+usd(quote.discountCents)+'.'
      :'Individual total '+usd(p.individualTotalCents)+'. Owning an included pack reduces your bundle price.'));
  }
  const coming=button('Coming Soon',()=>{},'premium-primary');coming.disabled=true;copy.append(coming,message(catalog.notice));
  if(ownership.access(id).allowed&&adapter?.open){
    const use=button(adapter.actionLabel||'Open owned content',async()=>{
      try{await ownership.use(id);close();}catch(e){status.textContent=e.message;}
    });use.disabled=adapter.actionLabel==='Equipped';copy.append(use);
  }
  copy.append(status);layout.append(visual,copy);c.append(layout);
  const options=root.PlatdoShopPreviews.options(id,view.mode);
  choices.setAttribute('role','group');choices.setAttribute('aria-label',id==='CITY-04'?'Choose an emote':'Preview options');
  const buttons=options.map((o,i)=>{
    const control=button(o.label,()=>select(i),'premium-filter');choices.append(control);return control;
  });
  function startTrial(){
    const o=options[optionIndex];if(!o)return;
    const runner=root.PlatdoPremiumTrials.label(o.productId)?root.PlatdoPremiumTrials:root.PlatdoShopActivityTrial;
    if(!runner.label(o.productId)){select(optionIndex);return;}
    stopPreview();
    try{
      trial=runner.open(o.productId,{...o,onClose:()=>{trial=null;if(overlay&&detailId===id){select(optionIndex);tryButton.focus();}}});
    }catch(error){select(optionIndex);status.textContent=error.message;}
  }
  function select(i){
    stopPreview();optionIndex=i;const o=options[i];if(!o)return;
    buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
    const nextCanvas=el('canvas');canvas.replaceWith(nextCanvas);canvas=nextCanvas;demos.replaceChildren();
    canvas.setAttribute('aria-label',o.label+' preview');
    const text=root.PlatdoPremiumTrials.label(o.productId)||root.PlatdoShopActivityTrial.label(o.productId);
    tryButton.textContent=text|| (o.productId==='CITY-04'?'Replay emote':'Reset preview');
    caption.textContent=o.label+' · Drag to change the view';
    try{
      preview=root.PlatdoShopPreviews.create(canvas,o);
      for(const [index,label] of (preview.tryLabels||[]).entries()){
        const pose=button(label,()=>{preview?.tryAction?.(index);for(const child of demos.children)child.setAttribute('aria-pressed',String(child===pose));});
        pose.setAttribute('aria-pressed',String(index===0));demos.append(pose);
      }
      const started=performance.now();let last=-Infinity;
      function tick(now){if(!preview||!overlay||detailId!==id||trial)return;frame=requestAnimationFrame(tick);
        if(document.hidden||now-last<1000/(root.Platdo.frameRate||60)-1)return;
        last=now;preview.render((now-started)/1000);
      }
      if(preview.animated||preview.tryLabels?.length)frame=requestAnimationFrame(tick);
    }catch(error){caption.textContent='Preview unavailable. '+error.message;}
  }
  if(options.length)select(Math.min(optionIndex,options.length-1));else{tryButton.hidden=true;caption.textContent='Preview unavailable.';}
}
let adminForm=null;
function openAdmin(){
  shell('Mega Admin');
  adminVisible=true;
  const form=adminForm={busy:false,notice:'',uid:ownership.getState().uid};
  unsub=ownership.subscribe(state=>{
    if(!overlay||!adminVisible||adminForm!==form)return;
    if(form.uid!==state.uid){form.uid=state.uid;form.busy=false;form.notice='';}
    drawAdmin();
  });
  if(!overlay.querySelector('.premium-content'))drawAdmin();
}
function drawAdmin(){
  if(!adminVisible||!overlay)return;
  stopPreview();
  const c=content(),state=ownership.getState(),form=adminForm;
  const status=message(form.notice,'premium-status');
  status.setAttribute('role','status');
  c.append(message('Early shop access for the developer account. Unlocks apply to the account signed in here.'));
  if(state.development)c.append(message('ISOLATED DEVELOPMENT · These grants apply only to this local test account.','premium-test-banner'));
  const live=uid=>form===adminForm&&adminVisible&&form.uid===uid;
  async function perform(operation,success){
    if(form.busy)return;
    const uid=form.uid;
    form.busy=true;form.notice='';drawAdmin();
    try{await operation();if(live(uid))form.notice=success||'';}
    catch(e){if(live(uid))form.notice=e.message||'Request failed. Try again.';}
    finally{if(live(uid)){form.busy=false;drawAdmin();}}
  }
  if(!state.admin||state.admin.expiresAt<=Date.now()){
    const login=el('form','premium-admin-unlock'),code=el('input');
    code.type='password';code.autocomplete='off';code.placeholder='Admin password';
    code.setAttribute('aria-label','Admin code');code.disabled=form.busy;
    const submit=button(form.busy?'Checking…':'Unlock admin session',()=>{},'premium-primary');
    submit.type='submit';submit.disabled=form.busy;
    login.append(code,submit);
    login.onsubmit=e=>{e.preventDefault();const entered=code.value;code.value='';perform(()=>ownership.unlock(entered));};
    c.append(login);
    if(state.status==='guest'){
      c.append(message('Sign in with your permanent developer account to manage shop access.'));
      c.append(button('Log In',()=>{close();root.PlatdoHub?.openAccount('login');}));
    }
    c.append(status);
    return;
  }
  const products=catalog.products.filter(p=>p.availability!=='retired');
  const allOwned=()=>products.every(p=>ownership.access(p.id).allowed);
  const shopUnlock=button('Unlock all shop items',()=>{
    perform(async()=>{
      await ownership.adminAction({type:'unlock-shop-items'});
      if(!allOwned())throw Error('Ownership could not be confirmed for every shop item. Refresh and retry.');
    },'All shop items unlocked, including VIP.');
  },'premium-primary');
  shopUnlock.disabled=form.busy||allOwned();
  c.append(shopUnlock,message('Includes the current City and Drive shop items and VIP. There is no charge or subscription.'));
  if(!form.notice&&allOwned())status.textContent='All shop items are already unlocked.';
  c.append(status,message('Session expires at '+new Date(state.admin.expiresAt).toLocaleTimeString()));
  const actions=el('div','premium-admin-actions');
  function actionButton(label,type,extra={}){
    const control=button(label,()=>perform(()=>ownership.adminAction({type,...extra})));
    control.disabled=form.busy;return control;
  }
  if(state.development){
    for(const [label,type] of [['Unlock all City packs','grant-city'],['Unlock all Drive packs','grant-drive'],['Unlock all one-time packs','grant-all'],['Unlock Everything + Test VIP','unlock-everything'],['Enable test VIP','vip-on'],['Disable test VIP','vip-off']]){
      actions.append(actionButton(label,type));
    }
    const choose=el('select');choose.setAttribute('aria-label','Individual product');
    for(const p of catalog.products.filter(p=>p.type==='one-time')){const o=el('option',null,p.mode+' · '+p.name);o.value=p.id;choose.append(o);}
    actions.append(choose,button('Grant selected pack or bundle',()=>perform(()=>ownership.adminAction({type:'grant',productId:choose.value}))));
    actions.append(button('Remove admin-test grants',()=>{
      if(c.querySelector('.premium-confirm'))return;
      const confirm=el('div','premium-confirm');
      confirm.append(message('Remove this account’s admin-test grants? Purchases and saved progress will be retained.'),actionButton('Confirm removal','remove-test',{confirm:true}),button('Cancel',()=>confirm.remove()));
      c.append(confirm);
    }));
    actions.append(button('Show admin code directory',async()=>{
      const uid=form.uid;
      try{
        const entries=await ownership.directory();
        if(!live(uid)||!c.isConnected)return;
        c.querySelector('.premium-code-directory')?.remove();
        const list=el('div','premium-code-directory');
        for(const entry of entries){const line=el('article');line.append(el('h3',null,entry.name+' · '+entry.mode),el('code',null,entry.code),el('p',null,entry.purpose),el('small',null,entry.conditions));list.append(line);}
        c.append(list);
      }catch(e){if(live(uid))status.textContent=e.message;}
    }));
  }
  actions.append(button('End admin session',()=>{form.notice='';ownership.endAdmin();}));
  if(form.busy){for(const control of actions.querySelectorAll('button,select'))control.disabled=true;}
  c.append(actions);
}
root.PlatdoPremiumShop={open,openAdmin,close};root.addEventListener('platdo:beforereset',close);root.addEventListener('platdo:premiumactivitychange',e=>{if(e.detail.active)close();});
})(window);
