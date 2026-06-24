# Handoff — Serlo/Vibes (Stand 24. Juni 2026, Abend)

> 📍 **Dieses Dokument: `/Users/zaurhatuev/vibes-app/handoff.md`** (= `HANDOFF.md`, APFS case-insensitive).
> Arbeite NUR in diesem Repo: **`/Users/zaurhatuev/vibes-app`** (Branch `main`).
> ⚠️ NICHT verwechseln mit der Quarantäne-Kopie `/Users/zaurhatuev/Desktop/vibes-app` — die NIEMALS lesen/bauen/pushen.
>
> Übergabe für den Wechsel in einen neuen Chat. **Vollständig.** Gedächtnis-Dateien
> (`~/.claude/.../memory/`) laden automatisch — dieses Doku ergänzt sie mit Session-Detail.
> (Ersetzt den Handoff von früher am 24.06.)

---

## 0. Schnell-Status

| Bereich | Stand |
|---|---|
| **Repo / Branch** | `/Users/zaurhatuev/vibes-app` · `main` · Working Tree **sauber** |
| **Letzter Commit** | `ffc2222` — App-Vorbestellung (Parität zum Web). **Alle 17 Session-Commits gepusht.** |
| **Web (apps/web)** | deployt via **Vercel** auf Push zu `main`. **Live: `serlo-web.vercel.app` — ⚠️ OHNE `www`!** (`www.serlo-web.vercel.app` wirft Zertifikatsfehler `ERR_CERT_COMMON_NAME_INVALID`, weil `*.vercel.app` das www-Sub-Sub nicht abdeckt. Beim Teilen IMMER ohne www.) |
| **App-Build** | v1.30.0 / iOS-Build 286 (TestFlight) · Runtime 1.30.0 |
| **DB-Migrationen (24.6., alle ✅ von Zaur ausgeführt)** | `20260624120000` nav_slots · `20260624140000` preorder_phase0 · `20260624150000` orders_product_id_nullable · `20260624160000` shop_rpc_sale_mode |
| **OTAs veröffentlicht (24.6.)** | `db12efd4…` (Nav-DB-Sync + Feed/Shop-Fixes) · `7ebcaf57…` (App-Vorbestellung). Beide Runtime 1.30.0, iOS+Android. |
| **Supabase Compute** | **auf Micro hochgestuft** (~10 $/Mon, 1 GB, IO-Baseline 5→**11 MB/s**). Pro-Plan. |
| **Admin** | Zaur (`username='zaur'`, id `46c70dfb-…`) hat `profiles.is_admin = true` ✅ — nötig fürs Vorbestell-Gate. |
| **GERADE IN ARBEIT** | Nichts mitten drin. Parfüm-Vorbestellung (App+Web) komplett ausgeliefert. |

⚠️ **Quarantäne:** `/Users/zaurhatuev/Desktop/vibes-app` — NIEMALS bauen/deployen/pushen.

---

## 1. 🌟 Kernstück dieser Session: Parfüm-Vorbestellung / Sammelbestellung (Phase 0)

