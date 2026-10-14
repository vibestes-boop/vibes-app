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
// RLS: Insert + Select nur für eigene Rows. Seit 14.10.2026 prüft die Datenbank
// den Antrag selbst (Trigger `payout_requests_guard`, Migration 20261014120000):
// Betrag ≤ Guthaben, Mindestbetrag, ein offener Antrag, euro_amount/status
// serverseitig; die Diamanten werden beim Antrag abgezogen (20261014120100).
// Die Prüfungen in `requestPayout` bleiben für klare Fehlermeldungen vorab.
//
// Guthaben-Quelle: RPC `get_creator_earnings` → `coins_wallets.diamonds`,
// derselbe Weg wie die App (`useCreatorEarnings`) und /studio/revenue.
// `profiles` hat KEINE Spalte `diamonds_balance`: bis 14.10.2026 las dieser
// Code dort, bekam 42703, verschluckte den Fehler und sah immer 0 Diamanten.
// -----------------------------------------------------------------------------

const MIN_PAYOUT = 2_500;
const RATE       = 0.02; // €/diamond

type CreatorEarningsRow = {
  diamonds_balance: number | string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Diamanten-Guthaben des Users. `null` = konnte nicht gelesen werden —
 *  nie still als 0 behandeln (Geld-Pfad). */
async function readDiamondsBalance(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_creator_earnings', {
    p_user_id: userId,
    p_days: 28,
  });
  if (error) return null;

  // Ohne Wallet-Zeile liefert die RPC trotzdem eine Zeile mit 0.
  const row = (Array.isArray(data) ? data[0] : null) as CreatorEarningsRow | null;
  const balance = Number(row?.diamonds_balance ?? 0);
  return Number.isFinite(balance) ? balance : null;
}

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

/** Liest nur das Diamanten-Guthaben — Server-Action-Wrapper damit Client Components
 *  nicht direkt lib/data/studio (= next/headers) importieren müssen.
 *  `null` = Guthaben konnte nicht gelesen werden (die Seite zeigt dann einen Hinweis). */
export async function getMyDiamondsBalance(): Promise<number | null> {
  const user = await getUser();
  if (!user) return 0;

  const supabase = await createClient();
  return readDiamondsBalance(supabase, user.id);
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
  const actualBalance = await readDiamondsBalance(supabase, user.id);
  if (actualBalance === null) {
    return { ok: false, error: 'Dein Guthaben konnte gerade nicht geprüft werden. Bitte versuche es später erneut.' };
  }
  if (actualBalance < MIN_PAYOUT) {
    return { ok: false, error: `Dein aktuelles Guthaben reicht nicht aus (${actualBalance.toLocaleString('de-DE')} 💎). Mindestens ${MIN_PAYOUT.toLocaleString('de-DE')} 💎 erforderlich.` };
  }

  // Prüfen ob eine ausstehende Anfrage existiert
  const { count: pendingCount, error: pendingError } = await supabase
    .from('payout_requests')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', user.id)
    .in('status', ['pending', 'processing']);

  // Fehler nicht als „keine offene Anfrage“ lesen — sonst entstehen Doppel-Anträge.
  if (pendingError || pendingCount === null) {
    return { ok: false, error: 'Offene Anfragen konnten gerade nicht geprüft werden. Bitte versuche es später erneut.' };
  }
  if (pendingCount > 0) {
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
