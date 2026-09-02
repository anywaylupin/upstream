import { eq } from "drizzle-orm";
import {
  LayersIcon,
  SparklesIcon,
  TriangleAlertIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AiInstructionsForm } from "@/components/ai-instructions-form";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { OwnerAvatar } from "@/components/owner-avatar";
import { StackButton } from "@/components/stack-button";
import { db } from "@/db";
import { repos, stackRepos, userPreferences } from "@/db/schema";
import { requireUser } from "@/lib/session";

function Section({
  icon: Icon,
  title,
  description,
  children,
  danger,
}: {
  icon: typeof UserIcon;
  title: string;
  description?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={
        danger
          ? "flex flex-col gap-3 rounded-lg p-4 ring-1 ring-destructive/40"
          : "flex flex-col gap-3 rounded-lg p-4 ring-1 ring-foreground/10"
      }
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon
            className={
              danger ? "size-4 text-destructive" : "size-4 text-primary"
            }
          />
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function Settings() {
  const user = await requireUser();

  const [stack, [preferences]] = await Promise.all([
    db
      .select({ repoId: repos.id, owner: repos.owner, name: repos.name })
      .from(stackRepos)
      .innerJoin(repos, eq(repos.id, stackRepos.repoId))
      .where(eq(stackRepos.userId, user.id))
      .orderBy(repos.owner, repos.name),
    db
      .select({ aiInstructions: userPreferences.aiInstructions })
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id)),
  ]);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <Section icon={UserIcon} title="Account">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Signed in with GitHub as
          </span>
          <span className="font-medium">{user.name ?? user.email}</span>
        </div>
      </Section>

      <Section
        icon={SparklesIcon}
        title="AI instructions"
        description="Used to highlight releases relevant to you. Doesn't change how they're summarized."
      >
        <AiInstructionsForm defaultValue={preferences?.aiInstructions ?? ""} />
      </Section>

      <Section
        icon={LayersIcon}
        title={`Stack · ${stack.length}`}
        description="Repos Upstream pulls releases for on your behalf."
      >
        {stack.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet.{" "}
            <Link
              href="/repositories"
              className="underline transition-colors hover:text-primary"
            >
              Add a repo
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {stack.map((repo) => (
              <li
                key={repo.repoId}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <Link
                  href={`/repos/${repo.owner}/${repo.name}`}
                  className="flex items-center gap-2 transition-colors hover:text-primary hover:underline"
                >
                  <OwnerAvatar owner={repo.owner} />
                  {repo.owner}/{repo.name}
                </Link>
                <StackButton
                  owner={repo.owner}
                  name={repo.name}
                  repoId={repo.repoId}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={TriangleAlertIcon}
        title="Danger zone"
        description="Removes your stack, preferences and GitHub link. Shared release data stays."
        danger
      >
        <div>
          <DeleteAccountDialog />
        </div>
      </Section>
    </div>
  );
}
