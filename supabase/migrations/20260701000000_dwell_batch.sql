-- 20260701000000_dwell_batch.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Kostenaudit: Dwell-/Skip-Tracking bündeln (heißester Schreibpfad der App).
--
-- lib/useDwellTracker.ts schickte pro Flush EINE RPC pro Post (records.map →
-- update_dwell_time) + eine pro Skip. Bei jedem Feed-Scroll jedes Users = viele
-- HTTP-Calls / Function-Invocations. Dieser Bulk-Wrapper collapst das auf EINEN
-- Call und ruft serverseitig die BESTEHENDEN Funktionen in einer Schleife auf
-- — identische Semantik (EMA-Score, Skip-Signal, auth.uid()), also KEIN Risiko
-- für den Empfehlungs-Algorithmus (algorithm_v4).
--
-- auth.uid() bleibt korrekt: es liest den Request-JWT-Claim, unabhängig von
-- SECURITY DEFINER — auch verschachtelt über PERFORM.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_dwell_times_batch(
  p_dwells jsonb DEFAULT '[]'::jsonb,
  p_skips  uuid[] DEFAULT '{}'::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  r jsonb;
  s uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Dwell-Messungen: exakt update_dwell_time pro Eintrag (gleiche EMA-Logik).
  FOR r IN SELECT jsonb_array_elements(COALESCE(p_dwells, '[]'::jsonb))
  LOOP
    IF (r ? 'post_id') AND (r ? 'dwell_ms') THEN
      PERFORM public.update_dwell_time((r->>'post_id')::uuid, (r->>'dwell_ms')::int);
    END IF;
  END LOOP;

  -- Skips: exakt record_skip pro Eintrag.
  IF p_skips IS NOT NULL THEN
    FOREACH s IN ARRAY p_skips
    LOOP
      PERFORM public.record_skip(s);
    END LOOP;
  END IF;
END;
$$;

-- Nur eingeloggte Clients dürfen tracken (wie die Einzel-RPCs).
REVOKE ALL ON FUNCTION public.update_dwell_times_batch(jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_dwell_times_batch(jsonb, uuid[]) TO authenticated;
