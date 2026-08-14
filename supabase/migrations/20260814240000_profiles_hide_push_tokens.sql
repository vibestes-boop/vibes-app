-- Push-Tokens waren ohne Anmeldung abrufbar.
--
-- BEFUND 14.08.2026, direkt nach dem Schließen der Push-Injektion in
-- `notifications` (20260814230000) — dasselbe Ziel durch eine andere Tür:
--
--   GET /rest/v1/profiles?select=push_token&push_token=not.is.null
--   -> HTTP 200, fünf echte ExponentPushToken[…] von echten Nutzern
--
-- Ohne Anmeldung, nur mit dem öffentlichen Client-Schlüssel. Mit so einem Token
-- kann jeder direkt bei Expo eine Meldung einliefern — an der Datenbank und damit
-- an allen RLS-Regeln vorbei. Der Angriff, den 20260814230000 geschlossen hat,
-- war darüber weiterhin möglich.
--
-- URSACHE: `profiles` ist bewusst öffentlich lesbar (Profile, Teilen-Links,
-- Web-Seiten). Die Tabelle trägt aber 41 Spalten, und `GRANT SELECT` gilt für
-- alle. Öffentliche Zeilen heißt nicht öffentliche Spalten.
--
-- LÖSUNG: Spalten-Rechte. Dasselbe Muster wie bei `user_whip_ingresses.stream_key`
-- (v1.w.UI.36). SELECT auf die Tabelle wird entzogen und für die unbedenklichen
-- Spalten einzeln neu vergeben.
--
-- ⚠️ FOLGE: `SELECT *` auf `profiles` scheitert für anon und authenticated ab
-- jetzt — Postgres verlangt das Recht auf JEDE Spalte. Es gab genau einen solchen
-- Aufruf (apps/web/app/actions/gdpr.ts, DSGVO-Export des eigenen Profils); der ist
-- im selben Zug auf eine ausdrückliche Spaltenliste umgestellt.
--
-- UMFANG BEWUSST ENG: Entzogen wird nur, was client-seitig NACHWEISLICH niemand
-- liest (per Code-Suche über beide Apps und das Web geprüft):
--
--   push_token, expo_push_token  — nur `send-push-notification` liest sie, und
--                                  die läuft als service_role an Spaltenrechten
--                                  vorbei. Das ist die eigentliche Waffe.
--   explore_vibe, brain_vibe,
--   consistency_score, referred_by — reine Algorithmus-Interna, 0 Treffer im Code.
--
-- NICHT entzogen, obwohl unschön: is_admin, is_moderator, is_operator, is_banned,
-- is_shadow_banned, is_restricted. Die werden client-seitig stark benutzt (45, 11,
-- 9, 26, 25, 11 Treffer) — ein Entzug bräche beide Apps. Dass ein still Gesperrter
-- sein `is_shadow_banned` selbst nachlesen kann, bleibt damit offen und gehört in
-- einen eigenen Schritt: Diese Flaggen müssten über eine RPC nur für das EIGENE
-- Konto laufen, statt als Spalte an jeder Profil-Abfrage zu hängen.

BEGIN;

-- Basis wegnehmen und gezielt neu vergeben. `service_role` bleibt unberührt —
-- Edge Functions und Trigger brauchen den vollen Zugriff.
REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  website,
  guild_id,
  created_at,
  onboarding_complete,
  preferred_tags,
  is_private,
  voice_sample_url,
  is_verified,
  teip,
  gender,
  women_only_verified,
  verification_level,
  is_admin,
  is_creator,
  is_creator_ops,
  notif_prefs,
  is_banned,
  is_restricted,
  restricted_until,
  is_shadow_banned,
  is_moderator,
  is_operator,
  country_code,
  country_name,
  city,
  region_name,
  location_consent_at,
  nav_slot_2,
  nav_slot_4,
  locale
) ON TABLE public.profiles TO anon, authenticated;

COMMIT;

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
--   GET /rest/v1/profiles?select=push_token&limit=1   -> 401/42501
--   GET /rest/v1/profiles?select=id,username&limit=1  -> 200, wie bisher
--
-- ─── Was danach noch offen ist ───────────────────────────────────────────────
-- Die Moderations-Flaggen (siehe oben) und die Frage, ob `gender`/`teip` für
-- Fremde sichtbar sein sollen. In einer Community, in der beides bedeutet, ist
-- das eine Produktentscheidung, keine technische — deshalb hier unangetastet.
