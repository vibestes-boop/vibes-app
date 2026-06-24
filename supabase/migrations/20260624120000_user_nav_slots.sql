-- 20260624120000_user_nav_slots.sql
-- Persistente Bottom-Nav-Konfiguration pro User — App + Web teilen sie.
--
-- Die anpassbare Tab-Bar (lib/tabBarStore) hat feste Slots 1/3/5 (Feed/Create/
-- Profil) und wählbare Slots 2 + 4. Bisher lag die Wahl nur lokal im Telefon
-- (AsyncStorage) → die Web-Seite konnte sie nicht spiegeln. Diese zwei Spalten
-- machen die Wahl geräteübergreifend (Mobile schreibt, Web liest).
--
-- NULL = noch nie gesetzt → App/Web fallen auf die Defaults (guild / shop) zurück.
-- Werte = TabFeature-Strings aus lib/tabBarStore.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nav_slot_2 text,
  ADD COLUMN IF NOT EXISTS nav_slot_4 text;

-- Integritäts-Guard: nur bekannte Feature-Keys (oder NULL).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_nav_slot_2_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_nav_slot_2_check
    CHECK (nav_slot_2 IS NULL OR nav_slot_2 IN
      ('guild','messages','shop','explore','notifications','live','women_only'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_nav_slot_4_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_nav_slot_4_check
    CHECK (nav_slot_4 IS NULL OR nav_slot_4 IN
      ('guild','messages','shop','explore','notifications','live','women_only'));

-- RLS: kein neuer Policy nötig — die bestehende Self-Update-Policy
-- (`auth.uid() = id`) und der Self-Read decken die neuen Spalten ab.

COMMENT ON COLUMN public.profiles.nav_slot_2 IS
  'Bottom-Nav Slot 2 (links vom Create-Button). TabFeature-Key. NULL = Default guild.';
COMMENT ON COLUMN public.profiles.nav_slot_4 IS
  'Bottom-Nav Slot 4 (rechts vom Create-Button). TabFeature-Key. NULL = Default shop.';
