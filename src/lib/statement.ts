// Reads bank and credit card CSV exports in the browser, so a statement never
// has to leave the device. Canadian banks each use their own layout, some with
// no header row at all, so columns are worked out from their contents.

export interface StatementRow {
  /** YYYY-MM-DD */
  date: string;
  description: string;
  /** Positive is money spent, negative is money received. */
  amount: number;
}

export class StatementError extends Error {}

const UNREADABLE = "I couldn't read that file. Try downloading transactions as a CSV from your bank.";

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const HEADER_WORDS = /date|amount|description|debit|credit|merchant|balance/i;
const DATE_HEADER = /date/i;
const DEBIT_HEADER = /debit|withdraw|money out|paid out/i;
const CREDIT_HEADER = /credit(?! card)|deposit|money in|paid in/i;
const AMOUNT_HEADER = /amount|cad/i;
const TEXT_HEADER = /desc|merchant|payee|name|memo|details/i;
const IGNORED_HEADER = /balance|usd|account|card|cheque|check|type/i;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^﻿/, '');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthFromName(name: string): number {
  return MONTH_NAMES.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

function parseDate(value: string, dayFirst: boolean): string | null {
  const text = value.trim();
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return isoDate(+match[1], +match[2], +match[3]);

  match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return isoDate(+match[1], +match[2], +match[3]);

  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (match) {
    return dayFirst ? isoDate(+match[3], +match[2], +match[1]) : isoDate(+match[3], +match[1], +match[2]);
  }

  match = text.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/);
  if (match) return isoDate(+match[3], monthFromName(match[1]), +match[2]);

  match = text.match(/^(\d{1,2}) ([A-Za-z]{3,9})\.?,? (\d{4})$/);
  if (match) return isoDate(+match[3], monthFromName(match[2]), +match[1]);

  return null;
}

/** Most Canadian banks write month first. A first number over 12 proves otherwise. */
function looksDayFirst(values: string[]): boolean {
  return values.some((value) => {
    const match = value.match(/^(\d{1,2})[-/](\d{1,2})[-/]\d{2,4}$/);
    return !!match && +match[1] > 12;
  });
}

function parseAmount(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || /^-|-$/.test(text.replace(/\s/g, ''));
  const digits = text.replace(/[()$,\s-]|CAD/gi, '');
  if (!/^\d+(\.\d+)?$/.test(digits)) return null;
  const number = Number(digits);
  return negative ? -number : number;
}

function share(rows: string[][], column: number, test: (value: string) => boolean): number {
  const filled = rows.filter((row) => (row[column] ?? '').length > 0);
  if (filled.length === 0) return 0;
  return filled.filter((row) => test(row[column])).length / rows.length;
}

function findDateColumn(rows: string[][], width: number, header: string[] | null): number {
  const named = header?.findIndex((name) => DATE_HEADER.test(name)) ?? -1;
  if (named >= 0) return named;
  for (let column = 0; column < width; column++) {
    if (share(rows, column, (value) => parseDate(value, false) !== null || parseDate(value, true) !== null) >= 0.8) return column;
  }
  return -1;
}

interface MoneyColumns {
  debit?: number;
  credit?: number;
  signed?: number;
}

function findMoneyColumns(rows: string[][], width: number, header: string[] | null, dateColumn: number): MoneyColumns | null {
  if (header) {
    const debit = header.findIndex((name) => DEBIT_HEADER.test(name));
    const credit = header.findIndex((name) => CREDIT_HEADER.test(name));
    if (debit >= 0 && credit >= 0 && debit !== credit) return { debit, credit };
    const signed = header.findIndex((name) => AMOUNT_HEADER.test(name) && !/usd/i.test(name));
    if (signed >= 0) return { signed };
  }

  const numeric: number[] = [];
  for (let column = 0; column < width; column++) {
    if (column !== dateColumn && share(rows, column, (value) => parseAmount(value) !== null) >= 0.3) numeric.push(column);
  }
  if (numeric.length === 0) return null;

  // Debit and credit columns take turns: a row fills one or the other, never both
  for (let i = 0; i < numeric.length - 1; i++) {
    const [debit, credit] = [numeric[i], numeric[i + 1]];
    const eitherOr = rows.every((row) => !(row[debit] && row[credit]));
    if (eitherOr) return { debit, credit };
  }
  return { signed: numeric[0] };
}

