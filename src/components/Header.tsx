import { useLab, type Status, type View } from '../hooks/useLab';

const NAV: { id: View; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'docs', label: 'How it works' },
];

const STATUS: Record<Status, { label: string; color: string }> = {
  ready: { label: 'Ready', color: '#94A3B8' },
  running: { label: 'Running', color: '#00F5FF' },
  paused: { label: 'Paused', color: '#8B5CFF' },
  accepted: { label: 'Accepted', color: '#B6FF00' },
  rejected: { label: 'Rejected', color: '#FF3B4F' },
  inconclusive: { label: 'Bound reached', color: '#8B5CFF' },
};

export function Logo() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="4" fill="#0D1220" stroke="#1F2A3D" />
      <path d="M9 8v24h22V8" fill="none" stroke="#94A3B8" strokeWidth="1.6" />
      <rect x="12" y="11" width="16" height="5" rx="1" fill="none" stroke="#FF2BD6" strokeWidth="1.6" />
      <rect x="12" y="18" width="16" height="5" rx="1" fill="none" stroke="#00F5FF" strokeWidth="1.6" />
      <rect x="12" y="25" width="16" height="5" rx="1" fill="#8B5CFF" fillOpacity="0.35" stroke="#8B5CFF" strokeWidth="1.6" />
    </svg>
  );
}

export function Header() {
  const { view, setView, status, index, last } = useLab();
  const st = STATUS[status];
  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-void/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <div className="min-w-0">
            <div className="font-display text-xl font-bold leading-none tracking-wide text-ink">
              Grammar<span className="text-cyan">2</span>Stack
            </div>
            <div className="truncate text-xs text-slate">Interactive CFG-to-PDA Conversion and Simulation</div>
          </div>
        </div>
        <nav aria-label="Sections" className="scroll-thin order-3 -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:px-0">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)} aria-current={view === n.id ? 'page' : undefined}
              className={`relative shrink-0 rounded px-3 py-2 font-display text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                view === n.id ? 'text-cyan' : 'text-slate hover:text-ink'}`}>
              {n.label}
              {view === n.id && <span className="absolute inset-x-3 -bottom-[3px] h-[2px] bg-cyan" style={{ boxShadow: '0 0 8px #00F5FF' }} />}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 rounded border border-edge bg-panel px-2.5 py-1.5" role="status" aria-live="polite" aria-label={`Simulator status: ${st.label}, move ${index} of ${last}`}>
          <span className={`h-2 w-2 rounded-full ${status === 'running' ? 'animate-pulse' : ''}`} style={{ background: st.color, boxShadow: `0 0 8px ${st.color}` }} />
          <span className="font-display text-xs font-semibold uppercase tracking-widest" style={{ color: st.color }}>{st.label}</span>
          <span className="math tabular text-[11px] text-slate-deep">{index}/{last}</span>
        </div>
      </div>
    </header>
  );
}
