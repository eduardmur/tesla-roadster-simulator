/**
 * Build-time generator for the crawlable /how-it-works page. It fills the hand-written
 * HTML template with numbers, tables and SVG diagrams computed by the same pure physics
 * module and specs the 3D app uses, so the text version can never drift from the sim.
 */
import { SOURCES, PRESS_SOURCE_IDS } from '../src/data/sources';
import {
  SPECS,
  SPEC_LIST,
  SPEC_GROUP_LABELS,
  STATUS_LABELS,
  type Spec,
  type SpecGroup,
  type SpecId,
} from '../src/data/specs';
import { derived } from '../src/data/derived';
import {
  REFERENCE,
  buildVehicleParams,
  equilibriumSuction,
  fillTank,
  gasFor,
  nozzleGeometries,
  nozzlePerformance,
  nozzleProfile,
  refillEnergy,
  simulateLaunch,
  stepTank,
  throatDiameter,
  type ThermalMode,
} from '../src/physics';
import { CURLS, curlTopHeight } from '../src/sim/track';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const QUAL: Record<string, string> = { under: 'under ', over: 'over ', about: '~' };

function formatSpec(spec: Spec): string {
  if (typeof spec.value === 'string') return spec.value;
  const v = spec.value.toLocaleString('en-US', { maximumFractionDigits: 3 });
  const unit = spec.unit
    ? spec.unit === '×' || spec.unit === '°'
      ? spec.unit
      : ` ${spec.unit}`
    : '';
  return `${spec.qualifier ? QUAL[spec.qualifier] : ''}${v}${unit}`;
}

function tag(spec: Spec): string {
  const s = STATUS_LABELS[spec.status];
  const cls = `tag tag--${spec.status}`;
  if (spec.source) {
    return `<a class="${cls}" href="${esc(spec.source.url)}" title="${esc(`${s.long} — ${spec.source.title}`)}" rel="noopener">${s.short}</a>`;
  }
  return `<span class="${cls}" title="${esc(s.long)}">${s.short}</span>`;
}

function specHtml(id: string): string {
  const spec = (SPECS as Record<string, Spec>)[id];
  if (!spec) throw new Error(`how-it-works: unknown spec "${id}"`);
  const cls = typeof spec.value === 'string' ? 'vt' : 'v';
  return `<span class="spec"><span class="${cls}">${esc(formatSpec(spec))}</span> ${tag(spec)}</span>`;
}

function calcHtml(name: string): string {
  const d = derived()[name];
  if (!d) throw new Error(`how-it-works: unknown calc "${name}"`);
  const v = d.value.toLocaleString('en-US', {
    minimumFractionDigits: d.digits,
    maximumFractionDigits: d.digits,
  });
  return `<span class="spec" title="${esc(d.note)}"><span class="v">${v}${d.unit ? (d.unit === '%' ? ' %' : ` ${d.unit}`) : ''}</span> <span class="tag tag--sim" title="Computed by our model from the specs">sim</span></span>`;
}

// ------------------------------------------------------------------ diagrams

