# Vibes / Serlo Rescue Plan — 2026-05-03

Status: Backup, Upload/CORS, Supabase-Migration, Quality Gates und Production-Deploy erledigt; Restplan offen.

## 0. Backup

Ein lokales Backup wurde erstellt, bevor weitere Analyse oder Änderungen passieren.

- Backup-Ordner: `/Users/zaurhatuev/vibes-backups/20260503-020559`
- Web/Monorepo-Archiv: `vibes-app-web-monorepo.tar.gz`
- Native/Desktop-Archiv: `vibes-app-native-desktop.tar.gz`
- Manifest: `/Users/zaurhatuev/vibes-backups/20260503-020559/MANIFEST.md`
- Ausgenommen wurden rebuildbare Ordner wie `node_modules`, `.next`, `.expo`, `ios/Pods`, `ios/build`, `android/build`, `coverage`, `dist`, `.turbo`.

Wichtig: Das Backup enthält lokale Env-Dateien. Es bleibt lokal und darf nicht geteilt oder committed werden.

## 1. Harte Wahrheit: warum das Projekt in 6 Monaten gescheitert wäre

Wenn wir nichts ändern, scheitert das Projekt nicht an einem einzelnen Bug. Es scheitert an Drift: mehrere Codebasen, mehrere Upload-Pfade, mehrere Env-Quellen, deaktivierte Qualitätsgates und zu viele Features vor einem stabilen Kern.

Die wahrscheinlichsten Scheitergründe:

1. **Kein klarer Source of Truth**
   - Aktive Web-Arbeit liegt in `/Users/zaurhatuev/vibes-app/apps/web`.
   - Eine Native-App liegt in `/Users/zaurhatuev/vibes-app`.
   - Die aktiv gestartete iOS-App liegt aber in `/Users/zaurhatuev/Desktop/vibes-app`.
   - Zusätzlich existiert `/Users/zaurhatuev/vibes-app/vibes-web` als eigenes altes Next-Repo.
   - Ergebnis: Fixes landen in einem Projekt, Nutzer testen aber ein anderes.

2. **Native und Web verwenden nicht denselben Medien-Upload**
   - Web lädt neue Medien via Supabase Edge Function `r2-sign` nach Cloudflare R2.
   - Native im Monorepo lädt ebenfalls nach R2.
   - Die aktive Desktop-Native-App lädt aber noch nach Supabase Storage Bucket `posts`.
   - Ergebnis: Web und App zeigen zwar teilweise dieselben Posts, aber neue Medien, Thumbnails, Cache-Header und Performance verhalten sich unterschiedlich.

3. **Qualitätsgates waren teilweise aus**
   - Vor der Rettung waren Web `npm run build` und `npm run typecheck` grün, aber Web `npm run lint` rot.
   - `apps/web/next.config.mjs` ignorierte TypeScript- und ESLint-Fehler im Build.
   - Behoben am 2026-05-03: Build prüft wieder TypeScript und Lint; Lint hat 0 Fehler, Warnungen bleiben als Tech-Debt sichtbar.
   - Ergebnis vorher: Deploys konnten erfolgreich sein, obwohl ein offizieller Check kaputt war.

4. **Git-Zustand ist release-gefährlich**
   - Web/Monorepo hat massiven Dirty State: viele `D`, `MM`, `??`.
   - Coverage-Artefakte sind im Root-Repo getrackt.
   - Native/Desktop hat ebenfalls lokale Änderungen.
   - Ergebnis: Rollback, Review, Release und Deployment sind nicht mehr vertrauenswürdig.
   - Status nach Release-Hygiene: staged Massen-Deletes wurden aus dem Index entfernt,
     ohne Working-Tree-Dateien zurückzusetzen. Ein lokales Rettungsbundle liegt unter
     `.git/codex-release-bundles/20260503-1140/`.

5. **Datenbank- und Feature-Drift**
   - `supabase migration list --linked` zeigt eine lokale, nicht remote angewendete Migration:
     `20260427120000_schedule_post_aspect_ratio.sql`.
   - `supabase db push --dry-run --linked` bestätigt: genau diese Migration würde gepusht.
   - Feed-Code enthält Adapter gegen alte Spaltennamen und kommentierte Workarounds wegen `seen_posts` / `get_vibe_feed`.
   - Ergebnis: Feature-Code erwartet Schema A, Produktion hat teilweise Schema B.

