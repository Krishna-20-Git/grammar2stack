import { describe, expect, it } from 'vitest';
import {
  BOTTOM,
  applicable,
  buildParseTree,
  buildPDA,
  buildSimulation,
  derivationForms,
  fire,
  initialConfiguration,
  isAccepting,
  parseGrammar,
  PRESETS,
  CHALLENGES,
  presetById,
  runAll,
  sampleStrings,
  search,
  treeYield,
  type Grammar,
} from '../src/core';

const grammar = (text: string): Grammar => {
  const r = parseGrammar(text);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('\n'));
  return r.grammar;
};
const accepts = (text: string, w: string) => {
  const r = runAll(text, w);
  if (!r.ok) throw new Error('bad grammar');
  return r.result.verdict.kind;
};

/* ------------------------------------------------------------ parsing */
describe('grammar parsing', () => {
  it('parses S → aSb | ε', () => {
    const g = grammar('S → aSb | ε');
    expect(g.start).toBe('S');
    expect(g.variables).toEqual(['S']);
    expect(g.terminals).toEqual(['a', 'b']);
    expect(g.productions.map((p) => p.rhs.join(''))).toEqual(['aSb', '']);
  });

  it('accepts ->, λ, eps and empty alternatives as ε', () => {
    for (const t of ['S -> aSb | λ', 'S -> aSb | eps', 'S -> aSb |']) {
      expect(grammar(t).productions[1].rhs).toEqual([]);
    }
  });

  it('handles several variables and takes the first left side as start symbol', () => {
    const g = grammar('S → aAb\nA → aAb | c');
    expect(g.start).toBe('S');
    expect(g.variables).toEqual(['S', 'A']);
    expect(g.terminals).toEqual(['a', 'b', 'c']);
  });

  it('removes duplicate productions', () => {
    expect(grammar('S → ab | ab').productions).toHaveLength(1);
  });

  it('reports a missing arrow', () => {
    const r = parseGrammar('S aSb');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/arrow/);
  });

  it('reports a non-variable left-hand side', () => {
    const r = parseGrammar('ab → b');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/not context-free/);
    const r2 = parseGrammar('s → b');
    if (!r2.ok) expect(r2.errors[0].message).toMatch(/capital letter/);
  });

  it('reports a variable with no productions', () => {
    const r = parseGrammar('S → aB');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/B .*no productions/);
  });

  it('reports ε written inside another alternative and an empty grammar', () => {
    expect(parseGrammar('S → aεb').ok).toBe(false);
    expect(parseGrammar('  \n ').ok).toBe(false);
  });

  it('generates the shortest strings of the language', () => {
    expect(sampleStrings(grammar('S → aSb | ε'), 4)).toEqual(['', 'ab', 'aabb', 'aaabbb']);
  });
});

/* -------------------------------------------------------- construction */
describe('PDA construction', () => {
  const g = grammar('S → aSb | ε');
  const pda = buildPDA(g);

  it('has one transition per production, one per terminal, plus start and accept', () => {
    expect(pda.transitions).toHaveLength(2 + 2 + 2);
    expect(pda.transitions.filter((t) => t.kind === 'expand')).toHaveLength(2);
    expect(pda.transitions.filter((t) => t.kind === 'match').map((t) => t.input)).toEqual(['a', 'b']);
  });

  it('uses the documented stack alphabet and final state', () => {
    expect(pda.stackAlphabet).toEqual(['S', 'a', 'b', BOTTOM]);
    expect(pda.finalStates).toEqual(['q2']);
  });
});

/* ------------------------------------------------------------- engine */
describe('transition engine', () => {
  const g = grammar('S → aSb | ε');
  const pda = buildPDA(g);
  const w = Array.from('ab');
  const start = fire(initialConfiguration(pda), pda.transitions[0]);

  it('start move pushes S above Z₀ without reading input', () => {
    expect(start).toEqual({ state: 'q1', pos: 0, stack: ['S', BOTTOM] });
  });

  it('production expansion replaces the variable with the body, leftmost symbol on top', () => {
    const t = applicable(pda, start, w).find((x) => x.kind === 'expand' && x.push.length)!;
    const c = fire(start, t);
    expect(c.stack).toEqual(['a', 'S', 'b', BOTTOM]);
    expect(c.stack[0]).toBe('a');
  });

  it('epsilon transitions never advance the input pointer', () => {
    for (const t of applicable(pda, start, w)) expect(fire(start, t).pos).toBe(0);
  });

  it('S → ε pops the variable and pushes nothing', () => {
    const t = applicable(pda, start, w).find((x) => x.kind === 'expand' && !x.push.length)!;
    expect(fire(start, t).stack).toEqual([BOTTOM]);
  });

  it('terminal matching pops the terminal and advances the pointer by one', () => {
    const expanded = fire(start, pda.transitions[1]);
    const m = applicable(pda, expanded, w);
    expect(m).toHaveLength(1);
    expect(m[0].kind).toBe('match');
    const c = fire(expanded, m[0]);
    expect(c).toEqual({ state: 'q1', pos: 1, stack: ['S', 'b', BOTTOM] });
  });

  it('a terminal on top that differs from the next input symbol enables no move', () => {
    const expanded = fire(start, pda.transitions[1]); // a S b Z₀
    expect(applicable(pda, expanded, Array.from('ba'))).toHaveLength(0);
  });

  it('refuses to fire a transition whose pop symbol is not on top', () => {
    expect(() => fire(start, pda.transitions[3])).toThrow();
  });

  it('accepts only in q2 with the whole input read', () => {
    expect(isAccepting(pda, { state: 'q2', pos: 2, stack: [] }, w)).toBe(true);
    expect(isAccepting(pda, { state: 'q2', pos: 1, stack: [] }, w)).toBe(false);
    expect(isAccepting(pda, { state: 'q1', pos: 2, stack: [] }, w)).toBe(false);
  });
});

