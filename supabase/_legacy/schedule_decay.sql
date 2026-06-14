-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — pg_cron Aktivierung (einmalig ausführen)
--
-- VORAUSSETZUNG: pg_cron Extension aktivieren:
--   Supabase Dashboard → Database → Extensions → pg_cron → Enable
--
-- DANN diesen Block ausführen:
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Job 1: Wöchentlicher Score-Decay (jeden Montag 03:00 UTC) ─────────────────
-- Verhindert dass alte Posts den Feed ewig dominieren.
-- Nach 12 Wochen: Score von 1.0 → 0.28 → verschwindet aus dem Feed.
SELECT cron.schedule(
  'weekly-score-decay',
  '0 3 * * 1',
  'SELECT public.decay_dwell_scores();'
);

-- ── Job 2: Monatlicher Dwell-Log Cleanup (1. des Monats, 04:00 UTC) ──────────
-- Verhindert unbegrenztes Wachstum der post_dwell_log Tabelle.
-- Löscht Einträge älter als 90 Tage.
SELECT cron.schedule(
  'monthly-dwell-cleanup',
  '0 4 1 * *',
  'DELETE FROM public.post_dwell_log WHERE last_seen < NOW() - INTERVAL ''90 days'';'
);

-- ── Verifikation: Aktive Jobs anzeigen ───────────────────────────────────────
SELECT jobid, jobname, schedule, command, active
FROM cron.job
ORDER BY jobname;
