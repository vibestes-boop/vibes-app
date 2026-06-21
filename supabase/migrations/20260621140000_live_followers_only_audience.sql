-- ============================================================================
-- „Nur Follower"-Publikum für Live-Sessions
-- ----------------------------------------------------------------------------
-- Erlaubt dem Host, einen Live-Stream auf „nur Follower" zu stellen. Nur
-- Follower des Hosts bekommen dann ein LiveKit-Token (Durchsetzung in der
-- Edge Function `livekit-token`); Nicht-Follower bleiben auch per Direktlink
-- draußen.
--
-- ⚠️ NICHT verwechseln mit der bereits existierenden Spalte
-- `followers_only_chat` — die steuert nur, wer im Live-Chat SCHREIBEN darf.
-- `followers_only` steuert, wer überhaupt ZUSCHAUEN darf.
-- ============================================================================

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS followers_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.live_sessions.followers_only IS
  'Wenn true: nur Follower des Hosts bekommen ein LiveKit-Token (Zuschauen). '
  'Durchsetzung in Edge Function livekit-token. Unterscheidet sich von '
  'followers_only_chat (steuert nur das Schreibrecht im Chat).';

-- Partial-Index analog women_only — schlanker Filter für Discovery/Listings,
-- die „nur Follower"-Lives gesondert behandeln wollen.
CREATE INDEX IF NOT EXISTS idx_live_sessions_followers_only
  ON public.live_sessions USING btree (followers_only)
  WHERE (followers_only = true);
