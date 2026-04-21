# CLAUDE.md — Serlo / Vibes App
> Dieses Dokument wird von AI-Assistenten (Cursor, Claude Code, Antigravity) automatisch gelesen.
> Es enthält alles was du über dieses Projekt wissen musst, bevor du Code schreibst.

---

## 📱 Was ist das?

**Serlo** (Entwicklungsname: Vibes) ist eine TikTok-inspirierte Social-Media App für iOS/Android.
- Video-Feed, Stories, Live-Streaming, Messaging, Guilds (Communities), Geschenke, Coin-Shop
- Zielgruppe: Tschetschenische Community / Junge Erwachsene
- Aktueller Status: **Produktion (App Store)**

---

## 🔧 Tech Stack

| Layer | Technologie |
|---|---|
| Framework | **Expo SDK 54** (Bare Workflow tendenziell) |
| Sprache | **TypeScript** (strict) |
| Navigation | **Expo Router v3** (File-based, Tabs + Stack) |
| State | **Zustand** (auth, theme, nav stores) |
| Server-State | **TanStack Query v5** (useQuery, useMutation) |
| Backend | **Supabase** (Postgres, Auth, Realtime, Storage, Edge Functions) |
| Live-Streaming | **LiveKit** (@livekit/react-native 2.9.6) |
| Animationen | **Reanimated 3** + **Skia** (@shopify/react-native-skia) |
| Styling | **React Native StyleSheet** (kein Tailwind) — Dark/Light via `useTheme()` |
| Push | **Expo Notifications** |
| In-App Kauf | **RevenueCat** (Borz Coins) |
| Monitoring | **Sentry** |
| Deploy | **EAS Build + Submit** |

---

## 📁 Projekt-Struktur

```
vibes-app/
├── app/                    # Expo Router Screens
│   ├── (auth)/             # Login, Register, Onboarding
│   ├── (tabs)/             # Haupt-Navigation (Feed, Explore, Add, Guilds, Profile)
│   ├── live/               # Live-Streaming Screens
│   │   ├── host.tsx        # Host UI (Kamera, Controls, Chat, Gifts) ← KRITISCH
│   │   ├── start.tsx       # Live-Setup vor dem Stream
│   │   └── watch/[id].tsx  # Viewer UI ← KRITISCH
│   ├── create/             # Video-Editor
│   ├── messages/           # DM System
│   ├── settings.tsx        # Einstellungen (Profil, Privatsphäre, Theme)
│   └── coin-shop.tsx       # RevenueCat In-App Kaufs
│
├── lib/                    # Hooks & Utilities
│   ├── useLiveSession.ts   # ⭐ ZENTRAL: Alle Live-Stream Hooks & Typen
│   ├── liveModerationWords.ts  # Chat-Moderation Wortliste (DE/EN/RU/CE)
│   ├── useGifts.ts         # Geschenk-System (Supabase + Lottie)
│   ├── gifts.ts            # Geschenk-Katalog (Definitionen + Preise)
│   ├── authStore.ts        # Zustand Store: User-Session
│   ├── themeStore.ts       # Zustand Store: Dark/Light Mode
│   ├── supabase.ts         # Supabase Client
│   └── useComments.ts      # Post-Kommentare (nicht Live-Chat)
│
├── components/
│   ├── live/               # Live-spezifische Komponenten
│   │   ├── GiftPicker.tsx  # Geschenk-Auswahl UI
│   │   ├── GiftAnimation.tsx  # Lottie-Overlays
│   │   └── LiveUserSheet.tsx  # User-Info im Live
│   └── ui/                 # Globale UI-Komponenten
│
├── supabase/               # DB Migrations (SQL Dateien)
│   ├── live_studio.sql     # Live-Sessions Schema
│   ├── live_moderation.sql # Chat-Moderation Spalten ← NEU
│   └── *.sql               # Weitere Migrations
│
└── supabase/functions/     # Edge Functions
    └── livekit-token/      # LiveKit JWT Token Generation
```

---

## 🗄️ Wichtige Datenbank-Tabellen

| Tabelle | Zweck |
|---|---|
| `profiles` | User-Profile (username, avatar_url, coins_balance) |
| `live_sessions` | Aktive/beendete Live-Streams (host_id, room_name, viewer_count, moderation_enabled, moderation_words) |
| `live_comments` | Persistente Chat-Nachrichten (Broadcast via Supabase Realtime) |
| `live_gifts` | Gesendete Geschenke (sender_id, receiver_id, gift_id, coin_cost) |
| `posts` | Video-Posts (video_url, thumbnail_url, caption) |
| `stories` | Ephemere Stories (24h) |
| `guilds` | Communities/Gruppen |
| `messages` | DM-Nachrichten |
| `coin_transactions` | Coin-Bewegungen (RevenueCat Webhooks) |

---

## 🔑 Schlüssel-Konzepte

### Theming
```typescript
// IMMER useTheme() nutzen — niemals hardcodierte Farben!
const { colors } = useTheme();
// colors.background, colors.text, colors.primary, colors.card, etc.
```

### LiveKit Architektur
- **Host** startet Session → `useLiveHost()` → `startSession()` → JWT via Edge Function
- **Viewer** tritt bei → `useLiveViewer(sessionId)` → joins LiveKit Room (nur Empfangen)
- **Chat** läuft via Supabase Broadcast Channel (nicht via LiveKit Data Messages)
- **Moderation**: `moderationEnabled` + `moderationWords` in `live_sessions`, Shadow-Ban in `sendComment()`

### iOS-spezifisch
- Kamera-Aktivierung auf iOS braucht oft ein kurzes Delay (Hardware-Constraint)
- `Alert.prompt()` funktioniert nur auf iOS (für Text-Eingaben)
- Reanimated: CJS require() statt ES imports (verhindert Hermes HBC Crash)

