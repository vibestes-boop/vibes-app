-- A shoppable post must not become visible without its selected product.
-- Keep the existing create_post signature intact for existing app versions.
CREATE OR REPLACE FUNCTION public.create_post_with_product(
  p_product_id UUID,
  p_caption TEXT DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL,
  p_media_type TEXT DEFAULT 'image',
  p_thumbnail_url TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}'::TEXT[],
  p_guild_id UUID DEFAULT NULL,
  p_is_guild_post BOOLEAN DEFAULT FALSE,
  p_audio_url TEXT DEFAULT NULL,
  p_audio_volume DOUBLE PRECISION DEFAULT NULL,
  p_privacy TEXT DEFAULT 'public',
  p_allow_comments BOOLEAN DEFAULT TRUE,
  p_allow_download BOOLEAN DEFAULT FALSE,
  p_allow_duet BOOLEAN DEFAULT TRUE,
  p_women_only BOOLEAN DEFAULT FALSE,
  p_cover_time_ms INTEGER DEFAULT NULL,
  p_aspect_ratio TEXT DEFAULT 'portrait'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_post_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = p_product_id AND seller_id = v_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Product is unavailable or does not belong to you';
  END IF;

  v_post_id := public.create_post(
    p_caption => p_caption,
    p_media_url => p_media_url,
    p_media_type => p_media_type,
    p_thumbnail_url => p_thumbnail_url,
    p_tags => p_tags,
    p_guild_id => p_guild_id,
    p_is_guild_post => p_is_guild_post,
    p_audio_url => p_audio_url,
    p_audio_volume => p_audio_volume,
    p_privacy => p_privacy,
    p_allow_comments => p_allow_comments,
    p_allow_download => p_allow_download,
    p_allow_duet => p_allow_duet,
    p_women_only => p_women_only,
    p_cover_time_ms => p_cover_time_ms,
    p_aspect_ratio => p_aspect_ratio
  );

  UPDATE public.posts SET product_id = p_product_id
  WHERE id = v_post_id AND author_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product could not be attached to the post';
  END IF;
  RETURN v_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_post_with_product(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], UUID, BOOLEAN, TEXT, DOUBLE PRECISION, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_post_with_product(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], UUID, BOOLEAN, TEXT, DOUBLE PRECISION, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT) TO authenticated;
