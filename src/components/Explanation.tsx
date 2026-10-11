import { keepEps } from './eps';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLab } from '../hooks/useLab';
import { pruneExplanation } from '../core';

const Row = ({ k, v, mono }: { k: string; v: string | null; mono?: boolean }) =>
  v ? (
    <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-[170px_1fr] sm:gap-3">
      <dt className="label pt-0.5">{k}</dt>
      <dd className={`text-[14px] text-ink ${mono ? 'math' : ''}`}>{v}</dd>
    </div>
  ) : null;

/** Formal explanation of the current transition. Content depends on the simulation mode. */
export function Explanation() {
  const { snapshot, mode, result, atEnd, sim, w, g } = useLab();
  const reduce = useReducedMotion();
  const e = snapshot.explanation;
  const node = snapshot.nodeId >= 0 ? result.nodes[snapshot.nodeId] : null;

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.dl key={snapshot.index} className="flex flex-col gap-2.5"
          initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <Row k="Current operation" v={e.operation} />
          {mode !== 'step' && <Row k="Production applied" v={e.production ?? 'None'} mono />}
          <Row k="Input consumed" v={e.inputConsumed} />
          <Row k="Stack operation" v={e.stackOperation} />
          {mode !== 'step' && <Row k="Reason" v={e.reason} />}
          {mode === 'guided' && <Row k="Theoretical significance" v={e.significance} />}
        </motion.dl>
      </AnimatePresence>

      {mode === 'guided' && (
        <div className="rounded border border-violet/40 bg-violet/10 px-3 py-2">
          <div className="label text-[#C4B5FD]">Concept · {keepEps(e.concept.title)}</div>
          <p className="mt-0.5 text-sm text-ink/90">{e.concept.text}</p>
        </div>
      )}

      {node?.status === 'pruned' && (
        <div className="rounded border border-slate-deep bg-void px-3 py-2 text-sm text-slate">
          <span className="label mr-2">Search note</span>
          The exhaustive search pruned this configuration: {pruneExplanation(node.pruneReason!, node, w, g)} The rest of this branch is shown to illustrate why.
        </div>
      )}
      {snapshot.nodeId < 0 && snapshot.index > 0 && (
        <div className="rounded border border-slate-deep bg-void px-3 py-2 text-sm text-slate">
          <span className="label mr-2">Search note</span>
          This configuration lies beyond a point where the exhaustive search pruned the branch, so it is shown for illustration only.
        </div>
      )}
      {atEnd && !sim.accepted && sim.stuck && (
        <div className="rounded border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-ink">
          <span className="label mr-2 text-danger">Branch halts</span>{sim.stuck.message}
        </div>
      )}
    </div>
  );
}
