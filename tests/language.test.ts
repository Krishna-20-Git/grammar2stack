import { describe, expect, it } from 'vitest';
import { buildLanguage, dfaAccepts, parseAlphabet, parseDescription, runAll, type Condition } from '../src/core';

const AB = ['a', 'b'];

/** every string over sigma up to length n */
function allStrings(sigma: string[], n: number): string[] {
  const out = [''];
  let layer = [''];
  for (let k = 0; k < n; k++) {
    layer = layer.flatMap((s) => sigma.map((c) => s + c));
    out.push(...layer);
  }
  return out;
}

/** independent reference implementation of each condition */
function holds(c: Condition, w: string): boolean {
  const cnt = (s: string) => Array.from(w).filter((x) => x === s).length;
  const cmp = (v: number, op: string, n: number) => (op === 'exactly' ? v === n : op === 'atLeast' ? v >= n : v <= n);
  switch (c.kind) {
    case 'startsWith': return w.startsWith(c.w);
    case 'endsWith': return w.endsWith(c.w);
    case 'contains': return w.includes(c.w);
    case 'notContains': return !w.includes(c.w);
    case 'count': return cmp(cnt(c.sym), c.op, c.n);
    case 'countMod': return cnt(c.sym) % c.m === c.r;
    case 'length': return cmp(w.length, c.op, c.n);
    case 'lengthMod': return w.length % c.m === c.r;
    case 'sequence': return false;
  }
}

describe('parsing descriptions in words', () => {
  it('understands the teacher’s examples', () => {
    expect(parseDescription('ending with two a', AB).conditions).toEqual([{ kind: 'endsWith', w: 'aa' }]);
    expect(parseDescription('containing 3b', AB).conditions).toEqual([{ kind: 'count', sym: 'b', op: 'exactly', n: 3 }]);
    expect(parseDescription('strings ending with two a and containing 3 b', AB).conditions).toEqual([
      { kind: 'endsWith', w: 'aa' }, { kind: 'count', sym: 'b', op: 'exactly', n: 3 },
    ]);
  });

  it('understands many other phrasings', () => {
    const one = (t: string) => parseDescription(t, AB).conditions[0];
    expect(one('starts with ab')).toEqual({ kind: 'startsWith', w: 'ab' });
    expect(one('begin with b')).toEqual({ kind: 'startsWith', w: 'b' });
    expect(one('ends in "bab"')).toEqual({ kind: 'endsWith', w: 'bab' });
    expect(one('contains aba')).toEqual({ kind: 'contains', w: 'aba' });
    expect(one('containing the substring bb')).toEqual({ kind: 'contains', w: 'bb' });
    expect(one('not containing bb')).toEqual({ kind: 'notContains', w: 'bb' });
    expect(one('does not contain aa')).toEqual({ kind: 'notContains', w: 'aa' });
    expect(one('at least 2 a')).toEqual({ kind: 'count', sym: 'a', op: 'atLeast', n: 2 });
    expect(one("at most one b")).toEqual({ kind: 'count', sym: 'b', op: 'atMost', n: 1 });
    expect(one("exactly two a's")).toEqual({ kind: 'count', sym: 'a', op: 'exactly', n: 2 });
    expect(one('more than 2 b')).toEqual({ kind: 'count', sym: 'b', op: 'atLeast', n: 3 });
    expect(one('number of a is 2')).toEqual({ kind: 'count', sym: 'a', op: 'exactly', n: 2 });
    expect(one('even number of a')).toEqual({ kind: 'countMod', sym: 'a', m: 2, r: 0 });
    expect(one("odd number of b's")).toEqual({ kind: 'countMod', sym: 'b', m: 2, r: 1 });
    expect(one('number of a divisible by 3')).toEqual({ kind: 'countMod', sym: 'a', m: 3, r: 0 });
    expect(one('even length')).toEqual({ kind: 'lengthMod', m: 2, r: 0 });
    expect(one('length at least 3')).toEqual({ kind: 'length', op: 'atLeast', n: 3 });
    expect(one('of length 4')).toEqual({ kind: 'length', op: 'exactly', n: 4 });
    expect(one('no a')).toEqual({ kind: 'count', sym: 'a', op: 'exactly', n: 0 });
    expect(one('set of all strings over {a, b} that start with a')).toEqual({ kind: 'startsWith', w: 'a' });
  });

  it('works with other alphabets', () => {
    const s = parseAlphabet('0, 1');
    expect(s).toEqual(['0', '1']);
    expect(parseDescription('ending with 00 and containing two 1', s).conditions).toEqual([
      { kind: 'endsWith', w: '00' }, { kind: 'count', sym: '1', op: 'exactly', n: 2 },
    ]);
    expect(parseAlphabet('{a,b,c}')).toEqual(['a', 'b', 'c']);
    expect(parseAlphabet('abc')).toEqual(['a', 'b', 'c']);
  });

  it('recognises non-regular patterns and reports unknown phrases', () => {
    expect(parseDescription('a^n b^n', AB).built?.kind).toBe('context-free');
    expect(parseDescription('anbn', AB).pattern).toBe('anbn');
    expect(parseDescription('palindromes', AB).pattern).toBe('pal');
    expect(parseDescription('equal number of a and b', AB).pattern).toBe('equal');
    expect(parseDescription('ending with xyz', AB).errors.length).toBe(1);
    expect(parseDescription('lovely strings', AB).errors.length).toBe(1);
  });
});

