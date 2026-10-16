/**
 * "How it works": a short, plain-language article with diagrams and a looping demonstration.
 * Returned as an HTML string so the same text powers the in-app overlay and the static,
 * crawlable /how-it-works page. Numbers come from specs.ts; sources are numbered references.
 * Text is CC BY 4.0.
 */
import { derived } from '../data/derived';
import { SPECS, type Spec, type SpecId } from '../data/specs';
import { curlSpeeds } from '../sim/assist';
import { RAMP, curlTopHeight } from '../sim/track';

const AIR = '#3e6ae1';
const JET = '#d4372a';
const INK = '#171a20';
const MUTED = '#8e8e8e';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const QUAL: Record<string, string> = { under: 'under ', over: 'over ', about: 'about ' };

function value(spec: Spec): string {
  if (typeof spec.value === 'string') return spec.value;
  const v = spec.value.toLocaleString('en-US', { maximumFractionDigits: 3 });
  const unit = spec.unit
    ? spec.unit === '×' || spec.unit === '°'
      ? spec.unit
      : `\u00a0${spec.unit}`
    : '';
  return `${spec.qualifier ? QUAL[spec.qualifier] : ''}${v}${unit}`;
}

function calc(name: string, digits?: number): string {
  const d = derived()[name]!;
  const v = d.value.toLocaleString('en-US', {
    minimumFractionDigits: digits ?? d.digits,
    maximumFractionDigits: digits ?? d.digits,
  });
  return `${v}${d.unit ? (d.unit === '%' ? '%' : `\u00a0${d.unit}`) : ''}`;
}

/** Collects sources in order of first use, for numbered references. */
class Refs {
  list: { title: string; url: string }[] = [];
  cite(id: SpecId): string {
    const spec = SPECS[id] as Spec;
    if (!spec.source) return '';
    let n = this.list.findIndex((s) => s.url === spec.source!.url);
    if (n < 0) {
      this.list.push(spec.source);
      n = this.list.length - 1;
    }
    return `<sup><a href="#src-${n + 1}" aria-label="Source ${n + 1}">${n + 1}</a></sup>`;
  }
  spec(id: SpecId): string {
    const spec = SPECS[id] as Spec;
    return `${esc(value(spec))}${spec.status === 'reported' ? this.cite(id) : ''}`;
  }
}

// ---------------------------------------------------------------- diagrams

/** Side silhouette of the car, wheels at y = 0, facing +x. */
function carGlyph(scale = 1, extra = ''): string {
  const s = scale;
  return `<g transform="scale(${s})">
<path d="M-22 -3 L-22 -8 Q-20 -11 -14 -12 L-6 -16 Q2 -19 10 -15 L18 -11 Q22 -10 23 -6 L23 -3 Z" fill="${INK}"/>
<path d="M-5 -15 Q2 -18 9 -14.5 L4 -12 L-5 -12 Z" fill="#5c5e62"/>
<circle cx="-13" cy="-2.5" r="3" fill="${INK}" stroke="#fff" stroke-width="1"/>
<circle cx="14" cy="-2.5" r="3" fill="${INK}" stroke="#fff" stroke-width="1"/>
${extra}</g>`;
}

