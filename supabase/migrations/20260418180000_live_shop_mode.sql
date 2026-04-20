-- ================================================================
-- v1.22.x — Live-Shop-Mode (TikTok-Style Katalog-Button)
-- ================================================================
-- Host schaltet den Shop-Modus für seinen Stream ein/aus. Solange
-- der Modus aktiv ist, zeigt die Viewer-UI unten links eine Shop-
-- Tüte (mit Produkt-Count-Badge), die ein Sheet mit dem gesamten
-- Host-Katalog öffnet.
--
-- Unabhängig von bestehenden Systemen:
--   • live_placed_products → frei platzierte Produkt-Karten auf Video
--   • useLiveShopping      → broadcast-basiertes "Featured Product" Pill
--
-- Dieser Flag entscheidet nur, ob der Katalog-Entry-Point (Tüte)
-- überhaupt sichtbar ist. Die drei Konzepte koexistieren.
--
-- Design:
--   • Nur Host einer Session darf togglen (enforced via RPC + RLS)
--   • Realtime via bestehende live_sessions-Publication (postgres_changes)
--   • Default false — Host muss aktiv Shop-Modus einschalten
-- ================================================================

-- 1) Spalte hinzufügen (idempotent) ---------------------------------
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS shop_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) RPC: set_live_shop_mode ----------------------------------------
-- Nur Host der Session darf togglen. Idempotent.
CREATE OR REPLACE FUNCTION public.set_live_shop_mode(
  p_session_id UUID,
  p_enabled    BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
BEGIN
  SELECT host_id INTO v_host_id
    FROM public.live_sessions
   WHERE id = p_session_id
   LIMIT 1;

  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_host_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden_not_host' USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_sessions
     SET shop_enabled = p_enabled
   WHERE id = p_session_id;

  RETURN p_enabled;
END $$;

REVOKE ALL ON FUNCTION public.set_live_shop_mode(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_live_shop_mode(UUID, BOOLEAN) TO authenticated;

-- 3) Schema cache reload --------------------------------------------
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Live-Shop-Mode deployed (shop_enabled flag + set_live_shop_mode RPC)';
END $$;
