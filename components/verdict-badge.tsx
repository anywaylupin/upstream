import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { UpgradeVerdict } from '@/lib/digest-filters';

/**
 * The three upgrade stages, named after a river gauge: flood is breaking, action is review, normal is safe.
 * Each has a shape as well as a colour, so the stage still reads in greyscale or with colour blindness.
 * The definition sits in a tooltip, because "Review" alone never said what to review.
 */
const LOOK: Record<UpgradeVerdict, { label: string; meaning: string; className: string }> = {
  breaking: {
    label: 'Breaking',
    meaning: 'Something you use changed or was removed. Read before upgrading.',
    className: 'bg-stage-flood/12 text-stage-flood'
  },
  review: {
    label: 'Review',
    meaning: 'Nothing breaks, but there is a deprecation or real upgrade work.',
    className: 'bg-stage-action/18 text-[color-mix(in_oklch,var(--stage-action),black_45%)] dark:text-stage-action'
  },
  safe: {
    label: 'Safe',
    meaning: 'Fixes and additions only. Upgrade when convenient.',
    className: 'bg-stage-normal/12 text-stage-normal'
  }
};

/** Solid triangle, outlined triangle, dot: the same marks a survey map uses for hazard, caution and normal. */
export function StageMark({ verdict, className }: { verdict: UpgradeVerdict | 'pending'; className?: string }) {
  if (verdict === 'breaking')
    return (
      <svg viewBox="0 0 12 12" aria-hidden="true" className={className ?? 'size-3'}>
        <path d="M6 1 L11.2 10.5 H0.8 Z" className="fill-stage-flood" />
      </svg>
    );
  if (verdict === 'review')
    return (
      <svg viewBox="0 0 12 12" aria-hidden="true" className={className ?? 'size-3'}>
        <path
          d="M6 2.2 L10.4 10 H1.6 Z"
          fill="none"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="stroke-stage-action"
        />
      </svg>
    );
  if (verdict === 'safe')
    return (
      <svg viewBox="0 0 12 12" aria-hidden="true" className={className ?? 'size-3'}>
        <circle cx="6" cy="6" r="3.2" className="fill-stage-normal" />
      </svg>
    );
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={className ?? 'size-3'}>
      <circle
        cx="6"
        cy="6"
        r="3.4"
        fill="none"
        strokeWidth="1.3"
        strokeDasharray="1.8 1.6"
        className="stroke-muted-foreground"
      />
    </svg>
  );
}

export function VerdictBadge({ verdict }: { verdict: UpgradeVerdict }) {
  const look = LOOK[verdict];
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Badge variant="outline" className={`gap-1.5 border-transparent ${look.className}`} />}
        aria-label={`${look.label}: ${look.meaning}`}
      >
        <StageMark verdict={verdict} />
        {look.label}
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{look.meaning}</TooltipContent>
    </Tooltip>
  );
}
