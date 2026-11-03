
/* All PLATDO DRIVE audio is synthesized here. No samples or external resources. */
(function () {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
  const menuStates = new Set(['menu', 'garage', 'settings', 'controls', 'modes', 'maps', 'records', 'tips']);
  // Original synthesized characters, not recordings of any real manufacturer.
  const shared=window.PlatdoVehicleAudio,characters=shared.characters;

  class DriveAudio {
    constructor() {
      this.settings = { master: .72, effects: .8, engine: .8, tires: .8, impacts: .8, environment: .8, music: .32, mute: false };
      this.context = null;
      this.nodes = null;
      this.voices = new Set();
      this.state = 'hidden';
      this.lastGear = null;
      this.shiftUntil = 0;
      this.nextChord = 0;
      this.chordIndex = 0;
      this.lastImpact = -10;
      this.lastHorn = -10;
      this.lastClick = -10;
      this.ready = false;
      this.unavailable = false;
      this.carId = 'compact';
      this.environment = { mapId: 'coastline', route: null, traffic: [] };
      this.lastThrottle = 0;
      this.lastLift = -10;
      this.tunnel = 0;
      this.diagnostics = { car: 'compact', map: 'coastline', rpm: 850, engineLoad: 0, slip: 0, surface: 'asphalt', grounded: true, trafficVoices: 0, loops: 0, tunnel: 0 };
      this.focusSuspended=false;
      this._onBlur = () => {this.focusSuspended=true;this.silence();};
      this._onFocus = () => {this.focusSuspended=false;};
      this._onVisibility = () => {if(document.hidden)this._onBlur();else this._onFocus();};
      this._listen();
    }

    _listen(){if(this.listening)return;window.addEventListener('blur',this._onBlur);window.addEventListener('focus',this._onFocus);document.addEventListener('visibilitychange',this._onVisibility);this.listening=true;}

    async prepare() {
      // Build the synthesized buffers/nodes silently. Browser gesture policy still
      // controls playback; preparation must never start menu or engine audio.
      if (!this.context || this.context.state === 'closed') this._create();
      this.silence();
      if(this.context?.state==='running')await this.context.suspend();
      return !this.unavailable;
    }

    async unlock() {
      try {
        this._listen();
        if (!this.context || this.context.state === 'closed') this._create();
        if (!this.context) return false;
        if (this.context.state === 'suspended') await this.context.resume();
        this.ready = this.context.state === 'running';
        return this.ready;
      } catch (_) {
        this.ready = false;
        return false;
      }
    }

    _create() {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) { this.unavailable = true; return; }
      const c = new Context({ latencyHint: 'interactive' });
      this.context = c;
      this.voices.clear();
      this.lastGear = null;
      this.nextChord = 0;
      const master = c.createGain();
      const effects = c.createGain();
      const music = c.createGain();
      const engine = c.createGain(), tiresBus = c.createGain(), impacts = c.createGain(), environment = c.createGain();
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 12;
      limiter.ratio.value = 5;
      limiter.attack.value = .005;
      limiter.release.value = .12;
      effects.connect(master);
      music.connect(master);
      for(const bus of [engine,tiresBus,impacts,environment])bus.connect(master);
      master.connect(limiter);
      limiter.connect(c.destination);

      const {engineGain,engineFilter,engines,engineWave}=shared.engine(c,engine);
      const {noise,noiseBuffer}=shared.noise(c);
      const makeTexture=(type,frequency,q,bus=tiresBus)=>shared.texture(c,noise,type,frequency,q,bus);
      const wind = makeTexture('lowpass', 1000, .3, environment);
      const tires = makeTexture('bandpass', 2100, 1.8);
      const rumble = makeTexture('lowpass', 190, .4);
      const intake = makeTexture('bandpass', 580, .7, engine);
      const mechanical = makeTexture('bandpass', 180, 2.1, engine);
      const ambience = makeTexture('bandpass', 650, .5, environment);
      // Four stable spatial traffic voices; route changes retarget them rather
      // than adding engine loops for every passing or despawned vehicle.
      const traffic = Array.from({length:4},()=>{
        const oscillator=c.createOscillator(), filter=c.createBiquadFilter(), gain=c.createGain();
        oscillator.setPeriodicWave(engineWave);oscillator.frequency.value=70;filter.type='lowpass';filter.frequency.value=450;gain.gain.value=0;
        const pan=typeof c.createStereoPanner==='function'?c.createStereoPanner():c.createGain();
        oscillator.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(environment);oscillator.start();return {oscillator,filter,gain,pan,id:null};
      });
      // A short, low-feedback reflection supplies a restrained tunnel tail. The
      // dry engine stays present, and the send crossfades over the portal region.
      const tunnelSend=c.createGain(),delay=c.createDelay(.3),feedback=c.createGain(),tunnelFilter=c.createBiquadFilter();
      tunnelSend.gain.value=0;delay.delayTime.value=.085;feedback.gain.value=.22;tunnelFilter.type='lowpass';tunnelFilter.frequency.value=1900;
      engineGain.connect(tunnelSend);tunnelSend.connect(delay);delay.connect(tunnelFilter);tunnelFilter.connect(engine);delay.connect(feedback);feedback.connect(delay);
      noise.start();
      this.nodes = { master, effects, music, engine, tiresBus, impacts, environment, limiter, engineGain, engineFilter, engines, noise, noiseBuffer, wind, tires, rumble, intake, mechanical, ambience, traffic, tunnelSend, delay, feedback, tunnelFilter };
      this._applyCharacter();this.diagnostics.loops=engines.length+traffic.length+1;
      this.setSettings(this.settings);
    }

    _target(param, value, time = .06) {
      if (!this.context || !param) return;
      param.setTargetAtTime(value, this.context.currentTime, time);
    }

    setSettings(settings = {}) {
      for (const key of ['master', 'effects', 'engine', 'tires', 'impacts', 'environment', 'music']) {
        if (Number.isFinite(settings[key])) this.settings[key] = clamp(settings[key], 0, 1);
      }
      // Preserve legacy SFX volume when an older caller/save has no split buses.
      if(Number.isFinite(settings.effects))for(const key of ['engine','tires','impacts','environment'])if(!Number.isFinite(settings[key]))this.settings[key]=clamp(settings.effects,0,1);
      if (typeof settings.mute === 'boolean') this.settings.mute = settings.mute;
      if (!this.nodes || !this.context || this.context.state === 'closed') return;
      this._target(this.nodes.master.gain, this.settings.mute ? 0 : this.settings.master, .025);
      this._target(this.nodes.effects.gain, this.settings.effects, .025);
      this._target(this.nodes.music.gain, this.settings.music, .025);
      for(const [setting,bus] of [['engine','engine'],['tires','tiresBus'],['impacts','impacts'],['environment','environment']])this._target(this.nodes[bus].gain,this.settings[setting],.025);
    }

    _applyCharacter() {
      if(!this.context||!this.nodes)return;shared.applyCharacter(this.context,this.nodes,this.carId,this._target.bind(this));
    }

    setVehicle(id='compact') {
      id=characters[id]?id:'compact';if(this.carId===id)return;
      this.carId=id;this.lastGear=null;this.lastThrottle=0;this.shiftUntil=0;this._applyCharacter();this.diagnostics.car=id;
    }

    setEnvironment(value={}) {
      if(value.mapId&&value.mapId!==this.environment.mapId){this.silence();this.tunnel=0;this.lastGear=null;this.diagnostics.map=value.mapId;}
      this.environment={...this.environment,...value};
    }

    silence() {
      const n=this.nodes;if(!n||!this.context)return;
      for(const item of [n.engineGain,n.wind.gain,n.tires.gain,n.rumble.gain,n.intake.gain,n.mechanical.gain,n.ambience.gain,n.tunnelSend,...n.traffic.map(v=>v.gain)])this._target(item.gain,0,.012);
      this._stopVoices();this.lastGear=null;this.diagnostics.trafficVoices=0;
    }

    update(player = {}, input = {}, state = 'hidden', dt = 0, environment) {
      if(environment){if(environment.carId)this.setVehicle(environment.carId);this.setEnvironment(environment);}
      const previousState = this.state;
      this.state = state;
      const c = this.context, n = this.nodes;
      if (!c || !n || c.state !== 'running') return;
      if(this.focusSuspended||document.hidden){this.silence();return;}
      const driving = state === 'playing' || state === 'countdown' || state==='wrecked';
      if (!driving) {
        this._stopVoices('fire');
        for(const item of [n.engineGain,n.wind.gain,n.tires.gain,n.rumble.gain,n.intake.gain,n.mechanical.gain,n.ambience.gain,n.tunnelSend,...n.traffic.map(v=>v.gain)])this._target(item.gain,0,.025);
        this.diagnostics.trafficVoices=0;
      } else {
        const character=characters[this.carId];
        const speed = Math.abs(Number(player.speed) || 0);
        const throttle = state === 'countdown' ? 0 : clamp(Number(input.throttle) || 0, 0, 1);
        const gear = Number.isFinite(player.gear) ? player.gear : Math.min(6, Math.max(1, Math.floor(speed / 11) + 1));
        if (this.lastGear !== null && this.lastGear !== gear && speed > 3) {this.shiftUntil = c.currentTime + .16;this._tone(140,.08,.014,'engine','triangle',85);}
        this.lastGear = gear;
        const shifting = player.shifting===true||c.currentTime < this.shiftUntil;
        const suppliedRPM=Number(player.engineRPM)||Number(player.rpm);
        const rpm=clamp(suppliedRPM>100?suppliedRPM:Number.isFinite(suppliedRPM)&&suppliedRPM>0?character.idle+suppliedRPM*(character.redline-character.idle):character.idle+throttle*600,character.idle*.8,character.redline*1.04);
        const load=state==='countdown'?0:Number.isFinite(player.engineLoad)?clamp(player.engineLoad,0,1):throttle;
        const map=this.environment.mapId,route=this.environment.route,tunnelRange=route?.map?.tunnel;
        let tunnelTarget=0;
        if(route?.audioAt)tunnelTarget=clamp(Number(route.audioAt(player.s||0)?.tunnel)||0,0,1);
        else if(route&&tunnelRange){const distance=Number(player.s)||0,start=tunnelRange.start*route.length,end=tunnelRange.end*route.length;tunnelTarget=clamp((distance-start)/18,0,1)*clamp((end-distance)/18,0,1);}
        this.tunnel+=(tunnelTarget-this.tunnel)*(1-Math.exp(-Math.max(.016,Math.min(.1,dt||.016))*6));
        this._target(n.tunnelSend.gain,this.tunnel*.18,.12);
        shared.applyEngine(n,shared.engineTargets(character,{rpm,load,shifting,tunnel:this.tunnel,time:c.currentTime}),this._target.bind(this),shifting);
        if(this.carId!=='compact'&&this.lastThrottle>.6&&throttle<.1&&rpm>3500&&c.currentTime-this.lastLift>1.5){this.lastLift=c.currentTime;this._tone(83,.10,.016,'engine','triangle',47);}
        this.lastThrottle=throttle;
        this._target(n.wind.gain.gain, Math.min(.105, Math.pow(speed / 70, 2) * .07), .2);
        this._target(n.wind.filter.frequency, 500 + Math.min(speed, 90) * 19, .2);
        const tire=shared.tireTargets(player),{grounded,surface,sliding}=tire;shared.applyTires(n,tire,this._target.bind(this));
        const ambience={coastline:[460,.014],metro:[710,.012],pinecrest:[1000,.012],sunridge:[420,.016]}[map]||[460,.014];
        this._target(n.ambience.filter.frequency,ambience[0],.5);this._target(n.ambience.gain.gain,ambience[1]*(1-this.tunnel*.82)*(1+Math.sin(c.currentTime*.31)*.12),.3);
        this._traffic(player,this.environment.traffic||[]);
        Object.assign(this.diagnostics,{car:this.carId,map,rpm,engineLoad:load,gear,shifting,surface,slip:sliding,grounded,tunnel:this.tunnel});
      }

      if(player.destroyed)for(const item of[n.engineGain,n.intake.gain,n.mechanical.gain,n.tires.gain,n.rumble.gain])this._target(item.gain,0,.04);
      const inMenu = menuStates.has(state);
      if (!inMenu && menuStates.has(previousState)) this._stopVoices('music');
      if (inMenu && !menuStates.has(previousState)) this.nextChord = c.currentTime + .12;
      if (inMenu && this.settings.music > 0 && !this.settings.mute && c.currentTime >= this.nextChord) {
        this._chord();
        // Never catch up multiple missed chords after a stalled or backgrounded frame.
        this.nextChord = c.currentTime + 2.8;
      }
      if ((state === 'paused' || state === 'hidden') && previousState !== state) this._stopVoices();
    }

    _traffic(player,list) {
      const n=this.nodes;if(!n)return;
      const near=list.map(car=>({car,dx:(car.x||0)-(player.x||0),dz:(car.z||0)-(player.z||0)})).map(v=>({...v,distance:Math.hypot(v.dx,v.dz)})).filter(v=>v.distance<80&&v.distance>.1).sort((a,b)=>a.distance-b.distance).slice(0,n.traffic.length);
      const yaw=player.yaw||0;this.diagnostics.trafficVoices=near.length;
      n.traffic.forEach((voice,index)=>{const v=near[index];if(!v){this._target(voice.gain.gain,0,.10);voice.id=null;return;}
        const car=v.car,speed=Math.abs(car.speed||0),relative=((player.vx||0)-(car.vx||0))*v.dx/v.distance+((player.vz||0)-(car.vz||0))*v.dz/v.distance;
        voice.id=car.id;this._target(voice.oscillator.frequency,(38+speed*2.7)*clamp(1+relative/343,.88,1.12),.10);
        this._target(voice.gain.gain,.026*Math.pow(1-v.distance/80,2)*(1-this.tunnel*.3),.12);
        this._target(voice.filter.frequency,450+speed*8,.15);
        if(voice.pan.pan)this._target(voice.pan.pan,clamp((-Math.cos(yaw)*v.dx+Math.sin(yaw)*v.dz)/Math.max(8,v.distance),-.9,.9),.08);
      });
    }

    _voice(oscillator, gain, bus, duration, extraNodes = []) {
      const c = this.context;
      if (!c || !this.nodes || c.state !== 'running' || this.focusSuspended || document.hidden) {
        oscillator.disconnect();gain.disconnect();extraNodes.forEach(node=>node.disconnect());return;
      }
      // This set includes all one-shots and musical notes. Repeated button presses cannot grow it indefinitely.
      if (this.voices.size >= 28) {
        oscillator.disconnect();
        gain.disconnect();
        extraNodes.forEach(node => node.disconnect());
        return;
      }
      const voice = { oscillator, gain, bus, extraNodes };
      this.voices.add(voice);
      oscillator.onended = () => {
        this.voices.delete(voice);
        try { oscillator.disconnect(); gain.disconnect(); extraNodes.forEach(node => node.disconnect()); } catch (_) {}
      };
      oscillator.start();
      oscillator.stop(c.currentTime + duration);
    }

    _endVoice(voice) {
      if (!voice || voice.ending) return;
      voice.ending = true;
      try {
        voice.gain.gain.cancelScheduledValues(this.context.currentTime);
        voice.gain.gain.setTargetAtTime(0, this.context.currentTime, .012);
        voice.oscillator.stop(this.context.currentTime + .05);
      } catch (_) {}
    }

    _stopVoices(bus) {
      for (const voice of Array.from(this.voices)) if (!bus || voice.bus === bus) this._endVoice(voice);
    }

    _tone(frequency, duration, volume, bus = 'effects', type = 'sine', endFrequency = frequency) {
      const c = this.context;
      if (!c || !this.nodes || c.state !== 'running' || this.focusSuspended || document.hidden) return;
      const oscillator = c.createOscillator();
      const gain = c.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, c.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, endFrequency), c.currentTime + duration);
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(volume, c.currentTime + Math.min(.016, duration * .15));
      gain.gain.exponentialRampToValueAtTime(.0001, c.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(this.nodes[bus]);
      this._voice(oscillator, gain, bus, duration + .015);
    }

    _chord() {
      // Original four-bar motif, voiced widely and softly so menus retain a calm atmosphere.
      const progression = [[174.61, 261.63, 329.63, 440], [164.81, 246.94, 293.66, 392], [146.83, 220, 261.63, 349.23], [130.81, 196, 293.66, 329.63]];
      const notes = progression[this.chordIndex++ % progression.length];
      const c = this.context;
      notes.forEach((frequency, index) => {
        const oscillator = c.createOscillator();
        const gain = c.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, c.currentTime);
        gain.gain.linearRampToValueAtTime(index === 0 ? .042 : .025, c.currentTime + .55 + index * .035);
        gain.gain.exponentialRampToValueAtTime(.0001, c.currentTime + 3.2);
        oscillator.connect(gain);
        gain.connect(this.nodes.music);
        this._voice(oscillator, gain, 'music', 3.22);
      });
    }

    impact(intensity = .5, contact = {}) {
      const c = this.context;
      if (!c || !this.nodes || c.state !== 'running' || this.state !== 'playing' || this.focusSuspended || document.hidden) return;
      if (c.currentTime - this.lastImpact < .13) return;
      this.lastImpact = c.currentTime;
      const amount = clamp(intensity, 0, 1);
      const scraping = contact.scrape === true;
      const duration = scraping ? .17 + amount * .16 : .13 + amount * .30;
      const source = c.createBufferSource();
      source.buffer = this.nodes.noiseBuffer;
      const filter = c.createBiquadFilter();
      filter.type = scraping || amount < .20 ? 'bandpass' : 'lowpass';
      filter.frequency.setValueAtTime(scraping ? 1250 + amount * 1800 : 580 + amount * 1450, c.currentTime);
      filter.frequency.exponentialRampToValueAtTime(scraping ? 750 : 260, c.currentTime + duration);
      filter.Q.value = scraping ? 1.2 : .65;
      const gain = c.createGain();
      gain.gain.setValueAtTime(.035 + amount * (scraping ? .16 : .27), c.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, c.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      const extra = [filter];
      if (typeof c.createStereoPanner === 'function') {
        const pan = c.createStereoPanner();
        // Model +X is on the driver's left when looking along the car's +Z nose.
        pan.pan.value = clamp(-(Number(contact.localX) || 0) * .45, -.6, .6);
        gain.connect(pan);pan.connect(this.nodes.impacts);extra.push(pan);
      } else gain.connect(this.nodes.impacts);
      this._voice(source, gain, 'impacts', duration, extra);
      if (!scraping && amount > .15) {
        // Low chassis thump under a short, inharmonic panel rattle.
        this._tone(79 + amount * 29, .17 + amount * .08, amount * .15, 'impacts', 'sine', 29);
        this._tone(267, .08 + amount * .09, amount * .027, 'impacts', 'triangle', 181);
        this._tone(431, .06 + amount * .07, amount * .018, 'impacts', 'sine', 319);
      }
    }

    explosion(distance=0){
      const c=this.context;if(!c||!this.nodes||c.state!=='running'||this.focusSuspended||document.hidden||!['playing','wrecked'].includes(this.state))return;
      const volume=Math.max(0,1-distance/120);if(volume<=0)return;
      const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.nodes.noiseBuffer;
      filter.type='lowpass';filter.frequency.setValueAtTime(2300,c.currentTime);filter.frequency.exponentialRampToValueAtTime(110,c.currentTime+1.8);
      gain.gain.setValueAtTime(.48*volume,c.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+2.2);
      source.connect(filter);filter.connect(gain);gain.connect(this.nodes.impacts);this._voice(source,gain,'impacts',2.25,[filter]);
      this._tone(76,1.4,.3*volume,'impacts','sine',22);
      const fire=c.createBufferSource(),crackle=c.createBiquadFilter(),fireGain=c.createGain();fire.buffer=this.nodes.noiseBuffer;fire.loop=true;crackle.type='bandpass';crackle.frequency.value=560;crackle.Q.value=.75;
      fireGain.gain.setValueAtTime(.0001,c.currentTime);fireGain.gain.linearRampToValueAtTime(.065*volume,c.currentTime+.5);fireGain.gain.setValueAtTime(.065*volume,c.currentTime+15);fireGain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+20);
      fire.connect(crackle);crackle.connect(fireGain);fireGain.connect(this.nodes.impacts);this._voice(fire,fireGain,'fire',20,[crackle]);
    }
    horn() {
      const c = this.context;
      if (!c || c.state !== 'running' || this.state !== 'playing' || c.currentTime - this.lastHorn < .24) return;
      this.lastHorn = c.currentTime;
      this._tone(349.23, .38, .075, 'environment', 'triangle');
      this._tone(440, .38, .052, 'environment', 'triangle');
    }

    click() {
      const c = this.context;
      if (!c || c.state !== 'running' || c.currentTime - this.lastClick < .055) return;
      this.lastClick = c.currentTime;
      this._tone(660, .045, .035, 'effects', 'sine', 520);
    }

    confirm() {
      this._tone(440, .17, .045, 'effects', 'sine', 660);
      this._tone(880, .23, .025);
    }

    countdown(final = false) {
      this._tone(final ? 880 : 440, final ? .25 : .12, .075);
    }

    shutdown() {
      const c = this.context;
      this.state = 'hidden';
      this.ready = false;
      window.removeEventListener('blur',this._onBlur);window.removeEventListener('focus',this._onFocus);document.removeEventListener('visibilitychange',this._onVisibility);this.listening=false;
      if (!c) return;
      this._stopVoices();
      try {
        if (this.nodes) {
          this.nodes.engines.forEach(engine => { try { engine.oscillator.stop(); } catch (_) {} });
          this.nodes.traffic.forEach(voice => { try { voice.oscillator.stop();voice.oscillator.disconnect();voice.gain.disconnect();voice.pan.disconnect();voice.filter.disconnect(); } catch (_) {} });
          this.nodes.noise.stop();
          this.nodes.feedback.disconnect();this.nodes.delay.disconnect();
          this.nodes.master.disconnect();
        }
        const closing = c.close();
        if (closing && closing.catch) closing.catch(() => {});
      } catch (_) {}
      this.context = null;
      this.nodes = null;
      this.voices.clear();
      this.diagnostics.loops=0;this.diagnostics.trafficVoices=0;
    }
  }

  window.DriveAudio = DriveAudio;
})();

