# Schwachstellen & Lösungsplan — Serlo / Vibes App

> Erstellt: 2026-06-07 | Basis: vollständige Code-Analyse aller 65 Screens, 93 Komponenten, 343 SQL-Migrationen, 21 Edge Functions

---

## PRIORITÄT 1 — Kritisch (Produktionsgefährdend)

### SW-01: God Files — Wartbarkeits-Totalausfall
**Problem:** Drei Dateien tragen über 9.300 Zeilen kombiniert. Jede Änderung hat hohes Regressionsrisiko. Debugging ist kaum möglich. CI scheitert konzeptuell weil keine Unit-Tests möglich.

| Datei | Zeilen | Verantwortlichkeiten gemischt |
|---|---|---|
| `app/live/host.tsx` | 3.632 | ViewerCount-Hook, HostControls, CameraView, CoHostVideo, Chat, Overlays, Shop, Polls, Sticker, StyleSheet |
| `app/live/watch/[id].tsx` | 3.249 | RemoteVideo, GridTile, EndedOverlay, WatchUI, Chat, CoHost-Modus, Gifts, Polls, Shop, StyleSheet |
| `app/create/index.tsx` | 2.498 | StickerSheet, FilterSheet, DrawTool, AdjustSheet, RotateSheet, TrimSheet, TextOverlay, DetailsSheet, Scheduler |

**Lösung:** Vollständige Modularisierung (siehe Abschnitt "Modularisierungsplan" unten)
**Status:** 🔄 In Arbeit (Backups erstellt: 2026-06-07)

---

### SW-02: r2-delete Edge Function fehlt im Repo aber läuft in Produktion
**Problem:** `supabase/functions/r2-delete` existiert NICHT im Repo, ist aber deployed und aktiv. Jede Änderung an Delete-Verhalten ist nicht nachvollziehbar, nicht versioniert, nicht rollback-fähig. Produktions-Cleanup hat bereits einen Fehler gemeldet (`products/images/...` Pfad rejected).

**Lösung:**
1. `supabase functions download r2-delete` → Code in Repo bringen
2. Unter `supabase/functions/r2-delete/index.ts` einchecken
3. Smoke-Test für `products/images/...` Pfad hinzufügen
4. In `LIVE_DEPLOYMENT_CHECKLIST.md` vermerken

**Status:** ⛔ Nicht begonnen

---

### SW-03: RevenueCat Phase-3 Server-Verifikation fehlt
**Problem:** `supabase/functions/revenuecat-webhook/index.ts` hat Apple App Store Server API + Google Play Developer API als TODO-Stubs. Replay-Schutz (10 Min Fenster) und Rate-Limit (20/h) sind aktiv, aber ein Angreifer mit dem Webhook-Secret kann beliebige Coins gutschreiben ohne echten Kauf. Bei Wachstum reales Fraud-Risiko.

**Lösung:**
1. Apple: App Store Server API `verifyReceipt` oder Server Notifications V2 integrieren
2. Google: Play Developer API `purchases.products.get` integrieren
3. Env-Flag `ENABLE_RECEIPT_VERIFY=true` aktivieren (Scaffold bereits vorhanden)
4. Required Secrets dokumentieren: `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`

**Status:** ✅ Erledigt (2026-06-08) — Echte Apple App Store Server API (ES256 JWT) + Google Play Developer API (Service Account OAuth2) implementiert. Deployed. `ENABLE_RECEIPT_VERIFY=true` aktivieren NACH Secrets-Setup (Doku unten).

---

### SW-04: GIPHY API Key hardcoded als Fallback
**Problem:** `app/create/index.tsx:115` — `const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '9Kp17xdnCuF9EsveCTQNmKplwF1PRmHY'` — der echte Key liegt als Fallback im Source Code. Dieser landet im Git-History und im kompilierten JS-Bundle (sichtbar für jeden mit `expo export`).

**Lösung:**
1. Hardcoded Fallback entfernen: `const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? ''`
2. Key in `.env` und EAS Secrets sicherstellen
3. Wenn kein Key: Feature graceful disablen (Sticker-Button ausblenden)

**Status:** ⛔ Nicht begonnen

---

## PRIORITÄT 2 — Hoch (Stabilitätsrisiko)

### SW-05: Sentry nicht konfiguriert in Produktion
**Problem:** Handoff-Dokument: "Observability reports Yellow". `NEXT_PUBLIC_SENTRY_DSN` und `SENTRY_DSN` fehlen in Vercel Envs. Fehler in Web-Produktion gehen unbemerkt verloren. Kein Source-Map-Upload → Stack Traces unbrauchbar.

