/* Render the authenticated host's ordered world stream in the existing game scenes. */
(function(root){
  'use strict';
  class RoomView {
    constructor(room,self){this.room=room;this.self=self;this.entities=new Map();this.seq=-1;this.time=0;}
    accept(packet){
      if(!packet||packet.room!==this.room.id||packet.seq<this.seq||(!packet.full&&packet.seq===this.seq))return;
      const city=this.room.mode==='city',own=packet.changes['u:'+this.self];
      const scopeChanged=city&&own&&Object.hasOwn(own,'homeInstance')&&!!own.homeInstance!==!!this.entities.get('u:'+this.self)?.value.homeInstance;
      if(city&&(packet.full||scopeChanged)){
        this.renderTime=undefined;this.lastFrame=undefined;
        for(const entry of this.entities.values())if(entry.samples)entry.samples=[{time:packet.time,pose:entry.value}];
      }
      if(packet.full)this.entities.clear();
      this.seq=packet.seq;this.time=packet.time;
      for(const key of packet.removed)this.entities.delete(key);
      const now=performance.now();
      this.receivedAt=now;
      for(const [key,value] of Object.entries(packet.changes)){
        const prior=this.entities.get(key);
        const next=prior&&typeof value==='object'?{...prior.value,...value}:value;
        if(Number.isFinite(next?.x)&&(this.room.mode==='drive'||city&&['p','n','v'].includes(key[0]))){
          const samples=prior?.samples||[];
          if(samples.length&&Math.hypot(next.x-samples.at(-1).pose.x,next.z-samples.at(-1).pose.z)>(city?16:20))samples.length=0;
          if(samples.at(-1)?.time===packet.time)samples[samples.length-1]={time:packet.time,pose:next};
          else samples.push({time:packet.time,pose:next});if(samples.length>8)samples.shift();
          this.entities.set(key,{samples,value:next,start:now});
        }else this.entities.set(key,{from:prior?this.interpolate(prior,now):next,value:next,start:now});
      }
      // An omitted entity in a delta packet is unchanged, not missing. Record
      // that sample too, so the next movement doesn't blend across a long stop.
      if(city)for(const entry of this.entities.values())if(entry.samples&&entry.samples.at(-1)?.time<packet.time){
        entry.samples.push({time:packet.time,pose:entry.value});if(entry.samples.length>8)entry.samples.shift();
      }
    }
    interpolate(item,now){
      if(typeof item.value!=='object')return item.value;
      if(item.samples){
        const list=item.samples,target=this.renderTime??this.time;
        let b=list.findIndex(s=>s.time>=target);
        if(b===0)return list[0].pose;
        if(b<0){
          if(this.room.mode==='city')return list.at(-1).pose;
          const latest=list.at(-1),v={...latest.pose},dt=Math.min(.085,Math.max(0,target-latest.time));
          v.x+=(v.vx||0)*dt;v.z+=(v.vz||0)*dt;if(Number.isFinite(v.yaw))v.yaw+=(v.yawRate||0)*dt;return v;
        }
        const before=list[b-1],after=list[b],t=(target-before.time)/(after.time-before.time||1),city=this.room.mode==='city',v={...(city&&t<1?before.pose:after.pose)};
        for(const key of ['x','y','z','yaw','pitch','roll','steer','wheelSpin','rx','ry','rz']){
          const a=before.pose[key],d=after.pose[key]-a;if(Number.isFinite(d))v[key]=a+(key==='yaw'?Math.atan2(Math.sin(d),Math.cos(d)):d)*t;
        }
        if(city&&before.pose.ragdoll?.points&&after.pose.ragdoll?.points){
          const points={};for(const [joint,target] of Object.entries(after.pose.ragdoll.points)){
            const start=before.pose.ragdoll.points[joint];points[joint]=start?{x:start.x+(target.x-start.x)*t,y:start.y+(target.y-start.y)*t,z:start.z+(target.z-start.z)*t}:target;
          }
          v.ragdoll={...after.pose.ragdoll,points};
        }
        return v;
      }
      const t=Math.min(1,(now-item.start)/70),v={...item.value};
      if(Math.hypot(v.x-item.from.x,v.z-item.from.z)<16)for(const key of ['x','y','z','pitch','roll','yaw']){
        if(Number.isFinite(item.from[key])&&Number.isFinite(v[key])){const d=v[key]-item.from[key];v[key]=item.from[key]+(key==='yaw'?Math.atan2(Math.sin(d),Math.cos(d)):d)*t;}
      }
      if(this.room.mode==='city'&&t<1&&item.from.ragdoll?.points&&v.ragdoll?.points){
        const points={};for(const [joint,target] of Object.entries(v.ragdoll.points)){
          const start=item.from.ragdoll.points[joint];points[joint]=start?{x:start.x+(target.x-start.x)*t,y:start.y+(target.y-start.y)*t,z:start.z+(target.z-start.z)*t}:target;
        }
        v.ragdoll={...v.ragdoll,points};
      }
      return v;
    }
    apply(sim){
      const now=performance.now(),city=this.room.mode==='city',npcs=[],vehicles=[],traffic=[];
      const fragments=[],sceneryPieces=[];
      {
        // City keeps 110 ms of history and slews its playback clock rather than
        // freezing whenever a jittery packet moves the estimated target back.
        const target=this.time+Math.min(.18,(now-(this.receivedAt??now))/1000)-(city?.11:.095);
        const dt=Math.min(.10,Math.max(0,(now-(this.lastFrame??now))/1000));
        if(city){
          this.renderTime=this.renderTime===undefined||Math.abs(target-this.renderTime)>.45?Math.max(0,target):
            Math.min(this.time,this.renderTime+dt*Math.max(.9,Math.min(1.1,1+(target-this.renderTime)*2)));
        }else this.renderTime=this.renderTime===undefined||Math.abs(target-this.renderTime)>.45?target:
            this.renderTime+Math.min(Math.max(0,target-this.renderTime),dt*1.12);
        this.lastFrame=now;
      }
      if(!city)root.DriveOccupantPhysics?.ensure(sim).snapshot();
      this.cache??=new Map();const parts=[],effects=[],projectiles=[];if(city){this.heard??=new Set();sim.onlineSounds??=[];}
      for(const [key,entry] of this.entities){
        const kind=key[0],id=key.slice(2),v=this.interpolate(entry,now);
        if(kind==='p'&&id===this.self){
          Object.assign(sim.player,v,{id:city?'player':id});
          if(city)sim.player.appearance=v.appearance||root.CityPeople.presets[v.avatar%root.CityPeople.presets.length];
        }else if(city){
          if(kind==='j')projectiles.push(v);
          if(kind==='u'){sim.profile.world.time=v.dayTime??(.4+this.time/1200)%1;sim.homeInstance=v.homeInstance;sim.roomCasino=v.casino;sim.roomCasinoTables=v.casinoTables;sim.profile.casinoPending=v.casinoPending;sim.unlockedRoomVehicles=v.unlockedVehicles||[];sim.scoutOwned=!!v.scoutOwned;sim.wanted.level=v.wanted||0;if(v.owned)sim.profile.owned=v.owned;if(v.wardrobe)sim.profile.wardrobe=v.wardrobe;sim.profile.wallet=v.wallet;Object.assign(sim.profile.sandbox,v.sandbox);sim.profile.world.weather=v.weather;}
          if(kind==='i')Object.assign(sim.profile.inventory,v);
          if(kind==='w')parts.push({...v,id});
          if(kind==='f')effects.push(v);
          if(kind==='a'&&!this.heard.has(key)){
            this.heard.add(key);if(this.time-v.time<.4)sim.onlineSounds.push(v);
          }
          if(kind==='d'){const door=sim.world.doors.find(d=>d.id===id);if(door&&door.open!==v)sim.world.setDoorOpen(id,v);}
          if(kind==='p'||kind==='n')npcs.push({...v,id,appearance:v.appearance||root.CityPeople.presets[v.avatar%root.CityPeople.presets.length],weapon:v.weapon||'unarmed',role:v.role||'civilian'});
          if(kind==='v'){
            let car=this.cache.get(key);if(!car){car=root.CityVehicles.createVehicle(v.typeId,id,v);this.cache.set(key,car);}
            Object.assign(car,v);if(car.seatOccupants)car.seatOccupants=car.seatOccupants.map(who=>who===this.self?'player':who);
            vehicles.push(car);
          }
        }else{
          if(kind==='t'||kind==='p'){
            let car=this.cache.get(key);if(!car){car={damage:{},impacts:[]};this.cache.set(key,car);}
            Object.assign(car,v,{id:key,type:v.type||'compact',onlinePaint:v.paint,width:v.width||1.8,length:v.length||4.3,colorIndex:v.colorIndex??v.avatar??0});traffic.push(car);
          }
          if(kind==='u'){Object.assign(sim,{onlineRunId:v.runId,distance:v.distance,eligibleDistance:v.eligibleDistance||0,driftDistance:v.driftDistance||0,oncomingDistance:v.oncomingDistance||0,bestDrift:v.bestDrift,rewardFactor:v.rewardFactor||1,score:v.score||0,lockedTraffic:true,recoveryPoint:v.recoveryPoint});for(const event of v.events||[]){if(event.key>(this.driveEventCursor||0))sim.events.push(event);this.driveEventCursor=Math.max(this.driveEventCursor||0,event.key);}}
          if(kind==='j')fragments.push(v);
          if(kind==='k')sceneryPieces.push(v);
          if(kind==='r'&&!sim.brokenRails.has(id)){sim.brokenRails.add(id);sim.railRevision++;}
          if(kind==='s'&&!sim.brokenScenery.has(id)){sim.brokenScenery.add(id);sim.sceneryRevision++;}
          if(kind==='b'){const b=sim.looseBlockers.find(b=>b.id===id);if(b)Object.assign(b,v);}
        }
      }
      sim.time=city?this.renderTime:this.time;if(city){sim.npcs=npcs;sim.vehicles=vehicles;sim.streetActions={parts,serial:0};sim.effects=effects;sim.projectiles=projectiles;for(const key of this.heard)if(!this.entities.has(key))this.heard.delete(key);}
      else{
        if(sim.traffic.length!==traffic.length||traffic.some((v,i)=>v!==sim.traffic[i]))sim.traffic=traffic;sim.renderPlayer=null;sim.railDebris=fragments;sim.sceneryDebris=sceneryPieces;
        const elapsed=Math.min(.08,Math.max(0,(this.renderTime-(this.lastPoseTime??this.renderTime))));
        this.lastPoseTime=this.renderTime;sim.time=this.renderTime;
        if(elapsed>0)root.DriveOccupantPhysics?.ensure(sim).step(elapsed);
      }
      for(const key of this.cache.keys())if(!this.entities.has(key))this.cache.delete(key);
    }
  }
  class ChaseRoomView {
    constructor(room,self,{sendInput,onExit}){
      this.room=room;this.self=self;this.sendInput=sendInput;this.onExit=onExit;
      this.presentedRound=null;this.seq=-1;this.chase=null;this.renderer=null;this.paused=false;this.disposed=false;
    }
    accept(packet){
      if(this.disposed||packet?.room!==this.room.id||packet.seq<this.seq||(!packet.full&&packet.seq===this.seq))return;
      this.seq=packet.seq;
      if(this.presentedRound!=null&&this.chase?.round===this.presentedRound)this.acknowledge(this.presentedRound);
      if(!packet.changes?.chase)return;
      const old=this.chase,state=this.chase=packet.full?packet.changes.chase:{...old,...packet.changes.chase};
      if(state.phase==='waiting'){
        if(old&&old.phase!=='waiting'){this.release();this.onExit();}
      }else if(!old||old.phase==='waiting'||state.round!==old.round||old.phase==='ended'&&state.phase!=='ended'){
        this.release();this.resume();
      }else this.renderer?.accept(state);
      if(state.phase!==old?.phase||state.reconnecting!==old?.reconnecting||state.finished?.length!==old?.finished?.length||state.nextRoles?.cop!==old?.nextRoles?.cop)root.PlatdoFriendsPanel?.refresh();
    }
    acknowledge(round){
      if(round==null||this.ackPending||this.chase?.finished?.includes(this.self)||this.ackRetry>performance.now())return;
      this.ackPending=true;this.ackRetry=performance.now()+2000;
      root.PlatdoFriends.action('finishArrest',{round}).catch(()=>{}).finally(()=>{this.ackPending=false;});
    }
    resume(){
      if(this.disposed||!this.chase||this.chase.phase==='waiting')return false;
      const role=['cop','robber'].find(k=>this.chase.roles?.[k]===this.self);if(!role)return false;
      root.PlatdoFriendsPanel?.close();this.paused=false;
      if(!this.renderer)this.renderer=root.PlatdoCopChase.open({role,alreadyShown:this.chase.finished?.includes(this.self)||this.presentedRound===this.chase.round,onResult:round=>{
        this.presentedRound=round;this.acknowledge(round);
      },input:axes=>{
        if(!this.paused&&!this.disposed&&!this.chase.reconnecting)this.sendInput(axes);
      },onExit:()=>{this.release();this.onExit();}});
      this.renderer.accept(this.chase);return true;
    }
    suspend(on,reason){if(on)this.sendInput({});this.paused=on;this.renderer?.suspend(on,reason);}
    apply(){}
    release(){this.sendInput({});this.renderer?.close();this.renderer=null;}
    close(){this.disposed=true;this.release();}
  }
  root.PlatdoChaseRoomView=ChaseRoomView;
  root.PlatdoRoomView=RoomView;
})(window);
