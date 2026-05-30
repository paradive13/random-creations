// PersonalitySystem.js — Injects random traits into monster AI each run
export const TRAITS = {
  AGGRESSIVE:  { id: 'aggressive',  speedMult: 1.0, chaseRange: 20, attackDelay: 0.3, checkHideouts: false, patience: 0 },
  SILENT:      { id: 'silent',      soundMult: 0.1, noiseDetect: false },
  FAST:        { id: 'fast',        speedMult: 1.4 },
  STALKER:     { id: 'stalker',     stalksFirst: true, minWatchDist: 10, watchDuration: 8 },
  TELEPORTER:  { id: 'teleporter',  teleportChance: 0.002, teleportRange: 15 },
  MIMIC:       { id: 'mimic',       mimicsFootsteps: true, mimicsVoice: true },
  CUNNING:     { id: 'cunning',     checkCorners: true, avoidsLOS: true },
  PATIENT:     { id: 'patient',     waitOutsideHideouts: true, waitTime: 20 },
  RELENTLESS:  { id: 'relentless',  neverStopsChase: true, memoryDuration: 999 },
  TERRITORIAL: { id: 'territorial', favoriteRoom: true, defenseRadius: 12 },
};

const CONFLICTS = [
  ['aggressive', 'patient'],
  ['stalker', 'relentless'],
];

export class PersonalitySystem {
  constructor(rand) {
    this.rand = rand;
    this.activeTraits = this._rollTraits();
  }

  _rollTraits() {
    const pool = Object.values(TRAITS);
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const selected = [];
    const count = 2 + Math.floor(this.rand() * 2); // 2-3 traits
    for (const trait of pool) {
      if (selected.length >= count) break;
      // Check conflicts
      const conflicts = CONFLICTS.some(([a, b]) =>
        (trait.id === a && selected.some(t => t.id === b)) ||
        (trait.id === b && selected.some(t => t.id === a))
      );
      if (!conflicts) selected.push(trait);
    }
    return selected;
  }

  has(traitId) {
    return this.activeTraits.some(t => t.id === traitId);
  }

  get(traitId) {
    return this.activeTraits.find(t => t.id === traitId);
  }

  getSpeedMult() {
    let mult = 1.0;
    if (this.has('fast')) mult *= 1.4;
    if (this.has('aggressive')) mult *= 1.1;
    return mult;
  }

  getDescription() {
    return this.activeTraits.map(t => t.id.charAt(0).toUpperCase() + t.id.slice(1)).join(' + ');
  }
}
