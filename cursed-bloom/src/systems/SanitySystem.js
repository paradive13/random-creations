// SanitySystem.js — Tracks sanity 0-100, triggers hallucinations
import * as THREE from 'three';

export const SANITY_TIERS = { CALM: 4, UNEASY: 3, DISTURBED: 2, BROKEN: 1 };

export class SanitySystem {
  constructor() {
    this.sanity = 100;
    this.tier = SANITY_TIERS.CALM;
    this.hallucinationObjects = [];
    this._hallucinationTimer = 0;
    this._hallucinationInterval = 15;
    this.onSanityZero = null;
  }

  drain(amount) {
    this.sanity = Math.max(0, this.sanity - amount);
    this._updateTier();
    if (this.sanity <= 0 && this.onSanityZero) this.onSanityZero();
  }

  restore(amount) {
    this.sanity = Math.min(100, this.sanity + amount);
    this._updateTier();
  }

  _updateTier() {
    if (this.sanity > 75) this.tier = SANITY_TIERS.CALM;
    else if (this.sanity > 50) this.tier = SANITY_TIERS.UNEASY;
    else if (this.sanity > 25) this.tier = SANITY_TIERS.DISTURBED;
    else this.tier = SANITY_TIERS.BROKEN;
  }

  getNormalized() { return this.sanity / 100; }

  update(dt, playerPos, scene, monsterPos) {
    // Drain near monster
    if (monsterPos) {
      const dist = playerPos.distanceTo(monsterPos);
      if (dist < 8) this.drain(dt * 5);
      else if (dist < 15) this.drain(dt * 2);
    }

    // Passive recovery
    this.restore(dt * 0.3);

    // Hallucination scheduling
    this._hallucinationTimer -= dt;
    if (this._hallucinationTimer <= 0 && this.tier <= SANITY_TIERS.DISTURBED) {
      this._triggerHallucination(scene, playerPos);
      this._hallucinationTimer = Math.max(5, this._hallucinationInterval * this.getNormalized());
    }

    // Clean old hallucinations
    this.hallucinationObjects = this.hallucinationObjects.filter(h => {
      h.life -= dt;
      if (h.life <= 0) { scene.remove(h.mesh); return false; }
      // Fade in/out
      if (h.mesh.material) {
        const progress = 1 - h.life / h.maxLife;
        h.mesh.material.opacity = progress < 0.2
          ? progress / 0.2
          : progress > 0.8
            ? (1 - progress) / 0.2
            : 1;
      }
      return true;
    });
  }

  _triggerHallucination(scene, playerPos) {
    if (this.tier > SANITY_TIERS.DISTURBED) return;

    const type = Math.random();
    if (type < 0.4) {
      // Fake shadow figure
      this._spawnShadowFigure(scene, playerPos);
    } else if (type < 0.7) {
      // Fake monster glimpse (handled via CSS by game)
      this._spawnShadowFigure(scene, playerPos, true);
    } else {
      // Floating text hallucination handled by HUD
      this._pendingTextHallucination = true;
    }
  }

  _spawnShadowFigure(scene, playerPos, tall = false) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 8;
    const pos = new THREE.Vector3(
      playerPos.x + Math.cos(angle) * dist,
      0,
      playerPos.z + Math.sin(angle) * dist
    );

    const h = tall ? 3.5 : 1.8;
    const geo = new THREE.BoxGeometry(0.6, h, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.position.y = h / 2;
    scene.add(mesh);

    const maxLife = 1.5 + Math.random() * 2;
    this.hallucinationObjects.push({ mesh, life: maxLife, maxLife });
  }

  hasPendingTextHallucination() {
    if (this._pendingTextHallucination) {
      this._pendingTextHallucination = false;
      return true;
    }
    return false;
  }

  getShaderParams() {
    const t = 1 - this.getNormalized();
    return {
      distortionStrength: t * t * 0.08,
      vignetteStrength: 0.3 + t * 0.5,
      chromaticAberration: t * 0.015,
      desaturation: t * 0.6,
    };
  }
}
