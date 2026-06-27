# Handoff — Serlo/Vibes (Stand 27. Juni 2026 · Session 2)

> 📍 **Dieses Dokument: `/Users/zaurhatuev/vibes-app/handoff.md`**
> Arbeite NUR in diesem Repo: **`/Users/zaurhatuev/vibes-app`** (Branch `main`).
> ⚠️ NICHT die Quarantäne-Kopie `/Users/zaurhatuev/Desktop/vibes-app` — NIEMALS lesen/bauen/pushen.
>
> Übergabe für den Wechsel in einen neuen Chat. Gedächtnis-Dateien
> (`~/.claude/.../memory/`) laden automatisch — dieses Doku ergänzt sie mit Session-Detail.
> **Strategie/Finanz-Plan liegt im Brain** (gbrain): `decisions/2026-06-27-serlo-finanz-architektur`,
> `decisions/2026-06-27-serlo-monetarisierung-roadmap`, `outputs/2026-06-27-serlo-geld-premortem`.

---

## 0. Schnell-Status

| Bereich | Stand |
|---|---|
| **Repo / Branch** | `/Users/zaurhatuev/vibes-app` · `main` · Working Tree **sauber** |
| **Letzter Commit** | `eff18ad` — Echtgeld-Verkäufe zählen (sold_count + €-Umsatz) + Verkäufer-Bewertung auf Produktseite. **Alle Session-Commits gepusht & verifiziert (`git ls-remote`).** |
| **Web (apps/web)** | deployt via **Vercel** auf Push zu `main`. **Live: `serlo-web.vercel.app` — ⚠️ OHNE `www`!** |
| **App-Build** | v1.30.0 / iOS-Build 286 (TestFlight) · Runtime **1.30.0**. OTAs ziehen nur beim **kalten App-Neustart**. |
| **Letzte OTAs (27.6. Session 2)** | Viele JS-OTAs auf `production` (Runtime 1.30.0): Echtgeld-Bestellflow-Politur, Direktkontakt, Bewertungen, Dispute, Push-Korrektheit, „Echtgeld-Verkäufe zählen + Produkt-Bewertung". Stand = Commit `eff18ad`. |
| **Edge Functions deployed** | `create-checkout-session` (Produkt-Checkout + Cover-Bild via weserv), `stripe-webhook` (→ paid + sold_count-Bump + Verkäufer-Notif), `send-push-notification` (alle Bestell-Notif-Typen). **Alle aktuell deployed.** |
| **DB-Migrationen** | ✅ **ALLE ausgeführt** (Zaur im SQL-Editor) bis `20260628130000_echtgeld_sold_count.sql` + einmaliges sold_count-Backfill-UPDATE. Vollständige Liste Session 2 siehe §1.5. **Keine offene Migration.** |
| **GERADE FERTIG** | **Komplettes Echtgeld-Bestell- & Vertrauens-System** (Phase 1, eigenes Parfüm, kein Connect) — Backend + App + Web **fertig & deployed & verifiziert**. Siehe §1.5. |
| **Admin** | Zaur (`username='zaur'`, `profiles.is_admin = true`) — nötig fürs Vorbestell-Gate **und** Dispute-Klärung (`resolve_order_dispute`). |

⚠️ **Quarantäne:** `/Users/zaurhatuev/Desktop/vibes-app` — NIEMALS bauen/deployen/pushen.

---

## 1.5 🆕 Session 2 (27.6. später) — Echtgeld-Bestell- & Vertrauens-System KOMPLETT

> Aufbauend auf §1-J. Der ganze Loop ist jetzt fertig + live (Web + App):
> **Vormerken → „Ware ist da → Zahlung anfordern" → bezahlen (Stripe) → versenden+Tracking
> → erhalten → bewerten (beidseitig) → Problem melden & klären.** Plus Direktkontakt jederzeit.

