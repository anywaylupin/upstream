import { eq } from 'drizzle-orm';
import { ExternalLinkIcon, TriangleAlertIcon } from 'lucide-react';
import { AddKeyButton } from '@/components/add-key-dialog';
import { AiKeyList } from '@/components/ai-key-list';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { DigestSettingsForm } from '@/components/digest-settings-form';
import { InstructionsForm } from '@/components/instructions-form';
import { PageHeader } from '@/components/page-header';
import { RatingWeightsForm } from '@/components/rating-weights-form';
import { SettingGroup, SettingRow } from '@/components/setting-row';
import { Button } from '@/components/ui/button';
import { UrlTabs } from '@/components/url-tabs';
import { db } from '@/db';
import { userInstructions, userPreferences } from '@/db/schema';
import { FEATURES } from '@/lib/ai';
import { findModel } from '@/lib/ai-models';
import { getUserAiSummary } from '@/lib/ai-settings';
import { mailProviderConfigured } from '@/lib/digest-email';
import { previewErase } from '@/lib/erase-account';
import { formatDate } from '@/lib/format';
import { getGitHubToken } from '@/lib/github';
import { cachedGitHubUser, cachedPrimaryEmail } from '@/lib/github-cache';
import { getRatingWeights } from '@/lib/repo-stats';
import { requireUser } from '@/lib/session';
import { SETTINGS_SECTIONS, toSettingsSection } from '@/lib/settings-sections';

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

  const [[prefs], instructionRows, ai, erasePreview, weights] = await Promise.all([
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

  const facts = profile
    ? [
        { label: 'Email', value: fallbackEmail ?? 'Not public' },
        { label: 'Public repos', value: profile.public_repos },
        { label: 'Followers', value: profile.followers },
        ...(profile.company ? [{ label: 'Company', value: profile.company }] : []),
        ...(profile.location ? [{ label: 'Location', value: profile.location }] : []),
        { label: 'Joined', value: formatDate(new Date(profile.created_at)) }
      ]
    : [];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader title="Settings" action={<AddKeyButton />} />
      <UrlTabs
        param="section"
        initial={section}
        tabs={SETTINGS_SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
        panels={{
          account: profile ? (
            <SettingGroup>
              <div className="flex items-center gap-3 py-4">
                {/* biome-ignore lint/performance/noImgElement: remote avatar */}
                <img
                  src={profile.avatar_url}
                  alt=""
                  width={40}
                  height={40}
                  className="rounded-full ring-1 ring-foreground/10"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-sm">{profile.name ?? profile.login}</span>
                  <span className="text-muted-foreground text-sm">@{profile.login}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    // biome-ignore lint/a11y/useAnchorContent: base-ui renders the button's label into this anchor
                    <a href={profile.html_url} target="_blank" rel="noreferrer" />
                  }
                  nativeButton={false}
                >
                  <ExternalLinkIcon data-icon="inline-start" />
                  GitHub
                </Button>
              </div>
              {facts.map((fact) => (
                <SettingRow key={fact.label} label={fact.label}>
                  <span className="text-muted-foreground text-sm tabular-nums">{fact.value}</span>
                </SettingRow>
              ))}
            </SettingGroup>
          ) : (
            <p className="flex items-center gap-2 text-destructive text-sm">
              <TriangleAlertIcon className="size-4 shrink-0" />
              GitHub sign-in expired. Sign out and back in.
            </p>
          ),
          email: (
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
          ),
          rating: <RatingWeightsForm initial={weights} />,
          ai: (
            <div className="flex flex-col gap-6">
              <SettingGroup>
                <SettingRow label="Model">
                  <span className="text-muted-foreground text-sm">{findModel(ai.modelId)?.label ?? ai.modelId}</span>
                </SettingRow>
                <SettingRow label="Your keys" description={ai.keys.length ? 'Encrypted' : undefined}>
                  <AiKeyList keys={ai.keys} />
                </SettingRow>
              </SettingGroup>
              <section className="flex flex-col gap-3">
                <h2 className="font-medium text-muted-foreground text-sm">Instructions</h2>
                <InstructionsForm
                  fields={FEATURES.map((feature) => ({
                    id: feature.id,
                    label: feature.label,
                    placeholder: feature.placeholder,
                    value: byFeature.get(feature.id) ?? ''
                  }))}
                />
              </section>
            </div>
          ),
          danger: (
            <SettingGroup className="border-destructive/30">
              <SettingRow label="Delete account" description="Erases your data. Cannot be undone.">
                <DeleteAccountDialog preview={erasePreview} />
              </SettingRow>
            </SettingGroup>
          )
        }}
      />
    </div>
  );
}
