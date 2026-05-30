// All 7 Horror Entities — unique appearances and behaviors
import * as THREE from 'three';
import { BaseEntity } from './BaseEntity.js';

// ─── Helper Materials ───
const shadowMat = () => new THREE.MeshLambertMaterial({ color: 0x050005, transparent: true, opacity: 0.85 });
const boneMat = () => new THREE.MeshLambertMaterial({ color: 0xddccaa });
const eyeMat = () => new THREE.MeshBasicMaterial({ color: 0xff0000, emissive: 0xff0000 });

// ─── 1. THE WATCHER ── Tall shadow figure, moves only when unseen
export class TheWatcher extends BaseEntity {
  constructor(scene, pos, personality) {
    super(scene, pos, personality);
    this._baseSpeed = 2.5;
    this._isBeingWatched = false;
    this._frozenPos = null;
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    // Elongated body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 2.2, 4, 8), shadowMat());
    body.position.y = 1.6;
    // Long thin arms
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 1.2, 4, 4), shadowMat());
      arm.position.set(side * 0.6, 1.5, 0);
      arm.rotation.z = side * 0.4;
      this.mesh.add(arm);
    });
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), shadowMat());
    head.position.y = 2.9;
    // Eyes
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat());
      eye.position.set(side * 0.1, 2.93, 0.24);
      this.mesh.add(eye);
    });
    this.mesh.add(body, head);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  setWatched(watched) { this._isBeingWatched = watched; }

  update(dt, playerPos, playerVisible, noiseEvents) {
    // Freeze when player looks at it
    if (playerVisible && this.position.distanceTo(playerPos) < 20) {
      this._isBeingWatched = true;
      this._frozenPos = this.position.clone();
      return this.state;
    }
    this._isBeingWatched = false;
    return super.update(dt, playerPos, playerVisible, noiseEvents);
  }
}

// ─── 2. THE CRAWLING MOTHER ── Crawls on walls and ceiling
export class TheCrawlingMother extends BaseEntity {
  constructor(scene, pos, personality) {
    super(scene, pos, personality);
    this._baseSpeed = 5.5;
    this._crawlPhase = 0;
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 8), shadowMat());
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.4;
    // 4 limbs
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.7, 4, 4), shadowMat());
      limb.position.set(Math.cos(angle) * 0.5, 0.3 + Math.sin(angle) * 0.2, Math.sin(angle) * 0.5);
      limb.rotation.z = angle;
      this.mesh.add(limb);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), shadowMat());
    head.position.set(0.5, 0.5, 0);
    this.mesh.add(body, head);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  update(dt, playerPos, playerVisible, noiseEvents) {
    this._crawlPhase += dt * 8;
    // Animate limbs
    this.mesh.children.forEach((c, i) => {
      if (i > 0 && i < 5) c.position.y = 0.3 + Math.sin(this._crawlPhase + i * 1.5) * 0.15;
    });
    return super.update(dt, playerPos, playerVisible, noiseEvents);
  }
}

// ─── 3. THE SMILING MAN ── Motionless when viewed, pursues when not
export class TheSmilingMan extends BaseEntity {
  constructor(scene, pos, personality) {
    super(scene, pos, personality);
    this._baseSpeed = 3.8;
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    const suit = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.0, 4, 8), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    suit.position.y = 1.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), new THREE.MeshLambertMaterial({ color: 0xf0d8c0 }));
    head.position.y = 2.1;
    // Smile (red line)
    const smileGeo = new THREE.TorusGeometry(0.12, 0.015, 4, 8, Math.PI);
    const smile = new THREE.Mesh(smileGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    smile.position.set(0, 2.03, 0.24);
    smile.rotation.z = Math.PI;
    // Eyes (black)
    [-1,1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6,6), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      eye.position.set(s * 0.09, 2.13, 0.24);
      this.mesh.add(eye);
    });
    this.mesh.add(suit, head, smile);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  update(dt, playerPos, playerVisible, noiseEvents) {
    if (playerVisible && this.position.distanceTo(playerPos) < 25) return this.state;
    return super.update(dt, playerPos, playerVisible, noiseEvents);
  }
}

// ─── 4. THE WHISPER CHILD ── Creates fake sounds, lures player
export class TheWhisperChild extends BaseEntity {
  constructor(scene, pos, personality) {
    super(scene, pos, personality);
    this._baseSpeed = 2.2;
    this._fakeSoundTimer = 0;
    this.onFakeSound = null;
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 8), shadowMat());
    body.position.y = 0.65;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), shadowMat());
    head.position.y = 1.2;
    // Hair-like wisps
    for (let i = 0; i < 5; i++) {
      const wisp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.005, 0.25, 4), shadowMat());
      wisp.position.set((i - 2) * 0.07, 1.35, 0);
      wisp.rotation.z = (i - 2) * 0.2;
      this.mesh.add(wisp);
    }
    this.mesh.add(body, head);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  update(dt, playerPos, playerVisible, noiseEvents) {
    this._fakeSoundTimer -= dt;
    if (this._fakeSoundTimer <= 0) {
      this._fakeSoundTimer = 8 + Math.random() * 12;
      if (this.onFakeSound) this.onFakeSound();
    }
    return super.update(dt, playerPos, playerVisible, noiseEvents);
  }
}

