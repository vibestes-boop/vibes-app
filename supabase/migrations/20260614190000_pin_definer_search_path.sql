-- Sicherheits-Härtung: search_path für SECURITY-DEFINER-Funktionen pinnen.
--
-- Hintergrund: Eine SECURITY-DEFINER-Funktion OHNE gepinnten search_path läuft
-- mit dem search_path des AUFRUFERS. Ein Angreifer kann seinen search_path so
-- setzen, dass unqualifizierte Referenzen (z. B. `profiles` statt
-- `public.profiles`) in ein von ihm kontrolliertes Schema umgebogen werden →
-- Privilege-Escalation, da die Funktion mit Definer-Rechten läuft.
-- (Supabase-Linter: "Function Search Path Mutable".)
--
-- Audit am 2026-06-14: 177 DEFINER-Funktionen, 45 davon ungepinnt — inkl.
-- geldkritischer (credit_coins, send_gift, send_creator_tip,
-- admin_update_payout_status, create_user_wallet …).
--
-- Fix: search_path auf `public, extensions` pinnen (pg_catalog wird ohnehin
-- implizit zuerst durchsucht). NICHT `''`, weil die Funktions-Bodies public-
-- Objekte unqualifiziert referenzieren — leerer Pfad würde sie brechen.
-- `extensions` deckt pgcrypto/uuid-ossp etc. ab.
--
-- Idempotent + selbst-zielend: pinnt NUR DEFINER-Funktionen in `public` ohne
-- bestehende search_path-Konfiguration. Mehrfaches Ausführen ist harmlos.
--
-- Anwenden (kein Docker nötig): diesen SQL-Block im Supabase-Dashboard →
-- SQL Editor einfügen und ausführen. Danach Gift-/Coin-Flows kurz testen.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef                                  -- SECURITY DEFINER
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', r.sig);
    RAISE NOTICE 'gepinnt: %', r.sig;
  END LOOP;
END $$;
