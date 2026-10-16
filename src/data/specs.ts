/**
 * The single source of truth for every number shown in the product.
 *
 * status:
 *  - confirmed: textbook physical constants with a reference source.
 *  - reported:  stated at the 15 Oct 2026 reveal or in press coverage of it (as of 16 Oct 2026).
 *  - estimate:  our own modelling assumption or calibration. Always shown with an "est." tag.
 *
 * Values are stored in the unit they were reported in; `src/physics/params.ts` converts to SI.
 */
import { SOURCES, type SourceId } from './sources';

export type SpecStatus = 'confirmed' | 'reported' | 'estimate';

export type SpecGroup =
  'event' | 'trims' | 'suction' | 'air' | 'thrusters' | 'demo' | 'model' | 'constants';

export interface SpecSource {
  title: string;
  url: string;
}

interface SpecBase {
  id: string;
  label: string;
  unit: string;
  status: SpecStatus;
  group: SpecGroup;
  source?: SpecSource;
  alsoSources?: SpecSource[];
  note?: string;
  /** "under 1.6 s", "over 80 kN", "about 250 kg" */
  qualifier?: 'under' | 'over' | 'about';
}

export interface NumberSpec extends SpecBase {
  value: number;
}

export interface TextSpec extends SpecBase {
  value: string;
}

export type Spec = NumberSpec | TextSpec;

const src = (id: SourceId): SpecSource => ({
  title: `${SOURCES[id].publisher} — ${SOURCES[id].title}`,
  url: SOURCES[id].url,
});

const reported = (ids: SourceId[]): Pick<SpecBase, 'status' | 'source' | 'alsoSources'> => {
  const [first, ...rest] = ids;
  if (!first) throw new Error('reported spec needs a source');
  return {
    status: 'reported',
    source: src(first),
    ...(rest.length ? { alsoSources: rest.map(src) } : {}),
  };
};

const confirmed = (id: SourceId): Pick<SpecBase, 'status' | 'source'> => ({
  status: 'confirmed',
  source: src(id),
});

const estimate = { status: 'estimate' } as const;

// --- Physical constants used for derived estimates below -------------------------------------
const PSI_TO_PA = 6894.757293168;
const R_AIR = 287;
const T_AMBIENT = 293;

/** Linear compressibility Z(p) = 1 + b·p, calibrated so 600 L at 5,500 psi and 293 K hold 250 kg. */
function calibrateCompressibility(): number {
  const p = 5500 * PSI_TO_PA;
  const ideal = (p * 0.6) / (R_AIR * T_AMBIENT);
  return ideal / 250;
}

const Z_AT_STORAGE = calibrateCompressibility();

