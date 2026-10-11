import { isVariable, showRhs } from './grammar';
import { formatTransition } from './pda';
import { BOTTOM, type Grammar, type OperationKind, type StepExplanation, type Sym, type Transition } from './types';

/**
 * Educational explanations for each computation step. Generated from the step's
 * transition and configuration, so they are always consistent with the engine.
 */

export interface ExplainContext {
  g: Grammar;
  op: OperationKind;
  t: Transition | null;
  input: Sym[];
  posBefore: number;
  stackAfter: Sym[];
  notes?: Record<string, string>;
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function describeRhs(rhs: Sym[], lhs: Sym): string {
  if (!rhs.length) return `The production erases ${lhs}: it derives the empty string.`;
  const parts = rhs.map((s, i) => {
    const where = i === 0 ? 'an initial' : i === rhs.length - 1 ? 'a final' : 'a';
    if (isVariable(s)) return `${where} ${s === lhs ? 'recursive ' : ''}nonterminal ${s}`;
    return `${where} terminal ${s}`;
  });
  return `The production introduces ${list(parts)}.`;
}

const pushOrder = (push: Sym[]) => [...push].reverse().join(', ');

export function explainStep(ctx: ExplainContext): StepExplanation {
  const { g, op, t, input, posBefore, notes } = ctx;
  switch (op) {
    case 'init':
      return {
        operation: 'Initial configuration.',
        production: null,
        inputConsumed: 'None.',
        stackOperation: `The stack contains only the bottom marker ${BOTTOM}.`,
        reason: `The PDA starts in state q0 with the input pointer on the first symbol${input.length ? '' : ' (the input is ε, so the pointer is already at the end)'}.`,
        significance: 'No derivation has begun yet. The first move will place the start symbol on the stack.',
        concept: { title: 'Instantaneous description', text: 'A configuration (q, w, γ) records the current state q, the unread input w and the stack contents γ written top-first. A computation is a sequence of configurations linked by ⊢.' },
      };
    case 'start':
      return {
        operation: `Push the start symbol ${g.start}.`,
        production: null,
        inputConsumed: 'None (ε-transition).',
        stackOperation: `Replace ${BOTTOM} with ${g.start}${BOTTOM}: ${g.start} is pushed above the bottom marker. ${formatTransition(t!)}.`,
        reason: `Every derivation in G begins with the start symbol ${g.start}, so the stack must begin with ${g.start}.`,
        significance: `The stack now holds the sentential form ${g.start}. The PDA moves to q1, where it will simulate a leftmost derivation.`,
        concept: { title: 'Bottom marker', text: `${BOTTOM} lets the PDA detect that every grammar symbol has been removed. It is only ever popped by the final move into q2.` },
      };
    case 'expand': {
      const p = g.productions[t!.productionId!];
      const key = `${p.lhs}→${p.rhs.join('')}`;
      const recursive = p.rhs.includes(p.lhs);
      const significance = notes?.[key]
        ?? (p.rhs.length === 0
          ? `${p.lhs} ⇒ ε removes the variable from the sentential form, ending this branch of the recursion.`
          : `This ε-move is exactly one step of a leftmost derivation: the leftmost variable ${p.lhs} is rewritten as ${showRhs(p.rhs)}.${recursive ? ` Because ${p.lhs} reappears on the right, the production can be applied again to build nested structure.` : ''}`);
      return {
        operation: `Expand nonterminal ${p.lhs}.`,
        production: `${p.lhs} → ${showRhs(p.rhs)}`,
        inputConsumed: 'None (ε-transition: the input pointer does not move).',
        stackOperation: p.rhs.length
          ? `Replace ${p.lhs} with ${showRhs(p.rhs)}: pop ${p.lhs}, then push ${pushOrder(p.rhs)} in that order, so ${p.rhs[0]} ends on top. ${formatTransition(t!)}.`
          : `Pop ${p.lhs} and push nothing. ${formatTransition(t!)}.`,
        reason: describeRhs(p.rhs, p.lhs),
        significance,
        concept: p.rhs.length
          ? { title: 'Nondeterministic choice', text: `With ${p.lhs} on top, the PDA may apply any production for ${p.lhs}. A string is accepted if at least one sequence of choices leads to acceptance; the search explores all of them.` }
          : { title: 'ε-transition', text: 'An ε-move changes the state or stack without reading input. Expansions are always ε-moves; only matching moves read input.' },
      };
    }
    case 'match': {
      const a = t!.input!;
      return {
        operation: `Match terminal ${a}.`,
        production: null,
        inputConsumed: `${a} (input position ${posBefore + 1} of ${input.length}).`,
        stackOperation: `Pop ${a}. ${formatTransition(t!)}.`,
        reason: `The terminal on top of the stack equals the next input symbol, so the symbol predicted by the derivation is confirmed by the input.`,
        significance: `The input read so far, ${input.slice(0, posBefore + 1).join('')}, agrees with the prefix of the sentential form. The input pointer advances by one.`,
        concept: { title: 'Matching', text: 'Terminals cannot be rewritten. A terminal on top of the stack can only be removed by reading the same symbol from the input.' },
      };
    }
    case 'accept':
      return {
        operation: 'Enter the final state q2.',
        production: null,
        inputConsumed: 'None (ε-transition).',
        stackOperation: `Pop ${BOTTOM}; the stack is now empty. ${formatTransition(t!)}.`,
        reason: `Only ${BOTTOM} remains, so every symbol of the derived string has been generated and matched.`,
        significance: posBefore === input.length
          ? 'The whole input has been read and the PDA is in a final state, so the configuration is accepting. The derivation from the start symbol produced exactly the input string.'
          : `The PDA is in the final state, but ${input.length - posBefore} input symbol(s) remain unread. Acceptance requires the entire input to be consumed, and q2 has no further moves.`,
        concept: { title: 'Acceptance', text: 'This PDA accepts by final state with the whole input read. The move into q2 also empties the stack, so acceptance by final state and by empty stack coincide here.' },
      };
  }
}
