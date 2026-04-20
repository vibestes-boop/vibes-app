# Duett/Co-Host/Battle — Vollständige Roadmap

> **Ziel:** TikTok-Feature-Parität für Duett, Multi-Guest, PK Battle, Layouts und Host-Controls
> **Status:** Aktueller Code ist ~15% TikTok-Feature-Parität
> **Stand:** 2026-04-17 (nach Release 1.14.10)

---

## 1. Executive Summary

Das Duett-System existiert in Grundform: 1-vs-1 Co-Host mit 4 Layouts (pip, side-by-side, top-bottom, battle), fester 60s Battle-Timer, Gift-Boosting als Broadcast-Event. Was fehlt sind die Core-UX-Patterns, die TikTok-LIVE unverwechselbar machen: **Runtime-Layout-Switch**, **Host-Controls über Co-Host** (mute, kick, spotlight), **Queue-System**, **Multi-Guest (bis 8 Leute)**, **Victory-Lap**, **Gift-Boosting-Items mit Multipliern**, **Battle-Persistence + Leaderboards**.

Der Plan ist in **6 Phasen** gegliedert. Phase 1–2 sind Quick-Wins (1–2 Wochen), Phase 3 ist das große Multi-Guest-Refactor (3–4 Wochen), Phase 4–6 sind Polish und Monetization (je 1–2 Wochen).

---

## 2. IST vs SOLL — Gap-Tabelle

| Feature | IST (Serlo) | SOLL (TikTok) | Gap |
|---------|-------------|---------------|-----|
| **Anzahl Co-Hosts** | 1 | bis zu 8 | ❌ Kritisch |
| **Layouts** | 4 fix (pip, side, top-bottom, battle) | 5+ (Grid 2x2/3x3, Spotlight, Panel, PiP, Side) | ⚠️ Ausbau |
| **Layout-Switch Runtime** | ❌ nur beim Accept | ✅ jederzeit | ❌ Kritisch |
| **Host → Co-Host Mute** | ❌ | ✅ Audio/Video separat | ❌ Kritisch |
| **Host → Co-Host Kick** | ⚠️ nur "End Duet" | ✅ einzelner Kick | ⚠️ Teil-implementiert |
| **Host → Spotlight/Resize** | ❌ PiP hart 28.5% | ✅ Tap-to-enlarge | ❌ Kritisch |
| **Request-Queue** | ❌ 2. Request verloren | ✅ FIFO + Auto-Promote | ❌ Kritisch |
| **Battle-Dauer** | 60s hardcoded | 3/5/10 min + 3min Victory-Lap | ⚠️ Ausbau |
| **Battle-Winner-Reward** | ❌ | ✅ Badge + Coins optional | ❌ |
| **Battle-Persistence** | ❌ Memory only | ✅ DB + Leaderboard | ❌ |
| **Gift-Multiplier** | 1x | 5x Glove, Magic Mist etc. | ❌ |
| **Like-to-Score** | ❌ | ✅ 3 Punkte pro Like | ❌ |
| **Team-Battle (2v2)** | ❌ | ✅ | ❌ (Phase 3+) |
| **Audio-Only Guest** | ❌ | ✅ | ❌ (Phase 3) |
| **Moderatoren** | ❌ | ✅ | ❌ (Phase 6) |
| **Block Viewer** | ❌ | ✅ | ⚠️ Prüfen |
| **Post-Battle Stats** | ❌ | ✅ Winner-Screen | ❌ |

---

## 3. Phasen-Plan

### **Phase 1 — Runtime Host-Controls** ⚡ (Woche 1)
*Impact: Sehr hoch · Effort: Niedrig · Risiko: Niedrig*

Das sind die 4 Features, die das Duett von "Prototyp" zu "brauchbar" heben.

#### 1.1 — Runtime Layout-Switcher
**User-Story:** Host startet Duet im PiP-Layout, merkt dass Side-by-Side besser wäre → swiped auf Layout-Button → alle Viewer sehen den neuen Layout innerhalb 200ms.

