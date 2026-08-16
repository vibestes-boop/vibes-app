-- Berkat: Einladungen und was sie einbringen
--
-- WARUM ZWEI SEITEN
-- Berkat hat zwei verschiedene Knappheiten, und sie sind unterschiedlich teuer.
-- Käufer fehlen, aber Käufer kommen von selbst, wenn etwas los ist. VERKÄUFER
-- fehlen — fünf davon, acht Wochen lang, ist Phase 0 und laut HANDOFF „das
-- eigentliche Risiko". Ein Einladungssystem, das beide gleich behandelt,
-- belohnt das Billige genauso wie das Teure.
--
--   Du bringst einen KÄUFER    → 1× Gratis-Versand für ihn sofort,
--                                 1× für dich, sobald er zum ersten Mal zahlt
--   Du bringst einen VERKÄUFER → 30 Tage provisionsfrei für BEIDE,
--                                 sobald er zum ersten Mal etwas verkauft
--
-- WARUM PROVISIONSFREI HEUTE NICHTS KOSTET
-- Berkat nimmt aktuell keine Provision — Zaur ist Betreiber und Verkäufer in
-- einer Person, das Geld geht direkt auf sein Stripe-Konto. Ein provisionsfreier
-- Monat ist deshalb heute ein Versprechen ohne Rechnung. `starts_at` bleibt
-- leer und bedeutet: läuft ab dem Tag, an dem Provision eingeführt wird. Das
-- ist ehrlicher als ein Rabatt auf null und wertvoller als ein Abzeichen —
-- und es ist genau das, was ein Verkäufer hören will, den man gerade wirbt.
--
-- WARUM GRATIS-VERSAND UND KEIN GUTHABEN
-- Ein aufladbares Guthaben, mit dem man Ware bezahlt, ist E-Geld und
-- lizenzpflichtig — dieselbe Grenze, an der die Coins scheitern (HANDOFF 7).
-- Eine Versand-Gutschrift ist ein Rabatt auf eine konkrete Leistung, kein
-- übertragbarer Wert. Sie ist nicht auszahlbar, nicht handelbar, nicht
-- kombinierbar, und sie verfällt mit dem Korb, an dem sie hängt.
--
-- Nebenbei ist sie im Sammelkorb-Modell das Wertvollste, was Berkat verschenken
-- kann: Bei einer 5-€-Auktion ist der Versand teurer als die Ware — genau der
-- Grund, warum es den Sammelkorb überhaupt gibt.
--
-- ⚠️ WAS EINE GUTSCHRIFT WIRKLICH KOSTET — und warum sie ab Werk AUS ist
-- Nachgerechnet am 16.08.2026 mit den Sätzen aus
-- STRATEGIE-VERKAEUFER-UND-GELD.md (§ 0, E2, 6.3): Versand 4,90 € kassiert bei
-- ~3,50 € echten DHL-Kosten, eigene Ware Einkauf 5 € → Zuschlag 12 € (≈58 %
-- Marge), Stripe 1,5 % + 0,25 €.
--
-- Eine eingelöste Gutschrift kostet NICHT die 1,40 € Deckungsbeitrag, sondern
-- **4,83 €**: Die Pauschale fällt weg und das Porto fällt trotzdem an.
--
--   Warenwert im Korb │ Deckungsbeitrag normal │ mit Gutschrift
--   ──────────────────┼────────────────────────┼───────────────
--            1,00 €   │        +1,64 €         │   −3,19 €
--            5,00 €   │        +3,90 €         │   −0,93 €
--           12,00 €   │        +7,86 €         │   +3,03 €
--           25,00 €   │       +15,20 €         │  +10,38 €
--
-- **Die Verlustschwelle liegt bei 6,64 € Warenwert** — und genau darunter liegt
-- der wahrscheinlichste Fall: Ein Neuer löst den Code ein und testet mit EINEM
-- Artikel für 1 €. Das ist keine Randbedingung, das ist die zentrale Mechanik
-- der App. Deshalb `min_cart_cents` (unten), Vorgabe 15 €.
--
-- Zweiter Befund derselben Rechnung: Die Gutschrift des WERBERS kauft nichts.
-- Er hätte ohnehin gekauft — sie ist ein Rabatt an einen Bestandskunden. Nur
-- die des GEWORBENEN ist Kundengewinnung, und 4,83 € für einen zahlenden Käufer
-- ist billig (ein Meta-Klick kostet 0,50–2 € bei 1–3 % Konversion, also 20–100 €
-- je Kunde). Deshalb bekommt der Werber sie erst ab dem DRITTEN geworbenen
-- Käufer — dann ist sie aus drei Erstbestellungen bezahlt.
--
-- Dritter Befund, für später: Sobald es DRITTVERKÄUFER gibt, trägt die Rechnung
-- nicht mehr. Dann hat Berkat keine Warenmarge, sondern Provision — 8 % von
-- 15 € = 1,20 € gegen eine 4,90-€-Gutschrift. Der Käufer-Bonus funktioniert
-- **nur, solange Zaur selbst der Verkäufer ist**. Wer Phase 2 startet, muss ihn
-- neu bepreisen oder abschalten.
--
-- Konsequenz: `buyer_rewards_enabled` steht ab Werk auf **false**. Die gesamte
-- Mechanik ist gebaut und verzeichnet Einladungen von Tag eins an — es entsteht
-- nur keine Gutschrift, bis jemand den Schalter umlegt. Der Grund ist nicht
-- Vorsicht, sondern fehlende Daten: Die Belohnung rechnet sich erst ab der
-- ZWEITEN Bestellung eines geworbenen Käufers, und die Wiederkaufsrate kennt
-- heute niemand, weil Phase 0 nie begonnen hat.
--
-- Der Verkäufer-Bonus ist davon NICHT betroffen. Er kostet heute 0 €, weil es
-- keine Provision gibt, und trifft den echten Engpass (fünf Verkäufer).
--
-- ⚠️ WARUM ES KEINE BENACHRICHTIGUNG DAZU GIBT
-- Naheliegend wäre ein Typ `berkat_reward` in `notifications`. Bewusst NICHT
-- gemacht. Ein neuer Typ braucht laut HANDOFF 9 neun Oberflächen auf einmal;
-- wer nur einen Teil davon anfasst, bekommt den ELSE-Zweig aus
-- `fn_send_push_on_notification` — „Neue Aktivität auf Serlo", in einer
-- Auktions-App, für eine Belohnung. Genau das ist am 14.08. schon einmal
-- passiert. Und diese Funktion nachzuziehen hieße, einen 150-Zeilen-Rumpf per
-- CREATE OR REPLACE abzuschreiben — die Stelle, an der laut CLAUDE.md schon
-- einmal spätere Änderungen verlorengingen.
--
-- Eine Belohnung ist nicht eilig. Sie steht im Aktivitäts-Reiter und auf der
-- Belohnungs-Seite; das reicht, bis ein neuer Meldungstyp ohnehin ansteht.

