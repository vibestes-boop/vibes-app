-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Women-Only Zone — Serlo v1.11.0
-- Datum: 2026-04-14
-- Beschreibung:
--   1. profiles: gender, women_only_verified, verification_level
--   2. posts: women_only Feld
--   3. live_sessions: women_only Feld
--   4. RLS-Policies für Zugangskontrolle
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Profiles erweitern ────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender               TEXT
    CHECK (gender IN ('female', 'male', 'other')),
  ADD COLUMN IF NOT EXISTS women_only_verified  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_level   INTEGER NOT NULL DEFAULT 0;
    -- 0 = keine Verifikation
    -- 1 = Level 1: Selbstdeklaration (sofort, kein Upload)
    -- 2 = Level 2: Selfie-Check via ML Kit (Phase 2, lokal auf Gerät)

COMMENT ON COLUMN profiles.gender               IS 'Geschlecht der Nutzerin (optional, für Women-Only Zone)';
COMMENT ON COLUMN profiles.women_only_verified  IS 'Hat die Zugang zur Women-Only Zone? true wenn gender=female + Level>=1';
COMMENT ON COLUMN profiles.verification_level   IS '0=keine, 1=Selbstdeklaration, 2=Selfie-geprüft';

-- ── 2. Posts: Women-Only Flag ─────────────────────────────────────────────
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS women_only BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN posts.women_only IS 'Wenn true: nur für verifizierte Frauen sichtbar (RLS)';

-- ── 3. Live Sessions: Women-Only Flag ────────────────────────────────────
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS women_only BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN live_sessions.women_only IS 'Wenn true: nur für verifizierte Frauen beitretbar';

-- ── 4. RLS Policies ──────────────────────────────────────────────────────

-- Helper Function: Ist die aktuelle Nutzerin in der Women-Only Zone?
CREATE OR REPLACE FUNCTION is_women_only_verified()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND gender = 'female'
      AND women_only_verified = true
  );
$$;

-- RLS: Posts — Women-Only Posts nur für verifizierte Frauen
-- HINWEIS: Falls noch keine RLS Policy existiert, erst aktivieren:
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Bestehende Catch-all Policy entfernen falls vorhanden (Supabase default)
DROP POLICY IF EXISTS "posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Allow public read access" ON posts;

-- Neue Policy: Normale Posts für alle, Women-Only Posts nur für verifizierte Frauen
CREATE POLICY "posts_select_with_women_only"
  ON posts FOR SELECT
  USING (
    women_only = false
    OR is_women_only_verified()
  );

-- Creator kann eigene Posts immer sehen
CREATE POLICY "posts_select_own"
  ON posts FOR SELECT
  USING (author_id = auth.uid());

-- ── 5. Live Sessions RLS ─────────────────────────────────────────────────
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_sessions are viewable by everyone" ON live_sessions;

CREATE POLICY "live_sessions_select_with_women_only"
  ON live_sessions FOR SELECT
  USING (
    women_only = false
    OR host_id = auth.uid()
    OR is_women_only_verified()
  );

-- ── 6. Index für Performance ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_posts_women_only ON posts(women_only) WHERE women_only = true;
CREATE INDEX IF NOT EXISTS idx_live_sessions_women_only ON live_sessions(women_only) WHERE women_only = true;
CREATE INDEX IF NOT EXISTS idx_profiles_women_only_verified ON profiles(women_only_verified) WHERE women_only_verified = true;
