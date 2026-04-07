![
    
](image.png)# Vibes — Roadmap

> Letztes Update: April 2026

---

## ✅ Phase 1 — Foundation (abgeschlossen)

- [x] Feed (personalisierter Algorithmus, Explore, Tags)
- [x] Post erstellen (Video + Bilder, Trimming, Thumbnail-Upload)
- [x] Profile (eigenes + fremdes Profil, Grid, Follow/Unfollow)
- [x] Kommentare (Threads, Replies, Realtime)
- [x] Likes, Bookmarks, Reposts
- [x] Direktnachrichten (DM mit Realtime)
- [x] Notifications (Push + In-App)
- [x] Live Streaming (LiveKit, Host + Viewer, Geschenke, Reaktionen)
- [x] Stories (Erstellen, Ansehen, Polls, Reply via DM)
- [x] Guilds (Communities, Guild-Feed, Leaderboard)
- [x] Hashtag-Navigation (klickbar im Feed und Post-Detail)
- [x] User blockieren / melden
- [x] Einstellungen (Account, Datenschutz, Löschen)
- [x] Apple Sign-In
- [x] Onboarding Flow

---

## 🚀 Phase 2 — iOS Launch (aktuell)

- [x] Performance-Optimierungen (Thumbnail-Preview, N+1-Fix, JOIN-Queries)
- [x] Glassmorphism UI (Live Start Screen)
- [x] Persistenter React Query Cache (Feed überlebt Kaltstarts)
- [x] `cachePolicy="memory-disk"` auf allen Feed-Bildern
- [x] Virtuelle Geschenke (Supabase Schema, Gift Catalog, Coins, Realtime-Hook, Animated UI)
- [x] AR Kamera v2 — Skia Frame Processor (ColorMatrix Color-Filter, 22 Filter)
- [x] AR Kamera v3 — Live Face-Tracking Sticker, Vignette, Rainbow-Frame, Bug-Fixes
- [x] Deep Bug-Fix: Storage-Leak, Race-Condition, stale-closure, RefObject-Typ
- [x] Open-Source Audit (Skia, ML Kit, VisionCamera, Reanimated, Moti, Haptics)
- [x] **AR Kamera Upgrade** ✅
  - [x] Phase 1: Haptic Feedback auf Shutter + Filter-Wechsel
  - [x] Phase 2: Reanimated Migration (LiveStickerOverlay von legacy Animated)
  - [x] Phase 3: GPU Shader Filter (Film Grain, Chromatic Aberration, Halftone, Glitch)
  - [x] Phase 4: Skia Skottie — animierte Lottie-Sticker statt Emoji-Text
  - [x] Phase 5: `moti` aus package.json entfernen (totes Paket)
- [x] SQL-Migration in Supabase ausgeführt:
  - [x] `20260405040000_thumbnail_url_in_feed.sql` → ✅ Success
  - [x] `20260407_virtual_gifts.sql` → ✅ bereits vorhanden (idempotent)
  - [x] `verify_functions.sql` → ✅ Daten gesund (Max Score 4.24, 24 Gaming-Logs)
