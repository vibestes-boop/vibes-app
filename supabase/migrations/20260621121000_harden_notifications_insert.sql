-- 🟡 SECURITY-FIX — notifications-INSERT-Policy härten (Anti-Spoofing/Phishing)
--
-- Vorher: `notif_service_insert` = FOR INSERT WITH CHECK (true) ohne TO-Klausel
--   → jeder eingeloggte Nutzer konnte via Anon-Key beliebige Benachrichtigungen
--     im Namen ANDERER (sender_id = fremde id) an jeden schreiben — Phishing
--     („Konto gesperrt, klicke hier") / Fake-Gift-Notifications / Impersonation.
--
-- Nachher: nur erlaubt, wenn sender_id = auth.uid() (man kann nur Notifications
--   senden, die ehrlich auf den eigenen Account zeigen — keine Impersonation).
--
-- Sicher für legitime Flows: ALLE Client-Inserts (Mention, Follow, Follow-Accept,
-- Live-Invite, Live-Start) setzen sender_id = eigener User → unberührt.
-- System-Notifs (sender_id NULL) werden serverseitig via SECURITY DEFINER /
-- service_role erzeugt und umgehen RLS → ebenfalls unberührt.
-- Die bestehende type-CHECK-Whitelist begrenzt zusätzlich die möglichen Typen.

DROP POLICY IF EXISTS "notif_service_insert" ON public.notifications;

CREATE POLICY "notif_insert_own_sender" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

DO $$ BEGIN
  RAISE NOTICE '🔒 notifications-INSERT gehärtet: sender_id = auth.uid()';
END $$;
