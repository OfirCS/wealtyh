import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addQuickEntry,
  budgetFromProfile,
  categorize,
  defaultMonth,
  importStatement,
  merchantKey,
  monthSummary,
  nextUnsure,
  parseQuickEntry,
  profileWithBudget,
  shiftMonth,
  sortMerchant,
  totalPlanned,
} from '@/lib/budget';
import { DEFAULT_PROFILE } from '@/lib/defaults';
import { emailToText, parseWalletTap, readEmails } from '@/lib/gmail';
import { cleanAgentRows, parseCsv, parseStatement, StatementError } from '@/lib/statement';
import { sampleStatement } from '@/lib/sample-statement';

describe('parseCsv', () => {
  it('handles quotes, commas in fields, CRLF and a byte order mark', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n1,2,3\r\n')).toEqual([['a', 'b, c', 'say "hi"'], ['1', '2', '3']]);
  });
});

describe('parseStatement', () => {
  it('reads an RBC export', () => {
    const rows = parseStatement([
      '"Account Type","Account Number","Transaction Date","Cheque Number","Description 1","Description 2","CAD$","USD$"',
      'Chequing,00000-1234567,10/3/2026,,"LOBLAWS #1234","TORONTO",-82.15,',
      'Chequing,00000-1234567,10/5/2026,,"PAYROLL DEPOSIT","ACME INC",2400.00,',
    ].join('\n'));
    expect(rows).toEqual([
      { date: '2026-10-03', description: 'LOBLAWS #1234 TORONTO', amount: 82.15 },
      { date: '2026-10-05', description: 'PAYROLL DEPOSIT ACME INC', amount: -2400 },
    ]);
  });

  it('reads a TD export with no header row', () => {
    const rows = parseStatement([
      '10/03/2026,LOBLAWS 1234,82.15,,1200.00',
      '10/05/2026,PAYROLL DEPOSIT,,2400.00,3600.00',
      '10/06/2026,NETFLIX.COM,16.99,,3583.01',
    ].join('\n'));
    expect(rows).toEqual([
      { date: '2026-10-03', description: 'LOBLAWS 1234', amount: 82.15 },
      { date: '2026-10-05', description: 'PAYROLL DEPOSIT', amount: -2400 },
      { date: '2026-10-06', description: 'NETFLIX.COM', amount: 16.99 },
    ]);
  });

  it('reads a BMO export with notes above the data', () => {
    const rows = parseStatement([
      'Following data is valid as of 20261101',
      '',
      'First Bank Card,Transaction Type,Date Posted, Transaction Amount,Description',
      "'5191000000000000',DEBIT,20261003,-82.15,[POS]LOBLAWS",
      "'5191000000000000',CREDIT,20261005,2400.00,[DD]PAYROLL",
    ].join('\n'));
    expect(rows).toEqual([
      { date: '2026-10-03', description: '[POS]LOBLAWS', amount: 82.15 },
      { date: '2026-10-05', description: '[DD]PAYROLL', amount: -2400 },
    ]);
  });

  it('reads a Tangerine export, joining name and memo', () => {
    const rows = parseStatement([
      'Date,Transaction,Name,Memo,Amount',
      '10/3/2026,DEBIT,LOBLAWS,Point of sale,-82.15',
    ].join('\n'));
    expect(rows[0]).toEqual({ date: '2026-10-03', description: 'LOBLAWS Point of sale', amount: 82.15 });
  });

  it('treats positive amounts as spending on credit card exports', () => {
    const rows = parseStatement([
      'Date,Description,Amount',
      '2026-10-03,COSTCO,120.50',
      '2026-10-04,NETFLIX,16.99',
      '2026-10-09,PAYMENT THANK YOU,-500.00',
    ].join('\n'));
    expect(rows.map((row) => row.amount)).toEqual([120.5, 16.99, -500]);
  });

  it('understands day-first dates when the numbers prove it', () => {
    const rows = parseStatement('Date,Description,Amount\n25/10/2026,COSTCO,-10\n03/10/2026,METRO,-20');
    expect(rows.map((row) => row.date)).toEqual(['2026-10-03', '2026-10-25']);
  });

  it('gives a friendly error for something that is not a statement', () => {
    expect(() => parseStatement('hello there\nthis is not a statement')).toThrow(StatementError);
    expect(() => parseStatement('')).toThrow(StatementError);
  });
});

