# web/ui: v1.w.UI.11 — TikTok-Parity (Header-Lift, Followed-Accounts-Sidebar, Comment-Push-Layout)

Gestackt auf `web/ui-layout-reset` (v1.w.UI.10). Drei atomare Commits, jeder review-bar isoliert.

## Context / Why

Nach dem Struktur-Reset v1.w.UI.10 (Dark-Canvas flush, Tab-Pills als Overlay, StoryStrip nur auf Following) zeigten sich noch drei harte Abweichungen vom TikTok-Web-Viewer:

1. **Globaler SiteHeader auf allen Seiten** — TikTok hat keinen, Logo + Search + User-Actions leben im/am Nav.
2. **Sidebar zeigt nur Static-Links** — TikTok-Sidebar rendert „Accounts, denen du folgst" als Signal-Slot direkt zwischen Navigation und Footer.
3. **Kommentare als modaler Sheet-Overlay** — TikTok pusht den Content-Bereich und rendert Kommentare als eigene rechte Column, Video bleibt interaktiv.

Dieser PR adressiert alle drei in voneinander unabhängigen Commits.

## Commits

### `72d90ba` — Phase A: Header global raus, Logo-in-Sidebar

- `components/site-header.tsx` und `components/main-nav.tsx` gelöscht (Dead Code — `site-header` war seit v1.w.UI.10 schon nicht mehr im Layout mounted, `main-nav` nur von SiteHeader importiert).
- Serlo-Logo wandert als Sidebar-Header in `FeedSidebar` (Top-Section, Link auf `/`).
- User-Actions (Sprache, Theme, Notifications, Avatar-Menü) werden als **TopRightActions**-Floating-Island oben-rechts gerendert, kein Layout-Anker.
- Letzte zwei Referenzen auf die CSS-Var `--site-header-h` (`studio-sub-nav`, `live/[id]/page`) auf `top-0` / `h-[100dvh]` umgestellt — die Var ist jetzt komplett tot.

### `30538a8` — Phase B: „Konten, denen ich folge"-Section

- Neue Server-Fetch-Fn `getMyFollowedAccounts({ limit, offset })` in `lib/data/feed.ts` (2-step query: `follows` lookup → `profiles` fetch, Client-Map für Order-Restore).
- Neue Node-Runtime-Route `/api/follows/me` für Lazy-Load im Sheet (hart gecappt bei limit≤100, offset≥0 — Abuse-Guard).
- Neue Komponente `FollowedAccountsSection` mit drei Render-States:
  - **Empty** (`0 follows`) → dezenter Explore-CTA
  - **Kurz** (`<5 follows`) → 5 Rows, kein Sheet
  - **Voll** (`≥5 follows`) → 5 Top-Rows + „Alle anzeigen"-Button öffnet Left-Side-Sheet der via `/api/follows/me?limit=100&offset=N` chunked nachlädt
- SSR: `getMyFollowedAccounts({ limit: 5 })` in beiden Feed-Pages (`/`, `/following`) zu `Promise.all` dazu, als `followedAccounts`-Prop durch HomeFeedShell → FeedSidebar.
- **Tests:** 5 Cases (Row-Render, Verified-Badge-Gate, Empty-CTA, Threshold, Sheet-Fetch-on-Open) + 4 Gate-Szenarien in `feed-sidebar.test.tsx` (viewerId × followedAccounts-Kombinationen).

### `9c81ba9` — Phase C: Comment-Push-Layout

- **`CommentsBody`**: reine Liste + Compose extrahiert aus `CommentSheet`. Props `postId`, `allowComments`, `viewerId`, `variant: 'sheet' | 'panel'`, optional `onClose`. Panel-Variant rendert eigenen Header mit X-Button, Sheet-Variant lässt den Radix-SheetHeader drüberlaufen.
- **`CommentSheet`**: bleibt als dünner Radix-Dialog-Wrapper für Mobile-Fallback < xl. Signatur + Props unverändert, damit existierende Aufrufer nicht brechen.
- **`CommentPanel`**: neuer Inline-Panel ohne Radix-Portal, rendert `CommentsBody` mit `variant='panel'`. Kein Fokus-Trap, ESC-Handler lebt im Shell.
- **`FeedInteractionContext`**: neuer zentraler State (`commentsOpenForPostId`, `openCommentsFor`, `closeComments`). Wichtig: **No-op-Fallback wenn Hook ohne Provider gerufen wird** — FeedCard bleibt in Isolation (ohne Shell-Wrap) testbar, der alte Unit-Test-Pfad bricht nicht.
- **`HomeFeedShell`** lifted den State:
  - Wrappt den gesamten Subtree in `FeedInteractionProvider`.
  - Tracked `matchMedia('(min-width: 1280px)')` in einem Effekt.
  - Switcht Grid-Template dynamisch: default `xl:grid-cols-[260px_1fr_320px]` → mit offenen Kommentaren auf xl+ `xl:grid-cols-[260px_1fr_400px]` (Kommentar-Threads brauchen mehr horizontalen Platz als die Discover-Column).
  - Rendert `CommentPanel` statt `FeedSidebarRight` in der rechten Column wenn `showInlinePanel` aktiv.
  - Auf < xl: rendert weiterhin `<CommentSheet>` als Overlay, diesmal aber kontrolliert vom Context-State (nicht mehr lokal in FeedCard).
  - ESC-Keydown-Handler ist scoped auf `commentsOpenForPostId`-Truthy (unregistriert sich automatisch wenn Panel zu).
