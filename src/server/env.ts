import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';

const blankIsUnset = (value: unknown) => (value === '' ? undefined : value);
const optional = () => z.preprocess(blankIsUnset, z.string().optional());

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  /** Postgres in production. Unset means PGlite on this machine. */
  DATABASE_URL: optional(),
  /** Where PGlite keeps its files. `memory://` keeps nothing, for tests. */
  PGLITE_DIR: z.preprocess(blankIsUnset, z.string().default('.data/pg')),
  SESSION_SECRET: optional(),
  /** 32 random bytes in base64. Seals bank tokens. Changing it orphans every saved connection. */
  TOKEN_KEY: optional(),
  PLAID_CLIENT_ID: optional(),
  PLAID_SECRET: optional(),
  PLAID_ENV: z.preprocess(blankIsUnset, z.enum(['sandbox', 'production']).default('sandbox')),
  /** The public https address. Plaid webhooks and the Wallet shortcut need it. */
  PUBLIC_URL: optional(),
  CRON_SECRET: optional(),
  STRIPE_SECRET_KEY: optional(),
  STRIPE_WEBHOOK_SECRET: optional(),
  STRIPE_PRICE_MONTHLY: optional(),
  STRIPE_PRICE_YEARLY: optional(),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: optional(),
});

export type Env = z.infer<typeof schema>;

export function env(): Env {
  return schema.parse(process.env);
}

export function isProduction(): boolean {
  return env().NODE_ENV === 'production';
}

interface Secrets {
  session: string;
  tokenKey: string;
}

let devSecrets: Secrets | null = null;

/** Made once and kept in the git-ignored .data folder, so a restart doesn't sign everyone out. */
function localSecrets(): Secrets {
  if (devSecrets) return devSecrets;
  const file = path.join(process.cwd(), '.data', 'dev-secrets.json');
  if (existsSync(file)) {
    devSecrets = JSON.parse(readFileSync(file, 'utf8')) as Secrets;
    return devSecrets;
  }
  devSecrets = { session: randomBytes(32).toString('base64'), tokenKey: randomBytes(32).toString('base64') };
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(devSecrets), { mode: 0o600 });
  return devSecrets;
}

function required(name: string): never {
  throw new Error(`${name} must be set in production`);
}

export function sessionSecret(): string {
  const { SESSION_SECRET } = env();
  if (SESSION_SECRET) return SESSION_SECRET;
  return isProduction() ? required('SESSION_SECRET') : localSecrets().session;
}

export function tokenKey(): string {
  const { TOKEN_KEY } = env();
  if (TOKEN_KEY) return TOKEN_KEY;
  return isProduction() ? required('TOKEN_KEY') : localSecrets().tokenKey;
}
