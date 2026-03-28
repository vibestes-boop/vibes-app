-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Score Decay Scheduler (Referenz-Datei)
--
-- WICHTIG: Diese Datei enthält NUR den pg_cron Schedule-Setup.
-- Alle Funktionen (update_dwell_time, decay_dwell_scores, post_dwell_log)
-- sind in algorithm_production.sql definiert — die einzige kanonische Datei.
--
-- AUSFÜHREN: Nur nach algorithm_production.sql, falls pg_cron aktiviert ist.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── pg_cron aktivieren (einmalig in Supabase) ────────────────────────────────
-- Supabase Dashboard → Database → Extensions → pg_cron aktivieren

-- ── Wöchentlichen Decay-Job einrichten (jeden Montag 03:00 UTC) ──────────────
-- SELECT cron.schedule('weekly-score-decay', '0 3 * * 1', 'SELECT decay_dwell_scores();');

-- ── Aktive Jobs anzeigen ─────────────────────────────────────────────────────
-- SELECT * FROM cron.job;

-- ── Job entfernen (falls nötig) ───────────────────────────────────────────────
-- SELECT cron.unschedule('weekly-score-decay');


-- ── Manueller Test-Run (ohne Schedule) ───────────────────────────────────────
-- SELECT decay_dwell_scores();


-- ── Decay-Simulation: Wie entwickeln sich Scores über Zeit? ──────────────────
SELECT
  (EXTRACT(DAY FROM AGE(NOW(), created_at)) / 7)::INT                            AS age_weeks,
  COUNT(*)                                                                         AS post_count,
  ROUND(AVG(dwell_time_score)::NUMERIC, 3)                                        AS avg_current_score,
  ROUND(AVG(dwell_time_score * 0.90)::NUMERIC, 3)                                 AS avg_after_1_decay,
  ROUND(AVG(
    dwell_time_score
    * POWER(0.90, LEAST((EXTRACT(DAY FROM AGE(NOW(), created_at)) / 7)::INT, 12))
  )::NUMERIC, 3)                                                                   AS projected_score
FROM public.posts
WHERE dwell_time_score > 0
GROUP BY age_weeks
ORDER BY age_weeks;
