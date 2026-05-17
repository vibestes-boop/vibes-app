# Vibes/Serlo Premortem: Warum wir in 6 Monaten gescheitert waeren

Stand: 2026-05-03

Ziel dieses Dokuments: Wir tun so, als waere das Projekt im November 2026
gescheitert, und arbeiten rueckwaerts. Jeder Punkt braucht ein Fruehsignal,
eine technische Gegenmassnahme und einen Check, der nicht von Erinnerung oder
Disziplin abhaengt.

## Top-Risiken

| Rang | Risiko | Scheiterbild in 6 Monaten | Fruehsignal heute | Guardrail |
| --- | --- | --- | --- | --- |
| 1 | Medien-Performance driftet wieder | Explore/Profile laden langsam, Scrollen fuehlt sich zaeh an | Erste Feed-Seite hatte 35 MB Medien, fehlende Cache-Header, fehlende Thumbnails | `npm run stability:media-budget` gegen Feed-Medien |
| 2 | App und Web laufen auseinander | Posts/Uploads/Login funktionieren auf iOS, aber nicht im Web oder umgekehrt | Zwei lokale Projektpfade, Schema-Drift zwischen Mobile-DB und Web-Contract | Gemeinsame Contract-Tests fuer Feed/Post/Upload |
| 3 | Env/Secrets bleiben fragil | Deploy ist gruen, aber Upload/Auth/R2 brechen in Prod | Mehrere `.env`-Dateien, fehlende R2/Supabase-Werte, manuelle Setup-Schritte | `npm run env:doctor -- --no-fail` lokal und in Release-Checkliste |
| 4 | RLS/DB-Drift bleibt unsichtbar | APIs liefern leere Listen statt echte Fehler, Nutzer sehen "keine Posts" | Catch-Bloecke mit leeren Ergebnissen, RPC/Table-Drift | Kritische API-Errors loggen und bei Smoke-Tests sichtbar machen |
| 5 | Observability fehlt | Nutzer melden Bugs per Screenshot, Ursache bleibt unklar | Sentry/PostHog optional oder leer, Queue/Cron/Media-Zustand nur manuell sichtbar | `npm run monitor:integrity` prueft Queue, Cron, R2-Functions und kaputte Medienreferenzen |
| 6 | Feature-Breite ueberholt Stabilitaet | Live, Shop, AI, Coins, Guilds, Feed wirken unfertig | Viele Produktflaechen, wenige automatische End-to-End-Checks | Stabilitaetsfenster: Speed, Upload, Auth, Feed vor neuen Grossfeatures |
| 7 | Backups werden nicht restauriert getestet | Datenverlust oder kaputte Migration wird erst im Ernstfall entdeckt | Backup wird erwaehnt, Restore nicht geprobt | Monatlicher Restore-Test fuer Supabase + R2-Stichprobe |
| 8 | Kosten/Bandbreite laufen weg | R2/egress/compute steigen schneller als Nutzung | Grosse Originalbilder, Video-Previews, AI und Live wachsen ohne Budgetsignal | `npm run cost:health` plus Medienbudget, Cache-Control, Thumbnail-Backfills, Upload-Kompression |
| 9 | CI prueft nicht die echten Nutzerpfade | Tests gruen, Prod trotzdem kaputt | Unit-Tests stark, aber wenige Live-Smokes | Scheduled stability workflow gegen Production-Feed plus `npm run stability:auth` |
| 10 | Release-Hygiene bleibt manuell | Deploys passieren aus falschem Ordner/Repo oder mit altem Branch | Zwei lokale Repos/Pfade und manuelle Vercel CLI-Schritte | `npm run release:gate` plus Deployment-Runbook als Standard |
| 11 | Produktfokus bleibt Bauchgefuehl | Features werden gebaut, aber Creator kommen nicht wieder | Kein woechentlicher North-Star-/Retention-Report | `npm run product:health` als Start jedes Product Reviews |
| 12 | Moderation bleibt eine UI statt ein Betriebssystem | Reports landen in Legacy-Tabellen, bleiben ueber 24h offen oder werden ohne Audit geschlossen | Report-Pfade schreiben in verschiedene Tabellen, Admin-Aktionen haben keinen Audit-Trail | `npm run moderation:health`, zentrale `content_reports` Queue, Admin-Audit-Log |
| 13 | Ownership bleibt implizit | Jeder sieht rote Signale, aber niemand ist eindeutig verantwortlich | Guards existieren, aber ohne Owner, Review-Rhythmus und Feature-Intake | `npm run governance:health`, Owner-Matrix, Weekly Review, Feature Intake |
| 14 | Alerts bleiben nur rote CI-Runs | Checks schlagen fehl, aber niemand arbeitet die Ursache ab | Keine Issue-/Owner-Eskalation bei Guard-Fehlschlag | `stability-alert` GitHub Issue aus dem Weekly Workflow |
| 15 | Push/Feed-Gesundheit bleibt blind | Feeds liefern 200 mit leerem Payload oder Push-Dispatch ist still kaputt | Feed-Catches maskieren Fehler, Push-Trigger/Subscriptions werden nicht aggregiert | `npm run push-feed:health` gegen DB-Snapshot und Public Feed APIs |
| 16 | Niemand sieht das Gesamtsystem | Einzelchecks sind gruen, aber Trends und gelbe Risiken werden nicht gemeinsam betrachtet | Kein Ampel-Board fuer Weekly Review | `npm run health:dashboard` als Status-Board |

