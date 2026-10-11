import { useEffect, useMemo, useRef, useState } from 'react';
import { parseGrammar, PRESETS } from '../core';
import { useLab } from '../hooks/useLab';

/** Editable grammar with live validation. Only valid grammars are applied. */
export function GrammarEditor() {
  const lab = useLab();
  const [draft, setDraft] = useState(lab.grammarText);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(lab.grammarText), [lab.grammarText]);
  const parsed = useMemo(() => parseGrammar(draft), [draft]);
  const dirty = draft.trim() !== lab.grammarText.trim();

  const insert = (s: string) => {
    const el = ta.current;
    if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd;
    const v = draft.slice(0, a) + s + draft.slice(b);
    setDraft(v);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + s.length; });
  };
  const apply = () => {
    if (!parsed.ok) return;
    const match = PRESETS.find((p) => p.grammar.trim() === draft.trim());
    lab.loadGrammar(draft.trim(), match?.id ?? null);
    if (match) lab.setInput(match.valid[0]);
  };

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="grammar-input" className="label">Productions P (one variable per line)</label>
      <textarea id="grammar-input" ref={ta} rows={5} spellCheck={false} autoCapitalize="off" autoComplete="off"
        value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) apply(); }}
        className="field resize-y text-[16px] leading-relaxed"
        aria-invalid={!parsed.ok} aria-describedby="grammar-status" />
      <div className="flex flex-wrap gap-2">
        <button className="btn min-h-[34px] px-2.5 text-sm" onClick={() => insert(' → ')}>Insert →</button>
        <button className="btn min-h-[34px] px-2.5 text-sm" onClick={() => insert(' | ')}>Insert |</button>
        <button className="btn min-h-[34px] px-2.5 text-sm" onClick={() => insert('ε')}>Insert ε</button>
        <button className="btn btn-primary ml-auto" onClick={apply} disabled={!parsed.ok || !dirty}>Apply grammar</button>
      </div>
      <div id="grammar-status" aria-live="polite">
        {parsed.ok ? (
          <p className="text-sm text-lime/90">
            Valid context-free grammar: {parsed.grammar.variables.length} variable{parsed.grammar.variables.length === 1 ? '' : 's'}, {parsed.grammar.terminals.length} terminal{parsed.grammar.terminals.length === 1 ? '' : 's'}, {parsed.grammar.productions.length} production{parsed.grammar.productions.length === 1 ? '' : 's'}.
            {dirty ? ' Press Apply grammar (or Ctrl+Enter) to rebuild the PDA.' : ''}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {parsed.errors.map((e, k) => (
              <li key={k} className="rounded border border-danger/40 bg-danger/[0.07] px-3 py-2 text-sm text-ink"><span className="mr-2 font-semibold text-danger">Syntax error.</span>{e.message}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className="label mb-1.5">Example grammars</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.id} className={`btn min-h-[32px] px-2.5 text-xs ${lab.presetId === p.id ? 'border-cyan/60 text-cyan' : ''}`} aria-pressed={lab.presetId === p.id}
              onClick={() => lab.applyPreset(p.id)}>{p.name}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate">
        Syntax: the left side is one capital letter; capital letters on the right are variables, any other character is a terminal; separate alternatives with |; write ε for the empty string. The left side of the first line is the start symbol.
      </p>
    </div>
  );
}

/** Input string field with example strings. */
export function InputEditor() {
  const lab = useLab();
  const [draft, setDraft] = useState(lab.input);
  useEffect(() => setDraft(lab.input), [lab.input]);
  const examples = lab.preset
    ? [...lab.preset.valid.map((s) => ({ s, ok: true })), ...lab.preset.invalid.map((s) => ({ s, ok: false }))]
    : [];
  const run = () => lab.setInput(draft.replace(/\s+/g, ''));
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="input-string" className="label">Input string w</label>
      <div className="flex gap-2">
        <input id="input-string" className="field min-w-0 text-[17px]" value={draft} maxLength={24} spellCheck={false} autoCapitalize="off" autoComplete="off"
          placeholder="ε (empty string)" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run(); }} />
        <button className="btn btn-primary shrink-0" onClick={run}>Run</button>
      </div>
      {lab.outsideAlphabet.length > 0 && (
        <p className="text-xs text-danger">"{lab.outsideAlphabet[0]}" is not in Σ = {'{'}{lab.g.terminals.join(', ')}{'}'}, so no match transition can read it. The string will be rejected.</p>
      )}
      {examples.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="label">Examples from the language and outside it</div>
          <div className="flex flex-wrap gap-1.5">
            {examples.map(({ s, ok }) => (
              <button key={s + ok} onClick={() => lab.setInput(s)} aria-pressed={lab.input === s}
                className={`btn min-h-[30px] px-2 font-mono text-xs ${lab.input === s ? (ok ? 'border-lime/60 text-lime' : 'border-danger/60 text-danger') : ''}`}>
                {s || 'ε'} <span className={ok ? 'text-lime/70' : 'text-danger/70'} aria-label={ok ? 'in L' : 'not in L'}>{ok ? '∈' : '∉'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
