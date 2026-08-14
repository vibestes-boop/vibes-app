-- OBS-Zugangsdaten lagen offen — jeder konnte in fremde Sendungen einspeisen.
--
-- BEFUND 14.08.2026, im Spalten-Durchgang über alle Tabellen gefunden. Ohne
-- Anmeldung, nur mit dem öffentlichen Client-Schlüssel:
--
--   GET /rest/v1/live_sessions?select=ingress_stream_key -> 200, echte Schlüssel
--   GET /rest/v1/live_sessions?select=ingress_url        -> 200, die WHIP-Adresse
--
-- Beides zusammen sind die VOLLSTÄNDIGEN OBS-Zugangsdaten einer fremden Sendung.
-- Damit lässt sich Video in den Stream eines anderen einspeisen — vor dessen
-- Publikum, unter dessen Namen. Für eine Live-Shopping-App ist das der sichtbarste
-- denkbare Schaden.
--
-- URSACHE: Dieselbe wie bei den Push-Tokens in `profiles` (20260814240000).
-- `live_sessions` ist bewusst öffentlich lesbar — man muss ja sehen, wer live ist.
-- Öffentliche ZEILEN heißt aber nicht öffentliche SPALTEN, und `GRANT SELECT` gilt
-- für alle 38.
--
-- Für `user_whip_ingresses.stream_key` war das längst richtig gelöst: Spalten-Recht
-- entzogen, Zugriff nur über den SECURITY DEFINER RPC `get_my_whip_ingress()`
-- (v1.w.UI.36). `live_sessions` trägt dieselben Werte in eigenen Spalten und wurde
-- dabei übersehen.
--
-- BRICHT NICHTS: Kein Client liest diese vier Spalten. Die zwei Treffer im Code
-- (apps/web/app/actions/live-ingress.ts) sind TypeScript-Typen für den
-- RÜCKGABEWERT der sicheren RPC, kein Tabellen-Select. Edge Functions laufen als
-- service_role und umgehen Spaltenrechte.
--
-- ⚠️ Wie bei profiles gilt: `SELECT *` auf live_sessions scheitert ab jetzt für
-- anon und authenticated. Es gab genau einen solchen Aufruf (gdpr.ts,
-- DSGVO-Export der eigenen Sendungen); im selben Zug auf eine ausdrückliche Liste
-- umgestellt.

BEGIN;

REVOKE SELECT ON TABLE public.live_sessions FROM anon, authenticated;

GRANT SELECT (
  id,
  host_id,
  title,
  status,
  viewer_count,
  peak_viewers,
  room_name,
  started_at,
  ended_at,
  like_count,
  comment_count,
  pinned_comment,
  replay_url,
  is_replayable,
  replay_views,
  thumbnail_url,
  category,
  moderation_enabled,
  moderation_words,
  goal_type,
  goal_target,
  goal_current,
  goal_title,
  goal_reached,
  allow_comments,
  allow_gifts,
  women_only,
  followers_only_chat,
  slow_mode_seconds,
  updated_at,
  recording_enabled,
  recording_id,
  shop_enabled,
  followers_only
) ON TABLE public.live_sessions TO anon, authenticated;

COMMIT;

-- ─── Gegenprobe ──────────────────────────────────────────────────────────────
--   GET /rest/v1/live_sessions?select=ingress_stream_key -> 401
--   GET /rest/v1/live_sessions?select=id,status,title    -> 200 wie bisher
--
-- ─── Anmerkung zu den Schlüsseln selbst ──────────────────────────────────────
-- Die beiden Schlüssel, die beim Fund sichtbar waren, sind damit nicht wertlos
-- geworden — wer sie in der offenen Zeit abgegriffen hat, hat sie weiterhin.
-- `rotate` in der Edge Function `livekit-whip-ingress` erzeugt neue; ob das nötig
-- ist, hängt davon ab, ob die Sendungen überhaupt öffentlich erreichbar waren.
