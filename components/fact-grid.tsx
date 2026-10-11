import type { ReactNode } from 'react';

/** Labelled cells: a small grey label over a value. Used for repo and account facts. */
export function FactGrid({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl ring-1 ring-foreground/10 sm:grid-cols-3 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:divide-x lg:divide-border">
      {facts.map((fact) => (
        <div key={fact.label} className="flex min-w-0 flex-col gap-1 px-4 py-3">
          <dt className="text-muted-foreground text-xs">{fact.label}</dt>
          <dd className="flex min-h-7 items-center truncate font-medium text-sm tabular-nums">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
