-- ─────────────────────────────────────────────────────────────────────────────
-- Ein Beleg gehört an den Fall, nicht nur in die Unterhaltung
--
-- Am 21.08.2026 am Gerät gefordert. Das Melde-Blatt verwies bisher auf den Chat
-- („Ein Foto hilft am meisten — schick es dem Verkäufer direkt"). Das war
-- gemeint als „ein Ort für Belege statt zwei" und ist trotzdem falsch herum:
--
--   * Der Moment, in dem jemand das Foto ZUR HAND hat, ist der Moment, in dem
--     er das Problem meldet. Ihn danach in einen anderen Bildschirm zu
--     schicken, verliert die Hälfte der Belege.
--   * Ein Foto im Chat gehört zur Unterhaltung. Ein Foto am Fall gehört zum
--     VORGANG — und der überlebt die Unterhaltung, wird von Admins gelesen und
--     steht in `resolve_order_dispute` zur Verfügung.
--
-- Der Chat bleibt trotzdem der Ort für alles Weitere; das Blatt sagt es auch
-- weiterhin. Neu ist nur, dass der erste Beleg gleich mitkommt.
--
-- ⚠️ WARUM DROP + CREATE UND NICHT EIN VIERTER PARAMETER MIT DEFAULT
-- Eine Funktion mit vier Parametern ist für Postgres eine ANDERE Funktion als
-- die mit dreien — beide existierten danach nebeneinander, und PostgREST
-- könnte einen Aufruf nicht mehr eindeutig zuordnen (HTTP 300, in diesem
-- Projekt schon einmal an `publish_due_scheduled_posts` gemessen).
--
-- Also ersetzen. Dasselbe Verfahren wie bei `create_standing_listing`, das seit
-- April viermal so gewachsen ist.
--
-- ⚠️ UND WARUM DAS SERLO NICHT BRICHT
-- `apps/web/lib/data/shop.ts` und Serlos `lib/useShop.ts` rufen die RPC mit
-- drei BENANNTEN Parametern. PostgREST ordnet nach Namen zu und lässt aus, was
-- einen Default hat — `p_image_url text DEFAULT NULL` wird von einem alten
-- Aufruf also einfach nicht gesetzt. Kein Redeploy nötig, kein PGRST202.
-- Vor dem Schreiben geprüft, nicht angenommen.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.order_disputes
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.order_disputes.image_url IS
  'Belegfoto des Melders, hochgeladen über r2-sign (Präfix thumbnails/). '
  'NULL = keines mitgeschickt.';

-- ⚠️ Kein eigenes GRANT nötig: `order_disputes` hat keine eingefrorene
-- Spaltenliste (CLAUDE.md Regel 11 betrifft `live_sessions`,
-- `user_whip_ingresses` und `profiles`). Am Rechte-Abzug geprüft: Die Tabelle
-- trägt ein einfaches `GRANT SELECT … TO authenticated`, das jede Spalte
-- einschließt — auch neue.

DROP FUNCTION IF EXISTS public.report_order_dispute(uuid, text, text);

CREATE OR REPLACE FUNCTION public.report_order_dispute(
  p_order_id uuid,
  p_reason text,
  p_detail text default null,
  p_image_url text default null
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_order   public.product_orders%ROWTYPE;
  v_role    text;
  v_against uuid;
  v_detail  text := nullif(btrim(p_detail), '');
  v_image   text := nullif(btrim(p_image_url), '');
  v_app     text;
  r_admin   record;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF p_reason NOT IN ('not_received','damaged','not_as_described','not_paid','fraud','other') THEN
    RETURN jsonb_build_object('error','bad_reason');
  END IF;
  IF v_detail IS NOT NULL AND length(v_detail) > 2000 THEN v_detail := left(v_detail, 2000); END IF;

  -- ⚠️ Nur eigene Adressen. Ohne diese Prüfung könnte jemand eine beliebige
  -- fremde URL an einen Vorgang hängen, den Admins später öffnen — und der
  -- Aufruf dieser Adresse verriete dem Betreiber der Gegenseite, wann und von
  -- wo aus ein Admin hinsieht. Der Upload läuft ohnehin über `r2-sign`; hier
  -- steht nur der Riegel dazu.
  IF v_image IS NOT NULL AND v_image NOT LIKE 'https://%' THEN
    RETURN jsonb_build_object('error','bad_image');
  END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_caller = v_order.buyer_id THEN v_role := 'buyer'; v_against := v_order.seller_id;
  ELSIF v_caller = v_order.seller_id THEN v_role := 'seller'; v_against := v_order.buyer_id;
  ELSE RETURN jsonb_build_object('error','not_participant');
  END IF;

  IF v_order.status NOT IN ('paid','shipped','delivered') THEN
    RETURN jsonb_build_object('error','bad_status');
  END IF;

  -- Siehe `20260821170000`: ohne den Stempel landet die Meldung per DEFAULT in
  -- Serlos Posteingang.
  v_app := CASE WHEN v_order.cart_id IS NOT NULL THEN 'berkat' ELSE 'serlo' END;

  INSERT INTO public.order_disputes
    (order_id, reporter_id, against_id, reporter_role, reason, detail, image_url)
  VALUES (p_order_id, v_caller, v_against, v_role, p_reason, v_detail, v_image)
  ON CONFLICT (order_id, reporter_id) DO UPDATE
    SET reason = excluded.reason,
        detail = excluded.detail,
        -- ⚠️ COALESCE, nicht Vollersatz: Wer seine Meldung nachschärft und
        -- diesmal kein Foto anhängt, soll das erste nicht verlieren. Dieselbe
        -- Regel wie beim Anbietertyp (`20260817130000`) und beim Kopfbild
        -- (Übergabe 60, Fund 2): Ein Formular, das ein Feld nicht kennt, darf
        -- es nicht löschen.
        image_url = COALESCE(excluded.image_url, order_disputes.image_url),
        status = 'open',
        resolved_at = NULL;

  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, app)
    VALUES (v_against, v_caller, 'order_dispute',
            'Ein Problem mit einer Bestellung wurde gemeldet ⚠️', v_app);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  FOR r_admin IN SELECT id FROM public.profiles WHERE is_admin = true LOOP
    IF r_admin.id <> v_caller AND r_admin.id <> v_against THEN
      BEGIN
        INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, app)
        VALUES (r_admin.id, v_caller, 'order_dispute',
                'Neue Streit-Meldung zu einer Bestellung ⚠️', v_app);
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.report_order_dispute(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_order_dispute(uuid, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.report_order_dispute(uuid, text, text, text) IS
  'Meldet ein Problem zu einer Bestellung, mit optionalem Belegfoto. Stempelt '
  'notifications.app aus product_orders.cart_id. Alte Aufrufe mit drei benannten '
  'Parametern funktionieren unverändert — p_image_url hat einen Default.';

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. ⚠️ GENAU EINE Signatur — sonst HTTP 300 für Serlo UND Berkat:
--      SELECT pg_get_function_identity_arguments(p.oid)
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname='public' AND p.proname='report_order_dispute';
--      -- erwartet: GENAU EINE Zeile, mit vier Argumenten.
--
-- 2. Kein `anon`:
--      SELECT has_function_privilege('anon', 'public.report_order_dispute(uuid,text,text,text)',
--                                    'EXECUTE');
--      -- erwartet: false
--
-- 3. Die Spalte ist da und lesbar:
--      SELECT image_url FROM order_disputes LIMIT 1;
--
-- 4. Das COALESCE hält:
--      -- Fall mit Foto melden, dann ohne Foto nachschärfen:
--      SELECT image_url FROM order_disputes WHERE order_id = '<bestellung>';
--      -- erwartet: das ERSTE Foto steht noch da.
-- ─────────────────────────────────────────────────────────────────────────────
