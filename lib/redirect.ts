/** Return `from` only when it is a same-origin path ('/x', not '//x' or '/\x'). */
export function safeRedirectPath(from: string | null | undefined, fallback = '/'): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) {
    return fallback;
  }
  return from;
}
