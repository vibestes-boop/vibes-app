-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: `live_auctions_shelf_check` lässt vorbereitete Artikel zu
--
-- ⚠️ NACHTRAG ZU `20260819110000` — DORT WURDE EIN CHECK ÜBERSEHEN.
--
-- Die Migration vom selben Tag legt `prepare_live_auction` an. Die Funktion
-- schreibt einen Artikel mit `session_id = NULL` und `status = 'scheduled'` —
-- „für eine Show vorbereitet, aber noch nicht darin". Genau das verbietet ein
-- CHECK, der seit `20260815210000` (Dauerangebote) auf der Tabelle liegt:
--
--   (session_id IS NOT NULL AND status <> 'listed')
--   OR (session_id IS NULL AND status IN ('listed','sold','cancelled'))
--
-- Bei `session_id IS NULL` waren also nur drei Status erlaubt, und `scheduled`
-- gehörte nicht dazu. `prepare_live_auction` wurde angelegt, war aber **zur
-- Laufzeit unbrauchbar**: Jeder Aufruf hätte `23514` geworfen.
--
-- WARUM DAS NICHT AUFFIEL
-- Die Funktion selbst ist syntaktisch fehlerfrei, sie legt an, sie bekommt ihre
-- Rechte — `db push` und jede Schema-Prüfung melden Erfolg. Der Widerspruch
-- entsteht erst beim ersten INSERT, also beim ersten echten Verkäufer.
--
-- Die Lehre gehört zu denen, die in HANDOFF 3 stehen: **Eine neue Zeile in eine
-- bestehende Tabelle zu schreiben heißt, ihre CHECK-Constraints zu lesen** —
-- nicht nur ihre Spalten. Der Spaltenname `status` sagt nicht, welche Werte in
-- welcher Kombination erlaubt sind.
--
-- WAS DIE ERWEITERUNG ZULÄSST — UND WAS WEITERHIN NICHT
--   session_id NULL + 'scheduled'  → NEU erlaubt: vorbereiteter Artikel
--   session_id NULL + 'running'    → weiterhin verboten (Geisterzustand: eine
--                                    laufende Auktion ohne Sendung)
--   session_id gesetzt + 'listed'  → weiterhin verboten (wäre gleichzeitig im
--                                    Regal und in der Show)
--
-- Der Schutz bleibt also erhalten; es kommt genau ein Zustand hinzu.
--
-- ⚠️ `claim_prepared_auctions` ist NICHT betroffen: Es setzt `session_id`, und
-- danach greift der erste Zweig (`session_id IS NOT NULL AND status <> 'listed'`).
-- Nur der INSERT in `prepare_live_auction` fiel durch.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.live_auctions DROP CONSTRAINT IF EXISTS live_auctions_shelf_check;
ALTER TABLE public.live_auctions ADD CONSTRAINT live_auctions_shelf_check CHECK (
  (session_id IS NOT NULL AND status <> 'listed')
  OR
  (session_id IS NULL AND status IN ('listed', 'sold', 'cancelled', 'scheduled'))
);

-- ─── Gegenprobe ──────────────────────────────────────────────────────────────
-- 1. Vorbereiten geht jetzt (mit einem eigenen Termin):
--      SELECT prepare_live_auction('<eigener Termin>', 'Testartikel', 500);
--      -- vorher: 23514 · jetzt: eine uuid
--
-- 2. Der Geisterzustand bleibt verboten:
--      UPDATE live_auctions SET status = 'running'
--       WHERE session_id IS NULL AND status = 'scheduled';
--      -- muss weiterhin 23514 werfen
--
-- 3. Das Regal sieht den vorbereiteten Artikel NICHT
--    (`shelfQuery` filtert auf status = 'listed'):
--      SELECT count(*) FROM live_auctions WHERE session_id IS NULL AND status = 'listed';
--      -- Zahl vor und nach `prepare_live_auction` gleich