/** The demonstration: the whole jump on a loop, generated from the ramp geometry. */
function demoFigure(): string {
  const S = 8.2; // px per metre
  const gy = 250;
  const x0 = 380;
  const R = RAMP.radius * S;
  const cx = x0;
  const cy = gy - R;
  const arc = RAMP.arc;
  const ramp: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * arc;
    ramp.push(`${(cx + R * Math.sin(t)).toFixed(1)},${(cy + R * Math.cos(t)).toFixed(1)}`);
  }
  // Keyframes: time in seconds of a 9 s loop → transform of the car group.
  type K = { t: number; x: number; y: number; a: number; sy: number };
  const keys: K[] = [];
  const loop = 9;
  for (let i = 0; i <= 10; i++)
    keys.push({ t: (i / 10) * 1.0, x: 140 + (x0 - 140) * (i / 10), y: gy, a: 0, sy: 1 });
  for (let i = 1; i <= 26; i++) {
    const th = (i / 26) * arc;
    keys.push({
      t: 1.0 + (i / 26) * 2.6,
      x: cx + R * Math.sin(th),
      y: cy + R * Math.cos(th),
      a: (-th * 180) / Math.PI,
      sy: 1,
    });
  }
  const lip = keys[keys.length - 1]!;
  const vx = -45;
  const vy = -18;
  const g = 230;
  const fallT = (-vy + Math.sqrt(vy * vy + 2 * g * (gy - lip.y))) / g;
  for (let i = 1; i <= 24; i++) {
    const u = (i / 24) * fallT;
    const k = i / 24;
    const roll = Math.min(1, Math.max(0, (k - 0.15) / 0.45));
    keys.push({
      t: 3.6 + u * 1.2,
      x: lip.x + vx * u,
      y: Math.min(gy, lip.y + vy * u + 0.5 * g * u * u * (k > 0.75 ? 0.85 : 1)),
      a: -170 - 10 * roll,
      sy: Math.cos(roll * Math.PI),
    });
  }
  const land = keys[keys.length - 1]!;
  const tLand = land.t;
  keys.push({ ...land, y: gy, t: tLand + 0.2 });
  keys.push({ ...land, y: gy, t: loop - 0.6 });
  keys.push({ ...land, y: gy, t: loop });
  const pct = (t: number) => ((t / loop) * 100).toFixed(2);
  const frames = keys
    .map(
      (k) =>
        `${pct(k.t)}%{transform:translate(${k.x.toFixed(1)}px,${k.y.toFixed(1)}px) rotate(${k.a.toFixed(1)}deg) scaleY(${k.sy.toFixed(3)})}`,
    )
    .join('');
  const jetsOn = (from: number, to: number) =>
    `0%,${pct(from - 0.05)}%{opacity:0}${pct(from)}%,${pct(to)}%{opacity:1}${pct(to + 0.05)}%,100%{opacity:0}`;
  const puffs = [0, 1, 2, 3, 4]
    .map((i) => {
      const x = land.x - 26 + i * 13;
      return `<circle class="puff p${i}" cx="${x.toFixed(1)}" cy="${gy - 6}" r="16" fill="#e9ecef"/>`;
    })
    .join('');
  const css = `
.demo .car{animation:demo-car ${loop}s linear infinite}
@keyframes demo-car{${frames}}
.demo .jets{opacity:0;animation:demo-jets ${loop}s linear infinite}
@keyframes demo-jets{${jetsOn(tLand - 0.55, tLand + 0.1)}}
.demo .puff{opacity:0;transform-box:fill-box;transform-origin:center;animation:demo-puff ${loop}s ease-out infinite}
@keyframes demo-puff{0%,${pct(tLand - 0.4)}%{opacity:0;transform:scale(.2)}${pct(tLand)}%{opacity:.9;transform:scale(1)}${pct(tLand + 1.8)}%{opacity:0;transform:scale(1.8)}100%{opacity:0}}
${[1, 2, 3, 4].map((i) => `.demo .p${i}{animation-delay:${(i * 0.06).toFixed(2)}s}`).join('')}
@media (prefers-reduced-motion: reduce){.demo .car,.demo .jets,.demo .puff{animation:none}.demo .car{transform:translate(${x0 - 70}px,${gy}px)}}`;
  const jets = `<g class="jets" stroke="${AIR}" stroke-width="2.5" stroke-linecap="round"><path d="M-13 1 L-15 12 M14 1 L16 12"/></g>`;
  return `<figure class="demo">
<style>${css}</style>
<svg viewBox="0 0 640 290" role="img" aria-labelledby="demo-t">
<title id="demo-t">Animation: the car drives up the curled ramp, hangs upside down, drops off the end, rolls half a turn and lands on a cushion of air</title>
<line x1="20" y1="${gy}" x2="620" y2="${gy}" stroke="${MUTED}" stroke-width="1.5"/>
<polyline points="${ramp.join(' ')}" fill="none" stroke="#c4c6c9" stroke-width="7" stroke-linejoin="round"/>
<polyline points="${ramp.join(' ')}" fill="none" stroke="${JET}" stroke-width="1" transform="translate(0 0)"/>
${puffs}
<g class="car">${carGlyph(1, jets)}</g>
</svg>
<figcaption>The jump on a loop. The ramp follows the reported 170° and about ${Math.round(curlTopHeight(RAMP))}&nbsp;m; its circular shape is our estimate.</figcaption>
</figure>`;
}

