-- ═══════════════════════════════════════════════════════════════════════════
-- Der Verkäufer darf sehen, WELCHES Stripe-Konto verbunden ist
-- 22.09.2026 · Berkat
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `20260827100000` hat die Kontokennung bewusst zurückgehalten:
--
--     „Die Konto-ID kommt bewusst NICHT zurück: Der Client braucht sie
--      nirgends — er zeigt einen Zustand an, er ruft Stripe nicht selbst."
--
-- Das stimmte für den Client. Es stimmte nicht für den **Menschen davor**, und
-- am 22.09.2026 hat genau das Geld gekostet — fast echtes:
--
-- Zaur wollte nachsehen, ob seine Zahlung angekommen ist. In Stripes Dashboard
-- fand er das verbundene Konto nicht (es liegt in der **Sandbox**, nicht im
-- Hauptkonto — siehe die Warnung in Übergabe 99). Ohne eine Kennung, nach der
-- man suchen kann, sah es aus, als gäbe es das Konto gar nicht. Er fragte
-- daraufhin, ob er **sein echtes privates Stripe-Konto** verbinden solle.
--
-- ⚠️ Eine Kennung, die man nirgends nachschlagen kann, ist keine Vorsicht,
-- sondern eine Einladung zu raten. Und beim Geld rät niemand gut.
--
-- ⚠️ `acct_…` IST KEIN GEHEIMNIS. Sie steht in Stripes eigenen Adresszeilen,
-- auf Belegen und in jeder Connect-Oberfläche. Geheim sind die Schlüssel, nicht
-- die Kennung. Der Zugriff bleibt trotzdem eng: Die Funktion ist SECURITY
-- DEFINER und liest ausschliesslich `auth.uid()` — jeder sieht nur die eigene.
--
-- ⚠️ SIGNATUR UNVERÄNDERT, nur der Rückgabe-Inhalt wächst. Die Funktion nimmt
-- keine Argumente; es entsteht keine zweite Überladung und damit auch kein
-- `HTTP 300` (die Falle aus `20260814…`). Ein zusätzlicher Schlüssel in einem
-- `jsonb` ist für ältere Clients folgenlos — sie lesen ihn einfach nicht.

CREATE OR REPLACE FUNCTION public.get_my_stripe_connect()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.berkat_seller_stripe%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.berkat_seller_stripe WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'none');
  END IF;

  RETURN jsonb_build_object(
    'state', CASE
               WHEN v_row.charges_enabled       THEN 'ready'
               WHEN v_row.details_submitted     THEN 'pending'
               ELSE                                  'incomplete'
             END,
    'disabled_reason', v_row.disabled_reason,
    'connected_at',    v_row.connected_at,
    -- NEU am 22.09.2026 — siehe Kopf.
    'account_id',      v_row.stripe_account_id
  );
END $$;

-- ⚠️ Rechte ausdrücklich neu setzen. `CREATE OR REPLACE` behält sie nicht über
-- alle Postgres-Versionen garantiert — dieselbe Vorsicht wie in
-- `20260419250000`, und der Grund, warum `credit_coins` am 14.08. plötzlich
-- wieder für `anon` aufrufbar war.
REVOKE ALL ON FUNCTION public.get_my_stripe_connect() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_stripe_connect() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- GEGENPROBEN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Die Kennung kommt zurück (aus einer angemeldeten Sitzung):
--      SELECT public.get_my_stripe_connect() -> 'account_id';
--
-- 2. `anon` darf sie NICHT rufen (muss 42501 geben):
--      curl -s "$URL/rest/v1/rpc/get_my_stripe_connect" -X POST -H "apikey: $ANON"
--
-- 3. Niemand sieht eine fremde Kennung — die Funktion kennt nur `auth.uid()`.
--    Es gibt keinen Parameter, mit dem man danach fragen könnte.
