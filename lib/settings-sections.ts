/**
 * Plain module on purpose: a server component importing a value from a
 * "use client" file gets a client-reference proxy, not the array.
 */
export const SETTINGS_SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'email', label: 'Email' },
  { id: 'ai', label: 'AI' },
  { id: 'rating', label: 'Rating' },
  { id: 'danger', label: 'Danger zone' }
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

/** Old ids still arrive from sent emails and bookmarks. */
const ALIASES: Record<string, SettingsSectionId> = { digest: 'email', keys: 'ai', instructions: 'ai' };

export function toSettingsSection(value: string | undefined): SettingsSectionId {
  const id = value && (ALIASES[value] ?? value);
  return SETTINGS_SECTIONS.find((s) => s.id === id)?.id ?? 'account';
}
