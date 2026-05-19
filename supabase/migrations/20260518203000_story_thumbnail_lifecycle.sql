-- VIBES — Story thumbnail lifecycle
--
-- Story previews must be explicit. Image stories can safely reuse their
-- already-compressed media object as thumbnail_url; video stories still need a
-- generated JPEG thumbnail from the upload/backfill pipeline.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

UPDATE public.stories
   SET thumbnail_url = media_url
 WHERE media_type = 'image'
   AND media_url IS NOT NULL
   AND media_url <> ''
   AND (thumbnail_url IS NULL OR thumbnail_url = '');

COMMENT ON COLUMN public.stories.thumbnail_url IS
  'Explicit preview image used by feeds/admin dashboards. Image stories may reuse media_url; video stories require generated JPEG thumbnails.';
