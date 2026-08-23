-- Die Versandzeit-Kachel war für JEDEN Fremden tot
-- ============================================================================
--
-- ⚠️ BEFUND 23.08.2026, beim Nachprüfen des Audit-Punkts „die vier
-- Bestell-Lesepfade auf `product_orders`" (Übergabe 73, „noch offen, ehrlich").
--
-- Fünf der sechs Lesepfade waren ein Fehlalarm — sie filtern auf `auth.uid()`
-- oder eine daraus abgeleitete ID. Der sechste nicht:
--
--     apps/berkat/lib/useSellerStats.ts:66
--       .from('product_orders').select('paid_at, shipped_at')
--       .eq('seller_id', sellerId!)      ← ein PARAMETER, nicht auth.uid()
--
-- `product_orders_party_read` lautet
-- `auth.uid() = buyer_id OR auth.uid() = seller_id`. Ein Besucher, der ein
-- fremdes Profil ansieht, ist keins von beidem — und bekommt **null Zeilen bei
-- HTTP 200.** Gemessen als anon gegen den Live-Datenstand: `[]`.
--
-- Die Folge: **Die Versandzeit steht bei jedem Fremden auf „—".** Nur der
-- Verkäufer selbst sieht seine eigene Zahl — also genau die Person, die sie
-- nicht braucht.
--
-- Das wiegt schwerer, als es klingt. Abschnitt 10 nennt die drei Kacheln
-- „die Zahlen, an denen ein Fremder entscheidet, ob er diesem Menschen Geld
-- schickt", und Abschnitt 55 begründet den Urlaubsmodus damit, dass die
-- Versandzeit auf dem öffentlichen Profil steht. **Sie stand dort nie.**
--
-- ── ⚠️ DIE LEHRE STAND DIREKT DARÜBER ───────────────────────────────────────
--
-- Der Kommentar über der kaputten Abfrage erklärt exakt dieselbe Falle — für
-- die NACHBAR-Kachel:
--
--   > „Über die RPC, nicht über die Tabelle: `order_reviews_party_read` erlaubt
--   > das Lesen nur dem Bewerter und dem Bewerteten. Ein Zuschauer im Live-Raum
--   > ist keins von beidem und bekäme null Zeilen — die Kachel stünde dauerhaft
--   > auf „—"."
--
-- Zwei Kacheln, dieselbe Falle, eine erkannt. Die Lehre war aufgeschrieben und
-- an der Stelle daneben nicht angewandt.
--
-- > **Wer eine Falle für eine Abfrage dokumentiert, prüft die Abfragen daneben
-- > im selben Zug.** Eine Warnung, die nur ihren eigenen Fall abdeckt, sieht
-- > aus wie Gründlichkeit und ist Zufall.
--
-- ── Der Weg: Aggregat statt Policy aufweichen ───────────────────────────────
--
-- Genau wie bei `get_seller_rating` (`20260814310000`). Die Policy zu lockern
-- wäre der falsche Reflex: `product_orders` trägt Versandadressen, Beträge und
-- die Identität des Käufers. Herausgegeben werden hier **zwei Zahlen** —
-- Durchschnitt in Stunden und wie viele Sendungen dahinterstehen.
--
-- Die zweite Zahl ist nicht Beiwerk: „<1d" aus einer einzigen Sendung ist eine
-- andere Auskunft als „<1d" aus zwanzig, und der Client zeigt sie schon an
-- (`shipSamples`).

CREATE OR REPLACE FUNCTION public.get_seller_ship_stats(p_seller_id uuid)
RETURNS TABLE(avg_hours numeric, ship_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  -- Die Auswahl ist ZEICHENGENAU die des Clients von vorher, damit die Zahl
  -- sich nicht ändert, nur weil sie den Weg wechselt:
  --   • nur Berkat-Bestellungen (`cart_id IS NOT NULL`) — dieselbe Weiche wie
  --     in `create-checkout-session`. Serlos Shop-Versand hat andere Wege und
  --     würde die Zahl verfälschen.
  --   • nur bezahlt UND versendet
  --   • negative Spannen raus (versendet vor bezahlt = Datenmüll)
  --   • die letzten 20: Wer vor einem Jahr langsam war und heute schnell ist,
  --     soll heute gemessen werden.
  SELECT
    AVG(EXTRACT(EPOCH FROM (o.shipped_at - o.paid_at)) / 3600.0)::numeric,
    COUNT(*)::integer
  FROM (
    SELECT po.paid_at, po.shipped_at
      FROM public.product_orders po
     WHERE po.seller_id = p_seller_id
       AND po.cart_id IS NOT NULL
       AND po.paid_at IS NOT NULL
       AND po.shipped_at IS NOT NULL
       AND po.shipped_at >= po.paid_at
     ORDER BY po.shipped_at DESC
     LIMIT 20
  ) o;
$fn$;

-- ⚠️ `anon` bekommt EXECUTE — anders als bei `get_vouch_weights`, und das ist
-- Absicht: Das Verkäufer-Profil und der Live-Raum sind **ohne Konto** sichtbar,
-- und dort steht die Kachel. Ohne dieses Recht wäre der Fix nur für Angemeldete
-- wirksam, also für die Hälfte des Publikums.
--
-- Vertretbar ist das, weil hier zwei Zahlen herauskommen und nichts sonst:
-- keine Beträge, keine Adressen, keine Käufer-Identität, kein Zeitpunkt einer
-- einzelnen Sendung. Wer die Funktion je um ein Feld erweitert, prüft diese
-- Zeile neu.
REVOKE ALL ON FUNCTION public.get_seller_ship_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_ship_stats(uuid) TO anon, authenticated, service_role;

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) ⚠️ DIE PROBE, UM DIE ES GEHT — als **anon**, also aus der Sicht eines
--    Besuchers. Vorher kam `[]`, jetzt muss eine Zeile kommen:
--
--      POST /rest/v1/rpc/get_seller_ship_stats
--      { "p_seller_id": "7760a71b-b87a-4071-bc60-a9442b82b429" }
--
--    Erwartet: `[{"avg_hours": <Zahl>, "ship_count": <Zahl>}]`.
--    ⚠️ `ship_count: 0` und `avg_hours: null` heisst „dieser Verkäufer hat noch
--    nichts versendet" — das ist ein gültiges Ergebnis, kein Fehlschlag. Zum
--    Vergleich derselbe Aufruf für einen Seed-Verkäufer, der nie versendet hat.
--
-- 2) Die Zahl darf sich durch den Wegwechsel NICHT ändern. Aus einer
--    angemeldeten Sitzung des Verkäufers selbst: alte Abfrage und neue RPC
--    nebeneinander, dieselbe Stundenzahl.
--
--      SELECT AVG(EXTRACT(EPOCH FROM (shipped_at - paid_at))/3600.0)
--        FROM (SELECT paid_at, shipped_at FROM product_orders
--               WHERE seller_id = '<id>' AND cart_id IS NOT NULL
--                 AND paid_at IS NOT NULL AND shipped_at IS NOT NULL
--                 AND shipped_at >= paid_at
--               ORDER BY shipped_at DESC LIMIT 20) x;
--
-- 3) Und die Grenze hält: Die TABELLE bleibt für Fremde leer.
--
--      GET /rest/v1/product_orders?select=ship_street&seller_id=eq.<id>
--      -- erwartet: weiterhin `[]`
--
-- 4) Am Gerät (Prüfliste): Ein FREMDES Verkäufer-Profil öffnen — die
--    Versandzeit-Kachel muss eine Zahl tragen statt „—". Das geht nur mit dem
--    zweiten Konto oder abgemeldet.
