// AudioEngine.js — Web Audio API spatial horror sound system
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.fearGain = null;
    this.ambientGain = null;
    this.musicGain = null;
    this.fearLevel = 0; // 0-100
    this.layers = {};
    this.initialized = false;
    this._oscillators = [];
    this._reverbs = {};
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.4;
    this.ambientGain.connect(this.masterGain);

    this.fearGain = this.ctx.createGain();
    this.fearGain.gain.value = 0;
    this.fearGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.masterGain);

    await this._buildReverbs();
    this._startAmbient();
    this.initialized = true;
  }

  async _buildReverbs() {
    const impulse = (duration, decay, reverse) => {
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(2, length, sampleRate);
      for (let c = 0; c < 2; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
          const n = reverse ? length - i : i;
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
        }
      }
      return buffer;
    };
    const makeReverb = (buf) => {
      const conv = this.ctx.createConvolver();
      conv.buffer = buf;
      return conv;
    };
    this._reverbs.small = makeReverb(impulse(0.5, 2, false));
    this._reverbs.large = makeReverb(impulse(2.0, 1.5, false));
    this._reverbs.hall = makeReverb(impulse(4.0, 1, false));

    Object.values(this._reverbs).forEach(r => r.connect(this.masterGain));
  }

  _createNoise(duration = 0, loop = true) {
    const bufSize = this.ctx.sampleRate * (duration || 2);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    return src;
  }

  _startAmbient() {
    // Wind
    const wind = this._createNoise();
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400;
    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.06;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientGain);
    wind.start();
    this.layers.wind = { source: wind, gain: windGain };

    // Rain
    const rain = this._createNoise();
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 2000;
    rainFilter.Q.value = 0.5;
    const rainGain = this.ctx.createGain();
    rainGain.gain.value = 0.12;
    rain.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(this.ambientGain);
    rain.start();
    this.layers.rain = { source: rain, gain: rainGain };

    // Sub rumble
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(40, this.ctx.currentTime);
    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.value = 0;
    osc.connect(rumbleGain);
    rumbleGain.connect(this.fearGain);
    osc.start();
    this.layers.rumble = { osc, gain: rumbleGain };

    // Heartbeat
    this._heartbeatActive = false;
    this._heartbeatInterval = null;
  }

  setFear(level) {
    if (!this.initialized) return;
    this.fearLevel = Math.max(0, Math.min(100, level));
    const t = this.ctx.currentTime;
    const f = this.fearLevel / 100;

    // Ambient volume down as fear rises
    this.ambientGain.gain.linearRampToValueAtTime(0.4 - f * 0.25, t + 0.5);
    // Fear layer up
    this.fearGain.gain.linearRampToValueAtTime(f * 0.7, t + 0.5);
    // Rumble
    this.layers.rumble.gain.gain.linearRampToValueAtTime(f > 0.5 ? (f - 0.5) * 0.2 : 0, t + 0.3);
    this.layers.rumble.osc.frequency.linearRampToValueAtTime(30 + f * 30, t + 0.5);

    // Heartbeat
    if (f > 0.3 && !this._heartbeatActive) this._startHeartbeat();
    if (f <= 0.3 && this._heartbeatActive) this._stopHeartbeat();
    if (this._heartbeatActive) {
      const bpm = 60 + f * 100;
      this._heartbeatBPM = bpm;
    }
  }

  _startHeartbeat() {
    this._heartbeatActive = true;
    this._heartbeatBPM = 80;
    const beat = () => {
      if (!this._heartbeatActive) return;
      this._playBeat();
      const interval = (60 / this._heartbeatBPM) * 1000;
      this._heartbeatTimeout = setTimeout(beat, interval);
    };
    beat();
  }

  _stopHeartbeat() {
    this._heartbeatActive = false;
    clearTimeout(this._heartbeatTimeout);
  }

  _playBeat() {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.5 * (this.fearLevel / 100), this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(g);
    g.connect(this.fearGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playEvent(type) {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    switch (type) {
      case 'creak': this._playCreak(); break;
      case 'door_slam': this._playDoorSlam(); break;
      case 'whisper': this._playWhisper(); break;
      case 'footstep': this._playFootstep(); break;
      case 'stinger': this._playStinger(); break;
      case 'fake_flower': this._playFakeFlower(); break;
      case 'death': this._playDeath(); break;
    }
  }

  _playCreak() {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    const freq = 200 + Math.random() * 300;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freq * 0.6, this.ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.05, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.connect(g);
    g.connect(this._reverbs.small);
    g.connect(this.ambientGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  _playDoorSlam() {
    const noise = this._createNoise(0.1, false);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.8, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    noise.connect(g);
    g.connect(this._reverbs.large);
    g.connect(this.masterGain);
    noise.start();
    noise.stop(this.ctx.currentTime + 0.3);
  }

  _playWhisper() {
    const noise = this._createNoise(1, false);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000 + Math.random() * 2000;
    filter.Q.value = 5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.3);
    g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this._reverbs.hall);
    noise.start();
    noise.stop(this.ctx.currentTime + 1.1);
  }

  _playFootstep() {
    const noise = this._createNoise(0.08, false);
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    g.gain.setValueAtTime(0.3, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.ambientGain);
    noise.start();
    noise.stop(this.ctx.currentTime + 0.1);
  }

  _playStinger() {
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(100 + i * 200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.5);
      g.gain.setValueAtTime(0.3 / (i + 1), this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    }
  }

  _playFakeFlower() {
    // Rising hopeful tone, then crash
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 1.0);
    osc.frequency.setValueAtTime(60, this.ctx.currentTime + 1.0);
    g.gain.setValueAtTime(0.3, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 1.0);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
    setTimeout(() => this.playEvent('door_slam'), 1200);
  }

  _playDeath() {
    // Crescendo then silence
    const noise = this._createNoise(2, false);
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(8000, this.ctx.currentTime + 1.5);
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 1.5);
    g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.0);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    noise.start();
    noise.stop(this.ctx.currentTime + 2.1);
  }

  playVictoryMusic() {
    if (!this.initialized) return;
    // Warm ascending tones
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.5);
        g.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 2);
        osc.connect(g);
        g.connect(this._reverbs.hall);
        g.connect(this.musicGain);
        osc.start();
        this._oscillators.push(osc);
      }, i * 400);
    });
    this.musicGain.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 3);
    this.ambientGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2);
    this.fearGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
    this._stopHeartbeat();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMasterVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }
}
