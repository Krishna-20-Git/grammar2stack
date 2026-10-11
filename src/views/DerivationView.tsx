import { useMemo } from 'react';
import { Controls } from '../components/Controls';
import { DerivationTree } from '../components/DerivationTree';
import { Panel } from '../components/Panel';
import { derivationForms, showRhs } from '../core';
import { useLab } from '../hooks/useLab';

export function DerivationView() {
  const { g, snapshots, index, setIndex, w, sim } = useLab();
  const forms = useMemo(() => derivationForms(snapshots, snapshots.length - 1), [snapshots]);
  const counts = {
    start: snapshots.filter((s) => s.op === 'start').length,
    expand: snapshots.filter((s) => s.op === 'expand').length,
    match: snapshots.filter((s) => s.op === 'match').length,
    accept: snapshots.filter((s) => s.op === 'accept').length,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-4"><Controls /></div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel eyebrow="Derivation tree" title={`Parse tree for ${w.join('') || 'ε'}`}>
          <DerivationTree />
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel eyebrow="Leftmost derivation" title="S ⇒* w">
            <ol className="flex flex-col gap-1">
              {forms.map((f, k) => {
                const s = snapshots[f.snapshot];
                const reached = f.snapshot <= index;
                const current = s.index === index || (k === forms.length - 1 ? index >= f.snapshot : index >= f.snapshot && index < forms[k + 1].snapshot);
                const prod = s.op === 'expand' ? g.productions[s.transition!.productionId!] : null;
                return (
                  <li key={k}>
                    <button onClick={() => setIndex(f.snapshot)}
                      className={`flex w-full flex-wrap items-baseline gap-x-3 rounded px-2 py-1 text-left ${current ? 'bg-magenta/10' : ''} ${reached ? '' : 'opacity-35'}`}>
                      <span className="math w-5 text-right text-slate-deep">{k === 0 ? '' : '⇒'}</span>
                      <span className="math text-lg text-ink">{f.form.join('') || 'ε'}</span>
                      <span className="math text-xs text-magenta/80">{prod ? `by ${prod.lhs} → ${showRhs(prod.rhs)}` : 'start symbol'}</span>
                      <span className="math ml-auto text-[11px] text-slate-deep">move {f.snapshot}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {!sim.accepted && <p className="text-xs text-slate">This branch does not complete a derivation of the input; the derivation stops where the branch halts.</p>}
          </Panel>
          <Panel eyebrow="Relationship" title="Derivation vs. PDA computation">
            <p className="text-sm text-ink/90">
              A <b>derivation</b> is a sequence of sentential forms produced by the grammar. A <b>PDA computation</b> is a sequence of configurations produced by the automaton. They are different objects, connected by an invariant:
            </p>
            <div className="math rounded border border-edge bg-void/60 px-3 py-2 text-sm">input read so far · stack contents (without Z₀) = current leftmost sentential form</div>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-slate">
              <li>Each <span className="text-magenta">expand</span> move corresponds to exactly one derivation step ({counts.expand} here).</li>
              <li><span className="text-cyan">Match</span> moves ({counts.match} here) have no counterpart in the derivation: they move a terminal from the stack to the “already read” part of the form.</li>
              <li>The start and accept moves ({counts.start + counts.accept}) only manage Z₀ and the states.</li>
              <li>So a computation has {counts.start} + {counts.expand} + {counts.match} + {counts.accept} = {snapshots.length - 1} moves for a derivation of {counts.expand} steps.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
