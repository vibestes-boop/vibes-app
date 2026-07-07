-- ============================================================================
-- Konto-Löschung reparieren (Apple 5.1.1(v) In-App-Löschung + DSGVO).
--
-- Die delete-account Edge-Function ruft auth.admin.deleteUser → Cascade über
-- profiles. Das schlug fehl mit:
--   "null value in column buyer_id of relation orders violates not-null"
-- Ursache: FKs auf den User waren ON DELETE SET NULL (bzw. NO ACTION) auf
-- NOT-NULL-Spalten — der Cascade konnte die Zeilen weder auf NULL setzen noch
-- die Löschung zulassen. Folge: Web zeigte einen Fehler, die App verschluckte
-- ihn (meldete "gelöscht"), der Auth-User blieb aber in Supabase erhalten.
--
-- Audit über alle profiles-FKs ergab genau 5 problematische (NOT NULL +
-- SET NULL / NO ACTION). Fix: auf ON DELETE CASCADE umstellen → die eigenen
-- Daten des Users werden mitgelöscht, die Konto-Löschung läuft sauber durch.
-- ============================================================================

-- orders.buyer_id  (der konkret gemeldete Fehler)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- orders.seller_id  (gleiche Tabelle, gleiches Risiko)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_seller_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- live_moderators.user_id  (NO ACTION + NOT NULL → hätte bei Moderatoren gebrochen)
ALTER TABLE public.live_moderators DROP CONSTRAINT IF EXISTS live_moderators_user_id_fkey;
ALTER TABLE public.live_moderators
  ADD CONSTRAINT live_moderators_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- live_moderators.granted_by  (NO ACTION + NOT NULL)
ALTER TABLE public.live_moderators DROP CONSTRAINT IF EXISTS live_moderators_granted_by_fkey;
ALTER TABLE public.live_moderators
  ADD CONSTRAINT live_moderators_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- live_reports.reporter_id  (NO ACTION + NOT NULL → hätte bei Meldern gebrochen)
ALTER TABLE public.live_reports DROP CONSTRAINT IF EXISTS live_reports_reporter_id_fkey;
ALTER TABLE public.live_reports
  ADD CONSTRAINT live_reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
