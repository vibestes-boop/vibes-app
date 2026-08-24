-- ═══════════════════════════════════════════════════════════════════════════
-- 24.08.2026 · Berkat · vorbereitete Artikel fallen ins Regal zurück
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Von Zaur am Gerät gesehen: Auf „Verkaufen" stand als größtes Element
--
--     „3 Artikel warten auf einen Abend, den es nicht mehr gibt.
--      Leg einen neuen Termin an und bereite sie dort neu vor — oder wirf sie weg."
--
-- und gleichzeitig weiter unten „Dein Regal — leer". Zwei Zahlen über dieselben
-- drei Dinge, die sich widersprechen.
--
-- ── DAS MODELL, UND WO ES KLEMMT ────────────────────────────────────────────
--
-- Ein Artikel ohne Session steht über `status` in genau einem von zwei Töpfen:
--
--     status = 'listed'     → Regal, dauerhaft kaufbar
--     status = 'scheduled'  → für den Termin in `planned_for` vorbereitet
--
-- Der zweite Topf bindet den Artikel an einen **Abend**. Verschwindet der Abend,
-- ist der Artikel nirgends mehr: nicht im Regal (dort filtert `shelfQuery` auf
-- `status = 'listed'`) und in keiner Vorbereitung. Er existiert nur noch in
-- `useMyPreparedOrphans`, einer Abfrage, die es allein deshalb gibt, weil dieser
-- Zustand entstehen kann.
--
-- ⚠️ **Der Artikel gehört dem Verkäufer, nicht dem Abend.** Fällt der Termin
-- weg, ist die richtige Antwort nicht „ordne das neu zu oder wirf es weg",
-- sondern: Der Artikel liegt wieder da, wo er ohne Termin hingehört — im Regal.
-- Das ist die kleine Fassung dessen, was Whatnot strukturell löst, indem eine
-- Show nur eine ANSICHT auf das Inventar ist und kein Behälter.
--
-- ── WARUM EIN AUSLÖSER GENÜGT ───────────────────────────────────────────────
--
-- Ein Termin kann auf drei Weisen enden, und alle drei sind Status-Wechsel auf
-- `scheduled_lives` — Zeilen werden nie gelöscht:
--
--     'cancelled'  Verkäufer sagt ab (`cancel_scheduled_live`)
--     'expired'    Abend verstrichen, ohne dass gesendet wurde
--                  (`expire_stale_scheduled_lives`, 2 h Karenz)
--     'live'       Verkäufer sendet — ✅ HIER NICHT NÖTIG
--
-- `live` braucht keine Behandlung: Dieser Status entsteht ausschliesslich beim
-- Verknüpfen, und dort holt `claimPreparedAuctions` die Artikel im selben Zug in
-- die Session (`app/(tabs)/sell.tsx`). Sie sind dann keine Vorbereitung mehr.
--
-- ⚠️ Wer den Auslöser um `live` erweitert, nimmt einem laufenden Verkäufer die
-- Ware MITTEN in der Show aus dem Studio.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.release_prepared_on_plan_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_auctions
     SET status      = 'listed',
         planned_for = NULL
   WHERE planned_for = NEW.id
     -- ⚠️ Beide Bedingungen sind Schutz, nicht Zierde: `session_id IS NULL`
     -- hält die Finger von Ware, die schon in einer Show hängt, und
     -- `status = 'scheduled'` von allem, was bereits verkauft, zurückgezogen
     -- oder ohnehin im Regal ist. Ohne sie könnte dieser Auslöser einen
     -- verkauften Artikel wieder ins Regal legen.
     AND session_id IS NULL
     AND status = 'scheduled';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.release_prepared_on_plan_end() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_release_prepared_on_plan_end ON public.scheduled_lives;

-- `OF status` — der Auslöser interessiert sich nur für den Status. Ein
-- geänderter Titel oder eine verschobene Uhrzeit lässt ihn kalt.
--
-- `WHEN` statt einer IF-Abfrage im Rumpf: So entscheidet Postgres, ob die
-- Funktion überhaupt gerufen wird. Bei einer Erinnerung
-- ('scheduled' → 'reminded') passiert damit buchstäblich nichts.
CREATE TRIGGER trg_release_prepared_on_plan_end
AFTER UPDATE OF status ON public.scheduled_lives
FOR EACH ROW
WHEN (
  NEW.status IN ('cancelled', 'expired')
  AND OLD.status IS DISTINCT FROM NEW.status
)
EXECUTE FUNCTION public.release_prepared_on_plan_end();

-- ── Einmaliges Aufräumen dessen, was schon verwaist ist ─────────────────────
--
-- Der Auslöser oben greift ab jetzt. Die Artikel, die bereits festhängen,
-- erreicht er nicht mehr — ihr Termin hat den Status längst gewechselt.
--
-- ⚠️ Die Bedingung ist ABSICHTLICH weiter als die des Auslösers: Sie bildet
-- nach, was die App als verwaist ANSIEHT (`useMyPreparedOrphans` = alles, dessen
-- Termin nicht mehr bevorsteht). Damit erwischt sie auch Termine, die noch auf
-- `scheduled` stehen, weil der Cron seine zwei Stunden Karenz noch nicht
-- ausgeschöpft hat — sonst bliebe die Aufräum-Karte bis zum nächsten Lauf stehen
-- und der Fix sähe aus, als hätte er nicht gewirkt.
UPDATE public.live_auctions a
   SET status      = 'listed',
       planned_for = NULL
  FROM public.scheduled_lives s
 WHERE a.planned_for = s.id
   AND a.session_id IS NULL
   AND a.status = 'scheduled'
   AND NOT (s.status IN ('scheduled', 'reminded') AND s.scheduled_at > NOW());

-- ═══════════════════════════════════════════════════════════════════════════
-- GEGENPROBEN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Nichts hängt mehr fest — muss 0 liefern:
--      SELECT count(*) FROM live_auctions a JOIN scheduled_lives s ON s.id = a.planned_for
--       WHERE a.session_id IS NULL AND a.status = 'scheduled'
--         AND NOT (s.status IN ('scheduled','reminded') AND s.scheduled_at > NOW());
--
-- 2. Der Auslöser greift: einen Termin mit vorbereiteter Ware absagen
--    (`cancel_scheduled_live`), danach steht der Artikel auf `listed` und
--    `planned_for IS NULL` — und taucht auf „Verkaufen" unter „Dein Regal" auf.
--
-- 3. ⚠️ DIE PROBE, DIE ZÄHLT — dass NICHT zu viel zurückfällt: Während einer
--    laufenden Show darf sich am Studio nichts ändern. Termin verknüpfen, Show
--    starten, dann in einem zweiten Fenster den Termin auf 'cancelled' setzen:
--    Die Ware muss in der Session bleiben (`session_id` ist gesetzt, der
--    Auslöser fasst sie nicht an).
-- ═══════════════════════════════════════════════════════════════════════════
