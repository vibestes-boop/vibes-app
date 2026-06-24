# Handoff — Serlo/Vibes (Stand 24. Juni 2026)

> 📍 **Dieses Dokument: `/Users/zaurhatuev/vibes-app/handoff.md`** (= `HANDOFF.md`, APFS case-insensitive).
> Arbeite NUR in diesem Repo: **`/Users/zaurhatuev/vibes-app`** (Branch `main`).
> ⚠️ NICHT verwechseln mit der Quarantäne-Kopie `/Users/zaurhatuev/Desktop/vibes-app` — die NIEMALS lesen/bauen/pushen.
>
> Übergabe für den Wechsel in einen neuen Chat. **Vollständig.** Gedächtnis-Dateien
> (`~/.claude/.../memory/`) laden automatisch — dieses Doku ergänzt sie mit Session-Detail.
> (Ersetzt den Handoff vom 2026-06-22/23.)

---

## 0. Schnell-Status (das Wichtigste zuerst)

| Bereich | Stand |
|---|---|
| **Repo / Branch** | `/Users/zaurhatuev/vibes-app` · `main` · Working Tree **sauber** |
| **Letzter Commit** | `7c4081b` — Geld-Tests (buy_product-Fehlercodes + generate_download_url-Vertrag) |
| **Push-Stand** | ⚠️ Lokaler `origin/main`-**Tracking-Ref** steht auf `0242e63` (alt). **PAT-Pushes über die Ephemeral-URL aktualisieren diesen Ref NICHT** → der Tracking-Ref ist KEIN verlässlicher Indikator. Echten Stand per `git fetch origin && git log --oneline origin/main` prüfen; im Zweifel via PAT erneut pushen (§2). Die Geld-Test-Commits galten vor dieser Session als gepusht. |
| **Aktueller Build** | **v1.30.0 / iOS-Build 286 (versionCode 47)** — auf Gerät (TestFlight), **Google-Login bestätigt funktionierend** ✅. App-Store-Release: beim User. |
| **Runtime 1.30.0** | OTAs zielen auf **Runtime 1.30.0** → Build 286. Diese Session = **reines JS + Tests** → komplett OTA-fähig, **kein neuer Build nötig**. |
| **Web (apps/web)** | deployt via **Vercel** auf Push zu `main` (`serlo-web.vercel.app`) |
| **DB-Migrationen** | **KEINE neuen** in dieser Session (24.6.). Zuletzt angewandt: `20260621140000_live_followers_only_audience.sql` (§3). |
| **Tests** | **8 Suites grün** (`lib/__tests__/`): payout · moneyWrappers · creditCoins · gifts · liveFormat · liveModerationRpc · liveModerationWords · videoFastStart. `npm test` (jest-expo). |
| **EAS project id** | `02ab536a-5836-4560-a5ec-2dfd6e059f90` · **iOS bundle** `com.vibesapp.vibes` · EAS-Account `zaurhat` |
| **GERADE IN ARBEIT** | Nichts mitten drin — Session sauber abgeschlossen. |
| **🔴 NEU GEMELDET (ungelöst)** | **Web-Bug auf `serlo-web.vercel.app` am Handy**: (1) UI-Fehler in der mobilen Ansicht, (2) „Mit Google weiter" schlägt fehl → Supabase-Callback (`llymwqfgujwkoxzqxrlm.supabase.co`) liefert **„upstream request timeout"** + lädt `authorize.txt` (24 B) herunter statt zu redirecten. **Vom User als Info gemeldet, KEIN Fix beauftragt.** Diagnose-Leads in §5. |

⚠️ **Quarantäne:** Alter Checkout `/Users/zaurhatuev/Desktop/vibes-app` — NIEMALS bauen/deployen/pushen.

---

## 1. NEU diese Session (24. Juni 2026) — UI-Konsistenz, Wärme, Geld-Tests

