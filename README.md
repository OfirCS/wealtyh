# Pathfinder

A Canadian money agent. It builds a family budget by itself from your bank, Gmail and Apple Pay, counts every purchase once, and catches what banks can't see: return windows, trials, refunds due. Say what's changing in your life and it tells you plainly whether you can afford it.

Read-only. It's for learning, not financial advice, and it never moves real money.

## Run it

```bash
npm install
npm run dev            # http://localhost:3003
```

That's all you need. With no keys it uses the built-in planner. To turn on the live agent, add a key:

```bash
cp .env.example .env   # then paste in your ANTHROPIC_API_KEY
```

## The journey

1. **Landing:** see the agent at work, then get started.
2. **Sign in:** one click with Google, which connects Gmail at the same time. Or try the demo account, which uses a made-up family.
3. **Agent run:** the agent searches the inbox, reads receipts and bank alerts, and prints your month as a receipt while you watch.
4. **Home:** money left, what the agent noticed, what's coming up, and where it went, all on one page.

From there:

- **Budget** is one ledger: categories, a year view, and every purchase with who saw it. Tap a category to change it, and tap a purchase to fix it. The agent remembers.
- **Plans** answers "can I afford this?" in one sentence, with your money today, during the change and after. With a key it searches the web for current rates and shows its sources. Fixed rules then check every dollar against your real balances.
- **Accounts** shows where your agent looks.

## How the agent gets your spending

You connect once and the agent does the rest. A purchase can reach it from several sources, and `src/core/ledger` folds them into one, so nothing counts twice.

| Connection | What happens | Status |
| --- | --- | --- |
| Gmail | Signing in with Google lets the agent search your inbox for receipts and bank alerts, read them with Claude, and fill in your budget. "Check for new" picks up anything since. | Built. Needs a Google client ID. |
| Bank and cards | Plaid Link, read-only. Catches every Apple Pay tap, since Apple Pay is only the card | Built. Add Plaid keys. Free for 10 logins. |
| Apple Wallet | An iPhone automation sends each tap as it happens | Built. Live on the founder's iPhone. |
| Bank statement | A CSV is read in your browser and never uploaded. A PDF is read by Claude. | Works now, as a fallback |

For the best results, turn on an email alert for every purchase in your banking app. Then your bank spending reaches Gmail too.

Apple doesn't let websites read Wallet, and FinanceKit only reaches native apps. Canada's open banking law has passed but isn't live yet.

## Turn on bank connections

Plaid's free Trial covers 10 real logins, with no card.

