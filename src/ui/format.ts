/** Number formatting for the UI (en-US, monospace-friendly). */
export const fmt = (v: number, digits = 1): string =>
  Number.isFinite(v)
    ? v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';

export const fmtInt = (v: number): string =>
  Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—';

export const PSI_PER_PA = 1 / 6894.757293168;
export const BAR_PER_PA = 1e-5;
export const KGF_PER_N = 1 / 9.80665;
export const MPH_PER_MS = 1 / 0.44704;
export const KMH_PER_MS = 3.6;
