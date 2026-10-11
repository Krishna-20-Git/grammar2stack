import { useMemo, useState, type ReactNode } from 'react';
import { GrammarEditor } from '../components/GrammarEditor';
import { Panel } from '../components/Panel';
import { Inspector } from '../components/Inspector';
import { KIND_COLOR, StateDiagram, type Selection } from '../components/StateDiagram';
import { TransitionTable } from '../components/Tables';
import { BOTTOM, formatTransition, formatTuple, sampleStrings, showRhs } from '../core';
import { useLab } from '../hooks/useLab';

function Section({ n, title, open: initial = false, children }: { n: string; title: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="panel flex flex-col">
      <button className="flex items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><span className="label mr-2">{n}</span><span className="font-display text-base font-semibold text-ink">{title}</span></span>
        <span className="text-slate" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-edge p-4">{children}</div>}
    </section>
  );
}

/** Reference material: edit the grammar, see how it converts, read the formal PDA. Collapsed sections, grammar open first. */
export function TheoryTab() {
  const { g, pda, preset, snapshot, index, last } = useLab();
  const [sel, setSel] = useState<Selection>(null);
  const samples = useMemo(() => sampleStrings(g, 6, 10), [g]);
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
    <div className="mx-auto flex max-w-[980px] flex-col gap-3">
      <Section n="A" title="Your grammar: view and edit" open>
        <GrammarEditor />
        <div className="rounded border border-edge bg-void/60 px-3 py-2">
          <div className="label">Current productions</div>
          <ul className="math mt-1 flex flex-col gap-0.5 text-[15px]">
            {g.productions.map((p) => <li key={p.id}><span className="text-slate-deep">p{p.id + 1}</span>  {p.lhs} → {showRhs(p.rhs)}</li>)}
          </ul>
          <div className="mt-2 text-sm text-slate">{preset ? <><span className="math text-ink">{preset.language}</span>. {preset.description}</> : 'Custom grammar.'}</div>
          <div className="math mt-1 text-xs text-slate">Shortest strings: {samples.map((s) => s || 'ε').join(', ') || 'none'}</div>
        </div>
      </Section>

      <Section n="B" title="How rules become stack operations">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-magenta/40 bg-magenta/[0.06] p-3">
            <div className="font-display font-semibold text-magenta">Rule 1 · Expand</div>
            <div className="math mt-1 text-sm">A → β  ⟹  δ(q1, ε, A) ∋ (q1, β)</div>
            <p className="mt-1 text-sm text-slate">If variable A is on top of the stack, replace it with β without reading input.</p>
          </div>
          <div className="rounded border border-cyan/40 bg-cyan/[0.05] p-3">
            <div className="font-display font-semibold text-cyan">Rule 2 · Match</div>
            <div className="math mt-1 text-sm">a ∈ Σ  ⟹  δ(q1, a, a) = {'{'}(q1, ε){'}'}</div>
            <p className="mt-1 text-sm text-slate">If terminal a is on top and is the next input symbol, read it and pop it.</p>
          </div>
          <div className="rounded border border-lime/40 bg-lime/[0.05] p-3">
            <div className="font-display font-semibold text-lime">Rule 3 · Start and accept</div>
            <div className="math mt-1 text-sm">δ(q0, ε, {BOTTOM}) = {'{'}(q1, S{BOTTOM}){'}'}; δ(q1, ε, {BOTTOM}) = {'{'}(q2, ε){'}'}</div>
            <p className="mt-1 text-sm text-slate">Push the start symbol first; accept when only {BOTTOM} remains.</p>
          </div>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr className="border-b border-edge"><th className="label py-2 pr-4">Grammar element</th><th className="label py-2">PDA transition</th></tr></thead>
            <tbody>
              {pda.transitions.map((t) => {
                const p = t.kind === 'expand' ? g.productions[t.productionId!] : null;
                const el = t.kind === 'start' ? `start symbol ${g.start}` : t.kind === 'accept' ? 'acceptance condition' : p ? `${p.lhs} → ${showRhs(p.rhs)}` : `terminal ${t.input}`;
                return (
                  <tr key={t.id} className="border-b border-edge/60">
                    <td className="math whitespace-nowrap py-1.5 pr-4" style={{ color: KIND_COLOR[t.kind] }}>{el}</td>
                    <td className="math whitespace-nowrap py-1.5">{formatTransition(t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n="C" title="The automaton: formal definition and diagram">
        <div className="math break-words text-[13px] text-cyan">{formatTuple(pda)}</div>
        <dl className="grid grid-cols-[44px_1fr] gap-x-3 gap-y-1.5 text-sm">
          {parts.map(([k, v, d]) => (
            <div key={k} className="contents">
              <dt className="math font-bold text-magenta">{k}</dt>
              <dd><span className="math text-ink">{v}</span> <span className="text-slate">· {d}</span></dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-slate">Acceptance: final state q2 with the whole input read. Entering q2 also empties the stack, so final-state and empty-stack acceptance coincide.</p>
        <Panel eyebrow="State diagram" title={`Highlighting move ${index} of ${last}`}>
          <StateDiagram pda={pda} currentState={snapshot.config.state} active={snapshot.transition} stepKey={snapshot.index} selection={sel} onSelect={setSel} />
          {sel && <div className="rounded border border-violet/40 bg-void/60 p-3"><Inspector selection={sel} pda={pda} g={g} onClear={() => setSel(null)} /></div>}
        </Panel>
        <TransitionTable onSelect={(id) => setSel({ type: 'transition', id })} selectedId={sel?.type === 'transition' ? sel.id : null} />
      </Section>
    </div>
  );
}
