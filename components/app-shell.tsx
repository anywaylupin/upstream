import type { ReactNode } from 'react';

/**
 * The page frame.
 * The skip link comes first so keyboard users can jump past the eight header controls on every page.
 */
export function AppShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col has-[[data-landing]]:h-svh has-[[data-landing]]:overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:text-sm"
      >
        Skip to content
      </a>
      {header}
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 has-[[data-landing]]:min-h-0 md:px-8"
      >
        {children}
      </main>
    </div>
  );
}