6. **Performance-Probleme entstehen strukturell**
   - `/explore` ist wegen auth-abhängiger Serverdaten vollständig dynamisch und `no-store`.
   - Die Feed-API ist cachebar und schnell, aber die Page-Shell nicht.
   - Alte R2-Objekte haben teilweise keine Cache-Control-Metadaten.
   - Einige Feed-Bilder sind mehrere MB groß.
   - Videos ohne Thumbnail fallen auf Platzhalter zurück.
   - Ergebnis: Nutzer sehen langsame Seiten, Z-Placeholder, unnötigen Traffic und schlechte erste Ladezeit.

7. **Production-Env ist unvollständig**
   - Vercel Production enthält aktuell nur:
     `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_R2_UPLOAD_CACHE_CONTROL`.
   - Lokale Web-Env enthält zusätzlich Sentry, PostHog, Stripe, LiveKit, Giphy usw.
   - Ergebnis: Features sind lokal vorbereitet, aber in Production still deaktiviert oder kaputt.

8. **Feature-Scope ist zu breit für den Stabilitätsgrad**
   - Feed, Upload, Live, Shop, Payments, AI Image, Voice, Push, Stories, Women-Only, Guilds, Studio, DMs.
   - Der Kernloop ist aber noch nicht hart abgesichert: Login, Upload, Thumbnail, Feed, Postdetail, Kommentare, Profilgrid.
   - Ergebnis: Energie verteilt sich auf viele Oberflächen, während Basisfehler weiterleben.

## 2. Timeline des hypothetischen Scheiterns

### Monat 0 bis 1: "Es funktioniert doch gerade"

Frühwarnsignale:

- App und Website zeigen nicht dieselben Medienzustände.
- CORS und Uploads werden manuell repariert.
- Lint ist rot, Build ist trotzdem grün.
- Es gibt mehrere `.env`-Dateien und mehrere Projektordner.
- Neue Posts erscheinen, aber einige Videos zeigen nur Platzhalter.

Warum ignoriert:

- Sichtbare Features liefern schnelle Erfolgserlebnisse.
- Einzelne Hotfixes wirken schneller als Strukturarbeit.
- Lokale Tests ersetzen keine echte Produktionsdiagnose.

### Monat 2 bis 3: "Neue Features brechen alte Flows"

Frühwarnsignale:

- Geplante Posts, Thumbnails, Feed-Ranking und RLS verhalten sich unterschiedlich je nach Client.
- Vercel hat nicht dieselben Env-Werte wie lokal.
- Supabase-Migrationen und Edge Functions sind aktiv, aber nicht als Release-Prozess gekoppelt.
- Uploads laufen über R2, Supabase Storage und alte Public URLs gleichzeitig.

Folge:

- Web-Upload geht, Native-Upload ist langsam oder uneinheitlich.
- Feed wirkt zufällig, nicht personalisiert.
- Debugging dauert lange, weil unklar ist, welcher Client welchen Pfad nutzt.

### Monat 4 bis 6: "Wachstum macht Instabilität sichtbar"

Frühwarnsignale:

- Große Medien sprengen Ladezeiten und Bandbreite.
- Kein harter Performance-Budget-Test.
- Fehlende Observability: Sentry/PostHog in Production nicht vollständig.
- Fehler werden teils als leere Arrays oder "best effort" geschluckt.

Folge:

- Nutzer verlieren Vertrauen: Uploads, Feed und Kommentare fühlen sich unzuverlässig an.
- Entwickler verlieren Geschwindigkeit: jeder Fix beginnt mit Quellensuche.
- Launch/Monetarisierung scheitert nicht am UI, sondern an Betrieb, Konsistenz und Performance.

## 3. Aktuelle Befunde mit Nachweis

### Backup

Erstellt unter `/Users/zaurhatuev/vibes-backups/20260503-020559`.

### Release-Hygiene

- Branch erstellt/gewechselt: `codex/release-hygiene-20260503`.
- Stale Git-Locks aus April wurden entfernt:
  `.git/HEAD.lock`, `.git/index.lock`, `.git/packed-refs.lock`.
- Der vorher staged Index wurde gesichert:
  `.git/codex-index-backups/20260503-1138-before-unstage.patch`.
- Danach wurde der Index mit `git restore --staged .` geleert.
- Keine Working-Tree-Datei wurde dadurch zurückgesetzt.
- Backup-vs-Current Rettungsbundle:
  - `.git/codex-release-bundles/20260503-1140/status-after-unstage.txt`
  - `.git/codex-release-bundles/20260503-1140/rescue-relative-paths.txt`
  - `.git/codex-release-bundles/20260503-1140/rescue.patch`
