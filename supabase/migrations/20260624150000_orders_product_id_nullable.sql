-- 20260624150000_orders_product_id_nullable.sql
-- Produkt löschen mit Bestell-Historie ermöglichen.
--
-- Bug: Der FK orders_product_id_fkey ist ON DELETE SET NULL, ABER die Spalte
-- orders.product_id war NOT NULL → beim Löschen eines Produkts mit Bestellungen
-- versuchte Postgres product_id=NULL zu setzen und scheiterte:
--   "null value in column product_id of relation orders violates not-null".
--
-- Fix: Spalte nullable machen. Verhalten danach: ein gelöschtes Produkt setzt
-- die product_id der betroffenen Bestellungen auf NULL — die Bestell-Records
-- (Käufer, Menge, Betrag, Status) bleiben für Käufer + Buchhaltung erhalten,
-- nur die Produkt-Verknüpfung entfällt. (Marktplatz-Standard: Verkäufer darf
-- sein Produkt entfernen, ohne fremde Bestell-Historie zu löschen.)

ALTER TABLE public.orders ALTER COLUMN product_id DROP NOT NULL;
