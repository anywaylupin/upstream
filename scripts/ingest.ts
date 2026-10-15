import 'dotenv/config';
import { db } from '@/db';
import { repos } from '@/db/schema';
import { ingestRepo } from '@/lib/ingest';

async function main() {
  const allRepos = await db.select().from(repos);
  console.log(`Ingesting ${allRepos.length} repos`);

  for (const repo of allRepos) {
    try {
      const { fetched, inserted } = await ingestRepo(repo);
      console.log(
        fetched === 0
          ? `${repo.owner}/${repo.name}: no releases`
          : `${repo.owner}/${repo.name}: ${fetched} fetched, ${inserted} new`
      );
    } catch (err) {
      console.error(`${repo.owner}/${repo.name} failed:`, err);
    }
  }

  console.log('Done');
}

main();
