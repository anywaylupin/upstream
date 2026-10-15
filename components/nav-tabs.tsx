'use client';

import { HouseIcon, LibraryIcon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'tailwind-variants';
import { LinkPendingBar, LinkPendingIcon } from '@/components/link-pending';
import { Badge } from '@/components/ui/badge';

type Tab = { href: string; label: string; icon: LucideIcon; count?: number };

/**
 * Two places, one job each: Home is what changed, Library is what you follow.
 * It was four tabs, and two pairs of them answered the same question.
 */
export function NavTabs({ stackCount, digestCount }: { stackCount: number; digestCount: number }) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: '/', label: 'Home', icon: HouseIcon, count: digestCount },
    { href: '/stack', label: 'Library', icon: LibraryIcon, count: stackCount }
  ];

  return (
    <nav className="min-w-0">
      <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <LinkPendingIcon
                icon={tab.icon}
                className={cn('size-4 transition-transform duration-200 group-hover:scale-110', active && 'text-brand')}
              />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {tab.count}
                </Badge>
              )}
              <LinkPendingBar />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