**Lösung:**
1. Vercel: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` setzen
2. Preview-Deploy testen bevor `SENTRY_ENABLE_EDGE=1` aktiviert wird (wegen `__dirname` crash history)
3. Native Sentry DSN verifizieren in `.env`

**Status:** ⛔ Nicht begonnen

---

### SW-06: Keine Tests trotz jest.config.js
**Problem:** `jest.config.js`, `jest.setup.js`, 17 Test-Stub-Dateien unter `stubs/` existieren — aber keine einzige `*.test.ts` Datei im Projekt. Bei 65 Screens, 93 Komponenten, 343 Migrationen und kritischen Geldflüssen (RevenueCat) ist das ein blindes Vertrauen auf manuelles Testing.

**Lösung (Prio-geordnet):**
1. Unit-Tests für `lib/liveModerationWords.ts` (Security-kritisch, komplex, regex-basiert)
2. Unit-Tests für `supabase/functions/revenuecat-webhook` (Geldfluss)
3. Integration-Tests für `credit_coins` RPC (Idempotenz)
4. Smoke-Tests für Auth-Flow (Login → Feed)
5. Ziel: ≥ 20% Coverage auf `lib/` bis nächstem Release

**Status:** ✅ Erledigt (2026-06-08) — 109 Jest-Tests (5 Test-Suites) + 30 Deno-Tests für Webhook. Coverage: liveModerationWords.ts (100% branches), creditCoins Business-Logik (100%), gifts.ts helpers (90%+). Deno-Tests: `supabase/functions/revenuecat-webhook/__tests__/webhook.test.ts`.

---

### SW-07: Alert.prompt ohne Android-Fallback
**Problem:** `Alert.prompt()` funktioniert nur auf iOS (React Native Docs). Wird in `host.tsx` (3× Aufrufe: Zeilen 419, 1132, 1138) und `settings.tsx` (2× Aufrufe: Zeilen 218, 231) ohne Platform-Check verwendet. Auf Android: silenter Fail — Dialog öffnet sich nie, User kann nicht tippen.

**Lösung:**
1. Alle `Alert.prompt` Stellen mit `Platform.OS === 'ios'` wrappen
2. Android-Fallback: custom `TextInput` Modal (bereits in anderen Screens vorhanden)
3. Helper `promptCrossPlatform(title, msg, callback)` extrahieren → DRY

**Status:** ⛔ Nicht begonnen

---

### SW-08: 12 unguarded console.log/warn/error in Production
**Problem:** 12 `console.*` Calls ohne `__DEV__` Guard in `lib/` und `app/`. In Hermes Production-Build führt das zu: (a) Minimale Perf-Kosten, (b) Sentry-Breadcrumb-Spam, (c) potentieller Datenleck durch Objekt-Serialisierung.

**Betroffene Dateien:**
- `lib/useVoiceReader.ts` (4 Calls)
- `lib/useVoiceClone.ts` (5 Calls)
- `lib/useGenerateImage.ts` (1 Call)
- `lib/useFaceDetection.ts` (1 Call)
- `app/live/start.tsx` (1 Call)

**Lösung:** Alle ersetzen durch `__DEV__ && console.*` oder Sentry.captureException für Errors

**Status:** ⛔ Nicht begonnen

---

### SW-09: typedRoutes deaktiviert in Web
**Problem:** `typedRoutes` ist in `apps/web/next.config.mjs` disabled bis route pushes migriert werden. Ohne typisierte Routes: Tippfehler in Navigation-Strings werden zur Runtime (nicht Compile-Time) entdeckt. Besonders gefährlich bei der Route-Anzahl dieser App.

**Lösung:**
1. `typedRoutes: true` aktivieren
2. Alle `router.push('/pfad')` → `router.push('/pfad' as Route)` oder korrekte typed imports
3. Fix als separater PR da Breaking-Change

**Status:** ✅ Erledigt (2026-06-08) — `typedRoutes: true` aktiv. 25 Dateien migriert (`as Route`-Casts + `Route`-Import). Build: ✓ grün ohne Type-Errors.

---

## PRIORITÄT 3 — Mittel (Code-Qualität / Technische Schulden)

### SW-10: Legacy Checkout auf Desktop ist dirty
**Problem:** `/Users/zaurhatuev/Desktop/vibes-app` existiert noch und ist dirty. Unfallrisiko: Commands aus dem falschen Ordner (EAS Build, Supabase Functions deploy) treffen die falsche Codebase.

**Lösung:**
1. Legacy Checkout archivieren: `mv ~/Desktop/vibes-app ~/Desktop/vibes-app-LEGACY-$(date +%Y%m%d)` 
2. Oder komplett löschen wenn kein historischer Wert
3. In CLAUDE.md bereits dokumentiert — Terminal-Kontext vor jedem Befehl prüfen

**Status:** ⛔ Nicht begonnen

---

### SW-11: tailwind.config.js im Root obwohl "kein Tailwind"
**Problem:** `tailwind.config.js` und `global.css` liegen im Projekt-Root, obwohl CLAUDE.md explizit "Kein Tailwind — StyleSheet only" vorschreibt. Verursacht Verwirrung für neue Entwickler + möglicherweise unnötige bundle-Größe.

**Lösung:**
1. Prüfen ob `tailwind.config.js` noch aktiv referenziert wird (NativeWind?)
2. Falls NativeWind aktiv: CLAUDE.md aktualisieren ("NativeWind erlaubt in Web-Layer")
3. Falls dead: Beide Dateien löschen

**Status:** ⛔ Nicht begonnen

---

### SW-12: Backup-Dateien im Repo
**Problem:** Die 3 Backup-Dateien (`*.backup-20260607_234248`) liegen jetzt im Working Tree und würden bei `git add .` committed werden.

**Lösung:**
1. `.gitignore` um `*.backup-*` erweitern
2. Backups nach `/tmp/` oder in einen `.backups/` Ordner der in `.gitignore` steht verschieben

**Status:** 🔄 Sofort beheben

---

### SW-13: Hardcoded Farben in Live-Screens (kein useTheme())
**Problem:** Beide Live-Dateien verwenden hunderte hardcoded Hex-Farben (`#fff`, `#0a0a14`, `rgba(0,0,0,0.65)`, etc.) statt `useTheme()`. Live-Screens ignorieren Dark/Light Mode Setting. Nicht nur ästhetisch — falls User Light Mode hat, bricht der Kontrast.

