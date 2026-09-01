import "dotenv/config";
import { db } from "./index";
import { repos } from "./schema";

const SEED = [
  { owner: "facebook", name: "react" },
  // ...your 10–15
];

async function main() {
  await db.insert(repos).values(SEED).onConflictDoNothing();
  console.log(`Seeded ${SEED.length} repos`);
}

main();
