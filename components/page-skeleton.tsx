import { Skeleton } from '@/components/ui/skeleton';

/**
 * The route-level fallback. Its whole job is to make navigation feel immediate:
 * with a `loading.tsx` in a segment, Next commits the transition right away and
 * streams the real page in, instead of blocking on the server while the tab
 * looks frozen.
 *
 * Deliberately rough. A skeleton that mimics the final layout too closely just
 * draws attention to the moment it is replaced.
 */
export function PageSkeleton({ rows = 5, tiles = 0 }: { rows?: number; tiles?: number }) {
  // Keyed by a generated id rather than the array index, which biome rejects.
  const tileKeys = Array.from({ length: tiles }, (_, index) => `tile-${index}`);
  const rowKeys = Array.from({ length: rows }, (_, index) => `row-${index}`);

  return (
    <div className="flex flex-col gap-4 py-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      {tileKeys.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tileKeys.map((key) => (
            <Skeleton key={key} className="h-20 w-full" />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        {rowKeys.map((key, index) => (
          <Skeleton
            key={key}
            className="h-12 w-full"
            // Fades down the list rather than flashing every row at once.
            style={{ opacity: 1 - index * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}