- Das Bundle umfasst 34 relevante Rettungsdateien seit dem lokalen Backup und schließt Env-Dateien aus.
- Die anschließende isolierte Temp-Worktree-Prüfung zeigte: 34 Dateien allein reichen
  gegen Git-HEAD nicht für Web-Typecheck, weil der aktuelle lauffähige Web-Stand weitere
  lokale Code-Dateien braucht.
- Der geplante Commit wurde kontrolliert auf 50 Dateien erweitert.
- Nicht enthalten bleiben `.lock` und `apps/remotion/`, weil sie groß/unklar/generiert sind.
- Isolierte Temp-Worktree-Verifikation für den geplanten Commit ist grün:
  Root-Typecheck, Root-Tests, Web-Typecheck, Web-Lint, Web-Tests, Web-Build.

### Codebasen

- `/Users/zaurhatuev/vibes-app`: Monorepo, Web, Supabase, Native-Variante.
- `/Users/zaurhatuev/vibes-app/apps/web`: aktive Vercel-Web-App.
- `/Users/zaurhatuev/Desktop/vibes-app`: aktiv gestartete iOS-App.
- `/Users/zaurhatuev/vibes-app/vibes-web`: zusätzliches eigenes Web-Repo.

### Native Drift

- Monorepo Native `app.json`: Name `Serlo`, Version `1.26.3`, Android Package `app.serlo.social`, Build Number `268`.
- Desktop Native `app.json`: Name `Vibes`, Version `1.0.0`, Android Package `app.vibes.social`, Build Number `154`.
- Beide nutzen denselben iOS Bundle Identifier `com.vibesapp.vibes` und dieselbe EAS Project ID.

### Upload Drift

- Web R2-Upload:
  - `/Users/zaurhatuev/vibes-app/apps/web/components/create/create-editor.tsx`
  - `/Users/zaurhatuev/vibes-app/apps/web/app/actions/posts.ts`
  - `/Users/zaurhatuev/vibes-app/supabase/functions/r2-sign/index.ts`
- Monorepo Native R2-Upload:
  - `/Users/zaurhatuev/vibes-app/lib/uploadMedia.ts`
- Aktive Desktop Native Supabase-Storage-Upload:
  - `/Users/zaurhatuev/Desktop/vibes-app/lib/uploadMedia.ts`

### Web Checks

- `npm run typecheck` in `/Users/zaurhatuev/vibes-app/apps/web`: grün.
- `npm run build` in `/Users/zaurhatuev/vibes-app/apps/web`: grün.
- `npm test -- --runInBand` in `/Users/zaurhatuev/vibes-app/apps/web`: 18 Suites, 274 Tests grün.
- `npm run lint -- --quiet` in `/Users/zaurhatuev/vibes-app/apps/web`: grün.
- `npm run lint` in `/Users/zaurhatuev/vibes-app/apps/web`: 0 Fehler, Warnungen bleiben sichtbar.
- `next build` prüft TypeScript und Lint wieder aktiv.
- Web-Tests laufen ohne die vorherigen React-`act()`-Warnungen aus `components/feed/feed-list.tsx`.

### Native Checks

- `npm run typecheck` in `/Users/zaurhatuev/Desktop/vibes-app`: grün.
- `npm run lint` in `/Users/zaurhatuev/Desktop/vibes-app`: grün.
- `npm test` in `/Users/zaurhatuev/Desktop/vibes-app`: kein `test`-Script vorhanden.
- `npm test -- --runInBand` in `/Users/zaurhatuev/vibes-app`: 2 Suites, 62 Tests grün.

### R2 / Upload

- R2 CORS für Bucket `vibes-media` wurde gesetzt.
- Erlaubt: `https://serlo-web.vercel.app`, `localhost:3000/3001`, `127.0.0.1:3000/3001`.
- Methoden: `GET`, `HEAD`, `PUT`.
- Header: `content-type`, `cache-control`.
- Live Preflight gegen R2 gibt `204` mit passenden CORS-Headern.
- Vercel Production hat `NEXT_PUBLIC_R2_UPLOAD_CACHE_CONTROL=1`.
- Phase-0-Fix am 2026-05-03:
  - Aktive Desktop-Native-App `/Users/zaurhatuev/Desktop/vibes-app` lädt neue Posts,
    Story-Medien, Thumbnails und Avatare jetzt über `r2-sign` nach R2.
  - `r2-sign` wurde gehärtet und deployed: Version 21.
  - Anonyme Signier-Versuche werden mit `401 UNAUTHORIZED_NO_AUTH_HEADER` blockiert.
  - Die Function akzeptiert nur eigene User-Pfade wie
    `posts/videos/{userId}/...`, `posts/images/{userId}/...`,
    `thumbnails/{userId}/...`, `avatars/{userId}/...`, `voice-samples/{userId}/...`.

