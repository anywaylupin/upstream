import { cn } from 'tailwind-variants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * A 0-10 score as a ring.
 * The tooltip says what the number means; without it "7.9" told a newcomer nothing.
 * Teal scales with the score; a low score turns grey, not red - red is kept for breaking changes, and a quiet repo is not a danger.
 */
export function ScoreRing({ score, size = 56, className }: { score: number; size?: number; className?: string }) {
  const stroke = Math.max(3, size / 14);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(10, score)) / 10) * circumference;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<div />}
        role="img"
        aria-label={`Score ${score.toFixed(1)} out of 10`}
        className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className={cn(
              'transition-[stroke-dasharray] duration-700',
              score >= 5 ? 'stroke-brand' : 'stroke-muted-foreground/50'
            )}
          />
        </svg>
        <span
          className="absolute font-heading font-semibold tracking-tight"
          style={{ fontSize: Math.round(size * 0.3) }}
        >
          {score.toFixed(1)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">Score out of 10, weighted by your rating settings</TooltipContent>
    </Tooltip>
  );
}