## Timeline des hypothetischen Scheiterns

### Monat 1: Performance wird wieder "nur ein bisschen" schlechter

Neue Uploads und alte Medien mischen sich. Einzelne Feed-Kacheln nutzen wieder
Originale statt Thumbnails. Weil keine Budget-Grenze existiert, faellt es erst
auf, wenn der Feed subjektiv langsam wirkt.

Nicht ignorieren:
- Erste Feed-Seite > 5 MB Thumbnail/Poster-Medien.
- Ein einzelnes Grid-Medium > 1 MB.
- Video-Post ohne `thumbnail_url`.
- R2-Objekt ohne `Cache-Control`.

### Monat 2: Web und Native zeigen unterschiedliche Wahrheit

Ein Post existiert in der App, aber Web zeigt ihn nicht, oder Upload schreibt
Felder, die eine Seite anders interpretiert. Schema-Adapter wachsen ohne
Contract-Tests.

Nicht ignorieren:
- Neue DB-Spalte wird in Native genutzt, Web kennt sie nicht.
- Web-API hat `catch { return [] }` an kritischen Datenpfaden.
- `media_type`, `thumbnail_url`, `privacy`, `author_id` werden mehrfach anders
  normalisiert.

### Monat 3: Auth/Secrets brechen bei einem Release

Ein Deploy nutzt falsche Env-Werte oder eine lokale Datei wird mit der
falschen Projektkopie verwechselt. Feature wirkt kaputt, obwohl Code korrekt
ist.

Nicht ignorieren:
- `env:doctor` meldet Required missing > 0.
- Lokale Datei und Vercel-Env unterscheiden sich ohne Absicht.
- Es gibt keinen klaren Ort fuer "welche Env gehoert zu welcher Runtime".

### Monat 4: Nutzerfehler sind nicht sichtbar

Uploads, Login oder Feed schlagen bei echten Nutzern fehl, aber wir sehen nur
Screenshots. Fehler werden im Client verschluckt oder Server-Logs sind nicht
zentral.

Nicht ignorieren:
- Wiederholte "Failed to fetch" Screenshots.
- API-Route gibt 200 mit leerem Payload nach einem Catch zurueck.
- Keine Fehlerquote pro Kernflow.

### Monat 5: Features stapeln sich

Live, Shop, Coins, Messages, AI und Feed konkurrieren um Aufmerksamkeit. Ohne
Stabilitaetsfenster werden Bugs ueberdeckt statt geschlossen.

Nicht ignorieren:
- Neue Features landen, bevor Upload/Auth/Feed stabil gemessen sind.
- Tests wachsen nicht proportional zur Produktflaeche.
- Performance-Bugs kommen in Wellen zurueck.

### Monat 6: Vertrauen geht verloren

