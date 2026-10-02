import 'server-only';
import { requireSession, UnauthorizedError } from '@/lib/auth';
import { NotFoundError, ValidationError } from '@/lib/repositories/errors';
import type { ActionResult } from '@/types/dto';

/**
 * Run a Server Action body: check the session first, then turn every error into an
 * ActionResult (migration 7.2). Never logs inputs or connection details.
 */
export async function runAction<T>(name: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    await requireSession();
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { ok: false, code: 'unauthorized', error: 'Your session has expired. Please sign in again.' };
    }
    if (error instanceof ValidationError) {
      return { ok: false, code: 'validation', error: error.message };
    }
    if (error instanceof NotFoundError) {
      return { ok: false, code: 'not_found', error: error.message };
    }
    const e = error as { name?: string; message?: string; code?: string };
    console.error(`[action ${name}] ${e?.name ?? 'Error'}${e?.code ? ` (${e.code})` : ''}: ${e?.message ?? ''}`);
    return { ok: false, code: 'server', error: 'Something went wrong while saving. Please try again.' };
  }
}

/** Throw a ValidationError when an argument fails its schema. */
export function check<T>(schema: { safeParse: (v: unknown) => { success: boolean } }, value: T, message: string): T {
  if (!schema.safeParse(value).success) throw new ValidationError(message);
  return value;
}
