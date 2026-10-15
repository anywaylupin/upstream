'use client';

import { BellIcon, BookmarkIcon, FolderGit2Icon, LayoutDashboardIcon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'tailwind-variants';
import { LinkPendingBar, LinkPendingIcon } from '@/components/link-pending';
import { Badge } from '@/components/ui/badge';

type Tab = { href: string; label: string; icon: LucideIcon; count?: number };

/** The underlined tab strip GitHub puts under the header on a profile. */
export function NavTabs({ stackCount, digestCount }: { stackCount: number; digestCount: number }) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboardIcon },
    {
      href: '/digest',
      label: 'Updates',
      icon: BellIcon,
      count: digestCount
    },
    { href: '/stack', label: 'Following', icon: BookmarkIcon, count: stackCount },
    { href: '/repositories', label: 'Repositories', icon: FolderGit2Icon }
  ];

  return (
    <nav className="min-w-0">
      <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href) || (tab.href === '/stack' && pathname.startsWith('/repos/'));

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
                className={cn(
                  'size-4 transition-transform duration-200 group-hover:scale-110',
                  active && 'text-primary'
                )}
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
