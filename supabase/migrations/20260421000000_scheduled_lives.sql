-- ============================================================================
-- 20260421000000_scheduled_lives.sql
--
-- v1.26.0 — Scheduled Lives
--
-- Reviewer-Feature: User können Live-Streams im Voraus planen. 15 min vor
-- dem angekündigten Zeitpunkt bekommen alle Follower einen Push-Reminder.
-- Der Host muss trotzdem manuell live gehen (Kamera/Mic Hardware-Constraint),
-- aber über Deep-Links aus dem Reminder gelangt er direkt in den Vorberei-
-- tungs-Screen mit vorausgefüllten Optionen (title/allow_gifts/…).
--
-- Lifecycle:
--   scheduled   → User hat Live geplant
--   reminded    → Cron hat Push an Follower rausgeschickt (15 min vor T-Zeit)
--   live        → Host hat tatsächlich startSession() aufgerufen
--   expired     → scheduled_at > 2h vorbei ohne live
--   cancelled   → Host hat selbst abgebrochen
-- ============================================================================

-- ─── scheduled_lives ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_lives (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  title            TEXT NOT NULL,
  description      TEXT,

  scheduled_at     TIMESTAMPTZ NOT NULL,

  status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','reminded','live','expired','cancelled')),

  -- Optionen — werden beim Host-Start in live_sessions kopiert
  allow_comments   BOOLEAN NOT NULL DEFAULT true,
  allow_gifts      BOOLEAN NOT NULL DEFAULT true,
  women_only       BOOLEAN NOT NULL DEFAULT false,

  -- Wird erst gesetzt wenn Host tatsächlich live geht
  session_id       UUID REFERENCES public.live_sessions(id) ON DELETE SET NULL,

  -- Wann der Follower-Push rausging (NULL solange status = 'scheduled')
  reminded_at      TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Vernunftsgrenzen
  CONSTRAINT scheduled_lives_title_len
    CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT scheduled_lives_desc_len
    CHECK (description IS NULL OR char_length(description) <= 500),
  CONSTRAINT scheduled_lives_future
    CHECK (scheduled_at > created_at - INTERVAL '1 minute')
);

CREATE INDEX IF NOT EXISTS idx_scheduled_lives_host_status
  ON public.scheduled_lives(host_id, status, scheduled_at);

-- Hot-Index für den Cron-Worker: finde alles was reminder-ready ist
CREATE INDEX IF NOT EXISTS idx_scheduled_lives_ready
  ON public.scheduled_lives(scheduled_at)
  WHERE status = 'scheduled';

-- Discovery-Index für "kommende Lives" Feed
CREATE INDEX IF NOT EXISTS idx_scheduled_lives_upcoming
  ON public.scheduled_lives(scheduled_at)
  WHERE status IN ('scheduled','reminded');

ALTER TABLE public.scheduled_lives ENABLE ROW LEVEL SECURITY;

-- Public SELECT für Discovery — aber nur nicht-stornierte, nicht-expired
DROP POLICY IF EXISTS "scheduled_lives_select_public" ON public.scheduled_lives;
CREATE POLICY "scheduled_lives_select_public"
  ON public.scheduled_lives
  FOR SELECT
  USING (status IN ('scheduled','reminded','live'));

-- Host sieht auch die eigenen expired/cancelled (für Creator-Studio History)
DROP POLICY IF EXISTS "scheduled_lives_select_own" ON public.scheduled_lives;
CREATE POLICY "scheduled_lives_select_own"
  ON public.scheduled_lives
  FOR SELECT
  USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "scheduled_lives_insert_own" ON public.scheduled_lives;
CREATE POLICY "scheduled_lives_insert_own"
  ON public.scheduled_lives
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "scheduled_lives_update_own" ON public.scheduled_lives;
CREATE POLICY "scheduled_lives_update_own"
  ON public.scheduled_lives
  FOR UPDATE
  USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "scheduled_lives_delete_own" ON public.scheduled_lives;
CREATE POLICY "scheduled_lives_delete_own"
  ON public.scheduled_lives
  FOR DELETE
  USING (auth.uid() = host_id);

-- updated_at Auto-Update
CREATE OR REPLACE FUNCTION public.scheduled_lives_touch() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scheduled_lives_touch ON public.scheduled_lives;
CREATE TRIGGER trg_scheduled_lives_touch
  BEFORE UPDATE ON public.scheduled_lives
  FOR EACH ROW EXECUTE FUNCTION public.scheduled_lives_touch();


-- ─── Notifications CHECK additiv erweitern ─────────────────────────────────
-- Neue Typen: 'scheduled_live_reminder' (15 min vor Go-Live)
-- WICHTIG: Wir müssen ADDITIV arbeiten. Die bestehende Constraint (z. B. aus
-- 20260414080000_shop_phase4.sql) enthält u. a. 'new_order', 'repost', 'guild',
-- 'story_reaction', 'comment_like'. Einfach hardcoded ersetzen würde diese
-- Typen entfernen und Shop-/Repost-/Guild-Notifications in Produktion brechen.
-- Daher: IN-Liste aus pg_get_constraintdef parsen und 'scheduled_live_reminder'
-- anhängen.
DO $$
DECLARE
  v_current_def  TEXT;
  v_in_list      TEXT;
  v_new_list     TEXT;
