/**
 * Tire friction: a tire can push along the road with at most μ·N, where N is the force
 * pressing it onto the surface. Suction raises N without adding mass, so it raises grip.
 * Thrust pushes on the car directly and is not limited by μ at all.
 */

/** Force pressing the car onto the surface: the weight component into the surface plus downforce. */
export function normalLoad(
  mass: number,
  gravity: number,
  /** cos of the angle between the surface normal and "up": 1 floor, 0 wall, −1 ceiling. */
  surfaceCos: number,
  downforce: number,
  /** Extra load from curvature (m·v²/R on a concave curve), N. */
  centripetal = 0,
): number {
  return Math.max(0, mass * gravity * surfaceCos + downforce + centripetal);
}

export function gripLimit(mu: number, normal: number): number {
  return mu * Math.max(normal, 0);
}

/** Max acceleration the tires alone allow on level ground, m/s². */
export function maxTractionAcceleration(
  mu: number,
  mass: number,
  gravity: number,
  downforce: number,
): number {
  return gripLimit(mu, mass * gravity + downforce) / mass;
}

export interface FrictionResult {
  fx: number;
  fy: number;
  /** |F requested| / limit; > 1 means the tire is sliding. */
  utilization: number;
  sliding: boolean;
}

/** Friction circle: scale the requested force back onto the circle of radius μN. */
export function frictionCircle(fxReq: number, fyReq: number, limit: number): FrictionResult {
  const mag = Math.hypot(fxReq, fyReq);
  if (limit <= 0) return { fx: 0, fy: 0, utilization: mag > 0 ? Infinity : 0, sliding: mag > 0 };
  const utilization = mag / limit;
  if (utilization <= 1) return { fx: fxReq, fy: fyReq, utilization, sliding: false };
  const s = 1 / utilization;
  return { fx: fxReq * s, fy: fyReq * s, utilization, sliding: true };
}

/**
 * Smallest suction that keeps the car stuck to a surface: N ≥ 0 and the tires can hold
 * the along-surface weight component. Returns the downforce needed, N.
 */
export function downforceToHold(
  mass: number,
  gravity: number,
  mu: number,
  surfaceCos: number,
  centripetal = 0,
): number {
  const sin = Math.sqrt(Math.max(0, 1 - surfaceCos * surfaceCos));
  // μ·(m g cos + D + C) ≥ m g sin   →   D ≥ m g (sin/μ − cos) − C
  return Math.max(0, mass * gravity * (sin / mu - surfaceCos) - centripetal);
}

export interface GripBudget {
  /** μ·m·g: what the tires give on their own, N. */
  tireOnly: number;
  /** μ·D: extra grip from suction, N. */
  suctionAdded: number;
  /** Thrust, which bypasses the friction limit, N. */
  thrust: number;
}

export function gripBudget(
  mu: number,
  mass: number,
  gravity: number,
  downforce: number,
  thrust: number,
): GripBudget {
  return {
    tireOnly: gripLimit(mu, mass * gravity),
    suctionAdded: gripLimit(mu, downforce),
    thrust: Math.max(0, thrust),
  };
}
