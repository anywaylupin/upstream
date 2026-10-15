import { redirect } from 'next/navigation';

/** Updates merged into Home; old links and emails keep working, filters included. */
export default async function Digest({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const query = new URLSearchParams(await searchParams).toString();
  redirect(query ? `/?${query}` : '/');
}
