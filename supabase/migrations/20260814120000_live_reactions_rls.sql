-- live_reactions: Sichtbarkeit erbt von der Session
--
-- Die Lese-Policy stand auf USING(true). Damit konnte jedes angemeldete Konto
-- alle Reaktionen jeder Session lesen — also auch die Teilnehmerliste eines
-- Frauen-Only-Raums, denn jede Zeile trägt session_id und user_id. Wer nicht
-- hineindarf, konnte so trotzdem erfahren, wer drin war.
--
-- Das ist derselbe Fehler wie am 16.07.2026 auf live_sessions: Postgres
-- verknüpft permissive Policies mit ODER, ein einziges USING(true) hebelt jede
-- Grenze daneben aus.
--
-- Risikolos umzustellen, weil niemand die Tabelle liest: App und Web schreiben
-- nur hinein (lib/useLiveSession.ts), gezeigt werden Reaktionen ausschließlich
-- über den Broadcast-Kanal `live-reactions-<id>`. Keine Funktion, kein View und
-- kein Trigger greift lesend darauf zu; SECURITY-DEFINER-Funktionen umgehen RLS
-- ohnehin. Für Analytics-Auswertungen gilt dasselbe — die laufen über den
-- Service-Role-Schlüssel, der von RLS nicht berührt wird.

DROP POLICY IF EXISTS live_reactions_select ON public.live_reactions;

CREATE POLICY live_reactions_select ON public.live_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_reactions.session_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

-- Die Schreib-Policy bleibt, wie sie ist: WITH CHECK (auth.uid() = user_id).
-- Sie ist bereits eng — niemand kann eine Reaktion in fremdem Namen einwerfen.
