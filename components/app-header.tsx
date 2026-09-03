import { BellIcon, GitPullRequestArrowIcon, LayersIcon, SearchIcon, ShieldAlertIcon } from 'lucide-react';
import Link from 'next/link';
import { signInWithGitHub } from '@/app/actions';
import { auth } from '@/auth';
import { CreateMenu } from '@/components/create-menu';
import { HeaderSearch } from '@/components/header-search';
import { MobileNav } from '@/components/mobile-nav';
import { ModelMenu } from '@/components/model-menu';
import { NavTabs } from '@/components/nav-tabs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserMenu } from '@/components/user-menu';
import { getUserAiSummary } from '@/lib/ai-settings';
import { getHeaderCounts, getNavCounts } from '@/lib/repo-stats';

function CountLink({
  href,
  label,
  count,
  icon: Icon,
  danger
}: {
  href: string;
  label: string;
  count: number;
  icon: typeof BellIcon;
  danger?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-label={`${label}: ${count}`}
            className="relative hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
          />
        }
      >
        <Icon className="size-4" />
        {count > 0 && (
          <span
            className={
              danger
                ? 'absolute -top-0.5 -right-0.5 flex min-w-4 justify-center rounded-full bg-destructive px-1 font-medium text-[10px] text-white leading-4'
                : 'absolute -top-0.5 -right-0.5 flex min-w-4 justify-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground leading-4'
            }
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {label}: {count}
      </TooltipContent>
    </Tooltip>
  );
}

export async function AppHeader() {
  const session = await auth();
  const user = session?.user;
  const [counts, nav, ai] = user?.id
    ? await Promise.all([getHeaderCounts(user.id), getNavCounts(user.id), getUserAiSummary(user.id)])
    : [
        { breaking: 0, upgrades: 0, fresh: 0 },
        { stack: 0, releases30d: 0 },
        { modelId: '', keyedProviders: [] as string[] }
      ];

  return (
    <header className="sticky top-0 z-40 border-border border-b bg-card">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-2.5 md:px-6">
        {user && <MobileNav stackCount={nav.stack} digestCount={nav.releases30d} />}

        <Link href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
          <LayersIcon className="size-5 text-primary" />
          <span className="font-heading font-semibold text-sm tracking-tight">Upstream</span>
        </Link>

        {/* Nav lives in the header itself rather than a second strip below it. */}
        {user && (
          <div className="hidden min-w-0 flex-1 md:block">
            <NavTabs stackCount={nav.stack} digestCount={nav.releases30d} />
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <div className="hidden sm:block">
                <HeaderSearch />
              </div>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href="/search"
                      aria-label="Search"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
                    />
                  }
                >
                  <SearchIcon className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Search</TooltipContent>
              </Tooltip>
              <ModelMenu activeModelId={ai.modelId} keyedProviders={ai.keyedProviders} />
              <CreateMenu />

              <div className="flex items-center gap-0.5">
                <CountLink
                  href="/digest?types=breaking"
                  label="Breaking changes"
                  count={counts.breaking}
                  icon={ShieldAlertIcon}
                  danger
                />
                <CountLink
                  href="/digest?effort=medium,high"
                  label="Upgrades needing work"
                  count={counts.upgrades}
                  icon={GitPullRequestArrowIcon}
                />
                <CountLink href="/digest?days=7" label="Released this week" count={counts.fresh} icon={BellIcon} />
              </div>

              <UserMenu name={user.name ?? user.email ?? 'You'} image={user.image ?? undefined} />
            </>
          ) : (
            <form action={signInWithGitHub}>
              <Button type="submit" size="sm" variant="outline">
                Sign in with GitHub
              </Button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