describe('categorize', () => {
  it.each([
    ['LOBLAWS #1234', 'groceries'],
    ['COSTCO WHOLESALE', 'groceries'],
    ['UBER EATS TORONTO', 'eating'],
    ['UBER TRIP', 'transport'],
    ['ROGERS WIRELESS', 'bills'],
    ['AMAZON PRIME', 'bills'],
    ['AMAZON.CA ORDER', 'shopping'],
    ['BRIGHT PATH DAYCARE', 'kids'],
    ['E-TRANSFER SENT', 'transfer'],
    ['PAYMENT - THANK YOU', 'transfer'],
  ])('%s -> %s', (description, category) => {
    expect(categorize(description).categoryId).toBe(category);
  });

  it('admits when it is not sure', () => {
    expect(categorize('SQ *MAPLE CORNER')).toEqual({ categoryId: 'other', sure: false });
  });

  it('remembers what the user taught it', () => {
    const rules = { [merchantKey('SQ *MAPLE CORNER')]: 'eating' };
    expect(categorize('SQ *MAPLE CORNER #2', rules)).toEqual({ categoryId: 'eating', sure: true });
  });
});

describe('importStatement', () => {
  const rows = parseStatement(sampleStatement(new Date(2026, 10, 15)));
  const { budget, summary } = importStatement(rows, null, 0);

  it('reads all of it and counts income and spending separately', () => {
    expect(summary.count).toBe(rows.length);
    expect(summary.monthlyIncome).toBeGreaterThan(summary.monthlySpend);
    expect(summary.monthlySpend).toBeGreaterThan(0);
  });

  it('never counts a transfer or a pay cheque as spending', () => {
    const month = monthSummary(budget, '2026-10');
    expect(month.spentByCategory.transfer).toBeUndefined();
    expect(month.spentByCategory.income).toBeUndefined();
    expect(budget.categories.some((category) => category.id === 'transfer' || category.id === 'income')).toBe(false);
  });

  it('finds regular bills', () => {
    expect(summary.regularBills).toBeGreaterThan(2);
  });

  it('sets budgets that cover what was really spent', () => {
    expect(totalPlanned(budget)).toBeGreaterThanOrEqual(summary.monthlySpend);
  });

  it('never double-counts a statement imported twice', () => {
    const again = importStatement(rows, budget, 0);
    expect(again.budget.transactions).toHaveLength(budget.transactions.length);
    expect(again.summary.count).toBe(0);
  });

  it('keeps the amounts the user set when more data arrives', () => {
    const edited = { ...budget, categories: budget.categories.map((category) => ({ ...category, planned: 111 })) };
    const more = importStatement([{ date: '2026-12-01', description: 'COSTCO', amount: 50 }], edited, 0);
    expect(more.budget.categories.find((category) => category.id === 'groceries')?.planned).toBe(111);
  });

  it('asks about what it cannot sort, then stops asking once told', () => {
    const first = nextUnsure(budget);
    expect(first).not.toBeNull();
    const sorted = sortMerchant(budget, first!.transaction.description, 'fun');
    expect(sorted.transactions.filter((item) => merchantKey(item.description) === merchantKey(first!.transaction.description)).every((item) => item.sure && item.categoryId === 'fun')).toBe(true);
    expect(sorted.categories.some((category) => category.id === 'fun')).toBe(true);
  });
});

describe('parseQuickEntry', () => {
  it.each([
    ['45 costco', 45, 'costco'],
    ['costco 45.20', 45.2, 'costco'],
    ['$12 tim hortons', 12, 'tim hortons'],
    ['1,200 rent', 1200, 'rent'],
  ])('%s', (text, amount, description) => {
    expect(parseQuickEntry(text)).toEqual({ amount, description });
  });

  it('needs both an amount and a name', () => {
    expect(parseQuickEntry('costco')).toBeNull();
    expect(parseQuickEntry('45')).toBeNull();
    expect(parseQuickEntry('')).toBeNull();
  });
});

describe('connection to Pathfinder', () => {
  it('starts a budget from Pathfinder numbers without losing any spending', () => {
    const budget = budgetFromProfile(DEFAULT_PROFILE);
    expect(totalPlanned(budget)).toBe(
      DEFAULT_PROFILE.housingExpense + DEFAULT_PROFILE.essentialExpenses + DEFAULT_PROFILE.discretionarySpending + DEFAULT_PROFILE.debtPayments,
    );
  });

  it('round-trips: a budget made from Pathfinder gives the same numbers back', () => {
    const updated = profileWithBudget(DEFAULT_PROFILE, budgetFromProfile(DEFAULT_PROFILE));
    expect(updated.housingExpense).toBe(DEFAULT_PROFILE.housingExpense);
    expect(updated.essentialExpenses).toBe(DEFAULT_PROFILE.essentialExpenses);
    expect(updated.discretionarySpending).toBe(DEFAULT_PROFILE.discretionarySpending);
    expect(updated.debtPayments).toBe(DEFAULT_PROFILE.debtPayments);
  });

  it('adds typed spending to the right category and month', () => {
    const start = budgetFromProfile(DEFAULT_PROFILE);
    const { budget, categoryId } = addQuickEntry(start, { amount: 45, description: 'costco' }, '2026-11-02');
    expect(categoryId).toBe('groceries');
    expect(monthSummary(budget, '2026-11').spentByCategory.groceries).toBe(45);
    expect(monthSummary(budget, '2026-10').spent).toBe(0);
  });
});

