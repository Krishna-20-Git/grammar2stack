import type { Grammar, GrammarError, ParseResult, Production, Sym } from './types';

/**
 * Grammar parser and validator.
 *
 * Syntax (one variable per line):
 *   S → aSb | ε
 *   A -> aA | b
 *
 * - The left-hand side is a single capital letter (a variable).
 * - Alternatives are separated by `|`.
 * - Every other non-space character on the right is one symbol: capital letters
 *   are variables, anything else is a terminal.
 * - The empty string is written ε, λ, `eps`, or as an empty alternative.
 * - The left-hand side of the first line is the start symbol.
 */

const ARROW = /->|→|::=/;
const EPSILON_WORDS = new Set(['ε', 'λ', 'eps', 'epsilon']);
const RESERVED = new Set(['|', 'ε', 'λ', '→']);

export const isVariable = (s: Sym): boolean => /^[A-Z]$/.test(s);

export function parseGrammar(text: string): ParseResult {
  const errors: GrammarError[] = [];
  const productions: Production[] = [];
  const variables: Sym[] = [];
  const terminals: Sym[] = [];
  const used = new Map<Sym, number>(); // variable → first line used on a right-hand side

  const lines = text.split(/\r?\n/);
  let sawLine = false;

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    sawLine = true;

    const parts = line.split(ARROW);
    if (parts.length === 1) {
      errors.push({ line: lineNo, message: `Line ${lineNo}: a production needs an arrow. Write it in the form A → α, for example S → aSb.` });
      return;
    }
    if (parts.length > 2) {
      errors.push({ line: lineNo, message: `Line ${lineNo}: only one arrow is allowed per line. Put alternatives for the same variable after a single arrow, separated by |.` });
      return;
    }
    const lhs = parts[0].trim();
    if (!lhs) {
      errors.push({ line: lineNo, message: `Line ${lineNo}: the left-hand side is empty. A context-free production has exactly one variable on the left.` });
      return;
    }
    if (!isVariable(lhs)) {
      const why = lhs.length > 1
        ? 'it contains more than one symbol, which would make the grammar not context-free'
        : 'it is not a capital letter, so it would be read as a terminal';
      errors.push({ line: lineNo, message: `Line ${lineNo}: "${lhs}" cannot be a left-hand side because ${why}. Use a single capital letter such as S or A.` });
      return;
    }
    if (!variables.includes(lhs)) variables.push(lhs);

    parts[1].split('|').forEach((alt) => {
      const compact = alt.replace(/\s+/g, '');
      let rhs: Sym[];
      if (compact === '' || EPSILON_WORDS.has(compact)) rhs = [];
      else {
        if (/[ελ]/.test(compact)) {
          errors.push({ line: lineNo, message: `Line ${lineNo}: ε may only appear on its own as an alternative (as in S → aSb | ε), not inside "${compact}". ε denotes the empty string, so writing it next to other symbols adds nothing.` });
          return;
        }
        rhs = Array.from(compact);
        const bad = rhs.find((s) => RESERVED.has(s));
        if (bad) {
          errors.push({ line: lineNo, message: `Line ${lineNo}: "${bad}" is reserved notation and cannot be used as a grammar symbol.` });
          return;
        }
      }
      for (const s of rhs) {
        if (isVariable(s)) {
          if (!used.has(s)) used.set(s, lineNo);
        } else if (!terminals.includes(s)) terminals.push(s);
      }
      const dup = productions.some((p) => p.lhs === lhs && p.rhs.join('') === rhs.join(''));
      if (!dup) productions.push({ id: productions.length, lhs, rhs });
    });
  });

  if (!sawLine) errors.push({ line: 0, message: 'The grammar is empty. Enter at least one production, for example S → aSb | ε.' });

  for (const [v, line] of used) {
    if (!variables.includes(v)) {
      errors.push({ line, message: `Line ${line}: the variable ${v} appears on a right-hand side but has no productions of its own. Every variable must have at least one rule, otherwise sentential forms containing ${v} can never become terminal strings. Add a line such as ${v} → … .` });
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, grammar: { variables, terminals, productions, start: variables[0] } };
}

/* ------------------------------------------------------------ helpers */

export const showRhs = (rhs: Sym[]): string => (rhs.length ? rhs.join('') : 'ε');
export const showProduction = (p: Production): string => `${p.lhs} → ${showRhs(p.rhs)}`;

export function grammarToText(g: Grammar): string {
  return g.variables
    .map((v) => `${v} → ${g.productions.filter((p) => p.lhs === v).map((p) => showRhs(p.rhs)).join(' | ')}`)
    .join('\n');
}

/** Variables that can derive ε (used in documentation of the search bound). */
export function nullableVariables(g: Grammar): Set<Sym> {
  const nullable = new Set<Sym>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of g.productions) {
      if (!nullable.has(p.lhs) && p.rhs.every((s) => nullable.has(s))) {
        nullable.add(p.lhs);
        changed = true;
      }
    }
  }
  return nullable;
}

/**
 * Shortest strings of L(G), found by breadth-first leftmost derivation.
 * Bounded, so it always terminates.
 */
export function sampleStrings(g: Grammar, count = 6, maxLen = 10): string[] {
  const queue: Sym[][] = [[g.start]];
  const seen = new Set<string>([g.start]);
  const found = new Set<string>();
  let steps = 0;
  while (queue.length && found.size < count && steps < 20000) {
    steps++;
    const form = queue.shift()!;
    const k = form.findIndex(isVariable);
    if (k < 0) {
      found.add(form.join(''));
      continue;
    }
    for (const p of g.productions) {
      if (p.lhs !== form[k]) continue;
      const next = [...form.slice(0, k), ...p.rhs, ...form.slice(k + 1)];
      const terminalsInForm = next.filter((s) => !isVariable(s)).length;
      const key = next.join('');
      if (terminalsInForm > maxLen || next.length > maxLen + 6 || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return [...found].sort((a, b) => a.length - b.length || a.localeCompare(b));
}
