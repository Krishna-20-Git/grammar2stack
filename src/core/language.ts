import type { Preset } from './presets';
import { analyseSequence, looksLikeSequence, parseSequence, segmentsText, sequenceAccepts, sequenceGrammar, variableMinimums, type Segment } from './sequence';

/**
 * Language builder: describe a language by conditions (or in words), and get a
 * context-free grammar for it.
 *
 * Each condition is a regular property, so it has a finite automaton. The
 * conditions are combined with the product construction, minimised, and turned
 * into a right-linear grammar:
 *     δ(A, c) = B   ⟹   A → cB
 *     A accepting   ⟹   A → ε
 * Every variable of the grammar therefore stands for one "memory state" (what the
 * machine must remember about the prefix read so far), and the grammar can be fed
 * into the ordinary CFG → PDA construction.
 */

export type CountOp = 'exactly' | 'atLeast' | 'atMost';

export type Condition =
  | { kind: 'startsWith'; w: string }
  | { kind: 'endsWith'; w: string }
  | { kind: 'contains'; w: string }
  | { kind: 'notContains'; w: string }
  | { kind: 'count'; sym: string; op: CountOp; n: number }
  | { kind: 'countMod'; sym: string; m: number; r: number }
  | { kind: 'length'; op: CountOp; n: number }
  | { kind: 'lengthMod'; m: number; r: number }
  /** ordered blocks with fixed counts, e.g. a² b⁴ or a* b (regular) */
  | { kind: 'sequence'; segments: Segment[] };

export type ConditionKind = Condition['kind'];

export interface DFA {
  size: number;
  start: number;
  accept: boolean[];
  /** delta[q][i] = next state on alphabet[i]; -1 = no move (dead) */
  delta: number[][];
  desc: string[];
}

/* ------------------------------------------------------------------ wording */

const OP_TEXT: Record<CountOp, string> = { exactly: 'exactly', atLeast: 'at least', atMost: 'at most' };
const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : '’s'}`;

export function describeCondition(c: Condition): string {
  switch (c.kind) {
    case 'startsWith': return `start with ${c.w}`;
    case 'endsWith': return `end with ${c.w}`;
    case 'contains': return `contain ${c.w}`;
    case 'notContains': return `do not contain ${c.w}`;
    case 'count': return `have ${OP_TEXT[c.op]} ${plural(c.n, c.sym)}`;
    case 'countMod':
      if (c.m === 2) return `have an ${c.r === 0 ? 'even' : 'odd'} number of ${c.sym}’s`;
      return c.r === 0 ? `have a number of ${c.sym}’s divisible by ${c.m}` : `have #${c.sym} ≡ ${c.r} (mod ${c.m})`;
    case 'length': return `have length ${OP_TEXT[c.op]} ${c.n}`;
    case 'lengthMod':
      if (c.m === 2) return `have ${c.r === 0 ? 'even' : 'odd'} length`;
      return c.r === 0 ? `have length divisible by ${c.m}` : `have length ≡ ${c.r} (mod ${c.m})`;
    case 'sequence': return `have the form ${segmentsText(c.segments)}`;
  }
}

function formalCondition(c: Condition): string {
  switch (c.kind) {
    case 'startsWith': return `w ∈ ${c.w}Σ*`;
    case 'endsWith': return `w ∈ Σ*${c.w}`;
    case 'contains': return `w ∈ Σ*${c.w}Σ*`;
    case 'notContains': return `w ∉ Σ*${c.w}Σ*`;
    case 'count': return `#${c.sym}(w) ${c.op === 'exactly' ? '=' : c.op === 'atLeast' ? '≥' : '≤'} ${c.n}`;
    case 'countMod': return `#${c.sym}(w) ≡ ${c.r} (mod ${c.m})`;
    case 'length': return `|w| ${c.op === 'exactly' ? '=' : c.op === 'atLeast' ? '≥' : '≤'} ${c.n}`;
    case 'lengthMod': return `|w| ≡ ${c.r} (mod ${c.m})`;
    case 'sequence': return `w ∈ ${segmentsText(c.segments)}`;
  }
}

/* ------------------------------------------------------------- automata */

/** KMP-style automaton: state i = length of the longest suffix of the input that is a prefix of w. */
function kmpNext(w: string, i: number, ch: string): number {
  let k = i;
  // candidate = w.slice(0,k) + ch ; find longest prefix of w that is a suffix of it
  const s = w.slice(0, k) + ch;
  for (k = Math.min(w.length, s.length); k > 0; k--) if (s.endsWith(w.slice(0, k))) return k;
  return 0;
}

