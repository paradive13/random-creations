// EventSystem.js — Paranormal random events scheduler
export class EventSystem {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this._timer = 0;
    this._nextEvent = this._rollNext();
    this.pendingVisualEvents = [];
    this.onDoorEvent = null;
    this.onLightFlicker = null;
    this.stageMultiplier = 1.0;
  }

  _rollNext() {
    return 8 + Math.random() * 20;
  }

  setStageMultiplier(mult) { this.stageMultiplier = mult; }

  update(dt) {
    this._timer += dt;
    if (this._timer >= this._nextEvent / this.stageMultiplier) {
      this._timer = 0;
      this._nextEvent = this._rollNext();
      this._fireEvent();
    }
  }

  _fireEvent() {
    const events = [
      'creak', 'door_open', 'whisper', 'footsteps_above',
      'light_flicker', 'object_fall', 'shadow_cross',
      'cold_breath', 'painting_move', 'distant_moan',
    ];
    const type = events[Math.floor(Math.random() * events.length)];
    this._dispatch(type);
  }

  _dispatch(type) {
    switch (type) {
      case 'creak':
        this.audio.playEvent('creak');
        break;
      case 'door_open':
        this.audio.playEvent('door_slam');
        if (this.onDoorEvent) this.onDoorEvent();
        break;
      case 'whisper':
        this.audio.playEvent('whisper');
        this.pendingVisualEvents.push({ type: 'whisper_text', duration: 2 });
        break;
      case 'footsteps_above':
        this.audio.playEvent('footstep');
        setTimeout(() => this.audio.playEvent('footstep'), 500);
        setTimeout(() => this.audio.playEvent('footstep'), 900);
        break;
      case 'light_flicker':
        if (this.onLightFlicker) this.onLightFlicker(1.5);
        break;
      case 'object_fall':
        this.audio.playEvent('creak');
        this.pendingVisualEvents.push({ type: 'object_fall', duration: 0.1 });
        break;
      case 'shadow_cross':
        this.pendingVisualEvents.push({ type: 'shadow_cross', duration: 0.4 });
        break;
      case 'cold_breath':
        this.pendingVisualEvents.push({ type: 'cold_breath', duration: 3 });
        break;
      case 'painting_move':
        this.pendingVisualEvents.push({ type: 'painting_rotate', duration: 2 });
        break;
      case 'distant_moan':
        this.audio.playEvent('whisper');
        break;
    }
  }

  consumeVisualEvents() {
    const events = [...this.pendingVisualEvents];
    this.pendingVisualEvents = [];
    return events;
  }
}
