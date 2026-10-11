import { showRhs } from './grammar';
import { BOTTOM, EPS, type Grammar, type PDA, type Transition } from './types';

/**
 * CFG → PDA construction (three-state form, as in Sipser §2.2 / Hopcroft–Motwani–Ullman §6.3).
 *
 *   q0 ──ε, Z₀ / S Z₀──▶ q1 ──ε, Z₀ / ε──▶ (q2)
 *                        ⟲ ε, A / β      for every production A → β   (expand)
 *                        ⟲ a, a / ε      for every terminal a          (match)
 *
 * Stack convention: strings are written top-first. "Replace A with β" means pop A,
 * then push the symbols of β in reverse order, so the leftmost symbol of β ends
 * on top. This makes the stack mirror the unmatched part of a leftmost
 * sentential form.
 *
 * Acceptance: the PDA accepts when it is in the final state q2 and the whole
 * input has been read. The move into q2 also pops Z₀, so at that moment the stack
 * is empty as well. Final-state and empty-stack acceptance therefore coincide,
 * and L(P) = N(P) = L(G).
 */
export function buildPDA(g: Grammar): PDA {
  const transitions: Transition[] = [];
  const add = (t: Omit<Transition, 'id'>) => transitions.push({ ...t, id: transitions.length });

  add({ kind: 'start', from: 'q0', to: 'q1', input: null, pop: BOTTOM, push: [g.start, BOTTOM] });
  for (const p of g.productions) {
    add({ kind: 'expand', from: 'q1', to: 'q1', input: null, pop: p.lhs, push: [...p.rhs], productionId: p.id });
  }
  for (const a of g.terminals) {
    add({ kind: 'match', from: 'q1', to: 'q1', input: a, pop: a, push: [] });
  }
  add({ kind: 'accept', from: 'q1', to: 'q2', input: null, pop: BOTTOM, push: [] });

  return {
    states: ['q0', 'q1', 'q2'],
    inputAlphabet: [...g.terminals],
    stackAlphabet: [...g.variables, ...g.terminals, BOTTOM],
    transitions,
    startState: 'q0',
    startStack: BOTTOM,
    finalStates: ['q2'],
  };
}

/* ------------------------------------------------------------ notation */

export const showPush = (push: string[]): string => (push.length ? push.join('') : EPS);

/** δ(q1, ε, S) ∋ (q1, aSb) */
export function formatTransition(t: Transition): string {
  const rel = t.kind === 'expand' ? '∋' : '=';
  const rhs = t.kind === 'expand' ? `(${t.to}, ${showPush(t.push)})` : `{(${t.to}, ${showPush(t.push)})}`;
  return `δ(${t.from}, ${t.input ?? EPS}, ${t.pop}) ${rel} ${rhs}`;
}

/** Edge label used in the state diagram: "ε, S / aSb" */
export const edgeLabel = (t: Transition): string => `${t.input ?? EPS}, ${t.pop} / ${showPush(t.push)}`;

export function transitionSource(t: Transition, g: Grammar): string {
  switch (t.kind) {
    case 'start': return `start symbol ${g.start}`;
    case 'expand': {
      const p = g.productions[t.productionId!];
      return `production ${p.lhs} → ${showRhs(p.rhs)}`;
    }
    case 'match': return `terminal ${t.input}`;
    case 'accept': return 'acceptance';
  }
}

export function formatTuple(pda: PDA): string {
  return `P = ({${pda.states.join(', ')}}, {${pda.inputAlphabet.join(', ')}}, {${pda.stackAlphabet.join(', ')}}, δ, ${pda.startState}, ${pda.startStack}, {${pda.finalStates.join(', ')}})`;
}
