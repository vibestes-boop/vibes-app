-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: Altersabfrage — kein Gebot ohne erklärte Volljährigkeit
--
-- DAS PROBLEM (Übergabe, Prüfliste F0, offen seit dem 21.08.2026)
-- Berkat hat keine Altersabfrage. Bei einer Auktion ist das nicht kosmetisch:
--
--   § 106 BGB  Wer zwischen 7 und 18 ist, ist beschränkt geschäftsfähig.
--   § 107 BGB  Eine Willenserklärung, die ihm nicht lediglich einen rechtlichen
--              Vorteil bringt, braucht die Einwilligung des Vertreters.
--   § 108 BGB  Ohne sie ist der Vertrag **schwebend unwirksam** — die Eltern
--              können ihn genehmigen oder verweigern.
--
-- Ein Gebot ist nach Berkats eigenem Regelwerk eine **bindende
-- Willenserklärung** (Übergabe, Abschnitt 19). Bietet ein Sechzehnjähriger und
-- gewinnt, hängt der Vertrag in der Luft: Der Verkäufer hat die Ware
-- zurückgehalten, die Auktion ist gelaufen, und ob daraus je Geld wird,
-- entscheiden Fremde. § 110 (Taschengeld) hilft nicht — er greift erst, wenn
-- **vollständig** aus eigenen Mitteln bezahlt wurde, und genau das steht beim
-- Zuschlag noch aus.
--
-- ⚠️ WAS DIESE MIGRATION IST UND WAS NICHT
-- Sie ist eine **Selbstauskunft**, keine Ausweisprüfung. Das ist der Stand, den
-- Marktplätze dieser Größe fahren (Whatnot, eBay: 18+ per Erklärung), und er
-- erfüllt den Zweck, um den es hier geht: Es gibt danach einen Zeitpunkt, an dem
-- der Nutzer erklärt hat, volljährig zu sein — vorher kommt kein Gebot zustande.
-- Eine echte Verifikation (Ausweis, Schufa-Ident) ist ein eigenes Vorhaben und
-- kostet Geld je Prüfung.
--
-- ── ⚠️ WARUM EIN TRIGGER AUF DER TABELLE UND NICHT EIN IF IN JEDER RPC ───────
--
-- Der naheliegende Weg wäre gewesen, `place_live_bid`, `set_max_bid`,
-- `buy_now_live_auction`, `make_berkat_offer` und `create_berkat_tip` je eine
-- Zeile Prüfung zu verpassen. Drei Gründe dagegen, und der dritte wiegt am
-- schwersten:
--
--   1. Es wären **fünf** SECURITY-DEFINER-Rümpfe neu zu schreiben. Genau dabei
--      hat `buy_now_live_auction` schon einmal `buy_now_gone`, den Eintrag in
--      `live_bids`, `bid_count`, `ends_at` und den Rückgabewert verloren
--      (Übergabe 73).
--   2. Jede künftige Geld-RPC müsste daran denken. Eine Warnung ist kein Riegel.
--   3. **`live_bids` ist der Flaschenhals, durch den alles muss.** Gebot,
--      Max-Gebot, Sofortkauf und der eingelöste Preisvorschlag schreiben alle
--      eine Zeile dorthin — Sofortkauf ausdrücklich (Übergabe 73). Ein Riegel
--      dort deckt vier Wege mit einer Prüfung ab, und zwar auch die, die es
--      noch nicht gibt.
--
-- Dieselbe Entscheidung wie bei Fund 1 des Sicherheits-Audits: „Warum ein
-- Trigger und nicht REVOKE + Spalten-GRANTs" (Übergabe 73).
--
-- ── ⚠️ GEPRÜFT WIRD DIE ZEILE, NICHT `auth.uid()` ───────────────────────────
--
-- `resolve_auto_bids` legt Gebote **im Namen eines anderen** an: Wenn A bietet,
-- kann Bs hinterlegtes Maximum automatisch nachziehen — `auth.uid()` ist dabei
-- A, die Zeile gehört aber B. Ein Riegel auf `auth.uid()` liesse B durch.
-- Geprüft wird deshalb `NEW.bidder_id` / `NEW.buyer_id` / `NEW.sender_id`.
--
-- ── ⚠️ DREI TABELLEN, KEINE VIERTE ──────────────────────────────────────────
--
-- `live_bids`, `berkat_offers`, `berkat_tips` — alle drei gehören Berkat allein
-- (nachgesehen: Serlo berührt sie nirgends, nur ein Kommentar in
-- `apps/web/app/actions/gdpr.ts` nennt `berkat_tips` für die Löschung).
--
-- **`product_orders` bekommt ausdrücklich KEINEN Trigger.** Die Tabelle teilt
-- sich Berkat mit Serlos Shop, und Serlo ist im App Store. Ein Riegel dort
-- hätte fremde Käufe blockiert, für die diese Migration gar nicht gedacht ist.
-- Der Kaufweg ist trotzdem gedeckt: Ohne Gebot und ohne Sofortkauf entsteht in
-- Berkat kein Korb, aus dem eine Bestellung würde.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Die Spalte ───────────────────────────────────────────────────────────
--
-- ⚠️ **BEWUSST OHNE `GRANT SELECT`.** `profiles` trägt seit `20260814240000`
-- eine eingefrorene Spaltenliste (CLAUDE.md, Regel 11): Eine neue Spalte ist für
-- `anon` und `authenticated` unsichtbar, solange sie kein eigenes GRANT bekommt.
-- Bei `banner_url` war das ein Fehler, hier ist es die Absicht — ein
-- Geburtsdatum ist personenbezogen und geht keinen Client etwas an, auch nicht
-- den eigenen. Was der Client braucht, ist ein Ja/Nein, und das liefert
-- `birth_date_state()` weiter unten.
--
-- Gegenprobe, dass die Spalte wirklich zu ist, steht am Ende.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.profiles.birth_date IS
  'Selbstauskunft zum Geburtsdatum (Altersschranke, §§ 106-108 BGB). Bewusst '
  'OHNE GRANT an anon/authenticated: personenbezogen. Zugriff nur ueber '
  'is_adult() und birth_date_state(). Schreiben nur ueber set_my_birth_date().';

