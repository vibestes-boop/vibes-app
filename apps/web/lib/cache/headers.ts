export interface PublicApiCacheOptions {
  browserMaxAge?: number;
  cdnMaxAge?: number;
  staleWhileRevalidate?: number;
}

export function publicApiCacheHeaders(options: PublicApiCacheOptions = {}): Record<string, string> {
  const {
    browserMaxAge = 0,
    cdnMaxAge = 30,
    staleWhileRevalidate = 120,
  } = options;
  const browserCache =
    browserMaxAge > 0
      ? `public, max-age=${browserMaxAge}, must-revalidate`
      : 'public, max-age=0, must-revalidate';
  const cdnCache =
    staleWhileRevalidate > 0
      ? `public, max-age=${cdnMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
      : `public, max-age=${cdnMaxAge}`;

  return {
    'Cache-Control': browserCache,
    'CDN-Cache-Control': cdnCache,
    'Vercel-CDN-Cache-Control': cdnCache,
  };
}

export function privateNoStoreHeaders(): Record<string, string> {
  return { 'Cache-Control': 'private, no-store' };
}

export function hasSupabaseAuthCookie(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? '';
  return /\bsb-[^=]+-auth-token=/.test(cookie) || cookie.includes('supabase-auth-token');
}
