// CurseStageSystem.js — 4 escalating curse stages based on elapsed time
export class CurseStageSystem {
  constructor() {
    this.stage = 1;
    this.elapsed = 0;
    this.stageTimes = [0, 300, 600, 900]; // seconds: 0, 5min, 10min, 15min
    this.onStageChange = null;
    this._stageParams = this._getParams(1);
  }

  update(dt) {
    this.elapsed += dt;
    const newStage = this._calcStage();
    if (newStage !== this.stage) {
      this.stage = newStage;
      this._stageParams = this._getParams(newStage);
      if (this.onStageChange) this.onStageChange(newStage);
    }
  }

  _calcStage() {
    for (let i = this.stageTimes.length - 1; i >= 0; i--) {
      if (this.elapsed >= this.stageTimes[i]) return i + 1;
    }
    return 1;
  }

  _getParams(stage) {
    switch (stage) {
      case 1: return {
        monsterSpeedMult: 1.0, eventFreqMult: 1.0,
        wallBleed: 0, hallwayStretch: 0,
        roomSwap: false, pulsatingWalls: false,
        ambientColor: 0x0a0005, fogDensity: 0.008,
        lightFlickerRate: 0.3,
      };
      case 2: return {
        monsterSpeedMult: 1.2, eventFreqMult: 1.5,
        wallBleed: 0.4, hallwayStretch: 0.1,
        roomSwap: false, pulsatingWalls: false,
        ambientColor: 0x150005, fogDensity: 0.012,
        lightFlickerRate: 0.6,
      };
      case 3: return {
        monsterSpeedMult: 1.5, eventFreqMult: 2.5,
        wallBleed: 0.8, hallwayStretch: 0.3,
        roomSwap: true, pulsatingWalls: false,
        ambientColor: 0x200008, fogDensity: 0.016,
        lightFlickerRate: 1.2,
      };
      case 4: return {
        monsterSpeedMult: 2.0, eventFreqMult: 4.0,
        wallBleed: 1.0, hallwayStretch: 0.6,
        roomSwap: true, pulsatingWalls: true,
        ambientColor: 0x300010, fogDensity: 0.025,
        lightFlickerRate: 2.5,
      };
    }
  }

  getParams() { return this._stageParams; }
  getStage() { return this.stage; }
  getProgress() {
    const next = this.stageTimes[this.stage] || this.stageTimes[3] + 300;
    const prev = this.stageTimes[this.stage - 1] || 0;
    return (this.elapsed - prev) / (next - prev);
  }

  getStageLabel() {
    return ['', 'Stage I: The Haunting', 'Stage II: The Bleeding', 'Stage III: The Collapse', 'Stage IV: The Living House'][this.stage];
  }

  isFinalStage() { return this.stage >= 4; }
}
