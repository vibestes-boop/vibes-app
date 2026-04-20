-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Creator Activation — Serlo v1.11.0
-- Datum: 2026-04-14
-- Beschreibung:
--   1. profiles.is_creator       →  Creator-Status (self-activation)
--   2. profiles.display_name     →  Anzeigename (optional)
--   3. payout_requests Tabelle   →  Auszahlungs-Anfragen
--   4. RLS für payout_requests
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. profiles: is_creator + display_name ─────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_creator   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN profiles.is_creator   IS 'Creator-Status: true = Creator-Dashboard und Monetarisierungs-Features aktiv';
COMMENT ON COLUMN profiles.display_name IS 'Öffentlicher Anzeigename (optional, sonst username)';

CREATE INDEX IF NOT EXISTS idx_profiles_is_creator ON profiles(is_creator) WHERE is_creator = true;

-- ── 2. payout_requests Tabelle ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  diamonds_amount BIGINT NOT NULL,          -- Beantragte Diamonds
  euro_amount     NUMERIC(10, 2) NOT NULL,  -- Entsprechender Euro-Betrag (diamonds / 50)
  iban            TEXT,                     -- IBAN für SEPA-Überweisung
  paypal_email    TEXT,                     -- PayPal-Alternative
  note            TEXT,                     -- Optionale Notiz des Creators
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
  admin_note      TEXT,                     -- Admin-Kommentar bei Ablehnung
  created_at      TIMESTAMPTZ DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

COMMENT ON TABLE payout_requests IS 'Creator-Auszahlungsanfragen (manuell bearbeitet in Phase 1)';

-- ── 3. RLS ────────────────────────────────────────────────────────────
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- Creator: eigene Anfragen sehen
CREATE POLICY "payout_requests_select_own"
  ON payout_requests FOR SELECT
  USING (creator_id = auth.uid());

-- Creator: neue Anfrage stellen
CREATE POLICY "payout_requests_insert_own"
  ON payout_requests FOR INSERT
  WITH CHECK (creator_id = auth.uid());

-- Admin: alle sehen und aktualisieren (via SECURITY DEFINER Funktion)
-- (Admin-Zugriff erfolgt über admin_get_payout_requests RPC)

-- ── 4. Admin-RPC für Payout-Übersicht ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_payout_requests(
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  creator_id      UUID,
  username        TEXT,
  display_name    TEXT,
  avatar_url      TEXT,
  diamonds_amount BIGINT,
  euro_amount     NUMERIC,
  iban            TEXT,
  paypal_email    TEXT,
  note            TEXT,
  status          TEXT,
  admin_note      TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Admin-Zugriff';
  END IF;
  RETURN QUERY
    SELECT
      pr.id, pr.creator_id,
      p.username, p.display_name, p.avatar_url,
      pr.diamonds_amount, pr.euro_amount,
      pr.iban, pr.paypal_email, pr.note,
      pr.status, pr.admin_note, pr.created_at
    FROM payout_requests pr
    JOIN profiles p ON p.id = pr.creator_id
    WHERE (p_status IS NULL OR pr.status = p_status)
    ORDER BY pr.created_at DESC;
END;
$$;

-- ── 5. Admin: Status einer Anfrage ändern ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_payout_status(
  p_request_id UUID,
  p_status     TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Admin-Zugriff';
  END IF;
  UPDATE payout_requests
  SET
    status       = p_status,
    admin_note   = COALESCE(p_admin_note, admin_note),
    processed_at = CASE WHEN p_status IN ('paid', 'rejected') THEN now() ELSE processed_at END
  WHERE id = p_request_id;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Creator Activation Migration erfolgreich';
END $$;
