-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — live_sessions.updated_at Spalte + Auto-Update Trigger
-- Datum: 2026-04-19
-- Audit-Finding: Phase 2 #6 (Zombie-Session-Cleanup)
--
-- PROBLEM:
-- Die cleanup_cron Migration (20260415000000_cleanup_cron.sql) und der
-- Host-Heartbeat in app/live/host.tsx:464 schreiben/lesen beide
-- `live_sessions.updated_at` — die Spalte existiert aber im Schema
-- (supabase/live_studio.sql) nicht. Nur `started_at` und `ended_at` sind
-- definiert. Dadurch:
--   - Heartbeat-Update schlägt silent fehl (PostgREST: column not found)
--   - pg_cron "cleanup-stale-lives-sql" matched nie eine Zeile
--     → Zombie-Sessions bleiben unbegrenzt active
--
-- FIX:
-- 1) `updated_at` Spalte nullable hinzufügen
-- 2) Historische Rows backfillen (NULL → COALESCE(ended_at, started_at))
-- 3) NOT NULL + DEFAULT NOW() nachträglich setzen (idempotent re-runnable)
-- 4) BEFORE UPDATE Trigger der updated_at automatisch auf NOW() setzt
-- 5) Partial-Index für den Cleanup-Filter
-- 6) Optional: dedizierte heartbeat_live_session RPC (hardened)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Spalte nullable hinzufügen (idempotent)
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2) Backfill: NULL-Rows bekommen einen historischen Wert
-- Dieser UPDATE ist idempotent — nach dem ersten Run sind keine NULLs mehr da.
UPDATE public.live_sessions
SET updated_at = COALESCE(ended_at, started_at, NOW())
WHERE updated_at IS NULL;

-- 3) NOT NULL + Default setzen (idempotent — ALTER akzeptiert erneutes SET)
ALTER TABLE public.live_sessions
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- 4) Trigger-Funktion (namespaced)
CREATE OR REPLACE FUNCTION public._set_live_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Trigger idempotent anhängen
DROP TRIGGER IF EXISTS trg_live_sessions_updated_at ON public.live_sessions;
CREATE TRIGGER trg_live_sessions_updated_at
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public._set_live_sessions_updated_at();

-- 5) Partial-Index für Cleanup-Cron-Filter
-- pg_cron "cleanup-stale-lives-sql" filtert: status='active' AND updated_at < NOW() - 10min
CREATE INDEX IF NOT EXISTS idx_live_sessions_active_updated
  ON public.live_sessions(updated_at)
  WHERE status = 'active';

-- ──────────────────────────────────────────────────────────────────────────────
-- 6) BONUS: Dedizierte Heartbeat-RPC
-- Der Host-Code könnte direkt via supabase.from(...).update(...) heartbeaten,
-- aber eine RPC ist expliziter + erlaubt Host-Identity-Check + ist trivial
-- um Rate-Limit zu erweitern. Frontend kann optional darauf migrieren
-- (nicht verpflichtend — der Trigger pflegt updated_at bei jedem UPDATE).
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.heartbeat_live_session(
  p_session_id   UUID,
  p_viewer_count INT DEFAULT NULL,
  p_peak_viewers INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  UPDATE public.live_sessions
  SET
    viewer_count = COALESCE(p_viewer_count, viewer_count),
    peak_viewers = GREATEST(peak_viewers, COALESCE(p_peak_viewers, peak_viewers))
    -- updated_at wird durch Trigger automatisch gesetzt
  WHERE id       = p_session_id
    AND host_id  = auth.uid()
    AND status   = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.heartbeat_live_session(UUID, INT, INT) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✅ live_sessions.updated_at + Trigger + Index + heartbeat RPC angelegt';
END $$;