function blowdownSvg(): string {
  const vp = buildVehicleParams('rocket');
  const rear = nozzleGeometries().rear;
  const air = gasFor('air');
  const W = 640;
  const H = 260;
  const pad = { l: 56, r: 78, t: 16, b: 40 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const tMax = 3;
  const lines: string[] = [];
  const modes: { m: ThermalMode; color: string; dash: string; label: string }[] = [
    { m: 'adiabatic', color: '#ff8a3d', dash: '', label: 'pressure, adiabatic' },
    { m: 'isothermal', color: '#9ad1ff', dash: '6 4', label: 'pressure, isothermal' },
  ];
  let tempPts = '';
  for (const mode of modes) {
    const cfg = { ...vp.tank!, thermalMode: mode.m };
    let s = fillTank(cfg, REFERENCE.pressure, REFERENCE.temperature);
    const p0 = s.pressure;
    const pts: string[] = [];
    const tpts: string[] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * tMax;
      pts.push(
        `${(pad.l + (t / tMax) * w).toFixed(1)},${(pad.t + h * (1 - s.pressure / p0)).toFixed(1)}`,
      );
      if (mode.m === 'adiabatic')
        tpts.push(
          `${(pad.l + (t / tMax) * w).toFixed(1)},${(pad.t + h * (1 - (s.temperature - 150) / 150)).toFixed(1)}`,
        );
      for (let k = 0; k < 10; k++) {
        const n = nozzlePerformance(
          rear,
          air,
          s.pressure,
          s.temperature,
          REFERENCE.ambientPressure,
        );
        s = stepTank(s, cfg, 4 * n.massFlow, tMax / 3000);
      }
    }
    lines.push(
      `<polyline points="${pts.join(' ')}" fill="none" stroke="${mode.color}" stroke-width="2.5" stroke-dasharray="${mode.dash}"/>`,
    );
    if (tpts.length) tempPts = tpts.join(' ');
  }
  return `<figure>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="bd-t" class="diagram">
<title id="bd-t">Tank pressure and gas temperature during a full-thrust blowdown of the Rocket's 600 litre tanks</title>
<rect x="${pad.l}" y="${pad.t}" width="${w}" height="${h}" fill="none" stroke="#3a4558"/>
${[0.25, 0.5, 0.75].map((f) => `<line x1="${pad.l}" x2="${pad.l + w}" y1="${pad.t + h * f}" y2="${pad.t + h * f}" stroke="#263042"/>`).join('')}
${lines.join('\n')}
<polyline points="${tempPts}" fill="none" stroke="#7bd88f" stroke-width="2" stroke-dasharray="2 4"/>
<text x="${pad.l - 8}" y="${pad.t + 12}" text-anchor="end">p₀</text><text x="${pad.l - 8}" y="${pad.t + h}" text-anchor="end">0</text>
<text x="${pad.l + w + 8}" y="${pad.t + 12}">27 °C</text><text x="${pad.l + w + 8}" y="${pad.t + h}">−123 °C</text>
${[0, 1, 2, 3].map((t) => `<text x="${pad.l + (t / tMax) * w}" y="${H - 18}" text-anchor="middle">${t} s</text>`).join('')}
</svg>
<figcaption><span class="key" style="--c:#ff8a3d">pressure, adiabatic</span> <span class="key dashed" style="--c:#9ad1ff">pressure, isothermal</span> <span class="key dotted" style="--c:#7bd88f">gas temperature (adiabatic)</span><br>All four rear thrusters fully open from ${esc(formatSpec(SPECS.thrusterPressure))} ${tag(SPECS.thrusterPressure)}. Computed by the project's physics module. <span class="tag tag--sim">sim</span></figcaption>
</figure>`;
}

function nozzleSvg(): string {
  const geo = nozzleGeometries().rear;
  const air = gasFor('air');
  const prof = nozzleProfile(
    geo,
    air,
    REFERENCE.pressure,
    REFERENCE.temperature,
    REFERENCE.ambientPressure,
    60,
  );
  const st = nozzlePerformance(
    geo,
    air,
    REFERENCE.pressure,
    REFERENCE.temperature,
    REFERENCE.ambientPressure,
  );
  const W = 640;
  const H = 280;
  const x = (u: number) => 40 + ((u + 1) / 2) * 400;
  const r = (a: number) => (Math.sqrt(a) / Math.sqrt(8)) * 60;
  const top = prof.map((s) => `${x(s.x).toFixed(1)},${(90 - r(s.areaRatio)).toFixed(1)}`).join(' ');
  const bot = prof.map((s) => `${x(s.x).toFixed(1)},${(90 + r(s.areaRatio)).toFixed(1)}`).join(' ');
  const mach = prof
    .map((s) => `${x(s.x).toFixed(1)},${(260 - (s.mach / 4) * 90).toFixed(1)}`)
    .join(' ');
  const pr = prof
    .map((s) => `${x(s.x).toFixed(1)},${(260 - s.pressureRatio * 90).toFixed(1)}`)
    .join(' ');
  const diamonds = [0, 1, 2, 3, 4]
    .map((i) => {
      const x0 = x(1) + i * 36;
      return `<polygon points="${x0},90 ${x0 + 18},${78 + i} ${x0 + 36},90 ${x0 + 18},${102 - i}" fill="#3ec7ff" opacity="${(0.6 - i * 0.1).toFixed(2)}"/>`;
    })
    .join('');
  return `<figure>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="nz-t" class="diagram">
<title id="nz-t">Cross-section of a rear nozzle with Mach number and pressure along it</title>
<polyline points="${top}" fill="none" stroke="#c8d2de" stroke-width="2.5"/>
<polyline points="${bot}" fill="none" stroke="#c8d2de" stroke-width="2.5"/>
<line x1="${x(0)}" x2="${x(0)}" y1="20" y2="160" stroke="#566176" stroke-dasharray="4 4"/>
<text x="${x(0)}" y="16" text-anchor="middle">throat: Mach 1</text>
<text x="${x(-1)}" y="16">tank side</text>
${diamonds}
<text x="${x(1) + 10}" y="130">shock diamonds</text>
<polyline points="${mach}" fill="none" stroke="#ff8a3d" stroke-width="2.5"/>
<polyline points="${pr}" fill="none" stroke="#3ec7ff" stroke-width="2.5" stroke-dasharray="6 4"/>
<text x="470" y="200" fill="#ff8a3d">Mach (exit ${st.exitMach.toFixed(2)})</text>
<text x="470" y="220" fill="#3ec7ff">p / p₀</text>
</svg>
<figcaption><span class="key" style="--c:#ff8a3d">Mach number</span> <span class="key dashed" style="--c:#3ec7ff">pressure ÷ tank pressure</span><br>Throat ${(throatDiameter(geo.throatArea) * 1000).toFixed(0)} mm, exit ${(throatDiameter(geo.throatArea * geo.areaRatio) * 1000).toFixed(0)} mm, at full pressure. <span class="tag tag--sim">sim</span></figcaption>
</figure>`;
}

