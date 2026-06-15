# Changelog

Alle nennenswerten Änderungen an Serlo / Vibes werden hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [2026-06-15] — Profil/Web-Politur, Schema-Härtung & Bug-Jagd

Großer Wartungs- & Qualitäts-Sweep über Mobile, Web und Datenbank.
Mobile-Änderungen sind per EAS-OTA live, Web per Vercel deployed.

### Hinzugefügt
- **Echter „Freunde"-Feed** (Web `/friends`): Video-Feed der **gegenseitigen** Follows
  (TikTok-Modell). Klare Abgrenzung zu „Folge ich" (einseitig). Neuer Shell-Tab,
  `getFriendsFeed` (Schnittmenge follower/following), `/api/feed/friends`.
- **Schema-Wahrheit im Repo**: `supabase/SCHEMA.md` (lesbar) + `supabase/schema_live.sql`
  (pg_dump) als Source of Truth für reale Tabellen/Spalten.
- **CI-Drift-Guard** `scripts/schema-drift-check.mjs`: gleicht Code-Spaltenreferenzen
  gegen das Live-Schema ab und exit-1 bei Treffer.
- **Tests**: `getFriendsFeed`-Coverage (mutual-Follow-Logik); Web-Suite 289/289 grün.

### Geändert
- **Mobile Profil-Header** professionell neu gestaltet.
- **Eigene Posts**: 3-Punkte-Menü nach unten-rechts (TikTok-Stil); „Teilen" + Verwalten
  als Untermenü (`PostManageModal`). Pinned Post erscheint oben im Profil.
- **Tools-Sheet**: gethemte, gruppierte Karten statt Emoji-Liste (funktioniert in Light
  **und** Dark Mode), Safe-Area-Bottom.
- **Shop-Grid**: kartenlos/durchgehend — nur Bilder gerundet, Text bündig (TikTok-Look).
- **Wallet-/Analytics-Card**: Gradient + Neon-Pink entfernt → ruhige Fläche, neutrale
  Hero-Zahl, eingebettetes Period-Panel, Theme-Tokens.
- **Bottom-Nav**: flacher Button → dimensionaler 3D-Create-Button (Verlauf, Spekular-
  Highlight, Schatten); Tab-Icons vergrößert (24→27).
- **Web-Architektur**: geteilte `FeedShell`-Komponente statt 6× kopiertem Sidebar-Layout
  (`/explore`, `/u`, `/people`, `/guilds`, `/saved`, `/notifications`).
- **`host.tsx` entflochten** (God-Component): 3636 → 2792 Zeilen (−23 %). Styles →
  `components/live/hostStyles.ts`; LiveKit-Bausteine (`useViewerCount`, `HostControls`,
  `LocalCameraView`, `RemoteCoHostVideoView`) → `components/live/hostVideoParts.tsx`.

### Behoben
- **GDPR-Datenexport** übersah ALLE Posts des Users (`posts.user_id` statt `author_id`)
  — Compliance-Bug, von `safeSelect` still geschluckt.
- **Sitemap** lieferte keine Profil- und keine Hashtag-URLs (SEO): `follower_count`/
  `updated_at`/Tabelle `post_hashtags` existieren nicht → `created_at` + `getTrendingHashtags`.
- **Live-Clip-Marker** komplett tot (`position_secs`/`label` → echte Spalten `ts_secs`/`note`).
- **Creator „Top-Produkte"** immer leer (`creator_id`/`total_sales` → `seller_id`/`sold_count`).
- **Creator Post-Likes-Statistik** lieferte nichts (`posts.user_id` → `author_id`).
- **`/people`** war leer (Sortierung nach nicht-existentem `profiles.follower_count`) und
  ohne Sidebar; **`/guilds`, `/saved`, `/notifications`** fehlte ebenfalls die Sidebar.
- **`/friends`** zeigte beim Navigieren einen weißen Kasten → eigene Loading-Skeleton.
- **Highlight-Thumbnails**: Video-Cover wurden nicht angezeigt; Thumbnail wird nun aus
  `posts`/`stories` nachgeladen (heilt auch bestehende Highlights).

### Sicherheit
- **45 SECURITY-DEFINER-Funktionen** ohne gepinnten `search_path` gehärtet
  (Schutz gegen search_path-Hijacking; inkl. `credit_coins`, `send_gift`,
  `admin_update_payout_status`, `create_user_wallet`). Idempotente Migration
  `20260614190000_pin_definer_search_path.sql`.

### Performance
- **Router-Cache `staleTimes`** (dynamic 30 s) gegen träges Seitenwechseln im Web.
- **Vercel-Region → `dub1` (Dublin)**, ko-lokiert mit Supabase `eu-west-1` → geringere
  DB-Roundtrip-Latenz.

### Aufräumen / Infrastruktur
- **Schema-Drift aufgelöst**: 69 lose `supabase/*.sql` nach `supabase/_legacy/` archiviert.
- **545 MB lokaler Cruft entfernt** (`vibes-web`, `dist`).
- **Disk-I/O-Budget-Alarm** diagnostiziert: Ursache war einmalige pg_dump-/Dashboard-
  Aktivität, nicht der App-Layer (App-Queries verifiziert sauber, Schema gut indexiert).
