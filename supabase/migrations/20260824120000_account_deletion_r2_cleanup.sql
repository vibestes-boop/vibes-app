-- ═══════════════════════════════════════════════════════════════════════════
-- Kontolöschung räumt auch den Objektspeicher — aber NICHT mit dem Besen
-- 24.08.2026 · Serlo UND Berkat · erweitert `delete_own_account()`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ DIES DREHT ABSCHNITT 59 NICHT UM. Es zieht ihn auf die Speicherebene nach.
--
-- `delete_own_account()` anonymisiert seit dem 21.08.2026, statt zu vernichten:
-- Die Person verschwindet, der Beleg bleibt (§ 147 AO, § 257 HGB; DSGVO Art. 17
-- Abs. 3 lit. b nimmt die Löschpflicht genau dafür zurück). Diese Migration
-- ändert an dieser Entscheidung nichts — sie schließt die Lücke, die dabei offen
-- blieb: Die Funktion setzt `avatar_url`, `banner_url` und `voice_sample_url` auf
-- NULL, aber **die Dateien selbst blieben liegen**. Niemand kann sie danach noch
-- finden, denn die einzige Adresse stand in der Spalte, die eben geleert wurde.
-- Ein Bild, das keiner mehr erreicht und das trotzdem für immer gespeichert
-- bleibt, ist genau der Fall, den Art. 17 meint.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ WARUM KEIN PRÄFIX-RUNDUMSCHLAG ÜBER `{pfad}/{user_id}/`
--
-- Der naheliegende Weg wäre, beim Löschen einfach alles unter
-- `thumbnails/<uid>/` und `products/images/<uid>/` wegzufegen. **Das wäre
-- derselbe Fehler wie der aus Abschnitt 59, nur eine Ebene tiefer.** Nachgesehen,
-- was dort wirklich liegt:
--
--   `thumbnails/<uid>/`      Avatar UND Kopfbild UND Show-Cover UND Termin-Bild
--                            UND Story-Medien UND — `app/messages/[id].tsx:286` —
--                            **Fotos, die dieser Mensch in einen Chat GESENDET
--                            hat.** Die liegen unter SEINER Kennung, hängen aber
--                            im Verlauf des Gegenübers. Ein Rundumschlag reißt
--                            Bilder aus fremden Unterhaltungen.
--
--   `products/images/<uid>/` Die Artikelfotos. Die zugehörigen `product_orders`
--                            bleiben ausdrücklich stehen — ein Käufer öffnet
--                            seine Bestellung und fände ein totes Bild. Der
--                            Beleg wäre nicht gelöscht, aber entwertet.
--
-- Deshalb wird hier NICHT gefegt, sondern **genau das eingereiht, was diese
-- Löschung selbst unerreichbar macht**: die drei Profil-Adressen. Das ist die
-- wörtliche Entsprechung zu „anonymisieren statt vernichten" — das Gesicht des
-- Menschen geht, die Bilder der Ware bleiben.
--
-- Die EINE Ausnahme ist `highlights/<uid>/`. Dieser Pfad gehört per Bauart
-- ausschließlich diesem einen Nutzer: `highlight-copy-media` schreibt dorthin
-- unter zufälligem Namen, und keine fremde Zeile kann darauf zeigen. Dort ist der
-- Besen richtig — und er ist dort auch das EINZIGE Werkzeug, das greift, weil
-- `useCreateHighlight` erst kopiert und dann schreibt: Schlägt das Schreiben
-- fehl, liegt die Kopie da, ohne dass irgendeine Zeile ihre Adresse kennt.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ WARUM ÜBER DIE WARTESCHLANGE UND NICHT DIREKT
--
-- Die Funktion redet nicht mit R2. Sie reiht in `r2_delete_queue` ein, und der
-- bestehende 5-Minuten-Cron (`20260517153000`) lässt `r2-delete` die Arbeit tun.
-- Drei Gründe, und der erste wiegt am schwersten:
--
--   1. **Eine Löschung darf nie daran scheitern, dass ein Eimer nicht antwortet.**
--      Apple 5.1.1(v) verlangt einen Weg, der GEHT. Netzverkehr im selben
--      Transaktionsblock hieße: R2 langsam → Löschung schlägt fehl.
--   2. Den NACHWEIS gibt es dort schon: `status`, `attempts`, `last_error`. Ein
--      zweiter Mechanismus daneben wäre ein zweiter Ort zum Nachsehen.
--      ⚠️ ABER: eine WIEDERHOLUNG gibt es NICHT. Der Cron holt nur
--      `status = 'pending'`; eine gescheiterte Zeile steht auf `'error'` und
--      wird nie wieder angefasst (`attempts` kommt deshalb über 1 nicht hinaus).
--      Das ist Verhalten von 2026-05-17 und gilt für den Post-Aufräumer genauso —
--      hier nur festgehalten, nicht mitgeändert. Wer es ändert, ändert es für
--      beide. Bis dahin ist Nachsehen Handarbeit:
--        SELECT * FROM r2_delete_queue WHERE status = 'error';
--   3. Die Warteschlange ist eine belastbare Vertrauensgrenze: RLS an, KEINE
--      Policy, KEIN Grant. Kein Client kann eine Zeile hineinschreiben — deshalb
--      darf der Cron sie ohne eigene Anmeldung abarbeiten.
--
-- ⚠️ SIGNATUR BLEIBT. `apps/web/app/actions/gdpr.ts:221` ruft
-- `supabase.rpc('delete_own_account')` ohne Argumente. Rename oder neuer
-- Parameter bräche die ausgelieferte Web-App (HTTP 300, Abschnitt 13).

