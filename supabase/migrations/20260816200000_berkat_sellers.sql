-- Privat oder gewerblich — die Verkäufer-Ebene des Marktplatzes
--
-- WARUM
-- Auf Berkat sollen beide verkaufen können: Privatleute und Gewerbetreibende,
-- wie bei Kleinanzeigen. Das ist keine Produktentscheidung, sondern eine
-- rechtliche: Ein Privatverkauf hat kein Widerrufsrecht und die Gewährleistung
-- ist ausschließbar; ein gewerblicher hat beides und dazu Impressumspflicht.
-- Art. 246d § 1 EGBGB verlangt, dass der Käufer VOR seiner Vertragserklärung
-- erfährt, mit wem er es zu tun hat. Also muss die App es wissen und zeigen.
--
-- ⚠️ WARUM EINE EIGENE TABELLE UND NICHT SPALTEN AUF `profiles`
-- `profiles` trägt seit `20260814240000` KEIN Tabellen-SELECT mehr, sondern eine
-- ausdrückliche Spaltenliste (die Migration nahm `push_token` aus der Sicht der
-- Clients). Jede neue Spalte dort wäre ohne eigenes `GRANT SELECT (<spalte>)`
-- unsichtbar — und ein Filter darauf reißt die GANZE Abfrage mit `42501` ab,
-- nicht nur die Spalte. Am 16.08.2026 bei `banner_url` genau so aufgeschlagen.
-- Bei vier bis acht Rechtsfeldern wäre das viermal bis achtmal dieselbe Falle.
--
-- Dazu kommt: `profiles` gehört Serlo mit. Eine Berkat-eigene Tabelle erbt Serlo
-- nicht mit.
--
-- ⚠️ WARUM DIE LESE-POLICY HIER AUSNAHMSWEISE `USING (true)` IST
-- Abschnitt 5 der Übergabe sagt „nie `USING(true)`", und das gilt weiter für
-- alles, was seine Sichtbarkeit von einer Session erbt. Diese Tabelle erbt
-- nichts: Bei einem GEWERBLICHEN Verkäufer sind Name, Anschrift und Kontakt
-- gesetzlich VORGESCHRIEBEN öffentlich (Impressum). Bei einem PRIVATEN steht
-- außer `kind` gar nichts drin — es gibt nichts zu schützen. Die Felder sind
-- deshalb bewusst so geschnitten, dass eine offene Lese-Policy korrekt ist.

BEGIN;

-- ⚠️ Die Spalte gehört hierher, nicht in die Migration mit den übrigen
-- Angebotsfeldern: Die RPC am Ende dieser Datei schreibt hinein. Läge sie
-- woanders, wäre diese Migration für sich genommen kaputt — und wer nur sie
-- einspielt, bekäme den Fehler erst zur Laufzeit, beim ersten Verkäufer.
--
-- Kein `GRANT SELECT` nötig: `live_auctions` hat KEINE eingefrorene
-- Spaltenliste. Am 17.08.2026 gemessen — `select=*` ohne Anmeldung antwortet
-- mit 200, und in allen Migrationen steht für die Tabelle nur
-- `REVOKE INSERT, UPDATE, DELETE`. Betroffen sind nur `profiles`,
-- `live_sessions` und `user_whip_ingresses` (Übergabe Abschnitt 3).
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS seller_kind text
    CHECK (seller_kind IS NULL OR seller_kind IN ('private', 'business'));

COMMENT ON COLUMN public.live_auctions.seller_kind IS
  'Anbietertyp zum Zeitpunkt des Einstellens. Wird bei einem Wechsel für offene '
  'Angebote nachgezogen, für verkaufte nie — Art. 246d EGBGB verlangt die Angabe '
  'vor der Vertragserklärung, und ein geschlossener Kauf behält seinen Stand.';

