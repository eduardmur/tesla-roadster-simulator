/** "What's confirmed vs estimated": every number in the product, with status and sources. */
import { useMemo, useState } from 'react';
import {
  SPEC_GROUP_LABELS,
  SPEC_LIST,
  STATUS_LABELS,
  type SpecGroup,
  type SpecStatus,
} from '../../data/specs';
import { useApp } from '../../state/store';
import { StatusTag } from '../SpecValue';
import { formatSpec } from '../formatSpec';

const GROUP_ORDER: SpecGroup[] = [
  'event',
  'trims',
  'demo',
  'suction',
  'air',
  'thrusters',
  'model',
  'constants',
];

export function SpecsTable({ filter }: { filter: SpecStatus | 'all' }) {
  const groups = useMemo(
    () =>
      GROUP_ORDER.map((g) => ({
        g,
        specs: SPEC_LIST.filter((s) => s.group === g && (filter === 'all' || s.status === filter)),
      })).filter((x) => x.specs.length > 0),
    [filter],
  );
  return (
    <table className="spec-table">
      <thead>
        <tr>
          <th scope="col">What</th>
          <th scope="col">Value</th>
          <th scope="col">Status &amp; source</th>
        </tr>
      </thead>
      {groups.map(({ g, specs }) => (
        <tbody key={g}>
          <tr>
            <th colSpan={3} scope="colgroup" className="eyebrow" style={{ paddingTop: 16 }}>
              {SPEC_GROUP_LABELS[g]}
            </th>
          </tr>
          {specs.map((s) => (
            <tr key={s.id}>
              <td>
                {s.label}
                {s.note && <div className="note">{s.note}</div>}
              </td>
              <td className="value">{formatSpec(s)}</td>
              <td>
                <StatusTag status={s.status} source={s.source} />{' '}
                {s.source ? (
                  <a
                    href={s.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8rem' }}
                  >
                    {s.source.title.split(' — ')[0]}
                  </a>
                ) : (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    our estimate
                  </span>
                )}
                {s.alsoSources?.map((a) => (
                  <span key={a.url}>
                    {' · '}
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem' }}
                    >
                      {a.title.split(' — ')[0]}
                    </a>
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

export default function SpecsModal() {
  const set = useApp((s) => s.set);
  const [filter, setFilter] = useState<SpecStatus | 'all'>('all');
  const close = () => set({ specsOpen: false });
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: SPEC_LIST.length };
    for (const s of SPEC_LIST) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, []);
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="specs-h"
      onClick={close}
    >
      <div className="panel modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <div className="eyebrow">Every number in this project</div>
            <h2 id="specs-h">What’s confirmed vs estimated</h2>
          </div>
          <button type="button" className="btn btn--small btn--ghost" onClick={close} autoFocus>
            Close
          </button>
        </header>
        <p className="muted" style={{ marginTop: 0 }}>
          Facts are as of 16 Oct 2026, the day after the reveal. <strong>rep.</strong> ={' '}
          {STATUS_LABELS.reported.long.toLowerCase()}; <strong>est.</strong> ={' '}
          {STATUS_LABELS.estimate.long.toLowerCase()}; <strong>const.</strong> ={' '}
          {STATUS_LABELS.confirmed.long.toLowerCase()}. Live readouts in the HUD are model output,
          tagged <strong>sim</strong>.
        </p>
        <div className="spec-filter" role="group" aria-label="Filter by status">
          {(['all', 'reported', 'estimate', 'confirmed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className="btn btn--small"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : STATUS_LABELS[f].short} ({counts[f] ?? 0})
            </button>
          ))}
        </div>
        <SpecsTable filter={filter} />
      </div>
    </div>
  );
}
