-- ═══════════════════════════════════════════════════════════════════════════
-- Stripe Connect (Standard) — der Verkäufer bekommt sein Geld selbst
-- 27.08.2026 · Berkat · Übergabe Abschnitt 96
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WOZU
-- ----
-- Bis heute läuft JEDER Euro über das Stripe-Konto des Betreibers — Bestellung,
-- Trinkgeld, Coins. Solange der Betreiber der einzige Verkäufer ist, ist das
-- richtig. Beim zweiten Verkäufer wäre es Finanztransfergeschäft und nach ZAG
-- erlaubnispflichtig; genau deshalb steht `checkout_enabled` seit
-- `20260816200000` als Schranke davor.
--
-- Zaurs Entscheidung vom 27.08.2026: **kein Käuferschutz-Versprechen, Bürgen
-- statt Garantie.** Damit ist Connect **Standard** der Weg — der Käufer zahlt
-- direkt auf das Konto des Verkäufers, das Betreiber-Konto sieht das Geld nie,
-- und die ZAG-Frage stellt sich nicht mehr.
--
-- ── ⚠️ WARUM EINE EIGENE TABELLE UND NICHT ZWEI SPALTEN AN `berkat_sellers` ──
--
-- Der naheliegende Weg wäre `ALTER TABLE berkat_sellers ADD COLUMN
-- stripe_account_id`. Dagegen spricht die Lese-Policy jener Tabelle, und sie
-- ist dort mit Absicht so:
--
--     CREATE POLICY berkat_sellers_select ... USING (true)
--
-- Das ist richtig für Impressumsangaben — die MÜSSEN öffentlich sein (§ 5 DDG).
-- Es heisst aber auch: **jede neue Spalte dort ist sofort für jeden lesbar,
-- angemeldet oder nicht.** Eine Zahlungs-Kontoverbindung gehört nicht dorthin.
--
-- Der zweite Weg wäre ein spaltenweises `REVOKE SELECT (stripe_account_id)`.
-- **Das wäre ein Fehler**: Postgres löst dabei das Tabellen-Recht auf und
-- schreibt Einzelrechte für die heute vorhandenen Spalten — `berkat_sellers`
-- würde damit zur sechsten Tabelle mit eingefrorener Spaltenliste, und jede
-- künftige Spalte dort bräuchte ein eigenes GRANT (CLAUDE.md, Regel 11; die
-- Falle hat am 14.08. `live_sessions.app` und am 16.08. `profiles.banner_url`
-- erwischt).
--
-- Eine eigene Tabelle mit eigener Policy löst beides und folgt dem Muster, das
-- `user_whip_ingresses` für den OBS-Schlüssel schon verwendet.
--
-- ── ⚠️ WAS HIER NICHT STEHT ─────────────────────────────────────────────────
--
-- **Kein `access_token`, kein `refresh_token`.** Der heutige Weg
-- (`accounts.create` + Account Links) braucht keine — die Plattform handelt
-- über den eigenen Secret Key plus den `Stripe-Account`-Header. OAuth mit
-- `client_id` ist für neue Plattformen ausdrücklich nicht mehr empfohlen.
-- Was nicht gespeichert wird, kann auch nicht auslaufen oder geleakt werden.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Die Tabelle ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.berkat_seller_stripe (
  user_id           uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Die verbundene Konto-ID (`acct_…`). Eindeutig, weil ein Stripe-Konto nicht
  -- an zwei Verkäuferprofilen hängen darf — sonst bekäme der Falsche das Geld.
  stripe_account_id text NOT NULL UNIQUE,

  -- ⚠️ Was Stripe sagt, nicht was wir hoffen.
  -- `details_submitted` heisst „Formular ausgefüllt", `charges_enabled` heisst
  -- „darf tatsächlich kassieren". Die beiden fallen auseinander: Stripe prüft
  -- nach der Abgabe weiter, und bei Rückfragen bleibt `charges_enabled` false,
  -- obwohl der Verkäufer sich fertig fühlt. Nur die zweite Spalte darf einen
  -- Kaufknopf erzeugen.
  charges_enabled   boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,

  -- Warum Stripe blockiert, falls es blockiert — für den Hinweis in der App.
  disabled_reason   text,

  connected_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.berkat_seller_stripe IS
  'Verbundenes Stripe-Konto je Berkat-Verkäufer (Connect Standard). Getrennt '
  'von berkat_sellers, weil dessen Lese-Policy bewusst USING(true) ist.';

-- Zeitstempel pflegen, Muster aus `20260816200000`.
CREATE OR REPLACE FUNCTION public.berkat_seller_stripe_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_berkat_seller_stripe_touch ON public.berkat_seller_stripe;
CREATE TRIGGER trg_berkat_seller_stripe_touch
  BEFORE UPDATE ON public.berkat_seller_stripe
  FOR EACH ROW EXECUTE FUNCTION public.berkat_seller_stripe_touch();


-- ─── 2. Rechte: eigene Zeile lesen, schreiben darf niemand ──────────────────
--
-- ⚠️ Ausdrücklich NICHT `USING (true)`. Wer bei wem kaufen kann, sagt
-- `berkat_sellers.checkout_enabled` — das ist öffentlich und reicht. Dass
-- Verkäufer X sein Konto `acct_1ABC…` verbunden hat, geht Fremde nichts an.

ALTER TABLE public.berkat_seller_stripe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS berkat_seller_stripe_select_own ON public.berkat_seller_stripe;
CREATE POLICY berkat_seller_stripe_select_own ON public.berkat_seller_stripe
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Geschrieben wird ausschliesslich serverseitig (Edge Function mit
-- service_role). Ein Client, der seine eigene `stripe_account_id` setzen
-- könnte, könnte auch eine FREMDE eintragen — und bekäme fremdes Geld.
REVOKE INSERT, UPDATE, DELETE ON public.berkat_seller_stripe FROM anon, authenticated;
GRANT SELECT ON public.berkat_seller_stripe TO authenticated;


-- ─── 3. Die Ableitung: Stripe entscheidet über den Kaufknopf ────────────────
--
-- `checkout_enabled` bleibt die EINZIGE Wahrheit über den Kaufweg — daran
-- ändert sich nichts, und keiner der vier Wächter aus `20260823120000` muss
-- angefasst werden. Neu ist nur, WER die Spalte pflegt:
--
--   • Betreiber und Testware:   von Hand, wie bisher (keine Zeile hier)
--   • jeder verbundene Verkäufer: dieser Trigger, aus `charges_enabled`
--
-- ⚠️ Die Richtung ist Absicht: Der Trigger schaltet ein UND aus. Sperrt Stripe
-- ein Konto (Rückfrage, Prüfung, Selbstauflösung), fällt der Kaufknopf
-- automatisch weg. Eine Freigabe, die nur einschaltet, wäre eine Falle: Sie
-- liesse Käufer bei jemandem bezahlen, der das Geld nicht mehr empfangen kann.

CREATE OR REPLACE FUNCTION public.berkat_sync_checkout_enabled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  -- Eine Verkäuferzeile kann fehlen: Wer sein Stripe-Konto verbindet, bevor er
  -- den Anbietertyp erklärt hat, hätte sonst keinen Platz für das Ergebnis.
  INSERT INTO public.berkat_sellers (user_id, checkout_enabled)
  VALUES (NEW.user_id, NEW.charges_enabled)
  ON CONFLICT (user_id) DO UPDATE
     SET checkout_enabled = NEW.charges_enabled;

  RETURN NEW;
END $$;

ALTER FUNCTION public.berkat_sync_checkout_enabled() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_berkat_sync_checkout ON public.berkat_seller_stripe;
CREATE TRIGGER trg_berkat_sync_checkout
  AFTER INSERT OR UPDATE OF charges_enabled ON public.berkat_seller_stripe
  FOR EACH ROW EXECUTE FUNCTION public.berkat_sync_checkout_enabled();

-- Trennt der Verkäufer sein Konto wieder (`account.application.deauthorized`),
-- verschwindet die Zeile — und mit ihr muss der Kaufknopf verschwinden.
CREATE OR REPLACE FUNCTION public.berkat_revoke_checkout_enabled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.berkat_sellers
     SET checkout_enabled = false
   WHERE user_id = OLD.user_id;
  RETURN OLD;
END $$;

ALTER FUNCTION public.berkat_revoke_checkout_enabled() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_berkat_revoke_checkout ON public.berkat_seller_stripe;
CREATE TRIGGER trg_berkat_revoke_checkout
  AFTER DELETE ON public.berkat_seller_stripe
  FOR EACH ROW EXECUTE FUNCTION public.berkat_revoke_checkout_enabled();


-- ─── 4. Was der Verkäufer über sich selbst erfahren darf ────────────────────
--
-- Die Konto-ID kommt bewusst NICHT zurück: Der Client braucht sie nirgends —
-- er zeigt einen Zustand an, er ruft Stripe nicht selbst.

CREATE OR REPLACE FUNCTION public.get_my_stripe_connect()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.berkat_seller_stripe%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.berkat_seller_stripe WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'none');
  END IF;

  RETURN jsonb_build_object(
    'state', CASE
               WHEN v_row.charges_enabled       THEN 'ready'
               WHEN v_row.details_submitted     THEN 'pending'
               ELSE                                  'incomplete'
             END,
    'disabled_reason', v_row.disabled_reason,
    'connected_at',    v_row.connected_at
  );
