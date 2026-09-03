'use client';

import { BookMarkedIcon, GaugeIcon, LayersIcon, MenuIcon, NewspaperIcon, SearchIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from 'tailwind-variants';
import { LinkPendingIcon } from '@/components/link-pending';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const LINKS = [
  { href: '/', label: 'Dashboard', icon: GaugeIcon },
  { href: '/digest', label: 'Digest', icon: NewspaperIcon },
  { href: '/stack', label: 'Stack', icon: LayersIcon },
  { href: '/repositories', label: 'Repositories', icon: BookMarkedIcon },
  { href: '/search', label: 'Search', icon: SearchIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon }
];

/**
 * The tab strip does not survive a phone-width header, so below md the nav
 * moves in here instead of being squeezed off the edge.
 */
export function MobileNav({ stackCount, digestCount }: { stackCount: number; digestCount: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const counts: Record<string, number> = {
    '/digest': digestCount,
    '/stack': stackCount
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="md:hidden" />} aria-label="Menu">
        <MenuIcon />
      </SheetTrigger>

      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle>Upstream</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-0.5 p-2">
          {LINKS.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href) || (link.href === '/stack' && pathname.startsWith('/repos/'));
            const count = counts[link.href];

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  active
                    ? 'bg-muted font-semibold text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <LinkPendingIcon icon={link.icon} className={cn('size-4', active && 'text-primary')} />
                {link.label}
                {count !== undefined && count > 0 && (
                  <span className="ml-auto rounded-full bg-muted px-1.5 text-muted-foreground text-xs tabular-nums">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
