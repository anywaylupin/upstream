import { Badge } from '@/components/ui/badge';
import type { UpgradeVerdict } from '@/lib/digest-filters';

const LOOK: Record<UpgradeVerdict, { label: string; className: string }> = {
  breaking: { label: 'Breaking', className: 'bg-destructive/10 text-destructive' },
  review: { label: 'Review', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  safe: { label: 'Safe', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' }
};

export function VerdictBadge({ verdict }: { verdict: UpgradeVerdict }) {
  const look = LOOK[verdict];
  return (
    <Badge variant="outline" className={`border-transparent ${look.className}`}>
      {look.label}
    </Badge>
  );
}