BEGIN;

-- ─── 1. Der eigene Code ──────────────────────────────────────────────────────
-- Sechs Zeichen aus einem Alphabet ohne I, O, 0 und 1: Der Code wird
-- vorgelesen, in eine Sprachnachricht diktiert und abgetippt. „I" und „1"
-- auseinanderzuhalten ist am Telefon nicht zumutbar.
CREATE TABLE IF NOT EXISTS public.berkat_referral_codes (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Wer wen gebracht hat ─────────────────────────────────────────────────
-- Der Primärschlüssel auf `invitee_id` IST die Regel „ein Einlader, für immer".
-- Ohne ihn könnte jemand seinen Einlader wechseln, bis der Richtige dran ist —
-- und die Belohnung zweimal auslösen.
CREATE TABLE IF NOT EXISTS public.berkat_referrals (
  invitee_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  inviter_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  /** Gesetzt, sobald der Eingeladene zum ersten Mal wirklich bezahlt hat. */
  buyer_reward_at  timestamptz,
  /** Gesetzt, sobald der Eingeladene zum ersten Mal wirklich etwas verkauft hat. */
  seller_reward_at timestamptz,
  CONSTRAINT berkat_referrals_no_self CHECK (inviter_id <> invitee_id)
);

CREATE INDEX IF NOT EXISTS berkat_referrals_by_inviter
  ON public.berkat_referrals (inviter_id, created_at DESC);

-- ─── 3. Versand-Gutschriften ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.berkat_shipping_credits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason            text NOT NULL CHECK (reason IN ('invited', 'invite_paid')),
  granted_at        timestamptz NOT NULL DEFAULT now(),
  /** An welchem Korb sie gerade hängt, solange die Zahlung läuft. */
  reserved_cart_id  uuid REFERENCES public.auction_carts(id) ON DELETE SET NULL,
  consumed_at       timestamptz,
  consumed_order_id uuid REFERENCES public.product_orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS berkat_credits_open
  ON public.berkat_shipping_credits (user_id, granted_at)
  WHERE consumed_at IS NULL;

-- Ein Korb bekommt höchstens eine Gutschrift — je. Ohne diesen Index könnten
-- zwei parallele Kassengänge auf denselben Korb zwei Gutschriften verbrennen.
CREATE UNIQUE INDEX IF NOT EXISTS berkat_credits_one_per_cart
  ON public.berkat_shipping_credits (reserved_cart_id)
  WHERE reserved_cart_id IS NOT NULL;

-- ─── 4. Verkäufer-Vergünstigungen ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.berkat_seller_perks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind = 'commission_free'),
  days       integer NOT NULL CHECK (days > 0 AND days <= 365),
  reason     text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  /**
   * NULL = die Uhr läuft noch nicht. Solange Berkat keine Provision nimmt,
   * gibt es nichts zu erlassen; der Anspruch beginnt an dem Tag, an dem die
   * Provision eingeführt wird. Wer sie einführt, setzt hier das Datum.
   */
  starts_at  timestamptz,
  ends_at    timestamptz
);

