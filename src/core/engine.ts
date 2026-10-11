import type { Configuration, PDA, Sym, Transition } from './types';

/**
 * PDA transition engine: which transitions apply to a configuration, and the
 * configuration that results from firing one. Pure functions, no search logic.
 */

export const initialConfiguration = (pda: PDA): Configuration => ({
  state: pda.startState,
  pos: 0,
  stack: [pda.startStack],
});

/** Transitions enabled in configuration c on input w (in the PDA's listed order). */
export function applicable(pda: PDA, c: Configuration, w: Sym[]): Transition[] {
  const top = c.stack[0];
  if (top === undefined) return [];
  const next = c.pos < w.length ? w[c.pos] : null;
  return pda.transitions.filter(
    (t) => t.from === c.state && t.pop === top && (t.input === null || t.input === next),
  );
}

/**
 * Fire transition t from configuration c. Pops the top symbol, then pushes
 * t.push so that t.push[0] becomes the new top. Advances the input pointer
 * only when the transition reads a symbol (t.input !== null).
 */
export function fire(c: Configuration, t: Transition): Configuration {
  if (c.stack[0] !== t.pop) throw new Error(`Transition ${t.id} expects ${t.pop} on top, found ${c.stack[0] ?? 'empty stack'}`);
  if (c.state !== t.from) throw new Error(`Transition ${t.id} starts in ${t.from}, not ${c.state}`);
  return {
    state: t.to,
    pos: t.input === null ? c.pos : c.pos + 1,
    stack: [...t.push, ...c.stack.slice(1)],
  };
}

/** Accepting configuration: final state and the whole input read. */
export const isAccepting = (pda: PDA, c: Configuration, w: Sym[]): boolean =>
  pda.finalStates.includes(c.state) && c.pos === w.length;

export const configKey = (c: Configuration): string => `${c.state}|${c.pos}|${c.stack.join('\u0001')}`;

/** (q1, abb, aSbbZ₀) — unread input and stack written top-first */
export function formatConfiguration(c: Configuration, w: Sym[]): string {
  const rest = w.slice(c.pos).join('') || 'ε';
  const stack = c.stack.join('') || 'ε';
  return `(${c.state}, ${rest}, ${stack})`;
}