function suctionFigure(): string {
  const arrows = [110, 170, 230, 290, 350, 410, 470, 530]
    .map(
      (x) =>
        `<path d="M${x} 18 v30 m-5 -8 l5 8 l5 -8" fill="none" stroke="${AIR}" stroke-width="2"/>`,
    )
    .join('');
  const up = [170, 260, 350, 440]
    .map(
      (x) =>
        `<path d="M${x} 196 v-12 m-4 5 l4 -5 l4 5" fill="none" stroke="${AIR}" stroke-width="1.5" opacity=".6"/>`,
    )
    .join('');
  return `<figure>
<svg viewBox="0 0 640 250" role="img" aria-labelledby="suc-t">
<title id="suc-t">Side cut-away: fans pump air out from under the sealed floor, so outside air pushes the car down</title>
${arrows}
<text x="320" y="14" text-anchor="middle" fill="${AIR}">outside air pushes on the whole car</text>
<path d="M70 165 Q86 120 170 112 L300 96 Q365 66 438 84 L560 112 Q586 120 588 165 Z" fill="#f2f2f2" stroke="${INK}" stroke-width="2"/>
<rect x="100" y="165" width="460" height="9" fill="${INK}"/>
<line x1="102" y1="174" x2="102" y2="199" stroke="${JET}" stroke-width="4"/>
<line x1="558" y1="174" x2="558" y2="199" stroke="${JET}" stroke-width="4"/>
<line x1="30" y1="200" x2="610" y2="200" stroke="${MUTED}" stroke-width="2"/>
${up}
<g fill="none" stroke="${INK}" stroke-width="2"><circle cx="250" cy="170" r="11"/><circle cx="410" cy="170" r="11"/></g>
<path d="M250 158 q30 -30 70 -36 M410 158 q30 -30 70 -36" fill="none" stroke="${AIR}" stroke-width="2" stroke-dasharray="4 4"/>
<text x="250" y="228" text-anchor="middle">fan</text><text x="410" y="228" text-anchor="middle">fan</text>
<text x="102" y="228" text-anchor="middle" fill="${JET}">skirt</text><text x="558" y="228" text-anchor="middle" fill="${JET}">skirt</text>
<text x="330" y="246" text-anchor="middle" fill="${MUTED}">under the floor: slightly lower pressure</text>
</svg>
<figcaption>Side view. The fans keep the pressure under the floor slightly low, even when the car is standing still.</figcaption>
</figure>`;
}

function layoutFigure(): string {
  const dot = (x: number, y: number, c: string) =>
    `<circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`;
  return `<figure>
<svg viewBox="0 0 640 300" role="img" aria-labelledby="lay-t">
<title id="lay-t">Top view: two air tanks, four rear nozzles, four lift nozzles underneath and two turning nozzles at the nose</title>
<path d="M120 150 C120 95 160 78 230 74 L470 70 C540 70 580 100 590 150 C580 200 540 230 470 230 L230 226 C160 222 120 205 120 150 Z" fill="#f2f2f2" stroke="${INK}" stroke-width="2"/>
<path d="M300 92 L440 90 C470 104 470 196 440 210 L300 208 C285 190 285 110 300 92 Z" fill="#dcdcdc"/>
<circle cx="250" cy="150" r="34" fill="#fff" stroke="${INK}" stroke-width="2"/>
<text x="250" y="154" text-anchor="middle">tank 1</text>
<rect x="320" y="166" width="96" height="40" rx="20" fill="#fff" stroke="${INK}" stroke-width="2"/>
<text x="368" y="190" text-anchor="middle">tank 2</text>
${[110, 135, 165, 190].map((y) => dot(118, y, JET)).join('')}
<path d="M70 150 h28 m-8 -6 l8 6 l-8 6" fill="none" stroke="${JET}" stroke-width="2" transform="translate(-60 0) scale(1)"/>
<text x="30" y="125" fill="${JET}">4 rear</text><text x="30" y="141" fill="${JET}">thrusters</text>
${[
  [170, 92],
  [170, 208],
  [540, 92],
  [540, 208],
]
  .map(
    ([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${AIR}" stroke-width="3"/>`,
  )
  .join('')}
