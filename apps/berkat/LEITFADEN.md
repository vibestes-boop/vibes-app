# Berkat — Arbeitsleitfaden

**Stand: 15.08.2026.** Kein Zustandsbericht — das ist [`HANDOFF.md`](HANDOFF.md). Hier steht, **was
man tut**: nach einer Änderung, vor einer Übergabe, wenn etwas kaputt ist.

Wer das hier liest, muss nicht programmieren können. Die Befehle stehen zum Kopieren da.

---

## 1. Der Entscheidungsbaum

Die einzige Frage nach jeder Änderung: **Muss ich bauen?**

```
Hat sich package.json (natives Paket) oder app.json geändert?
│
├── NEIN  →  Kein Build. Nie.
│            Entwicklung: App neu laden (Metro läuft schon)
│            Produktion:  eas update   → Abschnitt 4
│
└── JA    →  Build nötig. Erst lokal versuchen (kostenlos), Cloud nur für Android.
             → Abschnitt 5
```

**Der Fehler, der Geld kostet:** aus Gewohnheit bauen. Von allem, was am 15.08.2026 an der Kasse
gebaut wurde, war *eine Zeile* buildpflichtig — der Rest lief über Metro.

| Braucht **keinen** Build | Braucht einen Build |
|---|---|
| `.ts` / `.tsx` — Bildschirme, Texte, Logik, Stile | Neues Paket mit **nativem** Anteil |
| Neue Routen, neue Komponenten, neue Hooks | `app.json`: Plugins, Berechtigungen, Icon, Splash |
| SQL, RPCs, Edge Functions | `google-services.json`, Entitlements |
| Bilder und Inhalte, die zur Laufzeit kommen | Expo-SDK-Wechsel |

---

## 2. Täglich arbeiten

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npm start
```

Öffnet Metro. Die App auf dem iPhone ist ein **eigener Dev-Build**, kein Expo Go — LiveKit hat
native Module.

Nach Paket-Änderungen mit geleertem Zwischenspeicher, sonst löst Metro alte Pfade auf:

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npx expo start --dev-client --clear
```

**Vor dem Verbinden prüfen, ob schon ein Metro läuft** — ein zweiter weicht still auf Port 8082 aus,
und der Dev-Client meldet dann nur „failed to connect":

```bash
lsof -nP -iTCP -sTCP:LISTEN | grep 808
```

---

## 3. Vor jeder Übergabe: zwei Prüfungen

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npx tsc --noEmit
```

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npx expo export --platform ios --output-dir /tmp/berkat-check --clear
```

Der Export ist der ehrlichere Test: Er baut das komplette Bundle und findet Auflösungsfehler, die
`tsc` nicht sieht. Läuft er durch, ist der Code lieferbar.

---

## 4. Änderung ausliefern, ohne zu bauen (OTA)

Nur für JS-Änderungen. `EAS_BUILD=1` ist **Pflicht** — ohne das landen Expo-Go-Stubs im Paket:

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && EAS_BUILD=1 npx eas update --branch production --message "kurz was" --non-interactive
```

⚠️ **Berkat hat noch keinen Store-Eintrag und keine Nutzer draußen** — OTA ist hier heute
gegenstandslos. Der Abschnitt gilt für Serlo (dort: **zwei Runtimes**, jede braucht eine eigene
Veröffentlichung — siehe `HANDOFF.md` Abschnitt 8).

---

## 5. Bauen

### Zuerst: kostenlos, auf dem eigenen Mac

Simulator — zieht **kein** EAS-Kontingent:

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npx expo run:ios --no-bundler
```

Bricht `pod install` mit `Unicode Normalization … ASCII-8BIT` ab, ist es die Zeichenkodierung der
Shell, nicht das Podfile:

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --no-bundler
```

Eigenes iPhone am Kabel: dasselbe mit `--device`. Einmal ausprobieren — klappt es, ist der
Entwickler-Build auf dem Telefon ab dann gratis.

### Erst dann: Cloud

Kostet Kontingent. Nur für die Plattform, um die es geht — **nie `--platform all`**:

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && eas build --profile development --platform ios
```

Android ist derzeit der einzige echte Grund für die Cloud: lokal fehlen Java 17+ (installiert ist
1.8) und ein gesetztes `ANDROID_HOME`.

**Native Änderungen stapeln** statt einzeln bauen — die Warteschlange steht in `HANDOFF.md`
Abschnitt 12.

---

## 6. Datenbank ändern

**Niemals `supabase db push`**, solange am SQL-Editor gearbeitet wird. Der Weg ist:

1. SQL im Supabase-SQL-Editor ausführen
2. danach verzeichnen:

```bash
cd /Users/zaurhatuev/vibes-app && supabase migration repair --status applied <version>
```

Die Datei gehört unter `supabase/migrations/` mit **14-stelligem** Zeitstempel
(`YYYYMMDDHHMMSS_name.sql`). Acht Stellen reichen nicht — `db push` überginge sie still.

**Vor jeder neuen Spalten-Referenz** in `supabase/SCHEMA.md` nachschlagen, ob es die Spalte gibt.

