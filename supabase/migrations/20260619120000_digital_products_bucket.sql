-- ════════════════════════════════════════════════════════════════════════════
-- Digitale Produkte: privater Storage-Bucket `digital-products` + RLS
-- (Path A — echter Datei-Upload für digitale Shop-Produkte)
--
-- Kontext: Der bestehende Download-Flow (`generate_download_url` +
-- client-seitige `createSignedUrl`) erwartet die Datei im PRIVATEN Bucket
-- `digital-products`. Dieser Bucket existierte bisher NICHT → digitale
-- Produkte hatten faktisch keine Lieferung. Diese Migration legt ihn an und
-- setzt die Zugriffsregeln:
--   • Verkäufer:in lädt NUR in den eigenen Ordner ({userId}/…) hoch.
--   • Lesen (für die Signed URL) darf NUR: die Verkäufer:in selbst ODER eine
--     Käufer:in mit ABGESCHLOSSENER Bestellung für genau dieses Produkt.
-- Damit ist bezahlter Inhalt geschützt — selbst wenn die file_url bekannt wird,
-- kann ohne abgeschlossene Bestellung keine Signed URL erzeugt werden.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Bucket anlegen (privat, 50 MB Limit) ─────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('digital-products', 'digital-products', false, 52428800)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 52428800;

-- ── 2. Storage-RLS (storage.objects ist standardmäßig RLS-aktiv) ────────────

-- Verkäufer:in lädt nur in den eigenen Ordner hoch (erster Pfad-Teil = userId)
DROP POLICY IF EXISTS "digital_products_insert_own" ON storage.objects;
CREATE POLICY "digital_products_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'digital-products'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verkäufer:in darf eigene Dateien ersetzen
DROP POLICY IF EXISTS "digital_products_update_own" ON storage.objects;
CREATE POLICY "digital_products_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'digital-products'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verkäufer:in darf eigene Dateien löschen
DROP POLICY IF EXISTS "digital_products_delete_own" ON storage.objects;
CREATE POLICY "digital_products_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'digital-products'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lesen: Verkäufer:in (eigener Ordner) ODER Käufer:in mit abgeschlossener
-- Bestellung für ein Produkt, dessen file_url auf genau dieses Objekt zeigt.
DROP POLICY IF EXISTS "digital_products_read" ON storage.objects;
CREATE POLICY "digital_products_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'digital-products'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.orders o
        JOIN public.products p ON p.id = o.product_id
        WHERE o.buyer_id = auth.uid()
          AND o.status = 'completed'
          AND p.file_url LIKE '%/' || storage.objects.name
      )
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✅ digital-products Bucket + RLS deployed (Path A digital delivery)';
END $$;
