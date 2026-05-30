// AdaptiveAI.js — Monster learns player behavior during session
export class AdaptiveAI {
  constructor() {
    this.hidingSpotVisits = {}; // roomId -> count
    this.escapeRoutes = [];     // recent player positions when fleeing
    this.avgNoiseLevel = 0;
    this.flashlightUsage = 0;
    this.closetChecks = 0;
    this._updateCount = 0;
    this._decayTimer = 0;
  }

  recordHide(roomId) {
    this.hidingSpotVisits[roomId] = (this.hidingSpotVisits[roomId] || 0) + 1;
  }

  recordFleeRoute(pos) {
    this.escapeRoutes.push(pos.clone());
    if (this.escapeRoutes.length > 20) this.escapeRoutes.shift();
  }

  recordNoise(level) {
    this.avgNoiseLevel = this.avgNoiseLevel * 0.9 + level * 0.1;
  }

  recordFlashlightUse() {
    this.flashlightUsage++;
  }

  update(dt) {
    // Memory decay over time
    this._decayTimer += dt;
    if (this._decayTimer > 120) { // every 2 minutes
      this._decayTimer = 0;
      Object.keys(this.hidingSpotVisits).forEach(k => {
        this.hidingSpotVisits[k] = Math.max(0, this.hidingSpotVisits[k] - 1);
      });
      this.flashlightUsage = Math.max(0, this.flashlightUsage - 2);
    }
  }

  // Returns next waypoint suggestion for monster based on patterns
  suggestWaypoint(roomCenters) {
    // Find the most visited room
    let bestRoom = null, bestScore = 0;
    roomCenters.forEach((center, i) => {
      const visits = this.hidingSpotVisits[i] || 0;
      if (visits > bestScore) { bestScore = visits; bestRoom = center; }
    });

    // After 2+ visits to same room, monster checks it
    if (bestScore >= 2 && bestRoom) return bestRoom;

    // If player flees same direction repeatedly, intercept
    if (this.escapeRoutes.length >= 5) {
      const recent = this.escapeRoutes.slice(-5);
      const avgX = recent.reduce((s, p) => s + p.x, 0) / 5;
      const avgZ = recent.reduce((s, p) => s + p.z, 0) / 5;
      // Return point slightly ahead of average escape direction
      return { x: avgX, y: 0, z: avgZ };
    }

    return null;
  }

  // Should monster check closets / hiding spots?
  shouldCheckHideouts() {
    const totalHides = Object.values(this.hidingSpotVisits).reduce((s, v) => s + v, 0);
    return totalHides >= 2;
  }

  // Should monster hunt by flashlight visibility?
  huntByLight() {
    return this.flashlightUsage > 5;
  }

  // Is player a quiet player?
  isPlayerQuiet() {
    return this.avgNoiseLevel < 0.3;
  }
}
