# WEB_ROADMAP.md — Serlo Web

> Lebendes Dokument. Haken abarbeiten, neue Features nach unten anhängen, alte Entscheidungen dokumentiert lassen.
> Schwester-Dokument zu [CLAUDE.md](./CLAUDE.md) — dort steht die Native-App, hier steht die Web-App.

---

## 🎯 Ziel

Vollständige Web-Version von Serlo mit **Desktop-first Qualität** — kein Mobile-Port im Browser. Zwei Kern-Zielgruppen:

1. **PC-Streamer**: Gamer / IRL-Streamer die vom Desktop live gehen wollen (Screenshare, 1080p60, Multi-Source-Setup, OBS-Kompatibilität).
2. **Online-Händler**: Professionelle Shop-Betreiber die ein Storefront im Shopify/Etsy-Niveau erwarten (Katalog-Management, Orders, Analytics).

Zusätzlich: alle Features der Native-App (Feed, Live-Viewer, Gifts, Polls, Messaging, Stories, Guilds, Creator-Studio) vollständig im Browser nutzbar — SEO-optimiert damit Profile und Streams googelbar sind.

---

## 🏗️ Architektur

| Bereich | Entscheidung |
|---|---|
| **Struktur** | `apps/web/` (Next.js) neben bestehender Native-App im selben Repo. `shared/` am Root für Types + Client-Helpers. |
| **Framework** | **Next.js 15 App Router** mit React Server Components |
| **UI** | Tailwind CSS + shadcn/ui (Radix-Primitives). Dark/Light wie Native. |
| **Sprache** | TypeScript strict, exakt wie Native. |
| **Backend** | **Gleiche Supabase-Instanz** wie Native — Auth, DB, RLS, Realtime, Storage, Edge Functions. Zero Backend-Änderung. |
| **Auth** | `@supabase/ssr` für Server-Cookies + Middleware-Refresh. SSO zwischen Native und Web über Magic-Links + OAuth. |
| **Live-Streaming** | **LiveKit Web-SDK** (`livekit-client`) — Viewer UND Host. WHIP-Ingest für OBS-Streamer. |
| **Video-Player** | HLS.js für Replays + Posts. |
| **Payments** | **Stripe Checkout** (Web) — nicht RevenueCat. Webhook → `coin_transactions`. |
| **Forms** | React Hook Form + Zod (Schemas teilen wir mit Native). |
| **State** | TanStack Query v5 (wie Native). Zustand nur wenn UI-lokal nötig. |
| **Deploy** | Vercel (Preview-Deploys pro PR, auto-Domain). |
| **Monitoring** | Sentry (shared Org mit Native). |
| **Analytics** | PostHog (privacy-friendly, self-hostable später). |
| **i18n** | `next-intl` — DE / RU / CE / EN (wie Native). |

### Was wir NICHT bauen (und warum)

- **Kein react-native-web / Expo Web** — Mobile-Gefühl im Browser, inkompatibel mit „Desktop-first Shop + Streamer-UX".
- **Keine Monorepo-Tooling (Turborepo/Nx)** initial — Over-Engineering. `shared/` mit relativen Imports reicht bis wir Build-Probleme sehen.
- **Kein Custom-Design-System** — shadcn/ui + Tailwind sind der schnellste Weg zu „professionell". Wir branden über Farben + Typografie.
- **Keine eigene Backend-Schicht** — alles via Supabase. Web + Native teilen sich dieselben RLS-Policies, RPCs, Edge Functions.

---

## 📁 Ziel-Projektstruktur

```
vibes-app/
├── app/                  # Native Expo Router (bleibt unverändert)
├── lib/                  # Native Hooks (bleibt)
├── components/           # Native Components (bleibt)
├── supabase/             # Migrations + Edge Functions (shared)
│
├── apps/
│   └── web/              # NEU: Next.js 15 Web-App
│       ├── app/          # App-Router (root-layout, marketing, (authed)/...)
│       ├── components/   # Web-spezifische UI (shadcn + custom)
│       ├── lib/          # Web-Hooks (use query wrappers, supabase ssr)
│       ├── public/       # Assets (og-images, favicons)
│       └── middleware.ts # Supabase-Session-Refresh
│
└── shared/               # NEU: Cross-Platform-Code
    ├── types/            # TypeScript-Interfaces (Product, LiveSession, Gift, Poll, ...)
    ├── schemas/          # Zod-Schemas (Form-Validation beide Seiten)
    ├── catalog/          # gifts.ts (Geschenke-Katalog)
    ├── moderation/       # liveModerationWords (DE/EN/RU/CE)
    └── supabase/         # client.ts (environment-agnostic helpers)
```

---

## 🗺️ Roadmap

Phasen laufen grob sequenziell, weil jede auf der vorherigen aufbaut. Innerhalb einer Phase können Items parallel laufen. Jede Phase hat ein **Done-Criterion** — erst wenn das erfüllt ist, gilt die Phase als abgeschlossen.

---

### Phase 0 — Foundation ✅

**Done-Criterion**: `npm run dev` im `apps/web` bringt eine Seite auf `localhost:3000`, Sentry + PostHog fangen Events, Vercel-Preview-Deploy für PRs läuft.

- [x] `apps/web/` Next.js 15 initialisieren (App Router, TypeScript strict, Tailwind) — manuell scaffolded, nicht via `create-next-app`
- [x] `shared/` Top-Level-Ordner anlegen, `shared/types/` + `shared/schemas/` + `shared/theme/` + `shared/catalog/` + `shared/moderation/` skeleton
- [x] Path-Aliase in `tsconfig.json` (Web): `@/*` → `./`, `@shared/*` → `../../shared/*`
- [x] Tailwind-Config: Farb-Palette aus Native-Theme portiert als CSS-Variablen (HSL) in `globals.css`, Dark/Light via `.dark` Class-Selector
- [x] shadcn/ui init + erste Primitives (Button, Dialog, Avatar) — weitere (Sheet, DropdownMenu, Input, Label, Skeleton) in Phase 1 nach Bedarf
- [x] `lib/supabase/client.ts` (Browser), `lib/supabase/server.ts` (Server Components), `lib/supabase/middleware.ts` (Session-Refresh)
- [x] `middleware.ts` am Root: Supabase-Auth-Cookies refreshen auf jedem Request + Protected-Route-Gate (`/studio`, `/messages`, `/settings`, `/create`)
- [x] `.env.local.example` mit allen benötigten Keys (SUPABASE, LIVEKIT, STRIPE, SENTRY, POSTHOG, R2)
- [ ] Sentry `@sentry/nextjs` konfigurieren, shared Org mit Native — Package installiert, Config kommt in Phase 1
- [x] PostHog `posthog-js` konfigurieren, Page-Views manuell auf Route-Change
- [ ] Vercel-Projekt verbinden, Env-Vars setzen, erste Preview-URL bekommen — benötigt manuelle Schritte vom User
- [ ] Domain kaufen / verbinden (z.B. `serlo.app`, `serlo.live`, `serlo.social` — du entscheidest)
- [x] Root-Layout mit HTML-Lang + Theme-Provider (next-themes) + Toaster (sonner) + QueryClient (TanStack) + PostHog-Provider

### Phase 1 — Auth & Onboarding ✅

**Done-Criterion**: User kann sich mit Native-Account im Web einloggen, Profil erscheint oben rechts, Logout funktioniert. Neue User können sich registrieren.

- [x] `/login` — Magic-Link (Email-OTP) + Google-OAuth + Apple-OAuth Buttons, Fehler-Darstellung bei Callback-Failure, Re-Send-Option nach „Link unterwegs"-State
- [x] `/signup` — gleiche Surface wie Login (Magic-Link ist passwordless und macht Sign-Up automatisch), plus Legal-Hinweise (Terms + Privacy)
- [x] `/onboarding` — Username-Picker mit debounced Live-Availability-Check (400ms), „Verfügbar/Vergeben/Ungültig"-Indikatoren, Username ist nach Claim nicht änderbar (dokumentiert im UI)
- [x] `/auth/callback` Route-Handler — PKCE code-exchange, Profile-Check, Onboarding-Gate, Open-Redirect-Schutz auf `?next=`
- [x] Auth-Middleware: Protected Routes (`/studio`, `/messages`, `/settings`, `/create`) redirecten zu `/login?next=…`
- [x] Server-Actions-Layer (`app/actions/auth.ts`): `signInWithMagicLink`, `signInWithOAuth('google'|'apple')`, `claimUsername`, `checkUsernameAvailable`, `signOut`. TOCTOU-Guard im Username-Claim (Re-Check Server-Side, Own-Username darf behalten werden).
- [x] SSR Auth-Helper (`lib/auth/session.ts`): `getUser()` + `getProfile()` mit React-`cache()` für Request-Level-Memoization, plus `requireUser()` als Throw-Variante.
- [x] `SiteHeader` Component: Logo links, Coins-Balance-Pill + Avatar-Dropdown rechts wenn eingeloggt (Profil-Link / Einstellungen / Abmelden), sonst „Einloggen" + „Account erstellen" CTAs. Sticky + Backdrop-Blur.
- [x] shadcn-Primitives nachgezogen: `Input`, `Label`, `Form` (react-hook-form + Zod-Integration), `DropdownMenu`. OAuth-Buttons als eigene Client-Component mit inline Google-SVG + Apple-Glyph.
- [x] OAuth-Setup-Anleitung (`apps/web/docs/oauth-setup.md`): Google Cloud Console Flow, Apple Developer Services-ID + .p8-Key Secret-Gen, Production-URL-Config, Troubleshooting-Sektion für typische Fehler (`redirect_uri_mismatch`, `invalid_client`).

**Bewusst deferred auf spätere Phasen**:
- Avatar-Upload zu Supabase Storage → Phase 3 (Profil-Edit)
- Interests-Picker in Onboarding → Phase 3 (algorithmic Feed braucht erst Grundlagen)
- `useCurrentUser()` Client-Hook mit Realtime auf `profiles` → Phase 2 (wird relevant wenn Client-Components Profil-Updates live zeigen müssen)
- Passwort-Reset-Flow → nicht nötig (Magic-Link ist passwordless)
- Error-Boundary → Phase 12 (Polish) — aktuell fangen Server-Actions die Fehler explizit ab

**Sentry/Vercel/Domain (weiterhin manuell durch Zaur)**: Sentry-DSN in `.env.local` eintragen, Vercel-Deploy-Hook verbinden, Domain kaufen. Wird nachgezogen sobald relevant.

### Phase 2 — Public SEO Pages (Profile + Posts) ✅

**Done-Criterion**: `serlo.app/u/zaur` rendert server-side mit OG-Tags, ist in Google indexierbar, Videos spielen im Browser.

- [x] `/u/[username]` — Profil-Page (SSG+ISR, 60s-Revalidate)
  - Bio, Follower-Count, Post-Grid (3-col, 9:16, View-Count-Overlay), Tabs (Posts/Likes/Shop/Battles)
  - OG-Image dynamisch generiert via `next/og` (Next.js 15 nativ, kein `@vercel/og` extra)
  - Follow-Button als Stub (echte Mutation kommt mit Phase 3)
  - JSON-LD `ProfilePage` + Canonical-Tag
  - `/u/[username]/not-found.tsx` — freundliche 404-Seite
- [x] `/p/[postId]` — Post-Page mit Video-Player, Kommentare (read-only ohne Login), Share-Buttons
  - HLS-Player mit Dynamic-Import von `hls.js` (spart Bundle für Safari/iOS, die HLS nativ können)
  - Poster-Image, Loop=false für VOD, `preload=metadata`
  - Caption + Hashtags (linked zu `/t/[tag]` — kommt Phase 3) + Sound-Hint
  - JSON-LD `VideoObject` mit `InteractionCounter` für Views+Likes
  - ShareButtons-Component: Web Share API + Copy + WhatsApp/Telegram/X (inline SVG, keine CDN-Deps)
  - Twitter-`card: player` Metadata für Inline-Preview in X-Feeds
- [x] `/s/[storyId]` — Story-Viewer (ephemere 24h-Regel respektieren)
  - `getStory` prüft `expires_at` server-side → `null` wenn abgelaufen → `notFound()`
  - `revalidate: 0` + `dynamic: 'force-dynamic'` — Stories dürfen NIE gecacht ausgeliefert werden
  - `robots: noindex` in Metadata (ephemer — soll nicht permanent in Google indexiert sein)
  - Countdown-Anzeige „läuft in X Std Y Min ab"
- [x] `sitemap.xml` + `robots.txt` (dynamisch aus öffentlichen Profilen + Posts)
  - Top-1000 Profile nach Follower-Count + Top-5000 Posts nach view_count
  - `/auth/`, `/settings`, `/onboarding`, `/s/` vom Crawl ausgeschlossen
  - `revalidate: 3600` — 1× stündlich frisch
- [x] `/404` + `/500` Custom-Pages mit Brand-Look
  - `app/not-found.tsx` als globales 404 (existierte)
  - `app/error.tsx` als globales Error-Boundary — Sentry-compat via `error.digest`
- [x] Landing-Page Discovery-Strip: 6 Top-Creator-Badges → `/u/[username]` (ankert SEO-Crawl-Graph)

### Phase 3 — Feed (Timeline)

**Done-Criterion**: Eingeloggter User sieht auf `/` einen endlosen Video-Feed mit denselben Ranking-Algorithmen wie Native. Like + Kommentar funktioniert.

- [x] `/` (Home) — Für-Dich-Feed + Following-Feed als Tabs
- [x] Desktop-Layout: zentrierte Vertikal-Videos (9:16), Sidebar links (Kategorien), Sidebar rechts (Suggested Follows)
- [x] Auto-Play mit Intersection-Observer (pause wenn out-of-view)
- [x] Keyboard-Navigation: `J/K` next/prev, `L` like, `M` mute, `Space` pause
- [x] Like + Kommentar + Share + Save (alle bestehenden RPCs wiederverwenden)
- [x] Kommentar-Thread in Sheet-Component (rechts ausfahrend)
- [x] Follow-Button mit Optimistic-Update
- [x] `/explore` — Discover-Grid (trending Hashtags, Musik, Effekte falls genutzt)
- [x] `/search` — Multi-Tab-Suche (Users, Posts, Hashtags, Sounds)

### Phase 4 — Shop (Professional Storefront)

**Done-Criterion**: Käufer findet Produkte über Kategorien + Suche, sieht professionelle Produkt-Seiten, kauft mit Coins oder Stripe-Fiat, Händler verwaltet Produkte im Studio.

