import { cookies } from 'next/headers';

// Supabase SSR stores browser sessions in sb-<project-ref>-auth-token cookies
// (sometimes chunked as .0/.1). Presence is not an authorization decision; it
// only lets public RSC routes skip an unnecessary auth network roundtrip for
// clearly anonymous requests. Real auth gates still call getUser().
export async function hasSupabaseAuthCookie(): Promise<boolean> {
  const store = await cookies();
  return store.getAll().some(({ name, value }) => {
    if (!value) return false;
    return name.startsWith('sb-') && name.includes('-auth-token');
  });
}
