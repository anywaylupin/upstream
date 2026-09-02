import {
  BellIcon,
  GitPullRequestArrowIcon,
  LayersIcon,
  ShieldAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { signInWithGitHub } from "@/app/actions";
import { auth } from "@/auth";
import { CreateMenu } from "@/components/create-menu";
import { HeaderSearch } from "@/components/header-search";
import { NavTabs } from "@/components/nav-tabs";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { getHeaderCounts, getNavCounts } from "@/lib/repo-stats";

function CountLink({
  href,
  label,
  count,
  icon: Icon,
  danger,
}: {
  href: string;
  label: string;
  count: number;
  icon: typeof BellIcon;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${count}`}
      title={`${label}: ${count}`}
      className="relative hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
    >
      <Icon className="size-4" />
      {count > 0 && (
        <span
          className={
            danger
              ? "absolute -top-0.5 -right-0.5 flex min-w-4 justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-medium text-white"
              : "absolute -top-0.5 -right-0.5 flex min-w-4 justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-medium text-primary-foreground"
          }
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export async function AppHeader() {
  const session = await auth();
  const user = session?.user;
  const [counts, nav] = user?.id
    ? await Promise.all([getHeaderCounts(user.id), getNavCounts(user.id)])
    : [
        { breaking: 0, upgrades: 0, fresh: 0 },
        { stack: 0, releases30d: 0 },
      ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-2.5 md:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
        >
          <LayersIcon className="size-5 text-primary" />
          <span className="font-heading text-sm font-semibold tracking-tight">
            Upstream
          </span>
        </Link>

        {/* Nav lives in the header itself rather than a second strip below it. */}
        {user && (
          <NavTabs stackCount={nav.stack} digestCount={nav.releases30d} />
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <HeaderSearch />
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
                <CountLink
                  href="/digest?days=7"
                  label="Released this week"
                  count={counts.fresh}
                  icon={BellIcon}
                />
              </div>

              <UserMenu
                name={user.name ?? user.email ?? "You"}
                image={user.image ?? undefined}
              />
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
