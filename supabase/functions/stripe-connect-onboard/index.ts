/**
 * Stripe Connect (Standard) — Verkäufer verbindet sein eigenes Konto
 * 27.08.2026 · Berkat · Übergabe Abschnitt 96
 *
 * WOZU
 * Ab dem zweiten Verkäufer darf kein fremdes Geld mehr über das Konto des
 * Betreibers laufen (ZAG, Übergabe 20). Diese Funktion erzeugt für einen
 * angemeldeten Verkäufer ein eigenes Stripe-Konto und schickt ihn in Stripes
 * eigenes Onboarding.
 *
 * ⚠️ KEIN OAuth. Stripes Doku sagt ausdrücklich: „OAuth wird für neue
 * Connect-Plattformen nicht empfohlen." Der heutige Weg ist
 * `accounts.create` + Account Links — kein `client_id`, keine Redirect-URI im
 * Dashboard, kein Autorisierungscode, kein `state`-Token. Was es nicht gibt,
 * kann auch nicht falsch konfiguriert sein.
 *
 * ZWEI AKTIONEN
 *   { action: 'link' }     → { url }   Onboarding starten oder fortsetzen
 *   { action: 'refresh' }  → { state } Status bei Stripe nachfragen
 *
 * ⚠️ `refresh` ist das SICHERHEITSNETZ, nicht der Hauptweg. Die Wahrheit
 * kommt über den Webhook `account.updated`; diese Aktion existiert für den
 * Moment direkt nach der Rückkehr aus dem Browser, in dem der Webhook noch
 * unterwegs sein kann — und für den Fall, dass er einmal ausfällt.
 *
 * ⚠️ `verify_jwt` bleibt AN. Anders als beim OAuth-Rückweg kommt hier niemand
 * aus dem Browser zurück: Die App ruft die Funktion, der Nutzer ist angemeldet.
 * Ein offener Endpunkt könnte fremde Stripe-Konten erzeugen.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2024-06-20';
const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

/**
 * ⚠️ Der Rückweg geht über die WEBSITE, nicht per `berkat://` direkt.
 *
 * Die App hat zwar ein Schema (`app.json`, `"scheme": "berkat"`), aber Stripe
 * verlangt für Account Links öffentlich erreichbare http(s)-Adressen. Die
 * Seite dort trägt den Knopf zurück in die App — ein Umweg von einem Tipp,
 * dafür einer, der nicht an einer Annahme über Stripes URL-Prüfung hängt.
 */
const SITE = 'https://berkat-live.pages.dev';
const RETURN_URL = `${SITE}/stripe-fertig.html`;
const REFRESH_URL = `${SITE}/stripe-neu.html`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Stripe-Formularaufruf. Eigene Helper, damit der Schlüssel an EINER Stelle steht. */
async function stripePost(
  path: string,
  key: string,
  form: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${STRIPE_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: new URLSearchParams(form).toString(),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function stripeGet(path: string, key: string) {
  const res = await fetch(`${STRIPE_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // ── Umgebung ─────────────────────────────────────────────────────────────
  // ⚠️ Der Schlüssel wird HIER geholt, auf einer Ebene, nicht in einem Zweig.
  // In `create-checkout-session` steckt er zweimal lokal in einem `const`, und
  // ein neuer Zweig dazwischen läuft in die temporale Todeszone → HTTP 500
  // ohne Begründung (Übergabe 3, 15.08.2026).
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!stripeKey || !supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'server_misconfigured' }, 500);
  }

  // ── Wer ruft? ────────────────────────────────────────────────────────────
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthenticated' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: 'unauthenticated' }, 401);
  const user = userRes.user;

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = body.action === 'refresh' ? 'refresh' : 'link';

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Vorhandene Verbindung? Eine je Verkäufer, PK ist `user_id`.
  const { data: existing } = await admin
    .from('berkat_seller_stripe')
    .select('stripe_account_id, charges_enabled, details_submitted')
    .eq('user_id', user.id)
    .maybeSingle();

  let accountId: string | null = existing?.stripe_account_id ?? null;

  // ── Aktion: Status nachfragen ────────────────────────────────────────────
  if (action === 'refresh') {
    if (!accountId) return json({ state: 'none' });

    const acc = await stripeGet(`/accounts/${accountId}`, stripeKey);
    if (!acc.ok) {
      return json({ error: 'stripe_error', detail: acc.body?.error?.message }, 502);
    }

    await admin
      .from('berkat_seller_stripe')
      .update({
        charges_enabled: Boolean(acc.body.charges_enabled),
        details_submitted: Boolean(acc.body.details_submitted),
        disabled_reason: acc.body.requirements?.disabled_reason ?? null,
      })
      .eq('user_id', user.id);

    return json({
      state: acc.body.charges_enabled
        ? 'ready'
        : acc.body.details_submitted
          ? 'pending'
          : 'incomplete',
    });
  }

  // ── Aktion: Onboarding starten oder fortsetzen ───────────────────────────
  if (!accountId) {
    // ⚠️ `type: 'standard'` ist die ganze Entscheidung aus Abschnitt 96: Der
    // Verkäufer ist Händler, trägt seine Gebühren und seine Rückbuchungen
    // selbst, und die Plattform hält nie sein Geld. Bei `express` oder
    // `custom` wäre die Plattform näher am Geld — und damit an ZAG.
    const created = await stripePost('/accounts', stripeKey, {
      type: 'standard',
      email: user.email ?? '',
      'metadata[berkat_user_id]': user.id,
    });
    if (!created.ok) {
      return json({ error: 'stripe_error', detail: created.body?.error?.message }, 502);
    }
    accountId = created.body.id as string;

    // ⚠️ Sofort festhalten, VOR dem Account Link. Bräche die Funktion danach
    // ab, hätte der Verkäufer sonst ein Stripe-Konto, das niemand kennt — und
    // beim nächsten Versuch entstünde ein zweites.
    const { error: insErr } = await admin.from('berkat_seller_stripe').insert({
      user_id: user.id,
      stripe_account_id: accountId,
      charges_enabled: false,
      details_submitted: false,
    });
    if (insErr) {
      return json({ error: 'db_error', detail: insErr.message }, 500);
    }
  }

  const link = await stripePost('/account_links', stripeKey, {
    account: accountId,
    refresh_url: REFRESH_URL,
    return_url: RETURN_URL,
    type: 'account_onboarding',
  });
  if (!link.ok) {
    return json({ error: 'stripe_error', detail: link.body?.error?.message }, 502);
  }

  return json({ url: link.body.url as string });
});
