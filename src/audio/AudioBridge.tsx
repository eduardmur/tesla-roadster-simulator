/** Connects sim telemetry to the audio engine. Starts on the first user gesture; never autoplays. */
import { useEffect, useRef } from 'react';
import { host } from '../app/host';
import { useApp } from '../state/store';
import { AudioEngine } from './engine';

export default function AudioBridge() {
  const engine = useRef<AudioEngine | null>(null);
  const muted = useApp((s) => s.muted);

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
      const sim = host.sim;
      const flow = sim && !sim.paused ? sim.telemetry.massFlow : 0;
      engine.current?.update(flow);
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
