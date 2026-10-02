import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySession } from './session';

export class UnauthorizedError extends Error {
  constructor(message = 'Not signed in') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Compare against BASIC_AUTH_USER / BASIC_AUTH_PASSWORD. If either is missing, accept any
 * credentials outside production and reject everything in production (plan 6.3).
 */
export function validateCredentials(username: string, password: string): boolean {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      console.error('BASIC_AUTH_USER / BASIC_AUTH_PASSWORD are not set; rejecting login');
      return false;
    }
    return true;
  }
  // Evaluate both comparisons so timing does not reveal which one failed.
  const userOk = safeEqual(username, user);
  const passOk = safeEqual(password, pass);
  return userOk && passOk;
}

/** Throws UnauthorizedError unless the request carries a valid session cookie. */
export async function requireSession(): Promise<void> {
  const store = await cookies();
  const ok = await verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  if (!ok) throw new UnauthorizedError();
}
