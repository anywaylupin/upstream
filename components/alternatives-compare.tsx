import Link from "next/link";
import { RatingBadge } from "@/components/rating-badge";
import { StackButton } from "@/components/stack-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RepoRating } from "@/lib/repo-rating";

export type CompareRow = {
  repo: string;
  tradeoff: string | null;
  /** Null when the repo isn't tracked yet, so there is nothing to rate. */
  rating: RepoRating | null;
  stars: number | null;
  isCurrent: boolean;
  /** repos.id when the alternative is already in the stack. */
  repoId?: number;
};

export function AlternativesCompare({ rows }: { rows: CompareRow[] }) {
  return (
    <div className="rounded-lg ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repo</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead>Stability</TableHead>
            <TableHead className="w-full">Tradeoff</TableHead>
            <TableHead className="text-right">Stack</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const [owner, name] = row.repo.split("/");
            const part = (label: string) =>
              row.rating?.parts.find((p) => p.label === label);

            return (
              <TableRow key={row.repo}>
                <TableCell className="font-medium">
                  {row.rating ? (
                    <Link
                      href={`/repos/${row.repo}`}
                      className="hover:underline"
                    >
                      {row.repo}
                    </Link>
                  ) : (
                    <a
                      href={`https://github.com/${row.repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {row.repo}
                    </a>
                  )}
                  {row.isCurrent && (
                    <Badge variant="secondary" className="ml-2">
                      this
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {row.rating ? (
                    <RatingBadge rating={row.rating} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      not in stack
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {part("Activity")?.score.toFixed(1) ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {part("Stability")?.score.toFixed(1) ?? "—"}
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  {row.tradeoff ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {/* The current repo already has this action in the page header. */}
                  {!row.isCurrent && owner && name && (
                    <StackButton
                      owner={owner}
                      name={name}
                      repoId={row.repoId}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
