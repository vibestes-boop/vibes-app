-- ─────────────────────────────────────────────────────────────────────────────
-- Creator-Auszahlung (b): Diamanten beim Antrag abziehen, bei Ablehnung zurückbuchen
--
-- Variante A — von Zaur am 14.10.2026 gewählt. Setzt 20261014120000 voraus.
--
-- BEFUND 14.10.2026: admin_update_payout_status(…, 'paid') setzt nur den Status.
-- coins_wallets.diamonds bleibt stehen → nach der Auszahlung lässt sich dasselbe
-- Guthaben erneut beantragen. (Es gibt sonst KEINEN Pfad, der Diamanten abzieht —
-- send_gift, send_creator_tip, buy_product schreiben nur gut.)
--
-- VARIANTE A (diese Datei): Abzug beim Antrag, Rückbuchung bei 'rejected'.
--   INSERT  → coins_wallets.diamonds -= diamonds_amount, im selben Statement wie der
--             Antrag (Wallet-Zeile ist vom Guard schon gesperrt). diamonds_debited_at = now().
--   'rejected' → Betrag zurück ins Wallet (nur wenn diamonds_debited_at gesetzt).
--   'paid'     → nichts mehr zu tun.
--   Doppelte Rückbuchung ist ausgeschlossen, weil der Guard 'paid'/'rejected' zu
--   Endzuständen macht.
--
-- VARIANTE B (nicht gebaut): Abzug erst bei 'paid'. Bis dahin zeigen App, Web-Studio
--   und Admin das volle Guthaben inkl. bereits beantragter Diamanten, und jede künftige
--   Diamanten-Ausgabe müsste offene Anträge selbst abziehen.
--
-- ALTANTRÄGE (vor dieser Migration angelegt, diamonds_debited_at IS NULL):
--   - offen → 'paid':     jetzt abziehen; reicht das Guthaben nicht → Fehler statt
--                         Auszahlung (typisch: zweiter offener Altantrag desselben Creators).
--   - offen → 'rejected': nichts zurückbuchen — es wurde nie abgezogen.
--   - schon 'paid':       bleibt unberührt. Diese Creator haben die ausgezahlten
--                         Diamanten noch im Wallet. Ob korrigiert wird, entscheidet Zaur:
--     SELECT pr.creator_id, p.username,
--            sum(pr.diamonds_amount) AS ausgezahlt_nie_abgezogen,
--            w.diamonds              AS guthaben_jetzt
--       FROM public.payout_requests pr
--       JOIN public.profiles p ON p.id = pr.creator_id
--       LEFT JOIN public.coins_wallets w ON w.user_id = pr.creator_id
--      WHERE pr.status = 'paid' AND pr.diamonds_debited_at IS NULL
--      GROUP BY pr.creator_id, p.username, w.diamonds;
--
-- NICHT ABGEDECKT: Wer einen offenen Antrag im Table-Editor LÖSCHT statt ablehnt,
-- bucht nicht zurück. Offene Anträge immer auf 'rejected' setzen.
--
-- Tests: supabase/tests/payout_diamonds_escrow.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS diamonds_debited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.payout_requests.diamonds_debited_at IS
  'Wann diamonds_amount von coins_wallets.diamonds abgezogen wurde (setzt nur der Trigger). NULL = Altantrag vor 14.10.2026, nie abgezogen.';


CREATE OR REPLACE FUNCTION public.payout_requests_settle_diamonds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- trg_payout_requests_10_guard hat Betrag und Guthaben geprüft und die
    -- Wallet-Zeile gesperrt; Trigger feuern alphabetisch, 10 vor 20.
    UPDATE public.coins_wallets
       SET diamonds   = diamonds - NEW.diamonds_amount,
           updated_at = now()
     WHERE user_id = NEW.creator_id
       AND diamonds >= NEW.diamonds_amount;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Dein aktuelles Guthaben reicht nicht aus.'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.diamonds_debited_at := now();
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  IF NEW.diamonds_debited_at IS DISTINCT FROM OLD.diamonds_debited_at THEN
    RAISE EXCEPTION 'diamonds_debited_at setzt nur das System.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'rejected' AND OLD.diamonds_debited_at IS NOT NULL THEN
      INSERT INTO public.coins_wallets (user_id, diamonds, updated_at)
      VALUES (NEW.creator_id, NEW.diamonds_amount, now())
      ON CONFLICT (user_id) DO UPDATE
        SET diamonds   = public.coins_wallets.diamonds + EXCLUDED.diamonds,
            updated_at = now();

    ELSIF NEW.status = 'paid' AND OLD.diamonds_debited_at IS NULL THEN
      UPDATE public.coins_wallets
         SET diamonds   = diamonds - NEW.diamonds_amount,
             updated_at = now()
       WHERE user_id = NEW.creator_id
         AND diamonds >= NEW.diamonds_amount;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Altantrag %: Guthaben reicht nicht für % Diamanten. Nicht auszahlen — auf Doppelantrag prüfen.',
          NEW.id, NEW.diamonds_amount
          USING ERRCODE = 'check_violation';
      END IF;
      NEW.diamonds_debited_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.payout_requests_settle_diamonds() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_payout_requests_20_diamonds ON public.payout_requests;
CREATE TRIGGER trg_payout_requests_20_diamonds
  BEFORE INSERT OR UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.payout_requests_settle_diamonds();


-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN nach dem Einspielen (Test-Creator mit ≥ 2.500 💎)
--
-- 1. Antrag in der App stellen → coins_wallets.diamonds sinkt um den Betrag,
--    payout_requests.diamonds_debited_at ist gesetzt.
-- 2. SELECT public.admin_update_payout_status('<id>', 'rejected', 'Test');
--    → Diamanten wieder da. Danach erneut 'paid' setzen → Fehler „bereits abgeschlossen".
-- 3. Neuer Antrag → 'paid' → Guthaben bleibt beim Rest, kein zweiter Abzug.
-- ─────────────────────────────────────────────────────────────────────────────
