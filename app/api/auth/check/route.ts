import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/session';

export async function GET() {
  try {
    const store = await cookies();
    const authenticated = await verifySession(store.get(SESSION_COOKIE_NAME)?.value);
    return NextResponse.json({ authenticated });
  } catch (error) {
    console.error('Session check error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ authenticated: false });
  }
}
