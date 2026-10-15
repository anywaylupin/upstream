import { signInWithGitHub } from '@/app/actions/account';
import { OwnerAvatar } from '@/components/owner-avatar';
import { GitHubIcon } from '@/components/provider-icon';
import { ScoreRing } from '@/components/score-ring';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { VerdictBadge } from '@/components/verdict-badge';
import type { UpgradeVerdict } from '@/lib/digest-filters';

type Row = {
  owner: string;
  name: string;
  tag: string;
  when: string;
  headline: string;
  verdict: UpgradeVerdict;
  score: number;
};

/**
 * The feed as it looks after sign-in, drawn with the real row parts.
 * It fades out at the bottom instead of carrying a "sample" caption: a visual that reads as the product needs no label.
 */
const ROWS: Row[] = [
  {
    owner: 'vercel',
    name: 'next.js',
    tag: 'v16.3.0',
    when: '2h',
    headline: 'fetch() is no longer cached by default.',
    verdict: 'breaking',
    score: 8.2
  },
  {
    owner: 'drizzle-team',
    name: 'drizzle-orm',
    tag: 'v0.45.2',
    when: '5h',
    headline: 'findMany returns [] instead of null when nothing matches.',
    verdict: 'review',
    score: 7.6
  },
  {
    owner: 'facebook',
    name: 'react',
    tag: 'v19.2.1',
    when: '1d',
    headline: 'Fixes a hydration warning inside Suspense boundaries.',
    verdict: 'safe',
    score: 9.1
  },
  {
    owner: 'tailwindlabs',
    name: 'tailwindcss',
    tag: 'v4.2.0',
    when: '2d',
    headline: 'New @container query variants and faster rebuilds.',
    verdict: 'safe',
    score: 8.9
  },
  {
    owner: 'nodejs',
    name: 'node',
    tag: 'v25.0.0',
    when: '3d',
    headline: 'Drops Node 20 era OpenSSL defaults.',
    verdict: 'breaking',
    score: 9.3
  }
];

/** The signed-out home: one headline, one action, one picture of the product. */
export function Landing() {
  return (
    <div
      data-landing
      className="mx-auto flex h-full w-full max-w-3xl flex-col items-center gap-10 overflow-hidden pt-8 sm:pt-16"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="max-w-2xl text-balance font-heading font-semibold text-4xl tracking-tight sm:text-5xl">
          Know what breaks before you upgrade.
        </h1>
        <p className="max-w-md text-balance text-lg text-muted-foreground">
          Release notes from every repo you depend on, summarized.
        </p>
        <form action={signInWithGitHub}>
          <Button type="submit" size="lg">
            <GitHubIcon data-icon="inline-start" />
            Sign in with GitHub
          </Button>
        </form>
      </div>

      <div
        aria-hidden="true"
        className="min-h-0 w-full flex-1 animate-rise overflow-hidden rounded-xl border bg-card p-2 shadow-sm [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      >
        <ItemGroup className="gap-1">
          {ROWS.map((row) => (
            <Item key={row.name} size="sm">
              <ItemMedia>
                <OwnerAvatar owner={row.owner} size={28} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>
                  {row.name}
                  <span className="font-mono font-normal text-muted-foreground text-xs">{row.tag}</span>
                </ItemTitle>
                <ItemDescription className="truncate">{row.headline}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <span className="hidden text-muted-foreground text-xs tabular-nums sm:inline">{row.when}</span>
                <VerdictBadge verdict={row.verdict} />
                <ScoreRing score={row.score} size={32} className="hidden sm:inline-flex" />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </div>
    </div>
  );
}