describe('language → grammar → PDA agrees with the description', () => {
  const cases: Condition[][] = [
    [{ kind: 'endsWith', w: 'aa' }],
    [{ kind: 'count', sym: 'b', op: 'exactly', n: 3 }],
    [{ kind: 'endsWith', w: 'aa' }, { kind: 'count', sym: 'b', op: 'exactly', n: 3 }],
    [{ kind: 'startsWith', w: 'ab' }, { kind: 'notContains', w: 'bb' }],
    [{ kind: 'contains', w: 'aba' }],
    [{ kind: 'countMod', sym: 'a', m: 2, r: 0 }, { kind: 'lengthMod', m: 3, r: 1 }],
    [{ kind: 'count', sym: 'a', op: 'atLeast', n: 2 }, { kind: 'count', sym: 'b', op: 'atMost', n: 1 }],
    [{ kind: 'length', op: 'exactly', n: 3 }],
  ];
  it.each(cases.map((c) => [c.map((x) => x.kind).join('+'), c] as const))('%s', (_n, conds) => {
    const built = buildLanguage(conds, AB);
    if (!built.ok) throw new Error(built.error);
    const { lang } = built;
    for (const w of allStrings(AB, 7)) {
      const expected = conds.every((c) => holds(c, w));
      expect([w, dfaAccepts(lang.dfa!, AB, w)]).toEqual([w, expected]);
    }
    // the PDA built from the generated grammar decides the same language
    for (const w of allStrings(AB, 6)) {
      const r = runAll(lang.grammarText, w);
      if (!r.ok) throw new Error('generated grammar invalid');
      expect([w, r.result.verdict.kind]).toEqual([w, conds.every((c) => holds(c, w)) ? 'accepted' : 'rejected']);
    }
  });

  it('produces a minimal right-linear grammar with readable variable meanings', () => {
    const built = buildLanguage([{ kind: 'endsWith', w: 'aa' }], AB);
    if (!built.ok) throw new Error();
    expect(built.lang.grammarText).toBe('S → aA | bS\nA → aB | bS\nB → aB | bS | ε');
    expect(built.lang.meaning.B).toMatch(/^ends with aa/);
    expect(built.lang.meaning.A).toMatch(/ends with a \(the start of aa\)/);
    expect(built.lang.preset.valid[0]).toBe('aa');
    expect(built.lang.preset.notes?.['S→aA']).toMatch(/S stands for/);
  });

  it('reports an empty language and too many states', () => {
    const empty = buildLanguage([{ kind: 'startsWith', w: 'a' }, { kind: 'startsWith', w: 'b' }], AB);
    expect(empty.ok).toBe(false);
    const big = buildLanguage([{ kind: 'count', sym: 'a', op: 'exactly', n: 9 }, { kind: 'count', sym: 'b', op: 'exactly', n: 9 }], AB);
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error).toMatch(/26/);
  });

  it('rejects symbols outside the alphabet', () => {
    const r = buildLanguage([{ kind: 'endsWith', w: 'ac' }], AB);
    expect(r.ok).toBe(false);
  });
});
