/**
 * A starter set for an empty stack. Deliberately frontend-adjacent and all
 * ship real GitHub Releases, so the digest has something to say immediately.
 */
export const SUGGESTED_REPOS = [
  { owner: 'vercel', name: 'next.js', blurb: 'React framework' },
  { owner: 'facebook', name: 'react', blurb: 'UI library' },
  { owner: 'tailwindlabs', name: 'tailwindcss', blurb: 'CSS framework' },
  { owner: 'TanStack', name: 'query', blurb: 'Async state' },
  { owner: 'drizzle-team', name: 'drizzle-orm', blurb: 'TypeScript ORM' },
  { owner: 'biomejs', name: 'biome', blurb: 'Lint and format' }
] as const;
