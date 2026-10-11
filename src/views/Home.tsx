import { Panel } from '../components/Panel';
import { useLab } from '../hooks/useLab';

const STEPS = [
  { n: '1', title: 'Write a grammar', text: 'Pick an example or type your own rules.', color: '#FF2BD6' },
  { n: '2', title: 'Get a stack machine', text: 'Every rule becomes a stack operation, built for you.', color: '#8B5CFF' },
  { n: '3', title: 'Run a string', text: 'Step through it and watch the stack change.', color: '#00F5FF' },
];

export function Home() {
  const lab = useLab();
  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-5">
      <Panel eyebrow="Theory of Computation" title="Turn a grammar into a stack machine, and watch it run">
        <p className="max-w-[68ch] text-[15px] text-ink/90">
          Every context-free grammar can be recognised by a pushdown automaton (PDA): a machine that reads a string and keeps a stack. Grammar2Stack builds that machine from a grammar and lets you step through it, one move at a time.
        </p>
        <div className="rounded border border-cyan/30 bg-cyan/[0.05] px-4 py-3">
          <div className="label text-cyan">Start here</div>
          <p className="mt-1 text-[15px]">
            Grammar <span className="math font-bold text-magenta">S → aSbb | ε</span>, input <span className="math font-bold text-cyan">aabbbb</span>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => { lab.applyPreset('team6', 'aabbbb'); lab.setMode('guided'); lab.openWorkspace('simulate'); }}>Trace aabbbb</button>
            <button className="btn" onClick={() => { lab.applyPreset('team6', 'aabbb'); lab.openWorkspace('simulate'); }}>See a rejection (aabbb)</button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="panel flex flex-col gap-1.5 p-4">
            <span className="font-display text-xs font-semibold tracking-[0.2em]" style={{ color: s.color }}>STEP {s.n}</span>
            <div className="font-display text-base font-semibold text-ink">{s.title}</div>
            <div className="text-sm text-slate">{s.text}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate">
        <span>Want something else?</span>
        <button className="text-cyan hover:underline" onClick={() => lab.openWorkspace('simulate')}>Open the workspace</button>
        <button className="text-cyan hover:underline" onClick={() => lab.openWorkspace('simulate', true)}>Describe a language in words</button>
        <button className="text-cyan hover:underline" onClick={() => lab.setView('docs')}>Read how it works</button>
      </div>
    </div>
  );
}
