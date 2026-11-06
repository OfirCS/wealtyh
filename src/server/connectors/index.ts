import { isProduction } from '../env';
import { mock } from './mock';
import { plaid, plaidReady } from './plaid';
import type { BankConnector } from './types';

/** The bank source for new connections, or null when this server has none. */
export function activeConnector(): BankConnector | null {
  if (plaidReady()) return plaid;
  return isProduction() ? null : mock;
}

/** The source that made an existing connection, even if a newer one is active now. */
export function connectorFor(provider: string): BankConnector {
  if (provider === plaid.name) return plaid;
  if (provider === mock.name && !isProduction()) return mock;
  throw new Error('Unknown bank source');
}
