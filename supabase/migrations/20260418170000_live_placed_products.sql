-- ================================================================
-- v1.22.0 — Live-Placed-Products (Produkt-Karten frei platziert)
-- ================================================================
-- Host platziert eigene Shop-Produkte als Mini-Karten direkt im
-- Stream. Viewer sehen die Karte an der vom Host gewählten Position
-- und können sie antippen, um zur Produkt-Detailseite zu springen.
--
-- Unterscheidet sich vom bestehenden "Featured Product" (broadcast
-- pinned pill, nur eins gleichzeitig) — hier sind beliebig viele
-- Produkt-Karten gleichzeitig an beliebigen Positionen möglich.
--
-- Design:
--   • Nur Host einer Session darf Produkte platzieren
--   • Nur eigene Produkte (seller_id = auth.uid())
--   • Gleiche Produkt-ID nur einmal pro Session
--   • removed_at = Soft-Delete
--   • Realtime für INSERT/UPDATE/DELETE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.live_placed_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position_x  REAL NOT NULL DEFAULT 40,
  position_y  REAL NOT NULL DEFAULT 260,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ
);

-- Ein Produkt darf nur einmal aktiv in derselben Session platziert sein.
-- Partial Unique (nur wo removed_at NULL ist), damit das gleiche Produkt
-- nach dem Entfernen wieder gesetzt werden kann.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_placed_products_active
  ON public.live_placed_products (session_id, product_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_placed_products_session_active
  ON public.live_placed_products (session_id, created_at DESC)
  WHERE removed_at IS NULL;

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION public._set_live_placed_products_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_live_placed_products_updated_at ON public.live_placed_products;
CREATE TRIGGER trg_live_placed_products_updated_at
  BEFORE UPDATE ON public.live_placed_products
  FOR EACH ROW EXECUTE FUNCTION public._set_live_placed_products_updated_at();

ALTER TABLE public.live_placed_products ENABLE ROW LEVEL SECURITY;

-- Idempotent: alte Policies droppen, bevor neu angelegt wird
DROP POLICY IF EXISTS "live_placed_products_select" ON public.live_placed_products;
DROP POLICY IF EXISTS "live_placed_products_insert" ON public.live_placed_products;
DROP POLICY IF EXISTS "live_placed_products_update" ON public.live_placed_products;
DROP POLICY IF EXISTS "live_placed_products_delete" ON public.live_placed_products;

-- Alle authentifizierten User dürfen Platzierungen lesen (für Viewer-Rendering)
CREATE POLICY "live_placed_products_select"
  ON public.live_placed_products FOR SELECT
  USING (auth.role() = 'authenticated');

-- Nur der Host der Session UND Eigentümer des Produkts darf platzieren
CREATE POLICY "live_placed_products_insert"
  ON public.live_placed_products FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = session_id AND s.host_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.products p
       WHERE p.id = product_id AND p.seller_id = auth.uid()
    )
  );

-- Nur Host darf moven (Position) oder entfernen.
-- WITH CHECK wiederholt die INSERT-Integritätsprüfungen, damit ein Host
-- nachträglich NICHT product_id auf ein fremdes Produkt oder session_id
-- auf eine fremde Session ändern kann.
CREATE POLICY "live_placed_products_update"
  ON public.live_placed_products FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = session_id AND s.host_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.products p
       WHERE p.id = product_id AND p.seller_id = auth.uid()
    )
  );

CREATE POLICY "live_placed_products_delete"
  ON public.live_placed_products FOR DELETE
  USING (auth.uid() = host_id);

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_placed_products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_placed_products;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Live-Placed-Products deployed (v1.22.0)';
END $$;
