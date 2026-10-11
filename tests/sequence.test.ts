import { describe, expect, it } from 'vitest';
import { buildLanguage, parseDescription, runAll, type BuiltLanguage } from '../src/core';

const AB = ['a', 'b'];
const ABCD = ['a', 'b', 'c', 'd'];

function allStrings(sigma: string[], n: number): string[] {
  const out = [''];
  let layer = [''];
  for (let k = 0; k < n; k++) { layer = layer.flatMap((s) => sigma.map((c) => s + c)); out.push(...layer); }
  return out;
}

/** describe → language, whichever route the description takes */
function lang(text: string, sigma = AB): BuiltLanguage {
  const out = parseDescription(text, sigma);
  if (out.errors.length) throw new Error(out.errors.join(' | '));
  if (out.built) return out.built;
  const r = buildLanguage(out.conditions, sigma);
  if (!r.ok) throw new Error(r.error);
  return r.lang;
}

/** the PDA built from the generated grammar must agree with an independent reference */
function checkAgainst(l: BuiltLanguage, ref: (w: string) => boolean, sigma: string[], maxLen: number) {
  for (const w of allStrings(sigma, maxLen)) {
    expect([w, l.accepts(w)]).toEqual([w, ref(w)]);
    const r = runAll(l.grammarText, w);
    if (!r.ok) throw new Error('generated grammar is invalid');
    expect([w, r.result.verdict.kind]).toEqual([w, ref(w) ? 'accepted' : 'rejected']);
  }
}

describe('ordered patterns (“followed by”)', () => {
  it('reads “2 a followed by 4b” as the single string aabbbb, not as “4 b”', () => {
    const out = parseDescription('2 a followed by 4b', AB);
    expect(out.errors).toEqual([]);
    expect(out.conditions).toEqual([{ kind: 'sequence', segments: [
      { sym: 'a', count: { kind: 'range', min: 2, max: 2 } },
      { sym: 'b', count: { kind: 'range', min: 4, max: 4 } },
    ] }]);
    checkAgainst(lang('2 a followed by 4b'), (w) => w === 'aabbbb', AB, 7);
  });

  it('understands words, numbers and quantities', () => {
    checkAgainst(lang('two a followed by four b'), (w) => w === 'aabbbb', AB, 6);
    checkAgainst(lang('any number of a followed by b'), (w) => /^a*b$/.test(w), AB, 6);
    checkAgainst(lang('one or more a then one or more b'), (w) => /^a+b+$/.test(w), AB, 6);
    checkAgainst(lang('at least 2 a followed by at most 1 b'), (w) => /^a{2,}b{0,1}$/.test(w), AB, 6);
    checkAgainst(lang('strings of 3 a followed by any number of b'), (w) => /^aaab*$/.test(w), AB, 6);
  });

  it('combines a regular pattern with other conditions', () => {
    checkAgainst(lang('any number of a followed by any number of b and even length'), (w) => /^a*b*$/.test(w) && w.length % 2 === 0, AB, 6);
  });
});

describe('exponent notation', () => {
  it('a^2 b^4 and a²b⁴', () => {
    checkAgainst(lang('a^2 b^4'), (w) => w === 'aabbbb', AB, 6);
    checkAgainst(lang('a²b⁴'), (w) => w === 'aabbbb', AB, 6);
    checkAgainst(lang('a* b+'), (w) => /^a*b+$/.test(w), AB, 6);
  });
});

describe('linked counts build a context-free grammar', () => {
  it('n a followed by 2n b = aⁿb²ⁿ (the Team 6 language)', () => {
    const l = lang('n a followed by 2n b');
    expect(l.kind).toBe('context-free');
    expect(l.grammarText).toBe('S → A\nA → aAbb | ε');
    checkAgainst(l, (w) => /^(a*)(b*)$/.test(w) && w.split('b').length - 1 === 2 * (w.split('a').length - 1) && /^a*b*$/.test(w), AB, 7);
  });

  it('a^n b^n, aⁿb²ⁿ, a^{n+1} b^n and n ≥ 1', () => {
    const anbn = (w: string) => { const m = w.match(/^(a*)(b*)$/); return !!m && m[1].length === m[2].length; };
    checkAgainst(lang('a^n b^n'), anbn, AB, 7);
    checkAgainst(lang('aⁿb²ⁿ'), (w) => { const m = w.match(/^(a*)(b*)$/); return !!m && 2 * m[1].length === m[2].length; }, AB, 7);
    checkAgainst(lang('a^{n+1} b^n'), (w) => { const m = w.match(/^(a*)(b*)$/); return !!m && m[1].length === m[2].length + 1; }, AB, 7);
    checkAgainst(lang('a^n b^n where n >= 1'), (w) => anbn(w) && w.length > 0, AB, 7);
  });

  it('nested links: a^n b^m c^m d^n and a^n c b^n', () => {
    const nested = (w: string) => { const m = w.match(/^(a*)(b*)(c*)(d*)$/); return !!m && m[1].length === m[4].length && m[2].length === m[3].length; };
    checkAgainst(lang('a^n b^m c^m d^n', ABCD), nested, ABCD, 6);
    const acb = (w: string) => { const m = w.match(/^(a*)c(b*)$/); return !!m && m[1].length === m[2].length; };
    checkAgainst(lang('n a followed by c followed by n b', ['a', 'b', 'c']), acb, ['a', 'b', 'c'], 6);
  });

  it('explains why aⁿbⁿcⁿ and crossing links have no PDA', () => {
    expect(parseDescription('a^n b^n c^n', ['a', 'b', 'c']).errors[0]).toMatch(/not context-free/);
    expect(parseDescription('a^n b^m c^n d^m', ABCD).errors[0]).toMatch(/cross/);
  });
});

describe('the parser never silently ignores words', () => {
  it('reports phrases it cannot fully read', () => {
    expect(parseDescription('xyz containing 3 b', AB).errors.length).toBe(1);
    expect(parseDescription('2 a followed by 4 c', AB).errors[0]).toMatch(/not in the alphabet/);
    expect(parseDescription('blue followed by b', AB).errors.length).toBe(1);
  });
});
