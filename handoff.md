# Handoff — Serlo/Vibes (Stand 22. Juni 2026)

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
| **Letzter Commit** | `edbd3e3` (gepusht) — Light-Mode Kontrast-Sweep |
| **Letzte Mobile-OTA** | `edbd3e3` — **Runtime 1.29.0** (branch `production`, Group `41f06c12`) · 11 OTAs am 22.06. (§1c) |
| **Mobile-Build** | **v1.29.0 / iOS-Build 285 (versionCode 46) → in TestFlight** (vom User gebaut). **NICHT im App Store released!** Alle OTAs dieser Session zielen auf **Runtime 1.29.0** (nur dieser Build hat sie). |
| **NEU nativ in 1.29.0** | `react-native-view-shot@4.0.3` (für Compositing/Text-Modus) → deshalb der neue Build. |
| **Web (apps/web)** | deployt via **Vercel** auf Push zu `main` (`serlo-web.vercel.app`) |
| **DB-Migrationen** | 4 dieser Session **angewandt** (§3) — zuletzt `followers_only` |
| **EAS project id** | `02ab536a-5836-4560-a5ec-2dfd6e059f90` · **iOS bundle** `com.vibesapp.vibes` · EAS-Account `zaurhat` |
| **GERADE IN ARBEIT** | — (zuletzt: **UI-Politur-Session** §1c — „Nur Follower", Kontrast-Fixes, Creator-Tools, LIVE-Setup, Studio-Hub, alles ausgeliefert) |

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

## 1c. UI-Politur-Session (22. Juni 2026) — alle OTA, Runtime 1.29.0

> Nach dem „Nur Follower"-Feature (§4 B) eine Reihe UI-Fixes/Redesigns auf Basis von User-Screenshots. Alle JS-only → via OTA ausgeliefert. tsc-Baseline durchgehend = 2 (rose, harmlos).

### Kontrast-Bugs auf dunklen Flächen (Light-Theme-Farben auf Schwarz)
- **„Folge ich"-Empty-State** (`components/feed/FollowingEmptyState.tsx`, Commit `c0c66cc`): Feed-Hintergrund ist immer `#000` (TikTok-Stil, `feedStyles.container`), Komponente nutzte aber `useTheme()` → im Light-Mode Titel + Explore-Button dunkel-auf-schwarz = unsichtbar. Auf **feste Hell-auf-Dunkel-Palette** (`FEED`) umgestellt, `useTheme` entfernt. **Muster-Lernen:** Komponenten, die über dem immer-schwarzen Feed liegen, dürfen keine theme-abhängigen Farben nutzen.
- **KI-Cover-Sheet** (`components/ai/AIImageSheet.tsx` + `lib/useGenerateImage.ts`, Commit `34189ad`): `colors.accent.primary` ist **invers** (weiß im Dark-, schwarz im Light-Mode); Buttons hatten Text/Icon hart `#fff` → im Dark-Mode weiß-auf-weiß (Format-Pill + „Generieren" unsichtbar). Fix: Text/Icon auf accent.primary-Buttons = `colors.bg.primary`. Kalte „non-2xx"-Meldung → warm (Design-Gesetz), rohe Ursache als `__DEV__`-Log. **KI-Generierung selbst schlägt weiter fehl bis `OPENAI_API_KEY` gesetzt ist** (§4.2, User-Aktion) — nur die UI ist gefixt.

### Creator-Tools-Sheet Redesign (`components/live/CreatorToolsSheet.tsx` + `app/live/host.tsx`, Commit `02887e2`)
- Flaches graues 3-Spalten-Raster → **gruppierte 2-spaltige Quer-Kacheln** mit dauerhaft farbigem Icon-Chip + Status-Zeile + klarem Aktiv-Zustand (accent-Tint + Rahmen + Status). `CreatorToolItem` um `group` + `status` erweitert; host.tsx-Tools befüllt (Sektionen: Engagement/Verkaufen/Stream & Chat/Co-Host/Battle); zustandskodierte Labels zu stabilen Nomen vereinfacht. Optionaler Header-`subtitle` (Zuschauerzahl).

### LIVE-Setup-Karte (`app/live/start.tsx`, Commit `a672249`, OTA `4f1f1250`)
- „LIVE gehen" wirkte leer (Config im Zahnrad versteckt). Neu: **Setup-Karte über dem Live-Button** mit Titel · Publikum (tippt durch 🌍→👥→🌸) · Kategorie · Cover · Kommentare/Geschenke-Toggles direkt sichtbar. Umdrehen + Zahnrad nach oben rechts. Einstellungs-Sheet bleibt als „Erweitert". Toter `ToolbarBtn` + Styles raus.

### Studio-Hub (`app/create/camera.tsx`, Commit `91e7570`, OTA `c9601ff4`)
- Studio-Landing war karg + vermischte Text-Composer mit Medien-Picker (weil `captureMode='text'` über Tab-Wechsel erhalten blieb). Neu: **Hub mit zwei Karten** „Aus Galerie" (→ Editor) + „Text-Post", **Format**-Auswahl, **„Im Editor"-Leiste** (Zuschneiden/Filter/Text/Sticker/Cover — macht die vorhandene Editor-Tiefe sichtbar), **„Entwürfe fortsetzen"** → `/creator/drafts`.
  - **Bewusst:** „Text-Post" springt in den bestehenden **Vibe-Text-Composer** (`setStudioMode('vibe')+setCaptureMode('text')`) statt ihn zu duplizieren. `handleStudioModeChange` resettet beim Studio-Wechsel ein übernommenes `text` → Hub zeigt sauber. Entwürfe-Zeile **navigiert nur** (keine Inline-Thumbnails → keine Query auf den heißen Kamera-Screen).
  - **Design-Haltung dokumentiert:** TikTok-Feature-Parität *nicht* angestrebt (Kosten-/Scope-Falle + Edge = Community/Kultur). Studio = fokussierter Hub, der vorhandene Tiefe sichtbar macht.

### Bottom-Nav TikTok-Stil (`app/(tabs)/_layout.tsx`, Commits `d452c86` + `632cd47`)
- Plus-Button schwebte (flex-end + Lift/3D-Verlauf) → Icons nicht auf einer Höhe. Fix: `tabBarInner` `flex-end`→`flex-start`, Plus sitzt flach auf Icon-Höhe. Neue Plus-Taste: breite Taste mit Farbversatz (**Serlo Pink+Lila**, NICHT TikToks cyan/rot — Trade-Dress). `632cd47`: Mitte theme-abhängig (Dark = weiß+dunkles Plus, **Light = schwarz+weißes Plus**, sonst weiß-auf-weiß). OTAs `c282fd6a` + `882d9ec9`.

### „Folge ich"-Empty-State Layout (`components/feed/FollowingEmptyState.tsx`, Commit `8337041`, OTA `3e801814`)
- Inhalt überlappte die absolute Feed-Kopfleiste (Toggle bei `insets.top`, 52px) → Icon-Ring verdeckt. Fix: `paddingTop = insets.top + 64`. Innere `ScrollView` (maxHeight 340, verschachtelt → nur ~2 User) raus → Karten inline, äußerer Feed-Scroll übernimmt; `s.root flex:1` entfernt.

### ⭐ Google-Login vorbereitet (Commit `10c4a41`, KEIN OTA — gated)
- **Code fertig, aber AUS:** `lib/useGoogleSignIn.ts` (Supabase `signInWithOAuth('google')` + In-App-Browser `expo-web-browser`, Implicit-Flow → `setSession`). Buttons in Login + Register (geteiltes `components/ui/GoogleGlyph.tsx`).
- **Gated hinter `ENABLE_GOOGLE_LOGIN=false`** + `expo-web-browser` lazy via `require` → OTA-sicher (kein Crash auf Build 285). `expo-web-browser` ist neue native Dep + Config-Plugin (`app.json`) → **braucht Rebuild**.
- **Aktivierung = Dashboard-Config + Flag + Build:** Schritt-für-Schritt in **`docs/auth-setup.md`** (Resend-E-Mail-Fix + Google-Cloud-OAuth-Client + Supabase-Provider + Redirect `vibes://login-callback`). Web-OAuth-Client genügt (kein nativer iOS/Android-Client). Danach `ENABLE_GOOGLE_LOGIN=true` im Rebuild-Commit.
- **Warum:** Aktuell Signup nur via Apple (iOS) — **Android = kein funktionierender Signup-Weg** (E-Mail kaputt). Zielgruppe stark Android → vor Launch Show-Stopper. Empfehlung: Resend (Config, kein Build) sofort; Google mit nächstem geplanten Build bündeln.

### Shop-Politur (`app/shop/index.tsx`, Commits `8b017b7` + `db1d509`)
- **Karten-Badges entfeinert:** „-99%"-Sale flacher Block → Pill mit dezenter Tiefe (Shadow, bolder); „Nur N übrig" vollbreiter neon-oranger Streifen → **dunkler Glas-Chip** unten links + Flammen-Icon; NEU-Badge analog. OTA `6434f852`.
- **Coin-Stand im Header:** kleines Coin (15px) im umrandeten Pill → **randlos + 28px** + größere Zahl. OTA `71bad0e5`. (Coin taucht auch in Profil-Aktionsleiste auf — dort noch klein, auf Zuruf angleichbar.)

### Light-Mode Kontrast-Sweep (Commits `bae917b` + `edbd3e3`)
- Proaktiver Pass gegen das wiederkehrende **Weiß-auf-weiß**-Muster (Memory `vibes-lightmode-contrast-bug`). Avatar-Initialen-Fallbacks (User ohne Bild → unsichtbar im Light-Mode) auf theme-adaptiven Flächen gefixt → `colors.bg.subtle` + `colors.text.secondary`:
  - **Explore** Discover-Karten + Suchergebnis-Zeilen (`ExploreUserRow`, OTA `1eaba3d3`)
  - **Kommentar-@Mention**, **Guild-Leaderboard** (Post+Mitglied), **Profil-Avatar** (`profileStyles`), **Messages-User-Such-Modal** (OTA `41f06c12`)
- **Bewusst unberührt:** immer-dunkle Flächen (Story-Viewer, Feed-Stories-Row, Live-/Likers-/Viewer-/Profil-Share-Sheets) — dort ist Weiß korrekt, ein „Fix" hätte sie im Light-Mode gebrochen.
- **Regel (Memory):** Komponente mit `colors.bg.*` als Fläche → Text/Icon/Fallback auch über `colors.*`. Über dem immer-schwarzen Feed (`feedStyles.container`=#000) umgekehrt: feste Hell-auf-Dunkel-Palette. Noch offen: tieferer Audit von beliebigem weißem **Text** (nicht nur Avatare) — breiter/riskanter, daher nicht im Sweep.

### OTAs dieser Session (alle Runtime 1.29.0, iOS+Android)
- `82fe358a` — „Nur Follower"-Publikum (§4 B)
- `7c223edb` — Folge-ich-Kontrast + KI-Cover-Buttons + Creator-Tools-Redesign
- `4f1f1250` — LIVE-Setup-Karte
- `c9601ff4` — Studio-Hub
- `c282fd6a` — Bottom-Nav TikTok-Stil (Icons aligned + neue Plus-Taste)
- `3e801814` — Folge-ich-Empty-State Layout
- `882d9ec9` — Plus-Taste Light-Mode schwarz
- `1eaba3d3` — Explore-Avatar-Fallback Light-Mode sichtbar
- `6434f852` — Shop-Badges entfeinert (Sale-Pill + Glas-Chip)
- `71bad0e5` — Shop-Coin randlos + groß
- `41f06c12` — Light-Mode Kontrast-Sweep (Avatar-Fallbacks)

### Offen / nächste Schritte
- **⭐ Google-Login aktivieren** (`docs/auth-setup.md`) + **Resend-E-Mail fixen** — beides User-Config; Google braucht zusätzlich Flag-Flip + Rebuild.
- Studio-Entwürfe-Zeile mit echten Thumbnails (braucht `usePostDraftsCloud`-Query auf dem Kamera-Screen).
- Creator-Tools „AN"-Pill (bewusst weggelassen — Aktiv-Zustand trägt schon Tint+Rahmen+Status).

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
- `20260621140000_live_followers_only_audience.sql` ✅ (Spalte `live_sessions.followers_only` + Partial-Index)

---

## 4. OFFENE PUNKTE / Nächste Schritte

### B) ✅ ERLEDIGT + AUSGELIEFERT: „Nur Follower"-Zuschauen (Live-Publikum-Picker)
**Ziel erreicht:** Live kann auf „nur Follower" gestellt werden → nur Follower des Hosts bekommen ein LiveKit-Token (Nicht-Follower auch per Direktlink draußen). Commit `68c7c72`, OTA Group `82fe358a`.
- [x] **Migration** `20260621140000_live_followers_only_audience.sql` ✅ — Spalte `live_sessions.followers_only boolean default false` + Partial-Index. ⚠️ **NICHT verwechseln** mit dem bereits existierenden `followers_only_chat` (steuert nur Chat-Schreibrecht); `followers_only` steuert das **Zuschauen** (im COMMENT dokumentiert).
- [x] **Durchsetzung** `supabase/functions/livekit-token/index.ts` (deployed): neuer **SEC-3-Block** nach Host/CoHost-Gates. Pure Viewer (`!isHost && !coHostApproved`): Session per `room_name`+`status=active` → `select=host_id,followers_only`. Wenn `followers_only===true` und nicht der Host selbst: `follows`-Check (`follower_id`/`following_id`); kein Treffer → **403** `{ error:'followers_only', message:… }`. **Rein additiv** — blockt nur im followers_only-Fall, öffentliches Verhalten unverändert.
- [x] **Client `lib/useLiveSession.ts`:** `LiveSession`-Type + `startSession`-Option (`followersOnly`) + Insert um `followers_only` erweitert.
- [x] **Client `app/live/start.tsx`:** toter „Wer kann zuschauen"-Pressable → echter Chip-Picker **🌍 Öffentlich / 👥 Nur Follower / 🌸 Nur Frauen** (mutually exclusive via `audience`/`setAudience`; „Nur Frauen" nur bei `canAccessWomenOnly`). Women-Only-Switch in den Picker integriert, `ChevronRight`-Import entfernt.
- [x] **Viewer-Seite `app/live/watch/[id].tsx`:** 403 am Token-Catch erkannt (`msg.includes('followers_only')`) → `followersBlocked`-State → freundlicher **„🔒 Nur für Follower"**-Screen mit „Folgen & reinkommen"-Button (folgt via `useFollow` → Token mit 3×-Retry neu holen, weil follows-INSERT einen Moment braucht).
- ⚠️ **Bewusste Scope-Grenze:** **Geplante Lives** (`submitSchedule` → `scheduleLive`) reichen `followers_only` **NICHT** durch — identisch zu `category` (dort ebenfalls offen). Wer „Nur Follower" + „Planen" wählt, verliert die Einstellung still. Nachziehen = Spalte in `scheduled_lives` + Durchreichen im Plan-Flow.

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
