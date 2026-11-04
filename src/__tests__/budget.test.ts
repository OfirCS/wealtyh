import { describe, expect, it } from 'vitest';
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
import { emailToText } from '@/lib/gmail';
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
});
