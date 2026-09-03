import { LayersIcon, SearchIcon } from 'lucide-react';
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
import { getNavCounts } from '@/lib/repo-stats';

export async function AppHeader() {
  const session = await auth();
  const user = session?.user;
  const [nav, ai] = user?.id
    ? await Promise.all([getNavCounts(user.id), getUserAiSummary(user.id)])
    : [
        { stack: 0, releases30d: 0 },
        { modelId: '', keyedProviders: [] as string[], serverProviders: [] as string[] }
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
              <ModelMenu
                activeModelId={ai.modelId}
                keyedProviders={ai.keyedProviders}
                serverProviders={ai.serverProviders}
              />
              <CreateMenu />

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