**Kontext (Zaurs Geschäft):** Zaur verkauft **Öl-Parfüm** (10 ml Roll-on, „Dupes"/inspiriert von Designer-Düften). Er hat **noch kein Lager-Geld** → Modell = **Sammelbestellung**: Leute drücken **„Vormerken"** (KEIN Geld), er sammelt genug Interesse, macht die Großbestellung, kassiert **erst bei Lieferung** (manuell/offline). Das validiert Nachfrage ohne Lager-Risiko und ohne Zahlungs-Infrastruktur am Tag 1.

**Status: KOMPLETT gebaut & ausgeliefert — App + Web, gemeinsame DB, ein gemeinsames Interessen-Dashboard.**

### DB-Fundament (`migrations/20260624140000_perfume_preorder_phase0.sql` ✅)
- **`products.sale_mode`** Enum (`coins` | `preorder` | `cash`), Default `coins` → normaler Coin-Shop unangetastet. `cash` = Platzhalter für Phase 1 (Stripe). Index auf `sale_mode <> 'coins'`.
- **Admin-Gate-Trigger** `enforce_sale_mode_admin`: nur Admin (oder service_role) darf `sale_mode <> coins` setzen → „nur meine Parfüms" ist DB-erzwungen (Nicht-Admins werden still auf `coins` zurückgestuft).
- **`product_preorders`-Tabelle**: `product_id, user_id, quantity, note, status` (Lifecycle `interested|notified|paid|shipped|cancelled` — Phase 0 nutzt die ersten, Phase 1 schaltet paid/shipped scharf), `UNIQUE(product_id,user_id)` (Upsert). RLS: Käufer verwaltet eigene, Verkäufer/Admin liest die seiner Produkte.
- **RPCs**: `express_product_interest(p_product_id, p_quantity, p_note)` (Käufer, kein Geld, benachrichtigt Verkäufer via `notifications` type `preorder_interest`), `get_my_preorder_summary()` (Dashboard-Übersicht: Leute/Flaschen pro Produkt), `get_product_preorders(p_product_id)` (Namensliste zum Anschreiben).

### App-RPC-Erweiterung (`migrations/20260624160000_shop_rpc_sale_mode.sql` ✅)
- Die App liest Shop-Liste **und** Detail über die RPC `get_shop_products` (`products.find(p => p.id === id)`). Diese RPC + `get_saved_products` geben jetzt **`sale_mode` mit zurück** (DROP+CREATE wegen Return-Type-Change). Ohne das sah die App jede Vorbestellung weiter als „Jetzt kaufen". (Web nutzt direkte Selects → hatte sale_mode schon.)

### Web (Commits `5c241b6`, `cfd6a1b`, `815dcbf`, `e341144`)
- **Admin-Schalter**: Shop-Studio (`/studio/shop`) → Produkt-Zeile **„⋯ → Als Vorbestellung"** (nur Admin sichtbar via `getIsAdmin`; `setProductSaleMode`-Action; DB-Trigger erzwingt zusätzlich). **WICHTIG: Der Schalter ist im Creator-Studio, NICHT auf der öffentlichen Produktseite.**
- **Produktkarte + Detail**: bei `sale_mode=preorder` → **„Vormerken"** + Mengenfeld statt Coin-„Kaufen", **kein Coin-Preis** (Hinweis „Vorbestellung · Preis siehe Beschreibung"), Hinweis „Sammelbestellung — du zahlst erst bei Lieferung". Nutzt `express_product_interest` via `expressProductInterest`-Action/Hook.
- **Dein Dashboard**: `/studio/shop/preorders` — aggregiertes Interesse („Duft X — 8 Leute · 14 Flaschen") + Namensliste. Link im Shop-Studio.
- **Foto-Upload im Produkt-Formular** (`product-form.tsx`): Das Formular hatte NUR URL-Eingabe (kein Datei-Upload). Jetzt **„Foto hochladen"** für Cover + Galerie → komprimiert (`compressImage`) → R2 via presigned PUT (`requestR2UploadUrl`, Prefix `products/images/{userId}/…`). Der Prefix musste in BEIDEN Allowlists stehen: `r2-sign`-Edge-Function (war schon) UND `apps/web/app/actions/posts.ts ALLOWED_KEY_PREFIXES` (`e341144` ergänzt).

### App (Commit `ffc2222`, OTA `7ebcaf57`)
- `lib/useShop.ts`: `sale_mode?` im `Product`-Type + `useExpressInterest`-Hook (RPC).
- `app/shop/[id].tsx`: bei preorder → „Vormerken"-Button (kein Geld, kein Confirm-Modal, `handleVormerken`), Coin-Preis aus, Mengen-Stepper aktiv, Hinweis. `PREORDER_ERRORS`-Map (warme Texte).
- `app/shop/index.tsx`: „Vorbestellung"-Badge (amber, höchste Badge-Priorität) + „Vormerken" statt Coin-Preis.

### So legt Zaur ein Vorbestell-Produkt an (für neuen Chat zum Erklären)
1. serlo-web → Shop-Studio → **Neues Produkt**. Titel (Duftname), **Beschreibung mit EUR-Preis** („…12 € — zahlbar bei Lieferung"), Kategorie **Physisch**, **Foto hochladen**, **Preis (Coins) = Platzhalter `1`** (irrelevant, wird bei Vorbestellung nicht angezeigt/abgebucht), Bestand beliebig.
2. Shop-Studio → beim Produkt **„⋯ → Als Vorbestellung"**.
3. Fertig — Detailseite zeigt „Vormerken". App + Web identisch, gemeinsames Dashboard.

---

## 2. 🧭 Strategische Entscheidungen (damit ein neuer Chat sie NICHT neu auswürfelt)

Diese wurden in dieser Session durchgesprochen und sind die Leitplanken:

- **Geld-Architektur (TikTok-Modell):**
  - **Coins = NUR digital** (Live-Geschenke, digitale Shop-Artikel) → laufen über Apple/Google **IAP** (müssen sie auch — Apple verlangt IAP für Digitales).
  - **Physische Ware = echtes Geld** (Stripe). **Physische Ware über IAP/Coins ist ein Apple-Verstoß** (Apple verbietet IAP für Physisches) **+ 30 % Apple-Schnitt.** → Der aktuelle Coin-Kauf für physische Produkte ist auf iOS ein latentes App-Store-Risiko; die neue Trennung repariert das.
  - **0 %-Gebühren gilt nur im Web/Stripe**, nicht über App-Coins.
- **Verkaufsweg:** Physisches Parfüm läuft übers **Web/Stripe** (Euro, kein Install, keine Coins). Die **App** = Community/Hype/**Live-Drops** (das kann Duftparadies nicht).
- **Phasen-Plan (gestaffelt, validieren vor bauen):**
  - **Phase 0 = Vorbestellung** (kein Geld) — ✅ **DONE** (oben).
  - **Phase 1 = Zaurs EIGENER Stripe-Direktverkauf** (einfacher Stripe, ER ist einziger Verkäufer, KEIN Connect, kein DAC7). Kleiner Schritt — er hat Stripe schon (Coin-Shop, Testmodus). Bauen wenn Vorbestellung zieht.
  - **Phase 2 = Marktplatz mit Stripe Connect** (andere Verkäufer + Zaurs Gebühr pro Verkauf). Großer Bau + Recht (DAC7-Meldepflicht, Kleinunternehmer-Grenze 22k, AGB/Impressum/Widerruf, Steuerberater). **Erst bei echter Verkäufer-Nachfrage.** Hinweis: ein 30 %-Plattform-Schnitt existiert schon konzeptionell im Coin-Shop (`getShopAnalytics ×0.7`).
- **Referral/Reseller-Idee** (Bruder bekommt Code → gibt an Kunden → Anteil pro vermittelter Bestellung): **gute Idee** (Reseller-Modell, tappt fremde Netzwerke). **Erst MANUELL** starten (Code = Name, Liste führen, Anteil bei Lieferung zahlen). Wenn's zieht → echtes Referral-System bauen (Code-Tabelle, Code beim Vormerken, Referrer-Dashboard). Richtwert: Bruder ~10–15 %, Kunde ~10 % Erst-Rabatt — nur wenn die Marge das trägt.
- **Legal-Flags (Zaurs/Anwalts-Entscheidung, NICHT von uns final):**
  - **„inspiriert von [Marke]" im Titel = riskant** (Markenrecht/Rufausbeutung, EuGH L'Oréal ./. Bellure). Empfehlung: **eigener Name + Duftprofil/Noten beschreiben**, keine fremden Markennamen als Verkaufsargument.
  - **Kosmetik/Parfüm EU:** CPNP-Notifizierung, Responsible Person, INCI-Kennzeichnung.
  - **Kleinunternehmer (§19, keine USt.):** Parfüm-Volumen knackt die 22k-Grenze schnell → dann USt.-Pflicht.

---

## 3. Nav-DB-Sync (App + Web teilen die Bottom-Nav)

- **Migration `20260624120000_user_nav_slots.sql` ✅**: `profiles.nav_slot_2 / nav_slot_4` (text, NULL=Default, CHECK auf Feature-Keys).
- **Mobile** (`lib/tabBarStore.ts` + `app/(tabs)/_layout.tsx`): `setSlot2/4` schreiben zusätzlich nach `profiles`; `syncFromDb()` lädt die Wahl bei Login.
- **Web** (`mobile-bottom-nav.tsx`): liest `nav_slot_2/4` client-seitig (defensiv, Fallback guild/shop) und rendert Slot 2/4 dynamisch. Web-Default-Layout an die App angeglichen: **Feed · Guild · ➕ · Shop · Profil** (Commits `b9ede3e`, `45f7cfe`, OTA `db12efd4`).
- Effekt: Slot-Wahl in der App (Slot 2/4) erscheint auch im Web.

---

## 4. Web-Feed/Shop/Profil-Politur (Mobile-Ansicht, Commits `68aa2c3` `963679b` `b9ede3e` `3b3f5c6` `c120416` `99b42b1` `95382c7`)

Alles auf Basis von Zaurs Screenshots der **mobilen Web-Ansicht** (`serlo-web.vercel.app` am Handy):
- **Feed-Action-Rail**: war ein weißer Balken neben der Karte → jetzt **Overlay über dem Media** auf Mobile (weiße Icons, **keine Kreis-Schattierung**, Drop-Shadow), Querformat zentriert, Rail am **Viewport-Boden** verankert. Doppel-Mute + „Vorlesen"-Button **entfernt**. Ab `xl` unverändert (Rail neben Karte, theme-farben).
- **Hochformat = echtes Vollbild-Cover** auf Mobile (object-cover, randlos, keine weißen Streifen), Querformat bleibt contained.
- **Abspielbalken touch-fähig** (Pointer/Touch-Events statt Maus + `touch-none`) → Scrubbing per Finger.
- **Overlaps gefixt**: Caption/Abspielbalken/Rail werden über die fixe Bottom-Nav gehoben; Post-More-Button rutscht unter den Kopf-Cluster (Chat/Glocke/Avatar).
- **Tab-Pille** „Für dich/Folge ich/Freunde" flach (whitespace-nowrap, kein 2-Zeilen-Umbruch).
- **Bottom-Nav Plus-Button**: Serlo **Pink→Lila-Gradient** (App-Konsistenz).
- **Shop**: Header-Buttons als **vertikale Chips** (Icon oben/Label unten), **Coin groß+rahmenlos**, weniger Leerraum oben (`pt-16`→`pt-4`); **Produktkarten kompakt** (Bild 3:4 → **quadratisch**, minimale Gaps Mobile+Desktop).
- **Profil**: Hero-Top auf Mobile knapper.

---

## 5. Weitere Fixes dieser Session
- **Produkt-Löschen mit Bestell-Historie** (`migration 20260624150000` ✅ + `5ef5203`): `orders.product_id` war `NOT NULL`, FK aber `ON DELETE SET NULL` → Löschen scheiterte („null value in product_id…"). Spalte jetzt **nullable** → Löschen behält Bestell-Records, nullt nur die Produkt-Referenz. **+ Mehrfach-Auswahl/Löschen** im Shop-Studio („Auswählen"-Modus, Häkchen, Bulk-Delete).
- **Doppelte Produkt-Nachricht** (`b1e54c2`): Beim DM aus einer Produktseite (`?productId`) erschien die Nachricht doppelt — optimistische Vorschau (nur Text) ≠ Realtime-Row (Text+Produkt-Link) → content-Dedup matchte nicht. Fix: `finalContent` schon für die Vorschau.

---

## 6. OFFEN / Nächste Schritte
1. **🔴 Google-Login-Bug** („upstream request timeout" am Supabase-Callback `…/auth/v1/callback`): War wahrscheinlich **Folge der IO-Drosselung** (Auth-Callback schreibt in die gedrosselte DB). **Nach dem Micro-Upgrade neu testen** — gut möglich, dass es jetzt geht. Falls nicht: Auth-Logs ansehen + `Authentication → Hooks`/`Emails` prüfen (Details in `docs/auth-setup.md`). Web-Callback-Route ist `apps/web/app/auth/callback/route.ts` (sauber).
2. **IO-Budget**: Auf Micro hochgestuft (5→11 MB/s Baseline). **Diagnose ergab: KEINE bösen Queries** (Tabellen quasi leer, Seq-Scans trivial, keine fehlenden Indizes). Die IO kam aus Hintergrund-Last (Cron-Jobs, WAL/Vacuum) + heutigem IO-intensiven Bau-Tag. **Beobachten**; falls die Warnung im Idle dauerhaft bleibt → Top-Queries (pg_stat_statements) checken. Cron-Inventar: `publish-scheduled-posts` (jede Min), `cleanup-stale-lives`/`scheduled-lives`/`r2-delete-queue` (alle 5 Min) — unschedule-first-Muster, keine wilde Duplikation.
3. **🚀 Parfüm-Launch:** 20–30 **Hero-Düfte** einstellen (NICHT alle 600), auf Vorbestellung schalten, dann an Bruder + Community teilen. **Link OHNE www!**
4. **Phase 1 (Stripe-Direktverkauf)** bauen, wenn die Vorbestellung zieht.
5. **Referral-System** (erst manuell starten, dann bauen).
6. **E-Mail/Resend fixen** (offen seit langem — `docs/auth-setup.md` Schritt 1): E-Mail-Versand kaputt → Android-Signup-Lücke (Google ✅, Apple nur iOS).
7. **App-Vorbestell-Dashboard** (in der App) + hübscher Notification-Text für `preorder_interest` — bewusst weggelassen (Web-Dashboard reicht erstmal).

---

## 7. Deploy-Workflow (Runtime 1.30.0)
```bash
# IMMER aus /Users/zaurhatuev/vibes-app

# Web: deployt automatisch bei Push zu main (Vercel). Vor Prod-Push:
cd apps/web && npx tsc --noEmit && npm run build   # tsc + Build grün halten

# Mobile OTA (reines JS) — EAS_BUILD=1 ZWINGEND (sonst Expo-Go-Stubs im Prod-OTA)
EAS_BUILD=1 npx eas update --branch production --message "…" --non-interactive

# Native Build (nur neue native Deps) — app.json: version 1.30.0, ios.buildNumber 286, android.versionCode 47
npx eas build --platform ios --profile production && npx eas submit --platform ios --latest

# Push zu GitHub (PAT aus .env.local, NIE echoen!)
TOKEN=$(grep -E '^GITHUB_TOKEN=' .env.local | cut -d= -f2-)
git push "https://x-access-token:${TOKEN}@github.com/vibestes-boop/vibes-app.git" HEAD:main
#   ⚠️ aktualisiert den lokalen origin/main-Tracking-Ref NICHT → mit `git ls-remote …` verifizieren.

# Edge Functions: npx supabase functions deploy <name>  (Webhooks: --no-verify-jwt)
```
- **DB-Migrationen:** `.sql` unter `supabase/migrations/` (14-stellig), **Zaur führt sie im Supabase-SQL-Editor aus.** Return-Type-Change einer RPC = DROP + CREATE.
- **Verifizieren vor Commit** (Zaur: „commits kosten Geld"): `npx tsc --noEmit` (Root-Baseline = **2 harmlose `rose`-Fehler** in explore/guild-Styles) + apps/web `npm run build`.

---

## 8. Gotchas / Architektur
- **Ein Supabase für beide:** App (Expo) + Web (Next.js/Vercel) hängen am SELBEN Supabase-Projekt (`llymwqfgujwkoxzqxrlm`) — gleiche DB/Auth/Realtime/Storage. Darum trifft DB-Last/IO beide gleichzeitig.
- **Externe Dienste:** Cloudflare **R2** (+ Bunny CDN) = Bilder/Videos (Supabase speichert nur URLs); **LiveKit** = Live; **Stripe** (Web) / **RevenueCat** (App) = Geld/Coins; Sentry; OpenAI (KI-Bild, braucht Key).
- **Web-Bild-Upload** = `r2-sign`-Edge-Function (presigned PUT) → erlaubte Prefixe in `r2-sign` UND `apps/web/app/actions/posts.ts ALLOWED_KEY_PREFIXES`.
- **Coin-Saldo** in `coins_wallets` (`coins`/`diamonds`), NICHT `profiles.coins_balance`.
- **`SCHEMA.md`** = Source-of-Truth für reale Spalten (`profiles` hat KEIN `follower_count`).
- **FlashList + numColumns** = einspaltig → Grids mit RN-FlatList. **Reanimated** statisch importieren. **Status-Bar** `useThemedStatusBar` pro Screen. **Light-Mode**: kein hartes Weiß auf theme-Flächen.
- **Pre-existing tsc-Baseline = 2** (`'rose'` in explore/guild-Styles).

---

## 9. Übernommen (noch gültig)
- **Stripe Web-Coin-Shop** funktioniert (Testmodus). Go-Live = `sk_live_`/Live-Webhook tauschen.
- **Digitale Lieferung „Path A"**: Bucket `digital-products` (privat, Supabase Storage).
- **Domains:** `serlo.social`/`serlo.app` TOT — nur `serlo-web.vercel.app` (ohne www!). serlo.ch geplant (regelt dann www-Redirect automatisch).
- **Branding:** Coin = „Serlo Coin", Diamanten → „Einnahmen". `CoinIcon`-Komponenten (App+Web).
- **Geld-Tests** (Vorsession): `lib/payout.ts` + `lib/__tests__/payout.test.ts` + `moneyWrappers.test.tsx` (8 Suites grün, `npm test`).

---

## 10. Gedächtnis + Über Zaur
- Memory: `~/.claude/projects/-Users-zaurhatuev-vibes-app/memory/` (lädt automatisch). Relevant: `vibes-stripe-coinshop`, `vibes-shop-digital-delivery`, `vibes-ota-eas-update-stubs` (EAS_BUILD=1!), `vibes-reanimated-static-import`, `vibes-flashlist-numcolumns-bug`, `vibes-statusbar-theme`, `vibes-lightmode-contrast-bug`, `vibes-icon-language`, `vibes-web-deps-isolation`.
- **Zaur**: Solo-Gründer, deutschsprachig (tschetschenische Community). **Kostenbewusst** (validieren vor bauen; „commits kosten Geld"). Macht **DB-Migrationen + Secrets + Compute-Upgrades selbst** im Dashboard. **Credentials NIE im Chat.** Testet Mobile auf dem Gerät → iterativ OTA/Deploy → Feedback. Bevorzugt knapp/direkt/warm, eine Sache pro Commit. Neues Geschäft: **Öl-Parfüm-Verkauf** über die App/Web (Sammelbestellung), will Bruder + Community als Wachstums-/Reseller-Kanal.
