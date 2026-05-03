# Source of Truth Migration - 2026-05-03

Status: Arbeitsdokument fuer die Konsolidierung von Web, Native und Supabase.

## Fuehrende Codebasis

Ab jetzt ist `/Users/zaurhatuev/vibes-app` das fuehrende Projekt.

- Web Production: `/Users/zaurhatuev/vibes-app/apps/web`
- Supabase Functions/Migrations: `/Users/zaurhatuev/vibes-app/supabase`
- Native Zielprojekt: `/Users/zaurhatuev/vibes-app`
- Aktive iOS-Dev-Build-Quelle bis zur vollstaendigen Migration: `/Users/zaurhatuev/Desktop/vibes-app`
- Altes Web-Repo: `/Users/zaurhatuev/vibes-app/vibes-web`

Wichtig: Desktop Native darf nicht wholesale ins Monorepo kopiert werden. Viele Monorepo-Dateien sind neuer, groesser und enthalten Web-/Serlo-spezifische Arbeit. Portiert wird nur Feature fuer Feature.

## Bereits erledigt

### R2 und Upload

- R2 CORS fuer Bucket `vibes-media` gesetzt.
- Erlaubte Origins:
  - `https://serlo-web.vercel.app`
  - `http://localhost:3000`
  - `http://localhost:3001`
  - `http://127.0.0.1:3000`
  - `http://127.0.0.1:3001`
- Erlaubte Methoden: `GET`, `HEAD`, `PUT`.
- Erlaubte Header: `content-type`, `cache-control`.
- Live Preflight gegen R2 liefert `204`.
- Vercel Production hat `NEXT_PUBLIC_R2_UPLOAD_CACHE_CONTROL=1`.

### Supabase

- Fehlende Migration `20260427120000_schedule_post_aspect_ratio.sql` wurde remote angewendet.
- `npx supabase migration list --linked` ist fuer diese Migration synchron.
- Edge Function `r2-sign` wurde gehaertet und deployed.
- `r2-sign` blockiert anonyme Signier-Versuche mit `401 UNAUTHORIZED_NO_AUTH_HEADER`.
- `r2-sign` akzeptiert nur eigene User-Pfade:
  - `posts/videos/{userId}/`
  - `posts/images/{userId}/`
  - `thumbnails/{userId}/`
  - `avatars/{userId}/`
  - `voice-samples/{userId}/`

### Native Desktop

- Aktive Desktop-Native-App laedt neue Post-Medien, Thumbnails und Avatare via R2.
- Desktop-Native loescht nur noch Legacy-Supabase-Storage-Objekte; R2-URLs werden nicht falsch an Supabase Storage uebergeben.
- Desktop-Native Checks:
  - `npm run typecheck`: gruen.
  - `npm run lint`: gruen.

### Monorepo Native

- `voice-samples` Upload-Key wurde an den neuen Ownership-Contract angepasst.
- R2-Delete-Skip fuer R2-URLs wurde ins Monorepo portiert.
- iOS `fmt`/C++20 `consteval` Build-Fix wurde ins Monorepo portiert:
  - `plugins/withFmtConstevalFix.js`
  - `app.json`

### Web Quality Hygiene

- FeedList Live-Injection setzt bei leerer `/api/feed/live` Antwort keinen leeren State mehr.
- FeedList bricht den Live-Fetch beim Unmount via `AbortController` ab.
- Web-Tests laufen ohne die vorherigen React-`act()`-Warnungen aus `components/feed/feed-list.tsx`.
- Unnoetige `jsx-a11y/media-has-caption` Disable-Kommentare aus Explore/Profile-Video-Fallbacks entfernt.

## Production Smoke Stand

Letzter Smoke gegen `https://serlo-web.vercel.app` nach Production-Deploy am 2026-05-03:

- Vercel Production Deployment:
  - ID: `dpl_FhacqB5DRpRiG6SpJ3nCHPHfqfdk`
  - Alias: `https://serlo-web.vercel.app`
  - Status: `READY`
- Startseite `/`: HTTP 200.
- Explore Page `/explore`: HTTP 200.
- Feed API `/api/feed/explore?offset=0&limit=12&sort=forYou`: HTTP 200.
- Kalte Antwortzeit nach finalem Deploy: `/` ca. `3.81s`, `/explore` ca. `0.56s`, Feed API ca. `1.00s`.
- Warme Feed-API-Antwortzeiten: ca. `0.747s`, danach `0.279s`.
- Warme `/explore`-Antwortzeiten: erster Alias-Warmup ca. `3.95s`, danach `0.729s`.
- 12 Posts geliefert, `hasMore: true`.
- 8 Videos in der ersten Seite.
- 3 Videos ohne `thumbnail_url`:
  - `ada22442-031f-4485-a0ca-d133683ccd4f`
  - `7faaa080-ec41-49dd-9c06-20ca2cb912a3`
  - `7349cad1-e9d8-4c6d-836e-819307feeddf`