### Live Website

- Finaler Production Deploy am 2026-05-03:
  `dpl_FhacqB5DRpRiG6SpJ3nCHPHfqfdk`, Alias `https://serlo-web.vercel.app`.
- `https://serlo-web.vercel.app/api/feed/explore?offset=0&limit=12&sort=forYou` liefert Posts.
- Erste Seite: 12 Posts, 8 Videos, `hasMore: true`.
- 3 Videos hatten kein `thumbnail_url`:
  - `ada22442-031f-4485-a0ca-d133683ccd4f`
  - `7faaa080-ec41-49dd-9c06-20ca2cb912a3`
  - `7349cad1-e9d8-4c6d-836e-819307feeddf`
- UI-Fallback ist deployed: Explore Cards und Profile Grid laden bei fehlendem Thumbnail Video-Metadaten und zeigen den ersten Frame statt dauerhaftem Z-Placeholder.
- FeedList Live-Injection ist bereinigt: leere Live-Antworten erzeugen keinen Extra-State-Update mehr und der Fetch wird beim Unmount abgebrochen.
- Warme Feed-API-Antwortzeiten nach finalem Deploy: ca. `0.747s`, danach `0.279s`.
- Warme `/explore`-Antwortzeiten nach finalem Deploy: erster Alias-Warmup ca. `3.95s`, danach ca. `0.729s`.
- Explore-Performance-Fix ist deployed:
  `getForYouFeed`, `getDiscoverPeople` und `getShopProducts` verwenden den gecachten `getUser()`-Helper statt separater paralleler Supabase-Auth-Roundtrips.
- Einige alte R2-Objekte haben keine Cache-Control-Metadaten.

### Supabase

- `npx supabase functions list --project-ref llymwqfgujwkoxzqxrlm` zeigt aktive Functions, darunter `r2-sign`, `livekit-token`, `generate-image`, `send-web-push`, `publish-scheduled-posts`.
- `npx supabase migration list --linked` zeigte zunächst eine fehlende Remote-Migration:
  `20260427120000_schedule_post_aspect_ratio.sql`.
- Phase-0-Fix wurde am 2026-05-03 angewendet:
  `npx supabase db push --linked --yes`.
- Verifikation danach: `20260427120000` ist lokal und remote synchron.

### Vercel Env

`npx vercel env ls` zeigt in Production aktuell nur vier Env Keys:

