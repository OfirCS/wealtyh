// A made-up family's chequing account, so anyone can try the budget before
// downloading their own statement. Dates follow the calendar so it always looks current.

type Entry = [day: number, description: string, amount: number];

const EVERY_MONTH: Entry[] = [
  [1, 'RENT PAYMENT - MAPLE PROPERTIES', -2300],
  [2, 'BRIGHT PATH DAYCARE', -640],
  [3, 'ROGERS WIRELESS', -118.5],
  [4, 'TORONTO HYDRO', -94],
  [5, 'NETFLIX.COM', -18.99],
  [7, 'PAYROLL DEPOSIT - ACME INC', 2850],
  [7, 'PAYROLL DEPOSIT - LAKESIDE HEALTH', 2240],
  [8, 'E-TRANSFER SENT - SAVINGS', -400],
  [9, 'PRESTO FARE RELOAD', -80],
  [21, 'PAYROLL DEPOSIT - ACME INC', 2850],
  [21, 'PAYROLL DEPOSIT - LAKESIDE HEALTH', 2240],
  [22, 'GOODLIFE FITNESS', -49.99],
  [24, 'SQ *MAPLE CORNER BAKERY', -23.4],
];

const FIRST_MONTH: Entry[] = [
  [3, 'LOBLAWS #1032', -214.67],
  [6, 'COSTCO WHOLESALE', -318.12],
  [10, 'NO FRILLS #3321', -96.41],
  [11, 'TIM HORTONS #2241', -14.2],
  [12, 'UBER EATS TORONTO', -46.85],
  [14, 'SHELL C04412', -71.3],
  [16, 'AMAZON.CA ORDER', -58.99],
  [17, 'SHOPPERS DRUG MART', -32.15],
  [18, 'LOBLAWS #1032', -188.2],
  [20, 'CINEPLEX ODEON', -44],
  [25, 'PIZZA NOVA', -39.5],
  [26, 'PP*LITTLE STEPS SHOES', -68],
  [27, 'METRO #552', -142.77],
];

const SECOND_MONTH: Entry[] = [
  [2, 'COSTCO WHOLESALE', -291.03],
  [6, 'LOBLAWS #1032', -176.9],
  [8, 'STARBUCKS #4410', -11.75],
  [11, 'UBER EATS TORONTO', -52.1],
  [13, 'ESSO 77123', -68.42],
  [15, 'CANADIAN TIRE #188', -124.6],
  [16, 'NO FRILLS #3321', -103.25],
  [19, 'PP*LITTLE STEPS SHOES', -41],
  [20, 'REXALL PHARMACY', -27.8],
  [23, 'METRO #552', -151.34],
  [25, 'TICKETMASTER CANADA', -96],
  [27, 'WINNERS #220', -62.5],
];

function monthRows(year: number, month: number, entries: Entry[]): string[] {
  return [...EVERY_MONTH, ...entries].map(([day, description, amount]) => {
    const date = new Date(year, month, day);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return `${iso},"${description}",${amount.toFixed(2)}`;
  });
}

/** The last two full calendar months before `today`, as a CSV. */
export function sampleStatement(today: Date): string {
  const year = today.getFullYear();
  const month = today.getMonth();
  return [
    'Date,Description,Amount',
    ...monthRows(year, month - 2, FIRST_MONTH),
    ...monthRows(year, month - 1, SECOND_MONTH),
  ].join('\n');
}
