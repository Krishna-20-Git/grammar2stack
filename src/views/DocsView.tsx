import type { ReactNode } from 'react';
import { Panel } from '../components/Panel';
import { DEFAULT_BOUNDS } from '../core';

const Sec = ({ title, children }: { title: string; children: ReactNode }) => (
  <Panel eyebrow="Documentation" title={title}><div className="flex max-w-[78ch] flex-col gap-2 text-[14.5px] leading-relaxed text-ink/90">{children}</div></Panel>
);
const M = ({ children }: { children: ReactNode }) => <span className="math text-cyan">{children}</span>;

export function DocsView() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Sec title="1 · The construction">
        <p>From a context-free grammar <M>G = (V, Σ, P, S)</M> the tool builds the pushdown automaton</p>
        <p className="math rounded border border-edge bg-void/60 px-3 py-2 text-sm">P = ({'{'}q0, q1, q2{'}'}, Σ, V ∪ Σ ∪ {'{'}Z₀{'}'}, δ, q0, Z₀, {'{'}q2{'}'})</p>
        <ul className="list-disc pl-5">
          <li><M>δ(q0, ε, Z₀) = {'{'}(q1, SZ₀){'}'}</M>: push the start symbol.</li>
          <li>For every production <M>A → β</M>: <M>δ(q1, ε, A) ∋ (q1, β)</M> (expand).</li>
          <li>For every terminal <M>a</M>: <M>δ(q1, a, a) = {'{'}(q1, ε){'}'}</M> (match).</li>
          <li><M>δ(q1, ε, Z₀) = {'{'}(q2, ε){'}'}</M>: accept when only Z₀ remains.</li>
        </ul>
        <p>This is the construction of Sipser (§2.2) and Hopcroft, Motwani &amp; Ullman (§6.3, which uses the one-state empty-stack variant). The PDA simulates leftmost derivations of G, so <M>L(P) = L(G)</M>.</p>
      </Sec>

      <Sec title="2 · Stack convention and transition semantics">
        <p>Stack contents are written <b>top-first</b>: in <M>(q1, abb, aSbbZ₀)</M> the symbol <M>a</M> is on top and <M>Z₀</M> at the bottom. The visual stack draws the top at the top.</p>
        <p><M>δ(q, x, X) ∋ (p, γ)</M> means: in state q, with X on top, reading x (or nothing if x = ε), the PDA may pop X, push γ and move to p. γ is pushed so that its <b>leftmost symbol ends on top</b>. For <M>S → aSbb</M> the symbols are pushed in the order b, b, S, a.</p>
        <p>With this order the stack, read top to bottom, is exactly the unmatched suffix of the current leftmost sentential form. Expansions are ε-moves and never move the input pointer; only match moves advance it.</p>
      </Sec>

      <Sec title="3 · Acceptance">
        <p>A configuration is accepting when the PDA is in the final state q2 <b>and</b> the entire input has been read. Reaching q2 early, with input left, is not acceptance; q2 has no outgoing moves, so that branch halts.</p>
        <p>The move into q2 pops Z₀, so in every accepting configuration the stack is also empty. Acceptance by final state and by empty stack therefore coincide for this PDA.</p>
        <p>A string is accepted if <b>some</b> branch of the nondeterministic computation reaches an accepting configuration. It is rejected only when <b>every</b> branch fails.</p>
      </Sec>

      <Sec title="4 · Nondeterministic search and its bounds">
        <p>The simulator explores the computation tree breadth-first from <M>(q0, w, Z₀)</M>. It does not hard-code any result: verdicts follow from the transition function alone.</p>
        <ul className="list-disc pl-5">
          <li><b>Duplicate configurations</b> are explored once. This is sound, because a PDA’s future depends only on its configuration.</li>
          <li><b>Too long (sound):</b> each terminal on the stack needs its own input symbol, and each variable that cannot derive ε needs at least one. If the stack holds more of these than there are unread symbols, the branch cannot accept and is pruned.</li>
          <li><b>Stack bound (heuristic):</b> at most unread input + {DEFAULT_BOUNDS.stackSlack} grammar symbols on the stack. This only matters for grammars with nullable variables. If it ever cuts a branch and nothing accepts, the result is reported as <i>inconclusive</i>, never as rejected.</li>
          <li><b>Node limit:</b> at most {DEFAULT_BOUNDS.maxExpanded.toLocaleString()} configurations are expanded, which is ample for strings of up to about a dozen symbols.</li>
        </ul>
        <p>These rules guarantee termination even for left-recursive grammars and ε-cycles. For grammars without nullable variables (and for every example grammar with the example strings) the search is exhaustive and the verdict is exact.</p>
      </Sec>

      <Sec title="4b · Describing any language">
        <p>Instead of writing a grammar, you can describe the strings you want, in words or as conditions: <i>ending with two a</i>, <i>containing 3 b</i>, <i>starting with ab and not containing bb</i>, <i>even number of a</i>, <i>length at least 3</i> and so on, joined with “and”.</p>
        <p>Each condition is checked by a small finite automaton. The automata are combined with the product construction (all conditions must hold) and minimised. The result is written as a right-linear grammar: a transition from situation A to situation B on symbol c becomes <M>A → cB</M>, and every situation that satisfies all conditions gets <M>A → ε</M>. The Grammar view lists what each variable remembers.</p>
        <p>That grammar is then converted to a PDA exactly like any other grammar, so the stack, tape and explanations work unchanged. The batch tester checks every PDA result against the description, for example on all strings up to a given length.</p>
        <p><b>Blocks in order</b> (<i>2 a followed by 4 b</i>, <i>any number of a then b</i>, <i>a^2 b^4</i>) are regular and use the same automaton route. <b>Linked counts</b> (<i>n a followed by 2n b</i>, <i>a^n c b^n</i>, <i>a^n b^m c^m d^n</i>) are context-free. For each linked pair the app writes a recursive rule T → x<sup>p</sup> T y<sup>q</sup> | middle, so the two counts grow together, and the stack later checks them in reverse order. Three-way links (aⁿbⁿcⁿ) and crossing links (aⁿbᵐcⁿdᵐ) are not context-free, and the app explains why no PDA exists.</p>
        <p>Descriptions such as <i>palindromes</i> or <i>equal number of a and b</i> are not regular, because they need unbounded counting. The app recognises them and loads the matching context-free grammar.</p>
      </Sec>

      <Sec title="5 · Using the simulator">
        <ul className="list-disc pl-5">
          <li><b>Guided mode</b> explains every operation and the theoretical concept behind it.</li>
          <li><b>Step-by-step mode</b> waits for you and shows a compact explanation.</li>
          <li><b>Automatic mode</b> plays at 0.5×–4× speed; pause, resume and scrub at any time.</li>
          <li>The timeline is a list of immutable snapshots, so stepping back restores the exact input position, state, stack and history.</li>
          <li>Keyboard: <M>←</M> / <M>→</M> step, <M>Space</M> play/pause, <M>Home</M> / <M>End</M> jump. Every control is reachable with Tab.</li>
          <li>The <b>branch explorer</b> lists every configuration the search generated. Pick any leaf to replay that branch; open “why?” on a pruned node for the reason.</li>
          <li>Animations follow the system’s reduced-motion setting.</li>
        </ul>
      </Sec>

      <Sec title="6 · Grammar syntax">
        <ul className="list-disc pl-5">
          <li>One variable per line: <M>S → aSb | ε</M> (also <M>-&gt;</M>).</li>
          <li>The left side is a single capital letter. Capital letters on the right are variables; any other character is a terminal.</li>
          <li>The empty string is <M>ε</M>, <M>λ</M>, <M>eps</M> or an empty alternative.</li>
          <li>The left side of the first line is the start symbol. Lines starting with # are comments.</li>
        </ul>
      </Sec>

      <Sec title="7 · Project structure">
        <pre className="math scroll-thin overflow-x-auto rounded border border-edge bg-void/60 p-3 text-[12.5px] leading-relaxed text-slate">{`src/core/          pure TypeScript, no UI
  types.ts         symbols, configurations, transitions, snapshots
  grammar.ts       parser and validator, CFG production model
  pda.ts           CFG → PDA construction, notation
  engine.ts        applicable transitions, firing, acceptance
  search.ts        nondeterministic BFS, pruning, bounds
  simulation.ts    snapshots (history), shown branch
  derivation.ts    parse tree from a computation
  explain.ts       educational explanations
  presets.ts       example grammars and challenges
  language.ts      description → automata → right-linear grammar
src/hooks/useLab   animation / application controller
src/components/    diagram, stack, tape, controls, tree, explorer …
src/views/         Overview, Grammar, Automaton, Simulation, Derivation, Docs
tests/core.test.ts automated tests (Vitest)`}</pre>
      </Sec>

      <Sec title="8 · Credits and references">
        <p>Grammar2Stack · Team 6 (Roll No. 034–039) · Theory of Computation presentation on the conversion of CFG to PDA.</p>
        <ul className="list-disc pl-5 text-slate">
          <li>M. Sipser, <i>Introduction to the Theory of Computation</i>, 3rd ed., §2.2.</li>
          <li>J. E. Hopcroft, R. Motwani, J. D. Ullman, <i>Introduction to Automata Theory, Languages, and Computation</i>, 3rd ed., §6.3.</li>
          <li>P. Linz, <i>An Introduction to Formal Languages and Automata</i>, Ch. 7.</li>
        </ul>
      </Sec>
    </div>
  );
}
