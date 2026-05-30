// main.js — Cursed Bloom: Full game orchestration
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { DeviceDetector } from './engine/DeviceDetector.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { InputManager } from './engine/InputManager.js';
import { ProceduralHouse } from './world/ProceduralHouse.js';
import { FurnitureGen } from './world/FurnitureGen.js';
import { FlowerSpawner } from './world/FlowerSpawner.js';
import { StoryFragments } from './world/StoryFragments.js';
import { Player } from './player/Player.js';
import { SanitySystem } from './systems/SanitySystem.js';
import { CurseStageSystem } from './systems/CurseStageSystem.js';
import { PersonalitySystem } from './systems/PersonalitySystem.js';
import { EventSystem } from './systems/EventSystem.js';
import { EndingSystem } from './systems/EndingSystem.js';
import { spawnRandomEntity } from './entities/Entities.js';
import './ui/MobileHUD.css';

// ─── Seeded random ───────────────────────────────────────────────────────────
function makeSeed() { return Math.floor(Math.random() * 0xffffffff); }
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

// ─── Post-processing shaders ─────────────────────────────────────────────────
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignettePower: { value: 0.5 },
    vignetteColor: { value: new THREE.Color(0, 0, 0) },
    chromaticAberration: { value: 0.003 },
    sanityDistort: { value: 0 },
    time: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignettePower;
    uniform float chromaticAberration;
    uniform float sanityDistort;
    uniform float time;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      // Sanity distortion
      if (sanityDistort > 0.0) {
        uv.x += sin(uv.y * 20.0 + time * 3.0) * sanityDistort;
        uv.y += cos(uv.x * 15.0 + time * 2.0) * sanityDistort * 0.7;
      }
      // Chromatic aberration
      float r = texture2D(tDiffuse, uv + vec2(chromaticAberration, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(chromaticAberration, 0.0)).b;
      vec4 col = vec4(r, g, b, 1.0);
      // Vignette
      float dist = distance(uv, vec2(0.5));
      float vig = smoothstep(0.4, 0.9, dist * vignettePower * 2.0);
      col.rgb *= (1.0 - vig);
      gl_FragColor = col;
    }
  `
};

// ─── HTML Builder ─────────────────────────────────────────────────────────────
function buildDOM() {
  document.body.innerHTML = `
    <!-- Rotate overlay -->
    <div id="rotate-overlay" style="display:none;position:fixed;inset:0;background:#000;z-index:9999;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:'Cinzel',serif;text-align:center;gap:20px;">
      <div style="font-size:64px;animation:rotA 2s ease-in-out infinite;">📱</div>
      <p style="font-size:18px;opacity:0.8;">Rotate your phone for the best experience</p>
    </div>
    <style>@keyframes rotA{0%,100%{transform:rotate(0deg)}50%{transform:rotate(90deg)}}</style>

    <!-- Main Menu -->
    <div id="main-menu" style="position:fixed;inset:0;background:#000;z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Cinzel',serif;color:#fff;">
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center, #1a0510 0%, #000 70%);"></div>
      <div style="position:relative;text-align:center;padding:20px;">
        <div style="font-size:clamp(12px,2vw,16px);letter-spacing:6px;color:#9900cc;margin-bottom:12px;opacity:0.8;">PROCEDURAL HORROR SURVIVAL</div>
        <h1 style="font-size:clamp(36px,8vw,96px);font-weight:900;letter-spacing:4px;margin:0;background:linear-gradient(135deg,#cc00aa,#9900cc,#ff0066);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-shadow:none;">CURSED BLOOM</h1>
        <div style="font-size:clamp(12px,1.5vw,14px);letter-spacing:3px;color:#884466;margin-top:8px;font-family:'Crimson Text',serif;font-style:italic;">Find the flower. Break the curse. Escape the dark.</div>
        <div style="margin:40px 0 20px;width:2px;height:60px;background:linear-gradient(to bottom,transparent,#9900cc,transparent);margin:40px auto 30px;"></div>
        <button id="btn-play" style="padding:16px 48px;font-family:'Cinzel',serif;font-size:clamp(14px,2vw,18px);letter-spacing:4px;background:transparent;border:1px solid #9900cc;color:#cc88ff;cursor:pointer;transition:all 0.3s;text-transform:uppercase;" onmouseover="this.style.background='rgba(153,0,204,0.2)'" onmouseout="this.style.background='transparent'">ENTER THE DARKNESS</button>
        <div style="margin-top:16px;">
          <button id="btn-about" style="padding:8px 24px;font-family:'Cinzel',serif;font-size:11px;letter-spacing:3px;background:transparent;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.4);cursor:pointer;">HOW TO PLAY</button>
        </div>
        <div id="lore-seed-display" style="margin-top:30px;font-size:10px;letter-spacing:2px;color:#331133;font-family:monospace;"></div>
      </div>
    </div>

    <!-- How to Play Modal -->
    <div id="how-to-play" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:600;align-items:center;justify-content:center;">
      <div style="max-width:500px;padding:40px;border:1px solid #9900cc33;font-family:'Crimson Text',serif;color:#ccc;text-align:left;">
        <h2 style="font-family:'Cinzel',serif;color:#cc88ff;margin-bottom:20px;">HOW TO PLAY</h2>
        <div id="controls-text" style="line-height:1.8;font-size:15px;"></div>
        <div style="margin-top:16px;font-size:13px;color:#884466;font-style:italic;">
          ⚠ The longer you take, the worse it gets. Every run is different.
        </div>
        <button onclick="document.getElementById('how-to-play').style.display='none'" style="margin-top:24px;padding:10px 28px;font-family:'Cinzel',serif;font-size:12px;letter-spacing:3px;background:transparent;border:1px solid #9900cc;color:#cc88ff;cursor:pointer;">CLOSE</button>
      </div>
    </div>

    <!-- HUD -->
    <div id="hud" style="display:none;position:fixed;inset:0;pointer-events:none;z-index:50;font-family:'Cinzel',serif;">
      <!-- Top bar -->
      <div style="position:absolute;top:0;left:0;right:0;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          <!-- Battery -->
          <div style="display:flex;align-items:center;gap:8px;opacity:0.85;">
            <span style="font-size:12px;color:#ff9944;letter-spacing:2px;">🔦</span>
            <div style="width:80px;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;">
              <div id="battery-bar" style="height:100%;background:#ff9944;border-radius:3px;transition:width 0.5s;"></div>
            </div>
          </div>
          <!-- Sanity -->
          <div style="display:flex;align-items:center;gap:8px;opacity:0.85;">
            <span style="font-size:12px;color:#aa55ff;letter-spacing:2px;">🧠</span>
            <div style="width:80px;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;">
              <div id="sanity-bar" style="height:100%;background:#aa55ff;border-radius:3px;transition:width 0.5s,background 0.5s;"></div>
            </div>
          </div>
        </div>
        <!-- Stage indicator -->
        <div id="stage-indicator" style="text-align:right;">
          <div id="stage-label" style="font-size:10px;letter-spacing:3px;color:#551122;opacity:0.7;"></div>
          <div id="stage-dots" style="display:flex;gap:4px;justify-content:flex-end;margin-top:4px;"></div>
        </div>
      </div>

      <!-- Center crosshair -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);">
        <div style="width:16px;height:16px;position:relative;">
          <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,0.3);transform:translateY(-50%);"></div>
          <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.3);transform:translateX(-50%);"></div>
          <div style="position:absolute;top:50%;left:50%;width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,0.5);transform:translate(-50%,-50%);"></div>
        </div>
      </div>

      <!-- Prompt -->
      <div id="interact-prompt" style="position:absolute;bottom:30%;left:50%;transform:translateX(-50%);display:none;text-align:center;">
        <div id="prompt-text" style="font-size:clamp(11px,1.5vw,13px);letter-spacing:4px;color:#cc88ff;padding:8px 20px;border:1px solid rgba(153,0,204,0.4);background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);"></div>
      </div>

      <!-- Fear overlay (blood vignette) -->
      <div id="fear-overlay" style="position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(60,0,0,0.8) 100%);transition:opacity 0.5s;"></div>

      <!-- Sanity overlay -->
      <div id="sanity-overlay" style="position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,transparent 30%,rgba(30,0,50,0.9) 100%);transition:opacity 1s;"></div>

      <!-- Hallucination text -->
      <div id="hallucination-text" style="position:absolute;top:40%;left:50%;transform:translateX(-50%);display:none;text-align:center;pointer-events:none;">
        <div style="font-family:'Crimson Text',serif;font-style:italic;font-size:clamp(16px,3vw,28px);color:rgba(180,100,200,0.6);text-shadow:0 0 20px rgba(150,0,200,0.5);"></div>
      </div>

      <!-- Event flash -->
      <div id="event-flash" style="position:absolute;inset:0;pointer-events:none;opacity:0;background:#fff;transition:opacity 0.1s;"></div>

      <!-- Stage transition -->
      <div id="stage-transition" style="position:absolute;inset:0;pointer-events:none;opacity:0;display:flex;align-items:center;justify-content:center;background:rgba(20,0,5,0.8);">
        <div id="stage-transition-text" style="font-family:'Cinzel',serif;font-size:clamp(16px,3vw,28px);letter-spacing:6px;color:#cc0044;text-align:center;"></div>
      </div>

      <!-- Lore fragment reader -->
      <div id="lore-reader" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:200;align-items:center;justify-content:center;pointer-events:all;">
        <div style="max-width:520px;margin:20px;padding:40px 36px;border:1px solid rgba(255,200,100,0.2);background:rgba(10,8,5,0.95);font-family:'Crimson Text',serif;color:#d4c4a0;">
          <div id="lore-arc" style="font-size:10px;letter-spacing:4px;color:#886633;margin-bottom:6px;font-family:'Cinzel',serif;"></div>
          <h3 id="lore-title" style="font-family:'Cinzel',serif;font-size:clamp(16px,2.5vw,20px);color:#ffe8a0;margin-bottom:20px;border-bottom:1px solid rgba(255,200,100,0.2);padding-bottom:12px;"></h3>
          <p id="lore-body" style="line-height:1.9;font-size:clamp(14px,1.8vw,16px);font-style:italic;"></p>
          <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:center;">
            <span id="lore-count" style="font-size:11px;letter-spacing:2px;color:#664422;"></span>
            <button id="lore-close" style="padding:8px 24px;font-family:'Cinzel',serif;font-size:11px;letter-spacing:3px;background:transparent;border:1px solid rgba(255,200,100,0.3);color:#aa8844;cursor:pointer;">CONTINUE</button>
          </div>
        </div>
      </div>

      <!-- Pause menu -->
      <div id="pause-menu" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;pointer-events:all;align-items:center;justify-content:center;font-family:'Cinzel',serif;color:#fff;flex-direction:column;gap:20px;">
        <div style="font-size:clamp(24px,4vw,40px);letter-spacing:6px;color:#cc88ff;">PAUSED</div>
        <button id="btn-resume" style="padding:12px 40px;font-size:14px;letter-spacing:4px;background:transparent;border:1px solid #9900cc;color:#cc88ff;cursor:pointer;">RESUME</button>
        <button id="btn-restart" style="padding:12px 40px;font-size:14px;letter-spacing:4px;background:transparent;border:1px solid #551133;color:#884466;cursor:pointer;">NEW GAME</button>
      </div>

      <!-- Mobile controls -->
      <div id="mobile-controls">
        <div id="joystick-zone"></div>
        <div id="action-buttons">
          <div class="action-row">
            <button class="hud-btn flashlight" id="btn-flashlight" title="Flashlight">🔦</button>
            <button class="hud-btn" id="btn-crouch" title="Crouch">⬇</button>
          </div>
          <div class="action-row">
            <button class="hud-btn run" id="btn-run" title="Run">RUN</button>
            <button class="hud-btn interact" id="btn-interact" title="Interact">USE</button>
          </div>
        </div>
      </div>
    </div>

    <!-- End screen -->
    <div id="end-screen" style="display:none;position:fixed;inset:0;z-index:600;align-items:center;justify-content:center;font-family:'Cinzel',serif;flex-direction:column;text-align:center;padding:20px;">
      <div id="end-bg" style="position:absolute;inset:0;transition:background 2s;"></div>
      <div id="end-content" style="position:relative;max-width:640px;">
        <div id="end-subtitle" style="font-size:clamp(10px,1.5vw,12px);letter-spacing:5px;margin-bottom:16px;opacity:0.7;"></div>
        <h1 id="end-title" style="font-size:clamp(28px,6vw,64px);font-weight:900;letter-spacing:4px;margin:0;"></h1>
        <div style="width:60px;height:2px;margin:24px auto;background:currentColor;opacity:0.4;"></div>
        <p id="end-message" style="font-family:'Crimson Text',serif;font-size:clamp(14px,2vw,17px);line-height:1.8;font-style:italic;opacity:0.85;max-width:480px;margin:0 auto;"></p>
        <div style="margin-top:36px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
          <button id="btn-play-again" style="padding:14px 36px;font-family:'Cinzel',serif;font-size:clamp(11px,1.5vw,13px);letter-spacing:4px;background:transparent;border:1px solid currentColor;cursor:pointer;opacity:0.6;transition:opacity 0.3s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">PLAY AGAIN</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('end-screen').style.display = 'none';
}

