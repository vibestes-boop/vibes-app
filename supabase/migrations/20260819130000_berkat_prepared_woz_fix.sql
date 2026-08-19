-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: drei Fehler in `20260819110000` — der erste ist ein Frauen-Only-Leck
--
-- Gefunden beim Audit am 19.08.2026, keiner davon war je in Benutzung
-- (`prepare_live_auction` scheiterte bis `20260819120000` ohnehin am CHECK).
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ FEHLER 1 — VORBEREITETE ARTIKEL EINER FRAUEN-ONLY-SHOW WAREN ÖFFENTLICH
--
-- `prepare_live_auction` setzte `women_only` nicht. Die Spalte hat
-- `DEFAULT false`, also stand an jedem vorbereiteten Artikel „nicht
-- geschützt" — und die Lese-Policy für Artikel ohne Session lautet:
--
--   session_id IS NULL AND (women_only = false OR seller_id = auth.uid() OR …)
--
-- Damit wäre die Ware einer Frauen-Only-Sendung **für jeden sichtbar** gewesen,
-- solange sie vorbereitet ist. Titel, Bild, Preis — alles offen, bis die Show
-- startet und der Artikel eine Session bekommt.
--
-- Das ist exakt die Fehlerklasse aus HANDOFF 3, dritter Eintrag: „Eine
-- SECURITY-DEFINER-Funktion geht an der Frauen-Only-Grenze vorbei." Dort war es
-- das Cover einer WOZ-Show, das in eine öffentliche Zeile rutschte. Hier ist es
-- die ganze Warenliste. Die Verkäuferin hat dem nie zugestimmt — sie hat eine
-- Frauen-Only-Show geplant und Artikel vorbereitet.
--
-- DIE LÖSUNG IST ERBEN, NICHT FRAGEN.
-- `scheduled_lives` trägt selbst `women_only`. Der vorbereitete Artikel
-- übernimmt es vom Termin — kein neuer Parameter, keine zweite Angabe, keine
-- Gelegenheit, es zu vergessen. Wer eine WOZ-Show plant, dessen Vorbereitung
-- ist automatisch geschützt.
--
-- Die Signatur bleibt dadurch unverändert: `CREATE OR REPLACE` genügt, kein
-- DROP, keine GRANT-Falle.
--
-- ⚠️ FEHLER 2 — `claim_prepared_auctions` prüfte die App der Session nicht
--
-- Es prüfte nur `host_id = auth.uid()`. Wer sowohl in Serlo als auch in Berkat
-- sendet, hätte seine vorbereiteten Berkat-Artikel in eine SERLO-Session ziehen
-- können. Kein Sicherheitsleck — aber die Artikel wären verschwunden: Serlo
-- kennt `live_auctions` nicht, und Berkats Abfragen finden sie über die
-- Session nicht mehr. Ein Abend Vorbereitung, weg.
--
-- ⚠️ FEHLER 3 — `sort_index` konnte doppelt vergeben werden
--
-- Er wurde aus `count(*)` gebildet. Wer drei Artikel anlegt (0, 1, 2), den
-- mittleren verwirft und einen neuen anlegt, bekommt wieder 2 — zwei Artikel
-- mit demselben Index, Reihenfolge unbestimmt. Jetzt `max(sort_index) + 1`.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prepare_live_auction(
  p_planned_for    uuid,
  p_title          text,
  p_start_cents    integer,
  p_increment_cents integer DEFAULT 100,
  p_image_url      text DEFAULT NULL,
  p_buy_now_cents  integer DEFAULT NULL,
  p_category       text DEFAULT NULL,
  p_condition      text DEFAULT NULL,
  p_size           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_host  uuid;
  v_woz   boolean;
  v_id    uuid;
  v_count integer;
  v_next  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Termin holen — samt Frauen-Only-Kennzeichnung (Fehler 1).
  SELECT host_id, coalesce(women_only, false)
    INTO v_host, v_woz
    FROM public.scheduled_lives
   WHERE id = p_planned_for AND app = 'berkat';
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'schedule_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL OR char_length(btrim(p_title)) < 2 THEN
    RAISE EXCEPTION 'title_too_short' USING ERRCODE = '22023';
  END IF;
  IF p_start_cents IS NULL OR p_start_cents < 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.berkat_categories WHERE slug = p_category AND active
  ) THEN
    RAISE EXCEPTION 'unknown_category' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), coalesce(max(sort_index), -1) + 1
    INTO v_count, v_next
    FROM public.live_auctions
   WHERE planned_for = p_planned_for AND session_id IS NULL;
  IF v_count >= 50 THEN
    RAISE EXCEPTION 'too_many_prepared' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_auctions (
    session_id, planned_for, seller_id, title, image_url,
    start_price_cents, min_increment_cents, buy_now_cents,
    status, category, condition, size, sort_index, women_only
  ) VALUES (
    NULL, p_planned_for, v_uid, btrim(p_title), NULLIF(btrim(coalesce(p_image_url, '')), ''),
    p_start_cents, greatest(coalesce(p_increment_cents, 100), 100), p_buy_now_cents,
    'scheduled', p_category,
    NULLIF(btrim(coalesce(p_condition, '')), ''),
    NULLIF(btrim(coalesce(p_size, '')), ''),
    v_next,
    -- Vom Termin geerbt, nicht vom Aufrufer behauptet.
    v_woz
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.claim_prepared_auctions(
  p_session_id uuid,
  p_planned_for uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_host  uuid;
  v_moved integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- `app = 'berkat'` (Fehler 2): Eine Serlo-Session darf keine Berkat-Artikel
  -- aufnehmen, auch nicht die des eigenen Hosts.
  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id AND app = 'berkat';
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_auctions
     SET session_id = p_session_id,
         updated_at = now()
   WHERE seller_id = v_uid
     AND session_id IS NULL
     AND status = 'scheduled'
     AND (p_planned_for IS NULL OR planned_for = p_planned_for);

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END $$;

-- Signaturen unverändert → die Rechte von `20260819110000` gelten weiter.
-- Zur Sicherheit trotzdem gesetzt: `CREATE OR REPLACE` behält Grants nicht über
-- alle Postgres-Versionen garantiert (dieselbe Vorsicht wie in `20260419250000`).
REVOKE ALL ON FUNCTION public.prepare_live_auction(
  uuid, text, integer, integer, text, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_live_auction(
  uuid, text, integer, integer, text, integer, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_prepared_auctions(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_prepared_auctions(uuid, uuid) TO authenticated;

-- ─── Gegenprobe ──────────────────────────────────────────────────────────────
-- 1. WOZ wird geerbt (der eigentliche Fix):
--      -- Termin mit women_only = true anlegen, dann:
--      SELECT prepare_live_auction('<WOZ-Termin>', 'Test', 500);
--      SELECT women_only FROM live_auctions WHERE planned_for = '<WOZ-Termin>';
--      -- muss `true` sein
--
-- 2. Und die Policy greift wirklich — als NICHT geprüftes Konto:
--      SELECT count(*) FROM live_auctions WHERE planned_for = '<WOZ-Termin>';
--      -- muss 0 sein
--
-- 3. Fremde App wird abgewiesen:
--      SELECT claim_prepared_auctions('<eine Serlo-Session desselben Hosts>');
--      -- muss 22023 „session_not_found" werfen
--
-- 4. sort_index bleibt eindeutig:
--      -- drei anlegen, den mittleren verwerfen, einen vierten anlegen
--      SELECT sort_index, count(*) FROM live_auctions
--       WHERE planned_for = '<Termin>' GROUP BY 1 HAVING count(*) > 1;
--      -- muss leer sein