END $$;

REVOKE ALL ON FUNCTION public.get_my_stripe_connect() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_stripe_connect() TO authenticated;


-- ─── 5. Gegenprobe (im SQL-Editor, ändert nichts) ───────────────────────────
--
--   -- a) Fremde Zeile unsichtbar? Aus einer ANGEMELDETEN Sitzung:
--   --    GET /rest/v1/berkat_seller_stripe   → nur die eigene Zeile, sonst leer
--
--   -- b) Schreibweg zu?
--   --    POST /rest/v1/berkat_seller_stripe  → erwartet 401/403, NICHT 201
--
--   -- c) Die Ableitung greift in beide Richtungen:
--   --    UPDATE public.berkat_seller_stripe SET charges_enabled = true  WHERE …;
--   --    SELECT checkout_enabled FROM public.berkat_sellers WHERE …;  -- true
--   --    UPDATE public.berkat_seller_stripe SET charges_enabled = false WHERE …;
--   --    SELECT checkout_enabled FROM public.berkat_sellers WHERE …;  -- false
--
-- ⚠️ Und die Regel aus Abschnitt 86: „Migration läuft durch" heisst bei
-- Funktionen NICHT „Funktion läuft." `get_my_stripe_connect()` hängt an
-- `auth.uid()` und ist damit aus dem SQL-Editor gar nicht prüfbar — sie gilt
-- erst als geprüft, wenn die App sie einmal echt gerufen hat.
