/** Tiny hand-drawn SVG charts (no chart library). Lines differ by dash pattern as well as colour. */
import type { ReactNode } from 'react';

export interface Series {
  label: string;
  color: string;
  dash?: string;
  values: number[];
  /** Map value → [0..1] on the chart. */
  min: number;
  max: number;
  unit: string;
}

export function LineChart({
  xs,
  series,
  width = 400,
  height = 170,
  xLabel,
  title,
}: {
  xs: number[];
  series: Series[];
  width?: number;
  height?: number;
  xLabel: string;
  title: string;
}) {
  const pad = { l: 34, r: 38, t: 10, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const x0 = xs[0] ?? 0;
  const x1 = xs[xs.length - 1] ?? 1;
  const sx = (x: number) => pad.l + ((x - x0) / Math.max(x1 - x0, 1e-6)) * w;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <rect
          x={pad.l}
          y={pad.t}
          width={w}
          height={h}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.12)"
        />
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={pad.l + w}
            y1={pad.t + h * f}
            y2={pad.t + h * f}
            stroke="rgba(255,255,255,0.07)"
          />
        ))}
        {series.map((s, si) => {
          const pts = s.values
            .map((v, i) => {
              const y = pad.t + h * (1 - Math.min(1, Math.max(0, (v - s.min) / (s.max - s.min))));
              return `${sx(xs[i] ?? 0).toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <g key={s.label}>
              <polyline
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dash}
              />
              <text x={si === 0 ? 2 : width - pad.r + 4} y={pad.t + 10} fill={s.color}>
                {fmtTick(s.max)}
              </text>
              <text x={si === 0 ? 2 : width - pad.r + 4} y={pad.t + h} fill={s.color}>
                {fmtTick(s.min)}
              </text>
              <text x={si === 0 ? 2 : width - pad.r + 4} y={pad.t + h / 2} fill={s.color}>
                {s.unit}
              </text>
            </g>
          );
        })}
        <text x={pad.l} y={height - 6}>
          {fmtTick(x0)}
        </text>
        <text x={pad.l + w} y={height - 6} textAnchor="end">
          {fmtTick(x1)} {xLabel}
        </text>
      </svg>
      <figcaption className="legend">
        {series.map((s) => (
          <span key={s.label} style={{ color: s.color }} className={s.dash ? 'dashed' : undefined}>
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

const fmtTick = (v: number) =>
  Math.abs(v) >= 100 ? Math.round(v).toString() : v.toFixed(Math.abs(v) < 10 ? 1 : 0);

export function StackedBar({
  parts,
  max,
  label,
}: {
  parts: { label: string; value: number; color: string; pattern?: boolean }[];
  max: number;
  label: ReactNode;
}) {
  let acc = 0;
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{ fontSize: '0.9rem', marginBottom: 4 }}>{label}</div>
      <svg
        className="chart"
        viewBox="0 0 400 30"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${Math.round(p.value / 1000)} kN`).join(', ')}
      >
        <defs>
          <pattern
            id="hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="rgba(0,0,0,0)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.45)" strokeWidth="3" />
          </pattern>
        </defs>
        <rect x="0" y="4" width="400" height="22" rx="4" fill="rgba(255,255,255,0.06)" />
        {parts.map((p) => {
          const x = (acc / max) * 400;
          const w = (p.value / max) * 400;
          acc += p.value;
          return (
            <g key={p.label}>
              <rect x={x} y="4" width={Math.max(0, w)} height="22" fill={p.color} />
              {p.pattern && (
                <rect x={x} y="4" width={Math.max(0, w)} height="22" fill="url(#hatch)" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
