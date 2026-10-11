import { applicable, configKey, fire, initialConfiguration, isAccepting } from './engine';
import { isVariable, nullableVariables } from './grammar';
import {
  BOTTOM,
  type BranchStatus,
  type ComputationNode,
  type Grammar,
  type PDA,
  type PruneReason,
  type SearchBounds,
  type SearchResult,
  type Sym,
} from './types';

export const DEFAULT_BOUNDS: SearchBounds = { maxExpanded: 20000, stackSlack: 12 };

/**
 * Breadth-first search of the PDA's computation tree.
 *
 * A string is accepted iff SOME branch reaches an accepting configuration, so the
 * search never gives up on a string just because one branch fails.
 *
 * Pruning rules:
 *  1. duplicate: a configuration that was already generated is not explored again.
 *     Sound, because the PDA's future depends only on the configuration.
 *  2. too-long (sound): every terminal on the stack must be matched by its own input
 *     symbol, and every non-nullable variable must produce at least one terminal.
 *     If the stack holds more such symbols than there are unread input symbols, no
 *     continuation can accept.
 *  3. stack-bound (heuristic, only matters for grammars with nullable variables):
 *     the stack may hold at most (unread input + stackSlack) grammar symbols. If this
 *     rule ever fires and no accepting branch is found, the verdict is reported as
 *     inconclusive rather than rejected.
 *  4. node limit: at most maxExpanded configurations are expanded.
 */
export function search(g: Grammar, pda: PDA, input: Sym[], bounds: SearchBounds = DEFAULT_BOUNDS): SearchResult {
  const nullable = nullableVariables(g);
  const n = input.length;
  const nodes: ComputationNode[] = [];
  const seen = new Set<string>();
  const stats = {
    accepted: 0, 'dead-end': 0, 'final-with-input': 0, pruned: 0, open: 0, expanded: 0,
    prunedBy: { duplicate: 0, 'too-long': 0, 'stack-bound': 0 } as Record<PruneReason, number>,
  } as SearchResult['stats'];

  const root: ComputationNode = { id: 0, parent: -1, depth: 0, config: initialConfiguration(pda), via: null, status: 'open', children: [] };
  nodes.push(root);
  seen.add(configKey(root.config));

  const queue: number[] = [0];
  let head = 0;
  let acceptingNode = -1;
  let expanded = 0;

  const mustProduce = (stack: Sym[]) =>
    stack.reduce((k, s) => (s === BOTTOM ? k : !isVariable(s) || !nullable.has(s) ? k + 1 : k), 0);

  while (head < queue.length) {
    if (expanded >= bounds.maxExpanded) break;
    const id = queue[head++];
    const node = nodes[id];
    const c = node.config;

    if (isAccepting(pda, c, input)) {
      node.status = 'accepted';
      acceptingNode = id;
      break;
    }
    const moves = applicable(pda, c, input);
    if (moves.length === 0) {
      node.status = pda.finalStates.includes(c.state) ? 'final-with-input' : 'dead-end';
      continue;
    }
    expanded++;
    node.status = 'expanded';
    for (const t of moves) {
      const next = fire(c, t);
      const child: ComputationNode = { id: nodes.length, parent: id, depth: node.depth + 1, config: next, via: t.id, status: 'open', children: [] };
      nodes.push(child);
      node.children.push(child.id);
      const key = configKey(next);
      const remaining = n - next.pos;
      const grammarSymbols = next.stack.filter((s) => s !== BOTTOM).length;
      if (seen.has(key)) prune(child, 'duplicate');
      else if (mustProduce(next.stack) > remaining) prune(child, 'too-long');
      else if (grammarSymbols > remaining + bounds.stackSlack) prune(child, 'stack-bound');
      else {
        seen.add(key);
        queue.push(child.id);
      }
    }
  }

  function prune(node: ComputationNode, reason: PruneReason) {
    node.status = 'pruned';
    node.pruneReason = reason;
  }

  for (const node of nodes) {
    if (node.status === 'pruned') stats.prunedBy[node.pruneReason!]++;
    stats[node.status as BranchStatus]++;
  }

  let verdict: SearchResult['verdict'];
  if (acceptingNode >= 0) verdict = { kind: 'accepted' };
  else if (head < queue.length) verdict = { kind: 'inconclusive', reason: 'node-limit' };
  else if (stats.prunedBy['stack-bound'] > 0) verdict = { kind: 'inconclusive', reason: 'stack-bound' };
  else verdict = { kind: 'rejected' };

  return { input, nodes, acceptingNode, verdict, expanded, bounds, stats };
}

/** Node ids from the root to `id`, inclusive. */
export function pathTo(result: SearchResult, id: number): number[] {
  const path: number[] = [];
  for (let k = id; k >= 0; k = result.nodes[k].parent) path.unshift(k);
  return path;
}

/** Leaves of the tree (nodes without children). */
export const leaves = (r: SearchResult) => r.nodes.filter((nd) => nd.children.length === 0);

/** Does any node with more than one child exist? (i.e. was a real choice made) */
export const branchingPoints = (r: SearchResult) => r.nodes.filter((nd) => nd.children.length > 1);

export function pruneExplanation(reason: PruneReason, node: ComputationNode, input: Sym[], g: Grammar): string {
  const remaining = input.length - node.config.pos;
  switch (reason) {
    case 'duplicate':
      return 'This configuration was already generated on another branch. A PDA\'s future behaviour depends only on its configuration, so exploring it again could not find anything new.';
    case 'too-long': {
      const nullable = nullableVariables(g);
      const k = node.config.stack.filter((s) => s !== BOTTOM && (!isVariable(s) || !nullable.has(s))).length;
      return `The stack holds ${k} symbol${k === 1 ? '' : 's'} that must each account for at least one input symbol (terminals, and variables that cannot derive ε), but only ${remaining} input symbol${remaining === 1 ? '' : 's'} remain${remaining === 1 ? 's' : ''}. No continuation of this branch can accept, so the pruning is sound.`;
    }
    case 'stack-bound':
      return `The stack exceeded the search bound of (unread input + slack) grammar symbols. This is a practical bound for grammars with nullable variables, not a proof of rejection.`;
  }
}