// ─── Game State ───────────────────────────────────────────────────────────────
let gameState = 'menu'; // menu | playing | paused | reading | dead | ending
let seed, rand;
let renderer, scene, camera, composer;
let player, inputManager, audioEngine, deviceDetector;
let house, furniture, flowers, lore;
let entity, entityName;
let sanity, curseStage, eventSystem, endingSystem;
let settings;
let lastTime = 0;
let noiseEvents = [];
let paused = false;
let nippleManager = null;
let rainSystem = null;
let _animId;

// ─── Init Three.js ─────────────────────────────────────────────────────────
function initRenderer() {
  deviceDetector = new DeviceDetector();
  settings = deviceDetector.getSettings();
  if (deviceDetector.isMobile) document.body.classList.add('is-mobile');

  renderer = new THREE.WebGLRenderer({ antialias: !deviceDetector.isMobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(settings.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = settings.enableShadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = 'position:fixed;inset:0;z-index:1;';
  canvasContainer.id = 'canvas-container';
  document.body.appendChild(canvasContainer);
  canvasContainer.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 80);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x111115, settings.enableVolumetricFog ? 0.002 : 0.003); // Very light fog
  scene.background = new THREE.Color(0x111115);

  // Post-processing
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.85);
  composer.addPass(bloom);
  if (!deviceDetector.isMobile) {
    const film = new FilmPass(0.25);
    composer.addPass(film);
  }
  const vigPass = new ShaderPass(VignetteShader);
  vigPass.uniforms.vignettePower.value = 0.2; // Reduced vignette so edges aren't pitch black
  composer.addPass(vigPass);
  composer.addPass(new OutputPass());

  window._vigPass = vigPass; // store for live updates

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    composer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ─── Start New Game ───────────────────────────────────────────────────────────
async function startGame() {
  seed = makeSeed();
  rand = seededRand(seed);

  document.getElementById('main-menu').style.display = 'none';
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';

  gameState = 'playing';

  // Clear previous scene
  while (scene.children.length > 0) scene.remove(scene.children[0]);

  // World generation
  house = new ProceduralHouse(seed);
  house.buildGeometry(scene);

  const furnitureGen = new FurnitureGen(rand);
  house.rooms.forEach(r => furnitureGen.populateRoom(scene, r));

  flowers = new FlowerSpawner(rand);
  flowers.spawn(scene, house.rooms);

  lore = new StoryFragments(rand);
  lore.spawnInScene(scene, house.rooms);

  // Systems
  sanity = new SanitySystem();
  sanity.onSanityZero = () => triggerDeath('sanity');

  curseStage = new CurseStageSystem();
  curseStage.onStageChange = onStageChange;

  endingSystem = new EndingSystem();

  eventSystem = new EventSystem(audioEngine);
  eventSystem.onLightFlicker = (duration) => {
    house.getRoomLights().forEach(l => { l.userData.flickerTimer = duration; });
    if (player) player.triggerFlickerNearMonster(duration);
  };

  // Player
  const spawn = house.getSpawnPoint();
  player = new Player(camera, scene, { ...settings, isMobile: deviceDetector.isMobile });
  player.position.copy(spawn);
  player.onStep = (level) => {
    noiseEvents.push({ position: player.getPosition(), level, time: performance.now() });
    if (noiseEvents.length > 5) noiseEvents.shift();
    audioEngine.playEvent('footstep');
  };

  // Entity
  const personality = new PersonalitySystem(rand);
  const spawnResult = spawnRandomEntity(scene, house.getRandomRoomCenter(), personality, rand);
  entity = spawnResult.entity;
  entityName = spawnResult.name;
  entity.setWaypoints(house.getAllRoomCenters());

  // Setup mobile joystick
  if (deviceDetector.isMobile) setupMobileControls();

  // Pointer lock on desktop
  if (!deviceDetector.isMobile) {
    renderer.domElement.addEventListener('click', () => {
      if (gameState === 'playing') inputManager.requestPointerLock(renderer.domElement);
    });
  }

  // Lighting — bright enough to see everything clearly
  const ambient = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambient);

  // Moonlight from above (cold blue-white)
  const moonlight = new THREE.DirectionalLight(0xcceeff, 1.0);
  moonlight.position.set(10, 20, 10);
  moonlight.castShadow = settings.enableShadows;
  scene.add(moonlight);

  // Hemisphere fill — warm ground bounce
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  scene.add(hemi);

  // Rain system
  const rt = new THREE.CanvasTexture(createRainTexture());
  const rMat = new THREE.PointsMaterial({ color: 0x99aacc, map: rt, transparent: true, opacity: 0.5, size: 0.3, depthWrite: false });
  const rGeo = new THREE.BufferGeometry();
  const rCount = 8000;
  const rPos = new Float32Array(rCount * 3);
  for(let i=0; i<rCount*3; i+=3) {
    rPos[i] = (Math.random()-0.5)*40;
    rPos[i+1] = Math.random()*20;
    rPos[i+2] = (Math.random()-0.5)*40;
  }
  rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  rainSystem = new THREE.Points(rGeo, rMat);
  scene.add(rainSystem);

  // Resume audio context
  audioEngine.resume();

  updateHUD();
  cancelAnimationFrame(_animId);
  gameLoop(performance.now());
}

