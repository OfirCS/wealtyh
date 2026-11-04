# Pathfinder

A free Canadian money agent. Say what's changing in your life, show it your spending, and get a plain answer: can you afford this, and what should you do? It also keeps a family budget that fills itself in.

No signup and no bank login. It's for learning, not financial advice, and it never moves real money.

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
3. **Agent run:** the agent searches the inbox, reads receipts and bank alerts, sorts spending, and builds the budget while you watch.
4. **Dashboard:** money left, what your agent wants to raise, bills coming up, where it's going, and latest purchases.

From there:

- **Budget** is a board of real spreadsheets you can drag, resize and edit. Click a cell and type. Drag a purchase onto a category to sort it, and the agent remembers that merchant.
- **Plans** answers "can I afford this?" in one sentence, with your money today, during the change and after. With a key it searches the web for current rates and shows its sources. Fixed rules then check every dollar against your real balances.
- **Connections** shows where your agent looks.

## How the agent gets your spending

No bank login. You connect once and the agent does the rest.

| Connection | What happens | Status |
| --- | --- | --- |
| Gmail | Signing in with Google lets the agent search your inbox for receipts and bank alerts, read them with Claude, and fill in your budget. "Check for new" picks up anything since. | Built. Needs a Google client ID. |
| Apple Pay | An iPhone Shortcut opens `/?spent=AMOUNT&at=MERCHANT` after each tap | Built. Needs the site online. |
| Bank statement | A CSV is read in your browser and never uploaded. A PDF is read by Claude. | Works now, as a fallback |

For the best results, turn on an email alert for every purchase in your banking app. Then your bank spending reaches Gmail too.

Apple doesn't let websites read Wallet, and FinanceKit only reaches native apps. Canada's open banking law has passed but isn't live yet.

## Turn on Gmail

You do this once, as the site owner. People using the app just click Continue with Google.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Under APIs & Services, enable the **Gmail API**.
3. Under Google Auth Platform, set up the consent screen as **External**, and add your own email as a **test user**.
4. Under Clients, create an **OAuth client** of type **Web application**.
5. Add `http://localhost:3003` to **Authorized JavaScript origins**.
6. Copy the client ID into `.env` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, then restart `npm run dev`.

Test mode allows up to 100 people you add by hand. Opening it to everyone means going through Google's verification for Gmail access, including a security review.

## Stack and cost

- Next.js 16, TypeScript, Tailwind and Framer Motion, with no database or server accounts. Sign-in and your numbers live in the browser, so a second device starts fresh. Email and plan details go to AI services to be read.
- Plans use Claude Sonnet, with Claude Haiku for the quick first steps. Gemini is a fallback if a Google key is set.
- Live search and reading email and PDFs use Claude Opus 5.5 at low effort, with a server-side fallback if a request is refused. Search uses Google grounding instead if a Google key is set.
- A real plan with live search takes about a minute. Rate limits default to 20 requests per IP and 1,000 a day overall.

## Deploy

Vercel: import the repo and set your environment variables. For heavy traffic, swap `src/lib/rate-limit.ts` for a shared store.

GitHub Pages: `npm run build:static` makes a static site. It has no server, so it uses the built-in planner, and reading email and PDFs is turned off.

## Sponsor slot

Set `NEXT_PUBLIC_SPONSOR_NAME`, `NEXT_PUBLIC_SPONSOR_PITCH` and `NEXT_PUBLIC_SPONSOR_URL`. It appears in a plan's details when all three are set.

## Tests

```bash
npm test               # planner, budget, statement parsing, guardrails
npm run test:e2e       # real browser, including a no-scrolling check at six window sizes
npm run eval           # AI pipeline, replayed from recorded fixtures
```

`npm run test:e2e` needs a browser the first time: `npx playwright install chromium`. None of these spend API credits.
