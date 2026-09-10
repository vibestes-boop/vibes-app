-- ═══════════════════════════════════════════════════════════════════════════
-- Läuft der Nachtdienst wirklich? Eine Frage, die man stellen können muss
-- 10.09.2026 · Berkat · Übergabe Abschnitt 100
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WARUM
-- -----
-- Der Nachtdienst aus `20260910120000` ruft über pg_net eine Edge Function.
-- Das ist fire-and-forget: Die Datenbank schickt los und sieht nie nach, was
-- zurückkam. Genau darin liegt die Gefahr — scheitert der Ruf, passiert nichts
-- Sichtbares:
--
--   * 401 → der Vault-Schlüssel ist als JWT nicht mehr gültig
--   * 403 → er ist gültig, stimmt aber nicht mehr mit
--           `SUPABASE_SERVICE_ROLE_KEY` in der Function überein (Rotation!)
--   * 404 → die Function ist nicht (mehr) ausgerollt
--
-- In allen drei Fällen klingelt der Wecker alle 15 Minuten, und niemand erfährt,
-- dass Bestellungen liegen bleiben. Dieses Projekt hat genau diese Sorte Fehler
-- schon dreimal bezahlt (R2-Aufräumer sieben Wochen, `live_sessions.updated_at`,
-- Web-Push).
--
-- ── WARUM EINE EIGENE ZEILE JE RUF ──────────────────────────────────────────
-- Naheliegend wäre, `net._http_response` einfach nach unserer URL zu filtern.
-- Das geht nicht: pg_net **löscht** den Auftrag aus `net.http_request_queue`,
-- sobald er verschickt ist — die Antwort-Tabelle kennt nur noch eine Nummer,
-- keinen Empfänger. Ein Join auf die Warteschlange träfe deshalb immer ins
-- Leere und meldete „keine Antwort", während in Wahrheit alles lief.
--
-- Also merkt sich `berkat_ask_stripe` die Ruf-Nummer selbst. Das beantwortet
-- nebenbei eine zweite Frage, die `net._http_response` nicht beantworten kann:
-- „Wann hat der Wecker zuletzt überhaupt geklingelt?" — auch dann, wenn pg_net
-- seine Antworten längst aufgeräumt hat.
--
--     SELECT * FROM public.berkat_night_service_health();

BEGIN;

-- ─── 1. Das Fahrtenbuch ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.berkat_night_service_log (
  id         bigserial PRIMARY KEY,
  request_id bigint      NOT NULL,
  sweep      text        NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_berkat_night_service_log_sent
  ON public.berkat_night_service_log (sent_at DESC);

-- Betreiber-Wissen, kein Nutzer-Wissen. RLS an und KEINE Policy: Damit kommt
-- über PostgREST niemand heran, auch nicht lesend.
ALTER TABLE public.berkat_night_service_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.berkat_night_service_log FROM anon, authenticated;


-- ─── 2. Der Wecker führt jetzt Buch ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.berkat_ask_stripe(p_sweep text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'vault', 'net', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_key text;
  v_req bigint;
BEGIN
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
   WHERE name = 'service_role_key'
   LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING 'berkat_ask_stripe: service_role_key fehlt im Vault — übersprungen';
    RETURN;
  END IF;

  v_req := net.http_post(
    url     := 'https://llymwqfgujwkoxzqxrlm.supabase.co/functions/v1/berkat-confirm-payment',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('sweep', p_sweep),
    timeout_milliseconds := 30000
  );

  INSERT INTO public.berkat_night_service_log (request_id, sweep)
  VALUES (v_req, p_sweep);

  -- Das Buch bleibt dünn. Vierzehn Tage reichen, um „läuft es?" zu beantworten;
  -- alles darüber wäre eine Tabelle, die nur wächst und die niemand liest.
  DELETE FROM public.berkat_night_service_log
   WHERE sent_at < now() - interval '14 days';
EXCEPTION WHEN OTHERS THEN
  -- Bleibt eine Warnung — ein klemmender Wecker darf den Cron-Lauf nicht rot
  -- färben. Aber mit SQLSTATE: Wer den Fehler doch einmal sucht, soll nicht
  -- raten müssen, WARUM es nicht ging.
  RAISE WARNING 'berkat_ask_stripe(%) fehlgeschlagen [%]: %', p_sweep, SQLSTATE, SQLERRM;
END $$;

ALTER FUNCTION public.berkat_ask_stripe(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.berkat_ask_stripe(text) FROM PUBLIC, anon, authenticated;


-- ─── 3. Der Bericht ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.berkat_night_service_health()
RETURNS TABLE (
  wann     timestamptz,
  auftrag  text,
  status   int,
  befund   text
)
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'net', 'extensions', 'pg_temp'
AS $$
  SELECT
    l.sent_at,
    l.sweep,
    r.status_code,
    CASE
      WHEN r.id IS NULL      THEN '⏳ losgeschickt, Antwort noch nicht da (oder schon aufgeräumt)'
      WHEN r.status_code = 200 THEN '✅ angekommen und angenommen'
      WHEN r.status_code = 401 THEN '❌ abgewiesen — Vault-Schlüssel als JWT ungültig'
      WHEN r.status_code = 403 THEN '❌ abgewiesen — Vault-Schlüssel ≠ SUPABASE_SERVICE_ROLE_KEY (rotiert?)'
      WHEN r.status_code = 404 THEN '❌ Function nicht ausgerollt'
      WHEN r.status_code IS NULL THEN '❌ keine Antwort — ' || COALESCE(r.error_msg, 'Zeitüberschreitung')
      ELSE '⚠️ unerwartet ' || r.status_code || ': ' || COALESCE(left(r.content, 200), '')
    END
    FROM public.berkat_night_service_log l
    LEFT JOIN net._http_response r ON r.id = l.request_id
   ORDER BY l.sent_at DESC
   LIMIT 20;
$$;

ALTER FUNCTION public.berkat_night_service_health() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.berkat_night_service_health() FROM PUBLIC, anon, authenticated;

COMMIT;


-- ─── 4. Jetzt einmal wirklich klingeln lassen ──────────────────────────────
--
-- ⚠️ Eigene Transaktion, und das ist kein Schönheitsfehler: pg_net legt den Ruf
-- in eine Warteschlange, die ein Hintergrund-Arbeiter abholt. Der sieht die
-- Zeile erst NACH dem COMMIT. Ein `pg_sleep` in derselben Transaktion würde
-- also warten, bis der Auftrag existiert — und der entsteht erst, wenn das
-- Warten vorbei ist.

BEGIN;
SELECT public.berkat_ask_stripe('accounts');
COMMIT;

SELECT pg_sleep(12);

DO $$
DECLARE
  r record;
  v_found boolean := false;
BEGIN
  FOR r IN SELECT * FROM public.berkat_night_service_health() LIMIT 3 LOOP
    v_found := true;
    RAISE NOTICE '% | %  →  %', r.wann, r.auftrag, r.befund;
  END LOOP;

  IF NOT v_found THEN
    RAISE WARNING '⚠️  Kein Eintrag im Fahrtenbuch — der Wecker hat gar nicht erst geschickt.';
  END IF;
END $$;