// ─── Mobile Controls ─────────────────────────────────────────────────────────
async function setupMobileControls() {
  const { default: nipplejs } = await import('nipplejs');
  const zone = document.getElementById('joystick-zone');
  if (nippleManager) nippleManager.destroy();
  nippleManager = nipplejs.create({ zone, mode: 'dynamic', color: 'rgba(153,0,204,0.5)', size: 80 });
  nippleManager.on('move', (_, data) => {
    const angle = data.angle.radian;
    const force = Math.min(data.force, 1);
    inputManager.setJoystick(-Math.cos(angle) * force, Math.sin(angle) * force);
  });
  nippleManager.on('end', () => inputManager.setJoystick(0, 0));

  document.getElementById('btn-interact').addEventListener('touchstart', e => { e.preventDefault(); inputManager.triggerAction('interact'); });
  document.getElementById('btn-flashlight').addEventListener('touchstart', e => { e.preventDefault(); inputManager.triggerAction('flashlight'); });
  document.getElementById('btn-run').addEventListener('touchstart', e => { e.preventDefault(); inputManager.triggerAction('run'); });
  document.getElementById('btn-crouch').addEventListener('touchstart', e => { e.preventDefault(); inputManager.triggerAction('crouch'); });
  
  // Jump is missing a button on UI, double tap run or tap center to jump can be added, but for now we rely on desktop jump.
}

function createRainTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0,0,0,32);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,4,32);
  return c;
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function gameLoop(time) {
  _animId = requestAnimationFrame(gameLoop);
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  if (gameState !== 'playing') { composer.render(); return; }

  // Input
  const input = inputManager.update();

  // Pause
  if (input.pause) {
    togglePause();
    return;
  }

  // Flashlight toggle
  if (input.flashlight) {
    player.toggleFlashlight();
    audioEngine.recordFlashlightUse?.();
    entity?.adaptiveAI.recordFlashlightUse();
  }

  // Player update
  player.update(dt, input);

  // Interact
  if (input.interact) checkInteractions();

  // Curse stage
  curseStage.update(dt);
  const stageParams = curseStage.getParams();
  entity?.setStageParams(stageParams);
  scene.fog.density = stageParams.fogDensity;
  eventSystem.setStageMultiplier(stageParams.eventFreqMult);

  // Flickering lights disabled per user request to keep the room from glitching
  /*
  house.getRoomLights().forEach(light => {
    if (light.userData.flickerTimer > 0) {
      light.userData.flickerTimer -= dt;
      light.intensity = (Math.sin(time * 0.02) > 0) ? light.userData.baseIntensity : 0;
    } else {
      // Stage-based flicker
      if (Math.random() < stageParams.lightFlickerRate * dt * 0.1) {
        light.intensity = 0;
        setTimeout(() => { if (light) light.intensity = light.userData.baseIntensity; }, 150);
      }
    }
  });
  */

  // Entity AI
  const playerPos = player.getPosition();
  const distToEntity = entity ? entity.distanceTo(playerPos) : 999;
  const playerVisible = distToEntity < 20 && entity;

  // Noise events for entity (pass running status to Skinless Hunter)
  entity?.update(dt, playerPos, playerVisible, noiseEvents);

  // Clean old noise events
  noiseEvents = noiseEvents.filter(n => performance.now() - n.time < 3000);

  // Fear system
  const fearLevel = playerVisible ? Math.max(0, 100 - distToEntity * 5) : 0;
  audioEngine.setFear(fearLevel);
  if (playerVisible && distToEntity < 8) player.triggerFlickerNearMonster(distToEntity < 4 ? 2 : 0.5);

  // Sanity update
  sanity.update(dt, playerPos, scene, entity?.getPosition());

  // Sanity hallucination text
  if (sanity.hasPendingTextHallucination()) showHallucinationText();

  // Event system
  eventSystem.update(dt);
  const visualEvents = eventSystem.consumeVisualEvents();
  visualEvents.forEach(ev => handleVisualEvent(ev));

  // Flowers animation
  flowers.update(time / 1000);

  // Rain animation
  if (rainSystem) {
    const pos = rainSystem.geometry.attributes.position.array;
    for(let i=1; i<pos.length; i+=3) {
      pos[i] -= dt * 10;
      if (pos[i] < -0.5) pos[i] = 20;
    }
    rainSystem.geometry.attributes.position.needsUpdate = true;
    rainSystem.position.copy(playerPos); // follow player
  }

  // Check death (entity catches player)
  if (entity && distToEntity < 1.5) triggerDeath('monster');

  // Check flower sight (win/fake condition)
  checkFlowerSight();

  // Post-processing updates
  updatePostProcessing(fearLevel, sanity, time);

  // HUD update (throttled)
  if (Math.floor(time / 500) !== Math.floor((time - dt * 1000) / 500)) updateHUD();

  composer.render();
}

