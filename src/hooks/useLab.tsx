import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

/** The language the person described (or was given), kept apart from the grammar so edits to the productions can be checked against it. */
export interface Target { sigma: string[]; summary: string; accepts: (w: string) => boolean }

export type View = 'home' | 'workspace' | 'docs';
/** tabs inside the workspace: the run itself, the parse tree, and the formal theory */
export type Tab = 'simulate' | 'derivation' | 'theory';
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
  // old links (#simulation, #grammar, ...) still land in the right place
  const initial = (() => {
    const h = typeof location !== 'undefined' ? location.hash.slice(1) : '';
    const map: Record<string, [View, Tab]> = {
      home: ['home', 'simulate'], overview: ['home', 'simulate'],
      workspace: ['workspace', 'simulate'], simulation: ['workspace', 'simulate'],
      derivation: ['workspace', 'derivation'],
      grammar: ['workspace', 'theory'], automaton: ['workspace', 'theory'],
      docs: ['docs', 'simulate'],
    };
    return map[h] ?? (['home', 'simulate'] as [View, Tab]);
  })();
  const [view, setView] = useState<View>(initial[0]);
  const [tab, setTab] = useState<Tab>(initial[1]);
  const [advanced, setAdvanced] = useState(false);
  const [grammarText, setGrammarTextRaw] = useState(DEFAULT.grammar);
  const [presetId, setPresetId] = useState<string | null>(DEFAULT.id);
  const [customLang, setCustomLang] = useState<BuiltLanguage | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
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

  // Reset the timeline whenever the computation changes. startRun() asks for the reset to
  // be followed by playback; the token also forces a restart when nothing else changed.
  const autoPlay = useRef(false);
  const [runToken, setRunToken] = useState(0);
  useEffect(() => { setIndexRaw(0); setPlaying(autoPlay.current); autoPlay.current = false; }, [sim, runToken]);

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
  /** restart the current computation from move 0 and play it (also after the input or grammar changed) */
  const startRun = useCallback(() => {
    autoPlay.current = true;
    setMode('auto');
    setRunToken((t) => t + 1);
  }, []);
  const openWorkspace = useCallback((t: Tab = 'simulate', showAdvanced = false) => {
    setView('workspace');
    setTab(t);
    if (showAdvanced) setAdvanced(true);
    try { window.scrollTo({ top: 0 }); } catch { /* sandboxed */ }
  }, []);

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
    setTarget(lang);
    setLeaf(undefined);
    setInputRaw(w ?? lang.preset.valid[Math.min(2, lang.preset.valid.length - 1)] ?? '');
  }, []);
  /** expected membership according to the description (only for built languages) */
  const membership = useMemo(
    () => (target ? target.accepts : null),
    [target],
  );
  const applyPreset = useCallback((id: string, w?: string) => {
    const p = presetById(id)!;
    loadGrammar(p.grammar, id);
    setTarget(null);
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
    view, setView, tab, setTab, advanced, setAdvanced, openWorkspace, mode, setMode,
    grammarText, presetId, preset, loadGrammar, applyPreset, parsed, customLang, loadLanguage, membership, target, setTarget,
    g, pda, notes,
    input, w, setInput, outsideAlphabet,
    result, sim, snapshots, snapshot, leaf, pickLeaf,
    index, setIndex, next, prev, play, pause, startRun, playing, atEnd, last,
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
