// Edge-safe session token helpers (used by middleware, route handlers and requireSession).
import { jwtVerify, SignJWT } from 'jose';

export const SESSION_COOKIE_NAME = 'auth-session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
const SUBJECT = 'owner';

function getSecret(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return new TextEncoder().encode(secret);
}

/** Sign a new session JWT (HS256, exp = now + 7 days). Throws if SESSION_SECRET is missing or short. */
export async function signSession(now: Date = new Date()): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    throw new Error(`SESSION_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters`);
  }
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(SUBJECT)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_SECONDS)
    .sign(secret);
}

/** True only for a token signed with SESSION_SECRET that has not expired. */
export async function verifySession(
  token: string | null | undefined,
  now: Date = new Date(),
): Promise<boolean> {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) {
    console.error('SESSION_SECRET is missing or too short; rejecting all sessions');
    return false;
  }
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      subject: SUBJECT,
      currentDate: now,
    });
    return typeof payload.exp === 'number';
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
