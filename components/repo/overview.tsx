import { SparklesIcon } from 'lucide-react';
import { CodeBlock } from '@/components/code-block';
import { GenerateGuideButton } from '@/components/generate-guide-button';
import { RatingBars } from '@/components/rating-badge';
import { ScoreRing } from '@/components/score-ring';
import { Card } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { RepoGuide } from '@/lib/repo-guide';
import type { RepoRating } from '@/lib/repo-rating';

/** Rating and how-to-use: the repo page's default tab. */
export function RepoOverview({
  rating,
  guide,
  repo
}: {
  rating: RepoRating | null;
  guide: RepoGuide | null;
  repo: { id: number };
}) {
  return (
    <div className="flex flex-col gap-6">
      {rating && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-lg tracking-tight">Rating</h2>
          <Card className="grid items-center gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-1">
              <ScoreRing score={rating.overall} size={96} />
              <span className="text-muted-foreground text-sm">out of 10</span>
            </div>
            <RatingBars rating={rating} />
          </Card>
        </section>
      )}

      {guide ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-lg tracking-tight">How to use</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="flex flex-col gap-4 p-5">
              {guide.install && <CodeBlock label="Install" code={guide.install} />}
              {guide.quickStart && <CodeBlock label="Quick start" code={guide.quickStart} />}
              {!guide.install && !guide.quickStart && (
                <p className="text-muted-foreground text-sm">The README has no install steps.</p>
              )}
            </Card>

            <Card className="flex flex-col gap-5 p-5">
              {guide.keyConcepts.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium text-sm">Key concepts</h3>
                  <dl className="flex flex-col gap-2.5">
                    {guide.keyConcepts.map((concept) => (
                      <div key={concept.name} className="text-sm">
                        <dt className="font-medium">{concept.name}</dt>
                        <dd className="text-muted-foreground">{concept.description}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {guide.gotchas.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium text-sm">Gotchas</h3>
                  <ul className="flex list-disc flex-col gap-1.5 pl-4 text-muted-foreground text-sm marker:text-amber-500">
                    {guide.gotchas.map((gotcha) => (
                      <li key={gotcha}>{gotcha}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        </section>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>No guide yet</EmptyTitle>
            <EmptyDescription>Read the README with AI to rate this repo and find alternatives.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <GenerateGuideButton repoId={repo.id} hasGuide={false} />
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
