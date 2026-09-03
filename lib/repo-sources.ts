/**
 * The GitHub views on /repositories.
 *
 * Plain module, no icons: the tab strip is a client component, and importing a
 * value out of one into a server component yields a client-reference proxy
 * rather than the value. Icons are matched to these ids inside the component.
 */
export const REPO_SOURCES = [
  { id: 'owned', label: 'Owned', empty: 'No public repos on your account.' },
  { id: 'watched', label: 'Watched', empty: "You aren't watching anything on GitHub." },
  { id: 'starred', label: 'Starred', empty: "You haven't starred anything." },
  { id: 'search', label: 'Search', empty: 'Search GitHub for a repo.' }
] as const;

export type RepoSource = (typeof REPO_SOURCES)[number]['id'];

export function toRepoSource(value: string | undefined): RepoSource {
  return REPO_SOURCES.find((source) => source.id === value)?.id ?? 'owned';
}

export function emptyMessageFor(source: RepoSource) {
  return REPO_SOURCES.find((item) => item.id === source)?.empty ?? '';
}
