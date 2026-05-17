-- Remove the shorter RPC overloads from the first rollout so PostgREST has
-- one canonical mutation signature for web and mobile clients.

DROP FUNCTION IF EXISTS public.create_post(TEXT, TEXT, TEXT, TEXT, TEXT[], UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_post(UUID, TEXT, TEXT[]);
