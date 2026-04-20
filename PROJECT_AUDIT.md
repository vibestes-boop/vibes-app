# Serlo / Vibes — Deep Project Audit

**Datum:** 2026-04-16
**Scope:** Architektur, Code-Qualität, Bugs, Performance, Security (Supabase / RLS / Edge Functions)
**Quellen:** `/app`, `/lib`, `/components`, `/supabase` (inkl. `/migrations`), `/plugins`, `/patches`, `/stubs`, `eas.json`, `app.json`, `package.json`
**Methodik:** Vier parallele Deep-Scans (Architektur · Live-Stack · DB/Security · Bugs/Perf) + Gegenverifikation der kritischsten Findings durch direktes Lesen der Quelldateien.

> **Lese-Hinweis:** Einige Findings wurden bei der Verifikation entkräftet (z. B. vermeintlich fehlende RPCs). Jedes Finding in diesem Report ist als **VERIFIZIERT**, **WAHRSCHEINLICH** oder **ENTKRÄFTET** markiert.

---

## 1. Executive Summary

Serlo/Vibes ist eine produktionsreife Expo/React-Native-App mit bewusster Architektur (Feature-basierte Ordner, Zustand + TanStack Query, Supabase-Realtime). Kernfeatures wie Feed-Algorithmus, Live-Streaming (LiveKit) und Gift-System sind durchdacht implementiert. Die Hauptrisiken liegen **nicht** in der App-Architektur, sondern in der Server-Schicht:

1. **Vier konkrete Security-Lücken** (RLS / RPC-Auth / Co-Host-Eskalation), die aktuell **aktiv ausnutzbar** sind.
2. **Fehlende Tests** (keine Unit- / E2E-Tests im Repo).
3. **Keine serverseitige Validierung** von RevenueCat-Käufen.
4. **Migrations-Hygiene** — 69+ SQL-Dateien, mehrere Algorithmus-Versionen parallel, keine einheitliche Migration-Reihenfolge.

Produktionsreife-Score (subjektiv): **B** — die App läuft, aber einige Server-Lücken gehören vor dem nächsten Wachstumssprung geschlossen.

| Bereich | Note | Kurz-Begründung |
|---|---|---|
| Architektur | A | Feature-basiert, saubere Separation |
| State Management | A- | Zustand + TanStack sauber, ein paar Action-Ref Anti-Patterns |
| TypeScript | B+ | `strict: true`, aber notwendige `any`-Workarounds für Hermes HBC |
| UI-Konsistenz | B | Theme via `useTheme()`, aber Hex-Farben in einigen StyleSheets |
| Error-Handling | A- | `ErrorBoundary`, Optimistic-Rollbacks; eine ungeschützte `console.error` |
| Server-Security | **D** | Vier verifizierte RLS/RPC-Lücken |
| Tests | **F** | Keine App-Tests im Repo |
| Performance | A- | Batch-RPCs, Cursor-Pagination, gute Query-Hygiene |
| Migrations-Hygiene | C | Zu viele Fix-/Version-Dateien parallel |

---

## 2. Stack & Struktur (Ist-Zustand)

### 2.1 Stack (aus `package.json`)
- Expo SDK 54 · React Native 0.81.5 · React 19.1
- Expo Router v6 (im Repo bereits v6, CLAUDE.md sagt v3 — **Doku veraltet**)
- TypeScript 5.9 `strict: true`, Path-Alias `@/*`
- State: Zustand 5 · Data: TanStack Query 5.90 + AsyncStorage-Persister
- Realtime/Video: `@livekit/react-native` 2.9.6 + `livekit-client` 2.18
- UI: Reanimated 3.19, Skia 2.6, FlashList 1.7, Lottie 7.3, Vision-Camera 4.7
- Auth/BE: Supabase-JS 2.99, Expo Apple Auth, SecureStore
- Payments: `react-native-purchases` 9.15 (RevenueCat)
- Monitoring: `@sentry/react-native` 8.7
- ML: `@react-native-ml-kit/face-detection` 2.0

