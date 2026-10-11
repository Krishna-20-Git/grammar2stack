import { sampleStrings, parseGrammar } from './grammar';

/**
 * Ordered patterns ("block languages"): a sequence of blocks, each a run of one
 * symbol with a count, e.g.
 *   2 a followed by 4 b          → a² b⁴           (one string)
 *   any number of a then b       → a* b            (regular)
 *   n a followed by 2n b         → aⁿ b²ⁿ          (context-free: counts linked by n)
 *   a^n c b^n,  a^n b^m c^m d^n  → nested links    (context-free)
 *   a^n b^n c^n, a^n b^m c^n d^m → three-way or crossing links: not context-free
 */

export type Count =
  | { kind: 'range'; min: number; max: number | null } // exact k is {k, k}
  | { kind: 'linear'; v: string; p: number; c: number }; // p·v + c

export interface Segment { sym: string; count: Count }

const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', m: 'ᵐ', k: 'ᵏ', i: 'ⁱ', j: 'ʲ', '*': '*', '≥': '≥' };
const sup = (s: string) => Array.from(s).map((ch) => SUP[ch] ?? ch).join('');

export function exponentText(c: Count): string {
  if (c.kind === 'linear') {
    const core = `${c.p === 1 ? '' : c.p}${c.v}${c.c > 0 ? `+${c.c}` : c.c < 0 ? `-${-c.c}` : ''}`;
    return sup(core);
  }
  if (c.max === c.min) return c.min === 1 ? '' : sup(String(c.min));
  if (c.max === null) return c.min === 0 ? '*' : c.min === 1 ? '⁺' : `^(≥${c.min})`;
  return `^(${c.min}..${c.max})`;
}

export const segmentsText = (segs: Segment[]) => segs.map((s) => s.sym + exponentText(s.count)).join(' ');

/* ----------------------------------------------------------------- parsing */

const NUMW: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, single: 1, double: 2, triple: 3 };
const VARS = new Set(['n', 'm', 'k', 'i', 'j']);

/** Parse an exponent such as 2, n, 2n, n+1, {2n+1}, *, + */
function parseExponent(e: string): Count | null {
  const s = e.replace(/[{}()\s]/g, '');
  if (s === '*') return { kind: 'range', min: 0, max: null };
  if (s === '+') return { kind: 'range', min: 1, max: null };
  if (/^\d+$/.test(s)) { const k = parseInt(s, 10); return { kind: 'range', min: k, max: k }; }
  const m = s.match(/^(\d*)([nmkij])([+-]\d+)?$/);
  if (m && VARS.has(m[2])) return { kind: 'linear', v: m[2], p: m[1] ? parseInt(m[1], 10) : 1, c: m[3] ? parseInt(m[3], 10) : 0 };
  return null;
}

/** Parse one block written in words: "2 a", "two a's", "n a", "2n b", "any number of a", "at least 2 b", "a". */
function parseWordBlock(t: string, sigma: string[]): Segment | string {
  const s = t.trim().replace(/^(?:a\s+string\s+of\s+|strings?\s+(?:of\s+)?|with\s+|having\s+|containing\s+|consisting\s+of\s+|of\s+)/, '').trim();
  let m: RegExpMatchArray | null;
  const symRe = '(\\S)(?:\'?s)?';
  // quantity words
  if ((m = s.match(new RegExp(`^(?:any\\s+number\\s+of|zero\\s+or\\s+more|0\\s+or\\s+more)\\s+${symRe}$`)))) return seg(m[1], { kind: 'range', min: 0, max: null });
  if ((m = s.match(new RegExp(`^(?:one\\s+or\\s+more|1\\s+or\\s+more|some|several|many|a\\s+few|at\\s+least\\s+one)\\s+${symRe}$`)))) return seg(m[1], { kind: 'range', min: 1, max: null });
  if ((m = s.match(new RegExp(`^at\\s*least\\s+(\\d+|${Object.keys(NUMW).join('|')})\\s*${symRe}$`)))) return seg(m[2], { kind: 'range', min: num(m[1]), max: null });
  if ((m = s.match(new RegExp(`^at\\s*most\\s+(\\d+|${Object.keys(NUMW).join('|')})\\s*${symRe}$`)))) return seg(m[2], { kind: 'range', min: 0, max: num(m[1]) });
  if ((m = s.match(new RegExp(`^(?:exactly\\s+)?(\\d+|${Object.keys(NUMW).join('|')})\\s*${symRe}$`)))) { const k = num(m[1]); return seg(m[2], { kind: 'range', min: k, max: k }); }
  // linked counts: n a, 2n b, n+1 c
  if ((m = s.match(new RegExp(`^(\\d*\\s*[nmkij](?:\\s*[+-]\\s*\\d+)?)\\s+${symRe}$`)))) {
    const c = parseExponent(m[1].replace(/\s+/g, ''));
    if (c) return seg(m[2], c);
  }
  // notation inside words: a^2, a^n
  if ((m = s.match(/^(\S)\s*\^\s*(\{[^}]+\}|\(?[^\s)]+\)?)$/))) {
    const c = parseExponent(m[2]);
    if (c) return seg(m[1], c);
  }
  // a single symbol: "a", "an a", "one a"
  if ((m = s.match(/^(?:an?\s+|the\s+symbol\s+)?(\S)$/))) return seg(m[1], { kind: 'range', min: 1, max: 1 });
  return `I couldn’t read the block “${t.trim()}”. Write blocks like “2 a”, “n b”, “any number of a” or “at least 3 b”.`;

  function seg(sym: string, count: Count): Segment | string {
    if (!sigma.includes(sym)) return `“${sym}” in “${t.trim()}” is not in the alphabet {${sigma.join(', ')}}.`;
    return { sym, count };
  }
  function num(x: string) { return /^\d+$/.test(x) ? parseInt(x, 10) : NUMW[x]; }
}

