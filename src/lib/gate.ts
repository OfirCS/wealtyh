// While SITE_PASSWORD is set, the whole site sits behind one password. This file runs on
// the edge as well as on the server, so it can only use what's built into both.

export const GATE_COOKIE = 'pf_gate';

/** What the cookie holds: proof of the password, never the password. */
export async function gateProof(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`pathfinder-gate:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
