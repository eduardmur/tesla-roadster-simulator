/** Left dock: trim, challenges (with bests), assists and "what if" sliders. */
import { useState } from 'react';
import { host } from '../../app/host';
import { SPECS } from '../../data/specs';
import { PSI, TRIMS, TRIM_LABELS, isReported, type TrimId } from '../../physics/params';
import { CHALLENGE_INFO, type ChallengeKind } from '../../sim/challenges';
import type { SpawnId } from '../../sim/track';
import { useApp } from '../../state/store';
import { fmt, fmtInt } from '../format';
import { useHost } from '../hooks';
import { SpecValue } from '../SpecValue';

const KINDS: ChallengeKind[] = ['free', 'drag', 'curl', 'practice', 'hop', 'hover'];

const TRIM_NOTE: Record<TrimId, React.ReactNode> = {
  performance: (
    <>
      Fans + skirts, no thrusters. 0–60: <SpecValue id="perfZeroToSixty" />
    </>
  ),
  thrust: (
    <>
      Adds 4 rear thrusters and a 200 L tank. 0–60: <SpecValue id="thrustZeroToSixty" />
    </>
  ),
  rocket: (
    <>
      Full array: +4 lift, +2 yaw nozzles, 600 L of air. 0–60: <SpecValue id="rocketZeroToSixty" />
    </>
  ),
};

