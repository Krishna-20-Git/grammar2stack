import { keepEps } from './eps';
import type { ReactNode } from 'react';

export function Panel({ title, eyebrow, actions, children, className = '', id }: {
  title?: ReactNode; eyebrow?: string; actions?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section id={id} className={`panel flex flex-col gap-3 p-4 ${className}`}>
      {(title || eyebrow || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {eyebrow && <div className="label">{keepEps(eyebrow)}</div>}
            {title && <h2 className="h-section">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
