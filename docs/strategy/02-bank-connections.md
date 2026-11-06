# Connecting banks in Canada

**Decision: Plaid first, behind `BankConnector`, so Flinks or the coming open banking APIs can replace it.**

| Option | Cost | Note |
| --- | --- | --- |
| Plaid | Free Trial: 10 real logins, for new US or Canadian teams. Then pay as you go, rates shown after applying | Self-serve. Transactions included |
| Flinks | From $500/month for 200 connections, one-year term | Canadian, owned by National Bank. Later, if Plaid's coverage hurts |
| Canada's Consumer-Driven Banking | Unknown | Law since March 2026. Read-only first. No firm date |
| Apple FinanceKit | Not in Canada | Apple Card and Cash in the US, open banking in the UK. Needs a native app and an entitlement |

Expect breakage. Plaid has open issues on [Wealthsimple, CIBC, BMO and Tangerine](https://support.lunchmoney.app/guides/automatic-imports/institution-specific-issues), and Wealthsimple reportedly asks for re-approval about monthly. Wealthsimple's card through Plaid is unproven until a real login is tried. CSV stays as the fallback.

Apple Pay is only the card, so the bank link catches every tap. The Wallet automation adds speed and a clean store name.

Gmail past 100 users needs Google's restricted-scope review and a yearly CASA assessment, reported at about US$500 to $5,400. A forwarding address avoids it.

Sources: [Plaid billing](https://plaid.com/docs/account/billing/), [Flinks pricing](https://www.flinks.com/pricing), [FinanceKit](https://developer.apple.com/financekit), [Competition Bureau](https://www.canada.ca/en/competition-bureau/news/2026/03/moving-canadas-financial-sector-forward-for-consumers.html), [CASA costs](https://deepstrike.io/blog/google-casa-security-assessment-2025).
