-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Backfill thumbnail_url für bestehende Bild-Posts
-- Datum: 2026-04-22
--
-- HINTERGRUND
-- -----------
-- Der Web-Create-Editor (`apps/web/components/create/create-editor.tsx`) hat
-- bis zum Deploy vom 2026-04-22 bei Bild-Uploads `thumbnail_url` auf NULL
-- gelassen — der Thumbnail-Extraktions-Block war mit `if (mType === 'video')`
-- gegated, ohne else-Branch für Bilder. Mobile posted zwar auch Bild-Posts,
-- aber ebenfalls ohne thumbnail_url.
--
-- FOLGE IM UI
-- -----------
--   • Profil-Grid (`components/profile/post-grid.tsx`): zeigt Next/Image mit
--     Broken-Image-Icon oder Gradient-Fallback statt des Bildes.
--   • Explore-Seite: Fallback-Kachel mit Avatar-Letter.
--   • Feed (`FeedCard`): <video src=bildurl> → leerer Frame (jetzt per Code-
--     Fix mit isImage-Conditional-Render gelöst, aber Thumbnail-URL fehlt
--     dort auch für den Blur-Backdrop-Fallback).
--
-- FIX
-- ---
-- Für Bild-Posts reicht die `media_url` identisch als `thumbnail_url` — R2
-- served beide URLs vom gleichen Objekt. Wir setzen das nur dort wo:
--   (1) media_type = 'image'  (kein Video-Post)
--   (2) thumbnail_url IS NULL (nicht überschreiben falls jemand mal einen
--       Custom-Cover gesetzt hat — derzeit keine UI dafür, aber defensiv)
--   (3) media_url IS NOT NULL (Integrity-Guard, ohne Quelle kein Thumb)
--
-- Diese Migration ist idempotent: wiederholte Ausführung macht nichts
-- Zusätzliches weil nach dem ersten Lauf keine Rows mehr matchen.
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE public.posts
   SET thumbnail_url = media_url
 WHERE media_type    = 'image'
   AND thumbnail_url IS NULL
   AND media_url     IS NOT NULL;

DO $$
DECLARE
  v_image_rows_total    BIGINT;
  v_image_rows_with_thumb BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_image_rows_total
    FROM public.posts
   WHERE media_type = 'image';

  SELECT COUNT(*) INTO v_image_rows_with_thumb
    FROM public.posts
   WHERE media_type    = 'image'
     AND thumbnail_url IS NOT NULL;

  RAISE NOTICE
    '✅ Backfill abgeschlossen: % von % image-Posts haben jetzt ein Thumbnail',
    v_image_rows_with_thumb, v_image_rows_total;
END $$;
