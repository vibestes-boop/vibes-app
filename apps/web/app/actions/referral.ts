'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// #5 Referral-Loop — Attribution per Server-Action, ohne den Auth-/Onboarding-
// Flow anzufassen. Idempotent (RPC setzt referred_by nur einmal).
//
// REF_COOKIE hält den Werber-Code (Username), bis der Eingeladene eingeloggt ist
// — dann greift claimPendingReferral() (aus dem App-Shell aufgerufen).

const REF_COOKIE = 'serlo_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

type ClaimResult = { ok: boolean; pending?: boolean; already?: boolean };

async function tryClaim(code: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
  if (error) return false;
  const res = (data ?? {}) as { success?: boolean };
  return res.success === true;
}

// Vom Invite-Landing (/i/[code]) aufgerufen: ist der Besucher eingeloggt, sofort
// attribuieren; sonst den Code als Cookie merken (Claim nach Signup/Login).
export async function claimReferral(code: string): Promise<ClaimResult> {
  const clean = (code ?? '').trim();
  if (!clean) return { ok: false };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const store = await cookies();

  if (user) {
    const ok = await tryClaim(clean);
    if (ok) store.delete(REF_COOKIE);
    return { ok };
  }

  store.set(REF_COOKIE, clean, { maxAge: REF_MAX_AGE, path: '/', sameSite: 'lax' });
  return { ok: true, pending: true };
}

// Aus dem App-Shell (für jeden eingeloggten User) aufgerufen: liegt ein
// Referral-Cookie vor und ist der User noch nicht attribuiert, jetzt setzen.
export async function claimPendingReferral(): Promise<ClaimResult> {
  const store = await cookies();
  const code = store.get(REF_COOKIE)?.value;
  if (!code) return { ok: false };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, pending: true };

  const ok = await tryClaim(code);
  if (ok) store.delete(REF_COOKIE);
  return { ok };
}
