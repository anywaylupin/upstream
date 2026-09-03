import { eq } from 'drizzle-orm';
import { ExternalLinkIcon, TimerIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AiKeyList } from '@/components/ai-key-list';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { DigestSettingsForm } from '@/components/digest-settings-form';
import { InstructionTabs } from '@/components/instruction-tabs';
import { SettingsNav } from '@/components/settings-nav';
import { Badge } from '@/components/ui/badge';
import { db } from '@/db';
import { userInstructions, userPreferences } from '@/db/schema';
import { FEATURES } from '@/lib/ai';
import { findModel } from '@/lib/ai-models';
import { getUserAiSummary } from '@/lib/ai-settings';
import { mailProviderConfigured } from '@/lib/digest-email';
import { previewErase } from '@/lib/erase-account';
import { formatDate, formatRelative } from '@/lib/format';
import { getGitHubToken, getGitHubUser, getPrimaryEmail } from '@/lib/github';
import { requireUser } from '@/lib/session';
import { SETTINGS_SECTIONS, type SettingsSectionId } from '@/lib/settings-sections';
import { getRecentRuns } from '@/lib/sync';

function Panel({
  title,
  description,
  children,
  danger
}: {
  title: string;
  description?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={danger ? 'rounded-lg p-4 ring-1 ring-destructive/40' : 'rounded-lg p-4 ring-1 ring-foreground/10'}
    >
      <div className="mb-3 flex flex-col gap-0.5">
        <h2 className="font-semibold text-sm">{title}</h2>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function Settings({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const user = await requireUser();
  const requested = (await searchParams).section;
  const section: SettingsSectionId = SETTINGS_SECTIONS.find((s) => s.id === requested)?.id ?? 'account';

  const token = await getGitHubToken(user.id);
  const [profile, githubEmail] = token
    ? await Promise.all([getGitHubUser(token).catch(() => null), getPrimaryEmail(token).catch(() => null)])
    : [null, null];

  const [[prefs], instructionRows, ai, recentRuns, erasePreview] = await Promise.all([
    db
      .select({
        digestEmail: userPreferences.digestEmail,
        digestEnabled: userPreferences.digestEnabled,
        digestFrequency: userPreferences.digestFrequency,
        digestHour: userPreferences.digestHour,
        digestWeekday: userPreferences.digestWeekday,
        digestTimezone: userPreferences.digestTimezone,
        digestDayOfMonth: userPreferences.digestDayOfMonth,
        digestIntervalDays: userPreferences.digestIntervalDays,
        lastDigestAt: userPreferences.lastDigestAt
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id)),
    db
      .select({
        feature: userInstructions.feature,
        text: userInstructions.text
      })
      .from(userInstructions)
      .where(eq(userInstructions.userId, user.id)),
    getUserAiSummary(user.id),
    getRecentRuns(5),
    previewErase(user.id)
  ]);

  const byFeature = new Map(instructionRows.map((row) => [row.feature, row.text]));
  const fallbackEmail = profile?.email ?? githubEmail ?? user.email ?? null;

  const schedule = {
    enabled: prefs?.digestEnabled ?? true,
    frequency: prefs?.digestFrequency ?? ('weekly' as const),
    hour: prefs?.digestHour ?? 7,
    weekday: prefs?.digestWeekday ?? 1,
    timezone: prefs?.digestTimezone ?? 'UTC',
    dayOfMonth: prefs?.digestDayOfMonth ?? 1,
    intervalDays: prefs?.digestIntervalDays ?? 14,
    lastDigestAt: prefs?.lastDigestAt ?? null
  };

  return (
    <div className="grid w-full gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
      <SettingsNav active={section} />

      <div className="flex max-w-2xl flex-col gap-4">
        {section === 'account' && (
          <Panel title="GitHub account" description="Read from GitHub.">
            {profile ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {/* biome-ignore lint/performance/noImgElement: remote avatar */}
                  <img
                    src={profile.avatar_url}
                    alt=""
                    width={44}
                    height={44}
                    className="rounded-full ring-1 ring-foreground/10"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{profile.name ?? profile.login}</span>
                    <a
                      href={profile.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-primary"
                    >
                      @{profile.login}
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  <Field label="Email">{fallbackEmail ?? 'not public'}</Field>
                  <Field label="Public repos">{profile.public_repos}</Field>
                  <Field label="Followers">{profile.followers}</Field>
                  {profile.company && <Field label="Company">{profile.company}</Field>}
                  {profile.location && <Field label="Location">{profile.location}</Field>}
                  <Field label="Joined">{formatDate(new Date(profile.created_at))}</Field>
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-destructive text-sm">
                <TriangleAlertIcon className="size-4 shrink-0" />
                GitHub sign-in expired. Sign out and back in.
              </p>
            )}
          </Panel>
        )}

        {section === 'digest' && (
          <>
            <Panel title="Digest" description="Where it goes and how often.">
              <DigestSettingsForm
                email={prefs?.digestEmail ?? ''}
                fallbackEmail={fallbackEmail}
                enabled={schedule.enabled}
                frequency={schedule.frequency}
                hour={schedule.hour}
                weekday={schedule.weekday}
                timezone={schedule.timezone}
                dayOfMonth={schedule.dayOfMonth}
                intervalDays={schedule.intervalDays}
                lastDigestAt={schedule.lastDigestAt?.toISOString() ?? null}
                mailConfigured={mailProviderConfigured()}
              />
            </Panel>

            <Panel
              title="Recent syncs"
              description="Upstream checks every stacked repo hourly and picks up whoever is due."
            >
              {recentRuns.length === 0 ? (
                <p className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TimerIcon className="size-4" />
                  No runs yet.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {recentRuns.map((run) => (
                    <li key={run.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <Badge variant={run.trigger === 'cron' ? 'secondary' : 'outline'}>{run.trigger}</Badge>
                      <span className="text-muted-foreground">{formatRelative(run.startedAt)}</span>
                      <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                        {run.repos} repos · {run.releasesNew} new · {run.summarized} summarized
                      </span>
                      {run.errors > 0 && <Badge variant="destructive">{run.errors} failed</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}

        {section === 'keys' && (
          <Panel
            title="AI keys"
            description={`Running ${findModel(ai.modelId)?.label ?? ai.modelId}. Encrypted, yours only.`}
          >
            <AiKeyList keys={ai.keys} />
          </Panel>
        )}

        {section === 'instructions' && (
          <Panel title="Instructions" description="Per feature. Blank falls back to the global one.">
            <InstructionTabs
              tabs={FEATURES.map((feature) => ({
                id: feature.id,
                label: feature.label,
                hint: feature.hint,
                placeholder: feature.placeholder,
                value: byFeature.get(feature.id) ?? ''
              }))}
            />
          </Panel>
        )}

        {section === 'danger' && (
          <Panel title="Delete account" description="Erases everything tied to your account. Cannot be undone." danger>
            <DeleteAccountDialog preview={erasePreview} />
          </Panel>
        )}
      </div>
    </div>
  );
}
