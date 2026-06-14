-- Block-System für Vibes App
-- Im Supabase SQL-Editor ausführen

-- Tabelle: user_blocks
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- RLS aktivieren
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Policies idempotent (DROP vor CREATE)
DROP POLICY IF EXISTS "user_blocks_select" ON public.user_blocks;
DROP POLICY IF EXISTS "user_blocks_insert" ON public.user_blocks;
DROP POLICY IF EXISTS "user_blocks_delete" ON public.user_blocks;

CREATE POLICY "user_blocks_select" ON public.user_blocks
  FOR SELECT USING (blocker_id = auth.uid());

CREATE POLICY "user_blocks_insert" ON public.user_blocks
  FOR INSERT WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "user_blocks_delete" ON public.user_blocks
  FOR DELETE USING (blocker_id = auth.uid());

-- RPC: User blockieren (upsert)
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- RPC: User entblocken
CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM user_blocks
  WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(UUID) TO authenticated;
