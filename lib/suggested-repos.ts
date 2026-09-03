/**
 * A starter set for an empty stack.
 *
 * Every one of these is a dependency Upstream itself runs on, so the digest has
 * something real to say immediately and the suggestions are honest rather than
 * a generic "popular repos" list. All of them ship GitHub Releases.
 */
export const SUGGESTED_REPOS = [
  { owner: 'vercel', name: 'next.js', blurb: 'The framework this runs on' },
  { owner: 'vercel', name: 'ai', blurb: 'Summarizes the changelogs' },
  { owner: 'nextauthjs', name: 'next-auth', blurb: 'GitHub sign-in' },
  { owner: 'drizzle-team', name: 'drizzle-orm', blurb: 'Queries the Neon database' },
  { owner: 'colinhacks', name: 'zod', blurb: 'Validates every boundary' },
  { owner: 'biomejs', name: 'biome', blurb: 'Lint and format' }
] as const;