export function conditionDFA(c: Condition, sigma: string[]): DFA {
  const build = (size: number, start: number, step: (q: number, ch: string) => number, acc: (q: number) => boolean, desc: (q: number) => string): DFA => ({
    size, start,
    accept: Array.from({ length: size }, (_, q) => acc(q)),
    delta: Array.from({ length: size }, (_, q) => sigma.map((ch) => step(q, ch))),
    desc: Array.from({ length: size }, (_, q) => desc(q)),
  });
  switch (c.kind) {
    case 'endsWith': {
      const L = c.w.length;
      return build(L + 1, 0, (q, ch) => kmpNext(c.w, q, ch), (q) => q === L,
        (q) => (q === 0 ? `does not end with any part of ${c.w}` : q === L ? `ends with ${c.w}` : `ends with ${c.w.slice(0, q)} (the start of ${c.w})`));
    }
    case 'contains':
    case 'notContains': {
      const L = c.w.length;
      const neg = c.kind === 'notContains';
      return build(L + 1, 0, (q, ch) => (q === L ? L : kmpNext(c.w, q, ch)), (q) => (neg ? q !== L : q === L),
        (q) => (q === L ? `${c.w} has occurred` : q === 0 ? `no progress towards ${c.w}` : `${c.w.slice(0, q)} of ${c.w} matched`));
    }
    case 'startsWith': {
      const L = c.w.length; const DEAD = L + 1;
      return build(L + 2, 0, (q, ch) => (q === L ? L : q === DEAD ? DEAD : c.w[q] === ch ? q + 1 : DEAD), (q) => q === L,
        (q) => (q === L ? `the prefix ${c.w} has been read` : q === DEAD ? `the prefix is wrong` : q === 0 ? `nothing read yet (must start with ${c.w})` : `read ${c.w.slice(0, q)} of the prefix ${c.w}`));
    }
    case 'count':
    case 'length': {
      const n = c.n;
      const hit = (ch: string) => (c.kind === 'length' ? true : ch === c.sym);
      const what = c.kind === 'length' ? 'symbols' : `${c.sym}’s`;
      if (c.op === 'atLeast') {
        return build(n + 1, 0, (q, ch) => (hit(ch) ? Math.min(q + 1, n) : q), (q) => q === n,
          (q) => (q === n ? `at least ${n} ${what}` : `${q} ${what} so far`));
      }
      const OVER = n + 1;
      return build(n + 2, 0, (q, ch) => (q === OVER ? OVER : hit(ch) ? q + 1 : q), (q) => (c.op === 'exactly' ? q === n : q <= n),
        (q) => (q === OVER ? `more than ${n} ${what}` : `${q} ${what} so far`));
    }
    case 'sequence': return sequenceDFA(c.segments, sigma);
    case 'countMod':
    case 'lengthMod': {
      const hit = (ch: string) => (c.kind === 'lengthMod' ? true : ch === c.sym);
      const what = c.kind === 'lengthMod' ? 'length' : `#${c.sym}`;
      return build(c.m, 0, (q, ch) => (hit(ch) ? (q + 1) % c.m : q), (q) => q === c.r,
        (q) => (c.m === 2 ? `${what} is ${q === 0 ? 'even' : 'odd'} so far` : `${what} ≡ ${q} (mod ${c.m}) so far`));
    }
  }
}

/** Subset construction for a sequence of blocks with fixed count ranges. */
function sequenceDFA(segs: Segment[], sigma: string[]): DFA {
  const K = segs.length;
  const lim = segs.map((s) => (s.count.kind === 'range' ? s.count : { min: 0, max: null }));
  const key = (i: number, c: number) => `${i}:${c}`;
  const close = (set: Set<string>) => {
    const stack = [...set];
    while (stack.length) {
      const [i, c] = stack.pop()!.split(':').map(Number);
      if (i < K && c >= lim[i].min) { const k = key(i + 1, 0); if (!set.has(k)) { set.add(k); stack.push(k); } }
    }
    return set;
  };
  const step = (set: Set<string>, ch: string) => {
    const out = new Set<string>();
    for (const e of set) {
      const [i, c] = e.split(':').map(Number);
      if (i >= K || segs[i].sym !== ch) continue;
      const { min, max } = lim[i];
      if (max === null) out.add(key(i, Math.min(c + 1, min)));
      else if (c < max) out.add(key(i, c + 1));
    }
    return close(out);
  };
  const name = (set: Set<string>) => [...set].sort().join(',');
  const startSet = close(new Set([key(0, 0)]));
  const sets = [startSet];
  const ids = new Map([[name(startSet), 0]]);
  const delta: number[][] = [];
  for (let q = 0; q < sets.length; q++) {
    delta[q] = sigma.map((ch) => {
      const t = step(sets[q], ch);
      const k = name(t);
      if (!ids.has(k)) { ids.set(k, sets.length); sets.push(t); }
      return ids.get(k)!;
    });
    if (sets.length > 2000) throw new Error('The pattern needs too many states.');
  }
  const describe = (set: Set<string>) => {
    if (!set.size) return 'the string no longer fits the pattern';
    const els = [...set].map((e) => e.split(':').map(Number)).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const [i, c] = els[0];
    if (i >= K) return `the pattern ${segmentsText(segs)} is complete`;
    const s = segs[i], l = lim[i];
    const total = l.max === l.min ? ` of ${l.min}` : l.max === null && c >= l.min && l.min > 0 ? ' or more' : '';
    return `in block ${i + 1} (${s.sym}): ${c}${total} ${s.sym}’s so far`;
  };
  return {
    size: sets.length, start: 0, delta,
    accept: sets.map((set) => set.has(key(K, 0))),
    desc: sets.map(describe),
  };
}