<text x="540" y="60" text-anchor="middle" fill="${AIR}">lift nozzles (4, underneath)</text>
${dot(578, 120, JET)}${dot(578, 180, JET)}
<path d="M592 120 h26 M592 180 h26" stroke="${JET}" stroke-width="2"/>
<text x="604" y="262" text-anchor="end" fill="${JET}">2 turning nozzles</text>
<text x="350" y="290" text-anchor="middle" fill="${MUTED}">front →</text>
</svg>
<figcaption>Rocket version from above. Tank 1 sits behind the seats and tank 2 takes the passenger's place. The nozzle layout follows MotorTrend's analysis of the reveal.</figcaption>
</figure>`;
}

function nozzleFigure(): string {
  const wall = (s: number) =>
    `M40 ${150 - 70 * s} L160 ${150 - 70 * s} C230 ${150 - 70 * s} 240 ${150 - 16 * s} 280 ${150 - 16 * s} C330 ${150 - 16 * s} 420 ${150 - 46 * s} 520 ${150 - 58 * s}`;
  const flow = [0.3, 0.55, 0.85, 1.25, 1.8, 2.4]
    .map((len, i) => {
      const x = 70 + i * 82;
      return `<path d="M${x} 150 h${(len * 34).toFixed(0)}" stroke="${AIR}" stroke-width="3" marker-end="url(#ah)"/>`;
    })
    .join('');
  return `<figure>
<svg viewBox="0 0 640 250" role="img" aria-labelledby="noz-t">
<title id="noz-t">Nozzle: the air speeds up through a narrow throat and a widening bell</title>
<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${AIR}"/></marker></defs>
<path d="${wall(1)}" fill="none" stroke="${INK}" stroke-width="3"/>
<path d="${wall(-1)}" fill="none" stroke="${INK}" stroke-width="3"/>
${flow}
<line x1="280" y1="120" x2="280" y2="180" stroke="${MUTED}" stroke-dasharray="4 4"/>
<text x="100" y="60" text-anchor="middle">from the tank</text>
<text x="280" y="106" text-anchor="middle">throat: speed of sound</text>
<text x="470" y="64" text-anchor="middle">bell: faster still</text>
<text x="590" y="154" text-anchor="middle" fill="${AIR}">jet</text>
<text x="320" y="236" text-anchor="middle" fill="${MUTED}">arrow length ≈ air speed</text>
</svg>
<figcaption>Cross-section of a nozzle.</figcaption>
</figure>`;
}

function stepsFigure(): string {
  const panel = (i: number, title: string, body: string) =>
    `<g transform="translate(${i * 128} 0)"><rect x="4" y="4" width="120" height="120" rx="6" fill="#f4f4f4"/>${body}<text x="64" y="144" text-anchor="middle">${i + 1}. ${title}</text></g>`;
  const ramp = `<path d="M14 104 L60 104 A40 40 0 0 0 100 64 A40 40 0 0 0 66 26" fill="none" stroke="#c4c6c9" stroke-width="5"/>`;
  return `<figure>
