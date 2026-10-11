import { ChallengeMode } from '../components/ChallengeMode';
import { LanguageBuilder } from '../components/LanguageBuilder';
import { Panel } from '../components/Panel';
import { useLab, type View } from '../hooks/useLab';

const PIPELINE: { n: string; title: string; formal: string; text: string; view: View; color: string }[] = [
  { n: '01', title: 'Context-free grammar', formal: 'G = (V, Σ, P, S)', text: 'Write or choose a grammar. Productions are validated and explained.', view: 'grammar', color: '#FF2BD6' },
  { n: '02', title: 'Pushdown automaton', formal: 'P = (Q, Σ, Γ, δ, q0, Z₀, F)', text: 'Every production becomes an expand move, every terminal a match move.', view: 'automaton', color: '#8B5CFF' },
  { n: '03', title: 'Computation', formal: '(q0, w, Z₀) ⊢* (q2, ε, ε)', text: 'Step through the run with a synchronised tape, stack, diagram and explanation.', view: 'simulation', color: '#00F5FF' },
  { n: '04', title: 'Derivation', formal: 'S ⇒* w', text: 'See the parse tree grow and how it relates to the PDA’s moves.', view: 'derivation', color: '#B6FF00' },
];

export function Overview() {
  const lab = useLab();
  return (
    <div className="flex flex-col gap-4">
    <Panel eyebrow="Test any language" title="Describe a language in words, then try any input">
      <p className="max-w-[80ch] text-sm text-slate">
        Type a property such as <span className="text-ink">“ending with two a”</span>, <span className="text-ink">“containing 3 b”</span> or both together. Grammar2Stack writes a grammar for it, converts the grammar to a PDA and opens the simulator, where you can enter any string you like.
      </p>
      <LanguageBuilder compact onBuilt={() => lab.setView('simulation')} />
    </Panel>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Panel eyebrow="Team 6 · Roll No. 034–039 · Theory of Computation" title="Conversion of CFG to PDA">
          <p className="max-w-[68ch] text-[15px] text-ink/90">
            Every context-free language is accepted by some pushdown automaton. Grammar2Stack builds that automaton from any grammar you enter and runs it on an input string. It keeps the input tape, the automaton’s state, the stack, the transition table and a formal explanation in step with each computation move.
          </p>
          <div className="rounded border border-cyan/30 bg-cyan/[0.05] px-4 py-3">
            <div className="label text-cyan">Problem statement</div>
            <p className="mt-1 text-[15px]">
              Convert the CFG <span className="math font-bold text-magenta">S → aSbb | ε</span> into an equivalent PDA and trace the input string <span className="math font-bold text-cyan">aabbbb</span> to demonstrate language recognition.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => { lab.applyPreset('team6', 'aabbbb'); lab.setMode('guided'); lab.setView('simulation'); }}>Trace aabbbb (guided)</button>
              <button className="btn" onClick={() => { lab.applyPreset('team6', 'aabbb'); lab.setView('simulation'); }}>See a rejection: aabbb</button>
            </div>
          </div>
        </Panel>

        <div className="grid gap-3 sm:grid-cols-2">
          {PIPELINE.map((p) => (
            <button key={p.n} onClick={() => lab.setView(p.view)} className="panel group flex flex-col gap-1.5 p-4 text-left transition-colors hover:border-slate-deep">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-semibold tracking-[0.2em]" style={{ color: p.color }}>STAGE {p.n}</span>
                <span className="text-slate transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </div>
              <div className="font-display text-base font-semibold text-ink">{p.title}</div>
              <div className="math text-[13px]" style={{ color: p.color }}>{p.formal}</div>
              <div className="text-sm text-slate">{p.text}</div>
            </button>
          ))}
        </div>
      </div>

      <Panel eyebrow="Challenge mode" title="Predict, then verify">
        <p className="text-sm text-slate">Decide whether each string is accepted before the computation is revealed. The answers are computed by the simulator, not stored in advance. The challenges get harder as you go.</p>
        <ChallengeMode />
      </Panel>
    </div>
    </div>
  );
}
