import { useEffect, useState } from 'react';
import {
  buildLanguage,
  describeCondition,
  parseAlphabet,
  parseDescription,
  presetById,
  type Condition,
  type ConditionKind,
  type CountOp,
  type BuiltLanguage,
} from '../core';
import { useLab } from '../hooks/useLab';

const EXAMPLES = [
  'ending with two a',
  'containing 3 b',
  'ending with two a and containing 3 b',
  '2 a followed by 4 b',
  'n a followed by 2n b',
  'any number of a followed by b',
  'starting with ab and not containing bb',
  'even number of a and odd length',
  'a^n b^n',
  'palindromes',
];

const KINDS: { id: ConditionKind; label: string }[] = [
  { id: 'startsWith', label: 'starts with' },
  { id: 'endsWith', label: 'ends with' },
  { id: 'contains', label: 'contains substring' },
  { id: 'notContains', label: 'does not contain' },
  { id: 'count', label: 'number of a symbol' },
  { id: 'countMod', label: 'number of a symbol (mod m)' },
  { id: 'length', label: 'length' },
  { id: 'lengthMod', label: 'length (mod m)' },
];

function defaultCondition(kind: ConditionKind, sigma: string[]): Condition {
  const a = sigma[0] ?? 'a';
  switch (kind) {
    case 'startsWith': case 'endsWith': case 'contains': case 'notContains': return { kind, w: a + a };
    case 'count': return { kind, sym: a, op: 'exactly', n: 2 };
    case 'countMod': return { kind, sym: a, m: 2, r: 0 };
    case 'length': return { kind, op: 'atLeast', n: 2 };
    case 'lengthMod': return { kind, m: 2, r: 0 };
    case 'sequence': return { kind, segments: [{ sym: a, count: { kind: 'range', min: 2, max: 2 } }, { sym: sigma[1] ?? a, count: { kind: 'range', min: 4, max: 4 } }] };
  }
}

export function currentText(l: BuiltLanguage): string {
  const kind = l.kind === 'context-free'
    ? 'Context-free (the linked counts need the stack)'
    : 'Regular (a finite memory is enough; the PDA still uses its stack to hold the derivation)';
  return `Current language: strings over {${l.sigma.join(', ')}} that ${l.summary}. ${kind}. Grammar with ${l.size} variable${l.size === 1 ? '' : 's'}, converted to a PDA.`;
}

const sel = 'rounded border border-edge bg-void px-2 py-1.5 text-sm text-ink';
const num = 'w-16 rounded border border-edge bg-void px-2 py-1.5 font-mono text-sm text-ink';

