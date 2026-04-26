-- v1.w.UI.36 — Persistenter WHIP-Ingress
--
-- Jeder User bekommt genau einen permanenten LiveKit-Ingress.
-- Der Ingress (= WHIP-URL + Stream-Key) lebt unabhängig von einzelnen
-- live_sessions — er wird einmal erstellt und nur auf expliziten Wunsch
-- ("Schlüssel rotieren") erneuert.
--
-- Vorteil: OBS muss ein einziges Mal konfiguriert werden; danach kann
-- der Streamer beliebig viele Sessions starten ohne seinen OBS-Setup
-- anzufassen.
--
-- Sicherheit:
--   - stream_key ist eine sensitive Spalte → direkte SELECT-Rechte
--     werden entzogen; Zugriff nur via get_my_whip_ingress() RPC
--     (SECURITY DEFINER).
--   - Alle anderen Spalten sind über Standard-RLS zugänglich.

-- ── Tabelle ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_whip_ingresses (
  user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ingress_id   TEXT        NOT NULL,
  ingress_url  TEXT        NOT NULL,
  stream_key   TEXT        NOT NULL,
  room_name    TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatisches updated_at-Tracking (gleicher Pattern wie live_sessions)
CREATE OR REPLACE FUNCTION _update_user_whip_ingresses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_user_whip_ingresses_updated_at ON user_whip_ingresses;
CREATE TRIGGER trg_user_whip_ingresses_updated_at
  BEFORE UPDATE ON user_whip_ingresses
  FOR EACH ROW EXECUTE FUNCTION _update_user_whip_ingresses_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE user_whip_ingresses ENABLE ROW LEVEL SECURITY;

-- Kein direkter Zugriff für anon
REVOKE ALL ON user_whip_ingresses FROM anon;

-- Authenticated darf alles außer stream_key (wird weiter unten entzogen)
GRANT SELECT, INSERT, UPDATE, DELETE ON user_whip_ingresses TO authenticated;

CREATE POLICY "own_ingress_select" ON user_whip_ingresses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own_ingress_insert" ON user_whip_ingresses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_ingress_update" ON user_whip_ingresses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own_ingress_delete" ON user_whip_ingresses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- stream_key ist sensitiv — direktes Lesen via REST/SDK deaktivieren.
-- Zugriff ausschließlich über den SECURITY DEFINER RPC unten.
REVOKE SELECT (stream_key) ON user_whip_ingresses FROM authenticated, anon;

-- ── SECURITY DEFINER RPC ────────────────────────────────────────────────────────
-- get_my_whip_ingress() — gibt alle Felder inklusive stream_key zurück,
-- aber nur für den aufrufenden User selbst. Umgeht die column-level REVOKE
-- via SECURITY DEFINER (läuft als Postgres-Owner, nicht als Caller).

DROP FUNCTION IF EXISTS get_my_whip_ingress();

CREATE FUNCTION get_my_whip_ingress()
RETURNS TABLE (
  ingress_id  TEXT,
  ingress_url TEXT,
  stream_key  TEXT,
  room_name   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT w.ingress_id, w.ingress_url, w.stream_key, w.room_name
    FROM   user_whip_ingresses w
    WHERE  w.user_id = auth.uid();
END;
$$;

-- Minimale Rechte: nur authenticated, kein Public/anon
REVOKE ALL ON FUNCTION get_my_whip_ingress() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_my_whip_ingress() TO authenticated;
