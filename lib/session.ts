import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * Every page except the landing teaser is behind this. The check lives in the
 * server component itself, not in middleware, so it cannot be skipped.
 */
export async function requireUser() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect('/');

  return { id: user.id, name: user.name, email: user.email, image: user.image };
}
