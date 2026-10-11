import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VerdictBadge } from '@/components/verdict-badge';
import { upgradeVerdict } from '@/lib/digest-filters';
import { formatDate } from '@/lib/format';
import { type ReleaseSummary, ReleaseSummary as ReleaseSummarySchema } from '@/lib/summarize';

const BADGE_VARIANT: Record<
  ReleaseSummary['changes'][number]['type'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  breaking: 'destructive',
  feature: 'default',
  fix: 'secondary',
  perf: 'outline',
  deprecation: 'outline'
};

/** The release history, newest first, each with its upgrade verdict. */
export function ReleasesTable({
  releaseRows
}: {
  releaseRows: { releaseId: number; tag: string; publishedAt: Date | null; data: unknown }[];
}) {
  return releaseRows.length === 0 ? (
    <p className="text-muted-foreground text-sm">No releases yet. Check for new releases from the menu.</p>
  ) : (
    <Card className="overflow-hidden py-0">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Tag</TableHead>
            <TableHead className="hidden w-32 sm:table-cell">Date</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead className="hidden w-44 lg:table-cell">Changes</TableHead>
            <TableHead className="w-24">Upgrade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {releaseRows.map((row) => {
            const parsed = ReleaseSummarySchema.safeParse(row.data);
            return (
              <TableRow key={row.releaseId}>
                <TableCell className="whitespace-normal break-words font-mono text-[13px]">{row.tag}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {formatDate(row.publishedAt)}
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  {parsed.success ? parsed.data.headline : 'Waiting for a summary'}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {parsed.success && (
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(parsed.data.changes.map((c) => c.type))].map((type) => (
                        <Badge key={type} variant={BADGE_VARIANT[type]}>
                          {type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>{parsed.success ? <VerdictBadge verdict={upgradeVerdict(parsed.data)} /> : '-'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
