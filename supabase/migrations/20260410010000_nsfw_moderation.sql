-- Migration: NSFW content moderation fields
-- Adds is_flagged, flag_reason, is_visible columns to posts table

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_flagged   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason  text,
  -- TRUE = optimistic posting (wie Instagram/TikTok)
  -- NSFW wird retroaktiv via Edge Function entfernt
  ADD COLUMN IF NOT EXISTS is_visible   boolean NOT NULL DEFAULT true;

-- Index für schnelle Feed-Filterung (nur sichtbare Posts)
CREATE INDEX IF NOT EXISTS posts_is_visible_created_idx
  ON posts (created_at DESC) WHERE is_visible = true;

-- ── Server-seitiger Webhook-Trigger (bypass-proof) ──────────────────────────
-- pg_net muss aktiviert sein: enable_extension 'pg_net' in Supabase Dashboard

CREATE OR REPLACE FUNCTION trigger_nsfw_moderation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _url text;
  _anon_key text;
BEGIN
  -- Nur Bilder moderieren (Videos brauchen separate Pipeline)
  IF NEW.media_type = 'image' AND NEW.media_url IS NOT NULL THEN
    _url      := current_setting('app.supabase_url',   true);
    _anon_key := current_setting('app.service_role_key', true);

    -- Asynchroner HTTP-Call via pg_net → Edge Function
    -- ⚠️ KRITISCH: timeout muss > Edge Function Laufzeit sein
    -- HF cold start: 20s + Bild laden: 5s + Inference: 5s = ~30s minimum
    -- Default wäre 2000ms → silent timeout! Wir setzen 55s (unter EF-Limit 60s)
    PERFORM net.http_post(
      url     := _url || '/functions/v1/moderate-image',
      body    := json_build_object(
                   'post_id',   NEW.id,
                   'image_url', NEW.media_url
                 )::text,
      headers := json_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || _anon_key
                 ),
      timeout_milliseconds := 55000
    );
  ELSE
    -- Videos und Text-Posts sofort freischalten
    UPDATE posts SET is_visible = true WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger feuert NACH Insert (kein BEFORE → keine Latenz für den User)
DROP TRIGGER IF EXISTS on_post_insert_moderate ON posts;
CREATE TRIGGER on_post_insert_moderate
  AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION trigger_nsfw_moderation();

-- RLS: is_visible = false Rows bleiben für Owner sichtbar, für alle anderen nicht
-- (Eigener Post = "wird geprüft" Banner möglich)

