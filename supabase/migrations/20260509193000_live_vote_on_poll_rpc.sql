-- ================================================================
-- v1.31.0 — Live Poll vote RPC compatibility
-- ================================================================
-- Web no longer depends on this RPC for voting, but keeping it in the
-- database schema prevents older clients from failing with:
--   Could not find the function public.vote_on_poll(...)
-- ================================================================

CREATE OR REPLACE FUNCTION public.vote_on_poll(
  p_poll_id UUID,
  p_option_index INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_options JSONB;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT options
    INTO v_options
    FROM public.live_polls
   WHERE id = p_poll_id
     AND closed_at IS NULL;

  IF v_options IS NULL THEN
    RAISE EXCEPTION 'poll_closed';
  END IF;

  IF p_option_index < 0 OR p_option_index >= jsonb_array_length(v_options) THEN
    RAISE EXCEPTION 'invalid_option';
  END IF;

  INSERT INTO public.live_poll_votes (poll_id, user_id, option_index)
  VALUES (p_poll_id, v_user_id, p_option_index);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_voted';
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_on_poll(UUID, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';