### Supabase Realtime
- Live-Kommentare: `supabase.channel('live-comments-{id}').on('broadcast', ...)`
- Reactions: eigener Broadcast-Channel
- DB-Changes: nur für Viewer-Count + session status

---

## ⚠️ Wichtige Regeln & Gotchas

1. **Kein `tailwind`** — StyleSheet only
2. **Kein `console.log`** in Produktion — nur `__DEV__ && console.log()`
3. **TanStack Query** für alle Supabase-Daten (kein direktes `useEffect` + `useState` für API-Calls)
4. **Import Order**: React → React Native → Expo → Third-party → @/ local
5. **`Alert.prompt`** nur iOS — Android braucht custom Modal wenn nötig
6. **Reanimated-Imports** via `require()` in .tsx Dateien (Hermes-Kompatibilität)
7. **Supabase Migrations**: SQL-Dateien in `/supabase/*.sql` — immer `IF NOT EXISTS` nutzen
8. **LiveKit Token**: `supabase/functions/livekit-token/index.ts` — Guests brauchen `canPublish: true`

---

## 🚀 Aktuell in Entwicklung (Stand April 2026)

### v1.27.4 — CoHost-Poll-Parity
- [x] **Problem**: Nach v1.27.2 (Chat-Moderation) und v1.27.3 (serverseitiges Mute) blieb ein weiterer UX-Gap: Nur der Host konnte Live-Umfragen starten/schließen. Ein aktiver CoHost — gleichberechtigt auf der Bühne, mit Mod-Rechten — konnte nicht auf ein spontanes „Poll jetzt!"-Moment reagieren. TikTok/Twitch: beide Streamer steuern Audience-Engagement-Tools.
- [x] **Design-Entscheidung**: Same single-source-of-truth-Pattern wie v1.27.2 — `is_live_session_moderator` bleibt die Authority-Grenze, und weil dieser Helper seit v1.27.2 aktive CoHosts einschließt, reicht eine reine RLS-Policy-Erweiterung auf `live_polls`. Kein neuer Helper, kein neuer RPC-Wrapper, keine zusätzliche Tabelle.
- [x] **Server-Implementierung** (`supabase/migrations/20260419260000_cohost_poll_parity.sql`): Drei RLS-Policies umgeschrieben — INSERT, UPDATE, DELETE. INSERT behält den Author-Invariant (`auth.uid() = host_id`) und fügt OR-Gate (Session-Host ODER Moderator-Helper). UPDATE/DELETE bekommen drei-Wege-OR: Author ODER Session-Host ODER Moderator — wichtig für den „one-active-poll"-Invariant wenn Host eine laufende CoHost-Poll automatisch schließt um eine neue zu starten (und vice versa).
- [x] **Semantik `host_id`**: Spalte heißt historisch `host_id`, dient aber ab v1.27.4 als Author-ID (wer-hat-die-Poll-erstellt). Kein Rename — hätte Hooks (`.eq('host_id', userId)`), Realtime-Filter und Query-Keys gebrochen. Pragmatisch umdeutbar dokumentiert.
- [x] **Frontend-Loosen** (`lib/useLivePolls.ts`): Der `useCreateLivePoll`-Flow schloss vorher pre-insert nur Polls mit `host_id = userId`. Gestrichen — Pre-Close läuft jetzt session-wide `closed_at IS NULL`, RLS-UPDATE-Policy filtert korrekt (Author / Session-Host / Moderator durch, Rest geblockt). Garantiert den „ein-aktiv"-Invariant auch im Dual-Authoring-Fall.
- [x] **Frontend-UI** (`app/live/watch/[id].tsx`): Neuer `BarChart3`-Pressable in der Right-Action-Column direkt vor dem Clip-Marker, gated auf `isActiveCoHostMe`. Icon-Farbe wechselt auf Lila (`#a78bfa`) wenn `activePoll` läuft — visueller Hinweis dass eine Poll aktiv ist (der CoHost sieht sofort, dass ein neuer Start die bestehende ersetzt). `<LivePollStartSheet>` konditional am unteren JSX-Ende gemountet, gleiche Props wie in `host.tsx`. Keine neue UI-Komponente, keine Style-Änderungen.
- [x] **Edge-Case Ex-CoHost**: Wenn ein CoHost gerade während des Poll-Erstellens revoked wird (`revoked_at` gesetzt), schlägt der INSERT an der RLS-Grenze fehl — Helper gibt `FALSE` zurück, Policy abgelehnt. Kein Render-Leck: das UI wird beim nächsten `useLiveCoHosts`-Realtime-Event neu evaluiert und der Button verschwindet. Race-Fenster ist Sub-Sekunde.
- [x] **Kein RPC-Wrapper nötig**: Poll-Erstellung läuft direkt via `supabase.from('live_polls').insert()`. RLS bleibt die einzige Security-Schicht, das reicht weil Validierungs-Constraints (`question 3-140 chars`, `options 2-4 array`) auf Spalten-Ebene als CHECK-Constraints leben und nicht umgangen werden können.

