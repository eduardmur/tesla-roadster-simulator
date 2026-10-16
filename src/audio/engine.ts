/**
 * Synthesised sound (WebAudio, no samples): only the hiss of air leaving the nozzles,
 * scaled by mass flow. No tonal sounds, so nothing whines in the background.
 */
export class AudioEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private hissGain: GainNode;
  private hissFilter: BiquadFilterNode;
  private rumbleGain: GainNode;

  constructor() {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(c.destination);

    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = () => {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.start();
      return src;
    };

    // Bright hiss of the jets.
    this.hissFilter = c.createBiquadFilter();
    this.hissFilter.type = 'bandpass';
    this.hissFilter.frequency.value = 2500;
    this.hissFilter.Q.value = 0.5;
    this.hissGain = c.createGain();
    this.hissGain.gain.value = 0;
    noise().connect(this.hissFilter).connect(this.hissGain).connect(this.master);

    // Low roar that comes with big mass flows.
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 220;
    this.rumbleGain = c.createGain();
    this.rumbleGain.gain.value = 0;
    noise().connect(low).connect(this.rumbleGain).connect(this.master);
  }

  resume(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }

  /** massFlow in kg/s. */
  update(massFlow: number): void {
    const t = this.ctx.currentTime;
    const k = Math.min(1, Math.sqrt(Math.max(massFlow, 0) / 120));
    this.hissGain.gain.setTargetAtTime(k * 0.5, t, 0.03);
    this.hissFilter.frequency.setTargetAtTime(1800 + k * 2400, t, 0.05);
    this.rumbleGain.gain.setTargetAtTime(k * 0.9, t, 0.05);
  }

  close(): void {
    void this.ctx.close();
  }
}
