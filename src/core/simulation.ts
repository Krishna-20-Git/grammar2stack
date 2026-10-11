import { applicable, configKey, fire, initialConfiguration, isAccepting } from './engine';
import { explainStep } from './explain';
import { isVariable } from './grammar';
import { pathTo, pruneExplanation } from './search';
import {
  BOTTOM,
  type Configuration,
  type Grammar,
  type OperationKind,
  type PDA,
  type SearchResult,
  type Simulation,
  type Snapshot,
  type StackItem,
  type StuckInfo,
  type Sym,
  type Transition,
} from './types';

/**
 * Simulation history: turns one computation path into a list of immutable
 * snapshots. The timeline jumps between snapshots; nothing is reversed
 * visually, so stepping backward always restores the exact configuration.
 */

interface PathStep { config: Configuration; via: Transition | null; nodeId: number }

const opOf = (t: Transition | null): OperationKind => (t ? t.kind : 'init');

export function snapshotsFromPath(g: Grammar, input: Sym[], steps: PathStep[], notes?: Record<string, string>): Snapshot[] {
  let uid = 0;
  let stack: StackItem[] = [{ uid: uid++, sym: BOTTOM }];
  const out: Snapshot[] = [];
  steps.forEach((step, index) => {
    const t = step.via;
    let pushed: number[] = [];
    let popped: StackItem | null = null;
    const posBefore = index ? steps[index - 1].config.pos : 0;
    if (t) {
      popped = stack[0];
      const items = t.push.map((sym) => ({ uid: uid++, sym }));
      pushed = items.map((i) => i.uid);
      stack = [...items, ...stack.slice(1)];
    }
    const symbols = stack.map((s) => s.sym);
    if (symbols.join('\u0001') !== step.config.stack.join('\u0001')) throw new Error('Snapshot stack diverged from engine configuration');
    const op = opOf(t);
    out.push({
      index,
      config: step.config,
      stack,
      transition: t,
      op,
      pushed,
      popped,
      consumed: t && t.input !== null ? t.input : null,
      sententialForm: step.config.state === 'q0' ? [] : [...input.slice(0, step.config.pos), ...symbols.filter((s) => s !== BOTTOM)],
      explanation: explainStep({ g, op, t, input, posBefore, stackAfter: symbols, notes }),
      nodeId: step.nodeId,
    });
  });
  return out;
}

/** The branch a person would try first: expand using the production whose body starts with the next input symbol. */
function guidedBranch(pda: PDA, input: Sym[]): PathStep[] | null {
  let c = initialConfiguration(pda);
  const steps: PathStep[] = [{ config: c, via: null, nodeId: -1 }];
  for (let guard = 0; guard < 500; guard++) {
    if (isAccepting(pda, c, input)) break;
    const moves = applicable(pda, c, input);
    if (!moves.length) break;
    const next = input[c.pos];
    const score = (t: Transition) => {
      if (t.kind !== 'expand') return 0;
      const first = t.push[0];
      if (first === undefined) return 2;
      if (first === next) return 0;
      return isVariable(first) ? 1 : 3;
    };
    const t = [...moves].sort((x, y) => score(x) - score(y))[0];
    c = fire(c, t);
    if (c.stack.length > input.length - c.pos + 24) return null;
    steps.push({ config: c, via: t, nodeId: -1 });
  }
  return steps;
}

/** Attach computation-tree node ids to a path that was produced outside the tree. */
function attachNodes(result: SearchResult, steps: PathStep[]) {
  let node = 0;
  steps[0].nodeId = 0;
  for (let i = 1; i < steps.length; i++) {
    if (node < 0) { steps[i].nodeId = -1; continue; }
    const key = configKey(steps[i].config);
    const child = result.nodes[node].children.find((k) => result.nodes[k].via === steps[i].via!.id && configKey(result.nodes[k].config) === key);
    node = child ?? -1;
    steps[i].nodeId = node;
  }
}

export function stuckInfo(pda: PDA, c: Configuration, input: Sym[]): StuckInfo | null {
  if (isAccepting(pda, c, input)) return null;
  const moves = applicable(pda, c, input);
  if (moves.length) return { status: 'open', message: 'This branch was not continued further.' };
  const left = input.length - c.pos;
  if (pda.finalStates.includes(c.state)) {
    return { status: 'final-with-input', message: `The PDA entered the final state q2, but ${left} input symbol${left === 1 ? '' : 's'} (${input.slice(c.pos).join('')}) remain${left === 1 ? 's' : ''} unread. Acceptance requires the entire input to be consumed, and q2 has no outgoing transitions.` };
  }
  const top = c.stack[0];
  if (c.pos >= input.length) {
    return { status: 'dead-end', message: `Dead end: the input is exhausted, but the terminal ${top} is still on top of the stack. It can never be matched, so this branch halts without accepting.` };
  }
  return { status: 'dead-end', message: `Dead end: the top of the stack is the terminal ${top}, but the next input symbol is ${input[c.pos]}. No transition δ(q1, ${input[c.pos]}, ${top}) exists, so this branch halts.` };
}

/**
 * Build the simulation to display.
 *  - leafId given: the path from the root of the computation tree to that node.
 *  - accepted: the (shortest) accepting path found by the search.
 *  - otherwise: the input-guided branch, which is usually the most instructive failure.
 */
export function buildSimulation(g: Grammar, pda: PDA, result: SearchResult, leafId?: number, notes?: Record<string, string>): Simulation & { note: string } {
  const input = result.input;
  let steps: PathStep[];
  let note: string;

  const fromTree = (id: number): PathStep[] =>
    pathTo(result, id).map((k) => {
      const nd = result.nodes[k];
      return { config: nd.config, via: nd.via === null ? null : pda.transitions[nd.via], nodeId: k };
    });

  if (leafId !== undefined) {
    steps = fromTree(leafId);
    const nd = result.nodes[leafId];
    note = nd.status === 'pruned'
      ? `Branch selected in the explorer. It was pruned here: ${pruneExplanation(nd.pruneReason!, nd, input, g)}`
      : 'Branch selected in the computation-branch explorer.';
  } else if (result.acceptingNode >= 0) {
    steps = fromTree(result.acceptingNode);
    note = 'Shown: the shortest accepting computation found by breadth-first search.';
  } else {
    const guided = guidedBranch(pda, input);
    if (guided) {
      attachNodes(result, guided);
      steps = guided;
      note = 'Shown: the branch guided by the next input symbol. Every other branch also fails; open the branch explorer to inspect them.';
    } else {
      const deepest = result.nodes.reduce((b, nd) => (nd.config.pos > b.config.pos || (nd.config.pos === b.config.pos && nd.depth > b.depth) ? nd : b));
      steps = fromTree(deepest.id);
      note = 'Shown: the branch that read the most input before failing.';
    }
  }

  const snapshots = snapshotsFromPath(g, input, steps, notes);
  const last = snapshots[snapshots.length - 1];
  const accepted = isAccepting(pda, last.config, input);
  return { snapshots, leafId: last.nodeId, accepted, stuck: accepted ? null : stuckInfo(pda, last.config, input), note };
}

/** Leftmost derivation S ⇒ … up to snapshot `upto` (one form per expansion). */
export function derivationForms(snaps: Snapshot[], upto: number): { form: Sym[]; snapshot: number }[] {
  const out: { form: Sym[]; snapshot: number }[] = [];
  for (let i = 0; i <= upto && i < snaps.length; i++) {
    const s = snaps[i];
    if (s.op === 'start' || s.op === 'expand') out.push({ form: s.sententialForm, snapshot: i });
  }
  return out;
}