function findTextColumns(rows: string[][], width: number, header: string[] | null, taken: Set<number>): number[] {
  const named = (header ?? [])
    .map((name, column) => (TEXT_HEADER.test(name) && !IGNORED_HEADER.test(name) ? column : -1))
    .filter((column) => column >= 0 && !taken.has(column));
  if (named.length > 0) return named;

  let best = -1;
  let bestLetters = 0;
  for (let column = 0; column < width; column++) {
    if (taken.has(column)) continue;
    const letters = rows.reduce((sum, row) => sum + (row[column] ?? '').replace(/[^a-z]/gi, '').length, 0);
    if (letters > bestLetters) {
      best = column;
      bestLetters = letters;
    }
  }
  return best >= 0 ? [best] : [];
}

export function parseStatement(text: string): StatementRow[] {
  const allRows = parseCsv(text);
  if (allRows.length === 0) throw new StatementError(UNREADABLE);

  // Some banks put notes above the data, so go by the most common row width
  const widths = new Map<number, number>();
  for (const row of allRows) widths.set(row.length, (widths.get(row.length) ?? 0) + 1);
  const width = [...widths.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  if (width < 2) throw new StatementError(UNREADABLE);

  const rows = allRows.filter((row) => row.length >= width - 1 && row.length >= 2);
  const first = rows[0];
  const hasHeader = HEADER_WORDS.test(first.join(' '))
    && !first.some((cell) => parseDate(cell, false) !== null || parseAmount(cell) !== null);
  const header = hasHeader ? first : null;
  const data = hasHeader ? rows.slice(1) : rows;
  if (data.length === 0) throw new StatementError(UNREADABLE);

  const dateColumn = findDateColumn(data, width, header);
  if (dateColumn < 0) throw new StatementError(UNREADABLE);
  const money = findMoneyColumns(data, width, header, dateColumn);
  if (!money) throw new StatementError(UNREADABLE);

  const taken = new Set([dateColumn, money.debit, money.credit, money.signed].filter((column): column is number => column !== undefined));
  const textColumns = findTextColumns(data, width, header, taken);
  if (textColumns.length === 0) throw new StatementError(UNREADABLE);

  const dayFirst = looksDayFirst(data.map((row) => row[dateColumn] ?? ''));

  // Chequing exports show spending as negative. Credit card exports show it as positive.
  let flip = false;
  if (money.signed !== undefined) {
    const values = data.map((row) => parseAmount(row[money.signed!] ?? '')).filter((value): value is number => value !== null);
    flip = values.filter((value) => value < 0).length >= values.length / 2;
  }

  const statement: StatementRow[] = [];
  for (const row of data) {
    const date = parseDate(row[dateColumn] ?? '', dayFirst);
    if (!date) continue;

    let amount: number | null = null;
    if (money.signed !== undefined) {
      const value = parseAmount(row[money.signed] ?? '');
      amount = value === null ? null : flip ? -value : value;
    } else {
      const spent = parseAmount(row[money.debit!] ?? '');
      const received = parseAmount(row[money.credit!] ?? '');
      if (spent !== null && spent !== 0) amount = Math.abs(spent);
      else if (received !== null && received !== 0) amount = -Math.abs(received);
    }
    if (amount === null || amount === 0) continue;

    const description = textColumns.map((column) => row[column] ?? '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    statement.push({ date, description: description || 'Unknown', amount: Math.round(amount * 100) / 100 });
  }

  if (statement.length === 0) throw new StatementError(UNREADABLE);
  return statement.sort((a, b) => a.date.localeCompare(b.date));
}

/** Checks rows that came back from the agent before they reach the budget. */
export function cleanAgentRows(rows: unknown, today: string): StatementRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): StatementRow[] => {
    const { date, description, amount } = (row ?? {}) as Record<string, unknown>;
    if (typeof description !== 'string' || typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) return [];
    const text = description.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!text) return [];
    const iso = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
    return [{ date: iso, description: text, amount: Math.round(amount * 100) / 100 }];
  });
}
