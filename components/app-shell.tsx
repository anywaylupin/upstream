import type { ReactNode } from "react";

export function AppShell({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      {header}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6 md:px-8">
        {children}
      </main>
    </div>
  );
}
