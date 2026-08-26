/**
 * supabase/functions/create-checkout-session/index.ts
 *
 * Stripe Checkout Session für Web-Coin-Kauf
 *
 * Flow:
 *   1. Authenticated User → POST { tier_id }
 *   2. Tier-Lookup in `coin_pricing_tiers` (active=true)
 *   3. Stripe Checkout Session erzeugen (mode: payment, payment_method_types:
 *      card + apple_pay + google_pay via Payment-Request — Stripe mapt das
 *      automatisch wenn `automatic_payment_methods.enabled=true`)
 *   4. Order-Row in `web_coin_orders` mit status='pending' anlegen
 *   5. Response: { url, order_id } — Web redirected auf Stripe-URL
 *
 * Deploy:
 *   npx supabase functions deploy create-checkout-session
 *
 * Secrets:
 *   STRIPE_SECRET_KEY        — sk_test_... / sk_live_...
 *   STRIPE_SUCCESS_URL       — https://serlo.app/coin-shop/success?session_id={CHECKOUT_SESSION_ID}
 *   STRIPE_CANCEL_URL        — https://serlo.app/coin-shop/cancelled
 *   (Supabase-Standard: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2024-06-20';
const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // ── Auth-Gate ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthenticated' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'server_misconfigured' }, 500);
  }

  // Caller-Identity ermitteln
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return json({ error: 'unauthenticated' }, 401);
  }
  const user = userRes.user;

  // ── Body ────────────────────────────────────────────────────────────────
  let body: { tier_id?: string; order_id?: string; tip_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  // ── Produkt-Bezahlung (echte Ware, z.B. Parfüm) ──────────────────────────
  // Unterschieden vom Coin-Kauf über `order_id` (= bestehende product_orders-
  // Zeile im Status 'payment_requested'). Geld geht direkt auf Zaurs Stripe
  // (er ist Verkäufer) — kein Connect in Phase 1. Webhook erkennt es an
  // metadata.kind = 'product_order'.
  if (body.order_id && typeof body.order_id === 'string') {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: order } = await adminClient
      .from('product_orders')
      // `title` trägt den Namen für Bestellungen ohne products-Zeile —
      // z. B. einen Berkat-Sammelkorb aus mehreren Auktionsartikeln.
      // `cart_id` unterscheidet die beiden Herkünfte, siehe unten.
      .select('id, buyer_id, seller_id, status, amount_eur, currency, product_id, title, cart_id')
      .eq('id', body.order_id)
      .maybeSingle();

    if (!order) return json({ error: 'order_not_found' }, 404);
    if (order.buyer_id !== user.id) return json({ error: 'not_authorized' }, 403);
    if (order.status !== 'payment_requested') return json({ error: 'order_not_payable' }, 409);

    // Zwei Herkünfte, zwei Marken. Nur eine Berkat-Bestellung trägt einen
    // Sammelkorb — `cart_id` ist bei einem Serlo-Produktkauf immer NULL.
    //
    // Warum überhaupt getrennt: Wer bei einer Berkat-Auktion bezahlt hat und
    // danach „serlo.ch" in der Adresszeile liest, zweifelt genau in dem Moment,
    // in dem er gerade Geld überwiesen hat. Ein geteiltes
    // STRIPE_PRODUCT_SUCCESS_URL kann das nicht lösen: Es würde umgekehrt den
    // Parfüm-Kauf auf Berkats Seite schicken.
    const isAuctionCart = Boolean(order.cart_id);
    const brand = isAuctionCart ? 'Berkat' : 'Serlo';

    // product_id ist bei Auktions-Bestellungen NULL — dann greift order.title.
    const { data: product } = order.product_id
      ? await adminClient
          .from('products')
          .select('title, cover_url, description')
          .eq('id', order.product_id)
          .maybeSingle()
      : { data: null };

    const lineItemName = product?.title ?? order.title ?? `${brand} Bestellung`;

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'stripe_not_configured' }, 500);

    // Berkats eigene Bestätigung ist ausdrücklich einzuschalten, nicht Standard.
    // Absichtlich KEINE fest eingebaute Adresse: Ist die Seite noch nicht
    // veröffentlicht, wäre eine tote Seite direkt nach dem Bezahlen schlimmer
    // als eine mit der falschen Marke. Ohne gesetzte Variable bleibt alles wie
    // bisher — das Umstellen und das Veröffentlichen der Seite gehören zusammen.
    //   BERKAT_SUCCESS_URL = https://berkat-live.pages.dev/bezahlt
    //   BERKAT_CANCEL_URL  = https://berkat-live.pages.dev/abgebrochen
    const berkatSuccess = isAuctionCart ? Deno.env.get('BERKAT_SUCCESS_URL') : null;
    const berkatCancel = isAuctionCart ? Deno.env.get('BERKAT_CANCEL_URL') : null;

    // WICHTIG: KEIN Fallback auf STRIPE_SUCCESS_URL/STRIPE_CANCEL_URL (= Coin-Shop-
    // Seiten). Ein Parfüm-Kauf muss auf die dedizierte Produkt-Bestätigung
    // (/shop/success) gehen, nicht auf „Coins gutgeschrieben". Nur ein eigener
    // STRIPE_PRODUCT_*-Override oder der /shop-Default.
    const successUrl =
      berkatSuccess ??
      Deno.env.get('STRIPE_PRODUCT_SUCCESS_URL') ??
      'https://www.serlo.ch/shop/success?session_id={CHECKOUT_SESSION_ID}';
    const cancelUrl =
      berkatCancel ??
      Deno.env.get('STRIPE_PRODUCT_CANCEL_URL') ??
      'https://www.serlo.ch/shop/cancelled';

    const amountCents = Math.round(Number(order.amount_eur) * 100);
    const pform = new URLSearchParams();
    pform.set('mode', 'payment');
    pform.set('success_url', successUrl);
    pform.set('cancel_url', cancelUrl);
    pform.set('client_reference_id', order.id);
    pform.set('customer_email', user.email ?? '');
    pform.set('metadata[kind]', 'product_order');
    pform.set('metadata[order_id]', order.id);
    // Versandadresse von Stripe Checkout einsammeln (DE/AT/CH) → Webhook speichert sie
    pform.set('shipping_address_collection[allowed_countries][0]', 'DE');
    pform.set('shipping_address_collection[allowed_countries][1]', 'AT');
    pform.set('shipping_address_collection[allowed_countries][2]', 'CH');
    pform.set('invoice_creation[enabled]', 'true');
    // Die Rechnung landet beim Käufer im Postfach — dort muss der Absender
    // heißen, bei wem er gekauft hat.
    pform.set('invoice_creation[invoice_data][description]', `${brand}: ${lineItemName}`);
    pform.set('line_items[0][price_data][currency]', order.currency ?? 'eur');
    pform.set('line_items[0][price_data][unit_amount]', String(amountCents));
    pform.set('line_items[0][price_data][product_data][name]', lineItemName);
    // Produktbild → Stripe-Checkout zeigt das Cover als Thumbnail. Das R2-Cover
    // ist WebP; manche Bild-Consumer rendern WebP nicht zuverlässig → on-the-fly
    // über images.weserv.nl zu JPEG konvertieren (gleiches Muster wie die OG-Bilder).
    if (product?.cover_url) {
      const coverJpg =
        `https://images.weserv.nl/?url=${encodeURIComponent(product.cover_url.replace(/^https?:\/\//, ''))}` +
        `&output=jpg&w=600&h=600&fit=cover`;
      pform.set('line_items[0][price_data][product_data][images][0]', coverJpg);
    }
    // Kurz-Beschreibung (erste sinnvolle Zeile, gekappt) als Untertitel auf dem
    // Checkout. Lange Mehrzeilen-Texte würden die Zeile sonst überladen.
    const shortDesc = String(product?.description ?? '')
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean)[0]
      ?.slice(0, 250);
    if (shortDesc) {
      pform.set('line_items[0][price_data][product_data][description]', shortDesc);
    }
    pform.set('line_items[0][quantity]', '1');

    // ── Versand — nur Berkat ─────────────────────────────────────────────────
    // Eine Pauschale pro PAKET, nicht pro Artikel: Drei Zuschläge beim selben
    // Verkäufer sind eine Sendung. Genau dafür gibt es den Sammelkorb, und ohne
    // das wäre eine 5-€-Auktion unmöglich, weil der Versand teurer wäre als die
    // Ware.
    //
    // Die Sätze liegen in `berkat_shipping_rates` (20260815180000), je Zone
    // einer, Verkäufer-Satz schlägt Plattform-Vorgabe. Stripe zeigt sie als
    // Auswahl und meldet den gewählten Betrag als `total_details.amount_shipping`
    // zurück — der Webhook schreibt ihn nach `product_orders.shipping_cents`.
    //
    // Bewusst NICHT in `amount_eur` eingerechnet: Bei Stripe Connect bekommt der
    // Verkäufer die Ware und der Versand wird anders verrechnet. Wer beides
    // addiert, pflückt es in Phase 2 wieder auseinander.
    //
    // Serlos Shop bleibt unberührt — der Zweig hängt an `isAuctionCart`, und
    // `cart_id` ist bei einem Produktkauf immer NULL.
    if (isAuctionCart && order.cart_id) {
      // `…_for_checkout`, nicht die STABLE-Schwester `get_cart_shipping_options`:
      // Diese Fassung reserviert zusätzlich eine Versand-Gutschrift aus einer
      // eingelösten Einladung (Migration 20260816130000) und gibt dann ALLE
      // Zonen zu 0 aus. Die Anzeige in der App ruft weiterhin die STABLE —
      // eine Anzeige darf nichts verbrauchen.
      //
      // Idempotent je Korb: Wird die Kasse für denselben Korb ein zweites Mal
      // geöffnet (abgebrochene Zahlung, Idempotenz-Abfrage in
      // `checkout_auction_cart`), findet sie die bereits reservierte Gutschrift
      // wieder und kostet keine zweite.
      const { data: rates, error: ratesError } = await adminClient.rpc(
        'get_cart_shipping_options_for_checkout',
        { p_cart_id: order.cart_id },
      );
      if (ratesError) {
        // Kein harter Abbruch: Lieber eine Bestellung ohne Versandposten als
        // eine Kasse, die sich gar nicht öffnet. Der Fehler gehört aber ins Log,
        // sonst verschwindet fehlender Versand lautlos.
        console.error('[create-checkout-session] shipping rates', ratesError.message);
      }
      const options = (rates ?? []) as { label: string; cents: number }[];
      options.forEach((rate, i) => {
        const p = `shipping_options[${i}][shipping_rate_data]`;
        pform.set(`${p}[type]`, 'fixed_amount');
        pform.set(`${p}[fixed_amount][amount]`, String(rate.cents));
        pform.set(`${p}[fixed_amount][currency]`, order.currency ?? 'eur');
        pform.set(`${p}[display_name]`, rate.label);
      });
    }

    // ── ⚠️ WOHIN DAS GELD GEHT (27.08.2026, Übergabe 96) ────────────────────
    //
    // Hat der Verkäufer sein EIGENES Stripe-Konto verbunden, entsteht die
    // Zahlung dort — das Konto des Betreibers sieht sie nie. Damit ist die
    // ZAG-Frage vom Tisch: Wer nichts weiterleitet, braucht keine Erlaubnis.
    //
    // ⚠️ AUSDRÜCKLICH NUR FÜR BERKAT (`isAuctionCart`). Ein Nutzer kann in
    // beiden Apps verkaufen; ohne diese Bedingung würde ein SERLO-Produktkauf
    // plötzlich auf seinem verbundenen Konto landen — eine stille Änderung an
    // Serlos Geldweg, und Serlo ist im App Store.
    //
    // ⚠️ `charges_enabled`, nicht bloss „Zeile vorhanden": Ein Konto, das
    // Stripe noch prüft, kann nicht kassieren. Eine Session darauf würde
    // fehlschlagen — und zwar erst vor dem Käufer.
    //
    // Fehlt die Verbindung, bleibt ALLES wie bisher: Die Zahlung läuft auf das
    // Betreiber-Konto. Das ist der heutige Zustand für Zaur und die Testware,
    // und dieser Zweig ändert ihn nicht.
    let connectedAccount: string | null = null;
    if (isAuctionCart && order.seller_id) {
      const { data: sellerStripe } = await adminClient
        .from('berkat_seller_stripe')
        .select('stripe_account_id, charges_enabled')
        .eq('user_id', order.seller_id)
        .maybeSingle();
      if (sellerStripe?.charges_enabled && sellerStripe.stripe_account_id) {
        connectedAccount = sellerStripe.stripe_account_id;
      }
    }

    const pStripeRes = await fetch(`${STRIPE_BASE_URL}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION,
        'Idempotency-Key': `product-order-${order.id}`,
        // Der Header ist der ganze Unterschied zwischen „mein Geld" und
        // „sein Geld". Ohne ihn: Plattform-Konto, wie seit jeher.
        ...(connectedAccount ? { 'Stripe-Account': connectedAccount } : {}),
      },
      body: pform.toString(),
    });

    if (!pStripeRes.ok) {
      const errBody = await pStripeRes.text();
      console.error('[create-checkout-session] product stripe error', pStripeRes.status, errBody);
      return json({ error: 'stripe_session_create_failed' }, 502);
    }

    const pSession = (await pStripeRes.json()) as {
      id: string;
      url: string;
      payment_intent?: string | null;
    };

    await adminClient
      .from('product_orders')
      .update({
        stripe_session_id: pSession.id,
        stripe_payment_intent: pSession.payment_intent ?? null,
      })
      .eq('id', order.id);

    return json({ order_id: order.id, session_id: pSession.id, url: pSession.url });
  }

  // ── Trinkgeld (Berkat) ───────────────────────────────────────────────────
  // Eigener Zweig, weil ein Trinkgeld kein Kauf ist: keine Ware, kein Versand,
  // keine Adresse. Die Zeile liegt in `berkat_tips` und wurde vom Client nur
  // ANGEFRAGT — Betrag und Empfänger stehen fest, seit `create_berkat_tip` sie
  // geprüft hat. Hier wird nichts mehr aus dem Body übernommen außer der ID.
  if (body.tip_id && typeof body.tip_id === 'string') {
    // ⚠️ `stripeKey` MUSS hier lokal geholt werden. Die Datei deklariert ihn
    // zweimal mit `const` — einmal im Bestellzweig, einmal im Coin-Zweig ganz
    // unten. Dieser Zweig liegt dazwischen und griffe sonst auf die spätere
    // Deklaration zu, die zu diesem Zeitpunkt noch in der temporalen Todeszone
    // liegt: ReferenceError, unbehandelt, HTTP 500. TypeScript sieht das nicht,
    // weil die Variable im Gültigkeitsbereich sehr wohl existiert.
    // (Am 15.08.2026 genau so passiert.)
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'server_misconfigured' }, 500);

    const tipClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: tip } = await tipClient
      .from('berkat_tips')
      .select('id, sender_id, recipient_id, amount_cents, currency, message, status')
      .eq('id', body.tip_id)
      .maybeSingle();

    if (!tip) return json({ error: 'tip_not_found' }, 404);
    if (tip.sender_id !== user.id) return json({ error: 'not_authorized' }, 403);
    if (tip.status !== 'pending') return json({ error: 'tip_not_payable' }, 409);

    const { data: recipient } = await tipClient
      .from('profiles')
      .select('username')
      .eq('id', tip.recipient_id)
      .maybeSingle();
    const toName = recipient?.username ?? 'den Verkäufer';

    // Dieselben Rückkehr-Seiten wie beim Sammelkorb — ein Trinkgeld ist für
    // den Zahlenden derselbe Vorgang, nur ohne Ware.
    const successUrl =
      Deno.env.get('BERKAT_SUCCESS_URL') ?? `${Deno.env.get('SITE_URL') ?? ''}/bezahlt`;
    const cancelUrl =
      Deno.env.get('BERKAT_CANCEL_URL') ?? `${Deno.env.get('SITE_URL') ?? ''}/abgebrochen`;

    const tform = new URLSearchParams();
    tform.set('mode', 'payment');
    tform.set('success_url', successUrl);
    tform.set('cancel_url', cancelUrl);
    tform.set('client_reference_id', tip.id);
    tform.set('metadata[kind]', 'berkat_tip');
    tform.set('metadata[tip_id]', tip.id);
    tform.set('metadata[sender_id]', tip.sender_id);
    tform.set('metadata[recipient_id]', tip.recipient_id);
    tform.set('line_items[0][price_data][currency]', tip.currency ?? 'eur');
    tform.set('line_items[0][price_data][unit_amount]', String(tip.amount_cents));
    tform.set('line_items[0][price_data][product_data][name]', `Trinkgeld für ${toName}`);
    if (tip.message) {
      tform.set('line_items[0][price_data][product_data][description]', String(tip.message).slice(0, 200));
    }
    tform.set('line_items[0][quantity]', '1');

    // ── ⚠️ TRINKGELD IST DER ZWEITE GELDWEG (27.08.2026, Übergabe 96) ───────
    //
    // Er wurde beim Entwurf der Connect-Entscheidung zuerst übersehen, und er
    // ist der heiklere von beiden: Ein Trinkgeld ist von vornherein Geld, das
    // jemand anderem zugedacht ist. Läuft es über das Betreiber-Konto, nimmt
    // der Betreiber es für den Streamer entgegen — genau das, was Connect
    // vermeiden soll.
    //
    // Empfänger ist `tip.recipient_id`, nicht der Zahlende. Ohne verbundenes
    // Konto bleibt es wie bisher.
    let tipAccount: string | null = null;
    {
      const { data: recipientStripe } = await tipClient
        .from('berkat_seller_stripe')
        .select('stripe_account_id, charges_enabled')
        .eq('user_id', tip.recipient_id)
        .maybeSingle();
      if (recipientStripe?.charges_enabled && recipientStripe.stripe_account_id) {
        tipAccount = recipientStripe.stripe_account_id;
      }
    }

    const tRes = await fetch(`${STRIPE_BASE_URL}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION,
        // Ein zweiter Tipp auf „Bezahlen" erzeugt dieselbe Stripe-Sitzung,
        // nicht eine zweite Abbuchung.
        'Idempotency-Key': `berkat-tip-${tip.id}`,
        ...(tipAccount ? { 'Stripe-Account': tipAccount } : {}),
      },
      body: tform.toString(),
    });

    if (!tRes.ok) {
      const errBody = await tRes.text();
      console.error('[create-checkout-session] tip stripe error', tRes.status, errBody);
      // Stripes Begründung mitgeben. Sie ist eine Validierungsmeldung, kein
      // Geheimnis — und ohne sie sieht im Client jeder Fehlschlag gleich aus.
      // Am 15.08.2026 hat genau das die Suche unnötig lang gemacht.
      let detail = '';
      try {
        detail = String(JSON.parse(errBody)?.error?.message ?? '').slice(0, 300);
      } catch {
        detail = errBody.slice(0, 300);
      }
      return json({ error: 'stripe_session_create_failed', detail }, 502);
    }

    const tSession = (await tRes.json()) as { id: string; url: string };

    await tipClient
      .from('berkat_tips')
      .update({ stripe_session_id: tSession.id })
      .eq('id', tip.id);

    return json({ tip_id: tip.id, session_id: tSession.id, url: tSession.url });
  }

  const tierId = body.tier_id;
  if (!tierId || typeof tierId !== 'string') {
    return json({ error: 'invalid_tier_id' }, 400);
  }

  // ── Tier lookup (Service-Role umgeht RLS) ────────────────────────────────
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: tier, error: tierErr } = await adminClient
    .from('coin_pricing_tiers')
    .select('id, coins, bonus_coins, price_cents, currency, stripe_price_id, active')
    .eq('id', tierId)
    .eq('active', true)
    .maybeSingle();

  if (tierErr || !tier) {
    return json({ error: 'tier_not_found' }, 404);
  }

  // ── Simple Rate-Limit: max 10 pending orders pro User pro Stunde ────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: pendingCount } = await adminClient
    .from('web_coin_orders')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .gte('created_at', oneHourAgo);
  if ((pendingCount ?? 0) >= 10) {
    return json({ error: 'too_many_pending_orders' }, 429);
  }

  // ── Stripe Session erzeugen ─────────────────────────────────────────────
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return json({ error: 'stripe_not_configured' }, 500);
  }

  const successUrl =
    Deno.env.get('STRIPE_SUCCESS_URL') ??
    'https://serlo.app/coin-shop/success?session_id={CHECKOUT_SESSION_ID}';
  const cancelUrl = Deno.env.get('STRIPE_CANCEL_URL') ?? 'https://serlo.app/coin-shop/cancelled';

  // Order-Row VOR dem Stripe-Call anlegen — so können wir die internal-ID
  // als `client_reference_id` an Stripe geben und im Webhook sauber matchen.
  const { data: order, error: orderErr } = await adminClient
    .from('web_coin_orders')
    .insert({
      user_id: user.id,
      tier_id: tier.id,
      coins: tier.coins,
      bonus_coins: tier.bonus_coins,
      price_cents: tier.price_cents,
      currency: tier.currency,
      status: 'pending',
    })
    .select('id')
    .single();

  if (orderErr || !order) {
    return json({ error: 'order_create_failed' }, 500);
  }

  // Stripe Checkout Session bauen. Wir bevorzugen einen vordefinierten
  // Price (stripe_price_id in DB), Fallback ist `price_data` inline.
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', successUrl);
  form.set('cancel_url', cancelUrl);
  form.set('client_reference_id', order.id);
  form.set('customer_email', user.email ?? '');
  // Metadata: Order-ID + User-ID + Tier-ID — Webhook nutzt das als Idempotenz
  form.set('metadata[order_id]', order.id);
  form.set('metadata[user_id]', user.id);
  form.set('metadata[tier_id]', tier.id);
  form.set('metadata[coins]', String(tier.coins));
  form.set('metadata[bonus_coins]', String(tier.bonus_coins));
  // Zahlungsarten NICHT setzen — `automatic_payment_methods` ist ein
  // PaymentIntent-Parameter, NICHT für Checkout-Sessions (führte zu Stripe 400
  // "unknown parameter"). Checkout nutzt automatisch die im Stripe-Dashboard
  // aktivierten Methoden (Card/Apple/Google/Link/Klarna/SEPA).
  // Invoice immer aktiv — wichtig für Accounting
  form.set('invoice_creation[enabled]', 'true');
  form.set('invoice_creation[invoice_data][description]',
    `Serlo Coin-Kauf: ${tier.coins + tier.bonus_coins} Coins`);

  if (tier.stripe_price_id) {
    form.set('line_items[0][price]', tier.stripe_price_id);
    form.set('line_items[0][quantity]', '1');
  } else {
    form.set('line_items[0][price_data][currency]', tier.currency);
    form.set('line_items[0][price_data][unit_amount]', String(tier.price_cents));
    form.set(
      'line_items[0][price_data][product_data][name]',
      `${(tier.coins + tier.bonus_coins).toLocaleString('de-DE')} Serlo Coins`,
    );
    form.set(
      'line_items[0][price_data][product_data][description]',
      tier.bonus_coins > 0
        ? `${tier.coins.toLocaleString('de-DE')} Coins + ${tier.bonus_coins.toLocaleString('de-DE')} Bonus`
        : `${tier.coins.toLocaleString('de-DE')} Coins`,
    );
    form.set('line_items[0][quantity]', '1');
  }

  const stripeRes = await fetch(`${STRIPE_BASE_URL}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
      // Idempotency: Order-ID benutzen — Request gleiche Order-ID = gleicher Session-Return
      'Idempotency-Key': `coin-order-${order.id}`,
    },
    body: form.toString(),
  });

  if (!stripeRes.ok) {
    const errBody = await stripeRes.text();
    console.error('[create-checkout-session] Stripe error', stripeRes.status, errBody);
    // Order auf 'failed' setzen damit sie nicht ewig pending bleibt
    await adminClient
      .from('web_coin_orders')
      .update({ status: 'failed', failed_reason: `stripe_${stripeRes.status}` })
      .eq('id', order.id);
    return json({ error: 'stripe_session_create_failed' }, 502);
  }

  const session = (await stripeRes.json()) as {
    id: string;
    url: string;
    payment_intent?: string | null;
  };

  // Session-ID in Order speichern für späteres Matching im Webhook
  await adminClient
    .from('web_coin_orders')
    .update({
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent ?? null,
    })
    .eq('id', order.id);

  return json({
    order_id: order.id,
    session_id: session.id,
    url: session.url,
  });
});

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
