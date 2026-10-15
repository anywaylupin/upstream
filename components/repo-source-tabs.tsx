'use client';

import { BookmarkIcon, EyeIcon, type LucideIcon, SearchIcon, StarIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from 'tailwind-variants';
import { LinkPendingIcon } from '@/components/link-pending';
import { REPO_SOURCES, type RepoSource } from '@/lib/repo-sources';

/**
 * Icons are matched to ids here rather than passed in: these tabs are a client component, and a server component cannot hand it a component reference without it arriving as a client-reference proxy.
 *
 * Every tab uses the one brand underline. They used to get a hue each, but colour is reserved for meaning, and these are just views.
 */
const ICONS: Record<RepoSource, LucideIcon> = {
  following: BookmarkIcon,
  owned: UserIcon,
  watched: EyeIcon,
  starred: StarIcon,
  search: SearchIcon
};

export function RepoSourceTabs({ active }: { active: RepoSource }) {
  return (
    <nav aria-label="Repository source" className="flex flex-wrap items-center gap-1 border-border border-b">
      {REPO_SOURCES.map((source) => {
        const isActive = source.id === active;

        return (
          <Link
            key={source.id}
            href={source.id === 'following' ? '/stack' : `/stack?source=${source.id}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
              isActive
                ? 'border-brand font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <LinkPendingIcon icon={ICONS[source.id]} className="size-4" />
            {source.label}
          </Link>
        );
      })}
    </nav>
  );
}