-- ─── 1. Die Warteschlange lernt zwei Dinge dazu ─────────────────────────────
--
-- `prefix` für den Fall „ganzer Ordner", `reason` damit beim Nachsehen in der
-- Tabelle erkennbar ist, WOHER eine Zeile kommt (Post-Trigger oder Löschung).

ALTER TABLE public.r2_delete_queue
  ADD COLUMN IF NOT EXISTS prefix text,
  ADD COLUMN IF NOT EXISTS reason text;

COMMENT ON COLUMN public.r2_delete_queue.prefix IS
  'Ganzer Ordner statt Einzeladresse. NUR `highlights/<uuid>/` — der einzige '
  'Pfad, der genau einem Nutzer gehört. Für geteilte Pfade (thumbnails, '
  'products/images) ist das VERBOTEN: dort liegen Chat-Fotos und Artikelbilder, '
  'die im Verlauf bzw. in der Bestellung eines anderen Menschen hängen.';

-- ⚠️ Die Form wird schon HIER erzwungen, nicht erst in der Edge Function.
-- Zwei Schlösser an derselben Tür, weil ein falscher Präfix nicht auffällt,
-- sondern still fremde Dateien mitnimmt. Ein blosses `highlights/` (ohne
-- Kennung) fällt durch — das wäre der Ordner ALLER Nutzer.
ALTER TABLE public.r2_delete_queue
  DROP CONSTRAINT IF EXISTS r2_delete_queue_prefix_shape;
ALTER TABLE public.r2_delete_queue
  ADD CONSTRAINT r2_delete_queue_prefix_shape CHECK (
    prefix IS NULL
    OR prefix ~ '^highlights/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/$'
  );

-- Entweder Einzeladressen ODER ein Ordner — nie beides in einer Zeile. Sonst
-- wäre unklar, was ein `status = 'deleted'` eigentlich bestätigt.
ALTER TABLE public.r2_delete_queue
  DROP CONSTRAINT IF EXISTS r2_delete_queue_one_kind;
ALTER TABLE public.r2_delete_queue
  ADD CONSTRAINT r2_delete_queue_one_kind CHECK (
    prefix IS NULL OR (media_url IS NULL AND thumbnail_url IS NULL)
  );

