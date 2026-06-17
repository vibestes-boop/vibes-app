-- 20260617220000_bunny_stream_columns.sql
--
-- Bunny Stream (Video-ABR/HLS) — ADDITIVE Spalten auf posts.
-- R2 (`media_url`) bleibt die primäre Quelle + Sofort-Fallback; Bunny liefert
-- adaptives HLS, sobald transkodiert. Kein bestehender Pfad ändert sich.
--
-- Ablauf: Upload → R2 (unverändert) → Edge-Fn `bunny-ingest` lässt Bunny das
-- Video aus der öffentlichen R2-URL fetchen → `bunny_status='pending'` → Bunny
-- transkodiert → Webhook (`bunny-webhook`) setzt `bunny_video_id` + 'ready'.
-- Die HLS-URL wird im Client aus guid + CDN-Host berechnet:
--   https://vz-6857f4f1-6d5.b-cdn.net/{bunny_video_id}/playlist.m3u8

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS bunny_status   TEXT;
-- bunny_status: NULL = nicht ingested | 'pending' = transkodiert | 'ready' | 'failed'

-- Webhook + Backfill suchen per guid → Partial-Index (nur Posts mit Bunny-Video).
CREATE INDEX IF NOT EXISTS idx_posts_bunny_video_id
  ON public.posts (bunny_video_id) WHERE bunny_video_id IS NOT NULL;

-- Backfill-Helfer: schnell die noch-nicht-ingesteten Video-Posts finden.
CREATE INDEX IF NOT EXISTS idx_posts_bunny_pending
  ON public.posts (created_at DESC)
  WHERE bunny_status IS NULL AND media_type = 'video';
