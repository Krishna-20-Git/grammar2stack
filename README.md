# Grammar2Stack

**Interactive CFG-to-PDA Conversion and Simulation**
Team 6 · Roll No. 034–039 · Theory of Computation · Topic: Conversion of CFG to PDA

Grammar2Stack converts any context-free grammar into an equivalent pushdown automaton and
simulates it on an input string. At each step it keeps six views in sync, all driven by the same
computation step: the input tape, the current state, the active edge in the state diagram, the
stack, the transition table and a formal explanation.

Default problem: convert **S → aSbb | ε** into an equivalent PDA and trace **aabbbb**.

**Any language, any input.** Type a description such as *“ending with two a and containing 3 b”*.
The app writes a grammar for it, converts the grammar to a PDA and animates the PDA on any string you
enter. The **batch tester** runs many strings at once, or every string up to a chosen length, and checks
each PDA result against the description.

## Quick start

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # development server at http://localhost:5173
npm test           # run the automated test suite (Vitest)
npm run build      # production build in dist/ (static files, host anywhere)
npm run build:single   # the whole app as one self-contained dist-single/index.html
```

To publish online, upload `dist/` to GitHub Pages, Netlify or Vercel. On a phone, open the
link and choose **Add to Home screen**.

## Features

| Area | What it does |
|---|---|
| Language builder | Describe a language in words or as conditions, over any alphabet: starts with / ends with / contains / does not contain a string, exactly / at least / at most *n* of a symbol, even or odd counts, length and length mod *m*, combined with “and”. Blocks in order (*2 a followed by 4 b*, *a^2 b^4*, *any number of a then b*) are supported too. Linked counts (*n a followed by 2n b*, *a^n c b^n*, *a^n b^m c^m d^n*) produce a context-free grammar, and aⁿbⁿcⁿ and crossing links are explained as not context-free. Property conditions produce a minimal right-linear grammar, and the app shows what each variable remembers. Non-regular requests (aⁿbⁿ, palindromes, equal numbers of a and b, balanced brackets) load the matching context-free grammar. |
| Batch tester | Test a list of strings, or all strings up to length *n*, and see accepted/rejected for each. For described languages, each result is checked against the description. Click a row to animate that string. |
| Overview | Problem statement, the four stages and **Challenge mode**: predict accept/reject, then see the computed answer with an explanation. 12 challenges at four levels, with a score. |
| Grammar | Formal definition G = (V, Σ, P, S) with the current values. Editable productions with validation and academic error messages. A mapping from each production to its transition and stack effect. |
| Automaton | Interactive SVG state diagram (initial q0, loop q1, final q2) with the current state highlighted and a moving highlight along the active edge. Select any state or transition to inspect it. Shows the seven-tuple and the transition table. |
| Simulation | Dashboard with grammar, input and current configuration, the diagram, a detailed explanation, the live stack (PUSH / POP / REPLACE / ε-move animations with restrained particles), the input tape, a **time-travel debugger** (step, play, pause, reset, speed, clickable timeline), the verdict, the full ⊢ trace, and the **computation branch explorer**. |
| Derivation | Parse tree growing with each expansion, the leftmost derivation, and an explanation of how a derivation relates to a PDA computation. |
| Documentation | Construction, stack convention, acceptance, search bounds, usage, syntax, structure, references. |

Modes: **Guided** (full explanation and concept notes), **Step-by-step** (you advance each move; compact
explanation) and **Automatic** (plays at 0.5×–4×). All three use the same engine.
Keyboard: ← → step, Space play/pause, Home/End.

## The construction

```
P = ({q0, q1, q2}, Σ, V ∪ Σ ∪ {Z₀}, δ, q0, Z₀, {q2})

δ(q0, ε, Z₀) = {(q1, S Z₀)}                         push the start symbol
δ(q1, ε, A)  ∋ (q1, β)      for every A → β ∈ P     expand (ε-move)
δ(q1, a, a)  = {(q1, ε)}    for every a ∈ Σ         match (reads a)
δ(q1, ε, Z₀) = {(q2, ε)}                            accept
```

* **Stack convention:** strings are written top-first. β is pushed so that its leftmost symbol is on
  top (for S → aSbb the push order is b, b, S, a). The stack, read top to bottom, is the unmatched
  part of the current leftmost sentential form.
* **Acceptance:** final state q2 with the entire input consumed. The move into q2 pops Z₀, so the
  stack is empty too: acceptance by final state and by empty stack coincide, and L(P) = L(G).

## Nondeterministic search

A string is accepted iff **some** branch accepts. The engine explores the computation tree
breadth-first (`src/core/search.ts`). Nothing is hard-coded.

* Duplicate configurations are explored once (sound).
* **Too long** (sound): if the stack holds more terminals and non-nullable variables than there are
  unread input symbols, the branch cannot accept.
* **Stack bound** (heuristic): at most unread + 12 grammar symbols. This only matters with nullable
  variables. If it cuts a branch and nothing accepts, the verdict is **inconclusive**, never rejected.
* **Node limit:** 20,000 expanded configurations.

These rules guarantee termination, including for left recursion and ε-cycles.

## Project structure

```
src/
  core/                 pure TypeScript, independent of the UI
    types.ts            grammar symbols, configurations, transitions, snapshots
    grammar.ts          grammar parser and validator, CFG production model
    pda.ts              CFG → PDA construction and notation
    engine.ts           PDA transition engine (applicable, fire, accept)
    search.ts           nondeterministic computation search
    simulation.ts       simulation history and snapshots
    derivation.ts       derivation tree from a computation
    explain.ts          educational explanations
    presets.ts          example grammars and challenges
    language.ts         language builder: words → conditions → automata → grammar
  hooks/useLab.tsx      animation / application controller (timeline, modes, status)
  components/           StateDiagram, Inspector, StackView, InputTape, Controls,
                        Explanation, Verdict, Tables, BranchExplorer, DerivationTree,
                        ChallengeMode, GrammarEditor, Header, Panel
  views/                Overview, Grammar, Automaton, Simulation, Derivation, Docs
tests/core.test.ts      49 tests: grammar, construction, engine, search, history
tests/language.test.ts  15 tests: description parsing; built PDAs checked against
                        an independent reference on every string up to length 6
tests/sequence.test.ts  9 tests: ordered patterns and linked counts (aⁿb²ⁿ, aⁿcbⁿ, nesting),
                        non-context-free cases, strict parsing
```

## Tests

`npm test` runs 73 tests that cover:

* grammar parsing and errors
* production expansion
* terminal matching
* ε-transitions
* push/pop order
* input pointer updates
* acceptance and rejection, including all example strings from the brief and every preset
* nondeterministic branching
* left recursion and ε-cycles terminating
* rewind and replay
* the empty string
* the language builder: parsing descriptions, and checking that each built PDA gives the same verdict as an independent reference on every string up to length 6

## Technology

React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · SVG.
Fonts: Chakra Petch (display), IBM Plex Sans (interface), JetBrains Mono (notation).
The app respects the reduced-motion setting.

## References

* M. Sipser, *Introduction to the Theory of Computation*, 3rd ed., §2.2.
* J. E. Hopcroft, R. Motwani, J. D. Ullman, *Introduction to Automata Theory, Languages, and Computation*, 3rd ed., §6.3.
* P. Linz, *An Introduction to Formal Languages and Automata*, Ch. 7.
