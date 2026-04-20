-- ================================================================
-- v1.18.0 — Live-Polls (Umfragen im Stream)
-- ================================================================
-- Host startet während eines Streams eine 2-4-Optionen-Umfrage.
-- Viewer stimmen genau einmal ab, Ergebnisse werden live via
-- Supabase Realtime (postgres_changes) an alle Clients gepusht.
--
-- Design:
--   • Eine aktive Poll pro Session gleichzeitig (closed_at IS NULL)
--   • Poll speichert Optionen als JSONB-Array: ["Pizza","Burger","Sushi"]
--   • Votes: einzelne Zeile pro User → UNIQUE(poll_id, user_id)
--   • Aggregation via SQL-View pro Poll (option_index → count)
-- ================================================================

-- ─── 1. live_polls ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question    TEXT NOT NULL CHECK (char_length(question) BETWEEN 3 AND 140),
  options     JSONB NOT NULL CHECK (
                jsonb_typeof(options) = 'array'
                AND jsonb_array_length(options) BETWEEN 2 AND 4
              ),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_live_polls_session_active
  ON public.live_polls (session_id, created_at DESC)
  WHERE closed_at IS NULL;

ALTER TABLE public.live_polls ENABLE ROW LEVEL SECURITY;

-- Alle dürfen laufende/alte Polls lesen
CREATE POLICY "live_polls_select"
  ON public.live_polls FOR SELECT USING (true);

-- Nur der Host der Session darf Polls anlegen
CREATE POLICY "live_polls_insert"
  ON public.live_polls FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

-- Nur der Host darf seine eigene Poll schließen (closed_at setzen)
CREATE POLICY "live_polls_update"
  ON public.live_polls FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "live_polls_delete"
  ON public.live_polls FOR DELETE
  USING (auth.uid() = host_id);

-- Realtime für Poll-Status (new poll / closed_at update)
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_polls;

-- ─── 2. live_poll_votes ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_poll_votes (
  poll_id       UUID NOT NULL REFERENCES public.live_polls(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_index  INT  NOT NULL CHECK (option_index BETWEEN 0 AND 3),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_poll_votes_poll
  ON public.live_poll_votes (poll_id);

ALTER TABLE public.live_poll_votes ENABLE ROW LEVEL SECURITY;

-- Alle authenticated dürfen Votes aggregiert lesen (für Live-Ergebnisse)
CREATE POLICY "live_poll_votes_select"
  ON public.live_poll_votes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Jeder authentifizierte User darf EINMAL abstimmen (PK verhindert Doppel)
CREATE POLICY "live_poll_votes_insert"
  ON public.live_poll_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.live_polls p
       WHERE p.id = poll_id AND p.closed_at IS NULL
    )
  );

-- Abstimmungen können nicht geändert/gelöscht werden (Anti-Manipulation)

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_poll_votes;

-- ─── 3. Aggregations-View ──────────────────────────────────────
-- option_index → count, pro Poll. Ermöglicht einen einzigen Select
-- um live Prozentwerte zu rendern.

CREATE OR REPLACE VIEW public.live_poll_tallies AS
SELECT
  v.poll_id,
  v.option_index,
  COUNT(*)::INT AS vote_count
FROM public.live_poll_votes v
GROUP BY v.poll_id, v.option_index;

GRANT SELECT ON public.live_poll_tallies TO authenticated;

-- ─── 4. RPC: aktive Poll inkl. Tallies in einem Roundtrip ──────

CREATE OR REPLACE FUNCTION public.get_active_poll(p_session_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH p AS (
    SELECT id, question, options, created_at, closed_at
      FROM public.live_polls
     WHERE session_id = p_session_id
       AND closed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1
  ),
  t AS (
    SELECT option_index, vote_count
      FROM public.live_poll_tallies
     WHERE poll_id = (SELECT id FROM p)
  )
  SELECT
    CASE WHEN NOT EXISTS (SELECT 1 FROM p) THEN NULL
    ELSE jsonb_build_object(
      'id',         (SELECT id FROM p),
      'question',   (SELECT question FROM p),
      'options',    (SELECT options FROM p),
      'created_at', (SELECT created_at FROM p),
      'tallies',    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('option_index', option_index, 'vote_count', vote_count)) FROM t),
        '[]'::jsonb
      )
    )
    END
$$;

GRANT EXECUTE ON FUNCTION public.get_active_poll(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Live-Polls deployed (v1.18.0)';
END $$;
