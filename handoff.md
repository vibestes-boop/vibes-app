# Handoff — Serlo/Vibes (Stand 21. Juni 2026)

> 📍 **Dieses Dokument: `/Users/zaurhatuev/vibes-app/handoff.md`**
> Arbeite NUR in diesem Repo: **`/Users/zaurhatuev/vibes-app`** (Branch `main`).
> ⚠️ NICHT verwechseln mit der Quarantäne-Kopie `/Users/zaurhatuev/Desktop/vibes-app/handoff.md` — die NIEMALS lesen/bauen/pushen.
>
> Übergabe für den Wechsel in einen neuen Chat. **Vollständig.** Gedächtnis-Dateien
> (`~/.claude/.../memory/`) laden automatisch — dieses Doku ergänzt sie mit Session-Detail.
> (Ersetzt den Handoff vom 2026-06-20.)

---

## 0. Schnell-Status (das Wichtigste zuerst)

| Bereich | Stand |
|---|---|
| **Repo / Branch** | `/Users/zaurhatuev/vibes-app` · `main` (Push-Remote: `vibestes-boop/vibes-app`) |
| **Letzter Commit** | `9b6a766` (gepusht) |
| **Letzte Mobile-OTA** | `97ad0e6c` — **Runtime 1.29.0** (branch `production`) |
| **Mobile-Build** | **v1.29.0 / iOS-Build 285 (versionCode 46) → in TestFlight** (vom User gebaut). **NICHT im App Store released!** Alle OTAs dieser Session zielen auf **Runtime 1.29.0** (nur dieser Build hat sie). |
| **NEU nativ in 1.29.0** | `react-native-view-shot@4.0.3` (für Compositing/Text-Modus) → deshalb der neue Build. |
| **Web (apps/web)** | deployt via **Vercel** auf Push zu `main` (`serlo-web.vercel.app`) |
| **DB-Migrationen** | 3 dieser Session **angewandt** (§3); 1 für laufendes Feature **noch zu schreiben** (§4 „B") |
| **EAS project id** | `02ab536a-5836-4560-a5ec-2dfd6e059f90` · **iOS bundle** `com.vibesapp.vibes` · EAS-Account `zaurhat` |
| **GERADE IN ARBEIT** | **„Nur Follower"-Zuschauen** (Live-Publikum) — investigiert, **noch nicht gebaut** (§4 „B" = sofort fortsetzbar) |

⚠️ **Quarantäne:** Alter Checkout `/Users/zaurhatuev/Desktop/vibes-app` — NIEMALS bauen/deployen/pushen.

---

## 1. Was diese Session gebaut wurde (Create-Flow + Live, alles 1.29.0)

### A) Web: ShareButtons Hydration-Fix
- `apps/web/components/share/share-buttons.tsx`: absolute URL aus `NEXT_PUBLIC_SITE_URL` statt `window.origin` (war Hydration-Mismatch + relative/kaputte Share-Links). Commit `2597496`.

