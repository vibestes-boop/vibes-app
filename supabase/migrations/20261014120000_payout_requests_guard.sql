-- ─────────────────────────────────────────────────────────────────────────────
-- Creator-Auszahlung: Server-Prüfung für payout_requests + get_creator_earnings
--
-- BEFUND 14.10.2026 (Geld-Pfad):
--
--   1. App (app/creator/payout-request.tsx) und Web (apps/web/app/actions/payout.ts)
--      schreiben Anträge per direktem `insert` in `payout_requests`. Die RLS
--      `payout_requests_insert_own` prüft nur `creator_id = auth.uid()` — kein
--      Trigger, keine RPC. Wer die REST-Schnittstelle mit dem eigenen JWT direkt
--      anspricht, trägt beliebige `diamonds_amount`/`euro_amount` ein, und auch
--      gleich `status = 'paid'`.
--   4. `get_creator_earnings(p_user_id, p_days)` ist SECURITY DEFINER ohne
--      Abgleich mit auth.uid(): jeder Angemeldete liest Diamanten-Guthaben und
--      Top-Schenker fremder Creator. (anon ist seit 20260822190000 zu.)
--
-- DIESE MIGRATION — unabhängig davon, wann die Diamanten abgezogen werden:
--
--   (a) Trigger `trg_payout_requests_10_guard` (BEFORE INSERT OR UPDATE).
--       INSERT, in dieser Reihenfolge:
--         0. Externe Aufrufer (JWT-Rolle anon/authenticated) nur für sich selbst.
--            ⚠️ Muss ZUERST stehen: BEFORE-Trigger laufen VOR dem RLS-WITH-CHECK.
--            Ohne diese Zeile käme ein Versuch mit fremder creator_id bis zur
--            Guthaben-Meldung in Schritt 5 und verriete das Guthaben des Opfers.
--         1. status/admin_note/processed_at/created_at setzt der Server.
--         2. IBAN oder PayPal-E-Mail muss da sein.
--         3. coins_wallets-Zeile FOR UPDATE sperren — serialisiert gleichzeitige
--            Anträge desselben Creators.
--         4. Höchstens EIN offener Antrag (pending/processing) pro Creator.
--         5. diamonds_amount: fehlt er → ganzes Guthaben; sonst muss gelten
--            2.500 ≤ diamonds_amount ≤ coins_wallets.diamonds.
--         6. euro_amount = round(diamonds_amount × 0,02; 2) — Client-Wert zählt nicht.
--       UPDATE:
--         - 'paid' und 'rejected' sind Endzustände (kein Zurück → keine Doppel-
--           buchung durch den Diamanten-Trigger der Folgemigration).
--         - creator_id, diamonds_amount, euro_amount, created_at unveränderlich.
--         - processed_at wird beim Abschluss gesetzt, falls der Aufrufer es nicht tut
--           (Status-Änderung im Supabase-Table-Editor).
--       Konstanten 2.500 / 0,02 spiegeln lib/payout.ts — nur zusammen ändern.
--
--   (a') Partieller UNIQUE-Index „ein offener Antrag pro Creator" als zweite
--        Sicherung — wird nur angelegt, wenn die Live-Daten ihn zulassen (sonst
--        WARNING, der Trigger schützt trotzdem).
--
--   (d) get_creator_earnings: CREATE OR REPLACE mit GLEICHER Signatur und
--       gleichem Rückgabetyp. Rumpf = Live-Stand (Abzug schema_live.sql, identisch
--       mit 20260414040000 + search_path-Pin aus 20260614190000), nur der Guard
--       vorne ist neu: Externe Aufrufer dürfen nur die eigene ID abfragen, Admins
--       (is_admin()) alles; service_role/direkte DB-Verbindung unverändert.
--       Fremde ID → Fehler 42501 (wie „gesperrt"), keine geschönte 0-Zeile.
--       Aufrufer übergeben alle die eigene ID: lib/useAnalytics.ts
--       (useCreatorEarnings), apps/web/lib/data/studio.ts, apps/web/app/actions/payout.ts.
--
-- BEWUSST NICHT HIER:
--
--   (b) Abzug der Diamanten → 20261014120100_payout_diamonds_escrow.sql
--       (Variante A: beim Antrag abziehen, bei 'rejected' zurückbuchen — Zaur, 14.10.2026).
--
--   (c) Wallet-Guthaben in admin_get_payout_requests: weggelassen. Eine zusätzliche
--       Spalte ändert den Rückgabetyp; Postgres lehnt das bei CREATE OR REPLACE ab
--       („cannot change return type of existing function"), es ginge nur per
--       DROP + CREATE — genau der Weg, auf dem in diesem Projekt schon Grants
--       zurückgefallen sind. Und nötig ist es nach (a)+(b) nicht mehr: Ein neuer
--       Antrag ist beim Anlegen gegen das Guthaben geprüft (und mit (b) Variante A
--       schon abgebucht). Für Altanträge reicht im SQL-Editor:
--         SELECT pr.id, p.username, pr.status, pr.diamonds_amount, w.diamonds AS guthaben_jetzt
--           FROM public.payout_requests pr
--           JOIN public.profiles p ON p.id = pr.creator_id
--           LEFT JOIN public.coins_wallets w ON w.user_id = pr.creator_id
--          WHERE pr.status IN ('pending', 'processing')
--          ORDER BY pr.created_at;
--
--   admin_update_payout_status / admin_get_payout_requests bleiben unverändert.
--   Die Regeln hängen am Trigger, damit sie auch für Änderungen im Table-Editor gelten.
--
-- Tests: supabase/tests/payout_requests_guard.sql
-- ─────────────────────────────────────────────────────────────────────────────


-- ── (a) Trigger-Funktion ─────────────────────────────────────────────────────
-- SECURITY DEFINER, weil der Insert als `authenticated` läuft und die Wallet-Zeile
-- sonst nicht sperren darf (coins_wallets: SELECT nur eigene Zeile, UPDATE nur
-- service_role → FOR UPDATE fände unter RLS keine Zeile = Guthaben 0).
CREATE OR REPLACE FUNCTION public.payout_requests_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  c_min_diamonds CONSTANT bigint  := 2500;  -- = MIN_PAYOUT_DIAMONDS (lib/payout.ts)
  c_rate_eur     CONSTANT numeric := 0.02;  -- = DIAMOND_RATE_EUR   (lib/payout.ts)
  v_balance bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 0) Identität vor allem anderen (siehe Kopf: Trigger läuft vor der RLS).
    IF auth.role() IN ('anon', 'authenticated')
       AND NEW.creator_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Auszahlungsanfragen nur für das eigene Konto.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 1) Serverseitige Felder — was der Client hier schickt, zählt nicht.
    NEW.status       := 'pending';
    NEW.admin_note   := NULL;
    NEW.processed_at := NULL;
    NEW.created_at   := now();

    -- 2) Auszahlungsweg.
    IF NULLIF(btrim(COALESCE(NEW.iban, '')), '') IS NULL
       AND NULLIF(btrim(COALESCE(NEW.paypal_email, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Bitte gib eine IBAN oder eine PayPal-E-Mail an.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- 3) Wallet sperren. Ein zweiter, gleichzeitiger Antrag wartet hier, bis der
    --    erste committet ist, und sieht danach dessen offenen Antrag (Schritt 4).
    --    Ohne Wallet-Zeile gibt es nichts zu sperren — dann ist das Guthaben 0
    --    und Schritt 5 lehnt ab.
    SELECT cw.diamonds INTO v_balance
      FROM public.coins_wallets cw
     WHERE cw.user_id = NEW.creator_id
       FOR UPDATE;
    v_balance := COALESCE(v_balance, 0);

    -- 4) Nur ein offener Antrag pro Creator.
    IF EXISTS (
      SELECT 1 FROM public.payout_requests pr
       WHERE pr.creator_id = NEW.creator_id
         AND pr.status IN ('pending', 'processing')
    ) THEN
      RAISE EXCEPTION 'Du hast bereits eine offene Auszahlungsanfrage. Warte bis diese bearbeitet wurde.'
        USING ERRCODE = 'unique_violation';
    END IF;

    -- 5) Betrag gegen das echte Guthaben.
    NEW.diamonds_amount := COALESCE(NEW.diamonds_amount, v_balance);
    IF NEW.diamonds_amount < c_min_diamonds THEN
      RAISE EXCEPTION 'Mindestbetrag für eine Auszahlung: % 💎 (% €).',
        replace(to_char(c_min_diamonds, 'FM999,999,999,990'), ',', '.'),
        replace(to_char(c_min_diamonds * c_rate_eur, 'FM999999990.00'), '.', ',')
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.diamonds_amount > v_balance THEN
      RAISE EXCEPTION 'Dein aktuelles Guthaben reicht nicht aus (% 💎).',
        replace(to_char(v_balance, 'FM999,999,999,990'), ',', '.')
        USING ERRCODE = 'check_violation';
    END IF;

    -- 6) Euro-Betrag immer serverseitig.
    NEW.euro_amount := round(NEW.diamonds_amount * c_rate_eur, 2);

    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.status IN ('paid', 'rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Auszahlungsanfrage ist bereits abgeschlossen (%) und kann nicht wieder geöffnet werden.', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.creator_id      IS DISTINCT FROM OLD.creator_id
     OR NEW.diamonds_amount IS DISTINCT FROM OLD.diamonds_amount
     OR NEW.euro_amount     IS DISTINCT FROM OLD.euro_amount
     OR NEW.created_at      IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Creator, Betrag und Antragsdatum einer Auszahlungsanfrage sind unveränderlich. Antrag ablehnen und neu stellen lassen.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IN ('paid', 'rejected') AND OLD.status NOT IN ('paid', 'rejected') THEN
    NEW.processed_at := COALESCE(NEW.processed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger-Funktionen sind per RPC nicht aufrufbar; das Feuern prüft kein EXECUTE.
-- Trotzdem zu — ALTER DEFAULT PRIVILEGES gibt jeder neuen Funktion ein anon-Recht,
-- und nur ein REVOKE, das PUBLIC UND anon nennt, räumt beides ab (20260822190000).
REVOKE ALL ON FUNCTION public.payout_requests_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_payout_requests_10_guard ON public.payout_requests;
CREATE TRIGGER trg_payout_requests_10_guard
  BEFORE INSERT OR UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.payout_requests_guard();


-- ── (a') Zweite Sicherung: ein offener Antrag pro Creator ────────────────────
-- Vor dieser Migration verhinderte nur das Web (nicht die App) Doppelanträge.
-- Stehen live schon zwei offene Anträge eines Creators, würde der Index-Bau die
-- ganze Migration abbrechen — dann lieber WARNING und erst aufräumen. Der Trigger
-- schützt neue Anträge in beiden Fällen.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.payout_requests
     WHERE status IN ('pending', 'processing')
     GROUP BY creator_id
    HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'payout_requests: Creator mit mehreren offenen Anträgen gefunden — Index payout_requests_one_open_per_creator NICHT angelegt. Doppelte ablehnen, dann diesen Block erneut ausführen.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_one_open_per_creator
      ON public.payout_requests (creator_id)
      WHERE status IN ('pending', 'processing');
  END IF;
END $$;


-- ── (d) get_creator_earnings: nur eigene Zahlen ──────────────────────────────
-- Signatur, Rückgabetyp und Rumpf unverändert (Live-Stand); neu ist nur der Guard.
CREATE OR REPLACE FUNCTION public.get_creator_earnings(
  p_user_id  UUID,
  p_days     INT DEFAULT 28
)
RETURNS TABLE (
  diamonds_balance   BIGINT,   -- Aktueller Wallet-Stand (Diamonds = Creator-Coins)
  total_gifted       BIGINT,   -- Gesamtanzahl gesendeter Coins (all-time)
  period_gifts       BIGINT,   -- Gifts im Zeitraum (Anzahl Transaktionen)
  period_diamonds    BIGINT,   -- Diamonds verdient im Zeitraum
  top_gift_name      TEXT,     -- Beliebtestes Gift (Name)
  top_gift_emoji     TEXT,     -- Beliebtestes Gift (Emoji)
  top_gifter_name    TEXT      -- Top-Sender (Username)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  -- 14.10.2026: Externe Aufrufer nur für sich selbst (Admins ausgenommen).
  IF auth.role() IN ('anon', 'authenticated')
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Zugriff auf die Einnahmen anderer Creator.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    -- Wallet-Stand
    COALESCE((SELECT cw.diamonds FROM coins_wallets cw WHERE cw.user_id = p_user_id), 0)::BIGINT AS diamonds_balance,
    COALESCE((SELECT cw.total_gifted FROM coins_wallets cw WHERE cw.user_id = p_user_id), 0)::BIGINT AS total_gifted,

    -- Periode: Anzahl Gifts empfangen
    COUNT(gt.id)::BIGINT AS period_gifts,

    -- Periode: Diamonds verdient
    COALESCE(SUM(gt.diamond_value), 0)::BIGINT AS period_diamonds,

    -- Beliebtestes Gift im Zeitraum
    (
      SELECT gc.name FROM gift_transactions gt2
      JOIN gift_catalog gc ON gc.id = gt2.gift_id
      WHERE gt2.recipient_id = p_user_id AND gt2.created_at >= v_cutoff
      GROUP BY gc.id, gc.name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_gift_name,
    (
      SELECT gc.emoji FROM gift_transactions gt2
      JOIN gift_catalog gc ON gc.id = gt2.gift_id
      WHERE gt2.recipient_id = p_user_id AND gt2.created_at >= v_cutoff
      GROUP BY gc.id, gc.emoji
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_gift_emoji,

    -- Top-Sender Username
    (
      SELECT p.username FROM gift_transactions gt2
      JOIN profiles p ON p.id = gt2.sender_id
      WHERE gt2.recipient_id = p_user_id AND gt2.created_at >= v_cutoff
      GROUP BY p.id, p.username
      ORDER BY SUM(gt2.diamond_value) DESC
      LIMIT 1
    ) AS top_gifter_name

  FROM gift_transactions gt
  WHERE gt.recipient_id = p_user_id
    AND gt.created_at >= v_cutoff;
END;
$$;

-- CREATE OR REPLACE mit gleicher Signatur behält die Grants — trotzdem
-- ausdrücklich, damit ein späterer Leser nicht raten muss (PUBLIC UND anon).
REVOKE ALL ON FUNCTION public.get_creator_earnings(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_earnings(uuid, integer) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN nach dem Einspielen
--
-- 1. Von aussen, angemeldet als Creator A, mit A's JWT:
--      POST /rest/v1/payout_requests
--        {"creator_id":"<A>","diamonds_amount":99999999,"euro_amount":1,"iban":"DE00"}
--      → 400, „Dein aktuelles Guthaben reicht nicht aus (… 💎)."
--      Dasselbe mit "creator_id":"<B>" → 403/42501 „…nur für das eigene Konto."
--      (NICHT die Guthaben-Meldung — sonst stimmt die Reihenfolge im Trigger nicht.)
-- 2. POST /rest/v1/rpc/get_creator_earnings {"p_user_id":"<B>"} mit A's JWT
--      → 403/42501. Mit "<A>" → 200 wie bisher.
-- 3. anon bleibt zu: get_creator_earnings mit dem öffentlichen Schlüssel → 401/42501.
-- 4. App „Auszahlung beantragen" und Web /studio/revenue/payout laufen unverändert
--    (beide senden creator_id = eigene ID, diamonds_amount ≤ Guthaben, IBAN/PayPal).
-- ─────────────────────────────────────────────────────────────────────────────
