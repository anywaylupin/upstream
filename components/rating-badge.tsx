import type { RepoRating } from '@/lib/repo-rating';

export function RatingBars({ rating }: { rating: RepoRating }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {rating.parts.map((part, i) => (
        <li key={part.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0">{part.label}</span>
          <span className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full animate-grow rounded-full bg-primary"
              style={{
                width: `${part.score * 10}%`,
                animationDelay: `${i * 70}ms`
              }}
            />
          </span>
          <span className="w-8 shrink-0 text-right font-medium tabular-nums">{part.score.toFixed(1)}</span>
          <span className="w-7 shrink-0 text-muted-foreground tabular-nums">×{part.weight}</span>
          <span className="hidden w-44 shrink-0 truncate text-muted-foreground md:block">{part.hint}</span>
        </li>
      ))}
    </ul>
  );
}
