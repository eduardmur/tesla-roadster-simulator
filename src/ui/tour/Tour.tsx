/** The 6-chapter guided tour: captions on camera rails, then a hands-on task per chapter. */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { host } from '../../app/host';
import { enterMode } from '../../app/modes';
import { derived } from '../../data/derived';
import { TOUR, type TourChapter, type TourSetup, type TourTask } from '../../data/tour';
import type { SpecId } from '../../data/specs';
import { SIXTY_MPH } from '../../physics/params';
import { director } from '../../scene/cameras/director';
import { TILT_RIG } from '../../sim/track';
import { NO_INPUT } from '../../sim/types';
import { useApp } from '../../state/store';
import { MPH_PER_MS, fmt } from '../format';
import { GripPanel, NozzlePanel, TanksPanel } from '../lab/Lab';
import { SimTag, SpecValue } from '../SpecValue';

/** Render caption text, replacing {spec:id} and {calc:name} tokens with tagged values. */
export function RichText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(\{(?:spec|calc):[a-zA-Z0-9]+\})/g), [text]);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\{(spec|calc):([a-zA-Z0-9]+)\}$/.exec(p);
        if (!m) return <Fragment key={i}>{p}</Fragment>;
        if (m[1] === 'spec') return <SpecValue key={i} id={m[2] as SpecId} />;
        const d = derived()[m[2]!];
        if (!d) return <Fragment key={i}>?</Fragment>;
        return (
          <span key={i} className="spec" title={d.note}>
            <span className="spec__value">
              {fmt(d.value, d.digits)}
              {d.unit ? (d.unit === '%' ? ' %' : ` ${d.unit}`) : ''}
            </span>{' '}
            <SimTag />
          </span>
        );
      })}
    </>
  );
}

function setupChapter(setup: TourSetup): void {
  const app = useApp.getState();
  host.stopChallenge();
  const base = {
    paused: false,
    scrub: null,
    exploded: false,
    labOpen: false,
    hotspot: null,
  } as const;
  switch (setup) {
    case 'drag-tires':
      app.set({ ...base, trim: 'performance', fansOn: false, xray: false });
      host.respawn('drag');
      break;
    case 'tilt-rig':
      app.set({ ...base, trim: 'performance', fansOn: true, xray: false });
      host.respawn('tilt');
      break;
    case 'tank-vent':
      app.set({ ...base, trim: 'rocket', fansOn: true, xray: false });
      host.respawn('hub');
      break;
    case 'drag-thrust':
    case 'burn-all':
      app.set({ ...base, trim: 'rocket', fansOn: true, xray: false });
      host.respawn('drag');
      break;
    case 'hop':
      app.set({ ...base, trim: 'rocket', fansOn: true, xray: false });
      host.respawn('hover');
      break;
  }
}

interface TaskState {
  done: boolean;
  message: string;
  progress: number;
  failed?: string;
}