- **`FeedCard`**: lokaler `commentsOpen`-State raus, stattdessen `openCommentsFor(post.id)` aus dem Context im Comment-Button. Lokaler `<CommentSheet>`-Render fällt weg — Shell ist alleiniger Owner.
- **Tests:** 2 neue Suites
  - `feed-interaction-context.test.tsx` — no-op-Fallback, open/close, Target-Wechsel, State-Sharing über mehrere Consumer im Provider.
  - `comment-panel.test.tsx` — Close-Button-onClose, Lock-Hinweis bei `allowComments=false`, Login-Prompt bei `viewerId=null`, Compose-Form bei beidem gesetzt.

### `b37205d` — Phase C Follow-up: Toggle + Scroll-Sync

Zwei UX-Refinements auf den Panel-Flow:

- **Toggle-Button** (`feed-card.tsx`): zweiter Klick auf das Comment-Icon desselben Posts schließt den Panel. Icon bekommt goldenen `fill` wenn der Panel für diesen Post offen ist; aria-label switcht zwischen „öffnen" / „schließen".
- **Scroll-Sync** (`feed-list.tsx`): bei offenem Panel updatet der angezeigte Kommentar-Kontext automatisch auf den jeweils aktiven Post im Viewport (IntersectionObserver ≥60% fired → `openCommentsFor(activePostId)`). Ohne offenen Panel passiert nichts — kein Auto-Open beim Scrollen.

### `e75313c` — Phase C Hotfix: Panel-Sync Infinite-Loop-Guard

Der Follow-up-Commit oben hatte in der Praxis einen Render-Loop („Maximum update depth exceeded") sobald der Panel offen war und der User gescrollt hat. Root-Cause: beim Panel-Open shiftet das Grid-Template (`320→400` rechte Column) den Feed-Container, IntersectionObserver re-emittet mit leicht veränderten Ratios und `activeIdx` oszilliert innerhalb weniger Frames. Self-Equals-Guard greift nicht, weil `commentsOpenForPostId` im State noch den alten Wert hat während der Dispatch in-flight ist, und die `list`-Dep (Query-Cache-Bumps bei Like/Comment-Count-Update) triggert den Effect erneut.

Fix in drei Schichten:
1. `list` aus den Effect-Deps raus, via `listRef` gelesen — Query-Cache-Mutations bremsen den Sync nicht mehr.
2. `lastSyncedIdRef` merkt sich die zuletzt dispatchte PostID, blockt Re-Dispatch zwischen `setState` und Re-Render.
3. Reset des Refs beim Panel-Close, damit Re-Open auf demselben Post wieder greift.

## Risk-Notes

- **`activePost`-Lookup Fallback**: wenn der offene Post aus der FeedList rausgescrollt ist (Pagination hat ihn verdrängt), defaulten wir auf `allowComments=true` damit der Compose-Slot sichtbar bleibt. Die Server-RPC `createComment` greift als finaler Enforcement-Punkt; kein Schreib-Risiko.
- **`useComments`-Mount-Semantik**: statt `enabled={open}` wie in v1 läuft der Query jetzt on-mount. Semantik bleibt identisch weil CommentSheet nur wenn `open=true` gemounted wird und CommentPanel nur wenn `commentsOpenForPostId` gesetzt ist. Kein Over-Fetch.
- **Keine DB-Migration**, keine RPC-Changes, keine Schema-Drift. Rein client-side Refactor + ein neuer Route-Handler (`/api/follows/me`).

## Verification

- [x] tsc --noEmit: keine neuen Fehler durch diese Branches (pre-existing: zod/shared, feed.test.ts:184)
- [ ] `pnpm test --filter @serlo/web`: muss auf deinem Mac laufen (Sandbox-Linux-ARM64 hat kein Next-SWC-Binary)
- [ ] Visual-Smoke: `/`, `/following` (logged-in mit ≥5 Follows, mit <5 Follows, ohne Follows, logged-out), `/shop`, `/u/[id]`, `/settings`
- [ ] Comment-Panel-UX: öffnen auf `/` → Discover-Sidebar verschwindet, Panel pusht 400px Spalte, Feed bleibt playable, ESC + X schließen beide
- [ ] Comment-Panel-Toggle: zweiter Klick auf dasselbe Icon schließt den Panel, Icon goldet während offen
- [ ] Comment-Panel-Scroll-Sync: mit offenem Panel durch 3+ Posts scrollen → Panel zeigt automatisch Kommentare des aktuellen Posts, KEIN „Maximum update depth"-Error in Browser-Console

## Merge-Reihenfolge

Erst `web/ui-layout-reset` → `main` (v1.w.UI.10 ist Basis), **danach** rebase + Merge dieses Branches.
