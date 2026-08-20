-- ═══════════════════════════════════════════════════════════════════════════
-- Kassen-Freigabe für den GEWERBLICHEN Testverkäufer
-- Angelegt am 20.08.2026 · Berkat · HANDOFF Abschnitt 54
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WOZU
-- ----
-- `berkat_sellers.checkout_enabled` ist die EINZIGE Wahrheit über den Kaufweg
-- (`20260817120000`). Steht sie nicht auf `true`, zeigt die Artikelseite statt
-- des goldenen „Kaufen" den ruhigen „Nachricht schreiben"-Knopf.
--
-- Das Seed-Skript (`scripts/seed-berkat-shop.mjs`) setzt sie bewusst NICHT —
-- eine Kassen-Freigabe ist eine Verwaltungsentscheidung, kein Nebenprodukt von
-- Testdaten. Folge: Auf allen 36 Testartikeln ist nichts kaufbar.
--
-- Am 20.08.2026 entschied Zaur, die Testware für den TestFlight-Start im Regal
-- zu lassen. Damit wird aus der fehlenden Freigabe ein totes Schaufenster —
-- deshalb diese Datei.
--
-- WARUM NUR DER GEWERBLICHE
-- -------------------------
-- Die fünf privaten Seed-Verkäufer bekommen bewusst KEINE Freigabe:
--
--   Ein Privatverkäufer kann ohne Stripe Connect gar kein Geld über die
--   Plattform bekommen. Läuft es über das Konto des Betreibers, ist das nach
--   ZAG erlaubnispflichtig (HANDOFF Abschnitt 20).
--
-- Der gewerbliche Testverkäufer hat als einziger ein vollständiges Impressum
-- (§ 5 DDG, vom Seed-Skript gesetzt). Nebeneffekt, der erwünscht ist: Im Regal
-- stehen danach BEIDE Zustände nebeneinander — sechs kaufbare Artikel beim
-- Gewerblichen, „Nachricht schreiben" bei den übrigen dreißig. Das ist nicht
-- halbfertig, das ist das richtige Produktverhalten.
--
-- ⚠️ VOR DEM STRIPE-ECHTBETRIEB ZURÜCKNEHMEN
-- ------------------------------------------
-- Heute läuft Stripe im Testmodus (`cs_test_`), es fließt kein echtes Geld.
-- Wird auf Echtbetrieb umgestellt, sind diese sechs Testartikel WIRKLICH
-- kaufbar — für Ware, die es nicht gibt, mit Geld auf ein echtes Konto.
-- Vor dem Go-Live also entweder die Testware entfernen
-- (`node scripts/seed-berkat-shop.mjs --remove`) ODER Abschnitt 3 unten fahren.
--
-- ANMERKUNG ZUM SCHREIBWEG
-- ------------------------
-- HANDOFF Abschnitt 43 nennt `set_berkat_seller_kind` als einzigen Schreibweg
-- auf `berkat_sellers` — die Sorge dort ist, dass per SQL eingetragene
-- Anschriften bei einem späteren Wechsel auf „privat" öffentlich stehen
-- bleiben. Hier wird ausschließlich `checkout_enabled` umgelegt, keine
-- Adressdaten; die gewarnte Gefahr greift also nicht.


-- ─── 1. Erst hinsehen, wen es trifft (ändert nichts) ───────────────────────
select s.user_id,
       p.username,
       s.kind,
       s.checkout_enabled,
       s.legal_name
  from public.berkat_sellers s
  join public.profiles p on p.id = s.user_id
 order by s.checkout_enabled desc nulls last, s.kind, p.username;

-- Erwartet: sechs Zeilen, genau EINE mit kind = 'business' und
-- legal_name = 'Testhandel Amir e. K.'. Steht dort schon `checkout_enabled =
-- true` bei jemandem, ist das der Betreiber — der hat seit `20260817120000`
-- Bestandsschutz und bleibt unangetastet.


-- ─── 2. Freigeben ──────────────────────────────────────────────────────────
-- Erkannt am `legal_name`, nicht am Benutzernamen: Das Seed-Skript wählt seine
-- Verkäufer über `profiles ... order by created_at desc limit 6`, der zweite
-- wird gewerblich. Welcher Mensch das ist, ändert sich also mit jedem neu
-- angelegten Konto — der Firmenname nicht.
update public.berkat_sellers
   set checkout_enabled = true
 where kind = 'business'
   and legal_name = 'Testhandel Amir e. K.'
returning user_id, kind, checkout_enabled;

-- Erwartet: GENAU EINE Zeile mit checkout_enabled = true.
--   0 Zeilen → Seed-Skript nie gelaufen, oder der Firmenname hat sich geändert.
--              Dann Schritt 1 lesen, NICHT den Filter aufweichen.
--   >1 Zeile → mehrere gewerbliche Testzeilen. Nachsehen, bevor es weitergeht.


-- ─── 3. Rückweg (vor dem Stripe-Echtbetrieb, oder wenn die Testware geht) ──
-- update public.berkat_sellers
--    set checkout_enabled = false
--  where kind = 'business'
--    and legal_name = 'Testhandel Amir e. K.'
-- returning user_id, checkout_enabled;


-- ─── 4. Gegenprobe in der App ──────────────────────────────────────────────
-- Einen Artikel des gewerblichen Verkäufers öffnen. Die Leiste unten muss
-- „Kaufen · X €" in Gold zeigen, nicht „Nachricht schreiben". Bis die Freigabe
-- geladen ist, steht dort bewusst eine Wartefläche und kein beschrifteter Knopf
-- (HANDOFF Abschnitt 22) — ein Etikett, das eine Zehntelsekunde später von
-- „Nachricht" auf „Kaufen" springt, wäre auf einem Geldweg schlimmer.
