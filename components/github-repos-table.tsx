import {
  ArrowUpRightIcon,
  ExternalLinkIcon,
  SearchIcon,
  StarIcon,
} from "lucide-react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { OwnerAvatar } from "@/components/owner-avatar";
import { StackButton } from "@/components/stack-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GitHubRepo } from "@/lib/github";

export function GitHubReposTable({
  repos,
  repoIdByFullName,
  emptyMessage,
}: {
  repos: GitHubRepo[];
  /** full_name -> repos.id, for repos already in the stack. */
  repoIdByFullName: Map<string, number>;
  emptyMessage: string;
}) {
  if (repos.length === 0) {
    return (
      <div className="animate-rise flex flex-col items-center gap-2 rounded-lg py-12 text-sm text-muted-foreground ring-1 ring-foreground/10">
        <SearchIcon className="size-6 opacity-60" />
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="animate-rise overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repo</TableHead>
            <TableHead className="hidden lg:table-cell">About</TableHead>
            <TableHead>Lang</TableHead>
            <TableHead className="text-right">Stars</TableHead>
            <TableHead className="text-right">Stack</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {repos.map((repo) => (
            <ClickableRow
              key={repo.id}
              href={`/repos/${repo.owner.login}/${repo.name}`}
            >
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  <OwnerAvatar owner={repo.owner.login} />
                  {/* Repo names always lead to the Upstream page, never off-site. */}
                  <Link
                    href={`/repos/${repo.owner.login}/${repo.name}`}
                    className="inline-flex items-center gap-1 transition-colors group-hover/row:text-primary hover:underline"
                  >
                    {repo.full_name}
                    <ArrowUpRightIcon className="size-3 opacity-0 transition-opacity group-hover/row:opacity-60" />
                  </Link>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${repo.full_name} on GitHub`}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/row:opacity-100"
                  >
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </span>
              </TableCell>
              <TableCell className="hidden max-w-md truncate whitespace-normal text-muted-foreground lg:table-cell">
                {repo.description ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {repo.language ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="size-3" />
                  {repo.stargazers_count.toLocaleString()}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <StackButton
                  owner={repo.owner.login}
                  name={repo.name}
                  repoId={repoIdByFullName.get(repo.full_name)}
                />
              </TableCell>
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
