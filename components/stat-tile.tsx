import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  delay = 0
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'danger';
  delay?: number;
}) {
  return (
    <Card
      size="sm"
      style={{ animationDelay: `${delay}ms` }}
      className={
        tone === 'danger' ? 'lift animate-rise hover:ring-destructive/40' : 'lift animate-rise hover:ring-primary/40'
      }
    >
      <CardHeader>
        <span className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wider">
          {Icon && <Icon className={tone === 'danger' ? 'size-3.5 text-destructive' : 'size-3.5 text-primary'} />}
          {label}
        </span>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </CardHeader>
    </Card>
  );
}
