import { useEffect } from 'react';
import { SPEEDS, useLab, type Mode } from '../hooks/useLab';

const OP_COLOR = { init: '#475569', start: '#00F5FF', expand: '#FF2BD6', match: '#00F5FF', accept: '#B6FF00' } as const;

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'guided', label: 'Guided', hint: 'Explains every operation and the theory behind it' },
  { id: 'step', label: 'Step-by-step', hint: 'You advance each transition; compact explanations' },
  { id: 'auto', label: 'Automatic', hint: 'Runs at the chosen speed; pause any time' },
];

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

/** Time-travel debugger: transport buttons, speed, mode and a clickable timeline of snapshots. */
export function Controls({ keyboard = true }: { keyboard?: boolean }) {
  const lab = useLab();
  const { index, last, playing, snapshots, mode } = lab;

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); lab.next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); lab.prev(); }
      else if (e.key === 'Home') { e.preventDefault(); lab.setIndex(0); }
      else if (e.key === 'End') { e.preventDefault(); lab.setIndex(last); }
      else if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); if (playing) lab.pause(); else lab.play(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard, lab, last, playing]);

  return (
    <div className="flex flex-col gap-2 lg:gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5" role="group" aria-label="Playback">
          <button className="btn w-10 px-0" onClick={() => lab.setIndex(0)} disabled={index === 0} aria-label="Reset to the initial configuration" title="Reset (Home)"><Icon d="M6 5v14M18 6l-8 6 8 6z" /></button>
          <button className="btn w-10 px-0" onClick={lab.prev} disabled={index === 0} aria-label="Step backward" title="Step backward (←)"><Icon d="M15 6l-6 6 6 6" /></button>
          {playing ? (
            <button className="btn btn-primary w-24" onClick={lab.pause} aria-label="Pause"><Icon d="M8 5v14M16 5v14" />Pause</button>
          ) : (
            <button className="btn btn-primary w-24" onClick={lab.play} aria-label={index >= last ? 'Replay from the start' : 'Play'} title="Play / pause (Space)">
              <Icon d="M7 5l12 7-12 7z" />{index >= last ? 'Replay' : 'Play'}
            </button>
          )}
          <button className="btn w-10 px-0" onClick={lab.next} disabled={index >= last} aria-label="Step forward" title="Step forward (→)"><Icon d="M9 6l6 6-6 6" /></button>
          <button className="btn w-10 px-0" onClick={() => lab.setIndex(last)} disabled={index >= last} aria-label="Jump to the final configuration" title="End (End)"><Icon d="M18 5v14M6 6l8 6-8 6z" /></button>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
          <span className="label mr-1 hidden sm:inline">Speed</span>
          {SPEEDS.map((s, i) => (
            <button key={s.label} className={`btn min-h-[32px] px-2 text-xs ${lab.speed === i ? 'border-cyan/60 text-cyan' : ''}`} aria-pressed={lab.speed === i} onClick={() => lab.setSpeed(i)}>{s.label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1" role="radiogroup" aria-label="Simulation mode">
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={mode === m.id} title={m.hint}
              className={`btn min-h-[32px] px-2 text-xs ${mode === m.id ? 'border-violet text-[#C4B5FD] bg-violet/10' : ''}`}
              onClick={() => { lab.setMode(m.id); if (m.id !== 'auto') lab.pause(); }}>{m.label}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="math tabular w-24 shrink-0 text-xs text-slate">move {index} / {last}</span>
        <div className="flex h-7 min-w-0 flex-1 items-stretch gap-[2px]" role="group" aria-label="Timeline">
          {snapshots.map((s, i) => (
            <button key={i} onClick={() => lab.setIndex(i)} aria-label={`Go to move ${i}: ${s.explanation.operation}`} aria-current={i === index ? 'step' : undefined}
              className="group relative min-w-[3px] flex-1 rounded-[2px] outline-none"
              style={{ background: i <= index ? OP_COLOR[s.op] : '#1F2A3D', opacity: i === index ? 1 : i < index ? 0.55 : 1 }}>
              {i === index && <span className="absolute -inset-y-1 inset-x-0 rounded-[2px] ring-2 ring-ink" />}
            </button>
          ))}
        </div>
      </div>
      <div className="hidden flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate lg:flex">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-magenta" />expand</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-cyan" />match / start</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-lime" />accept</span>
        <span className="hidden sm:inline">Keys: ← → step · Space play/pause · Home/End</span>
      </div>
    </div>
  );
}
