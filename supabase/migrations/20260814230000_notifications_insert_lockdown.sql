-- Jeder konnte jedem beliebige Benachrichtigungen schreiben — und damit Push auslösen.
--
-- BEFUND 14.08.2026, beim Bau der Benachrichtigungsliste für Berkat gefunden.
-- Auf `notifications` lagen ZWEI INSERT-Policies:
--
--   notif_insert            FOR INSERT WITH CHECK (true)          -- ohne TO, also PUBLIC
--   notif_insert_own_sender FOR INSERT TO authenticated
--                           WITH CHECK (sender_id = auth.uid())
--
-- Postgres verknüpft permissive Policies mit ODER. Die erste hat keine
-- Einschränkung, also hebelt sie die zweite vollständig aus — dieselbe Falle wie
-- am 16.07.2026 auf `live_sessions`. Dazu kam `GRANT ALL ON TABLE notifications
-- TO anon`, sodass es nicht einmal ein Konto brauchte.
--
-- Belegt, zerstörungsfrei, ohne Anmeldung, mit erfundener Nutzer-ID:
--   POST /rest/v1/notifications  {"recipient_id":"000…","sender_id":"000…","type":"auction_won"}
--   -> HTTP 409, 23503 "Key is not present in table profiles"
-- Der Aufruf lief also bis zum Fremdschlüssel durch. Kein 401, kein 403.
--
-- WARUM DAS SCHLIMMER IST ALS SPAM: Ein INSERT in `notifications` löst über
-- `trg_push_notification` einen echten Push aus. Ein Angreifer konnte damit an
-- jede bekannte Nutzer-ID „🎉 Zuschlag — du hast gewonnen!" mit frei erfundenem
-- Text schicken — in einer App, in der genau diese Meldungen von Geld handeln und
-- zur Zahlung auffordern. Nutzer-IDs stehen überall sichtbar (Kommentare,
-- Gefolgt-Listen, Live-Räume).
--
-- BRICHT NICHTS: Alle sechs Client-Einfügestellen in Serlo setzen `sender_id` auf
-- den angemeldeten Nutzer (useComments, useLiveSession, useFollowRequest ×2,
-- LiveShareSheet, apps/web profile.ts) — die enge Policy deckt sie ab. Trigger und
-- Edge Functions laufen als `postgres` bzw. `service_role` und umgehen RLS ohnehin.

BEGIN;

-- ─── 1. Die schrankenlose Policy weg ─────────────────────────────────────────
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;

-- Sicherstellen, dass die enge existiert (idempotent, falls je jemand beide löscht).
DROP POLICY IF EXISTS "notif_insert_own_sender" ON public.notifications;
CREATE POLICY "notif_insert_own_sender" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- ─── 2. anon hat auf dieser Tabelle nichts verloren ──────────────────────────
-- Lesen war ohnehin blockiert (notif_select verlangt auth.uid() = recipient_id,
-- und das ist für anon NULL). Der Entzug ist die zweite Verteidigungslinie:
-- Ohne Tabellen-Recht kommt ein Aufruf gar nicht erst bis zur Policy.
REVOKE ALL ON TABLE public.notifications FROM anon;

COMMIT;

-- ─── Danebenliegender Fund, BEWUSST nicht mitgefixt ──────────────────────────
-- `comment_reply` fehlt in `notifications_type_check`, wird aber von
-- lib/useComments.ts eingefügt. Die Antwort auf einen Kommentar benachrichtigt
-- den Elternteil-Autor also nie, und der Fehler wird verschluckt, weil der
-- Aufrufer `error` nicht prüft. Vorbestehend, nicht durch die Berkat-Arbeit
-- entstanden.
--
-- Den Typ hier einfach zur CHECK-Liste zu ergänzen wäre falsch: Er ist in KEINER
-- Oberfläche verdrahtet — nicht im CASE von fn_send_push_on_notification, nicht
-- in der In-App-Liste, nicht in TYPE_TO_PREF. Die Meldung käme also als „Neue
-- Aktivität auf Serlo" an. Ein neuer Typ braucht alle Oberflächen auf einmal,
-- siehe apps/berkat/HANDOFF.md, Abschnitt 9.
