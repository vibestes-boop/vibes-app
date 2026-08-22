-- ─────────────────────────────────────────────────────────────────────────────
-- Eine Nachricht kann sich auf ein Angebot beziehen
--
-- DAS PROBLEM
-- Der „Nachricht schreiben"-Knopf am Angebot füllt den Entwurf mit
-- „Hallo! Ist „<Titel>" noch da?" — und mehr kommt beim Verkäufer nicht an. Er
-- hat womöglich dreißig Angebote, mehrere heißen ähnlich, und ein Titel im
-- Fließtext ist weder ein Bild noch ein Weg zum Artikel. Der Käufer wiederum
-- kann seine eigene Frage später nicht mehr zuordnen.
--
-- Kleinanzeigen, Vinted und Whatnot hängen an genau diese erste Nachricht eine
-- Produktkarte. Berkat hatte dafür kein Feld: `messages` trägt `post_id`
-- (Serlos Video-Beitrag), `image_url`, `story_media_url` — nichts für ein
-- Angebot.
--
-- WARUM AN DIE NACHRICHT UND NICHT AN DIE UNTERHALTUNG
-- Über Wochen fragt derselbe Mensch nach mehreren Artikeln. Hängt der Bezug an
-- der Unterhaltung, überschreibt die zweite Frage die erste. An der Nachricht
-- behält er seinen Platz in der Zeit — dieselbe Entscheidung wie bei der
-- Streit-Karte im Verlauf (HANDOFF 68): „dort hat er etwas, das ein fester
-- Kasten nicht hat — einen Platz in der Zeit."
--
-- ⚠️ `messages` GEHÖRT SERLO MIT
-- Die Spalte ist additiv und nullable. Serlos App und Web schreiben sie nicht
-- und lesen sie nicht; eine Zeile ohne `listing_id` verhält sich wie bisher.
-- Dasselbe Muster wie `scheduled_lives.cover_url` (HANDOFF 3): Ein unbekanntes
-- Feld im Ergebnisobjekt stört keinen Client — was NICHT gilt, sobald man eine
-- Spalte anlegt, die etwas Vertrauliches trägt. Diese trägt eine Artikel-ID,
-- und die ist für jeden lesbar, der den Artikel ohnehin sehen darf.
--
-- ⚠️ KEIN EIGENES `GRANT SELECT` NÖTIG — ABER GEPRÜFT, NICHT GEGLAUBT
-- Die eingefrorene Spaltenliste betrifft `live_sessions`,
-- `user_whip_ingresses` und `profiles` (CLAUDE.md Regel 11). `messages` steht
-- nicht darauf. Gegenprobe 2 unten misst es, statt es anzunehmen — es ist
-- genau der Fehler, der am 16.08. bei `profiles.banner_url` zugeschlagen hat.
--
-- ⚠️ FREMDSCHLÜSSEL AUF `live_auctions`
-- Serlo benutzt `live_auctions` nirgends (in der neunten Analyse am Quelltext
-- gegengeprüft) — die Tabelle gehört Berkat allein. `ON DELETE SET NULL`, weil
-- ein zurückgezogenes Angebot auf `cancelled` gesetzt und nicht gelöscht wird:
-- Der Fremdschlüssel greift praktisch nie, und wenn doch, bleibt die Nachricht
-- stehen und verliert nur ihre Karte.
--
-- KEINE RLS-ÄNDERUNG, UND DAS IST DER PUNKT
-- Wer die NACHRICHT lesen darf, entscheidet unverändert die Policy auf
-- `messages`. Ob er den ARTIKEL sehen darf, entscheidet beim separaten Lesen
-- `live_auctions_select_standing` — samt Frauen-Only-Schranke. Ein geschütztes
-- Angebot kommt dort als `null` zurück, die Karte rendert dann nichts und der
-- Text bleibt stehen. Dieselbe Sprache wie auf der Artikelseite (HANDOFF 21):
-- „gibt es nicht" statt „keine Berechtigung", damit die Existenz nicht über
-- die Antwort durchsickert.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS listing_id uuid
    REFERENCES public.live_auctions(id) ON DELETE SET NULL;

-- Nur die Zeilen mit Bezug — das sind wenige, und gefragt wird immer nach
-- „welche Nachrichten hängen an diesem Angebot".
CREATE INDEX IF NOT EXISTS idx_messages_listing
  ON public.messages(listing_id)
  WHERE listing_id IS NOT NULL;

COMMENT ON COLUMN public.messages.listing_id IS
  'Berkat: Das Angebot, um das es in dieser Nachricht geht. Nullable und '
  'additiv — Serlo schreibt und liest die Spalte nicht. Die Sichtbarkeit des '
  'Artikels entscheidet live_auctions_select_standing beim separaten Lesen, '
  'nicht diese Spalte.';

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. Die Spalte ist da und nullable:
--      SELECT column_name, data_type, is_nullable
--        FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='messages'
--         AND column_name='listing_id';
--      -- erwartet: uuid, YES
--
-- 2. ⚠️ DIE WICHTIGE: Ist die Spaltenliste von `messages` eingefroren?
--      SELECT grantee, privilege_type, column_name
--        FROM information_schema.column_privileges
--       WHERE table_schema='public' AND table_name='messages'
--         AND grantee IN ('anon','authenticated')
--       ORDER BY grantee, column_name;
--      -- ERWARTET: LEER. Eine leere Antwort heißt „das Recht gilt für die
--      -- ganze Tabelle", die neue Spalte ist also mitgedeckt.
--      -- Kommen ZEILEN zurück, gilt Regel 11 auch hier, und dann fehlt:
--      --   GRANT SELECT (listing_id) ON public.messages TO anon, authenticated;
--      -- Ohne das scheitert JEDE Abfrage, die die Spalte auch nur erwähnt.
--
-- 3. Die App-Sicht, aus einer angemeldeten Sitzung (nicht aus dem SQL-Editor):
--      Ein Angebot öffnen → „Nachricht schreiben" → senden.
--      SELECT id, listing_id, left(content, 40)
--        FROM messages WHERE listing_id IS NOT NULL
--       ORDER BY created_at DESC LIMIT 3;
--      -- erwartet: die gerade gesendete Zeile mit gesetzter listing_id
--
-- 4. Serlo bleibt unberührt — dieselbe Zählung vor und nach dem Einspielen:
--      SELECT count(*) FROM messages WHERE listing_id IS NULL;
-- ─────────────────────────────────────────────────────────────────────────────