### Was gebaut wurde
- **Verkäufer-Vorbestell-Panel-Fix**: `getMyPreorderGroups` (Web) nutzte einen kaputten PostgREST-Embed `user:profiles(...)` (FK zeigt auf `auth.users`, nicht `profiles`) → PGRST200 → Panel leer. Fix: Usernamen separat per `.in()`. Memory: `vibes-postgrest-profiles-embed`.
- **Checkout-Zielseiten**: `/shop/success` + `/shop/cancelled` (gab's nicht → 404/Coin-Seite). `create-checkout-session` vom Coin-`STRIPE_SUCCESS_URL`-Fallback entkoppelt + **Cover-Bild** an Stripe (WebP→JPEG via `images.weserv.nl`).
- **Käufer-Aktionen**: Stornieren **vor** Zahlung (`cancel_product_order`, gibt Vormerkung frei) + **Lieferadresse ändern** solange `paid` (`update_order_shipping_address`). UI Web+App.
- **Eigenes UI statt Browser-Dialoge**: Versand/Erhalten/Stornieren laufen über `<Dialog>` (Web) statt `window.prompt/confirm`.
- **Repeat-Kauf**: „Vormerken" nach Lieferung wieder möglich (`useMyPreorder`/`preordered_by_me` zählen nur offene Vormerkungen; `mark_preorders_payable` blockt nur laufende, nicht gelieferte Orders).
- **Vorbestell-Oberflächen konsolidiert**: `/studio/shop/preorders` ist die **einzige** Zentrale (Anschreiben + „Ware ist da → Zahlung anfordern"); der doppelte Block aus `/studio/orders` ist raus (Banner verlinkt hin).
- **Direktkontakt** Käufer↔Verkäufer aus jeder Bestellung (DM-Button, Web+App).
- **Bewertungen nach Lieferung** (beidseitig): `order_reviews` + `submit_order_review`. Anzeige auf der Bestellung (eigene + erhaltene) **und aggregiert als Reputation** auf dem **Profil** (`get_order_rating`) + auf der **Produktseite** (Seller-Karte).
- **Dispute/Melden**: `order_disputes` + `report_order_dispute` (Partei, ab `paid`) + `resolve_order_dispute` (**Admin-only**). „In Klärung"-Banner; Admin klärt auf Web.
- **Benachrichtigungen korrekt**: eigene Typen statt generisches `gift` — `order_payment_requested/paid/shipped/cancelled/address_updated/review/dispute` + `preorder_interest`. Push-Texte + Deep-Links + Live-Glocken-Badge.
- **Echtgeld zählt jetzt**: `bump_product_sold_count` (Webhook beim Bezahlen) → `sold_count` auf Karten+Analytics; **€-Umsatz** in Shop-Analytics (`getShopAnalytics` aggregiert `product_orders.amount_eur`).

### Migrationen Session 2 (✅ alle ausgeführt) — chronologisch
`20260627150000` order_buyer_actions (cancel + address) · `20260627160000` repeat_preorder · `20260627170000` order_notification_types · `20260627180000` order_notif_types_2 (cancelled/address) · `20260628100000` order_reviews · `20260628110000` order_review_notify_and_disputes · `20260628120000` order_rating_aggregate · `20260628130000` echtgeld_sold_count. **+ einmaliges sold_count-Backfill-UPDATE** (manuell, nicht als Migration).

### Schlüssel-Dateien
- DB-RPCs (alle SECURITY DEFINER mit Identitäts-Check): siehe Migrationen oben.
- Edge: `supabase/functions/{create-checkout-session,stripe-webhook,send-push-notification}/index.ts`.
- Web-Daten/Actions: `apps/web/lib/data/shop.ts`, `apps/web/app/actions/shop.ts`.
- Web-UI: `components/shop/{product-orders-panel,order-review,order-dispute,preorder-contact}.tsx`, `app/studio/orders/page.tsx`, `app/studio/shop/preorders/page.tsx`, `app/shop/[id]/page.tsx`, `app/u/[username]/page.tsx`, `app/studio/shop/analytics/page.tsx`, `app/shop/success/page.tsx`, `app/shop/cancelled/page.tsx`.
- App-Hooks: `lib/useShop.ts` (ProductOrder+Reviews+Disputes+Rating-Hooks), `lib/useNotifications.ts`, `lib/usePushNotifications.ts`.
- App-UI: `app/shop/{my-orders,fulfillment,[id]}.tsx`, `app/(tabs)/notifications.tsx`, `components/shop/{OrderReviewControl,OrderDisputeControl}.tsx`, `components/profile/UserProfileContent.tsx`.

### Gotchas Session 2 (sonst Zeitfresser — auch als Memory gespeichert)
- **3 Notification-Surfaces** (`vibes-three-notification-surfaces`): ein neuer `notifications.type` muss In-App (App+Web), Expo-Push **und** Web-Push kennen + im CHECK stehen, sonst falsche/generische Texte. Insert scheitert sonst **still** (RPCs `EXCEPTION WHEN OTHERS THEN NULL`).
- **Realtime-Channel-Namen müssen pro Hook-Instanz eindeutig sein** (`useUnreadShellCounts` läuft mehrfach pro Seite) — geteilter Name → „cannot add postgres_changes callbacks after subscribe()" → **jede eingeloggte Seite crasht**. Fix: Random-Suffix + try/catch. (Hat diese Session einen Prod-Crash verursacht → gefixt in `43a117f`.)
- **PostgREST-Embed** (`vibes-postgrest-profiles-embed`): `user:profiles(...)` 400t wenn die Tabelle auf `auth.users` FK't statt `profiles`.
- **`sold_count`**: nur `buy_product` (Coins) zählte hoch — Echtgeld-Verkäufe brauchen den Webhook-Bump (sonst „0× verkauft"). Coin- vs €-Umsatz sind getrennte Einheiten (Analytics zeigt beide separat).
- **ESLint `react/no-unescaped-entities`**: gerade `"` im JSX-Text bricht den Vercel-Build — deutsche typografische `„…"` nutzen.
- **zsh + Inline-`#`-Kommentare** in Befehlen: zsh interpretiert `#` interaktiv NICHT als Kommentar → wird als Argument übergeben („Invalid Function name"). In Befehlen für Zaur keine Inline-Kommentare.

### Offen / nächste Schritte (Echtgeld)
- **Produktseite Verkäufer-Bewertung** ist gebaut; ggf. weitere Plätze (Shop-Karten) optional.
- **Stripe Test→Live** + AGB/Widerruf/Impressum/GoBD **vor echten Kundenzahlungen** (Memory `vibes-stripe-coinshop`). Stripe-Branding (Logo/Farbe) im Dashboard.
- **Auto-Refund** bei Storno nach Zahlung: bewusst NICHT gebaut (Phase 2 mit Recht). Aktuell: Käufer kontaktiert Verkäufer / Admin klärt Dispute manuell.
- Bestell-KPI „Umsatz brutto" (`/studio/orders`) + „Einnahmen"-Seite sind **Coin**-denominiert (Echtgeld via Stripe-Dashboard + Shop-Analytics-€).

---

## 1. 🌟 Was diese Session gebaut wurde (alles live)

### A) EUR-Preisfeld für Vorbestellungen (`products.price_eur`)
- **Problem**: Vorbestell-Produkte (`sale_mode <> coins`) hatten keinen sinnvollen Coin-Preis → Karte zeigte „Preis siehe Beschreibung".
- **Migration `20260624170000_product_price_eur.sql` ✅**: `products.price_eur numeric(10,2)` (nullable, CHECK > 0) + `get_shop_products`/`get_saved_products` geben `price_eur` zurück (DROP+CREATE).
- **Web**: `shared/types/shop.ts` + `shared/schemas/product.ts` + `apps/web/lib/data/shop.ts` (PRODUCT_COLUMNS), `apps/web/app/actions/shop.ts` (createProduct), **„Preis (€)"-Feld** im `product-form.tsx` (erscheint nur bei Vorbestell-Produkten), Anzeige in Karte/Detail/Buy-Bar/Studio-Zeile. `formatEur`-Helper in `apps/web/lib/utils.ts`.
- **App**: `lib/useShop.ts` (`price_eur` + `formatEur`), Anzeige in `app/shop/[id].tsx` + `app/shop/index.tsx`.
- **So nutzt Zaur es**: Web Shop-Studio → Produkt „⋯ → Als Vorbestellung" → Produkt **Bearbeiten** → Feld „Preis (€)" (mit Punkt, z.B. `7.90`).

### B) Teilbare Produkt-/Video-Links mit reicher Vorschau (WhatsApp-Unfurl)
- **App teilt jetzt den HTTPS-Web-Link** (`https://serlo-web.vercel.app/p/<id>` bzw. `/shop/<id>`) statt `serlo://`/`vibes.app` → unfurlt mit Bild+Titel. (`app/shop/[id].tsx` Share, preorder-aware Preis-Text.)
- **Gebrandetes OG-Bild** (`apps/web/app/shop/[id]/opengraph-image.tsx`): Cover + Titel + €-Preis. Cover ist WebP → **Satori kann kein WebP** → on-the-fly JPEG-Konvertierung via `images.weserv.nl` (neuer Helper `apps/web/lib/og-image.ts` → `loadImageDataUri`).
- **ALLE 16 OG-Routen repariert** (`commit 69fa92d`): Satori erlaubt kein `inline-block`/`inline-flex`, jedes Element mit >1 Kind braucht `display:flex`, keine `undefined`-Style-Werte, kein WebP-`<img>`. Symptom war HTTP 200 + 0-Byte-PNG („Bild lädt nicht"). Siehe Memory `vibes-og-image-satori`.
- **WICHTIG für Zaur**: Video teilen = **Teilen-Button am Post** nutzen (`serlo-web.vercel.app/p/<id>`), NICHT Browser-Rechtsklick „Videolink kopieren" (= rohe `.mp4`, unfurlt nie).

### C) Vorbesteller kontaktieren (Verkäufer-Dashboard)
- **Migration `20260625120000_notify_preorder_buyers.sql` ✅**: SECURITY-DEFINER-RPC `notify_preorder_buyers(product_id, message)` — Verkäufer/Admin-Gate, schreibt allen Interessenten (status='interested') eine DM + setzt sie auf 'notified' (idempotent, umgeht 500ms-DM-Cooldown + product_preorders-RLS).
- **Dashboard** `/studio/shop/preorders`: **„✉️ Anschreiben"** pro Person (öffnet 1:1-DM via `getOrCreateConversation`) + **„Alle anschreiben"** pro Produkt (Dialog mit editierbarem Text). Status-Badge „✓ angeschrieben". Komponente `apps/web/components/shop/preorder-contact.tsx`.

### D) Vormerkung zurücknehmen (App + Web)
- Käufer kann seine Vormerkung selbst löschen (RLS erlaubt's, keine Migration). Web: „Zurücknehmen"-Link in der Buy-Bar; App: Button tippbar → Bestätigungs-Alert. `preordered_by_me`-Flag in `getProduct` (Web) / `useMyPreorder`-Hook (App). Commit `42879ae`.

### E) Geteilte Produkte im Chat als Karte (statt roher Text)
- Chat-Renderer erkennt `/shop/<uuid>` im Nachrichtentext → rendert Produktkarte (Cover+Titel+Preis). Funktioniert rückwirkend (kein DB-Change, Inhalt wird geparst). Web: `apps/web/components/messages/product-link-card.tsx` (Commit `2400f4b`). App: `ProductPreviewCard` in `app/messages/[id].tsx` (Commit `3e844c7`).

### F) Chat-Bugfixes (Web) — Commit `66e75d9`
- **Bild-Upload**: Storage-Bucket `chat-images` war nie angelegt → **Migration `20260625130000_chat_images_bucket.sql` ✅** (öffentlich, 10 MB, Bild-MIME, Insert nur eigener Ordner).
- **GIF doppelt**: Realtime-Dedup verglich `content` (optimistisch `null` vs DB `''`) → fix: null/'' normalisieren + `image_url` mitvergleichen.
- **Unsichtbare Hover-Buttons**: Reply/Reaktion-Icons erbten weiße Schrift auf weißem `bg-card` → `text-foreground`.

### G) Chat-Bubble-Redesign
- **Web**: eigene Bubbles **gedämpftes Graphit** (`bg-neutral-700`, vorher hartes Schwarz/Lila — Zaurs Wahl), Medien (Bild/GIF/Produkt) **randlos** (overflow-hidden Bubble, Text+Zeit im gepolsterten Footer, reines Bild → Zeit als Overlay).
- **App**: Bubbles **graphit** (`#404040`/`#48484A`, kein Blau mehr), Bilder ohne Crop (`ChatImage` mit dynamischem Seitenverhältnis via onLoad), Produkt-Cover größer.
- **App-Ausrichtung (`2528174`)**: `bubbleRow` ist jetzt **Spalten-Container**, innerer Wrapper nutzt `alignSelf`: eigene `flex-end`, fremde `flex-start`. Reply-Icon `position:absolute`. (Zaur hat in dieser Session „so passt es" zu den Kommentaren gesagt; Chat-Bubbles nicht erneut bemängelt.)

### H) Shop TikTok-Redesign + vermietbare Werbe-Banner-Fläche
- **`app/shop/index.tsx` komplett umgebaut** (TikTok-Layout): Titel+Coins → volle Suchleiste (immer sichtbar) → Menü-Shortcuts mit Icons (Bestellungen/Favoriten/Coins/Mein Shop, alle Routen existieren) → **Werbe-Banner-Karussell** (auto-swipe 3.5s + Finger, Punkte) → dünne Text-Kategorien ohne Icons (Unterstrich-Aktiv: Alle/Angebote/Physisch/Digital/Service/Sammler/Frauen, mappt auf vorhandene Filter, KEINE Migration) + Sortier-/Filter-Icon (Sheet) → Produkt-Grid (unverändert). Eine einzige FlatList (Kopf scrollt mit), „Verkaufen"-FAB bleibt.
- **Migration `20260626120000_shop_banners.sql` ✅**: Tabelle `shop_banners` als **VERMIETBARE Werbefläche** gebaut (Zaur will Plätze vermieten + eigene Werbung). Felder: tag/title/subtitle/image_url/bg_color/link/sort_order/active + Vermietung (`advertiser_label`, `starts_at`/`ends_at`) + Analytics-ready (`impression_count`/`click_count`). RLS: jeder liest aktive+im-Zeitfenster, nur Admin schreibt. RPC `get_active_shop_banners()` (SECURITY DEFINER). 3 Launch-Banner geseedet. Hook `useShopBanners` in `lib/useShop.ts`. `link`: `tab:<key>` = In-App-Kategorie, `/route` = Navigation. Voller Ad-Server (Buchung/Abrechnung) aufgeschoben bis jemand mietet.

### I) Seamless-Kommentare (Video läuft beim Öffnen weiter) + contain/Blur-Fill
- **Kern-Mechanik** (Memory `vibes-seamless-comments-video`): `CommentsSheet` Prop **`seamlessPeek`** (durchsichtige Oberkante, kein Dim-Overlay → darunterliegendes Video scheint durch) + optional **`sheetProgress`** (SharedValue, schrumpft Video in-place auf ~40%). DERSELBE Player läuft weiter — nie zweite Instanz (Falle: `RESUME_MIN_SEC=60` → kurze Clips starten bei 0). `contentFit` cover↔contain (reine Anzeige, kein Reload).
- **Feed** (`FeedItem.tsx`): seamless in-place (Video schrumpft auf 40%, läuft, Overlays faden aus). `!commentsOpen` aus actualShouldPlay entfernt.
- **Guild-Detail** (`app/guild-post/[id].tsx`, Vollbild-Pager): seamless wie Feed.
- **Guild-Karte** (`GuildCard.tsx`, Scroll-Liste): in-list `seamlessPeek` OHNE `sheetProgress`/Scroll (Instagram-Stil, Video bleibt sichtbar oben, kein Schrumpf — Scroll/Schrumpf würde via removeClippedSubviews remounten = Neustart). **Falle gefixt:** instabile `onProgress`-Prop (inline `()=>{}`) triggerte den Restart-Effekt in FeedVideo → Neustart bei jedem Re-Render. Lösung: stabile `NOOP_PROGRESS`-Konstante. Feed/Detail nutzen `useCallback` → waren nie betroffen.
- **contain + Blur-Fill überall**: Feed, Guild-Karten, Guild-Detail zeigen Medien jetzt vollständig (`contentFit="contain"`) mit unscharfem Blur-Fill-Rand statt seitlichem Cover-Beschnitt (Querformat war abgeschnitten).

### J) 💶 Phase-1 Echtgeld-Bestellsystem (physische Ware / Parfüm) — Backend + App + Web
**Leitprinzip:** Echtes Geld läuft über **deinen Stripe** (du = Verkäufer, KEIN Connect in Phase 1). Strikt getrennt vom virtuellen Coin/Diamant-System. Marktplatz-nativ entworfen („du = Verkäufer #1") → Drittverkäufer später = nur Onboarding, kein Umbau. Architektur-Details: Brain `decisions/2026-06-27-serlo-finanz-architektur`.

- **Parfüm-Bezahllogik (Zaurs Entscheidung):** Vormerken (0 €) → du sammelst → du bestellst beim Lieferanten (streckst EK vor) → Ware da → **User zahlt** → Versand. Status: `reserved → payment_requested → paid → shipped → delivered`.
- **Migration `20260627120000_shop_real_money_orders.sql` ✅**: Tabellen `seller_accounts` (Zaur als #1, Provision 0; `platform_fee_bps`/`stripe_connect_id` für später) + `product_orders` (echte €-Bestellungen, Versand/Tracking/Stripe-Felder, Status-Maschine, RLS service-write/party-read).
- **Migration `20260627130000_shop_order_flow_rpcs.sql` ✅**: SECURITY-DEFINER-RPCs `mark_preorders_payable(product)` (Ware da → erzeugt payment_requested-Orders aus Vormerkungen + Push), `set_order_shipped(order, carrier, tracking)`, `confirm_order_delivered(order)`.
- **Edge Functions deployed**: `create-checkout-session` erkennt `{ order_id }` → Stripe-Checkout (€, Versandadresse via Stripe eingesammelt). `stripe-webhook` setzt `payment_requested → paid` (claim-before-update), speichert Adresse, benachrichtigt Verkäufer.
- **App-Frontend**: `lib/useShop.ts` (ProductOrder-Typ + Hooks: useMyProductOrders, useSellerProductOrders, usePayProductOrder, useConfirmOrderDelivered, useMarkPreordersPayable, useSetOrderShipped). Screens: `app/shop/my-orders.tsx` (Käufer: bezahlen/tracken/Erhalten — Shop-Shortcut „Bestellungen" zeigt hierher), `app/shop/fulfillment.tsx` (Verkäufer: Ware-da + versendet). 
- **Web-Frontend (Parität)**: `apps/web/lib/data/shop.ts` (getMyProductOrders, getMyPreorderGroups), `apps/web/app/actions/shop.ts` (payProductOrder, markPreordersPayable, setOrderShipped, confirmOrderDelivered), `apps/web/components/shop/product-orders-panel.tsx`, eingebunden in `apps/web/app/studio/orders/page.tsx` (Toggle Käufe/Verkäufe → Abschnitt „Echtgeld-Bestellungen").
- **Vormerk-Benachrichtigung-Fix (`20260627140000`, 🔴 NOCH AUSFÜHREN)**: `express_product_interest` schrieb Notif `type='preorder_interest'`, war aber nicht in `notifications_type_check` → Insert scheiterte still. Migration erweitert den CHECK dynamisch. Renderer (App+Web) behandeln `preorder_interest`; `'gift'` fällt auf `comment_text` zurück (Bestell-Pings lesbar). „Ware ist da" (Web) zeigt jetzt **wer** (Namen) + Anzahl + seit-wann; Bestellzeilen mit Datum/Uhrzeit.

> ⚠️ **NICHT kundenreif:** Stripe noch **Test-Modus** (Memory `vibes-stripe-coinshop`), **AGB/Widerruf/Impressum/GoBD fehlen**. Zum Testen bereit, nicht für echte Kunden-Zahlungen.

> ⚠️ **Zwei Vorbestell-Oberflächen (verwirrend, sollte konsolidiert werden):** `/studio/shop/preorders` (ALT: „Alle anschreiben" = nur DM, keine Zahlung) vs `/studio/orders?role=seller` → „Ware ist da → Anfordern" (NEU: erzeugt bezahlbare Order). Idee: „Zahlung anfordern" auf die preorders-Seite holen.

---

## 2. 🌸 Parfüm-Preisstrategie (Entscheidungen — nicht neu auswürfeln)

- **Geschäft**: Öl-Parfüm 10 ml Roll-on, alkoholfrei/halal (USP gegen Duftparadies), Dupes. Recherche-Ordner: `~/perfume-price-research/` (Excel `parfuem_preise.xlsx`, `STRATEGIE.md`, `PLAN-APP-FUNNEL.md`, `SHOP-TEXTE*.md`).
- **Einkaufspreis (EK) pro Flasche**: Zaur bekannt, **GEHEIM — nicht in getrackte Dateien/UI**. Marge auf allen Stufen gesund.
- **Preis-Stufen (runde Zahlen)**: Klassiker **9,90 €**, Premium **16,90 €**, Luxus **24,90 €**, Nische **39,90 €**. Vorbesteller-Aktion optional 1 Stufe drunter.
- **Anker NICHT über „Original kostet X" bei günstigen Düften** (oft teurer als Original/10 ml) — USP ist Öl/halal/Community, nicht Preis.
- **Rabatte NIE stapeln** (−20 % Vorbesteller UND −30 % Willkommen = gefährlich auf der Einstiegsstufe). Beides existiert aktuell nur als TEXT, keine Rabatt-Engine im Code.
- **Kein Streichpreis-Feld** (Geschmacks-/Rechts-Risiko Mondpreis) — nur Endpreis. Dringlichkeit via ehrlichen Text („nach Launch X €").
- **Phasen**: 0 Vorbestellung (kein Geld) ✅ · 1 Zaurs eigener Stripe-Direktverkauf (kein Connect) **✅ GEBAUT (Test-Modus)** — siehe §1-J · 2 Marktplatz mit Connect+Escrow (erst bei Verkäufer-Nachfrage, „du = Verkäufer #1"-Architektur liegt schon). Geld-Architektur: Coins=nur digital (IAP-Pflicht), physisch=echtes Geld/Web/Stripe (Apple verbietet IAP für Physisches).
- **Wachstums-Flywheel (Zaurs Plan)**: Parfüm = Türöffner → Sammelbestellung (nur Samstag-Fenster, „ist mein Parfüm da?"-Tracking = Wiederkehr-Hook) bringt User rein → zurückkehrende Käufer werden selbst **Verkäufer** → mehr Ware → mehr Käufer. Deshalb ist der Marktplatz Wachstumsmotor, nicht Nachgedanke.
- **Geld-Pre-Mortem (wichtig):** Bei 0 Usern bringen alle plattform-abhängigen Einnahmen 0 €. Einzige funktionierende Quelle jetzt = Zaur verkauft sein Parfüm an selbst-reingebrachte Leute. **Erst Verkauf validieren, dann Maschine.** Coin-Ökonomie verdient aktuell nichts/Minus (70% Diamanten @ 0,02 € > Coin-Preis) → kalibrieren. Details: Brain `outputs/2026-06-27-serlo-geld-premortem` + `decisions/2026-06-27-serlo-monetarisierung-roadmap`.

---

## 3. 🚀 OFFEN / Nächste Schritte

1. ✅ **ERLEDIGT (Session 2)**: Bestell-/Vertrauens-System komplett (Notif-Typen, Reviews, Dispute, Reputation, sold_count/€-Umsatz, Konsolidierung, Direktkontakt). Polish-Backlog von früher (§3.7 a/b/c) ist damit auch abgehakt. **Keine offene Migration.**
2. **🚀 Parfüm-Launch / Phase 0 validieren** (= jetzt der eigentliche nächste Schritt): erst **offline** verkaufen (Community/Bruder), dann Leute in die App holen. 20–30 Hero-Düfte als Vorbestellung einstellen (Web Shop-Studio), Links teilen (**OHNE www!**). **Erst-Verkauf beweisen, bevor mehr gebaut wird.**
3. **Stripe Test → Live** umstellen, sobald echte Kunden zahlen sollen: Keys `sk_live_`, Live-Webhook (Memory `vibes-stripe-coinshop` hat den Plan). VORHER **AGB + Widerruf + Impressum + GoBD-Rechnung** (Anwalt/Steuerberater) — kein Rechtsrat von mir.
4. **UG (haftungsbeschränkt)** gründen, spätestens bevor Drittverkäufer (Phase 2) Geld über die Plattform bewegen. Kappt Privathaftung (Zaur angestellt). Steuerberater ab erstem stetigen Umsatz; §19 → Regelbesteuerung bei 22.000 €.
5. **Coin-Ökonomie kalibrieren** (verdient aktuell nichts): Diamant-Quote 70%→~30-40%, Auszahlkurs/Coin-Preis so, dass Plattform ≥50% behält. Cashout über lizenzierten Rail. (Phase 2, wenn User da.)
6. **Phase 2 — Marktplatz scharf schalten** (andere Verkäufer): Stripe Connect + KYC + Escrow + Dispute. Architektur liegt schon (seller_accounts, platform_fee). Erst bei echter Verkäufer-Nachfrage.
7. **Polish-Backlog Finanz** (Session 2 erledigt: eigene Notif-Typen ✅, App-`my-orders`-Datum ✅, Vorbestell-Konsolidierung ✅). **Noch offen/optional**: Stripe-Branding (Logo/Farbe im Dashboard); Streichpreis bewusst NICHT; Auto-Refund erst Phase 2.
8. **Altlasten**: 🔴 Google-Login-Bug („upstream request timeout" am Supabase-Callback, `docs/auth-setup.md`) · E-Mail/Resend kaputt → Android-Signup-Lücke (`docs/auth-setup.md` Schritt 1) · Referral-System erst manuell (Bruder ~10-15 %, Kunde ~10 % Erst-Rabatt), dann bauen.

---

## 4. 🚀 Deploy-Workflow (Runtime 1.30.0)
```bash
# IMMER aus /Users/zaurhatuev/vibes-app

# Web: deployt automatisch bei Push zu main (Vercel). Vor Prod-Push:
cd apps/web && npx tsc --noEmit && npm run build   # beide grün halten

# Mobile OTA (reines JS) — EAS_BUILD=1 ZWINGEND (sonst Expo-Go-Stubs im Prod-OTA)
EAS_BUILD=1 npx eas update --branch production --message "…" --non-interactive
#   → OTA zieht nur beim KALTEN App-Neustart (App-Switcher → hochwischen)!

# Native Build (nur neue native Deps) — app.json: version 1.30.0, ios.buildNumber 286
npx eas build --platform ios --profile production && npx eas submit --platform ios --latest

# Push zu GitHub (PAT aus .env.local, NIE echoen!)
TOKEN=$(grep -E '^GITHUB_TOKEN=' .env.local | cut -d= -f2-)
git push "https://x-access-token:${TOKEN}@github.com/vibestes-boop/vibes-app.git" HEAD:main
#   ⚠️ aktualisiert origin/main-Tracking NICHT → mit `git ls-remote` verifizieren.

# Edge Functions: npx supabase functions deploy <name>  (Webhooks: --no-verify-jwt)
```
- **DB-Migrationen**: `.sql` unter `supabase/migrations/` (14-stellig), **Zaur führt sie im Supabase-SQL-Editor aus.** Return-Type-Change einer RPC = DROP + CREATE.
- **Reihenfolge**: Bei Web-Selects auf neue Spalten (direktes PostgREST) → **Migration ZUERST**, dann pushen, sonst bricht der Shop (Spalte fehlt). Bei reinen RPC-Calls/Buttons ist die Reihenfolge egal.
- **Verifizieren vor Commit** (Zaur: „commits kosten Geld"): Root `npx tsc --noEmit` (Baseline = **2 harmlose `rose`-Fehler** in explore/guild-Styles) + apps/web `npm run build`.

---

## 5. ⚙️ Gotchas / Architektur
- **Ein Supabase für beide**: App (Expo) + Web (Next.js) am SELBEN Projekt (`llymwqfgujwkoxzqxrlm`). DB-Last trifft beide.
- **Externe Dienste**: Cloudflare **R2** (+ Bunny CDN) = Bilder/Videos; **LiveKit** = Live; **Stripe** (Web)/**RevenueCat** (App) = Geld; Sentry; OpenAI (KI-Bild).
- **OG-Bilder (next/og + Satori)**: 4 stumme 0-Byte-Fallen — kein `inline-block`/`inline-flex`, >1 Kind braucht `display:flex`, kein `undefined`-Style-Wert, kein WebP-`<img>` (→ `lib/og-image.ts` weserv-Helper). Debug: `next dev` + curl die Route + Logs. Memory `vibes-og-image-satori`.
- **Chat-Bild-Upload** → Storage-Bucket `chat-images` (öffentlich, eigener-Ordner-RLS).
- **App-Chat-Ausrichtung**: horizontale Bubble-Ausrichtung über **Spalten-Container + `alignSelf`** (in Row geht's nicht zuverlässig). Reply-Icon `position:absolute`.
- **Coin-Saldo** in `coins_wallets` (`coins`/`diamonds`), NICHT `profiles.coins_balance`.
- **ZWEI Bestell-Systeme nicht vermischen**: `orders` = coin/digital (total_coins) · `product_orders` = echtes € (amount_eur, Phase 1). Vormerkungen = `product_preorders`.
- **`notifications.type` hat CHECK-Constraint** — neue Typen IMMER per Migration ergänzen, sonst scheitert der Insert **still** (RPCs haben `EXCEPTION WHEN OTHERS THEN NULL`). Dynamische Erweiterung: siehe `20260627140000`. Renderer (App `app/(tabs)/notifications.tsx` + Web `components/notifications/notification-list.tsx`) müssen den Typ auch kennen.
- **Finanz-Prinzip**: nie fremdes Geld halten — echtes Geld über Stripe (Phase 1: Zaurs Account) / später Stripe Connect (lizenzierter PSP). Coins = nur digital.
- **`supabase/SCHEMA.md`** = Source-of-Truth für reale Spalten (`profiles` hat KEIN `follower_count`).
- **FlashList + numColumns** = einspaltig → Grids mit RN-FlatList. **Reanimated** statisch importieren. **Status-Bar** `useThemedStatusBar` pro Screen. **Light-Mode**: kein hartes Weiß auf theme-Flächen.
- **Pre-existing tsc-Baseline = 2** (`'rose'` in explore/guild-Styles).

---

## 6. 🧠 Gedächtnis + Über Zaur
- **Strategie/Finanz im Brain (gbrain `~/brain`)**: `decisions/2026-06-27-serlo-finanz-architektur` (Geldfluss, „du=Verkäufer #1", Stripe-Connect-Zielbild, Parfüm-Bezahllogik), `decisions/2026-06-27-serlo-monetarisierung-roadmap` (8 Einnahmequellen, Phasen, Coin-Ökonomie-Warnung), `outputs/2026-06-27-serlo-geld-premortem`. Lesen via `mcp__gbrain__get_page` / `search`. Bei neuer Strategie-Entscheidung dort aktualisieren (`put_page` + `sync_brain`).
- Memory: `~/.claude/projects/-Users-zaurhatuev-vibes-app/memory/` (lädt automatisch). Relevant: `vibes-seamless-comments-video` (Video-läuft-beim-Kommentar + onProgress-Falle), `vibes-shop-banner-adspace` (vermietbare Banner), `vibes-og-image-satori`, `vibes-stripe-coinshop`, `vibes-shop-digital-delivery`, `vibes-ota-eas-update-stubs` (EAS_BUILD=1!), `vibes-reanimated-static-import`, `vibes-flashlist-numcolumns-bug`, `vibes-statusbar-theme`, `vibes-lightmode-contrast-bug`, `vibes-web-deps-isolation`.
- **Zaur**: Solo-Gründer, deutschsprachig (tschetschenische Community). **Kostenbewusst** (validieren vor bauen; „commits kosten Geld"). Macht **DB-Migrationen + Secrets + Compute selbst** im Dashboard. **Credentials/EK NIE im Chat oder in getrackten Dateien.** Testet Mobile auf dem Gerät → iterativ OTA → Feedback (App-Neustart nötig fürs OTA!). Bevorzugt knapp/direkt/warm, eine Sache pro Commit. Neues Geschäft: **Öl-Parfüm** (Sammelbestellung), Bruder + Community als Wachstums-/Reseller-Kanal.
- **Verifikations-Grenze**: Web-Chat + App sind login-geschützt / nicht headless prüfbar — visuelle Bestätigung läuft über Zaurs Screenshots.
