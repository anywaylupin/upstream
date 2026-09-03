import { ArrowRightIcon, GitCompareIcon, LayersIcon, LogInIcon, NewspaperIcon, SparklesIcon } from 'lucide-react';
import { signInWithGitHub } from '@/app/actions';
import { RatingBars } from '@/components/rating-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

const SAMPLE_RATING = {
  overall: 8.2,
  grade: 'A' as const,
  parts: [
    { label: 'Activity', score: 9.4, hint: '18 releases in 90d' },
    { label: 'Stability', score: 7.8, hint: '2 breaking in 90d' },
    { label: 'Reach', score: 9.1, hint: '128,000 stars' },
    { label: 'Community', score: 8.6, hint: '27,000 forks' },
    { label: 'Upkeep', score: 9.2, hint: 'pushed 1d ago' }
  ]
};

const HOW_IT_WORKS = [
  {
    icon: LayersIcon,
    title: 'Add a repo',
    body: 'Paste a URL, search GitHub, or pull from repos you own and watch.'
  },
  {
    icon: NewspaperIcon,
    title: 'It reads the changelogs',
    body: 'Every release is summarized once and cached by content hash, so nothing is paid for twice.'
  },
  {
    icon: SparklesIcon,
    title: 'You get the short version',
    body: 'What changed, what breaks, how much work the upgrade is - shaped by instructions you set per feature.'
  }
];

export function Landing() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 py-8">
      <header className="flex flex-col items-start gap-4">
        <Badge variant="outline">GitHub sign-in required</Badge>
        <h1 className="font-heading font-semibold text-4xl tracking-tight">
          Release intel for the repos you depend on.
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Upstream reads every changelog, flags what breaks, rates the project, and tells you what to use instead. Bring
          your own AI key or start on the shared one.
        </p>
        <form action={signInWithGitHub}>
          <Button type="submit" size="lg" className="group">
            <LogInIcon data-icon="inline-start" className="transition-transform duration-200 group-hover:scale-110" />
            Sign in with GitHub
            <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">
          Read-only access to public repo data. No write scopes, no private repos.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">How it works</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <Card key={step.title} size="sm" style={{ animationDelay: `${i * 60}ms` }} className="animate-rise">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs tabular-nums">
                    {i + 1}
                  </span>
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">Preview</h2>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card size="sm" className="ring-2 ring-destructive/50">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-baseline gap-2">
                vercel/next.js
                <span className="font-mono font-normal text-muted-foreground text-xs">v16.3.0</span>
                <Badge variant="destructive">breaking</Badge>
                <span className="ml-auto font-normal text-muted-foreground text-xs">medium effort</span>
              </CardTitle>
              <span className="text-muted-foreground text-sm">New caching model for route handlers.</span>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1.5 text-sm">
                <li className="flex items-start gap-2">
                  <Badge variant="destructive" className="mt-0.5 shrink-0">
                    breaking
                  </Badge>
                  <span className="font-medium">fetch() no longer cached by default</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="mt-0.5 shrink-0">feature</Badge>
                  <span className="text-muted-foreground">`use cache` directive</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Rating
                <Badge>A · 8.2</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <RatingBars rating={SAMPLE_RATING} />
              <Item size="sm" className="p-0">
                <ItemMedia>
                  <GitCompareIcon className="size-4 text-muted-foreground" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Alternatives</ItemTitle>
                  <ItemDescription>remix-run/react-router · tanstack/router</ItemDescription>
                </ItemContent>
              </Item>
            </CardContent>
          </Card>
        </div>

        <p className="text-muted-foreground text-xs">Sample data. Sign in to track your own repos.</p>
      </section>
    </div>
  );
}