// ─── Interactions ─────────────────────────────────────────────────────────────
function checkInteractions() {
  const pos = player.getPosition();

  // Lore fragment
  const fragment = lore.checkPickup(pos);
  if (fragment) {
    const data = lore.collect(fragment);
    sanity.restore(5);
    showLoreReader(data, lore.getCollectedCount(), lore.getTotalCount());
    if (lore.isAllCollected()) endingSystem.setAllLoreCollected(true);
    return;
  }

  // Doors
  const door = house.checkDoorInteraction(pos);
  if (door) {
    house.openDoor(door);
    audioEngine.playEvent('door_open'); // Optional if added
    return;
  }
}

// ─── Flower Sight ────────────────────────────────────────────────────────────
function checkFlowerSight() {
  if (gameState !== 'playing' || !flowers) return;
  
  const playerPos = player.getPosition();
  const cameraDir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  
  for (const flower of flowers.allFlowers) {
    if (!flower.parent) continue;
    
    const flowerPos = flower.position.clone().setY(0.5);
    const dist = playerPos.distanceTo(flowerPos);
    
    if (dist < 5.5) { // Must be reasonably close to see it clearly in the dark
      const dirToFlower = new THREE.Vector3().subVectors(flowerPos, playerPos).normalize();
      
      // If looking directly at it (FOV check)
      if (cameraDir.dot(dirToFlower) > 0.85) {
        if (flower.userData.isReal) {
          triggerVictory();
        } else {
          triggerFakeFlower(flower);
        }
        return;
      }
    }
  }
}