- `lib/useCoHost.ts`: Neue RPC `update_cohost_layout(session_id, layout)` + Broadcast `'layout-changed'`
- `app/live/host.tsx`: Layout-Switcher-Button (FAB unten-rechts) öffnet BottomSheet mit 4 Optionen + Live-Preview
- `app/live/watch/[id].tsx`: Listener auf Broadcast → `setActiveLayout(newLayout)` → React re-rendert Split-View
- **DB-Migration:** Keine nötig — `layout` Spalte existiert schon in `live_sessions`
- **Code:** ~150 Zeilen

#### 1.2 — Host Mute/Unmute Co-Host
**User-Story:** Co-Host spricht zu laut oder hat Hintergrund-Lärm → Host tippt auf PiP-Fenster → Mute-Icon overlay → Co-Host-Audio stumm für alle Viewer.

- **LiveKit-API:** `remoteParticipant.setTrackSubscriptionPermissions()` oder besser: Server-side via Edge Function mit LiveKit-REST-API `MuteRemoteTrack`
- `supabase/functions/livekit-mute/index.ts`: Neue Edge Function (Admin-API-Key secret)
- `app/live/host.tsx`: Tap-Menu auf Co-Host-Fenster: Mute Audio / Mute Video / Kick
- **DB-Migration:** Keine
- **Code:** ~200 Zeilen + neue Edge Function

#### 1.3 — Co-Host Kick mit Grund
**User-Story:** Co-Host verhält sich schlecht → Host lang-drückt auf PiP-Fenster → "Kick mit Reason: Spam / Nacktheit / Belästigung / Sonstiges" → Co-Host wird rausgeworfen + kann 24h nicht zurück.

- `supabase/live_studio.sql`: Neue Tabelle `cohost_blocks (session_id, user_id, blocked_until, reason)`
- `lib/useCoHost.ts`: `kickCoHost(userId, reason, duration)` prüft bestehende Blocks vor Accept
- **UI:** ActionSheet mit 4 Reason-Buttons
- **Code:** ~100 Zeilen + SQL

#### 1.4 — Konfigurierbare Battle-Dauer
**User-Story:** Host wählt bei Battle-Start zwischen 3/5/10 Minuten statt fixer 60s.

- `app/live/host.tsx:700`: Alert.prompt → wird zu BottomSheet mit 3/5/10-Button
- `lib/useBattle.ts`: `durationSecs` schon Parameter → nur UI-Ausbau
- **Code:** ~50 Zeilen

**Deliverable Phase 1:** Version 1.15.0, submit EAS production.

---

### **Phase 2 — Queue + Mehr-Request-Management** (Woche 2)
*Impact: Hoch · Effort: Mittel · Risiko: Niedrig*

#### 2.1 — Pending-Requests-Queue
**User-Story:** 5 Viewer klicken "Duet" in 10s → Host sieht Badge "5 in Warteschlange" + Bottomsheet mit allen wartenden User (Avatar, Name, Stats) → wählt manuell oder Auto-Next.

- `supabase/live_studio.sql`: Neue Tabelle `cohost_queue (session_id, user_id, requested_at, position)`
- `lib/useCoHost.ts`: State wird `pendingRequests: CoHostRequest[]` (Array)
- **Realtime:** Broadcast ersetzt durch DB-Subscription (bessere Persistence)
- `app/live/host.tsx`: Queue-Badge oben rechts + Tap öffnet Liste
- **Code:** ~300 Zeilen + SQL

#### 2.2 — Auto-Promote bei Co-Host-Ende
**User-Story:** Co-Host verlässt Duet → System promoted automatisch next-in-queue + sendet Notification "Du bist dran!"

- `lib/useCoHost.ts`: In `leaveCoHost()` nach DB-Cleanup → `promoteNextInQueue()` RPC
- **Edge Function:** `cohost-auto-promote` mit 2s-Delay (falls Host manual picken will)
- Host kann via Toggle "Auto-Promote: An/Aus" steuern
- **Code:** ~150 Zeilen

#### 2.3 — Viewer sieht eigene Position in Queue
**User-Story:** Viewer requestet Duet, sieht "Position 3 von 5" Badge → kann abbrechen.

