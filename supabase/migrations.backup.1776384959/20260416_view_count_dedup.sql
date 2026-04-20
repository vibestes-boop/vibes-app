-- ================================================================
-- Hotfix: increment_post_view() Authentication + Deduplication
-- Audit-Finding 3.1 — View-Gaming ohne Auth + Dedup möglich
-- ================================================================
--
-- Vorher: jeder (auch anon) konnte view_count beliebig hochfahren.
-- Nachher: nur authenticated User, max. 1 View pro (User, Post).
-- ================================================================

-- ─── 1. Dedup-Log Tabelle ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_views_log (
  post_id    uuid        NOT NULL REFERENCES public.posts(id)    ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_views_log_user_id
  ON public.post_views_log (user_id);

-- ─── 2. Row Level Security ───────────────────────────────────────
ALTER TABLE public.post_views_log ENABLE ROW LEVEL SECURITY;

-- User darf nur eigene View-Einträge sehen
DROP POLICY IF EXISTS "post_views_log_select_own" ON public.post_views_log;
CREATE POLICY "post_views_log_select_own"
  ON public.post_views_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Kein direkter INSERT/UPDATE/DELETE für Clients — läuft nur über
-- die SECURITY DEFINER RPC unten.

-- ─── 3. RPC mit Auth-Guard + Dedup ───────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_post_view(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid   := auth.uid();
  v_row_count  bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  -- Insert; wenn (post_id, user_id) bereits existiert -> no-op
  INSERT INTO public.post_views_log (post_id, user_id)
  VALUES (p_post_id, v_user_id)
  ON CONFLICT (post_id, user_id) DO NOTHING;

  -- Nur hochzählen wenn der Insert tatsächlich eine neue Zeile schrieb
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count > 0 THEN
    UPDATE public.posts
       SET view_count = view_count + 1
     WHERE id = p_post_id;
  END IF;
END;
$$;

-- Execute-Rechte: nur authentifizierte User
REVOKE ALL ON FUNCTION public.increment_post_view(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.increment_post_view(uuid) TO authenticated;

-- ─── 4. Verifikation (manuell im SQL Editor ausführen) ───────────
-- SELECT proname, prosecdef, proconfig
--   FROM pg_proc
--  WHERE proname = 'increment_post_view';
-- -> prosecdef = true, proconfig = {search_path=public}
--
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid)
--   FROM pg_policy
--  WHERE polrelid = 'public.post_views_log'::regclass;