- UI-Fallback fuer diese Altvideos ist deployed:
  - Explore Cards laden bei fehlendem Thumbnail Video-Metadaten und zeigen den ersten Frame statt dauerhaftem Z-Placeholder.
  - Profile Grid unterscheidet Bild-URLs von Video-URLs und nutzt denselben ersten-Frame-Fallback.
- Explore-Performance-Fix ist deployed:
  - `getForYouFeed`, `getDiscoverPeople` und `getShopProducts` verwenden den pro Request gecachten `getUser()`-Helper.
  - Dadurch vermeidet `/explore` mehrere parallele Supabase-Auth-Roundtrips fuer denselben Request.
- Authentifizierter R2-Sign+PUT Smoke wurde uebersprungen, weil lokal in `apps/web/.env.local` kein `SUPABASE_SERVICE_ROLE_KEY` gesetzt ist.
- R2 CORS Preflight fuer `content-type, cache-control`: HTTP 204 mit korrekten Allow-Headern.

Preview-Deploy:

- URL: `https://serlo-a4jsqhp79-vibestes-2950s-projects.vercel.app`
- Deployment ID: `dpl_2XxMRxzSD6uWG8q37YNiC7HrvPcc`
- Status: `READY`
- Preview ist durch Vercel SSO geschuetzt und liefert extern HTTP 401; das ist kein App-Fehler.

## Desktop-Native Inventar

Desktop Native hatte 36 geaenderte oder ungetrackte Dateien.

Buckets:

- `P0_UPLOAD_DELETE_FLOW`: portiert.
- `P0_UPLOAD_PORTED_TO_DESKTOP_NEEDS_MONOREPO_REVIEW`: teilweise portiert, Monorepo separat geprueft.
- `P1_BUILD_CONFIG`: teilweise portiert. `withFmtConstevalFix` ist erledigt, andere Config-Diffs muessen einzeln reviewt werden.
- `P1_CORE_SOCIAL_FLOW`: noch offen.
- `P2_LIVE`: noch offen.
- `P2_MESSAGES_SHARE`: noch offen.
- `P3_UI_MISC`: noch offen.
- `P3_ASSET_BRANDING`: noch offen.

Offene Core-Social-Dateien duerfen nicht blind kopiert werden:

- `components/ui/CommentsSheet.tsx`
- `components/FeedActionButtons.tsx`
- `components/PostOptionsModal.tsx`
- `components/PostShareModal.tsx`
- `app/create/index.tsx`

Grund: Die Monorepo-Versionen sind teilweise deutlich neuer und groesser als Desktop. Wir portieren nur den konkreten Bugfix oder das konkrete Verhalten.

## Git-Zustand

Monorepo war vor der Release-Hygiene stark dirty:

- `202 D`
- `111 MM`
- `12 M`
- `189 ??`
- Der Schwerpunkt liegt in `apps/web` mit `492` Status-Eintraegen.
- Relevante Rettungsdateien sind nur ein kleiner Teil davon.

Release-Hygiene am 2026-05-03:

- Branch fuer die Aufraeumarbeit: `codex/release-hygiene-20260503`.
- Der alte staged Index wurde vor dem Unstage lokal gesichert:
  `.git/codex-index-backups/20260503-1138-before-unstage.patch`
- Danach wurde nur der Git-Index bereinigt: `git restore --staged .`.
- Keine Working-Tree-Datei wurde dadurch zurueckgesetzt.
- Der Index ist jetzt leer; alle Aenderungen liegen unstaged im Working Tree.
- Ein lokales Backup-vs-Current Rettungsbundle wurde erstellt:
  - `.git/codex-release-bundles/20260503-1140/status-after-unstage.txt`
  - `.git/codex-release-bundles/20260503-1140/rescue-relative-paths.txt`
  - `.git/codex-release-bundles/20260503-1140/rescue.patch`
- Das urspruengliche Rettungsbundle vergleicht gegen `/Users/zaurhatuev/vibes-backups/20260503-020559`
  und umfasst 34 relevante Dateien, ohne Env-Dateien.
- Die isolierte Temp-Worktree-Pruefung zeigte danach, dass Git-HEAD + diese 34 Dateien
  noch nicht allein typecheck-faehig ist, weil der lauffaehige lokale Web-Stand weitere
  bereits vorhandene Code-Aenderungen braucht.
