import { formatTransition, showRhs, transitionSource, type Grammar, type PDA, type StateId } from '../core';
import { KIND_COLOR, type Selection } from './StateDiagram';

const STATE_TEXT: Record<StateId, { title: string; text: string }> = {
  q0: { title: 'q0 · initial state', text: 'The computation starts here with only the bottom marker Z₀ on the stack. Its single ε-move pushes the start symbol and moves to q1.' },
  q1: { title: 'q1 · simulation state', text: 'All grammar work happens here. With a variable on top, an ε-move replaces it by one of its production bodies (expand). With a terminal on top, the PDA reads the same symbol from the input and pops it (match). When only Z₀ remains, it moves to q2.' },
  q2: { title: 'q2 · final state', text: 'Entering q2 pops Z₀, so the stack is empty. The configuration is accepting only if the entire input has been read. q2 has no outgoing transitions.' },
};

const KIND_TEXT = {
  start: 'Initialisation (ε-move). Places the start symbol on the stack so the PDA can begin simulating a derivation.',
  expand: 'Grammar expansion (ε-move). Fires whenever the variable is on top of the stack; it does not read input. If the variable has several productions, the PDA chooses nondeterministically.',
  match: 'Terminal matching. Fires only when this terminal is on top of the stack and is also the next input symbol. Reads one input symbol and pops it.',
  accept: 'Acceptance move (ε-move). Fires when only Z₀ remains: every grammar symbol has been matched. Leads to the final state.',
} as const;

export function Inspector({ selection, pda, g, onClear }: { selection: Selection; pda: PDA; g: Grammar; onClear: () => void }) {
  if (!selection) {
    return (
      <div className="text-sm text-slate">
        Select a state or a transition label in the diagram (or press Tab to move between them and Enter to select) to inspect it here.
      </div>
    );
  }
  if (selection.type === 'state') {
    const s = STATE_TEXT[selection.id];
    const out = pda.transitions.filter((t) => t.from === selection.id);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-ink">{s.title}</h3>
          <button className="text-xs text-slate hover:text-ink" onClick={onClear}>Clear</button>
        </div>
        <p className="text-sm text-slate">{s.text}</p>
        {out.length > 0 && (
          <ul className="math flex flex-col gap-1 text-[13px]">
            {out.map((t) => <li key={t.id} style={{ color: KIND_COLOR[t.kind] }}>{formatTransition(t)}</li>)}
          </ul>
        )}
      </div>
    );
  }
  const t = pda.transitions[selection.id];
  const p = t.kind === 'expand' ? g.productions[t.productionId!] : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="chip" style={{ background: KIND_COLOR[t.kind] + '22', color: KIND_COLOR[t.kind] }}>{t.kind}</span>
        <button className="text-xs text-slate hover:text-ink" onClick={onClear}>Clear</button>
      </div>
      <div className="math text-[15px] font-bold" style={{ color: KIND_COLOR[t.kind] }}>{formatTransition(t)}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate">From → to</dt><dd className="math">{t.from} → {t.to}</dd>
        <dt className="text-slate">Reads</dt><dd className="math">{t.input ?? 'ε (nothing)'}</dd>
        <dt className="text-slate">Pops</dt><dd className="math">{t.pop}</dd>
        <dt className="text-slate">Pushes</dt><dd className="math">{t.push.length ? `${t.push.join('')} (${t.push[0]} on top)` : 'nothing'}</dd>
        <dt className="text-slate">Comes from</dt><dd className="math">{transitionSource(t, g)}</dd>
      </dl>
      <p className="text-sm text-slate">{KIND_TEXT[t.kind]}</p>
      {p && <p className="text-sm text-slate">Grammar view: <span className="math text-ink">x{p.lhs}γ ⇒ x{showRhs(p.rhs)}γ</span> for the leftmost variable {p.lhs}.</p>}
    </div>
  );
}
