-- ================================================================
-- v1.22.3 — Live-Moderator-System
-- ================================================================
-- Host kann aus den Zuschauern einzelne User zum "Moderator" für
-- SEINE Session ernennen. Das Badge taucht im ViewerListSheet
-- (TikTok-Style Top-Zuschauer*innen) und später auch in der Chat-
-- Row auf. Die eigentliche Moderation (Timeout, Pin, Ban) läuft
-- weiterhin über die bestehenden RPCs; diese Tabelle entscheidet
-- nur, WER als Mod flagged ist.
--
-- Session-scoped, nicht global — wer in Stream A Mod ist, ist das
-- in Stream B nicht automatisch. Beim Session-End bleibt der Eintrag
-- für History, wird aber bei Session-Delete kaskadiert entfernt.
-- ================================================================

-- 1) Tabelle ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_moderators (
  session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  granted_by  UUID NOT NULL REFERENCES public.profiles(id),   -- immer der Host
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_moderators_session
  ON public.live_moderators(session_id);

-- 2) RLS --------------------------------------------------------------
ALTER TABLE public.live_moderators ENABLE ROW LEVEL SECURITY;

-- Lesen: alle authentifizierten User dürfen lesen (damit Viewer das
-- Mod-Badge im Sheet sehen können).
DROP POLICY IF EXISTS p_live_moderators_select ON public.live_moderators;
CREATE POLICY p_live_moderators_select
  ON public.live_moderators
  FOR SELECT
  USING (true);

-- Schreiben: KEINE direkte Policy — ausschließlich via RPC
-- (grant_moderator / revoke_moderator, SECURITY DEFINER).

-- 3) RPC: grant_moderator --------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_moderator(
  p_session_id UUID,
  p_user_id    UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_host UUID;
BEGIN
  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_host <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden_not_host' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_host THEN
    RAISE EXCEPTION 'cannot_mod_host' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_moderators (session_id, user_id, granted_by)
  VALUES (p_session_id, p_user_id, v_host)
  ON CONFLICT (session_id, user_id) DO NOTHING;
END $$;

-- 4) RPC: revoke_moderator -------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_moderator(
  p_session_id UUID,
  p_user_id    UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_host UUID;
BEGIN
  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_host <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden_not_host' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.live_moderators
   WHERE session_id = p_session_id AND user_id = p_user_id;
END $$;

-- 5) Permissions ------------------------------------------------------
REVOKE ALL ON FUNCTION public.grant_moderator(UUID, UUID)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_moderator(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_moderator(UUID, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_moderator(UUID, UUID) TO authenticated;

-- 6) Realtime -------------------------------------------------------
-- Tabelle der supabase_realtime Publication hinzufügen, damit
-- Mod-Badges live erscheinen/verschwinden.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_moderators;
  EXCEPTION WHEN duplicate_object THEN
    -- Tabelle ist bereits Teil der Publication — OK, idempotent
    NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ live_moderators deployed (table + grant/revoke RPCs)';
END $$;
