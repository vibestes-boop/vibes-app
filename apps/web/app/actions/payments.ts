'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Payment-Server-Actions
//
//   - startCheckout(tierId) → invoked Edge-Function `create-checkout-session`,
//     gibt { url } zurück damit der Client nach `router.push(url)` nach Stripe
//     redirected. Die Edge-Function kennt den Caller (JWT) und die Tier-ID +
//     legt die Order-Row selbst an.
//
//   - sendCreatorTip(recipientId, coinAmount, message) → delegiert an DB-RPC
//     `send_creator_tip`, die atomar Balance prüft + Coins abzieht + Diamanten
//     gutschreibt + Tip-Row anlegt.
//
//   - simulatePendingClose(orderId) → User-Initiierter "Order abbrechen" Button
//     auf der Billing-Seite. Setzt pending-Orders nach >15min auf `cancelled`
//     damit sie nicht mehr als offene Transaktion sichtbar sind. Stripe holt
//     bei tatsächlicher Bezahlung über den Webhook den Status sauber zurück.
// -----------------------------------------------------------------------------

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function getViewerId(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

// ─── startCheckout ──────────────────────────────────────────────────────────

export interface CheckoutResult {
  url: string;
  orderId: string;
  sessionId: string;
}

const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: 'Bitte einloggen.',
  invalid_tier_id: 'Ungültiges Coin-Paket.',
  tier_not_found: 'Coin-Paket nicht verfügbar.',
  too_many_pending_orders:
    'Zu viele offene Bestellungen. Bitte warte kurz oder brich eine offene Order ab.',
  server_misconfigured: 'Server nicht konfiguriert. Bitte später erneut.',
  stripe_not_configured: 'Zahlungen vorübergehend nicht verfügbar.',
  stripe_session_create_failed: 'Stripe-Checkout konnte nicht gestartet werden.',
  order_create_failed: 'Bestellung konnte nicht angelegt werden.',
};

export async function startCheckout(
  tierId: string,
): Promise<ActionResult<CheckoutResult>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!tierId || typeof tierId !== 'string') {
    return { ok: false, error: 'Ungültiges Coin-Paket.' };
  }

  const supabase = await createClient();

  // Wir invoken die Edge-Function via Supabase-Client — dabei wird der JWT
  // automatisch mitgesendet. Die Function wiederum authentifiziert via diesem
  // JWT und legt die Order an.
  const { data, error } = await supabase.functions.invoke<{
    url?: string;
    order_id?: string;
    session_id?: string;
    error?: string;
  }>('create-checkout-session', {
    body: { tier_id: tierId },
  });

  if (error) {
    return { ok: false, error: error.message ?? 'Checkout konnte nicht gestartet werden.' };
  }
  if (!data || data.error) {
    const msg = data?.error
      ? CHECKOUT_ERROR_MESSAGES[data.error] ?? data.error
      : 'Checkout konnte nicht gestartet werden.';
    return { ok: false, error: msg };
  }
  if (!data.url || !data.order_id || !data.session_id) {
    return { ok: false, error: 'Unvollständige Antwort vom Zahlungs-Server.' };
  }

  return {
    ok: true,
    data: {
      url: data.url,
      orderId: data.order_id,
      sessionId: data.session_id,
    },
  };
}

// ─── sendCreatorTip ─────────────────────────────────────────────────────────

export interface TipResult {
  tipId: string;
}

const TIP_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: 'Bitte einloggen.',
  cannot_tip_self: 'Du kannst dich nicht selbst unterstützen.',
  invalid_amount: 'Ungültiger Coin-Betrag.',
  message_too_long: 'Nachricht zu lang (max 140 Zeichen).',
  insufficient_coins: 'Nicht genug Coins. Lade dein Guthaben auf.',
};

export async function sendCreatorTip(
  recipientId: string,
  coinAmount: number,
  message: string | null = null,
): Promise<ActionResult<TipResult>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!recipientId || typeof recipientId !== 'string') {
    return { ok: false, error: 'Empfänger fehlt.' };
  }
  if (recipientId === viewer.id) {
    return { ok: false, error: 'Du kannst dich nicht selbst unterstützen.' };
  }
  if (!Number.isInteger(coinAmount) || coinAmount < 1 || coinAmount > 100000) {
    return { ok: false, error: 'Coin-Betrag muss zwischen 1 und 100 000 liegen.' };
  }
  const normalizedMsg =
    message && message.trim().length > 0 ? message.trim().slice(0, 140) : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('send_creator_tip', {
    p_recipient_id: recipientId,
    p_coin_amount: coinAmount,
    p_message: normalizedMsg,
  });

  if (error) {
    const code = error.message.match(/\b([a-z_]+)\b/)?.[1] ?? '';
    const msg = TIP_ERROR_MESSAGES[code] ?? error.message;
    return { ok: false, error: msg };
  }
  if (!data || typeof data !== 'string') {
    return { ok: false, error: 'Tip konnte nicht gesendet werden.' };
  }

  // Profil-Seite des Empfängers neu validieren (Supporter-Wall ändert sich),
  // sowie Billing-Seite (Coin-Balance ändert sich).
  //
  // NB: Das Profil wird unter /u/[username] gecached, nicht unter /u/[uuid] —
  // ein früher Fehler hat `recipientId` (UUID) direkt reingereicht, was im
  // Cache nie einen Treffer hatte. Wir holen den Username jetzt via
  // zusätzlichem SELECT und invalidieren den korrekten Pfad. Cache-Key bleibt
  // 60s-ISR ansonsten unberührt.
  const { data: recipientProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', recipientId)
    .maybeSingle();
  if (recipientProfile?.username) {
    revalidatePath(`/u/${recipientProfile.username}`);
  }
  revalidatePath('/settings/billing');
  return { ok: true, data: { tipId: data } };
}

// ─── cancelPendingOrder ─────────────────────────────────────────────────────

/**
 * User-Initiierter Abbruch einer noch-nicht-bezahlten Order.
 * Setzt `pending` → `cancelled`. Falls der User danach doch noch bei Stripe
 * bezahlt, greift der Webhook trotzdem (`checkout.session.completed`) und
 * kann die Order wieder auf `paid` setzen — die Race ist absichtlich.
 */
export async function cancelPendingOrder(
  orderId: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!orderId) return { ok: false, error: 'Order-ID fehlt.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('web_coin_orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('user_id', viewer.id)
    .eq('status', 'pending');

  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/billing');
  return { ok: true, data: null };
}
