import { motion, useReducedMotion } from 'framer-motion';
import { useLab } from '../hooks/useLab';

/** Outcome banner shown once the timeline reaches the end of the displayed branch. */
export function Verdict() {
  const { result, sim, atEnd, w, snapshots, openWorkspace } = useLab();
  const reduce = useReducedMotion();
  if (!atEnd) return null;
  const st = result.stats;
  const failed = st['dead-end'] + st['final-with-input'];
  const word = w.join('') || 'ε';

  if (result.verdict.kind === 'accepted') {
    const expands = snapshots.filter((s) => s.op === 'expand').length;
    return (
      <motion.div role="status" initial={reduce ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-md border border-lime/60 bg-lime/[0.07] px-4 py-3"
        style={{ boxShadow: '0 0 30px -14px #B6FF00' }}>
        {!reduce && <motion.div aria-hidden="true" className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-lime/20 to-transparent" initial={{ x: '-30%' }} animate={{ x: '600%' }} transition={{ duration: 1.2, ease: 'easeOut' }} />}
        <div className="relative flex flex-col gap-1">
          <div className="font-display text-xl font-bold tracking-wide text-lime">String Accepted</div>
          {sim.accepted ? (
            <p className="text-sm text-ink">
              The configuration (q2, ε, ε) is accepting: q2 ∈ F and the entire input <span className="math">{word}</span> has been consumed. The stack is empty as well, so the string is accepted by final state and by empty stack. The run took {snapshots.length - 1} moves: 1 start move, {expands} expansion{expands === 1 ? '' : 's'} (one per derivation step), {w.length} match{w.length === 1 ? '' : 'es'} (one per input symbol) and 1 accept move.
            </p>
          ) : (
            <p className="text-sm text-ink">
              The string is accepted, because another branch of the computation reaches an accepting configuration. The branch currently displayed fails, which shows that one failed branch does not cause rejection of a nondeterministic PDA.
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  if (result.verdict.kind === 'inconclusive') {
    return (
      <div role="status" className="rounded-md border border-violet/60 bg-violet/10 px-4 py-3">
        <div className="font-display text-xl font-bold tracking-wide text-[#C4B5FD]">No accepting computation within the search bounds</div>
        <p className="text-sm text-ink">
          {result.verdict.reason === 'node-limit'
            ? `The search stopped after expanding ${result.expanded.toLocaleString()} configurations without finding an accepting one.`
            : 'Some branches were cut by the stack-size bound, which is a practical limit for grammars with nullable variables rather than a proof.'}{' '}
          The string is therefore not shown to be in the language, but rejection is not proven either. See Documentation → Search bounds.
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="rounded-md border border-danger/60 bg-danger/[0.08] px-4 py-3" style={{ boxShadow: '0 0 30px -16px #FF3B4F' }}>
      <div className="font-display text-xl font-bold tracking-wide text-danger">String Rejected</div>
      <p className="text-sm text-ink">
        No computation path reaches an accepting configuration. The search explored the whole computation tree for <span className="math">{word}</span>: {failed} branch{failed === 1 ? '' : 'es'} ended in a dead end or reached q2 with input left, and {st.pruned} {st.pruned === 1 ? 'was' : 'were'} soundly pruned (no possible continuation could accept). Because every branch fails, <span className="math">{word} ∉ L(G)</span>.
      </p>
      <button className="mt-2 text-sm text-cyan underline-offset-2 hover:underline"
        onClick={() => { openWorkspace('simulate', true); setTimeout(() => document.getElementById('branches')?.scrollIntoView({ behavior: 'smooth' }), 50); }}>
        Inspect the branches in the branch explorer ↓
      </button>
    </div>
  );
}