<svg viewBox="0 0 640 150" role="img" aria-labelledby="steps-t">
<title id="steps-t">Five steps: up the wall, upside down, off the edge, the roll, the landing</title>
${panel(0, 'Up the wall', `${ramp}<g transform="translate(96 74) rotate(-90)">${carGlyph(0.8)}</g>`)}
${panel(1, 'Upside down', `${ramp}<g transform="translate(70 28) rotate(-170)">${carGlyph(0.8)}</g>`)}
${panel(2, 'Off the edge', `${ramp}<g transform="translate(44 44) rotate(-175)">${carGlyph(0.8)}</g><path d="M50 52 q-8 14 -10 28" fill="none" stroke="${MUTED}" stroke-dasharray="3 3"/>`)}
${panel(3, 'The roll', `<g transform="translate(64 70) rotate(-180) scale(1 0.2)">${carGlyph(0.8)}</g><path d="M40 48 a26 26 0 1 1 0 44" fill="none" stroke="${AIR}" stroke-width="2"/>`)}
${panel(4, 'The landing', `<line x1="10" y1="104" x2="118" y2="104" stroke="${MUTED}"/><g transform="translate(64 92) scale(-1 1)">${carGlyph(0.8)}</g><circle cx="44" cy="100" r="10" fill="#e3e5e8"/><circle cx="64" cy="102" r="12" fill="#e3e5e8"/><circle cx="86" cy="100" r="10" fill="#e3e5e8"/>`)}
</svg>
</figure>`;
}

function gripFigure(r: Refs): string {
  const bars: [string, number, string, SpecId][] = [
    ['Tires alone', SPECS.tireOnlyGrip.value, MUTED, 'tireOnlyGrip'],
    ['With the fans', SPECS.fanCorneringG.value, AIR, 'fanCorneringG'],
    ['With thrusters (Rocket launch)', SPECS.rocketAccelG.value, JET, 'rocketAccelG'],
  ];
  const refs = [...new Set(bars.map((b) => r.cite(b[3])))].join(' ');
  const max = 5;
  const rows = bars
    .map(
      ([label, g, c, id], i) =>
        `<text x="0" y="${i * 46 + 16}">${label}</text><rect x="0" y="${i * 46 + 22}" width="${((g / max) * 600).toFixed(0)}" height="12" rx="2" fill="${c}"/><text x="${((g / max) * 600 + 8).toFixed(0)}" y="${i * 46 + 33}" fill="${MUTED}">${esc(value(SPECS[id] as Spec))}</text>`,
    )
    .join('');
  return `<figure>
<svg viewBox="0 0 640 140" role="img" aria-labelledby="grip-t">
<title id="grip-t">How hard the car can push: tires alone about 1.26 g, with fans over 2 g, with thrusters about 4.6 g</title>
${rows}
</svg>
<figcaption>Maximum acceleration or cornering force.${refs} The last figure is CellCog's arithmetic from the claimed 0–60 time.</figcaption>
</figure>`;
}

// ---------------------------------------------------------------- article

export function articleHtml(opts: { backLink?: string } = {}): string {
  const r = new Refs();
  const s = (id: SpecId) => r.spec(id);
  const top = Math.round(curlTopHeight(RAMP));
  const timesAtm =
    Math.round((SPECS.thrusterPressure.value * 6894.757) / SPECS.ambientPressure.value / 5) * 5;
  const climbKmh = Math.round((curlSpeeds(RAMP).entry * 3.6) / 5) * 5;
  const parts: string[] = [];
  parts.push(`<article class="article">`);
  if (opts.backLink)
    parts.push(`<p class="back"><a href="${opts.backLink}">← Back to the simulator</a></p>`);
  parts.push(`<h1>How it works</h1>
<p class="lede">On ${s('revealDate')}, at SpaceX's test site in McGregor, Texas${r.cite('revealVenue')}, a Roadster drove up a ramp that curls over until the car is upside down. It hung there, dropped off the end, rolled over in mid-air and landed on its wheels. Fans under the floor suck it onto the road, and jets of compressed air push it.</p>
${demoFigure()}