---

## 7. Testen: der Zwei-Konten-Durchlauf

Ein zweites Konto ist **Pflicht** — der Server lässt niemanden auf eigene Artikel bieten
(`seller_cannot_bid`). Ein zweites Gerät braucht es nicht: Simulator plus iPhone genügt.

**Weil Push nur auf echten Geräten ankommt: iPhone = Käufer, Simulator = Verkäufer.**

1. Simulator: Verkaufen → Show starten → „Live gehen" → Artikel auflegen → starten
2. iPhone (anderes Konto): Show antippen → bieten → Zuschlag abwarten
3. iPhone: Konto → Deine Pakete → bezahlen — Testkarte `4242 4242 4242 4242`, Ablauf `12/34`, CVC `123`
4. Simulator: Verkaufen → Bestellungen → Sendungsnummer → als versendet markieren
5. iPhone: Konto → „Gekauft" → Zustand und Sendungsnummer müssen dastehen

Einzelne Wege ohne zweites Gerät auslösen — solange der Empfänger ein anderes Konto ist:

```
berkat://tip/<empfänger-id>
berkat://messages/<empfänger-id>
```

---

## 8. Wenn etwas kaputt ist — Verdächtige in dieser Reihenfolge

| Symptom | Erster Verdacht |
|---|---|
| **Weißer Bildschirm** nach einer Änderung | Fast Refresh verträgt keine neuen Hooks. App schließen, neu öffnen. **Erst danach suchen.** |
| **Liste bleibt leer, kein Fehler** | RLS. PostgREST antwortet bei fehlendem Recht mit leerer Menge statt Fehler. Policies in `supabase/schema_live.sql` nachschlagen. |
| **Gar nichts passiert, kein Log** | `void supabase.rpc(…)` ohne `.then()`. Der Aufruf geht nie raus. |
| **`42501 permission denied`** auf `live_sessions` oder `user_whip_ingresses` | Neue Spalte ohne `GRANT SELECT (spalte)`. Ein Filter zählt als Lesezugriff. |
| **Reiter zeigt alten Stand** | Reiter bleiben aufgebaut. Braucht `useFocusEffect` + `refetch()`. |
| **Tippen wirkt tot** | Fehlendes `pointerEvents="box-none"` auf einer Anordnungs-Ebene im Live-Raum. |
| **Gastgeber landet beim Live-Gehen auf der Startseite** | `LiveRoomProvider` rendert nicht mehr durchgehend. |
| **Kasse antwortet nur „ging nicht"** | Status auslesen, nicht raten — `lib/functionError.ts`. 500 heißt: die Function warf, kein Stripe-Problem. |
| **`npm install` bricht ab** | `legacy-peer-deps` fehlt. Muss in `.npmrc` bleiben. |

Ausführlich mit Vorgeschichte: `HANDOFF.md` Abschnitt 3.

---

## 9. Was man nie tut

- **`supabase db push`**, solange am SQL-Editor gearbeitet wird
- **`USING(true)`** in einer RLS-Policy — Postgres verknüpft permissive Policies mit ODER, eine
  einzige hebelt die Frauen-Only-Grenze aus
- **Das Tabellen-Recht wiederherstellen** auf `live_sessions` / `user_whip_ingresses` — das gäbe
  den geheimen Stream-Schlüssel frei. Nur die einzelne Spalte freigeben.
- **Eine Migration als eingespielt markieren, die es nicht ist** — die Lücke wird damit für immer
  unsichtbar
- **Coins als Zahlmittel für echte Ware** — wäre E-Geld und lizenzpflichtig
- **Zufall über den Inhalt** (Mystery-Box, Glücksrad, Lose) — Spannung darf nur den *Preis*
  betreffen, nie das *Was*. Genau dafür steht Whatnot seit März 2026 in Schiedsverfahren.
- **Ratenzahlung mit Zinsen** (Klarna/BNPL) — siehe `HANDOFF.md` Abschnitt 11, steht derzeit noch
  in der Bezahlseite und gehört im Stripe-Dashboard abgeschaltet
- **Geheimnisse committen** — das Repo ist **öffentlich**. Auch keine Datei, die das Rechte-Modell
  der Live-Datenbank beschreibt.

---

## 10. Wo was liegt

| | |
|---|---|
| App | `apps/berkat/` |
| Website | `apps/berkat-web/` → `berkat-live.pages.dev` |
| Zustand, Fallen, Entscheidungen | [`HANDOFF.md`](HANDOFF.md) |
| Strategie, Psychologie, Phasenplan | [`WHATNOT-ANALYSE.md`](WHATNOT-ANALYSE.md) |
| Migrationen | `supabase/migrations/` (Repo-Wurzel) |
| Schema-Wahrheit | `supabase/SCHEMA.md` |
| Regeln fürs Hauptprojekt | `CLAUDE.md` (Repo-Wurzel) |

Website neu hochladen:

```bash
npx wrangler pages deploy /Users/zaurhatuev/vibes-app/apps/berkat-web --project-name berkat-live
```
