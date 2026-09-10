-- ═══════════════════════════════════════════════════════════════════════════
-- Der Nachtdienst: Berkat fragt bei Stripe nach, statt zu warten
-- 10.09.2026 · Berkat · Übergabe Abschnitt 100
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WAS DAS LÖST
-- ------------
-- Seit Verkäufer ihr eigenes Stripe verbinden, entsteht die Zahlung auf IHREM
-- Konto. Stripe meldet das nur an einen eigenen **Connect-Endpunkt** — und
-- solange der nicht eingerichtet ist, erfährt Berkat gar nichts:
--
--   Käufer zahlt  →  Geld liegt beim Verkäufer  →  Bestellung bleibt
--   `payment_requested`  →  nach 48 h darf der Verkäufer ihn als
--   Nichtzahler melden.
--
-- Nicht „kein Geld", sondern „Geld da, aber niemand weiß es". Die stille Sorte
-- Fehler, dieselbe Familie wie der R2-Aufräumer, der sieben Wochen nichts tat.
--
-- Diese Migration stellt zwei Wecker, die die Edge Function
-- `berkat-confirm-payment` rufen:
--
--   alle 15 Min  →  liegen gebliebene Bestellungen und Trinkgelder nachfragen
--   stündlich    →  die Kontostände der Verkäufer nachziehen
--
-- ⚠️ Der zweite Wecker ist nicht Kosmetik. Sperrt Stripe einen Verkäufer, bleibt
-- ohne ihn `checkout_enabled = true` — und der nächste Käufer landet auf einer
-- Kasse, die im letzten Moment abbricht. Der Nachfrage-Weg beim Zurückkommen
-- schließt diese Lücke NICHT; nur ein regelmäßiger Blick tut das.
--
-- ── VERHÄLTNIS ZUM CONNECT-WEBHOOK ──────────────────────────────────────────
-- Der Webhook bleibt der schnellere und bessere Weg, und der Code dafür steht
-- (`stripe-webhook` prüft zwei Geheimnisse). Sobald er eingerichtet ist, läuft
-- der Nachtdienst weitgehend ins Leere — und genau das soll er. Ein Netz, das
-- nie fängt, ist ein gutes Netz. Abschalten muss man ihn dann nicht.
--
-- ── VORAUSSETZUNG ───────────────────────────────────────────────────────────
--   supabase functions deploy berkat-confirm-payment
--   vault: `service_role_key` muss gesetzt sein (steht seit den
--          Auktions-Erinnerungen, `20260819160000`).

BEGIN;

-- ─── Ein Wecker klingelt ───────────────────────────────────────────────────
--
-- Fire-and-forget über pg_net, wie bei den Auktions-Erinnerungen und dem
-- Web-Push. Antwortet die Function nicht, ist das kein Drama: Der nächste
-- Durchgang findet dieselben Zeilen wieder — die Function ist idempotent, weil
-- sie durch dieselben Claim-before-update-Handler schreibt wie der Webhook.

CREATE OR REPLACE FUNCTION public.berkat_ask_stripe(p_sweep text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
   WHERE name = 'service_role_key'
   LIMIT 1;

  -- ⚠️ Ohne Schlüssel NICHT rufen. Die Function weist den Ruf ohnehin mit 403
  -- ab; ein Ruf ins Leere alle 15 Minuten wäre nur Rauschen in den Logs, in dem
  -- ein echter Fehler untergeht.
  IF v_key IS NULL THEN
    RAISE WARNING 'berkat_ask_stripe: service_role_key fehlt im Vault — übersprungen';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := 'https://llymwqfgujwkoxzqxrlm.supabase.co/functions/v1/berkat-confirm-payment',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('sweep', p_sweep),
    -- Ein Durchgang holt bis zu 50 Bestellungen einzeln bei Stripe ab. 30
    -- Sekunden sind großzügig; pg_net wartet ohnehin nicht auf die Antwort,
    -- die Zahl begrenzt nur, wie lange die Verbindung offen bleiben darf.
    timeout_milliseconds := 30000
  );
EXCEPTION WHEN OTHERS THEN
  -- Ein Wecker, der klemmt, darf den Cron-Lauf nicht rot färben.
  RAISE WARNING 'berkat_ask_stripe(%) fehlgeschlagen: %', p_sweep, SQLERRM;
END $$;

ALTER FUNCTION public.berkat_ask_stripe(text) OWNER TO postgres;

-- Niemand außer dem Cron ruft das. `anon` und `authenticated` haben hier nichts
-- verloren — die Function trägt den Dienstschlüssel im Rumpf.
REVOKE ALL ON FUNCTION public.berkat_ask_stripe(text) FROM PUBLIC, anon, authenticated;


-- ─── Die zwei Wecker stellen ───────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job
     WHERE jobname IN ('berkat-confirm-payments', 'berkat-confirm-accounts');

    PERFORM cron.schedule(
      'berkat-confirm-payments',
      '*/15 * * * *',
      $cron$SELECT public.berkat_ask_stripe('payments');$cron$
    );

    PERFORM cron.schedule(
      'berkat-confirm-accounts',
      '7 * * * *',
      $cron$SELECT public.berkat_ask_stripe('accounts');$cron$
    );

    RAISE NOTICE 'Nachtdienst läuft: Zahlungen alle 15 Min, Konten stündlich';
  ELSE
    RAISE NOTICE 'pg_cron fehlt — der Nachtdienst läuft NICHT';
  END IF;
END $$;

COMMIT;

-- ─── Bewusst nicht gebaut ──────────────────────────────────────────────────
--
-- Serlos Produktkäufe mitzunehmen. Sie laufen über das Plattform-Konto, dessen
-- Webhook seit Monaten arbeitet. Sie hier stillschweigend mit anzufassen wäre
-- eine Verhaltensänderung an einem Produkt, das im App Store steht — dieselbe
-- Linie, aus der `notify_order_shipped` auf Berkat begrenzt wurde. Die Function
-- filtert deshalb auf `cart_id IS NOT NULL`.
--
-- Abgelaufene Körbe verfallen lassen. Eine Stripe-Sitzung verfällt nach 24 h,
-- die Bestellung bleibt danach `payment_requested` — und genau so soll es sein:
-- Der Korb steht weiter unter „Konto" und lässt sich erneut bezahlen. Das ist
-- seit dem 15.08. beschriebenes Verhalten, keine Nachlässigkeit.
--
-- Eine Zeile in `berkat_seller_stripe` löschen, wenn Stripe das Konto nicht
-- mehr kennt. Das ist Sache von `account.application.deauthorized`. Raten wäre
-- teuer: Eine tote Zeile schadet niemandem, eine gelöschte nimmt dem Verkäufer
-- stillschweigend den Kaufknopf.
