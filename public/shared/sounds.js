// Zero-Dependency Web Audio API Sound Synthesizer
// Generates game sound effects procedurally without any external audio files!

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('party_sounds_muted') === 'true';
    this.volume = 0.25;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('party_sounds_muted', this.muted);
    return this.muted;
  }

  playTone(freq, duration, type = 'sine', sweepTo = null) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (sweepTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, sweepTo), this.ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  // Common Sound Presets
  click() {
    this.playTone(800, 0.04, 'triangle', 400);
  }

  cardFlip() {
    this.playTone(400, 0.08, 'triangle', 150);
  }

  chipClink() {
    this.playTone(1800, 0.06, 'sine', 1200);
  }

  jump() {
    this.playTone(250, 0.12, 'sine', 600);
  }

  bounce() {
    this.playTone(200, 0.18, 'sine', 800);
  }

  buttonPress() {
    this.playTone(350, 0.1, 'square', 250);
  }

  keyCollect() {
    this.playTone(600, 0.08, 'sine');
    setTimeout(() => this.playTone(900, 0.12, 'sine'), 60);
    setTimeout(() => this.playTone(1200, 0.2, 'sine'), 120);
  }

  success() {
    this.playTone(523.25, 0.1, 'sine'); // C5
    setTimeout(() => this.playTone(659.25, 0.1, 'sine'), 80); // E5
    setTimeout(() => this.playTone(783.99, 0.25, 'sine'), 160); // G5
  }

  error() {
    this.playTone(220, 0.15, 'sawtooth', 120);
    setTimeout(() => this.playTone(180, 0.2, 'sawtooth', 90), 100);
  }

  timerTick() {
    this.playTone(1000, 0.03, 'sine', 800);
  }

  buzzer() {
    this.playTone(150, 0.35, 'sawtooth');
  }

  dialTick() {
    this.playTone(1200, 0.02, 'sine', 900);
  }

  diceRoll() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playTone(600 + Math.random() * 300, 0.04, 'triangle'), i * 40);
    }
  }

  winFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 0.25, 'triangle'), idx * 120);
    });
  }
}

// Global sound manager instance
window.partySounds = new SoundEngine();

// Auto-unlock Web Audio context on first click/touch
window.addEventListener('pointerdown', () => {
  if (window.partySounds) window.partySounds.init();
}, { once: true });

