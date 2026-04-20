-- ================================================================
-- v1.24.0 — Live Viewer-Welcome-Events
-- ================================================================
-- TikTok zeigt bei Live-Streams einen kleinen Toast am unteren Rand
-- des Chats, wenn ein Follower oder Top-Fan (jemand der früher schon
-- Gifts zum Host geschickt hat) den Stream betritt:
--
--   "✨ @username hat den Stream betreten"
--
-- Regeln:
--   • Nicht für den Host selbst.
--   • Nicht für anonyme / nicht-folgende Viewer (sonst Spam).
--   • Pro (Session, User) nur EIN Welcome-Event, selbst wenn der
--     Viewer die Session mehrmals betritt/verlässt (Network-Blip,
--     App-Hintergrund, Re-Join nach Ad-Break…).
--
-- Diese Migration schafft das DB-Fundament:
--   1. Tabelle `live_viewer_welcomes` — persistenter Dedup-Anker
--      pro Session + User. UNIQUE(session_id, user_id).
--   2. RPC `try_welcome_viewer(p_session_id)` — Idempotent. Berechnet
--      Tier (host | top_fan | follower | null), versucht Insert mit
--      ON CONFLICT DO NOTHING und liefert das Ergebnis als JSONB an
--      den Client. Nur bei frisch-eingefügter Zeile mit qualifiziertem
--      Tier bekommt der Client eine "announce"-Antwort.
--
-- Broadcast selbst läuft NICHT via DB — der Client sendet das
-- Welcome-Event über den bestehenden `live-comments-{id}` Realtime
-- Channel (neuer `event: 'welcome-join'`). Das hält die DB-Schreiblast
-- minimal und reused bestehende Subscriptions.
-- ================================================================


-- ─── 1. Tabelle: live_viewer_welcomes ────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_viewer_welcomes (
  session_id  uuid        NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  tier        text        NOT NULL CHECK (tier IN ('follower', 'top_fan')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_viewer_welcomes_session
  ON public.live_viewer_welcomes (session_id, created_at DESC);

ALTER TABLE public.live_viewer_welcomes ENABLE ROW LEVEL SECURITY;

-- Keine Client-Schreibpfade: Inserts laufen exklusiv über die RPC.
-- Lesen erlaubt (z.B. für Analytics oder um den "Welcome-Feed" zu
-- rendern, falls später gewollt).
DROP POLICY IF EXISTS "live_viewer_welcomes_read_all" ON public.live_viewer_welcomes;
CREATE POLICY "live_viewer_welcomes_read_all"
  ON public.live_viewer_welcomes
  FOR SELECT
  USING (true);

COMMENT ON TABLE  public.live_viewer_welcomes IS
  'Dedup-Tracker für TikTok-Style Welcome-Toasts beim Join in eine Live-Session (v1.24).';
COMMENT ON COLUMN public.live_viewer_welcomes.tier IS
  'Qualifizierendes Tier beim Erst-Join: follower | top_fan. Viewer ohne Tier erzeugen KEINE Zeile.';


-- ─── 2. RPC: try_welcome_viewer ─────────────────────────────────
-- Vom Client beim Betreten der Session aufgerufen. Atomarer Ablauf:
--   1. Session aktiv? Sonst {tier:null}.
--   2. Caller = Host? Sonst {tier:null} (Host welcomed sich nicht selbst).
--   3. Tier bestimmen:
--      • 'top_fan' wenn Caller jemals Gifts an den Host geschickt hat
--        (gift_transactions.sender_id=caller AND recipient_id=host).
--      • 'follower' wenn Caller in follows.following_id=host auftaucht.
--      • null sonst → {tier:null}, kein Welcome.
--   4. INSERT in live_viewer_welcomes ON CONFLICT DO NOTHING.
--      Wenn NICHTS eingefügt wurde (bereits welcomed diese Session)
--      → {tier:null}.
--   5. Sonst → {tier, username, avatar_url} an Client zurück, der
--      dann selbst das Broadcast-Event schickt.
--
-- Rückgabe als JSONB, damit das Client-Parsing simpel bleibt.
CREATE OR REPLACE FUNCTION public.try_welcome_viewer(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_host        uuid;
  v_status      text;
  v_tier        text;
  v_inserted    boolean;
  v_username    text;
  v_avatar_url  text;
BEGIN
  -- Nicht eingeloggt → still, kein Toast.
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Session laden.
  SELECT s.host_id, s.status
    INTO v_host, v_status
    FROM public.live_sessions s
   WHERE s.id = p_session_id;

  IF v_host IS NULL THEN
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Nur bei aktiven Sessions welcomen (ended/idle → kein Toast).
  IF v_status <> 'active' THEN
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Host meldet sich nicht selbst an.
  IF v_caller = v_host THEN
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Tier berechnen: top_fan schlägt follower.
  IF EXISTS (
    SELECT 1
      FROM public.gift_transactions g
     WHERE g.sender_id    = v_caller
       AND g.recipient_id = v_host
     LIMIT 1
  ) THEN
    v_tier := 'top_fan';
  ELSIF EXISTS (
    SELECT 1
      FROM public.follows f
     WHERE f.follower_id  = v_caller
       AND f.following_id = v_host
     LIMIT 1
  ) THEN
    v_tier := 'follower';
  ELSE
    -- Regulärer Viewer → kein Toast, kein DB-Write.
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Idempotent einfügen. Wenn bereits vorhanden → kein Toast.
  INSERT INTO public.live_viewer_welcomes (session_id, user_id, tier)
  VALUES (p_session_id, v_caller, v_tier)
  ON CONFLICT (session_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    -- Schon welcomed diese Session → still.
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Profilinfos für den Toast mitgeben (Client muss sonst eine
  -- extra Query machen).
  SELECT p.username, p.avatar_url
    INTO v_username, v_avatar_url
    FROM public.profiles p
   WHERE p.id = v_caller;

  RETURN jsonb_build_object(
    'tier',       v_tier,
    'user_id',    v_caller,
    'username',   v_username,
    'avatar_url', v_avatar_url
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.try_welcome_viewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_welcome_viewer(uuid) TO authenticated;

COMMENT ON FUNCTION public.try_welcome_viewer(uuid) IS
  'Idempotenter Welcome-Check: liefert {tier,username,avatar_url} nur bei qualifiziertem Erst-Join (v1.24). Client broadcastet dann selbst.';


-- ─── PostgREST Schema-Reload ─────────────────────────────────────
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ v1.24 live_viewer_welcomes deployed (table + try_welcome_viewer RPC)';
END $$;

-- ─── Smoke-Test (manuell, nicht Teil der Migration) ──────────────
-- Introspection der neuen RPC:
-- SELECT proname, pronargs
--   FROM pg_proc
--  WHERE proname = 'try_welcome_viewer';
--
-- Manueller Test aus psql/SQL-Editor (ersetze UUID durch eine echte aktive Session):
-- SELECT public.try_welcome_viewer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid);
--
-- Erwartete Ausgabe für Follower: {"tier":"follower","user_id":"…","username":"…","avatar_url":"…"}
-- Für zweiten Aufruf derselben Session:      {"tier":null}
