import { motion, useReducedMotion } from 'framer-motion';
import type { Snapshot } from '../core';

export function InputTape({ input, snapshot, prevPos }: { input: string[]; snapshot: Snapshot; prevPos: number }) {
  const reduce = useReducedMotion();
  const pos = snapshot.config.pos;
  const epsMove = snapshot.op !== 'init' && snapshot.consumed === null;
  const cells = [...input, '⊣'];

  return (
    <div className="flex flex-col gap-2">
      <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-7 pt-1" role="list" aria-label={`Input tape. ${pos} of ${input.length} symbols read.`}>
        {cells.map((ch, i) => {
          const isEnd = i === input.length;
          const consumed = i < pos;
          const current = i === pos;
          const justRead = snapshot.consumed !== null && i === prevPos;
          return (
            <div key={i} role="listitem" className="relative shrink-0">
              <motion.div
                className={`flex h-12 w-11 items-center justify-center rounded-[3px] border-2 font-mono text-xl font-bold transition-colors ${
                  isEnd ? 'border-dashed text-sm text-slate-deep' : ''
                } ${current ? 'border-cyan bg-cyan/10 text-cyan' : consumed ? 'border-edge bg-void text-slate-deep' : 'border-slate-deep bg-panel2 text-ink'}`}
                style={current ? { boxShadow: '0 0 16px -4px #00F5FF' } : undefined}
                animate={justRead && !reduce ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
                aria-label={isEnd ? 'end of input' : `${ch}, ${consumed ? 'consumed' : current ? 'next symbol' : 'unread'}`}
              >
                {ch}
              </motion.div>
              {consumed && !isEnd && <span className="absolute right-1 top-0.5 text-[10px] text-cyan/70" aria-hidden="true">✓</span>}
              <span className="absolute -bottom-0 left-0 right-0 text-center font-mono text-[10px] text-slate-deep" aria-hidden="true">{isEnd ? '' : i + 1}</span>
              {current && (
                <motion.div layoutId="tape-head" className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-display text-[10px] font-semibold tracking-widest text-cyan"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
                  ▲ HEAD
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate">
        <span>Read: <span className="math text-ink">{input.slice(0, pos).join('') || 'ε'}</span></span>
        <span>Unread: <span className="math text-ink">{input.slice(pos).join('') || 'ε'}</span></span>
        {epsMove && (
          <motion.span key={snapshot.index} initial={reduce ? false : { opacity: 0.2 }} animate={{ opacity: 1 }} className="text-[#C4B5FD]">
            ε-move: no symbol consumed, pointer stays at position {pos + 1 > input.length ? 'end' : pos + 1}
          </motion.span>
        )}
        {snapshot.consumed !== null && <span className="text-cyan">consumed {snapshot.consumed}, pointer advanced</span>}
      </div>
    </div>
  );
}