BEGIN
  -- Hole aktuelle CHECK-Definition
  SELECT pg_get_constraintdef(oid) INTO v_current_def
    FROM pg_constraint
   WHERE conname = 'notifications_type_check'
     AND conrelid = 'public.notifications'::regclass;

  -- Nichts zu tun wenn bereits vorhanden
  IF v_current_def IS NULL OR v_current_def LIKE '%scheduled_live_reminder%' THEN
    RAISE NOTICE 'ℹ️ scheduled_live_reminder bereits in notifications_type_check (oder Constraint fehlt)';
  ELSE
    -- Extrahiere die Literale aus "CHECK ((type = ANY (ARRAY['...', '...', ...])))"
    -- oder aus "CHECK ((type IN ('...', '...', ...)))" — beide Formen möglich.
    -- Wir holen uns einfach alles zwischen der ersten öffnenden und der letzten
    -- schließenden runden Klammer des inneren Ausdrucks.
    v_in_list := substring(v_current_def FROM 'ARRAY\[(.+)\]');
    IF v_in_list IS NULL THEN
      v_in_list := substring(v_current_def FROM 'IN \((.+)\)\)');
    END IF;

    IF v_in_list IS NULL THEN
      RAISE EXCEPTION
        'Konnte notifications_type_check nicht parsen: %', v_current_def;
    END IF;

    v_new_list := v_in_list || ', ''scheduled_live_reminder''';

    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
    EXECUTE format(
      'ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (%s))',
      v_new_list
    );
    RAISE NOTICE '✅ scheduled_live_reminder additiv zu notifications_type_check hinzugefügt';
  END IF;
END $$;


