# Pathfinder architecture

One purchase, many sightings. Every source (bank, Gmail, Apple Wallet, statements, typed) only ever
reports a **sighting**. The ledger folds sightings into **purchases**, so nothing counts twice and no
source is special. Adding a source never touches the budget logic.

## Real connections

| Source | How | Gives | Cost |
| --- | --- | --- | --- |
| Bank and cards | Plaid Link, read-only | History and every future charge, including all Apple Pay taps | Free Trial: 10 live logins |
| Gmail | Google sign-in in the browser | Receipts, items, return windows, trials, renewals | Free |
| Apple Wallet | A Shortcuts automation sends each tap: by email through Gmail today, straight to `/api/v1/wallet/tap` once the app has a public address | The tap within seconds, clean merchant name | Free |
| Statement | CSV or PDF | Backfill when a bank won't connect | Free |

Screenshots are gone from the connect flow. Apple has no Wallet history door in Canada: FinanceKit covers
Apple Card and Cash in the US and open banking in the UK. Apple Pay is only the card, so the bank link
catches every tap, and the automation makes it instant.

Bank providers are behind one interface, so Flinks ($500/month minimum) or Canada's Consumer-Driven Banking
APIs can replace or sit beside Plaid when volume or coverage calls for it. Canadian logins break often
(Plaid has open issues on Wealthsimple, CIBC, BMO, Tangerine), so "needs login" is a normal state with
one tap to fix, and statements and Wallet keep the budget alive meanwhile.

## Layout

```
src/core/      Pure TypeScript. No React, Next, DOM or env. Shared by web, server and a future phone app.
  ledger/      Sighting and Purchase types, reconcile(), merchant matching
  plans/       Free and paid limits
src/server/    Server only.
  env.ts       Typed environment
  db/          Drizzle schema. Any Postgres in production, PGlite in .data/ locally
  auth/        Sessions (HttpOnly cookie on web, Bearer on a phone)
  crypto.ts    AES-256-GCM for bank tokens at rest
  connectors/  BankConnector interface, plaid.ts, mock.ts
  sync.ts      Idempotent sync of one connection
  wallet.ts    Tap tokens and tap intake
  billing.ts   Plans and Stripe. Off until Stripe keys exist, and until then everyone gets Family
  rate-limit.ts  Shared counters in the database
src/client/    Browser and phone client for /api/v1, and hooks
src/lib/       The local-first budget that exists today
src/app/api/v1 Versioned API. The only thing a phone app needs.
```

Direction of imports: `core` imports nothing else. `server` and `client` import `core`. `client` never
imports `server`.

## Data flow

1. A connector returns `Sighting[]`. The server stores them raw and idempotently, with a per-household
   sequence number. Nothing is categorized or merged on the server.
2. The client pulls `GET /api/v1/sightings?after=<seq>`.
3. `reconcile(purchases, sightings)` folds them into the budget on the device. It is pure, so the server or
   a phone can run the same function later.
4. Every purchase is one of three things: a bill, everyday spending, or a one-off. `purchaseRhythms` works
   this out from the whole history, and the agent reads each payee's pattern of dates and amounts to
   judge it (`/api/budget/rhythm`). The user's word beats the agent's, and the agent's beats the rules.
   One-offs still count as money spent, but they never shape a budget amount.
5. The budget is saved locally and, for households signed in with Google, as one sealed, versioned
   document with `PUT /api/v1/budget`, so a second device sees the same budget without a rescan. If two
   devices collide, the newer one wins. It can be normalized later without changing the client.

## API v1

All routes take the session cookie or `Authorization: Bearer`. Errors are `{ error: { code, message } }`.

| Route | Purpose |
| --- | --- |
| `POST /api/v1/session` | Find or create the household, set the session. Optional `{ googleAccessToken }` ties it to a verified Google account, so another device finds the same household |
| `GET /api/v1/connections` | List connections with status: `ok`, `needs_login`, `error` |
| `DELETE /api/v1/connections/:id` | Disconnect and revoke at the provider |
| `POST /api/v1/bank/link-token` | `{ linkToken, mode: 'plaid' \| 'mock', relink? }` |
| `POST /api/v1/bank/connect` | Swap the public token, store it encrypted, run the first sync |
| `POST /api/v1/sync` | Sync this household's connections. Throttled per connection |
| `GET /api/v1/sightings` | `after`, `limit`. Returns `{ sightings, removed, next }` |
| `GET, PUT /api/v1/budget` | The versioned budget document. `PUT` takes `version`, and answers 409 if it's stale |
| `DELETE /api/v1/session` | Sign out |
| `POST /api/v1/billing/checkout`, `/billing/portal` | Stripe checkout and plan management |
| `POST /api/v1/webhooks/stripe` | Verified by Stripe's signature. Turns Family on and off |
| `POST /api/v1/wallet/token` | Mint a tap token. Returned once, stored hashed |
| `POST /api/v1/wallet/tap` | `Authorization: Bearer <tap token>`, `{ amount, merchant, card?, name? }` |
| `POST /api/v1/webhooks/plaid` | Verified by Plaid's signed JWT. Syncs the item |
| `GET /api/v1/cron/sync` | Daily safety net, called by `netlify/functions/daily-check.mts`. Guarded by `CRON_SECRET` |

## Rules

- Money is integer cents in `core` and on the server. The budget in `src/lib` uses dollars, and the adapter
  converts.
- Sign: positive is money out, as Plaid reports it and as the budget stores it.
- Every write is idempotent: a sighting id is `provider:providerId`, and storing it twice changes nothing.
- A user's edit always wins. Locked fields and deleted purchases survive every later sync.
- Bank tokens are encrypted at rest. Tap tokens are stored hashed. Neither is ever logged or sent to a client.
- No personal data in URLs, in logs, or in the repo.
- The app runs with no keys at all: no Plaid keys means the mock bank in development, and bank rows hidden in
  production. The mock can never run when `NODE_ENV=production`.
- AI calls have a per-address and a daily global cap in shared counters, so a public API can't burn the credit.
- Making a new household and forcing a sync are capped too, so a script can't fill the database.

## Hosting limits

Netlify ends every request at 30 seconds, streams included, so nothing may depend on a longer one:

- Receipts go in batches of about 20 emails, 4 at a time. A batch takes 9 to 14 seconds.
- A live search takes about 24 seconds and a normal draft about 25, so `PLAN_QUICK=on` skips the search and drafts in fast mode there: about 10 seconds, at twice the price per word. If a stream ever ends early anywhere, the client falls back to the built-in planner.
- A long PDF statement may not finish. A CSV always does, since it's read in the browser.

A host with longer requests would bring live search back to plans.