- [ ] EAS Production Build iOS v1.6.0 ← **nächster Schritt** (Build#195 bereits submitted)
- [ ] App Store Submission
- [ ] TestFlight Beta für erste Nutzer

---

## 📱 Phase 3 — Post-Launch Mobile (Q3 2026)

- [ ] Android Support (EAS Build)
- [ ] Duett / Stitch Feature (wie TikTok)
- [x] Sound-/Musik-Bibliothek für Videos → ✅ **fertig**
  - [x] `lib/useMusicPicker.ts` — 8 royaltyfreie Tracks + `useAudioPlayer` Hook
  - [x] `components/camera/MusicPickerSheet.tsx` — TikTok-Style Bottom Sheet
  - [x] Genre-Filter, SVG-Waveform-Visualizer, Play/Pause Preview
  - [x] Sound-Pill in Camera wird aktiv wenn Track ausgewählt
  - [x] **Lautstärke-Slider** — PanResponder-basiert, jitterfrei, Creator bestimmt Lautstärke
  - [x] **audio_volume in DB** — `posts` Tabelle + `get_vibe_feed` RPC updated (Migration ausführen!)
  - [x] **Feed respektiert Lautstärke** — `FeedItem` liest `audio_volume` aus DB, setzt `expo-av`-Volume
  - [x] **Mute-Button für Musik-Posts** — erscheint auch bei Bild-Posts mit Track, steuert expo-av live
  - [x] **Musik im Post-Detail** — `post/[id].tsx` lädt + spielt `audio_url`/`audio_volume`, Mute-Button, Musik-Badge
- [x] **Immersiver Create-Screen** → ✅ **fertig** (TikTok-Style)
  - [x] Vollbild-Medienvorschau als Hintergrund
  - [x] Rechte Tool-Sidebar — Sound, Text, Sticker (bald), Filter (bald), Drehen (bald)
  - [x] Top-Bar: Zurück, Musik-Badge (mit X), Einstellungsrad (⚙️)
  - [x] Bottom-Bar: Medien-Thumbnail, Story-Button, Weiter-Button
  - [x] Details-Sheet (Weiter): Caption, Tags, Privacy, Kommentare/Download/Duet-Toggles, Post-Button
  - [x] Musik auf Create-Screen bearbeitbar (Track wechseln, Lautstärke anpassen)
  - [x] **Text-Overlay** — Aa-Button öffnet Editor, Schriftgröße (5 Stufen), 9 Farben, live Preview, draggbar, Doppeltap zum Entfernen
- [x] Analytics Dashboard für Creator → ✅ **fertig**
- [x] TikTok-Style Follow-Button im Feed → ✅ **fertig**
- [x] Verification Badge System → ✅ **fertig**
- [ ] Creator Monetarisierung (Badges, Tipps)
- [ ] Erweiterte Live-Features (Co-Host, Gäste einladen)
- [ ] Offline-Support (gecachte Posts lesbar ohne Internet)
- [ ] A/B-Testing für Feed-Algorithmus
- [ ] Echtes 60fps Live-Face-Tracking (`vision-camera-face-detector` Worklet-Plugin)

---

## 🖥️ Phase 4 — Vibes Web / Desktop (Q4 2026 / Q1 2027)

**Ziel:** Passive Content-Consumption auf Desktop, wie TikTok.com

### Warum jetzt nicht:
- Mobile First: Nutzer gewinnen, dann Desktop wenn Traffic es rechtfertigt
- Fundament ist bereits vorhanden: `react-native-web` ist im Projekt installiert

### Technischer Plan:
- **Framework:** Next.js (separates Repo) oder Expo Web aus bestehendem Code
- **Tool für Skeleton Loading:** [Boneyard](https://github.com/0xGF/boneyard) — auto-generierte Skeletons aus dem echten DOM (open source, 2.4k ⭐)
- **Layout-Anpassungen:** Vertical-Feed → horizontales Grid auf Desktop (wie TikTok.com)

### Feature-Scope Web:
- [ ] Feed ansehen (Watch-Only, kein Upload auf Web)
- [ ] Profil ansehen + Follow
- [ ] Kommentare lesen und schreiben
- [ ] Direktnachrichten (DM)
- [ ] Live-Stream ansehen
- [ ] Share-Links die auf Web öffnen (SEO-freundlich)
- [ ] Creator Dashboard (Analytics, Statistiken)

### NICHT auf Web (immer mobil):
- Video erstellen / hochladen → nur App
- Live gehen → nur App
- Stories erstellen → nur App

---

## 💡 Ideen-Backlog (unpriorisiert)

- Vibes API für Third-Party-Integrationen
- Podcast / Audio-Only Mode
- Virtuelle Gifts & Shop (v2 — Lootboxen, saisonale Items)
- Verifizierungs-Badge System
- Kollaborative Playlists / Sammlungen
- Vibes für Creators (separater Creator-Modus)
- Skia RuntimeEffect Shader-Editor (In-App Filter selbst erstellen)