- `lib/useCoHost.ts` (Viewer): `useQueuePosition(sessionId, userId)` Hook
- **UI:** Inline-Badge am "Duet anfragen"-Button
- **Code:** ~80 Zeilen

**Deliverable Phase 2:** Version 1.16.0

---

### **Phase 3 — Multi-Guest (Grid-Layouts)** 🔥 (Woche 3–5)
*Impact: Sehr hoch · Effort: Sehr hoch · Risiko: Hoch*

Das ist das **große Refactor**. Aktueller Code nimmt überall `activeCoHostId: string | null` an. Das muss `activeCoHosts: CoHost[]` werden.

#### 3.1 — DB-Schema Multi-Guest
```sql
-- Statt einzelne Felder in live_sessions:
CREATE TABLE live_cohosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  role TEXT NOT NULL CHECK (role IN ('cohost', 'audio_only', 'spotlight')),
  position INT NOT NULL,  -- 0-7 für Grid-Slots
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  muted_audio BOOLEAN DEFAULT FALSE,
  muted_video BOOLEAN DEFAULT FALSE,
  is_spotlight BOOLEAN DEFAULT FALSE,
  UNIQUE(session_id, user_id),
  UNIQUE(session_id, position)
);
CREATE INDEX idx_live_cohosts_session ON live_cohosts(session_id) WHERE joined_at IS NOT NULL;
```

- `live_sessions.layout` erweitern: add `'grid-2x2', 'grid-3x1', 'spotlight', 'panel-horizontal'`
- Migration-Skript: bestehende Sessions (1 Co-Host) → Row in `live_cohosts` mit `position=0`

#### 3.2 — LiveKit Token-Generation anpassen
- `supabase/functions/livekit-token/index.ts`: Support für bis zu 8 publisher
- Metadata im Token: `{ role: 'host' | 'cohost' | 'audio_only', slot: 0-7 }`
- Identity-Format: `user:<uid>` bleibt, aber Metadata nutzen zur Layout-Positionierung

#### 3.3 — UI-Komponenten
- `components/live/GridLayout.tsx`: Render 2x2, 3x1 oder Spotlight basierend auf aktivem Layout
- `components/live/GuestTile.tsx`: Einzelnes Guest-Fenster mit Mute-Indicator, Name, Gift-Counter
- `components/live/HostGuestControls.tsx`: Long-Press auf Tile öffnet Mute/Kick/Spotlight-Menu

#### 3.4 — `useCoHost.ts` Refactor
- State wird `activeCoHosts: CoHost[]` mit Server-sync
- Methoden: `addCoHost(userId, role, slot)`, `removeCoHost(userId)`, `setSpotlight(userId)`, `reorderSlots([uid1, uid2, uid3, uid4])`

#### 3.5 — Layout-Constraints
- 1 Guest → Side-by-Side / Top-Bottom / PiP (wie heute)
- 2–4 Guests → Grid 2x2 oder Panel (1 groß, 3 klein)
- 5–8 Guests → Grid 3x3 (mit leeren Slots)
- Spotlight-Mode: 1 groß (60%) + N klein darunter (40% verteilt)

**Code:** ~1500 Zeilen + SQL-Migration + Edge-Function-Updates.
**Risiko:** Breaking-Change für bestehende Sessions. Feature-Flag empfohlen.

**Deliverable Phase 3:** Version 2.0.0 (Major-Bump wegen Breaking Changes)

---

### **Phase 4 — Battle-Polish + Gift-Boosting** (Woche 6)
*Impact: Hoch · Effort: Mittel · Risiko: Niedrig*

#### 4.1 — Gift-Booster-Items
Neue Gift-Kategorie in `lib/gifts.ts`:
```ts
BOOSTER_GIFTS = [
  { id: 'glove', coins: 500, multiplier: 5, duration: 30, icon: '🧤' },
  { id: 'mist', coins: 800, effect: 'hide_opponent_score', duration: 30, icon: '🌫️' },
  { id: 'hammer', coins: 1200, effect: 'stun_opponent_3s', icon: '🔨' },
  { id: 'time_extend', coins: 1500, effect: 'extend_10s', icon: '⏱️' },
];
```

