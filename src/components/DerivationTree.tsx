import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { buildParseTree, layoutTree, showRhs } from '../core';
import { useLab } from '../hooks/useLab';

/**
 * Derivation tree rebuilt from the PDA computation up to the current step.
 * Children appear when their parent is expanded; leaves fill in when matched.
 */
export function DerivationTree({ maxHeight = 460 }: { maxHeight?: number }) {
  const { g, snapshots, index, snapshot } = useLab();
  const reduce = useReducedMotion();
  const tree = useMemo(() => buildParseTree(g, snapshots, index), [g, snapshots, index]);
  const lay = useMemo(() => layoutTree(tree), [tree]);
  const DX = 50, DY = 66, PAD = 30;
  const W = Math.max(lay.width, 1) * DX + PAD * 2 - DX + 20;
  const H = (lay.depth + 1) * DY + 20;
  const pos = (n: { x: number; y: number }) => ({ cx: PAD + 10 + n.x * DX, cy: 30 + n.y * DY });
  const byId = new Map(lay.nodes.map((n) => [n.id, n]));
  const prod = snapshot.op === 'expand' ? g.productions[snapshot.transition!.productionId!] : null;

  if (!tree.root) {
    return <div className="flex min-h-[160px] items-center justify-center rounded border border-dashed border-edge text-sm text-slate">The tree begins when the start symbol is pushed (move 1).</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-slate" aria-live="polite">
        {prod ? <>Applying <span className="math font-bold text-magenta">{prod.lhs} → {showRhs(prod.rhs)}</span>: the node {prod.lhs} receives {prod.rhs.length ? `${prod.rhs.length} children` : 'a single ε child'}.</>
          : snapshot.op === 'match' ? <>Leaf <span className="math font-bold text-cyan">{snapshot.consumed}</span> verified against the input (matching does not change the tree).</>
          : snapshot.op === 'accept' ? <>Complete: the yield of the tree equals the input.</>
          : <>Root created from the start symbol.</>}
      </div>
      <div className="scroll-thin overflow-auto rounded border border-edge bg-void/60 p-2" style={{ maxHeight }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mx-auto block max-w-full" role="img" aria-label={`Derivation tree after move ${index}`}>
          {lay.nodes.map((n) => n.children.map((cid) => {
            const c = byId.get(cid)!;
            const a = pos(n), b = pos(c);
            return (
              <motion.line key={`${n.id}-${cid}`} x1={a.cx} y1={a.cy + 16} x2={b.cx} y2={b.cy - 16} stroke="#8B5CFF" strokeOpacity={0.6} strokeWidth={1.6}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.35 }} />
            );
          }))}
          {lay.nodes.map((n) => {
            const { cx, cy } = pos(n);
            const active = tree.active === n.id;
            const isVar = n.isVar;
            const eps = n.status === 'epsilon';
            const color = eps ? '#64748B' : isVar ? '#FF2BD6' : '#00F5FF';
            return (
              <motion.g key={n.id} initial={reduce ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }} style={{ transformOrigin: `${cx}px ${cy}px` }}>
                {isVar ? (
                  <circle cx={cx} cy={cy} r={16} fill={active ? '#FF2BD6' : 'rgba(255,43,214,0.12)'} stroke={color} strokeWidth={active ? 3 : 2}
                    strokeDasharray={n.status === 'pending' ? '4 3' : undefined} style={active ? { filter: 'drop-shadow(0 0 6px #FF2BD6)' } : undefined} />
                ) : !eps ? (
                  <rect x={cx - 15} y={cy - 15} width={30} height={30} rx={3}
                    fill={active ? '#00F5FF' : n.status === 'matched' ? 'rgba(0,245,255,0.18)' : '#0D1220'} stroke={color} strokeWidth={active ? 3 : 1.8}
                    style={active ? { filter: 'drop-shadow(0 0 6px #00F5FF)' } : undefined} />
                ) : null}
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="math" fontSize={16} fontWeight={700}
                  fill={active ? '#080A12' : eps ? '#94A3B8' : isVar ? '#FFB8F1' : '#A5FBFF'}>{n.sym}</text>
              </motion.g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full border border-dashed border-magenta" />variable not yet expanded</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-magenta/40" />expanded variable</span>
        <span><span className="mr-1 inline-block h-2 w-2 bg-cyan/40" />terminal matched against input</span>
        <span><span className="mr-1 inline-block h-2 w-2 border border-cyan" />terminal not yet matched</span>
      </div>
    </div>
  );
}