> Alles **JS-only oder reine Tests** → via OTA (Runtime 1.30.0) auslieferbar, kein Build.
> tsc-Baseline durchgehend = **2 vorbestehende Fehler** (`rose`-Farbe in explore/guild-Styles, harmlos) — alles darüber wäre neu.

### A) Einstellungen aufgeräumt (`c83b5b3`)
- `app/settings.tsx`: konsistente Icons, klarere Gruppierung, kompakteres Layout. Wurde **Flaggschiff** für die app-weite Icon-Sprache (siehe C).

### B) Fonts entfettet (`12975a7`)
- Creator- + Shop-Screens: `fontWeight 900→700` und `800→600` für Konsistenz mit dem leichteren Shop-Look (Fortsetzung der „Entfetten"-Linie aus v1.26.7). System-Font rendert die reduzierten Gewichte nativ.

### C) Icon-Sprache app-weit etabliert (`1624061`, `b3efc7f`, `5d3da13`) → Memory `vibes-icon-language`
- **Regel (jetzt verbindlich):** Lead-Icons **monochrom** (`colors.text.primary`), **OHNE Box/Chip**, ~18px, **kein Emoji als Icon**. Akzentfarbe NUR für destruktiv (rot) oder Marke (lila).
- **Flaggschiff** `settings.tsx` (`1624061`) → Rollout auf **Long-Press-Sheet + Profil-Menü** (`b3efc7f`) und **Tools- + Post-Optionen-Sheets** (`5d3da13`).
- **Offen:** weitere Sheets/Screens nach demselben Muster nachziehen (Rollout nicht abgeschlossen, aber Muster steht).

### D) Light-Mode-Kontrast-Fixes (`9329c47`, `a2d12bb`) → Memory `vibes-lightmode-contrast-bug`
- `9329c47`: unsichtbare **Weiß-auf-Weiß**-Elemente in **Messages** + **Follow-Liste** gefixt.
- `a2d12bb`: **Read-Ticks** im Chat auf der eigenen (blauen) Bubble lesbar gemacht.
- Bekanntes wiederkehrendes Muster: hartes `#FFFFFF`/`rgba(255,255,255)` auf theme-adaptiven Flächen → im Light-Mode unsichtbar. Fix immer via `colors.*`.

### E) Design-Gesetz „Tiefs wärmer machen" — 3 Batches (`389fe28`, `9b9157e`, `fb7ab51`)
- Umsetzung des CLAUDE.md-Design-Gesetzes #2 (kalte Fehler/Empty-States → warm + handlungsleitend + 1 Emoji):
  - **Batch 1** (`389fe28`): allgemeine kalte Fehler-/Empty-States.
  - **Batch 2** (`9b9157e`): **Auth- + Coin-Fehler** (z. B. „Nicht genug Coins" → warme, verkaufsleitende Variante).
  - **Batch 3** (`fb7ab51`): **Live-Host- + Creator-Fehler**.
- Klarheit (was tun?) bleibt Pflicht; Geld-/kritische Texte warm aber nie flapsig-unklar.

### F) Profil: leere „Post hinzufügen"-Footer-Kachel entfernt (`084d2a9`)
- `app/(tabs)/profile.tsx`: die leere Platzhalter-Kachel am Ende des Post-Grids raus (sah aus wie ein Bug/toter Slot).

### G) ⭐ Geld-Pfade jetzt getestet (`37bbffd`, `7c4081b`)
- **`lib/payout.ts`** (NEU): Creator-Auszahlungs-Mathe als **pure, getestete Funktionen** aus `app/creator/payout-request.tsx` extrahiert (höchstes Finanzrisiko — echtes Geld verlässt das System). Wert-identisch zur alten Inline-Logik:
  - `DIAMOND_RATE_EUR = 0.02` (1 Diamant = 2 Cent) · `MIN_PAYOUT_DIAMONDS = 2500` (= 50,00 €)
  - `payoutEuroAmount(d)` = `parseFloat((d*0.02).toFixed(2))` (fängt Float-Drift ab) · `formatPayoutEuro(d)` (de-DE) · `isPayoutEligible(d)`
- **`lib/__tests__/payout.test.ts`** (NEU, 6 Tests): Kurs (0/50/100/2500/12345), Float-Drift (7→0,14; 2501→50,02; ≤2 Nachkommastellen), Kurs-Regression-Guard (`0.02`), Eligibility-Schwellen, Locale-Format (`/50[.,]00\s*€/`).
- **`lib/__tests__/moneyWrappers.test.tsx`** (erweitert, RPC-**Vertrags**-Tests mit chainable+thenable Supabase-Mock — fängt RPC-/Param-Namens-**Drift** ab, NICHT die SQL-Logik):
  - `useBuyProduct` → ruft `buy_product` mit `{ p_product_id, p_quantity }` (Default 1), mappt `{success,order_id,new_balance}`→`{success,orderId,newBalance}`, `insufficient_coins`→`{success:false,error}`, RPC-Fehler→`network_error`, **Drift-Guard** über `out_of_stock|cannot_buy_own|no_wallet|product_not_found`.
  - `useSendGift` → `send_gift` mit `{ p_recipient_id, p_live_session_id, p_gift_id }`.
  - `useDownloadDigitalProduct` → `generate_download_url` mit `{ p_order_id }`, reicht `not_purchased` durch, RPC-Fehler→`rpc_error`.
- **Warum so:** Diese Test-Klasse fängt genau die Drift-Bugs ab, die wir früher fanden (author_id/seller_id/sold_count). Echte SQL-Logik bräuchte pgTAP — bewusst nicht gemacht.

---

## 1b. Davor (23. Juni, nach dem 1.30.0-Build) — Loader-Rollout, Explore, Orders, Statusbar

> Alles JS → OTA-fähig auf Runtime 1.30.0. Schließt mehrere offene Punkte des alten Handoffs.

- **⭐ SerloLoader-Rollout abgeschlossen** (`52cf13a`): markeneigene Lade-Animation (blauer Komet-Beam, procedural via `react-native-svg`-Gauss-Blur + Reanimated) jetzt auf **Shop, Guild, Feed** ausgerollt (war vorher nur Profil-Pilot). Muster: `refreshing={false}` (kein nativer grauer iOS-RefreshControl) + Beam im ListHeader + `bg.secondary`. **→ alter offener Punkt „SerloLoader-Rollout" ERLEDIGT.**
- **Explore-Grid-Fix** (`16818b8`, `3c2d314`) → Memory `vibes-flashlist-numcolumns-bug`: FlashList 1.7 + `numColumns` + feste Item-Breite = einspaltig. Fix: 3-Spalten-Grid via **RN-FlatList** (wie Shop/Profil) + breiterer Discover-Pool; Suche aus Feed öffnet Tab sauber (`navigate`).
- **Orders-Seite neugestaltet** (`0dd986c`): theme-aware, `CoinIcon`, Metrik-Karten.
- **Status-Bar theme-aware** (`d45f819`) → Memory `vibes-statusbar-theme`: Icons waren global hart weiß (app.json `LightContent`) → im Light-Mode unsichtbar. Fix via Hook pro Screen — **jeder neue Screen muss ihn aufrufen**.
- **Highlights**: leere Story-Vorlagen (totes Medium) aus dem Picker ausgeblendet (`e94c666`).
- **Profil-Coin** randlos + größer 22→32px (`3cc9cb9`); Highlights-Lösch-Menü als Instagram-Style-Sheet (`76e6f60`).

---

## 1c. Älterer Verlauf (22./23. Juni, kondensiert — Detail im Git + Memory)

> Hier nur die Anker, damit nichts verloren geht.

- **Create-Flow** (Editor/Kamera): freier Bild-Crop (Skia-Offscreen `drawImageRect`), Cover/Thumbnail-Picker, Filter+Drehen ins Bild gebrannt (`lib/bakeImageEdits.ts`), TikTok-cleane Kamera, **TEXT-Modus** + **view-shot-Compositing** (Overlays ins Foto). „Zeichnen" + „Effekte" (AR) entfernt (dormant). → Memory `vibes-create-overlay-compositing`. **Bekannte Grenze:** animierte Sticker werden im Foto-Post statisch.
- **Live**: „Nur Follower"-Publikum-Picker (Migration `…140000_live_followers_only_audience`, livekit-token-Durchsetzung), Cover aus Galerie, Kategorie-Chips, Creator-Tools-Sheet-Redesign, LIVE-Setup-Karte.
- **Sicherheit (App-Store-Vorbereitung)**: `add_test_coins`/`debug_send_gift`-Backdoors gedroppt (`…120000`), notifications-INSERT gehärtet (`…121000`), Comments-INSERT-Spoofing-Policy gefixt (`…130000`), Debug-Screen + 7-Tap-Geste entfernt. RLS-Voll-Audit → sicher.
- **Web (Vercel, deployed)**: ShareButtons-Hydration-Fix, Post-Detail-Medien-Größe, JSON-LD-XSS-Schutz, Support-Seite `/support`.
- **Branding**: Coin = **„Serlo Coin"** (ex „Borz"), Diamanten → **„Einnahmen"** mit € im Vordergrund; `assets/serlo-coin.png` + `CoinIcon`-Komponenten (Mobile + Web) überall statt 🪙.
- **Google-Login LIVE** (vorbereitet → aktiviert in Build 286). `expo-web-browser` (native Dep). Setup-Doku: `docs/auth-setup.md`.
- **Highlights-Durability**: Edge Function `highlight-copy-media` kopiert Story-Medien nach `highlights/{userId}/…` (sonst löscht R2-Cleanup ablaufende Story → tote URL). User hat deployed ✅. → Memory `vibes-highlights-media-durability`.
- **Simplify Tier 1** (reine Refactors): 114 tote Dateien weg; `timeAgo`→`lib/timeAgo.ts`, `fmtNum`→`lib/formatNum.ts`. **Tier 2 (`<InitialsAvatar>`, ~51 Dateien) bewusst DEFERRED** (Regressionsrisiko, quality-only). Tier 3 (Riesendateien splitten) tabu.

---

## 2. Deploy-Workflow (Runtime 1.30.0)

```bash
# IMMER aus /Users/zaurhatuev/vibes-app

# Mobile OTA (reines JS) — EAS_BUILD=1 ZWINGEND (sonst landen Expo-Go-Stubs im Prod-OTA).
EAS_BUILD=1 npx eas update --branch production --message "..." --non-interactive
#   → OTA gilt für den 1.30.0-Build (286). Diese Session ist komplett OTA-fähig.

# Native Build (nur bei nativen Änderungen / neuen Deps) — autoIncrement=false → version+buildNumber+versionCode manuell
#   app.json AKTUELL: version 1.30.0, ios.buildNumber 286, android.versionCode 47 (Build 286 live; nächster Build hochzählen!)
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
#   ⚠️ Apple verlangte zuletzt „Program License Agreement" akzeptieren (developer.apple.com/account) — sonst 403.

# Push zu GitHub (PAT aus .env.local, NIE echoen/committen)
TOKEN=$(grep -E '^GITHUB_TOKEN=' .env.local | cut -d= -f2-)
git push "https://x-access-token:${TOKEN}@github.com/vibestes-boop/vibes-app.git" HEAD:main
#   ⚠️ Dieser Push aktualisiert den lokalen origin/main-Tracking-Ref NICHT → Tracking-Ref bleibt scheinbar „hinterher".

# Edge Functions
npx supabase functions deploy <name>
npx supabase functions deploy <webhook> --no-verify-jwt
```
- **DB-Migrationen:** `.sql` unter `supabase/migrations/` (14-stellig `YYYYMMDDHHMMSS_slug.sql`), **Zaur führt sie im Supabase-SQL-Editor aus**.
- **Verifizieren vor Commit** (Zaur: „commits kosten Geld"): `npm run typecheck` (tsc-Baseline = 2 harmlose `rose`-Fehler) + `npm test` (8 Suites).
- **Web baut isoliert** (Vercel): neue Web-Deps mit `cd apps/web && npm run build` prüfen (Memory `vibes-web-deps-isolation`).

---

## 3. Angewandte DB-Migrationen (Historie, bestätigt)
Diese Session (24.6.): **keine**. Zuletzt (22./23.6.):
- `20260621120000_drop_debug_coin_backdoors.sql` ✅
- `20260621121000_harden_notifications_insert.sql` ✅
- `20260621130000_fix_comments_insert_policy_spoofing.sql` ✅
- `20260621140000_live_followers_only_audience.sql` ✅ (Spalte `live_sessions.followers_only` + Partial-Index; NICHT verwechseln mit `followers_only_chat`)

---

## 4. OFFENE PUNKTE / Nächste Schritte

### 🔴 Web-Auth/UI-Bug auf `serlo-web.vercel.app` (NEU gemeldet — siehe §5 für Details)
Höchste neue Priorität, aber **noch nicht beauftragt zu fixen**. Erst mit Zaur klären, ob/wie.

### Release & Config (übernommen, noch gültig)
1. **1.30.0 im App Store releasen** (Build 286, TestFlight): Export-Compliance („nutzt nur Standard-HTTPS-Verschlüsselung → qualifiziert für Ausnahme") + „Zur Prüfung hinzufügen". Demo-Account + Review-Notes lagen bereit, Alter 16+, Datenschutz-Labels gesetzt, Account-Löschung in App, Support-URL `serlo-web.vercel.app/support`.
2. **Resend-E-Mail fixen** (`docs/auth-setup.md` Schritt 1): reine Supabase/Resend-Config, kein Build. **E-Mail-Versand ist kaputt** → echte User können sich per E-Mail-Link nicht registrieren (Android-Signup-Lücke; Google ist ✅, Apple nur iOS). Hängt eng mit dem Web-Auth-Bug zusammen — derselbe Supabase-Stack.
3. **KI-Cover**: `OPENAI_API_KEY`-Secret + OpenAI-Billing setzen (User-Aktion); UI ist gefixt, Generierung schlägt bis dahin fehl.

### Produkt / Backlog
4. **Icon-Sprache-Rollout** auf restliche Sheets/Screens fortsetzen (Muster steht, §1 C).
5. **„Tiefs wärmer"**-Sweep auf weitere Flächen fortsetzen, wo noch kalte Fehlertexte stehen.
6. **Animierte Sticker im Post = Video — AUFGESCHOBEN bis Umsatz.** Render-Dienst fertig+committed unter `services/sticker-video/`, bewusst NICHT deployed (laufende Compute-Kosten). → Memory `vibes-create-overlay-compositing`.
7. **Geplante Lives** reichen `followers_only` + `category` NICHT durch (still verloren) — nachziehen = Spalten in `scheduled_lives` + Plan-Flow.
8. **Simplify Tier 2** (`<InitialsAvatar>`, ~51 Call-Sites) deferred — wenn, dann batchweise (8–10/Commit, je tsc-verifiziert), theme-adaptive High-Traffic-Screens zuerst.

---

## 5. 🔴 Detail: Web-Auth/UI-Bug (vom User gemeldet, NICHT beauftragt zu fixen)

**Meldung (Zaur, Original):** „wenn man mit mobiletelefon die seite `https://serlo-web.vercel.app/` besucht hat es UI fehler und bei der ‚mit google weiter' gibt es auch fehler."

**Symptom 1 — UI-Fehler in der mobilen Ansicht** der Web-App (`apps/web`). Noch nicht im Detail analysiert; mobile Responsive-Probleme auf der Landing/Login-Seite vermutet.

**Symptom 2 — Google-OAuth („Mit Google weiter") schlägt fehl.** Mobile-Screenshot zeigt: `llymwqfgujwkoxzqxrlm.supabase.co` antwortet mit **„upstream request timeout"** und der Browser bietet **`authorize.txt` (24 Byte)** zum Download an, statt zum App-Callback weiterzuleiten. Der 24-B-Text-Download statt Redirect ist das klassische Zeichen, dass der **Supabase-Auth-Callback einen nicht-HTML-Body / Fehler** zurückgibt.

**Bekannte OAuth-Config (aus dem vom User gelieferten Google-Signin-HTML):**
- Supabase-Projekt: `llymwqfgujwkoxzqxrlm.supabase.co` (geteilt mit der Mobile-App)
- Google client_id: `87313086885-6fmhjgfe6miu3kua0nlujh7svd71tnoi.apps.googleusercontent.com` (Web-Client, endet `…svd71tnoi` — **derselbe** wie Mobile)
- redirect_uri: `https://llymwqfgujwkoxzqxrlm.supabase.co/auth/v1/callback`
- Post-Auth-App-Redirect: `serlo-web.vercel.app/auth/callback?next=/`
- scope: `email profile` · flowName `GeneralOAuthFlow`
- Im Google-Chooser gezeigtes Konto: `vibestes@gmail.com`

**Diagnose-Leads (Hypothesen, NICHT verifiziert):**
1. **Supabase-Projekt schläft/Quota** — „upstream request timeout" am `/auth/v1/callback` deutet stark auf ein **pausiertes/überlastetes Supabase-Projekt** (Free-Tier-Auto-Pause) oder Auth-Service-Ausfall hin. **Zuerst prüfen:** Supabase-Dashboard → Projekt aktiv? Auth-Logs? Health? (Mobile-Google-Login funktionierte zuletzt ✅ — könnte ein neueres/temporäres Backend-Problem sein.)
2. **Hängt evtl. mit dem kaputten E-Mail-Versand zusammen** (§4.2) — beides läuft über denselben Supabase-Auth-Stack; evtl. gemeinsame Ursache (Projekt-/Config-Zustand).
3. **Web-`/auth/callback`-Route** (`apps/web/app/auth/callback/…`) prüfen, ob sie Code/Token korrekt verarbeitet, sobald der Supabase-Callback wieder antwortet.

**Wichtig:** Bevor hier etwas geändert/deployed wird → **mit Zaur abstimmen** (er macht DB/Secrets/Dashboard selbst; Auth-Config ist sein Terrain). Kein Fix ohne Auftrag.

---

## 6. Wichtige Gotchas / Architektur
- **Runtime 1.30.0** (`runtimeVersion.policy=appVersion`): OTAs gelten nur für Build 286. Native Änderungen (neue Deps) brauchen neuen Build + version-Bump.
- **Reanimated:** Hooks/`with*` **statisch** importieren (nie require-only) — sonst UI-Thread-Worklet-Crash im Build (Memory `vibes-reanimated-static-import`).
- **view-shot `capture()`** liefert Pfad **OHNE `file://`** → immer ergänzen vor fetch/Upload.
- **Skia-Compositing:** `drawImageRect` (nicht `drawImage`) für ColorFilter; `Surface.MakeOffscreen` + `encodeToBase64`.
- **Editor-Präsentation = `card`** (nicht modal/fullScreenModal) wegen Gesten/Buttons.
- **FlashList + `numColumns` + feste Item-Breite = einspaltig** → für Grids RN-FlatList (Memory `vibes-flashlist-numcolumns-bug`).
- **Status-Bar:** `useThemedStatusBar`-Hook pro Screen aufrufen (Memory `vibes-statusbar-theme`).
- **Light-Mode-Kontrast:** `colors.bg.*`-Fläche → Text/Icon/Fallback auch via `colors.*`. Über dem immer-schwarzen Feed (`feedStyles.container`=#000) umgekehrt: feste Hell-auf-Dunkel-Palette (Memory `vibes-lightmode-contrast-bug`).
- **Icon-Sprache:** Lead-Icons monochrom (`colors.text.primary`), ohne Box, ~18px, kein Emoji; Akzent nur destruktiv/Marke (Memory `vibes-icon-language`).
- **Sehr große Module** (Regressionsrisiko): `app/live/host.tsx`, `app/live/watch/[id].tsx`, `app/create/index.tsx`, `app/create/camera.tsx`.
- **Pre-existing tsc-Fehler (harmlos, Baseline=2):** `'rose'` in `components/explore/exploreStyles.ts` + `components/guild/guildStyles.ts`.

---

## 7. Übernommen (noch gültig)
- **Stripe Web-Coin-Shop** funktioniert (Test-Modus). Go-Live = `sk_live_`/Live-Webhook tauschen. Functions `create-checkout-session`(verify_jwt) + `stripe-webhook`(--no-verify-jwt) deployed (Memory `vibes-stripe-coinshop`).
- **Digitale Lieferung „Path A"**: Bucket `digital-products` (privat, Supabase Storage — NICHT R2). Bilder/Videos → R2 (Memory `vibes-shop-digital-delivery`).
- **Coin-Saldo in `coins_wallets`** (`coins`/`diamonds`/`user_id`), NICHT `profiles.coins_balance`.
- **`r2-delete` Edge Function:** deployed, aber Source fehlt unter `supabase/functions/` → vor Delete-Änderungen zurückholen.
- **`SCHEMA.md`** (`supabase/SCHEMA.md`) = Source-of-Truth für reale Spalten. `profiles` hat KEIN `follower_count`.
- **Domains:** `serlo.social`/`serlo.app` sind TOT — nur `serlo-web.vercel.app` lebt. Alle Links/ASC-Felder zeigen darauf. (serlo.ch geplant.)
- **Video-Perf** (Memory `vibes-video-perf-strategy`): Web preconnect+`preload=metadata` live; Mobile 720p-Kompression; ABR/HLS (Bunny Stream) aufgeschoben bis Umsatz.

---

## 8. Gedächtnis + Doku
`~/.claude/projects/-Users-zaurhatuev-vibes-app/memory/` (lädt automatisch) — relevant diese Session:
- `vibes-icon-language.md` · `vibes-lightmode-contrast-bug.md` · `vibes-statusbar-theme.md` · `vibes-flashlist-numcolumns-bug.md`
- `vibes-ota-eas-update-stubs.md` (EAS_BUILD=1!) · `vibes-reanimated-static-import.md`
- `vibes-create-overlay-compositing.md` · `vibes-highlights-media-durability.md`
- `vibes-shop-digital-delivery.md` · `vibes-stripe-coinshop.md` · `vibes-video-perf-strategy.md` · `vibes-web-deps-isolation.md`

Projekt-Doku: **`CLAUDE.md`** (Tech-Stack, Struktur, Design-Gesetz „freundliche App", Migrations-Regeln, Icon-Sprache).

---

## 9. Über Zaur
- Solo-Gründer, deutschsprachig. Serlo/Vibes = TikTok-artige App für die tschetschenische Community, in Produktion (App Store).
- Bevorzugt knapp/direkt, **eine Sache pro Commit**, warm. **Kostenbewusst** (teure Infra/Sticker-Video bis Umsatz aufgeschoben; „commits kosten Geld" → vor Commit verifizieren). Will Fixes **verifiziert + ausgeliefert**.
- Testet Mobile selbst auf dem Gerät (ich kann Mobile nicht rendern) → iterativ: OTA/Build → er testet → Feedback. Macht **DB-Migrationen + Secrets selbst** im Dashboard.
- **Credentials (OpenAI/Stripe-Keys, PAT) gibt er NIE in den Chat** — setzt sie selbst.
