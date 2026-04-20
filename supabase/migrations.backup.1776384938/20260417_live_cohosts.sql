-- ================================================================
-- Hotfix-Fundament: live_cohosts Whitelist
-- Audit-Finding 3.4 — Co-Host Token-Eskalation
-- ================================================================
--
-- Bisher prüfte die Edge-Function nur, ob der Room existiert — nicht,
-- ob der anfragende User als Co-Host zugelassen war. Jeder
-- authentifizierte User konnte `isCoHost: true` senden und bekam einen
-- Publisher-Token für fremde Streams (DMCA-/Abuse-Risiko).
--
-- Die Edge-Function wird in einem separaten Patch darauf umgestellt,
-- diese Tabelle zu konsultieren. Nur Host darf Co-Hosts whitelisten.
-- ================================================================

-- ─── 1. Tabelle ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_cohosts (
  session_id  uuid        NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  invited_by  uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  approved_at timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,                 -- soft-revoke; non-null = nicht mehr gültig
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_cohosts_user
  ON public.live_cohosts (user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_cohosts_session
  ON public.live_cohosts (session_id)
  WHERE revoked_at IS NULL;

-- ─── 2. RLS ──────────────────────────────────────────────────────
ALTER TABLE public.live_cohosts ENABLE ROW LEVEL SECURITY;

-- Alle können lesen (ist sowieso in-Stream sichtbar wer Co-Host ist).
DROP POLICY IF EXISTS "live_cohosts_select" ON public.live_cohosts;
CREATE POLICY "live_cohosts_select" ON public.live_cohosts
  FOR SELECT USING (true);

-- Insert/Update/Delete nur für den Host der Session.
DROP POLICY IF EXISTS "live_cohosts_insert_host" ON public.live_cohosts;
CREATE POLICY "live_cohosts_insert_host" ON public.live_cohosts
  FOR INSERT
  WITH CHECK (
    auth.uid() = invited_by AND
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_cohosts.session_id
         AND s.host_id = auth.uid()
         AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS "live_cohosts_update_host" ON public.live_cohosts;
CREATE POLICY "live_cohosts_update_host" ON public.live_cohosts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_cohosts.session_id
         AND s.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_cohosts.session_id
         AND s.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "live_cohosts_delete_host" ON public.live_cohosts;
CREATE POLICY "live_cohosts_delete_host" ON public.live_cohosts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_cohosts.session_id
         AND s.host_id = auth.uid()
    )
  );

-- ─── 3. RPC-Helfer für Host ──────────────────────────────────────
-- Host lädt Co-Host ein
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

  INSERT INTO public.live_cohosts (session_id, user_id, invited_by)
  VALUES (p_session_id, p_user_id, v_host)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET invited_by  = EXCLUDED.invited_by,
        approved_at = now(),
        revoked_at  = NULL;
END;
$$;

-- Host entzieht Co-Host Rechte
CREATE OR REPLACE FUNCTION public.revoke_cohost(
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
  ) THEN
    RAISE EXCEPTION 'Nicht Host dieser Session'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_cohosts
     SET revoked_at = now()
   WHERE session_id = p_session_id
     AND user_id    = p_user_id
     AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_cohost(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.revoke_cohost(uuid, uuid)  FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.approve_cohost(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.revoke_cohost(uuid, uuid)  TO authenticated;

-- ─── 4. Verifikations-Snippets ───────────────────────────────────
-- -- Als Host eine eigene aktive Session: approve_cohost(X,Y) → OK
-- -- Als Nicht-Host für fremde Session: → ERRCODE 42501
-- SELECT polname, polcmd FROM pg_policy WHERE polrelid='public.live_cohosts'::regclass;
