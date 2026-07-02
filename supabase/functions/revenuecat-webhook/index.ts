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
 * 3. Supabase Secrets setzen:
 *    npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=...
 *
 * Phase 3 — Apple/Google Server-Verifikation:
 *   Apple:  APP_STORE_KEY_ID, APP_STORE_ISSUER_ID, APP_STORE_PRIVATE_KEY (PEM, base64)
 *   Google: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (base64-encoded JSON)
 *   Aktivierung: ENABLE_RECEIPT_VERIFY=true
 *
 * Sicherheitsschichten (von außen nach innen):
 *  1. Bearer-Auth (REVENUECAT_WEBHOOK_SECRET) — fail-closed: fehlt das
 *     Secret, antwortet die Function 500 statt die Prüfung zu überspringen
 *  2. Replay-Schutz (max 10 Min Alter, kein Future-Timestamp)
 *  3. Rate-Limit (max 20 Gutschriften/Stunde pro User)
 *  4. Idempotenz-CLAIM: INSERT in coin_purchases (UNIQUE transaction_id)
 *     VOR credit_coins — parallele Duplikat-Zustellungen verlieren am
 *     Constraint (23505) und schreiben nicht doppelt gut
 *  5. Apple/Google Store-API Receipt-Verify (Phase 3, opt-in via ENV)
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
  'NON_SUBSCRIPTION_PURCHASE',
  'INITIAL_PURCHASE',
]);

// ─── Härtungs-Konstanten ──────────────────────────────────────────────────────
const MAX_EVENT_AGE_MS  = 10 * 60 * 1000; // 10 Min
const RATE_LIMIT_PER_HR = 20;

const RECEIPT_VERIFY_ENABLED = Deno.env.get('ENABLE_RECEIPT_VERIFY') === 'true';

// ─── Apple App Store Server API ───────────────────────────────────────────────
/**
 * Verifiziert einen Apple In-App-Kauf via App Store Server API v1.
 *
 * Benötigte Secrets (Supabase):
 *   APP_STORE_KEY_ID     — Key ID aus App Store Connect (10 Zeichen)
 *   APP_STORE_ISSUER_ID  — Issuer ID aus App Store Connect (UUID)
 *   APP_STORE_PRIVATE_KEY — Private Key (.p8), base64-encoded PEM ohne Header/Footer
 *
 * Wie bekomme ich die Keys?
 *   App Store Connect → Users and Access → Integrations → In-App Purchase
 *   → Generate Key → .p8 herunterladen, Key ID + Issuer ID notieren.
 *
 * npx supabase secrets set \
 *   APP_STORE_KEY_ID=XXXXXXXXXX \
 *   APP_STORE_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
 *   APP_STORE_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8 | grep -v '^-' | tr -d '\n')"
 */
async function verifyAppleReceipt(
  transactionId: string,
  productId: string,
): Promise<{ valid: boolean; reason?: string }> {
  const keyId     = Deno.env.get('APP_STORE_KEY_ID');
  const issuerId  = Deno.env.get('APP_STORE_ISSUER_ID');
  const privKeyB64= Deno.env.get('APP_STORE_PRIVATE_KEY');

  if (!keyId || !issuerId || !privKeyB64) {
    console.warn('[RC Webhook] Apple-Verify: Secrets fehlen — skip');
    return { valid: true, reason: 'secrets_missing_skip' };
  }

  try {
    // ── JWT für App Store Server API bauen (ES256) ──────────────────────────
    const header  = { alg: 'ES256', kid: keyId, typ: 'JWT' };
    const now     = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuerId,
      iat: now,
      exp: now + 60,           // 1 Minute — nur für diesen Request
      aud: 'appstoreconnect-v1',
      bid: 'com.vibesapp.vibes',
    };

    const b64url = (obj: unknown) =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const signingInput = `${b64url(header)}.${b64url(payload)}`;

    // PEM rekonstruieren (base64-decodierter raw PKCS#8)
    const rawKey  = Uint8Array.from(atob(privKeyB64), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', rawKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, ['sign'],
    );

    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      new TextEncoder().encode(signingInput),
    );

    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jwt = `${signingInput}.${sigB64}`;

    // ── App Store Server API anfragen ───────────────────────────────────────
    // Produktion: api.storekit.itunes.apple.com
    // Sandbox:    api.storekit-sandbox.itunes.apple.com
    const url = `https://api.storekit.itunes.apple.com/inApps/v1/transactions/${transactionId}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (resp.status === 404) {
      // Transaktion nicht in Prod → Sandbox versuchen
      const sandboxResp = await fetch(
        `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/${transactionId}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      if (!sandboxResp.ok) {
        console.error(`[RC Webhook] Apple Sandbox 404: txn=${transactionId}`);
        return { valid: false, reason: `apple_txn_not_found_status_${sandboxResp.status}` };
      }
      const sandboxData = await sandboxResp.json();
      return validateAppleTransactionData(sandboxData, transactionId, productId);
    }

    if (!resp.ok) {
      console.error(`[RC Webhook] Apple API Error ${resp.status}: txn=${transactionId}`);
      return { valid: false, reason: `apple_api_error_${resp.status}` };
    }

    const data = await resp.json();
    return validateAppleTransactionData(data, transactionId, productId);

  } catch (err) {
    console.error('[RC Webhook] verifyAppleReceipt Fehler:', err);
    // Bei technischem Fehler: fail-open (Coin wird trotzdem gutgeschrieben)
    // Besser ein legitimer Kauf geht durch als ein echter User frustriert wird.
    // Idempotenz + Rate-Limit schützen vor Missbrauch.
    return { valid: true, reason: 'verify_error_fail_open' };
  }
}

