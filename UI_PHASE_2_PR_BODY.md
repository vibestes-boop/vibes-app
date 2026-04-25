# Web UI Phase 2 — Live-Viewer Overlay-Architektur (B1 + B2 + B4 + B5)

Zweiter PR der UI-Audit-Empfehlungen aus `UI_AUDIT_WEB.md` (Benchmark: TikTok). Kompletter Reshape der `/live/[id]`-Seite weg vom bisherigen 2-Spalten-Twitch-Layout (16:9-Video links, Sidebar mit Chat/Host-Card/Poll rechts) hin zum TikTok-/YouTube-Shorts-typischen fullscreen Portrait-Canvas mit allem als halbtransparente Overlays.

## Was drin ist

### B1 · Portrait-Dark-Canvas-Layout (`apps/web/app/live/[id]/page.tsx`)

Kompletter Rewrite der Viewer-Page.

- **Root-Frame**: `relative h-[calc(100dvh-var(--site-header-h,64px))] bg-[#0b0b10] overflow-hidden` — dunkler Canvas, exakt so hoch wie Viewport minus SiteHeader. Der Canvas-Hintergrund (`#0b0b10`) ist bewusst nicht pures Schwarz (`#000`), damit die schwarzen Letterboxes des Video-Players sich subtil vom Canvas absetzen und der „phone viewport in the middle"-Effekt auch auf OLED-Displays lesbar bleibt.
- **Zentrierter 9:16-Frame**: `flex items-center justify-center md:p-4` → innerer `aspect-[9/16]` mit `rounded-2xl shadow-elevation-4` ab md+. Auf Mobile (<md) fällt die Aspect-Constraint weg und der Frame füllt den Viewport (`h-full w-full`) — typischer TikTok-Mobile-Look.
- **Video-Layer** (`absolute inset-0 bg-black`) füllt den Frame, LiveVideoPlayer bleibt mit `object-contain` drin — bei Non-9:16-Streams entstehen Letterboxes innerhalb des Frames, nicht um den Frame herum. Das passt zur Intention (der Canvas ist die „phone viewport illusion", der Stream selbst kann jedes Aspect-Ratio haben).
- **Gradient-Shades** top (`h-32 from-black/50 ... to-transparent`) und bottom (`h-48 from-black/60 via-black/30 to-transparent`) über den Overlays — stellen Lesbarkeit der Pills auch gegen helle Daylight-Streams sicher. Rein `pointer-events-none`, stören keine Interaktion.
- **Alle UI-Elemente als Absolute-Overlays** innerhalb des 9:16-Frames: Top-Bar (Back + Melden), Top-Left-Stack (Live-Badge + Viewer-Count + Host-Pill + Titel), Top-Right (Poll), Bottom-Left (Chat-Overlay), Bottom (Action-Bar). Kein Sidebar mehr, kein Grid mehr.
- **Ended-State** bleibt erhalten — gleiche Replay-CTA, jetzt innerhalb des 9:16-Frames statt in einem 16:9-Container.

### B2 · Chat-Overlay (`apps/web/components/live/live-chat-overlay.tsx` — NEU)

Komplett neue Komponente, parallel zu `LiveChat` (die Sidebar-Variante bleibt im `LiveHostDeck` weiterhin verwendet).

- **Message-Pills** statt Listrows: `bg-black/55 backdrop-blur-md rounded-2xl ring-1 ring-white/10 text-white` pro Comment. Host-Messages bekommen goldene Tönung (`bg-amber-500/25 ring-amber-300/40`) statt Primary-Color-Text — deutlich sichtbarer auf dem Video-Canvas.
- **Mask-Image-Fade** nach oben: `[mask-image:linear-gradient(to_top,black_55%,transparent_100%)]` (+ `-webkit-mask-image` für Safari/iOS). Ältere Messages blenden optisch in den Video-Canvas aus. Kein visible Scrollbar, kein „zurückscrollen" — stattdessen harter Visible-Cap bei den letzten 30 Messages.
- **Pinned-Message-Pill** sitzt ÜBER der Liste (außerhalb des Mask-Fades), goldfarben — bleibt immer vollständig sichtbar.
- **Pointer-Events-Architektur**: äußerer Container `pointer-events-none`, einzelne Pills & Input explizit `pointer-events-auto`. Das heißt: User kann auf den Video-Canvas hinter dem Chat tappen (z. B. für zukünftige Tap-to-Mute-Gestiken) ohne vom Chat geblockt zu werden.
- **Compose-Zeile**: floating Pill-Input (`bg-black/55 backdrop-blur-md` → focus-state `bg-black/70`) + rosafarbener Send-Circle (`bg-rose-500` → `hover:bg-rose-600`). Slow-Mode-Hinweis im Placeholder statt separate Header-Zeile.
- **Realtime-/Send-/Moderation-Logik** ist funktional identisch zur `LiveChat`-Original (bewusst dupliziert, nicht geshared — Sidebar-Variante lebt noch im Host-Deck, beide Call-Sites sollen unabhängig evolvieren können).

### B5 · Host-Pill (`apps/web/components/live/live-host-pill.tsx` — NEU)

Kompakte Overlay-Pill statt der alten Card-Komponente.

- Layout: `[Avatar 36×36] [Name ✓ / @username] [Folgen]` alles in einer Pill `bg-black/55 backdrop-blur-md ring-1 ring-white/10 rounded-full`.
- Follow-Button: rosa (`bg-rose-500`) für „nicht gefolgt" → klares CTA auf dunklem Canvas. Ab Follow: `bg-white/15 text-white` — zurückhaltend, zeigt „gefolgt"-Status ohne weiter Aufmerksamkeit zu ziehen.
- Optimistic-Update + Rollback (identisch zur alten `LiveHostCard`-Logik).
- Title-/Caption-Anzeige aus der Host-Pill raus — Stream-Titel wandert als eigene Text-Pille unter die Host-Pill im Viewer-Page-Composition.
- **`LiveHostCard` nicht gelöscht** (Dead Code) — kein aktueller Caller mehr, aber behalten falls zukünftig wieder gebraucht oder für Test-Referenzen. Kann in Follow-up gepruned werden.

### B4 · Video-Controls-Relokation (`apps/web/components/live/live-video-player.tsx`)

- Mute + Fullscreen von `bottom-0 right-0 p-3` → `top-14 right-3`. Die alte Bottom-Right-Position kollidierte mit der neuen Action-Bar (`bottom-3 inset-x-3`) und dem Chat-Overlay (`bottom-20 inset-x-3 max-w-md`) — beide füllen jetzt diesen Bereich.
- Top-14 positioniert sie UNTER der Melden-Pill (`top-3 right-3`) und ÜBER dem Poll-Panel (`top-28 right-3`, neu verschoben). Drei-Stufen-Stack rechts oben: Melden → Mute/Fullscreen → Poll.
- Styling aufgefrischt: `bg-black/70 shadow-elevation-1 ring-1 ring-white/10 backdrop-blur-md` — konsistent mit dem neuen Design-Vokabular der Phase 2.

## Was NICHT drin ist

- **B3 · Gift-Animation-Polish**: braucht Lottie- oder Framer-Motion-Dependency + Asset-Lookup — separater PR.
- **B6 · Reaction-Konfetti-Bursts**: Polish auf der bestehenden `LiveReactionOverlay` (float-up Animation) — separater PR wenn Nutzen gemessen ist.
- **LiveHostDeck (Host-Broadcasting-UI)** ist NICHT angefasst — dort wird die alte `LiveChat`-Sidebar-Variante weiterhin verwendet, und das ist korrekt so: der Host braucht detaillierteren Chat-Overview während er publisht, nicht Overlay-Pills.
- **Replay-Page (`/live/replay/[id]`)** ist NICHT angefasst — VOD hat andere UX-Anforderungen (Timeline-Seek, Clip-Marker) als Live.

## Technische Details

- **Keine neuen Dependencies**. Mask-Image via Tailwind-Arbitrary-Values, Gradients native Tailwind, alle sonstigen Utilities bereits in Phase 1 etabliert (`shadow-elevation-*`, `duration-fast/base`, `ease-out-expo`).
- **Keine DB-Änderungen, keine neuen API-Routes, keine Edge-Function-Deploys**.
- **Realtime-Channels unverändert**: `live-comments-{id}` + `live-poll-{poll.id}` — gleiche Subscription-Topologie wie Native + bisherige Sidebar.

## Testing-Plan

**Automated:**
- [x] `tsc --noEmit` → 0 neue Errors in Phase-2-Dateien. Verbleibende 6 Errors sind pre-existing (`lib/data/__tests__/feed.test.ts` TS2322 + `shared/schemas/*.ts` zod-not-found — dasselbe Set wie bei PR #20).
- [ ] `next lint` → lokal durchlaufen (Sandbox-Env kann nicht, registry-403).

**Manual — Checkliste für Reviewer (Desktop + Mobile):**
- [ ] **Layout `/live/[id]` Desktop**: 9:16 Rechteck zentriert mit rounded corners + Shadow, Canvas drumherum dunkel, keine Sidebar mehr.
- [ ] **Layout `/live/[id]` Mobile**: Video-Canvas füllt Viewport (minus SiteHeader), rounded corners fallen weg.
- [ ] **Top-Bar**: Back-Arrow links (Circle-Icon-Only), Melden rechts. Beide `backdrop-blur` sichtbar gegen Video.
- [ ] **Host-Pill**: Avatar + Name + Verified-Tick + Folgen-Button in einer Pill. Follow wechselt optimistic, bei Error Rollback.
- [ ] **Chat-Overlay**: Messages als halbtransparente Pills, älteste blenden nach oben aus. Input unten als Pill, Send-Button rosa Circle.
- [ ] **Chat-Host-Highlight**: Eigene Host-Messages haben goldene Tönung + „Host"-Badge.
- [ ] **Chat-Moderation (als Host/Mod)**: Hover über fremde Message zeigt ShieldAlert-Icon, Click öffnet Timeout-Menu (1/5/10 Min · 1 Std).
- [ ] **Video-Controls**: Mute + Fullscreen oben rechts unter Melden. Kein Overlap mit Chat-Input, Action-Bar oder Poll.
- [ ] **Poll-Panel** (wenn aktiv): top-right unter den Video-Controls, weißer Card-Inhalt auf schwarzer Overlay-Hülle.
- [ ] **Action-Bar**: Ganz unten, `backdrop-blur` Pill. Reactions + Gift + CoHost-Request funktionieren identisch zu vorher.
- [ ] **Ended-State**: Replay-CTA im 9:16-Frame sichtbar, Back-Button funktioniert.

## How to review

Schnellster Weg: `app/live/[id]/page.tsx` ist die Integration — dort sieht man die komplette Overlay-Choreographie auf einen Blick. Dann die beiden neuen Komponenten (`live-host-pill.tsx` + `live-chat-overlay.tsx`) jeweils isoliert — beide sind self-contained. `live-video-player.tsx` hat nur einen kleinen Positions-Shift der Controls.

## Zu committen (Vorschlag)

```
apps/web/app/live/[id]/page.tsx                      # modifiziert (Layout-Rewrite)
apps/web/components/live/live-video-player.tsx       # modifiziert (Controls-Position)
apps/web/components/live/live-chat-overlay.tsx       # neu
apps/web/components/live/live-host-pill.tsx          # neu
```

Nicht mit-committen (untracked, nicht Teil dieses PRs):
`JEST_SETUP_PLAN.md`, `UI_AUDIT_WEB.md`, `UI_PHASE_1_PR_BODY.md`, `apps/web/app/following/`, `coverage/`, `supabase/migrations/20260422010000_fix_nsfw_pg_net_signature.sql`.

## Folge-Aufgaben

- [ ] B3 · Gift-Animation-Polish planen (Lottie-Lib-Auswahl).
- [ ] B6 · Reaction-Konfetti-Bursts (nach User-Feedback entscheiden ob die float-up-Version bleibt).
- [ ] `LiveHostCard` prunen wenn CI-unused-exports-Check auffällt.
- [ ] Phase 3 planen: Shop-Details (C2-C7) oder DM-Thread-Bubbles (D2-D7) aus `UI_AUDIT_WEB.md` — je nach Priorität.
