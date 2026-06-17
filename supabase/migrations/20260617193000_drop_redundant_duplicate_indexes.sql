-- 20260617193000_drop_redundant_duplicate_indexes.sql
--
-- DB-Index-Aufräumung — Performance: schnellere Writes, weniger Bloat.
--
-- BEFUND: Das Schema ist mit 201 Indexen sehr gründlich indexiert — aber es gibt
-- mehrere EXAKTE Duplikate: identische Spalten, identische Reihenfolge, identische
-- (bzw. keine) WHERE-Klausel, beide non-unique. Doppelte Indexe bringen NULL
-- Lese-Vorteil (der Planner nutzt eh nur einen), aber jeder INSERT/UPDATE muss
-- ALLE pflegen → langsamere Writes auf genau den heißesten Schreibpfaden
-- (Notifications bei jedem Like/Follow/Gift, Live-Chat-Inserts, Follow/Unfollow).
-- Den Zwilling zu droppen ist daher reiner Write-Speedup OHNE Lese-Regression:
-- der verbleibende, definitionsgleiche Index bedient alle Queries unverändert.
--
-- VERIFIZIERT gegen supabase/schema_live.sql — jede gedroppte Zeile hat einen
-- exakt identischen, hier benannten Überlebenden. Keine UNIQUE-/Constraint-
-- Indexe betroffen.
--
-- ANWENDEN: idempotent (IF EXISTS). DROP INDEX ist Metadaten-schnell (kein
-- Rebuild). Via `supabase db push` oder SQL-Editor okay. Wer auf einer stark
-- belasteten Tabelle selbst den kurzen Lock vermeiden will, führt stattdessen
-- jede Zeile einzeln als `DROP INDEX CONCURRENTLY IF EXISTS …` im SQL-Editor aus
-- (CONCURRENTLY läuft NICHT in einer Transaktion → dann NICHT via db push).
--
-- OPTIONAL VORHER: welche Indexe werden real genutzt? (für die spätere
-- Tier-2-Entscheidung, s. unten)
--   SELECT relname AS tbl, indexrelname AS idx, idx_scan AS scans,
--          pg_size_pretty(pg_relation_size(indexrelid)) AS size
--   FROM pg_stat_user_indexes WHERE schemaname = 'public'
--   ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- ── Exakte Duplikate (Zwilling bleibt, 0 Lese-Impact) ───────────────────────

-- live_comments → bleibt: idx_live_comments_session_created (session_id, created_at DESC)
DROP INDEX IF EXISTS public.idx_live_comments_session;

-- live_sessions → bleibt: idx_live_sessions_host_id (host_id)
DROP INDEX IF EXISTS public.idx_live_sessions_host;

-- comment_likes → bleibt: idx_comment_likes_comment (comment_id)
DROP INDEX IF EXISTS public.comment_likes_comment_idx;

-- notifications → bleibt: idx_notifications_recipient_created (recipient_id, created_at DESC)
DROP INDEX IF EXISTS public.notifications_recipient_idx;

-- notifications → bleibt: idx_notifications_recipient_unread (recipient_id, read) WHERE read=false
DROP INDEX IF EXISTS public.idx_notifications_recipient_read;

-- follows → bleibt: UNIQUE idx_follows_pair (follower_id, following_id) — bedient dieselben
-- Reads UND erzwingt die No-Duplicate-Follow-Constraint; die non-unique Kopie ist überflüssig.
DROP INDEX IF EXISTS public.idx_follows_follower_following;

-- ── Tier 2 (OPTIONAL, etwas mehr Urteilssache — NICHT automatisch gedroppt) ──
--
-- Diese Einzelspalten-Indexe sind durch einen Composite-Index als Leftmost-Prefix
-- abgedeckt (Postgres kann den Composite für die Einzelspalten-Query nutzen).
-- Sie sind aber physisch kleiner, daher minimal schneller bei reinen Prefix-Scans.
-- ERST mit pg_stat_user_indexes (oben) prüfen, ob sie real Scans haben; wenn 0
-- bzw. der Composite dominiert, gefahrlos droppen:
--
--   DROP INDEX IF EXISTS public.idx_follows_follower_id;   -- Prefix von idx_follows_pair
--   DROP INDEX IF EXISTS public.idx_follows_following_id;  -- Prefix von idx_follows_following_follower
--   DROP INDEX IF EXISTS public.comment_likes_user_idx;    -- Prefix von idx_comment_likes_user_comment
