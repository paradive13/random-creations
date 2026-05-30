// DeviceDetector.js — Auto-detects device class and sets quality tier
export const QUALITY = {
  HIGH: 'high',
  MID: 'mid',
  MOBILE: 'mobile'
};

export class DeviceDetector {
  constructor() {
    this.isMobile = this._detectMobile();
    this.quality = this._detectQuality();
    this.isPortrait = window.innerHeight > window.innerWidth;
    this._setupOrientationWatcher();
  }

  _detectMobile() {
    return (
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }

  _detectQuality() {
    if (this.isMobile) return QUALITY.MOBILE;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return QUALITY.MID;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
      if (renderer.includes('intel') || renderer.includes('software') || renderer.includes('llvm')) {
        return QUALITY.MID;
      }
    }
    return QUALITY.HIGH;
  }

  _setupOrientationWatcher() {
    const check = () => {
      this.isPortrait = window.innerHeight > window.innerWidth;
      const overlay = document.getElementById('rotate-overlay');
      if (overlay) overlay.style.display = (this.isMobile && this.isPortrait) ? 'flex' : 'none';
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
  }

  getSettings() {
    return {
      shadowMapSize: this.quality === QUALITY.HIGH ? 2048 : this.quality === QUALITY.MID ? 1024 : 512,
      enableSSAO: this.quality === QUALITY.HIGH,
      enableVolumetricFog: this.quality !== QUALITY.MOBILE,
      maxParticles: this.quality === QUALITY.MOBILE ? 50 : 150,
      drawDistance: this.quality === QUALITY.MOBILE ? 25 : 50,
      targetFPS: this.quality === QUALITY.MOBILE ? 30 : 60,
      enableShadows: this.quality !== QUALITY.MOBILE,
      pixelRatio: this.quality === QUALITY.MOBILE
        ? Math.min(window.devicePixelRatio, 1.5)
        : Math.min(window.devicePixelRatio, 2.0)
    };
  }
}
