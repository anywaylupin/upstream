import {
  BoxesIcon,
  FolderGit2Icon,
  KeyRoundIcon,
  LayersIcon,
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
    body: 'Pull in repos you already own or watch.',
    href: '/repositories',
    cta: 'Open'
  },
  {
    icon: MessageSquareTextIcon,
    title: 'Tell it what you care about',
    body: 'Per-feature instructions shape every summary.',
    href: '/settings?section=instructions',
    cta: 'Set up'
  },
  {
    icon: KeyRoundIcon,
    title: 'Bring your own AI key',
    body: 'Run summaries on your own quota, not the shared one.',
    href: '/settings?section=keys',
    cta: 'Add key'
  }
];

/** What the dashboard shows before there is anything to report on. */
export function DashboardEmpty() {
  return (
    <div className="flex w-full flex-col gap-6">
      <EmptyStack
        icon={LayersIcon}
        title="Your stack is empty"
        description="Add a repo and Upstream starts reading its releases, flagging what breaks and rating the project."
      />

      <section className="flex flex-col gap-2.5">
        <h2 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
          <BoxesIcon className="size-3.5" />
          What Upstream runs on
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SUGGESTED_REPOS.map((repo, i) => (
            <li
              key={`${repo.owner}/${repo.name}`}
              style={{ animationDelay: `${i * 50}ms` }}
              className="lift animate-rise rounded-lg p-3 ring-1 ring-foreground/10 hover:ring-primary/40"
            >
              <Item size="sm" className="p-0">
                <ItemMedia>
                  <OwnerAvatar owner={repo.owner} size={24} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    <Link
                      href={`/repos/${repo.owner}/${repo.name}`}
                      className="transition-colors hover:text-primary hover:underline"
                    >
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
        <h2 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
          <ListChecksIcon className="size-3.5" />
          Next steps
        </h2>

        <ul className="grid gap-3 lg:grid-cols-3">
          {NEXT_STEPS.map((step, i) => (
            <li key={step.title} style={{ animationDelay: `${(i + 3) * 50}ms` }} className="animate-rise">
              <Link
                href={step.href}
                className="lift group flex h-full flex-col gap-1 rounded-lg p-4 ring-1 ring-foreground/10 hover:ring-primary/40"
              >
                <span className="flex items-center gap-2 font-medium text-sm transition-colors group-hover:text-primary">
                  <step.icon className="size-4 text-primary" />
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
