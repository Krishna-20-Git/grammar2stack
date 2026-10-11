import { useEffect, useState } from 'react';
import { DEFAULT_BOUNDS, search, type Verdict } from '../core';
import { useLab } from '../hooks/useLab';

interface Row { w: string; verdict: Verdict['kind']; moves: number; expected: boolean | null }

const MAX = 200;

/**
 * Test many strings at once with the same PDA engine. For languages built from a
 * description, each result is also checked against the description.
 */
export function BatchTester() {
  const lab = useLab();
  const { g, pda, membership } = lab;
  const [text, setText] = useState('');
  const [maxLen, setMaxLen] = useState(4);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => { setRows(null); setNote(''); }, [g]);

  const run = (strings: string[]) => {
    const uniq = [...new Set(strings)].slice(0, MAX);
    const out = uniq.map((w) => {
      const r = search(g, pda, Array.from(w), DEFAULT_BOUNDS);
      const accNode = r.acceptingNode >= 0 ? r.nodes[r.acceptingNode] : null;
      return { w, verdict: r.verdict.kind, moves: accNode ? accNode.depth : 0, expected: membership ? membership(w) : null };
    });
    setRows(out);
    setNote(strings.length > MAX ? `Showing the first ${MAX} strings.` : '');
  };

  const fromText = () => {
    const parts = text.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => s.length > 0).map((s) => (s === 'ε' || s.toLowerCase() === 'eps' ? '' : s));
    run(parts);
  };
  const allUpTo = () => {
    const sigma = g.terminals;
    const out = [''];
    let layer = [''];
    for (let k = 0; k < maxLen && out.length < MAX; k++) {
      layer = layer.flatMap((s) => sigma.map((c) => s + c));
      out.push(...layer);
    }
    run(out);
  };

  const accepted = rows?.filter((r) => r.verdict === 'accepted').length ?? 0;
  const disagree = rows?.filter((r) => r.expected !== null && (r.verdict === 'accepted') !== r.expected).length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="batch-input" className="label">Strings to test (separate with spaces or commas; <span className="normal-case">ε</span> for the empty string)</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="batch-input" className="field min-w-0" value={text} spellCheck={false} autoCapitalize="off"
            placeholder={lab.preset?.valid.concat(lab.preset.invalid).slice(0, 6).map((s) => s || 'ε').join(' ') ?? 'aab abba ε'}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') fromText(); }} />
          <button className="btn btn-primary shrink-0" onClick={fromText} disabled={!text.trim()}>Test these</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate">or every string over {'{'}{g.terminals.join(', ')}{'}'} up to length</span>
        <input type="number" min={0} max={8} value={maxLen} onChange={(e) => setMaxLen(Math.max(0, Math.min(8, parseInt(e.target.value || '0', 10))))}
          className="w-16 rounded border border-edge bg-void px-2 py-1.5 font-mono text-ink" aria-label="Maximum length" />
        <button className="btn min-h-[34px] text-sm" onClick={allUpTo}>Test all</button>
      </div>

      {rows && (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-live="polite">
            <span className="text-ink">{rows.length} tested</span>
            <span className="text-lime">{accepted} accepted</span>
            <span className="text-danger">{rows.length - accepted} not accepted</span>
            {membership && (disagree === 0
              ? <span className="text-lime">✓ every result agrees with the description</span>
              : <span className="text-danger">{disagree} disagree with the description</span>)}
            {note && <span className="text-slate">{note}</span>}
          </div>
          <div className="scroll-thin max-h-[360px] overflow-auto rounded border border-edge">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr className="border-b border-edge">
                  <th className="label px-3 py-2">String</th>
                  <th className="label px-3 py-2">PDA result</th>
                  <th className="label px-3 py-2">Moves</th>
                  {membership && <th className="label px-3 py-2">Description says</th>}
                  <th className="label px-3 py-2"><span className="sr-only">Animate</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.w} className="border-b border-edge/60">
                    <td className="math px-3 py-1.5 text-ink">{r.w || 'ε'}</td>
                    <td className="px-3 py-1.5">
                      <span className={`chip ${r.verdict === 'accepted' ? 'bg-lime/15 text-lime' : r.verdict === 'rejected' ? 'bg-danger/15 text-danger' : 'bg-violet/15 text-[#C4B5FD]'}`}>{r.verdict}</span>
                    </td>
                    <td className="math tabular px-3 py-1.5 text-slate">{r.verdict === 'accepted' ? r.moves : '—'}</td>
                    {membership && (
                      <td className="px-3 py-1.5 text-slate">{r.expected ? 'in L' : 'not in L'} {(r.verdict === 'accepted') === r.expected ? <span className="text-lime">✓</span> : <span className="text-danger">✗</span>}</td>
                    )}
                    <td className="px-3 py-1.5 text-right">
                      <button className="text-xs text-cyan underline-offset-2 hover:underline" onClick={() => { lab.setInput(r.w); lab.openWorkspace('simulate'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Animate</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
