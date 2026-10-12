import { describe, expect, it } from 'vitest';
import { normalisePowers, parseDescription } from '../src/core';

const built = (text: string) => {
  const o = parseDescription(text, ['a', 'b']);
  if (!o.built) throw new Error(`not built: ${text} → ${o.errors[0] ?? JSON.stringify(o.conditions.map((c) => c.kind))}`);
  return o.built;
};
const strings = (max: number) => {
  const out = [''];
  let layer = [''];
  for (let k = 0; k < max; k++) { layer = layer.flatMap((s) => ['a', 'b'].map((c) => s + c)); out.push(...layer); }
  return out;
};

describe('spoken "power" phrasing', () => {
  it('rewrites to caret notation', () => {
    expect(normalisePowers('a to power n and b to power 2n')).toBe('a^n b^2n');
    expect(normalisePowers('a to the power of n and b to the power of 2n')).toBe('a^n b^2n');
    expect(normalisePowers('a raised to n followed by b raised to 2n')).toBe('a^n followed by b^2n');
    expect(normalisePowers('a power n, b power n')).toBe('a^n b^n');
    expect(normalisePowers('a to the n and b to the 2n')).toBe('a^n b^2n');
  });
  it.each([
    'A to power n and B to power 2n',
    'a to the power n and b to the power 2n',
    'a raised to the power n followed by b raised to the power 2n',
    'a power n b power 2n',
    'a to the n and b to the 2n',
  ])('"%s" builds a^n b^2n', (text) => {
    const l = built(text);
    const ref = built('a^n b^2n');
    for (const w of strings(7)) expect(l.accepts(w), w).toBe(ref.accepts(w));
    expect(l.accepts('aabbbb')).toBe(true);
    expect(l.accepts('aabbb')).toBe(false);
    expect(l.accepts('abb')).toBe(true);
  });
  it('"a to power n and b to power n" is a^n b^n', () => {
    const l = built('a to power n and b to power n');
    expect(l.accepts('aabb')).toBe(true);
    expect(l.accepts('aab')).toBe(false);
  });
  it('does not touch ordinary descriptions', () => {
    expect(normalisePowers('ending with two a and containing 3 b')).toBe('ending with two a and containing 3 b');
    expect(normalisePowers('even number of a')).toBe('even number of a');
  });
});
