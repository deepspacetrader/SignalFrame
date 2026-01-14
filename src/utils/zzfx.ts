/**
 * ZZFX - Zuper Zmall FX library
 * Miniature sound effect generator for web applications
 */

export interface ZzfxParams {
  volume?: number;
  randomness?: number;
  frequency?: number;
  attack?: number;
  sustain?: number;
  release?: number;
  slide?: number;
  deltaSlide?: number;
  pitchJump?: number;
  pitchJumpTime?: number;
  repeatTime?: number;
  noise?: number;
  modulation?: number;
  bitCrush?: number;
  delay?: number;
  sustainVolume?: number;
  decay?: number;
  tremolo?: number;
  phaser?: number;
  lowpass?: number;
  highpass?: number;
}

export class Zzfx {
  private audioContext: AudioContext | null = null;
  private masterVolume: number = 0.5;

  constructor() {
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
    }
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  play(params: ZzfxParams = {}): void {
    if (!this.audioContext) return;

    // Resume audio context if suspended (browser policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const [
      volume = 1,
      randomness = 0,
      frequency = 220,
      attack = 0,
      sustain = 0,
      release = 0.1,
      slide = 0,
      deltaSlide = 0,
      pitchJump = 0,
      pitchJumpTime = 0,
      repeatTime = 0,
      noise = 0,
      modulation = 0,
      bitCrush = 0,
      delay = 0,
      sustainVolume = 1,
      decay = 0,
      tremolo = 0,
      phaser = 0,
      lowpass = 0,
      highpass = 0
    ] = [
      params.volume || 1,
      params.randomness || 0,
      params.frequency || 220,
      params.attack || 0,
      params.sustain || 0,
      params.release || 0.1,
      params.slide || 0,
      params.deltaSlide || 0,
      params.pitchJump || 0,
      params.pitchJumpTime || 0,
      params.repeatTime || 0,
      params.noise || 0,
      params.modulation || 0,
      params.bitCrush || 0,
      params.delay || 0,
      params.sustainVolume || 1,
      params.decay || 0,
      params.tremolo || 0,
      params.phaser || 0,
      params.lowpass || 0,
      params.highpass || 0
    ];

    // Initialize parameters
    let PI2 = Math.PI * 2;
    let sign = (v: number) => v > 0 ? 1 : -1;
    let startSlide = slide * 500 * PI2 / frequency ** 2;
    let b = [];
    let c = 0;

    // Generate the sound
    for (let i = 0; i < 44100; ++i) {
      if (c < i) {
        c = i;
        let sample = 0;
        let time = i / 44100;

        // Apply envelope
        let envelope = 
          time < attack ? attack && time / attack :
          time < attack + sustain ? 1 :
          time < attack + sustain + release ? 
            1 - (time - attack - sustain) / release * (1 - decay) : 
            decay;

        // Apply tremolo
        envelope *= tremolo ? 1 - Math.sin(PI2 * time * 7) * tremolo * 0.5 : 1;

        // Generate waveform
        let wave = 
          Math.sin(PI2 * frequency * time * (1 + slide * time) + 
          Math.sin(PI2 * pitchJump * time) * pitchJumpTime) * 
          (1 - noise * Math.random());

        // Apply modulation
        if (modulation) {
          wave *= Math.sin(PI2 * modulation * time);
        }

        // Apply bit crush
        if (bitCrush) {
          wave = Math.round(wave * (1 << bitCrush)) / (1 << bitCrush);
        }

        sample = wave * envelope * this.masterVolume * volume;

        // Apply filters
        if (lowpass || highpass) {
          // Simplified filter implementation
          sample = sample * (1 - lowpass) + (b[i - 1] || 0) * lowpass;
        }

        b.push(sample);

        // Handle repeats
        if (repeatTime) {
          c += Math.floor(44100 * repeatTime);
        }
      }
    }

    // Create and play audio buffer
    const buffer = this.audioContext.createBuffer(1, b.length, 44100);
    const channel = buffer.getChannelData(0);
    channel.set(b);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Apply delay if specified
    if (delay) {
      const delayNode = this.audioContext.createDelay(1);
      delayNode.delayTime.value = delay;
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.5;
      
      source.connect(delayNode);
      delayNode.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
    }

    source.connect(this.audioContext.destination);
    source.start();
  }

  // Predefined sound effects
  playCompletion(): void {
    this.play({
      volume: 0.3,
      frequency: 800,
      attack: 0.01,
      sustain: 0.1,
      release: 0.2,
      slide: 0.3,
      modulation: 10,
      decay: 0.2
    });
  }

  playSuccess(): void {
    this.play({
      volume: 0.25,
      frequency: 523.25, // C5
      attack: 0.01,
      sustain: 0.05,
      release: 0.1,
      slide: 0.2,
      modulation: 5
    });
  }

  playNotification(): void {
    this.play({
      volume: 0.2,
      frequency: 440, // A4
      attack: 0.02,
      sustain: 0.08,
      release: 0.15,
      modulation: 8,
      tremolo: 0.1
    });
  }

  playPing(): void {
    this.play({
      volume: 0.15,
      frequency: 1200,
      attack: 0.001,
      sustain: 0.05,
      release: 0.1,
      slide: -0.5,
      modulation: 0
    });
  }

  playMultiplePings(count: number): void {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.playPing();
      }, i * 150); // 150ms between pings
    }
  }
}

// Global instance
export const zzfx = new Zzfx();
