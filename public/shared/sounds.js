// Zero-Dependency Web Audio API Sound Synthesizer
// Generates game sound effects procedurally without any external audio files!

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('party_sounds_muted') === 'true';
    this.volume = 0.25;
    this.maxConcurrent = 6;
    this.activeVoices = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
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
    if (!this.ctx || this.activeVoices >= this.maxConcurrent) return;

    try {
      this.activeVoices++;
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
      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      };
    } catch (e) {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }
  }

  // Universal dispatch method for sounds.play('name')
  play(name) {
    if (this.muted) return;
    if (typeof this[name] === 'function') {
      this[name]();
    } else {
      this.click();
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
    this.playTone(220, 0.12, 'square', 540);
  }

  bounce() {
    this.playTone(300, 0.18, 'sine', 700);
  }

  buttonPress() {
    this.playTone(480, 0.08, 'sine', 320);
  }

  keyCollect() {
    this.playTone(880, 0.1, 'triangle', 1320);
  }

  success() {
    this.playTone(523.25, 0.08, 'sine');
    setTimeout(() => this.playTone(659.25, 0.12, 'sine'), 90);
  }

  error() {
    this.playTone(220, 0.15, 'sawtooth', 110);
  }

  buzzer() {
    this.playTone(180, 0.22, 'sawtooth', 90);
  }

  timerTick() {
    this.playTone(900, 0.03, 'triangle', 600);
  }

  dialTick() {
    this.playTone(1200, 0.02, 'sine', 800);
  }

  diceRoll() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playTone(600 + Math.random() * 800, 0.04, 'triangle', 300);
      }, i * 45);
    }
  }

  winFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 0.25, 'triangle'), idx * 110);
    });
  }
}

// Global sound manager instance with unified aliases
const soundInstance = new SoundEngine();
window.sounds = soundInstance;
window.partySounds = soundInstance;

// Auto-unlock Web Audio context on first click/touch
window.addEventListener('pointerdown', () => {
  if (window.sounds) window.sounds.init();
}, { once: true });
