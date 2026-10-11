/**
 * Core type definitions. Everything in src/core is pure TypeScript with no
 * dependency on React or the DOM, so the mathematics can be tested in isolation.
 */

/** A grammar symbol is a single character. Capital letters are variables. */
export type Sym = string;

/** Special symbols used by the PDA. */
export const BOTTOM = 'Z₀'; // stack bottom marker
export const EPS = 'ε';

export interface Production {
  /** index in the grammar's production list (stable id) */
  id: number;
  lhs: Sym;
  /** right-hand side as a list of symbols; [] means ε */
  rhs: Sym[];
}

export interface Grammar {
  /** V – variables (nonterminals), start symbol first */
  variables: Sym[];
  /** Σ – terminals, in order of first appearance */
  terminals: Sym[];
  /** P – productions */
  productions: Production[];
  /** S – start symbol */
  start: Sym;
}

export interface GrammarError {
  line: number; // 1-based, 0 = whole grammar
  message: string;
}

export type ParseResult =
  | { ok: true; grammar: Grammar }
  | { ok: false; errors: GrammarError[] };

/* ------------------------------------------------------------------ PDA */

export type StateId = 'q0' | 'q1' | 'q2';

export type TransitionKind = 'start' | 'expand' | 'match' | 'accept';

/**
 * δ(from, input, pop) ∋ (to, push)
 * `input` is null for an ε-move. `push` is written top-first: push[0] ends on top.
 */
export interface Transition {
  id: number;
  kind: TransitionKind;
  from: StateId;
  to: StateId;
  input: Sym | null;
  pop: Sym;
  push: Sym[];
  /** for expand transitions, the production it comes from */
  productionId?: number;
}

export interface PDA {
  states: StateId[];
  inputAlphabet: Sym[]; // Σ
  stackAlphabet: Sym[]; // Γ
  transitions: Transition[];
  startState: StateId;
  startStack: Sym; // Z₀
  finalStates: StateId[];
}

/**
 * A configuration (instantaneous description). The stack is stored top-first:
 * stack[0] is the top of the stack.
 */
export interface Configuration {
  state: StateId;
  pos: number; // index of the next unread input symbol
  stack: Sym[];
}

/* ------------------------------------------------------- search / branches */

export type BranchStatus =
  | 'accepted' // accepting configuration
  | 'dead-end' // no transition applies
  | 'final-with-input' // reached q2 but input remains unread
  | 'pruned' // cut off by a pruning rule
  | 'open' // generated but never expanded (search stopped)
  | 'expanded'; // inner node of the computation tree

export type PruneReason = 'duplicate' | 'too-long' | 'stack-bound';

export interface ComputationNode {
  id: number;
  parent: number; // -1 for the root
  depth: number;
  config: Configuration;
  /** transition that produced this node (null for the root) */
  via: number | null;
  status: BranchStatus;
  pruneReason?: PruneReason;
  children: number[];
}

export interface SearchBounds {
  /** max configurations expanded before the search stops */
  maxExpanded: number;
  /** stack may hold at most (remaining input + stackSlack) symbols besides Z₀ */
  stackSlack: number;
}

export type Verdict =
  | { kind: 'accepted' }
  /** every branch was explored to a dead end or soundly pruned */
  | { kind: 'rejected' }
  /** no accepting branch found, but a heuristic bound cut the search */
  | { kind: 'inconclusive'; reason: 'stack-bound' | 'node-limit' };

export interface SearchResult {
  input: Sym[];
  nodes: ComputationNode[];
  /** node id of the accepting configuration, or -1 */
  acceptingNode: number;
  verdict: Verdict;
  expanded: number;
  bounds: SearchBounds;
  stats: Record<BranchStatus, number> & { prunedBy: Record<PruneReason, number> };
}

/* ---------------------------------------------------------- simulation */

export interface StackItem {
  /** stable id so the UI can animate pushes and pops */
  uid: number;
  sym: Sym;
}

export type OperationKind = 'init' | 'start' | 'expand' | 'match' | 'accept';

export interface StepExplanation {
  operation: string;
  production: string | null;
  inputConsumed: string;
  stackOperation: string;
  reason: string;
  significance: string;
  concept: { title: string; text: string };
}

export interface Snapshot {
  index: number;
  config: Configuration;
  stack: StackItem[]; // top-first, mirrors config.stack
  transition: Transition | null;
  op: OperationKind;
  /** uids pushed and the item popped by the move that produced this snapshot */
  pushed: number[];
  popped: StackItem | null;
  consumed: Sym | null;
  /** sentential form = input read so far + grammar symbols on the stack */
  sententialForm: Sym[];
  explanation: StepExplanation;
  /** node in the computation tree this snapshot corresponds to */
  nodeId: number;
}

/** Why the last snapshot of a non-accepting path is stuck. */
export interface StuckInfo {
  status: BranchStatus;
  message: string;
}

export interface Simulation {
  snapshots: Snapshot[];
  /** the leaf node shown */
  leafId: number;
  accepted: boolean;
  stuck: StuckInfo | null;
}
