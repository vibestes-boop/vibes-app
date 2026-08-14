-- Leserecht auf `live_sessions.app` — ohne das ist die App-Trennung tot.
--
-- BEFUND (14.08.2026, direkt nach dem Einspielen von 20260814280000):
-- Die neue Spalte `app` war für `anon` und `authenticated` nicht lesbar. Der
-- Aufruf, den der neue Code in allen drei Oberflächen macht, antwortete mit
-- `42501 permission denied for table live_sessions`:
--
--     GET /rest/v1/live_sessions?select=id,title&status=eq.active&app=eq.serlo
--
-- Ein Filter zählt dabei wie ein Lesezugriff: Postgres verlangt SELECT auf
-- jede Spalte, die in der WHERE-Bedingung vorkommt — auch wenn sie im Ergebnis
-- gar nicht auftaucht. Ohne diese Migration wäre nach dem Ausrollen in JEDER
-- der drei Apps die Live-Liste leer bzw. mit Fehler stehen geblieben.
--
-- URSACHE — und das ist die eigentliche Lehre:
-- `20260425170000_live_sessions_ingress.sql` nahm `ingress_stream_key` gezielt
-- aus der Sicht der Clients:
--
--     REVOKE SELECT (ingress_stream_key) ON public.live_sessions FROM authenticated;
--     REVOKE SELECT (ingress_stream_key) ON public.live_sessions FROM anon;
--
-- Das war richtig — der Stream-Schlüssel ist ein Geheimnis. Aber ein
-- Spalten-REVOKE hat eine Nebenwirkung, die man ihm nicht ansieht: Postgres
-- kann ein Recht nicht „für eine Spalte abziehen". Es löst das breite
-- Tabellen-Recht auf und schreibt stattdessen Einzelrechte für jede damals
-- vorhandene Spalte. Ab diesem Moment ist die Liste FEST — jede später
-- hinzugefügte Spalte steht in keiner dieser Einzelzusagen und ist damit für
-- die Rolle unsichtbar. Lautlos: Die Migration läuft durch, das Schema stimmt,
-- und der Fehler zeigt sich erst, wenn ein Client die Spalte anfasst.
--
-- Betroffen sind im Projekt genau zwei Tabellen, beide mit Absicht:
--   * `live_sessions`        (ingress_stream_key, 20260425170000)  ← hier
--   * `user_whip_ingresses`  (stream_key,         20260426000000)
-- Wer einer der beiden eine Spalte hinzufügt, muss sie ausdrücklich freigeben.
-- Für alle anderen Tabellen gilt das Tabellen-Recht und die Frage stellt sich
-- nicht.
--
-- BEWUSST NICHT das Tabellenrecht wiederherstellen: `GRANT SELECT ON
-- public.live_sessions TO anon, authenticated` würde die Spalten-Einzelrechte
-- ersetzen und damit `ingress_stream_key` wieder mit freigeben — der
-- OBS-Stream-Schlüssel jedes Hosts läge offen. Nur die eine neue Spalte.

BEGIN;

GRANT SELECT (app) ON public.live_sessions TO anon, authenticated;

COMMIT;

-- Gegenprobe nach dem Einspielen — muss die Verteilung zeigen statt 42501:
--
--     SELECT app, count(*) FROM public.live_sessions GROUP BY app;
--
-- Und die Kontrolle, dass der Backfill aus 20260814280000 sauber zugeordnet hat
-- (beide Zeilen müssen 0 ergeben):
--
--     SELECT count(*) FILTER (WHERE room_name LIKE 'berkat-%' AND app <> 'berkat') AS berkat_verfehlt,
--            count(*) FILTER (WHERE room_name NOT LIKE 'berkat-%' AND app = 'berkat') AS falsch_markiert
--       FROM public.live_sessions;
--
-- Größenordnung am 14.08.2026: 20 Berkat-Zeilen. Über die öffentliche
-- Schnittstelle waren 226 Sessions zählbar (197 `vibes-…`, 9 `obs-…`, 20
-- `berkat-…`); Frauen-Only-Sessions sind dort per RLS unsichtbar, die
-- Gesamtzahl auf Serlo-Seite liegt also höher. Für die Zuordnung spielt das
-- keine Rolle — sie hängt allein am room_name-Präfix, nicht an der Sichtbarkeit.
