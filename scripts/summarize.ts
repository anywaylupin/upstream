import "dotenv/config";
import { summarizePending } from "../lib/summarize-batch";

async function main() {
  const { pending, summarized } = await summarizePending({ limit: 10 });
  console.log(`${pending} to summarize, ${summarized} succeeded`);
}

main();
