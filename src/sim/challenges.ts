/**
 * Challenge state machines. They watch the sim through step callbacks and produce a result
 * with a medal. No rendering, so they can be tested headless.
 */
import { SPECS } from '../data/specs';
import { dot, toBody } from '../physics/math';
import { MPH, SIXTY_MPH, TRIM_LABELS, type TrimId } from '../physics/params';
import {
  CURLS,
  EIGHTH_MILE,
  DRAG_STRIP,
  HOP_LANE,
  HOVER_PAD,
  curlAngleAt,
  type SpawnId,
} from './track';
import type { Sim, StepInfo } from './world';

export type Medal = 'gold' | 'silver' | 'bronze' | null;
export type ChallengeKind = 'drag' | 'curl' | 'practice' | 'hop' | 'hover' | 'free';

export interface ResultLine {
  label: string;
  value: string;
  /** Spec id when the line quotes a reported/estimated number. */
  specId?: keyof typeof SPECS;
}

export interface ChallengeResult {
  kind: ChallengeKind;
  success: boolean;
  medal: Medal;
  headline: string;
  lines: ResultLine[];
  /** Primary score for "best" tracking. */
  score: number;
  scoreLabel: string;
  lowerIsBetter: boolean;
}

export interface ChallengeHud {
  title: string;
  status: string;
  lines: string[];
  /** Big countdown digit / "GO". */
  banner?: string;
}

export interface Challenge {
  kind: ChallengeKind;
  title: string;
  spawn: SpawnId;
  /** Trim the challenge is designed for. */
  recommendedTrim?: TrimId;
  phase: 'countdown' | 'running' | 'done';
  result: ChallengeResult | null;
  start(sim: Sim): void;
  onStep(sim: Sim, info: StepInfo): void;
  hud(sim: Sim): ChallengeHud;
}

const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const deg = (r: number) => (r * 180) / Math.PI;

export const CHALLENGE_INFO: Record<ChallengeKind, { title: string; blurb: string }> = {
  drag: {
    title: 'Drag strip',
    blurb: '0–60 mph against the claimed times. Hold W after the green light.',
  },
  curl: {
    title: 'The Curl',
    blurb:
      'The reveal trick: up a ramp that curls until you are upside down 21 m up, then roll and land.',
  },
  practice: { title: 'Practice curl', blurb: 'A smaller curl (our estimate) to learn the trick.' },
  hop: {
    title: 'Car hop',
    blurb: 'Hop over the parked cars with the lift nozzles. Bonus for a kick flip.',
  },
  hover: {
    title: 'Hover hold',
    blurb: 'Keep the wheels 1.5–2.5 m up for as long as the air lasts.',
  },
  free: { title: 'Free roam', blurb: 'Drive anywhere. Try the tube for walls and ceilings.' },
};

// ------------------------------------------------------------------------------- drag strip

