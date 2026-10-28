
/* One startup preparation pass. Worlds share one GPU context; the showroom owns
 * the other. Progress reports completed work, not a timer or simulated download. */
(()=>{'use strict';
window.DrivePreparationUI={
 create(){const box=document.createElement('div');box.className='drive-startup-loading';box.innerHTML='<div><span>PLATDO DRIVE</span><h1>Preparing your garage and roads</h1><p role="status">Starting…</p><progress max="100" value="0" aria-label="Game loading"></progress><strong>0%</strong></div>';document.body.append(box);return{report({progress,label}){const value=Math.round(Math.max(0,Math.min(1,progress))*100);box.querySelector('progress').value=value;box.querySelector('strong').textContent=value+'%';box.querySelector('p').textContent=label;},finish(){box.remove();},fail(error){box.querySelector('p').textContent='Could not prepare the game: '+error.message;}};}
};
})();

