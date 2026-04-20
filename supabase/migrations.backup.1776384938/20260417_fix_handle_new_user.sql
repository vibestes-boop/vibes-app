-- FIX für alten TestFlight-Build:
-- Der Trigger on_auth_user_created erstellt das Profil automatisch.
-- Der alte App-Code versucht dann erneut ein INSERT → Konflikt → Fehler.
-- 
-- Lösung: Trigger deaktivieren → nur der App-Code erstellt das Profil.
-- Der on_profile_created_create_wallet Trigger bleibt aktiv.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Wallet-Trigger bleibt (feuert wenn App-Code das Profil erstellt)
-- create_user_wallet() Funktion bleibt mit ON CONFLICT DO NOTHING