export function createDrag(trim: TrimId, launchControl: boolean): Challenge {
  const claim =
    trim === 'performance'
      ? SPECS.perfZeroToSixty
      : trim === 'thrust'
        ? SPECS.thrustZeroToSixty
        : SPECS.rocketZeroToSixty;
  let countdownEnd = 0;
  let t0: number | null = null;
  let t60: number | null = null;
  let tEighth: number | null = null;
  let trap = 0;
  let airStart = 0;
  let startZ = 0;
  const c: Challenge = {
    kind: 'drag',
    title: CHALLENGE_INFO.drag.title,
    spawn: 'drag',
    phase: 'countdown',
    result: null,
    start(sim) {
      sim.reset('drag');
      sim.holdBrake = true;
      sim.autoThrustUntil = launchControl ? SIXTY_MPH : null;
      countdownEnd = sim.time + 3;
      startZ = DRAG_STRIP.start;
      airStart = sim.tank?.mass ?? 0;
    },
    onStep(sim, info) {
      if (c.phase === 'countdown') {
        if (sim.time >= countdownEnd) {
          c.phase = 'running';
          sim.holdBrake = false;
        }
        return;
      }
      if (c.phase !== 'running') return;
      const fwd = dot(info.pose.linvel, info.pose.forward);
      if (t0 === null && sim.input.throttle > 0) t0 = sim.time;
      if (t0 !== null && t60 === null && fwd >= SIXTY_MPH) t60 = sim.time - t0;
      if (t0 !== null && tEighth === null && info.pose.pos[2] - startZ >= EIGHTH_MILE) {
        tEighth = sim.time - t0;
        trap = fwd;
      }
      if (t60 !== null && (tEighth !== null || sim.time - t0! > 20)) finish(sim);
    },
    hud(sim) {
      const t = sim.telemetry;
      const banner =
        c.phase === 'countdown'
          ? String(Math.max(1, Math.ceil(countdownEnd - sim.time)))
          : t0 === null && c.phase === 'running'
            ? 'GO'
            : undefined;
      return {
        title: `${c.title} · ${TRIM_LABELS[trim]}`,
        status: c.phase === 'countdown' ? 'Get ready…' : t0 === null ? 'Floor it!' : 'Running',
        lines: [
          `Claim: 0–60 under ${claim.value} s (reported)`,
          `0–60: ${t60 !== null ? fmt(t60) + ' s' : t0 !== null ? fmt(sim.time - t0) + ' s…' : '—'}`,
          `Speed: ${fmt(t.forwardSpeed / MPH, 0)} mph`,
          launchControl
            ? 'Launch control: thrusters fire automatically'
            : 'Manual: Space fires thrusters',
        ],
        ...(banner ? { banner } : {}),
      };
    },
  };
  function finish(sim: Sim) {
    c.phase = 'done';
    const time = t60 ?? Infinity;
    const medal: Medal =
      time <= claim.value
        ? 'gold'
        : time <= claim.value * 1.1
          ? 'silver'
          : time <= claim.value * 1.3
            ? 'bronze'
            : null;
    c.result = {
      kind: 'drag',
      success: Number.isFinite(time),
      medal,
      headline: `0–60 mph in ${fmt(time)} s`,
      lines: [
        {
          label: `Claimed (${TRIM_LABELS[trim]})`,
          value: `under ${claim.value} s`,
          specId: claimIdFor(trim),
        },
        {
          label: 'Reveal demo run',
          value: `${SPECS.demoZeroToSixty.value} s`,
          specId: 'demoZeroToSixty',
        },
        {
          label: '1/8 mile',
          value: tEighth !== null ? `${fmt(tEighth)} s @ ${fmt(trap / MPH, 0)} mph` : '—',
        },
        { label: 'Air used', value: `${fmt(airStart - (sim.tank?.mass ?? 0), 1)} kg` },
      ],
      score: time,
      scoreLabel: `${fmt(time)} s`,
      lowerIsBetter: true,
    };
  }
  return c;
}

const claimIdFor = (trim: TrimId) =>
  trim === 'performance'
    ? 'perfZeroToSixty'
    : trim === 'thrust'
      ? 'thrustZeroToSixty'
      : 'rocketZeroToSixty';

// ------------------------------------------------------------------------------- the curl

export function createCurl(which: 'curl' | 'practice'): Challenge {
  const curl = CURLS[which];
  let maxAngle = 0;
  let leftLip = false;
  let lipTime = 0;
  let touchdown: number | null = null;
  let landingAngle = 0;
  let peakG = 0;
  let airStart = 0;
  let airAtLanding = 0;
  let roofHit = false;
  let fellAt: number | null = null;
  const c: Challenge = {
    kind: which,
    title: CHALLENGE_INFO[which].title,
    spawn: which,
    recommendedTrim: 'rocket',
    phase: 'running',
    result: null,
    start(sim) {
      sim.reset(which);
      airStart = sim.tank?.mass ?? 0;
    },
    onStep(sim, info) {
      if (c.phase !== 'running') return;
      const g = sim.params.env.gravity;
      if (info.surface === curl.id) maxAngle = Math.max(maxAngle, curlAngleAt(curl, info.pose.pos));
      if (!leftLip && info.airborne && info.pose.pos[1] > 2) {
        if (maxAngle > (150 * Math.PI) / 180) {
          leftLip = true;
          lipTime = sim.time;
        } else if (maxAngle > 0.3) {
          fellAt = maxAngle;
          leftLip = true;
          lipTime = sim.time;
        }
      }
      if (leftLip && touchdown === null && info.wheelContacts >= 2 && sim.time - lipTime > 0.3) {
        touchdown = sim.time;
        const up = toBody(info.pose.rot, [0, 1, 0]);
        landingAngle = Math.acos(Math.max(-1, Math.min(1, up[1])));
        airAtLanding = sim.tank?.mass ?? 0;
      }
      if (leftLip && info.chassisTouching.includes('ground')) {
        const up = toBody(info.pose.rot, [0, 1, 0]);
        if (up[1] < 0.3) roofHit = true;
      }
      if (touchdown !== null) {
        if (sim.time - touchdown < 0.5) peakG = Math.max(peakG, Math.hypot(...info.specific) / g);
        else finish(sim);
      }
      if (leftLip && touchdown === null && sim.time - lipTime > 8) finish(sim);
    },
    hud(sim) {
      const t = sim.telemetry;
      return {
        title: c.title,
        status: !leftLip
          ? maxAngle > 0.1
            ? 'Climbing — stay on the gas'
            : 'Run-in: build speed'
          : touchdown === null
            ? 'Airborne — roll and land!'
            : 'Landed',
        lines: [
          `Curl angle: ${fmt(deg(maxAngle), 0)}° of ${fmt(deg(curl.arc), 0)}°`,
          `Downforce: ${fmt(t.downforce / 1000, 1)} kN`,
          `Air: ${fmt(t.tankMass, 0)} kg`,
        ],
      };
    },
  };
  function finish(sim: Sim) {
    c.phase = 'done';
    const landed =
      touchdown !== null && !roofHit && landingAngle < (45 * Math.PI) / 180 && fellAt === null;
    const a = deg(landingAngle);
    const medal: Medal = !landed
      ? null
      : a < 10 && peakG < 4
        ? 'gold'
        : a < 20 && peakG < 6
          ? 'silver'
          : 'bronze';
    const used = airStart - (touchdown !== null ? airAtLanding : (sim.tank?.mass ?? 0));
    c.result = {
      kind: which,
      success: landed,
      medal,
      headline:
        fellAt !== null
          ? `Fell off at ${fmt(deg(fellAt), 0)}° — more speed or fans on`
          : landed
            ? 'Stuck the landing!'
            : roofHit
              ? 'Landed on the roof'
              : 'Crash landing',
      lines: [
        { label: 'Landing angle', value: `${fmt(a, 0)}°` },
        { label: 'Peak g on landing', value: `${fmt(peakG, 1)} g` },
        {
          label: 'Reported landing readout',
          value: `${SPECS.landingG.value} g`,
          specId: 'landingG',
        },
        { label: 'Air used', value: `${fmt(used, 0)} kg of ${fmt(airStart, 0)} kg` },
      ],
      score: landed ? Math.round(1000 - a * 10 - peakG * 30 - used) : 0,
      scoreLabel: landed ? `${fmt(a, 0)}°, ${fmt(peakG, 1)} g` : 'crash',
      lowerIsBetter: false,
    };
  }
  return c;
}

