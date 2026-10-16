/** "Look inside" lab drawer: component cards and the Grip, Tanks, Nozzle, Underbody and Energy panels. */
import { useEffect, useState } from 'react';
import { host } from '../../app/host';
import { COMPONENTS, componentsFor, type CarComponent } from '../../data/components';
import { SPECS } from '../../data/specs';
import {
  nozzleGeometries,
  nozzlePerformance,
  nozzleProfile,
  firstShockDiamondDistance,
  throatDiameter,
} from '../../physics';
import { refillEnergy, refillPower } from '../../physics/energy';
import { gripBudget } from '../../physics/tires';
import { SKIRT_PROBES } from '../../physics/layout';
import { useApp, type LabTab } from '../../state/store';
import { COLORS } from '../theme';
import { BAR_PER_PA, KGF_PER_N, PSI_PER_PA, fmt, fmtInt } from '../format';
import { useTelemetry } from '../hooks';
import { SimTag, SpecValue } from '../SpecValue';
import { LineChart, StackedBar } from './charts';

const TABS: { id: LabTab; label: string }[] = [
  { id: 'telemetry', label: 'Parts' },
  { id: 'grip', label: 'Grip' },
  { id: 'tanks', label: 'Tanks' },
  { id: 'nozzle', label: 'Nozzle' },
  { id: 'underbody', label: 'Underbody' },
  { id: 'energy', label: 'Energy' },
];

function ComponentCard({ c }: { c: CarComponent }) {
  const trim = useApp((s) => s.trim);
  const set = useApp((s) => s.set);
  const available = c.trims.includes(trim);
  return (
    <article className="component-card">
      <button
        type="button"
        className="btn btn--small btn--ghost"
        onClick={() => set({ hotspot: null })}
      >
        ← All parts
      </button>
      <h3 style={{ marginTop: 10 }}>{c.label}</h3>
      <p>{c.what}</p>
      <div className="eyebrow">Reported numbers</div>
      <ul>
        {c.specs.map((id) => (
          <li key={id}>
            <SpecValue id={id} label />
          </li>
        ))}
      </ul>
      <div className="eyebrow">Our estimates</div>
      <ul>
        {c.estimates.map((id) => (
          <li key={id}>
            <SpecValue id={id} label />
          </li>
        ))}
      </ul>
      {c.demo && (
        <button
          type="button"
          className="btn btn--primary"
          disabled={!available}
          onClick={() => host.runDemo(c.demo!.action)}
        >
          See it work: {c.demo.label}
        </button>
      )}
      {!available && <p className="muted">Not fitted to this trim. Switch trim to try it.</p>}
    </article>
  );
}

