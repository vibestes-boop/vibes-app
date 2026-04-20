-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Shop Bewertungen (product_reviews)
-- Datum: 2026-04-15
--
-- Käufer können nach Kauf (status = 'completed') ein Produkt bewerten.
-- Jeder Käufer kann pro Produkt genau eine Bewertung abgeben.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reviewer_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id    UUID        NOT NULL REFERENCES public.orders(id)   ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reviewer_id, product_id) -- eine Bewertung pro Käufer pro Produkt
);

-- Index für schnelle Produktbewertungs-Abfragen
CREATE INDEX IF NOT EXISTS idx_reviews_product  ON public.product_reviews(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.product_reviews(reviewer_id);

-- RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Jeder kann Bewertungen lesen
CREATE POLICY "reviews_select" ON public.product_reviews
  FOR SELECT USING (true);

-- Nur eigene Bewertungen erstellen (und nur wenn Kauf abgeschlossen)
CREATE POLICY "reviews_insert" ON public.product_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.buyer_id = auth.uid()
        AND o.product_id = product_reviews.product_id
        AND o.status = 'completed'
    )
  );

-- Eigene Bewertungen bearbeiten
CREATE POLICY "reviews_update" ON public.product_reviews
  FOR UPDATE USING (auth.uid() = reviewer_id);

-- Eigene Bewertungen löschen
CREATE POLICY "reviews_delete" ON public.product_reviews
  FOR DELETE USING (auth.uid() = reviewer_id);

-- Durchschnittsbewertung + Count auf products denormalisieren (schneller für Listen)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS avg_rating    NUMERIC(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_count  INTEGER      NOT NULL DEFAULT 0;

-- Trigger: avg_rating + review_count nach jeder Bewertungsänderung aktualisieren
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Ermittle product_id aus NEW oder OLD
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE public.products
  SET
    avg_rating   = (SELECT AVG(rating)::NUMERIC(3,2) FROM public.product_reviews WHERE product_id = v_product_id),
    review_count = (SELECT COUNT(*)                  FROM public.product_reviews WHERE product_id = v_product_id)
  WHERE id = v_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_product_rating ON public.product_reviews;
CREATE TRIGGER trg_update_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_product_rating();

DO $$ BEGIN
  RAISE NOTICE '✅ product_reviews Tabelle + Trigger bereit';
END $$;
