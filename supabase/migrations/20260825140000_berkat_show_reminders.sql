-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: eine SENDUNG vormerken — ohne dem Verkäufer folgen zu müssen
--
-- ── ⚠️ DAS HIER WIDERSPRICHT EINER FRÜHEREN ENTSCHEIDUNG, UND DAS GEHÖRT GESAGT
--
-- Im Kopf von `lib/useSchedule.ts` steht seit dem 15.08.2026:
--
--   „Es gibt bewusst keinen ‚Erinnere mich'-Knopf: Das wäre ein zweiter
--    Mechanismus neben `follows`, und Folgen ist die Beziehung, die auch sonst
--    zählt. Wer erinnert werden will, folgt."
--
-- Die Begründung ist gut und sie hat ein Loch, das erst in Phase 0 aufgeht:
-- **Am ersten Abend folgt niemand niemandem.** Ein Verkäufer, der zum ersten
-- Mal sendet, hat null Follower — sein Erinnerungs-Fanout geht an null Menschen.
-- Genau der Abend, an dem Publikum am meisten zählt, ist der, an dem der
-- Mechanismus nichts tut.
--
-- Folgen ist eine Aussage über eine **Person** („zeig mir alles von dem").
-- Vormerken ist eine über einen **Termin** („ich habe Freitag um acht Zeit").
-- Das sind zwei Fragen, und die zweite kann man beantworten, ohne die erste zu
-- stellen. Whatnot trennt sie genauso.
--
-- ⚠️ Der Preis ist derselbe, vor dem die alte Notiz warnt: zwei Wege zu
-- derselben Meldung. Deshalb ist der Fanout unten ein **UNION**, kein
-- `UNION ALL` — wer folgt UND vorgemerkt hat, bekommt eine Meldung, nicht zwei.
--
-- ── ⚠️ DIE FUNKTION GEHÖRT SERLO, NICHT BERKAT ──────────────────────────────
--
-- `mark_due_scheduled_lives_reminded` ist Serlos Apparat (`20260421000000`),
-- den Berkat mitbenutzt. Die zweite Quelle ist deshalb eine **Berkat-eigene**
-- Tabelle: Für eine Serlo-Show findet der UNION dort schlicht keine Zeile, und
-- das Verhalten bleibt Zeichen für Zeichen dasselbe. Der Rumpf ist aus
-- `20260815120000` übernommen und an genau zwei Stellen ergänzt.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Die Vormerkung ───────────────────────────────────────────────────────
--
-- Kein eigenes `id`: Das Paar IST der Schlüssel. Ein Mensch kann denselben
-- Termin nicht zweimal vormerken, und der Primärschlüssel sagt das, statt es
-- einem `ON CONFLICT` zu überlassen.
--
-- ⚠️ `ON DELETE CASCADE` auf beiden Seiten. Wird der Termin abgesagt oder das
-- Konto gelöscht, ist die Vormerkung gegenstandslos — sie hängt an nichts
-- Eigenem. Das ist der Unterschied zu `berkat_auction_reminders`, wo dieselbe
-- Überlegung schon einmal getroffen wurde.
CREATE TABLE IF NOT EXISTS public.berkat_show_reminders (
  schedule_id uuid NOT NULL REFERENCES public.scheduled_lives(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (schedule_id, user_id)
);

-- Der Fanout fragt „wer hat DIESEN Termin vorgemerkt" — der Primärschlüssel
-- deckt das ab. Der zweite Index ist für die Gegenrichtung („meine
-- Vormerkungen"), die der Aktivitäts-Reiter braucht.
CREATE INDEX IF NOT EXISTS berkat_show_reminders_user
  ON public.berkat_show_reminders (user_id, created_at DESC);

ALTER TABLE public.berkat_show_reminders ENABLE ROW LEVEL SECURITY;

-- ⚠️ Nur die eigenen Zeilen, in alle drei Richtungen. Wer einen Termin
-- vorgemerkt hat, ist niemandes Geschäft — auch nicht das des Gastgebers. Eine
-- Zählung („N warten") wäre eine eigene Entscheidung und eine eigene Funktion;
-- hier steht sie ausdrücklich NICHT.
DROP POLICY IF EXISTS berkat_show_reminders_select ON public.berkat_show_reminders;
CREATE POLICY berkat_show_reminders_select ON public.berkat_show_reminders
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS berkat_show_reminders_insert ON public.berkat_show_reminders;
CREATE POLICY berkat_show_reminders_insert ON public.berkat_show_reminders
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS berkat_show_reminders_delete ON public.berkat_show_reminders;
CREATE POLICY berkat_show_reminders_delete ON public.berkat_show_reminders
  FOR DELETE USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.berkat_show_reminders FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.berkat_show_reminders TO authenticated;

COMMENT ON TABLE public.berkat_show_reminders IS
  'Wer will an DIESEN Termin erinnert werden, ohne dem Gastgeber zu folgen. '
  'Wird beim Erinnerungs-Fanout verbraucht (mark_due_scheduled_lives_reminded).';

-- ─── 2. Der Fanout bekommt eine zweite Quelle ────────────────────────────────
--
-- ⚠️ Rumpf zeichengleich aus `20260815120000`, ergänzt um:
--   (a) den `targets`-CTE mit dem UNION
--   (b) das Aufräumen der verbrauchten Vormerkungen
--
-- Signatur unverändert → `CREATE OR REPLACE` statt DROP+CREATE: keine
-- Rechte-Rücksetzung auf PUBLIC (die `credit_coins`-Falle vom 14.08.), keine
-- zweite Überladung, kein HTTP 300.
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
  v_row   public.scheduled_lives%ROWTYPE;
  v_count INT;
BEGIN
  FOR v_row IN
    SELECT *
      FROM public.scheduled_lives
     WHERE status = 'scheduled'
       AND scheduled_at <= NOW() + INTERVAL '15 minutes'
       AND scheduled_at > NOW() - INTERVAL '1 hour'
     ORDER BY scheduled_at ASC
     LIMIT p_batch_size
     FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.scheduled_lives
         SET status      = 'reminded',
             reminded_at = NOW()
       WHERE id = v_row.id;

      WITH targets AS (
        -- Wer dem Gastgeber folgt — der alte Weg, unverändert.
        SELECT f.follower_id AS uid
          FROM public.follows f
         WHERE f.following_id = v_row.host_id
        -- ⚠️ UNION, nicht UNION ALL. Wer folgt UND vorgemerkt hat, bekommt
        -- EINE Meldung. Zwei wären schlimmer als keine: Der Nutzer lernt
        -- daraus, dass die App doppelt schickt, und schaltet sie ab.
        UNION
        SELECT r.user_id
          FROM public.berkat_show_reminders r
         WHERE r.schedule_id = v_row.id
      ),
      inserted AS (
        INSERT INTO public.notifications (
          recipient_id, sender_id, type, session_id, comment_text, app
        )
        SELECT
          t.uid,
          v_row.host_id,
          'scheduled_live_reminder',
          NULL,
          v_row.title,
          v_row.app
          FROM targets t
         -- Der Gastgeber braucht keine Erinnerung an seine eigene Sendung.
         -- Über `follows` konnte das bisher nicht passieren (niemand folgt
         -- sich selbst); über eine Vormerkung schon.
         WHERE t.uid <> v_row.host_id
        RETURNING 1
      )
      SELECT COUNT(*)::INT INTO v_count FROM inserted;

      -- ⚠️ Verbraucht, wie die Glocke am Artikel (`20260819160000`): Eine
      -- Vormerkung hat genau einen Zweck, und der ist jetzt erfüllt. Ohne das
      -- Aufräumen bliebe sie liegen und niemand wüsste, ob sie noch etwas
      -- bedeutet — dieselbe Überlegung, aus der `start_live_auction` die
      -- Artikel-Vormerkung löscht.
      DELETE FROM public.berkat_show_reminders WHERE schedule_id = v_row.id;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN — von aussen, nicht am Abzug
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1 · Ohne Anmeldung nichts:
--     curl "$U/rest/v1/berkat_show_reminders?select=user_id" -H "apikey: $ANON"
--     → erwartet 401 / 42501
--
-- 2 · Fremde Vormerkungen bleiben unsichtbar: aus einer angemeldeten Sitzung
--     ohne Filter lesen → nur die eigenen Zeilen kommen zurück.
--
-- 3 · ⚠️ Der eigentliche Test, und er braucht Geduld: Termin auf „in 14
--     Minuten" legen, mit einem Konto vormerken, das dem Gastgeber NICHT folgt,
--     und den Cron laufen lassen. Erwartet: eine `notifications`-Zeile vom Typ
--     `scheduled_live_reminder` für dieses Konto — und die Zeile in
--     `berkat_show_reminders` ist danach weg.
--
-- 4 · Die Dublette: dasselbe Konto folgt dem Gastgeber UND merkt vor.
--     Erwartet nach dem Cron: GENAU EINE Meldung, nicht zwei.
--
-- 5 · Serlo bleibt unberührt: eine Serlo-Show mit Followern erinnert weiterhin
--     genauso viele Menschen wie vorher — der UNION findet in der
--     Berkat-Tabelle keine Zeile.
-- ─────────────────────────────────────────────────────────────────────────────
