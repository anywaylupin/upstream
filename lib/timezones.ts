/**
 * IANA zones grouped by region for the digest schedule picker.
 *
 * Built from `Intl.supportedValuesOf`, so the list matches whatever ICU data
 * the runtime actually has rather than a hand-copied snapshot that goes stale.
 * The fallback covers runtimes without it.
 */

const FALLBACK = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland'
];

function allZones(): string[] {
  const supported = Intl.supportedValuesOf;
  if (typeof supported !== 'function') return FALLBACK;
  try {
    const zones = supported('timeZone');
    return zones.length > 0 ? ['UTC', ...zones.filter((zone) => zone !== 'UTC')] : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export type TimezoneGroup = { region: string; zones: { id: string; label: string }[] };

/** "Asia/Kuala_Lumpur" -> region "Asia", label "Kuala Lumpur". */
export const TIMEZONE_GROUPS: TimezoneGroup[] = (() => {
  const byRegion = new Map<string, { id: string; label: string }[]>();

  for (const id of allZones()) {
    const slash = id.indexOf('/');
    const region = slash === -1 ? 'Other' : id.slice(0, slash);
    const label = (slash === -1 ? id : id.slice(slash + 1)).replaceAll('_', ' ').replaceAll('/', ' - ');

    const bucket = byRegion.get(region) ?? [];
    bucket.push({ id, label });
    byRegion.set(region, bucket);
  }

  return [...byRegion.entries()]
    .map(([region, zones]) => ({
      region,
      zones: zones.sort((a, b) => a.label.localeCompare(b.label))
    }))
    .sort((a, b) => {
      // "Other" holds UTC, which belongs at the top of the list.
      if (a.region === 'Other') return -1;
      if (b.region === 'Other') return 1;
      return a.region.localeCompare(b.region);
    });
})();

/** The browser's own zone, used to prefill the picker. Server-safe. */
export function guessTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