export function TrimSelector() {
  const trim = useApp((s) => s.trim);
  const set = useApp((s) => s.set);
  return (
    <section aria-labelledby="trim-h">
      <div className="eyebrow" id="trim-h">
        Trim
      </div>
      <div className="segmented" role="group" aria-label="Trim">
        {TRIMS.map((t) => (
          <button key={t} type="button" aria-pressed={trim === t} onClick={() => set({ trim: t })}>
            {TRIM_LABELS[t]}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: '0.85rem', margin: '6px 0 0' }}>
        {TRIM_NOTE[trim]}
      </p>
    </section>
  );
}

function ChallengeList() {
  useHost();
  const current = useApp((s) => s.challenge);
  const trim = useApp((s) => s.trim);
  return (
    <section aria-labelledby="ch-h">
      <div className="eyebrow" id="ch-h">
        Challenges
      </div>
      <ul className="challenge-list">
        {KINDS.map((k) => {
          const best = host.best(k, trim);
          return (
            <li key={k}>
              <button
                type="button"
                aria-current={current === k}
                onClick={() => host.startChallenge(k)}
              >
                <span className="title">
                  <span>{CHALLENGE_INFO[k].title}</span>
                  {best && <span className="mono muted">best {best.label}</span>}
                </span>
                <span className="blurb">{CHALLENGE_INFO[k].blurb}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="actions" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--small btn--cool"
          onClick={() => host.watchAutopilot('curl')}
        >
          Watch the autopilot do The Curl
        </button>
      </div>
    </section>
  );
}

const PLACES: { id: SpawnId; label: string }[] = [
  { id: 'hub', label: 'Test pad centre' },
  { id: 'drag', label: 'Drag strip' },
  { id: 'curl', label: 'The Curl run-in' },
  { id: 'practice', label: 'Practice curl run-in' },
  { id: 'tube', label: 'Wall & ceiling tube' },
  { id: 'tilt', label: 'Tilt rig' },
  { id: 'hop', label: 'Car hop lane' },
  { id: 'hover', label: 'Hover pad' },
];

function GoTo() {
  const [place, setPlace] = useState<SpawnId>('hub');
  const [tilt, setTilt] = useState(0);
  return (
    <section aria-labelledby="go-h">
      <div className="eyebrow" id="go-h">
        Go to
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <label className="sr-only" htmlFor="go-select">
          Place
        </label>
        <select
          id="go-select"
          value={place}
          onChange={(e) => setPlace(e.target.value as SpawnId)}
          style={{
            flex: 1,
            minHeight: 36,
            borderRadius: 8,
            background: 'var(--panel-2)',
            border: '1px solid var(--border-strong)',
            padding: '0 8px',
          }}
        >
          {PLACES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            host.stopChallenge();
            host.respawn(place);
            setTilt(0);
          }}
        >
          Go
        </button>
      </div>
      {place === 'tilt' && (
        <div className="slider">
          <label htmlFor="dock-tilt">
            <span>Tilt the rig</span>
            <span className="mono">{tilt}°</span>
          </label>
          <input
            id="dock-tilt"
            type="range"
            min={0}
            max={180}
            step={5}
            value={tilt}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTilt(v);
              if (host.sim) host.sim.tiltTarget = (v * Math.PI) / 180;
            }}
          />
        </div>
      )}
    </section>
  );
}

function Assists() {
  const assists = useApp((s) => s.assists);
  const fansOn = useApp((s) => s.fansOn);
  const setAssist = useApp((s) => s.setAssist);
  const toggle = useApp((s) => s.toggle);
  const [launch, setLaunch] = useState(host.launchControl);
  return (
    <section aria-labelledby="as-h">
      <div className="eyebrow" id="as-h">
        Systems &amp; assists
      </div>
      <label className="toggle">
        <span>
          Underbody fans <kbd>F</kbd>
        </span>
        <input type="checkbox" checked={fansOn} onChange={() => toggle('fansOn')} />
      </label>
      <label className="toggle">
        <span>Auto-level for landing</span>
        <input
          type="checkbox"
          checked={assists.autoLevel}
          onChange={(e) => setAssist('autoLevel', e.target.checked)}
        />
      </label>
      <label className="toggle">
        <span>Lift &amp; landing assist</span>
        <input
          type="checkbox"
          checked={assists.landingAssist}
          onChange={(e) => setAssist('landingAssist', e.target.checked)}
        />
      </label>
      <label className="toggle">
        <span>Drag strip launch control</span>
        <input
          type="checkbox"
          checked={launch}
          onChange={(e) => {
            host.launchControl = e.target.checked;
            setLaunch(e.target.checked);
          }}
        />
      </label>
      <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
        Turn both flight assists off for hard mode.
      </p>
    </section>
  );
}

export function WhatIf() {
  const w = useApp((s) => s.whatIf);
  const setW = useApp((s) => s.setWhatIf);
  const reset = useApp((s) => s.resetWhatIf);
  const fiction = !isReported(w);
  const gravityOptions: { label: string; value: number; pa: number }[] = [
    { label: 'Earth', value: SPECS.gravityEarth.value, pa: SPECS.ambientPressure.value },
    { label: 'Moon', value: SPECS.gravityMoon.value, pa: 0 },
    { label: 'Mars', value: SPECS.gravityMars.value, pa: SPECS.marsPressure.value },
  ];
  return (
    <section aria-labelledby="wi-h">
      <div
        className="eyebrow"
        id="wi-h"
        style={{ display: 'flex', justifyContent: 'space-between' }}
      >
        <span>What if…</span>
        <span
          className="tag tag--estimate"
          title="These sliders are fiction: they change the model, not the car"
        >
          {fiction ? 'fiction active' : 'fiction'}
        </span>
      </div>
      <div className="slider">
        <label htmlFor="wi-p">
          <span>Tank pressure</span>
          <span className="mono">{fmtInt(w.tankPressurePsi)} psi</span>
        </label>
        <input
          id="wi-p"
          type="range"
          min={1000}
          max={10000}
          step={100}
          value={w.tankPressurePsi}
          onChange={(e) => setW({ tankPressurePsi: Number(e.target.value) })}
        />
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          Reported: <SpecValue id="thrusterPressure" /> · Musk earlier:{' '}
          <SpecValue id="muskPressure" />
        </span>
      </div>
      <div className="slider">
        <label htmlFor="wi-v">
          <span>Tank volume</span>
          <span className="mono">×{fmt(w.tankVolumeScale, 2)}</span>
        </label>
        <input
          id="wi-v"
          type="range"
          min={0.25}
          max={3}
          step={0.05}
          value={w.tankVolumeScale}
          onChange={(e) => setW({ tankVolumeScale: Number(e.target.value) })}
        />
      </div>
      <div className="slider">
        <label htmlFor="wi-m">
          <span>Mass (full tanks)</span>
          <span className="mono">{fmtInt(w.massKg)} kg</span>
        </label>
        <input
          id="wi-m"
          type="range"
          min={1500}
          max={3500}
          step={10}
          value={w.massKg}
          onChange={(e) => setW({ massKg: Number(e.target.value) })}
        />
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          Default: <SpecValue id="vehicleMass" />
        </span>
      </div>
      <div className="slider">
        <label htmlFor="wi-f">
          <span>Fan power</span>
          <span className="mono">×{fmt(w.fanPowerScale, 2)}</span>
        </label>
        <input
          id="wi-f"
          type="range"
          min={0}
          max={2.5}
          step={0.05}
          value={w.fanPowerScale}
          onChange={(e) => setW({ fanPowerScale: Number(e.target.value) })}
        />
      </div>
      <div className="slider">
        <span style={{ fontSize: '0.875rem' }}>Gravity &amp; air</span>
        <div className="segmented" role="group" aria-label="Gravity">
          {gravityOptions.map((g) => (
            <button
              key={g.label}
              type="button"
              aria-pressed={w.gravity === g.value}
              onClick={() => setW({ gravity: g.value, ambientPressure: g.pa })}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div className="slider">
        <label htmlFor="wi-a">
          <span>Ambient pressure</span>
          <span className="mono">{fmt(w.ambientPressure / 1000, 1)} kPa</span>
        </label>
        <input
          id="wi-a"
          type="range"
          min={0}
          max={110000}
          step={500}
          value={w.ambientPressure}
          onChange={(e) => setW({ ambientPressure: Number(e.target.value) })}
        />
      </div>
      <div className="slider">
        <span style={{ fontSize: '0.875rem' }}>Tank gas &amp; thermal model</span>
        <div className="segmented" role="group" aria-label="Gas">
          {(['air', 'nitrogen'] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={w.gas === g}
              onClick={() => setW({ gas: g })}
            >
              {g === 'air' ? 'Air' : 'Nitrogen'}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Thermal model" style={{ marginTop: 6 }}>
          {(['adiabatic', 'blended', 'isothermal'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={w.thermalMode === m}
              onClick={() => setW({ thermalMode: m })}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn btn--small" onClick={reset} disabled={!fiction}>
        Reset to “as reported”
      </button>
      <span className="sr-only">
        Reported full pressure is {fmtInt(SPECS.thrusterPressure.value * PSI)} pascal.
      </span>
    </section>
  );
}

export function Dock() {
  const [tab, setTab] = useState<'drive' | 'whatif'>('drive');
  const labOpen = useApp((s) => s.labOpen);
  const [open, setOpen] = useState<boolean | null>(null);
  const [small] = useState(() => {
    try {
      return window.matchMedia('(max-width: 700px), (max-height: 520px)').matches;
    } catch {
      return false;
    }
  });
  // Collapse automatically while the lab drawer is open or on phones (unless the user expanded it).
  const expanded = open ?? (!labOpen && !small);
  if (!expanded) {
    return (
      <aside className="panel dock dock--collapsed" aria-label="Drive settings">
        <button
          type="button"
          className="btn btn--small"
          onClick={() => setOpen(true)}
          aria-expanded={false}
        >
          Trim, challenges &amp; what if
        </button>
      </aside>
    );
  }
  return (
    <aside className="panel dock" aria-label="Drive settings">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => setOpen(false)}
          aria-expanded={true}
        >
          Hide
        </button>
      </div>
      <div className="segmented" role="tablist" aria-label="Panel" style={{ marginBottom: 12 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'drive'}
          aria-pressed={tab === 'drive'}
          onClick={() => setTab('drive')}
        >
          Drive
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'whatif'}
          aria-pressed={tab === 'whatif'}
          onClick={() => setTab('whatif')}
        >
          What if
        </button>
      </div>
      {tab === 'drive' ? (
        <>
          <TrimSelector />
          <ChallengeList />
          <GoTo />
          <Assists />
        </>
      ) : (
        <WhatIf />
      )}
    </aside>
  );
}
