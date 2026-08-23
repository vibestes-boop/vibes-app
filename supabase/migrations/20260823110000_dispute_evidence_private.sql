-- Das Belegfoto eines Streitfalls lag im ÖFFENTLICHEN Eimer
-- ============================================================================
--
-- Zwei Funde aus dem Audit (Übergabe 73, „noch offen, ehrlich"), und sie
-- gehören zusammen — beide betreffen dasselbe Bild:
--
--   1. „URL-Prüfung am Streit-Belegfoto"
--      `report_order_dispute` prüfte `v_image NOT LIKE 'https://%'`. Das wehrt
--      `javascript:` und `http://` ab und lässt JEDE fremde Domain durch. Ein
--      Melder konnte `https://sein-server/pixel.png` anhängen — und der Abruf
--      durch einen Admin verriet ihm Zeitpunkt und IP der Prüfung. Der
--      Kommentar daneben beschrieb genau diesen Angriff; die Zeile darunter
--      verhinderte ihn nicht.
--
--   2. „Belegfotos im öffentlichen R2-Eimer"
--      `DisputeSheet.tsx` rief `pickAndUpload('cover', …)` → Präfix
--      `thumbnails/` → derselbe öffentliche Eimer wie Show-Cover und
--      Artikelfotos. Ein Belegfoto zeigt aber typischerweise das, was ein
--      Show-Cover nie zeigt: ein Adressetikett, eine beschädigte Sendung im
--      Wohnzimmer, manchmal Menschen. **Weltweit abrufbar, wer die Adresse
--      hat** — und die Adresse geht per Meldung an alle Admins.
--
-- ── DER WEG: privater Eimer statt strengerer URL-Prüfung ────────────────────
--
-- Fund 1 allein zu beheben wäre Symptomarbeit gewesen: Eine Adresse, die auf
-- unseren eigenen öffentlichen Eimer zeigt, ist zwar nicht mehr fremd — aber
-- immer noch für jeden abrufbar. Beide Funde haben dieselbe Wurzel, also
-- dieselbe Antwort.
--
-- Nachgebaut, nicht erfunden: `20260619120000_digital_products_bucket.sql`
-- hat das Muster für Serlos digitale Produkte schon aufgestellt — privater
-- Bucket, RLS auf `storage.objects`, Signed URL im Client. Hier dieselbe Form
-- mit dem Personenkreis eines Streitfalls.
--
-- ⚠️ REIHENFOLGE: DATENBANK VOR OTA — und diese Migration hält BEIDE Formen
-- aus. Ausgelieferte Fassungen (TestFlight 1.0.0 (1) plus OTAs) schicken
-- weiterhin eine öffentliche R2-Adresse. Würde sie hier abgelehnt, könnte
-- niemand mehr ein Problem mit Foto melden, bis der OTA durch ist — und ein
-- OTA wirkt erst beim übernächsten Start (Übergabe 3). Die Altform bleibt
-- deshalb erlaubt, aber **verschärft**: nur noch im Ordner des Melders.
--
-- Was das NICHT heilt: Fotos, die vor dem 23.08.2026 gemeldet wurden, liegen
-- weiter im öffentlichen Eimer. Sie umzuziehen hiesse, Objekte zu kopieren und
-- Zeilen umzuschreiben; bei zwei Testfällen ist das die Arbeit nicht wert.
-- **Vor echten Nutzern gehört das erledigt** — oder die zwei Zeilen gelöscht.

-- ── 1. Der Eimer ────────────────────────────────────────────────────────────
--
-- 10 MB: Ein Belegfoto ist ein Foto, kein Video. Der Client verkleinert
-- ohnehin auf 2000 px längste Kante, sobald `expo-image-manipulator` im Build
-- ist (Warteschlange, Übergabe 12).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('dispute-evidence', 'dispute-evidence', false, 10485760)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 10485760;

-- ── 2. Zugriff auf die Objekte ──────────────────────────────────────────────
--
-- Pfad: `<melder-id>/<bestell-id>/<datei>`. Der erste Teil ist die Identität,
-- genau wie im Muster von `digital-products`.

-- Hochladen nur in den eigenen Ordner.
DROP POLICY IF EXISTS "dispute_evidence_insert_own" ON storage.objects;
CREATE POLICY "dispute_evidence_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Ersetzen ebenfalls nur im eigenen Ordner — wer sein Foto nachbessert, soll
-- das dürfen, solange der Fall offen ist.
DROP POLICY IF EXISTS "dispute_evidence_update_own" ON storage.objects;
CREATE POLICY "dispute_evidence_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ⚠️ KEIN DELETE. Ein Beleg, den der Melder nach der Meldung löschen kann, ist
-- kein Beleg — er könnte den Vorwurf erheben, den Beweis zeigen und ihn danach
-- verschwinden lassen. Aufräumen ist Sache des Betreibers, nicht der Partei.

-- Lesen: die drei, die den Fall etwas angehen.
--
--   • der Melder selbst (eigener Ordner)
--   • die Gegenseite — sie muss sehen, was ihr vorgeworfen wird, sonst kann
--     sie sich nicht äussern
--   • der Betreiber, der den Fall schliesst (`is_admin()`, dieselbe Rolle wie
--     in `resolve_order_dispute`)
--
-- ⚠️ Die Verknüpfung läuft über `order_disputes.image_url = <pfad>`. Damit ist
-- das Recht an den VORGANG gebunden, nicht an den Ordner: Ein Objekt, das zu
-- keinem Fall gehört, ist für die Gegenseite unsichtbar — auch wenn sie den
-- Pfad errät.
DROP POLICY IF EXISTS "dispute_evidence_read" ON storage.objects;
CREATE POLICY "dispute_evidence_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.order_disputes d
         WHERE d.image_url = storage.objects.name
           AND (d.against_id = auth.uid() OR d.reporter_id = auth.uid())
      )
    )
  );