// ─── Fake Flower ─────────────────────────────────────────────────────────────
function triggerFakeFlower(flower) {
  gameState = 'cutscene';
  audioEngine.playEvent('fake_flower');
  flowers.removeFlower(flower, scene);
  sanity.drain(15);

  // Flash white briefly
  const flash = document.getElementById('event-flash');
  flash.style.opacity = '0.5';
  setTimeout(() => flash.style.opacity = '0', 300);

  // Show message
  showPrompt('It was never that easy...');

  setTimeout(() => {
    hidePrompt();
    // Spawn entity nearby
    if (entity) {
      const pos = player.getPosition();
      entity.position.set(pos.x + (Math.random() - 0.5) * 8, 0, pos.z + (Math.random() - 0.5) * 8);
    }
    gameState = 'playing';
  }, 2000);
}

// ─── Death ─────────────────────────────────────────────────────────────────
function triggerDeath(cause) {
  if (gameState === 'dead') return;
  gameState = 'dead';
  endingSystem.recordDeath();

  audioEngine.playEvent('death');

  // Screen distortion flash
  const flash = document.getElementById('event-flash');
  flash.style.background = '#ff0000';
  flash.style.opacity = '0.7';
  setTimeout(() => { flash.style.opacity = '0'; flash.style.background = '#fff'; }, 400);

  // Show death screen
  setTimeout(() => {
    showEndScreen({
      title: 'You Were Claimed By The Curse.',
      subtitle: cause === 'sanity' ? 'Your mind shattered before your body.' : `${entityName} found you.`,
      color: '#ff4444',
      bg: '#0a0000',
      message: cause === 'sanity'
        ? 'The darkness did not need to touch you. It only needed you to believe. And you believed.'
        : 'In your last moment, you saw its face clearly. It looked almost sad.',
      peaceful: false,
    });
  }, 1200);
}

