-- Migration: Тейп / Clan-Feld im Profil
-- Datum: 2026-04-08
-- Beschreibung: Fügt das tschetschenische Clan-Feld (Тейп) zum Profil hinzu.
--               Optional, frei wählbar aus einer Liste bekannter Тейпs.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS teip TEXT DEFAULT NULL;

-- Index für zukünftige Filter-Funktion ("Zeige User aus Тейп X")
CREATE INDEX IF NOT EXISTS profiles_teip_idx ON profiles (teip)
  WHERE teip IS NOT NULL;