### 2.2 Projekt-Struktur (Kurzfassung)
```
app/           Expo-Router Screens (auth, tabs, live, create, messages, …)
lib/           ~73 Hooks/Stores/Utilities (authStore, themeStore, useLiveSession, useGifts, …)
components/    ~130 Komponenten, Feature-Ordner (live/, feed/, guild/, profile/, …)
supabase/      27 Kern-SQL + 40+ Migrations + Edge Functions (livekit-token, decay-scores)
plugins/       Expo Config-Plugins (withMethodQueueFix, withRootViewBackground, babelSafeInterop)
patches/       patch-package für React Native 0.81.5 + FlashList 1.7.3
stubs/         Expo-Go-Stubs für native Module (LiveKit-WebRTC, Reanimated, …)
types/         Database- & Domain-Typings
```

### 2.3 Tailwind-Widerspruch (CLAUDE.md)
CLAUDE.md sagt "kein tailwind", aber `tailwind.config.js`, `global.css` und `nativewind-env.d.ts` existieren. Scan zeigt: **keine** Tailwind-Klassen in Code → Setup ist tot. **Action:** entweder aktivieren oder Setup entfernen (Build-Noise reduzieren).

---

## 3. KRITISCHE SECURITY-FINDINGS (verifiziert am Code)

### 3.1 `increment_post_view()` — View-Gaming möglich [VERIFIZIERT]
**Datei:** `supabase/view_count.sql:16–26`
```sql
CREATE OR REPLACE FUNCTION increment_post_view(p_post_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.posts SET view_count = view_count + 1 WHERE id = p_post_id;
END; $$;
```
- Keine `auth.uid()` Prüfung, keine Dedup-Tabelle.
- Frontend-Dedup (`viewedPosts` Set in `app/(tabs)/index.tsx:225`) ist **clientseitig** und trivial zu umgehen.
- `view_count` fließt indirekt in Ranking/Monetarisierung → Creator-Gaming-Risiko.
- **Fix:** `post_views_log (post_id, user_id)` mit UNIQUE + `auth.uid() IS NOT NULL` Check.

### 3.2 `update_dwell_time()` — Algorithmus-Gaming [VERIFIZIERT]
**Datei:** `supabase/dwell_time.sql:11–19`
- Keine `auth.uid()` Prüfung, kein User-Logging.
- `dwell_time_score` ist im Feed-Algorithmus **mit 0.45 gewichtet** (siehe `algorithm_v3.sql`) — die manipulierbarste Variable hat den stärksten Ranking-Einfluss.
- **Fix:** `post_dwell_log (post_id, user_id)` mit UNIQUE, Upsert-Semantik + Auth-Guard.

### 3.3 `msg_update` Policy zu permissiv [VERIFIZIERT]
**Datei:** `supabase/messages.sql:58–65`
```sql
CREATE POLICY "msg_update" ON public.messages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM conversations c
         WHERE c.id = conversation_id
           AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())));
```
- Jeder Conversation-Teilnehmer kann **Nachrichten anderer Teilnehmer** editieren.
- `WITH CHECK` fehlt komplett.
- **Fix:** `USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id)`.

### 3.4 Co-Host Token-Eskalation in `livekit-token` [VERIFIZIERT]
**Datei:** `supabase/functions/livekit-token/index.ts:142–167`
- SEC 2 prüft nur, ob die Session **existiert und active** ist — aber nicht, ob der anfragende User tatsächlich als Co-Host zugelassen wurde.
- Zeile 166: `const canPublish = isHost === true || isCoHost === true;`
- **Angriff:** Beliebiger authentifizierter User sendet `{ roomName, isCoHost: true }` → erhält Publisher-Token für fremden Stream → kann über WebRTC publishen (DMCA-, Abuse-Risiko).
- **Fix-Optionen:** (a) Co-Host-Whitelist-Tabelle (`live_cohosts`) prüfen; (b) Co-Host-Token nur per Edge-Function vom Host requesten lassen (HMAC-signiertes One-Time-Grant); (c) Parameter ignorieren.

