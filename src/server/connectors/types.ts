import type { Sighting } from '@/core/ledger/types';
import type { ConnectionAccount } from '../db/schema';

export interface Link {
  linkToken: string;
  mode: 'plaid' | 'mock';
}

export interface Login {
  accessToken: string;
  itemId: string;
  institution: string;
  accounts: ConnectionAccount[];
}

export interface SyncPage {
  added: Sighting[];
  /** Changed since last time, such as a tip being added. */
  modified: Sighting[];
  /** Taken back by the bank, such as a pending charge that never posted. */
  removed: string[];
  cursor: string | null;
  /** The bank wants the person to sign in again. */
  needsLogin: boolean;
  /** The bank is still preparing history. Ask again shortly. */
  notReady: boolean;
}

/** Everything a bank source must do. Swapping or adding a provider means one new file. */
export interface BankConnector {
  name: 'plaid' | 'mock';
  /** Pass the access token to fix a login that broke, rather than connecting again. */
  createLink(householdId: string, accessToken?: string): Promise<Link>;
  exchange(publicToken: string): Promise<Login>;
  /** Everything since the cursor, across as many pages as it takes. */
  sync(accessToken: string, cursor: string | null): Promise<SyncPage>;
  disconnect(accessToken: string): Promise<void>;
}