const SUP_BACK: Record<string, string> = { 'ⁿ': '^n', 'ᵐ': '^m', 'ᵏ': '^k', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', 'ⁱ': '^i', 'ʲ': '^j' };

/** Normalise superscripts: a²b⁴ → a^2b^4, aⁿb²ⁿ → a^nb^2n */
function normaliseSuperscripts(t: string): string {
  let out = '';
  let inSup = false;
  for (const ch of t) {
    const b = SUP_BACK[ch];
    if (b === undefined) { out += ch; inSup = false; continue; }
    if (b.startsWith('^')) { out += inSup ? b.slice(1) : b; inSup = true; }
    else { out += inSup ? b : '^' + b; inSup = true; }
  }
  return out;
}

export function looksLikeSequence(t: string): boolean {
  return /followed\s+by|\bthen\b|\^|[ⁿᵐ⁰¹²³⁴⁵⁶⁷⁸⁹⁺]|\S[*+](?:\s|$)/.test(t);
}

/** Parse a sequence phrase (words or exponent notation). */
export function parseSequence(text: string, sigma: string[]): Segment[] | string {
  const t = normaliseSuperscripts(text).replace(/\s*\|\s*[a-z]\s*(?:>=|≥|>|=>)\s*\d+.*$/, '').replace(/\b(?:where|with|for)\s+[a-z]\s*(?:>=|≥|>|=>)\s*\d+.*$/, '').trim();
  if (/followed\s+by|\bthen\b/.test(t)) {
    const parts = t.split(/\s*,?\s*(?:followed\s+by|and\s+then|then)\s*/).filter(Boolean);
    const segs: Segment[] = [];
    for (const p of parts) {
      const r = parseWordBlock(p, sigma);
      if (typeof r === 'string') return r;
      segs.push(r);
    }
    return segs;
  }
  // exponent notation: a^2 b^4, a^n b^{2n}, a^n c b^n, a* b+
  const s = t.replace(/^(?:strings?\s+(?:of\s+)?(?:the\s+)?(?:form\s+)?|l\s*=\s*|the\s+form\s+)/, '').replace(/[{}]\s*$/, '').replace(/\s+/g, '');
  const re = /(\S)(?:\^(\{[^}]*\}|\([^)]*\)|\d*[nmkij](?:[+-]\d+)?|\d+|\*|\+)|(\*|\+))?/gy;
  const segs: Segment[] = [];
  let m: RegExpExecArray | null;
  let pos = 0;
  while (pos < s.length && (m = re.exec(s))) {
    pos = re.lastIndex;
    const sym = m[1];
    if (!sigma.includes(sym)) return `“${sym}” is not in the alphabet {${sigma.join(', ')}}. Write patterns like a^2 b^4 or a^n b^2n.`;
    const e = m[2] ?? m[3];
    const count = e ? parseExponent(e) : { kind: 'range' as const, min: 1, max: 1 };
    if (!count) return `I couldn’t read the exponent “${e}”. Use a number, n, 2n, n+1, * or +.`;
    segs.push({ sym, count });
  }
  if (pos !== s.length || !segs.length) return `I couldn’t read the pattern “${text.trim()}”. Write it like a^2 b^4, a^n b^2n, or “2 a followed by 4 b”.`;
  return segs;
}