function validateAppleTransactionData(
  data: any,
  transactionId: string,
  productId: string,
): { valid: boolean; reason?: string } {
  // App Store Server API v1 gibt signedTransactionInfo zurück (JWS).
  // Für einfache Validierung: das decoded payload prüfen.
  // Vollständige JWS-Signatur-Prüfung wäre Additional Security,
  // aber da wir das API selbst angefragt haben (MITM durch Apple), reicht das.
  const txn = data?.signedTransactionInfo
    ? parseJwsPayload(data.signedTransactionInfo)
    : data;

  if (!txn) return { valid: false, reason: 'apple_no_transaction_data' };

  // Produkt-ID muss übereinstimmen
  if (txn.productId && txn.productId !== productId) {
    console.error(`[RC Webhook] Apple: Produkt-ID Mismatch — erwartet=${productId} bekommen=${txn.productId}`);
    return { valid: false, reason: 'apple_product_id_mismatch' };
  }

  // Kauf darf nicht revoked sein
  if (txn.revocationDate) {
    console.error(`[RC Webhook] Apple: Transaktion revoked — txn=${transactionId}`);
    return { valid: false, reason: 'apple_transaction_revoked' };
  }

  return { valid: true };
}

/** Dekodiert den Payload-Teil eines JWS (base64url, kein Verify) */
function parseJwsPayload(jws: string): any {
  try {
    const parts = jws.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

// ─── Google Play Developer API ───────────────────────────────────────────────
/**
 * Verifiziert einen Google Play Kauf via androidpublisher API v3.
 *
 * Benötigtes Secret:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON — base64-encoded Service Account JSON
 *
 * Service Account anlegen:
 *   Google Cloud Console → IAM → Service Accounts → Create
 *   → Key (JSON) downloaden
 *   Google Play Console → Setup → API Access → Grant Access → Permissions: "View financial data"
 *
 * npx supabase secrets set \
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="$(base64 -i service-account.json)"
 */
async function verifyGoogleReceipt(
  purchaseToken: string,
  productId: string,
  packageName: string,
): Promise<{ valid: boolean; reason?: string }> {
  const saJsonB64 = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');

  if (!saJsonB64) {
    console.warn('[RC Webhook] Google-Verify: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON fehlt — skip');
    return { valid: true, reason: 'secrets_missing_skip' };
  }

  try {
    // ── Service Account JSON dekodieren ──────────────────────────────────────
    const saJson = JSON.parse(atob(saJsonB64));
    const accessToken = await getGoogleAccessToken(saJson);

    if (!accessToken) {
      console.error('[RC Webhook] Google: Kein Access Token erhalten');
      return { valid: true, reason: 'google_auth_failed_fail_open' };
    }

    // ── androidpublisher API anfragen ─────────────────────────────────────────
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      console.error(`[RC Webhook] Google API Error ${resp.status}: token=${purchaseToken.slice(0, 8)}…`);
      // 404 = Token nicht gefunden → echter Fraud-Indikator
      if (resp.status === 404) {
        return { valid: false, reason: 'google_purchase_not_found' };
      }
      // Andere Fehler: fail-open (Quota, Netzwerk, etc.)
      return { valid: true, reason: `google_api_error_${resp.status}_fail_open` };
    }

    const purchase = await resp.json();

    // purchaseState: 0 = Purchased, 1 = Canceled, 2 = Pending
    if (purchase.purchaseState !== 0) {
      console.error(`[RC Webhook] Google: Kauf nicht abgeschlossen — state=${purchase.purchaseState}`);
      return { valid: false, reason: `google_purchase_state_${purchase.purchaseState}` };
    }

    // consumptionState: 0 = Not consumed, 1 = Consumed
    // Consumables müssen consumed werden; RevenueCat macht das normalerweise.
    // Wir akzeptieren beide States (RC kann vor oder nach Webhook consumieren).

    return { valid: true };

  } catch (err) {
    console.error('[RC Webhook] verifyGoogleReceipt Fehler:', err);
    return { valid: true, reason: 'verify_error_fail_open' };
  }
}

/** Holt einen Google OAuth2 Access Token via Service Account (JWT flow) */
async function getGoogleAccessToken(sa: any): Promise<string | null> {
  try {
    const now    = Math.floor(Date.now() / 1000);
    const header  = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss:   sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud:   'https://oauth2.googleapis.com/token',
      iat:   now,
      exp:   now + 60,
    };

    const b64url = (obj: unknown) =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const signingInput = `${b64url(header)}.${b64url(payload)}`;

    // RSA Private Key laden (PKCS#8 PEM → SubtleCrypto)
    const pemBody = sa.private_key
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
    const rawKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', rawKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign'],
    );

    const sig = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput),
    );
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jwt = `${signingInput}.${sigB64}`;

    // Token gegen Google OAuth2 eintauschen
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion:  jwt,
      }),
    });

    if (!tokenResp.ok) return null;
    const tokenData = await tokenResp.json();
    return tokenData.access_token ?? null;

  } catch (err) {
    console.error('[RC Webhook] getGoogleAccessToken Fehler:', err);
    return null;
  }
}

