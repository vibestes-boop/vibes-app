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

  // ── payment_status-Guard (Security-Review 2026-07-02, Fund #2) ─────────────
  // Bei async-Zahlarten (SEPA-Lastschrift, Klarna) feuert
  // `checkout.session.completed` SOFORT mit payment_status='unpaid' — das Geld
  // ist da noch nicht eingezogen. Ohne diesen Guard wurden Coins/Ware als
  // bezahlt markiert, bevor die Zahlung durch war; scheiterte sie später,
  // blieb die Order fälschlich auf 'paid'. Gutschreiben nur bei 'paid'
  // (bzw. 'no_payment_required' defensiv); sonst 200 quittieren und auf das
  // separate `async_payment_succeeded`-Event warten (Handler existiert).
  // Karten/Apple/Google Pay liefern immer 'paid' → Guard ist dort ein No-Op.
  if (
    session.payment_status &&
    session.payment_status !== 'paid' &&
    session.payment_status !== 'no_payment_required'
  ) {
    console.log(
      `[stripe-webhook] ${event.type} mit payment_status='${session.payment_status}' — warte auf async_payment_succeeded (session ${session.id})`,
    );
    return;
  }

  // Trinkgeld aus Berkat → eigener Pfad (berkat_tips), kein Coin-Credit und
  // keine Bestellung. Steht VOR dem Produkt-Zweig, damit ein Trinkgeld nie
  // versehentlich in der Bestell-Logik landet — dort hingen Versand,
  // Streitfälle und Bewertungen dran, die es hier alle nicht gibt.
  if (session.metadata?.kind === 'berkat_tip') {
    await handleBerkatTipPaid(admin, event.data.object);
    return;
  }

  // Produkt-Bestellung (echte Ware) → eigener Pfad (product_orders), kein Coin-Credit.
  if (session.metadata?.kind === 'product_order') {
    await handleProductOrderPaid(admin, event.data.object);
    return;
  }

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

// ── Produkt-Bestellung bezahlt (echte Ware, z.B. Parfüm) ─────────────────────
// Kein Coin-Credit — das Geld liegt direkt auf Zaurs Stripe (er = Verkäufer).
// Claim-before-update: nur 'payment_requested' → 'paid' (idempotent gegen Retries).
// Speichert die von Stripe Checkout eingesammelte Versandadresse.
/**
 * Trinkgeld bestätigen (Berkat).
 *
 * Bewusst schmal: Es gibt nichts zu versenden, nichts gutzuschreiben und keine
 * Adresse zu übernehmen. Die Zeile wechselt von 'pending' auf 'paid', mehr
 * nicht.
 *
 * Idempotent über den Zustand: Stripe stellt Ereignisse mehrfach zu, und der
 * UPDATE filtert deshalb auf `status = 'pending'`. Ein zweites Ereignis trifft
 * dann null Zeilen statt einen zweiten Eintrag zu erzeugen.
 */
async function handleBerkatTipPaid(admin: SupabaseClient, obj: unknown) {
  const session = obj as {
    id: string;
    metadata?: Record<string, string>;
  };

  const tipId = session.metadata?.tip_id;
  if (!tipId) {
    console.error('[stripe-webhook] berkat_tip ohne tip_id', session.id);
    return;
  }

  const { data: updated, error } = await admin
    .from('berkat_tips')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', tipId)
    .eq('status', 'pending')
    .select('id, recipient_id, amount_cents');

  if (error) {
    console.error('[stripe-webhook] berkat_tip update fehlgeschlagen', error.message);
    return;
  }
  if (!updated || updated.length === 0) {
    // Kein Fehler: entweder schon bestätigt (Doppel-Zustellung) oder storniert.
    console.log(`[stripe-webhook] berkat_tip ${tipId} war nicht mehr pending`);
    return;
  }

  console.log(`[stripe-webhook] Trinkgeld ${tipId} bestätigt (${updated[0].amount_cents} Cent)`);
}

