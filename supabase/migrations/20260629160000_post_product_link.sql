-- Shoppable Posts (#2) — ein Post kann ein Shop-Produkt verknüpfen.
-- Der Feed rendert daraus eine tappbare Produktkarte → /shop/[id].
--
-- Bewusst minimal: EINE optionale Spalte + FK + Index. Die Feed-RPCs
-- (get_vibe_feed etc.) bleiben unangetastet — die Produktinfo wird client-
-- seitig per Sekundär-Fetch über den FK-Embed nachgeladen (Muster wie Guild-Feed).

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS product_id uuid;

-- FK mit explizitem Namen, damit der PostgREST-Embed
-- `product:products!posts_product_id_fkey(...)` stabil funktioniert.
-- ON DELETE SET NULL: löscht der Verkäufer das Produkt, bleibt der Post —
-- die Karte verschwindet einfach (kein toter Link, kein verwaister Post).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_product_id_fkey'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Nur Posts MIT Produkt indizieren (die große Mehrheit hat keins).
CREATE INDEX IF NOT EXISTS idx_posts_product_id
  ON public.posts (product_id)
  WHERE product_id IS NOT NULL;
