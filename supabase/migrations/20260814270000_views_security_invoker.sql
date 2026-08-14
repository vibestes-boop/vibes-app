-- Fünf Views umgingen die RLS ihrer Basistabellen.
--
-- BEFUND 14.08.2026, im Schreibrechte-Durchgang aufgefallen: Fünf Objekte hatten
-- „RLS aus" und trotzdem Rechte für anon. Es waren keine Tabellen, sondern VIEWS —
-- und genau das ist die Falle.
--
-- Eine View ohne `security_invoker` läuft mit den Rechten ihres EIGENTÜMERS
-- (`postgres`), nicht mit denen des Aufrufers. Damit sieht sie alles, und die RLS
-- der Basistabellen greift überhaupt nicht. Wer die View lesen darf, liest an
-- jeder Zeilen-Regel vorbei.
--
-- Belegt ohne Anmeldung: Alle fünf lieferten HTTP 200 mit Daten. Am deutlichsten
-- `creator_live_history` — dort war eine FRAUEN-ONLY-Session mit Titel, Gastgeber
-- und Zeiten sichtbar. Also genau der Schutz umgangen, der am selben Tag für
-- `live_reactions` (20260814120000) und `live_comments` (20260814250000) mühsam
-- gesetzt wurde. Die Regel stand, die View ging außen herum.
--
-- FIX: `security_invoker = on`. Dann gilt die RLS des Aufrufers.
--
-- AUSWIRKUNG, vorher an den Basistabellen geprüft — nichts bricht:
--
--   creator_live_history       → live_sessions: (women_only = false OR host = ich
--                                OR frauen-only-geprüft). Der Creator sieht seine
--                                eigenen Shows weiter, Fremde nur öffentliche.
--   live_clip_markers_hot      → live_clip_markers: eigene Marker oder als Host.
--                                Die Replay-Ansicht läuft als Host.
--   user_battle_stats          → live_battle_history: jeder Angemeldete sieht
--                                alles. Die Statistik im Profil funktioniert
--                                weiter, nur Unangemeldete sehen nichts mehr.
--   live_poll_tallies          → live_poll_votes: jeder Angemeldete. Im Code
--                                aktuell 0 Treffer.
--   live_session_viewer_counts → live_session_viewers: Host oder man selbst. Im
--                                Code aktuell 0 Treffer.
--
-- MERKSATZ für neue Views: Jede View über einer Tabelle mit RLS braucht
-- `security_invoker = on`. Ohne das ist sie ein Loch in genau der Regel, für die
-- man die RLS geschrieben hat — und sie sieht dabei völlig harmlos aus.

BEGIN;

ALTER VIEW public.creator_live_history       SET (security_invoker = on);
ALTER VIEW public.live_clip_markers_hot      SET (security_invoker = on);
ALTER VIEW public.live_poll_tallies          SET (security_invoker = on);
ALTER VIEW public.live_session_viewer_counts SET (security_invoker = on);
ALTER VIEW public.user_battle_stats          SET (security_invoker = on);

COMMIT;

-- ─── Gegenprobe ──────────────────────────────────────────────────────────────
-- Ohne Anmeldung: creator_live_history zeigt keine Frauen-Only-Session mehr,
-- user_battle_stats und live_poll_tallies liefern [].
--
-- ─── Prüfung für die Zukunft ─────────────────────────────────────────────────
--   SELECT c.relname FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
--   WHERE c.relkind = 'v'
--     AND NOT coalesce((SELECT option_value = 'on'
--                       FROM pg_options_to_table(c.reloptions) AS t(option_name, option_value)
--                       WHERE option_name = 'security_invoker'), false);
--
-- Achtung beim Vergleichswert: Postgres speichert `on`, nicht `true`. Ein
-- Vergleich gegen 'true' meldet fälschlich JEDE View als ungeschützt — mir beim
-- Nachprüfen genau so passiert.
