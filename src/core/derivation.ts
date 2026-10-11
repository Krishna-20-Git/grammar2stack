import { isVariable } from './grammar';
import type { Grammar, Snapshot, Sym } from './types';

/**
 * Derivation (parse) tree reconstructed from a PDA computation.
 *
 * Every grammar symbol pushed onto the stack is a node of the tree, identified by
 * the stack item's uid. Expanding a variable gives that node its children;
 * matching a terminal marks the leaf as verified against the input.
 *
 * The tree is a property of the grammar derivation. The PDA computation
 * additionally interleaves matching moves and the start/accept moves, which have
 * no counterpart in the tree.
 */

export type TreeNodeStatus = 'pending' | 'expanded' | 'matched' | 'epsilon';

export interface TreeNode {
  id: string;
  sym: Sym;
  isVar: boolean;
  status: TreeNodeStatus;
  children: string[];
  /** snapshot index at which the node appeared */
  bornAt: number;
  productionId?: number;
}

export interface ParseTree {
  root: string | null;
  nodes: Record<string, TreeNode>;
  /** node changed by the move at snapshot `upto` */
  active: string | null;
}

export function buildParseTree(_g: Grammar, snaps: Snapshot[], upto: number): ParseTree {
  const nodes: Record<string, TreeNode> = {};
  let root: string | null = null;
  let active: string | null = null;
  for (let i = 1; i <= upto && i < snaps.length; i++) {
    const s = snaps[i];
    const t = s.transition!;
    if (t.kind === 'start') {
      const item = s.stack[0];
      root = String(item.uid);
      nodes[root] = { id: root, sym: item.sym, isVar: true, status: 'pending', children: [], bornAt: i };
      active = root;
    } else if (t.kind === 'expand') {
      const id = String(s.popped!.uid);
      const node = nodes[id];
      if (!node) continue;
      node.status = 'expanded';
      node.productionId = t.productionId;
      if (s.pushed.length === 0) {
        const eid = `${id}-ε`;
        nodes[eid] = { id: eid, sym: 'ε', isVar: false, status: 'epsilon', children: [], bornAt: i };
        node.children = [eid];
      } else {
        node.children = s.pushed.map((uid, k) => {
          const cid = String(uid);
          const sym = t.push[k];
          nodes[cid] = { id: cid, sym, isVar: isVariable(sym), status: 'pending', children: [], bornAt: i };
          return cid;
        });
      }
      active = id;
    } else if (t.kind === 'match') {
      const id = String(s.popped!.uid);
      if (nodes[id]) nodes[id].status = 'matched';
      active = id;
    } else {
      active = null;
    }
  }
  return { root, nodes, active };
}

export interface LaidOutNode extends TreeNode { x: number; y: number; depth: number }

/** Tidy layout: leaves get consecutive x slots, parents are centred over their children. */
export function layoutTree(tree: ParseTree): { nodes: LaidOutNode[]; width: number; depth: number } {
  if (!tree.root) return { nodes: [], width: 0, depth: 0 };
  const out: LaidOutNode[] = [];
  let leaf = 0;
  let maxDepth = 0;
  const visit = (id: string, depth: number): number => {
    const n = tree.nodes[id];
    maxDepth = Math.max(maxDepth, depth);
    let x: number;
    if (!n.children.length) x = leaf++;
    else {
      const xs = n.children.map((c) => visit(c, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    out.push({ ...n, x, y: depth, depth });
    return x;
  };
  visit(tree.root, 0);
  return { nodes: out, width: leaf, depth: maxDepth };
}

/** Frontier (yield) of the tree read left to right. */
export function treeYield(tree: ParseTree): string {
  if (!tree.root) return '';
  const walk = (id: string): string => {
    const n = tree.nodes[id];
    if (!n.children.length) return n.status === 'epsilon' ? '' : n.sym;
    return n.children.map(walk).join('');
  };
  return walk(tree.root);
}
