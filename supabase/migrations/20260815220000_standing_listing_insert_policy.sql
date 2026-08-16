-- Nachtrag zu 20260815210000: `create_standing_listing` legte nichts an.
--
-- `live_auctions` hat RLS aktiviert und **keine einzige INSERT-Policy** — das
-- ist Absicht aus `20260813150000` („Schreiben ausschließlich über die RPCs
-- unten"), zusammen mit `REVOKE INSERT … FROM anon, authenticated`.
--
-- Solange eine `SECURITY DEFINER`-Funktion dem Tabelleneigentümer gehört, geht
-- der INSERT trotzdem durch: Eigentümer umgehen RLS. Gehört sie einer anderen
-- Rolle — und wer sie angelegt hat, hängt davon ab, wie die Migration
-- eingespielt wurde —, greift RLS, findet keine erlaubende Regel und lehnt ab.
-- Genau das ist am 15.08.2026 passiert.
--
-- Der Riegel bleibt trotzdem zu: Das **Tabellenrecht** ist weiterhin entzogen,
-- ein Client kann also gar nicht erst INSERT versuchen. Diese Policy greift nur
-- für eine Rolle, die INSERT ohnehin hat — und sie ist so eng geschnitten, dass
-- selbst dann nichts anderes entstehen kann als ein Dauerangebot auf eigenen
-- Namen.

BEGIN;

DROP POLICY IF EXISTS live_auctions_insert_standing ON public.live_auctions;
CREATE POLICY live_auctions_insert_standing ON public.live_auctions
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_id  = auth.uid()
    AND session_id IS NULL
    AND status = 'listed'
    -- Dieselbe Untergrenze wie in der RPC. Doppelt, weil eine Policy nicht
    -- voraussetzen darf, dass der einzige Weg zu ihr sauber prüft.
    AND buy_now_cents > 100
  );

-- Zurückziehen läuft über `cancel_standing_listing`, also ebenfalls über eine
-- Funktion — und auch dort kann RLS greifen. Eng auf den eigenen Artikel im
-- eigenen Regal begrenzt.
DROP POLICY IF EXISTS live_auctions_update_standing ON public.live_auctions;
CREATE POLICY live_auctions_update_standing ON public.live_auctions
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() AND session_id IS NULL AND status = 'listed')
  WITH CHECK (seller_id = auth.uid() AND session_id IS NULL);

COMMIT;
