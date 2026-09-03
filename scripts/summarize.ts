import 'dotenv/config';
import { serverAiContext } from '@/lib/ai';
import { summarizePending } from '@/lib/summarize-batch';

async function main() {
  const { pending, summarized } = await summarizePending(serverAiContext(), {
    limit: 10
  });
  console.log(`${pending} to summarize, ${summarized} succeeded`);
}

main();
