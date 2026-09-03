import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Keys are stored encrypted so a database dump alone does not leak them.
 * The wrapping key is derived from AUTH_SECRET, which already has to be secret.
 */
function wrappingKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', wrappingKey(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, body].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(stored: string) {
  const [iv, tag, body] = stored.split('.');
  if (!iv || !tag || !body) return null;

  try {
    const decipher = createDecipheriv('aes-256-gcm', wrappingKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key or tampered value - treat as absent rather than crashing.
    return null;
  }
}
