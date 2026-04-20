'use server';

import { z } from 'zod';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { usernameSchema } from '@shared/schemas';

// -----------------------------------------------------------------------------
// Action result type — consistent shape for all form-returning server actions.
// -----------------------------------------------------------------------------

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; field?: string };

// -----------------------------------------------------------------------------
// Magic-Link — sends a 6-digit OTP + magic-link to email.
// -----------------------------------------------------------------------------

const magicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email('Bitte eine gültige Email eingeben.'),
});

async function getOrigin(): Promise<string> {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (envOrigin) return envOrigin;

  // Fallback: derive from request headers (dev + Vercel preview)
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

export async function signInWithMagicLink(formData: FormData): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Email.', field: 'email' };
  }

  const origin = await getOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // After clicking the link, Supabase redirects here with ?code=... which
      // our /auth/callback route exchanges for a session.
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/')}`,
      // Create the user if they don't exist yet — magic-link doubles as signup.
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, message: 'Check deine Emails — wir haben dir einen Anmelde-Link geschickt.' };
}

// -----------------------------------------------------------------------------
// OAuth — Google / Apple. Kicks off the 3-legged flow.
// -----------------------------------------------------------------------------

export async function signInWithOAuth(provider: 'google' | 'apple', next = '/'): Promise<never> {
  const origin = await getOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data?.url) {
    // Fall back to login page with error param — the server action contract
    // requires `never` return (we redirect), so we throw-redirect here.
    redirect(`/login?error=${encodeURIComponent(error?.message ?? 'OAuth-Start fehlgeschlagen')}`);
  }

  // data.url ist eine externe OAuth-Provider-URL (accounts.google.com/…),
  // kein interner Route. typedRoutes erzwingt `Route` als Parameter-Typ —
  // der Cast ist eine bewusste Type-Lüge (runtime-safe, weil redirect() jeden
  // String akzeptiert).
  redirect(data.url as Route);
}

// -----------------------------------------------------------------------------
// Logout.
// -----------------------------------------------------------------------------

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

// -----------------------------------------------------------------------------
// Username claim — first-login onboarding step. Creates or updates `profiles`.
// -----------------------------------------------------------------------------

export async function claimUsername(formData: FormData): Promise<ActionResult> {
  const parsed = usernameSchema.safeParse(formData.get('username'));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültiger Username.', field: 'username' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Nicht eingeloggt.' };
  }

  // Re-check availability server-side (guards against TOCTOU between pre-check and submit).
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', parsed.data)
    .maybeSingle();

  if (existing && existing.id !== user.id) {
    return { ok: false, error: 'Username bereits vergeben.', field: 'username' };
  }

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        username: parsed.data,
        // Keep display_name in sync on first set; user can change later in settings.
        display_name: parsed.data,
      },
      { onConflict: 'id' },
    );

  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Username availability — cheap pre-check for live UI feedback.
// Not authoritative — `claimUsername` re-checks at submit time.
// -----------------------------------------------------------------------------

export async function checkUsernameAvailable(raw: string): Promise<{ available: boolean; reason?: string }> {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return { available: false, reason: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', parsed.data)
    .maybeSingle();

  // Own username during re-pick is "available to keep".
  if (data && user && data.id === user.id) return { available: true };
  if (data) return { available: false, reason: 'Bereits vergeben.' };
  return { available: true };
}
