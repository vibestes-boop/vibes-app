-- ================================================================
-- Phase 5: Co-Host Blocklist (DB-Persistenz)
-- ================================================================
-- Erweitert Phase 1.3 (Host Kick mit Reason) um Persistenz über
-- App-Restarts und mehrere Sessions hinweg. Der Host kann einen
-- User dauerhaft oder zeitlich begrenzt blockieren.
--
-- Der blocked User kann:
--   - die Live weiter als normaler Viewer zuschauen (kein DMCA-Risiko)
--   - NICHT mehr als Co-Host beitreten (`approve_cohost` wirft Fehler)
--
-- Blocks werden per (host_id, blocked_user_id) gespeichert — global
-- pro Host, NICHT pro Session. Ein Block gilt in ALLEN zukünftigen
-- Lives des Hosts.
-- ================================================================

-- ─── 1. Tabelle ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_cohost_blocks (
  host_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,                  -- NULL = permanent
  reason          text,                         -- Grund vom Host (kurz)
  PRIMARY KEY (host_id, blocked_user_id),
  -- Sanity: ein User kann sich nicht selbst blockieren
  CONSTRAINT no_self_block CHECK (host_id <> blocked_user_id)
);

-- Hinweis: KEIN Partial-Index mit `WHERE ... > now()` — Postgres verbietet
-- STABLE-Funktionen im Index-Predicate (ERROR 42P17: "functions in index
-- predicate must be marked IMMUTABLE"). Da die Tabelle pro Host winzig
-- bleibt (< 100 Blocks typisch), reicht ein vollständiger Index. Das
-- Ablauf-Filtering macht `is_cohost_blocked()` zur Laufzeit.
CREATE INDEX IF NOT EXISTS idx_cohost_blocks_host
  ON public.live_cohost_blocks (host_id);

CREATE INDEX IF NOT EXISTS idx_cohost_blocks_blocked
  ON public.live_cohost_blocks (blocked_user_id);

-- ─── 2. RLS ──────────────────────────────────────────────────────
ALTER TABLE public.live_cohost_blocks ENABLE ROW LEVEL SECURITY;

-- Host sieht seine eigenen Blocks, geblockter User sieht seine eigene Block-Row
-- (UX: "Du bist von @host blockiert"). Anonyme User sehen nichts.
DROP POLICY IF EXISTS "cohost_blocks_select_own" ON public.live_cohost_blocks;
CREATE POLICY "cohost_blocks_select_own" ON public.live_cohost_blocks
  FOR SELECT USING (
    auth.uid() = host_id OR auth.uid() = blocked_user_id
  );

-- Nur Host darf Blocks erstellen/updaten/löschen für sich selbst
DROP POLICY IF EXISTS "cohost_blocks_insert_host" ON public.live_cohost_blocks;
CREATE POLICY "cohost_blocks_insert_host" ON public.live_cohost_blocks
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "cohost_blocks_update_host" ON public.live_cohost_blocks;
CREATE POLICY "cohost_blocks_update_host" ON public.live_cohost_blocks
  FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "cohost_blocks_delete_host" ON public.live_cohost_blocks;
CREATE POLICY "cohost_blocks_delete_host" ON public.live_cohost_blocks
  FOR DELETE
  USING (auth.uid() = host_id);

-- ─── 3. Helper-RPCs für Host ─────────────────────────────────────

-- Block eintragen (erweitert Phase 1.3 um Persistenz)
--   p_duration_hours: NULL = permanent, sonst Stunden bis expires_at
CREATE OR REPLACE FUNCTION public.block_cohost(
  p_user_id         uuid,
  p_reason          text DEFAULT NULL,
  p_duration_hours  int  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host    uuid := auth.uid();
  v_expires timestamptz;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_host = p_user_id THEN
    RAISE EXCEPTION 'Kann dich nicht selbst blockieren' USING ERRCODE = '22023';
  END IF;

  IF p_duration_hours IS NOT NULL THEN
    v_expires := now() + make_interval(hours => p_duration_hours);
  END IF;

  INSERT INTO public.live_cohost_blocks (host_id, blocked_user_id, reason, expires_at)
  VALUES (v_host, p_user_id, p_reason, v_expires)
  ON CONFLICT (host_id, blocked_user_id) DO UPDATE
    SET reason     = COALESCE(EXCLUDED.reason, live_cohost_blocks.reason),
        expires_at = EXCLUDED.expires_at,
        created_at = now();
END;
$$;

-- Block aufheben
CREATE OR REPLACE FUNCTION public.unblock_cohost(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid := auth.uid();
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.live_cohost_blocks
   WHERE host_id = v_host
     AND blocked_user_id = p_user_id;
END;
$$;

-- Prüfen ob ein User vom Host geblockt ist (used by approve_cohost trigger below).
-- Nicht SECURITY DEFINER — wird von approve_cohost aufgerufen, läuft also bereits
-- als DEFINER. Kann aber auch direkt vom Client gelesen werden (RLS regelt das).
CREATE OR REPLACE FUNCTION public.is_cohost_blocked(
  p_host_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_cohost_blocks
     WHERE host_id = p_host_id
       AND blocked_user_id = p_user_id
       AND (expires_at IS NULL OR expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.block_cohost(uuid, text, int)  FROM public, anon;
REVOKE ALL ON FUNCTION public.unblock_cohost(uuid)            FROM public, anon;
REVOKE ALL ON FUNCTION public.is_cohost_blocked(uuid, uuid)   FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.block_cohost(uuid, text, int) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.unblock_cohost(uuid)          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_cohost_blocked(uuid, uuid) TO authenticated;

-- ─── 4. approve_cohost: Block-Check einbauen ──────────────────────
-- Bestehende Function aus 20260417020000_live_cohosts.sql ersetzen,
-- diesmal mit Block-Check.
CREATE OR REPLACE FUNCTION public.approve_cohost(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid := auth.uid();
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
     WHERE id = p_session_id
       AND host_id = v_host
       AND status  = 'active'
  ) THEN
    RAISE EXCEPTION 'Nicht Host dieser aktiven Session'
      USING ERRCODE = '42501';
  END IF;

  -- Phase 5: Block-Check. Geblockte User können NICHT als Co-Host
  -- approved werden. Der Host bekommt einen klaren Fehler und die
  -- UI kann entsprechend reagieren.
  IF public.is_cohost_blocked(v_host, p_user_id) THEN
    RAISE EXCEPTION 'User ist blockiert — erst entblocken in den Einstellungen'
      USING ERRCODE = '42501', HINT = 'blocked';
  END IF;

  INSERT INTO public.live_cohosts (session_id, user_id, invited_by)
  VALUES (p_session_id, p_user_id, v_host)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET invited_by  = EXCLUDED.invited_by,
        approved_at = now(),
        revoked_at  = NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_cohost(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.approve_cohost(uuid, uuid) TO authenticated;

-- ─── 5. Verifikations-Snippets ────────────────────────────────────
-- -- Block setzen (als Host):
-- SELECT block_cohost('<user-uuid>', 'Spam', 24);   -- 24h Block
-- SELECT block_cohost('<user-uuid>', 'DMCA');       -- permanent
-- -- Check:
-- SELECT is_cohost_blocked(auth.uid(), '<user-uuid>');
-- -- Unblock:
-- SELECT unblock_cohost('<user-uuid>');
