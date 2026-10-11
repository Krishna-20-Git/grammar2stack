import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';
import { edgeLabel, type PDA, type StateId, type Transition, type TransitionKind } from '../core';

export type Selection = { type: 'state'; id: StateId } | { type: 'transition'; id: number } | null;

interface Props {
  pda: PDA;
  currentState: StateId;
  active: Transition | null;
  /** changes on every step so the travelling highlight restarts */
  stepKey: number;
  selection: Selection;
  onSelect: (s: Selection) => void;
  compact?: boolean;
}

export const KIND_COLOR: Record<TransitionKind, string> = {
  start: '#00F5FF',
  expand: '#FF2BD6',
  match: '#00F5FF',
  accept: '#B6FF00',
};

const R = 30;

/**
 * SVG state diagram of the three-state CFG→PDA construction.
 * States: q0 (initial), q1 (simulation loop), q2 (final). All expand/match
 * transitions are self-loops on q1; their labels are listed above the loop.
 */
export function StateDiagram({ pda, currentState, active, stepKey, selection, onSelect, compact }: Props) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const expands = pda.transitions.filter((t) => t.kind === 'expand');
  const matches = pda.transitions.filter((t) => t.kind === 'match');
  const start = pda.transitions.find((t) => t.kind === 'start')!;
  const accept = pda.transitions.find((t) => t.kind === 'accept')!;

  const rowH = compact ? 19 : 22;
  const rows = Math.max(expands.length, matches.length);
  const labelTop = 30;
  const labelBottom = labelTop + rows * rowH;
  const Y = labelBottom + 120;
  const H = Y + 64;
  const W = 760;
  const X = { q0: 100, q1: 380, q2: 660 } as const;

  const loopPath = `M ${X.q1 - 20} ${Y - 23} C ${X.q1 - 70} ${Y - 118}, ${X.q1 + 70} ${Y - 118}, ${X.q1 + 20} ${Y - 23}`;
  const startPath = `M ${X.q0 + R} ${Y} L ${X.q1 - R - 2} ${Y}`;
  const acceptPath = `M ${X.q1 + R} ${Y} L ${X.q2 - R - 6} ${Y}`;
  const pathFor = (t: Transition) => (t.kind === 'start' ? startPath : t.kind === 'accept' ? acceptPath : loopPath);

  const isSel = (t: Transition) => selection?.type === 'transition' && selection.id === t.id;
  const isActive = (t: Transition) => active?.id === t.id;
  const edgeActive = (k: 'start' | 'loop' | 'accept') =>
    active && (k === 'loop' ? active.kind === 'expand' || active.kind === 'match' : active.kind === k);

  const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  };

  const label = (t: Transition, x: number, y: number, anchor: 'start' | 'end' | 'middle') => {
    const text = edgeLabel(t);
    const on = isActive(t);
    const sel = isSel(t);
    const w = text.length * (compact ? 7.4 : 8.2) + 12;
    const rx = anchor === 'end' ? x - w + 6 : anchor === 'middle' ? x - w / 2 : x - 6;
    return (
      <g
        key={t.id}
        role="button"
        tabIndex={0}
        aria-label={`Transition ${text}${on ? ', active' : ''}`}
        onClick={() => onSelect({ type: 'transition', id: t.id })}
        onKeyDown={keyAct(() => onSelect({ type: 'transition', id: t.id }))}
        className="cursor-pointer outline-none"
      >
        <rect x={rx} y={y - rowH / 2 - 1} width={w} height={rowH - 2} rx={3}
          fill={on ? KIND_COLOR[t.kind] + '26' : 'transparent'}
          stroke={sel ? '#8B5CFF' : on ? KIND_COLOR[t.kind] : 'transparent'} strokeWidth={1.2} />
        <text x={x} y={y} textAnchor={anchor} dominantBaseline="central"
          className="math" fontSize={compact ? 12.5 : 14} fontWeight={on ? 700 : 500}
          fill={on ? KIND_COLOR[t.kind] : t.kind === 'expand' ? '#F5A9E8' : t.kind === 'match' ? '#9EEFF2' : '#CBD5E1'}>
          {text}
        </text>
      </g>
    );
  };

  const state = (id: StateId, x: number) => {
    const current = currentState === id;
    const final = pda.finalStates.includes(id);
    const sel = selection?.type === 'state' && selection.id === id;
    const role = id === 'q0' ? 'initial state' : id === 'q1' ? 'loop state' : 'final state';
    return (
      <g key={id} role="button" tabIndex={0} aria-label={`State ${id}, ${role}${current ? ', current' : ''}`}
        onClick={() => onSelect({ type: 'state', id })} onKeyDown={keyAct(() => onSelect({ type: 'state', id }))}
        className="cursor-pointer outline-none">
        {current && (
          <motion.circle cx={x} cy={Y} r={R + 9} fill="none" stroke="#00F5FF" strokeWidth={2}
            initial={reduce ? false : { opacity: 0, r: R + 2 }} animate={{ opacity: 0.85, r: R + 9 }}
            style={{ filter: 'drop-shadow(0 0 6px #00F5FF)' }} />
        )}
        <circle cx={x} cy={Y} r={R} fill={current ? '#062A30' : '#0D1220'} stroke={sel ? '#8B5CFF' : current ? '#00F5FF' : '#475569'} strokeWidth={sel ? 3 : 2} />
        {final && <circle cx={x} cy={Y} r={R - 6} fill="none" stroke="#B6FF00" strokeWidth={1.6} />}
        <text x={x} y={Y} textAnchor="middle" dominantBaseline="central" className="math" fontSize={18} fontWeight={700} fill={current ? '#00F5FF' : '#F1F5F9'}>{id}</text>
        <text x={x} y={Y + R + 18} textAnchor="middle" fontSize={11} fill="#94A3B8" className="font-display" letterSpacing="0.08em">
          {id === 'q0' ? 'START' : id === 'q1' ? 'SIMULATE' : 'ACCEPT'}
        </text>
      </g>
    );
  };

  const edge = (k: 'start' | 'loop' | 'accept', d: string, t: Transition) => {
    const on = edgeActive(k);
    const color = on && active ? KIND_COLOR[active.kind] : '#475569';
    const marker = on && active ? `${uid}-${active.kind}` : `${uid}-idle`;
    return (
      <g role="button" tabIndex={-1} onClick={() => onSelect({ type: 'transition', id: t.id })} className="cursor-pointer">
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
        <path d={d} fill="none" stroke={color} strokeWidth={on ? 2.6 : 1.8} markerEnd={`url(#${marker})`} className={on ? 'edge-active' : ''} style={{ color }} />
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="PDA state diagram: q0 to q1 to final state q2, with expand and match loops on q1">
      <defs>
        {(['idle', 'start', 'expand', 'match', 'accept'] as const).map((k) => (
          <marker key={k} id={`${uid}-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={k === 'idle' ? '#475569' : KIND_COLOR[k]} />
          </marker>
        ))}
      </defs>

      {/* label columns */}
      <text x={X.q1 - 14} y={labelTop - 12} textAnchor="end" fontSize={10.5} fill="#FF2BD6" className="font-display" letterSpacing="0.12em">EXPAND · ε-MOVES</text>
      <text x={X.q1 + 14} y={labelTop - 12} textAnchor="start" fontSize={10.5} fill="#00F5FF" className="font-display" letterSpacing="0.12em">MATCH · READ INPUT</text>
      {expands.map((t, i) => label(t, X.q1 - 14, labelTop + 8 + i * rowH, 'end'))}
      {matches.map((t, i) => label(t, X.q1 + 14, labelTop + 8 + i * rowH, 'start'))}
      <line x1={X.q1} y1={labelBottom + 4} x2={X.q1} y2={Y - 94} stroke="#8B5CFF" strokeDasharray="3 4" strokeWidth={1.2} />

      {/* initial arrow */}
      <line x1={18} y1={Y} x2={X.q0 - R - 4} y2={Y} stroke="#94A3B8" strokeWidth={1.8} markerEnd={`url(#${uid}-idle)`} />

      {edge('start', startPath, start)}
      {edge('loop', loopPath, expands[0] ?? matches[0] ?? start)}
      {edge('accept', acceptPath, accept)}
      {label(start, (X.q0 + X.q1) / 2, Y - 18, 'middle')}
      {label(accept, (X.q1 + X.q2) / 2, Y - 18, 'middle')}

      {/* travelling highlight along the active edge */}
      {active && !reduce && (
        <circle key={stepKey} r={5} fill={KIND_COLOR[active.kind]} style={{ filter: `drop-shadow(0 0 6px ${KIND_COLOR[active.kind]})` }}>
          <animateMotion dur="0.7s" fill="freeze" path={pathFor(active)} />
        </circle>
      )}

      {state('q0', X.q0)}
      {state('q1', X.q1)}
      {state('q2', X.q2)}
    </svg>
  );
}
