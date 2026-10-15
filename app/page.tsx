import { auth } from '@/auth';
import { DashboardEmpty } from '@/components/dashboard-empty';
import { HomeFeed } from '@/components/home-feed';
import { Landing } from '@/components/landing';
import { getStackRepoIds } from '@/lib/repo-stats';

/**
 * Home.
 * Signed out it is the landing page; with nothing followed it is the first-run picker; otherwise it is the release feed grouped by upgrade stage.
 */
export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ types?: string; effort?: string; repos?: string; days?: string; q?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <Landing />;

  const repoIds = await getStackRepoIds(userId);
  if (repoIds.length === 0) return <DashboardEmpty />;

  return <HomeFeed searchParams={searchParams} />;
}
