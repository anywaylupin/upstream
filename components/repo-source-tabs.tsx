'use client';

import { EyeIcon, type LucideIcon, SearchIcon, StarIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from 'tailwind-variants';
import { LinkPendingIcon } from '@/components/link-pending';
import { REPO_SOURCES, type RepoSource } from '@/lib/repo-sources';

/**
 * Icons and colours are matched to ids here rather than passed in: these tabs
 * are a client component, and a server component cannot hand it a component
 * reference without it arriving as a client-reference proxy.
 *
 * Each source gets its own hue so the four views stay distinguishable at a
 * glance - they are different accounts of your GitHub, not steps in a flow.
 */
const LOOKS: Record<RepoSource, { icon: LucideIcon; active: string; idle: string }> = {
  owned: {
    icon: UserIcon,
    active: 'border-sky-500 text-sky-700 dark:text-sky-400',
    idle: 'hover:border-sky-500/40 hover:text-sky-700 dark:hover:text-sky-400'
  },
  watched: {
    icon: EyeIcon,
    active: 'border-violet-500 text-violet-700 dark:text-violet-400',
    idle: 'hover:border-violet-500/40 hover:text-violet-700 dark:hover:text-violet-400'
  },
  starred: {
    icon: StarIcon,
    active: 'border-amber-500 text-amber-700 dark:text-amber-400',
    idle: 'hover:border-amber-500/40 hover:text-amber-700 dark:hover:text-amber-400'
  },
  search: {
    icon: SearchIcon,
    active: 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
    idle: 'hover:border-emerald-500/40 hover:text-emerald-700 dark:hover:text-emerald-400'
  }
};

export function RepoSourceTabs({ active }: { active: RepoSource }) {
  return (
    <nav aria-label="Repository source" className="flex flex-wrap items-center gap-1 border-border border-b">
      {REPO_SOURCES.map((source) => {
        const look = LOOKS[source.id];
        const isActive = source.id === active;

        return (
          <Link
            key={source.id}
            href={`/repositories?source=${source.id}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
              isActive ? cn('font-semibold', look.active) : cn('border-transparent text-muted-foreground', look.idle)
            )}
          >
            <LinkPendingIcon icon={look.icon} className="size-4" />
            {source.label}
          </Link>
        );
      })}
    </nav>
  );
}
