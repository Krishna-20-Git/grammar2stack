import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildPDA,
  buildSimulation,
  DEFAULT_BOUNDS,
  type BuiltLanguage,
  parseGrammar,
  presetById,
  PRESETS,
  search,
  type Grammar,
  type PDA,
  type SearchResult,
  type Snapshot,
} from '../core';

/**
 * Animation / application controller. Holds the applied grammar and input,
 * derives the PDA, search result and snapshots from them (pure core calls), and
 * owns the timeline position. Every view reads the same snapshot, so the tape,
 * state diagram, stack, table and explanation always come from one step.
 */

export type View = 'overview' | 'grammar' | 'automaton' | 'simulation' | 'derivation' | 'docs';
export type Mode = 'guided' | 'step' | 'auto';
export type Status = 'ready' | 'running' | 'paused' | 'accepted' | 'rejected' | 'inconclusive';

export const SPEEDS = [
  { label: '0.5×', ms: 1800 },
  { label: '1×', ms: 1100 },
  { label: '2×', ms: 600 },
  { label: '4×', ms: 300 },
];

const DEFAULT = PRESETS[0];

function useLabState() {
  const [view, setView] = useState<View>(() => {
    const h = typeof location !== 'undefined' ? location.hash.slice(1) : '';
    return (['overview', 'grammar', 'automaton', 'simulation', 'derivation', 'docs'] as View[]).includes(h as View) ? (h as View) : 'overview';
  });
  const [grammarText, setGrammarTextRaw] = useState(DEFAULT.grammar);
  const [presetId, setPresetId] = useState<string | null>(DEFAULT.id);
  const [customLang, setCustomLang] = useState<BuiltLanguage | null>(null);
  const [input, setInputRaw] = useState(DEFAULT.valid[0]);
  const [leaf, setLeaf] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState<Mode>('guided');
  const [rawIndex, setIndexRaw] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const parsed = useMemo(() => parseGrammar(grammarText), [grammarText]);
  // the editor only applies valid grammars; the fallback is a safety net
  const g: Grammar = useMemo(
    () => (parsed.ok ? parsed.grammar : (parseGrammar(DEFAULT.grammar) as { ok: true; grammar: Grammar }).grammar),
    [parsed],
  );
  const pda: PDA = useMemo(() => buildPDA(g), [g]);
  const preset = customLang ? customLang.preset : presetId ? presetById(presetId) : undefined;
  const notes = preset?.notes;
  const w = useMemo(() => Array.from(input), [input]);
  const result: SearchResult = useMemo(() => search(g, pda, w, DEFAULT_BOUNDS), [g, pda, w]);
  const sim = useMemo(() => buildSimulation(g, pda, result, leaf, notes), [g, pda, result, leaf, notes]);
  const snapshots = sim.snapshots;
  const last = snapshots.length - 1;
  // clamp: when the computation changes, the stored index may briefly exceed the new length
  const index = Math.min(rawIndex, last);
  const snapshot: Snapshot = snapshots[index];

  // reset the timeline whenever the computation changes
  useEffect(() => { setIndexRaw(0); setPlaying(false); }, [sim]);

  // automatic playback: one deterministic snapshot per tick
  useEffect(() => {
    if (!playing) return;
    if (index >= last) { setPlaying(false); return; }
    const id = window.setTimeout(() => setIndexRaw((i) => Math.min(i + 1, last)), SPEEDS[speed].ms);
    return () => window.clearTimeout(id);
  }, [playing, index, last, speed]);

  useEffect(() => {
    try { history.replaceState(null, '', `#${view}`); } catch { /* sandboxed */ }
  }, [view]);

  const setIndex = useCallback((i: number) => { setPlaying(false); setIndexRaw(Math.max(0, Math.min(i, last))); }, [last]);
  const next = useCallback(() => { setPlaying(false); setIndexRaw((i) => Math.min(i + 1, last)); }, [last]);
  const prev = useCallback(() => { setPlaying(false); setIndexRaw((i) => Math.max(i - 1, 0)); }, []);
  const play = useCallback(() => {
    setMode('auto');
    setIndexRaw((i) => (i >= last ? 0 : i));
    setPlaying(true);
  }, [last]);
  const pause = useCallback(() => setPlaying(false), []);

  const loadGrammar = useCallback((text: string, pid: string | null = null) => {
    setGrammarTextRaw(text);
    setPresetId(pid);
    setCustomLang(null);
    setLeaf(undefined);
  }, []);
  /** load a language built from a description (grammar generated automatically) */
  const loadLanguage = useCallback((lang: BuiltLanguage, w?: string) => {
    setGrammarTextRaw(lang.grammarText);
    setPresetId(null);
    setCustomLang(lang);
    setLeaf(undefined);
    setInputRaw(w ?? lang.preset.valid[Math.min(2, lang.preset.valid.length - 1)] ?? '');
  }, []);
  /** expected membership according to the description (only for built languages) */
  const membership = useMemo(
    () => (customLang ? customLang.accepts : null),
    [customLang],
  );
  const applyPreset = useCallback((id: string, w?: string) => {
    const p = presetById(id)!;
    loadGrammar(p.grammar, id);
    setInputRaw(w ?? p.valid[0]);
  }, [loadGrammar]);
  const setInput = useCallback((s: string) => { setInputRaw(s); setLeaf(undefined); }, []);
  const pickLeaf = useCallback((id: number | undefined) => setLeaf(id), []);

  const atEnd = index >= last;
  let status: Status;
  if (playing) status = 'running';
  else if (atEnd) status = result.verdict.kind;
  else if (index === 0) status = 'ready';
  else status = 'paused';

  const outsideAlphabet = w.filter((c) => !g.terminals.includes(c));

  return {
    view, setView, mode, setMode,
    grammarText, presetId, preset, loadGrammar, applyPreset, parsed, customLang, loadLanguage, membership,
    g, pda, notes,
    input, w, setInput, outsideAlphabet,
    result, sim, snapshots, snapshot, leaf, pickLeaf,
    index, setIndex, next, prev, play, pause, playing, atEnd, last,
    speed, setSpeed, status,
  };
}

export type Lab = ReturnType<typeof useLabState>;
const LabContext = createContext<Lab | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const lab = useLabState();
  return <LabContext.Provider value={lab}>{children}</LabContext.Provider>;
}

export function useLab(): Lab {
  const lab = useContext(LabContext);
  if (!lab) throw new Error('useLab outside LabProvider');
  return lab;
}