/** Poll the sim and decide whether the chapter's task is complete. */
function useTask(task: TourTask | null, active: boolean): [TaskState, () => void] {
  const [state, setState] = useState<TaskState>({ done: false, message: '', progress: 0 });
  const mem = useRef<{
    t0: number | null;
    rolled: boolean;
    airborne: boolean;
    thrustStart: number | null;
  }>({
    t0: null,
    rolled: false,
    airborne: false,
    thrustStart: null,
  });
  const reset = () => {
    mem.current = { t0: null, rolled: false, airborne: false, thrustStart: null };
    setState({ done: false, message: '', progress: 0 });
  };
  useEffect(() => {
    if (!active || !task) return;
    reset();
    const id = setInterval(() => {
      const sim = host.sim;
      if (!sim) return;
      const t = sim.telemetry;
      const m = mem.current;
      setState((prev) => {
        if (prev.done) return prev;
        switch (task) {
          case 'launch-tires':
          case 'launch-thrust': {
            if (m.t0 === null && sim.input.throttle > 0) m.t0 = sim.time;
            const p = Math.min(1, Math.max(0, t.forwardSpeed / SIXTY_MPH));
            if (m.t0 !== null && t.forwardSpeed >= SIXTY_MPH) {
              return {
                done: true,
                progress: 1,
                message: `0–60 mph in ${fmt(sim.time - m.t0, 2)} s (simulated).`,
              };
            }
            return {
              ...prev,
              progress: p,
              message: `${fmt(t.forwardSpeed * MPH_PER_MS, 0)} mph · tire use ${fmt(Math.min(t.maxUtilization, 9.9) * 100, 0)} %`,
            };
          }
          case 'tilt-ceiling': {
            const deg = (sim.tiltAngle * 180) / Math.PI;
            const fell = t.position[1] < TILT_RIG.axleHeight - 3;
            if (fell) return { ...prev, failed: 'It fell off! Put it back, and keep the fans on.' };
            if (deg > 175 && t.wheelsInContact >= 3 && t.upright < -0.9) {
              return {
                done: true,
                progress: 1,
                message: `Hanging upside down on ${fmt(t.downforce / 1000, 0)} kN of suction.`,
              };
            }
            return {
              ...prev,
              progress: deg / 180,
              message: `Road tilted ${fmt(deg, 0)}° · downforce ${fmt(t.downforce / 1000, 0)} kN`,
              failed: undefined,
            };
          }
          case 'vent-half': {
            const full = sim.params.tankFull?.pressure ?? 1;
            const p = 1 - t.tankPressure / full;
            if (t.tankPressure <= 0.5 * full) {
              return {
                done: true,
                progress: 1,
                message: `Half the pressure gone; the gas is at ${fmt(t.tankTemperature - 273.15, 0)} °C.`,
              };
            }
            return {
              ...prev,
              progress: p * 2,
              message: `${fmt(t.tankPressure / 1e5, 0)} bar · ${fmt(t.tankTemperature - 273.15, 0)} °C · ${fmt(t.tankMass, 0)} kg`,
            };
          }
          case 'hop-roll': {
            if (t.airborne) m.airborne = true;
            if (sim.fc.rolling) m.rolled = true;
            if (m.rolled && !t.airborne && t.wheelsInContact >= 3 && t.upright > 0.8) {
              return {
                done: true,
                progress: 1,
                message: `Rolled and landed, ${fmt(t.tankMass, 0)} kg of air left.`,
              };
            }
            return {
              ...prev,
              progress: m.rolled ? 0.66 : m.airborne ? 0.33 : 0,
              message: m.rolled
                ? 'Rolling… let auto-level bring it round.'
                : m.airborne
                  ? 'Airborne: press R!'
                  : 'Hold Shift to lift off.',
            };
          }
          case 'empty-tank': {
            if (m.thrustStart === null && t.rearThrust > 1000) m.thrustStart = sim.time;
            if (
              t.tankFraction < 0.03 ||
              (t.hasTank && t.tankPressure < sim.params.env.ambientPressure * 2)
            ) {
              const s = m.thrustStart !== null ? sim.time - m.thrustStart : 0;
              return { done: true, progress: 1, message: `Empty after ${fmt(s, 1)} s of thrust.` };
            }
            return {
              ...prev,
              progress: 1 - t.tankFraction,
              message: `${fmt(t.tankMass, 0)} kg left · ${fmt(t.rearThrust / 1000, 0)} kN`,
            };
          }
        }
        return prev;
      });
    }, 100);
    return () => clearInterval(id);
  }, [task, active]);
  return [state, reset];
}

function TiltPanel() {
  const [deg, setDeg] = useState(0);
  const fansOn = useApp((s) => s.fansOn);
  const toggle = useApp((s) => s.toggle);
  useEffect(() => {
    if (host.sim) host.sim.tiltTarget = (deg * Math.PI) / 180;
  }, [deg]);
  return (
    <div>
      <div className="slider">
        <label htmlFor="tilt">
          <span>Tilt the road</span>
          <span className="mono">{deg}°</span>
        </label>
        <input
          id="tilt"
          type="range"
          min={0}
          max={180}
          step={5}
          value={deg}
          onChange={(e) => setDeg(Number(e.target.value))}
          autoFocus
        />
      </div>
      <label className="toggle">
        <span>
          Fans <kbd>F</kbd>
        </span>
        <input type="checkbox" checked={fansOn} onChange={() => toggle('fansOn')} />
      </label>
      <button
        type="button"
        className="btn btn--small"
        onClick={() => {
          setDeg(0);
          host.respawn('tilt');
        }}
      >
        Put the car back
      </button>
    </div>
  );
}

function ChapterPanel({ chapter }: { chapter: TourChapter }) {
  if (!chapter.panel) return null;
  return (
    <aside className="panel tour-panel" aria-label="Chapter panel">
      {chapter.panel === 'tilt' && <TiltPanel />}
      {chapter.panel === 'tanks' && <TanksPanel />}
      {chapter.panel === 'nozzle' && <NozzlePanel />}
      {chapter.panel === 'grip' && <GripPanel />}
    </aside>
  );
}

