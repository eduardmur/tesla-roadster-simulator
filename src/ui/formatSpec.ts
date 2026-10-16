import type { Spec } from '../data/specs';

const QUALIFIER: Record<string, string> = { under: 'under ', over: 'over ', about: '~' };

export function formatSpec(spec: Spec, digits?: number): string {
  if (typeof spec.value === 'string') return spec.value;
  const v =
    digits === undefined
      ? spec.value.toLocaleString('en-US', { maximumFractionDigits: 3 })
      : spec.value.toLocaleString('en-US', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
  const q = spec.qualifier ? QUALIFIER[spec.qualifier] : '';
  const unit = spec.unit
    ? spec.unit === '×' || spec.unit === '°'
      ? spec.unit
      : ` ${spec.unit}`
    : '';
  return `${q}${v}${unit}`;
}
