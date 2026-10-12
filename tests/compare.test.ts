import { describe, expect, it } from 'vitest';
import { buildLanguage, buildPDA, compareWithTarget, parseDescription, parseGrammar } from '../src/core';

function check(description: string, grammarText: string) {
  const sigma = ['a', 'b'];
  const out = parseDescription(description, sigma);
  const lang = out.built ?? (() => {
    const r = buildLanguage(out.conditions, sigma);
    if (!r.ok) throw new Error(r.error);
    return r.lang;
  })();
  const parsed = parseGrammar(grammarText);
  if (!parsed.ok) throw new Error('bad grammar');
  const g = parsed.grammar;
  return compareWithTarget(g, buildPDA(g), lang.sigma, lang.accepts);
}

describe('checking a person\'s productions against a described language', () => {
  it('accepts a correct grammar for "ending with two a"', () => {
    const r = check('ending with two a', 'S → aS | bS | aa');
    expect(r.extra).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.unknown).toEqual([]);
    expect(r.maxLen).toBeGreaterThanOrEqual(6);
  });

  it('reports strings the grammar generates but the description does not allow', () => {
    const r = check('ending with two a', 'S → aS | bS | a');
    expect(r.extra.length).toBeGreaterThan(0);
    expect(r.extra[0]).toBe('a'); // shortest counterexample first
  });

  it('reports strings of the language that the grammar misses', () => {
    const r = check('ending with two a', 'S → bS | aa');
    expect(r.missing[0]).toBe('aaa');
    expect(r.extra).toEqual([]);
  });

  it('works for a context-free description: a^n b^2n', () => {
    const good = check('n a followed by 2n b', 'S → aSbb | ε');
    expect(good.extra).toEqual([]);
    expect(good.missing).toEqual([]);
    const bad = check('n a followed by 2n b', 'S → aSb | ε');
    expect(bad.extra.length + bad.missing.length).toBeGreaterThan(0);
    expect(bad.extra).toContain('ab');
  });

  it('two different correct grammars both pass (many productions can reach the answer)', () => {
    expect(check('even length', 'S → aaS | abS | baS | bbS | ε').extra).toEqual([]);
    expect(check('even length', 'S → TTS | ε\nT → a | b').missing).toEqual([]);
    expect(check('even length', 'S → TTS | ε\nT → a | b').extra).toEqual([]);
  });
});
