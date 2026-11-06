// Banks, receipts and Wallet all spell a store differently. "AMZN MKTP CA*ZX12A", "Amazon.ca"
// and "Amazon" are one store, while "UBER *EATS" and "UBER *TRIP" are not.

export type SameMerchant = 'yes' | 'no' | 'unknown';

const ALIASES: [RegExp, string][] = [
  [/\bAMZN\b|\bAMZ\b|\bAMAZON(?:\.[A-Z]+)?/g, 'AMAZON'],
  [/\bUBEREATS\b/g, 'UBER EATS'],
  [/\bUBERTRIP\b/g, 'UBER TRIP'],
  [/\bTIMS\b|\bTIM HORTON\b/g, 'TIM HORTONS'],
  [/\bMC ?DONALD\b/g, 'MCDONALDS'],
  [/\bLCBO\b.*/g, 'LCBO'],
];

/** Card processors write their own initials ahead of the real name. */
const PROCESSOR = /^(?:SQ|SQUARE|TST|TOAST|SP|PP|PAYPAL|IC|DD|CKE|ZTL|FS|PY|GOOGLE|GOOG)\s*\*\s*/;

const NOISE = new Set(['THE', 'OF', 'AND', 'INC', 'LTD', 'LLC', 'CORP', 'CO', 'COMPANY', 'STORE', 'STORES', 'WWW', 'COM', 'ORDER', 'YOUR', 'RECEIPT', 'FROM', 'MKTP', 'MKTPLACE', 'MARKETPLACE']);

/** Only ever removed from the end, so "Canada Post" stays whole. */
const PLACES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT', 'CA', 'CAN', 'CANADA',
  'TORONTO', 'MONTREAL', 'VANCOUVER', 'OTTAWA', 'CALGARY', 'EDMONTON', 'WINNIPEG', 'HALIFAX', 'MISSISSAUGA', 'BRAMPTON',
  'HAMILTON', 'MARKHAM', 'VAUGHAN', 'THORNHILL', 'OAKVILLE', 'BURLINGTON', 'NORTH', 'YORK', 'SCARBOROUGH', 'ETOBICOKE',
]);

/** Words a bank uses when it isn't saying where the money went. */
const VAGUE = new Set(['POS', 'FPOS', 'IDP', 'POINT', 'SALE', 'PURCHASE', 'INTERAC', 'RETAIL', 'DEBIT', 'CREDIT', 'VISA', 'MASTERCARD', 'MC', 'CARD', 'PAYMENT', 'BILL', 'CONTACTLESS', 'TAP', 'TRANSACTION', 'WITHDRAWAL', 'MISC', 'MEMO', 'ONLINE', 'WEB']);

/** They take money for other stores, so their name says little. */
const MIDDLEMEN = new Set(['PAYPAL', 'STRIPE', 'SQUARE', 'SHOPIFY', 'INSTACART', 'KLARNA', 'AFTERPAY', 'MONERIS', 'APPLE', 'GOOGLE']);

/** Brands where the second word is a different business. */
const FAMILIES: Record<string, Set<string>> = {
  UBER: new Set(['EATS', 'TRIP']),
  APPLE: new Set(['MUSIC', 'TV', 'ONE', 'ARCADE', 'ICLOUD', 'CARE']),
  GOOGLE: new Set(['ONE', 'PLAY', 'CLOUD', 'WORKSPACE', 'YOUTUBE']),
};

const E_TRANSFER = /E-?\s?TRANSFER|ETFR|EMAIL MONEY|\bINTERAC E\b/i;

/** Below this a shared first word could be chance, like "Tim" in two names. */
const BRAND_LENGTH = 5;

function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/['’`]/g, '');
}

export function merchantWords(name: string): string[] {
  let text = plain(name).trim();
  for (const [pattern, brand] of ALIASES) text = text.replace(pattern, brand);
  text = text.replace(PROCESSOR, '').replace(/([A-Z])-([A-Z])/g, '$1$2');
  const words = text.split(/[^A-Z0-9]+/).filter((word) => word && !/\d/.test(word) && !NOISE.has(word));
  while (words.length > 1 && PLACES.has(words[words.length - 1])) words.pop();
  return words;
}

function isVague(words: string[]): boolean {
  return words.every((word) => VAGUE.has(word));
}

/** How many words of the shorter list appear in the longer one, counting repeats. */
function shared(short: string[], long: string[]): number {
  const rest = [...long];
  return short.filter((word) => {
    const index = rest.indexOf(word);
    if (index >= 0) rest.splice(index, 1);
    return index >= 0;
  }).length;
}

function clash(left: string[], right: string[]): boolean {
  const family = FAMILIES[left[0]];
  return Boolean(family?.has(left[1]) && family.has(right[1]) && left[1] !== right[1]);
}

function sameWordBegins(word: string, others: string[]): boolean {
  return word.length >= BRAND_LENGTH && others.some((other) => other.length >= BRAND_LENGTH && (other.startsWith(word) || word.startsWith(other)));
}

export function sameMerchant(a: string, b: string): SameMerchant {
  if (E_TRANSFER.test(a) && E_TRANSFER.test(b)) return 'yes';
  const left = merchantWords(a);
  const right = merchantWords(b);
  if (isVague(left) || isVague(right)) return 'unknown';

  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  const common = shared(short, long);
  if (common === short.length) return 'yes';
  if (short.length === 1 && sameWordBegins(short[0], long)) return 'yes';
  if (common >= 2) return 'yes';
  if (short[0] === long[0]) {
    if (clash(short, long)) return 'no';
    return short[0].length >= BRAND_LENGTH ? 'yes' : 'unknown';
  }
  if (common === 1 || [...left, ...right].some((word) => MIDDLEMEN.has(word))) return 'unknown';
  return 'no';
}

function titleCase(word: string): string {
  return word.length <= 3 && !/[AEIOUY]/.test(word) ? word : word[0] + word.slice(1).toLowerCase();
}

/** "TIM HORTONS #4410 TORONTO ON" becomes "Tim Hortons". */
export function displayName(name: string): string {
  const words = merchantWords(name);
  return !words.length || isVague(words) ? name.trim() : words.map(titleCase).join(' ');
}
