import { useEffect, useState, useSyncExternalStore } from 'react';
import { host } from '../app/host';
import type { Telemetry } from '../sim/types';

/** Re-render with fresh telemetry at most `hz` times per second. */
export function useTelemetry(hz = 10): Telemetry | null {
  const [t, setT] = useState<Telemetry | null>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / hz) return;
      last = now;
      const tel = host.sim?.telemetry;
      if (tel)
        setT({
          ...tel,
          nozzles: tel.nozzles.map((n) => ({ ...n })),
          wheels: tel.wheels.map((w) => ({ ...w })),
        });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hz]);
  return t;
}

/** Re-render when the host emits (challenge results, ghost ready, sim loaded…). */
export function useHost(): number {
  return useSyncExternalStore(
    (cb) => host.subscribe(cb),
    () => hostVersion(),
  );
}

let version = 0;
host.subscribe(() => {
  version++;
});
const hostVersion = () => version;
