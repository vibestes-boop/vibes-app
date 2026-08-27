-- ═══════════════════════════════════════════════════════════════════════════
-- Der Connect-Trigger darf niemandem etwas WEGNEHMEN, was er nie gegeben hat
-- 27.08.2026 · Berkat · Übergabe Abschnitt 99
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WAS SCHIEFGING
-- --------------
-- `20260827100000` legte `berkat_sync_checkout_enabled()` an:
--
--     INSERT INTO berkat_sellers (user_id, checkout_enabled)
--     VALUES (NEW.user_id, NEW.charges_enabled)
--     ON CONFLICT (user_id) DO UPDATE
--        SET checkout_enabled = NEW.charges_enabled;
--
-- Begründet war das mit: „Der Trigger schaltet in beide Richtungen — sperrt
-- Stripe ein Konto, fällt der Kaufknopf weg." Das ist richtig für eine SPERRE
-- und falsch für den ANFANG.
--
-- Denn ein frisch angelegtes Konto hat `charges_enabled = false`, bevor der
-- Verkäufer auch nur ein Feld ausgefüllt hat. Der Trigger hat daraus „nicht
-- kassierberechtigt" gemacht und eine bestehende, VON HAND erteilte Freigabe
-- überschrieben.
--
-- Zugeschlagen hat es sofort: Der Betreiber hat seit `20260817120000`
-- Bestandsschutz (`checkout_enabled = true`, ohne Stripe-Konto, weil das Geld
-- ohnehin auf sein eigenes Konto läuft). Ein Tipp auf „Geld empfangen" — und
-- der Bestandsschutz war weg, ohne dass jemand etwas gesperrt hätte.
--
-- ⚠️ **Ein Konto, das gerade erst entsteht, ist nicht gesperrt. Es ist noch
-- gar nichts.** Diese beiden Zustände auseinanderzuhalten ist der ganze Inhalt
-- dieser Migration.
--
-- ── DIE REGEL ───────────────────────────────────────────────────────────────
--
--   INSERT mit `charges_enabled = false`  → NICHTS TUN
--       Niemand hat etwas freigegeben, also gibt es nichts zurückzunehmen.
--
--   false → true                          → einschalten
--       Stripe hat den Verkäufer freigegeben.
--
--   true → false                          → ausschalten
--       DAS ist die Sperre, um die es ging. Sie greift weiterhin.
--
--   DELETE                                → nur ausschalten, wenn die Zeile
--                                           zuletzt `true` trug
--       Wer die Plattform trennt, ohne je kassierberechtigt gewesen zu sein,
--       verliert nichts — er hatte nichts.
--
-- Damit bleibt die Absicht erhalten (Stripe entscheidet über den Kaufknopf) und
-- die manuelle Freigabe wird nur dort überschrieben, wo Stripe tatsächlich
-- etwas zu sagen hat.


-- ─── 1. Einschalten und Sperren, aber nicht „Anfangen" ─────────────────────

CREATE OR REPLACE FUNCTION public.berkat_sync_checkout_enabled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  -- Der Anfang: Zeile entsteht, Stripe hat noch nichts freigegeben.
  -- Eine bestehende Freigabe bleibt unangetastet; fehlt die Verkäuferzeile
  -- ganz, wird sie mit der Vorgabe `false` angelegt (wie ohne Connect auch).
  IF TG_OP = 'INSERT' AND NEW.charges_enabled = false THEN
    INSERT INTO public.berkat_sellers (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Ab hier hat Stripe etwas gesagt — einschalten oder sperren.
  INSERT INTO public.berkat_sellers (user_id, checkout_enabled)
  VALUES (NEW.user_id, NEW.charges_enabled)
  ON CONFLICT (user_id) DO UPDATE
     SET checkout_enabled = NEW.charges_enabled;

  RETURN NEW;
END $$;

ALTER FUNCTION public.berkat_sync_checkout_enabled() OWNER TO postgres;


-- ─── 2. Trennen nimmt nur, was Stripe gegeben hat ──────────────────────────

CREATE OR REPLACE FUNCTION public.berkat_revoke_checkout_enabled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  -- ⚠️ Nur wenn die Verbindung zuletzt tatsächlich getragen hat. Sonst würde
  -- ein abgebrochenes Onboarding, das der Verkäufer wieder löst, eine
  -- HANDVERGEBENE Freigabe mitreissen — derselbe Fehler wie oben, nur am
  -- anderen Ende.
  IF OLD.charges_enabled THEN
    UPDATE public.berkat_sellers
       SET checkout_enabled = false
     WHERE user_id = OLD.user_id;
  END IF;
  RETURN OLD;
END $$;

ALTER FUNCTION public.berkat_revoke_checkout_enabled() OWNER TO postgres;


-- ─── 3. ⚠️ WAS DIESE MIGRATION NICHT TUT ───────────────────────────────────
--
-- Sie stellt KEINE Freigabe wieder her. Wessen `checkout_enabled` am 27.08.
-- fälschlich auf `false` fiel, muss von Hand zurückgesetzt werden — und zwar
-- erst, nachdem nachgesehen wurde, WER betroffen ist. Ein blindes
-- `UPDATE … SET checkout_enabled = true` würde die ZAG-Schranke für alle
-- öffnen, und das ist der eine Riegel, den dieses Projekt nicht raten darf.
--
-- Nachsehen (ändert nichts):
--
--   SELECT p.username, s.kind, s.checkout_enabled, st.charges_enabled
--     FROM public.berkat_sellers s
--     JOIN public.profiles p ON p.id = s.user_id
--     LEFT JOIN public.berkat_seller_stripe st ON st.user_id = s.user_id
--    ORDER BY s.checkout_enabled DESC NULLS LAST, p.username;
--
-- Betroffen ist, wer eine `berkat_seller_stripe`-Zeile mit
-- `charges_enabled = false` hat UND vorher freigegeben war. Für den Betreiber
-- lautet die Rückgabe dann gezielt:
--
--   UPDATE public.berkat_sellers SET checkout_enabled = true
--    WHERE user_id = '<uid des betreibers>'
--   RETURNING user_id, checkout_enabled;
