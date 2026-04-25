-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Fix pg_net Signatur im NSFW-Moderations-Trigger
-- Datum: 2026-04-22
--
-- PROBLEM
-- --------
-- Die Original-Migration `20260410010000_nsfw_moderation.sql` nutzte die alte
-- pg_net-Signatur:
--
--     net.http_post(url text, body text, headers json, timeout_milliseconds int)
--
-- Die aktuelle pg_net-Version auf Supabase-gehosteten Projekten hat diese
-- Overload entfernt und erwartet jsonb statt text/json:
--
--     net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int)
--
-- Folge: Jeder `INSERT INTO posts` mit `media_type = 'image'` schlug seit dem
-- pg_net-Upgrade mit folgendem Fehler fehl — und dadurch war der gesamte
-- Post-Create-Flow kaputt, weil der Trigger in derselben Transaktion feuert:
--
--     function net.http_post(url => text, body => text, headers => json,
--       timeout_milliseconds => integer) does not exist
--
-- FIX
-- ---
-- 1) `json_build_object(...)::text` → `jsonb_build_object(...)` für body
-- 2) `json_build_object(...)`       → `jsonb_build_object(...)` für headers
-- 3) `net.http_post`-Call in einen BEGIN/EXCEPTION-Block wrappen. Moderation
--    darf NIE den User-facing Insert blocken — Muster analog zum
--    `web_push_dm_trigger` (20260420020000) der `EXCEPTION WHEN OTHERS THEN
--    RETURN NEW` nutzt.
--
-- Das ist eine CREATE OR REPLACE der Function — der Trigger selbst bleibt
-- unverändert bestehen und picked die neue Function-Definition automatisch.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_nsfw_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url      text;
  _anon_key text;
BEGIN
  -- Nur Bilder moderieren (Videos brauchen separate Pipeline)
  IF NEW.media_type = 'image' AND NEW.media_url IS NOT NULL THEN
    _url      := current_setting('app.supabase_url',    true);
    _anon_key := current_setting('app.service_role_key', true);

    -- Sanity-Check: wenn der Setting-Stack leer ist (neuer Project-Clone,
    -- vergessenes ALTER DATABASE ...) darf der Insert NICHT scheitern.
    IF _url IS NULL OR _anon_key IS NULL THEN
      RETURN NEW;
    END IF;

    -- Async HTTP POST an Edge Function. Fire-and-forget: der pg_net-Worker
    -- schreibt in _http_response, wir warten hier nicht. Kritisch: Fehler
    -- in diesem Block dürfen NIE den Insert rollbacken — Moderation ist
    -- best-effort, der Post hat is_visible=true als Default und wird
    -- retroaktiv versteckt wenn die Edge Function ein NSFW-Signal liefert.
    BEGIN
      PERFORM net.http_post(
        url     := _url || '/functions/v1/moderate-image',
        body    := jsonb_build_object(
                     'post_id',   NEW.id,
                     'image_url', NEW.media_url
                   ),
        headers := jsonb_build_object(
                     'Content-Type',  'application/json',
                     'Authorization', 'Bearer ' || _anon_key
                   ),
        timeout_milliseconds := 55000
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log als NOTICE (landet in Postgres-Logs), Insert läuft durch.
      RAISE NOTICE '[trigger_nsfw_moderation] net.http_post failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger-Definition ist in der Original-Migration bereits gesetzt
-- (on_post_insert_moderate AFTER INSERT ON posts). CREATE OR REPLACE der
-- FUNCTION reicht — der Trigger verweist per Name auf die Function und
-- nutzt automatisch den neuen Body.

-- Permission-Sanity: SECURITY DEFINER + Function-Owner = Migration-Runner
-- (in Supabase meist `postgres`). Kein GRANT nötig, weil Trigger-Ausführung
-- keine EXECUTE-Permission auf die Funktion prüft (Postgres-Standard).

DO $$
BEGIN
  RAISE NOTICE '✅ trigger_nsfw_moderation auf pg_net-jsonb-Signatur migriert (2026-04-22)';
END $$;
