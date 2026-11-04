export interface Session {
  name: string;
  email: string;
  /** A demo account uses a made-up family, so nothing real is read. */
  kind: 'google' | 'demo';
}

const STORAGE_KEY = 'pathfinder.session.v1';

export const DEMO_SESSION: Session = { name: 'Alex', email: 'demo@pathfinder', kind: 'demo' };

export function loadSession(): Session | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures (private mode/quota)
  }
}

/** Everything lives in this browser, so signing out clears it all. */
export function clearEverything(): void {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('pathfinder.') && !key.startsWith('pathfinder.sound'))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage failures (private mode/quota)
  }
}