// ─── Hauptlogik ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // ── Authorization (fail-closed) ──────────────────────────────────────────────
  // Die Function läuft mit verify_jwt=false (RevenueCat sendet kein Supabase-JWT)
  // — die Bearer-Prüfung hier ist damit die EINZIGE Auth-Schicht. Fehlt das
  // Secret in den Env-Vars, muss der Endpoint dicht sein (500), nicht offen:
  // sonst kann jeder mit bekannter User-UUID gefälschte Purchase-Events posten
  // und sich Coins gutschreiben (Security-Review 2026-07-02, Fund #1).
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[RC Webhook] REVENUECAT_WEBHOOK_SECRET nicht gesetzt — Abbruch (fail-closed)');
    return new Response(JSON.stringify({ ok: false, error: 'server_misconfigured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (token !== webhookSecret) {
    console.error('[RC Webhook] Unauthorized');
    return new Response('Unauthorized', { status: 401 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const event = body?.event;
  if (!event) return new Response('No event', { status: 400 });

  const eventType: string = event.type ?? '';
  console.log(`[RC Webhook] Event: ${eventType}`);

  // ── Replay-Schutz ────────────────────────────────────────────────────────────
  const eventTsMs: number | null = typeof event.event_timestamp_ms === 'number'
    ? event.event_timestamp_ms : null;
  if (eventTsMs !== null) {
    const ageMs = Date.now() - eventTsMs;
    if (ageMs > MAX_EVENT_AGE_MS) {
      console.warn(`[RC Webhook] Event zu alt: ${ageMs}ms`);
      return new Response(JSON.stringify({ ok: false, error: 'event_too_old' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (ageMs < -60_000) {
      console.warn(`[RC Webhook] Event-Timestamp in der Zukunft: ${-ageMs}ms`);
      return new Response(JSON.stringify({ ok: false, error: 'event_future' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Nur Purchase-Events verarbeiten ──────────────────────────────────────────
  if (!PURCHASE_EVENTS.has(eventType)) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Produkt + User ────────────────────────────────────────────────────────────
  const productId    : string = event.product_id ?? '';
  const coinsToCredit         = PRODUCT_COINS[productId];
  const appUserId    : string = event.app_user_id ?? '';

  if (!coinsToCredit) {
    console.warn(`[RC Webhook] Unbekannte Produkt-ID: ${productId}`);
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'unknown_product' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!appUserId || appUserId.startsWith('$RC')) {
    console.warn(`[RC Webhook] Kein App User ID: ${appUserId}`);
    return new Response(JSON.stringify({ ok: false, error: 'no_user_id' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Supabase Admin Client ─────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Rate-Limit ────────────────────────────────────────────────────────────────
  const { count: recentCount, error: rateLimitError } = await supabase
    .from('coin_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', appUserId)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (!rateLimitError && (recentCount ?? 0) >= RATE_LIMIT_PER_HR) {
    console.warn(`[RC Webhook] Rate-Limit: User ${appUserId} hat ${recentCount} Käufe/h`);
    return new Response(JSON.stringify({ ok: false, error: 'rate_limit_exceeded' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }

  const transactionId: string = event.transaction_id ?? event.id ?? '';

  // ── Apple/Google Receipt-Verify (Phase 3) ─────────────────────────────────────
  if (RECEIPT_VERIFY_ENABLED) {
    const store: string = event.store ?? '';
    if (store === 'APP_STORE' || store === 'MAC_APP_STORE') {
      const result = await verifyAppleReceipt(transactionId, productId);
      if (!result.valid) {
        console.error(`[RC Webhook] Apple Receipt ungültig: ${result.reason}`);
        return new Response(JSON.stringify({ ok: false, error: 'apple_receipt_invalid', reason: result.reason }), {
          status: 403, headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (store === 'PLAY_STORE') {
      const purchaseToken: string = event.purchase_token ?? transactionId;
      const packageName:   string = event.package_name ?? 'com.vibesapp.vibes';
      const result = await verifyGoogleReceipt(purchaseToken, productId, packageName);
      if (!result.valid) {
        console.error(`[RC Webhook] Google Receipt ungültig: ${result.reason}`);
        return new Response(JSON.stringify({ ok: false, error: 'google_receipt_invalid', reason: result.reason }), {
          status: 403, headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.warn(`[RC Webhook] Unbekannter Store: ${store} — Receipt-Verify übersprungen`);
    }
  }

  // ── Idempotenz-CLAIM (atomar, INSERT-first) ───────────────────────────────────
  // Vorher: SELECT-Check → credit → Log-INSERT. Zwei parallele Zustellungen
  // derselben Transaktion (RevenueCat sendet Duplikate!) sahen beide „nicht
  // vorhanden" und schrieben BEIDE Coins gut — erst der zweite Log-INSERT
  // scheiterte am UNIQUE (Security-Review 2026-07-02, Fund #3).
  //
  // Jetzt: Der INSERT in coin_purchases IST der Claim. Der UNIQUE-Constraint
  // auf transaction_id entscheidet das Race — genau ein Delivery gewinnt,
  // der Verlierer bekommt 23505 und skipt ohne Credit. Gleiche Mechanik wie
  // claim-before-credit im stripe-webhook.
  // Ohne transaction_id (sollte nie passieren): NULL kollidiert in Postgres
  // nicht → kein Claim möglich, Verhalten wie bisher (best effort).
  const { data: claim, error: claimError } = await supabase
    .from('coin_purchases')
    .insert({
      user_id:        appUserId,
      product_id:     productId,
      coins_credited: coinsToCredit,
      transaction_id: transactionId || null,
      event_type:     eventType,
      raw_event:      event,
    })
    .select('id')
    .single();

  if (claimError) {
    if (claimError.code === '23505') {
      console.log(`[RC Webhook] Transaktion bereits verarbeitet (Claim verloren): ${transactionId}`);
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[RC Webhook] Claim-Insert fehlgeschlagen:', claimError.message);
    return new Response(JSON.stringify({ ok: false, error: claimError.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Coins gutschreiben ────────────────────────────────────────────────────────
  const { error: walletError } = await supabase.rpc('credit_coins', {
    p_user_id: appUserId,
    p_coins:   coinsToCredit,
  });

  if (walletError) {
    // Claim zurücknehmen, damit der RevenueCat-Retry sauber erneut durchläuft
    // (sonst hielte die Claim-Zeile den Retry für ein Duplikat → User bekäme
    // seine Coins nie). Scheitert auch das Delete → manuelle Klärung via Logs.
    console.error('[RC Webhook] Wallet-Update fehlgeschlagen:', walletError);
    const { error: rollbackErr } = await supabase
      .from('coin_purchases').delete().eq('id', claim.id);
    if (rollbackErr) {
      console.error(
        `[RC Webhook] CRITICAL: Claim ${claim.id} (txn=${transactionId}) konnte nicht zurückgenommen werden — Coins NICHT gutgeschrieben, manuell klären!`,
        rollbackErr,
      );
    }
    return new Response(JSON.stringify({ ok: false, error: walletError.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`[RC Webhook] ✅ ${coinsToCredit} Coins für User ${appUserId} gutgeschrieben`);
  return new Response(JSON.stringify({ ok: true, coins_credited: coinsToCredit }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