### v1.27.3 — Server-enforced Mute für aktive CoHosts
- [x] **Problem**: `muteCoHost` in `lib/useCoHost.ts` war **broadcast-only** (Phase 1.2). Der Host schickte `co-host-muted { audio: true }` per Supabase Realtime und *vertraute* darauf, dass der CoHost-Client `setMicrophoneEnabled(false)` aufruft. Ein manipulierter Client (modifiziertes Bundle, JS-Injection in die WebView) konnte das Event ignorieren und weiter audio/video publishen — Host sah „Mikro aus" in seiner UI, der Stream hörte aber den CoHost weiter. Letzte offene Authority-Lücke nach v1.27.2 (Chat-Moderation).
- [x] **Lösung**: Neue Edge Function `supabase/functions/livekit-moderate/index.ts` ruft **direkt die LiveKit Server-API** `RoomService/MutePublishedTrack`. Der Track wird serverseitig gemuted, unabhängig davon was der Client tut. Broadcast bleibt parallel als UI-Sync (Mute-Button-State auf dem CoHost-Gerät), aber die Durchsetzungs-Autorität liegt beim LiveKit-Server.
- [x] **Edge Function Flow**: (1) Supabase-JWT → `callerUserId`. (2) `live_sessions` lookup → assertion `host_id === callerUserId` (nur Host mutet, keine Mods/CoHosts — CoHost-Mikro steuert ausschließlich der Haupthost, TikTok-Parität). (3) `live_cohosts` lookup mit `revoked_at IS NULL` → Target muss aktiver CoHost sein (schützt vor „Host mutet zufällige Viewer"-Missbrauch). (4) Admin-JWT mit `roomAdmin:true` + `room:roomName` scoped. (5) `ListParticipants` → Track-SIDs für `type === 'AUDIO'` und `type === 'VIDEO'` finden. (6) `MutePublishedTrack` parallel für beide angefragten Tracks via `Promise.all`.
- [x] **Edge-Case Participant-Offline**: Wenn der CoHost zwar in DB aktiv, aber gerade nicht im LiveKit-Room ist (gerade disconnected, reconnect pending), liefert die Function `tracksFound: { audio: false, video: false }` + Warning statt hartem Fehler. Der Broadcast-Fallback im Frontend reicht dann — beim nächsten Publish greift die neue Mute-Intention zwar nicht, aber das ist ein realistic okay-Fallback (CoHost der nicht im Room ist, publisht eh nicht).
- [x] **Frontend Parallel-Flow** (`lib/useCoHost.ts`): `muteCoHost` ruft jetzt `Promise.all([sendWithRetry(broadcast), supabase.functions.invoke('livekit-moderate')])`. Beide Fehlermodi sauber getrennt: (a) nur Broadcast down → Server mutet trotzdem; (b) nur Server down → Trust-Fallback via Broadcast; (c) beide down → `ok=false` returned, Host-UI kann Retry anbieten. `sessionIdRef` eingeführt für stabile `useCallback`-Identität (verhindert unnötige Re-Renders der Mute-Buttons durch React.memo-Brüche).
- [x] **Neue Env-Variable nicht nötig**: Function nutzt die drei bereits für `livekit-token`/`livekit-egress` gesetzten Envs (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) + Supabase-Standard (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Deploy-Kommando: `supabase functions deploy livekit-moderate`. Keine DB-Migration.
- [x] **Admin-JWT bewusst kurz**: `exp: now + 60` (1 Minute). Function lebt nur Millisekunden — lange Expiry wäre unnötiges Risiko falls der Token irgendwo geloggt würde (LiveKit-Request-Logs, Sentry-Breadcrumb). Roomscoped via `video.room: roomName` — selbst wenn geleakt, wäre der Token auf genau diesen einen Live-Stream begrenzt.
- [x] **Was kommt NICHT in v1.27.3**: Kick via Server-API (RoomService/RemoveParticipant) — der existierende `kickCoHost`-Flow nutzt `revoke_cohost`-RPC, die die DB-Row revoked und damit beim nächsten LiveKit-Token-Fetch greift. Aktiver Track bleibt zwar bestehen bis Disconnect, aber das ist pragmatisch okay weil der Host danach `endCoHost()`/`kickCoHost()` ruft, was über Participant-Disconnect-Event aufräumt. Lösung 2 (Server-side RemoveParticipant) wäre als v1.27.4 machbar wenn Trust-Lücke konkret missbraucht würde.

### v1.27.2 — CoHost = Moderator-Authority (Chat-Moderation-Parity)
- [x] **Problem**: Ein aktiver CoHost (Viewer, der vom Host als Duet-Partner akzeptiert wurde und jetzt publisht) hatte bisher **null** Chat-Mod-Rechte. Ein Troll in den Kommentaren konnte nur vom Host moderiert werden, während der CoHost — der auf dem Screen gleich groß wie der Host war — tatenlos zuschauen musste. Asymmetrische Autorität trotz gleichberechtigter Präsenz. TikTok/Twitch-Erwartung: Co-Streamer hat Mod-Rechte automatisch.
- [x] **Design-Entscheidung**: Aktiver CoHost erhält AUTOMATISCH dieselben Chat-Moderation-Rechte wie ein expliziter Session-Moderator — by-default, ohne Toggle. Wer co-hostet, wird implizit vertraut. Bei Leave/Revoke fällt das automatisch wieder weg, weil der Check live gegen `live_cohosts.revoked_at IS NULL` läuft, nicht gegen einen separaten Rechte-Snapshot.
- [x] **Server-Implementierung** (`supabase/migrations/20260419250000_cohost_moderator_parity.sql`): SQL-Helper `is_live_session_moderator(session_id, user_id)` via `CREATE OR REPLACE` erweitert — gibt jetzt `TRUE` zurück wenn User entweder in `live_moderators` ODER in `live_cohosts` mit `revoked_at IS NULL` steht. Nutzt den bestehenden Partial-Index `idx_live_cohosts_session WHERE revoked_at IS NULL`, also kein Seq-Scan. Permissions explizit neu gesetzt (`REVOKE FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated`) — CREATE OR REPLACE behält Grants nicht garantiert über alle Postgres-Versionen.
- [x] **Zero-Touch-Ausbreitung auf 5 RPCs**: Durch die Helper-Erweiterung bekommen **automatisch ohne weitere Änderung**: `timeout_chat_user`, `untimeout_chat_user`, `set_live_slow_mode`, `pin_live_comment`, `unpin_live_comment` CoHost-Support. Single-Source-of-Truth-Fix.
- [x] **Safety-Guards greifen automatisch**: Die existierenden Guards in `timeout_chat_user` — „Mods dürfen den Host nicht timeouten" und „Mods dürfen andere Mods nicht timeouten" — übertragen sich 1:1. CoHost kann Host NICHT timeouten (Host-ID ist separat geguardet), CoHost kann Mods NICHT timeouten, CoHost kann andere CoHosts NICHT timeouten (beide werden vom Helper als „Mod" erkannt). Symmetrisches Mod/Mod-Schutzverhalten.
- [x] **Frontend** (`app/live/watch/[id].tsx`): `useLiveCoHosts(sessionId)` wurde im Hook-Aufruf-Block nach oben gezogen (war vorher nur für die Gift-Verkabelung nötig, wird jetzt zusätzlich für den Moderator-Gate gebraucht). Neuer Ableitungs-State `isActiveCoHostMe` + OR in der `isSessionModerator`-Bedingung. Dadurch aktivieren sich die existierenden Mod-UI-Knöpfe (Timeout-Menü im User-Sheet, Slow-Mode-Toggle, Pin-Button in Kommentaren) automatisch auch für CoHosts — kein neuer UI-Code, nur Gate-Extension. `earlyActiveCoHosts` wird am unteren Originalpunkt zu `activeCoHosts` gealiased für Battle-Mode-Kompatibilität.
- [x] **Semantische Anmerkung**: Funktion heißt weiterhin `is_live_session_moderator`, nicht `can_moderate_live_session`. Kein Rename, damit bestehende Aufrufer nicht brechen — Name ist pragmatisch umdeutbar (CoHost hat im Moderations-Kontext Moderator-Autorität).

### v1.27.1 — CoHost Gift-Parity (Duet-Recipient-Picker)
- [x] **UX-Loch geschlossen**: In einem regulären Duet (top-bottom / side-by-side / pip, aber NICHT battle) sah der Viewer zwei gleichberechtigte Gesichter auf dem Bildschirm, aber alle Geschenke gingen stumm an den Host — weil `recipientId={session?.host_id}` in `app/live/watch/[id].tsx:2328` hart verdrahtet war. Der CoHost hat damit im Non-Battle-Duet keine Gift-Einnahmen, obwohl er genauso publisht wie der Host. TikTok-Referenz zeigt dort einen Recipient-Switch im Gift-Picker.
- [x] **`GiftPicker` neues Prop `duetMode`** (`components/live/GiftPicker.tsx`): analog zu `battleMode`, aber ohne `onBattleGift`-Callback und ohne Team-Score-Split. Wenn gesetzt, wird derselbe interne Recipient-Choice-State (vorher `battleTeam`, jetzt generalisiert zu `recipientChoice`) genutzt, um zwischen `duetMode.hostId` und `duetMode.coHostId` zu wählen. `battleMode` und `duetMode` sind by-convention mutually exclusive (battle gewinnt wenn beide gesetzt — gebaut aber nicht testbar kollidierend).
- [x] **Optik**: Battle zeigt weiterhin 🔴/🔵 mit roten/blauen Team-Pills (`s.teamPill`). Duet bekommt eine dezente Segmented-Control-Pille (`s.duetPill`) — gleicher Grau-Ton, Border nur auf der aktiven Seite, kleine "Host" / "Guest" Sub-Labels. Kein Score-Bar, keine aggressiven Farben. Header-Titel bleibt "Geschenke" (nur Battle nutzt "⚔️ Battle-Geschenk").
- [x] **Battle-Score-Guard verschärft**: `if (battleMode)` statt `if (dualMode)` beim `onBattleGift`-Call — kritisch damit ein Duet-Gift nicht fälschlich Battle-Score inkrementiert wenn irgendwann versehentlich beide Modes gesetzt sind.
- [x] **Edge-Case CoHost-Leave**: useEffect in `GiftPicker` resettet `recipientChoice` auf `'host'` wenn `dualMode` null wird — verhindert dass ein Viewer der "Guest" ausgewählt hatte und danach den CoHost verlässt, sein Gift an eine tote userId schickt.
- [x] **Verkabelung in `watch/[id].tsx`**: `duetMode={!isBattle && activeCoHosts[0] && session?.host_id ? { … } : undefined}`. Nutzt bereits vorhandenes `useLiveCoHosts`-Hook-Result, keine neuen Abfragen.

### v1.27.0 — Audit Phase 2 Security-Härtungen (5 Fixes)
- [x] **#1 Zombie-Session-Cleanup tatsächlich funktionsfähig** (`supabase/migrations/20260419230000_live_sessions_updated_at.sql`): Die Cleanup-Cron-Migration vom 2026-04-15 + der Host-Heartbeat in `host.tsx:464` schrieben beide nach `live_sessions.updated_at` — **die Spalte existierte aber gar nicht** im Schema (`supabase/live_studio.sql` hat nur `started_at`/`ended_at`). Heartbeats schlugen silent fehl, Cron filterte ins Leere → Zombie-Sessions blieben unbegrenzt `active`. Fix: Spalte hinzugefügt (nullable → Backfill via `COALESCE(ended_at, started_at)` → NOT NULL + DEFAULT NOW()) + BEFORE-UPDATE-Trigger der `updated_at` automatisch pflegt + Partial-Index für Cleanup-Filter + Bonus-RPC `heartbeat_live_session(sid, count, peak)` mit Host-Identity-Check (frontend-Migration optional).
- [x] **#2 Moderation Regex-Härtung** (`lib/liveModerationWords.ts`): Substring-Match `lower.includes(word)` hatte False-Positives wenn ein gefährlicher Token in einem harmlosen Wort versteckt lag — klassische Fälle: "schwichse" triggerte "wichse", "ankanake" triggerte "kanake", "spisshit" triggerte "shit". Außerdem trivialer Zalgo-Bypass via Combining-Marks (f̴u̴c̴k̴). Fix: Word-**Start**-Boundary via Unicode-aware Negative-Lookbehind `(?<!\p{L})word` mit `iu`-Flags (Umlaute/Kyrillisch supported) + NFKD-Normalize + Combining-Mark-Strip (`\u0300-\u036f`) + Full-Width-Unicode-Fold (ＦＵＣＫ → fuck). Globale Liste wird **einmal beim Modul-Load** zu RegExps vorkompiliert, Host-Words via FIFO-Cache (Cap 256) — keine Array-Spreads mehr pro Comment-Call. **Bewusste Asymmetrie**: Kein Word-End-Boundary → Konjugationen werden mitgematcht (gewollt: "scheiß" fängt "scheiße" ab; Nebeneffekt: "spasti" fängt auch "spasticity" ab — akzeptabel, weil der Filter im Zweifel aggressiver statt permissiver sein soll und Moderator-Review den Rest abfängt).
- [x] **#3 join_live_session Dedup** (`supabase/migrations/20260419240000_join_live_session_dedup.sql`): Alte RPC war `SECURITY INVOKER` ohne Dedup-Check → Bot konnte mit bekannter session_id 10.000× aufrufen und `viewer_count` fake-inflaten (fließt in algorithm_v4 Scoring). Fix: Neue Tabelle `live_session_viewers(session_id, user_id)` mit PK-Constraint → `INSERT ON CONFLICT DO NOTHING` + bedingte Counter-Inkrement (nur wenn tatsächlich neu). Beide RPCs jetzt `SECURITY DEFINER` + Auth-Guard + explizit `REVOKE FROM anon`. Session-End-Trigger purged Viewer-Einträge automatisch. Bonus: `live_session_viewer_counts` View für Host-Dashboards.
- [x] **#4 Gift-Broadcast Channel-Leak + Combo-Map-Cap** (`lib/useGifts.ts`): (a) Unsubscribe-Reihenfolge war `channelRef.current = null` **vor** `removeChannel(channel)` → bei schnellem Remount (StrictMode / prop-change) konnte der alte Listener noch aktiv sein während parallel ein neuer Channel `live:${liveSessionId}` subscribed wurde → Doppel-Broadcast am Receiver. Gedreht: `removeChannel` zuerst, `channelRef = null` danach. (b) Sender-seitige `comboRef` (Cap 256) + Receiver-seitige `comboKeyToId` (Cap 512) bekommen FIFO-Eviction — belt-and-suspenders gegen Long-Running-Stream-Edge-Cases (regulär Bounded via Timer-Expiry, aber pathologische Pill-Churn-Sequenzen könnten sonst Einträge anhäufen).
- [x] **#5 RevenueCat Härtung** (`supabase/functions/revenuecat-webhook/index.ts`): Drei Verteidigungsebenen zusätzlich zum bestehenden Bearer-Auth + transaction_id-Idempotenz. (a) **Replay-Schutz** via `event.event_timestamp_ms` → Events > 10 Min alt oder > 1 Min in der Zukunft werden mit 400 abgewiesen. (b) **Rate-Limit** per User via existierender `coin_purchases` Tabelle: max 20 Gutschriften/Stunde → 429 bei Überschreitung (defense-in-depth falls Webhook-Secret leakt). (c) **Receipt-Verify-Scaffold** mit `ENABLE_RECEIPT_VERIFY=true` Env-Flag — Apple (App Store Server API) + Google (Play Developer API) Stubs mit klarem TODO und benötigten Secrets dokumentiert; ready für Phase-3-Aktivierung ohne Webhook-Redeploy.

### v1.26.9 — Messages Avatare größer
- [x] **Konversations-Liste** (`app/(tabs)/messages.tsx`): Avatare von 52×52 → 60×60 px (WhatsApp/iMessage-Niveau). `avatarWrap` + `avatar` Dimensionen aktualisiert, `borderRadius` 26→30, `avatarWithRing` (innerer Avatar bei aktivem Story-Ring) 44→52 mit `borderRadius` 22→26. `storyRing` `borderRadius` 28→32 an neue Wrap-Größe angepasst. `avatarInitial` Fallback-Text 20→22 proportional.
- [x] **User-Such-Modal** (gleiche Datei): Avatare in der Suchergebnis-Liste 44×44 → 52×52 mit `borderRadius` 22→26. `avatarInitial` 17→19.
- [x] **Position bleibt**: Top/Left-Offset beim `avatarWithRing` (4/4) stimmt weiterhin — da Größen-Diff zwischen Wrap (60) und Inner-Avatar (52) jetzt 8px = 4px pro Seite.

### v1.26.8 — Carousel „Springen" Fix bei Thumbnail-Klick
- [x] **Root-Cause**: `ImageCarousel`-ScrollView in `app/shop/[id].tsx` nutzte `onScroll` + `scrollEventThrottle={16}` → setzte `activeImgIdx` alle 16ms während der Animation. Beim Klick auf ein entferntes Thumbnail (z.B. von Bild 1 auf Bild 4) scrollte der Carousel durch die Zwischenbilder 2 und 3, und der `ThumbnailStrip` re-renderte mit wechselnden Active-Borders/Dim-Overlays → sichtbares „Hin-und-her-Springen".
- [x] **Fix**: `onScroll` → `onMomentumScrollEnd` — Index wird nur noch am Ende der Scroll-Animation gesetzt. Ein sauberer Einzel-Update am Ziel-Bild, kein Durchlaufen von Zwischenzuständen. Gilt sowohl für programmatisches `scrollTo({animated: true})` (Thumbnail-Klick) als auch für manuelles Swipen.
- [x] **Keine Regression**: `onSelect` im ThumbnailStrip setzt `activeImgIdx` bereits sofort vor dem `scrollTo` → Thumbnail-Active-State reagiert instant, die Hero-Bild-Animation läuft parallel sauber durch.

### v1.26.7 — Shop Typography Entfetten
- [x] **Bold-Overkill reduziert** in `app/shop/index.tsx` und `app/shop/[id].tsx`: Alle `fontWeight: '900'` → `'700'` (Header, Preise, Sale-Badges, buyCtaText, confirmBalance) und alle `fontWeight: '800'` → `'600'` (Titel, Section-Labels, Buy-Button-Text, Qty-Num, Chip-Counts, Modal-Headlines). Ternary-Case `isActive ? '800' : '500'` (Sheet-Row active-state in `shop/index.tsx`) manuell auf `'700' : '500'` gesetzt.
- [x] **Gewichts-Hierarchie** bleibt erhalten: `700` für wichtige Akzente (Preise, CTA-Text, Sale-Badges, Headers), `600` für Standard-UI-Labels (Titel, Buttons, Chip-Text), `500` für dezente Labels. Look ist insgesamt leichter/moderner — weg vom „Heavy"-Stil, näher am TikTok/Apple-Typografie-Feeling.
- [x] **Keine Font-Family-Änderung nötig**: System-Font (San Francisco auf iOS, Roboto auf Android) rendert die reduzierten Gewichte nativ ohne zusätzliche Assets.

### v1.26.6 — Shop-Detail TikTok-White-Look
- [x] **Hintergrund-Bug gefixt** (`app/shop/[id].tsx`): Detailseite hatte hässliche Graue+Weiße-Mischung — Root-View nutzte `colors.bg.primary` (in Light-Mode `#F5F5F5` hellgrau), während Sections/Buy-Bar teilweise weiß waren. Lösung: Zwei neue lokale Variablen `bgMain = colors.bg.secondary` (weiße Hauptfläche, TikTok-Stil) und `bgAccent = colors.bg.subtle` (dezenter Pill/Chip-Tint für Sichtbarkeit auf weiß). Root, Header, Loading/NotFound-States und Sticky-Buy-Bar nutzen jetzt `bgMain` → eine durchgehende weiße Fläche.
- [x] **Dividers von 8px-Bars zu Hairlines**: Style `divider` geändert von `height: 8, backgroundColor: bg.elevated` → `height: StyleSheet.hairlineWidth, marginHorizontal: 16` + inline `backgroundColor: colors.border.subtle` an allen 3 Call-Sites. Deutlich feinerer TikTok-typischer Abschnittstrenner statt grauer „Stripes".
- [x] **Pills/Chips/Steppers auf weiß sichtbar**: Kategorie-Chip, Women-Only-Chip, Stock-Bar-Background, Qty-Stepper, Save-Circle (unsaved), Buy-Button (!canAfford Fallback), Confirm-Modal Product- und Balance-Boxen, Confirm-Thumb-Fallback — alle von `colors.bg.elevated` (in Light=weiß, verschwindet auf weißem Grund) → `bgAccent` (=`bg.subtle`, rgba(0,0,0,0.05) im Light / rgba(255,255,255,0.04) im Dark). Bleibt in beiden Themes sichtbar ohne Farbbruch.
- [x] **Edge-Case-Fallbacks unberührt**: Image-Carousel-Empty-State (kein Bild vorhanden) und Bottom-Sheet-Modals (`mm.sheet` für Confirm/Report/More) behalten `bg.elevated` — sind konzeptionell „gehobene Oberflächen" und in beiden Themes korrekt.

### v1.26.5 — Shop Kontakt & Seller-Shop auf Profil
- [x] **Chat-Button auf Produkt-Detailseite** (`app/shop/[id].tsx` → Seller-Karte): `MessageCircle`-Icon-Circle (38×38) zwischen Seller-Info und „Shop"-Pill. Öffnet/erstellt DM-Konversation via `useOrCreateConversation(seller_id)` und pusht `/messages/[id]?productId=...`. Versendet KEINE Vorformulierte Nachricht (User soll selbst tippen). Wird nur gerendert wenn `seller_id !== currentUserId`. Seller-Karte umstrukturiert: äußeres `Pressable` entfernt (button-in-button), Avatar+Info als eigenes `sellerInner`-Pressable → Profil, Chat + Shop als separate Pressables daneben.
- [x] **Shop-Tab auf Public-Profilen** (`components/profile/UserProfileContent.tsx`): 5. Tab (nach Battles) mit `ShoppingBag`-Icon. Sichtbar nur wenn `shopProducts.length > 0` (`useShopProducts({ sellerId: id, limit: 60 })`). Count-Pill konsistent mit Posts-Tab. Schließt UX-Loch wo der „Shop"-Button auf `app/shop/[id].tsx` zum Profil pushte, aber dort keine Produkte zu sehen waren.
- [x] **Shop-Grid-Rendering**: Produkte im gleichen 3-col Grid (`GRID_COLS`) wie Posts, aber mit Blur-Fill-Bild-Pattern (konsistent mit `app/shop/index.tsx`), Sale-Badge oben links (rot), Preis-Pill unten (`🪙 X` auf halb-transparentem Schwarz). Tap → `/shop/[id]`. Empty-State bei fremden Accounts zeigt ShoppingBag + „hat aktuell keinen aktiven Shop" (sollte selten sichtbar sein weil Tab nur bei >0 Produkten rendert, aber safety-net für Race-Conditions).

### v1.26.4 — Shop Detail Page Redesign
- [x] **Bild-Hero mit Blur-Fill** (`app/shop/[id].tsx` → `ImageCarousel`): 3-Layer-Pattern — (1) gleiche URL mit `blurRadius={30}` + `contentFit="cover"` als Hintergrund, (2) halbtransparenter schwarzer Dim-Overlay, (3) Hauptbild mit `contentFit="contain"`. Dadurch keine harten Crops mehr bei Nicht-1:1-Bildern. Aspect-Ratio: 1:1 Hero (square statt vorher cover-cropped).
- [x] **Dots + Thumbnail-Strip** unter dem Hero: `ThumbnailStrip`-Komponente zeigt 56×56 Thumbs mit Active-Border + Dim-Overlay auf inaktiven. Tap scrollt den Hero-Carousel programmatisch (`carouselRef.current.scrollTo`). State `activeImgIdx` wird vom Screen gehalten statt intern im Carousel, damit beide Komponenten synchron bleiben.
- [x] **Sale-Preis mit Strikethrough**: `effectivePrice()` + `salePercent()` Helpers. Wenn `sale_price_coins` gesetzt → rotes `-XX%`-Badge über dem Preis, Preis selbst in `#EF4444`, daneben durchgestrichener Original-Preis.
- [x] **Neue Info-Pills** in der Promo-Zeile: Gratis-Versand (grün, nur `category==='physical' && free_shipping`) + Location (MapPin + Freitext, nur wenn gesetzt). Bleiben kompatibel mit „🔥 XX× gekauft" und „⚡ Nur noch N übrig".
- [x] **Quantity-Stepper** in der Buy-Bar (nur wenn `stock !== 0 && maxQty > 1`): `[−] 01 [+]` Pill mit Min/Max-Clamp. `maxQty = stock === -1 ? 99 : stock`. `handleBuy` übergibt quantity an `buyProduct(id, quantity)` (bereits im RPC unterstützt).
- [x] **Neuer Split-Buy-Button**: Statt „Merken | Kaufen" nebeneinander jetzt kompakter Merken-Circle (52×52) + Big-CTA mit internem Split-Layout `[🪙 totalCost] [|] [Jetzt kaufen]`. `totalCost = effPrice * quantity`. `canAfford` und Confirm-Modal-Balance rechnen ebenfalls mit `totalCost`.
- [x] **Confirm-Modal erweitert**: Zeigt `totalCost` (nicht `price_coins`), bei `quantity > 1` Zusatz-Zeile `(N× 🪙 unitPrice)`. „Guthaben nach Kauf" rechnet ebenfalls mit `totalCost`.
- [x] **buyBarH-Padding dynamisch**: +52px Padding bei sichtbarem Qty-Stepper, damit Scroll-Content die Sticky-Bar nicht verdeckt.

### v1.26.3 — Shop Richer Cards
- [x] **DB-Erweiterung** (`20260419200000_shop_richer_cards.sql`): `products.sale_price_coins INT NULL` (CHECK: 0 < sale < price), `free_shipping BOOLEAN DEFAULT false`, `location TEXT NULL` + Partial-Index auf `sale_price_coins IS NOT NULL`. `buy_product` RPC rechnet jetzt mit `COALESCE(sale_price_coins, price_coins)` → Angebotspreis wird tatsächlich abgebucht.
- [x] **RPC-Erweiterungen**: `get_shop_products` + `get_saved_products` geben alle drei neuen Felder zurück (DROP + CREATE wegen Return-Type-Change). Frontend-Types in `lib/useShop.ts` (`Product`, `CreateProductInput`) erweitert.
- [x] **Edit-UI** (`app/shop/my-shop.tsx`): Neue Form-Felder im `ProductFormSheet` — Angebots-Preis mit Live-Prozent-Anzeige, Gratis-Versand-Switch (nur physical), Location-TextInput. `handleSave` validiert `sale < price` (DB-CHECK-Spiegelung). `EMPTY_FORM` + `openEditSheet`-Prefill decken die neuen Felder ab.
- [x] **Shop-Card-Redesign** (`app/shop/index.tsx`):
  - **Karten-Größen-Bug gefixt**: Bei ungerader Anzahl wurde die letzte Karte mit `flex: 1` auf volle Breite gestreckt. Fix: Spacer-Item `{id:'__spacer__'}` in `gridData` (via `useMemo`) + `gridCell` mit `flex:1` → alle Karten identische Dimensionen.
  - **Sale-Badge oben links**: Rotes „-XX%"-Label wenn `sale_price_coins` gesetzt; Preis wird rot + alter Preis daneben durchgestrichen (`priceOld`).
  - **Bilder-Counter oben rechts**: `📷 N` Pill wenn `cover_url + image_urls.length > 1` (Camera-Icon + Count).
  - **Location-Zeile** unter Seller: MapPin + Freitext-Ort, nur wenn gesetzt.
  - **Gratis-Versand-Pill**: Inline grünes Truck-Badge („Gratis Versand"), nur für `category==='physical' && free_shipping`.
  - **Women-Only-Badge** von oben rechts → unten rechts verschoben (kollidiert nicht mit dem Bilder-Counter).

### v1.26.1 — Performance-Pass (Live Hot-Paths)
- [x] **GiftAnimation Rules-of-Hooks Fix**: `useSharedValue` / `useAnimatedStyle` nicht mehr in Loops/Conditionals — ein Rendern-Crash bei schnell aufeinander folgenden Geschenken eliminiert.
- [x] **CommentRow Memoisierung**: `React.memo` + stabile Parameter-Handler (`onUserSelect(uid)`, `onModerate(comment)`) in `host.tsx`, `watch/[id].tsx` und `CommentsSheet.tsx`. Neue Messages re-rendern nicht mehr die komplette Liste.
- [x] **GiftPicker GPU-Entlastung**: `GiftCard` memoized + Lottie `loop={selected}` — nur die ausgewählte Karte loopt, andere frieren nach 1× ein (bei 20-40 Karten: ~35 Lottie-Instanzen weniger im Loop-Modus während Coin-Balance-Ticks).
- [x] **`__DEV__`-Guards auf 13 Hot-Path console.log/warn**: LK-Token-Flow, Live-Watch-Debug, Lottie-Kompilierung, Gift-Broadcast-Warning. Hermes dead-code-eliminiert das komplett in Production-Bundles.

### v1.20.0 — Creator-Studio Pro
- [x] **Scheduled Posts**: DB-backed `scheduled_posts` + RPCs `schedule_post` / `reschedule_post` / `cancel_scheduled_post`; pg_cron jede Minute → Edge Function `publish-scheduled-posts` ruft `publish_due_scheduled_posts` (SELECT FOR UPDATE SKIP LOCKED, Retries-Counter, nach 3 Fehlversuchen → 'failed'). Push-Benachrichtigung nach Success.
- [x] **Cloud Post-Drafts**: Tabelle `post_drafts` + RPCs `upsert_post_draft` / `delete_post_draft`. Media wird nach R2 hochgeladen (wie Posts) und beim Publish wiederverwendet (kein Re-Upload). Cross-Device via realtime `postgres_changes`.
- [x] **Creator-Dashboard Erweiterung**: Peak-Hours Heatmap (7×24, pure StyleSheet, kein Chart-Lib) via `get_creator_engagement_hours` (likes+comments als Activity-Proxy). Watch-Time Estimate via `get_creator_watch_time_estimate` (view_count × 8s Schätzung).
- [x] **Neue Screens**: `/creator/scheduled` (Liste pending/failed + Reschedule/Cancel mit Preset-Modal), `/creator/drafts` (Cloud-Entwürfe-Liste mit Resume-Editing → `/create?draftId=…`).
- [x] **Create-Flow Integration**: `DetailsSheet` zeigt zusätzlich "Planen" + "Entwurf" Buttons. Editor liest `?draftId=` für Resume-Editing. `ensureMediaUploaded` cached R2-URL → kein Doppel-Upload zwischen Draft-Save / Schedule / Publish.

### v1.19.0 — Duett-System (TikTok-style)
- [x] **DB-backed Invite-Flow**: `live_duet_invites` (ephemer, 30s expiry) + `live_duet_history` (persistent), bidirektional via einer RPC `create_duet_invite` (Caller-Identity bestimmt Direction)
- [x] **Host → Viewer Einladung**: "Zum Duett einladen" im `LiveUserSheet` + `DuettLayoutPicker` (top-bottom / side-by-side / pip / battle mit 1/3/5 Min)
- [x] **Viewer → Host Anfrage**: Bestehende Co-Host-Request-Queue jetzt zusätzlich DB-persistiert für History
- [x] **Realtime Inbox**: `useDuettInbox` Hook + `DuettInviteModal` mit 30s-Countdown, Accept/Decline, Avatar des Senders
- [x] **History-Tracking**: Auto-Close-Trigger auf `live_cohosts.revoked_at` und `live_sessions.status='ended'` schreiben `ended_at`/`duration_secs`/`end_reason`

### v1.18.0 — Live Engagement Suite
- [x] **Live-Replay / VOD**: LiveKit Egress RoomComposite → S3/Supabase-Storage, dedizierter `expo-video` Player unter `/live/replay/[id]`
- [x] **Live-Polls**: Host erstellt Umfragen, Viewer stimmen ab (`live_polls` + `live_poll_votes` Tabellen, Realtime-Aggregation)
- [x] **Live-Clips**: Viewer markieren Momente während des Streams (`live_clip_markers`), Host sieht 15s-Hotspots im Replay als Seek-Chips
- [x] **Gift-Goals / Targets**: Host setzt Coin-Ziel, Progress-Bar im Stream, Celebrate-Animation bei Erreichen
- [x] **DB-backed Gift-Katalog**: `live_gift_catalog` + Saison-Filter im `GiftPicker`

### Frühere Milestones
- [x] **Chat-Moderation**: Shadow-Ban System mit globaler + Host-eigener Wortliste
- [x] **Gift-System**: Lottie-Animationen + Coin-Abzug + Supabase atomare Transaktionen
- [x] **Premium Themes**: Dark/Light Mode komplett

---

## 🧪 Entwicklung

```bash
# Dev Server starten
npm run start        # oder: npx expo start

# iOS Simulator
npm run ios

# Production Build (EAS)
eas build --platform ios --profile production

# Supabase Edge Functions deployen
supabase functions deploy livekit-token
```

---

## 🔗 Externe Services

| Service | Zweck | Wo konfiguriert |
|---|---|---|
| Supabase | Backend/DB/Auth/Storage | `lib/supabase.ts` + `.env` |
| LiveKit Cloud | WebRTC Video-Streaming | `supabase/functions/livekit-token/` |
| RevenueCat | In-App Purchases | `coin-shop.tsx` + Supabase Webhook |
| Sentry | Error-Monitoring | `app/_layout.tsx` |
| EAS | Build & Deploy | `eas.json` |
