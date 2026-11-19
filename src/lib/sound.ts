class SoundFX {
  private ctx: AudioContext | null = null;
  public muted = false;

  private getCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  tone(freq: number, duration = 0.08, type: OscillatorType = 'sine', gain = 0.05) {
    try {
      const ctx = this.getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore Web Audio lock errors
    }
  }

  win() {
    this.tone(523.25, 0.1, 'triangle', 0.06);
    setTimeout(() => this.tone(659.25, 0.1, 'triangle', 0.06), 90);
    setTimeout(() => this.tone(783.99, 0.18, 'triangle', 0.07), 180);
  }

  tick() {
    this.tone(920, 0.03, 'square', 0.02);
  }

  crash() {
    this.tone(160, 0.25, 'sawtooth', 0.06);
  }

  chip() {
    this.tone(1200, 0.04, 'sine', 0.04);
  }
}

export const soundFx = new SoundFX();
