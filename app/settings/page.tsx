import { eq } from 'drizzle-orm';
import { ExternalLinkIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AiKeyList } from '@/components/ai-key-list';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { DigestSettingsForm } from '@/components/digest-settings-form';
import { FactGrid } from '@/components/fact-grid';
import { InstructionTabs } from '@/components/instruction-tabs';
import { PageHeader } from '@/components/page-header';
import { RatingWeightsForm } from '@/components/rating-weights-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UrlTabs } from '@/components/url-tabs';
import { db } from '@/db';
import { userInstructions, userPreferences } from '@/db/schema';
import { FEATURES } from '@/lib/ai';
import { findModel } from '@/lib/ai-models';
import { getUserAiSummary } from '@/lib/ai-settings';
import { mailProviderConfigured } from '@/lib/digest-email';
import { previewErase } from '@/lib/erase-account';
import { formatDate, formatRelative } from '@/lib/format';
import { getGitHubToken } from '@/lib/github';
import { cachedGitHubUser, cachedPrimaryEmail } from '@/lib/github-cache';
import { getRatingWeights } from '@/lib/repo-stats';
import { requireUser } from '@/lib/session';
import { SETTINGS_SECTIONS, toSettingsSection } from '@/lib/settings-sections';
import { getRecentRuns } from '@/lib/sync';

/** A titled section of a settings tab: shadcn Card parts, nothing hand-rolled. */
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
    <Card className={danger ? 'ring-destructive/40' : undefined}>
      <CardHeader>
        <CardTitle className={danger ? 'text-destructive' : undefined}>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function Settings({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const user = await requireUser();
  const requested = (await searchParams).section;
  const section = toSettingsSection(requested);

  const token = await getGitHubToken(user.id);
  const [profile, githubEmail] = token
    ? await Promise.all([
        cachedGitHubUser(user.id, token).catch(() => null),
        cachedPrimaryEmail(user.id, token).catch(() => null)
      ])
    : [null, null];

  const [[prefs], instructionRows, ai, recentRuns, erasePreview, weights] = await Promise.all([
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
    getRecentRuns(1),
    previewErase(user.id),
    getRatingWeights(user.id)
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
    <div className="flex w-full flex-col gap-6">
      <PageHeader title="Settings" description="Account, email, AI and how repos are rated." />
      <UrlTabs
        param="section"
        initial={section}
        tabs={SETTINGS_SECTIONS.map((s) => ({ id: s.id, label: s.label, danger: s.id === 'danger' }))}
        panels={{
          account: (
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
                        className="inline-flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
                      >
                        @{profile.login}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    </div>
                  </div>

                  <FactGrid
                    facts={[
                      { label: 'Email', value: fallbackEmail ?? 'not public' },
                      { label: 'Public repos', value: profile.public_repos },
                      { label: 'Followers', value: profile.followers },
                      ...(profile.company ? [{ label: 'Company', value: profile.company }] : []),
                      ...(profile.location ? [{ label: 'Location', value: profile.location }] : []),
                      { label: 'Joined', value: formatDate(new Date(profile.created_at)) }
                    ]}
                  />
                </div>
              ) : (
                <p className="flex items-center gap-2 text-destructive text-sm">
                  <TriangleAlertIcon className="size-4 shrink-0" />
                  GitHub sign-in expired. Sign out and back in.
                </p>
              )}
            </Panel>
          ),
          email: (
            <>
              <Panel title="Updates email" description="Where and how often.">
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
                  lastChecked={recentRuns[0] ? formatRelative(recentRuns[0].startedAt) : undefined}
                  mailConfigured={mailProviderConfigured()}
                />
              </Panel>
            </>
          ),
          rating: (
            <Panel title="Rating" description="Weight what matters to you.">
              <RatingWeightsForm initial={weights} />
            </Panel>
          ),
          ai: (
            <div className="flex flex-col gap-6">
              <Panel
                title="AI keys"
                description={`Running ${findModel(ai.modelId)?.label ?? ai.modelId}. Encrypted, yours only.`}
              >
                <AiKeyList keys={ai.keys} />
              </Panel>
              <Panel title="Instructions" description="Blank uses Global.">
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
            </div>
          ),
          danger: (
            <Panel title="Delete account" description="Permanent. Erases all your data." danger>
              <DeleteAccountDialog preview={erasePreview} />
            </Panel>
          )
        }}
      />
    </div>
  );
}