/** Lower bound for each variable, from "n ≥ 1", "n>0", "where n >= 2" (default 0). */
export function variableMinimums(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of normaliseSuperscripts(text).matchAll(/([nmkij])\s*(>=|≥|=>|>)\s*(\d+)/g)) {
    out[m[1]] = parseInt(m[3], 10) + (m[2] === '>' ? 1 : 0);
  }
  return out;
}

/* ------------------------------------------------------------ analysis */

export interface SequenceAnalysis {
  /** all counts are fixed ranges: the language is regular */
  regular: boolean;
  error?: string;
  /** pairs of block indices linked by the same variable */
  pairs: [number, number][];
}

export function analyseSequence(segs: Segment[]): SequenceAnalysis {
  const occ = new Map<string, number[]>();
  segs.forEach((s, i) => { if (s.count.kind === 'linear') occ.set(s.count.v, [...(occ.get(s.count.v) ?? []), i]); });
  const pairs: [number, number][] = [];
  for (const [v, idx] of occ) {
    if (idx.length > 2) {
      return { regular: false, pairs, error: `The variable ${v} links ${idx.length} blocks (${idx.map((i) => segs[i].sym).join(', ')}). A language such as aⁿbⁿcⁿ is not context-free: a single stack can match one count against one other count, but not three. No PDA accepts it, so it cannot be converted. (Pumping lemma for context-free languages.)` };
    }
    if (idx.length === 2) pairs.push([idx[0], idx[1]]);
  }
  for (const [a, b] of pairs) for (const [c, d] of pairs) {
    if (a < c && c < b && b < d) {
      return { regular: false, pairs, error: `The links cross: blocks ${segs[a].sym}…${segs[b].sym} and ${segs[c].sym}…${segs[d].sym} interleave (like aⁿbᵐcⁿdᵐ). Crossing dependencies are not context-free, because a stack must match the most recent block first. No PDA accepts this language.` };
    }
  }
  return { regular: pairs.length === 0 && segs.every((s) => s.count.kind === 'range'), pairs };
}

/* ------------------------------------------------- independent membership */

/** Membership by brute force over variable values; independent of grammars and PDAs. */
export function sequenceAccepts(segs: Segment[], mins: Record<string, number>, w: string): boolean {
  const vars = [...new Set(segs.flatMap((s) => (s.count.kind === 'linear' ? [s.count.v] : [])))];
  const assign: Record<string, number> = {};
  const tryAll = (k: number): boolean => {
    if (k === vars.length) {
      let src = '^';
      for (const s of segs) {
        const sym = s.sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (s.count.kind === 'range') src += `${sym}{${s.count.min},${s.count.max ?? ''}}`;
        else {
          const n = s.count.p * assign[s.count.v] + s.count.c;
          if (n < 0) return false;
          src += `${sym}{${n}}`;
        }
      }
      return new RegExp(src + '$').test(w);
    }
    for (let v = mins[vars[k]] ?? 0; v <= w.length; v++) {
      assign[vars[k]] = v;
      if (tryAll(k + 1)) return true;
    }
    return false;
  };
  return tryAll(0);
}

/* ------------------------------------------------------ CFG construction */

export interface SequenceGrammar { grammarText: string; meaning: Record<string, string>; notes: Record<string, string>; valid: string[] }

/**
 * Context-free grammar for a block sequence with nested links.
 * A linked pair x^{p·n+c} … y^{q·n+d} becomes  T → x^p T y^q | (middle)
 * so every application of T adds p x's and q y's together: the stack later
 * matches them in reverse order, which is why nesting is required.
 */