### 3.5 `join_live_session()` — Viewer-Count-Inflation [WAHRSCHEINLICH]
**Datei:** `supabase/live_studio.sql:93–103`
- RPC inkrementiert `viewer_count` ohne Dedup-Mechanismus (Presence/User-Log).
- Bot kann mit bekannter Session-ID 10.000× aufrufen → fake Viewer-Count → Feed-Ranking-Manipulation.
- **Fix:** Presence-basiertes Zählen via LiveKit-Participants (Host nutzt das bereits in `host.tsx:318–337`) als Source-of-Truth statt DB-Counter, oder `live_session_viewers (session_id, user_id)` mit Upsert.

### 3.6 Zombie-Sessions [VERIFIZIERT — kein Cleanup-Job]
- Kein Cron-Job in `supabase/` zum Auto-Ending verwaister Sessions.
- Host-Crash → Session bleibt `status='active'`, Feed zeigt „live" obwohl niemand streamt.
- **Fix:** `pg_cron`-Job (alle 5 Min) setzt alle `active` Sessions `> 2h` auf `ended`.

### 3.7 RevenueCat — Webhook existiert, aber Apple/Google-Receipt-Trust fehlt [KORRIGIERT NACH VERIFIKATION]
**Datei:** `supabase/functions/revenuecat-webhook/index.ts`
- **Korrektur:** Webhook **existiert und ist solide gebaut** — Bearer-Secret, Idempotenz (`coin_purchases.transaction_id`), Produkt-ID-Whitelist, Anon-RC-Reject, `credit_coins` RPC mit Service-Role.
- Das Audit-Finding der initialen Scan-Runde war übertrieben; Client-Side setTimeout in `coin-shop.tsx` ist nur UX-Delay für Refetch, die Gutschrift läuft server-seitig via Webhook.
- **Restliches Risiko (Phase 2):**
  - Kein Apple/Google **Receipt-Signature-Verify** — RevenueCat wird blind vertraut. Für höhere Beträge lohnt sich zusätzliche Verifikation via Apple StoreKit API / Google Play Developer API.
  - **Bearer-Secret statt HMAC-Signature** über Request-Body → Replay-Angriffe theoretisch möglich.
  - Kein Rate-Limit auf den Endpoint.

### 3.8 `coins_wallets` Service-Role-Policy redundant [KORRIGIERT NACH VERIFIKATION]
- `wallet_update_service` prüft `auth.role() = 'service_role'` — Service-Role umgeht RLS **ohnehin**, die Policy hat also keinen praktischen Effekt.
- **Nicht schädlich**, nur unnötig und kann Leser in die Irre führen.
- Wichtiger Kontext (positiv): Es gibt **keine** `authenticated`-INSERT/UPDATE/DELETE-Policy → User können Wallet nicht direkt schreiben. Alle Writes laufen via `SECURITY DEFINER` RPCs (`send_gift`, `credit_coins`). Architektur ist sauber.
- **Fix (optional):** Redundante Policy entfernen oder beibehalten als dokumentierender Hinweis.

### 3.9 `decay-scores` Cron-Secret — String-Equal statt HMAC [VERIFIZIERT]
**Datei:** `supabase/functions/decay-scores/index.ts:7–19`
- Plaintext-Vergleich `authHeader !== expectedSecret` ist nicht timing-safe (kleines Risiko über Public-Net).
- Keine Request-Signatur.
- **Fix:** HMAC-SHA-256 Signatur über Body + Timestamp (Replay-Schutz).

### 3.10 GIPHY-Key im Klartext in `eas.json` [WAHRSCHEINLICH]
- Laut Bug-Agent in `eas.json` exponiert. **Fix:** EAS Secrets / Expo SecureEnv.

---

## 4. Live-Streaming System (LiveKit + Supabase Realtime)

