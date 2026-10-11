import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BOTTOM, isVariable, type Snapshot } from '../core';

const opInfo = (s: Snapshot) => {
  switch (s.op) {
    case 'init': return { tag: 'INIT', text: `Stack initialised with ${BOTTOM}`, color: '#94A3B8' };
    case 'start': return { tag: 'PUSH', text: `Push start symbol above ${BOTTOM}`, color: '#00F5FF' };
    case 'expand': return s.pushed.length
      ? { tag: 'REPLACE', text: `Replace ${s.popped!.sym} with ${s.transition!.push.join('')}`, color: '#FF2BD6' }
      : { tag: 'POP', text: `Pop ${s.popped!.sym} (production to ε)`, color: '#FF2BD6' };
    case 'match': return { tag: 'POP', text: `Pop matched terminal ${s.popped!.sym}`, color: '#00F5FF' };
    case 'accept': return { tag: 'POP', text: `Pop ${BOTTOM}: stack empty`, color: '#B6FF00' };
  }
};

function styleFor(sym: string) {
  if (sym === BOTTOM) return { border: '#8B5CFF', bg: 'rgba(139,92,255,0.14)', fg: '#C4B5FD', kind: 'bottom marker' };
  if (isVariable(sym)) return { border: '#FF2BD6', bg: 'rgba(255,43,214,0.12)', fg: '#FFB8F1', kind: 'variable' };
  return { border: '#00F5FF', bg: 'rgba(0,245,255,0.10)', fg: '#A5FBFF', kind: 'terminal' };
}

/** Short radial burst beside the top of the stack. Never overlaps the symbols. */
function Burst({ color }: { color: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const dots = Array.from({ length: 10 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const angle = ((i >> 1) / 4 - 0.5) * 1.2;
    return { dx: side * (26 + (i % 3) * 10) * Math.cos(angle), dy: -14 + Math.sin(angle) * 26, side };
  });
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1 h-0" aria-hidden="true">
      {dots.map((d, i) => (
        <motion.span key={i} className="absolute top-3 h-1 w-1 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}`, [d.side > 0 ? 'right' : 'left']: '-6px' } as React.CSSProperties}
          initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: d.dx, y: d.dy, scale: 0.4 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 * (i % 3) }} />
      ))}
    </div>
  );
}

export function StackView({ snapshot, rejected, height = 360 }: { snapshot: Snapshot; rejected?: boolean; height?: number }) {
  const reduce = useReducedMotion();
  const info = opInfo(snapshot);
  const consuming = snapshot.consumed !== null;
  const pushedIdx = new Map(snapshot.pushed.map((uid, k) => [uid, k]));
  const nPushed = snapshot.pushed.length;
  const burstColor = rejected ? '#FF3B4F' : snapshot.op === 'accept' ? '#B6FF00' : snapshot.op === 'expand' ? '#FF2BD6' : '#00F5FF';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip" style={{ background: info.color + '22', color: info.color }}>{info.tag}</span>
        {snapshot.op !== 'init' && (
          <span className={`chip ${consuming ? 'bg-cyan/10 text-cyan' : 'bg-violet/15 text-[#C4B5FD]'}`}>
            {consuming ? `reads ${snapshot.consumed}` : <><span className="normal-case">ε</span>-move</>}
          </span>
        )}
        <span className="text-xs text-slate">{info.text}</span>
      </div>

      <div className="relative mx-auto w-full max-w-[220px]">
        {snapshot.op !== 'init' && <Burst key={snapshot.index} color={burstColor} />}
        <div
          className="scroll-thin relative flex flex-col gap-1 overflow-y-auto rounded-b-md border-x-2 border-b-2 border-slate-deep px-3 pb-3 pt-2"
          style={{ height }}
          aria-label={`Stack, top first: ${snapshot.stack.map((s) => s.sym).join(' ') || 'empty'}`}
          role="list"
        >
          <div className="mt-auto" />
          <AnimatePresence initial={false} mode="popLayout">
            {snapshot.stack.map((item, i) => {
              const st = styleFor(item.sym);
              const k = pushedIdx.get(item.uid);
              const isNew = k !== undefined;
              return (
                <motion.div
                  key={item.uid}
                  layout={!reduce}
                  role="listitem"
                  initial={reduce ? false : { y: -42, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: -30, opacity: 0, transition: { duration: 0.26 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32, delay: isNew ? (nPushed - 1 - k!) * 0.09 : 0 }}
                  className="relative flex h-[34px] shrink-0 items-center justify-center rounded-[3px] border-2 font-mono text-lg font-bold"
                  style={{ borderColor: st.border, background: st.bg, color: st.fg, boxShadow: i === 0 ? `0 0 14px -4px ${st.border}` : undefined }}
                  title={st.kind}
                >
                  {item.sym}
                  {i === 0 && (
                    <span className="absolute left-2 font-display text-[9.5px] font-semibold tracking-widest text-cyan">TOP</span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {snapshot.stack.length === 0 && (
            <div className="mb-2 text-center font-mono text-lg font-bold text-lime">∅ empty</div>
          )}
        </div>
        <div className="mt-1 text-center font-display text-[10px] tracking-widest text-slate-deep">BOTTOM</div>
      </div>

      <div className="rounded border border-edge bg-void/70 px-3 py-2">
        <div className="label">Stack contents (top first)</div>
        <div className="math break-all text-[15px] text-ink">γ = {snapshot.stack.map((s) => s.sym).join('') || 'ε'}</div>
      </div>
    </div>
  );
}