// ------------------------------------------------------------------------------- car hop

export function createHop(): Challenge {
  let overCars = false;
  let cleared = false;
  let touchedCar = false;
  let maxAlt = 0;
  let rollAccum = 0;
  let airborneSince: number | null = null;
  let landedAt: number | null = null;
  let landingAngle = 0;
  let peakG = 0;
  let airStart = 0;
  const halfSpan = 4.6;
  const c: Challenge = {
    kind: 'hop',
    title: CHALLENGE_INFO.hop.title,
    spawn: 'hop',
    recommendedTrim: 'rocket',
    phase: 'running',
    result: null,
    start(sim) {
      sim.reset('hop');
      airStart = sim.tank?.mass ?? 0;
    },
    onStep(sim, info) {
      if (c.phase !== 'running') return;
      const p = info.pose.pos;
      if (info.chassisTouching.includes('parked-car')) touchedCar = true;
      if (info.airborne) {
        airborneSince ??= sim.time;
        maxAlt = Math.max(maxAlt, sim.telemetry.altitude);
        const w = toBody(info.pose.rot, info.pose.angvel);
        rollAccum += Math.abs(w[2]) * (1 / 120);
        if (Math.abs(p[0] - HOP_LANE.x) < halfSpan && Math.abs(p[2] - HOP_LANE.carsZ) < 2.6)
          overCars = true;
      }
      if (overCars && p[2] > HOP_LANE.carsZ + 3) cleared = true;
      if (
        airborneSince !== null &&
        !info.airborne &&
        info.wheelContacts >= 2 &&
        landedAt === null &&
        (cleared || touchedCar)
      ) {
        landedAt = sim.time;
        const up = toBody(info.pose.rot, [0, 1, 0]);
        landingAngle = Math.acos(Math.max(-1, Math.min(1, up[1])));
      }
      if (!info.airborne && !overCars) {
        airborneSince = null;
        rollAccum = 0;
      }
      if (landedAt !== null) {
        if (sim.time - landedAt < 0.5)
          peakG = Math.max(peakG, Math.hypot(...info.specific) / sim.params.env.gravity);
        else finish(sim);
      }
      if (
        touchedCar &&
        landedAt === null &&
        !info.airborne &&
        info.wheelContacts >= 2 &&
        p[2] > HOP_LANE.carsZ - 3
      ) {
        landedAt = sim.time;
      }
    },
    hud(sim) {
      return {
        title: c.title,
        status: cleared ? 'Cleared!' : overCars ? 'Over the cars…' : 'Run up, then Shift to hop',
        lines: [
          `Max height: ${fmt(maxAlt, 1)} m`,
          `Roll: ${fmt(deg(rollAccum), 0)}°`,
          `Air: ${fmt(sim.telemetry.tankMass, 0)} kg`,
        ],
      };
    },
  };
  function finish(sim: Sim) {
    c.phase = 'done';
    const clean = cleared && !touchedCar && deg(landingAngle) < 30;
    const kickflip = clean && deg(rollAccum) >= 330;
    const medal: Medal = !clean
      ? null
      : kickflip && peakG < 5
        ? 'gold'
        : maxAlt >= 3
          ? 'silver'
          : 'bronze';
    c.result = {
      kind: 'hop',
      success: clean,
      medal,
      headline:
        !cleared || touchedCar
          ? 'Hit a parked car'
          : kickflip
            ? 'Kick flip!'
            : clean
              ? 'Clean hop'
              : 'Messy landing',
      lines: [
        { label: 'Max height', value: `${fmt(maxAlt, 1)} m` },
        {
          label: 'Reveal kick flip height',
          value: `about ${SPECS.kickflipHeight.value} m`,
          specId: 'kickflipHeight',
        },
        { label: 'Roll in the air', value: `${fmt(deg(rollAccum), 0)}°` },
        { label: 'Air used', value: `${fmt(airStart - (sim.tank?.mass ?? 0), 0)} kg` },
      ],
      score: clean ? Math.round(maxAlt * 100 + (kickflip ? 1000 : 0)) : 0,
      scoreLabel: clean ? `${fmt(maxAlt, 1)} m${kickflip ? ' + flip' : ''}` : 'fail',
      lowerIsBetter: false,
    };
  }
  return c;
}

