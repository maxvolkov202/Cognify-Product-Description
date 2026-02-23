// Sound effect utility using Web Audio API

class SoundEffects {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Success chime - pleasant, short sound
  playSuccessChime() {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;

    // Create oscillator for a pleasant chord
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    
    const gain = ctx.createGain();
    
    // C major chord frequencies
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc2.frequency.setValueAtTime(659.25, now); // E5
    osc3.frequency.setValueAtTime(783.99, now); // G5
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'sine';
    
    // Connect oscillators to gain
    osc1.connect(gain);
    osc2.connect(gain);
    osc3.connect(gain);
    gain.connect(ctx.destination);
    
    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    // Start and stop
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
    osc3.stop(now + 0.4);
  }

  // Warning thud - low, gentle warning sound
  playWarningThud() {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Low frequency for "thud" effect
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
    
    osc.type = 'sine';
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Quick decay envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Button click - subtle feedback
  playClick() {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.frequency.setValueAtTime(800, now);
    osc.type = 'sine';
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Premium submit success — clean ascending two-note chime, ~0.5s
  playSubmitSuccess() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Note 1 — A5
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.frequency.setValueAtTime(880, now);
      osc1.type = "sine";
      osc1.connect(g1);
      g1.connect(ctx.destination);
      g1.gain.setValueAtTime(0, now);
      g1.gain.linearRampToValueAtTime(0.13, now + 0.015);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc1.start(now);
      osc1.stop(now + 0.2);

      // Note 2 — E6, slightly delayed
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.frequency.setValueAtTime(1318.5, now + 0.1);
      osc2.type = "sine";
      osc2.connect(g2);
      g2.connect(ctx.destination);
      g2.gain.setValueAtTime(0, now + 0.1);
      g2.gain.linearRampToValueAtTime(0.13, now + 0.115);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.55);
    } catch {
      // AudioContext may not be available
    }
  }
}

export const soundEffects = new SoundEffects();