-- Regression test using the real mutation RPCs, with minimal local RLS fixtures.
-- Run ONLY against a disposable, empty PostgreSQL database:
--   psql -X -v ON_ERROR_STOP=1 -f supabase/tests/create_post_with_product.sql
-- This deliberately refuses an existing application schema. No production calls.
BEGIN;
DO $$ BEGIN
  ASSERT to_regclass('public.posts') IS NULL, 'An empty disposable database is required';
  ASSERT to_regclass('public.products') IS NULL, 'An empty disposable database is required';
  ASSERT NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'auth'), 'An empty disposable database is required';
END $$;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
CREATE TABLE public.products (
  id uuid PRIMARY KEY,
  seller_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  caption text, media_url text, media_type text, thumbnail_url text,
  tags text[], guild_id uuid, is_guild_post boolean, audio_url text,
  audio_volume double precision, privacy text, allow_comments boolean,
  allow_download boolean, allow_duet boolean, women_only boolean,
  cover_time_ms integer, aspect_ratio text,
  product_id uuid REFERENCES public.products(id)
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_read ON public.products FOR SELECT
  USING (is_active OR seller_id = auth.uid());
CREATE POLICY posts_read ON public.posts FOR SELECT USING (author_id = auth.uid());
CREATE POLICY posts_insert ON public.posts FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY posts_update ON public.posts FOR UPDATE USING (author_id = auth.uid());
GRANT SELECT ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
INSERT INTO public.products VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', false);

-- Load the actual implementation, not a reimplementation of its behavior.
\ir ../migrations/20260517170000_extend_post_mutation_rpcs_for_web.sql
\ir ../migrations/20261002220000_create_post_with_product.sql

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
DO $$ DECLARE created uuid; BEGIN
  created := public.create_post_with_product(
    p_product_id => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    p_caption => '  Example  ', p_media_url => 'https://example.test/photo.jpg',
    p_privacy => 'private', p_allow_comments => false, p_aspect_ratio => 'square'
  );
  ASSERT EXISTS (SELECT FROM public.posts WHERE id = created
    AND product_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND author_id = auth.uid() AND caption = 'Example'
    AND privacy = 'private' AND NOT allow_comments AND aspect_ratio = 'square'),
    'The post, ownership, options and product must be stored together';
  RAISE NOTICE 'PASS: owner can create a linked post with its privacy settings';
END $$;

DO $$ DECLARE candidate uuid; rejected boolean; before_count int; BEGIN
  SELECT count(*) INTO before_count FROM public.posts;
  FOREACH candidate IN ARRAY ARRAY[
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, NULL::uuid
  ] LOOP
    rejected := false;
    BEGIN
      PERFORM public.create_post_with_product(candidate);
    EXCEPTION WHEN raise_exception THEN
      rejected := SQLERRM = 'Product is unavailable or does not belong to you';
    END;
    ASSERT rejected, 'Foreign, inactive, missing and null products must be rejected';
    ASSERT (SELECT count(*) FROM public.posts) = before_count, 'Rejected product left an orphan post';
  END LOOP;
  RAISE NOTICE 'PASS: foreign, inactive, missing and null products create no posts';
END $$;

SET LOCAL request.jwt.claim.sub = '';
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    PERFORM public.create_post_with_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  EXCEPTION WHEN raise_exception THEN
    rejected := SQLERRM = 'Not authenticated';
  END;
  ASSERT rejected, 'A missing user identity must be rejected';
  RAISE NOTICE 'PASS: authenticated role still requires a user identity';
END $$;
SET LOCAL ROLE anon;
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    PERFORM public.create_post_with_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  ASSERT rejected, 'Anonymous callers must not have EXECUTE permission';
  RAISE NOTICE 'PASS: anonymous execution is denied';
END $$;

-- Exercise a failed product UPDATE after a successful INSERT. Everything must
-- roll back, including the post created by the nested canonical RPC.
RESET ROLE;
CREATE FUNCTION public.reject_test_product_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Simulated product-link failure'; END $$;
CREATE TRIGGER reject_test_link BEFORE UPDATE OF product_id ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.reject_test_product_link();
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
DO $$ DECLARE before_count int; rejected boolean := false; BEGIN
  SELECT count(*) INTO before_count FROM public.posts;
  BEGIN
    PERFORM public.create_post_with_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  EXCEPTION WHEN raise_exception THEN
    rejected := SQLERRM = 'Simulated product-link failure';
  END;
  ASSERT rejected, 'Expected the linking failure to reach the caller';
  ASSERT (SELECT count(*) FROM public.posts) = before_count, 'Failed link left a visible post';
  RAISE NOTICE 'PASS: linking failure rolls back the newly created post';
END $$;
RESET ROLE;
DROP TRIGGER reject_test_link ON public.posts;
ALTER POLICY posts_update ON public.posts USING (false);
SET LOCAL ROLE authenticated;
DO $$ DECLARE before_count int; rejected boolean := false; BEGIN
  SELECT count(*) INTO before_count FROM public.posts;
  BEGIN
    PERFORM public.create_post_with_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  EXCEPTION WHEN raise_exception THEN
    rejected := SQLERRM = 'Product could not be attached to the post';
  END;
  ASSERT rejected, 'Expected row security to block the link';
  ASSERT (SELECT count(*) FROM public.posts) = before_count, 'RLS failure left an orphan post';
  RAISE NOTICE 'PASS: denied UPDATE under RLS also rolls back the post';
END $$;
-- Existing mobile clients must retain the ordinary create_post contract.
DO $$ DECLARE created uuid; BEGIN
  created := public.create_post(p_caption => 'Ordinary post', p_media_url => 'https://example.test/photo.jpg');
  ASSERT EXISTS (SELECT FROM public.posts WHERE id = created AND product_id IS NULL);
  RAISE NOTICE 'PASS: ordinary post RPC remains backward compatible';
END $$;
ROLLBACK;
