-- ════════════════════════════════════════════════════════════
-- voice-posts Storage Bucket + Policies
-- Im Supabase SQL Editor ausführen
-- ════════════════════════════════════════════════════════════

-- 1. Bucket erstellen (public, da Audio-URLs direkt im App abgespielt werden)
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-posts', 'voice-posts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Edge Function (Service Role) darf hochladen
CREATE POLICY "service_role kann hochladen"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'voice-posts');

CREATE POLICY "service_role kann aktualisieren"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'voice-posts');

-- 3. Jeder kann public Audio-Dateien lesen
CREATE POLICY "public kann lesen"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'voice-posts');
