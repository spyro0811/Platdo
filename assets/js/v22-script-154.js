
(function(root){
'use strict';
const library={
  snake:{name:'Snake',mark:'<path d="M4 20h7v-6h7V8h5"/><rect x="21" y="5" width="5" height="5"/>',color:'#93e5a3',how:'Steer with WASD, arrow keys or the direction pad. Eat the yellow fruit for 10 points. Avoid the edges and your own body. Fill all 400 squares to win.'},
  breaker:{name:'Brick Breaker',mark:'<path d="M3 6h9m2 0h9M5 11h8m3 0h8M6 23h14"/><circle cx="17" cy="17" r="2"/>',color:'#ffac7d',how:'Move the paddle with A and D, the arrow keys, your mouse or a touch drag. Press Launch or Space to serve. Break all 50 bricks. You have three lives.'},
  memory:{name:'Memory Match',mark:'<path d="M4 5h12v13H4zM11 20v3h12V10h-4"/><circle cx="10" cy="11" r="2"/>',color:'#bbb6ff',how:'Flip two cards to find a pair. Match all eight pairs with as few moves as possible. Your fastest time breaks a tie.'}
};
const symbols=['◆','●','▲','✚','★','☀','♥','⬟'];
const dirs={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
const button=(id,text,attr='')=>'<button type="button" data-pc="'+id+'" '+attr+'>'+text+'</button>';
const clock=s=>Math.floor(s/60)+':'+String(Math.floor(s)%60).padStart(2,'0');
class Desktop {
 constructor(host,options){
   this.host=host;this.options=options;this.page='desktop';this.keys=new Set();this.controllers=new AbortController();
   this.host.innerHTML='<section class="city-workstation" aria-label="Home computer"><div class="pc-frame"><header><strong>PLATDO <b>PC</b></strong><span>HOME COMPUTER</span>'+button('leave','Leave computer')+'</header><main></main></div></section>';
   this.main=this.host.querySelector('main');
   const on=(target,name,listener,capture=false)=>target.addEventListener(name,listener,{capture,signal:this.controllers.signal});
   on(this.host,'click',e=>this.click(e));
   on(this.host,'pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)this.paddle(e);});
   on(this.host,'pointerdown',e=>{if(this.paddle(e))e.target.setPointerCapture?.(e.pointerId);});
   on(root,'keydown',e=>this.key(e,true),true);
   on(root,'keyup',e=>this.key(e,false),true);
   on(root,'blur',()=>{this.lastTick=0;this.keys.clear();});
   on(document,'visibilitychange',()=>{this.lastTick=0;this.keys.clear();});
   this.render();
 }
 close(){this.controllers.abort();cancelAnimationFrame(this.frame);this.frame=0;this.keys.clear();this.game=null;}
 back(){
   if(this.page==='desktop'){this.options.leave();return;}
   if(this.page==='instructions')this.page=this.priorPage;
   else if(this.page==='running'){this.page='title';this.game=null;}
   else this.page='desktop';
   this.keys.clear();this.render();
 }
 play(){
   const G=root.CityArcade;
   this.game=new ({snake:G.Snake,breaker:G.Breaker,memory:G.Memory}[this.selected])();
   this.page='running';this.lastTick=0;this.keys.clear();this.render();
 }
 render(){
   cancelAnimationFrame(this.frame);this.frame=0;
   this.board=null;this.status=null;this.stats=null;this.cells=null;this.memoryState='';
   if(this.page==='desktop'){
     this.main.innerHTML='<div class="pc-intro"><small>APPLICATIONS / LOCAL</small><h2>Arcade library</h2></div><div class="pc-apps">'+Object.entries(library).map(([id,a])=>button('app','<i><svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">'+a.mark+'</svg></i><b>'+a.name+'</b>','data-id="'+id+'" style="--pc-accent:'+a.color+'"')).join('')+'</div><h3>From the collection</h3><div class="pc-legacy">'+[['code','Code Platdo'],['swing','Platdo Swing'],['godcore','God Core'],['jump','Platdo Jump']].map(([id,name])=>button('legacy',name,'data-id="'+id+'"')).join('')+'</div>';return;
   }
   const a=library[this.selected];this.main.style.setProperty('--pc-accent',a.color);
   const nav='<nav>'+button('desktop','Back to desktop')+'</nav>';
   if(this.page==='instructions'){this.main.innerHTML='<small>PLAYER GUIDE</small><h2>'+a.name+'</h2><p>'+a.how+'</p>'+button('back','Back')+nav;return;}
   if(this.page==='title'){this.main.innerHTML='<small>ARCADE / LOCAL</small><h2>'+a.name+'</h2><p>'+this.bestText()+'</p><div class="pc-commands">'+button('play','Play')+button('help','Instructions')+'</div>'+nav;return;}
   const memory=this.selected==='memory',snake=this.selected==='snake';
   this.main.innerHTML='<div class="pc-game-head"><h2>'+a.name+'</h2><output class="pc-stats"></output></div>'+
     (memory?'<div class="pc-memory">'+Array.from({length:16},(_,i)=>button('flip','?','data-cell="'+i+'"')).join('')+'</div>':
     '<canvas class="pc-board" aria-label="'+a.name+' board" width="'+(snake?320:360)+'" height="'+(snake?320:240)+'"></canvas>')+
     '<div class="pc-status" role="status"></div>'+
     (snake?'<div class="pc-dpad">'+[['up','↑'],['left','←'],['down','↓'],['right','→']].map(([id,text])=>button(id,text,'aria-label="Turn '+id+'"')).join('')+'</div>':memory?'':button('launch','Launch'))+
     '<div class="pc-commands">'+button('play','Restart')+button('help','Instructions')+button('desktop','Back to desktop')+'</div>';
   this.board=this.main.querySelector('canvas');this.stats=this.main.querySelector('.pc-stats');this.status=this.main.querySelector('.pc-status');
   this.cells=[...this.main.querySelectorAll('[data-cell]')];this.draw();this.frame=requestAnimationFrame(t=>this.tick(t));
 }
 click(e){
   const b=e.target.closest('[data-pc]');if(!b)return;
   const cmd=b.dataset.pc;
   if(cmd==='leave')return this.options.leave();
   if(cmd==='desktop'){this.page='desktop';this.game=null;this.keys.clear();return this.render();}
   if(cmd==='back')return this.back();
   if(cmd==='app'){this.selected=b.dataset.id;this.page='title';return this.render();}
   if(cmd==='legacy')return this.options.launch(b.dataset.id);
   if(cmd==='help'){this.priorPage=this.page;this.page='instructions';this.keys.clear();return this.render();}
   if(cmd==='play')return this.play();
   if(this.page!=='running')return;
   if(cmd==='flip')this.game.pick(Number(b.dataset.cell));
   if(cmd==='launch')this.game.launch();
   const d={up:dirs.ArrowUp,left:dirs.ArrowLeft,down:dirs.ArrowDown,right:dirs.ArrowRight}[cmd];
   if(d)this.game.turn(...d);
   this.draw();
 }
 key(e,down){
   if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(down&&!e.repeat)this.back();return;}
   const d=dirs[e.code];if(this.page!=='running'||(!d&&e.code!=='Space')||this.selected==='memory')return;
   e.preventDefault();e.stopImmediatePropagation();if(!this.options.pc())return;
   if(down){this.keys.add(e.code);if(this.selected==='snake'&&d)this.game.turn(...d);else if(e.code==='Space'&&!e.repeat)this.game.launch?.();}
   else this.keys.delete(e.code);
 }
 paddle(e){
   if(this.page!=='running'||this.selected!=='breaker'||e.target!==this.board)return false;
   if(e.pointerType==='mouse'&&!this.options.pc())return false;
   const rect=this.board.getBoundingClientRect();this.game.move((e.clientX-rect.left)*360/rect.width);return true;
 }
 bestText(){
   const v=this.options.records()[this.selected];
   if(this.selected==='memory')return v?'Best '+v.moves+' moves · '+clock(v.time):'Best —';
   return 'Best '+(v||0);
 }
 record(){
   const g=this.game,records=this.options.records(),id=this.selected,previous=records[id];
   if(id==='memory'){
     if(g.status!=='won'||previous&&(previous.moves<g.moves||previous.moves===g.moves&&previous.time<=g.time))return;
     records[id]={moves:g.moves,time:g.time};
   }else{if(!g.score||g.score<=(previous||0))return;records[id]=g.score;}
   this.options.save(records);
 }
 draw(){
   const g=this.game;if(!g||!this.stats)return;
   const id=this.selected;
   if(id==='memory'){
     const state=g.up.join(',')+'|'+g.matched.size;
     if(this.memoryState!==state){this.memoryState=state;for(let i=0;i<16;i++){const matched=g.matched.has(i),face=matched||g.up.includes(i),b=this.cells[i];
       b.textContent=face?symbols[g.cards[i]]:'?';b.dataset.face=matched?'matched':face?'up':'down';b.setAttribute('aria-label',face?'Card '+(i+1)+' '+b.textContent:'Reveal card '+(i+1));b.setAttribute('aria-disabled',String(matched));}}
   }else{
     const c=this.board.getContext('2d'),w=this.board.width,h=this.board.height;c.fillStyle='#101f2b';c.fillRect(0,0,w,h);
     if(id==='snake'){c.strokeStyle='#1c303c';c.lineWidth=1;for(let i=1;i<20;i++){c.beginPath();c.moveTo(i*16+.5,0);c.lineTo(i*16+.5,320);c.moveTo(0,i*16+.5);c.lineTo(320,i*16+.5);c.stroke();}
       c.fillStyle='#ffe08b';c.fillRect(g.food.x*16+3,g.food.y*16+3,10,10);g.snake.forEach((s,i)=>{c.fillStyle=i?'#6bbb96':'#c3ffc8';c.fillRect(s.x*16+1,s.y*16+1,14,14);});
     }else{for(const t of g.bricks){c.fillStyle=['#fa977c','#ffc58c','#f3d99b','#86ccc9','#bab4fb'][t.row];c.fillRect(t.x,t.y,t.w,t.h);}c.fillStyle='#f6f1dd';c.fillRect(g.paddle-27,213,54,6);c.beginPath();c.arc(g.ball.x,g.ball.y,g.ball.r,0,Math.PI*2);c.fill();}
   }
   this.record();const stats=(id==='memory'?g.moves+' moves · '+clock(g.time):g.score+' pts'+(id==='breaker'?' · '+g.lives+' lives':''))+'  /  '+this.bestText();
   if(this.stats.textContent!==stats)this.stats.textContent=stats;
   const banner=g.status==='won'?'You win!':g.status==='lost'?'Game over':g.status==='ready'?'Ready to launch':'';
   if(this.status.textContent!==banner)this.status.textContent=banner;
 }
 tick(now){
   this.frame=requestAnimationFrame(t=>this.tick(t));
   if(document.hidden||this.page!=='running'){this.lastTick=0;return;}
   const dt=this.lastTick?Math.min(.12,(now-this.lastTick)/1000):0;this.lastTick=now;
   if(this.selected==='breaker')this.game.axis=Number(this.keys.has('ArrowRight')||this.keys.has('KeyD'))-Number(this.keys.has('ArrowLeft')||this.keys.has('KeyA'));
   this.game.update(dt);
   if(!this.lastDraw||now-this.lastDraw>=1000/(root.Platdo?.frameRate||60)-.5){this.draw();this.lastDraw=now;}
 }
}
root.CityHomeComputer=Desktop;
})(window);