1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com), then apply at [dashboard.plaid.com/trial-plan](https://dashboard.plaid.com/trial-plan).
2. Copy your client ID and production secret into `.env` as `PLAID_CLIENT_ID` and `PLAID_SECRET`, and set `PLAID_ENV=production`.
3. Restart. Accounts now shows Bank and cards.

Without keys, a dev server offers a pretend Test Bank, so everything can be built and tried. It can never run in production.

## Turn on Gmail

You do this once, as the site owner. People using the app just click Continue with Google.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Under APIs & Services, enable the **Gmail API**.
3. Under Google Auth Platform, set up the consent screen as **External**, and add your own email as a **test user**.
4. Under Clients, create an **OAuth client** of type **Web application**.
5. Add `http://localhost:3003` to **Authorized JavaScript origins**.
6. Copy the client ID into `.env` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, then restart `npm run dev`.

Test mode allows up to 100 people you add by hand. Opening it to everyone means going through Google's verification for Gmail access, including a security review.

## Design rules

See `docs/strategy/04-design-principles.md`. In short: a paper ledger, not a dashboard. One lime action per screen, a pilot light for the agent, and a receipt tape for its work.

## Give it to a friend

1. Put it online (`vercel`), with the variables from `.env`.
2. In Google Cloud, add that address to the client's JavaScript origins.
3. Add your friend's Gmail to the test users. Up to 100 people, until Google verifies the app.

## What makes this different

Budget apps read bank lines. Pathfinder reads receipts, so it knows what a bank can't: what you bought, when a return window closes, when a trial ends, and when a refund is due. That's the deadline radar, and each date on it is real money at stake.

## What's next

1. **Ask your money.** "How much did we spend on the baby in October?" Receipts know the items.
2. **Money found.** One running total of refunds caught, returns made and subscriptions cancelled.
3. **Family.** Both partners' inboxes, one budget, one shared streak.
4. **More inboxes.** Outlook and iCloud Mail.
5. **Forwarding address.** Any mail provider, with no Google review. Needs a domain.
6. **Live Wallet taps.** The automation can post straight to `/api/v1/wallet/tap` once the app has a public address.
7. **Streak reminders.** Push and a weekly email.

## What brings people back

Most budget apps lose people the day they overspend, because that's the day they stop looking. So the streak counts looking, not perfection: a bad day can't break it, only looking away can.

- **Check in.** One click brings in new receipts and Apple Pay taps. Shields, earned every 7 days, cover a missed day.
- **A find every day.** Each check-in shows something new from your own money, so there's always a small surprise to look for.
- **A reason for tomorrow.** Every check-in ends on something real: a renewal, a shield one day away.
- **Kept money.** The streak is tied to what you've kept under an even daily pace, so it turns into a real number.
- **Reminders.** One tap adds a nightly check-in and your renewal dates to your own calendar.

## Going from one family to thousands

The design is in `docs/ARCHITECTURE.md`. The ledger is plain functions that run anywhere, the API is versioned, and a phone app needs nothing but `/api/v1`. In order of what blocks growth first:

1. **Google's approval.** Reading Gmail is a restricted permission. Until Google verifies the app it's limited to 100 test users, ever, and they see a warning screen. Verification includes a security review, and because email text passes through our server to the AI, expect a paid yearly assessment. The way around it is a forwarding address: people forward receipts to Pathfinder, and no Gmail permission is needed.
2. **A hosted database.** Set `DATABASE_URL` and run `npm run db:migrate` at deploy. Locally, PGlite keeps everything in `.data/`.
3. **Background checks.** Gmail access expires after an hour, so today each check-in needs a click. A server holding a refresh token can read new receipts overnight, which makes the app feel alive. This needs step 1 first.
4. **Streak reminders.** `bestNudge` in `src/lib/comeback.ts` already picks the single best thing to say to each person, and shows it on the dashboard. Sending it as a push or an email needs a server. Until then, calendar reminders do the job for free.
5. **Plaid's price.** Rates appear after applying. Check them against the Family plan before opening to the public. See `docs/strategy/03-pricing-and-free-plan.md`.
6. **AI cost.** The first scan is the expensive one. Later check-ins only read new mail. `/api/budget/read` logs tokens per request so the real cost can be measured before choosing a cheaper model.
7. **Apple Wallet.** Since iOS 27 the Wallet trigger lives inside the Shortcut itself, so a shared Shortcut may carry its automation with it. Worth testing: one tap to add, nothing to attach.

## Stack and cost

- Next.js 16, TypeScript, Tailwind and Framer Motion. Drizzle on Postgres, or PGlite locally. Bank tokens are sealed with AES-256-GCM. Stripe for plans. The budget lives in the browser. Email and plan details go to AI services to be read.
- Plans use Claude Opus 5.5, with Claude Haiku for the quick first steps. Gemini is a fallback if a Google key is set.
- Live search and reading email and PDFs use Claude Opus 5.5 at low effort, with a server-side fallback if a request is refused. Search uses Google grounding instead if a Google key is set.
- A real plan with live search takes about a minute. Rate limits default to 20 requests per IP and 1,000 a day overall.

## Deploy

Netlify: set the variables in `.env.example`, then `npx netlify-cli deploy --prod`. While `SITE_PASSWORD` is set, the whole site stays private behind it.

Gmail, the budget and plans run with no database. Bank logins, live Wallet taps and the same budget on every device need one: set `DATABASE_URL` to any Postgres, such as a free Neon project. Migrations run with the build.

GitHub Pages: `npm run build:static` makes a static site. It has no server, so it uses the built-in planner, and reading email and PDFs is turned off.

## Sponsor slot

Set `NEXT_PUBLIC_SPONSOR_NAME`, `NEXT_PUBLIC_SPONSOR_PITCH` and `NEXT_PUBLIC_SPONSOR_URL`. It appears in a plan's details when all three are set.

## Tests

```bash
npm test               # ledger, server, planner, budget, statement parsing, guardrails
npm run test:e2e       # real browser, including a no-scrolling check at six window sizes
npm run eval           # AI pipeline, replayed from recorded fixtures
```

`npm run test:e2e` needs a browser the first time: `npx playwright install chromium`. None of these spend API credits.

## Coming back

Setup happens once: sign in, the agent reads the month, and one screen offers the bank and Apple Wallet. After that a scheduled function syncs banks daily and taps arrive live. `src/lib/points.ts` holds what brings people back: points for habits, never lost on a bad day, and one weekly goal set from the family's own spending.