- `NEXT_PUBLIC_R2_UPLOAD_CACHE_CONTROL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

## 4. Rettungsprinzipien

1. **Ein Source of Truth**
   - Ziel: `/Users/zaurhatuev/vibes-app` wird das zentrale Monorepo.
   - Desktop Native wird entweder sauber hineinmigriert oder als Archiv eingefroren.
   - `vibes-web/` wird archiviert oder entfernt, aber nicht mehr parallel weiterentwickelt.

2. **Ein Upload-Pfad**
   - Neue Medien immer R2.
   - Native, Web, Avatare, Voice Samples und Thumbnails verwenden denselben Signing-Contract.
   - Supabase Storage bleibt nur Legacy-Lesequelle, nicht neuer Schreibpfad.

3. **Kernloop zuerst**
   - Login.
   - Medienupload.
   - Thumbnail.
   - Feed.
   - Postdetail.
   - Kommentare.
   - Profilgrid.
   - Erst danach Shop, Live, AI, Voice, Push und Studio weiter ausbauen.

4. **Quality Gates dürfen nicht lügen**
   - Lint muss grün oder bewusst als blockierendes Problem markiert sein.
   - Build darf TypeScript/Lint nicht dauerhaft ignorieren.
   - Tests dürfen keine `console.error`-Warnungen verstecken.

5. **Performance-Budget als Produktanforderung**
   - Explore/Home erste Seite < 1.5s auf gutem Netz.
   - Feed API < 250ms warm.
   - Grid-Medien: keine MB-großen Vollbilder als Thumbnails.
   - Videos in Grids nie ohne Poster/Thumbnail.

## 5. Verbesserungsplan

### Phase 0 — Stabilisieren und einfrieren (heute)

1. Rescue-Dokument commitfähig halten.
2. Keine großen Feature-Arbeiten, bis Source-of-Truth geklärt ist.
3. Git-Zustand sichern und sortieren:
   - Web/Monorepo: unstaged/staged Änderungen trennen.
   - Keine Massen-Deletes committen, bevor klar ist, ob sie gewollt sind.
   - Coverage-Artefakte aus Git entfernen, aber nach Review nicht blind resetten.
4. Missing Supabase Migration wurde angewendet und verifiziert:
   - `20260427120000_schedule_post_aspect_ratio.sql`
   - `npx supabase migration list --linked` zeigt lokal/remote synchron.
5. Vercel Env-Inventar vervollständigen:
   - Sentry/PostHog optional, aber bewusst.
   - Stripe/LiveKit/Giphy nur setzen, wenn diese Features in Production sichtbar bleiben sollen.

### Phase 1 — Source of Truth und Upload-Unifizierung (1 bis 3 Tage)

1. Entscheidung: Monorepo `/Users/zaurhatuev/vibes-app` ist das Hauptprojekt.
2. Desktop Native bleibt kurzfristig aktive Dev-Build-Quelle, bis seine Änderungen
   gezielt ins Monorepo portiert sind.
3. Desktop Native R2-Upload ist erledigt:
   - `uploadPostMedia`
   - `generateAndUploadThumbnail`
   - `uploadAvatar`
   - Upload-Retry/Progress
   - identische Cache-Control-Header
4. Desktop Native Änderungen inventarisieren und gezielt in Monorepo portieren.
5. Desktop Native danach archivieren oder auf Readme "nicht aktiv" setzen.
6. Env-Doctor-Script bauen:
   - prüft Web local, Vercel, Expo local, EAS env, Supabase functions assumptions.
   - gibt nur Key-Namen und Status aus, niemals Secret-Werte.

### Phase 2 — Media Performance und Backfill (2 bis 5 Tage)

1. Backfill für fehlende Video-Thumbnails:
   - IDs ohne `thumbnail_url` finden.
   - Thumbnails serverseitig oder einmalig lokal generieren.
   - `posts.thumbnail_url` aktualisieren.
2. Bild-Backfill:
   - alte große Bilder identifizieren.
   - kleine WebP/JPEG-Thumbnails erzeugen.
   - Grid nutzt Thumbnail statt Original.
3. R2-Objekt-Metadaten:
   - neue Uploads haben `Cache-Control`.
   - alte kritische Assets neu kopieren oder CDN-Regel setzen.
4. Web-Grid:
   - Platzhalter nur als Fehlerfallback.
   - UI-Fallback fuer Videos ohne Thumbnail ist deployed.
   - Videos ohne Thumbnail bekommen eindeutigen "wird verarbeitet"-State oder Backfill-Pflicht.

### Phase 3 — Web Quality Gate reparieren (erledigt, Restwarnungen offen)

1. `next lint` auf ESLint CLI migrieren: erledigt.
2. Web eigene ESLint Flat Config ergänzen: erledigt.
3. Fehlende Plugins/Rules sauber installieren oder Regeln entfernen: erledigt.
   - `@next/next/no-img-element`
   - `jsx-a11y/media-has-caption`
4. `react/no-unescaped-entities` Fehler beheben: erledigt.
5. Tests so konfigurieren, dass `console.error` in Tests fehlschlägt, außer explizit erwartet: offen.
6. In `next.config.mjs` wieder aktivieren: erledigt.
   - `typescript.ignoreBuildErrors: false`
   - `eslint.ignoreDuringBuilds: false`

### Phase 4 — Feed und Datenmodell härten (3 bis 7 Tage)

1. Entscheiden, ob `get_vibe_feed` wieder offizielle Feed-RPC wird oder Web weiter direkte Queries nutzt.
2. `seen_posts` Drift endgültig lösen:
   - Tabelle/Migration wirklich vorhanden oder RPC entfernen.
3. Feed-API darf Fehler nicht als leeren Feed mit HTTP 200 maskieren.
4. RLS-Tests für zentrale Tabellen:
   - posts
   - comments
   - likes
   - bookmarks
   - follows
   - scheduled_posts
5. Scheduled Posts Migration remote anwenden und Smoke-Test durchführen.
   - Migration `20260427120000_schedule_post_aspect_ratio.sql` ist remote angewendet und synchron.

### Phase 5 — Production Observability (1 bis 2 Tage)

1. Sentry Production bewusst aktivieren oder bewusst deaktivieren.
2. PostHog bewusst aktivieren oder bewusst deaktivieren.
3. Upload-Metriken erfassen:
   - sign success/fail
   - R2 PUT success/fail
   - thumbnail success/fail
   - post insert success/fail
4. Minimaler Healthcheck:
   - Supabase erreichbar
   - R2 CORS ok
   - Feed liefert Posts
   - Create signiert Upload
   - Vercel env vollständig

### Phase 6 — Performance-Budget und Release-Prozess (1 Woche)

1. Lighthouse/Playwright-Smoke für `/`, `/explore`, `/create`, `/p/[id]`.
2. Media budget:
   - Grid image target < 250 KB.
   - Initial page payload begrenzen.
   - Keine Fullsize-Originale in Thumbnail-Grids.
3. Release-Checkliste:
   - typecheck
   - lint
   - tests
   - build
   - Supabase migration list
   - Vercel env list
   - R2 CORS preflight
   - live feed smoke
4. Branch-Regel:
   - kein Deploy aus Dirty State.
   - keine parallelen Source-of-truth-Repos.

## 6. Sofort-Prioritäten

Die nächsten praktischen Schritte:

1. Source-of-Truth-Steuerdatei wurde ergänzt:
   `/Users/zaurhatuev/vibes-app/SOURCE_OF_TRUTH_MIGRATION_2026-05-03.md`.
2. Web/Monorepo Git-Zustand sortieren, ohne fremde Änderungen zu verlieren.
   - Erledigt für den Index: Massen-Deletes sind nicht mehr staged.
   - Erledigt: Rettungsbundle wurde geprüft und um notwendige Code-Abhängigkeiten
     auf 50 Dateien erweitert.
   - Offen: Commit nach Gates erstellen.
3. Root-Typecheck ist repariert:
   `zod` wurde im Root deklariert, `npm run typecheck` ist grün.
4. Web Lint-Konfiguration ist repariert:
   `next lint` wurde auf ESLint CLI migriert, `npm run lint` hat 0 Fehler.
   `next build` prueft TypeScript und Lint wieder aktiv.
5. Production ist deployed:
   `dpl_FhacqB5DRpRiG6SpJ3nCHPHfqfdk`, Alias `https://serlo-web.vercel.app`.
   Smoke: Startseite 200, `/explore` 200, Feed API 200, R2 CORS 204.
