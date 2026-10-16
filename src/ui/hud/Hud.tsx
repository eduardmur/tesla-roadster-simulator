/** Live telemetry HUD. All values are simulation outputs (tagged "sim"). */
import { useLayoutEffect, useRef } from 'react';
import { useApp } from '../../state/store';
import type { Telemetry } from '../../sim/types';
import { BAR_PER_PA, KGF_PER_N, KMH_PER_MS, MPH_PER_MS, PSI_PER_PA, fmt, fmtInt } from '../format';
import { useTelemetry } from '../hooks';
import { SimTag } from '../SpecValue';
import { TimeBar } from './TimeBar';

const FLIGHT_LABELS: Record<Telemetry['flightMode'], string> = {
  idle: 'Flight computer: idle',
  manual: 'Flight: manual rates',
  level: 'Flight: auto-level',
  roll180: 'Flight: rolling 180°',
  landing: 'Flight: landing burn',
  lift: 'Flight: lift',
};

function GMeter({ t }: { t: Telemetry }) {
  const R = 34;
  const max = 5;
  const x = 39 + Math.max(-1, Math.min(1, -t.gLat / max)) * R;
  const y = 39 - Math.max(-1, Math.min(1, t.gLong / max)) * R;
  return (
    <div className="gmeter">
      <svg
        viewBox="0 0 78 78"
        role="img"
        aria-label={`Acceleration: ${fmt(t.gLong, 2)} g forward, ${fmt(t.gLat, 2)} g sideways`}
      >
        <circle cx="39" cy="39" r={R} fill="none" stroke="rgba(255,255,255,0.2)" />
        <circle
          cx="39"
          cy="39"
          r={(R * 1.26) / max}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeDasharray="3 3"
        />
        <circle cx="39" cy="39" r={(R * 3) / max} fill="none" stroke="rgba(255,255,255,0.15)" />
        <line x1="5" y1="39" x2="73" y2="39" stroke="rgba(255,255,255,0.12)" />
        <line x1="39" y1="5" x2="39" y2="73" stroke="rgba(255,255,255,0.12)" />
        <rect
          x={x - 5}
          y={y - 5}
          width="10"
          height="10"
          transform={`rotate(45 ${x} ${y})`}
          fill="#e8edf5"
        />
      </svg>
      <dl className="kv">
        <dt>long.</dt>
        <dd>{fmt(t.gLong, 2)} g</dd>
        <dt>lat.</dt>
        <dd>{fmt(t.gLat, 2)} g</dd>
        <dt>vert.</dt>
        <dd>{fmt(t.gVert, 2)} g</dd>
      </dl>
    </div>
  );
}

function SpeedCard({ t }: { t: Telemetry }) {
  return (
    <div className="panel hud-card" style={{ gridArea: 'speed' }}>
      <div className="eyebrow">
        Speed <SimTag />
      </div>
      <div className="big-number" aria-live="off">
        {fmtInt(t.speed * KMH_PER_MS)}
        <small>km/h</small>
      </div>
      <div className="muted mono" style={{ fontSize: '0.85rem' }}>
        {fmtInt(t.speed * MPH_PER_MS)} mph ·{' '}
        {t.airborne ? `airborne, ${fmt(t.altitude, 1)} m up` : `on ${t.surface}`}
      </div>
      <GMeter t={t} />
    </div>
  );
}

function SuctionCard({ t, ambient }: { t: Telemetry; ambient: number }) {
  return (
    <div className="panel hud-card" style={{ gridArea: 'suction' }}>
      <div className="eyebrow" style={{ color: 'var(--suction)' }}>
        Suction <SimTag />
      </div>
      <div className="big-number">
        {fmt(t.downforce / 1000, 1)}
        <small>kN</small>
      </div>
      <div className="muted mono" style={{ fontSize: '0.85rem' }}>
        = {fmtInt(t.downforce * KGF_PER_N)} kgf
      </div>
      <div className="bar" style={{ margin: '6px 0' }} aria-hidden="true">
        <div
          className="bar__fill bar__fill--suction"
          style={{ width: `${Math.min(100, (t.downforce / 46_000) * 100)}%` }}
        />
      </div>
      <dl className="kv">
        <dt>Δp under floor</dt>
        <dd>
          {fmt(t.deltaP / 1000, 1)} kPa ({ambient > 0 ? fmt((t.deltaP / ambient) * 100, 1) : '—'} %)
        </dd>
        <dt>seal</dt>
        <dd>{fmtInt(t.sealEfficiency * 100)} %</dd>
        <dt>fans</dt>
        <dd>
          {fmt(t.fanPower / 1000, 0)} kW · {t.fanMode}
        </dd>
        <dt>tire use</dt>
        <dd>
          {fmtInt(Math.min(t.maxUtilization, 9.99) * 100)} %{t.maxUtilization > 1 ? ' slip' : ''}
        </dd>
      </dl>
    </div>
  );
}

