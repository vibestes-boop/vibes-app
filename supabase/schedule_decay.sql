-- Wöchentlichen Decay-Job aktivieren (jeden Montag 03:00 UTC)
SELECT cron.schedule(
  'weekly-score-decay',
  '0 3 * * 1',
  'SELECT decay_dwell_scores();'
);

-- Bestätigung: aktive Jobs anzeigen
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'weekly-score-decay';