function suctionSvg(): string {
  return `<figure>
<svg viewBox="0 0 640 230" role="img" aria-labelledby="su-t" class="diagram">
<title id="su-t">Side view: fans pump air out from under the sealed floor, the atmosphere pushes the car down</title>
<path d="M60 150 Q80 110 170 100 L300 80 Q360 50 430 70 L560 100 Q590 110 590 150 Z" fill="#2a3446" stroke="#c8d2de" stroke-width="2"/>
<rect x="90" y="150" width="480" height="10" fill="#151b26" stroke="#3ec7ff"/>
<line x1="90" y1="160" x2="90" y2="178" stroke="#3ec7ff" stroke-width="4"/>
<line x1="570" y1="160" x2="570" y2="178" stroke="#3ec7ff" stroke-width="4"/>
<line x1="20" y1="180" x2="620" y2="180" stroke="#8b8172" stroke-width="3"/>
<g fill="none" stroke="#9ad1ff" stroke-width="2">
${[120, 200, 280, 360, 440, 520].map((x) => `<path d="M${x} 20 v34 m-6 -8 l6 8 l6 -8"/>`).join('')}
</g>
<text x="320" y="16" text-anchor="middle" fill="#9ad1ff">ambient pressure pushes down on the whole car</text>
<g fill="none" stroke="#3ec7ff" stroke-width="2" opacity="0.8">
${[180, 330, 480].map((x) => `<path d="M${x} 172 q10 -6 20 0"/>`).join('')}
</g>
<circle cx="240" cy="155" r="10" fill="none" stroke="#3ec7ff" stroke-width="2"/><circle cx="420" cy="155" r="10" fill="none" stroke="#3ec7ff" stroke-width="2"/>
<text x="330" y="205" text-anchor="middle" fill="#3ec7ff">sealed floor: ~11 % lower pressure underneath</text>
<text x="96" y="222" fill="#c8d2de">skirt</text><text x="236" y="140" text-anchor="middle" fill="#c8d2de">fan</text>
</svg>
<figcaption>Not to scale. The fans run on the battery and never touch the air tanks.</figcaption>
</figure>`;
}

