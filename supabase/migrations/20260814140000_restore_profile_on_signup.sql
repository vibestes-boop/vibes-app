-- ═══════════════════════════════════════════════════════════════════════════
-- Serlo: Registrierung erzeugt wieder ein Profil
--
-- Am 14.08.2026 gefunden: `select tgname from pg_trigger where tgrelid =
-- 'auth.users'::regclass and not tgisinternal` liefert NICHTS. Es gibt keinen
-- Trigger auf auth.users mehr, und im gesamten App-Code fügt niemand eine
-- Zeile in profiles ein — `register.tsx` verlässt sich ausdrücklich auf den
-- Trigger („Kein manueller profiles.insert() nötig"), die Google-Anmeldung
-- ebenso.
--
-- Folge: Wer sich registriert, ist angemeldet, hat aber kein Profil. Kein
-- Benutzername, keine Geldbörse, und jede Aktion mit Fremdschlüssel auf
-- profiles schlägt fehl — in Berkat schon das erste Gebot. Drei Konten stehen
-- so in der Datenbank.
--
-- Entfernt wurde der Trigger am 17.04.2026 (`fix_handle_new_user`) mit der
-- Begründung, ein alter TestFlight-Build habe das Profil zusätzlich selbst
-- angelegt und sei am doppelten Schlüssel gescheitert. Dieser Build ist längst
-- abgelaufen, und die heutige Fassung von `register.tsx` fügt nichts mehr ein.
--
-- Drei Dinge macht diese Fassung besser als die ursprüngliche:
--
--   1. `search_path` gepinnt — wie alle SECURITY-DEFINER-Funktionen hier seit
--      `pin_definer_search_path`.
--   2. Eindeutiger Name. Vorher wurde stumpf `split_part(email,'@',1)`
--      genommen. Zwei Leute mit max@a.de und max@b.de hießen beide „max", der
--      zweite Einfügeversuch scheiterte — und weil ein Fehler im Trigger die
--      ganze Registrierung zurückrollt, kam das Konto gar nicht erst zustande.
--   3. Blockiert nie. Geht auch der letzte Versuch schief, hängt die Funktion
--      ein Stück der Konto-Kennung an. Ein hässlicher Name ist besser als eine
--      gescheiterte Anmeldung oder ein stilles Konto ohne Profil.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_base text;
  v_try  int;
BEGIN
  v_base := btrim(COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''),
                           split_part(NEW.email, '@', 1)));
  IF v_base IS NULL OR v_base = '' THEN
    v_base := 'nutzer';
  END IF;

  FOR v_try IN 0..20 LOOP
    BEGIN
      INSERT INTO public.profiles (id, username)
      VALUES (NEW.id, CASE WHEN v_try = 0 THEN v_base ELSE v_base || v_try::text END);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      -- Kollidierte die Kennung, ist das Profil schon da und wir sind fertig.
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        RETURN NEW;
      END IF;
      -- Sonst war es der Name — nächster Versuch.
    END;
  END LOOP;

  -- Letzter Ausweg, garantiert eindeutig.
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, v_base || '-' || left(NEW.id::text, 8))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Nachziehen, was seit dem 17.04. liegen geblieben ist ───────────────────
-- Dieselbe Namenslogik, nur für Bestandskonten. `ON CONFLICT DO NOTHING` hält
-- es wiederholbar.
DO $$
DECLARE
  r      record;
  v_base text;
  v_try  int;
BEGIN
  FOR r IN
    SELECT u.id, u.email, u.raw_user_meta_data
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
     WHERE p.id IS NULL
  LOOP
    v_base := btrim(COALESCE(NULLIF(r.raw_user_meta_data->>'username', ''),
                             split_part(r.email, '@', 1)));
    IF v_base IS NULL OR v_base = '' THEN
      v_base := 'nutzer';
    END IF;

    FOR v_try IN 0..20 LOOP
      BEGIN
        INSERT INTO public.profiles (id, username)
        VALUES (r.id, CASE WHEN v_try = 0 THEN v_base ELSE v_base || v_try::text END);
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = r.id) THEN
          EXIT;
        END IF;
      END;
    END LOOP;

    -- Nur wenn die Schleife oben nichts hinbekommen hat. Ohne diesen Riegel
    -- liefe der Ausweg auch nach einem Erfolg — und ein Namenskonflikt dabei
    -- würde den ganzen Nachzieh-Block abbrechen.
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = r.id) THEN
      INSERT INTO public.profiles (id, username)
      VALUES (r.id, v_base || '-' || left(r.id::text, 8));
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Legt bei jeder Registrierung ein Profil an — für alle Wege: E-Mail, Google, Dashboard, Admin-API. Blockiert nie an einem belegten Namen.';
