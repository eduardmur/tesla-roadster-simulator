/** Connects sim telemetry to the audio engine. Starts on the first user gesture; never autoplays. */
import { useEffect, useRef } from 'react';
import { host } from '../app/host';
import { announce } from '../app/captions';
import { useApp } from '../state/store';
import { AudioEngine } from './engine';

export default function AudioBridge() {
  const engine = useRef<AudioEngine | null>(null);
  const muted = useApp((s) => s.muted);
  const cue = useRef({ hiss: false, squeal: false });

  useEffect(() => {
    const start = () => {
      if (engine.current) {
        engine.current.resume();
        return;
      }
      try {
        engine.current = new AudioEngine();
        engine.current.setMuted(useApp.getState().muted);
      } catch {
        engine.current = null;
      }
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = host.sim?.telemetry;
      const e = engine.current;
      if (!t) return;
      const paused = useApp.getState().paused;
      const params = {
        massFlow: paused ? 0 : t.massFlow,
        fanSpeed: paused ? 0 : t.fanSpeed,
        slip: paused ? 0 : t.maxUtilization,
        speed: paused ? 0 : t.speed,
        throttle: paused ? 0 : (host.sim?.input.throttle ?? 0),
      };
      e?.update(params);
      // Captions for sound cues (shown whether or not sound is on).
      const hiss = params.massFlow > 5;
      if (hiss && !cue.current.hiss) announce('[loud hiss of compressed air]', 1500);
      cue.current.hiss = hiss;
      const squeal = params.slip > 1.05 && params.speed > 3;
      if (squeal && !cue.current.squeal) announce('[tires squeal: grip limit reached]', 1500);
      cue.current.squeal = squeal;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      engine.current?.close();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setMuted(muted);
  }, [muted]);

  return null;
}