- `useBattle.ts`: `applyBooster(boosterId, team)` → broadcast `'booster-activated'`
- **Timer-Logik:** Multiplier ist aktiv für 30s nach Activate (pro Team separat)
- **UI:** Booster-Overlay im GiftPicker + Visual-Effect (Regenbogen-Glove für 30s auf Screen)

#### 4.2 — Like-to-Score (3 Points pro Tap)
- Bestehende `useLiveReactions` nutzen
- In Battle-Phase: Jeder Herz-Tap addiert 3 Punkte zum Creator, dessen Video getappt wurde
- **Anti-Spam:** Max 10 Likes/s pro User
- **Code:** ~100 Zeilen

#### 4.3 — Victory-Lap (3 Minuten Post-Battle)
**User-Story:** Battle endet → Gewinner-Banner 3s → Victory-Lap-Screen 3 Min mit Konfetti, Winner groß, Loser klein, "Noch 3 Min Celebration" Countdown.

- `useBattle.ts`: `phase: 'active' | 'victory_lap' | 'ended'` statt nur `active: boolean`
- `BattleBar.tsx`: Victory-Lap-Mode mit anderer Farbe + Countdown
- Automatisches Duet-Ende nach Victory-Lap abgelaufen
- **Code:** ~200 Zeilen

#### 4.4 — Battle-Winner-Badge
- `profiles`-Tabelle: `battle_wins INT DEFAULT 0`, `battle_losses INT DEFAULT 0`
- Trigger: Bei Battle-Ende (durch RPC) inkrementieren
- Badge neben Username: "🏆 42 Siege"
- **Code:** ~80 Zeilen + SQL

**Deliverable Phase 4:** Version 2.1.0

---

### **Phase 5 — Persistence + Leaderboards** (Woche 7)
*Impact: Mittel · Effort: Mittel · Risiko: Niedrig*

#### 5.1 — Battle-History-Tabelle
```sql
CREATE TABLE battle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id),
  host_id UUID REFERENCES profiles(id),
  guest_id UUID REFERENCES profiles(id),
  host_score INT NOT NULL,
  guest_score INT NOT NULL,
  winner_id UUID REFERENCES profiles(id),
  duration_seconds INT NOT NULL,
  gifts_total_coins BIGINT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_battle_history_host ON battle_history(host_id, ended_at DESC);
CREATE INDEX idx_battle_history_guest ON battle_history(guest_id, ended_at DESC);
```

- `useBattle.ts`: Am Ende `INSERT INTO battle_history`
- Profile-Screen: Tab "Battles" mit Liste letzter 20 Battles

#### 5.2 — Weekly Leaderboard
- Edge-Function `leaderboard-weekly`: Aggregiert Wins der letzten 7 Tage
- Neuer Screen `/live/leaderboard` mit Top 100
- Push-Notification Montags "Du bist auf Platz 12 diese Woche"

#### 5.3 — Post-Battle-Screen
- Nach Victory-Lap: Vollbild-Screen mit
  - Final-Scores groß
  - Top-3 Gifter pro Team
  - "Rematch"-Button (öffnet neue Duet-Anfrage zum Gegner)
  - Share-Button (screenshot-artig)

**Deliverable Phase 5:** Version 2.2.0

---

### **Phase 6 — Moderation + Streaming-Qualität** (Woche 8)
*Impact: Mittel · Effort: Mittel · Risiko: Niedrig*

#### 6.1 — Moderatoren-System
- Host kann bis zu 3 Moderatoren ernennen (`live_moderators` Tabelle)
- Moderator-Rechte: Chat löschen, Viewer muten, Queue managen
- **Code:** ~400 Zeilen

#### 6.2 — Block-Viewer Global
- Viewer blockieren → kann 24h keine Duet-Requests, keine Chat-Nachrichten, keine Gifts
- `user_blocks (blocker_id, blocked_id, expires_at)` schon in Schema?

#### 6.3 — Streaming-Qualität-Metriken
- `useNetworkStats()`: FPS, Bitrate, PacketLoss pro Participant
- Host-Overlay: 🟢 Gut / 🟡 Mittel / 🔴 Schlecht pro Co-Host
- Warnung bei Packet-Loss > 5% seit 10s

