/**
 * supabase/functions/berkat-confirm-payment/index.ts
 *
 * Berkat fragt bei Stripe nach: „Ist das bezahlt?"
 *
 * ── WARUM ES DIESE FUNKTION GIBT ────────────────────────────────────────────
 *
 * Seit Verkäufer ihr eigenes Stripe verbinden, entsteht die Zahlung auf IHREM
 * Konto. Stripe meldet das nur an einen eigenen **Connect-Endpunkt** — und
 * solange der nicht eingerichtet ist, erfährt Berkat gar nichts: Das Geld liegt
 * beim Verkäufer, die Bestellung steht weiter auf `payment_requested`, und nach
 * 48 Stunden darf der Verkäufer den Käufer als Nichtzahler melden. Für jemanden,
 * der bezahlt hat.
 *
 * Diese Funktion dreht die Richtung um: Statt zu warten, dass Stripe anruft,
 * ruft Berkat an. Zwei Anlässe:
 *
 *   1. **Nachfrage** — der Käufer kommt aus der Kasse zurück, die App fragt
 *      einmal nach. Das ist der Normalfall und der schnellste Weg: Der Käufer
 *      sieht „Bezahlt", noch bevor irgendein Webhook gelaufen wäre.
 *
 *   2. **Nachtdienst** — ein Cron sieht alle 15 Minuten nach, was liegen
 *      geblieben ist. Fängt den, der nach dem Bezahlen die App abgewürgt hat,
 *      und Zahlarten, die erst Stunden später durchgehen (SEPA, Klarna).
 *      Stündlich zusätzlich: die Kontostände der Verkäufer.
 *
 * ⚠️ Geschrieben wird NICHT hier. Beide Wege rufen dieselben Funktionen auf wie
 * der Webhook (`_shared/berkatPaid.ts`) — mit demselben Claim-before-update und
 * demselben `payment_status`-Riegel. Zwei Stellen, die eigenständig „bezahlt"
 * schreiben dürfen, sind zwei Wahrheiten über Geld.
 *
 * Deploy:
 *   npx supabase functions deploy berkat-confirm-payment
 *   (MIT JWT-Prüfung — anders als der Webhook ruft hier niemand von aussen an.)
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleBerkatTipPaid, handleProductOrderPaid, isSettled } from '../_shared/berkatPaid.ts';

const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

// ⚠️ Dieselbe Version wie in `create-checkout-session`. Eine abgerufene Sitzung
// muss GENAUSO aussehen wie eine zugestellte, sonst greifen die Handler ins
// Leere: In neueren Fassungen wandert `shipping_details` nach
// `collected_information` — die Adresse käme dann als `null` an, und der
// Verkäufer bekäme eine bezahlte Bestellung ohne Lieferanschrift.
const STRIPE_API_VERSION = '2024-06-20';

// Wie lange eine Bestellung liegen darf, bevor der Nachtdienst sie anfasst.
// Kürzer wäre unnötig: Direkt nach der Kasse fragt die App ohnehin selbst nach.
const SWEEP_MIN_AGE_MIN = 10;

// Und wie lange er es überhaupt versucht. Stripe-Kassensitzungen verfallen nach
// 24 Stunden; danach ändert sich nichts mehr, und weiter zu fragen wäre nur
// Last. Sieben Tage sind Reserve für den Fall, dass der Nachtdienst selbst
// tagelang stand.
const SWEEP_MAX_AGE_DAYS = 7;

const SWEEP_BATCH = 50;

type ConfirmState = 'paid' | 'pending' | 'unknown';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Ruft hier der Nachtdienst — oder ein Mensch?
 *
 * ── WARUM NICHT EINFACH `bearer === serviceRoleKey` ─────────────────────────
 *
 * Genau so stand es hier zuerst, und es war am 10.09.2026 auf Anhieb kaputt:
 * Der Cron holt seinen Schlüssel aus `vault.decrypted_secrets`, und der ist
 * **nicht derselbe** wie der, den Supabase dieser Function als
 * `SUPABASE_SERVICE_ROLE_KEY` in die Umgebung legt. Der Vault-Eintrag stammt aus
 * einer früheren Runde; seither wurde rotiert, und niemand hat ihn nachgezogen.
 *
 * Das Ergebnis war die stillste aller Fehlerarten: Der Wecker klingelte, der Ruf
 * kam an, wurde mit 403 abgewiesen — und pg_net schickt fire-and-forget, sieht
 * die Antwort also nie an. Alles grün, nichts passiert. Aufgefallen erst durch
 * das Fahrtenbuch aus `20260910140000`, das eigens dafür gebaut wurde.
 *
 * Zwei Schlüssel gleichzuziehen wäre die naheliegende Reparatur gewesen — und
 * hätte dieselbe Falle für die nächste Rotation stehen lassen. Deshalb fällt die
 * Abhängigkeit weg:
 *
 * Ein Token, das hier ankommt, hat den JWT-Riegel der Plattform bereits passiert
 * (`verify_jwt` ist für diese Function AN — ohne Kopfzeile antwortet sie 401,
 * geprüft). Seine Signatur stammt also nachweislich von diesem Projekt. Zu
 * entscheiden bleibt nur, WER darin steht — und das sagt der `role`-Anspruch.
 * Der gilt für jeden gültigen Dienstschlüssel, heute wie nach der nächsten
 * Rotation.
 *
 * ⚠️ **Diese Function darf niemals mit `--no-verify-jwt` ausgerollt werden.**
 * Dann prüfte niemand mehr die Signatur, und ein selbst geschriebenes
 * `{"role":"service_role"}` käme durch. Sie steht bewusst NICHT in
 * `config.toml` — dort stehen nur die vier Webhook-Empfänger, die es brauchen.
 */