- Der Release-Commit wurde deshalb bewusst auf 50 Dateien erweitert:
  - enthalten: zusaetzliche Web-Daten-/Routen-/Create-/Explore-Dateien, CI-Typecheck,
    R2-CORS-Script, `.gitignore`, `.env.local.example` ohne Werte.
  - zuerst ausgeschlossen: `.lock` und `apps/remotion/` (gross/unklar/generiert).
- Isolierte Temp-Worktree-Verifikation fuer den geplanten Commit:
  - Root `npm run typecheck`: gruen.
  - Root `npm test -- --runInBand`: 2 Suites, 62 Tests gruen.
  - Web `npm run typecheck`: gruen.
  - Web `npm run lint -- --quiet`: gruen.
  - Web `npm test -- --runInBand`: 18 Suites, 274 Tests gruen.
  - Web `npm run build`: gruen.
- Commit erstellt: `6f7880f chore: stabilize web release pipeline`.
- `.lock` wurde als versehentliche Git-Index-Datei entfernt.
- `apps/remotion/` wurde danach separat sortiert:
  - `node_modules` bleibt ignoriert.
  - Render-Ausgaben unter `apps/remotion/out/*` bleiben ignoriert.
  - `apps/remotion/out/.gitkeep` bleibt versioniert.
  - Typecheck: `npm run typecheck` in `apps/remotion` ist gruen.
- Commit erstellt: `4ef7b3a feat: add remotion video package`.

Regel:

- Keine Massen-Deletes committen, bevor klar ist, ob sie gewollt sind.
- Keine fremden Aenderungen resetten.
- Rettungsfixes koennen spaeter aus `rescue-relative-paths.txt` gezielt reviewt und staged werden.
- Der Production-Deploy am 2026-05-03 wurde vor der Commit-Hygiene aus dem damaligen
  Working-Tree gebaut. Die deployed Rettungsarbeit ist jetzt in Git nachgezogen.

## Naechste Arbeit

1. Root-Typecheck ist repariert.
   - `zod` wurde im Root als Dependency deklariert.
   - `npm run typecheck` im Root ist gruen.
2. Web-Lint ist wieder lauffaehig.
   - `next lint` wurde durch ESLint CLI ersetzt.
   - `apps/web/eslint.config.mjs` nutzt Next Core Web Vitals + TypeScript via FlatCompat.
   - Echte Lint-Fehler wurden behoben.
   - Stand: `npm run lint` endet mit 0 Fehlern, aber mit Warnungen als Tech-Debt.
3. Web-Test-Status:
   - `npm run typecheck`: gruen.
   - `npm test -- --runInBand`: 18 Suites, 274 Tests gruen.
   - Die vorherigen React-`act()`-Warnungen in `components/feed/feed-list.tsx` sind behoben.
4. Web-Build-Status:
   - `npm run build`: gruen.
   - `next build` prueft wieder TypeScript und Lint.
   - Warnungen bleiben sichtbar; Fehler blockieren den Build.
5. Env-Doctor ist vorhanden.
   - Root: `npm run env:doctor -- --no-fail`.
   - Web: `npm run env:doctor`.
   - Ausgabe zeigt nur Key-Status und Quellen, niemals Werte.
   - Aktueller Core-Status: Web Core und Native Core haben 0 fehlende Pflicht-Keys.
6. Thumbnail-Backfill vorbereiten.
   - Alte Videos ohne `thumbnail_url` haben jetzt einen UI-Fallback.
   - Backfill-Tool: `npm run thumbnails:backfill -- --dry-run --limit 25`.
   - Dry-Run findet aktuell 4 Video-Posts ohne `thumbnail_url`.
   - Echte Backfill-Thumbnails bleiben wichtig fuer Performance und saubere Poster.
   - `--apply` benoetigt noch `SUPABASE_SERVICE_ROLE_KEY`,
     `CF_R2_ACCESS_KEY_ID` und `CF_R2_SECRET_ACCESS_KEY`.
7. Explore weiter optimieren.
   - Nach dem Auth-Dedupe ist `/explore` warm unter 1s.
   - Naechster Hebel: serverseitige Page-Sektionen splitten oder den anonymen Shell-Anteil statisch/cached machen.
8. Desktop-Native Core-Social-Diffs einzeln portieren.
   - Fokus: Kommentare, Teilen, Post-Optionen, Create-Flow.
9. Root/Native-Lint separat reparieren.
   - `npm run lint -- --quiet` findet aktuell 61 bestehende Fehler.
   - Groesster Block: Hook-Reihenfolge in `app/live/watch/[id].tsx`.
