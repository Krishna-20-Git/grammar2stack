import { useLab, type Tab } from '../hooks/useLab';
import { DerivationView } from './DerivationView';
import { SimulateTab } from './SimulateTab';
import { TheoryTab } from './TheoryTab';

const TABS: { id: Tab; label: string }[] = [
  { id: 'simulate', label: 'Simulate' },
  { id: 'derivation', label: 'Derivation tree' },
  { id: 'theory', label: 'Theory' },
];

/** One workspace for the whole flow: grammar → machine → run. */
export function Workspace() {
  const { tab, setTab } = useLab();
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Workspace" className="flex gap-1 border-b border-edge">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`relative px-4 py-2 font-display text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors ${tab === t.id ? 'text-cyan' : 'text-slate hover:text-ink'}`}>
            {t.label}
            {tab === t.id && <span className="absolute inset-x-3 -bottom-px h-[2px] bg-cyan" style={{ boxShadow: '0 0 8px #00F5FF' }} />}
          </button>
        ))}
      </div>
      {tab === 'simulate' && <SimulateTab />}
      {tab === 'derivation' && <DerivationView />}
      {tab === 'theory' && <TheoryTab />}
    </div>
  );
}
