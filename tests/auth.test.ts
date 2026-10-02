import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

const cookieStore = { value: undefined as string | undefined };
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'auth-session' && cookieStore.value !== undefined ? { name, value: cookieStore.value } : undefined,
  }),
}));

import { signSession, verifySession, SESSION_MAX_AGE_SECONDS } from '@/lib/session';
import { requireSession, UnauthorizedError, validateCredentials } from '@/lib/auth';
import { safeRedirectPath } from '@/lib/redirect';
import { middleware } from '@/middleware';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as logoutPOST } from '@/app/api/auth/logout/route';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', SECRET);
  cookieStore.value = undefined;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('session tokens', () => {
  it('signs and verifies', async () => {
    const token = await signSession();
    expect(await verifySession(token)).toBe(true);
  });

  it('expires after 7 days', async () => {
    const issued = new Date('2025-03-01T00:00:00Z');
    const token = await signSession(issued);
    const justBefore = new Date(issued.getTime() + (SESSION_MAX_AGE_SECONDS - 60) * 1000);
    const after = new Date(issued.getTime() + (SESSION_MAX_AGE_SECONDS + 60) * 1000);
    expect(await verifySession(token, justBefore)).toBe(true);
    expect(await verifySession(token, after)).toBe(false);
  });

  it('rejects forged, tampered, unsigned and legacy tokens', async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('owner')
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode('another-secret-another-secret-another-secret'));
    expect(await verifySession(forged)).toBe(false);

    const token = await signSession();
    const [h, p, s] = token.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    const tampered = [h, Buffer.from(JSON.stringify({ ...payload, exp: payload.exp + 999999 })).toString('base64url'), s].join('.');
    expect(await verifySession(tampered)).toBe(false);

    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${p}.`;
    expect(await verifySession(none)).toBe(false);

    const legacy = Buffer.from(`${Date.now()}-abc123`).toString('base64');
    expect(await verifySession(legacy)).toBe(false);
    expect(await verifySession('')).toBe(false);
    expect(await verifySession(undefined)).toBe(false);
  });

  it('refuses to sign or verify without a strong secret', async () => {
    const token = await signSession();
    vi.stubEnv('SESSION_SECRET', 'short');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(signSession()).rejects.toThrow();
    expect(await verifySession(token)).toBe(false);
    spy.mockRestore();
  });
});

describe('validateCredentials', () => {
  it('compares against env vars', () => {
    vi.stubEnv('BASIC_AUTH_USER', 'admin');
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'pw');
    expect(validateCredentials('admin', 'pw')).toBe(true);
    expect(validateCredentials('admin', 'nope')).toBe(false);
    expect(validateCredentials('Admin', 'pw')).toBe(false);
    expect(validateCredentials('admin', 'pw ')).toBe(false);
  });

  it('accepts anything in development when env vars are missing', () => {
    vi.stubEnv('BASIC_AUTH_USER', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(validateCredentials('x', 'y')).toBe(true);
  });

  it('rejects everything in production when env vars are missing', () => {
    vi.stubEnv('BASIC_AUTH_USER', '');
    vi.stubEnv('NODE_ENV', 'production');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(validateCredentials('x', 'y')).toBe(false);
    spy.mockRestore();
  });
});

describe('requireSession', () => {
  it('throws without a valid cookie', async () => {
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
    cookieStore.value = 'garbage';
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('passes with a valid cookie', async () => {
    cookieStore.value = await signSession();
    await expect(requireSession()).resolves.toBeUndefined();
  });
});

describe('safeRedirectPath', () => {
  it('only allows same-origin paths', () => {
    expect(safeRedirectPath('/')).toBe('/');
    expect(safeRedirectPath('/reports?x=1')).toBe('/reports?x=1');
    expect(safeRedirectPath('//evil.com')).toBe('/');
    expect(safeRedirectPath('/\\evil.com')).toBe('/');
    expect(safeRedirectPath('https://evil.com')).toBe('/');
    expect(safeRedirectPath(null)).toBe('/');
  });
});

describe('middleware', () => {
  const req = (path: string, token?: string) =>
    new NextRequest(`http://localhost${path}`, {
      headers: token ? { cookie: `auth-session=${token}` } : {},
    });

  it('redirects pages to /login?from=', async () => {
    const res = await middleware(req('/'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login?from=%2F');
  });

  it('returns 401 JSON for non-auth API routes', async () => {
    const res = await middleware(req('/api/anything'));
    expect(res.status).toBe(401);
  });

  it('allows public paths', async () => {
    for (const p of ['/login', '/api/auth/login', '/api/auth/check', '/manifest.json', '/icons/x.png']) {
      const res = await middleware(req(p));
      expect(res.headers.get('x-middleware-next')).toBe('1');
    }
  });

  it('allows requests with a valid session and rejects forged ones', async () => {
    const ok = await middleware(req('/', await signSession()));
    expect(ok.headers.get('x-middleware-next')).toBe('1');
    const bad = await middleware(req('/', 'forged'));
    expect(bad.status).toBe(307);
  });
});

describe('auth route handlers', () => {
  const post = (body: unknown) =>
    new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });

  beforeEach(() => {
    vi.stubEnv('BASIC_AUTH_USER', 'admin');
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'pw');
  });

  it('login: 400 on missing fields, 401 on bad credentials', async () => {
    expect((await loginPOST(post({ username: 'admin' }))).status).toBe(400);
    const bad = await loginPOST(post({ username: 'admin', password: 'x' }));
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: 'Invalid username or password' });
  });

  it('login: sets a signed httpOnly cookie on success', async () => {
    const res = await loginPOST(post({ username: 'admin', password: 'pw' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const cookie = res.cookies.get('auth-session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
    expect(cookie?.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(await verifySession(cookie?.value)).toBe(true);
  });

  it('logout: clears the cookie', async () => {
    const res = await logoutPOST();
    expect(res.cookies.get('auth-session')?.maxAge).toBe(0);
    expect(await res.json()).toEqual({ success: true });
  });
});