<h2>Suction</h2>
<p>Under the floor are fans, and skirts that close the gap between the car and the road. The fans pump air out from under the car. With less air underneath, the air above pushes the car down harder than the air below pushes it up.</p>
<p>On the ramp, the car's downforce readout said ${s('invertedDownforce')}. Spread over a floor of ${esc(value(SPECS.floorArea))} (our estimate), that is only about ${calc('suctionPercent')} less pressure under the car than around it, roughly the drop in air pressure between sea level and a hilltop ${Math.round(derived().hillAltitude!.value / 100) / 10}&nbsp;km up.</p>
<p>The push comes through the car's own floor, so it works on a wall or a ceiling as well as on a road. On the ramp it is about twice the car's weight, enough to hold the car there upside down. It also presses the tires harder onto the road, so they grip better.</p>
${suctionFigure()}
${gripFigure(r)}

<h2>Air tanks</h2>
<p>Nothing burns. The car carries air, mostly nitrogen, squeezed into carbon-fibre tanks. The Rocket version has ${s('airVolumeTotal')} of tanks holding ${s('airMass')} of air at ${s('thrusterPressure')}, about ${timesAtm} times normal air pressure.</p>
<p>When a valve opens, the air rushes out through a nozzle and pushes the car the other way, like a balloon you let go of. The Rocket has ${s('nozzleCount')} nozzles: four at the back push it forward, four underneath lift it, and two at the nose turn it.</p>
${layoutFigure()}

<h2>Nozzles</h2>
<p>Each nozzle narrows to a throat and then flares out like a bell. In the throat the air reaches the speed of sound, and in the bell it speeds up further, to about ${calc('exhaustVelocity')} in our model. The four rear nozzles together push with ${s('rearThrustTotal')}. That force doesn't depend on tire grip, so it adds to whatever the tires can do.</p>
<p>The valves are either fully open or fully shut. For half power, a valve opens and shuts many times a second and stays open half of the time.</p>
${nozzleFigure()}

<h2>The jump</h2>
${stepsFigure()}
<ol>
<li>The car drives up the ramp at about ${climbKmh}&nbsp;km/h (the speed our simulation uses). Suction and the curve press it onto the surface.</li>
<li>At the top, about ${top}&nbsp;m${r.cite('rampHeight')} up, it hangs upside down, held by the suction.</li>
<li>At the end of the ramp the skirts lose their seal. The suction is gone in a fraction of a second and the car drops.</li>
<li>The lift nozzles on one side fire and roll the car over. Half a turn takes about half a second.</li>
<li>Just before touchdown all four lift nozzles fire to brake the fall. The jets are cold enough to turn moisture in the air into the white cloud. The landing readout showed ${s('landingG')}.</li>
</ol>

<h2>Limits</h2>
<p>A full tank lasts ${s('cellcogFullThrust')} of full thrust; our model says ${calc('fullThrustSeconds')}. That is enough air for a hop, not for flying around. Refilling from a nitrogen supply takes ${s('refillHoursMin')} to ${s('refillHoursMax')}; ${esc(String(SPECS.selfRefill.value))}${r.cite('selfRefill')}. The Rocket version is ${esc(String(SPECS.rocketAccess.value).toLowerCase().replace('; ', ' and '))}${r.cite('rocketAccess')}.</p>

<h2>Estimates</h2>
<p>Numbers with a small reference come from coverage of the reveal on ${esc(String(SPECS.revealDate.value))}. Some were never published: the car's weight, the floor area, the exact ramp shape and the strength of the lift nozzles. For those the simulator uses our own estimates. Outlets also disagree on some details, such as the nozzle layout. Every number and its status is listed in the project's <a href="https://github.com/eduardmur/tesla-roadster-simulator/blob/main/src/data/specs.ts">specs file</a>.</p>

<h2>Sources</h2>
<ol class="sources">
${r.list.map((src, i) => `<li id="src-${i + 1}"><a href="${esc(src.url)}" rel="noopener">${esc(src.title)}</a></li>`).join('\n')}
</ol>
<p class="fine">Unofficial fan project. Not affiliated with, endorsed by, or connected to Tesla, Inc. or SpaceX. “Tesla” and “Roadster” are trademarks of Tesla, Inc., used here only to identify the subject. Facts as of 16 October 2026. Text CC BY 4.0, code MIT. <a href="https://github.com/eduardmur/tesla-roadster-simulator">Source on GitHub</a>.</p>
</article>`);
  return parts.join('\n');
}
