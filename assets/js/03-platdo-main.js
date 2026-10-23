
        // Canvas & Context Setup
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');

        // Web Audio API Audio Synthesizer
        let audioCtx = null;
        let soundEnabled = true;

        const gameClipData = {"ak48": "assets/audio/jump-ak48-dd64b1dd6732.mp3", "pistol": "assets/audio/fieldpistolshotaudio-d11776d7b3e1.mp3", "sniper": "assets/audio/fieldsnipershotaudio-cee18db7340c.mp3", "empty": "assets/audio/jump-empty-e6b886b477fe.mp3", "enemyDeath": "assets/audio/jump-enemydeath-3771a8db5866.mp3", "nuke": "assets/audio/jump-nuke-66e46f31bcdd.mp3", "stomp": "assets/audio/jump-stomp-07fc45c6ef91.mp3", "levelComplete": "assets/audio/jump-levelcomplete-0c765f662886.mp3", "levelBonus": "assets/audio/jump-levelbonus-d5dfb245ae9d.mp3", "weaponMax": "assets/audio/jump-weaponmax-bf9c2862679a.mp3", "coin": "assets/audio/jump-coin-c22bc689e7f2.mp3", "land": "assets/audio/fieldlandaudio-fa538a848484.mp3", "jump": "assets/audio/jump-jump-7ebef1253f22.mp3", "playerDeath": "assets/audio/jump-playerdeath-0066e0d82f0d.mp3"};
        const gameClipBuffers = {}, gameClipLoading = {};
        const activeGameClips = new Set();
        const SOUND_CATEGORIES={"sniper": "weapons", "pistol": "weapons", "ak48": "weapons", "nuke": "weapons", "empty": "weapons", "jump": "environment", "land": "environment", "stomp": "environment", "enemyDeath": "environment", "playerDeath": "environment", "coin": "sfx", "levelComplete": "sfx", "levelBonus": "sfx", "weaponMax": "sfx", "menuClick": "sfx"};
        const audioSettings={environment:100,sfx:100,weapons:100,music:100,advanced:false,individual:Object.fromEntries(Object.keys(SOUND_CATEGORIES).map(id=>[id,100]))};
        try {
            const saved=JSON.parse(localStorage.getItem('platdo_audio_v1')||'{}');
            for(const key of ['environment','sfx','weapons','music'])if(Number.isFinite(saved[key]))audioSettings[key]=Math.max(0,Math.min(100,saved[key]));
            for(const key of Object.keys(audioSettings.individual))if(Number.isFinite(saved.individual?.[key]))audioSettings.individual[key]=Math.max(0,Math.min(100,saved.individual[key]));
            audioSettings.advanced=saved.advanced===true;
        }catch(_){}
        let audioMaster=null;
        const audioBuses={},weaponAudioBuses={},soundAudioBuses={};
        function createAudioBuses(){
            audioMaster=audioCtx.createGain();audioMaster.connect(audioCtx.destination);
            for(const key of ['environment','sfx','weapons','music']){audioBuses[key]=audioCtx.createGain();audioBuses[key].connect(audioMaster);}
            for(const [id,category] of Object.entries(SOUND_CATEGORIES)){soundAudioBuses[id]=audioCtx.createGain();soundAudioBuses[id].connect(audioBuses[category]);}
            for(const id of ['sniper','pistol','ak48','nuke'])weaponAudioBuses[id]=soundAudioBuses[id];
            applyAudioSettings();
        }
        function applyAudioSettings(){
            if(!audioMaster)return;
            audioMaster.gain.value=soundEnabled?1:0;
            for(const key of ['environment','sfx','weapons','music'])audioBuses[key].gain.value=audioSettings.advanced?1:audioSettings[key]/100;
            for(const key of Object.keys(soundAudioBuses))soundAudioBuses[key].gain.value=audioSettings.advanced?audioSettings.individual[key]/100:1;
        }
        function saveAudioSettings(){try{localStorage.setItem('platdo_audio_v1',JSON.stringify(audioSettings));}catch(_){} }
        function renderAudioSettings(){
            for(const input of document.querySelectorAll('[data-audio-category],[data-audio-sound]')){
                const key=input.dataset.audioCategory||input.dataset.audioSound;
                const value=input.dataset.audioCategory?audioSettings[key]:audioSettings.individual[key];
                input.value=value;document.getElementById('value-'+key).textContent=value===0?'0% (Muted)':`${value}%`;
                if(input.dataset.audioCategory){input.disabled=audioSettings.advanced;input.closest('.audio-row').style.opacity=audioSettings.advanced?'.4':'1';}
            }
            document.getElementById('advancedAudioNote').textContent=audioSettings.advanced?'Basic audio is locked. Press Reset Advanced Audio Settings below to unlock all basic sliders.':'Basic audio is active. Advanced sliders are at their defaults.';
        }
        for(const input of document.querySelectorAll('[data-audio-category],[data-audio-sound]'))input.addEventListener('input',()=>{
            if(input.dataset.audioCategory&&audioSettings.advanced)return;
            initAudio();const value=Number(input.value);
            if(input.dataset.audioSound){audioSettings.individual[input.dataset.audioSound]=value;audioSettings.advanced=true;}
            else audioSettings[input.dataset.audioCategory]=value;
            applyAudioSettings();saveAudioSettings();renderAudioSettings();
        });
        document.getElementById('resetAdvancedAudioBtn').addEventListener('click',()=>{
            audioSettings.advanced=false;
            for(const key of Object.keys(audioSettings.individual))audioSettings.individual[key]=100;
            applyAudioSettings();saveAudioSettings();renderAudioSettings();
        });
        for(const [attribute,prefix] of [['audioView','audio-'],['audioGroup','advanced-']]){
            const selector=attribute==='audioView'?'[data-audio-view]':'[data-audio-group]';
            const tabs=[...document.querySelectorAll(selector)];
            const select=button=>{for(const tab of tabs){const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;tab.classList.toggle('accent',active);document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;}};
            for(const [i,tab] of tabs.entries()){
                tab.addEventListener('click',()=>select(tab));
                tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;select(tabs[index]);tabs[index].focus();});
            }
            select(tabs[0]);
        }

        function loadGameClips() {
            if(!audioCtx)return;
            for(const [id,data] of Object.entries(gameClipData))if(!gameClipLoading[id]) {
                gameClipLoading[id]=PlatdoAssets.arrayBuffer(data).then(bytes=>audioCtx.decodeAudioData(bytes)).then(buffer=>{gameClipBuffers[id]=buffer;return buffer;}).catch(()=>null);
            }
        }
        function playGameClip(id, weapon=equippedWeapon) {
            if(!soundEnabled||!gameClipData[id])return;
            initAudio();
            const startShot=()=>{
                if(!soundEnabled||!gameClipBuffers[id]||(!gameStarted&&!['levelComplete','levelBonus','weaponMax'].includes(id)))return;
                // A fresh source per shot allows every clip to finish independently.
                const source=audioCtx.createBufferSource(),gain=audioCtx.createGain();
                source.buffer=gameClipBuffers[id];gain.gain.value=1;
                source.connect(gain);gain.connect(soundAudioBuses[id]||audioBuses.sfx);
                activeGameClips.add(source);
                source.onended=()=>{activeGameClips.delete(source);source.disconnect();gain.disconnect();};
                source.start();
            };
            if(gameClipBuffers[id])startShot();else gameClipLoading[id]?.then(startShot);
        }
        function stopGameClips() {
            for(const source of activeGameClips)source.stop();
            activeGameClips.clear();
        }

        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                createAudioBuses();
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(()=>{});
            }
            loadGameClips();
        }

        function playJumpSound() { playGameClip('jump'); }

        function playCoinSound() { playGameClip('coin'); }

        function playStompSound() { playGameClip('stomp'); }

        function playHurtSound() { playGameClip('playerDeath'); }

        function playWinSound() { playGameClip('levelComplete'); }

        function playClickSound() {
            if (!soundEnabled || !audioCtx) return;
            try {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.connect(gain);
                gain.connect(soundAudioBuses.menuClick);
                osc.start(now);
                osc.stop(now + 0.05);
            } catch(e){}
        }

        // Sound Toggle Setup
        const soundToggleBtn = document.getElementById('soundToggleBtn');
        if (soundToggleBtn) {
            soundToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                initAudio();
                soundEnabled = !soundEnabled;
                applyAudioSettings();
                soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
                if (soundEnabled) playClickSound();
                else stopGameClips();
            });
        }

        // Audio Context initialization on user gesture
        window.addEventListener('click', () => { initAudio(); }, { once: true });
        window.addEventListener('keydown', () => { initAudio(); }, { once: true });

        // UI DOM Elements
        const titleOverlay = document.getElementById('titleOverlay');
        const startPlayBtn = document.getElementById('startPlayBtn');
        const levelSelectBtn = document.getElementById('levelSelectBtn');
        const levelSelectModal = document.getElementById('levelSelectModal');
        const closeLevelSelectBtn = document.getElementById('closeLevelSelectBtn');
        const levelGrid = document.getElementById('levelGrid');
        const levelTabCampaign = document.getElementById('levelTabCampaign');
        const levelTabMyLevels = document.getElementById('levelTabMyLevels');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');

        // Level Editor UI Elements
        const levelEditorBtn = document.getElementById('levelEditorBtn');
        const editorLockBadge = document.getElementById('editorLockBadge');
        const editorModal = document.getElementById('editorModal');
        const closeEditorBtn = document.getElementById('closeEditorBtn');
        const editorCanvas = document.getElementById('editorCanvas');
        const editorCtx = editorCanvas ? editorCanvas.getContext('2d') : null;
        const editorStatus = document.getElementById('editorStatus');
        const editorClearBtn = document.getElementById('editorClearBtn');
        const editorTestBtn = document.getElementById('editorTestBtn');
        const editorSaveBtn = document.getElementById('editorSaveBtn');

        // Tool buttons
        const toolPlatform = document.getElementById('toolPlatform');
        const toolCoin = document.getElementById('toolCoin');
        const toolSpike = document.getElementById('toolSpike');
        const toolEnemy = document.getElementById('toolEnemy');
        const toolStart = document.getElementById('toolStart');
        const toolFlag = document.getElementById('toolFlag');
        const toolEraser = document.getElementById('toolEraser');

        // Shop Elements
        const shopBtn = document.getElementById('shopBtn');
        const shopModal = document.getElementById('shopModal');
        const closeShopBtn = document.getElementById('closeShopBtn');
        const shopBalanceDisplay = document.getElementById('shopBalanceDisplay');
        const shopGrid = document.getElementById('shopGrid');
        const shopMsg = document.getElementById('shopMsg');
        const shopTabColors = document.getElementById('shopTabColors');
        const shopTabTrails = document.getElementById('shopTabTrails');
        const shopTabThemes = document.getElementById('shopTabThemes');
        const themeSubFilters = document.getElementById('themeSubFilters');
        const filterBg = document.getElementById('filterBg');
        const filterPlat = document.getElementById('filterPlat');
        const filterFloor = document.getElementById('filterFloor');

        // Locker Elements
        const lockerBtn = document.getElementById('lockerBtn');
        const lockerModal = document.getElementById('lockerModal');
        const closeLockerBtn = document.getElementById('closeLockerBtn');
        const lockerGrid = document.getElementById('lockerGrid');
        const lockerMsg = document.getElementById('lockerMsg');
        const lockerTabColors = document.getElementById('lockerTabColors');
        const lockerTabTrails = document.getElementById('lockerTabTrails');
        const lockerTabThemes = document.getElementById('lockerTabThemes');
        const lockerPreviewCanvas = document.getElementById('lockerPreviewCanvas');
        const lockerPreviewCtx = lockerPreviewCanvas ? lockerPreviewCanvas.getContext('2d') : null;
        const previewName = document.getElementById('previewName');

        const scoreDisplay = document.getElementById('scoreDisplay');
        const statusMessage = document.getElementById('statusMessage');
        const menuBtn = document.getElementById('menuBtn');
        const winOverlay = document.getElementById('winOverlay');
        const winTitle = document.getElementById('winTitle');
        const winIcon = document.getElementById('winIcon');
        const finalScore = document.getElementById('finalScore');
        const nextLevelBtn = document.getElementById('nextLevelBtn');
        const winMenuBtn = document.getElementById('winMenuBtn');
        const pauseOverlay = document.getElementById('pauseOverlay');
        const resumeBtn = document.getElementById('resumeBtn');
        const restartBtn = document.getElementById('restartBtn');
        const pauseSettingsBtn = document.getElementById('pauseSettingsBtn');
        const pauseMenuBtn = document.getElementById('pauseMenuBtn');

        // Admin Elements
        const adminBtn = document.getElementById('adminBtn');
        const adminModal = document.getElementById('adminModal');
        const closeAdminBtn = document.getElementById('closeAdminBtn');
        const adminAuthSection = document.getElementById('adminAuthSection');
        const adminControlsSection = document.getElementById('adminControlsSection');
        const adminPassInput = document.getElementById('adminPassInput');
        const adminAuthBtn = document.getElementById('adminAuthBtn');
        const adminAuthError = document.getElementById('adminAuthError');
        const adminAddCashBtn = document.getElementById('adminAddCashBtn');
        const adminPassLevelBtn = document.getElementById('adminPassLevelBtn');
        const adminUnlockAllBtn = document.getElementById('adminUnlockAllBtn');
        const adminResetProgressBtn = document.getElementById('adminResetProgressBtn');

        // Game State Variables
        let gameStarted = false;
        let isPaused = false;
        let isSlidingFlag = false; // Flag slide animation state
        let flagSlideTargetY = 0;
        let flagClothY = null;
        let flagMultiplier = 1.0;
        let flagBonusCash = 0;
        let currentLevel = 0;
        let isCustomLevel = false;
        let customLevelIndex = -1;
        let testingEditor = false;
        let maxUnlockedLevel = 0; // Highest reachable level index; LEVELS.length means campaign completed.
        let score = 0;
        let levelStartScore = 0;
        let runEarned = 0;
        let targetFps = 60;
        let lastFrameTime = performance.now();
        let selectedLevelTab = 'campaign'; // 'campaign' or 'my_levels'

        // Color Shop Definitions
        const SHOP_ITEMS = [
            { id: 'hero_blue', name: 'Hero Blue', price: 0, body: '#2563eb', outline: '#1e40af' },
            { id: 'crimson', name: 'Crimson', price: 500, body: '#dc2626', outline: '#991b1b' },
            { id: 'emerald', name: 'Emerald', price: 1500, body: '#16a34a', outline: '#166534' },
            { id: 'shadow', name: 'Shadow', price: 3500, body: '#9333ea', outline: '#6b21a8' },
            { id: 'neon_pink', name: 'Neon Pink', price: 8000, body: '#ec4899', outline: '#be185d' },
            { id: 'cyber_cyan', name: 'Cyber Cyan', price: 18000, body: '#06b6d4', outline: '#0e7490' },
            { id: 'obsidian', name: 'Obsidian', price: 30000, body: '#334155', outline: '#0f172a' },
            { id: 'golden', name: 'Golden', price: 50000, body: '#eab308', outline: '#ca8a04' }
        ];

        const TRAIL_ITEMS = [
            { id: 'none', name: 'None', price: 0, color: null, type: 'none' },
            { id: 'cyan_spark', name: 'Cyan Sparkles', price: 1000, color: '#06b6d4', type: 'single' },
            { id: 'fire_ember', name: 'Fire Embers', price: 5000, color: '#f97316', type: 'single' },
            { id: 'emerald_dust', name: 'Emerald Dust', price: 15000, color: '#10b981', type: 'single' },
            { id: 'shadow_smoke', name: 'Shadow Smoke', price: 30000, color: '#a855f7', type: 'single' },
            { id: 'gold_trail', name: 'Gold Trail', price: 50000, color: '#eab308', type: 'gold' },
            { id: 'rainbow_trail', name: 'Rainbow Trail', price: 100000, color: 'rainbow', type: 'rainbow' }
        ];

        // Themes Shop Items
        const THEME_ITEMS = [
            { id: 'bg_dark', category: 'bg', name: 'Blue Sky & Clouds (Default)', price: 0, bg: '#62baf5', grid: '#93d5ff' },
            { id: 'bg_midnight', category: 'bg', name: 'Midnight Purple', price: 2000, bg: '#1e1b4b', grid: '#312e81' },
            { id: 'bg_deepsea', category: 'bg', name: 'Deep Ocean', price: 5000, bg: '#042f2e', grid: '#134e4a' },
            { id: 'bg_sunset', category: 'bg', name: 'Cyber Sunset', price: 12000, bg: '#450a0a', grid: '#7f1d1d' },
            { id: 'bg_matrix', category: 'bg', name: 'Neon Matrix', price: 25000, bg: '#022c22', grid: '#064e3b' },

            { id: 'plat_slate', category: 'plat', name: 'Grassy Dirt (Default)', price: 0, body: '#925a34', top: '#55b83f' },
            { id: 'plat_ruby', category: 'plat', name: 'Ruby Glow', price: 2500, body: '#450a0a', top: '#ef4444' },
            { id: 'plat_emerald', category: 'plat', name: 'Emerald Jade', price: 6000, body: '#064e3b', top: '#10b981' },
            { id: 'plat_gold', category: 'plat', name: 'Golden Deluxe', price: 15000, body: '#713f12', top: '#facc15' },
            { id: 'plat_violet', category: 'plat', name: 'Electric Violet', price: 30000, body: '#581c87', top: '#c084fc' },

            { id: 'floor_classic', category: 'floor', name: 'Grassland Floor (Default)', price: 0, spike: '#ef4444' },
            { id: 'floor_lava', category: 'floor', name: 'Volcanic Lava', price: 3000, spike: '#f97316' },
            { id: 'floor_mint', category: 'floor', name: 'Cyber Mint Spikes', price: 8000, spike: '#34d399' },
            { id: 'floor_toxic', category: 'floor', name: 'Toxic Purple Spikes', price: 20000, spike: '#a855f7' }
        ];

        let unlockedColors = ['hero_blue'];
        let equippedColorId = 'hero_blue';
        let playerColors = { body: '#2563eb', outline: '#1e40af' };

        let unlockedTrails = ['none'];
        let equippedTrailId = 'none';

        let unlockedThemes = ['bg_dark', 'plat_slate', 'floor_classic'];
        let equippedBgId = 'bg_dark';
        let equippedPlatId = 'plat_slate';
        let equippedFloorId = 'floor_classic';

        let currentShopTab = 'colors';
        let currentThemeSubFilter = 'bg';
        let currentLockerTab = 'colors';
        let playerTrailHistory = [];
        let trailHueOffset = 0;

        // Custom Saved Levels Array
        let customLevels = [];

        // Load custom levels from localStorage
        try {
            const saved = localStorage.getItem('platformer_custom_levels');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) customLevels = parsed.filter(level =>
                    level && Array.isArray(level.platforms) && Array.isArray(level.coins) &&
                    ['platforms', 'coins', 'spikes', 'enemies'].every(key =>
                        level[key] === undefined || (Array.isArray(level[key]) && level[key].every(item =>
                            item && Number.isFinite(item.x) && Number.isFinite(item.y)))));
            }
        } catch (e) {}

        function saveCustomLevelsToStorage() {
            try {
                localStorage.setItem('platformer_custom_levels', JSON.stringify(customLevels));
                return true;
            } catch (e) { return false; }
        }

        // Level Editor Working Data
        let currentEditorTool = 'platform'; // 'platform', 'coin', 'spike', 'enemy', 'start', 'flag', 'eraser'
        let editorData = {
            start: { x: 50, y: 350 },
            flag: { x: 720, y: 170, width: 24, height: 210 },
            platforms: [
                { x: 0, y: 400, width: 800, height: 50 }
            ],
            coins: [],
            spikes: [],
            enemies: []
        };
        let isDrawingPlatform = false;
        let drawStartPos = { x: 0, y: 0 };
        let drawCurrentPos = { x: 0, y: 0 };

        function checkLevelEditorUnlocked() {
            // Keep the existing editor reward at the end of the first ten levels.
            const unlocked = maxUnlockedLevel >= 10;
            if (editorLockBadge) {
                if (unlocked) {
                    editorLockBadge.textContent = '🔓 Unlocked';
                    editorLockBadge.className = 'bg-teal-950 text-teal-300 text-[10px] px-2 py-0.5 rounded-full border border-teal-500/40';
                } else {
                    editorLockBadge.textContent = '🔒 Beat Lvl 10';
                    editorLockBadge.className = 'bg-slate-950 text-amber-400 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30';
                }
            }
            return unlocked;
        }

        function updateCashDisplay() {
            if (scoreDisplay) scoreDisplay.textContent = `$${score.toLocaleString()}`;
            if (shopBalanceDisplay) shopBalanceDisplay.textContent = `$${score.toLocaleString()}`;
        }

        function showStatusMessage(msg) {
            if (statusMessage) statusMessage.textContent = msg;
        }

        function checkAABB(rect1, rect2) {
            return (
                rect1.x < rect2.x + rect2.width &&
                rect1.x + rect1.width > rect2.x &&
                rect1.y < rect2.y + rect2.height &&
                rect1.y + rect1.height > rect2.y
            );
        }

        function circleBoxIntersect(circle, rect) {
            const distX = Math.abs(circle.x - rect.x - rect.width / 2);
            const distY = Math.abs(circle.y - rect.y - rect.height / 2);

            if (distX > (rect.width / 2 + circle.radius)) return false;
            if (distY > (rect.height / 2 + circle.radius)) return false;

            if (distX <= (rect.width / 2)) return true;
            if (distY <= (rect.height / 2)) return true;

            const dx = distX - rect.width / 2;
            const dy = distY - rect.height / 2;
            return (dx * dx + dy * dy <= (circle.radius * circle.radius));
        }

        function restartLevel(died=false) {
            if(died)playHurtSound();
            score = died&&!testingEditor ? Math.max(0,score-500) : levelStartScore;
            updateCashDisplay();
            if (isCustomLevel) {
                loadCustomLevel(customLevelIndex, testingEditor ? editorData : null);
            } else {
                inventory = { ...levelStartInventory };
                loadLevel(currentLevel, true);
            }
            if(died){saveFullProgress();if(!testingEditor)showStatusMessage("You died! −$500 (balance cannot go below $0).");}
        }

        function celebrateLevelFinish(){
            const maximum=flagMultiplier>=5;
            document.getElementById('maxFlagToast').hidden=true;
            winOverlay.classList.toggle('max-win',maximum);
            document.getElementById('maxWinBanner').hidden=!maximum;
            const confetti=document.getElementById('maxConfetti');confetti.replaceChildren();
            if(maximum&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
                const colors=['#facc15','#fb7185','#38bdf8','#a7f3d0','#fff7cc'];
                for(let i=0;i<48;i++){
                    const piece=document.createElement('i');piece.style.setProperty('--x',`${(i*37)%100}%`);
                    piece.style.setProperty('--color',colors[i%colors.length]);piece.style.setProperty('--delay',`${(i%8)*.08}s`);
                    piece.style.setProperty('--drift',`${(i%2?1:-1)*(20+i%6*10)}px`);confetti.append(piece);
                }
            }
        }
        function completeLevel() {
            if (testingEditor) {
                returnToMenu();
                editorModal.classList.remove('hidden');
                renderEditorCanvas();
                return;
            }
            celebrateLevelFinish();
            playGameClip(flagMultiplier<5?'levelComplete':'levelBonus');
            gameStarted = false;
            const baseCoins = runEarned;
            const runTotal = runEarned + flagBonusCash + 500;
            const record = recordLevelScore(runTotal);
            score += flagBonusCash + 500;
            updateCashDisplay();

            if (!isCustomLevel) {
                if (currentLevel >= maxUnlockedLevel) {
                    maxUnlockedLevel = currentLevel + 1;
                }
                checkLevelEditorUnlocked();
            }

            if (winTitle) {
                winTitle.textContent = isCustomLevel
                    ? `${customLevels[customLevelIndex]?.name || 'Custom Level'} Completed!`
                    : `Level ${currentLevel + 1} Completed!`;
            }

            if (finalScore) {
                finalScore.innerHTML = `
                    <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs sm:text-sm text-left max-w-xs mx-auto mb-1 shadow-inner">
                        <div class="flex justify-between items-center text-slate-300">
                            <span>Coins & Enemy Rewards:</span>
                            <span class="font-bold text-amber-400">$${baseCoins.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between items-center text-indigo-300 font-bold">
                            <span>Flag Height Multiplier:</span>
                            <span class="text-emerald-400">${flagMultiplier.toFixed(1)}x (+ $${flagBonusCash.toLocaleString()})</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-400 text-[11px]">
                            <span>Level Finish Reward:</span>
                            <span class="font-bold text-sky-400">+$500</span>
                        </div>
                        <div class="flex justify-between items-center text-amber-300">
                            <span>Run Score:</span><strong>$${runTotal.toLocaleString()}</strong>
                        </div>
                        <div class="flex justify-between items-center text-emerald-300">
                            <span>${record.improved ? 'New High Score!' : 'High Score'}${record.saved ? '' : ' (this session)'}</span><strong>$${record.best.toLocaleString()}</strong>
                        </div>
                        <div class="flex justify-between items-center text-sm font-black text-white pt-2 border-t border-slate-800">
                            <span>Total Cash Balance:</span>
                            <span class="text-emerald-400">$${score.toLocaleString()}</span>
                        </div>
                    </div>
                `;
            }
            updateWeaponHUD();
            if (winOverlay) winOverlay.classList.remove('hidden');
        }

        function renderLockerPreview() {
            if (!lockerPreviewCtx || !lockerPreviewCanvas) return;
            const w = lockerPreviewCanvas.width;
            const h = lockerPreviewCanvas.height;
            lockerPreviewCtx.clearRect(0, 0, w, h);

            lockerPreviewCtx.fillStyle = '#0f172a';
            lockerPreviewCtx.fillRect(0, 0, w, h);

            const eqTrail = TRAIL_ITEMS.find(t => t.id === equippedTrailId);
            if (eqTrail && eqTrail.type !== 'none') {
                lockerPreviewCtx.fillStyle = eqTrail.color === 'rainbow' ? '#ec4899' : (eqTrail.color || '#38bdf8');
                lockerPreviewCtx.beginPath();
                lockerPreviewCtx.roundRect(w / 2 - 20, h / 2 - 10, 20, 26, 4);
                lockerPreviewCtx.fill();
            }

            const charW = 22;
            const charH = 30;
            const px = (w - charW) / 2;
            const py = (h - charH) / 2;

            lockerPreviewCtx.fillStyle = playerColors.body;
            lockerPreviewCtx.beginPath();
            lockerPreviewCtx.roundRect(px, py, charW, charH, 5);
            lockerPreviewCtx.fill();
            lockerPreviewCtx.strokeStyle = playerColors.outline;
            lockerPreviewCtx.lineWidth = 2;
            lockerPreviewCtx.stroke();

            lockerPreviewCtx.fillStyle = '#ffffff';
            lockerPreviewCtx.beginPath();
            lockerPreviewCtx.arc(px + 14, py + 9, 3, 0, Math.PI * 2);
            lockerPreviewCtx.fill();
            lockerPreviewCtx.fillStyle = '#000000';
            lockerPreviewCtx.beginPath();
            lockerPreviewCtx.arc(px + 15, py + 9, 1.5, 0, Math.PI * 2);
            lockerPreviewCtx.fill();
        }

        // Physics & Controls State
        const keys = { left: false, right: false, up: false };
        const gravity = 0.5;

        // Player Entity
        const player = {
            x: 50,
            y: 300,
            width: 28,
            height: 38,
            vx: 0,
            vy: 0,
            speed: 4.5,
            jumpStrength: -10.8,
            isOnGround: false
        };

        // World Level Entities
        let platforms = [];
        let coins = [];
        let spikes = [];
        let enemies = [];
        let flag = { x: 0, y: 0, width: 24, height: 210 };

        const LEVELS = [
            // Level 1: Basic Tutorial
            {
                start: { x: 40, y: 350 },
                flag: { x: 730, y: 170, width: 24, height: 210 },
                platforms: [
                    { x: 0, y: 380, width: 800, height: 70 },
                    { x: 220, y: 300, width: 120, height: 20 },
                    { x: 420, y: 240, width: 140, height: 20 }
                ],
                coins: [
                    { x: 280, y: 260 },
                    { x: 490, y: 200 },
                    { x: 650, y: 340 }
                ],
                spikes: [],
                enemies: []
            },
            // Level 2
            {
                start: { x: 40, y: 350 },
                flag: { x: 740, y: 170, width: 24, height: 210 },
                platforms: [
                    { x: 0, y: 380, width: 250, height: 70 },
                    { x: 300, y: 380, width: 500, height: 70 },
                    { x: 180, y: 280, width: 100, height: 20 },
                    { x: 400, y: 260, width: 120, height: 20 }
                ],
                spikes: [
                    { x: 250, y: 430, width: 50, height: 20 }
                ],
                coins: [
                    { x: 230, y: 240 },
                    { x: 460, y: 220 },
                    { x: 600, y: 340 }
                ],
                enemies: []
            },
            // Level 3
            {
                start: { x: 40, y: 350 },
                flag: { x: 730, y: 170, width: 24, height: 210 },
                platforms: [
                    { x: 0, y: 380, width: 800, height: 70 },
                    { x: 200, y: 290, width: 140, height: 20 },
                    { x: 450, y: 240, width: 140, height: 20 }
                ],
                spikes: [
                    { x: 350, y: 360, width: 40, height: 20 }
                ],
                enemies: [
                    { x: 460, y: 212, width: 28, height: 28, minX: 450, maxX: 560, speed: 1.5, dir: 1, alive: true },
                    { x: 500, y: 352, width: 28, height: 28, minX: 400, maxX: 700, speed: 2, dir: 1, alive: true }
                ],
                coins: [
                    { x: 270, y: 250 },
                    { x: 520, y: 200 },
                    { x: 680, y: 340 }
                ]
            },
            // Level 4
            {
                start: { x: 40, y: 300 },
                flag: { x: 740, y: 20, width: 24, height: 180 },
                platforms: [
                    { x: 0, y: 350, width: 120, height: 100 },
                    { x: 180, y: 310, width: 90, height: 20 },
                    { x: 330, y: 270, width: 90, height: 20 },
                    { x: 480, y: 230, width: 90, height: 20 },
                    { x: 630, y: 200, width: 170, height: 250 }
                ],
                spikes: [
                    { x: 120, y: 430, width: 510, height: 20 }
                ],
                enemies: [
                    { x: 650, y: 172, width: 28, height: 28, minX: 630, maxX: 750, speed: 2, dir: 1, alive: true }
                ],
                coins: [
                    { x: 225, y: 270 },
                    { x: 375, y: 230 },
                    { x: 525, y: 190 }
                ]
            },
            // Level 5
            {
                start: { x: 40, y: 350 },
                flag: { x: 740, y: 170, width: 24, height: 210 },
                platforms: [
                    { x: 0, y: 380, width: 800, height: 70 },
                    { x: 180, y: 280, width: 440, height: 20 }
                ],
                spikes: [
                    { x: 200, y: 360, width: 400, height: 20 }
                ],
                enemies: [
                    { x: 220, y: 252, width: 28, height: 28, minX: 180, maxX: 350, speed: 2, dir: 1, alive: true },
                    { x: 420, y: 252, width: 28, height: 28, minX: 360, maxX: 600, speed: 2.2, dir: -1, alive: true }
                ],
                coins: [
                    { x: 250, y: 220 },
                    { x: 400, y: 220 },
                    { x: 550, y: 220 }
                ]
            },
            // Level 6
            {
                start: { x: 50, y: 380 },
                flag: { x: 70, y: 10, width: 24, height: 110 },
                platforms: [
                    { x: 0, y: 420, width: 200, height: 30 },
                    { x: 250, y: 350, width: 140, height: 20 },
                    { x: 450, y: 290, width: 140, height: 20 },
                    { x: 650, y: 230, width: 150, height: 20 },
                    { x: 350, y: 170, width: 200, height: 20 },
                    { x: 40, y: 120, width: 200, height: 20 }
                ],
                spikes: [
                    { x: 200, y: 430, width: 600, height: 20 }
                ],
                enemies: [
                    { x: 270, y: 322, width: 28, height: 28, minX: 250, maxX: 370, speed: 1.8, dir: 1, alive: true },
                    { x: 370, y: 142, width: 28, height: 28, minX: 350, maxX: 530, speed: 2.5, dir: 1, alive: true }
                ],
                coins: [
                    { x: 320, y: 310 },
                    { x: 520, y: 250 },
                    { x: 450, y: 130 }
                ]
            },
            // Level 7
            {
                start: { x: 40, y: 350 },
                flag: { x: 740, y: 170, width: 24, height: 210 },
                platforms: [
                    { x: 0, y: 380, width: 150, height: 70 },
                    { x: 200, y: 380, width: 120, height: 70 },
                    { x: 370, y: 380, width: 120, height: 70 },
                    { x: 540, y: 380, width: 260, height: 70 }
                ],
                spikes: [
                    { x: 150, y: 430, width: 50, height: 20 },
                    { x: 320, y: 430, width: 50, height: 20 }
                ],
                enemies: [
                    { x: 210, y: 352, width: 28, height: 28, minX: 200, maxX: 300, speed: 2, dir: 1, alive: true },
                    { x: 380, y: 352, width: 28, height: 28, minX: 370, maxX: 470, speed: 2.5, dir: -1, alive: true },
                    { x: 560, y: 352, width: 28, height: 28, minX: 540, maxX: 720, speed: 3, dir: 1, alive: true }
                ],
                coins: [
                    { x: 260, y: 320 },
                    { x: 430, y: 320 },
                    { x: 650, y: 320 }
                ]
            },
            // Level 8
            {
                start: { x: 40, y: 380 },
                flag: { x: 740, y: 210, width: 24, height: 210 },
                platforms: [
                    { x: 0, y: 420, width: 120, height: 30 },
                    { x: 160, y: 320, width: 80, height: 20 },
                    { x: 290, y: 220, width: 80, height: 20 },
                    { x: 420, y: 140, width: 100, height: 20 },
                    { x: 570, y: 240, width: 80, height: 20 },
                    { x: 700, y: 420, width: 100, height: 30 }
                ],
                spikes: [
                    { x: 120, y: 430, width: 580, height: 20 }
                ],
                enemies: [
                    { x: 430, y: 112, width: 28, height: 28, minX: 420, maxX: 500, speed: 1.5, dir: 1, alive: true }
                ],
                coins: [
                    { x: 200, y: 280 },
                    { x: 330, y: 180 },
                    { x: 610, y: 200 }
                ]
            },
            // Level 9
            {
                start: { x: 40, y: 350 },
                flag: { x: 740, y: 10, width: 24, height: 170 },
                platforms: [
                    { x: 0, y: 380, width: 800, height: 70 },
                    { x: 150, y: 280, width: 500, height: 20 },
                    { x: 250, y: 180, width: 550, height: 20 }
                ],
                spikes: [
                    { x: 200, y: 360, width: 400, height: 20 }
                ],
                enemies: [
                    { x: 160, y: 252, width: 28, height: 28, minX: 150, maxX: 630, speed: 3, dir: 1, alive: true },
                    { x: 600, y: 252, width: 28, height: 28, minX: 150, maxX: 630, speed: 3.5, dir: -1, alive: true },
                    { x: 270, y: 152, width: 28, height: 28, minX: 250, maxX: 780, speed: 4, dir: 1, alive: true }
                ],
                coins: [
                    { x: 300, y: 230 },
                    { x: 500, y: 230 },
                    { x: 500, y: 130 }
                ]
            },
            // Level 10: Grand Finale
            {
                start: { x: 40, y: 380 },
                flag: { x: 740, y: 10, width: 24, height: 130 },
                platforms: [
                    { x: 0, y: 420, width: 120, height: 30 },
                    { x: 170, y: 350, width: 100, height: 20 },
                    { x: 320, y: 280, width: 100, height: 20 },
                    { x: 470, y: 210, width: 100, height: 20 },
                    { x: 620, y: 140, width: 180, height: 20 }
                ],
                spikes: [
                    { x: 120, y: 430, width: 680, height: 20 }
                ],
                enemies: [
                    { x: 180, y: 322, width: 28, height: 28, minX: 170, maxX: 250, speed: 2, dir: 1, alive: true },
                    { x: 330, y: 252, width: 28, height: 28, minX: 320, maxX: 400, speed: 2.5, dir: -1, alive: true },
                    { x: 480, y: 182, width: 28, height: 28, minX: 470, maxX: 550, speed: 3, dir: 1, alive: true },
                    { x: 640, y: 112, width: 28, height: 28, minX: 620, maxX: 780, speed: 3.5, dir: -1, alive: true }
                ],
                coins: [
                    { x: 220, y: 310 },
                    { x: 370, y: 240 },
                    { x: 520, y: 170 },
                    { x: 700, y: 90 }
                ]
            }
        ];

        // Each route is authored separately. Entries are [centre X, surface Y, width].
        // The route is retained as a walkthrough target list for physics verification.
        const ADVANCED_COURSES = [
            ['First Cliff Patrol', [[55,420,110],[190,340,110],[350,270,120],[510,325,100],[680,245,150]]],
            ['Broken Meadow', [[55,400,110],[200,400,90],[365,340,100],[535,400,85],[705,330,130]]],
            ['Three Watchtowers', [[60,420,120],[200,330,100],[350,240,100],[505,150,100],[680,225,130]]],
            ['Ridge Descent', [[60,300,120],[230,370,95],[385,290,100],[540,210,90],[705,290,130]]],
            ['Cloud Checkpoints', [[60,420,120],[200,335,90],[345,255,110],[490,175,90],[635,95,110],[735,175,100]]],
            ['Long Jump Orchard', [[60,400,120],[240,350,85],[425,325,90],[605,365,90],[745,285,90]]],
            ['Westbound Watch', [[740,420,120],[595,335,95],[440,265,115],[280,330,95],[110,250,140]]],
            ['Needle Bridges', [[60,420,120],[190,340,75],[335,285,70],[480,340,75],[630,270,80],[745,195,90]]],
            ['Hilltop Ambush', [[55,400,110],[205,315,135],[385,265,140],[570,315,135],[735,235,100]]],
            ['Crosswind Pass', [[65,350,130],[235,410,95],[405,330,90],[570,245,105],[730,325,100]]],
            ['Leftward Leap', [[740,330,120],[565,390,95],[390,310,100],[230,230,95],[65,310,110]]],
            ['The High Return', [[55,420,110],[200,335,110],[345,250,110],[490,165,110],[635,80,120],[460,70,100],[290,75,120]]],
            ['Canyon Teeth', [[50,420,100],[190,350,65],[330,285,65],[470,350,65],[610,285,70],[750,220,90]]],
            ['Patrol Crossing', [[60,410,120],[220,350,150],[425,310,150],[635,350,150],[755,265,80]]],
            ['Roofline Run', [[55,390,110],[205,300,95],[360,215,105],[525,130,95],[700,185,150]]],
            ['Backtrack Bluff', [[745,420,110],[600,335,110],[455,250,100],[310,165,110],[165,80,110],[340,65,110],[520,80,110]]],
            ['Staggered Stones', [[50,420,100],[170,335,70],[300,260,75],[455,325,70],[600,240,80],[740,310,100]]],
            ['Cloudline Guards', [[60,415,120],[220,335,145],[400,250,135],[590,175,145],[740,100,100]]],
            ['Twin Chasms', [[60,400,120],[245,350,80],[425,395,100],[610,335,80],[750,250,90]]],
            ['Skyward Switchback', [[60,420,120],[205,335,110],[350,250,110],[205,160,100],[60,75,100],[220,65,100],[390,70,130]]],
            ['Short Landing', [[55,410,110],[190,335,65],[330,260,60],[475,330,65],[625,265,60],[750,185,85]]],
            ['The Eastern Wall', [[745,420,110],[600,330,95],[450,245,100],[290,160,95],[115,230,140]]],
            ['Guarded Gardens', [[65,420,130],[240,340,160],[440,260,150],[635,340,150],[755,255,80]]],
            ['Crater Hop', [[65,310,130],[240,390,80],[410,325,85],[585,395,80],[745,310,90]]],
            ['Upper Loop', [[55,420,110],[195,335,100],[340,250,100],[485,165,100],[630,80,110],[455,65,100],[285,80,100],[115,70,120]]],
            ['Sawgrass Summit', [[55,420,110],[185,330,70],[325,245,70],[465,155,70],[615,230,75],[750,145,80]]],
            ['Reverse Ravine', [[750,390,100],[585,335,75],[420,405,85],[250,325,80],[75,250,115]]],
            ['Cloud Forts', [[60,420,120],[215,335,130],[390,250,125],[565,165,130],[730,80,120]]],
            ['Switchback Sentries', [[740,420,120],[590,335,110],[440,250,110],[590,160,110],[740,75,110],[570,65,100],[400,75,120]]],
            ['The Narrow Route', [[45,420,90],[175,350,60],[320,280,60],[465,350,60],[615,275,60],[755,205,80]]],
            ['Four Wind Towers', [[55,410,110],[210,320,85],[370,230,85],[530,140,85],[710,210,130]]],
            ['Sunlit Battlements', [[65,390,130],[250,330,160],[455,265,155],[655,330,150]]],
            ['Highland Detour', [[60,420,120],[205,335,100],[350,250,100],[495,165,100],[640,80,100],[470,65,90],[300,75,100]]],
            ['Deep Valley Patrol', [[65,275,130],[245,355,90],[420,420,90],[585,335,90],[740,245,100]]],
            ['Westward Needles', [[750,420,100],[610,335,65],[470,250,65],[325,320,65],[180,235,65],[55,150,90]]],
            ['The Crown Climb', [[55,420,110],[195,335,85],[340,250,85],[485,165,85],[630,80,90],[750,150,85]]],
            ['Last Patrol Bridge', [[60,410,120],[230,345,140],[425,285,140],[620,350,140],[755,265,80]]],
            ['Knife Edge Skyline', [[50,420,100],[180,335,60],[320,250,60],[460,165,60],[610,235,65],[750,150,85]]],
            ['Final Switchback', [[745,420,110],[600,335,95],[455,250,95],[310,165,95],[165,80,95],[340,65,95],[515,75,110],[700,65,130]]],
            ['Crown of the Clouds', [[55,420,110],[200,335,80],[350,250,80],[500,165,80],[650,80,90],[480,65,80],[315,80,80],[150,65,110]]]
        ];
        ADVANCED_COURSES.forEach(([name, route], index) => {
            const tier = Math.floor(index / 10);
            const platforms = route.map(([cx,y,width], j) => ({x:cx-width/2,y,width,height:j===0 ? 450-y : 24}));
            const guards = [];
            for (let j=1; j<platforms.length; j++) {
                // Patrols sit ON the ledge; early routes leave occasional breathing room.
                if (index < 10 && j % 2 === 0) continue;
                const p=platforms[j];
                const room = p.width - 28;
                guards.push({ x:p.x + room * .65, y:p.y-28, width:28, height:28,
                    minX:p.x+3, maxX:p.x+p.width-3, speed:1.0+tier*.35+(j%2)*.2, dir:j%2 ? -1 : 1, alive:true });
            }
            const first=platforms[0], last=platforms[platforms.length-1];
            const direction=route.at(-1)[0]>=route.at(-2)[0] ? 1 : -1;
            const flagX=direction>0 ? last.x+last.width-32 : last.x+8;
            LEVELS.push({name, route, start:{x:route[0][0]-14,y:first.y-38},
                flag:{x:flagX,y:last.y-105,width:24,height:105}, platforms,
                coins:route.map(([cx,y])=>({x:cx,y:y-24})),
                spikes:[{x:0,y:438,width:800,height:12}], enemies:guards });
        });

// Levels 51Ã¢â‚¬â€œ100: individually authored routes, patrol ledges and hazard footprints.
// Route points are [centre X, surface Y, width]; their order describes a playable walkthrough.
const EXPEDITION_COURSES = [
 ['Orchard Basin','Descend into the orchard, then climb its far wall.',[[60,220,115],[220,295,130],[395,390,170],[575,305,110],[730,220,120]],[1,2,4],[[0,438,800,12]]],
 ['Hooked Harbor','Follow the quay east, then turn back above the water.',[[65,415,130],[245,370,170],[430,290,110],[590,205,140],[725,120,100],[545,75,130],[360,105,150]],[1,3,5],[[150,430,560,20]]],
 ['Bell Tower','Climb a tight zigzag around the bell tower.',[[340,420,140],[490,335,100],[350,245,110],[495,160,95],[345,75,130]],[1,3,4],[[0,438,275,12],[415,438,385,12]]],
 ['Split Viaduct','Cross broad broken bridge spans with two steep steps.',[[70,400,140],[265,400,180],[460,315,95],[620,315,155],[745,225,90]],[1,3],[[145,430,50,20],[365,430,210,20]]],
 ['The Hanging Bowl','Drop through the suspended bowl and exit up its eastern rim.',[[85,120,150],[255,200,95],[410,285,120],[570,365,120],[725,280,110]],[1,2,3],[[195,438,605,12]]],
 ['Needle and Shelf','Alternate tiny stepping stones with roomy guarded shelves.',[[55,420,100],[175,340,55],[320,295,170],[485,210,55],[630,150,180],[745,70,80]],[2,4],[[105,430,695,20]]],
 ['Rooftop U-Turn','Scale the east roofs and return across the upper balconies.',[[105,415,150],[270,325,110],[440,235,155],[625,150,105],[460,65,100],[280,85,140],[105,95,130]],[1,2,4,6],[[210,438,590,12]]],
 ['Quarry Floor','Climb out of the pit before crossing its lower work platforms.',[[55,410,110],[185,325,85],[330,240,105],[490,310,130],[670,400,180]],[1,3,4],[[115,438,390,12]]],
 ['The Bent Ladder','Two turns lead to a flag above the starting ledge.',[[410,420,120],[250,330,90],[100,240,120],[255,155,105],[420,65,125]],[1,2,4],[[0,438,350,12],[470,438,330,12]]],
 ['Longspan Crossing','Commit to long jumps across three broad guarded spans.',[[75,365,150],[285,325,165],[505,365,175],[720,300,145]],[1,2,3],[[155,435,50,15],[380,435,35,15],[600,435,45,15]]],
 ['Sunken Courtyard','Drop into the courtyard and climb back over its entrance.',[[650,100,150],[475,175,100],[310,260,130],[140,345,130],[300,420,135],[470,335,90],[635,250,140]],[1,3,5,6],[[365,438,435,12]]],
 ['Terrace Spine','A central spine rises between left and right terraces.',[[400,420,180],[220,350,130],[365,260,90],[540,185,155],[385,95,120],[205,70,145]],[1,3,5],[[0,438,290,12],[500,438,300,12]]],
 ['Broken Aqueduct','Hop across irregular arch tops, then drop onto the outlet.',[[50,345,100],[190,270,90],[355,315,130],[530,235,100],[690,155,145],[735,355,100]],[1,2,4,5],[[105,430,540,20]]],
 ['The Low Road Home','Climb the western tower, cross its crown, and descend east.',[[60,415,120],[185,330,80],[60,245,95],[205,155,100],[370,90,130],[535,180,90],[705,300,150]],[1,3,5,6],[[125,438,510,12]]],
 ['Sentry Island','A long safe bank leads to small outposts and a guarded island.',[[100,400,200],[305,340,110],[470,400,80],[620,315,160],[750,230,80]],[1,3,4],[[205,432,40,18],[365,432,170,18]]],
 ['Switchyard','Change direction at each stacked station.',[[520,420,150],[355,330,115],[510,240,100],[345,150,125],[510,60,150]],[1,2,4],[[0,438,440,12],[605,438,195,12]]],
 ['The Crooked Crown','Climb uneven crown points and finish in the inner notch.',[[60,415,115],[205,325,95],[350,245,90],[510,160,120],[680,75,150],[715,300,130],[540,385,160]],[1,3,4,6],[[120,438,200,12],[465,438,335,12]]],
 ['Canal Locks','Each lock changes height and landing width.',[[65,390,130],[240,330,140],[430,390,155],[610,300,105],[735,210,110]],[1,2,4],[[135,420,30,30],[325,420,25,30],[515,420,35,30]]],
 ['Clifftop Spiral','Curl around the cliff and finish below the upper rim.',[[75,415,150],[245,335,120],[415,250,135],[585,165,120],[735,80,105],[565,70,105],[395,85,115],[230,170,90]],[1,2,4,6,7],[[155,438,645,12]]],
 ['Five Chimneys','Vault five slim, unequal chimney caps.',[[55,405,105],[180,320,65],[315,235,60],[460,315,75],[610,230,60],[745,145,90]],[1,3,5],[[110,425,690,25]]],
 ['Undercroft Escape','Climb the west wall from beneath a high starting gallery.',[[630,85,170],[450,175,120],[270,265,150],[100,350,125],[295,420,130],[465,335,110],[620,250,120],[755,165,80]],[1,2,4,6,7],[[0,438,185,12],[285,438,515,12]]],
 ['Stairwell Detour','Leave the central stairs for a side balcony before returning.',[[80,420,150],[230,330,100],[360,240,110],[505,150,120],[660,65,110],[750,150,95],[600,245,130],[435,330,100]],[1,3,4,7],[[160,438,640,12]]],
 ['The Great Dip','A high entrance drops to a narrow valley before the final climb.',[[55,95,100],[210,190,125],[385,310,110],[550,415,110],[695,330,120],[750,240,80]],[1,2,3,5],[[0,438,490,12],[620,438,180,12]]],
 ['Sky Market','Wide trading balconies alternate with short connecting steps.',[[90,400,180],[300,350,180],[485,270,85],[670,220,200],[520,130,105],[330,75,165]],[1,3,5],[[185,438,615,12]]],
 ['The Inside Corner','Turn inward twice to reach a flag near the middle.',[[740,420,120],[575,335,115],[410,250,115],[250,165,120],[85,85,130],[260,65,110],[425,95,115],[570,185,100]],[1,2,4,6],[[0,438,675,12]]],
 ['Ravine Relay','Small landing pads lead to a long final patrol platform.',[[45,420,90],[170,345,65],[310,285,85],[465,350,70],[650,275,230]],[1,2,4],[[95,428,555,22]]],
 ['Balcony Weave','Weave between east and west balconies on the same tower.',[[270,420,120],[435,340,110],[280,250,100],[450,170,135],[295,80,140],[130,65,100]],[1,2,4],[[0,438,200,12],[345,438,455,12]]],
 ['High Water Mark','Take a descending route, then reclaim the far cliff.',[[60,155,120],[240,245,130],[430,345,150],[610,415,130],[740,330,100]],[1,2,3,4],[[0,438,530,12]]],
 ['Double Bluff','Climb a tall bluff, then curl around its lower ledges.',[[55,420,110],[200,335,100],[355,245,115],[515,155,100],[680,285,160],[540,410,95],[375,400,130]],[1,3,4,6],[[115,438,685,12]]],
 ['Garden Galleries','Climb short steps before crossing long garden galleries.',[[65,415,130],[195,325,70],[345,250,100],[540,210,200],[720,125,110],[520,65,155],[310,100,170]],[2,3,5],[[135,438,665,12]]],
 ['The Bottom Shelf','Loop from the upper western shelf into a low finish.',[[75,110,145],[250,170,130],[430,245,120],[595,320,120],[740,405,105],[570,420,230],[400,385,140]],[1,2,4,6],[[150,438,160,12],[480,438,25,12]]],
 ['Lopsided Fortress','One steep wall and one shallow roof protect the inner flag.',[[65,420,125],[205,330,95],[350,240,100],[505,150,105],[675,100,150],[720,295,100],[540,395,150]],[1,2,4,5,6],[[130,438,670,12]]],
 ['Cloud Causeway','Cross the high road and drop to a lower return route.',[[75,140,150],[275,100,150],[485,155,170],[690,115,155],[735,330,110],[560,410,150]],[1,2,3,5],[[0,438,285,12],[470,438,330,12]]],
 ['Watchman Steps','Five offset watch posts guard a narrow ascending route.',[[60,420,120],[205,350,95],[355,270,100],[510,190,105],[665,105,115],[745,70,80]],[1,2,3,4,5],[[125,438,675,12]]],
 ['The Falling Crescent','Trace a curved descent with a final upward hook.',[[95,75,170],[285,140,145],[465,235,135],[625,340,100],[740,420,100],[580,415,230],[425,330,110]],[1,3,5,6],[[0,438,530,12]]],
 ['Courtyard Overlook','Start in the courtyard and finish directly above it.',[[390,420,170],[565,335,110],[725,250,120],[565,165,100],[395,75,150]],[1,2,4],[[0,438,295,12],[485,438,315,12]]],
 ['The Narrow Doorway','A tiny central foothold divides two roomy high landings.',[[65,415,130],[240,335,170],[410,245,50],[565,155,150],[730,235,115],[570,340,120]],[1,3,5],[[135,438,665,12]]],
 ['Ridge to River','Run the ridge, drop into the riverbed, and climb its bank.',[[55,190,110],[240,130,170],[425,205,100],[590,310,120],[735,415,110],[570,420,210],[400,325,140]],[1,2,4,6],[[0,438,310,12],[480,438,25,12]]],
 ['The Offset Stack','Turn around short stacked shelves without a straight staircase.',[[200,420,140],[355,335,90],[190,250,100],[350,165,115],[190,75,130],[365,60,115],[535,100,130]],[1,3,4,6],[[0,438,115,12],[275,438,525,12]]],
 ['Outpost Crescent','A long arc of outposts ends on a low guarded shelf.',[[60,405,120],[210,320,95],[365,235,105],[530,150,110],[710,80,150],[635,320,90],[470,400,150]],[1,2,4,6],[[125,438,260,12],[555,438,245,12]]],
 ['Broken Observatory','Climb beneath the observatory and circle its outer rim.',[[370,420,140],[540,335,105],[710,245,125],[550,155,105],[380,65,140],[200,85,150],[60,175,100]],[1,2,4,6],[[0,438,290,12],[450,438,350,12]]],
 ['East Gate Descent','A steep staircase leads to a long drop beyond the gate.',[[60,420,110],[200,330,90],[345,240,100],[500,150,115],[680,65,160],[750,360,80],[585,410,130]],[1,2,4,6],[[120,438,380,12],[665,438,135,12]]],
 ['The Double Turn','Turn west halfway up, then east across the summit.',[[100,420,180],[290,340,130],[455,250,90],[305,165,115],[150,75,130],[325,65,100],[500,90,145],[690,170,145]],[1,3,5,7],[[195,438,605,12]]],
 ['Spire Valley','Visit a low valley between two isolated spires.',[[65,330,130],[235,245,120],[400,160,100],[565,280,125],[725,400,125],[550,415,180],[385,330,120]],[1,2,4,6],[[135,438,665,12]]],
 ['The Crown Interior','A high ring encloses the final interior platform.',[[65,415,130],[215,330,105],[370,245,110],[535,155,120],[700,75,120],[750,275,90],[590,365,110],[425,395,120],[240,410,150]],[1,2,4,6,8],[[135,438,665,12]]],
 ['Last Ferry','Leap between broad ferry decks and a tiny final jetty.',[[85,405,170],[295,350,185],[510,395,155],[695,305,145],[750,215,80]],[1,2,3,4],[[175,430,20,20],[395,430,30,20],[600,430,20,20]]],
 ['The Long Way Up','Trace three corners to reach the flag above the starting bay.',[[410,420,130],[245,335,105],[85,245,125],[245,155,110],[415,65,130],[595,90,135],[735,185,110]],[1,2,4,5,6],[[0,438,335,12],[485,438,315,12]]],
 ['The Last Courtyard','Descend around the perimeter and climb the inner court.',[[70,85,140],[245,170,125],[425,255,130],[595,345,110],[735,420,110],[560,415,250],[400,335,105],[245,255,100]],[1,2,4,6,7],[[0,438,495,12]]],
 ['Royal Procession','Cross the lower galleries and return over the royal roof.',[[65,410,130],[240,345,145],[430,275,150],[625,195,150],[745,105,90],[580,65,125],[395,90,145],[210,110,150],[60,200,100]],[1,2,3,5,7,8],[[135,438,665,12]]],
 ['The Hundredth Summit','A winding ascent, high crossing, and guarded descent finish the expedition.',[[390,420,140],[220,335,100],[65,245,110],[225,155,110],[395,65,135],[580,85,145],[735,175,110],[570,275,120],[420,355,100]],[1,2,4,5,7,8],[[0,438,310,12],[470,438,330,12]]]
];
EXPEDITION_COURSES.forEach(([name,brief,route,patrols,hazards],index)=>{
    const platforms=route.map(([cx,y,width])=>({x:cx-width/2,y,width,height:Math.min(24,450-y)}));
    const enemies=patrols.map((j,k)=>{const p=platforms[j];return {x:p.x+(p.width-28)*.65,y:p.y-28,width:28,height:28,minX:p.x+3,maxX:p.x+p.width-3,speed:1.2+(index%5)*.18+(k%2)*.22,dir:k%2?-1:1,alive:true};});
    const last=platforms.at(-1),east=route.at(-1)[0]>=route.at(-2)[0];
    LEVELS.push({name,brief,route,start:{x:route[0][0]-14,y:route[0][1]-38},
        flag:{x:east?last.x+last.width-32:last.x+8,y:Math.max(4,last.y-105),width:24,height:Math.min(105,last.y-4)},
        platforms,enemies,coins:route.map(([x,y])=>({x,y:y-24})),
        spikes:hazards.map(([x,y,width,height])=>({x,y,width,height}))});
});

        function renderShopGrid() {
            if (!shopGrid) return;
            shopGrid.innerHTML = '';
            updateCashDisplay();

            if (themeSubFilters) {
                if (currentShopTab === 'themes') themeSubFilters.classList.remove('hidden');
                else themeSubFilters.classList.add('hidden');
            }

            [shopTabColors, shopTabTrails, shopTabThemes].forEach(t => {
                if (t) t.className = 'flex-1 py-1.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition border border-slate-700 cursor-pointer';
            });

            if (currentShopTab === 'colors' && shopTabColors) {
                shopTabColors.className = 'flex-1 py-1.5 rounded-xl font-bold text-xs bg-amber-500 text-slate-950 transition border border-amber-400 cursor-pointer shadow';
            } else if (currentShopTab === 'trails' && shopTabTrails) {
                shopTabTrails.className = 'flex-1 py-1.5 rounded-xl font-bold text-xs bg-amber-500 text-slate-950 transition border border-amber-400 cursor-pointer shadow';
            } else if (currentShopTab === 'themes' && shopTabThemes) {
                shopTabThemes.className = 'flex-1 py-1.5 rounded-xl font-bold text-xs bg-amber-500 text-slate-950 transition border border-amber-400 cursor-pointer shadow';
            }

            shopGrid.style.gridTemplateColumns = '';shopGrid.classList.toggle('skin-grid',currentShopTab==='gun_skins');
            document.getElementById('shopTabGunSkins').classList.toggle('accent', currentShopTab === 'gun_skins');
            if (currentShopTab === 'gun_skins') { renderGunSkins(false); return; }

            let activeItems = [];
            if (currentShopTab === 'colors') activeItems = SHOP_ITEMS;
            else if (currentShopTab === 'trails') activeItems = TRAIL_ITEMS;
            else if (currentShopTab === 'themes') {
                activeItems = THEME_ITEMS.filter(t => t.category === currentThemeSubFilter);
            }

            activeItems.forEach(item => {
                const isColorTab = currentShopTab === 'colors';
                const isTrailTab = currentShopTab === 'trails';
                const isThemeTab = currentShopTab === 'themes';

                let isUnlocked = false;
                let isEquipped = false;

                if (isColorTab) {
                    isUnlocked = unlockedColors.includes(item.id);
                    isEquipped = equippedColorId === item.id;
                } else if (isTrailTab) {
                    isUnlocked = unlockedTrails.includes(item.id);
                    isEquipped = equippedTrailId === item.id;
                } else if (isThemeTab) {
                    isUnlocked = unlockedThemes.includes(item.id);
                    if (item.category === 'bg') isEquipped = equippedBgId === item.id;
                    if (item.category === 'plat') isEquipped = equippedPlatId === item.id;
                    if (item.category === 'floor') isEquipped = equippedFloorId === item.id;
                }

                const card = document.createElement('div');
                card.className = `p-2.5 rounded-xl flex flex-col items-center justify-between border transition ${
                    isEquipped
                        ? 'bg-amber-500/20 border-amber-400 shadow-md ring-1 ring-amber-400'
                        : isUnlocked
                        ? 'bg-slate-950 border-slate-700 hover:border-slate-500'
                        : 'bg-slate-950/60 border-slate-800'
                }`;

                const swatch = document.createElement('div');
                swatch.className = 'w-9 h-9 rounded-lg border-2 mb-1 flex items-center justify-center font-black text-xs relative overflow-hidden';
                
                if (isColorTab) {
                    swatch.style.backgroundColor = item.body;
                    swatch.style.borderColor = item.outline;
                } else if (isTrailTab) {
                    swatch.style.borderColor = '#475569';
                    if (item.type === 'none') swatch.style.backgroundColor = '#1e293b';
                    else if (item.type === 'rainbow') swatch.style.background = 'linear-gradient(135deg, #ef4444, #eab308, #10b981, #06b6d4, #8b5cf6)';
                    else if (item.type === 'gold') swatch.style.background = 'radial-gradient(circle, #fef08a 0%, #eab308 100%)';
                    else swatch.style.backgroundColor = item.color;
                } else if (isThemeTab) {
                    swatch.style.borderColor = '#475569';
                    if (item.category === 'bg') swatch.style.backgroundColor = item.bg;
                    else if (item.category === 'plat') swatch.style.backgroundColor = item.top;
                    else if (item.category === 'floor') swatch.style.backgroundColor = item.spike;
                }

                if (isEquipped) {
                    swatch.innerHTML = '<span class="text-white drop-shadow">✓</span>';
                } else if (!isUnlocked) {
                    swatch.innerHTML = '<span class="text-white/80 drop-shadow">🔒</span>';
                }

                if(isThemeTab){
                    const preview=document.createElement('canvas');preview.width=140;preview.height=60;preview.className='theme-preview';themePreview(preview,item);
                    swatch.style.width='100%';swatch.style.height='60px';swatch.replaceChildren(preview);
                }
                const nameLabel = document.createElement('span');
                nameLabel.className = 'text-[11px] font-bold text-slate-200 mb-1 truncate max-w-full text-center';
                nameLabel.textContent = item.name;

                const btn = document.createElement('button');
                btn.className = `w-full text-[10px] font-extrabold py-1 px-1 rounded-lg transition active:scale-95 ${
                    isEquipped
                        ? 'bg-amber-500 text-slate-950 cursor-default'
                        : isUnlocked
                        ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                        : score >= item.price
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`;

                if (isEquipped) btn.textContent = 'Equipped';
                else if (isUnlocked) btn.textContent = 'Equip';
                else btn.textContent = `$${item.price.toLocaleString()}`;

                btn.addEventListener('click', () => {
                    if (isEquipped) return;

                    if (isUnlocked) {
                        if(isColorTab){equippedColorId=item.id;playerColors={body:item.body,outline:item.outline};}
                        else if(isTrailTab)equippedTrailId=item.id;
                        else if(isThemeTab){if(item.category==='bg')equippedBgId=item.id;if(item.category==='plat')equippedPlatId=item.id;if(item.category==='floor')equippedFloorId=item.id;}
                        renderShopGrid();render();
                        if(shopMsg)shopMsg.textContent=`Equipped ${item.name}!`;
                    } else if (score >= item.price) {
                        score -= item.price;
                        if (isColorTab) {
                            unlockedColors.push(item.id);
                            equippedColorId = item.id;
                            playerColors.body = item.body;
                            playerColors.outline = item.outline;
                        } else if (isTrailTab) {
                            unlockedTrails.push(item.id);
                            equippedTrailId = item.id;
                        } else if (isThemeTab) {
                            unlockedThemes.push(item.id);
                            if (item.category === 'bg') equippedBgId = item.id;
                            if (item.category === 'plat') equippedPlatId = item.id;
                            if (item.category === 'floor') equippedFloorId = item.id;
                        }
                        if (shopMsg) shopMsg.textContent = `🎉 Purchased and equipped ${item.name}!`;
                        renderShopGrid();
                    } else {
                        const needed = item.price - score;
                        if (shopMsg) shopMsg.textContent = `❌ Need $${needed.toLocaleString()} more cash to buy ${item.name}!`;
                    }
                });

                card.appendChild(swatch);
                card.appendChild(nameLabel);
                card.appendChild(btn);
                shopGrid.appendChild(card);
            });
        }

        function renderLockerGrid() {
            if (!lockerGrid) return;
            lockerGrid.innerHTML = '';

            const equippedColorItem = SHOP_ITEMS.find(i => i.id === equippedColorId);
            const equippedTrailItem = TRAIL_ITEMS.find(i => i.id === equippedTrailId);
            
            if (previewName && equippedColorItem && equippedTrailItem) {
                const trailLabel = equippedTrailItem.id === 'none' ? 'No Trail' : equippedTrailItem.name;
                previewName.textContent = `${equippedColorItem.name} (${trailLabel})`;
            }

            [lockerTabColors, lockerTabTrails, lockerTabThemes].forEach(t => {
                if (t) t.className = 'flex-1 py-1.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition border border-slate-700 cursor-pointer';
            });

            if (currentLockerTab === 'colors' && lockerTabColors) {
                lockerTabColors.className = 'flex-1 py-1.5 rounded-xl font-bold text-xs bg-purple-600 text-white transition border border-purple-400 cursor-pointer shadow';
            } else if (currentLockerTab === 'trails' && lockerTabTrails) {
                lockerTabTrails.className = 'flex-1 py-1.5 rounded-xl font-bold text-xs bg-purple-600 text-white transition border border-purple-400 cursor-pointer shadow';
            } else if (currentLockerTab === 'themes' && lockerTabThemes) {
                lockerTabThemes.className = 'flex-1 py-1.5 rounded-xl font-bold text-xs bg-purple-600 text-white transition border border-purple-400 cursor-pointer shadow';
            }

            lockerGrid.style.gridTemplateColumns = '';lockerGrid.classList.toggle('skin-grid',currentLockerTab==='gun_skins');
            renderLockerThemeFilters();
            document.getElementById('lockerTabGunSkins').classList.toggle('accent', currentLockerTab === 'gun_skins');
            if (currentLockerTab === 'gun_skins') { renderGunSkins(true); return; }

            let activeItems = [];
            if (currentLockerTab === 'colors') {
                activeItems = SHOP_ITEMS.filter(item => unlockedColors.includes(item.id));
            } else if (currentLockerTab === 'trails') {
                activeItems = TRAIL_ITEMS.filter(item => unlockedTrails.includes(item.id));
            } else if (currentLockerTab === 'themes') {
                activeItems = THEME_ITEMS.filter(item => unlockedThemes.includes(item.id) && item.category===lockerThemeFilter);
            }

            if (activeItems.length === 0) {
                lockerGrid.innerHTML = '<div class="col-span-4 text-center text-xs text-slate-500 py-4">No items owned in this category yet.</div>';
                return;
            }

            activeItems.forEach(item => {
                const isColorTab = currentLockerTab === 'colors';
                const isTrailTab = currentLockerTab === 'trails';
                const isThemeTab = currentLockerTab === 'themes';

                let isEquipped = false;
                if (isColorTab) isEquipped = equippedColorId === item.id;
                else if (isTrailTab) isEquipped = equippedTrailId === item.id;
                else if (isThemeTab) {
                    if (item.category === 'bg') isEquipped = equippedBgId === item.id;
                    if (item.category === 'plat') isEquipped = equippedPlatId === item.id;
                    if (item.category === 'floor') isEquipped = equippedFloorId === item.id;
                }

                const card = document.createElement('div');
                card.className = `p-2.5 rounded-xl flex flex-col items-center justify-between border transition ${
                    isEquipped
                        ? 'bg-purple-500/20 border-purple-400 shadow-md ring-1 ring-purple-400'
                        : 'bg-slate-950 border-slate-800 hover:border-purple-500/50'
                }`;

                const swatch = document.createElement('div');
                swatch.className = 'w-9 h-9 rounded-lg border-2 mb-1 flex items-center justify-center font-black text-xs relative overflow-hidden';
                
                if (isColorTab) {
                    swatch.style.backgroundColor = item.body;
                    swatch.style.borderColor = item.outline;
                } else if (isTrailTab) {
                    swatch.style.borderColor = '#475569';
                    if (item.type === 'none') swatch.style.backgroundColor = '#1e293b';
                    else if (item.type === 'rainbow') swatch.style.background = 'linear-gradient(135deg, #ef4444, #eab308, #10b981, #06b6d4, #8b5cf6)';
                    else if (item.type === 'gold') swatch.style.background = 'radial-gradient(circle, #fef08a 0%, #eab308 100%)';
                    else swatch.style.backgroundColor = item.color;
                } else if (isThemeTab) {
                    swatch.style.borderColor = '#475569';
                    if (item.category === 'bg') swatch.style.backgroundColor = item.bg;
                    else if (item.category === 'plat') swatch.style.backgroundColor = item.top;
                    else if (item.category === 'floor') swatch.style.backgroundColor = item.spike;
                }

                if (isEquipped) {
                    swatch.innerHTML = '<span class="text-white drop-shadow">✓</span>';
                }

                if(isThemeTab){
                    const preview=document.createElement('canvas');preview.width=140;preview.height=60;preview.className='theme-preview';themePreview(preview,item);
                    swatch.style.width='100%';swatch.style.height='60px';swatch.replaceChildren(preview);
                }
                const nameLabel = document.createElement('span');
                nameLabel.className = 'text-[11px] font-bold text-slate-200 mb-1 truncate max-w-full text-center';
                nameLabel.textContent = item.name;

                const btn = document.createElement('button');
                btn.className = `w-full text-[10px] font-extrabold py-1 px-1 rounded-lg transition active:scale-95 ${
                    isEquipped
                        ? 'bg-purple-600 text-white cursor-default'
                        : 'bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 cursor-pointer'
                }`;

                btn.textContent = isEquipped ? 'Equipped' : 'Equip';

                btn.addEventListener('click', () => {
                    if (isEquipped) return;

                    if (isColorTab) {
                        equippedColorId = item.id;
                        playerColors.body = item.body;
                        playerColors.outline = item.outline;
                    } else if (isTrailTab) {
                        equippedTrailId = item.id;
                    } else if (isThemeTab) {
                        if (item.category === 'bg') equippedBgId = item.id;
                        if (item.category === 'plat') equippedPlatId = item.id;
                        if (item.category === 'floor') equippedFloorId = item.id;
                    }

                    if (lockerMsg) lockerMsg.textContent = `Equipped ${item.name}!`;
                    renderLockerPreview();
                    renderLockerGrid();
                });

                card.appendChild(swatch);
                card.appendChild(nameLabel);
                card.appendChild(btn);
                lockerGrid.appendChild(card);
            });
        }

        // Shop Sub-filter Event Listeners
        if (shopBtn) shopBtn.addEventListener('click', () => { shopModal.classList.remove('hidden'); renderShopGrid(); });
        if (closeShopBtn) closeShopBtn.addEventListener('click', () => { shopModal.classList.add('hidden'); });
        if (shopTabColors) shopTabColors.addEventListener('click', () => { currentShopTab = 'colors'; renderShopGrid(); });
        if (shopTabTrails) shopTabTrails.addEventListener('click', () => { currentShopTab = 'trails'; renderShopGrid(); });
        if (shopTabThemes) {
            shopTabThemes.addEventListener('click', () => {
                currentShopTab = 'themes';
                renderShopGrid();
            });
        }

        // Locker Event Listeners
        if (lockerBtn) lockerBtn.addEventListener('click', () => { lockerModal.classList.remove('hidden'); renderLockerPreview(); renderLockerGrid(); });
        if (closeLockerBtn) closeLockerBtn.addEventListener('click', () => { lockerModal.classList.add('hidden'); });
        if (lockerTabColors) lockerTabColors.addEventListener('click', () => { currentLockerTab = 'colors'; renderLockerGrid(); });
        if (lockerTabTrails) lockerTabTrails.addEventListener('click', () => { currentLockerTab = 'trails'; renderLockerGrid(); });
        if (lockerTabThemes) {
            lockerTabThemes.addEventListener('click', () => {
                currentLockerTab = 'themes';
                renderLockerGrid();
            });
        }

        function updateSubFilterButtons() {
            [filterBg, filterPlat, filterFloor].forEach(btn => {
                if (btn) btn.className = 'flex-1 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer';
            });
            if (currentThemeSubFilter === 'bg' && filterBg) filterBg.className = 'flex-1 py-1 rounded-lg bg-indigo-600 text-white border border-indigo-400 cursor-pointer';
            if (currentThemeSubFilter === 'plat' && filterPlat) filterPlat.className = 'flex-1 py-1 rounded-lg bg-indigo-600 text-white border border-indigo-400 cursor-pointer';
            if (currentThemeSubFilter === 'floor' && filterFloor) filterFloor.className = 'flex-1 py-1 rounded-lg bg-indigo-600 text-white border border-indigo-400 cursor-pointer';
        }

        if (filterBg) filterBg.addEventListener('click', () => { currentThemeSubFilter = 'bg'; updateSubFilterButtons(); renderShopGrid(); });
        if (filterPlat) filterPlat.addEventListener('click', () => { currentThemeSubFilter = 'plat'; updateSubFilterButtons(); renderShopGrid(); });
        if (filterFloor) filterFloor.addEventListener('click', () => { currentThemeSubFilter = 'floor'; updateSubFilterButtons(); renderShopGrid(); });

        function loadLevel(lvlIndex, retry = false) {
            if (lvlIndex < 0 || lvlIndex >= LEVELS.length) return;
            resetControls();
            isPaused = false;
            testingEditor = false;
            currentLevel = lvlIndex;
            isCustomLevel = false;
            customLevelIndex = -1;
            const lvl = LEVELS[currentLevel];
            prepareLevelWeapons(retry);

            player.x = lvl.start.x;
            player.y = lvl.start.y;
            player.vx = 0;
            player.vy = 0;
            player.isOnGround = false;
            isSlidingFlag = false;
            flagClothY = null;
            document.getElementById('maxFlagToast').hidden=true;
            flagMultiplier = 1.0;
            flagBonusCash = 0;

            levelStartScore = score;
            runEarned = 0;
            playerTrailHistory = [];

            platforms = JSON.parse(JSON.stringify(lvl.platforms));
            coins = JSON.parse(JSON.stringify(lvl.coins)).map(c => ({ x: c.x, y: c.y, radius: 10, collected: false }));
            spikes = JSON.parse(JSON.stringify(lvl.spikes || []));
            enemies = JSON.parse(JSON.stringify(lvl.enemies || [])).map(e => ({ ...e, alive: true }));
            flag = { ...lvl.flag };

            document.getElementById('levelLabel').textContent = 'LEVEL';
            document.getElementById('levelDisplay').textContent = (currentLevel + 1).toString();
            document.getElementById('levelMaxDisplay').textContent = `/ ${LEVELS.length}`;
            
            showStatusMessage(`Level ${currentLevel + 1}: ${lvl.name || 'Reach the flag! Collect coins for bonus cash.'}`);
        }

        function loadCustomLevel(customIndex, draft = null) {
            if (!draft && (customIndex < 0 || customIndex >= customLevels.length)) return;
            resetControls();
            isPaused = false;
            testingEditor = Boolean(draft);
            isCustomLevel = true;
            customLevelIndex = customIndex;
            const lvl = draft || customLevels[customIndex];
            bullets = []; loot = []; fireHeld = false; updateWeaponHUD();

            player.x = lvl.start ? lvl.start.x : 50;
            player.y = lvl.start ? lvl.start.y : 350;
            player.vx = 0;
            player.vy = 0;
            player.isOnGround = false;
            isSlidingFlag = false;
            flagClothY = null;
            document.getElementById('maxFlagToast').hidden=true;
            flagMultiplier = 1.0;
            flagBonusCash = 0;

            levelStartScore = score;
            runEarned = 0;
            playerTrailHistory = [];

            platforms = JSON.parse(JSON.stringify(lvl.platforms || []));
            coins = JSON.parse(JSON.stringify(lvl.coins || [])).map(c => ({ x: c.x, y: c.y, radius: 10, collected: false }));
            spikes = JSON.parse(JSON.stringify(lvl.spikes || []));
            enemies = JSON.parse(JSON.stringify(lvl.enemies || [])).map(e => ({
                x: e.x, y: e.y, width: e.width || 28, height: e.height || 28,
                minX: e.minX ?? (e.x - 50), maxX: e.maxX ?? (e.x + 50),
                speed: e.speed ?? 2, dir: 1, alive: true
            }));
            flag = lvl.flag ? { ...lvl.flag } : { x: 720, y: 170, width: 24, height: 210 };

            document.getElementById('levelLabel').textContent = 'MY LVL';
            document.getElementById('levelDisplay').textContent = (customIndex + 1).toString();
            document.getElementById('levelMaxDisplay').textContent = `(${lvl.name || 'Custom'})`;

            showStatusMessage(`Playing Custom Level: "${lvl.name || 'Custom'}"`);
        }

        function update() {
            if (isSlidingFlag) {
                player.vx = 0;
                player.x = Math.max(0, flag.x - player.width);
                player.y += 4.5;
                flagClothY = Math.min(flag.y + flag.height - 24, Math.max(flag.y, player.y));

                if (player.y >= flagSlideTargetY) {
                    player.y = flagSlideTargetY;
                    isSlidingFlag = false;
                    completeLevel();
                }
                return;
            }

            const wasOnGround=player.isOnGround;
            if (keys.left) {
                facing = -1;
                player.vx = -player.speed;
            } else if (keys.right) {
                facing = 1;
                player.vx = player.speed;
            } else {
                player.vx = 0;
            }

            if (keys.up && player.isOnGround) {
                player.vy = player.jumpStrength;
                player.isOnGround = false;
                playJumpSound();
            }

            player.vy += gravity;

            if (equippedTrailId !== 'none' && (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1)) {
                playerTrailHistory.unshift({ x: player.x, y: player.y });
                if (playerTrailHistory.length > 8) playerTrailHistory.pop();
            } else {
                if (playerTrailHistory.length > 0) playerTrailHistory.pop();
            }

            player.x += player.vx;
            platforms.forEach(p => {
                if (checkAABB(player, p)) {
                    if (player.vx > 0) player.x = p.x - player.width;
                    else if (player.vx < 0) player.x = p.x + p.width;
                }
            });

            if (player.x < 0) player.x = 0;
            if (player.x + player.width > 800) player.x = 800 - player.width;

            player.y += player.vy;
            player.isOnGround = false;
            platforms.forEach(p => {
                if (checkAABB(player, p)) {
                    if (player.vy > 0) {
                        player.y = p.y - player.height;
                        player.vy = 0;
                        player.isOnGround = true;
                    } else if (player.vy < 0) {
                        player.y = p.y + p.height;
                        player.vy = 0;
                    }
                }
            });

            if(!wasOnGround&&player.isOnGround)playGameClip('land');

            if (player.y > 450 + 60) {
                restartLevel(true);
                return;
            }

            for (let s of spikes) {
                if (checkAABB(player, s)) {
                    restartLevel(true);
                    return;
                }
            }

            updateWeapons();
            coins.forEach(c => {
                if (!c.collected && circleBoxIntersect(c, player)) {
                    c.collected = true;
                    score += 150; runEarned += 150;
                    playCoinSound();
                    updateCashDisplay();
                }
            });

            for (const e of enemies) {
                if (!e.alive) continue;

                e.x += e.speed * e.dir;
                if (e.x <= e.minX) { e.x = e.minX; e.dir = 1; }
                else if (e.x + e.width >= e.maxX) { e.x = e.maxX - e.width; e.dir = -1; }

                if (checkAABB(player, e)) {
                    if (player.vy > 0 && (player.y + player.height - player.vy) <= e.y + 12) {
                        e.alive = false;
                        player.vy = player.jumpStrength * 0.7;
                        score += 300; runEarned += 300;
                        playStompSound();
                        updateCashDisplay();
                    } else {
                        restartLevel(true);
                        return;
                    }
                }
            }

            if (checkAABB(player, flag)) {
                if (!isSlidingFlag) {
                    isSlidingFlag = true;
                    flagClothY = Math.min(flag.y + flag.height - 24, Math.max(flag.y, player.y));
                    flagSlideTargetY = flag.y + flag.height - player.height;

                    const hitCenterY = player.y + player.height / 2;
                    const poleBottom = flag.y + flag.height;
                    const rawRatio = Math.min(1.0, Math.max(0.0, (poleBottom - hitCenterY) / flag.height));

                    if (rawRatio <= 0.5) {
                        flagMultiplier = 1.0 + (rawRatio * 2.0);
                    } else {
                        flagMultiplier = 2.0 + ((rawRatio - 0.5) * 6.0);
                    }
                    flagMultiplier = Math.round(flagMultiplier * 10) / 10;
                    document.getElementById('maxFlagToast').hidden=flagMultiplier<5;

                    const levelCoinsEarned = runEarned;
                    flagBonusCash = Math.round(levelCoinsEarned * (flagMultiplier - 1.0));

                    showStatusMessage(`🚩 FLAG TOUCH! ${flagMultiplier.toFixed(1)}x Multiplier (+ $${flagBonusCash.toLocaleString()} Bonus!)`);
                }
                keys.left = keys.right = keys.up = false;

            }
        }

        function render() {
            resizeJumpBuffer();legacyRenderStats.jumpFrames++;
            const bgItem = THEME_ITEMS.find(t => t.id === equippedBgId) || THEME_ITEMS[0];
            const platItem = THEME_ITEMS.find(t => t.id === equippedPlatId) || THEME_ITEMS[5];
            const floorItem = THEME_ITEMS.find(t => t.id === equippedFloorId) || THEME_ITEMS[10];

            paintJumpStatic(bgItem,platItem,floorItem);

            coins.forEach(c => {
                if (c.collected) return;
                ctx.save();
                ctx.fillStyle = '#facc15';
                ctx.strokeStyle = '#ca8a04';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#fef08a';
                ctx.beginPath();
                ctx.arc(c.x - 2, c.y - 2, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // Enemies
            enemies.forEach(e => {
                if (!e.alive) return;
                ctx.fillStyle = '#dc2626';
                ctx.beginPath();
                ctx.roundRect(e.x, e.y, e.width, e.height, 6);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(e.x + (e.dir > 0 ? 16 : 4), e.y + 6, 6, 6);
                ctx.fillStyle = '#000000';
                ctx.fillRect(e.x + (e.dir > 0 ? 18 : 6), e.y + 8, 3, 3);
            });

            // Flag
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(flag.x, flag.y, 5, flag.height);
            ctx.fillStyle = '#64748b';
            ctx.fillRect(flag.x - 8, flag.y + flag.height - 6, 21, 6);

            ctx.beginPath();
            ctx.moveTo(flag.x + 5, flagClothY ?? flag.y);
            ctx.lineTo(flag.x + 35, (flagClothY ?? flag.y) + 12);
            ctx.lineTo(flag.x + 5, (flagClothY ?? flag.y) + 24);
            ctx.closePath();
            ctx.fillStyle = '#10b981';
            ctx.fill();

            // Player Trails
            const eqTrail = TRAIL_ITEMS.find(t => t.id === equippedTrailId);
            if (eqTrail && eqTrail.type !== 'none') {
                trailHueOffset = (trailHueOffset + 4) % 360;
                playerTrailHistory.forEach((pt, index) => {
                    if(index % ({low:4,medium:2,high:1}[jumpGraphicsValues().particles]||1))return;
                    const alpha = (1 - (index / playerTrailHistory.length)) * 0.4;
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    if (eqTrail.type === 'rainbow') {
                        ctx.fillStyle = `hsl(${(trailHueOffset + index * 30) % 360}, 100%, 60%)`;
                    } else if (eqTrail.type === 'gold') {
                        ctx.fillStyle = '#facc15';
                    } else {
                        ctx.fillStyle = eqTrail.color || '#38bdf8';
                    }
                    ctx.beginPath();
                    ctx.roundRect(pt.x + index, pt.y + index, player.width - index * 1.5, player.height - index * 1.5, 4);
                    ctx.fill();
                    ctx.restore();
                });
            }

            renderWeapons();

            // Player Body
            ctx.fillStyle = playerColors.body;
            ctx.beginPath();
            ctx.roundRect(player.x, player.y, player.width, player.height, 6);
            ctx.fill();
            ctx.strokeStyle = playerColors.outline;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Player Eye
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(player.x + (facing < 0 ? 8 : 20), player.y + 12, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(player.x + (facing < 0 ? 7 : 21), player.y + 12, 2, 0, Math.PI * 2);
            ctx.fill();
            drawHeldWeapon();
            renderSniperScope();
        }

        // Physics stays at the original 60 steps per second at every display FPS.
        const physicsStep = 1000 / 60;
        let physicsAccumulator = 0;
        let lastRenderTime = 0;
        let jumpFrame=0;
        function gameLoop(time) {
            jumpFrame=0;
            if(document.hidden||document.getElementById('platdoGame').hidden){lastFrameTime=time;physicsAccumulator=0;return;}
            jumpFrame=requestAnimationFrame(gameLoop);
            const elapsed = Math.min(Math.max(time - lastFrameTime, 0), 100);
            lastFrameTime = time;
            if (!gameStarted || isPaused || document.hidden || document.getElementById('platdoGame').hidden) { physicsAccumulator = 0; return; }
            physicsAccumulator += elapsed;
            while (physicsAccumulator >= physicsStep && gameStarted && !isPaused) {
                update();
                queueProgressSave();
                physicsAccumulator -= physicsStep;
            }
            if (time - lastRenderTime >= 1000 / targetFps - 0.1) {
                const started=performance.now();render();jumpGraphics?.sample(time-lastRenderTime,performance.now()-started,time);
                lastRenderTime = time;
            }
        }

        function renderEditorCanvas() {
            if (!editorCtx) return;
            updateEditorHistoryButtons();
            const w = editorCanvas.width;
            const h = editorCanvas.height;

            editorCtx.fillStyle = '#020617';
            editorCtx.fillRect(0, 0, w, h);

            editorCtx.strokeStyle = '#1e293b';
            editorCtx.lineWidth = 1;
            for (let x = 0; x < w; x += 20) {
                editorCtx.beginPath();
                editorCtx.moveTo(x, 0);
                editorCtx.lineTo(x, h);
                editorCtx.stroke();
            }
            for (let y = 0; y < h; y += 20) {
                editorCtx.beginPath();
                editorCtx.moveTo(0, y);
                editorCtx.lineTo(w, y);
                editorCtx.stroke();
            }

            editorData.platforms.forEach(p => {
                editorCtx.fillStyle = '#334155';
                editorCtx.fillRect(p.x, p.y, p.width, p.height);
                editorCtx.fillStyle = '#38bdf8';
                editorCtx.fillRect(p.x, p.y, p.width, 3);
            });

            editorData.spikes.forEach(s => {
                editorCtx.fillStyle = '#ef4444';
                editorCtx.fillRect(s.x, s.y, s.width, s.height);
            });

            editorData.coins.forEach(c => {
                editorCtx.fillStyle = '#facc15';
                editorCtx.beginPath();
                editorCtx.arc(c.x, c.y, 8, 0, Math.PI * 2);
                editorCtx.fill();
            });

            editorData.enemies.forEach(e => {
                editorCtx.fillStyle = '#dc2626';
                editorCtx.fillRect(e.x, e.y, 24, 24);
            });

            if (editorData.start) {
                editorCtx.fillStyle = '#10b981';
                editorCtx.fillRect(editorData.start.x, editorData.start.y, 24, 32);
            }

            if (editorData.flag) {
                editorCtx.fillStyle = '#94a3b8';
                editorCtx.fillRect(editorData.flag.x, editorData.flag.y, 4, editorData.flag.height);
                editorCtx.fillStyle = '#10b981';
                editorCtx.fillRect(editorData.flag.x + 4, editorData.flag.y, 20, 15);
            }

            if (isDrawingPlatform) {
                const px = Math.min(drawStartPos.x, drawCurrentPos.x);
                const py = Math.min(drawStartPos.y, drawCurrentPos.y);
                const pw = Math.abs(drawCurrentPos.x - drawStartPos.x);
                const ph = Math.abs(drawCurrentPos.y - drawStartPos.y);
                editorCtx.strokeStyle = '#2dd4bf';
                editorCtx.lineWidth = 2;
                editorCtx.strokeRect(px, py, pw, ph);
            }
        }

        function renderLevelGrid() {
            renderHighScoreTotals();
            for(const [button,tab] of [[levelTabCampaign,'campaign'],[levelTabMyLevels,'my_levels']]){
                const active=selectedLevelTab===tab;
                button.className='flex-1 py-1.5 rounded-xl font-bold text-xs transition border cursor-pointer '+(active?'bg-indigo-600 text-white border-indigo-400 shadow':'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700');
                button.setAttribute('aria-pressed',String(active));
            }
            if (!levelGrid) return;
            levelGrid.innerHTML = '';

            if (selectedLevelTab === 'campaign') {
                LEVELS.forEach((lvl, i) => {
                    const btn = document.createElement('button');
                    const isUnlocked = i <= maxUnlockedLevel;
                    btn.title = `${lvl.name || `Level ${i+1}`}${lvl.brief ? ': '+lvl.brief : ''}`;
                    btn.setAttribute('aria-label', `Level ${i+1}${lvl.name ? ': '+lvl.name : ''}${isUnlocked ? '' : ', locked'}. High score: $${getLevelBest('campaign',i).toLocaleString()}`);
                    btn.className = `h-12 rounded-xl font-black text-sm flex items-center justify-center border transition ${
                        isUnlocked
                            ? 'bg-indigo-600/30 hover:bg-indigo-600/60 border-indigo-500/50 text-white cursor-pointer'
                            : 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                    }`;
                    btn.style.flexDirection='column';btn.style.gap='2px';btn.style.height='64px';
                    const number=document.createElement('span');number.textContent=`${i+1}${isUnlocked?'':' 🔒'}`;
                    const best=document.createElement('small');best.className='level-best';best.textContent=`Best: $${getLevelBest('campaign',i).toLocaleString()}`;
                    btn.append(number,best);btn.disabled=!isUnlocked;
                    if (isUnlocked) {
                        btn.addEventListener('click', () => {
                            loadLevel(i);
                            levelSelectModal.classList.add('hidden');
                            titleOverlay.classList.add('hidden');
                            gameStarted = true;
                        });
                    }
                    levelGrid.appendChild(btn);
                });
            } else {
                if (customLevels.length === 0) {
                    levelGrid.innerHTML = '<div class="col-span-5 text-center text-xs text-slate-500 py-4">No custom levels created yet! Use Level Editor to build one.</div>';
                    return;
                }
                customLevels.forEach((lvl, i) => {
                    const row = document.createElement('div');
                    row.className = 'custom-level-row';
                    const name = document.createElement('div');
                    name.className = 'custom-level-name';
                    name.textContent = lvl.name || `Custom ${i + 1}`;
                    row.appendChild(name);
                    const best=document.createElement('span');best.className='custom-level-best';best.textContent=`High score: $${getLevelBest('custom',lvl.id).toLocaleString()}`;row.appendChild(best);
                    const actions = {
                        Play: () => { loadCustomLevel(i); levelSelectModal.classList.add('hidden'); titleOverlay.classList.add('hidden'); gameStarted = true; },
                        Edit: () => openSavedLevel(i),
                        Rename: () => renameSavedLevel(i),
                        Delete: () => deleteSavedLevel(i)
                    };
                    for (const [label, action] of Object.entries(actions)) {
                        const button = document.createElement('button');
                        button.className = 'game-button'; button.textContent = label;
                        if(label==='Delete')button.style.color='#fca5a5';
                        button.addEventListener('click', action); row.appendChild(button);
                    }
                    levelGrid.appendChild(row);
                });
            }
        }

        const bindings = { left:['KeyA','ArrowLeft'], right:['KeyD','ArrowRight'], up:['Space','KeyW','ArrowUp'], fire:['KeyE'], previous:['WheelUp','BracketLeft'], next:['WheelDown','BracketRight'], pause:['KeyP'] };
        const actionLabels = {left:'Move Left',right:'Move Right',up:'Jump',fire:'Fire / Use Item',previous:'Inventory Up',next:'Inventory Down',pause:'Pause / Resume'};
        let weaponOrder = ['none','sniper','pistol','ak48','nuke'];
        try {
            const saved=JSON.parse(localStorage.getItem('platdo_controls_v1')||'{}');
            if(saved.bindings) for(const action of Object.keys(bindings)) {
                if(Array.isArray(saved.bindings[action]) && saved.bindings[action].every(x=>typeof x==='string'&&x.length<50)) bindings[action]=[...new Set(saved.bindings[action])].slice(0,5);
            }
            if(Array.isArray(saved.order)&&[4,5].includes(saved.order.length)&&new Set(saved.order).size===saved.order.length&&saved.order.every(x=>weaponOrder.includes(x))){
                if(saved.order.length===5)weaponOrder=saved.order;
                else if(!saved.order.includes('none'))weaponOrder=['none',...saved.order];
            }
        } catch(_) {}
        for(const action of Object.keys(bindings))bindings[action]=bindings[action].filter(code=>code!=='Escape');
        const heldCodes = new Set();
        const touchKeys = {left:false,right:false,up:false};
        let pendingBinding=null, suppressBindingClick=false, fireButtonHeld=false;
        const wheelInputTimers=new Map();
        function inputLabel(code) {
            return ({Mouse0:'Left Mouse',Mouse1:'Middle Mouse',Mouse2:'Right Mouse',Mouse3:'Mouse Back',Mouse4:'Mouse Forward',WheelUp:'Wheel Up',WheelDown:'Wheel Down',WheelLeft:'Wheel Left',WheelRight:'Wheel Right',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',BracketLeft:'[',BracketRight:']'})[code] || (code||'Unbound').replace(/^Key|^Digit/,'');
        }
        function saveControls() {try{localStorage.setItem('platdo_controls_v1',JSON.stringify({bindings,order:weaponOrder}));}catch(_){} }
        function syncControls() {
            for(const action of Object.keys(keys))keys[action]=touchKeys[action]||bindings[action].some(code=>heldCodes.has(code));
            fireHeld=fireButtonHeld||bindings.fire.some(code=>heldCodes.has(code));
        }
        function resetControls() {
            heldCodes.clear();fireHeld=false;fireButtonHeld=false;
            for(const timer of wheelInputTimers.values())clearTimeout(timer);wheelInputTimers.clear();
            for(const action of Object.keys(keys))keys[action]=touchKeys[action]=false;
        }
        function refreshBindings() {
            const container=document.getElementById('bindingRows');container.replaceChildren();
            if(window.Platdo?.controls?.isMobile){pendingBinding=null;document.getElementById('bindingCapture').classList.add('hidden');const note=document.createElement('p');note.textContent='Mobile controls are enabled in the game selector. Use the movement stick and on-screen action buttons. Switch to PC there to edit keyboard and mouse bindings.';container.append(note);return;}
            for(const [action,label] of Object.entries(actionLabels)) {
                const row=document.createElement('div');row.className='binding-row';row.dataset.action=action;
                const title=document.createElement('strong');title.textContent=label;row.appendChild(title);
                const group=document.createElement('div');group.className='binding-buttons';
                bindings[action].forEach((code,index)=>{
                    const chip=document.createElement('span');chip.className='binding-chip';
                    const button=document.createElement('button');button.className='game-button';button.textContent=inputLabel(code);button.setAttribute('aria-label',`Change ${label} binding ${index+1}`);
                    button.addEventListener('click',()=>beginBinding(action,index));
                    const remove=document.createElement('button');remove.className='binding-remove';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${label} binding ${index+1}`);
                    remove.addEventListener('click',()=>{bindings[action].splice(index,1);saveControls();refreshBindings();updateWeaponHUD();});
                    chip.append(button,remove);group.appendChild(chip);
                });
                const plus=document.createElement('button');plus.className='game-button';plus.textContent='+';plus.disabled=bindings[action].length>=5;plus.setAttribute('aria-label',`Add ${label} binding`);
                plus.addEventListener('click',()=>beginBinding(action,null));group.appendChild(plus);row.appendChild(group);container.appendChild(row);
            }
            const capture=document.getElementById('bindingCapture');capture.classList.toggle('hidden',!pendingBinding);
            if(pendingBinding)document.getElementById('bindingCaptureMessage').textContent=`Binding ${actionLabels[pendingBinding.action]}: press a key, mouse button, or scroll direction.`;
        }
        function beginBinding(action,index) {pendingBinding={action,index};resetControls();refreshBindings();}
        function captureBinding(code) {
            if(!pendingBinding)return;
            const {action,index}=pendingBinding;
            const conflict=Object.keys(bindings).find(a=>a!==action&&bindings[a].includes(code));
            if(conflict){document.getElementById('bindingCaptureMessage').textContent=`${inputLabel(code)} is used by ${actionLabels[conflict]}. Remove that binding first, or choose another input.`;return;}
            if(!bindings[action].includes(code)) {
                if(index===null && bindings[action].length<5)bindings[action].push(code);
                else if(index!==null)bindings[action][index]=code;
            }
            pendingBinding=null;saveControls();refreshBindings();updateWeaponHUD();
        }
        function anyGamePageOpen() {return Array.from(document.querySelectorAll('[id$="Modal"], [data-game-page]')).some(page=>!page.classList.contains('hidden'));}
        function switchWeapon(direction) {
            if(!gameStarted||isPaused||isCustomLevel||anyGamePageOpen())return;
            const choices=weaponOrder.filter(id=>id==='none'||weaponUnlocked(id));
            if(!choices.length)return;
            const at=choices.indexOf(equippedWeapon);
            equippedWeapon=choices[at<0 ? (direction>0?0:choices.length-1) : (at+direction+choices.length)%choices.length];
            fireButtonHeld=false;for(const code of bindings.fire)heldCodes.delete(code);syncControls();updateWeaponHUD();
        }
        function setPaused(value) {
            isPaused=value;resetControls();pauseOverlay.classList.toggle('hidden',!value);
            document.getElementById('backToEditorBtn').classList.toggle('hidden',!testingEditor);
        }
        function pressInput(code,repeat=false) {
            if(window.Platdo?.controls?.isMobile||!gameStarted||anyGamePageOpen())return false;
            const action=Object.keys(bindings).find(a=>bindings[a].includes(code));
            if(!action)return false;
            if(action==='pause'){if(!repeat)setPaused(!isPaused);return true;}
            if(isPaused)return true;
            if(!repeat){
                if(action==='previous')switchWeapon(-1);
                else if(action==='next')switchWeapon(1);
                else {heldCodes.add(code);syncControls();if(action==='fire')fireWeapon();}
            }
            return true;
        }
        function releaseInput(code){heldCodes.delete(code);syncControls();}
        document.getElementById('cancelBindingBtn').addEventListener('click',()=>{pendingBinding=null;refreshBindings();});
        document.getElementById('fpsSelect').addEventListener('change',e=>Platdo.setFrameRate(Number(e.target.value)));
        function returnToMenu() {
            document.getElementById('maxFlagToast').hidden=true;
            if(testingEditor){score=levelStartScore;updateCashDisplay();}
            testingEditor=false;
            document.querySelectorAll('[id$="Modal"], [data-game-page]').forEach(page=>page.classList.add('hidden'));
            pendingBinding=null;refreshBindings();isDrawingPlatform=false;weaponShopResume=false;
            gameStarted=false;isPaused=false;resetControls();pauseOverlay.classList.add('hidden');winOverlay.classList.add('hidden');titleOverlay.classList.remove('hidden');
        }
        function backToEditor() {
            if(!testingEditor)return;
            returnToMenu();editorModal.classList.remove('hidden');renderEditorCanvas();
        }
        document.getElementById('backToEditorBtn').addEventListener('click',backToEditor);
        function pauseOnFocusLoss(){resetControls();if(gameStarted)setPaused(true);}
        window.addEventListener('blur',pauseOnFocusLoss);
        document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseOnFocusLoss();});
        window.addEventListener('keydown',e=>{
            if(document.querySelector('.pg-backdrop'))return;
            if(e.code==='Escape'&&!document.getElementById('platdoGame').hidden){
                e.preventDefault();e.stopImmediatePropagation();
                if(!e.repeat){
                    const atMainMenu=!gameStarted&&!anyGamePageOpen()&&!titleOverlay.classList.contains('hidden')&&winOverlay.classList.contains('hidden')&&pauseOverlay.classList.contains('hidden');
                    if(atMainMenu)location.hash='';
                    else {returnToMenu();startPlayBtn.focus({preventScroll:true});}
                }
                return;
            }
            if(pendingBinding){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)captureBinding(e.code);return;}
            if(e.target.matches('input, textarea, select')||e.target.isContentEditable)return;
            if(pressInput(e.code,e.repeat))e.preventDefault();
        },true);
        window.addEventListener('keyup',e=>releaseInput(e.code));
        window.addEventListener('pointerdown',e=>{
            if(pendingBinding){
                if(e.target.closest('#cancelBindingBtn'))return;
                e.preventDefault();e.stopImmediatePropagation();suppressBindingClick=true;captureBinding(`Mouse${e.button}`);return;
            }
            if(e.target!==canvas||window.Platdo?.controls?.isMobile||e.pointerType==='touch')return;
            aimPoint=canvasPoint(e);
            if(pressInput(`Mouse${e.button}`)){e.preventDefault();e.stopImmediatePropagation();}
        },true);
        window.addEventListener('pointerup',e=>{releaseInput(`Mouse${e.button}`);setTimeout(()=>{suppressBindingClick=false;},0);});
        window.addEventListener('pointercancel',()=>{for(const code of [...heldCodes])if(code.startsWith('Mouse'))releaseInput(code);});
        window.addEventListener('click',e=>{if(suppressBindingClick){suppressBindingClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
        window.addEventListener('contextmenu',e=>{if(pendingBinding||e.target===canvas){e.preventDefault();}});
        window.addEventListener('auxclick',e=>{if(e.target===canvas)e.preventDefault();});
        window.addEventListener('wheel',e=>{
            if(!e.deltaX&&!e.deltaY)return;
            const code=Math.abs(e.deltaX)>Math.abs(e.deltaY)?(e.deltaX>0?'WheelRight':'WheelLeft'):(e.deltaY>0?'WheelDown':'WheelUp');
            if(pendingBinding){e.preventDefault();captureBinding(code);return;}
            if(!gameStarted||isPaused||anyGamePageOpen())return;
            if(e.target.closest('input, textarea, select, [contenteditable="true"]'))return;
            if(pressInput(code)){
                e.preventDefault();
                if(['left','right','up'].some(action=>bindings[action].includes(code))){
                    clearTimeout(wheelInputTimers.get(code));wheelInputTimers.set(code,setTimeout(()=>{releaseInput(code);wheelInputTimers.delete(code);},120));
                } else releaseInput(code);
            }
        },{passive:false,capture:true});

        // UI Event Listeners
        if (startPlayBtn) startPlayBtn.addEventListener('click', () => {
            titleOverlay.classList.add('hidden');
            loadLevel(maxUnlockedLevel >= LEVELS.length ? 0 : currentLevel);
            gameStarted = true;
        });

        if (menuBtn) menuBtn.addEventListener('click', returnToMenu);

        if (levelSelectBtn) levelSelectBtn.addEventListener('click', () => {
            levelSelectModal.classList.remove('hidden');
            renderLevelGrid();
        });
        if (closeLevelSelectBtn) closeLevelSelectBtn.addEventListener('click', () => levelSelectModal.classList.add('hidden'));

        if (levelTabCampaign) levelTabCampaign.addEventListener('click', () => { selectedLevelTab = 'campaign'; renderLevelGrid(); });
        if (levelTabMyLevels) levelTabMyLevels.addEventListener('click', () => { selectedLevelTab = 'my_levels'; renderLevelGrid(); });

        if (settingsBtn) settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
        if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => { settingsModal.classList.add('hidden'); pendingBinding = null; refreshBindings(); });

        if (pauseSettingsBtn) pauseSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
        if (resumeBtn) resumeBtn.addEventListener('click', () => { isPaused = false; pauseOverlay.classList.add('hidden'); });
        if (restartBtn) restartBtn.addEventListener('click', () => { isPaused = false; pauseOverlay.classList.add('hidden'); restartLevel(); });
        if (pauseMenuBtn) pauseMenuBtn.addEventListener('click', returnToMenu);

        if (nextLevelBtn) nextLevelBtn.addEventListener('click', () => {
            winOverlay.classList.add('hidden');
            if (isCustomLevel) {
                if (customLevelIndex + 1 < customLevels.length) loadCustomLevel(customLevelIndex + 1);
                else { returnToMenu(); return; }
            } else {
                if (currentLevel + 1 < LEVELS.length) loadLevel(currentLevel + 1);
                else { returnToMenu(); return; }
            }
            gameStarted = true;
        });
        if (winMenuBtn) winMenuBtn.addEventListener('click', returnToMenu);

        // Level Editor Listeners
        if (levelEditorBtn) levelEditorBtn.addEventListener('click', () => {
            if (checkLevelEditorUnlocked()) {
                editorModal.classList.remove('hidden');
                renderEditorCanvas();
            } else {
                showStatusMessage('🔒 Complete Level 10 to unlock the Level Editor!');
            }
        });
        if (closeEditorBtn) closeEditorBtn.addEventListener('click', () => editorModal.classList.add('hidden'));

        const editorTools = { platform: toolPlatform, coin: toolCoin, spike: toolSpike, enemy: toolEnemy, start: toolStart, flag: toolFlag, eraser: toolEraser };
        for (const [tool, button] of Object.entries(editorTools)) button.addEventListener('click', () => {
            currentEditorTool = tool;
            for (const [name, item] of Object.entries(editorTools)) {
                item.className = 'editor-tool font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ' +
                    (name === tool ? 'active bg-teal-600 text-white border-teal-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700');
                item.setAttribute('aria-pressed', String(name === tool));
            }
        });
        function editorPoint(e) {
            const rect = editorCanvas.getBoundingClientRect();
            // object-contain can letterbox the canvas inside the editor panel.
            const scale = Math.min(rect.width / editorCanvas.width, rect.height / editorCanvas.height);
            return {
                x: Math.max(0, Math.min(800, (e.clientX - rect.left - (rect.width - 800 * scale) / 2) / scale)),
                y: Math.max(0, Math.min(450, (e.clientY - rect.top - (rect.height - 450 * scale) / 2) / scale))
            };
        }
        function eraseAt(point) {
            for (const name of ['enemies', 'coins', 'spikes', 'platforms']) {
                const index = editorData[name].findLastIndex(item => name === 'coins'
                    ? Math.hypot(point.x - item.x, point.y - item.y) <= 12
                    : point.x >= item.x && point.x <= item.x + (item.width || 28) && point.y >= item.y && point.y <= item.y + (item.height || 28));
                if (index >= 0) { editorData[name].splice(index, 1); return; }
            }
        }
        if (editorCanvas) {
            editorCanvas.style.touchAction = 'none';
            editorCanvas.addEventListener('contextmenu', e => e.preventDefault());
            editorCanvas.addEventListener('pointerdown', e => {
                if (!e.isPrimary || ![0, 2].includes(e.button)) return;
                e.preventDefault();
                editorCanvas.setPointerCapture(e.pointerId);
                const point = editorPoint(e);
                beginEditorEdit();
                if (e.button === 2 || currentEditorTool === 'eraser') eraseAt(point);
                else if (currentEditorTool === 'platform') {
                    isDrawingPlatform = true;
                    drawStartPos = point;
                    drawCurrentPos = point;
                } else if (currentEditorTool === 'coin') editorData.coins.push(point);
                else if (currentEditorTool === 'spike') editorData.spikes.push({ ...point, width: 40, height: 20 });
                else if (currentEditorTool === 'enemy') editorData.enemies.push(point);
                else if (currentEditorTool === 'start') editorData.start = point;
                else if (currentEditorTool === 'flag') editorData.flag = { ...point, width: 24, height: 210 };
                if(!isDrawingPlatform)commitEditorEdit();
                renderEditorCanvas();
            });
            editorCanvas.addEventListener('pointermove', e => {
                if (!isDrawingPlatform) return;
                drawCurrentPos = editorPoint(e);
                renderEditorCanvas();
            });
            editorCanvas.addEventListener('pointerup', e => {
                if (!isDrawingPlatform) return;
                drawCurrentPos = editorPoint(e);
                isDrawingPlatform = false;
                const width = Math.abs(drawCurrentPos.x - drawStartPos.x);
                const height = Math.abs(drawCurrentPos.y - drawStartPos.y);
                if (width > 10 && height > 5) editorData.platforms.push({
                    x: Math.min(drawStartPos.x, drawCurrentPos.x), y: Math.min(drawStartPos.y, drawCurrentPos.y), width, height
                });
                commitEditorEdit();
                renderEditorCanvas();
            });
            editorCanvas.addEventListener('pointercancel', () => { isDrawingPlatform = false; pendingEditorEdit=null; renderEditorCanvas(); });
        }
        if (editorTestBtn) editorTestBtn.addEventListener('click', () => {
            loadCustomLevel(-1, editorData);
            document.getElementById('backToEditorBtn').classList.remove('hidden');
            editorModal.classList.add('hidden');
            titleOverlay.classList.add('hidden');
            gameStarted = true;
        });

        if (editorClearBtn) editorClearBtn.addEventListener('click', () => { beginEditorEdit();resetEditor(false);commitEditorEdit();renderEditorCanvas(); });
        if (editorSaveBtn) editorSaveBtn.addEventListener('click', () => saveEditorLevel(false));
        document.getElementById('editorSaveCopyBtn').addEventListener('click', () => saveEditorLevel(true));

        // Touch button handlers
        const touchLeft = document.getElementById('touchLeft');
        const touchRight = document.getElementById('touchRight');
        const touchJump = document.getElementById('touchJump');

        for (const [button, action] of [[touchLeft, 'left'], [touchRight, 'right'], [touchJump, 'up']]) {
            if (!button) continue;
            button.style.touchAction = 'none';
            button.setAttribute('aria-label', action === 'up' ? 'Jump' : `Move ${action}`);
            button.addEventListener('pointerdown', e => {
                e.preventDefault();
                if (!window.Platdo?.controls?.isMobile || !gameStarted || isPaused) return;
                button.setPointerCapture(e.pointerId);
                touchKeys[action] = true;
                syncControls();
            });
            for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => {
                touchKeys[action] = false;
                syncControls();
            });
        }

        // Admin Auth Event Listeners
        if (adminBtn) adminBtn.addEventListener('click', () => adminModal.classList.remove('hidden'));
        if (closeAdminBtn) closeAdminBtn.addEventListener('click', () => adminModal.classList.add('hidden'));
        if (adminAuthBtn) {
            adminAuthBtn.addEventListener('click', () => {
                if (adminPassInput && adminPassInput.value === '177161') {
                    if (adminAuthSection) adminAuthSection.classList.add('hidden');
                    if (adminControlsSection) adminControlsSection.classList.remove('hidden');
                    if (adminAuthError) adminAuthError.classList.add('hidden');
                } else if (adminAuthError) {
                    adminAuthError.classList.remove('hidden');
                }
            });
        }

        function beatGameFromAdmin(save=true){
            maxUnlockedLevel=LEVELS.length;
            unlockedColors=SHOP_ITEMS.map(item=>item.id);
            unlockedTrails=TRAIL_ITEMS.map(item=>item.id);
            unlockedThemes=THEME_ITEMS.map(item=>item.id);
            ownsGoldAK=true;
            for(const id of Object.keys(GUN_UPGRADES)){
                Object.assign(gunUpgrades[id],{recoil:3,mag:3,selected:3});
                inventory[id]=Math.max(inventory[id],magazineCapacity(id));
            }
            inventory.nuke=Math.max(inventory.nuke,1);
            levelStartInventory={...inventory};
            setInfiniteAmmo(true);checkLevelEditorUnlocked();renderLevelGrid();renderShopGrid();renderLockerGrid();
            let saved=true;
            if(save){
                saved=saveGunUpgrades()&&saveGunSkins();
                try{localStorage.setItem('platdo_admin_completed_campaign','true');}catch(_){saved=false;}
            }
            document.getElementById('adminBeatGameStatus').textContent=`All ${LEVELS.length} campaign levels completed. All cosmetics unlocked, guns fully upgraded, and infinite ammo ON.${saved?'':' Browser storage is unavailable; changes are active for this session.'}`;
        }
        document.getElementById('adminBeatGameBtn').addEventListener('click',()=>beatGameFromAdmin());
        function setInfiniteAmmo(enabled){
            infiniteAmmo=enabled;fireCooldown=0;resetMagazines();
            const button=document.getElementById('adminInfiniteAmmoBtn');
            button.textContent=`Infinite ammo: ${enabled?'ON':'OFF'}`;
            button.setAttribute('aria-pressed',String(enabled));
            updateWeaponHUD();renderWeaponShop();
        }
        document.getElementById('adminInfiniteAmmoBtn').addEventListener('click',()=>setInfiniteAmmo(!infiniteAmmo));
        if (adminAddCashBtn) adminAddCashBtn.addEventListener('click', () => { score += 10000; updateCashDisplay(); });
        if (adminPassLevelBtn) adminPassLevelBtn.addEventListener('click', () => { adminModal.classList.add('hidden'); completeLevel(); });
        if (adminUnlockAllBtn) adminUnlockAllBtn.addEventListener('click', () => { maxUnlockedLevel = LEVELS.length; updateWeaponHUD(); checkLevelEditorUnlocked(); renderLevelGrid(); alert('Unlocked all campaign levels & level editor!'); });
        if (adminResetProgressBtn) adminResetProgressBtn.addEventListener('click', resetAllJumpProgress);

        // Saved-level editing uses detached copies so drafts never mutate saved levels.
        let editingLevelIndex = -1;
        function freshEditorData() {
            return { start: { x: 50, y: 350 }, flag: { x: 720, y: 170, width: 24, height: 210 }, platforms: [{ x: 0, y: 400, width: 800, height: 50 }], coins: [], spikes: [], enemies: [] };
        }
        function resetEditor(clearHistory=true) {
            if(clearHistory)clearEditorHistory();
            editorData = freshEditorData(); editingLevelIndex = -1; isDrawingPlatform = false;
            editorSaveBtn.textContent = 'Save Level';
            document.getElementById('editorSaveCopyBtn').classList.add('hidden');
            editorStatus.textContent = 'New level. Click and drag to place platforms. Right-click to erase.';
        }
        function openSavedLevel(index) {
            clearEditorHistory();
            editorData = JSON.parse(JSON.stringify(customLevels[index]));
            editingLevelIndex = index;
            editorSaveBtn.textContent = 'Save Changes';
            document.getElementById('editorSaveCopyBtn').classList.remove('hidden');
            editorStatus.textContent = `Editing: ${customLevels[index].name}`;
            levelSelectModal.classList.add('hidden'); editorModal.classList.remove('hidden');
            renderEditorCanvas();
        }
        function saveEditorLevel(copy) {
            const replacing = editingLevelIndex >= 0 && !copy;
            const suggested = editingLevelIndex >= 0 ? customLevels[editingLevelIndex].name + (copy ? ' (Copy)' : '') : `Custom ${customLevels.length + 1}`;
            const name = prompt(replacing ? 'Save changes to this level:' : 'Name your new level:', suggested);
            if (name === null || !name.trim()) return;
            const level = { ...JSON.parse(JSON.stringify(editorData)), name: name.trim().slice(0, 80), id: replacing ? customLevels[editingLevelIndex].id : newLevelId() };
            const before = customLevels.slice();
            if (replacing) customLevels[editingLevelIndex] = level; else customLevels.push(level);
            if (!saveCustomLevelsToStorage()) {
                customLevels = before;
                editorStatus.textContent = 'Could not save: browser storage is unavailable or full. Your draft is still here.';
                return;
            }
            resetEditor(); renderEditorCanvas(); renderLevelGrid();
            editorStatus.textContent = 'Saved! The editor is ready for your next level.';
        }
        function renameSavedLevel(index) {
            const name = prompt('Rename your level:', customLevels[index].name || `Custom ${index + 1}`);
            if (name === null || !name.trim()) return;
            const previous = customLevels[index].name;
            customLevels[index].name = name.trim().slice(0, 80);
            if (!saveCustomLevelsToStorage()) { customLevels[index].name = previous; alert('Could not save the new name. Browser storage is unavailable or full.'); }
            renderLevelGrid();
        }

        const WEAPONS = {
            sniper: { name: 'Sniper', price: 300, unlock: 9, ammo: 1, chance: 0.167, color: '#111111', symbol: 'S', description: '1 shot. Tap an enemy, or aim with the pointer and press your fire key. A miss uses the shot.' },
            pistol: { name: 'Pistol', price: 1000, unlock: 19, ammo: 9, chance: 0.47, color: '#2563eb', symbol: 'P', description: '9 shots. Press E (rebindable) or Fire to shoot in the direction you face.' },
            ak48: { name: 'AK-48', price: 2048, unlock: 47, ammo: 48, chance: 0.25, color: '#925a34', symbol: 'A', description: '48 shots. Hold E (rebindable) or Fire for rapid automatic fire.' },
            nuke: { name: 'Nuke', price: 5000, unlock: 50, ammo: 1, chance: 0.05, color: '#fb7185', symbol: 'N', description: 'Bought and collected nukes stay in your inventory. Equip one and press your fire key to defeat every enemy.' }
        };
// Permanent upgrades belong to each gun; nukes never enter this table.
const GUN_UPGRADES = {
 sniper:{delays:[12,10,8,6],sizes:[1,2,3,5],recoilPrice:1500,magPrice:1000},
 pistol:{delays:[12,10,8,6],sizes:[9,18,27,36],recoilPrice:2500,magPrice:2000},
 ak48:{delays:[5,4,3,2],sizes:[48,72,96,144],recoilPrice:4000,magPrice:4800}
};
const gunUpgrades=Object.fromEntries(Object.keys(GUN_UPGRADES).map(id=>[id,{recoil:0,mag:0,selected:0}]));
try{
 const saved=JSON.parse(localStorage.getItem('platdo_gun_upgrades_v1')||'{}');
 for(const id of Object.keys(gunUpgrades)){
  const value=saved[id];if(!value)continue;
  for(const key of ['recoil','mag'])if(Number.isInteger(value[key]))gunUpgrades[id][key]=Math.max(0,Math.min(3,value[key]));
  if(Number.isInteger(value.selected))gunUpgrades[id].selected=Math.max(0,Math.min(gunUpgrades[id].mag,value.selected));
 }
}catch(_){}
let weaponShopTab='ammo';
function shotDelay(id){return GUN_UPGRADES[id]?.delays[gunUpgrades[id].recoil]||12;}
function magazineCapacity(id){return GUN_UPGRADES[id]?.sizes[gunUpgrades[id].selected]||1;}
function saveGunUpgrades(){try{localStorage.setItem('platdo_gun_upgrades_v1',JSON.stringify(gunUpgrades));return true;}catch(_){return false;}}
function upgradeCost(id,type){const spec=GUN_UPGRADES[id];return spec[type==='recoil'?'recoilPrice':'magPrice']*(gunUpgrades[id][type]+1);}
function buyGunUpgrade(id,type){
 if(!GUN_UPGRADES[id]||!['recoil','mag'].includes(type)||!weaponUnlocked(id)||gunUpgrades[id][type]>=3||isCustomLevel&&gameStarted)return false;
 const cost=upgradeCost(id,type);if(score<cost)return false;
 const old={...gunUpgrades[id]};gunUpgrades[id][type]++;
 if(type==='mag')gunUpgrades[id].selected=gunUpgrades[id].mag;
 if(!saveGunUpgrades()){Object.assign(gunUpgrades[id],old);document.getElementById('weaponShopMessage').textContent='Upgrade could not be saved. Your cash was not spent.';return false;}
 score-=cost;if(gameStarted)levelStartScore=Math.max(0,levelStartScore-cost);
 if(gunUpgrades[id].recoil===3&&gunUpgrades[id].mag===3)playGameClip('weaponMax');
 onMagazineChanged(id);updateCashDisplay();updateWeaponHUD();renderWeaponShop();
 document.getElementById('weaponShopMessage').textContent=`${WEAPONS[id].name}: ${type==='recoil'?'faster firing unlocked!':'larger magazine unlocked! Ammo sold separately.'}`;
 return true;
}
function selectMagazine(id,index){
 if(!GUN_UPGRADES[id]||!Number.isInteger(index)||index<0||index>gunUpgrades[id].mag)return;
 const before=gunUpgrades[id].selected;gunUpgrades[id].selected=index;
 if(!saveGunUpgrades()){gunUpgrades[id].selected=before;renderWeaponShop();return;}
 onMagazineChanged(id);updateWeaponHUD();renderWeaponShop();
}
function renderGunUpgrades(grid){
 for(const [id,spec] of Object.entries(GUN_UPGRADES)){
  const state=gunUpgrades[id],available=weaponUnlocked(id)&&!(isCustomLevel&&gameStarted);
  const card=document.createElement('div');card.className='weapon-card';card.dataset.upgradeWeapon=id;
  const heading=document.createElement('h3');heading.textContent=WEAPONS[id].name;
  const status=document.createElement('p');status.textContent=weaponUnlocked(id)?'Permanent gun upgrades. Ammo is purchased separately.':`Unlocks at level ${WEAPONS[id].unlock+1}.`;
  card.append(heading,status);
  for(const type of ['recoil','mag']){
   const line=document.createElement('p');line.textContent=type==='recoil'?`Less recoil · Tier ${state.recoil}/3 · ${Math.round((1-shotDelay(id)/spec.delays[0])*100)}% less delay between shots.`:`Magazine upgrades · Tier ${state.mag}/3 · Up to ${spec.sizes[state.mag]} bullets.`;
   const buy=document.createElement('button');buy.className='game-button accent';buy.dataset.upgrade=type;
   buy.disabled=!available||state[type]>=3||score<upgradeCost(id,type);
   buy.textContent=state[type]>=3?'Fully upgraded':`${type==='recoil'?'Upgrade firing speed':`Unlock ${spec.sizes[state.mag+1]}-round magazine`} · $${upgradeCost(id,type).toLocaleString()}`;
   buy.addEventListener('click',()=>buyGunUpgrade(id,type));card.append(line,buy);
  }
  const label=document.createElement('label');label.textContent='Magazine size';label.htmlFor='mag-size-'+id;
  const select=document.createElement('select');select.id=label.htmlFor;select.className='game-button';select.disabled=!available;
  spec.sizes.forEach((size,i)=>{if(i>state.mag)return;const option=document.createElement('option');option.value=i;option.textContent=`${size} ${size===1?'bullet':'bullets'}`;select.append(option);});
  select.value=state.selected;select.addEventListener('change',()=>selectMagazine(id,Number(select.value)));
  card.append(label,select);grid.append(card);
 }
}
function selectWeaponShopTab(tab){
 weaponShopTab=tab;
 for(const button of document.querySelectorAll('[data-weapon-shop-tab]')){
  const selected=button.dataset.weaponShopTab===tab;button.setAttribute('aria-selected',String(selected));button.classList.toggle('accent',selected);
 }
 document.getElementById('weaponShopMessage').textContent='';renderWeaponShop();
}
for(const button of document.querySelectorAll('[data-weapon-shop-tab]'))button.addEventListener('click',()=>selectWeaponShopTab(button.dataset.weaponShopTab));

const magazines={sniper:0,pistol:0,ak48:0};
const reloadRemaining={sniper:0,pistol:0,ak48:0};
const RELOAD_FRAMES=60;
function beginReload(id){
 if(infiniteAmmo||!GUN_UPGRADES[id]||reloadRemaining[id]>0||inventory[id]<=magazines[id]||magazines[id]>=magazineCapacity(id))return false;
 reloadRemaining[id]=RELOAD_FRAMES;updateWeaponHUD();return true;
}
function onMagazineChanged(id){
 if(!GUN_UPGRADES[id])return;
 // Inventory includes the loaded rounds: changing magazines never creates ammo.
 magazines[id]=Math.min(inventory[id],magazineCapacity(id));reloadRemaining[id]=0;
}
function resetMagazines(){for(const id of Object.keys(GUN_UPGRADES))onMagazineChanged(id);}
function tickReloads(){
 for(const id of Object.keys(reloadRemaining))if(reloadRemaining[id]>0){
  reloadRemaining[id]--;
  if(reloadRemaining[id]===0){magazines[id]=Math.min(inventory[id],magazineCapacity(id));updateWeaponHUD();}
 }
}
function ammoLabel(id){
 if(infiniteAmmo)return id==='nuke'?'∞ uses':'∞ ammo';
 if(id==='nuke')return `${inventory[id]} uses`;
 const reserve=Math.max(0,inventory[id]-magazines[id]);
 return reloadRemaining[id]>0?`Reloading · ${reserve} reserve`:`${magazines[id]}/${magazineCapacity(id)} · ${reserve} reserve`;
}

        let infiniteAmmo = false;
        let inventory = { sniper: 0, pistol: 0, ak48: 0, nuke: 0 };
        let levelStartInventory = { ...inventory };
        let equippedWeapon = 'none';
        let facing = 1, fireCooldown = 0, fireHeld = false, weaponShopResume = false;
        let bullets = [], loot = [], nukeFlash = 0, aimPoint = null;
        const lootRolls = new Map();
        const weaponSelect = document.getElementById('weaponSelect');
        const fireWeaponBtn = document.getElementById('fireWeaponBtn');
        const weaponShopModal = document.getElementById('weaponShopModal');
        function weaponUnlocked(id) { return infiniteAmmo || maxUnlockedLevel >= WEAPONS[id].unlock; }
        function updateWeaponHUD() {
            weaponSelect.replaceChildren();
            const none = document.createElement('option'); none.value = 'none'; none.textContent = 'No weapon'; weaponSelect.appendChild(none);
            for (const id of weaponOrder) {
                if(id==='none')continue;
                const item=WEAPONS[id];
                if (!weaponUnlocked(id)) continue;
                const option = document.createElement('option'); option.value = id; option.textContent = `${item.name} · ${ammoLabel(id)}`; weaponSelect.appendChild(option);
            }
            if (equippedWeapon !== 'none' && !weaponUnlocked(equippedWeapon)) equippedWeapon = 'none';
            weaponSelect.value = equippedWeapon;
            fireWeaponBtn.textContent = `${reloadRemaining[equippedWeapon]>0?'Reloading…':equippedWeapon==='nuke'?'Detonate':'Fire'} · ${inputLabel(bindings.fire[0])}`;
            fireWeaponBtn.disabled = equippedWeapon === 'none' || !weaponUnlocked(equippedWeapon) || isCustomLevel;
            document.getElementById('weaponHelp').textContent = isCustomLevel ? 'Custom levels: weapons and loot are disabled. Jump on enemies to stomp them.' :
                (WEAPONS[equippedWeapon]?.description.replace(/E \(rebindable\)/g, window.Platdo?.controls?.isMobile?'Fire':inputLabel(bindings.fire[0])) || 'Sniper: level 10 · Pistol: level 20 · AK-48: level 48 · Nuke: beat level 50.');
            const mobileWeaponStatus=document.getElementById('jumpMobileWeaponStatus');if(mobileWeaponStatus)mobileWeaponStatus.textContent=equippedWeapon==='none'?'':WEAPONS[equippedWeapon].name+' · '+ammoLabel(equippedWeapon);
            canvas.style.cursor = equippedWeapon === 'sniper' ? 'crosshair' : 'default';
            renderInventoryTray();
        }
        function renderWeaponShop() {
            document.getElementById('weaponShopBalance').textContent = `Cash: $${score.toLocaleString()} · Reached level ${Math.min(maxUnlockedLevel + 1, LEVELS.length)} / ${LEVELS.length}`;
            const grid = document.getElementById('weaponShopGrid'); grid.replaceChildren();
            grid.setAttribute('aria-labelledby',weaponShopTab==='upgrades'?'weaponUpgradeTab':'weaponAmmoTab');
            document.getElementById('weaponUpgradeHelp').classList.toggle('hidden',weaponShopTab!=='upgrades');
            if(weaponShopTab==='upgrades'){renderGunUpgrades(grid);return;}
            for (const [id, item] of Object.entries(WEAPONS)) {
                const card = document.createElement('div'); card.className = 'weapon-card';
                const heading = document.createElement('h3'); heading.textContent = `${item.symbol} · ${item.name}`;
                const details = document.createElement('p'); details.textContent = `${item.description.replace(/E \(rebindable\)/g, window.Platdo?.controls?.isMobile?'Fire':inputLabel(bindings.fire[0]))} Loot chance: ${+(item.chance * 100).toFixed(1)}% per level after unlock.`;
                const buy = document.createElement('button'); buy.className = 'game-button accent';
                buy.disabled = !weaponUnlocked(id) || score < item.price || isCustomLevel && gameStarted;
                buy.textContent = !weaponUnlocked(id) ? (id === 'nuke' ? 'Beat level 50 to unlock' : `Reach level ${item.unlock + 1} to unlock`) : `Buy ${item.ammo} ${id === 'nuke' ? 'nuke' : 'shots'} · $${item.price.toLocaleString()}`;
                buy.addEventListener('click', () => buyWeapon(id)); card.append(heading, details, buy); grid.appendChild(card);
            }
        }
        function buyWeapon(id) {
            const item = WEAPONS[id];
            if (!weaponUnlocked(id) || score < item.price || isCustomLevel && gameStarted) return false;
            score -= item.price; inventory[id] += item.ammo; equippedWeapon = id;
            onMagazineChanged(id);
            // A purchase during a run survives a death without refunding its cost.
            if (gameStarted) { levelStartScore = Math.max(0, levelStartScore - item.price); levelStartInventory[id] += item.ammo; }
            updateCashDisplay(); updateWeaponHUD(); renderWeaponShop();
            document.getElementById('weaponShopMessage').textContent = id === 'nuke' ? `Nuke added to inventory. Equip it and use ${inputLabel(bindings.fire[0])} to detonate.` : `${item.name} equipped. Added ${item.ammo} shots.`;
            return true;
        }
        function openWeaponShop() {
            weaponShopResume = gameStarted && !isPaused;
            if (gameStarted) isPaused = true;
            resetControls(); renderWeaponShop();
            document.getElementById('weaponShopMessage').textContent = '';
            weaponShopModal.classList.remove('hidden');
        }
        document.getElementById('mainWeaponShopBtn').addEventListener('click', openWeaponShop);
        document.getElementById('inGameWeaponShopBtn').addEventListener('click', openWeaponShop);
        document.getElementById('closeWeaponShopBtn').addEventListener('click', () => {
            weaponShopModal.classList.add('hidden'); if (weaponShopResume) isPaused = false; weaponShopResume = false;
        });
        weaponSelect.addEventListener('change', () => { equippedWeapon = weaponSelect.value; fireHeld = false; updateWeaponHUD(); weaponSelect.blur(); });
        fireWeaponBtn.style.touchAction = 'none';
        fireWeaponBtn.addEventListener('pointerdown', e => { e.preventDefault(); fireWeaponBtn.setPointerCapture(e.pointerId); fireButtonHeld = true; syncControls(); fireWeapon(); });
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) fireWeaponBtn.addEventListener(event, () => { fireButtonHeld = false; syncControls(); });
        fireWeaponBtn.addEventListener('click', e => { if (e.detail === 0) fireWeapon(); });
        function canvasPoint(e) {
            const rect = canvas.getBoundingClientRect();
            const scale = Math.min(rect.width / 800, rect.height / 450);
            return { x: (e.clientX - rect.left - (rect.width - 800 * scale) / 2) / scale, y: (e.clientY - rect.top - (rect.height - 450 * scale) / 2) / scale };
        }
        canvas.addEventListener('pointermove', e => { if(!window.Platdo?.controls?.isMobile&&e.pointerType!=='touch')aimPoint = canvasPoint(e); });
        canvas.style.touchAction = 'none';
        canvas.addEventListener('pointerdown', e => { if (!window.Platdo?.controls?.isMobile&&e.pointerType!=='touch'&&e.button===0 && equippedWeapon === 'sniper' && !Object.values(bindings).some(codes=>codes.includes('Mouse0'))) { e.preventDefault(); aimPoint = canvasPoint(e); fireWeapon(aimPoint); } });
        function defeatEnemy(enemy, silent=false) {
            if (!enemy.alive) return;
            enemy.alive = false; score += 300; runEarned += 300; if(!silent)playGameClip('enemyDeath'); updateCashDisplay();
        }
        function fireWeapon(point = aimPoint || { x: 800 / 2, y: 450 / 2 }) {
            if (!gameStarted || isPaused || isSlidingFlag || isCustomLevel || equippedWeapon === 'none' || !weaponUnlocked(equippedWeapon) || fireCooldown > 0) return false;
            if(!infiniteAmmo&&inventory[equippedWeapon]<=0){
                fireCooldown=shotDelay(equippedWeapon);
                playGameClip('empty');
                return false;
            }
            if(!infiniteAmmo&&GUN_UPGRADES[equippedWeapon]){
                if(reloadRemaining[equippedWeapon]>0)return false;
                if(magazines[equippedWeapon]<=0){beginReload(equippedWeapon);return false;}
            }
            if (equippedWeapon === 'sniper' && !point) return false;
            if(!infiniteAmmo){
                inventory[equippedWeapon]--;
                if(GUN_UPGRADES[equippedWeapon])magazines[equippedWeapon]--;
            }
            fireCooldown = shotDelay(equippedWeapon);
            playGameClip(equippedWeapon);
            if (equippedWeapon === 'sniper') {
                const hit = enemies.find(e => e.alive && point.x >= e.x && point.x <= e.x + e.width && point.y >= e.y && point.y <= e.y + e.height);
                if (hit) defeatEnemy(hit); else showStatusMessage('Sniper missed. Shot used.');
            } else if(equippedWeapon==='nuke') {
                enemies.forEach(enemy=>defeatEnemy(enemy,true));nukeFlash=18;showStatusMessage('Nuke detonated: every enemy defeated!');
            } else {
                bullets.push({ x: player.x + player.width / 2, y: player.y + player.height / 2, width: 10, height: 4, vx: facing * 12, color: WEAPONS[equippedWeapon].color });

            }
            if(!infiniteAmmo&&GUN_UPGRADES[equippedWeapon]&&magazines[equippedWeapon]===0)beginReload(equippedWeapon);
            updateWeaponHUD(); return true;
        }
        function prepareLevelWeapons(retry) {
            bullets = []; fireCooldown = 0; fireHeld = false; nukeFlash = 0; facing = 1;
            resetMagazines();
            if (!retry) levelStartInventory = { ...inventory };
            // Cache a roll for each level and unlock tier, preventing rerolls on death.
            const eligible = Object.keys(WEAPONS).filter(weaponUnlocked);
            const key = `${currentLevel}:${eligible.join(',')}`;
            if (!lootRolls.has(key)) {
                const spots = LEVELS[currentLevel].coins;
                lootRolls.set(key, eligible.filter(id => Math.random() < WEAPONS[id].chance).map((id, i) => {
                    const start=LEVELS[currentLevel].start;
                    const spot = id==='nuke' ? {x:start.x+14,y:start.y+27} : spots[Math.min(i, spots.length - 1)] || start;
                    return { id, x: spot.x, y: spot.y - 8, radius: 14, collected: false };
                }));
            }
            loot = lootRolls.get(key).map(item => ({ ...item, collected: false }));
            updateWeaponHUD();
        }
        function updateWeapons() {
            if (isCustomLevel) return;
            tickReloads();
            if (fireCooldown > 0) fireCooldown--;
            if (nukeFlash > 0) nukeFlash--;
            if (fireHeld && equippedWeapon === 'ak48') fireWeapon();
            bullets = bullets.filter(b => {
                // Sweep each pixel group so fast bullets cannot skip a thin wall or enemy.
                for (let step = 0; step < 3; step++) {
                    b.x += b.vx / 3;
                    if (b.x < 0 || b.x > 800 || platforms.some(p => checkAABB(b, p))) return false;
                    const hit = enemies.find(e => e.alive && checkAABB(b, e));
                    if (hit) { defeatEnemy(hit); return false; }
                }
                return true;
            });
            for (const item of loot) {
                if (!item.collected && circleBoxIntersect(item, player)) {
                    item.collected = true;
                    inventory[item.id] += WEAPONS[item.id].ammo;
                    if(GUN_UPGRADES[item.id]&&magazines[item.id]===0)beginReload(item.id);
                    if (equippedWeapon === 'none') equippedWeapon = item.id;
                    playCoinSound(); updateWeaponHUD();
                    showStatusMessage(item.id==='nuke' ? `Nuke stored! Equip it and press ${inputLabel(bindings.fire[0])} to detonate.` : `Loot: +${WEAPONS[item.id].ammo} ${WEAPONS[item.id].name} shots!`);
                }
            }
        }
        const heldWeaponSprites = {};
        heldWeaponSprites.ak48 = { image: new Image(), crop: [86, 393, 836, 244], width: 52, dx: -10, dy: -7 };
        heldWeaponSprites.ak48.image.src = 'assets/images/image-96e3ce94052c.png';
        heldWeaponSprites.pistol = { image: new Image(), crop: [67, 96, 1773, 1220], width: 30, dx: 4, dy: -9 };
        heldWeaponSprites.pistol.image.src = 'assets/images/image-fa9196a9e3c2.png';
        heldWeaponSprites.sniper = { image: new Image(), crop: [23,40,1042,537], width: 64, dx: -10, dy: -22 };
        heldWeaponSprites.sniper.image.src = 'assets/images/image-8b1602e9cc23.webp';
        const goldAKSprite = { image: new Image(), crop: [31,301,1067,579], width: 55, dx: -10, dy: -14 };
        goldAKSprite.image.src = 'assets/images/goldaksprite-87fd15aafd56.png';
        let ownsGoldAK = false;
        let equippedAKSkin = 'default';
        try {
            const saved = JSON.parse(localStorage.getItem('platformer_gun_skins') || '{}');
            ownsGoldAK = saved.ownsGoldAK === true;
            equippedAKSkin = ownsGoldAK && saved.equippedAKSkin === 'gold' ? 'gold' : 'default';
        } catch (_) {}
        function saveGunSkins() {
            try { localStorage.setItem('platformer_gun_skins', JSON.stringify({ownsGoldAK,equippedAKSkin})); return true; }
            catch (_) { return false; }
        }
        function getHeldWeaponSprite() {
            return equippedWeapon === 'ak48' && ownsGoldAK && equippedAKSkin === 'gold' ? goldAKSprite : heldWeaponSprites[equippedWeapon];
        }
        function drawSkinPreview(target, sprite) {
            const context=target.getContext('2d');context.clearRect(0,0,target.width,target.height);
            if (!sprite.image.complete || !sprite.image.naturalWidth) return;
            const [sx,sy,sw,sh]=sprite.crop;
            const scale=Math.min((target.width-12)/sw,(target.height-10)/sh);
            context.drawImage(sprite.image,sx,sy,sw,sh,(target.width-sw*scale)/2,(target.height-sh*scale)/2,sw*scale,sh*scale);
        }
        function renderGunSkins(locker) {
            const grid=locker ? lockerGrid : shopGrid;
            grid.replaceChildren();grid.style.gridTemplateColumns='repeat(2,minmax(0,1fr))';
            (locker ? lockerMsg : shopMsg).textContent=locker ? 'Choose your AK-48 appearance. The skin changes its look, not its ammo or firing speed.' : 'Gold AK-48 · $48,000 · cosmetic skin. Equip it here or in the Locker.';
            for (const skin of ['default','gold']) {
                if (locker && skin==='gold' && !ownsGoldAK) continue;
                const card=document.createElement('div');card.className='weapon-card';card.dataset.skin=skin;
                const label=document.createElement('h3');label.textContent=skin==='gold' ? 'Gold AK-48' : 'Default AK-48';
                const preview=document.createElement('canvas');preview.width=190;preview.height=85;preview.style.width='100%';preview.setAttribute('aria-label',label.textContent+' preview');
                drawSkinPreview(preview,skin==='gold' ? goldAKSprite : heldWeaponSprites.ak48);
                const button=document.createElement('button');button.className='game-button accent';
                if (locker) {
                    button.textContent=equippedAKSkin===skin ? 'Equipped' : 'Equip';button.disabled=equippedAKSkin===skin;
                    button.addEventListener('click',()=>{
                        equippedAKSkin=skin;saveGunSkins();renderGunSkins(true);updateWeaponHUD();
                        if (!gameStarted) render();
                    });
                } else {
                    const owned=skin==='default'||ownsGoldAK;
                    button.textContent=owned ? (equippedAKSkin===skin?'Equipped':'Equip') : 'Buy · $48,000';button.disabled=owned?equippedAKSkin===skin:score<48000;
                    button.addEventListener('click',()=>{
                        if(owned){equippedAKSkin=skin;saveGunSkins();renderGunSkins(false);updateWeaponHUD();render();return;}
                        if(ownsGoldAK||score<48000)return;
                        score-=48000;ownsGoldAK=true;
                        if(gameStarted)levelStartScore=Math.max(0,levelStartScore-48000);
                        const saved=saveGunSkins();updateCashDisplay();renderGunSkins(false);
                        shopMsg.textContent=saved ? 'Gold AK-48 purchased! Press Equip here or select it in the Locker.' : 'Gold AK-48 purchased for this session. Browser storage is unavailable.';
                    });
                }
                card.append(label,preview,button);grid.appendChild(card);
            }
            if (locker) {
                drawSkinPreview(lockerPreviewCanvas,equippedAKSkin==='gold'&&ownsGoldAK ? goldAKSprite : heldWeaponSprites.ak48);
                previewName.textContent=equippedAKSkin==='gold' ? 'Gold AK-48' : 'Default AK-48';
            }
        }
        document.getElementById('shopTabGunSkins').addEventListener('click',()=>{currentShopTab='gun_skins';renderShopGrid();});
        document.getElementById('lockerTabGunSkins').addEventListener('click',()=>{currentLockerTab='gun_skins';renderLockerGrid();});
        goldAKSprite.image.addEventListener('load',()=>{
            if(currentShopTab==='gun_skins')renderShopGrid();
            if(currentLockerTab==='gun_skins')renderLockerGrid();
        });

        function drawHeldWeapon() {
            if (isCustomLevel) return;
            if(equippedWeapon==='nuke' && nukePickupImage.naturalWidth){ctx.drawImage(nukePickupImage,player.x+10,player.y+19,22,22);return;}
            const sprite = getHeldWeaponSprite();
            if (!sprite || !sprite.image.complete || !sprite.image.naturalWidth) return;
            const [sx,sy,sw,sh] = sprite.crop;
            ctx.save(); ctx.translate(player.x + player.width / 2, player.y + 25);
            ctx.scale(facing, 1);
            // Render directly from the supplied transparent PNG, facing with the player.
            ctx.drawImage(sprite.image,sx,sy,sw,sh,sprite.dx,sprite.dy,sprite.width,sprite.width*sh/sw);
            ctx.fillStyle=playerColors.body;ctx.strokeStyle=playerColors.outline;ctx.lineWidth=1;
            ctx.beginPath();ctx.arc(9,3,3.2,0,Math.PI*2);ctx.fill();ctx.stroke();
            ctx.restore();
        }

        const sniperScopeImage = new Image();
        sniperScopeImage.src = 'assets/images/sniperscopeimage-a3fce01e4bdf.jpg';
        function renderSniperScope() {
            if (equippedWeapon !== 'sniper' || isCustomLevel || !gameStarted) return;
            const aim = aimPoint || { x: 800 / 2, y: 450 / 2 };
            const x = Math.max(0, Math.min(800, aim.x));
            const y = Math.max(0, Math.min(450, aim.y));
            const size = 390, lens = size * .40;
            ctx.save();
            // Only use the photo's outside rim: its center has a baked-in checkerboard.
            // The transparent viewing area preserves visibility and pointer aiming.
            ctx.beginPath();ctx.rect(0,0,800,450);ctx.arc(x,y,lens,0,Math.PI*2,true);ctx.clip('evenodd');
            ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(0,0,800,450);
            if (sniperScopeImage.complete && sniperScopeImage.naturalWidth) {
                ctx.save();ctx.beginPath();ctx.arc(x,y,size*.48,0,Math.PI*2);ctx.clip();
                ctx.globalAlpha=.45;ctx.drawImage(sniperScopeImage,x-size/2,y-size/2,size,size);ctx.restore();
            }
            ctx.restore();
            ctx.save();ctx.translate(x,y);
            ctx.strokeStyle='rgba(10,12,15,.8)';ctx.lineWidth=2;
            ctx.beginPath();
            for(const [ax,ay,bx,by] of [[-lens,0,-105,0],[105,0,lens,0],[0,-lens,0,-105],[0,105,0,lens]]){ctx.moveTo(ax,ay);ctx.lineTo(bx,by);}
            ctx.stroke();
            ctx.strokeStyle='#be242c';ctx.lineWidth=1.4;ctx.beginPath();
            ctx.arc(0,0,52,0,Math.PI*2);
            ctx.moveTo(-108,0);ctx.lineTo(-14,0);ctx.moveTo(14,0);ctx.lineTo(108,0);
            ctx.moveTo(0,-108);ctx.lineTo(0,-14);ctx.moveTo(0,14);ctx.lineTo(0,108);
            for(let t=20;t<=95;t+=5){
                const h=t%10===0?8:4;
                ctx.moveTo(t,-h);ctx.lineTo(t,h);ctx.moveTo(-t,-h);ctx.lineTo(-t,h);
                ctx.moveTo(-h,t);ctx.lineTo(h,t);ctx.moveTo(-h,-t);ctx.lineTo(h,-t);
            }
            ctx.stroke();ctx.fillStyle='#cf2530';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();
            ctx.restore();
        }

        const nukePickupImage = new Image();
        nukePickupImage.src = "assets/images/nukepickupimage-1f11bd7dab1b.png";
        function renderWeapons() {
            if (isCustomLevel) return;
            for (const item of loot) {
                if (item.collected) continue;
                ctx.save();
                if (item.id === 'nuke' && nukePickupImage.complete && nukePickupImage.naturalWidth > 0) {
                    ctx.drawImage(nukePickupImage,item.x-17,item.y-17,34,34);
                } else {
                    // Solid-color ammo boxes remain identifiable against the bright sky.
                    ctx.fillStyle=WEAPONS[item.id].color;ctx.strokeStyle='#ffffff';ctx.lineWidth=2;
                    ctx.beginPath();ctx.roundRect(item.x-12,item.y-11,24,22,4);ctx.fill();ctx.stroke();
                    ctx.fillStyle='#ffffff';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
                    ctx.fillText(WEAPONS[item.id].symbol,item.x,item.y);
                }
                ctx.restore();
            }
            for (const b of bullets) { ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.width, b.height); }
            if (nukeFlash > 0) { ctx.fillStyle = `rgba(251,113,133,${nukeFlash / 60})`; ctx.fillRect(0, 0, 800, 450); }
        }

        function spriteForInventory(id) {
            if(id==='nuke')return {image:nukePickupImage,crop:[0,0,nukePickupImage.naturalWidth,nukePickupImage.naturalHeight]};
            return id==='ak48'&&ownsGoldAK&&equippedAKSkin==='gold'?goldAKSprite:heldWeaponSprites[id];
        }
        function renderInventoryTray() {
            const tray=document.getElementById('inventoryTray');tray.replaceChildren();
            for(const id of weaponOrder){
                const button=document.createElement('button');button.className='inventory-slot';button.dataset.weapon=id;
                button.classList.toggle('selected',equippedWeapon===id);button.disabled=id!=='none'&&(!weaponUnlocked(id)||isCustomLevel);
                button.setAttribute('aria-pressed',String(equippedWeapon===id));
                const name=id==='none'?'Empty hands':id==='ak48'&&ownsGoldAK&&equippedAKSkin==='gold'?'Gold AK-48':WEAPONS[id].name;
                button.setAttribute('aria-label',`${name}${id==='none'?'':`, ${ammoLabel(id)}`}${equippedWeapon===id?', selected':''}`);
                const preview=document.createElement('canvas');preview.width=140;preview.height=58;preview.setAttribute('aria-hidden','true');
                const sprite=spriteForInventory(id);if(sprite?.image.naturalWidth)drawSkinPreview(preview,sprite);
                if(id==='none'){const c=preview.getContext('2d');c.strokeStyle='#94a3b8';c.lineWidth=3;c.beginPath();c.arc(70,29,18,0,Math.PI*2);c.moveTo(57,42);c.lineTo(83,16);c.stroke();}
                const label=document.createElement('span');label.textContent=name;
                const amount=document.createElement('small');amount.textContent=id==='none'?'No weapon':weaponUnlocked(id)?ammoLabel(id):id==='nuke'?'Beat level 50':`Level ${WEAPONS[id].unlock+1}`;
                button.append(preview,label,amount);
                button.addEventListener('click',()=>{equippedWeapon=equippedWeapon===id?'none':id;resetControls();updateWeaponHUD();button.blur();if(!gameStarted)render();});
                tray.appendChild(button);
            }
        }
        function renderInventoryOrder() {
            const list=document.getElementById('inventoryOrder');list.replaceChildren();
            weaponOrder.forEach((id,index)=>{
                const row=document.createElement('div');row.className='order-row';row.dataset.weapon=id;
                const itemName=id==='none'?'Empty hands':WEAPONS[id].name;
                const name=document.createElement('span');name.textContent=`${index+1}. ${itemName}`;row.appendChild(name);
                for(const [delta,label] of [[-1,'↑'],[1,'↓']]){
                    const button=document.createElement('button');button.className='game-button';button.textContent=label;button.setAttribute('aria-label',`Move ${itemName} ${delta<0?'up':'down'}`);
                    button.disabled=index+delta<0||index+delta>=weaponOrder.length;
                    button.addEventListener('click',()=>{[weaponOrder[index],weaponOrder[index+delta]]=[weaponOrder[index+delta],weaponOrder[index]];saveControls();renderInventoryOrder();updateWeaponHUD();});row.appendChild(button);
                }
                list.appendChild(row);
            });
        }

        THEME_ITEMS.push(
            {id:'bg_alpine',category:'bg',name:'Alpine Sunrise',price:5000,bg:'#efbc9c',scene:'alpine'},
            {id:'bg_forest',category:'bg',name:'Deepwood Forest',price:8000,bg:'#236449',scene:'forest'},
            {id:'bg_desert',category:'bg',name:'Desert Mirage',price:11000,bg:'#e9b173',scene:'desert'},
            {id:'bg_ocean',category:'bg',name:'Coral Kingdom',price:15000,bg:'#067ba1',scene:'ocean'},
            {id:'bg_candy',category:'bg',name:'Candy Dreamland',price:20000,bg:'#dbadee',scene:'candy'},
            {id:'bg_storm',category:'bg',name:'Storm Castle',price:28000,bg:'#34475e',scene:'storm'},
            {id:'bg_aurora',category:'bg',name:'Aurora Night',price:36000,bg:'#102c45',scene:'aurora'},
            {id:'bg_city',category:'bg',name:'Neon Rooftops',price:46000,bg:'#171439',scene:'city'},
            {id:'bg_volcano',category:'bg',name:'Volcanic Caldera',price:65000,bg:'#5b1925',scene:'volcano'},
            {id:'bg_space',category:'bg',name:'Deep Space',price:90000,bg:'#0b103c',scene:'space'},
            {id:'plat_snow',category:'plat',name:'Snowy Ledges',price:6500,body:'#84bbd0',top:'#f4fbff',motif:'ice'},
            {id:'plat_moss',category:'plat',name:'Mossy Ruins',price:9500,body:'#637769',top:'#99bf58',motif:'stone'},
            {id:'plat_sand',category:'plat',name:'Sandstone Steps',price:12500,body:'#b98852',top:'#efd394',motif:'stone'},
            {id:'plat_candy',category:'plat',name:'Frosted Candy',price:20000,body:'#d76c97',top:'#fff0f6',motif:'candy'},
            {id:'plat_crystal',category:'plat',name:'Crystal Shelves',price:28000,body:'#594e94',top:'#9bedef',motif:'crystal'},
            {id:'plat_lava',category:'plat',name:'Obsidian Ledges',price:42000,body:'#352631',top:'#ffad33',motif:'lava'},
            {id:'plat_space',category:'plat',name:'Orbital Walkways',price:60000,body:'#344157',top:'#70edf3',motif:'circuit'},
            {id:'floor_snow',category:'floor',name:'Frozen Ground',price:7000,body:'#729daa',top:'#eefaff',spike:'#82e4ed',motif:'ice'},
            {id:'floor_forest',category:'floor',name:'Forest Roots',price:10000,body:'#63492f',top:'#568943',spike:'#b76543',motif:'roots'},
            {id:'floor_desert',category:'floor',name:'Dune Sand',price:13000,body:'#c38c4e',top:'#efd48b',spike:'#7e624b',motif:'stone'},
            {id:'floor_candy',category:'floor',name:'Sugar Cookie Floor',price:22000,body:'#cb986c',top:'#f4a7cf',spike:'#c363ba',motif:'candy'},
            {id:'floor_crystal',category:'floor',name:'Crystal Cavern',price:32000,body:'#343759',top:'#86d9f1',spike:'#aa91ef',motif:'crystal'},
            {id:'floor_obsidian',category:'floor',name:'Lava Crust',price:50000,body:'#2f2631',top:'#fe9b30',spike:'#fb5a24',motif:'lava'},
            {id:'floor_moon',category:'floor',name:'Moon Rock',price:70000,body:'#73778f',top:'#b9bfd4',spike:'#e1e7fa',motif:'moon'}
        );
        function sceneCircle(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
        function sceneMountain(c,x,y,w,h,color){c.fillStyle=color;c.beginPath();c.moveTo(x-w/2,y);c.lineTo(x,y-h);c.lineTo(x+w/2,y);c.fill();}
        function paintScene(c,item,width=800,height=450) {
            c.save();c.scale(width/800,height/450);const quality=jumpGraphicsValues(),detail=quality.detail,lighting=quality.lighting;
            const kind=item.scene||(item.id==='bg_dark'?'clouds':'legacy');
            const colors={clouds:['#4aa8ef','#b8e5ff'],alpine:['#dfa5a4','#f6dfb3'],forest:['#7aa69e','#245745'],desert:['#cf957a','#f5d09b'],ocean:['#42c3da','#034c79'],candy:['#a8b9f1','#fbd4e5'],storm:['#243044','#69798b'],aurora:['#061626','#21405e'],city:['#100e28','#482450'],volcano:['#241d31','#a94835'],space:['#04091f','#20204d']};
            const pair=colors[kind]||[item.bg,item.bg];const gradient=c.createLinearGradient(0,0,0,450);gradient.addColorStop(0,pair[0]);gradient.addColorStop(1,pair[1]);c.fillStyle=lighting==='low'?pair[0]:gradient;c.fillRect(0,0,800,450);
            if(kind==='legacy'){c.strokeStyle=item.grid||'#334155';c.globalAlpha=.5;for(let x=0;x<800;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,450);c.stroke();}for(let y=0;y<450;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(800,y);c.stroke();}}
            if(['clouds','alpine','candy'].includes(kind)){
                if(kind==='alpine')sceneCircle(c,660,90,48,'#fff1c3');
                for(const [x,y,sz] of [[60,60,1],[250,105,.8],[470,42,1.1],[670,115,.95],[115,205,.65],[530,205,.6]]){c.save();c.translate(x,y);c.scale(sz,sz);c.fillStyle=kind==='candy'?'#ffeef8':'#fff';c.beginPath();c.ellipse(0,9,49,15,0,0,Math.PI*2);c.ellipse(-22,0,21,20,0,0,Math.PI*2);c.ellipse(5,-9,28,25,0,0,Math.PI*2);c.ellipse(29,2,23,20,0,0,Math.PI*2);c.fill();c.restore();}
            }
            if(kind==='alpine'||kind==='aurora'){
                for(let i=0;i<(detail==='low'?1:detail==='medium'?3:6);i++){const x=i*180-30,y=450,h=155+(i%3)*50;sceneMountain(c,x,y,310,h,kind==='alpine'?'#8597a6':'#263851');sceneMountain(c,x,y-h+60,94,60,'#dce9ef');}
            }
            if(kind==='forest'){
                c.globalAlpha=.4;for(let i=0;i<(detail==='low'?3:detail==='medium'?6:13);i++){const x=i*70-20,h=100+(i%4)*30;c.fillStyle='#234c45';c.fillRect(x,450-h,16,h);sceneMountain(c,x+8,450-h/3,100,h,'#315f54');}c.globalAlpha=1;
                for(let i=0;i<(detail==='low'?1:detail==='medium'?3:7);i++){const x=i*140+10;c.fillStyle='#3d584d';c.fillRect(x,300,13,150);sceneMountain(c,x+6,400,100,190,'#315f48');sceneMountain(c,x+6,350,85,150,'#40795b');}
            }
            if(kind==='desert'){
                sceneCircle(c,645,78,44,'#ffe5ad');for(let i=0;i<3;i++){c.fillStyle=['#d5a174','#c49168','#aa7a59'][i];c.beginPath();c.moveTo(0,340+i*35);c.bezierCurveTo(190,190+i*50,400,480,800,290+i*50);c.lineTo(800,450);c.lineTo(0,450);c.fill();}
                c.strokeStyle='#758459';c.lineWidth=13;for(const x of [75,685]){c.beginPath();c.moveTo(x,420);c.lineTo(x,325);c.moveTo(x,375);c.lineTo(x-20,360);c.lineTo(x-20,340);c.stroke();}
            }
            if(kind==='ocean'){
                c.strokeStyle='rgba(212,253,255,.22)';for(let i=0;i<(detail==='low'?4:detail==='medium'?8:17);i++){c.beginPath();c.arc((i*137)%800,50+(i*61)%350,4+i%4,0,Math.PI*2);c.stroke();}
                for(let i=0;i<(detail==='low'?3:detail==='medium'?6:12);i++){c.strokeStyle=i%2?'#c581ab':'#74b4a8';c.lineWidth=7;const x=i*73;c.beginPath();c.moveTo(x,450);c.quadraticCurveTo(x-25,400,x+8,360+(i%3)*20);c.stroke();}
                for(let i=0;i<(detail==='low'?1:detail==='medium'?3:7);i++){const x=65+i*115,y=120+i%3*60;c.fillStyle='#acd5d5';c.beginPath();c.ellipse(x,y,13,5,0,0,Math.PI*2);c.moveTo(x+10,y);c.lineTo(x+22,y-8);c.lineTo(x+22,y+8);c.fill();}
            }
            if(kind==='candy'){
                for(let i=0;i<(detail==='low'?2:detail==='medium'?4:8);i++){const x=i*117;c.strokeStyle='#faf1f7';c.lineWidth=6;c.beginPath();c.moveTo(x,450);c.lineTo(x,325-i%3*25);c.stroke();sceneCircle(c,x,325-i%3*25,28,i%2?'#ec9fbf':'#b5a2de');sceneCircle(c,x,325-i%3*25,14,'#fff2f7');}
            }
            if(kind==='storm'){
                c.fillStyle='#263448';for(let i=0;i<(detail==='low'?1:detail==='medium'?3:7);i++){const x=40+i*125,h=75+(i%3)*30;c.fillRect(x,450-h,70,h);for(let j=0;j<4;j++)c.fillRect(x+j*20,438-h,10,12);}
                c.strokeStyle='#d7dbef';c.lineWidth=3;c.beginPath();c.moveTo(580,30);c.lineTo(555,96);c.lineTo(583,90);c.lineTo(550,151);c.stroke();
                c.fillStyle='rgba(31,40,55,.45)';for(let i=0;i<(detail==='low'?2:detail==='medium'?4:8);i++){c.beginPath();c.ellipse(i*130,35+(i%2)*25,100,32,0,0,Math.PI*2);c.fill();}
            }
            if(['space','aurora','city'].includes(kind)){
                for(let i=0;i<(detail==='low'?23:detail==='medium'?47:95);i++)sceneCircle(c,(i*193+23)%800,(i*79+11)%320,i%6===0?1.6:.7,'#d6ddf6');
            }
            if(kind==='aurora'&&lighting!=='low'){
                for(let i=0;i<(detail==='low'?1:detail==='medium'?2:4);i++){c.strokeStyle=['#47b1a9','#6f9abf','#8d78c4','#83c5b3'][i];c.globalAlpha=.22;c.lineWidth=22;c.beginPath();c.moveTo(-30,80+i*25);c.bezierCurveTo(170,220,370,-10+i*25,830,130+i*20);c.stroke();}c.globalAlpha=1;
            }
            if(kind==='city'){
                for(let i=0;i<(detail==='low'?3:detail==='medium'?7:15);i++){const x=i*57,h=90+(i*37)%140;c.fillStyle=i%2?'#22243e':'#2f294b';c.fillRect(x,450-h,48,h);c.fillStyle=i%2?'#9a72b6':'#57859f';for(let y=470-h;y<440;y+=20)for(let a=8;a<40;a+=15)c.fillRect(x+a,y,6,9);}
            }
            if(kind==='volcano'){
                sceneMountain(c,390,450,660,285,'#462e38');sceneMountain(c,390,450,380,270,'#634035');
                c.strokeStyle='#f79042';c.lineWidth=11;c.beginPath();c.moveTo(390,180);c.lineTo(405,230);c.lineTo(377,285);c.lineTo(430,350);c.lineTo(415,450);c.stroke();
                for(let i=0;i<(detail==='low'?2:detail==='medium'?4:8);i++)sceneCircle(c,365+i*8,130-i*12,23+i*4,'rgba(73,48,54,.6)');
                c.fillStyle='#d87738';c.fillRect(0,432,800,18);
            }
            if(kind==='space'){
                sceneCircle(c,630,135,65,'#716695');c.strokeStyle='#b3a4c6';c.lineWidth=9;c.beginPath();c.ellipse(630,135,105,21,-.35,0,Math.PI*2);c.stroke();sceneCircle(c,160,80,25,'#8da7b7');
                c.fillStyle='#424766';c.beginPath();c.ellipse(400,570,510,220,0,0,Math.PI*2);c.fill();for(let i=0;i<(detail==='low'?2:detail==='medium'?4:9);i++)sceneCircle(c,40+i*95,405+(i%3)*13,12+i%3*5,'#343b57');
            }
            c.restore();
        }
        function paintTerrain(c,p,item) {
            const detail=jumpGraphicsValues().detail;const grassy=item.id==='plat_slate'||item.id==='floor_classic';
            c.save();c.beginPath();c.rect(p.x,p.y,p.width,p.height);c.clip();
            c.fillStyle=item.body||(grassy?'#925a34':'#48546a');c.fillRect(p.x,p.y,p.width,p.height);
            if(grassy){c.fillStyle='#754126';c.fillRect(p.x,p.y+8,p.width,7);}
            const motif=grassy?'dirt':item.motif;
            if(detail!=='low')for(let y=p.y+18;y<p.y+p.height;y+=(detail==='medium'?36:18))for(let x=p.x+12+(Math.floor(y/18)%2)*8;x<p.x+p.width;x+=28){
                if(['dirt','moon','stone'].includes(motif)){sceneCircle(c,x,y,motif==='moon'?6:3.2,motif==='moon'?'#565c76':'#919890');}
                else if(motif==='lava'){c.strokeStyle='#f48832';c.lineWidth=2;c.beginPath();c.moveTo(x-8,y-5);c.lineTo(x,y);c.lineTo(x-3,y+8);c.stroke();}
                else if(motif==='circuit'){c.strokeStyle='#6bc5d4';c.strokeRect(x-7,y-4,14,8);}
                else if(motif==='candy'){c.fillStyle=(Math.floor(x/28)%2)?'#fff3d0':'#f9b7de';c.fillRect(x,y,9,3);}
                else if(motif==='ice'||motif==='crystal'){c.fillStyle='rgba(217,246,255,.4)';c.beginPath();c.moveTo(x,y-9);c.lineTo(x+8,y);c.lineTo(x,y+6);c.lineTo(x-4,y);c.fill();}
                else if(motif==='roots'){c.strokeStyle='#9c7845';c.beginPath();c.moveTo(x,y-10);c.lineTo(x+6,y+10);c.stroke();}
            }
            c.fillStyle=item.top||(grassy?'#70cf49':'#91a0b4');c.fillRect(p.x,p.y,p.width,grassy?7:5);
            if(grassy){c.fillStyle='#4aa735';for(let x=p.x+3;x<p.x+p.width;x+=12){c.beginPath();c.moveTo(x,p.y+6);c.lineTo(x+4,p.y+12);c.lineTo(x+8,p.y+6);c.fill();}}
            c.restore();
        }
        function themePreview(target,item){const c=target.getContext('2d');if(item.category==='bg')paintScene(c,item,target.width,target.height);else{c.fillStyle='#193246';c.fillRect(0,0,target.width,target.height);paintTerrain(c,{x:0,y:18,width:target.width,height:target.height-18},item);}}
        let lockerThemeFilter='bg';
        function renderLockerThemeFilters(){
            const root=document.getElementById('lockerThemeFilters');root.classList.toggle('hidden',currentLockerTab!=='themes');root.replaceChildren();
            for(const [category,label] of [['bg','Backgrounds'],['plat','Platforms'],['floor','Floors & Spikes']]){
                const button=document.createElement('button');button.className='game-button'+(lockerThemeFilter===category?' accent':'');button.textContent=label;
                button.addEventListener('click',()=>{lockerThemeFilter=category;renderLockerGrid();});root.appendChild(button);
            }
        }

        let editorUndoStack=[],editorRedoStack=[],pendingEditorEdit=null;
        function editorSnapshot(){return JSON.stringify({data:editorData,index:editingLevelIndex});}
        function updateEditorHistoryButtons(){document.getElementById('editorUndoBtn').disabled=!editorUndoStack.length;document.getElementById('editorRedoBtn').disabled=!editorRedoStack.length;}
        function clearEditorHistory(){editorUndoStack=[];editorRedoStack=[];pendingEditorEdit=null;updateEditorHistoryButtons();}
        function beginEditorEdit(){pendingEditorEdit=editorSnapshot();}
        function commitEditorEdit(){
            if(pendingEditorEdit!==null&&pendingEditorEdit!==editorSnapshot()){
                editorUndoStack.push(pendingEditorEdit);if(editorUndoStack.length>100)editorUndoStack.shift();editorRedoStack=[];
            }
            pendingEditorEdit=null;updateEditorHistoryButtons();
        }
        function restoreEditorSnapshot(value){
            const state=JSON.parse(value);editorData=state.data;editingLevelIndex=state.index;isDrawingPlatform=false;pendingEditorEdit=null;
            editorSaveBtn.textContent=editingLevelIndex<0?'Save Level':'Save Changes';
            document.getElementById('editorSaveCopyBtn').classList.toggle('hidden',editingLevelIndex<0);renderEditorCanvas();
        }
        document.getElementById('editorUndoBtn').addEventListener('click',()=>{
            if(!editorUndoStack.length)return;editorRedoStack.push(editorSnapshot());restoreEditorSnapshot(editorUndoStack.pop());editorStatus.textContent='Undid your last edit.';
        });
        document.getElementById('editorRedoBtn').addEventListener('click',()=>{
            if(!editorRedoStack.length)return;editorUndoStack.push(editorSnapshot());restoreEditorSnapshot(editorRedoStack.pop());editorStatus.textContent='Redid your last edit.';
        });

        function selectSettingsTab(name,focus=false) {
            pendingBinding=null;refreshBindings();
            for(const button of document.querySelectorAll('[data-settings-tab]')) {
                const selected=button.dataset.settingsTab===name;
                button.classList.toggle('accent',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
                document.getElementById(button.getAttribute('aria-controls')).classList.toggle('hidden',!selected);
                if(selected&&focus)button.focus();
            }
        }
        document.querySelectorAll('[data-settings-tab]').forEach((button,index)=>{
            button.addEventListener('click',()=>selectSettingsTab(button.dataset.settingsTab));
            button.addEventListener('keydown',event=>{
                const tabs=Array.from(document.querySelectorAll('[data-settings-tab]'));
                let next=index;
                if(event.key==='ArrowRight')next=(index+1)%tabs.length;
                else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
                else if(event.key==='Home')next=0;
                else if(event.key==='End')next=tabs.length-1;
                else return;
                event.preventDefault();selectSettingsTab(tabs[next].dataset.settingsTab,true);
            });
        });

        const levelHighScores = {};
        try {
            const saved=JSON.parse(localStorage.getItem('platdo_level_high_scores')||'{}');
            if(saved&&typeof saved==='object'&&!Array.isArray(saved))for(const [key,value] of Object.entries(saved)) {
                if(/^(campaign|custom):/.test(key)&&Number.isSafeInteger(value)&&value>=0)levelHighScores[key]=value;
            }
        }catch(_){}
        function newLevelId(){return globalThis.crypto?.randomUUID?.() || `level-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
        function ensureCustomLevelIds(){
            let changed=false;const seen=new Set();
            for(const level of customLevels){if(typeof level.id!=='string'||!level.id||seen.has(level.id)){level.id=newLevelId();changed=true;}seen.add(level.id);}
            if(changed)saveCustomLevelsToStorage();
        }
        function getLevelBest(kind,id){return levelHighScores[`${kind}:${id}`]||0;}
        function highScoreTotals(){
            return {
                campaign:LEVELS.reduce((sum,_,index)=>sum+getLevelBest('campaign',index),0),
                custom:customLevels.reduce((sum,level)=>sum+getLevelBest('custom',level.id),0)
            };
        }
        function renderHighScoreTotals(){
            const totals=highScoreTotals();
            document.getElementById('campaignHighScoreTotal').textContent=`$${totals.campaign.toLocaleString()}`;
            document.getElementById('customHighScoreTotal').textContent=`$${totals.custom.toLocaleString()}`;
        }
        function saveLevelRecords(){try{localStorage.setItem('platdo_level_high_scores',JSON.stringify(levelHighScores));return true;}catch(_){return false;}}
        function recordLevelScore(total){
            const key=isCustomLevel?`custom:${customLevels[customLevelIndex]?.id}`:`campaign:${currentLevel}`;
            const previous=levelHighScores[key]||0;
            const improved=total>previous;
            if(improved)levelHighScores[key]=total;
            renderHighScoreTotals();
            return {best:Math.max(previous,total),improved,saved:saveLevelRecords()};
        }
        function deleteSavedLevel(index){
            const level=customLevels[index];
            if(!level||!confirm(`Delete "${level.name || 'Custom Level'}" and its high score? This cannot be undone.`))return;
            const before=customLevels.slice();customLevels.splice(index,1);
            if(!saveCustomLevelsToStorage()){customLevels=before;alert('Could not delete the saved level. Browser storage is unavailable.');return;}
            delete levelHighScores[`custom:${level.id}`];saveLevelRecords();
            if(editingLevelIndex===index){editingLevelIndex=-1;delete editorData.id;editorSaveBtn.textContent='Save Level';document.getElementById('editorSaveCopyBtn').classList.add('hidden');}
            else if(editingLevelIndex>index)editingLevelIndex--;
            if(customLevelIndex===index)customLevelIndex=-1;else if(customLevelIndex>index)customLevelIndex--;
            clearEditorHistory();renderLevelGrid();
        }

        // Hub music is independent of every mini game's audio and save settings.
        const DEFAULT_MENU_MUSIC_VOLUME=25;
        const SELECTOR_MUSIC_GAIN=0.5;
        const selectorMusic=document.getElementById('selectorMusic');
        selectorMusic.volume=DEFAULT_MENU_MUSIC_VOLUME/100*SELECTOR_MUSIC_GAIN;
        function selectorMusicAllowed(){return !document.getElementById('gameHub').hidden&&!document.hidden;}
        function syncSelectorMusic(){
            if(!selectorMusicAllowed()){
                selectorMusic.pause();
                if(document.getElementById('gameHub').hidden)selectorMusic.currentTime=0;
                return;
            }
            if(selectorMusic.paused)selectorMusic.play().catch(()=>{});
        }
        window.addEventListener('pointerdown',syncSelectorMusic);
        window.addEventListener('keydown',syncSelectorMusic);
        document.addEventListener('visibilitychange',syncSelectorMusic);
        new MutationObserver(syncSelectorMusic).observe(document.getElementById('gameHub'),{attributes:true,attributeFilter:['hidden']});

        function showSelectedGame(focus=false) {
            
            window.Platdo?.cityUnlock?.refresh();
            const opening=location.hash==='#platdo',openingDrive=location.hash==='#drive',openingSwing=location.hash==='#swing',openingCity=location.hash==='#city',openingGodCore=location.hash==='#god-core',openingField=location.hash==='#field'||openingGodCore;
            returnToMenu();
            document.getElementById('gameHub').hidden=opening||openingField||openingDrive||openingSwing||openingCity;
            if(openingField)switchFieldGameContext(openingGodCore?'god-core':'field');
            fieldSetVisible(openingField);
            window.PlatdoDrive?.setVisible(openingDrive);
            window.PlatdoSwing?.setVisible(openingSwing);
            window.PlatdoCity?.setVisible(openingCity);
            document.getElementById('platdoGame').hidden=!opening;
            document.body.classList.toggle('hub-open',!opening&&!openingField&&!openingDrive&&!openingSwing&&!openingCity);
            syncSelectorMusic();
            document.title=opening?'PLATDO jump! | PLATDO':openingDrive?'platdo Drive | PLATDO':openingSwing?'Platdo Swing | PLATDO':openingCity?'Platdo City | PLATDO':openingField?fieldGameName()+' | PLATDO':'PLATDO';
            window.scrollTo(0,0);
            if(focus){const target=openingDrive?document.querySelector('#driveRoot .primary'):openingSwing?document.querySelector('#swingRoot button'):openingCity?document.querySelector('#cityRoot button'):document.getElementById(opening?'startPlayBtn':openingField?'fieldPlay':'openPlatdoBtn');target?.focus({preventScroll:true});}
        }
        const miniGameOpenAudio='assets/audio/minigameopenaudio-30f12db9d850.mp3';
        const activeMiniGameOpenSounds=new Set();
        function playMiniGameOpenSound(){
            const sound=new Audio(miniGameOpenAudio);
            activeMiniGameOpenSounds.add(sound);
            const clean=()=>activeMiniGameOpenSounds.delete(sound);
            sound.addEventListener('ended',clean,{once:true});sound.addEventListener('error',clean,{once:true});
            sound.play().catch(clean);
        }
        document.getElementById('openPlatdoBtn').addEventListener('click',()=>{playMiniGameOpenSound();location.hash='platdo';});
        const miniGameHoverAudio='assets/audio/minigamehoveraudio-5d2bdffdef52.mp3';
        const activeMiniGameHoverSounds=new Set();
        function playMiniGameHoverSound(){
            const sound=new Audio(miniGameHoverAudio);activeMiniGameHoverSounds.add(sound);
            const clean=()=>activeMiniGameHoverSounds.delete(sound);
            sound.addEventListener('ended',clean,{once:true});sound.addEventListener('error',clean,{once:true});sound.play().catch(clean);
        }
        document.getElementById('gameHub').addEventListener('pointerover',event=>{
            const tile=event.target.closest('button.hub-tile');
            if(tile&&!tile.disabled&&tile.getAttribute('aria-disabled')!=='true'&&!tile.contains(event.relatedTarget)&&event.pointerType!=='touch')playMiniGameHoverSound();
        });

        document.getElementById('backToGamesBtn').addEventListener('click',()=>{location.hash='';});
        window.addEventListener('hashchange',()=>showSelectedGame(true));

// One durable snapshot supplements the existing individual settings saves.
const FULL_SAVE_KEY='platdo_full_save_v1';
// Explicit ownership list: never clear shared storage or another mini game's saves.
const JUMP_SAVE_KEYS=[FULL_SAVE_KEY,'platdo_audio_v1','platdo_controls_v1',
 'platdo_admin_completed_campaign','platdo_gun_upgrades_v1','platdo_level_high_scores',
 'platformer_custom_levels','platformer_gun_skins'];
function resetAllJumpProgress(){
 // Block queued, interval and unload saves from writing the old state back.
 fullSaveReady=false;
 try{
  for(const key of JUMP_SAVE_KEYS)localStorage.removeItem(key);
 }catch(_){
  showStatusMessage('Reset could not finish because browser storage is blocked.');
  return;
 }
 // Reload initializes every in-memory value, including drafts and admin access.
 location.reload();
}

let fullSaveReady=false,lastFullSave='';
// All future games use Platdo.storage(gameId) and Platdo.frameRate.
// Shared namespace makes site-wide reset include games without a hard-coded list.
const PLATDO_SETTINGS_KEY='platdo:settings:v1';
let resolutionTrial=null;const mainSettings={autoSaveMinutes:5,menuMusicVolume:DEFAULT_MENU_MUSIC_VOLUME,menuMusicMuted:false,resolution:'auto',controlMode:null};
let scheduledSaveTimer=null;
let lastAudibleMenuVolume=DEFAULT_MENU_MUSIC_VOLUME;
function saveMainSettings(){localStorage.setItem(PLATDO_SETTINGS_KEY,JSON.stringify({controlMode:mainSettings.controlMode||Platdo.controls.mode,frameRate:targetFps,resolution:resolutionTrial?resolutionTrial.previous:mainSettings.resolution,autoSaveMinutes:mainSettings.autoSaveMinutes,menuMusicVolume:mainSettings.menuMusicVolume>0?mainSettings.menuMusicVolume:lastAudibleMenuVolume}));}
function schedulePeriodicSave(){clearInterval(scheduledSaveTimer);scheduledSaveTimer=setInterval(()=>Platdo.saveProgress(),mainSettings.autoSaveMinutes*60000);}
const PLATDO_REGISTRY_KEY='platdo:registered-save-keys:v1';
const Platdo=window.Platdo={
 playGameOpenSound:playMiniGameOpenSound,
 saveProgress(){
  if(!fullSaveReady)return false;
  try{saveMainSettings();window.dispatchEvent(new Event('platdo:save'));return saveFullProgress();}catch(_){document.getElementById('mainSaveStatus').textContent='Could not save. Browser storage is unavailable.';return false;}
 },
 get resolution(){return mainSettings.resolution;},
 renderSize(width,height){width=Math.max(1,width);height=Math.max(1,height);let scale=Math.min(devicePixelRatio||1,2,Math.sqrt(8294400/(width*height)));if(mainSettings.resolution!=='auto'){if(mainSettings.resolution.includes('x')){const [w,h]=mainSettings.resolution.split('x').map(Number);scale=Math.min(scale,w/width,h/height);}else{const cap=Number(mainSettings.resolution);scale=Math.min(scale,cap/height,(cap*16/9)/width);}}return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};},
 get frameRate(){return targetFps;},
 setFrameRate(value){
  targetFps=[30,60,120,240].includes(value)?value:60;
  saveMainSettings();
  document.getElementById('fpsSelect').value=targetFps;
  window.dispatchEvent(new CustomEvent('platdo:settingschange',{detail:{frameRate:targetFps}}));
 },
 registerSaveKeys(keys){
  let registered=[];try{registered=JSON.parse(localStorage.getItem(PLATDO_REGISTRY_KEY)||'[]');}catch(_){}
  localStorage.setItem(PLATDO_REGISTRY_KEY,JSON.stringify([...new Set([...registered,...keys])]));
 },
 storage(gameId){
  if(!/^[a-z0-9-]+$/.test(gameId))throw new Error('Invalid mini-game ID');
  const prefix='platdo:game:'+gameId+':';
  return {get:key=>localStorage.getItem(prefix+key),set:(key,value)=>localStorage.setItem(prefix+key,value),remove:key=>localStorage.removeItem(prefix+key)};
 },
 resetAllProgress(){beginResetFlow();}

};
PlatdoControls.install(Platdo,{save(mode){mainSettings.controlMode=mode;saveMainSettings();}});
PlatdoGraphics.install(Platdo);
document.getElementById('controlModeSelect').addEventListener('change',event=>{document.getElementById('controlModeStatus').textContent='Your choice is saved on this browser.';Platdo.controls.setMode(event.target.value);});
function loadMainSettings(legacy){
 let settings=null;try{settings=JSON.parse(localStorage.getItem(PLATDO_SETTINGS_KEY)||'null');}catch(_){}
 mainSettings.controlMode=['pc','mobile'].includes(settings?.controlMode)?settings.controlMode:Platdo.controls.defaultMode;
 Platdo.controls.setMode(mainSettings.controlMode,{persist:false});
 mainSettings.autoSaveMinutes=Number.isInteger(settings?.autoSaveMinutes)&&settings.autoSaveMinutes>=1&&settings.autoSaveMinutes<=10?settings.autoSaveMinutes:5;
 mainSettings.resolution=['auto','2160','1440','1080','900','720','540','360','180','64x64','32x32','10x10'].includes(settings?.resolution)?settings.resolution:'auto';
 document.getElementById('resolutionSelect').value=mainSettings.resolution;
 mainSettings.menuMusicMuted=false; // Quick mute applies only to this page session.
 mainSettings.menuMusicVolume=Number.isFinite(settings?.menuMusicVolume)&&settings.menuMusicVolume>0?Math.min(100,settings.menuMusicVolume):DEFAULT_MENU_MUSIC_VOLUME;
 lastAudibleMenuVolume=mainSettings.menuMusicVolume;
 document.getElementById('autoSaveSelect').value=mainSettings.autoSaveMinutes;
 document.getElementById('menuMusicVolume').value=mainSettings.menuMusicVolume;
 document.getElementById('menuMusicValue').textContent=mainSettings.menuMusicVolume+'%';
 applyMenuMusicSettings();
 schedulePeriodicSave();
 Platdo.setFrameRate(settings?.frameRate??legacy?.targetFps??60);
 Platdo.registerSaveKeys(JUMP_SAVE_KEYS);
}
const mainTabs=[...document.querySelectorAll('[data-main-tab]')];
function selectMainTab(button){if(button.dataset.mainTab==='graphics')Platdo.graphics.mountGlobal('#main-graphics-panel');for(const tab of mainTabs){const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;tab.style.background=active?'#dbeafe':'white';document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;}}
mainTabs.forEach((tab,index)=>{tab.addEventListener('click',()=>selectMainTab(tab));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?mainTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+mainTabs.length)%mainTabs.length;selectMainTab(mainTabs[next]);mainTabs[next].focus();});});selectMainTab(mainTabs[0]);
document.getElementById('manualSaveBtn').addEventListener('click',()=>{if(Platdo.saveProgress())document.getElementById('mainSaveStatus').textContent='Progress saved at '+new Date().toLocaleTimeString()+'.';});
const resolutionDialog=document.createElement('dialog');resolutionDialog.style.cssText='padding:28px;border-radius:12px;max-width:420px;background:#14271f;color:white';resolutionDialog.innerHTML='<h2 style="font-size:24px">Keep this resolution?</h2><p id="resolutionCountdown"></p><button id="resolutionKeep" style="padding:12px;margin:12px;border:1px solid #aee47e">Yes, I’m sure</button><button id="resolutionRevert" style="padding:12px;border:1px solid #aaa">Revert</button>';document.body.append(resolutionDialog);
function finishResolutionTrial(keep){if(!resolutionTrial)return;const previous=resolutionTrial.previous;clearInterval(resolutionTrial.timer);resolutionTrial=null;if(!keep)mainSettings.resolution=previous;document.getElementById('resolutionSelect').value=mainSettings.resolution;resolutionDialog.close();saveMainSettings();window.dispatchEvent(new Event('platdo:settingschange'));}
document.getElementById('resolutionKeep').onclick=()=>finishResolutionTrial(true);document.getElementById('resolutionRevert').onclick=()=>finishResolutionTrial(false);resolutionDialog.addEventListener('cancel',e=>{e.preventDefault();finishResolutionTrial(false);});
document.getElementById('resolutionSelect').addEventListener('change',event=>{const selected=event.target.value;if(resolutionTrial)finishResolutionTrial(false);resolutionTrial={previous:mainSettings.resolution,deadline:Date.now()+10000,timer:null};mainSettings.resolution=selected;window.dispatchEvent(new Event('platdo:settingschange'));function tick(){if(!resolutionTrial)return;const seconds=Math.max(0,Math.ceil((resolutionTrial.deadline-Date.now())/1000));document.getElementById('resolutionCountdown').textContent='Reverting in '+seconds+' seconds unless you confirm.';if(!seconds)finishResolutionTrial(false);}tick();resolutionTrial.timer=setInterval(tick,100);resolutionDialog.showModal();});
document.getElementById('autoSaveSelect').addEventListener('change',event=>{mainSettings.autoSaveMinutes=Math.max(1,Math.min(10,Number(event.target.value)||5));saveMainSettings();schedulePeriodicSave();});
function applyMenuMusicSettings(){
 if(mainSettings.menuMusicVolume>0)lastAudibleMenuVolume=mainSettings.menuMusicVolume;
 selectorMusic.volume=mainSettings.menuMusicVolume/100*SELECTOR_MUSIC_GAIN;
 selectorMusic.muted=mainSettings.menuMusicMuted;
 const muted=mainSettings.menuMusicMuted||mainSettings.menuMusicVolume===0;
 const button=document.getElementById('quickMusicMuteBtn');
 button.textContent=muted?'🔇 Music Off':'🔊 Music On';button.setAttribute('aria-pressed',String(muted));button.setAttribute('aria-label',muted?'Unmute menu music':'Mute menu music');
}
document.getElementById('quickMusicMuteBtn').addEventListener('click',()=>{
 const muted=mainSettings.menuMusicMuted||mainSettings.menuMusicVolume===0;
 mainSettings.menuMusicMuted=!muted;
 if(muted&&mainSettings.menuMusicVolume===0){mainSettings.menuMusicVolume=lastAudibleMenuVolume;document.getElementById('menuMusicVolume').value=mainSettings.menuMusicVolume;document.getElementById('menuMusicValue').textContent=mainSettings.menuMusicVolume+'%';}
 applyMenuMusicSettings();saveMainSettings();
});
document.getElementById('menuMusicVolume').addEventListener('input',event=>{mainSettings.menuMusicVolume=Number(event.target.value);if(mainSettings.menuMusicVolume>0)mainSettings.menuMusicMuted=false;applyMenuMusicSettings();document.getElementById('menuMusicValue').textContent=mainSettings.menuMusicVolume+'%';saveMainSettings();});
const mainSettingsDialog=document.getElementById('mainSettingsDialog');
document.getElementById('mainSettingsBtn').addEventListener('click',()=>mainSettingsDialog.showModal());
document.getElementById('closeMainSettingsBtn').addEventListener('click',()=>mainSettingsDialog.close());
document.getElementById('resetAllGamesBtn').addEventListener('click',()=>Platdo.resetAllProgress());

// Reset challenges are isolated from actual game progress and scoring.
const resetGameCatalog={'platdo-jump':{name:'PLATDO jump!',keys:JUMP_SAVE_KEYS}};
Platdo.registerGame=(id,name,keys=[])=>{
 if(!/^[a-z0-9-]+$/.test(id))throw new Error('Invalid mini-game ID');
 resetGameCatalog[id]={name,keys};Platdo.registerSaveKeys(keys);
};
// City is included for everyone. GOD CORE victory validation still owns its own records.
function isGodCoreVictory(run){return run?.completed===true&&Number.isFinite(run.seconds)&&run.seconds>0;}
Platdo.cityUnlock=(()=>{
 let tile=null;
 function refresh(){
  if(tile){tile.disabled=false;tile.classList.remove('city-locked');tile.setAttribute('aria-label','Open Platdo City');tile.title='Open Platdo City';tile.querySelector('.city-lock')?.remove();}
  return true;
 }
 function register(button){
  if(tile)return;
  tile=button;const grid=document.querySelector('.hub-grid');if(!grid)return;
  const placeholder=grid.querySelector('div.hub-tile[aria-label="Upcoming mini game"]');
  if(placeholder)placeholder.replaceWith(tile);else grid.append(tile);
  refresh();
 }
 return{get unlocked(){return true;},refresh,register};
})();

const originalGameStorage=Platdo.storage;
Platdo.storage=id=>{if(!['main-settings','main-controls'].includes(id)&&!resetGameCatalog[id])resetGameCatalog[id]={name:id,keys:[]};return originalGameStorage(id);};
let resetStep='',resetDeadline=0,resetTimer=null,resetSelected=new Set(),resetCourse=null,resetFrame=0,resetLastTime=0,resetAccumulator=0;
const resetOverlay=document.createElement('div');resetOverlay.id='resetFlow';resetOverlay.hidden=true;
resetOverlay.style.cssText='position:fixed;inset:0;z-index:12000;background:#f1f5f9;color:#172033;overflow:auto;padding:24px;font-family:Arial,sans-serif';
resetOverlay.innerHTML='<div style="max-width:900px;margin:auto"><button id="resetBack" style="padding:12px;cursor:pointer">← Back to Games</button><h1 style="font-size:28px;margin:20px 0">Reset game progress</h1><div id="resetContent"></div></div>';
document.body.append(resetOverlay);
const resetContent=document.getElementById('resetContent');
function stopResetChallenge(){cancelAnimationFrame(resetFrame);resetFrame=0;resetCourse=null;clearInterval(resetTimer);resetTimer=null;}
function cancelResetFlow(){
 stopResetChallenge();resetStep='';resetSelected.clear();resetOverlay.hidden=true;mainSettingsDialog.close();
 history.replaceState(null,'',location.pathname+location.search);showSelectedGame();
 document.getElementById('openPlatdoBtn').focus();
}
document.getElementById('resetBack').onclick=cancelResetFlow;
window.addEventListener('keydown',event=>{
 if(resetOverlay.hidden)return;
 event.stopImmediatePropagation();
 if(event.code==='Escape'){event.preventDefault();cancelResetFlow();return;}
 if(resetCourse){if(['Space','ArrowUp','ArrowLeft','ArrowRight','KeyW','KeyA','KeyD'].includes(event.code))event.preventDefault();resetCourse.keys.add(event.code);}
},true);
window.addEventListener('keyup',event=>{if(resetOverlay.hidden)return;event.stopImmediatePropagation();resetCourse?.keys.delete(event.code);},true);
window.addEventListener('blur',()=>resetCourse?.keys.clear());
function resetConfirm(step,message,next,timed=false){
 clearInterval(resetTimer);resetStep=step;
 resetContent.innerHTML='<h2 style="font-size:24px;margin:20px 0" id="resetQuestion"></h2><p id="resetCountdown" role="status"></p><div style="display:flex;gap:16px;margin:24px 0"><button id="resetYes" style="background:#b91c1c;color:white;padding:14px 28px;border-radius:8px;cursor:pointer">Yes</button><button id="resetNo" style="padding:14px 28px;border:1px solid #aaa;border-radius:8px;cursor:pointer">No</button></div><p>Nothing is erased until the final confirmation after both challenges. No, Escape, or Back cancels everything.</p>';
 document.getElementById('resetQuestion').textContent=message;
 document.getElementById('resetNo').onclick=cancelResetFlow;
 document.getElementById('resetYes').onclick=()=>{if(timed&&Date.now()>=resetDeadline){cancelResetFlow();return;}clearInterval(resetTimer);next();};
 if(timed){resetDeadline=Date.now()+10000;const tick=()=>{const left=Math.ceil((resetDeadline-Date.now())/1000);if(left<=0){cancelResetFlow();return;}document.getElementById('resetCountdown').textContent='Are you sure? Choose Yes within '+left+' seconds, or this reset will be canceled.';};tick();resetTimer=setInterval(tick,100);}
 document.getElementById('resetNo').focus();
}
function beginResetFlow(){
 mainSettingsDialog.close();resetSelected.clear();resetOverlay.hidden=false;
 resetConfirm('first','Are you sure you want to reset game progress?',()=>resetConfirm('timed','Are you sure?',()=>startResetChallenge(1),true));
}
function showResetGameSelection(){
 stopResetChallenge();resetStep='select';
 // Discover namespaced saves even if a future game has not been opened this session.
 for(let i=0;i<localStorage.length;i++){const match=/^platdo:game:([^:]+):/.exec(localStorage.key(i));if(match&&!['main-settings','main-controls'].includes(match[1])&&!resetGameCatalog[match[1]])resetGameCatalog[match[1]]={name:match[1],keys:[]};}
 resetContent.innerHTML='<h2 style="font-size:24px;margin:20px 0">Choose the games to erase</h2><p>Only selected games will be reset. Main settings and unselected games will stay unchanged.</p><div id="resetGameList" style="display:grid;gap:16px;margin:24px 0"></div><button id="resetSelectedBtn" disabled style="background:#b91c1c;color:white;padding:14px;border-radius:8px;cursor:pointer">Reset Progress</button>';
 for(const [id,game] of Object.entries(resetGameCatalog)){
  const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=id;input.style.marginRight='12px';input.onchange=()=>{if(input.checked)resetSelected.add(id);else resetSelected.delete(id);document.getElementById('resetSelectedBtn').disabled=resetSelected.size===0;};label.append(input,document.createTextNode(game.name));document.getElementById('resetGameList').append(label);
 }
 const questions=['Are you sure?','Are you sure your sure?','Are you sure your sure you sure your sure?','Are you sure your sure you sure your sure your sure you sure your sureyour sure you sure your sureyour sure you sure your sure?'];
 function ask(index){if(index===questions.length){startResetChallenge(2);return;}resetConfirm('selected-'+index,questions[index],()=>ask(index+1));}
 document.getElementById('resetSelectedBtn').onclick=()=>{if(resetSelected.size)ask(0);};
}
function startResetChallenge(round){
 stopResetChallenge();resetStep='challenge-'+round;
 resetContent.innerHTML='<h2 style="font-size:24px">Reset challenge '+round+' of 2</h2><p>Walk and jump up the platforms to the flag. Falling is safe—walk back to the start and try again. Move: A/D or ←/→. Jump: Space, W or ↑.</p><canvas id="resetChallengeCanvas" width="900" height="540" style="width:100%;display:block;margin:16px 0;border-radius:12px;background:#87ceeb"></canvas><div style="display:flex;gap:14px"><button data-reset-control="ArrowLeft" style="padding:16px">← Left</button><button data-reset-control="ArrowRight" style="padding:16px">Right →</button><button data-reset-control="Space" style="padding:16px">Jump</button></div>';
 const platforms=Array.from({length:9},(_,i)=>({x:40+i*91,y:430-i*39,w:66,h:16}));
 if(round===2)for(const platform of platforms)platform.x=900-platform.x-platform.w;
 const start=round===1?20:856;
 resetCourse={round,platforms,keys:new Set(),player:{x:start,y:470,w:24,h:30,vy:0,grounded:true},flag:{x:platforms[8].x+35,y:platforms[8].y-70,w:18,h:70},ctx:document.getElementById('resetChallengeCanvas').getContext('2d')};
 for(const button of resetContent.querySelectorAll('[data-reset-control]')){
  button.style.touchAction='none';button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);resetCourse?.keys.add(button.dataset.resetControl);};
  const release=()=>resetCourse?.keys.delete(button.dataset.resetControl);button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
 }
 resetLastTime=0;resetAccumulator=0;drawResetChallenge();resetFrame=requestAnimationFrame(resetChallengeLoop);
}
function stepResetChallenge(){
 const c=resetCourse;if(!c)return;const p=c.player;
 const left=c.keys.has('ArrowLeft')||c.keys.has('KeyA'),right=c.keys.has('ArrowRight')||c.keys.has('KeyD');
 p.x=Math.max(0,Math.min(900-p.w,p.x+(Number(right)-Number(left))*3.5));
 if(p.grounded&&(c.keys.has('Space')||c.keys.has('KeyW')||c.keys.has('ArrowUp'))){p.vy=-10.8;p.grounded=false;}
 const previousBottom=p.y+p.h;p.vy+=.5;p.y+=p.vy;p.grounded=false;
 for(const platform of [...c.platforms,{x:0,y:500,w:900,h:40}]){
  if(p.vy>=0&&previousBottom<=platform.y&&p.y+p.h>=platform.y&&p.x+p.w>platform.x&&p.x<platform.x+platform.w){p.y=platform.y-p.h;p.vy=0;p.grounded=true;}
 }
 const f=c.flag;if(p.x+p.w>f.x&&p.x<f.x+f.w&&p.y+p.h>f.y&&p.y<f.y+f.h){const round=c.round;stopResetChallenge();if(round===1)showResetGameSelection();else resetConfirm('final','Are you sure? Erase all progress for: '+[...resetSelected].map(id=>resetGameCatalog[id].name).join(', ')+'?',eraseSelectedGameProgress);}
}
function drawResetChallenge(){
 const c=resetCourse;if(!c)return;const x=c.ctx;x.fillStyle='#8ed5ff';x.fillRect(0,0,900,540);
 x.fillStyle='white';for(const cx of [110,400,680]){x.beginPath();x.ellipse(cx,55,65,22,0,0,Math.PI*2);x.fill();}
 x.fillStyle='#84603b';x.fillRect(0,500,900,40);x.fillStyle='#4fbd47';x.fillRect(0,500,900,8);
 for(const p of c.platforms){x.fillStyle='#84603b';x.fillRect(p.x,p.y,p.w,p.h);x.fillStyle='#4fbd47';x.fillRect(p.x,p.y,p.w,5);}
 const f=c.flag;x.fillStyle='#334155';x.fillRect(f.x,f.y,4,f.h);x.fillStyle='#facc15';x.fillRect(f.x+4,f.y,28,22);
 x.fillStyle='#4f66ff';x.fillRect(c.player.x,c.player.y,c.player.w,c.player.h);x.fillStyle='white';x.fillRect(c.player.x+15,c.player.y+6,6,6);
}
function resetChallengeLoop(time){if(!resetCourse)return;if(resetLastTime)resetAccumulator+=Math.min(100,time-resetLastTime);resetLastTime=time;while(resetAccumulator>=1000/60&&resetCourse){stepResetChallenge();resetAccumulator-=1000/60;}drawResetChallenge();if(resetCourse)resetFrame=requestAnimationFrame(resetChallengeLoop);}
function eraseSelectedGameProgress(){
 if(resetStep!=='final'||!resetSelected.size)return;
 fullSaveReady=false;stopResetChallenge();window.dispatchEvent(new Event('platdo:beforereset'));
 try{
  const keys=new Set();for(const id of resetSelected){for(const key of resetGameCatalog[id].keys)keys.add(key);const prefix='platdo:game:'+id+':';for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(prefix))keys.add(key);}}
  for(const key of keys)localStorage.removeItem(key);
 }catch(_){resetContent.textContent='Reset could not finish because browser storage is unavailable. Use Back to return.';return;}
 history.replaceState(null,'',location.pathname+location.search);location.reload();
}
Platdo.resetAllProgress=beginResetFlow;

function fullSaveSnapshot(){
 return {version:1,currentLevel,maxUnlockedLevel,score,inventory,magazines:{...magazines},reloadRemaining:{...reloadRemaining},equippedWeapon,infiniteAmmo,
 unlockedColors,equippedColorId,unlockedTrails,equippedTrailId,unlockedThemes,equippedBgId,equippedPlatId,equippedFloorId,ownsGoldAK,equippedAKSkin,
 soundEnabled,audioSettings,bindings,weaponOrder,gunUpgrades,customLevels,levelHighScores,
 editor:{data:editorData,index:editingLevelIndex,undo:editorUndoStack,redo:editorRedoStack},
 editorOpen:!editorModal.classList.contains('hidden'),
 lootRolls:[...lootRolls],
 run:gameStarted?{isCustomLevel,customId:customLevels[customLevelIndex]?.id,testingEditor,player:{...player},platforms,coins,spikes,enemies,flag,
 levelStartScore,levelStartInventory,runEarned,isSlidingFlag,flagSlideTargetY,flagClothY,flagMultiplier,flagBonusCash,bullets,loot,facing,fireCooldown,nukeFlash}:null};
}
function saveFullProgress(){
 if(!fullSaveReady)return false;
 try{const value=JSON.stringify(fullSaveSnapshot());if(value!==lastFullSave){localStorage.setItem(FULL_SAVE_KEY,value);lastFullSave=value;}return true;}catch(_){showStatusMessage('Save unavailable: browser storage is full or blocked.');document.getElementById('mainSaveStatus').textContent='Could not save. Browser storage is unavailable.';return false;}
}
function readFullProgress(){
 try{const saved=JSON.parse(localStorage.getItem(FULL_SAVE_KEY)||'null');return saved?.version===1?saved:null;}catch(_){return null;}
}
function restoreFullProgress(saved){
 if(!saved)return;
 const number=(v,fallback,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
 currentLevel=Math.floor(number(saved.currentLevel,0,0,LEVELS.length-1));
 maxUnlockedLevel=Math.floor(number(saved.maxUnlockedLevel,0,0,LEVELS.length));score=number(saved.score,0);
 for(const id of Object.keys(WEAPONS))inventory[id]=Math.floor(number(saved.inventory?.[id],0));
 infiniteAmmo=saved.infiniteAmmo===true;
 equippedWeapon=['none',...Object.keys(WEAPONS)].includes(saved.equippedWeapon)?saved.equippedWeapon:'none';
 const owned=(values,items,defaults)=>Array.from(new Set([...defaults,...(Array.isArray(values)?values:[]).filter(id=>items.some(item=>item.id===id))]));
 unlockedColors=owned(saved.unlockedColors,SHOP_ITEMS,['hero_blue']);unlockedTrails=owned(saved.unlockedTrails,TRAIL_ITEMS,['none']);unlockedThemes=owned(saved.unlockedThemes,THEME_ITEMS,['bg_dark','plat_slate','floor_classic']);
 equippedColorId=unlockedColors.includes(saved.equippedColorId)?saved.equippedColorId:'hero_blue';
 const color=SHOP_ITEMS.find(item=>item.id===equippedColorId);playerColors={body:color.body,outline:color.outline};
 equippedTrailId=unlockedTrails.includes(saved.equippedTrailId)?saved.equippedTrailId:'none';
 const theme=(id,category,fallback)=>unlockedThemes.includes(id)&&THEME_ITEMS.some(t=>t.id===id&&t.category===category)?id:fallback;
 equippedBgId=theme(saved.equippedBgId,'bg','bg_dark');equippedPlatId=theme(saved.equippedPlatId,'plat','plat_slate');equippedFloorId=theme(saved.equippedFloorId,'floor','floor_classic');
 ownsGoldAK=saved.ownsGoldAK===true;equippedAKSkin=ownsGoldAK&&saved.equippedAKSkin==='gold'?'gold':'default';
 soundEnabled=saved.soundEnabled!==false;
 for(const id of Object.keys(gunUpgrades)){
  const g=saved.gunUpgrades?.[id];if(g){gunUpgrades[id].recoil=Math.floor(number(g.recoil,0,0,3));gunUpgrades[id].mag=Math.floor(number(g.mag,0,0,3));gunUpgrades[id].selected=Math.floor(number(g.selected,0,0,gunUpgrades[id].mag));}
 }
 for(const key of ['environment','sfx','weapons','music'])audioSettings[key]=number(saved.audioSettings?.[key],audioSettings[key],0,100);
 audioSettings.advanced=saved.audioSettings?.advanced===true;
 for(const id of Object.keys(audioSettings.individual))audioSettings.individual[id]=number(saved.audioSettings?.individual?.[id],100,0,100);
 for(const action of Object.keys(bindings))if(Array.isArray(saved.bindings?.[action]))bindings[action]=[...new Set(saved.bindings[action].filter(code=>typeof code==='string'&&code!=='Escape'&&code.length<50))].slice(0,5);
 if(Array.isArray(saved.weaponOrder)&&saved.weaponOrder.length===5&&new Set(saved.weaponOrder).size===5&&saved.weaponOrder.every(id=>weaponOrder.includes(id)))weaponOrder=saved.weaponOrder;
 if(Array.isArray(saved.customLevels)&&saved.customLevels.every(l=>l&&Array.isArray(l.platforms)))customLevels=saved.customLevels;
 if(saved.levelHighScores&&typeof saved.levelHighScores==='object'){
  for(const key of Object.keys(levelHighScores))delete levelHighScores[key];
  for(const [key,value] of Object.entries(saved.levelHighScores))if(/^(campaign|custom):/.test(key)&&Number.isSafeInteger(value)&&value>=0)levelHighScores[key]=value;
 }
 if(saved.editor?.data&&Array.isArray(saved.editor.data.platforms)){
  editorData=saved.editor.data;editingLevelIndex=Number.isInteger(saved.editor.index)&&saved.editor.index>=0&&saved.editor.index<customLevels.length?saved.editor.index:-1;
  const history=values=>Array.isArray(values)?values.filter(value=>{try{const data=JSON.parse(value);return Array.isArray(data.data.platforms)&&Number.isInteger(data.index);}catch(_){return false;}}).slice(-100):[];
  editorUndoStack=history(saved.editor.undo);editorRedoStack=history(saved.editor.redo);
  editorSaveBtn.textContent=editingLevelIndex>=0?'Save Changes':'Save Level';document.getElementById('editorSaveCopyBtn').classList.toggle('hidden',editingLevelIndex<0);updateEditorHistoryButtons();
 }
 lootRolls.clear();if(Array.isArray(saved.lootRolls))for(const entry of saved.lootRolls)if(Array.isArray(entry)&&typeof entry[0]==='string'&&Array.isArray(entry[1]))lootRolls.set(entry[0],entry[1]);
 document.getElementById('fpsSelect').value=targetFps;soundToggleBtn.textContent=soundEnabled?'🔊':'🔇';
 const button=document.getElementById('adminInfiniteAmmoBtn');button.textContent=`Infinite ammo: ${infiniteAmmo?'ON':'OFF'}`;button.setAttribute('aria-pressed',String(infiniteAmmo));
}
function restoreSavedRun(saved){
 const run=saved?.run;
 if(run&&run.player&&[run.platforms,run.coins,run.spikes,run.enemies,run.bullets,run.loot].every(Array.isArray)&&run.flag&&Number.isFinite(run.player.x)&&Number.isFinite(run.player.y)){
  const customIndex=customLevels.findIndex(level=>level.id===run.customId);
  if(run.isCustomLevel&&!run.testingEditor&&customIndex<0)return;
  if(run.isCustomLevel)loadCustomLevel(run.testingEditor?-1:customIndex,run.testingEditor?editorData:null);
  Object.assign(player,run.player);platforms=run.platforms;coins=run.coins;spikes=run.spikes;enemies=run.enemies;flag=run.flag;
  levelStartScore=run.levelStartScore;levelStartInventory={...run.levelStartInventory};runEarned=run.runEarned;
  isSlidingFlag=run.isSlidingFlag===true;flagSlideTargetY=run.flagSlideTargetY;flagClothY=run.flagClothY;flagMultiplier=run.flagMultiplier;flagBonusCash=run.flagBonusCash;
  bullets=run.bullets;loot=run.loot;facing=run.facing;fireCooldown=run.fireCooldown;nukeFlash=run.nukeFlash;
  for(const id of Object.keys(magazines)){magazines[id]=Math.max(0,Math.min(inventory[id],magazineCapacity(id),saved.magazines?.[id]||0));reloadRemaining[id]=Math.max(0,Math.min(RELOAD_FRAMES,saved.reloadRemaining?.[id]||0));}
  history.replaceState(null,'','#platdo');document.getElementById('gameHub').hidden=true;document.getElementById('platdoGame').hidden=false;document.body.classList.remove('hub-open');document.title='PLATDO jump! | PLATDO';
  titleOverlay.classList.add('hidden');gameStarted=true;setPaused(true);showStatusMessage('Progress restored. Resume when you are ready.');
 }else if(saved?.editorOpen){
  history.replaceState(null,'','#platdo');document.getElementById('gameHub').hidden=true;document.getElementById('platdoGame').hidden=false;document.body.classList.remove('hub-open');editorModal.classList.remove('hidden');renderEditorCanvas();
 }
}
window.addEventListener('pagehide',saveFullProgress);
window.addEventListener('beforeunload',saveFullProgress);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveFullProgress();});
for(const event of ['click','change','input','keyup','pointerup'])window.addEventListener(event,()=>queueMicrotask(saveFullProgress));
let pendingProgressSave=null;
function queueProgressSave(){if(!fullSaveReady||pendingProgressSave!==null)return;pendingProgressSave=setTimeout(()=>{pendingProgressSave=null;saveFullProgress();},200);}
window.addEventListener('platdo:beforereset',()=>{clearInterval(scheduledSaveTimer);clearTimeout(pendingProgressSave);});

// code PLATDO: a self-contained first-person grass field, using WebGL.
Platdo.registerGame('field','code PLATDO');
Platdo.registerGame('god-core','platdo god core');
let fieldGameIdentity='field';
let fieldStorage=Platdo.storage(fieldGameIdentity);
const fieldGameProfiles=new Map();
function fieldIsGodCore(){return fieldGameIdentity==='god-core';}
function fieldGameName(){return fieldIsGodCore()?'platdo god core':'code PLATDO';}

const fieldTargetHitAudio='assets/audio/fieldtargethitaudio-f9ba4c73c85d.mp3';
const fieldWaveAudio='assets/audio/fieldwaveaudio-f0f633a5cbb8.mp3';
let fieldAudio={basic:{weapons:100,environment:100,sfx:100},advanced:{},custom:false};try{const a=JSON.parse(fieldStorage.get('audio')||'null');if(a){for(const k in fieldAudio.basic)if(Number.isFinite(a.basic?.[k]))fieldAudio.basic[k]=Math.max(0,Math.min(100,a.basic[k]));fieldAudio.advanced=a.advanced||{};if(!Number.isFinite(fieldAudio.advanced.normalPistol)&&Number.isFinite(fieldAudio.advanced.pistol))fieldAudio.advanced.normalPistol=Math.max(0,Math.min(100,fieldAudio.advanced.pistol));fieldAudio.custom=a.custom===true;}}catch(_){}
let fieldRun=null,fieldRuns=[],fieldRunClockLast=null,fieldRunCheckpointAt=0,fieldRunPendingSave=null,fieldRunCheckpointTimer=null,fieldRunHistoryDirty=false,fieldRunSaveError='',fieldRunFirstShot=0;const fieldRunHitIds=new Set();
let fieldMode="normal",fieldEnemy=null,fieldDyingEnemy=null,fieldPlayerHealth=100,fieldEnemyRespawn=0,fieldCombatMessage="",fieldCombatMessageTime=0;const fieldEnemyShots=[];
let fieldPractice=false,fieldTarget=null,fieldWave=1,fieldWaveHits=0,fieldPracticeTime=0,fieldSpawnDelay=0,fieldLastTarget=null;
const fieldMaps={grass:{name:'Open Field',index:0},dunes:{name:'Golden Dunes',index:1},snow:{name:'Snowfield',index:2},island:{name:'Island',index:3},night:{name:'Night Meadow',index:4}};
let fieldSelectedMap='grass',fieldPreviewMap=null,fieldLookSensitivity=1,fieldClockFormat='12h';
const fieldHurtAudio="assets/audio/fieldhurtaudio-c8f36c1583e1.mp3";
const fieldEnemyShotAudio="assets/audio/fieldenemyshotaudio-1a547a9ca019.mp3";
const fieldRetroEnemyImage=new Image();fieldRetroEnemyImage.src='assets/images/fieldretroenemyimage-7970eda84a6d.png';
const fieldRetroLaserImage=new Image();fieldRetroLaserImage.src='assets/images/fieldretrolaserimage-dbe17729bf97.png';
let fieldRetroPixels=null;fieldRetroEnemyImage.onload=()=>{const canvas=document.createElement('canvas');canvas.width=fieldRetroEnemyImage.naturalWidth;canvas.height=fieldRetroEnemyImage.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(fieldRetroEnemyImage,0,0);fieldRetroPixels=ctx.getImageData(0,0,canvas.width,canvas.height);};
const fieldPlaylists={retro:[{"id": "0", "title": "retro 1", "src": "assets/audio/fieldplaylists-bb0a386d1496.mp3"}, {"id": "1", "title": "freesound_community-025270_pixel-song-4-72676", "src": "assets/audio/audio-a24ac2fa9870.mp3"}, {"id": "2", "title": "freesound_community-026491_pixel-song-8-72675", "src": "assets/audio/audio-d740b8d00e95.mp3"}, {"id": "3", "title": "freesound_community-my-first-song-60886", "src": "assets/audio/audio-3acdf0fade96.mp3"}, {"id": "4", "title": "c0mp0s3r69-free-boss-fight-loop-575312", "src": "assets/audio/audio-68d3b0d18e9b.mp3"}, {"id": "5", "title": "freesound_community-8-bit-heaven-26287", "src": "assets/audio/audio-3e7b96a421ba.mp3"}],normal:[]};const fieldLobbyTrack={"id": "lobby", "title": "Only in the Retro lobby", "src": "assets/audio/fieldlobbytrack-4f2a75bf2608.mp3"};
let fieldMusicSettings={enabled:true,volume:100,skip:{retro:[],normal:[]},index:{retro:0,normal:0}};try{const saved=JSON.parse(fieldStorage.get('music')||'null');if(saved){fieldMusicSettings.enabled=saved.enabled!==false;fieldMusicSettings.volume=Math.max(0,Math.min(100,(Number.isFinite(Number(saved.volume))?Number(saved.volume):100)));for(const mode of ['retro','normal']){fieldMusicSettings.skip[mode]=Array.isArray(saved.skip?.[mode])?saved.skip[mode]:[];fieldMusicSettings.index[mode]=Number(saved.index?.[mode])||0;}}}catch(_){}
const fieldRetroMusic=new Audio();let fieldCurrentTrack=null,fieldMusicContext='',fieldMusicPausedByUser=false;
// GOD CORE has its own mode identity and history; its initial rules share Retro.
function fieldIsRetroMode(mode=fieldMode){return mode==='retro'||mode==='retro-story';}
function fieldModeLabel(mode=fieldMode,friendly=false){return mode==='practice'?'Practice':mode==='retro-story'?'GOD CORE':mode==='retro'?'Retro':mode==='explore'?'Explore':mode==='tutorial'?'Tutorial':friendly?'Friendly':'Normal';}
const godCoreMusicTracks=[];
function fieldMusicMode(){return fieldIsGodCore()?'god-core':fieldIsRetroMode()?'retro':'normal';}
function fieldMusicTracks(){const mode=fieldMusicMode();return (fieldIsGodCore()?godCoreMusicTracks:fieldPlaylists[mode]).filter(t=>!(fieldMusicSettings.skip[mode]||[]).includes(t.id));}
function saveFieldMusic(){if(fieldSaving)fieldStorage.set('music',JSON.stringify(fieldMusicSettings));}
function syncFieldRetroMusic(){syncGodCorePowerAudio();const mode=fieldMusicMode(),lobby=!fieldActive&&!fieldPaused,context=mode+(lobby?'-lobby':'-game');const tracks=fieldMusicTracks();let track=lobby&&mode==='retro'?fieldLobbyTrack:tracks[(((fieldMusicSettings.index[mode]||0)%tracks.length)+tracks.length)%tracks.length];if(fieldRoot.hidden||!(fieldIsRetroMode()||fieldMode==='normal'))track=null;if(track&&(fieldCurrentTrack!==track||fieldMusicContext!==context)){fieldCurrentTrack=track;fieldMusicContext=context;fieldRetroMusic.src=track.src;fieldRetroMusic.loop=lobby&&mode==='retro';}fieldRetroMusic.volume=fieldMusicSettings.volume/100;if(track&&fieldMusicSettings.enabled&&!fieldMusicPausedByUser)fieldRetroMusic.play().catch(()=>{});else fieldRetroMusic.pause();if(!track){fieldCurrentTrack=null;if(fieldIsGodCore()&&fieldRetroMusic.hasAttribute('src')){fieldRetroMusic.removeAttribute('src');fieldRetroMusic.load();}}renderFieldMusicWidgets();}
function skipFieldMusic(direction){const mode=fieldMusicMode();if(mode==='retro'&&!fieldActive&&!fieldPaused)return;const tracks=fieldMusicTracks();if(!tracks.length)return;fieldMusicSettings.index[mode]=((fieldMusicSettings.index[mode]||0)+direction+tracks.length)%tracks.length;saveFieldMusic();fieldCurrentTrack=null;syncFieldRetroMusic();}
fieldRetroMusic.addEventListener('ended',()=>skipFieldMusic(1));
function toggleFieldMusicPause(){if(!fieldCurrentTrack||!fieldMusicSettings.enabled)return;fieldMusicPausedByUser=!fieldMusicPausedByUser;syncFieldRetroMusic();}
function renderFieldMusicWidgets(){for(const widget of document.querySelectorAll('[data-field-music]')){widget.replaceChildren();if(fieldIsGodCore()&&!godCoreMusicTracks.length)continue;const prev=document.createElement('button'),next=document.createElement('button'),center=document.createElement('div'),cover=document.createElement('div'),title=document.createElement('div'),mute=document.createElement('button'),pause=document.createElement('button'),controls=document.createElement('div');prev.textContent='◀';next.textContent='▶';prev.setAttribute('aria-label','Previous song');next.setAttribute('aria-label','Next song');prev.onclick=()=>skipFieldMusic(-1);next.onclick=()=>skipFieldMusic(1);const lobby=fieldIsRetroMode()&&!fieldActive&&!fieldPaused;prev.disabled=next.disabled=lobby||fieldMusicTracks().length<2;prev.style.opacity=next.style.opacity=prev.disabled?'.3':'1';cover.textContent='♫';cover.style.cssText='width:64px;height:64px;margin:auto;display:grid;place-items:center;background:linear-gradient(135deg,#152c29,#709726);border:2px solid #c9ff70;color:#dfff70;font:40px monospace';title.textContent=fieldCurrentTrack?.title||'No songs added for this mode';title.style.cssText='font-size:11px;overflow-wrap:anywhere;margin-top:6px';mute.textContent=fieldMusicSettings.enabled?'Mute music':'Enable music';mute.style.fontSize='11px';mute.onclick=()=>{fieldMusicSettings.enabled=!fieldMusicSettings.enabled;saveFieldMusic();syncFieldRetroMusic();};center.style.cssText='text-align:center;max-width:200px';pause.dataset.fieldMusicPause='';pause.textContent=fieldMusicPausedByUser?'▶ Play music':'Ⅱ Pause music';pause.setAttribute('aria-label',fieldMusicPausedByUser?'Play music':'Pause music');pause.setAttribute('aria-pressed',String(fieldMusicPausedByUser));pause.disabled=!fieldCurrentTrack||!fieldMusicSettings.enabled;pause.style.cssText='font-size:12px;padding:7px 10px;border:1px solid #b9d980;border-radius:5px;background:#17302a;color:#e2f3d8;cursor:pointer';pause.style.opacity=pause.disabled?'.45':'1';pause.onclick=toggleFieldMusicPause;controls.style.cssText='display:grid;gap:6px;margin-top:8px';controls.append(pause,mute);center.append(cover,title,controls);widget.style.cssText='display:flex;align-items:center;justify-content:center;gap:18px;margin:10px 0;color:#e2f3d8';widget.append(prev,center,next);}}
function renderFieldPlaylistSettings(panel){const h=document.createElement('h3');h.textContent='Music';h.style.cssText='font-size:22px;margin-top:24px';panel.append(h);const enable=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=fieldMusicSettings.enabled;check.onchange=()=>{fieldMusicSettings.enabled=check.checked;saveFieldMusic();syncFieldRetroMusic();};enable.append(check,document.createTextNode(' Enable music'));panel.append(enable);const volume=document.createElement('input');volume.type='range';volume.min=0;volume.max=100;volume.value=fieldMusicSettings.volume;volume.setAttribute('aria-label','Music volume');volume.style.cssText='display:block;width:100%;margin:12px 0';volume.oninput=()=>{fieldMusicSettings.volume=Number(volume.value);saveFieldMusic();syncFieldRetroMusic();};panel.append(volume);if(fieldIsGodCore()){const note=document.createElement('p');note.textContent='GOD CORE finale music starts at wave 15. Pause the game to pause the song. Muting keeps the finale timer running.';note.style.cssText='margin:12px 0;color:#b9b1a6';panel.append(note);return;}const note=document.createElement('p');note.textContent='Check a song to always skip it. Retro lobby music plays only in the lobby; gameplay uses the playlist below. If every song is skipped, music stops.';panel.append(note);for(const mode of (fieldIsGodCore()?['retro']:['retro','normal'])){const title=document.createElement('h4');title.textContent=mode==='retro'?'Retro playlist':'Normal playlist (songs pending)';title.style.marginTop='16px';panel.append(title);for(const track of fieldPlaylists[mode]){const label=document.createElement('label');label.style.cssText='display:block;margin:8px 0';const skip=document.createElement('input');skip.type='checkbox';skip.checked=fieldMusicSettings.skip[mode].includes(track.id);skip.onchange=()=>{fieldMusicSettings.skip[mode]=fieldMusicSettings.skip[mode].filter(id=>id!==track.id);if(skip.checked)fieldMusicSettings.skip[mode].push(track.id);saveFieldMusic();syncFieldRetroMusic();};label.append(skip,document.createTextNode(' Skip '+track.title));panel.append(label);}}}
function fieldIsCombat(){return fieldMode==='normal'||fieldIsRetroMode()||fieldMode==='tutorial';}
const fieldWeaponNames={pistol:'Pistol',ar:'AR',sniper:'Sniper',shotgun:'Shotgun'};
function fieldWeaponLabel(id){if(id==='god-power')return 'GOD CORE';return id==='rocket'?'Rocket Launcher':id==='grenade'?'Grenade':fieldWeaponNames[id];}
let fieldEquipped='pistol',fieldAimMode='hold',fieldAimToggled=false,fieldCrouchMode='hold',fieldCrouchToggled=false,fieldSprintMode='hold',fieldSprintToggled=false;
let fieldLoadout=['pistol','ar','sniper','shotgun'],fieldSkins={};
const fieldSkinStyles={default:{name:'Default',filter:'none'}};
try{const order=JSON.parse(fieldStorage.get('loadout')||'null');if(Array.isArray(order)){fieldLoadout=[...new Set(order.filter(id=>Object.hasOwn(fieldWeaponNames,id)))];for(const id of Object.keys(fieldWeaponNames))if(!fieldLoadout.includes(id))fieldLoadout.push(id);}const skins=JSON.parse(fieldStorage.get('skins')||'{}');for(const id in fieldWeaponNames)fieldSkins[id]=Object.hasOwn(fieldSkinStyles,skins[id])?skins[id]:'default';}catch(_){}
// Retro has its own complete order, including weapons unlocked in later waves.
let fieldRetroLoadout=fieldLoadout.map(id=>id==='sniper'?'rocket':id);fieldRetroLoadout.splice(fieldRetroLoadout.indexOf('shotgun')+1,0,'grenade');
try{const order=JSON.parse(fieldStorage.get('retro-loadout')||'null');if(Array.isArray(order)){const defaults=['pistol','ar','rocket','shotgun','grenade'];fieldRetroLoadout=[...new Set(order.map(id=>id==='sniper'?'rocket':id).filter(id=>defaults.includes(id)))];for(const id of defaults)if(!fieldRetroLoadout.includes(id))fieldRetroLoadout.push(id);}}catch(_){}

const fieldDefaults={refill:['KeyF'],reload:['KeyR'],leanLeft:['KeyQ'],leanRight:['KeyE'],songPrevious:['BracketLeft'],songNext:['BracketRight'],fire:['Mouse0'],crouch:['ControlLeft','ControlRight'],aim:['Mouse2'],inventoryPrevious:['WheelUp'],inventoryNext:['WheelDown'],forward:['KeyW'],back:['KeyS'],left:['KeyA'],right:['KeyD'],jump:['Space'],sprint:['ShiftLeft']};
const fieldLabels={refill:'Interact (Friendly pool / towel)',reload:'Reload',leanLeft:'Lean left',leanRight:'Lean right',songPrevious:'Previous song',songNext:'Next song',fire:'Shoot',crouch:'Crouching',aim:'Aiming',inventoryPrevious:'Previous weapon',inventoryNext:'Next weapon',forward:'Move forward',back:'Move backward',left:'Move left',right:'Move right',jump:'Jump',sprint:'Sprint'};
let fieldBindings=structuredClone(fieldDefaults),fieldPose={x:0,z:0,yaw:0,pitch:0},fieldSaving=true;
try{const saved=JSON.parse(fieldStorage.get('save')||'null');if(saved){fieldMode=["normal","practice","explore","retro","retro-story","tutorial"].includes(saved.mode)?saved.mode:saved.practice?"practice":"normal";fieldPractice=fieldMode==="practice";fieldClockFormat=saved.clockFormat==='24h'?'24h':'12h';if(Number.isFinite(saved.lookSensitivity))fieldLookSensitivity=Math.max(.1,Math.min(3,saved.lookSensitivity));if(Object.hasOwn(fieldMaps,saved.map))fieldSelectedMap=saved.map;fieldCrouchMode=saved.crouchMode==='toggle'?'toggle':'hold';fieldSprintMode=saved.sprintMode==='toggle'?'toggle':'hold';fieldAimMode=saved.aimMode==='toggle'?'toggle':'hold';if(Object.hasOwn(fieldWeaponNames,saved.equipped))fieldEquipped=saved.equipped;for(const action in fieldDefaults)if(Array.isArray(saved.bindings?.[action]))fieldBindings[action]=[...new Set(saved.bindings[action].filter(v=>typeof v==='string'&&v!=='Escape'&&v.length<50))].slice(0,5);for(const key in fieldPose)if(Number.isFinite(saved.pose?.[key]))fieldPose[key]=saved.pose[key];fieldPose.pitch=Math.max(-1.5,Math.min(1.5,fieldPose.pitch));}}catch(_){}
loadFieldRunHistory();
let fieldPendingSave=null;
function saveField(){if(!fieldSaving)return;persistInactiveFieldRunHistories();checkpointFieldRun(true);try{fieldStorage.set('save',JSON.stringify({version:1,mode:fieldMode,practice:fieldPractice,lookSensitivity:fieldLookSensitivity,clockFormat:fieldClockFormat,map:fieldSelectedMap,bindings:fieldBindings,pose:fieldPose,equipped:fieldEquipped,aimMode:fieldAimMode,crouchMode:fieldCrouchMode,sprintMode:fieldSprintMode}));}catch(_){}}
function queueFieldSave(){if(!fieldSaving||fieldPendingSave!==null)return;fieldPendingSave=setTimeout(()=>{fieldPendingSave=null;saveField();},200);}
function saveFieldOnPageExit(){pauseFieldRunClock();saveField();}
window.addEventListener('platdo:save',saveField);window.addEventListener('pagehide',saveFieldOnPageExit);window.addEventListener('beforeunload',saveFieldOnPageExit);
window.addEventListener('platdo:beforereset',()=>{fieldSaving=false;fieldSprintToggled=false;clearTimeout(fieldPendingSave);clearTimeout(fieldRunPendingSave);clearInterval(fieldRunCheckpointTimer);fieldRunCheckpointTimer=null;fieldPendingSave=fieldRunPendingSave=null;fieldRunClockLast=null;fieldRun=null;fieldRunHitIds.clear();fieldRunHistoryDirty=false;});
const fieldRoot=document.createElement('section');fieldRoot.id='fieldGame';fieldRoot.hidden=true;
fieldRoot.style.cssText='position:fixed;inset:0;overflow:hidden;background:#101b25;color:white;z-index:50;font-family:Arial,sans-serif';
fieldRoot.innerHTML=`<canvas id="fieldCanvas" style="display:block;width:100%;height:100%"></canvas>
<canvas id="fieldShotCanvas" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas>
<div id="fieldGunMotion" style="position:absolute;inset:0;pointer-events:none"><img id="fieldRetroShotgunReady" hidden alt="Retro shotgun ready" data-weapon-type="shotgun" data-view="idle" style="--weapon-size:95%;max-width:none;clip-path:inset(55% 0 0 0);" src="assets/images/fieldretroshotgunready-ab595ce162c6.png"><img id="fieldRetroShotgunReload" hidden alt="Retro shotgun reload" data-weapon-type="shotgun" data-view="idle" style="--weapon-size:60%;max-width:none;" src="assets/images/fieldretroshotgunreload-2368e5d3e8d3.png">
<img id="fieldShotgunIdle" data-weapon-type="shotgun" data-view="idle" hidden alt="Held shotgun" src="assets/images/fieldshotgunidle-a206319a7e41.png">
<img id="fieldSniperIdle" data-weapon-type="sniper" data-view="idle" hidden alt="Held sniper rifle" src="assets/images/fieldsniperidle-9871a364f73c.png" style="position:absolute;right:0;bottom:-24px;width:auto;max-width:100%;object-fit:contain;object-position:right bottom;pointer-events:none">
<img id="fieldARIdle" data-weapon-type="ar" data-view="idle" hidden alt="AR rifle" src="assets/images/fieldaridle-5be570fbf7ff.png" style="position:absolute;width:auto;pointer-events:none;right:0;bottom:-24px;max-width:100%;object-fit:contain;object-position:right bottom;">
<img id="fieldARAim" data-weapon-type="ar" data-view="aim" hidden alt="AR rifle" src="assets/images/fieldaraim-6a4794d690b2.png" style="position:absolute;width:auto;pointer-events:none;left:50%;top:50%;transform:translate(-52%,-21%);">
<img id="fieldPistolIdle" data-weapon-type="pistol" data-view="idle" data-weapon-anchor-x=".64" data-weapon-anchor-y="1" hidden alt="Pistol" style="--weapon-size:48%;" src="assets/images/fieldpistolidle-314031f74947.png">
<img id="fieldPistolAim" data-weapon-type="pistol" data-view="aim" data-weapon-anchor-x=".501" data-weapon-anchor-y="1" hidden alt="Aiming pistol" style="--weapon-size:65%;--sight-x:.501;--sight-y:.488;" src="assets/images/image-8bbd192d3543.png" data-normal-pistol-aim-rear="true">
</div>
<div id="fieldScope" hidden style="position:absolute;inset:0;pointer-events:none;display:none;align-items:center;justify-content:center"><img alt="Sniper scope" src="assets/images/fieldscope-e103294b18bb.png" style="width:100vmin;height:100vmin;mix-blend-mode:multiply;box-shadow:0 0 0 100vmax black"></div>
<img id="fieldMuzzleFlash" hidden alt="" src="assets/images/fieldmuzzleflash-23922957ff37.jpg" style="position:absolute;pointer-events:none;mix-blend-mode:multiply;width:240px;height:auto">
<div id="fieldInventory" hidden style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);max-width:95%;text-align:center"><div id="fieldInventorySlots" style="display:flex;gap:8px;padding:8px;background:#102537cc;border-radius:14px"></div></div>
<div id="fieldCrosshair" hidden style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;font-size:24px;color:white;text-shadow:0 1px 4px #123">+</div>
<div id="fieldHealthVignette" hidden style="position:absolute;inset:0;pointer-events:none;transition:opacity .25s;opacity:0"></div><div id="fieldRetroHUD" hidden style="position:absolute;top:20px;left:50%;transform:translateX(-50%);background:#071b16e8;color:#c9ff70;padding:12px;font:bold 16px monospace;text-align:center;pointer-events:none"></div><div id="fieldRunTimer" hidden style="position:absolute;top:76px;left:16px;color:white;background:#14231ed9;padding:8px 14px;border-radius:8px;pointer-events:none">0:00</div><div id="fieldCombatHUD" hidden style="position:absolute;bottom:24px;left:20px;color:white;pointer-events:none"></div><div id="fieldPracticeHUD" hidden style="position:absolute;top:20px;left:50%;transform:translateX(-50%);color:white;background:#14231ed9;padding:10px 18px;border-radius:12px;pointer-events:none;text-align:center"></div><button id="fieldMenuBtn" hidden style="position:absolute;top:16px;left:16px;background:#ffffffdd;color:#123;padding:12px 18px;border-radius:12px;cursor:pointer">Menu (Esc)</button>
<div id="fieldMenu" class="code-home" style="position:absolute;inset:0;display:flex">
<div class="code-home-layout">
<header class="code-home-header"><span class="code-home-brand">code <strong>PLATDO</strong></span><span class="code-home-tag">FIRST-PERSON / PLATDO</span></header>
<div class="code-home-hero"><p class="code-home-eyebrow">NORMAL / WAVE SURVIVAL</p>
<h1 class="code-home-title"><span>code</span> PLATDO</h1>
<p class="code-home-description">Survive the waves. Clear a wave to restore your health.</p>
<nav class="code-home-actions" aria-label="code PLATDO main menu">
<button id="fieldPlay" class="code-home-play">Play <span aria-hidden="true">↗</span></button>
<button id="fieldLockerBtn" class="code-home-secondary">Locker <span aria-hidden="true">↗</span></button><button id="fieldRunsBtn" class="code-home-secondary">Runs <span aria-hidden="true">↗</span></button><button id="fieldSettingsBtn" class="code-home-secondary">Settings <span aria-hidden="true">⚙</span></button>
<button id="fieldBack" class="code-home-back">← Game selection</button>
</nav>
<div data-field-music></div><p id="fieldStatus" role="status" class="code-home-status"></p>
</div>
<footer class="code-home-footer" style="align-items:flex-end;flex-wrap:wrap"><div style="flex:1;min-width:240px"><p id="fieldMapCaption" style="margin-bottom:12px">Choose a map · Hover to preview</p><nav id="fieldMapChoices" aria-label="Choose a map" style="display:flex;gap:8px;flex-wrap:wrap"></nav></div><div style="text-align:right"><p class="code-home-eyebrow" style="margin-bottom:10px">MODE</p><nav id="fieldModeChoices" aria-label="Game mode" style="display:flex;gap:8px;flex-wrap:wrap"><button class="code-home-tag" data-mode="normal">NORMAL</button><button class="code-home-tag" data-mode="practice">PRACTICE</button><button class="code-home-tag" data-mode="explore">EXPLORE</button><button class="code-home-tag" data-mode="retro">RETRO</button><button class="code-home-tag" data-mode="tutorial" aria-label="Friendly Tutorial" title="Soak an opponent, refill at the pool, and dry off with a towel." hidden>TUTORIAL</button></nav></div></footer>
</div></div>
<div id="fieldSettings" hidden style="position:absolute;inset:0;overflow:auto;background:#0f2337;padding:clamp(16px,4vw,44px)"><div style="max-width:720px;margin:auto"><button id="fieldSettingsBack" style="padding:12px;border:1px solid #ffffff55;border-radius:10px;cursor:pointer">← Back to code PLATDO</button><h1 class="code-settings-heading code-ui-only">Settings</h1><div role="tablist" aria-label="code PLATDO settings" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:20px"><button data-field-settings="controls" role="tab" aria-selected="true" aria-controls="fieldControlsPanel" style="padding:12px;border:1px solid #8296a9;border-radius:8px;cursor:pointer">Controls</button><button data-field-settings="look" role="tab" aria-selected="false" aria-controls="fieldLookPanel" style="padding:12px;border:1px solid #8296a9;border-radius:8px;cursor:pointer">Look Sensitivity</button><button data-field-settings="audio" role="tab" aria-selected="false" aria-controls="fieldAudioPanel" style="padding:12px;border:1px solid #8296a9;border-radius:8px">Audio</button><button data-field-settings="loadout" role="tab" aria-selected="false" aria-controls="fieldLoadoutPanel" style="padding:12px;border:1px solid #8296a9;border-radius:8px">Loadout</button><button data-field-settings="game" role="tab" aria-selected="false" aria-controls="fieldGameSettingsPanel" style="padding:12px;border:1px solid #8296a9;border-radius:8px;cursor:pointer">Game</button></div><section id="fieldControlsPanel" role="tabpanel"><h2 style="font-size:30px;margin:20px 0">Key Binds</h2><p style="color:#c7d8e8">Click a bind to change it. Add up to 5 per action with +, or remove one with ×. Keyboard keys, mouse buttons and scroll wheel are supported. Mouse movement looks around. Escape returns to the menu.</p><p id="fieldBindPrompt" role="status" style="min-height:28px;color:#c9f18c;margin-top:14px"></p><label for="fieldAimMode">Aiming mode</label><select id="fieldAimMode" style="background:#243d54;color:white;padding:10px;margin:14px;border:1px solid #8296a9;border-radius:8px"><option value="hold">Hold (Default)</option><option value="toggle">Toggle</option></select><br><label for="fieldCrouchMode">Crouching mode</label><select id="fieldCrouchMode" style="background:#243d54;color:white;padding:10px;margin:14px;border:1px solid #8296a9;border-radius:8px"><option value="hold">Hold (Default)</option><option value="toggle">Toggle</option></select><br><label for="fieldSprintMode">Sprinting mode</label><select id="fieldSprintMode" style="background:#243d54;color:white;padding:10px;margin:14px;border:1px solid #8296a9;border-radius:8px"><option value="hold">Hold (Default)</option><option value="toggle">Toggle</option></select><div id="fieldBindRows"></div><button id="fieldRestoreBinds" style="padding:14px;margin:24px 0;border:1px solid #ffffff55;border-radius:10px;cursor:pointer">Restore Default Binds</button></section><section id="fieldLookPanel" role="tabpanel" hidden><h2 style="font-size:30px;margin:20px 0">Look Sensitivity</h2><p style="color:#c7d8e8;margin-bottom:24px">Adjust how quickly the camera turns when you move the mouse. Aiming keeps its reduced sensitivity.</p><label for="fieldLookSlider">Mouse sensitivity <output id="fieldLookValue">100%</output></label><input id="fieldLookSlider" type="range" min="0.1" max="3" step="0.05" value="1" style="display:block;width:100%;margin:24px 0"><p style="color:#c7d8e8">10% (slow) – 300% (fast) · Default: 100%</p><button id="fieldLookReset" style="padding:14px;margin:24px 0;border:1px solid #8296a9;border-radius:8px;cursor:pointer">Reset Sensitivity</button></section><section id="fieldAudioPanel" role="tabpanel" hidden></section><section id="fieldLoadoutPanel" role="tabpanel" hidden></section><section id="fieldGameSettingsPanel" role="tabpanel" hidden><h2 style="font-size:30px;margin:20px 0">Game</h2><label for="fieldClockFormat" style="display:block;font-weight:bold;margin:18px 0 10px">Run history clock</label><select id="fieldClockFormat" style="background:#243d54;color:white;padding:12px;border:1px solid #8296a9;border-radius:8px;max-width:100%"><option value="12h">Normal time (12-hour AM/PM)</option><option value="24h">Military time (24-hour)</option></select><p id="fieldClockExample" style="color:#c7d8e8;margin-top:16px"></p><p style="color:#c7d8e8;margin-top:12px">Choose how start and finish times appear in Runs. Run duration stays the same.</p></section></div></div>`;
document.body.append(fieldRoot);
const fieldCanvas=document.getElementById('fieldCanvas'),fieldMenu=document.getElementById('fieldMenu'),fieldSettings=document.getElementById('fieldSettings');

// God Core's wordmark uses original vector letterforms so the identity works offline.
const godCoreWordmark='<svg class="god-core-wordmark" viewBox="0 0 810 414" fill="currentColor" aria-hidden="true" focusable="false"><g transform="translate(53 0) skewX(-7)"><path d="M32 0H218V43H54L45 52V148L54 157H173V124H112V82H218V200H32L0 168V32Z"/><path fill-rule="evenodd" d="M276 0H446L478 32V168L446 200H276L244 168V32ZM298 44L289 53V147L298 156H424L433 147V53L424 44Z"/><path fill-rule="evenodd" d="M505 0H691L737 46V154L691 200H505ZM550 44V156H672L692 136V64L672 44Z"/></g><g transform="translate(28 220) skewX(-7)"><path d="M30 0H164V43H53L45 51V149L53 157H164V200H30L0 170V30Z"/><path fill-rule="evenodd" d="M222 0H351L381 30V170L351 200H222L192 170V30ZM244 44L237 51V149L244 156H329L336 149V51L329 44Z"/><path fill-rule="evenodd" d="M409 0H545L577 32V94L548 123L591 200H538L498 126H454V200H409ZM454 43V84H527L533 78V49L527 43Z"/><path d="M614 0H787V43H659V78H768V120H659V157H787V200H614Z"/></g><path d="M11 205H791L776 211H0Z" fill="#dc2c36"/></svg>';
const godCoreEmblem='<svg viewBox="0 0 32 44" fill="none" aria-hidden="true" focusable="false"><path d="M16 1L30 22 16 43 2 22Z" stroke="currentColor" stroke-width="1.5"/><path d="M16 7V37M7 22H25M11 17L21 27M21 17L11 27" stroke="currentColor" stroke-width="1.5"/></svg>';
const godCoreTileMarkup='<img id="godCoreCover" class="hub-cover" src="assets/images/godcorecover-b0faf4b286c8.png" alt="PLATDO GOD CORE — year 5117" draggable="false">';

// These labels describe the selected mode; settings and gameplay keep their existing handlers.
function renderCodePlatdoIdentity(active=fieldIsGodCore()){
 const menu=document.getElementById('fieldMenu'),header=menu.querySelector('.code-home-header'),actions=menu.querySelector('.code-home-actions');
 let top=menu.querySelector('.code-lobby-topnav');
 if(!top){
  top=document.createElement('nav');top.className='code-ui-only code-lobby-topnav';top.setAttribute('aria-label','Code PLATDO menu');
  const current=document.createElement('span');current.className='code-lobby-current';current.textContent='PLAY';current.setAttribute('aria-current','page');top.append(current);header.append(top);
  for(const id of ['fieldLockerBtn','fieldRunsBtn','fieldSettingsBtn']){const button=document.getElementById(id);const home=document.createComment('lobby-home-'+id);button.before(home);button.codeLobbyHome=home;}
 }
 // Move the original controls, preserving handlers, focus, and the God Core menu.
 for(const id of ['fieldLockerBtn','fieldRunsBtn','fieldSettingsBtn']){
  const button=document.getElementById(id);
  if(active){const home=button.codeLobbyHome;if(home?.parentNode&&button.parentNode!==home.parentNode)home.parentNode.insertBefore(button,home.nextSibling);}
  else if(button.parentNode!==top)top.append(button);
 }
 if(active)return;
 fieldRoot.dataset.codeMode=fieldFriendly?'friendly':fieldMode;
 const labels=fieldFriendly?(fieldMode==='tutorial'?['TUTORIAL','FRIENDLY / TRAINING','Learn to use your water gun, refill at the pool, and dry off.']:fieldMode==='practice'?['PRACTICE','FRIENDLY / TARGET RANGE','Take your time. Work on your aim.']:fieldMode==='explore'?['EXPLORE','FRIENDLY / FREE ROAM','Explore the pool house at your own pace.']:['FRIENDLY','WATER FIGHT','A pool, a water gun, and waves of opponents.']):({normal:['NORMAL','WAVE SURVIVAL','Clear a wave to restore your health. Hold your ground for the next one.'],practice:['PRACTICE','TARGET RANGE','Hit the targets. Improve your aim. Keep the run going.'],explore:['EXPLORE','FREE ROAM','Explore the maps at your own pace.'],retro:['RETRO','CLASSIC WAVE SURVIVAL','Fight through tight corridors with classic weapons. Clear waves to unlock more.']}[fieldMode]||['CODE PLATDO','SINGLE PLAYER','']);
 menu.querySelector('.code-home-hero>.code-home-eyebrow').textContent=labels[1];
 menu.querySelector('.code-home-title').textContent=labels[0];
 menu.querySelector('.code-home-description').textContent=labels[2];
 header.querySelector(':scope>.code-home-tag').textContent=fieldFriendly?'WATER FIGHT':'SINGLE PLAYER';
 for(const id of ['fieldLockerBtn','fieldRunsBtn','fieldSettingsBtn']){const arrow=document.querySelector('#'+id+'>span');if(arrow)arrow.textContent='';}
 renderCodeLobbyWeapon();
}
function renderCodeLobbyWeapon(selected){
 if(fieldIsGodCore())return;
 let panel=document.getElementById('codeLobbyWeapon');
 if(!panel){
  panel=document.createElement('section');panel.id='codeLobbyWeapon';panel.className='code-ui-only code-lobby-weapon';panel.setAttribute('aria-label','Weapon preview');
  panel.innerHTML='<div class="code-lobby-weapon-heading"><div><span>WEAPON PREVIEW</span><h2></h2></div><span class="code-lobby-weapon-index" aria-hidden="true"></span></div><div class="code-lobby-weapon-stage"><div class="code-lobby-reticle" aria-hidden="true"></div><img alt="" draggable="false"></div><nav class="code-lobby-weapon-tabs" aria-label="Preview a weapon"></nav>';
  document.querySelector('#fieldMenu .code-home-hero').append(panel);
 }
 const weapons=fieldIsRetroMode()?fieldRetroLoadout:fieldModeLoadout(),context=(fieldFriendly?'friendly':fieldMode),previous=panel.dataset.context===context?panel.dataset.weapon:null;
 const id=weapons.includes(selected)?selected:weapons.includes(previous)?previous:weapons.includes(fieldEquipped)?fieldEquipped:weapons[0];
 panel.dataset.weapon=id;panel.dataset.context=context;
 const source=codeLobbyWeaponImage(id),image=panel.querySelector('.code-lobby-weapon-stage>img');
 if(source){if(image.getAttribute('src')!==source.src)image.src=source.src;const keyed=getComputedStyle(source).filter;image.style.filter=(keyed==='none'?'':keyed+' ')+'drop-shadow(12px 10px 7px #01070ba0)';image.alt=(fieldFriendly?'Friendly ':fieldIsRetroMode()?'Retro ':'')+fieldWeaponLabel(id);}
 panel.querySelector('h2').textContent=fieldWeaponLabel(id);
 panel.querySelector('.code-lobby-weapon-index').textContent=String(weapons.indexOf(id)+1).padStart(2,'0')+' / '+String(weapons.length).padStart(2,'0');
 const tabs=panel.querySelector('nav');tabs.replaceChildren();
 for(const [index,weapon] of weapons.entries()){
  const button=document.createElement('button');button.type='button';button.dataset.previewWeapon=weapon;button.setAttribute('aria-pressed',String(weapon===id));button.setAttribute('aria-label','Preview '+fieldWeaponLabel(weapon));
  const icon=document.createElement('img'),art=codeLobbyWeaponImage(weapon);if(art){icon.src=art.src;icon.style.filter=getComputedStyle(art).filter;}icon.alt='';icon.draggable=false;
  const label=document.createElement('span');label.textContent=fieldWeaponLabel(weapon);const number=document.createElement('span');number.className='code-lobby-slot';number.textContent=String(index+1).padStart(2,'0');
  button.append(number,icon,label);button.onclick=()=>renderCodeLobbyWeapon(weapon);tabs.append(button);
 }
}
function codeLobbyWeaponImage(id){return fieldIsRetroMode()&&id==='pistol'?fieldRetroPistolImages.aim:fieldLockerImage(id);}


let godCoreIdentityOriginal=null;
function renderGodCoreIdentity(active=fieldIsGodCore()){
 const menu=document.getElementById('fieldMenu');if(!menu)return;
 const brand=menu.querySelector('.code-home-brand'),tag=menu.querySelector('.code-home-header>.code-home-tag'),eyebrow=menu.querySelector('.code-home-hero>.code-home-eyebrow'),title=menu.querySelector('.code-home-title'),description=menu.querySelector('.code-home-description'),nav=menu.querySelector('.code-home-actions'),back=document.getElementById('fieldSettingsBack'),tabs=document.querySelector('#fieldSettings [role="tablist"]');
 if(!godCoreIdentityOriginal)godCoreIdentityOriginal={brand:brand.innerHTML,tag:tag.textContent,eyebrow:eyebrow.textContent,title:title.innerHTML,description:description.textContent,nav:nav.getAttribute('aria-label'),back:back.textContent,tabs:tabs.getAttribute('aria-label')};
 fieldRoot.classList.toggle('god-core-game',active);
 if(active){brand.innerHTML=godCoreEmblem+'platdo';tag.textContent='GOD CORE / SINGLE PLAYER';eyebrow.textContent='A PLATDO ORIGINAL';title.innerHTML=godCoreWordmark;title.setAttribute('aria-label','GOD CORE');description.textContent='EVERY SECOND COUNTS.';nav.setAttribute('aria-label','platdo god core main menu');back.textContent='← Back to god core';tabs.setAttribute('aria-label','platdo god core settings');const play=document.getElementById('fieldPlay');play.firstChild.textContent='Play ';play.setAttribute('aria-label','Play platdo god core');for(const id of ['fieldPlay','fieldRunsBtn','fieldSettingsBtn']){const arrow=document.getElementById(id).querySelector('span');if(arrow)arrow.textContent='↗';}if(!menu.querySelector('.god-core-footer-mark')){const stamp=document.createElement('div');stamp.className='god-core-only god-core-footer-mark';stamp.innerHTML='<span>Every second<br>counts.</span>'+godCoreEmblem;menu.querySelector('.code-home-footer').append(stamp);}}
 else{brand.innerHTML=godCoreIdentityOriginal.brand;tag.textContent=godCoreIdentityOriginal.tag;eyebrow.textContent=godCoreIdentityOriginal.eyebrow;title.innerHTML=godCoreIdentityOriginal.title;title.removeAttribute('aria-label');description.textContent=godCoreIdentityOriginal.description;nav.setAttribute('aria-label',godCoreIdentityOriginal.nav);back.textContent=godCoreIdentityOriginal.back;tabs.setAttribute('aria-label',godCoreIdentityOriginal.tabs);const arrow=document.getElementById('fieldSettingsBtn').querySelector('span');if(arrow)arrow.textContent='⚙';}
 renderCodePlatdoIdentity(active);
}

let fieldCrouchOffset=0,fieldLean=0;
function fieldLeanDistance(){const requested=-fieldLean*.7;let safe=0;for(let step=1;step<=14;step++){const offset=requested*step/14,x=fieldPose.x+Math.cos(fieldPose.yaw)*offset,z=fieldPose.z+Math.sin(fieldPose.yaw)*offset;if(fieldBlocked(x,z,fieldHeight-fieldCrouchOffset-.12,.24,.12))break;safe=offset;}return safe;}
function fieldEyeX(){return fieldPose.x+Math.cos(fieldPose.yaw)*fieldLeanDistance();}function fieldEyeZ(){return fieldPose.z+Math.sin(fieldPose.yaw)*fieldLeanDistance();}
let fieldBobPhase=0,fieldBobStrength=0,fieldRecoil=0,fieldGunKick=0,fieldShotCooldown=0,fieldFlash=0;
const fieldFootsteps=new Audio("assets/audio/fieldfootsteps-01df77ccb309.mp3");fieldFootsteps.loop=true;
const fieldJumpAudio="assets/audio/fieldjumpaudio-7021b29020cd.mp3";
const fieldLandAudio="assets/audio/fieldlandaudio-fa538a848484.mp3";
const fieldProjectiles=[];const fieldImpacts=[];let fieldShotCount=0;

const fieldWaterTrails=[],fieldWaterParticles=[],fieldWaterDeathParticles=[];
function clearFieldWaterEffects(){fieldWaterTrails.length=0;fieldWaterParticles.length=0;fieldWaterDeathParticles.length=0;}
function addFieldWaterSplash(point,velocity){
 const length=Math.hypot(velocity.vx||0,velocity.vy||0,velocity.vz||0)||1;
 const nx=(velocity.vx||0)/length,ny=(velocity.vy||0)/length,nz=(velocity.vz||0)/length;
 for(let i=0;i<12;i++)fieldWaterParticles.push({x:point.x-nx*.035,y:Math.max(.035,point.y-ny*.035),z:point.z-nz*.035,vx:(Math.random()-.5)*3-nx*.8,vy:.5+Math.random()*2.6-ny*.8,vz:(Math.random()-.5)*3-nz*.8,life:.32+Math.random()*.24,age:0,size:.025+Math.random()*.035,tint:i%3});
 if(fieldWaterParticles.length>256)fieldWaterParticles.splice(0,fieldWaterParticles.length-256);
}
function addFieldWaterSegment(b,end,impact=false){
 if(!fieldFriendly)return;
 let start={x:b.x,y:b.y,z:b.z};
 // The first visible stream starts at the gun; collision still uses the exact aim ray.
 if(!b.enemy&&!b.fieldWaterStarted){const yaw=fieldPose.yaw;start={x:b.x+Math.cos(yaw)*.17+Math.sin(yaw)*.32,y:b.y-.18,z:b.z+Math.sin(yaw)*.17-Math.cos(yaw)*.32};}
 b.fieldWaterStarted=true;
 fieldWaterTrails.push({a:start,b:{...end},life:.14,age:0});
 if(fieldWaterTrails.length>160)fieldWaterTrails.splice(0,fieldWaterTrails.length-160);
 if(impact)addFieldWaterSplash(end,b);
}
function fieldWaterTravel(b,time,impact=false){addFieldWaterSegment(b,{x:b.x+b.vx*time,y:b.y+b.vy*time,z:b.z+b.vz*time},impact);}
function fieldWaterTargetDistance(shot,target){
 if(!target)return null;const q=[shot.x-target.x,shot.y-target.y,shot.z-target.z],speed2=shot.vx**2+shot.vy**2+shot.vz**2;
 const dot=q[0]*shot.vx+q[1]*shot.vy+q[2]*shot.vz,disc=dot*dot-speed2*(q[0]**2+q[1]**2+q[2]**2-target.radius**2);
 if(disc<0||!speed2)return null;const time=(-dot-Math.sqrt(disc))/speed2;return time>=0?time:0;
}
function fieldWaterPracticeShot(shot,hit,target){
 if(!fieldFriendly)return;let time=60,impact=false;
 const wall=fieldWorldHit(shot,time);if(wall!==null){time*=wall;impact=true;}
 if(shot.vy<0){const ground=-shot.y/shot.vy;if(ground>=0&&ground<time){time=ground;impact=true;}}
 const targetTime=hit?fieldWaterTargetDistance(shot,target):null;
 if(targetTime!==null&&targetTime<=time){time=targetTime;impact=true;}
 fieldWaterTravel(shot,time,impact);
}

function burstFieldWaterEnemy(enemy){
 for(let i=0;i<48;i++)fieldWaterDeathParticles.push({x:enemy.x+(Math.random()-.5)*.55,y:.15+Math.random()*1.85,z:enemy.z+(Math.random()-.5)*.45,vx:(Math.random()-.5)*4.2,vy:1+Math.random()*3,vz:(Math.random()-.5)*4.2,age:0,life:6,alpha:1,size:.045+Math.random()*.035,tint:i%3,bounces:0,restAge:null,deathBurst:true});
 if(fieldWaterDeathParticles.length>192)fieldWaterDeathParticles.splice(0,fieldWaterDeathParticles.length-192);
}
function updateFieldWaterDeaths(dt){
 if(!fieldActive||!fieldWaterDeathParticles.length)return;
 const boxes=fieldWorldBoxes().concat({c:[0,-.25,0],h:[1000,.25,1000]});
 for(let i=fieldWaterDeathParticles.length-1;i>=0;i--){
  const p=fieldWaterDeathParticles[i];p.age+=dt;
  if(p.age>=p.life){fieldWaterDeathParticles.splice(i,1);continue;}
  if(p.restAge!==null){p.restAge+=dt;p.alpha=1-Math.max(0,p.restAge-1.1)/.7;if(p.restAge>=1.8)fieldWaterDeathParticles.splice(i,1);continue;}
  p.vy-=8*dt;const position=[p.x,p.y,p.z],velocity=[p.vx,p.vy,p.vz];let remaining=dt;
  for(let contactCount=0;contactCount<3&&remaining>1e-6;contactCount++){
   const delta=velocity.map(v=>v*remaining);let contact=null;
   for(const box of boxes){const hit=fieldGrenadeContact(position,delta,box,p.size);if(hit&&(!contact||hit.t<contact.t))contact=hit;}
   if(!contact){for(let axis=0;axis<3;axis++)position[axis]+=delta[axis];break;}
   for(let axis=0;axis<3;axis++)position[axis]+=delta[axis]*contact.t+contact.normal[axis]*contact.push;
   const approach=velocity.reduce((sum,v,axis)=>sum+v*contact.normal[axis],0),floor=contact.normal[1]>.5;
   if(approach<0){
    const restitution=floor?.36:.45;for(let axis=0;axis<3;axis++)velocity[axis]-=(1+restitution)*approach*contact.normal[axis];
    if(floor){p.bounces++;velocity[0]*=.6;velocity[2]*=.6;if(Math.abs(velocity[1])<.7||p.bounces>=3){p.restAge=0;velocity.fill(0);remaining=0;break;}}
   }
   remaining*=1-contact.t;
  }
  [p.x,p.y,p.z]=position;[p.vx,p.vy,p.vz]=velocity;
 }
}

function updateFieldWaterEffects(dt){
 if(!fieldActive)return;
 updateFieldWaterDeaths(dt);
 for(let i=fieldWaterTrails.length-1;i>=0;i--){fieldWaterTrails[i].age+=dt;if(fieldWaterTrails[i].age>=fieldWaterTrails[i].life)fieldWaterTrails.splice(i,1);}
 for(let i=fieldWaterParticles.length-1;i>=0;i--){const p=fieldWaterParticles[i];p.age+=dt;if(p.age>=p.life){fieldWaterParticles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=5*dt;if(p.y<.025){p.y=.025;p.vy=Math.abs(p.vy)*.16;p.vx*=.7;p.vz*=.7;}}
}
function drawFieldWater(ctx,width,height,f,r,u,eye){
 const origin=[fieldEyeX(),eye,fieldEyeZ()],world=fieldWorldBoxes(),focal=height*fieldAimZoom()/1.4;
 const toCamera=p=>{const d=[p.x-origin[0],p.y-origin[1],p.z-origin[2]];return {x:d[0]*r[0]+d[1]*r[1]+d[2]*r[2],y:d[0]*u[0]+d[1]*u[1]+d[2]*u[2],z:d[0]*f[0]+d[1]*f[1]+d[2]*f[2]};};
 const project=p=>({x:width/2+p.x*focal/p.z,y:height/2-p.y*focal/p.z});
 const occluded=p=>{const delta=[p.x-origin[0],p.y-origin[1],p.z-origin[2]];return world.some(w=>{const t=fieldSegmentBox(origin,delta,w.c,w.h);return t!==null&&t>.0001&&t<.99;});};
 ctx.save();ctx.lineCap='round';
 for(const trail of fieldWaterTrails){
  let a=toCamera(trail.a),b=toCamera(trail.b);if(a.z<.12&&b.z<.12)continue;
  if(a.z<.12){const t=(.12-a.z)/(b.z-a.z);a={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:.12};}
  if(b.z<.12){const t=(.12-b.z)/(a.z-b.z);b={x:b.x+(a.x-b.x)*t,y:b.y+(a.y-b.y)*t,z:.12};}
  const midpoint={x:(trail.a.x+trail.b.x)/2,y:(trail.a.y+trail.b.y)/2,z:(trail.a.z+trail.b.z)/2};if(occluded(midpoint))continue;
  const start=project(a),end=project(b);ctx.globalAlpha=Math.max(0,1-trail.age/trail.life)*.85;ctx.strokeStyle='#168be6';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.strokeStyle='#94edff';ctx.lineWidth=2;ctx.stroke();
 }
 legacyRenderStats.fieldParticles=0;let particleIndex=0;for(const list of [fieldWaterParticles,fieldWaterDeathParticles])for(const p of list){if(particleIndex++%fieldParticleStride()||Math.hypot(p.x-origin[0],p.z-origin[2])>fieldGraphicsValues().distance+2)continue;legacyRenderStats.fieldParticles++;const c=toCamera(p);if(c.z<.12||occluded(p))continue;const screen=project(c),size=Math.max(1.1,Math.min(7,p.size*focal/c.z));ctx.globalAlpha=p.deathBurst?Math.max(0,p.alpha):Math.max(0,1-p.age/p.life);ctx.fillStyle=['#36baff','#8aeaff','#087fde'][p.tint];if(p.deathBurst)ctx.fillRect(screen.x-size,screen.y-size,size*2,size*2);else{ctx.beginPath();ctx.arc(screen.x,screen.y,size,0,Math.PI*2);ctx.fill();}}
 ctx.restore();
}

const fieldImpactImage=new Image();fieldImpactImage.src="assets/images/fieldimpactimage-b7c74c0c6ec6.jpg";
let fieldUnlockTime=-1000;
let fieldPaused=false;let fieldActive=false,fieldBinding=null,fieldHeight=1.7,fieldVelocity=0,fieldKeys=new Set(),fieldLastTime=0,fieldLastRender=0;
const fieldMobileActions=new Set(),fieldMobileMove={x:0,y:0};
function clearFieldMobileInput(){fieldMobileActions.clear();fieldMobileMove.x=fieldMobileMove.y=0;}

let fieldGL=null,fieldProgram=null,fieldUniforms=null,fieldFrame=0,fieldRendererFailed=false;
function fieldShader(type,source){const shader=fieldGL.createShader(type);fieldGL.shaderSource(shader,source);fieldGL.compileShader(shader);if(!fieldGL.getShaderParameter(shader,fieldGL.COMPILE_STATUS))throw new Error(fieldGL.getShaderInfoLog(shader));return shader;}
function initFieldRenderer(){
 if(fieldGL)return true;if(fieldRendererFailed)return false;
 try{
 fieldGL=fieldCanvas.getContext('webgl',{antialias:false,alpha:false});if(!fieldGL)throw new Error('WebGL is unavailable');
 const vert=fieldShader(fieldGL.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
 const fragmentPrecision=fieldGL.getShaderPrecisionFormat(fieldGL.FRAGMENT_SHADER,fieldGL.HIGH_FLOAT)?.precision?'highp':'mediump';
 const frag=fieldShader(fieldGL.FRAGMENT_SHADER,`precision ${fragmentPrecision} float;
uniform int visualDetail;uniform int lightingQuality;uniform float detailDistance;uniform int godCoreArena;uniform float godCorePower;uniform float sceneTime;uniform vec3 worldCenters[128];uniform vec4 worldSizes[128];uniform int worldCount;uniform vec4 retroEnemies[12];uniform int retroEnemyCount;uniform int retroMode;uniform sampler2D retroTex;uniform vec4 enemyPoses[12];uniform vec2 enemyMotions[12];uniform int enemyCount;uniform int friendlyEnemy;float enemyStride;uniform vec4 targetBall;uniform float lean;uniform vec2 resolution;uniform vec3 eye;uniform vec2 look;uniform float zoom;uniform int mapId;uniform sampler2D impactTex;uniform vec2 impactPositions[24];uniform int impactCount;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}

// GOD CORE's chapel is built from the same collision boxes as its visible walls.
// The materials add depth and landmarks without obscuring enemy silhouettes.
float gcLine(float value,float center,float width){return 1.-step(width,abs(value-center));}
vec3 godCoreSurface(vec3 q,vec3 c,vec3 h,vec3 normalAmount,float kind,float distance){
 bool horizontal=normalAmount.y>normalAmount.x&&normalAmount.y>normalAmount.z;
 float localY=mod(q.y+.0001,4.);float storey=clamp(floor((q.y+.001)/4.),0.,2.);
 if(kind==21.&&horizontal&&q.y<c.y)kind=22.;
 vec2 coord=horizontal?q.xz:normalAmount.x>normalAmount.z?q.zy:q.xy;
 coord=floor(coord*32.)/32.;
 float grain=hash(floor(coord*32.));
 vec3 iron=vec3(.075,.084,.096),ivory=vec3(.74,.71,.61),brass=vec3(.56,.37,.14);
 vec3 red=vec3(1.,.16,.045),teal=vec3(.065,.75,.78),material=iron;
 vec3 floorAccent=storey<.5?red:storey<1.5?teal:vec3(.52,.35,1.);
 vec3 emission=vec3(0.);
 float pulse=.86+.14*sin(sceneTime*2.4);
 float coreDistance=length(q.xz-vec2(0.,-1.));
 if(kind==21.){
  vec2 tile=fract(coord/2.);
  float grout=step(.026,tile.x)*step(.026,tile.y);
  float checker=mod(floor(coord.x/2.)+floor(coord.y/2.),2.);
  material=mix(vec3(.048,.059,.069),mix(vec3(.14,.16,.18),vec3(.19,.205,.22),checker),grout);
  float centerPath=step(abs(q.x),2.45)*step(2.3,q.z);
  float pathInset=step(abs(q.x),2.28)*step(2.3,q.z);
  material=mix(material,brass,centerPath);
  material=mix(material,ivory*(.88+grain*.08),pathInset);
  float pathJoint=step(.966,fract(q.z*.5));
  material*=1.-pathInset*pathJoint*.42;
  float ring=gcLine(coreDistance,3.05,.055)+gcLine(coreDistance,3.30,.035);
  material=mix(material,brass,min(1.,ring));
  float diamond=abs(q.x)+abs(q.z+1.);
  float rune=gcLine(diamond,2.15,.055);
  material=mix(material,red*.65,rune);emission+=red*rune*.35*pulse;
  float aisle=gcLine(abs(q.x),10.5,.055)*step(abs(q.z),13.6);
  float aisleBreak=step(.13,fract(q.z*.5));
  material=mix(material,teal*.42,aisle);emission+=teal*aisle*aisleBreak*.38;
  float perimeter=gcLine(abs(q.x),13.0,.045)+gcLine(abs(q.z),15.0,.045);
  material=mix(material,brass,min(1.,perimeter)*.8);
 }else if(kind==22.){
  material=vec3(.052,.065,.081);
  float crossRib=step(.94,fract((q.z+1.)/4.));
  float mainRib=gcLine(abs(q.x),3.7,.12)+gcLine(abs(q.x),7.5,.12);
  material=mix(material,ivory*.63,min(1.,crossRib+mainRib));
  float coffer=step(.1,fract((q.z+1.)/4.))*step(fract((q.z+1.)/4.),.9);
  float longLamp=step(abs(q.x),.50)*coffer;
  float centerFrame=step(abs(q.x),.62)*coffer;
  material=mix(material,brass*.75,centerFrame);
  material=mix(material,vec3(.92,.71,.45),longLamp);
  emission+=vec3(.30,.17,.07)*longLamp;
  float aisleLamp=gcLine(abs(q.x),10.5,.085)*coffer;
  material=mix(material,teal*.72,aisleLamp);emission+=teal*aisleLamp*.4;
 }else if(kind==23.){
  float u=coord.x,v=localY;
  float bay=mod(u+2.,4.)-2.;
  float archTop=2.2+sqrt(max(0.,1.15*1.15-bay*bay))*.60;
  float inside=step(abs(bay),1.15)*step(.43,v)*step(v,archTop);
  float outerTop=2.2+sqrt(max(0.,1.38*1.38-bay*bay))*.60;
  float surround=step(abs(bay),1.38)*step(.28,v)*step(v,outerTop);
  material=ivory*(.81+grain*.07);
  float stoneJoint=step(.973,fract(v*1.4))*step(.1,abs(bay));
  material*=1.-stoneJoint*.20;
  material=mix(material,brass*.65,surround);
  material=mix(material,iron*.80,inside);
  float insetPanel=inside*step(.20,fract((u+.5)*1.5));
  material+=vec3(.025,.032,.046)*insetPanel;
  float lowerRail=gcLine(v,.37,.045)+gcLine(v,2.94,.035);
  material=mix(material,brass,min(1.,lowerRail));
  float cross=inside*max(gcLine(bay,0.,.027)*step(.85,v)*step(v,2.38),gcLine(v,1.83,.025)*step(abs(bay),.42));
  material=mix(material,brass,cross);
  float recessLamp=inside*gcLine(abs(bay),1.04,.035)*step(.65,v)*step(v,2.14);
  vec3 accent=abs(q.x)>9.?teal:floorAccent;
  material=mix(material,accent*.56,recessLamp);emission+=accent*recessLamp*.35;
 }else if(kind==24.){
  material=ivory*(.85+grain*.075);
  float flute=step(.18,fract(coord.x*4.));
  material*=.78+flute*.22;
  float collar=gcLine(localY,.22,.075)+gcLine(localY,2.93,.075);
  material=mix(material,brass,min(1.,collar));
  if(horizontal)material=ivory*.69;
 }else if(kind==25.){
  float faceX=normalAmount.x>normalAmount.z?q.z-c.z:q.x-c.x;
  material=iron*(.78+grain*.18);
  float frame=step(.70,abs(faceX))+step(localY,.35)+step(3.04,localY);
  material=mix(material,brass*.64,min(1.,frame));
  float chamber=step(abs(faceX),.56)*step(.55,localY)*step(localY,2.87);
  float hot=pow(max(0.,1.-abs(faceX)/.57),2.);
  float energy=.78+.22*sin(localY*12.-sceneTime*2.2);
  material=mix(material,mix(floorAccent,vec3(1.,.81,.40),hot*.85)*energy,chamber);
  emission+=floorAccent*chamber*.42*pulse+vec3(.32,.12,.015)*hot*chamber;
  float brace=gcLine(localY,.63,.055)+gcLine(localY,1.7,.055)+gcLine(localY,2.78,.055);
  material=mix(material,iron*.65,min(1.,brace));emission*=1.-min(1.,brace);
  float seam=gcLine(abs(faceX),.82,.025)*step(.4,localY)*step(localY,3.0);
  material=mix(material,floorAccent,seam);emission+=floorAccent*seam*.28;
 }else if(kind==26.){
  vec2 tile=fract(coord*1.3);
  float face=step(.055,tile.x)*step(.055,tile.y);
  material=mix(iron*.75,vec3(.21,.23,.25),face);
  float rim=step(c.y+h.y-.13,q.y);
  material=mix(material,ivory*.76,rim);
  float band=gcLine(q.y,c.y+h.y-.25,.045);
  material=mix(material,brass,band);
  float bolts=step(.90,fract(coord.x*2.))*step(.90,fract(coord.y*2.));
  material=mix(material,brass*.67,bolts);
 }else if(kind==27.){
  vec3 local=(q-c)/max(h,vec3(.001));
  vec2 panelUV=normalAmount.x>normalAmount.z?local.zy:local.xy;
  float edge=step(.73,max(abs(panelUV.x),abs(panelUV.y)));
  material=mix(iron,brass,edge);
  float button=step(length(panelUV),.60);
  vec3 relay=mix(vec3(1.,.21,.07),teal,step(.001,godCorePower));
  material=mix(material,relay*(.60+.17*pulse),button);emission+=relay*button*.40;
  float cross=max(gcLine(panelUV.x,0.,.10),gcLine(panelUV.y,0.,.10))*button;
  material=mix(material,vec3(.96,.9,.67),cross);emission+=vec3(.1)*cross;
 }else if(kind==29.){
  material=horizontal?vec3(.29,.31,.32):iron;
  float edge=horizontal?step(h.z-.07,abs(q.z-c.z)):0.;
  material=mix(material,teal*.9,edge);emission+=teal*edge*.28;
  float tread=step(.85,fract(q.x*3.));material*=1.-tread*.14;
 }else if(kind==30.){
  vec2 uv=(q.xy-c.xy)/h.xy;material=iron;
  float number=floor(c.y/4.)+1.,mark=0.;
  for(int numeral=0;numeral<3;numeral++){float f=float(numeral);if(f<number)mark=max(mark,gcLine(uv.x,(f-(number-1.)*.5)*.38,.08)*step(abs(uv.y),.64));}
  float border=step(.89,max(abs(uv.x),abs(uv.y)));
  material=mix(material,floorAccent,min(1.,mark+border));emission+=floorAccent*mark*.28;
 }else if(kind==31.){
  vec2 uv=(q.xy-c.xy)/h.xy;material=iron;
  float direction=(c.x<0.&&c.y<4.)||(c.x>0.&&c.y<8.)?1.:-1.;
  float v=uv.y*direction;
  float shaft=gcLine(uv.x,0.,.085)*step(-.55,v)*step(v,.40);
  float head=gcLine(abs(uv.x)+v,.55,.08)*step(.05,v)*step(v,.56);
  float arrow=max(shaft,head),border=step(.89,max(abs(uv.x),abs(uv.y)));
  material=mix(material,teal,min(1.,arrow+border*.55));emission+=teal*arrow*.35;
 }else if(kind==28.||kind==2.){
  material=vec3(.105,.135,.155)*(1.-step(.90,fract(coord.y*5.))*.33);
  float u=normalAmount.x>normalAmount.z?q.z-c.z:q.x-c.x;
  float halfWidth=normalAmount.x>normalAmount.z?h.z:h.x;
  float edge=step(halfWidth-.14,abs(u));
  material=mix(material,brass,edge);
  float split=gcLine(u,0.,.045);material=mix(material,iron*.45,split);
  float arrow=gcLine(abs(u)+abs(localY-1.7)*.55,.63,.07)*step(abs(u),.80);
  material=mix(material,ivory*.74,arrow);
  float lightStrip=gcLine(localY,2.9,.047)*step(abs(u),halfWidth-.2);
  vec3 doorLight=kind==28.?mix(red,teal,step(.001,godCorePower)):teal;
  material=mix(material,doorLight,lightStrip);emission+=doorLight*lightStrip*.35;
 }
 material*=.965+grain*.07;
 float depthLight=.78+.22/(1.+distance*.018);
 float facing=horizontal?(q.y>2.8?.82:1.):(normalAmount.x>normalAmount.z?.87:1.);
 float coreGlow=lightingQuality<2?0.:exp(-coreDistance*.24)*(.075+.055*pulse);
 vec3 spill=red*coreGlow*(1.-step(2.85,q.y)*.45);
 float sideGlow=lightingQuality<2?0.:exp(-abs(abs(q.x)-10.5)*1.1)*.035;
 spill+=teal*sideGlow;
 // The relay briefly energizes the inlays and side corridor lighting.
 spill+=teal*sideGlow*godCorePower*2.5;
 vec3 lit=material*depthLight*facing+emission+spill;
 return mix(lit,vec3(.07,.027,.033),1.-exp(-distance*.007));
}

void enemyBox(vec3 ro,vec3 rd,vec3 center,vec3 halfSize,vec3 tint,inout float nearest,inout vec3 color){
if(center.y<.85)center.z+=sign(center.x)*enemyStride;else if(abs(center.x)>.3)center.z-=sign(center.x)*enemyStride*.5;
vec3 inv=1./(rd+vec3(.000001));vec3 a=(center-halfSize-ro)*inv,b=(center+halfSize-ro)*inv;vec3 lo=min(a,b),hi=max(a,b);float t=max(lo.x,max(lo.y,lo.z)),exitT=min(hi.x,min(hi.y,hi.z));if(t>0.&&t<exitT&&t<nearest){nearest=t;vec3 q=(ro+rd*t-center)/halfSize;vec3 n=abs(q.x)>abs(q.y)&&abs(q.x)>abs(q.z)?vec3(sign(q.x),0.,0.):abs(q.y)>abs(q.z)?vec3(0.,sign(q.y),0.):vec3(0.,0.,sign(q.z));float light=lightingQuality==0?.82:.48+.52*max(0.,dot(n,normalize(vec3(-.4,.8,1.))));color=tint*light;}}
void main(){vec2 uv=(gl_FragCoord.xy*2.-resolution)/resolution.y;
vec3 forward=vec3(sin(look.x)*cos(look.y),sin(look.y),-cos(look.x)*cos(look.y));vec3 right=vec3(cos(look.x),0.,sin(look.x));vec3 up=cross(right,forward);vec3 originalRight=right;right=right*cos(lean)+up*sin(lean);up=up*cos(lean)-originalRight*sin(lean);vec3 ray=normalize(forward+(.7/zoom)*uv.x*right+(.7/zoom)*uv.y*up);
vec3 sky=mix(vec3(.76,.9,.97),vec3(.19,.55,.87),clamp(ray.y,0.,1.));
if(visualDetail>0&&ray.y>.03){vec2 c=ray.xz/ray.y*1.6;float clouds=noise(c)*.65+noise(c*2.1)*.25+noise(c*4.2)*.1;sky=mix(sky,vec3(1.),smoothstep(.56,.75,clouds)*smoothstep(.03,.18,ray.y));}
if(mapId==1)sky=mix(vec3(.98,.78,.52),vec3(.5,.69,.86),max(0.,ray.y));
if(mapId==2)sky=mix(vec3(.85,.93,.98),vec3(.36,.66,.85),max(0.,ray.y));
if(mapId==3)sky=mix(vec3(.69,.92,.96),vec3(.06,.53,.8),max(0.,ray.y));
if(mapId==4){sky=mix(vec3(.08,.13,.24),vec3(.012,.025,.08),max(0.,ray.y));if(ray.y>.05&&hash(floor(ray.xz/max(.01,ray.y)*220.))>.998)sky+=vec3(.7);float moon=dot(ray,normalize(vec3(-.35,.65,-.7)));sky+=vec3(.8,.86,.95)*smoothstep(.998,.999,moon);}
if(mapId==5){sky=mix(vec3(.68,.88,1.),vec3(.09,.49,.91),clamp(ray.y,0.,1.));float sun=dot(ray,normalize(vec3(-.45,.68,-.6)));sky+=vec3(1.,.82,.46)*pow(max(0.,sun),250.)*1.9;if(visualDetail>0&&ray.y>.12){vec2 cloudUV=ray.xz/ray.y;float puff=noise(cloudUV*.8)*.6+noise(cloudUV*1.8)*.4;sky=mix(sky,vec3(.99),smoothstep(.65,.78,puff)*.85);}}
vec3 color=sky;float actorDepth=10000.;
if(ray.y<0.){float distance=-eye.y/ray.y;vec2 world=eye.xz+ray.xz*distance;float patch=visualDetail==0||distance>detailDistance?.5:noise(world*.22);float blades=visualDetail<2||distance>detailDistance?.5:noise(world*38.);vec3 grass=mix(vec3(.15,.35,.07),vec3(.34,.58,.15),patch);grass+=(blades-.5)*.13/(1.+distance*.035);if(mapId==1){float ripples=sin(world.x*5.+noise(world*.12)*12.);grass=mix(vec3(.64,.4,.18),vec3(.95,.78,.43),patch)+ripples*.025;}
if(mapId==2)grass=mix(vec3(.66,.82,.91),vec3(.96,.99,1.),patch)+blades*.025;
if(mapId==3){float shore=length(world)-24.+noise(world*.16)*5.;if(shore>0.)grass=mix(vec3(.08,.58,.67),vec3(.02,.27,.49),clamp(shore/20.,0.,1.))+sin(world.x*1.8+sin(world.y))*.025;else if(shore>-5.)grass=mix(vec3(.84,.75,.44),vec3(.98,.92,.7),patch);}
if(mapId==4)grass*=vec3(.2,.3,.43);
if(mapId==5){
 grass=mix(vec3(.17,.43,.065),vec3(.37,.66,.14),patch)+blades*.035;
 float deck=step(abs(world.x),10.)*step(-15.,world.y)*step(world.y,2.);
 float houseFloor=step(abs(world.x),8.)*step(-25.,world.y)*step(world.y,-15.);
 float path=step(abs(world.x),1.3)*step(2.,world.y)*step(world.y,10.);
 vec2 tile=fract(world*.8);float grout=step(.035,tile.x)*step(.035,tile.y);
 vec3 paving=mix(vec3(.70,.66,.56),vec3(.94,.88,.73),grout)+noise(world*14.)*.02;
 grass=mix(grass,paving,max(max(deck,houseFloor),path));
 if(abs(world.x)<4.5&&world.y>-11.&&world.y< -1.){
  if(visualDetail==0){grass=vec3(.075,.64,.80);}else{vec2 waterUV=world+vec2(sin(world.y*2.+sceneTime*.9),cos(world.x*2.-sceneTime*.7))*.04;
  float ripple=sin(waterUV.x*8.+sceneTime*1.7+sin(waterUV.y*5.))*sin(waterUV.y*8.-sceneTime*1.3);
  float caustic=pow(abs(ripple),5.);vec2 poolTile=fract(waterUV*2.);float grid=step(.045,poolTile.x)*step(.045,poolTile.y);
  grass=mix(vec3(.055,.51,.73),vec3(.10,.75,.88),grid)+caustic*vec3(.33,.40,.31);
  float edge=min(4.5-abs(world.x),min(world.y+11.,-1.-world.y));grass=mix(vec3(.08,.39,.58),grass,smoothstep(0.,.35,edge));
  float glint=pow(max(0.,sin(waterUV.x*22.+waterUV.y*19.+sceneTime*2.)),28.);if(lightingQuality>0)grass+=vec3(.20,.24,.19)*glint;}
 }
}
for(int i=0;i<24;i++){if(i>=impactCount)break;vec2 hitUV=(world-impactPositions[i])/.65+vec2(.5);if(hitUV.x>0.&&hitUV.x<1.&&hitUV.y>0.&&hitUV.y<1.){vec4 mark=texture2D(impactTex,hitUV);float alpha=1.-smoothstep(.62,.88,max(mark.r,max(mark.g,mark.b)));grass=mix(grass,mark.rgb,alpha*.92);}}
float fog=1.-exp(-distance*.003);color=mix(grass,mapId==0?vec3(.77,.9,.91):sky,fog);}
if(targetBall.w>0.){vec3 oc=eye-targetBall.xyz;float b=dot(oc,ray);float c=dot(oc,oc)-targetBall.w*targetBall.w;float disc=b*b-c;if(disc>=0.){float t=-b-sqrt(disc);float ground=ray.y<0.?-eye.y/ray.y:10000.;if(t>0.&&t<ground){vec3 n=normalize(eye+ray*t-targetBall.xyz);float light=.35+.65*max(0.,dot(n,normalize(vec3(-.4,.8,.5))));actorDepth=t;color=vec3(1.,.035,.025)*light+vec3(.25)*pow(max(0.,dot(n,normalize(vec3(-.4,.8,.5)))),24.);}}}
if(retroMode==1){float nearest=ray.y<0.?-eye.y/ray.y:10000.;for(int i=0;i<12;i++){if(i>=retroEnemyCount)break;vec4 e=retroEnemies[i];float c=cos(e.z),s=sin(e.z);vec3 d=eye-vec3(e.x,e.w,e.y),ro=vec3(c*d.x-s*d.z,d.y,s*d.x+c*d.z),rd=vec3(c*ray.x-s*ray.z,ray.y,s*ray.x+c*ray.z);float t=-ro.z/rd.z;vec3 hit=ro+rd*t;vec2 uv=vec2(hit.x/2.4+.5,1.-hit.y/2.4);if(t>0.&&t<nearest&&uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.){vec4 texel=texture2D(retroTex,uv);if(texel.a>.1&&min(texel.r,min(texel.g,texel.b))<.94){color=texel.rgb;nearest=t;actorDepth=t;}}}}

float wallNearest=10000.;vec3 wallColor=color;vec3 hitCenter=vec3(0.),hitHalf=vec3(1.);float hitKind=0.;
for(int i=0;i<128;i++){if(i>=worldCount)break;vec3 c=worldCenters[i],h=worldSizes[i].xyz;vec3 a=(c-h-eye)/(ray+vec3(.000001)),b=(c+h-eye)/(ray+vec3(.000001));vec3 lo=min(a,b),hi=max(a,b);float t=max(lo.x,max(lo.y,lo.z)),farT=min(hi.x,min(hi.y,hi.z));if(t>0.&&t<farT&&t<wallNearest){wallNearest=t;hitCenter=c;hitHalf=h;hitKind=worldSizes[i].w;}}
if(wallNearest<10000.){float t=wallNearest;vec3 c=hitCenter,h=hitHalf;vec3 q=eye+ray*t;vec3 n=abs((q-c)/h);if(visualDetail==0||t>detailDistance){vec3 base=godCoreArena==1?vec3(.24,.255,.27):mapId==5?vec3(.72,.75,.61):vec3(.30,.34,.32);if(mapId==5&&hitKind==15.)base=vec3(.19,.43,.08);if(mapId==5&&hitKind==18.)base=vec3(.65,.42,.21);if(godCoreArena==1){if(hitKind==21.)base=vec3(.18,.20,.23);if(hitKind==22.)base=vec3(.12,.15,.19);if(hitKind==23.)base=vec3(.61,.59,.52);if(hitKind==25.)base=vec3(.63,.23,.12);if(hitKind==28.)base=vec3(.13,.16,.18);if(hitKind==29.)base=vec3(.44,.42,.36);}wallColor=base*(.72+.18*step(max(n.x,n.z),n.y)+.10*step(max(n.y,n.z),n.x));}else{vec2 uv=n.y>n.x&&n.y>n.z?q.xz:n.x>n.z?q.zy:q.xy;uv=floor(uv*24.)/24.;vec2 panel=fract(uv/2.);float seam=step(.04,panel.x)*step(.04,panel.y);float grit=hash(floor(uv*24.));vec3 metal=mix(vec3(.12,.15,.16),vec3(.32,.36,.34),seam)+grit*.045;float stripe=step(.86,panel.y);metal=mix(metal,vec3(.52,.40,.12),stripe*.65);if(hitKind==2.){metal=mix(vec3(.12,.19,.20),vec3(.30,.40,.42),step(.07,fract(uv.y*3.)));float edge=step(.86,fract(uv.x*.25));metal=mix(metal,vec3(.85,.57,.08),edge*step(.5,fract(uv.y*2.+uv.x)));}if(hitKind==3.)metal=mix(vec3(.3,.34,.29),vec3(.55,.57,.48),seam)*(.8+grit*.2);if(retroMode==1){
if(hitKind==0.){metal=mix(vec3(.12,.13,.20),vec3(.29,.28,.35),seam)+grit*.035;float bolt=step(.91,fract(uv.x))*step(.88,fract(uv.y));metal+=vec3(.19)*bolt;float band=step(.90,fract(uv.y*.5));metal=mix(metal,vec3(.49,.17,.10),band*.8);}
if(hitKind==1.){vec2 tile=fract(uv);float grate=step(.18,fract(uv.x*6.))*step(.18,fract(uv.y*6.));metal=mix(vec3(.055,.07,.08),vec3(.22,.24,.26),grate)*(.8+seam*.2);if(q.y<.1){float lane=step(abs(q.x),2.)+step(abs(q.z),2.);metal=mix(metal,vec3(.53,.34,.09),min(1.,lane)*step(.87,tile.y)*.65);}}
if(hitKind==4.){metal=mix(vec3(.19,.21,.18),vec3(.44,.40,.24),seam);metal=mix(metal,vec3(.12,.12,.11),step(.9,fract(uv.x*.5+uv.y*.5)));}
if(hitKind==5.){float core=step(.12,fract(uv.x))*step(.18,fract(uv.y*.5));metal=mix(vec3(.12,.11,.16),vec3(1.,.32,.045),core);}
if(hitKind==7.){metal=mix(c.x<0.?vec3(.12,.39,.39):vec3(.49,.22,.12),vec3(.1,.14,.16),step(.78,fract(uv.x*3.)));metal*=.8+grit*.2;}if(hitKind==6.){metal=mix(vec3(.15,.17,.19),vec3(.66,.41,.06),step(.75,fract(uv.y)));}
}
if(mapId==5){
 float kind=hitKind;vec2 detail=fract(uv*2.);float mortar=step(.025,detail.x)*step(.025,detail.y);
 if(kind==10.)metal=mix(vec3(.68,.69,.63),vec3(.96,.94,.81),mortar);
 if(kind==11.){
  metal=vec3(.93,.88,.72)*(.93+grit*.06);float siding=step(.92,fract(q.y*6.));metal*=1.-siding*.1;if(q.z< -17.5)metal*=.68;
  float window=step(.82,q.y)*step(q.y,2.7)*step(2.8,abs(q.x))*step(abs(q.x),6.8)*step(-17.5,q.z);
  if(window>.5){vec2 pane=vec2((abs(q.x)-2.8)/4.,(q.y-.82)/1.88);float frame=step(.04,pane.x)*step(pane.x,.96)*step(.06,pane.y)*step(pane.y,.94)*step(.028,abs(pane.x-.5));metal=mix(vec3(.91,.98,.97),mix(vec3(.12,.44,.53),vec3(.52,.84,.91),pane.y),frame);metal+=vec3(.08)*step(.7,fract(pane.x+pane.y));}
 }
 if(kind==12.)metal=mix(vec3(.23,.33,.34),vec3(.36,.48,.46),step(.1,fract(q.x*1.2)));
 if(kind==13.)metal=vec3(.70,.86,.9)+vec3(.18)*pow(abs(sin(q.y*6.)),5.);
 if(kind==14.)metal=vec3(.36,.22,.095)*(.82+grit*.24);
 if(kind==15.)metal=mix(vec3(.12,.34,.045),vec3(.30,.57,.095),grit)*(.9+noise(uv*5.)*.25);
 if(kind==16.)metal=mix(vec3(.98,.93,.70),vec3(.04,.54,.61),step(.5,fract(q.x*3.)));
 if(kind==17.)metal=vec3(.90,.96,.94)*(.90+grit*.08);
 if(kind==18.){float grain=sin(q.z*39.+noise(q.xz*5.)*8.);metal=vec3(.68,.43,.21)*(.93+grain*.035+grit*.065);float joint=step(.97,fract(q.x*3.));metal*=1.-joint*.22;}
 if(kind==19.||kind==20.){vec3 cloth=kind==19.?vec3(.97,.97,.89):vec3(1.,.49,.30),stripe=kind==19.?vec3(.045,.68,.79):vec3(1.,.94,.74);float band=step(.78,fract((q.z-c.z)*4.));metal=mix(cloth,stripe,band);float folds=step(.88,fract(q.y*27.));if(n.y<max(n.x,n.z))metal*=1.-folds*.26;metal*=.94+grit*.06;}
}
float light=lightingQuality==0?.82:.55+.45/(1.+t*.035);if(mapId==5)light=lightingQuality==0?.9:.78+.22/(1.+t*.018);wallColor=metal*light;if(retroMode==1&&n.y>n.x&&n.y>n.z&&q.y>3.){float lamp=step(.28,panel.x)*step(panel.x,.72)*step(.42,panel.y)*step(panel.y,.58);wallColor=mix(wallColor,vec3(.93,.70,.38),lamp);}if(godCoreArena==1)wallColor=godCoreSurface(q,c,h,n,hitKind,t);}}
// World cover and solid actors share one depth. Four fading corpses are
// sorted by their actual ray intersections, not their distance from the camera.
if(wallNearest<actorDepth){color=wallColor;actorDepth=wallNearest;}
if(ray.y<0.)actorDepth=min(actorDepth,-eye.y/ray.y);
float fadeD0=10000.,fadeD1=10000.,fadeD2=10000.,fadeD3=10000.;
vec4 fadeC0=vec4(0.),fadeC1=vec4(0.),fadeC2=vec4(0.),fadeC3=vec4(0.);
for(int actor=0;actor<12;actor++){
 if(actor>=enemyCount)break;
 vec4 enemyPose=enemyPoses[actor];float enemyDeath=enemyPose.w,enemyFire=enemyMotions[actor].x;enemyStride=enemyMotions[actor].y;
 float opacity=1.-smoothstep(.68,1.,enemyDeath);if(opacity<=.001)continue;
 float c=cos(enemyPose.z),s=sin(enemyPose.z);vec3 d=eye-vec3(enemyPose.x,0.,enemyPose.y);
 vec3 ro=vec3(c*d.x-s*d.z,d.y,s*d.x+c*d.z),rd=vec3(c*ray.x-s*ray.z,ray.y,s*ray.x+c*ray.z);
// Inverse-transform rays through the falling model; its floor pivot stays grounded.
if(enemyDeath>0.){float fall=smoothstep(0.,.72,enemyDeath)*1.50,fc=cos(fall),fs=sin(fall);ro.y+=smoothstep(.65,1.,enemyDeath)*.08;vec2 pivot=ro.yz-vec2(.14,0.),direction=rd.yz;ro.yz=vec2(fc*pivot.x-fs*pivot.y,fs*pivot.x+fc*pivot.y)+vec2(.14,0.);rd.yz=vec2(fc*direction.x-fs*direction.y,fs*direction.x+fc*direction.y);}

 // Most screen rays miss this inexpensive box and skip every detailed part.
 vec3 halfBounds=vec3(.60,1.08,.98+abs(enemyStride)),boundCenter=vec3(0.,1.02,.45),inv=1./(rd+vec3(.000001));
 vec3 boundA=(boundCenter-halfBounds-ro)*inv,boundB=(boundCenter+halfBounds-ro)*inv,boundLo=min(boundA,boundB),boundHi=max(boundA,boundB);
 float boundNear=max(boundLo.x,max(boundLo.y,boundLo.z)),boundFar=min(boundHi.x,min(boundHi.y,boundHi.z));
 if(boundFar<=max(0.,boundNear)||boundNear>=actorDepth)continue;
 float nearest=actorDepth;vec3 actorColor=color;
if(friendlyEnemy==1){
vec3 skin=vec3(.91,.64,.42),shirt=vec3(1.,.69,.12),shorts=vec3(.05,.61,.70),hair=vec3(.25,.13,.07);
enemyBox(ro,rd,vec3(0.,1.2,0.),vec3(.29,.37,.18),shirt,nearest,actorColor);
enemyBox(ro,rd,vec3(0.,1.45,.187),vec3(.12,.035,.025),vec3(1.,.94,.65),nearest,actorColor);
enemyBox(ro,rd,vec3(0.,1.17,.19),vec3(.12,.13,.025),vec3(1.,.35,.10),nearest,actorColor);
enemyBox(ro,rd,vec3(-.045,1.20,.22),vec3(.013,.018,.01),vec3(.28,.15,.06),nearest,actorColor);
enemyBox(ro,rd,vec3(.045,1.20,.22),vec3(.013,.018,.01),vec3(.28,.15,.06),nearest,actorColor);
enemyBox(ro,rd,vec3(0.,1.12,.22),vec3(.055,.013,.01),vec3(.28,.15,.06),nearest,actorColor);
enemyBox(ro,rd,vec3(0.,.89,.01),vec3(.28,.07,.18),shorts,nearest,actorColor);
enemyBox(ro,rd,vec3(-.17,.65,0.),vec3(.12,.21,.135),shorts,nearest,actorColor);
enemyBox(ro,rd,vec3(.17,.65,0.),vec3(.12,.21,.135),shorts,nearest,actorColor);
enemyBox(ro,rd,vec3(-.17,.30,0.),vec3(.095,.19,.11),skin,nearest,actorColor);
enemyBox(ro,rd,vec3(.17,.30,0.),vec3(.095,.19,.11),skin,nearest,actorColor);
enemyBox(ro,rd,vec3(-.17,.09,.065),vec3(.135,.09,.21),vec3(.91,.28,.13),nearest,actorColor);
enemyBox(ro,rd,vec3(.17,.09,.065),vec3(.135,.09,.21),vec3(.91,.28,.13),nearest,actorColor);
enemyBox(ro,rd,vec3(-.17,.035,.065),vec3(.137,.025,.215),vec3(.95,.96,.91),nearest,actorColor);
enemyBox(ro,rd,vec3(.17,.035,.065),vec3(.137,.025,.215),vec3(.95,.96,.91),nearest,actorColor);
enemyBox(ro,rd,vec3(-.36,1.36,.1),vec3(.105,.19,.13),shirt,nearest,actorColor);
enemyBox(ro,rd,vec3(.36,1.36,.1),vec3(.105,.19,.13),shirt,nearest,actorColor);
enemyBox(ro,rd,vec3(-.25,1.34,.30),vec3(.105,.085,.22),skin,nearest,actorColor);
enemyBox(ro,rd,vec3(.28,1.34,.25),vec3(.09,.085,.16),skin,nearest,actorColor);
enemyBox(ro,rd,vec3(-.12,1.4,.45),vec3(.1,.075,.1),skin,nearest,actorColor);
enemyBox(ro,rd,vec3(.19,1.36,.32),vec3(.09,.08,.1),skin,nearest,actorColor);
enemyBox(ro,rd,vec3(0.,1.78,0.),vec3(.19,.21,.17),skin,nearest,actorColor);
enemyBox(ro,rd,vec3(0.,1.976,-.012),vec3(.192,.033,.162),hair,nearest,actorColor);
enemyBox(ro,rd,vec3(-.135,1.94,.15),vec3(.055,.025,.025),hair,nearest,actorColor);
enemyBox(ro,rd,vec3(-.075,1.815,.175),vec3(.025,.034,.012),vec3(.10,.08,.045),nearest,actorColor);
enemyBox(ro,rd,vec3(.075,1.815,.175),vec3(.025,.034,.012),vec3(.10,.08,.045),nearest,actorColor);
enemyBox(ro,rd,vec3(-.080,1.83,.189),vec3(.006,.009,.004),vec3(1.),nearest,actorColor);
enemyBox(ro,rd,vec3(.07,1.83,.189),vec3(.006,.009,.004),vec3(1.),nearest,actorColor);
enemyBox(ro,rd,vec3(0.,1.755,.185),vec3(.024,.035,.038),vec3(.96,.65,.43),nearest,actorColor);
enemyBox(ro,rd,vec3(-.137,1.733,.174),vec3(.035,.025,.01),vec3(.99,.47,.33),nearest,actorColor);
enemyBox(ro,rd,vec3(.137,1.733,.174),vec3(.035,.025,.01),vec3(.99,.47,.33),nearest,actorColor);
enemyBox(ro,rd,vec3(0.,1.677,.178),vec3(.065,.017,.012),vec3(.32,.12,.07),nearest,actorColor);
enemyBox(ro,rd,vec3(-.076,1.697,.178),vec3(.013,.022,.012),vec3(.32,.12,.07),nearest,actorColor);
enemyBox(ro,rd,vec3(.076,1.697,.178),vec3(.013,.022,.012),vec3(.32,.12,.07),nearest,actorColor);
vec3 kick=vec3(0.,enemyFire*.04,-enemyFire*.1);
enemyBox(ro,rd,vec3(.15,1.46,.56)+kick,vec3(.12,.115,.25),vec3(.33,.94,.10),nearest,actorColor);
enemyBox(ro,rd,vec3(.15,1.53,.31)+kick,vec3(.14,.15,.14),vec3(.15,.78,.99),nearest,actorColor);
enemyBox(ro,rd,vec3(.15,1.48,.89)+kick,vec3(.065,.065,.10),vec3(1.,.44,.06),nearest,actorColor);
enemyBox(ro,rd,vec3(.15,1.48,1.025)+kick,vec3(.078,.078,.035),vec3(1.,.64,.10),nearest,actorColor);
enemyBox(ro,rd,vec3(.15,1.48,1.065)+kick,vec3(.032,.032,.01),vec3(.02,.28,.36),nearest,actorColor);
enemyBox(ro,rd,vec3(.15,1.30,.5)+kick,vec3(.055,.12,.075),vec3(1.,.48,.07),nearest,actorColor);
if(enemyFire>.2){enemyBox(ro,rd,vec3(.15,1.48,1.20),vec3(.032,.032,.14),vec3(.35,.90,1.),nearest,actorColor);enemyBox(ro,rd,vec3(.12,1.52,1.34),vec3(.025,.025,.03),vec3(.72,.97,1.),nearest,actorColor);enemyBox(ro,rd,vec3(.19,1.44,1.37),vec3(.022,.022,.025),vec3(.72,.97,1.),nearest,actorColor);}
}else{
enemyBox(ro,rd,vec3(0.0,1.2,0.0),vec3(0.29,0.37,0.18),vec3(0.24,0.31,0.26),nearest,actorColor);
enemyBox(ro,rd,vec3(0.0,1.78,0.0),vec3(0.19,0.21,0.17),vec3(0.57,0.43,0.32),nearest,actorColor);
enemyBox(ro,rd,vec3(-0.17,0.43,0.0),vec3(0.12,0.4,0.13),vec3(0.2,0.25,0.22),nearest,actorColor);
enemyBox(ro,rd,vec3(0.17,0.43,0.0),vec3(0.12,0.4,0.13),vec3(0.2,0.25,0.22),nearest,actorColor);
enemyBox(ro,rd,vec3(-0.36,1.36,0.1),vec3(0.105,0.19,0.13),vec3(0.3,0.37,0.29),nearest,actorColor);
enemyBox(ro,rd,vec3(0.36,1.36,0.1),vec3(0.105,0.19,0.13),vec3(0.3,0.37,0.29),nearest,actorColor);
enemyBox(ro,rd,vec3(-0.17,0.09,0.065),vec3(0.135,0.09,0.21),vec3(0.08,0.1,0.09),nearest,actorColor);
enemyBox(ro,rd,vec3(0.17,0.09,0.065),vec3(0.135,0.09,0.21),vec3(0.08,0.1,0.09),nearest,actorColor);
enemyBox(ro,rd,vec3(0.0,1.26,0.195),vec3(0.25,0.25,0.055),vec3(0.12,0.18,0.16),nearest,actorColor);
enemyBox(ro,rd,vec3(0.0,1.94,0.0),vec3(0.21,0.08,0.2),vec3(0.18,0.24,0.2),nearest,actorColor);
enemyBox(ro,rd,vec3(0.0,1.8,0.18),vec3(0.17,0.06,0.022),vec3(0.9,0.12,0.045),nearest,actorColor);
enemyBox(ro,rd,vec3(-0.14,1.09,0.27),vec3(0.08,0.1,0.025),vec3(0.4,0.44,0.28),nearest,actorColor);
enemyBox(ro,rd,vec3(0.14,1.09,0.27),vec3(0.08,0.1,0.025),vec3(0.4,0.44,0.28),nearest,actorColor);
enemyBox(ro,rd,vec3(-0.12,1.4,0.45),vec3(0.1,0.075,0.1),vec3(0.1,0.13,0.11),nearest,actorColor);
enemyBox(ro,rd,vec3(0.19,1.36,0.32),vec3(0.09,0.08,0.1),vec3(0.1,0.13,0.11),nearest,actorColor);



enemyBox(ro,rd,vec3(-0.25,1.36,0.3),vec3(0.105,0.085,0.22),vec3(.29,.35,.28),nearest,actorColor);
enemyBox(ro,rd,vec3(0.28,1.36,0.25),vec3(0.09,0.085,0.16),vec3(.29,.35,.28),nearest,actorColor);
enemyBox(ro,rd,vec3(0.15,1.45,0.24)+vec3(0.,enemyFire*.04,-enemyFire*.1),vec3(0.07,0.075,0.2),vec3(0.18,0.19,0.17),nearest,actorColor);
enemyBox(ro,rd,vec3(0.15,1.48,0.55)+vec3(0.,enemyFire*.04,-enemyFire*.1),vec3(0.085,0.085,0.21),vec3(0.24,0.26,0.24),nearest,actorColor);
enemyBox(ro,rd,vec3(0.15,1.48,0.86)+vec3(0.,enemyFire*.04,-enemyFire*.1),vec3(0.035,0.035,0.15),vec3(0.45,0.46,0.43),nearest,actorColor);
enemyBox(ro,rd,vec3(0.15,1.48,1.025)+vec3(0.,enemyFire*.04,-enemyFire*.1),vec3(0.055,0.05,0.025),vec3(0.12,0.13,0.11),nearest,actorColor);
enemyBox(ro,rd,vec3(0.15,1.3,0.5)+vec3(0.,enemyFire*.04,-enemyFire*.1),vec3(0.055,0.13,0.085),vec3(0.15,0.17,0.14),nearest,actorColor);
enemyBox(ro,rd,vec3(0.15,1.585,0.55)+vec3(0.,enemyFire*.04,-enemyFire*.1),vec3(0.06,0.02,0.2),vec3(0.4,0.42,0.38),nearest,actorColor);
enemyBox(ro,rd,vec3(0.15,1.63,0.38)+vec3(0.,enemyFire*.04,-enemyFire*.1),vec3(0.035,0.045,0.045),vec3(0.08,0.1,0.09),nearest,actorColor);
enemyBox(ro,rd,vec3(0.15,1.6,0.82)+vec3(0.,enemyFire*.04,-enemyFire*.1),vec3(0.025,0.08,0.025),vec3(0.15,0.18,0.14),nearest,actorColor);
if(enemyFire>.2){enemyBox(ro,rd,vec3(.15,1.48,1.12),vec3(.055,.07,.16),vec3(4.,2.5,.5),nearest,actorColor);enemyBox(ro,rd,vec3(.15,1.48,1.10),vec3(.18,.035,.07),vec3(3.,1.4,.12),nearest,actorColor);enemyBox(ro,rd,vec3(.15,1.48,1.10),vec3(.035,.17,.07),vec3(3.,1.4,.12),nearest,actorColor);}
enemyBox(ro,rd,vec3(-0.17,0.55,0.145),vec3(0.09,0.1,0.035),vec3(0.11,0.16,0.14),nearest,actorColor);
enemyBox(ro,rd,vec3(0.17,0.55,0.145),vec3(0.09,0.1,0.035),vec3(0.11,0.16,0.14),nearest,actorColor);
}
 if(nearest<actorDepth){
  if(opacity>=.999){actorDepth=nearest;color=actorColor;}
  else{
   vec4 layer=vec4(actorColor,opacity);
   if(nearest<fadeD0){fadeD3=fadeD2;fadeC3=fadeC2;fadeD2=fadeD1;fadeC2=fadeC1;fadeD1=fadeD0;fadeC1=fadeC0;fadeD0=nearest;fadeC0=layer;}
   else if(nearest<fadeD1){fadeD3=fadeD2;fadeC3=fadeC2;fadeD2=fadeD1;fadeC2=fadeC1;fadeD1=nearest;fadeC1=layer;}
   else if(nearest<fadeD2){fadeD3=fadeD2;fadeC3=fadeC2;fadeD2=nearest;fadeC2=layer;}
   else if(nearest<fadeD3){fadeD3=nearest;fadeC3=layer;}
  }
 }
}
if(fadeD3<actorDepth)color=mix(color,fadeC3.rgb,fadeC3.a);
if(fadeD2<actorDepth)color=mix(color,fadeC2.rgb,fadeC2.a);
if(fadeD1<actorDepth)color=mix(color,fadeC1.rgb,fadeC1.a);
if(fadeD0<actorDepth)color=mix(color,fadeC0.rgb,fadeC0.a);
gl_FragColor=vec4(color,1.);}`);
 fieldProgram=fieldGL.createProgram();fieldGL.attachShader(fieldProgram,vert);fieldGL.attachShader(fieldProgram,frag);fieldGL.linkProgram(fieldProgram);if(!fieldGL.getProgramParameter(fieldProgram,fieldGL.LINK_STATUS))throw new Error(fieldGL.getProgramInfoLog(fieldProgram));fieldGL.useProgram(fieldProgram);
 const buffer=fieldGL.createBuffer();fieldGL.bindBuffer(fieldGL.ARRAY_BUFFER,buffer);fieldGL.bufferData(fieldGL.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),fieldGL.STATIC_DRAW);const attr=fieldGL.getAttribLocation(fieldProgram,'p');fieldGL.enableVertexAttribArray(attr);fieldGL.vertexAttribPointer(attr,2,fieldGL.FLOAT,false,0,0);
 fieldUniforms={visualDetail:fieldGL.getUniformLocation(fieldProgram,'visualDetail'),lightingQuality:fieldGL.getUniformLocation(fieldProgram,'lightingQuality'),detailDistance:fieldGL.getUniformLocation(fieldProgram,'detailDistance'),godCoreArena:fieldGL.getUniformLocation(fieldProgram,'godCoreArena'),godCorePower:fieldGL.getUniformLocation(fieldProgram,'godCorePower'),sceneTime:fieldGL.getUniformLocation(fieldProgram,'sceneTime'),worldCenters:fieldGL.getUniformLocation(fieldProgram,'worldCenters[0]'),worldSizes:fieldGL.getUniformLocation(fieldProgram,'worldSizes[0]'),worldCount:fieldGL.getUniformLocation(fieldProgram,'worldCount'),lean:fieldGL.getUniformLocation(fieldProgram,'lean'),retroEnemies:fieldGL.getUniformLocation(fieldProgram,'retroEnemies[0]'),retroEnemyCount:fieldGL.getUniformLocation(fieldProgram,'retroEnemyCount'),retroMode:fieldGL.getUniformLocation(fieldProgram,'retroMode'),enemyPoses:fieldGL.getUniformLocation(fieldProgram,'enemyPoses[0]'),enemyMotions:fieldGL.getUniformLocation(fieldProgram,'enemyMotions[0]'),enemyCount:fieldGL.getUniformLocation(fieldProgram,'enemyCount'),friendlyEnemy:fieldGL.getUniformLocation(fieldProgram,'friendlyEnemy'),targetBall:fieldGL.getUniformLocation(fieldProgram,'targetBall'),impactCount:fieldGL.getUniformLocation(fieldProgram,'impactCount'),impactPositions:fieldGL.getUniformLocation(fieldProgram,'impactPositions[0]'),mapId:fieldGL.getUniformLocation(fieldProgram,'mapId'),zoom:fieldGL.getUniformLocation(fieldProgram,'zoom'),resolution:fieldGL.getUniformLocation(fieldProgram,'resolution'),eye:fieldGL.getUniformLocation(fieldProgram,'eye'),look:fieldGL.getUniformLocation(fieldProgram,'look')};
 const texture=fieldGL.createTexture();fieldGL.bindTexture(fieldGL.TEXTURE_2D,texture);fieldGL.texParameteri(fieldGL.TEXTURE_2D,fieldGL.TEXTURE_MIN_FILTER,fieldGL.LINEAR);fieldGL.texParameteri(fieldGL.TEXTURE_2D,fieldGL.TEXTURE_MAG_FILTER,fieldGL.LINEAR);fieldGL.texParameteri(fieldGL.TEXTURE_2D,fieldGL.TEXTURE_WRAP_S,fieldGL.CLAMP_TO_EDGE);fieldGL.texParameteri(fieldGL.TEXTURE_2D,fieldGL.TEXTURE_WRAP_T,fieldGL.CLAMP_TO_EDGE);
 fieldGL.texImage2D(fieldGL.TEXTURE_2D,0,fieldGL.RGBA,1,1,0,fieldGL.RGBA,fieldGL.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 const loadImpact=()=>{fieldGL.bindTexture(fieldGL.TEXTURE_2D,texture);fieldGL.texImage2D(fieldGL.TEXTURE_2D,0,fieldGL.RGBA,fieldGL.RGBA,fieldGL.UNSIGNED_BYTE,fieldImpactImage);};if(fieldImpactImage.complete&&fieldImpactImage.naturalWidth)loadImpact();else fieldImpactImage.addEventListener('load',loadImpact,{once:true});fieldGL.uniform1i(fieldGL.getUniformLocation(fieldProgram,'impactTex'),0);const retroTexture=fieldGL.createTexture();const loadRetro=()=>{fieldGL.activeTexture(fieldGL.TEXTURE1);fieldGL.bindTexture(fieldGL.TEXTURE_2D,retroTexture);fieldGL.texParameteri(fieldGL.TEXTURE_2D,fieldGL.TEXTURE_MIN_FILTER,fieldGL.NEAREST);fieldGL.texParameteri(fieldGL.TEXTURE_2D,fieldGL.TEXTURE_MAG_FILTER,fieldGL.NEAREST);fieldGL.texParameteri(fieldGL.TEXTURE_2D,fieldGL.TEXTURE_WRAP_S,fieldGL.CLAMP_TO_EDGE);fieldGL.texParameteri(fieldGL.TEXTURE_2D,fieldGL.TEXTURE_WRAP_T,fieldGL.CLAMP_TO_EDGE);fieldGL.texImage2D(fieldGL.TEXTURE_2D,0,fieldGL.RGBA,fieldGL.RGBA,fieldGL.UNSIGNED_BYTE,fieldRetroEnemyImage);fieldGL.activeTexture(fieldGL.TEXTURE0);};if(fieldRetroEnemyImage.complete)loadRetro();else fieldRetroEnemyImage.addEventListener('load',loadRetro,{once:true});fieldGL.uniform1i(fieldGL.getUniformLocation(fieldProgram,'retroTex'),1);return true;
 }catch(error){fieldRendererFailed=true;fieldGraphicsProfile()?.reportFailure(error);if(fieldProgram&&fieldGL)fieldGL.deleteProgram(fieldProgram);fieldProgram=null;fieldGL=null;document.getElementById('fieldStatus').textContent='3D graphics could not start. Graphics settings are still available; choose Potato and retry Play, or enable browser hardware acceleration.';return false;}
}
const fieldPistolShotAudio="assets/audio/fieldpistolshotaudio-d11776d7b3e1.mp3";
const fieldSniperShotAudio="assets/audio/fieldsnipershotaudio-cee18db7340c.mp3";
const fieldARShotAudio="assets/audio/fieldarshotaudio-eefaff20e694.mp3";
const fieldShotgunShotAudio="assets/audio/fieldshotgunshotaudio-11b38935394d.mp3";
const fieldFriendlyShotAudio="assets/audio/fieldfriendlyshotaudio-b89545e0bc0b.mp3";

let fieldFriendly=fieldStorage.get('friendly')==='true';
function setFieldFriendly(enabled){if(fieldIsGodCore())enabled=false;const changed=fieldFriendly!==Boolean(enabled);if(changed&&(fieldActive||fieldPaused))fieldToMenu();fieldFriendly=Boolean(enabled);if(!fieldFriendly)cancelFieldFriendlyRefill();renderFieldFriendlyAmmo();clearFieldWaterEffects();updateFieldCombatHUD();fieldAimToggled=false;if(fieldSaving)fieldStorage.set('friendly',String(fieldFriendly));for(const input of fieldRoot.querySelectorAll('[data-field-friendly]'))input.checked=fieldFriendly;if(fieldFriendly&&fieldIsRetroMode()){if(fieldActive||fieldPaused)fieldToMenu();fieldMode='normal';fieldPractice=false;}renderFieldModes();saveField();}
function makeFieldFriendlyToggle(){const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:9px;padding:10px 13px;background:#14241bd9;border:1px solid #ffffff44;border-radius:8px;color:white;font-size:14px;cursor:pointer';const input=document.createElement('input');input.type='checkbox';input.dataset.fieldFriendly='';input.checked=fieldFriendly;input.setAttribute('aria-label','Friendly');input.onchange=()=>setFieldFriendly(input.checked);label.append(input,document.createTextNode('Friendly'));label.title='Water guns, cheerful opponents, and a Wetness meter.';return label;}
const fieldFriendlyHome=makeFieldFriendlyToggle();fieldFriendlyHome.style.marginTop='10px';document.getElementById('fieldModeChoices').parentElement.append(fieldFriendlyHome);
function fieldUsesFriendlyShot(source,clipId){return fieldFriendly&&(['pistol','ar','sniper','shotgun','enemyShot','retroEnemy','retroShotgun'].includes(clipId)||[fieldPistolShotAudio,fieldARShotAudio,fieldSniperShotAudio,fieldShotgunShotAudio,fieldEnemyShotAudio,fieldRetroEnemyAudio,fieldRetroShotgunAudio].includes(source));}

// Friendly viewmodels retain the shared responsive sizing and movement sway.
{const img=document.createElement('img');img.id='fieldFriendlyARIdle';img.alt='Friendly AR idle';img.dataset.weaponType='ar';img.dataset.view='idle';img.dataset.friendlyWeapon='';img.src='assets/images/fieldfriendlyaridle-bcff424e4b1c.png';img.hidden=true;img.style.cssText='--weapon-size:55%;right:-2%;bottom:-7%;';document.getElementById('fieldGunMotion').append(img);}
{const img=document.createElement('img');img.id='fieldFriendlyARAim';img.alt='Friendly AR aim';img.dataset.weaponType='ar';img.dataset.view='aim';img.dataset.friendlyWeapon='';img.src='assets/images/fieldfriendlyaraim-a8badb25c88b.png';img.hidden=true;img.style.cssText='--weapon-size:66%;--sight-x:.418;--sight-y:.092;';document.getElementById('fieldGunMotion').append(img);}
{const img=document.createElement('img');img.id='fieldFriendlyPistolIdle';img.alt='Friendly PISTOL idle';img.dataset.weaponType='pistol';img.dataset.view='idle';img.dataset.friendlyWeapon='';img.src='assets/images/fieldfriendlypistolidle-8a96f750522d.png';img.hidden=true;img.style.cssText='--weapon-size:48%;right:-2%;bottom:-8%;';document.getElementById('fieldGunMotion').append(img);}

const fieldRetroARSource="assets/images/fieldretroarsource-44ded1b400e0.png";
const fieldRetroARImages=['idle','aim'].map(view=>{const image=document.createElement('img');image.id=view==='aim'?'fieldRetroARAim':'fieldRetroARIdle';image.src=fieldRetroARSource;image.alt=view==='aim'?'Aiming Retro AR':'Retro AR';image.dataset.weaponType='ar';image.dataset.view=view;image.dataset.backgroundKey='white';image.dataset.retroAr='';if(view==='idle')image.dataset.weaponContentWidth='.40';image.hidden=true;image.style.cssText='image-rendering:pixelated;filter:url(#fieldWhiteKey);--sight-x:.655;--sight-y:.625'+(view==='idle'?';--weapon-size:110%':'');document.getElementById('fieldGunMotion').append(image);return image;});
function updateFieldRetroAR(){const showing=fieldActive&&fieldIsRetroMode()&&fieldEquipped==='ar';for(const image of fieldRetroARImages)image.hidden=!showing||((image.dataset.view==='aim')!==fieldAiming());if(showing){document.getElementById('fieldARIdle').hidden=true;document.getElementById('fieldARAim').hidden=true;}}

function updateFieldFriendlyWeapons(){
 const ar=fieldActive&&fieldFriendly&&fieldEquipped==='ar',pistol=fieldActive&&fieldFriendly&&fieldEquipped==='pistol',aim=fieldAiming();
 document.getElementById('fieldFriendlyARIdle').hidden=!ar||aim;
 document.getElementById('fieldFriendlyARAim').hidden=!ar||!aim;
 document.getElementById('fieldFriendlyPistolIdle').hidden=!pistol;
 if(fieldFriendly){for(const id of ['fieldARIdle','fieldARAim','fieldPistolIdle','fieldPistolAim'])document.getElementById(id).hidden=true;}
}
// Friendly water-fight enemy presentation.
const fieldFriendlyDeathAudio='assets/audio/fieldfriendlydeathaudio-6d6b9a8f4c8e.mp3';
const fieldFriendlyHurtAudio='assets/audio/fieldfriendlyhurtaudio-4e9223b0977a.mp3';
function fieldFriendlyAudioSource(source,clipId){if(fieldUsesFriendlyShot(source,clipId))return fieldFriendlyShotAudio;if(fieldFriendly&&(source===fieldHurtAudio||clipId==='hurt'))return fieldFriendlyHurtAudio;return source;}
const fieldShotSounds=new Set();
function playFieldPistolSound(source=fieldPistolShotAudio,clipId=null){
 const sound=new Audio(fieldFriendlyAudioSource(source,clipId));sound.volume=fieldAudioVolume(source,clipId)*(godCorePowerActive()?.16:1);fieldShotSounds.add(sound);
 const cleanup=()=>fieldShotSounds.delete(sound);
 sound.addEventListener('ended',cleanup,{once:true});sound.addEventListener('error',cleanup,{once:true});sound.play().catch(cleanup);
}
const fieldEnemyParts=[{"zone": "body", "center": [0, 1.2, 0], "half": [0.29, 0.37, 0.18]}, {"zone": "head", "center": [0, 1.78, 0], "half": [0.19, 0.21, 0.17]}, {"zone": "leg", "center": [-0.17, 0.43, 0], "half": [0.12, 0.4, 0.13]}, {"zone": "leg", "center": [0.17, 0.43, 0], "half": [0.12, 0.4, 0.13]}, {"zone": "arm", "center": [-0.36, 1.36, 0.1], "half": [0.105, 0.19, 0.13]}, {"zone": "arm", "center": [0.36, 1.36, 0.1], "half": [0.105, 0.19, 0.13]}, {"zone": "leg", "center": [-0.17, 0.09, 0.065], "half": [0.135, 0.09, 0.21]}, {"zone": "leg", "center": [0.17, 0.09, 0.065], "half": [0.135, 0.09, 0.21]}, {"zone": "body", "center": [0, 1.26, 0.195], "half": [0.25, 0.25, 0.055]}, {"zone": "head", "center": [0, 1.94, 0], "half": [0.21, 0.08, 0.2]}, {"zone": "head", "center": [0, 1.8, 0.18], "half": [0.17, 0.06, 0.022]}, {"zone": "body", "center": [-0.14, 1.09, 0.27], "half": [0.08, 0.1, 0.025]}, {"zone": "body", "center": [0.14, 1.09, 0.27], "half": [0.08, 0.1, 0.025]}, {"zone": "arm", "center": [-0.12, 1.4, 0.45], "half": [0.1, 0.075, 0.1]}, {"zone": "arm", "center": [0.19, 1.36, 0.32], "half": [0.09, 0.08, 0.1]}, {"zone": "leg", "center": [-0.17, 0.55, 0.145], "half": [0.09, 0.1, 0.035]}, {"zone": "leg", "center": [0.17, 0.55, 0.145], "half": [0.09, 0.1, 0.035]}, {"zone": "arm", "center": [-0.25, 1.36, 0.3], "half": [0.105, 0.085, 0.22]}, {"zone": "arm", "center": [0.28, 1.36, 0.25], "half": [0.09, 0.085, 0.16]}];

const fieldRetroMaps={
 godcore:{name:'The Crucible',description:'Three floors · twelve sealed rooms · connected reactor halls',spawn:[0,5.8],doors:[0,4,8].flatMap(y=>[-7,7].flatMap(z=>[-6,6].map(x=>[x,z,y])))},
 reactor:{name:'Reactor Bunker',description:'Central reactor chamber and a looping perimeter corridor',spawn:[0,18],doors:[[0,-12],[0,12],[-10,0],[10,0]]},
 classic:{name:'Bulkhead Corridors',description:'The original four chambers and cross-shaped hallways',spawn:[0,0],doors:[[0,-8],[0,8],[-12,0],[12,0]]},
 cargo:{name:'Cargo Depot',description:'Shipping stacks, narrow aisles, and two loading-bay doors',spawn:[0,20],doors:[[0,-14],[0,14]]}
};
let fieldRetroMap=Object.hasOwn(fieldRetroMaps,fieldStorage.get('retro-map'))?fieldStorage.get('retro-map'):'reactor',fieldPreviewRetroMap=null;
let fieldDoors=fieldRetroMaps[fieldRetroMap].doors.map(([x,z,y=0])=>({x,z,y,open:0}));
function currentRetroMap(){return fieldIsGodCore()?'godcore':!fieldActive&&fieldPreviewRetroMap?fieldPreviewRetroMap:fieldRetroMap;}
function fieldRetroBounds(){return fieldIsGodCore()?[13.7,15.7]:[23.7,23.7];}
let godCoreRelayTime=0;
const godCoreRelay={c:[0,1.55,3.8],h:[.52,.32,.18],kind:27};
function godCoreArenaPower(){return fieldIsGodCore()?Math.min(1,godCoreRelayTime/1.5):0;}
function resetGodCoreArena(){godCoreRelayTime=0;fieldEnemyNavigation=null;if(godCoreNavigation){godCoreNavigation.goal=-1;godCoreNavigation.next=null;}}
function hitGodCoreRelay(projectile,dt){
 if(!fieldIsGodCore()||!fieldActive||projectile.enemy)return false;
 const t=fieldSegmentBox([projectile.x,projectile.y,projectile.z],[projectile.vx*dt,projectile.vy*dt,projectile.vz*dt],godCoreRelay.c,godCoreRelay.h);
 if(t===null)return false;
 const wall=fieldWorldHit(projectile,dt);if(wall!==null&&wall<t-.00001)return false;
 if(godCoreRelayTime<11.5)playFieldPistolSound(fieldMapSelectAudio,'mapSelect');
 godCoreRelayTime=12;return true;
}
// GOD CORE's three storeys share one solid building. Stair treads, floor slabs,
// room walls and doors are used by drawing, movement and projectile collision.
const godCoreStoreyHeight=4,godCoreStairCount=16,godCoreStairRun=11;
const godCoreStairs=[{x:-10.5,z:5.5,direction:-1,base:0},{x:10.5,z:-5.5,direction:1,base:4}];
const godCoreBuildingSolids=(()=>{
 const b=[],box=(x,y,z,hx,hy,hz,kind)=>b.push({c:[x,y,z],h:[hx,hy,hz],kind});
 box(0,-.15,0,14,.15,16,21);box(0,11.85,0,14,.15,16,22);
 for(const x of [-14,14])box(x,5.85,0,.3,5.85,16,23);
 for(const z of [-16,16])box(0,5.85,z,14,5.85,.3,23);
 // Each intermediate slab has one stairwell opening. All other ceiling space is solid.
 for(const [y,x] of [[4,-10.5],[8,10.5]]){
  const left=x-1.7,right=x+1.7;
  box((-14+left)/2,y-.125,0,(left+14)/2,.125,16,21);
  box((right+14)/2,y-.125,0,(14-right)/2,.125,16,21);
  box(x,y-.125,-10.75,1.7,.125,5.25,21);box(x,y-.125,10.75,1.7,.125,5.25,21);
 }
 for(let floor=0;floor<3;floor++){
  const y=floor*4;
  // Four enclosed rooms per floor, each opening through exactly one sliding door.
  for(const z of [-7,7]){
   box(-10.75,y+1.85,z,3.25,1.85,.2,23);box(0,y+1.85,z,4.5,1.85,.2,23);box(10.75,y+1.85,z,3.25,1.85,.2,23);
   box(0,y+1.85,z<0?-11.5:11.5,.2,1.85,4.5,23);
   for(const x of [-6,6])box(x,y+3.55,z,1.5,.15,.22,24);
  }
  box(0,y+1.85,-1,1,1.85,1,25);
  const hallCover=floor===0?[[-4.1,0],[4.1,0]]:floor===1?[[-4.8,-2],[4.8,2]]:[[-3.8,-4.2],[3.8,-4.2]];
  for(const [x,z] of hallCover)box(x,y+.6,z,1,.6,.5,26);
  // A low altar inside every room provides cover without creating another exit.
  for(const side of [-1,1])for(const end of [-1,1]){
   if(floor===0)box(side*7,y+.65,end*12.9,1.8,.65,.6,26);
   else box(side*(floor===1?11.5:2),y+.65,end*11,.6,.65,1.8,26);
  }
  box(0,y+2,-6.755,1.1,.45,.045,30);
 }
 for(const stairs of godCoreStairs)for(let i=0;i<godCoreStairCount;i++){
  const height=(i+1)/4,z=stairs.z+stairs.direction*(i+.5)*godCoreStairRun/godCoreStairCount;
  box(stairs.x,stairs.base+height/2,z,1.7,height/2,godCoreStairRun/godCoreStairCount/2,29);
 }
 for(const stairs of godCoreStairs){
  box(stairs.x,stairs.base+2,stairs.z-stairs.direction*1.255,.75,.46,.045,31);
  box(stairs.x,stairs.base+6,-stairs.z+stairs.direction*1.255,.75,.46,.045,31);
 }
 box(0,.6,3.8,.85,.6,.5,26);b.push(godCoreRelay);
 return b;
})();
function godCoreWorldBoxes(){
 const boxes=godCoreBuildingSolids.slice();
 for(const d of fieldDoors){const half=1.7*(1-d.open);if(half>.005)boxes.push({c:[d.x,(d.y||0)+3.4-half,d.z],h:[1.5,half,.20],kind:28});}
 return boxes;
}
function godCoreSupportHeight(x,z,feet,maxRise=.32,radius=.3){
 let support=0;
 for(const b of godCoreBuildingSolids){const top=b.c[1]+b.h[1];if(top<=feet+maxRise+.0001&&top>support&&Math.abs(x-b.c[0])<b.h[0]+radius&&Math.abs(z-b.c[2])<b.h[2]+radius)support=top;}
 return support;
}
// Player feet follow a continuous ramp while the visible treads remain solid
// for enemies and projectiles. The radius offset joins both landings without a bump.
function godCorePlayerStairHeight(x,z,radius=.3){
 let top=null;
 for(const stair of godCoreStairs){
  const along=(z-stair.z)*stair.direction;
  if(Math.abs(x-stair.x)>=1.7+radius||along<-radius||along>godCoreStairRun+radius)continue;
  const height=stair.base+4*Math.max(0,Math.min(1,(along+radius)/godCoreStairRun));
  top=top===null?height:Math.max(top,height);
 }
 return top;
}
function godCorePlayerSupportHeight(x,z,feet,maxRise=.32,radius=.3){
 let support=0;
 for(const b of godCoreBuildingSolids){
  if(b.kind===29)continue;
  const top=b.c[1]+b.h[1];
  if(top<=feet+maxRise+.0001&&top>support&&Math.abs(x-b.c[0])<b.h[0]+radius&&Math.abs(z-b.c[2])<b.h[2]+radius)support=top;
 }
 const ramp=godCorePlayerStairHeight(x,z,radius);
 if(ramp!==null&&ramp<=feet+maxRise+.0001)support=Math.max(support,ramp);
 return support;
}
function godCorePlayerBlocked(x,z,y,height=1.7,radius=.3){
 const [bx,bz]=fieldRetroBounds();if(Math.abs(x)>bx-radius||Math.abs(z)>bz-radius)return true;
 const ramp=godCorePlayerStairHeight(x,z,radius);
 return fieldWorldBoxes().some(b=>!(b.kind===29&&ramp!==null&&y>=ramp-.05)&&b.c[1]+b.h[1]>y+.05&&b.c[1]-b.h[1]<y+height&&Math.abs(x-b.c[0])<b.h[0]+radius&&Math.abs(z-b.c[2])<b.h[2]+radius);
}
function moveGodCoreBody(body,dx,dz,height=1.7){
 const player=body===fieldPose,supportHeight=player?godCorePlayerSupportHeight:godCoreSupportHeight;let feet=player?fieldHeight-1.7:body.y||0;
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
 for(let step=0;step<steps;step++)for(const axis of ['x','z']){
  const delta=(axis==='x'?dx:dz)/steps;if(!delta)continue;
  const x=body.x+(axis==='x'?delta:0),z=body.z+(axis==='z'?delta:0),ground=supportHeight(x,z,feet),standing=(!player||fieldVelocity<=0)&&Math.abs(feet-supportHeight(body.x,body.z,feet,.035))<.04;
  const nextFeet=standing&&ground>=feet-.34?ground:feet;
  // Enemies stay on the stair route instead of dropping off its sides.
  if(!player&&ground<feet-.34)continue;
  if((player?godCorePlayerBlocked:fieldBlocked)(x,z,nextFeet,height,.3))continue;
  body.x=x;body.z=z;feet=nextFeet;
 }
 if(player){if(Math.abs(fieldHeight-(feet+1.7))>.00001){fieldHeight=feet+1.7;fieldVelocity=0;}}
 else body.y=feet;
}
let godCoreNavigation=null;
function godCoreNavigationGraph(){
 if(godCoreNavigation)return godCoreNavigation;
 const nodes=[],columns=new Map(),walls=godCoreBuildingSolids;
 const add=(x,z,y)=>{const key=x+':'+z,at=columns.get(key)||[];if(at.some(id=>Math.abs(nodes[id].y-y)<.01))return;const id=nodes.length;nodes.push({x,z,y,links:[]});at.push(id);columns.set(key,at);};
 for(let floor=0;floor<3;floor++)for(let zi=-30;zi<=30;zi++)for(let xi=-26;xi<=26;xi++){
  const x=xi*.5,z=zi*.5,base=floor*4;let y=base;
  const stairs=godCoreStairs.find(s=>s.base===base&&Math.abs(x-s.x)<1.7+.3&&Math.abs(z)<5.5+.3);
  if(stairs){const along=(z-stairs.z)*stairs.direction+.3;y=base+Math.min(16,Math.max(1,Math.ceil(along/11*16)))/4;}
  else if(Math.abs(godCoreSupportHeight(x,z,base,.01)-base)>.025)continue;
  y=godCoreSupportHeight(x,z,y,.01);
  if(walls.some(b=>b.c[1]+b.h[1]>y+.05&&b.c[1]-b.h[1]<y+2.3&&Math.abs(x-b.c[0])<b.h[0]+.3&&Math.abs(z-b.c[2])<b.h[2]+.3))continue;
  add(x,z,y);
 }
 for(const n of nodes)for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]])for(const id of columns.get((n.x+dx)+':'+(n.z+dz))||[]){if(Math.abs(nodes[id].y-n.y)<=.26)n.links.push(id);}
 godCoreNavigation={nodes,goal:-1,next:null};return godCoreNavigation;
}
function godCoreNearestNode(x,z,y){
 const {nodes}=godCoreNavigationGraph();let best=-1,distance=Infinity;
 for(let i=0;i<nodes.length;i++){const n=nodes[i],d=(n.x-x)**2+(n.z-z)**2+9*(n.y-y)**2;if(d<distance){best=i;distance=d;}}
 return best;
}
function godCoreEnemyRoute(e){
 const graph=godCoreNavigationGraph(),{nodes}=graph,goal=godCoreNearestNode(fieldPose.x,fieldPose.z,fieldHeight-1.7),start=godCoreNearestNode(e.x,e.z,e.y||0);
 if(start<0||goal<0)return [];
 if(graph.goal!==goal){
  const next=new Int32Array(nodes.length);next.fill(-1);const queue=new Int32Array(nodes.length);let read=0,write=0;queue[write++]=goal;next[goal]=goal;
  while(read<write){const at=queue[read++];for(const id of nodes[at].links)if(next[id]<0){next[id]=at;queue[write++]=id;}}
  graph.goal=goal;graph.next=next;
 }
 if(graph.next[start]<0)return [];
 const route=[];let at=start;for(let count=0;at!==goal&&count<nodes.length;count++){at=graph.next[at];route.push(nodes[at]);}return route;
}
function spawnGodCoreEnemy(e){
 const {nodes}=godCoreNavigationGraph(),playerY=fieldHeight-1.7;
 const preferCurrent=fieldRetroWave<3||Math.random()<.55;
 const valid=n=>Math.abs(n.y/4-Math.round(n.y/4))<.01&&Math.hypot(n.x-fieldPose.x,n.y-playerY,n.z-fieldPose.z)>5&&!fieldBlocked(n.x,n.z,n.y,2.3,.4)&&fieldRetroEnemies.every(other=>other===e||Math.hypot(other.x-n.x,(other.y||0)-n.y,other.z-n.z)>1.25);
 let choice=null;
 // Prefer the player's current floor, while later waves populate the whole building.
 for(let attempt=0;attempt<240;attempt++){const n=nodes[Math.floor(Math.random()*nodes.length)];if(!valid(n)||preferCurrent&&attempt<100&&Math.abs(n.y-playerY)>2.5)continue;choice=n;break;}
 if(!choice)choice=nodes.find(valid);if(!choice)return false;
 e.x=choice.x;e.y=choice.y;e.z=choice.z;e.yaw=Math.atan2(fieldPose.x-e.x,fieldPose.z-e.z);e.path=null;e.pathTimer=0;e.patrolTimer=0;return true;
}
function walkGodCoreEnemy(e,dt){
 if(!Number.isFinite(e.y)||!Number.isFinite(e.x)||!Number.isFinite(e.z)||fieldBlocked(e.x,e.z,e.y,2.3,.27)){if(!spawnGodCoreEnemy(e))return;}
 const distance=Math.hypot(e.x-fieldPose.x,e.y-(fieldHeight-1.7),e.z-fieldPose.z),visible=fieldEnemyLineOfSight(e,1.97);
 if(visible&&distance<(godCorePowerActive()?3:6.5))return;
 e.pathTimer=(e.pathTimer||0)-dt;
 if(e.pathTimer<=0||!e.path?.length){e.path=godCoreEnemyRoute(e);e.pathTimer=.65;}
 // Do not skip the landing waypoint while still standing on the preceding tread.
 while(e.path?.length&&Math.hypot(e.path[0].x-e.x,e.path[0].z-e.z)<.14&&Math.abs(e.path[0].y-e.y)<.04)e.path.shift();
 if(!e.path?.length)return;
 const next=e.path[0],dx=next.x-e.x,dz=next.z-e.z,length=Math.hypot(dx,dz),step=Math.min(length,(godCorePowerActive()?3.8:1.8)*dt),oldX=e.x,oldZ=e.z;
 if(length>.0001)moveGodCoreBody(e,dx/length*step,dz/length*step,2.3);
 const moved=Math.hypot(e.x-oldX,e.z-oldZ);e.walkPhase=(e.walkPhase||0)+moved*5;e.stride=moved>.0001?Math.sin(e.walkPhase)*.13:0;
 if(moved<step*.1)e.pathTimer=0;
}
function godCoreBlastDistance(origin,enemy){
 const dx=enemy.x-origin.x,dy=(enemy.y||0)+1.2-origin.y,dz=enemy.z-origin.z;
 const hit=fieldWorldHit({x:origin.x,y:origin.y,z:origin.z,vx:dx,vy:dy,vz:dz},1);
 return hit!==null&&hit<.999?Infinity:Math.hypot(dx,dy,dz);
}


function selectRetroMap(id){if(fieldIsGodCore())id='godcore';else if(id==='godcore')return;if(!Object.hasOwn(fieldRetroMaps,id))return;fieldRetroMap=id;fieldPreviewRetroMap=null;fieldDoors=fieldRetroMaps[id].doors.map(([x,z,y=0])=>({x,z,y,open:0}));if(fieldSaving)fieldStorage.set('retro-map',id);renderFieldMapChoices();}

const fieldPoolBounds=Object.freeze({minX:-4.5,maxX:4.5,minZ:-11,maxZ:-1});
// Poolside towel station. Shared geometry and interaction position, measured from the tabletop edge.
const fieldTowelTable=Object.freeze({x:7,z:1,halfX:1.2,halfZ:.65,topY:1,reach:1.15});
function fieldNearTowel(){const t=fieldTowelTable,dx=Math.max(0,Math.abs(fieldPose.x-t.x)-t.halfX),dz=Math.max(0,Math.abs(fieldPose.z-t.z)-t.halfZ);return Math.hypot(dx,dz)<=t.reach&&fieldHeight-1.7<=.5;}

function fieldNearPool(){const b=fieldPoolBounds,x=Math.max(b.minX,Math.min(b.maxX,fieldPose.x)),z=Math.max(b.minZ,Math.min(b.maxZ,fieldPose.z));return Math.hypot(fieldPose.x-x,fieldPose.z-z)<=1.25&&fieldHeight-1.7<=.5;}
function fieldBuildWorldBoxes(){
 if(fieldIsGodCore()&&fieldIsRetroMode())return godCoreWorldBoxes();
 const b=[];const box=(x,y,z,hx,hy,hz,kind=0)=>b.push({c:[x,y,z],h:[hx,hy,hz],kind});
 if(fieldFriendly&&!fieldIsRetroMode()){
 // Pool, house, garden and towel table: 32 shared render/collision boxes.
 for(const x of [-4.75,4.75])box(x,.12,-6,.25,.12,5.5,10);
 for(const z of [-11.25,-.75])box(0,.12,z,4.5,.12,.25,10);
 box(-8,1.8,-21,.22,1.8,4,11);box(8,1.8,-21,.22,1.8,4,11);box(0,1.8,-25,8,1.8,.22,11);
 box(-5,1.8,-17,3,1.8,.22,11);box(5,1.8,-17,3,1.8,.22,11);box(0,3.1,-17,2,.5,.22,11);
 box(0,3.9,-21,8.7,.35,4.7,12);
 for(const x of [3.15,3.8])box(x,.58,-.63,.045,.58,.045,13);box(3.48,.42,-.6,.37,.04,.07,13);
 for(const [x,z] of [[-12,-9],[12,-13],[-13,-24]]){box(x,1.35,z,.24,1.35,.24,14);box(x,3.55,z,1.65,1.35,1.65,15);}
 for(const x of [-7,7]){box(x,.4,-5,.7,.12,1.6,16);box(x,.84,-6.4,.7,.55,.2,16);}
 for(const x of [-17,17])box(x,.7,-14,.6,.7,10,15);
 box(0,.42,-12.1,.6,.12,1.45,17);
 const towel=fieldTowelTable;
 box(towel.x,towel.topY-.09,towel.z,towel.halfX,.09,towel.halfZ,18);
 for(const side of [-1,1])box(towel.x+side*(towel.halfX-.16),.41,towel.z,.09,.41,towel.halfZ-.10,18);
 box(towel.x-.49,towel.topY+.12,towel.z-.03,.38,.12,.43,19);
 box(towel.x+.48,towel.topY+.075,towel.z+.05,.31,.075,.38,20);
 return b;
 }
 if(fieldIsRetroMode()){
 const map=currentRetroMap();
 box(0,-.15,0,24,.15,24,1);box(0,3.55,0,24,.15,24,1);
 box(-24,1.7,0,.3,1.7,24);box(24,1.7,0,.3,1.7,24);box(0,1.7,-24,24,1.7,.3);box(0,1.7,24,24,1.7,.3);
 if(map==='classic'){
 for(const z of [-8,8]){box(-11.5,1.7,z,9.5,1.7,.35);box(11.5,1.7,z,9.5,1.7,.35);}
 for(const x of [-12,12]){box(x,1.7,-11.5,.35,1.7,9.5);box(x,1.7,11.5,.35,1.7,9.5);}
 }else if(map==='cargo'){
 for(const z of [-14,14]){box(-13,1.7,z,11,1.7,.35);box(13,1.7,z,11,1.7,.35);}
 for(const x of [-8,8])for(const z of [-6,6])box(x,1.45,z,2,1.45,4,7);
 for(const x of [-18,18])for(const z of [-5,5])box(x,1.1,z,2,1.1,3,7);
 for(const [x,z] of [[-3,-9],[3,3],[-4,8],[4,-4]])box(x,.65,z,1,.65,1,4);
 }else{
 for(const z of [-12,12]){box(-6,1.7,z,4,1.7,.35);box(6,1.7,z,4,1.7,.35);}
 for(const x of [-10,10]){box(x,1.7,-7,.35,1.7,5);box(x,1.7,7,.35,1.7,5);}
 for(const x of [-5,5])for(const z of [-6,6])box(x,1.7,z,.65,1.7,.65,6);
 box(0,1.7,0,1.6,1.7,1.6,5);
 for(const x of [-17,17])for(const z of [-17,17])box(x,.7,z,2,.7,1,4);
 for(const x of [-21,21])for(const z of [-5,5])box(x,.55,z,1,.55,2,4);
 }
 const doors=!fieldActive&&fieldPreviewRetroMap?fieldRetroMaps[map].doors.map(([x,z,y=0])=>({x,z,y,open:0})):fieldDoors;
 for(const d of doors){const side=d.z===0;box(d.x,1.7+d.open*3.5,d.z,side?.3:2,1.7,side?2:.3,2);}
 }else if(fieldMode==='normal'){
 for(const a of [[-4,-6,2,.65,.4],[5,-10,2,1.5,.4],[-9,2,.4,1.6,3],[9,4,.4,1.3,3],[0,10,3,.65,.4],[-12,-14,2,1.4,.5],[14,-17,2,.8,1],[3,17,1,1,1]])box(a[0],a[3],a[1],a[2],a[3],a[4],3);
 const extraCover=[[0.0, 18.0, 2.2, 0.7, 0.45], [12.73, 12.73, 0.65, 1.5, 2.2], [18.0, 0.0, 2.2, 1.5, 0.45], [12.73, -12.73, 0.65, 0.7, 2.2], [0.0, -18.0, 2.2, 1.5, 0.45], [-12.73, -12.73, 0.65, 1.5, 2.2], [-18.0, -0.0, 2.2, 0.7, 0.45], [-12.73, 12.73, 0.65, 1.5, 2.2], [5.89, 26.35, 2.2, 1.5, 0.45], [22.8, 14.47, 0.65, 1.5, 2.2], [26.35, -5.89, 2.2, 0.7, 0.45], [14.47, -22.8, 0.65, 1.5, 2.2], [-5.89, -26.35, 2.2, 1.5, 0.45], [-22.8, -14.47, 0.65, 0.7, 2.2], [-26.35, 5.89, 2.2, 1.5, 0.45], [-14.47, 22.8, 0.65, 1.5, 2.2], [15.33, 32.57, 2.2, 1.5, 0.45], [33.87, 12.19, 0.65, 0.7, 2.2], [32.57, -15.33, 2.2, 1.5, 0.45], [12.19, -33.87, 0.65, 1.5, 2.2], [-15.33, -32.57, 2.2, 0.7, 0.45], [-33.87, -12.19, 0.65, 1.5, 2.2], [-32.57, 15.33, 2.2, 1.5, 0.45], [-12.19, 33.87, 0.65, 0.7, 2.2]];
 for(const a of extraCover)box(a[0],a[3],a[1],a[2],a[3],a[4],3);
 }return b;
}
function fieldBlocked(x,z,y=0,height=1.7,radius=.3){if(fieldIsRetroMode()){const [bx,bz]=fieldRetroBounds();if(Math.abs(x)>bx-radius||Math.abs(z)>bz-radius)return true;}return fieldWorldBoxes().some(b=>b.c[1]+b.h[1]>y+.05&&b.c[1]-b.h[1]<y+height&&Math.abs(x-b.c[0])<b.h[0]+radius&&Math.abs(z-b.c[2])<b.h[2]+radius);}
function fieldMoveBody(body,dx,dz,y=0,height=1.7){if(fieldIsGodCore()){moveGodCoreBody(body,dx,dz,height);return;}if(!fieldBlocked(body.x+dx,body.z,y,height))body.x+=dx;if(!fieldBlocked(body.x,body.z+dz,y,height))body.z+=dz;}
function fieldWorldHit(b,dt){let near=null;for(const wall of fieldWorldBoxes()){const t=fieldSegmentBox([b.x,b.y,b.z],[b.vx*dt,b.vy*dt,b.vz*dt],wall.c,wall.h);if(t!==null&&(near===null||t<near))near=t;}return near;}
function updateFieldDoors(dt){if(!fieldIsRetroMode())return;godCoreRelayTime=Math.max(0,godCoreRelayTime-dt);for(const d of fieldDoors){const near=(fieldIsGodCore()&&godCoreRelayTime>0)||(Math.hypot(fieldPose.x-d.x,fieldPose.z-d.z)<4&&(!fieldIsGodCore()||Math.abs(fieldHeight-1.7-(d.y||0))<2))||fieldRetroEnemies.some(e=>Math.hypot(e.x-d.x,e.z-d.z)<3&&(!fieldIsGodCore()||Math.abs((e.y||0)-(d.y||0))<2));d.open=Math.max(0,Math.min(1,d.open+(near?1:-1)*dt*1.5));}}
function fieldEnemyLineOfSight(e,sourceHeight=1.4){if(fieldIsGodCore())sourceHeight+=e.y||0;
 const targetHeight=fieldHeight-fieldCrouchOffset-.15;
 return fieldWorldHit({x:e.x,y:sourceHeight,z:e.z,vx:fieldPose.x-e.x,vy:targetHeight-sourceHeight,vz:fieldPose.z-e.z},1)===null;
}
function fieldSafeSpawn(e){if(fieldIsGodCore()){spawnGodCoreEnemy(e);return;}
 const radius=fieldIsRetroMode()?.55:.5,height=fieldIsRetroMode()?2.3:2.05;
 const valid=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&!fieldBlocked(x,z,0,height,radius)&&Math.hypot(x-fieldPose.x,z-fieldPose.z)>4.5;
 const visible=(x,z)=>fieldEnemyLineOfSight({x,z});
 const place=(x,z)=>{e.x=x;e.z=z;e.yaw=Math.atan2(fieldPose.x-x,fieldPose.z-z);e.patrolTimer=0;e.pathTimer=0;e.path=null;};
 if(valid(e.x,e.z)&&visible(e.x,e.z)){place(e.x,e.z);return;}
 let fallback=null;
 // Keep spawns all around the player, but out of solid geometry and in a reachable sightline.
 for(let i=0;i<160;i++){const angle=Math.random()*Math.PI*2,distance=5+Math.random()*11,x=fieldPose.x+Math.sin(angle)*distance,z=fieldPose.z+Math.cos(angle)*distance;if(!valid(x,z))continue;fallback??=[x,z];if(visible(x,z)){place(x,z);return;}}
 const [bx,bz]=fieldRetroBounds(),bounds=fieldIsRetroMode()?[-Math.floor(bx-1),Math.floor(bx-1),-Math.floor(bz-1),Math.floor(bz-1)]:[fieldPose.x-20,fieldPose.x+20,fieldPose.z-20,fieldPose.z+20];
 for(let z=bounds[2];z<=bounds[3];z+=1)for(let x=bounds[0];x<=bounds[1];x+=1){if(!valid(x,z))continue;fallback??=[x,z];if(visible(x,z)){place(x,z);return;}}
 if(fallback){place(...fallback);return;}
 // A player in a very narrow recess can leave no clear sightline; use the nearest open tile.
 for(let z=bounds[2];z<=bounds[3];z++)for(let x=bounds[0];x<=bounds[1];x++)if(!fieldBlocked(x,z,0,height,radius)){place(x,z);return;}
}
let fieldEnemyNavigation=null;
function fieldEnemyRoute(e){if(fieldIsGodCore())return godCoreEnemyRoute(e);
 const retro=fieldIsRetroMode(),cx=retro?0:Math.round(fieldPose.x/24)*24,cz=retro?0:Math.round(fieldPose.z/24)*24,extent=retro?(fieldIsGodCore()?15:22):48;
 const key=[fieldMode,fieldFriendly,retro?currentRetroMap():'',cx,cz].join(':');
 if(fieldEnemyNavigation?.key!==key){
  const size=extent*2+1,x0=cx-extent,z0=cz-extent,open=new Uint8Array(size*size),walls=fieldWorldBoxes().filter(b=>b.kind!==2&&b.kind!==28&&b.c[1]+b.h[1]>.05&&b.c[1]-b.h[1]<2.3);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++)open[z*size+x]=(!fieldIsGodCore()||(Math.abs(x+x0)<=13.15&&Math.abs(z+z0)<=15.15))&&!walls.some(b=>Math.abs(x+x0-b.c[0])<b.h[0]+.55&&Math.abs(z+z0-b.c[2])<b.h[2]+.55);
  fieldEnemyNavigation={key,size,x0,z0,open};
 }
 const {size,x0,z0,open}=fieldEnemyNavigation;
 const nearest=(wx,wz)=>{const x=Math.round(wx-x0),z=Math.round(wz-z0);let best=-1,distance=Infinity;for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,nz=z+dz,id=nz*size+nx;if(nx<0||nx>=size||nz<0||nz>=size||!open[id])continue;const d=(nx+x0-wx)**2+(nz+z0-wz)**2;if(d<distance){best=id;distance=d;}}return best;};
 const start=nearest(e.x,e.z),goal=nearest(fieldPose.x,fieldPose.z);if(start<0||goal<0)return [];
 const previous=new Int32Array(open.length);previous.fill(-1);const queue=new Int32Array(open.length);let read=0,write=0;queue[write++]=start;previous[start]=start;
 while(read<write&&previous[goal]===-1){const at=queue[read++],x=at%size,z=Math.floor(at/size);for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){const nx=x+dx,nz=z+dz,next=nz*size+nx;if(nx<0||nx>=size||nz<0||nz>=size||!open[next]||previous[next]!==-1)continue;previous[next]=at;queue[write++]=next;}}
 if(previous[goal]===-1)return [];
 const route=[];for(let at=goal;at!==start;at=previous[at])route.push({x:at%size+x0,z:Math.floor(at/size)+z0});route.reverse();return route;
}


const fieldDamage={pistol:{head:60,body:28,arm:12,leg:12},ar:{head:40,body:20,arm:8,leg:8},sniper:{head:200,body:75,arm:35,leg:35},shotgun:{head:200,body:14,arm:6,leg:6}};

const fieldNormalEnemies=[],fieldNormalDyingEnemies=[];
let fieldNormalWave=1,fieldNormalPending=0,fieldNormalCleared=false,fieldNormalIntermission=0;
const fieldNormalWaveHUD=document.createElement('div');fieldNormalWaveHUD.id='fieldNormalWaveHUD';fieldNormalWaveHUD.hidden=true;fieldNormalWaveHUD.style.cssText='position:absolute;top:22px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;color:white;text-align:center;text-shadow:0 2px 4px #000;font-family:monospace;width:max-content;max-width:calc(100% - 32px)';fieldRoot.append(fieldNormalWaveHUD);
const fieldNormalWaveTitle=document.createElement('div'),fieldNormalWaveDetail=document.createElement('div');fieldNormalWaveTitle.style.cssText='font-size:clamp(28px,3.5vw,44px);line-height:1.12;font-weight:900';fieldNormalWaveDetail.style.cssText='margin-top:6px;font-size:clamp(11px,1.2vw,15px);font-weight:bold';fieldNormalWaveHUD.append(fieldNormalWaveTitle,fieldNormalWaveDetail);
function updateNormalWaveHUD(){fieldNormalWaveHUD.hidden=fieldMode!=='normal'||(!fieldActive&&!fieldPaused);if(fieldNormalWaveHUD.hidden)return;fieldNormalWaveTitle.textContent='WAVE '+fieldNormalWave;const remaining=fieldNormalEnemies.length+fieldNormalPending;fieldNormalWaveDetail.textContent=fieldNormalCleared?'NEXT WAVE IN '+Math.ceil(fieldNormalIntermission):remaining+' '+(remaining===1?'ENEMY':'ENEMIES');}
function resetNormalWaves(){fieldNormalEnemies.length=0;fieldNormalDyingEnemies.length=0;fieldNormalWave=1;fieldNormalPending=0;fieldNormalCleared=false;fieldNormalIntermission=0;fieldEnemy=null;fieldDyingEnemy=null;fieldNormalWaveHUD.hidden=true;}
function createFieldEnemy(){
 // Keep half the arrivals in front and spread the rest around the player.
 const offset=Math.random()<.5?(Math.random()-.5)*1.2:(Math.random()*2-1)*Math.PI,angle=fieldPose.yaw+offset,distance=10+Math.random()*6;
 const e={x:fieldPose.x+Math.sin(angle)*distance,z:fieldPose.z-Math.cos(angle)*distance,yaw:angle+Math.PI,health:200,fireTimer:3,walkPhase:0,stride:0,patrolTimer:0};fieldSafeSpawn(e);return e;
}
function spawnFieldEnemy(){fieldDyingEnemy=null;fieldEnemy=createFieldEnemy();fieldEnemyRespawn=0;return fieldEnemy;}
function normalEnemyFireInterval(){return Math.max(1,3-(fieldNormalWave-1)*.12);}
function fillNormalEnemies(){
 while(fieldNormalPending>0&&fieldNormalEnemies.length<8){let enemy=null;for(let attempt=0;attempt<40;attempt++){const candidate=createFieldEnemy();if(!fieldBlocked(candidate.x,candidate.z,0,2.05,.5)&&Math.hypot(candidate.x-fieldPose.x,candidate.z-fieldPose.z)>4.5&&fieldNormalEnemies.every(e=>Math.hypot(e.x-candidate.x,e.z-candidate.z)>1.4)){enemy=candidate;break;}}if(!enemy)break;enemy.fireTimer=normalEnemyFireInterval()+fieldNormalEnemies.length*.25;fieldNormalEnemies.push(enemy);fieldNormalPending--;}
 fieldEnemy=fieldNormalEnemies[0]||null;
}
function beginNormalWave(){fieldNormalPending=2+fieldNormalWave;fieldNormalIntermission=0;fieldNormalCleared=false;fieldEnemyShots.length=0;fillNormalEnemies();if(fieldRun){fieldRun.wave=fieldNormalWave;fieldRun.friendly=fieldFriendly;}updateNormalWaveHUD();saveField();}
function startNormalWaves(){resetNormalWaves();beginNormalWave();}
function defeatNormalEnemy(e){
 const index=fieldNormalEnemies.indexOf(e);if(index<0)return false;e.health=0;fieldNormalEnemies.splice(index,1);
 if(fieldFriendly){playFieldPistolSound(fieldFriendlyDeathAudio,'friendlyEnemyDeath');burstFieldWaterEnemy(e);}else{fieldNormalDyingEnemies.push({...e,deathAge:0,deathDuration:.9,shotFlash:0,stride:0});if(fieldNormalDyingEnemies.length>4)fieldNormalDyingEnemies.shift();}
 fieldEnemy=fieldNormalEnemies[0]||null;fieldDyingEnemy=fieldNormalDyingEnemies[0]||null;if(fieldRun){fieldRun.kills=(fieldRun.kills||0)+1;queueFieldRunSave();}
 if(!fieldNormalEnemies.length&&!fieldNormalPending&&!fieldNormalCleared){fieldNormalCleared=true;fieldNormalIntermission=3;fieldEnemyShots.length=0;if(!fieldFriendly){fieldPlayerHealth=100;updateFieldCombatHUD();}if(fieldRun)fieldRun.completedWaves=fieldNormalWave;playFieldPistolSound(fieldWaveAudio);saveField();}
 updateNormalWaveHUD();return true;
}
function separateNormalEnemies(){for(let i=0;i<fieldNormalEnemies.length;i++)for(let j=i+1;j<fieldNormalEnemies.length;j++){const a=fieldNormalEnemies[i],b=fieldNormalEnemies[j];let dx=a.x-b.x,dz=a.z-b.z,distance=Math.hypot(dx,dz);if(distance>=1)continue;if(distance<.001){dx=1;dz=0;distance=1;}const step=(1-Math.min(.999,Math.hypot(a.x-b.x,a.z-b.z)))*.5;fieldMoveBody(a,dx/distance*step,dz/distance*step);fieldMoveBody(b,-dx/distance*step,-dz/distance*step);}}
function updateNormalWaves(dt){
 if(fieldMode!=='normal'||!fieldActive||fieldPaused)return;
 for(let i=fieldNormalDyingEnemies.length-1;i>=0;i--){const e=fieldNormalDyingEnemies[i];e.deathAge+=dt;if(e.deathAge>=e.deathDuration)fieldNormalDyingEnemies.splice(i,1);}fieldDyingEnemy=fieldNormalDyingEnemies[0]||null;
 fieldCombatMessageTime-=dt;if(fieldCombatMessageTime<=0)fieldCombatMessage='';
 if(fieldNormalCleared){fieldNormalIntermission=Math.max(0,fieldNormalIntermission-dt);if(fieldNormalIntermission<=0){fieldNormalWave++;beginNormalWave();}}
 else{fillNormalEnemies();for(const e of fieldNormalEnemies){e.shotFlash=Math.max(0,(e.shotFlash||0)-dt);walkFieldEnemy(e,dt);e.yaw=Math.atan2(fieldPose.x-e.x,fieldPose.z-e.z);e.fireTimer=Math.max(0,e.fireTimer-dt);if(e.fireTimer<=0&&fieldEnemyLineOfSight(e,1.48)){e.fireTimer=normalEnemyFireInterval();e.shotFlash=.18;const x=e.x+Math.sin(e.yaw)*1.05+Math.cos(e.yaw)*.15,y=1.48,z=e.z+Math.cos(e.yaw)*1.05-Math.sin(e.yaw)*.15,dx=fieldPose.x-x,dy=fieldHeight-fieldCrouchOffset-.3-y,dz=fieldPose.z-z,length=Math.max(.01,Math.hypot(dx,dy,dz));fieldEnemyShots.push({x,y,z,vx:dx/length*18,vy:dy/length*18,vz:dz/length*18,life:6,enemy:true});playFieldPistolSound(fieldEnemyShotAudio,'enemyShot');}}separateNormalEnemies();}
 fieldEnemy=fieldNormalEnemies[0]||null;updateFieldIncomingShots(dt);updateNormalWaveHUD();
}
// Find the nearest actual body part along the bullet, rather than sorting actor centers.
function fieldNormalBulletIntersection(b,dt,e){if(e.health<=0)return null;const c=Math.cos(e.yaw),s=Math.sin(e.yaw),x=b.x-e.x,z=b.z-e.z,origin=[c*x-s*z,b.y,s*x+c*z],delta=[(c*b.vx-s*b.vz)*dt,b.vy*dt,(s*b.vx+c*b.vz)*dt];let nearest=null;for(const part of fieldEnemyParts){const fraction=fieldSegmentBox(origin,delta,fieldAnimatedPartCenter(part,e),part.half);if(fraction!==null&&(nearest===null||fraction<nearest))nearest=fraction;}return nearest;}

function walkFieldEnemy(e,dt){if(fieldIsGodCore()){walkGodCoreEnemy(e,dt);return;}
 if(!Number.isFinite(e.x)||!Number.isFinite(e.z)||fieldBlocked(e.x,e.z,0,2.05,.3))fieldSafeSpawn(e);
 e.patrolTimer=(e.patrolTimer||0)-dt;e.pathTimer=(e.pathTimer||0)-dt;
 const distance=Math.hypot(e.x-fieldPose.x,e.z-fieldPose.z),hidden=!fieldEnemyLineOfSight(e);
 if(hidden){
  if(e.pathTimer<=0||!e.path?.length){e.path=fieldEnemyRoute(e);e.pathTimer=1;}
  while(e.path?.length&&Math.hypot(e.path[0].x-e.x,e.path[0].z-e.z)<.2)e.path.shift();
 }else e.path=null;
 if(e.patrolTimer<=0||!Number.isFinite(e.targetX)||Math.hypot(e.targetX-e.x,e.targetZ-e.z)<.35||distance>24){
  const angle=Math.atan2(e.x-fieldPose.x,e.z-fieldPose.z)+(Math.random()<.5?-1:1)*(.35+Math.random()*.65),radius=7+Math.random()*8;
  e.targetX=fieldPose.x+Math.sin(angle)*radius;e.targetZ=fieldPose.z+Math.cos(angle)*radius;
  if(fieldIsRetroMode()){const [bx,bz]=fieldRetroBounds();e.targetX=Math.max(-bx+1,Math.min(bx-1,e.targetX));e.targetZ=Math.max(-bz+1,Math.min(bz-1,e.targetZ));}e.patrolTimer=2+Math.random()*3;
 }
 const target=hidden&&e.path?.length?e.path[0]:{x:e.targetX,z:e.targetZ};let dx=target.x-e.x,dz=target.z-e.z;
 if(!hidden&&distance<5){dx=e.x-fieldPose.x;dz=e.z-fieldPose.z;if(distance<.01)dx=1;}
 const length=Math.hypot(dx,dz),step=Math.min(length,1.6*dt),oldX=e.x,oldZ=e.z;
 if(length>.01)fieldMoveBody(e,dx/length*step,dz/length*step);
 const moved=Math.hypot(e.x-oldX,e.z-oldZ);e.walkPhase=(e.walkPhase||0)+moved*5;e.stride=moved>.0001?Math.sin(e.walkPhase)*.13:0;
 e.stuckTime=moved<step*.1?(e.stuckTime||0)+dt:0;if(e.stuckTime>.6){e.patrolTimer=0;e.pathTimer=0;e.stuckTime=0;}
}
function fieldAnimatedPartCenter(part,e){const center=[...part.center];if(part.zone==='leg')center[2]+=(center[0]<0?-1:1)*(e.stride||0);else if(part.zone==='arm')center[2]-=(center[0]<0?-1:1)*(e.stride||0)*.5;return center;}

const fieldVitalStyle=document.createElement('style');fieldVitalStyle.textContent=`
#fieldCombatHUD{background:none;padding:0;border:0;border-radius:0;box-shadow:none;min-width:0;width:min(300px,43vw);text-align:left;z-index:12}
#fieldCombatHUD [hidden]{display:none!important}
.field-vital-row{display:flex;align-items:center;gap:8px}
.field-vital-icon{flex:0 0 24px;width:24px;height:24px;filter:drop-shadow(0 1px 1px #0009)}
.field-vital-track{position:relative;flex:1;min-width:0;height:34px;background:#172319c9;box-shadow:0 1px 2px #0007;overflow:hidden}
.field-vital-fill{height:100%;background:#79d637;transition:width .12s linear}
.field-vital-value{position:absolute;right:10px;top:0;line-height:34px;color:#fff;font:900 20px/34px Arial,sans-serif;text-shadow:0 1px 2px #17320e}
.field-vital-label{display:block;margin:0 0 5px 30px;color:#fff;font:800 11px Arial,sans-serif;letter-spacing:.08em;text-shadow:0 1px 2px #000}
#fieldCombatHUD[data-friendly="true"] .field-vital-fill{background:#21b7ea}
#fieldCombatHUD[data-friendly="true"] .field-vital-track{background:#163444c9}
`;document.head.append(fieldVitalStyle);
function updateFieldCombatHUD(){
 const vignette=document.getElementById('fieldHealthVignette'),wetness=Math.max(0,Math.min(100,100-fieldPlayerHealth)),hurt=wetness/100;
 vignette.hidden=!fieldActive||!fieldIsCombat()||hurt<=0;vignette.style.opacity=String(.15+hurt*.7);
 const inner=fieldFriendly?'rgba(0,130,195,.28)':'rgba(155,0,0,.35)',edge=fieldFriendly?'rgba(20,155,220,.86)':'rgba(180,0,0,.95)';
 vignette.style.background='radial-gradient(ellipse at center, transparent '+Math.max(0,72-hurt*85)+'%, '+inner+' '+Math.max(15,88-hurt*65)+'%, '+edge+' 100%)';
 const hud=document.getElementById('fieldCombatHUD'),amount=Math.round(fieldFriendly?wetness:Math.max(0,Math.min(100,fieldPlayerHealth))),label=fieldFriendly?'Wetness':'Health';
 hud.hidden=!fieldActive;hud.dataset.friendly=String(fieldFriendly);
 if(!hud.querySelector('[data-vital-fill]'))hud.innerHTML='<span class="field-vital-label" data-vital-label hidden>WETNESS</span><div class="field-vital-row"><svg class="field-vital-icon" viewBox="0 0 24 24" aria-hidden="true"><path data-vital-icon fill="white"/></svg><div class="field-vital-track" role="progressbar" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100"><div class="field-vital-fill" data-vital-fill></div><strong class="field-vital-value" data-vital-value></strong></div></div>';
 const track=hud.querySelector('[role="progressbar"]');track.setAttribute('aria-label',label);track.setAttribute('aria-valuenow',String(amount));
 hud.querySelector('[data-vital-fill]').style.width=amount+'%';hud.querySelector('[data-vital-value]').textContent=amount+(fieldFriendly?'%':'');
 hud.querySelector('[data-vital-icon]').setAttribute('d',fieldFriendly?'M12 1C10 5 4 11 4 15a8 8 0 0 0 16 0c0-4-6-10-8-14Z':'M8 2h8v6h6v8h-6v6H8v-6H2V8h6Z');
 hud.querySelector('[data-vital-label]').hidden=!fieldFriendly;
}

function fieldSegmentBox(origin,delta,center,half){let near=0,far=1;for(let i=0;i<3;i++){if(Math.abs(delta[i])<1e-8){if(Math.abs(origin[i]-center[i])>half[i])return null;}else{let a=(center[i]-half[i]-origin[i])/delta[i],b=(center[i]+half[i]-origin[i])/delta[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;}}return near;}
function fieldBulletHitsEnemy(b,dt,override=null){if(fieldMode==='normal'&&!override){let closest=null,fraction=2;for(const e of fieldNormalEnemies){const hit=fieldNormalBulletIntersection(b,dt,e);if(hit!==null&&hit<fraction){closest=e;fraction=hit;}}return closest?fieldBulletHitsEnemy(b,dt,closest):false;}if(fieldIsRetroMode()&&!override){const sorted=[...fieldRetroEnemies].sort((a,c)=>Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(c.x-b.x,c.z-b.z));return sorted.some(e=>fieldBulletHitsEnemy(b,dt,e));}if(!fieldIsCombat()||!(override||fieldEnemy))return false;const e=override||fieldEnemy,c=Math.cos(e.yaw),s=Math.sin(e.yaw),x=b.x-e.x,z=b.z-e.z;const origin=[c*x-s*z,b.y-(fieldIsGodCore()?(e.y||0):0),s*x+c*z],delta=[(c*b.vx-s*b.vz)*dt,b.vy*dt,(s*b.vx+c*b.vz)*dt];let nearest=2,zone=null;if(fieldIsRetroMode()&&fieldRetroPixels){const t=-origin[2]/delta[2];if(t>=0&&t<=1){const px=origin[0]+delta[0]*t,py=origin[1]+delta[1]*t,u=px/2.4+.5,v=1-py/2.4;if(u>=0&&u<1&&v>=0&&v<1){const index=(Math.floor(v*fieldRetroPixels.height)*fieldRetroPixels.width+Math.floor(u*fieldRetroPixels.width))*4,a=fieldRetroPixels.data;if(a[index+3]>25&&Math.min(a[index],a[index+1],a[index+2])<240)zone=py>1.8?'head':py<1.05?'leg':Math.abs(px)>.22?'arm':'body';}}}else for(const part of fieldEnemyParts){const t=fieldSegmentBox(origin,delta,fieldAnimatedPartCenter(part,e),part.half);if(t!==null&&t<nearest){nearest=t;zone=part.zone;}}if(!zone)return false;const fieldHitFraction=fieldIsRetroMode()?-origin[2]/delta[2]:nearest;b.fieldImpact={x:b.x+b.vx*dt*fieldHitFraction,y:b.y+b.vy*dt*fieldHitFraction,z:b.z+b.vz*dt*fieldHitFraction};recordFieldHit(b);const weapon=b.weapon||'pistol',baseDamage=(fieldIsRetroMode()?fieldRetroDamage:fieldDamage)[weapon][zone],damage=Math.min(e.health,fieldIsRetroMode()&&weapon==='pistol'?(e.maxHealth||100+Math.floor((fieldRetroWave-1)/5)*20)*(zone==='head'?1:.5):baseDamage);e.health=Math.max(0,e.health-damage);if(fieldIsRetroMode())addRetroDamage(e,damage);else addFieldDamage(e,damage,zone);fieldCombatMessage=zone.toUpperCase()+' −'+damage;fieldCombatMessageTime=1.4;playFieldPistolSound(fieldTargetHitAudio);if(e.health===0){if(fieldIsRetroMode())defeatRetroEnemy(e);else if(fieldMode==='normal')defeatNormalEnemy(e);else{if(fieldFriendly)playFieldPistolSound(fieldFriendlyDeathAudio,'friendlyEnemyDeath');if(fieldFriendly){burstFieldWaterEnemy(e);fieldDyingEnemy=null;}else fieldDyingEnemy={...e,deathAge:0,deathDuration:.9,shotFlash:0,stride:0};fieldEnemy=null;fieldEnemyRespawn=5;defeatFieldTutorialOpponent(b.weapon||'pistol');}fieldCombatMessage='Enemy defeated!';}updateFieldCombatHUD();return true;}
function updateFieldCombat(dt){if(fieldMode==='tutorial'){updateFieldTutorial(dt);return;}if(fieldIsRetroMode()){updateRetroCombat(dt);return;}if(fieldMode==='normal')updateNormalWaves(dt);}
function updateFieldIncomingShots(dt){for(let i=fieldEnemyShots.length-1;i>=0;i--){const b=fieldEnemyShots[i],delta=[b.vx*dt,b.vy*dt,b.vz*dt];let wallHit=fieldWorldHit(b,dt);if(b.vy<0&&b.y+b.vy*dt<=0){const ground=-b.y/(b.vy*dt);if(ground>=0&&(wallHit===null||ground<wallHit))wallHit=ground;}const eye=fieldHeight-fieldCrouchOffset;const hit=fieldSegmentBox([b.x,b.y,b.z],delta,[fieldPose.x,eye-.7,fieldPose.z],[.28,.8,.28]);if(wallHit!==null&&(hit===null||wallHit<=hit)){fieldWaterTravel(b,dt*wallHit,true);fieldEnemyShots.splice(i,1);continue;}if(hit!==null){fieldWaterTravel(b,dt*hit,true);fieldEnemyShots.splice(i,1);if(godCorePowerActive()||fieldAdminInvincible())continue;if(fieldFriendlyTowel)cancelFieldFriendlyTowel();fieldPlayerHealth=Math.max(0,fieldPlayerHealth-10);playFieldPistolSound(fieldHurtAudio);fieldCombatMessage=fieldFriendly?'Splashed! +10% wetness':'Hit! −10 health';fieldCombatMessageTime=1;if(!fieldPlayerHealth){fieldToMenu();document.getElementById('fieldStatus').textContent=fieldFriendly?'Soaked! You reached 100% wetness. Press Play to try again.':'You were defeated. Press Play to try again.';return;}}else{fieldWaterTravel(b,dt);b.x+=delta[0];b.y+=delta[1];b.z+=delta[2];b.life-=dt;if(b.life<=0||b.y<0)fieldEnemyShots.splice(i,1);}}updateFieldCombatHUD();}
// Run timing uses the monotonic clock, independently of the capped physics step.
// GOD CORE counts gameplay only. This central guard also covers delayed saves
// and resume callbacks while a movie is playing, paused, or waiting for audio.
function fieldRunCanAdvance(){return !fieldIsGodCore()||(fieldActive&&!fieldPaused&&!godCoreIntroActive&&!godCoreAcquisitionActive&&!godCoreVictoryActive);}
function syncFieldRunClock(now=performance.now()){
 if(!fieldRun||fieldRunClockLast===null)return;
 if(!fieldRunCanAdvance()){fieldRunClockLast=null;return;}
 fieldRun.seconds+=Math.max(0,now-fieldRunClockLast)/1000;fieldRunClockLast=now;
}
function pauseFieldRunClock(){syncFieldRunClock();fieldRunClockLast=null;}
function resumeFieldRunClock(){if(fieldRun&&fieldRunClockLast===null&&fieldRunCanAdvance())fieldRunClockLast=performance.now();}
function fieldRunSnapshot(run){const copy={...run,weapons:{...run.weapons}};delete copy.hitShots;return copy;}
function normalizeFieldRun(raw){
 if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!raw.id||!Number.isFinite(Date.parse(raw.started)))return null;
 const run=fieldRunSnapshot(raw);run.seconds=Number.isFinite(raw.seconds)?Math.max(0,raw.seconds):0;run.shots=Number.isFinite(raw.shots)?Math.max(0,Math.floor(raw.shots)):0;run.hits=Number.isFinite(raw.hits)?Math.max(0,Math.min(run.shots,Math.floor(raw.hits))):0;
 for(const id of Object.keys(run.weapons))run.weapons[id]=Number.isFinite(run.weapons[id])?Math.max(0,Math.floor(run.weapons[id])):0;
 if(!Number.isFinite(Date.parse(run.ended)))run.ended=Number.isFinite(Date.parse(run.updatedAt))?run.updatedAt:new Date(Date.parse(run.started)+run.seconds*1000).toISOString();
 return run;
}
function persistFieldRunHistory(){
 if(!fieldSaving||!fieldRunHistoryDirty)return !fieldRunHistoryDirty;
 try{fieldStorage.set('runs',JSON.stringify(fieldRuns));fieldRunHistoryDirty=false;fieldRunSaveError='';return true;}catch(_){fieldRunSaveError='Runs could not be saved in this browser. Your current results are still shown here.';return false;}
}
function loadFieldRunHistory(){
 // Recover a saved victory before ranked-history filtering can discard its evidence.
 if(fieldIsGodCore()&&fieldSaving)Platdo.cityUnlock.refresh();
 fieldRuns=[];fieldRunHistoryDirty=false;fieldRunSaveError='';
 try{const saved=JSON.parse(fieldStorage.get('runs')||'[]');if(Array.isArray(saved)){const seen=new Set();fieldRuns=saved.map(normalizeFieldRun).filter(run=>run&&(!fieldIsGodCore()||isCompletedGodCoreRun(run))&&!seen.has(run.id)&&seen.add(run.id));}}catch(_){}
 try{
  const raw=JSON.parse(fieldStorage.get('active-run')||'null'),run=normalizeFieldRun(raw);
  if(run&&(!fieldIsGodCore()||isCompletedGodCoreRun(run))&&(run.shots>0||run.seconds>0)&&!fieldRuns.some(r=>r.id===run.id)){
   run.ended=Number.isFinite(Date.parse(run.ended))?run.ended:Number.isFinite(Date.parse(run.updatedAt))?run.updatedAt:new Date(Date.parse(run.started)+run.seconds*1000).toISOString();run.reason=run.reason||'Closed or refreshed';fieldRuns.push(run);fieldRunHistoryDirty=true;
  }
  if(persistFieldRunHistory())fieldStorage.remove('active-run');
 }catch(_){}
}
function checkpointFieldRun(force=false){
 if(!fieldSaving)return;syncFieldRunClock();const now=performance.now();if(!force&&now-fieldRunCheckpointAt<500)return;fieldRunCheckpointAt=now;
 persistFieldRunHistory();if(!fieldRun||fieldIsGodCore())return;fieldRun.updatedAt=new Date().toISOString();
 try{fieldStorage.set('active-run',JSON.stringify(fieldRunSnapshot(fieldRun)));fieldRunCheckpointAt=now;if(!fieldRunHistoryDirty)fieldRunSaveError='';}catch(_){fieldRunSaveError='Runs could not be saved in this browser. Your current results are still shown here.';fieldRunCheckpointAt=now;}
}
function queueFieldRunSave(){
 if(!fieldSaving||!fieldRun||fieldRunPendingSave!==null)return;
 fieldRunPendingSave=setTimeout(()=>{fieldRunPendingSave=null;checkpointFieldRun(true);},100);
}
function updateFieldRunRecorder(){
 if(!fieldRun)return;syncFieldRunClock();const timer=document.getElementById('fieldRunTimer'),tick=Math.floor(fieldRun.seconds*10);if(timer.dataset.tick!==String(tick)){timer.dataset.tick=String(tick);timer.textContent=formatFieldTime(fieldRun.seconds);if(fieldPractice)fieldPracticeHUD();}checkpointFieldRun();
}
function formatFieldTime(seconds){const hundredths=Math.floor(Math.max(0,Number(seconds)||0)*100+1e-7);return Math.floor(hundredths/6000)+':'+String(Math.floor(hundredths/100)%60).padStart(2,'0')+'.'+String(hundredths%100).padStart(2,'0');}
function startFieldRun(){
 fieldSprintToggled=false;
 if(fieldRun)finishFieldRun('Restarted');clearTimeout(fieldRunPendingSave);fieldRunPendingSave=null;
 resetNormalWaves();resetFieldNormalPistolAmmo();resetFieldFriendlyAmmo();resetFieldLookInput();fieldDyingEnemy=null;
 fieldRun=(fieldMode==='explore'||fieldMode==='tutorial')?null:{id:Date.now()+'-'+Math.random().toString(36).slice(2),mode:fieldMode,map:fieldFriendly&&!fieldIsRetroMode()?'Sunny Pool House':fieldSelectedMap,retroMap:fieldIsRetroMode()?fieldRetroMap:null,started:new Date().toISOString(),seconds:0,shots:0,hits:0,kills:0,targets:0,wave:1,completedWaves:0,friendly:fieldFriendly&&!fieldIsRetroMode(),weapons:{pistol:0,ar:0,sniper:0,shotgun:0,grenade:0,rocket:0}};
 fieldRunHitIds.clear();fieldRunFirstShot=fieldShotCount+1;fieldRunClockLast=fieldRun&&fieldActive&&fieldRunCanAdvance()?performance.now():null;fieldRunCheckpointAt=-Infinity;
 const timer=document.getElementById('fieldRunTimer');timer.hidden=!fieldRun;timer.dataset.tick='0';timer.textContent='0:00.00';checkpointFieldRun(true);clearInterval(fieldRunCheckpointTimer);fieldRunCheckpointTimer=fieldRun&&fieldSaving?setInterval(()=>{if(fieldActive&&!fieldPaused)checkpointFieldRun(true);},500):null;
}
function recordFieldShot(weapon){if(!fieldRun)return;fieldRun.shots++;fieldRun.weapons[weapon]=(fieldRun.weapons[weapon]||0)+1;queueFieldRunSave();}
function recordFieldHit(b){
 const id=b?.shotId;if(!fieldRun||!Number.isSafeInteger(id)||id<fieldRunFirstShot||id>fieldShotCount||fieldRunHitIds.has(id)||fieldRun.hits>=fieldRun.shots)return;
 fieldRunHitIds.add(id);fieldRun.hits++;queueFieldRunSave();
}
function finishFieldRun(reason=null){
 clearTimeout(fieldRunPendingSave);clearInterval(fieldRunCheckpointTimer);fieldRunCheckpointTimer=null;fieldRunPendingSave=null;
 if(!fieldRun)return;pauseFieldRunClock();const run=fieldRun;run.ended=new Date().toISOString();run.reason=typeof reason==='string'?reason:fieldPlayerHealth<=0?(run.friendly?'Soaked':'Defeated'):'Returned to menu';
 checkpointFieldRun(true);fieldRun=null;fieldRunHitIds.clear();
 if(!fieldSaving)return;
 if((!fieldIsGodCore()||isCompletedGodCoreRun(run))&&(run.shots>0||run.seconds>0)&&!fieldRuns.some(r=>r.id===run.id)){fieldRuns.push(fieldRunSnapshot(run));fieldRunHistoryDirty=true;}
 if(persistFieldRunHistory())try{fieldStorage.remove('active-run');}catch(_){}
}
let fieldRetroWave=1,fieldRetroPending=0,fieldRetroIntermission=0,fieldRetroCleared=false;const fieldRetroEnemies=[],fieldGrenades=[],fieldRetroLabels=[];
const fieldRetroShotgunAudio='assets/audio/fieldretroshotgunaudio-d2a8bd3814e5.mp3';
const fieldRetroEnemyAudio='assets/audio/fieldretroenemyaudio-5009be38a32f.mp3';
const fieldExplosionFrames=["assets/images/fieldexplosionframes-39f2229c4482.png", "assets/images/image-95987161f2ea.png", "assets/images/image-17d4f816dec3.png", "assets/images/image-9a67a5718a49.png", "assets/images/image-c4cf3a960ec3.png", "assets/images/image-c4f9e476fbd1.png"].map(src=>{const image=new Image();image.src=src;return image;});
const fieldExplosions=[];
const fieldGrenadeExplosionAudio="assets/audio/fieldgrenadeexplosionaudio-0619df33f0ce.mp3";
const fieldGrenadeImage=new Image();fieldGrenadeImage.src="assets/images/fieldgrenadeimage-57d294fd5643.png";
fieldGrenadeImage.id="fieldGrenadeIdle";fieldGrenadeImage.alt="Retro grenade";fieldGrenadeImage.dataset.weaponType="grenade";fieldGrenadeImage.dataset.view="idle";fieldGrenadeImage.hidden=true;fieldGrenadeImage.style.cssText="--weapon-size:40%;right:10%;bottom:0;filter:url(#fieldGrenadeKey);image-rendering:pixelated";document.getElementById("fieldGunMotion").append(fieldGrenadeImage);
const fieldRetroDamage={pistol:{head:100,body:50,arm:50,leg:50},shotgun:{head:20,body:15,arm:12,leg:12},ar:{head:40,body:30,arm:22,leg:22},sniper:{head:200,body:150,arm:90,leg:90}};
const fieldRetroReloadSource="assets/audio/fieldretroreloadsource-bbc9da755221.mp3";
const fieldShellSource="assets/images/fieldshellsource-df0408cce4ee.png";

const fieldRetroShotgunAimImage=new Image();fieldRetroShotgunAimImage.src="assets/images/fieldretroshotgunaimimage-7ed53719bc02.jpg";fieldRetroShotgunAimImage.id="fieldRetroShotgunAim";fieldRetroShotgunAimImage.alt="Retro shotgun aiming";fieldRetroShotgunAimImage.dataset.weaponType="shotgun";fieldRetroShotgunAimImage.dataset.view="aim";fieldRetroShotgunAimImage.dataset.backgroundKey="white";fieldRetroShotgunAimImage.hidden=true;fieldRetroShotgunAimImage.style.cssText="--weapon-size:65%;--sight-x:.52;--sight-y:.07;image-rendering:pixelated;filter:url(#fieldWhiteKey)";document.getElementById("fieldGunMotion").append(fieldRetroShotgunAimImage);
const fieldRetroReloadAudio=new Audio(fieldRetroReloadSource);fieldRetroReloadAudio.preload='auto';
let fieldRetroShells=7,fieldRetroReloading=false,fieldRetroReloadElapsed=0,fieldRetroReloadStartShells=0;
// Friendly water ammunition and pool refill.
const fieldFriendlyRefillSource='assets/audio/fieldfriendlyrefillsource-3ebc9f90a3cc.mp3';
const fieldFriendlyDropSource='assets/images/fieldfriendlydropsource-f638595c525c.png';
const fieldFriendlyAmmoCapacity={pistol:10,ar:43};
let fieldFriendlyAmmo={...fieldFriendlyAmmoCapacity},fieldFriendlyRefill=null;
const fieldFriendlyRefillAudio=new Audio(fieldFriendlyRefillSource);fieldFriendlyRefillAudio.preload='auto';
const fieldFriendlyAmmoHUD=document.createElement('div');fieldFriendlyAmmoHUD.id='fieldFriendlyAmmoHUD';fieldFriendlyAmmoHUD.hidden=true;fieldFriendlyAmmoHUD.style.cssText='position:absolute;right:20px;bottom:24px;z-index:12;pointer-events:none;color:#e5fbff;background:none;border:0;padding:0;text-align:right;max-width:26vw;text-shadow:0 1px 3px #003045';fieldRoot.append(fieldFriendlyAmmoHUD);
function fieldHasWaterAmmo(weapon=fieldEquipped){return fieldFriendly&&!fieldIsRetroMode()&&Object.hasOwn(fieldFriendlyAmmoCapacity,weapon);}
// The fallback is the measured duration of the embedded pouring-water MP3.

const fieldFriendlyActionHUD=document.createElement('div');fieldFriendlyActionHUD.id='fieldFriendlyActionHUD';fieldFriendlyActionHUD.hidden=true;
fieldFriendlyActionHUD.setAttribute('role','progressbar');fieldFriendlyActionHUD.setAttribute('aria-valuemin','0');fieldFriendlyActionHUD.setAttribute('aria-valuemax','100');fieldFriendlyActionHUD.setAttribute('aria-describedby','fieldFriendlyActionHint');
fieldFriendlyActionHUD.style.cssText='position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);z-index:32;width:min(230px,70vw);color:#e7fbff;text-align:center;pointer-events:none;text-shadow:0 2px 5px #001820';
fieldFriendlyActionHUD.innerHTML='<div style="position:relative;width:120px;height:120px;margin:0 auto"><svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 7px #001a29)"><circle cx="60" cy="60" r="48" fill="none" stroke="#255266" stroke-width="8"/><circle data-friendly-action-ring cx="60" cy="60" r="48" fill="none" stroke="#77e8ff" stroke-width="8" stroke-linecap="round" transform="rotate(-90 60 60)"/></svg><div style="position:absolute;inset:0;display:grid;place-items:center"><strong data-friendly-action-seconds style="font:700 27px monospace;font-variant-numeric:tabular-nums">0.0s</strong></div></div><strong data-friendly-action-label style="display:block;font-size:17px;margin-top:4px">Refilling</strong><div id="fieldFriendlyActionHint" style="font-size:12px;line-height:1.4;margin-top:4px">Stay near the pool</div>';
fieldRoot.append(fieldFriendlyActionHUD);
const fieldFriendlyActionRing=fieldFriendlyActionHUD.querySelector('[data-friendly-action-ring]'),fieldFriendlyActionSeconds=fieldFriendlyActionHUD.querySelector('[data-friendly-action-seconds]'),fieldFriendlyActionLabel=fieldFriendlyActionHUD.querySelector('[data-friendly-action-label]'),fieldFriendlyActionHint=fieldFriendlyActionHUD.querySelector('#fieldFriendlyActionHint');
const fieldFriendlyActionCircumference=2*Math.PI*48;fieldFriendlyActionRing.style.strokeDasharray=String(fieldFriendlyActionCircumference);
function renderFieldFriendlyAction(){
 const towel=typeof fieldFriendlyTowel==='undefined'?null:fieldFriendlyTowel,transaction=towel||fieldFriendlyRefill;
 fieldFriendlyActionHUD.hidden=!transaction||!fieldFriendly||fieldRoot.hidden||(!fieldActive&&!fieldPaused);
 if(fieldFriendlyActionHUD.hidden)return;
 const audio=towel?(typeof fieldFriendlyTowelAudio==='undefined'?null:fieldFriendlyTowelAudio):fieldFriendlyRefillAudio;
 const rawDuration=towel?(typeof fieldFriendlyTowelDuration==='function'?fieldFriendlyTowelDuration():0):fieldFriendlyRefillDuration(),duration=Number.isFinite(rawDuration)&&rawDuration>0?rawDuration:Math.max(1,Number(transaction.duration)||1);
 const hasAudioClock=!transaction.silent&&audio&&Number.isFinite(audio.currentTime)&&(audio.readyState>0||audio.currentTime>0),elapsed=Math.max(0,Math.min(duration,hasAudioClock?audio.currentTime:Number(transaction.elapsed)||0)),fraction=elapsed/duration,remaining=duration-elapsed;
 const label=towel?'Drying off':'Refilling',hint=towel?'Stay near the towel table':'Stay near the pool';
 fieldFriendlyActionRing.style.strokeDashoffset=String(fieldFriendlyActionCircumference*(1-fraction));
 fieldFriendlyActionSeconds.textContent=remaining.toFixed(1)+'s';fieldFriendlyActionLabel.textContent=label+(fieldPaused?' · Paused':'');fieldFriendlyActionHint.textContent=hint;
 fieldFriendlyActionHUD.dataset.action=towel?'towel':'refill';fieldFriendlyActionHUD.dataset.fraction=String(fraction);fieldFriendlyActionHUD.setAttribute('aria-label',label);fieldFriendlyActionHUD.setAttribute('aria-valuenow',String(Math.round(fraction*100)));fieldFriendlyActionHUD.setAttribute('aria-valuetext',(fieldPaused?'Paused. ':'')+remaining.toFixed(1)+' seconds remaining. '+hint+'.');
}

function fieldFriendlyRefillDuration(){return Number.isFinite(fieldFriendlyRefillAudio.duration)&&fieldFriendlyRefillAudio.duration>0?fieldFriendlyRefillAudio.duration:3.970594;}
function renderFieldFriendlyAmmo(){
 const hud=fieldFriendlyAmmoHUD;hud.hidden=!fieldHasWaterAmmo()||(!fieldActive&&!fieldPaused);if(hud.hidden)return;
 const weapon=fieldEquipped,count=fieldFriendlyAmmo[weapon],capacity=fieldFriendlyAmmoCapacity[weapon],refilling=fieldFriendlyRefill?.weapon===weapon,near=typeof fieldNearPool==='function'&&fieldNearPool(),binding=window.Platdo?.controls?.isMobile?'Pool / towel':fieldBindings.refill.map(fieldBindName).join(' / ')||'Bind refill in Settings',key=[weapon,count,refilling,near,binding].join(':');
 if(hud.dataset.state!==key){hud.dataset.state=key;hud.replaceChildren();const icons=document.createElement('div');icons.dataset.waterDrops='';icons.setAttribute('aria-label',count+' water shots remaining');icons.style.cssText='display:grid;grid-template-columns:repeat('+(weapon==='pistol'?5:10)+','+(weapon==='pistol'?'22px':'11px')+');gap:3px;justify-content:end;align-content:end;min-height:'+(Math.ceil(capacity/(weapon==='pistol'?5:10))*(weapon==='pistol'?29:16)-3)+'px';for(let i=0;i<capacity;i++){const icon=document.createElement('img');icon.src=fieldFriendlyDropSource;icon.alt='';icon.dataset.loaded=String(i<count);icon.style.cssText='display:block;width:100%;height:'+(weapon==='pistol'?26:13)+'px;object-fit:contain;filter:'+(i<count?'none':'grayscale(1) brightness(1.35)')+';opacity:'+(i<count?'1':'.55');icons.append(icon);}const label=document.createElement('strong');label.textContent='WATER '+count+' / '+capacity;label.style.cssText='display:block;font:bold 14px monospace;margin-top:8px';const note=document.createElement('div');note.dataset.waterRefillNote='';note.style.cssText='max-width:150px;font-size:11px;line-height:1.35;margin-top:6px';note.textContent=refilling?'Refilling…':count===capacity?'Tank full':near?'Press '+binding+' to refill at the pool':(count===0?'Empty • ':'')+'Return to the pool to refill';hud.append(icons,label,note);}
 if(refilling)hud.querySelector('[data-water-refill-note]').textContent='Refilling… • Stay by the pool';
}
function cancelFieldFriendlyRefill(){fieldFriendlyRefill=null;fieldFriendlyRefillAudio.pause();fieldFriendlyRefillAudio.currentTime=0;renderFieldFriendlyAmmo();renderFieldFriendlyAction();}
function resetFieldFriendlyAmmo(){cancelFieldFriendlyTowel();cancelFieldFriendlyRefill();fieldFriendlyAmmo={...fieldFriendlyAmmoCapacity};renderFieldFriendlyAmmo();}
function playFieldFriendlyRefill(){const transaction=fieldFriendlyRefill;if(!transaction)return;fieldFriendlyRefillAudio.volume=fieldAudioVolume(fieldFriendlyRefillSource,'friendlyRefill');fieldFriendlyRefillAudio.play().catch(()=>{if(fieldFriendlyRefill===transaction)transaction.silent=true;});}
function beginFieldFriendlyRefill(){
 if(!fieldActive||fieldPaused||!fieldHasWaterAmmo()||fieldFriendlyTowel||fieldFriendlyRefill||fieldFriendlyAmmo[fieldEquipped]>=fieldFriendlyAmmoCapacity[fieldEquipped]||typeof fieldNearPool!=='function'||!fieldNearPool())return false;
 fieldFriendlyRefill={weapon:fieldEquipped,elapsed:0,silent:false};fieldFriendlyRefillAudio.currentTime=0;playFieldFriendlyRefill();renderFieldFriendlyAmmo();renderFieldFriendlyAction();return true;
}
function finishFieldFriendlyRefill(){
 if(!fieldFriendlyRefill||!fieldActive||fieldPaused||!fieldHasWaterAmmo()||fieldFriendlyRefill.weapon!==fieldEquipped||!fieldNearPool())return false;
 if(!fieldFriendlyRefillAudio.ended&&!(fieldFriendlyRefill.silent&&fieldFriendlyRefill.elapsed>=fieldFriendlyRefillDuration()))return false;
 fieldFriendlyAmmo[fieldFriendlyRefill.weapon]=fieldFriendlyAmmoCapacity[fieldFriendlyRefill.weapon];cancelFieldFriendlyRefill();completeFieldTutorialRefill();return true;
}
function updateFieldFriendlyRefill(dt){
 if(fieldFriendlyRefill&&(!fieldHasWaterAmmo()||fieldFriendlyRefill.weapon!==fieldEquipped||!fieldNearPool()))cancelFieldFriendlyRefill();
 if(fieldFriendlyRefill&&fieldActive&&!fieldPaused){fieldFriendlyRefill.elapsed+=dt;fieldFriendlyRefillAudio.volume=fieldAudioVolume(fieldFriendlyRefillSource,'friendlyRefill');if(fieldFriendlyRefillAudio.ended||(fieldFriendlyRefill.silent&&fieldFriendlyRefill.elapsed>=fieldFriendlyRefillDuration()))finishFieldFriendlyRefill();}
 renderFieldFriendlyAmmo();
}
function takeFieldWaterShot(){if(!fieldHasWaterAmmo())return true;if(fieldFriendlyTowel||fieldFriendlyRefill?.weapon===fieldEquipped||fieldFriendlyAmmo[fieldEquipped]<=0){renderFieldFriendlyAmmo();return false;}fieldFriendlyAmmo[fieldEquipped]--;renderFieldFriendlyAmmo();return true;}
fieldFriendlyRefillAudio.addEventListener('ended',finishFieldFriendlyRefill);
fieldFriendlyRefillAudio.addEventListener('error',()=>{if(fieldFriendlyRefill)fieldFriendlyRefill.silent=true;});


// Friendly towel interaction: wetness changes only on hits or a completed towel use.
const fieldFriendlyTowelSource="assets/audio/fieldfriendlytowelsource-3a469d630520.mp3";
const fieldFriendlyTowelAudio=new Audio(fieldFriendlyTowelSource);fieldFriendlyTowelAudio.preload='auto';
let fieldFriendlyTowel=null;
const fieldTowelPrompt=document.createElement('div');fieldTowelPrompt.id='fieldTowelPrompt';fieldTowelPrompt.hidden=true;fieldTowelPrompt.style.cssText='position:absolute;left:50%;bottom:115px;transform:translateX(-50%);z-index:14;background:#07374fed;border:1px solid #80e4ff99;border-radius:9px;padding:10px 18px;color:#edfcff;pointer-events:none;text-align:center;font-weight:bold';fieldRoot.append(fieldTowelPrompt);
function fieldFriendlyTowelDuration(){return Number.isFinite(fieldFriendlyTowelAudio.duration)&&fieldFriendlyTowelAudio.duration>0?fieldFriendlyTowelAudio.duration:7.392;}
function renderFieldTowelPrompt(){
 fieldTowelPrompt.hidden=!fieldFriendly||!fieldActive||fieldPaused||!fieldNearTowel()||!!fieldFriendlyTowel;
 if(!fieldTowelPrompt.hidden)fieldTowelPrompt.textContent=fieldPlayerHealth>=100?'Towel table · You are already dry':'Press '+fieldTutorialControl('refill')+' to use a towel';
}
function cancelFieldFriendlyTowel(){fieldFriendlyTowel=null;fieldFriendlyTowelAudio.pause();fieldFriendlyTowelAudio.currentTime=0;renderFieldTowelPrompt();renderFieldFriendlyAction();}
function playFieldFriendlyTowel(){const transaction=fieldFriendlyTowel;if(!transaction)return;fieldFriendlyTowelAudio.volume=fieldAudioVolume(fieldFriendlyTowelSource,'friendlyTowel');fieldFriendlyTowelAudio.play().catch(()=>{if(fieldFriendlyTowel===transaction)transaction.silent=true;});}
function beginFieldFriendlyTowel(){
 if(!fieldFriendly||!fieldActive||fieldPaused||fieldIsRetroMode()||fieldPlayerHealth>=100||fieldFriendlyTowel||fieldFriendlyRefill||!fieldNearTowel())return false;
 fieldFriendlyTowel={elapsed:0,silent:false};fieldFriendlyTowelAudio.currentTime=0;fieldKeys.delete('Mouse0');playFieldFriendlyTowel();renderFieldTowelPrompt();renderFieldFriendlyAction();return true;
}
function finishFieldFriendlyTowel(){
 if(!fieldFriendlyTowel||!fieldFriendly||!fieldActive||fieldPaused||!fieldNearTowel())return false;
 if(!fieldFriendlyTowelAudio.ended&&!(fieldFriendlyTowel.silent&&fieldFriendlyTowel.elapsed>=fieldFriendlyTowelDuration()))return false;
 fieldPlayerHealth=100;cancelFieldFriendlyTowel();fieldCombatMessage='All dry!';fieldCombatMessageTime=2;updateFieldCombatHUD();completeFieldTutorialTowel();return true;
}
function updateFieldFriendlyTowel(dt){
 if(fieldFriendlyTowel&&(!fieldFriendly||!fieldNearTowel()))cancelFieldFriendlyTowel();
 if(fieldFriendlyTowel&&fieldActive&&!fieldPaused){fieldFriendlyTowel.elapsed+=dt;fieldFriendlyTowelAudio.volume=fieldAudioVolume(fieldFriendlyTowelSource,'friendlyTowel');if(fieldFriendlyTowelAudio.ended||(fieldFriendlyTowel.silent&&fieldFriendlyTowel.elapsed>=fieldFriendlyTowelDuration()))finishFieldFriendlyTowel();}
 renderFieldTowelPrompt();renderFieldFriendlyAction();
}
function interactFieldFriendly(){if(fieldFriendly&&fieldNearTowel()&&fieldPlayerHealth<100)return beginFieldFriendlyTowel();return beginFieldFriendlyRefill();}
fieldFriendlyTowelAudio.addEventListener('ended',finishFieldFriendlyTowel);
fieldFriendlyTowelAudio.addEventListener('error',()=>{if(fieldFriendlyTowel)fieldFriendlyTowel.silent=true;});
window.addEventListener('platdo:beforereset',()=>{cancelFieldFriendlyTowel();cancelFieldFriendlyRefill();});

let fieldTutorial=null;
const fieldTutorialHUD=document.createElement('section');fieldTutorialHUD.id='fieldTutorialHUD';fieldTutorialHUD.hidden=true;fieldTutorialHUD.setAttribute('aria-live','polite');fieldTutorialHUD.style.cssText='position:absolute;left:50%;top:22px;transform:translateX(-50%);width:min(540px,calc(100% - 180px));z-index:14;pointer-events:none;background:#08384ded;border:1px solid #80e4ff99;color:#edfcff;border-radius:12px;padding:13px 18px;text-align:center;box-shadow:0 5px 20px #00182255';fieldRoot.append(fieldTutorialHUD);
function fieldTutorialControl(action){if(window.Platdo?.controls?.isMobile)return ({refill:'Pool / towel',fire:'Fire',jump:'Jump',sprint:'Run',aim:'Aim',reload:'Reload'})[action]||action;return fieldBindings[action].map(code=>code==='Mouse0'?'Left click':code==='Mouse2'?'Right click':fieldBindName(code)).join(' / ')||'your '+action+' control';}
function renderFieldTutorial(){
 const hud=fieldTutorialHUD;hud.hidden=!fieldTutorial||!fieldFriendly||fieldMode!=='tutorial'||(!fieldActive&&!fieldPaused);if(hud.hidden)return;
 let title,detail;const refill=fieldTutorialControl('refill');
 if(fieldTutorial.stage==='opponent'){
  title='1 / 3 · Soak the opponent';detail='Point the crosshair at the opponent and shoot with '+fieldTutorialControl('fire')+'.';
  if(fieldHasWaterAmmo()&&fieldFriendlyAmmo[fieldEquipped]===0)detail='Out of water? Go to the pool and press '+refill+' to refill, then finish soaking the opponent.';
 }else if(fieldTutorial.stage==='refill'){
  title='2 / 3 · Refill at the pool';
  detail=fieldNearPool()?'Press '+refill+' to refill your water gun.':'Walk to the pool water, then press '+refill+' to refill.';
  if(fieldFriendlyAmmo[fieldEquipped]===fieldFriendlyAmmoCapacity[fieldEquipped])detail='Switch to '+fieldWeaponNames[fieldTutorial.usedWeapon]+' and refill it at the pool with '+refill+'.';
 }
 if(fieldTutorial.stage==='towel'){title='3 / 3 · Dry off with a towel';detail=fieldNearTowel()?'Press '+refill+' to use a towel. Stay beside the table until you are dry.':'A practice splash made you 30% wet. Walk to the towel table on the right of the pool, then press '+refill+'.';}
 if(fieldFriendlyRefill)detail='Refilling… Stay by the pool until the pouring sound finishes.';
 if(fieldFriendlyTowel)detail='Drying off… Stay beside the towel table until the sound finishes.';
 const key=title+'|'+detail;if(hud.dataset.state===key)return;hud.dataset.state=key;hud.replaceChildren();const heading=document.createElement('strong');heading.style.cssText='display:block;font-size:19px;margin-bottom:5px';heading.textContent=title;const paragraph=document.createElement('p');paragraph.style.cssText='font-size:14px;line-height:1.4';paragraph.textContent=detail;hud.append(heading,paragraph);
}
function startFieldTutorial(){
 fieldTutorial={stage:'opponent',usedWeapon:'pistol'};fieldEquipped='pistol';fieldPose={x:0,z:9,yaw:0,pitch:-.05};fieldHeight=1.7;fieldVelocity=0;fieldCrouchOffset=0;fieldLean=0;fieldShotCooldown=0;fieldRecoil=0;fieldGunKick=0;fieldAimToggled=false;fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldDyingEnemy=null;fieldEnemyShots.length=0;fieldProjectiles.length=0;fieldRetroEnemies.length=0;fieldEnemyRespawn=0;
 fieldEnemy={x:0,z:2.5,yaw:0,health:200,fireTimer:Infinity,walkPhase:0,stride:0,shotFlash:0};renderFieldTutorial();
}
function updateFieldTutorial(dt){
 if(!fieldTutorial)return;
 if(fieldEnemy){fieldEnemy.yaw=Math.atan2(fieldPose.x-fieldEnemy.x,fieldPose.z-fieldEnemy.z);fieldEnemy.shotFlash=0;}
 fieldCombatMessageTime-=dt;if(fieldCombatMessageTime<=0)fieldCombatMessage='';updateFieldCombatHUD();renderFieldTutorial();
}
function defeatFieldTutorialOpponent(weapon){
 if(fieldMode!=='tutorial'||!fieldTutorial||fieldTutorial.stage!=='opponent')return;
 fieldTutorial.stage='refill';fieldTutorial.usedWeapon=weapon;fieldEquipped=weapon;fieldAimToggled=false;fieldEnemyShots.length=0;renderFieldInventory();renderFieldTutorial();
}
function completeFieldTutorialRefill(){
 if(fieldMode!=='tutorial'||!fieldTutorial||fieldTutorial.stage!=='refill')return;
 fieldTutorial.stage='towel';fieldPlayerHealth=70;fieldCombatMessage='Practice splash · 30% wetness';fieldCombatMessageTime=3;playFieldPistolSound(fieldFriendlyDeathAudio,'friendlyEnemyDeath');updateFieldCombatHUD();renderFieldTutorial();
}
function completeFieldTutorialTowel(){
 if(fieldMode!=='tutorial'||!fieldTutorial||fieldTutorial.stage!=='towel')return;
 fieldToMenu();fieldMode='normal';fieldPractice=false;renderFieldModes();saveField();syncFieldRetroMusic();document.getElementById('fieldStatus').textContent='Tutorial complete! You soaked an opponent, refilled at the pool, and dried off with a towel. Ready for a Friendly game?';
}
const fieldShellHUD=document.createElement('div');fieldShellHUD.id='fieldShellHUD';fieldShellHUD.hidden=true;fieldShellHUD.style.cssText='position:absolute;right:20px;bottom:24px;text-align:right;z-index:12;pointer-events:none;color:white;text-shadow:0 2px 3px black;background:#101c22e8;border:1px solid #ffffff40;border-radius:10px;padding:12px;max-width:calc(100% - 40px);box-sizing:border-box';fieldShellHUD.setAttribute('aria-label','Shotgun ammunition');fieldRoot.append(fieldShellHUD);

// Retro pistol magazine and the player's supplied pixel bullet artwork.
const fieldRetroPistolBulletSource='assets/images/fieldretropistolbulletsource-a950a723e78b.jpg';

const fieldRetroRocketAmmoSource='assets/images/fieldretrorocketammosource-ba2e410358c2.png';
const fieldRetroPistolSpentSource='assets/images/fieldretropistolspentsource-4e59aa3c7363.png';
const fieldRetroARBulletSource='assets/images/fieldretroarbulletsource-9c77e0a01bfc.png';
const fieldRetroRocketImage=document.createElement('img');fieldRetroRocketImage.id='fieldRetroRocketImage';fieldRetroRocketImage.alt='Retro rocket launcher';fieldRetroRocketImage.hidden=true;fieldRetroRocketImage.dataset.weaponType='rocket';fieldRetroRocketImage.dataset.view='idle';fieldRetroRocketImage.dataset.weaponAnchorX='.5';fieldRetroRocketImage.dataset.weaponAnchorY='.9515';fieldRetroRocketImage.style.cssText='position:absolute;left:50%;right:auto;bottom:0;transform:translateX(-50%);--weapon-size:55%;max-width:85%;image-rendering:pixelated;pointer-events:none';fieldRetroRocketImage.src='assets/images/image-da15a128d211.png';document.getElementById('fieldGunMotion').append(fieldRetroRocketImage);

const fieldRetroPistolReloadDuration=1.5;
let fieldRetroPistolAmmo=9,fieldRetroPistolReload=null;
document.getElementById('fieldWhiteKey').parentNode.insertAdjacentHTML('beforeend',`<filter id="fieldRetroBulletKey" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 0 -1 0 -.08"/><feComponentTransfer result="gold"><feFuncA type="linear" slope="12"/></feComponentTransfer><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 -1 -1 0 2.1"/><feComponentTransfer result="outline"><feFuncA type="linear" slope="12"/></feComponentTransfer><feComposite in="gold" in2="outline" operator="arithmetic" k2="1" k3="1" result="mask"/><feComposite in="SourceGraphic" in2="mask" operator="in"/></filter>`);
const fieldRetroPistolAmmoHUD=document.createElement('div');fieldRetroPistolAmmoHUD.id='fieldRetroPistolAmmoHUD';fieldRetroPistolAmmoHUD.hidden=true;fieldRoot.append(fieldRetroPistolAmmoHUD);
const fieldRetroPistolAmmoStyle=document.createElement('style');fieldRetroPistolAmmoStyle.textContent=`
#fieldRetroPistolAmmoHUD{position:absolute;right:20px;bottom:24px;z-index:12;width:214px;max-width:calc(100% - 40px);box-sizing:border-box;pointer-events:none;color:white;background:none;border:0;padding:0;text-align:right;text-shadow:0 2px 3px black}
.field-retro-bullets{display:flex;justify-content:flex-end;gap:2px;height:48px}
.field-retro-bullet{position:relative;flex:0 1 22px;height:48px;overflow:hidden}
.field-retro-bullet img{position:absolute;left:50%;top:-12px;transform:translateX(-50%);width:72px;height:72px;max-width:none;image-rendering:pixelated;filter:url(#fieldRetroBulletKey)}
.field-retro-bullet img[data-loaded="false"]{filter:url(#fieldWhiteKey);opacity:1;width:54.87px;height:auto;left:-18.60px;top:auto;bottom:-7.07px;transform:none}
.field-retro-ammo-label{margin-top:6px;font:bold 12px/16px monospace;white-space:nowrap}
`;document.head.append(fieldRetroPistolAmmoStyle);
function renderRetroPistolAmmo(){
 const hud=fieldRetroPistolAmmoHUD;hud.hidden=!fieldIsRetroMode()||fieldEquipped!=='pistol'||(!fieldActive&&!fieldPaused);if(hud.hidden)return;
 const count=Math.max(0,Math.min(9,fieldRetroPistolAmmo)),reloading=!!fieldRetroPistolReload,key=count+':'+reloading;if(hud.dataset.state===key)return;hud.dataset.state=key;
 if(!hud.querySelector('.field-retro-bullets')){const row=document.createElement('div');row.className='field-retro-bullets';for(let i=0;i<9;i++){const slot=document.createElement('span');slot.className='field-retro-bullet';const icon=document.createElement('img');icon.src=fieldRetroPistolBulletSource;icon.alt='';icon.setAttribute('aria-hidden','true');slot.append(icon);row.append(slot);}const label=document.createElement('div');label.className='field-retro-ammo-label';hud.replaceChildren(row,label);}
 hud.querySelectorAll('img').forEach((icon,i)=>{icon.dataset.loaded=String(i<count);const src=i<count?fieldRetroPistolBulletSource:fieldRetroPistolSpentSource;if(icon.src!==src)icon.src=src;});hud.querySelector('.field-retro-ammo-label').textContent=count+' / 9'+(reloading?' · RELOADING':'');hud.setAttribute('aria-label','Pistol ammunition: '+count+' of 9'+(reloading?', reloading':''));
}
function cancelRetroPistolReload(){fieldRetroPistolReload=null;renderRetroPistolAmmo();}
function resetRetroPistolAmmo(){fieldRetroPistolAmmo=9;cancelRetroPistolReload();}
function beginRetroPistolReload(){if(fieldAdminAmmoEnabled())return false;if(!fieldActive||fieldPaused||!fieldIsRetroMode()||fieldEquipped!=='pistol'||fieldRetroPistolReload||fieldRetroPistolAmmo>=9)return false;fieldRetroPistolReload={elapsed:0};renderRetroPistolAmmo();return true;}
function updateRetroPistolReload(dt){if(fieldRetroPistolReload&&(!fieldIsRetroMode()||fieldEquipped!=='pistol'))cancelRetroPistolReload();if(fieldRetroPistolReload&&fieldActive&&!fieldPaused){fieldRetroPistolReload.elapsed=Math.min(fieldRetroPistolReloadDuration,fieldRetroPistolReload.elapsed+dt);if(fieldRetroPistolReload.elapsed>=fieldRetroPistolReloadDuration-1e-8){fieldRetroPistolAmmo=9;cancelRetroPistolReload();}}renderRetroPistolAmmo();}

function renderRetroShells(){renderRetroARAmmo();renderRetroRocketAmmo();renderRetroPistolAmmo();
 fieldShellHUD.hidden=!fieldIsRetroMode()||fieldEquipped!=='shotgun'||(!fieldActive&&!fieldPaused);
 const count=fieldRetroReloading?Math.min(7,fieldRetroReloadStartShells+Math.floor((fieldRetroReloadElapsed+1e-8)/.2)):fieldRetroShells;
 const key=count+':'+fieldRetroReloading;if(fieldShellHUD.dataset.state===key)return;
 fieldShellHUD.dataset.state=key;fieldShellHUD.style.cssText='position:absolute;right:20px;bottom:24px;text-align:right;z-index:12;pointer-events:none;color:white;text-shadow:0 2px 3px black;width:240px;max-width:calc(100% - 40px);box-sizing:border-box';fieldShellHUD.replaceChildren();
 fieldShellHUD.setAttribute('aria-label','Shotgun ammunition: '+count+' of 7 shells'+(fieldRetroReloading?', reloading':''));
 const row=document.createElement('div');row.className='field-shell-slots';
 row.style.cssText='display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;min-height:38px';
 for(let i=0;i<7;i++){
  const slot=document.createElement('span');slot.className='field-shell-slot';slot.dataset.loaded=String(i<count);
  slot.style.cssText='height:38px;box-sizing:border-box;display:flex;align-items:center;justify-content:center';
  const icon=document.createElement('img');icon.src=fieldShellSource;icon.alt=(i<count?'Loaded':'Spent')+' shell '+(i+1);icon.style.cssText='width:100%;height:36px;object-fit:contain;image-rendering:pixelated;filter:url(#fieldWhiteKey)'+(i<count?'':' grayscale(1) brightness(1.6)')+';opacity:'+(i<count?'1':'.55');slot.append(icon);
  row.append(slot);
 }
 const label=document.createElement('div');label.style.cssText='display:flex;justify-content:space-between;gap:8px;font:bold 12px monospace;margin-top:8px';
 const counter=document.createElement('span');counter.textContent='SHOTGUN · '+count+' / 7';
 const status=document.createElement('span');status.style.color='#ffdc85';status.textContent=fieldRetroReloading?'RELOADING…':'';
 label.append(counter,status);fieldShellHUD.append(row,label);
}
function finishRetroReload(){if(!fieldRetroReloading)return;fieldRetroReloading=false;fieldRetroShells=7;fieldRetroReloadAudio.pause();fieldRetroReloadAudio.currentTime=0;renderRetroShells();}
function beginRetroReload(){if(fieldAdminAmmoEnabled())return false;if(fieldIsRetroMode()&&fieldEquipped==='ar')return beginRetroARReload();if(fieldIsRetroMode()&&fieldEquipped==='rocket')return beginRetroRocketReload();if(fieldIsRetroMode()&&fieldEquipped==='pistol')return beginRetroPistolReload();if(!fieldIsRetroMode()||fieldEquipped!=='shotgun'||fieldRetroReloading||fieldRetroShells>=7)return;fieldRetroReloadStartShells=fieldRetroShells;fieldRetroReloading=true;fieldRetroReloadElapsed=0;fieldRetroReloadAudio.currentTime=0;fieldRetroReloadAudio.volume=fieldAudioVolume(fieldRetroReloadSource,'retroReload');fieldRetroReloadAudio.play().catch(()=>{});renderRetroShells();}
function updateRetroReload(dt){updateRetroARReload(dt);updateRetroPistolReload(dt);if(fieldRetroReloading){fieldRetroReloadElapsed+=dt;const duration=Number.isFinite(fieldRetroReloadAudio.duration)?fieldRetroReloadAudio.duration:3;if(fieldRetroReloadElapsed>=duration)finishRetroReload();}renderRetroShells();}
fieldRetroReloadAudio.addEventListener('ended',finishRetroReload);

function fieldModeLoadout(){return fieldFriendly?fieldLoadout.filter(id=>id==='pistol'||id==='ar'):fieldLoadout;}
function fieldAvailableWeapons(){if(godCorePowerActive())return ['god-power'];if(!fieldIsRetroMode())return fieldModeLoadout();const unlocked=new Set(['pistol','shotgun','grenade',...(fieldRetroWave>=5?['ar']:[]),...(fieldRetroWave>=10?['rocket']:[])]);return fieldRetroLoadout.filter(id=>unlocked.has(id));}
const fieldRetroPistolSources={"idle":"assets/images/fieldretropistolsources-effc51e9aa9c.png","fire":"assets/images/image-f12ba6c794e7.gif","aim":"assets/images/image-17b29b7cfa6a.png","aimFire":"assets/images/image-b22190d6ccfb.gif"};

// Key the supplied backgrounds at render time; preserve all original raster files.
document.getElementById('fieldWhiteKey').parentNode.insertAdjacentHTML('beforeend',`<filter id="fieldRetroPistolCheckerKey" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 -1 -1 0 2.78"/><feComponentTransfer><feFuncA type="linear" slope="80" intercept="0"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/></filter><filter id="fieldRetroPistolMagentaKey" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 1 -1 0 1.90"/><feComponentTransfer><feFuncA type="linear" slope="80" intercept="0"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/></filter><filter id="fieldRetroPistolYellowKey" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 -1 1 0 1.90"/><feComponentTransfer><feFuncA type="linear" slope="80" intercept="0"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/></filter>`);
const fieldRetroPistolImages={};
for(const [view,id,key,size,anchorX,anchorY,sightX,sightY] of [
 // Match the visible hip pistol, not its padded screenshot canvas.
 ['idle','fieldRetroPistolIdle','checker','100%',.85,307/316,.5,.2],
 ['fire','fieldRetroPistolFire','yellow','97.90%',.85,1,.5,.2],
 ['aim','fieldRetroPistolAim','checker','65%',.46,1,.4612,.1807],
 ['aimFire','fieldRetroPistolAimFire','magenta','68.28%',.46,1,.458,.22]
]){
 const image=new Image();image.id=id;image.alt='Retro pistol '+view;image.dataset.weaponType='pistol';image.dataset.view=view.startsWith('aim')?'aim':'idle';image.dataset.backgroundKey=key;
 image.dataset.weaponAnchorX=anchorX;image.dataset.weaponAnchorY=anchorY;image.dataset.retroPistolKey='fieldRetroPistol'+key[0].toUpperCase()+key.slice(1)+'Key';
 image.hidden=true;image.style.cssText='--weapon-size:'+size+';--sight-x:'+sightX+';--sight-y:'+sightY+';image-rendering:pixelated;filter:url(#'+image.dataset.retroPistolKey+');'+(view==='idle'?'clip-path:inset(2.85% 1.8%);':'');
 if(!view.startsWith('aim'))image.dataset.weaponContentWidth='.32';image.src=fieldRetroPistolSources[view];document.getElementById('fieldGunMotion').append(image);fieldRetroPistolImages[view]=image;
}
const fieldRetroPistolFireBytes={};const fieldRetroPistolFireReady=Promise.all(['fire','aimFire'].map(async view=>{fieldRetroPistolFireBytes[view]=new Uint8Array(await PlatdoAssets.arrayBuffer(fieldRetroPistolSources[view]));})).catch(error=>console.error('Pistol animation could not be loaded',error));
let fieldRetroPistolAnimation=null,fieldRetroPistolAnimationTimer=0,fieldRetroPistolAnimationSerial=0;
function resetFieldRetroPistolAnimation(){
 clearTimeout(fieldRetroPistolAnimationTimer);fieldRetroPistolAnimationTimer=0;fieldRetroPistolAnimationSerial++;
 if(fieldRetroPistolAnimation?.url)URL.revokeObjectURL(fieldRetroPistolAnimation.url);fieldRetroPistolAnimation=null;
 for(const view of ['fire','aimFire']){const image=fieldRetroPistolImages[view];image.onload=null;image.hidden=true;image.removeAttribute('src');}
}
function updateFieldRetroPistol(){
 const visible=fieldActive&&fieldIsRetroMode()&&fieldEquipped==='pistol',aim=visible&&fieldAiming();
 if(fieldRetroPistolAnimation&&(!visible||fieldRetroPistolAnimation.aim!==aim))resetFieldRetroPistolAnimation();
 const firing=visible&&fieldRetroPistolAnimation?.loaded,view=aim?(firing?'aimFire':'aim'):(firing?'fire':'idle');
 for(const [name,image] of Object.entries(fieldRetroPistolImages))image.hidden=!visible||name!==view;
 if(visible){document.getElementById('fieldPistolIdle').hidden=true;document.getElementById('fieldPistolAim').hidden=true;}
}
async function fireFieldRetroPistol(){
 resetFieldRetroPistolAnimation();const aim=fieldAiming(),view=aim?'aimFire':'fire',image=fieldRetroPistolImages[view],serial=fieldRetroPistolAnimationSerial;
 await fieldRetroPistolFireReady;if(serial!==fieldRetroPistolAnimationSerial||!fieldRetroPistolFireBytes[view])return;
 const url=URL.createObjectURL(new Blob([fieldRetroPistolFireBytes[view]],{type:'image/gif'}));
 fieldRetroPistolAnimation={aim,view,url,loaded:false,duration:aim?1.3:.38,serial};
 image.onload=()=>{if(serial!==fieldRetroPistolAnimationSerial||!fieldRetroPistolAnimation)return;fieldRetroPistolAnimation.loaded=true;fieldRetroPistolAnimationTimer=setTimeout(()=>{if(serial!==fieldRetroPistolAnimationSerial)return;resetFieldRetroPistolAnimation();updateFieldRetroPistol();},fieldRetroPistolAnimation.duration*1000);updateFieldRetroPistol();if(typeof fitFieldWeaponView==='function')fitFieldWeaponView();};
 image.src=url;updateFieldRetroPistol();
}
window.addEventListener('platdo:beforereset',resetFieldRetroPistolAnimation);

const godCorePowerIdleSource='assets/images/godcorepoweridlesource-498c262001e6.png.json';
const godCorePowerMusicSource='assets/audio/godcorepowermusicsource-0078e6e7a100.wav';
const godCorePowerFireSources=[
'assets/images/godcorepowerfiresources-2a3d6145a805.png',
'assets/images/image-d3fad5998aee.png',
'assets/images/image-f80989935257.png',
'assets/images/image-170d7ad50178.png',
'assets/images/image-fcb4f935a2ff.png'];
// Wave 15 finale. Playback completion is the only successful ending; quitting
// or resetting cannot turn an unfinished run into a leaderboard entry.
const godCorePowerFrameDuration=.08,godCorePowerFireDuration=godCorePowerFrameDuration*5;
const godCorePowerState={active:false,firingElapsed:null,elapsed:0,audioFailed:false,session:0,previousWeapon:'shotgun'};
const godCorePowerAudio=new Audio();godCorePowerAudio.preload='auto';godCorePowerAudio.loop=false;
const godCorePowerImages=[godCorePowerIdleSource,...godCorePowerFireSources].map((source,index)=>{
 const image=new Image();image.id=index?'godCorePowerFire'+(index-1):'godCorePowerIdle';
 image.alt=index?'GOD CORE firing frame '+index:'GOD CORE idle';image.hidden=true;
 image.dataset.weaponType='god-power';image.dataset.view='idle';
 image.dataset.weaponAnchorX='1';image.dataset.weaponAnchorY='1';
 // The forearm reaches the lower right corner in every original frame.
 image.style.cssText='--weapon-size:55%;max-width:85%;right:0;image-rendering:auto';
 image.dataset.powerSourceIndex=String(index);document.getElementById('fieldGunMotion').append(image);return image;
});
const godCorePowerStyle=document.createElement('style');godCorePowerStyle.textContent=`
#fieldGame.god-core-powered :is(#fieldCombatHUD,#fieldHealthVignette,#fieldRetroHUD,#fieldPracticeHUD,#fieldRunTimer,#fieldInventory,#fieldCrosshair,#fieldMenuBtn,#fieldShellHUD,#fieldRetroPistolAmmoHUD,#fieldRetroARAmmoHUD,#fieldRetroRocketAmmoHUD,#fieldNormalPistolAmmoHUD,#fieldFriendlyAmmoHUD,#fieldTutorialHUD,#fieldTowelPrompt,#fieldMuzzleFlash,#fieldScope){display:none!important}
#fieldGame.god-core-powered #fieldGunMotion img:not([data-weapon-type="god-power"]){display:none!important}
`;document.head.append(godCorePowerStyle);
function godCorePowerActive(){return fieldIsGodCore()&&godCorePowerState.active;}
function prepareGodCorePower(){
 if(!fieldIsGodCore())return;
 godCorePowerImages.forEach((image,index)=>{if(!image.hasAttribute('src'))PlatdoAssets.setImageSource(image,index?godCorePowerFireSources[index-1]:godCorePowerIdleSource);});
 if(!godCorePowerAudio.hasAttribute('src'))godCorePowerAudio.src=godCorePowerMusicSource;
}
function syncGodCorePowerAudio(){
 if(!godCorePowerActive()||!fieldActive||fieldPaused){godCorePowerAudio.pause();return;}
 godCorePowerAudio.volume=fieldMusicSettings.enabled?fieldMusicSettings.volume/100:0;
 if(godCorePowerAudio.ended){finishGodCorePower();return;}
 if(godCorePowerAudio.paused&&!godCorePowerState.audioFailed){
  const session=godCorePowerState.session;
  godCorePowerAudio.play().catch(()=>{if(godCorePowerState.session===session&&godCorePowerActive()&&fieldActive&&!fieldPaused)godCorePowerState.audioFailed=true;});
 }
}
function renderGodCorePower(){
 const visible=godCorePowerActive()&&(fieldActive||fieldPaused),elapsed=godCorePowerState.firingElapsed;
 const frame=elapsed===null?0:1+Math.min(4,Math.floor((elapsed+1e-8)/godCorePowerFrameDuration));
 godCorePowerImages.forEach((image,index)=>image.hidden=!visible||index!==frame);
}
function activateGodCorePower(){
 if(!fieldIsGodCore()||!fieldActive||godCorePowerState.active||fieldRetroWave<15)return false;
 prepareGodCorePower();godCorePowerState.previousWeapon=fieldEquipped;
 Object.assign(godCorePowerState,{active:true,firingElapsed:null,elapsed:0,audioFailed:false,session:godCorePowerState.session+1});
 fieldEquipped='god-power';fieldPlayerHealth=100;fieldAimToggled=false;
 fieldShotCooldown=fieldRecoil=fieldGunKick=fieldFlash=0;
 fieldProjectiles.length=fieldGrenades.length=fieldRetroRockets.length=fieldRetroLabels.length=fieldExplosions.length=0;
 cancelRetroARReload();cancelRetroPistolReload();cancelRetroRocketReload();
 fieldRetroReloading=false;fieldRetroReloadAudio.pause();resetFieldRetroPistolAnimation();
 for(const sound of fieldShotSounds)sound.volume*=.16;
 fieldRoot.classList.add('god-core-powered');godCorePowerAudio.currentTime=0;
 fieldRetroMusic.pause();renderGodCorePower();syncGodCorePowerAudio();return true;
}
function stopGodCorePower(){
 godCorePowerAudio.pause();godCorePowerAudio.currentTime=0;
 godCorePowerState.active=false;godCorePowerState.firingElapsed=null;godCorePowerState.session++;
 fieldRoot.classList.remove('god-core-powered');for(const image of godCorePowerImages)image.hidden=true;
 if(fieldEquipped==='god-power')fieldEquipped=fieldRetroLoadout.includes(godCorePowerState.previousWeapon)?godCorePowerState.previousWeapon:'shotgun';
}
function rememberGodCoreCompletion(run){
 if(!fieldSaving||!fieldIsGodCore()||!isGodCoreVictory(run))return;
 // The GOD CORE registry owns this flag, so its shared reset removes it too.
 // Existing completed runs remain valid evidence; their historic times are untouched.
 try{
  const saved=Platdo.storage('god-core');
  saved.set('completion-details',JSON.stringify({runId:run.id,completedAt:new Date().toISOString(),seconds:run.seconds,assisted:run.assisted===true,timing:'gameplay-only'}));
  saved.set('completed','true');
  window.dispatchEvent(new Event('platdo:godcorecompleted'));
 }catch(_){}
}
function finishGodCorePower(){
 if(!godCorePowerActive()||!fieldActive||fieldPaused)return;
 if(!godCorePowerAudio.ended&&!(godCorePowerState.audioFailed&&godCorePowerState.elapsed>=55.41732426303855))return;
 if(fieldRun){syncFieldRunClock();fieldRun.completed=true;rememberGodCoreCompletion(fieldRun);finishFieldRun('Completed');}
 beginGodCoreVictory();
}
godCorePowerAudio.addEventListener('ended',()=>{if(godCorePowerAudio.ended)finishGodCorePower();});
godCorePowerAudio.addEventListener('error',()=>{if(godCorePowerActive())godCorePowerState.audioFailed=true;});
window.addEventListener('platdo:beforereset',stopGodCorePower);
function updateGodCorePower(dt){
 if(!godCorePowerActive()||!fieldActive||fieldPaused)return;
 godCorePowerState.elapsed+=dt;
 if(godCorePowerState.firingElapsed!==null){
  godCorePowerState.firingElapsed+=dt;
  if(godCorePowerState.firingElapsed>=godCorePowerFireDuration-1e-8){godCorePowerState.firingElapsed=null;fieldShotCooldown=0;}
 }
 fieldPlayerHealth=100;godCoreRelayTime=Math.max(godCoreRelayTime,1);
 renderGodCorePower();
 // An unavailable audio device must not trap a player in an endless finale.
 if(godCorePowerState.audioFailed&&godCorePowerState.elapsed>=55.41732426303855)finishGodCorePower();
}
function shootGodCorePower(){
 if(!godCorePowerActive()||!fieldActive||fieldPaused||godCorePowerState.firingElapsed!==null||fieldShotCooldown>1e-8)return false;
 godCorePowerState.firingElapsed=0;fieldShotCooldown=godCorePowerFireDuration;fieldShotCount++;recordFieldShot('god-power');
 const yaw=fieldPose.yaw,pitch=fieldPose.pitch,speed=30;
 fieldRetroRockets.push({x:fieldEyeX(),y:fieldHeight-fieldCrouchOffset,z:fieldEyeZ(),vx:Math.sin(yaw)*Math.cos(pitch)*speed,vy:Math.sin(pitch)*speed,vz:-Math.cos(yaw)*Math.cos(pitch)*speed,life:4,shotId:fieldShotCount,weapon:'god-power'});
 renderGodCorePower();return true;
}

function startRetroRun(){resetFieldAdmin();cancelGodCoreAcquisition();stopGodCorePower();prepareGodCorePower();if(fieldIsGodCore())fieldRetroMap='godcore';resetGodCoreArena();resetRetroARAmmo();resetRetroRocketAmmo();resetRetroPistolAmmo();resetFieldRetroPistolAnimation();fieldRetroReloadAudio.pause();fieldRetroReloadAudio.currentTime=0;fieldRetroShells=7;fieldRetroReloading=false;fieldRetroReloadElapsed=0;fieldExplosions.length=0;fieldPreviewRetroMap=null;[fieldPose.x,fieldPose.z]=fieldRetroMaps[fieldRetroMap].spawn;fieldPose.yaw=0;fieldPose.pitch=0;fieldHeight=1.7;fieldVelocity=0;fieldShotCooldown=0;for(const d of fieldDoors)d.open=0;fieldEnemy=null;fieldRetroEnemies.length=0;fieldGrenades.length=0;fieldRetroLabels.length=0;fieldRetroWave=1;fieldEquipped='shotgun';beginRetroWave();}
function beginRetroWave(){if(fieldIsGodCore()&&fieldRetroWave>=15&&!godCoreAcquisitionSeen){beginGodCoreAcquisition();return;}if(fieldIsGodCore()&&fieldRetroWave>=15)activateGodCorePower();fieldRetroPending=godCorePowerActive()?36+(fieldRetroWave-15)*8:2+fieldRetroWave;fieldRetroIntermission=0;fieldRetroCleared=false;fieldEnemyShots.length=0;fillRetroEnemies();if(fieldRun){fieldRun.wave=fieldRetroWave;queueFieldRunSave();}renderFieldInventory();updateRetroHUD();}
function fillGodCoreEnemies(){
 while(fieldRetroPending>0&&fieldRetroEnemies.length<12){
  let enemy=null;
  for(let i=0;i<60;i++){
   const candidate={x:0,z:0,yaw:0,health:100+Math.floor((fieldRetroWave-1)/5)*20,maxHealth:100+Math.floor((fieldRetroWave-1)/5)*20,fireTimer:1.8+Math.random()*1.2,patrolTimer:0};
   fieldSafeSpawn(candidate);
   if(!fieldBlocked(candidate.x,candidate.z,candidate.y||0,2.3,.4)&&Math.hypot(candidate.x-fieldPose.x,(candidate.y||0)-(fieldHeight-1.7),candidate.z-fieldPose.z)>4.5&&fieldRetroEnemies.every(e=>Math.hypot(e.x-candidate.x,(e.y||0)-(candidate.y||0),e.z-candidate.z)>1.25)){enemy=candidate;break;}
  }
  if(!enemy)break;fieldRetroEnemies.push(enemy);fieldRetroPending--;
 }
}
function fillRetroEnemies(){if(fieldIsGodCore()){fillGodCoreEnemies();return;}while(fieldRetroPending>0&&fieldRetroEnemies.length<12){const angle=fieldPose.yaw+(Math.random()*2-1)*Math.PI,radius=12+Math.random()*6;fieldRetroEnemies.push({x:fieldPose.x+Math.sin(angle)*radius,z:fieldPose.z-Math.cos(angle)*radius,yaw:angle+Math.PI,health:100+Math.floor((fieldRetroWave-1)/5)*20,maxHealth:100+Math.floor((fieldRetroWave-1)/5)*20,fireTimer:1.5+Math.random()*1.5,patrolTimer:0});fieldSafeSpawn(fieldRetroEnemies[fieldRetroEnemies.length-1]);fieldRetroPending--;}}
function updateRetroHUD(){syncFieldHUDStyle();const hud=document.getElementById('fieldRetroHUD');hud.hidden=!fieldActive||!fieldIsRetroMode();const count=fieldRetroEnemies.length+fieldRetroPending,next=fieldRetroWave<5?'AUTOMATIC AT WAVE 5':fieldRetroWave<10?'ROCKET LAUNCHER AT WAVE 10':'HOLD IN THERE A LITTLE LONGER',key=[fieldRetroWave,fieldRetroCleared,count,next].join(':');if(hud.dataset.state===key)return;hud.dataset.state=key;const wave=document.createElement('strong'),detail=document.createElement('span');wave.className='field-retro-wave-title';wave.textContent='WAVE '+fieldRetroWave+(fieldRetroCleared?' CLEAR!':'');detail.className='field-retro-wave-detail';detail.textContent=(fieldRetroCleared?'':count+' ENEMIES · ')+next;hud.replaceChildren(wave,detail);}
function defeatRetroEnemy(e){const index=fieldRetroEnemies.indexOf(e);if(index<0)return false;fieldRetroEnemies.splice(index,1);if(fieldRun){fieldRun.kills=(fieldRun.kills||0)+1;queueFieldRunSave();}if(fieldFriendly)playFieldPistolSound(fieldFriendlyDeathAudio,'friendlyEnemyDeath');if(!fieldRetroEnemies.length&&!fieldRetroPending&&!fieldRetroCleared){fieldRetroCleared=true;if(fieldRun)fieldRun.completedWaves=fieldRetroWave;fieldPlayerHealth=100;updateFieldCombatHUD();fieldRetroIntermission=godCorePowerActive()?.35:2.5;fieldEnemyShots.length=0;if(!godCorePowerActive())playFieldPistolSound(fieldWaveAudio);queueFieldRunSave();}updateRetroHUD();return true;}
// Sweep the grenade's radius against the same solid boxes used by players and bullets.
function fieldGrenadeContact(origin,delta,box,radius){
 const half=box.h.map(value=>value+radius),relative=origin.map((value,axis)=>value-box.c[axis]);
 if(relative.every((value,axis)=>Math.abs(value)<half[axis]-1e-7)){
  let axis=0;for(let i=1;i<3;i++)if(half[i]-Math.abs(relative[i])<half[axis]-Math.abs(relative[axis]))axis=i;
  const normal=[0,0,0];normal[axis]=relative[axis]>=0?1:-1;
  return {t:0,normal,push:half[axis]-Math.abs(relative[axis])+.001};
 }
 const t=fieldSegmentBox(origin,delta,box.c,half);if(t===null)return null;
 let axis=-1;for(let i=0;i<3;i++)if(Math.abs(delta[i])>1e-8){
  const entry=(box.c[i]-Math.sign(delta[i])*half[i]-origin[i])/delta[i];
  if(Math.abs(entry-t)<1e-6&&(axis<0||Math.abs(delta[i])>Math.abs(delta[axis])))axis=i;
 }
 // Starting on a surface and travelling away from it is not another collision.
 if(axis<0)return null;const normal=[0,0,0];normal[axis]=-Math.sign(delta[axis]);
 return {t,normal,push:.001};
}
function moveRetroGrenade(g,dt){
 const radius=.14,boxes=fieldWorldBoxes(),steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps;
 for(let substep=0;substep<steps;substep++){
  g.vy-=10*step;const position=[g.x,g.y,g.z],velocity=[g.vx,g.vy,g.vz];let remaining=step;
  // Resolve multiple contacts so corners and narrow doorways cannot tunnel the grenade.
  for(let bounce=0;bounce<8&&remaining>1e-7;bounce++){
   const delta=velocity.map(value=>value*remaining);let contact=null;
   for(const box of boxes){const hit=fieldGrenadeContact(position,delta,box,radius);if(hit&&(!contact||hit.t<contact.t))contact=hit;}
   if(!contact){for(let axis=0;axis<3;axis++)position[axis]+=delta[axis];remaining=0;break;}
   for(let axis=0;axis<3;axis++)position[axis]+=delta[axis]*contact.t+contact.normal[axis]*contact.push;
   const approach=velocity.reduce((total,value,axis)=>total+value*contact.normal[axis],0),floor=contact.normal[1]>.5;
   if(approach<0){
    const restitution=floor?.5:.65;
    for(let axis=0;axis<3;axis++)velocity[axis]-=(1+restitution)*approach*contact.normal[axis];
    if(floor){
     if(Math.abs(approach)<.6)velocity[1]=0;
     const drag=Math.abs(approach)<.6?Math.exp(-5*step):.85;velocity[0]*=drag;velocity[2]*=drag;
    }
   }
   remaining*=1-contact.t;
  }
  [g.x,g.y,g.z]=position;[g.vx,g.vy,g.vz]=velocity;
 }
}
function updateRetroCombat(dt){updateRetroRocketReload(dt);updateRetroReload(dt);for(let i=fieldExplosions.length-1;i>=0;i--){fieldExplosions[i].age+=dt;if(fieldExplosions[i].age>=1.2)fieldExplosions.splice(i,1);}updateRetroRockets(dt);fieldCombatMessageTime-=dt;if(fieldCombatMessageTime<=0)fieldCombatMessage='';if(fieldRetroCleared){fieldRetroIntermission-=dt;if(fieldRetroIntermission<=0){fieldRetroWave++;beginRetroWave();if(godCoreAcquisitionActive)return;}}else{fillRetroEnemies();for(const e of fieldRetroEnemies){walkFieldEnemy(e,dt);e.yaw=Math.atan2(fieldPose.x-e.x,fieldPose.z-e.z);e.fireTimer=Math.max(0,e.fireTimer-dt);if(e.fireTimer<=0&&fieldEnemyLineOfSight(e,1.97)){e.fireTimer=godCorePowerActive()?.2:Math.max(.65,3-(fieldRetroWave-1)*.12);const x=e.x+Math.sin(e.yaw)*.04,y=(fieldIsGodCore()?(e.y||0):0)+1.97,z=e.z+Math.cos(e.yaw)*.04;const dx=fieldPose.x-x,dy=fieldHeight-fieldCrouchOffset-.3-y,dz=fieldPose.z-z,len=Math.hypot(dx,dy,dz),speed=Math.min(26,12+fieldRetroWave*.4);fieldEnemyShots.push({x,y,z,vx:dx/len*speed,vy:dy/len*speed,vz:dz/len*speed,life:8,enemy:true});if(fieldEnemyShots.length>128)fieldEnemyShots.splice(0,fieldEnemyShots.length-128);playFieldPistolSound(fieldRetroEnemyAudio,'retroEnemy');}}}updateFieldIncomingShots(dt);if(!fieldActive)return;
for(let i=fieldGrenades.length-1;i>=0;i--){const g=fieldGrenades[i];moveRetroGrenade(g,Math.min(dt,Math.max(0,g.life)));g.life-=dt;if(g.life<=0){fieldExplosions.push({x:g.x,y:g.y+.8,z:g.z,age:0});playFieldPistolSound(fieldGrenadeExplosionAudio,'grenadeExplosion');for(const e of [...fieldRetroEnemies]){const d=fieldIsGodCore()?godCoreBlastDistance({x:g.x,y:g.y+.18,z:g.z},e):Math.hypot(e.x-g.x,e.z-g.z);if(d<=5){const damage=Math.min(e.health,Math.round(140*(1-d/8)));e.health-=damage;recordFieldHit(g);addRetroDamage(e,damage);if(e.health<=0)defeatRetroEnemy(e);}}fieldGrenades.splice(i,1);}}for(let i=fieldRetroLabels.length-1;i>=0;i--){fieldRetroLabels[i].life-=dt;if(fieldRetroLabels[i].life<=0)fieldRetroLabels.splice(i,1);}updateRetroHUD();}

// A launcher magazine holds one three-rocket burst. All three projectiles share
// one run shot identifier; their separate explosions can count only one hit.
const fieldRetroRockets=[];
let fieldRetroRocketAmmo=1,fieldRetroRocketReload=null;
const fieldRetroRocketReloadDuration=3,fieldRetroRocketAmmoImage=new Image();
const fieldRetroRocketReloadSource='assets/audio/fieldretrorocketreloadsource-dff87d8ed3e1.mp3';
const fieldRetroRocketReloadAudio=new Audio(fieldRetroRocketReloadSource);
fieldRetroRocketReloadAudio.preload="auto";
window.addEventListener("platdo:beforereset",cancelRetroRocketReload);
const fieldRetroRocketKeySVG=document.createElementNS('http://www.w3.org/2000/svg','svg');fieldRetroRocketKeySVG.setAttribute('width','0');fieldRetroRocketKeySVG.setAttribute('height','0');fieldRetroRocketKeySVG.style.cssText='position:absolute;pointer-events:none';fieldRetroRocketKeySVG.innerHTML='<defs><filter id="fieldRetroRocketAmmoKey" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 -1 -1 0 2.68"/><feComponentTransfer><feFuncA type="linear" slope="80" intercept="0"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/></filter></defs>';fieldRoot.append(fieldRetroRocketKeySVG);
const fieldRetroRocketAmmoHUD=document.createElement('div');fieldRetroRocketAmmoHUD.id='fieldRetroRocketAmmoHUD';fieldRetroRocketAmmoHUD.hidden=true;fieldRoot.append(fieldRetroRocketAmmoHUD);
const fieldRetroRocketHUDStyle=document.createElement('style');fieldRetroRocketHUDStyle.textContent=`
#fieldRetroRocketAmmoHUD{position:absolute;right:20px;bottom:24px;z-index:12;min-width:100px;max-width:calc(100% - 40px);pointer-events:none;color:white;background:none;border:0;padding:0;text-align:right;text-shadow:0 2px 3px black;font:bold 12px monospace}
#fieldRetroRocketAmmoHUD[hidden]{display:none!important}
#fieldRetroRocketAmmoHUD img{display:block;width:83px;height:53px;object-fit:contain;margin-left:auto;image-rendering:pixelated}
#fieldRetroRocketAmmoHUD .field-rocket-ammo-label{margin-top:5px;min-height:16px;white-space:nowrap}
`;document.head.append(fieldRetroRocketHUDStyle);
function renderRetroRocketAmmo(){
 const hud=fieldRetroRocketAmmoHUD;hud.hidden=!fieldIsRetroMode()||fieldEquipped!=='rocket'||(!fieldActive&&!fieldPaused);if(hud.hidden)return;
 if(!fieldRetroRocketAmmoImage.src)fieldRetroRocketAmmoImage.src=fieldRetroRocketAmmoSource;
 const key=fieldRetroRocketAmmo+':'+!!fieldRetroRocketReload;if(hud.dataset.state===key)return;hud.dataset.state=key;hud.replaceChildren();
 const icon=document.createElement('img');icon.src=fieldRetroRocketAmmoSource;icon.alt=fieldRetroRocketAmmo?'Loaded three-rocket burst':'Spent three-rocket burst';icon.dataset.loaded=String(fieldRetroRocketAmmo>0);icon.style.filter='url(#fieldRetroRocketAmmoKey)'+(fieldRetroRocketAmmo?'':' grayscale(1) brightness(1.6)');icon.style.opacity=fieldRetroRocketAmmo?'1':'.55';
 const label=document.createElement('div');label.className='field-rocket-ammo-label';label.textContent=fieldRetroRocketAmmo+' / 1'+(fieldRetroRocketReload?' · RELOADING':'');hud.append(icon,label);hud.setAttribute('aria-label','Rocket ammunition: '+fieldRetroRocketAmmo+' of 1 three-rocket bursts'+(fieldRetroRocketReload?', reloading':''));
}
function cancelRetroRocketReload(){fieldRetroRocketReload=null;fieldRetroRocketReloadAudio.pause();fieldRetroRocketReloadAudio.currentTime=0;renderRetroRocketAmmo();}
function resetRetroRocketAmmo(){fieldRetroRocketAmmo=1;fieldRetroRockets.length=0;cancelRetroRocketReload();}
function beginRetroRocketReload(){if(fieldAdminAmmoEnabled())return false;if(!fieldActive||fieldPaused||!fieldIsRetroMode()||godCorePowerActive()||fieldEquipped!=='rocket'||fieldRetroRocketReload||fieldRetroRocketAmmo>=1)return false;fieldRetroRocketReload={elapsed:0};fieldRetroRocketReloadAudio.currentTime=0;fieldRetroRocketReloadAudio.volume=fieldAudioVolume(fieldRetroRocketReloadSource,'retroRocketReload');fieldRetroRocketReloadAudio.play().catch(()=>{});fieldAimToggled=false;renderRetroRocketAmmo();return true;}
function updateRetroRocketReload(dt){
 if(fieldRetroRocketReload&&(!fieldIsRetroMode()||fieldEquipped!=='rocket'))cancelRetroRocketReload();
 if(fieldRetroRocketReload&&fieldActive&&!fieldPaused){fieldRetroRocketReload.elapsed=Math.min(fieldRetroRocketReloadDuration,fieldRetroRocketReload.elapsed+dt);if(fieldRetroRocketReload.elapsed>=fieldRetroRocketReloadDuration-1e-8){fieldRetroRocketAmmo=1;cancelRetroRocketReload();}}
 renderRetroRocketAmmo();
}
function shootRetroRocketBurst(){
 if(!fieldActive||fieldPaused||!fieldIsRetroMode()||fieldEquipped!=='rocket'||fieldShotCooldown>0)return false;
 if(fieldRetroRocketReload)return false;if(fieldRetroRocketAmmo<=0){beginRetroRocketReload();return false;}
 fieldRetroRocketAmmo=fieldAdminAmmoEnabled()?1:0;fieldShotCooldown=.35;fieldShotCount++;recordFieldShot('rocket');
 const yaw=fieldPose.yaw,pitch=fieldPose.pitch+fieldRecoil;
 for(const offset of[-.047,0,.047]){const a=yaw+offset,speed=18;fieldRetroRockets.push({x:fieldEyeX(),y:fieldHeight-fieldCrouchOffset,z:fieldEyeZ(),vx:Math.sin(a)*Math.cos(pitch)*speed,vy:Math.sin(pitch)*speed,vz:-Math.cos(a)*Math.cos(pitch)*speed,life:4,shotId:fieldShotCount,weapon:'rocket'});}
 if(fieldRetroRockets.length>24)fieldRetroRockets.splice(0,fieldRetroRockets.length-24);fieldGunKick=Math.min(32,fieldGunKick+20);fieldRecoil=Math.min(.12,fieldRecoil+.045);fieldFlash=0;beginRetroRocketReload();renderRetroRocketAmmo();return true;
}
function retroRocketEnemyIntersection(rocket,dt,enemy){
 const c=Math.cos(enemy.yaw||0),s=Math.sin(enemy.yaw||0),x=rocket.x-enemy.x,z=rocket.z-enemy.z;
 return fieldSegmentBox([c*x-s*z,rocket.y-(fieldIsGodCore()?(enemy.y||0):0),s*x+c*z],[(c*rocket.vx-s*rocket.vz)*dt,rocket.vy*dt,(s*rocket.vx+c*rocket.vz)*dt],[0,1.2,0],[.72,1.23,.25]);
}
function explodeRetroRocket(rocket){
 const powered=rocket.weapon==='god-power',radius=powered?6.5:4;
 fieldExplosions.push({x:rocket.x,y:Math.max(.3,rocket.y),z:rocket.z,age:0,powered});if(fieldExplosions.length>48)fieldExplosions.splice(0,fieldExplosions.length-48);playFieldPistolSound(fieldGrenadeExplosionAudio,'grenadeExplosion');
 for(const enemy of [...fieldRetroEnemies]){
  const dx=enemy.x-rocket.x,dy=(fieldIsGodCore()?(enemy.y||0):0)+1.2-rocket.y,dz=enemy.z-rocket.z,distance=Math.hypot(dx,dy,dz);if(distance>=radius)continue;
  const blocked=fieldWorldHit({x:rocket.x,y:rocket.y,z:rocket.z,vx:dx,vy:dy,vz:dz},1);if(blocked!==null&&blocked<.999)continue;
  const damage=Math.min(enemy.health,Math.max(1,Math.round((powered?1600:120)*(1-distance/radius))));enemy.health=Math.max(0,enemy.health-damage);recordFieldHit(rocket);addRetroDamage(enemy,damage);if(enemy.health<=0)defeatRetroEnemy(enemy);
 }
}
function updateRetroRockets(dt){
 if(!fieldActive||fieldPaused||!fieldIsRetroMode())return;const radius=.09;
 for(let i=fieldRetroRockets.length-1;i>=0;i--){
  const rocket=fieldRetroRockets[i],step=Math.min(Math.max(0,dt),rocket.life),origin=[rocket.x,rocket.y,rocket.z],delta=[rocket.vx*step,rocket.vy*step,rocket.vz*step];let nearest=null;
  for(const wall of fieldWorldBoxes()){const t=fieldSegmentBox(origin,delta,wall.c,wall.h.map(h=>h+radius));if(t!==null&&(nearest===null||t<nearest))nearest=t;}
  if(delta[1]<0&&rocket.y+delta[1]<=radius){const t=(radius-rocket.y)/delta[1];if(t>=0&&(nearest===null||t<nearest))nearest=t;}
  for(const enemy of fieldRetroEnemies){const t=retroRocketEnemyIntersection(rocket,step,enemy);if(t!==null&&(nearest===null||t<nearest))nearest=t;}
  const travel=nearest===null?1:Math.max(0,nearest);rocket.x+=delta[0]*travel;rocket.y+=delta[1]*travel;rocket.z+=delta[2]*travel;rocket.life=Math.max(0,rocket.life-step);
  if(nearest!==null||rocket.life<=0){if(fieldIsGodCore()&&Math.abs(rocket.x-godCoreRelay.c[0])<.65&&Math.abs(rocket.y-godCoreRelay.c[1])<.45&&Math.abs(rocket.z-godCoreRelay.c[2])<.35)godCoreRelayTime=12;explodeRetroRocket(rocket);fieldRetroRockets.splice(i,1);}
 }
}
function drawRetroRockets(ctx,project){
 if(!fieldRetroRocketAmmoImage.src)fieldRetroRocketAmmoImage.src=fieldRetroRocketAmmoSource;
 if(!fieldRetroRocketAmmoImage.complete||!fieldRetroRocketAmmoImage.naturalWidth)return;
 for(const rocket of fieldRetroRockets){
  const blocked=fieldWorldHit({x:fieldEyeX(),y:fieldHeight-fieldCrouchOffset,z:fieldEyeZ(),vx:rocket.x-fieldEyeX(),vy:rocket.y-(fieldHeight-fieldCrouchOffset),vz:rocket.z-fieldEyeZ()},1);if(blocked!==null&&blocked<.999)continue;
  const q=project(rocket.x,rocket.y,rocket.z);if(!q)continue;const tip=project(rocket.x+rocket.vx*.04,rocket.y+rocket.vy*.04,rocket.z+rocket.vz*.04),height=Math.max(5,Math.min(70,q.scale*.40)),width=height*22/43;
  if(rocket.weapon==='god-power'){const radius=Math.max(4,Math.min(45,q.scale*.18));ctx.save();ctx.shadowBlur=22;ctx.shadowColor='#218bff';ctx.fillStyle='#72e7ff';ctx.beginPath();ctx.arc(q.x,q.y,radius,0,Math.PI*2);ctx.fill();ctx.fillStyle='white';ctx.beginPath();ctx.arc(q.x,q.y,radius*.4,0,Math.PI*2);ctx.fill();ctx.restore();continue;}
  ctx.save();ctx.translate(q.x,q.y);if(tip&&Math.hypot(tip.x-q.x,tip.y-q.y)>.05)ctx.rotate(Math.atan2(tip.y-q.y,tip.x-q.x)+Math.PI/2);ctx.filter='url(#fieldRetroRocketAmmoKey)';ctx.imageSmoothingEnabled=false;ctx.drawImage(fieldRetroRocketAmmoImage,32,5,22,43,-width/2,-height/2,width,height);ctx.restore();
 }
}


const fieldRetroARAmmoHUD=document.createElement('div');fieldRetroARAmmoHUD.id='fieldRetroARAmmoHUD';fieldRetroARAmmoHUD.hidden=true;fieldRoot.append(fieldRetroARAmmoHUD);
const fieldRetroARKeySVG=document.createElementNS('http://www.w3.org/2000/svg','svg');fieldRetroARKeySVG.setAttribute('width','0');fieldRetroARKeySVG.setAttribute('height','0');fieldRetroARKeySVG.style.cssText='position:absolute;pointer-events:none';fieldRetroARKeySVG.innerHTML='<defs><filter id="fieldRetroARBulletKey" color-interpolation-filters="sRGB"><feFlood flood-color="#8b8b8b"/><feBlend in2="SourceGraphic" mode="difference"/><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 1 1 0 0"/><feComponentTransfer><feFuncA type="linear" slope="20" intercept="0"/></feComponentTransfer><feComposite in="SourceGraphic" operator="in"/></filter></defs>';fieldRoot.append(fieldRetroARKeySVG);
const fieldRetroARAmmoStyle=document.createElement('style');fieldRetroARAmmoStyle.textContent=`
#fieldRetroARAmmoHUD{position:absolute;right:20px;bottom:24px;z-index:12;width:300px;max-width:calc(100% - 40px);box-sizing:border-box;pointer-events:none;color:white;background:none;border:0;padding:0;text-align:right;text-shadow:0 2px 3px black;font:bold 12px monospace}
#fieldRetroARAmmoHUD[hidden]{display:none!important}
.field-retro-ar-bullets{display:grid;grid-template-columns:repeat(22,minmax(0,1fr));gap:4px 2px;justify-items:center}
.field-retro-ar-bullet{position:relative;width:8px;height:32px;overflow:hidden}
.field-retro-ar-bullet img{position:absolute;left:-9.25px;top:-1.99px;width:24.10px;height:35.08px;max-width:none;image-rendering:pixelated;filter:url(#fieldRetroARBulletKey)}
.field-retro-ar-bullet img[data-loaded="false"]{filter:url(#fieldRetroARBulletKey) grayscale(1) brightness(1.6);opacity:.55}
.field-retro-ar-ammo-label{margin-top:5px;min-height:16px}
`;document.head.append(fieldRetroARAmmoStyle);
let fieldRetroARAmmo=43,fieldRetroARReload=null;
const fieldRetroARReloadDuration=2;
const fieldRetroARReloadSource="assets/audio/fieldretroarreloadsource-c1acdf3043f5.mp3";
const fieldRetroARReloadAudio=new Audio(fieldRetroARReloadSource);
fieldRetroARReloadAudio.preload="auto";
window.addEventListener("platdo:beforereset",cancelRetroARReload);
function renderRetroARAmmo(){
 const hud=fieldRetroARAmmoHUD;hud.hidden=!fieldIsRetroMode()||fieldEquipped!=='ar'||(!fieldActive&&!fieldPaused);if(hud.hidden)return;
 const count=Math.max(0,Math.min(43,fieldRetroARAmmo)),reloading=!!fieldRetroARReload,key=count+':'+reloading;if(hud.dataset.state===key)return;hud.dataset.state=key;
 if(!hud.querySelector('.field-retro-ar-bullets')){const row=document.createElement('div');row.className='field-retro-ar-bullets';for(let i=0;i<43;i++){const slot=document.createElement('span');slot.className='field-retro-ar-bullet';const icon=document.createElement('img');icon.src=fieldRetroARBulletSource;icon.alt='';icon.setAttribute('aria-hidden','true');slot.append(icon);row.append(slot);}const label=document.createElement('div');label.className='field-retro-ar-ammo-label';hud.replaceChildren(row,label);}
 hud.querySelectorAll('img').forEach((icon,i)=>icon.dataset.loaded=String(i<count));hud.querySelector('.field-retro-ar-ammo-label').textContent=count+' / 43'+(reloading?' · RELOADING':'');hud.setAttribute('aria-label','AR ammunition: '+count+' of 43'+(reloading?', reloading':''));
}
function cancelRetroARReload(){fieldRetroARReload=null;fieldRetroARReloadAudio.pause();fieldRetroARReloadAudio.currentTime=0;renderRetroARAmmo();}
function resetRetroARAmmo(){fieldRetroARAmmo=43;cancelRetroARReload();}
function beginRetroARReload(){if(fieldAdminAmmoEnabled())return false;if(!fieldActive||fieldPaused||!fieldIsRetroMode()||fieldEquipped!=='ar'||fieldRetroARReload||fieldRetroARAmmo>=43)return false;fieldRetroARReload={elapsed:0};fieldRetroARReloadAudio.currentTime=0;fieldRetroARReloadAudio.volume=fieldAudioVolume(fieldRetroARReloadSource,'retroARReload');fieldRetroARReloadAudio.play().catch(()=>{});renderRetroARAmmo();return true;}
function updateRetroARReload(dt){if(fieldRetroARReload&&(!fieldIsRetroMode()||fieldEquipped!=='ar'))cancelRetroARReload();if(fieldRetroARReload&&fieldActive&&!fieldPaused){fieldRetroARReload.elapsed=Math.min(fieldRetroARReloadDuration,fieldRetroARReload.elapsed+dt);if(fieldRetroARReload.elapsed>=fieldRetroARReloadDuration-1e-8){fieldRetroARAmmo=43;cancelRetroARReload();}}renderRetroARAmmo();}

function shootRetroWeapon(){if(godCorePowerActive()){shootGodCorePower();return;}if(fieldEquipped==='ar'&&(fieldRetroARReload||fieldRetroARAmmo<=0)){if(!fieldRetroARReload)beginRetroARReload();return;}if(fieldEquipped==='pistol'&&(fieldRetroPistolReload||fieldRetroPistolAmmo<=0)){if(!fieldRetroPistolReload)beginRetroPistolReload();return;}if(!fieldAvailableWeapons().includes(fieldEquipped)||(fieldEquipped==='shotgun'&&fieldRetroReloading))return;if(fieldEquipped==='rocket'){shootRetroRocketBurst();return;}const spec={pistol:{delay:.5,kick:6,recoil:.012,pellets:1,sound:fieldPistolShotAudio},shotgun:{delay:1,kick:16,recoil:.035,pellets:8,sound:fieldRetroShotgunAudio},ar:{delay:.12,kick:5,recoil:.009,pellets:1,sound:fieldARShotAudio},sniper:{delay:1.4,kick:14,recoil:.025,pellets:1,sound:fieldSniperShotAudio},grenade:{delay:2.5,kick:5,recoil:0,pellets:0}}[fieldEquipped];fieldShotCooldown=spec.delay;if(fieldEquipped==='pistol')fireFieldRetroPistol();fieldShotCount++;recordFieldShot(fieldEquipped);const yaw=fieldPose.yaw,pitch=fieldPose.pitch+fieldRecoil;if(fieldEquipped==='grenade'){fieldGrenades.push({x:fieldEyeX(),y:fieldHeight-fieldCrouchOffset,z:fieldEyeZ(),vx:Math.sin(yaw)*10,vy:3+Math.sin(pitch)*8,vz:-Math.cos(yaw)*10,life:1.2,shotId:fieldShotCount});}else{playFieldPistolSound(spec.sound);fieldFlash=.055;for(let i=0;i<spec.pellets;i++){const spread=spec.pellets>1?.055:0,a=yaw+(Math.random()-.5)*spread,b=pitch+(Math.random()-.5)*spread;fieldProjectiles.push({shotId:fieldShotCount,weapon:fieldEquipped,x:fieldEyeX(),y:fieldHeight-fieldCrouchOffset,z:fieldEyeZ(),vx:Math.sin(a)*Math.cos(b)*100,vy:Math.sin(b)*100,vz:-Math.cos(a)*Math.cos(b)*100,life:2});}}fieldGunKick=Math.min(32,fieldGunKick+spec.kick);fieldRecoil=Math.min(.12,fieldRecoil+spec.recoil);if(fieldEquipped==='shotgun'){if(!fieldAdminAmmoEnabled())fieldRetroShells--;if(fieldRetroShells===0)beginRetroReload();renderRetroShells();}if(fieldEquipped==='ar'){if(!fieldAdminAmmoEnabled())fieldRetroARAmmo--;if(fieldRetroARAmmo===0)beginRetroARReload();renderRetroARAmmo();}if(fieldEquipped==='pistol'){if(!fieldAdminAmmoEnabled())fieldRetroPistolAmmo--;if(fieldRetroPistolAmmo===0)beginRetroPistolReload();renderRetroPistolAmmo();}}
function addRetroDamage(enemy,damage){const prior=fieldRetroLabels.find(l=>l.enemy===enemy);if(prior){prior.total+=damage;prior.life=1;}else fieldRetroLabels.push({enemy,total:damage,life:1,x:enemy.x,y:fieldIsGodCore()?(enemy.y||0):2.4,z:enemy.z});}
const retroDigitPixels=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
function drawRetroEffects(ctx,width,height,f,r,u,eye){if(!fieldIsRetroMode())return;function project(x,y,z){if(fieldIsGodCore()){const wall=fieldWorldHit({x:fieldEyeX(),y:eye,z:fieldEyeZ(),vx:x-fieldEyeX(),vy:y-eye,vz:z-fieldEyeZ()},1);if(wall!==null&&wall<.985)return null;}const d=[x-fieldEyeX(),y-eye,z-fieldEyeZ()],depth=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(depth<.1)return null;const scale=height*fieldAimZoom()/(1.4*depth);return {x:width/2+(d[0]*r[0]+d[2]*r[2])*scale,y:height/2-(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])*scale,scale};}ctx.save();drawRetroRockets(ctx,project);for(const effect of fieldExplosions){const q=project(effect.x,effect.y,effect.z),frame=fieldExplosionFrames[Math.min(5,Math.floor((effect.age+1e-8)/.2))];if(q&&frame.complete&&frame.naturalWidth){const size=q.scale*3;ctx.save();ctx.filter=effect.powered?'url(#fieldWhiteKey) hue-rotate(155deg) saturate(1.4)':'url(#fieldWhiteKey)';ctx.imageSmoothingEnabled=false;ctx.drawImage(frame,q.x-size/2,q.y-size/2,size,size);ctx.restore();}}for(const g of fieldGrenades){const q=project(g.x,g.y,g.z);if(q){const size=Math.max(4,q.scale*.15);ctx.save();ctx.filter='url(#fieldGrenadeKey)';ctx.imageSmoothingEnabled=false;if(fieldGrenadeImage.complete)ctx.drawImage(fieldGrenadeImage,q.x-size,q.y-size,size*2,size*2);ctx.restore();}}for(const label of godCorePowerActive()?[]:fieldRetroLabels){const e=fieldRetroEnemies.includes(label.enemy)?label.enemy:label;const q=project(e.x,(fieldIsGodCore()?(e.y||0):0)+2.4,e.z);if(!q)continue;const text=String(label.total),pixel=4;for(let n=0;n<text.length;n++){const glyph=retroDigitPixels[Number(text[n])];for(let k=0;k<15;k++)if(glyph[k]==='1'){const x=Math.round(q.x+(n*4-text.length*2)*pixel+(k%3)*pixel),y=Math.round(q.y+Math.floor(k/3)*pixel);ctx.fillStyle='#152313';ctx.fillRect(x-1,y-1,pixel+2,pixel+2);ctx.fillStyle='#edff8d';ctx.fillRect(x,y,pixel,pixel);}}}ctx.restore();}
function fieldPracticeHUD(){const hud=document.getElementById('fieldPracticeHUD');hud.hidden=!fieldActive||!fieldPractice;hud.textContent=fieldWaveHits>=10?'Wave '+fieldWave+' complete!':'Wave '+fieldWave+' · '+fieldWaveHits+' / 10 targets';if(fieldRun)hud.textContent+=' · '+fieldRun.shots+'/'+fieldRun.hits+' shots/hits';}
function fieldPracticeTargetClear(x,y,z,radius=.42){
 if(y<radius+.03)return false;
 if(fieldWorldBoxes().some(b=>{const dx=Math.max(0,Math.abs(x-b.c[0])-b.h[0]),dy=Math.max(0,Math.abs(y-b.c[1])-b.h[1]),dz=Math.max(0,Math.abs(z-b.c[2])-b.h[2]);return dx*dx+dy*dy+dz*dz<(radius+.04)**2;}))return false;
 const eyeY=fieldHeight-fieldCrouchOffset;
 return fieldWorldHit({x:fieldEyeX(),y:eyeY,z:fieldEyeZ(),vx:x-fieldEyeX(),vy:y-eyeY,vz:z-fieldEyeZ()},1)===null;
}
function spawnFieldTarget(){
 const distance=10,near=fieldLastTarget;let yaw=near?Math.atan2(near.x-fieldPose.x,-(near.z-fieldPose.z)):fieldPose.yaw;
 // Keep successive targets close and in front, even after the player moves.
 let delta=Math.atan2(Math.sin(yaw-fieldPose.yaw),Math.cos(yaw-fieldPose.yaw));yaw=fieldPose.yaw+Math.max(-.35,Math.min(.35,delta))+(Math.random()-.5)*.24;
 let y=near?Math.max(1,Math.min(3.2,near.y+(Math.random()-.5)*.7)):1.8;
 let x=fieldPose.x+Math.sin(yaw)*distance,z=fieldPose.z-Math.cos(yaw)*distance;
 if(fieldFriendly){
  if(Math.abs(fieldHeight-y)>2)y=fieldHeight+.1;
  if(!fieldPracticeTargetClear(x,y,z)){
   let placement=null;
   // Try progressively shorter, nearby sightlines before opening the search around a tight corner.
   for(let pass=0;pass<3&&!placement;pass++)for(const range of [8,6,4,2,1.1]){
    const arc=pass===0?.45:pass===1?1.4:Math.PI;
    for(const sign of [0,1,-1,2,-2,3,-3,4,-4]){const angle=yaw+sign*arc/4,tx=fieldPose.x+Math.sin(angle)*range,tz=fieldPose.z-Math.cos(angle)*range,ty=pass<2?y:Math.max(.7,fieldHeight-fieldCrouchOffset+.1);if(fieldPracticeTargetClear(tx,ty,tz)){placement={x:tx,y:ty,z:tz,yaw:angle};break;}}
    if(placement)break;
   }
   if(!placement){fieldTarget=null;fieldSpawnDelay=.25;return;}
   ({x,y,z,yaw}=placement);
  }
 }
 fieldTarget={x,y,z,baseX:x,baseY:y,baseZ:z,yaw,radius:.42,moving:fieldWaveHits%2===1,phase:0};
}
function hitFieldTarget(b){if(!fieldTarget)return;recordFieldHit(b);if(fieldRun){fieldRun.targets=(fieldRun.targets||0)+1;fieldRun.wave=fieldWave;queueFieldRunSave();}fieldLastTarget={...fieldTarget};fieldTarget=null;fieldWaveHits++;playFieldPistolSound(fieldTargetHitAudio);if(fieldWaveHits>=10){if(fieldRun)fieldRun.completedWaves=fieldWave;playFieldPistolSound(fieldWaveAudio);fieldSpawnDelay=1.4;}else fieldSpawnDelay=.18;fieldPracticeHUD();}
function fieldBulletHitsTarget(b,dt){
 const t=fieldTarget;if(!fieldPractice||!t)return false;
 const dx=b.vx*dt,dy=b.vy*dt,dz=b.vz*dt,l=dx*dx+dy*dy+dz*dz;
 const u=l?Math.max(0,Math.min(1,((t.x-b.x)*dx+(t.y-b.y)*dy+(t.z-b.z)*dz)/l)):0;
 if(fieldFriendly){const targetTime=fieldWaterTargetDistance(b,t);if(targetTime===null||targetTime>dt)return false;const wall=fieldWorldHit(b,targetTime);if(wall!==null&&wall<.99999)return false;}
 return Math.hypot(b.x+dx*u-t.x,b.y+dy*u-t.y,b.z+dz*u-t.z)<=t.radius;
}

// Normal pistol: nine shots, then one complete user-supplied reload animation.
const fieldNormalPistolReloadSource='assets/images/fieldnormalpistolreloadsource-3c907b041bae.gif';
const fieldNormalPistolReloadDuration=4.7,fieldNormalPistolFrameDurations=[0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
let fieldNormalPistolAmmo=9,fieldNormalPistolReload=null,fieldNormalPistolFrames=[];
const fieldNormalPistolReloadImage=document.createElement('img');fieldNormalPistolReloadImage.id='fieldNormalPistolReload';fieldNormalPistolReloadImage.hidden=true;fieldNormalPistolReloadImage.alt='Reloading pistol';fieldNormalPistolReloadImage.dataset.weaponType='pistol';fieldNormalPistolReloadImage.dataset.view='idle';fieldNormalPistolReloadImage.dataset.weaponAnchorX='.72';fieldNormalPistolReloadImage.dataset.weaponAnchorY='1';fieldNormalPistolReloadImage.style.cssText='--weapon-size:85%;max-width:none';document.getElementById('fieldGunMotion').append(fieldNormalPistolReloadImage);
const fieldNormalPistolAmmoHUD=document.createElement('div');fieldNormalPistolAmmoHUD.id='fieldNormalPistolAmmoHUD';fieldNormalPistolAmmoHUD.hidden=true;fieldNormalPistolAmmoHUD.style.cssText='position:absolute;right:20px;bottom:24px;z-index:12;color:white;background:none;border:0;padding:0;pointer-events:none;text-align:right;font:bold 20px monospace;text-shadow:0 2px 3px #001525';fieldRoot.append(fieldNormalPistolAmmoHUD);
function fieldNormalPistolFrameURL(canvas){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),pixels=ctx.getImageData(0,0,canvas.width,canvas.height),a=pixels.data,w=canvas.width,h=canvas.height,queue=new Uint32Array(w*h),seen=new Uint8Array(w*h);let start=0,end=0;
 // This GIF already declares its brown palette entry transparent. Preserve that
 // alpha exactly so similarly colored pixels in the hand are never erased.
 for(let i=3;i<a.length;i+=4)if(a[i]===0)return canvas.toDataURL('image/png');
 const visit=p=>{if(seen[p])return;seen[p]=1;const i=p*4;if(a[i+3]===0||(Math.abs(a[i]-101)<=1&&Math.abs(a[i+1]-73)<=1&&Math.abs(a[i+2]-58)<=1)){a[i+3]=0;queue[end++]=p;}};
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}while(start<end){const p=queue[start++],x=p%w,y=Math.floor(p/w);if(x>0)visit(p-1);if(x<w-1)visit(p+1);if(y>0)visit(p-w);if(y<h-1)visit(p+w);}ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
}
// Portable GIF decoding keeps the original frames, including their disposal and alpha,
// while allowing the animation to freeze exactly with the game's pause state.
function decodeFieldNormalPistolGIF(bytes){
 let cursor=6;const byte=()=>bytes[cursor++],word=()=>byte()|(byte()<<8),palette=n=>Array.from({length:n},()=>[byte(),byte(),byte()]),blocks=()=>{const result=[];for(let n=byte();n;n=byte())for(let i=0;i<n;i++)result.push(byte());return result;};
 const width=word(),height=word(),packed=byte();byte();byte();const globalPalette=packed&128?palette(1<<((packed&7)+1)):null,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true}),rgba=new Uint8ClampedArray(width*height*4),frames=[];let control={disposal:0,transparent:-1},previous=null;
 while(cursor<bytes.length){const marker=byte();if(marker===0x3b)break;if(marker===0x21){const label=byte();if(label===0xf9){byte();const flags=byte();word();const transparent=byte();byte();control={disposal:(flags>>2)&7,transparent:flags&1?transparent:-1};}else blocks();continue;}if(marker!==0x2c)throw new Error('Invalid pistol GIF block');
  const left=word(),top=word(),w=word(),h=word(),flags=byte(),colors=flags&128?palette(1<<((flags&7)+1)):globalPalette,minSize=byte(),data=blocks(),clear=1<<minSize,stop=clear+1;let dictionary=[],size=minSize+1,bit=0,last=null;const decoded=[];
  const reset=()=>{dictionary=Array.from({length:clear},(_,i)=>[i]);dictionary.push(null,null);size=minSize+1;last=null;};reset();
  while(bit+size<=data.length*8){let code=0;for(let i=0;i<size;i++)code|=((data[(bit+i)>>3]>>((bit+i)&7))&1)<<i;bit+=size;if(code===clear){reset();continue;}if(code===stop)break;const entry=dictionary[code]||(code===dictionary.length&&last?last.concat(last[0]):null);if(!entry)throw new Error('Invalid pistol GIF code');for(const value of entry)decoded.push(value);if(last&&dictionary.length<4096){dictionary.push(last.concat(entry[0]));if(dictionary.length===(1<<size)&&size<12)size++;}last=entry;if(decoded.length>=w*h)break;}
  if(previous?.disposal===2)for(let y=previous.top;y<previous.top+previous.h;y++)for(let x=previous.left;x<previous.left+previous.w;x++)rgba.fill(0,(y*width+x)*4,(y*width+x)*4+4);else if(previous?.disposal===3)rgba.set(previous.saved);
  const saved=control.disposal===3?rgba.slice():null,rows=[];if(flags&64){for(const [start,step] of [[0,8],[4,8],[2,4],[1,2]])for(let y=start;y<h;y+=step)rows.push(y);}else for(let y=0;y<h;y++)rows.push(y);
  for(let row=0;row<h;row++)for(let x=0;x<w;x++){const index=decoded[row*w+x];if(index===control.transparent)continue;const color=colors[index];if(!color)continue;const offset=((top+rows[row])*width+left+x)*4;rgba[offset]=color[0];rgba[offset+1]=color[1];rgba[offset+2]=color[2];rgba[offset+3]=255;}
  ctx.putImageData(new ImageData(rgba.slice(),width,height),0,0);frames.push(fieldNormalPistolFrameURL(canvas));previous={...control,left,top,w,h,saved};control={disposal:0,transparent:-1};
 }
 return frames;
}
const fieldNormalPistolFramesReady=PlatdoAssets.arrayBuffer(fieldNormalPistolReloadSource).then(buffer=>{const bytes=new Uint8Array(buffer);fieldNormalPistolFrames=decodeFieldNormalPistolGIF(bytes);if(fieldNormalPistolFrames.length!==fieldNormalPistolFrameDurations.length)throw new Error('Pistol reload frame count mismatch');fieldNormalPistolReloadImage.src=fieldNormalPistolFrames[0];return fieldNormalPistolFrames;}).catch(error=>{console.error('Pistol reload could not be decoded',error);fieldNormalPistolReloadImage.src=fieldNormalPistolReloadSource;return [];});
function fieldHasNormalPistolMagazine(){return fieldMode==='normal'&&!fieldFriendly&&fieldEquipped==='pistol';}

const fieldNormalPistolBulletSource='assets/images/fieldnormalpistolbulletsource-10fce1801c0f.jpg';
const fieldNormalPistolAmmoStyle=document.createElement('style');fieldNormalPistolAmmoStyle.textContent=`
#fieldNormalPistolAmmoHUD{width:214px;max-width:calc(100% - 40px);box-sizing:border-box}
.field-pistol-bullets{display:flex;justify-content:flex-end;gap:2px;height:48px}
.field-pistol-bullet{position:relative;flex:0 1 22px;height:48px;overflow:hidden}
.field-pistol-bullet img{position:absolute;left:50%;top:0;transform:translateX(-50%);width:53px;height:48px;max-width:none;object-fit:contain;filter:url(#fieldWhiteKey)}
.field-pistol-bullet img[data-loaded="false"]{filter:url(#fieldWhiteKey) grayscale(1) brightness(1.6);opacity:.55}
.field-pistol-ammo-label{margin-top:6px;font:bold 12px/16px monospace;white-space:nowrap}
@media(max-width:1050px){
 #fieldGame.field-normal-pistol-hud #fieldCombatHUD{left:16px!important;bottom:16px!important;width:min(260px,calc(100% - 32px))}
 #fieldGame.field-normal-pistol-hud #fieldInventory{bottom:76px!important;max-width:calc(100% - 32px)!important;width:max-content}
 #fieldGame.field-normal-pistol-hud #fieldInventorySlots{gap:6px;justify-content:center}
 #fieldGame.field-normal-pistol-hud #fieldInventorySlots button{min-width:0;min-height:36px;padding:8px 9px!important;font-size:12px;line-height:16px;white-space:nowrap}
 #fieldNormalPistolAmmoHUD{right:16px!important;bottom:148px!important;max-width:calc(100% - 32px)}
}
`;document.head.append(fieldNormalPistolAmmoStyle);
function renderFieldNormalPistolAmmo(){
 const hud=fieldNormalPistolAmmoHUD,visible=fieldHasNormalPistolMagazine()&&(fieldActive||fieldPaused);hud.hidden=!visible;fieldRoot.classList.toggle('field-normal-pistol-hud',visible);if(!visible)return;
 const count=Math.max(0,Math.min(9,fieldNormalPistolAmmo)),reloading=!!fieldNormalPistolReload,key=count+':'+reloading;if(hud.dataset.state===key)return;hud.dataset.state=key;
 if(!hud.querySelector('.field-pistol-bullets')){const row=document.createElement('div');row.className='field-pistol-bullets';for(let i=0;i<9;i++){const slot=document.createElement('span');slot.className='field-pistol-bullet';const icon=document.createElement('img');icon.src=fieldNormalPistolBulletSource;icon.alt='';icon.setAttribute('aria-hidden','true');slot.append(icon);row.append(slot);}const label=document.createElement('div');label.className='field-pistol-ammo-label';hud.replaceChildren(row,label);}
 hud.querySelectorAll('img').forEach((icon,i)=>icon.dataset.loaded=String(i<count));hud.querySelector('.field-pistol-ammo-label').textContent=count+' / 9'+(reloading?' · RELOADING':'');hud.setAttribute('aria-label','Pistol ammunition: '+count+' of 9'+(reloading?', reloading':''));
}

function cancelFieldNormalPistolReload(){fieldNormalPistolReload=null;fieldNormalPistolReloadImage.hidden=true;renderFieldNormalPistolAmmo();}
function resetFieldNormalPistolAmmo(){fieldNormalPistolAmmo=9;cancelFieldNormalPistolReload();}
function beginFieldNormalPistolReload(){if(!fieldActive||fieldPaused||!fieldHasNormalPistolMagazine()||fieldNormalPistolReload||fieldNormalPistolAmmo>=9)return false;fieldNormalPistolReload={elapsed:0,frame:-1};fieldAimToggled=false;updateFieldNormalPistolVisual();return true;}
function takeFieldNormalPistolShot(){if(!fieldHasNormalPistolMagazine())return true;if(fieldNormalPistolReload)return false;if(fieldNormalPistolAmmo<=0){beginFieldNormalPistolReload();return false;}fieldNormalPistolAmmo--;if(fieldNormalPistolAmmo===0)beginFieldNormalPistolReload();renderFieldNormalPistolAmmo();return true;}
function updateFieldNormalPistolReload(dt){if(fieldNormalPistolReload&&!fieldHasNormalPistolMagazine())cancelFieldNormalPistolReload();if(fieldNormalPistolReload&&fieldActive&&!fieldPaused){fieldNormalPistolReload.elapsed=Math.min(fieldNormalPistolReloadDuration,fieldNormalPistolReload.elapsed+dt);if(fieldNormalPistolReload.elapsed>=fieldNormalPistolReloadDuration-1e-8){fieldNormalPistolAmmo=9;cancelFieldNormalPistolReload();}}updateFieldNormalPistolVisual();}
function updateFieldNormalPistolVisual(){
 const visible=(fieldActive||fieldPaused)&&!fieldFriendly&&!fieldIsRetroMode()&&fieldEquipped==='pistol',reloading=visible&&!!fieldNormalPistolReload;fieldNormalPistolReloadImage.hidden=!reloading;
 if(reloading){let elapsed=fieldNormalPistolReload.elapsed,index=0;while(index<fieldNormalPistolFrameDurations.length-1&&elapsed+1e-8>=fieldNormalPistolFrameDurations[index])elapsed-=fieldNormalPistolFrameDurations[index++];if(index!==fieldNormalPistolReload.frame&&fieldNormalPistolFrames[index]){fieldNormalPistolReload.frame=index;fieldNormalPistolReloadImage.src=fieldNormalPistolFrames[index];}}
 if(visible){document.getElementById('fieldPistolIdle').hidden=reloading||fieldAiming();document.getElementById('fieldPistolAim').hidden=reloading||!fieldAiming();}renderFieldNormalPistolAmmo();
}

function shootFieldWeapon(){
 if(!fieldActive||fieldShotCooldown>0||!fieldAvailableWeapons().includes(fieldEquipped))return;
 const specs={pistol:{delay:.25,kick:9,recoil:.018,pellets:1},ar:{delay:.1,kick:7,recoil:.012,pellets:1},sniper:{delay:1,kick:17,recoil:.04,pellets:1},shotgun:{delay:.8,kick:21,recoil:.05,pellets:7}};
 if(fieldIsRetroMode()){shootRetroWeapon();return;}
 if(!takeFieldWaterShot())return;if(!takeFieldNormalPistolShot())return;
 const spec=specs[fieldEquipped];if(fieldFriendly&&fieldEquipped==='pistol'){spec.kick=4;spec.recoil=.006;}fieldShotCooldown=spec.delay;fieldShotCount++;fieldFlash=.055;if(!fieldPractice){if(fieldEquipped==='pistol')playFieldPistolSound();else if(fieldEquipped==='sniper')playFieldPistolSound(fieldSniperShotAudio);else if(fieldEquipped==='ar')playFieldPistolSound(fieldARShotAudio);else if(fieldEquipped==='shotgun')playFieldPistolSound(fieldShotgunShotAudio);}
 recordFieldShot(fieldEquipped);
 if(fieldPractice){
  const yaw=fieldPose.yaw,pitch=fieldPose.pitch+fieldRecoil;
  const shot={shotId:fieldShotCount,x:fieldEyeX(),y:fieldHeight-fieldCrouchOffset,z:fieldEyeZ(),vx:Math.sin(yaw)*Math.cos(pitch),vy:Math.sin(pitch),vz:-Math.cos(yaw)*Math.cos(pitch)};
  const targetHit=fieldBulletHitsTarget(shot,1000);fieldWaterPracticeShot(shot,targetHit,fieldTarget);if(targetHit)hitFieldTarget(shot);
  fieldPracticeHUD();
 }else for(let i=0;i<spec.pellets;i++){
  const spread=spec.pellets>1?.045:0,yaw=fieldPose.yaw+(Math.random()-.5)*spread,pitch=fieldPose.pitch+fieldRecoil+(Math.random()-.5)*spread;
  fieldProjectiles.push({shotId:fieldShotCount,weapon:fieldEquipped,x:fieldEyeX(),y:fieldHeight-fieldCrouchOffset-.08,z:fieldEyeZ(),vx:Math.sin(yaw)*Math.cos(pitch)*100,vy:Math.sin(pitch)*100,vz:-Math.cos(yaw)*Math.cos(pitch)*100,life:2});
 }
 fieldRecoil=Math.min(.12,fieldRecoil+spec.recoil);fieldGunKick=Math.min(32,fieldGunKick+spec.kick);
}
const fieldDamageLabels=[];
function addFieldDamage(enemy,amount,zone){
 let label=fieldDamageLabels.find(item=>item.enemy===enemy&&!item.broken&&item.quiet<.35);
 if(!label){label={enemy,total:0,quiet:0,broken:false,age:0,x:enemy.x,y:2.15,z:enemy.z};fieldDamageLabels.push(label);}
 label.total+=amount;label.quiet=0;label.head=zone==='head';label.x=enemy.x;label.z=enemy.z;
}
function updateFieldDamage(dt){for(let i=fieldDamageLabels.length-1;i>=0;i--){const label=fieldDamageLabels[i];label.quiet+=dt;if(!label.broken){if(label.enemy===fieldEnemy||fieldNormalEnemies.includes(label.enemy)){label.x=label.enemy.x;label.z=label.enemy.z;}if(label.quiet>=.35){label.broken=true;label.age=0;label.digits=String(label.total).split('').map((digit,index,array)=>({digit,offset:(index-(array.length-1)/2)*22,vx:(index-(array.length-1)/2)*45+(index%2?10:-10),vy:-55-index*14,spin:(index%2?1:-1)*.65}));}}else{label.age+=dt;if(label.age>1.15)fieldDamageLabels.splice(i,1);}}}
function drawFieldDamage(ctx,width,height,f,r,u,eye){ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 34px Arial';ctx.lineWidth=4;ctx.strokeStyle='#211e23';for(const label of fieldDamageLabels){const d=[label.x-fieldEyeX(),label.y-eye,label.z-fieldEyeZ()],depth=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(depth<.1)continue;const scale=height*fieldAimZoom()/(1.4*depth),x=width/2+(d[0]*r[0]+d[2]*r[2]) *scale+38,y=height/2-(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])*scale;ctx.fillStyle=label.head?'#ffdf62':'#ffffff';if(!label.broken){ctx.globalAlpha=1;const bump=1+Math.max(0,1-label.quiet/.16)*.18;ctx.save();ctx.translate(x,y);ctx.scale(bump,bump);ctx.strokeText(String(label.total),0,0);ctx.fillText(String(label.total),0,0);ctx.restore();}else{const t=label.age;ctx.globalAlpha=Math.max(0,1-t/1.15);for(const digit of label.digits){ctx.save();ctx.translate(x+digit.offset+digit.vx*t,y+digit.vy*t+160*t*t);ctx.rotate(digit.spin*t);ctx.strokeText(digit.digit,0,0);ctx.fillText(digit.digit,0,0);ctx.restore();}}}ctx.restore();}
function drawFieldShots(){
 const canvas=document.getElementById('fieldShotCanvas'),width=fieldCanvas.clientWidth,height=fieldCanvas.clientHeight;
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const ctx=canvas.getContext('2d');ctx.clearRect(0,0,width,height);if(!fieldActive)return;
 const yaw=fieldPose.yaw,pitch=fieldPose.pitch+fieldRecoil,eye=fieldHeight-fieldCrouchOffset;
 const f=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],r=[Math.cos(yaw),0,Math.sin(yaw)],u=[-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)];
 const originalR=[...r],cosLean=Math.cos(fieldLean*.14),sinLean=Math.sin(fieldLean*.14);for(let i=0;i<3;i++){r[i]=originalR[i]*cosLean+u[i]*sinLean;u[i]=u[i]*cosLean-originalR[i]*sinLean;}
 for(const b of [...fieldProjectiles,...fieldEnemyShots]){if(fieldFriendly)continue;const d=[b.x-fieldEyeX(),b.y-eye,b.z-fieldEyeZ()],depth=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(depth<.1)continue;const scale=height*fieldAimZoom()/(1.4*depth),x=width/2+(d[0]*r[0]+d[2]*r[2])*scale,y=height/2-(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])*scale;if(b.enemy&&fieldIsRetroMode()&&fieldRetroLaserImage.complete){const size=Math.max(18,Math.min(200,scale*1.1));ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(fieldRetroLaserImage,x-size/2,y-size/2,size,size);ctx.restore();continue;}ctx.fillStyle=b.enemy?'#ff563d':'#fff2ad';ctx.beginPath();ctx.arc(x,y,Math.max(1,Math.min(3,20/depth)),0,Math.PI*2);ctx.fill();}
 drawFieldWater(ctx,width,height,f,r,u,eye);drawFieldDamage(ctx,width,height,f,r,u,eye);drawRetroEffects(ctx,width,height,f,r,u,eye);
 const flash=document.getElementById('fieldMuzzleFlash');flash.hidden=godCorePowerActive()||!!fieldNormalPistolReload||fieldFriendly||(fieldIsRetroMode()&&fieldEquipped==='pistol')||fieldFlash<=0||fieldAiming()||fieldEquipped==='grenade'||fieldEquipped==='rocket';
 if(!flash.hidden){const ids={pistol:'fieldPistolIdle',ar:'fieldARIdle',sniper:'fieldSniperIdle',shotgun:'fieldShotgunIdle'},anchors={pistol:[.17,.035],ar:[.42,.11],sniper:[.33,.49],shotgun:[.42,.57]};const rect=document.getElementById(fieldIsRetroMode()&&fieldEquipped==='shotgun'?'fieldRetroShotgunReady':fieldIsRetroMode()&&fieldEquipped==='ar'?'fieldRetroARIdle':ids[fieldEquipped]).getBoundingClientRect(),root=fieldRoot.getBoundingClientRect(),anchor=fieldIsRetroMode()&&fieldEquipped==='ar'?[.655,.625]:anchors[fieldEquipped];const size=fieldEquipped==='shotgun'?280:220;flash.style.width=size+'px';flash.style.left=(rect.left-root.left+rect.width*anchor[0]-size*.54)+'px';flash.style.top=(rect.top-root.top+rect.height*anchor[1]-size*(335/597)*.46)+'px';}

}
function fieldGrounded(){if(fieldIsGodCore())return fieldVelocity<=0&&Math.abs(fieldHeight-1.7-godCorePlayerSupportHeight(fieldPose.x,fieldPose.z,fieldHeight-1.7,.035))<.04;return fieldHeight<=1.701||fieldWorldBoxes().some(b=>Math.abs(fieldHeight-1.7-b.c[1]-b.h[1])<.025&&Math.abs(fieldPose.x-b.c[0])<b.h[0]+.25&&Math.abs(fieldPose.z-b.c[2])<b.h[2]+.25);}
function fieldCrouching(){return fieldActive&&fieldGrounded()&&(window.Platdo?.controls?.isMobile?fieldAction('crouch'):fieldCrouchMode==='toggle'?fieldCrouchToggled:fieldAction('crouch'));}
function fieldAimZoom(){return fieldAiming()?({sniper:4,ar:1.6,pistol:1.1,shotgun:1.1}[fieldEquipped]):1;}
function fieldCanAimWeapon(){if(godCorePowerActive())return false;return !(fieldIsRetroMode()&&fieldEquipped==='ar')&&!(fieldHasNormalPistolMagazine()&&fieldNormalPistolReload)&&!(fieldFriendly&&!fieldIsRetroMode()&&fieldEquipped==='pistol')&&fieldEquipped!=='grenade'&&fieldEquipped!=='rocket'&&(fieldEquipped!=='shotgun'||(fieldIsRetroMode()&&!fieldRetroReloading));}
function fieldAiming(){return fieldActive&&fieldCanAimWeapon()&&(window.Platdo?.controls?.isMobile?fieldAction('aim'):fieldAimMode==='toggle'?fieldAimToggled:fieldAction('aim'));}
// Keep the visible hand/weapon attachment below the viewport.
// Analyze pixels once per image source, never per animation frame. Animated art may
// provide data-weapon-anchor-x/y for an attachment point shared by all its frames.
const fieldWeaponFitCache=new WeakMap();
function fieldWeaponNumber(value,fallback){const n=parseFloat(value);return Number.isFinite(n)?n:fallback;}
function fieldWeaponSight(image,style){const inline=image.style.transform.match(/translate\(\s*(-?[\d.]+)%\s*,\s*(-?[\d.]+)%\s*\)/);return{x:fieldWeaponNumber(style.getPropertyValue('--sight-x'),inline?-Number(inline[1])/100:.5),y:fieldWeaponNumber(style.getPropertyValue('--sight-y'),inline?-Number(inline[2])/100:.2)};}
function fieldWeaponAttachment(image,style,sight){
 let cached=fieldWeaponFitCache.get(image);const source=image.currentSrc||image.src,key=image.dataset.backgroundKey||style.filter;
 if(cached?.source===source&&cached.key===key)return cached;
 if(!image.complete||!image.naturalWidth||!image.naturalHeight)return null;
 let anchorX=.5,anchorY=1;
 try{
  const canvas=document.createElement('canvas'),scale=Math.min(1,320/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,profile=new Float32Array(canvas.width);let left=canvas.width,right=-1,bottom=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4,r=rgba[i],g=rgba[i+1],b=rgba[i+2];let alpha=rgba[i+3];if(/white/i.test(key))alpha*=Math.max(0,Math.min(1,(3-(r+g+b)/255)*20));if(/checker/i.test(key)&&Math.min(r,g,b)>226&&Math.max(r,g,b)-Math.min(r,g,b)<15)alpha=0;if(/grenade|gray|grey/i.test(key))alpha*=Math.max(0,Math.min(1,(2.4-(r+g+b)/255)*20));if(/green/i.test(key)&&g>100&&g>r*1.25&&g>b*1.25)alpha=0;if(/magenta/i.test(key)&&r>110&&b>110&&g<Math.min(r,b)*.7)alpha=0;if(/yellow/i.test(key)&&r>150&&g>150&&b<Math.min(r,g)*.65)alpha=0;if(alpha<45)continue;left=Math.min(left,x);right=Math.max(right,x);bottom=Math.max(bottom,(y+1)/canvas.height);profile[x]=(y+1)/canvas.height;}
  if(right>=left){anchorX=image.dataset.view==='aim'?sight.x:(left+right+1)/(canvas.width*2);const lo=image.dataset.view==='aim'?Math.floor((anchorX-.06)*canvas.width):Math.floor(left+(right-left)*.25),hi=image.dataset.view==='aim'?Math.ceil((anchorX+.06)*canvas.width):Math.ceil(left+(right-left)*.75),values=[];for(let x=Math.max(0,lo);x<=Math.min(canvas.width-1,hi);x++)if(profile[x]>0)values.push(profile[x]);values.sort((a,b)=>a-b);anchorY=values.length?values[Math.floor(values.length/2)]:bottom;}
 }catch(_){/* Cross-origin future art still receives a safe default attachment. */}
 anchorX=Math.max(0,Math.min(1,fieldWeaponNumber(image.dataset.weaponAnchorX,anchorX)));anchorY=Math.max(.1,Math.min(1,fieldWeaponNumber(image.dataset.weaponAnchorY,anchorY)));
 cached={source,key,anchorX,anchorY,maxWidth:cached?.maxWidth||style.maxWidth,sight,layoutKey:''};fieldWeaponFitCache.set(image,cached);return cached;
}
function fitFieldWeaponView(){
 const motion=document.getElementById('fieldGunMotion'),width=fieldRoot.clientWidth,height=fieldRoot.clientHeight;if(!width||!height)return;
 for(const image of motion.querySelectorAll('img[data-weapon-type]')){
  if(image.hidden)continue;const style=getComputedStyle(image),sight=fieldWeaponSight(image,style),fit=fieldWeaponAttachment(image,style,sight);if(!fit)continue;
  const aiming=image.dataset.view==='aim',size=style.getPropertyValue('--weapon-size').trim()||'55%',baseHeight=size.endsWith('%')?height*fieldWeaponNumber(size,55)/100:fieldWeaponNumber(size,height*.55),aspect=image.naturalWidth/image.naturalHeight,bleed=Math.max(44,height*.025)+Math.min(width,baseHeight*aspect)*.07,layoutKey=[width,height,size,aiming,fit.anchorX,fit.anchorY,sight.x,sight.y].join(':');
  if(fit.layoutKey!==layoutKey){
   let drawHeight=baseHeight;
   if(aiming){drawHeight=Math.max(drawHeight,(height*.5+bleed)/Math.max(.15,fit.anchorY-sight.y));image.style.setProperty('max-width','none','important');image.style.setProperty('left','50%','important');image.style.setProperty('top','50%','important');image.style.setProperty('right','auto','important');image.style.setProperty('bottom','auto','important');image.style.transform='translate('+(-sight.x*100)+'%,'+(-sight.y*100)+'%)';}
   else{const cap=fit.maxWidth==='none'?Infinity:fit.maxWidth.endsWith('%')?width*fieldWeaponNumber(fit.maxWidth,85)/100:fieldWeaponNumber(fit.maxWidth,Infinity);const contentWidth=Math.max(.05,Math.min(1,fieldWeaponNumber(image.dataset.weaponContentWidth,1)));drawHeight=Math.min(drawHeight,cap/(aspect*contentWidth));if(contentWidth<1)image.style.setProperty('max-width','none','important');image.style.setProperty('bottom',(-bleed-(1-fit.anchorY)*drawHeight)+'px','important');}
   image.style.setProperty('--weapon-fit-height',drawHeight+'px');image.style.width=(drawHeight*aspect)+'px';fit.drawHeight=drawHeight;fit.drawWidth=drawHeight*aspect;fit.layoutKey=layoutKey;
  }
  if(aiming){motion.style.transformOrigin='50% 50%';fit.attachment={x:width*.5+(fit.anchorX-sight.x)*fit.drawWidth,y:height*.5+(fit.anchorY-sight.y)*fit.drawHeight};}
  else{const transform=new DOMMatrix(getComputedStyle(image).transform),x=image.offsetLeft+fit.anchorX*fit.drawWidth+transform.e,y=height+bleed;motion.style.transformOrigin=x+'px '+y+'px';fit.attachment={x,y};}
 }
}
function drawField(){renderGodCorePower();syncFieldHUDStyle();renderFieldFriendlyAmmo();fieldRetroShotgunAimImage.hidden=!(fieldIsRetroMode()&&fieldEquipped==='shotgun'&&fieldAiming());renderRetroShells();fieldGrenadeImage.hidden=!fieldActive||!fieldIsRetroMode()||fieldEquipped!=='grenade';if(!initFieldRenderer())return;fieldGL.uniform1f(fieldUniforms.sceneTime,performance.now()/1000);fieldGL.uniform1i(fieldUniforms.godCoreArena,fieldIsGodCore()?1:0);fieldGL.uniform1f(fieldUniforms.godCorePower,fieldIsGodCore()?godCoreArenaPower():0);const q=fieldGraphicsValues();legacyRenderStats.fieldFrames++;fieldGL.uniform1i(fieldUniforms.visualDetail,{low:0,medium:1,high:2}[q.detail]??2);fieldGL.uniform1i(fieldUniforms.lightingQuality,{low:0,medium:1,high:2}[q.lighting]??2);fieldGL.uniform1f(fieldUniforms.detailDistance,q.distance||80);const boxes=fieldVisibleWorld(),centers=fieldUniformBuffers.centers,sizes=fieldUniformBuffers.sizes;boxes.forEach((b,i)=>{centers.set(b.c,i*3);sizes.set(b.h,i*4);sizes[i*4+3]=b.kind;});fieldGL.uniform3fv(fieldUniforms.worldCenters,centers);fieldGL.uniform4fv(fieldUniforms.worldSizes,sizes);fieldGL.uniform1i(fieldUniforms.worldCount,boxes.length);const scoped=fieldAiming()&&fieldEquipped==='sniper';const retroShotgun=fieldActive&&fieldIsRetroMode()&&fieldEquipped==='shotgun';document.getElementById('fieldRetroShotgunReady').hidden=!retroShotgun||fieldRetroReloading||fieldAiming();document.getElementById('fieldRetroShotgunReload').hidden=!retroShotgun||!fieldRetroReloading;document.getElementById('fieldShotgunIdle').hidden=!fieldActive||fieldEquipped!=='shotgun'||fieldAiming()||retroShotgun;document.getElementById('fieldSniperIdle').hidden=!fieldActive||fieldEquipped!=='sniper'||scoped;document.getElementById('fieldARIdle').hidden=!fieldActive||fieldEquipped!=='ar'||fieldAiming();document.getElementById('fieldARAim').hidden=!fieldActive||fieldEquipped!=='ar'||!fieldAiming();document.getElementById('fieldPistolIdle').hidden=!fieldActive||fieldEquipped!=='pistol'||fieldAiming();document.getElementById('fieldPistolAim').hidden=!fieldActive||fieldEquipped!=='pistol'||!fieldAiming();updateFieldFriendlyWeapons();updateFieldRetroPistol();updateFieldRetroAR();updateFieldNormalPistolVisual();fieldRetroRocketImage.hidden=!fieldActive||!fieldIsRetroMode()||fieldEquipped!=='rocket';fitFieldWeaponView();const scope=document.getElementById('fieldScope');scope.hidden=!scoped;scope.style.display=scoped?'flex':'none';document.getElementById('fieldCrosshair').hidden=!fieldActive||scoped||(fieldIsRetroMode()&&fieldEquipped==='shotgun'&&fieldAiming());fieldGL.uniform1f(fieldUniforms.lean,fieldLean*.14);fieldGL.uniform1f(fieldUniforms.zoom,fieldAimZoom());const {width,height}=fieldGraphicsProfile()?.renderSize(fieldCanvas.clientWidth,fieldCanvas.clientHeight)||Platdo.renderSize(fieldCanvas.clientWidth,fieldCanvas.clientHeight);if(!width||!height)return;if(fieldCanvas.width!==width||fieldCanvas.height!==height){fieldCanvas.width=width;fieldCanvas.height=height;}const target=fieldActive&&fieldPractice?fieldTarget:null;fieldGL.uniform4f(fieldUniforms.targetBall,target?.x||0,target?.y||0,target?.z||0,target?.radius||0);const actorPoses=fieldUniformBuffers.actors,actorMotions=fieldUniformBuffers.motions;let visibleActors=[];
if(fieldActive&&fieldMode==='normal'){
 const live=typeof fieldNormalEnemies!=='undefined'?fieldNormalEnemies:(fieldEnemy?[fieldEnemy]:[]),dying=typeof fieldNormalDyingEnemies!=='undefined'?fieldNormalDyingEnemies:(fieldDyingEnemy?[fieldDyingEnemy]:[]);
 visibleActors=[...live.slice(0,8).map(enemy=>({enemy,dying:false})),...dying.slice(0,4).map(enemy=>({enemy,dying:true}))];
}else if(fieldActive&&fieldMode==='tutorial'){
 const enemy=fieldEnemy||fieldDyingEnemy;if(enemy)visibleActors=[{enemy,dying:enemy===fieldDyingEnemy}];
}
visibleActors.forEach(({enemy,dying},i)=>{actorPoses.set([enemy.x,enemy.z,enemy.yaw||0,dying?Math.min(1,(enemy.deathAge||0)/(enemy.deathDuration||.9)):0],i*4);actorMotions.set([Math.max(0,(enemy.shotFlash||0)/.18),enemy.stride||0],i*2);});
fieldGL.uniform4fv(fieldUniforms.enemyPoses,actorPoses);fieldGL.uniform2fv(fieldUniforms.enemyMotions,actorMotions);fieldGL.uniform1i(fieldUniforms.enemyCount,visibleActors.length);const retroData=fieldUniformBuffers.retro,retroVisible=fieldActive&&fieldIsRetroMode()?fieldRetroEnemies:[];retroVisible.forEach((e,i)=>{retroData[i*4]=e.x;retroData[i*4+1]=e.z;retroData[i*4+2]=e.yaw;retroData[i*4+3]=fieldIsGodCore()?(e.y||0):0;});fieldGL.uniform4fv(fieldUniforms.retroEnemies,retroData);fieldGL.uniform1i(fieldUniforms.retroEnemyCount,retroVisible.length);fieldGL.uniform1i(fieldUniforms.retroMode,fieldIsRetroMode()?1:0);fieldGL.uniform1i(fieldUniforms.friendlyEnemy,fieldFriendly?1:0);const hitData=fieldUniformBuffers.hits;const visibleHits=fieldActive&&!fieldFriendly&&q.decals!==false?fieldImpacts.filter(hit=>Math.hypot(hit.x-fieldEyeX(),hit.z-fieldEyeZ())<=q.distance+2):[];visibleHits.forEach((hit,i)=>{hitData[i*2]=hit.x;hitData[i*2+1]=hit.z;});fieldGL.uniform1i(fieldUniforms.impactCount,visibleHits.length);fieldGL.uniform2fv(fieldUniforms.impactPositions,hitData);fieldGL.uniform1i(fieldUniforms.mapId,fieldFriendly&&!fieldIsRetroMode()?5:fieldMaps[fieldActive?fieldSelectedMap:(fieldPreviewMap||fieldSelectedMap)].index);fieldGL.viewport(0,0,width,height);fieldGL.uniform2f(fieldUniforms.resolution,width,height);fieldGL.uniform3f(fieldUniforms.eye,fieldActive?fieldEyeX():0,fieldActive?fieldHeight-fieldCrouchOffset:fieldFriendly?3.2:1.7,fieldActive?fieldEyeZ():fieldFriendly?9:fieldIsRetroMode()?fieldRetroMaps[currentRetroMap()].spawn[1]:0);fieldGL.uniform2f(fieldUniforms.look,fieldActive?fieldPose.yaw:0,fieldActive?fieldPose.pitch+fieldRecoil:-.12);fieldGL.drawArrays(fieldGL.TRIANGLES,0,6);drawFieldShots();}
function fieldSprinting(){return fieldActive&&(window.Platdo?.controls?.isMobile?fieldAction('sprint'):fieldSprintMode==='toggle'?fieldSprintToggled:fieldAction('sprint'));}
function fieldAction(action){return window.Platdo?.controls?.isMobile?fieldMobileActions.has(action):fieldBindings[action].some(code=>fieldKeys.has(code));}
function updateField(dt){updateGodCorePower(dt);updateFieldNormalPistolReload(dt);updateFieldFriendlyRefill(dt);updateFieldFriendlyTowel(dt);if(!fieldActive)return;updateFieldWaterEffects(dt);updateFieldDoors(dt);
 updateFieldDamage(dt);
 if(fieldRun){resumeFieldRunClock();updateFieldRunRecorder();}
 updateFieldCombat(dt);if(!fieldActive)return;
 if(fieldPractice){fieldPracticeTime+=dt;if(fieldTarget?.moving){fieldTarget.phase+=dt*Math.min(2.5,.8+fieldWave*.12);const offset=Math.sin(fieldTarget.phase)*.75;const targetX=fieldTarget.baseX+Math.cos(fieldTarget.yaw)*offset,targetZ=fieldTarget.baseZ+Math.sin(fieldTarget.yaw)*offset;if(!fieldFriendly||fieldPracticeTargetClear(targetX,fieldTarget.y,targetZ,fieldTarget.radius)){fieldTarget.x=targetX;fieldTarget.z=targetZ;}}else if(!fieldTarget){fieldSpawnDelay-=dt;if(fieldSpawnDelay<=0){if(fieldWaveHits>=10){fieldWave++;fieldWaveHits=0;if(fieldRun){fieldRun.wave=fieldWave;queueFieldRunSave();}}spawnFieldTarget();fieldPracticeHUD();}}}
 const fieldWasAirborne=!fieldGrounded();
 const leanTarget=Number(fieldAction('leanLeft'))-Number(fieldAction('leanRight'));fieldLean=fieldIsRetroMode()?leanTarget:fieldLean+(leanTarget-fieldLean)*(1-Math.exp(-dt*12));if(fieldIsRetroMode())fieldCrouchOffset=fieldCrouching()?.65:0;else fieldCrouchOffset+=((fieldCrouching()?.65:0)-fieldCrouchOffset)*(1-Math.exp(-dt*12));
 fieldShotCooldown=Math.max(0,fieldShotCooldown-dt);fieldRecoil*=Math.exp(-dt*7);fieldGunKick*=Math.exp(-dt*11);fieldFlash=Math.max(0,fieldFlash-dt);
 if((fieldEquipped==='ar'||godCorePowerActive())&&fieldAction('fire'))shootFieldWeapon();
 for(let i=fieldProjectiles.length-1;i>=0;i--){
  const b=fieldProjectiles[i],wallHit=fieldWorldHit(b,dt),groundHit=b.vy<0&&b.y+b.vy*dt<=0?-b.y/(b.vy*dt):null;
  const surfaceHit=wallHit===null?groundHit:groundHit===null?wallHit:Math.min(wallHit,groundHit),travel=surfaceHit===null?dt:dt*Math.max(0,surfaceHit-.0001);
  if(fieldBulletHitsEnemy(b,travel)){addFieldWaterSegment(b,b.fieldImpact,true);fieldProjectiles.splice(i,1);continue;}
  if(surfaceHit!==null){hitGodCoreRelay(b,dt);fieldWaterTravel(b,dt*surfaceHit,true);if(!fieldFriendly&&groundHit!==null&&(wallHit===null||groundHit<=wallHit)){fieldImpacts.push({x:b.x+b.vx*dt*groundHit,z:b.z+b.vz*dt*groundHit,life:45});if(fieldImpacts.length>24)fieldImpacts.shift();}fieldProjectiles.splice(i,1);continue;}
  if(fieldBulletHitsTarget(b,dt)){const targetTime=fieldWaterTargetDistance(b,fieldTarget);fieldWaterTravel(b,targetTime===null?dt:Math.min(dt,targetTime),true);hitFieldTarget(b);fieldProjectiles.splice(i,1);continue;}
  fieldWaterTravel(b,dt);b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.life-=dt;if(b.life<=0)fieldProjectiles.splice(i,1);
 }
 for(let i=fieldImpacts.length-1;i>=0;i--){fieldImpacts[i].life-=dt;if(fieldImpacts[i].life<=0)fieldImpacts.splice(i,1);}
 const f=window.Platdo?.controls?.isMobile?fieldMobileMove.y:Number(fieldAction('forward'))-Number(fieldAction('back')),r=window.Platdo?.controls?.isMobile?fieldMobileMove.x:Number(fieldAction('right'))-Number(fieldAction('left'));const length=Math.max(1,Math.hypot(f,r)),speed=(fieldCrouching()?2:fieldSprinting()?8:4)*(fieldAiming()?.5:1);
 const moving=f!==0||r!==0,running=moving&&fieldSprinting()&&!fieldCrouching();
 fieldBobStrength+=((moving?(running?1:.45):0)-fieldBobStrength)*Math.min(1,dt*10);fieldBobPhase+=dt*(fieldCrouching()?4:running?13:8);
 const steady=fieldAiming()?.2:1;const sway=fieldBobStrength*steady;document.getElementById('fieldGunMotion').style.transform='translate('+Math.sin(fieldBobPhase)*18*sway+'px,'+(Math.abs(Math.cos(fieldBobPhase))*12*sway-fieldGunKick)+'px) rotate('+(Math.sin(fieldBobPhase)*2.2*sway-fieldGunKick*.12)+'deg)';
 fieldMoveBody(fieldPose,(Math.sin(fieldPose.yaw)*f+Math.cos(fieldPose.yaw)*r)/length*speed*dt,(-Math.cos(fieldPose.yaw)*f+Math.sin(fieldPose.yaw)*r)/length*speed*dt,fieldHeight-1.7,1.7-fieldCrouchOffset);
 if((!fieldIsRetroMode()||fieldIsGodCore())&&fieldAction('jump')&&fieldGrounded()&&(!fieldIsGodCore()||!godCorePlayerBlocked(fieldPose.x,fieldPose.z,fieldHeight-1.7,1.7,.3))){fieldVelocity=7.5;if(fieldIsGodCore())fieldCrouchOffset=0;}
 const previousFeet=fieldHeight-1.7;fieldVelocity-=14*dt;fieldHeight+=fieldVelocity*dt;
 if(fieldIsGodCore()&&fieldVelocity>0){
  let ceiling=Infinity;
  for(const wall of fieldWorldBoxes()){
   const underside=wall.c[1]-wall.h[1];
   if(underside>=previousFeet+1.7-.001&&fieldHeight>underside-.02&&Math.abs(fieldPose.x-wall.c[0])<wall.h[0]+.3&&Math.abs(fieldPose.z-wall.c[2])<wall.h[2]+.3)ceiling=Math.min(ceiling,underside-.02);
  }
  if(Number.isFinite(ceiling)){fieldHeight=ceiling;fieldVelocity=0;}
 }
 for(const wall of fieldWorldBoxes()){if(fieldIsGodCore()&&wall.kind===29)continue;const top=wall.c[1]+wall.h[1];if(top>.02&&fieldVelocity<0&&previousFeet>=top-.02&&fieldHeight-1.7<top&&Math.abs(fieldPose.x-wall.c[0])<wall.h[0]+.25&&Math.abs(fieldPose.z-wall.c[2])<wall.h[2]+.25){fieldHeight=top+1.7;fieldVelocity=0;if(fieldWasAirborne)playFieldPistolSound(fieldLandAudio);}}if(fieldIsGodCore()&&fieldVelocity<0){const ramp=godCorePlayerStairHeight(fieldPose.x,fieldPose.z);if(ramp!==null&&previousFeet>=ramp-.02&&fieldHeight-1.7<ramp){fieldHeight=ramp+1.7;fieldVelocity=0;if(fieldWasAirborne)playFieldPistolSound(fieldLandAudio);}}if(fieldHeight<1.7){fieldHeight=1.7;fieldVelocity=0;if(fieldWasAirborne){const sound=new Audio(fieldLandAudio);sound.volume=fieldAudioVolume(fieldLandAudio);sound.play().catch(()=>{});}}
 fieldFootsteps.volume=fieldAudioVolume(fieldFootsteps.src)*(godCorePowerActive()?.16:1);if(moving&&fieldGrounded()){fieldFootsteps.playbackRate=Math.max(.25,Math.min(2,speed/4));if(fieldFootsteps.paused)fieldFootsteps.play().catch(()=>{});}else{fieldFootsteps.pause();fieldFootsteps.currentTime=0;}
 if(f||r)queueFieldSave();
}
function fieldLoop(time){if(fieldRoot.hidden){fieldFrame=0;return;}if(document.hidden){fieldLastTime=0;fieldFrame=0;return;}const dt=fieldLastTime?Math.min((time-fieldLastTime)/1000,.05):0;fieldLastTime=time;if(fieldActive)updateField(dt);const interval=fieldActive?1000/Platdo.frameRate:1000/15;if(!fieldPaused&&!godCoreIntroActive&&!godCoreAcquisitionActive&&!godCoreVictoryActive&&time-fieldLastRender>=interval-.1){const started=performance.now();drawField();fieldGraphicsProfile()?.sample(time-fieldLastRender,performance.now()-started,time);fieldLastRender=time;}fieldFrame=requestAnimationFrame(fieldLoop);}
function fieldToMenu(){cancelGodCoreVictory();resetFieldAdmin();cancelGodCoreAcquisition();cancelGodCoreIntro();finishFieldRun();stopGodCorePower();resetGodCoreArena();cancelRetroARReload();fieldRetroARAmmoHUD.hidden=true;fieldRetroRockets.length=0;cancelRetroRocketReload();fieldRetroRocketAmmoHUD.hidden=true;fieldRetroRocketImage.hidden=true;resetNormalWaves();cancelRetroPistolReload();fieldRetroPistolAmmoHUD.hidden=true;cancelFieldNormalPistolReload();fieldNormalPistolAmmoHUD.hidden=true;resetFieldRetroPistolAnimation();for(const image of Object.values(fieldRetroPistolImages))image.hidden=true;for(const image of fieldRetroARImages)image.hidden=true;cancelFieldFriendlyTowel();fieldTowelPrompt.hidden=true;fieldTutorial=null;fieldTutorialHUD.hidden=true;cancelFieldFriendlyRefill();fieldFriendlyAmmoHUD.hidden=true;clearFieldWaterEffects();for(const image of document.querySelectorAll('[data-friendly-weapon]'))image.hidden=true;resetFieldLookInput();fieldDyingEnemy=null;fieldRetroShotgunAimImage.hidden=true;fieldRetroReloadAudio.pause();fieldRetroReloading=false;fieldShellHUD.hidden=true;fieldExplosions.length=0;fieldGrenadeImage.hidden=true;fieldShotCooldown=0;document.getElementById("fieldRetroHUD").hidden=true;fieldRetroEnemies.length=0;fieldGrenades.length=0;fieldRetroLabels.length=0;fieldRetroMusic.pause();fieldRetroMusic.currentTime=0;fieldPaused=false;fieldPausePanel.hidden=true;document.getElementById("fieldHealthVignette").hidden=true;fieldDamageLabels.length=0;document.getElementById("fieldRunTimer").hidden=true;document.getElementById("fieldCombatHUD").hidden=true;fieldEnemyShots.length=0;fieldFootsteps.pause();fieldFootsteps.currentTime=0;document.getElementById("fieldMuzzleFlash").hidden=true;document.getElementById("fieldPracticeHUD").hidden=true;fieldPreviewMap=null;fieldCrouchOffset=0;fieldLean=0;fieldProjectiles.length=0;fieldRecoil=0;fieldGunKick=0;fieldFlash=0;fieldCrouchToggled=false;fieldBobStrength=0;document.getElementById('fieldGunMotion').style.transform='none';fieldAimToggled=false;fieldActive=false;fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldBinding=null;fieldSettings.hidden=true;fieldMenu.style.display='flex';document.getElementById('fieldInventory').hidden=true;document.getElementById('fieldCrosshair').hidden=true;document.getElementById('fieldMenuBtn').hidden=true;if(document.pointerLockElement===fieldCanvas)document.exitPointerLock();saveField();syncFieldRetroMusic();}
const fieldPausePanel=document.createElement('section');fieldPausePanel.id='fieldPausePanel';fieldPausePanel.hidden=true;fieldPausePanel.style.cssText='position:absolute;inset:0;z-index:38;background:#06110bd9;backdrop-filter:blur(5px);display:none;align-items:center;justify-content:center';fieldPausePanel.innerHTML='<div style="width:min(340px,90vw);display:grid;gap:16px"><h2 style="font-size:42px;font-weight:bold;text-align:center">Paused</h2><div data-field-music></div><button id="fieldResumeBtn" class="code-home-play">Resume</button><button id="fieldPauseSettingsBtn" class="code-home-secondary">Settings</button><button id="fieldPauseHomeBtn" class="code-home-secondary">Main Menu</button></div>';fieldRoot.append(fieldPausePanel);
// hidden must win over flex when switching between pause and settings.
// Pause-only tools are intentionally session data, never a saved preference.
const fieldAdminState={unlocked:false,infiniteAmmo:false,invincible:false};
const fieldAdminPanel=document.createElement('section');fieldAdminPanel.id='fieldAdminPanel';fieldAdminPanel.hidden=true;
fieldAdminPanel.setAttribute('aria-label','GOD CORE admin');
fieldAdminPanel.innerHTML=`<form id="fieldAdminForm"><label for="fieldAdminCode">Admin code</label><div class="field-admin-entry"><input id="fieldAdminCode" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="Enter code" aria-describedby="fieldAdminMessage"><button type="submit">Unlock</button></div></form><p id="fieldAdminMessage" role="status" aria-live="polite"></p><div id="fieldAdminTools" hidden><div class="field-admin-heading">Admin controls</div><label class="field-admin-toggle"><span>Infinite ammo</span><input id="fieldAdminAmmo" type="checkbox"></label><label class="field-admin-toggle"><span>Invincible</span><input id="fieldAdminInvincible" type="checkbox"></label><button id="fieldAdminSkip" type="button">Skip wave &amp; resume</button><p class="field-admin-note">Using these controls makes this run unranked.</p></div>`;
fieldPausePanel.firstElementChild.append(fieldAdminPanel);
const fieldAdminForm=document.getElementById('fieldAdminForm'),fieldAdminCode=document.getElementById('fieldAdminCode'),fieldAdminTools=document.getElementById('fieldAdminTools'),fieldAdminMessage=document.getElementById('fieldAdminMessage'),fieldAdminAmmo=document.getElementById('fieldAdminAmmo'),fieldAdminInvincibleInput=document.getElementById('fieldAdminInvincible'),fieldAdminSkip=document.getElementById('fieldAdminSkip');
function fieldAdminAmmoEnabled(){return fieldIsGodCore()&&fieldAdminState.infiniteAmmo;}
function fieldAdminInvincible(){return fieldIsGodCore()&&fieldAdminState.invincible;}
function fieldAdminCanUse(){return fieldIsGodCore()&&fieldPaused&&fieldAdminState.unlocked&&!(typeof godCoreAcquisitionActive!=='undefined'&&godCoreAcquisitionActive);}
function renderFieldAdmin(){
 fieldAdminPanel.hidden=!fieldIsGodCore()||!fieldPaused;
 fieldAdminForm.hidden=fieldAdminState.unlocked;fieldAdminTools.hidden=!fieldAdminState.unlocked;
 fieldAdminAmmo.checked=fieldAdminState.infiniteAmmo;fieldAdminInvincibleInput.checked=fieldAdminState.invincible;
 fieldAdminSkip.disabled=typeof godCoreAcquisitionActive!=='undefined'&&godCoreAcquisitionActive;
 fieldAdminAmmo.disabled=fieldAdminInvincibleInput.disabled=fieldAdminSkip.disabled;
}
function resetFieldAdmin(){
 fieldAdminState.unlocked=false;fieldAdminState.infiniteAmmo=false;fieldAdminState.invincible=false;
 fieldAdminCode.value='';fieldAdminMessage.textContent='';renderFieldAdmin();
}
function markFieldAdminRun(){if(fieldRun){fieldRun.assisted=true;queueFieldRunSave();}}
function refillFieldAdminAmmo(){
 cancelRetroPistolReload();cancelRetroARReload();cancelRetroRocketReload();
 fieldRetroReloading=false;fieldRetroReloadElapsed=0;fieldRetroReloadAudio.pause();fieldRetroReloadAudio.currentTime=0;
 fieldRetroPistolAmmo=9;fieldRetroARAmmo=43;fieldRetroRocketAmmo=1;fieldRetroShells=7;
 renderRetroShells();
}
fieldAdminForm.addEventListener('submit',event=>{
 event.preventDefault();if(!fieldIsGodCore()||!fieldPaused)return;
 if(fieldAdminCode.value==='1771'){fieldAdminState.unlocked=true;fieldAdminMessage.textContent='';fieldAdminCode.value='';renderFieldAdmin();fieldAdminAmmo.focus();}
 else{fieldAdminMessage.textContent='Incorrect code. Try again.';fieldAdminCode.value='';fieldAdminCode.focus();}
});
fieldAdminAmmo.addEventListener('change',()=>{
 if(!fieldAdminCanUse()){renderFieldAdmin();return;}
 fieldAdminState.infiniteAmmo=fieldAdminAmmo.checked;
 if(fieldAdminState.infiniteAmmo){markFieldAdminRun();refillFieldAdminAmmo();}renderFieldAdmin();
});
fieldAdminInvincibleInput.addEventListener('change',()=>{
 if(!fieldAdminCanUse()){renderFieldAdmin();return;}
 fieldAdminState.invincible=fieldAdminInvincibleInput.checked;
 if(fieldAdminState.invincible)markFieldAdminRun();renderFieldAdmin();
});
function fieldAdminSkipWave(){
 if(!fieldAdminCanUse())return false;
 markFieldAdminRun();
 fieldRetroEnemies.length=0;fieldRetroPending=0;fieldRetroCleared=false;fieldRetroIntermission=0;
 fieldEnemyShots.length=0;fieldProjectiles.length=0;fieldRetroRockets.length=0;fieldGrenades.length=0;fieldExplosions.length=0;fieldRetroLabels.length=0;
 fieldShotCooldown=0;fieldPlayerHealth=100;fieldRetroWave++;
 resumeField();beginRetroWave();return true;
}
fieldAdminSkip.onclick=fieldAdminSkipWave;
window.addEventListener('platdo:beforereset',resetFieldAdmin);

const pauseStyle=document.createElement('style');pauseStyle.textContent='#fieldPausePanel:not([hidden]){display:flex!important}';document.head.append(pauseStyle);
function pauseField(){if(godCoreVictoryActive){pauseGodCoreVictory();return;}if(godCoreAcquisitionActive){pauseGodCoreAcquisition();return;}if(!fieldActive)return;pauseFieldRunClock();resetFieldRetroPistolAnimation();fieldFriendlyTowelAudio.pause();fieldTowelPrompt.hidden=true;fieldFriendlyRefillAudio.pause();resetFieldLookInput();fieldRetroReloadAudio.pause();fieldRetroARReloadAudio.pause();fieldRetroRocketReloadAudio.pause();fieldActive=false;fieldPaused=true;renderFieldFriendlyAction();syncFieldRetroMusic();fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldFootsteps.pause();fieldPausePanel.hidden=false;renderFieldAdmin();document.getElementById('fieldMuzzleFlash').hidden=true;if(document.pointerLockElement===fieldCanvas)document.exitPointerLock();saveField();}
function resumeField(){if(godCoreVictoryActive){resumeGodCoreVictory();return;}if(godCoreAcquisitionActive){resumeGodCoreAcquisition();return;}resetFieldLookInput();if(fieldRetroRocketReload&&!fieldRetroRocketReloadAudio.ended){fieldRetroRocketReloadAudio.volume=fieldAudioVolume(fieldRetroRocketReloadSource,'retroRocketReload');fieldRetroRocketReloadAudio.play().catch(()=>{});}if(fieldRetroARReload&&!fieldRetroARReloadAudio.ended)fieldRetroARReloadAudio.play().catch(()=>{});if(fieldRetroReloading)fieldRetroReloadAudio.play().catch(()=>{});fieldPausePanel.hidden=true;fieldSettings.hidden=true;fieldPaused=false;fieldActive=true;resumeFieldRunClock();if(fieldFriendlyTowel&&fieldFriendlyTowelAudio.ended)finishFieldFriendlyTowel();else playFieldFriendlyTowel();if(fieldFriendlyRefill&&fieldFriendlyRefillAudio.ended)finishFieldFriendlyRefill();else playFieldFriendlyRefill();if(!fieldActive)return;renderFieldFriendlyAction();renderFieldTowelPrompt();syncFieldRetroMusic();fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldLastTime=0;const lock=window.Platdo?.controls?.isMobile?null:fieldCanvas.requestPointerLock?.();lock?.catch(()=>{});}
document.getElementById('fieldResumeBtn').onclick=resumeField;document.getElementById('fieldPauseHomeBtn').onclick=fieldToMenu;document.getElementById('fieldPauseSettingsBtn').onclick=()=>{fieldPausePanel.hidden=true;fieldSettings.hidden=false;fieldBinding=null;renderFieldLoadout();renderFieldBinds();};
const fieldIdleImageIds={pistol:'fieldPistolIdle',ar:'fieldARIdle',sniper:'fieldSniperIdle',shotgun:'fieldShotgunIdle'};
function applyFieldSkins(){for(const image of document.querySelectorAll('#fieldGunMotion img[data-weapon-type]'))image.style.filter=image.dataset.retroPistolKey?'url(#'+image.dataset.retroPistolKey+')':image.dataset.weaponType==='grenade'?'url(#fieldGrenadeKey)':image.dataset.backgroundKey==='white'?'url(#fieldWhiteKey)':fieldSkinStyles[fieldSkins[image.dataset.weaponType]||'default'].filter;}
function renderFieldLoadout(){
 const panel=document.getElementById('fieldLoadoutPanel'),retro=fieldIsRetroMode();panel.replaceChildren();const h=document.createElement('h2');h.textContent=retro?fieldModeLabel()+' loadout order':'Loadout order';h.style.cssText='font-size:30px;margin:20px 0';const p=document.createElement('p');p.textContent='Move weapons up or down to change the inventory and scroll-wheel order.';panel.append(h,p);
 const order=retro?fieldRetroLoadout:fieldLoadout,visibleOrder=retro?fieldRetroLoadout:fieldModeLoadout();visibleOrder.forEach((id,index)=>{const name=fieldWeaponLabel(id),row=document.createElement('div');row.dataset.weapon=id;row.style.cssText='display:flex;align-items:center;gap:16px;margin:16px 0;padding:14px;background:#203a50;border-radius:8px';const label=document.createElement('strong');label.textContent=(index+1)+'. '+name;label.style.flex=1;row.append(label);
 for(const direction of [-1,1]){const button=document.createElement('button');button.textContent=direction<0?'↑':'↓';button.setAttribute('aria-label','Move '+name+(direction<0?' up':' down'));button.disabled=index+direction<0||index+direction>=visibleOrder.length;button.style.cssText='padding:6px 16px;border:1px solid #ffffff66;opacity:'+(button.disabled?.3:1);button.onclick=()=>{const from=order.indexOf(id),to=order.indexOf(visibleOrder[index+direction]);[order[from],order[to]]=[order[to],order[from]];if(fieldSaving)fieldStorage.set(retro?'retro-loadout':'loadout',JSON.stringify(order));renderFieldLoadout();renderFieldInventory();};row.append(button);}panel.append(row);});
}
const fieldLockerPanel=document.createElement('section');fieldLockerPanel.id='fieldLockerPanel';fieldLockerPanel.hidden=true;fieldLockerPanel.style.cssText='position:absolute;inset:0;z-index:41;background:#102018;overflow:auto;padding:clamp(16px,4vw,48px)';fieldRoot.append(fieldLockerPanel);let fieldLockerWeapon='pistol';
function fieldLockerImage(id){if(fieldIsRetroMode())return id==='rocket'?fieldRetroRocketImage:id==='grenade'?fieldGrenadeImage:id==='pistol'?fieldRetroPistolImages.idle:id==='ar'?fieldRetroARImages[0]:document.getElementById('fieldRetroShotgunReady');return document.getElementById(fieldFriendly?(id==='ar'?'fieldFriendlyARIdle':'fieldFriendlyPistolIdle'):fieldIdleImageIds[id]);}
function renderFieldLocker(){const visibleWeapons=fieldIsRetroMode()?fieldRetroLoadout:fieldModeLoadout();if(!visibleWeapons.includes(fieldLockerWeapon))fieldLockerWeapon=visibleWeapons[0];fieldLockerPanel.replaceChildren();const back=document.createElement('button');back.textContent='← Back';back.className='code-home-tag';back.onclick=()=>fieldLockerPanel.hidden=true;const title=document.createElement('h2');title.textContent='Weapon locker';title.style.cssText='font-size:32px;margin:18px 0';const note=document.createElement('p');note.textContent='Original weapon images only. Custom skins will be added later.';const tabs=document.createElement('nav');tabs.style.cssText='display:flex;gap:10px;margin:24px 0;flex-wrap:wrap';for(const id of visibleWeapons){const button=document.createElement('button');button.className='code-home-tag';button.textContent=fieldWeaponLabel(id);button.style.background=id===fieldLockerWeapon?'#456333':'transparent';button.setAttribute('aria-pressed',String(id===fieldLockerWeapon));button.onclick=()=>{fieldLockerWeapon=id;renderFieldLocker();};tabs.append(button);}fieldLockerPanel.append(back,title,note,tabs);const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px';for(const [id,skin] of Object.entries(fieldSkinStyles)){const card=document.createElement('button');card.style.cssText='background:#1e3027;border:2px solid '+((fieldSkins[fieldLockerWeapon]||'default')===id?'#c5ed81':'#55665b')+';border-radius:10px;padding:12px';const image=document.createElement('img');const source=fieldLockerImage(fieldLockerWeapon);image.src=source.src;image.alt=skin.name+' '+fieldWeaponLabel(fieldLockerWeapon);image.style.cssText='height:230px;width:100%;object-fit:contain;filter:'+(fieldIsRetroMode()?getComputedStyle(source).filter:skin.filter);const name=document.createElement('p');name.textContent=skin.name+((fieldSkins[fieldLockerWeapon]||'default')===id?' · Equipped':' · Equip');card.append(image,name);card.onclick=()=>{fieldSkins[fieldLockerWeapon]=id;if(fieldSaving)fieldStorage.set('skins',JSON.stringify(fieldSkins));applyFieldSkins();renderFieldLocker();};grid.append(card);}fieldLockerPanel.append(grid);}
document.getElementById('fieldLockerBtn').onclick=()=>{renderFieldLocker();fieldLockerPanel.hidden=false;};
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!fieldLockerPanel.hidden){e.preventDefault();e.stopImmediatePropagation();fieldLockerPanel.hidden=true;}},true);
renderFieldLoadout();applyFieldSkins();
let fieldRunsTab='practice',fieldRunsVisible=53;const fieldRunsPanel=document.createElement('section');fieldRunsPanel.id='fieldRunsPanel';fieldRunsPanel.hidden=true;fieldRunsPanel.style.cssText='position:absolute;inset:0;z-index:40;overflow:auto;background:#102018;color:#f4f7ea;padding:clamp(16px,4vw,48px)';fieldRoot.append(fieldRunsPanel);
// Older records may lack a wave. Keep them without inventing progress.
function fieldRunWave(run){return Math.max(0,Number.isFinite(run.wave)?Math.floor(run.wave):0,Number.isFinite(run.completedWaves)?Math.floor(run.completedWaves):0);}
function fieldRunAccuracy(run){return Number.isFinite(run.shots)&&run.shots>0&&Number.isFinite(run.hits)?Math.max(0,Math.min(1,run.hits/run.shots)):0;}
function compareFieldRuns(a,b){return fieldRunWave(b)-fieldRunWave(a)||fieldRunAccuracy(b)-fieldRunAccuracy(a)||(Number.isFinite(b.hits)?b.hits:0)-(Number.isFinite(a.hits)?a.hits:0)||(Number.isFinite(a.seconds)?a.seconds:Infinity)-(Number.isFinite(b.seconds)?b.seconds:Infinity)||0;}
function renderFieldRuns(){if(fieldIsGodCore()){renderGodCoreRuns();return;}fieldRunsPanel.replaceChildren();const title=document.createElement('h2');title.textContent='Your runs';title.style.cssText='font-size:32px;font-weight:bold';fieldRunsPanel.append(title);const back=document.createElement('button');back.textContent='← Back';back.className='code-home-tag';back.onclick=()=>fieldRunsPanel.hidden=true;fieldRunsPanel.append(back);const note=document.createElement('p');note.textContent='Runs finish when you return to the menu or are defeated. Ranked by highest wave reached, then shot accuracy (hits ÷ shots). If both match, more hits and then shorter time break the tie. Shots/hits counts successful shots once, including shotgun blasts.';note.style.cssText='margin:20px 0;color:#becbbb';fieldRunsPanel.append(note);
const tabs=document.createElement('nav');tabs.style.cssText='display:flex;gap:12px;margin:18px 0;flex-wrap:wrap';for(const mode of ['practice','normal','retro']){const button=document.createElement('button');button.textContent=fieldModeLabel(mode);button.className='code-home-tag';button.style.background=fieldRunsTab===mode?'#456333':'transparent';button.setAttribute('aria-pressed',String(fieldRunsTab===mode));button.onclick=()=>{fieldRunsTab=mode;fieldRunsVisible=53;renderFieldRuns();};tabs.append(button);}fieldRunsPanel.append(tabs);if(fieldRunSaveError){const warning=document.createElement('p');warning.setAttribute('role','status');warning.textContent=fieldRunSaveError;fieldRunsPanel.append(warning);}const sorted=fieldRuns.filter(r=>r.mode===fieldRunsTab).sort(compareFieldRuns);if(!sorted.length){const empty=document.createElement('p');empty.textContent='No '+fieldModeLabel(fieldRunsTab)+' runs yet. Play this mode to record your first run.';fieldRunsPanel.append(empty);return;}
function details(run){return [fieldModeLabel(run.mode,run.friendly),(fieldIsRetroMode(run.mode)?(fieldRetroMaps[run.retroMap]?.name||'Retro'):fieldMaps[run.map]?.name||run.map),run.shots+'/'+run.hits+' shots/hits · '+Math.round(100*fieldRunAccuracy(run))+'% accuracy',Object.entries(fieldIsRetroMode(run.mode)?{pistol:'Pistol',ar:'AR',shotgun:'Shotgun',grenade:'Grenade',rocket:'Rocket Launcher',...(run.weapons.sniper?{sniper:'Sniper'}:{})}:fieldWeaponNames).map(([key,name])=>name+' '+(run.shots?Math.round(100*(run.weapons[key]||0)/run.shots):0)+'%').join(' · '),formatFieldTime(run.seconds)+' played'+' · '+(fieldRunWave(run)>0?'Wave '+fieldRunWave(run):'Wave not recorded')+(Number.isFinite(run.completedWaves)?' · '+run.completedWaves+' cleared':'')+(Number.isFinite(run.kills)&&run.mode!=='practice'?' · '+run.kills+' kills':'')+(Number.isFinite(run.targets)&&run.mode==='practice'?' · '+run.targets+' targets':''),formatFieldRunDate(run.started),formatFieldRunDate(run.ended)];}
const latest=sorted.reduce((a,b)=>Date.parse(b.ended)>=Date.parse(a.ended)?b:a);const recent=document.createElement('article');recent.dataset.latestRun=latest.id;recent.style.cssText='margin:24px 0;padding:18px;border:1px solid #66735d;border-radius:8px';const recentTitle=document.createElement('h3');recentTitle.textContent='Latest run';recentTitle.style.cssText='font-size:22px;font-weight:bold';recent.append(recentTitle);for(const line of [details(latest)[0]+' · '+details(latest)[1],details(latest)[2],details(latest)[4],(latest.reason||'Finished')+' · '+formatFieldRunDate(latest.ended)]){const text=document.createElement('p');text.textContent=line;text.style.marginTop='6px';recent.append(text);}fieldRunsPanel.append(recent);
const podium=document.createElement('div');podium.className='code-run-podium';podium.style.cssText='display:flex;align-items:flex-end;gap:16px;margin:28px 0;flex-wrap:wrap';for(const rank of [1,0,2]){const run=sorted[rank];if(!run)continue;const card=document.createElement('article');card.dataset.rank=String(rank+1);card.style.cssText='flex:1;min-width:220px;padding:22px;background:'+(['#554c24','#303e43','#493629'][rank])+';border-top:4px solid '+(['#f5d36c','#c2d3dd','#c99776'][rank])+';min-height:'+([340,290,250][rank])+'px;padding-bottom:'+([90,50,22][rank])+'px';const h=document.createElement('h3');h.textContent='#'+(rank+1);h.style.cssText='font-size:38px;font-weight:bold';card.append(h);for(const [index,line] of details(run).entries()){const p=document.createElement('p');p.textContent=(index===5?'Started: ':index===6?'Completed: ':'')+line;p.style.marginTop='10px';card.append(p);}podium.append(card);}fieldRunsPanel.append(podium);
const wrap=document.createElement('div');wrap.style.overflowX='auto';const table=document.createElement('table');table.style.cssText='width:100%;text-align:left;border-collapse:collapse';const head=document.createElement('tr');for(const label of ['Rank','Mode','Map','Shots / hits','Weapon use','Time','Started','Completed']){const th=document.createElement('th');th.textContent=label;th.style.padding='12px';head.append(th);}table.append(head);sorted.slice(3,fieldRunsVisible).forEach((run,i)=>{const row=document.createElement('tr');row.style.borderTop='1px solid #4b5c4f';for(const text of ['#'+(i+4),...details(run)]){const cell=document.createElement('td');cell.textContent=text;cell.style.padding='12px';row.append(cell);}table.append(row);});wrap.append(table);fieldRunsPanel.append(wrap);if(sorted.length>fieldRunsVisible){const more=document.createElement('button');more.className='code-home-tag';more.style.marginTop='20px';more.textContent='Show more runs';more.onclick=()=>{fieldRunsVisible+=50;renderFieldRuns();};fieldRunsPanel.append(more);}}
document.getElementById('fieldRunsBtn').onclick=()=>{persistFieldRunHistory();fieldRunsTab=['practice','normal','retro'].includes(fieldMode)?fieldMode:'practice';fieldRunsVisible=53;renderFieldRuns();fieldRunsPanel.hidden=false;fieldRunsPanel.scrollTop=0;};
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!fieldRunsPanel.hidden){e.preventDefault();e.stopImmediatePropagation();fieldRunsPanel.hidden=true;}},true);
function fieldSetVisible(visible){fieldLockerPanel.hidden=true;fieldRunsPanel.hidden=true;fieldRoot.hidden=!visible;fieldToMenu();if(visible){if(!fieldFrame){fieldLastTime=0;fieldFrame=requestAnimationFrame(fieldLoop);}}else{cancelAnimationFrame(fieldFrame);fieldFrame=0;}}
function updateFieldCrosshair(){
 const crosshair=document.getElementById('fieldCrosshair'),shotgun=fieldEquipped==='shotgun';if(crosshair.dataset.shotgun===String(shotgun))return;crosshair.dataset.shotgun=String(shotgun);
 crosshair.style.width=shotgun?'44px':'auto';crosshair.style.height=shotgun?'44px':'auto';
 crosshair.innerHTML=shotgun?'<i style="position:absolute;top:0;left:0;width:12px;height:12px;border-top:2px solid white;border-left:2px solid white;filter:drop-shadow(0 1px 1px #222)"></i><i style="position:absolute;top:0;right:0;width:12px;height:12px;border-top:2px solid white;border-right:2px solid white;filter:drop-shadow(0 1px 1px #222)"></i><i style="position:absolute;bottom:0;left:0;width:12px;height:12px;border-bottom:2px solid white;border-left:2px solid white;filter:drop-shadow(0 1px 1px #222)"></i><i style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-bottom:2px solid white;border-right:2px solid white;filter:drop-shadow(0 1px 1px #222)"></i>':'+';
}

const fieldCleanHUDStyle=document.createElement('style');fieldCleanHUDStyle.id='fieldCleanHUDStyle';fieldCleanHUDStyle.textContent=`
#fieldGame.field-clean-hud :is(#fieldRetroHUD,#fieldPracticeHUD,#fieldRunTimer,#fieldMenuBtn,#fieldTutorialHUD,#fieldTowelPrompt,#fieldInventorySlots){background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important;text-shadow:0 1px 3px #001525,0 0 1px #001525}
#fieldGame.field-clean-hud #fieldInventorySlots{padding:0!important;gap:12px}
#fieldGame.field-clean-hud #fieldInventorySlots button{background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#f2fcff!important;text-shadow:0 1px 3px #001525;min-height:44px}
#fieldGame.field-clean-hud #fieldInventorySlots button[aria-pressed="true"]{color:#d8ff92!important;text-decoration:underline;text-underline-offset:7px;text-decoration-thickness:3px}
#fieldGame.field-clean-hud #fieldInventorySlots button:hover{color:#d8ff92!important}
#fieldGame.field-clean-hud #fieldMenuBtn{color:#f2fcff!important;padding:8px 0!important}
#fieldGame.field-clean-hud #fieldRunTimer{padding:0!important;font:bold 18px monospace}
#fieldGame.field-clean-hud #fieldTutorialHUD{padding:0!important}
#fieldGame.field-clean-hud #fieldTowelPrompt{padding:0!important}
#fieldGame.field-clean-hud #fieldPracticeHUD{padding:0!important;font-size:clamp(20px,2.2vw,28px);font-weight:bold;max-width:calc(100% - 210px)}
#fieldGame #fieldRetroHUD{padding:0!important;max-width:calc(100% - 200px);width:max-content;background:none!important;text-shadow:0 2px 3px #001525}
#fieldGame #fieldRetroHUD .field-retro-wave-title{display:block;font:bold clamp(28px,3.4vw,44px) monospace;line-height:1.15;letter-spacing:1px}
#fieldGame #fieldRetroHUD .field-retro-wave-detail{display:block;margin-top:7px;font:bold clamp(11px,1.15vw,15px) monospace;line-height:1.4}
/* Separate the lower HUD rows when side-by-side panels no longer fit. */
@media(max-width:1050px){
 #fieldGame.field-clean-hud #fieldCombatHUD{left:16px!important;bottom:16px!important;width:min(260px,calc(100% - 32px))}
 #fieldGame.field-clean-hud #fieldInventory{bottom:76px!important;max-width:calc(100% - 32px)!important;width:max-content}
 #fieldGame.field-clean-hud #fieldInventorySlots{gap:6px;justify-content:center}
 #fieldGame.field-clean-hud #fieldInventorySlots button{min-width:0;min-height:36px;padding:8px 9px!important;font-size:12px;line-height:16px;white-space:nowrap}
 #fieldGame.field-clean-hud :is(#fieldShellHUD,#fieldFriendlyAmmoHUD,#fieldRetroPistolAmmoHUD,#fieldRetroRocketAmmoHUD,#fieldRetroARAmmoHUD){right:16px!important;bottom:132px!important;max-width:calc(100% - 32px)!important}
 #fieldGame.field-clean-hud #fieldFriendlyAmmoHUD{width:max-content}
}
`;document.head.append(fieldCleanHUDStyle);
function syncFieldHUDStyle(){fieldRoot.classList.toggle('field-clean-hud',fieldIsRetroMode()||fieldFriendly);}

function renderFieldInventory(){if(fieldRetroARReload&&(!fieldIsRetroMode()||fieldEquipped!=='ar'))cancelRetroARReload();if(fieldRetroRocketReload&&(!fieldIsRetroMode()||fieldEquipped!=='rocket'))cancelRetroRocketReload();if(fieldRetroPistolReload&&(!fieldIsRetroMode()||fieldEquipped!=='pistol'))cancelRetroPistolReload();if(fieldNormalPistolReload&&!fieldHasNormalPistolMagazine())cancelFieldNormalPistolReload();renderFieldNormalPistolAmmo();if(!fieldIsRetroMode()||fieldEquipped!=='pistol')resetFieldRetroPistolAnimation();syncFieldHUDStyle();renderRetroShells();const available=fieldAvailableWeapons();if(!available.includes(fieldEquipped)){fieldEquipped=available[0];fieldAimToggled=false;}if(!fieldCanAimWeapon())fieldAimToggled=false;if(fieldFriendlyRefill&&fieldFriendlyRefill.weapon!==fieldEquipped)cancelFieldFriendlyRefill();renderFieldFriendlyAmmo();applyFieldSkins();updateFieldCrosshair();
 const slots=document.getElementById('fieldInventorySlots');slots.replaceChildren();
 for(const id of fieldAvailableWeapons()){const name=fieldWeaponLabel(id);const slot=document.createElement('button');slot.textContent=name;slot.setAttribute('aria-pressed',String(id===fieldEquipped));slot.style.cssText='padding:12px clamp(8px,2vw,22px);border-radius:8px;cursor:pointer;border:2px solid '+(id===fieldEquipped?'#c9ef8a':'#ffffff44')+';background:'+(id===fieldEquipped?'#456c31':'#182e40')+';color:white';slot.onclick=()=>{fieldEquipped=id;fieldAimToggled=false;renderFieldInventory();saveField();};slots.append(slot);}

}
function fieldInventoryInput(code){if(fieldActive&&fieldBindings.refill.includes(code))interactFieldFriendly();if(fieldActive&&fieldBindings.reload.includes(code)){if(fieldHasNormalPistolMagazine())beginFieldNormalPistolReload();else beginRetroReload();}if(fieldBindings.songPrevious.includes(code))skipFieldMusic(-1);if(fieldBindings.songNext.includes(code))skipFieldMusic(1);
 if(fieldActive&&fieldBindings.sprint.includes(code)&&fieldSprintMode==='toggle')fieldSprintToggled=!fieldSprintToggled;
 if(fieldBindings.fire.includes(code))shootFieldWeapon();
 if(fieldHeight<=1.701&&fieldBindings.crouch.includes(code)&&fieldCrouchMode==='toggle')fieldCrouchToggled=!fieldCrouchToggled;
 if(fieldCanAimWeapon()&&fieldBindings.aim.includes(code)&&fieldAimMode==='toggle')fieldAimToggled=!fieldAimToggled;
 const direction=fieldBindings.inventoryNext.includes(code)?1:fieldBindings.inventoryPrevious.includes(code)?-1:0;
 if(!direction)return;const ids=fieldAvailableWeapons();fieldEquipped=ids[(ids.indexOf(fieldEquipped)+direction+ids.length)%ids.length];fieldAimToggled=false;renderFieldInventory();saveField();
}
function fieldBindName(code){return code.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Mouse/,'Mouse ').replace(/^Arrow/,'Arrow ');}
function renderFieldBinds(){
 document.getElementById('fieldCrouchMode').value=fieldCrouchMode;document.getElementById('fieldAimMode').value=fieldAimMode;document.getElementById('fieldSprintMode').value=fieldSprintMode;
 const rows=document.getElementById('fieldBindRows');rows.replaceChildren();
 if(window.Platdo?.controls?.isMobile){fieldBinding=null;document.getElementById('fieldBindPrompt').textContent='Mobile controls are enabled in the game selector. Drag the movement stick to move, drag Look to turn, and use the action buttons. Switch to PC there to edit keyboard and mouse bindings.';return;}
 document.getElementById('fieldBindPrompt').textContent='';
 for(const [action,label] of Object.entries(fieldLabels)){
 if(fieldIsGodCore()&&action==='refill')continue;
 const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:16px 0;border-bottom:1px solid #ffffff22';const name=document.createElement('strong');name.textContent=label;name.style.width='150px';row.append(name);
 fieldBindings[action].forEach((code,index)=>{const group=document.createElement('span');group.style.cssText='display:inline-flex;border:1px solid #8296a9;border-radius:8px';const button=document.createElement('button');button.textContent=fieldBindName(code);button.style.cssText='padding:10px;cursor:pointer';button.onclick=()=>beginFieldBind(action,index);const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Remove '+fieldBindName(code)+' from '+label);remove.style.cssText='padding:10px;color:#ffaaaa;cursor:pointer';remove.onclick=()=>{fieldBindings[action].splice(index,1);fieldBinding=null;document.getElementById('fieldBindPrompt').textContent='';renderFieldBinds();saveField();};group.append(button,remove);row.append(group);});
 const add=document.createElement('button');add.textContent='+';add.setAttribute('aria-label','Add binding for '+label);add.disabled=fieldBindings[action].length>=5;add.style.cssText='padding:10px 16px;border:1px solid #8296a9;border-radius:8px;cursor:pointer';add.onclick=()=>beginFieldBind(action,-1);row.append(add);rows.append(row);
 }
}
function beginFieldBind(action,index){fieldBinding={action,index};document.getElementById('fieldBindPrompt').textContent='Press a key, mouse button, or scroll for '+fieldLabels[action]+'. Escape returns to the menu.';}
function captureFieldBind(code){if(!fieldBinding)return;const {action,index}=fieldBinding;const binds=fieldBindings[action];if(!binds.includes(code)){if(index>=0)binds[index]=code;else if(binds.length<5)binds.push(code);}fieldBinding=null;document.getElementById('fieldBindPrompt').textContent='Binding saved.';renderFieldBinds();saveField();}
// Friendly-only tutorial menu integration.
function renderFieldModes(){
 if(fieldIsGodCore()){fieldMode='retro-story';fieldFriendly=false;fieldPractice=false;fieldRetroMap='godcore';}else if(fieldMode==='retro-story')fieldMode='retro';
 syncFieldHUDStyle();
 if((fieldFriendly&&fieldIsRetroMode())||(!fieldFriendly&&fieldMode==='tutorial')){fieldMode='normal';fieldPractice=false;saveField();}
 renderFieldMapChoices();
 for(const button of document.querySelectorAll('#fieldModeChoices button')){button.hidden=button.dataset.mode==='tutorial'?!fieldFriendly:fieldFriendly&&fieldIsRetroMode(button.dataset.mode);const selected=button.dataset.mode===fieldMode;button.setAttribute('aria-pressed',String(selected));button.style.background=selected?'#c5ed81':'#14241bd9';button.style.color=selected?'#102718':'#f4f7ea';}
 const play=document.getElementById('fieldPlay');play.firstChild.textContent=fieldMode==='tutorial'?'Play Tutorial ':fieldMode==='retro-story'?'Play GOD CORE ':'Play ';play.setAttribute('aria-label',fieldMode==='tutorial'?'Play Friendly Tutorial':fieldMode==='retro-story'?'Play GOD CORE':'Play');
 renderGodCoreIdentity();
}
for(const button of document.querySelectorAll('#fieldModeChoices button'))button.onclick=()=>{if(fieldIsGodCore())return;fieldMode=button.dataset.mode;fieldPractice=fieldMode==='practice';fieldWave=1;fieldWaveHits=0;fieldTarget=null;fieldLastTarget=null;fieldEnemy=null;fieldEnemyShots.length=0;renderFieldModes();saveField();syncFieldRetroMusic();};renderFieldModes();
const godCoreIntroSource='assets/video/godcoreintrosource-b919debc3644.mp4';
// The opening movie belongs to Play, not to the GOD CORE menu. No run exists
// during the movie, so its duration never affects completion-time rankings.
let godCoreIntroActive=false,godCoreIntroSession=0;
const godCoreIntro=document.createElement('section');godCoreIntro.id='godCoreIntro';godCoreIntro.hidden=true;
godCoreIntro.setAttribute('role','dialog');godCoreIntro.setAttribute('aria-label','GOD CORE opening cutscene');
godCoreIntro.style.cssText='position:absolute;inset:0;z-index:80;background:#000';
const godCoreIntroVideo=document.createElement('video');godCoreIntroVideo.id='godCoreIntroVideo';
godCoreIntroVideo.playsInline=true;godCoreIntroVideo.preload='none';godCoreIntroVideo.controls=true;
godCoreIntroVideo.muted=false;godCoreIntroVideo.defaultMuted=false;godCoreIntroVideo.volume=1;
godCoreIntroVideo.style.cssText='display:block;width:100%;height:100%;object-fit:contain;background:#000';
const godCoreIntroResume=document.createElement('button');godCoreIntroResume.id='godCoreIntroResume';godCoreIntroResume.hidden=true;godCoreIntroResume.textContent='Play cutscene with sound';
godCoreIntroResume.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:18px 28px;background:#18181b;color:white;border:1px solid #f25336;font:bold 18px sans-serif;cursor:pointer';
const godCoreIntroBack=document.createElement('button');godCoreIntroBack.id='godCoreIntroBack';godCoreIntroBack.textContent='Back to menu';
const godCoreIntroSkip=document.createElement('button');godCoreIntroSkip.id='godCoreIntroSkip';godCoreIntroSkip.textContent='Skip cutscene';
for(const [button,side] of [[godCoreIntroBack,'left'],[godCoreIntroSkip,'right']])button.style.cssText='position:absolute;'+side+':20px;top:20px;padding:10px 16px;background:#000a;color:white;border:1px solid #ffffff55;font:600 14px sans-serif;cursor:pointer';
godCoreIntro.append(godCoreIntroVideo,godCoreIntroResume,godCoreIntroBack,godCoreIntroSkip);fieldRoot.append(godCoreIntro);
function playGodCoreIntroVideo(){
 if(!godCoreIntroActive)return;const session=godCoreIntroSession;
 godCoreIntroResume.hidden=true;
 godCoreIntroVideo.play().catch(()=>{if(godCoreIntroActive&&session===godCoreIntroSession)godCoreIntroResume.hidden=false;});
}
function beginGodCoreIntro(){
 if(!fieldIsGodCore()||fieldRoot.hidden||fieldActive||fieldPaused||godCoreIntroActive||!initFieldRenderer())return;
 pauseFieldRunClock();godCoreIntroSession++;godCoreIntroActive=true;fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldAimToggled=false;
 fieldMenu.style.display='none';fieldSettings.hidden=true;fieldPausePanel.hidden=true;fieldRetroMusic.pause();godCorePowerAudio.pause();
 // This src is an embedded H.264/AAC MP4, including the supplied stereo audio.
 if(!godCoreIntroVideo.hasAttribute('src'))godCoreIntroVideo.src=godCoreIntroSource;
 godCoreIntroVideo.currentTime=0;godCoreIntroVideo.muted=false;godCoreIntroVideo.volume=1;
 godCoreIntro.hidden=false;godCoreIntroVideo.controls=true;godCoreIntroSkip.focus();playGodCoreIntroVideo();
}
function cancelGodCoreIntro(){
 godCoreIntroActive=false;godCoreIntroSession++;godCoreIntroVideo.pause();godCoreIntroVideo.currentTime=0;
 godCoreIntro.hidden=true;godCoreIntroResume.hidden=true;
}
function finishGodCoreIntro(){
 if(!godCoreIntroActive||!fieldIsGodCore()||fieldRoot.hidden)return;
 cancelGodCoreIntro();startFieldGameplay();
}
godCoreIntroVideo.addEventListener('ended',()=>{if(godCoreIntroVideo.ended)finishGodCoreIntro();});
godCoreIntroVideo.addEventListener('error',()=>{
 if(!godCoreIntroActive)return;
 godCoreIntroResume.textContent='Retry cutscene';godCoreIntroResume.hidden=false;
});
godCoreIntroResume.onclick=()=>{if(godCoreIntroVideo.error)godCoreIntroVideo.load();playGodCoreIntroVideo();};
godCoreIntroBack.onclick=fieldToMenu;godCoreIntroSkip.onclick=finishGodCoreIntro;
document.addEventListener('visibilitychange',()=>{if(godCoreIntroActive&&document.hidden)godCoreIntroVideo.pause();});
window.addEventListener('platdo:beforereset',cancelGodCoreIntro);

const godCoreAcquisitionSource='assets/video/godcoreacquisitionsource-b236274be91c.mp4';
// Wave 15 grants the core through a separate movie. The opening movie remains
// on Play; this transition neither consumes finale music nor counts run time.
let godCoreAcquisitionActive=false,godCoreAcquisitionPaused=false,godCoreAcquisitionSeen=false,godCoreAcquisitionSession=0,godCoreAcquisitionWatchPosition=0;
const godCoreAcquisition=document.createElement('section');godCoreAcquisition.id='godCoreAcquisition';godCoreAcquisition.hidden=true;
godCoreAcquisition.setAttribute('role','dialog');godCoreAcquisition.setAttribute('aria-label','Gaining the GOD CORE');
godCoreAcquisition.style.cssText='position:absolute;inset:0;z-index:80;background:#000';
const godCoreAcquisitionVideo=document.createElement('video');godCoreAcquisitionVideo.id='godCoreAcquisitionVideo';
godCoreAcquisitionVideo.playsInline=true;godCoreAcquisitionVideo.preload='none';godCoreAcquisitionVideo.controls=false;godCoreAcquisitionVideo.disablePictureInPicture=true;godCoreAcquisitionVideo.disableRemotePlayback=true;
godCoreAcquisitionVideo.muted=false;godCoreAcquisitionVideo.defaultMuted=false;godCoreAcquisitionVideo.volume=1;
godCoreAcquisitionVideo.style.cssText='display:block;width:100%;height:100%;object-fit:contain;background:#000';
const godCoreAcquisitionResume=document.createElement('button');godCoreAcquisitionResume.id='godCoreAcquisitionResume';godCoreAcquisitionResume.hidden=true;godCoreAcquisitionResume.textContent='Play cutscene with sound';
godCoreAcquisitionResume.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:18px 28px;background:#18181b;color:white;border:1px solid #f25336;font:bold 18px sans-serif;cursor:pointer';
const godCoreAcquisitionPause=document.createElement('button');godCoreAcquisitionPause.id='godCoreAcquisitionPause';godCoreAcquisitionPause.textContent='Pause';
for(const [button,side] of [[godCoreAcquisitionPause,'left']])button.style.cssText='position:absolute;'+side+':20px;top:20px;padding:10px 16px;background:#000a;color:white;border:1px solid #ffffff55;font:600 14px sans-serif;cursor:pointer';
godCoreAcquisition.append(godCoreAcquisitionVideo,godCoreAcquisitionResume,godCoreAcquisitionPause);fieldRoot.append(godCoreAcquisition);
function playGodCoreAcquisitionVideo(){
 if(!godCoreAcquisitionActive||godCoreAcquisitionPaused)return;
 const session=godCoreAcquisitionSession;godCoreAcquisitionResume.hidden=true;
 godCoreAcquisitionVideo.play().catch(()=>{if(godCoreAcquisitionActive&&!godCoreAcquisitionPaused&&session===godCoreAcquisitionSession)godCoreAcquisitionResume.hidden=false;});
}
function beginGodCoreAcquisition(){
 if(!fieldIsGodCore()||!fieldActive||fieldRetroWave<15||godCoreAcquisitionSeen||godCoreAcquisitionActive)return false;
 pauseField();godCoreAcquisitionWatchPosition=0;godCoreAcquisitionVideo.playbackRate=1;godCoreAcquisitionActive=true;godCoreAcquisitionPaused=false;godCoreAcquisitionSession++;
 fieldPausePanel.hidden=true;fieldSettings.hidden=true;fieldMenu.style.display='none';
 fieldRetroCleared=false;fieldRetroIntermission=0;fieldRetroPending=0;
 fieldRetroEnemies.length=fieldEnemyShots.length=fieldProjectiles.length=fieldGrenades.length=fieldRetroRockets.length=fieldExplosions.length=fieldRetroLabels.length=0;
 for(const sound of fieldShotSounds)sound.pause();fieldShotSounds.clear();
 fieldRetroMusic.pause();godCorePowerAudio.pause();fieldFootsteps.pause();
 cancelRetroARReload();cancelRetroRocketReload();cancelRetroPistolReload();fieldRetroReloading=false;fieldRetroReloadAudio.pause();
 if(fieldRun){fieldRun.wave=fieldRetroWave;queueFieldRunSave();}
 if(!godCoreAcquisitionVideo.hasAttribute('src'))godCoreAcquisitionVideo.src=godCoreAcquisitionSource;
 godCoreAcquisitionVideo.currentTime=0;godCoreAcquisitionVideo.muted=false;godCoreAcquisitionVideo.volume=1;
 godCoreAcquisition.hidden=false;godCoreAcquisitionPause.focus();playGodCoreAcquisitionVideo();return true;
}
function pauseGodCoreAcquisition(){
 if(!godCoreAcquisitionActive)return;
 pauseFieldRunClock();godCoreAcquisitionPaused=true;godCoreAcquisitionVideo.pause();godCoreAcquisition.hidden=true;
 fieldActive=false;fieldPaused=true;fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldPausePanel.hidden=false;renderFieldAdmin();
}
function resumeGodCoreAcquisition(){
 if(!godCoreAcquisitionActive)return;
 pauseFieldRunClock();godCoreAcquisitionPaused=false;fieldPausePanel.hidden=true;fieldSettings.hidden=true;godCoreAcquisition.hidden=false;
 fieldActive=false;fieldPaused=true;fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;
 if(godCoreAcquisitionVideo.ended){finishGodCoreAcquisition();return;}
 playGodCoreAcquisitionVideo();
}
function cancelGodCoreAcquisition(){
 godCoreAcquisitionActive=false;godCoreAcquisitionPaused=false;godCoreAcquisitionSeen=false;godCoreAcquisitionSession++;
 godCoreAcquisitionVideo.pause();godCoreAcquisitionVideo.currentTime=0;godCoreAcquisition.hidden=true;godCoreAcquisitionResume.hidden=true;
}
function finishGodCoreAcquisition(){
 if(!godCoreAcquisitionActive||godCoreAcquisitionPaused||!fieldIsGodCore()||fieldRoot.hidden||!godCoreAcquisitionVideo.ended||godCoreAcquisitionVideo.seeking||!Number.isFinite(godCoreAcquisitionVideo.duration)||godCoreAcquisitionWatchPosition<godCoreAcquisitionVideo.duration-.25)return;
 cancelGodCoreAcquisition();godCoreAcquisitionSeen=true;
 fieldPaused=false;fieldActive=true;fieldPausePanel.hidden=true;fieldSettings.hidden=true;
 fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldLastTime=0;resumeFieldRunClock();beginRetroWave();
 const lock=window.Platdo?.controls?.isMobile?null:fieldCanvas.requestPointerLock?.();lock?.catch(()=>{});
}
// Only uninterrupted playback advances this position. A seek must not grant
// the core early, including through browser media shortcuts.
godCoreAcquisitionVideo.addEventListener('timeupdate',()=>{
 if(godCoreAcquisitionActive&&!godCoreAcquisitionVideo.seeking)godCoreAcquisitionWatchPosition=godCoreAcquisitionVideo.currentTime;
});
godCoreAcquisitionVideo.addEventListener('seeking',()=>{
 if(godCoreAcquisitionActive&&Math.abs(godCoreAcquisitionVideo.currentTime-godCoreAcquisitionWatchPosition)>.04)godCoreAcquisitionVideo.currentTime=godCoreAcquisitionWatchPosition;
});
godCoreAcquisitionVideo.addEventListener('seeked',()=>{
 if(godCoreAcquisitionActive&&!godCoreAcquisitionPaused&&godCoreAcquisitionVideo.paused&&!godCoreAcquisitionVideo.ended)playGodCoreAcquisitionVideo();
});
godCoreAcquisitionVideo.addEventListener('ratechange',()=>{if(godCoreAcquisitionActive&&godCoreAcquisitionVideo.playbackRate!==1)godCoreAcquisitionVideo.playbackRate=1;});
godCoreAcquisitionVideo.addEventListener('contextmenu',event=>event.preventDefault());
godCoreAcquisitionVideo.addEventListener('ended',()=>{if(godCoreAcquisitionVideo.ended)finishGodCoreAcquisition();});
godCoreAcquisitionVideo.addEventListener('error',()=>{if(godCoreAcquisitionActive){godCoreAcquisitionResume.textContent='Retry cutscene';godCoreAcquisitionResume.hidden=false;}});
godCoreAcquisitionResume.onclick=()=>{if(godCoreAcquisitionVideo.error)godCoreAcquisitionVideo.load();playGodCoreAcquisitionVideo();};
godCoreAcquisitionPause.onclick=pauseGodCoreAcquisition;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&godCoreAcquisitionActive)pauseGodCoreAcquisition();});
window.addEventListener('blur',()=>{if(godCoreAcquisitionActive)pauseGodCoreAcquisition();});
window.addEventListener('platdo:beforereset',cancelGodCoreAcquisition);

const godCoreVictorySource='assets/video/godcorevictorysource-539b5921fbd1.mp4';
// The run is already completed and saved before this epilogue starts.
// Watching, pausing, or replaying its media never adds time to a ranked run.
let godCoreVictoryActive=false,godCoreVictoryPaused=false,godCoreVictorySession=0,godCoreVictoryWatchPosition=0;
const godCoreVictory=document.createElement('section');godCoreVictory.id='godCoreVictory';godCoreVictory.hidden=true;
godCoreVictory.setAttribute('role','dialog');godCoreVictory.setAttribute('aria-label','GOD CORE victory cutscene');
godCoreVictory.style.cssText='position:absolute;inset:0;z-index:85;background:#000';
const godCoreVictoryVideo=document.createElement('video');godCoreVictoryVideo.id='godCoreVictoryVideo';
godCoreVictoryVideo.playsInline=true;godCoreVictoryVideo.preload='none';godCoreVictoryVideo.controls=false;
godCoreVictoryVideo.disablePictureInPicture=true;godCoreVictoryVideo.disableRemotePlayback=true;
godCoreVictoryVideo.muted=false;godCoreVictoryVideo.defaultMuted=false;godCoreVictoryVideo.volume=1;
godCoreVictoryVideo.style.cssText='display:block;width:100%;height:100%;object-fit:contain;background:#000';
const godCoreVictoryResume=document.createElement('button');godCoreVictoryResume.id='godCoreVictoryResume';godCoreVictoryResume.hidden=true;
godCoreVictoryResume.textContent='Play ending with sound';
godCoreVictoryResume.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:18px 28px;background:#18181b;color:white;border:1px solid #f25336;font:bold 18px sans-serif;cursor:pointer';
const godCoreVictoryPause=document.createElement('button');godCoreVictoryPause.id='godCoreVictoryPause';godCoreVictoryPause.textContent='Pause';
godCoreVictoryPause.style.cssText='position:absolute;left:20px;top:20px;padding:10px 16px;background:#000a;color:white;border:1px solid #ffffff55;font:600 14px sans-serif;cursor:pointer';
godCoreVictory.append(godCoreVictoryVideo,godCoreVictoryResume,godCoreVictoryPause);fieldRoot.append(godCoreVictory);
function playGodCoreVictoryVideo(){
 if(!godCoreVictoryActive||godCoreVictoryPaused)return;
 const session=godCoreVictorySession;godCoreVictoryResume.hidden=true;
 godCoreVictoryVideo.play().catch(()=>{if(godCoreVictoryActive&&session===godCoreVictorySession){godCoreVictoryResume.textContent='Play ending with sound';godCoreVictoryResume.hidden=false;}});
}
function beginGodCoreVictory(){
 if(!fieldIsGodCore()||fieldRoot.hidden||godCoreVictoryActive)return;
 pauseField();stopGodCorePower();godCoreVictoryActive=true;godCoreVictoryPaused=false;godCoreVictorySession++;godCoreVictoryWatchPosition=0;
 fieldActive=false;fieldPaused=true;fieldMenu.style.display='none';fieldPausePanel.hidden=true;fieldSettings.hidden=true;
 fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldAimToggled=false;
 fieldFootsteps.pause();fieldRetroMusic.pause();for(const sound of fieldShotSounds)sound.pause();fieldShotSounds.clear();
 godCoreVictoryPause.textContent='Pause';godCoreVictoryResume.textContent='Play ending with sound';
 if(!godCoreVictoryVideo.hasAttribute('src'))godCoreVictoryVideo.src=godCoreVictorySource;
 godCoreVictoryVideo.currentTime=0;godCoreVictoryVideo.playbackRate=1;godCoreVictoryVideo.muted=false;godCoreVictoryVideo.volume=1;
 godCoreVictory.hidden=false;godCoreVictoryPause.focus();playGodCoreVictoryVideo();
}
function pauseGodCoreVictory(){
 if(!godCoreVictoryActive)return;
 godCoreVictoryPaused=true;godCoreVictoryVideo.pause();godCoreVictoryPause.textContent='Resume';
 godCoreVictoryResume.textContent='Resume ending with sound';godCoreVictoryResume.hidden=false;
 fieldActive=false;fieldPaused=true;fieldKeys.clear();clearFieldMobileInput();
}
function resumeGodCoreVictory(){
 if(!godCoreVictoryActive)return;
 godCoreVictoryPaused=false;godCoreVictoryPause.textContent='Pause';
 fieldActive=false;fieldPaused=true;fieldPausePanel.hidden=true;fieldSettings.hidden=true;
 if(godCoreVictoryVideo.error)godCoreVictoryVideo.load();
 if(godCoreVictoryVideo.ended){finishGodCoreVictory();return;}
 playGodCoreVictoryVideo();
}
function cancelGodCoreVictory(){
 godCoreVictoryActive=false;godCoreVictoryPaused=false;godCoreVictorySession++;godCoreVictoryWatchPosition=0;
 godCoreVictoryVideo.pause();godCoreVictoryVideo.currentTime=0;godCoreVictory.hidden=true;godCoreVictoryResume.hidden=true;
}
function finishGodCoreVictory(){
 if(!godCoreVictoryActive||godCoreVictoryPaused||!fieldIsGodCore()||fieldRoot.hidden||!godCoreVictoryVideo.ended||godCoreVictoryVideo.seeking||!Number.isFinite(godCoreVictoryVideo.duration)||godCoreVictoryWatchPosition<godCoreVictoryVideo.duration-.25)return;
 fieldToMenu();document.getElementById('fieldStatus').textContent='GOD CORE complete. Platdo City unlocked.';
}
godCoreVictoryVideo.addEventListener('timeupdate',()=>{if(godCoreVictoryActive&&!godCoreVictoryVideo.seeking)godCoreVictoryWatchPosition=godCoreVictoryVideo.currentTime;});
godCoreVictoryVideo.addEventListener('seeking',()=>{if(godCoreVictoryActive&&Math.abs(godCoreVictoryVideo.currentTime-godCoreVictoryWatchPosition)>.04)godCoreVictoryVideo.currentTime=godCoreVictoryWatchPosition;});
godCoreVictoryVideo.addEventListener('seeked',()=>{if(godCoreVictoryActive&&!godCoreVictoryPaused&&godCoreVictoryVideo.paused&&!godCoreVictoryVideo.ended)playGodCoreVictoryVideo();});
godCoreVictoryVideo.addEventListener('ratechange',()=>{if(godCoreVictoryActive&&godCoreVictoryVideo.playbackRate!==1)godCoreVictoryVideo.playbackRate=1;});
godCoreVictoryVideo.addEventListener('contextmenu',event=>event.preventDefault());
godCoreVictoryVideo.addEventListener('ended',finishGodCoreVictory);
godCoreVictoryVideo.addEventListener('error',()=>{if(godCoreVictoryActive){godCoreVictoryResume.textContent='Retry ending with sound';godCoreVictoryResume.hidden=false;}});
godCoreVictoryResume.onclick=resumeGodCoreVictory;
godCoreVictoryPause.onclick=()=>godCoreVictoryPaused?resumeGodCoreVictory():pauseGodCoreVictory();
document.addEventListener('visibilitychange',()=>{if(document.hidden&&godCoreVictoryActive)pauseGodCoreVictory();});
window.addEventListener('blur',()=>{if(godCoreVictoryActive)pauseGodCoreVictory();});
window.addEventListener('platdo:beforereset',cancelGodCoreVictory);

function startFieldGameplay(){cancelGodCoreVictory();fieldPreviewMap=null;fieldRendererFailed=false;if(!initFieldRenderer())return;fieldActive=true;syncFieldRetroMusic();if(fieldPractice){fieldWave=1;fieldWaveHits=0;fieldTarget=null;fieldLastTarget=null;fieldSpawnDelay=0;}if(fieldFriendly&&!fieldIsRetroMode()){fieldPose={x:0,z:9,yaw:0,pitch:-.12};fieldHeight=1.7;fieldVelocity=0;fieldLean=0;fieldCrouchOffset=0;}startFieldRun();fieldPlayerHealth=100;fieldEnemyShots.length=0;fieldCombatMessage="";if(fieldIsRetroMode())startRetroRun();else if(fieldMode==='normal'){fieldPose.x=0;fieldPose.z=fieldFriendly?9:0;fieldPose.yaw=0;fieldPose.pitch=fieldFriendly?-.12:0;fieldHeight=1.7;fieldVelocity=0;fieldCrouchOffset=0;fieldLean=0;fieldShotCooldown=0;fieldRetroEnemies.length=0;startNormalWaves();}else if(fieldMode==='tutorial')startFieldTutorial();else fieldEnemy=null;if(!fieldAvailableWeapons().includes(fieldEquipped))fieldEquipped=fieldAvailableWeapons()[0];updateFieldCombatHUD();if(fieldPractice&&!fieldTarget&&fieldWaveHits===0){spawnFieldTarget();}fieldPracticeHUD();fieldMenu.style.display='none';fieldSettings.hidden=true;document.getElementById('fieldInventory').hidden=false;renderFieldInventory();document.getElementById('fieldCrosshair').hidden=false;document.getElementById('fieldMenuBtn').hidden=false;const lock=window.Platdo?.controls?.isMobile?null:fieldCanvas.requestPointerLock?.();lock?.catch(()=>{document.getElementById('fieldStatus').textContent='Click the field to capture the mouse.';});}
document.getElementById('fieldPlay').onclick=()=>{if(fieldIsGodCore())beginGodCoreIntro();else startFieldGameplay();};
fieldCanvas.onclick=()=>{if(fieldActive){const lock=window.Platdo?.controls?.isMobile?null:fieldCanvas.requestPointerLock?.();lock?.catch(()=>{});}};
document.getElementById('fieldMenuBtn').onclick=pauseField;document.getElementById('fieldBack').onclick=()=>location.hash='';
document.getElementById('fieldSettingsBtn').onclick=()=>{fieldMenu.style.display='none';fieldSettings.hidden=false;fieldBinding=null;renderFieldLoadout();document.getElementById('fieldBindPrompt').textContent='';renderFieldBinds();};
document.getElementById('fieldSettingsBack').onclick=()=>{if(fieldPaused){fieldSettings.hidden=true;fieldPausePanel.hidden=false;fieldBinding=null;}else fieldToMenu();};document.getElementById('fieldCrouchMode').onchange=event=>{fieldCrouchMode=event.target.value;fieldCrouchToggled=false;saveField();};
document.getElementById('fieldSprintMode').onchange=event=>{fieldSprintMode=event.target.value==='toggle'?'toggle':'hold';fieldSprintToggled=false;saveField();};
document.getElementById('fieldAimMode').onchange=event=>{fieldAimMode=event.target.value;fieldAimToggled=false;saveField();};
document.getElementById('fieldRestoreBinds').onclick=()=>{fieldBindings=structuredClone(fieldDefaults);fieldSprintMode='hold';fieldSprintToggled=false;fieldCrouchMode='hold';fieldCrouchToggled=false;fieldAimMode='hold';fieldAimToggled=false;fieldBinding=null;renderFieldBinds();saveField();};
window.addEventListener('keydown',event=>{if(document.querySelector('.pg-backdrop')||fieldRoot.hidden||!resetOverlay.hidden)return;if(window.Platdo?.controls?.isMobile&&!event.target.matches('input,textarea,select,[contenteditable="true"]'))return;event.stopImmediatePropagation();if(fieldPaused&&fieldAdminPanel.contains(event.target)){if(event.code==='Escape'){event.preventDefault();event.target.blur();}return;}if(godCoreVictoryActive){if(event.code==='Escape'||event.code==='Space'){event.preventDefault();if(!event.repeat){if(godCoreVictoryPaused)resumeGodCoreVictory();else pauseGodCoreVictory();}}return;}if(godCoreAcquisitionActive){if(event.code==='Escape'){event.preventDefault();if(godCoreAcquisitionPaused)resumeGodCoreAcquisition();else pauseGodCoreAcquisition();}return;}if(godCoreIntroActive){if(event.code==='Escape'){event.preventDefault();fieldToMenu();}return;}if(event.code==='Escape'){event.preventDefault();if(fieldActive)pauseField();else if(fieldPaused){fieldSettings.hidden=true;fieldBinding=null;fieldPausePanel.hidden=false;}else if(!fieldSettings.hidden)fieldToMenu();else if(performance.now()-fieldUnlockTime>=200)location.hash='';return;}if(fieldBinding){event.preventDefault();captureFieldBind(event.code);return;}if(!fieldActive&&!event.repeat&&!fieldBinding){if(fieldBindings.songPrevious.includes(event.code))skipFieldMusic(-1);if(fieldBindings.songNext.includes(event.code))skipFieldMusic(1);}if(fieldActive){event.preventDefault();if(!event.repeat)fieldInventoryInput(event.code);fieldKeys.add(event.code);}},true);
window.addEventListener('keyup',event=>{if(document.querySelector('.pg-backdrop')||fieldRoot.hidden)return;fieldKeys.delete(event.code);event.stopImmediatePropagation();},true);
window.addEventListener('mousedown',event=>{if(fieldRoot.hidden||window.Platdo?.controls?.isMobile)return;if(fieldPaused&&fieldAdminPanel.contains(event.target))return;if(fieldBinding){event.preventDefault();event.stopImmediatePropagation();captureFieldBind('Mouse'+event.button);}else if(!fieldActive){const code='Mouse'+event.button;if(fieldBindings.songPrevious.includes(code))skipFieldMusic(-1);if(fieldBindings.songNext.includes(code))skipFieldMusic(1);}else if(fieldActive&&event.target===fieldCanvas){fieldInventoryInput('Mouse'+event.button);fieldKeys.add('Mouse'+event.button);}},true);
window.addEventListener('mouseup',event=>fieldKeys.delete('Mouse'+event.button));
fieldRoot.addEventListener('contextmenu',event=>event.preventDefault());
fieldRoot.addEventListener('wheel',event=>{if(window.Platdo?.controls?.isMobile)return;if(fieldPaused&&fieldAdminPanel.contains(event.target))return;if(fieldBinding){event.preventDefault();captureFieldBind(event.deltaY<0?'WheelUp':'WheelDown');}else if(!fieldActive){const code=event.deltaY<0?'WheelUp':'WheelDown';if(fieldBindings.songPrevious.includes(code)){event.preventDefault();skipFieldMusic(-1);}if(fieldBindings.songNext.includes(code)){event.preventDefault();skipFieldMusic(1);}}else if(fieldActive){event.preventDefault();const code=event.deltaY<0?'WheelUp':'WheelDown';fieldInventoryInput(code);fieldKeys.add(code);setTimeout(()=>fieldKeys.delete(code),100);}},{passive:false});
// Pointer-lock acquisition can report a cursor-warp delta; never turn the camera with it.
let fieldLookReadyAt=0,fieldLookPrimed=false;
function resetFieldLookInput(){fieldLookPrimed=false;fieldLookReadyAt=performance.now()+40;}
function fieldHandleMouseLook(event){
 if(window.Platdo?.controls?.isMobile||!fieldActive||document.pointerLockElement!==fieldCanvas)return false;
 const dx=event.movementX,dy=event.movementY;
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||(!dx&&!dy))return false;
 if(performance.now()<fieldLookReadyAt)return false;
 if(!fieldLookPrimed){fieldLookPrimed=true;return false;}
 const distance=Math.hypot(dx,dy);if(distance>4096)return false;
 const sensitivity=(.0025*fieldLookSensitivity)/fieldAimZoom();
 // Ordinary and fast mouse movement stay exact. Only a single event above ~26 degrees is capped.
 const scale=Math.min(1,.45/(distance*sensitivity));
 fieldPose.yaw+=dx*sensitivity*scale;
 fieldPose.pitch=Math.max(-1.5,Math.min(1.5,fieldPose.pitch-dy*sensitivity*scale));
 queueFieldSave();return true;
}
document.addEventListener('mousemove',fieldHandleMouseLook);
document.addEventListener('pointerlockchange',()=>{resetFieldLookInput();if(window.Platdo?.controls?.isMobile){if(document.pointerLockElement===fieldCanvas)document.exitPointerLock();return;}if(!fieldActive&&document.pointerLockElement===fieldCanvas){document.exitPointerLock();return;}if(fieldActive&&document.pointerLockElement!==fieldCanvas){fieldUnlockTime=performance.now();pauseField();}});
window.addEventListener('blur',()=>{if(fieldActive)pauseField();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(fieldActive)pauseField();else saveField();}});
const fieldMapSelectAudio="assets/audio/fieldmapselectaudio-254e4ae8758b.mp3";
function playFieldMapSelectSound(){const sound=new Audio(fieldMapSelectAudio);sound.volume=fieldAudioVolume(fieldMapSelectAudio);sound.play().catch(()=>{});}
const fieldMapHoverAudio="assets/audio/fieldmaphoveraudio-95591ddb2d32.mp3";
function playFieldMapHoverSound(){const sound=new Audio(fieldMapHoverAudio);sound.volume=fieldAudioVolume(fieldMapHoverAudio);sound.play().catch(()=>{});}
function renderFieldMapChoices(){
 const choices=document.getElementById('fieldMapChoices');choices.replaceChildren();
 choices.hidden=false;choices.style.display='flex';choices.setAttribute('aria-label',fieldIsGodCore()?'Arena information':'Choose a map');
 if(fieldIsGodCore()){
  fieldRetroMap='godcore';fieldPreviewRetroMap=null;
  document.getElementById('fieldMapCaption').textContent='THE CRUCIBLE · Reactor hall';
  const info=document.createElement('span');info.textContent='Two flanking routes. Shoot the relay to hold the side doors open.';info.style.cssText='font:11px/1.7 Consolas,monospace;color:#b9b1a6;letter-spacing:.3px';choices.append(info);return;
 }

 if(fieldFriendly&&!fieldIsRetroMode()){fieldPreviewMap=null;fieldPreviewRetroMap=null;const button=document.createElement('button');button.className='code-home-tag';button.dataset.friendlyMap='pool';button.textContent='Sunny Pool House';button.setAttribute('aria-pressed','true');button.style.cssText='padding:10px 13px;font-size:12px;background:#b8e68b;color:#173a34';button.onclick=playFieldMapSelectSound;choices.append(button);document.getElementById('fieldMapCaption').textContent='Friendly map · Pool, house and garden';return;}

 if(fieldIsRetroMode()){
 const caption=document.getElementById('fieldMapCaption');
 for(const [id,map] of Object.entries(fieldRetroMaps)){if(id==='godcore')continue;const button=document.createElement('button');button.className='code-home-tag';button.dataset.retroMap=id;button.textContent=map.name;button.setAttribute('aria-pressed',String(id===fieldRetroMap));button.style.cssText='padding:10px 13px;font-size:12px;background:'+(id===fieldRetroMap?'#456333':'#14241bd9');const clear=()=>{fieldPreviewRetroMap=null;caption.textContent='Selected: '+fieldRetroMaps[fieldRetroMap].name+' · '+fieldRetroMaps[fieldRetroMap].description;};button.onpointerenter=()=>{fieldPreviewRetroMap=id;caption.textContent='Preview: '+map.name+' · '+map.description;playFieldMapHoverSound();};button.onpointerleave=clear;button.onfocus=()=>{fieldPreviewRetroMap=id;caption.textContent='Preview: '+map.name;};button.onblur=clear;button.onclick=()=>{playFieldMapSelectSound();selectRetroMap(id);};choices.append(button);}
 caption.textContent='Selected: '+fieldRetroMaps[fieldRetroMap].name+' · '+fieldRetroMaps[fieldRetroMap].description;return;
 }
 fieldPreviewRetroMap=null;
 for(const [id,map] of Object.entries(fieldMaps)){
  const button=document.createElement('button');button.type='button';button.dataset.map=id;button.textContent=map.name;button.setAttribute('aria-pressed',String(id===fieldSelectedMap));button.style.cssText='padding:10px 13px;border:1px solid '+(id===fieldSelectedMap?'#c5ed81':'#ffffff44')+';border-radius:6px;background:'+(id===fieldSelectedMap?'#c5ed8122':'#10271855')+';color:white;cursor:pointer;font-size:12px;letter-spacing:0';
  const preview=()=>{fieldPreviewMap=id;document.getElementById('fieldMapCaption').textContent='Preview: '+map.name+' · Click to select';};
  const clear=()=>{fieldPreviewMap=null;document.getElementById('fieldMapCaption').textContent='Selected: '+fieldMaps[fieldSelectedMap].name+' · Hover to preview';};
  button.onpointerenter=event=>{preview();if(event.pointerType!=='touch')playFieldMapHoverSound();};button.onpointerleave=clear;button.onfocus=preview;button.onblur=clear;
  button.onclick=()=>{playFieldMapSelectSound();fieldSelectedMap=id;fieldPreviewMap=null;fieldImpacts.length=0;fieldPose={x:0,z:0,yaw:0,pitch:0};saveField();renderFieldMapChoices();};choices.append(button);
 }
 document.getElementById('fieldMapCaption').textContent='Selected: '+fieldMaps[fieldSelectedMap].name+' · Hover to preview';
}
renderFieldMapChoices();
const fieldAudioClips=[['friendlyTowel','Friendly towel','environment',fieldFriendlyTowelSource],['friendlyRefill','Friendly water refill','environment',fieldFriendlyRefillSource],['friendlyEnemyDeath','Friendly enemy splash','environment',fieldFriendlyDeathAudio],['retroReload','Retro shotgun reload','weapons',fieldRetroReloadSource],['retroARReload','Retro / GOD CORE AR reload','weapons',fieldRetroARReloadSource],['retroRocketReload','Retro / GOD CORE rocket reload','weapons',fieldRetroRocketReloadSource],['grenadeExplosion','Retro grenade explosion','weapons',fieldGrenadeExplosionAudio],['retroEnemy','Retro enemy laser','weapons',fieldRetroEnemyAudio],['retroShotgun','Retro shotgun','weapons',fieldRetroShotgunAudio],['hurt','Player hit','environment',fieldHurtAudio],['enemyShot','Enemy shots','weapons',fieldEnemyShotAudio],['normalPistol','Normal pistol shots','weapons',fieldPistolShotAudio],['pistol','Retro / Friendly pistol shots','weapons',fieldPistolShotAudio],['ar','AR shots','weapons',fieldARShotAudio],['sniper','Sniper shots','weapons',fieldSniperShotAudio],['shotgun','Shotgun shots','weapons',fieldShotgunShotAudio],['footsteps','Footsteps','environment',fieldFootsteps.src],['land','Landing','environment',fieldLandAudio],['hit','Target / enemy hit','sfx',fieldTargetHitAudio],['wave','Wave completed','sfx',fieldWaveAudio],['mapSelect','Map selected','sfx',fieldMapSelectAudio],['mapHover','Map hovered','sfx',fieldMapHoverAudio]];
function fieldAudioClipDefault(id){return id==='normalPistol'?50:100;}
function fieldAudioVolume(source,clipId=null){
 if((!clipId&&source===fieldPistolShotAudio)||clipId==='pistol')clipId=!fieldFriendly&&!fieldIsRetroMode()?'normalPistol':'pistol';
 const clip=clipId?fieldAudioClips.find(c=>c[0]===clipId):fieldAudioClips.find(c=>c[0]!=='enemyShot'&&c[3]===source);if(!clip)return 1;
 const defaultVolume=fieldAudioClipDefault(clip[0]);
 return (fieldAudio.custom?(Number.isFinite(fieldAudio.advanced[clip[0]])?fieldAudio.advanced[clip[0]]:defaultVolume):fieldAudio.basic[clip[2]]*defaultVolume/100)/100;
}
let fieldAudioTab='basic',fieldAudioCategory='weapons';
function saveFieldAudio(){if(fieldSaving)fieldStorage.set('audio',JSON.stringify(fieldAudio));fieldFootsteps.volume=fieldAudioVolume(fieldFootsteps.src);fieldRetroRocketReloadAudio.volume=fieldAudioVolume(fieldRetroRocketReloadSource,'retroRocketReload');}
function renderFieldAudio(){const panel=document.getElementById('fieldAudioPanel');panel.replaceChildren();const heading=document.createElement('h2');heading.textContent='Audio';heading.style.cssText='font-size:30px;margin:20px 0';panel.append(heading);const tabs=document.createElement('nav');for(const value of ['basic','advanced']){const b=document.createElement('button');b.textContent=value==='basic'?'Basic':'Advanced';b.className='code-home-tag';b.style.background=fieldAudioTab===value?'#345270':'transparent';b.setAttribute('aria-pressed',String(fieldAudioTab===value));b.onclick=()=>{fieldAudioTab=value;renderFieldAudio();};tabs.append(b);}panel.append(tabs);if(!fieldIsGodCore()){panel.append(makeFieldFriendlyToggle());const friendlyNote=document.createElement('p');friendlyNote.textContent='Friendly adds water guns, squirt sounds, cheerful opponents, and a Wetness meter. The Friendly pistol cannot aim. Practice gunfire stays silent.';friendlyNote.style.cssText='margin:8px 0 18px;color:#bdc9c1';panel.append(friendlyNote);}renderFieldPlaylistSettings(panel);
function slider(id,label,value,disabled,change){const row=document.createElement('label');row.style.cssText='display:block;margin:24px 0;opacity:'+(disabled?.4:1);const title=document.createElement('span');title.textContent=label+' ';const out=document.createElement('output');out.textContent=value+'%';const input=document.createElement('input');input.type='range';input.min=0;input.max=100;input.value=value;input.disabled=disabled;input.id='fieldAudio-'+id;input.style.cssText='display:block;width:100%;margin-top:12px';input.oninput=()=>{out.textContent=input.value+'%';change(Number(input.value));saveFieldAudio();};row.append(title,out,input);panel.append(row);}
if(fieldAudioTab==='basic'){const reset=document.createElement('button');reset.textContent='Reset Advanced Audio Settings';reset.className='code-home-tag';reset.style.marginTop='20px';reset.onclick=()=>{fieldAudio.advanced={};fieldAudio.custom=false;saveFieldAudio();renderFieldAudio();};panel.append(reset);const p=document.createElement('p');p.style.marginTop='12px';p.textContent=fieldAudio.custom?'Basic controls are locked. Reset Advanced Audio Settings to restore individual defaults (Normal pistol: 50%; other sounds: 100%) and enable basic controls.':'Changing an advanced slider locks all basic controls until you reset advanced audio. 0% mutes; 100% is full volume.';panel.append(p);for(const [id,label] of [['weapons','Weapons — all gunshots, including enemy shots'],['environment','Environment — footsteps, landing and getting hit'],['sfx','SFX — target hits, wave completion and map buttons']])slider(id,label,fieldAudio.basic[id],fieldAudio.custom,v=>fieldAudio.basic[id]=v);
}else{const categories=document.createElement('nav');categories.style.marginTop='18px';for(const id of ['weapons','environment','sfx']){const b=document.createElement('button');b.textContent=id==='sfx'?'SFX':id[0].toUpperCase()+id.slice(1);b.className='code-home-tag';b.style.background=fieldAudioCategory===id?'#345270':'transparent';b.setAttribute('aria-pressed',String(fieldAudioCategory===id));b.onclick=()=>{fieldAudioCategory=id;renderFieldAudio();};categories.append(b);}panel.append(categories);const note=document.createElement('p');note.textContent='Individual controls replace basic volumes. Reset advanced audio in Basic to unlock the basic sliders again.';note.style.marginTop='16px';panel.append(note);for(const [id,label,category] of fieldAudioClips)if(category===fieldAudioCategory)slider(id,label,Number.isFinite(fieldAudio.advanced[id])?fieldAudio.advanced[id]:fieldAudioClipDefault(id),false,v=>{fieldAudio.advanced[id]=v;fieldAudio.custom=true;});}}
renderFieldAudio();
function addSettingsReset(parent,label,reset){const button=document.createElement('button');button.textContent='Reset settings to defaults';button.style.cssText='display:block;padding:12px;border:1px solid #899b91;border-radius:8px;margin:20px 0';button.onclick=()=>{if(confirm('Are you sure you want to reset '+(typeof label==='function'?label():label)+' settings? Progress, scores, unlocks and other games will stay unchanged.'))reset();};parent.append(button);}
addSettingsReset(document.getElementById('main-save-panel'),'main PLATDO',()=>{if(resolutionTrial)finishResolutionTrial(false);targetFps=60;Platdo.controls.setMode(Platdo.controls.defaultMode);mainSettings.autoSaveMinutes=5;mainSettings.resolution='auto';mainSettings.menuMusicVolume=DEFAULT_MENU_MUSIC_VOLUME;mainSettings.menuMusicMuted=false;lastAudibleMenuVolume=DEFAULT_MENU_MUSIC_VOLUME;document.getElementById('fpsSelect').value='60';document.getElementById('resolutionSelect').value='auto';document.getElementById('autoSaveSelect').value='5';document.getElementById('menuMusicVolume').value=mainSettings.menuMusicVolume;document.getElementById('menuMusicValue').textContent=mainSettings.menuMusicVolume+'%';applyMenuMusicSettings();schedulePeriodicSave();saveMainSettings();window.dispatchEvent(new Event('platdo:settingschange'));});
addSettingsReset(document.getElementById('settingsModal').firstElementChild,'PLATDO jump!',()=>{const defaults={left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],up:['Space','KeyW','ArrowUp'],fire:['KeyE'],previous:['WheelUp','BracketLeft'],next:['WheelDown','BracketRight'],pause:['KeyP']};for(const id in defaults)bindings[id]=defaults[id];weaponOrder=['none','sniper','pistol','ak48','nuke'];soundEnabled=true;audioSettings.advanced=false;for(const key of ['environment','sfx','weapons','music'])audioSettings[key]=100;for(const key in audioSettings.individual)audioSettings.individual[key]=100;pendingBinding=null;resetControls();saveControls();saveAudioSettings();applyAudioSettings();renderAudioSettings();refreshBindings();renderInventoryOrder();soundToggleBtn.textContent='🔊';saveFullProgress();});
addSettingsReset(document.getElementById('fieldSettings').firstElementChild,fieldGameName,()=>{setFieldFriendly(false);for(const id in fieldDefaults)fieldBindings[id]=[...fieldDefaults[id]];fieldSprintMode=fieldAimMode=fieldCrouchMode='hold';fieldLookSensitivity=1;fieldClockFormat='12h';renderFieldGameSettings();if(!fieldRunsPanel.hidden)renderFieldRuns();fieldLoadout=['pistol','ar','sniper','shotgun'];fieldRetroLoadout=['pistol','ar','rocket','shotgun','grenade'];fieldAudio={basic:{weapons:100,environment:100,sfx:100},advanced:{},custom:false};fieldMusicSettings={enabled:true,volume:100,skip:{retro:[],normal:[]},index:{retro:0,normal:0}};fieldMusicPausedByUser=false;fieldBinding=null;fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldAimToggled=fieldCrouchToggled=false;fieldStorage.set('loadout',JSON.stringify(fieldLoadout));fieldStorage.set('retro-loadout',JSON.stringify(fieldRetroLoadout));saveFieldAudio();saveFieldMusic();saveField();renderFieldBinds();renderFieldLookSensitivity();renderFieldLoadout();renderFieldAudio();syncFieldRetroMusic();});
function renderFieldGameSettings(){document.getElementById('fieldClockFormat').value=fieldClockFormat;document.getElementById('fieldClockExample').textContent=fieldClockFormat==='24h'?'Example: 15:45':'Example: 3:45 PM · Default';}
document.getElementById('fieldClockFormat').onchange=event=>{fieldClockFormat=event.target.value==='24h'?'24h':'12h';renderFieldGameSettings();saveField();if(!fieldRunsPanel.hidden)renderFieldRuns();};
renderFieldGameSettings();
function formatFieldRunDate(value){if(typeof value!=='string'||!value)return '—';const date=new Date(value);if(!Number.isFinite(date.getTime()))return '—';const hours=date.getHours(),minutes=String(date.getMinutes()).padStart(2,'0'),seconds=String(date.getSeconds()).padStart(2,'0'),clock=fieldClockFormat==='24h'?String(hours).padStart(2,'0')+':'+minutes+':'+seconds:(hours%12||12)+':'+minutes+':'+seconds+(hours>=12?' PM':' AM');return String(date.getMonth()+1).padStart(2,'0')+'/'+String(date.getDate()).padStart(2,'0')+'/'+date.getFullYear()+' '+clock;}
const fieldSettingsTabs=[...document.querySelectorAll('[data-field-settings]')];
function selectFieldSettingsTab(tab){if(tab.dataset.fieldSettings==='game')renderFieldGameSettings();if(tab.dataset.fieldSettings==='loadout')renderFieldLoadout();fieldBinding=null;document.getElementById('fieldBindPrompt').textContent='';for(const button of fieldSettingsTabs){const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.style.background=active?'#345270':'transparent';document.getElementById(button.getAttribute('aria-controls')).hidden=!active;}}
fieldSettingsTabs.forEach((tab,i)=>{tab.onclick=()=>selectFieldSettingsTab(tab);tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=fieldSettingsTabs[event.key==='Home'?0:event.key==='End'?fieldSettingsTabs.length-1:(i+(event.key==='ArrowLeft'?-1:1)+fieldSettingsTabs.length)%fieldSettingsTabs.length];selectFieldSettingsTab(next);next.focus();};});selectFieldSettingsTab(fieldSettingsTabs[0]);
function renderFieldLookSensitivity(){document.getElementById('fieldLookSlider').value=fieldLookSensitivity;document.getElementById('fieldLookValue').textContent=Math.round(fieldLookSensitivity*100)+'%';}
document.getElementById('fieldLookSlider').oninput=event=>{fieldLookSensitivity=Number(event.target.value);renderFieldLookSensitivity();saveField();};
document.getElementById('fieldLookReset').onclick=()=>{fieldLookSensitivity=1;renderFieldLookSensitivity();saveField();};renderFieldLookSensitivity();
const fieldTile=document.createElement('button');fieldTile.id='openFieldBtn';fieldTile.className='hub-tile';fieldTile.style.cssText='background:#000;padding:0;overflow:hidden';fieldTile.setAttribute('aria-label','Open code PLATDO');fieldTile.innerHTML='<img alt="code PLATDO — Aim practice and run history" style="width:100%;height:100%;object-fit:contain" src="assets/images/image-9d1015dc5dd2.png">';fieldTile.onclick=()=>{Platdo.playGameOpenSound();location.hash='field';};document.querySelector('div.hub-tile').replaceWith(fieldTile);


// The renderer and assets are shared; settings and run history belong to each
// registered mini-game. Cache profiles too, so a failed storage write cannot lose
// an outgoing game's in-memory results during navigation.
function persistInactiveFieldRunHistories(){
 if(!fieldSaving)return;
 for(const [identity,profile] of fieldGameProfiles){
  if(identity===fieldGameIdentity||!profile.fieldRunHistoryDirty)continue;
  try{Platdo.storage(identity).set('runs',JSON.stringify(profile.fieldRuns));profile.fieldRunHistoryDirty=false;profile.fieldRunSaveError='';}catch(_){}
 }
}
function loadFieldGameProfile(){
 fieldAudio={basic:{weapons:100,environment:100,sfx:100},advanced:{},custom:false};
 fieldMusicSettings={enabled:true,volume:100,skip:{retro:[],normal:[]},index:{retro:0,normal:0}};
 fieldLoadout=['pistol','ar','sniper','shotgun'];fieldRetroLoadout=['pistol','ar','rocket','shotgun','grenade'];fieldSkins={};
 fieldBindings=structuredClone(fieldDefaults);fieldPose={x:0,z:0,yaw:0,pitch:0};
 fieldMode='normal';fieldPractice=false;fieldLookSensitivity=1;fieldClockFormat='12h';fieldSelectedMap='grass';
 fieldSprintMode=fieldCrouchMode=fieldAimMode='hold';fieldEquipped='pistol';
 try{const a=JSON.parse(fieldStorage.get('audio')||'null');if(a){for(const k in fieldAudio.basic)if(Number.isFinite(a.basic?.[k]))fieldAudio.basic[k]=Math.max(0,Math.min(100,a.basic[k]));fieldAudio.advanced=a.advanced||{};if(!Number.isFinite(fieldAudio.advanced.normalPistol)&&Number.isFinite(fieldAudio.advanced.pistol))fieldAudio.advanced.normalPistol=Math.max(0,Math.min(100,fieldAudio.advanced.pistol));fieldAudio.custom=a.custom===true;}}catch(_){}
 try{const saved=JSON.parse(fieldStorage.get('music')||'null');if(saved){fieldMusicSettings.enabled=saved.enabled!==false;fieldMusicSettings.volume=Math.max(0,Math.min(100,(Number.isFinite(Number(saved.volume))?Number(saved.volume):100)));for(const mode of ['retro','normal']){fieldMusicSettings.skip[mode]=Array.isArray(saved.skip?.[mode])?saved.skip[mode]:[];fieldMusicSettings.index[mode]=Number(saved.index?.[mode])||0;}}}catch(_){}
 try{const order=JSON.parse(fieldStorage.get('loadout')||'null');if(Array.isArray(order)){fieldLoadout=[...new Set(order.filter(id=>Object.hasOwn(fieldWeaponNames,id)))];for(const id of Object.keys(fieldWeaponNames))if(!fieldLoadout.includes(id))fieldLoadout.push(id);}const skins=JSON.parse(fieldStorage.get('skins')||'{}');for(const id in fieldWeaponNames)fieldSkins[id]=Object.hasOwn(fieldSkinStyles,skins[id])?skins[id]:'default';}catch(_){}
 try{const order=JSON.parse(fieldStorage.get('retro-loadout')||'null');if(Array.isArray(order)){const defaults=['pistol','ar','rocket','shotgun','grenade'];fieldRetroLoadout=[...new Set(order.map(id=>id==='sniper'?'rocket':id).filter(id=>defaults.includes(id)))];for(const id of defaults)if(!fieldRetroLoadout.includes(id))fieldRetroLoadout.push(id);}}catch(_){}
 try{const saved=JSON.parse(fieldStorage.get('save')||'null');if(saved){fieldMode=["normal","practice","explore","retro","retro-story","tutorial"].includes(saved.mode)?saved.mode:saved.practice?"practice":"normal";fieldPractice=fieldMode==="practice";fieldClockFormat=saved.clockFormat==='24h'?'24h':'12h';if(Number.isFinite(saved.lookSensitivity))fieldLookSensitivity=Math.max(.1,Math.min(3,saved.lookSensitivity));if(Object.hasOwn(fieldMaps,saved.map))fieldSelectedMap=saved.map;fieldCrouchMode=saved.crouchMode==='toggle'?'toggle':'hold';fieldSprintMode=saved.sprintMode==='toggle'?'toggle':'hold';fieldAimMode=saved.aimMode==='toggle'?'toggle':'hold';if(Object.hasOwn(fieldWeaponNames,saved.equipped))fieldEquipped=saved.equipped;for(const action in fieldDefaults)if(Array.isArray(saved.bindings?.[action]))fieldBindings[action]=[...new Set(saved.bindings[action].filter(v=>typeof v==='string'&&v!=='Escape'&&v.length<50))].slice(0,5);for(const key in fieldPose)if(Number.isFinite(saved.pose?.[key]))fieldPose[key]=saved.pose[key];fieldPose.pitch=Math.max(-1.5,Math.min(1.5,fieldPose.pitch));}}catch(_){}
 fieldFriendly=fieldStorage.get('friendly')==='true';
 fieldRetroMap=Object.hasOwn(fieldRetroMaps,fieldStorage.get('retro-map'))?fieldStorage.get('retro-map'):'reactor';
 loadFieldRunHistory();
}
function switchFieldGameContext(identity){
 identity=identity==='god-core'?'god-core':'field';
 if(!fieldSaving)return;
 if(identity!==fieldGameIdentity){
  fieldToMenu();
  clearTimeout(fieldPendingSave);clearTimeout(fieldRunPendingSave);clearInterval(fieldRunCheckpointTimer);
  fieldPendingSave=fieldRunPendingSave=fieldRunCheckpointTimer=null;fieldRunClockLast=null;
  fieldGameProfiles.set(fieldGameIdentity,{fieldAudio,fieldMusicSettings,fieldLoadout,fieldRetroLoadout,fieldSkins,fieldBindings,fieldPose,fieldMode,fieldPractice,fieldLookSensitivity,fieldClockFormat,fieldSelectedMap,fieldCrouchMode,fieldAimMode,fieldSprintMode,fieldEquipped,fieldFriendly,fieldRetroMap,fieldRuns,fieldRunHistoryDirty,fieldRunSaveError});
  fieldGameIdentity=identity;fieldStorage=Platdo.storage(identity);
  const profile=fieldGameProfiles.get(identity);
  if(profile){({fieldAudio,fieldMusicSettings,fieldLoadout,fieldRetroLoadout,fieldSkins,fieldBindings,fieldPose,fieldMode,fieldPractice,fieldLookSensitivity,fieldClockFormat,fieldSelectedMap,fieldCrouchMode,fieldAimMode,fieldSprintMode,fieldEquipped,fieldFriendly,fieldRetroMap,fieldRuns,fieldRunHistoryDirty,fieldRunSaveError}=profile);}else loadFieldGameProfile();
  fieldCurrentTrack=null;fieldMusicContext='';fieldMusicPausedByUser=false;
  fieldAudioTab='basic';fieldAudioCategory='weapons';fieldRunsTab='practice';fieldRunsVisible=53;
  fieldKeys.clear();clearFieldMobileInput();fieldSprintToggled=false;fieldBinding=null;fieldAimToggled=fieldCrouchToggled=false;
  fieldPreviewMap=fieldPreviewRetroMap=null;fieldEnemy=fieldTarget=null;fieldHeight=1.7;fieldVelocity=0;
  fieldWave=1;fieldWaveHits=0;fieldLastTarget=null;fieldSpawnDelay=0;
  fieldRetroWave=1;fieldRetroPending=0;fieldRetroCleared=false;fieldRetroIntermission=0;
  fieldCombatMessage='';fieldCombatMessageTime=0;fieldPlayerHealth=100;
  document.getElementById('fieldBindPrompt').textContent='';document.getElementById('fieldStatus').textContent='';
 }
 if(fieldIsGodCore()){fieldMode='retro-story';fieldFriendly=false;fieldPractice=false;fieldRetroMap='godcore';fieldPose={x:0,z:12.5,yaw:0,pitch:0};}
 else if(fieldMode==='retro-story'){fieldMode=fieldFriendly?'normal':'retro';fieldPractice=false;}
 if(!fieldIsGodCore()&&fieldRetroMap==='godcore')fieldRetroMap='reactor';
 fieldRoot.classList.toggle('god-core-game',fieldIsGodCore());
 fieldRoot.setAttribute('aria-label',fieldGameName());
 fieldDoors=fieldRetroMaps[fieldRetroMap].doors.map(([x,z,y=0])=>({x,z,y,open:0}));
 for(const input of fieldRoot.querySelectorAll('[data-field-friendly]'))input.checked=fieldFriendly;
 renderFieldModes();renderFieldBinds();renderFieldLookSensitivity();renderFieldGameSettings();renderFieldLoadout();renderFieldAudio();applyFieldSkins();
 selectFieldSettingsTab(fieldSettingsTabs[0]);
 document.getElementById('fieldAimMode').value=fieldAimMode;document.getElementById('fieldCrouchMode').value=fieldCrouchMode;document.getElementById('fieldSprintMode').value=fieldSprintMode;
 document.getElementById('fieldSettingsBack').textContent='← Back to '+fieldGameName();
 document.querySelector('#fieldSettings [role="tablist"]').setAttribute('aria-label',fieldGameName()+' settings');
 if(typeof renderGodCoreIdentity==='function')renderGodCoreIdentity();
}
function isCompletedGodCoreRun(run){return isGodCoreVictory(run)&&run.assisted!==true;}
function compareGodCoreRuns(a,b){return a.seconds-b.seconds;}
function renderGodCoreRuns(){
 fieldRunsPanel.replaceChildren();
 const back=document.createElement('button');back.className='code-home-tag';back.textContent='← Back';back.onclick=()=>fieldRunsPanel.hidden=true;
 const title=document.createElement('h2');title.textContent='GOD CORE · Runs';title.style.cssText='font-size:clamp(28px,5vw,54px);font-weight:900;margin:28px 0 12px';
 const note=document.createElement('p');note.textContent='Completed runs only. Fastest gameplay time ranks first. Cutscenes and pauses do not count. Admin-assisted runs are unranked.';note.style.cssText='margin-bottom:28px;color:#c4bcb8';
 fieldRunsPanel.append(back,title,note);
 const sorted=fieldRuns.filter(isCompletedGodCoreRun).sort(compareGodCoreRuns);
 if(!sorted.length){const empty=document.createElement('p');empty.dataset.godCoreEmpty='';empty.textContent='No completed runs yet. Reach wave 15 and finish the GOD CORE finale to record a time.';empty.style.cssText='border-top:1px solid #58413d;padding-top:28px;font-size:18px;line-height:1.6';fieldRunsPanel.append(empty);return;}
 const wrap=document.createElement('div');wrap.style.overflowX='auto';
 const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;text-align:left';
 const head=document.createElement('tr');for(const label of ['Rank','Time','Completed']){const cell=document.createElement('th');cell.textContent=label;cell.style.padding='16px';head.append(cell);}table.append(head);
 sorted.slice(0,fieldRunsVisible).forEach((run,i)=>{const row=document.createElement('tr');row.dataset.runId=run.id;row.style.borderTop='1px solid #58413d';for(const value of [String(i+1),formatFieldTime(run.seconds),formatFieldRunDate(run.ended)]){const cell=document.createElement('td');cell.textContent=value;cell.style.padding='16px';row.append(cell);}table.append(row);});
 wrap.append(table);fieldRunsPanel.append(wrap);
 if(sorted.length>fieldRunsVisible){const more=document.createElement('button');more.className='code-home-tag';more.textContent='Show more runs';more.onclick=()=>{fieldRunsVisible+=50;renderGodCoreRuns();};fieldRunsPanel.append(more);}
}
window.addEventListener('platdo:beforereset',()=>fieldGameProfiles.clear());


const godCoreTile=document.createElement('button');godCoreTile.id='openGodCoreBtn';godCoreTile.className='hub-tile';
godCoreTile.setAttribute('aria-label','Open platdo god core');
godCoreTile.innerHTML=typeof godCoreTileMarkup==='string'?godCoreTileMarkup:'platdo god core';
godCoreTile.onclick=()=>{Platdo.playGameOpenSound();location.hash='god-core';};
const godCorePlaceholder=document.querySelector('div.hub-tile');
if(godCorePlaceholder)godCorePlaceholder.replaceWith(godCoreTile);else document.querySelector('.hub-grid').append(godCoreTile);

        // Read-only menu preview: uses the same saved world and original renderer.
        // No new save data, animation loop, physics, or duplicate game state.
        function refreshJumpMenuPresentation() {
            const root=document.getElementById('platdoGame');
            if(root.hidden||titleOverlay.classList.contains('hidden'))return;
            const preview=document.getElementById('jumpMenuPreview');
            if(preview&&canvas.width&&canvas.height)preview.getContext('2d').drawImage(canvas,0,0,preview.width,preview.height);
            document.getElementById('jumpPreviewLevel').textContent=isCustomLevel?'CUSTOM LEVEL':`LEVEL ${String(currentLevel+1).padStart(2,'0')}`;
            document.getElementById('jumpPlayLevel').textContent=document.getElementById('jumpPreviewLevel').textContent;
            root.style.setProperty('--jump-avatar',playerColors.body);
            const completed=Math.min(LEVELS.length,Math.max(0,maxUnlockedLevel));
            document.getElementById('jumpCampaignProgress').textContent=`${completed} / ${LEVELS.length} cleared`;
            document.getElementById('jumpCampaignFill').style.width=`${completed/LEVELS.length*100}%`;
            const progress=document.querySelector('#platdoGame .jump-progress-track');
            progress.setAttribute('aria-valuemax',String(LEVELS.length));
            progress.setAttribute('aria-valuenow',String(completed));
            const controls=document.getElementById('jumpMenuControls');controls.replaceChildren();
            for(const [actions,label] of [[['left','right'],'Move'],[['up'],'Jump']]){
                const group=document.createElement('span');
                for(const action of actions){const key=document.createElement('kbd');key.textContent=inputLabel(bindings[action][0]);group.append(key);}
                group.append(document.createTextNode(label));controls.append(group);
            }
        }
        document.getElementById('platdoGame').addEventListener('click',()=>requestAnimationFrame(refreshJumpMenuPresentation));
        window.addEventListener('hashchange',()=>requestAnimationFrame(refreshJumpMenuPresentation));
        const jumpMenuPresentationObserver=new MutationObserver(()=>requestAnimationFrame(refreshJumpMenuPresentation));
        jumpMenuPresentationObserver.observe(titleOverlay,{attributes:true,attributeFilter:['class']});


// PLATDO shared mobile adapters: Jump and Field
// One controls preference owns these surfaces; legacy viewport-based controls
// are retired so desktop and mobile input never appear at the same time.
const legacyMobileStyle=document.createElement('style');
legacyMobileStyle.textContent='#platdoGame .jump-touch-controls,#platdoGame #fireWeaponBtn{display:none!important}';
document.head.append(legacyMobileStyle);
/* Legacy mobile HUD layout BEGIN */
const legacyMobileHUDStyle=document.createElement('style');legacyMobileHUDStyle.textContent='/* Keep gameplay readouts outside the mobile thumb zones. */\nhtml[data-control-mode="mobile"] #fieldGame :is(#fieldMenuBtn,#fieldInventory){display:none!important}\nhtml[data-control-mode="mobile"] #fieldGame #fieldRunTimer{left:14px!important;top:12px!important;bottom:auto!important;padding:0!important;font-size:13px!important}\nhtml[data-control-mode="mobile"] #fieldGame #fieldCombatHUD{left:14px!important;top:51px!important;bottom:auto!important;width:min(190px,36vw)!important}\nhtml[data-control-mode="mobile"] #fieldGame .field-vital-track{height:28px}\nhtml[data-control-mode="mobile"] #fieldGame .field-vital-value{font-size:17px;line-height:28px}\nhtml[data-control-mode="mobile"] #fieldGame .field-vital-row{gap:5px}\nhtml[data-control-mode="mobile"] #fieldGame .field-vital-icon{flex-basis:19px;width:19px;height:19px}\nhtml[data-control-mode="mobile"] #fieldGame :is(#fieldNormalPistolAmmoHUD,#fieldShellHUD,#fieldFriendlyAmmoHUD,#fieldRetroPistolAmmoHUD,#fieldRetroRocketAmmoHUD,#fieldRetroARAmmoHUD){right:14px!important;top:51px!important;bottom:auto!important;max-width:35vw!important}\nhtml[data-control-mode="mobile"] #fieldGame :is(#fieldRetroHUD,#fieldNormalWaveHUD,#fieldPracticeHUD){top:59px!important;left:50%!important;transform:translateX(-50%)!important;max-width:29vw!important}\nhtml[data-control-mode="mobile"] #fieldGame #fieldRetroHUD .field-retro-wave-title,html[data-control-mode="mobile"] #fieldGame #fieldNormalWaveHUD>div:first-child{font-size:24px!important}\nhtml[data-control-mode="mobile"] #fieldGame :is(#fieldRetroHUD .field-retro-wave-detail,#fieldNormalWaveHUD>div:last-child){font-size:10px!important;margin-top:3px!important}\nhtml[data-control-mode="mobile"] #fieldGame #fieldTutorialHUD{top:107px!important;width:calc(100% - 32px)!important;max-width:500px}\nhtml[data-control-mode="mobile"] #fieldGame #fieldTowelPrompt{bottom:160px!important;font-size:13px!important}\nhtml[data-control-mode="mobile"] #platdoGame:has(#titleOverlay.hidden) :is(.hub-back-bar,.weapon-bar,#statusMessage,#soundToggleBtn,#menuBtn){display:none!important}\nhtml[data-control-mode="mobile"] #platdoGame:has(#titleOverlay.hidden) .jump-hud{min-height:54px;padding:5px 14px}\n#jumpMobileWeaponStatus{display:none;position:absolute;left:14px;top:60px;z-index:21;color:#fff;font:700 12px/1.4 Arial,sans-serif;text-shadow:0 1px 3px #001525;pointer-events:none}\nhtml[data-control-mode="mobile"] #platdoGame:has(#titleOverlay.hidden) #jumpMobileWeaponStatus{display:block}\n@media(max-width:480px){\n html[data-control-mode="mobile"] #fieldGame #fieldCombatHUD{top:65px!important;width:38vw!important}\n html[data-control-mode="mobile"] #fieldGame :is(#fieldNormalPistolAmmoHUD,#fieldShellHUD,#fieldFriendlyAmmoHUD,#fieldRetroPistolAmmoHUD,#fieldRetroRocketAmmoHUD,#fieldRetroARAmmoHUD){top:65px!important;max-width:38vw!important}\n html[data-control-mode="mobile"] #fieldGame :is(#fieldRetroHUD,#fieldNormalWaveHUD,#fieldPracticeHUD){top:150px!important;max-width:75vw!important}\n html[data-control-mode="mobile"] #fieldGame #fieldTutorialHUD{top:155px!important}\n html[data-control-mode="mobile"] #platdoGame:has(#titleOverlay.hidden) .jump-level-readout{padding:0;gap:3px}\n html[data-control-mode="mobile"] #platdoGame:has(#titleOverlay.hidden) #levelLabel{display:none}\n html[data-control-mode="mobile"] #platdoGame:has(#titleOverlay.hidden) .jump-cash-readout{padding:0}\n}\n';document.head.append(legacyMobileHUDStyle);
/* Legacy mobile HUD layout END */
const jumpMobileWeaponStatus=document.createElement('div');jumpMobileWeaponStatus.id='jumpMobileWeaponStatus';document.getElementById('platdoGame').append(jumpMobileWeaponStatus);
function registerLegacyMobileControls(){
 const controls=window.Platdo?.controls;if(!controls)return;
 controls.register('platdo-jump',{
  visible:()=>!document.getElementById('platdoGame').hidden,
  playing:()=>gameStarted&&!isPaused&&!anyGamePageOpen()&&titleOverlay.classList.contains('hidden')&&winOverlay.classList.contains('hidden'),
  layout:()=>({key:'jump-'+equippedWeapon+'-'+isCustomLevel,moveLabel:'Move',look:equippedWeapon==='sniper'&&!isCustomLevel,lookLabel:'Aim scope',buttons:[
   {id:'jump',label:'Jump',hold:true,side:'right'},
   ...(!isCustomLevel?[{id:'fire',label:equippedWeapon==='nuke'?'Detonate':'Fire',hold:true,side:'right'},{id:'weapon',label:'Weapon',side:'right'},{id:'previous',label:'Prev.',side:'right',secondary:true},{id:'shop',label:'Shop',side:'top'}]:[]),
   {id:'pause',label:'Pause',side:'top'}
  ],help:equippedWeapon==='sniper'?'Move with the left stick. Drag Aim scope to target, then Fire.':'Move with the left stick. Hold Jump to jump on landing.'}),
  move:(x,y)=>{if(!controls.isMobile)return;touchKeys.left=x<-.16;touchKeys.right=x>.16;syncControls();},
  look:(dx,dy)=>{if(!controls.isMobile)return;const rect=canvas.getBoundingClientRect(),scale=Math.min(rect.width/800,rect.height/450)||1;const point=aimPoint||{x:400,y:225};aimPoint={x:Math.max(0,Math.min(800,point.x+dx/scale)),y:Math.max(0,Math.min(450,point.y+dy/scale))};},
  action:(id,down)=>{
   if(!controls.isMobile)return;
   if(id==='jump'){touchKeys.up=down;syncControls();return;}
   if(id==='fire'){fireButtonHeld=down;syncControls();if(down)fireWeapon();return;}
   if(!down)return;
   if(id==='weapon')switchWeapon(1);
   else if(id==='previous')switchWeapon(-1);
   else if(id==='shop')openWeaponShop();
   else if(id==='pause')setPaused(true);
  },clear:resetControls
 });
 controls.register('field',{
  visible:()=>!fieldRoot.hidden,
  playing:()=>fieldActive&&!fieldPaused&&!godCoreIntroActive&&!godCoreAcquisitionActive&&!godCoreVictoryActive,
  layout:()=>({key:'field-'+fieldMode+'-'+fieldFriendly+'-'+fieldEquipped+'-'+godCorePowerActive(),moveLabel:'Move',look:true,lookLabel:'Look',buttons:[
   {id:'fire',label:fieldEquipped==='grenade'?'Throw':'Fire',hold:true,side:'right'},
   ...(fieldCanAimWeapon()?[{id:'aim',label:'Aim',hold:true,side:'right'}]:[]),
   ...(!godCorePowerActive()?[{id:'reload',label:fieldFriendly?'Refill':'Reload',side:'right'},{id:'weapon',label:'Weapon',side:'right'}]:[]),
   ...(!fieldIsRetroMode()||fieldIsGodCore()?[{id:'jump',label:'Jump',hold:true,side:'right'}]:[]),
   {id:'sprint',label:'Run',hold:true,side:'left'},{id:'crouch',label:'Crouch',hold:true,side:'left'},
   {id:'leanLeft',label:'Lean L',hold:true,side:'left',secondary:true},{id:'leanRight',label:'Lean R',hold:true,side:'left',secondary:true},
   ...(fieldFriendly?[{id:'interact',label:'Pool / towel',side:'right'}]:[]),
   {id:'pause',label:'Pause',side:'top'}
  ],help:'Move with the left stick. Drag Look to turn. Hold Fire for automatic weapons.'}),
  move:(x,y)=>{if(!controls.isMobile)return;fieldMobileMove.x=x;fieldMobileMove.y=y;},
  look:(dx,dy)=>{if(!controls.isMobile||!fieldActive||!Number.isFinite(dx)||!Number.isFinite(dy))return;const sensitivity=.003*fieldLookSensitivity/fieldAimZoom();fieldPose.yaw+=dx*sensitivity;fieldPose.pitch=Math.max(-1.5,Math.min(1.5,fieldPose.pitch-dy*sensitivity));queueFieldSave();},
  action:(id,down)=>{
   if(!controls.isMobile)return;
   if(!down){fieldMobileActions.delete(id);return;}
   if(!fieldActive||fieldPaused||godCoreIntroActive||godCoreAcquisitionActive||godCoreVictoryActive)return;
   if(id==='pause'){pauseField();return;}
   if(id==='reload'){if(fieldFriendly)interactFieldFriendly();else if(fieldHasNormalPistolMagazine())beginFieldNormalPistolReload();else beginRetroReload();return;}
   if(id==='interact'){interactFieldFriendly();return;}
   if(id==='weapon'){
    const ids=fieldAvailableWeapons();fieldEquipped=ids[(ids.indexOf(fieldEquipped)+1)%ids.length];fieldAimToggled=false;fieldMobileActions.delete('aim');fieldMobileActions.delete('fire');renderFieldInventory();saveField();return;
   }
   fieldMobileActions.add(id);if(id==='fire')shootFieldWeapon();
  },
  clear:()=>{clearFieldMobileInput();fieldKeys.clear();fieldAimToggled=fieldCrouchToggled=fieldSprintToggled=false;}
 });
}
window.addEventListener('platdo:controlsready',registerLegacyMobileControls);
registerLegacyMobileControls();
// Legacy mobile help and compact actions
window.addEventListener('platdo:controlsmodechange',()=>{pendingBinding=null;fieldBinding=null;refreshBindings();renderFieldBinds();updateWeaponHUD();renderFieldFriendlyAmmo();renderFieldTowelPrompt();renderFieldTutorial();});

// Embedded in the collection's legacy game script; uses its existing game state.
// Keep all gameplay coordinates in the original 800 x 450 Jump world.
let jumpGraphics=null,fieldGraphics=null,godCoreGraphics=null;
const jumpGraphicsFallback={lighting:'high',detail:'high',particles:'high'};
const fieldGraphicsFallback={distance:80,lighting:'high',detail:'high',particles:'high',decals:true};
const jumpStaticLayer=document.createElement('canvas');
let jumpStaticKey='',jumpStaticPlatforms=null,jumpStaticSpikes=null,jumpCacheBuilds=0;
const legacyRenderStats={jumpFrames:0,fieldFrames:0,fieldBoxes:0,fieldWorldBoxes:0,fieldCulled:0,fieldParticles:0};
function jumpGraphicsValues(){return jumpGraphics?.get()||jumpGraphicsFallback;}
function fieldGraphicsProfile(){return fieldIsGodCore()?godCoreGraphics:fieldGraphics;}
function fieldGraphicsValues(){return fieldGraphicsProfile()?.get()||fieldGraphicsFallback;}
function resizeJumpBuffer(){
 const rect=canvas.getBoundingClientRect(),fit=Math.min(rect.width/800,rect.height/450)||1;
 const size=jumpGraphics?.renderSize(800*fit,450*fit)||{width:800,height:450};
 if(canvas.width!==size.width||canvas.height!==size.height){canvas.width=size.width;canvas.height=size.height;jumpStaticKey='';}
 ctx.setTransform(canvas.width/800,0,0,canvas.height/450,0,0);
 ctx.imageSmoothingEnabled=jumpGraphicsValues().detail!=='low';
}
function paintJumpStatic(bgItem,platItem,floorItem){
 const q=jumpGraphicsValues(),key=[canvas.width,canvas.height,bgItem.id,platItem.id,floorItem.id,q.lighting,q.detail].join('|');
 if(key!==jumpStaticKey||jumpStaticPlatforms!==platforms||jumpStaticSpikes!==spikes){
  jumpStaticLayer.width=canvas.width;jumpStaticLayer.height=canvas.height;
  const c=jumpStaticLayer.getContext('2d');c.setTransform(canvas.width/800,0,0,canvas.height/450,0,0);
  paintScene(c,bgItem);for(const p of platforms)paintTerrain(c,p,p.y+p.height>=450?floorItem:platItem);
  c.fillStyle=floorItem.spike||'#ef4444';
  for(const s of spikes){const count=Math.max(1,Math.floor(s.width/15)),width=s.width/count;c.beginPath();for(let i=0;i<count;i++){c.moveTo(s.x+i*width,s.y+s.height);c.lineTo(s.x+(i+.5)*width,s.y);c.lineTo(s.x+(i+1)*width,s.y+s.height);c.closePath();}c.fill();}
  jumpStaticKey=key;jumpStaticPlatforms=platforms;jumpStaticSpikes=spikes;jumpCacheBuilds++;
 }
 ctx.drawImage(jumpStaticLayer,0,0,800,450);
}
// Cached collision geometry is never filtered by a graphics preference.
const fieldWorldCache={key:'',doors:[],boxes:[],builds:0};
function fieldWorldBoxes(){
 const key=[fieldMode,fieldFriendly,fieldGameIdentity,fieldSelectedMap,currentRetroMap(),fieldActive?'live':'preview',fieldPreviewRetroMap].join('|');
 let dirty=fieldWorldCache.key!==key||fieldWorldCache.doors.length!==fieldDoors.length*4;
 for(let i=0;!dirty&&i<fieldDoors.length;i++){const d=fieldDoors[i],j=i*4;if(fieldWorldCache.doors[j]!==d.x||fieldWorldCache.doors[j+1]!==d.z||fieldWorldCache.doors[j+2]!==d.y||fieldWorldCache.doors[j+3]!==d.open)dirty=true;}
 if(dirty){fieldWorldCache.builds++;fieldWorldCache.key=key;fieldWorldCache.boxes=fieldBuildWorldBoxes();fieldWorldCache.doors.length=fieldDoors.length*4;for(let i=0;i<fieldDoors.length;i++){const d=fieldDoors[i],j=i*4;fieldWorldCache.doors[j]=d.x;fieldWorldCache.doors[j+1]=d.z;fieldWorldCache.doors[j+2]=d.y;fieldWorldCache.doors[j+3]=d.open;}}
 return fieldWorldCache.boxes;
}
const fieldUniformBuffers={centers:new Float32Array(384),sizes:new Float32Array(512),actors:new Float32Array(48),motions:new Float32Array(24),retro:new Float32Array(48),hits:new Float32Array(48)};
function fieldVisibleWorld(){
 const all=fieldWorldBoxes(),q=fieldGraphicsValues(),range=q.distance||80,visible=[];
 const x=fieldActive?fieldEyeX():0,z=fieldActive?fieldEyeZ():fieldFriendly?9:fieldIsRetroMode()?fieldRetroMaps[currentRetroMap()].spawn[1]:0;
 const y=fieldActive?fieldHeight-fieldCrouchOffset:fieldFriendly?3.2:1.7;
 const yaw=fieldActive?fieldPose.yaw:0,pitch=fieldActive?fieldPose.pitch+fieldRecoil:-.12,fx=Math.sin(yaw)*Math.cos(pitch),fy=Math.sin(pitch),fz=-Math.cos(yaw)*Math.cos(pitch);
 const aspect=Math.max(1,fieldCanvas.clientWidth)/Math.max(1,fieldCanvas.clientHeight),sinAngle=Math.sin(Math.atan(.7/fieldAimZoom()*Math.sqrt(1+aspect*aspect)));
 for(const b of all){
  const dx=b.c[0]-x,dy=b.c[1]-y,dz=b.c[2]-z,radius=Math.hypot(...b.h),depth=dx*fx+dy*fy+dz*fz,length=Math.hypot(dx,dy,dz);
  // Sphere-cone test is conservative: every potentially visible solid stays.
  if(depth < -radius || (depth>0&&Math.sqrt(Math.max(0,length*length-depth*depth))>depth*sinAngle/Math.sqrt(1-sinAngle*sinAngle)+radius/Math.sqrt(1-sinAngle*sinAngle)))continue;
  // Thin room signs and overhead decorative headers are never collision support.
  // Structural walls, stairs, doors, cover and all enemies remain at every range.
  if([24,30,31].includes(b.kind)&&length-radius>range+2)continue;
  visible.push(b);
 }
 legacyRenderStats.fieldWorldBoxes=all.length;legacyRenderStats.fieldBoxes=visible.length;legacyRenderStats.fieldCulled=all.length-visible.length;
 return visible;
}
function fieldParticleStride(){return {low:4,medium:2,high:1}[fieldGraphicsValues().particles]||1;}
function syncLegacyRenderLoops(){
 const jumpVisible=!document.hidden&&!document.getElementById('platdoGame').hidden;
 if(!jumpVisible){cancelAnimationFrame(jumpFrame);jumpFrame=0;physicsAccumulator=0;lastFrameTime=performance.now();lastRenderTime=0;}
 else if(!jumpFrame){lastFrameTime=performance.now();physicsAccumulator=0;lastRenderTime=0;jumpFrame=requestAnimationFrame(gameLoop);}
 const fieldVisible=!document.hidden&&!fieldRoot.hidden;
 if(!fieldVisible){cancelAnimationFrame(fieldFrame);fieldFrame=0;fieldLastTime=0;fieldLastRender=0;}
 else if(!fieldFrame){fieldLastTime=0;fieldLastRender=0;fieldFrame=requestAnimationFrame(fieldLoop);}
}
function installLegacyGraphics(){
 const G=window.Platdo?.graphics;if(!G||jumpGraphics)return;
 const quality={type:'select',options:['low','medium','high'],default:'medium'};
 const presets={potato:{resolution:'360',scale:.6,pixelRatio:1,lighting:'low',detail:'low',particles:'low'},low:{resolution:'540',scale:.75,pixelRatio:1,lighting:'low',detail:'low',particles:'low'},medium:{resolution:'720',scale:1,pixelRatio:1,lighting:'medium',detail:'medium',particles:'medium'},high:{resolution:'1080',scale:1,pixelRatio:1,lighting:'high',detail:'high',particles:'high'},ultra:{resolution:'1440',scale:1,pixelRatio:1.5,lighting:'high',detail:'high',particles:'high'}};
 jumpGraphics=G.register('platdo-jump',{name:'PLATDO jump!',fields:{distance:{type:'range',min:0,max:0,step:1,default:0,label:'Render distance',supported:false,reason:'Jump uses fixed-screen 800 × 450 levels. Every platform and enemy is inside the visible playfield; there is no offscreen world to remove.'},lighting:{...quality,label:'Lighting',help:'Flat sky colors on Low; gradients and aurora light layers on higher settings.'},detail:{...quality,label:'Background & terrain detail',help:'Controls decorative stars, background layers and surface patterns; every platform remains.'},particles:{...quality,label:'Player trail detail',help:'Lower settings draw fewer cosmetic trail samples. Shots and warnings are unchanged.'}},presets,apply(){jumpStaticKey='';if(!document.getElementById('platdoGame').hidden)render();},measure:()=>({width:canvas.width,height:canvas.height,frames:legacyRenderStats.jumpFrames,staticCacheBuilds:jumpCacheBuilds,renderer:'Canvas 2D',active:!document.getElementById('platdoGame').hidden})});
 const makeField=(id,name)=>G.register(id,{name,fields:{distance:{type:'range',min:8,max:80,step:2,default:32,unit:'m',label:'Render distance',help:'Range for detailed surfaces, signs, decals and water spray. Solid cover, stairs, doors and enemies always remain visible; nearby interaction objects have an 8 m safety margin.'},lighting:{...quality,label:'Lighting',help:'Low uses readable ambient shading. Higher settings add face lighting, water glints and GOD CORE light spill.'},detail:{...quality,label:'Surface detail',help:'Controls procedural grass, clouds, water ripples and material micro-detail.'},particles:{...quality,label:'Water particle detail',help:'Reduces decorative spray drawing. Water streams, explosions and projectile cues stay visible.'},decals:{type:'checkbox',default:true,label:'Bullet impact decals',help:'Off skips decal texture sampling; hit feedback stays enabled.'}},presets:Object.fromEntries(Object.entries(presets).map(([key,p])=>[key,{...p,distance:{potato:8,low:16,medium:32,high:56,ultra:80}[key],decals:key!=='potato'}])),apply(){fieldLastRender=0;fieldRendererFailed=false;},measure:()=>({width:fieldCanvas.width,height:fieldCanvas.height,renderer:'WebGL ray-box',submittedBoxes:legacyRenderStats.fieldBoxes,worldBoxes:legacyRenderStats.fieldWorldBoxes,geometryBuilds:fieldWorldCache.builds,culledBoxes:legacyRenderStats.fieldCulled,visibleParticles:legacyRenderStats.fieldParticles,frames:legacyRenderStats.fieldFrames,active:!fieldRoot.hidden&&fieldGameIdentity===id})});
 fieldGraphics=makeField('field','code PLATDO');godCoreGraphics=makeField('god-core','platdo god core');fieldGraphics.attachContext?.(fieldCanvas);
 fieldCanvas.addEventListener('webglcontextlost',()=>{if(fieldActive)pauseField();fieldGL=null;fieldProgram=null;fieldUniforms=null;});
 fieldCanvas.addEventListener('webglcontextrestored',()=>{fieldLastRender=0;});
 const add=(parent,id,classes,open)=>{const b=document.createElement('button');b.id=id;b.className=classes;b.textContent='Graphics';b.addEventListener('click',open);parent.append(b);};
 add(document.getElementById('settingsTabs'),'jumpGraphicsSettings','game-button',()=>jumpGraphics.open());
 add(document.getElementById('fieldSettings').querySelector('[role="tablist"]'),'fieldGraphicsSettings','field-graphics-button',()=>fieldGraphicsProfile().open());
 document.getElementById('fieldGraphicsSettings').style.cssText='padding:12px;border:1px solid #8296a9;border-radius:8px;cursor:pointer';
 window.addEventListener('hashchange',syncLegacyRenderLoops);document.addEventListener('visibilitychange',syncLegacyRenderLoops);
 // Settings are accessible from both title menus and their existing pause menus.
 window.addEventListener('resize',()=>{jumpStaticKey='';if(!document.getElementById('platdoGame').hidden&&!gameStarted)render();});
}
window.addEventListener('load',installLegacyGraphics);

        // Initialize and start render loop on window load
        window.onload = function () {
            const savedProgress=readFullProgress();
            loadMainSettings(savedProgress);
            if(savedProgress)restoreFullProgress(savedProgress);
            else try{if(localStorage.getItem('platdo_admin_completed_campaign')==='true')beatGameFromAdmin(false);}catch(_){}
            renderAudioSettings();
            ensureCustomLevelIds();
            refreshBindings();renderInventoryOrder();
            loadLevel(currentLevel);
            render();
            renderShopGrid();
            renderLockerGrid();
            updateWeaponHUD();
            checkLevelEditorUnlocked();
            showSelectedGame();
            if(!['#field','#god-core','#drive','#swing','#city'].includes(location.hash))restoreSavedRun(savedProgress);
            syncSelectorMusic();
            updateCashDisplay();updateWeaponHUD();renderHighScoreTotals();
            refreshJumpMenuPresentation();
            fullSaveReady=true;saveFullProgress();
            syncLegacyRenderLoops();
        };
    