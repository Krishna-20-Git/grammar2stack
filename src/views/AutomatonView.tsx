import { useState } from 'react';
import { Inspector } from '../components/Inspector';
import { Panel } from '../components/Panel';
import { StateDiagram, type Selection } from '../components/StateDiagram';
import { TransitionTable } from '../components/Tables';
import { formatTuple } from '../core';
import { useLab } from '../hooks/useLab';

export function AutomatonView() {
  const { pda, g, snapshot, index, last, next, prev } = useLab();
  const [sel, setSel] = useState<Selection>(null);
  const parts = [
    ['Q', `{${pda.states.join(', ')}}`, 'states'],
    ['Σ', `{${pda.inputAlphabet.join(', ')}}`, 'input alphabet = terminals of G'],
    ['Γ', `{${pda.stackAlphabet.join(', ')}}`, 'stack alphabet = V ∪ Σ ∪ {Z₀}'],
    ['δ', `${pda.transitions.length} transitions`, 'transition function (table below)'],
    ['q0', pda.startState, 'initial state'],
    ['Z₀', pda.startStack, 'initial stack symbol (bottom marker)'],
    ['F', `{${pda.finalStates.join(', ')}}`, 'final states'],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel eyebrow="State-transition diagram" title={`PDA for ${g.productions.length <= 3 ? g.variables.map((v) => `${v} → ${g.productions.filter((p) => p.lhs === v).map((p) => p.rhs.join('') || 'ε').join(' | ')}`).join('; ') : 'the current grammar'}`}
          actions={
            <div className="flex items-center gap-1.5">
              <span className="math text-xs text-slate">move {index}/{last}</span>
              <button className="btn min-h-[32px] w-9 px-0" onClick={prev} disabled={index === 0} aria-label="Previous move">◀</button>
              <button className="btn min-h-[32px] w-9 px-0" onClick={next} disabled={index >= last} aria-label="Next move">▶</button>
            </div>
          }>
          <StateDiagram pda={pda} currentState={snapshot.config.state} active={snapshot.transition} stepKey={snapshot.index} selection={sel} onSelect={setSel} />
          <p className="text-sm text-slate">
            The highlighted state and edge show move {index} of the current simulation: <span className="text-ink">{snapshot.explanation.operation}</span> Select any state or transition label to inspect it.
          </p>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel eyebrow="Inspector" title="Selected element">
            <Inspector selection={sel} pda={pda} g={g} onClear={() => setSel(null)} />
          </Panel>
          <Panel eyebrow="Formal definition" title="Seven-tuple">
            <div className="math break-words text-[13px] text-cyan">{formatTuple(pda)}</div>
            <dl className="grid grid-cols-[44px_1fr] gap-x-3 gap-y-1.5 text-sm">
              {parts.map(([k, v, d]) => (
                <div key={k} className="contents">
                  <dt className="math font-bold text-magenta">{k}</dt>
                  <dd><span className="math text-ink">{v}</span> <span className="text-slate">· {d}</span></dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-slate">Acceptance: by final state q2 with the input fully read. Entering q2 also empties the stack, so this PDA accepts the same language by empty stack.</p>
          </Panel>
        </div>
      </div>
      <Panel eyebrow="Transition function δ" title="Formal transition table">
        <TransitionTable onSelect={(id) => setSel({ type: 'transition', id })} selectedId={sel?.type === 'transition' ? sel.id : null} />
      </Panel>
    </div>
  );
}
