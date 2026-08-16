-- Bannerbild auf dem Profil
--
-- WARUM
-- Whatnots Verkäufer-Profil beginnt mit einem breiten Bild hinter dem Kopf —
-- meist das eigene Logo oder ein Foto aus der Ware. Es ist das Erste, was ein
-- Fremder sieht, und der einzige Ort auf der Seite, an dem ein Verkäufer wie
-- eine Marke aussehen kann statt wie ein Datensatz.
--
-- Ich hatte das am 16.08.2026 zunächst als „Kosmetik ohne Designer"
-- zurückgestellt. Das war falsch begründet: Das Bild kommt vom VERKÄUFER, nicht
-- von einem Gestalter — es ist derselbe Upload wie das Show-Cover, und den gibt
-- es seit dem 13.08. (`lib/uploadImage.ts`, Edge Function `r2-sign`).
--
-- ⚠️ DIE ZEILE, OHNE DIE DAS FEATURE LAUTLOS TOT WÄRE
-- `profiles` trägt seit `20260814240000` KEIN Tabellen-SELECT mehr, sondern eine
-- ausdrückliche Spaltenliste (die Migration nahm `push_token` aus der Sicht der
-- Clients). Postgres kann ein Recht nicht spaltenweise abziehen — es löst das
-- Tabellen-Recht auf und schreibt Einzelrechte für die damals vorhandenen
-- Spalten. Ab da ist die Liste fest.
--
-- Eine neue Spalte steht in keiner dieser Zusagen. Ohne das `GRANT` unten wäre
-- `banner_url` für `anon` und `authenticated` unsichtbar, und ein
-- `select('… , banner_url')` schlüge mit `42501 permission denied for table
-- profiles` fehl — dieselbe Falle wie bei `live_sessions.app` am 14.08.2026,
-- nur auf einer dritten Tabelle. HANDOFF-Regel 11 nennt bisher nur
-- `live_sessions` und `user_whip_ingresses`; `profiles` gehört seit dem
-- 14.08. dazu.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url text;

-- Die eine Zeile, um die es oben geht.
GRANT SELECT (banner_url) ON public.profiles TO anon, authenticated;

COMMENT ON COLUMN public.profiles.banner_url IS
  'Breites Kopfbild auf dem Verkäufer-Profil. Vom Nutzer hochgeladen (R2, Präfix thumbnails).';

COMMIT;

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- Ohne Anmeldung, mit dem öffentlichen Client-Schlüssel:
--
--   GET /rest/v1/profiles?select=id,banner_url&limit=1   -> 200
--
-- Kommt dort 42501, fehlt das GRANT — und zwar für JEDE Abfrage auf profiles,
-- die die Spalte auch nur erwähnt, nicht nur für diese eine.
--
-- ─── Was bewusst NICHT drin ist ──────────────────────────────────────────────
-- • **Kein Standardbild.** Ohne Banner rendert das Profil einen ruhigen
--   Farbverlauf aus der eigenen Palette. Ein Platzhalter-Foto für alle sähe aus
--   wie ein Fehler und wäre für jede zweite Marke das falsche Bild.
-- • **Keine Größenprüfung in der Datenbank.** Das Zuschneiden passiert beim
--   Hochladen (`pickImage`), und was in R2 landet, ist ohnehin durch die
--   signierte URL begrenzt. Eine zweite Wahrheit darüber im CHECK-Constraint
--   würde nur auseinanderlaufen.