function PartsPanel() {
  const hotspot = useApp((s) => s.hotspot);
  const trim = useApp((s) => s.trim);
  const set = useApp((s) => s.set);
  const exploded = useApp((s) => s.exploded);
  const toggle = useApp((s) => s.toggle);
  const c = COMPONENTS.find((x) => x.id === hotspot);
  if (c) return <ComponentCard c={c} />;
  return (
    <>
      <p>
        Click a glowing marker on the car, or pick a part below. Thrust parts are{' '}
        <strong style={{ color: COLORS.thrust }}>warm</strong>, suction parts{' '}
        <strong style={{ color: COLORS.suction }}>cool</strong>.
      </p>
      <div className="actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="btn btn--small"
          aria-pressed={exploded}
          onClick={() => toggle('exploded')}
        >
          Exploded view
        </button>
      </div>
      <ul className="challenge-list">
        {componentsFor(trim).map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => set({ hotspot: x.id })}>
              <span className="title">{x.label}</span>
              <span className="blurb">{x.what.split('. ')[0]}.</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function GripPanel() {
  const t = useTelemetry(10);
  const sim = host.sim;
  if (!t || !sim) return null;
  const p = sim.params;
  const g = p.env.gravity;
  const maxThrust = t.nozzles
    .filter((n) => n.kind === 'rear')
    .reduce(
      (s, n) =>
        s + n.available * (sim.nozzles.find((x) => x.layout.id === n.id)?.group.maxDuty ?? 1),
      0,
    );
  const b = gripBudget(p.mu, t.mass, g, t.downforce, maxThrust);
  const max = Math.max(150_000, b.tireOnly + b.suctionAdded + b.thrust);
  const toG = (f: number) => f / (t.mass * g);
  return (
    <>
      <p>
        Tires can push with at most <strong>μ × N</strong>. Suction raises N without adding mass.
        Thrust doesn’t touch the tires at all.
      </p>
      <StackedBar
        max={max}
        label={
          <>
            Force available to accelerate, right now <SimTag />
          </>
        }
        parts={[
          { label: 'tires alone', value: b.tireOnly, color: '#d7e0ec' },
          {
            label: 'added by suction',
            value: b.suctionAdded,
            color: COLORS.suction,
            pattern: true,
          },
          { label: 'thrust', value: b.thrust, color: COLORS.thrust },
        ]}
      />
      <dl className="kv">
        <dt>tires alone (μ·m·g)</dt>
        <dd>
          {fmt(b.tireOnly / 1000, 1)} kN = {fmt(toG(b.tireOnly), 2)} g
        </dd>
        <dt>+ suction (μ·D)</dt>
        <dd>
          {fmt(b.suctionAdded / 1000, 1)} kN = +{fmt(toG(b.suctionAdded), 2)} g
        </dd>
        <dt>+ max rear thrust</dt>
        <dd>
          {fmt(b.thrust / 1000, 1)} kN = +{fmt(toG(b.thrust), 2)} g
        </dd>
        <dt>motors can deliver</dt>
        <dd>{fmt(p.motorPeakForce / 1000, 0)} kN peak (est.)</dd>
      </dl>
      <p className="muted" style={{ fontSize: '0.875rem', marginTop: 10 }}>
        Reported: tires alone <SpecValue id="tireOnlyGrip" />, with fans{' '}
        <SpecValue id="fanCorneringG" /> cornering. Tesla: thrusters make{' '}
        <SpecValue id="thrustVsTiresMin" />–<SpecValue id="thrustVsTiresMax" /> the tire force.
        Legend: plain = tires, hatched = suction, warm = thrust.
      </p>
    </>
  );
}

export function TanksPanel() {
  const t = useTelemetry(6);
  const w = useApp((s) => s.whatIf);
  const setW = useApp((s) => s.setWhatIf);
  const sim = host.sim;
  if (!t || !sim) return null;
  if (!t.hasTank) return <p>The Performance trim carries no air. Switch to Thrust or Rocket.</p>;
  const hist = sim.history.toArray();
  const full = sim.params.tankFull!;
  const xs = hist.map((h) => h.t - (hist[hist.length - 1]?.t ?? 0));
  return (
    <>
      <p>
        No pump: the tank just empties. The gas left inside does work pushing the rest out, so it
        cools. Thrust falls with pressure.
      </p>
      <LineChart
        title="Tank pressure and temperature over the last 30 seconds"
        xs={xs}
        xLabel="s"
        series={[
          {
            label: 'pressure (bar)',
            color: COLORS.thrust,
            values: hist.map((h) => h.pressure * BAR_PER_PA),
            min: 0,
            max: full.pressure * BAR_PER_PA * 1.05,
            unit: 'bar',
          },
          {
            label: 'temperature (°C)',
            color: COLORS.suction,
            dash: '5 4',
            values: hist.map((h) => h.temperature - 273.15),
            min: -120,
            max: 40,
            unit: '°C',
          },
        ]}
      />
      <dl className="kv">
        <dt>pressure</dt>
        <dd>
          {fmtInt(t.tankPressure * PSI_PER_PA)} psi ({fmtInt(t.tankPressure * BAR_PER_PA)} bar)
        </dd>
        <dt>air left</dt>
        <dd>
          {fmt(t.tankMass, 1)} of {fmt(full.mass, 0)} kg
        </dd>
        <dt>gas temperature</dt>
        <dd>{fmt(t.tankTemperature - 273.15, 1)} °C</dd>
        <dt>full rear thrust lasts</dt>
        <dd>{fmt(t.airLeftFullThrust, 1)} s from here</dd>
      </dl>
      <div className="eyebrow" style={{ marginTop: 12 }}>
        Thermal model
      </div>
      <div className="segmented" role="group" aria-label="Thermal model">
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
      <div className="actions" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn btn--small btn--primary"
          onClick={() => host.runDemo('rear-burst')}
        >
          Vent 1 s (brakes on)
        </button>
        <button type="button" className="btn btn--small" onClick={() => sim.refill()}>
          Refill instantly
        </button>
      </div>
      <p className="muted" style={{ fontSize: '0.875rem' }}>
        Storage: <SpecValue id="thrusterPressure" />, <SpecValue id="airMass" /> in{' '}
        <SpecValue id="airVolumeTotal" /> (Rocket). Compressibility{' '}
        <SpecValue id="compressibility" />.
      </p>
    </>
  );
}

export function NozzlePanel() {
  const t = useTelemetry(6);
  const sim = host.sim;
  if (!t || !sim) return null;
  const geo = nozzleGeometries().rear;
  const p0 = t.hasTank ? t.tankPressure : (sim.params.tankFull?.pressure ?? 0);
  const T0 = t.hasTank ? t.tankTemperature : 293;
  const pa = sim.params.env.ambientPressure;
  const gas = sim.params.gas;
  const st = nozzlePerformance(geo, gas, p0, T0, pa);
  const prof = nozzleProfile(geo, gas, p0, T0, pa, 40);
  const W = 400;
  const H = 180;
  const maxR = Math.sqrt(3);
  const xs = (x: number) => 20 + ((x + 1) / 2) * (W - 140);
  const r = (a: number) => (Math.sqrt(a) / maxR) * 34;
  const maxM = Math.max(4, ...prof.map((s) => s.mach));
  const De = throatDiameter(geo.throatArea * geo.areaRatio);
  const diamond = firstShockDiamondDistance(st, De, pa);
  const plumeX0 = xs(1);
  return (
    <>
      <p>
        At the throat the air reaches the speed of sound (Mach 1). The widening bell then
        accelerates it to Mach {fmt(st.exitMach, 1)}.{' '}
        {st.regime === 'underexpanded'
          ? 'It leaves above ambient pressure and keeps expanding outside: shock diamonds.'
          : `Flow regime: ${st.regime}.`}
      </p>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Nozzle cross-section. Exit Mach ${fmt(st.exitMach, 1)}.`}
      >
        {/* walls */}
        <polyline
          points={prof.map((s) => `${xs(s.x)},${60 - r(s.areaRatio)}`).join(' ')}
          fill="none"
          stroke="#c8d2de"
          strokeWidth={2}
        />
        <polyline
          points={prof.map((s) => `${xs(s.x)},${60 + r(s.areaRatio)}`).join(' ')}
          fill="none"
          stroke="#c8d2de"
          strokeWidth={2}
        />
        <line
          x1={xs(0)}
          x2={xs(0)}
          y1={14}
          y2={106}
          stroke="rgba(255,255,255,0.25)"
          strokeDasharray="3 3"
        />
        <text x={xs(0)} y={12} textAnchor="middle">
          throat
        </text>
        {/* plume with shock diamonds */}
        {t.hasTank &&
          st.choked &&
          [0, 1, 2, 3, 4].map((i) => {
            const cell = 34;
            const x = plumeX0 + i * cell;
            return (
              <polygon
                key={i}
                points={`${x},60 ${x + cell / 2},${60 - 12 + i} ${x + cell},60 ${x + cell / 2},${60 + 12 - i}`}
                fill={COLORS.suction}
                opacity={0.55 - i * 0.1}
              />
            );
          })}
        {/* Mach line */}
        <polyline
          points={prof.map((s) => `${xs(s.x)},${170 - (s.mach / maxM) * 55}`).join(' ')}
          fill="none"
          stroke={COLORS.thrust}
          strokeWidth={2}
        />
        <polyline
          points={prof.map((s) => `${xs(s.x)},${170 - s.pressureRatio * 55}`).join(' ')}
          fill="none"
          stroke={COLORS.suction}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        <text x={W - 112} y={124} fill={COLORS.thrust}>
          Mach (0–{fmt(maxM, 0)})
        </text>
        <text x={W - 112} y={140} fill={COLORS.suction}>
          p / p₀ (0–1)
        </text>
      </svg>
      <dl className="kv">
        <dt>tank (stagnation) pressure</dt>
        <dd>{fmtInt(p0 * BAR_PER_PA)} bar</dd>
        <dt>throat / exit diameter</dt>
        <dd>
          {fmt(throatDiameter(geo.throatArea) * 1000, 0)} / {fmt(De * 1000, 0)} mm
        </dd>
        <dt>exit Mach, pressure</dt>
        <dd>
          {fmt(st.exitMach, 2)}, {fmt(st.exitPressure * BAR_PER_PA, 2)} bar
        </dd>
        <dt>exit temperature</dt>
        <dd>
          {fmt(st.exitTemperature - 273.15, 0)} °C{st.exitTemperature < 95 ? ' *' : ''}
        </dd>
        <dt>mass flow / nozzle</dt>
        <dd>{fmt(st.massFlow, 1)} kg/s</dd>
        <dt>thrust / nozzle</dt>
        <dd>{fmt(st.thrust / 1000, 2)} kN</dd>
        <dt>effective exhaust velocity</dt>
        <dd>{fmtInt(st.effectiveVelocity)} m/s</dd>
        <dt>first shock diamond</dt>
        <dd>{diamond > 0 ? `≈ ${fmt(diamond * 100, 1)} cm` : '—'}</dd>
      </dl>
      <p className="muted" style={{ fontSize: '0.875rem' }}>
        {st.exitTemperature < 95 && (
          <>
            * Below the point where nitrogen condenses, so in reality part of the jet turns to mist;
            that is the white plume. We ignore it (it barely changes thrust).{' '}
          </>
        )}
        F = ṁ·vₑ + (pₑ − pₐ)·Aₑ. Throat sized so 4 nozzles give <SpecValue id="rearThrustTotal" />{' '}
        at <SpecValue id="thrusterPressure" />. Area ratio <SpecValue id="nozzleAreaRatio" />. Try
        “Moon” in What if: with no air outside, thrust goes up. <SimTag />
      </p>
    </>
  );
}

export function UnderbodyPanel() {
  const t = useTelemetry(10);
  const sim = host.sim;
  if (!t || !sim) return null;
  const pa = sim.params.env.ambientPressure;
  const res = sim.params.suction.residualGap;
  const seal = t.probeGaps.map((g) => 1 / (1 + Math.max(g / res - 1, 0) * 0.5));
  const dpN = Math.min(t.deltaP / sim.params.suctionTarget, 1);
  const cells: { x: number; z: number; v: number }[] = [];
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 10; j++) {
      const z = 1.25 - (i + 0.5) * (2.5 / 16);
      const x = -0.8 + (j + 0.5) * (1.6 / 10);
      let ws = 0;
      let q = 0;
      SKIRT_PROBES.forEach((p, k) => {
        const d = Math.hypot(x - p[0], z - p[2]) + 0.15;
        const w = 1 / (d * d);
        ws += w;
        q += w * (seal[k] ?? 0);
      });
      cells.push({ x, z, v: dpN * (q / ws) });
    }
  const cividis = (v: number) => {
    const a = [0, 34, 78];
    const b = [124, 123, 120];
    const c = [255, 234, 70];
    const m = (u: number[], w: number[], k: number) =>
      u.map((x, i) => Math.round(x + (w[i]! - x) * k));
    const col = v < 0.5 ? m(a, b, v * 2) : m(b, c, v * 2 - 1);
    return `rgb(${col.join(',')})`;
  };
  return (
    <>
      <p>
        The aha: the <SpecValue id="invertedDownforce" /> readout needs only about{' '}
        <strong>
          {fmt(
            ((SPECS.invertedDownforce.value * SPECS.gravityEarth.value) /
              SPECS.floorArea.value /
              SPECS.ambientPressure.value) *
              100,
            0,
          )}{' '}
          %
        </strong>{' '}
        less pressure under the car than outside, because the floor is big.
      </p>
      <svg
        className="chart"
        viewBox="0 0 220 300"
        role="img"
        aria-label={`Underbody suction map, ${fmt(t.deltaP / 1000, 1)} kilopascals`}
        style={{ maxWidth: 220, margin: '0 auto' }}
      >
        <text x="110" y="12" textAnchor="middle">
          front
        </text>
        {cells.map((c, i) => (
          <rect
            key={i}
            x={30 + ((c.x + 0.8) / 1.6) * 160 - 8}
            y={20 + ((1.25 - c.z) / 2.5) * 260 - 8.1}
            width={16.2}
            height={16.4}
            fill={cividis(c.v)}
          />
        ))}
        <rect
          x="30"
          y="20"
          width="160"
          height="260"
          fill="none"
          stroke="#e8edf5"
          strokeWidth="1.5"
        />
        {SKIRT_PROBES.map((p, k) => (
          <circle
            key={k}
            cx={30 + ((p[0] + 0.8) / 1.6) * 160}
            cy={20 + ((1.25 - p[2]) / 2.5) * 260}
            r={4}
            fill="none"
            stroke="#fff"
          />
        ))}
        <text x="110" y="296" textAnchor="middle">
          rear
        </text>
      </svg>
      <div className="legend" aria-hidden="true">
        <span style={{ color: cividis(0) }}>no suction</span>
        <span style={{ color: cividis(0.5) }}>half</span>
        <span style={{ color: cividis(1) }}>design 11.5 kPa</span>
      </div>
      <dl className="kv">
        <dt>Δp</dt>
        <dd>
          {fmt(t.deltaP / 1000, 2)} kPa = {pa > 0 ? fmt((t.deltaP / pa) * 100, 1) : '—'} % of
          ambient
        </dd>
        <dt>downforce = Δp × A</dt>
        <dd>
          {fmt(t.downforce / 1000, 1)} kN ({fmtInt(t.downforce * KGF_PER_N)} kgf)
        </dd>
        <dt>effective skirt gap</dt>
        <dd>{fmt(t.gap * 1000, 1)} mm</dd>
        <dt>seal efficiency</dt>
        <dd>{fmtInt(t.sealEfficiency * 100)} %</dd>
        <dt>fan power P = Q·Δp/η</dt>
        <dd>{fmt(t.fanPower / 1000, 1)} kW</dd>
      </dl>
      <p className="muted" style={{ fontSize: '0.875rem' }}>
        Circles are the 8 skirt probes (rays along the car’s −Y). Floor area{' '}
        <SpecValue id="floorArea" />, design suction <SpecValue id="suctionTarget" />. <SimTag />
      </p>
    </>
  );
}

function EnergyPanel() {
  const sim = host.sim;
  if (!sim) return null;
  const p = sim.params;
  const full = p.tankFull;
  if (!full) return <p>No tank on the Performance trim.</p>;
  const e = refillEnergy(
    full.mass,
    p.gas,
    p.env.ambientTemperature,
    full.pressure,
    p.env.ambientPressure || SPECS.ambientPressure.value,
    p.compressorEfficiency,
  );
  return (
    <>
      <p>
        Compressing {fmt(full.mass, 0)} kg of air to {fmtInt(full.pressure * PSI_PER_PA)} psi takes
        energy, even in the best case.
      </p>
      <dl className="kv">
        <dt>ideal (isothermal) W = m·R·T·ln(p/pₐ)</dt>
        <dd>{fmt(e.idealKWh, 1)} kWh</dd>
        <dt>real compressor</dt>
        <dd>
          ≈ {fmt(e.realisticKWh, 0)} kWh <span className="tag tag--estimate">est.</span>
        </dd>
        <dt>average power for a 2 h refill</dt>
        <dd>{fmt(refillPower(e.realisticKWh, SPECS.refillHoursMin.value), 0)} kW</dd>
        <dt>average power for a 6 h refill</dt>
        <dd>{fmt(refillPower(e.realisticKWh, SPECS.refillHoursMax.value), 0)} kW</dd>
      </dl>
      <p className="muted" style={{ fontSize: '0.875rem' }}>
        Reported refill: <SpecValue id="refillHoursMin" />–<SpecValue id="refillHoursMax" /> from an
        external nitrogen supply. And: <SpecValue id="selfRefill" />. Compressor efficiency{' '}
        <SpecValue id="compressorEfficiency" />.
      </p>
    </>
  );
}

export default function Lab() {
  const tab = useApp((s) => s.labTab);
  const set = useApp((s) => s.set);
  const [, force] = useState(0);
  useEffect(() => host.subscribe(() => force((x) => x + 1)), []);
  return (
    <aside className="panel lab" aria-label="Lab">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 10px 0 14px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Look inside · Lab</h2>
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => set({ labOpen: false })}
        >
          Close <kbd>L</kbd>
        </button>
      </div>
      <div className="lab__tabs" role="tablist" aria-label="Lab panels">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => set({ labTab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="lab__body" role="tabpanel">
        {tab === 'telemetry' && <PartsPanel />}
        {tab === 'grip' && <GripPanel />}
        {tab === 'tanks' && <TanksPanel />}
        {tab === 'nozzle' && <NozzlePanel />}
        {tab === 'underbody' && <UnderbodyPanel />}
        {tab === 'energy' && <EnergyPanel />}
      </div>
    </aside>
  );
}
