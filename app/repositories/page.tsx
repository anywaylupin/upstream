import { redirect } from 'next/navigation';

/** Repositories merged into Library; old links land on the same GitHub view there. */
export default async function Repositories({
  searchParams
}: {
  searchParams: Promise<{ source?: string; q?: string }>;
}) {
  const { source = 'owned', q } = await searchParams;
  const query = new URLSearchParams({ source, ...(q ? { q } : {}) });
  redirect(`/stack?${query}`);
}
