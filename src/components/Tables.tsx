import { formatConfiguration, formatTransition, transitionSource } from '../core';
import { useLab } from '../hooks/useLab';
import { KIND_COLOR } from './StateDiagram';

/** Formal transition table δ; the row used by the current step is highlighted. */
export function TransitionTable({ onSelect, selectedId }: { onSelect?: (id: number) => void; selectedId?: number | null }) {
  const { pda, g, snapshot } = useLab();
  const activeId = snapshot.transition?.id ?? -1;
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-edge">
            <th className="label py-2 pr-3">#</th>
            <th className="label py-2 pr-3">Transition</th>
            <th className="label py-2 pr-3">Derived from</th>
            <th className="label py-2">Kind</th>
          </tr>
        </thead>
        <tbody>
          {pda.transitions.map((t) => {
            const on = t.id === activeId;
            const sel = selectedId === t.id;
            return (
              <tr key={t.id} onClick={() => onSelect?.(t.id)} aria-current={on ? 'true' : undefined}
                className={`border-b border-edge/60 ${onSelect ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
                style={on ? { background: KIND_COLOR[t.kind] + '1c', boxShadow: `inset 3px 0 0 ${KIND_COLOR[t.kind]}` } : sel ? { boxShadow: 'inset 3px 0 0 #8B5CFF' } : undefined}>
                <td className="math py-1.5 pr-3 text-slate">{t.id + 1}</td>
                <td className="math whitespace-nowrap py-1.5 pr-3" style={{ color: on ? KIND_COLOR[t.kind] : undefined, fontWeight: on ? 700 : 400 }}>{formatTransition(t)}</td>
                <td className="math whitespace-nowrap py-1.5 pr-3 text-slate">{transitionSource(t, g)}</td>
                <td className="py-1.5"><span className="chip" style={{ background: KIND_COLOR[t.kind] + '1f', color: KIND_COLOR[t.kind] }}>{t.kind}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Computation history: the sequence of instantaneous descriptions linked by ⊢. */
export function HistoryTable({ full = false }: { full?: boolean }) {
  const { snapshots, index, setIndex, w } = useLab();
  const upto = full ? snapshots.length - 1 : index;
  return (
    <div className="scroll-thin max-h-[300px] overflow-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-panel">
          <tr className="border-b border-edge">
            <th className="label py-2 pr-3">Move</th>
            <th className="label py-2 pr-3">Configuration (state, unread, stack)</th>
            <th className="label py-2">Operation</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.slice(0, upto + 1).map((s) => (
            <tr key={s.index} onClick={() => setIndex(s.index)} className={`cursor-pointer border-b border-edge/60 hover:bg-white/[0.03] ${s.index === index ? 'bg-cyan/[0.07]' : ''}`}>
              <td className="math tabular py-1.5 pr-3 text-slate">{s.index}</td>
              <td className="math whitespace-nowrap py-1.5 pr-3">{s.index ? '⊢ ' : ''}{formatConfiguration(s.config, w)}</td>
              <td className="whitespace-nowrap py-1.5 text-slate">{s.explanation.operation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
