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

## What's in it

**Plan.** Say what's changing, connect your spending, and the agent answers in one sentence, shows your money today, during the change and after it, then lists the steps. With a key it searches the web for current rates and shows its sources. Fixed rules then check every dollar against your real balances.

**Budget.** A board of real spreadsheets you can drag, resize and edit like Excel. Click a cell and type. Drag a purchase onto a category to sort it, and the agent remembers that merchant. It opens on a sample family until you connect your own.

## Connecting without a bank login

| Source | How | Status |
| --- | --- | --- |
| Bank or card statement (CSV) | Drop the file. Read in your browser and never uploaded. | Works now |
| PDF statement | Drop the file. Claude reads it. | Works now, needs a key |
| Apple Wallet screenshot | Drop the picture. Claude reads it. | Works now, needs a key |
| Email receipt or bank alert | Paste it. Claude reads it. | Works now, needs a key |
| Every Apple Pay tap | An iPhone Shortcut opens `/?spent=AMOUNT&at=MERCHANT` | Built, needs the site online. Not yet tried on a real iPhone. |
| Forwarded bank alert emails | A personal address that alerts get forwarded to | Not built. Needs a server and accounts. |

Apple does not let websites read Wallet, and its FinanceKit API only reaches native apps. Canada's open banking law has passed but isn't live yet.

## Stack and cost

- Next.js 16, TypeScript, Tailwind and Framer Motion, with no database. Your numbers stay in the browser unless you use an AI feature.
- Plans use Claude Sonnet, with Claude Haiku for the quick first steps. Gemini is a fallback if a Google key is set.
- Live search and reading files use Claude Opus 5.5 at low effort, with a server-side fallback if a request is refused. Search uses Google grounding instead if a Google key is set.
- A real plan with live search takes about a minute. Rate limits default to 20 requests per IP and 1,000 a day overall.

## Deploy

Vercel: import the repo and set your environment variables. For heavy traffic, swap `src/lib/rate-limit.ts` for a shared store.

GitHub Pages: `npm run build:static` makes a static site. It has no server, so it uses the built-in planner, and reading pictures and PDFs is turned off.

## Sponsor slot

Set `NEXT_PUBLIC_SPONSOR_NAME`, `NEXT_PUBLIC_SPONSOR_PITCH` and `NEXT_PUBLIC_SPONSOR_URL`. It appears in a plan's details when all three are set.

## Tests

```bash
npm test               # planner, budget, statement parsing, guardrails
npm run test:e2e       # real browser, including a no-scrolling check at six window sizes
npm run eval           # AI pipeline, replayed from recorded fixtures
```

`npm run test:e2e` needs a browser the first time: `npx playwright install chromium`. None of these spend API credits.
