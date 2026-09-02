import { Badge } from "@/components/ui/badge";
import type { RepoRating } from "@/lib/repo-rating";

const GRADE_VARIANT: Record<
  RepoRating["grade"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  A: "default",
  B: "secondary",
  C: "outline",
  D: "destructive",
};

export function RatingBadge({ rating }: { rating: RepoRating }) {
  return (
    <Badge variant={GRADE_VARIANT[rating.grade]} className="tabular-nums">
      {rating.grade} · {rating.overall.toFixed(1)}
    </Badge>
  );
}

export function RatingBars({ rating }: { rating: RepoRating }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rating.parts.map((part, i) => (
        <li key={part.label} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-muted-foreground">
            {part.label}
          </span>
          <span className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted">
            <span
              className="animate-grow block h-full rounded-full bg-primary"
              style={{
                width: `${part.score * 10}%`,
                animationDelay: `${i * 70}ms`,
              }}
            />
          </span>
          <span className="w-7 shrink-0 text-right tabular-nums text-muted-foreground">
            {part.score.toFixed(1)}
          </span>
          <span className="hidden truncate text-muted-foreground/70 sm:block">
            {part.hint}
          </span>
        </li>
      ))}
    </ul>
  );
}
