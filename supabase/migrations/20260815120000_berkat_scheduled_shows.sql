-- Berkat: Sendeplan — geplante Shows mit Erinnerung
--
-- WARUM DAS DER NÄCHSTE SCHRITT IST
-- Die Whatnot-Analyse (apps/berkat/WHATNOT-ANALYSE.md) setzt den Sendeplan auf
-- Platz 1 ihrer vier Hebel: „Whatnots gesamte Retention hängt an planbaren,
-- wiederkehrenden Shows … was fehlt, ist das Ritual: benannte, wiederkehrende
-- Sendungen + Erinnerungs-Push. Kostet fast nichts, verändert alles." Und § 3.5:
-- „Die 80 % Monatsretention … kommen daher, dass donnerstags um 14:30 dieselbe
-- Person dieselbe Show macht. Retention ist ein Sendeplan, kein Feature."
--
-- Es ist zugleich das, was Phase 0 blockiert. Phase 0 heißt „5 Verkäufer, FESTE
-- TERMINE, 4–8 Wochen" — und in Berkat ließ sich ein Termin nirgends ankündigen.
--
-- WARUM HIER FAST NICHTS NEU GEBAUT WIRD
-- Serlo hat den kompletten Apparat seit dem 21.04.2026 (`20260421000000`):
-- Tabelle `scheduled_lives`, RPCs `schedule_live` / `reschedule_live` /
-- `cancel_scheduled_live` / `link_live_session_to_scheduled`, ein pg_cron, der
-- 15 Minuten vorher alle Follower des Gastgebers benachrichtigt, und der
-- Push-Text liegt bereits als `scheduled_live_reminder` im CASE von
-- `fn_send_push_on_notification`.
--
-- Nach dem Grundsatz „Kein zweiter Weg, wo Serlo schon einen hat" (HANDOFF § 4)
-- wird das angeschlossen statt nachgebaut. Berkat nutzt `follows` ohnehin schon,
-- also stimmt auch der Empfängerkreis ohne eine einzige neue Tabelle.
--
-- WAS TATSÄCHLICH FEHLT: die App-Dimension. `scheduled_lives` wird ab jetzt von
-- beiden Apps benutzt, und ohne Trennung erschiene ein Berkat-Auktionsabend in
-- Serlos Liste geplanter Lives — dieselbe Vermischung, die am 14.08.2026 für
-- `live_sessions` behoben wurde (`20260814280000`).

BEGIN;

-- ─── 1. App-Dimension ────────────────────────────────────────────────────────
-- Default 'serlo' macht den Bestand rückwirkend korrekt: Vor heute konnte gar
-- keine Berkat-Zeile entstehen, weil Berkat die Tabelle nie angefasst hat. Ein
-- Backfill ist deshalb — anders als bei `live_sessions` — nicht nötig.
ALTER TABLE public.scheduled_lives
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'serlo';

ALTER TABLE public.scheduled_lives DROP CONSTRAINT IF EXISTS scheduled_lives_app_check;
ALTER TABLE public.scheduled_lives ADD CONSTRAINT scheduled_lives_app_check
  CHECK (app IN ('serlo', 'berkat'));

-- Beide Apps filtern auf (app, status, scheduled_at) — die Liste „was kommt als
-- Nächstes" ist der häufigste Aufruf der Tabelle.
CREATE INDEX IF NOT EXISTS idx_scheduled_lives_app_time
  ON public.scheduled_lives (app, status, scheduled_at);

-- ⚠️ Vorsichtshalber, wegen der Falle vom 14.08.2026: Auf `live_sessions` lag
-- ein spaltenweises REVOKE, weshalb JEDE später hinzugefügte Spalte für die
-- Clients unsichtbar war und schon ein Filter darauf mit `42501` scheiterte
-- (HANDOFF § 3). Für `scheduled_lives` ist kein solches REVOKE bekannt — falls
-- doch je eines gesetzt wurde, heilt diese Zeile es im Voraus. Steht ein
-- Tabellen-Recht, ist sie wirkungslos und schadet nicht.
GRANT SELECT (app) ON public.scheduled_lives TO anon, authenticated;