describe('months', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('opens on the latest month with data when this month is empty', () => {
    const budget = { ...budgetFromProfile(DEFAULT_PROFILE), transactions: [{ id: '1', date: '2026-09-05', description: 'x', amount: 5, categoryId: 'fun', sure: true }] };
    expect(defaultMonth(budget, new Date(2026, 10, 4))).toBe('2026-09');
  });
});

describe('cleanAgentRows', () => {
  it('keeps good rows and tidies them', () => {
    expect(cleanAgentRows([{ date: '2026-11-02', description: '  Tim  Hortons ', amount: 6.456 }], '2026-11-04')).toEqual([
      { date: '2026-11-02', description: 'Tim Hortons', amount: 6.46 },
    ]);
  });

  it('falls back to today when a date is unusable', () => {
    expect(cleanAgentRows([{ date: 'yesterday', description: 'Shell', amount: 40 }], '2026-11-04')[0].date).toBe('2026-11-04');
  });

  it('drops anything that is not a real transaction', () => {
    expect(cleanAgentRows([{ description: 'No amount' }, { description: '', amount: 5 }, { description: 'Zero', amount: 0 }, { description: 'Bad', amount: 'x' }, null], '2026-11-04')).toEqual([]);
    expect(cleanAgentRows('not a list', '2026-11-04')).toEqual([]);
  });
});

describe('plain sentences', () => {
  it('reads natural spending notes', () => {
    expect(parseQuickEntry('spent 40 on gas')).toEqual({ amount: 40, description: 'gas' });
    expect(parseQuickEntry('paid $12.50 for lunch')).toEqual({ amount: 12.5, description: 'lunch' });
    expect(categorize('gas').categoryId).toBe('transport');
    expect(categorize('lunch').categoryId).toBe('eating');
  });
});

describe('emailToText', () => {
  const body = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_');
  const headers = [{ name: 'From', value: 'Shop <hi@shop.ca>' }, { name: 'Subject', value: 'Your receipt' }];

  it('prefers plain text and keeps who, when and what', () => {
    const text = emailToText({
      internalDate: String(Date.UTC(2026, 10, 2, 12)),
      payload: { headers, parts: [{ mimeType: 'text/html', body: { data: body('<b>ignored</b>') } }, { mimeType: 'text/plain', body: { data: body('Total $12.50') } }] },
    });
    expect(text).toContain('From: Shop <hi@shop.ca>');
    expect(text).toContain('Date: 2026-11-02');
    expect(text).toContain('Total $12.50');
    expect(text).not.toContain('ignored');
  });

  it('strips html, styles and scripts', () => {
    const text = emailToText({ payload: { headers, mimeType: 'text/html', body: { data: body('<style>a{color:red}</style><p>Total <b>$9</b></p><script>x()</script>') } } });
    expect(text).toContain('Total $9');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('x()');
  });

  it('falls back to the preview when there is no body', () => {
    expect(emailToText({ snippet: 'Paid $5', payload: { headers } })).toContain('Paid $5');
  });

  it('cleans a plain part that is really html', () => {
    const css = '.m-title{font-size:16px}'.repeat(200);
    const text = emailToText({ payload: { headers, mimeType: 'text/plain', body: { data: body(`Hungry?<!--[if mso]><style>${css}</style><![endif]--><style>${css}</style><table><tr><td>Order total</td><td>$13.10</td></tr></table>`) } } });
    expect(text).toContain('Order total $13.10');
    expect(text).not.toContain('font-size');
  });

  it('uses the html when the plain part has no amount', () => {
    const text = emailToText({ payload: { headers, parts: [{ mimeType: 'text/plain', body: { data: body('Receipt App Store') } }, { mimeType: 'text/html', body: { data: body('<p>App Store</p><p>TOTAL $14.99</p>') } }] } });
    expect(text).toContain('TOTAL $14.99');
  });

  it('removes links and invisible padding', () => {
    const padding = '\u034f '.repeat(400);
    const text = emailToText({ payload: { headers, mimeType: 'text/plain', body: { data: body(new TextDecoder('latin1').decode(new TextEncoder().encode(`${padding}Total $9.50 https://clicks.example.com/abc123`))) } } });
    expect(text).toContain('Total $9.50');
    expect(text).not.toContain('clicks.example.com');
    expect(text.length).toBeLessThan(200);
  });

  it('keeps the total of a very long email, and every order in it', () => {
    const items = Array.from({ length: 60 }, (_, index) => `Item number ${index} with a long product name that goes on and on`).join(' ');
    const text = emailToText({ payload: { headers, mimeType: 'text/plain', body: { data: body(`Thanks ${items} First order Total 48.38 CAD ${items} Second order Total 14.68 CAD Unsubscribe here`) } } });
    expect(text).toContain('Total 48.38 CAD');
    expect(text).toContain('Total 14.68 CAD');
    expect(text.length).toBeLessThan(2600);
  });
});