### B) Kommentar-System-Überarbeitung (Mobile, OTA)
- `lib/useComments.ts` nutzt jetzt die RPC **`get_post_comments_web`** (1 Query: Text + like_count + liked_by_me + reply_count + Author) statt 1+2+N. N+1-Like-Sturm weg (`useToggleCommentLike`-Cache-Mutation). `lib/useCommentLike.ts` bekam `enabled`-Flag.
- `components/ui/CommentsSheet.tsx`: reply_count-Gate (kein „Antworten anzeigen" ohne Antworten), Light-Mode-Farben gefixt (war weiß-auf-weiß), Reply-isOwn-Fix, Reply sofort sichtbar/löschbar (Expand-State nach SheetInner geliftet, reply_count optimistisch), Like als rechte Spalte, neueste-zuerst, **Sort-Header** (Neueste/Top/Von Creator) mit Anzahl.
- **Migration** `20260621130000_fix_comments_insert_policy_spoofing.sql` ✅ (doppelte permissive INSERT-Policy zusammengeführt — schloss Impersonation + allow_comments-Umgehung).

### C) Create-Flow (Editor + Kamera) — alles OTA außer view-shot
- **Toolbar-Konsistenz + Icon-Fixes** (`app/create/camera.tsx` + `app/create/index.tsx`): Capture-Toolbar an Editor-Look angeglichen (Icon+Label); Editor-Icons gefixt (Drehen=RotateCw, Anpassen=SlidersHorizontal, Filter=Palette).
- **Bild-Crop FREI** (`components/create/editor/CropSheet.tsx`): ziehbarer + größenveränderbarer Rahmen (Move + 4 Eck-Griffe), Aspect-Presets, pixel-genau via **Skia-Offscreen** (`Skia.Surface.MakeOffscreen` + `drawImageRect`).
- **Cover/Thumbnail-Picker** (`components/create/editor/CoverPickerSheet.tsx`): Video-Startbild aus Filmstrip wählen → `generateAndUploadThumbnail(…, timeMs)`.
- **Editor-Swipe-Fix**: `/create/index` von `presentation:'modal'` → **`'card'`** (`src/_layout.full.tsx`) — modal-Swipe-down kollidierte mit Sticker/Text-Ziehen. ⚠️ `fullScreenModal` hatte die Buttons tot gemacht → NICHT nehmen.
- **Filter + Drehen/Spiegeln werden ins Bild gebrannt** (`lib/bakeImageEdits.ts`): vor Upload via Skia-Offscreen (Filter-Matrix wie Vorschau + Rotation). **WICHTIG-Fund:** imperatives `canvas.drawImage` wendet ColorFilter NICHT an → **`drawImageRect`** nutzen (wie Crop). Defensiv mit Fallback aufs Rohbild.
- **Kamera TikTok-clean** (`camera.tsx`): Button-Umrandungen/Glasmorphism/Lila-Gradient raus, transparenter Bottom-Bereich.
- **Entfernt (wie „Zeichnen"):** „Zeichnen"-Button + **„Effekte"-Button** (AR-Kamera via vision-camera — sprang auf Frontkamera, eigene UI, Live-Filter kaputt). Code bleibt dormant.

### D) view-shot Compositing + TEXT-Modus (nativ, in 1.29.0)
- `react-native-view-shot` installiert. `app/create/index.tsx`: Editor-Vorschau in `<ViewShot>`; beim Posten eines Bildes **mit Overlays** → `capture()` → MP4… nein, **Bild** mit Text/Sticker drin (Hybrid: während Capture Skia→normales Bild getauscht, Filter vorab gebacken). **Kritischer Fix:** view-shot liefert Pfad **ohne `file://`** → ergänzen, sonst „Invalid URL" beim Upload.
- **TEXT-Modus** (`camera.tsx`): TEXT-Tab, Composer (Einzelfarben **+ Gradient-Kreis**, Schrift-Stile Klassisch/Serif/Neon/Mono, Ausrichtung), Tastatur schließen (Hintergrund/„Fertig"), Swatches über Tastatur, **„Deine Story" + „Weiter"**-Buttons. „Deine Story" → `create-story.tsx` (nimmt jetzt `mediaUri`-Param).
- **Status:** Vom User getestet → Foto+Text/Sticker posten ✅, Text-Post ✅, Filter ✅. **Bekannte Grenze:** animierte Sticker werden im Foto-Post statisch (Standbild).

### E) Live-Einstellungen (`app/live/start.tsx`)
- **Cover aus Galerie** (zusätzlich zu „Mit KI"): Picker → `uploadPostMedia` → `thumbnail_url`. Mit Lade-Spinner.
- **Kategorie/Thema-Chips** (Talk/Musik/Gaming/…) → `live_sessions.category` (Spalte existierte schon, `startSession` nimmt `category` durch). Scheduled-Lives noch ohne category.
- **KI-Cover-Fehlermeldung** (`lib/useGenerateImage.ts`): liest jetzt `error.context.json()` (RN-Response) statt `.body` → echte Ursache sichtbar statt „non-2xx". **Eigentlicher KI-Fix = Config:** `OPENAI_API_KEY` in Supabase-Secrets + OpenAI-Billing (User-Aktion). KI-Bilder kosten Geld/Bild (Limit 3/Tag,10/Woche) — Galerie ist gratis & Default.

### Sicherheits-Fixes (App-Store-Vorbereitung, früher in der Session)
- `20260621120000_drop_debug_coin_backdoors.sql` ✅ (kritisch: `add_test_coins` war für `authenticated` offen → Coins minten).
- `20260621121000_harden_notifications_insert.sql` ✅ (notif-INSERT auf `sender_id=auth.uid()`).
- Debug-Screen `app/debug-gifts.tsx` gelöscht, 7-Tap-Debug-Gesten in settings entfernt.

---

## 1b. Früher in diesem Verlauf (vor dem Create-Flow — wichtig fürs Release)

### App-Store-Einreichung (war für 1.28.0 vorbereitet → gilt jetzt für 1.29.0)
Der User war kurz vor dem Einreichen von 1.28.0, hat dann aber den neuen Build (1.29.0) gemacht. **Diese ASC-Felder sind bereits gesetzt** und gelten weiter:
- **Account-Löschung**: existiert in der App (Apple-Pflicht erfüllt).
- **Datenschutz-Nutzungslabels**: ausgefüllt (Fotos/Videos, Benutzer-ID/Identifikatoren, Diagnose-/Crash-/Nutzungsdaten — je nach Zweck verlinkt).
- **Altersfreigabe**: auf **16+** gesetzt (vorher 13).
- **Demo-Account**: angelegt + getestet (E-Mail-Login war kaputt → Account **direkt in Supabase Auth mit Auto-Confirm** erstellt). **Review-Notes + Demo-Login in ASC eingetragen.**
- **Support-URL**: `https://serlo-web.vercel.app/support` (Seite existiert: `apps/web/app/support/page.tsx`, `SUPPORT_EMAIL = brandwerkx@gmail.com`).
- **Beschreibung** gefixt.
- **OFFEN beim Einreichen**: **Export-Compliance** (Antwort: nutzt Verschlüsselung → Standard-HTTPS-Ausnahme → „Ja, qualifiziert für Ausnahme") → dann **„Zur Prüfung hinzufügen"**.
- ⚠️ **Beim Einreichen von 1.29.0**: neue Version 1.29.0 in ASC anlegen, **Build 285** zuweisen, Export-Compliance, einreichen.

### Serlo-Coin-Umbenennung — ERLEDIGT (nicht mehr „Borz")
- Coin heißt jetzt offiziell **„Serlo Coin"** (vorher „Borz Coin"). **„Diamanten" → „Einnahmen"** mit **€ im Vordergrund** (User-Wahl). Docs + `CLAUDE.md` aktualisiert.
- **Asset**: `assets/serlo-coin.png` + `apps/web/public/serlo-coin.png` (512×512, transparent). Shared-Komponenten: `components/ui/CoinIcon.tsx` (Mobile) + `apps/web/components/ui/coin-icon.tsx` (Web) — überall statt 🪙.
- Web-Coin-Shop „premium" gemacht (Hero-Coin, größere Münzen).

### Web-Fixes (Vercel, alle deployed)
- **Post-Detailseite Medien zu groß** (`apps/web/app/p/[postId]/page.tsx`): `mediaMaxW` (`max-w-[400px]` portrait / `max-w-[520px]` square) auf Bild-Container + VideoPlayer.
- **JSON-LD XSS-Schutz** (`apps/web/lib/seo/json-ld.ts`): `safeJsonLd()` escaped `<>&`.
- **ShareButtons-Hydration** (siehe §1 A).
- **Support-Seite** `/support` (siehe oben), überall verlinkt.
- Markennamen (TikTok/Instagram) in Code-Kommentaren neutralisiert (Plagiat-/Penalty-Vorsorge).

### Voll-Sicherheitsanalyse (App+Web+Backend) — Ergebnis: sicher
- RLS-Abdeckung ~133 Tabellen aktiviert; Geld-RPCs nutzen `auth.uid()`+SECURITY DEFINER+FOR UPDATE; DMs participant-only; Webhooks verifizieren Signatur (Stripe) / Bearer (RevenueCat).
- **Kritischer Fund + Fix**: `add_test_coins`/`debug_send_gift` waren für `authenticated` offen (Coins minten → Auszahlungsbetrug) → gedroppt (Migration `20260621120000`, §3). notifications-INSERT gehärtet (`20260621121000`). Debug-Screen + 7-Tap-Geste entfernt.

### Domain / E-Mail (Stolperfallen)
- **`serlo.social` + `serlo.app` sind TOT** (kein DNS/000). **Nur `serlo-web.vercel.app` lebt** (200). Alle Links + ASC-Felder darauf gezeigt. (serlo.ch geplant, wenn verfügbar.)
- **E-Mail-Versand kaputt** (Supabase SMTP/Resend) → echte User können sich per E-Mail-Link nicht registrieren. Workaround Demo: Account direkt in Supabase Auth + Auto-Confirm. **Offen: SMTP/Resend fixen** (sonst keine E-Mail-Registrierung für echte User).

---

## 2. Deploy-Workflow (unverändert, nur Runtime jetzt 1.29.0)

```bash
# IMMER aus /Users/zaurhatuev/vibes-app

# Mobile OTA (reines JS) — EAS_BUILD=1 ZWINGEND. Targets Runtime = app.json version (jetzt 1.29.0)
EAS_BUILD=1 npx eas update --branch production --message "..." --non-interactive
#   → OTA gilt NUR für den 1.29.0-Build (285). Ältere Builds (1.28.0) ziehen sie NICHT.

# Native Build (nur bei nativen Änderungen / neuen Deps) — autoIncrement=false → version+buildNumber+versionCode manuell
#   app.json: version 1.29.0, ios.buildNumber 285, android.versionCode 46 (schon gesetzt; nächster Build hochzählen!)
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
#   ⚠️ Apple verlangte zuletzt „Program License Agreement" akzeptieren (developer.apple.com/account) — sonst 403 beim Build.

# Push zu GitHub (PAT aus .env.local, NIE echoen)
TOKEN=$(grep -E '^GITHUB_TOKEN=' .env.local | cut -d= -f2-)
git push "https://x-access-token:${TOKEN}@github.com/vibestes-boop/vibes-app.git" HEAD:main

# Edge Functions
npx supabase functions deploy <name>
npx supabase functions deploy <webhook> --no-verify-jwt
```
- **DB-Migrationen:** `.sql` unter `supabase/migrations/` (14-stellig `YYYYMMDDHHMMSS_slug.sql`), **Zaur führt sie im Supabase-SQL-Editor aus**.
- **Verifizieren vor Commit** (Zaur: „commits kosten Geld"). tsc-Baseline = **2 vorbestehende Fehler** (`rose`-Farbe in explore/guild-Styles, harmlos) — alles darüber ist neu.

---

## 3. Angewandte DB-Migrationen (diese Session, bestätigt)
- `20260621120000_drop_debug_coin_backdoors.sql` ✅
- `20260621121000_harden_notifications_insert.sql` ✅
- `20260621130000_fix_comments_insert_policy_spoofing.sql` ✅

---

## 4. OFFENE PUNKTE / Nächste Schritte

### B) ⭐ GERADE IN ARBEIT: „Nur Follower"-Zuschauen (Live-Publikum-Picker)
**Ziel:** Live kann auf „nur Follower" gestellt werden → nur Follower des Hosts bekommen ein LiveKit-Token (Nicht-Follower auch per Direktlink draußen).
**Investigation-Ergebnisse (bereit umzusetzen):**
1. **Migration nötig:** `live_sessions` Spalte **`followers_only boolean default false`** (analog `women_only`). *(Noch NICHT geschrieben.)*
2. **Durchsetzung** in `supabase/functions/livekit-token/index.ts`: Function bekommt `{ roomName, isHost, isCoHost }` + `userId` aus JWT. Für **Viewer** (nicht Host, nicht CoHost) ergänzen: Session per `room_name`+`status=active` holen → `select=host_id,followers_only`. Wenn `followers_only===true`: in **`follows`** prüfen `follower_id=eq.{userId}&following_id=eq.{host_id}&limit=1`; wenn leer → **403** (kein Token). Vorlage: die bestehenden Host/CoHost-403-Blöcke (Zeilen ~121–186).
   - `follows`-Spalten: `id, follower_id, following_id, created_at`.
   - Function nutzt `serviceRoleKey` für REST-Reads (RLS-bypass) — Follow-Check genauso.
3. **Client `lib/useLiveSession.ts`:** `startSession`-options + insert um `followers_only` erweitern (genau wie diese Session `category` ergänzt wurde — Zeilen ~340 options-Typ + ~371 insert).
4. **Client `app/live/start.tsx`:** „Wer kann zuschauen"-Zeile (aktuell **toter** Pressable, nur Deko) zu echtem Picker machen: Öffentlich / Nur Follower / Nur Frauen (mutually exclusive; Nur Frauen = bestehendes `womenOnly`, nur wenn `canAccessWomenOnly`). `followers_only` an `startSession` durchreichen.
5. **Viewer-Seite `app/live/watch/[id].tsx`:** 403 beim Token-Fetch sauber abfangen → freundlicher „Nur für Follower 🙂 — folge zuerst"-Screen statt Crash.
6. Deploy: `supabase functions deploy livekit-token` + Migration (User) + OTA.

### Weitere offene Punkte
1. **1.29.0 in App Store releasen** — Build nur in TestFlight. User wollte erst „viele UI-Baustellen" fixen (Create-Flow + Live = erledigt; ggf. mehr). Vor Einreichen: Export-Compliance + „Zur Prüfung hinzufügen". Demo-Account + Review-Notes lagen für 1.28.0 schon bereit.
2. **KI-Cover:** User soll `OPENAI_API_KEY`-Secret prüfen/setzen (+ OpenAI-Billing). Erst echte Fehlermeldung checken (App neu öffnen → KI-Cover versuchen → Text steht jetzt da dank `9b6a766`).
3. **Animierte Sticker im Post = Video (C1) — AUFGESCHOBEN bis Umsatz.** Render-Dienst **fertig & committed** unter `services/sticker-video/` (Node+ffmpeg, Dockerfile, README), aber **bewusst NICHT deployed** (laufende Compute-Kosten skalieren mit Usern → Pleite-Risiko ohne Einnahmen). Stufe 2 (Client) + TODO „Sticker-Pinch-Scale persistent machen" siehe Memory `vibes-create-overlay-compositing`.
4. **Web-Shop-Detailseite** ans Mobile-Minimal angleichen (kosmetisch, aus alter Liste).

---

## 5. Wichtige Gotchas / Architektur (diese Session relevant)
- **Runtime 1.29.0** (`runtimeVersion.policy=appVersion`): OTAs gelten nur für Build 285. Native Änderungen (neue Deps) brauchen neuen Build + version-Bump.
- **view-shot `capture()` liefert Pfad OHNE `file://`** → immer ergänzen vor fetch/Upload (sonst „Invalid URL"). Gilt für Crop/Compositing/Text-Modus.
- **Skia imperatives Compositing:** `drawImageRect` (nicht `drawImage`) für ColorFilter; `MakeImageFromEncoded`(via `Skia.Data.fromBase64`) zum Decoden; `Surface.MakeOffscreen` + `encodeToBase64(3=JPEG, q)`; Datei via `expo-file-system/legacy` `writeAsStringAsync(..., {encoding: EncodingType.Base64})`.
- **Editor-Präsentation = `card`** (nicht modal/fullScreenModal) wegen Gesten/Buttons.
- **`react-native-skia` Text-APIs existieren** (FontMgr.System, ParagraphBuilder, drawText) — für Skia-only-Textrender (falls je nötig).
- **Sehr große Module** (Regressionsrisiko): `app/live/host.tsx`, `app/live/watch/[id].tsx`, `app/create/index.tsx`, `app/create/camera.tsx`.
- **Pre-existing tsc-Fehler (harmlos, Baseline=2):** `'rose'` in `components/explore/exploreStyles.ts` + `components/guild/guildStyles.ts`.

---

## 6. Übernommen aus altem Handoff (noch gültig)
- **Stripe Web-Coin-Shop** funktioniert (Test-Modus). Go-Live = `sk_live_`/Live-Webhook tauschen. Functions `create-checkout-session`(verify_jwt) + `stripe-webhook`(--no-verify-jwt) deployed.
- **Digitale Lieferung „Path A"**: Bucket `digital-products` (privat, Supabase Storage — NICHT R2). Bilder/Videos → R2.
- **Coin-Saldo in `coins_wallets`** (`coins`/`diamonds`/`user_id`), NICHT `profiles.coins_balance`.
- **Web baut isoliert** (Vercel): neue Web-Deps mit `cd apps/web && npm run build` prüfen.
- **`r2-delete` Edge Function:** deployed, aber Source fehlt unter `supabase/functions/` → vor Delete-Änderungen zurückholen.
- **`SCHEMA.md`** (`supabase/SCHEMA.md`) = Source-of-Truth für reale Spalten. `profiles` hat KEIN `follower_count`.
- **„Geld seriöser machen"** — diesen Verlauf ERLEDIGT (Borz Coin → **Serlo Coin**, Diamanten → **Einnahmen** mit € im Vordergrund; Asset + CoinIcon-Komponenten überall). Siehe §1b.

---

## 7. Gedächtnis + Doku
`~/.claude/projects/-Users-zaurhatuev-vibes-app/memory/` (lädt automatisch):
- **`vibes-create-overlay-compositing.md`** ← wichtig für diese Session (view-shot, Text-Modus, Sticker-Video-Defer, Zeichnen/Effekte entfernt)
- `vibes-ota-eas-update-stubs.md` (EAS_BUILD=1!) · `vibes-reanimated-static-import.md`
- `vibes-shop-digital-delivery.md` · `vibes-stripe-coinshop.md` · `vibes-video-perf-strategy.md` · `vibes-web-deps-isolation.md` · `macos-tcc-desktop-preview.md`

Projekt-Doku: **`CLAUDE.md`** (Tech-Stack, Struktur, Design-Gesetz „freundliche App", Migrations-Regeln).

---

## 8. Über Zaur
- Solo-Gründer, deutschsprachig. Serlo/Vibes = TikTok-artige App für die tschetschenische Community, in Produktion (App Store).
- Bevorzugt knapp/direkt, eine Sache pro Commit, warm. **Kostenbewusst** (deshalb Sticker-Video + teure Infra bis Umsatz aufgeschoben). Will Fixes **verifiziert + ausgeliefert**.
- Testet Mobile selbst auf dem Gerät (ich kann Mobile nicht rendern) → iterativ: bauen/OTA → er testet → Feedback. Macht DB-Migrationen + Secrets selbst im Dashboard.
- **Credentials (OpenAI/Stripe-Keys, PAT) gibt er NIE in den Chat** — setzt sie selbst.
