-- 20260625130000_chat_images_bucket.sql
-- Chat-Bild-Upload: öffentlicher Storage-Bucket `chat-images` + RLS.
--
-- Kontext: Der Web-Chat-Composer lädt Bilder nach `chat-images` hoch
-- (apps/web: requestImageUploadPath → client.storage.from('chat-images').upload).
-- Der Bucket war aber nie per Migration angelegt → Upload schlug fehl
-- ("Upload fehlgeschlagen."). GIFs betrifft es nicht (Giphy-URL, kein Upload).
--
-- Öffentlich, weil der Chat-Partner das Bild via Public-URL lädt (getPublicUrl);
-- der Pfad enthält eine unrätselbare UUID. Upload nur in den EIGENEN Ordner
-- ({userId}/…), 10 MB Limit (= Web-Client-Check), nur Bild-MIME.

-- ── 1. Bucket anlegen (öffentlich, 10 MB, nur Bilder) ───────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images', 'chat-images', true, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public            = true,
      file_size_limit   = 10485760,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. Storage-RLS (storage.objects ist standardmäßig RLS-aktiv) ────────────
-- Lesen läuft bei öffentlichen Buckets über die Public-URL (ohne RLS), daher
-- brauchen wir nur Insert/Update/Delete-Policies für den eigenen Ordner.

DROP POLICY IF EXISTS "chat_images_insert_own" ON storage.objects;
CREATE POLICY "chat_images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat_images_update_own" ON storage.objects;
CREATE POLICY "chat_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat_images_delete_own" ON storage.objects;
CREATE POLICY "chat_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DO $$
BEGIN
  RAISE NOTICE '✅ chat-images Bucket + RLS deployed (Web/App Chat-Bild-Upload)';
END $$;