export default function Tour() {
  const [ci, setCi] = useState(0);
  const [si, setSi] = useState(0);
  const [phase, setPhase] = useState<'caption' | 'task' | 'after'>('caption');
  const [left, setLeft] = useState(0);
  const chapter = TOUR[ci]!;
  const step = chapter.steps[si];
  const set = useApp((s) => s.set);
  const [task, resetTask] = useTask(chapter.task.id, phase === 'task');

  // Chapter setup.
  useEffect(() => {
    setupChapter(chapter.setup);
    director.cut = true;
  }, [chapter.setup]);

  // Camera and input per phase.
  useEffect(() => {
    if (phase === 'caption' && step) {
      director.shot = step.shot;
      set({ xray: !!step.xray });
      host.inputOverride = () => ({ ...NO_INPUT });
      if (host.sim) host.sim.holdBrake = true;
    } else {
      director.shot =
        chapter.task.id === 'tilt-ceiling'
          ? {
              kind: 'world',
              position: [TILT_RIG.x + 16, TILT_RIG.axleHeight + 1, TILT_RIG.z + 7],
              lookAt: [TILT_RIG.x, TILT_RIG.axleHeight - 0.5, TILT_RIG.z],
              fov: 40,
            }
          : chapter.task.id === 'vent-half'
            ? { kind: 'orbit', radius: 7, height: 2.2, speed: 0.12, fov: 42 }
            : null;
      set({ xray: chapter.task.id === 'vent-half' });
      const tiltTask = chapter.task.id === 'tilt-ceiling';
      host.inputOverride = tiltTask ? () => ({ ...NO_INPUT }) : null;
      if (host.sim) host.sim.holdBrake = chapter.task.id === 'vent-half';
    }
  }, [phase, step, chapter, set]);

  // Task timer.
  useEffect(() => {
    if (phase !== 'task') return;
    setLeft(chapter.task.seconds);
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, chapter]);

  useEffect(() => {
    if (phase === 'task' && task.done) setPhase('after');
  }, [phase, task.done]);

  // Leaving the tour restores normal control.
  useEffect(
    () => () => {
      director.shot = null;
      host.inputOverride = null;
      if (host.sim) {
        host.sim.holdBrake = false;
        host.sim.tiltTarget = 0;
      }
    },
    [],
  );

  const next = () => {
    if (phase === 'caption') {
      if (si < chapter.steps.length - 1) setSi(si + 1);
      else {
        setPhase('task');
        director.cut = false;
      }
    } else if (ci < TOUR.length - 1) {
      setCi(ci + 1);
      setSi(0);
      setPhase('caption');
    }
  };

  const retry = () => {
    setupChapter(chapter.setup);
    resetTask();
    setPhase('caption');
    setSi(chapter.steps.length - 1);
    setTimeout(() => setPhase('task'), 0);
  };

  const isLast = ci === TOUR.length - 1;
  const timeUp = phase === 'task' && left === 0 && !task.done;

  return (
    <>
      <ChapterPanel chapter={chapter} />
      <section className="panel tour-caption" aria-live="polite" aria-labelledby="tour-h">
        <div className="chapter">
          <h2 id="tour-h" className="eyebrow" style={{ margin: 0 }}>
            {chapter.title}
          </h2>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => enterMode('drive')}
          >
            Exit tour
          </button>
        </div>
        <div className="tour-progress" aria-label={`Chapter ${ci + 1} of ${TOUR.length}`}>
          {TOUR.map((c, i) => (
            <span key={c.id} className={i < ci ? 'is-done' : i === ci ? 'is-current' : ''} />
          ))}
        </div>
        {phase === 'caption' && step && (
          <>
            <p>
              <RichText text={step.text} />
            </p>
            {step.specs && step.specs.length > 0 && (
              <p className="muted" style={{ fontSize: '0.875rem', marginTop: -6 }}>
                {step.specs.map((id) => (
                  <span key={id} style={{ marginRight: 14 }}>
                    <SpecValue id={id} label />
                  </span>
                ))}
              </p>
            )}
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={next} autoFocus>
                {si < chapter.steps.length - 1 ? 'Next' : 'Try it'}
              </button>
              <span className="muted mono" style={{ alignSelf: 'center', fontSize: '0.8rem' }}>
                {si + 1}/{chapter.steps.length}
              </span>
            </div>
          </>
        )}
        {phase === 'task' && (
          <>
            <div className="task">
              <strong>Your turn ({left} s):</strong> <RichText text={chapter.task.instruction} />
              <div className="muted" style={{ fontSize: '0.875rem' }}>
                <RichText text={chapter.task.hint} />
              </div>
            </div>
            <div className="bar" aria-hidden="true">
              <div
                className="bar__fill bar__fill--thrust"
                style={{ width: `${Math.min(1, task.progress) * 100}%` }}
              />
            </div>
            <p className="mono" style={{ fontSize: '0.9rem' }}>
              {task.failed ?? task.message}
            </p>
            <div className="actions">
              {timeUp ? (
                <>
                  <button type="button" className="btn btn--primary" onClick={retry} autoFocus>
                    Try again
                  </button>
                  <button type="button" className="btn" onClick={() => setPhase('after')}>
                    Skip
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  onClick={() => setPhase('after')}
                >
                  Skip task
                </button>
              )}
              <button type="button" className="btn btn--small btn--ghost" onClick={retry}>
                Restart task
              </button>
            </div>
          </>
        )}
        {phase === 'after' && (
          <>
            {task.done && <p className="mono">{task.message}</p>}
            <p>
              <RichText text={chapter.takeaway} />
            </p>
            <div className="actions">
              {isLast ? (
                <>
                  <button
                    type="button"
                    className="btn btn--primary"
                    autoFocus
                    onClick={() => {
                      enterMode('drive');
                      host.watchAutopilot('curl');
                    }}
                  >
                    Watch the autopilot do The Curl
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      enterMode('drive');
                      useApp.getState().set({ trim: 'rocket' });
                      host.startChallenge('curl');
                    }}
                  >
                    Try the ramp yourself
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn--primary" onClick={next} autoFocus>
                  Next chapter
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
