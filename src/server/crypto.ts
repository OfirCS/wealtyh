import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { tokenKey } from './env';

const VERSION = 'v1';

function key(): Buffer {
  const bytes = Buffer.from(tokenKey(), 'base64');
  if (bytes.length !== 32) throw new Error('TOKEN_KEY must be 32 bytes in base64');
  return bytes;
}

/** Bank tokens are only ever stored sealed, so a copy of the database alone can't reach a bank. */
export function seal(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

export function open(sealed: string): string {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || !body) throw new Error('Not a sealed value');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