6. Z-Placeholder ist entschärft:
   Explore Cards und Profile Grid zeigen bei fehlendem Thumbnail den ersten Video-Frame.
   Thumbnail-Backfill für die bekannten Video-Posts ohne `thumbnail_url` bleibt als Performance-Aufgabe.
7. Explore-Performance ist verbessert:
   Serverdaten nutzen pro Request den gecachten `getUser()`-Helper statt mehrerer paralleler Auth-Abfragen.
   Warm-Smoke nach Deploy: `/explore` ca. `0.729s`, Feed API ca. `0.279s`.
8. Test-Hygiene ist verbessert:
   FeedList bricht den Live-Fetch sauber ab und vermeidet leere State-Updates.
   `npm test -- --runInBand` ist grün ohne React-`act()`-Warnung.
9. Env-Doctor-Script ist gebaut:
   Root `npm run env:doctor -- --no-fail`, Web `npm run env:doctor`.
10. Desktop-Native-Core-Social-Diffs einzeln ins Monorepo portieren:
   Kommentare, Teilen, Post-Optionen, Create-Flow.

## 7. Definition of Victory

Das Projekt ist in 6 Monaten nicht gescheitert, wenn diese Aussagen wahr sind:

- Es gibt genau ein aktives Native-Projekt und eine aktive Web-App.
- Neue Uploads landen immer in R2 und haben Cache-Control.
- Jeder Video-Post hat ein Thumbnail oder einen kontrollierten Processing-State.
- Web und Native lesen dieselben Post-Felder und Medien-URLs.
- Lint, Typecheck, Tests und Build sind grün und blockieren Releases.
- Supabase-Migrationen sind lokal und remote synchron.
- Vercel/EAS/Supabase Env-Status ist dokumentiert und prüfbar.
- Feed- und Upload-Fehler erscheinen in Logs/Metriken, nicht als leere UI.
- Die erste Nutzererfahrung ist schnell: Login, Feed, Upload, Postdetail, Kommentare.