/* ---------------------------------------------------------- verdicts */
describe('acceptance and rejection', () => {
  it.each(['', 'ab', 'aabb', 'aaabbb'])('S → aSb | ε accepts "%s"', (w) => {
    expect(accepts('S → aSb | ε', w)).toBe('accepted');
  });
  it.each(['aabbb', 'abb', 'ba', 'aaabb'])('S → aSb | ε rejects "%s"', (w) => {
    expect(accepts('S → aSb | ε', w)).toBe('rejected');
  });

  it('Team 6: S → aSbb | ε accepts aabbbb in 1 + 3 + 6 + 1 moves', () => {
    const r = runAll('S → aSbb | ε', 'aabbbb');
    if (!r.ok) throw new Error();
    expect(r.result.verdict.kind).toBe('accepted');
    const ops = r.sim.snapshots.map((s) => s.op);
    expect(ops.filter((o) => o === 'expand')).toHaveLength(3);
    expect(ops.filter((o) => o === 'match')).toHaveLength(6);
    expect(ops[1]).toBe('start');
    expect(ops[ops.length - 1]).toBe('accept');
    expect(r.sim.snapshots).toHaveLength(12);
  });

  it('Team 6: aabbb is rejected and the shown branch ends with b left on the stack', () => {
    const r = runAll('S → aSbb | ε', 'aabbb');
    if (!r.ok) throw new Error();
    expect(r.result.verdict.kind).toBe('rejected');
    const last = r.sim.snapshots[r.sim.snapshots.length - 1];
    expect(last.config.pos).toBe(5);
    expect(last.config.stack).toEqual(['b', BOTTOM]);
    expect(r.sim.stuck?.status).toBe('dead-end');
    expect(r.sim.stuck?.message).toMatch(/input is exhausted/);
  });

  it('every preset example string gets the documented verdict', () => {
    for (const p of PRESETS) {
      for (const w of p.valid) expect([p.id, w, accepts(p.grammar, w)]).toEqual([p.id, w, 'accepted']);
      for (const w of p.invalid) expect([p.id, w, accepts(p.grammar, w)]).toEqual([p.id, w, 'rejected']);
    }
  });

  it('challenge answers are computed and always conclusive', () => {
    for (const c of CHALLENGES) {
      expect(['accepted', 'rejected']).toContain(accepts(presetById(c.presetId)!.grammar, c.input));
    }
  });

  it('reaching q2 with unread input is not acceptance', () => {
    const r = runAll('S → aSb | ε', 'ba');
    if (!r.ok) throw new Error();
    expect(r.result.nodes.some((n) => n.status === 'final-with-input')).toBe(true);
    expect(r.result.verdict.kind).toBe('rejected');
  });

  it('symbols outside Σ are rejected', () => {
    expect(accepts('S → aSb | ε', 'acb')).toBe('rejected');
  });
});

