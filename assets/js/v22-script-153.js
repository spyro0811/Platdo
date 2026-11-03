
(function(root) {
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const same=(a,b)=>a.x===b.x&&a.y===b.y;

class Snake {
  constructor(random=Math.random) {
    this.random=random; this.snake=[{x:8,y:10},{x:7,y:10},{x:6,y:10},{x:5,y:10}];
    this.dir={x:1,y:0}; this.next=null; this.lag=0; this.score=0; this.status='play'; this.food=this.spawnFood();
  }
  spawnFood() {
    const free=[];
    for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(!this.snake.some(cell=>cell.x===x&&cell.y===y))free.push({x,y});
    return free[Math.floor(this.random()*free.length)];
  }
  turn(x,y) {
    if(Math.abs(x)+Math.abs(y)===1 && x*this.dir.x+y*this.dir.y!==-1)this.next={x,y};
  }
  update(dt) {
    this.lag+=dt;
    while(this.status==='play'&&this.lag+.000001>=.14) {
      this.lag-=.14;
      if(this.next){this.dir=this.next;this.next=null;}
      const head={x:this.snake[0].x+this.dir.x,y:this.snake[0].y+this.dir.y};
      const grow=same(head,this.food), occupied=grow?this.snake:this.snake.slice(0,-1);
      if(head.x<0||head.x>=20||head.y<0||head.y>=20||occupied.some(cell=>same(cell,head))) {this.status='lost';return;}
      this.snake.unshift(head);
      if(!grow){this.snake.pop();continue;}
      this.score+=10;
      if(this.snake.length===400)this.status='won';else this.food=this.spawnFood();
    }
  }
}

class Breaker {
  constructor() {
    this.score=0; this.lives=3; this.status='ready'; this.paddle=180; this.axis=0;
    this.bricks=Array.from({length:50},(_,i)=>({x:9+(i%10)*34.5,y:22+Math.floor(i/10)*13,w:32,h:10,row:Math.floor(i/10)}));
    this.ball={x:180,y:207,vx:0,vy:0,r:4};
  }
  move(x){this.paddle=clamp(x,27,333);if(this.status==='ready')this.ball.x=this.paddle;}
  launch(){if(this.status==='ready'){this.status='play';Object.assign(this.ball,{vx:64,vy:-145});}}
  update(dt) {
    if(this.status!=='play'&&this.status!=='ready')return;
    this.move(this.paddle+this.axis*dt*265);
    if(this.status==='ready')return;
    // Advance at most half a ball radius per contact check, even after speed increases.
    const b=this.ball,n=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/(b.r*.45))),step=dt/n;
    for(let k=0;k<n&&this.status==='play';k++){
      const ox=b.x,oy=b.y; b.x+=b.vx*step;b.y+=b.vy*step;
      if(b.x<b.r||b.x>360-b.r){b.x=clamp(b.x,b.r,360-b.r);b.vx=b.x===b.r?Math.abs(b.vx):-Math.abs(b.vx);}
      if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy);}
      if(b.vy>0&&oy+b.r<=213&&b.y+b.r>=213&&Math.abs(b.x-this.paddle)<=27+b.r){
        const angle=clamp((b.x-this.paddle)/27,-1,1)*1.10,speed=Math.min(305,Math.hypot(b.vx,b.vy)+3);
        b.y=213-b.r;b.vx=Math.sin(angle)*speed;b.vy=-Math.cos(angle)*speed;
      }
      const i=this.bricks.findIndex(t=>b.x+b.r>t.x&&b.x-b.r<t.x+t.w&&b.y+b.r>t.y&&b.y-b.r<t.y+t.h);
      if(i>=0){
        const t=this.bricks[i];
        if(oy+b.r<=t.y||oy-b.r>=t.y+t.h){b.y=oy;b.vy=-b.vy;}else{b.x=ox;b.vx=-b.vx;}
        this.bricks.splice(i,1);this.score+=10;if(!this.bricks.length)this.status='won';
      }
      if(b.y-b.r>240){
        this.lives--;this.status=this.lives?'ready':'lost';Object.assign(b,{x:this.paddle,y:207,vx:0,vy:0});
      }
    }
  }
}

class Memory {
  constructor(random=Math.random) {
    this.cards=Array.from({length:16},(_,i)=>i%8);
    for(let i=15;i>0;i--){const j=Math.floor(random()*(i+1));[this.cards[i],this.cards[j]]=[this.cards[j],this.cards[i]];}
    this.up=[];this.matched=new Set();this.moves=0;this.time=0;this.started=false;this.delay=0;this.status='play';
  }
  pick(i){
    if(this.status!=='play'||this.up.length===2||!Number.isInteger(i)||i<0||i>=16||this.up.includes(i)||this.matched.has(i))return false;
    this.started=true;this.up.push(i);
    if(this.up.length===2){
      this.moves++;
      if(this.cards[this.up[0]]===this.cards[i]){this.up.forEach(v=>this.matched.add(v));this.up=[];if(this.matched.size===16)this.status='won';}
      else this.delay=.8;
    }
    return true;
  }
  update(dt){if(this.started&&this.status==='play')this.time+=dt;if(this.delay>0){this.delay=Math.max(0,this.delay-dt);if(!this.delay)this.up=[];}}
}
const api={Snake,Breaker,Memory};
if(typeof module==='object'&&module.exports)module.exports=api;else root.CityArcade=api;
})(typeof globalThis==='object'?globalThis:this);