export function sequenceGrammar(segs: Segment[], mins: Record<string, number>): SequenceGrammar | string {
  const pool = 'ABCDEFGHIJKLMNOPQRTUVWXYZ'.split('');
  const prods: Record<string, string[]> = {};
  const meaning: Record<string, string> = {};
  const notes: Record<string, string> = {};
  const order: string[] = ['S'];
  const fresh = (what: string) => {
    const v = pool.shift();
    if (!v) throw new Error('This pattern needs more than 26 grammar variables.');
    order.push(v);
    meaning[v] = what;
    return v;
  };
  const anyMemo = new Map<string, string>();
  const optMemo = new Map<string, string>();
  const rep = (x: string, k: number) => x.repeat(Math.max(0, k));

  const block = (s: Segment): string => {
    const c = s.count;
    if (c.kind === 'range') {
      if (c.max === null) {
        let U = anyMemo.get(s.sym);
        if (!U) {
          U = fresh(`any number of further ${s.sym}’s`);
          prods[U] = [`${s.sym}${U}`, 'ε'];
          notes[`${U}→${s.sym}${U}`] = `${U} adds one more ${s.sym}; it can repeat any number of times.`;
          notes[`${U}→`] = `${U} stops adding ${s.sym}’s.`;
          anyMemo.set(s.sym, U);
        }
        return rep(s.sym, c.min) + U;
      }
      let O = '';
      if (c.max > c.min) {
        O = optMemo.get(s.sym) ?? '';
        if (!O) {
          O = fresh(`an optional ${s.sym}`);
          prods[O] = [s.sym, 'ε'];
          optMemo.set(s.sym, O);
        }
      }
      return rep(s.sym, c.min) + O.repeat(c.max - c.min);
    }
    // a variable used only once: c + p·t for t ≥ min
    const L = fresh(`groups of ${c.p} ${s.sym}’s, repeated any number of times`);
    prods[L] = [`${rep(s.sym, c.p)}${L}`, 'ε'];
    return rep(s.sym, c.c + c.p * (mins[c.v] ?? 0)) + L;
  };

  const gen = (list: Segment[]): string => {
    for (let i = 0; i < list.length; i++) {
      const ci = list[i].count;
      if (ci.kind !== 'linear') continue;
      let j = -1;
      for (let k = list.length - 1; k > i; k--) { const ck = list[k].count; if (ck.kind === 'linear' && ck.v === ci.v) { j = k; break; } }
      if (j < 0) continue;
      const cj = list[j].count as Extract<Count, { kind: 'linear' }>;
      const x = list[i].sym, y = list[j].sym, n0 = mins[ci.v] ?? 0;
      const baseX = ci.c + ci.p * n0, baseY = cj.c + cj.p * n0;
      if (baseX < 0 || baseY < 0) throw new Error(`With ${ci.v} ≥ ${n0} the count of ${baseX < 0 ? x : y} would be negative. Add a condition such as “${ci.v} ≥ 1”.`);
      const before = gen(list.slice(0, i));
      const T = fresh(`matches ${ci.p} ${x}${ci.p === 1 ? '' : '’s'} with ${cj.p} ${y}${cj.p === 1 ? '' : '’s'} for each step of ${ci.v}`);
      const middle = gen(list.slice(i + 1, j));
      const after = gen(list.slice(j + 1));
      prods[T] = [`${rep(x, ci.p)}${T}${rep(y, cj.p)}`, middle || 'ε'];
      notes[`${T}→${rep(x, ci.p)}${T}${rep(y, cj.p)}`] = `${T} wraps ${rep(x, ci.p)} … ${rep(y, cj.p)} around itself. Each application adds ${ci.p} ${x} on the left and ${cj.p} ${y} on the right, so the two counts stay linked by ${ci.v}. This nesting is exactly what a stack can check.`;
      notes[`${T}→${middle}`] = middle ? `${T} stops wrapping and produces the blocks in the middle.` : `${T} stops wrapping: ${ci.v} has reached its value.`;
      return before + rep(x, baseX) + T + rep(y, baseY) + after;
    }
    return list.map(block).join('');
  };

  let rhs: string;
  try { rhs = gen(segs); } catch (e) { return (e as Error).message; }
  meaning.S = `the whole string ${segmentsText(segs)}`;
  prods.S = [rhs || 'ε'];
  notes[`S→${rhs}`] = `The start symbol lays out the blocks in order: ${segmentsText(segs)}.`;
  const grammarText = order.map((v) => `${v} → ${prods[v].join(' | ')}`).join('\n');
  const parsed = parseGrammar(grammarText);
  const valid = parsed.ok ? sampleStrings(parsed.grammar, 5, 14) : [];
  return { grammarText, meaning, notes, valid };
}
