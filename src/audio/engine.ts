/**
 * Sound: three recorded clips (motor loop, landing burst of air, applause) plus a soft
 * synthesised hiss for the smaller nozzle bursts. No tonal synthesis, so nothing whines.
 * Clips load after the first user gesture; if they fail, the simulator just stays quieter.
 */
type Clip = 'motor' | 'landing' | 'applause';

const CLIPS: Clip[] = ['motor', 'landing', 'applause'];
const MASTER = 0.7;

/** A seamless loop: the last `fade` seconds are crossfaded into the start. */
function loopable(ctx: BaseAudioContext, buf: AudioBuffer, fade: number): AudioBuffer {
  const F = Math.min(Math.round(fade * buf.sampleRate), Math.floor(buf.length / 3));
  const L = buf.length - F;
  const out = ctx.createBuffer(buf.numberOfChannels, L, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < L; i++) {
      if (i < F) {
        const k = i / F;
        dst[i] = src[i]! * k + src[L + i]! * (1 - k);
      } else dst[i] = src[i]!;
    }
  }
  return out;
}

function rms(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i]! * d[i]!;
  return Math.sqrt(s / Math.max(1, d.length));
}

export interface SoundState {
  /** Total nozzle mass flow, kg/s. */
  massFlow: number;
  /** Speed over the ground, m/s. */
  speed: number;
  /** Accelerator, 0..1. */
  throttle: number;
  /** Wheels on a surface (the motor only "works" with grip). */
  onGround: boolean;
}

export class AudioEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private hissGain: GainNode;
  private hissFilter: BiquadFilterNode;
  private clips: Partial<Record<Clip, AudioBuffer>> = {};
  private motor: { src: AudioBufferSourceNode; gain: GainNode; level: number } | null = null;
  /** The synthesised hiss steps aside while the landing clip plays. */
  private duckUntil = 0;

  constructor(baseUrl: string) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = MASTER;
    this.master.connect(c.destination);

    // Soft hiss of the jets (filtered noise), for the bursts that have no clip.
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    noise.start();
    this.hissFilter = c.createBiquadFilter();
    this.hissFilter.type = 'bandpass';
    this.hissFilter.frequency.value = 2500;
    this.hissFilter.Q.value = 0.5;
    this.hissGain = c.createGain();
    this.hissGain.gain.value = 0;
    noise.connect(this.hissFilter).connect(this.hissGain).connect(this.master);

    void this.load(baseUrl);
  }

  private async load(baseUrl: string): Promise<void> {
    await Promise.all(
      CLIPS.map(async (name) => {
        try {
          const res = await fetch(`${baseUrl}audio/${name}.mp3`);
          if (!res.ok) return;
          const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
          this.clips[name] = name === 'motor' ? loopable(this.ctx, buf, 0.08) : buf;
        } catch {
          /* sound is optional */
        }
      }),
    );
    const motor = this.clips.motor;
    if (!motor) return;
    const src = this.ctx.createBufferSource();
    src.buffer = motor;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(this.master);
    src.start();
    // The recording is quiet; bring it to a steady level.
    this.motor = { src, gain, level: Math.min(4, 0.13 / Math.max(rms(motor), 1e-3)) };
  }

  resume(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Freeze all sound (e.g. while the article is open). */
  suspend(): void {
    if (this.ctx.state === 'running') void this.ctx.suspend();
  }

  setMuted(m: boolean): void {
    this.master.gain.setTargetAtTime(m ? 0 : MASTER, this.ctx.currentTime, 0.05);
  }

  /** Play a one-shot clip. */
  play(name: 'landing' | 'applause', volume = 1): void {
    const buf = this.clips[name];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.master);
    src.start();
    if (name === 'landing') this.duckUntil = this.ctx.currentTime + buf.duration;
  }

  update(s: SoundState): void {
    const t = this.ctx.currentTime;
    const k = Math.min(1, Math.sqrt(Math.max(s.massFlow, 0) / 120));
    const duck = t < this.duckUntil ? 0.15 : 1;
    this.hissGain.gain.setTargetAtTime(k * 0.3 * duck, t, 0.03);
    this.hissFilter.frequency.setTargetAtTime(1800 + k * 2400, t, 0.05);
    if (this.motor) {
      // Pitch follows road speed; loudness follows load (accelerator) and fades in the air.
      const moving = Math.min(1, s.speed / 4);
      const load = s.onGround ? 0.35 + 0.65 * s.throttle : 0.15;
      const v = this.motor.level * moving * load;
      this.motor.gain.gain.setTargetAtTime(v, t, s.onGround ? 0.08 : 0.25);
      const rate = 0.75 + (Math.min(s.speed, 60) / 60) * 1.1;
      this.motor.src.playbackRate.setTargetAtTime(rate, t, 0.1);
    }
  }

  close(): void {
    void this.ctx.close();
  }
}