### 4.1 Positive Aspekte
- **Edge Function verifiziert JWT** via Supabase Auth (`/auth/v1/user`), statt blind zu trusten.
- Host-Token-Issue ist korrekt eingegrenzt (SEC 1): `host_id` muss matchen (`index.ts:121–139`).
- Gift-Transaktion in `send_gift` ist **innerhalb einer Transaktion atomar** mit `FOR UPDATE` Lock auf `coins_wallets` (`supabase/migrations/20260407_virtual_gifts.sql:115`).
- Realtime-Architektur ist sauber: Comments/Gifts/Reactions/Co-Host via **Supabase Broadcast-Channel**, nur Viewer-Count + Session-Status via DB-Changes.

### 4.2 Bugs & Risiken
- **Track-Referenz kann veralten** (`app/live/host.tsx:443–483`, `LocalCameraView`): unpublished Tracks lassen den State zeigen, obwohl der Track tot ist → schwarzer Bildschirm beim Kamera-Switch.
- **Broadcast-Unsubscribe-Reihenfolge** in `useGiftStream` (`lib/useGifts.ts:248–254`): `channelRef.current = null` vor `removeChannel(channel)` → doppelte Listener bei schnellem Remount.
- **Shadow-Ban leaked Info** (`lib/useLiveSession.ts:479–483`): Sender sieht Kommentar optimistisch, andere nicht — Muster ist durch Testen erkennbar. Alternative: UI mit Delay-/Pending-Indicator.
- **Moderation-Wortmatching zu simpel** (`lib/liveModerationWords.ts:66`): `lower.includes(word)` → false positives (z. B. "Narsch" matcht "arsch"). **Fix:** Word-Boundary-Regex + `normalize('NFD')` gegen Zalgo.
- **Moderation-Array-Spread pro Comment** (`liveModerationWords.ts:62`): `[...GLOBAL, ...host]` bei jedem Call — nicht kritisch, aber unnötige GC-Last im heavy-chat. **Fix:** Merge in Hook-Effect mit `useMemo`.
- **Viewer-Count Dual-Source**: DB-Counter vs. `room.remoteParticipants.length` divergieren bis zu 5–30 s beim Disconnect → auf Feed und im Stream unterschiedliche Zahlen.
- **Mic-Toggle schluckt Fehler** (`host.tsx:376–437`): `try { await setMicrophoneEnabled(...) } catch { /* ignore */ }` → Host denkt Mic an, Viewer hören nichts.
- **Gift-Broadcast-Verlust möglich** (`lib/useGifts.ts:116–124`): DB-Insert gelingt, aber wenn `channelRef === null` war, sehen andere Viewer das Gift erst beim nächsten Refresh.

### 4.3 Entkräftetes Finding
- Der Live-Agent meldete "fehlende RPCs" `toggle_followers_only_chat`, `increment_live_likes`, `is_following_host`. **Verifikation:** alle drei sind in `supabase/migrations/20260412_followers_only_chat.sql` und `supabase/migrations/20240401_live_features.sql` definiert. **Kein Defekt.** Unterstreicht aber, dass die Verteilung von RPCs über `/supabase` vs. `/supabase/migrations` unübersichtlich ist.

---

## 5. Daten-Layer / Supabase

### 5.1 RLS-Status (Quick-Matrix)
| Tabelle | RLS | Auffällig |
|---|---|---|
| profiles | ✓ | Update per `auth.uid() = id` — ok |
| posts | ✓ | Sauber |
| likes / bookmarks / follows | ✓ | Sauber |
| comments | ✓ | Update-Policy fehlt (nur insert/delete) — **ok**, aber Edit-Feature später schwierig |
| **messages** | ✓ | **`msg_update` zu permissiv** (siehe 3.3) |
| live_sessions | ✓ | Update nur `USING`, kein `WITH CHECK` — verschärfen |
| live_comments | ✓ | Sauber |
| coins_wallets | ✓ | Unnötige `service_role` Policy (siehe 3.8) |
| gift_transactions | ✓ | Sauber |
| notifications | ✓ | Sauber |
| push_tokens | ✓ | Sauber |

