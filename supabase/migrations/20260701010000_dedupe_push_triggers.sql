-- 20260701010000_dedupe_push_triggers.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Kostenaudit + Bugfix: doppelte/dreifache Push-Trigger entfernen.
--
-- Auf `notifications` INSERT hingen DREI Trigger, alle riefen dieselbe Edge
-- Function send-push-notification:
--
--   1. trg_push_notification → fn_send_push_on_notification()   ← KANONISCH
--      (Migration 20260410030000). Sendet body = { record: <row> } — genau das
--      Format, das die Edge Function liest (const { record } = payload). Hat den
--      Self-Notification-Guard. BLEIBT.
--
--   2. on-notification-insert (Supabase DB-Webhook, im Dashboard erstellt).
--      Sendet { type, table, record, ... } — enthält ebenfalls `record`, ALSO
--      löst es einen ZWEITEN, funktionierenden Push aus → User bekamen Doppel-
--      Push + doppelte Edge-Function-Invocation. WEG.
--      ⚠️ Zusätzlich: der service_role-Key steckt hartcodiert in diesem Trigger
--      (und damit in schema_live.sql / Git-Historie).
--
--   3. on_notification_push → trigger_push_notification() (Dashboard, nicht in
--      Migrations). Sendet to_jsonb(NEW) OHNE `record`-Wrapper → die Edge
--      Function wirft (record ist undefined) → KEIN Push, nur verbrannte
--      Invocation + Error-Logs. WEG (Trigger + verwaiste Funktion).
--
-- Ergebnis: 3 Invocations/Notification → 1, und kein Doppel-Push mehr.
-- ═══════════════════════════════════════════════════════════════════════════

-- 2) Redundanter DB-Webhook (Doppel-Push).
DROP TRIGGER IF EXISTS "on-notification-insert" ON public.notifications;

-- 3) Kaputter No-Op-Trigger + seine nur hier genutzte Funktion.
DROP TRIGGER IF EXISTS on_notification_push ON public.notifications;
DROP FUNCTION IF EXISTS public.trigger_push_notification();

-- trg_push_notification / fn_send_push_on_notification() bleiben unangetastet.
