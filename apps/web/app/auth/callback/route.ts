import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth Callback — handles both Magic-Link and OAuth (Google/Apple) return flows.
 *
 * Supabase redirects here with either:
 *   - `?code=...` → exchangeable for a session (PKCE flow used by @supabase/ssr)
 *   - `?error=...&error_description=...` → OAuth rejection / user cancel
 *
 * The `?next=...` param (URL-encoded) tells us where to land after success.
 * Defaults to `/` if not provided.
 *
 * Post-auth routing:
 *   - User has profile row with username → redirect to `next`
 *   - User authenticated but no profile / missing username → redirect to `/onboarding`
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/';

  // OAuth/Magic-Link failure from the provider — bounce back to /login with a message.
  if (errorParam) {
    const msg = errorDescription ?? errorParam;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Fehlender Auth-Code.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Check profile state — onboarding needed?
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Session konnte nicht erstellt werden.')}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.username) {
    // First login or incomplete profile — send through onboarding.
    // Preserve `next` so we can return there once onboarding completes.
    return NextResponse.redirect(
      `${origin}/onboarding?next=${encodeURIComponent(next)}`,
    );
  }

  // Defense against open-redirect: only allow same-origin relative `next`.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