/* ------------------------------------------------------ nondeterminism */
describe('nondeterministic branching', () => {
  it('accepts even though the first branches tried fail (palindromes)', () => {
    const r = runAll('S → aSa | bSb | a | b | ε', 'abba');
    if (!r.ok) throw new Error();
    expect(r.result.verdict.kind).toBe('accepted');
    const failed = r.result.nodes.filter((n) => n.status === 'dead-end' || n.status === 'pruned' || n.status === 'final-with-input');
    expect(failed.length).toBeGreaterThan(0);
    expect(r.result.nodes.some((n) => n.children.length > 1)).toBe(true);
  });

  it('accepts strings of the highly ambiguous grammar S → aSbS | bSaS | ε', () => {
    expect(accepts('S → aSbS | bSaS | ε', 'abbaab')).toBe('accepted');
    expect(accepts('S → aSbS | bSaS | ε', 'abbab')).toBe('rejected');
  });

  it('terminates on left-recursive grammars', () => {
    const g = 'E → E+T | T\nT → T*F | F\nF → (E) | x';
    expect(accepts(g, 'x+x*x')).toBe('accepted');
    expect(accepts(g, 'x+')).toBe('rejected');
  });

  it('terminates on grammars with nullable cycles and reports bounds honestly', () => {
    const r = runAll('S → SS | a | ε', 'b');
    if (!r.ok) throw new Error();
    expect(['rejected', 'inconclusive']).toContain(r.result.verdict.kind);
    expect(accepts('S → SS | a | ε', 'aaa')).toBe('accepted');
  });

  it('explored configurations are never duplicated', () => {
    const r = runAll('S → aSbS | bSaS | ε', 'abab');
    if (!r.ok) throw new Error();
    const keys = r.result.nodes.filter((n) => n.status !== 'pruned' || n.pruneReason !== 'duplicate').map((n) => JSON.stringify(n.config));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('any leaf of the computation tree can be replayed as a branch', () => {
    const g = grammar('S → aSa | bSb | a | b | ε');
    const pda = buildPDA(g);
    const res = search(g, pda, Array.from('ab'));
    const leaf = res.nodes.find((n) => n.status === 'dead-end')!;
    const sim = buildSimulation(g, pda, res, leaf.id);
    expect(sim.snapshots[sim.snapshots.length - 1].config).toEqual(leaf.config);
    expect(sim.accepted).toBe(false);
  });
});

/* ---------------------------------------------------- history / replay */
describe('simulation history (rewind and replay)', () => {
  const r = runAll('S → aSbb | ε', 'aabbbb');
  if (!r.ok) throw new Error();
  const snaps = r.sim.snapshots;

  it('each snapshot is consistent with replaying the engine from the start', () => {
    let c = initialConfiguration(r.pda);
    expect(snaps[0].config).toEqual(c);
    for (let i = 1; i < snaps.length; i++) {
      c = fire(c, snaps[i].transition!);
      expect(snaps[i].config).toEqual(c);
      expect(snaps[i].stack.map((s) => s.sym)).toEqual(c.stack);
    }
  });

  it('rebuilding produces identical snapshots (deterministic)', () => {
    const again = runAll('S → aSbb | ε', 'aabbbb');
    if (!again.ok) throw new Error();
    expect(JSON.stringify(again.sim.snapshots)).toEqual(JSON.stringify(snaps));
  });

  it('jumping backward restores the earlier configuration exactly', () => {
    const at4 = JSON.stringify(snaps[4]);
    // "play" to the end then jump back: snapshots are immutable data
    void snaps[snaps.length - 1];
    expect(JSON.stringify(snaps[4])).toBe(at4);
    expect(snaps[4].config.pos).toBe(1);
  });

  it('the input pointer moves only on match moves', () => {
    for (let i = 1; i < snaps.length; i++) {
      const moved = snaps[i].config.pos - snaps[i - 1].config.pos;
      expect(moved).toBe(snaps[i].op === 'match' ? 1 : 0);
    }
  });

  it('pushes and pops are recorded with stable ids', () => {
    const exp = snaps.find((s) => s.op === 'expand' && s.pushed.length)!;
    expect(exp.stack.slice(0, exp.pushed.length).map((s) => s.uid)).toEqual(exp.pushed);
    const m = snaps.find((s) => s.op === 'match')!;
    expect(m.popped?.sym).toBe(m.consumed);
  });

  it('the sentential forms spell the leftmost derivation', () => {
    const forms = derivationForms(snaps, snaps.length - 1).map((f) => f.form.join('') || 'ε');
    expect(forms).toEqual(['S', 'aSbb', 'aaSbbbb', 'aabbbb']);
  });

  it('the derivation tree yields the input', () => {
    const tree = buildParseTree(r.g, snaps, snaps.length - 1);
    expect(treeYield(tree)).toBe('aabbbb');
    expect(Object.values(tree.nodes).filter((n) => n.status === 'matched')).toHaveLength(6);
  });
});

/* ---------------------------------------------------------- empty string */
describe('empty string edge cases', () => {
  it('ε is accepted when S is nullable', () => {
    const r = runAll('S → aSb | ε', '');
    if (!r.ok) throw new Error();
    expect(r.result.verdict.kind).toBe('accepted');
    expect(r.sim.snapshots.map((s) => s.op)).toEqual(['init', 'start', 'expand', 'accept']);
  });
  it('ε is rejected when S is not nullable', () => {
    expect(accepts('S → aSb | ab', '')).toBe('rejected');
  });
  it('the grammar S → ε accepts only ε', () => {
    expect(accepts('S → ε', '')).toBe('accepted');
    expect(accepts('S → ε', 'a')).toBe('rejected');
  });
});