/** Product automaton: accepts iff every component accepts. Only reachable states are built. */
export function productDFA(parts: DFA[], sigma: string[]): DFA {
  if (parts.length === 1) return parts[0];
  const key = (t: number[]) => t.join(',');
  const startT = parts.map((d) => d.start);
  const ids = new Map<string, number>([[key(startT), 0]]);
  const tuples: number[][] = [startT];
  const delta: number[][] = [];
  for (let q = 0; q < tuples.length; q++) {
    delta[q] = sigma.map((_, i) => {
      const nt = tuples[q].map((s, k) => parts[k].delta[s][i]);
      const k = key(nt);
      if (!ids.has(k)) { ids.set(k, tuples.length); tuples.push(nt); }
      return ids.get(k)!;
    });
    if (tuples.length > 5000) throw new Error('The combined conditions need too many states.');
  }
  return {
    size: tuples.length, start: 0, delta,
    accept: tuples.map((t) => t.every((s, k) => parts[k].accept[s])),
    desc: tuples.map((t) => t.map((s, k) => parts[k].desc[s]).join('; ')),
  };
}

/** Moore minimisation, then removal of states from which no accepting state is reachable. */
export function minimiseDFA(d: DFA, sigma: string[]): DFA {
  // partition refinement on the complete DFA
  let cls: number[] = d.accept.map((a) => (a ? 1 : 0));
  for (;;) {
    const sig = new Map<string, number>();
    const next = cls.map((c, q) => {
      const s = `${c}|${d.delta[q].map((t) => cls[t]).join(',')}`;
      if (!sig.has(s)) sig.set(s, sig.size);
      return sig.get(s)!;
    });
    const before = new Set(cls).size;
    cls = next;
    if (sig.size === before) break;
  }
  // renumber classes in BFS order from the start
  const order: number[] = [];
  const seenCls = new Map<number, number>();
  const rep = new Map<number, number>();
  const queue = [d.start];
  seenCls.set(cls[d.start], 0); order.push(cls[d.start]); rep.set(cls[d.start], d.start);
  while (queue.length) {
    const q = queue.shift()!;
    for (const t of d.delta[q]) {
      if (!seenCls.has(cls[t])) { seenCls.set(cls[t], order.length); order.push(cls[t]); rep.set(cls[t], t); queue.push(t); }
    }
  }
  const members = new Map<number, number[]>();
  d.desc.forEach((_, q) => { if (seenCls.has(cls[q])) members.set(cls[q], [...(members.get(cls[q]) ?? []), q]); });
  let m: DFA = {
    size: order.length, start: 0,
    accept: order.map((c) => d.accept[rep.get(c)!]),
    delta: order.map((c) => d.delta[rep.get(c)!].map((t) => seenCls.get(cls[t])!)),
    desc: order.map((c) => {
      // keep only the facts that all merged states agree on; the others no longer matter
      const parts = members.get(c)!.map((q) => d.desc[q].split('; '));
      const kept = parts[0].filter((fact, k) => parts.every((ps) => ps[k] === fact));
      return kept.length ? kept.join('; ') : 'nothing more needs to be remembered';
    }),
  };
  // co-reachability: drop dead states
  const live = new Array(m.size).fill(false);
  m.accept.forEach((a, q) => { if (a) live[q] = true; });
  let changed = true;
  while (changed) {
    changed = false;
    for (let q = 0; q < m.size; q++) if (!live[q] && m.delta[q].some((t) => t >= 0 && live[t])) { live[q] = true; changed = true; }
  }
  if (!live[m.start]) return { size: 0, start: -1, accept: [], delta: [], desc: [] };
  const keep: number[] = [];
  const newId = new Map<number, number>();
  // keep BFS order
  const bq = [m.start]; newId.set(m.start, 0); keep.push(m.start);
  while (bq.length) {
    const q = bq.shift()!;
    for (const t of m.delta[q]) if (t >= 0 && live[t] && !newId.has(t)) { newId.set(t, keep.length); keep.push(t); bq.push(t); }
  }
  m = {
    size: keep.length, start: 0,
    accept: keep.map((q) => m.accept[q]),
    delta: keep.map((q) => m.delta[q].map((t) => (t >= 0 && newId.has(t) ? newId.get(t)! : -1))),
    desc: keep.map((q) => m.desc[q]),
  };
  void sigma;
  return m;
}

