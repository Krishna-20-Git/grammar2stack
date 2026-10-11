import { GrammarEditor } from '../components/GrammarEditor';
import { LanguageBuilder, VariableMeanings } from '../components/LanguageBuilder';
import { Panel } from '../components/Panel';
import { KIND_COLOR } from '../components/StateDiagram';
import { formatTransition, sampleStrings, showRhs, BOTTOM } from '../core';
import { useLab } from '../hooks/useLab';
import { useMemo } from 'react';

export function GrammarView() {
  const { g, pda, preset, customLang } = useLab();
  const samples = useMemo(() => sampleStrings(g, 6, 10), [g]);
  const roles = [
    { sym: 'V', name: 'Variables (nonterminals)', value: `{${g.variables.join(', ')}}`, text: 'Symbols that are rewritten by productions. They never appear in a finished string.' },
    { sym: 'Σ', name: 'Terminals', value: `{${g.terminals.join(', ')}}`, text: 'The alphabet of the language. Terminals are never rewritten.' },
    { sym: 'P', name: 'Productions', value: `${g.productions.length} rule${g.productions.length === 1 ? '' : 's'}`, text: 'Rules A → α with a single variable A on the left: the defining restriction of context-free grammars.' },
    { sym: 'S', name: 'Start symbol', value: g.start, text: 'Every derivation begins here. L(G) = { w ∈ Σ* | S ⇒* w }.' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Panel eyebrow="Language builder" title="Build a grammar from a description">
        <p className="max-w-[80ch] text-sm text-slate">
          Describe the strings you want, in words or as a list of conditions. Each condition is a property a finite memory can check, so the combination has a grammar of the form A → aB | ε (right-linear). Each variable stands for one thing the grammar must remember about the prefix generated so far. The grammar is minimised and converted to a PDA like any other grammar. Languages that need counting without bound, such as aⁿbⁿ or palindromes, use the context-free example grammars instead.
        </p>
        <LanguageBuilder />
        {customLang && (
          <div className="flex flex-col gap-2">
            <div className="label">Generated grammar and the meaning of each variable</div>
            <VariableMeanings />
          </div>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Theory" title="Formal definition of a context-free grammar">
          <div className="math text-2xl text-ink">G = (V, Σ, P, S)</div>
          <dl className="flex flex-col gap-2.5">
            {roles.map((r) => (
              <div key={r.sym} className="grid grid-cols-[32px_1fr] gap-3 border-t border-edge pt-2.5">
                <dt className="math text-xl font-bold text-magenta">{r.sym}</dt>
                <dd>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-ink">{r.name}</span>
                    <span className="math text-cyan">{r.value}</span>
                  </div>
                  <p className="text-sm text-slate">{r.text}</p>
                </dd>
              </div>
            ))}
          </dl>
          <div className="rounded border border-edge bg-void/60 px-3 py-2">
            <div className="label">Current productions</div>
            <ul className="math mt-1 flex flex-col gap-0.5 text-[15px]">
              {g.productions.map((p) => <li key={p.id}><span className="text-slate-deep">p{p.id + 1}</span>  {p.lhs} → {showRhs(p.rhs)}</li>)}
            </ul>
            <div className="mt-2 text-sm text-slate">
              {preset ? <><span className="math text-ink">{preset.language}</span>. {preset.description}</> : 'Custom grammar.'}
            </div>
            <div className="math mt-1 text-xs text-slate">Shortest strings: {samples.map((s) => s || 'ε').join(', ') || 'none (no terminal string is derivable)'}</div>
          </div>
        </Panel>

        <Panel eyebrow="Edit" title="Inspect and edit the grammar">
          <GrammarEditor />
        </Panel>
      </div>

      <Panel eyebrow="Conversion" title="How productions become stack operations">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-magenta/40 bg-magenta/[0.06] p-3">
            <div className="font-display font-semibold text-magenta">Rule 1 · Expand</div>
            <div className="math mt-1 text-sm">A → β  ⟹  δ(q1, ε, A) ∋ (q1, β)</div>
            <p className="mt-1 text-sm text-slate">If variable A is on top of the stack, replace it with β without reading input. β is pushed so that its leftmost symbol is on top.</p>
          </div>
          <div className="rounded border border-cyan/40 bg-cyan/[0.05] p-3">
            <div className="font-display font-semibold text-cyan">Rule 2 · Match</div>
            <div className="math mt-1 text-sm">a ∈ Σ  ⟹  δ(q1, a, a) = {'{'}(q1, ε){'}'}</div>
            <p className="mt-1 text-sm text-slate">If terminal a is on top and a is the next input symbol, read it and pop it.</p>
          </div>
          <div className="rounded border border-lime/40 bg-lime/[0.05] p-3">
            <div className="font-display font-semibold text-lime">Rule 3 · Start and accept</div>
            <div className="math mt-1 text-sm">δ(q0, ε, {BOTTOM}) = {'{'}(q1, S{BOTTOM}){'}'}; δ(q1, ε, {BOTTOM}) = {'{'}(q2, ε){'}'}</div>
            <p className="mt-1 text-sm text-slate">Push the start symbol at the beginning; move to the final state q2 when only {BOTTOM} remains.</p>
          </div>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr className="border-b border-edge"><th className="label py-2 pr-4">Grammar element</th><th className="label py-2 pr-4">PDA transition</th><th className="label py-2">Stack effect</th></tr></thead>
            <tbody>
              {pda.transitions.map((t) => {
                const p = t.kind === 'expand' ? g.productions[t.productionId!] : null;
                const el = t.kind === 'start' ? `start symbol ${g.start}` : t.kind === 'accept' ? 'acceptance condition' : p ? `${p.lhs} → ${showRhs(p.rhs)}` : `terminal ${t.input}`;
                const effect = t.kind === 'start' ? `push ${g.start} above ${BOTTOM}` : t.kind === 'accept' ? `pop ${BOTTOM}, enter q2` : p ? (p.rhs.length ? `pop ${p.lhs}; push ${[...p.rhs].reverse().join(', ')} (${p.rhs[0]} ends on top)` : `pop ${p.lhs}`) : `read ${t.input}; pop ${t.input}`;
                return (
                  <tr key={t.id} className="border-b border-edge/60">
                    <td className="math whitespace-nowrap py-1.5 pr-4" style={{ color: KIND_COLOR[t.kind] }}>{el}</td>
                    <td className="math whitespace-nowrap py-1.5 pr-4">{formatTransition(t)}</td>
                    <td className="whitespace-nowrap py-1.5 text-slate">{effect}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
