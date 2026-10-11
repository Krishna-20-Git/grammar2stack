import { useState } from 'react';
import { BatchTester } from '../components/BatchTester';
import { BranchExplorer } from '../components/BranchExplorer';
import { ChallengeMode } from '../components/ChallengeMode';
import { Controls } from '../components/Controls';
import { Explanation } from '../components/Explanation';
import { InputEditor } from '../components/GrammarEditor';
import { InputTape } from '../components/InputTape';
import { Inspector } from '../components/Inspector';
import { LanguageBuilder } from '../components/LanguageBuilder';
import { Panel } from '../components/Panel';
import { StackView } from '../components/StackView';
import { StateDiagram, type Selection } from '../components/StateDiagram';
import { HistoryTable, TransitionTable } from '../components/Tables';
import { Verdict } from '../components/Verdict';
import { formatConfiguration, PRESETS, showRhs } from '../core';
import { useLab } from '../hooks/useLab';

/** The core experience: pick a grammar, enter a string, step through the run. */
export function SimulateTab() {
  const lab = useLab();
  const { g, pda, snapshot, snapshots, index, w, preset, atEnd, result, advanced, setAdvanced } = lab;
  const [sel, setSel] = useState<Selection>(null);
  const prevPos = index > 0 ? snapshots[index - 1].config.pos : 0;
  const rejectedEnd = atEnd && result.verdict.kind !== 'accepted';

  return (
    <div className="flex flex-col gap-4 pb-40 lg:pb-0">
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_280px]">
        {/* phones: tape first, so tape + stack + explanation are visible together */}
        <Panel eyebrow="Input tape" className="order-1 lg:hidden">
          <InputTape input={w} snapshot={snapshot} prevPos={prevPos} />
        </Panel>

        {/* left: grammar + input */}
        <div className="order-5 flex flex-col gap-4 lg:order-none">
          <Panel eyebrow="1 · Grammar" title={lab.customLang ? 'Generated grammar' : preset?.name ?? 'Custom grammar'}
            actions={<button className="text-xs text-cyan hover:underline" onClick={() => lab.setTab('theory')}>Edit</button>}>
            <label htmlFor="preset-select" className="label">Example grammar</label>
            <select id="preset-select" className="field text-sm" value={lab.presetId ?? ''}
              onChange={(e) => { if (e.target.value) lab.applyPreset(e.target.value); }}>
              {!lab.presetId && <option value="">{lab.customLang ? 'Described language' : 'Custom grammar'}</option>}
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ul className="math flex flex-col gap-0.5 text-[15px]">
              {g.variables.map((v) => (
                <li key={v}>{v} → {g.productions.filter((p) => p.lhs === v).map((p) => showRhs(p.rhs)).join(' | ')}</li>
              ))}
            </ul>
            {preset && <div className="math text-xs text-slate">{preset.language}</div>}
          </Panel>
          <Panel eyebrow="2 · Input string">
            <InputEditor />
          </Panel>
        </div>

        {/* centre: diagram + explanation */}
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <Panel eyebrow="The machine (PDA)" className="panel-active order-4 lg:order-none">
            <StateDiagram pda={pda} currentState={snapshot.config.state} active={snapshot.transition} stepKey={snapshot.index} selection={sel} onSelect={setSel} compact />
            {sel && <div className="rounded border border-violet/40 bg-void/60 p-3"><Inspector selection={sel} pda={pda} g={g} onClear={() => setSel(null)} /></div>}
          </Panel>
          <Panel eyebrow={`What just happened · move ${index}`} title={snapshot.explanation.operation} className="order-3 lg:order-none">
            <Explanation />
          </Panel>
        </div>

        {/* right: stack */}
        <Panel eyebrow="Stack" className="order-2 lg:order-none">
          <StackView snapshot={snapshot} rejected={rejectedEnd && snapshot.index === snapshots.length - 1} height={typeof window !== 'undefined' && window.innerWidth < 1024 ? 250 : 360} />
        </Panel>
      </div>

      <Panel eyebrow="Input tape" className="hidden lg:flex">
        <InputTape input={w} snapshot={snapshot} prevPos={prevPos} />
      </Panel>

      {/* controls: sticky at the bottom on small screens */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-void/95 px-4 py-3 backdrop-blur lg:static lg:rounded-md lg:border lg:bg-panel lg:p-4"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <Controls />
      </div>

      <Verdict />

      {/* everything else lives behind one toggle, closed by default */}
      <div className="flex flex-col gap-4">
        <button className="btn self-start" aria-expanded={advanced} aria-controls="more-tools" onClick={() => setAdvanced(!advanced)}>
          {advanced ? 'Hide extra tools ▴' : 'More tools ▾'}
        </button>
        {!advanced && (
          <p className="-mt-2 text-xs text-slate-deep">Describe a language in words, practice challenges, test many strings, move history, transition table, all computation paths.</p>
        )}
        {advanced && (
          <div id="more-tools" className="flex flex-col gap-4">
            <Panel eyebrow="Describe a language" title="Describe a language in words, and get its grammar">
              <LanguageBuilder compact />
            </Panel>
            <Panel eyebrow="Practice" title="Predict, then verify">
              <p className="text-sm text-slate">Decide whether each string is accepted before the computation is revealed.</p>
              <ChallengeMode />
            </Panel>
            <Panel eyebrow="Current configuration">
              <div className="math text-lg text-cyan">{formatConfiguration(snapshot.config, w)}</div>
              <dl className="grid grid-cols-[110px_1fr] gap-y-1 text-sm">
                <dt className="text-slate">State</dt><dd className="math">{snapshot.config.state}</dd>
                <dt className="text-slate">Input pointer</dt><dd className="math">{snapshot.config.pos} of {w.length} read</dd>
                <dt className="text-slate">Sentential form</dt><dd className="math break-all">{snapshot.config.state === 'q0' ? '—' : snapshot.sententialForm.join('') || 'ε'}</dd>
              </dl>
            </Panel>
            <Panel eyebrow="Batch tester" title="Test many strings at once">
              <BatchTester />
            </Panel>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel eyebrow="Computation history" title={atEnd ? 'Complete computation trace' : 'Trace so far'}>
                <HistoryTable full={atEnd} />
              </Panel>
              <Panel eyebrow="Transition function δ" title="Transition table">
                <TransitionTable onSelect={(id) => setSel({ type: 'transition', id })} selectedId={sel?.type === 'transition' ? sel.id : null} />
              </Panel>
            </div>
            <Panel id="branches" eyebrow="Computation branch explorer" title="All computation paths">
              <BranchExplorer />
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
