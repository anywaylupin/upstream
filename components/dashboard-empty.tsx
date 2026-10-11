import {
  BookmarkIcon,
  BoxesIcon,
  FolderGit2Icon,
  KeyRoundIcon,
  ListChecksIcon,
  MessageSquareTextIcon
} from 'lucide-react';
import Link from 'next/link';
import { EmptyStack } from '@/components/empty-stack';
import { OwnerAvatar } from '@/components/owner-avatar';
import { StackButton } from '@/components/stack-button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { SUGGESTED_REPOS } from '@/lib/suggested-repos';

const NEXT_STEPS = [
  {
    icon: FolderGit2Icon,
    title: 'Browse your GitHub',
    body: 'Repos you own or watch.',
    href: '/repositories',
    cta: 'Open'
  },
  {
    icon: MessageSquareTextIcon,
    title: 'Set instructions',
    body: 'Shape every summary.',
    href: '/settings?section=ai',
    cta: 'Set up'
  },
  {
    icon: KeyRoundIcon,
    title: 'Add an AI key',
    body: 'Use your own quota.',
    href: '/settings?section=ai',
    cta: 'Add key'
  }
];

/** What the dashboard shows before there is anything to report on. */
export function DashboardEmpty() {
  return (
    <div className="flex w-full flex-col gap-6">
      <EmptyStack icon={BookmarkIcon} title="Not following anything yet" description="Add a repo to start." />

      <section className="flex flex-col gap-2.5">
        <h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <BoxesIcon className="size-4 text-muted-foreground" />
          What Upstream runs on
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SUGGESTED_REPOS.map((repo, i) => (
            <li
              key={`${repo.owner}/${repo.name}`}
              style={{ animationDelay: `${i * 50}ms` }}
              className="lift animate-rise rounded-lg p-3 ring-1 ring-foreground/10 hover:ring-foreground/25"
            >
              <Item size="sm" className="p-0">
                <ItemMedia>
                  <OwnerAvatar owner={repo.owner} size={24} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    <Link href={`/repos/${repo.owner}/${repo.name}`} className="hover:underline">
                      {repo.owner}/{repo.name}
                    </Link>
                  </ItemTitle>
                  <ItemDescription>{repo.blurb}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StackButton owner={repo.owner} name={repo.name} />
                </ItemActions>
              </Item>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <ListChecksIcon className="size-4 text-muted-foreground" />
          Next steps
        </h2>

        <ul className="grid gap-3 lg:grid-cols-3">
          {NEXT_STEPS.map((step, i) => (
            <li key={step.title} style={{ animationDelay: `${(i + 3) * 50}ms` }} className="animate-rise">
              <Link
                href={step.href}
                className="lift group flex h-full flex-col gap-1 rounded-lg p-4 ring-1 ring-foreground/10 hover:ring-foreground/25"
              >
                <span className="flex items-center gap-2 font-medium text-sm transition-colors group-hover:underline">
                  <step.icon className="size-4 text-muted-foreground" />
                  {step.title}
                </span>
                <span className="text-muted-foreground text-sm">{step.body}</span>
                <span className="mt-auto pt-2 text-muted-foreground text-xs">{step.cta} →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
