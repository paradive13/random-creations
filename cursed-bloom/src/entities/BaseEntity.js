// BaseEntity.js — AI base class with behavior tree, steering, and adaptive memory
import * as THREE from 'three';
import { AdaptiveAI } from '../systems/AdaptiveAI.js';

export const AI_STATE = {
  PATROL: 'patrol', INVESTIGATE: 'investigate',
  CHASE: 'chase', ATTACK: 'attack', WATCH: 'watch', IDLE: 'idle'
};

export class BaseEntity {
  constructor(scene, position, personality) {
    this.scene = scene;
    this.personality = personality;
    this.adaptiveAI = new AdaptiveAI();
    this.state = AI_STATE.PATROL;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.lastKnownPlayerPos = null;
    this.noiseTarget = null;
    this.watchTimer = 0;
    this.patrolTimer = 0;
    this.patrolTarget = null;
    this.waypointIndex = 0;
    this.attackCooldown = 0;
    this.teleportTimer = 0;
    this.mesh = null;
    this.waypoints = [];
    this._buildMesh();
    this._baseSpeed = 3.0;
  }

  _buildMesh() {
    // Override in subclasses — base is invisible capsule
    const geo = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, opacity: 0 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  getSpeed() {
    const stageParams = this._stageParams || { monsterSpeedMult: 1 };
    return this._baseSpeed * this.personality.getSpeedMult() * stageParams.monsterSpeedMult;
  }

  setStageParams(params) { this._stageParams = params; }
  setWaypoints(points) { this.waypoints = points; }

  update(dt, playerPos, playerVisible, noiseEvents) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.adaptiveAI.update(dt);

    // Handle teleport trait
    if (this.personality.has('teleporter')) {
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0 && Math.random() < 0.003) {
        this._teleport(playerPos);
        this.teleportTimer = 30 + Math.random() * 30;
      }
    }

    // Behavior tree
    const state = this._evaluateState(playerPos, playerVisible, noiseEvents);
    this._executeState(state, dt, playerPos);

    // Move mesh
    this.mesh.position.copy(this.position);
    this.mesh.position.y = this._getGroundHeight();

    // Face direction of movement
    if (this.velocity.lengthSq() > 0.01) {
      this.mesh.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
    }

    return this.state;
  }

  _evaluateState(playerPos, playerVisible, noiseEvents) {
    const distToPlayer = this.position.distanceTo(playerPos);
    const chaseRange = this.personality.has('aggressive') ? 20 : 15;

    // Attack
    if (distToPlayer < 1.8 && this.attackCooldown <= 0) {
      this.state = AI_STATE.ATTACK;
      return AI_STATE.ATTACK;
    }

    // Chase — line of sight
    if (playerVisible && distToPlayer < chaseRange) {
      this.lastKnownPlayerPos = playerPos.clone();
      this.state = AI_STATE.CHASE;
      return AI_STATE.CHASE;
    }

    // Stalker: watch before chase
    if (this.personality.has('stalker') && playerVisible && distToPlayer > 8) {
      this.watchTimer += 0.016;
      if (this.watchTimer < 5) {
        this.state = AI_STATE.WATCH;
        return AI_STATE.WATCH;
      }
    }

    // Chase last known position
    if (this.lastKnownPlayerPos && !this.personality.has('stalker')) {
      const distToLast = this.position.distanceTo(this.lastKnownPlayerPos);
      if (distToLast > 1.5) {
        this.state = AI_STATE.CHASE;
        return AI_STATE.CHASE;
      } else {
        if (!this.personality.has('relentless')) this.lastKnownPlayerPos = null;
      }
    }

    // Investigate noise
    if (noiseEvents && noiseEvents.length > 0 && !this.personality.has('silent')) {
      this.noiseTarget = noiseEvents[0].position.clone();
      this.state = AI_STATE.INVESTIGATE;
      return AI_STATE.INVESTIGATE;
    }

    // Adaptive: go to suspected hideout
    if (this.adaptiveAI.shouldCheckHideouts() && this.waypoints.length > 0) {
      const suggested = this.adaptiveAI.suggestWaypoint(this.waypoints);
      if (suggested) { this.patrolTarget = new THREE.Vector3(suggested.x, 0, suggested.z); }
    }

    this.state = AI_STATE.PATROL;
    return AI_STATE.PATROL;
  }

  _executeState(state, dt, playerPos) {
    switch (state) {
      case AI_STATE.ATTACK:
        this.attackCooldown = 2;
        this._onAttack?.();
        break;
      case AI_STATE.CHASE:
        const target = this.lastKnownPlayerPos || playerPos;
        this._moveTo(target, dt, this.getSpeed());
        break;
      case AI_STATE.INVESTIGATE:
        if (this.noiseTarget) {
          const done = this._moveTo(this.noiseTarget, dt, this.getSpeed() * 0.7);
          if (done) this.noiseTarget = null;
        }
        break;
      case AI_STATE.WATCH:
        // Face player, don't move
        const dir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        break;
      case AI_STATE.PATROL:
        this._patrol(dt);
        break;
    }
  }

  _patrol(dt) {
    if (!this.patrolTarget || this.position.distanceTo(this.patrolTarget) < 1.5) {
      if (this.waypoints.length > 0) {
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
        this.patrolTarget = this.waypoints[this.waypointIndex].clone();
      }
    }
    if (this.patrolTarget) this._moveTo(this.patrolTarget, dt, this.getSpeed() * 0.5);
  }

  _moveTo(target, dt, speed) {
    const dir = new THREE.Vector3().subVectors(target, this.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.5) { this.velocity.set(0, 0, 0); return true; }
    dir.normalize();
    this.velocity.copy(dir).multiplyScalar(speed);
    this.position.addScaledVector(dir, Math.min(speed * dt, dist));
    return false;
  }

  _teleport(nearPos) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 10;
    this.position.set(
      nearPos.x + Math.cos(angle) * dist,
      0,
      nearPos.z + Math.sin(angle) * dist
    );
    this.lastKnownPlayerPos = null;
  }

  _getGroundHeight() { return 1.0; }

  distanceTo(pos) { return this.position.distanceTo(pos); }
  getPosition() { return this.position.clone(); }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry?.dispose();
    this.mesh.material?.dispose();
  }
}
