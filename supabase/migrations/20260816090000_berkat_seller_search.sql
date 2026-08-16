-- Berkat: Verkäufer finden, auch wenn niemand sendet
--
-- DAS PROBLEM
-- Das Suchfeld auf der Startseite heißt „Show oder Verkäufer suchen", filtert
-- aber nur die **bereits geladenen Live-Shows** im Speicher. Ist niemand live —
-- also rund 94 % der Zeit —, ist die Liste leer und die Suche findet
-- grundsätzlich nichts.
--
-- Damit war ein Verkäufer, der gerade nicht sendet, überhaupt nicht auffindbar.
-- Und seit den Dauerangeboten (20260815210000) ist das schlimmer als kosmetisch:
-- Der Laden eines Verkäufers liegt auf seinem Profil, und zum Profil kommt man
-- nur über eine laufende Show oder eine bestehende Unterhaltung. Wer den Namen
-- kennt, aber niemanden kennt, kommt nirgendwo hin.
--
-- WARUM EINE RPC UND KEIN DIREKTER SELECT AUF `profiles`
-- `profiles` ist Serlos Tabelle und enthält alle Nutzer beider Apps. Eine offene
-- Namenssuche darauf würde Berkats Suchfeld mit Serlo-Konten fluten, die hier
-- nichts anzubieten haben. Gesucht wird deshalb unter denen, die in Berkat
-- **etwas getan haben**: ein Angebot eingestellt, etwas verkauft oder eine Show
-- gehalten.
--
-- `SECURITY DEFINER`, weil `live_auctions` und `live_sessions` policy-gebunden
-- sind. Herausgegeben werden ausschließlich öffentliche Profilfelder und zwei
-- Zähler — keine Beträge, keine Adressen, keine fremden Sitzungsdaten.

BEGIN;

CREATE OR REPLACE FUNCTION public.search_berkat_sellers(p_query text)
RETURNS TABLE(
  id         uuid,
  username   text,
  avatar_url text,
  listings   integer,
  sold       integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    (SELECT COUNT(*)::integer FROM public.live_auctions a
      WHERE a.seller_id = p.id AND a.session_id IS NULL AND a.status = 'listed'),
    (SELECT COUNT(*)::integer FROM public.live_auctions a
      WHERE a.seller_id = p.id AND a.status = 'sold')
  FROM public.profiles p
  -- Mindestens zwei Zeichen: Ein einzelner Buchstabe wäre ein Tabellendurchlauf
  -- über alle Nutzer beider Apps, und das Ergebnis wäre ohnehin unbrauchbar.
  WHERE char_length(btrim(coalesce(p_query, ''))) >= 2
    AND p.username ILIKE '%' || btrim(p_query) || '%'
    AND (
      EXISTS (SELECT 1 FROM public.live_auctions a WHERE a.seller_id = p.id)
      OR EXISTS (
        SELECT 1 FROM public.live_sessions s
         WHERE s.host_id = p.id AND s.app = 'berkat'
      )
    )
  -- Wer gerade etwas anzubieten hat, steht oben. Danach, wer schon geliefert
  -- hat. Ein Verkäufer ohne beides ist zwar auffindbar, aber zuletzt.
  ORDER BY 4 DESC, 5 DESC, p.username ASC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.search_berkat_sellers(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_berkat_sellers(text) TO authenticated;

COMMIT;

-- Bewusst NICHT mitgesucht: Artikelnamen. Whatnot findet auch Angebote, aber
-- dafür braucht es erst genug Angebote — und ein Suchfeld, das Verkäufer UND
-- Artikel mischt, muss beides sortieren können. Erst wenn es etwas zu sortieren
-- gibt.
