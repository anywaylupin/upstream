'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from 'tailwind-variants';
import { LinkPendingBar } from '@/components/link-pending';

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all duration-200',
        '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200',
        'hover:[&_svg]:scale-110',
        active
          ? 'bg-muted font-medium text-foreground [&_svg]:text-primary'
          : 'text-muted-foreground hover:translate-x-0.5 hover:bg-muted/60 hover:text-foreground'
      )}
    >
      {children}
      <LinkPendingBar />
    </Link>
  );
}
