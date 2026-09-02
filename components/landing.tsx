import {
  ArrowRightIcon,
  GitCompareIcon,
  LogInIcon,
  type LucideIcon,
  NewspaperIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react";
import { signInWithGitHub } from "@/app/actions";
import { RatingBars } from "@/components/rating-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES: { icon: LucideIcon; title: string; keywords: string[] }[] = [
  {
    icon: NewspaperIcon,
    title: "Weekly digest",
    keywords: ["grouped by week", "per repo", "plain language"],
  },
  {
    icon: ShieldAlertIcon,
    title: "Breaking radar",
    keywords: ["flagged loud", "upgrade effort", "never buried"],
  },
  {
    icon: StarIcon,
    title: "Repo ratings",
    keywords: ["activity", "stability", "docs", "reach"],
  },
  {
    icon: SparklesIcon,
    title: "Explain any repo",
    keywords: ["what it is", "quick start", "gotchas"],
  },
  {
    icon: GitCompareIcon,
    title: "Alternatives",
    keywords: ["side by side", "compared by rating"],
  },
  {
    icon: RefreshCwIcon,
    title: "Manual sync",
    keywords: ["refresh on demand", "per repo"],
  },
];

const SAMPLE_RATING = {
  overall: 8.2,
  grade: "A" as const,
  parts: [
    { label: "Activity", score: 9.4, hint: "18 releases in 90d" },
    { label: "Stability", score: 7.8, hint: "2 breaking in 90d" },
    { label: "Reach", score: 9.1, hint: "128,000 stars" },
    { label: "Community", score: 8.6, hint: "27,000 forks" },
    { label: "Upkeep", score: 9.2, hint: "pushed 1d ago" },
  ],
};

export function Landing() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 py-8">
      <header className="flex flex-col items-start gap-4">
        <Badge variant="outline">GitHub sign-in required</Badge>
        <h1 className="font-heading text-4xl font-semibold tracking-tight">
          Release intel for the repos you depend on.
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Upstream reads every changelog, flags what breaks, rates the project,
          and tells you what to use instead.
        </p>
        <form action={signInWithGitHub}>
          <Button type="submit" size="lg" className="group">
            <LogInIcon
              data-icon="inline-start"
              className="transition-transform duration-200 group-hover:scale-110"
            />
            Sign in with GitHub
            <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        </form>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <Card
            key={feature.title}
            size="sm"
            style={{ animationDelay: `${i * 60}ms` }}
            className="lift animate-rise group hover:ring-primary/40"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <feature.icon className="size-4 text-primary transition-transform duration-200 group-hover:scale-110" />
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {feature.keywords.map((keyword) => (
                  <Badge key={keyword} variant="outline">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Preview
        </h2>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card size="sm" className="ring-2 ring-destructive/50">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-baseline gap-2">
                vercel/next.js
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  v16.3.0
                </span>
                <Badge variant="destructive">breaking</Badge>
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  medium effort
                </span>
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                New caching model for route handlers.
              </span>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1.5 text-sm">
                <li className="flex items-start gap-2">
                  <Badge variant="destructive" className="mt-0.5 shrink-0">
                    breaking
                  </Badge>
                  <span className="font-medium">
                    fetch() no longer cached by default
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="mt-0.5 shrink-0">feature</Badge>
                  <span className="text-muted-foreground">
                    `use cache` directive
                  </span>
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
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">
                  Alternatives:
                </span>
                <Badge variant="outline">remix-run/react-router</Badge>
                <Badge variant="outline">tanstack/router</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">
          Sample data. Sign in to track your own repos.
        </p>
      </section>
    </div>
  );
}