CREATE INDEX IF NOT EXISTS berkat_perks_by_user
  ON public.berkat_seller_perks (user_id, granted_at DESC);

-- ─── 4b. Die Stellschrauben ──────────────────────────────────────────────────
-- Eine einzige Zeile. Sie hält die vier Zahlen, an denen die Rechnung oben
-- hängt — als Daten, nicht als Konstanten im Code: Wer sie ändert, braucht
-- keinen App-Build und keine zweite Migration, nur ein UPDATE.
--
-- Die Singleton-Prüfung (`id = 1`) ist Absicht. Eine zweite Zeile wäre eine
-- zweite Wahrheit, und keine der lesenden Stellen wüsste, welche gilt.
CREATE TABLE IF NOT EXISTS public.berkat_reward_policy (
  id                    integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  /**
   * DER SCHALTER. Ab Werk aus — die Begründung steht im Kopf dieser Datei.
   * Einladungen werden trotzdem von Tag eins an verzeichnet; es entsteht nur
   * keine Versand-Gutschrift.
   *
   * Anmachen:  UPDATE public.berkat_reward_policy SET buyer_rewards_enabled = true;
   */
  buyer_rewards_enabled boolean NOT NULL DEFAULT false,
  /** Ab diesem Warenwert im Korb ist eine Gutschrift einlösbar. 6,64 € ist die
      Verlustschwelle, 15 € der Wert mit Abstand dazu. */
  min_cart_cents        integer NOT NULL DEFAULT 1500 CHECK (min_cart_cents >= 0),
  /** Ab dem wievielten geworbenen Käufer der WERBER etwas bekommt. */
  inviter_reward_after  integer NOT NULL DEFAULT 3 CHECK (inviter_reward_after >= 1),
  /** Deckel je Werber und Kalendermonat. Ohne Deckel ist die Verbindlichkeit
      unbegrenzt — und eine unbegrenzte Verbindlichkeit ist kein Bonusprogramm. */
  monthly_cap           integer NOT NULL DEFAULT 3 CHECK (monthly_cap >= 0),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.berkat_reward_policy (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.berkat_reward_policy ENABLE ROW LEVEL SECURITY;

-- Bewusst KEINE Lese-Policy für Clients: Ob der Bonus an ist, erfährt die App
-- über `get_my_rewards()`. Die Schwellen (`inviter_reward_after`, `monthly_cap`)
-- sind Betriebswissen — wer sie kennt, kann sie ausrechnen und ausreizen.
-- Geschrieben wird ausschließlich per SQL-Editor; ein Schalter, der Geld kostet,
-- gehört nicht in eine App.
REVOKE ALL ON TABLE public.berkat_reward_policy FROM anon, authenticated;

-- ─── 5. Rechte: lesen ja, schreiben nie ──────────────────────────────────────
-- Alle vier Tabellen sind reine Ergebnis-Tabellen. Geschrieben wird
-- ausschließlich durch die RPCs und Trigger unten, alle SECURITY DEFINER.
-- Es gibt deshalb absichtlich KEINE INSERT/UPDATE/DELETE-Policy: Ohne Policy
-- lehnt RLS jeden Schreibversuch ab. Eine Gutschrift, die ein Client selbst
-- anlegen könnte, wäre Falschgeld.
ALTER TABLE public.berkat_referral_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.berkat_referrals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.berkat_shipping_credits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.berkat_seller_perks      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS berkat_codes_read_own ON public.berkat_referral_codes;
CREATE POLICY berkat_codes_read_own ON public.berkat_referral_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Beide Seiten dürfen die Verbindung sehen: Der Einlader will wissen, wen er
-- gebracht hat, der Eingeladene, wem er es verdankt.
DROP POLICY IF EXISTS berkat_referrals_read_mine ON public.berkat_referrals;
CREATE POLICY berkat_referrals_read_mine ON public.berkat_referrals
  FOR SELECT TO authenticated
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

DROP POLICY IF EXISTS berkat_credits_read_own ON public.berkat_shipping_credits;
CREATE POLICY berkat_credits_read_own ON public.berkat_shipping_credits
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS berkat_perks_read_own ON public.berkat_seller_perks;
CREATE POLICY berkat_perks_read_own ON public.berkat_seller_perks
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Zweite Verteidigungslinie: ohne Tabellenrecht kommt ein Aufruf gar nicht
-- erst bis zur Policy (dieselbe Begründung wie 20260814230000).
REVOKE ALL ON TABLE public.berkat_referral_codes   FROM anon;
REVOKE ALL ON TABLE public.berkat_referrals        FROM anon;
REVOKE ALL ON TABLE public.berkat_shipping_credits FROM anon;
REVOKE ALL ON TABLE public.berkat_seller_perks     FROM anon;

-- ─── 6. Code erzeugen ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.berkat_gen_referral_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT string_agg(
           substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1),
           ''
         )
    FROM generate_series(1, 6);
$$;

REVOKE ALL ON FUNCTION public.berkat_gen_referral_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_code text;
  v_try  integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT code INTO v_code FROM public.berkat_referral_codes WHERE user_id = v_uid;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- 32^6 ≈ 1,07 Mrd. Möglichkeiten. Eine Kollision ist auf Jahre unwahrschein-
  -- lich, aber „unwahrscheinlich" ist kein Fehlerbehandlung — deshalb die
  -- Schleife statt eines einzelnen Versuchs.
  LOOP
    v_try  := v_try + 1;
    v_code := public.berkat_gen_referral_code();
    BEGIN
      INSERT INTO public.berkat_referral_codes (user_id, code) VALUES (v_uid, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- Zwei Fälle, ein Fehler: Entweder war der Code schon vergeben (dann
      -- nochmal würfeln), oder ein paralleler Aufruf hat für denselben Nutzer
      -- gerade eine Zeile angelegt (dann ist dessen Code der richtige).
      SELECT code INTO v_code FROM public.berkat_referral_codes WHERE user_id = v_uid;
      IF v_code IS NOT NULL THEN
        RETURN v_code;
      END IF;
    END;

    IF v_try >= 10 THEN
      RAISE EXCEPTION 'code_generation_failed' USING ERRCODE = '22023';
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.get_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;

-- ─── 7. Code einlösen ────────────────────────────────────────────────────────
-- Die vier Sperren, und warum jede einzelne nötig ist:
--
--   1. Kein eigener Code       — sonst schenkt sich jeder selbst den Versand
--   2. Nur einmal, für immer   — der Primärschlüssel auf `invitee_id`
--   3. Nur VOR dem ersten Kauf — sonst trägt jemand nach drei Monaten einen
--                                Code nach und kassiert rückwirkend
--   4. Nur mit Konto           — `auth.uid()`, nicht als Parameter
--
-- Sperre 3 ist die wichtigste und die am wenigsten offensichtliche: Ohne sie
-- könnten sich zwei Konten gegenseitig einladen, nachdem beide längst gekauft
-- haben, und hätten je eine Gutschrift geschenkt bekommen.
CREATE OR REPLACE FUNCTION public.claim_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_inviter uuid;
  v_name    text;
  v_enabled boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT c.user_id INTO v_inviter
    FROM public.berkat_referral_codes c
   WHERE c.code = upper(btrim(p_code));

  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'unknown_code' USING ERRCODE = '22023';
  END IF;
  IF v_inviter = v_uid THEN
    RAISE EXCEPTION 'own_code' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.berkat_referrals WHERE invitee_id = v_uid) THEN
    RAISE EXCEPTION 'already_claimed' USING ERRCODE = '22023';
  END IF;
  -- `cart_id IS NOT NULL` ist die Berkat-Weiche (dieselbe wie in
  -- create-checkout-session und notify_order_shipped): Eine Serlo-Bestellung
  -- soll die Einladung nicht verbrauchen.
  IF EXISTS (
    SELECT 1 FROM public.product_orders
     WHERE buyer_id = v_uid
       AND cart_id IS NOT NULL
       AND status IN ('paid', 'shipped', 'delivered')
  ) THEN
    RAISE EXCEPTION 'too_late' USING ERRCODE = '22023';
  END IF;

  -- Die Verbindung wird IMMER verzeichnet, auch bei abgeschaltetem Bonus.
  -- Genau das ist der Sinn des dunklen Zustands: Ob Einladungen überhaupt
  -- stattfinden, ist die Zahl, die man vor dem Anschalten braucht — und sie
  -- entsteht nur, wenn von Anfang an mitgeschrieben wird.
  INSERT INTO public.berkat_referrals (invitee_id, inviter_id) VALUES (v_uid, v_inviter);

  SELECT buyer_rewards_enabled INTO v_enabled FROM public.berkat_reward_policy WHERE id = 1;

  IF COALESCE(v_enabled, false) THEN
    -- Der Eingeladene bekommt SOFORT — das ist der Anlass, überhaupt zu kommen.
    -- Der Einlader bekommt erst, wenn wirklich bezahlt wurde (Trigger unten).
    -- Diese Asymmetrie IST die Missbrauchssperre: Konten anlegen kostet nichts,
    -- bezahlen schon.
    INSERT INTO public.berkat_shipping_credits (user_id, reason) VALUES (v_uid, 'invited');
  END IF;

  SELECT username INTO v_name FROM public.profiles WHERE id = v_inviter;

  -- `credit_granted` sagt der App, welchen Satz sie anzeigen darf. Ohne das
  -- verspräche die Erfolgsmeldung einen geschenkten Versand, den es nicht gibt.
  RETURN jsonb_build_object(
    'ok', true,
    'inviter_name', v_name,
    'credit_granted', COALESCE(v_enabled, false)
  );
END $$;

REVOKE ALL ON FUNCTION public.claim_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral_code(text) TO authenticated;

-- ─── 8. Was steht mir zu ─────────────────────────────────────────────────────
-- Ein Aufruf für die ganze Seite. Namen statt Zahlen, wo es geht — dieselbe
-- Haltung wie beim Bürgen-System (HANDOFF 15): „amir32 und zwei weitere" sagt
-- mehr als „3".
CREATE OR REPLACE FUNCTION public.get_my_rewards()
RETURNS jsonb
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

  RETURN jsonb_build_object(
    -- Die App darf keinen Gratis-Versand versprechen, den es gerade nicht gibt.
    -- Nur dieses eine Feld verlässt die Policy-Tabelle; die Schwellen bleiben
    -- Betriebswissen (wer sie kennt, reizt sie aus).
    'buyer_rewards_enabled', COALESCE(
      (SELECT buyer_rewards_enabled FROM public.berkat_reward_policy WHERE id = 1), false),
    'min_cart_cents', COALESCE(
      (SELECT min_cart_cents FROM public.berkat_reward_policy WHERE id = 1), 1500),

    'code', (SELECT code FROM public.berkat_referral_codes WHERE user_id = v_uid),

    'invited_by', (
      SELECT p.username
        FROM public.berkat_referrals r
        JOIN public.profiles p ON p.id = r.inviter_id
       WHERE r.invitee_id = v_uid
    ),

    'invited', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'name',    COALESCE(p.username, 'Jemand'),
               'bought',  r.buyer_reward_at  IS NOT NULL,
               'selling', r.seller_reward_at IS NOT NULL
             ) ORDER BY r.created_at DESC)
        FROM public.berkat_referrals r
        JOIN public.profiles p ON p.id = r.invitee_id
       WHERE r.inviter_id = v_uid
    ), '[]'::jsonb),

    'credits_open', (
      SELECT count(*) FROM public.berkat_shipping_credits
       WHERE user_id = v_uid AND consumed_at IS NULL
    ),
    'credits_used', (
      SELECT count(*) FROM public.berkat_shipping_credits
       WHERE user_id = v_uid AND consumed_at IS NOT NULL
    ),

    'perks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'days',      k.days,
               'reason',    k.reason,
               'starts_at', k.starts_at,
               'ends_at',   k.ends_at
             ) ORDER BY k.granted_at DESC)
        FROM public.berkat_seller_perks k
       WHERE k.user_id = v_uid
    ), '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.get_my_rewards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rewards() TO authenticated;

