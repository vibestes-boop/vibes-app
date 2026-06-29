-- 20260629190000_referrals.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- #5 Referral-Loop — Tracking-Grundlage (Einladung + Attribution + Zähler).
--
-- BEWUSST OHNE Belohnungs-Engine: Rabatte/Provisionen bleiben Zaurs manuelle
-- Entscheidung (Plan: „erst manuell, dann bauen"). Diese Migration trackt nur
-- WER WEN geworben hat (profiles.referred_by) — Belohnungen kann man später
-- darauf aufsetzen.
--
-- Einladungslink: serlo-web.vercel.app/i/<username>. Öffnet der Eingeladene den
-- Link (Web), wird die Attribution per Server-Action gesetzt (one-time).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by
  ON public.profiles (referred_by)
  WHERE referred_by IS NOT NULL;

-- Attribution setzen (one-time, kein Überschreiben, kein Selbst-Referral).
-- p_code = Username des Werbers (case-insensitive).
CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_ref uuid;
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Schon attribuiert → nichts tun (idempotent, kein Überschreiben).
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_me AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('success', true, 'already', true);
  END IF;

  SELECT id INTO v_ref
    FROM public.profiles
   WHERE lower(username) = lower(btrim(p_code));

  IF v_ref IS NULL OR v_ref = v_me THEN
    RETURN jsonb_build_object('error', 'invalid_code');
  END IF;

  UPDATE public.profiles
     SET referred_by = v_ref
   WHERE id = v_me AND referred_by IS NULL;

  RETURN jsonb_build_object('success', true, 'referrer', v_ref);
END $$;

REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

-- Wie viele habe ich geworben? (für die „Freunde einladen"-Fläche)
CREATE OR REPLACE FUNCTION public.get_my_referral_count()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT count(*)::int FROM public.profiles WHERE referred_by = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_referral_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_count() TO authenticated;
