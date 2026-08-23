-- Der OBS-Stream-Schlüssel ist wieder lesbar geworden — und der Weg zurück
-- ist NICHT das spaltenweise REVOKE
-- ============================================================================
--
-- BEFUND (Abzug vom 23.08.2026, gegen die Produktions-Rechte gemessen):
--
--     GRANT ALL ON TABLE "public"."user_whip_ingresses" TO "authenticated";
--
-- `20260426000000` hatte `stream_key` gezielt aus der Sicht der Clients
-- genommen. Ein späteres `GRANT ALL` auf Tabellen-Ebene hat das überholt:
-- Tabellenrechte sind eine Obermenge der Spaltenrechte, die alten
-- Einzelzusagen stehen zwar noch im Katalog, sind aber wirkungslos.
--
-- Wie schwer wiegt das? Weniger, als es klingt — und mehr, als es aussieht:
--
--   • Die Zeilen-Policies (`own_ingress_select` u. a.) lassen ausschliesslich
--     die EIGENE Zeile durch. Niemand liest einen fremden Schlüssel.
--   • Aber `GRANT ALL` trägt auch INSERT, UPDATE und DELETE. Zusammen mit
--     `own_ingress_update` kann ein Nutzer heute seinen eigenen `room_name`
--     überschreiben — und `room_name` ist die Kennung, unter der LiveKit den
--     Strom zuordnet.
--   • Und die eigentliche Gefahr ist die Zukunft: Sobald irgendeine Policy auf
--     dieser Tabelle je weiter gefasst wird, liegt der Schlüssel offen. Genau
--     dagegen war das REVOKE gebaut.
--
-- ⚠️ WARUM NICHT DAS SPALTENWEISE REVOKE ZURÜCK
--
-- Der Reflex wäre `REVOKE SELECT (stream_key) … FROM authenticated`. Das wäre
-- exakt die Falle aus CLAUDE.md Regel 11: Postgres kann ein Recht nicht
-- spaltenweise abziehen, es löst das Tabellenrecht auf und schreibt
-- Einzelrechte für die DAMALS vorhandenen Spalten. Jede später hinzugefügte
-- Spalte wäre für die Clients unsichtbar — und ein blosser Filter darauf ein
-- `42501`. Dieses Projekt ist darüber schon zweimal gestolpert
-- (`live_sessions.app` am 14.08., `profiles.banner_url` am 16.08.).
--
-- DER WEG STATTDESSEN: das Recht ganz entziehen.
--
-- Gemessen, nicht angenommen — kein einziger Client greift auf die Tabelle zu:
--
--   • `grep -rn user_whip_ingresses --include=*.ts --include=*.tsx` findet
--     ausserhalb der Migrationen nur `supabase/functions/livekit-whip-ingress/`
--     und einen Kommentar in `apps/web/app/actions/live-ingress.ts`.
--   • Diese Edge Function spricht die Tabelle durchgehend mit
--     `env.serviceRoleKey` an (Z. 242, 330, 344, 384, 423) — `service_role`
--     behält sein Recht.
--   • Der Client liest ausschliesslich über `get_my_whip_ingress()`. Die ist
--     `SECURITY DEFINER`, läuft also als `postgres` und braucht das
--     Tabellenrecht des Aufrufers nicht. Ihr `GRANT … TO authenticated`
--     bleibt unberührt.
--
-- Damit ist der Schlüssel für jeden Client strukturell weg, die Spaltenliste
-- bleibt frei, und keine künftige Policy kann ihn versehentlich freigeben.
--
-- ⚠️ WER HIER JE EINEN CLIENT-ZUGRIFF BAUT, baut ihn als RPC — nicht mit einem
-- neuen GRANT. Ein `GRANT SELECT` auf die Tabelle gäbe `stream_key` mit frei,
-- und genau das ist der Fehler, den diese Datei gerade zurücknimmt.

REVOKE ALL ON TABLE public.user_whip_ingresses FROM authenticated;
REVOKE ALL ON TABLE public.user_whip_ingresses FROM anon;

-- Die Einzelrechte aus `20260426000000` sind durch das Tabellen-GRANT
-- wirkungslos geworden und liegen als Altlast im Katalog. Sie mit zu entfernen
-- ist nicht kosmetisch: Bliebe eine Spaltenzusage stehen, wäre die Tabelle
-- weiterhin teilweise lesbar, und der Befund oben nur halb behoben.
-- (`REVOKE` auf eine nicht vergebene Spalte ist folgenlos, nicht fehlerhaft.)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT column_name, grantee
      FROM information_schema.column_privileges
     WHERE table_schema = 'public'
       AND table_name   = 'user_whip_ingresses'
       AND grantee IN ('authenticated', 'anon')
  LOOP
    EXECUTE format(
      'REVOKE ALL (%I) ON TABLE public.user_whip_ingresses FROM %I',
      r.column_name, r.grantee
    );
  END LOOP;
END $$;

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Kein Tabellen- und kein Spaltenrecht mehr für die beiden Client-Rollen.
--    Erwartet: null Zeilen.
--
--      SELECT grantee, privilege_type
--        FROM information_schema.role_table_grants
--       WHERE table_name = 'user_whip_ingresses'
--         AND grantee IN ('anon', 'authenticated')
--      UNION ALL
--      SELECT grantee, privilege_type
--        FROM information_schema.column_privileges
--       WHERE table_name = 'user_whip_ingresses'
--         AND grantee IN ('anon', 'authenticated');
--
-- 2) `service_role` behält alles. Erwartet: Zeilen.
--
--      SELECT privilege_type FROM information_schema.role_table_grants
--       WHERE table_name = 'user_whip_ingresses' AND grantee = 'service_role';
--
-- 3) VON AUSSEN, mit dem öffentlichen Schlüssel und einem angemeldeten Token —
--    das ist die Probe, die zählt (Abschnitt 73: „erst ein Aufruf von aussen
--    sagt, ob der Fix wirkt"). Erwartet: 401/42501 statt einer Zeile.
--
--      GET /rest/v1/user_whip_ingresses?select=stream_key
--
-- 4) Und der legitime Weg muss weiterlaufen. Erwartet: die eigene Zeile.
--
--      POST /rest/v1/rpc/get_my_whip_ingress