-- ─── 2. Die Erinnerung muss die App mitgeben ─────────────────────────────────
-- Sonst fällt die erzeugte Zeile in `notifications` auf den Default 'serlo', und
-- `send_push_to_user` stellt die Erinnerung an eine Berkat-Show auf dem
-- SERLO-Gerät zu. Der bewusste Rückfall („kein Gerät der Ziel-App gefunden →
-- alle Geräte") greift hier nicht, weil ein Serlo-Gerät ja gefunden WIRD.
--
-- Unverändert gegenüber `20260421000000`: Reihenfolge, Idempotenz-Schutz
-- (Status vor Fanout), Fenster (15 min vorher, nicht rückwirkend älter als 1 h),
-- `FOR UPDATE SKIP LOCKED`, und die Fehlerbehandlung je Zeile. Einzige Änderung
-- sind die zwei markierten Stellen.
CREATE OR REPLACE FUNCTION public.mark_due_scheduled_lives_reminded(
  p_batch_size INT DEFAULT 50
)
RETURNS TABLE(
  scheduled_live_id UUID,
  host_id           UUID,
  notified_count    INT,
  success           BOOLEAN,
  error             TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       public.scheduled_lives%ROWTYPE;
  v_count     INT;
BEGIN
  FOR v_row IN
    SELECT *
      FROM public.scheduled_lives
     WHERE status = 'scheduled'
       AND scheduled_at <= NOW() + INTERVAL '15 minutes'
       AND scheduled_at > NOW() - INTERVAL '1 hour'  -- nicht rückwirkend reminen
     ORDER BY scheduled_at ASC
     LIMIT p_batch_size
     FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.scheduled_lives
         SET status      = 'reminded',
             reminded_at = NOW()
       WHERE id = v_row.id;

      WITH inserted AS (
        INSERT INTO public.notifications (
          recipient_id, sender_id, type, session_id, comment_text,
          app                                    -- ← NEU
        )
        SELECT
          f.follower_id,
          v_row.host_id,
          'scheduled_live_reminder',
          NULL,
          v_row.title,
          v_row.app                              -- ← NEU: erbt von der Show
          FROM public.follows f
         WHERE f.following_id = v_row.host_id
        RETURNING 1
      )
      SELECT COUNT(*)::INT INTO v_count FROM inserted;

      scheduled_live_id := v_row.id;
      host_id           := v_row.host_id;
      notified_count    := v_count;
      success           := true;
      error             := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      scheduled_live_id := v_row.id;
      host_id           := v_row.host_id;
      notified_count    := 0;
      success           := false;
      error             := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- ─── 3. Berkats Eingang ──────────────────────────────────────────────────────
-- Wickelt `schedule_live` ein, statt dessen Prüfungen zu kopieren: Anmeldung,
-- nicht-leerer Titel, Fenster 5 Minuten bis 30 Tage. Wer dort etwas ändert,
-- ändert es damit automatisch für beide Apps — genau das ist der Zweck.
--
-- WARUM KEIN ZUSÄTZLICHER PARAMETER AN `schedule_live`: Ein defaultierter
-- Parameter erzeugt in Postgres eine ÜBERLADUNG, keine geänderte Funktion — und
-- Überladungen machen PostgREST mehrdeutig (HTTP 300, gemessen bei
-- `publish_due_scheduled_posts`, siehe CLAUDE.md). Ausgelieferte Serlo-Versionen
-- rufen `schedule_live` weiter unverändert; die Signatur bleibt deshalb, wie sie
-- ist.
--
-- `allow_gifts` steht fest auf FALSE: Geschenke laufen in Serlo über Coins, und
-- Coins sind in Berkat ausgeschlossen (E-Geld, siehe HANDOFF § 7). Es gibt in
-- Berkat keine Oberfläche dafür — ein TRUE wäre ein Versprechen ohne Deckung.
CREATE OR REPLACE FUNCTION public.schedule_berkat_show(
  p_scheduled_at TIMESTAMPTZ,
  p_title        TEXT,
  p_women_only   BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := public.schedule_live(
    p_scheduled_at   => p_scheduled_at,
    p_title          => p_title,
    p_description    => NULL,
    p_allow_comments => true,
    p_allow_gifts    => false,
    p_women_only     => p_women_only
  );

  UPDATE public.scheduled_lives
     SET app = 'berkat'
   WHERE id = v_id;

  RETURN v_id;
END;
$$;

-- Rechte ausdrücklich setzen. CREATE OR REPLACE behält Grants nicht über alle
-- Postgres-Versionen garantiert, und ein DROP+CREATE fällt auf den Standard
-- zurück — EXECUTE für PUBLIC, und PUBLIC schließt `anon` ein. Genau so wurde
-- `credit_coins` am 14.08.2026 ohne Anmeldung aufrufbar.
REVOKE ALL ON FUNCTION public.schedule_berkat_show(TIMESTAMPTZ, TEXT, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_berkat_show(TIMESTAMPTZ, TEXT, BOOLEAN)
  TO authenticated;

REVOKE ALL ON FUNCTION public.mark_due_scheduled_lives_reminded(INT) FROM PUBLIC, anon;

COMMIT;

-- ─── Was NACH dieser Migration noch zu tun ist ───────────────────────────────
-- Die Spalte allein trennt nichts — sie muss auch gefiltert werden. Vier
-- Lesepfade auf `scheduled_lives` existieren, alle gehören auf `app = 'serlo'`:
--
--   lib/useScheduledLives.ts            (Serlo-App)  — 2 Abfragen + Realtime-Filter
--   apps/web/lib/data/live-host.ts      (Web)        — 2 Abfragen
--
-- Berkat filtert entsprechend auf `app = 'berkat'`. Ohne diese vier Stellen
-- taucht ein Berkat-Auktionsabend in Serlos Liste auf — die Migration verhindert
-- das nicht von selbst, sie ermöglicht es nur.
