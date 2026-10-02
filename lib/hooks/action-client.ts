'use client';

import { toast } from 'sonner';
import type { ActionResult } from '@/types/dto';

const NETWORK_ERROR: ActionResult<never> = {
  ok: false,
  code: 'server',
  error: 'Could not reach the server. Check your connection and try again.',
};

/** Await a Server Action; network failures become an ActionResult instead of throwing. */
export async function callAction<T>(promise: Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await promise;
  } catch (error) {
    console.error('Server Action failed:', error);
    return NETWORK_ERROR;
  }
}

/** Redirect on `unauthorized`, otherwise show an error toast (unless silent). */
export function handleFailure(result: ActionResult<unknown>, options: { silent?: boolean } = {}): void {
  if (result.ok) return;
  if (result.code === 'unauthorized') {
    window.location.href = '/login';
    return;
  }
  if (!options.silent) toast.error(result.error);
}
