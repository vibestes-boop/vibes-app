-- Wer hat kein Profil? Nur lesen.
--
-- Zeigt Konten in auth.users ohne Zeile in public.profiles. Genau diese Nutzer
-- sind angemeldet, haben aber keinen Benutzernamen, keine Geldbörse, und jede
-- Aktion mit Fremdschlüssel auf profiles schlägt bei ihnen fehl.
--
-- An der Spalte `angemeldet_am` lässt sich ablesen, ob es Altlasten aus der
-- Testphase sind oder echte Registrierungen nach dem 17.04.2026 — dem Tag, an
-- dem der Trigger entfernt wurde.

SELECT u.email,
       u.created_at                                   AS angemeldet_am,
       u.email_confirmed_at IS NOT NULL               AS bestaetigt,
       u.last_sign_in_at                              AS zuletzt_da,
       u.raw_user_meta_data->>'username'              AS wunschname,
       u.raw_app_meta_data->>'provider'               AS weg
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at;