-- ─── 2. Die Funktion — unverändert, plus einen Block ────────────────────────
--
-- ⚠️ Der Rumpf ist eine WÖRTLICHE Übernahme von `20260821140000`. Alles zwischen
-- den Blocker-Prüfungen und dem Sperren des Logins steht unverändert da; neu ist
-- ausschließlich der mit „MEDIEN" überschriebene Teil. Wer hier etwas ändert,
-- ändert eine Löschung mit Rechtsfolgen — nichts stillschweigend mitnehmen.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_open     int;
  v_unship   int;
  v_tag      text;
  v_avatar   text;
  v_banner   text;
  v_voice    text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Schon gelöscht? Dann ist nichts zu tun. Idempotent, damit ein zweiter
  -- Aufruf (Doppeltipp, Netz-Wiederholung) nicht in einen Fehler läuft.
  IF EXISTS (SELECT 1 FROM public.profiles
              WHERE id = v_uid AND deleted_at IS NOT NULL) THEN
    RETURN;
  END IF;

  -- ── Blocker: offene Verpflichtungen ──────────────────────────────────────
  -- Beide sind ausdrücklich VORÜBERGEHEND und lösen sich von selbst — der Korb
  -- läuft nach 24 Stunden ab, die Bestellung ist nach dem Versand erledigt.
  -- Apple 5.1.1(v) erlaubt das: Was nicht erlaubt wäre, ist eine Löschung, die
  -- gar nicht geht oder nur per E-Mail an den Support.
  SELECT count(*) INTO v_open
    FROM public.auction_carts
   WHERE buyer_id = v_uid
     AND status IN ('open', 'checkout_pending');

  IF v_open > 0 THEN
    RAISE EXCEPTION 'account_delete_open_cart'
      USING ERRCODE = 'P0001',
            HINT = 'Bezahle deinen Sammelkorb oder warte, bis er abläuft.';
  END IF;

  SELECT count(*) INTO v_unship
    FROM public.product_orders
   WHERE seller_id = v_uid
     AND status IN ('paid', 'payment_requested');

  IF v_unship > 0 THEN
    RAISE EXCEPTION 'account_delete_unshipped'
      USING ERRCODE = 'P0001',
            HINT = 'Versende erst, was schon bezahlt wurde.';
  END IF;

  -- ── Was WIRKLICH gelöscht wird ───────────────────────────────────────────
  -- Persönliches ohne Aufbewahrungspflicht. Alles hier ist eine Äußerung oder
  -- eine Vorliebe dieses Menschen, kein Beleg über ein Geschäft.
  DELETE FROM public.berkat_saved_searches    WHERE user_id = v_uid;
  DELETE FROM public.berkat_saved_listings    WHERE user_id = v_uid;
  DELETE FROM public.berkat_auction_reminders WHERE user_id = v_uid;
  -- Bürgschaften, die ER ausgesprochen hat: Sie tragen seinen Namen und wären
  -- ohne ihn sinnlos. Bürgschaften, die er BEKOMMEN hat, sind Aussagen anderer
  -- Menschen über ihn — die gehören denen, nicht ihm. Der Fremdschlüssel
  -- räumt sie ohnehin nicht ab, weil die Zeile bleibt.
  DELETE FROM public.berkat_vouches           WHERE voucher_id = v_uid;
  DELETE FROM public.follows                  WHERE follower_id = v_uid OR following_id = v_uid;
  DELETE FROM public.push_tokens              WHERE user_id = v_uid;
  DELETE FROM public.notifications            WHERE recipient_id = v_uid;
  -- Offene Stellvertreter-Gebote: Sie würden sonst nach dem Löschen
  -- weiterbieten. Zugeschlagene Gebote (`live_bids`) bleiben — die sind Beleg.
  DELETE FROM public.live_auto_bids           WHERE bidder_id = v_uid;

  -- Der Text einer Bewertung kann Persönliches enthalten; die Sternzahl ist
  -- eine Aussage ÜBER den Verkäufer und fließt in seinen Schnitt. Deshalb nur
  -- den Text nehmen, die Wertung lassen.
  UPDATE public.order_reviews SET comment = NULL WHERE reviewer_id = v_uid;

  -- ══ MEDIEN — NEU AM 24.08.2026 ═══════════════════════════════════════════
  --
  -- ⚠️ REIHENFOLGE IST DER GANZE PUNKT: erst die Adressen holen, dann leeren.
  -- Andersherum stünde gleich das UPDATE unten, und danach wüsste niemand mehr,
  -- welche Datei zu diesem Menschen gehörte. Genau deshalb blieben die Bilder
  -- bis heute liegen.
  SELECT avatar_url, banner_url, voice_sample_url
    INTO v_avatar, v_banner, v_voice
    FROM public.profiles
   WHERE id = v_uid;

  -- Die drei Einzeladressen. `r2-delete` prüft beim Abarbeiten selbst, ob der
  -- Pfad erlaubt ist — eine fremde oder unbekannte Adresse (etwa ein extern
  -- gehostetes Bild) landet dort sichtbar als `status = 'error'` mit Begründung,
  -- statt still zu verschwinden.
  INSERT INTO public.r2_delete_queue (author_id, media_url, reason)
  SELECT v_uid, u, 'account_deleted'
    FROM unnest(ARRAY[v_avatar, v_banner, v_voice]) AS u
   WHERE u IS NOT NULL AND btrim(u) <> '';

  -- ── Highlights: Zeile UND Datei, und zwar zusammen ───────────────────────
  --
  -- ⚠️ Die Zeilen überleben die Löschung sonst. `story_highlights.user_id` hängt
  -- an `auth.users` mit ON DELETE CASCADE — aber diese Zeile wird ja gerade
  -- NICHT gelöscht, sondern gesperrt. Ohne das DELETE hier stünde auf dem Profil
  -- von `geloescht-xxxxxxxx` weiter die volle Reihe seiner Bilder, während Bio,
  -- Avatar und Kopfbild leer sind. Ein Highlight ist dieselbe Art Aussage über
  -- sich selbst wie eine Bio.
  --
  -- ⚠️ Und beides MUSS zusammen geschehen. Nur fegen hiesse: Zeile zeigt auf
  -- gelöschte Datei → leeres Cover, kein Inhalt. Das ist genau der Fehler, für
  -- den `highlight-copy-media` überhaupt gebaut wurde.
  --
  -- An `story_highlights` hängt nichts (geprüft: keine Fremdschlüssel darauf) —
  -- dieses DELETE kann niemand Dritten treffen.
  DELETE FROM public.story_highlights WHERE user_id = v_uid;

  -- Der Ordner. Er nimmt auch die Kopien mit, die KEINE Zeile mehr kennt:
  -- `useCreateHighlight` kopiert erst und schreibt dann — scheitert das
  -- Schreiben, liegt die Datei verwaist da. Nur ein Ordner-Blick findet die.
  --
  -- ⚠️ Für SERLO-Highlights greift das nicht, und das ist richtig so: Die zeigen
  -- auf die Medien der Story selbst (`story_id` gesetzt), nicht auf eine Kopie
  -- unter `highlights/`. Das DELETE oben nimmt die Zeile, die Datei gehört
  -- weiterhin dem Lebenslauf der Story.
  INSERT INTO public.r2_delete_queue (author_id, prefix, reason)
  VALUES (v_uid, 'highlights/' || v_uid::text || '/', 'account_deleted');

  -- ⚠️ WAS HIER BEWUSST NICHT STEHT — und warum, damit es niemand „nachträgt":
  --
  --   `products/images/<uid>/`  Artikelfotos. Die Bestellungen dazu bleiben
  --                             absichtlich stehen (Abschnitt 59). Ein Beleg mit
  --                             totem Bild ist ein entwerteter Beleg.
  --   `thumbnails/<uid>/`       Geteilter Pfad. Dort liegen auch die Fotos, die
  --                             dieser Mensch in fremde Chats gesendet hat, und
  --                             die Cover von Shows, die andere gewonnen haben.
  --   `stories`                 Die Zeilen werden hier NICHT gelöscht. An
  --                             `stories` hängen `story_comments` und
  --                             `story_polls` mit ON DELETE CASCADE — das sind
  --                             Äußerungen und Stimmen ANDERER Menschen. Und die
  --                             Story-Medien werden ohnehin von NIEMANDEM
  --                             aufgeräumt: einen `AFTER DELETE`-Trigger gibt es
  --                             nur auf `posts`, nicht auf `stories`. Das ist ein
  --                             eigener, größerer Fund (er betrifft JEDE
  --                             abgelaufene Story, nicht nur gelöschte Konten)
  --                             und gehört in eine eigene Migration, nicht in
  --                             die Löschfunktion.

  -- ── Was anonymisiert wird ────────────────────────────────────────────────
  -- Kurz und stabil: acht Hex-Zeichen aus der eigenen ID. Kein Zufall, damit
  -- ein zweiter Lauf denselben Namen erzeugt und der eindeutige Index nicht
  -- kollidiert.
  v_tag := 'geloescht-' || substr(replace(v_uid::text, '-', ''), 1, 8);

  UPDATE public.profiles
     SET username         = v_tag,
         display_name     = NULL,
         bio              = NULL,
         avatar_url       = NULL,
         banner_url       = NULL,
         push_token       = NULL,
         expo_push_token  = NULL,
         voice_sample_url = NULL,
         country_code     = NULL,
         country_name     = NULL,
         region_name      = NULL,
         deleted_at       = now()
   WHERE id = v_uid;

  -- Anbieterangaben eines gewerblichen Verkäufers: Anschrift und USt-ID sind
  -- personenbezogen und stehen öffentlich (§ 5 DDG). Ohne aktives Angebot gibt
  -- es keinen Grund mehr, sie zu zeigen.
  UPDATE public.berkat_sellers
     SET legal_name = NULL, street = NULL, postal_code = NULL,
         city = NULL, country = NULL, contact_email = NULL, vat_id = NULL,
         checkout_enabled = false
   WHERE user_id = v_uid;

  -- Laufende Angebote zurückziehen — ein Regal ohne Verkäufer ist eine Falle
  -- für Käufer. Verkauftes bleibt unangetastet.
  UPDATE public.live_auctions
     SET status = 'cancelled'
   WHERE seller_id = v_uid
     AND session_id IS NULL
     AND status IN ('listed', 'scheduled');

  -- ── Der Login wird zugemacht ─────────────────────────────────────────────
  -- ⚠️ KEIN `DELETE FROM auth.users`. Genau das war der Fehler: Die Zeile hängt
  -- mit ON DELETE CASCADE an `profiles`, und daran hängen die Belege.
  --
  -- Stattdessen dreifach dicht: `banned_until` sperrt die Anmeldung,
  -- `encrypted_password` macht das Passwort unbrauchbar, und die E-Mail wird
  -- durch eine Adresse in einer reservierten Domain ersetzt (RFC 2606), damit
  -- weder Zurücksetzen noch Neuanmeldung mit derselben Adresse möglich ist —
  -- und die Adresse selbst nicht mehr gespeichert bleibt.
  UPDATE auth.users
     SET email              = v_tag || '@geloescht.invalid',
         phone              = NULL,
         encrypted_password = NULL,
         raw_user_meta_data = '{}'::jsonb,
         banned_until       = 'infinity'::timestamptz,
         deleted_at         = now()
   WHERE id = v_uid;

  -- Alle offenen Sitzungen beenden, sonst bliebe das Gerät bis zum Ablauf des
  -- Tokens angemeldet.
  DELETE FROM auth.sessions   WHERE user_id = v_uid;
  DELETE FROM auth.refresh_tokens WHERE user_id = v_uid;
