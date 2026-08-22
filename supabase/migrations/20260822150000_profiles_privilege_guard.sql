-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ KRITISCH: Jeder angemeldete Nutzer konnte sich selbst zum Admin machen
--
-- GEFUNDEN am 22.08.2026 im Sicherheits-Audit, am Produktions-Abzug belegt.
-- Der Weg besteht aus drei Zeilen, die einzeln jede für sich richtig aussehen:
--
--   1. GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE
--        ON TABLE public.profiles TO authenticated;
--      → UPDATE steht auf TABELLEN-Ebene, gilt also für ALLE Spalten.
--
--   2. CREATE POLICY "User kann eigenes Profil bearbeiten"
--        ON public.profiles FOR UPDATE USING (auth.uid() = id);
--      → richtig: jeder darf SEINE Zeile ändern. Nur eben ganz.
--
--   3. Der einzige Schutz-Trigger auf der Tabelle deckt genau EINE Spalte:
--      trg_guard_women_only_verified.
--
-- Ergebnis: Ein einziger Aufruf genügte —
--
--     PATCH /rest/v1/profiles?id=eq.<eigene-id>   {"is_admin": true}
--
-- und `is_admin()` (das genau diese Spalte liest) gibt danach TRUE zurück. An
-- dieser Funktion hängen 25 Stellen: Auszahlungsverwaltung, Streitfall-
-- Auflösung, Admin-Konsole.
--
-- ⚠️ Das betrifft SERLO GENAUSO, und Serlo ist im App Store ausgeliefert.
--
-- DAS BITTERE DARAN
-- Der Trigger aus Punkt 3 beweist, dass das Muster im Haus bekannt war. Es
-- wurde nur nie auf die übrigen Rechte-Spalten angewandt — `women_only_verified`
-- bekam einen Wächter, `is_admin` nicht.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WARUM EIN TRIGGER UND NICHT `REVOKE UPDATE` + SPALTENWEISE GRANTS
--
-- Der naheliegende Griff wäre, das Tabellen-UPDATE abzuziehen und stattdessen
-- die harmlosen Spalten einzeln zu vergeben. **Das wäre genau CLAUDE.md Regel 11
-- und damit die nächste Falle:** Postgres löst dabei das Tabellen-Recht auf und
-- schreibt Einzelrechte für die HEUTE vorhandenen Spalten. Jede später
-- hinzugefügte Profilspalte wäre für die Clients nicht mehr schreibbar — und
-- zwar lautlos, in zwei ausgelieferten Apps. Genau so ist am 16.08. `banner_url`
-- zugeschlagen, nur auf der Leseseite.
--
-- Ein Trigger ist additiv: Er ändert kein einziges Recht, friert keine
-- Spaltenliste ein, und er scheitert LAUT (RAISE) statt still.
--
-- WARUM DIE ROLLENPRÜFUNG UND KEIN BYPASS-SCHALTER
-- `guard_women_only_verified` löst dasselbe Problem über
-- `current_setting('app.woz_bypass')`, das die berechtigten RPCs setzen. Das
-- funktioniert, verlangt aber, dass jeder künftige berechtigte Schreibweg daran
-- denkt — und wer es vergisst, merkt es erst zur Laufzeit.
--
-- Hier geht es andersherum: Geprüft wird, WER schreibt.
--
--   * PostgREST schaltet für einen Client-Aufruf auf die Rolle `anon` bzw.
--     `authenticated`. Nur die werden geblockt.
--   * Eine `SECURITY DEFINER`-Funktion läuft als ihr Eigentümer (`postgres`) —
--     sie kommt unverändert durch.
--   * `service_role` (Edge Functions, Admin-Konsole, SQL-Editor) ebenso.
--
-- ⚠️ AM ABZUG GEGENGEPRÜFT, NICHT ANGENOMMEN: Jeder Schreibweg auf eine
-- Rechte-Spalte in dieser Datenbank ist SECURITY DEFINER —
-- `admin_enforce_content_report` (is_banned, is_shadow_banned),
-- `approve_women_only` / `revoke_women_only` / `leave_women_only` /
-- `request_women_only` (verification_level, gender). Und `is_admin` wird von
-- KEINER Funktion gesetzt, nur gelesen: Es wird von Hand im Dashboard vergeben,
-- also als `postgres`. Dieser Trigger nimmt damit keinem bestehenden Weg etwas.
--
-- WAS BEWUSST NICHT GESCHÜTZT WIRD
-- `gender` bleibt änderbar. Es ist ein Profilfeld, und allein trägt es nichts:
-- Die Frauen-Only-Grenze ist `is_women_only_verified()` und verlangt
-- `gender = 'female'` UND `women_only_verified = true` — die zweite Hälfte
-- schützt der ältere Trigger. Wer `gender` schützt, ohne das zu wissen, sperrt
-- ein harmloses Feld und hält es für Sicherheit.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_changed text;
BEGIN
  -- Nur Client-Rollen werden geprüft. Siehe Kopf: SECURITY DEFINER läuft als
  -- `postgres`, Edge Functions als `service_role` — beide sollen durch.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Eine neue Zeile darf nur mit den Vorgabewerten entstehen. Der Normalweg
    -- ist ohnehin der Trigger auf auth.users (SECURITY DEFINER); diese Prüfung
    -- deckt den Fall, dass jemand die INSERT-Policy
    -- („User kann eigenes Profil erstellen") direkt benutzt.
    IF NEW.is_admin OR NEW.is_moderator OR NEW.is_operator OR NEW.is_creator_ops
       OR NEW.is_verified OR NEW.is_creator OR NEW.is_banned OR NEW.is_restricted
       OR NEW.is_shadow_banned
       OR COALESCE(NEW.verification_level, 0) <> 0
       OR NEW.restricted_until IS NOT NULL THEN
      RAISE EXCEPTION 'Rechte-Spalten koennen beim Anlegen nicht gesetzt werden'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: Welche Rechte-Spalte soll sich ändern? Die erste gefundene steht
  -- in der Meldung — eine Fehlermeldung, die nicht sagt WAS, ist keine.
  v_changed := CASE
    WHEN NEW.is_admin           IS DISTINCT FROM OLD.is_admin           THEN 'is_admin'
    WHEN NEW.is_moderator       IS DISTINCT FROM OLD.is_moderator       THEN 'is_moderator'
    WHEN NEW.is_operator        IS DISTINCT FROM OLD.is_operator        THEN 'is_operator'
    WHEN NEW.is_creator_ops     IS DISTINCT FROM OLD.is_creator_ops     THEN 'is_creator_ops'
    WHEN NEW.is_verified        IS DISTINCT FROM OLD.is_verified        THEN 'is_verified'
    WHEN NEW.is_creator         IS DISTINCT FROM OLD.is_creator         THEN 'is_creator'
    WHEN NEW.is_banned          IS DISTINCT FROM OLD.is_banned          THEN 'is_banned'
    WHEN NEW.is_restricted      IS DISTINCT FROM OLD.is_restricted      THEN 'is_restricted'
    WHEN NEW.restricted_until   IS DISTINCT FROM OLD.restricted_until   THEN 'restricted_until'
    WHEN NEW.is_shadow_banned   IS DISTINCT FROM OLD.is_shadow_banned   THEN 'is_shadow_banned'
    WHEN NEW.verification_level IS DISTINCT FROM OLD.verification_level THEN 'verification_level'
    ELSE NULL
  END;

  IF v_changed IS NOT NULL THEN
    RAISE EXCEPTION '% darf nicht vom Client geaendert werden', v_changed
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_profile_privileges() OWNER TO postgres;

-- ⚠️ INSERT **und** UPDATE. Der Upsert-Weg von PostgREST
-- (`Prefer: resolution=merge-duplicates`) wird zu `INSERT … ON CONFLICT DO
-- UPDATE` — er trifft je nach Datenlage den einen oder den anderen Zweig.
-- Nur einen abzudecken hiesse, die Hälfte offen zu lassen.
CREATE OR REPLACE TRIGGER trg_guard_profile_privileges
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

COMMENT ON FUNCTION public.guard_profile_privileges() IS
  'Sperrt die Rechte-Spalten von profiles gegen direkte Client-Schreibzugriffe. '
  'Geprueft wird die ROLLE: anon und authenticated werden geblockt, SECURITY '
  'DEFINER (postgres) und service_role kommen durch. Ohne diesen Wachter konnte '
  'sich jeder angemeldete Nutzer per PATCH selbst is_admin setzen (22.08.2026).';

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. Der Angriff muss jetzt scheitern. Aus einer ANGEMELDETEN Sitzung (App oder
--    REST mit einem echten Nutzer-JWT, NICHT service_role):
--      PATCH /rest/v1/profiles?id=eq.<eigene-id>   {"is_admin": true}
--    -- erwartet: HTTP 4xx mit 'is_admin darf nicht vom Client geaendert werden'
--    -- ⚠️ Mit dem service_role-Schluessel geht es weiterhin durch. Das ist
--    --    Absicht und KEIN Gegenbeweis — der Schluessel ist der Betreiber.
--
-- 2. Der Normalfall muss weiter gehen. In derselben Sitzung:
--      PATCH /rest/v1/profiles?id=eq.<eigene-id>   {"bio": "Test"}
--    -- erwartet: 204. Danach zuruecksetzen.
--
-- 3. Die berechtigten Wege muessen unberuehrt sein:
--      SELECT public.request_women_only();
--    -- erwartet: laeuft (setzt gender + verification_level als SECURITY DEFINER)
--
-- 4. Der Trigger haengt wirklich:
--      SELECT tgname FROM pg_trigger
--       WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
--    -- erwartet: enthaelt trg_guard_profile_privileges
--
-- 5. Und die Frage, die diese Migration NICHT beantwortet:
--    Steht heute irgendwo ein is_admin, das nicht dort hingehoert?
--      SELECT id, username, is_admin, is_moderator, is_operator, is_creator_ops
--        FROM profiles
--       WHERE is_admin OR is_moderator OR is_operator OR is_creator_ops;
--    -- Das ist eine Bestandsaufnahme, kein Automatismus: Wer hier zu Unrecht
--    -- steht, muss von Hand zurueckgesetzt werden. Der Weg war offen, solange
--    -- die Datenbank steht — dass ihn niemand gegangen ist, ist eine Annahme.
-- ─────────────────────────────────────────────────────────────────────────────
