-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — AI-Image-Generation Phase-4 Safeguards
-- Datum: 2026-04-23
--
-- ZWECK
-- -----
-- Phase 1 (Migration/Function) + Phase 2 (Shop-Mockup-Wiring) + Phase 3
-- (Live-Thumbnail-Wiring) sind live. Jetzt kommt Phase 4: Kostenkontrolle +
-- Kill-Switch + Quota-Transparenz + Retention. Damit läuft das Feature als
-- "Platform-Pool" (Betreiber zahlt OpenAI-Rechnung) ohne Runaway-Risiko, ohne
-- dass User einen eigenen API-Key mitbringen oder Coins dafür bezahlen müssen.
--
-- WAS SICH GEGENÜBER PHASE 1 ÄNDERT
-- ---------------------------------
--  1. Feature-Flag `ai_image_enabled` (DB-Toggle statt Redeploy-Kill)
--  2. Tabelle `feature_flags` als generisches Kill-Switch-Register
--  3. Spalte `consumed_at` auf `ai_image_generations` (Retention-Anchor für
--     "User hat das Bild tatsächlich ins Produkt/Live/Post eingebaut")
--  4. Verschärfte User-Limits: 3/Tag + 10/Woche (statt 3/min + 30/Tag)
--     → bei durchschnittlich 4¢ pro Bild max ~12¢/Tag/User, ~40¢/Woche/User
--     → deckt 95% ehrlicher Nutzung und killt Missbrauch
--  5. Neuer Platform-Budget-Guard: global max $50/Monat (5000 Cents) über alle
--     User zusammen. Sobald erreicht → weitere Generierungen blockiert bis
--     Monats-Rollover. Einmaliger Email-Alarm via Daily-Report-Cron.
--  6. Neue RPC `get_ai_image_user_quota(user)` — liefert used_today,
--     used_week, limits und platform_cap_reached für UI-Anzeige ("Heute noch
--     2 von 3 Bildern verfügbar"). Scarcity-Signal + Transparenz.
--  7. Neue RPC `mark_ai_image_consumed(id)` — User ruft beim Klick auf
--     "Verwenden" → setzt `consumed_at = NOW()`. Retention-Cron lässt diese
--     in Ruhe, löscht nur die verwaisten Generierungen nach 7 Tagen.
--
-- KEINE BREAKING CHANGES
-- ----------------------
-- `check_ai_image_rate_limit` behält Signatur (UUID, ai_image_purpose)→TEXT —
-- nur die Zahlen + ein neuer Return-Code `feature_disabled` kommen dazu.
-- Edge-Function-Migration erfolgt im selben PR.
--
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Feature-Flags Tabelle ─────────────────────────────────────────────────
-- Generisch gebaut damit wir zukünftig auch andere Features (Live-Replay-
-- Egress, Guild-Creation, etc.) damit flippen können ohne extra Tabellen.
CREATE TABLE IF NOT EXISTS public.feature_flags (
  flag_key    TEXT         PRIMARY KEY,
  enabled     BOOLEAN      NOT NULL DEFAULT true,
  description TEXT,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by  UUID         REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Default-Row für AI-Image-Generation. ON CONFLICT damit Re-Run der Migration
-- nicht überschreibt, wenn der Operator das Feature manuell deaktiviert hat.
INSERT INTO public.feature_flags (flag_key, enabled, description)
VALUES (
  'ai_image_enabled',
  true,
  'Master-Kill-Switch für AI-Image-Generation (OpenAI gpt-image-1). Auf false setzen um weitere Generierungen sofort zu blockieren, ohne Edge-Function-Redeploy.'
)
ON CONFLICT (flag_key) DO NOTHING;

-- RLS — alle authenticated Users dürfen lesen (damit das Frontend vor dem
-- Prompt-Submit schon wissen kann, ob das Feature gerade down ist), nur
-- Service-Role darf schreiben.
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "feature_flags_select_all" ON public.feature_flags
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bewusst KEINE INSERT/UPDATE/DELETE-Policy für authenticated → Service-Role
-- (oder DB-Admin via SQL Editor) ist der einzige Schreibweg.

-- Convenience-Helper: schneller Check ohne SELECT-Statement aus der Function.
CREATE OR REPLACE FUNCTION public.is_feature_enabled(p_flag_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.feature_flags WHERE flag_key = p_flag_key),
    true  -- Fallback: wenn der Flag noch nie gesetzt wurde, Feature an lassen.
  );
$$;

REVOKE ALL ON FUNCTION public.is_feature_enabled(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT) TO authenticated, service_role;

-- ── 2. consumed_at Spalte ────────────────────────────────────────────────────
-- Retention-Semantik: Wenn ein User "Mit KI erstellen" klickt, Bild generiert
-- wird, aber der User dann doch einen Upload macht oder den Flow abbricht,
-- bleibt das Bild im Storage verwaist. Wir markieren beim echten "Verwenden"-
-- Klick `consumed_at = NOW()` und der Retention-Cron löscht nur die Rows wo
-- `consumed_at IS NULL AND created_at < NOW() - 7 days`.
ALTER TABLE public.ai_image_generations
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ NULL;

-- Partial-Index für den Retention-Cron — nur unverbrauchte Bilder durchsuchen.
CREATE INDEX IF NOT EXISTS idx_ai_image_gen_unconsumed
  ON public.ai_image_generations (created_at)
  WHERE consumed_at IS NULL;

-- ── 3. Verschärfter Rate-Limit + Platform-Cap + Feature-Flag ─────────────────
-- Neue Reihenfolge der Gates (fail-fast nach Impact):
--   0. Feature-Flag global     → 'feature_disabled'
--   1. Platform-Budget ($50)   → 'platform_budget_exhausted'
--   2. User-Daily (3/24h)      → 'rate_limit_day'
--   3. User-Weekly (10/7d)     → 'rate_limit_week'
-- Der alte 3/min Burst + 30/Tag + $10/User/30d werden durch die strikteren
-- Limits ersetzt. Platform-Cap ist der neue Top-Level-Guard.
CREATE OR REPLACE FUNCTION public.check_ai_image_rate_limit(
  p_user_id UUID,
  p_purpose ai_image_purpose
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_feature_enabled BOOLEAN;
  v_platform_cents  INT;
  v_platform_cap    CONSTANT INT := 5000;  -- $50 = 5000 Cents, 30-Tage-Fenster
  v_count_day       INT;
  v_count_week      INT;
BEGIN
  -- Gate 0: Feature-Flag
  SELECT public.is_feature_enabled('ai_image_enabled') INTO v_feature_enabled;
  IF NOT v_feature_enabled THEN
    RETURN 'feature_disabled';
  END IF;

  -- Gate 1: Platform-Budget (global über alle User, 30-Tage-Rolling)
  -- Wichtig: wir summieren ALLE Rows, auch fehlgeschlagene mit cost_cents=0,
  -- die zählen im Default nicht mit. Successful Runs haben cost_cents>=4.
  SELECT COALESCE(SUM(cost_cents), 0) INTO v_platform_cents
    FROM public.ai_image_generations
   WHERE created_at > NOW() - INTERVAL '30 days';
  IF v_platform_cents >= v_platform_cap THEN
    RETURN 'platform_budget_exhausted';
  END IF;

  -- Gate 2: User-Daily (3 pro rollendem 24h-Fenster)
  SELECT COUNT(*) INTO v_count_day
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '24 hours';
  IF v_count_day >= 3 THEN
    RETURN 'rate_limit_day';
  END IF;

  -- Gate 3: User-Weekly (10 pro rollendem 7d-Fenster)
  SELECT COUNT(*) INTO v_count_week
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '7 days';
  IF v_count_week >= 10 THEN
    RETURN 'rate_limit_week';
  END IF;

  RETURN 'ok';
END;
$$;

-- Grants bleiben wie in Phase 1 gesetzt (authenticated + service_role).
REVOKE ALL ON FUNCTION public.check_ai_image_rate_limit(UUID, ai_image_purpose) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_image_rate_limit(UUID, ai_image_purpose) TO authenticated, service_role;

-- ── 4. User-Quota-RPC (für UI-Counter) ───────────────────────────────────────
-- Gibt einen JSON-Payload zurück mit den aktuellen User-Counts + Limits +
-- globalem Cap-Status. Wird beim Sheet-Open aufgerufen und als Scarcity-
-- Indikator ("Heute noch 2 von 3 Bildern") + Disable-State für den Submit-
-- Button genutzt.
CREATE OR REPLACE FUNCTION public.get_ai_image_user_quota(
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_count_day         INT;
  v_count_week        INT;
  v_platform_cents    INT;
  v_platform_cap      CONSTANT INT := 5000;
  v_limit_day         CONSTANT INT := 3;
  v_limit_week        CONSTANT INT := 10;
  v_feature_enabled   BOOLEAN;
BEGIN
  -- Strikter Identity-Check: der Caller darf nur seine eigene Quota abfragen.
  -- SECURITY DEFINER läuft sonst als Owner und würde sonst fremde User-Quotas
  -- leaken. `auth.uid()` im Aufruferkontext = JWT-Subject.
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT public.is_feature_enabled('ai_image_enabled') INTO v_feature_enabled;

  SELECT COUNT(*) INTO v_count_day
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '24 hours';

  SELECT COUNT(*) INTO v_count_week
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '7 days';

  SELECT COALESCE(SUM(cost_cents), 0) INTO v_platform_cents
    FROM public.ai_image_generations
   WHERE created_at > NOW() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'used_today',             v_count_day,
    'limit_day',              v_limit_day,
    'remaining_today',        GREATEST(v_limit_day - v_count_day, 0),
    'used_week',              v_count_week,
    'limit_week',             v_limit_week,
    'remaining_week',         GREATEST(v_limit_week - v_count_week, 0),
    'platform_cap_reached',   v_platform_cents >= v_platform_cap,
    'feature_enabled',        v_feature_enabled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_image_user_quota(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_image_user_quota(UUID) TO authenticated, service_role;

-- ── 5. Mark-Consumed-RPC ─────────────────────────────────────────────────────
-- Frontend ruft diese RPC wenn der User im AIImageSheet "Verwenden" klickt
-- und das Bild tatsächlich ins Produkt/Live/Post übernommen wird. Verhindert
-- dass der Retention-Cron es als "Wegwerf-Generierung" einsammelt.
--
-- Kein harter Fehler wenn bereits consumed_at gesetzt ist — idempotent, weil
-- Users manchmal doppelt klicken oder Race-Bedingungen im optimistischen UI
-- auftreten. Erste Zuweisung gewinnt, zweite ist No-Op.
CREATE OR REPLACE FUNCTION public.mark_ai_image_consumed(
  p_generation_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.ai_image_generations
     SET consumed_at = COALESCE(consumed_at, NOW())
   WHERE id = p_generation_id
     AND user_id = auth.uid();

  -- Kein RAISE wenn 0 Rows getroffen — das kann passieren wenn a) die Row
  -- dem User nicht gehört (dann ist das eine stille Sicherheitsabwehr) oder
  -- b) die Row zwischenzeitlich gelöscht wurde (Edge-Case bei Account-
  -- Delete während Sheet offen). In beiden Fällen wäre ein Fehler im UI
  -- eine schlechte UX ohne Mehrwert.
END;
$$;

REVOKE ALL ON FUNCTION public.mark_ai_image_consumed(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_ai_image_consumed(UUID) TO authenticated, service_role;

-- ── 6. Admin-View für den Daily-Report-Cron ──────────────────────────────────
-- Aggregiert die gestrigen Zahlen in ein JSON-Objekt. Wird von der
-- `ai-image-daily-report` Edge-Function gerufen, die das in eine Resend-Mail
-- rendert.
CREATE OR REPLACE FUNCTION public.get_ai_image_daily_report(
  p_since TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '1 day')
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_total_requests    INT;
  v_successful        INT;
  v_failed            INT;
  v_total_cents       INT;
  v_unique_users      INT;
  v_platform_30d      INT;
  v_platform_cap      CONSTANT INT := 5000;
  v_by_purpose        JSONB;
  v_top_users         JSONB;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE error IS NULL),
         COUNT(*) FILTER (WHERE error IS NOT NULL),
         COALESCE(SUM(cost_cents), 0),
         COUNT(DISTINCT user_id)
    INTO v_total_requests, v_successful, v_failed, v_total_cents, v_unique_users
    FROM public.ai_image_generations
   WHERE created_at >= p_since;

  SELECT COALESCE(SUM(cost_cents), 0) INTO v_platform_30d
    FROM public.ai_image_generations
   WHERE created_at > NOW() - INTERVAL '30 days';

  SELECT COALESCE(jsonb_object_agg(purpose::TEXT, cnt), '{}'::jsonb)
    INTO v_by_purpose
    FROM (
      SELECT purpose, COUNT(*) AS cnt
        FROM public.ai_image_generations
       WHERE created_at >= p_since
       GROUP BY purpose
    ) s;

  -- Top-5 Nutzer — hilft Missbrauchs-Pattern früh zu erkennen.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', user_id, 'count', cnt)), '[]'::jsonb)
    INTO v_top_users
    FROM (
      SELECT user_id, COUNT(*) AS cnt
        FROM public.ai_image_generations
       WHERE created_at >= p_since
       GROUP BY user_id
       ORDER BY cnt DESC
       LIMIT 5
    ) s;

  RETURN jsonb_build_object(
    'since',                  p_since,
    'total_requests',         v_total_requests,
    'successful',             v_successful,
    'failed',                 v_failed,
    'total_cents',            v_total_cents,
    'total_dollars',          ROUND(v_total_cents::numeric / 100, 2),
    'unique_users',           v_unique_users,
    'platform_30d_cents',     v_platform_30d,
    'platform_30d_dollars',   ROUND(v_platform_30d::numeric / 100, 2),
    'platform_cap_cents',     v_platform_cap,
    'platform_pct_used',      ROUND((v_platform_30d::numeric / v_platform_cap) * 100, 1),
    'by_purpose',             v_by_purpose,
    'top_users',              v_top_users
  );
END;
$$;

-- Nur Service-Role — die Function exposiert Aggregat-User-Daten an den
-- Betreiber, nicht an Enduser.
REVOKE ALL ON FUNCTION public.get_ai_image_daily_report(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_image_daily_report(TIMESTAMPTZ) TO service_role;

-- ── 7. Retention-Helper-RPC ──────────────────────────────────────────────────
-- Liefert die Storage-Pfade zum Löschen (Storage-Delete läuft in der Edge-
-- Function via @supabase/supabase-js → storage.from().remove()). Die DB-Rows
-- löschen wir im selben Call. Zwei-Schritt-Strategie damit ein fehlgeschlagener
-- Storage-Delete nicht verwaist bleibt — die Row wird erst nach erfolgreichem
-- Remove gelöscht. Siehe `ai-image-retention` Edge-Function.
CREATE OR REPLACE FUNCTION public.list_ai_image_unconsumed_paths(
  p_older_than INTERVAL DEFAULT INTERVAL '7 days',
  p_limit INT DEFAULT 500
) RETURNS TABLE (id UUID, storage_path TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, storage_path
    FROM public.ai_image_generations
   WHERE consumed_at IS NULL
     AND storage_path IS NOT NULL
     AND created_at < NOW() - p_older_than
   ORDER BY created_at ASC
   LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.list_ai_image_unconsumed_paths(INTERVAL, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_ai_image_unconsumed_paths(INTERVAL, INT) TO service_role;

-- ── 8. Retention-Delete-RPC (wird vom Cron nach erfolgreichem Storage-Remove gerufen) ──
CREATE OR REPLACE FUNCTION public.delete_ai_image_generations(
  p_ids UUID[]
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INT;
BEGIN
  WITH d AS (
    DELETE FROM public.ai_image_generations
     WHERE id = ANY(p_ids)
       AND consumed_at IS NULL  -- Paranoid-Check: consumed Rows bleiben intakt
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM d;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_ai_image_generations(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_ai_image_generations(UUID[]) TO service_role;