### 5.2 RPC-Sicherheit
| RPC | `SECURITY` | `auth.uid()` | SQL-Inj. | Status |
|---|---|---|---|---|
| get_vibe_feed, get_guild_feed | DEFINER | indirekt | ✓ parametrisiert | ok |
| **increment_post_view** | DEFINER | **fehlt** | ✓ | **VULN** (3.1) |
| **update_dwell_time** | DEFINER | **fehlt** | ✓ | **VULN** (3.2) |
| send_gift | DEFINER | ✓ | ✓ | ok (FOR UPDATE Lock) |
| join_live_session / leave_live_session | INVOKER | indirekt | ✓ | **Counter-Gaming** (3.5) |
| delete_own_account | DEFINER | ✓ | ✓ | ok, aber hart (kein Soft-Delete) |
| block_user / unblock_user | DEFINER | ✓ | ✓ | ok |

**Keine klassische SQL-Injection identifiziert** — alle Funktionen nutzen parametrisiertes SQL.

### 5.3 Storage
- Buckets `posts`, `avatars`, `stories`.
- Uploads nur `authenticated`; Delete via `storage.foldername(name)[1] = auth.uid()::text` → ok.
- Mime-Whitelist + 50 MB Limit — ok.
- **Keine Virenscan-/CSAM-Integration** — für Produktion mit UGC empfohlen.

### 5.4 Migrations-Hygiene
- **69+ SQL-Dateien** in `supabase/` und `supabase/migrations/`; parallele Versionen wie `algorithm_v3.sql`, `algorithm_final.sql`, `algorithm_fixes.sql` erschweren Reconciliation.
- `fix_push_and_comments.sql`, `disable_push_triggers.sql`, `*_fix.sql` signalisieren Hotfixes, die nie zur kanonischen Migration wurden.
- **Empfehlung:** Umstieg auf `supabase/migrations/YYYYMMDDHHMMSS_name.sql` mit `supabase db push` als Single-Source-of-Truth.

---

## 6. App-Layer — Bugs, Crashes, Perf

### 6.1 KRITISCH (Prod-relevante Bugs)
- **Stories ohne DB-TTL** (`lib/useStories.ts:40,88–89`): 24h-Filter nur client-side, keine Auto-Cleanup-Policy → Tabelle wächst unbegrenzt.
- **Messages-Realtime Duplikate** (`lib/useMessages.ts:125–135`): Optimistic Insert + Realtime-Insert können beide durchlaufen → Doppelanzeige.
- **Repost useEffect ohne Abort** (`lib/useRepost.ts:31–53`): beim schnellen Feed-Scroll kann der Promise eines alten `postId` den State des neuen Posts überschreiben.
- **Feed-Realtime-Subscription akkumuliert** (`app/(tabs)/index.tsx:283–310`): bei häufigem Tabwechsel können verwaiste Supabase-Kanäle liegenbleiben.
- **`_layout.tsx` PII-Filter fehlt bei Sentry** (`app/_layout.tsx:22–28`): `beforeSend` Hook nicht konfiguriert → User-IDs/Emails können in Fehler-Frames nach Sentry.

### 6.2 WICHTIG
- **Combo-Counter Map unbegrenzt** (`lib/useGifts.ts:61,93–103`): keine LRU-Beschränkung, wächst in Long-Running Streams.
- **Upload-Retry ignoriert Abort-Signal** (`lib/uploadMedia.ts:48–67`): `withRetry` startet 2. Versuch obwohl User "Abbrechen" gedrückt hat.
- **onEndReached Double-Fire** (`app/(tabs)/index.tsx:365–568`): zwei `fetchNextPage` in Race-Fenster.
- **Audio.Sound Lifetime** (`components/feed/FeedItem.tsx:509–551`): bei sehr schnellem Scrollen kleine Race zwischen `createAsync` und `unloadAsync`.
- **Seek-Lock-Timer-Cleanup** (`FeedItem.tsx:98–135`): Timer kann unter bestimmten Pan-Sequenzen hängenbleiben → Scrub ignoriert.

