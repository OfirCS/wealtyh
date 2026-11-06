// A made-up family's chequing account, so anyone can see the whole product with
// nothing connected. Dates follow the calendar, so "this month" is always the real one.

type Entry = [day: number, description: string, amount: number];

const EVERY_MONTH: Entry[] = [
  [1, 'RENT PAYMENT - MAPLE PROPERTIES', -2300],
  [2, 'BRIGHT PATH DAYCARE', -640],
  [3, 'ROGERS WIRELESS', -118.5],
  [4, 'TORONTO HYDRO', -94],
  [7, 'PAYROLL DEPOSIT - ACME INC', 2850],
  [7, 'PAYROLL DEPOSIT - LAKESIDE HEALTH', 2240],
  [8, 'E-TRANSFER SENT - SAVINGS', -400],
  [9, 'PRESTO FARE RELOAD', -80],
  [21, 'PAYROLL DEPOSIT - ACME INC', 2850],
  [21, 'PAYROLL DEPOSIT - LAKESIDE HEALTH', 2240],
  [22, 'GOODLIFE FITNESS', -49.99],
];

const FIRST_MONTH: Entry[] = [
  [5, 'NETFLIX.COM', -16.49],
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
  [24, 'SQ *MAPLE CORNER BAKERY', -23.4],
];

const SECOND_MONTH: Entry[] = [
  [5, 'NETFLIX.COM', -18.99],
  [23, 'GOODLIFE FITNESS', -49.99],
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
  [12, 'SQ *MAPLE CORNER BAKERY', -17.85],
];

// This month so far. Only what has already happened by today is included.
const THIS_MONTH: Entry[] = [
  [1, 'IKEA ETOBICOKE', -389],
  [1, 'LOBLAWS #1032', -96.2],
  [2, 'TIM HORTONS #2241', -9.85],
  [3, 'ESSO 77123', -64.1],
  [4, 'COSTCO WHOLESALE', -274.18],
  [5, 'NETFLIX.COM', -18.99],
  [6, 'UBER EATS TORONTO', -38.4],
  [8, 'NO FRILLS #3321', -88.15],
  [10, 'SHOPPERS DRUG MART', -24.3],
  [12, 'METRO #552', -131.66],
  [14, 'CINEPLEX ODEON', -39],
  [16, 'AMAZON.CA ORDER', -72.49],
  [18, 'SHELL C04412', -70.05],
  [20, 'LOBLAWS #1032', -167.3],
  [23, 'PIZZA NOVA', -41.75],
];

function monthRows(year: number, month: number, entries: Entry[], lastDay = 31): string[] {
  return [...EVERY_MONTH, ...entries].filter(([day]) => day <= lastDay).map(([day, description, amount]) => {
    const date = new Date(year, month, day);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return `${iso},"${description}",${amount.toFixed(2)}`;
  });
}

/** Two full months and this month so far, as a CSV. */
export function sampleStatement(today: Date): string {
  const year = today.getFullYear();
  const month = today.getMonth();
  return [
    'Date,Description,Amount',
    ...monthRows(year, month - 2, FIRST_MONTH),
    ...monthRows(year, month - 1, SECOND_MONTH),
    ...monthRows(year, month, THIS_MONTH, today.getDate()),
  ].join('\n');
}
