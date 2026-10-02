/** Allow local application paths, including their query string and fragment. */
export function getSafeReturnPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }
  // Browsers normalize backslashes and strip control characters in URLs.
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const base = 'https://serlo.invalid';
    return new URL(value, base).origin === base ? value : fallback;
  } catch {
    return fallback;
  }
}