Nutzer glauben nicht mehr, dass Posts, Uploads und Feed verlaesslich sind.
Performance ist nicht der einzige Grund, aber sie ist der sichtbare Grund.

## Stabilitaets-Definition

Das Projekt gilt fuer die naechsten 6 Monate als gesund, wenn diese Bedingungen
regelmaessig erfuellt sind:

- Feed-API liefert erste Seite warm in < 300 ms.
- Erste 24 Explore-Medien bleiben unter 5 MB.
- Kein Video-Post in der ersten Explore-Seite fehlt ein Thumbnail.
- Kein geprueftes R2-Medium fehlt starke Cache-Control-Header.
- `env:doctor` zeigt Required missing: 0.
- Web typecheck, lint quiet, tests und build sind gruen.
- Native typecheck, lint und tests sind gruen.
- Production-Smoke nach Deploy prueft `/`, `/explore`, Feed-API und Upload-Signatur.
- Auth-Smoke loggt einen Testaccount ein, schreibt Kommentar/Like/Bookmark und raeumt danach auf.
- Backend-Integrity-Monitor ist gruen: keine failed R2-Queue-Rows, `r2-delete-queue`
  ist aktiv, R2-Functions antworten, aktuelle Medienreferenzen sind erreichbar.
- Woechentlicher Integrity-Check ist gruen: keine Posts ohne Content, keine
  failed Queue-Rows, keine zu alten pending Queue-Rows, keine R2-Objekte ohne
  Post-Referenz.
- Product-Health-Report liegt woechentlich vor: North Star, WAU/MAU,
  D1/D7-Retention, Engagement-Raten und Time-to-First-Post.
- Cost-Health-Report liegt woechentlich vor: AI-Kosten, Kosten pro MAU,
  Medien/R2, Live-Minuten, Recording-Minuten und Edge/DB-Usage-Proxies.
- Moderation-Health-Report liegt woechentlich vor: pending Reports, Reports
  ueber 24h SLA, unqueued Legacy-Reports und Admin-Audit-Events.
- Governance-Health-Report liegt woechentlich vor: Owner-Matrix, Weekly Review,
  Feature Intake und Workflow-Abdeckung sind pruefbar.
- Weekly-Health-Fehler erzeugen ein `stability-alert` GitHub Issue mit Owner-
  und Freeze-Regeln.
- Push/Feed-Health-Report liegt woechentlich vor: Push-Token/Subscriptions,
  Notifications, Trigger, Feed-Endpunkte und leere Feed-Antworten.
- Health-Dashboard liegt woechentlich vor: alle Health-Snapshots werden als
  Green/Yellow/Red Status-Board zusammengefasst.

## Naechste technische Guardrails

1. Media-Budget-Check automatisieren.
2. API-Error-Masking abbauen, zuerst Feed und Upload.
3. Sentry/PostHog aktivieren oder bewusst als Aufgabe terminieren.
4. Contract-Tests fuer Post/Feed-Normalisierung zwischen App und Web.
5. Auth-Interaction-Smoke nachts gegen Production mit Testaccount laufen lassen.
6. Release-Checkliste fuer Vercel, Supabase, R2 und GitHub.
7. Restore-Test dokumentieren und monatlich ausfuehren.
8. Backend-Integrity-Monitor als Pflicht-Gate fuer Queue, Cron, Functions und
   Medienreferenzen laufen lassen.
9. Deployment-Runbook fuer App, SQL, Functions, Secrets, Cron und Verify
   verpflichtend machen.
10. Cost-Health-Check fuer AI, R2/Media, Live/Recording und Edge/DB-Proxies
    woechentlich laufen lassen und teure Features hinter Flags halten.
11. Moderation-Health-Check fuer Report-Queue, 24h SLA, Legacy-Report-Drift und
    Admin-Audit-Log woechentlich laufen lassen.
12. Governance-Health-Check fuer Owner-Matrix, Weekly Review und Feature Intake
    woechentlich laufen lassen.

## Entscheidung

Bis die Guardrails stehen, werden neue grosse Features nachrangig behandelt.
Prioritaet: Feed, Upload, Auth, Medien, Monitoring.
