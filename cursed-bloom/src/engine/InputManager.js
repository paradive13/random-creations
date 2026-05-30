// InputManager.js — Unified input for keyboard+mouse (desktop) and touch (mobile)
export class InputManager {
  constructor(deviceDetector) {
    this.device = deviceDetector;
    this.keys = {};
    this.mouse = { dx: 0, dy: 0, locked: false };
    this.actions = {
      moveForward: false, moveBack: false,
      moveLeft: false, moveRight: false,
      run: false, crouch: false, jump: false,
      interact: false, flashlight: false,
      pause: false,
    };
    this._joystick = { x: 0, y: 0 }; // -1 to 1
    this._touchLook = { dx: 0, dy: 0 };
    this._prevTouch = null;
    this._interactPressed = false;
    this._flashlightPressed = false;
    this._listeners = [];

    this._setupKeyboard();
    this._setupMouse();
    if (this.device.isMobile) this._setupTouch();
  }

  _setupKeyboard() {
    const down = (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyF') this._flashlightPressed = true;
      if (e.code === 'KeyE') this._interactPressed = true;
      if (e.code === 'Space') this._jumpPressed = true;
    };
    const up = (e) => { this.keys[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this._listeners.push(() => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    });
  }

  _setupMouse() {
    const move = (e) => {
      if (this.mouse.locked) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
      }
    };
    const lockChange = () => {
      this.mouse.locked = document.pointerLockElement !== null;
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('pointerlockchange', lockChange);
    this._listeners.push(() => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('pointerlockchange', lockChange);
    });
  }

  requestPointerLock(canvas) {
    if (!this.device.isMobile) canvas.requestPointerLock();
  }

  _setupTouch() {
    // Touch look on right side
    const touchStart = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.4) {
          this._prevTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
    };
    const touchMove = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this._prevTouch && t.identifier === this._prevTouch.id) {
          this._touchLook.dx += t.clientX - this._prevTouch.x;
          this._touchLook.dy += t.clientY - this._prevTouch.y;
          this._prevTouch.x = t.clientX;
          this._prevTouch.y = t.clientY;
        }
      }
    };
    const touchEnd = (e) => {
      for (const t of e.changedTouches) {
        if (this._prevTouch && t.identifier === this._prevTouch.id) {
          this._prevTouch = null;
        }
      }
    };
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('touchstart', touchStart, { passive: false });
      canvas.addEventListener('touchmove', touchMove, { passive: false });
      canvas.addEventListener('touchend', touchEnd, { passive: false });
    }
    window.addEventListener('touchstart', touchStart, { passive: false });
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('touchend', touchEnd, { passive: false });
  }

  setJoystick(x, y) {
    this._joystick.x = x;
    this._joystick.y = y;
  }

  triggerAction(name) {
    if (name === 'interact') this._interactPressed = true;
    if (name === 'flashlight') this._flashlightPressed = true;
    if (name === 'run') this.actions.run = !this.actions.run;
    if (name === 'crouch') this.actions.crouch = !this.actions.crouch;
    if (name === 'jump') this._jumpPressed = true;
  }

  update() {
    // Keyboard movement
    if (!this.device.isMobile) {
      this.actions.moveForward = !!(this.keys['KeyW'] || this.keys['ArrowUp']);
      this.actions.moveBack = !!(this.keys['KeyS'] || this.keys['ArrowDown']);
      this.actions.moveLeft = !!(this.keys['KeyA'] || this.keys['ArrowLeft']);
      this.actions.moveRight = !!(this.keys['KeyD'] || this.keys['ArrowRight']);
      this.actions.run = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
      this.actions.crouch = !!(this.keys['ControlLeft']);
    } else {
      // Joystick movement
      const dead = 0.15;
      this.actions.moveForward = this._joystick.y < -dead;
      this.actions.moveBack = this._joystick.y > dead;
      this.actions.moveLeft = this._joystick.x < -dead;
      this.actions.moveRight = this._joystick.x > dead;
    }

    this.actions.pause = !!(this.keys['Escape']);

    // Consume one-shot actions
    const interact = this._interactPressed;
    const flashlight = this._flashlightPressed;
    const jump = this._jumpPressed;
    this._interactPressed = false;
    this._flashlightPressed = false;
    this._jumpPressed = false;

    const look = {
      dx: this.device.isMobile ? this._touchLook.dx : this.mouse.dx,
      dy: this.device.isMobile ? this._touchLook.dy : this.mouse.dy,
    };
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this._touchLook.dx = 0;
    this._touchLook.dy = 0;

    return { ...this.actions, interact, flashlight, jump, look };
  }

  dispose() {
    this._listeners.forEach(fn => fn());
  }
}
