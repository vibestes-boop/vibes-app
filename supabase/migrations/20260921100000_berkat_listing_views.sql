-- ═══════════════════════════════════════════════════════════════════════════
-- Der Verkäufer sieht, ob sein Artikel angesehen wird
-- 21.09.2026 · Berkat · Übergabe Abschnitt 109
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WARUM
-- -----
-- Aus dem Kleinanzeigen-Vergleich (Abschnitt 109): Dort trägt jede eigene
-- Anzeige „👁 33  ♡ 21", und die Detailseite nennt die Aufrufe. Berkat zählt
-- bisher GAR NICHTS. Merkungen gibt es seit `20260822120000`, Aufrufe nicht.
--
-- Für Phase 0 ist das die wichtigere der beiden Zahlen. Ein Verkäufer, der acht
-- Artikel einstellt und nie erfährt, ob jemand hinsieht, hat keinen Grund für
-- den neunten. Eine Null ist dabei auch eine Auskunft — sie sagt „das Foto oder
-- der Preis stimmt nicht", und das kann er ändern.
--
-- ── ⚠️ WARUM KEINE SPALTE AUF `live_auctions` ─────────────────────────────
--
-- Das wäre der naheliegende Weg — und die Falle aus CLAUDE.md, Regel 11:
-- `live_auctions` ist eine der FÜNF Tabellen mit Spalten-REVOKE. Jede neu
-- hinzugefügte Spalte ist dort für `anon`/`authenticated` unsichtbar, bis ein
-- ausdrückliches `GRANT SELECT (<spalte>)` folgt — und ein vergessener GRANT
-- scheitert nicht laut, sondern mit `42501` an einer Stelle, die niemand mit
-- der neuen Spalte in Verbindung bringt. Am 14.08. genau so zugeschlagen.
--
-- Stattdessen dieselbe Bauweise wie bei den Merkungen: eigene Tabelle, eigene
-- Abfrage. Kostet einen Join und erspart eine ganze Fehlerklasse.
--
-- ── ⚠️ WARUM EINE ZEILE JE MENSCH STATT EINES ZÄHLERS ─────────────────────
--
-- Ein `UPDATE … SET views = views + 1` liesse sich beliebig oft auslösen. Genau
-- das war der Befund zu `join_live_session` (v1.27.0, Fund #3): Mit bekannter
-- Kennung konnte jemand die Zuschauerzahl aufblasen. Die Lösung dort war ein
-- Primärschlüssel und `ON CONFLICT DO NOTHING` — hier dieselbe.
--
-- Gezählt wird deshalb, WER angesehen hat, nicht WIE OFT. Dreimal hinsehen ist
-- ein Interessent, nicht drei.
--
-- ⚠️ Nur Angemeldete. Anonyme Aufrufe bräuchten eine Gerätekennung oder die
-- IP-Adresse; beides ist eine Datenschutz-Entscheidung, keine Bauentscheidung.
-- Die Zahl ist damit eine Untergrenze — und das ist ehrlicher als eine
-- geschätzte Obergrenze.

BEGIN;

-- ─── 1. Wer hat hingesehen ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.berkat_listing_views (
  auction_id uuid NOT NULL REFERENCES public.live_auctions(id) ON DELETE CASCADE,
  viewer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (auction_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_berkat_listing_views_auction
  ON public.berkat_listing_views (auction_id);

-- ⚠️ RLS an und KEINE Policy: Wer was angesehen hat, ist eine private Auskunft
-- — dieselbe Linie wie bei `berkat_saved_listings`. Über PostgREST kommt
-- niemand an die Zeilen; nur die Summe ist über die RPC unten zu haben.
ALTER TABLE public.berkat_listing_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.berkat_listing_views FROM anon, authenticated;


-- ─── 2. Einen Aufruf festhalten ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_listing_seen(p_auction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me     uuid := auth.uid();
  v_seller uuid;
BEGIN
  IF v_me IS NULL THEN RETURN; END IF;

  SELECT seller_id INTO v_seller FROM public.live_auctions WHERE id = p_auction_id;

  -- Kein Angebot, oder der Verkäufer sieht sein eigenes an: nichts zählen.
  -- Ohne die zweite Bedingung stünde bei jedem Verkäufer mindestens eine 1,
  -- und die erste echte Zahl wäre nicht von der eigenen zu unterscheiden.
  IF v_seller IS NULL OR v_seller = v_me THEN RETURN; END IF;

  INSERT INTO public.berkat_listing_views (auction_id, viewer_id)
  VALUES (p_auction_id, v_me)
  ON CONFLICT (auction_id, viewer_id) DO NOTHING;
END $$;

ALTER FUNCTION public.mark_listing_seen(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_listing_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_listing_seen(uuid) TO authenticated;


-- ─── 3. Die Summe — nur für den Verkäufer ──────────────────────────────────
--
-- ⚠️ Anders als `get_saved_counts` ist diese Zahl NICHT öffentlich.
--
-- Kleinanzeigen zeigt „103 Aufrufe" jedem, und bei 32 Millionen Nutzern ist das
-- ein Vertrauenssignal. Bei Berkats heutigem Verkehr wäre dieselbe Zeile eine
-- Warnung an den Käufer: „das hat sich noch niemand angesehen". Dieselbe Zahl,
-- umgekehrte Wirkung — der Unterschied ist das Volumen, nicht die Gestaltung.
--
-- Für den Verkäufer ist sie trotzdem wertvoll. Deshalb: sichtbar für den, dem
-- das Angebot gehört. Öffentlich machen kann man sie später mit einer Zeile.

CREATE OR REPLACE FUNCTION public.get_my_listing_views(p_ids uuid[])
RETURNS TABLE(listing_id uuid, views integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT v.auction_id AS listing_id, count(*)::int AS views
    FROM public.berkat_listing_views v
    JOIN public.live_auctions a ON a.id = v.auction_id
   WHERE v.auction_id = ANY(p_ids)
     -- Der ganze Riegel. RLS gilt in einer SECURITY-DEFINER-Funktion nicht
     -- (Übergabe, Abschnitt 3), die Grenze steht also hier — und sie lautet:
     -- nur die eigenen Angebote.
     AND a.seller_id = auth.uid()
   GROUP BY v.auction_id;
$$;

ALTER FUNCTION public.get_my_listing_views(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_my_listing_views(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_listing_views(uuid[]) TO authenticated;

COMMIT;

-- ─── Bewusst nicht gebaut ──────────────────────────────────────────────────
--
-- Ein Verlauf („12 Aufrufe diese Woche"). Dafür müsste `seen_at` ausgewertet
-- werden, und die Spalte ist da — aber eine Kurve ohne Verkehr ist eine Linie
-- auf null. Kommt, wenn es etwas zu zeigen gibt.
--
-- Anonyme Aufrufe. Siehe Kopf: Datenschutz-Entscheidung, nicht Bauentscheidung.
