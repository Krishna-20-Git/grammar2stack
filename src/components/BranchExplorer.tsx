import { useEffect, useMemo, useState } from 'react';
import { edgeLabel, formatConfiguration, pruneExplanation, type BranchStatus, type ComputationNode } from '../core';
import { useLab } from '../hooks/useLab';

const STATUS: Record<BranchStatus, { label: string; cls: string }> = {
  accepted: { label: 'accepting', cls: 'bg-lime/15 text-lime' },
  'dead-end': { label: 'dead end', cls: 'bg-danger/15 text-danger' },
  'final-with-input': { label: 'q2, input left', cls: 'bg-danger/15 text-danger' },
  pruned: { label: 'pruned', cls: 'bg-slate/15 text-slate' },
  open: { label: 'not explored', cls: 'bg-edge text-slate-deep' },
  expanded: { label: '', cls: '' },
};

const MAX_CHILDREN = 40;

/**
 * Computation branch explorer: the PDA's computation tree as an expandable outline.
 * The branch currently shown in the simulator is marked; any leaf can be loaded
 * into the simulator to replay it step by step.
 */
export function BranchExplorer() {
  const { result, pda, g, w, snapshots, index, setIndex, pickLeaf, sim } = useLab();
  const pathIds = useMemo(() => snapshots.map((s) => s.nodeId).filter((id) => id >= 0), [snapshots]);
  const onPath = useMemo(() => new Set(pathIds), [pathIds]);
  const posOnPath = useMemo(() => new Map(snapshots.filter((s) => s.nodeId >= 0).map((s) => [s.nodeId, s.index])), [snapshots]);
  const [open, setOpen] = useState<Set<number>>(() => new Set(pathIds));
  const [why, setWhy] = useState<number | null>(null);

  useEffect(() => { setOpen(new Set(pathIds)); setWhy(null); }, [result, pathIds]);

  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const currentNode = snapshots[index]?.nodeId;
  const st = result.stats;
  const branchPoints = result.nodes.filter((n) => n.children.length > 1).length;

  const renderNode = (node: ComputationNode, depth: number): JSX.Element => {
    const t = node.via === null ? null : pda.transitions[node.via];
    const kids = node.children;
    const isOpen = open.has(node.id);
    const s = STATUS[node.status];
    const leaf = kids.length === 0;
    const here = node.id === currentNode;
    const path = onPath.has(node.id);
    return (
      <li key={node.id}>
        <div className={`group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm py-1 pr-2 ${here ? 'bg-cyan/10' : path ? 'bg-white/[0.025]' : ''}`}
          style={{ paddingLeft: 6 + Math.min(depth, 24) * 14, boxShadow: path ? 'inset 2px 0 0 #00F5FF' : undefined }}>
          {kids.length ? (
            <button className="h-6 w-6 rounded text-slate hover:text-ink" onClick={() => toggle(node.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${kids.length} child configurations`}>{isOpen ? '▾' : '▸'}</button>
          ) : <span className="inline-block w-6 text-center text-slate-deep" aria-hidden="true">·</span>}
          {t && <span className="math text-[12px]" style={{ color: t.kind === 'expand' ? '#FF8BE8' : t.kind === 'accept' ? '#B6FF00' : '#7FF8FF' }}>{edgeLabel(t)}</span>}
          <button className={`math text-left text-[13px] ${path ? 'text-ink' : 'text-slate'} hover:text-cyan`}
            onClick={() => (posOnPath.has(node.id) ? setIndex(posOnPath.get(node.id)!) : leaf ? pickLeaf(node.id) : toggle(node.id))}
            title={posOnPath.has(node.id) ? 'Jump to this step' : leaf ? 'Load this branch into the simulator' : 'Expand'}>
            {formatConfiguration(node.config, w)}
          </button>
          {kids.length > 1 && <span className="chip bg-violet/15 text-[#C4B5FD]">{kids.length} choices</span>}
          {s.label && <span className={`chip ${s.cls}`}>{s.label}{node.pruneReason ? `: ${node.pruneReason}` : ''}</span>}
          {node.status === 'pruned' && (
            <button className="text-xs text-slate underline-offset-2 hover:text-ink hover:underline" onClick={() => setWhy(why === node.id ? null : node.id)} aria-expanded={why === node.id}>why?</button>
          )}
          {leaf && !path && node.status !== 'open' && (
            <button className="text-xs text-cyan underline-offset-2 hover:underline" onClick={() => pickLeaf(node.id)}>show branch</button>
          )}
        </div>
        {why === node.id && node.pruneReason && (
          <p className="my-1 rounded border border-edge bg-void px-3 py-2 text-[13px] text-slate" style={{ marginLeft: 34 + Math.min(depth, 24) * 14 }}>
            {pruneExplanation(node.pruneReason, node, w, g)}
          </p>
        )}
        {isOpen && kids.length > 0 && (
          <ul>
            {kids.slice(0, MAX_CHILDREN).map((k) => renderNode(result.nodes[k], depth + 1))}
            {kids.length > MAX_CHILDREN && <li className="py-1 text-xs text-slate" style={{ paddingLeft: 40 + depth * 14 }}>+ {kids.length - MAX_CHILDREN} more</li>}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Configurations', result.nodes.length],
          ['Expanded', result.expanded],
          ['Branch points', branchPoints],
          ['Accepting', st.accepted],
          ['Dead ends', st['dead-end'] + st['final-with-input']],
          ['Pruned', st.pruned],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded border border-edge bg-void/60 px-2.5 py-1.5">
            <div className="label">{k}</div>
            <div className="math tabular text-lg text-ink">{(v as number).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate">
        Breadth-first search over configurations. Pruned: {st.prunedBy.duplicate} duplicate, {st.prunedBy['too-long']} too long for the remaining input (sound), {st.prunedBy['stack-bound']} by the stack bound.
        Limits: {result.bounds.maxExpanded.toLocaleString()} expanded configurations; stack ≤ unread input + {result.bounds.stackSlack}. {sim.note}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs"><LeafReset /></div>
      <div className="scroll-thin max-h-[440px] overflow-auto rounded border border-edge bg-void/50 py-1">
        <ul className="min-w-max" aria-label="Computation tree">{renderNode(result.nodes[0], 0)}</ul>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-slate">
        <span><span className="mr-1 inline-block h-2 w-2 bg-cyan" />branch shown in the simulator</span>
        <span>Click a configuration on that branch to jump to it; click another leaf to replay its branch.</span>
      </div>
    </div>
  );
}

function LeafReset() {
  const { leaf, pickLeaf } = useLab();
  if (leaf === undefined) return <span className="text-slate">Showing the default branch.</span>;
  return (
    <>
      <span className="text-slate">Showing a branch you selected.</span>
      <button className="btn min-h-[30px] px-2 text-xs" onClick={() => pickLeaf(undefined)}>Back to default branch</button>
    </>
  );
}