function isServiceRole(bearer: string, serviceRoleKey: string): boolean {
  if (!bearer) return false;
  // Der einfache Fall bleibt drin: Wer denselben Schlüssel schickt, ist es auch.
  if (serviceRoleKey && bearer === serviceRoleKey) return true;

  try {
    const payload = bearer.split('.')[1];
    if (!payload) return false;
    // base64url → base64. Ohne diese zwei Zeichen wirft `atob` bei jedem
    // Token, dessen Nutzlast ein `-` oder `_` enthält — und das ist etwa jedes
    // zweite.
    const claims = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { role?: string; exp?: number };

    if (claims.role !== 'service_role') return false;
    // Abgelaufene Token weist die Plattform schon ab; die Zeile kostet nichts
    // und hält den Riegel auch dann, wenn sich daran je etwas ändert.
    if (claims.exp && claims.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Eine Kassensitzung bei Stripe abholen.
 *
 * ⚠️ **Die Kopfzeile `Stripe-Account` ist der ganze Punkt.** Die Sitzung liegt
 * auf dem Konto des VERKÄUFERS, nicht auf unserem. Fragt man ohne sie, antwortet
 * Stripe „No such checkout session" — und das sieht aus wie „nicht bezahlt",
 * heißt aber „falsch gefragt". Genau dieser Unterschied ist die Falle, an der
 * eine naive Fassung still scheitern würde.
 */
async function fetchSession(
  sessionId: string,
  stripeKey: string,
  account: string | null,
): Promise<{ ok: boolean; notFound: boolean; body: Record<string, unknown> }> {
  const res = await fetch(`${STRIPE_BASE_URL}/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Stripe-Version': STRIPE_API_VERSION,
      ...(account ? { 'Stripe-Account': account } : {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, notFound: res.status === 404, body };
}

/**
 * Auf welchem Konto liegt diese Sitzung — auf dem des Verkäufers oder auf
 * unserem?
 *
 * Die Bestellung hält das nicht fest, und nachträglich lässt es sich nicht
 * sicher herleiten: Ob `create-checkout-session` die Kopfzeile gesetzt hat, hing
 * am `charges_enabled` VON DAMALS, und das kann sich seither geändert haben.
 *
 * Deshalb wird gefragt statt geraten — erst dort, wo es am wahrscheinlichsten
 * liegt, und bei „gibt es nicht" einmal auf dem anderen Konto. Zwei Anläufe,
 * mehr kann es nicht sein.
 */
async function fetchSessionAnywhere(
  sessionId: string,
  stripeKey: string,
  connectedAccount: string | null,
): Promise<Record<string, unknown> | null> {
  const first = await fetchSession(sessionId, stripeKey, connectedAccount);
  if (first.ok) return first.body;

  if (first.notFound && connectedAccount) {
    const second = await fetchSession(sessionId, stripeKey, null);
    if (second.ok) return second.body;
  }
  return null;
}

/** Das verbundene Konto eines Verkäufers — unabhängig davon, ob es gerade darf. */
async function connectedAccountOf(
  admin: SupabaseClient,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await admin
    .from('berkat_seller_stripe')
    .select('stripe_account_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.stripe_account_id ?? null;
}

// ═════════════════════════════════════════════════════════════════════════════
// Eine Bestellung / ein Trinkgeld prüfen
// ═════════════════════════════════════════════════════════════════════════════

async function confirmOrder(
  admin: SupabaseClient,
  stripeKey: string,
  order: {
    id: string;
    status: string;
    seller_id: string | null;
    stripe_session_id: string | null;
  },
): Promise<ConfirmState> {
  // Schon durch — nicht bei Stripe nachfragen. Das ist zugleich die Bremse
  // gegen wiederholtes Antippen: Wer zehnmal fragt, löst höchstens den ersten
  // Ruf aus.
  if (order.status === 'paid') return 'paid';
  if (order.status !== 'payment_requested') return 'unknown';
  if (!order.stripe_session_id) return 'unknown';

  const account = await connectedAccountOf(admin, order.seller_id);
  const session = await fetchSessionAnywhere(order.stripe_session_id, stripeKey, account);
  if (!session) return 'unknown';

  if (!isSettled(session.payment_status as string | undefined)) return 'pending';

  // Die Handler lesen `metadata.order_id` bzw. `client_reference_id`. Eine
  // abgeholte Sitzung trägt beides genauso wie eine zugestellte — deshalb geht
  // sie unverändert durch dieselbe Tür.
  await handleProductOrderPaid(admin, session);
  return 'paid';
}

async function confirmTip(
  admin: SupabaseClient,
  stripeKey: string,
  tip: {
    id: string;
    status: string;
    recipient_id: string | null;
    stripe_session_id: string | null;
  },
): Promise<ConfirmState> {
  if (tip.status === 'paid') return 'paid';
  if (tip.status !== 'pending') return 'unknown';
  if (!tip.stripe_session_id) return 'unknown';

  // Beim Trinkgeld ist der EMPFÄNGER der Verkäufer — dort liegt das Konto.
  const account = await connectedAccountOf(admin, tip.recipient_id);
  const session = await fetchSessionAnywhere(tip.stripe_session_id, stripeKey, account);
  if (!session) return 'unknown';

  if (!isSettled(session.payment_status as string | undefined)) return 'pending';

  await handleBerkatTipPaid(admin, session);
  return 'paid';
}

// ═════════════════════════════════════════════════════════════════════════════
// Nachtdienst
// ═════════════════════════════════════════════════════════════════════════════

async function sweepPayments(admin: SupabaseClient, stripeKey: string) {
  const since = new Date(Date.now() - SWEEP_MIN_AGE_MIN * 60_000).toISOString();
  const until = new Date(Date.now() - SWEEP_MAX_AGE_DAYS * 86_400_000).toISOString();

  // ⚠️ Nur Berkat (`cart_id IS NOT NULL`). Serlos Produktkäufe laufen über das
  // Plattform-Konto, und dessen Webhook arbeitet seit Monaten — sie hier
  // stillschweigend mitzunehmen wäre eine Verhaltensänderung an einem
  // laufenden Produkt im App Store. Dieselbe Linie wie bei `notify_order_shipped`.
  const { data: orders, error: orderErr } = await admin
    .from('product_orders')
    .select('id, status, seller_id, stripe_session_id')
    .eq('status', 'payment_requested')
    .not('cart_id', 'is', null)
    .not('stripe_session_id', 'is', null)
    .lt('payment_requested_at', since)
    .gt('payment_requested_at', until)
    .limit(SWEEP_BATCH);

  if (orderErr) console.error('[confirm] Bestellungen laden:', orderErr.message);

  let ordersPaid = 0;
  for (const order of orders ?? []) {
    try {
      if ((await confirmOrder(admin, stripeKey, order)) === 'paid') ordersPaid++;
    } catch (e) {
      // Eine kaputte Bestellung darf den Rest des Durchgangs nicht mitnehmen.
      console.error('[confirm] Bestellung', order.id, e);
    }
  }

  const { data: tips, error: tipErr } = await admin
    .from('berkat_tips')
    .select('id, status, recipient_id, stripe_session_id')
    .eq('status', 'pending')
    .not('stripe_session_id', 'is', null)
    .lt('created_at', since)
    .gt('created_at', until)
    .limit(SWEEP_BATCH);

  if (tipErr) console.error('[confirm] Trinkgelder laden:', tipErr.message);

  let tipsPaid = 0;
  for (const tip of tips ?? []) {
    try {
      if ((await confirmTip(admin, stripeKey, tip)) === 'paid') tipsPaid++;
    } catch (e) {
      console.error('[confirm] Trinkgeld', tip.id, e);
    }
  }

  console.log(
    `[confirm] Nachtdienst: ${orders?.length ?? 0} Bestellungen (${ordersPaid} bezahlt), ` +
      `${tips?.length ?? 0} Trinkgelder (${tipsPaid} bezahlt)`,
  );
  return { orders_checked: orders?.length ?? 0, orders_paid: ordersPaid, tips_paid: tipsPaid };
}

/**
 * Die Kontostände der Verkäufer nachziehen.
 *
 * ⚠️ **Das ist die Lücke, die der Nachfrage-Weg NICHT schließt.** Sperrt Stripe
 * einen Verkäufer — fehlende Papiere, Betrugsverdacht —, erfährt Berkat das
 * ohne Connect-Webhook von selbst nie. `checkout_enabled` bliebe auf `true`,
 * und der Käufer landete auf einer Kasse, die im letzten Moment abbricht. Vor
 * einem zahlenden Menschen.
 *
 * Deshalb fragt der Nachtdienst stündlich alle verbundenen Konten ab. Geschrieben
 * wird nur `berkat_seller_stripe`; den Kaufknopf schaltet weiterhin allein der
 * Trigger aus `20260827100000`. Zwei Schreiber auf `checkout_enabled` wären
 * genau der Fehler vom 27.08.
 */
async function sweepAccounts(admin: SupabaseClient, stripeKey: string) {
  const { data: rows, error } = await admin
    .from('berkat_seller_stripe')
    .select('user_id, stripe_account_id, charges_enabled');

  if (error) {
    console.error('[confirm] Konten laden:', error.message);
    return { accounts_checked: 0, accounts_changed: 0 };
  }

  let changed = 0;
  for (const row of rows ?? []) {
    try {
      const res = await fetch(`${STRIPE_BASE_URL}/accounts/${row.stripe_account_id}`, {
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Stripe-Version': STRIPE_API_VERSION,
        },
      });
      if (!res.ok) {
        // 404 heißt: Das Konto hat die Verbindung gelöst. Die Zeile hier zu
        // entfernen wäre verlockend, ist aber Sache von
        // `account.application.deauthorized` — und ohne Connect-Webhook lieber
        // stehenlassen als raten. Eine tote Zeile schadet niemandem; eine
        // gelöschte nimmt dem Verkäufer stillschweigend den Kaufknopf.
        console.warn('[confirm] Konto', row.stripe_account_id, 'antwortet', res.status);
        continue;
      }
      const acc = (await res.json()) as {
        charges_enabled?: boolean;
        details_submitted?: boolean;
        requirements?: { disabled_reason?: string | null };
      };
      const next = Boolean(acc.charges_enabled);
      if (next !== row.charges_enabled) changed++;

      await admin
        .from('berkat_seller_stripe')
        .update({
          charges_enabled: next,
          details_submitted: Boolean(acc.details_submitted),
          disabled_reason: acc.requirements?.disabled_reason ?? null,
        })
        .eq('user_id', row.user_id);
    } catch (e) {
      console.error('[confirm] Konto', row.stripe_account_id, e);
    }
  }

  console.log(`[confirm] Konten: ${rows?.length ?? 0} geprüft, ${changed} geändert`);
  return { accounts_checked: rows?.length ?? 0, accounts_changed: changed };
}

// ═════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!stripeKey || !supabaseUrl || !serviceRoleKey) {
    console.error('[confirm] Umgebung unvollständig');
    return json({ error: 'not_configured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');

  let body: { order_id?: string; tip_id?: string; sweep?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // ── Nachtdienst ───────────────────────────────────────────────────────────
  if (body.sweep) {
    if (!isServiceRole(bearer, serviceRoleKey)) return json({ error: 'forbidden' }, 403);
    if (body.sweep === 'accounts') return json(await sweepAccounts(admin, stripeKey));
    return json(await sweepPayments(admin, stripeKey));
  }

  // ── Nachfrage durch einen Menschen ────────────────────────────────────────
  if (!bearer) return json({ error: 'unauthenticated' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return json({ error: 'unauthenticated' }, 401);

  if (body.order_id) {
    const { data: order } = await admin
      .from('product_orders')
      .select('id, status, buyer_id, seller_id, stripe_session_id')
      .eq('id', body.order_id)
      .maybeSingle();

    // ⚠️ Nur die zwei Beteiligten. Ohne diese Zeile könnte jeder Angemeldete mit
    // einer geratenen Bestell-Nummer erfahren, ob sie bezahlt ist — und über die
    // Antwortzeit sogar, ob es sie überhaupt gibt.
    if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
      return json({ error: 'not_found' }, 404);
    }
    return json({ state: await confirmOrder(admin, stripeKey, order) });
  }

  if (body.tip_id) {
    const { data: tip } = await admin
      .from('berkat_tips')
      .select('id, status, sender_id, recipient_id, stripe_session_id')
      .eq('id', body.tip_id)
      .maybeSingle();

    if (!tip || (tip.sender_id !== user.id && tip.recipient_id !== user.id)) {
      return json({ error: 'not_found' }, 404);
    }
    return json({ state: await confirmTip(admin, stripeKey, tip) });
  }

  return json({ error: 'nothing_to_confirm' }, 400);
});