describe('rows read from email', () => {
  const emailed = (description: string, amount: number) => ({ date: '2026-10-16', description, amount, emailed: true });

  it('never mistakes a refund for pay', () => {
    const { budget } = importStatement([emailed('Amazon', 120), emailed('Fitrell Socks', -30.5)], null, 0);
    expect(budget.income).toBe(0);
    expect(budget.transactions.find((item) => item.amount < 0)?.categoryId).not.toBe('income');
  });

  it('keeps an e-Transfer, without asking about it', () => {
    const { budget, summary } = importStatement([emailed('Jane Example (e-Transfer)', 889.5)], null, 0);
    expect(budget.transactions[0]).toMatchObject({ categoryId: 'people', sure: true });
    expect(summary.notCounted).toBe(0);
  });

  it('remembers once an e-Transfer has been sorted', () => {
    const existing = { ...importStatement([], null, 0).budget, merchantRules: { 'JANE EXAMPLE': 'kids' } };
    const { budget } = importStatement([emailed('Jane Example (e-Transfer)', 889.5)], existing, 0);
    expect(budget.transactions[0]).toMatchObject({ categoryId: 'kids', sure: true });
  });

  it('trusts the agent on what a receipt was for', () => {
    const { budget } = importStatement([{ ...emailed('Instacart', 254.81), category: 'groceries' }], null, 0);
    expect(budget.transactions[0]).toMatchObject({ categoryId: 'groceries', sure: true });
  });

  it('puts the user\'s own choice ahead of the agent', () => {
    const existing = { ...importStatement([], null, 0).budget, merchantRules: { INSTACART: 'kids' } };
    const { budget } = importStatement([{ ...emailed('Instacart', 254.81), category: 'groceries' }], existing, 0);
    expect(budget.transactions[0].categoryId).toBe('kids');
  });

  it('ignores a category it does not know', () => {
    const { budget } = importStatement([{ ...emailed('Mystery Shop', 10), category: 'made-up' }], null, 0);
    expect(budget.transactions[0]).toMatchObject({ categoryId: 'other', sure: false });
  });

  it('shows spending first seen in the month still underway', () => {
    const rows = [{ ...emailed('Subway', 13.1), date: '2026-10-16', category: 'eating' }, { ...emailed('Instacart', 254.81), date: '2026-11-03', category: 'groceries' }];
    const { budget } = importStatement(rows, null, 0);
    expect(budget.categories.find((category) => category.id === 'groceries')?.planned).toBe(260);
  });

  it('still treats pay on a statement as money in', () => {
    const { budget } = importStatement([{ date: '2026-10-16', description: 'Acme Payroll', amount: -3000 }], null, 0);
    expect(budget.transactions[0].categoryId).toBe('income');
  });
});

describe('Apple Wallet taps', () => {
  it('reads the email the iPhone sends', () => {
    expect(parseWalletTap('Pathfinder tap | CA$12.50 | Tim Hortons', '2026-11-04')).toEqual({ date: '2026-11-04', description: 'Tim Hortons', amount: 12.5, tapped: true });
  });

  it('copes with French and thousands formats', () => {
    expect(parseWalletTap('Pathfinder tap | 12,50 $ | Metro', '2026-11-04')?.amount).toBe(12.5);
    expect(parseWalletTap('Pathfinder tap | $1,234.56 | Ikea', '2026-11-04')?.amount).toBe(1234.56);
  });

  it('keeps a merchant with a bar in its name', () => {
    expect(parseWalletTap('Pathfinder tap | $5.00 | Cafe | Bar', '2026-11-04')?.description).toBe('Cafe | Bar');
  });

  it('copes with a mail prefix on the subject', () => {
    expect(parseWalletTap('Fwd: Pathfinder tap | $5.00 | Metro', '2026-11-04')?.amount).toBe(5);
  });

  it('ignores anything else, and a shortcut that was never finished', () => {
    expect(parseWalletTap('Your receipt from Apple', '2026-11-04')).toBeNull();
    expect(parseWalletTap('Pathfinder tap | AMOUNT | MERCHANT', '2026-11-04')).toBeNull();
    expect(parseWalletTap('Pathfinder tap | $0.00 | Metro', '2026-11-04')).toBeNull();
  });
});

