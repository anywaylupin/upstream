/**
 * What every server action returns. Lives outside the 'use server' files,
 * which may only export async functions.
 */
export type ActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong';
}