export function dfaAccepts(d: DFA, sigma: string[], w: string): boolean {
  if (d.size === 0) return false;
  let q = d.start;
  for (const ch of w) {
    const i = sigma.indexOf(ch);
    if (i < 0) return false;
    q = d.delta[q][i];
    if (q < 0) return false;
  }
  return d.accept[q];
}

/* ------------------------------------------------------------ grammar */

const VAR_NAMES = ['S', ...'ABCDEFGHIJKLMNOPQRTUVWXYZ'];

export interface BuiltLanguage {
  kind: 'regular' | 'context-free';
  conditions: Condition[];
  sigma: string[];
  dfa?: DFA;
  grammarText: string;
  /** variable → what it stands for */
  meaning: Record<string, string>;
  preset: Preset;
  /** number of grammar variables */
  size: number;
  /** plain-language description, e.g. "end with aa and have exactly 3 b’s" */
  summary: string;
  /** membership according to the description (independent of the PDA) */
  accepts: (w: string) => boolean;
}

export type BuildResult = { ok: true; lang: BuiltLanguage } | { ok: false; error: string };

export function buildLanguage(conditions: Condition[], sigma: string[]): BuildResult {
  if (!sigma.length) return { ok: false, error: 'Choose an alphabet Σ with at least one symbol, for example a, b.' };
  if (!conditions.length) return { ok: false, error: 'Add at least one condition.' };
  for (const c of conditions) {
    const err = validateCondition(c, sigma);
    if (err) return { ok: false, error: err };
  }
  let dfa: DFA;
  try {
    dfa = minimiseDFA(productDFA(conditions.map((c) => conditionDFA(c, sigma)), sigma), sigma);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (dfa.size === 0) return { ok: false, error: 'No string satisfies all of these conditions together, so the language is empty and has no grammar with a start symbol that derives anything. Relax one of the conditions.' };
  if (dfa.size > VAR_NAMES.length) return { ok: false, error: `This language needs ${dfa.size} memory states, but grammar variables are single capital letters (at most 26). Use smaller numbers or fewer conditions.` };

  const name = (q: number) => VAR_NAMES[q];
  const lines: string[] = [];
  const meaning: Record<string, string> = {};
  const notes: Record<string, string> = {};
  for (let q = 0; q < dfa.size; q++) {
    const A = name(q);
    meaning[A] = dfa.desc[q] + (dfa.accept[q] ? ' (all conditions satisfied)' : '');
    const alts: string[] = [];
    sigma.forEach((ch, i) => {
      const t = dfa.delta[q][i];
      if (t < 0) return;
      const B = name(t);
      alts.push(`${ch}${B}`);
      notes[`${A}→${ch}${B}`] = `${A} stands for the situation “${dfa.desc[q]}”. Generating ${ch} next leads to ${B}: “${dfa.desc[t]}”. The variable is the grammar’s memory of the prefix generated so far.`;
    });
    if (dfa.accept[q]) {
      alts.push('ε');
      notes[`${A}→`] = `${A} is an accepting situation (“${dfa.desc[q]}”), so every condition already holds and the derivation may stop here.`;
    }
    lines.push(`${A} → ${alts.join(' | ')}`);
  }
  const grammarText = lines.join('\n');

  // examples: shortest members and shortest non-members (by enumerating Σ*)
  const valid: string[] = [];
  const invalid: string[] = [];
  outer: for (let len = 0; len <= 12; len++) {
    const total = sigma.length ** len;
    if (total > 20000) break;
    for (let k = 0; k < total; k++) {
      let s = '', x = k;
      for (let j = 0; j < len; j++) { s = sigma[x % sigma.length] + s; x = Math.floor(x / sigma.length); }
      if (dfaAccepts(dfa, sigma, s)) { if (valid.length < 5) valid.push(s); }
      else if (invalid.length < 4 && invalid.filter((v) => v.length === len).length < 2) invalid.push(s);
      if (valid.length >= 5 && invalid.length >= 4) break outer;
    }
  }

  const text = conditions.map(describeCondition).join(' and ');
  const preset: Preset = {
    id: 'custom-language',
    name: `Strings that ${text}`,
    grammar: grammarText,
    language: `L = { w ∈ {${sigma.join(', ')}}* | ${conditions.map(formalCondition).join(' ∧ ')} }`,
    description: `Strings over {${sigma.join(', ')}} that ${text}. Built automatically: each grammar variable remembers one situation about the prefix generated so far.`,
    valid, invalid, notes,
  };
  return { ok: true, lang: { kind: 'regular', conditions, sigma, dfa, grammarText, meaning, preset, size: dfa.size, summary: text, accepts: (w: string) => dfaAccepts(dfa, sigma, w) } };
}

/** Context-free language from an ordered pattern with linked counts (aⁿ b²ⁿ, aⁿ c bⁿ, …). */
export function buildSequenceLanguage(segs: Segment[], mins: Record<string, number>, sigma: string[]): BuildResult {
  const a = analyseSequence(segs);
  if (a.error) return { ok: false, error: a.error };
  const g = sequenceGrammar(segs, mins);
  if (typeof g === 'string') return { ok: false, error: g };
  const vars = [...new Set(segs.flatMap((s) => (s.count.kind === 'linear' ? [s.count.v] : [])))];
  const cond = vars.map((v) => `${v} ≥ ${mins[v] ?? 0}`).join(', ');
  const accepts = (w: string) => Array.from(w).every((ch) => sigma.includes(ch)) && sequenceAccepts(segs, mins, w);
  const invalid: string[] = [];
  outer: for (let len = 1; len <= 9; len++) {
    const total = sigma.length ** len;
    if (total > 20000) break;
    for (let k = 0; k < total; k++) {
      let s = '', x = k;
      for (let j = 0; j < len; j++) { s = sigma[x % sigma.length] + s; x = Math.floor(x / sigma.length); }
      if (!accepts(s) && invalid.filter((v) => v.length === len).length < 1 && (len > 1 || invalid.length === 0)) invalid.push(s);
      if (invalid.length >= 4) break outer;
    }
  }
  const summary = `have the form ${segmentsText(segs)}${cond ? ` (${cond})` : ''}`;
  const preset: Preset = {
    id: 'custom-language',
    name: `Strings of the form ${segmentsText(segs)}`,
    grammar: g.grammarText,
    language: `L = { ${segmentsText(segs)}${cond ? ` | ${cond}` : ''} }`,
    description: `Context-free: the counts of linked blocks must match, which a finite memory cannot check but a stack can. Built automatically from the pattern ${segmentsText(segs)}.`,
    valid: g.valid,
    invalid,
    notes: g.notes,
  };
  return { ok: true, lang: { kind: 'context-free', conditions: [], sigma, grammarText: g.grammarText, meaning: g.meaning, preset, size: Object.keys(g.meaning).length, summary, accepts } };
}

export function validateCondition(c: Condition, sigma: string[]): string | null {
  const bad = (w: string) => Array.from(w).find((ch) => !sigma.includes(ch));
  switch (c.kind) {
    case 'startsWith': case 'endsWith': case 'contains': case 'notContains': {
      if (!c.w) return `“${describeCondition(c)}” needs a non-empty string.`;
      const b = bad(c.w);
      if (b) return `“${b}” in ${c.w} is not in the alphabet {${sigma.join(', ')}}.`;
      if (c.w.length > 12) return 'Keep substrings to at most 12 symbols.';
      return null;
    }
    case 'count': case 'countMod':
      if (!sigma.includes(c.sym)) return `“${c.sym}” is not in the alphabet {${sigma.join(', ')}}.`;
      if (c.kind === 'count' && (c.n < 0 || c.n > 20)) return 'Counts must be between 0 and 20.';
      if (c.kind === 'countMod' && (c.m < 2 || c.m > 12 || c.r < 0 || c.r >= c.m)) return 'Use a modulus from 2 to 12 and a remainder below it.';
      return null;
    case 'length':
      if (c.n < 0 || c.n > 20) return 'Lengths must be between 0 and 20.';
      return null;
    case 'lengthMod':
      if (c.m < 2 || c.m > 12 || c.r < 0 || c.r >= c.m) return 'Use a modulus from 2 to 12 and a remainder below it.';
      return null;
    case 'sequence':
      for (const sg of c.segments) {
        if (!sigma.includes(sg.sym)) return `“${sg.sym}” is not in the alphabet {${sigma.join(', ')}}.`;
        if (sg.count.kind === 'range' && (sg.count.min > 20 || (sg.count.max ?? 0) > 20)) return 'Keep block counts at most 20.';
      }
      return null;
  }
}

/* ------------------------------------------------------- words → conditions */

const NUM_WORDS: Record<string, number> = {
  zero: 0, no: 0, one: 1, a: 1, an: 1, single: 1, two: 2, double: 2, three: 3, triple: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const NUM = '(\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|double|triple|single)';

export function parseAlphabet(text: string): string[] {
  const parts = text.replace(/[{}]/g, '').split(/[\s,;]+/).filter(Boolean);
  const syms = parts.length === 1 && parts[0].length > 1 ? Array.from(parts[0]) : parts;
  return [...new Set(syms.filter((s) => s.length === 1))];
}

const toNum = (s: string) => (/^\d+$/.test(s) ? parseInt(s, 10) : NUM_WORDS[s]);

/** "two a" → aa, "aa" → aa, "'ab'" → ab; null if not understood. */
function parseString(spec: string, sigma: string[]): string | null {
  const s = spec.trim().replace(/^(the\s+)?(substring|string|pattern|symbols?)\s+/, '').replace(/["'“”‘’]/g, '').trim();
  const compact = s.replace(/\s+/g, '');
  if (compact && Array.from(compact).every((ch) => sigma.includes(ch))) return compact;
  const m = s.match(new RegExp(`^${NUM}\\s*(\\S)(?:'?s)?$`));
  if (m && sigma.includes(m[2]) && toNum(m[1]) !== undefined) return m[2].repeat(toNum(m[1]));
  return null;
}

export interface ParseOutcome {
  conditions: Condition[];
  errors: string[];
  /** id of an example grammar for a known non-regular description */
  pattern?: string;
  /** a context-free language built directly (ordered pattern with linked counts) */
  built?: BuiltLanguage;
}

/**
 * Understands phrases such as:
 *   ending with two a · ends with aa · starting with b · containing 3b · contains exactly 2 a's
 *   at least 2 b · at most one a · containing aba · not containing bb · without aa
 *   even number of a · odd number of b's · even length · length at least 3 · number of a divisible by 3
 * joined by "and" or commas. Non-regular patterns (aⁿbⁿ, palindromes, …) are reported in `pattern`.
 */
/**
 * Rewrite spoken "power" phrasing into the caret notation the sequence parser understands:
 * "a to power n and b to the power 2n" → "a^n b^2n". Also "raised to", "power of", and
 * "and" or commas between exponent blocks.
 */
const EXPONENT = String.raw`(\d*[a-z](?:\s*[+-]\s*\d+)?|\d+|\(\s*[a-z]\s*[+-]\s*\d+\s*\))(?![a-z])`;
const POWER_PHRASE = new RegExp(
  String.raw`\b([a-z])\s+(?:raised\s+to\s+(?:the\s+)?(?:power\s+(?:of\s+)?)?|to\s+(?:the\s+power\s+(?:of\s+)?|power\s+(?:of\s+)?|the\s+)|power\s+(?:of\s+)?)` + EXPONENT,
  'g',
);
export function normalisePowers(t: string): string {
  return t
    .replace(POWER_PHRASE, (_m, base: string, e: string) => `${base}^${e.replace(/\s+/g, '')}`)
    .replace(/(\^[^\s,]+)\s*(?:,|\band\b)\s*(?=[a-z]\s*\^)/g, '$1 ');
}

export function parseDescription(text: string, sigma: string[]): ParseOutcome {
  const conditions: Condition[] = [];
  const errors: string[] = [];
  const lower = normalisePowers(text.toLowerCase().replace(/[’`]/g, "'").trim());

  const cf = detectPattern(lower);
  if (cf) return { conditions, errors, pattern: cf };

  // a whole description that is one ordered pattern, possibly with linked counts
  const whole = lower.replace(/^(?:all\s+)?(?:the\s+)?(?:set\s+of\s+)?(?:strings?|words?)\s+(?:of\s+the\s+form\s+|that\s+are\s+|which\s+are\s+|with\s+|having\s+|consisting\s+of\s+)?/, '').replace(/\{[^}]*,[^}]*\}/g, ' ').trim();
  if (looksLikeSequence(whole) && !/\band\b(?!\s+then)/.test(whole.replace(/\b(?:where|with|for)\b.*$/, ''))) {
    const segs = parseSequence(whole, sigma);
    if (typeof segs === 'string') return { conditions, errors: [segs] };
    const a = analyseSequence(segs);
    if (a.error) return { conditions, errors: [a.error] };
    if (!a.regular) {
      const r = buildSequenceLanguage(segs, variableMinimums(whole), sigma);
      return r.ok ? { conditions, errors, built: r.lang } : { conditions, errors: [r.error] };
    }
    return { conditions: [{ kind: 'sequence', segments: segs }], errors };
  }

  const cleaned = lower.replace(/\{[^}]*,[^}]*\}/g, ' ').replace(/\bover\s+(?:the\s+)?alphabet\b/g, ' ');
  const phrases = cleaned.split(/\s*(?:,|;|&|\band\b|\bbut\b|\balso\b)\s*/).map((p) => p.trim()).filter(Boolean);
  for (const raw of phrases) {
    let p = raw;
    for (let k = 0; k < 12; k++) {
      const q = p.replace(/^(?:the|a|an|set|of|all|binary|strings?|words?|over|that|which|whose|where|are|is|w|in|language|l|=|:|-)(?:\b|(?=\s)|$)\s*/, '');
      if (q === p) break;
      p = q;
    }
    p = p.trim();
    if (!p) continue;
    if (looksLikeSequence(p)) {
      const segs = parseSequence(p, sigma);
      if (typeof segs === 'string') { errors.push(segs); continue; }
      const a = analyseSequence(segs);
      if (a.error) { errors.push(a.error); continue; }
      if (!a.regular) { errors.push(`“${p}” links counts (it is context-free), so it can’t be combined with other conditions using “and”. Describe it on its own.`); continue; }
      conditions.push({ kind: 'sequence', segments: segs });
      continue;
    }
    const c = parsePhrase(p, sigma);
    if (typeof c === 'string') errors.push(c);
    else conditions.push(c);
  }
  if (!conditions.length && !errors.length) errors.push('Describe at least one property, for example “ending with two a and containing 3 b”.');
  return { conditions, errors };
}

function opFrom(words: string | undefined): { op: CountOp; delta: number } {
  if (!words) return { op: 'exactly', delta: 0 };
  if (/at\s*least|minimum|min\.?|or more/.test(words)) return { op: 'atLeast', delta: 0 };
  if (/more than|greater than|over/.test(words)) return { op: 'atLeast', delta: 1 };
  if (/at\s*most|maximum|max\.?|or fewer|or less|up to/.test(words)) return { op: 'atMost', delta: 0 };
  if (/less than|fewer than|under/.test(words)) return { op: 'atMost', delta: -1 };
  return { op: 'exactly', delta: 0 };
}

function parsePhrase(p: string, sigma: string[]): Condition | string {
  const fail = `I couldn’t interpret “${p}”. Try phrases like “ending with aa”, “starting with b”, “containing 3 b”, “not containing bb”, “even number of a”, “length at least 3”.`;
  let m: RegExpMatchArray | null;

  // not containing X
  if ((m = p.match(/^(?:does\s*n[o']t\s+contain|do\s+not\s+contain|not\s+contain(?:ing|s)?|without|avoid(?:ing|s)?|free\s+of)\s+(?:the\s+)?(?:substring\s+)?(.+)$/))) {
    const w = parseString(m[1], sigma);
    return w ? { kind: 'notContains', w } : fail;
  }
  // starts / begins with
  if ((m = p.match(/^(?:start|begin)(?:s|ing|ning)?\s+with\s+(.+)$/))) {
    const w = parseString(m[1], sigma);
    return w ? { kind: 'startsWith', w } : fail;
  }
  // ends with
  if ((m = p.match(/^end(?:s|ing)?\s+(?:with|in)\s+(.+)$/))) {
    const w = parseString(m[1], sigma);
    return w ? { kind: 'endsWith', w } : fail;
  }
  // length parity / divisibility
  if ((m = p.match(/^(?:an?\s+|of\s+|having\s+|with\s+)?(even|odd)\s+length$|^(?:the\s+)?length\s+(?:is\s+)?(even|odd)$/))) {
    return { kind: 'lengthMod', m: 2, r: (m[1] ?? m[2]) === 'even' ? 0 : 1 };
  }
  if ((m = p.match(/^(?:of\s+|with\s+)?(?:the\s+)?length\s+(?:is\s+)?(?:divisible\s+by|a\s+multiple\s+of|multiple\s+of)\s+(\d+)$/))) {
    return { kind: 'lengthMod', m: parseInt(m[1], 10), r: 0 };
  }
  if ((m = p.match(/^(?:of\s+|with\s+|having\s+)?(?:the\s+)?(?:length|long)\s*(?:is|of|=)?\s*(exactly|at\s*least|at\s*most|more\s+than|less\s+than|fewer\s+than|greater\s+than|minimum|maximum|up\s+to)?\s*(\d+|[a-z]+)$/)) && toNum(m[2]) !== undefined) {
    const { op, delta } = opFrom(m[1]);
    return { kind: 'length', op, n: Math.max(0, toNum(m[2]) + delta) };
  }
  if ((m = p.match(new RegExp(`^(exactly|at\\s*least|at\\s*most)?\\s*${NUM}\\s+(?:symbols|characters|letters)\\s*long`)))) {
    const { op } = opFrom(m[1]);
    return { kind: 'length', op, n: toNum(m[2]) };
  }
  // parity / divisibility of a symbol count
  if ((m = p.match(/^(?:an?\s+|with\s+an?\s+|having\s+an?\s+|containing\s+an?\s+)?(even|odd)\s+(?:number\s+of\s+|no\.?\s+of\s+|count\s+of\s+)?(\S)(?:'?s)?$/)) && sigma.includes(m[2])) {
    return { kind: 'countMod', sym: m[2], m: 2, r: m[1] === 'even' ? 0 : 1 };
  }
  if ((m = p.match(/^(?:the\s+)?(?:number|no\.?|count)\s+of\s+(\S)(?:'?s)?\s+(?:is\s+)?(even|odd)$/)) && sigma.includes(m[1])) {
    return { kind: 'countMod', sym: m[1], m: 2, r: m[2] === 'even' ? 0 : 1 };
  }
  if ((m = p.match(/^(?:the\s+)?(?:number|no\.?|count)\s+of\s+(\S)(?:'?s)?\s+(?:is\s+)?(?:divisible\s+by|a\s+multiple\s+of|multiple\s+of)\s+(\d+)$/)) && sigma.includes(m[1])) {
    return { kind: 'countMod', sym: m[1], m: parseInt(m[2], 10), r: 0 };
  }
  // counts: "containing 3b", "exactly two a's", "at least 2 b", "no a", "number of a is 3"
  if ((m = p.match(/^(?:the\s+)?(?:number|no\.?|count)\s+of\s+(\S)(?:'?s)?\s+(?:is\s+)?(exactly|at\s*least|at\s*most|more\s+than|less\s+than)?\s*(\d+|[a-z]+)$/)) && sigma.includes(m[1]) && toNum(m[3]) !== undefined) {
    const { op, delta } = opFrom(m[2]);
    return { kind: 'count', sym: m[1], op, n: Math.max(0, toNum(m[3]) + delta) };
  }
  const countRe = new RegExp(`^(exactly|at\\s*least|at\\s*most|more\\s+than|less\\s+than|fewer\\s+than|greater\\s+than|minimum|maximum|up\\s+to|only)?\\s*${NUM}\\s*(\\S)(?:'?s)?(\\s+or\\s+more|\\s+or\\s+fewer|\\s+or\\s+less)?$`);
  const body = p.replace(/^(?:contain(?:s|ing)?|having|has|have|with)\s+/, '');
  if ((m = body.match(countRe)) && sigma.includes(m[3]) && toNum(m[2]) !== undefined) {
    // "containing aa" where the alphabet is {a,b} is a substring, not a count
    const asString = body.replace(/\s+/g, '');
    if (!Array.from(asString).every((ch) => sigma.includes(ch))) {
      const { op, delta } = opFrom(`${m[1] ?? ''} ${m[4] ?? ''}`);
      return { kind: 'count', sym: m[3], op, n: Math.max(0, toNum(m[2]) + delta) };
    }
  }
  if ((m = p.match(/^no\s+(\S)(?:'?s)?$/)) && sigma.includes(m[1])) return { kind: 'count', sym: m[1], op: 'exactly', n: 0 };
  // contains substring
  if ((m = p.match(/^(?:contain(?:s|ing)?|having|has|include(?:s|ing)?|with)\s+(?:the\s+)?(?:substring\s+)?(.+)$/))) {
    const w = parseString(m[1], sigma);
    return w ? { kind: 'contains', w } : fail;
  }
  return fail;
}

/** Common non-regular context-free patterns that map to the example grammars. */
function detectPattern(t: string): string | undefined {
  const s = t.replace(/\s+/g, '');
  if (/^anb2n$/.test(s)) return 'team6';
  if (/^ancbn$/.test(s)) return 'twovar';
  if (/^anbn$/.test(s)) return 'anbn';
  if (/palindrom/.test(s)) return 'pal';
  if (/equal(number|count)?(ofa'?s?andb|a'?s?andb|aandb)|#a=#b|na\(w\)=nb\(w\)/.test(s)) return 'equal';
  if (/balanced|parenthes|brackets/.test(s)) return 'brackets';
  if (/expression/.test(s)) return 'expr';
  return undefined;
}
