import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CHALLENGES, derivationForms, presetById, runAll } from '../core';
import { useLab } from '../hooks/useLab';

const LEVEL = { 1: 'Foundations', 2: 'Edge cases', 3: 'Nondeterminism', 4: 'Advanced' } as const;
type Prediction = 'accepted' | 'rejected';

/**
 * Prediction challenges. The learner commits to a prediction, then the answer is
 * computed by the same engine as the simulator (nothing is stored in advance).
 */
export function ChallengeMode() {
  const lab = useLab();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [score, setScore] = useState({ correct: 0, answered: 0 });
  const c = CHALLENGES[i];
  const preset = presetById(c.presetId)!;

  const outcome = useMemo(() => {
    const r = runAll(preset.grammar, c.input, undefined, preset.notes);
    if (!r.ok) throw new Error('challenge grammar invalid');
    return r;
  }, [preset, c.input]);
  const verdict = outcome.result.verdict.kind === 'accepted' ? 'accepted' : 'rejected';
  const word = c.input || 'ε';

  const predict = (p: Prediction) => {
    if (pred) return;
    setPred(p);
    setScore((s) => ({ correct: s.correct + (p === verdict ? 1 : 0), answered: s.answered + 1 }));
  };
  const nextChallenge = () => { setPred(null); setI((k) => (k + 1) % CHALLENGES.length); };

  const explanation = (() => {
    if (verdict === 'accepted') {
      const forms = derivationForms(outcome.sim.snapshots, outcome.sim.snapshots.length - 1).map((f) => f.form.join('') || 'ε');
      return `Accepted. A computation of ${outcome.sim.snapshots.length - 1} moves reaches the accepting configuration (q2, ε, ε). It follows the leftmost derivation ${forms.join(' ⇒ ')}.`;
    }
    const st = outcome.result.stats;
    return `Rejected. ${outcome.sim.stuck?.message ?? ''} Every other branch fails as well: the search explored ${outcome.result.nodes.length} configurations and found ${st['dead-end'] + st['final-with-input']} dead ends and ${st.pruned} soundly pruned branches, with no accepting configuration.`;
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="chip bg-violet/15 text-[#C4B5FD]">Level {c.level} · {LEVEL[c.level]}</span>
          <span className="text-xs text-slate">Challenge {i + 1} of {CHALLENGES.length}</span>
        </div>
        <div className="math tabular text-sm text-slate" aria-live="polite">Score <span className="text-ink">{score.correct}</span> / {score.answered}</div>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {CHALLENGES.map((_, k) => <span key={k} className={`h-1 flex-1 rounded-full ${k < i ? 'bg-violet/70' : k === i ? 'bg-cyan' : 'bg-edge'}`} />)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-edge bg-void/60 px-3 py-2">
          <div className="label">Grammar</div>
          <pre className="math whitespace-pre-wrap text-[15px] text-ink">{preset.grammar}</pre>
        </div>
        <div className="rounded border border-edge bg-void/60 px-3 py-2">
          <div className="label">Input string</div>
          <div className="math text-2xl font-bold tracking-wider text-cyan">{word}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm text-ink">Will the PDA built from this grammar accept the string?</div>
        <div className="flex flex-wrap gap-2">
          {(['accepted', 'rejected'] as const).map((p) => {
            const chosen = pred === p;
            const right = pred && p === verdict;
            return (
              <button key={p} className={`btn min-w-[130px] ${chosen ? (right ? 'border-lime text-lime' : 'border-danger text-danger') : right ? 'border-lime/60 text-lime' : ''}`}
                disabled={!!pred && !chosen && !right} onClick={() => predict(p)} aria-pressed={chosen}>
                Predict {p === 'accepted' ? 'Accepted' : 'Rejected'}
              </button>
            );
          })}
        </div>
      </div>

      {pred && (
        <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded border px-3 py-2.5 ${pred === verdict ? 'border-lime/50 bg-lime/[0.06]' : 'border-danger/50 bg-danger/[0.06]'}`}>
          <div className={`font-display font-semibold ${pred === verdict ? 'text-lime' : 'text-danger'}`}>
            {pred === verdict ? 'Correct prediction.' : 'Incorrect prediction.'}
          </div>
          <p className="mt-1 text-sm text-ink">{explanation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => { lab.applyPreset(preset.id, c.input); lab.openWorkspace('simulate'); }}>Watch the computation</button>
            <button className="btn" onClick={nextChallenge}>{i + 1 < CHALLENGES.length ? 'Next challenge' : 'Start again'}</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
