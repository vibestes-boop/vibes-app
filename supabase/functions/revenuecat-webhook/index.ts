/**
 * supabase/functions/revenuecat-webhook/index.ts
 *
 * RevenueCat → Supabase Webhook
 * Empfängt Purchase-Events und schreibt Coins in coins_wallets.
 *
 * Setup:
 * 1. Deploy: npx supabase functions deploy revenuecat-webhook
 * 2. In RevenueCat Dashboard → Integrations → Webhooks:
 *    URL: https://<project>.supabase.co/functions/v1/revenuecat-webhook
 *    Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
 * 3. Supabase Secret setzen:
 *    npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=dein-geheimes-passwort
 *
 * Audit Phase 2 #7 Härtungen:
 *  - Replay-Schutz via event_timestamp_ms (max 10 Min Alter)
 *  - Rate-Limit per User (max 20 Gutschriften/Stunde) via coin_purchases
 *  - Receipt-Verify-Scaffold (Apple/Google Store-API-Check via ENV-Flag aktivierbar)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Coin-Mapping: RevenueCat Produkt-ID → Anzahl Coins
const PRODUCT_COINS: Record<string, number> = {
  'com.vibesapp.vibes.coins_100':  100,
  'com.vibesapp.vibes.coins_500':  500,
  'com.vibesapp.vibes.coins_1200': 1200,
  'com.vibesapp.vibes.coins_3000': 3000,
};

// Events die eine Gutschrift auslösen
const PURCHASE_EVENTS = new Set([
  'NON_SUBSCRIPTION_PURCHASE', // Consumable Kauf
  'INITIAL_PURCHASE',           // Erster Kauf (Sicherheit)
]);

// ─── Härtungs-Konstanten ──────────────────────────────────────────────────────
const MAX_EVENT_AGE_MS   = 10 * 60 * 1000; // 10 Min — älter = Replay-Verdacht
const RATE_LIMIT_PER_HR  = 20;              // max Gutschriften pro User pro Stunde
const RATE_LIMIT_WINDOW  = '1 hour';        // Postgres Interval-String

// ─── Apple/Google Receipt-Verify-Scaffold ────────────────────────────────────
/**
 * Aktivierung: env var ENABLE_RECEIPT_VERIFY=true setzen, dann die
 * unten stehenden verifyAppleReceipt/verifyGoogleReceipt-Implementationen
 * vervollständigen (benötigt zusätzliche Secrets — siehe jeweilige Funktion).
 *
 * Solange OFF: Verhalten identisch zum alten Webhook (RevenueCat wird
 * vertraut). Kein Regression-Risiko beim Deploy.
 */
const RECEIPT_VERIFY_ENABLED = Deno.env.get('ENABLE_RECEIPT_VERIFY') === 'true';

async function verifyAppleReceipt(
  transactionId: string,
  productId: string,
): Promise<{ valid: boolean; reason?: string }> {
  // TODO(phase3): App Store Server API integration
  // - Secrets nötig: APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_PRIVATE_KEY
  // - Endpoint: https://api.storekit.itunes.apple.com/inApps/v1/transactions/{transactionId}
  // - JWT-signed Request (ES256)
  // - Response validieren: productId match, revocationDate NULL, transactionId match
  console.warn(`[RC Webhook] verifyAppleReceipt Stub — txn=${transactionId} product=${productId}`);
  return { valid: true, reason: 'stub_not_implemented' };
}

async function verifyGoogleReceipt(
  purchaseToken: string,
  productId: string,
  packageName: string,
): Promise<{ valid: boolean; reason?: string }> {
  // TODO(phase3): Google Play Developer API integration
  // - Secrets nötig: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (OAuth2-key)
  // - Endpoint: https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/products/{productId}/tokens/{purchaseToken}
  // - Response validieren: purchaseState === 0 (purchased), acknowledgementState ok
  console.warn(`[RC Webhook] verifyGoogleReceipt Stub — token=${purchaseToken.slice(0, 8)}… product=${productId}`);
  return { valid: true, reason: 'stub_not_implemented' };
}