END;
$fn$;

-- ⚠️ Die Rechte NEU setzen. `CREATE OR REPLACE` behält sie nicht über alle
-- Postgres-Fassungen, und die alte Fassung war einmal an `anon` freigegeben —
-- das ist die `credit_coins`-Falle (Abschnitt 7).
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- GEGENPROBEN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Die sechs aus `20260821140000` gelten unverändert weiter. Neu dazu:
--
-- 7. Nach dem Löschen eines Testkontos stehen die Medien-Zeilen in der
--    Warteschlange — drei Adressen (soweit gesetzt) und EIN Ordner:
--      SELECT reason, media_url, prefix, status, last_error
--        FROM r2_delete_queue
--       WHERE author_id = '<id>' AND reason = 'account_deleted';
--
-- 8. Nach dem nächsten Cron-Lauf (höchstens 5 Minuten) stehen sie auf
--    `deleted`. Bleibt eine auf `error`, sagt `last_error`, warum — ein
--    unbekannter Pfad ist dort sichtbar und nicht still verloren.
--
-- 9. ⚠️ DIE EIGENTLICHE PROBE — dass NICHT zu viel weg ist. Vor dem Löschen die
--    Artikelbild-Adressen des Verkäufers merken, danach dieselben abrufen:
--      SELECT id, status, image_url FROM live_auctions
--       WHERE seller_id = '<id>' AND image_url IS NOT NULL LIMIT 5;
--    Jede dieser Adressen MUSS weiterhin HTTP 200 liefern — auch bei
--    `status = 'cancelled'`. Ein 404 hiesse, der Rundumschlag ist doch eingebaut
--    worden, und wer die Ware gekauft hat, sieht ein totes Bild.
--
-- 10. Ebenso ein Chat-Foto, das das gelöschte Konto einem anderen Menschen
--     geschickt hat: Es liegt unter `thumbnails/<uid>/` und MUSS bleiben.
--       SELECT image_url FROM messages
--        WHERE sender_id = '<id>' AND image_url IS NOT NULL LIMIT 5;
--
-- 11. Ein Ordner-Eintrag lässt sich nicht von Hand auf etwas Fremdes richten:
--       INSERT INTO r2_delete_queue (prefix) VALUES ('thumbnails/');
--       -- muss an `r2_delete_queue_prefix_shape` scheitern
--       INSERT INTO r2_delete_queue (prefix) VALUES ('highlights/');
--       -- muss ebenfalls scheitern (kein Kennung-Teil = Ordner ALLER Nutzer)
