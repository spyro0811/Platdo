/* One notice per page opening, shared by hosted and portable startup. */
(function(global){
 'use strict';
 global.PlatdoStartupNotice={mount(host,onAccept){
  if(global.__platdoOptimizationAccepted===true){host.hidden=true;onAccept();return;}
  host.hidden=false;host.classList.add('platdo-warning-host');
  host.innerHTML='<section class="platdo-startup-warning" role="dialog" aria-modal="true" aria-labelledby="platdoWarningTitle" aria-describedby="platdoWarningText"><p class="warning-brand">PLATDO</p><h1 id="platdoWarningTitle" tabindex="-1">WARNING</h1><p id="platdoWarningText">Optimizations may reduce the game’s visual quality. You can change graphics quality and performance options in Settings.</p><button id="platdoWarningAccept" type="button" disabled><span class="warning-fill" aria-hidden="true"></span><span class="warning-label">Accept in 5 seconds</span></button></section>';
  const button=host.querySelector('button'),fill=host.querySelector('.warning-fill'),label=host.querySelector('.warning-label'),started=performance.now();
  let accepted=false,timer;
  function paint(){const elapsed=performance.now()-started,remaining=Math.max(0,Math.ceil((5000-elapsed)/1000));fill.style.width=Math.min(100,elapsed/50)+'%';button.disabled=elapsed<5000;label.textContent=remaining?'Accept in '+remaining+' second'+(remaining===1?'':'s'):'Accept';if(!remaining)clearInterval(timer);}
  timer=setInterval(paint,50);paint();host.querySelector('h1').focus({preventScroll:true});
  button.addEventListener('click',()=>{if(accepted||performance.now()-started<5000)return;accepted=true;clearInterval(timer);global.__platdoOptimizationAccepted=true;host.hidden=true;onAccept();});
 }};
})(window);
/* One collection-wide startup gate. Progress follows completed preparation work. */
(function(global){
 'use strict';
 if(global.PlatdoLoading)return;
 const downloaded=global.__platdoDownloadComplete===true,base=downloaded?50:0;
 const state={status:'loading',progress:base,label:'Preparing your games…',stages:[],error:null,startedAt:performance.now()};
 let running=null;
 document.documentElement.dataset.platdoLoading='true';
 const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
 function paint(){
  const bar=document.getElementById('platdoStartupProgress'),value=document.getElementById('platdoStartupPercent'),label=document.getElementById('platdoStartupLabel');
  if(bar)bar.value=state.progress;
  if(value)value.textContent=Math.floor(state.progress)+'%';
  if(label)label.textContent=state.error||state.label;
  global.dispatchEvent(new CustomEvent('platdo:loadingprogress',{detail:{status:state.status,progress:state.progress,label:state.label}}));
 }
 function block(event){if(state.status==='ready'||event.target?.closest?.('#platdoStartup'))return;event.preventDefault();event.stopImmediatePropagation();}
 for(const name of ['keydown','keyup','pointerdown','pointerup','click','touchstart','wheel'])global.addEventListener(name,block,{capture:true,passive:false});
 async function start(){
  if(running)return running;
  state.error=null;state.status='loading';document.getElementById('platdoStartupRetry').hidden=true;
  running=(async()=>{
   const tasks=[
    ['Fonts',async report=>{await document.fonts.ready;report({progress:1,label:'Fonts ready'});} ],
    ['Jump, Code Platdo & God Core',report=>global.PlatdoLegacy.prepare(report)],
    ['platdo Drive',report=>global.PlatdoDrive.prepare(report)],
    ['Platdo Swing',report=>global.PlatdoSwing.prepare(report)],
    ['Platdo City',report=>global.PlatdoCity.prepare(report)]
   ];
   for(let i=0;i<tasks.length;i++){
    const [name,prepare]=tasks[i];let stage=state.stages[i];if(!stage)state.stages[i]=stage={name,progress:0};
    await yieldFrame();
    await prepare(update=>{stage.progress=Math.max(stage.progress,Math.min(1,Number(update.progress)||0));stage.label=update.label||name;state.label=stage.label;state.progress=Math.max(state.progress,base+(100-base)*(i+stage.progress)/tasks.length);paint();});
    stage.progress=1;stage.ready=true;state.progress=Math.max(state.progress,base+(100-base)*(i+1)/tasks.length);paint();
   }
   state.progress=100;state.label='Ready';paint();await yieldFrame();
   state.status='ready';state.finishedAt=performance.now();delete document.documentElement.dataset.platdoLoading;
   document.getElementById('platdoStartup').hidden=true;
   global.dispatchEvent(new Event('platdo:ready'));
  })().catch(error=>{
   state.status='error';state.error='Could not finish loading: '+(error.message||error)+'. Please retry.';running=null;paint();document.getElementById('platdoStartupRetry').hidden=false;
  });
  return running;
 }
 global.PlatdoLoading={get pending(){return state.status!=='ready';},get ready(){return state.status==='ready';},get diagnostics(){return JSON.parse(JSON.stringify(state));},start,yield:yieldFrame};
 let pageLoaded=false,accepted=global.__platdoOptimizationAccepted===true;
 function beginAfterNotice(){accepted=true;document.getElementById('platdoPreparationCard').hidden=false;if(pageLoaded)setTimeout(start,0);}
 global.addEventListener('load',()=>{pageLoaded=true;if(accepted)setTimeout(start,0);},{once:true});
 document.addEventListener('DOMContentLoaded',()=>{document.getElementById('platdoStartupRetry').onclick=start;global.PlatdoStartupNotice.mount(document.getElementById('platdoWarningHost'),beginAfterNotice);paint();},{once:true});
})(window);