-- ── 3. Der Riegel, den `report_order_dispute` benutzt ───────────────────────
--
-- Eigene Funktion statt einer Bedingung im Rumpf, weil dieselbe Frage gleich
-- an zwei Stellen gestellt wird (Melden und später das Nachreichen) — und
-- weil eine benannte Prüfung lesbar macht, WAS geprüft wird.
--
-- ⚠️ Die öffentliche R2-Adresse steht hier fest verdrahtet. Sie ist kein
-- Geheimnis (sie liegt offen in `eas.json`, und das Repo ist öffentlich), aber
-- sie ist auch nicht ewig: Wer den R2-Eimer je wechselt, ändert sie HIER mit.
-- Der Zweig ist ohnehin eine Übergangsform und fällt weg, sobald keine
-- Fassung mehr im Umlauf ist, die öffentliche Adressen schickt.
--
-- `_` und `%` sind LIKE-Platzhalter. Eine UUID besteht aus Hex und
-- Bindestrichen und enthält keines von beiden — deshalb ist die
-- Zusammensetzung hier gefahrlos. Wer den Vergleich je auf ein Feld ausweitet,
-- das der Nutzer tippt, braucht `ESCAPE` (die Lehre aus `20260821120000`).

CREATE OR REPLACE FUNCTION public.is_own_dispute_evidence(p_ref text, p_owner uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT p_ref IS NOT NULL
     AND p_owner IS NOT NULL
     AND (
       -- NEU: Pfad im privaten Eimer, erster Teil ist der Melder
       p_ref LIKE p_owner::text || '/%'
       -- ALT: öffentliche R2-Adresse im Ordner des Melders
       OR p_ref LIKE 'https://pub-35c122d523ba4396b15392ace804c19b.r2.dev/thumbnails/'
                     || p_owner::text || '/%'
       OR p_ref LIKE 'https://pub-35c122d523ba4396b15392ace804c19b.r2.dev/products/images/'
                     || p_owner::text || '/%'
     )
$fn$;

REVOKE ALL ON FUNCTION public.is_own_dispute_evidence(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_own_dispute_evidence(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_own_dispute_evidence(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_dispute_evidence(text, uuid) TO service_role;

-- ── 4. `report_order_dispute` mit dem neuen Riegel ──────────────────────────
--
-- Der Rumpf ist MASCHINELL aus einem frischen Abzug übernommen und an genau
-- einer Stelle ergänzt (`/tmp/gen_dispute.mjs`, bricht ab, wenn der Anker
-- nicht genau einmal trifft, und zählt danach die CREATE-Zeilen). Abtippen
-- hat bei dieser Funktionsklasse schon einmal Teile verschluckt — siehe die
-- Warnung an `buy_now_live_auction` in den Übergaben 20, 22 und 24.
--
-- Gleiche Signatur, also `CREATE OR REPLACE` statt DROP+CREATE: kein
-- Rechte-Verlust, keine zweite Überladung, kein HTTP 300.

CREATE OR REPLACE FUNCTION "public"."report_order_dispute"("p_order_id" "uuid", "p_reason" "text", "p_detail" "text" DEFAULT NULL::"text", "p_image_url" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
  -- ⚠️ Die Adresse muss aus UNSEREM Haus kommen UND dem Melder gehören.
  --
  -- Bis zum 23.08.2026 stand hier nur `NOT LIKE 'https://%'`. Das wehrte
  -- `javascript:` und `http://` ab und liess jede fremde Domain durch —
  -- also genau den Fall, vor dem der Kommentar warnte: Ein Melder hängt
  -- `https://sein-server/pixel.png` an, und der Abruf verrät ihm, wann und
  -- von wo aus ein Admin den Vorgang öffnet.
  --
  -- Zwei Formen sind erlaubt, und beide binden das Bild an den Melder:
  --   • NEU  — Pfad im privaten Eimer `dispute-evidence`: `<melder>/…`
  --   • ALT  — öffentliche R2-Adresse im Ordner des Melders. Bleibt drin,
  --            solange ausgelieferte App-Fassungen sie schicken (die
  --            Reihenfolge ist Datenbank vor OTA, siehe Übergabe 72).
  --
  -- Der gemeinsame Nenner ist NICHT „sieht aus wie eine URL", sondern
  -- „liegt im Ordner dessen, der meldet" — dieselbe Invariante, die
  -- `isOwnedUploadKey` in `r2-sign` beim Hochladen durchsetzt.
  IF v_image IS NOT NULL AND NOT public.is_own_dispute_evidence(v_image, v_caller) THEN
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


-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Genau eine Signatur, kein HTTP 300. Erwartet: 1.
--
--      SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public' AND p.proname = 'report_order_dispute';
--
-- 2) Der Riegel steht wirklich im Live-Code (nicht nur in dieser Datei):
--
--      SELECT prosrc LIKE '%is_own_dispute_evidence%' FROM pg_proc
--       WHERE proname = 'report_order_dispute';   -- erwartet: t
--
-- 3) Der Eimer ist privat. Erwartet: f.
--
--      SELECT public FROM storage.buckets WHERE id = 'dispute-evidence';
--
-- 4) Die Prüfung trennt richtig — alle vier Zeilen ohne Datenbankzugriff:
--
--      SELECT public.is_own_dispute_evidence(
--               '11111111-1111-1111-1111-111111111111/abc/foto.jpg',
--               '11111111-1111-1111-1111-111111111111')          AS eigen_pfad,      -- t
--             public.is_own_dispute_evidence(
--               '22222222-2222-2222-2222-222222222222/abc/foto.jpg',
--               '11111111-1111-1111-1111-111111111111')          AS fremder_pfad,    -- f
--             public.is_own_dispute_evidence(
--               'https://evil.example/pixel.png',
--               '11111111-1111-1111-1111-111111111111')          AS fremde_domain,   -- f
--             public.is_own_dispute_evidence(
--               'https://pub-35c122d523ba4396b15392ace804c19b.r2.dev/thumbnails/'
--               || '11111111-1111-1111-1111-111111111111/x.jpg',
--               '11111111-1111-1111-1111-111111111111')          AS altform_eigen;   -- t
--
--    Die dritte Zeile ist die, um die es ging: Sie war bis heute `t`.
--
-- 5) VON AUSSEN, angemeldet — ein Objekt im Ordner eines anderen darf nicht
--    lesbar sein. Erwartet: kein Signed-URL, sondern ein Fehler.
--
--      supabase.storage.from('dispute-evidence')
--        .createSignedUrl('<fremde-user-id>/<pfad>', 60)
--
-- 6) ⚠️ Und die Probe, die nur am Gerät geht (Prüfliste D8): Ein Problem MIT
--    Foto melden. Das Foto muss beim Verkäufer in der Fall-Karte erscheinen —
--    wenn nicht, ist der Lesepfad kaputt und der Beleg wertlos.
