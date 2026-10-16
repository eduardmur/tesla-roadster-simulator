/**
 * Every external source the project relies on. Specs in `specs.ts` reference these by id.
 * Press sources describe the 15 Oct 2026 reveal; "background" sources back textbook physics.
 */

export interface Source {
  id: SourceId;
  title: string;
  publisher: string;
  url: string;
  kind: 'press' | 'analysis' | 'reference' | 'background';
}

export type SourceId =
  | 'cbs'
  | 'standard'
  | 'paultan'
  | 'yahoo'
  | 'insideevs'
  | 'notebookcheck'
  | 'dtc'
  | 'notateslaapp'
  | 'foxbusiness'
  | 'dezeen'
  | 'axios'
  | 'evcentral'
  | 'cellcog'
  | 'wikiRoadster'
  | 'wikiMcMurtry'
  | 'wikiBrabham'
  | 'nasaIsentropic'
  | 'nasaChoking'
  | 'nasaThrust'
  | 'nasaMoon'
  | 'nasaMars'
  | 'wikiAtm'
  | 'wikiGravity'
  | 'wikiGasConstant'
  | 'wikiGamma'
  | 'wikiShockDiamond'
  | 'wikiCompressibility';

export const SOURCES: Record<SourceId, Source> = {
  cbs: {
    id: 'cbs',
    title: 'With Tesla Roadster debut, Elon Musk shows "flying cars are real"',
    publisher: 'CBS News',
    url: 'https://www.cbsnews.com/news/tesla-roadster-debut-elon-musk-flying-cars-are-real/',
    kind: 'press',
  },
  standard: {
    id: 'standard',
    title: "Elon Musk unveils Tesla's 'flying' car",
    publisher: 'The Standard (Reuters copy)',
    url: 'https://www.thestandard.com.hk/world/article/345690/Elon-Musk-unveils-Teslas-flying-car',
    kind: 'press',
  },
  paultan: {
    id: 'paultan',
    title:
      'Tesla Roadster revealed – flies on SpaceX air thrusters, 0-96 km/h in 0.81s, production 2028',
    publisher: 'Paul Tan',
    url: 'https://paultan.org/2026/10/16/tesla-roadster-revealed-flies-on-spacex-air-thrusters-0-96-km-h-in-0-81s-production-2028/',
    kind: 'press',
  },
  yahoo: {
    id: 'yahoo',
    title: "Yes, the Tesla Roadster Flew. Here's How the Rocket Powered Car Works",
    publisher: 'Yahoo Autos (MotorTrend)',
    url: 'https://autos.yahoo.com/ev-and-future-tech/articles/did-tesla-roadster-fly-heres-022207241.html',
    kind: 'press',
  },
  insideevs: {
    id: 'insideevs',
    title: "The Tesla Roadster's Thrusters Last Seconds. Refilling Takes Hours",
    publisher: 'InsideEVs',
    url: 'https://insideevs.com/news/812205/tesla-roadster-replenishes-air-tanks/',
    kind: 'press',
  },
  notebookcheck: {
    id: 'notebookcheck',
    title: 'Tesla Roadster EV debuts with SpaceX thruster technology to fly through the air',
    publisher: 'Notebookcheck',
    url: 'https://www.notebookcheck.net/Tesla-Roadster-EV-debuts-with-SpaceX-thruster-technology-to-fly-through-the-air.1425722.0.html',
    kind: 'press',
  },
  dtc: {
    id: 'dtc',
    title: 'Tesla Reveals How New Roadster Can Fly Using SpaceX Rocket Technology',
    publisher: 'Drive Tesla Canada',
    url: 'https://driveteslacanada.ca/news/tesla-roadster-cold-gas-thrusters-flight-2028/',
    kind: 'press',
  },
  notateslaapp: {
    id: 'notateslaapp',
    title: 'Tesla Roadster Event Recap: It Flies, Flips, and Hits 0-60 in 0.81s',
    publisher: 'Not a Tesla App',
    url: 'https://www.notateslaapp.com/news/4837/tesla-roadster-event-recap-it-flies-flips-and-hits-0-60-in-081s',
    kind: 'press',
  },
  foxbusiness: {
    id: 'foxbusiness',
    title: "Tesla's new Roadster takes flight during dramatic unveiling at SpaceX facility",
    publisher: 'Fox Business',
    url: 'https://www.foxbusiness.com/technology/teslas-new-roadster-makes-flying-debut-hitting-60-mph-under-second',
    kind: 'press',
  },
  dezeen: {
    id: 'dezeen',
    title: 'Tesla launches flying Roadster concept car',
    publisher: 'Dezeen',
    url: 'https://www.dezeen.com/2026/10/16/tesla-launches-flying-roadster-concept-car/',
    kind: 'press',
  },
  axios: {
    id: 'axios',
    title: "Elon Musk's flying Tesla is gloriously absurd",
    publisher: 'Axios',
    url: 'https://www.axios.com/2026/10/16/tesla-roadster-elon-musk-flying-car',
    kind: 'press',
  },
  evcentral: {
    id: 'evcentral',
    title:
      "Tesla Roadster revealed with SpaceX thrusters: 0-100km/h in less than a second, it can fly and you still can't have one",
    publisher: 'EV Central',
    url: 'https://evcentral.com.au/tesla-roadster-revealed-with-spacex-thrusters-0-100km-h-in-less-than-a-second-it-can-fly-and-you-still-cant-have-one/',
    kind: 'press',
  },
  cellcog: {
    id: 'cellcog',
    title: 'Tesla Roadster Physics: Thrusters and Suction, Animated',
    publisher: 'CellCog',
    url: 'https://cellcog.ai/blog/tesla-roadster-physics/',
    kind: 'analysis',
  },
  wikiRoadster: {
    id: 'wikiRoadster',
    title: 'Tesla Roadster (second generation)',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Tesla_Roadster_(second_generation)',
    kind: 'reference',
  },
  wikiMcMurtry: {
    id: 'wikiMcMurtry',
    title: 'McMurtry Spéirling (fan car)',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/McMurtry_Sp%C3%A9irling',
    kind: 'background',
  },
  wikiBrabham: {
    id: 'wikiBrabham',
    title: 'Brabham BT46 (BT46B "fan car")',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Brabham_BT46',
    kind: 'background',
  },
  nasaIsentropic: {
    id: 'nasaIsentropic',
    title: 'Isentropic flow equations',
    publisher: 'NASA Glenn Research Center',
    url: 'https://www.grc.nasa.gov/www/k-12/airplane/isentrop.html',
    kind: 'background',
  },
  nasaChoking: {
    id: 'nasaChoking',
    title: 'Mass flow choking',
    publisher: 'NASA Glenn Research Center',
    url: 'https://www.grc.nasa.gov/www/k-12/airplane/mflchk.html',
    kind: 'background',
  },
  nasaThrust: {
    id: 'nasaThrust',
    title: 'Rocket thrust summary',
    publisher: 'NASA Glenn Research Center',
    url: 'https://www.grc.nasa.gov/www/k-12/rocket/rktthsum.html',
    kind: 'background',
  },
  nasaMoon: {
    id: 'nasaMoon',
    title: 'Moon fact sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    kind: 'background',
  },
  nasaMars: {
    id: 'nasaMars',
    title: 'Mars fact sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    kind: 'background',
  },
  wikiAtm: {
    id: 'wikiAtm',
    title: 'Standard atmosphere (unit)',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Standard_atmosphere_(unit)',
    kind: 'background',
  },
  wikiGravity: {
    id: 'wikiGravity',
    title: 'Standard gravity',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Standard_gravity',
    kind: 'background',
  },
  wikiGasConstant: {
    id: 'wikiGasConstant',
    title: 'Gas constant — specific gas constant',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Gas_constant#Specific_gas_constant',
    kind: 'background',
  },
  wikiGamma: {
    id: 'wikiGamma',
    title: 'Heat capacity ratio',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Heat_capacity_ratio',
    kind: 'background',
  },
  wikiShockDiamond: {
    id: 'wikiShockDiamond',
    title: 'Shock diamond',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Shock_diamond',
    kind: 'background',
  },
  wikiCompressibility: {
    id: 'wikiCompressibility',
    title: 'Compressibility factor',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Compressibility_factor',
    kind: 'background',
  },
};

export const PRESS_SOURCE_IDS: SourceId[] = [
  'cbs',
  'standard',
  'paultan',
  'yahoo',
  'insideevs',
  'notebookcheck',
  'dtc',
  'notateslaapp',
  'foxbusiness',
  'dezeen',
  'axios',
  'evcentral',
  'cellcog',
  'wikiRoadster',
  'wikiMcMurtry',
  'wikiBrabham',
];
