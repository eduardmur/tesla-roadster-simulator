/** Visual identity: "engineering lab at dusk". One warm accent for thrust, one cool for suction. */
export const COLORS = {
  bg: '#0b0f17',
  panel: 'rgba(12, 17, 27, 0.82)',
  panelSolid: '#111826',
  border: 'rgba(160, 180, 210, 0.18)',
  text: '#e8edf5',
  muted: '#9aa7b8',
  /** Thrust / compressed air (warm). */
  thrust: '#ff8a3d',
  /** Suction / fans (cool). */
  suction: '#3ec7ff',
  ok: '#7bd88f',
  warn: '#ffd166',
  bad: '#ff6b6b',
  focus: '#ffe08a',
} as const;

/** Status tag styling for spec numbers. Never colour alone: each also has a text label. */
export const STATUS_STYLE = {
  confirmed: { label: 'const.', color: '#b9c6d8' },
  reported: { label: 'rep.', color: '#9ad1ff' },
  estimate: { label: 'est.', color: '#ffd166' },
} as const;