-- ─── 2. Volljährig? ──────────────────────────────────────────────────────────
--
-- ⚠️ NULL heisst **nicht volljährig**, nicht „unbekannt, also durch". Eine
-- Schranke, die im Zweifel öffnet, ist keine. Der Unterschied zwischen „nicht
-- gesagt" und „zu jung" gehört in die Oberfläche, nicht in den Riegel —
-- dafür gibt es `birth_date_state()`.
CREATE OR REPLACE FUNCTION public.is_adult(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_user
       AND p.birth_date IS NOT NULL
       -- `::date` ist Pflicht: `CURRENT_DATE - INTERVAL` ergibt einen
       -- timestamp, und der Vergleich mit einer `date`-Spalte würde still
       -- über die Tageszeit entscheiden.
       AND p.birth_date <= (CURRENT_DATE - INTERVAL '18 years')::date
  );
$$;

REVOKE ALL ON FUNCTION public.is_adult(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_adult(uuid) TO authenticated, service_role;

-- ─── 3. Was die Oberfläche wissen darf ──────────────────────────────────────
--
-- Drei Zustände, kein Datum. Der Client muss unterscheiden können, ob er
-- **fragen** soll („noch nichts gesagt") oder **absagen** („zu jung") — mit
-- einem blossen Ja/Nein bekäme ein Erwachsener, der die Frage noch nicht
-- beantwortet hat, dieselbe Abfuhr wie ein Sechzehnjähriger.
CREATE OR REPLACE FUNCTION public.birth_date_state()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'anonymous'
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN 'missing'
    WHEN (SELECT birth_date FROM public.profiles WHERE id = auth.uid()) IS NULL THEN 'missing'
    WHEN public.is_adult(auth.uid()) THEN 'adult'
    ELSE 'minor'
  END;
$$;

REVOKE ALL ON FUNCTION public.birth_date_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.birth_date_state() TO authenticated, service_role;

-- ─── 4. Eintragen ────────────────────────────────────────────────────────────
--
-- ⚠️ **NUR EINMAL.** Steht schon ein Datum, wird jedes weitere abgelehnt.
-- Anders wäre die Schranke wertlos: Wer als Sechzehnjähriger abgewiesen wird,
-- trüge sonst beim zweiten Versuch 1990 ein.
--
-- ⚠️ Der Preis dafür ist ein Tippfehler, der dauerhaft aussperrt. Das ist
-- bewusst in Kauf genommen und für eine Korrektur gibt es keinen Selbstweg —
-- sie geht über `service_role` (SQL-Editor). Bei fünf Verkäufern in Phase 0 ist
-- das vertretbar; wächst die Zahl, gehört ein Admin-Weg dazu.
CREATE OR REPLACE FUNCTION public.set_my_birth_date(p_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'birth_date_required' USING ERRCODE = '22023';
  END IF;

  -- Ein Datum in der Zukunft oder vor 1900 ist kein Geburtsdatum, sondern ein
  -- Vertipper. Das vorher zu sagen ist freundlicher als eine Sperre, die
  -- niemand mehr aufheben kann.
  IF p_date > CURRENT_DATE OR p_date < DATE '1900-01-01' THEN
    RAISE EXCEPTION 'birth_date_implausible' USING ERRCODE = '22023';
  END IF;

  SELECT birth_date INTO v_old FROM public.profiles WHERE id = v_uid;

  -- ⚠️ Das gleiche Datum noch einmal ist KEIN Fehler. Ein Client, der nach
  -- einem Verbindungsabbruch wiederholt, soll nicht auf eine Sperre laufen —
  -- dieselbe Idempotenz-Überlegung wie beim Sammelkorb (Abschnitt 4).
  IF v_old IS NOT NULL AND v_old <> p_date THEN
    RAISE EXCEPTION 'birth_date_locked' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET birth_date = p_date WHERE id = v_uid;

  RETURN public.birth_date_state();
END $$;

REVOKE ALL ON FUNCTION public.set_my_birth_date(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_birth_date(date) TO authenticated;

-- ─── 5. Der Riegel ───────────────────────────────────────────────────────────
--
-- Eine Funktion, drei Trigger. `TG_ARGV[0]` sagt, welche Spalte die Person
-- trägt, die sich hier bindet — so bleibt der Rumpf einer statt dreier
-- Abschriften, die auseinanderlaufen können.
CREATE OR REPLACE FUNCTION public.guard_adult_commitment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user  uuid;
  v_state text;
BEGIN
  EXECUTE format('SELECT ($1).%I', TG_ARGV[0]) INTO v_user USING NEW;

  -- Keine Person, keine Prüfung. Kommt nicht vor (alle drei Spalten sind NOT
  -- NULL), steht hier als Netz statt als Absturz.
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_adult(v_user) THEN
    RETURN NEW;
  END IF;

  -- ⚠️ Zwei verschiedene Meldungen, und das ist keine Kosmetik: Der Client
  -- muss unterscheiden können, ob er FRAGEN soll oder ABSAGEN. Ein
  -- gemeinsames „nicht erlaubt" würde einem Erwachsenen, der die Frage nur
  -- noch nicht beantwortet hat, sagen, er sei zu jung.
  SELECT CASE
    WHEN (SELECT birth_date FROM public.profiles WHERE id = v_user) IS NULL
      THEN 'birth_date_missing'
    ELSE 'under_age'
  END INTO v_state;

  RAISE EXCEPTION '%', v_state USING ERRCODE = '42501';
END $$;

ALTER FUNCTION public.guard_adult_commitment() OWNER TO postgres;

-- Gebot, Max-Gebot, Sofortkauf und eingelöster Preisvorschlag — alle vier
-- schreiben hierher.
DROP TRIGGER IF EXISTS trg_adult_bid ON public.live_bids;
CREATE TRIGGER trg_adult_bid
  BEFORE INSERT ON public.live_bids
  FOR EACH ROW EXECUTE FUNCTION public.guard_adult_commitment('bidder_id');

DROP TRIGGER IF EXISTS trg_adult_offer ON public.berkat_offers;
CREATE TRIGGER trg_adult_offer
  BEFORE INSERT ON public.berkat_offers
  FOR EACH ROW EXECUTE FUNCTION public.guard_adult_commitment('buyer_id');

-- Trinkgeld ist kein Kauf, aber echtes Geld aus der Hand.
DROP TRIGGER IF EXISTS trg_adult_tip ON public.berkat_tips;
CREATE TRIGGER trg_adult_tip
  BEFORE INSERT ON public.berkat_tips
  FOR EACH ROW EXECUTE FUNCTION public.guard_adult_commitment('sender_id');

-- ─── 6. Die Spalte gegen den Client sperren ─────────────────────────────────
--
-- ⚠️ OHNE DIESEN TEIL WÄRE ALLES OBEN WERTLOS. `GRANT UPDATE ON profiles TO
-- authenticated` steht auf **Tabellen**-Ebene, gilt also für jede Spalte —
-- ein `PATCH /rest/v1/profiles?id=eq.<eigene-id>` mit `{"birth_date":
-- "1990-01-01"}` hätte die Einmal-Regel aus Punkt 4 schlicht übersprungen.
-- Das ist wörtlich Fund 1 des Audits vom 22.08.2026, eine Spalte weiter.
--
-- Der Wächter von damals ist der richtige Ort: Er prüft die ROLLE, lässt also
-- `set_my_birth_date` (SECURITY DEFINER, läuft als `postgres`) und
-- `service_role` durch und blockt `anon`/`authenticated`.
--
-- ⚠️ Der Rumpf ist **zeichengleich** aus `20260822150000` übernommen; neu ist
-- genau eine Zeile in der CASE-Kette und eine im INSERT-Zweig. Wer ihn erneut
-- anfasst, vergleicht vorher mit dem Abzug — hier ist schon einmal eine
-- Neufassung um ihre halbe Wirkung gebracht worden (Übergabe 73).
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_changed text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_admin OR NEW.is_moderator OR NEW.is_operator OR NEW.is_creator_ops
       OR NEW.is_verified OR NEW.is_creator OR NEW.is_banned OR NEW.is_restricted
       OR NEW.is_shadow_banned
       OR COALESCE(NEW.verification_level, 0) <> 0
       OR NEW.restricted_until IS NOT NULL
       OR NEW.birth_date IS NOT NULL THEN
      RAISE EXCEPTION 'Rechte-Spalten koennen beim Anlegen nicht gesetzt werden'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  v_changed := CASE
    WHEN NEW.is_admin           IS DISTINCT FROM OLD.is_admin           THEN 'is_admin'
    WHEN NEW.is_moderator       IS DISTINCT FROM OLD.is_moderator       THEN 'is_moderator'
    WHEN NEW.is_operator        IS DISTINCT FROM OLD.is_operator        THEN 'is_operator'
    WHEN NEW.is_creator_ops     IS DISTINCT FROM OLD.is_creator_ops     THEN 'is_creator_ops'
    WHEN NEW.is_verified        IS DISTINCT FROM OLD.is_verified        THEN 'is_verified'
    WHEN NEW.is_creator         IS DISTINCT FROM OLD.is_creator         THEN 'is_creator'
    WHEN NEW.is_banned          IS DISTINCT FROM OLD.is_banned          THEN 'is_banned'
    WHEN NEW.is_restricted      IS DISTINCT FROM OLD.is_restricted      THEN 'is_restricted'
    WHEN NEW.restricted_until   IS DISTINCT FROM OLD.restricted_until   THEN 'restricted_until'
    WHEN NEW.is_shadow_banned   IS DISTINCT FROM OLD.is_shadow_banned   THEN 'is_shadow_banned'
    WHEN NEW.verification_level IS DISTINCT FROM OLD.verification_level THEN 'verification_level'
    WHEN NEW.birth_date         IS DISTINCT FROM OLD.birth_date         THEN 'birth_date'
    ELSE NULL
  END;

  IF v_changed IS NOT NULL THEN
    RAISE EXCEPTION '% darf nicht vom Client geaendert werden', v_changed
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_profile_privileges() OWNER TO postgres;

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN — von aussen, nicht am Abzug (Lehre aus Abschnitt 73)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1 · Die Spalte ist für Clients unsichtbar. Erwartet: 42501.
--     curl "$U/rest/v1/profiles?select=birth_date&limit=1" -H "apikey: $ANON"
--
-- 2 · Direkt schreiben scheitert am Wächter. Aus einer ANGEMELDETEN Sitzung,
--     erwartet 403 / 42501 „birth_date darf nicht vom Client geaendert werden":
--     curl -X PATCH "$U/rest/v1/profiles?id=eq.<eigene>" -d '{"birth_date":"1990-01-01"}'
--
-- 3 · Ohne Geburtsdatum kein Gebot. `place_live_bid` auf eine laufende Auktion,
--     erwartet 42501 mit `birth_date_missing`.
--
-- 4 · Nach `set_my_birth_date('1990-01-01')` liefert `birth_date_state()`
--     `adult`, und dasselbe Gebot geht durch.
--
-- 5 · Ein Datum von vor 17 Jahren → `birth_date_state()` = `minor`, Gebot
--     scheitert mit `under_age`.
--
-- 6 · Einmal-Regel: zweiter `set_my_birth_date` mit einem ANDEREN Datum →
--     42501 `birth_date_locked`. Mit demselben Datum → geht durch.
--
-- 7 · ⚠️ Die Probe, die man vergisst: `resolve_auto_bids`. A bietet, Bs
--     hinterlegtes Maximum zieht nach — geprüft werden muss B, nicht A. Steht
--     Bs Geburtsdatum auf minderjährig, darf sein Nachzug NICHT durchgehen.
--     (Er kann nicht entstehen, weil `set_max_bid` ebenfalls in `live_bids`
--     schreibt — die Probe belegt genau das.)
--
-- 8 · Serlos Shop ist unberührt: Ein Kauf über `buy_product` legt weiterhin
--     eine `product_orders`-Zeile an, ohne dass ein Geburtsdatum nötig wäre.
-- ─────────────────────────────────────────────────────────────────────────────
