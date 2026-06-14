-- ══════════════════════════════════════════════════════
-- Realtime für reposts Tabelle aktivieren
-- Ausführen: Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- 1. Tabelle zur Realtime-Publication hinzufügen
ALTER PUBLICATION supabase_realtime ADD TABLE public.reposts;

-- 2. REPLICA IDENTITY FULL: damit DELETE payload alle Spalten enthält
--    (inkl. post_id → Client kann direkt den richtigen Post entfernen)
ALTER TABLE public.reposts REPLICA IDENTITY FULL;

-- Verifikation:
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'reposts';
-- Erwartet: 1 Row → reposts ist jetzt in Realtime aktiv