// ─── Hauptlogik ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // ── Authorization prüfen ──────────────────────────────────────────────────
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (webhookSecret) {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (token !== webhookSecret) {
      console.error('[RC Webhook] Unauthorized');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = body?.event;
  if (!event) {
    return new Response('No event', { status: 400 });
  }

  const eventType: string = event.type ?? '';
  console.log(`[RC Webhook] Event: ${eventType}`);

  // ── Replay-Schutz: Event-Alter prüfen ─────────────────────────────────────
  // RevenueCat sendet event_timestamp_ms. Fehlt das Feld → tolerant akzeptieren
  // (keine Regression für ältere RC-Versionen), aber loggen.
  const eventTsMs: number | null = typeof event.event_timestamp_ms === 'number'
    ? event.event_timestamp_ms
    : null;
  if (eventTsMs !== null) {
    const ageMs = Date.now() - eventTsMs;
    if (ageMs > MAX_EVENT_AGE_MS) {
      console.warn(`[RC Webhook] Event zu alt: ${ageMs}ms — Replay-Verdacht`);
      return new Response(JSON.stringify({ ok: false, error: 'event_too_old', age_ms: ageMs }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (ageMs < -60_000) {
      // Future-timestamps (> 1 Min in die Zukunft) sind verdächtig
      console.warn(`[RC Webhook] Event-Timestamp in der Zukunft: ${-ageMs}ms`);
      return new Response(JSON.stringify({ ok: false, error: 'event_future' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    console.warn('[RC Webhook] Kein event_timestamp_ms im Event (alte RC-Version?)');
  }

  // ── Nur Purchase-Events verarbeiten ──────────────────────────────────────
  if (!PURCHASE_EVENTS.has(eventType)) {
    console.log(`[RC Webhook] Ignoriert: ${eventType}`);
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Produkt-ID und Coins ermitteln ────────────────────────────────────────
  const productId: string = event.product_id ?? '';
  const coinsToCredit = PRODUCT_COINS[productId];

  if (!coinsToCredit) {
    console.warn(`[RC Webhook] Unbekannte Produkt-ID: ${productId}`);
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'unknown_product' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── User-ID ermitteln (RevenueCat App User ID = Supabase User ID) ─────────
  const appUserId: string = event.app_user_id ?? '';
  const supabaseUserId = appUserId;

  if (!appUserId || appUserId.startsWith('$RC')) {
    console.warn(`[RC Webhook] Kein App User ID: ${appUserId}`);
    return new Response(JSON.stringify({ ok: false, error: 'no_user_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Supabase Admin Client ────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Rate-Limit: max N Gutschriften pro User pro Stunde ───────────────────
  // Nutzt existierende coin_purchases Tabelle. Defense-in-depth gegen den
  // (unwahrscheinlichen) Fall, dass Webhook-Secret leakt + Angreifer Spam sendet.
  const { count: recentCount, error: rateLimitError } = await supabase
    .from('coin_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', supabaseUserId)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (rateLimitError) {
    console.warn('[RC Webhook] Rate-Limit-Check fehlgeschlagen:', rateLimitError.message);
    // Nicht fatal — weiter verarbeiten (Rate-Limit ist defense-in-depth)
  } else if ((recentCount ?? 0) >= RATE_LIMIT_PER_HR) {
    console.warn(`[RC Webhook] Rate-Limit: User ${supabaseUserId} hat ${recentCount} Käufe im letzten ${RATE_LIMIT_WINDOW}`);
    return new Response(JSON.stringify({ ok: false, error: 'rate_limit_exceeded', recent_count: recentCount }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Idempotenz-Check: Transaktion schon verarbeitet? ─────────────────────
  const transactionId: string = event.transaction_id ?? event.id ?? '';
  if (transactionId) {
    const { data: existing } = await supabase
      .from('coin_purchases')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existing) {
      console.log(`[RC Webhook] Transaktion bereits verarbeitet: ${transactionId}`);
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Optional: Apple/Google Receipt-Verify ────────────────────────────────
  if (RECEIPT_VERIFY_ENABLED) {
    const store: string = event.store ?? '';
    if (store === 'APP_STORE' || store === 'MAC_APP_STORE') {
      const result = await verifyAppleReceipt(transactionId, productId);
      if (!result.valid) {
        console.error(`[RC Webhook] Apple Receipt invalid: ${result.reason}`);
        return new Response(JSON.stringify({ ok: false, error: 'apple_receipt_invalid', reason: result.reason }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (store === 'PLAY_STORE') {
      const purchaseToken: string = event.purchase_token ?? event.transaction_id ?? '';
      const packageName:   string = event.package_name ?? 'com.vibesapp.vibes';
      const result = await verifyGoogleReceipt(purchaseToken, productId, packageName);
      if (!result.valid) {
        console.error(`[RC Webhook] Google Receipt invalid: ${result.reason}`);
        return new Response(JSON.stringify({ ok: false, error: 'google_receipt_invalid', reason: result.reason }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.warn(`[RC Webhook] Unbekannter Store: ${store} — skip Verify`);
    }
  }

  // ── Coins gutschreiben (UPSERT + Increment) ───────────────────────────────
  const { error: walletError } = await supabase.rpc('credit_coins', {
    p_user_id: supabaseUserId,
    p_coins:   coinsToCredit,
  });

  if (walletError) {
    console.error('[RC Webhook] Wallet-Update fehlgeschlagen:', walletError);
    return new Response(JSON.stringify({ ok: false, error: walletError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Kauf-Log speichern (für Idempotenz + Support + Rate-Limit) ────────────
  await supabase.from('coin_purchases').insert({
    user_id:        supabaseUserId,
    product_id:     productId,
    coins_credited: coinsToCredit,
    transaction_id: transactionId,
    event_type:     eventType,
    raw_event:      event,
  }).then(({ error }) => {
    if (error) console.warn('[RC Webhook] Log-Insert fehlgeschlagen:', error.message);
  });

  console.log(`[RC Webhook] OK ${coinsToCredit} Coins für User ${supabaseUserId} gutgeschrieben`);
  return new Response(JSON.stringify({ ok: true, coins_credited: coinsToCredit }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
