-- Trinkgeld in Berkat — echtes Geld, nicht Coins.
--
-- WARUM NICHT `creator_tips`: Die Tabelle gibt es seit dem 22.04.2026, sie führt
-- aber `coin_amount` und hängt damit an Serlos Coin-Guthaben. Für Berkat ist das
-- ausgeschlossen: Coins als Zahlmittel wären E-Geld und lizenzpflichtig (siehe
-- apps/berkat/HANDOFF.md, „Vor dem ersten fremden Verkäufer"). Ein Trinkgeld ist
-- dagegen eine gewöhnliche Zahlung — sie läuft denselben Stripe-Weg wie ein
-- Sammelkorb.
--
-- ABGRENZUNG, die tragen muss: Ein Trinkgeld ist KEIN Kauf. Es entsteht keine
-- Ware, kein Versand, kein Widerrufsrecht, kein Sammelkorb. Deshalb eine eigene
-- Tabelle statt einer Sonderzeile in `product_orders` — dort hängen Versand,
-- Streitfälle und Bewertungen dran, die für ein Trinkgeld alle sinnlos wären.
--
-- Solange Zaur Betreiber UND Verkäufer ist, landet das Geld ohnehin auf seinem
-- Stripe-Konto. Beim ersten Drittverkäufer greift dieselbe Regel wie beim
-- Warenverkauf: Stripe Connect, niemals selbst weiterleiten (ZAG).

BEGIN;

CREATE TABLE IF NOT EXISTS public.berkat_tips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Aus welcher Show heraus. Nur Herkunft, kein Zwang: Ein Trinkgeld vom
  -- Profil aus ist genauso gültig.
  session_id    uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,

  -- Ober- und Untergrenze stehen hier, nicht im Client. Ein Betrag ist Geld,
  -- und Geld wird serverseitig geprüft — 1 € bis 500 €.
  amount_cents  int  NOT NULL CHECK (amount_cents BETWEEN 100 AND 50000),
  currency      text NOT NULL DEFAULT 'eur',
  message       text CHECK (message IS NULL OR char_length(message) <= 140),

  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'paid', 'cancelled')),
  stripe_session_id text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  paid_at       timestamptz,

  -- Sich selbst Trinkgeld zu geben wäre Geldwäsche-Theater und ein
  -- Gebühren-Verlust. Auf Tabellenebene, nicht nur im Client.
  CONSTRAINT berkat_tips_not_self CHECK (sender_id <> recipient_id)
);

COMMENT ON TABLE public.berkat_tips IS
  'Trinkgeld in Berkat, in echtem Geld über Stripe. Kein Kauf: keine Ware, kein '
  'Versand, kein Widerruf. Coins sind in Berkat ausgeschlossen, deshalb nicht '
  'creator_tips.';

-- Was ein Verkäufer sehen will: seine bezahlten Trinkgelder, neueste zuerst.
CREATE INDEX IF NOT EXISTS berkat_tips_recipient_paid
  ON public.berkat_tips (recipient_id, paid_at DESC)
  WHERE status = 'paid';

-- Der Weg, auf dem der Webhook die Zeile wiederfindet.
CREATE INDEX IF NOT EXISTS berkat_tips_stripe_session
  ON public.berkat_tips (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Kein USING(true). Ein Trinkgeld geht zwei Menschen etwas an, sonst niemandem —
-- die Beträge fremder Leute sind nichts, was ein Dritter zählen können soll.
ALTER TABLE public.berkat_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS berkat_tips_select ON public.berkat_tips;
CREATE POLICY berkat_tips_select ON public.berkat_tips
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Schreiben ausschließlich über die RPC unten bzw. den Service-Role-Schlüssel
-- im Webhook. Ein direkter INSERT könnte Betrag und Empfänger frei wählen und
-- „bezahlt" gleich mitsetzen.
REVOKE INSERT, UPDATE, DELETE ON public.berkat_tips FROM anon, authenticated;

-- ─── Anlegen ─────────────────────────────────────────────────────────────────
-- Gibt die Zeile im Zustand 'pending' zurück. Bezahlt wird sie erst, wenn
-- Stripe es bestätigt — der Client kann das nicht behaupten.
CREATE OR REPLACE FUNCTION public.create_berkat_tip(
  p_recipient_id uuid,
  p_amount_cents int,
  p_message      text DEFAULT NULL,
  p_session_id   uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_id     uuid;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_recipient_id IS NULL THEN
    RAISE EXCEPTION 'recipient_missing' USING ERRCODE = '22023';
  END IF;
  IF p_recipient_id = v_sender THEN
    RAISE EXCEPTION 'cannot_tip_self' USING ERRCODE = '22023';
  END IF;
  -- Die Grenzen stehen zusätzlich im CHECK. Hier für eine Fehlermeldung, die
  -- der Client übersetzen kann, statt einer nackten Constraint-Verletzung.
  IF p_amount_cents IS NULL OR p_amount_cents < 100 OR p_amount_cents > 50000 THEN
    RAISE EXCEPTION 'amount_out_of_range' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RAISE EXCEPTION 'recipient_not_found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.berkat_tips (sender_id, recipient_id, session_id, amount_cents, message)
  VALUES (v_sender, p_recipient_id, p_session_id, p_amount_cents, nullif(btrim(p_message), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- Rechte ausdrücklich setzen. Am 14.08.2026 hat ein DROP+CREATE die Rechte von
-- `credit_coins` still an PUBLIC (inkl. anon) zurückgegeben — seither wird das
-- bei jeder Geld-Funktion hingeschrieben, nicht angenommen.
REVOKE ALL ON FUNCTION public.create_berkat_tip(uuid, int, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_berkat_tip(uuid, int, text, uuid) TO authenticated;

COMMIT;

-- ─── Danach ──────────────────────────────────────────────────────────────────
-- Diese Migration allein reicht nicht. Zwei Edge Functions müssen neu
-- ausgerollt werden, sonst führt der Knopf ins Leere:
--
--     supabase functions deploy create-checkout-session
--     supabase functions deploy stripe-webhook
--
-- ⚠️ `stripe-webhook` MUSS mit `--no-verify-jwt` deployt werden. Ohne das legt
-- Supabase ein JWT-Gate davor, Stripe bekommt 401 und die Zahlung bleibt still
-- unbestätigt — der Fehler ist im Repo dokumentiert und schon einmal passiert.
