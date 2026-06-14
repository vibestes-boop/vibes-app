-- ================================================
-- VIBES APP – Onboarding
-- Ausführen im Supabase SQL Editor
-- ================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
