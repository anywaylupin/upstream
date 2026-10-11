'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/db';
import { userPreferences } from '@/db/schema';
import { type ActionResult, errorMessage } from '@/lib/action-result';
import { DigestDeliveryError, sendDigestToUser } from '@/lib/digest-email';
import {
  isDigestFrequency,
  isValidTimeZone,
  MAX_DAY_OF_MONTH,
  MAX_INTERVAL_DAYS,
  MIN_INTERVAL_DAYS
} from '@/lib/digest-schedule';
import { Weights } from '@/lib/repo-rating';

/** Weights arrive from a client form, so they are parsed, not trusted. */
export async function saveRatingWeights(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const parsed = Weights.safeParse(input);
  if (!parsed.success) return { error: 'Those weights are not valid.' };

  await db
    .insert(userPreferences)
    .values({ userId: session.user.id, ratingWeights: parsed.data })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ratingWeights: parsed.data, updatedAt: new Date() }
    });

  revalidatePath('/', 'layout');
  return { success: true };
}

export type DigestState = { error?: string; success?: boolean };

/** Email address, opt-out and per-user schedule, saved together. */
export async function saveDigestSettings(_prev: DigestState, formData: FormData): Promise<DigestState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const email = String(formData.get('email') ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "That doesn't look like an email address." };
  }

  const rawFrequency = String(formData.get('frequency') ?? '');
  if (!isDigestFrequency(rawFrequency)) return { error: 'Pick a frequency.' };

  const hour = Number(formData.get('hour'));
  const weekday = Number(formData.get('weekday'));
  const dayOfMonth = Number(formData.get('dayOfMonth'));
  const intervalDays = Number(formData.get('intervalDays'));
  const timezone = String(formData.get('timezone') ?? 'UTC');

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { error: 'Pick an hour between 0 and 23.' };
  }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { error: 'Pick a valid day.' };
  }
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > MAX_DAY_OF_MONTH) {
    return { error: `Pick a date between 1 and ${MAX_DAY_OF_MONTH}.` };
  }
  if (!Number.isInteger(intervalDays) || intervalDays < MIN_INTERVAL_DAYS || intervalDays > MAX_INTERVAL_DAYS) {
    return { error: `Pick a gap between ${MIN_INTERVAL_DAYS} and ${MAX_INTERVAL_DAYS} days.` };
  }
  // Zones come from the runtime's own ICU list, but the form is still a boundary.
  if (!isValidTimeZone(timezone)) {
    return { error: 'That is not a time zone Upstream recognises.' };
  }

  const values = {
    digestEmail: email || null,
    digestEnabled: formData.get('enabled') === 'on',
    digestFrequency: rawFrequency,
    digestHour: hour,
    digestWeekday: weekday,
    digestTimezone: timezone,
    digestDayOfMonth: dayOfMonth,
    digestIntervalDays: intervalDays
  };

  await db
    .insert(userPreferences)
    .values({ userId: session.user.id, ...values })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ...values, updatedAt: new Date() }
    });

  revalidatePath('/settings');
  return { success: true };
}

/**
 * Send the digest right now, on demand.
 *
 * Runs the same `sendDigestToUser` path the cron tick uses, so this doubles as
 * a rehearsal of the scheduled send rather than a parallel implementation that
 * can drift. Deliberately does NOT touch `lastDigestAt`: a test send should not
 * push the next scheduled one out by a cycle.
 */
export async function sendDigestNow(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  try {
    const result = await sendDigestToUser(session.user.id);

    if (!result.sent) {
      return { success: true, message: 'Nothing new to send - no summarized releases in the last 7 days.' };
    }

    const breaking = result.breaking > 0 ? `, ${result.breaking} breaking` : '';
    return { success: true, message: `Sent ${result.entries} releases${breaking} to ${result.to}.` };
  } catch (err) {
    if (err instanceof DigestDeliveryError) return { error: err.message };
    console.error('send digest now failed:', err);
    return { error: errorMessage(err) };
  }
}
