-- Zwei Befunde aus dem systematischen RLS-Durchgang am 14.08.2026.
--
-- Anlass: An diesem Tag wurden vier Löcher derselben Klasse gefunden, alle
-- zufällig beim Vorbeikommen. Vier Treffer an einem Tag heißt, dass die Suche
-- systematisch laufen muss statt nebenbei. Der Durchgang fragte zwei Dinge ab:
-- Welche Tabellen haben KEINE RLS, obwohl anon/authenticated Rechte darauf haben?
-- Und welche Policies stehen auf `USING(true)`?
--
-- ─── BEFUND 1: Der Live-Chat war für jeden mitlesbar ────────────────────────
--
-- `live_comments_select` stand auf `USING (true)`. Ohne Anmeldung:
--   GET /rest/v1/live_comments?select=text,user_id
--   -> HTTP 200, Klartext-Nachrichten samt Nutzer-IDs
--
-- Das ist dieselbe Lücke, die `20260814120000_live_reactions_rls.sql` heute
-- Vormittag für `live_reactions` geschlossen hat — nur beim Chat nicht mitgemacht.
-- Und Chat wiegt schwerer als Herzchen: Es sind Gesprächsinhalte.
--
-- Für Frauen-Only-Räume heißt das: Ein fremdes Konto konnte mitlesen, obwohl der
-- ganze Sinn dieser Räume ist, dass niemand mitliest. Abgeflossen ist bisher
-- nichts (die eine bestehende Frauen-Only-Session hat keine Kommentare), aber die
-- Tür stand offen.
--
-- Die neue Bedingung ist wortgleich die von live_reactions. Wichtig dabei:
-- Öffentliche Shows bleiben öffentlich lesbar, weil `women_only = false` für sie
-- wahr ist — die Web-Zuschauerseite ohne Anmeldung funktioniert also weiter.
-- Eingeschränkt wird ausschließlich, was eingeschränkt gehört.
--
-- ─── BEFUND 2: Zwei Tabellen ganz ohne RLS ──────────────────────────────────
--
-- `algo_experiments` und `algo_user_variants` haben keine RLS, und anon besitzt
-- darauf INSERT, UPDATE, DELETE und TRUNCATE. Jeder Unangemeldete konnte die
-- Feed-Experimente umschreiben oder die Tabellen leeren.
--
-- Niemand liest sie: 0 Treffer in beiden Apps, im Web, in den Edge Functions und
-- in den Migrationen. Sie werden deshalb komplett dichtgemacht — RLS an, keine
-- Policy, Rechte weg. `service_role` umgeht RLS ohnehin, ein späterer Job kommt
-- also weiterhin heran. Wer sie wieder öffnen will, ergänzt eine Policy mit
-- ausdrücklicher Bedingung statt die Rechte pauschal zurückzugeben.

BEGIN;

-- ─── 1. Live-Chat erbt die Sichtbarkeit von der Session ──────────────────────
DROP POLICY IF EXISTS "live_comments_select" ON public.live_comments;
CREATE POLICY "live_comments_select" ON public.live_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_comments.session_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

-- ─── 2. Ungenutzte Algorithmus-Tabellen dichtmachen ──────────────────────────
ALTER TABLE public.algo_experiments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.algo_user_variants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.algo_experiments   FROM anon, authenticated;
REVOKE ALL ON TABLE public.algo_user_variants FROM anon, authenticated;

COMMIT;

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
--   GET /rest/v1/live_comments?select=text  (ohne Anmeldung)
--     -> 200 mit Kommentaren aus ÖFFENTLICHEN Shows, keine aus Frauen-Only
--   GET /rest/v1/algo_experiments            -> 401
--
-- ─── Was der Durchgang NICHT abgedeckt hat ───────────────────────────────────
-- Die übrigen 21 `USING(true)`-Policies sind geprüft und gewollt: comments,
-- likes, follows, guilds, stories, profiles und Verwandte sind öffentliche
-- Inhalte einer Social-App. Nicht geprüft wurden Spalten-Rechte auf ANDEREN
-- Tabellen als profiles — dort könnten sensible Spalten genauso offen liegen wie
-- dort die Push-Tokens. Eigener Schritt.
