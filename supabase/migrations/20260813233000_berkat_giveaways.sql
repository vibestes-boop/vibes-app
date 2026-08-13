-- ═══════════════════════════════════════════════════════════════════════════
-- Berkat — Giveaways
--
-- Whatnots sichtbarster Mechanismus: „🎁 107 Teilnahmen" oben rechts im Raum.
-- Er füllt die Show, bevor überhaupt jemand kauft, und macht aus Zuschauern
-- Follower.
--
-- DIE TEILNAHME IST IMMER KOSTENLOS. Das ist keine Design-Laune, sondern die
-- Trennlinie: Einsatz + Zufall + Gewinn ist Glücksspiel. Ohne Einsatz ist es
-- ein Gewinnspiel. Deshalb gibt es hier bewusst KEINE Möglichkeit, Teilnahmen
-- zu kaufen, und auch keinen Kauf als Bedingung — erlaubt ist höchstens
-- „folgen", so wie bei Whatnot.
--
-- Gezogen wird auf dem Server. Ein Client, der den Gewinner bestimmt, wäre in
-- fünf Minuten manipuliert.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.live_giveaways (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),
  image_url   text,
  /** Einzige erlaubte Bedingung. Ein Kauf als Bedingung wäre Glücksspiel. */
  requires_follow boolean NOT NULL DEFAULT true,
  status      text NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'drawn', 'cancelled')),
  entry_count int  NOT NULL DEFAULT 0,
  winner_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  drawn_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Höchstens ein offenes Giveaway pro Show — dieselbe Disziplin wie bei den
-- Auktionen: zwei gleichzeitige Aufmerksamkeits-Anker heben sich auf.
CREATE UNIQUE INDEX IF NOT EXISTS live_giveaways_one_open
  ON public.live_giveaways (session_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS live_giveaways_session
  ON public.live_giveaways (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.live_giveaway_entries (
  giveaway_id uuid NOT NULL REFERENCES public.live_giveaways(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (giveaway_id, user_id)
);

-- ─── Teilnahmezähler ────────────────────────────────────────────────────────
-- Steht auf der Giveaway-Zeile, damit Zuschauer die Zahl sehen können, ohne
-- die Teilnehmerliste lesen zu dürfen.
CREATE OR REPLACE FUNCTION public.incr_giveaway_entries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.live_giveaways
     SET entry_count = entry_count + 1
   WHERE id = NEW.giveaway_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_incr_giveaway_entries ON public.live_giveaway_entries;
CREATE TRIGGER trg_incr_giveaway_entries
  AFTER INSERT ON public.live_giveaway_entries
  FOR EACH ROW EXECUTE FUNCTION public.incr_giveaway_entries();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.live_giveaways        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_giveaway_entries ENABLE ROW LEVEL SECURITY;

-- Sichtbarkeit erbt von der Session — kein USING(true), sonst hebelt es die
-- Frauen-Only-Grenze per OR aus.
DROP POLICY IF EXISTS live_giveaways_select ON public.live_giveaways;
CREATE POLICY live_giveaways_select ON public.live_giveaways
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_giveaways.session_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

-- Teilnehmerliste sieht nur, wer selbst drinsteht. Wer alle Teilnehmer lesen
-- könnte, könnte auch abschätzen, wie hoch seine Chance ist — und wichtiger:
-- die Liste ist eine Sammlung von Nutzern, die nichts miteinander zu tun haben.
DROP POLICY IF EXISTS live_giveaway_entries_select_own ON public.live_giveaway_entries;
CREATE POLICY live_giveaway_entries_select_own ON public.live_giveaway_entries
  FOR SELECT USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.live_giveaways        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.live_giveaway_entries FROM anon, authenticated;
REVOKE SELECT ON public.live_giveaway_entries FROM anon;

-- ─── Giveaway eröffnen ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_live_giveaway(
  p_session_id      uuid,
  p_title           text,
  p_image_url       text DEFAULT NULL,
  p_requires_follow boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_host uuid;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT host_id INTO v_host FROM public.live_sessions WHERE id = p_session_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.live_giveaways
     WHERE session_id = p_session_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'giveaway_already_open' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_giveaways (session_id, host_id, title, image_url, requires_follow)
  VALUES (p_session_id, v_uid, btrim(p_title), p_image_url, p_requires_follow)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_live_giveaway(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_live_giveaway(uuid, text, text, boolean) TO authenticated;

-- ─── Mitmachen ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enter_live_giveaway(p_giveaway_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g     public.live_giveaways;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO g FROM public.live_giveaways WHERE id = p_giveaway_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'giveaway_not_found' USING ERRCODE = '22023';
  END IF;
  IF g.status <> 'open' THEN
    RAISE EXCEPTION 'giveaway_closed' USING ERRCODE = '22023';
  END IF;
  IF g.host_id = v_uid THEN
    RAISE EXCEPTION 'host_cannot_enter' USING ERRCODE = '42501';
  END IF;

  IF g.requires_follow AND NOT EXISTS (
    SELECT 1 FROM public.follows
     WHERE follower_id = v_uid AND following_id = g.host_id
  ) THEN
    RAISE EXCEPTION 'follow_required' USING ERRCODE = '42501';
  END IF;

  -- Doppelte Teilnahme ist keine Fehlbedienung, sondern ein zweiter Tipp.
  INSERT INTO public.live_giveaway_entries (giveaway_id, user_id)
  VALUES (p_giveaway_id, v_uid)
  ON CONFLICT DO NOTHING;

  SELECT * INTO g FROM public.live_giveaways WHERE id = p_giveaway_id;

  RETURN jsonb_build_object('giveaway_id', g.id, 'entry_count', g.entry_count, 'entered', true);
END $$;

REVOKE ALL ON FUNCTION public.enter_live_giveaway(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enter_live_giveaway(uuid) TO authenticated;

-- ─── Gewinner ziehen ────────────────────────────────────────────────────────
-- Auf dem Server. Ein Client, der den Gewinner bestimmt, wäre manipulierbar.
CREATE OR REPLACE FUNCTION public.draw_live_giveaway(p_giveaway_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g        public.live_giveaways;
  v_uid    uuid := auth.uid();
  v_winner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO g FROM public.live_giveaways WHERE id = p_giveaway_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'giveaway_not_found' USING ERRCODE = '22023';
  END IF;
  IF g.host_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF g.status <> 'open' THEN
    RAISE EXCEPTION 'giveaway_closed' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_winner
    FROM public.live_giveaway_entries
   WHERE giveaway_id = p_giveaway_id
   ORDER BY random()
   LIMIT 1;

  UPDATE public.live_giveaways
     SET status    = 'drawn',
         winner_id = v_winner,
         drawn_at  = now()
   WHERE id = p_giveaway_id;

  RETURN jsonb_build_object(
    'giveaway_id', p_giveaway_id,
    'winner_id',   v_winner,
    'entry_count', g.entry_count
  );
END $$;

REVOKE ALL ON FUNCTION public.draw_live_giveaway(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_live_giveaway(uuid) TO authenticated;

-- ─── Realtime ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'live_giveaways'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_giveaways;
  END IF;
END $$;

ALTER TABLE public.live_giveaways REPLICA IDENTITY FULL;

COMMENT ON TABLE public.live_giveaways IS
  'Berkat: Gewinnspiel im Stream. Teilnahme immer kostenlos — sonst wäre es Glücksspiel.';