**Lösung:**
1. Nach Modularisierung (SW-01) Theme-Pass durch `host/` und `watch/` Komponenten
2. Gemeinsame Live-Farb-Konstanten in `lib/liveTheme.ts` extrahieren (Live-UI ist immer dunkel → fixed dark palette okay, aber über Konstanten)

**Status:** 🔄 Teilweise (2026-06-08) — `lib/liveColors.ts` mit vollständigem LC-Token-System erstellt (alle semantischen Farben: bg, text, accent, battle, badge, border). Live-Screens verwenden noch direkte Hex-Werte — automatisches Bulk-Replace war fehleranfällig (StyleSheet-Inline-Objekte). Nächster Schritt: manuelle Migration neuer Komponenten auf `import { LC } from '@/lib/liveColors'`.

---

### SW-14: `any` Types in LiveKit-Integration
**Problem:** Massiver Einsatz von `as any` in der LiveKit-Integration (30+ Stellen in host.tsx + watch/[id].tsx). Verhindert TypeScript-Fehlererkennung bei LiveKit SDK Updates. Beim Update von `@livekit/react-native 2.9.6` auf 3.x werden Breaking Changes nicht erkannt.

**Lösung:**
1. Korrekte LiveKit Typen importieren: `TrackReferenceOrPlaceholder`, `LocalParticipant`, etc.
2. Wrapper-Typen in `lib/livekitTypes.ts` definieren
3. `as any` schrittweise ersetzen

**Status:** ✅ Erledigt (2026-06-08) — `TrackReference` aus `@livekit/components-core`; `DimensionValue` für `gridTilePct`; `isSystem?: boolean` in `LiveComment`; `StyleSheet.absoluteFill as ViewStyle` für VideoTrack-Props. 0 neue TS-Errors. Verbleibende `as any`: Hermes-CJS-Require (CLAUDE.md-Pflicht), `pointerEvents`-StyleSheet-Limitation.

---

### SW-15: Edge Sentry disabled (unverified)
**Problem:** `SENTRY_ENABLE_EDGE` bleibt ungesetzt wegen altem `__dirname` Crash. Vercel Edge Runtime Fehler (middleware, edge API routes) gehen unbemerkt verloren.

**Lösung:**
1. Preview Deploy mit `SENTRY_ENABLE_EDGE=1` testen
2. Wenn kein Crash: in Vercel Production aktivieren
3. Wenn Crash: Sentry Edge import fixen

**Status:** ⛔ Wartet auf SW-05

---

### SW-16: Fehlende Fehlerbehandlung in Upload-Flow
**Problem:** `lib/uploadMedia.ts` hat keine Retry-Logik. Bei kurzem Netzwerkausbruch während Video-Upload (häufig auf Mobile) schlägt der komplette Post-Erstellungs-Flow fehl ohne Recovery-Option.

