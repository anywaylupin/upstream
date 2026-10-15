import type { ReactNode } from 'react';

export function AppShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col has-[[data-landing]]:h-svh has-[[data-landing]]:overflow-hidden">
      {header}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6 has-[[data-landing]]:min-h-0 md:px-8">
        {children}
      </main>
    </div>
  );
}
