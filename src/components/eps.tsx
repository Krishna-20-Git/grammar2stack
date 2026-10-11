import type { ReactNode } from 'react';

/** Keep ε lowercase inside uppercase labels (CSS uppercase would turn it into Ε). */
export function keepEps(text: string): ReactNode {
  if (!text.includes('ε')) return text;
  return text.split('ε').flatMap((part, i) => (i ? [<span key={i} className="normal-case">ε</span>, part] : [part]));
}