**Lösung:**
1. Exponential-Backoff Retry (3 Versuche) für R2 Upload-Calls
2. Upload-Progress persistieren in Draft (bereits Draft-System vorhanden)
3. Resume-from-checkpoint wenn Upload-URL noch valid ist

**Status:** ✅ Bereits implementiert — `withRetry()` auf Zeilen 96–115 mit Exponential-Backoff (500ms → 1s → 2s), 3 Versuchen, `onRetry`-Callback und `AbortController`-Support. Genutzt für r2-sign (Z.167) und R2-PUT (Z.194).

---

## PRIORITÄT 4 — Niedrig (Langfristig)

### SW-17: Health Dashboard dauerhaft Yellow
**Problem:** `npm run health:dashboard` meldet Yellow für: Product Metrics, Launch Readiness, Observability, Push/Feed. Kein konkretes Blocking-Problem, aber zeigt unfertige Instrumentierung.

**Lösung:** Nach SW-05 (Sentry) und Wachstum: PostHog/Amplitude Integration für Product Metrics

---

### SW-18: Stripe Webhook in Edge Functions ohne Tests
**Problem:** `supabase/functions/stripe-webhook` existiert, aber Stripe-Integration ist im CLAUDE.md nicht dokumentiert. Unklarer Verwendungszweck — möglicherweise toter Code oder ungetesteter Payment-Pfad.

**Lösung:** Klären ob aktiv → wenn ja dokumentieren und testen, wenn nein: löschen

---

### SW-19: Scheduled Lives Cron ohne Monitoring
**Problem:** `supabase/functions/scheduled-lives-cron` und `publish-scheduled-posts` laufen via pg_cron. Keine Alerting wenn Jobs fehlschlagen (nach 3 Retries → 'failed' State, aber kein Push an Admins).

**Lösung:** Failed-State Webhook → Admin-Push-Notification via `send-push-notification` Edge Function

---

---

## Modularisierungsplan — SW-01 Implementierung

### Neue Verzeichnisstruktur

```
components/live/
├── host/
│   ├── useViewerCount.ts          (aus host.tsx:131-185)
│   ├── HostControls.tsx           (aus host.tsx:188-249)
│   ├── LocalCameraView.tsx        (aus host.tsx:251-309)
│   ├── RemoteCoHostVideoView.tsx  (aus host.tsx:310-361)
│   ├── HostTopBar.tsx             (aus HostUI JSX)
│   ├── HostChatPanel.tsx          (aus HostUI JSX: Kommentar-Liste + Input)
│   ├── HostRightActions.tsx       (aus HostUI JSX: rechte Button-Spalte)
│   ├── HostOverlaysLayer.tsx      (aus HostUI JSX: Gifts, Reactions, Sticker, Polls)
│   └── index.ts                   (re-exports)
│
├── watch/
│   ├── RemoteVideoView.tsx        (aus watch/[id].tsx:111-219)
│   ├── GridRemoteTile.tsx         (aus watch/[id].tsx:226-287)
│   ├── LiveEndedOverlay.tsx       (aus watch/[id].tsx:290-396)
│   ├── WatchTopBar.tsx            (aus WatchUIContent JSX)
│   ├── WatchChatPanel.tsx         (aus WatchUIContent JSX)
│   ├── WatchRightActions.tsx      (aus WatchUIContent JSX)
│   ├── WatchOverlaysLayer.tsx     (aus WatchUIContent JSX)
│   └── index.ts                   (re-exports)

components/create/editor/
├── StickerSheet.tsx               (aus create/index.tsx:122-215)
├── StickerOverlayItem.tsx         (aus create/index.tsx:218-308)
├── FilterSheet.tsx                (aus create/index.tsx:309-481)
├── DrawTool.tsx                   (aus create/index.tsx:472-697 — DrawCanvas + DrawToolbar)
├── AdjustSheet.tsx                (aus create/index.tsx:698-762)
├── RotateSheet.tsx                (aus create/index.tsx:763-810)
├── VideoTrimSheet.tsx             (aus create/index.tsx:811-990)
├── TextOverlay.tsx                (aus create/index.tsx:991-1264 — Editor + Item + Trash)
├── PostSuccessOverlay.tsx         (aus create/index.tsx:1265-1321)
├── DetailsSheet.tsx               (aus create/index.tsx:1322-1497)
├── SchedulerModal.tsx             (aus create/index.tsx:1498-1681)
└── index.ts                       (re-exports)
```

### Reihenfolge der Extraktion

