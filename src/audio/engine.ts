/**
 * Synthesised sound (WebAudio, no samples): gas hiss from mass flow, fan whine from fan speed,
 * tire squeal from slip, a soft motor hum from speed. Created only after a user gesture.
 */
export interface AudioParams {
  massFlow: number;
  fanSpeed: number;
  slip: number;
  speed: number;
  throttle: number;
}

export class AudioEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private hissGain: GainNode;
  private hissFilter: BiquadFilterNode;
  private fanGain: GainNode;
  private fanOsc: OscillatorNode;
  private fanOsc2: OscillatorNode;
  private squealGain: GainNode;
  private squealFilter: BiquadFilterNode;
  private motorGain: GainNode;
  private motorOsc: OscillatorNode;

  constructor() {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.5;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);

    // White noise buffer shared by hiss and squeal.
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

    this.hissFilter = c.createBiquadFilter();
    this.hissFilter.type = 'bandpass';
    this.hissFilter.frequency.value = 3200;
    this.hissFilter.Q.value = 0.6;
    this.hissGain = c.createGain();
    this.hissGain.gain.value = 0;
    noise().connect(this.hissFilter).connect(this.hissGain).connect(this.master);

    this.fanOsc = c.createOscillator();
    this.fanOsc.type = 'sawtooth';
    this.fanOsc2 = c.createOscillator();
    this.fanOsc2.type = 'triangle';
    const fanFilter = c.createBiquadFilter();
    fanFilter.type = 'lowpass';
    fanFilter.frequency.value = 2400;
    this.fanGain = c.createGain();
    this.fanGain.gain.value = 0;
    this.fanOsc.connect(fanFilter);
    this.fanOsc2.connect(fanFilter);
    fanFilter.connect(this.fanGain).connect(this.master);
    this.fanOsc.start();
    this.fanOsc2.start();

    this.squealFilter = c.createBiquadFilter();
    this.squealFilter.type = 'bandpass';
    this.squealFilter.frequency.value = 1400;
    this.squealFilter.Q.value = 12;
    this.squealGain = c.createGain();
    this.squealGain.gain.value = 0;
    noise().connect(this.squealFilter).connect(this.squealGain).connect(this.master);

    this.motorOsc = c.createOscillator();
    this.motorOsc.type = 'sine';
    this.motorGain = c.createGain();
    this.motorGain.gain.value = 0;
    this.motorOsc.connect(this.motorGain).connect(this.master);
    this.motorOsc.start();
  }

  resume(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  update(p: AudioParams): void {
    const t = this.ctx.currentTime;
    const hiss = Math.min(1, Math.sqrt(p.massFlow / 120));
    this.hissGain.gain.setTargetAtTime(hiss * 0.55, t, 0.03);
    this.hissFilter.frequency.setTargetAtTime(2200 + hiss * 2600, t, 0.05);
    const f = 90 + p.fanSpeed * 520;
    this.fanOsc.frequency.setTargetAtTime(f, t, 0.08);
    this.fanOsc2.frequency.setTargetAtTime(f * 2.01, t, 0.08);
    this.fanGain.gain.setTargetAtTime(p.fanSpeed * 0.05, t, 0.1);
    const sq = Math.min(1, Math.max(0, p.slip - 0.95) * 2) * Math.min(1, p.speed / 4);
    this.squealGain.gain.setTargetAtTime(sq * 0.25, t, 0.05);
    this.motorOsc.frequency.setTargetAtTime(60 + p.speed * 9, t, 0.1);
    this.motorGain.gain.setTargetAtTime(
      Math.min(0.06, 0.01 + p.throttle * 0.04) * Math.min(1, p.speed / 2 + p.throttle),
      t,
      0.1,
    );
  }

  close(): void {
    void this.ctx.close();
  }
}