-- ─── RPC: Live planen ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.schedule_live(
  p_scheduled_at    TIMESTAMPTZ,
  p_title           TEXT,
  p_description     TEXT DEFAULT NULL,
  p_allow_comments  BOOLEAN DEFAULT true,
  p_allow_gifts     BOOLEAN DEFAULT true,
  p_women_only      BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF char_length(trim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Titel ist erforderlich' USING ERRCODE = '22023';
  END IF;
  IF p_scheduled_at <= NOW() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'scheduled_at muss mind. 5 Minuten in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_scheduled_at > NOW() + INTERVAL '30 days' THEN
    RAISE EXCEPTION 'scheduled_at darf max. 30 Tage in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.scheduled_lives (
    host_id, title, description, scheduled_at,
    allow_comments, allow_gifts, women_only
  ) VALUES (
    v_caller, trim(p_title), NULLIF(trim(p_description), ''), p_scheduled_at,
    p_allow_comments, p_allow_gifts, p_women_only
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ─── RPC: Live umplanen (nur scheduled/reminded) ────────────────────────────
CREATE OR REPLACE FUNCTION public.reschedule_live(
  p_id       UUID,
  p_new_time TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_new_time <= NOW() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'scheduled_at muss mind. 5 Minuten in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_new_time > NOW() + INTERVAL '30 days' THEN
    RAISE EXCEPTION 'scheduled_at darf max. 30 Tage in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;

  -- Beim Umplanen zurücksetzen auf 'scheduled' → Reminder geht erneut raus
  UPDATE public.scheduled_lives
     SET scheduled_at = p_new_time,
         status       = 'scheduled',
         reminded_at  = NULL
   WHERE id = p_id
     AND host_id = v_caller
     AND status IN ('scheduled','reminded');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Live nicht gefunden oder nicht mehr umplanbar'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


-- ─── RPC: Live abbrechen ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_scheduled_live(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.scheduled_lives
     SET status = 'cancelled'
   WHERE id = p_id
     AND host_id = v_caller
     AND status IN ('scheduled','reminded');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Live nicht gefunden oder nicht mehr abbrechbar'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


-- ─── RPC: Cron-Reminder (vom Edge/Cron aufgerufen) ──────────────────────────
-- Findet alle 'scheduled' Einträge deren scheduled_at innerhalb der nächsten
-- 15 Minuten liegt. Setzt status auf 'reminded' und schreibt Notifications
-- an alle Follower.  SELECT FOR UPDATE SKIP LOCKED schützt vor Race bei
-- parallelen Cron-Runs.
CREATE OR REPLACE FUNCTION public.mark_due_scheduled_lives_reminded(
  p_batch_size INT DEFAULT 50
)
RETURNS TABLE(
  scheduled_live_id UUID,
  host_id           UUID,
  notified_count    INT,
  success           BOOLEAN,
  error             TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       public.scheduled_lives%ROWTYPE;
  v_count     INT;
BEGIN
  FOR v_row IN
    SELECT *
      FROM public.scheduled_lives
     WHERE status = 'scheduled'
       AND scheduled_at <= NOW() + INTERVAL '15 minutes'
       AND scheduled_at > NOW() - INTERVAL '1 hour'  -- nicht rückwirkend reminen
     ORDER BY scheduled_at ASC
     LIMIT p_batch_size
     FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Status-Flag zuerst (idempotenz-schutz — bei Fehler im Fanout nicht
      -- ewig retry'n, wir akzeptieren dass Reminder einmalig geht)
      UPDATE public.scheduled_lives
         SET status      = 'reminded',
             reminded_at = NOW()
       WHERE id = v_row.id;

      -- Fanout: Notifications für alle Follower des Hosts
      WITH inserted AS (
        INSERT INTO public.notifications (
          recipient_id, sender_id, type, session_id, comment_text
        )
        SELECT
          f.follower_id,
          v_row.host_id,
          'scheduled_live_reminder',
          NULL,                    -- noch keine session_id (Host noch nicht live)
          v_row.title
          FROM public.follows f
         WHERE f.following_id = v_row.host_id
        RETURNING 1
      )
      SELECT COUNT(*)::INT INTO v_count FROM inserted;

      scheduled_live_id := v_row.id;
      host_id           := v_row.host_id;
      notified_count    := v_count;
      success           := true;
      error             := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      scheduled_live_id := v_row.id;
      host_id           := v_row.host_id;
      notified_count    := 0;
      success           := false;
      error             := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;


-- ─── RPC: Abgelaufene Scheduled-Lives aufräumen ─────────────────────────────
-- Wird vom selben Cron aufgerufen. Setzt 'scheduled'/'reminded' → 'expired'
-- wenn scheduled_at > 2h vorbei ohne live Status.
CREATE OR REPLACE FUNCTION public.expire_stale_scheduled_lives()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE public.scheduled_lives
       SET status = 'expired'
     WHERE status IN ('scheduled','reminded')
       AND scheduled_at < NOW() - INTERVAL '2 hours'
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_count FROM expired;

  RETURN v_count;
END;
$$;


-- ─── RPC: Live-Session mit Scheduled verknüpfen ─────────────────────────────
-- Wird von useLiveHost().startSession() aufgerufen wenn User aus einem
-- Scheduled-Live Deep-Link kommt. Markiert scheduled_live als 'live' und
-- speichert session_id für Follower-Retargeting.
CREATE OR REPLACE FUNCTION public.link_live_session_to_scheduled(
  p_scheduled_live_id UUID,
  p_session_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Sanity: Scheduled-Live gehört dem Caller und ist noch nicht live
  UPDATE public.scheduled_lives
     SET status     = 'live',
         session_id = p_session_id
   WHERE id         = p_scheduled_live_id
     AND host_id    = v_caller
     AND status IN ('scheduled','reminded');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Live nicht gefunden, gehört dir nicht, oder ist bereits live/expired/cancelled'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


-- ─── Permissions ────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.schedule_live(TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.schedule_live(TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN)
  TO authenticated;

REVOKE ALL ON FUNCTION public.reschedule_live(UUID, TIMESTAMPTZ) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_live(UUID, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_scheduled_live(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_live(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.link_live_session_to_scheduled(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.link_live_session_to_scheduled(UUID, UUID) TO authenticated;

-- Cron-RPCs nur für service_role
REVOKE ALL ON FUNCTION public.mark_due_scheduled_lives_reminded(INT)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_due_scheduled_lives_reminded(INT) TO service_role;

REVOKE ALL ON FUNCTION public.expire_stale_scheduled_lives()
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_scheduled_lives() TO service_role;


-- ─── pg_cron: alle 5 Minuten Reminder + Cleanup ─────────────────────────────
-- Nutzt pg_net um die Edge-Function aufzurufen (entspricht dem Muster aus
-- 20260418150000_creator_studio_pro.sql).
DO $$
DECLARE
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', TRUE);
  v_project_url      TEXT := current_setting('app.settings.project_url',      TRUE);
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('scheduled-lives-cron')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-lives-cron');

    IF v_service_role_key IS NOT NULL AND v_project_url IS NOT NULL THEN
      PERFORM cron.schedule(
        'scheduled-lives-cron',
        '*/5 * * * *',
        format(
          $cron$
          SELECT net.http_post(
            url     := %L,
            headers := jsonb_build_object(
              'Content-Type',  'application/json',
              'Authorization', 'Bearer ' || %L
            ),
            body    := '{}'::jsonb
          );
          $cron$,
          v_project_url || '/functions/v1/scheduled-lives-cron',
          v_service_role_key
        )
      );
    ELSE
      -- Fallback: direkt die SQL-RPCs
      PERFORM cron.schedule(
        'scheduled-lives-cron-sql',
        '*/5 * * * *',
        $cron$
        SELECT public.mark_due_scheduled_lives_reminded(50);
        SELECT public.expire_stale_scheduled_lives();
        $cron$
      );
    END IF;
  END IF;
END $$;