// ─── Victory ─────────────────────────────────────────────────────────────────
function triggerVictory() {
  gameState = 'ending';
  const ending = endingSystem.determineEnding(sanity.sanity, curseStage.getStage());
  const content = endingSystem.getEndingContent(ending);

  // Transformation sequence
  audioEngine.playVictoryMusic();
  flowers.removeFlower(flowers.realFlower, scene);

  if (content.peaceful) {
    // Illuminate the scene
    const transitionLight = new THREE.AmbientLight(0xfffbe6, 0);
    scene.add(transitionLight);
    let progress = 0;
    const brighten = setInterval(() => {
      progress += 0.02;
      transitionLight.intensity = progress * 2;
      scene.fog.density = Math.max(0.005, 0.03 - progress * 0.025);
      // Warm up room lights
      house.getRoomLights().forEach(l => { l.color.setHex(0xfff3cc); l.intensity = progress * 2; });
      if (progress >= 1) clearInterval(brighten);
    }, 100);
  }

  // Despawn monster
  if (entity) { entity.dispose(); entity = null; }

  setTimeout(() => showEndScreen(content), 4000);
}

// ─── Stage Change ─────────────────────────────────────────────────────────────
function onStageChange(stage) {
  const el = document.getElementById('stage-transition');
  const text = document.getElementById('stage-transition-text');
  text.textContent = curseStage.getStageLabel();
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 3000);

  audioEngine.playEvent('stinger');

  if (stage >= 2) {
    // Tint walls red gradually
    const bloodColor = new THREE.Color(0.6 + stage * 0.1, 0, 0);
    scene.fog.color.set(new THREE.Color(0x150005));
  }
}

// ─── Post-Processing Updates ─────────────────────────────────────────────────
function updatePostProcessing(fearLevel, sanity, time) {
  if (!window._vigPass) return;
  const u = window._vigPass.uniforms;
  const sanityParams = sanity.getShaderParams();
  const fearNorm = fearLevel / 100;

  u.vignettePower.value = 0.1; // Minimal vignette
  u.chromaticAberration.value = 0.0; // Disabled color glitching
  u.sanityDistort.value = 0.0; // Disabled wavy screen distortion
  u.time.value = time / 1000;

  // Fear overlay
  const fearOverlay = document.getElementById('fear-overlay');
  if (fearOverlay) fearOverlay.style.opacity = (fearNorm * 0.7).toFixed(2);

  // Sanity overlay
  const sanityOverlay = document.getElementById('sanity-overlay');
  if (sanityOverlay) sanityOverlay.style.opacity = (sanityParams.distortionStrength * 8).toFixed(2);
}

// ─── HUD Updates ─────────────────────────────────────────────────────────────
function updateHUD() {
  // Battery
  const bat = document.getElementById('battery-bar');
  if (bat) { bat.style.width = (player?.battery * 100 || 0) + '%'; bat.style.background = player?.battery > 0.3 ? '#ff9944' : '#ff3322'; }

  // Sanity
  const san = document.getElementById('sanity-bar');
  if (san) {
    const s = sanity?.getNormalized() ?? 1;
    san.style.width = (s * 100) + '%';
    san.style.background = s > 0.5 ? '#aa55ff' : s > 0.25 ? '#ff8800' : '#ff2200';
  }

  // Stage
  const label = document.getElementById('stage-label');
  const dots = document.getElementById('stage-dots');
  if (label && curseStage) label.textContent = curseStage.getStageLabel();
  if (dots && curseStage) {
    dots.innerHTML = [1,2,3,4].map(i => `<div style="width:8px;height:8px;border-radius:50%;background:${i<=curseStage.getStage()?'#cc0044':'rgba(255,255,255,0.15)'}"></div>`).join('');
  }

  // Proximity prompt
  const pos = player?.getPosition();
  if (pos) {
    const frag = lore?.checkPickup(pos, 2.5);
    const door = house?.checkDoorInteraction(pos);
    
    if (frag) showPrompt(deviceDetector?.isMobile ? 'TAP USE to read' : 'Press E — Read note');
    else if (door) showPrompt(deviceDetector?.isMobile ? 'TAP USE to open door' : 'Press E — Open door');
    else hidePrompt();
  }
}

function showPrompt(text) {
  const el = document.getElementById('interact-prompt');
  const t = document.getElementById('prompt-text');
  if (el && t) { t.textContent = text; el.style.display = 'block'; }
}
function hidePrompt() {
  const el = document.getElementById('interact-prompt');
  if (el) el.style.display = 'none';
}

