-- 20260701020000_dwell_log_columns.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Bugfix (Prod-Log 42703): Dwell-Tracking war komplett tot.
--
-- update_dwell_time() schreibt in post_dwell_log.last_dwell_ms + observed_at,
-- aber die Live-Tabelle hatte nur (user_id, post_id, last_seen, view_count) →
-- jeder Dwell-Call brach mit „column last_dwell_ms does not exist" (400) ab.
-- Damit bekam das stärkste Ranking-Signal (Dwell = 40 % in algorithm_v4) NIE
-- Daten — nur Skips (record_skip nutzt nur existierende Spalten) wurden gezählt.
--
-- Fix: die zwei fehlenden Spalten additiv ergänzen. Danach funktioniert sowohl
-- update_dwell_time als auch der Bulk-Wrapper update_dwell_times_batch.
-- (Schema-Drift: die Funktion wurde mal erweitert, die ALTER TABLE fehlte.)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.post_dwell_log
  ADD COLUMN IF NOT EXISTS last_dwell_ms integer,
  ADD COLUMN IF NOT EXISTS observed_at   timestamptz NOT NULL DEFAULT now();