function curlSvg(): string {
  const c = CURLS.curl;
  const s = 8.5;
  const ox = 360;
  const oy = 235;
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * c.arc;
    pts.push(
      `${(ox + c.radius * Math.sin(t) * s).toFixed(1)},${(oy - (c.radius - c.radius * Math.cos(t)) * s).toFixed(1)}`,
    );
  }
  const topX = ox + c.radius * Math.sin(c.arc) * s;
  const topY = oy - curlTopHeight(c) * s;
  const car = (x: number, y: number, rot: number) =>
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})"><rect x="-16" y="-10" width="32" height="8" rx="3" fill="#e8edf5"/><circle cx="-10" cy="-1" r="3.2" fill="#0b0f17" stroke="#e8edf5"/><circle cx="10" cy="-1" r="3.2" fill="#0b0f17" stroke="#e8edf5"/></g>`;
  const landX = ox - 190;
  return `<figure>
<svg viewBox="0 0 640 270" role="img" aria-labelledby="cu-t" class="diagram">
<title id="cu-t">The curl: drive up a ramp that curls over until upside down, drop off the end, roll 180 degrees, land</title>
<line x1="20" y1="${oy}" x2="620" y2="${oy}" stroke="#8b8172" stroke-width="3"/>
<polyline points="${pts.join(' ')}" fill="none" stroke="#c8d2de" stroke-width="6"/>
${car(ox + c.radius * s - 9, oy - c.radius * s, -90)}
<text x="${ox + c.radius * s + 14}" y="${oy - c.radius * s + 4}">1 · up the wall</text>
${car(topX + 6, topY + 12, 180)}
<text x="${topX}" y="${topY - 10}" text-anchor="middle">2 · upside down, ~21 m up</text>
<path d="M${topX - 14} ${topY + 18} C ${topX - 70} ${topY + 30}, ${landX + 20} ${oy - 120}, ${landX + 8} ${oy - 18}" fill="none" stroke="#ffd166" stroke-dasharray="5 5" stroke-width="2"/>
${car(landX + 60, oy - 110, 90)}
<text x="${landX + 40}" y="${oy - 108}" text-anchor="end">3 · roll 180°</text>
${car(landX, oy, 0)}
<text x="${landX}" y="${oy + 22}" text-anchor="middle">4 · landing burn</text>
<text x="${ox}" y="${oy + 22}" text-anchor="middle">curl starts</text>
</svg>
<figcaption>Reported: ${esc(formatSpec(SPECS.rampPitch))} ${tag(SPECS.rampPitch)} pitch at the end, ${esc(formatSpec(SPECS.rampHeight))} ${tag(SPECS.rampHeight)} up. The circular shape and ${c.radius.toFixed(1)} m radius ${tag(SPECS.rampRadius)} are our estimate.</figcaption>
</figure>`;
}

// ------------------------------------------------------------------ tables