function ConditionRow({ c, sigma, onChange, onRemove, i }: { c: Condition; sigma: string[]; onChange: (c: Condition) => void; onRemove: () => void; i: number }) {
  const opSelect = (op: CountOp, set: (o: CountOp) => void) => (
    <select className={sel} value={op} onChange={(e) => set(e.target.value as CountOp)} aria-label="comparison">
      <option value="exactly">exactly</option><option value="atLeast">at least</option><option value="atMost">at most</option>
    </select>
  );
  const symSelect = (sym: string, set: (s: string) => void) => (
    <select className={`${sel} font-mono`} value={sym} onChange={(e) => set(e.target.value)} aria-label="symbol">
      {sigma.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
  const int = (v: number, set: (n: number) => void, label: string, min = 0, max = 20) => (
    <input type="number" className={num} value={v} min={min} max={max} aria-label={label} onChange={(e) => set(Math.max(min, Math.min(max, parseInt(e.target.value || '0', 10))))} />
  );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-edge bg-void/50 px-2 py-2">
      <span className="math w-5 text-center text-xs text-slate-deep">{i + 1}</span>
      {c.kind === 'sequence' ? <span className="text-sm text-ink">ordered pattern</span> : <select className={sel} value={c.kind} onChange={(e) => onChange(defaultCondition(e.target.value as ConditionKind, sigma))} aria-label={`Condition ${i + 1} type`}>
        {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
      </select>}
      {(c.kind === 'startsWith' || c.kind === 'endsWith' || c.kind === 'contains' || c.kind === 'notContains') && (
        <input className={`${num} w-28`} value={c.w} aria-label="string" spellCheck={false} onChange={(e) => onChange({ ...c, w: e.target.value.replace(/\s+/g, '') })} />
      )}
      {c.kind === 'count' && (<>{symSelect(c.sym, (sym) => onChange({ ...c, sym }))}{opSelect(c.op, (op) => onChange({ ...c, op }))}{int(c.n, (n) => onChange({ ...c, n }), 'count')}</>)}
      {c.kind === 'countMod' && (<>{symSelect(c.sym, (sym) => onChange({ ...c, sym }))}<span className="text-sm text-slate">mod</span>{int(c.m, (m) => onChange({ ...c, m, r: Math.min(c.r, m - 1) }), 'modulus', 2, 12)}<span className="text-sm text-slate">=</span>{int(c.r, (r) => onChange({ ...c, r }), 'remainder', 0, c.m - 1)}</>)}
      {c.kind === 'length' && (<>{opSelect(c.op, (op) => onChange({ ...c, op }))}{int(c.n, (n) => onChange({ ...c, n }), 'length')}</>)}
      {c.kind === 'lengthMod' && (<><span className="text-sm text-slate">mod</span>{int(c.m, (m) => onChange({ ...c, m, r: Math.min(c.r, m - 1) }), 'modulus', 2, 12)}<span className="text-sm text-slate">=</span>{int(c.r, (r) => onChange({ ...c, r }), 'remainder', 0, c.m - 1)}</>)}
      <span className="text-xs text-slate">({describeCondition(c)})</span>
      <button className="ml-auto text-xs text-slate hover:text-danger" onClick={onRemove} aria-label={`Remove condition ${i + 1}`}>Remove</button>
    </div>
  );
}

/**
 * Describe any language (in words or as conditions). The app generates a grammar
 * for it, converts the grammar to a PDA and loads it into the simulator.
 */
export function LanguageBuilder({ compact = false, onBuilt }: { compact?: boolean; onBuilt?: () => void }) {
  const lab = useLab();
  const [alphabet, setAlphabet] = useState(lab.customLang ? lab.customLang.sigma.join(', ') : 'a, b');
  const [text, setText] = useState(lab.customLang ? lab.customLang.summary.replace(/^have the form /, '') : '');
  const [rows, setRows] = useState<Condition[]>(lab.customLang?.conditions ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const sigma = parseAlphabet(alphabet);

  useEffect(() => { if (lab.customLang) setRows(lab.customLang.conditions); }, [lab.customLang]);

  const build = (conds: Condition[]) => {
    const res = buildLanguage(conds, sigma);
    if (!res.ok) { setErrors([res.error]); setInfo(null); return; }
    lab.loadLanguage(res.lang);
    setErrors([]);
    setInfo(currentText(res.lang));
    onBuilt?.();
  };

  const fromText = (t: string) => {
    setText(t);
    if (sigma.length === 0) { setErrors(['Enter the alphabet first, for example a, b.']); return; }
    const out = parseDescription(t, sigma);
    if (out.built) {
      lab.loadLanguage(out.built);
      setRows([]);
      setErrors([]);
      setInfo(currentText(out.built));
      onBuilt?.();
      return;
    }
    if (out.pattern) {
      const p = presetById(out.pattern)!;
      lab.applyPreset(p.id);
      setErrors([]);
      setInfo(`“${t}” is not a regular language: it needs the stack to count. Loaded the context-free grammar ${p.grammar.replace(/\n/g, '; ')} for ${p.language}.`);
      onBuilt?.();
      return;
    }
    setRows(out.conditions);
    if (out.errors.length) { setErrors(out.errors); setInfo(null); return; }
    build(out.conditions);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div className="flex flex-col gap-1">
          <label htmlFor={`lang-text-${compact}`} className="label">Describe the language in words</label>
          <div className="flex gap-2">
            <input id={`lang-text-${compact}`} className="field min-w-0 font-sans text-[15px]" value={text} spellCheck={false}
              placeholder="e.g. ending with two a and containing 3 b"
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') fromText(text); }} />
            <button className="btn btn-primary shrink-0" onClick={() => fromText(text)} disabled={!text.trim()}>Build PDA</button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`lang-sigma-${compact}`} className="label">Alphabet Σ</label>
          <input id={`lang-sigma-${compact}`} className="field" value={alphabet} spellCheck={false} onChange={(e) => setAlphabet(e.target.value)} />
        </div>
      </div>

      <details className="text-xs text-slate">
        <summary className="cursor-pointer select-none hover:text-ink">What can I write?</summary>
        <ul className="mt-1.5 flex list-disc flex-col gap-0.5 pl-5">
          <li><b className="text-ink">Properties</b>: starting / ending with aa, containing aba, not containing bb, containing 3 b (exactly), at least / at most 2 a, even / odd number of a, even length, length at least 3. Join them with “and”.</li>
          <li><b className="text-ink">Blocks in order</b>: 2 a followed by 4 b, any number of a followed by b, one or more a then at most 2 b, or notation a^2 b^4, a* b+.</li>
          <li><b className="text-ink">Linked counts (context-free)</b>: n a followed by 2n b, a^n b^n, a^n c b^n, a^(n+1) b^n, a^n b^m c^m d^n, “where n ≥ 1”.</li>
          <li>Not context-free, so no PDA exists, and the app explains why: a^n b^n c^n, a^n b^m c^n d^m.</li>
        </ul>
      </details>
      <div className="flex flex-wrap gap-1.5" aria-label="Example descriptions">
        {EXAMPLES.slice(0, compact ? 8 : EXAMPLES.length).map((e) => (
          <button key={e} className="btn min-h-[30px] px-2 text-xs" onClick={() => fromText(e)}>{e}</button>
        ))}
      </div>

      <div aria-live="polite" className="flex flex-col gap-1.5">
        {errors.map((e, k) => (
          <p key={k} className="rounded border border-danger/40 bg-danger/[0.07] px-3 py-2 text-sm text-ink"><span className="mr-2 font-semibold text-danger">Can’t build this.</span>{e}</p>
        ))}
        {info && !errors.length && <p className="rounded border border-lime/40 bg-lime/[0.06] px-3 py-2 text-sm text-ink">{info}</p>}
        {!info && !errors.length && lab.customLang && (
          <p className="rounded border border-lime/40 bg-lime/[0.06] px-3 py-2 text-sm text-ink">{currentText(lab.customLang)}</p>
        )}
      </div>

      {!compact && (
        <div className="flex flex-col gap-2">
          <div className="label">Conditions (all must hold) · edit them directly if you prefer</div>
          {rows.map((c, i) => (
            <ConditionRow key={i} i={i} c={c} sigma={sigma} onChange={(n) => setRows(rows.map((r, k) => (k === i ? n : r)))} onRemove={() => setRows(rows.filter((_, k) => k !== i))} />
          ))}
          <div className="flex flex-wrap gap-2">
            <button className="btn min-h-[34px] text-sm" onClick={() => setRows([...rows, defaultCondition('endsWith', sigma)])}>+ Add condition</button>
            <button className="btn btn-primary min-h-[34px] text-sm" onClick={() => build(rows)} disabled={!rows.length}>Build PDA from conditions</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Table of generated variables and what each one remembers. */
export function VariableMeanings() {
  const { customLang, g } = useLab();
  if (!customLang) return null;
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead><tr className="border-b border-edge"><th className="label py-2 pr-3">Variable</th><th className="label py-2 pr-3">Productions</th><th className="label py-2">Remembers about the prefix generated so far</th></tr></thead>
        <tbody>
          {g.variables.map((v) => (
            <tr key={v} className="border-b border-edge/60 align-top">
              <td className="math py-1.5 pr-3 font-bold text-magenta">{v}</td>
              <td className="math whitespace-nowrap py-1.5 pr-3">{v} → {g.productions.filter((p) => p.lhs === v).map((p) => p.rhs.join('') || 'ε').join(' | ')}</td>
              <td className="py-1.5 text-slate">{customLang.meaning[v]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
