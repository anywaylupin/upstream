import type { ReactNode } from 'react';
import { cn } from 'tailwind-variants';

/**
 * The top of every page: a title, one line under it, the primary action on the
 * right. One shape for all tabs is what makes them read as one app.
 */
export function PageHeader({
  title,
  description,
  action,
  className
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-heading font-semibold text-2xl tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
