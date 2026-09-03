'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from 'tailwind-variants';
import { TableRow } from '@/components/ui/table';

/**
 * Whole-row navigation. Buttons inside stop propagation so their own action
 * still wins; the repo name stays a real link for middle-click and a11y.
 */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();

  return (
    <TableRow onClick={() => router.push(href)} className={cn('group/row cursor-pointer', className)}>
      {children}
    </TableRow>
  );
}