-- ─── 9. Die Kasse: Gutschrift reservieren und als Option ausgeben ────────────
-- Warum eine ZWEITE Funktion neben `get_cart_shipping_options`:
-- Die bestehende ist `STABLE` und wird von der App zum ANZEIGEN gerufen
-- (`lib/useShipping.ts`, „zzgl. Versand ab 4,90 €"). Eine Anzeige darf nichts
-- verbrauchen. Diese hier ist `VOLATILE`, reserviert beim Aufruf und wird
-- ausschließlich von `create-checkout-session` gerufen — also genau einmal,
-- wenn wirklich zur Kasse gegangen wird.
--
-- Alle Zonen werden auf 0 gesetzt, nicht eine zusätzliche Gratis-Zeile
-- angehängt. Grund: Stripe Checkout kann Versandoptionen NICHT ans Lieferland
-- binden (HANDOFF 14) — der Käufer wählt frei. Eine vierte Option „gratis"
-- neben drei bezahlten würde die Zone verlieren, und der Verkäufer wüsste nicht
-- mehr, wohin er packt. So bleibt die Zonenwahl erhalten und ist nur umsonst.
--
-- Nur `service_role`: Die Funktion verbraucht etwas. Ein Client, der sie ruft,
-- könnte seine Gutschrift an einen Korb hängen, den er nie bezahlt — und sie
-- damit verlieren.
CREATE OR REPLACE FUNCTION public.get_cart_shipping_options_for_checkout(p_cart_id uuid)
RETURNS TABLE(country text, label text, cents integer, free boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_buyer  uuid;
  v_seller uuid;
  v_goods  integer;
  v_credit uuid;
  v_min    integer;
BEGIN
  SELECT c.buyer_id, c.seller_id INTO v_buyer, v_seller
    FROM public.auction_carts c
   WHERE c.id = p_cart_id;

  IF v_seller IS NULL THEN
    RETURN;  -- kein Korb, keine Sätze — wie in der STABLE-Schwester
  END IF;

  -- Der Warenwert steht VOR der Gutschrift-Auswahl, weil er darüber
  -- mitentscheidet.
  SELECT COALESCE(SUM(a.current_bid_cents), 0) INTO v_goods
    FROM public.live_auctions a
   WHERE a.cart_id = p_cart_id AND a.status = 'sold';

  -- Hängt schon eine an diesem Korb? Dann die. Die Kasse darf für denselben
  -- Korb zweimal geöffnet werden (abgebrochene Zahlung, Idempotenz-Abfrage in
  -- `checkout_auction_cart`) — beim zweiten Mal darf das keine zweite
  -- Gutschrift kosten.
  SELECT id INTO v_credit
    FROM public.berkat_shipping_credits
   WHERE reserved_cart_id = p_cart_id AND consumed_at IS NULL
   LIMIT 1;

  -- ⚠️ MINDESTWARENWERT. Eine eingelöste Gutschrift kostet 4,83 € (Pauschale
  -- weg, Porto bleibt); die Verlustschwelle liegt bei 6,64 € Warenwert. Ohne
  -- diese Bedingung wäre der häufigste Fall genau der teuerste: Ein Neuer löst
  -- den Code ein und testet mit EINEM Artikel für 1 €. Rechnung im Kopf dieser
  -- Datei.
  --
  -- Bewusst KEINE Fehlermeldung, sondern schlicht keine Reservierung: Die
  -- Gutschrift bleibt dem Käufer erhalten und greift beim nächsten, größeren
  -- Korb. Eine Kasse, die sich wegen eines Bonus nicht öffnet, wäre der
  -- teuerste denkbare Tausch.
  SELECT min_cart_cents INTO v_min FROM public.berkat_reward_policy WHERE id = 1;

  IF v_credit IS NULL AND v_goods >= COALESCE(v_min, 1500) THEN
    UPDATE public.berkat_shipping_credits
       SET reserved_cart_id = p_cart_id
     WHERE id = (
       SELECT id FROM public.berkat_shipping_credits
        WHERE user_id = v_buyer
          AND consumed_at IS NULL
          AND reserved_cart_id IS NULL
        ORDER BY granted_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
    RETURNING id INTO v_credit;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (r.country)
         r.country,
         CASE WHEN v_credit IS NOT NULL
              THEN r.label || ' · geschenkt (Einladung)'
              ELSE r.label END,
         CASE WHEN v_credit IS NOT NULL THEN 0
              WHEN r.free_from_cents IS NOT NULL AND v_goods >= r.free_from_cents THEN 0
              ELSE r.cents END,
         (v_credit IS NOT NULL)
           OR (r.free_from_cents IS NOT NULL AND v_goods >= r.free_from_cents)
    FROM public.berkat_shipping_rates r
   WHERE r.seller_id = v_seller OR r.seller_id IS NULL
   ORDER BY r.country, (r.seller_id IS NULL), r.sort_index;
END $$;

REVOKE ALL ON FUNCTION public.get_cart_shipping_options_for_checkout(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cart_shipping_options_for_checkout(uuid) TO service_role;

-- ─── 10. Spur an der Bestellung ──────────────────────────────────────────────
-- Ohne diese Spalte sähe der Verkäufer eine Bestellung mit `shipping_cents = 0`
-- und der Unterdeckungs-Hinweis aus HANDOFF 14 („der Käufer hat zu wenig
-- Versand gezahlt") würde bei JEDER eingelösten Gutschrift anspringen — für
-- etwas, das die Plattform bezahlt hat, nicht der Käufer.
ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS shipping_credit_applied boolean NOT NULL DEFAULT false;

GRANT SELECT (shipping_credit_applied) ON public.product_orders TO anon, authenticated;

-- ─── 11. Bezahlt → Gutschrift abrechnen ──────────────────────────────────────
-- BEFORE, weil die Funktion `NEW.shipping_credit_applied` setzt. Ein
-- AFTER-Trigger könnte die Zeile nicht mehr ändern.
CREATE OR REPLACE FUNCTION public.berkat_settle_shipping_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit uuid;
BEGIN
  IF NEW.status <> 'paid'
     OR OLD.status IS NOT DISTINCT FROM 'paid'
     OR NEW.cart_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_credit
    FROM public.berkat_shipping_credits
   WHERE reserved_cart_id = NEW.cart_id AND consumed_at IS NULL;

  IF v_credit IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.shipping_cents, 0) = 0 THEN
    UPDATE public.berkat_shipping_credits
       SET consumed_at = now(), consumed_order_id = NEW.id
     WHERE id = v_credit;
    NEW.shipping_credit_applied := true;
  ELSE
    -- Der Käufer hat trotz Gutschrift eine bezahlte Zone gewählt. Stripe lässt
    -- die Wahl frei (HANDOFF 14), und ein Versehen darf keine Belohnung
    -- verbrennen — die Reservierung wird gelöst, die Gutschrift bleibt.
    UPDATE public.berkat_shipping_credits
       SET reserved_cart_id = NULL
     WHERE id = v_credit;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_berkat_settle_shipping_credit ON public.product_orders;
CREATE TRIGGER trg_berkat_settle_shipping_credit
  BEFORE UPDATE OF status ON public.product_orders
  FOR EACH ROW EXECUTE FUNCTION public.berkat_settle_shipping_credit();

-- ─── 12. Bezahlt → der Einlader verdient ─────────────────────────────────────
-- Erst hier, nicht beim Anlegen des Kontos: Ein Konto anzulegen kostet nichts,
-- eine Zahlung schon. Das ist die einzige Sperre, die eine Einladungs-Farm
-- wirklich unwirtschaftlich macht.
CREATE OR REPLACE FUNCTION public.berkat_pay_out_buyer_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inviter   uuid;
  v_policy    public.berkat_reward_policy;
  v_converted integer;
  v_this_month integer;
BEGIN
  IF NEW.status <> 'paid'
     OR OLD.status IS NOT DISTINCT FROM 'paid'
     OR NEW.cart_id IS NULL
     OR NEW.buyer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Einzelne Anweisung statt SELECT-dann-UPDATE: Die Bedingung
  -- `buyer_reward_at IS NULL` im UPDATE ist die Sperre gegen doppelte
  -- Auszahlung, auch wenn zwei Zahlungen gleichzeitig durchgehen.
  --
  -- Der Zeitstempel wird auch bei abgeschaltetem Bonus gesetzt: Er beantwortet
  -- „hat der Geworbene je gekauft" und ist damit genau die Kennzahl, die vor
  -- dem Anschalten fehlt.
  UPDATE public.berkat_referrals
     SET buyer_reward_at = now()
   WHERE invitee_id = NEW.buyer_id
     AND buyer_reward_at IS NULL
  RETURNING inviter_id INTO v_inviter;

  IF v_inviter IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_policy FROM public.berkat_reward_policy WHERE id = 1;
  IF NOT COALESCE(v_policy.buyer_rewards_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- SCHWELLE: Die Gutschrift des Werbers ist ein Rabatt an einen Bestandskunden
  -- und kauft keine Neukunden. Erst ab dem n-ten geworbenen KÄUFER (nicht: dem
  -- n-ten angelegten Konto) ist sie aus deren Erstbestellungen bezahlt.
  SELECT count(*) INTO v_converted
    FROM public.berkat_referrals
   WHERE inviter_id = v_inviter AND buyer_reward_at IS NOT NULL;

  IF v_converted < v_policy.inviter_reward_after THEN
    RETURN NEW;
  END IF;

  -- DECKEL je Kalendermonat. Ohne ihn wäre die Verbindlichkeit unbegrenzt.
  SELECT count(*) INTO v_this_month
    FROM public.berkat_shipping_credits
   WHERE user_id = v_inviter
     AND reason = 'invite_paid'
     AND granted_at >= date_trunc('month', now());

  IF v_this_month >= v_policy.monthly_cap THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.berkat_shipping_credits (user_id, reason)
  VALUES (v_inviter, 'invite_paid');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_berkat_pay_out_buyer_referral ON public.product_orders;
CREATE TRIGGER trg_berkat_pay_out_buyer_referral
  AFTER UPDATE OF status ON public.product_orders
  FOR EACH ROW EXECUTE FUNCTION public.berkat_pay_out_buyer_referral();

-- ─── 13. Verkauft → beide bekommen provisionsfrei ────────────────────────────
-- Ausgelöst vom ersten echten VERKAUF, nicht vom ersten Live-Gehen. Eine Show
-- aufzumachen ist kostenlos und beweist nichts; etwas zu verkaufen ist der
-- Beleg, dass ein Verkäufer wirklich einer ist.
--
-- `live_auctions` gehört allein Berkat (20260813150000) — anders als
-- `live_sessions` braucht dieser Trigger deshalb keinen `app`-Filter.
CREATE OR REPLACE FUNCTION public.berkat_pay_out_seller_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inviter uuid;
BEGIN
  IF NEW.status <> 'sold'
     OR OLD.status IS NOT DISTINCT FROM 'sold'
     OR NEW.seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.berkat_referrals
     SET seller_reward_at = now()
   WHERE invitee_id = NEW.seller_id
     AND seller_reward_at IS NULL
  RETURNING inviter_id INTO v_inviter;

  IF v_inviter IS NULL THEN
    RETURN NEW;
  END IF;

  -- Beide Seiten. Der Geworbene bekommt es, weil es das Versprechen war, mit
  -- dem man ihn geholt hat; der Werber, weil er die Arbeit hatte.
  INSERT INTO public.berkat_seller_perks (user_id, kind, days, reason) VALUES
    (v_inviter,      'commission_free', 30, 'Du hast einen Verkäufer gebracht'),
    (NEW.seller_id,  'commission_free', 30, 'Über eine Einladung gekommen');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_berkat_pay_out_seller_referral ON public.live_auctions;
CREATE TRIGGER trg_berkat_pay_out_seller_referral
  AFTER UPDATE OF status ON public.live_auctions
  FOR EACH ROW EXECUTE FUNCTION public.berkat_pay_out_seller_referral();

-- Trigger-Funktionen sind per RPC nicht aufrufbar; PUBLIC-EXECUTE trotzdem weg,
-- damit sie in der nächsten anon-Prüfung nicht als Befund auftauchen
-- (dieselbe Hygiene wie 20260814180000).
REVOKE ALL ON FUNCTION public.berkat_settle_shipping_credit()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.berkat_pay_out_buyer_referral()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.berkat_pay_out_seller_referral()  FROM PUBLIC, anon, authenticated;

COMMIT;

-- ─── Anschalten, wenn die Zahlen es hergeben ─────────────────────────────────
-- Der Käufer-Bonus rechnet sich erst ab der ZWEITEN Bestellung eines geworbenen
-- Käufers. Vorher ist er eine Wette auf eine Wiederkaufsrate, die niemand kennt.
-- Was vor dem Umlegen auf dem Tisch liegen sollte:
--
--   SELECT count(*) FILTER (WHERE buyer_reward_at IS NOT NULL) AS haben_gekauft,
--          count(*)                                            AS eingeladen
--     FROM public.berkat_referrals;
--
-- Und die eigentliche Frage — kaufen Geworbene ein zweites Mal:
--
--   SELECT r.invitee_id, count(o.id) AS bestellungen
--     FROM public.berkat_referrals r
--     JOIN public.product_orders o
--       ON o.buyer_id = r.invitee_id AND o.cart_id IS NOT NULL
--      AND o.status IN ('paid','shipped','delivered')
--    GROUP BY r.invitee_id;
--
-- Stehen dort mehrheitlich Zweien, lohnt es sich:
--
--   UPDATE public.berkat_reward_policy SET buyer_rewards_enabled = true;
--
-- ⚠️ Vor Phase 2 (Drittverkäufer) wieder ausschalten oder neu bepreisen —
-- ohne eigene Warenmarge trägt die Rechnung nicht (Begründung oben).

-- ─── Was bewusst NICHT drin ist ──────────────────────────────────────────────
-- • **Kein Ablaufdatum auf Gutschriften.** Eine Frist ist genau die
--   Streak-Angst, die das Design-Gesetz unter Punkt 4 verbietet. Wer seine
--   Gutschrift in vier Monaten einlöst, hat sie genauso verdient.
-- • **Keine Staffel („ab 5 Einladungen …").** Staffeln erzeugen den Druck,
--   Menschen zu werben, die man gar nicht überzeugen will — in einer engen
--   Community ist das der schnellste Weg, den eigenen Namen zu verbrennen.
-- • **Kein Zufall.** Keine Lose, keine Überraschungs-Belohnung. Genau diese
--   Linie ist der Grund, warum Whatnot seit März 2026 in Schiedsverfahren
--   steckt (HANDOFF 1).
-- • **Keine Provisions-Abrechnung.** Diese Migration verzeichnet nur den
--   Anspruch. Wer Provision einführt, liest `berkat_seller_perks` und setzt
--   dabei `starts_at`/`ends_at` — das ist Phase 2 (Stripe Connect).
