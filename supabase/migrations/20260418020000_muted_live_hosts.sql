-- ================================================================
-- v1.17.0 — Go-Live Push Preferences: Muted Live Hosts
-- ================================================================
-- Ein User folgt vielleicht 200 Leuten, aber möchte nur Push-Pings
-- von 20 davon bekommen wenn sie live gehen. Lösung: Muted-Liste.
--
-- Die `notify_followers_on_go_live` Trigger-Funktion wird erweitert,
-- um User in `muted_live_hosts` aus dem Fan-Out zu excluden.
--
-- UI-Integration (v1.17.0):
--   • Settings → Benachrichtigungen: Liste der Follows mit Toggle
--   • Profil eines Creators: Glocken-Icon (an/aus) mit Shortcut
--   • Long-Press auf eine Live-Notification → "Stummschalten"
-- ================================================================

CREATE TABLE IF NOT EXISTS public.muted_live_hosts (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, host_id),
  CHECK (user_id <> host_id)
);

-- Index für den Anti-Join im Trigger (host-first, da pro Go-Live getriggert)
CREATE INDEX IF NOT EXISTS idx_muted_live_hosts_host
  ON public.muted_live_hosts (host_id, user_id);

-- RLS: Nur der User selbst darf seine eigenen Mutes verwalten
ALTER TABLE public.muted_live_hosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own mutes read"   ON public.muted_live_hosts;
DROP POLICY IF EXISTS "own mutes write"  ON public.muted_live_hosts;
DROP POLICY IF EXISTS "own mutes delete" ON public.muted_live_hosts;

CREATE POLICY "own mutes read"
  ON public.muted_live_hosts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "own mutes write"
  ON public.muted_live_hosts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own mutes delete"
  ON public.muted_live_hosts
  FOR DELETE
  USING (user_id = auth.uid());

-- ─── Trigger-Function Update ─────────────────────────────────────
-- Erweitere notify_followers_on_go_live: Follower, die den Host
-- stumm geschaltet haben, fallen aus dem Fan-Out raus.
CREATE OR REPLACE FUNCTION public.notify_followers_on_go_live()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count int;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Anti-Spam: Host hat in den letzten 30min schon pushed? → skip
  SELECT COUNT(*) INTO v_recent_count
    FROM public.notifications
   WHERE sender_id = NEW.host_id
     AND type      = 'live'
     AND created_at > NOW() - INTERVAL '30 minutes';

  IF v_recent_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Fan-Out: Ein notif pro Follower, ABER nicht an User die
  -- diesen Host stumm geschaltet haben.
  INSERT INTO public.notifications (
    recipient_id,
    sender_id,
    type,
    session_id,
    comment_text,
    created_at
  )
  SELECT
    f.follower_id,
    NEW.host_id,
    'live',
    NEW.id,
    NEW.title,
    NOW()
  FROM public.follows f
  WHERE f.following_id = NEW.host_id
    AND f.follower_id <> NEW.host_id
    AND NOT EXISTS (
      SELECT 1 FROM public.muted_live_hosts m
       WHERE m.user_id = f.follower_id
         AND m.host_id = NEW.host_id
    );

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ muted_live_hosts + updated notify_followers_on_go_live (v1.17.0)';
END $$;
