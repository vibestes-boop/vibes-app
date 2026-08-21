-- ═══════════════════════════════════════════════════════════════════════════
-- Konto löschen heißt anonymisieren, nicht vernichten
-- 21.08.2026 · Serlo UND Berkat · ersetzt `delete_own_account()`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ DAS HIER BEHEBT EINEN LIVE-FEHLER, ES BAUT NICHTS NEUES.
--
-- Die bisherige Fassung war genau eine Zeile:
--
--     DELETE FROM auth.users WHERE id = auth.uid();
--
-- Der Kommentar in `apps/web/app/actions/gdpr.ts` beschreibt das als Feature:
-- „Cascade via FKs purged alle User-Daten." Die Kette purged aber mehr als die
-- Daten dieses Menschen. `profiles.id` hängt mit ON DELETE CASCADE an
-- `auth.users`, und an `profiles` hängen mit demselben Verhalten unter anderem:
--
--     product_orders.buyer_id      product_orders.seller_id
--     berkat_tips.sender_id        berkat_tips.recipient_id
--     coin_purchases.user_id       live_auctions.seller_id
--     live_bids.bidder_id          auction_carts.buyer_id / seller_id
--
-- Daraus folgt zweierlei, und beides ist schlimm:
--
-- 1. **Es trifft Dritte.** Löscht ein KÄUFER sein Konto, verschwindet seine
--    `product_orders`-Zeile — und damit der VERKAUFSBELEG des Verkäufers. Der
--    hat die Ware verschickt und findet den Vorgang nicht mehr. Umgekehrt
--    genauso: Löscht ein Verkäufer, verschwinden die Auktionen, an denen andere
--    geboten und gewonnen haben.
--
-- 2. **Es ist aufbewahrungspflichtig.** § 147 AO und § 257 HGB verlangen für
--    Rechnungen und Handelsbriefe sechs bis zehn Jahre. Eine Zahlung über
--    Stripe zu löschen, weil der Zahlende das Konto schließt, ist kein
--    Datenschutz, sondern ein Verstoß gegen die Aufbewahrungspflicht.
--
-- Und das Entscheidende: **Die DSGVO verlangt das gar nicht.** Art. 17 Abs. 3
-- lit. b nimmt die Löschpflicht ausdrücklich zurück, soweit die Verarbeitung
-- zur Erfüllung einer rechtlichen Verpflichtung erforderlich ist. Der richtige
-- Weg ist Anonymisierung: Die Person verschwindet, der Beleg bleibt.
--
-- ⚠️ APPLE 5.1.1(v) IST DER ANLASS, NICHT DER MASSSTAB.
-- Berkat liegt seit dem 21.08.2026 in TestFlight und hat gar keinen Löschweg;
-- Apple verlangt einen in der App. Beim Nachsehen fiel auf, dass Serlos Web
-- längst einen hat — nur den falschen. Deshalb wird hier die geteilte Funktion
-- repariert, statt daneben eine zweite zu bauen.
--
-- ⚠️ SIGNATUR BLEIBT. `apps/web/app/actions/gdpr.ts:221` ruft
-- `supabase.rpc('delete_own_account')` ohne Argumente. Ein Rename oder ein
-- neuer Parameter bräche die ausgelieferte Web-App; ein defaultierter Parameter
-- erzeugte eine Überladung und damit HTTP 300 (die Falle aus Abschnitt 13).

-- ─── 1. Der Lösch-Zeitpunkt am Profil ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ⚠️ PFLICHT, KEINE KOSMETIK. `profiles` trägt seit `20260814240000` eine
-- EINGEFRORENE Spaltenliste: Das spaltenweise REVOKE auf `push_token` hat das
-- Tabellen-Recht aufgelöst und durch Einzelrechte ersetzt. Jede später
-- hinzugefügte Spalte ist für `anon`/`authenticated` unsichtbar — und ein
-- Filter darauf scheitert mit `42501`, auch wenn die Spalte gar nicht
-- selektiert wird. Am 16.08.2026 genau so bei `banner_url` zugeschlagen.
-- Regel 11 in CLAUDE.md. NIE das Tabellen-Recht wiederherstellen.
GRANT SELECT (deleted_at) ON public.profiles TO anon, authenticated;

COMMENT ON COLUMN public.profiles.deleted_at IS
  'Gesetzt von delete_own_account(): Konto anonymisiert und gesperrt. Die Zeile '
  'bleibt, weil Geschäftsbelege (product_orders, berkat_tips, coin_purchases) '
  'per FK daran hängen und aufbewahrungspflichtig sind (§ 147 AO, § 257 HGB).';

-- ─── 2. Die neue Fassung ────────────────────────────────────────────────────
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
-- Postgres-Fassungen, und die alte Fassung war an `anon` freigegeben — das ist
-- die `credit_coins`-Falle (Abschnitt 7). Ein nicht angemeldeter Aufruf lief
-- zwar in `not_authenticated`, aber das Recht gehört trotzdem weg.
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- GEGENPROBEN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Nicht angemeldet → 42501 (nicht mehr `not_authenticated`, weil das Recht
--    jetzt fehlt):
--      curl -s -X POST "$URL/rest/v1/rpc/delete_own_account" -H "apikey: $ANON"
--
-- 2. Die neue Spalte ist für Clients lesbar (sonst greift die
--    Eingefroren-Falle):
--      curl -s "$URL/rest/v1/profiles?select=id,deleted_at&limit=1" -H "apikey: $ANON"
--      -- muss 200 liefern, nicht 42501
--
-- 3. Der Rumpf enthält KEIN hartes Löschen mehr:
--      SELECT prosrc LIKE '%DELETE FROM auth.users%'
--        FROM pg_proc WHERE proname = 'delete_own_account';
--      -- muss false sein
--
-- 4. Am Testkonto durchspielen und DANACH prüfen, dass die Belege stehen:
--      SELECT count(*) FROM product_orders WHERE buyer_id = '<id>';
--      SELECT count(*) FROM berkat_tips    WHERE sender_id = '<id>';
--      -- beide müssen die Zahl von VORHER zeigen
--
-- 5. Und dass die Person weg ist:
--      SELECT username, display_name, avatar_url, deleted_at
--        FROM profiles WHERE id = '<id>';
--      -- username 'geloescht-xxxxxxxx', der Rest NULL, deleted_at gesetzt
--
-- 6. Anmeldung mit den alten Zugangsdaten schlägt fehl.
