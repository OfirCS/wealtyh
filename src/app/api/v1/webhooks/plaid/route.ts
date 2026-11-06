import { verifyPlaidWebhook } from '@/server/connectors/plaid';
import { route } from '@/server/http';
import { syncItem } from '@/server/sync';

const SYNC_ON = new Set(['SYNC_UPDATES_AVAILABLE', 'ERROR', 'PENDING_EXPIRATION']);

export const POST = route(async (request) => {
  const body = await request.text();
  await verifyPlaidWebhook(request.headers.get('plaid-verification'), body);
  const { webhook_code: code, item_id: itemId } = JSON.parse(body) as { webhook_code?: string; item_id?: string };
  if (itemId && code && SYNC_ON.has(code)) await syncItem('plaid', itemId);
  return { ok: true };
});
