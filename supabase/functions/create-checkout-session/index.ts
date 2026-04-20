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
  let body: { tier_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
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
  // Automatic Payment Methods = Apple/Google/Card/Link
  form.set('automatic_payment_methods[enabled]', 'true');
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
