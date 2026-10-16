/** Every spec number on screen goes through here, so its status and source always travel with it. */
import { SPECS, STATUS_LABELS, type Spec, type SpecId, type SpecStatus } from '../data/specs';
import { formatSpec } from './formatSpec';

export function StatusTag({
  status,
  source,
  label,
}: {
  status: SpecStatus;
  source?: Spec['source'];
  label?: string;
}) {
  const s = STATUS_LABELS[status];
  const title = `${s.long}${source ? ` — ${source.title}` : ''}`;
  const text = label ?? s.short;
  if (source) {
    return (
      <a
        className={`tag tag--${status}`}
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        aria-label={`${s.long}. Source: ${source.title} (opens in a new tab)`}
      >
        {text}
      </a>
    );
  }
  return (
    <span className={`tag tag--${status}`} title={title} aria-label={s.long}>
      {text}
    </span>
  );
}

/** Model output (computed live by our simulation from specs + estimates). */
export function SimTag() {
  return (
    <span
      className="tag tag--sim"
      title="Simulated: computed live by our model from the specs and estimates"
    >
      sim
    </span>
  );
}

export function SpecValue({
  id,
  digits,
  label = false,
  className,
}: {
  id: SpecId;
  digits?: number;
  /** Prefix with the spec's label. */
  label?: boolean;
  className?: string;
}) {
  const spec = SPECS[id] as Spec;
  return (
    <span className={`spec ${className ?? ''}`}>
      {label && <span className="spec__label">{spec.label}: </span>}
      <span className={typeof spec.value === 'string' ? 'spec__text' : 'spec__value'}>
        {formatSpec(spec, digits)}
      </span>{' '}
      <StatusTag status={spec.status} source={spec.source} />
    </span>
  );
}