-- Vorsichtshalber, dieselbe Zeile wie bei `category` (20260816120000:88) und
-- `shipping_cents` (20260815190000): Steht auf der Tabelle ein Tabellen-Recht,
-- ist dieses GRANT wirkungslos und schadet nicht. Wurde dort je ein
-- spaltenweises REVOKE gesetzt, ist es die Zeile, ohne die JEDE Abfrage
-- scheitert, die die Spalte auch nur im Filter erwähnt.
GRANT SELECT (seller_kind) ON public.live_auctions TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.berkat_sellers (
  user_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Die eine Angabe, um die es geht. Vorgabe `private`: Wer nichts sagt, ist
  -- kein Unternehmer — die Unternehmereigenschaft muss man annehmen, nicht
  -- unterstellen.
  kind          text NOT NULL DEFAULT 'private'
                  CHECK (kind IN ('private', 'business')),

  -- Impressumsangaben. Bewusst ALLE nullable, auch bei `business`:
  -- Eine Datenbank, die einen Verkäufer wegen eines fehlenden Feldes abweist,
  -- sperrt ihn aus, statt ihn zu fragen. Unvollständige gewerbliche Angaben
  -- erzeugen in der App einen Hinweis-Streifen am Angebot — der Riegel gehört
  -- in die Oberfläche, nicht in einen CHECK.
  legal_name    text,
  street        text,
  postal_code   text,
  city          text,
  country       text CHECK (country IS NULL OR country IN ('DE', 'AT', 'CH')),
  contact_email text,
  vat_id        text,
  lucid_id      text,

  -- ⚠️ DIE ZAG-SCHRANKE.
  -- Läuft das Geld eines FREMDEN Verkäufers über das Stripe-Konto des
  -- Betreibers, ist das Finanztransfergeschäft und nach ZAG erlaubnispflichtig.
  -- Solange es kein Stripe Connect gibt, darf deshalb niemand außer dem
  -- Betreiber über die Kasse verkaufen — alle anderen verkaufen über Kontakt.
  --
  -- Vorgabe `false`, ABER: Das Fehlen einer Zeile bedeutet NICHT „gesperrt",
  -- sondern „wie bisher". Das ist der Unterschied zwischen einer Schranke und
  -- einem Ausfall; siehe die Begründung in `20260816210000`.
  checkout_enabled boolean NOT NULL DEFAULT false,

  declared_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.berkat_sellers IS
  'Anbietertyp und Impressumsangaben je Berkat-Verkäufer. Getrennt von profiles, '
  'weil profiles eine eingefrorene Spaltenliste hat und Serlo mitgehört.';

-- Zeitstempel pflegen, Muster aus 20260815180000.
CREATE OR REPLACE FUNCTION public.berkat_sellers_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_berkat_sellers_touch ON public.berkat_sellers;
CREATE TRIGGER trg_berkat_sellers_touch
  BEFORE UPDATE ON public.berkat_sellers
  FOR EACH ROW EXECUTE FUNCTION public.berkat_sellers_touch();

ALTER TABLE public.berkat_sellers ENABLE ROW LEVEL SECURITY;

-- Lesen: alle. Begründung im Kopf dieser Datei — der Inhalt ist entweder
-- gesetzlich öffentlich (gewerblich) oder leer (privat).
DROP POLICY IF EXISTS berkat_sellers_select ON public.berkat_sellers;
CREATE POLICY berkat_sellers_select ON public.berkat_sellers
  FOR SELECT USING (true);

-- Schreiben: NIEMAND direkt. Der einzige Weg ist die RPC unten — sonst könnte
-- sich jeder `checkout_enabled` selbst auf true setzen und damit die
-- ZAG-Schranke aufheben.
REVOKE INSERT, UPDATE, DELETE ON public.berkat_sellers FROM anon, authenticated;

-- Und das Lese-Recht ausdrücklich, statt auf die Standardrechte für neue
-- Tabellen zu vertrauen. Ohne Tabellen-Recht wäre die Policy oben wirkungslos —
-- RLS entscheidet, WELCHE Zeilen, das GRANT entscheidet, OB überhaupt.
GRANT SELECT ON public.berkat_sellers TO anon, authenticated;

-- ─── Der Eingang ─────────────────────────────────────────────────────────────
-- `checkout_enabled` ist ABSICHTLICH kein Parameter. Wer über die Kasse
-- verkaufen darf, entscheidet der Betreiber nach einer Prüfung, nicht der
-- Verkäufer über ein Formular.
CREATE OR REPLACE FUNCTION public.set_berkat_seller_kind(
  p_kind          text,
  p_legal_name    text DEFAULT NULL,
  p_street        text DEFAULT NULL,
  p_postal_code   text DEFAULT NULL,
  p_city          text DEFAULT NULL,
  p_country       text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_vat_id        text DEFAULT NULL,
  p_lucid_id      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('private', 'business') THEN
    RAISE EXCEPTION 'unknown_seller_kind' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.berkat_sellers AS s (
    user_id, kind, legal_name, street, postal_code, city, country,
    contact_email, vat_id, lucid_id, declared_at
  ) VALUES (
    v_uid, p_kind,
    NULLIF(btrim(coalesce(p_legal_name, '')), ''),
    NULLIF(btrim(coalesce(p_street, '')), ''),
    NULLIF(btrim(coalesce(p_postal_code, '')), ''),
    NULLIF(btrim(coalesce(p_city, '')), ''),
    NULLIF(btrim(coalesce(p_country, '')), ''),
    NULLIF(btrim(coalesce(p_contact_email, '')), ''),
    NULLIF(btrim(coalesce(p_vat_id, '')), ''),
    NULLIF(btrim(coalesce(p_lucid_id, '')), ''),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    kind          = EXCLUDED.kind,
    legal_name    = EXCLUDED.legal_name,
    street        = EXCLUDED.street,
    postal_code   = EXCLUDED.postal_code,
    city          = EXCLUDED.city,
    country       = EXCLUDED.country,
    contact_email = EXCLUDED.contact_email,
    vat_id        = EXCLUDED.vat_id,
    lucid_id      = EXCLUDED.lucid_id,
    declared_at   = now()
  -- `checkout_enabled` steht bewusst NICHT in der Liste: Ein Wechsel des
  -- Anbietertyps darf die Kassen-Freigabe weder erteilen noch verlieren.
  WHERE s.user_id = v_uid;

  -- ⚠️ Noch OFFENE eigene Angebote ziehen den neuen Typ nach, VERKAUFTE nie.
  -- Art. 246d verlangt die Angabe vor der Vertragserklärung — ein bereits
  -- geschlossener Kauf behält den Stand von damals, sonst änderte eine spätere
  -- Umstufung rückwirkend die Rechtslage abgeschlossener Geschäfte. Ein noch
  -- offenes Angebot muss dagegen den heutigen Stand zeigen, sonst wirbt ein
  -- Unternehmer weiter mit „Privatverkauf".
  UPDATE public.live_auctions
     SET seller_kind = p_kind
   WHERE seller_id = v_uid
     AND status IN ('listed', 'scheduled', 'running');
END $$;

REVOKE ALL ON FUNCTION public.set_berkat_seller_kind(text, text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_berkat_seller_kind(text, text, text, text, text, text, text, text, text)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- 1. Lesbar ohne Anmeldung (die Anbieterkennzeichnung muss jeder sehen):
--      GET /rest/v1/berkat_sellers?select=user_id,kind   -> 200
--
-- 2. Direktes Schreiben ist zu:
--      POST /rest/v1/berkat_sellers                      -> 42501
--
-- 3. Die Kassen-Freigabe lässt sich nicht selbst erteilen: `set_berkat_seller_kind`
--    hat dafür keinen Parameter, und ein direktes UPDATE ist per REVOKE zu.
--    Freischalten geht nur über die Datenbank-Konsole — das ist Absicht,
--    solange es kein Stripe Connect gibt.
--
-- 4. Die neue Spalte ist ohne Anmeldung lesbar (sie trägt die
--    Anbieterkennzeichnung am Angebot):
--      GET /rest/v1/live_auctions?select=id,seller_kind&limit=1   -> 200
--
-- Diese Migration ist für sich vollständig: Sie legt die Spalte an, in die ihre
-- eigene RPC schreibt. Am Verhalten der App ändert sie noch nichts — bis die
-- Oberfläche fragt, hat niemand eine Zeile, und ohne Zeile bleibt alles wie
-- bisher.