function ThrustCard({ t, trim }: { t: Telemetry; trim: string }) {
  if (!t.hasTank) {
    return (
      <div className="panel hud-card" style={{ gridArea: 'thrust' }}>
        <div className="eyebrow" style={{ color: 'var(--thrust)' }}>
          Thrusters
        </div>
        <p className="muted" style={{ margin: 0 }}>
          The Performance trim has no air tank or thrusters: fans and tires only. Pick Thrust or
          Rocket to fly.
        </p>
      </div>
    );
  }
  const total = t.rearThrust + t.liftThrust + t.yawThrust;
  const tempC = t.tankTemperature - 273.15;
  return (
    <div className="panel hud-card" style={{ minWidth: 0, gridArea: 'thrust' }}>
      <div className="eyebrow" style={{ color: 'var(--thrust)', justifyContent: 'space-between' }}>
        <span>
          Air &amp; thrust <SimTag />
        </span>
        {trim === 'rocket' && <span className="flight-mode">{FLIGHT_LABELS[t.flightMode]}</span>}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div className="big-number">
            {fmt(total / 1000, 1)}
            <small>kN</small>
          </div>
          <div className="muted mono" style={{ fontSize: '0.8rem' }}>
            {fmt(t.massFlow, 1)} kg/s out
          </div>
        </div>
        <dl className="kv" style={{ flex: '0 1 320px', minWidth: 200 }}>
          <dt>tank</dt>
          <dd>
            {fmtInt(t.tankPressure * PSI_PER_PA)} psi · {fmtInt(t.tankPressure * BAR_PER_PA)} bar
          </dd>
          <dt>air</dt>
          <dd>
            {fmt(t.tankMass, 1)} kg ({fmtInt(t.tankFraction * 100)} %)
          </dd>
          <dt>gas temp.</dt>
          <dd>
            {fmt(tempC, 0)} °C{tempC < -20 ? ' · frosting' : ''}
          </dd>
          <dt>air left</dt>
          <dd>
            {Number.isFinite(t.airLeftSeconds)
              ? `${fmt(t.airLeftSeconds, 1)} s at this rate`
              : 'idle'}{' '}
            · {fmt(t.airLeftFullThrust, 1)} s full rear
          </dd>
        </dl>
      </div>
      <div className="bar" style={{ margin: '6px 0 2px' }} aria-hidden="true">
        <div
          className="bar__fill bar__fill--neutral"
          style={{ width: `${t.tankFraction * 100}%` }}
        />
      </div>
      <div className="nozzle-grid" role="list" aria-label="Thrust per nozzle with valve duty cycle">
        {t.nozzles.map((n) => (
          <div
            className="nozzle"
            role="listitem"
            key={n.id}
            title={`${n.label}: ${fmt(n.thrust / 1000, 1)} kN, duty ${fmtInt(n.duty * 100)} %`}
          >
            <div className="nozzle__duty" aria-hidden="true">
              <span style={{ height: `${n.duty * 100}%` }} />
            </div>
            <div>
              <span className={`nozzle__valve${n.open ? ' is-open' : ''}`} aria-hidden="true" />
              {n.id}
            </div>
            <div className="muted">{fmt(n.thrust / 1000, 1)}</div>
            <span className="sr-only">
              {n.label}: {fmt(n.thrust / 1000, 1)} kilonewtons, duty {fmtInt(n.duty * 100)} percent,
              valve {n.open ? 'open' : 'closed'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hud() {
  const t = useTelemetry(12);
  const trim = useApp((s) => s.trim);
  const ambient = useApp((s) => s.whatIf.ambientPressure);
  const compact = useApp((s) => s.labOpen);
  const ref = useRef<HTMLDivElement>(null);
  const ready = t !== null;
  // Expose the HUD height so the dock never slides under it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      document.documentElement.style.setProperty('--hud-h', `${el.offsetHeight}px`),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, compact]);
  if (!t) return null;
  return (
    <div className={`hud${compact ? ' hud--compact' : ''}`} aria-label="Telemetry" ref={ref}>
      <SpeedCard t={t} />
      <SuctionCard t={t} ambient={ambient} />
      <ThrustCard t={t} trim={trim} />
      <TimeBar />
    </div>
  );
}
