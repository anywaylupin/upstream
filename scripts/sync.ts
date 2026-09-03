import 'dotenv/config';
import { runIngest } from '@/lib/sync';

async function main() {
  const result = await runIngest('manual');
  console.log(result);
}

main();