describe('combining sources', () => {
  const receipt = { date: '2026-11-03', description: 'Instacart Costco', amount: 254.81, emailed: true };
  const statementLine = { date: '2026-11-04', description: 'INSTACART*COSTCO TORONTO', amount: 254.81 };
  const tap = { date: '2026-11-03', description: 'Instacart', amount: 254.81, tapped: true };

  it('counts a receipt and a tap for the same purchase once, keeping the receipt', () => {
    const { budget, summary } = importStatement([receipt, tap], null, 0, 'mail');
    expect(budget.transactions).toHaveLength(1);
    expect(budget.transactions[0].description).toBe('Instacart Costco');
    expect(summary.repeats).toBe(1);
  });

  it('matches a statement line to a receipt already in the budget', () => {
    const first = importStatement([receipt], null, 0, 'mail').budget;
    const { budget, summary } = importStatement([statementLine], first, 0, 'statement');
    expect(budget.transactions).toHaveLength(1);
    expect(summary.repeats).toBe(1);
  });

  it('leaves two real purchases as two', () => {
    const first = importStatement([{ ...tap, description: 'Tim Hortons', amount: 5.25 }], null, 0, 'mail').budget;
    const lines = [{ date: '2026-11-03', description: 'TIM HORTONS 123', amount: 5.25 }, { date: '2026-11-04', description: 'TIM HORTONS 123', amount: 5.25 }];
    expect(importStatement(lines, first, 0, 'statement').budget.transactions).toHaveLength(2);
  });

  it('keeps the same amount a week apart', () => {
    const first = importStatement([receipt], null, 0, 'mail').budget;
    expect(importStatement([{ ...statementLine, date: '2026-11-10' }], first, 0, 'statement').budget.transactions).toHaveLength(2);
  });

  it('marks a tap as coming from the wallet', () => {
    expect(importStatement([tap], null, 0, 'mail').budget.transactions[0].source).toBe('wallet');
  });
});

describe('reading a real inbox politely', () => {
  const email = (id: string) => ({ internalDate: String(Date.UTC(2026, 10, 2, 12)), snippet: `Order ${id} total $5.00`, payload: { headers: [{ name: 'Subject', value: id }] } });
  const slowDown = () => new Response(JSON.stringify({ error: { errors: [{ reason: 'rateLimitExceeded' }], message: 'Too fast' } }), { status: 403 });

  async function read(ids: string[], answer: (id: string) => Response) {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => answer(url.split('/messages/')[1].split('?')[0])));
    const reading = readEmails('token', ids, () => undefined).catch((problem: unknown) => problem);
    await vi.runAllTimersAsync();
    const result = await reading;
    vi.useRealTimers();
    return result;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('waits and tries again when Google says to slow down', async () => {
    let tries = 0;
    const result = await read(['wait-1'], (id) => (tries++ < 2 ? slowDown() : Response.json(email(id))));
    expect(result).toMatchObject({ missed: [] });
    expect(tries).toBe(3);
  });

  it('keeps every other email when one will not load', async () => {
    const result = await read(['fine-1', 'stuck', 'fine-2'], (id) => (id === 'stuck' ? slowDown() : Response.json(email(id))));
    expect(result).toMatchObject({ missed: ['stuck'] });
    expect((result as { texts: string[] }).texts).toHaveLength(2);
  });

  it('does not read an email twice when trying again', async () => {
    let reads = 0;
    const answer = (id: string) => { reads += 1; return Response.json(email(id)); };
    await read(['once'], answer);
    await read(['once'], answer);
    expect(reads).toBe(1);
  });

  it('says so when nothing at all could be read', async () => {
    const result = await read(['none-1', 'none-2'], slowDown);
    expect(result).toBeInstanceOf(Error);
  });

  it('gives up straight away on something waiting will not fix', async () => {
    let tries = 0;
    await read(['denied'], () => { tries += 1; return new Response(JSON.stringify({ error: { errors: [{ reason: 'insufficientPermissions' }] } }), { status: 403 }); });
    expect(tries).toBe(1);
  });
});
