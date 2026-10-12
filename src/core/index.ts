import { parseGrammar } from './grammar';
import { buildPDA } from './pda';
import { DEFAULT_BOUNDS, search } from './search';
import { buildSimulation } from './simulation';
import type { SearchBounds } from './types';

export * from './types';
export * from './grammar';
export * from './pda';
export * from './engine';
export * from './search';
export * from './simulation';
export * from './derivation';
export * from './explain';
export * from './presets';

/** Convenience: grammar text + input → everything needed to display a run. */
export function runAll(grammarText: string, input: string, bounds: SearchBounds = DEFAULT_BOUNDS, notes?: Record<string, string>) {
  const parsed = parseGrammar(grammarText);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors };
  const g = parsed.grammar;
  const pda = buildPDA(g);
  const w = Array.from(input);
  const result = search(g, pda, w, bounds);
  const sim = buildSimulation(g, pda, result, undefined, notes);
  return { ok: true as const, g, pda, result, sim };
}
export * from './language';
export * from './compare';
