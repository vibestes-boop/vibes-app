-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Funktions-Verifikation
-- Prüft welche Version jeder Funktion aktuell live ist
-- Im Supabase SQL Editor ausführen
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Welche Funktionen existieren? ─────────────────────────────────────────
SELECT
  p.proname                                  AS funktion,
  pg_get_function_arguments(p.oid)           AS parameter,
  LEFT(pg_get_functiondef(p.oid), 120)       AS code_anfang
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'update_dwell_time',
    'get_vibe_feed',
    'get_guild_leaderboard',
    'decay_dwell_scores'
  )
ORDER BY p.proname;


-- ── 2. Hat update_dwell_time den Gaming-Schutz? ──────────────────────────────
-- Erwartung: source enthält "auth.uid()" und "post_dwell_log"
SELECT
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%auth.uid()%'
     AND pg_get_functiondef(oid) LIKE '%post_dwell_log%'
    THEN '✅ Gaming-Schutz AKTIV (auth.uid + post_dwell_log)'
    ELSE '❌ FEHLER: Alte Version ohne Gaming-Schutz ist live!'
  END AS update_dwell_time_status
FROM pg_proc
WHERE proname = 'update_dwell_time'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');


-- ── 3. Hat get_vibe_feed den filter_tag Parameter? ───────────────────────────
-- Erwartung: parameter enthält "filter_tag"
SELECT
  CASE
    WHEN pg_get_function_arguments(oid) LIKE '%filter_tag%'
    THEN '✅ filter_tag Parameter AKTIV'
    ELSE '❌ FEHLER: Alte Version ohne filter_tag ist live!'
  END AS get_vibe_feed_filter_status,
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%total_authors%'
     AND pg_get_functiondef(oid) LIKE '%NULLIF%'
    THEN '✅ Dynamischer Diversity-Cap AKTIV'
    ELSE '❌ FEHLER: Statischer author_rank <= 2 ist noch live!'
  END AS get_vibe_feed_diversity_status,
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%NULLS LAST%'
    THEN '✅ NULLS LAST AKTIV'
    ELSE '❌ FEHLER: NULLs landen oben im Feed!'
  END AS get_vibe_feed_nulls_status
FROM pg_proc
WHERE proname = 'get_vibe_feed'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');


-- ── 4. Tabellen vorhanden? ────────────────────────────────────────────────────
SELECT
  tablename,
  CASE WHEN tablename IS NOT NULL THEN '✅ Tabelle existiert' ELSE '❌ Fehlt' END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('post_dwell_log', 'posts', 'profiles', 'guilds')
ORDER BY tablename;


-- ── 5. Indizes vorhanden? ─────────────────────────────────────────────────────
SELECT
  indexname,
  CASE
    WHEN indexname LIKE 'idx_%' THEN '✅ Vorhanden'
    ELSE '— System-Index'
  END AS status
FROM pg_indexes
WHERE tablename IN ('posts', 'post_dwell_log')
  AND schemaname = 'public'
ORDER BY tablename, indexname;


-- ── 6. Daten-Zustand ─────────────────────────────────────────────────────────
SELECT
  '── DATEN STATUS ──'                              AS info, '' AS value
UNION ALL SELECT '⚠ Score IS NULL',  COUNT(*)::TEXT FROM public.posts WHERE dwell_time_score IS NULL
UNION ALL SELECT '⚠ Score > 1.0',    COUNT(*)::TEXT FROM public.posts WHERE dwell_time_score > 1.0
UNION ALL SELECT 'Max Score',         ROUND(MAX(COALESCE(dwell_time_score,0))::NUMERIC,4)::TEXT FROM public.posts
UNION ALL SELECT 'Gaming-Log Zeilen', COUNT(*)::TEXT FROM public.post_dwell_log;
