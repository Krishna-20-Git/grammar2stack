import { motion, useReducedMotion } from 'framer-motion';
import { Header } from './components/Header';
import { LabProvider, useLab } from './hooks/useLab';
import { DocsView } from './views/DocsView';
import { Home } from './views/Home';
import { Workspace } from './views/Workspace';

function Shell() {
  const { view } = useLab();
  const reduce = useReducedMotion();
  const View = { home: Home, workspace: Workspace, docs: DocsView }[view];
  return (
    <div className="min-h-full">
      <Header />
      <main className="mx-auto max-w-[1440px] px-4 py-5" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <motion.div key={view} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <View />
        </motion.div>
      </main>
      <footer className="mx-auto max-w-[1440px] px-4 pb-6 text-xs text-slate-deep">
        Grammar2Stack · Team 6 · Roll No. 034–039 · Conversion of CFG to PDA
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LabProvider>
      <Shell />
    </LabProvider>
  );
}
