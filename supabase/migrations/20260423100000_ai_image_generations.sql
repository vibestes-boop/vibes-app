-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — AI-Image-Generation Foundation
-- Datum: 2026-04-23
--
-- ZWECK
-- -----
-- Phase-1-Foundation für AI-Image-Generation via OpenAI gpt-image-1 (später
-- gpt-image-2, sobald die API am 2026-05 öffnet). Diese Migration legt:
--
--   1. `ai_image_generations` — Rate-Limit + Cost-Tracking + Audit-Log
--   2. Storage-Bucket `ai-generated` — öffentlicher Bucket für generierte PNGs
--   3. RLS-Policies + Storage-Policies (Service-Role schreibt, Owner liest)
--   4. RPC `check_ai_image_rate_limit(purpose)` — atomarer Pre-Flight-Check
--      (3 Requests/Minute, 30/Tag, hart-gecappt $X/Monat pro User via Env)
--
-- BENUTZUNG
-- ---------
-- Frontend ruft Edge-Function `generate-image` mit `{ prompt, purpose, size }`.
-- Die Function:
--   (a) Auth-Check → viewerId aus JWT
--   (b) Ruft `check_ai_image_rate_limit(viewerId, purpose)` → 429 wenn limit
--   (c) OpenAI-Call `/v1/images/generations`
--   (d) Upload nach Storage-Bucket `ai-generated/{userId}/{uuid}.png`
--   (e) Insert in `ai_image_generations` mit cost_cents
--   (f) Gibt { url, generationId } zurück
--
-- PURPOSE-ENUM
-- ------------
-- Ein Feld statt mehrere Tabellen — vereinfacht Rate-Limit-Queries und hält
-- Phase-2-Integration (Post-Cover, Live-Thumbnail, Avatar, Sticker, Icon)
-- alle in einer Tabelle. Neue Purposes via ALTER TYPE ADD VALUE (nicht
-- breaking, Postgres unterstützt das enum-live).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Purpose-Enum ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE ai_image_purpose AS ENUM (
    'shop_mockup',        -- Shop-Produktbild für Seller ohne eigenes Foto
    'post_cover',         -- Cover für Video-/Bild-Post
    'live_thumbnail',     -- Thumbnail für Live-Stream vor/während Session
    'avatar',             -- Profilbild-Generator
    'sticker',            -- Admin-Tool: neuer Sticker / Chat-Sticker
    'icon'                -- Admin-Tool: UI-Icon / Gift-Art
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Haupttabelle ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_image_generations (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose       ai_image_purpose NOT NULL,
  prompt        TEXT         NOT NULL CHECK (char_length(prompt) BETWEEN 3 AND 2000),
  -- Model-String zur späteren Analytics-Auswertung (gpt-image-1 vs gpt-image-2)
  model         TEXT         NOT NULL DEFAULT 'gpt-image-1',
  -- Öffentliche URL nach Storage-Upload. Nullable falls Upload fehlschlägt
  -- und die Row nur für Rate-Limit-Accounting bleibt.
  image_url     TEXT,
  -- Storage-Pfad getrennt von URL, damit wir bei Storage-Rename nicht in
  -- tausend Rows URL-Strings patchen müssen.
  storage_path  TEXT,
  size          TEXT         NOT NULL DEFAULT '1024x1024'
                             CHECK (size IN ('1024x1024', '1024x1536', '1536x1024', '512x512')),
  -- Cost-Tracking in Cents (nicht Dollar, keine Floats) — aggregierbar per
  -- SUM(cost_cents) für Budget-Guards.
  cost_cents    INT          NOT NULL DEFAULT 4 CHECK (cost_cents >= 0),
  -- Optional: Fehler-Payload falls OpenAI-Call oder Upload fehlschlug.
  error         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Rate-Limit-Check läuft auf (user_id, created_at DESC) mit Purpose-Filter,
-- der Partial-Index deckt die häufigste Query (last-3-in-60s).
CREATE INDEX IF NOT EXISTS idx_ai_image_gen_user_time
  ON public.ai_image_generations (user_id, created_at DESC);

-- Monatlicher Cost-Cap: SUM(cost_cents) WHERE created_at >= date_trunc('month')
CREATE INDEX IF NOT EXISTS idx_ai_image_gen_cost_month
  ON public.ai_image_generations (user_id, created_at)
  WHERE cost_cents > 0;

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.ai_image_generations ENABLE ROW LEVEL SECURITY;

-- User sieht nur seine eigenen Generations (History, Retry-Flow, Debug).
CREATE POLICY "ai_image_gen_select_own" ON public.ai_image_generations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insert läuft ausschließlich über die Edge-Function (Service-Role).
-- Bewusst KEINE INSERT-Policy für `authenticated` → Client kann nicht direkt
-- in die Tabelle schreiben und so Rate-Limit/Cost-Guards umgehen.
-- Service-Role ignoriert RLS per default, kein expliziter GRANT nötig.

-- ── 4. Storage-Bucket ─────────────────────────────────────────────────────────
-- Öffentlicher Bucket — generierte Bilder werden in <img>-Tags direkt gerendert,
-- keine signierten URLs nötig. Pfad-Konvention `ai-generated/{user_id}/{uuid}.png`
-- macht spätere Per-User-Cleanup-Scripts (Account-Delete, GDPR-Export) trivial.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-generated', 'ai-generated', true)
ON CONFLICT (id) DO NOTHING;

-- Service-Role (Edge Function) darf hochladen.
DO $$ BEGIN
  CREATE POLICY "ai_generated_service_insert"
    ON storage.objects FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'ai-generated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service-Role darf überschreiben (z.B. bei Retry auf gleichem Pfad).
DO $$ BEGIN
  CREATE POLICY "ai_generated_service_update"
    ON storage.objects FOR UPDATE
    TO service_role
    USING (bucket_id = 'ai-generated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public read — URLs sind direkt im UI eingebettet.
DO $$ BEGIN
  CREATE POLICY "ai_generated_public_read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'ai-generated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Owner (auth'd user) darf eigene Bilder löschen — Account-Delete-Flow
-- cascade'd via profile-delete, aber User-initiierte Löschung einzelner
-- Generations ist auch möglich.
DO $$ BEGIN
  CREATE POLICY "ai_generated_owner_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'ai-generated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. Rate-Limit-RPC ─────────────────────────────────────────────────────────
-- Wird von der Edge-Function vor dem OpenAI-Call gerufen. Gibt einen
-- deterministischen Fehlercode zurück (TEXT statt EXCEPTION für leichteres
-- Error-Mapping im Frontend).
--
-- Limits (Default — über ENV in Edge Function überschreibbar, SQL ist Floor):
--   • 3 Requests / 60 Sekunden (Burst-Protection)
--   • 30 Requests / 24 Stunden (Daily-Quota)
--   • 1000 Cents ($10) / 30 Tage (Monatlicher Cost-Cap pro User)
-- Bei Überschreitung gibt die RPC 'rate_limit_minute' / 'rate_limit_day' /
-- 'cost_limit_month' zurück, Edge-Function mappt auf HTTP 429.
--
-- SECURITY DEFINER — läuft als Function-Owner, damit auch anon/authenticated
-- (falls später direkt vom Frontend gerufen) korrekte Counts bekommt. Die
-- Function filtert strikt auf `p_user_id`, kein Leak auf fremde User.
CREATE OR REPLACE FUNCTION public.check_ai_image_rate_limit(
  p_user_id UUID,
  p_purpose ai_image_purpose
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count_minute INT;
  v_count_day    INT;
  v_cost_month   INT;
BEGIN
  -- Minute-Burst
  SELECT COUNT(*) INTO v_count_minute
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '1 minute';
  IF v_count_minute >= 3 THEN
    RETURN 'rate_limit_minute';
  END IF;

  -- Daily-Quota
  SELECT COUNT(*) INTO v_count_day
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '24 hours';
  IF v_count_day >= 30 THEN
    RETURN 'rate_limit_day';
  END IF;

  -- Monthly-Cost-Cap (Default $10/User/30d — Edge-Function kann via ENV härter
  -- capen, aber dieser Floor schützt gegen Leak/Bug).
  SELECT COALESCE(SUM(cost_cents), 0) INTO v_cost_month
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '30 days';
  IF v_cost_month >= 1000 THEN
    RETURN 'cost_limit_month';
  END IF;

  RETURN 'ok';
END;
$$;

-- Rate-Limit darf von authenticated users gecheckt werden (Edge-Function
-- ruft mit Service-Role, aber wir halten es offen für Client-seitige
-- Preflight-Checks wenn der Frontend-Code in Phase 2 ein Warning-Badge
-- zeigen will statt erst beim Submit zu failen).
REVOKE ALL ON FUNCTION public.check_ai_image_rate_limit(UUID, ai_image_purpose) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_image_rate_limit(UUID, ai_image_purpose) TO authenticated, service_role;

-- ── 6. Cleanup-Helper für Account-Delete (optional, aber sauber) ──────────────
-- Bei User-Löschung cascade'd die Tabelle via profiles-FK, aber die Storage-
-- Objekte bleiben liegen. Dieser Helper kann via `delete-account` Edge Function
-- gerufen werden um die PNGs mit zu löschen.
CREATE OR REPLACE FUNCTION public.list_ai_image_storage_paths_for_user(
  p_user_id UUID
) RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT storage_path
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND storage_path IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.list_ai_image_storage_paths_for_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_ai_image_storage_paths_for_user(UUID) TO service_role;