### 6.3 PERFORMANCE
- `useMemo` in `app/(tabs)/index.tsx` rechnet `getTitleFromUrl` und Farb-Gradients pro Render neu — ~20 Allokationen pro Feed-Update. Externalisieren.
- `storyGroupMap` invalidiert bei jedem 30-s Restale der Stories-Query → ganze Liste re-rendert. **Fix:** `keepPreviousData: true` oder stabiler `Map`-Ref.
- `useNetworkStatus` pollt online alle 10 s → skaliert schlecht mit aktiven DAUs.
- Sentry `tracesSampleRate: 0.15` → bei hohem Traffic teuer; prod → 0.01–0.05.
- Tab-Switch-Animation & TabBar-Store-Slots — viele Zustand-Subscriptions; Selector-Hooks statt `useTabBarStore()` ohne Selector verwenden.

### 6.4 CRASH-RISIKEN
- `post.caption` / `post.author.username` ohne Optional-Chaining an einigen Stellen in `messages/[id].tsx`.
- Unhandled `await channel.send(...)` in `useGifts.ts:118` (kein `.catch`).
- Einzelner **ungeschützter** `console.error` ohne `__DEV__` Guard in `lib/useComments.ts:235` — leakt Debug-Info in Production.

### 6.5 ENTKRÄFTETES / ABGESCHWÄCHTES FINDING
- „Fehlende 3 RPCs im Live-Stack" → entkräftet (siehe 4.3).
- „Race Condition im `send_gift`" → durch `FOR UPDATE` in Transaktion abgedeckt; der Agent hatte die Lock-Semantik unterschätzt. Szenario „zwei Transaktionen sehen beide 100 Coins" ist falsch — `FOR UPDATE` serialisiert genau diese Abfrage.

---

## 7. Code-Qualität Detail

### 7.1 Positives
- `authStore.ts` persistiert nur notwendige Felder (`partialize`), umgeht Supabase-Proxy bei Hot-Reload clever via REST.
- `themeStore.ts` trennt `mode` (persistiert) von `resolved` (live) korrekt.
- **Batch-Engagement-Loading** (`lib/useFeedEngagement.ts`) eliminiert klassische N+1-Probleme — 1 RPC für Likes/Comments/Bookmarks aller Posts im Viewport.
- **Cursor-Pagination über ID-Exclusion** (`lib/usePosts.ts:42–138`) statt Offset — robuster gegen Einfüge-Anomalien.
- **Optimistic Updates mit Rollback** in Likes/Follows (`useLike.ts:75`, `useFollow.ts:56–64`).
- **Patches + Plugins sind dokumentiert** — `withMethodQueueFix.js` erklärt das Thread-Safety-Issue mit `convertNSExceptionToJSError`; `patches/react-native+0.81.5.patch` mit Kontext zum iOS-18.7-Crash.

### 7.2 Technische Schulden
- **Keine Tests** — kein `__tests__`, kein Jest-Setup, kein E2E (Detox/Playwright).
- **Hardcodierte Hex-Farben** in `components/feed/feedStyles.ts` (Zeilen 8–76), `app/(tabs)/_layout.tsx:322`, `components/ui/ErrorBoundary.tsx`. Brechen Theme-Switch.
- **Lazy-`require()`-Pattern** in `src/_layout.full.tsx` war Hermes-Workaround — bei aktuellem Expo/RN prüfen, ob noch nötig.
- **`babelSafeInterop.js` ist No-Op-Platzhalter** — Kommentar offenlegt, dass die echte Lösung im Metro-Serializer liegen sollte. Entscheiden: wirklich vorhanden oder Plugin löschen.
- **Xcode-pbxproj Manipulation** (`plugins/withMethodQueueFix.js:71–81`) sucht per UUID-Lookup — fragil bei Xcode-Formatänderungen.
- **Expo Router v3 in Doku, v6 im Repo** — CLAUDE.md nachziehen.

