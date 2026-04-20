/**
 * supabase/functions/stripe-webhook/index.ts
 *
 * Stripe Webhook → Coin-Gutschrift
 *
 * Behandelte Events:
 *   - checkout.session.completed      → Order auf paid, Coins gutschreiben
 *   - checkout.session.async_payment_succeeded
 *                                     → Spät-Bestätigung (SEPA Debit, Klarna)
 *   - checkout.session.async_payment_failed
 *                                     → Order auf failed
 *   - checkout.session.expired        → Order auf cancelled
 *   - charge.refunded                 → Order auf refunded (manuelle Erstattung)
 *
 * Sicherheit:
 *   - Signatur-Verifikation via Stripe-Signature-Header + STRIPE_WEBHOOK_SECRET
 *     (HMAC-SHA256). Eigene Implementation weil esm.sh/stripe in Deno-Edge
 *     unzuverlässig ist — siehe verifyStripeSignature() unten.
 *   - Idempotenz über `web_coin_orders.stripe_session_id` UNIQUE-Constraint +
 *     Status-Check (`paid` wird nicht nochmals gutgeschrieben).
 *   - Max Event-Age: 10 Min — alles darüber wird abgewiesen (Replay-Schutz).
 *
 * Deploy:
 *   npx supabase functions deploy stripe-webhook --no-verify-jwt
 *   (--no-verify-jwt weil Stripe ruft ohne Supabase-JWT auf)
 *
 * In Stripe Dashboard → Developers → Webhooks:
 *   Endpoint-URL: https://<project>.supabase.co/functions/v1/stripe-webhook
 *   Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 *           checkout.session.async_payment_failed, checkout.session.expired,
 *           charge.refunded
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_EVENT_AGE_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!signature || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'missing_signature' }), { status: 400 });
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  // Raw body für Signatur-Check
  const raw = await req.text();

  const sigOk = await verifyStripeSignature(raw, signature, webhookSecret);
  if (!sigOk) {
    console.warn('[stripe-webhook] invalid signature');
    return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
  }

  // Replay-Schutz: event.created ist Unix-Sekunden
  const ageMs = Date.now() - event.created * 1000;
  if (ageMs > MAX_EVENT_AGE_MS) {
    console.warn(`[stripe-webhook] event too old: ${ageMs}ms`);
    return new Response(JSON.stringify({ error: 'event_too_old' }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handlePaid(admin, event);
        break;
      case 'checkout.session.async_payment_failed':
        await handleFailed(admin, event);
        break;
      case 'checkout.session.expired':
        await handleExpired(admin, event);
        break;
      case 'charge.refunded':
        await handleRefunded(admin, event);
        break;
      default:
        // Nicht-relevantes Event → ok quittieren damit Stripe kein Retry macht
        console.log(`[stripe-webhook] ignoring event type: ${event.type}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[stripe-webhook] handler error', message);
    // 500 zurück → Stripe retried mit Exponential Backoff (bis 3 Tage)
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});

// ═════════════════════════════════════════════════════════════════════════════
// Event-Handler
// ═════════════════════════════════════════════════════════════════════════════

async function handlePaid(admin: SupabaseClient, event: StripeEvent) {
  const session = event.data.object as {
    id: string;
    client_reference_id?: string;
    payment_intent?: string;
    invoice?: string;
    payment_status?: string;
    metadata?: Record<string, string>;
  };

  const orderId = session.client_reference_id ?? session.metadata?.order_id;
  if (!orderId) {
    console.warn('[stripe-webhook] no order_id in session.completed event');
    return;
  }

  // ── Pre-Read: Order laden (nur zum Early-Exit bei bereits gepaidten Orders
  //    — die eigentliche Race-Protection passiert unten im UPDATE-Claim). ──
  const { data: order, error: orderErr } = await admin
    .from('web_coin_orders')
    .select('id, user_id, coins, bonus_coins, status')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    console.warn(`[stripe-webhook] order not found: ${orderId}`);
    return;
  }

  if (order.status === 'paid') {
    console.log(`[stripe-webhook] order ${orderId} already paid — skip`);
    return;
  }

  // ── Best-Effort: Invoice + Receipt URLs via Stripe-API (kann null bleiben) ──
  let invoiceUrl: string | null = null;
  let receiptUrl: string | null = null;

  if (session.invoice) {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (stripeKey) {
      try {
        const invRes = await fetch(`https://api.stripe.com/v1/invoices/${session.invoice}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        if (invRes.ok) {
          const inv = (await invRes.json()) as {
            hosted_invoice_url?: string;
            invoice_pdf?: string;
          };
          invoiceUrl = inv.hosted_invoice_url ?? inv.invoice_pdf ?? null;
        }
      } catch (err) {
        console.warn('[stripe-webhook] invoice fetch failed', err);
      }
    }
  }

  if (session.payment_intent) {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (stripeKey) {
      try {
        const piRes = await fetch(
          `https://api.stripe.com/v1/payment_intents/${session.payment_intent}?expand[]=latest_charge`,
          { headers: { Authorization: `Bearer ${stripeKey}` } },
        );
        if (piRes.ok) {
          const pi = (await piRes.json()) as {
            latest_charge?: { receipt_url?: string };
          };
          receiptUrl = pi.latest_charge?.receipt_url ?? null;
        }
      } catch (err) {
        console.warn('[stripe-webhook] payment-intent fetch failed', err);
      }
    }
  }

  // ── CLAIM-BEFORE-CREDIT: Erst den Status in EINEM atomaren UPDATE auf 'paid'
  //    setzen (mit `.eq('status','pending')`-Guard) — nur wenn der UPDATE
  //    tatsächlich eine Zeile trifft (`claimed.length === 1`) schreiben wir
  //    Coins gut. Bei zwei parallelen Webhook-Retries gewinnt genau einer den
  //    UPDATE-Race; der Verlierer bekommt 0 Rows zurück und skipt.
  //
  //    Vorher stand `credit_coins` VOR dem UPDATE → beide Retries konnten nach
  //    dem pre-read-Check an der 'pending'-Hürde vorbei und haben *beide* Coins
  //    gutgeschrieben, bevor einer den UPDATE gewann. v1.w.10.1 Fix.
  const { data: claimed, error: claimErr } = await admin
    .from('web_coin_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent ?? null,
      invoice_url: invoiceUrl,
      receipt_url: receiptUrl,
    })
    .eq('id', order.id)
    .eq('status', 'pending')
    .select('id, user_id, coins, bonus_coins');

  if (claimErr) {
    console.error('[stripe-webhook] claim update failed', claimErr);
    throw new Error(`claim_failed: ${claimErr.message}`);
  }

  if (!claimed || claimed.length === 0) {
    // Race verloren — anderer Webhook-Delivery hat diese Order bereits gepaid.
    // Kein Coin-Credit, kein Error.
    console.log(
      `[stripe-webhook] order ${orderId} already claimed by concurrent delivery — skip credit`,
    );
    return;
  }

  const claimedRow = claimed[0];
  const totalCoins = claimedRow.coins + claimedRow.bonus_coins;

  const { error: creditErr } = await admin.rpc('credit_coins', {
    p_user_id: claimedRow.user_id,
    p_coins: totalCoins,
  });

  if (creditErr) {
    // Kritischer Fehler: Order ist 'paid', aber Coins wurden nicht gutgeschrieben.
    // Throw → Stripe retried → nächste Zustellung trifft `order.status === 'paid'`
    // im Pre-Read-Early-Exit, aber der User hat noch keine Coins. Dieser Fall
    // muss manuell resolved werden (via `coin_purchases`-Audit + `credit_coins`
    // aus Supabase-Studio). Sentry-Alert empfohlen.
    console.error(
      `[stripe-webhook] CRITICAL: order ${orderId} paid but credit_coins failed`,
      creditErr,
    );
    throw new Error(`credit_failed_after_claim: ${creditErr.message}`);
  }
}

async function handleFailed(admin: SupabaseClient, event: StripeEvent) {
  const session = event.data.object as {
    id: string;
    client_reference_id?: string;
    metadata?: Record<string, string>;
    last_payment_error?: { message?: string };
  };
  const orderId = session.client_reference_id ?? session.metadata?.order_id;
  if (!orderId) return;

  await admin
    .from('web_coin_orders')
    .update({
      status: 'failed',
      failed_reason: session.last_payment_error?.message ?? 'async_payment_failed',
    })
    .eq('id', orderId);
}

async function handleExpired(admin: SupabaseClient, event: StripeEvent) {
  const session = event.data.object as {
    id: string;
    client_reference_id?: string;
    metadata?: Record<string, string>;
  };
  const orderId = session.client_reference_id ?? session.metadata?.order_id;
  if (!orderId) return;

  // Nur pending → cancelled; paid-Orders bleiben unberührt
  await admin
    .from('web_coin_orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('status', 'pending');
}

async function handleRefunded(admin: SupabaseClient, event: StripeEvent) {
  const charge = event.data.object as {
    id: string;
    payment_intent?: string;
  };
  if (!charge.payment_intent) return;

  // Finde Order via payment_intent (eindeutig)
  const { data: order } = await admin
    .from('web_coin_orders')
    .select('id')
    .eq('stripe_payment_intent', charge.payment_intent)
    .maybeSingle();

  if (!order) return;

  await admin
    .from('web_coin_orders')
    .update({ status: 'refunded' })
    .eq('id', order.id);

  // NOTE: Coin-Rückbuchung ist bewusst nicht automatisiert. Coins könnten
  // bereits ausgegeben (Gifts, Shop) sein. Support macht das per Hand.
}

// ═════════════════════════════════════════════════════════════════════════════
// Stripe-Signatur-Verifikation (HMAC-SHA256)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Verifiziert den `Stripe-Signature`-Header gegen den Rohbody.
 * Stripe sendet `t=<timestamp>,v1=<sig>[,v1=<sig>...]` — wir akzeptieren jeden
 * v1-Eintrag der mit HMAC-SHA256(timestamp.body, secret) matcht.
 */
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(',');
  let timestamp: string | null = null;
  const v1Sigs: string[] = [];
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k === 't') timestamp = v;
    else if (k === 'v1' && v) v1Sigs.push(v);
  }
  if (!timestamp || v1Sigs.length === 0) return false;

  const payload = `${timestamp}.${rawBody}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return v1Sigs.some((s) => timingSafeEq(s, expected));
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// Stripe-Event-Typen (subset dessen was wir konsumieren)
// ═════════════════════════════════════════════════════════════════════════════

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: unknown;
  };
}