function leakTable(): string {
  const vp = buildVehicleParams('performance');
  const rows = [0.004, 0.006, 0.01, 0.02, 0.05].map((g) => {
    const dp = equilibriumSuction(vp.suction, g, 1, vp.env.airDensity, vp.env.ambientPressure);
    return `<tr><td>${(g * 1000).toFixed(0)} mm</td><td>${(dp / 1000).toFixed(1)} kPa</td><td>${((dp * vp.suction.floorArea) / 1000).toFixed(0)} kN</td></tr>`;
  });
  return `<table><caption>Suction vs the average gap under the skirts <span class="tag tag--sim">sim</span></caption><thead><tr><th>Gap</th><th>Δp</th><th>Downforce</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function trimTable(): string {
  const rows = (['performance', 'thrust', 'rocket'] as const).map((t) => {
    const r = simulateLaunch(buildVehicleParams(t), { fans: true, thrust: true });
    const claim =
      t === 'performance'
        ? 'perfZeroToSixty'
        : t === 'thrust'
          ? 'thrustZeroToSixty'
          : 'rocketZeroToSixty';
    const g = t === 'performance' ? 'perfAccelG' : t === 'thrust' ? 'thrustAccelG' : 'rocketAccelG';
    const label = t[0]!.toUpperCase() + t.slice(1);
    return `<tr><th scope="row">${label}</th><td>${specHtml(claim)}</td><td>${specHtml(g)}</td><td><span class="v">${r.time.toFixed(2)} s</span> <span class="tag tag--sim">sim</span></td></tr>`;
  });
  return `<table><caption>0–60 mph: claims vs our model</caption><thead><tr><th>Trim</th><th>Claimed</th><th>Average g (CellCog)</th><th>Our model</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function specsTable(): string {
  const order: SpecGroup[] = [
    'event',
    'trims',
    'demo',
    'suction',
    'air',
    'thrusters',
    'model',
    'constants',
  ];
  return order
    .map((g) => {
      const rows = SPEC_LIST.filter((s) => s.group === g)
        .map(
          (s) =>
            `<tr><td>${esc(s.label)}${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}</td><td class="v">${esc(formatSpec(s))}</td><td>${tag(s)}${s.source ? ` <a href="${esc(s.source.url)}" rel="noopener">${esc(s.source.title.split(' — ')[0]!)}</a>` : ' our estimate'}</td></tr>`,
        )
        .join('');
      return `<h3>${esc(SPEC_GROUP_LABELS[g])}</h3><table class="specs"><thead><tr><th>What</th><th>Value</th><th>Status and source</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('\n');
}

function sourcesList(): string {
  const items = Object.values(SOURCES).map(
    (s) =>
      `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a> — ${esc(s.publisher)}${s.id === 'notebookcheck' || s.id === 'axios' ? ' (could not be loaded for verification on 16 Oct 2026)' : ''}</li>`,
  );
  return `<ol class="sources">${items.join('')}</ol>`;
}

function jsonLd(siteUrl: string): string {
  const doc = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline:
      'How the flying Tesla Roadster works: suction fans, cold-gas thrusters and the upside-down ramp',
    description:
      'An unofficial, sourced explanation of the 2026 Tesla Roadster’s underbody suction fans and compressed-air thrusters, with the physics worked out and every number marked as reported or estimated.',
    datePublished: '2026-10-16',
    dateModified: '2026-10-16',
    inLanguage: 'en',
    author: {
      '@type': 'Organization',
      name: 'Flying Tesla contributors',
      url: 'https://github.com/eduardmur/flying-tesla',
    },
    publisher: { '@type': 'Organization', name: 'Flying Tesla contributors' },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    image: `${siteUrl}og-image.png`,
    mainEntityOfPage: `${siteUrl}how-it-works/`,
    about: { '@type': 'Product', name: 'Tesla Roadster (second generation)', brand: 'Tesla' },
    proficiencyLevel: 'Beginner',
    citation: PRESS_SOURCE_IDS.map((id) => SOURCES[id].url),
  };
  return `<script type="application/ld+json">${JSON.stringify(doc).replace(/</g, '\\u003c')}</script>`;
}

export function renderHowItWorks(html: string, siteUrl: string): string {
  const air = gasFor('air');
  const vp = buildVehicleParams('rocket');
  const e = refillEnergy(
    vp.tankFull!.mass,
    air,
    REFERENCE.temperature,
    REFERENCE.pressure,
    REFERENCE.ambientPressure,
    SPECS.compressorEfficiency.value,
  );
  const replacements: Record<string, string> = {
    '<!--DIAGRAM:blowdown-->': blowdownSvg(),
    '<!--DIAGRAM:nozzle-->': nozzleSvg(),
    '<!--DIAGRAM:suction-->': suctionSvg(),
    '<!--DIAGRAM:curl-->': curlSvg(),
    '<!--TABLE:leak-->': leakTable(),
    '<!--TABLE:trims-->': trimTable(),
    '<!--TABLE:specs-->': specsTable(),
    '<!--SOURCES-->': sourcesList(),
    '<!--JSONLD-->': jsonLd(siteUrl),
    '{{energy:ideal}}': `<span class="spec"><span class="v">${e.idealKWh.toFixed(0)} kWh</span> <span class="tag tag--sim">sim</span></span>`,
    '{{energy:real}}': `<span class="spec"><span class="v">${e.realisticKWh.toFixed(0)} kWh</span> <span class="tag tag--estimate">est.</span></span>`,
    '{{site}}': siteUrl,
  };
  let out = html;
  for (const [k, v] of Object.entries(replacements)) out = out.split(k).join(v);
  out = out.replace(/\{\{spec:([a-zA-Z0-9]+)\}\}/g, (_, id: string) => specHtml(id as SpecId));
  out = out.replace(/\{\{calc:([a-zA-Z0-9]+)\}\}/g, (_, n: string) => calcHtml(n));
  const left = /\{\{[^}]+\}\}|<!--(DIAGRAM|TABLE|SOURCES|JSONLD)[^>]*-->/.exec(out);
  if (left) throw new Error(`how-it-works: unreplaced placeholder ${left[0]}`);
  return out;
}