// ─── 5. THE HOLLOW PRIEST ── Teleports, causes light failure
export class TheHollowPriest extends BaseEntity {
  constructor(scene, pos, personality) {
    super(scene, pos, personality);
    this._baseSpeed = 2.0;
    this._teleportCooldown = 0;
    this.onLightFail = null;
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    // Robed figure
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.5, 8), shadowMat());
    robe.position.y = 1.25;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), shadowMat());
    head.position.y = 2.7;
    // Hood
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 8), shadowMat());
    hood.position.y = 2.92;
    // Staff
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), new THREE.MeshLambertMaterial({ color: 0x2a1a08 }));
    staff.position.set(0.5, 1.1, 0);
    this.mesh.add(robe, head, hood, staff);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  update(dt, playerPos, playerVisible, noiseEvents) {
    this._teleportCooldown -= dt;
    if (this._teleportCooldown <= 0 && Math.random() < 0.005) {
      this._teleport(playerPos);
      this._teleportCooldown = 15;
      if (this.onLightFail) this.onLightFail();
    }
    return super.update(dt, playerPos, playerVisible, noiseEvents);
  }
}

// ─── 6. THE WEEPING BRIDE ── Harmless-looking, instant attack on approach
export class TheWeepingBride extends BaseEntity {
  constructor(scene, pos, personality) {
    super(scene, pos, personality);
    this._baseSpeed = 0.5; // slow until triggered
    this._triggered = false;
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.0, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeff, transparent: true, opacity: 0.8 }));
    dress.position.y = 1.0;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 6), new THREE.MeshLambertMaterial({ color: 0xf0e8e0 }));
    body.position.y = 1.8;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshLambertMaterial({ color: 0xf0e8e0 }));
    head.position.y = 2.3;
    // Veil
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    veil.position.set(0, 2.2, 0.05);
    this.mesh.add(dress, body, head, veil);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  update(dt, playerPos, playerVisible, noiseEvents) {
    const dist = this.position.distanceTo(playerPos);
    if (!this._triggered && dist < 5) {
      this._triggered = true;
      this._baseSpeed = 7.0; // instant speed burst
    }
    if (this._triggered && dist > 20) { this._triggered = false; this._baseSpeed = 0.5; }
    return super.update(dt, playerPos, playerVisible, noiseEvents);
  }
}

// ─── 7. THE SKINLESS HUNTER ── Hunts by sound only
export class TheSkinlessHunter extends BaseEntity {
  constructor(scene, pos, personality) {
    super(scene, pos, personality);
    this._baseSpeed = 4.5;
    this._hearingRange = 15;
    this._noiseHeard = null;
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.0, 6, 8), new THREE.MeshLambertMaterial({ color: 0xcc3311 }));
    body.position.y = 1.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshLambertMaterial({ color: 0xbb2200 }));
    head.position.y = 2.1;
    // Exposed ribs
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.28 - i * 0.02, 0.025, 4, 8, Math.PI), boneMat());
      rib.position.y = 0.7 + i * 0.15;
      rib.rotation.y = Math.PI / 2;
      this.mesh.add(rib);
    }
    this.mesh.add(body, head);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  // Skinless Hunter ignores vision — hunts purely by noise
  update(dt, playerPos, playerIsRunning, noiseEvents) {
    if (playerIsRunning || (noiseEvents && noiseEvents.length > 0)) {
      this.lastKnownPlayerPos = playerPos.clone();
      this.state = 'chase';
    }
    return super.update(dt, playerPos, false, noiseEvents);
  }
}

// ─── Entity Manager ───
const ENTITIES = [TheWatcher, TheCrawlingMother, TheSmilingMan, TheWhisperChild, TheHollowPriest, TheWeepingBride, TheSkinlessHunter];
export const ENTITY_NAMES = ['The Watcher', 'The Crawling Mother', 'The Smiling Man', 'The Whisper Child', 'The Hollow Priest', 'The Weeping Bride', 'The Skinless Hunter'];

export function spawnRandomEntity(scene, position, personality, rand) {
  const idx = Math.floor(rand() * ENTITIES.length);
  return { entity: new ENTITIES[idx](scene, position, personality), name: ENTITY_NAMES[idx] };
}
