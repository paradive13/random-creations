// Player.js — First-person controller: walk, run, crouch, jump, flashlight
import * as THREE from 'three';

export class Player {
  constructor(camera, scene, settings) {
    this.camera   = camera;
    this.scene    = scene;
    this.settings = settings;

    this.position = new THREE.Vector3(0, 1.7, 0);
    this.velocity = new THREE.Vector3();
    this.yaw      = 0;
    this.pitch    = 0;

    // Heights
    this.height       = 1.7;
    this.crouchHeight = 0.95;
    this.currentHeight = 1.7;
    this.isCrouching  = false;

    // Running
    this.isRunning = false;
    this.isMoving  = false;

    // Speeds
    this.speed      = 4.5;
    this.runSpeed   = 8.5;
    this.crouchSpeed = 2.0;

    // Mouse sensitivity
    this.mouseSens = settings.isMobile ? 0.003 : 0.0022;

    // Flashlight
    this.flashlight    = null;
    this.flashlightTarget = null;
    this.flashlightOn  = true;
    this.battery       = 1.0;
    this.flashlightFlicker = 0;

    // Jump / gravity
    this.isGrounded = true;
    this.vertVelocity = 0;
    this.gravity      = -18;
    this.jumpForce    = 6.5;
    this.groundY      = 1.7; // default ground
    this.floorY       = 0;   // current floor level (updated when entering rooms)

    // Step sounds
    this.stepTimer = 0;
    this.noiseLevel = 0;
    this.onStep = null;

    // Colliders & floors
    this.colliders = [];
    this.floors = []; // {y, x1,x2,z1,z2} — walkable floor slabs

    this._setupFlashlight();
    this._updateCamera();
  }

  _setupFlashlight() {
    this.flashlight = new THREE.SpotLight(0xfff0dd, 12, 35, Math.PI / 5, 0.35, 1.5);
    this.flashlight.castShadow = this.settings.enableShadows;
    if (this.settings.enableShadows) {
      this.flashlight.shadow.mapSize.width  = this.settings.shadowMapSize || 1024;
      this.flashlight.shadow.mapSize.height = this.settings.shadowMapSize || 1024;
      this.flashlight.shadow.camera.near = 0.1;
      this.flashlight.shadow.camera.far  = 35;
    }
    this.flashlightTarget = new THREE.Object3D();
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
  }

  setColliders(list) { this.colliders = list; }

  // Called each frame
  update(dt, input) {
    const sens = this.mouseSens;

    // ── Look ──
    this.yaw   -= input.look.dx * sens;
    this.pitch -= input.look.dy * sens;
    this.pitch  = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));

    // ── Crouch ──
    this.isCrouching = !!input.crouch;
    const targetH = this.isCrouching ? this.crouchHeight : this.height;
    this.currentHeight += (targetH - this.currentHeight) * Math.min(1, dt * 9);

    // ── Move ──
    this.isRunning = !!(input.run && !this.isCrouching);
    const spd = this.isCrouching ? this.crouchSpeed : this.isRunning ? this.runSpeed : this.speed;

    const fwd   = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move  = new THREE.Vector3();

    if (input.moveForward) move.addScaledVector(fwd,   1);
    if (input.moveBack)    move.addScaledVector(fwd,  -1);
    if (input.moveLeft)    move.addScaledVector(right,-1);
    if (input.moveRight)   move.addScaledVector(right, 1);

    this.isMoving  = move.lengthSq() > 0;
    this.noiseLevel = 0;

    if (this.isMoving) {
      move.normalize().multiplyScalar(spd * dt);
      this.position.addScaledVector(move, 1);
      this.noiseLevel = this.isRunning ? 1.0 : this.isCrouching ? 0.08 : 0.4;
    }

    // ── Jump ──
    if (input.jump && this.isGrounded) {
      this.vertVelocity = this.jumpForce;
      this.isGrounded   = false;
    }

    // ── Gravity & vertical movement ──
    if (!this.isGrounded) {
      this.vertVelocity += this.gravity * dt;
      this.position.y   += this.vertVelocity * dt;
    }

    // ── Floor detection ──
    // Determine which floor the player is on
    const groundLevel = this._resolveFloor();
    const eyeTarget   = groundLevel + this.currentHeight;

    if (this.position.y <= eyeTarget) {
      this.position.y   = eyeTarget;
      this.vertVelocity = 0;
      this.isGrounded   = true;
      this.groundY      = groundLevel;
    }

    // Prevent going below -BH-1
    if (this.position.y < -1.5) {
      this.position.y   = -1.5 + this.currentHeight;
      this.vertVelocity = 0;
      this.isGrounded   = true;
    }

    // ── Footstep sounds ──
    if (this.isMoving && this.isGrounded) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.isRunning ? 0.28 : 0.58;
        if (this.onStep) this.onStep(this.noiseLevel);
      }
    }

    // ── Battery drain ──
    if (this.flashlightOn) {
      this.battery = Math.max(0, this.battery - dt / 480);
      if (this.battery <= 0) this.flashlightOn = false;
    } else {
      this.battery = Math.min(1, this.battery + dt / 960);
    }

    // ── Flashlight flicker ──
    const baseI = 12 * this.battery;
    if (this.flashlightFlicker > 0) {
      this.flashlightFlicker -= dt;
      const on = Math.sin(Date.now() * 0.035) > 0.25;
      this.flashlight.intensity = (this.flashlightOn && on) ? baseI : 0;
    } else {
      this.flashlight.intensity = this.flashlightOn ? baseI : 0;
    }

    this._updateCamera();
  }

  // Returns the Y coordinate of the floor the player should stand on
  _resolveFloor() {
    const x = this.position.x, z = this.position.z;
    const curY = this.position.y;

    // House interior floors (approximate)
    // Outside ground = 0
    // Ground floor = 0
    // Upper floor = 3.2
    // Basement = -2.8

    const insideHouse = Math.abs(x) < 9.75 && Math.abs(z) < 6.75;

    if (!insideHouse) return 0; // outside = ground

    // Check if on upper floor
    if (curY > 3.2 + 0.3) return 3.2; // upper floor
    // Check if in basement
    if (curY < 0 - 0.3)   return -2.8; // basement floor
    // Ground floor
    return 0;
  }

  triggerFlickerNearMonster(intensity) {
    this.flashlightFlicker = intensity;
  }

  toggleFlashlight() {
    if (this.battery > 0) this.flashlightOn = !this.flashlightOn;
  }

  _updateCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Flashlight follows camera direction
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    this.flashlight.position.copy(this.camera.position).addScaledVector(dir, 0.12);
    this.flashlight.position.y -= 0.08;
    this.flashlightTarget.position.copy(this.camera.position).addScaledVector(dir, 20);
  }

  getPosition()    { return this.position.clone(); }
  getNoiseLevel()  { return this.noiseLevel; }

  dispose() {
    this.scene.remove(this.flashlight);
    this.scene.remove(this.flashlightTarget);
  }
}
