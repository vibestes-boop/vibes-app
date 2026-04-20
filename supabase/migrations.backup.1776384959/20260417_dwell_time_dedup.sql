-- ================================================================
-- Hotfix: update_dwell_time() Authentication + Deduplication
-- Audit-Finding 3.2 — Algorithm-Gaming via unauthentifiziertem RPC
-- ================================================================
--
-- Vorher: jeder (auch anon) konnte dwell_time_score beliebig pushen.
--         Score ist im Feed-Algorithmus mit 0.45 gewichtet — die
--         manipulierbarste Variable mit stärkstem Ranking-Einfluss.
-- Nachher: nur authenticated User. Je (User, Post) wird das
--         EMA-Signal genau EINMAL angewendet. Folge-Calls aktualisieren
--         nur den Log-Eintrag (beobachtbar für ML/Analytics), lassen
--         aber den Ranking-Score unberührt.
-- ================================================================

-- ─── 1. Dedup-Log Tabelle ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_dwell_log (
  post_id       uuid        NOT NULL REFERENCES public.posts(id)    ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_dwell_ms integer     NOT NULL DEFAULT 0,
  observed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_dwell_log_user_id
  ON public.post_dwell_log (user_id);

-- ─── 2. Row Level Security ───────────────────────────────────────
ALTER TABLE public.post_dwell_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_dwell_log_select_own" ON public.post_dwell_log;
CREATE POLICY "post_dwell_log_select_own"
  ON public.post_dwell_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Kein direkter INSERT/UPDATE/DELETE für Clients — nur via SECURITY DEFINER RPC.

-- ─── 3. RPC mit Auth-Guard + Dedup ───────────────────────────────
CREATE OR REPLACE FUNCTION public.update_dwell_time(
  post_id  uuid,
  dwell_ms integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid    := auth.uid();
  v_capped_ms integer;
  v_fresh     boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  -- Input sanitizen: keine Negativwerte, Cap bei 60s (Ausreißer dämpfen)
  v_capped_ms := GREATEST(0, LEAST(COALESCE(dwell_ms, 0), 60000));

  -- Atomarer Upsert.  `xmax = 0` auf dem zurückgegebenen Tupel signalisiert
  -- "frisch eingefügt"; bei ON CONFLICT DO UPDATE setzt PostgreSQL xmax
  -- auf die aktuelle Transaktions-ID (> 0).
  WITH upsert AS (
    INSERT INTO public.post_dwell_log (post_id, user_id, last_dwell_ms)
    VALUES (update_dwell_time.post_id, v_user_id, v_capped_ms)
    ON CONFLICT (post_id, user_id) DO UPDATE
      SET last_dwell_ms = EXCLUDED.last_dwell_ms,
          observed_at   = now()
    RETURNING (xmax = 0) AS was_insert
  )
  SELECT was_insert INTO v_fresh FROM upsert;

  -- EMA-Update NUR bei erstmaliger Beobachtung dieses (User, Post)-Paars.
  -- Formel: new = old * 0.85 + (min(dwell,60000) / 20000.0) * 0.15
  IF v_fresh THEN
    UPDATE public.posts
       SET dwell_time_score = COALESCE(dwell_time_score, 0) * 0.85
                            + (v_capped_ms::float / 20000.0) * 0.15
     WHERE id = update_dwell_time.post_id;
  END IF;
END;
$$;

-- ─── 4. Execute-Rechte ───────────────────────────────────────────
REVOKE ALL ON FUNCTION public.update_dwell_time(uuid, integer) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.update_dwell_time(uuid, integer) TO authenticated;

-- ─── 5. Verifikation (manuell im SQL Editor) ─────────────────────
-- SELECT proname, prosecdef, proconfig
--   FROM pg_proc
--  WHERE proname = 'update_dwell_time';
-- → prosecdef=true, proconfig={search_path=public}
--
-- -- Muss als anon fehlschlagen:
-- SELECT update_dwell_time('00000000-0000-0000-0000-000000000000'::uuid, 5000);
-- → ERROR 28000 'Not authenticated'
--
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid)
--   FROM pg_policy
--  WHERE polrelid = 'public.post_dwell_log'::regclass;