// ------------------------------------------------------------------------------- hover hold

export function createHover(): Challenge {
  let inBand = 0;
  let flying = false;
  let flightStart = 0;
  let airStart = 0;
  const lo = HOVER_PAD.targetHeight - HOVER_PAD.band;
  const hi = HOVER_PAD.targetHeight + HOVER_PAD.band;
  const c: Challenge = {
    kind: 'hover',
    title: CHALLENGE_INFO.hover.title,
    spawn: 'hover',
    recommendedTrim: 'rocket',
    phase: 'running',
    result: null,
    start(sim) {
      sim.reset('hover');
      airStart = sim.tank?.mass ?? 0;
    },
    onStep(sim, info) {
      if (c.phase !== 'running') return;
      const alt = sim.telemetry.altitude;
      if (!flying && alt > 0.5) {
        flying = true;
        flightStart = sim.time;
      }
      if (flying && alt >= lo && alt <= hi) inBand += 1 / 120;
      if (flying && !info.airborne && sim.time - flightStart > 1) finish(sim);
      if (flying && sim.time - flightStart > 40) finish(sim);
    },
    hud(sim) {
      const t = sim.telemetry;
      return {
        title: c.title,
        status: flying
          ? t.altitude >= lo && t.altitude <= hi
            ? 'In the band — hold it!'
            : t.altitude < lo
              ? 'Too low'
              : 'Too high'
          : 'Hold Shift to lift off',
        lines: [
          `Height: ${fmt(Math.max(0, t.altitude), 2)} m (target ${lo}–${hi} m)`,
          `Time in band: ${fmt(inBand, 1)} s`,
          `Air left: ${fmt(t.tankMass, 0)} kg · ${Number.isFinite(t.airLeftSeconds) ? fmt(t.airLeftSeconds, 1) + ' s' : '—'}`,
        ],
      };
    },
  };
  function finish(sim: Sim) {
    c.phase = 'done';
    const medal: Medal =
      inBand >= 3 ? 'gold' : inBand >= 2 ? 'silver' : inBand >= 1 ? 'bronze' : null;
    c.result = {
      kind: 'hover',
      success: inBand >= 1,
      medal,
      headline: `${fmt(inBand, 1)} s in the band`,
      lines: [
        { label: 'Air used', value: `${fmt(airStart - (sim.tank?.mass ?? 0), 0)} kg` },
        {
          label: 'Hover needs',
          value: `≈ ${fmt((sim.mass * sim.params.env.gravity) / 1000, 1)} kN`,
        },
        { label: 'Why so short?', value: 'Thrust falls with tank pressure' },
      ],
      score: inBand,
      scoreLabel: `${fmt(inBand, 1)} s`,
      lowerIsBetter: false,
    };
  }
  return c;
}

export function createFree(): Challenge {
  return {
    kind: 'free',
    title: CHALLENGE_INFO.free.title,
    spawn: 'hub',
    phase: 'running',
    result: null,
    start(sim) {
      sim.reset('hub');
    },
    onStep() {},
    hud() {
      return { title: 'Free roam', status: 'Explore the test pad', lines: [] };
    },
  };
}

export function createChallenge(
  kind: ChallengeKind,
  trim: TrimId,
  launchControl = true,
): Challenge {
  switch (kind) {
    case 'drag':
      return createDrag(trim, launchControl);
    case 'curl':
    case 'practice':
      return createCurl(kind);
    case 'hop':
      return createHop();
    case 'hover':
      return createHover();
    default:
      return createFree();
  }
}