async function handleProductOrderPaid(admin: SupabaseClient, obj: unknown) {
  const session = obj as {
    id: string;
    client_reference_id?: string;
    payment_intent?: string;
    metadata?: Record<string, string>;
    shipping_details?: { name?: string; address?: Record<string, string> };
    customer_details?: { name?: string; address?: Record<string, string> };
    // Der tatsächlich gezahlte Versand. Stripe rechnet ihn aus der vom Käufer
    // gewählten `shipping_option` und meldet ihn hier zurück — er steht NICHT in
    // `amount_eur`, weil Ware und Versand bei Stripe Connect getrennt verrechnet
    // werden. Fehlt das Feld (Serlo-Produktkauf ohne Versandoptionen), bleibt es
    // bei 0.
    total_details?: { amount_shipping?: number };
  };

  const orderId = session.client_reference_id ?? session.metadata?.order_id;
  if (!orderId) {
    console.warn('[stripe-webhook] product_order without order_id');
    return;
  }

  const ship = session.shipping_details ?? session.customer_details;
  const addr = ship?.address ?? {};
  const street = [addr.line1, addr.line2].filter(Boolean).join(', ') || null;

  const { data: claimed, error: claimErr } = await admin
    .from('product_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent: session.payment_intent ?? null,
      shipping_cents: session.total_details?.amount_shipping ?? 0,
      ship_name: ship?.name ?? null,
      ship_street: street,
      ship_zip: addr.postal_code ?? null,
      ship_city: addr.city ?? null,
      ship_country: addr.country ?? null,
    })
    .eq('id', orderId)
    .eq('status', 'payment_requested')
    // `cart_id` unterscheidet die Herkunft: gesetzt = Berkat-Sammelkorb,
    // NULL = Serlo-Produktkauf. Dieselbe Weiche wie in create-checkout-session.
    .select('id, buyer_id, seller_id, product_id, quantity, cart_id');

  if (claimErr) {
    console.error('[stripe-webhook] product claim failed', claimErr);
    throw new Error(`product_claim_failed: ${claimErr.message}`);
  }

  if (!claimed || claimed.length === 0) {
    console.log(`[stripe-webhook] product order ${orderId} already paid/not payable — skip`);
    return;
  }

  const row = claimed[0];
  // Verkauf zählen (products.sold_count) — sonst bleibt das Parfüm auf „0× verkauft".
  if (row?.product_id) {
    try {
      await admin.rpc('bump_product_sold_count', { p_product_id: row.product_id, p_qty: row.quantity ?? 1 });
    } catch (e) {
      console.warn('[stripe-webhook] sold_count bump failed (non-fatal):', e);
    }
  }

  // Verkäufer informieren: bezahlt → bitte versenden.
  //
  // `app` entscheidet, auf welchem Gerät die Meldung landet. Ohne die Spalte
  // greift der Default 'serlo' — bei einem Berkat-Verkauf also die falsche App.
  // Heute rettet das noch der Rückfall in send_push_to_user (kein Gerät der
  // Ziel-App → alle Geräte des Nutzers), aber sobald ein Verkäufer BEIDE Apps
  // installiert hat, käme die Berkat-Verkaufsmeldung in Serlo an.
  await admin.from('notifications').insert({
    recipient_id: row.seller_id,
    sender_id: row.buyer_id,
    type: 'order_paid',
    // Ohne Emoji. Am 16.08.2026 kam das frühere „… versenden 📦" in der App als
    // Ersatzzeichen an (Kästchen mit Fragezeichen) — dasselbe Muster, das in
    // diesem Projekt schon einmal Mojibake in die Produktiv-Datenbank
    // geschrieben hat. In der Meldungsliste trägt ohnehin das Symbol daneben
    // die Bedeutung; der Satz braucht das Zeichen nicht.
    comment_text: 'Eine Bestellung wurde bezahlt — bitte versenden',
    app: row.cart_id ? 'berkat' : 'serlo',
  });
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

  if (order) {
    await admin
      .from('web_coin_orders')
      .update({ status: 'refunded' })
      .eq('id', order.id);
    // NOTE: Coin-Rückbuchung ist bewusst nicht automatisiert. Coins könnten
    // bereits ausgegeben (Gifts, Shop) sein. Support macht das per Hand.
    return;
  }

  // Sonst: Produkt-Bestellung (echte Ware) via payment_intent
  const { data: pOrder } = await admin
    .from('product_orders')
    .select('id')
    .eq('stripe_payment_intent', charge.payment_intent)
    .maybeSingle();

  if (!pOrder) return;

  await admin
    .from('product_orders')
    .update({ status: 'refunded' })
    .eq('id', pOrder.id);
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
