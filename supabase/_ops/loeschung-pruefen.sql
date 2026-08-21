-- ═══════════════════════════════════════════════════════════════════════════
-- Gegenproben für `delete_own_account()` — VOR und NACH dem Löschen
-- 21.08.2026 · gehört zu 20260821140000_account_deletion_anonymises.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Die Funktion läuft auf `auth.uid()`. Sie lässt sich deshalb NICHT aus dem
-- SQL-Editor und nicht mit dem service_role-Schlüssel auslösen — dort ist
-- `auth.uid()` NULL und sie antwortet mit `not_authenticated`. Ausgelöst wird
-- sie aus der App: Konto → „Konto löschen" → LÖSCHEN tippen.
--
-- Diese Datei liefert das, was drumherum gemessen werden muss.

-- ─── SCHRITT 1: ein Konto auswählen ─────────────────────────────────────────
-- Gesucht ist eins, das ETWAS HAT — sonst misst die Probe nur, ob null Zeilen
-- null Zeilen bleiben. Die Spalten `bestellungen` und `zuschlaege` sind der
-- Grund, warum dieses Konto taugt.
SELECT p.id,
       p.username,
       p.deleted_at,
       (SELECT count(*) FROM product_orders o
         WHERE o.buyer_id = p.id OR o.seller_id = p.id)        AS bestellungen,
       (SELECT count(*) FROM live_auctions a
         WHERE a.winner_id = p.id OR a.seller_id = p.id)       AS zuschlaege,
       (SELECT count(*) FROM berkat_tips t
         WHERE t.sender_id = p.id OR t.recipient_id = p.id)    AS trinkgelder,
       (SELECT count(*) FROM auction_carts c
         WHERE c.buyer_id = p.id
           AND c.status IN ('open','checkout_pending'))        AS offene_koerbe,
       (SELECT count(*) FROM product_orders o
         WHERE o.seller_id = p.id
           AND o.status IN ('paid','payment_requested'))       AS unversendet
  FROM profiles p
 WHERE p.deleted_at IS NULL
 ORDER BY bestellungen DESC, zuschlaege DESC;

-- ⚠️ `offene_koerbe > 0` oder `unversendet > 0` heißt: Die Löschung wird
-- ABGELEHNT — und das ist selbst eine gültige Probe (Blocker-Test). Für den
-- vollen Durchlauf ein Konto nehmen, bei dem beide 0 sind und `bestellungen`
-- oder `zuschlaege` größer 0.


-- ─── SCHRITT 2: VORHER messen ───────────────────────────────────────────────
-- <ID> durch die gewählte ersetzen. Die Zahlen aufschreiben.
SELECT 'bestellungen'  AS was, count(*) AS anzahl FROM product_orders
  WHERE buyer_id = '<ID>' OR seller_id = '<ID>'
UNION ALL SELECT 'zuschlaege',   count(*) FROM live_auctions
  WHERE winner_id = '<ID>' OR seller_id = '<ID>'
UNION ALL SELECT 'trinkgelder',  count(*) FROM berkat_tips
  WHERE sender_id = '<ID>' OR recipient_id = '<ID>'
UNION ALL SELECT 'gebote',       count(*) FROM live_bids WHERE bidder_id = '<ID>'
UNION ALL SELECT 'follows',      count(*) FROM follows
  WHERE follower_id = '<ID>' OR following_id = '<ID>'
UNION ALL SELECT 'merkliste',    count(*) FROM berkat_saved_listings WHERE user_id = '<ID>'
UNION ALL SELECT 'suchen',       count(*) FROM berkat_saved_searches WHERE user_id = '<ID>';


-- ─── SCHRITT 3: In der App löschen ──────────────────────────────────────────
-- Mit diesem Konto in Berkat anmelden → Konto → „Konto löschen" → LÖSCHEN
-- tippen → Knopf. Die App wirft danach auf die Anmeldung zurück.


-- ─── SCHRITT 4: NACHHER messen — der eigentliche Beweis ─────────────────────
-- Dieselbe Abfrage wie Schritt 2. ERWARTET:
--   bestellungen, zuschlaege, trinkgelder, gebote  →  UNVERÄNDERT
--   follows, merkliste, suchen                     →  0
--
-- ⚠️ Sind die ersten vier auf 0 gefallen, ist die alte Fassung noch aktiv oder
-- die Migration nicht durch. Das wäre der Fehler, den diese Arbeit behebt.

-- Und die Person muss weg sein:
SELECT username, display_name, avatar_url, banner_url, bio, deleted_at
  FROM profiles WHERE id = '<ID>';
-- ERWARTET: username 'geloescht-xxxxxxxx', alles andere NULL, deleted_at gesetzt.

-- Der Login muss zu sein:
SELECT email, banned_until IS NOT NULL AS gesperrt,
       encrypted_password IS NULL      AS passwort_weg,
       deleted_at IS NOT NULL          AS markiert
  FROM auth.users WHERE id = '<ID>';
-- ERWARTET: E-Mail endet auf @geloescht.invalid, alle drei Spalten true.

-- Und der GESCHÄFTSPARTNER muss seinen Beleg noch haben — das ist der Kern
-- des ganzen Fehlers. Für jede Bestellung aus Schritt 2 die Gegenseite prüfen:
SELECT o.id, o.status, o.amount_eur,
       bp.username AS kaeufer, sp.username AS verkaeufer
  FROM product_orders o
  LEFT JOIN profiles bp ON bp.id = o.buyer_id
  LEFT JOIN profiles sp ON sp.id = o.seller_id
 WHERE o.buyer_id = '<ID>' OR o.seller_id = '<ID>';
-- ERWARTET: Die Zeilen stehen. Eine Seite heißt jetzt 'geloescht-xxxxxxxx',
-- die andere trägt weiterhin ihren Namen und hat ihren Beleg.