---

## 8. Priorisierte Remediation Roadmap

### Phase 1 — HOTFIX (≤ 48 h)
1. `increment_post_view`, `update_dwell_time` — Auth-Guard + Dedup-Log-Tabellen.
2. `msg_update` Policy: `auth.uid() = sender_id` mit `WITH CHECK`.
3. `livekit-token` Co-Host: entweder Whitelist-Tabelle oder Parameter entfernen.
4. `__DEV__`-Guard um `console.error` in `lib/useComments.ts:235`.
5. `eas.json` GIPHY-Key → EAS Secrets.

### Phase 2 — Diese Woche
6. Zombie-Session-Cleanup via `pg_cron` + LiveKit-Presence als Viewer-Count-Quelle.
7. RevenueCat Receipt-Validierung (Edge Function + Webhook).
8. `join_live_session` Dedup (Session-Viewer-Tabelle oder Presence).
9. Moderation-Matching: Word-Boundary-Regex + Unicode-Normalisierung.
10. Gift-Broadcast: `channelRef` Unsubscribe-Reihenfolge korrigieren; Combo-Map als LRU.

### Phase 3 — Nächster Sprint
11. Jest + React-Testing-Library Setup; Snapshot-Tests für `AuthGuard`, Unit-Tests für `useLike`/`useFollow`/`useGifts`.
12. `post_views_log` / `post_dwell_log` rückwirkend Snapshot aus aktuellem `view_count` übernehmen.
13. Stories-TTL-Policy + Cleanup-Cron.
14. Migrationen in `supabase/migrations/YYYYMMDD_*.sql` konsolidieren; Algorithm-Versionen bereinigen.
15. Sentry `beforeSend`-Hook mit PII-Scrubber; `tracesSampleRate` auf 0.05 reduzieren.

### Phase 4 — Längerfristig
16. CRON-Secret → HMAC-Signatur + IP-Allowlist.
17. Account-Deletion → Soft-Delete + Storage-Cleanup-Queue.
18. Storage-Scanning (Malware/CSAM) für UGC.
19. Tailwind-Setup: aktivieren **oder** entfernen.
20. `babelSafeInterop`/Xcode-pbxproj Plugins robuster machen oder entfernen.

---

## 9. Anhang — geprüfte Dateien (Hauptset)

**Gelesen in Verifikationsrunde:**
`package.json`, `tsconfig.json`, `README.md`,
`supabase/view_count.sql`, `supabase/dwell_time.sql`, `supabase/messages.sql`,
`supabase/functions/livekit-token/index.ts`,
`lib/liveModerationWords.ts` (grep), plus bestätigende greps für `toggle_followers_only_chat`, `increment_live_likes`, `is_following_host`, `msg_update`, `includes(`.

**Gelesen in Agent-Scans:**
`app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/live/host.tsx`, `app/live/watch/[id].tsx`, `app/live/start.tsx`, `app/coin-shop.tsx`, `app/messages/[id].tsx`, `lib/authStore.ts`, `lib/themeStore.ts`, `lib/useLiveSession.ts`, `lib/useGifts.ts`, `lib/liveModerationWords.ts`, `lib/gifts.ts`, `lib/useFeedEngagement.ts`, `lib/usePosts.ts`, `lib/useLike.ts`, `lib/useFollow.ts`, `lib/useMessages.ts`, `lib/useRepost.ts`, `lib/useStories.ts`, `lib/useComments.ts`, `lib/uploadMedia.ts`, `components/feed/FeedItem.tsx`, `components/feed/feedStyles.ts`, `components/ui/CommentsSheet.tsx`, `components/ui/ErrorBoundary.tsx`, `components/live/GiftPicker.tsx`, `components/live/GiftAnimation.tsx`, plus das komplette `supabase/*.sql` Verzeichnis und ausgewählte Files unter `supabase/migrations/`.

---

*Erstellt durch parallele Deep-Scan-Agenten + manuelle Verifikation der kritischsten Findings.*