**Phase A — create/index.tsx** (einfachste Abhängigkeiten, standalone Komponenten)
1. StickerSheet + bs-Styles → `components/create/editor/StickerSheet.tsx`
2. StickerOverlayItem → `components/create/editor/StickerOverlayItem.tsx`
3. FilterSheet + Filter-Utilities → `components/create/editor/FilterSheet.tsx`
4. DrawCanvas + DrawToolbar → `components/create/editor/DrawTool.tsx`
5. AdjustSheet → `components/create/editor/AdjustSheet.tsx`
6. RotateSheet → `components/create/editor/RotateSheet.tsx`
7. VideoTrimSheet → `components/create/editor/VideoTrimSheet.tsx`
8. TextOverlayEditor + TextOverlayItem + TrashZone → `components/create/editor/TextOverlay.tsx`
9. PostSuccessOverlay → `components/create/editor/PostSuccessOverlay.tsx`
10. DetailsSheet → `components/create/editor/DetailsSheet.tsx`
11. SchedulerModal → `components/create/editor/SchedulerModal.tsx`

**Phase B — host.tsx** (LiveKit-abhängig, komplexere State-Verkabelung)
1. useViewerCount → `components/live/host/useViewerCount.ts`
2. HostControls → `components/live/host/HostControls.tsx`
3. LocalCameraView → `components/live/host/LocalCameraView.tsx`
4. RemoteCoHostVideoView → `components/live/host/RemoteCoHostVideoView.tsx`
5. HostTopBar → `components/live/host/HostTopBar.tsx`
6. HostChatPanel → `components/live/host/HostChatPanel.tsx`
7. HostRightActions → `components/live/host/HostRightActions.tsx`
8. HostOverlaysLayer → `components/live/host/HostOverlaysLayer.tsx`

**Phase C — watch/[id].tsx** (ähnlich host.tsx, aber Viewer-Perspektive)
1. RemoteVideoView → `components/live/watch/RemoteVideoView.tsx`
2. GridRemoteTile → `components/live/watch/GridRemoteTile.tsx`
3. LiveEndedOverlay → `components/live/watch/LiveEndedOverlay.tsx`
4. WatchTopBar → `components/live/watch/WatchTopBar.tsx`
5. WatchChatPanel → `components/live/watch/WatchChatPanel.tsx`
6. WatchRightActions → `components/live/watch/WatchRightActions.tsx`
7. WatchOverlaysLayer → `components/live/watch/WatchOverlaysLayer.tsx`

---

## Tracking

| ID | Titel | Prio | Status |
|---|---|---|---|
| SW-01 | God Files modularisieren | P1 | ✅ Erledigt (2026-06-07) |
| SW-02 | r2-delete ins Repo bringen | P1 | ✅ Erledigt (2026-06-07) |
| SW-03 | RevenueCat Server-Verifikation | P1 | ⛔ Offen |
| SW-04 | GIPHY Key Fallback entfernen | P1 | ✅ Erledigt (2026-06-07) |
| SW-05 | Sentry konfigurieren | P2 | ✅ Native aktiv, Web DSN gesetzt (gemeinsame DSN vorläufig) — separates Web-Projekt noch anlegen |
| SW-06 | Tests einführen | P2 | ✅ Erledigt |
| SW-07 | Alert.prompt Android-Fallback | P2 | ✅ Erledigt — PromptProvider + usePrompt, alle 5 Stellen migriert |
| SW-08 | console.* Guards | P2 | ✅ Erledigt — 11 Stellen mit __DEV__ && gesichert |
| SW-09 | typedRoutes aktivieren | P2 | ✅ Erledigt |
| SW-10 | Legacy Checkout bereinigen | P3 | ✅ Erledigt — archiviert als ~/Desktop/vibes-app-LEGACY-20260607 |
| SW-11 | tailwind.config.js klären | P3 | ✅ Erledigt — tailwind.config.js + global.css + nativewind-env.d.ts gelöscht (NativeWind nie benutzt) |
| SW-12 | Backup-Dateien aus Git halten | P3 | ✅ Erledigt — *.backup-* in .gitignore |
| SW-13 | Hardcoded Farben → useTheme() | P3 | 🔄 Teilweise |
| SW-14 | any-Types in LiveKit ersetzen | P3 | ✅ Erledigt |
| SW-15 | Edge Sentry testen | P3 | ⛔ Offen — SENTRY_ENABLE_EDGE=1 noch testen |
| SW-16 | Upload Retry-Logik | P3 | ✅ War schon da |
| SW-17 | Health Dashboard Yellow | P4 | ⛔ Offen |
| SW-18 | Stripe Webhook klären | P4 | ⛔ Offen |
| SW-19 | Scheduled Jobs Alerting | P4 | ⛔ Offen |
