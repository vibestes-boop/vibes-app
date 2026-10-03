-- ═══════════════════════════════════════════════════════════════════════════
-- `berkat_ask_stripe` kam nicht an den Vault — und hätte es nie gesagt
-- 10.09.2026 · Berkat · Übergabe Abschnitt 100
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WAS SCHIEFGING
-- --------------
-- `20260910120000` legte `berkat_ask_stripe(text)` mit
--
--     SET search_path = public, pg_temp
--
-- an und las darin `vault.decrypted_secrets`. Der Name ist voll qualifiziert,
-- also sieht es richtig aus. Ist es aber nicht: Die View entschlüsselt intern
-- über Funktionen, die in `vault`/`extensions` liegen — stehen die nicht im
-- Suchpfad, scheitert der Lesevorgang.
--
-- Und darüber saß:
--
--     EXCEPTION WHEN OTHERS THEN RAISE WARNING …
--
-- Zusammen ergibt das eine Schweigemaschine: Der Wecker klingelt alle 15
-- Minuten, die Funktion scheitert an derselben Zeile, quittiert mit einer
-- Warnung, die niemand liest — und der Nachtdienst tut für immer nichts.
-- Dieselbe Familie wie der R2-Aufräumer, der sieben Wochen lang stumm war, und
-- wie `live_sessions.updated_at`, das es gar nicht gab.
--
-- ⚠️ **Der Fehler wäre nicht aufgefallen, weil er wie Erfolg aussieht.**
-- `db push` lief durch, die Wecker stehen, die Function ist ausgerollt, jede
-- einzelne Prüfung grün — und trotzdem nichts.
--
-- Gefunden nicht durch Nachdenken, sondern durch Nachsehen: Im Repo lesen
-- SECHS Funktionen aus dem Vault, und **alle sechs** setzen
-- `search_path TO 'public', 'vault', 'extensions', 'pg_temp'`. Der Satz steht
-- sogar im Kopf von `20260814220000`: „`vault` muss dafür in den search_path —
-- sonst findet die Funktion die View nicht, und der EXCEPTION-Block würde den
-- Fehler stumm schlucken." Wortwörtlich diese Falle, ein zweites Mal.

BEGIN;

-- ─── 1. Derselbe Rumpf, richtiger Suchpfad ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.berkat_ask_stripe(p_sweep text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'vault', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
   WHERE name = 'service_role_key'
   LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING 'berkat_ask_stripe: service_role_key fehlt im Vault — übersprungen';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := 'https://llymwqfgujwkoxzqxrlm.supabase.co/functions/v1/berkat-confirm-payment',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('sweep', p_sweep),
    timeout_milliseconds := 30000
  );
EXCEPTION WHEN OTHERS THEN
  -- Bleibt eine Warnung — ein klemmender Wecker darf den Cron-Lauf nicht rot
  -- färben. Aber jetzt mit SQLSTATE: Wer den Fehler doch einmal sucht, soll
  -- nicht raten müssen, WARUM es nicht ging.
  RAISE WARNING 'berkat_ask_stripe(%) fehlgeschlagen [%]: %', p_sweep, SQLSTATE, SQLERRM;
END $$;

ALTER FUNCTION public.berkat_ask_stripe(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.berkat_ask_stripe(text) FROM PUBLIC, anon, authenticated;


-- ─── 2. Beweis beim Einspielen, nicht Hoffnung ─────────────────────────────
--
-- Genau der Schritt, der vorhin gefehlt hat. Gemessen wird die LÄNGE des
-- Schlüssels, niemals sein Wert — dieses Repo ist öffentlich, und ein Geheimnis
-- ist schon einmal in einem Terminal gelandet, wo es nicht hingehörte.

DO $$
DECLARE
  v_len int;
BEGIN
  SELECT length(decrypted_secret) INTO v_len
    FROM vault.decrypted_secrets
   WHERE name = 'service_role_key'
   LIMIT 1;

  IF v_len IS NULL THEN
    RAISE WARNING '⚠️  Vault: service_role_key NICHT lesbar — der Nachtdienst bleibt stumm!';
  ELSE
    RAISE NOTICE '✅ Vault: service_role_key lesbar (% Zeichen)', v_len;
  END IF;
END $$;


-- ─── 3. Und stehen die Wecker wirklich? ────────────────────────────────────

DO $$
DECLARE
  r record;
  v_found int := 0;
BEGIN
  FOR r IN
    SELECT jobname, schedule, active FROM cron.job
     WHERE jobname IN ('berkat-confirm-payments', 'berkat-confirm-accounts')
     ORDER BY jobname
  LOOP
    v_found := v_found + 1;
    RAISE NOTICE '✅ Wecker % — % (aktiv: %)', r.jobname, r.schedule, r.active;
  END LOOP;

  IF v_found <> 2 THEN
    RAISE WARNING '⚠️  Nur % von 2 Weckern gefunden', v_found;
  END IF;
END $$;

COMMIT;