#### 6.4 — Beautification-Filter
- LiveKit Frame-Processor für Beauty-Filter (Skin-Smooth, Eye-Brighten)
- `react-native-vision-camera` Frame-Processor-Plugin
- **Code:** Komplex (~800 Zeilen + native)
- **Risiko:** Hardware-intensiv, nur iPhone 12+

**Deliverable Phase 6:** Version 2.3.0

---

## 4. DB-Schema-Änderungen (Summary)

Neue Tabellen zu migrieren:
```
live_cohosts         (Phase 3)
cohost_queue         (Phase 2)
cohost_blocks        (Phase 1.3)
battle_history       (Phase 5)
live_moderators      (Phase 6)
```

Erweiterte Spalten:
```
live_sessions.layout: neue Werte 'grid-2x2', 'grid-3x1', 'spotlight', 'panel-horizontal'
profiles.battle_wins INT, battle_losses INT (Phase 4)
```

---

## 5. Technische Risiken & Gegenmaßnahmen

| Risiko | Phase | Mitigation |
|--------|-------|-----------|
| LiveKit Token-Limit (8+ Publisher) | 3 | Upgrade LiveKit-Cloud-Plan prüfen |
| Supabase Realtime-Load (8× Video-Participant-Updates) | 3 | Throttle DB-Updates auf 2Hz |
| iOS Audio-Session-Chaos mit Multi-Guest | 3 | Alle `setAppleAudioConfiguration` in zentralen Hook |
| Breaking-Change bestehender Sessions | 3 | Feature-Flag `multi_guest_enabled`, gradualer Rollout |
| Coin-Doppel-Abbuchung bei Gift-Boostern | 4 | Idempotency-Keys in Edge Function |
| Battle-History Size | 5 | Partitionierung nach Monat ab 1M Rows |
| Beauty-Filter Performance | 6 | Opt-in + Quality-Tier basierend auf Device |

---

## 6. Testing-Strategie

Jede Phase braucht:
- **Unit-Tests** für Hook-Logik (`useCoHost`, `useBattle`)
- **Integration-Tests** für Supabase-RPCs
- **Manual E2E** auf 2 echten iPhones:
  - Host + Co-Host-Flow komplett
  - Layout-Switch während Duet
  - Mute/Kick-Szenarien
  - Battle mit Gifts von 3 Accounts
- **Staging-Env** mit feature-flag `duet_v2_enabled`

---

## 7. Empfohlene Reihenfolge & Zeitplan

| Woche | Phase | Release |
|-------|-------|---------|
| 1 | Phase 1 (Host-Controls) | 1.15.0 |
| 2 | Phase 2 (Queue) | 1.16.0 |
| 3-5 | Phase 3 (Multi-Guest) | 2.0.0 |
| 6 | Phase 4 (Battle-Polish) | 2.1.0 |
| 7 | Phase 5 (Persistence) | 2.2.0 |
| 8 | Phase 6 (Moderation) | 2.3.0 |

**Alternative Quick-Win-Variante:** Wenn Multi-Guest (Phase 3) zu riskant ist, können Phasen 1, 2, 4, 5 auch OHNE Multi-Guest laufen. Dann bleibt es 1-vs-1, aber mit allen anderen Verbesserungen. Phase 3 ist isoliert nachholbar.

---

## 8. Nächste konkrete Schritte

1. ✅ Review dieser Roadmap mit dir
2. ⏭️ **Entscheidung**: Phase 1 komplett durchziehen, oder Cherry-Pick?
3. ⏭️ **Phase 1.1 starten**: Runtime Layout-Switcher (geringste Blast-Radius, höchster Impact)
4. ⏭️ Feature-Branch `feat/duet-v2-phase1` erstellen
5. ⏭️ Setup: SQL-Migration-Template in `supabase/` (für Phase 1.3)

---

**Schätzung Gesamtaufwand:** 8 Wochen solo, oder 4 Wochen mit 2 Devs.
**Break-Even:** Phase 1+2 (2 Wochen) bringen 70% der TikTok-UX-Qualität für Duet. Phase 3 bringt die restlichen 30% aber ist der größte Brocken.
