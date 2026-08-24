-- ═══════════════════════════════════════════════════════════════════════════
-- 24.08.2026 · Berkat · der Löschsperre den halben Grund nehmen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `delete_own_account()` sperrte die Kontolöschung, solange als Verkäufer eine
-- Bestellung in `('paid', 'payment_requested')` offenstand. Der zweite Zustand
-- gehört dort nicht hin.
--
-- ── WARUM ────────────────────────────────────────────────────────────────────
--
-- `payment_requested` heisst: Es wurde eine Zahlung ANGEFRAGT. Geflossen ist
-- nichts. So steht es wörtlich in `20260627150000_order_buyer_actions.sql`:
-- „(status = 'payment_requested'). Kein Geld geflossen → gefahrlos."
--
-- Die Sperre behauptete trotzdem „Jemand hat bei dir bezahlt und wartet auf sein
-- Paket" (`lib/useDeleteAccount.ts`). Das war für diesen Zustand einfach falsch:
-- Niemand hat bezahlt, niemand wartet auf ein Paket.
--
-- ── ⚠️ UND SIE LÖSTE SICH NICHT VON SELBST ──────────────────────────────────
--
-- Der Kommentar an den Blockern sagte, beide seien „ausdrücklich VORÜBERGEHEND
-- und lösen sich von selbst — der Korb läuft nach 24 Stunden ab, die Bestellung
-- ist nach dem Versand erledigt". Für den Korb stimmt das. Für
-- `payment_requested` NICHT: Es gibt kein Auto-Storno. Der einzige Cron, der den
-- Zustand überhaupt anfasst, ist `send_payment_reminders()`
-- (`20260629170000`) — der schickt EINE Erinnerung nach 24 Stunden und rührt die
-- Zeile danach nie wieder an.
--
-- Ein Käufer, der einen Kauf anfängt und nie bezahlt, hat den Verkäufer damit
-- dauerhaft an sein Konto gefesselt. Am 24.08.2026 aufgefallen, weil `zaur` drei
-- solche Zeilen hatte und sein Konto nicht löschen konnte — kein Zeitablauf
-- hätte das je behoben.
--
-- Apple 5.1.1(v) verlangt, dass die Löschung ERREICHBAR ist. Eine Sperre, die
-- ein Fremder durch Nichtstun auf unbestimmte Zeit setzen kann, ist das nicht.
--
-- ── WAS BLEIBT ───────────────────────────────────────────────────────────────
--
-- `paid` bleibt Sperrgrund, und zwar zu Recht: Da ist Geld geflossen und jemand
-- wartet wirklich auf seine Ware. Dieser Zustand endet mit dem Versand, also
-- durch eine Handlung, die dem Verkäufer offensteht. Die Meldung in
-- `useDeleteAccount.ts` stimmt damit ab sofort wörtlich.
--
-- Auch der Sammelkorb-Blocker bleibt unverändert — der läuft nach 24 Stunden ab.
--
-- ⚠️ Der Rumpf unten ist eine ZEICHENGENAUE Übernahme aus `20260824120000`,
-- erzeugt und nicht abgetippt. Geändert ist genau eine Zeile (der `v_unship`-
-- Filter) und der Kommentar, der die falsche Behauptung trug. Wer hier etwas
-- anfasst, ändert eine Löschung mit Rechtsfolgen — nichts nebenbei mitnehmen.
-- ═══════════════════════════════════════════════════════════════════════════

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
  --
  -- ⚠️ Und genau deshalb steht `payment_requested` unten NICHT mehr dabei (seit
  -- dieser Migration). Der Satz oben galt für diesen Zustand nie: Es gibt kein
  -- Auto-Storno, nur eine einmalige Erinnerung nach 24 Stunden
  -- (`send_payment_reminders`, `20260629170000`). Eine angefangene und nie
  -- bezahlte Bestellung hätte den Verkäufer dauerhaft festgehalten — eine Sperre,
  -- die ein Fremder durch Nichtstun setzt. Wer sie wieder einträgt, macht die
  -- Löschung unerreichbar und den Satz oben zur Unwahrheit.
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
     AND status = 'paid';

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