**Käufer-Seite:**
- [x] `/shop` — Katalog-Grid mit Filtern (Kategorie, Preis-Range, „nur Sale", Location, Frauen-only)
- [x] Desktop-Layout: 4-Spalten-Grid auf `lg`, 6-Spalten auf `2xl`, Filter-Sidebar links
- [x] Facetten-Filter via URL-Params (SEO-freundlich)
- [x] `/shop/[id]` — Produkt-Detail
  - Bild-Carousel mit Thumbnails (wie Native, aber mit Hover-Zoom)
  - Sale-Badge, Preis mit Rabatt-Anzeige, Gratis-Versand-Pill, Location
  - Quantity-Stepper, „Jetzt kaufen" + „Merken"
  - Seller-Karte mit Chat-Button + „Shop besuchen"
  - Bewertungen + Q&A (neu, nicht in Native)
  - Related-Products-Grid unten
- [x] `/u/[username]/shop` — Händler-Storefront (alle seine Produkte)
- [x] Saved-Products (`/shop/saved`)
- [x] Merchant-Rating-System (neu — wichtig für Professional-Look)
- [x] Bewertungen schreiben nach Kauf

**Händler-Seite (Merchant-Studio):**
- [x] `/studio/shop` — Produkt-CRUD-Dashboard
  - Row-Liste mit per-Row-Actions (aktivieren/deaktivieren, löschen, Edit)
  - KPI-Cards: Produkte, Aktiv, Verkauft, Umsatz
- [x] `/studio/shop/new` — Produkt-Create-Formular (URL-basierter Bild-Input — echte Drag-Drop-Upload auf R2 kommt Phase 8)
  - Server-Actions + Zod, Live-Preview rechts
  - Sale-Preis mit Live-Prozent-Anzeige
  - Gratis-Versand-Switch, Location-Freitext
  - Women-Only-Flag
- [x] `/studio/shop/[id]/edit` — Edit-Form (gleicher `<ProductForm>` shared Component)
- [x] `/studio/orders` — Bestellungs-Liste mit Role-Toggle (Käufe/Verkäufe), Status-Dropdown für Händler
- [x] `/studio/shop/analytics` — Umsatz-Ranking pro Produkt mit Revenue-Bars + Stars + Review-Counts

**Backend-Erweiterungen (Supabase):**
- [x] Tabelle `product_reviews` (bereits aus Native) — DB-Trigger-Aggregation auf `products.avg_rating`/`review_count`
- [x] Tabelle `orders` (bereits aus Native) — Status (pending/completed/cancelled/refunded), `total_coins`, `delivery_notes`, `download_url`
- [x] RLS-Policies bereits konfiguriert (Native-Parität)

### Phase 5 — Live Viewer

**Done-Criterion**: User öffnet `/live/[id]`, sieht den Stream in hoher Qualität, chattet, sendet Reactions + Gifts, stimmt in Polls ab.

- [x] `livekit-client` Integration — Room.connect, subscribe to Host-Tracks, render `<video>`-Element
- [x] `/live/[id]` — Viewer-UI
  - Video-Player zentriert, Desktop-Layout: Chat rechts permanent sichtbar (nicht Overlay), Info links
  - Viewer-Count, Follow-Button, Report
- [x] Chat via Supabase-Broadcast-Channel (gleicher Channel-Name wie Native)
- [x] Comment-Send mit Moderation (liest `live_sessions.moderation_words` + globale Liste)
- [x] Reactions via Emoji-Strip unten (6 Reactions: heart/fire/clap/laugh/wow/sad mit Float-Up-Animation)
- [x] Gifts: `GiftPicker`-Web-Version (Bottom-Sheet mit Katalog aus `live_gift_catalog`, Recipient-Switch für CoHost-Duet-Modus)
- [x] Gift-Animation-Overlays (CSS-Keyframe basierte Floating-Icons; Lottie-Worker-Integration verschoben bis größerer Performance-Bedarf nachweisbar ist)
- [x] Live-Polls anzeigen + voten (Realtime-Vote-Counts über `postgres_changes`, Dedup via RPC)
- [x] Coin-Balance im GiftPicker-Header
- [x] CoHost-Request-Button (Broadcast auf `co-host-signals-{id}` — gleicher Channel wie Native)
- [x] Replay-Player `/live/replay/[id]` mit Clip-Markers (Seek-Chips unter dem Player)

### Phase 6 — Live Host (PC-Streamer — das Hauptdifferenzierungs-Feature)

**Done-Criterion**: Ein Gamer öffnet `/live/start`, wählt Screenshare + Webcam + Mic, geht live in 1080p60 — bessere Qualität als Mobile. Alternativ: OBS-Streamer können via WHIP publishen.

- [x] `/live/start` — Setup-Screen (Preview, Titel, Kategorie, Moderation-Toggle, Device-Picker)
- [x] `/live/host/[id]` — Host-Control-Deck (OBS-ähnlich)
  - **Layout**: Preview oben, Sources+Health+CoHost-Queue+Gifts mittig, Chat rechts (Desktop-Split mit Sticky-Topbar für LIVE-Status / Duration / Viewer-Count / End-Button)
  - **Sources**: Webcam, Screenshare (mit System-Audio falls Browser erlaubt), Mic, Device-Switcher mit `devicechange`-Listener
  - **Controls**: Go-Live/End, Cam-Toggle, Mic-Toggle, Screenshare-Toggle, Title-Inline-Edit
  - **Moderation-Panel**: Reuse LiveChat mit `isModerator={true}` → Slow-Mode/Timeout/Pin-Button-Render aus Phase 5 greift automatisch für Host
  - **CoHost-Queue**: Broadcast-Subscribe auf `cohost-request` → Accept mit automatischem Slot-Index-Lookup (1/2/3), Reject, aktive CoHosts mit Mute-Audio/Mute-Video (via `livekit-moderate` Edge-Fn) + Kick
  - **Polls**: `LivePollStartSheet` Web-Version — Frage (3-140), 2-4 Optionen, Laufzeit 1/3/5 Min. Pre-Close von laufender Poll (v1.27.4-Pattern). Aktive-Poll-View zeigt Live-Balken mit Vote-Counts
  - **Gifts-Feed**: Realtime-Liste der letzten 20 Gifts, Aggregat Top-Supporter, optionales Coin-Goal mit Progress-Bar + Celebrate-State bei Erreichen
  - **Stream-Health**: LiveKit `getRTCStatsReport` Polling alle 2s → Video-Bitrate (kbps), FPS, Audio-Bitrate, ConnectionQuality-Badge (Excellent/Gut/Schlecht/Verloren)
- [x] LiveKit-Token-Edge-Function unterstützt schon `canPublish` — keine Backend-Änderung nötig (Host wird anhand host_id === JWT-sub erkannt)
- [ ] **OBS-WHIP-Ingest**: Edge-Function erzeugt einen persistenten WHIP-Endpoint-URL + Stream-Key; Streamer kopiert in OBS — vertagt auf Phase 6b (separate Release, braucht LiveKit-Cloud-Config)
- [x] `/studio/live` — vergangene Streams + Resume-Link für aktive Session + Replay-Karten mit Thumbnail/Dauer/Peak
- [x] Keyboard-Shortcuts für Host: `M` mute mic, `V` toggle cam, `S` screenshare, `E` end (mit Input-Guard damit Chat-Tipps nicht triggern)
- [x] Heartbeat alle 30s via `heartbeat_live_session` RPC (v1.27.0-Pattern, verhindert Zombie-Cleanup durch Cron)
- [x] Device-Prefs-Übergabe von `/live/start` → `/live/host/[id]` via `sessionStorage` unter Key `live-host-prefs-${sessionId}` (nicht URL-Query, da deviceIds Privat-Hinweise sind)

### Phase 7 — Messaging (DMs)

**Done-Criterion**: User sieht Conversation-Liste links, offenes Chat rechts, Realtime-Messages, Typing-Indicator, Media-Attachments.

- [x] `/messages` — Konversations-Liste (SSR mit letztem Message-Preview + Unread-Badges + Story-Ring-freundlicher 60×60-Avatar)
- [x] `/messages/[id]` — Thread-View mit Header, scrollbarem Message-Feed, Composer + Day-Separators
- [x] Realtime-Subscription auf `messages` Tabelle (Channel-Name `messages-{id}` → Cross-Platform-Parität mit Native)
- [x] Typing-Indicator via Supabase Presence-Channel `typing-{id}` (3s Auto-Stop)
- [x] Read-Receipts (✓/✓✓ auf Bubbles, Sync on-mount + on-focus via `mark_messages_read` RPC)
- [x] Reactions auf Messages (6-Emoji-Set mit Long-Press-Picker, Realtime-Refresh über `message_reactions`-Table)
- [x] Soft-Delete eigener Messages (RLS: `sender_id = auth.uid()`)
- [x] Self-Chat „Meine Notizen" (participant_1 = participant_2, Bookmark-Icon im Avatar)
- [x] Product-Share via `/messages/[id]?productId=…` (Deeplink vom Shop-Chat-Button, v1.26.5-Parity)
- [x] Chat-Button in der Seller-Karte auf `/shop/[id]` (öffnet/erstellt DM, pusht mit productId)
- [ ] Media-Upload (Bild/Video) → Phase 7b
- [ ] Voice-Messages recording + Waveform-Preview → Phase 7b
- [ ] Message-Search in Conversation → Phase 7b
- [ ] Notifications-Badge im Header → Phase 7b (brauche Header-Slot + Poll-Hook auf `getUnreadDMCount`)
- [ ] Infinite-Scroll für ältere Messages (initial-Load 80, danach per Scroll-up-Trigger) → Phase 7b

### Phase 8 — Create (Upload-Flow) ✅

**Done-Criterion**: User lädt Video hoch, schneidet optional, fügt Caption/Hashtags hinzu, published. Funktioniert auch als Draft + Scheduled.

- [x] `/create` — Upload-Drop-Zone (Drag-Drop + File-Picker)
- [x] Direkter PUT-Upload zu Cloudflare R2 via presigned URL (`r2-sign` Edge Function — identisch zur Native-Signing-Pipeline)
- [x] Browser-Video-Preview vor Upload (trimmen optional via `ffmpeg.wasm` — Phase-8b)
- [x] Cover-Frame-Picker (Scrubber auf Video, Canvas-Frame-Extract → separater R2-Thumb-Upload)
- [x] Caption-Editor mit Hashtag-Autocomplete + Mention-Autocomplete (inline Dropdown, Pfeiltasten/Enter/Tab)
- [ ] Music-Picker → Phase 8b (Native-`MUSIC_LIBRARY` ist hardcoded, braucht Web-Copy + Player-Preview)
- [ ] Effekte: initial nicht portiert (Skia-only) — Web bekommt nur Filter-Presets via CSS/WebGL → Phase 8b
- [x] Privacy-Setting (public/friends/private), Allow-Comments, Allow-Duet, Allow-Download, Women-Only
- [x] Schedule-Button → DatePicker + Preset-Chips → Native-RPC `schedule_post`
- [x] Draft-Save → Native-RPC `upsert_post_draft`
- [x] `/create?draftId=...` Resume-Editing (SSR-lädt Draft-Row, preseted Editor-State)
- [x] `/create/drafts` — Cloud-Drafts-Liste mit Resume-/Löschen-Actions
- [x] `/create/scheduled` — geplante Posts mit Umplanen/Abbrechen-Actions + Status-Pills (pending/publishing/published/failed/cancelled)

### Phase 9 — Creator Studio (Web-Exklusiv größer als Native)

**Done-Criterion**: Creator hat ein Desktop-Dashboard mit allen Daten die in Native nur limitiert sichtbar sind. Peak-Hours-Heatmap, Scheduled-Posts-Liste, Drafts-Liste, Revenue-Charts.

- [x] `/studio` — Dashboard-Start (Overview mit KPI-Cards)
- [x] `/studio/analytics` — Detaillierte Charts (Views über Zeit, Watch-Time, Audience-Demographics)
- [x] `/studio/scheduled` — Geplante Posts mit Calendar-View (Monat/Woche)
- [x] `/studio/drafts` — Cloud-Drafts (Alias auf `/create/drafts`)
- [x] `/studio/live` — vergangene Live-Streams + Replays + deren Analytics (bereits in v1.w.5 geliefert)
- [x] `/studio/revenue` — Gift-Einnahmen + Shop-Einnahmen + Coupon-Performance
- [ ] `/studio/payouts` — Auszahlungs-Historie (wartet auf Phase 10 Stripe-Integration)
- [x] `/studio/moderation` — Global-Blocklist (User ich nicht mehr sehen will)
- [x] Export nach CSV für Accounting (Shop-Orders via `/studio/revenue/export.csv`)

### Phase 10 — Payments (Stripe Integration)

**Done-Criterion**: User kauft Coins mit Kreditkarte über Stripe Checkout, Coins landen in `coin_transactions`, Balance-Update ist Realtime.

- [x] `/coin-shop` — Web-Version mit Stripe Checkout
- [x] Edge Function `stripe-webhook` — schreibt in `coin_transactions`
- [x] Edge Function `create-checkout-session` — generiert Stripe-Session-URL
- [x] Web-vs-Native-Pricing: Web bekommt ~20% mehr Coins fürs gleiche Geld (keine App-Store-Fees) — Incentive-Hebel
- [x] Apple-Pay + Google-Pay via Stripe Payment Request
- [x] Invoice-PDFs automatisch generiert (für Händler wichtig)
- [x] `/settings/billing` — Zahlungsmethoden, History, Invoices
- [x] Creator-Tips (optional): Viewer können ohne Gift einen direkten Tip senden

### Phase 11 — Guilds + Stories

**Done-Criterion**: User findet + joint Guilds, Stories werden horizontal oben im Feed angezeigt wie TikTok/Instagram.

- [x] `/guilds` — Pod-Discovery mit 5 fixen Pods, „Dein Pod"-Highlight, Vibe-Tags + Member-Count
- [x] `/g/[id]` — Pod-Detail mit Top-Posts (30d, 3-col-Grid), Top-Creators-Leaderboard, Members-Grid (48), About-Card. Events + Chat als „kommt bald"-Placeholder (DB hat dazu noch keine Tabellen)
- [x] Pod-Switch mit 24h-Cooldown (`last_guild_switch_at` in `profiles`, graceful Fallback wenn Spalte fehlt)
- [x] Story-Strip oben im Feed (horizontaler Ring-Carousel, Gradient-Ring bei ungesehenen, Plus-Badge auf eigener Card)
- [x] `/stories/[userId]` — Story-Viewer mit Auto-Progress-Timer (5s Image / 10s Video), Keyboard-Shortcuts (←/→/Esc/Space), Prev/Next-Nav zwischen User-Gruppen, `markStoryViewed` nach 1s, Delete-Button für eigene Stories
- [x] `/stories/new` — Story-Creator (Bild/Video-Upload zu R2, optional Poll mit 2 Optionen, 9:16 Preview, XHR-Progress)
- [x] Sidebar-Nav: „Pods" Eintrag in `FeedSidebar`
- ⚠️ **Route-Abweichung**: Roadmap spezifizierte `/g/[guildSlug]` + `/s/[storyId]` Viewer. Schema hat kein `slug`-Feld → UUID-Routing `/g/[id]`. `/s/[storyId]` ist bereits Phase-8-SEO-Permalink → Viewer liegt unter `/stories/[userId]` um Kollisionen zu vermeiden.
- ⚠️ **Deferred**: `/g/[id]/events` (DB-Schema für Events fehlt), Guild-Chat (ebd.), Text-Overlay im Story-Creator (Canvas-Rendern — v1.w.12-Scope)

### Phase 12 — Polish & Production-Readiness

**Done-Criterion**: App ist für Public-Launch bereit — i18n komplett, PWA installierbar, Web-Push läuft, A11y-Audit bestanden.

- [ ] i18n (DE/RU/CE/EN) mit `next-intl`, übersetzte Strings shared mit Native
- [x] PWA-Manifest + Service-Worker (manuell, ohne `next-pwa`) — v1.w.12.1
- [~] Web-Push via VAPID — Subscribe + DM-Push live (v1.w.12.4), Follower-geht-live + Gift-Received deferred
- [~] A11y-Audit (Axe DevTools, Lighthouse ≥ 95) — Foundation-Pass (Skip-Link, Landmarks, Icon-Button-Sweep, Focus-Visible-Baseline) in v1.w.12.6; Axe-Audit auf Preview-Deploy + View-spezifische Fixes offen
- [~] Performance: Lighthouse ≥ 90 alle Metriken, Bundle-Budgets — Bundle-Analyzer verdrahtet, Dead-Deps raus, `<img>` → `next/image`, PostHog Consent-First-Load (v1.w.12.5); Lighthouse-Audit + Budget-Konfig offen
- [x] Open-Graph + Twitter-Card-Tags für jeden shareable-View — v1.w.12.2
- [x] Cookie-Consent-Banner (DSGVO — essential/analytics/marketing toggles) — v1.w.12.1
- [x] GDPR-Data-Export + Account-Deletion UI — v1.w.12.1
- [x] Error-Tracking komplett durchverbunden (Sentry Releases + Source-Maps) — v1.w.12.3
- [ ] Status-Page (z.B. `status.serlo.app`)
- [x] Terms-of-Service + Privacy-Policy + Impressum Pages — v1.w.12.1

---

## 🚀 Launch-Strategie

- **Alpha** (Phase 0-3 fertig): interne Nutzer + eng Inner-Circle. Feedback auf Auth/Feed/Navigation.
- **Beta** (Phase 4-7 fertig): Public-Beta mit „Web-Beta"-Badge. Shop + Live-Viewer + DMs geht.
- **Soft-Launch** (Phase 8-10 fertig): Create-Flow + Host-Go-Live + Payments läuft. Offiziell „Web-Version verfügbar".
- **GA** (Phase 11-12 fertig): Alles polished, SEO indexiert, Push läuft, A11y sauber.

---

## 📝 Änderungs-Log

Wie in CLAUDE.md: neue Einträge oben, ältere nach unten. Format: `v1.w.X — Kurz-Titel`, dann Checkliste unten mit `- [x]`.

### v1.w.12.6 — A11y-Foundation: Skip-Link, Landmarks, Icon-Button-Sweep, Focus-Visible-Baseline (2026-04-20)

**Scope**: Foundation-Pass für WCAG-2.1-AA-Compliance, damit der eigentliche Axe-Audit (braucht Preview-Deploy) nicht gleich mit 50+ Findings geflutet wird. Vier konkrete Wins mit App-weitem Impact — keine per-View-Audits, die kommen in separaten Slices nach dem ersten Deploy.

**Entscheidung gegen „A11y-Audit JETZT"**: Lighthouse-A11y ≥ 95 ist das finale Phase-12-Done-Criterion, aber Axe DevTools läuft sinnvoll nur auf deployed URLs mit realem DOM — `next build && next start` lokal gibt schief gewichtete Kontrast-Ratings wegen Dev-Hydration-Flash. Foundation fixen wir deshalb blind-im-Voraus nach bekannten Patterns, Audit folgt post-Deploy.

**Entscheidung gegen Web-Push-Trigger-Fanout**: v1.w.12.4 hat explizit das Gate „weitere Triggers (Follow/Live/Gift/Like/Comment) erst nach Production-Metrics zeigen dass DM-Push sauber zustellt" gesetzt. Das bewusste Warte-Gate halte ich ein — mechanisches Rüberziehen der Triggers ohne Feedback wäre gegen die eigene Design-Entscheidung.

- [x] **Discovery-Baseline**: 0 Skip-Links im Repo, nur 5 `sr-only`-Uses (indikativ für Icon-Only-Buttons ohne SR-Text), 40 `aria-label`-Uses verteilt über 19 Button-heavy Files. `<html lang="de">` war bereits gesetzt (aus v1.w.12.1), `<main>`-Landmarks in 10+ Page-Files bereits vorhanden.

- [x] **Skip-to-Content-Link** (`app/layout.tsx`): `<a href="#main-content">` ganz oben im Root-Layout, via `sr-only focus:not-sr-only` versteckt bis Keyboard-Focus (Tab von Top) — dann springt sichtbar oben-links rein mit Background + Ring. Ziel: ein neuer `<div id="main-content" tabIndex={-1}>`-Wrapper um `{children}`. Bewusst KEIN `<main>` auf Layout-Ebene, weil bestehende Pages (settings, studio, shop, explore, search, u/[username], s/[storyId]) eigene `<main>`-Tags haben — nested `<main>` wäre invalid HTML + Duplicate-Landmark-Warning in Axe. `tabIndex={-1}` macht den Div zum programmatischen Focus-Target ohne normale Tab-Reihenfolge-Aufnahme.

- [x] **Icon-Only-Button-Sweep auf 6 Hot-Path-Files**: Priorisiert nach Touch-Häufigkeit der User-Pfade — nicht alle 19 Files blindsweepen, sondern die wo User oft klicken.
  - `components/site-header.tsx`: Coins-Balance-Link nutzte `title=` (nur Mouse-Tooltip — viele Screenreader ignorieren `title`) → jetzt `aria-label="{N} Coins — aufladen"` mit formatierter Zahl. Inner-Spans mit `aria-hidden="true"` damit SR nicht "Coins 1234 plus" liest (Icon + Zahl + Plus-Symbol gäbe 3 separate Ansagen).
  - `components/feed/feed-card.tsx`: `ActionButton` las nur Count-Label vor ("12K") — SR wusste nicht ob Like/Comment/Share-Button. Neuer optionaler `ariaLabel`-Prop pro Call-Site mit klarem Aktions-Text + Count: `"Liken — 12K Likes"`, `"Kommentare öffnen — 34 Kommentare"`, `"Aus Merkliste entfernen"`, `"Teilen — N mal geteilt"`, `"Stummschalten"` / `"Ton einschalten"` (context-abhängig). Visuelles Count-Label bleibt gleich, bekommt aber `aria-hidden="true"` weil es über `ariaLabel` bereits enthalten ist. Music-Icon + Play-Overlay dekorativ → `aria-hidden`.
  - `components/feed/comment-sheet.tsx`: Send-Button `aria-label="Senden"` → `"Kommentar senden"` (spezifischer). Send/Heart-Icons `aria-hidden`.
  - `components/live/live-action-bar.tsx`: Reactions-Buttons hatten bereits `aria-label={label}` — Icons bekamen `aria-hidden`. Gift/CoHost-Buttons haben sichtbaren Text → kein Extra-Label nötig.
  - `components/live/live-chat.tsx`: Send-Button + Mod-Button hatten bereits `aria-label` — Icons `aria-hidden`. Clock-Icon im Slow-Mode-Badge dekorativ → `aria-hidden`.
  - `components/messages/message-thread.tsx`: Fehlende Labels gefixt: Reply-Cancel-Button `aria-label="Antwort abbrechen"`, Send-Button `"Senden"` → `"Nachricht senden"`, Reaction-Button `"Reaktion hinzufügen"` → `"Emoji-Reaktion hinzufügen"`. Mehrere Icons (X, CornerDownRight, Send) bekamen `aria-hidden`.

- [x] **Globale Focus-Visible-Baseline** (`app/globals.css`): Neue `@layer base`-Regel für `a:focus-visible, button:focus-visible, [role="button"]:focus-visible, [tabindex]:focus-visible, summary:focus-visible` → `outline-none ring-2 ring-ring ring-offset-2 ring-offset-background`. Kritisch: `:focus-visible` (nicht `:focus`) — Mouse-Klicks triggern keinen Ring, nur Keyboard-Tab. In `@layer base` damit Utility-Klassen höherer Specificity (`focus-visible:ring-white` auf dunklen Overlays etc.) die Baseline überschreiben können. shadcn/ui-Button hatte bereits inline `focus-visible:ring-ring`, ist von dieser Regel damit nicht betroffen — sie greift NUR dort wo keine expliziten Focus-Styles gesetzt sind.

- [x] **Warum `aria-hidden` auf Icons wichtig ist**: Lucide-Icons sind SVG mit oft implizitem `<title>`-Fallback. Ohne `aria-hidden` werden sie vom Screenreader als "image" angesagt, ZUSÄTZLICH zum Button-`aria-label` — „Like-Button. Image. 12K Likes" statt klarem „Liken — 12K Likes". Bei Icon+Text-Kombi noch schlimmer: „Send. image. Senden-Button" statt „Nachricht senden".

- [x] **Typecheck**: `npx tsc --noEmit` → 24 Errors, **0 neue aus v1.w.12.6-Code**. Baseline unverändert gegenüber v1.w.12.5.

- [x] **Bewusst NICHT in v1.w.12.6**: (a) Axe DevTools Vollaudit (braucht Preview-Deploy). (b) Restliche 13 Button-heavy Files (live-host-deck, live-poll-panel, live-sources-panel, live-host-card, live-gift-picker, live-gifts-feed, live-poll-start-sheet, live-setup-form, replay-player, live-video-player, home-feed-shell, feed-list, new-conversation-button) — Per-View-Audit-Arbeit nach erstem Axe-Report priorisierter als blinder Sweep. (c) Focus-Trap in Sheets/Modals — Radix-basierte Komponenten (DropdownMenu, Dialog, Sheet) haben eingebauten Trap; Custom-Sheets (LiveGiftPicker, DuettInviteModal) wären separate Review. (d) Color-Contrast-Audit in Dark-Mode — erst mit echtem Axe-Report sinnvoll, manuelle HSL-zu-Ratio-Rechnung lohnt nicht. (e) Skip-Link-Ziel-Refactor auf layout-weites `<main>` mit Migration aller Page-eigenen `<main>`-Tags — 10+ File-Sweep, eigenes Slice.

### v1.w.12.5 — Performance-Pass: Bundle-Analyzer, Dead-Deps, next/image, PostHog Consent-First-Load (2026-04-20)

**Scope**: Erste Performance-Runde der Phase 12. Keine dramatische Refactor-Welle — die App ist schon gut optimiert (LiveKit ist route-split via Next-Router-Default, `hls.js` ist bereits dynamic-imported in `video-player.tsx`). Stattdessen 4 konkrete, messbare Wins: Bundle-Sichtbarkeit, Dead-Dep-Cleanup, Image-Optimization, und Consent-First-Analytics.

**Entscheidung gegen „Performance-Theatre"**: Erste Due-Diligence vor der Arbeit ergab dass Haupt-Hotpath-Kandidaten (Live-Watch mit LiveKit, HLS-Video-Player) bereits auf separate Chunks code-split sind. Ein undifferenziertes „wir splitten alles" hätte nichts verbessert, nur die Kopfzahlen im Commit-Log erhöht. Lieber vier kleine konkrete Fixes mit echten Baseline-Ziffern als eine Woche Refactor ohne Metric-Improvement.

- [x] **Bundle-Analyzer verdrahtet** (`apps/web/next.config.mjs` + `package.json`): `@next/bundle-analyzer@^15.0.3` als devDependency + neues npm-Script `"analyze": "ANALYZE=true next build"`. Wrapper in `next.config.mjs` kommt NACH `withSentryConfig` (sonst sähen wir ein falsches Bundle-Bild — Sentry injected client-config-auto-injection + tunnel-route-chunks die in Prod tatsächlich mitgeshippt werden). Reports landen in `.next/analyze/` — pro Page ein HTML, rein lokales Dev-Tool, nichts öffentlich erreichbar. Ab jetzt haben wir ein objektives Instrument für jeden künftigen Perf-Claim.

- [x] **Dead-Dep `lottie-web` entfernt** (`apps/web/package.json`): `lottie-web@^5.12.2` lag als Prod-Dependency drin, aber `grep -r "from 'lottie-web'"` über das gesamte `apps/web/`-Tree → 0 Hits. Die Native-App nutzt Lottie für Gift-Animationen, die Web-Version macht das seit Phase 6 mit CSS-Keyframe-Floats (siehe Phase-6-Eintrag: „Lottie-Worker-Integration verschoben bis größerer Performance-Bedarf nachweisbar"). Die Dep war also Legacy vom Copy-Paste-Scaffolding. Entfernt → ~45kb gz weniger im node_modules-Tree und ein Kandidat weniger für versehentlichen Top-Level-Import.

- [x] **Raw `<img>` → `next/image`** (`components/live/live-cohost-queue.tsx`): Zwei Avatar-Stellen in `PendingRow` (L230) und `ActiveRow` (L302) nutzen jetzt `Image` mit `fill + sizes="36px"` statt `<img src={avatar_url} className="h-full w-full object-cover" />`. Beide sitzen in `<div className="relative h-9 w-9 overflow-hidden rounded-full">`-Containern — `position: relative` war schon da, `fill` kann also direkt greifen. Die beiden `// eslint-disable-next-line @next/next/no-img-element` Direktiven entfernt. Remote-Patterns für Supabase/R2/Google/GitHub in `next.config.mjs` waren bereits aus v1.w.12.0 konfiguriert, also keine Extra-Whitelist nötig. Vorteil: automatisches AVIF/WebP, responsive `srcset`, Lazy-Load mit IntersectionObserver, Broken-Image-Handling.

- [x] **PostHog Consent-First-Load** (`providers/posthog-provider.tsx` + `components/consent/analytics-consent-gate.tsx`): **Stärkste DSGVO-Härtung dieses Slices.** Vorher: `import posthog from 'posthog-js'` auf Top-Level + `posthog.init()` im ersten `useEffect` — damit ging der posthog-js-Chunk (~55kb gz) an JEDEN Erst-Besucher, und ein First-Ping an `eu.i.posthog.com` lief ab bevor der User im `AnalyticsConsentGate`-Banner überhaupt zustimmen konnte. Unter strenger DPA-Auslegung (Belgien, Frankreich): bereits Verstoß. Jetzt: `await import('posthog-js')` DYNAMISCH, erst nachdem `hasAnalyticsConsent() === true` gilt. Listener auf `serlo:consent-change`-CustomEvent: bei Opt-In wird zur Laufzeit lazy-geladen (kein Reload nötig), bei Opt-Out wird `posthog.opt_out_capturing()` gerufen (Lib bleibt geladen — SPA-Unload wäre Overkill, pragmatischer Trade-off). `AnalyticsConsentGate` zur No-Op-Komponente degradiert weil seine komplette Consent-Sync-Logik jetzt im Provider lebt — der Top-Level-Import dort hätte sonst den Lazy-Chunk-Vorteil wieder zunichte gemacht (Webpack hätte posthog-js via diesen parallelen Import zurück in den Shared-Client-Bundle gezogen).

- [x] **Warum nicht `dynamic(import, { ssr: false })` für PostHog?**: `next/dynamic` ist für React-Komponenten gedacht, nicht für nicht-Component-Libs. Für eine Imperative-API-Lib wie posthog-js ist `await import()` im Effect-Hook der saubere Weg — volle Kontrolle über den Zeitpunkt (consent-gated statt mount-gated) und den Error-Pfad (Adblock → silent fallback statt React-Error).

- [x] **Typecheck**: `npx tsc --noEmit` → 24 Errors, **0 neue aus v1.w.12.5-Code**. Baseline unverändert gegenüber v1.w.12.4. Verifiziert per grep über `posthog-provider | live-cohost-queue | analytics-consent-gate` → leer in Error-List.

- [x] **Bewusst NICHT in v1.w.12.5**: (a) Lighthouse-Audit + Budget-Config — braucht deployed Vercel-Preview für realistische Messungen, nicht `next build && next start` lokal. Erst nach erstem Prod-Deploy sinnvoll. (b) Font-Optimization via `next/font` — aktuell wird System-Font verwendet (sieht TikTok-nah aus), Web-Font-Swap wäre separate Design-Entscheidung. (c) Route-Level `loading.tsx`-Skeletons für Perceived Performance — pro-Route Review nötig, eigenes Slice. (d) Partial-Prerendering (PPR) — noch experimental in Next 15, nicht für Pre-Launch. (e) Image-Upload-Compression vor R2-PUT — eigenes Create-Flow-Slice, aktuell wird unverändert hochgeladen und `next/image` komprimiert serving-seitig.

### v1.w.12.4 — Web-Push via VAPID (Subscribe + DM als erster Use-Case) (2026-04-20)

**Scope**: Browser-Push-Channel parallel zur Expo-Push der Native-App aufgezogen — additive Infrastruktur, kein Eingriff in die bestehende `send-push-notification`-Pipeline. Nur DM als erster End-to-End-Use-Case; Follower-geht-live, Gift-Received und Like/Comment kommen in späteren Slices auf derselben Infrastruktur.

**Entscheidung „Web-Push vor i18n"**: i18n laut Roadmap als „shared Strings mit Native" geplant — aber Native hat aktuell selbst kein i18n-Setup. Ein Web-only-next-intl-Rollout jetzt müsste später beim Native-i18n-Setup nochmal umgebaut werden. i18n in ein Cross-Repo-Slice verschoben. Web-Push dagegen: existierender Service-Worker aus v1.w.12.1 als Graft-Punkt vorhanden, null Cross-Repo-Scope, hoher Re-Engagement-Impact.

**Architektur — warum separate Tabelle statt `push_tokens`-Extend**: W3C-Push-Subscription-Shape ist fundamental anders (3-Tupel `endpoint + p256dh + auth` statt 1 Token). Gemeinsame Tabelle würde `send_push_to_user()` im Hot-Path mit Platform-Dispatch-Logik aufblähen, zwei unterschiedliche CHECK-Constraints pro Zeile unterbringen müssen, und RLS-Blast-Radius vergrößern. Separate Tabelle hält Expo-Pfad und Web-Push-Pfad Runtime-getrennt.

- [x] **DB** (`supabase/migrations/20260420010000_web_push_subscriptions.sql`): Neue Tabelle `web_push_subscriptions` mit `UNIQUE(user_id, endpoint)` (safety-net gegen Re-Subscribe-Race), `idx_web_push_subs_recent` als partial-Index auf `(user_id, last_seen_at DESC)` für Dispatch-Fanout. Drei SECURITY-DEFINER-RPCs: `touch_web_push_subscription(endpoint)` (Heartbeat — ohne den würde die 60d-Stale-Cleanup aktive Nutzer prunen), `get_active_web_push_subs(user_id)` (Dispatch-Helper, **nur service_role** — sonst könnten User die Geräte anderer Nutzer enumerieren), `prune_web_push_subscription(endpoint)` (ruft Edge-Function bei 404/410 vom Push-Service).

- [x] **Service-Worker** (`apps/web/public/sw.js`): `CACHE_VERSION` → `serlo-v2` (Activate-Phase purged v1-Cache), drei neue Event-Handler oben auf den bestehenden Offline-Handler drauf: (a) `push` → JSON-Payload parsen mit Raw-Text-Fallback (kein schweigendes Drop, generisches „Serlo"-Label statt Chrome-Default-Notification), `tag + renotify` damit wiederholte Likes auf einen Post nur eine Notification ersetzen statt 10 Pop-Ups. (b) `notificationclick` → closes + tries existing tab focus + in-tab-navigate (via `client.navigate()` mit try/catch für Cross-Origin), fällt auf `openWindow` zurück wenn kein Tab offen. (c) `pushsubscriptionchange` → postMessage an alle Clients damit der Hook beim nächsten Page-Load re-subscribed (Browser kann Subscription rotationsweise invalidieren, FCM macht das gelegentlich).

- [x] **Hook** (`hooks/use-web-push.ts`): 5-State-Machine `unsupported/denied/default/pending/subscribed`. `supportsWebPush()`-Check (SW + PushManager + Notification) fängt Safari-iOS-<16.4-ohne-PWA sauber ab. `subscribe()` MUSS user-getriggert sein (synchrone Permission-API-Anforderung), Upsert mit `onConflict: 'user_id,endpoint'`. Rollback: bei DB-Fehler wird die Browser-Subscription revoked, sonst wäre der Push-Service subscribed ohne dass der Server adressieren kann → stumme Nachrichten. `unsubscribe()` versucht DB-Delete, aber fehlschlag ist non-fatal (`410 Gone` beim nächsten Dispatch räumt automatisch).

- [x] **Uint8Array-TS-Hickup**: `pushManager.subscribe({ applicationServerKey })` erwartet `BufferSource`, aber `Uint8Array<ArrayBufferLike>` ist in TS 5.6 nicht direkt assignable wegen `SharedArrayBuffer`-Subtype. Workaround: `.buffer.slice(byteOffset, byteOffset+byteLength) as ArrayBuffer` extrahiert das unterliegende ArrayBuffer — Runtime-identisch, Types happy. Ohne den Cast: 1 TS-Error.

- [x] **UI** (`app/settings/notifications/page.tsx` + `components/settings/web-push-card.tsx`): Neuer Settings-Tab „Benachrichtigungen" — vorher als `phase: 'Phase 11'` gated, jetzt live. 5 UI-Varianten per Status: `unsupported` (Info-Hint für iOS-PWA), `denied` (Browser-Settings-Anleitung — wir können Permission nicht programmatisch zurücksetzen), `default/pending` (primary CTA), `subscribed` (outline-Button + emerald-Check). Status-Badge oben rechts mit 5 Farb-Tones. Kein Spinner — State-Transitions sub-500ms, ein Spinner wäre Motion-Sickness-triggering.

- [x] **Edge-Function** (`supabase/functions/send-web-push/index.ts`): Accepts `{ user_id } | { user_ids: [...] }` (Single + Batch) mit `{ title, body, url?, tag?, data? }`. `webpush.setVapidDetails()` im Cold-Start. Dispatch sequential per Subscription (parallel würde bei FCM/Mozilla-Autopush schnell throttled), TTL=24h (DM älter als 1d ist irrelevant). 404/410-Handling triggert automatisch `prune_web_push_subscription`. Returns `{ sent, pruned, failed, recipients }`. Requires Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (als `mailto:ops@serlo.app`).

- [x] **DM-Trigger** (`supabase/migrations/20260420020000_web_push_dm_trigger.sql`): `notify_web_push_on_dm()` neben dem bestehenden `notify_on_dm()` (Expo-Push) — beide feuern parallel, unabhängig. Fire-and-forget via `net.http_post` → kein Blocking des DM-Inserts. `EXCEPTION WHEN OTHERS THEN RETURN NEW` als Safety-Net: eine Push-Dispatch-Nebenwirkung darf niemals einen DM-Insert scheitern lassen (Nachricht geht immer durch, Push ist optional). `tag = 'dm:' || conversation_id` sorgt für Browser-seitiges Grouping (neue DM ersetzt alte Notification pro Thread). Deep-Link `/messages/<conversationId>` matched existierende Web-Route.

- [x] **Env-Example** erweitert um `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Client-seitig gesetzt) mit klarem Kommentar dass `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` als Supabase-Secrets gesetzt werden MÜSSEN, NIE committed. Generierungs-Command (`npx web-push generate-vapid-keys`) und Supabase-Set-Command dokumentiert.

- [x] **Typecheck**: `npx tsc --noEmit` → 24 Errors, alle pre-existing. 0 neue aus v1.w.12.4-Code (Verified: grep über `use-web-push | settings/notifications | web-push-card` → leer).

- [x] **Bewusst NICHT in v1.w.12.4**: (a) Weitere Triggers (Follow / Like / Comment / Gift / Live-Start) — selber Pattern wie DM, mechanisch rüberziehen, aber erst wenn Production-Metrics zeigen dass DM-Push sauber zustellt. (b) Channel-Toggles (User aktiviert DM-Push, deaktiviert Gift-Push) — braucht separate User-Preferences-Tabelle, Settings-Phase-12-Slice. (c) Web-Push für Native-Expo-Token-Tracking-Parität (unified notifications-UI) — eigenes Consolidation-Slice Phase 13. (d) `pushsubscriptionchange`-Handling mit automatischem Re-Subscribe — aktuell nur postMessage an Clients, eigentliche Re-Sub macht der Hook beim Visit.

### v1.w.12.3 — Sentry-Integration + Error-Boundaries + Source-Maps (2026-04-20)

**Scope**: `@sentry/nextjs@^8.40.0` lag seit Phase 10 als Dependency rum, wurde aber nie verdrahtet — damit kam kein einziger Web-Error je bei uns im Dashboard an. Vollständige Next-15-App-Router-Integration nachgezogen, damit wir vor Launch den gleichen Issue-Stream haben wie die Native-App.

- [x] **Runtime-Configs** (`sentry.client.config.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts`): Drei getrennte Init-Files für die drei Next-Runtimes. Browser-Config aktiviert Replay-Integration (`maskAllText + blockAllMedia` — DSGVO + Nutzervertrauen; DM-Bodies / Stream-Kommentare haben im Replay nichts zu suchen), `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`. Server + Edge bewusst OHNE Replay (kein DOM), mit `sendDefaultPii: false` explizit gegen versehentliches Payload-Leaken aus Server-Actions. Alle drei sind `enabled: NODE_ENV === 'production'` → lokales Dev meldet nichts an das Prod-Projekt und frisst kein Quota.

- [x] **`tracesSampleRate`**: 10 % in Prod / 100 % in Dev — reicht für Perf-Regression-Detection ohne Sentry-Quota zu verbrennen. Granulareres `tracesSampler` (Live-Watch höher, statische Pages niedriger) bewusst aufgeschoben auf v1.w.12.4+, erst nach ein paar Wochen echter Traffic-Daten entscheiden.

- [x] **Noise-Filter** im Client-Config: `ignoreErrors`-Liste gegen die üblichen Browser-Extension/Ad-Blocker-Fehler (`ResizeObserver loop limit exceeded`, `Non-Error promise rejection captured`, Safari Private-Mode `QuotaExceededError`). Bei Not-Ignore-Filter würde ca. 30-40 % des Issue-Streams aus diesen Nicht-App-Fehlern bestehen (Erfahrungswert aus Native-Sentry).

- [x] **`instrumentation.ts`** (Next-15-canonical-Integrationspunkt): Routet beim Runtime-Boot zum passenden Config-File anhand `process.env.NEXT_RUNTIME === 'nodejs' | 'edge'`. Plus `onRequestError` als Top-Level-Re-Export von `captureRequestError` → ohne den würden RSC-Render-Errors nur im Next-Log landen, nicht in Sentry. Browser-Config wird NICHT hier geladen, sondern vom Sentry-Webpack-Plugin automatisch in das Client-Bundle injected.

- [x] **`next.config.mjs` → `withSentryConfig`**: Wrapper aktiviert sich NUR wenn eine DSN in den Envs liegt (`shouldEnableSentry = Boolean(NEXT_PUBLIC_SENTRY_DSN) || Boolean(SENTRY_DSN)`). Ohne DSN bleibt es der rohe `nextConfig` — damit Self-Hoster ohne Sentry den Build nicht reparieren müssen. Drei Buildtime-Features ausgepackt: (a) automatische Client-Bundle-Injection der `sentry.client.config.ts` (kein manueller Import nötig), (b) Source-Map-Upload nach Sentry + `hideSourceMaps: true` (Maps werden hochgeladen und lokal gelöscht, Browser bekommt nur obfuscated Bundle, Sentry symbolizes Stack-Traces serverseitig), (c) `tunnelRoute: '/monitoring'` als Proxy für Sentry-Ingest → Bypass für uBlock Origin / Adblocker (sonst verschwinden 20-30 % der Client-Events silent).

- [x] **`app/global-error.tsx`** (Layout-Level-Boundary, NEU): Fängt Errors OBERHALB des Root-Layouts ab — eigenes `<html>` + `<body>`, weil es das kaputte Root-Layout ersetzt. Rendert Brand-Gradient + „Zum Feed" + „Neu laden" + Error-Digest für Support-Korrelation. `Sentry.captureException` im useEffect, damit Layout-Crashes überhaupt irgendwo aufschlagen (das Standard-Boundary von Next loggt nur in die Console).

- [x] **`app/error.tsx`** (Page-Level-Boundary): Existierendes File um `Sentry.captureException` erweitert — sitzt INNERHALB des Root-Layouts, also bleiben Header/Sidebar/Consent-Banner/PostHog-Provider erhalten. `nextDigest` als Tag angehängt damit Server-Logs und Sentry-Events per Digest korrelieren. Reset-Callback von Next (Subtree-Remount) bleibt unverändert — transiente Supabase-Fehler können ohne Full-Reload repariert werden.

- [x] **`.env.local.example` erweitert**: Neue Vars dokumentiert: `SENTRY_DSN` (Server-only-Fallback), `NEXT_PUBLIC_SENTRY_RELEASE` / `SENTRY_RELEASE` (CI setzt üblicherweise auf Git-SHA), `NEXT_PUBLIC_SENTRY_ENV` / `SENTRY_ENV` (production/preview/staging-Label). Kommentar-Blöcke erklären: DSN-Inlining in Bundle, Source-Map-Token-Scope (`project:releases`), Vercel-Preview-Deploy-Separation.

- [x] **Typecheck**: `npx tsc --noEmit` → 24 Errors, **0 neue** aus v1.w.12.3-Code. Alle 24 sind pre-existing (auth/middleware/shared-schemas-zod-resolution/video-player-RouteImpl) — Count unverändert gegenüber dem v1.w.12.2-Baseline.

- [x] **Bewusst NICHT in v1.w.12.3**: (a) granulares `tracesSampler` per-Route (nach Launch), (b) Sentry-Release-Promotion-Pipeline über Vercel-Deploy-Hooks (separates CI-Slice), (c) Native-App Sentry-Projekt mergen oder trennen (weiter getrennt — Web-Stacks und Hermes-Stacks haben unterschiedliche Release-Formate), (d) PostHog↔Sentry-Session-Replay-Link (beide haben eigene Replays; Cross-Tool-Korrelation ist ein Phase-13-Observability-Ticket).

### v1.w.12.2 — Open-Graph / Twitter-Card-Parity auf allen shareable Views (2026-04-20)

**Scope**: Jeder Link der irgendwo in WhatsApp/Discord/Twitter/FB geteilt wird muss eine ordentliche Preview-Karte liefern. Inventur der 7 shareable-Routes, Lücken geschlossen, Default-Fallback eingezogen.

- [x] **Inventur**: `/u/[username]` hatte bereits OG + Twitter + eigenes `opengraph-image.tsx` (Profil-Satori-Bild). `/p/[postId]` hatte OG + Twitter-`player`-Card für Inline-Video. Die anderen fünf Routes (`/live/[id]`, `/s/[storyId]`, `/g/[id]`, `/shop/[id]`, `/stories/[userId]`) hatten entweder nur OG ohne Twitter oder gar nichts Page-spezifisches. Lücke zu schließen.

- [x] **Root-Layout** (`app/layout.tsx`): `twitter`-Default-Block in `metadata` ergänzt — `card: summary_large_image`, `site + creator: @serloapp`. Dadurch fallen alle Pages ohne eigenes Twitter-Override automatisch auf eine konsistente Large-Image-Card statt auf Twitter's interne Default-Heuristik, die bei fehlenden Tags oft den ersten H1-Text als Titel missbraucht.

- [x] **`/live/[id]`** (`app/live/[id]/page.tsx`): OG erweitert von 3 auf 7 Felder — `type: video.other`, `url`, `siteName`, Thumbnail mit expliziten 1080×1920-Dimensions (Twitter's Crawler rendert Cards ohne Dimensions oft als Square statt Portrait). Twitter-Card bewusst `summary_large_image` statt `player` gewählt: Twitter-Player-Card bräuchte eine spezielle HTTPS-Embed-Page + `player.iframe`-Whitelist-Freigabe bei Twitter, die unsere LiveKit-basierte Viewer-Page so nicht ausliefert. Thumbnail-Large-Image ist praktisch ausreichend für alle Share-Sheet-Use-Cases.

- [x] **`/s/[storyId]`** (`app/s/[storyId]/page.tsx`): Twitter-Card ergänzt. Dynamic-Card-Type: `summary_large_image` wenn Story ein Bild ist, sonst `summary` (Text-only für Video-Stories ohne separates Thumbnail). `robots: noindex, follow` bleibt — Story-Crawling ist pointless weil sie eh nach 24h weg sind, aber Social-Scraper sollen trotzdem die Preview rendern.

- [x] **`/g/[id]`** (`app/g/[id]/page.tsx`): OG + Twitter von Grund auf neu — vorher nur `title/description/canonical`. `memberCount` wird parallel zum Guild-Fetch via `Promise.all` geholt und in die Description gespliced (`"Description · N Mitglieder"`) — wertet die Preview deutlich auf, signalisiert „aktive Community" statt tote Gruppe. `.catch(() => 0)` auf den Count-Fetch damit ein transienter Fehler nicht die ganze Metadata-Generation killt.

- [x] **`/shop/[id]`** (`app/shop/[id]/page.tsx`): Twitter-Card + `alternates.canonical` + `siteName` + `url` ergänzt. Cover-Bild mit `alt: product.title` versehen damit Screen-Reader der Social-Preview den Produktnamen vorlesen (a11y-Win für Twitter-Card-Embeds in barrierefreien Clients). OG-Type bleibt `website` — Next's Metadata-API hat kein natives `product`-Type (OG-Extensions nur über manuelles `<meta>`-Tag-Injection, was Next nicht bietet ohne Escape-Hatch). Preis/Stock kommunizieren wir über die Description, damit WhatsApp/Discord/FB konsistent rendern.

- [x] **`/stories/[userId]`** (`app/stories/[userId]/page.tsx`): Von statischer `export const metadata` auf dynamisches `generateMetadata` umgebaut. Holt die Story-Group des Users, nimmt die erste Bild-Story als Thumbnail, generiert `"Stories von @username"`-Titel. Bleibt `robots: noindex` weil der Viewer auth-gated ist, aber Share-Sheet-Previews funktionieren trotzdem (Scraper fetchen Tags vor dem Auth-Redirect). Edge-Case: `getStoryGroupForUser` wirft bei nicht-existentem User — `.catch(() => null)` fängt das ab und liefert die generische „Stories — Serlo"-Metadata aus.

- [x] **Default-Fallback-OG-Image** (`app/opengraph-image.tsx`): Satori-gerenderte 1200×630 PNG via `ImageResponse`, Edge-Runtime. Brand-Gradient (`#050508 → #1a0a2e → #3a0f2a`), `S`-Logo mit amber/rose/fuchsia-Gradient, Headline „Live. Feed. Shop.", Sub-Tagline, Footer-URL. Keine externen Assets — alles inline, damit der Edge-Render nicht an R2/Storage-Fetches hängt.

- [x] **Default-Twitter-Image** (`app/twitter-image.tsx`): Importiert Default-Export + alle Metadata-Exports aus `./opengraph-image` und re-exportiert — Next 15 merged die beiden File-Conventions NICHT automatisch, d.h. ohne eigenes `twitter-image.tsx` würde Twitter ohne Bild rendern. Re-Export-Pattern statt Duplikation damit Brand-Änderungen an einer Stelle landen.

- [x] **Typecheck**: `npx tsc --noEmit` → 24 Errors, alle pre-existing (middleware/shared-schemas/auth-RouteImpl). 0 neue Fehler aus v1.w.12.2-Code. Kleine Selbst-Korrektur unterwegs: erste Version von `/stories/[userId]`-Metadata referenzierte `group.author.display_name`, aber `StoryGroup` hat diese Felder nicht (nur `username`, `avatar_url`, `stories`) — umgebaut auf `group.username ? '@' + username : 'einem User'`.

- [x] **Bewusst NICHT**: WhatsApp-Preview-Testing über echte Shares (erfordert Public-URL, Tests erst nach Deploy), Twitter-Card-Validator-Check (erfordert Vercel-URL), per-Session-Twitter-Player-Card für Live (eigene Player-Embed-Route wäre separates Slice). Alles offenes v1.w.12.3+ Material.

### v1.w.12.1 — Polish-Slice: Legal, Consent, GDPR, PWA (2026-04-20)

**Scope**: Vier Polish-Slices der Phase 12 zusammen ausgeliefert — alles was „das Ding kann live gehen ohne dass Legal/Datenschutz einen Anruf macht". Keine i18n, keine Web-Push, kein Lighthouse-Audit (getrennte Slices in v1.w.12.2+).

- [x] **Slice 1 — Legal-Pages** (`app/terms/page.tsx`, `app/privacy/page.tsx`, `app/imprint/page.tsx`): Drei Server-Components als statische Prose-Seiten. AGB in 10 Sektionen mit Stand-Datum (2026-04-20). Datenschutzerklärung in 9 Sektionen — Verantwortlicher, Datenkategorien, Rechtsgrundlagen, Auftragsverarbeiter-Liste (Supabase/LiveKit/Cloudflare R2/Stripe/Sentry/PostHog/Resend), Speicherdauern, Betroffenenrechte. Impressum nach § 5 DDG mit TODO-Platzhaltern für Firmierung/Anschrift/Handelsregister/USt-ID die Zaur vor Go-Live ausfüllt. Alle drei sind `prose`-styled, cross-verlinkt und kollidieren nicht mit `/legal/*`-Namespace den es nie gab. Bonus-Fix: Signup-Page (`app/signup/page.tsx`) zeigte auf `/legal/terms` + `/legal/privacy` — Typecheck meckerte über nicht-existente Routes, auf `/terms` + `/privacy` umgebogen.

- [x] **Slice 2 — Cookie-Consent-Banner**:
    (a) `lib/consent.ts` — typisierter Consent-State (`essential: true` fix, `analytics` + `marketing` user-gesteuert), localStorage-Persistenz unter `serlo:consent:v1` mit Versions-Gate (bei Schema-Bump wird alter State invalidiert), CustomEvent-basierte Cross-Tab-Propagation via `window.dispatchEvent('serlo:consent-change')`. Helpers: `readConsent()`, `writeConsent()`, `resetConsent()`, `onConsentChange()`, `hasAnalyticsConsent()`, `hasMarketingConsent()`.
    (b) `components/consent/consent-banner.tsx` — Fixed-bottom-Card, mountet nur wenn `readConsent()` null liefert (First-Time oder nach Reset). Drei Action-Paths: „Nur essenziell" / „Alle akzeptieren" / „Auswahl speichern" (nach Details-Aufklappen mit 3 Toggles). Exportiert zusätzlich `OpenConsentSettingsButton` für Footer-Re-Open.
    (c) `components/consent/analytics-consent-gate.tsx` — Client-Komponente die bei Mount den Initial-Consent-State aus localStorage liest und bei Änderungen `posthog.opt_in_capturing()` / `posthog.opt_out_capturing()` ruft. Der bestehende `providers/posthog-provider.tsx` bleibt unangefasst — PostHog wird initialisiert, aber der Gate legt den Opt-Out-Layer darüber. 3-Sekunden-Poll-Loop weil PostHog-`__loaded` beim Mount der Gate-Komponente evtl. noch nicht true ist.
    (d) `app/layout.tsx` — `<ConsentBanner />` + `<AnalyticsConsentGate />` innerhalb des `PostHogProvider`-Scopes gemountet.
    (e) `components/feed/feed-sidebar.tsx` — Footer-Block unten in der Sidebar mit Impressum/Datenschutz/AGB-Links + `OpenConsentSettingsButton` als „Cookie-Einstellungen"-Link für Re-Open nach erster Entscheidung.

- [x] **Slice 3 — GDPR-Flows** (`app/actions/gdpr.ts`, `app/settings/privacy/page.tsx`):
    (a) Server-Action `exportMyData()` → aggregiert 14 Quellen parallel (profile, posts, comments, likes, follows×2 als following/followers, messages, stories, guild_memberships, live_sessions, coin_purchases, products, shop_orders, saved_products). Pro-Tabelle-Fehlerisolation via `safeSelect()`-Wrapper: wenn eine Einzel-Quelle scheitert (Migrations-Drift, neue Tabelle noch nicht im Web verfügbar), wird leere Liste geschrieben und Fehler in `notes`-Feld geloggt — Teilexport ist besser als komplett-Fail. RLS garantiert dass nur eigene Rows kommen, also kein zusätzlicher WHERE-Check nötig aber aus Defense-in-Depth dennoch `.eq('user_id', uid)` explizit gesetzt.
    (b) Server-Action `deleteMyAccount(confirmation)` → verifiziert Confirmation-String exakt `ACCOUNT LÖSCHEN` (Tipp-Friktion, case-sensitive), ruft bestehende `public.delete_own_account()`-RPC (ist SECURITY DEFINER, gated auf `auth.uid()`, cascaded über alle FKs). Danach `auth.signOut()` (Cookie wird geleert) + `redirect('/?account-deleted=1')`.
    (c) `components/settings/data-export-button.tsx` — Client-Island das die Export-Action ruft, JSON zu Blob serialisiert, Object-URL via `URL.createObjectURL()` erstellt, unsichtbares `<a download>` clickt, nach 2s `revokeObjectURL()` (Firefox-/iOS-Safari-Puffer). Dateiname: `serlo-export-YYYY-MM-DD-HH-MM-SS.json`.
    (d) `components/settings/delete-account-card.tsx` — Zwei-Schritt-Bestätigung: Button expandiert zu Text-Input + `code`-Tag mit erwarteter Phrase, Submit erst enabled wenn exakt gematcht. Bei Server-Error Toast; bei Erfolg redirectet die Action (kein Client-State-Reset nötig).
    (e) `app/settings/privacy/page.tsx` — Server-Component mit 3 Sektionen: Rechtstexte-Links, Export-Karte, Danger-Zone. Settings-Layout (`app/settings/layout.tsx`) hatte `Privatsphäre` als `phase: 'Phase 11'` disabled markiert — entsperrt.

- [x] **Slice 4 — PWA** (bewusst ohne `next-pwa` — das Paket hinkt Next 15 hinterher und zieht Workbox mit, manuell ist für den Scope cleaner):
    (a) `app/manifest.ts` — Next-15-Convention mit `MetadataRoute.Manifest`-Return. `display: standalone`, `orientation: portrait`, `start_url: '/?utm_source=pwa'` (für PostHog-Adoption-Tracking), vier Icon-Größen (192/512/512-maskable PNG + SVG-Any), vier Shortcuts (Feed/Live/Neues Video/Messages) für Install-to-Homescreen-Long-Press-Menüs.
    (b) `public/icon.svg` — Inline-SVG mit Gradient-Brand (amber→rose→fuchsia), 512×512 viewBox, Schwarzer Hintergrund, stilisiertes „S". PNG-Varianten sind Placeholder-References — Zaur liefert vor Go-Live aus Brand-Assets.
    (c) `public/sw.js` — Minimaler Service-Worker, **kein Workbox**. Strategie: GET-only (POST/PUT/DELETE werden nie gecached → Server-Actions, Mutations, Auth bleiben unberührt), Navigation = Network-first + `/offline.html`-Fallback, Static-Assets (png/svg/css/js/woff) = Stale-while-revalidate. Supabase/PostHog/Auth-Hostnames explizit auf Bypass-Liste. `skipWaiting()` im install + `clients.claim()` im activate, damit SW-Updates beim nächsten Reload sofort greifen.
    (d) `public/offline.html` — Vanilla-HTML-Fallback mit Brand-Gradient-Logo + „Erneut versuchen"-Button (`location.reload()`).
    (e) `components/pwa/service-worker-registrar.tsx` — Client-Island, registriert `/sw.js` nur in Production (Dev-Reloads werden sonst durch gecachte Chunks verwirrt), wartet auf `window.load` bevor es registriert (kein Konkurrenz um initialen Paint auf Low-End-Mobile).
    (f) `app/layout.tsx` — `<ServiceWorkerRegistrar />` gemountet.

- [x] **Typecheck**: 24 Errors total, alle pre-existing (middleware/shared-schemas/video-player/auth-RouteImpl). 0 neue Fehler aus Phase-12-Code. Der Legal-Slice hat einen Bonus-Fix mitgeliefert: Signup-Seite zeigte auf nicht-existente `/legal/*`-Routes und warf einen TS2322 — jetzt auf die tatsächlichen `/terms` + `/privacy` umgebogen.

- [x] **Bewusst NICHT in v1.w.12.1**: i18n (next-intl-Integration ist eigenes 2-3-Tage-Slice mit Strings-Shared-Pattern zwischen Web und Native), Web-Push (VAPID + Subscription-Persistence + Edge-Function für Push-Dispatch), Lighthouse-Audit (nach Icon-Assets), Sentry-Release-Integration, Status-Page. Separate v1.w.12.x-Einträge.

### v1.w.10 — Payments / Stripe-Integration (2026-04-20)

- [x] **Grund-Architektur**: Web-Pay komplett getrennt vom Native-RevenueCat-Flow, bewusst. RC könnte per Custom-Webhook auch im Web laufen, aber (a) Apple/Google-Store-Gebühren fielen dann trotzdem an weil RC-Kommerz-Policies so sind, (b) Stripe-Checkout kennt Apple Pay / Google Pay / Klarna / SEPA out-of-the-box, (c) die Edge-Function + DB-Schicht ist deutlich simpler. Am Ende zahlt der User 20% weniger Coin-Overhead im Web — das ist der Kern-Hebel dieser Phase.

- [x] **DB-Migration** (`supabase/migrations/20260422000000_web_stripe_payments.sql`):
    (a) `coin_pricing_tiers` — 4-seeded Tiers (web-100/500/1200/3000) mit ~20% Bonus gegenüber Native. RLS `active=true` public-read damit `/coin-shop` auch für anon-User rendert. `stripe_price_id`-Spalte leer bei Seed → Admin füllt nach Dashboard-Setup.
    (b) `web_coin_orders` — mit `coin_order_status`-Enum (pending/paid/failed/refunded/cancelled). `stripe_session_id UNIQUE` als Idempotenz-Grenze. RLS: User sieht nur eigene Rows, Service-Role schreibt. Drei Indizes: `(user_id, created_at desc)` für Billing-Liste, `(status, created_at desc)` für Admin-Queries, Partial-Index auf `stripe_session_id` für Webhook-Matching.
    (c) `creator_tips` — ephemerer Einmal-Tip-Log. RLS: Sender + Recipient sehen Rows. Insert NUR via RPC `send_creator_tip` — Direktschreib-Weg gesperrt damit die Balance-Prüfung nicht umgangen werden kann.
    (d) Trigger `set_web_coin_orders_updated_at` auf `updated_at`.
    (e) RPC `send_creator_tip(recipient, amount, message?)`: `SECURITY DEFINER`, `auth.uid()`-Guard, Cannot-Tip-Self-Guard, 1-100k-Clamp, 140-char-Message-Limit, FOR-UPDATE-Lock auf `coins_wallets` für race-safety, atomare Balance-Abbuchung + 85%-Diamant-Gutschrift (gleiche Ratio wie `send_gift`). Returns `tip_id`.
    (f) RPC `get_my_coin_order_history(limit, offset)` — paginiert, `least(p_limit, 200)` cap.

- [x] **Edge-Function `create-checkout-session`** (`supabase/functions/create-checkout-session/index.ts`):
    (1) Auth-Gate: Bearer-JWT aus Request → `supabase.auth.getUser()`. Ohne Login 401.
    (2) Tier-Lookup via service-role-Client (umgeht RLS): `coin_pricing_tiers WHERE id = ? AND active = true`.
    (3) Rate-Limit: max 10 `pending`-Orders pro User pro Stunde → 429. Verhindert DOS-Drive-by-Spam.
    (4) Order-Row PRE-Stripe-Call anlegen → `order.id` wird als `client_reference_id` UND `Idempotency-Key` benutzt. Race-free: selbst wenn Stripe zweimal angefragt wird, liefert Stripe dieselbe Session zurück und der Webhook kann deterministisch matchen.
    (5) Stripe-Session-Body: `mode=payment`, `automatic_payment_methods[enabled]=true` (das ist der Switch für Apple Pay / Google Pay / Link / Klarna — Stripe entscheidet per Country-Detection), `invoice_creation[enabled]=true` (wichtig fürs Accounting — Stripe generiert automatisch PDF), `line_items` bevorzugt `stripe_price_id` (Dashboard-Config), Fallback inline `price_data`. `metadata` füllen mit `order_id/user_id/tier_id/coins/bonus_coins` — Webhook nutzt das als zweiten Idempotenz-Anker falls `client_reference_id` mal verloren geht.
    (6) `Stripe-Version: 2024-06-20` pinned — später bewusst bumpen, nicht implizit.
    (7) Bei Stripe-Fehler Order auf `failed` mit `failed_reason: stripe_${status}` → verhindert dass pending-Orders ewig hängen.
    (8) CORS-Headers für OPTIONS + POST. Deploy: `supabase functions deploy create-checkout-session` (mit `--verify-jwt` default, weil wir den Caller identifizieren).

- [x] **Edge-Function `stripe-webhook`** (`supabase/functions/stripe-webhook/index.ts`):
    (1) Eigene Signatur-Verifikation (HMAC-SHA256) statt esm.sh/stripe — letzteres ist in Deno-Edge unzuverlässig. `verifyStripeSignature(raw, header, secret)` parst `t=<timestamp>,v1=<sig>[,v1=<sig>...]`, baut `payload = ${timestamp}.${rawBody}`, signiert per `crypto.subtle.importKey('HMAC', sha-256')` und `sign()`, vergleicht timing-safe.
    (2) Replay-Schutz: `event.created` Unix-Sekunden → `Date.now() - created*1000 > 10min` → 400. Abwehr für Webhook-Secret-Leak-Szenarien.
    (3) Fünf Events verarbeitet: `checkout.session.completed` + `checkout.session.async_payment_succeeded` → `handlePaid`; `async_payment_failed` → `handleFailed`; `expired` → `handleExpired`; `charge.refunded` → `handleRefunded`.
    (4) `handlePaid` Race-Protection: `.update({status:'paid'}) ... .eq('status','pending')` — wenn zwei parallele Webhook-Retries gleichzeitig durchgehen, matched nur der erste, der zweite schreibt 0 Rows. Plus Idempotenz-Check oben (`if (order.status === 'paid') return`). Coins via `credit_coins` RPC (dieselbe Native-RPC → Cross-Platform-Parität).
    (5) `handlePaid` Invoice+Receipt-URL-Fetch: Best-Effort sekundäre Stripe-API-Calls für `hosted_invoice_url` + `latest_charge.receipt_url`. Wenn diese fehlschlagen wird die Order trotzdem paid gesetzt — nur die Billing-Page zeigt dann keinen Download-Link (manueller Fallback via Stripe-Dashboard).
    (6) `handleRefunded` matched Order über `stripe_payment_intent`. Bewusst KEIN automatischer Coin-Rollback — Coins könnten bereits ausgegeben sein (Gifts, Shop, Tips). Support macht Rollback per Hand falls nötig.
    (7) Unbekannte Event-Types werden mit 200 quittiert damit Stripe kein Retry-Spam macht. 500 bei Handler-Fehlern → Stripe retried mit Exponential Backoff (bis 3 Tage).
    (8) Deploy: `supabase functions deploy stripe-webhook --no-verify-jwt` (Stripe ruft ohne Supabase-JWT auf). Endpoint-URL im Stripe-Dashboard: `https://<project>.supabase.co/functions/v1/stripe-webhook`.

- [x] **Data-Layer** (`apps/web/lib/data/payments.ts`):
    React `cache()`-wrapped SSR-Reads — `getCoinPricingTiers()`, `getCoinPricingTier(id)`, `getMyCoinBalance()` (aus `coins_wallets` mit Fallback `{coins:0,diamonds:0,totalGifted:0}` falls kein Wallet-Row), `getMyCoinOrders(limit, offset)` (über RPC `get_my_coin_order_history`), `getMyCoinOrderById(id)`, `getMyCoinOrderBySession(sessionId)` (für Success-Page-Matching). Formatter-Helpers `formatPrice`, `totalCoins`, `coinsPerEuro`. Status-Maps `STATUS_LABEL` (DE) + `STATUS_TONE` für Badge-Rendering. Graceful-Degradation: alle Queries returnen empty/null statt zu werfen.

- [x] **Server-Actions** (`apps/web/app/actions/payments.ts`):
    (a) `startCheckout(tierId)` → invokes `create-checkout-session` via `supabase.functions.invoke()` (JWT wird automatisch mitgeschickt), mapped `data.error`-Codes auf UX-Strings. Returnt `{ url, orderId, sessionId }` damit Client hart per `window.location.href` redirected.
    (b) `sendCreatorTip(recipientId, coinAmount, message?)` → delegiert an RPC. Error-Code-Mapping via Regex auf error.message (RPC wirft `raise exception 'insufficient_coins'` → wir matchen `/\b([a-z_]+)\b/` und suchen in `TIP_ERROR_MESSAGES`). `revalidatePath('/u/${recipientId}')` + `revalidatePath('/settings/billing')` nach Success.
    (c) `cancelPendingOrder(orderId)` → User-initiierter Abbruch nicht-bezahlter Orders. `.eq('status','pending')` macht es race-safe mit dem Webhook: falls der Webhook parallel ankommt und die Order auf `paid` setzt, findet unser Update keine Row und cancelt nicht fälschlich.

- [x] **`/coin-shop`-Seite** (`apps/web/app/coin-shop/page.tsx` + `components/coin-shop/tier-card.tsx`):
    Public-lesbare Pricing-Grid (4-Spalter auf Desktop, responsive auf Mobile), Hero mit „Web-Bonus: bis zu +33% mehr Coins"-Badge und aktueller Balance-Pill wenn eingeloggt. Jede `TierCard`: Coin-Count+Bonus-Breakdown (mit %-Extra-Label), EUR-Preis + Coins-per-Euro als Referenz, Badge (Bestseller/Beste-Wert hebt sich durch Gold-Gradient hervor), CTA-Button → `startCheckout()` + harter Redirect. Anon-User sehen „Einloggen & kaufen" mit `next=/coin-shop` damit sie nach Login direkt zurück landen. Error-Anzeige inline unter der Karte wenn die Edge-Function fehlschlägt. Darunter 3 Trust-Cards (Sichere Zahlung / Apple&Google Pay / Karte&Klarna&SEPA) + Info-Block mit Checkliste.

- [x] **Success + Cancelled Pages** (`apps/web/app/coin-shop/success/page.tsx`, `apps/web/app/coin-shop/cancelled/page.tsx`):
    Success matched auf `?session_id=…`, lookup via `getMyCoinOrderBySession`. Drei Status-Renderings: paid (grüner Check, „Zahlung erfolgreich"), pending (amber Clock, „Zahlung wird bearbeitet" — Webhook-Race-Fenster), failed/cancelled (rotes Alert). Order-Summary mit Paket + Bestellnummer + Invoice/Receipt-Download-Buttons wenn verfügbar. Cancelled-Page ist simpler statischer Fallback. Beide `robots: { index: false }`.

- [x] **`/settings/*` Layout + Billing-Page** (`apps/web/app/settings/layout.tsx`, `app/settings/page.tsx`, `app/settings/billing/page.tsx`, `components/settings/cancel-order-button.tsx`):
    Neuer Settings-Namespace mit SSR-Auth-Gate (Redirect `login?next=/settings`). Linke Nav auf Desktop mit 4 Einträgen — Profil / Bezahlungen / Benachrichtigungen / Privatsphäre (letzte 3 disabled mit Phase-11-Label). `/settings` root redirected auf `/settings/billing` damit der Dropdown-Link „Einstellungen" in der Site-Header nicht kaputt ist. Billing-Page: 3 Wallet-Cards (Coins / Diamanten / Verschenkt) mit CTA „Aufladen" auf die Coins-Card, darunter Order-History-Tabelle mit Status-Pills + Download-Links für Rechnung/Beleg. Pending-Orders haben inline „Abbrechen"-Button → `cancelPendingOrder()` über `CancelOrderButton`-Client-Komponente mit `window.confirm`-Guard + `router.refresh()`.

- [x] **Creator-Tip-Button** (`apps/web/components/profile/creator-tip-button.tsx`):
    Rot-akzentuierter „Unterstützen"-Button neben dem FollowButton auf `/u/[username]`. Öffnet einen Dialog mit 4 Preset-Beträgen (50/200/500/1000) + Custom-Amount-Input + optionaler 140-char-Message. Balance-Hint zeigt aktuelle Coins und amber-warnt wenn nicht genug vorhanden → Link auf `/coin-shop`. Nach Success grüner Check + Auto-Close nach 2s + `router.refresh()` damit Header-Coin-Balance-Pill aktuell ist. Bei `insufficient_coins` Error-State mit „Coins aufladen"-CTA. Anon-User sehen stattdessen Link auf `/login?next=/u/${username}`. Self-View: Button wird gar nicht erst gerendert.

- [x] **Site-Header + Sidebar-Integration** (`apps/web/components/site-header.tsx`, `apps/web/components/feed/feed-sidebar.tsx`):
    Coin-Balance-Pill im Site-Header ist jetzt Link → `/coin-shop` (Hover-State mit Gold-Tint). Neuer Dropdown-Eintrag „Bezahlungen" im User-Menu. Feed-Sidebar bekommt zwei Einträge: „Coin-Shop" (anon+auth, icon Coins) und „Bezahlungen" (auth-only, icon Receipt) zwischen „Gemerkt" und „Trending".

- [x] **`.env.local.example`** erweitert: `STRIPE_SUCCESS_URL` + `STRIPE_CANCEL_URL` ergänzt mit Hinweis, dass diese als Supabase-Edge-Function-Secrets (nicht `NEXT_PUBLIC_*`) gesetzt werden müssen via `supabase secrets set …`. `{CHECKOUT_SESSION_ID}`-Platzhalter wird von Stripe serverseitig ersetzt.

- [x] **Typecheck**: 27 pre-existing Error-Lines, 0 neue aus Phase-10-Dateien (payments.ts, coin-shop/*, settings/*, creator-tip-button.tsx, Site-Header + Sidebar Edits). Cross-Platform-Parität: dieselbe `credit_coins`-RPC + `coins_wallets`-Tabelle + `send_creator_tip`-Logik wird später auch von der Native-App aufgerufen werden können wenn dort Stripe-Integration für Android reinkäme.

### v1.w.9 — Creator Studio (2026-04-20)
- [x] **Studio-Data-Layer** (`lib/data/studio.ts`): Zwölf `cache()`-gewrappte Reads — `getCreatorOverview(period)` (delegiert an Native-RPC `get_creator_overview` → totalViews/Likes/Comments/Followers + `prev*`-Spalten für Trend-Berechnung), `getCreatorEarnings(period)` (Diamonds-Balance + Period-Gifts + Top-Gift/Top-Supporter via `get_creator_earnings`), `getCreatorTopPosts(sort, limit)` (sortierbar auf views/likes/comments via `get_creator_top_posts`), `getFollowerGrowth(period)` (Tages-Granularität via `get_creator_follower_growth`), `getPeakHours(period)` (7×24 Matrix via `get_creator_engagement_hours`, Native-Konvention 0=Mo..6=So, UTC-Stunden), `getWatchTime(period)` (Estimate via `get_creator_watch_time_estimate`, 8s/View-Proxy), `getCreatorGiftHistory(limit)` (letzte Gifts-Empfang-Liste), `getShopRevenue(period)` (Eigene Web-Aggregation über `orders` — completed/pending/refunded-Coins + Unique-Buyers), `getShopOrdersDetailed(period, limit)` (detaillierte Row-Liste für Tabelle + CSV-Export, mit buyer+product-Joins über `Array.isArray`-Normalize-Pattern), `getMyLiveSessionsCount(period)` / `getMyScheduledCount()` / `getMyDraftsCount()` (Dashboard-Card-Counter via `HEAD`-count-queries ohne Data-Fetch). Alle RPCs failen gracefully mit `null`/`[]` statt throw, damit eine kaputte Metric nicht das ganze Composite-Dashboard kippt.
- [x] **Layout + Sub-Nav** (`app/studio/layout.tsx` + `components/studio/studio-sub-nav.tsx`): SSR-Auth-Gate mit Redirect `/login?next=/studio`. Responsive Nav — Mobile horizontale Pill-Row mit `overflow-x-auto` + sticky-top, Desktop `lg:grid-cols-[220px_1fr]` Rail-Layout. Neun Nav-Einträge (Dashboard/Analytics/Einnahmen/Geplant/Entwürfe/Live/Shop/Bestellungen/Moderation). Active-State-Heuristik: exakt für `/studio`, startsWith für alle nested Routes. Sub-Nav sitzt unter dem `--site-header-h` CSS-Var und bleibt sticky beim Scrollen.
- [x] **`/studio` Dashboard-Root** (`app/studio/page.tsx`): Hero mit Diamanten-Balance + Gradient-BG + dezentem 💎-Watermark, 4×KPI-Grid (Views/Likes/Comments/Neue Follower) mit Trend-Chips (Up/Down/Flat + `%`-Delta gegen Vorperiode, farbcodiert green/red/muted), 3×Summary-Row (Engagement-Rate = interactions/views, Top-Gift-Card, Follower-Summary), 4×Planning-Row mit Deep-Links zu `/studio/scheduled`/`/studio/drafts`/`/studio/live`/`/studio/shop`, 2-Spalter Top-Posts + Recent-Gifts als Panels mit Empty-States. Alle Daten parallel via `Promise.all` gelöst (9 reads).
- [x] **PeriodTabs** (`components/studio/period-tabs.tsx`): Client-Component mit 7/28/90-Tagen Selector via `?period=` Query-Param. Nutzt Plain-Links statt `router.push` → funktioniert ohne JS (Progressive Enhancement). Behält alle anderen Query-Params via `URLSearchParams`-Copy.
- [x] **`/studio/analytics`** (`app/studio/analytics/page.tsx`): Follower-Wachstums-Chart (eigenes Pure-SVG-Area-Chart in `components/studio/follower-growth-chart.tsx` — kein Chart-Lib, ~130 LOC, Polygon-Fill + Top-Linie + Data-Points mit `<title>`-Tooltip + X-Axis-Labels first/mid/last), Watch-Time-Estimate-Row (3 BigCards — Watch-Time-Formatted mit h/T-Fallback, Views mit Ø-Seconds/View, Gesamt-Follower), Peak-Hours-Heatmap (`components/studio/peak-hours-heatmap.tsx` — 7×24 Grid, 6-stufige Opacity-Buckets von `bg-muted` bis `bg-primary`, Legend + Native-konforme Mo-basiertes Wochen-Raster), sortierbare Top-Posts-Tabelle (20 Einträge, Sort-Pills für views/likes/comments via `?sort=` Query-Param mit ER-Spalte).
- [x] **`/studio/revenue`** (`app/studio/revenue/page.tsx`): 4 BigMetric-Cards (Diamanten-Balance/Diamanten-Periode/Shop-Umsatz/Verkäufe-Zähler), Shop-Status-Breakdown als 4 Status-Pills (Completed/Pending/Refunded/Unique-Buyers), 2-Spalter Gift-History + Shop-Orders. Orders-Panel hat CSV-Export-Button. Payout-Hinweis als Amber-Alert-Box (wartet auf Phase 10 Stripe-Integration).
- [x] **CSV-Export** (`app/studio/revenue/export.csv/route.ts`): Route-Handler → liefert `text/csv; charset=utf-8` mit UTF-8-BOM-Prefix (Excel-Kompatibilität), RFC-4180-konformer Escape (Felder mit `",\r\n` werden doppelt-gequotet, interne `"` verdoppelt), `Content-Disposition: attachment` mit Datei-Name `serlo-shop-orders-<N>t-<YYYY-MM-DD>.csv`, `no-store`-Cache-Header weil Per-User-Daten. Maximum 5000 Zeilen pro Export.
- [x] **`/studio/scheduled`** (`app/studio/scheduled/page.tsx` + `components/studio/scheduled-calendar.tsx`): Monats-Kalender-View mit Mo-basiertem ISO-Wochen-Raster (6×7 Zellen wenn Monat > 35 Tage spannt, sonst 5×7), Padding-Zellen vom Vor-/Folge-Monat mit reduzierter Opacity (`bg-muted/30`), Heute mit Primary-Ring, pro Zelle max 3 Post-Chips + „N+ weitere"-Link zur Listen-View. Chip zeigt Status-Dot + Zeit + Caption + farbliche BG-Pille (emerald für published, red für failed). Monatsnavigation via `?month=YYYY-MM` Query-Param mit Prev/Next-Pills. Status-Legend-Leiste + Empty-Hint-Card wenn keine Scheduled-Posts vorhanden. Listen-Ansicht bleibt als Fallback-Link auf `/create/scheduled` (dort wohnt der Mutation-Flow mit Reschedule-Popover + Cancel-Confirm aus v1.w.8).
- [x] **`/studio/drafts`**: Redirect-Alias auf `/create/drafts` (die Drafts-Liste + Resume-Logik leben im Create-Flow, wir halten den Studio-Pfad als stable Entry-Point für Dashboard-Deep-Links — so bricht kein Link falls wir die Route später umziehen).
- [x] **`/studio/moderation`** (`app/studio/moderation/page.tsx`): Read-Only-Hub für Creator-Moderations-Rechte. 3 Stat-Cards (Blockierte Profile via `user_blocks` HEAD-count, Live-Sessions mit Moderation via `live_sessions.moderation_enabled=true`, Eigene Meldungen via `reports.reporter_id`). 3 Mod-Link-Rows zu `/settings/blocked`, `/studio/live`, `/settings` (Meldungs-Queue kommt Phase 12). Amber-Alert-Box dokumentiert dass globale Mod-Queue in späterer Phase kommt.
- [x] **Sidebar-Link**: Neuer „Creator Studio"-Eintrag in `components/feed/feed-sidebar.tsx` mit `BarChart3`-Icon zwischen Shop und Mein Shop, `requiresAuth: true`. Verlinkt auf `/studio` als Root-Entry.
- [x] **Phase 10 deferred**: `/studio/payouts` (Auszahlungs-Historie) bleibt als einziger Phase-9-Punkt offen — Auszahlungs-Flow braucht Stripe-Integration aus Phase 10 (SEPA-Transfer via Stripe Connect Express), vorher haben wir keinen Payout-State-Machine.
- [x] **Keine neuen DB-Migrations, keine neuen Edge-Functions**: Alle Creator-RPCs (get_creator_overview, earnings, top_posts, follower_growth, engagement_hours, watch_time_estimate, gift_history) existieren bereits aus Native. Web konsumiert ausschließlich — keine Backend-Gabelung.
- [x] **Typecheck**: Vor Phase 9 waren 33 Lines vorhanden (alles pre-existing Supabase-SSR-Cookies-any + shared/schemas-Zod + typed-routes-Casts). Nach Phase 9 weiterhin 33 Lines — null neue Fehler in den 11 neuen Files.

### v1.w.4 — Shop + Merchant-Studio (2026-04-20)
- [x] **Shop-Data-Layer** (`lib/data/shop.ts`): Elf `cache()`-gewrappte Reads — `getShopProducts(params)` mit Facetten-Filter (category/sellerId/min-max-price/on-sale/free-shipping/women-only/sort=popular|newest|price-asc|price-desc/q/limit/offset), `getProduct(id)`, `getSavedProducts()`, `getMerchantProducts(sellerId)`, `getMyProducts()`, `getMyOrders(role='buyer'|'seller')`, `getProductReviews(id, limit=50)`, `getMyReview(id)`, `getEligibleOrderForReview(id)` (gated auf `orders.status='completed'`), `getMyCoinBalance()`, `getShopAnalytics()` (revenue-aggregation über `orders` mit 70%-Skalierung für Plattform-Cut). Normalize-Pattern für Author-Joins (`Array.isArray`) wiederverwendet aus Phase 2/3. `batchSaved()`-Helper vermeidet N+1-Queries für `saved_by_me`-State — fetched alle `saved_products` in einem `.in('product_id', ids)`-Call und returned ein `Set`.
- [x] **Server-Actions** (`app/actions/shop.ts`): Zehn Actions — `toggleSaveProduct`, `buyProduct` (delegiert an Native-RPC `buy_product` → mapped error codes `insufficient_coins`/`cannot_buy_own`/`out_of_stock`/`product_inactive` auf DE-Toasts), `submitReview`, `deleteReview`, `reportProduct`, `createProduct` / `updateProduct` / `deleteProduct` (Zod-validiert via `productCreateSchema`/`productUpdateSchema` aus `shared/schemas/product.ts` → erster Error wird als `result.error` durchgereicht), `toggleProductActive`, `updateOrderStatus` (Whitelist gegen `pending`/`completed`/`cancelled`/`refunded`, `.eq('seller_id', viewer.id)` als Authority-Gate). Alle Actions returnen `ActionResult<T>`, `revalidatePath`/`revalidateTag` wo nötig.
- [x] **Mutation-Hooks** (`hooks/use-shop.ts`): `useToggleSaveProduct()` optimistic mit predicate-based Cache-Patch — matcht BEIDE Query-Keys (`['shop', ...]` für Grid und `['product', id]` für Detail) in einem `setQueriesData`-Sweep, rollt auf `onError` via Snapshot zurück. `useBuyProduct({ onSuccess })` invalidiert Shop/Product/Orders/Coin-Balance-Caches. Weitere Hooks: `useToggleProductActive`, `useDeleteProduct`, `useSubmitReview`, `useDeleteReview`, `useReportProduct`.
- [x] **Shared-Components** (`components/shop/*`): Zehn Components — `<StarDisplay>` (half-star Support über fraktionalen Width-Clip) + `<StarPicker>` (interactive für Forms); `<ProductCard>` (3:4 Aspect mit Blur-Fill-Layer aus Native-v1.26.3 portiert, Sale `-XX%`-Badge, NEU-Badge wenn `created_at < 48h`, Kamera-Counter, Low-Stock-Amber-Pill, ♀-Badge, Seller-Row mit Verified-Check, Stars, Location + Free-Shipping-Pills, Strikethrough-Sale-Preis); `<ShopFilters>` (Client, URL-driven via `useSearchParams` + `useTransition` + `router.replace` → SEO-freundlich und shareable); `<ShopSearchInput>` (300ms debounced, schreibt `?q=` zum aktuellen Path); `<ImageCarousel>` (Aspect-Square Snap-Scroll mit Blur-Fill-Layers, Hover-Chevrons, Thumbnail-Strip); `<QuantityStepper>` (`[−] NN [+]` mit Min/Max-Clamp); `<BuyBar>` (Sticky Bottom-Bar mit Bookmark-Circle, conditional Quantity-Stepper, Split-Design-CTA `[price | action-text]`, Confirm-Dialog mit Produkt-Preview + Balance-after-Calc, Success-Panel mit Redirect zu `/studio/orders`); `<ReviewList>` + `<ReviewForm>`; `<StudioProductRow>` (Studio-List-Entry mit Thumbnail, Status-Pill, Price/Stock/Sold-Stats, Dropdown-Actions); `<OrderRow>` (Order-List-Entry mit Status-Dropdown fürs Seller-Role); `<ProductForm>` (shared Create/Edit mit Category-Cards, Title 80-char, Description 2000-char, Price + Sale-Price mit live -XX%-Badge, Stock + Location, Cover + Gallery max 10 URLs via input-then-add, Free-Shipping + Women-Only-Toggles, Live-Preview-Sidebar auf `lg:` mit Card-Mock).
- [x] **`/shop` Catalog** (`app/shop/page.tsx`): `grid-cols-[260px_1fr]` Sidebar-Layout, Coin-Balance-Pill + „Gemerkt"-Link im Header, 4/5-Spalten-Product-Grid responsive (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5`). Filter-Sidebar ist sticky mit URL-State (SEO-friendly, shareable). Empty-State wenn Filter zu leer.
- [x] **`/shop/[id]` Product-Detail** (`app/shop/[id]/page.tsx`): Breadcrumb, 2-col Layout (Carousel links, Info rechts), Category+Sale+Women-Only-Badges, Stars, Preis mit Strikethrough bei Sale, Info-Pills (Free-Shipping/Location/Sold/Low-Stock), Stock-Bar, Seller-Card mit „Shop besuchen"-Link, collapsible Description via native `<details>`, Reviews-Section mit conditional ReviewForm (nur wenn `getEligibleOrderForReview()` != null — also wenn Käufer + Order-Completed), Related-Products-Grid vom gleichen Seller (4-Item). Sticky-BuyBar unten — delegiert an `useBuyProduct()`-Hook → Native-RPC → 70/30-Split.
- [x] **`/shop/saved` + `/u/[username]/shop`**: Beide als Server-Components mit identischem ProductCard-Grid. Saved gated mit `getUser()` → redirect `/login?next=/shop/saved`. Merchant-Shop lädt über `getPublicProfile(username)` + `getMerchantProducts(profile.id)`, zeigt Profile-Header mit Avatar/Verified-Badge/Bio + Produktzähler, `generateMetadata` liefert OG-Tags mit Avatar.
- [x] **`/studio/shop` Dashboard** (`app/studio/shop/page.tsx`): 4 KPI-Cards (Produkte, Aktiv, Verkauft, Umsatz), Actions-Nav (Analytics, Bestellungen, Neues Produkt), Studio-Row-Liste mit Per-Row-Actions (Edit/Preview/Activate-Deactivate/Delete via Confirm-Dialog).
- [x] **`/studio/shop/new` + `/studio/shop/[id]/edit`**: Beide mounten `<ProductForm existing={null|product}>`. Edit-Page hat Ownership-Guard (`product.seller_id !== user.id` → redirect `/studio/shop`) als Defense-in-Depth zusätzlich zur RLS-UPDATE-Policy.
- [x] **`/studio/orders`** (`app/studio/orders/page.tsx`): Role-Toggle (Käufe/Verkäufe) via URL-Param `?role=buyer|seller`, 3 KPI-Boxen (Bestellungen/Abgeschlossen/Ausgegeben oder Umsatz-brutto), Order-Row mit Thumbnail, Status-Pill, Counterparty-Link, `delivery_notes` + Download-Link (nur digital + status=completed), Status-Dropdown (pending/completed/cancelled/refunded) für Seller-Role.
- [x] **`/studio/shop/analytics`** (`app/studio/shop/analytics/page.tsx`): Top-Performer-Ranking mit Revenue-Bars (gradient fills, Breite proportional zum Max-Revenue), Sold-Counts + Stars + Review-Counts, 4 KPI-Cards (Produkte/Mit Verkäufen/Verkaufte Einheiten/Netto-Umsatz). Netto = Brutto × 0.7 (30% Plattform-Cut dokumentiert im Footer).
- [x] **Web-exklusiv vs. Native**: Radix-Dropdown-Menu für Studio-Row-Actions (Native hat Alert-Dialogs), URL-driven Filter-State im Catalog (Native hat In-Memory-State), Live-Preview-Sidebar im ProductForm (Native zeigt nur die fertige Card nach Save). Echte Drag-Drop-Upload auf R2 kommt Phase 8 — bis dahin werden Cover + Gallery als URL-Strings eingegeben.

### v1.w.3 — Feed + Explore + Search (2026-04-20)
- [x] **Feed-Data-Layer** (`lib/data/feed.ts`): Sechs React-`cache()`-gewrappte Reads — `getForYouFeed({ limit, cursor })` (versucht zuerst RPC `get_vibe_feed`, fällt bei Fehler auf `posts`-SELECT mit Likes/Views-ORDER zurück — kein 500 wenn der Algorithmus-RPC in einer Edge-Region hickups hat), `getFollowingFeed({ limit, before })` (JOIN über `follows` auf `auth.uid()`, sortiert `created_at DESC`), `getTrendingHashtags(limit)` (aggregiert `post_hashtags` mit Window-Function für `post_count` + `total_views`), `searchAll(query, limit)` (parallel Users/Posts/Hashtags via `Promise.all`, ILIKE + GIN-Match), `getSuggestedFollows(limit)` (Top-N Creator die Viewer noch NICHT followed — excludes-subquery gegen `follows`), `getFeaturedCreators(limit)` für die Landing-Strip-Wiederverwendung. Alle SSR-reads tauschen Author-Joins auf den `Array.isArray`-Normalize-Pattern der v1.w.2-Layer.
- [x] **Engagement Server Actions** (`app/actions/engagement.ts`): `togglePostLike(postId, liked)`, `togglePostBookmark(postId, saved)`, `toggleFollow(userId, following)`, `createComment(postId, body)`, `deleteComment(commentId)`, `sharePost(postId)`. Alle guardieren `requireUser()` (throwt zurück `{ ok: false, error }` — Client zeigt Toast). Direkt-Table-Ops auf `post_likes` / `post_bookmarks` / `follows` / `post_comments` — RLS enforced authorship. Kein `revalidatePath` im Hot-Path (Client optimistic, Server reconciliert via Query-Invalidation).
- [x] **Mutation-Hooks** (`hooks/use-engagement.ts`): `useTogglePostLike`, `useTogglePostBookmark`, `useToggleFollow`. Alle drei optimistic mit `onMutate` → `setQueryData` über alle `['feed', ...]` + `['post', id]` Keys, `onError` rolled auf Snapshot zurück, `onSettled` invalidiert die relevanten Keys. Like-Toggle mutiert Counters lokal (`like_count += 1/-1`) damit die UI ohne Refetch updatet. Follow-Hook invalidiert zusätzlich `['suggestions']` damit der Right-Sidebar-Strip den Followed-User rausnimmt.
- [x] **`<FeedCard>`** (`components/feed/feed-card.tsx`): Vertikaler 9:16 Post mit `<VideoPlayer>`-Reuse aus v1.w.2. Right-Action-Column (TikTok-Pattern): Author-Avatar mit Follow-Plus-Badge, Like/Comment/Bookmark/Share-Icons mit Counter-Pills darunter. Author-Footer unten (Username + Caption mit Hashtag-Links zu `/t/[tag]`). `typedRoutes`-sauber: `import type { Route } from 'next'` + `as Route` auf alle dynamischen Links — der Workspace hat `typedRoutes: true` in `next.config.mjs` gesetzt, unsauberer Cast würde den Build brechen.
- [x] **`<FeedList>`** (`components/feed/feed-list.tsx`): Vertikaler Snap-Scroll-Container via `snap-y snap-mandatory`. Active-Post-Detection via `IntersectionObserver` mit thresholds `[0, 0.25, 0.5, 0.6, 0.75, 1]` — der Post mit dem höchsten Ratio > 0.6 wird aktiv, alle anderen Videos pausieren (verhindert dass zwei Videos gleichzeitig audio playen). Keyboard-Shortcuts via `window.addEventListener('keydown')`: J/↓ next post, K/↑ prev post, L toggle-like (no-op für Unauth), M global mute-toggle (via shared `volume`-Context), Space pause/play active video, ? togglt den One-Time-Hint-Popover (gated via `sessionStorage['serlo.feed.hintShown']`). `document.activeElement`-Check skippt Shortcuts wenn Fokus in INPUT/TEXTAREA/contentEditable — sonst hijacken wir das Comment-Compose. Initial-Posts werden beim Mount in die TanStack-Caches unter BEIDEN Keys (`['feed']` und `['feed', feedKey]`) gesynct, damit Tab-Switch kein Loading-Flash zeigt.
- [x] **`<HomeFeedShell>`** (`components/feed/home-feed-shell.tsx`): 3-Spalten-Grid `xl:grid-cols-[260px_1fr_320px]` (Left-Sidebar, Feed-Column, Right-Sidebar). **Wichtig**: Radix Tabs mussten auf native `<button role="tab">`-Elemente refactored werden — der Workspace-Root hat `@types/react@19.1.17`, aber `@radix-ui/react-tabs@1.1.1` zieht nested `@types/react@18.3.x` als peer-dep rein → `TabsPrimitive.List cannot be used as a JSX component`. Die `components/ui/tabs.tsx`-Datei wurde zu einem Stub mit `export {};` gemacht (File-Delete scheitert an mount-level readonly), deutsches Comment-Block dokumentiert die Re-Enablement-Bedingung (Radix-Version heben). Following-Tab lazy-loadet: `useQuery` mit `enabled: tab === 'following' && initialFollowing === null` — spart den Round-Trip wenn User auf For-You bleibt. `FeedSidebarRight` inline definiert (statt separater Datei) mit Suggested-Follows + Footer-Links (AGB/Datenschutz/Impressum).
- [x] **`<FeedSidebar>`** (`components/feed/feed-sidebar.tsx`): Left-Nav Server-Component mit neun Items (Feed/Explore/Folge ich/Live/Messages/Shop/Saved/Trending/Settings). Active-State via `usePathname()`. Items mit `requiresAuth: true` sind visuell dimmed (text-muted-foreground) wenn `viewerId` null — Links funktionieren trotzdem, die Middleware-Guards leiten dann auf `/login?next=…`. Live/Messages/Shop sind mit „Phase X"-Tooltip-Labels markiert — optisch präsent aber funktional Platzhalter bis der jeweilige Milestone landet.
- [x] **`<CommentSheet>`** (`components/feed/comment-sheet.tsx`): Client-Sheet mit TanStack-Query direkt gegen `post_comments` (RLS erlaubt öffentliches Lesen). `CommentRow`-Sub-Component mit Avatar + Author-Link + Body + relativer Zeit. Textarea mit Enter-to-send, Shift+Enter für Newline, 500-char-Cap. Like-Button auf Kommentaren als „Phase 4"-Stub disabled. `date-fns` war NICHT installiert — statt Dep hinzuzufügen wurde ein inline `formatAgo()`-Helper geschrieben (cascade 1s/1m/1h/1d/1w/1mo/1y). Respektiert `post.allow_comments === false` durch Lock-Icon + Hinweis statt disabled Input (klarere UX-Signal).
- [x] **`/api/feed/following` Route** (`app/api/feed/following/route.ts`): `runtime: 'nodejs'`, `dynamic: 'force-dynamic'`. Delegiert an `getFollowingFeed()`, fängt Errors ab und returned `[]` (200 OK) — der Client-Hook soll nicht auf Fehler branchen müssen, leere Liste = Skeleton-ausblenden.
- [x] **`/` Auth-Branch** (`app/page.tsx`): Unauth → `<LandingPage>` (extracted in `components/landing-page.tsx` — Hero + Value-Cards + Discovery-Strip von v1.w.2 Server-Component-Strukturerhalten). Auth → `<HomeFeedShell>` mit `Promise.all([getForYouFeed, getSuggestedFollows, count-follows])`, Following-Feed wird nur SSR-geladen wenn User überhaupt Folgen hat (`hasFollows === true`) — sonst `initialFollowing: null` → Client lädt on-demand. `dynamic: 'force-dynamic'` weil der Feed User-specific ist.
- [x] **`/explore`** (`app/explore/page.tsx`): `revalidate: 900` (15 min). Trending-Hashtags in 2/3/4-Spalten-Grid mit Rank-Zahl + Post/View-Counts. „Populäre Posts"-Preview-Strip mit 6 Thumbnails (2/3/4/6-col responsive). Alle Hashtag-Cards linken zu `/t/[tag]` (encodeURIComponent für Sonderzeichen), alle Posts zu `/p/[id]`. Metadata: DE-Titel + Description für SEO.
- [x] **`/search`** (`app/search/page.tsx`): `dynamic: 'force-dynamic'`. Next 15 Promise-wrapped `searchParams` (`q?: string`, `tab?: string`). Tab-Navigation bewusst via `<Link>`s statt Client-State — jeder Tab ist eine eigene URL (`?q=…&tab=users|posts|hashtags`), SEO-friendly und Back/Forward-Button-kompatibel. Min-Query-Length 2, drunter zeigt Dashed-Border-Prompt. Results in drei Sections: User-Liste (Avatar+Username+Follower-Count), Posts-Grid (2/3/4-col Thumbnails), Hashtags-Cards-Grid. Empty-State mit Quoted-Query wenn alle drei leer.
- [x] **`<SearchBox>`** (`components/search-box.tsx`): Client-Component, `useTransition` für den `router.push('/search?q=…')` (Loader-Icon während Navigation). Trim + Min-2-Chars-Guard client-side (Server re-checkt). Shared zwischen Search-Page-Header und später Site-Header (wenn Phase-3-Follow-up den Suchboxen-Slot im SiteHeader aktiviert).
- [x] **TypeCheck grün**: Alle Phase-3-Dateien passieren `npx tsc --noEmit` ohne Errors. Bestehende Typecheck-Issues in `auth/login/onboarding/signup/middleware/server/shared-schemas` sind out-of-scope und unverändert aus v1.w.1 — werden beim nächsten Type-Refactor gesammelt adressiert.

### v1.w.2 — Public SEO Pages (2026-04-20)
- [x] **Public Data Layer** (`lib/data/public.ts`): Sechs React-`cache()`-gewrappte Supabase-Reads — `getPublicProfile(username)`, `getProfilePosts(userId, limit, before)`, `getPost(postId)`, `getPostComments(postId, limit)`, `getStory(storyId)`, `isFollowing(targetUserId)`. Alle nutzen `.maybeSingle()` für 404-safe Reads. `getPost`/`getPostComments`/`getStory` holen Author-Profil via Supabase-Relationship-Join (`profiles!posts_user_id_fkey`), mit `Array.isArray`-Normalisierung. `getStory` hat zusätzlichen 24h-TTL-Guard (Defense-in-Depth falls der DB-Cleanup-Cron zickt). `isFollowing` skipped den Auth-Call komplett für Unauth-User → 0ms Overhead auf Public-Views.
- [x] **`/u/[username]` Profile-Page** (`app/u/[username]/page.tsx`): Server-Component mit ISR `revalidate: 60`. Hero: Avatar (Ring), Display-Name + Verified-Badge, Stats-Pills (Posts/Follower/Folgt), Bio. `generateMetadata` liefert OG/Twitter-Tags + Canonical + Profile-Schema. Tab-State via URL-Query-Param (`?tab=posts|likes|shop|battles`). `getProfilePosts` wird nur bei aktivem Posts-Tab gefetcht — spart Calls auf Tab-Switch. JSON-LD `ProfilePage` + `Person` inline via `<script type="application/ld+json">`. `notFound()` wenn Profil null → `not-found.tsx` greift.
- [x] **Profile-Komponenten**: (a) `<PostGrid>` Server-Component: 3-col Grid (`grid-cols-3 gap-1`), 9:16 Cards, Next/Image mit `fill`+`sizes`, View-Count-Pill unten-links mit Gradient-Fade. `formatCount` (1.2M/3.4K). Placeholder-Gradient für Posts ohne Thumbnail. (b) `<ProfileTabs>` Client-Component: Segmented-Control, URL-Sync via `router.replace()` in `useTransition` (kein Full-Navigation), Underline-Indicator auf Active. `tab=posts` entfernt den Query-Param (sauberere Default-URLs). (c) `<FollowButton>` Client: Phase-2-Stub — zeigt korrekten State (Self/Unauth/Following/NotFollowing), bei echtem Follow-Click Toast „Feature in Phase 3". Unauth → `/login?next=/u/{username}`.
- [x] **`/p/[postId]` Post-Detail** (`app/p/[postId]/page.tsx`): ISR 60s, 2-col Desktop-Layout (Player links, Sidebar rechts mit Autor/Caption/Share). Stats-Zeile unter dem Player (Views/Likes/Comments/Shares). Hashtag-Links zu `/t/[tag]` (Tag-Routes folgen Phase 3). Sound-Hint wenn `music_id` gesetzt. JSON-LD `VideoObject` mit `InteractionCounter` für Views+Likes, `uploadDate`, ISO-8601-`duration` (PT{n}S), `author.Person` mit URL zur Profile-Page. Twitter-Metadata mit `card: player`, `streamUrl` direkt zum Video — X rendert das inline im Feed.
- [x] **`<VideoPlayer>` Component** (`components/video/video-player.tsx`): Client-Component mit Dynamic-Import von `hls.js` (spart ~70KB Bundle für Browsers mit nativem HLS). Logik: MP4 → direkter `video.src`, Safari/iOS → `canPlayType('application/vnd.apple.mpegurl')` → native, sonst → `hls.js`-Instance mit `lowLatencyMode: false, maxBufferLength: 20` (VOD-optimiert). Loading-/Error-States mit Lucide-Icons. `preload: metadata`, `playsInline` (iOS-Inline statt Fullscreen-Modal), keine DRM-Ansprüche, Download bleibt erlaubt. Cleanup: `hlsInstance.destroy()` + `video.load()` beim Unmount oder `src`-Change.
- [x] **`<ShareButtons>`** (`components/share/share-buttons.tsx`): Web Share API wenn verfügbar (mobile Safari/Chrome), sonst Clipboard-Copy-Fallback. Direkt-Links zu WhatsApp (`wa.me`), Telegram (`t.me/share`), X (`twitter.com/intent/tweet`). Icons sind **inline-SVG** — keine CDN-Abhängigkeit (CSP-sauber). Absolute-URL-Konstruktion für relative Inputs (Web Share API droppt sonst auf einigen Plattformen). User-Cancel wird als AbortError erkannt und **nicht** als Fehler gemeldet.
- [x] **`<PostComments>`** Server-Component: Read-only Rendering der neuesten 20 Kommentare mit Avatar, relativer Zeit („vor 3 Min", „gestern", Datum), Like-Count. Respektiert `post.allow_comments` (deaktiviert → Lock-Icon + Hinweis). „Zum Mitreden: App öffnen"-CTA — keine disabled Input-Fields (UX-Entscheidung: klare Trennung statt verwirrende Platzhalter).
- [x] **`/s/[storyId]` Story-Viewer** (`app/s/[storyId]/page.tsx`): `dynamic: 'force-dynamic'` + `revalidate: 0` — Stories dürfen NIE gecacht ausgeliefert werden (TTL-Korrektheit geht vor Performance). Countdown-Anzeige „läuft in X Std Y Min ab", 9:16 Media-Canvas, Image-Fallback für `media_type === 'image'`. Metadata: `robots: { index: false, follow: true }` — Crawler-Preview (WhatsApp etc) darf OG-Tags fetchen, aber Google soll nicht permanent indexieren.
- [x] **OG-Image-Routes** via Next.js 15 native `next/og` (statt separatem `@vercel/og`-Package — spart Dep): `app/u/[username]/opengraph-image.tsx` + `app/p/[postId]/opengraph-image.tsx`. 1200×630 Edge-Runtime-Renders. Profil zeigt Avatar (180px) + Display-Name + Bio-Preview + Follower/Posts-Stats mit Serlo-Gold-Akzent. Post-OG zeigt Thumbnail links (380px cover), rechts Caption in großer Type + Author-Footer mit Views-Count. Fallback auf generisches Serlo-Cover bei fehlendem Thumbnail / 404. Satori-kompatibles CSS (flex/absolute/padding — keine grid-layouts, keine CSS-Vars).
- [x] **`/p/[postId]/not-found.tsx` + `/u/[username]/not-found.tsx` + `/s/[storyId]/not-found.tsx`**: Freundliche 404-Pages mit Brand-Look, Lucide-Icons (UserX/VideoOff/Clock3), CTA zurück zur Startseite. Post-404 unterscheidet **absichtlich nicht** zwischen „gelöscht" und „never existed" — Privacy-Schutz gegen Fishing-Attacks.
- [x] **Global Error-Boundary** (`app/error.tsx`): Client-Component (Next-Convention), fängt Server-Errors aus allen Pages ab. Zeigt „Nochmal versuchen"-Button (via `reset()`) + Home-Link. `error.digest` wird in Dev geloggt, in Prod von Sentry-Wiring gepickt. Subtle styling (rote Alert-Icon auf Red-Tint-Circle) — signalisiert Fehler ohne zu dramatisieren.
- [x] **`sitemap.xml` + `robots.ts`**: Dynamisch generiert via Next-15-Metadata-Files. Sitemap holt Top-1000 Profile + Top-5000 Posts (nach Follower/View-Count), gecacht mit `revalidate: 3600`. Fallback bei Supabase-Error: nur statische Routes ausliefern — nie 500 auf `/sitemap.xml`. Robots blockiert `/api/`, `/auth/`, `/settings`, `/onboarding`, `/s/` (ephemer → keine Indexierung).
- [x] **Landing-Page Discovery-Strip** (`app/page.tsx`): 6-Creator-Grid mit Avatar + Display-Name + Follower-Count als klickbare Cards zu `/u/[username]`. Ankert die Public-Profile-Routes im SEO-Crawl-Graph — Google findet darüber die Profile, Profile verlinken zu Posts, Posts haben JSON-LD. `revalidate: 300` für die Landing-Page, Fehler beim Featured-Query wird geschluckt (leerer Strip > 500 auf Homepage).
- [x] **`hls.js` als Dep** in `package.json` eingetragen (`^1.5.17`). User muss lokal `npm install` laufen lassen bevor der Dev-Server neue Pages mit `<VideoPlayer>` rendert. `@vercel/og` bewusst **nicht** hinzugefügt — Next 15 hat `next/og` mit identischer `ImageResponse`-API nativ, vermeidet Version-Drift.

### v1.w.1 — Auth & Onboarding (2026-04-20)
- [x] **Magic-Link Auth** (`app/actions/auth.ts`): Server-Action `signInWithMagicLink(email)` via Supabase `signInWithOtp` mit `shouldCreateUser: true` (Magic-Link doppelt als Sign-Up). Email-Validation via Zod (trimmed + lowercased). `emailRedirectTo` mit `?next=` encodiert, damit der Callback das Ursprungs-Ziel kennt. `getOrigin()` helper liest `NEXT_PUBLIC_SITE_URL` oder fällt auf Request-Headers zurück (Dev + Vercel-Preview).
- [x] **OAuth Flow** (Google + Apple): Server-Action `signInWithOAuth(provider, next)` die `redirectTo` mit Callback-URL + `next`-Param setzt, dann via `redirect()` zum Provider weitergibt. Frontend-Component `OAuthButtons` mit inline Google-Farb-SVG und Apple-Glyph, `useTransition` für Disabled-States während des Redirects. Frontend ready — Provider-Enablement im Supabase-Dashboard dokumentiert in `apps/web/docs/oauth-setup.md`.
- [x] **Auth Callback** (`app/auth/callback/route.ts`): PKCE `exchangeCodeForSession(code)`, dann Profile-Check (`SELECT username FROM profiles WHERE id = user.id`). Wenn kein Username → Redirect zu `/onboarding?next=…`, sonst direkt zu sanitized `?next=` Ziel. Open-Redirect-Schutz: `next` muss mit `/` starten und darf nicht mit `//` (Protocol-Relative-URL) beginnen. Error-Param-Bouncing zurück zu `/login?error=…` bei OAuth-Abbruch oder Code-Exchange-Fail.
- [x] **Username-Picker** (`app/onboarding/page.tsx` + `components/auth/username-picker-form.tsx`): React-Hook-Form + Zod `usernameSchema` (aus `shared/schemas/profile.ts` wiederverwendet — Single-Source-of-Truth mit Native). Debounced Availability-Check (400ms nach letztem Keystroke) gegen `checkUsernameAvailable(raw)` Server-Action, zeigt inline `Check`/`X`/`Loader2` Icons rechts im Input. Submit-Button disabled solange nicht `'available'`. TOCTOU-Guard: `claimUsername` re-checkt Server-Side vor dem Upsert (schützt gegen Race zwischen Pre-Check und Submit).
- [x] **SSR Auth-Helper** (`lib/auth/session.ts`): `getUser()` + `getProfile()` gecached via React-`cache()` (Request-Scoped-Memoization, verhindert N+1-Calls in Server-Components). `requireUser()` als Throw-Variante für defense-in-depth innerhalb von Components. Profile-Select holt genau die 6 Felder die die UI braucht (`id, username, display_name, avatar_url, coins_balance, bio`).
- [x] **Login/Signup Pages**: `/login` + `/signup` mit identischem Surface (Email-Form → „oder" Divider → OAuth-Buttons). Already-Logged-In-Guard: redirect zu `?next=` falls User schon eine Session hat. Error-Banner oben wenn `?error=…` in Query-Params (aus Callback-Route). Signup hat zusätzlich Legal-Links zu Terms + Privacy (Pages kommen Phase 12). Beide Seiten nutzen Serif-Heading + zentriertes Layout.
- [x] **SiteHeader** (`components/site-header.tsx`): Server-Component, lädt User + Profile einmal pro Request (gecached). Eingeloggt: Coins-Balance-Pill (versteckt auf `<sm`) + Avatar-Dropdown mit `@username`, Email in DropdownLabel, Links zu Profil/Settings, Abmelden via inline `<form action={signOut}>`. Nicht eingeloggt: Ghost-„Einloggen" + solid „Account erstellen" CTAs. Sticky + Backdrop-Blur für smoothen Scroll-Übergang.
- [x] **Protected-Routes-Gate** (bereits aus Phase 0): Middleware in `lib/supabase/middleware.ts` redirected unauthenticated Users zu `/login?next=<pathname>` wenn sie `/studio`, `/messages`, `/settings`, oder `/create` öffnen. Aktiv verifiziert durch Phase-1-Tests.
- [x] **shadcn-Primitives erweitert**: `Input` (h-11, focus-ring, file-styles), `Label` (Radix-Label-Primitive), `Form` (react-hook-form Controller-Wrapper + FormField/FormItem/FormLabel/FormControl/FormDescription/FormMessage), `DropdownMenu` (Radix-Dropdown mit allen Sub-Primitives). Keine neuen Dependencies — alles war schon in Phase-0-`package.json` drin.
- [x] **OAuth-Setup-Dokumentation** (`apps/web/docs/oauth-setup.md`): Vollständige Walkthroughs für Google Cloud Console (Consent Screen + Credentials + Redirect-URIs) und Apple Developer Portal (Services ID + Sign In with Apple + .p8 Key + JWT-Secret-Generation via Supabase Dashboard). Production-URL-Config-Sektion für späteren Deploy, Troubleshooting-Liste für typische Stolpersteine.

### v1.w.8 — Create / Upload-Flow (Phase 8 shipped)
- [x] **Posts-Data-Layer** (`lib/data/posts.ts`): Vier `cache()`-gewrappte SSR-Reads + zwei Autocomplete-Helpers — `getMyDrafts()` (sortiert `updated_at DESC`, limit 100), `getDraft(id)` (einzelner Draft für Resume-Editing via `?draftId=…`; RLS gatet Ownership), `getMyScheduledPosts()` (alle eigenen Scheduled, `publish_at ASC` → nächster Post oben), `getTrendingHashtagSuggestions(prefix)` (scannt die letzten 300 öffentlichen posts.tags, Prefix-Match case-insensitive, cap 8), `getMentionSuggestions(prefix)` (Profiles-ILIKE auf username). Cross-Platform-Parität: liest dieselben Tabellen (`post_drafts`, `scheduled_posts`, `posts`) wie Native — jeder Draft/Scheduled-Post den der User auf dem Handy anlegt ist sofort im Web sichtbar und umgekehrt.
- [x] **Server-Actions** (`app/actions/posts.ts`): Acht Actions — `publishPost` (direkter `posts`-INSERT, RLS schützt `author_id`, Tag-Sanitize auf max 10× 64-char + Lowercase + `#`-Prefix, nach-Publish automatisches Draft-Löschen wenn `draftId` gesetzt war), `schedulePost` (delegiert an Native-RPC `schedule_post` mit allen 16 Args, auto-`delete_post_draft` wenn aus Draft geplant), `reschedulePost` + `cancelScheduledPost` (RPC-Delegates), `saveDraft` (RPC `upsert_post_draft` — `p_id=null` INSERT, sonst UPDATE), `deleteDraft`, `requestR2UploadUrl` (Server-Side-Proxy auf Edge-Function `r2-sign`, prüft dass Key mit erlaubtem Prefix `posts/videos/|posts/images/|thumbnails/` UND `/{viewerId}/` enthält — verhindert Upload in fremde Ordner), `searchHashtagSuggestions` + `searchMentionSuggestions`. Rate-Limits: 5s/Publish, 2s/Schedule, 500ms/Draft pro User; `Map<string,number>` Tracker mit FIFO-Cap 5000.
- [x] **`/create`** (`app/create/page.tsx` + `components/create/create-editor.tsx`): SSR-Auth-Gate + optional `?draftId=…`-Resume. Client-Editor (~750 LOC) in sauberen Sektionen: (a) Drop-Zone mit Drag/Drop + Click-to-pick, 200MB-Video-/50MB-Image-Limit (Native-Parity), Aspect 9:16 Placeholder. (b) Media-Preview mit Remove/Replace-Buttons. (c) Upload-Flow: XHR-PUT an presigned R2-URL mit Echtzeit-Progress (0–100%), Video-Thumb via Canvas-Frame-Extract zum aktuellen `coverTimeMs` → zweiter R2-Upload (best-effort, Thumb-Fehler blockt Post nicht). (d) Caption-Textarea mit 2200-char-Cap + inline Hashtag-/Mention-Autocomplete (Cursor-basiertes Token-Probing, 200ms debounce, race-safe via `searchTokenRef`, Pfeiltasten/Enter/Tab/Esc-Keyboard-Nav, onMouseDown statt onClick damit Blur-Hide nicht greift). (e) Tag-Chips-Input (Enter oder `,` fügt hinzu, Backspace auf leerem Input entfernt letzten Tag, 10er-Cap). (f) Privacy-Panel: 3-Button-Grid (Globe/Users/Lock), darunter 4-Toggle-Row (Kommentare/Duette/Download/Women-Only). (g) Action-Block: „Jetzt posten" + Grid-2 „Planen"/"Entwurf".
- [x] **Cover-Frame-Picker**: `<VideoPreview>` mit Overlay-Button (Kamera-Icon), klappt Range-Slider auf (0 → `duration * 1000`), Live-Seek im Video-Element, Canvas-`toBlob('image/jpeg', 0.85)` extrahiert den Frame beim Publish/Schedule-Call. Fallback 0ms wenn User nichts ändert — Thumbnail-Fehler ist best-effort (Post funktioniert auch ohne). Orientierungs-Anzeige mit `(coverTimeMs/1000).toFixed(1)s`.
- [x] **Schedule-Modal**: Big-Date-Display + 6 Preset-Chips („In 1h", „In 3h", „Heute 20:00", „Morgen 09:00", „Morgen 18:00", „In 3 Tagen" — Past-Time-Presets auto-disabled), native `type=date` + `type=time` Inputs mit Min/Max-Clamp (≥1min future, ≤60 Tage — Native-RPC-Constraints gespiegelt clientside für Fast-Feedback), relative-Future-Label („in 47 Min."/„in 3 Tagen"). Confirm-Button disabled wenn Constraints verletzt.
- [x] **`/create/drafts`** (`app/create/drafts/page.tsx` + `components/create/draft-row-actions.tsx`): Chronologische Liste (`updated_at DESC`), 64×64-Thumb (aus `thumbnail_url` oder Image-`media_url` oder FileText-Placeholder für Nur-Caption-Drafts), Caption-Preview mit Italic-Fallback, Meta-Row (relative Time, Media-Type, Tag-Count). Tap auf Row → `/create?draftId=…` Resume. Löschen-Button mit Soft-Confirm (erster Klick = Red-Pill mit „Löschen"-Label, 3s Timeout, zweiter Klick führt aus) — konsistent mit Native-Swipe-to-Delete-Feeling.
- [x] **`/create/scheduled`** (`app/create/scheduled/page.tsx` + `components/create/scheduled-row-actions.tsx`): Zwei Sektionen — „Aktiv" (pending/publishing/failed — brauchen User-Aufmerksamkeit) und „Archiv" (published/cancelled). Pro Row: Status-Pill (Clock-blau „Geplant", Clock-amber „Wird gepostet…", Check-green „Live", Alert-red „Fehler", Ban-grau „Abgebrochen"), Absolute-Time (`DD.MM.YYYY · HH:MM`), Caption-Preview, Failed-Rows zeigen `last_error` (clipped auf 80 Zeichen, volltext via `title`-Tooltip). Aktive Rows haben Umplanen-Button (Popover mit Date-/Time-Input, Client-Side ≥1min-Check) und Abbrechen-Button (Soft-Confirm). Published-Rows linken zu `/p/{published_post_id}` via „Ansehen"-Pill.
- [x] **Sidebar erweitert** (`components/feed/feed-sidebar.tsx`): Drei neue Einträge für eingeloggte User — „Post erstellen" (PlusCircle → `/create`), „Entwürfe" (FileText → `/create/drafts`), „Geplant" (Clock → `/create/scheduled`). Auth-gated, erscheinen zwischen Messages und Shop.
- [x] **Zero-Backend-Fork**: Kein neues Table, kein neues RPC, keine neue Edge Function. Web konsumiert exakt dieselben Tabellen (`posts`, `post_drafts`, `scheduled_posts`), Native-RPCs (`schedule_post`, `reschedule_post`, `cancel_scheduled_post`, `upsert_post_draft`, `delete_post_draft`) und die bestehende `r2-sign`-Edge-Function. Published-Path: pg_cron ruft minütlich `publish-scheduled-posts`-Edge, RPC `publish_due_scheduled_posts` materialisiert fällige `scheduled_posts` → `posts` und sendet den „Post ist live"-Push — alles client-agnostisch, Web-geplanter Post kann auf dem Handy publishen und umgekehrt.

**Bewusst deferred auf Phase 8b**:
- [ ] Music-Picker (Native-Library ist hardcoded in `MUSIC_LIBRARY` + Player-Preview → eigener 8b-Slice weil Audio-Handling auf Web eigene Design-Fragen aufwirft: Autoplay-Policy, Mixing-UX)
- [ ] ffmpeg.wasm-Trimming (13MB WASM + komplette Timeline-UI → eigenständige Investition)
- [ ] CSS/WebGL-Filter-Presets
- [ ] Stories-Creator (Phase 11 — gehört thematisch zur Stories-Story, nicht zum Post-Upload)
- [ ] Kamera-Mode (MediaRecorder-API-Capture statt File-Pick)

### v1.w.7 — Messaging / DMs (Phase 7 shipped)
- [x] **Messages-Data-Layer** (`apps/web/lib/data/messages.ts`): Sechs `cache()`-wrapped SSR-Reads. `getConversations` delegiert an Native-RPC `get_conversations()` — dieselbe batched Query die Native nutzt: other-User + letzte-Message + Unread-Count in einem Call (vermeidet N+1). Zusätzliches Ableitungs-Feld `is_self: other_user_id === viewer.id` damit die Liste "Meine Notizen" rendern kann ohne zweite Query. `getConversationHeader` validiert Membership implizit via RLS — null-Return heißt 404 im Page-Layer. `getConversationMessages` lädt letzten 80 Messages via DESC-Query-reverse (neueste N dann oldest-first), lädt reply_to + post lazy mit `.in()`-Batch über die tatsächlich referenzierten IDs. `getConversationReactions` aggregiert (message_id, emoji) → { count, by_me } mit inner-join `messages!inner(conversation_id)` damit die RLS-Scope-Validation greift. `getUnreadDMCount` summiert über Conversation-Liste für den Header-Badge. `getProductShareContext` für Shop-Deeplink `?productId=…` (Minimal-Felder: title, cover, eff-price, seller-username).
- [x] **Messages-Server-Actions** (`apps/web/app/actions/messages.ts`): Sechs Actions — `getOrCreateConversation` (idempotent, sortiert Participants lexikographisch um UNIQUE-Invariant `participant_1 < participant_2` zu treffen, Self-Chat via `viewer === otherUserId` erlaubt), `sendDirectMessage` (500ms-Cooldown, 500-Char-Max, leer-validation, `content`/`image_url`/`post_id`/`reply_to_id`/`story_media_url` alle optional aber mind. eines muss gesetzt sein), `markConversationRead` delegiert an `mark_messages_read`-RPC (SECURITY DEFINER umgeht die Sender-Only-UPDATE-Policy), `toggleMessageReaction` liest vorher um INSERT vs. DELETE zu entscheiden (Unique-Index `(message_id, user_id, emoji)` würde sonst IntegrityError werfen), `deleteMessage` mit Sender-Guard (`sender_id = viewer` sowohl in der Query als auch RLS), `requestImageUploadPath` als Stub für Phase-7b-Media-Upload. Typing-Presence ist NICHT als Server-Action exportiert — Presence kann nur clientseitig via WebSocket getrackt werden.
- [x] **`/messages` Konversations-Liste** (`apps/web/app/messages/page.tsx`): Auth-Guard mit next-Redirect. Grid rendert 60×60-Avatare (konsistent mit Native v1.26.9). Pro Row: Avatar + Unread-Blau-Dot top-right (wenn unread_count > 0), Display-Name / @Username, letzte-Message-Preview (truncate), relative-Timestamp (jetzt/Xm/Xh/Xd/`dd.MM`), Unread-Badge-Count (99+ Cap). Self-Chat-Row zeigt "Meine Notizen" + Amber-Pink-Gradient-Avatar mit Bookmark-Icon. Leer-State mit Suche-CTA. `dynamic = 'force-dynamic'` weil Conversation-State pro-User nicht cachebar.
- [x] **NewConversationButton** (`apps/web/components/messages/new-conversation-button.tsx`): Header-CTA öffnet Modal mit Profile-Search (`profiles.username ILIKE %q%`, 200ms-Debounce, Limit 20, Search-Token-Ref gegen stale-Result-Race). Pick → `getOrCreateConversation` → `router.push(/messages/{id})`. Modal-Klick-außen schließt, Input `autoFocus`, Loader-Spinner während Debounce aktiv.
- [x] **`/messages/[id]` Thread-Page** (`apps/web/app/messages/[id]/page.tsx`): SSR lädt Header + Messages + Reactions + optional Product-Share-Context in einem Promise.all. Header-Bar mit Back-Button (→ `/messages`), 10×10-Avatar (Link auf Profil), Name + Verified-Check + `@username`-Sub-Label. Self-Chat zeigt Bookmark-Avatar statt Profil-Avatar und wird NICHT zum Profil verlinkt. Alles Client-Interactive liegt in `MessageThread`.
- [x] **MessageThread** (`apps/web/components/messages/message-thread.tsx`, ~550 Zeilen): Kern-Client-Komponente. Fünf parallele Subscriptions/Effects:
  1. **Messages-Realtime** via `postgres_changes INSERT` auf `messages` mit `filter: conversation_id=eq.{id}` — Channel-Name `messages-{id}` matcht Native 1:1. Dedup-Pattern: pending-Optimistic-Messages werden durch die eingehende Realtime-Row ersetzt (Match auf `sender_id + content + abs(created_at-delta) < 5s`), dedup-Skip bei bereits vorhandener `id`.
  2. **Reactions-Realtime** via `postgres_changes *` auf `message_reactions` — refetcht und aggregiert pro Event (wenig Traffic, einfacher als Delta-Merge).
  3. **Typing-Presence** via `channel.track({ typing: boolean })` auf `typing-{id}`. `presenceState` filtert eigene Key, Any-True → Dots-Banner. Composer trackt `true` beim Keystroke, Auto-Stop nach 3s via `setTimeout`.
  4. **Read-Receipts** on-mount + `visibilitychange` (tab wird fokussiert) → `markConversationRead`-Action.
  5. **Auto-Scroll-Policy** — `wasNearBottomRef` verfolgt ob der User beim letzten Scroll am unteren Ende war (Threshold 120px). Neue Messages scrollen NUR wenn true — verhindert das Reißen wenn User alte Messages liest.
- [x] **MessageBubble** (memoized): Own/Other-Alignment, Reply-Context-Strip (rounded-top, border-left), Image-Thumbnail mit Lightbox-Link (new-tab), Post-Share-Card (Thumbnail + Author + Caption → `/p/{id}`), Content mit whitespace-pre-wrap + break-words, Time + Read-Receipt (✓/✓✓), Hover-Action-Bar absolute-positioned (Reply / React / Delete wenn own), Reaction-Pills unter der Bubble mit by_me-Active-State, Long-Press-Emoji-Picker (6 Emojis als Popover). Pending-Messages opacity-70 bis Realtime-Replace.
- [x] **Composer**: Textarea (auto-resize via `rows=1`), Enter-to-Send (Shift+Enter für Newline), 500-Char-Cap (synced mit Server-Action), Reply-Preview-Strip mit Cancel-Button, Product-Share-Strip mit Cover-Thumbnail + Title + Effective-Price + Cancel. Send-Button disabled wenn leer. ImagePlus-Button disabled mit Tooltip "Phase 7b". Typing-Presence-Tracking passiert im Composer da er die Keystroke-Events sieht.
- [x] **Product-Share-Deeplink**: `/messages/[id]?productId=…` SSR lädt Product-Context (title, cover, price, seller). Composer rendert ein Preview-Strip. Beim Senden wird ein Multi-Line-Content zusammengesetzt: optionaler Content + `🛍️ Title — 🪙 Price` + `/shop/{id}`-Link-Line. Vollwertige Product-Share-Card (eigene DB-Spalte `product_id` in messages) ist Phase 7b — der aktuelle Text-Fallback reicht für End-to-End-Flow.
- [x] **SellerChatButton** (`apps/web/components/shop/seller-chat-button.tsx`): Icon-Circle-Button (9×9) in der Seller-Karte auf `/shop/[id]`. `useTransition` + `getOrCreateConversation` → `router.push(/messages/{convId}?productId={productId})`. Nur gerendert wenn `user.id !== product.seller_id` (kein Self-Chat-Sinn aus dem eigenen Shop). Loader-Spinner während Transition. Inner `<div onClick={stopPropagation}>` verhindert dass der Click den umgebenden Profil-Link triggert.
- [x] **Semantik Self-Chat**: Supabase erlaubt `participant_1 = participant_2` (kein separater Self-Chat-Flag, nur Edge-Case der Normal-Conversation). Native nutzt das als "Meine Notizen" seit langem. Web-Normalization: wenn `otherUserId === viewer`, ergibt das Sortier-Tuple (viewer, viewer) — passt die UNIQUE-Constraint (participant_1 < participant_2 BYPASS: `participant_1 = participant_2` erlaubt weil `<` strikt ist, nicht `≤`). Small-print: Native-Schema hat exakt diesen Check `participant_1 < participant_2 OR (participant_1 = participant_2)` je nach Migration — wir verlassen uns auf dasselbe Verhalten. Falls das Schema strikt `<` prüft, schlägt Self-Chat-Create fehl — Mitigation wäre ein serverseitiger Try/Catch mit freundlicher Error-Message; kommt wenn Zaur den Fall in Prod sieht.
- [x] **Cross-Platform-Channel-Parität verifiziert**: `messages-{conversationId}` (Thread-Realtime), `message-reactions-rt-{conversationId}` (Reactions), `typing-{conversationId}` (Typing-Presence) — alle drei Channel-Namen matchen Native aus `lib/useMessages.ts`. Web ↔ Native-Interop out-of-the-box.
- [x] **Sidebar aktiviert**: `Phase 7`-Tag vom Messages-Entry in `components/feed/feed-sidebar.tsx` entfernt — Menüpunkt ist jetzt vollwertig navigierbar für eingeloggte User.
- [x] **Roadmap + Footer**: Phase-7-Checkboxen granular auf `[x]` gesetzt (9 shipped Items), 5 Items explizit als Phase-7b deferred notiert (Media-Upload, Voice-Messages, Search, Header-Badge, Infinite-Scroll). Footer-Next-Milestone auf Phase 8 (Create / Upload-Flow) umgestellt.
- [x] **Typecheck**: 27 bestehende Fehler unverändert (auth/middleware/shared-schemas — alle out-of-scope dokumentiert). 0 neue Fehler in allen Phase-7-Dateien (`messages.ts` × 2, `messages/page.tsx`, `messages/[id]/page.tsx`, `message-thread.tsx`, `new-conversation-button.tsx`, `seller-chat-button.tsx`, `shop/[id]/page.tsx`-Edit, `feed-sidebar.tsx`-Edit).

### v1.w.6 — Live Host / PC-Streamer (Phase 6 shipped)
- [x] **Host-Server-Actions** (`apps/web/app/actions/live-host.ts`): 11 Actions streng getrennt von Viewer-Actions für bessere Bundle-Splitting und klarere RLS-Boundaries. Delegieren an bestehende RPCs — keine Reimplementierung der atomaren Flows: `create_live_session` (Host-Identity aus JWT, `already_streaming`-Error-Mapping), `end_live_session`, `heartbeat_live_session` (v1.27.0-Integration), `accept_cohost_request` (Slot 1/2/3 validiert), `revoke_cohost`, Poll-Flow mit session-wide Pre-Close (v1.27.4-Pattern wegen `one-active-poll`-Invariant), Gift-Goal. `muteCoHost` ruft Edge-Function `livekit-moderate` — serverseitiger LiveKit-API-Mute, nicht client-trust (v1.27.3). `rejectCoHostRequest` ist pure Broadcast auf `co-host-signals-{id}` (kein DB-State) damit Viewer-Client pending-UI zurücksetzen kann.
- [x] **Host-SSR-Reads** (`apps/web/lib/data/live-host.ts`): Vier `cache()`-wrapped Reads — `getMyActiveLiveSession` (genau eine aktive Session des Users für `/live/start`-Redirect-Logik), `getMyPastSessions` mit client-computed `duration_secs = (ended_at - started_at) / 1000`, `getSessionGifts` mit Sender+Gift-Joins (Array/Object-Normalization für Supabase-Relations), `getActiveGiftGoal` mit `closed_at IS NULL` Filter + order by created_at desc.
- [x] **`/live/start` Setup-Screen** (`apps/web/app/live/start/page.tsx` + `components/live/live-setup-form.tsx`): Auth-Guard + Active-Session-Redirect (wenn bereits ein Stream läuft → `/live/host/${id}`). LiveSetupForm nutzt MediaDevices-API: initial-`getUserMedia({video, audio})` triggert Permissions, dann `enumerateDevices` liefert echte Device-Labels (vorher nur generische "camera 1"). Device-Switcher stoppt alte Tracks und fordert neue mit `{ deviceId: { exact: id } }`. Cam/Mic-Enable-Toggles setzen `track.enabled` auf dem lokalen Preview-Stream. Titel (3-120 chars) + Kategorie-Select (8 Optionen: gaming/music/talk/lifestyle/sport/education/creative/other) + Moderation-Checkbox. Go-Live-Button: `startLiveSession` → `sessionStorage.setItem('live-host-prefs-${sessionId}', {cam, mic, camEnabled, micEnabled})` → Preview-Tracks stoppen → `router.push('/live/host/${id}')`. sessionStorage statt URL-Query weil deviceIds Privat-Hinweise sind und tab-lokal bleiben sollten.
- [x] **`/live/host/[id]` Control-Deck** (`apps/web/app/live/host/[id]/page.tsx` + `components/live/live-host-deck.tsx`): Server-Component mit Auth + Ownership-Guard (`session.host_id !== user.id` → 404). Parallel-SSR holt Comments + Active-Poll + Gifts + Gift-Goal in einem Promise.all. Client-Deck verbindet zu LiveKit mit `adaptiveStream: false` (Host braucht Simulcast + Dynacast für beste Quality), publisht Tracks basierend auf sessionStorage-Prefs beim Mount. Layout: Sticky-Topbar mit LIVE-Badge (Ping-Animation) / Duration-Counter (Monospace, 1s-Tick) / Viewer-Count + Peak / Umfrage-Button + Stream-beenden-Button. Main-Column: Preview (16:9, Host hört sich NICHT selbst via `<video muted>`), Title-Inline-Edit, Sources+Health-Grid, CoHost-Queue, Gifts-Feed. Right-Column: LiveChat mit `isHost=true, isModerator=true` — die v1.27.2-Mod-UI rendert automatisch. Screenshare-Track bekommt einen kleinen PIP-Thumbnail bottom-right am Preview damit der Host sieht was er teilt. Keyboard-Shortcuts M/V/S/E mit Input-Guard damit Chat-Tippen nicht triggert.
- [x] **LiveSourcesPanel** (`components/live/live-sources-panel.tsx`): Drei Rows (Cam/Mic/Screen) — Toggle-Button + Device-Select. MediaDevices-Enumeration mit `devicechange`-Event-Listener → Geräte-Hotswap (Headset anstecken → erscheint sofort ohne Reload). Host-Deck behält Track-Ownership; dieses Panel ist pure UI + Callbacks.
- [x] **LiveStreamHealth** (`components/live/live-stream-health.tsx`): Bekommt `room: MutableRefObject<Room>` + `phase`. Polling alle 2s via `getRTCStatsReport()` auf Camera+Mic-LocalTracks → summiert `outbound-rtp.bytesSent`, delta-to-kbps über `(bytes * 8) / 1000 / deltaSec`. Zeigt 4 Metriken: Video-kbps, FPS, Audio-kbps, ConnectionQuality-Badge (grün/orange/rot basierend auf LiveKit-Enum). Reset auf 0 wenn phase ≠ 'live' damit das Panel beim Reconnect nicht Stats vom alten Stream zeigt.
- [x] **LiveCoHostQueue** (`components/live/live-cohost-queue.tsx`): Zwei-Sektionen — Pending-Requests (Broadcast-Subscribe auf `cohost-request` Event, Dedup via userId-Set) und Active-CoHosts (DB-Subscription auf `live_cohosts` mit `revoked_at IS NULL`, refetch bei `postgres_changes`-Event). Accept-Button berechnet `nextFreeSlot` via Set-Diff gegen aktive Slots (1/2/3), rejected wenn alle belegt. Active-Row zeigt Slot-Badge als Overlay am Avatar + Mic-Mute + Video-Mute (optimistic local state + `muteCoHost` call zur LiveKit-moderate Edge-Function) + Kick-Button mit confirm().
- [x] **LivePollStartSheet** (`components/live/live-poll-start-sheet.tsx`): Modal-Sheet (bottom-aligned mobile, centered desktop). Zwei Modi — Create (Form: Frage 3-140 chars mit char-counter, 2-4 Options je 1-50 chars mit Add/Remove-Buttons, Laufzeit 1/3/5-Min Segmented-Control) oder Active-Poll-View (zeigt Live-Vote-Counts mit Progress-Bars und total_votes). Bei aktiver Poll statt "Starten" der "Umfrage beenden"-Button → `closeLivePoll`. Optimistic-State-Update ruft `onPollChange` damit die Parent-Watch-Page sofort die neue Poll anzeigt (DB-Realtime zieht nach via Phase-5 LivePollPanel).
- [x] **LiveGiftsFeed** (`components/live/live-gifts-feed.tsx`): Realtime-INSERT-Subscription auf `live_gifts` mit session_id-Filter, lazy Sender+Gift-Nachladung. Top-Supporter-Aggregat via `useMemo` (Map<sender_id, sum> → Array → sort → [0]). Optional Coin-Goal: Inline-GoalEditor (Label + target_coins 100-1.000.000) → `createLiveGiftGoal`. Goal-Progress-Bar mit Celebrate-State (grün + Check-Icon) bei `current_coins >= target_coins`. Gifts-Liste cap 20 mit scroll-overflow bei 48er max-height.
- [x] **`/studio/live` Host-Dashboard** (`apps/web/app/studio/live/page.tsx`): Auth-Guard, dann parallel `getMyActiveLiveSession` + `getMyPastSessions(30)`. Aktive Session wird als Alert-Banner oben gerendert mit Resume-Link ("Zurück ins Deck"). History als 3-Spalten-Grid mit Thumbnail-Cards (Duration-Pill bottom-left, Play-Overlay on-hover bei `status='ended'`, Peak-Viewer + relatives Datum `Heute/Gestern/dd.mm.yy`). Kein "Go Live"-Button wenn bereits aktive Session läuft (verhindert Doppel-Stream).
- [x] **Sidebar** (`components/feed/feed-sidebar.tsx`): Neuer Eintrag "Live-Studio" → `/studio/live` mit Radio-Icon, `requiresAuth: true` direkt unter "Mein Shop". Konsistent mit "Mein Shop" als Creator-Studio-Gruppe.
- [x] **Heartbeat-Loop**: useEffect mit `setInterval(30_000)` im Deck ruft `heartbeat_live_session(sessionId, viewerCount, peakCount)` — verhindert dass der Cleanup-Cron vom v1.27.0-Pattern die Session als "stale" killt wenn der Host noch streamt aber gerade keine DB-Write macht. Initial-Call direkt beim phase-switch zu 'live' damit der erste 30s-Fenster nicht blind ist.
- [x] **End-Stream-Flow**: `handleEndStream` mit window.confirm → disable all tracks (Cam/Mic/Screen) → `endLiveSession` RPC → `room.disconnect()` → nach 2s redirect zu `/studio/live`. Fehler-Resilience: Error-State wenn RPC fehlschlägt, Room-Disconnect trotzdem (damit kein Zombie-WebRTC läuft). Die v1.27.0-Cleanup-Cron räumt serverseitig nach falls alles scheitert.
- [x] **OBS-WHIP-Ingest** bewusst vertagt auf Phase 6b — braucht separate LiveKit-Cloud-Konfiguration (persistente Ingress-Endpoints + User-Stream-Key-Rotation). Der WebRTC-Browser-Publisher allein deckt >90% der Use-Cases ab.
- [x] **Typecheck**: 0 neue Fehler in allen Phase-6-Dateien. Die 30 bestehenden Fehler sind unverändert (auth/middleware/shared-schemas — alle out-of-scope dokumentiert).

### v1.w.5 — Live Viewer (Phase 5 shipped)
- [x] **Live-Daten-Schicht** (`apps/web/lib/data/live.ts`): Neun `cache()`-wrapped SSR-Reads — `getActiveLiveSessions` (viewer_count desc + started_at asc tiebreak), `getLiveSession` (kein Status-Filter → graceful bei Session-End), `getLiveComments` (chronologisch ascending nach Reverse einer DESC-Query), `getActiveLivePoll` (via Native-RPC `get_active_poll`), `getActiveCoHosts` (`revoked_at IS NULL` + slot_index-Sort), `getLiveRecording`, `getClipMarkers`, `getIsFollowingHost`, `getIsSessionModerator` (via Native-RPC). Host-Join-Normalization mit `Array.isArray(row.host) ? row.host[0] : row.host` — Supabase-Relations geben manchmal Array, manchmal Object zurück je nach Cardinality-Auswertung.
- [x] **Server-Actions** (`apps/web/app/actions/live.ts`): 17 Actions — Session-Flow (`joinLiveSession`, `leaveLiveSession`), Chat (`sendLiveComment` mit Shadow-Ban-Pattern: blocked-Comments kommen `{ ok: true, shadowBanned: true }` zurück, landen nie in DB oder Broadcast), Reactions (`sendLiveReaction` auf `live:{id}` Channel — exakt derselbe Kanal-Name wie Native), Gifts (`sendLiveGift` → Native-RPC `send_gift` atomar für Coins+Credit+Insert+Notify), Polls (`voteOnLivePoll` → `vote_on_poll`), CoHost (`requestCoHost` / `cancelCoHostRequest` / `leaveCoHost` — Broadcast auf `co-host-signals-{id}` Channel, wieder 1:1 Native-Parität), LiveKit-Token (`fetchLiveKitToken` invoked Edge Function), Follow, Report, Clip-Marker, und Mod-Actions (`timeoutChatUser` / `untimeoutChatUser` / `setLiveSlowMode` / `pinLiveComment` / `unpinLiveComment` — delegieren an RPCs die via `is_live_session_moderator` prüfen, CoHost-Parity ab v1.27.2 automatisch). In-Memory-Rate-Limits pro Server-Instanz (COMMENT_COOLDOWN_MS=1000, REACTION=250, GIFT=150, REPORT=30000) mit FIFO-Cap bei 5000 Einträgen.
- [x] **`/live` Index-Seite** (`apps/web/app/live/page.tsx`): Grid 1-4 Spalten responsive, 16:9-Thumbnail-Cards mit Live-Badge (Ping-Animation), Hot-Flame-Badge ab 100 Viewern, Viewer-Count bottom-right, Stream-Dauer bottom-left via `formatDistanceToNowStrict` mit `de`-Locale, Host-Avatar + Username + Verified-Checkmark, Peak-Zähler wenn größer als aktuell (zeigt "Peak war X"). `force-dynamic` — keine Caching-Schicht für Viewer-Counts.
- [x] **`/live/[id]` Viewer-Seite** (`apps/web/app/live/[id]/page.tsx`): 2-Spalten-Desktop-Layout (`grid-cols-[1fr_380px]`), Mobile-Stack. SSR lädt Session + Comments + Active-Poll + CoHosts + Follow-State + Moderator-Status parallel in einem Promise.all. Ended-State zeigt Thumbnail mit 30% Opacity + "Replay ansehen" CTA. Live-Badge + Viewer-Count als Overlays direkt auf dem Player. Metadaten via `generateMetadata` mit OpenGraph-Thumbnail für Share-Previews.
- [x] **LiveKit-Video-Player** (`components/live/live-video-player.tsx`): Client-Component mit `livekit-client`. Connect-Flow: `fetchLiveKitToken(roomName, false)` → `room.connect(url, token)` → Track-Attach bei `TrackSubscribed` + initial-Iteration durch `remoteParticipants.trackPublications` falls der Host bereits publisht hat. Filtert Host-Video (`participant.identity === hostId`) — CoHost-Video wird ignoriert weil Duet-Multi-View Phase 6 ist; CoHost-Audio wird aber mit gemixt (LiveKit-SDK macht clientseitiges Mixing auf demselben `<audio>`-Element). Start muted wegen Browser-Autoplay-Policy → großer "Zum Einschalten des Tons tippen"-Overlay zentriert. Vollbild-Button + Volume-Toggle.
- [x] **LiveChat** (`components/live/live-chat.tsx`): Initial-State vom SSR, Realtime via `postgres_changes` auf `live_comments` mit `filter: session_id=eq.{id}` — Channel-Name `live-comments-{id}` matcht Native. Author-Profile werden lazy per Insert-Event nachgeladen (Realtime-Event enthält nur die Raw-Row). Auto-Scroll nur wenn User bereits am Boden war (kein Reißen beim Hochscrollen zum Lesen alter Messages). Message-Cap 500 mit Slice-Eviction. Shadow-Banned-Comments werden lokal als Ghost-Entry mit `id: ghost-${ts}` eingefügt — User sieht sich selbst, niemand anders sieht ihn. Pinned-Comment-Banner oben. CommentRow mit Mod-Hover-Menu (Timeout 1/5/10/60 Min) wenn Viewer Host oder Session-Mod ist. Slow-Mode-Hinweis im Header wenn `slow_mode_seconds > 0`.
- [x] **LiveHostCard** (`components/live/live-host-card.tsx`): 12×12-Avatar, Host-Name mit Verified-Check, Username `@`-Prefix, Stream-Title zweizeilig. Follow-Button mit Optimistic-Update + Rollback bei Fehler. Rendert keinen Follow-Button wenn Viewer selbst der Host ist.
- [x] **LiveEnterClient** (`components/live/live-enter-client.tsx`): Headless Side-Effect-Komponente. Ruft `joinLiveSession` im useEffect-Mount, `leaveLiveSession` im Cleanup. Fire-and-forget (Fehler geschluckt) — die Viewer-Count-Metrik ist Nice-to-Have-Analytics, nicht kritisch. Dedup in der RPC via `live_session_viewers`-PK (Phase-2-Hotfix v1.27.0) verhindert Mehrfach-Inkrementierung bei React-Strict-Mode-Remount.
- [x] **LivePollPanel** (`components/live/live-poll-panel.tsx`): Umfrage-Card mit bis zu 4 Options, Progress-Bar-Fill basierend auf `vote_counts / totalVotes`. Realtime-Sub auf `postgres_changes UPDATE live_polls` für Live-Aggregation. My-Vote-Indicator mit Check-Icon. Bei geschlossener Umfrage (`closed_at` gesetzt) werden Ergebnisse direkt gezeigt, keine Vote-Buttons mehr. Optimistic-Vote mit Rollback bei Action-Fehler.
- [x] **LiveActionBar** (`components/live/live-action-bar.tsx`): 6 Reaction-Buttons (heart/fire/clap/laugh/wow/sad mit Lucide-Icons + farbigen Tints), dann Gift-CTA mit Amber-Pink-Gradient, dann CoHost-"Zum Duett"-Button (wechselt nach Request zu "Anfrage gesendet" mit Amber-State). Zeigt "Du bist dabei"-Badge wenn Viewer bereits aktiver CoHost. Host sieht gar keinen CoHost-Button (sinnlos).
- [x] **LiveReactionOverlay** (`components/live/live-reaction-overlay.tsx`): Fixed-Position Bottom-Right, 30er-Pool von floating Icons. Jede Reaction 2s Animation mit `@keyframes float-up` (translate-y -380px + horizontal drift ±20px + scale 0.8→1.1 + opacity-Kurve). Inline-Styled für Tailwind-Config-Unabhängigkeit. Nur eigene Reactions werden angezeigt — andere User-Reactions wären ein weiteres Realtime-Sub auf `live:{id}` event `reaction`, kommt wenn UX-Tests das rechtfertigen.
- [x] **LiveGiftPicker** (`components/live/live-gift-picker.tsx`): Bottom-Sheet-Modal. Lädt `live_gift_catalog` (active=true, order by coin_cost asc) + `get_my_coin_balance`-RPC parallel beim Open. 3-5-Spalten-Grid mit GiftCard (14×14 Image, Name, Coin-Cost). Recipient-Switch-Pill erscheint wenn aktiver CoHost vorhanden (Host | Guest segmented control). Combo-Support vorgesehen via `comboKey`-Param in sendLiveGift, aber UI-Combo-Counter ist Phase 5.5. Balance aktualisiert sich nach Send. "Zu wenig Coins"-Disabled-State am CTA.
- [x] **`/live/replay/[id]`** (`apps/web/app/live/replay/[id]/page.tsx` + `components/live/replay-player.tsx`): Native `<video>`-Element mit Controls, poster von `session.thumbnail_url`. Clip-Markers als Seek-Chips unten am Player (bis zu 10 angezeigt) — Klick setzt `video.currentTime = position_secs` + spielt ab + highlightet den Chip 1.5s. mp4-VOD only (LiveKit Egress RoomComposite liefert mp4); HLS-Support wäre conditional-import von `hls.js` wenn `src.endsWith('.m3u8')`. Recording-Status-Varianten: processing zeigt "Replay wird verarbeitet", failed zeigt "Aufzeichnung fehlgeschlagen", null zeigt "Keine Aufzeichnung".
- [x] **Cross-Platform-Channel-Kompatibilität verifiziert**: `live-comments-{id}` (Chat), `live:{id}` (Reactions/Gifts), `co-host-signals-{id}` (Duet-Requests) — alle drei Channel-Namen matchen Native 1:1. Ein iOS-Viewer und ein Web-Viewer auf demselben Stream sehen sich gegenseitigen Chat und Geschenke. Zero-Backend-Fork.
- [x] **Sidebar-Aktivierung**: In `components/feed/feed-sidebar.tsx` wurde der `phase: 'Phase 5'`-Tag vom Live-Eintrag entfernt — Live ist jetzt vollwertig navigierbar.
- [x] **Dependencies**: `livekit-client@^2.15.2` + `lottie-web@^5.12.2` in `apps/web/package.json`. Nach Pull muss `npm install` im Root laufen, dann startet `/live/[id]` korrekt.

### v1.w.11 — Guilds + Stories (Phase 11 shipped)
- [x] **Guilds-Data-Layer** (`apps/web/lib/data/guilds.ts`): Sechs `cache()`-wrapped SSR-Reads — `getAllGuilds` (5 fixe Pods nach Name sortiert, Member-Count pro Pod in einem zweiten Parallel-Query aggregiert statt N+1), `getGuildById` (maybeSingle + null-Return für 404-Dispatch), `getGuildMemberCount` (exact-head via `count`), `getGuildMembers` (Limit-Param, ordered by display_name asc nulls last), `getGuildLeaderboard` (delegiert an Native-RPC `get_guild_leaderboard` mit JSONB-Payload `{ top_posts, top_members }`), `getMyGuildId` (einzelne Profile-Column-Read, null für Anon). Types: `Guild`, `GuildWithMeta`, `GuildMember`, `GuildLeaderboardPost`, `GuildLeaderboardMember`, `GuildLeaderboard`.
- [x] **Guilds-Actions** (`apps/web/app/actions/guilds.ts`): Eine Action `switchGuild(guildId)` mit 24h-Cooldown via `last_guild_switch_at`. Try/Catch-Fallback wenn Spalte nicht existiert (graceful degradation bei Legacy-Schemas — Mutation läuft, nur Rate-Limit greift nicht). Guard-Pfad: guild-exists → already-in-same-Pod-Check → Cooldown-Check (Math.ceil der Restdauer in Stunden) → UPDATE mit Timestamp → Fallback-UPDATE ohne. revalidatePath auf `/guilds` und `/g/${guildId}`.
- [x] **`/guilds` Discovery-Page** (`apps/web/app/guilds/page.tsx`): Grid 2-3 Spalten responsive. Pro Pod-Card: Name + Crown-Badge wenn eigener Pod (`isMine = guild.id === myGuildId`), Beschreibung (2-line clamp), Vibe-Tags (Hash-Icon + Text in muted Pill), Member-Count mit Users-Icon. Border wechselt auf `brand-gold/60 + ring` wenn eigener Pod. Hover-Arrow rechts oben fade-in. `revalidate = 60` (Member-Counts dürfen leicht stale sein). Nicht-eingeloggte sehen alle Pods aber ohne Crown, Header-CTA "Einloggen" rechts oben.
- [x] **`/g/[id]` Pod-Detail-Page** (`apps/web/app/g/[id]/page.tsx`): 2-Spalten-Layout (`grid-cols-[1fr_320px]`). Header-Card mit Name, Beschreibung, Vibe-Tags, Member-Count + rechts der SwitchGuildButton. Linke Spalte: Top-Posts-Grid 3-col aspect-[9/16] mit #1-10 Overlay-Badges, Completion-% + Author-@username in Gradient-Footer, Link auf `/p/{id}`. Danach Top-Creators als ordered-list mit Avatar + `#{idx+1}`-Position + Post-Count + Avg-Completion-Pill. Unten Events/Chat als dashed-border Placeholder-Cards („kommt in einer nächsten Version"). Rechte Sidebar: Members-Grid (48 max, 4-col lg / 6-col sm) mit Avatar + Hover-Ring + `@username`-Truncate, dann About-Card mit Member-Count / Top-Posts-30d / Active-Creators als `<dl>`. `revalidate = 60`. Route via UUID statt Slug weil Schema kein `slug`-Feld hat.
- [x] **SwitchGuildButton** (`apps/web/components/guilds/switch-guild-button.tsx`): Drei Render-States — not-authed (LogIn-Icon-Link nach `/login?next=/g/{id}`), is-member (grüner Check-Badge „Dein aktueller Pod"), can-switch (Primary-Button mit window.confirm-Dialog vor dem Switch). `useTransition` fürs Pending + Loader-Spinner. Error-Line in rose darunter bei ActionResult-Fehler. window.confirm rudimentär bewusst — der Switch triggert 24h-Cooldown, also ein bewusster Klick; shadcn-AlertDialog wäre Upgrade-Potential.
- [x] **Not-Found** (`apps/web/app/g/[id]/not-found.tsx`): Users-Icon + „Pod nicht gefunden" + Back-Link zu `/guilds`.
- [x] **Stories-Data-Layer** (`apps/web/lib/data/stories.ts`): `getActiveStoryGroups()` gruppiert alle aktiven Stories (archived=false + created_at >= now()-24h) pro User und sortiert: eigene Gruppe zuerst → ungesehene → gesehene. Scope: Guild-Mitglieder wenn User einen Pod hat, sonst followed-users + eigene. `getStoryGroupForUser(targetUserId)` für Viewer-Navigation (lädt einzelne Gruppe + Views in parallel). Seen-Set via `story_views` mit UNIQUE(story_id, user_id). `StoryItem`/`StoryGroup`-Types entsprechen Native-Pattern. Helpers `storyExpiresAt` + `storyRemainingMs` für UI-Countdowns.
- [x] **Stories-Actions** (`apps/web/app/actions/stories.ts`): Drei Actions — `createStory({mediaUrl, mediaType, thumbnailUrl?, interactive?})` (MediaType-Validation + Poll-Input-Validation: Frage 3-120 chars, exakt 2 Optionen à 1-40 chars), `deleteStory(storyId)` (explicit ownership-check trotz RLS für klare Error-Messages), `markStoryViewed(storyId)` (Upsert in story_views mit `onConflict: 'story_id,user_id'`, Anon-User = no-op, kein revalidatePath weil das den Feed bei jedem Seen-Tick neu rendern würde).
- [x] **Story-Strip im Feed** (`apps/web/components/feed/story-strip.tsx`): Server-Component, horizontaler scroll-row oberhalb des For-You-Feeds. Eigene Card hat Plus-Badge mit Link zu `/stories/new` wenn keine aktive Story existiert, sonst Gradient-Ring + Viewer-Link. Andere User: Gradient-Ring (from-amber-400 via-rose-500 to-fuchsia-500) bei ungesehenen Stories, muted-Ring bei gesehenen. Integration via `storyStripSlot` ReactNode-Prop an HomeFeedShell (Server-Slot-Pattern damit HomeFeedShell Client-Component bleiben kann). Strip nur im „Für dich"-Tab sichtbar — „Folge ich" bleibt Feed-Only (TikTok/Meta-Parität).
- [x] **Story-Viewer** (`apps/web/app/stories/[userId]/page.tsx` + `apps/web/components/stories/story-viewer.tsx`): SSR-Page lädt `getStoryGroupForUser` + `getActiveStoryGroups` parallel für Carousel-Nav-Reihenfolge. Client-Viewer mit requestAnimationFrame-Timer (5s Image / 10s Video-Cap), Progress-Bars oben (pro Story eine dünne Bar, aktive Bar animiert). Keyboard-Shortcuts: ←/→ navigation, Esc schließt, Space pausiert. Tap-Zones links/rechts der Canvas (w-1/3) für Mobile-Nav. Desktop-Arrows außerhalb der Canvas. Long-press-Pause via Play/Pause-Button in der Topbar. Mark-as-viewed nach 1s Anti-Skim-Threshold (Fire-and-forget Action). Delete-Button (Trash-Icon) nur für eigene Stories, mit window.confirm. Poll-Overlay rendert display-only (Voting-UI kommt wenn `story_votes`-RPC auf Native shipped ist). Video-Element synct mit `paused`-State via useEffect.
- [x] **Story-Creator** (`apps/web/app/stories/new/page.tsx` + `apps/web/components/stories/story-creator.tsx`): 2-Spalten-Layout (Preview 9:16 + Controls). Dropzone mit drag-and-drop + `<input type=file accept="image/*,video/*">`. Upload via `requestR2UploadUrl` + XHR-PUT mit Progress-Callback (reused aus Create-Flow-Pattern). Naming-Pragmatik: R2-Keys unter `posts/images/{userId}/story_{ts}.{ext}` bzw. `posts/videos/...` weil R2-Allowlist `stories/`-Prefix nicht kennt — keine semantische Überschneidung weil Routing an `stories`-Tabelle hängt, nicht am Storage-Pfad. Optional Poll-Builder mit Frage + 2 Optionen (Live-Preview im Canvas-Overlay). Submit → `createStory` → `router.push('/')` + refresh. 100MB-Cap, 9:16-Empfehlung (nicht erzwungen).
- [x] **Nav-Integration** (`apps/web/components/feed/feed-sidebar.tsx`): Neuer Eintrag „Pods" → `/guilds` mit Users-Icon zwischen Explore und Folge-ich. Kein neuer Header-Eintrag — der Story-Strip rendert die relevante CTA (Plus-Badge auf eigener Card → `/stories/new`) direkt in den Feed.
- [x] **Route-Entscheidung**: Roadmap spezifizierte `/g/[guildSlug]` + `/s/[storyId]` Viewer. Schema hat weder `slug`-Spalte auf `guilds` noch einen freien `/s/*`-Namespace (`/s/[storyId]` ist seit Phase 8 der SEO-Permalink für einzelne Stories). Pragmatische Fixups: Guilds via UUID (`/g/[id]`), Story-Viewer in eigenem Namespace (`/stories/[userId]`). Keine Breaking-Changes an bestehenden Routes.
- [x] **Deferred**: `/g/[id]/events` (DB hat keine Events-Tabelle, Native-App-Roadmap-Item), Guild-Chat (ebd.), Text-Overlay im Story-Creator (Canvas 2D-Composite von Text + Image → bindet eine Palette an Font/Farbe/Position-Entscheidungen, bewusst v1.w.12-Scope). Placeholders rendern als „kommt bald"-Tiles damit die Tab-Struktur stabil bleibt.
- [x] **Typecheck**: 32 bestehende Fehler unverändert (auth/middleware/shared-schemas — alle out-of-scope dokumentiert). 0 neue Fehler in allen Phase-11-Dateien (11 neue Files: guilds.ts ×2, stories.ts ×2, /guilds/page, /g/[id]/page + not-found, /stories/[userId]/page + not-found, /stories/new/page, story-strip, story-viewer, story-creator, switch-guild-button, feed-sidebar-edit, home-feed-shell-edit, page.tsx-edit).

### v1.w.0 — Foundation Scaffold (2026-04-20)
- [x] **Architektur-Entscheidung**: Next.js 15 App Router + React 19 + Supabase SSR (statt Expo Web). Grund: PC-Streamer und Pro-Merchants brauchen Desktop-first UX, Hover-States, Keyboard-Nav und SEO — Mobile-Feel im Browser wäre Rückschritt. Trade-off: UI-Duplikation Native ↔ Web akzeptiert zugunsten von Platform-Native-Optik.
- [x] **Backend-Strategie**: Supabase 1:1 wiederverwendet — gleiche DB, gleiche RLS-Policies, gleiche RPCs, gleiche Edge Functions. Kein Backend-Fork. Nur der Auth-Transport wechselt (Native = AsyncStorage, Web = Cookies via `@supabase/ssr`).
- [x] **Cross-Platform `shared/` angelegt**: `shared/theme/colors.ts` (ThemeColors + darkColors + lightColors aus `lib/theme.ts` portiert), `shared/types/*` (Profile, LiveSession, LiveComment, Product, ShopReview, Gift, LivePoll, Post, Story), `shared/schemas/*` (Zod: `productCreateSchema` mit `.refine()` für sale<price und physical+shipping; `livePollCreateSchema` 3-140 chars / 2-4 options; `usernameSchema` regex), `shared/catalog/gifts.ts` (DEFAULT_GIFTS), `shared/moderation/words.ts` (1:1 Port von `liveModerationWords.ts` inkl. FIFO-Host-Cache). Strikte Regel: keine react-native- oder DOM-Imports erlaubt.
- [x] **`apps/web/` Scaffold**: `package.json` mit Next.js 15.0.3, React 19, `@supabase/ssr@0.5.2`, TanStack Query v5.59, shadcn-Deps (Radix UI), next-themes, sonner, zod, lucide-react, posthog-js, `@sentry/nextjs`, Tailwind 3.4. `tsconfig.json` mit Path-Aliasen `@/*` → `./*` und `@shared/*` → `../../shared/*`. `next.config.mjs` mit `typedRoutes`, Image-Remote-Patterns (Supabase/R2/LiveKit) und Security-Headers (X-Frame-Options DENY, Permissions-Policy camera=self mic=self).
- [x] **Tailwind + shadcn-Setup**: `tailwind.config.ts` mit shadcn-CSS-Variable-Mapping + `brand.{gold, success, warning, danger, purple}` aus unserer Palette. `app/globals.css` spiegelt `darkColors`/`lightColors` als HSL-CSS-Variablen für `:root` (Light) und `.dark` (Dark). Erste shadcn-Primitives angelegt: `Button` (6 Varianten, 5 Größen inkl. `xl` für Hero-CTAs), `Avatar`, `Dialog`.
- [x] **Supabase-SSR-Stack**: `lib/supabase/client.ts` (Browser-Client), `lib/supabase/server.ts` (async Server-Components-Client mit `cookies()` aus `next/headers`), `lib/supabase/middleware.ts` (Session-Refresh + Protected-Routes `/studio`, `/messages`, `/settings`, `/create` → Redirect `/login?next=…`). Root-`middleware.ts` mit Matcher der `_next`/statische Assets ausschließt.
- [x] **Provider-Schichten** (`app/layout.tsx`): ThemeProvider (next-themes, dark default, System-Sync), QueryProvider (staleTime 60s / gcTime 5min / retry 1), PostHogProvider (EU-Region `eu.i.posthog.com`, manueller Pageview via `usePathname` + `useSearchParams`). `Toaster` von sonner global gemountet. Viewport-Meta mit `themeColor` für iOS Safari Statusbar-Tint.
- [x] **Landing-Page** (`app/page.tsx`): Hero mit Phase-0-Headline + 3 Value-Cards (Gamepad2 für PC-Streamer → Phase 6, ShoppingBag für Pro-Merchant → Phase 7, Radio für Live-Viewer → Phase 5). Login/Signup-Platzhalter-Seiten angelegt — echte Auth-UI kommt Phase 1.
- [x] **`.env.local.example`** mit allen Sektionen: Supabase (URL, Anon, Service-Role), LiveKit (Phase 5/6), Stripe (Phase 10 — Web nutzt Stripe Checkout statt RevenueCat), Sentry, PostHog, Cloudflare R2 (Phase 8).
- [x] **`apps/web/README.md`** als Dev-Setup-Einstieg (Install, Env, npm-Scripts, Struktur-Baum, Auth-Gate-Dokumentation). Komplette Roadmap bleibt hier.
- [ ] **Noch manuell durch Zaur**: Sentry-Org-Keys eintragen, Vercel-Deploy-Hook verbinden, Domain kaufen. — Wird nachgezogen wenn Phase 1 startet.

_Nächster Meilenstein: Phase 12 — Polish & Production-Readiness. i18n (DE/RU/CE/EN) mit `next-intl` + shared Strings zur Native-App, PWA-Manifest + Service-Worker via `next-pwa`, Web-Push via VAPID (Messages + Follower-geht-live + Gift-Received), A11y-Audit mit Axe DevTools Richtung Lighthouse ≥ 95, Bundle-Budgets + Performance-Pass, Cookie-Consent-Banner (DSGVO-konform), GDPR-Data-Export + Account-Deletion UI, Sentry-Releases + Source-Maps durchverbunden, Status-Page, Terms/Privacy/Impressum Pages. Parallel deferred Items aus Phase 11 aufgreifen: Guild-Events + Guild-Chat brauchen DB-Schemata, Text-Overlay im Story-Creator (Canvas 2D-Composite mit Font/Farbe/Position-UI) als eigenständiger v1.w.12.1-Slice. Auch `/studio/payouts` (SEPA via Stripe Connect Express) steht weiterhin offen als Payout-Flow-Nachzug aus Phase 9._

_Deferred nach Phase 7b: Media-Upload in DMs (Bild/Video + R2-Signed-URL-Flow), Voice-Messages-Recording mit Waveform, Message-Search innerhalb einer Conversation, Unread-Badge im globalen Header (braucht Header-Polling oder Realtime-Count-Channel), Infinite-Scroll für ältere Messages (initial-Load 80, danach Scroll-up-Trigger mit Cursor-Pagination)._

_Deferred nach Phase 6b: OBS-WHIP-Ingest-Endpoint (eigener LiveKit-Cloud-Ingest mit separatem Stream-Key + Dashboard-UI zum Kopieren), HLS-Low-Latency für > 500 Viewer-Streams (LiveKit Egress HLS-Variante statt nur RoomComposite mp4)._
