/**
 * Plain module on purpose: a server component importing a value from a
 * "use client" file gets a client-reference proxy, not the array. Icons stay in
 * the client nav, keyed by these ids.
 */
export const SETTINGS_SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'digest', label: 'Digest' },
  { id: 'keys', label: 'AI keys' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'danger', label: 'Danger zone' }
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];
