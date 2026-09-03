import { sendDigestToUser } from '@/lib/digest-email';
import { getDueUsers, markDigestSent, runIngest } from '@/lib/sync';

/** Long enough for a handful of repos plus their summaries. */
export const maxDuration = 300;

/**
 * Vercel Cron hits this on a schedule. It also sends the CRON_SECRET as a
 * bearer token, so the endpoint is not open to anyone who finds the URL.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runIngest('cron');

    // Vercel Cron is project-wide, so the per-user schedule is resolved here:
    // the tick runs hourly and only whoever is due this hour is picked up.
    const due = await getDueUsers();

    const handled: string[] = [];
    let sent = 0;
    let empty = 0;
    let failed = 0;

    for (const user of due) {
      try {
        const outcome = await sendDigestToUser(user.userId);

        // Nothing new still counts as handled: the schedule is a cadence, not
        // a queue, so an empty week should not carry over into the next tick.
        handled.push(user.userId);
        if (outcome.sent) sent += 1;
        else empty += 1;
      } catch (err) {
        // One undeliverable address must not stop the rest of the run, and the
        // user is left unmarked so the next tick tries again.
        failed += 1;
        console.error(`cron digest for ${user.userId} failed:`, err);
      }
    }

    await markDigestSent(handled);

    return Response.json({
      ...result,
      digestsDue: due.length,
      digestsSent: sent,
      digestsEmpty: empty,
      digestsFailed: failed
    });
  } catch (err) {
    console.error('cron ingest failed:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Run failed' }, { status: 500 });
  }
}