function showHallucinationText() {
  const texts = [
    "It knows you're here.",
    "You can't hide forever.",
    "Turn around.",
    "Don't look at it.",
    "Why are you still searching?",
    "You've always been here.",
    "It was never a house.",
  ];
  const el = document.getElementById('hallucination-text');
  if (!el) return;
  el.querySelector('div').textContent = texts[Math.floor(Math.random() * texts.length)];
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

function handleVisualEvent(ev) {
  if (ev.type === 'shadow_cross') {
    const flash = document.getElementById('event-flash');
    flash.style.opacity = '0.15';
    setTimeout(() => flash.style.opacity = '0', 200);
  }
}

function showLoreReader(frag, count, total) {
  gameState = 'reading';
  if (!deviceDetector.isMobile) document.exitPointerLock?.();
  const reader = document.getElementById('lore-reader');
  document.getElementById('lore-arc').textContent = frag.arc.toUpperCase() + ' — FRAGMENT';
  document.getElementById('lore-title').textContent = frag.title;
  document.getElementById('lore-body').textContent = frag.body;
  document.getElementById('lore-count').textContent = `${count} / ${total} FRAGMENTS`;
  reader.style.display = 'flex';
  document.getElementById('lore-close').onclick = () => {
    reader.style.display = 'none';
    gameState = 'playing';
    if (!deviceDetector.isMobile) inputManager.requestPointerLock(renderer.domElement);
  };
}

function showEndScreen(content) {
  document.getElementById('hud').style.display = 'none';
  const endScreen = document.getElementById('end-screen');
  endScreen.style.display = 'flex';
  endScreen.style.color = content.color;
  document.getElementById('end-bg').style.background = content.bg;
  document.getElementById('end-title').textContent = content.title;
  document.getElementById('end-subtitle').textContent = content.subtitle;
  document.getElementById('end-message').textContent = content.message;
  document.getElementById('btn-play-again').style.borderColor = content.color;
  document.getElementById('btn-play-again').style.color = content.color;
  document.getElementById('btn-play-again').onclick = startGame;
  gameState = 'ended';
}

function togglePause() {
  paused = !paused;
  gameState = paused ? 'paused' : 'playing';
  const menu = document.getElementById('pause-menu');
  menu.style.display = paused ? 'flex' : 'none';
  if (!deviceDetector.isMobile) {
    if (paused) document.exitPointerLock?.();
    else inputManager.requestPointerLock(renderer.domElement);
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap() {
  buildDOM();
  initRenderer();

  audioEngine = new AudioEngine();
  inputManager = new InputManager(deviceDetector);

  // Controls text
  const ctrlEl = document.getElementById('controls-text');
  if (ctrlEl) {
    ctrlEl.innerHTML = deviceDetector.isMobile ? `
      <b style="color:#cc88ff">Movement:</b> Left-thumb virtual joystick<br>
      <b style="color:#cc88ff">Look:</b> Drag right side of screen<br>
      <b style="color:#cc88ff">Interact:</b> USE button<br>
      <b style="color:#cc88ff">Flashlight:</b> 🔦 button<br>
      <b style="color:#cc88ff">Run:</b> RUN button (tap to toggle)<br>
      <b style="color:#cc88ff">Crouch:</b> ⬇ button<br>
    ` : `
      <b style="color:#cc88ff">Move:</b> WASD<br>
      <b style="color:#cc88ff">Look:</b> Mouse<br>
      <b style="color:#cc88ff">Interact:</b> E<br>
      <b style="color:#cc88ff">Flashlight:</b> F<br>
      <b style="color:#cc88ff">Jump:</b> Space<br>
      <b style="color:#cc88ff">Run:</b> Shift<br>
      <b style="color:#cc88ff">Crouch:</b> Ctrl<br>
      <b style="color:#cc88ff">Pause:</b> Escape<br>
    `;
  }

  // Seed display
  document.getElementById('lore-seed-display').textContent = `SEED: ${Math.floor(Math.random() * 0xfffff).toString(16).toUpperCase()}`;

  // Menu buttons
  document.getElementById('btn-play').addEventListener('click', async () => {
    await audioEngine.init();
    startGame();
  });
  document.getElementById('btn-about').addEventListener('click', () => {
    document.getElementById('how-to-play').style.display = 'flex';
  });
  document.getElementById('btn-resume')?.addEventListener('click', togglePause);
  document.getElementById('btn-restart')?.addEventListener('click', () => { paused = false; startGame(); });

  // Initial render loop (menu only)
  const menuLoop = (t) => {
    if (gameState === 'menu') {
      requestAnimationFrame(menuLoop);
      renderer.render(scene, camera);
    }
  };
  requestAnimationFrame(menuLoop);
}

bootstrap();
