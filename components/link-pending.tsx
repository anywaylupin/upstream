'use client';

import type { LucideIcon } from 'lucide-react';
import { useLinkStatus } from 'next/link';
import { cn } from 'tailwind-variants';
import { Spinner } from '@/components/ui/spinner';

/**
 * Swaps a nav icon for a spinner while its own `<Link>` is navigating.
 *
 * `useLinkStatus` only works inside a descendant of the Link, which is why this
 * is its own component rather than a prop on the link. The pending phase is
 * skipped entirely when the route is already prefetched - this covers the case
 * `loading.tsx` cannot, the gap before the transition commits.
 */
export function LinkPendingIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  const { pending } = useLinkStatus();

  return pending ? <Spinner className={className} /> : <Icon className={className} />;
}

/**
 * A bar that fills while the link is pending. Fixed height whether or not it is
 * showing, so it can never shift the layout it sits in.
 */
export function LinkPendingBar() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-1 bottom-0 h-0.5 origin-left rounded-full bg-primary transition-opacity duration-150',
        pending ? 'animate-pulse opacity-100' : 'opacity-0'
      )}
    />
  );
}