export const SPECS = {
  // ---------------------------------------------------------------- event
  revealDate: {
    id: 'revealDate',
    label: 'Reveal date',
    value: '15 Oct 2026',
    unit: '',
    group: 'event',
    ...reported(['cbs', 'paultan']),
  },
  revealVenue: {
    id: 'revealVenue',
    label: 'Reveal venue',
    value: "SpaceX's test site in McGregor, Texas; livestreamed on Tesla's X account",
    unit: '',
    group: 'event',
    ...reported(['cbs', 'paultan']),
  },
  productionTarget: {
    id: 'productionTarget',
    label: 'Production target',
    value: 2028,
    unit: '',
    group: 'event',
    ...reported(['cbs', 'paultan']),
  },

  // ---------------------------------------------------------------- trims
  perfZeroToSixty: {
    id: 'perfZeroToSixty',
    label: 'Performance: 0–60 mph',
    value: 1.6,
    unit: 's',
    qualifier: 'under',
    group: 'trims',
    note: 'Active aero + fan suction system, 2 seats.',
    ...reported(['dtc', 'notateslaapp', 'notebookcheck']),
  },
  perfAccelG: {
    id: 'perfAccelG',
    label: 'Performance: acceleration',
    value: 1.7,
    unit: 'g',
    qualifier: 'about',
    group: 'trims',
    note: 'CellCog’s math from the claimed 0–60 time (26.8 m/s ÷ time), not a Tesla figure.',
    ...reported(['cellcog']),
  },
  perfSeats: {
    id: 'perfSeats',
    label: 'Performance: seats',
    value: 2,
    unit: '',
    group: 'trims',
    ...reported(['dtc', 'notateslaapp']),
  },
  thrustZeroToSixty: {
    id: 'thrustZeroToSixty',
    label: 'Thrust: 0–60 mph',
    value: 0.9,
    unit: 's',
    qualifier: 'under',
    group: 'trims',
    note: 'Adds 4 rear cold-gas thrusters, 2 seats. Wikipedia credits the 0.81 s demo run to this trim.',
    ...reported(['dtc', 'notateslaapp', 'notebookcheck']),
  },
  thrustAccelG: {
    id: 'thrustAccelG',
    label: 'Thrust: acceleration',
    value: 3.0,
    unit: 'g',
    qualifier: 'about',
    group: 'trims',
    note: 'CellCog’s math from the claimed 0–60 time (26.8 m/s ÷ time), not a Tesla figure.',
    ...reported(['cellcog']),
  },
  thrustSeats: {
    id: 'thrustSeats',
    label: 'Thrust: seats',
    value: 2,
    unit: '',
    group: 'trims',
    ...reported(['dtc', 'notateslaapp']),
  },
  rocketZeroToSixty: {
    id: 'rocketZeroToSixty',
    label: 'Rocket: 0–60 mph',
    value: 0.59,
    unit: 's',
    qualifier: 'under',
    group: 'trims',
    note: 'Full thruster array ("full flight system"), 1 seat.',
    ...reported(['dtc', 'notateslaapp', 'notebookcheck']),
  },
  rocketAccelG: {
    id: 'rocketAccelG',
    label: 'Rocket: acceleration',
    value: 4.64,
    unit: 'g',
    qualifier: 'about',
    group: 'trims',
    note: 'CellCog’s math from the claimed 0–60 time (26.8 m/s ÷ time), not a Tesla figure.',
    ...reported(['cellcog']),
  },
  rocketSeats: {
    id: 'rocketSeats',
    label: 'Rocket: seats',
    value: 1,
    unit: '',
    group: 'trims',
    ...reported(['dtc', 'notateslaapp']),
  },
  rocketAccess: {
    id: 'rocketAccess',
    label: 'Rocket: availability',
    value: 'Invite-only; not approved for public roads',
    unit: '',
    group: 'trims',
    ...reported(['dtc', 'notateslaapp', 'notebookcheck']),
  },
  demoZeroToSixty: {
    id: 'demoZeroToSixty',
    label: 'Demo run: 0–60 mph',
    value: 0.81,
    unit: 's',
    group: 'demo',
    ...reported(['dezeen', 'paultan']),
  },
  topSpeed: {
    id: 'topSpeed',
    label: 'Top speed target',
    value: 230,
    unit: 'mph',
    qualifier: 'over',
    group: 'trims',
    note: 'Drive Tesla Canada gives this figure for the Rocket.',
    ...reported(['foxbusiness', 'dtc', 'axios']),
  },

  // ---------------------------------------------------------------- suction
  fanPatent: {
    id: 'fanPatent',
    label: 'Fan downforce patent',
    value: 'US 12,377,920 — "Adaptive Vehicle Aerodynamics for Downforce"',
    unit: '',
    group: 'suction',
    note: 'Underbody fans plus deployable skirts seal the floor and pull air out from under the car, creating downforce even at zero speed.',
    ...reported(['paultan']),
  },
  tireOnlyGrip: {
    id: 'tireOnlyGrip',
    label: 'Grip from tires alone',
    value: 1.26,
    unit: 'g',
    qualifier: 'about',
    group: 'suction',
    note: 'Lars Moravy, quoted by Paul Tan. We use it as the tire friction coefficient μ.',
    ...reported(['paultan']),
  },
  fanCorneringG: {
    id: 'fanCorneringG',
    label: 'Cornering with fans',
    value: 2,
    unit: 'g',
    qualifier: 'over',
    group: 'suction',
    ...reported(['paultan']),
  },
  invertedDownforce: {
    id: 'invertedDownforce',
    label: 'Downforce readout while inverted on the ramp',
    value: 4700,
    unit: 'kg',
    group: 'suction',
    note: 'Shown as kilograms-force: 4,700 kgf ≈ 46 kN.',
    ...reported(['paultan', 'dtc']),
  },
  fanModes: {
    id: 'fanModes',
    label: 'Fan system modes',
    value:
      'Low-speed suction; at high speed the front and rear of the system open for more underbody airflow',
    unit: '',
    group: 'suction',
    ...reported(['paultan']),
  },
  fanEnergy: {
    id: 'fanEnergy',
    label: 'Fan power source',
    value: 'Battery-powered; the fans do not use the air tanks',
    unit: '',
    group: 'suction',
    ...reported(['insideevs']),
  },

  // ---------------------------------------------------------------- air storage
  copvCount: {
    id: 'copvCount',
    label: 'Composite-overwrapped pressure vessels (COPVs)',
    value: 2,
    unit: '',
    group: 'air',
    ...reported(['paultan', 'yahoo']),
  },
  airVolumeTotal: {
    id: 'airVolumeTotal',
    label: 'Combined tank volume (Rocket)',
    value: 600,
    unit: 'L',
    group: 'air',
    note: 'InsideEVs: 600 L is the Rocket’s total.',
    ...reported(['paultan', 'notateslaapp', 'insideevs']),
  },
  airMass: {
    id: 'airMass',
    label: 'Stored air (mostly nitrogen)',
    value: 250,
    unit: 'kg',
    qualifier: 'about',
    group: 'air',
    note: 'Lars Moravy, quoted by Paul Tan; Yahoo/MotorTrend: “primarily nitrogen”.',
    ...reported(['paultan', 'notateslaapp', 'yahoo']),
  },
  tankLayout: {
    id: 'tankLayout',
    label: 'Tank layout',
    value:
      'One large COPV behind the seats (Thrust, 200 L); the Rocket adds a 400 L COPV in place of the passenger seat',
    unit: '',
    group: 'air',
    note: 'Lars Moravy via InsideEVs. Yahoo/MotorTrend: the extra vessel “tripled the total amount of gas”. Earlier reporting suggested a ~200 L second tank; we follow Moravy. Yahoo describes the main tank both as a “sphere” and as a cylinder with near-hemispherical ends.',
    ...reported(['insideevs', 'yahoo']),
  },
  thrustTankVolume: {
    id: 'thrustTankVolume',
    label: 'Thrust trim: tank volume',
    value: 200,
    unit: 'L',
    group: 'air',
    note: 'InsideEVs quotes Moravy on “the Thrust version’s 200-liter tank”.',
    ...reported(['insideevs']),
  },
  rocketSecondTank: {
    id: 'rocketSecondTank',
    label: 'Rocket: second COPV (replaces passenger seat)',
    value: 400,
    unit: 'L',
    group: 'air',
    note: 'Moravy via InsideEVs: “an additional 400-liter pressure vessel replaces the passenger seat”.',
    ...reported(['insideevs', 'yahoo']),
  },
  thrusterPressure: {
    id: 'thrusterPressure',
    label: 'In-car screen: "Thruster" pressure',
    value: 5500,
    unit: 'psi',
    group: 'air',
    note: 'Not stated on stage; read off an in-car screen (~379 bar). We use it as the default full tank pressure.',
    ...reported(['paultan']),
  },
  muskPressure: {
    id: 'muskPressure',
    label: 'Older Musk statements: tank pressure',
    value: 10000,
    unit: 'psi',
    qualifier: 'about',
    group: 'air',
    note: 'Contradicts the 5,500 psi screen readout. Available as a "what if".',
    ...reported(['wikiRoadster']),
  },
  refillHoursMin: {
    id: 'refillHoursMin',
    label: 'Refill time (external nitrogen), low end',
    value: 2,
    unit: 'h',
    group: 'air',
    note: 'Lars Moravy (Top Gear interview, via InsideEVs): filling the Thrust tank from an external high-pressure nitrogen supply currently takes two to six hours.',
    ...reported(['insideevs']),
  },
  refillHoursMax: {
    id: 'refillHoursMax',
    label: 'Refill time (external nitrogen), high end',
    value: 6,
    unit: 'h',
    group: 'air',
    ...reported(['insideevs']),
  },
  selfRefill: {
    id: 'selfRefill',
    label: 'Self-refilling',
    value: 'Elon Musk says the car refills its own tanks',
    unit: '',
    group: 'air',
    ...reported(['insideevs', 'evcentral']),
  },

  // ---------------------------------------------------------------- thrusters
  nozzleCount: {
    id: 'nozzleCount',
    label: 'Nozzles in total (Rocket)',
    value: 10,
    unit: '',
    group: 'thrusters',
    ...reported(['paultan', 'yahoo', 'notebookcheck']),
  },
  rearNozzleCount: {
    id: 'rearNozzleCount',
    label: 'Rear main thrusters (in the diffuser)',
    value: 4,
    unit: '',
    group: 'thrusters',
    ...reported(['paultan', 'evcentral', 'yahoo']),
  },
  rearThrustTotal: {
    id: 'rearThrustTotal',
    label: 'Rear thrust, combined',
    value: 80,
    unit: 'kN',
    qualifier: 'over',
    group: 'thrusters',
    note: 'EV Central: the four rear thrusters handle acceleration “with more than 80kN”. Paul Tan: enough “to hold up more than 8,000 kg”.',
    ...reported(['evcentral', 'paultan', 'yahoo']),
  },
  downNozzleCount: {
    id: 'downNozzleCount',
    label: 'Rocket: downward lift nozzles',
    value: 4,
    unit: '',
    group: 'thrusters',
    note: 'MotorTrend’s own calculation (via Yahoo Autos), not a Tesla statement. EV Central says “six thrusters point down”; Paul Tan describes thrusters “at all four corners… firing downwards”.',
    ...reported(['yahoo']),
  },
  yawNozzleCount: {
    id: 'yawNozzleCount',
    label: 'Rocket: front yaw nozzles (left/right)',
    value: 2,
    unit: '',
    group: 'thrusters',
    note: 'MotorTrend’s own calculation (via Yahoo Autos), not a Tesla statement. EV Central says “six thrusters point down”; Paul Tan describes thrusters “at all four corners… firing downwards”.',
    ...reported(['yahoo']),
  },
  thrustVsTiresMin: {
    id: 'thrustVsTiresMin',
    label: 'Thruster force vs tire force (low end)',
    value: 4,
    unit: '×',
    group: 'thrusters',
    note: 'Tesla on X: the thruster system makes 4–5× the force the tires can.',
    ...reported(['foxbusiness', 'dtc']),
  },
  thrustVsTiresMax: {
    id: 'thrustVsTiresMax',
    label: 'Thruster force vs tire force (high end)',
    value: 5,
    unit: '×',
    group: 'thrusters',
    ...reported(['foxbusiness']),
  },
  flightActuators: {
    id: 'flightActuators',
    label: 'Flight stabilisation',
    value: 'Electric actuators make rapid adjustments to stabilise the car in flight',
    unit: '',
    group: 'thrusters',
    ...reported(['dtc']),
  },
  cellcogFullThrust: {
    id: 'cellcogFullThrust',
    label: 'Independent estimate: full thrust per fill',
    value: 2,
    unit: 's',
    qualifier: 'about',
    group: 'thrusters',
    note: 'CellCog: "about two seconds of full thrust per fill". Our model must agree.',
    ...reported(['cellcog']),
  },

  // ---------------------------------------------------------------- demo
  demoTrick: {
    id: 'demoTrick',
    label: 'The reveal trick',
    value:
      'Drove up a ramp that curled over until upside down, clung to it, flew off the end, rolled 180° in mid-air and landed on its wheels; also a "kick flip" over parked cars',
    unit: '',
    group: 'demo',
    ...reported(['cbs', 'foxbusiness']),
  },

  rampPitch: {
    id: 'rampPitch',
    label: 'Curl ramp: pitch at the end',
    value: 170,
    unit: '°',
    group: 'demo',
    ...reported(['paultan']),
  },
  rampHeight: {
    id: 'rampHeight',
    label: 'Curl ramp: height of the inverted end',
    value: 21,
    unit: 'm',
    qualifier: 'about',
    group: 'demo',
    note: 'Paul Tan: “about 21 metres off the ground”.',
    ...reported(['paultan']),
  },
  landingG: {
    id: 'landingG',
    label: 'G-force readout during the landing',
    value: 3.3,
    unit: 'g',
    group: 'demo',
    note: 'Paul Tan: the readout “jumped to 3.3 G at about 6.5 metres”.',
    ...reported(['paultan']),
  },
  landingGAltitude: {
    id: 'landingGAltitude',
    label: 'Altitude of the 3.3 g readout',
    value: 6.5,
    unit: 'm',
    qualifier: 'about',
    group: 'demo',
    ...reported(['paultan']),
  },
  kickflipHeight: {
    id: 'kickflipHeight',
    label: 'Kick flip height',
    value: 7,
    unit: 'm',
    qualifier: 'about',
    group: 'demo',
    ...reported(['paultan']),
  },

  // ---------------------------------------------------------------- model estimates
  vehicleMass: {
    id: 'vehicleMass',
    label: 'Vehicle mass (with full tanks)',
    value: 2350,
    unit: 'kg',
    group: 'model',
    note: 'Not published. Adjustable in "what if".',
    ...estimate,
  },
  floorArea: {
    id: 'floorArea',
    label: 'Sealed floor area',
    value: 4,
    unit: 'm²',
    qualifier: 'about',
    group: 'model',
    note: 'Not published. Modelled as a 2.5 m × 1.6 m rectangle inside the skirts.',
    ...estimate,
  },
  floorPerimeter: {
    id: 'floorPerimeter',
    label: 'Skirt perimeter',
    value: 8.2,
    unit: 'm',
    group: 'model',
    note: 'Perimeter of the 2.5 m × 1.6 m sealed rectangle.',
    ...estimate,
  },
  compressibility: {
    id: 'compressibility',
    label: 'Compressibility factor Z at 5,500 psi',
    value: Math.round(Z_AT_STORAGE * 1000) / 1000,
    unit: '',
    group: 'model',
    note: 'Calibrated so 600 L at 5,500 psi and 20 °C hold 250 kg (an ideal gas would hold ~271 kg). Z falls linearly to 1 at zero pressure.',
    ...estimate,
  },
  ambientTemperature: {
    id: 'ambientTemperature',
    label: 'Ambient and initial tank temperature',
    value: 293,
    unit: 'K',
    group: 'model',
    note: '20 °C.',
    ...estimate,
  },
  tankHeatTransfer: {
    id: 'tankHeatTransfer',
    label: 'Tank wall heat transfer (blended mode)',
    value: 1.5,
    unit: 'kW/K',
    group: 'model',
    note: 'Turbulent internal convection over ~4 m² of liner. Small compared with the cooling from a 2-second blowdown, so "blended" sits close to adiabatic.',
    ...estimate,
  },
  nozzleAreaRatio: {
    id: 'nozzleAreaRatio',
    label: 'Nozzle exit/throat area ratio',
    value: 8,
    unit: '',
    group: 'model',
    note: 'Chosen so the jet is under-expanded at full pressure (hence the shock diamonds).',
    ...estimate,
  },
  nozzleDischarge: {
    id: 'nozzleDischarge',
    label: 'Nozzle discharge coefficient',
    value: 0.95,
    unit: '',
    group: 'model',
    ...estimate,
  },
  downNozzleThrust: {
    id: 'downNozzleThrust',
    label: 'Thrust per downward lift nozzle (full pressure)',
    value: 19,
    unit: 'kN',
    group: 'model',
    note: 'Not published. Chosen so the four lift nozzles at full pressure give 3.3 g for a 2,350 kg car, matching the 3.3 g landing readout (we assume that readout was thrust, not impact). The whole Rocket array is then ~161 kN: 5.5× tire-only grip (1.26 g) or 3.5× fan-assisted 2 g grip — Tesla’s “4–5×” sits in between.',
    ...estimate,
  },
  yawNozzleThrust: {
    id: 'yawNozzleThrust',
    label: 'Thrust per front yaw nozzle (full pressure)',
    value: 2.5,
    unit: 'kN',
    group: 'model',
    note: 'Not published.',
    ...estimate,
  },
  pwmPeriod: {
    id: 'pwmPeriod',
    label: 'Valve PWM period',
    value: 40,
    unit: 'ms',
    group: 'model',
    note: 'On/off valves modulated at 25 Hz, like real cold-gas attitude thrusters.',
    ...estimate,
  },
  motorPeakForce: {
    id: 'motorPeakForce',
    label: 'Motor peak tractive force',
    value: 44,
    unit: 'kN',
    group: 'model',
    note: 'Calibrated so the Performance trim (fans on, no thrust) runs 0–60 mph just under the claimed 1.6 s.',
    ...estimate,
  },
  motorPeakPower: {
    id: 'motorPeakPower',
    label: 'Motor peak power at the wheels',
    value: 1100,
    unit: 'kW',
    group: 'model',
    note: 'Calibrated together with peak force.',
    ...estimate,
  },
  thrustTrimLaunchDuty: {
    id: 'thrustTrimLaunchDuty',
    label: 'Thrust trim: rear thruster duty limit',
    value: 0.6,
    unit: '',
    group: 'model',
    note: 'Both Thrust and Rocket reportedly have the same 4 rear thrusters, yet Thrust is slower. Tesla has not said why. We cap the Thrust trim’s average valve duty so its 0–60 time matches the claim.',
    ...estimate,
  },
  dragArea: {
    id: 'dragArea',
    label: 'Drag area C_d·A',
    value: 0.6,
    unit: 'm²',
    group: 'model',
    ...estimate,
  },
  rollingResistance: {
    id: 'rollingResistance',
    label: 'Rolling resistance coefficient',
    value: 0.012,
    unit: '',
    group: 'model',
    ...estimate,
  },
  suctionTarget: {
    id: 'suctionTarget',
    label: 'Design underbody suction',
    value: 11.5,
    unit: 'kPa',
    group: 'model',
    note: 'Derived: 4,700 kgf ÷ 4 m² ≈ 11.5 kPa — only ~11% below ambient pressure.',
    ...estimate,
  },
  fanShutoffPressure: {
    id: 'fanShutoffPressure',
    label: 'Fan shut-off suction (no leakage)',
    value: 14,
    unit: 'kPa',
    group: 'model',
    ...estimate,
  },
  fanEfficiency: {
    id: 'fanEfficiency',
    label: 'Fan + motor efficiency',
    value: 0.55,
    unit: '',
    group: 'model',
    ...estimate,
  },
  fanCount: {
    id: 'fanCount',
    label: 'Number of underbody fans',
    value: 2,
    unit: '',
    group: 'model',
    note: 'Not published; we draw two.',
    ...estimate,
  },
  sealGapNominal: {
    id: 'sealGapNominal',
    label: 'Residual skirt leak gap when sealed',
    value: 4,
    unit: 'mm',
    group: 'model',
    note: 'Equivalent average gap between skirts and road. Sets how much air the fans must keep pumping.',
    ...estimate,
  },
  skirtReach: {
    id: 'skirtReach',
    label: 'Skirt travel',
    value: 0.2,
    unit: 'm',
    group: 'model',
    note: 'How far the deployable skirts can extend to follow the surface (needed on the curved ramp).',
    ...estimate,
  },
  leakDischarge: {
    id: 'leakDischarge',
    label: 'Skirt leak discharge coefficient',
    value: 0.6,
    unit: '',
    group: 'model',
    ...estimate,
  },
  suctionCollapseTime: {
    id: 'suctionCollapseTime',
    label: 'Suction collapse time constant',
    value: 0.05,
    unit: 's',
    group: 'model',
    note: 'How fast underbody pressure returns to ambient once the seal breaks.',
    ...estimate,
  },
  suctionBuildTime: {
    id: 'suctionBuildTime',
    label: 'Suction build-up time constant',
    value: 0.15,
    unit: 's',
    group: 'model',
    ...estimate,
  },
  fanSpinUpTime: {
    id: 'fanSpinUpTime',
    label: 'Fan spin-up time constant',
    value: 0.4,
    unit: 's',
    group: 'model',
    ...estimate,
  },
  highSpeedModeSpeed: {
    id: 'highSpeedModeSpeed',
    label: 'Switch to high-speed fan mode above',
    value: 160,
    unit: 'km/h',
    group: 'model',
    note: 'Speed not published. In high-speed mode we only show the front and rear opening; suction is modelled the same.',
    ...estimate,
  },
  compressorEfficiency: {
    id: 'compressorEfficiency',
    label: 'Refill compressor efficiency',
    value: 0.5,
    unit: '',
    group: 'model',
    ...estimate,
  },
  rampRadius: {
    id: 'rampRadius',
    label: 'Curl ramp radius (as reported)',
    value: 10.6,
    unit: 'm',
    group: 'model',
    note: 'Derived from the reported 170° end pitch and ~21 m height, assuming a circular curl: R = 21 m ÷ (1 − cos 170°).',
    ...estimate,
  },
  practiceRampRadius: {
    id: 'practiceRampRadius',
    label: 'Practice curl radius',
    value: 5,
    unit: 'm',
    group: 'model',
    note: 'Our smaller training ramp (same 170° curl, ~10 m high).',
    ...estimate,
  },
  rampWidth: {
    id: 'rampWidth',
    label: 'Curl ramp width',
    value: 5,
    unit: 'm',
    group: 'model',
    ...estimate,
  },

  // ---------------------------------------------------------------- constants
  gravityEarth: {
    id: 'gravityEarth',
    label: 'Standard gravity (Earth)',
    value: 9.80665,
    unit: 'm/s²',
    group: 'constants',
    ...confirmed('wikiGravity'),
  },
  gravityMoon: {
    id: 'gravityMoon',
    label: 'Surface gravity (Moon)',
    value: 1.62,
    unit: 'm/s²',
    group: 'constants',
    ...confirmed('nasaMoon'),
  },
  gravityMars: {
    id: 'gravityMars',
    label: 'Surface gravity (Mars)',
    value: 3.71,
    unit: 'm/s²',
    group: 'constants',
    ...confirmed('nasaMars'),
  },
  ambientPressure: {
    id: 'ambientPressure',
    label: 'Sea-level ambient pressure',
    value: 101325,
    unit: 'Pa',
    group: 'constants',
    ...confirmed('wikiAtm'),
  },
  marsPressure: {
    id: 'marsPressure',
    label: 'Mars surface pressure',
    value: 636,
    unit: 'Pa',
    group: 'constants',
    ...confirmed('nasaMars'),
  },
  gammaAir: {
    id: 'gammaAir',
    label: 'Heat capacity ratio γ (air, N₂)',
    value: 1.4,
    unit: '',
    group: 'constants',
    ...confirmed('wikiGamma'),
  },
  rAir: {
    id: 'rAir',
    label: 'Specific gas constant (air)',
    value: R_AIR,
    unit: 'J/(kg·K)',
    group: 'constants',
    ...confirmed('wikiGasConstant'),
  },
  rNitrogen: {
    id: 'rNitrogen',
    label: 'Specific gas constant (nitrogen)',
    value: 296.8,
    unit: 'J/(kg·K)',
    group: 'constants',
    ...confirmed('wikiGasConstant'),
  },
} as const satisfies Record<string, Spec>;

export type SpecId = keyof typeof SPECS;

export const SPEC_LIST: Spec[] = Object.values(SPECS);

export const SPEC_GROUP_LABELS: Record<SpecGroup, string> = {
  event: 'The reveal',
  trims: 'Trims and performance claims',
  suction: 'Fan suction and downforce',
  air: 'Air storage',
  thrusters: 'Thrusters',
  demo: 'The demo',
  model: 'Our modelling estimates',
  constants: 'Physical constants',
};

export const STATUS_LABELS: Record<SpecStatus, { short: string; long: string }> = {
  confirmed: { short: 'const.', long: 'Physical constant (textbook value)' },
  reported: { short: 'rep.', long: 'Reported at or after the 15 Oct 2026 reveal' },
  estimate: { short: 'est.', long: 'Our estimate or calibration — not published' },
};

/** Convenience: numeric value of a spec. */
export function specValue<K extends SpecId>(id: K): (typeof SPECS)[K]['value'] {
  return SPECS[id].value;
}
