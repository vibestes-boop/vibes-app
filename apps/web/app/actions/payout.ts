'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';
import type { ActionResult } from './profile';

// -----------------------------------------------------------------------------
// payout.ts — v1.w.UI.157
//
// Parität zu mobile `app/creator/payout-request.tsx`.
//
// Konstanten:
//   MIN_PAYOUT  = 2 500 Diamanten  (≈ 50 € netto)
//   RATE        = 0.02             (1 Diamant = 2 Cent)
//
// Tabelle: `payout_requests`
//   creator_id, diamonds_amount, euro_amount, iban, paypal_email, note, status
// RLS: Insert + Select nur für eigene Rows.
// -----------------------------------------------------------------------------

const MIN_PAYOUT = 2_500;
const RATE       = 0.02; // €/diamond

type DiamondsProfileRow = {
  diamonds_balance: number | string | null;
};

export interface PayoutRequest {
  id:           string;
  diamonds_amount: number;
  euro_amount:  number;
  iban:         string | null;
  paypal_email: string | null;
  note:         string | null;
  status:       'pending' | 'processing' | 'paid' | 'rejected';
  admin_note:   string | null;
  created_at:   string;
  processed_at: string | null;
}

/** Liest nur den diamonds_balance — Server-Action-Wrapper damit Client Components
 *  nicht direkt lib/data/studio (= next/headers) importieren müssen. */
export async function getMyDiamondsBalance(): Promise<number> {
  const user = await getUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('diamonds_balance')
    .eq('id', user.id)
    .maybeSingle();

  return Number((data as DiamondsProfileRow | null)?.diamonds_balance ?? 0);
}

export async function getMyPayoutRequests(): Promise<PayoutRequest[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('payout_requests')
    .select('id, diamonds_amount, euro_amount, iban, paypal_email, note, status, admin_note, created_at, processed_at')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []) as PayoutRequest[];
}

export async function requestPayout(formData: FormData): Promise<ActionResult<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Bitte einloggen.' };

  const method      = formData.get('method') as 'iban' | 'paypal' | null;
  const iban        = (formData.get('iban') as string | null)?.trim().toUpperCase() || null;
  const paypalEmail = (formData.get('paypal_email') as string | null)?.trim() || null;
  const note        = (formData.get('note') as string | null)?.trim() || null;
  const balanceStr  = formData.get('balance') as string | null;
  const balance     = Number(balanceStr ?? 0);

  // Validierung
  if (!method || (method !== 'iban' && method !== 'paypal')) {
    return { ok: false, error: 'Bitte wähle eine Auszahlungsmethode.', field: 'method' };
  }
  if (method === 'iban' && !iban) {
    return { ok: false, error: 'Bitte gib deine IBAN ein.', field: 'iban' };
  }
  if (method === 'paypal' && !paypalEmail) {
    return { ok: false, error: 'Bitte gib deine PayPal-E-Mail ein.', field: 'paypal_email' };
  }
  if (balance < MIN_PAYOUT) {
    return { ok: false, error: `Mindestbetrag für Auszahlung: ${MIN_PAYOUT.toLocaleString('de-DE')} 💎 (≈ ${(MIN_PAYOUT * RATE).toFixed(2)} €).` };
  }

  // Sicherheits-Revalidierung: prüfe ob der User tatsächlich diesen Balance hat
  const supabase = await createClient();
  const { data: profileData } = await supabase
    .from('profiles')
    .select('diamonds_balance')
    .eq('id', user.id)
    .maybeSingle();

  const actualBalance = Number((profileData as DiamondsProfileRow | null)?.diamonds_balance ?? 0);
  if (actualBalance < MIN_PAYOUT) {
    return { ok: false, error: `Dein aktuelles Guthaben reicht nicht aus (${actualBalance.toLocaleString('de-DE')} 💎). Mindestens ${MIN_PAYOUT.toLocaleString('de-DE')} 💎 erforderlich.` };
  }

  // Prüfen ob eine ausstehende Anfrage existiert
  const { count: pendingCount } = await supabase
    .from('payout_requests')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', user.id)
    .in('status', ['pending', 'processing']);

  if ((pendingCount ?? 0) > 0) {
    return { ok: false, error: 'Du hast bereits eine offene Auszahlungsanfrage. Warte bis diese bearbeitet wurde.' };
  }

  const { error } = await supabase.from('payout_requests').insert({
    creator_id:      user.id,
    diamonds_amount: actualBalance,
    euro_amount:     parseFloat((actualBalance * RATE).toFixed(2)),
    iban:            method === 'iban'   ? iban   : null,
    paypal_email:    method === 'paypal' ? paypalEmail : null,
    note,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/studio/revenue/payout');
  revalidatePath('/studio/revenue');
  return { ok: true, data: null };
}
