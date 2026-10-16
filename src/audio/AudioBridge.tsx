/**
 * Connects the sim to the audio engine. Starts on the first user gesture; never autoplays.
 * Motor follows speed and the accelerator; the landing clip plays when the braking burn
 * starts (or at touchdown); applause follows a clean landing.
 */
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
        engine.current = new AudioEngine(import.meta.env.BASE_URL);
        engine.current.setMuted(useApp.getState().muted);
      } catch {
        engine.current = null;
      }
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);

    let landingPlayed = false;
    let cheeredFor: unknown = null;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const e = engine.current;
      const sim = host.sim;
      if (!e || !sim) return;
      const app = useApp.getState();
      if (app.articleOpen) {
        e.suspend();
        return;
      }
      e.resume();
      const t = sim.telemetry;
      const running = !sim.paused;
      e.update({
        massFlow: running ? t.massFlow : 0,
        speed: running ? t.speed : 0,
        throttle: running ? sim.input.throttle : 0,
        onGround: t.wheelsInContact >= 2,
      });

      // Landing: the braking burst of air just before touchdown (or touchdown itself).
      // Re-arm for the next run once the car is back before the drop.
      if (app.stage !== 'flight' && app.stage !== 'landed' && app.stage !== 'failed') {
        landingPlayed = false;
      }
      if (app.stage === 'flight' && !landingPlayed) {
        const braking = t.altitude < 12 && t.velocity[1] < -2 && t.liftThrust > 10_000;
        const touchdown = !t.airborne && t.wheelsInContact >= 2 && t.altitude < 1;
        if (braking || touchdown) {
          e.play('landing', 0.9);
          landingPlayed = true;
        }
      }
      if (app.mode === 'done' && app.result?.success && cheeredFor !== app.result) {
        cheeredFor = app.result;
        e.play('applause', 0.8);
      }
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
