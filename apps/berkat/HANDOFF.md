# Berkat — Übergabe

**Stand: 18.08.2026** · Eigenständige Live-Auktions-App im Repo `vibes-app`, teilt sich das
Supabase-Backend mit Serlo.

Die Grundlage ist [`WHATNOT-ANALYSE.md`](WHATNOT-ANALYSE.md) — Strategie, Psychologie, Technik und
ein Phasenplan mit Abbruchkriterien. **Phase 1 ist gebaut, Phase 0 nie begonnen** — siehe unten.

> **Wer nicht lesen, sondern arbeiten will:** [`LEITFADEN.md`](LEITFADEN.md) — was nach einer
> Änderung zu tun ist, welche Befehle, welche Verdächtigen bei welchem Fehler, und was man nie tut.
> Dieses Dokument hier ist der Zustandsbericht; der Leitfaden ist die Bedienungsanleitung.

---

## 0. Wo du gerade stehst — 19.08.2026

Der Einstieg für einen frischen Chat. Die Abschnitte 1–17 sind die Begründungen; hier steht nur,
was gilt.

> **Wer neu einsteigt, liest 0 → 54 → 56.** Abschnitt 54 ist der Anschlusspunkt (er löste 46 ab,
> das wiederum 38 und 26), Abschnitt 56 ist die Prüfliste — alles Ungeprüfte an einer Stelle,
> nach Voraussetzung gruppiert. Danach bei Bedarf rückwärts.
>
> ⚠️ **Dieser Kopf war am 21.08.2026 an acht Stellen veraltet** — die Marktplatz-Migration galt
> als offen, obwohl sie seit dem 17.08. lief; Sentry als „noch nicht scharf", obwohl der Build
> seit dem 21.08. in TestFlight liegt; und drei Punkte als „ungeprüft", die die Testware am
> 18.08. belegt hatte. Der Rumpf war jedes Mal aktuell, nur der Kopf nicht. **Wer unten etwas
> abhakt, hakt es oben mit ab** — sonst liest der nächste Chat den falschen Zustand zuerst.
>
> Neu in dieser Runde: Startseite zeigt das Regal (27), Hochformat für alle Karten (28),
> Entdeckungs-Leiste (29), Suche und Sortierung im Regal (30), Testware per Skript (31),
> Filter mit Ort und Preis (32), Artikelseite geprüft (33) und entrümpelt (34), Impressum am
> richtigen Ort (35, 36), Verkaufen-Reiter als Übersicht (37).
>
> Grundlage sind drei neue Whatnot-Analysen (vierte bis sechste, alle in `WHATNOT-ANALYSE.md`).
> **Ihr wichtigstes Ergebnis ist entlastend:** Bei Feed-Karte, Profil und Artikelseite ist Berkat
> gleichauf oder reicher. Der Abstand lag an fehlendem Inhalt, nicht an Gestaltung — mit 38
> Testartikeln sieht dieselbe App aus wie ein anderes Produkt.
>
> ⚠️ **Was in der Datenbank liegt, sind Testdaten.** Es wird nichts verkauft. 36 davon stammen
> aus `scripts/seed-berkat-shop.mjs` und tragen `[testware]` in der Beschreibung; sie gehören
> fremden Profilen, damit Kaufknopf, Merken und Preisvorschlag überhaupt sichtbar werden.
> **Vor jeder echten Nutzung entfernen** (`--remove`).

### Gebaut und am echten Datenstand geprüft

| Bereich | Stand |
|---|---|
| Auktion, Gebote, Anti-Snipe, Zuschlag, Sammelkorb | ✅ |
| Kasse — öffnet **in der App**, bezahlen am Show-Ende | ✅ (Abschnitt 11) |
| Versand — Zonen-Pauschale pro Paket, bis in die Datenbank | ✅ `shipping_cents 490` belegt (14) |
| Sendeplan — Termine, wöchentliche Reihen, Erinnerungs-Push | ✅ bis auf den Sperrbildschirm (13); Zeitwahl seit 18.08. im Blatt (26) |
| **Termin-Bild** — Vorschaubild auf der „Demnächst"-Karte, Rückfall aufs letzte Show-Cover | ✅ am Gerät durchgespielt, Rückfall belegt (13) |
| Bürgen — Vertrauen mit Namen statt Sterne | ✅ (15) |
| **Dauerangebote** — kaufbar ohne laufende Show | ✅ Kauf gelaufen (17) |
| **Verkäufer-Suche** — findet auch, wer nicht sendet | ✅ (17, Nachtrag) |
| Fehlerüberwachung (Sentry) | ✅ **scharf seit dem TestFlight-Build vom 21.08.2026** (16). ⚠️ Ohne Quellkarten: `SENTRY_DISABLE_AUTO_UPLOAD=true`, solange es keinen Sentry-Zugang gibt (Abschnitt 3) |
| Meldungen — Glocke, Ziel je Typ | ✅ (17, Nachtrag) |
| **Fünf Reiter** — Kategorien und Aktivität dazu | ✅ am Gerät gesehen (18) |
| **Kategorien** — 12 Ober-, 61 Unterkategorien, Aufklappen | ✅ am Gerät, Rollup belegt (18) |
| **Einladungen** — Verkäufer-Bonus scharf, Käufer-Bonus **aus** | ✅ gebaut (18) |
| **Profil** — Reiter, Bewertungstexte, Banner, Teilen, Sperren | ✅ am Gerät gesehen (18) |
| **Verkäufer-Bereich** — Bestellungen und Regal als eigene Seiten | ✅ am Gerät gesehen (18) |
| **Erstnutzung** — „Deine ersten Schritte" | ✅ am Gerät bestätigt (18) |
| **Marktplatz** — Privat- und Gewerbeverkäufer, Shop-Seite, Orte | ✅ am Gerät durchgespielt (20, 21). ⚠️ Hier stand bis zum 21.08.2026 „eine Migration steht noch offen" — `20260816220000` lief am **17.08.**, siehe Abschnitt 20 |
| **Artikelseite** — jedes Angebot hat eine eigene Seite, eine Karte für alle Flächen | ✅ am Gerät durchgespielt, Beschreibung erstmals sichtbar (21) |

### Was ausdrücklich NICHT geprüft ist

- Der **Unterdeckungs-Hinweis** beim Versand (feuert nur, wenn jemand DE zahlt und in die CH liefert)
- **Push auf Android** — nie auf einem echten Gerät gesehen
- **Web-Push** — `web_push_subscriptions` ist leer, es hat nie jemand zugestimmt
- Die **gesenkte Bitrate** (540p) im echten Stream — das Bild kam am 16.08. an, gemessen wurde es
  nicht
- **Der Bewertungen-Reiter** — es existiert noch kein einziger Text, also war er nie befüllt zu sehen
- **Die Frauen-Only-Schranke bei Bewertungen** — Gegenprobe steht am Ende von `20260816160000`
- **Der Käufer-Bonus** — steht ab Werk auf `false`, also nie durchlaufen
- Drei Bildschirme vom 16.08., die noch niemand geöffnet hat: `/order/[id]`, `/shelf`, `/rewards`
- **Die Frauen-Only-Schranke im Bild-Rückfall** — braucht ein geprüftes Frauenkonto, das eine
  WOZ-Show mit Cover hat und keine öffentliche; Gegenprobe am Ende von `20260816190000`
- **Der neue Zuschnitt** (`CropShape`) — vier Aufrufstellen umgestellt, `tsc` und Export sind
  sauber, aber seither wurde kein Bild tatsächlich ausgewählt; besonders offen ist das **Banner**
  (`'wide'` lädt jetzt ohne Zuschnitt-Rahmen)
- **Die Kamera** — der Wähler fragt jetzt „aufnehmen oder auswählen", aber im Simulator gibt es
  keine Kamera; am echten Gerät nie ausprobiert
- ~~**Der Marktplatz-Weg von vorne**~~ — am 17.08.2026 durchgespielt, nachdem `20260816220000`
  eingespielt war: Angebot mit Zustand und Ort eingestellt, „Privatverkauf" stand an der Zeile,
  der Rechtsfolge-Kasten auf der Artikelseite (Abschnitt 21)
- ~~**„Nachricht" statt „Kaufen"**~~ — am 18.08.2026 belegt, nachdem die Testware fremde
  Angebote erzeugt hat (Abschnitt 33)
- ~~**Der Anbieter-Block auf der Artikelseite**~~ — beide Fassungen belegt: die private am
  17.08.2026, die **gewerbliche** am 18.08. (Abschnitt 33) und der Impressumsblock mit Inhalt
  am 19.08. (Abschnitt 35). Das Seed-Skript setzt `amir32` auf `kind = 'business'`
- **Der Kaufknopf auf der Artikelseite** — fremde Angebote gibt es seit der Testware; was fehlt,
  ist `berkat_sellers.checkout_enabled` bei einem Seed-Verkäufer. Das SQL liegt fertig in
  `supabase/_ops/kassen-freigabe-testware.sql` (Abschnitt 54, Punkt 3)

### Drei Blocker — keiner davon ist Code

1. **Kein Build im Store — der Eintrag selbst existiert.** ⚠️ **Richtigstellung 20.08.2026:** Hier
   stand „Berkat ist in keinem Store". Das war falsch. In App Store Connect liegt
   **„Berkat: Live-Auktionen", Status *iOS 1.0 In Vorbereitung zur Übermittlung*** — die App-ID
   `6802102343` in `eas.json` gehört ihr (Serlos ist `6760790424`, es ist also keine Kopie).
   ✅ **Stand 21.08.2026: Der Build liegt in TestFlight.** `1.0.0 (1)`, Upload abgeschlossen,
   Status „Bereit zur Übermittlung". Der Lizenzvertrag ist akzeptiert, Zertifikat und Profil
   stehen, Push ist auf der App-ID freigeschaltet (Abschnitt 54).

   **Was jetzt noch fehlt, ist die Beta App Review** — die externe Gruppe „Verkäufer" ist
   angelegt, eingereicht wird mit Testinformationen und Demo-Konto. Erst danach können die fünf
   Verkäufer die App installieren. Bis dahin ist alles Gebaute für genau eine Person erreichbar.

   ⚠️ **Ein TestFlight-Build läuft nach 90 Tagen ab**, Phase 0 dauert 56 — ein Build deckt sie,
   aber ohne viel Luft. Beim zweiten die `buildNumber` in der `app.json` von Hand hochzählen.
2. **Stripe-Zugang.** Konto ist `acct_1Tk85WDimgI7k5Md` („brandwerkx"), die Wiederherstellung läuft
   per Ausweis. Alles ist **Testbetrieb** (`cs_test_`, nie echtes Geld).
   ✅ **Ratenzahlung ist seit dem 19.08.2026 abgeschaltet** — Klarna, Billie und Scalapay, in Test-
   und Live-Modus getrennt (Riba, Analyse § B3). Der Weg dorthin, falls es sich wiederholt:
   Dashboard → Einstellungen → Zahlungen → Zahlungsmethoden; die Testmodus-Liste ist eine eigene
   Seite (`/test/` im Pfad). ⚠️ Stripe schaltet neue Methoden bei Länder-Freischaltungen von selbst
   zu — **vor dem Go-Live noch einmal durchsehen** und einen etwaigen Automatik-Schalter
   („von Stripe verwaltet") zuerst ausschalten, sonst kommen sie zurück.
3. **Phase 0 ist nie begonnen.** Fünf Verkäufer, acht Wochen, wöchentlich zwei Stunden. Das Werkzeug
   dafür steht seit dem 15.08. vollständig; die Menschen fehlen.

### Entscheidungen, die feststehen

- **Markt:** erst die tschetschenische Community, **danach russischsprachige Kaukasier**. Daraus
  folgt: **Russisch wird die zweite Sprache der App**, nicht Englisch (Strategie § 7.5).
- **Provision trägt bei dieser Größe nicht.** Break-even inkl. Arbeitszeit liegt bei ~8.000 €
  Umsatz im Monat; das Geld liegt in der eigenen Marge (Strategie § 6, § 7.1).
- **Bitrate gedeckelt** auf 540p, bis Berkat die Rechnung trägt (`lib/videoQuality.ts`).
- Die Regel „nichts Neues bauen, bis Phase 0 läuft" wurde am 15.08. **von Zaur aufgehoben**.

### Wo was steht

| Datei | Wofür |
|---|---|
| `HANDOFF.md` (hier) | Zustand, Entscheidungen, Fallen — Abschnitte 1–59; **56 ist die Prüfliste** |
| [`LEITFADEN.md`](LEITFADEN.md) | Befehle, „muss ich bauen?", Fehlersuche nach Symptom |
| [`WHATNOT-ANALYSE.md`](WHATNOT-ANALYSE.md) | Strategie, Psychologie, Phasenplan |
| [`STRATEGIE-VERKAEUFER-UND-GELD.md`](STRATEGIE-VERKAEUFER-UND-GELD.md) | Verkäufer gewinnen, Erlösquellen, Kostenrechnung mit geprüften Tarifen |

⚠️ **Nicht committet ist nur `deno.lock`** — die Datei war schon vor dem 15.08. geändert und gehört
nicht zu dieser Arbeit.

**Git, Stand 16.08.2026 abends:** Branch `berkat` ist auf `origin` gepusht und hat jetzt ein
Upstream (hatte vorher keins — deshalb schlug der erste `git push` fehl; künftig genügt `git push`).
Der Push vom 16.08. trug 73 Dateien nach, weil der Zweig zwanzig Commits zurücklag.

---

## 1. Was Berkat ist

Ein **Live-Shopping-Marktplatz nach Whatnot-Vorbild** für die tschetschenische Diaspora, gedacht
als Startzelle für die muslimische Diaspora im deutschsprachigen Raum.

Der Kern ist nicht der Katalog, sondern das **Format**: eine Person sendet live, legt Artikel auf,
und der Preis entsteht in einer Auktion vor Publikum. Verkauft wird der Abend, nicht das Produkt.

Was Berkat bewusst anders macht als Whatnot:

- **Kein Zufall über den Inhalt.** Keine Mystery-Box, kein Glücksrad, keine kaufbaren Lose.
  Spannung entsteht über den *Preis* (Auktion), nie über das *Was*. Genau diese Linie ist der
  Grund, warum Whatnot seit März 2026 in Schiedsverfahren steckt (*Lesko v. Whatnot*, Vorwurf
  unerlaubte Lotterie nach California Penal Code 319).
- **Sammelkorb**: Alles, was man bei einem Verkäufer gewinnt, sammelt sich 24 h in *einem* Paket.
  Ohne das ist eine 5-€-Auktion wirtschaftlich unmöglich, weil der Versand teurer wäre als die Ware.
- **Frauen-Only** (aus Serlo geerbt): geprüfte Räume, in denen Verkäuferinnen ohne fremdes
  Publikum senden können. Das ist der kulturelle Kernvorteil, den Whatnot strukturell nicht hat.

---

## 2. Wo alles liegt

| | |
|---|---|
| App | `apps/berkat/` — eigenständige Expo-App, eigene `node_modules`, eigener Store-Eintrag |
| Ausgangsanalyse | [`WHATNOT-ANALYSE.md`](WHATNOT-ANALYSE.md) — Grundstrategie, Psychologie, Technik, Machbarkeit und der Phasenplan, auf den dieses Dokument sich bezieht |
| Arbeitsleitfaden | [`LEITFADEN.md`](LEITFADEN.md) — Befehle, Entscheidungsbaum „muss ich bauen?", Fehlersuche, harte Linien |
| Website | `apps/berkat-web/` — vier statische Seiten, **live** unter `berkat-live.pages.dev` |
| Bundle-IDs | iOS `com.berkat.app` · Android `app.berkat.market` |
| EAS-Projekt | `@zaurhat/berkat` (`fb4e0381-264d-4cfd-8c3c-691987346915`) |
| Backend | dieselbe Supabase-Instanz wie Serlo (`llymwqfgujwkoxzqxrlm`) |
| Migrationen | **35 Berkat-eigene, alle eingespielt**; im Tracking 278 ohne Lücke (21.08.2026) — Abschnitt 5 |
| Git | Branch `berkat`, Basis `origin/main` (nicht `origin/master`) — gepusht. Für den Anmelde-Stolperstein siehe Abschnitt 7 |

### Starten

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npm start
```

Öffnet Metro im Dev-Client-Modus. Die App auf dem iPhone ist ein **eigener Dev-Build**, kein
Expo Go — LiveKit hat native Module.

Nach Paket-Änderungen immer mit geleertem Zwischenspeicher starten, sonst löst Metro alte Pfade auf:

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npx expo start --dev-client --clear
```

### Neu bauen (nur bei neuen nativen Abhängigkeiten)

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && eas build --profile development --platform ios
```

Ad-hoc-Build — installierbar nur auf registrierten Geräten. Zweites Testgerät hinzufügen:
`eas device:create`, danach neu bauen.

### Prüfen vor jeder Übergabe

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npx tsc --noEmit
```

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npx expo export --platform ios --output-dir /tmp/berkat-check --clear
```

Der Export ist der ehrlichere Test: Er baut das komplette Bundle und findet Auflösungsfehler, die
`tsc` nicht sieht. Aktueller Stand: **3702 Module, fehlerfrei** (21.08.2026).

### Neu laden — NICHT ⌘R

`⌘R` startet im Simulator eine **Bildschirmaufnahme**, seit Apple den Kurzbefehl
belegt hat. Zum Neuladen des Bündels:

- **`r` im Metro-Terminal** — der zuverlässige Weg
- `⌃⌘Z` im Simulator öffnet das Entwickler-Menü, dort „Reload"

### Im Simulator laufen lassen

Berkat läuft als vollwertiger Build im iOS-Simulator — damit gibt es ein zweites Gerät, ohne eins
zu besitzen. Erstmalig bauen (dauert, WebRTC wird mitkompiliert):

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npx expo run:ios
```

Danach genügt Metro plus App-Start. Zwei Fallen dabei: Der Simulator hat **keine Kamera** (das Bild
bleibt schwarz, die Vorschau meldet einen Fehler — beides erwartet), und ihm fehlt die
**Emoji-Schrift**, weshalb Emoji als leere Kästchen erscheinen. Auf dem Gerät ist beides in Ordnung.

---

## 3. Fallen, die schon zugeschlagen haben

Diese Liste ist der wertvollste Teil des Dokuments.

### `supabase db push` war verboten — der Grund ist seit 14.08.2026 weg

**Historie, weil sie sich wiederholen kann:** `supabase migration list` meldete **61 Migrationen als
nicht eingespielt**, beginnend bei `20260614190000`. Das war eine **Tracking-Lücke, kein fehlendes
Schema** — gegen die Live-DB belegt (Abschnitt 7). Das Tracking blieb bei `buy_product_wallet_lock`
(`20260613120000`) stehen; alles danach wurde per SQL-Editor eingespielt. Ein `db push` hätte alle
61 erneut gefahren und bei der ersten nicht-idempotenten Anweisung mittendrin abgebrochen.

**Erledigt am 14.08.2026.** Beide `migration repair`-Läufe sind durch, `supabase migration list`
zeigt **232 Migrationen mit Eintrag in beiden Spalten, keine Lücke**. Ein `db push` würde jetzt
nichts mehr tun, weil nichts mehr offen ist.

Der Weg für neue Migrationen bleibt trotzdem derselbe, solange am SQL-Editor gearbeitet wird:

1. SQL im Supabase-SQL-Editor ausführen
2. `supabase migration repair --status applied <version>`

Wer stattdessen wieder auf `db push` umstellen will: Das geht ab jetzt sauber, aber **erst prüfen,
ob die Datei wirklich noch nicht gelaufen ist** — nach zwei Monaten Editor-Betrieb ist die
Gewohnheit „ich mach das schnell im Browser" die eigentliche Gefahr, nicht das Werkzeug.

### Eine neue Spalte auf `live_sessions` ist für die Apps unsichtbar

Am 14.08.2026 zugeschlagen, direkt nach dem Einspielen der App-Trennung: Die frisch angelegte
Spalte `app` war für `anon` und `authenticated` **nicht lesbar**. Genau der Aufruf, den der neue
Code macht, antwortete mit `42501 permission denied for table live_sessions` — während derselbe
Aufruf ohne den Filter sauber zurückkam.

Ein Filter zählt dabei als Lesezugriff: Postgres verlangt SELECT auf jede Spalte in der
WHERE-Bedingung, auch wenn sie im Ergebnis gar nicht vorkommt. Ohne den Nachtrag wäre die
Live-Liste in **allen drei** Oberflächen leer geblieben.

Ursache ist eine Nebenwirkung, die man ihr nicht ansieht. `20260425170000` nahm den OBS-Stream-
Schlüssel gezielt aus der Sicht der Clients:

```sql
REVOKE SELECT (ingress_stream_key) ON public.live_sessions FROM authenticated, anon;
```

Das war richtig. Aber Postgres kann ein Recht nicht spaltenweise abziehen — es löst das
Tabellen-Recht auf und schreibt Einzelrechte für jede **damals vorhandene** Spalte. Ab da ist die
Liste fest, und jede später hinzugefügte Spalte steht in keiner dieser Zusagen.

Betroffen sind **drei** Tabellen: `live_sessions`, `user_whip_ingresses` (`stream_key`,
`20260426000000`) und seit dem 14.08.2026 auch **`profiles`** — dort nahm
`20260814240000` den `push_token` aus der Sicht der Clients und schrieb dafür eine
ausdrückliche Liste von 41 Spalten. Am 16.08. beim Bannerbild wieder aufgeschlagen:
`banner_url` brauchte ein eigenes `GRANT`, sonst wäre **jede** Profil-Abfrage gescheitert,
die die Spalte auch nur erwähnt — nicht nur die Spalte selbst.

Wer einer der drei eine Spalte hinzufügt, hängt an dieselbe Migration:

```sql
GRANT SELECT (<spalte>) ON <tabelle> TO anon, authenticated;
```

**Nie** das Tabellen-Recht wiederherstellen — das gäbe die geheime Spalte mit frei. Steht auch als
Regel 11 in der `CLAUDE.md` des Hauptprojekts.

### Geerbte Serlo-Tabellen sind enger, als sie aussehen

Berkat greift auf Tabellen zu, die Serlo gehören (Abschnitt 4, „Kein zweiter Weg"). Zwei davon
haben eine RLS, die genau das verbietet, was man naheliegend tun würde — beide sind am 14.08.2026
beim Bau des Verkäufer-Sheets aufgefallen, beide **lautlos**:

| Tabelle | Was NICHT geht | Der Weg |
|---|---|---|
| `order_reviews` | Bewertungen eines Verkäufers lesen — die Policy lässt nur Bewerter und Bewerteten durch, ein Zuschauer bekommt **null Zeilen** | `get_seller_rating` (Aggregat) |
| `messages` | `update({ read: true })` als Empfänger — `msg_update` erlaubt nur dem **Absender** zu ändern, der Aufruf trifft null Zeilen | RPC `mark_messages_read` |

Das Muster dahinter: Die Abfrage ist syntaktisch richtig, das Recht fehlt, und PostgREST antwortet
mit einer **leeren Menge statt einem Fehler**. Man sieht „keine Bewertungen" und „nichts als gelesen
markiert" — und sucht den Fehler im Client.

**Vor jedem neuen Zugriff auf eine geerbte Tabelle** deshalb in `supabase/schema_live.sql` die
Policies nachschlagen (`grep -n "ON \"public\".\"<tabelle>\"" | grep POLICY`). Steht dort nur eine
Lese-Policy für die Beteiligten, braucht es eine Funktion — und wenn sie öffentlich sein soll, eine,
die **nur das Aggregat** herausgibt. Die Policy aufzuweichen ist der falsche Reflex: Bei
`order_reviews` hätte ein `USING(true)` jeden Kommentar und jede Käufer-Verkäufer-Beziehung
freigegeben.

### Eine SECURITY-DEFINER-Funktion geht an der Frauen-Only-Grenze vorbei

Am 16.08.2026 beim Termin-Bild eingebaut und im Audit noch am selben Abend gefunden — die Zeile
war nie draußen, aber der Ablauf ist lehrreich genug für diese Liste.

Der Bild-Rückfall (`schedule_berkat_show`) sucht das Cover der letzten eigenen Show:

```sql
SELECT s.thumbnail_url FROM live_sessions s
 WHERE s.host_id = auth.uid() AND s.app = 'berkat' …
```

Richtig aussehend, und trotzdem ein Leck. `live_sessions` trägt die Policy
`live_sessions_select_with_women_only` — eine Frauen-Only-Show ist für die Öffentlichkeit
unsichtbar, ihr Cover eingeschlossen. **In einer `SECURITY DEFINER`-Funktion gilt die Policy
nicht:** Sie läuft als Eigentümer und sieht alles. Das Ergebnis landete in `scheduled_lives` —
und die liest jeder ohne Konto, denn der „Demnächst"-Streifen ist öffentlich.

Der Ablauf, der gereicht hätte: Verkäuferin sendet Frauen-Only mit Cover → kündigt danach einen
normalen Abend an → wählt kein Bild → ihr Frauen-Only-Cover steht auf der öffentlichen Startseite.
**Sie hat dem nie zugestimmt, sie hat nur „kein Bild" gewählt.**

Die Regel daraus: **Wer in einer `SECURITY DEFINER`-Funktion aus einer geschützten Tabelle liest
und das Ergebnis in eine offene schreibt, muss die Schranke von Hand mitschreiben.** RLS ist dort
kein Netz. Behoben mit `20260816190000` — eine Zeile `AND s.women_only = false`.

Das *selbst gewählte* Bild bleibt frei: Wer sein WOZ-Cover bewusst auf einen öffentlichen Termin
legen will, darf das. Der Unterschied ist die Absicht — ein Rückfall trifft eine Entscheidung, die
niemand getroffen hat.

### Serlo zieht jede neue Spalte von `scheduled_lives` automatisch mit

Alle vier Serlo-Lesepfade selektieren `*`, nicht eine Spaltenliste:
`apps/web/lib/data/live-host.ts:307` und `:328`, `lib/useScheduledLives.ts:130` und `:284`.

Die Trennung der beiden Apps läuft über `app` in der **WHERE-Bedingung**, nicht über die
Spaltenauswahl. Heute ist das folgenlos — Serlo rendert `cover_url` nirgends, und ein unbekanntes
Feld im Ergebnisobjekt stört keinen Client. Wer hier aber je eine Spalte anlegt, die etwas
Vertrauliches trägt, legt sie damit in Serlos Antwort, und zwar auf ausgelieferten Versionen.

Beim Schreiben der Migration stand zuerst das Gegenteil im Kommentar („Serlos Lesepfade nennen sie
nicht"). Der Satz war falsch und hätte einen späteren Leser zu „hier kann ich frei ändern"
verleitet — deshalb steht er jetzt richtig in `20260816180000`.

### `aspect` beim Bild-Wähler wirkt nur auf Android

`expo-image-picker` nimmt `aspect: [x, y]` entgegen, aber **auf iOS ist der Zuschnitt-Rahmen bei
`allowsEditing` immer quadratisch**. Der Wert wird dort schlicht ignoriert, ohne Warnung.

Das hatte sich bis zum 16.08.2026 zu einem stillen Dreifach-Fehler ausgewachsen: `pickAndUpload`
leitete die Zuschnitt-Form aus dem **Speicherort** ab (`'cover'` → `thumbnails/` → 3:4 hochkant).
Unter `thumbnails/` liegen aber drei völlig verschiedene Flächen:

| Fläche | wird gezeichnet | wurde zugeschnitten |
|---|---|---|
| Show-Cover | quadratisch | 3:4 hochkant (Android) / Quadrat (iOS) |
| Termin-Bild | quadratisch | dito |
| Profil-Banner | Höhe 116 auf voller Breite, rund **3:1** | dito |

Der hochkant-Zuschnitt passte zu **keiner einzigen**. Auf Android verlor ein Show-Cover ein Viertel
der Höhe, das Banner noch mehr; auf iOS bekam das Banner ein Quadrat, aus dem ein breiter Streifen
geschnitten wurde. Niemandem fiel es auf, weil der Verkäufer den Zuschnitt-Rahmen sieht und das
Ergebnis erst später woanders.

Behoben durch Trennung: `ImageKind` sagt **wo** es liegt, `CropShape` sagt **wie** zugeschnitten
wird, und `shape` ist ein Pflicht-Parameter ohne Voreinstellung — jede Aufrufstelle weiß, in
welcher Form sie zeichnet, und nur sie weiß es. Für breite Flächen gibt es bewusst **gar keinen**
Zuschnitt-Rahmen (`allowsEditing: false`), weil iOS ihn nicht in der richtigen Form anbieten kann;
dort wählt `contentFit="cover"` den Ausschnitt beim Zeichnen. Gleiches Ergebnis auf beiden
Plattformen.

**Wer eine neue Bild-Fläche baut, gibt die Form der Anzeige an — nicht die des Ordners.**

### Eine Vorgabe anzeigen und nicht speichern

Am 17.08.2026 im eigenen Bau gefunden, bevor jemand darüber stolperte. Der Composer zeigt
**„Du verkaufst als: Privatperson"** als Vorgabe, mit der Rechtsfolge daneben. Der Knopf ruft die
Erklärungs-RPC aber nur, **wenn sich der Typ ändert** — wer die Vorgabe stehen lässt, also der
Normalfall, erzeugt keine Zeile. Das Angebot trug danach `seller_kind = NULL`, und die
Anbieterkennzeichnung fehlte.

Die Oberfläche zeigte damit eine Angabe, die die Datenbank nicht hatte — ausgerechnet die, die
Art. 246d § 1 EGBGB an jedem Angebot verlangt.

**Die Regel daraus: Eine sichtbare Vorgabe ist eine Aussage.** Wer sie anzeigt, muss sie beim
Abschicken auch festhalten; sonst weichen Bildschirm und Datenbank an genau der Stelle
voneinander ab, an der es zählt. Behoben serverseitig (`20260816220000`) statt im Client, weil
sonst zwei Rufe und ein Wettlauf daraus würden.

### Ein Feld, das geschrieben und nie gelesen wird

Der Gegenfall zum vorigen, gefunden am 17.08.2026 — und er hielt zwei Tage.

`20260816210000` legte `description` an. Der Composer bekam ein Feld dafür, die RPC einen
Parameter, `useStanding` reichte ihn durch, der Zeilentyp trug ihn, die Abfrage holte ihn.
**Kein einziger Bildschirm zeigte ihn an.** Ein Verkäufer tippte drei Sätze über den Zustand
seiner Ware, und niemand konnte sie je sehen. Bei einem Dauerangebot ist das nicht irgendein
Feld: In einer Show erzählt der Verkäufer, hier ist der getippte Text die **einzige**
Beschreibung, die es je geben wird.

Warum es niemandem auffiel: Die Kette war an jedem einzelnen Glied vollständig. Ein `grep` nach
`description` liefert acht Treffer und sieht gesund aus — sieben davon sind Eingang, Durchreiche
und Typ, und genau einer fehlt. Dasselbe gilt für `sellerKindNote()`: eine fertige, richtig
formulierte Funktion in `useBerkatSeller.ts`, **ohne einen einzigen Aufrufer**.

Die Probe, die das findet, ist eine andere als „steht die Spalte im Typ":

> **Zeig mir den Bildschirm, auf dem dieser Wert steht.**

Gibt es ihn nicht, ist das Feld tot — egal wie sauber alles davor aussieht. Für jede neue Spalte
gehört diese Frage in dieselbe Migration, in der sie angelegt wird.

### `create-checkout-session`: `stripeKey` steht nicht dort, wo man ihn vermutet

Am 15.08.2026 gekostet: Der Trinkgeld-Knopf endete in „Die Kasse ließ sich nicht öffnen", die
Funktion antwortete mit **HTTP 500** — sie warf also, statt etwas abzulehnen.

`stripeKey` ist in der Datei **nicht auf Modulebene** deklariert, sondern **zweimal lokal** mit
`const`: einmal im Bestellzweig, einmal im Coin-Zweig ganz unten. Ein neuer Zweig dazwischen greift
damit auf die *spätere* Deklaration zu, die zu dem Zeitpunkt noch in der temporalen Todeszone
liegt → `ReferenceError`, unbehandelt, 500.

**TypeScript sieht das nicht.** Die Variable ist im Gültigkeitsbereich, sie ist nur noch nicht
initialisiert. Wer dieser Funktion einen vierten Zweig hinzufügt, holt sich den Schlüssel deshalb
selbst:

```ts
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeKey) return json({ error: 'server_misconfigured' }, 500);
```

### Eine Fehlermeldung für alles ist keine Fehlermeldung

Der eigentliche Grund, warum die Suche oben so lange dauerte: Der Client zeigte bei **jedem**
Fehlschlag denselben Satz — fehlender Datensatz, falscher Besitzer, Stripe-Ablehnung, Absturz. Die
ersten drei Prüfungen liefen deshalb in die falsche Richtung (Stripe-Parameter, Secrets,
Datenbankrechte), obwohl der HTTP-Status die Antwort sofort gehabt hätte: **500, nicht 502** — also
kein Stripe-Problem.

`supabase.functions.invoke` wirft bei jedem Nicht-2xx denselben nichtssagenden Fehler; die
Begründung steckt im Rumpf, den supabase-js an `error.context` hängt (ein `Response`). Je nach
Fassung ist der Rumpf schon gelesen, dann wirft `.json()` — **den Status zuerst sichern**, der bleibt
immer lesbar. Muster in `lib/useTip.ts`, `functionErrorCode()`.

### Fast Refresh verträgt keine neuen Hooks

Wer einer laufenden Komponente einen Hook hinzufügt, bekommt einen **weißen Bildschirm** — React
kann die geänderte Hook-Reihenfolge nicht auf den bestehenden Zustand abbilden. Das ist kein Fehler
im Code: App komplett schließen und neu öffnen, dann läuft es. Erst danach lohnt die Fehlersuche.

### LiveKit läuft nicht in Expo Go

Native Module. `lib/livekit.ts` fängt das ab und setzt `liveKitAvailable = false`, statt die App
abstürzen zu lassen. Alle LiveKit-Komponenten werden **bedingt per `require`** geladen, nie
statisch importiert — sonst stirbt die App schon beim Laden der Datei.

### Hermes kennt `DOMException` nicht

`livekit-client` stammt aus der Browser-Welt und wirft damit — **beim Laden des Moduls**, lange
bevor Video im Spiel ist. Fehlerbild auf dem Gerät: `Property 'DOMException' doesn't exist`.

`lib/livekit.ts` registriert vorher einen Ersatz (schlanke `Error`-Ableitung). Der Block muss
**vor** dem `require` von LiveKit stehen.

### LiveKit-Hooks brauchen den Raum-Kontext

`useConnectionState`, `useLocalParticipant`, `useTracks` werfen außerhalb von `LiveKitRoom`
(„No room provided"). Deshalb gibt es `useStageReady()` — jede Komponente mit diesen Hooks muss
daran gebunden sein. Ausnahme: `GoLiveGate` arbeitet bewusst **ohne** Raum (lokale Kamera-Vorschau
ohne Token, damit vor dem Live-Gehen nichts nach draußen geht).

### `live_comments.user_id` ist NOT NULL

Ohne mitgeschickte Konto-ID lehnt Postgres jede Nachricht ab. Es gibt keinen Default und keinen
Trigger. Kostete eine Stunde Suche.

### `livePlayer.open()` muss idempotent sein

Der Raum meldet die Show bei jedem Datenabruf neu an (alle 15 s). Ohne Idempotenz über die Show-ID
würde `connected` im selben Takt zurückgesetzt — der Gastgeber flöge alle 15 Sekunden aus seiner
eigenen Sendung.

### `void supabase.rpc(…)` schickt gar nichts ab

`supabase.rpc()` und `supabase.from()` liefern **keinen** Versprechen-Wert, sondern einen faulen
Erzeuger, der die Anfrage erst beim Abwarten losschickt. Ein blankes `void supabase.rpc(…)` baut
ihn nur und wirft ihn weg — **es geht nie etwas raus, und zwar völlig lautlos**. Kein Fehler, kein
Log, der Code sieht richtig aus.

Am 14.08. im Simulator gefunden: Die **Zuschauerzahl hat dadurch nie funktioniert**
(`join_live_session` / `leave_live_session`), und der Herz-Zähler zählte nichts. Beweis: Sieben
Herzen → `like_count` blieb 0; nach dem Anhängen von `.then()` zählten vier Herzen sauber 1 → 4.

Regel: Jeder „abschicken und vergessen"-Ruf braucht ein `.then()`, und dort gehört gleich eine
Fehlerausgabe hinein:

```ts
void supabase.rpc('…', { … }).then(({ error }) => {
  if (error && __DEV__) console.warn('[Berkat] … :', error.message);
});
```

`supabase.auth.*` und `supabase.removeChannel()` sind davon **nicht** betroffen — die geben echte
Versprechen zurück. Serlo ist nicht betroffen, dort gibt es das Muster nicht.

### Der Video-Anbieter darf nie verschwinden

`LiveRoomProvider` rendert `LiveKitRoom` **immer**, auch ohne Verbindung. Wer daraus wieder ein
`if (…) return <>{children}</>` macht, bringt den Fehler zurück, der am 14.08. gefunden wurde: Beim
Umschalten wechselt der Elterntyp über dem gesamten Navigations-Baum, React baut den Teilbaum
komplett ab und neu auf, der Navigations-Stapel wird zurückgesetzt — und der Gastgeber landet im
Moment des Live-Gehens auf der **Startseite** statt in seiner eigenen Sendung.

Möglich ist das Dauer-Rendern, weil `serverUrl` und `token` ausdrücklich `undefined` annehmen und
`connect` die Verbindung steuert. `audio`/`video` hängen an `active`, sonst greift LiveKit nach der
Kamera, während die Vorschau vor dem Live-Gehen sie noch hält.

### Eine Ebene ohne `box-none` macht das halbe Bild tot

Tippen aufs Video schickt ein Herz. Die Fläche dafür liegt **ganz unten** im Stapel, direkt über dem
Video — nur so bedient ein Tipp auf einen Knopf weiterhin den Knopf. Damit sie überhaupt etwas
abbekommt, tragen alle reinen Anordnungs-Ebenen darüber `pointerEvents="box-none"`: die Spalte, die
Kopfzeile, die Mitte.

**Wer im Live-Raum eine neue Ebene einzieht und das vergisst, schaltet das Tippen in ihrem Bereich
stumm** — ohne Fehlermeldung, ohne Absturz. Es passiert einfach nichts mehr.

Umgekehrt gilt: Ein Berührungs-Erkenner **über** einem Eingabefeld nimmt diesem den Fokus, und die
Tastatur geht nicht mehr auf. Deshalb hat der Kommentar-Stapel eine eigene kleine Tippfläche und
nicht die ganze Chat-Spalte.

### Reiter-Bildschirme bleiben aufgebaut — sie laden nicht von selbst nach

Expo Router hält die Reiter dauerhaft im Speicher. Wer „Konto" einmal geöffnet hat, sieht beim
Zurückwechseln **denselben Stand von vorhin**: kein Aufbauen, kein Fokuswechsel der App, also kein
Nachladen. Am 14.08. stand deshalb „Noch nichts gewonnen" da, während im Live-Raum schon
„2 Artikel · 1 Paket" angezeigt wurde — die Pakete waren da, die Abfrage war alt. Damit war der
Bezahl-Schritt schlicht nicht erreichbar.

Abfragen auf einem Reiter, die auf Ereignisse von außen reagieren müssen, brauchen deshalb
`useFocusEffect` aus `expo-router` plus `refetch()` — oder einen Takt. `refetchOnWindowFocus`
allein genügt **nicht**: Das feuert nur beim Wechsel aus dem Hintergrund der ganzen App, nicht
beim Reiter-Wechsel.

**Die dritte Ausprägung, gefunden am 16.08.2026: ein Bildschirm, der gar nicht verlassen wird.**
Beim Reiter und beim Stapel heilt wenigstens der nächste Aufbau. Im Live-Raum sitzt jemand eine
Stunde am Stück — dort feuert **überhaupt kein** Auslöser: kein Aufbau, kein Fokuswechsel, kein
Reiter-Wechsel. `useCart` hatte weder Takt noch Invalidierung, und deshalb blieb die
Sammelkorb-Leiste stumm, während der Käufer drei Artikel gewann (Abschnitt 19).

Merksatz für alle drei: **Frag nicht „lädt es beim Öffnen?", sondern „was genau löst das
Nachladen aus, während der Nutzer schon dasitzt?"** Gibt es darauf keine Antwort, ist die Antwort
„nichts".

### `refreshing={isRefetching}` lässt Listen hängen aussehen

Der Aktualisierungs-Kreisel springt sonst bei jedem Hintergrund-Abruf an. Für Ziehen-zum-Aktualisieren
immer einen eigenen `pulling`-Zustand nehmen.

### Berkat borgte sich Babel bei Serlo — und merkte es erst im Cloud-Build

Am 21.08.2026 beim ersten `production`-Build. EAS meldete zweimal dasselbe:

```
Unknown error. See logs of the Bundle JavaScript build phase for more information.
```

Die echte Ursache stand im Log und nirgends sonst:

```
Cannot find module 'babel-preset-expo'
```

`babel.config.js` verlangt das Preset **beim bloßen Namen**, und es steht in Berkats
`package.json` nicht drin. Lokal fällt das nicht auf, weil Node die Ordner **nach oben**
durchsucht und eine Ebene höher fündig wird:

```
require.resolve('babel-preset-expo')
  →  /Users/zaurhatuev/vibes-app/node_modules/babel-preset-expo   ← SERLOS node_modules
```

Auf EAS gibt es die nicht — dort wird `npm install` nur in `apps/berkat` ausgeführt. Babel läuft
den Baum hoch, findet nichts, und der Bundler stirbt beim ersten Modul.

⚠️ **Die Isolation galt für Metro, nicht für Babel.** `metro.config.js` trägt seit jeher den
Kommentar *„Bewusst eigenständig: Berkat hat eigene node_modules und schaut NICHT ins Repo-Root."*
Das stimmt — für Metro. **Babel benutzt gewöhnliche Node-Auflösung und kennt diese Absicht nicht.**
Zwei Werkzeuge im selben Build, zwei Auflösungswege, und nur einer war abgesichert.

Dieselbe Familie wie der Vercel-Ausfall von `apps/web`: lokal grün, in der Cloud tot, weil eine
Abhängigkeit nur in der Wurzel lag. **Für jede Unter-App im Monorepo gilt: Was eine
Konfigurationsdatei beim Namen verlangt, muss in ihrer eigenen `package.json` stehen** — auch
wenn es „sowieso über `expo` mitkommt". Es kommt mit, aber **verschachtelt** unter
`node_modules/expo/node_modules/`, und dorthin schaut die Auflösung vom Projektwurzel-Ordner aus
nicht.

Behoben mit einer Zeile in `apps/berkat/package.json`:

```json
"babel-preset-expo": "~54.0.12"
```

Die Probe, die das findet, **bevor** ein Build zwei Minuten kostet:

```bash
node -e "const r=require.resolve('babel-preset-expo',{paths:[process.cwd()]});
console.log(r.includes('/apps/berkat/node_modules/') ? 'eigen' : 'AUS DER WURZEL')"
```

Am 21.08. wurden damit **alle** Build-Zeit-Abhängigkeiten durchgeprüft (acht `app.json`-Plugins
plus Babel, Metro, Expo): Bis auf dieses eine liegt alles in `apps/berkat`. ⚠️ Ein zweites Leck
bleibt bekannt und harmlos: `@expo/metro-config` löst lokal ebenfalls aus der Wurzel auf. Es ist
folgenlos, weil `metro.config.js` `expo/metro-config` verlangt (den öffentlichen Eingang), und
der findet die verschachtelte Fassung — im EAS-Log nachweisbar. Wer es je **beim direkten Namen**
verlangt, muss es deklarieren.

### Sentry reißt den Store-Build ab — in einer Phase, die nach JavaScript aussieht

Am 21.08.2026 beim allerersten `production`-Build zugeschlagen. Meldung:

```
🍏 iOS build failed:
Unknown error. See logs of the Bundle JavaScript build phase for more information.
```

**Die Meldung zeigt in die falsche Richtung.** Am JavaScript lag es nicht — derselbe Bundler läuft
lokal fehlerfrei durch:

```bash
NODE_ENV=production npx expo export:embed --platform ios --dev false \
  --bundle-output /tmp/main.jsbundle --assets-dest /tmp/assets
```

3697 Module, keine Fehler. Der erste Hinweis stand als Warnung mitten im Ausgabestrom:
`[@sentry/react-native/expo] Missing config for organization, project.`

⚠️ **Nachtrag 21.08.2026: Das war NICHT die Ursache des ersten Fehlschlags.** Die echte stand
einen Absatz höher (`babel-preset-expo`), und die Sentry-Zeile im Log war bloß eine Warnung. Ich
hatte sie für den Befund gehalten, weil sie zur Fehlermeldung passte — **eine Warnung, die zur
Vermutung passt, ist noch kein Beweis.** Der Fehler stand die ganze Zeit im Log; ich hatte ihn nur
nicht geholt (Rezept unten).

Der Sentry-Befund bleibt trotzdem gültig und die Änderung notwendig: Sie hätte den Build in der
**nächsten** Phase gerissen, sobald das Bündeln durchläuft.

Ursache: Das Sentry-Plugin **schreibt die Xcode-Phase um**, die den Bundler ausführt
(`plugin/build/withSentryIOS.js:42`, greift sich `Bundle React Native code and images`, und `:72`
ersetzt deren Shell-Skript). Fehlen Organisation, Projekt und Auth-Token, kommt `sentry-cli` nicht
durch — und `scripts/sentry-xcode.sh:58` setzt dann **`exitCode=1`**. Der Build stirbt am
Quellkarten-Upload, gemeldet als Bündelungsfehler.

**Der Zeitstempel war der schnellste Hinweis:** gestartet 00:09:31, gescheitert 00:10:40 — **69
Sekunden**. Ein Build, der WebRTC kompiliert, braucht zwanzig Minuten. Was in einer Minute stirbt,
ist nie am Kompilieren gescheitert. `eas build:view <id>` zeigt beide Zeiten.

**Warum der Vergleich mit Serlo zuerst in die Irre führte:** Serlo baut aus demselben Stack
erfolgreich und hat dieselbe DSN in der `eas.json` — aber **`@sentry/react-native` steht nicht in
seiner `plugins`-Liste**. Berkat ist die einzige der beiden Apps mit dem Config-Plugin. Zwei Apps
zu vergleichen trägt nur so weit, wie ihre Konfiguration wirklich gleich ist; hier war die
entscheidende Zeile die, die fehlte.

Behoben mit einer Zeile in `eas.json`, in `preview` **und** `production`:

```json
"SENTRY_DISABLE_AUTO_UPLOAD": "true"
```

`sentry-xcode.sh:64` überspringt damit den Upload und ruft den normalen Bundler
(`$REACT_NATIVE_XCODE`) auf. **Was dabei NICHT verlorengeht:** die Fehlerüberwachung selbst. Das
native Modul wird über die `package.json` verlinkt, `Sentry.init()` läuft, und der eigentliche Wert
nach Abschnitt 16 — die **abgefangenen** Fehler aus `reportProblem()` mit Status, Code und
Begründung — kommt unverändert an. Verloren geht nur die Entminifizierung der Stapel: Ohne
Quellkarten stehen dort verkürzte Namen.

⚠️ **Zurückdrehen, sobald es einen Sentry-Zugang gibt** (Abschnitt 16 nennt genau den als fehlend).
Dann `organization` und `project` in die Plugin-Konfiguration, `SENTRY_AUTH_TOKEN` als
EAS-Geheimnis (`eas secret:create`), und diese Zeile wieder raus. Ein Auth-Token gehört **nie** in
die `eas.json` — das Repo ist öffentlich.

### EAS-Build-Logs holen, statt aus der Fehlermeldung zu raten

Die Meldung, die die CLI ausspuckt, ist eine Phasen-Überschrift, **kein Fehler**. Am 21.08.2026
hat mich das zwei Fehlversuche gekostet: „See logs of the Bundle JavaScript build phase" klang nach
JavaScript, war aber ein fehlendes Babel-Preset. Der echte Text lag die ganze Zeit im Log.

Der Weg dorthin, ohne Browser und ohne Anmeldung:

```bash
npx eas build:view <build-id> --json 2>/dev/null \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).logFiles[0]))" \
  > /tmp/logurl.txt
curl -s "$(cat /tmp/logurl.txt)" -o /tmp/build.log
node -e "require('fs').writeFileSync('/tmp/build.txt', require('zlib').brotliDecompressSync(require('fs').readFileSync('/tmp/build.log')))"
```

Danach ist `/tmp/build.txt` NDJSON — je Zeile ein Objekt mit `phase` und `msg`:

```bash
node -e "
require('fs').readFileSync('/tmp/build.txt','utf8').trim().split('\n')
  .map(l=>JSON.parse(l)).filter(l=>/BUNDLE|ERROR|FAIL/i.test(l.phase||''))
  .forEach(l=>console.log((l.msg||'').trimEnd()))"
```

Drei Fallen dabei, alle selbst hineingetreten:

- **Der Log ist Brotli-komprimiert**, nicht gzip (`x-goog-stored-content-encoding: br`). `gunzip`
  und `zlib.gunzipSync` scheitern wortlos oder liefern drei Bytes. Nodes
  `zlib.brotliDecompressSync` kann es ohne Zusatzpaket.
- **Die signierte URL lebt 15 Minuten** (`X-Goog-Expires=900`) — frisch holen, nicht aufheben.
- **`eas build:view` will ein Projektverzeichnis.** Aus `/tmp` heraus antwortet es
  „Run this command inside a project directory" — und das kommt als Text, nicht als JSON.

**Der schnellste Vorab-Hinweis ist die Laufzeit.** `eas build:view` zeigt Start und Ende: Ein
Build, der WebRTC kompiliert, braucht zwanzig Minuten. **Was in unter zwei Minuten stirbt, ist nie
am Kompilieren gescheitert** — dann lohnt der Blick gar nicht erst in Richtung Xcode.

### npm bricht ohne `legacy-peer-deps` ab

Expo SDK 54 pinnt `react@19.1.0`, `react-dom@19.2.8` kommt transitiv herein und verlangt
`react@^19.2.8`. `.npmrc` setzt `legacy-peer-deps=true`, EAS setzt `NPM_CONFIG_LEGACY_PEER_DEPS`.
Beides muss bleiben.

### `expo doctor` meldet doppeltes React — harmlos

Es findet Serlos `node_modules` eine Ebene höher. Beide sind `19.1.0`, Metro löst nachweislich die
lokale auf. Blockiert den Build nicht.

### EAS baut aus dem Arbeitsstand, nicht aus git

Auf der Build-Seite steht der Commit mit Sternchen. Das bleibt so — EAS nimmt, was im Ordner liegt,
nicht was in git steht. Bis zum 13.08.2026 war `apps/berkat` zusätzlich komplett untracked, ein
`git clean -fd` hätte die gesamte App gelöscht; das ist inzwischen behoben (Branch `berkat`).

---

## 4. Architektur-Entscheidungen und ihr Grund

### Zwei feste Flächen statt Hell-Dunkel-Umschalter

`theme/tokens.ts` exportiert `ui` (Sand, hell) und `stage` (dunkel). Es gibt **keinen Umschalter**.
Jede Komponente weiß, auf welcher Fläche sie sitzt. Damit ist heller Text auf heller Fläche —
der Fehler, der Serlo wiederholt erwischt hat — strukturell ausgeschlossen.

- `ui` → Startseite, Verkaufen, Konto, Anmeldung
- `stage` → ausschließlich der Live-Raum

Statusleiste: `dark` global im Root-Layout, `light` nur im Live-Raum.

### Die Video-Verbindung hängt über der Navigation

`components/LiveStage.tsx` umschließt als `LiveRoomProvider` den **gesamten** Stack im Root-Layout.
Raum und kleines Fenster rendern beide `StageVideo` aus demselben Strom. Läge die Verbindung im
Raum-Bildschirm, wäre sie beim Zurückgehen weg — und das kleine Fenster könnte nie echtes Video
zeigen.

### Ein geteiltes Realtime-Abo pro Signal

`lib/realtime.ts` zählt Zuhörer. `supabase.channel(name)` gibt bei gleichem Namen den *bestehenden*
Kanal zurück; ein zweites `.on()` darauf wirft. Zwei Screens auf derselben Session (Studio + Raum)
liefen genau in diesen Absturz. Nebeneffekt: halbierte Realtime-Kosten.

### Der Server entscheidet, der Client zeigt an

Gilt für **alles** Geldnahe:

- `place_live_bid` — Zeilen-Lock, Mindestschritt, Anti-Snipe, kein Selbstüberbieten
- `set_max_bid` / `resolve_auto_bids` — Stellvertreter-Bieten in geschlossener Form
- `draw_live_giveaway` — Ziehung per `ORDER BY random()` auf dem Server
- `checkout_auction_cart`, `mark_order_shipped` — enge RPCs statt Schreibrechten

`ends_at` ist die einzige Uhr. `lib/useAuction.ts` gleicht per `berkat_server_time()` die
Gerätezeit ab, damit ein falsch gestelltes Handy keinen falschen Countdown zeigt.

### Geld ist Integer in Cent

Überall. Ein Rundungsfehler in einer Auktion ist ein Rechtsstreit.

### Der Korb friert beim Gang zur Kasse ein

`checkout_auction_cart` setzt den Korb auf `checkout_pending`. Das ist **keine Kosmetik**, sondern
die Behebung eines Geldfehlers vom 14.08.:

Vorher errechnete die Funktion den Betrag aus den Zuschlägen, schrieb ihn fest in die Bestellung —
und ließ den Korb auf `open`. `ensure_auction_cart` sucht genau nach `open` und hängte jeden
weiteren Zuschlag in denselben Korb. Die Idempotenz-Abfrage gab die alte Bestellung zurück, **ohne
den Betrag neu zu rechnen**. Damit ließ sich Ware für 501 € mit 1 € bezahlen: billig gewinnen,
„Bezahlen" antippen, nicht zahlen, teuer weitergewinnen, dann die 1 € zahlen. Ohne jede Absicht
passiert dasselbe — antippen, abgelenkt werden, weiterbieten, zahlen.

Ein eigener Zustand, nicht eine Neuberechnung: Neu zu rechnen hätte das Fenster nur verkleinert,
zwischen Stripe-Sitzung und Zahlung kämen weiterhin Artikel hinzu.

Drei Dinge hängen daran und dürfen nicht auseinanderlaufen:

- Die **Idempotenz-Abfrage steht vor der Zustandsprüfung** — sonst findet niemand eine abgebrochene
  Zahlung wieder.
- `close_cart_on_order_paid` schließt `open` **und** `checkout_pending`.
- Das **Konto** zeigt beide Zustände, die **Leiste im Live-Raum bewusst nur `open`**: Sie zeigt den
  Korb, der gerade sammelt. Wer das „angleicht", zeigt einen eingefrorenen Korb als sammelnd an.

### Kein zweiter Weg, wo Serlo schon einen hat

Wiederverwendet statt nachgebaut:

| Zweck | Serlo-Baustein |
|---|---|
| LiveKit-Token | Edge Function `livekit-token` (prüft Host, Frauen-Only, Follower) |
| Bildupload | Edge Function `r2-sign`, Präfixe `products/images` und `thumbnails` |
| Bezahlen | Edge Function `create-checkout-session` (Zweig `order_id` → `product_orders`) |
| Zahlungseingang | Edge Function `stripe-webhook` (setzt `paid`, schreibt Versandadresse) |
| Zuschauerzahl | RPC `join_live_session` / `leave_live_session` |
| Folgen | Tabelle `follows` (löst Serlos Benachrichtigungen mit aus) |
| Chat | Tabelle `live_comments` (gemeinsam mit Serlo-App und -Web) |
| Herzen | Broadcast `live-reactions-<id>` / `new-reaction` + RPC `increment_live_likes` |

Beim Chat ist die **Tabelle** die gemeinsame Wahrheit, bei den Herzen der **Kanalname**. Deshalb
bekommen Broadcast-Kanäle in `lib/realtime.ts` keine laufende Nummer, die `postgres_changes`-Kanäle
dagegen schon: Dort ist der Name beliebig, hier ist er der Vertrag. Wer die Nummer anhängt, sendet
in ein anderes Thema und bleibt für Serlo stumm — genau der Bruch, der im Juli 2026 zwischen
Serlo-Web und -App auftrat.

Herzen laufen bewusst **nicht** über eine Tabellenzeile pro Tipp: Bei zweihundert klatschenden
Zuschauern wären das zweihundert Schreibvorgänge für etwas, das niemand je wieder liest. Der
bleibende Zähler (`live_sessions.like_count`) wird gedrosselt gepflegt, ein Ruf je Applaus-Welle —
er zählt also Wellen, nicht Finger. Die lebendige Zahl im Raum ist die lokale.

---

## 5. Datenbank

Vierunddreißig Migrationen, **alle eingespielt und verzeichnet** — `supabase migration list`
zeigt am 18.08.2026 keine Lücke. Die Tabelle war bis dahin sechs Einträge im Rückstand (`20260815180000`
bis `20260816090000` fehlten, obwohl die Abschnitte 14, 15 und 17 sie beschreiben); das ist
nachgetragen.

Der Weg bleibt: SQL im Editor ausführen, danach
`supabase migration repair --status applied <version>`. Seit dem 16.08.2026 ist **`supabase db push`
die bequemere Alternative** und einmal erfolgreich gelaufen — Voraussetzung ist, dass `migration
list` keine Lücke zeigt (siehe Abschnitt 3).

| Datei | Inhalt |
|---|---|
| `20260813150000_berkat_live_auctions.sql` | `live_auctions`, `live_bids`, `auction_carts`, Gebots-/Zuschlag-RPCs, `berkat_server_time()` |
| `20260813220000_berkat_max_bids.sql` | `live_auto_bids`, `set_max_bid`, `resolve_auto_bids`, `place_live_bid` neu |
| `20260813233000_berkat_giveaways.sql` | `live_giveaways`, `live_giveaway_entries`, drei RPCs |
| `20260814000000_berkat_cart_checkout.sql` | `product_orders.cart_id` + `.title`, Trigger „bezahlt → Korb zu", `checkout_auction_cart` |
| `20260814010000_berkat_mark_shipped.sql` | `mark_order_shipped` |
| `20260814120000_live_reactions_rls.sql` | `live_reactions_select` von `USING(true)` auf Session-Vererbung |
| `20260814130000_berkat_edit_auction.sql` | `update_live_auction` |
| `20260814140000_restore_profile_on_signup.sql` | **Serlo-weit:** Trigger `on_auth_user_created` wiederhergestellt |
| `20260814150000_berkat_cart_freeze_on_checkout.sql` | Korb-Zustand `checkout_pending`, `checkout_auction_cart` neu |
| `20260814280000_live_sessions_app_routing.sql` | **Serlo-weit:** `live_sessions.app` + Backfill über `room_name`, Index, `get_public_profile_web` gefiltert |
| `20260814290000_grant_select_live_sessions_app.sql` | `GRANT SELECT (app)` — ohne das ist die neue Spalte für die Clients unsichtbar, siehe Abschnitt 3 |
| `20260814300000_berkat_tips.sql` | `berkat_tips` + `create_berkat_tip` — Trinkgeld in echtem Geld, **nicht** in Coins |
| `20260814310000_seller_rating_public.sql` | `get_seller_rating` — nur Schnitt und Anzahl, die einzelnen Bewertungen bleiben privat |
| `20260815120000_berkat_scheduled_shows.sql` | **Serlo-weit:** `scheduled_lives.app` + Index; die Erinnerung vererbt die App an `notifications.app`; `schedule_berkat_show` als Berkat-Eingang — Abschnitt 13 |
| `20260815180000_berkat_shipping_rates.sql` | `berkat_shipping_rates`, `get_cart_shipping_options`, `product_orders.shipping_cents` — Abschnitt 14 |
| `20260815190000_shipping_options_service_role.sql` | EXECUTE für `service_role` — ohne das wirft die Kasse zur Laufzeit `42501` |
| `20260815200000_berkat_vouches.sql` | `berkat_vouches` (unique je Paar, kein Selbst-Bürgen), `get_vouch_weights` — Abschnitt 15 |
| `20260815210000_berkat_standing_listings.sql` | Dauerangebote: `session_id` nullable, Status `listed`, zweite Lese-Policy, `create_standing_listing` — Abschnitt 17 |
| `20260815220000_standing_listing_insert_policy.sql` | INSERT-Policy für Dauerangebote |
| `20260816090000_berkat_seller_search.sql` | `search_berkat_sellers` — findet auch, wer gerade nicht sendet — Abschnitt 17 |
| `20260816120000_berkat_categories.sql` | `berkat_categories`, `live_auctions.category`, `get_berkat_category_counts`, `create_standing_listing` mit Kategorie (DROP+CREATE) — Abschnitt 18 |
| `20260816130000_berkat_rewards.sql` | Einladungen, Versand-Gutschriften, Verkäufer-Vergünstigungen, `berkat_reward_policy` (Käufer-Bonus ab Werk **aus**) — Abschnitt 18 |
| `20260816150000_berkat_category_tree.sql` | `parent_slug` + Wächter gegen die dritte Ebene, 12 Eltern / 61 Kinder, Zähler mit Aufrollen — Abschnitt 18 |
| `20260816160000_berkat_seller_reviews_public.sql` | `get_seller_reviews` — Bewertungstexte öffentlich, nur Berkat-Bestellungen, Frauen-Only geschützt — Abschnitt 18 |
| `20260816170000_profiles_banner.sql` | **Serlo-weit:** `profiles.banner_url` + **`GRANT SELECT`** — ohne das wäre die Spalte für alle Clients unsichtbar, siehe unten |
| `20260816180000_berkat_scheduled_cover.sql` | **Serlo-weit:** `scheduled_lives.cover_url`; `schedule_berkat_show` mit viertem Parameter + Rückfall aufs letzte Show-Cover — Abschnitt 13. **Kein `GRANT` nötig**, `scheduled_lives` hat keine eingefrorene Spaltenliste |
| `20260816190000_berkat_scheduled_cover_woz.sql` | `AND s.women_only = false` im Rückfall — ohne das hebt eine `SECURITY DEFINER`-Funktion ein geschütztes Cover in eine öffentliche Zeile, siehe Abschnitt 3 |
| `20260816200000_berkat_sellers.sql` | `berkat_sellers` (Anbietertyp, Impressumsangaben, `checkout_enabled`), `live_auctions.seller_kind`, `set_berkat_seller_kind` — Abschnitt 20 |
| `20260816210000_berkat_listing_fields.sql` | Beschreibung, Zustand, PLZ, Ort; `create_standing_listing` neu; **zwei Lücken in `buy_now_live_auction`** (Frauen-Only, ZAG-Schranke) — Abschnitt 20 |
| `20260816220000_berkat_default_private.sql` | Wer die Vorgabe „Privatperson" stehen lässt, bekommt sie auch gespeichert — sonst zeigt die App eine Angabe, die die Datenbank nicht hat. **Eingespielt am 17.08.2026** per `supabase db push`, am Gerät gegengeprüft (Abschnitt 21). ⚠️ Hat dabei die ZAG-Schranke für alle zuschnappen lassen — siehe die nächste Zeile |
| `20260817120000_berkat_checkout_gate.sql` | `checkout_enabled` ist die **einzige** Wahrheit für den Kaufweg: Bestandsschutz für den Betreiber + `IS DISTINCT FROM true` im Wächter, damit auch „keine Zeile" sperrt — Abschnitt 22 |
| `20260817130000_berkat_live_seller_kind.sql` | `create_live_auction` stempelt `seller_kind` (nur lesen, nie anlegen); `set_berkat_seller_kind` schreibt die Impressumsfelder per `COALESCE`, damit ein Typwechsel sie nicht löscht — Abschnitt 22 |
| `20260817140000_berkat_shop_vollausbau.sql` | Mehrbild (`image_urls`), `update_standing_listing`, Merkliste `berkat_saved_listings` — Abschnitt 23 |
| `20260818120000_berkat_offers.sql` | Preisvorschlag: `accepts_offers`, `berkat_offers`, drei RPCs, `buy_now_live_auction` mit `p_offer_id` — Abschnitt 24 |

Vier davon kamen am 14.08. dazu, drei schlossen echte Löcher:

**`live_reactions_rls`** — die Lese-Policy stand auf `USING(true)`, und weil jede Zeile
`session_id` und `user_id` trägt, konnte jedes Konto die Teilnehmerliste jedes Frauen-Only-Raums
auslesen.

**`restore_profile_on_signup`** — betrifft **Serlo, nicht Berkat**. Auf `auth.users` existierte
kein Trigger mehr (am 17.04.2026 entfernt), und im gesamten App-Code legt niemand eine Zeile in
`profiles` an; `register.tsx` verlässt sich ausdrücklich auf den Trigger. Wer sich registrierte,
war angemeldet, hatte aber kein Profil — kein Name, keine Geldbörse, und jede Aktion mit
Fremdschlüssel auf `profiles` schlug fehl, in Berkat schon das erste Gebot. Drei Konten standen so
in der Datenbank (alle drei Test- oder Bot-Konten, kein echter Nutzer betroffen). Die neue Fassung
pinnt `search_path`, macht den Namen bei Kollision eindeutig und blockiert nie.

**`cart_freeze_on_checkout`** — siehe Abschnitt 4, „Der Korb friert beim Gang zur Kasse ein".

### RLS-Grundsatz

**Nie `USING(true)`.** Postgres verknüpft permissive Policies mit OR — eine einzige `USING(true)`
hebelt die Frauen-Only-Grenze aus (genau der Fehler, der am 16.07.2026 auf `live_sessions` gefunden
wurde). Sichtbarkeit erbt immer von der Session:

```sql
EXISTS (SELECT 1 FROM live_sessions s WHERE s.id = <tabelle>.session_id
        AND (s.women_only = false OR s.host_id = auth.uid()
             OR public.is_women_only_verified()))
```

Fremde Maxima (`live_auto_bids`) und Teilnehmerlisten (`live_giveaway_entries`) sieht **nur der
Besitzer** — sonst wären Stellvertreter-Bieten und Gewinnspiel wertlos.

---

## 6. Was fertig ist

| Bereich | Zustand |
|---|---|
| Marke, Icon, Splash | fertig — `scripts/generate-icons.mjs` erzeugt alle PNGs analytisch aus `assets/mark.svg` |
| Anmeldung | E-Mail/Passwort **und Registrierung** gegen dieselbe Supabase-Instanz. Google/Apple fehlen |
| Startseite | Suche, Kategorie-Leiste mit zwei Größen (schrumpft beim Scrollen), Show-Karten |
| Live-Vorschau auf den Karten | zeigt je Show den laufenden / nächsten / gerade zugeschlagenen Artikel mit Uhr und Preis — Abschnitt 8 |
| Verkäufer-Sheet | Tipp auf den Kopf im Live-Raum: Bewertung, Versandtempo, Zuschläge + sechs Wege — Abschnitt 10 |
| Öffentliche Verkäufer-Seite | `app/seller/[id].tsx` — Kennzahlen, laufende Show, zuletzt Verkauftes |
| Direktnachrichten | Verlauf + Posteingang, geteilt mit Serlo (`conversations`, `messages`) |
| Trinkgeld | echtes Geld über Stripe (`berkat_tips`) — am 15.08.2026 einmal komplett durchgelaufen |
| Bewertungen | „Ist angekommen" → fünf Sterne; öffentlicher Schnitt via `get_seller_rating` |
| Live-Raum | Video, Kamera-Vorschau vor dem Senden, Kamera-Steuerung, Chat mit Eingabe, wegwischbare Kommentare, Sammelkorb-Leiste, „Als Nächstes", Shop-Zettel |
| Auktion | Gebot, Anti-Snipe (+10 s), Sofortkauf, Max-Gebot, Zuschlag, „Du führst" |
| Verkäufer-Regie | Show starten/beenden, Artikel auflegen mit Bild, **nachträglich ändern**, **Starten aus dem Raum heraus**, Dauer 20/30/60 s |
| Reaktionen | Herz-Knopf **und Tippen aufs Bild**, fliegende Herzen, Zähler — auf Serlos Broadcast-Vertrag, also plattformübergreifend |
| Gewinnspiel | anlegen, mitmachen, ziehen — Teilnahme immer kostenlos |
| Kleines Fenster | echtes Video, läuft über alle Reiter weiter |
| Bezahlen | Sammelkorb → eine Bestellung → Stripe → Adresse → `paid` → eigene Erfolgsseite. Die Kasse öffnet seit 15.08.2026 **in der App**, nicht in Safari — Abschnitt 11 |
| Versand (Verkäufer) | Bestellliste mit Adresse, Sendungsnummer, Verfolgungs-Link |
| Kauf-Übersicht (Käufer) | „Gekauft" im Konto: Zustand, Artikel, Sendungsnummer |
| Zuschauerzahl, Folgen, Teilen | fertig |

**Die gesamte Kette ist am 14.08.2026 einmal komplett durchlaufen** — Show starten, live gehen,
Artikel auflegen, von einem zweiten Konto bieten, Zuschlag, Sammelkorb, Stripe-Zahlung (Testkarte),
eigene Erfolgsseite, Benachrichtigung an den Verkäufer, als versendet markieren, und die Sendung
beim Käufer sichtbar.

### Was fehlt

Kurz, und nichts davon blockiert den nächsten Schritt.

1. **1-Tap-Kauf im Stream — halb erledigt.** Der Weg aus der App heraus ist weg (Abschnitt 11): Die
   Kasse liegt als Blatt über der App, und am Ende der Show steht der Bezahl-Knopf direkt da. Was
   noch fehlt, ist das eigentliche *eine Tippen* — hinterlegte Zahlungsmethode, Apple/Google Pay
   statt Kartennummer. Das ist ein eigener Bau mit Adressformular und SCA-Behandlung; die Analyse
   führt es als „klein", das war zu optimistisch.
2. ~~**Kategorien- und Aktivitäts-Reiter**~~ — **am 16.08.2026 gebaut**, Abschnitt 18. Die
   Begründung „bewusst weggelassen, solange sie keinen Inhalt hätten" war falsch: Kategorien
   leben von den Dauerangeboten und sind damit gerade dann voll, wenn die Startseite leer ist.
3. **Google-/Apple-Anmeldung** — braucht Entwickler-Zugänge und einen echten Rebuild
4. **E-Mail-Bestätigung ist abgeschaltet.** Für eine Live-Auktion richtig — wer gerade zuschaut,
   springt nicht ins Postfach. Der Preis: Niemand weist nach, dass ihm die Adresse gehört. Ein
   Wegwerf-Konto kann bieten, gewinnen und nie zahlen — und blockiert den Artikel 24 Stunden im
   Korb. Vor fremden Verkäufern neu abwägen.

---

## 7. Offene Punkte außerhalb des Codes

### Migrations-Tracking begradigen — erledigt am 14.08.2026

Es waren **61** (nicht 62), von `20260614190000` bis `20260716130000`. Zu jeder gab es eine Datei.

**Erledigt.** Beide Reparatur-Läufe sind durch (die 61 plus die beiden vom 14.08.),
`supabase migration list` zeigt jetzt **232 Migrationen, alle in beiden Spalten, keine Lücke**.

Wie es belegt wurde — falls die Frage je wiederkommt: Unter `supabase/_ops/` liegt eine
**Nur-Lese-Abfrage** für den SQL-Editor, die 75 Funktionen, 24 Policies, 21 Indizes, 2 Speicher-Eimer,
6 gelöschte Indizes, 3 gelöschte Funktionen und eine Spalten-Nullbarkeit in den Systemtabellen
nachschlägt — plus die Anleitung. Leeres Ergebnis heißt: gefahrlos markieren. Zeilen heißen: genau
die fehlen. 19 der 61 waren zusätzlich über die REST-Schnittstelle belegt (Tabellen und Spalten,
alle vorhanden), die Abfrage deckte weitere 38 ab. Vier lassen sich prinzipiell nicht über die bloße
Existenz eines Objekts prüfen — sie sind in der README benannt.

**Der Lauf ergab genau einen Befund, und der war ein Fehlalarm:** `seller_accounts_read` fehlte —
weil die spätere Migration `20260710140000` sie ausdrücklich löscht und `seller_accounts_read_own`
an ihre Stelle setzt. Ihr Fehlen war also der **Beleg**, dass die Nachfolge-Migration lief. Die
Abfrage ist entsprechend korrigiert; sie erwartet später ersetzte Policies nicht mehr.

**Warum das nicht einfach von Anfang an markiert wurde** — die Regel gilt weiter: Eine Migration als
eingespielt zu markieren, die es nicht ist, macht die Lücke für immer unsichtbar. Bei
`drop_debug_coin_backdoors` hieße das, die Hintertüren lägen weiter in der Produktivdatenbank.

### Der Schema-Abzug war zwei Monate alt — erneuert am 14.08.2026

`supabase/schema_live.sql` stammte vom **14.06.2026** und war damit älter als fast alle 61
Migrationen, obwohl CLAUDE.md ihn als Quelle der Wahrheit führt. Die **gesamte Berkat-Schicht fehlte
darin** — `live_auctions`, `live_bids`, `auction_carts`, `live_auto_bids`, `live_giveaways`: keine
davon war verzeichnet. Wer dort eine Spalte nachschlug, prüfte gegen einen Stand vor der App.

**Erneuert.** Jetzt 93 Tabellen statt 78, 275 Funktionen statt 208, 212 Policies statt 195.
`SCHEMA.md` ist mitgezogen.

**Der Umweg um Docker** — die frühere Annahme „ohne Docker geht es nicht" war falsch:
`supabase db dump` braucht tatsächlich Docker, aber es kann mit `--dry-run` auch nur das fertige
`pg_dump`-Skript **ausdrucken** statt es auszuführen. Und die CLI benutzt dafür kein gespeichertes
DB-Passwort, sondern legt sich über die Management-API eine kurzlebige Rolle an
(`cli_login_postgres`) — deshalb fragt auch `migration repair` nie nach einem Passwort. Natives
`pg_dump` (Homebrew, 18.4) führt das Skript dann aus. Rezept steht in CLAUDE.md, Regel 10.

Zwei Fallen dabei: `--keep-comments` muss mit, sonst fallen die `-- Name: …`-Kopfzeilen weg und der
Abzug wird unlesbar. Und das erzeugte `/tmp`-Skript trägt das kurzlebige Passwort im Klartext —
danach löschen, nie committen.

**Das Parse-Skript für `SCHEMA.md` existierte nicht.** CLAUDE.md nannte es seit Juni („dann das
Parse-Skript"), im Repo lag es nie — genau deshalb war `SCHEMA.md` zwei Monate lang nicht
nachziehbar. Nachgebaut als `supabase/_ops/schema-md.mjs`; gegengeprüft, dass es die 78 vorher
bekannten Tabellen zeichengenau so ausgibt wie die alte Datei.

### Der Sicherheits-Durchgang vor dem Push fand ein Loch — in Serlo, nicht in Berkat

Berkats eigener Code war sauber: keine Geheimnisse in den 22 Commits, RLS auf allen neuen
Tabellen, alle RPCs mit gepinntem `search_path` und Rollen-Prüfung, der Geldpfad rechnet
serverseitig, Adressen nur für die zwei Beteiligten.

Gefunden wurde etwas anderes: **`credit_coins(user_id, coins)` war für die Rolle `anon`
freigegeben** — `SECURITY DEFINER`, ohne jede Prüfung, schreibt direkt ins Coin-Guthaben. Mit dem
öffentlichen Client-Schlüssel, der in jedem App-Bundle steckt, konnte sich jeder beliebig viele
Coins gutschreiben, **ohne angemeldet zu sein**. Belegt mit einem Aufruf mit erfundener Nutzer-ID:
Er lief bis zum Fremdschlüssel durch (`23503`), nicht bis zu einer Rechteprüfung.

Ursache: Die April-Migration hatte korrekt `revoke all … from public`. Ein späteres DROP+CREATE
setzte die Rechte auf den Postgres-Standard zurück — `EXECUTE` für PUBLIC, und PUBLIC schließt
`anon` ein. Behoben mit `20260814160000_revoke_anon_money_rpcs.sql`, zusammen mit zehn weiteren
ungeprüften `anon`-RPCs. Gegengeprüft: alle liefern jetzt `permission denied`.

**Nachtrag, ebenfalls erledigt:** `toggle_pin_post` nahm die Nutzer-ID als Parameter und prüfte sie
nicht gegen `auth.uid()`. Sie filtert intern durchgehend auf `author_id`, weshalb ein angemeldetes
Konto mit einer fremden ID nicht nur fremde Beiträge anpinnen, sondern über
`UPDATE posts SET is_pinned = false WHERE author_id = …` auch jedem seinen angehefteten Beitrag
abräumen konnte. Behoben mit `20260814170000_toggle_pin_post_auth_uid.sql`.

Die **Signatur bleibt absichtlich zweiargumentig**, `p_user_id` wird nur ignoriert. Streichen wäre
falsch: Ausgelieferte App-Versionen rufen weiter die alte Fassung, und eine zusätzliche
Ein-Parameter-Überladung macht PostgREST mehrdeutig (`HTTP 300`, wie bei
`publish_due_scheduled_posts` gemessen). Der Client wurde deshalb **nicht** geändert — er übergab
ohnehin die eigene ID; nur Kommentare halten fest, dass der Parameter drinbleiben muss.

**Konsequenz für den Schema-Abzug:** Er wird ab jetzt mit `--no-privileges` gezogen. Das Repo ist
öffentlich; ein Abzug mit Rechten trägt ~1000 `GRANT`-Zeilen und hätte genau diese Lücke verraten.

### Berkat pushen

Am 14.08.2026 nach dem Sicherheits-Durchgang **gepusht** — Branch `berkat` auf
`vibestes-boop/vibes-app`. Basis ist `origin/main` (nicht `origin/master`, das steht seit April
still). `.env` ist über `apps/berkat/.gitignore` ausgeschlossen und liegt nicht im Commit;
`node_modules`, `ios/` und `android/` ebenso wenig.

**Das Repo ist öffentlich.** Alles, was hier hineingeht, ist sofort weltweit lesbar und wird von
Bots binnen Sekunden durchsucht. Vor jedem weiteren Push gilt deshalb: keine Geheimnisse, und keine
Datei, die das Rechte-Modell der Live-DB beschreibt.

### Der Push scheitert an vier gh-Konten, nicht am Token

Am 14.08.2026 abends eine halbe Stunde gekostet. Der fine-grained PAT in `.env.local` ist seit dem
26.07.2026 abgelaufen, und er lag im **macOS-Schlüsselbund** — Git bot ihn an, GitHub lehnte ab, und
weil Passwörter für Git-Operationen nicht mehr unterstützt werden, endete es in einer
Passwort-Abfrage, die nie zum Ziel führt.

`gh auth setup-git` allein löst das **nicht**. Der Helfer bedient immer nur das **aktive** gh-Konto,
und auf diesem Rechner sind vier angemeldet (`ZaurHa` aktiv, dazu `vibestes-boop`, `mrg-tlogistik`,
`MyxcuH2025`). Die Remote-URL verlangt ausdrücklich `vibestes-boop@` — für diesen Namen gibt der
Helfer nichts zurück. Und den Namen wegzulassen hilft auch nicht: `ZaurHa` hat am Repo nur `pull`.

Gelöst mit einem Helfer **nur für dieses Repo**, der den Token bei jedem Zugriff frisch von `gh`
holt — nichts gespeichert, nichts läuft ab:

```bash
git config --local credential.helper '!f() { echo username=x-access-token; echo "password=$(gh auth token -u vibestes-boop)"; }; f'
```

⚠️ `gh auth setup-git` wirkt **global** und nimmt den Schlüsselbund für alle GitHub-Pushes aus dem
Spiel. Andere Repos auf diesem Rechner (z. B. `MyxcuH2025/siraj-quran`) bekommen seither `ZaurHa`s
Token. Scheitert dort ein Push, ist es dieselbe Ursache — und derselbe Einzeiler mit dem passenden
Konto.

### Stripe-Modus

Am 14.08. beim echten Durchlauf beantwortet: Die Zahlung lief mit der Testkarte
`4242 4242 4242 4242` durch — also **Testbetrieb**. Vor dem Umstellen auf Echtbetrieb ist der
Prüfpunkt die Adresszeile beim Bezahlen: `cs_test_…` ist Spielgeld, `cs_live_…` echtes Geld.

### Vor dem ersten fremden Verkäufer

Aktuell ist Zaur Verkäufer **und** Betreiber, das Geld geht direkt auf sein Stripe-Konto. Beim
ersten Drittverkäufer greift die volle Kette aus der Ausgangsanalyse:

- **Stripe Connect (Express)** — niemals selbst Geld weiterleiten, das wäre erlaubnispflichtig (ZAG)
- **DAC7 / PStTG** — Verkäuferdaten erheben und jährlich ans BZSt melden, ab 30 Verkäufen oder
  2.000 €/Jahr. Bußgeld bis 50.000 €
- **§ 25e UStG** — USt-ID als Pflichtfeld, sonst Haftung des Marktplatzes
- **LUCID** — Verkäufer ohne Registrierung dürfen nicht gelistet werden
- **GPSR** — Herstellerangaben als Pflichtfeld am Angebot
- **Widerrufsrecht gilt auch bei Online-Auktionen** — nicht abwendbar, als Kostenposition einplanen

Dauerhaft ausgeschlossen: **Coins als Zahlmittel für echte Ware** (wäre E-Geld, lizenzpflichtig),
**Zufalls-Mechaniken**, **Ratenzahlung mit Zinsen**, **Elektro/Batterien/Lebensmittel** als
Kategorien.

### Das eigentliche Risiko

Nicht die Software. **Fünf Verkäufer, die acht Wochen lang wöchentlich zwei Stunden senden.**
Der Code ist so weit, dass sich das testen lässt. Gelingt es nicht, spart die Antwort viel Arbeit.

---

## 8. Nächster sinnvoller Schritt

### Wo Berkat im Whatnot-Phasenplan steht

Der Plan stammt aus [`WHATNOT-ANALYSE.md`](WHATNOT-ANALYSE.md), Abschnitt „Konkreter Weg". Er ist
die Messlatte — nicht die Wunschliste, die beim Bauen entsteht.

| Phase | Inhalt | Stand |
|---|---|---|
| **0 — Sendeplan** | 5 Verkäufer, feste Termine, 4–8 Wochen, **kein Code** | ⏳ offen — das Werkzeug dafür steht seit 15.08. (Abschnitt 13), die fünf Verkäufer nicht |
| **1 — Auktion** | Gebots-RPC, Server-Timer, Anti-Snipe, Sammelversand, 1-Tap-Kauf | ✅ bis auf 1-Tap |
| **2 — Marktplatz** | Stripe Connect, Verkäufer-Onboarding, DAC7, Bürgen-System | ❌ offen |
| **3 — Wachstum** | WOZ-Live, Loyalty-Saison, Sponsor-Gift, Boost | ❌ bewusst später |

Von den sechs Bausteinen der Analyse sind vier gebaut — plus vieles, was gar nicht auf der Liste
stand (Verkäufer-Sheet, Bewertungen, Direktnachrichten, Trinkgeld, Live-Vorschau).

**Was Phase 1 noch fehlt: 1-Tap-Kauf im Stream.** Heute führt der Weg vom Sammelkorb über das Konto
in den Browser zu Stripe. Whatnot kauft mit einem Tippen, ohne den Stream zu verlassen. Die Analyse
führt das als „klein".

⚠️ **Was in Phase 1 ausdrücklich NICHT gebaut wird** — wörtlich aus der Analyse: „Ads, Loyalty,
Replay, Breaks, Mystery — alles davon ist Aufsatz und lenkt vom einzigen ab, was zählt: bekommt eine
Auktion in deiner Community mehr Geld für dieselbe Ware als ein Festpreis?"

**Phase 0 hat ein hartes Abbruchkriterium:** „<3 Verkäufer senden nach 4 Wochen regelmäßig →
stoppen." Sie steht im Plan **vor** dem Code und wurde übersprungen. Das ist derselbe Punkt, den
Abschnitt 7 als das eigentliche Risiko führt.

### Die App-Trennung ist vollständig ausgerollt (Stand 15.08.2026)

Gebaut am 14.08.2026, seit dem 15.08. überall draußen. Der Abschnitt bleibt stehen, weil die
Begründungen darin für jede weitere geteilte Tabelle gelten.

**Das Problem:** Eine Berkat-Show war eine ganz normale Zeile in `live_sessions`, und Serlos Listen
holten alle aktiven Sessions ohne Unterscheidung. Wer in Berkat eine Show aufmachte, erschien für
echte Serlo-Nutzer im Live-Bereich — in einer App ohne Gebots-Oberfläche. Umgekehrt listete Berkats
Startseite Serlo-Lives ohne Artikel.

**Die Lösung:** Spalte `live_sessions.app` (Default `'serlo'`), Filter an allen sieben
Listen-Abfragen beider Apps und im Web. Drei Stellen gingen über bloße Sichtbarkeit hinaus:

- **Ein Backfill war nötig** — anders als beim Push-Routing, wo „rückwirkend korrekt ohne Backfill"
  stimmte, weil Berkat nie einen Token registriert hatte. Sessions hatte Berkat sehr wohl schon
  angelegt. Zuordnung über das `room_name`-Präfix: 20 Berkat-Zeilen, 197 `vibes-…`, 9 `obs-…`.
- **Der Filter musste in die RPC.** `get_public_profile_web` rechnet `is_live` im Funktionsrumpf,
  ein `.eq()` im Client erreicht das nicht — sonst erzeugte eine Berkat-Show weiter den LIVE-Ring
  auf dem Serlo-Web-Profil.
- **Der Schreibpfad war die eigentliche Gefahr.** Serlos „Live starten" beendet vorher alle aktiven
  Sessions des Hosts. Ohne `app`-Filter also auch eine laufende Berkat-Auktion — lautlos, ohne
  Fehler. Steckte an zwei Stellen (`lib/useLiveSession.ts`, `apps/web/app/actions/live-host.ts`).

**Stand des Ausrollens:**

| Schritt | Zustand |
|---|---|
| Migrationen `20260814280000` + `20260814290000` | ✅ eingespielt, Backfill gegengeprüft (0 verfehlt, 0 falsch markiert) |
| Berkat | ✅ läuft — kein Store, kein OTA-Kanal, ein Neuladen aus Metro genügt |
| Serlo, OTA Runtime **1.31.0** | ✅ raus am 14.08.2026, 22:43 |
| Serlo, OTA Runtime **1.30.0** | ✅ raus am 14.08.2026, 23:0x |
| Push `origin/berkat` | ✅ aktuell |
| `apps/web` (Vercel) | ✅ am 15.08.2026 — `berkat` per Fast-Forward nach `main`, Vercel baut von dort |

Berkat musste vor Serlo dran sein: Solange ein alter Berkat-Stand läuft, legt er Shows **ohne**
`app` an, die per Default auf `'serlo'` fallen und trotz Filter wieder auftauchen. Deshalb bleibt
ein Testlauf aus einer Metro-losen Berkat-Version (Android-APK) verboten, bis die neu gebaut wurde.

**Zwei Runtimes, zwei Veröffentlichungen.** `runtimeVersion` folgt der `version` aus der `app.json`
(Richtlinie `appVersion`), und es sind Nutzer auf **1.30.0 und 1.31.0** unterwegs. Ein einzelnes
`eas update` erreicht immer nur eine Hälfte. Für die andere die Version kurz umsetzen,
veröffentlichen, zurückstellen — `git checkout app.json` stellt sie zeichengenau wieder her:

```bash
sed -i '' 's/"version": "1.31.0"/"version": "1.30.0"/' app.json && \
EAS_BUILD=1 npx eas update --branch production --message "… (Runtime 1.30.0)" --non-interactive; \
git checkout app.json && grep '"version"' app.json
```

Das `;` vor dem Zurückstellen ist Absicht: Es läuft auch, wenn die Veröffentlichung scheitert.
Bleibt die Version stehen, bekommt der nächste Build eine falsche.

Vor einem OTA an eine **ältere** Runtime prüfen, ob seither native Abhängigkeiten dazukamen —
`git diff <letzter-OTA-Commit>..HEAD -- package.json`. Am 14.08. war die Datei unverändert, dasselbe
Bündel war für beide Runtimes sicher.

Die `app.json`-Änderungen (Android-Berechtigungen, `versionCode` 48) gehen **nicht** per OTA raus —
die warten auf einen nativen Build und gehören zum Play-Store-Test, nicht hierher.

### Und danach — drei Möglichkeiten, in der Reihenfolge, die ich empfehle

**1. 1-Tap-Kauf im Stream — die erste Hälfte ist am 15.08.2026 gebaut** (Abschnitt 11). Der Ausflug
in den Browser ist weg. Die zweite Hälfte — hinterlegte Zahlungsmethode, Apple/Google Pay — steht
noch aus und ist größer, als die Analyse annahm.

**2. Phase 0 nachholen: fünf Verkäufer, acht Wochen.** Kein Code. Der Plan sieht sie vor dem Bauen
vor, sie wurde übersprungen, und sie hat als einzige ein Abbruchkriterium. Solange sie offen ist,
weiß niemand, ob das Format in dieser Community trägt.

**3. Phase 2: Stripe Connect und Verkäufer-Onboarding.** Groß und rechtslastig (Abschnitt 7). Die
Analyse sagt ausdrücklich: erst wenn Verkäufer-Nachfrage da ist. Das vor Punkt 2 zu bauen wäre genau
der Fehler, vor dem sie warnt.

Was im Code noch offen ist, steht in Abschnitt 6 unter „Was fehlt" — es ist wenig, und nichts davon
blockiert Punkt 2.

### Live-Vorschau auf den Show-Karten — gebaut am 14.08.2026

Über jedem Vorschaubild auf der Startseite liegt jetzt ein Widget, das zeigt, was in dieser Show
**gerade** passiert. Aus dem Raster von Standbildern wird ein Marktplatz mit Puls: Man sieht ohne
einen einzigen Tap, dass eine Uhr läuft, dass etwas weggeht, dass gleich das nächste kommt. Das
ist Design-Gesetz 1 — Hochs lauter machen — nur eben **vor** dem Betreten des Raums.

#### Die Grammatik: eine Komponente, drei Zustände

`components/LivePreview.tsx`. Nicht drei Widgets — Zeile 1 und Zeile 3 wechseln nur ihren Inhalt:

| `live_auctions.status` | Zeile 1 (klein, grau) | Zeile 2 (fett, 1 Zeile) | Zeile 3 links | Zeile 3 rechts |
|---|---|---|---|---|
| `running` | „Läuft aktuell" | Artikelname | `00:04` **rot**, tickt | Gebot, zählt hoch |
| `sold` | „Gleich der Nächste" | Artikelname | „Verkauft" **rot** | Endpreis |
| `scheduled` | „Als Nächstes …" | Artikelname | „Beginnt bald …" grau | Startpreis |

Rechts ragt das **Artikelbild** über die Oberkante hinaus. Beim Zustandswechsel blendet das Widget
kurz aus und wieder ein — kein eigener Mechanismus, sondern die Folge des Wechsels: Es hängt am
Schlüssel aus Artikel und Zustand.

Läuft die Uhr auf null, steht dort **„Zuschlag …"** statt einer stehenden `00:00` — dieselbe
Formulierung wie im Live-Raum, weil eine eingefrorene Uhr nach Absturz aussieht.

#### Die Abfrage: `useShowPreviews` in `lib/useAuction.ts`

Vorrang je Show: **läuft** → sonst **nächster geplanter** (kleinster `sort_index`) → sonst
**gerade zugeschlagen**. Findet sich nichts davon, steht in der Karte auch nichts — eine Show ohne
Auktionsbetrieb soll keinen Puls vortäuschen. Kein neues DB-Objekt.

Zwei Abfragen statt einer, weil die beiden Hälften verschiedene Grenzen haben: Offene Artikel sind
je Show eine Handvoll, verkaufte wären unbegrenzt. Deshalb hat „gerade zugeschlagen" ein **Fenster
von fünf Minuten**. Ohne das müsste die Abfrage die gesamte Verkaufsliste jeder Show mitziehen, um
eine einzige Zeile Text zu finden — bei 60 Shows mit je zwei Stunden Betrieb sind das Tausende
Zeilen.

**Der Countdown tickt lokal.** Der Server liefert nur den Endzeitpunkt; deshalb reichen 20 Sekunden
Nachladetakt für den Zustandswechsel, ohne dass die Uhr ruckelt.

#### Fallen, die dabei zugeschlagen haben

- **Der Countdown darf nicht je Karte ticken.** Sechzig Karten wären sechzig Uhren für dieselbe
  Sekunde. Die Startseite hat **einen** Takt, jede Karte rechnet ihre Restzeit selbst aus — und der
  Takt steht still, solange nirgends eine Auktion läuft.
- **In Zeile 1 passen auf einer halbbreiten Karte knapp zwanzig Zeichen.** „Warten auf nächsten
  Artikel" aus dem Entwurf stand im Simulator als „Warten auf nächst…" da. Daher „Gleich der
  Nächste".
- **Das Artikelbild hängt weit genug über die Oberkante**, dass es nur die kurze Zeile darüber
  berührt. Hing es tiefer, musste der Artikelname ihm ausweichen — und aus „Gucci Bloom 50 ml"
  wurde „Gucci Bloom 5…".
- **Das Frauen-Only-Zeichen saß unten links**, wo jetzt die Vorschau liegt. Es steht jetzt oben
  neben der Live-Pille, in einer Reihe, die auf schmalen Geräten umbricht statt sich zu überlappen.
- **`pointerEvents="none"`** auf dem Widget: reine Anzeige, der Tipp gehört der Karte darunter.

#### ⚠️ Die Falle: Kontrast über beliebigen Bildern

Das Widget liegt auf einem **Bild**, und Bilder sind mal hell, mal dunkel. Berkats Design-Gesetz
kennt bewusst nur zwei feste Flächen (`ui` hell, `stage` dunkel), genau um diesen Fall
auszuschließen — Text auf fremdem Bildinhalt ist die einzige Ausnahme in der ganzen App.
Seit dem 17.08.2026 gibt es davon **zwei** Fundstellen: dieses Widget und die „Deins"-Pille auf
der Angebots-Karte (`components/ListingCard.tsx`). Der Bestand steht an `ui.overlay` in
`theme/tokens.ts` — wer eine dritte anlegt, trägt sie dort ein.

Gelöst wie bei Whatnot: eine **milchige, fast deckende** Fläche, nicht zartes Glas. Sie steht als
`ui.overlay` in `theme/tokens.ts`, damit niemand sie beim nächsten Mal „dezenter" macht. Wer hier
auf Transparenz setzt, bekommt genau den Fehler, der Serlo wiederholt erwischt hat: lesbar auf dem
einen Bild, unsichtbar auf dem nächsten.

**Am 15.08.2026 über einem echten Foto nachgemessen** — und der Befund war nicht der erwartete.

Die Fläche hält, was sie verspricht: über dem hellsten und dem dunkelsten Punkt desselben Bildes
unterscheidet sie sich um **11 von 255**, genau die 94 %. Was man beim Vergrößern für Durchscheinen
hält, ist die Skalierung.

Die **Schrift** hielt nicht. `textMuted` kam auf **3,84:1** und `live` auf **3,92:1** — WCAG verlangt
für diese Schriftgrößen 4,5:1. Lesbar wirkte es trotzdem, deshalb hätte ein Blick allein das nie
gefunden. Dafür gibt es jetzt `ui.overlayMuted` und `ui.overlayUrgent`, die abgedunkelten Fassungen;
nachgemessen an den gerenderten Bildpunkten stehen alle drei Zeilen bei **5,14 / 14,77 / 4,83:1**.

Wer die Töne wieder aufhellt, macht genau diesen Fehler zurück. Sie stehen deshalb in `tokens.ts`
und nicht in der Komponente.

#### Am echten Datenstand geprüft (14.08.2026 abends)

Testlauf im Simulator, zwei der drei Zustände gesehen:

- **`scheduled`** — „Als Nächstes … · Silberring · Beginnt bald … · 1 €"
- **`running`** — „Läuft aktuell · Teekanne aus Kupfer · **00:43** · 1 €", sechs Sekunden später
  `00:22`. Die Uhr tickt lokal, wie gebaut; beim Ablaufen wechselte sie auf „Zuschlag …".

**`sold` blieb ungeprüft** — der Zustand braucht ein Gebot, und der Server lässt niemanden auf
eigene Artikel bieten (`seller_cannot_bid`). Das geht nur im Zwei-Konten-Durchlauf.

Ohne Artikelbild fällt das Bild am rechten Rand ersatzlos weg; die drei Zeilen stehen weiter
korrekt. Kein Platzhalter, kein Loch.

#### Was dabei auffiel und behoben wurde

- **Ungerade Anzahl Shows** zog die letzte Karte auf volle Breite (`flex: 1` in einem Raster mit
  zwei Spalten). Älter als die Vorschau, fiel mit ihr aber stärker auf. Behoben wie in Serlos Shop
  (v1.26.3) mit einem Platzhalter-Eintrag — hier allerdings mit dem Merkmal `spacer: true` statt
  eines Vergleichs auf der `id`: TypeScript reduziert `(LiveShow | { id: '__spacer__' })['id']` zu
  `string`, das Literal geht verloren und die `id` taugt nicht mehr zur Unterscheidung.
- **Die Startseite lud beim Reiter-Wechsel nicht nach.** Nach einem Auktionsstart im Studio stand
  dort noch bis zu zwanzig Sekunden „Beginnt bald", obwohl die Uhr längst lief — die in Abschnitt 3
  beschriebene Reiter-Falle. Der 20-Sekunden-Takt heilte es, aber eben erst nach zwanzig Sekunden.
  `useFocusEffect` verwirft jetzt beide Abfragen beim Zurückwechseln; der **erste** Fokus wird
  übersprungen, sonst lädt die Startseite direkt nach dem Start doppelt.

### Website — bereits veröffentlicht

Läuft unter `berkat-live.pages.dev`, die Weiche in `create-checkout-session` ist eingeschaltet.
Neu hochladen nach Änderungen:

```bash
npx wrangler pages deploy /Users/zaurhatuev/vibes-app/apps/berkat-web --project-name berkat-live
```

Details in `apps/berkat-web/README.md`.

### Falle: Pages wirft den Pfad weg

Die Teilen-Adresse trägt die Show-Kennung als **Parameter** (`/live?id=…`), nicht im Pfad.
Eine Umschreib-Regel `/live/*  /live.html  200` sieht richtig aus, greift auf Pages aber nicht:
Es macht aus dem Ziel `/live.html` die saubere Form `/live` und schickt eine echte Weiterleitung
— die Kennung ist damit weg, und der Knopf „In Berkat öffnen" kann die Show nicht mehr benennen.
Auf der veröffentlichten Seite nachgemessen (308 auf `/live`). Wer dort auf Pfade umstellen will,
braucht eine Pages-Function, keine Regel.

### Die Domain gehört jemand anderem

`berkat.app` steht seit dem 19.06.2026 auf einen fremden Namen, `berkat.store` seit dem
05.08.2026, `berkat.pages.dev` ist ebenfalls vergeben. Jemand baut parallel unter demselben
Namen. **`berkat.de` ist ebenfalls weg** (DENIC-Status `connect`, A-Eintrag auf 188.40.92.90).

Der Teilen-Knopf schickte Empfänger bis zum 14.08. auf genau diese fremde Domain. Das ist raus:
Die Adresse steht jetzt an einer Stelle, `SITE_URL` in `lib/links.ts`, und zeigt auf die
kostenlose Pages-Adresse. Eine gekaufte Domain kostet später drei Zeichenketten — frei wären
`berkatlive.de`, `berkatmarkt.de`, `berkat.market`, `berkat.shop`.

### Der Durchlauf — schon einmal gemacht, jederzeit wiederholbar

Am 14.08.2026 komplett durchgespielt: iPhone als Verkäufer, Simulator als Käufer mit einem zweiten
Konto. Ein zweites Gerät braucht es also nicht.

1. iPhone: Verkaufen → Show starten (springt direkt in den Raum) → „Live gehen" → Artikel auflegen → starten
2. Simulator (anderes Konto): Show antippen → bieten → Zuschlag abwarten
3. Simulator: Konto → Deine Pakete → bezahlen (Testkarte `4242 4242 4242 4242`, Ablauf `12/34`, CVC `123`)
4. iPhone: Verkaufen → Bestellungen → Adresse prüfen → Sendungsnummer → als versendet markieren
5. Simulator: Konto → „Gekauft" → Zustand und Sendungsnummer müssen dort stehen

**Ein zweites Konto ist Pflicht:** Der Server lässt niemanden auf eigene Artikel bieten
(`seller_cannot_bid`). Anlegen geht seit dem 14.08. direkt in Berkat.

### Was am Durchlauf noch ungeprüft ist

- **Ob ein Herz aus der Serlo-App in Berkat ankommt** — der Broadcast-Vertrag ist gebaut, aber nie
  über beide Apps gemessen
- **Das Max-Gebot** unter echtem Gegendruck. Anti-Snipe ist am 16.08. belegt (Abschnitt 19), das
  Stellvertreter-Bieten nicht — dafür müssten zwei Menschen gleichzeitig bieten.

Erledigt am 16.08.2026 in einer echten Sendung, siehe Abschnitt 19: **echtes Video**, **Anti-Snipe
unter echtem Gegendruck** und der **Vorschau-Zustand „gerade zugeschlagen"**.

---

## 9. Benachrichtigungen an den Käufer (Stand 14.08.2026)

Die Kette lief stumm in eine Richtung: Der Verkäufer erfuhr, dass bezahlt wurde, der Käufer erfuhr
nichts. Alle drei Ereignisse sind gebaut.

| Ereignis | Zeile entsteht | Text im Push | Zustellung ans Berkat-Gerät |
|---|---|---|---|
| Zuschlag (`auction_won`) | ✅ Trigger auf `live_auctions` | ✅ | ✅ seit `20260814190000` |
| Versendet (`order_shipped`) | ✅ Trigger auf `product_orders` | ✅ (Typ gab es schon) | ✅ dito |
| Zahlungserinnerung | ✅ `remind_due_auction_carts()`, pg_cron (`20260814200000`) | ✅ (Typ gab es schon) | ✅ dito |

Die Tabelle stand bis zum Nachziehen im Widerspruch zum Absatz am Ende dieses Abschnitts — die
Zahlungserinnerung kam am selben Tag noch dazu, die Zeile blieb stehen.

### Warum Trigger und nicht die RPCs

Ein Zuschlag entsteht auf **zwei** Wegen — Uhr abgelaufen (`settle_live_auction`) und Sofortkauf
(`buy_now_live_auction`). Beide setzen `status='sold'` + `winner_id`. Ein Trigger auf der Spalte
greift für beide und kann nicht auseinanderlaufen, wenn ein dritter Weg dazukommt. Sonst hätten
zwei große Rümpfe per `CREATE OR REPLACE` neu geschrieben werden müssen — die Stelle, an der laut
CLAUDE.md schon einmal spätere Änderungen verlorengingen.

`order_shipped` ist bewusst auf Berkat begrenzt (`cart_id IS NOT NULL`, dieselbe Weiche wie in
`create-checkout-session`). Serlos Shop bekam nie ein Versand-Ping; das still mitzuändern wäre eine
Verhaltensänderung an einem laufenden Produkt. Eine Bedingung streichen genügt.

### Die Falle: es sind vier Oberflächen, nicht drei — und eine davon ist tot

CLAUDE.md nennt drei (In-App-Liste, Expo-Push, Web-Push). Beim Bauen kam heraus:

- **Der native Push-Text kommt aus SQL, nicht aus der Edge Function.** Migration `20260701050000`
  hat den Trigger am 01.07.2026 auf den tokenlosen Direkt-Helper umgestellt, weil in der DB kein
  Service-Role-Token gesetzt ist und `send-push-notification` mit 401 antwortete. Seither leben die
  Texte als `CASE` in `fn_send_push_on_notification`. Wer nur die Edge Function anfasst, bekommt den
  ELSE-Zweig: **„Neue Aktivität auf Serlo"**. Genau einmal so passiert, bevor es auffiel.
- ~~**Web-Push ist für alle Nicht-DM-Typen tot**~~ — ⚠️ **RICHTIGSTELLUNG 21.08.2026: falsch.**
  Der Satz stand hier seit dem 14.08. und in Abschnitt 51 noch einmal als Begründung dafür, dass
  ein neuer Meldungstyp „nicht neun Oberflächen" braucht. Am frischen Schema-Abzug nachgelesen:
  `fn_send_push_on_notification` ruft für jeden Nicht-DM-Typ **`net.http_post` auf
  `/functions/v1/send-push-notification` mit `channels: ['web']`** — der Weg wurde am 14.08. mit
  `20260814220000` wiederhergestellt und lebt seither. **Beide Wege feuern:** der SQL-`CASE` für
  nativ, die Edge Function für den Browser.

  Die Folge stand am 21.08. im Code: `auction_won` ist in der Function an vier Stellen verkabelt,
  **`auction_up` an keiner** — ein Web-Abonnent hätte „Neue Aktivität auf Vibes" mit leerem Text
  bekommen, auf die Serlo-Startseite geführt und in Serlos Einstellungen nicht abschaltbar. Heute
  folgenlos, weil `web_push_subscriptions` leer ist; ab dem ersten Browser-Abonnenten nicht mehr.
  Beim Bau der gespeicherten Suche mit repariert (Abschnitt 57).

  **Ein neuer Meldungstyp braucht also doch die Edge Function**, und zwar vier Stellen darin:
  `MESSAGES` (de **und** ru), `TYPE_TO_PREF`, `deriveWebUrl`, `deriveWebTag`.
- Die Edge-Function-Texte sind trotzdem ergänzt: Sie sind korrekt und greifen, sobald der
  Token-Weg wieder aktiviert wird.

Vollständige Liste für einen neuen Typ: `notifications_type_check` · `CASE` in
`fn_send_push_on_notification` · `MESSAGES` in `send-push-notification` (de/ru) · `TYPE_TO_PREF` ·
`deriveWebUrl` · `deriveWebTag` · `app/(tabs)/notifications.tsx` (Text, Symbol, Antippen) ·
`lib/i18n/messages/{de,en,ru}.ts` · TypeScript-Union in `lib/useNotifications.ts`.

### Warum der Käufer sie trotzdem noch nicht auf dem Handy sieht

**Berkat hat kein Push.** Kein `expo-notifications`, kein Plugin, keine Token-Registrierung. Der
Grund war strukturell: Serlo und Berkat teilen sich `profiles`, und die Zustellung kannte keine
App-Dimension — ein Token hätte den anderen verdrängt.

Das ist mit `20260814190000` behoben: `push_tokens.app` und `notifications.app` (Default `'serlo'`,
also rückwirkend korrekt ohne Backfill), und `send_push_to_user` filtert danach. Solange Berkat
keinen Token registriert, greift ein **bewusster Rückfall**: Findet sich kein Gerät der Ziel-App,
gehen die Meldungen an alle Geräte des Nutzers. Wer beide Apps hat, bekommt den Zuschlag also
vorerst in Serlo — unschön, aber besser als Stille. Abschalten: im Helper die Bedingung
`v_count = 0` streichen.

Nebenbefund, entkräftet: Mehrere Geräte funktionieren längst. `send_push_to_user` liest die Tabelle
`push_tokens`, nicht die Einzelspalte `profiles.push_token` — nur die (nicht mehr laufende) Edge
Function las die Spalte.

### Push in Berkat — steht seit 14.08.2026

Die Registrierung liegt in `lib/usePush.ts` und hängt im Wurzel-Layout. Sie schreibt **nur** in
`push_tokens` mit `app: 'berkat'` und fasst `profiles.push_token` bewusst nicht an — die Einzelspalte
kann nur einen Token halten, Berkat würde sonst den von Serlo verdrängen.

Belegt: Nach dem Build hat sich ein Gerät registriert (`berkat · ios`, Konto `amir32`), und der
Filter im Zustellhelfer wählt für eine Berkat-Meldung genau dieses eine Gerät aus.

**Der erste Build-Versuch scheiterte** — festhalten, weil es bei Android genauso kommen wird:

```
XCODE_BUILD_ERROR
Provisioning profile "*[expo] com.berkat.app AdHoc …" doesn't support the Push Notifications capability.
Entitlements file defines the value "aps-environment" which is not registered for profile …
```

Das Profil stammte aus der Zeit vor Push. Der Code war korrekt — das `expo-notifications`-Plugin
trägt `aps-environment` sauber ein, nur kannte die App-ID die Berechtigung nicht. **Nicht
nicht-interaktiv behebbar:** Nötig sind Push Notifications auf der App-ID, ein neues Profil und ein
APNs-Schlüssel. EAS erledigt alle drei selbst, aber nur im interaktiven Lauf mit Apple-Anmeldung und
Zwei-Faktor — also `eas build --profile development --platform ios` **ohne** `--non-interactive`.

**Falle beim Verbinden:** Läuft schon ein Metro auf 8081, weicht ein zweiter Start stillschweigend
auf **8082** aus. Der Dev-Client meldet dann nur „failed to connect" auf die Adresse, die man von
Hand eingetippt hat. Vor dem Tippen prüfen:

```bash
lsof -nP -iTCP -sTCP:LISTEN | grep 808
```

Ebenfalls harmlos und verwirrend: Wird die Metro-Adresse in einem **Browser** geöffnet, versucht
Metro ein Web-Bundle und scheitert an `react-native-web` — das hat Berkat gar nicht. Die roten
Zeilen im Terminal bedeuten dann nichts.

**Beim Testen beachten:** Push kommt nur auf einem echten Gerät an — der Simulator hat keine
Push-Fähigkeit, die Registrierung überspringt ihn per `Device.isDevice`. Für den Durchlauf heißt das
**andersherum als bisher**: iPhone als Käufer, Simulator als Verkäufer. Sonst gewinnt das Konto auf
dem Simulator und der Zuschlag-Push hat kein Ziel.

### Was noch fehlt

1. ~~**Eigene Benachrichtigungsliste in Berkat**~~ — **existiert** (`app/notifications.tsx` +
   `lib/useNotifications.ts`, Glocke oben rechts auf der Startseite). Dieser Punkt war schon
   überholt, als er noch hier stand; seit dem 16.08. liegt daneben zusätzlich ein
   **Posteingang** für Direktnachrichten mit eigenem Abzeichen.
2. **Android-Build — erledigt am 14.08.2026.** Der erste Android-Build überhaupt, im ersten
   Anlauf durch (11 Minuten, `versionCode` 2, APK unter der internen Verteilung). Anders als bei
   iOS gab es keine Berechtigungs-Hürde, weil Firebase vorher stand.

   **Firebase-Anbindung:** Projekt `kleinanzeigen-62bc9`, App-Paket `app.berkat.market`.
   `google-services.json` liegt in `apps/berkat/` und ist eingecheckt — sie enthält kein
   Geheimnis, nur Projekt-ID, Paketname und einen Firebase-API-Key, der ohnehin in jeder APK
   steckt. Der **FCM-V1-Dienstkonto-Schlüssel** liegt bei EAS.

   ⚠️ **Beide müssen aus demselben Firebase-Projekt stammen.** Passt der Dienstkonto-Schlüssel
   nicht zur `google-services.json`, lehnt Google die Zustellung ab — und zwar erst zur Laufzeit,
   der Build läuft trotzdem durch. Beim Einrichten stand im EAS-Menü ein alter Schlüssel für
   `serlo-199be` zur Auswahl; den zu nehmen wäre genau dieser Fehler gewesen.

   ⚠️ **Der Dienstkonto-Schlüssel ist ein echtes Geheimnis** (`type: service_account` +
   `private_key`), anders als `google-services.json`. Er lag beim Einrichten kurz im Repo-Ordner —
   nicht eingecheckt, aber auch nicht ignoriert. `apps/berkat/.gitignore` fängt das jetzt ab
   (`*firebase-adminsdk*.json`, `*service-account*.json`). Nach dem Hochladen zu EAS lokal löschen.

   Beim Vergleich mit Serlos Android-Block fiel außerdem auf, dass Berkat nur `RECORD_AUDIO`
   deklarierte und **keine `CAMERA`** — für eine Live-Streaming-App wäre das schon ohne Push ein
   Problem gewesen. Ist ergänzt, zusammen mit `POST_NOTIFICATIONS` (Android 13+).

   **Noch nicht geprüft:** ob der Push auf einem echten Android-Gerät ankommt. Die Registrierung
   überspringt Emulatoren per `Device.isDevice`, es braucht also ein Telefon.

3. **Web-Push hat null Abonnenten.** Der Weg ist seit 20260814220000 wieder da und VAPID-Schlüssel
   sind gesetzt, aber `web_push_subscriptions` ist leer — es hat schlicht noch nie jemand im Browser
   die Berechtigung erteilt. Erst dann lässt sich prüfen, ob wirklich etwas ankommt.

**Am 14.08.2026 am Stück durchgelaufen — mit Push.** Simulator als Verkäufer (`berkattest`), iPhone
als Käufer (`amir32`): Show, Artikel „Wasser" aufgelegt, geboten, Zuschlag bei 1,00 € — und die
Meldung **„🎉 Zuschlag — du hast gewonnen! · Wasser · 1,00 €"** kam auf dem iPhone an. In der
Datenbank belegt: Zeile mit `app = 'berkat'`, und Expo meldete für den Web-Aufruf
`skipped: native channel not requested` — der Beweis, dass die Kanal-Trennung greift und niemand
einen Doppel-Push bekommt.

Zuschlag, Versand und Zahlungserinnerung entstehen damit serverseitig (Trigger bzw. pg_cron alle 15
Minuten), die Texte stehen in allen Oberflächen, die App-Trennung beim Versand steht, und Berkat
registriert seinen Token.

---

## 10. Verkäufer-Sheet und Bewertungen (Stand 15.08.2026)

Ein Tipp auf den Kopf des Verkäufers im Live-Raum war bis dahin tot. Jetzt öffnet er das Sheet nach
Whatnot-Vorbild: oben die Zahlen, an denen ein Fremder entscheidet, ob er diesem Menschen Geld
schickt — darunter alles, was man mit ihm tun kann.

`components/SellerSheet.tsx`, verkabelt in `app/live/[id].tsx`.

### Die drei Kacheln

Alle drei werden aus dem gerechnet, was ohnehin entsteht (`lib/useSellerStats.ts`). Es gibt keine
gepflegte Kennzahl-Tabelle und keinen Cron — **eine Zahl, die jemand von Hand setzen kann, ist als
Vertrauenssignal wertlos.**

| Kachel | Quelle | Leerzustand |
|---|---|---|
| ★ Bewertung | `get_seller_rating` (Aggregat-RPC) | „Noch keine Bewertung" |
| 🚚 Versandzeit | `product_orders`, letzte 20, nur `cart_id IS NOT NULL` | „Noch nichts versendet" |
| 🏷 Zuschläge | `live_auctions` mit `status='sold'` | „0 Zuschläge" |

Jede Kachel zeigt „—" statt einer erfundenen Zahl. „5,0" ohne eine einzige Bewertung wäre die
schlimmste Variante — sie behauptet Vertrauen, das niemand vergeben hat.

Das Versandtempo nimmt bewusst nur die **letzten 20** Bestellungen: Wer vor einem Jahr langsam war
und heute schnell ist, soll heute gemessen werden.

### Die sechs Zeilen

Erst das Freundliche, dann mit Abstand das Unfreundliche. Der Abstand ist nicht Kosmetik — ein
„Sperren" direkt unter „Erwähnen" wird verrutscht getroffen.

| Zeile | Wohin |
|---|---|
| Trinkgeld | `app/tip/[id].tsx` → Stripe |
| Profil anzeigen | `app/seller/[id].tsx` |
| Nachricht | `app/messages/[id].tsx` (Parameter ist die **Gegenseite**, nicht die Unterhaltung) |
| Im Chat erwähnen | schreibt `@name` ins Eingabefeld und fokussiert es |
| Sperren | `user_blocks`, Gesperrte werden im Chat **clientseitig** ausgeblendet |
| Melden | `user_reports`, mit Gründe-Auswahl im selben Sheet |

Bei sich selbst fallen Trinkgeld, Nachricht, Sperren und Melden weg. Das ist der Grund, warum man
sie beim Testen als Gastgeber nie zu Gesicht bekommt.

**Alle sechs sind am 15.08.2026 einmal gelaufen** — die vier gesperrten vom zweiten Konto aus:

| Zeile | Belegt durch |
|---|---|
| Trinkgeld | `berkat_tips` auf `paid`, vom Webhook gesetzt |
| Profil anzeigen | Seite lädt, Kennzahlen und Verkauftes stehen |
| Nachricht | Konversation + `messages`-Zeile, `read: false` |
| Im Chat erwähnen | `@name` landet im Eingabefeld, Sheet schließt |
| Melden | `user_reports`-Zeile, richtiger Grund und Melder |
| Sperren | Zeile geschrieben — belegt dadurch, dass die Zeile danach „Sperre aufheben" zeigt; dieser Text liest `user_blocks` |

Beim Sperren ist das der einzige Nachweis, den es gibt: Wer danach gleich wieder aufhebt,
hinterlässt keine Spur in der Tabelle. Der Beschriftungswechsel ist der Beweis.

Die Sperre wird bewusst **nicht** serverseitig durchgesetzt: Sie ist die Sicht EINES Zuschauers,
die anderen sollen den Verlauf unverändert sehen.

### Trinkgeld ist kein Kauf

`creator_tips` existiert seit April — läuft aber über **Coins**, und die sind in Berkat
ausgeschlossen (E-Geld, siehe Abschnitt 7). Deshalb eine eigene Tabelle `berkat_tips` mit echtem
Geld über denselben Stripe-Weg wie der Sammelkorb.

Keine Sonderzeile in `product_orders`: Dort hängen Versand, Streitfälle und Bewertungen dran, die
für ein Trinkgeld alle sinnlos wären. Betragsgrenzen (1 € bis 500 €) stehen **serverseitig** in
`create_berkat_tip` und zusätzlich als CHECK — ein Betrag ist Geld, und Geld wird nicht im Client
geprüft. Gegengeprüft: Ein direkter INSERT von außen antwortet mit `42501 permission denied`.

Der Zweig in `create-checkout-session` wird nur betreten, wenn `tip_id` im Körper steht; der
bestehende Bestellweg ist unverändert. Bestätigt wird ausschließlich vom Webhook, idempotent über
`status = 'pending'`.

**Am 15.08.2026 komplett durchgelaufen:** Zeile angelegt, Stripe-Sitzung im Sandbox-Modus, Testkarte
bezahlt, und die Zeile sprang auf `paid`. Das ist gleichzeitig der Beweis für den Webhook-Deploy —
den Wechsel macht ausschließlich er. Zwei Fallen dabei, siehe Abschnitt 3
(`stripeKey`-Deklaration und die Sackgasse einer Fehlermeldung für alles).

**Testen ohne zweites Gerät:** Ein Trinkgeld an sich selbst blockt der Server. Über den Direktlink
`berkat://tip/<empfänger-id>` lässt sich der Weg aber vom Simulator aus auslösen, solange der
Empfänger ein anderes Konto ist. Dasselbe gilt für `berkat://messages/<id>`.

⚠️ **Beide Edge Functions brauchten einen Deploy** (`create-checkout-session` und `stripe-webhook`,
letztere zwingend mit `--no-verify-jwt`). Am 15.08.2026 erledigt und gemessen: Der Webhook antwortet
mit **400**, nicht 401 — das JWT-Gate ist also aus.

### Warum die Bewertung zwei Löcher hatte

Die Stern-Kachel wäre ohne zwei Nachträge dauerhaft leer geblieben.

**Sie war für Dritte nicht lesbar.** Siehe Abschnitt 3, „Geerbte Serlo-Tabellen sind enger, als sie
aussehen". Gelöst mit `get_seller_rating`, das nur Schnitt und Anzahl herausgibt.

**Und niemand konnte je bewertet werden.** `submit_order_review` verlangt `status = 'delivered'`,
und keine Berkat-Bestellung erreichte diesen Zustand — `confirm_order_delivered` liegt seit Serlos
Shop auf dem Server, Berkat rief sie nie. Jetzt steht im Konto bei „unterwegs" ein **„Ist
angekommen"**, danach die Sternauswahl (`components/RatingStars.tsx`).

Die Reihenfolge ist keine Bürokratie: Eine Bewertung vor der Lieferung bewertet eine Erwartung,
keinen Verkäufer.

Am 15.08.2026 am echten Datenstand durchgespielt — bestätigt, fünf Sterne vergeben, und der
anonyme Aufruf von `get_seller_rating` liefert `{"rating":5.00,"review_count":1}`, während die
einzelnen Bewertungen für Fremde weiterhin leer bleiben.

---

## 11. Die Kasse (Stand 15.08.2026)

Bis dahin führte der Weg vom Zuschlag zum Geld so: Raum verlassen → Reiter „Konto" suchen →
antippen → **Safari übernimmt den Bildschirm** → zahlen → von Hand in die App zurückfinden. Der
alte Kommentar in `useCheckout.ts` schrieb den letzten Schritt offen hin: „Zurück in die App kommt
man von Hand."

Das ist die teuerste Sekunde, die Berkat hat. Wer dort steht, hat gerade vor Publikum gewonnen.

### Was sich geändert hat

| | vorher | jetzt |
|---|---|---|
| Wo die Kasse aufgeht | Safari, eigene App | Blatt **über** Berkat (`payBrowser.ts`) |
| Weg zurück | App-Umschalter | „Fertig" in der Leiste |
| Wo man bezahlen kann | nur Reiter „Konto" | zusätzlich **am Ende der Show** |
| Fehlermeldung im Sammelkorb | ein Satz für alles | Code, Begründung, sonst der HTTP-Status |

### Warum es KEINEN Bezahl-Knopf neben der laufenden Auktion gibt

Das ist der naheliegende Griff und wäre ein Eigentor. `checkout_auction_cart` **friert den Korb
ein** (`checkout_pending`, Abschnitt 4). Jeder weitere Zuschlag landet danach in einem **neuen**
Korb — wer mitten in der Show bezahlt, zahlt beim nächsten Gewinn ein zweites Mal Versand.

Der Sammelkorb ist genau das, was eine 5-€-Auktion überhaupt erst wirtschaftlich macht, und laut
Ausgangsanalyse einer der sieben Punkte, in denen Berkat besser ist als Whatnot. Ein Knopf, der ihn
mittendrin zerschneidet, gehört nicht in eine laufende Show. **Ist die Show vorbei, kommt aus ihr
auch nichts mehr nach** — deshalb steht er dort und nur dort.

Die Sammelkorb-Leiste im Raum bleibt reine Anzeige. Wer sie „vervollständigt", baut den Fehler ein.

### Fallen dabei

- **`expo-web-browser` ist ein natives Modul.** Ein statischer Import hätte auf jedem älteren Build
  schon beim Laden der Datei geworfen — und Konto-Tab *und* Live-Raum mitgerissen, weil beide die
  Kasse einbinden. Deshalb dieselbe Vorsicht wie bei LiveKit: `require` in `try/catch`, und ohne das
  Modul fällt die Kasse auf den alten Safari-Weg zurück statt auf einen weißen Bildschirm.
- **Nicht `openAuthSessionAsync`.** Das benutzt ASWebAuthenticationSession und stellt beim ersten
  Mal einen System-Dialog davor: „‚Berkat' möchte sich bei ‚stripe.com' anmelden." Vor einer Zahlung
  ist das das falsche Wort zur falschen Zeit. Der Komfort des Selbst-Schließens ist ihn nicht wert.
- **Die Leiste darf nicht einklappen** (`enableBarCollapsing: false`). In ihr sitzt der einzige Weg
  zurück; ein langes Stripe-Formular hätte sie weggescrollt.
- **Nach dem Schließen muss dreimal nachgeladen werden.** Bezahlt wird vom Webhook bestätigt, nicht
  vom Client — zwischen „Blatt zu" und „Korb bezahlt" liegt ein Serverweg. Ein einzelnes Nachladen
  träfe fast immer noch den Stand von vorher, und der Käufer sähe sein eben bezahltes Paket weiter
  als offen. Nur der erste Ruf wird abgewartet, die beiden späteren korrigieren still.
- **Die Fehler-Auswertung lag nur im Trinkgeld.** Die Lehre vom 15.08. („eine Fehlermeldung für
  alles ist keine Fehlermeldung") war nie auf den Sammelkorb übertragen worden — ausgerechnet auf
  den wichtigeren Geldweg. Sie liegt jetzt in `lib/functionError.ts` und wird von beiden benutzt.
- **`pod install` scheitert an der Zeichenkodierung**, wenn die Shell nicht auf UTF-8 steht
  (`Unicode Normalization not appropriate for ASCII-8BIT`). Sieht nach Podfile-Fehler aus, ist aber
  die Umgebung: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` davorsetzen.

### Was geprüft ist — und was nicht

**Geprüft** am 15.08.2026 im Simulator, mit neu gebautem Build: Die Stripe-Seite öffnet als Blatt
über Berkat (`checkout.stripe.com`, „Fertig"-Knopf, Leiste bleibt stehen), und das Schließen führt
**genau auf den Bildschirm von vorher zurück, mit unveränderter Auswahl**. Ausgelöst über den
Trinkgeld-Weg (`berkat://tip/<id>`), der denselben Baustein benutzt. Konto-Tab und Startseite laden
mit dem neuen Modul unverändert.

**Nicht geprüft:** der Bezahl-Knopf auf dem Show-Ende-Bildschirm. Er braucht einen offenen Korb,
also einen echten Zuschlag — und der Server lässt niemanden auf eigene Artikel bieten
(`seller_cannot_bid`). Das geht nur im Zwei-Konten-Durchlauf aus Abschnitt 8. Übersetzt und
gebündelt ist er.

### ⚠️ Zwei Funde aus dem Durchlauf, die nichts mit der Kasse zu tun haben

**1. Klarna steht in der Bezahlseite — und ist laut Ausgangsanalyse eine rote Linie.**
Im Stripe-Checkout stehen als Zahlungsmethoden „Karte, **Klarna**, Amazon Pay, eps". Die Analyse
führt unter B3 **Riba** auf: „Klarna/BNPL/Ratenzahlung mit Zinsen → 🔴 Ausschließen." Für eine App,
deren Verkaufsargument die muslimische Diaspora ist, ist eine Ratenzahlung im Kassenfenster kein
Detail. Das ist **keine Code-Sache** — es hängt an den Zahlungsmethoden im Stripe-Dashboard und ist
dort mit ein paar Klicks abzuschalten. Betrifft auch Serlos Shop, weil beide dieselbe Function
benutzen.

**2. Versand wird nie berechnet.** `checkout_auction_cart` schreibt `amount_eur` als reine Summe der
Zuschläge, und `create-checkout-session` setzt für Berkat **keine `shipping_options`** — Stripe
sammelt nur die Adresse ein. Der Käufer zahlt also exakt den Hammerpreis. Im Live-Raum steht aber
unter jedem Artikel „Versand und Steuern kommen dazu". Entweder ist der Satz falsch, oder der
Versand fehlt im Geldweg. Beides ist vor dem ersten fremden Verkäufer zu klären — bei ihm zahlt es
sonst jemand aus eigener Tasche.

---

## 12. Builds sparen — was wirklich einen Build braucht

Jeder EAS-Build in der Cloud kostet Kontingent. Der größte Hebel ist nicht, sie zu bündeln,
sondern **die meisten gar nicht erst auszulösen**: Der weitaus größte Teil der Arbeit an dieser App
braucht überhaupt keinen Build.

### Die Trennlinie

| Braucht **keinen** Build | Braucht einen Build |
|---|---|
| Jede `.ts`/`.tsx`-Änderung — Bildschirme, Hooks, Texte, Stile, Logik | Neues npm-Paket **mit nativem Anteil** (`expo-web-browser`, LiveKit, `expo-notifications` …) |
| Neue Routen und Komponenten | Änderungen in `app.json`: `plugins`, `permissions`, `infoPlist`, Bundle-ID, Icon, Splash |
| SQL-Migrationen, RPCs, Edge Functions | `google-services.json`, Berechtigungen, Entitlements |
| Alles, was zur Laufzeit geladen wird (Bilder, Lottie, Remote-Config) | Expo-SDK-Wechsel |

In der Entwicklung reicht für die linke Spalte ein Neuladen aus Metro. In Produktion geht sie per
`eas update` raus (OTA) — Details in Abschnitt 8, inklusive der Zwei-Runtimes-Falle.

**Faustregel:** Hat sich `package.json` (nativer Anteil) oder `app.json` nicht geändert, ist ein
Build verschwendet.

### Lokal bauen kostet nichts

Der Simulator-Build läuft vollständig auf dem eigenen Rechner und zieht **kein** EAS-Kontingent:

```bash
cd /Users/zaurhatuev/vibes-app/apps/berkat && npx expo run:ios
```

Läuft schon Metro auf 8081, `--no-bundler` anhängen — sonst weicht ein zweiter Start still auf 8082
aus (Abschnitt 9). Und `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` davorsetzen, falls `pod install` mit
`Unicode Normalization … ASCII-8BIT` abbricht.

Für das **eigene iPhone am Kabel** gilt dasselbe mit `--device`; Xcode verwaltet das Profil selbst,
solange dort ein Apple-Konto angemeldet ist. Einmal ausprobieren — klappt es, ist der Entwickler-
Build auf dem Telefon ab dann kostenlos.

`eas build --local` fährt dasselbe Rezept wie die Cloud auf dem eigenen Mac und zählt ebenfalls
nicht gegen das Kontingent — braucht aber **fastlane** (`brew install fastlane`), das hier fehlt.
Android lokal bräuchte zusätzlich **Java 17+** (installiert ist 1.8) und ein gesetztes
`ANDROID_HOME`; bis dahin bleibt Android der einzige Grund, in die Cloud zu gehen.

### Wenn doch die Cloud: stapeln

Native Änderungen sammeln, statt jede einzeln zu bauen. Dafür steht unten die Warteschlange. Regel:
**Erst bauen, wenn etwas darin steht und man es wirklich auf dem Gerät prüfen muss** — und dann nur
für die Plattform, um die es geht (`--platform ios`, nicht `all`).

### Warteschlange: offene native Änderungen

Nach jedem Build geleert.

- _(leer — der Build vom 15.08.2026 hat `expo-web-browser` mitgenommen)_

---

## 13. Sendeplan — angekündigte Shows (Stand 15.08.2026)

Der Hebel Nr. 1 aus der [Ausgangsanalyse](WHATNOT-ANALYSE.md): *„Whatnots gesamte Retention hängt
an planbaren, wiederkehrenden Shows … was fehlt, ist das Ritual: benannte, wiederkehrende Sendungen
+ Erinnerungs-Push. Kostet fast nichts, verändert alles."* Und § 3.5: *„Die 80 % Monatsretention …
kommen daher, dass donnerstags um 14:30 dieselbe Person dieselbe Show macht."*

Es war zugleich das, was **Phase 0 blockierte**. Phase 0 heißt „5 Verkäufer, **feste Termine**" — und
in Berkat ließ sich ein Termin nirgends ankündigen.

### Fast nichts davon ist neu

Serlo hat den kompletten Apparat seit dem 21.04.2026 (`20260421000000_scheduled_lives.sql`):
Tabelle, vier RPCs, ein pg_cron, der 15 Minuten vorher **alle Follower des Gastgebers**
benachrichtigt, und der Push-Text liegt als `scheduled_live_reminder` bereits im `CASE` von
`fn_send_push_on_notification`. Berkat nutzt `follows` ohnehin — der Empfängerkreis stimmt also ohne
eine einzige neue Tabelle. Angeschlossen statt nachgebaut, nach Abschnitt 4.

Gefehlt hat nur die App-Dimension.

| Was | Wo |
|---|---|
| `scheduled_lives.app` + CHECK + Index | `20260815120000` |
| Erinnerung vererbt die App an `notifications.app` | dieselbe Migration |
| `schedule_berkat_show` als Eingang | dieselbe Migration |
| Serlos vier Lesepfade auf `app='serlo'` gefiltert | `lib/useScheduledLives.ts`, `apps/web/lib/data/live-host.ts` |
| Planer, „Demnächst"-Streifen, Verknüpfung beim Start | `lib/useSchedule.ts`, `components/SchedulePlanner.tsx`, `components/UpcomingStrip.tsx` |

### Entscheidungen, die nicht offensichtlich sind

- **Kein zusätzlicher Parameter an `schedule_live`.** Ein defaultierter Parameter erzeugt in Postgres
  eine **Überladung**, keine geänderte Funktion — und Überladungen machen PostgREST mehrdeutig
  (HTTP 300, bei `publish_due_scheduled_posts` gemessen). Ausgelieferte Serlo-Versionen rufen
  `schedule_live` weiter unverändert. `schedule_berkat_show` wickelt sie ein und erbt damit alle
  Prüfungen: Anmeldung, nicht-leerer Titel, Fenster 5 Minuten bis 30 Tage.
- **Die Erinnerung musste angefasst werden.** Ohne `app` in der `notifications`-Zeile landet die
  Erinnerung an einen Berkat-Auktionsabend auf dem **Serlo-Gerät**. Der bewusste Rückfall aus
  Abschnitt 9 („kein Gerät der Ziel-App gefunden → alle Geräte") greift hier gerade nicht, weil ein
  Serlo-Gerät ja gefunden WIRD.
- **`allow_gifts` steht fest auf `false`.** Geschenke laufen über Coins, und Coins sind in Berkat
  ausgeschlossen (Abschnitt 7). Ein `true` wäre ein Versprechen ohne Oberfläche.
- **Kein „Erinnere mich"-Knopf.** Das wäre ein zweiter Mechanismus neben `follows`. Wer erinnert
  werden will, folgt — und bekommt damit gleich alle weiteren Termine desselben Verkäufers. Der
  Streifen führt deshalb aufs **Verkäufer-Profil**, nicht auf eine Terminseite: Der Folgen-Knopf ist
  die einzige Handlung, die dort etwas bewirkt.
- **Kacheln statt Datums-Wähler.** Ein freier Zeitstempel lädt zu „irgendwann Dienstag halb neun"
  ein; das Ritual ist aber die Wiederholung. Feste Abendplätze (17–22 Uhr) machen sie zur
  Standardeinstellung. Nebenbei spart es einen Build — `@react-native-community/datetimepicker`
  wäre ein natives Modul, zwei Reihen `Pressable` sind es nicht.
- **Der Leerzustand der Startseite ändert sich mit.** Steht ein Termin an, sagt sie nicht mehr
  „schau später wieder rein", sondern verweist nach oben. „Komm später mal wieder, vielleicht" ist
  die falsche Auskunft, wenn es eine Antwort gibt.
- **Beim Start wird verknüpft.** Gibt es einen eigenen Termin im Fenster ±2 Stunden, hängt
  `link_live_session_to_scheduled` ihn an die gestartete Show. Ohne das bliebe die Ankündigung auf
  `scheduled` stehen und liefe in `expired`. Zwei Stunden, weil eine Show selten pünktlich beginnt.
  Schlägt es fehl, wird es nur geloggt — die Show läuft da schon, und ein misslungenes Verknüpfen
  darf den Gastgeber nicht aus seiner eigenen Sendung werfen.

### Geprüft am 15.08.2026, am echten Datenstand

Migration eingespielt und verzeichnet (232 → 233). Drei Rechte-Proben gegen die Live-DB:
`SELECT app` → 200, **`?app=eq.berkat` → 200** (das war die Falle vom 14.08.), `schedule_berkat_show`
ohne Anmeldung → `42501 permission denied`.

Im Simulator durchgespielt: Termin „Heute 20:00" eingetragen → Zeile in der DB mit **`app='berkat'`**
und `18:00Z` (= 20:00 lokal, Zeitzone stimmt) → auf der Startseite steht „Demnächst · berkattest ·
Heute 20:00 · in 4 Std", der Leerzustand verweist darauf, und im Verkaufen-Reiter steht der Termin
mit Absage-Knopf.

**Nicht geprüft:** ob die Erinnerung 15 Minuten vorher tatsächlich auf einem Berkat-Gerät ankommt.
Das braucht einen Follower und einen abgewarteten Termin — der einfachste Weg ist, mit dem zweiten
Konto zu folgen und einen Termin ~20 Minuten in die Zukunft zu legen.

### Wiederkehrende Reihen — nachgezogen am 15.08.2026

Die Analyse sagt nicht „geplante Sendungen", sondern **„benannte, *wiederkehrende* Sendungen"**. Ein
Verkäufer, der jede Woche daran denken muss, vergisst es — und dann bricht das Ritual für alle, die
sich „samstags 20 Uhr" gemerkt haben. Über acht Wochen Phase 0 mit fünf Verkäufern wären das rund
vierzig Einzeleinträge.

Der Planer hat deshalb einen Rhythmus-Umschalter, **„Jede Woche · 4×" ist die Voreinstellung**. Wer
bewusst nur einmal senden will, schaltet auf „Einmal".

- **Vier ist keine Designzahl, sondern die Serverregel.** `schedule_live` lehnt alles über 30 Tage
  ab. Vier Wochen passen im schlechtesten Fall gerade hinein (6 Tage Vorlauf + 21 = 27 Tage), eine
  fünfte nie. Der Hinweistext sagt das offen, statt den Nutzer in die Fehlermeldung laufen zu lassen.
- **Gerechnet wird über den Kalender, nicht über Millisekunden.** `+7 * 86_400_000` verschiebt die
  Uhrzeit um eine Stunde, sobald die Reihe über die Zeitumstellung läuft — aus „20:00" würde Ende
  Oktober lautlos „19:00". `setDate(getDate() + 7)` behält die Wanduhrzeit.
- **Teilerfolg wird ehrlich gemeldet.** Bricht der dritte Eintrag ab, stehen zwei echte Termine —
  die Meldung sagt dann „2 von 4", nicht „eingetragen". Nur wenn gar nichts entsteht, ist es ein
  Fehlschlag mit der echten Servermeldung.
- **Der Streifen fasst eine Reihe zu EINER Karte zusammen** (`nextPerSeries`, Schlüssel ist
  Verkäufer + Titel). Vier gleiche Karten hätten die anderen Verkäufer aus dem Streifen gedrängt.
  Die Anzahl bleibt erhalten und wird zum Abzeichen **„jede Woche"** — und genau das ist das
  Ritual-Signal: nicht „heute um 20:00", sondern „das ist immer so".

**Geprüft am 15.08.2026:** Reihe „Schmuck Samstag" eingetragen → vier Zeilen in der DB
(15.08./22.08./29.08./05.09., je 18:00Z = 20:00 lokal, alle `app='berkat'`) → auf der Startseite
**zwei** Karten statt fünf, die Reihe mit dem Abzeichen, der Einzeltermin ohne.

### Nachtrag am 15.08.2026: die Abendplätze allein waren zu eng

Beim ersten echten Gebrauch sofort aufgefallen: Um 16:49 war **17:00 der einzige wählbare Platz**,
und der lag 11 Minuten entfernt. Wer spontan senden will („ich mach in einer halben Stunde auf"),
hatte keine passende Kachel — und am späten Abend wäre für heute gar keine mehr übrig gewesen. Der
Planer hätte dann genau das verhindert, wozu er da ist.

Zwei Nachbesserungen:

- **Relative Kacheln für heute**: „in 30 Min", „in 1 Std", „in 2 Std", vor den Uhrzeiten. Der
  Zieltermin wird dabei **beim Drücken** neu gerechnet, nicht beim Anzeigen — zwischen beidem können
  Minuten vergehen, und „in 30 Min" muss ab dem Tippen gelten.
- **Vergangene Stunden fallen für heute weg.** Vorher standen um 21:30 alle sechs Abendplätze da,
  fünf davon in der Vergangenheit; man tippte darauf und bekam nur „Dieser Zeitpunkt ist schon
  vorbei". Fällt die gewählte Stunde aus der Liste, rutscht die Auswahl auf die erste noch mögliche.

Eine spontane Sendung ist bewusst **keine Reihe**: Wird eine relative Kachel gewählt, verschwindet
der Wiederholungs-Umschalter, und der Knopf nennt die konkrete Uhrzeit („Für Heute 17:22 eintragen").

### Die Erinnerung ist gelaufen — 15.08.2026, 16:50 Uhr

Nicht simuliert, sondern am echten Betrieb beobachtet: Zwei Termine auf 17:00 sprangen um
**14:50:00 UTC** auf `status='reminded'` mit gesetztem `reminded_at` — der erste 5-Minuten-Takt,
der sie im 15-Minuten-Fenster sah. `amir32` folgt `berkattest`, es entstand also eine echte
Benachrichtigung.

Push-Text: **„🔔 Gleich live — berkattest startet in 15 Min: ‚…'"**.

**Die letzte Meile ist ebenfalls belegt.** Beide Meldungen kamen auf dem iPhone an, gruppiert unter
**Berkat** und mit dem Berkat-Symbol — nicht in Serlo. Der Sendeplan ist damit von der eingetragenen
Kachel bis zum Sperrbildschirm durchgemessen.

Eine Feinheit, die dabei NICHT unterschieden werden kann: ob der `app`-Filter in `send_push_to_user`
gegriffen hat oder der bewusste Rückfall aus Abschnitt 9 („kein Gerät der Ziel-App gefunden → alle
Geräte"). Solange auf dem Telefon kein Serlo-Token liegt, führen beide Wege nach Berkat, und
`push_tokens` ist für einen Client nicht lesbar. Praktisch ist das heute folgenlos — relevant wird
es erst, wenn **beide Apps auf demselben Gerät** installiert sind. Wer das prüfen will, braucht
genau diesen Fall.

### Nachtrag 16.08.2026: das Kärtchen hatte einen Namen und eine Uhrzeit — sonst nichts

Aufgefallen beim Ansehen der Startseite: Der „Demnächst"-Streifen zeigte „berkattest · Fahrrad ·
Morgen 18:00" als reinen Text, und darunter füllte „Gerade ist niemand live" den halben Bildschirm.

Das ist dieselbe Lücke wie bei den Dauerangeboten (Abschnitt 18), nur einen Bildschirm weiter. In
einer laufenden Show hält der Verkäufer den Artikel in die Kamera — das Vorschaubild ist Zugabe.
Eine **Ankündigung** hat keine Kamera, keine Ware und keinen Preis. Und sie steht ausgerechnet
dann da, wenn sonst nichts da ist: Solange niemand sendet — rund 94 % der Zeit — **ist der
Streifen die Startseite**.

Whatnot macht es genauso: Beim Planen füllt ein Verkäufer Titel, **Thumbnail** und Kategorie aus.
Wie zentral das Bild dort ist, sieht man am Drumherum — offizielle Thumbnail-Vorlage, dokumentierte
Safe Zones in der Seller Academy, und gestartet wird die Show später, indem man **auf ihr Thumbnail
tippt**.

**Rückfall statt Zwang.** Wer kein Bild wählt, bekommt das Cover seiner letzten eigenen
öffentlichen Berkat-Show. Dasselbe Muster wie beim Zusteller in den Bestellungen (Abschnitt 18):
Die Vorbelegung kommt aus dem, was der Verkäufer **tatsächlich zuletzt getan hat**, nicht aus einer
Einstellung, die jemand einmal gesetzt hat und die danach veraltet. Kein neuer Speicher, keine
zweite Wahrheit.

Ein Bild-Zwang wäre der falsche Preis: Genau der Verkäufer, der abends schnell einen Termin
einträgt, bricht sonst ab — und ein angekündigter Abend ohne Bild ist immer noch unendlich viel
besser als kein angekündigter Abend.

| Wo | Was |
|---|---|
| `20260816180000` | `scheduled_lives.cover_url`, `schedule_berkat_show` mit `p_cover_url`, Rückfall |
| `20260816190000` | die Frauen-Only-Schranke im Rückfall — Abschnitt 3 |
| `lib/useSchedule.ts` | `cover_url` im Typ **und** in einer geteilten `COLUMNS`-Konstante |
| `components/SchedulePlanner.tsx` | Bild-Wähler links vom Titel, kleine Vorschau in der eigenen Terminliste |
| `components/UpcomingStrip.tsx` | quadratisches Bild zwischen Kopf und Titel |

Entscheidungen, die nicht offensichtlich sind:

- **Der Rückfall läuft auf dem Server, nicht im Client.** Der Client kann nicht besser wissen,
  welche Show die letzte war, und müsste dafür `live_sessions` abfragen. Der Filter auf `app` ist
  dabei nicht kosmetisch: Ohne ihn bekäme jemand, der beide Apps benutzt, das Cover seines letzten
  **Serlo**-Streams auf einen Berkat-Auktionsabend.
- **Eine `COLUMNS`-Konstante statt zwei Zeichenketten.** Am 16.08. war derselbe Fehler schon einmal
  da: `useSellerShows` selektierte `thumbnail_url`, der Zeilentyp trug es nicht, das Bild wurde
  geholt und weggeworfen. Zwei Abfragen, die dieselben Spalten brauchen, dürfen sie nicht zweimal
  buchstabieren.
- **Alle Termine einer Reihe tragen dasselbe Bild.** Es ist derselbe Abend, nur vier Wochen lang.
- **Kein Text über dem Foto.** Die „jede Woche"-Pille hätte gut auf dem Bild gesessen — dann aber
  mit `ui.overlay*`, und das sind die einzigen Stellen in Berkat, an denen Kontrast nachgemessen
  werden muss (Abschnitt 8; seit dem 17.08.2026 zwei). Ohne Text kein Risiko.
- **Ohne Bild bleibt die Karte gleich hoch** und zeigt die Ähre in `ui.lineStrong` auf `ui.sunken`.
  Nachgerechnet: **1,43:1**. Das klingt nach zu wenig, ist aber Absicht — die vorhandene Ähre im
  Leerzustand darunter steht bei **1,12:1**. Kein Platzhalter-Foto: Ein Standardbild für alle sähe
  aus wie ein Fehler, dieselbe Begründung wie bei `profiles.banner_url`.
- **Das Bild steht zwischen Kopf und Titel**, quadratisch — dieselbe Reihenfolge und derselbe
  Zuschnitt wie die Live-Karten darunter. Zwei Bildsprachen auf einer Startseite wären eine zu viel.

**Am Gerät durchgespielt (16.08.2026, 20:12).** Ein Termin ohne Bild angelegt — der Server hat das
Cover der letzten öffentlichen Show eingesetzt, zeichengenau dieselbe URL
(`…/thumbnails/7760a71b…/msvrtggp-jgozzo59.jpg`, Show vom 16.08. 12:23). Auf der Startseite standen
danach beide Zustände nebeneinander: links „Fahrrad" mit der Ähre, rechts der geerbte Cover — der
Unterschied in der Anziehung ist der eigentliche Beleg für dieses Feature. Die Karte erschien ohne
manuelles Nachladen, die Invalidierung greift also. Die Testzeile ist danach wieder abgesagt.

**Was noch fehlt:** Das Verkäufer-Profil zeigt bei angekündigten Shows weiterhin kein Bild —
`useSellerShows` zieht `cover_url` nicht mit und `app/seller/[id].tsx` setzt für `kind: 'announced'`
hart `thumbnail: null`. Keine Regression (dort hatte eine Ankündigung nie ein Bild), aber drei
Zeilen, wenn es jemanden stört.

### Nachtrag 16.08.2026: die Antwort lag hinter dem dritten Reiter

Frage aus dem Gebrauch: „Warum werden die Demnächst-Termine auf dem Profil nicht angezeigt?"

Sie wurden angezeigt. Das Profil öffnet nur **immer** auf dem Reiter „Shop"
(`useState<ProfileTab>('shop')`), und die Termine lagen im dritten. Datenbank, RLS
(`scheduled_lives_select_public`), Abfrage und Darstellung waren alle in Ordnung — nachgeprüft,
Glied für Glied.

Das Ärgerliche war der Weg dorthin: Der Tipp auf eine „Demnächst"-Karte führt aufs Profil
(Abschnitt 13 begründet das mit dem Folgen-Knopf). Man tippte also auf **„Fahrrad · Morgen 18:00"**
und landete auf einer Seite voller **Produkte** — das Einzige, wofür man gekommen war, war das
Einzige, was nicht zu sehen war.

Drei Änderungen, jede an ihrer Ursache:

- **Der nächste Termin steht jetzt ÜBER den Reitern**, im selben Slot wie „sendet gerade" —
  eine Fläche, zwei Zustände, wie bei der Live-Vorschau (Abschnitt 8). Live schlägt Termin: Wer
  jetzt senden kann, wird nicht auf morgen verwiesen. Antippen öffnet den Reiter mit allen
  Terminen. Ruhige Fläche mit der Zeit in Marken-Grün, **nicht** rot und **nicht** gold — rot ist
  in Berkat die laufende Uhr, gold der Kauf, ein Termin ist eine Einladung. Dieselbe Auskunft
  sieht damit auf Startseite und Profil gleich aus.
- **Der Tipp auf eine Termin-Karte bringt den Reiter mit** (`/seller/<id>?tab=shows`). Als
  `useState`-Anfangswert, nicht als Effekt: Ein Effekt hätte den Reiter auch dann zurückgestellt,
  wenn der Besucher inzwischen selbst weitergetippt hat.
- **„Live-Shows" heißt jetzt „Termine & Shows".** Der Reiter zeigt zuerst Angekündigtes und erst
  darunter Gelaufenes; die alte Beschriftung las sich wie ein Archiv.

⚠️ **Zwei Nachladepfade fehlten** und wären beim ersten Ausprobieren aufgefallen:
`usePlanShow` verwarf nach dem Eintragen nur die Startseite und die eigene Terminliste, nicht die
Profil-Abfrage — und `refreshAll` auf dem Profil rührte die Show-Abfragen gar nicht an, obwohl der
Kommentar darüber „ALLES nachladen" verspricht. Beides nachgetragen. Es ist dieselbe Regel wie beim
zurückgezogenen Dauerangebot: **Wer etwas an drei Orten anzeigt, muss an allen drei zurücksetzen.**

### Falle: eine eingespielte Migration ein zweites Mal laufen lassen

`20260816180000` löschte zunächst nur die **alte** Drei-Parameter-Signatur von
`schedule_berkat_show`. Beim zweiten Lauf greift dieser `DROP` ins Leere — die Fassung ist ja weg —
und `CREATE` stolpert über die Vier-Parameter-Fassung, die derselbe Lauf beim ersten Mal angelegt
hat:

```
ERROR: 42723: function "schedule_berkat_show" already exists with same argument types
```

Die Meldung sieht aus wie ein Konflikt, heißt aber „schon erledigt". Beide Migrationen löschen
deshalb jetzt **beide** Signaturen, bevor sie anlegen. Das macht sie wiederholbar und ist zugleich
die Selbstheilung gegen den Fall, dass je zwei Überladungen im Katalog stehen — die wären für
PostgREST mehrdeutig (HTTP 300).

`CLAUDE.md` Regel 7 verlangt `IF NOT EXISTS`; bei Funktionen heißt das: **jede Signatur, die es je
gab, muss im `DROP` stehen.**

---

## 14. Versand (Stand 15.08.2026)

Bis dahin wurde **gar kein Versand berechnet** — `amount_eur` war die reine Summe der Zuschläge,
`shipping_options` gab es nicht, und der Live-Raum versprach trotzdem „Versand und Steuern kommen
dazu". Beides unwahr, und beim ersten fremden Verkäufer ein Streit.

### Das Modell

Eine Pauschale **pro Paket**, nicht pro Artikel — genau dafür gibt es den Sammelkorb. **Pro Zone**,
weil ein Paket nach Zürich real das Doppelte kostet. **Pro Verkäufer mit Plattform-Vorgabe als
Rückfall** (`seller_id IS NULL`), damit ab dem ersten Drittverkäufer nichts umgebaut werden muss.

Startwerte: DE 4,90 € · AT 9,90 € · CH 9,90 €. `free_from_cents` steht bereit, ist aber leer —
„gratis ab X €" ist ein Versprechen, das jemand bezahlen muss.

| Wo | Was |
|---|---|
| `20260815180000` | `berkat_shipping_rates`, `get_cart_shipping_options`, `product_orders.shipping_cents` |
| `20260815190000` | EXECUTE für `service_role` — ohne das wirft die Kasse zur Laufzeit `42501` |
| `create-checkout-session` | `shipping_options` **nur** im Berkat-Zweig (`isAuctionCart`) |
| `stripe-webhook` | `total_details.amount_shipping` → `shipping_cents` |
| `lib/useShipping.ts` | „zzgl. Versand ab 4,90 €" + Prüfung für den Verkäufer |

**Versand wird bewusst NICHT in `amount_eur` gerechnet.** Bei Stripe Connect bekommt der Verkäufer
die Ware und der Versand wird anders verrechnet — wer beides addiert, pflückt es in Phase 2 wieder
auseinander.

### ⚠️ Die Zone ist nicht erzwingbar

**Stripe Checkout kann Versandoptionen nicht ans Lieferland binden.** Der Käufer wählt frei, Stripe
sammelt die Adresse getrennt ein. Im allerersten echten Durchlauf sofort aufgetreten: zwei
Bestellungen mit `shipping_cents = 990` bei `ship_country = 'DE'`.

Der häufigere Fall ist **kein Betrug, sondern ein Versehen** — jemand tippt auf die erste
angebotene Option. Deshalb wird nichts blockiert, sondern in „Bestellungen" sichtbar gemacht, wenn
der gezahlte Versand **unter** dem Satz für das Lieferland liegt. Überzahlung wird nicht gemeldet:
Sie kostet den Verkäufer nichts.

Erzwingen ließe es sich nur mit einer eigenen Bezahlmaske statt Stripe Checkout — das gehört zu
Stripe Connect und damit in Phase 2.

### Falle: die Idempotenz-Sperre

`create-checkout-session` benutzt `Idempotency-Key: product-order-<id>`. Stripe merkt sich eine
Sitzung damit **24 Stunden**. Eine Bestellung, die schon vor dem Deploy einmal eine Kassen-Sitzung
hatte, bekommt die **alte ohne Versandoptionen** zurück. Beim Testen also einen frischen Korb
nehmen, sonst sucht man den Fehler im Code, wo keiner ist.

### Falle: der tote Rückweg auf der Erfolgsseite

`bezahlt.html` hatte einen Knopf „Zurück zu Berkat" (`<a href="berkat://">`). Seit die Kasse als
Blatt über der App läuft (Abschnitt 11), ist der **tot**: Eigene Schemata öffnet ein
SFSafariViewController nicht. Er sah aus wie der Weg zurück und tat nichts — unmittelbar nachdem
jemand bezahlt hat.

Jetzt steht dort die Handlung, die wirklich funktioniert: „Tipp oben links auf **Fertig**". Der
Deeplink bleibt als kleine Zeile für den Browser-Fall und zeigt auf `berkat://account`. Wer die
Kasse je wieder in Safari öffnet, muss diesen Text zurückdrehen.

### Geprüft am 15.08.2026, am echten Geld-Weg

Zwei-Konten-Durchlauf: Zuschlag 1 € → bezahlt mit `4242 4242 4242 4242` → in der Datenbank steht
`amount_eur 1.00`, **`shipping_cents 490`**, `status paid`, `ship_country DE`. Die Kasse zeigte die
drei Zonen als Auswahl, „zzgl. Versand ab 4,90 €" steht im Live-Raum, und die Bestellliste des
Verkäufers rendert mit der neuen Prüfung.

**Nicht geprüft:** der Unterdeckungs-Hinweis selbst — dafür müsste jemand die DE-Pauschale zahlen
und in die Schweiz liefern lassen.

---

## 15. Bürgen — Vertrauen mit Namen (Stand 15.08.2026)

Die [Ausgangsanalyse](WHATNOT-ANALYSE.md) führt am Ende **sieben Stellen** auf, an denen Berkat
besser sein kann als Whatnot. Sechs waren gebaut. Die erste stand nur auf dem Papier:

> „Vertrauen statt Sterne — Bürgen und Verkaufszahl direkt unter dem Namen. Whatnot zeigt ‚5,0 ★' in
> Winzschrift; in deiner Community entscheidet, **wer** für jemanden bürgt."

Und § B5: *„Vertrauen ist personal, nicht institutionell. Ein 5-Sterne-Durchschnitt bedeutet weniger
als ‚mein Cousin kennt ihn.' … etwas, das Whatnot strukturell nicht bauen kann."*

### Die Entwurfsentscheidungen — sozial, nicht technisch

- **Namen, keine Zahl.** Nirgends steht „3 Bürgen". Die Reihenfolge IST die Aussage: erst die, denen
  der Betrachter selbst folgt (`du folgst`-Pille), danach die, die hier am meisten gehandelt haben.
  Eine reine Anzahl wäre wieder ein Sterne-Durchschnitt unter anderem Namen.
- **Keine Hürde vorm Bürgen.** Ein Filter „nur wer schon gekauft hat" wäre ausgerechnet am Anfang
  tot — also genau dann, wenn die ersten Verkäufer Vertrauen brauchen. Stattdessen steht neben jedem
  Namen, was er selbst wiegt: „2 Käufe · 4 Zuschläge" oder ausdrücklich **„Neu hier"**. Damit
  gewichtet der Leser, nicht die Datenbank.
- **Öffentlich und zurechenbar.** Ein anonymer Bürge ist wertlos. Wer bürgt, steht mit Namen da und
  trägt das Risiko, sich zu blamieren — das ist der Mechanismus, nicht die Tabellenzeile.
- **Jederzeit widerrufbar.** Vertrauen kann enden.
- **Der Satz ist kurz** (3–140 Zeichen, freiwillig). Das Gewicht liegt auf dem Namen; ein langes Feld
  lädt zu Werbung ein.

### Wo es liegt

| | |
|---|---|
| `20260815200000` | `berkat_vouches` (unique je Paar, kein Selbst-Bürgen), `get_vouch_weights` |
| `lib/useVouch.ts` | Liste + Sortierung + Aktionen; `vouchSummary()` für eine Zeile |
| `components/VouchPanel.tsx` | die Ansicht |
| `app/seller/[id].tsx` | eingehängt **unter** den Kacheln, **über** „Zuletzt verkauft" |

`get_vouch_weights` ist `SECURITY DEFINER` und nur für `authenticated`: `product_orders` und
`live_auctions` sind für Dritte zu Recht gesperrt (Adressen, Beträge), herausgegeben werden
ausschließlich zwei Zähler. Ohne Konto bleiben die Gewichte deshalb leer — der **Name** ist ohnehin
das Signal, und bieten kann man ohne Konto nicht.

### Geprüft am 15.08.2026

Vom Simulator (`berkattest`) auf amir32s Profil: Leerzustand → „Ich bürge für ihn" → Satz eingegeben
→ Eintrag erscheint mit **„2 Käufe · 4 Zuschläge"** und dem Satz, Knopf springt auf „Bürgschaft
zurückziehen", Rückmeldung „Danke — dein Name steht jetzt bei ihm."

### Die Zeile im Live-Raum

`vouchSummary()` hängt seit dem 15.08.2026 im `SellerSheet`, direkt unter den drei Zahlen und über
den sechs Zeilen — erst die Institution, dann die Menschen. Antippen führt aufs Profil, wo die
vollständige Liste steht.

Hellgrün statt Gold ist Absicht: Gold ist auf der Bühne der **Kauf** (Gebot, Preis, Zuschlag), und
eine Bürgschaft ist kein Kaufknopf.

Das Sheet bleibt dumm — die Zeile kommt fertig als Prop aus `app/live/[id].tsx`. So läuft die
Abfrage einmal je Live-Raum statt bei jedem Öffnen des Sheets.

**Am 15.08.2026 im Zwei-Konten-Durchlauf gesehen:** `amir32` bürgte für `berkattest`, danach stand
im Sheet der laufenden Show **„amir32 bürgt — du folgst ihm"** — unter den drei Kacheln, über
„Profil anzeigen". Die Formulierung ist personalisiert, nicht gezählt.

⚠️ **Falle beim Prüfen:** Das iPhone hing noch am alten Bündel, weil der Mac zwischendurch vom
iPhone-Hotspot (`172.20.10.2`) zurück ins WLAN (`192.168.178.60`) gewechselt war. Neuer Code kommt
dann nicht an, und man sucht ihn im Quelltext statt im Netz. Die aktuelle Adresse liefert
`ipconfig getifaddr en0`; im Dev-Client den passenden Eintrag wählen.

---

## 16. Fehlerüberwachung (Stand 15.08.2026)

Berkat hatte **keine**. Serlo meldet seit Monaten an Sentry, Berkat an niemanden — eine App, die
Geld bewegt, meldete keinen einzigen Absturz. Hängt bei einem Verkäufer die Kasse, erfährt man es
nur, wenn er anruft. In Phase 0 ist das nicht bezahlbar: Fünf Händler, die man mühsam überzeugt hat,
ruft man kein zweites Mal an.

### Entscheidungen

**Dasselbe Sentry-Projekt wie Serlo**, getrennt über `environment: 'berkat'` und den Tag
`app: berkat`. Ein eigenes Projekt wäre sauberer, braucht aber einen Sentry-Zugang — und derselbe
fehlende Zugang hat am selben Tag beim Stripe-Konto einen halben Nachmittag gekostet. Die DSN steht
in Serlos `eas.json` und ist damit ohne Anmeldung verfügbar. Ein eigenes Projekt ist später eine
Umgebungsvariable.

**Abstürze sind nicht der Punkt.** Der Wert liegt bei den **abgefangenen** Fehlern: Eine Kasse, die
sich nicht öffnet, stürzt nicht ab — sie zeigt eine freundliche Meldung, und der Käufer geht.
`reportProblem()` meldet deshalb an drei Stellen des Geldwegs (`kasse.sammelkorb`,
`kasse.korb-abschluss`, `kasse.trinkgeld`) mit Status, Code und Stripes Begründung. Ohne Beträge,
ohne Adressen, ohne Nutzer-IDs — was hier landet, verlässt das eigene Haus.

**Nur außerhalb der Entwicklung** (`enabled: !__DEV__`). Im Entwicklungslauf steht jeder Fehler
ohnehin in Metro; was ankommen soll, sind Fehler auf **fremden** Geräten. Die DSN steht deshalb nur
in den Profilen `preview` und `production`, nicht in `development`.

### Zwei Fallen, beide beim Bauen aufgetreten

⚠️ **Die Import-Reihenfolge im Wurzel-Layout ist tragend.** `lib/livekit` meldet LiveKit als
**Nebenwirkung seines Imports** an, und ES-Importe laufen alle, bevor die erste Zeile im Rumpf
ausgeführt wird. Ein `initErrorReporting()` im Rumpf käme also immer zu spät. Deshalb startet
`lib/report` die Überwachung beim Import — und der Import steht **vor** dem von `livekit`. Wer die
zwei Zeilen tauscht, verliert alle Abstürze aus der Video-Schicht.

⚠️ **Auch der AUFRUF muss abgesichert sein, nicht nur das Laden.** Das JS-Paket lässt sich
einbinden, während das native Gegenstück im Build fehlt — dann wirft erst `init()`, und zwar beim
Start, vor jedem Rendern. Ein Absturz ausgerechnet in der Fehlerüberwachung. `load()`, `init()` und
beide Melde-Wege liegen deshalb in `try/catch`.

### Stand

Auf dem aktuellen Entwickler-Build läuft die App unverändert (geprüft) und meldet **nichts** — beides
richtig so. Scharf wird es mit dem nächsten `preview`- oder `production`-Build; `@sentry/react-native`
ist nativ und braucht ihn ohnehin.

In Sentry filtert man danach über `environment:berkat` beziehungsweise den Tag `app:berkat`.

---

## 17. Dauerangebote — kaufbar ohne Show (Stand 16.08.2026)

Bis dahin hing **alles** an einer Live-Sendung. Fünf Verkäufer mit je zwei Stunden pro Woche senden
zusammen 10 von 168 Stunden: Die App ist rund **94 % der Zeit ein leerer Raum**. Der Sendeplan
(Abschnitt 13) beantwortet „wann passiert wieder was" — nicht „was kann ich JETZT tun".

Whatnot löst das mit zwei Regalen: **Profile Shop** (jederzeit kaufbar) und **Live Shop** (für eine
Show reserviert). Der Schalter heißt dort „Reserve for Live".

### Ein Listing-Typ, zwei Regale

Genau Hebel 4 der Ausgangsanalyse. Ein Dauerangebot ist **keine neue Tabelle**, sondern eine
`live_auctions`-Zeile **ohne Session** mit Status `listed`. Damit erbt es ohne eine Zeile
Zusatzarbeit: Sammelkorb, Versandpauschale, Stripe-Kasse, Webhook, Zuschlag-Benachrichtigung und
Verkäufer-Bestellliste.

| Wo | Was |
|---|---|
| `20260815210000` | `session_id` nullable, Status `listed`, Regal-Invariante, zweite Lese-Policy, `create_standing_listing`, `cancel_standing_listing` |
| `lib/useStanding.ts` | Liste, Anlegen, Zurückziehen, Kaufen |
| `components/StandingComposer.tsx` | „Dauerhaft anbieten" im Verkaufen-Reiter — **unabhängig von einer laufenden Show**, das ist der Zweck |
| `components/StandingShelf.tsx` | „Jetzt kaufbar" auf dem Verkäufer-Profil, über „Zuletzt verkauft" |

### ⚠️ Die Falle, die den Entwurf bestimmt hat

`live_auctions_select` prüft `EXISTS (SELECT 1 FROM live_sessions WHERE s.id =
live_auctions.session_id …)`. Bei `session_id IS NULL` ist das **FALSE** — ein Dauerangebot wäre
für niemanden sichtbar, ohne Fehlermeldung.

Es brauchte also eine **zweite** Lese-Policy. Der Kommentar an der ersten warnt ausdrücklich vor
`USING(true)`: Postgres verknüpft permissive Policies mit ODER, und eine schrankenlose hebelt die
Frauen-Only-Grenze aus (Fehler vom 16.07.2026). Weil ein Dauerangebot keine Session hat, aus der es
`women_only` erben könnte, trägt es die Kennzeichnung **selbst** — und nur geprüfte Frauen dürfen
sie setzen, serverseitig geprüft.

### Zwei Entwurfsdetails mit Grund

- **`start_price_cents` bleibt 100.** Kein Kunstgriff: Wandert der Artikel später doch in eine Show,
  startet er bei 1 € — genau das Ritual, das die Analyse „die zentrale Erfindung" nennt. Der
  Festpreis muss deshalb darüber liegen, was die bestehende Spalten-Prüfung ohnehin verlangt.
- **Kein Bild-Zwang.** Wer abends schnell drei Sachen einstellt, bricht sonst nach dem ersten ab.

### Nebenbefund: der Sofortkauf hatte nie einen Aufrufer

`buy_now_live_auction` existiert serverseitig seit dem 13.08. — und wurde **im Client nirgends
aufgerufen**. `onBuyNow` ist als Prop an `AuctionPanel`/`BidButton` vorgesehen, wird in
`app/live/[id].tsx` aber nie übergeben. Der Sofortkauf-Preis lässt sich im Studio eintragen und war
für Käufer nie erreichbar. Der Dauerangebot-Kauf ist der erste Aufrufer dieser RPC.

### Geprüft am 16.08.2026

Migration eingespielt. Drei Rechte-Proben: Dauerangebote lesbar (200 statt 42501), `women_only`
filterbar, `create_standing_listing` ohne Anmeldung → 401. Im Simulator angelegt und in der
Datenbank bestätigt: `status='listed'`, `session_id=null`, `buy_now_cents=2400`,
`start_price_cents=100`. Das Regal zeigt „Jetzt kaufbar · 1" mit Zurückziehen-Knopf.

**Der Kauf ist am 16.08.2026 gelaufen.** Vom Konto `zaur` aus auf `berkattest`s Profil gekauft:
`status='sold'`, `current_bid_cents=2400` (voller Preis), `winner_id` gesetzt, und ein Sammelkorb
angelegt. Damit ist belegt, was der Entwurf behauptet — der Kauf eines Dauerangebots läuft durch
DENSELBEN Korb wie ein Zuschlag aus der Show.

Zugleich der **allererste Aufruf von `buy_now_live_auction`** überhaupt; die Funktion lag seit dem
13.08. ungenutzt im Server.

### Was bewusst fehlt

- **Verschieben zwischen den Regalen.** Whatnots „Reserve for Live" wäre ein UPDATE auf
  `session_id` mit eigenen Prüfungen. Später.
- **Eigener Benachrichtigungstext.** Wer ein Dauerangebot kauft, bekommt „🎉 Zuschlag — du hast
  gewonnen!". Für einen Festpreis schief, gilt aber schon heute für den Sofortkauf.

### Nachtrag 16.08.2026: die Suche fand niemanden

Beim ersten Gebrauch der Dauerangebote sofort aufgefallen: Das Suchfeld heißt „Show oder Verkäufer
suchen", filterte aber nur die **bereits geladenen Live-Shows** im Speicher —

```js
return shows.filter((show) => …)
```

Ist niemand live, ist `shows` leer, und die Suche findet **grundsätzlich nichts**. Damit war ein
Verkäufer ohne laufende Sendung überhaupt nicht auffindbar — und die Dauerangebote, deren einziger
Zugang das Verkäufer-Profil ist, für Fremde unerreichbar. Ein Feature, das ohne das andere wertlos
gewesen wäre.

`search_berkat_sellers` (`20260816090000`) fragt jetzt den **Server** nach Menschen.

- **Keine offene Suche über `profiles`.** Das ist Serlos Tabelle mit den Nutzern beider Apps; eine
  Namenssuche darauf würde Berkats Suchfeld mit Serlo-Konten fluten. Gesucht wird unter denen, die
  in Berkat etwas getan haben: ein Angebot eingestellt, etwas verkauft oder eine Show gehalten.
- **Mindestens zwei Zeichen.** Ein einzelner Buchstabe wäre ein Durchlauf über alle Nutzer beider
  Apps, und das Ergebnis ohnehin unbrauchbar.
- **300 ms Entprellung** im Client — sonst liefe je Tastendruck eine Abfrage.
- Sortiert nach „hat gerade etwas im Regal", dann nach Zuschlägen.
- Der Leerzustand des Rasters ändert sich mit: Werden Verkäufer gefunden, steht dort **„Keine
  laufende Show — aber die Verkäufer oben"** statt „Nichts gefunden".

**Geprüft am 16.08.2026:** „Berkat" findet `berkattest` mit „1 kaufbar · 4 Zuschläge",
Groß-/Kleinschreibung egal.

**Bewusst nicht mitgesucht:** Artikelnamen. Dafür braucht es erst genug Angebote — und ein Suchfeld,
das Verkäufer und Artikel mischt, muss beides sortieren können.

---

## 18. Fünf Reiter, Kategorien, Einladungen, Profil (Stand 16.08.2026)

Der Tag, an dem die Regel „nichts bauen, was leer wäre" mehrfach gekippt wurde — und zwar zu
Recht. Zaur: *„Nichts weglassen, alles bauen, auch wenn die Seite leer ist."*

### Fünf Reiter statt drei

`Startseite · Kategorien · Verkaufen · Aktivität · Konto`. Die alte Begründung im Layout
(„ein Reiter, der auf eine leere Seite führt, sieht billiger aus als einer, der fehlt") galt
nur, solange beide wirklich leer gewesen wären. Sind sie nicht:

- **Kategorien** lebt von den Dauerangeboten. Die liegen rund um die Uhr da, während eine Show
  94 % der Zeit nicht läuft — der Reiter ist also gerade dann voll, wenn die Startseite leer ist.
- **Aktivität** lebt von Folgen, eigenen Geboten und Belohnungen. Nichts davon erzeugt einen
  Push, alles davon will man wiederfinden. Sechs Quellen, eine nach Zeit sortierte Liste.

Der Kopf der Startseite trägt jetzt **zwei** Knöpfe: Posteingang und Glocke. Sie sehen gleich
aus, sind aber nicht dasselbe — links steht, was ein MENSCH geschrieben hat, rechts, was
BERKAT gemeldet hat.

### Kategorien: die Leiste war eine Attrappe

`lib/useStudio.ts` schrieb bei jeder Show `category: 'shopping'` fest ein. Die Kategorie-Leiste
auf der Startseite filterte seit dem 13.08. also über **genau einen Wert**. Migration
`20260816120000` setzt die 20 alten Berkat-Zeilen auf NULL zurück.

Der Baum hat **zwei Ebenen** (`20260816150000`): 12 Ober-, 61 Unterkategorien. Eine flache
Liste zwingt in eine Entscheidung, die es nicht gibt — wenige grobe Kacheln (niemand findet
etwas) oder achtzig feine (niemand scrollt so weit).

⚠️ **Ein Trigger verbietet die dritte Ebene.** Der Zähl-Aufruf rollt Kinder genau eine Stufe
auf ihr Elternteil; ein Enkel wäre in jeder Zahl und jeder Kachel unsichtbar, ohne dass es
auffiele.

**Whatnots Liste wurde bewusst NICHT übernommen** — Sportkarten, Trading Card Games, Comics,
NASCAR-Pins, Nachlassverkäufe sind ein amerikanischer Sammlermarkt. Der Baum hier kommt aus dem,
was diese Community handelt: Abaya, Hijab, Oud & Bakhoor, Gold, Gebetsteppiche. Weiterhin
ausgeschlossen (Analyse A8): Elektro/Batterien, Lebensmittel, Alkohol.

**Die Kachel zeigt Zuschauer, nicht Shows** — „1901 Zuschauer" liest sich als *hier ist was
los*, „2 Shows" liest sich als leer. Ist nichts live, fällt sie auf „12 kaufbar" zurück; ist
gar nichts da, steht **nichts** da statt einer toten Null. Whatnot kann diesen Rückfall
strukturell nicht, die haben kein Dauerregal je Kategorie.

### Einladungen — und warum der Käufer-Bonus ab Werk AUS ist

Zwei Seiten, weil Berkat zwei verschiedene Knappheiten hat:

| Du bringst | Belohnung | Kostet heute |
|---|---|---|
| einen **Käufer** | 1× Gratis-Versand | 4,83 € je Einlösung |
| einen **Verkäufer** | 30 Tage provisionsfrei für beide | **0 €** (es gibt keine Provision) |

Die Rechnung, die den Entwurf bestimmt hat (Sätze aus `STRATEGIE-VERKAEUFER-UND-GELD.md`):
Eine Gutschrift kostet nicht die 1,40 € Deckungsbeitrag, sondern **4,83 €** — die Pauschale
fällt weg und das Porto fällt trotzdem an. **Die Verlustschwelle liegt bei 6,64 € Warenwert**,
und genau darunter liegt der wahrscheinlichste Fall: Ein Neuer löst den Code ein und testet
mit EINEM Artikel für 1 €.

Deshalb steht `berkat_reward_policy.buyer_rewards_enabled` auf **false**, dazu
`min_cart_cents = 1500`, `inviter_reward_after = 3`, `monthly_cap = 3`. Einladungen werden
trotzdem von Tag eins an verzeichnet — genau daraus entsteht die Zahl, die vor dem Anschalten
fehlt. Die beiden Abfragen dafür stehen am Ende der Migration.

⚠️ **Vor Phase 2 neu bepreisen oder abschalten.** Mit Drittverkäufern gibt es keine Warenmarge
mehr, nur Provision — 8 % von 15 € = 1,20 € gegen eine 4,90-€-Gutschrift. Der Käufer-Bonus
funktioniert **nur, solange Zaur selbst der Verkäufer ist**.

**Kein neuer Meldungstyp dafür.** Ein Typ in `notifications` bräuchte neun Oberflächen auf
einmal (Abschnitt 9); wer nur einen Teil anfasst, bekommt „Neue Aktivität auf Serlo". Eine
Belohnung ist nicht eilig — sie steht im Aktivitäts-Reiter.

### Das Profil hatte keine Tür

Der teuerste Fund des Tages, und kein Fehler im Code: **Acht Stellen springen auf
`/seller/<id>`, keine einzige mit der eigenen ID.** Das eigene Regal, die eigenen Bürgen und
die eigene Bio waren damit unerreichbar. Bei Whatnot IST der Konto-Reiter das Profil; hier
führt er jetzt hin (Avatar-Zeile antippen).

Dazu, alles am Whatnot-Profil abgeglichen:

- **Reiter Shop · Bewertungen · Live-Shows.** Bürgen und Kacheln stehen ÜBER den Reitern — für
  diese Community ist das der Teil, der entscheidet. „Clips" fehlt: Berkat hat kein Replay.
- **Bewertungstexte** (`20260816160000`). Zwei Schranken: nur Berkat-Bestellungen (Serlos Texte
  werden durch eine Berkat-Änderung nicht neu öffentlich) und **Frauen-Only bleibt zu** — ob
  eine Verkäuferin WOZ sendet, ist öffentlich, wer bei ihr kauft, nicht. Im Schnitt zählen sie
  weiter mit, denn ein Durchschnitt nennt keinen Namen.
- **Es gab nie einen Text zum Anzeigen.** `order_reviews.comment` existiert, `submit_order_review`
  nimmt `p_comment`, `useOrderReview` reicht es durch — nur fragte die Oberfläche nie danach.
  Der Stern öffnet jetzt ein Blatt mit freiwilligem Textfeld.
- **Follower-Zahl**, **Nachricht + Trinkgeld** (existierten seit dem 15.08., waren aber nur im
  Live-Raum-Sheet erreichbar — also genau dann nicht, wenn niemand sendet), **Teilen**,
  **Drei-Punkte-Menü** mit Sperren/Melden (`useSellerActions` hatte alles, RLS trägt es ohne RPC).
- **Kopfbild, Anzeigename, aufklappbare Bio.** `display_name` existierte längst; die Behauptung
  „Spalte fehlt, Serlo-weit" war falsch. `banner_url` ist neu — mit `GRANT SELECT`, siehe die
  Warnung in Abschnitt 3.

### Zwei Fehler, die an einem Tag zweimal derselbe waren

**Ein zurückgezogenes Dauerangebot blieb im Kategorien-Reiter stehen**, und ein Tipp darauf
führte auf ein Profil, auf dem es nicht mehr war. Die Datenbank war die ganze Zeit richtig
(`status = 'cancelled'`). Zwei Ursachen: `cancel` setzte nur `['berkat','standing']` zurück,
nicht die Kategorie-Abfragen — und die Kategorie-Seite lud beim Zurückkommen nicht nach.

Daraus die Regel: **Expo Router hält nicht nur REITER aufgebaut, sondern auch STACK-Bildschirme.**
Abschnitt 3 beschreibt die Falle nur für Reiter; sie gilt eine Ebene tiefer genauso. Und: Wer
etwas an drei Orten anzeigt, muss an allen drei zurücksetzen — deshalb liegt das jetzt in EINER
Funktion in `lib/useStanding.ts` statt an jeder Aufrufstelle einzeln.

### Ein Dauerangebot konnte nie ein Foto haben

Beim Ausprobieren am Gerät aufgefallen, weil der Bild-Wähler oben im
Verkaufen-Reiter zur SHOW gehört und es aussah, als müsse man ihn auch fürs Regal
benutzen. Die eigentliche Ursache war eine Lücke: `create_standing_listing` nimmt
seit dem 15.08. ein `p_image_url`, `lib/useStanding.ts` reicht es durch — und
`StandingComposer` hatte **kein einziges Bild-Vorkommen**. Jedes Dauerangebot
blieb ein graues Feld, auf dem Profil wie im Kategorien-Reiter.

Das war genau verkehrt herum gedacht. In einer Show hält der Verkäufer den
Artikel **in die Kamera** — das Vorschaubild ist Zugabe. Ein Dauerangebot hat
keine Kamera; dort **ist** das Foto die ganze Auslage. Der einzige Ort ohne
Bild-Wähler war der, an dem er am meisten zählt.

Behoben: eigener Wähler im `StandingComposer`, links vom Titel und damit in
derselben Anordnung wie „Artikel auflegen" darüber — das nimmt der Verwechslung
gleich die Grundlage. Weiterhin **kein Zwang**, nur ein Hinweis: Wer abends
schnell drei Sachen einstellt, bricht sonst nach dem ersten ab.

### Der Verkaufen-Reiter machte vier Jobs auf einem Scroll

977 Zeilen, und darin: Show-Regie, Sendeplan, Regal und Bestellungen. Beim
Ausprobieren am Gerät sofort als unübersichtlich gemeldet.

Der teuerste Teil war nicht die Länge, sondern **wo der einzige Job mit einer
Frist lag**: ganz unten. Die Meldung „Bezahlt — bitte packen" führte auf
`/(tabs)/sell`, also an den Anfang — der Verkäufer landete im Show-Formular und
musste an zwei Formularen und dem Regal vorbeiscrollen. Seine durchschnittliche
**Versandzeit ist eine der drei Kacheln auf seinem öffentlichen Profil**; jede
Minute Sucherei zahlt er dort in Vertrauen.

**Warum KEINE Tabs innerhalb des Reiters**, obwohl das die naheliegende Idee war:

- Unten liegen bereits fünf Reiter, das Profil hat seit heute eigene Tabs. Eine
  dritte Ebene macht aus der App eine Tab-Sammlung.
- Die vier Jobs sind keine Geschwister. Sobald gesendet wird, gibt es nur noch
  einen — die anderen sind dann nicht „ein Tab weiter", sondern irrelevant.
- **Ein Push kann auf einen BILDSCHIRM springen, nicht auf einen Tab-Zustand
  darin.** Das war das ausschlaggebende Argument.

Stattdessen: `app/orders.tsx` und `app/shelf.tsx` als eigene Bildschirme, im
Reiter nur noch zwei Zeilen mit Zahlen. Dazu ein **Abzeichen an der unteren
Leiste**, wenn Bestellungen auf `paid` stehen (`useOpenOrderCount`, `head: true`,
überträgt keine Zeile) — und `order_paid`/`new_order` zeigen jetzt auf
`/orders`.

Das Abzeichen zählt bewusst NUR `paid`: Ein Abzeichen, das nie auf null geht,
liest bald niemand mehr. Und es ist gold statt rot — rot ist in Berkat die
laufende Uhr (live, überboten), eine wartende Bestellung ist eine andere Art
von dringend.

### Nachtrag: die Kategorie-Leiste zeigte Slugs

Selbst eingebaut und beim Nachsehen gefunden. `live_sessions.category` trug bis
zum 16.08. immer die Konstante `'shopping'`; die Leiste auf der Startseite nahm
diesen Wert direkt als Anzeigename UND als Filterschlüssel — was funktionierte,
solange beides dasselbe war.

Mit der gepflegten Liste stehen dort **Slugs**. Die Leiste hätte „beauty" und
„buecher" angezeigt statt „Beauty & Duft" und „Bücher & Medien", und dasselbe
unter jeder Show-Karte.

`RailItem` trennt jetzt `slug` (Schlüssel) von `name` (Anzeige), und die
Startseite übersetzt über `useCategoryOptions`. Der Sentinel für „keine
Kategorie" ist von `'Für dich'` auf `'__all__'` gewechselt — die
Spalten-Prüfung auf `berkat_categories.slug` verlangt
`^[a-z][a-z0-9-]{1,30}$`, eine Kollision ist damit ausgeschlossen.

**Merksatz:** Sobald ein Wert eine gepflegte Liste bekommt, hört er auf, sein
eigener Anzeigename zu sein. Wer beides in einem Feld führt, merkt den Bruch
erst, wenn die Liste da ist.

### Nachtrag: Artikelbilder überall, wo es sie gibt

Die Bilder lagen die ganze Zeit an `live_auctions.image_url` — sie wurden nur
an fünf Stellen nicht mitgeholt. Eine Bestellung trägt lediglich eine
Zusammenfassung („3 Artikel aus der Live-Show"); was drin liegt, weiß nur der
Sammelkorb.

| Wo | vorher | jetzt |
|---|---|---|
| Konto → Gekauft | Wortliste `· Titel` | Reihe mit Vorschaubild |
| Konto → Deine Pakete | nur „2 Artikel · 1 Paket" | Bilderstreifen (max. 6, dann „+n") |
| Bestellungen (Verkäufer) | nur Titel und Adresse | jeder Artikel mit Bild — **wer packt, braucht das** |
| Aktivität | Avatar des Verkäufers | Artikelbild, wo es eines gibt |
| Verkaufen → Verkauft | nur Text | Vorschaubild wie in der Warteschlange darüber |

Zwei Entscheidungen dabei:

- **In der Aktivität steht das Artikelbild VOR dem Avatar.** Bei einem Zuschlag
  erkennt man die Sache, nicht den Menschen — der Name steht ohnehin darunter.
  Bei „sendet gerade" gibt es kein Artikelbild, dort bleibt der Avatar richtig:
  Da IST der Mensch das Ereignis.
- **Artikelbilder sind eckig, Avatare rund.** Der Formunterschied trägt die
  Bedeutung, ohne dass ein Wort nötig wäre.

`useSellerOrders` holte bis dahin nicht einmal die `cart_id` — ohne sie war der
Weg zu den Artikeln gar nicht erst offen.

### Nachtrag: gelaufene Shows ohne Bild und ohne Uhrzeit

Beides selbst eingebaut, beide Ursachen verschieden — und die Datenbank war an
keiner beteiligt (`thumbnail_url` gesetzt, `started_at` gesetzt).

**Das Bild wurde geholt und weggeworfen.** `useSellerShows` selektiert
`thumbnail_url` von Anfang an, aber der Zeilentyp im Profil trug das Feld nicht
— es kam nie in der Liste an. Eine gelaufene Show stand als grauer Kreis mit
Funkturm-Symbol da, obwohl ihr Cover vorlag.

**Die Zeitangabe war nur für die Zukunft gebaut.** `showWhen` prüfte
`days >= 0 && days < 7` und fiel für alles andere auf ein blankes Datum ohne
Uhrzeit zurück. Eine Show von heute 12:23 stand damit als „16.08.26" da — also
mit der einzigen Angabe, die man ohnehin weiß, und ohne die, die man sucht.

Die neue Fassung rechnet in **Kalendertagen statt Millisekunden**: „heute
12:23", „gestern 23:02", „Mi 20:00", sonst „01.08. · 14:00". Der Unterschied
ist nicht kosmetisch — `(a - b) / 86_400_000` beantwortet „wie viele
24-Stunden-Blöcke liegen dazwischen", nicht „welcher Tag ist das". Eine Show
von gestern 23:00 wäre um 08:00 morgens sonst „heute". Dieselbe Unterscheidung
wie bei den wiederkehrenden Terminen in Abschnitt 13.

Gegengeprüft an sieben echten Zeitstempeln aus der Live-DB.

### Bildgrößen: die Regel, die vorher fehlte

Frage aus dem Gebrauch: „Warum sind die Bilder bei Whatnot größer?" Nachgemessen
— in Berkat existierten genau ZWEI Größen: volle Breite (1:1) an zwei Stellen
und 34–76 px Listen-Vorschau überall sonst.

Whatnot benutzt **auch** kleine Vorschaubilder (~44 px in der aufgeklappten
Unterkategorien-Liste). Der Unterschied ist nicht die Größe, sondern die
Zuordnung:

> **Das Bild ist so groß wie die Frage, die der Bildschirm beantwortet.**
> „Was soll ich mir ansehen?" (stöbern) → das Bild IST der Inhalt.
> „Welches davon meine ich?" (arbeiten) → das Bild ist nur Wiedererkennung.

Auf Whatnots Kategorie-Kachel füllt die Illustration rund 60 % der Fläche; bei
uns waren es 19 px Icon in einer 104-px-Kachel, also ~3 %.

Drei Flächen lagen danach falsch und sind umgestellt:

| Fläche | vorher | jetzt |
|---|---|---|
| Kategorie-Seite | 60-px-Zeilen | zweispaltiges Raster, quadratisch |
| Profil → Shop | 52-px-Zeilen | Raster (`StandingShelf layout="grid"`) |
| Kategorie-Kacheln | 19-px-Icon | **echtes Produktbild**, Kachel 104 → 152 px |

Richtig klein bleiben: Bestellungen (36), Konto (34/44), Aktivität (38),
Warteschlange im Studio (44). Das sind Arbeitsflächen — dort ist ein großes
Bild im Weg. `StandingShelf` trägt deshalb ein `layout`-Prop: Profil `grid`,
`/shelf` (eigenes Regal verwalten) `list`.

**Die Kategorie-Kachel: Zwischenstand mit Absicht.** Kurzzeitig stand dort das
neueste Produktfoto der Kategorie (`useCategoryPreviews`). Das ist wieder raus —
Zaur erzeugt **eigene 3D-Bilder je Kategorie**, und ein echtes Foto neben einem
Rendering hätte zwei Bildsprachen auf derselben Fläche gemischt.

Der Aufbau steht trotzdem schon richtig, damit der Tausch später nur eine Stelle
ist: **Name oben, Bildfläche (`tileArt`) darunter, Zahl unten** — dieselbe
Anordnung wie bei Whatnot. Vorerst trägt die Bildfläche das Symbol groß (44 px);
kommen die Renderings, wird nur ihr Inhalt getauscht, Kachelgröße und Raster
bleiben.

Der Aufklapp-Pfeil ist raus (Zaurs Entscheidung). Dass eine Kachel aufklappt,
zeigt sich jetzt nur noch dadurch, DASS sie aufklappt — plus die goldene Fläche
im offenen Zustand.

### Bestellungen: das Zusteller-Feld erzeugte tote Verfolgungs-Links

Der wichtigste Fund beim Umbau der Bestell-Ansicht, und er war unsichtbar:
Das Zusteller-Feld war ein **freies Textfeld** mit Vorgabe „DHL".
`trackingUrl` in `lib/useSellerOrders.ts` kennt aber genau sechs Schreibweisen
(DHL, DHL Express, Hermes, DPD, GLS, UPS). Wer „Deutsche Post", „Post AT" oder
auch nur eine andere Schreibung eintippt, erzeugt beim KÄUFER einen Eintrag
**ohne Verfolgungs-Link** — ohne Fehlermeldung, ohne dass es jemandem auffällt.

Jetzt eine Auswahl aus genau den sechs. Wer die Liste erweitert, muss
`trackingUrl` mit erweitern — sonst ist der neue Eintrag wieder ein toter Link.
Das steht als Warnung an der Konstante.

Dazu, weil vier gleich große Karten mit Adressblock und leerem
Sendungsnummer-Feld eine Wand waren:

- **Nach Zustand gruppiert.** „Zu packen" oben und offen, alles Erledigte
  darunter als eine Zeile je Bestellung.
- **Der Käufername steht im Kopf**, nicht der Bestelltitel — der ist bei einem
  Sammelkorb ohnehin nur „3 Artikel aus der Live-Show", und die Artikel stehen
  mit Bild direkt darunter.
- **Wie lange der Käufer wartet** („vor 3 Std"). Nicht Höflichkeit: Die
  durchschnittliche Versandzeit ist eine Kachel auf dem öffentlichen Profil.
- **Die Adresse ist `selectable`.** Sie muss in ein Versandportal übertragen
  werden; langes Antippen markiert sie. Kostet nichts und braucht kein
  Zwischenablage-Modul — das wäre nativ und damit ein neuer Build.
- **Ohne Sendungsnummer kein Versand-Knopf.** `shipped` ohne Nummer wäre eine
  Behauptung ohne Beleg, und der Käufer bekäme eine Meldung ohne Inhalt.
- Der grüne Balken „N warten aufs Packen" ist raus — die Zahl steht jetzt in
  der Überschrift und am Reiter-Abzeichen. Dreimal ist Lärm.

### Gemessen: größere Bilder kosten nichts

Frage aus dem Gebrauch: „Wird die App langsamer bei größeren Bildern?" Die
Vermutung war, dass unkomprimierte Handyfotos hochgeladen werden. **Gemessen,
und die Vermutung war falsch:**

```
Pafürm  246 KB · Parfüm 16€  286 KB · Einzelstück  307 KB · Parfüm ab 9,90 €  326 KB
```

`pickImage` schneidet mit `allowsEditing` zu und komprimiert auf `quality:
0.85` — die Dateien liegen bei 250–330 KB. Entscheidend ist ohnehin etwas
anderes: **Die Anzeigegröße ändert am Download gar nichts.** Dieselbe Datei
wird geladen, ob sie in 36 oder 200 px gezeichnet wird; größer kostet nur etwas
Decode und GPU-Speicher, bei diesen Größen nicht messbar. Die Kategorie-Seite
mit bis zu 60 Artikeln virtualisiert über `FlatList`.

**Ein Resize beim Hochladen ist also NICHT nötig** und stünde sonst in der
Warteschlange in Abschnitt 12 (`expo-image-manipulator` wäre nativ).

### Whatnot hat die Versand-Oberfläche gar nicht

Sie **erzeugen das Etikett selbst**. Der Verkäufer tippt weder Zusteller noch
Sendungsnummer — die Verfolgung hängt automatisch dran und steht unter
„Shipments" im Seller Hub. Eigene Etiketten (BYOL) sind die Ausnahme, nur für
freigegebene Verkäufer, und die Nummer trägt man dann **nur auf der Website**
ein.

Der Vergleich trägt an dieser Stelle also nicht: Berkat ist zwangsläufig in der
BYOL-Welt, weil es keine Etiketten verkauft. Es gibt hier nichts abzuschauen —
sondern etwas zu erfinden.

**Erfunden:** Der Zusteller ist mit dem vorbelegt, mit dem dieser Verkäufer
ZULETZT versendet hat (aus `orders`, kein neuer Speicher). Ein Verkäufer nutzt
fast immer denselben; ihn bei jeder Bestellung neu wählen zu lassen war die
eigentliche Zumutung, nicht die Form des Widgets. Eine gespeicherte Einstellung
bräuchte AsyncStorage (nativ, neuer Build) und wäre sogar schlechter: Die Daten
spiegeln, was er TATSÄCHLICH tut, nicht was er einmal eingestellt hat.

### Verfeinerung der Bildgrößen-Regel

Die Regel „stöbern → groß, arbeiten → klein" war zu grob. Beim **Packen** ist
die Arbeit selbst visuell: Man vergleicht das Bild mit einem Gegenstand auf dem
Tisch. Genauer also:

> **Ist das Bild die Auskunft — oder nur die Wiedererkennung?**

Bestellliste im Konto („wo ist mein Zeug") → Wiedererkennung, klein.
Packliste („welches Ding nehme ich in die Hand") → Auskunft, **56 px**.
Dieselbe Bestellung unter „Erledigt" → wieder Wiedererkennung, 36 px.

### Erstnutzung für Verkäufer — „Deine ersten Schritte"

Das erste Stück Arbeit, das direkt auf **Phase 0** einzahlt statt daneben.

Wer als Verkäufer geworben wurde und auf „Verkaufen" tippt, sah bisher ein
Formular und sonst nichts — kein Hinweis, was zuerst dran ist. Bei fünf Leuten,
die man einzeln überzeugt hat, entscheidet genau das, ob sie ein ZWEITES Mal
senden.

Eine Karte ganz oben mit vier Schritten, **und die Reihenfolge ist der Rat**:

1. **Profil ausfüllen** — die ersten Zuschauer sehen nach, wer da sendet. Ein
   leeres Profil kostet Vertrauen, das die Show erst mühsam wieder aufbaut.
2. **Termin ankündigen** — Hebel Nr. 1 der Analyse. Löst die Erinnerung an alle
   Follower aus; ohne Ankündigung sendet man vor leerem Raum.
3. **Etwas ins Regal legen** — was jemand bei dir tun kann, wenn du NICHT
   sendest, also 94 % der Zeit.
4. **Erste Show machen** — zuletzt, weil eine Show mit leerem Profil und ohne
   Ankündigung eine verschenkte Show ist.

**Alle vier Zustände kommen aus Daten, die es ohnehin gibt** — kein
Fortschritts-Feld, keine Tabelle, nichts zum Zurücksetzen. Damit kann die Liste
nicht mit der Wirklichkeit auseinanderlaufen.

**Kein Mahner:** Die Karte verschwindet restlos, sobald alle vier stehen — ohne
Abschluss-Feier. Das Design-Gesetz verlangt Maßhalten; gefeiert werden Peaks
(erster Zuschlag, erster Verkauf), nicht das Ausfüllen einer Liste. Kein Streak,
kein Countdown, keine Erinnerung.

### `router.back()` war an dreizehn Stellen unsicher

Am Gerät gemeldet: Auf dem Meldungs-Bildschirm tat der Zurück-Pfeil nichts,
darunter die Warnung `The action 'GO_BACK' was not handled by any navigator`.

`router.back()` setzt einen Eintrag im Verlauf voraus — und der ist hier nicht
garantiert. Der strukturelle Grund: Ein Tipp auf eine Meldung springt teilweise
auf **Reiter-Routen** (`/(tabs)/account`, `/(tabs)/sell`). Expo Router legt
dafür keinen neuen Eintrag an, sondern wechselt zum vorhandenen
Reiter-Bildschirm — der Stapel darüber verschwindet. Wer die Meldungen danach
erneut öffnet, steht auf dem untersten Eintrag, und `back()` hat kein Ziel.

Dasselbe trifft jeden Direktlink (`berkat://tip/<id>`), später jeden Push, der
eine Seite kalt öffnet, und jeden App-Neustart auf einer tiefen Route.

`lib/nav.ts` → `goBack(fallback)` fragt `router.canGoBack()` und setzt sonst auf
einen **nahegelegenen** Ort zurück, nicht pauschal auf die Startseite: aus den
Bestellungen in den Verkaufen-Reiter, aus der Bestell-Detailseite ins Konto, aus
einer Kategorie in den Kategorien-Reiter. `replace` statt `push` — sonst bläht
sich der Verlauf auf, bis „zurück" durch Bildschirme führt, die man nie besucht
hat.

Umgestellt sind alle zehn Kopf-Pfeile. Die vier `router.back()`-Aufrufe in
`login.tsx` und `live/[id].tsx` stehen in Ablauflogik und sind **nicht**
angefasst — dort ist der Verlauf durch den jeweiligen Fluss garantiert.

### Am Gerät bestätigt (16.08.2026 abends)

Im Simulator durchgegangen und von Zaur bestätigt:

- **Kategorien** — Aufklappen, und der Rollup stimmt: „Beauty & Duft · 1 kaufbar" zählte ein Kind
  mit, das unter „Parfüm Damen" lag.
- **Profil** — Kopfbild hochgeladen und gerendert, Anzeigename „Parfueme" über `berkattest`,
  Bio, „2 Follower · 2 Gefolgt", die drei Reiter, Bearbeiten-Blatt.
- **Verkäufer-Bereich** — Bestellungen als eigener Bildschirm, Reiter-Abzeichen mit der Zahl der
  offenen Bestellungen.
- **„Deine ersten Schritte"** — stand korrekt auf „3 von 4" (Profil ✓, Regal ✓, Show ✓, Termin
  offen), und die Karte verschwindet vollständig, sobald der vierte Schritt steht.
- **Der Zurück-Pfeil** — auch über die Kette Meldung antippen → landen → zurück → Meldungen →
  zurück, die vorher hängenblieb.

### Was ungeprüft bleibt

- **Der Bewertungen-Reiter ist zwangsläufig leer** — es gibt noch keinen einzigen Text. Der Weg
  dahin braucht zwei Konten: kaufen → versenden → „Ist angekommen" → Sterne → Text.
- **Die Frauen-Only-Schranke bei den Bewertungen** — die Gegenprobe steht am Ende von
  `20260816160000`.
- **Der Käufer-Bonus** wurde nie scharf geschaltet, also nie durchlaufen.
- **Drei Bildschirme hat noch niemand geöffnet:** `/order/[id]` (Bestell-Detail), `/shelf` (eigenes
  Regal) und `/rewards` (Einladungen).

### ~~Ein Ärgernis fürs Protokoll~~ — die Beunruhigung war unbegründet (21.08.2026)

Hier stand: *„`npx expo export` wählt den Einstiegspunkt nicht deterministisch: mal `index.ts`
(3938 Module), mal `expo-router/entry.js` (3671). Der Unterschied sind die ~270 Module des
LiveKit-`registerGlobals`-Blocks, den nur `index.ts` lädt — und `index.ts` ist laut `package.json`
der richtige Einstieg."*

**Beide Hälften des Satzes sind falsch.** Am 21.08.2026 beim Store-Build nachgesehen:

- `package.json` nennt als `main` **`expo-router/entry`**, nicht `index.ts`.
- **`index.ts` existiert gar nicht.** Es gibt keinen zweiten Einstieg, also auch keine
  Nichtdeterminiertheit.
- Der LiveKit-Block hängt nicht an einem Einstiegspunkt, sondern an `app/_layout.tsx`: Zeile 14
  importiert `../lib/report`, Zeile 15 `../lib/livekit`, und `lib/livekit.ts` setzt den
  `DOMException`-Ersatz (Zeile 16–23) vor `registerGlobals()` (Zeile 32–33). Genau die
  Reihenfolge, die Abschnitt 16 verlangt.

Gegengeprüft am fertigen Produktions-Bündel: `DOMException` kommt elfmal darin vor,
`registerGlobals` viermal. **Es war nie etwas verloren.**

> **Die Lehre:** Eine offene Frage im Übergabedokument („Ursache ungeklärt") altert schlechter als
> ein Fehler — sie sieht Jahre später noch nach einem Risiko aus, das jemand prüfen müsste. Diese
> hier hat mich am 21.08. einen Absatz Beunruhigung gekostet, bevor drei Befehle sie erledigten.
> **Wer eine Frage offen lässt, schreibt dazu, womit man sie beantwortet.**

---

## 19. Die erste echte Sendung (16.08.2026, abends)

Zwanzig Minuten, in denen Zaur vom iPhone gesendet und ich vom Simulator aus mitgeboten habe.
Der Ertrag ist größer als jede Woche Bauen davor — nicht wegen des Codes, sondern weil **sechs
Dinge zum ersten Mal wirklich passiert sind** statt nur zu existieren.

### Was damit belegt ist

| | Beleg |
|---|---|
| **Echtes Video** | Bild kam an, im Raum und im kleinen Fenster. Der Simulator hat keine Kamera — das ging vorher grundsätzlich nicht |
| **Anti-Snipe unter echtem Gegendruck** | dreimal ausgelöst: „Verlängert — jemand hat kurz vor Schluss geboten", Uhr sprang zurück auf 00:05 |
| **Live-Vorschau, alle drei Zustände** | „Läuft aktuell", „Als Nächstes", und endlich **„Verkauft"** in Rot |
| **Zuschauerzahl** | sprang auf 1, `join_live_session` greift |
| **Zuschlag-Push** | Glocke ging auf 6 |
| **Gewinnspiel** | Teilnahme bestätigt („Du bist dabei") |

⚠️ **Der Zustand „Verkauft" ist im Normalbetrieb fast unerreichbar.** Die Vorrangregel lautet
*läuft → nächster geplanter → gerade zugeschlagen*. Solange auch nur ein Artikel in der
Warteschlange steht, gewinnt „Als Nächstes". Er erschien erst, als die Warteschlange leer war.
Das ist kein Fehler, aber es heißt: Der Zustand, der am meisten Schwung zeigt („Verkauft für
12 €"), ist der, den fast niemand sieht. Wer ihn nach vorne holen will, muss die Reihenfolge
ändern — bewusst und mit dem Wissen, dass „Als Nächstes" dafür verschwindet.

### Fund 1: Der Sammelkorb blieb stumm, während man gewinnt

Drei Artikel gewonnen, und die Sammelkorb-Leiste im Raum erschien nicht. Die Datenbank war die
ganze Zeit richtig; erst nach Verlassen und Neubetreten stand „3 Artikel · 1 Paket · noch 23 h"
da.

Ursache: `useCart` hatte **weder `refetchInterval` noch eine Invalidierung**. Das Einzige, was die
Abfrage je verwarf, war der Bezahlvorgang (`payBrowser.ts`). In einem Bildschirm, der eine Stunde
offen steht, feuert davon nichts.

Das trifft genau den Moment, den Abschnitt 11 „die teuerste Sekunde, die Berkat hat" nennt.

Behoben über das **bestehende** Realtime-Abo auf `live_auctions` — und ausdrücklich **nur bei
`sold`**. Ein Gebot verändert den Korb nicht; eine Show mit zwanzig Artikeln erzeugte sonst
hunderte überflüssige Abfragen. Gegenprobe am Gerät: 3 Artikel → vierter Zuschlag → Leiste sprang
auf 4, ohne den Raum zu verlassen.

### Fund 2: Ein Gebot war ein Tipper — mit einem Pfeil darauf, der Ziehen versprach

Zaurs Beobachtung an der Whatnot-App: Dort ist der Gebots-Knopf eine **Ziehbahn**, damit niemand
versehentlich bietet.

Bei uns trug der Knopf seit dem 13.08. ein `»`-Symbol und hörte trotzdem nur auf ein Antippen.
Die Form versprach eine Geste, die es nicht gab — und ein Gebot ist eine bindende
Willenserklärung über echtes Geld. Der Knopf sitzt am unteren Rand, wo der Daumen beim Halten
ohnehin liegt, und **darüber läuft ein Video, auf das man tippt, um ein Herz zu schicken**. Ein
Bildschirm, auf dem Tippen die normale Geste ist, darf keinen Kauf mit demselben Tippen auslösen.

Jetzt 60 % des Weges ziehen. Weniger wäre wieder versehentlich auslösbar, mehr fühlt sich nach
Arbeit an — und in den letzten Sekunden zählt jede Zehntelsekunde.

- **Kein neues Paket, kein Build.** `PanResponder` und `Animated` kommen aus React Native selbst.
  `react-native-gesture-handler` liegt zwar in der `package.json`, wird aber **nirgends benutzt**
  und bräuchte einen `GestureHandlerRootView` im Wurzel-Layout; Reanimated hat Berkat gar nicht.
- **Die Geste greift erst ab vier Punkten waagerechter Bewegung.** Ohne das schluckt der Griff
  jedes Antippen, und ein senkrechtes Wischen darüber erreicht die Liste nicht mehr — dieselbe
  Familie wie die Berührungs-Ebenen in Abschnitt 3.
- **Für VoiceOver bleibt es ein Tippen** (`onAccessibilityTap`). Eine Wischgeste ist dort
  feindlich, und wer den Bildschirm nicht sieht, tippt nicht versehentlich auf eine Stelle, die er
  nicht kennt.

**In zwei Auktionen belegt:** Ziehen bietet („Du führst · 1 €"). Drei feste Tipper auf Griff,
Mitte und rechtes Ende **während einer laufenden Auktion** erzeugen **kein** Gebot — die Abfrage
direkt danach zeigte die Auktion noch als `running`, `current_bid_cents` weiter `null` und
`live_bids` leer.

⚠️ **Offen: Wie es sich bei einem Bieterkampf anfühlt.** Wenn zwei Leute in zwanzig Sekunden
fünfmal überbieten, ist fünfmal Ziehen zäh. Eine Möglichkeit wäre „einmal ziehen, danach tippen" —
der Schutz gilt dem *ersten*, unbeabsichtigten Gebot, und wer bereits bewusst gezogen hat, ist
erkennbar dabei. Bewusst **nicht** vorab gebaut: erst fühlen, dann optimieren.

### Was die Sendung über Whatnot beantwortet hat

Ein Tipp auf die **Zuschauerzahl** öffnet bei Whatnot eine Liste — aber nur für Gastgeber,
Co-Hosts und Moderatoren, mit den Reitern „Watching" und „Activity". Normale Zuschauer sehen
darin **nur ihre Freunde**, nicht alle Anwesenden.

Bei Berkat ist die Pille (`app/live/[id].tsx`) heute ein reines `<View>` ohne Funktion. Die
Serverseite steht dagegen vollständig und mit **exakt derselben Regel**:

```sql
lsv_select_host  -- der Gastgeber darf die Liste lesen
lsv_select_self  -- jeder darf seine eigene Zeile lesen
```

`leave_live_session` löscht die Zeile wieder, ein Trigger räumt beim Sendungsende auf — die
Tabelle ist also „wer schaut gerade", nicht „wer war mal da". Eine Zuschauerliste wäre damit
**eine Abfrage und ein Blatt, ohne Migration**.

⚠️ **Die Zuschauer-Sicht darf es trotzdem nicht geben.** Jede für Zuschauer sichtbare
Teilnehmerliste öffnet das Loch wieder, das am 14.08. mit `live_reactions_rls` geschlossen wurde —
bei einer Frauen-Only-Sendung wäre sie ein Verrat am Kernversprechen. Und wer die App abwürgt,
statt den Raum zu verlassen, hinterlässt eine Zeile; die Liste zeigt dann jemanden, der längst weg
ist (dieselbe Familie wie die Zombie-Sessions).

### Die Lehre, die über diesen Abend hinausgeht

Beide Funde waren **im Simulator allein nicht auffindbar**. Der eine brauchte eine Kamera, der
andere zwei Konten und eine Uhr, die wirklich läuft. Zwei Wochen Bauen haben sie nicht gezeigt,
zwanzig Minuten Senden schon.

**Vor jeder weiteren größeren Änderung am Live-Weg gehört eine echte Sendung** — nicht als
Abnahme, sondern als Fehlersuche.

---

## 20. Marktplatz — Privat- und Gewerbeverkäufer nebeneinander (17.08.2026)

Zaur: *„Ich will auf meiner Plattform nicht nur Gewerbetreibende, sondern auch private Leute
verkaufen lassen. So wie Kleinanzeigen und Amazon."* Und: *„Ich verkaufe nicht mehr — wir planen
hier eine Plattform."*

Beides zusammen ändert die Ausgangslage: Berkat ist ab sofort **von Tag eins ein Marktplatz mit
fremden Verkäufern**, nicht ein Shop, der später einer wird.

### Warum die Trennung privat/gewerblich keine Produktentscheidung ist

Ein Privatverkauf hat **kein Widerrufsrecht**, und die Gewährleistung ist ausschließbar. Ein
gewerblicher hat beides, dazu Impressumspflicht. **Art. 246d § 1 EGBGB verlangt, dass der Käufer
das VOR seiner Vertragserklärung erfährt** — also muss die App es wissen und an jedem Angebot
zeigen.

### Der erste Entwurf wurde verworfen — von drei Skeptikern

Der Bauplan entstand über acht Agenten in drei Stufen (Bestand, Recht, Vorbilder, Technik →
Entwurf → drei Skeptiker). **Alle drei Skeptiker haben ihn abgelehnt.** Die Funde waren es wert:

- **Der Plan hätte den einzigen funktionierenden Kaufweg abgeschaltet.** `checkout_enabled` mit
  Vorgabe `false`, ohne Backfill, als Riegel vor `buy_now_live_auction` — ab dem Einspielen wäre
  kein Dauerangebot mehr kaufbar gewesen, auch nicht die, die am 16.08. mit einem echten Kauf
  belegt wurden.
- **Die ZAG-Grenze war an einem von vier Geldwegen gezogen.** Live-Zuschlag, Sofortkauf in der
  Show und Trinkgeld hätten sie umgangen.
- **`seller_kind` hätte den Hauptverkaufsweg nie erreicht** — Show-Artikel entstehen über
  `create_live_auction`, die der Plan nicht anfasste.
- **Der vorformulierte Gewährleistungsausschluss wäre unwirksam gewesen** (siehe unten).
- **Umfang:** Die Shop-Seite existierte halb schon, und in der Datenbank lagen zwei Angebote —
  Filter und Suchindizes dafür sind Arbeit am falschen Ende.

**Die Lehre: Ein Riegel mit Vorgabe `false` und ohne Backfill ist kein Riegel, sondern ein
Ausfall.** In der gebauten Fassung heißt „keine Zeile" deshalb **wie bisher**, nicht „gesperrt";
nur eine Zeile, die ausdrücklich `false` sagt, schrankt.

### Was gebaut wurde

| Wo | Was |
|---|---|
| `20260816200000` | `berkat_sellers` (Anbietertyp, Impressumsangaben, `checkout_enabled`), `live_auctions.seller_kind`, `set_berkat_seller_kind` |
| `20260816210000` | Beschreibung, Zustand, PLZ, Ort; `create_standing_listing` neu; zwei Lücken in `buy_now_live_auction` |
| `20260816220000` | die Vorgabe „privat" wird auch gespeichert (siehe Abschnitt 3) — **eingespielt 17.08.2026** |
| `lib/useBerkatSeller.ts` | Typ lesen und erklären, die sechs Zustände, der Satz fürs Angebot |
| `lib/useShop.ts` + `app/shop.tsx` | alles Kaufbare über alle Verkäufer, ohne Filter |
| `lib/uploadImage.ts` | **die Kamera** |

### ⚠️ Eine eigene Tabelle, nicht Spalten auf `profiles`

`profiles` trägt seit `20260814240000` eine eingefrorene Spaltenliste. Jedes Rechtsfeld dort wäre
dieselbe Falle wie `banner_url` am 16.08. — und Serlo erbte alles mit.

`berkat_sellers` ist **offen lesbar**, und das ist hier ausnahmsweise richtig: Bei einem
gewerblichen Verkäufer sind Name und Anschrift **gesetzlich öffentlich** (Impressum), bei einem
privaten steht außer `kind` nichts drin. Die Felder sind bewusst so geschnitten, dass eine offene
Lese-Policy korrekt ist. Geschrieben wird nur über die RPC — sonst könnte sich jeder
`checkout_enabled` selbst erteilen und damit die ZAG-Schranke aufheben.

### Kontakt statt Kasse

Ein Privatverkäufer kann ohne Stripe Connect **gar kein Geld** über die Plattform bekommen: Läuft
es über das Konto des Betreibers, ist das nach ZAG erlaubnispflichtig. Sein Angebot bekommt
deshalb **„Nachricht" statt „Kaufen"**, und der Erstkontakt startet mit Kleinanzeigens
meistgetipptem Satz — mit dem Artikelnamen darin, damit der Verkäufer ohne Rückfrage weiß, worum
es geht.

Der Knopf ist bewusst **nicht gold**: Gold ist in Berkat der Kaufweg (Gebot, Preis, Zuschlag), ein
„schreib ihm mal" ist eine ruhige Handlung.

### ⚠️ Warum Berkat KEINEN Gewährleistungsausschluss stellt

Ein von der Plattform vorformulierter Standardsatz ist eine **AGB im Sinne der §§ 305 ff. BGB** —
auch zwischen Privatleuten. Ein pauschaler Ausschluss erfasst in kundenfeindlichster Auslegung
auch Körperschäden und grobe Fahrlässigkeit und ist damit nach **§ 309 Nr. 7 BGB unwirksam**; eine
geltungserhaltende Reduktion gibt es nicht, der Ausschluss fiele **vollständig** weg.

Der Privatverkäufer, dem Berkat „hilft", stünde damit schlechter da als ohne uns. Deshalb
kennzeichnet die App nur, WER verkauft, und sagt, was daraus folgt. Den Text stellt der Verkäufer.

### Zwei Lücken, die dabei auffielen

**`buy_now_live_auction` prüfte `women_only` nicht.** Die Funktion ist `SECURITY DEFINER`, liest
mit `SELECT * … FOR UPDATE` und umgeht damit RLS — geprüft wurden Preis, Status und Verkäufer, die
Kennzeichnung nie. Heute unerreichbar, weil UUIDs nur über den gefilterten Lesepfad kommen; sobald
Artikel-Links geteilt werden, wäre jeder Frauen-Only-Artikel mit dem Link kaufbar gewesen. Der
Wächter meldet bewusst **„gibt es nicht"** statt „keine Berechtigung", damit die Existenz nicht
durch die Fehlermeldung sickert.

⚠️ **Der Rumpf ist im Übrigen wörtlich der alte.** Beim ersten Anlauf hatte ich ihn neu
geschrieben und dabei `buy_now_gone`, den Eintrag in `live_bids`, `bid_count`, `ends_at` und den
jsonb-Rückgabewert verloren — der geänderte Rückgabetyp allein hätte die Migration scheitern
lassen, weil Postgres ihn per `CREATE OR REPLACE` nicht ändert. Genau die Stelle, an der laut
CLAUDE.md schon einmal spätere Änderungen verlorengingen. **Wer hier etwas ändert, legt vorher das
Original daneben.**

### Die Kamera — der teuerste fehlende Schritt

`pickImage` rief bis dahin ausschließlich die Mediathek auf: Man konnte ein vorhandenes Foto
wählen, aber **keines machen**. Für jemanden, der heute in einer WhatsApp-Gruppe verkauft, ist das
der erste Handgriff überhaupt. Kein neuer Build nötig — `NSCameraUsageDescription` steht wegen
LiveKit ohnehin in der `app.json`.

### Was bewusst NICHT gebaut wurde

- **Kein Stripe Connect, keine Provisionsabrechnung.** Erst wenn der erste fremde Verkäufer da ist.
- **Keine Umkreissuche, keine Karte, kein GPS.** PostGIS und earthdistance sind nicht installiert,
  `expo-location` fehlt. PLZ und Ort stehen an der Zeile — eine Präfix-Suche lässt sich später
  ohne Datenwanderung durch echte Koordinaten ersetzen.
- **Keine Filter, keine Volltextsuche auf der Shop-Seite.** Es gibt zwei Angebote.
- **Keine Abholung.** Sie bräche `get_cart_shipping_options`, die Stripe-Adressabfrage und
  `mark_order_shipped`. Für Privatverkäufer ist sie trotzdem der wahrscheinlich größere Hebel als
  die Umkreissuche — der nächste Kandidat.
- **Keine DAC7-Zählung.** Ohne Geldfluss über die Plattform entsteht bei einem Privatverkäufer
  keine Vergütung, die Berkat kennt. Kommt mit Connect.

### Was als Nächstes fehlt

1. ~~`20260816220000` einspielen~~ — **erledigt am 17.08.2026.** `supabase db push` trug genau
   diese eine Datei nach (davor keine Lücke, danach 30/30). Die zwei `NOTICE …does not exist,
   skipping` beim Lauf sind erwartet: Die beiden Altsignaturen hatte `20260816210000` schon
   entfernt, und die Datei löscht bewusst **alle drei**, damit sie wiederholbar bleibt.
2. Den Weg von vorne am Gerät durchspielen: Typ erklären, Angebot mit Zustand und Ort einstellen,
   Kennzeichnung in Regal, Kategorie-Seite und Shop-Seite sehen.
3. **Ein zweites Konto als Privatverkäufer**, damit „Nachricht" statt „Kaufen" überhaupt sichtbar
   wird — an eigenen Angeboten erscheint immer „Zurückziehen".
4. ~~Die Impressumsangaben gewerblicher Verkäufer haben noch keine Oberfläche~~ — der
   **Hinweis-Streifen am Angebot ist am 17.08.2026 gebaut** (Abschnitt 21). Das Formular im Konto
   fehlt weiterhin.

---

## 21. Jedes Angebot hat eine eigene Seite (17.08.2026)

Zaur: *„Die Umsetzung des Kleinanzeigen-Shops ist nicht gut. Denk dir eine bessere Struktur aus,
und jedes Produkt muss eine eigene Seite haben."*

Der Befund war schlimmer als die Beschwerde. Ein Marktplatz ohne Artikelseite ist kein Marktplatz
mit einem fehlenden Bildschirm — er ist ein Schaufenster ohne Laden dahinter.

### Was nicht stimmte

**1. Es gab keine Artikelseite, und der Code behauptete, es gäbe eine.** Der Kommentar in
`StandingShelf.tsx` schrieb wörtlich: *„…er hat nur andere Rechte, und das steht ausführlich auf
der Artikelseite."* Jeder Tipp auf ein Angebot führte auf `/seller/<id>`, also aufs Profil des
Verkäufers. Man tippte auf „Silberring" und landete auf einer Seite voller anderer Produkte —
derselbe Fehler wie bei den Terminen in Abschnitt 13, und dort steht der Satz dazu schon:
*„Das Einzige, wofür man gekommen war, war das Einzige, was nicht zu sehen war."* Im Regal auf dem
Profil war die Karte sogar **überhaupt nicht antippbar**: Man konnte einen Artikel kaufen, aber
nicht ansehen.

**2. Die Beschreibung war unsichtbar** — siehe die neue Falle in Abschnitt 3.

**3. Die Rechtsfolge der Anbieterkennzeichnung stand nirgends.** Die Karten zeigten „Privatverkauf"
als nacktes Etikett. `sellerKindNote()` — die fertige Funktion mit dem richtigen Satz — hatte
keinen Aufrufer. Art. 246d § 1 EGBGB verlangt aber nicht das Etikett, sondern die Auskunft, und
zwar **vor** der Vertragserklärung.

**4. Der Kauf lag im Stöber-Raster.** Ein goldener „Kaufen"-Knopf zwischen Stöber-Karten, ohne
Beschreibung, ohne Versandkosten, ohne Rechtsfolge, einen Fingerbreit neben dem Tipp aufs Bild.
Das steht im direkten Widerspruch zu der Regel, die dieselbe App am 16.08. für das *Gebot*
aufgestellt hat (Abschnitt 19): *„Ein Bildschirm, auf dem Tippen die normale Geste ist, darf
keinen Kauf mit demselben Tippen auslösen."* Ein Sofortkauf ist verbindlicher als ein Gebot — er
schließt den Vertrag sofort.

**5. Dieselbe Karte war viermal abgeschrieben** (Marktplatz, Kategorie, Regal-Raster,
Regal-Liste) und schon auseinandergelaufen: drei zeigten den Verkäufernamen, eine nicht; „Deins"
gegen „von dir" gegen einen Zurückziehen-Knopf; die Kategorie-Seite baute ihre Meta-Zeile zweimal
im selben JSX. Der Kopf des alten `useShop.ts` **beschrieb die Gefahr sogar** („wer hier eine
Spalte ergänzt, muss sie dort mit ergänzen"), statt sie abzuschaffen. Eine Warnung ist kein Riegel.

**6. Zwei Typen für dieselbe Zeile.** `StandingListing` trug die Beschreibung, aber keine
`seller_id`; `CategoryListing` trug die `seller_id`, aber nicht die Beschreibung. Beide
unvollständig, an verschiedenen Stellen — und genau das war die technische Ursache für 1 und 2:
Das Regal konnte nicht verlinken, die Kategorie konnte nichts anzeigen.

### Die neue Struktur

| Datei | Rolle |
|---|---|
| `lib/useListings.ts` | **neu** — ein Typ `Listing`, eine `LISTING_COLUMNS`, vier Abfragen darauf (Marktplatz, Kategorie, Verkäufer, Einzelstück) |
| `components/ListingCard.tsx` | **neu** — die eine Karte, `grid` zum Stöbern und `row` zum Arbeiten. **Ohne Kaufknopf** |
| `app/listing/[id].tsx` | **neu** — die Artikelseite und die einzige Fläche mit einem Kaufweg |
| `lib/useStanding.ts` | nur noch die Aktionen (anlegen, zurückziehen, kaufen) und die Fehlertexte |
| `lib/useCategories.ts` | eigener Zeilentyp und eigene Spaltenliste raus |
| `lib/useShop.ts` | **gelöscht** — ging in `useListings.ts` auf |

Die Artikelseite von oben nach unten: Bild quadratisch über die volle Breite · Preis · Titel ·
Zustand und Ort als Chips · wann eingestellt · **Anbieterkennzeichnung mit Rechtsfolge** ·
**Beschreibung** · Verkäuferkarte mit Bewertung (führt aufs Profil) · Versandsatz mit dem echten
Satz aus `berkat_shipping_rates` · bei gewerblichen Verkäufern die Anbieterangaben · unten eine
feste Leiste mit **einer** Handlung.

### Entscheidungen, die nicht offensichtlich sind

- **Der Kaufknopf ist aus allen Rastern verschwunden.** Das ist die eigentliche Änderung, nicht
  die neue Seite. Eine Karte ist ab jetzt ein Weg zum Artikel und sonst nichts. Dass der Ort der
  Vertragserklärung derselbe ist wie der Ort der Pflichtangabe, ist kein Nebeneffekt — es ist der
  Grund, warum die Kennzeichnung auf der kleinen Karte ein Etikett bleiben darf.
- **Kein zusätzlicher Bestätigungs-Dialog.** Die Seite IST der Schritt, der vorher fehlte; ein
  Blatt darüber wäre die Überdosis, vor der Design-Gesetz 3 warnt. Der Knopf sagt stattdessen,
  was er tut: „Kaufen · 24 €".
- **Ein verkaufter Artikel bleibt lesbar.** `live_auctions_select_standing` filtert nicht auf den
  Status, und das wird hier zum Vorteil: Wer aus einer Nachricht auf etwas kommt, das vor zehn
  Minuten weg ging, liest „Schon verkauft" statt einer Fehlerseite. Ein Frauen-Only-Artikel ohne
  Zugang bekommt bewusst **denselben** Text wie ein gelöschter — sonst sickerte die Existenz eines
  geschützten Raums über die Antwort durch, genau wie bei `buy_now_live_auction`.
- **Zurückziehen bleibt im Regal.** Es ist der häufige Handgriff des Verkäufers; ihn erst eine
  Seite tiefer anzubieten hieße, fünf Artikel fünfmal zu öffnen. Der Knopf sitzt deshalb **neben**
  der Fläche, die zum Artikel führt, nicht darin.
- **Kein Teilen-Knopf.** `SITE_URL` kennt nur `/live` — ein geteilter Artikel-Link ginge ins Leere
  (Abschnitt 8). Kommt eine Artikelseite im Netz dazu, gehört er hierher.
- **Weiterhin keine Filter und keine Suche** auf der Marktplatz-Seite. Es liegen drei Angebote in
  der Datenbank. Die Entscheidung aus Abschnitt 20 steht.

### Am Gerät durchgespielt (17.08.2026, 20:38–20:44)

Im Simulator, gegen die echte Datenbank:

- **Marktplatz** — „Alle Angebote · 2 Artikel · rund um die Uhr", zwei Karten mit „Deins",
  Verkäufername, Preis. **Kein Kaufknopf im Raster.**
- **Artikelseite** — Tipp auf „Kaffeetasse": Bild über die volle Breite, „64 €", Verkäuferkarte
  („berkattest · Noch keine Bewertung · 5 Zuschläge"), und der Versandsatz mit dem **echten** Satz
  aus der Datenbank: „zzgl. Versand ab 4,90 €".
- **Die Beschreibung, zum ersten Mal.** Testangebot mit Zustand, PLZ, Ort und drei Sätzen Text
  angelegt — auf der Artikelseite standen die Chips „Sehr gut" und „80331 …", darunter
  „heute eingestellt" und der vollständige Beschreibungstext.
- **Zurückziehen von der Artikelseite** lief, und die Leiste sprang **ohne Neuladen** von
  „Zurückziehen" auf „Zurückgezogen" — der Beleg, dass die neue Invalidierung auf
  `['berkat','listing']` greift.
- **Alle vier Flächen** zeigen dieselbe Karte: Marktplatz-Raster, Kategorie-Raster, Profil-Raster
  („Jetzt kaufbar · 2") und die Regal-Liste mit der Meta-Zeile „Sehr gut · 80331 …".
- Die Testzeile ist danach wieder abgesagt, der Datenstand ist unverändert.

`npx tsc --noEmit` fehlerfrei, `npx expo export --platform ios` fehlerfrei (3683 Module).

### Die Kennzeichnung, nachgereicht am selben Abend (20:58)

Der Anbieter-Block blieb zunächst leer — nicht wegen des Umbaus, sondern weil
`20260816220000` noch nicht eingespielt war und `seller_kind` deshalb auf allen Angeboten NULL
stand. Die Migration ist jetzt drin (siehe Abschnitt 20), und damit ist die Kette zum ersten Mal
vollständig gesehen worden:

- Angebot ohne Antippen des Anbietertyps eingestellt — also mit der bloßen **Vorgabe**
- an der Regal-Zeile stand danach **„Privatverkauf"**
- auf der Artikelseite der Kasten **„Privatverkauf · kein Widerrufsrecht"** samt Erklärsatz

Das ist zugleich die erste Gegenprobe aus dem Dateikopf der Migration: Lägen zwei Überladungen
von `create_standing_listing` im Katalog, hätte PostgREST mit **HTTP 300** geantwortet und das
Einstellen wäre gescheitert. Es lief — also gibt es genau eine Fassung.

⚠️ **Nebenwirkung, die man wissen muss:** Durch diesen Testlauf hat `berkattest` jetzt eine Zeile
in `berkat_sellers` mit `kind = 'private'`. Das ist das gewollte Verhalten der Migration, aber es
bedeutet: Wer als Betreiber **gewerblich** verkauft, muss im Composer einmal auf „Gewerblich"
tippen. `set_berkat_seller_kind` zieht dabei alle noch offenen eigenen Angebote nach — auch die
zwei alten mit NULL, die die Migration bewusst nicht angefasst hat.

### Was daran noch offen ist

1. ~~**Die gewerbliche Fassung** des Anbieter-Blocks und der Impressumsblock~~ — **erledigt.**
   Das Seed-Skript setzt `amir32` auf `kind = 'business'`; der Block war am 18.08.2026 zu sehen
   (Abschnitt 33), der Impressumsblock mit Inhalt am 19.08. (Abschnitt 35).
2. **Der Kaufknopf** — fremde Angebote gibt es seit der Testware; was noch fehlt, ist
   `checkout_enabled` bei einem Seed-Verkäufer (Abschnitt 54, Punkt 3).
3. **Die Suche** findet weiterhin nur Verkäufer, keine Artikel (Abschnitt 17). Mit einer
   Artikelseite je Angebot wäre eine Artikelsuche jetzt sinnvoll — sie hätte ein Ziel.
4. ~~**`/shop` hängt an einer einzigen Zeile** im Kategorien-Reiter~~ — **behoben, siehe unten.**

### Der Leerzustand der Startseite verwies ins Leere — dieselbe Regel, drittes Mal

Abschnitt 13 hat sie schon einmal aufgeschrieben: *„‚Komm später mal wieder, vielleicht' ist die
falsche Auskunft, wenn es eine Antwort gibt."* Damals galt sie für angekündigte Termine, und der
Leerzustand bekam einen Verweis nach oben.

Für **Angebote** galt sie noch nicht. Wer die App öffnete, während niemand sendete — rund 94 % der
Zeit — las „Schau später wieder rein", obwohl zwei Bildschirme entfernt kaufbare Ware lag. Der
einzige Weg dorthin war die Zeile „Alles ansehen" im Kategorien-Reiter: **drei Tipps**, und man
musste wissen, dass sie da ist.

Jetzt steht im Leerzustand ein Knopf **„N Angebote ansehen"** → `/shop`. Ein Tipp.

- **`useShopCount()`** (`lib/useListings.ts`) zählt mit `head: true` — **keine einzige Zeile**
  wird übertragen. Dasselbe Muster wie beim Bestell-Abzeichen am Verkaufen-Reiter, und aus
  demselben Grund: Die Startseite ist der Bildschirm, den jeder als Ersten sieht, und sie soll
  nicht sechzig Zeilen laden, um einen Satz zu formulieren.
- Der Zähler hängt in `useStandingActions.invalidate()` — sonst stünde nach dem Zurückziehen des
  letzten Angebots weiter „1 Angebot ansehen" auf einem leeren Regal.
- **Kontur statt Gold.** Gold ist in Berkat der Kaufweg; „sieh dir das Regal an" ist eine
  Einladung zum Stöbern.
- Der Knopf erscheint **unabhängig vom Text**: Auch wer gerade auf einen Termin verwiesen wird,
  darf jetzt etwas kaufen. Bei aktiver Suche oder gesetztem Kategorie-Filter bleibt er weg —
  dort ist „nichts gefunden" die richtige und vollständige Auskunft.

Am Gerät gesehen (17.08.2026, 21:02): „Gerade ist niemand live · Aber es liegt etwas im Regal —
rund um die Uhr kaufbar, auch ohne Sendung" mit dem Knopf **„2 Angebote ansehen"**; die Zahl
stimmte mit dem Datenstand nach dem Zurückziehen der Testzeile überein.

---

## 22. Der Audit — und was er im eigenen Bau fand (17.08.2026, abends)

Nach dem Umbau lief ein Prüf-Fächer über ihn: fünf Blickwinkel (Korrektheit, Recht, Lücken,
Auffindbarkeit, Hausregeln), und **jeder einzelne Fund musste einen Skeptiker überleben**, dessen
Auftrag es war, ihn zu widerlegen. Ergebnis: **45 Funde, 19 bestätigt, 26 verworfen.**

Die Quote ist die eigentliche Nachricht. Über die Hälfte der Funde hielt der Gegenprobe nicht
stand — teils weil das Verhalten anderswo abgefangen wird, teils weil es bewusste, hier
dokumentierte Entscheidungen sind. Wer solche Listen ohne Gegenprobe abarbeitet, baut an
Baustellen, die keine sind.

### ⚠️ Der teuerste Fund war eine Regression von zwanzig Minuten vorher

`buy_now_live_auction` sperrt einen Regal-Kauf so:

```sql
SELECT checkout_enabled INTO v_ok FROM berkat_sellers WHERE user_id = a.seller_id;
IF v_ok IS NOT NULL AND v_ok = false THEN RAISE 'contact_seller';
```

**„Keine Zeile" hieß also erlaubt.** Genau darauf beruhte der Satz aus Abschnitt 20: *„In der
gebauten Fassung heißt ‚keine Zeile' deshalb wie bisher, nicht ‚gesperrt'."* Das stimmte — solange
niemand eine Zeile hatte.

`20260816220000`, am selben Abend eingespielt, legt bei **jedem** `create_standing_listing` eine
Zeile an, und `checkout_enabled` steht dabei auf seiner Vorgabe `false`. Belegt: Vor dem Einspielen
hatte `berkat_sellers` **null** Zeilen, danach genau eine — `kind = 'private'`,
`checkout_enabled = false`. Der am 16.08. durchgespielte Kauf eines Dauerangebots wäre ab diesem
Moment mit `contact_seller` gescheitert.

Das ist wörtlich die Falle, die die drei Skeptiker beim ersten Entwurf von Abschnitt 20 abgelehnt
hatten: **„Ein Riegel mit Vorgabe `false` und ohne Backfill ist kein Riegel, sondern ein
Ausfall."** Er kam durch die Seitentür einer Migration zurück, die ihn gar nicht anfassen wollte.

**Die Lehre, die über diesen Fall hinausgeht:** Eine Migration, die eine Zeile ANLEGT, ändert jede
Bedingung, die anderswo auf „Zeile vorhanden?" prüft. Wer eine `ON CONFLICT DO NOTHING`-Einfügung
schreibt, muss sie nicht nur gegen ihre eigene Tabelle lesen, sondern gegen jeden Wächter, der die
Existenz dieser Zeile als Signal benutzt — `grep` nach dem Tabellennamen genügt.

Und die zweite: **„Kein Eintrag = erlaubt" ist für eine erlaubnisrechtliche Schranke immer die
falsche Polarität.** Sie sah nur richtig aus, weil genau ein Mensch keinen Eintrag hatte.

Behoben mit `20260817120000_berkat_checkout_gate.sql` — Bestandsschutz für den Betreiber
(datengestützt: wer schon über die Plattform bezahlt wurde) plus `IS DISTINCT FROM true` im
Wächter, damit `checkout_enabled` die **einzige** Wahrheit ist.

**Eingespielt am 17.08.2026, 22:5x.** Der Lauf meldete `Kassen-Freigabe steht jetzt bei 1
Verkäufer(n)` — der Bestandsschutz hat also genau einen erfasst und keinen zweiten. Danach steht
in `berkat_sellers` eine Zeile mit `checkout_enabled = true`. Rauchprobe auf die ersetzte Funktion:
Aufruf ohne Anmeldung antwortet mit **HTTP 401 / `42501 permission denied for function`** — also
weder ein Syntaxfehler noch, und das ist der eigentliche Punkt, **HTTP 300**: Es liegt genau eine
Signatur im Katalog.

⚠️ **`declared_at` taugt NICHT zur Unterscheidung.** Beim Nachsehen aufgefallen: Die Spalte trägt
auch an der automatisch entstandenen Zeile einen Zeitstempel, weil sie einen Spalten-Default hat.
Wer „ausdrücklich erklärt" von „per Vorgabe entstanden" unterscheiden will, braucht ein eigenes
Merkmal — der naheliegende Griff nach `declared_at` geht ins Leere.

### Zwei Spalten für dieselbe Frage

Der zweite Kern desselben Fundes, und er war unabhängig davon falsch: Die Oberfläche entschied
„privat → Nachricht, sonst Kaufen" an `seller_kind`, der Server an `checkout_enabled`.

`set_berkat_seller_kind` fasst `checkout_enabled` ausdrücklich nicht an, und jede neue Zeile trägt
`false` — ein gewerblicher Verkäufer hatte damit **per Konstruktion** `kind = 'business'` UND
`checkout_enabled = false`. Die App zeigte ihm den goldenen Kaufknopf, den der Server garantiert
verweigert. Dasselbe galt für `seller_kind = NULL`: `isPrivate` war eine zweiwertige Prüfung auf
einer dreiwertigen Spalte.

Jetzt entscheidet **`checkout_enabled` den Knopf, `seller_kind` den Text.** Solange die Freigabe
noch geladen wird, steht in der Leiste eine Wartefläche und kein beschrifteter Knopf — ein Etikett,
das eine Zehntelsekunde später von „Nachricht" auf „Kaufen" springt, ist auf einem Geldweg
schlimmer als eine kurze Pause.

### Was sonst behoben wurde

| Fund | Was war | Datei |
|---|---|---|
| Sackgasse ohne Anmeldung | Kauf- und Kontakt-Knopf waren `disabled`, also **grau ohne Erklärung** — und der freundliche Satz im Handler („Melde dich an…") war toter Code, weil ein deaktiviertes `Pressable` nie `onPress` ruft | `app/listing/[id].tsx` |
| Leeres Impressum als „vollständig" | `missingBusinessFields` gibt für „ich weiß nichts" (`null`) dasselbe `[]` zurück wie für „alles da" — die Seite zeigte die Überschrift „Anbieterangaben" über einem leeren `join` | dito |
| Kein Weg nach dem Kauf | Der teuerste Moment der App endete in einem Satz („Bezahlen kannst du unter ‚Konto'"), nicht in einem Knopf. Jetzt: Erfolgs-Haptik + **„Zum Sammelkorb"** | dito |
| Falsches Polster | `paddingBottom: insets.bottom + 96` mit der Begründung „sonst verdeckt die Leiste den Inhalt" — die Leiste ist aber ein normales Flex-Geschwister und verdeckt gar nichts. Vierfacher Hauswert mit falschem Grund | dito |
| Aktivität führte aufs Profil | „Neu im Angebot" trug Artikelbild und Artikelnamen und landete auf `/seller/<id>` — die **letzte** Aufrufstelle des Musters, das der Umbau an vier Flächen beseitigt hatte | `lib/useActivity.ts` |
| Suche log Nicht-Angemeldete an | `search_berkat_sellers` ist für `anon` gesperrt (42501). Der Fehler wurde als leere Trefferliste gerendert: „Niemand mit ‚x' gefunden. Achte auf die Schreibweise" — falsch, der Name war richtig | `components/SellerResults.tsx` |
| Vier stale Behauptungen | „die einzige Stelle, an der Berkat Text auf Bild setzt" stand an vier Orten (Token, Karte, HANDOFF 8, HANDOFF 13) — seit dem Umbau sind es **zwei** Stellen | `theme/tokens.ts` u. a. |
| No-Op-Ternary | `n === 1 ? 'Artikel' : 'Artikel'` an drei Stellen | `shop.tsx`, `account.tsx`, `live/[id].tsx` |

### Was bewusst NICHT behoben wurde

- **Kein Bearbeiten eines Angebots**, kein Melden am Angebot, keine weiteren Artikel desselben
  Verkäufers am Seitenende, nur ein Bild je Angebot. Alles echte Lücken gegenüber Kleinanzeigen,
  aber es liegen zwei Angebote in der Datenbank — das ist Arbeit am falschen Ende.

### Ungeprüft geblieben

Der Kaufweg selbst. `seller_cannot_bid` greift vor der ZAG-Schranke, ein Kauf am eigenen Artikel
ist also unmöglich — die neue Kauf/Kontakt-Weiche und `20260817120000` brauchen beide **das zweite
Konto**. Das ist derselbe offene Punkt wie in Abschnitt 21 und inzwischen der einzige, der noch
zwischen dem Marktplatz und einem belegten Durchlauf steht.

### Nachtrag am selben Abend: der Live-Weg trägt jetzt auch eine Kennzeichnung

Die zwei Punkte aus „Was bewusst NICHT behoben wurde" sind mit
`20260817130000_berkat_live_seller_kind.sql` doch noch gefallen.

**`create_live_auction` stempelt `seller_kind`** — und zwar durch **Lesen, nicht Anlegen**. Das ist
der ganze Unterschied zu `20260816220000`: Dort darf die Vorgabe „privat" festgehalten werden, weil
sie im Composer sichtbar über dem Knopf steht; wer drückt, erklärt sie. Im Live-Studio steht sie
nirgends. Ein `ON CONFLICT DO NOTHING` an dieser Stelle wäre derselbe Fehler in Grün gewesen —
diesmal hätte die **Datenbank** eine Angabe, die die Oberfläche nicht zeigt.

Wer noch nichts erklärt hat, bekommt also NULL, und im Live-Raum steht dann nichts. Dass das selten
vorkommt, ist kein Zufall, sondern schon gebaut: **„Deine ersten Schritte" stellt Regal vor Show**
(Abschnitt 18), und das Einstellen ins Regal erklärt den Typ. Wer der empfohlenen Reihenfolge
folgt, hat seine Kennzeichnung, bevor er zum ersten Mal sendet.

Die Client-Hälfte gehört dazu, sonst wäre der Stempel unsichtbar: `seller_kind` steht jetzt im
`Auction`-Typ **und** in `AUCTION_COLUMNS` (`lib/useAuction.ts`), und `AuctionPanel` zeigt den Satz
unter dem Versandhinweis — **direkt über dem Gebots-Knopf**. „Vor der Vertragserklärung" heißt im
Blickfeld, nicht einen Tipp entfernt in einem Sheet.

**Der Typwechsel löscht nichts mehr:** `set_berkat_seller_kind` schreibt die acht Impressumsfelder
per `COALESCE(EXCLUDED.<feld>, s.<feld>)`. `kind` bleibt bewusst ohne — der Typ IST der Zweck des
Aufrufs und wird vorher gegen `('private','business')` geprüft, kann also nie NULL sein.

**Rauchprobe nach dem Einspielen:** Alle drei an diesem Abend ersetzten Funktionen
(`buy_now_live_auction`, `create_live_auction`, `set_berkat_seller_kind`) antworten ohne Anmeldung
mit **HTTP 401 / `42501 permission denied for function`** — je genau eine auflösbare Signatur, kein
**HTTP 300**, und alle drei weiterhin für `anon` gesperrt.

**Der Backfill hat sich von selbst erledigt:** Beim Gegenprüfen um 23:0x trugen beide
Altangebote (Kaffeetasse, Parfüme) bereits `seller_kind = 'private'` — irgendwann zwischendurch
ist `set_berkat_seller_kind` gelaufen (der Umschalter im Composer ruft sie bei jedem Typwechsel),
und ihr UPDATE zieht offene Angebote seit `20260816200000` nach. Die um 21:0x noch geplante
Nachzieh-Migration ist damit gegenstandslos. Merkposten daraus: **Der Datenstand dieser zwei
Zeilen ist eine Momentaufnahme, keine Invariante** — wer hier prüft, fragt die Datenbank, nicht
die Übergabe.

**Ungeprüft:** die Anzeige im Live-Raum selbst. Sie bräuchte eine laufende Sendung, und ein Start
löst über `follows` Benachrichtigungen an echte Geräte aus — das gehört nicht in einen Testlauf,
den niemand erwartet.

---

## 23. Der Shop-Vollausbau (17./18.08.2026)

Zaur: *„Dass es keine angebotenen Produkte gibt, ist kein Grund, die App nicht
vollständig zu bauen."* Dieselbe Ansage wie am 16.08. („nichts weglassen, alles bauen"), diesmal
für den Marktplatz. Damit ist die Zurückhaltung aus den Abschnitten 20 und 21 aufgehoben — die
Kommentare „bewusst ohne Filter, ein Bild reicht" waren an ihrem Tag richtig und sind es nicht mehr.

### Was dazukam

| Was | Wo |
|---|---|
| **Mehrbild** (bis 8, Cover = erstes) | `20260817140000`, `StandingComposer`, Galerie in `app/listing/[id].tsx` |
| **Bearbeiten** statt Löschen-und-neu | RPC `update_standing_listing`, `StandingComposer` mode=`edit` |
| **Merkliste** | Tabelle `berkat_saved_listings`, `lib/useSaved.ts`, `app/saved.tsx`, Herzen auf den Karten |
| **Artikelsuche** | `useListingSearch`, `components/ListingResults.tsx` — im selben Suchfeld wie die Verkäufer |
| **Teilen** | `listingLink()`, `apps/berkat-web/listing.html`, Knopf im Kopf der Artikelseite |
| **Melden am Angebot** | Blatt auf der Artikelseite über `useSellerActions` |
| **Mehr von diesem Verkäufer** | dieselbe Abfrage wie das Profil-Regal, aktueller Artikel gefiltert |
| **Versandtempo + Bürgen** in der Verkäuferkarte | `useSellerStats.shipHours`, `vouchSummary()` |

### Entscheidungen, die nicht offensichtlich sind

- **`image_urls` ist die Wahrheit, `image_url` bleibt das Cover.** Beide werden von den RPCs
  synchron gehalten, und `image_url` ist immer `image_urls[1]`. Dadurch liest **jede** bestehende
  Fläche unverändert weiter — Karten, Live-Raum, Aktivität, Serlos Web. Nur die Artikelseite
  blättert. Wer je einen dritten Schreibweg baut, muss beide setzen; `listingImages()` ist das
  Netz für Zeilen von vor dem Backfill.
- **Bearbeiten ist Vollersatz, `set_berkat_seller_kind` ist COALESCE.** Zwei entgegengesetzte
  Semantiken am selben Tag, und beide sind richtig: Das Angebots-Formular ist vorbefüllt und
  schickt **alle** Felder — nur so lässt sich eine Beschreibung auch wieder LEEREN. Der
  Anbietertyp-Umschalter schickt **ein** Feld, dort würde Vollersatz das Impressum löschen
  (Abschnitt 22). Die Frage ist nie „was ist sauberer", sondern „was schickt der Aufrufer".
- **`seller_kind` fasst `update_standing_listing` nicht an.** Den pflegt allein
  `set_berkat_seller_kind`, damit es genau eine Wahrheit über den Anbietertyp gibt.
- **`FOR UPDATE` im Bearbeiten** — gegen den Wettlauf mit `buy_now_live_auction`. Wer gerade
  kauft, hält die Zeile; der Verkäufer ändert danach ins Leere (`listing_not_found`), statt einen
  bereits verkauften Artikel umzuschreiben.
- **Die Merkliste zeigt auch WEG-Artikel**, mit Etikett „Verkauft"/„Weg". Das ist die Auskunft,
  für die man eine Merkliste hat — sie stumm zu verschlucken wäre die schlechtere Hälfte.
- **Ein Formular für Anlegen und Bearbeiten.** Eine zweite Abschrift wäre der Karten-Fehler von
  Abschnitt 21 noch einmal. Einziger Unterschied: Im Bearbeiten fehlt die Anbietertyp-Wahl — die
  gehört zum Verkäufer, nicht zum Artikel.
- **Die Artikelsuche braucht KEINE RPC.** Die Regal-Zeilen sind für jeden lesbar (anders als
  `search_berkat_sellers`, die für `anon` gesperrt ist), also reicht ein `ilike` über die
  bestehende RLS. `%` und `_` werden escaped — sonst wäre „100%" ein Joker statt einer Suche.
- **Die Web-Seite ruft keine Daten ab.** Sie ist eine Brücke in die App, kein zweiter Marktplatz;
  Titel und Preis stehen ohnehin im geteilten Nachrichtentext über dem Link.

### ⚠️ Ein Fund am Gerät: zwei Wahrheiten auf einem Bildschirm

Die Artikelsuche fand „Kaffeetasse" — und darunter stand **„Nichts gefunden. Versuch es mit einem
anderen Wort."** Der Leerzustand gehört dem SHOW-Raster, die Treffer stehen im Kopf darüber, und
niemand hatte die beiden aneinander gekoppelt. Ein Satz, der jemanden wegschickt, der schon
gefunden hat.

Behoben über `hasSearchHits` (Verkäufer ODER Artikel). **Wer eine dritte Trefferart einbaut, muss
sie dort mit aufnehmen** — die Kopplung steht als Kommentar an der Stelle.

Das ist dieselbe Familie wie die Regel aus Abschnitt 21: Wer etwas an N Orten anzeigt, muss an
allen N nachziehen. Hier war es kein Nachladen, sondern ein Leerzustand — aber derselbe Bruch.

### Am Gerät durchgespielt (18.08.2026, 14:43–14:48)

- **Bearbeiten** — Blatt öffnet vorbefüllt (Titel, Preis 64, Bild mit „Titelbild"-Etikett), die
  Anbietertyp-Wahl fehlt korrekt. Zweites Foto ergänzt → „2 von 8 Fotos — das erste ist das
  Titelbild" → **„Gespeichert."**
- **Galerie** — zwei Punkte unter dem Bild, Wischen blättert, der aktive Punkt wandert mit.
- **Bildzähler** — „📷 2" auf der Marktplatz-Karte, und nur dort (die Ein-Bild-Karte daneben hat
  keinen).
- **Artikelsuche** — „Kaffee" findet den Artikel; der Leerzustand darunter sagt jetzt
  „Keine laufende Show · Aber die Artikel oben".
- **Merkliste** — Leerzustand steht. Ein gefülltes Herz braucht ein FREMDES Angebot; beide
  vorhandenen gehören dem Betreiber, das Herz erscheint dort bewusst nicht.

Migration eingespielt (33/33, keine Lücke), vier Gegenproben grün: Backfill-Vertrag hält
(`image_urls` = `[image_url]`), `berkat_saved_listings` für `anon` dicht (42501), beide RPCs
auflösbar und gesperrt — **kein HTTP 300**. Web-Seite live, `/listing?id=…` antwortet mit **200
ohne Weiterleitung**; die Pages-Falle aus Abschnitt 8 greift also nicht.

### Was weiterhin fehlt

1. **Das zweite Konto.** Kaufweg, Merken an einem fremden Angebot und „Nachricht statt Kaufen"
   sind alle nur logisch belegt. Unverändert der einzige Punkt zwischen dem Marktplatz und einem
   bewiesenen Durchlauf — und ein Konto anzulegen ist Zaurs Handgriff, nicht meiner.
2. **Umsortieren der Bilder** geht nur über Entfernen und neu Hinzufügen. Ein Zieh-Sortierer
   bräuchte `react-native-gesture-handler` samt `GestureHandlerRootView` im Wurzel-Layout — also
   einen Build (Abschnitt 19 nennt dieselbe Grenze beim Gebots-Knopf).
3. **Impressums-Formular** und **Widerrufsbelehrung als Volltext** — beide werden Pflicht, sobald
   der erste gewerbliche Verkäufer eine Kassen-Freigabe bekommt.
4. **Keine Umkreissuche, keine Abholung.** PLZ und Ort stehen an der Zeile; Abholung bräche
   `get_cart_shipping_options`, die Stripe-Adressabfrage und `mark_order_shipped` und gehört zu
   Connect in Phase 2.

---

## 24. Preisvorschlag — und eine korrigierte eigene Empfehlung (18.08.2026)

Am selben Tag stand in einer Shop-Analyse noch: *„Was ich ausdrücklich NICHT bauen würde: …
strukturierter Preisvorschlag."* Begründet war das mit der Angebotszahl — es liegen zwei Artikel
in der Datenbank.

**Der Maßstab war falsch.** Ein Preisvorschlag ist keine Skalen-Funktion, sondern eine
**Kultur**-Funktion: Handeln ist in dieser Community und auf Kleinanzeigen die Norm, nicht die
Ausnahme. Und Berkat hatte den Weg ohnehin halb gebaut — der „Nachricht"-Knopf am Privatangebot
IST ein Preisvorschlag, nur unstrukturiert. Was fehlte, war die Zahl und ein Zustand, den beide
Seiten sehen.

Aufgefallen ist es bei der zweiten Whatnot-Analyse (`WHATNOT-ANALYSE.md`, Nachtrag vom 18.08.):
Whatnot führt „Accept offers" als Schalter je Angebot, mit annehmen / kontern / ablehnen.

### Wie es gebaut ist

| Wo | Was |
|---|---|
| `20260818120000` | `live_auctions.accepts_offers`, Tabelle `berkat_offers`, drei RPCs, `buy_now_live_auction` mit `p_offer_id`, `create_/update_standing_listing` mit `p_accepts_offers` |
| `lib/useOffers.ts` | Abfragen, Aktionen, Fehlertexte |
| `components/OfferPanel.tsx` | beide Sichten in einer Komponente |
| `StandingComposer` | Schalter „Preisvorschläge zulassen" |

### Entscheidungen, die nicht offensichtlich sind

- **Eine Komponente für Käufer und Verkäufer.** Das ist keine Bequemlichkeit, sondern die RLS:
  `berkat_offers_select_party` gibt dem Käufer genau seinen Vorschlag und dem Verkäufer alle.
  Dieselbe Abfrage, zwei Sichten — die Fallunterscheidung steht in der Datenbank, nicht im Client.
- **`accept` ändert NICHTS am Preis des Angebots.** Eine Zusage gilt EINEM Käufer. Würde
  `accept` den `buy_now_cents` senken, bekäme sie jeder — und der Verkäufer hätte einen Rabatt
  verschenkt, den er einer Person zugesagt hat. Eingelöst wird sie über `p_offer_id` am Kaufweg,
  der dann `LEAST(vereinbart, Listenpreis)` rechnet.
- **Genau EIN offener Vorschlag je Käufer und Artikel**, als Teil-Index über
  `status IN ('pending','countered')`. Ohne das wird aus Handeln ein Bombardement. Abgelehnte und
  angenommene bleiben liegen — sie sind die Geschichte der Verhandlung, und wer abgelehnt wurde,
  darf es noch einmal versuchen.
- **Ein Vorschlag ÜBER dem Preis wird abgewiesen** (`offer_above_price`). Ihn anzunehmen wäre für
  den Käufer schlechter als der Kaufknopf daneben. Dasselbe gilt für einen Gegenvorschlag auf den
  vollen Preis: Das heißt „nein" und soll auch so heißen.
- **Der Kauf erledigt alle offenen Vorschläge** auf diesen Artikel serverseitig. Ohne das warten
  andere Käufer auf eine Antwort, die nie kommt.
- **Das Abschalten des Schalters ebenfalls** — wer nicht mehr handeln will, beendet die laufenden
  Verhandlungen, statt sie stumm hängen zu lassen.
- **Auch eine ANGENOMMENE Zusage darf der Käufer zurückziehen.** Sie ist eine Einladung zum Kauf,
  kein geschlossener Vertrag — der entsteht erst am Kaufknopf.
- **Vorgabe: Schalter AN beim Anlegen, aus in der Datenbank.** Die Spalte hat `DEFAULT false` —
  ein Angebot, das stillschweigend verhandelbar wird, wäre eine Aussage, die niemand getroffen hat
  (dieselbe Lehre wie bei der Anbieterkennzeichnung, Abschnitt 3). Der Composer setzt ihn für NEUE
  Angebote sichtbar auf an, weil Handeln hier die Norm ist; beim BEARBEITEN gilt, was am Angebot
  steht — eine Vorgabe würde dort eine Entscheidung überschreiben.
- **KEIN neuer `notifications`-Typ.** Ein Typ dort bräuchte neun Oberflächen auf einmal
  (Abschnitt 9), und wer nur einen Teil anfasst, bekommt „Neue Aktivität auf Serlo". Ein Vorschlag
  ist nicht eilig genug dafür — dieselbe Entscheidung wie bei den Belohnungen (Abschnitt 18).

### ⚠️ Dritte Änderung am Kaufweg in zwei Tagen

`buy_now_live_auction` wurde am 17.08. zweimal und am 18.08. ein drittes Mal neu erzeugt. Der
Rumpf ist jedes Mal wörtlich der vorige, geändert ist nur der genannte Block — das Original lag
jedes Mal daneben. Wer ein viertes Mal drangeht, macht es genauso: Die Funktion hat schon einmal
`buy_now_gone`, den Eintrag in `live_bids`, `bid_count`, `ends_at` und den jsonb-Rückgabewert
verloren.

`DROP` + `CREATE` statt eines defaultierten Parameters an der alten Signatur, weil ein Default in
Postgres eine **Überladung** erzeugt und zwei Überladungen PostgREST mehrdeutig machen (HTTP 300).

### Geprüft (18.08.2026, 15:2x)

Migration eingespielt (34/34, keine Lücke). Gegenproben: `berkat_offers` für `anon` dicht (42501),
und **alle sechs** betroffenen Funktionen antworten ohne Anmeldung mit 401/42501 — je genau eine
auflösbare Signatur, **kein HTTP 300**.

Am Gerät: Schalter „Preisvorschläge zulassen" im Bearbeiten-Blatt, korrekt **aus** vorbefüllt
(das Angebot stammt von vor der Migration), umgelegt, gespeichert — `accepts_offers = true` in der
Datenbank belegt.

**Ungeprüft:** das Vorschlag-Feld selbst. Es erscheint nur für einen FREMDEN Käufer; bei einem
eigenen Angebot rendert die Komponente korrekt nichts, solange keine Vorschläge vorliegen. Damit
hängt auch dieser Weg am zweiten Konto — wie der Kauf, wie „Nachricht statt Kaufen", wie das
Merken. Das ist inzwischen der einzige offene Punkt, und er ist an allen vier Stellen derselbe.

---

## 25. Rechtstexte auf der Website (18.08.2026)

Bis zum 18.08.2026 hatte `berkat-web` **Impressum und Datenschutz — sonst nichts.** Keine AGB,
keine Widerrufsbelehrung, keine Regelung zum Vertragsschluss. Bei einer Auktion, in der ein Gebot
eine bindende Willenserklärung ist, war das die klaffendste Lücke im ganzen Rechtsteil.

Aufgefallen bei der **dritten Whatnot-Analyse** (`WHATNOT-ANALYSE.md`): Deren EU-Vertragswerk
beschreibt den Vertragsschluss bei Auktionen wörtlich und präzise. Berkat beschrieb ihn nirgends.

| Neu | Inhalt |
|---|---|
| `apps/berkat-web/agb.html` | Marktplatz-Rolle · Konto · **Vertragsschluss für Auktion, Festpreis und Preisvorschlag** · Preise/Versand/Sammelpaket · Widerrufsrecht-Weiche · Verkäuferpflichten · verbotene Waren · Inhalte · Gebühren · Sperrung · Haftung · Recht |
| `apps/berkat-web/widerruf.html` | Belehrung nach amtlichem Muster + Muster-Widerrufsformular, mit der Weiche privat/gewerblich davor |

⚠️ **Beides sind Entwürfe und anwaltlich nicht geprüft.** Eine fehlerhafte Widerrufsbelehrung
verlängert die Frist auf zwölf Monate und vierzehn Tage — das ist derselbe Gedanke, aus dem heraus
Berkat bewusst **keinen** Gewährleistungsausschluss stellt (Abschnitt 20).

### Drei Dinge, die beim Bauen auffielen

**1. Vier Seiten hatten gar keine Fußzeilen-Navigation** (`live`, `listing`, `bezahlt`,
`abgebrochen`). Nach § 5 DDG muss das Impressum von **jeder** Seite erreichbar sein — auch von
denen, die als Brücke aus einem geteilten Link geöffnet werden. Alle neun Seiten verlinken jetzt
Nutzungsbedingungen, Widerruf, Impressum und Datenschutz.

**2. Das weiche Trennzeichen ist Hauskonvention, und ich hatte sie übersehen.**
`datenschutz.html` schreibt `Datenschutz&shy;erklärung`, und das Stylesheet steht passend auf
`hyphens: manual` — die Seite trennt lange deutsche Komposita also **von Hand**, nicht automatisch.
Meine beiden neuen Überschriften („Widerrufsbelehrung", „Nutzungsbedingungen") hatten keins und
erzeugten auf schmalen Geräten **seitliches Scrollen der ganzen Seite** (nachgemessen: Dokument
318 px breit bei 283 px Viewport). Behoben mit `&shy;`, danach `scrollWidth == clientWidth`.

> **Merksatz:** Wer eine neue Seite anlegt, schaut in eine bestehende, BEVOR er sie schreibt. Die
> Konvention stand da, sie war nur nicht dokumentiert.

**3. Der Anbietertyp im Datenstand ist Testdaten, keine Aussage.**

⚠️ **Richtigstellung vom 18.08.2026.** In einer früheren Fassung stand hier eine Warnung, die
`impressum.html` („Kleinunternehmer nach § 19 UStG") gegen `berkat_sellers.kind = 'private'`
hielt und daraus einen Rechtsverstoß ableitete. **Die Prämisse war falsch:** Was in der Datenbank
liegt, sind Testzeilen. Es wird nichts verkauft.

Was technisch stimmt und für einen späteren Leser zählt: `create_standing_listing` legt beim
ersten Angebot automatisch `kind = 'private'` an (`20260816220000`). Wer den Datenstand für eine
Aussage über einen echten Verkäufer hält, liest ihn falsch — **erst mit einem echten Verkäufer
wird der Anbietertyp eine Erklärung, vorher ist er eine Vorgabe.**

Ein Tipp auf „Gewerblich" im Composer ändert ihn und zieht alle offenen Angebote nach
(`set_berkat_seller_kind`).

### Was daraus noch offen ist

1. **Impressums-Formular im Konto** — die Spalten stehen seit `20260816200000`, das Formular fehlt.
   Wird Pflicht, sobald ein Verkäufer sich als gewerblich erklärt.
3. **Die Texte anwaltlich prüfen lassen**, bevor der erste fremde Käufer kommt.
4. **Durchsetzungsseite** (wer trägt die Rückerstattung, was bei Nichtlieferung) — Whatnot regelt
   das ausführlich, Berkat gar nicht. Erst ab dem ersten Drittverkäufer nötig.

---

## 26. Hier geht es weiter (Stand 18.08.2026, Chat-Ende)

**Der Anschlusspunkt für einen frischen Chat.** Der Arbeitsstand ist sauber — alles committet,
nichts Halbfertiges im Baum außer `deno.lock`, das wie immer nicht dazugehört.

### Wo Berkat gerade steht

| | |
|---|---|
| Letzter Commit | `f97227b docs(berkat): Abschnitt 26 — Anschlusspunkt, und eine Richtigstellung` |
| Migrationen | **34, alle eingespielt und verzeichnet**, keine Lücke |
| `tsc --noEmit` | fehlerfrei |
| `expo export --platform ios` | fehlerfrei |
| Website | live, neun Seiten inkl. AGB und Widerruf |
| Ungeprüft | alles, was ein **zweites Konto** braucht — siehe unten |

**Nachtrag 18.08.2026, abends:** Zwei der hier gelisteten offenen Punkte sind gebaut und am
Simulator geprüft — das **Wann-Blatt** im Sendeplan (Verkaufen-Bildschirm gekürzt) und der
**Zustands-Leitfaden** im Composer. Beide brauchten weder Migration noch Build. Außerdem ist der
**Audit für die Reservieren-Lücke gemacht** (Abschnitt 26): `status='active'` für eine Vorab-Zeile
ist versperrt, ein neuer Status `'planned'` ist gangbar und kostet vier Eingriffe — einer davon
ist der Go-Live-Push, der sonst still ausfällt. Die Migration selbst ist **nicht** eingespielt;
sie fasst eine mit der ausgelieferten Serlo-App geteilte Tabelle an und gehört unter Aufsicht.

**Und danach die Startseite** (Abschnitt 27): Sendet niemand, zeigt sie jetzt das Regal, statt
darauf zu verweisen. Das ist der Zustand, den rund 94 % aller Besucher sehen.

### Vier Whatnot-Analysen, alle in `WHATNOT-ANALYSE.md`

Wer sie liest, liest sie in dieser Reihenfolge:

1. **Vollanalyse (13.08.)** — Strategie, Zahlen, Psychologie, Struktur, Technik, Recht, Phasenplan.
   Die Grundlage des ganzen Projekts.
2. **Die Nicht-Live-Seite (18.08.)** — Profile Shop vs. Live Shop, „Reserve for Live", Offers,
   Varianten, Seller Hub. **Und der Satz, der wehtut:** Whatnot bekommt das stille Regal selbst
   mit 8 Mrd. $ GMV nicht gut sichtbar.
3. **Die deutsche Rechtsmaschine (18.08.)** — `Whatnot Europe Ltd.`, USt-Riegel am Eingang,
   der „eingeschränkte Inkassobeauftragte", Vertragsschluss im Text, Durchsetzungsmaschine.
4. **Das Design (18.08.)** — nachgemessen statt geschätzt: eine Schriftgröße, ein Gewicht, ein
   Radius, Signalgelb zwei- bis dreimal pro Seite. **Der Kaufknopf ist grau, gelb ist „Folgen".**
   Enthält die Auflösung des Widerspruchs zu Berkats Regel „Gold ist der Kauf" — sie hält, solange
   im Regal kein Kaufknopf auf der Karte sitzt.

### ⚠️ Die eigentliche Lücke: Artikel entstehen erst IM Raum

Der schärfste Fund des Tages, und er ist noch **nicht** behoben.

`create_live_auction` verlangt eine `live_sessions`-ID — die existiert erst, **wenn die Show
läuft**:

```sql
SELECT host_id INTO v_host FROM public.live_sessions WHERE id = p_session_id;
IF v_host IS NULL THEN RAISE EXCEPTION 'session_not_found';
```

Ein Verkäufer kann seine Artikel also nicht vorbereiten. Er steht vor der Kamera, vor Publikum,
und tippt dort Titel, Preis, Mindestschritt und lädt ein Foto hoch. Whatnot erledigt das **Tage
vorher** (Live Shop, Import aus dem Inventar, CSV).

Das kostet vier Dinge auf einmal:

- **Tote Sendezeit** — jeder Artikel beginnt damit, dass das Publikum beim Tippen zusieht.
- **Nichts zum Vorab-Ansehen** — die „Demnächst"-Karte hat Titel und Bild, aber keine Ware.
  Whatnots Live Shop ist vor dem Start befüllt und browsebar.
- **Kein Grund, pünktlich zu sein** — wer nicht weiß, was kommt, verpasst auch nichts.
- **Keine Vorbereitung** — der Sendeplan (Abschnitt 13) schafft das Ritual, aber der Verkäufer
  kann sich inhaltlich nicht darauf vorbereiten.

**Der Weg dahin, in drei Schritten:**

1. **„Für die Show reservieren"** — Whatnots `Reserve for Live`, in ihrer neuen Semantik vom Juli
   2026: **verschieben, nicht duplizieren** (ein `UPDATE` auf `session_id`). Das Regal IST das
   Inventar; dort liegen Artikel schon mit Fotos, Zustand und Beschreibung.
2. Damit das vor dem Start geht, muss die **Sitzungszeile beim Planen entstehen** statt beim
   Starten. Heute legt `schedule_berkat_show` nur eine `scheduled_lives`-Zeile an, und
   `link_live_session_to_scheduled` verbindet beides erst hinterher.
3. Käufer sehen die Artikel vor dem Start — das ist der Grund, warum sich 1 und 2 lohnen.

⚠️ **Schritt 2 ist der riskante.** `live_sessions` ist mit Serlo geteilt, und Serlos Listen filtern
auf `status = 'active'`. Eine vorab angelegte Zeile braucht einen Status, den **beide** Apps
korrekt ignorieren — das ist exakt die Klasse von Änderung, die am 14.08. die Live-Liste in allen
drei Oberflächen leer gemacht hätte (Abschnitt 8, „Die App-Trennung").

#### Der geforderte Audit ist gemacht — 18.08.2026

Beide Apps, alle Migrationen, alle Edge Functions durchgesucht; die fünf Kernbefunde am Quelltext
gegengeprüft. **Das Ergebnis in einem Satz: Der naheliegende Weg ist versperrt, der andere ist
gangbar und kostet vier Eingriffe.**

**Warum `status = 'active'` für die Vorab-Zeile NICHT geht** — vier Stellen, jede allein tödlich:

| Wo | Was passiert |
|---|---|
| `20260415000000_cleanup_cron.sql:44` + `functions/cleanup-stale-lives` | Setzt **alle 5 Minuten** jede `active`-Zeile mit `updated_at` älter als 10 Minuten auf `ended` — **ohne app-Filter**. Eine Tage vorher angekündigte Show ist tot, bevor sie beginnt. |
| `apps/berkat/lib/useStudio.ts:42` (`useMyShow`) | `order('started_at' desc).limit(1)` — die Vorab-Zeile verdrängt die **echte laufende** Show. Studio-Steuerung und „Beenden" zeigen auf die falsche Session. |
| `lib/useLiveSession.ts:363` + `apps/web/app/actions/live-host.ts:77` | Der Zombie-Cleanup beendet beim nächsten echten Live-Start **alle** `active`-Zeilen des Hosts — die Vorab-Zeile samt der daran hängenden Artikel. |
| Startseite, Kategorien, Aktivität, Verkäuferprofil (Berkat) | Zeigen leere Geisterzeilen; `get_berkat_category_counts` zählt sie mit. |

**Der Weg über einen neuen Status (`'planned'`) funktioniert** — er verlangt vier Eingriffe, und
der zweite ist der, den man übersieht:

1. **CHECK-Constraint erweitern.** `live_sessions_status_check` erlaubt heute ausschließlich
   `'active'` und `'ended'` (`supabase/schema_live.sql:13115`); ein INSERT mit `'planned'`
   scheitert mit `23514`.
2. ⚠️ **Der Go-Live-Push ginge verloren.** `trg_notify_followers_on_go_live`
   (`20260519210000_live_notification_recovery.sql`) ist **AFTER INSERT ONLY**. Wird die Zeile als
   `'planned'` angelegt und später auf `'active'` gedreht, feuert er **nie** — die Fassung mit
   Mute-Respekt und Backlog-Deckel fällt ersatzlos aus. Muss auf
   `AFTER INSERT OR UPDATE OF status`.
3. **Statusfilter nachrüsten**, wo heute gar keiner steht und eine Vorab-Zeile durchkäme:
   `apps/web/lib/data/studio.ts:458` und `:532`, `apps/web/app/studio/moderation/page.tsx:41`,
   die View `creator_live_history` — und in Berkat der **Bild-Rückfall** in
   `20260816180000`/`20260816190000` (`ORDER BY started_at DESC` ohne Statusfilter: das Cover
   einer nie gelaufenen Vorab-Show würde zum Fallback des nächsten Termins) sowie
   `search_berkat_sellers`.
4. **Entscheiden, ob die Artikel einer geplanten Show vorab öffentlich sind.**
   `live_auctions_select` erbt von der Session nur `women_only`, **nicht den Status** — die Ware
   wäre ab dem Anlegen für jeden lesbar. Das ist Schritt 3 des Plans oben und damit vermutlich
   gewollt; es muss nur eine Entscheidung sein und kein Nebeneffekt.

Und die gute Nachricht, die den ganzen Umbau erst lohnend macht: **`create_live_auction` prüft
weder Status noch App**, nur `host_id = auth.uid()` (`20260817130000:64`). Die Vorabzuordnung von
Artikeln braucht dort **keine Änderung**.

Zusätzlich zu bedenken: Jede **neue Spalte** auf `live_sessions` (etwa `scheduled_id`) ist wegen
der eingefrorenen Spaltenliste für die Clients unsichtbar und braucht ihr eigenes
`GRANT SELECT (spalte)` — siehe Abschnitt 3.

#### ~~Nebenbefund aus demselben Audit: die App-Trennung hat ein fünftes Loch~~ — Web erledigt 18.08.2026

`creator_live_history` hat **kein `WHERE`** — weder Status noch App — und
`apps/web/lib/data/live-host.ts:104` (`getMyPastSessions`) filtert nur auf `host_id`. **Berkat-Shows
erscheinen damit schon heute in Serlos Web-Studio unter „Vergangene Sessions".** Kein Datenleck
(jeder sieht nur die eigenen), aber die App-Trennung von `20260814280000` ist an dieser Stelle nicht
durchgezogen. Fällt heute nur nicht auf, weil genau eine Person beide Apps benutzt.

Der Fix ist nicht einzeilig: Die View gibt `app` gar nicht aus, man kann also nicht auf ihr
filtern. Entweder die View um die Spalte erweitern (Migration, geteilte View der Produktions-App)
oder die zweite Abfrage in `getMyPastSessions`, die ohnehin auf `live_sessions` geht, als Filter
benutzen.

**Gemacht: der zweite Weg, ohne Migration.** `getMyPastSessions` fragt jetzt **zuerst**
`live_sessions` (`host_id` + `app = 'serlo'`, sortiert, `limit`) und reichert die Treffer danach
aus der View an. Keine Änderung an einer View, die die ausgelieferte Serlo-App mitbenutzt — also
kein Risiko an `security_invoker` (`20260814270000`) und an den Grants. Nur ein Vercel-Deploy, keine
Rollout-Reihenfolge.

Zwei Dinge, die dabei nicht offensichtlich waren:

- **Nachträglich filtern hätte zu wenig gezeigt.** Der naheliegende Weg — View wie bisher mit
  `limit` abfragen, Berkat-Zeilen danach verwerfen — verbraucht das Fenster von 30 schon vor dem
  Filter. Bei 20 Berkat-Sessions im Backfill wären in Serlos Studio ein Dutzend übrig geblieben,
  und es hätte wie ein zweiter Fehler ausgesehen. Zuerst `live_sessions` zu fragen liefert genau
  die letzten 30 **Serlo**-Sessions.
- **Der Filter funktioniert nur wegen `20260814290000`.** `app` ist eine nachgereichte Spalte auf
  `live_sessions` und damit von der eingefrorenen Spaltenliste nicht gedeckt (Abschnitt 3). Das
  eigene `GRANT SELECT (app)` steht — sonst wäre schon der Filter ein `42501`.

⚠️ **Offen: dieselbe Lücke in der nativen Serlo-App.** `lib/useCreatorLiveHistory.ts:58` liest
dieselbe View mit `select('*')` und filtert ebenfalls nur auf `host_id`; angezeigt wird sie in
`app/creator/live-history.tsx`. **Dort stehen die Berkat-Shows weiterhin drin.** Der Web-Fix greift
nicht, weil die native Abfrage gar nicht erst auf `live_sessions` geht. Und der Trick von oben ist
dort nicht wiederholbar, ohne den Hook auf zwei Abfragen umzubauen.

Der geradere Weg für nativ ist deshalb doch der **erste**: die View um `app` erweitern
(`CREATE OR REPLACE VIEW`, `security_invoker = on` danach **prüfen**, Grants explizit neu setzen —
Regel aus `20260419250000`), dann `.eq('app', 'serlo')` im Hook. Das ist eine Migration **plus** ein
OTA (`eas update`, `EAS_BUILD=1`) und braucht damit die Reihenfolge aus `20260814280000` — also eine
Entscheidung, keine Nebensache. Bis dahin: nur das Web ist sauber.

### ~~Angefangen und bewusst gestoppt: der Verkaufen-Bildschirm~~ — gebaut am 18.08.2026

Zaur am 18.08. mit Screenshots aus Whatnots Verkäufer-Onboarding: *„es hat sehr viele Auswahlfelder,
dadurch wird die Seite sehr lang und unübersichtlich."*

Stimmt. Der `SchedulePlanner`-Block trug **elf Kacheln plus zwei Hinweistexte**: 7 Tage, bis zu
4 Zeiten (3 relative + absolute Stunden), 2 Rhythmus-Kacheln — ein halber Bildschirm für eine
Entscheidung. **Umgesetzt wie geplant**, am Simulator durchgespielt:

```
📅 Nächsten Termin ankündigen
[Bild] [Titel]
┌────────────────────────────────────────┐
│ Wann?     Heute 20:00 · jede Woche   › │   ← EINE antippbare Zeile
└────────────────────────────────────────┘
[ Ankündigen ]
```

Tippen öffnet ein `pageSheet`-Blatt („Wann sendest du?") mit **denselben Kacheln**, überschrieben
mit „Tag" und „Uhrzeit", darunter „Übernehmen: Heute 20:00 · 4 Termine". Blatt zu, Hauptseite kurz.

Drei Dinge, die beim Umbau entschieden wurden und nicht offensichtlich sind:

- **Der Hauptknopf heißt jetzt „Ankündigen"**, nicht mehr „Ab Di 20:00 — jede Woche". Der Termin
  steht eine Zeile darüber; ihn zweimal zu nennen war die Verdopplung, die die Karte lang machte.
  Nur der Fehlerfall bleibt am Knopf („Dieser Zeitpunkt ist schon vorbei"), weil er sonst nirgends
  stünde.
- **„Übernehmen" schließt nur das Blatt, es trägt nichts ein.** Eingetragen wird auf der
  Hauptseite. Sonst gäbe es zwei Knöpfe, die dasselbe zu tun scheinen, und der zweite gewinnt.
- **Der Knopf im Blatt ist bei totem Zeitpunkt gesperrt** — wer dort übernehmen könnte, trüge eine
  Auswahl nach draußen, die der Server ohnehin ablehnt.

⚠️ **Kein nativer Datums-/Zeit-Wähler.** Zwei Gründe, und beide sind entschieden:

- `@react-native-community/datetimepicker` ist ein **natives Modul** → EAS-Build.
- Wichtiger: Abschnitt 13 begründet die Kacheln inhaltlich — *„Ein freier Zeitstempel lädt zu
  ‚irgendwann Dienstag halb neun' ein; das Ritual ist aber die Wiederholung."* Ein Kalender
  zerstört genau das Ritual, das der Sendeplan erzeugen soll.

Die Kacheln sind also geblieben. Sie stehen nur eine Ebene tiefer, und die Hauptseite zeigt das
**Ergebnis** statt des Entscheidungsbaums.

Am Gerät geprüft: Zeile zeigt „Heute 20:00 · jede Woche", Blatt öffnet, „in 30 Min" blendet den
Rhythmus-Block aus (eine spontane Sendung ist keine Reihe), Zeile steht danach auf „in 30 Min".

**Was aus den Screenshots noch zu lernen wäre, aber nicht entschieden ist:**

- **Eine Frage pro Bildschirm.** Whatnots Onboarding klappt nichts ein, es *trennt*:
  Regeln → Kategorie → USt-ID, jede mit eigenem „Weiter" und Fortschrittsbalken.
- **Gesperrte Schritte.** Ihre Checkliste zeigt „Erstelle deine Show ›" offen und die drei
  darunter mit Schloss. Berkats „Deine ersten Schritte" zeigt alle vier gleichzeitig und
  *empfiehlt* nur. Whatnot lässt gar nicht erst zu, dass man das Falsche zuerst tut — das ist
  die radikalere Antwort auf „lang und unübersichtlich".
- **Frist mit Belohnung** („14 Tage, erste 400 € verdoppelt") — Angebots-Akquise, wie in
  Analyse 1 beschrieben.

### Der eine Punkt, der alles andere blockiert

**Das zweite Konto.** Vier Wege sind gebaut und nur logisch belegt, nie durchlaufen:

1. **Kauf** — `seller_cannot_bid` greift vor allem anderen, ein Kauf am eigenen Artikel ist
   unmöglich.
2. **„Nachricht" statt „Kaufen"** — sichtbar nur an einem fremden Angebot ohne Kassen-Freigabe.
3. **Merken** — das Herz erscheint nur an fremden Artikeln.
4. **Preisvorschlag** — das Feld erscheint nur für einen fremden Käufer.

Alle vier hängen an derselben Sache. **Ein Konto anzulegen und ein Passwort einzugeben ist nichts,
was ein Assistent tut** — das ist Zaurs Handgriff, und danach ist die ganze Kette in wenigen
Minuten belegt.

### Kleinkram, offen und begründet

- **Anti-Snipe-Zeit vom Verkäufer wählbar** plus „Sudden Death" — Whatnot hat beides, Berkat hat
  `extendSeconds: 10` fest verdrahtet (`theme/tokens.ts`).
- **Varianten** (Größe/Farbe an einem Artikel) — wichtig für Abaya, Hijab, Mode, Schuhe. Erst mit
  einem echten Verkäufer, vorher Schema-Arbeit ins Blaue.
- ~~**Zustands-Leitfaden**~~ — **erledigt am 18.08.2026.** Jeder der sechs Zustände in `CONDITIONS`
  (`lib/useBerkatSeller.ts`) trägt jetzt ein `hint`; der Composer zeigt den Satz zur **gewählten**
  Kachel, nicht alle sechs. Am Gerät gesehen: „Sehr gut" → „Kaum benutzt, keine sichtbaren Mängel."
  Der Maßstab steht damit dort, wo der Verkäufer die Angabe macht — beim Privatverkauf ohne
  Gewährleistung ist genau sie das, woran er gemessen wird.
- **Verkäufer-Analytics** — Whatnots Seller Hub hat sie, Berkat gar nichts.
- **Bilder umsortieren** geht nur über Entfernen und neu Hinzufügen (Zieh-Sortierer bräuchte
  `react-native-gesture-handler` → Build).
- **Impressums-Formular im Konto** — Spalten stehen, Formular fehlt.

---

## 27. Die Startseite zeigt das Regal (18.08.2026, abends)

Erste Umsetzung aus der **vierten Whatnot-Analyse** (Design). Kein neues Feature — eine Fläche, die
94 % der Zeit nichts tat, tut jetzt etwas.

### Was vorher da stand

Läuft keine Show, zeigte die Startseite eine Ähre, den Satz „Gerade ist niemand live" und einen
Knopf „2 Angebote ansehen", der ins Regal führte. Alles handwerklich sauber — und trotzdem der
falsche Bildschirm: **Das ist der Zustand, den fast jeder Besucher sieht** (fünf Verkäufer × zwei
Stunden pro Woche, Abschnitt 17). Die wichtigste Fläche der App verwies also im Normalfall auf
einen anderen Bildschirm, statt selbst etwas zu zeigen.

Aus der Analyse: *„Ein Regal erzeugt keine Nachfrage. Es hält Nachfrage, die schon da ist."* Wer
die App öffnet, **hat** Nachfrage. Sie einen Tipp weit wegzuschicken verschenkt sie.

### Was jetzt passiert

Im Ruhezustand — keine Show, keine Suche, kein Filter — füllen bis zu acht Angebote aus dem Regal
dasselbe zweispaltige Raster, unter einer Zeile, die beides sagt: „Gerade ist niemand live / Aus
dem Regal — rund um die Uhr kaufbar, auch ohne Sendung." Gibt es mehr als die gezeigten, steht
unter dem Raster der Weg ins ganze Regal.

Vier Entscheidungen, die nicht offensichtlich sind:

- **Nie beides zugleich.** Läuft auch nur eine Show, gehört das Raster ihr allein. Eine laufende
  Sendung ist immer das Wichtigere, und zwei Sorten Karten nebeneinander wären zwei Antworten auf
  eine Frage.
- **Bei Suche und Filter bleibt alles wie es war.** Die Trefferliste steht im Kopf, das Regal
  erscheint nicht — am Gerät gegengeprüft: „Kaffee" tippen zeigt weiterhin Verkäufer- und
  Artikeltreffer oben und „Keine laufende Show" darunter.
- **`ListingCard`, nicht nachgebaut.** Dieselbe Karte wie Marktplatz und Kategorie. An ihr hängt
  die Anbieterkennzeichnung nach Art. 246d § 1 EGBGB; eine zweite Abschrift wäre genau der Fehler,
  für den es die Komponente überhaupt gibt (Abschnitt 21).
- **Das Regal lädt nur im Ruhezustand** (`useShopListings(limit, enabled)`). Laufen Shows, fragt
  die Startseite es gar nicht erst ab.

⚠️ **Ein zweiter `useProfiles`-Aufruf ist Absicht.** Die Kette läuft `profiles → visible → idle →
shelf`; die Verkäufer der Regal-Artikel in dieselbe Liste zu hängen wäre ein Ring. React Query
teilt beiden Aufrufen denselben Zwischenspeicher, und bei leerem Regal fragt der zweite wegen
`enabled: ids.length > 0` überhaupt nicht.

### Die Kategorie-Leiste verschwindet, wenn sie nichts filtert

Beim Prüfen am Gerät sofort sichtbar geworden: Die Leiste zeigte im Ruhezustand eine einzelne
goldene Kachel „Für dich" — 104 Punkte hohes, leeres Gerüst über der Ware, immer aktiv, ohne
Wirkung. Sie filtert **laufende Shows**; gibt es keine, gibt es nichts zu filtern. Sie erscheint
jetzt erst ab zwei Einträgen.

Das ist derselbe Gedanke wie beim Regal: **Zeig, was es gibt — nicht das Gerüst, in dem etwas
stehen könnte.**

### Geprüft und ungeprüft

Am Simulator durchgespielt: Ruhezustand mit zwei Angeboten, Suche „Kaffee" (Treffer oben, Regal
korrekt weg), Rückkehr in den Ruhezustand. `tsc` und `expo export` sauber, keine Migration, kein
Build.

**Nicht geprüft:** der Fuß-Knopf „Alle N Angebote ansehen" — er erscheint erst ab mehr als acht
Angeboten, und es liegen zwei in der Datenbank. Die Bedingung ist
`idle && shopCount > shelf.length && shelf.length > 0`.

### Die Gold-Regel ist jetzt gegen ihren eigenen Sonderfall gesichert

Aus derselben Analyse, in `theme/tokens.ts` festgeschrieben: Whatnots Kaufknopf im Regal ist
`rgba(0,0,0,0.05)` — fast unsichtbares Grau —, ihr Signalgelb gehört „Folgen". Der Grund ist
Arithmetik: Fünfundzwanzig goldene Knöpfe untereinander sind keine Hervorhebung mehr, sondern eine
Wand.

Berkat hält die Regel heute ein, **ohne es zu wissen** — `ListingCard` hat gar keinen Kaufknopf.
Der Kommentar am Token sagt jetzt, warum das so bleiben muss und was zu tun ist, falls sich das je
ändert: Knopf im Raster grau, nicht gold.

---

## 28. Hochformat — die Karten (18.08.2026, spät)

Zaurs Fund, nicht meiner. Nach der Design-Analyse (vierter Teil) sein Einwand: *„die Anzeige
Kärtchen und Bilder sind Hochformat, unser Design im Allgemeinen kommt nicht an Whatnot ran."*
Beides zutreffend — und der erste Punkt war messbar.

### Warum die Analyse ihn verfehlt hat

Die vierte Analyse hatte die **Web**-Fassung von Whatnot vermessen. Die ist ein anderes Produkt:
drei Spalten, Video in einem schwarzen Kasten, Chat als eigene Spalte. Der Store-Screenshot der
**App** zeigt etwas völlig anderes — randloses Vollbild-Hochformat, alle Bedienelemente als
Overlay auf dem Video, unten ein gelber Gebots-Knopf über die volle Breite.

Lehre für die nächste Analyse: **Bei einer App ist die Web-Fassung nicht die Quelle.** Die
offiziellen Store-Screenshots sind kostenlos, offiziell, aktuell und in der Landessprache — über
`itunes.apple.com/search?term=…&entity=software&country=de` kommt man in einem Aufruf an sie heran.

### Was geändert wurde

`aspectRatio: 1` stand an sechs Stellen. Es war nie eine Entscheidung, sondern der Vorgabewert des
ersten Rasters, fünfmal abgeschrieben. Neu ist ein Token in `theme/tokens.ts`:

```ts
export const ratio = { card: 4 / 5, tile: 1 };
```

Auf `card` (hochkant) stehen jetzt die **Stöber**-Flächen: Angebots-Karte (`ListingCard`, Raster),
Show-Karte auf der Startseite, „Demnächst"-Karte, die Galerie der Artikelseite und das Raster
verkaufter Artikel im Verkäufer-Profil. Auf `tile` (quadratisch) bleiben die **Arbeits**-Flächen:
die Zeilen-Vorschau in Listen und das Bild in der Bestellung. Das ist die Regel aus Abschnitt 18 —
„was schaue ich mir an" gegen „welches meine ich" —, nur zum ersten Mal auch beim Format angewandt.

Bei gleicher Spaltenbreite zeigt eine 4:5-Karte rund ein Viertel mehr Ware als ein Quadrat. Für
Abaya, Kleider, Schuhe und Menschen ist das kein Geschmack, sondern der Unterschied zwischen
„Produkt sichtbar" und „Produkt angeschnitten".

### Der Zuschnitt musste mit — sonst wäre es eine Verschlechterung gewesen

Eine 4:5-Fläche mit quadratisch zugeschnittenen Bildern zu füllen heißt, seitlich ein Fünftel
wegzuschneiden. Deshalb hat `CropShape` einen dritten Wert: `'portrait'`.

Er verhält sich wie `'wide'` — **kein Zuschnitt-Rahmen** (`allowsEditing: false`), das ganze Bild
wird geladen, `contentFit="cover"` wählt beim Zeichnen. Der Grund ist derselbe wie dort und steht
seit dem 16.08. in Abschnitt 3: Auf iOS ist der Rahmen bei `allowsEditing` **immer quadratisch**,
egal was in `aspect` steht. Ein 4:5-Rahmen wäre ein Versprechen, das die Plattform nicht hält.

Hier ist das sogar der gutmütige Fall: Ein Handyfoto im Hochformat hat 3:4, also fast die
Kartenform — es verliert beim Zeichnen wenige Prozent oben und unten. Umgestellt sind die drei
Aufrufe für Show-Cover, Artikelfotos und Termin-Bild; das Profil-Banner bleibt `'wide'`.

⚠️ **Bestandsbilder bleiben quadratisch zugeschnitten.** Was vor dem 18.08.2026 hochgeladen wurde,
verliert in der neuen Karte seitlich etwas. Das ist sichtbar und nicht reparierbar — die Originale
liegen nicht mehr vor.

### Die Falle, die dabei zugeschlagen hat

Die Galerie der Artikelseite bekam die neue Höhe über `styles.hero`, ihre **Einzelbilder** standen
aber weiter auf `height: screenWidth`. Ergebnis am Gerät: Die Fläche war 4:5 hoch, das Foto darin
quadratisch, und darunter klaffte ein sandfarbener Streifen mit den Blätter-Punkten mittendrin.

**Wer eine Bildfläche umstellt, muss prüfen, ob die Kinder ihre Größe von ihr erben oder selbst
rechnen.** In einer horizontalen `ScrollView` mit `pagingEnabled` rechnen sie selbst — dort steht
die Bildhöhe als Zahl im JSX, nicht im Stylesheet, und ein `aspectRatio` am Elternteil erreicht sie
nicht.

### Geprüft

Am Simulator durchgespielt: Startseite (Regal im Hochformat), Artikelseite (Galerie füllt die
Fläche, kein Streifen mehr), „Alle Angebote". `tsc` und `expo export` sauber, keine Migration, kein
Build.

**Nicht geprüft:** der neue `'portrait'`-Zuschnitt selbst — dafür müsste ein Bild ausgewählt
werden, und der Simulator hat keine Fotomediathek mit brauchbarem Material. Am Gerät ist das ein
Handgriff: ein Foto einstellen und sehen, ob der Wähler ohne Zuschnitt-Rahmen kommt.

---

## 29. Die Kategorie-Leiste wird zur Entdeckungs-Leiste (18.08.2026, nachts)

Zweite Umsetzung aus der Design-Analyse, und die erste, die einen **Denkfehler** behebt statt einer
Optik.

### Der Fehler

Die Leiste auf der Startseite wurde aus den **laufenden Shows** aufgebaut. Sie war damit genau dann
leer, wenn niemand sendet — also rund 94 % der Zeit —, und beantwortete ausgerechnet dann nichts,
wenn jemand etwas zum Stöbern gesucht hätte. Am Nachmittag des 18.08. wurde sie deshalb
ausgeblendet, sobald nur noch „Für dich" übrig blieb. Das war richtig gegen das leere Gerüst, aber
es kurierte ein Symptom: **Die Leiste beantwortete die falsche Frage.**

Whatnots Leiste zeigt **alle** Kategorien, immer, unabhängig davon ob dort jemand sendet. Sie sagt
„was gibt es hier?"; „was läuft gerade?" beantwortet das Raster darunter ohnehin.

### Was jetzt da steht

Alle zwölf Oberkategorien, sortiert nach Wärme: erst die mit laufenden Shows, dann die mit Ware im
Regal, dann der Rest alphabetisch. Jede Kachel trägt Name, Bild und eine Zahl — `3 live`, sonst
`12 kaufbar`, und wenn beides fehlt, nichts (eine Null ist kein Stand).

Die Zahlen kommen aus `get_berkat_category_counts`, also demselben Abruf, den der Kategorien-Reiter
schon macht. **Nicht selbst nachgerechnet:** Die RPC rollt Kinder auf die Eltern auf (eine Show
unter „Abaya" zählt auf „Mode") und achtet dabei die Frauen-Only-Grenze, weil sie `SECURITY
INVOKER` ist. Eine eigene Rechnung im Client wäre eine zweite Wahrheit über dieselbe Zahl gewesen —
und eine, die den Schutz nicht kennt.

### ⚠️ Der Filter musste aufs Regal wirken — sonst wäre die Leiste eine Verschlechterung gewesen

Der wichtigste Teil dieser Änderung, und er ist nicht sichtbar. Bis dahin schloss ein gesetzter
Filter den Ruhezustand aus: Das Raster zeigte dann nur Shows der Kategorie. Mit einer Leiste, die
alle zwölf Kategorien anbietet, hätte der **häufigste** Tipp auf eine Kategorie geführt, in der
gerade niemand sendet — und mit „Nichts gefunden" geantwortet, obwohl dort Ware liegt.

Deshalb hängt der Ruhezustand jetzt nur noch an „keine Show im Raster, keine Suche". Bei gesetztem
Filter lädt `useCategoryListings` die Kategorie **samt ihrer Kinder** („Mode" muss zeigen, was unter
„Abaya" liegt), sonst `useShopListings` das ganze Regal. Immer nur eine der beiden Abfragen ist
aktiv.

Zwei Dinge, die am Gerät sofort auffielen und mitgehen mussten:

- **Die Erklärzeile war weg**, weil der ganze Listenkopf an `filter === ALL` hing. Man sah Ware
  ohne Grund. Sie nennt jetzt die Kategorie: „Nichts live in Beauty & Duft".
- **Der Fuß-Knopf log.** Er zeigte den Gesamtbestand und führte ins ganze Regal — bei gesetzter
  Kategorie also die falsche Zahl und ein Weg, der die eben getroffene Wahl wegwirft. Jetzt führt
  er nach `/category/<slug>` und zählt die Kategorie.

### Die Bilder — vorbereitet, nicht fertig

Neue Datei `theme/categoryArt.ts`: je Kategorie ein Symbol und ein gedeckter Farbton. Sie ist die
**einzige** Stelle, die beim Bildtausch angefasst werden muss — `photo` je Eintrag füllen, fertig.
Kachelgröße, Raster und Textanordnung bleiben unberührt, und beide Flächen (Leiste und
Kategorien-Reiter) lesen dieselbe Zuordnung.

Whatnot hat dort **freigestellte Produktfotos** auf farbigem Grund, keine 3D-Renderings — das stand
bis heute falsch im Quelltext des Kategorien-Reiters. Freistellen genügt also. Zaur macht die
Bilder später; bis dahin steht an der Stelle das Symbol.

### Zwei Fehler, die am Gerät sichtbar wurden

- **Namen abgeschnitten.** Bei 88 Punkten Breite und einer Zeile endete „Beauty & Duft" nach dem
  Kaufmanns-Und. Zwei Zeilen, Kachel von 92 auf 100 Punkte.
- **„Für dich" war eine leere goldene Fläche.** Der Eintrag ist keine Kategorie und trägt deshalb
  kein Symbol (`art: false`) — dann muss der Text aber in die Mitte, sonst steht er oben und
  darunter klafft nichts. Dass die Kachel anders aussieht als die übrigen, ist richtig: Sie ist
  keine Kategorie.

### Geprüft

Am Simulator: Leiste voll mit zwölf Kategorien und Zählern, Tipp auf „Beauty & Duft" zeigt das
Parfüm mit der richtigen Überschrift, Rückkehr auf „Für dich" zeigt wieder das ganze Regal. `tsc`
und `expo export` sauber, keine Migration, kein Build.

**Nicht geprüft:** der Fuß-Knopf in einer Kategorie mit mehr als acht Artikeln, und die Sortierung
nach laufenden Shows — dafür müsste gesendet werden.

---

## 30. Suche und Sortierung im Regal (18.08.2026, nachts)

Erste Umsetzung aus der **fünften Analyse** (die übrigen Flächen der App). `/shop` war eine flache
Liste ohne jede Möglichkeit, etwas zu finden — bei zwei Artikeln egal, ab fünfzig unbrauchbar.
Whatnots Shop-Liste hat Suche und Chips, seit sie Bestand haben.

### Eine Schwelle statt eines Entweder-Oder

Im Kopf von `app/shop.tsx` stand ausdrücklich **„bewusst ohne Filter, Suche und Umkreis"**, mit der
Begründung: *„Eine Filterleiste über zwei Artikel ist keine Hilfe, sondern Beschäftigung."*

Die Begründung ist richtig und gilt weiter — sie ist nur nicht mehr die ganze Wahrheit, sobald das
Regal wächst. Aufgelöst über `TOOLS_FROM = 8`: Unter acht Artikeln erscheint die Leiste nicht,
darüber schon. Acht ist eine volle Rasterseite; darunter sieht man ohnehin alles auf einmal, und
ein Werkzeug für etwas, das man schon überblickt, ist nur eine Zeile weniger Ware auf dem Schirm.

**Das Muster ist übertragbar** und wurde am selben Tag schon zweimal gebraucht (Kategorie-Leiste
ab zwei Einträgen, Fuß-Knopf ab mehr Ware als gezeigt): Wenn eine alte Entscheidung „zu wenig
Daten" lautete, ist die Antwort meist eine Schwelle und kein Widerruf.

### Was drin ist

- **Suche** über **Titel und Ort** — „Abaya" oder „Berlin". Die Beschreibung bleibt bewusst
  draußen: Drei Sätze Fließtext liefern zu viele Zufallstreffer.
- **Sortierung** als Chips: Neueste · Günstigste · Teuerste. Dunkel, nicht gold — eine Sortierung
  ist kein Kaufweg (`theme/tokens.ts`).
- Die **Kopfzeile zählt mit**: ohne Suche „2 Artikel · rund um die Uhr", mit Suche „1 Treffer".
  Die Artikelzahl über drei sichtbaren Karten wäre eine Auskunft über etwas, das man gerade nicht
  sieht.
- Ein **Löschknopf** im Feld. Ohne ihn kommt man aus einer Suche nur mit zwölfmal Rücktaste heraus.

### ⚠️ Der Leerzustand redet über die richtige Menge

Sucht jemand „Parfxzy" und findet nichts, steht dort **nicht** „Noch nichts im Regal" — das Regal
ist voll, es passt nur nichts zum Wort. Stattdessen: „Nichts für „Parfxzy"", der Hinweis, dass in
Titel und Ort gesucht wird, und ein Knopf zurück zu allen Artikeln.

Das ist derselbe Fehler, der am 18.08.2026 auf der Startseite gefunden wurde (Suche fand
„Kaffeetasse", darunter stand „Nichts gefunden"). Er entsteht immer gleich: Ein Leerzustand gehört
einer Liste, aber der Text redet über den ganzen Bestand.

### ⚠️ Die Grenze dieser Lösung

Gefiltert und sortiert wird **im Client**, über die geladenen Zeilen. Das ist bei
`useShopListings()` mit seiner Grenze von 60 richtig und wird falsch, sobald das Regal darüber
hinauswächst: Dann durchsucht die Leiste die ersten sechzig und behauptet, das sei alles. **Wer die
Grenze anhebt, muss Suche und Sortierung in dieselbe Abfrage schieben** — der Kommentar steht im
Kopf der Datei.

### Geprüft

Am Simulator mit **vorübergehend auf 1 gesenkter Schwelle** durchgespielt, weil zwei Artikel in der
Datenbank liegen: Leiste erscheint, „Günstigste" sortiert 35 € vor 64 €, „Parf" filtert auf einen
Treffer und die Kopfzeile schaltet auf „1 Treffer", „Parfxzy" zeigt den richtigen Leerzustand mit
Rückweg. Danach `TOOLS_FROM` zurück auf 8 und gegengeprüft, dass die Leiste bei zwei Artikeln
wieder verschwindet. `tsc` und `expo export` sauber, keine Migration, kein Build.

**Nicht geprüft:** das Verhalten ab echten sechzig Artikeln — also genau der Fall, für den die
Leiste gebaut ist.

---

## 31. Testware im Regal — und was sie sofort sichtbar machte (18.08.2026, nachts)

### Das Skript

`scripts/seed-berkat-shop.mjs` legt 36 Artikel über 31 Unterkategorien an: Abaya, Hijab,
Abendmode, Schuhe, Taschen, Gold- und Silberschmuck, Uhren, Oud, Gebetsteppich, Quran,
Kinderbücher. Preise von 14 € bis 249 €, gemischte Zustände, zwölf deutsche Städte, ein Teil mit
Preisvorschlag, mehrere mit zwei Bildern.

```bash
SERVICE_ROLE_KEY=<key> node scripts/seed-berkat-shop.mjs
SERVICE_ROLE_KEY=<key> node scripts/seed-berkat-shop.mjs --remove
```

Der Schlüssel kommt aus der Umgebung und steht nirgends im Repo — dasselbe Muster wie beim älteren
`scripts/seed-posts.js`. Jeder erzeugte Artikel trägt `[testware]` am Ende der Beschreibung; daran
hängt `--remove`.

**Zwei Entscheidungen, die Wege freischalten:** Die Ware gehört **fremden** Profilen, nicht dem
eigenen Testkonto — dadurch erscheinen Kaufknopf, Merken-Herz und Preisvorschlag erstmals
überhaupt (die vier Wege, die laut Abschnitt 26 am zweiten Konto hingen). Und ein Verkäufer steht
auf `kind = 'business'`, damit der gewerbliche Zweig der Artikelseite samt Impressumsblock endlich
befüllt ist.

⚠️ **Die Bilder sind direkte Unsplash-URLs, keine Kopie nach R2.** Für Testware richtig — spart den
Upload und hinterlässt beim Aufräumen nichts. Für echte Angebote wäre es falsch: Die hängen sonst
an einer fremden Domain.

⚠️ **Stolperstein beim ersten Lauf:** Die Beispielzeile enthielt `sb_secret_…` mit einem echten
Auslassungszeichen. Wer sie kopiert, schickt U+2026 in einen HTTP-Header und bekommt
`Cannot convert argument to a ByteString … value of 8230`. Das Skript prüft den Schlüssel jetzt
vorab auf Nicht-ASCII und auf Mindestlänge und sagt, was zu tun ist.

### Was der Bestand sofort sichtbar machte

Mit 38 Artikeln sieht die App aus wie ein anderes Produkt — dieselben Bildschirme, dieselbe
Gestaltung. Das ist die Bestätigung der These aus der fünften Analyse: **Ein Teil des Abstands zu
Whatnot war nie Gestaltung, sondern Inhalt.**

Und es machte zwei Dinge sichtbar, die vorher unsichtbar waren, weil zwei Artikel sie nicht
auslösen konnten — beides in Abschnitt 32.

---

## 32. Filter, Ort und Preis im Regal (18.08.2026, nachts)

Damit ist der alte Satz „bewusst ohne Filter, Suche und Umkreis" vollständig abgetragen. Suche und
Sortierung kamen in Abschnitt 30; hier der Rest.

### Ein Blatt, kein Chip-Teppich

Der Filter sitzt hinter einem Knopf **vor** den Sortier-Chips — er verändert, WAS man sieht, die
Sortierung nur die Reihenfolge. Der Knopf trägt die Zahl der aktiven Filter: Ein Filter, den man
nicht sieht, erklärt später kein halb leeres Regal.

Das Blatt selbst ist dasselbe Muster wie das Wann-Blatt im Sendeplan und das Bearbeiten-Blatt der
Artikelseite. Es wirkt **sofort, ohne „Übernehmen"** — der goldene Knopf unten zeigt stattdessen
mit, was die Auswahl bewirkt: „2 Artikel zeigen", oder „Keine Treffer", bevor man schließt.

### Die Auswahl entsteht aus den Daten

Kategorie, Zustand und Ort werden **aus dem geladenen Bestand gezählt**, nicht aus einer festen
Liste. Was im Blatt steht, hat garantiert mindestens einen Treffer, und die Zahl daneben sagt wie
viele. Eine feste Liste hätte sechs Zustände und 31 Kategorien angeboten, die meisten davon leer —
Auswahlmöglichkeiten, die ins Leere führen, sind schlimmer als keine.

Die Preisstufen richten sich ebenfalls nach dem Bestand: `bis 25 €`, `bis 50 €`, `bis 100 €`
erscheinen nur, solange es überhaupt Teureres gibt.

### ⚠️ Kategorien auf Elternebene — am Gerät gelernt

Zuerst mit **Unter**kategorien gebaut. Das Blatt zeigte einunddreißig Einträge, davon zwanzig mit
„1", und man scrollte an ihnen vorbei, bevor „Zustand" überhaupt sichtbar wurde. Umgestellt auf die
zwölf **Ober**kategorien: Sie passen auf einen Blick und tragen Zahlen, die eine Entscheidung
stützen („Mode 8"). Der Filter vergleicht deshalb auf Elternebene — „Mode" muss auch „Abaya"
durchlassen. Wer feiner filtern will, hat den Kategorien-Reiter mit seinem Baum.

### ⚠️ „Umkreis" heißt Ort, nicht Radius

Ein echter Umkreis („20 km um 13353") braucht Geokoordinaten je Postleitzahl. `live_auctions` trägt
nur `city` und `postal_code` als Text. Die Ortsliste beantwortet dieselbe Frage für den Fall, der
zählt — „ist das bei mir in der Nähe" —, ohne eine Genauigkeit zu behaupten, die die Daten nicht
hergeben. Wer den echten Radius will, braucht zuerst eine PLZ-Geo-Tabelle.

### ⚠️ Derselbe Zähl-Fehler, zum dritten Mal

Am Gerät gesehen: Mit „Mode" und „Berlin" standen zwei Karten da — und darüber **„38 Artikel"**.
Die Kopfzeile schaltete nur bei aktiver SUCHE auf die Trefferzahl um, nicht bei Filtern.

Das ist dieselbe Falle wie am selben Tag auf der Startseite („Kaffeetasse gefunden" über „Nichts
gefunden") und im Leerzustand des Regals. Sie entsteht immer gleich: **Eine Zeile redet über den
ganzen Bestand, während der Bildschirm einen Ausschnitt zeigt.** Wer hier eine dritte Art der
Eingrenzung einbaut, muss sie in dieselbe Bedingung aufnehmen — der Hinweis steht jetzt im Code.

Ebenso der Leerzustand: Er nennt jetzt, ob Suche, Filter oder beides schuld sind, und sein Knopf
räumt genau das weg. Vorher hätte „Suche zurücksetzen" jemanden vor einer weiterhin leeren Fläche
stehen lassen, weil noch ein Filter stand.

### Geprüft

Am Simulator mit echten 38 Artikeln: Blatt öffnet mit zwölf Kategorien, vier Zuständen, dreizehn
Orten und drei Preisstufen. „Mode" + „Berlin" → zwei Treffer, Kopfzeile „2 Treffer", Chip
„Filter · 2". „Schmuck" + „Frankfurt" → der Knopf sagt vorab „Keine Treffer", danach der richtige
Leerzustand mit „Filter zurücksetzen". `tsc` und `expo export` sauber, keine Migration, kein Build.

**Nicht geprüft:** ob die Client-Filterung ab mehr als 60 Artikeln noch die Wahrheit sagt — sie tut
es nicht, siehe die Warnung im Kopf von `app/shop.tsx`.

---

## 33. Die Artikelseite — vier belegte Wege und eine Sackgasse (18.08.2026, nachts)

Erste Prüfung der Artikelseite an **fremder** Ware. Möglich geworden durch die Testware aus
Abschnitt 31: Vorher gehörten beide Angebote dem eigenen Konto, und alles, was nur an fremden
Artikeln erscheint, war unsichtbar.

### Die vier Wege aus Abschnitt 26 — alle vier belegt

An „Abaya Dubai-Stil, Sand" von `amir32` (gewerblich, Frankfurt), am Simulator gesehen:

| Weg | Stand |
|---|---|
| **Merken-Herz** in der Kopfzeile | ✅ erscheint, nur an fremden Artikeln |
| **„Nachricht schreiben" statt „Kaufen"** | ✅ die Leiste zeigt den Kontaktweg, weil der Verkäufer keine Kassen-Freigabe hat |
| **Preisvorschlag** | ✅ „Preis vorschlagen" mit Feld und Senden-Knopf |
| **Gewerblicher Anbieter-Block** | ✅ „Gewerblich · Widerrufsrecht und Gewährleistung — Gewerblicher Verkauf. 14 Tage Widerrufsrecht und gesetzliche Gewährleistung." |

Der gewerbliche Block war seit dem 17.08. ungeprüft, weil es kein Konto mit `kind = 'business'`
gab. Das Seed-Skript setzt einen — deshalb steht er jetzt zum ersten Mal auf dem Schirm.

Ebenfalls belegt: die **Bürgen-Zeile** („berkattest bürgt", grün), die Verkäufer-Karte mit
Bewertung und Versandzeit, der Sammelkorb-Hinweis („Kommt in dasselbe Paket wie deine Zuschläge —
du zahlst nur einmal Versand") und „Mehr von amir32" mit dem Regal des Verkäufers.

**Weiterhin ungeprüft bleibt der Kaufknopf selbst.** Er erscheint erst, wenn
`berkat_sellers.checkout_enabled` gesetzt ist, und das ist eine bewusste Admin-Entscheidung, die
das Seed-Skript nicht vorwegnimmt. Wer ihn sehen will, setzt das Flag für einen Testverkäufer.

### ⚠️ Die Sackgasse: der rote Hinweis führt nirgendwohin

Unter dem Anbieter-Block steht in Rot:

> **Anbieterangaben** — Dieser Verkäufer hat seine Anbieterangaben noch nicht vollständig
> hinterlegt.

Das ist **richtig**: Ein gewerblicher Verkäufer braucht ein Impressum (§ 5 DDG), das Skript hat
`kind = 'business'` gesetzt, aber keine Daten. Die Warnung greift also korrekt.

Nur: **Es gibt keinen Weg, sie abzustellen.** Das Impressums-Formular im Konto fehlt bis heute
(Abschnitt 26, letzter Punkt: „Spalten stehen, Formular fehlt"). Ein gewerblicher Verkäufer sieht
damit an jedem seiner Angebote einen roten Mangel, den er selbst nicht beheben kann.

Solange kein echter gewerblicher Verkäufer existiert, ist das folgenlos. Es ist aber der Punkt, an
dem der erste zahlende Gewerbliche hängen bleibt — und damit rückt das Formular von „Kleinkram"
nach oben.

### Whatnots Produktseite daneben

Aus `blog.teamwhatnot.com/unitedstates/variants` und dem Shopify-Bild:

- Produktzeile im Shop: Bild, Titel, **„Multiple Options"** statt eines Preises, Knopf
  **„Select Options"**
- Das Blatt darunter: **„Choose an Option"** mit `Size 10 · 4 left`, `Size 11 · 3 left`,
  `Size 12 · 4 left` — Auswahl **und Knappheit je Variante** in einer Zeile
- Verkäuferseite: `Create Listing` mit Pflichtfeld-Sternchen, Mengen-Stepper, Variants-Block
  („A T-Shirt mit 3 Größen und 2 Farben ergibt 6 Varianten"), Segmented `Auction | Buy It Now`,
  unten **„Save Draft" neben „Publish"**

**Der Vergleich fällt anders aus als erwartet.** Berkats Artikelseite ist inhaltlich **reicher** —
Anbieterkennzeichnung mit Rechtsfolge, Widerrufsbelehrung, Impressums-Prüfung, Bürgen, Sammelkorb-
Erklärung, Versandzeit des Verkäufers. Nichts davon hat Whatnots Produktseite.

Zwei Dinge fehlen Berkat:

1. **Varianten** (Größe, Farbe) mit „Optionen wählen" statt Kaufknopf. Für Abaya, Hijab und Schuhe
   ist das der Normalfall — von den 36 Testartikeln tragen neun die Größe im Titel, weil es kein
   Feld dafür gibt.
2. **Knappheit je Variante** („noch 3"). Berkat kennt nur „ein Stück oder weg".

Und ein Verkäufer-Detail: **„Entwurf speichern"** beim Einstellen. Berkat hat es nicht; wer beim
Einstellen unterbrochen wird, fängt von vorn an.

### Geprüft

Am Simulator an einem fremden, gewerblichen Artikel: Galerie im Hochformat, Preis, Zustands- und
Ortschips, Anbieter-Block, Beschreibung, Preisvorschlag, Verkäufer-Karte mit Bürgen,
Versandhinweis, Anbieterangaben-Warnung, „Mehr von …". Kein Code geändert — das war eine Prüfung,
kein Umbau.

---

## 34. Die Artikelseite entrümpelt — Pflicht bleibt, Lautstärke geht (18.08.2026, nachts)

Zaurs Einwand nach der Prüfung in Abschnitt 33:

> „Ich denke nicht, dass die Artikelseite der richtige Ort ist für Anbieterkennzeichnung mit
> Rechtsfolge, Widerrufsbelehrung, Impressums-Prüfung, Bürgen, Sammelkorb-Erklärung, Versandzeit.
> Leute wollen beim Kaufen genießen und kriegen dadurch positive Stimmung, sie kommen nicht, um
> eingeschüchtert zu werden."

Berechtigt — aber die sechs Dinge sind nicht dasselbe. **Drei schüchtern ein, drei verkaufen.**

| | Urteil |
|---|---|
| Roter Impressums-Mangel | **weg** aus der Käufersicht |
| Impressumsblock | **verschoben** aufs Verkäufer-Profil |
| Anbieterkennzeichnung + Rechtsfolge | **bleibt**, aber als Zeile statt Kasten |
| Bürgen („berkattest bürgt") | **bleibt** — Vertrauen, nicht Recht |
| Versandzeit („<1h") | **bleibt** — Verkaufsargument |
| Sammelkorb („du zahlst nur einmal Versand") | **bleibt** — gute Nachricht |

### Der rote Satz war der schlimmste Fall

> „Dieser Verkäufer hat seine Anbieterangaben noch nicht vollständig hinterlegt."

Er warnte den **Käufer** vor einem Mangel, den er weder verursacht hat noch beheben kann, und säte
Misstrauen gegen den Verkäufer. Und er warnte in Wahrheit vor **unserer eigenen Lücke**: Das
Formular, mit dem der Verkäufer die Angaben eintragen könnte, fehlt bis heute (Abschnitt 33, „die
Sackgasse"). Für den Verkäufer selbst steht der Hinweis weiterhin an seinen eigenen Angeboten —
dort ist er handlungsleitend statt beunruhigend.

### Das Impressum liegt jetzt auf dem Profil

§ 5 DDG verlangt „leicht erkennbar, unmittelbar erreichbar und ständig verfügbar". Das Profil des
Verkäufers ist genau das: Von jedem seiner Angebote führt ein Tipp dorthin, und die Angaben stehen
an **einer** Stelle statt an dreißig. Auf jeder Artikelseite ausbreiten verlangt das Gesetz nicht.

Fehlen die Angaben, steht dort **nichts** — kein leerer Kasten, keine Warnung.

### Die Pflichtangabe bleibt sichtbar, nur leiser

Aus dem Kasten mit Überschrift und Erklärsatz wurde **eine Zeile zwischen zwei Haarlinien**:
„Gewerblich · Widerrufsrecht und Gewährleistung ⌄". Die Rechtsfolge klappt auf Tipp auf.

⚠️ **Die Zeile selbst ist immer sichtbar.** Auch sie hinter den Tipp zu legen wäre der Fehler aus
Abschnitt 3 („Eine Vorgabe anzeigen und nicht speichern") — bei genau dieser Angabe ist Berkat
schon einmal danebengelegen, und Art. 246d § 1 EGBGB verlangt sie **vor** der Vertragserklärung.
Die Pflicht betrifft, DASS sie dasteht; die Lautstärke ist Gestaltung.

### Die Seite liest sich jetzt als Verkaufsraum

Bild → Preis → Titel → Zustand und Ort → **eine** Pflichtzeile → Beschreibung → Preisvorschlag →
Verkäufer mit Bürgen → Versandhinweis → Mehr von ihm. Drei Blöcke weniger, jede Pflichtangabe
erhalten.

### Geprüft

Am Simulator an einem fremden, gewerblichen Artikel: Zeile steht, klappt auf und zu, Chevron dreht
sich, roter Block ist verschwunden. Auf dem Profil rendert der Impressumsblock korrekt **gar
nicht**, solange keine Daten da sind. `tsc` und `expo export` sauber, keine Migration, kein Build.

**Nicht geprüft:** wie der Impressumsblock mit Inhalt aussieht. Das Seed-Skript setzt die Angaben
für den gewerblichen Testverkäufer jetzt mit — sichtbar wird es beim nächsten Lauf
(`--remove`, dann neu).

---

## 35. Testware zum Zweiten — und zwei Fehler beim Einspielen (19.08.2026)

Der zweite Lauf des Seed-Skripts, diesmal mit Impressumsangaben für den gewerblichen
Testverkäufer. Damit ist der letzte offene Punkt aus Abschnitt 34 belegt: **Der
Anbieterangaben-Block auf dem Verkäufer-Profil steht mit Inhalt** — nach den Bürgen, vor den
Reitern, grau und ruhig.

### Drei Stolpersteine, alle im Skript behoben

**1. Der Platzhalter war kopierbar.** `SERVICE_ROLE_KEY=sb_secret_…` enthielt ein echtes
Auslassungszeichen (U+2026). Wer die Zeile kopiert, schickt es in einen HTTP-Header und bekommt
`Cannot convert argument to a ByteString … value of 8230`. Das Skript prüft den Schlüssel jetzt
vorab auf Nicht-ASCII.

**2. `country` ist keine Freitext-Spalte.** `berkat_sellers` hat
`CHECK (country IS NULL OR country IN ('DE','AT','CH'))`. Das Skript schrieb „Deutschland" und
scheiterte mit `23514`. Die Spalte heißt `country`, sieht nach Text aus und ist eine Auswahl aus
dreien — **vor dem Schreiben in eine geerbte Tabelle gehört die Migration gelesen**, nicht nur der
Spaltenname.

**3. Ein 401 sagte nur „Invalid API key".** Der häufigste Fall ist nicht ein falscher Schlüssel,
sondern der falsche **von zweien**: `anon` und `service_role` stehen im Dashboard direkt
untereinander. Die Fehlerbehandlung nennt jetzt Länge und Anfang des Schlüssels und die zwei
Dinge, die zu prüfen sind — dieselbe Lehre wie in Abschnitt 3 („Eine Fehlermeldung für alles ist
keine Fehlermeldung").

### Ein Anzeigefehler, der aus einer richtigen Datenentscheidung folgte

Im Impressum stand zwischen „60313 Frankfurt am Main" und der E-Mail nackt **„DE"**. Der
Ländercode ist als Datenwert richtig (der CHECK erzwingt ihn), als Zeile in einer Anschrift aber
falsch. `app/seller/[id].tsx` schreibt ihn beim Zeichnen aus: DE → Deutschland, AT → Österreich,
CH → Schweiz.

**Das Muster dahinter:** Ein Wert, der in der Datenbank korrekt normiert ist, ist deshalb noch
lange keine Anzeige. Dasselbe galt für die Kategorie-Slugs („beauty" statt „Beauty & Duft",
Abschnitt 18) und die Zustands-Slugs. Wer eine normierte Spalte direkt rendert, zeigt die
Datenbank statt der Auskunft.

### Ein Testartikel blieb beim Aufräumen liegen

Der erste `--remove`-Lauf ließ „Babyjacke, Gr. 74" stehen; der Tag-Filter fand sie danach nicht
mehr — die Beschreibung trug das `[testware]`-Kennzeichen also nicht, aus ungeklärtem Grund
(möglich: ein Teil-Insert aus einer früheren Fassung des Skripts). **Die Ursache ist nicht
belegt.**

Das Aufräumen greift jetzt auf **zwei** Wegen: über das Kennzeichen UND über die 36 bekannten
Titel aus `ITEMS` (nur `status = 'listed'`, damit ein gleichnamiger verkaufter Artikel eines
echten Nutzers nicht mitgeht). Es läuft in einer Schleife und meldet am Ende, wenn doch etwas
übrig bleibt — ein Aufräumen, das schweigend unvollständig bleibt, ist schlimmer als keines.

### Stand

38 Artikel im Regal, sechs Verkäufer, davon einer gewerblich mit vollständigem Impressum.
`tsc` und `expo export` sauber, keine Migration, kein Build.

---

## 36. Das Impressums-Formular — die Sackgasse ist zu (19.08.2026)

Der letzte Punkt aus Abschnitt 33. Seit dem 16.08. stehen die Spalten, die RPC
`set_berkat_seller_kind` nimmt **jedes** Feld entgegen, und die App prüft auf Vollständigkeit —
**eintragen konnte man sie nie.** Ein gewerblicher Verkäufer sah an jedem seiner Angebote einen
Mangel, den er selbst nicht beheben konnte. Neu: `app/seller-details.tsx`, erreichbar über eine
Zeile im Konto.

**Am Server war nichts zu tun.** Der ganze Weg lag fertig da — Hook (`useDeclareSellerKind`), Typ
(`SellerDeclaration`), RPC mit neun Parametern. Es fehlte die Oberfläche. Das ist derselbe Befund
wie bei der Beschreibung (Abschnitt 3, „Ein Feld, das geschrieben und nie gelesen wird"): Die Kette
war an jedem Glied vollständig, nur das letzte fehlte.

### Entscheidungen

- **Jeder sieht die Zeile, nicht nur Gewerbliche.** Der Anbietertyp ist die erste Wahl auf dem
  Bildschirm; wer von privat auf gewerblich wechselt, braucht die Felder direkt darunter. Sie
  hinter dem Typ zu verstecken hieße, jemanden erst umschalten zu lassen und ihm dann zu sagen,
  dass jetzt etwas fehlt.
- **Der rote Hinweis „unvollständig" erscheint nur, wenn wirklich etwas fehlt** — ein Mahnzeichen
  an einem Privatkonto wäre eine Aufforderung ohne Anlass.
- **Die Felder erscheinen nur im gewerblichen Fall.** Die Anschrift einer Privatperson gehört
  nicht auf ein öffentliches Profil, und ein leeres Formular ist eine Aufforderung, Daten
  herzugeben, die niemand braucht.
- **Beim Wechsel zurück auf privat gehen die Felder als `null` mit.** Wer nicht mehr gewerblich
  verkauft, will seine Anschrift nicht weiter öffentlich haben.
- **Land als Chips, nicht als Textfeld** — `country` ist per CHECK auf `DE`/`AT`/`CH` beschränkt
  (siehe Abschnitt 35). Ein Freitextfeld hätte denselben `23514` erzeugt, nur beim Verkäufer statt
  im Skript.

### ⚠️ Die E-Mail wird auf ihre FORM geprüft

Am Gerät aufgefallen, weil die Simulator-Tastatur das `@` als `"` tippte: Der Speichern-Knopf stand
offen, obwohl im Feld `test"berkat.invalid` stand. § 5 DDG verlangt „Angaben, die eine schnelle
elektronische Kontaktaufnahme ermöglichen" — eine Adresse ohne `@` ermöglicht gar nichts, und ein
Impressum mit kaputter Kontaktadresse ist keins.

Die Prüfung ist bewusst **minimal** (etwas, ein `@`, etwas mit Punkt): Strengere Muster weisen
regelmäßig gültige Adressen ab, und eine Pflichtangabe, die an der eigenen Prüfung scheitert,
sperrt den Verkäufer aus — derselbe Grund, aus dem die Vollständigkeitsprüfung in der Oberfläche
sitzt und nicht als CHECK in der Datenbank (`missingBusinessFields`, Kommentar dort).

### Geprüft

Am Simulator: Umschalten auf „Gewerblich" blendet die sechs Felder plus Länderwahl ein und
tauscht den Rechtsfolge-Satz; „Es fehlt noch: …" zählt die leeren Pflichtfelder auf; eine E-Mail
ohne `@` sperrt Speichern und nennt den Grund; Speichern als „Privatperson" läuft durch und meldet
„Gespeichert." `tsc` und `expo export` sauber, keine Migration, kein Build.

**Nicht geprüft:** Speichern im gewerblichen Fall bis zum Ende — dafür braucht es eine gültige
E-Mail, und die Simulator-Tastatur kann kein `@` tippen (deutsche Belegung). Die RPC ist dieselbe
wie im privaten Zweig, der durchläuft; der ungeprüfte Teil ist die Feld-Übergabe, nicht der
Aufruf. Am Gerät ist das ein Handgriff: Formular ausfüllen, speichern, aufs eigene Profil schauen.

---

## 37. Der Verkaufen-Reiter wird zur Übersicht (19.08.2026)

Umsetzung der sechsten Analyse. Zaurs Kritik vom 18.08. lautete: *„es hat sehr viele Auswahlfelder,
dadurch wird die Seite sehr lang und unübersichtlich."* Abschnitt 27 legte daraufhin die
Sendeplan-Kacheln in ein Blatt — das war richtig, traf aber nicht die Ursache.

### Die Ursache

Der Reiter trug **zwei vollständige Formulare untereinander**: „Mach die Show auf" (Titel, großer
Cover-Wähler, Kategorie-Chips, Knopf) und „Nächsten Termin ankündigen" (Bild, Titel, Wann-Zeile,
Knopf). Zusammen anderthalb Bildschirmhöhen. Beide sahen fast gleich aus — Bild links, Titel
rechts, Knopf unten —; der Unterschied war allein „jetzt" gegen „später" und musste aus den
Überschriften erschlossen werden.

Whatnots Seller Hub führt an derselben Stelle **zwei Kacheln, die nur Türen sind** („Create a
Product", „Schedule a Show"). Der Hub selbst zeigt, was ansteht: Sendungen mit Frist, Kennzahlen,
kommende Termine.

### Was jetzt dasteht

```
Deine ersten Schritte            3 von 4
┌─────────────────┐ ┌─────────────────┐
│  Show starten   │ │ Termin ankündigen│   ← zwei Türen, gleich groß
└─────────────────┘ └─────────────────┘
Deine nächsten Termine        (nur wenn welche stehen)
  [Bild] Titel · Heute 20:00 · in 3 Std   🔔 12
Bestellungen              3 zu packen  ›
Dein Regal                 9 kaufbar   ›
```

**Der Reiter passt jetzt auf eine Bildschirmhöhe statt zwei.** Beide Formulare liegen unverändert
in Blättern (`pageSheet`) — dasselbe Muster wie das Wann-Blatt, das Filter-Blatt und das
Bearbeiten-Blatt der Artikelseite.

### Die Erinnerungs-Zahl an den Terminen

Whatnot zeigt auf Termin-Karten ein Lesezeichen mit Zähler: **wie viele Menschen erinnert werden.**
Das macht aus einer Ankündigung eine Erwartung — das stärkste Signal im ganzen Hub.

Berkat kennt kein „Show merken"; die Erinnerung geht an die **Follower**. Die Zahl beantwortet
dieselbe Frage („wen erreiche ich damit?") und kostet nichts, weil `useFollowCounts` längst
existiert. Sie erscheint **nur, wenn jemand folgt** — „0 werden erinnert" wäre eine Enttäuschung in
Zahlenform, dieselbe Regel wie bei den Kategorie-Zählern.

### Drei Erklärtexte gekürzt

| vorher | jetzt |
|---|---|
| „Wer dir folgt, bekommt 15 Minuten vorher eine Erinnerung aufs Handy. Ein fester Abend bringt die Leute wieder — mehr als jede einzelne gute Show." | „Wer dir folgt, wird 15 Minuten vorher erinnert." |
| „Ohne Bild nehmen wir das Cover deiner letzten Show. Hast du noch keine, steht dein Abend nur als Text auf der Startseite." | „Ohne Bild nehmen wir das Cover deiner letzten Show." |
| „Ohne Kategorie liegt der Artikel nur auf deinem Profil — im Kategorien-Reiter findet ihn dann niemand, der dich noch nicht kennt." | „Ohne Kategorie findet dich niemand, der dich noch nicht kennt." |

Alle drei waren **wahr** — sie erklärten nur, bevor jemand gefragt hatte. Was blieb, nennt jeweils
die Folge, nicht den Mechanismus.

### ⚠️ `bare` am SchedulePlanner

Im Blatt stand zuerst „Termin ankündigen" (Kopfzeile) über „Nächsten Termin ankündigen"
(Komponente) — dieselbe Aussage zweimal. Der Planer trägt jetzt `bare`, das seinen eigenen Kopf
unterdrückt. Wer ihn außerhalb eines Blattes einsetzt, lässt das Prop weg und bekommt die
Überschrift zurück.

**Und ein Text, der stillschweigend falsch geworden wäre:** Der Schritt „Ersten Termin ankündigen"
sagte „Gleich hier unten" — das Formular ist aber nicht mehr unten, sondern hinter einem Knopf.
Jetzt: „Der Knopf steht gleich darunter." Wer eine Fläche verschiebt, muss die Texte suchen, die
auf ihre Lage zeigen.

### Nicht gebaut

**Account Health** (Whatnots drei Kennzahlen: pünktliche Sendungen, erfolgreiche Abwicklung,
Richtlinien-Stand). Sinnvoll erst, wenn es echte Verkäufer mit echten Sendungen gibt — heute wären
es drei Zahlen über null Vorgänge.

### Geprüft

Am Simulator: Der Reiter passt auf eine Höhe, beide Blätter öffnen mit vollständigem Formular und
lassen sich schließen, die gekürzten Texte stehen, die doppelte Überschrift ist weg. `tsc` und
`expo export` sauber, keine Migration, kein Build.

**Nicht geprüft:** die Erinnerungs-Zahl an einem Termin — das Testkonto hat einen Follower, aber
gerade keinen geplanten Termin. Der Block erscheint erst mit beidem.

---

## 38. Hier geht es weiter (Stand 19.08.2026, Chat-Ende)

**Der Anschlusspunkt.** Löst Abschnitt 26 ab — der bleibt als Begründung für die Reservieren-Lücke
und die Zwei-Konten-Frage gültig, sein Aufgabenteil ist aber abgearbeitet.

### Wo Berkat steht

| | |
|---|---|
| Migrationen | 34, alle eingespielt, keine Lücke — in dieser Runde **keine neue** |
| `tsc --noEmit` / `expo export` | fehlerfrei |
| Regal | 38 Artikel, sechs Verkäufer, einer gewerblich mit Impressum (Testware!) |
| Build nötig? | nein — alles seit dem 18.08. lief über Metro |

### Was in dieser Runde abgehakt wurde

Aus der alten Liste in Abschnitt 26 sind erledigt: Wann-Blatt, Zustands-Leitfaden,
Impressums-Formular (36) und — durch die Testware — **alle vier Wege, die am zweiten Konto
hingen** (33): Kaufknopf-Umfeld, „Nachricht statt Kaufen", Merken, Preisvorschlag. Ebenso der
gewerbliche Anbieterblock.

### Was offen ist, nach Nutzen sortiert

1. **Varianten** (Größe, Farbe) — der einzige echte Funktionsrückstand gegenüber Whatnot. Neun der
   36 Testartikel tragen die Größe im Titel, weil es kein Feld gibt. Whatnots Lösung steht in der
   fünften Analyse: „Multiple Options" statt Preis, Knopf „Optionen wählen", Blatt mit
   `Größe · noch 3`. **Braucht eine Migration** (Tabelle oder JSON-Spalte an `live_auctions`) und
   berührt Composer, Artikelseite und Kaufweg. Der größte Brocken auf der Liste.
2. **Artikel vor der Show vorbereiten** — die alte Lücke aus Abschnitt 26. Der Audit dazu ist
   gemacht: `status='planned'` ist gangbar, kostet vier Eingriffe, und die Migration fasst eine mit
   Serlo geteilte Tabelle an. Unter Aufsicht bauen.
3. **Der Kaufknopf selbst** ist weiterhin ungeprüft — er erscheint erst mit
   `berkat_sellers.checkout_enabled`, und das ist eine bewusste Admin-Entscheidung. Für einen
   Testdurchlauf das Flag bei einem Seed-Verkäufer setzen.
4. **Kleinkram:** „Entwurf speichern" beim Einstellen · Knappheit je Variante (hängt an 1) ·
   Anti-Snipe-Zeit wählbar · eigener Avatar im Konto-Reiter statt `CircleUser` · Bilder umsortieren
   (bräuchte `react-native-gesture-handler` → Build).

### Was NICHT gebaut werden soll — mit Begründung

- **Account Health** (Whatnots drei Verkäufer-Kennzahlen): erst mit echten Sendungen, heute wären
  es drei Zahlen über null Vorgänge.
- **„Watch to earn"** (Whatnot belohnt Zuschauzeit): widerspricht dem Design-Gesetz Nr. 4 — gesunde
  Bindung, keine Aufmerksamkeits-Ausbeutung.
- **Abgekürzte Zuschauerzahlen** (`2.1k`): bei zweistelligen Zahlen eine Behauptung.
- **Dunkelmodus**: Berkat hat zwei feste Flächen, damit hell-auf-hell strukturell unmöglich ist
  (Abschnitt 4). Das ist eine Entscheidung, keine Lücke.

### Die drei Blocker sind unverändert — außer einem Teilerfolg

Store-Eintrag und Phase 0 stehen wie gehabt. Beim Stripe-Blocker ist **die Ratenzahlung erledigt**
(Klarna, Billie, Scalapay aus, Test und Live getrennt — siehe Abschnitt 0).

**Und der Satz, der über allem steht:** Der Engpass ist nicht mehr Wissen. Sechs Whatnot-Analysen
liegen vor, der Funktionsabstand ist auf Varianten geschrumpft, und die App sieht mit Inhalt gut
aus. Was fehlt, sind **fünf Verkäufer** — und eine siebte Analyse ersetzt keinen davon.

---

## 39. „Du führst / Überboten" — die eigenen Gebote werden sichtbar (19.08.2026)

Aus der siebten Analyse, und der kleinste Eingriff mit echtem Nutzen.

### Die Lücke

Berkat hat Stellvertreter-Gebote seit `20260813220000`: Man setzt ein Höchstgebot, der Server
bietet in Schritten mit. **Nur konnte man nirgends nachsehen, wie es steht.** Wer sein Maximum
setzt und die App schließt, hatte keinen Ort, an dem steht, ob er noch führt — bei einer Auktion
die einzige Frage, die zählt.

Dasselbe Muster wie bei der Beschreibung (Abschnitt 3) und beim Impressum (36): Der Server kann es,
die Oberfläche fragt nie danach. Der Leerzustand des Aktivitäts-Reiters versprach seit dem 16.08.
sogar ausdrücklich „*und wo du gerade mitbietest*" — die Absicht war da, die Liste fehlte.

### Was jetzt dasteht

Über dem Ereignis-Strom, nur wenn etwas läuft:

```
Du wurdest überboten
 [Bild]  Überboten          ⟵ rot
         Abaya Dubai-Stil, Sand
         Aktuell 42 € · dein Maximum 40 €        ›
 [Bild]  Du führst          ⟵ grün
         Oud-Parfüm 50 ml, angebrochen
         Aktuell 18 € · dein Maximum 30 €        ›
 [Bild]  Du führst  startet noch
         Ring 585 Gold, Gr. 54
         Aktuell 1 €                             ›
```

Vier Entscheidungen:

- **Überboten steht oben.** Das ist der Zustand, der eine Handlung verlangt; wer führt, muss nichts
  tun und will es nur wissen. Die Sortierung macht genau das (`Number(leading)`).
- **Der Zustand vor dem Titel.** „Überboten" ist die Auskunft, der Artikelname nur die Zuordnung.
- **Das eigene Maximum nur, wenn es eines gibt.** Wer von Hand bietet, hat keines — eine leere
  Angabe wäre eine Frage statt einer Auskunft.
- **Der Tipp führt in den Live-Raum**, nicht auf die Artikelseite: Wer überboten wurde, will
  dorthin, wo er wieder bieten kann.

Rot für „überboten" ist konsistent: In Berkat ist Rot die laufende Uhr und die Dringlichkeit
(`ui.live`), Grün die Bestätigung (`ui.success`).

### ⚠️ Zwei Quellen, sonst fehlt die Hälfte

`lib/useMyBids.ts` fragt **beide** Tabellen ab: `live_bids` (von Hand geboten) und
`live_auto_bids` (Höchstgebot hinterlegt). Wer nur die erste nimmt, verliert genau die Person, die
die Liste am dringendsten braucht — wer sein Maximum gesetzt und nie selbst geboten hat, steht in
`live_bids` überhaupt nicht und schaut auch nicht zu.

Die Rechte passen ohne Migration: `live_bids` ist lesbar, solange die Session nicht Frauen-Only ist,
und `live_auto_bids` hat `USING (auth.uid() = bidder_id)` — die eigenen Maxima sieht nur man selbst,
fremde bleiben unsichtbar. **Kein neuer Zugriff, keine neue Policy.**

Sortiert wird nach `ends_at` mit `nullsFirst: false`: Ein geplanter Artikel hat noch kein Ende und
stünde sonst vor der laufenden Auktion, bei der es um Sekunden geht.

### Geprüft

Die Darstellung mit **vorübergehend eingesetzten Beispieldaten** am Simulator belegt: Reihenfolge
(überboten zuerst), Farben, „startet noch" beim geplanten Artikel, das Maximum nur wo vorhanden.
Danach zurückgebaut und gegengeprüft, dass der Block ohne laufende Gebote **gar nicht** rendert —
auch der zentrierte Leerzustand des Reiters bleibt korrekt, weil er jetzt an beiden Listen hängt.

`tsc` und `expo export` sauber, keine Migration, kein Build.

**Nicht geprüft:** die Abfrage gegen echte Gebote. Dafür müsste eine Show laufen und jemand bieten —
es gibt derzeit keine Auktion in der Datenbank. Der Weg dahin ist der Zwei-Konten-Durchlauf aus dem
Leitfaden, Abschnitt 7.

---

## 40. Bilanz: was aus den sieben Analysen wurde (19.08.2026)

Zaurs Frage am Ende der Runde: *„aus den Analyse-Erkenntnissen hast du einiges nicht gemacht oder"*
— berechtigt. Diese Tabelle ist die Antwort und ersetzt das Durchsuchen von sieben Analysetexten.

### Umgesetzt

| Erkenntnis | Analyse | Abschnitt |
|---|---|---|
| Startseite zeigt das Regal statt eines Knopfes dorthin | 4 | 27 |
| Hochformat für Stöber-Karten (`ratio.card`) | 4 (Zaurs Fund) | 28 |
| Kategorie-Leiste als Entdeckung statt Show-Filter | 4-Nachtrag | 29 |
| Suche und Sortierung im Regal | 5 | 30 |
| Filter: Kategorie, Zustand, Ort, Preis | 5 | 32 |
| Artikelseite entrümpelt, Impressum aufs Profil | 4 | 34, 35 |
| Impressums-Formular (schließt die Sackgasse) | — | 36 |
| Verkaufen-Reiter: zwei Türen statt zwei Formularen | 6 | 37 |
| Erinnerungs-Zahl an Terminen | 6 | 37 |
| Erklärtexte gekürzt | 6 | 37 |
| „Du führst / Überboten" | 7 | 39 |
| Eigener Avatar im Konto-Reiter | 5 | dieser |

### Offen, weil größer als ein Nachmittag

| Erkenntnis | Warum offen |
|---|---|
| **Varianten** (Größe/Farbe, „Optionen wählen") | Migration nötig; berührt Composer, Artikelseite, Kaufweg. Der einzige echte Funktionsrückstand. |
| **Artikel vor der Show vorbereiten** + **Pre-Bid** | Migration auf der mit Serlo geteilten `live_sessions`. Audit liegt vor (26), Bauen unter Aufsicht. |
| **Attribut-Chips** (Marke, Größe) | Braucht neue Spalten. Sinnvoll erst mit Varianten zusammen. |
| **Glocke je Artikel** („sag mir, wenn der drankommt") | Braucht Tabelle + Push-Weg. Hängt an Pre-Bid. |
| **Freigestellte Fotos in den Kategorie-Kacheln** | `theme/categoryArt.ts` ist vorbereitet — es fehlen zwölf Bilder. Zaur macht sie später. |
| **Nicht-Zahler-Quote** als stille Kennzahl | Erst relevant, wenn echtes Geld fließt. Abfrage auf `auction_carts`, keine Anomalie-Erkennung. |
| **Live-Raum gegen die App halten** (Vollbild, Chat ohne Kasten) | Braucht eine laufende Show; nie geprüft. |

### Bewusst nicht gebaut

| Erkenntnis | Begründung |
|---|---|
| **Account Health** (drei Verkäufer-Kennzahlen) | Heute drei Zahlen über null Vorgänge. |
| **„Watch to earn"** | Widerspricht dem Design-Gesetz Nr. 4 — gesunde Bindung, keine Aufmerksamkeits-Ausbeutung. |
| **Abgekürzte Zuschauerzahlen** (`2.1k`) | Bei zweistelligen Zahlen eine Behauptung. |
| **Dunkelmodus** | Zwei feste Flächen sind eine Entscheidung (Abschnitt 4), keine Lücke. |
| **Kaufknopf im Raster grau statt gold** | Berkat hat dort gar keinen — die Regel steht als Warnung in `theme/tokens.ts`, falls das je kippt. |
| **Radien und Schriftgrößen vereinheitlichen** | Whatnot hat einen Radius und praktisch eine Schriftgröße. Das wäre ein Diff durch die halbe App für eine Geschmacksfrage — und Berkat ist eine Telefon-App, ihre 12 px wären hier zu klein. |
| **Poster-Cover wie bei Whatnot** | Lässt sich nicht verordnen; entsteht, wenn Verkäufer merken, dass es sich lohnt. |

### Der Avatar im Konto-Reiter

Zweimal als „eine Zeile" bezeichnet und zweimal liegen gelassen — jetzt gebaut. Der Konto-Reiter
zeigt das eigene Profilbild statt `CircleUser`; es ist der einzige Reiter, der von *mir* handelt.

**Ohne Bild bleibt das Symbol.** Ein Kreis mit Initiale wäre bei 24 Punkten nicht lesbar, und wer
kein Foto hat, soll nicht bei jedem Blick daran erinnert werden. Der Ring erscheint nur im aktiven
Zustand — sonst sähe das Foto aus wie ein Fremdkörper zwischen fünf Konturlinien.

Am Simulator ist der **Rückfall** belegt (Testkonto hat kein Bild → Symbol). Der Avatar-Fall selbst
ist ungeprüft; dafür müsste ein Profilbild gesetzt sein.

---

## 41. Die sieben offenen Punkte — Entwurf statt Wunschliste (19.08.2026)

Abschnitt 40 zählt sie auf, dieser entscheidet sie. Für jeden Punkt: die Frage dahinter, die
Optionen, und was für **Berkat** richtig ist — nicht, was Whatnot tut.

### ⚠️ Der Fund, der die Reihenfolge umwirft

Der Audit in Abschnitt 26 prüfte einen Weg für „Artikel vor der Show": eine Vorab-Zeile in
`live_sessions` mit `status = 'planned'`. Er kostet **vier Eingriffe auf einer mit Serlo geteilten
Tabelle**, darunter der Go-Live-Push, der sonst still ausfiele.

**Dieser Weg ist nicht nötig.** Drei Tatsachen, alle am 19.08.2026 gegengeprüft:

1. `live_auctions.session_id` ist seit `20260815210000` **nullable** — ein Artikel darf ohne Show
   existieren. Genau das sind die Dauerangebote.
2. Für diesen Fall gibt es bereits eine **zweite Lese-Policy** (`live_auctions_select_standing`),
   inklusive Frauen-Only-Schranke am Artikel statt an der Session.
3. **Serlo benutzt `live_auctions` überhaupt nicht** — kein Treffer in `apps/web/`. Die Tabelle
   gehört Berkat allein.

Damit gilt: **Ein vorbereiteter Show-Artikel ist technisch dasselbe wie ein Dauerangebot** — eine
Zeile ohne Session. Es braucht keine Geisterzeile in `live_sessions`, keinen neuen Session-Status,
keinen der vier Eingriffe.

**Empfohlenes Schema** (eine Spalte, eine Berkat-eigene Tabelle):

```sql
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS planned_for uuid REFERENCES public.scheduled_lives(id) ON DELETE SET NULL;
```

- `planned_for IS NULL` + `status='listed'` → Dauerangebot (unverändert)
- `planned_for = <Termin>` + `status='scheduled'` → für diese Sendung vorbereitet
- Beim Live-Gehen: `UPDATE live_auctions SET session_id = <neue Session> WHERE planned_for = <Termin>`

`planned_for` bleibt danach stehen — es ist die Antwort auf „aus welchem Termin kam der Artikel".
**Nullable ist Absicht:** Wer spontan sendet, ohne Termin vorbereitet zu haben, soll nicht
ausgesperrt sein.

⚠️ `live_auctions` hat **keine** eingefrorene Spaltenliste (das REVOKE traf `live_sessions`,
`user_whip_ingresses`, `profiles`) — ein zusätzliches `GRANT SELECT (planned_for)` ist hier **nicht**
nötig. Vor dem Bauen trotzdem prüfen, es kostet nichts.

### 1. Varianten — die falsche Frage

„Größe und Farbe an einem Artikel" klingt nach dem größten Rückstand. Beim Durchdenken kippt das.

**Varianten setzen Bestand voraus.** Whatnots Blatt zeigt `Größe 10 · noch 4` — jede Variante hat
eine Menge. `live_auctions` hat **kein** `stock`: Ein Angebot ist heute genau ein Stück, der Status
springt beim Kauf auf `sold`. Wer Varianten will, braucht zuerst Mengenführung samt atomarem
Dekrement — sonst verkauft man Größe M zweimal.

**Und braucht Berkat das überhaupt?** Der Markt ist Secondhand und kleine Händler in der Diaspora.
Eine gebrauchte Abaya gibt es genau einmal. Von den 36 Testartikeln wären **höchstens fünf**
echte Serienware (Parfüm, Tasbih, Raumduft).

**Empfehlung: keine Varianten. Ein Feld `size text` am Artikel.**

Das löst, was die neun Artikel mit Größe im Titel wirklich brauchen: Sie soll **filterbar und
sichtbar** sein, nicht im Titel versteckt. Kosten: eine Spalte, ein Eingabefeld, ein Filter-Chip.
Keine Mengenführung, kein Race, kein neuer Kaufweg.

Volle Varianten lohnen erst, wenn ein Händler mit echter Serienware kommt — dann ist es eine eigene
Tabelle (`berkat_listing_variants`), **nie eine JSONB-Spalte**: Bestand muss man sperren können.

### 2. Vorab-Artikel und Pre-Bid — der eigentliche Hebel

Mit dem Schema oben zerfällt das in zwei Stufen, die getrennt Wert haben:

**Stufe A — Artikel vorbereiten (klein).** Der Verkäufer legt Artikel zu einem Termin an. Die
„Demnächst"-Karte zeigt sie. Käufer sehen, was kommt, und haben einen Grund, pünktlich zu sein.
Kein Gebot, keine Policy-Änderung: Lesen ist schon erlaubt (Dauerangebots-Policy).

**Stufe B — Pre-Bid (größer).** Gebote auf einen Artikel, der noch keiner Show gehört.

⚠️ Hier liegt die Arbeit, und sie ist nicht offensichtlich:

- `live_bids_select` prüft `JOIN live_sessions ON s.id = a.session_id`. Bei `session_id IS NULL`
  ist der JOIN leer → **niemand sieht die Vorabgebote**, auch nicht der eigene. Braucht dieselbe
  Zweit-Policy-Behandlung wie die Artikel.
- `place_live_bid` prüft heute `ends_at` und den laufenden Zustand. Ein Vorabgebot hat kein Ende —
  die RPC braucht einen zweiten Zweig, **und der darf den Anti-Snipe nicht anfassen**.
- **Die Frage, die entschieden werden muss:** Was ist ein Vorabgebot beim Start? Zwei Lesarten —
  (a) es ist das Startgebot und die Auktion beginnt dort, oder (b) es ist ein Höchstgebot, das der
  Server abarbeitet. **Richtig ist (b)**: Berkat hat `set_max_bid` bereits, und ein Vorabgebot ist
  genau das — „bis hierhin will ich gehen", nur früher gesetzt. Damit fällt fast die ganze Logik
  weg; Pre-Bid wird ein `set_max_bid` auf einen Artikel ohne Session.

Das ist die Lösung: **Pre-Bid ist kein neues Feature, sondern `set_max_bid` ohne laufende Show.**

### 3. Attribut-Chips (Marke, Größe)

Größe kommt aus Punkt 1. Marke wäre eine zweite Spalte — aber:

⚠️ **Freitext ist für einen Filter wertlos.** „Nike", „nike", „NIKE", „Nike Air" ergeben vier
Marken. Wer filtern will, braucht eine gepflegte Liste (wie `berkat_categories`) oder
Normalisierung beim Speichern.

**Empfehlung: jetzt nicht.** Bei 38 Artikeln filtert niemand nach Marke. Wenn es kommt, dann als
gepflegte Liste, und dann zusammen mit der Frage, welche Marken die Community überhaupt handelt.

### 4. Glocke je Artikel

Hängt vollständig an Stufe A. Danach ist es klein:

```sql
CREATE TABLE berkat_auction_reminders (
  auction_id uuid REFERENCES live_auctions(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (auction_id, user_id)
);
```

Plus ein Push beim Aufruf des Artikels in der Show.

**Der unterschätzte Teil ist nicht der Push, sondern die Zahl.** Sie sagt dem Verkäufer, **welcher
Artikel Nachfrage hat, bevor er ihn aufruft** — er kann die Reihenfolge danach legen. Das ist der
Grund, warum Whatnot sie dem Verkäufer zeigt, nicht nur dem Käufer.

### 5. Freigestellte Fotos für die Kategorie-Kacheln

Kein Entwurf nötig, nur Bilder. Was sie erfüllen müssen, damit sie in `theme/categoryArt.ts`
passen: **freigestellt** (transparenter Hintergrund, PNG), quadratisch, mindestens 400 × 400,
ein Gegenstand pro Bild, gleiche Blickrichtung. Der Farbton kommt aus der Datei, nicht aus dem Bild.

### 6. Nicht-Zahler-Quote

Eine Abfrage auf `auction_carts`: Zuschläge gegen bezahlte Körbe.

⚠️ **Nicht öffentlich zeigen.** Eine Quote am Profil wäre ein Pranger, und in einer Gemeinschaft,
in der man sich kennt, ist das ein Konflikt, kein Schutz. Sie gehört dem Betreiber.

Berkat hat ohnehin den kulturell passenderen Hebel: **Wer nicht zahlt, verliert seine Bürgen.** Das
ist kein Code, sondern eine Regel — und sie wirkt stärker als jede Zahl.

### 7. Live-Raum gegen die App halten

Kein Entwurf, nur Durchführung: eine Show starten und vergleichen (Vollbild, Chat ohne Kasten,
beschriftete Icon-Spalte, Gebots-Knopf über die volle Breite). Gehört in denselben Durchlauf wie
der Zwei-Konten-Test.

### Die Reihenfolge, die sich daraus ergibt

| | Was | Warum zuerst |
|---|---|---|
| **1** | `size`-Feld am Artikel | Eine Spalte, ein Feld, ein Chip. Löst neun Titel-Notlösungen. |
| **2** | **Stufe A: Artikel vorbereiten** (`planned_for`) | Der Hebel. Eine Spalte auf einer Berkat-eigenen Tabelle statt vier Eingriffen auf einer geteilten. Macht die Zeit vor der Show verkaufsfähig. |
| **3** | Glocke je Artikel | Klein, sobald A steht — und liefert dem Verkäufer das Nachfrage-Signal. |
| **4** | **Stufe B: Pre-Bid** als `set_max_bid` ohne Session | Der Rest ist Policy-Arbeit an `live_bids`. |
| **5** | Live-Raum prüfen | Braucht ohnehin eine Show — zusammen mit dem Zwei-Konten-Test. |
| — | Varianten, Marken-Chips, Nicht-Zahler-Quote | Erst mit echten Verkäufern und echtem Geld. |

**Der rote Faden:** Fünf der sieben Punkte hängen an *einer* Spalte — `planned_for`. Und dieser
eine Schritt ist erheblich kleiner, als der Audit vom 18.08. vermuten ließ, weil er die geteilte
Tabelle gar nicht anfassen muss.

---

## 42. Audit der eigenen Migrationen — vier Fehler, einer davon ein Leck (19.08.2026)

Direkt nach dem Einspielen von `20260819100000` und `…110000` durchgeprüft. **Vier Funde, alle in
meiner eigenen Arbeit von derselben Stunde**, keiner je in Benutzung — `prepare_live_auction`
scheiterte ohnehin am ersten davon.

### 1 · CHECK verhinderte die neue Funktion (blockierend)

`live_auctions_shelf_check` erlaubt bei `session_id IS NULL` nur `listed`, `sold`, `cancelled`.
`prepare_live_auction` schreibt dort `scheduled` — **jeder Aufruf hätte `23514` geworfen.** Die
Funktion war angelegt, hatte ihre Rechte, und war zur Laufzeit unbrauchbar.

Behoben in `20260819120000`.

### 2 · ⚠️ Frauen-Only-Leck (schwerwiegend)

`prepare_live_auction` setzte `women_only` nicht. Die Spalte hat `DEFAULT false`, und die Policy
für Artikel ohne Session lautet `women_only = false OR seller_id = auth.uid() OR …`.

**Die Warenliste einer Frauen-Only-Show wäre in der Vorbereitungsphase für jeden sichtbar
gewesen** — Titel, Bild, Preis. Bis zum Start der Show, also genau während der Zeit, in der die
Vorbereitung ihren Zweck hat.

Dieselbe Fehlerklasse wie in Abschnitt 3, dritter Eintrag („Eine SECURITY-DEFINER-Funktion geht an
der Frauen-Only-Grenze vorbei"). Dort war es ein Cover, hier die ganze Liste.

**Die Lösung ist Erben, nicht Fragen.** `scheduled_lives` trägt selbst `women_only`; der Artikel
übernimmt es vom Termin. Kein neuer Parameter, keine zweite Angabe, keine Gelegenheit, es zu
vergessen. Behoben in `20260819130000`.

### 3 · Fremde App konnte Artikel aufnehmen (Datenverlust)

`claim_prepared_auctions` prüfte nur `host_id = auth.uid()`, nicht die App der Session. Wer in
beiden Apps sendet, hätte seine Berkat-Artikel in eine **Serlo**-Session ziehen können. Kein
Sicherheitsleck — aber die Artikel wären verschwunden: Serlo kennt `live_auctions` nicht, und
Berkats Abfragen finden sie über die fremde Session nicht mehr.

### 4 · `sort_index` konnte doppelt vergeben werden (klein)

Aus `count(*)` gebildet: drei anlegen (0,1,2), den mittleren verwerfen, einen neuen anlegen → wieder
2. Zwei Artikel mit demselben Index, Reihenfolge unbestimmt. Jetzt `max(sort_index) + 1`.

### Was die vier gemeinsam haben

**Ich habe die Zieltabelle nicht zu Ende gelesen.** Spalten ja — CHECK-Constraints nein,
Policy-Folgen nein, App-Trennung nein. Alle vier Fehler wären beim Lesen von
`20260815210000` (Dauerangebote) aufgefallen: Dort steht der CHECK, dort steht `women_only` am
Artikel, dort steht die Begründung für die zweite Policy.

**Die Regel daraus, für jede neue Zeile in eine bestehende Tabelle:**

> Nicht „welche Spalten gibt es", sondern **„welche Zustände erlaubt diese Tabelle, und was folgt
> aus ihnen für die Sichtbarkeit".** Die Spaltenliste steht in `SCHEMA.md`; die Antwort auf die
> zweite Frage steht nur in der Migration, die den Zustand eingeführt hat.

Und: **Eine Funktion, die sauber anlegt, ist nicht geprüft.** `db push` meldete Erfolg,
`supabase migration list` zeigte grün, die Rechte saßen — der Widerspruch entsteht erst beim
ersten INSERT. Ein Schema-Abzug (`db dump --linked`) hat beide Fehler in zwei Minuten sichtbar
gemacht; er gehört nach jeder Migration, die eine geerbte Tabelle anfasst.

### Client-Seite: keine Funde

Geprüft: Abhängigkeitslisten der heutigen `useCallback`s, ob die Sortierung im Regal den
Zwischenspeicher von React Query mutiert (nein — `filter()` gibt ein neues Feld), ob irgendwo ein
`void supabase.rpc(…)` ohne `.then()` steht (nein; die drei Treffer sind Warnkommentare).

⚠️ **Für den nächsten Schritt vorgemerkt:** `LISTING_COLUMNS` in `lib/useListings.ts` ist eine
feste Spaltenliste. Wer `size` im Client zeigen will, muss sie **dort** ergänzen — sonst ist die
Spalte da, die Abfrage holt sie nicht, und niemand sieht sie. Genau so war `description` zwei Tage
lang unsichtbar (Abschnitt 3).

---

## 43. Gesamt-Audit gegen das Live-Schema (19.08.2026)

Nicht gegen Vermutungen, sondern gegen einen frischen Abzug der echten Datenbank
(`supabase db dump --linked`, 22.411 Zeilen, **mit** Rechten — der bleibt in `/tmp`, nie im Repo).

### Was geprüft wurde und hält

**1 · Ausführungsrechte für `anon` (die `credit_coins`-Falle).**
154 Funktionen tragen ein `anon`-EXECUTE. Das klingt nach viel und ist es auch — aber die
Verdachtsliste (Geld, Rechte, Löschen) wurde einzeln geöffnet:

| Funktion | Absicherung im Rumpf |
|---|---|
| `admin_update_payout_status` | `IF NOT is_admin() THEN RAISE` ✓ |
| `admin_get_payout_requests` | `IF NOT is_admin() THEN RAISE` ✓ |
| `grant_moderator` | prüft `host_id <> auth.uid()` → `forbidden_not_host` ✓ |

Und die Wurzel dieser Kette:

```sql
is_admin() → SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), FALSE)
```

Ohne Anmeldung ist `auth.uid()` NULL, der Unterausdruck leer, `COALESCE` liefert `FALSE`.
**Die Absicherung hält.** Das anon-Recht ist unschön, aber nicht ausnutzbar.

**2 · Spaltenrechte auf `profiles`.**
36 Spalten für `anon`, 0 davon heikel — kein `push_token`, keine E-Mail, keine Telefonnummer. Die
spaltenweise REVOKE-Strategie aus Abschnitt 3 funktioniert wie gedacht, auch wenn die
Zeilen-Policy `USING (true)` lautet.

**3 · Client-Arbeit dieser Runde.** Abhängigkeitslisten der `useCallback`s korrekt, keine Mutation
des React-Query-Zwischenspeichers beim Sortieren, kein `void supabase.rpc(…)` ohne `.then()`.

### Was prüfenswert bleibt

**⚠️ `live_cohosts`, `live_polls`, `live_moderators` haben `USING (true)`.**

Diese drei hängen an einer Session, erben deren `women_only` aber **nicht**. Wer sie liest, sieht
`session_id` + `user_id` — also *dass* jemand in einer bestimmten Sendung CoHost oder Moderator
war, auch wenn die Sendung selbst unsichtbar ist.

Das ist **kein Inhalts-Leck** (Titel, Cover, Chat bleiben geschützt), sondern ein Metadaten-Leck:
Teilnahme an einem geschützten Raum. In einer konservativen Gemeinschaft ist das nicht nichts.

**Einordnung:** Serlo-Bestand, nicht von Berkat eingeführt; Berkat nutzt CoHosts und Polls nicht.
Verwandt mit dem Befund in der Notiz „RLS Permissive-OR-Falle" (WOZ-Live-Leak, Juli 2026). **Nicht
verifiziert** — dafür bräuchte es eine Probe mit einem ungeprüften Konto gegen eine echte
WOZ-Session. Gehört auf die Liste, bevor Frauen-Only ernsthaft genutzt wird.

**⚠️ `berkat_sellers` ist `USING (true)`.**
Enthält die Impressumsangaben. Bei **gewerblichen** Verkäufern ist das öffentlich Pflicht
(§ 5 DDG) und damit richtig. Bei **privaten** stehen dort `NULL`s — das Formular aus Abschnitt 36
nullt die Felder beim Wechsel zurück auf privat ausdrücklich. Der Fall, der schiefgehen könnte:
Daten per SQL eingetragen und der Typ danach auf privat gesetzt. Dann stünde eine Privatanschrift
öffentlich. **Kein aktueller Fehler, aber ein Grund, `set_berkat_seller_kind` als einzigen
Schreibweg zu behalten.**

### Was noch fehlt und bewusst offen ist

`size` und `planned_for` sind in der Datenbank, aber **im Client noch nirgends** — `LISTING_COLUMNS`
in `lib/useListings.ts` kennt sie nicht. Das ist der nächste Bauschritt, keine Lücke. ⚠️ Wer sie
nutzt, muss die Spaltenliste dort ergänzen; sonst existiert die Spalte, die Abfrage holt sie nicht,
und niemand sieht sie — genau der Weg, auf dem `description` zwei Tage unsichtbar blieb.

### Methodenhinweis für den nächsten Audit

Der Abzug beantwortet in Minuten, was aus dem Quelltext nicht sicher zu erkennen ist: welche
Rechte tatsächlich gelten, welche Policies wirklich existieren, ob eine Funktion so in der
Datenbank steht wie in der Migration. Er lohnt nach **jeder** Migration auf einer geerbten oder
geteilten Tabelle.

```bash
supabase db dump --linked --schema public --dry-run 2>/dev/null \
  | sed -n '/^#!\/usr\/bin\/env bash/,$p' > /tmp/dump.sh
bash /tmp/dump.sh > /tmp/schema_now.sql && rm /tmp/dump.sh
```

⚠️ Dieser Abzug enthält die **Rechte** und gehört deshalb nach `/tmp`, nie ins Repo — das Repo ist
öffentlich, und die GRANT-Liste ist für einen Angreifer die Landkarte (CLAUDE.md Regel 10).

---

## 44. Die WOZ-Probe — gemessen statt vermutet (19.08.2026)

Abschnitt 43 nannte `live_cohosts`, `live_polls` und `live_moderators` als möglichen
Metadaten-Leck-Weg (`USING (true)`, kein Erben von `women_only`). Hier die Messung.

### Der Aufbau

Abgefragt wurde mit dem **öffentlichen anon-Schlüssel** — also genau der Perspektive eines
Angreifers: nicht angemeldet, nicht Frauen-Only-geprüft, kein Host. Der Schlüssel steckt ohnehin in
jeder ausgelieferten App, die Probe verrät nichts Neues.

Das Verfahren: Alle `session_id`s sammeln, die diese Tabellen preisgeben, und gegen die Liste der
Sessions halten, die `anon` regulär sehen darf. **Jede ID, die in der ersten Menge steht und in der
zweiten fehlt, wäre eine durchgesickerte Existenz.**

### Das Ergebnis

| | |
|---|---|
| `live_sessions` für anon sichtbar | 241 (davon `women_only = true`: **0**) |
| `live_cohosts` lesbar | 15 Zeilen · 15 Sessions · **0 versteckt** |
| `live_polls` lesbar | 12 Zeilen · 11 Sessions · **0 versteckt** |
| `live_moderators` lesbar | 0 Zeilen |
| `live_comments` lesbar | 286 Zeilen · 80 Sessions · **0 versteckt** |
| `auction_carts` | **gesperrt (401)** ✓ |
| `berkat_tips` | 0 ✓ |

**Kein aktives Leck.** Auch der Live-Chat — 286 Nachrichten sind für anon lesbar — stammt
ausschließlich aus öffentlichen Sendungen.

### ⚠️ Warum das Ergebnis weniger wert ist, als es aussieht

Die Gegenprobe auf die Datenlage:

| | |
|---|---|
| `scheduled_lives` mit `women_only` | 0 |
| `live_auctions` mit `women_only` | 0 |
| `profiles` mit `women_only_verified` | **1** |

**Es gibt kein einziges Frauen-Only-Datum in der Datenbank.** Eine Sendung, ein Artikel, ein
Termin — nichts. Die Probe konnte also gar nichts finden; sie beweist nur, dass an den
öffentlichen Daten nichts vorbeiläuft.

Der **strukturelle** Befund bleibt davon unberührt und folgt direkt aus der Policy-Definition:
`live_cohosts_select` lautet `USING (true)` und erbt nichts von der Session. Bekommt morgen eine
Frauen-Only-Sendung einen CoHost, ist diese Zeile für jeden lesbar. Das ist keine Vermutung,
sondern liest sich aus der Policy ab.

### ~~Empfehlung: den Fix jetzt NICHT bauen~~ — am selben Tag überholt

Er wäre klein — Policy von `USING (true)` auf ein Session-Erbe umstellen, wie es
`live_auctions_select` längst tut. Aber:

```
live_cohosts    → Serlo-Web 10 Dateien · Serlo-App 4 · Berkat 1
live_polls      → Serlo-Web 11 Dateien · Serlo-App 1 · Berkat 1
live_moderators → Serlo-Web  7 Dateien · Serlo-App 1 · Berkat 2
```

Das sind **intensiv genutzte Serlo-Flächen**. Eine verschärfte Policy, die einen Lesepfad dort
nicht trifft, bricht ihn **still** — PostgREST liefert eine leere Menge statt eines Fehlers
(Abschnitt 3, „Geerbte Serlo-Tabellen sind enger, als sie aussehen"). Der Nutzen wäre heute null,
das Risiko trifft eine ausgelieferte App.

**Der richtige Zeitpunkt ist der Tag, an dem die erste Frauen-Only-Show geplant wird** — dann mit
Durchgang durch alle 22 Fundstellen. Bis dahin gehört es hierher, nicht in eine Migration.

### Positiver Nebenbefund

`auction_carts` antwortet `anon` mit **401**, `berkat_tips` mit 0 Zeilen. Die Geldpfade sind gegen
unangemeldete Zugriffe dicht — unabhängig von den Policies darüber.

---

## 45. Die vier Kind-Tabellen erben jetzt die Frauen-Only-Schranke (19.08.2026)

**Korrektur meiner eigenen Empfehlung aus Abschnitt 44.** Dort stand: Fix nicht jetzt bauen, weil
die Tabellen zu Serlo gehören und ein stiller Bruch eine ausgelieferte App träfe.

Zaur: *„auf serlo sind 0 user, keine echten user, man kann die fehler ruhig lösen, nicht warten auf
women only show."*

Damit fällt die Grundlage der Abwägung weg. **Der richtige Zeitpunkt ist jetzt** — ein stiller
Bruch kostet heute nichts und nach dem Start alles. Die Empfehlung war nicht falsch begründet, sie
beruhte auf einer falschen Annahme über die Nutzerlage.

### Es waren vier, nicht drei

Die systematische Suche über den Schema-Abzug (21 Tabellen mit `session_id`) fand eine mehr als der
Audit in Abschnitt 43:

```
live_cohosts · live_polls · live_moderators · live_viewer_welcomes
```

Die übrigen 17 session-gebundenen Tabellen hatten bereits ordentliche Policies.

### Warum der Eingriff risikoarm ist

1. **Die Formel ist nicht neu.** Sie steht wortgleich auf `live_reactions` und läuft dort in Serlo
   seit Monaten. Kopiert, nicht erfunden.
2. **`session_id` ist in allen vier Tabellen `NOT NULL`.** Es kann keine verwaiste Zeile geben, die
   durch das Erben unsichtbar würde — der häufigste Weg, wie eine verschärfte Policy Daten
   verschluckt.
3. **Nur SELECT.** `live_cohosts` und `live_polls` haben eigene INSERT/UPDATE/DELETE-Policies; die
   bleiben unberührt.

### Was sich ändert

Wer die Kind-Zeilen einer Sendung liest, die er selbst nicht sehen darf, bekommt eine **leere
Menge** statt Daten — kein Fehler, keine Meldung. Für öffentliche Sendungen ändert sich nichts, und
nur die existieren heute. Die Gegenprobe steht in der Migration: `live_cohosts` muss als anon
weiterhin 15 Zeilen liefern, `live_polls` 12.

### Stand der Migrationen

Alle drei sind **eingespielt**: `20260819120000` (CHECK), `20260819130000` (WOZ bei vorbereiteten
Artikeln) und `20260819140000` (diese hier).

**Am 19.08.2026 abends gegen die echte Datenbank nachgeprüft**, nicht nur gegen die
Tracking-Tabelle — die hat hier schon einmal gelogen (Abschnitt 3). Im frischen Abzug
(`db dump --linked`, nach `/tmp`, danach gelöscht) tragen alle vier Policies das Session-Erbe,
RLS ist auf allen vier aktiv, und **keine zweite permissive `USING (true)`-Policy** liegt daneben —
die hätte die neue Schranke per ODER wieder ausgehebelt. Die Gegenprobe der Migration hält
zeichengenau: als anon weiterhin `live_cohosts` 15, `live_polls` 12, `live_comments` 286.

⚠️ **Was das nicht beweist:** dass die Schranke bei einer echten Frauen-Only-Sendung greift. Es gibt
weiterhin null WOZ-Daten (Abschnitt 44). Der strukturelle Fix ist drin und liest sich aus der Policy
ab; der Wirkungsnachweis kommt mit der ersten WOZ-Show.

---

## 46. Anschlusspunkt für den nächsten Chat (Stand 19.08.2026, Abend)

**Hier anfangen.** Löst Abschnitt 38 ab (der wiederum 26 ablöste). Was dort an Aufgaben stand, ist
abgearbeitet oder in diesem Abschnitt neu bewertet.

### Der Zustand in fünf Zeilen

| | |
|---|---|
| Migrationen | **39, alle eingespielt und verzeichnet**, keine Lücke |
| `tsc --noEmit` / `expo export` | fehlerfrei |
| Regal | 38 Artikel, sechs Verkäufer, einer gewerblich mit Impressum — **alles Testware** |
| Letzter Commit | `c15d625` (Design-Durchgang). **Alles danach ist uncommittet** |
| Build nötig? | nein — die ganze Runde lief über Metro |

### ⚠️ Das Wichtigste zuerst: die Datenbank kann etwas, das die App nicht kennt

Am 19.08. kamen zwei Spalten dazu, **beide ohne Client-Code**:

- `live_auctions.size` — Größe als Freitext. Die RPCs `create_standing_listing` und
  `update_standing_listing` nehmen sie bereits entgegen (`p_size`).
- `live_auctions.planned_for` — Termin, für den ein Artikel vorbereitet ist. Dazu drei RPCs:
  `prepare_live_auction`, `claim_prepared_auctions`, `discard_prepared_auction`.

**Der nächste Bauschritt ist der Client dazu.** Und die erste Falle steht schon fest:

> `LISTING_COLUMNS` in `lib/useListings.ts` ist eine **feste Spaltenliste**. Wer `size` anzeigen
> will, muss sie **dort** ergänzen — sonst existiert die Spalte, die Abfrage holt sie nicht, und
> niemand sieht sie. Genau so blieb `description` zwei Tage unsichtbar (Abschnitt 3).

Konkret zu bauen:

1. ~~**Größe**~~ — **erledigt am 19.08.2026, Abschnitt 47.**
2. ~~**Artikel vorbereiten**~~ — **erledigt am 19.08.2026, Abschnitt 48.** Offen bleibt daraus nur
   die Übernahme beim Live-Gehen, die eine echte Sendung braucht.

### Was in dieser Runde entschieden wurde (nicht neu diskutieren)

- **Keine Varianten.** Sie setzen Bestandsführung voraus, `live_auctions` hat kein `stock`, und der
  Markt ist Secondhand. Ein `size`-Feld löst neun von neun Fällen. Begründung: Abschnitt 41.
- **Pre-Bid ist `set_max_bid` ohne Session**, kein neues Feature. Erst nach dem Vorbereiten bauen.
- **Kein Account Health, kein „Watch to earn", keine abgekürzten Zahlen, kein Dunkelmodus** —
  Begründungen in Abschnitt 40.
- **Marken-Chips nicht**, solange „Nike/nike/NIKE" drei Marken wären (Abschnitt 41).

### Die Blocker — unverändert bis auf einen Teilerfolg

1. **Kein Store-Eintrag.** Nur Zaur kann TestFlight anstoßen (Apple-Anmeldung mit Zwei-Faktor).
2. **Stripe:** Konto wiederhergestellt, Testbetrieb. ✅ **Ratenzahlung ist abgeschaltet** (Klarna,
   Billie, Scalapay — Test und Live getrennt, 19.08.). Vor dem Go-Live noch einmal durchsehen:
   Stripe schaltet neue Methoden bei Länder-Freischaltungen von selbst zu.
3. **Phase 0 nie begonnen.** Fünf Verkäufer, acht Wochen. **Das ist der Engpass** — nicht Wissen,
   nicht Funktionen.

### Vor dem nächsten Commit

Uncommittet sind: fünf Migrationen, `lib/useMyBids.ts`, `app/(tabs)/activity.tsx`,
`app/(tabs)/_layout.tsx`, `HANDOFF.md`, `WHATNOT-ANALYSE.md`.

⚠️ `apps/web/lib/data/live-host.ts` und `studio.ts` gehören **nicht** dazu — sie stammen aus einer
separaten Hintergrund-Aufgabe zum Studio-Verlauf und lagen schon vor dieser Runde geändert im Baum.

### Was diese Runde gelehrt hat

Vier Fehler in eigenen Migrationen (Abschnitt 42), einer davon ein Frauen-Only-Leck. Alle vier
hatten dieselbe Ursache: **die Zieltabelle nicht zu Ende gelesen** — Spalten ja, CHECK-Constraints
nein, Policy-Folgen nein.

> Vor jedem INSERT in eine bestehende Tabelle: nicht „welche Spalten gibt es", sondern **„welche
> Zustände erlaubt sie, und was folgt daraus für die Sichtbarkeit".** Die Spaltenliste steht in
> `SCHEMA.md`; die zweite Antwort steht nur in der Migration, die den Zustand eingeführt hat.

Und das Werkzeug, das beide Fehler in zwei Minuten fand — ein Schema-Abzug gegen die Live-DB
(Rezept am Ende von Abschnitt 43). Er gehört nach jeder Migration auf einer geerbten Tabelle.

---

## 47. Die Größe kommt aus dem Titel heraus (19.08.2026, abends)

Punkt 1 aus Abschnitt 46. Die Spalte `live_auctions.size` lag seit dem Vormittag in der Datenbank,
die RPCs nahmen `p_size` entgegen — **im Client kannte sie niemand.** Genau der Zustand, den
Abschnitt 46 als „die Datenbank kann etwas, das die App nicht kennt" überschrieben hat.

### Was jetzt geht

| Fläche | Was |
|---|---|
| `lib/useListings.ts` | `size` im Typ **und** in `LISTING_COLUMNS` |
| `lib/useStanding.ts` | `size` in beiden Mutationen, `p_size` an beide RPCs |
| `components/StandingComposer.tsx` | Eingabefeld neben dem Preis, `tidySize()` beim Abschicken |
| `components/ListingCard.tsx` | „Gr. 42" in der Meta-Zeile — über `listingMeta`, also automatisch auf allen fünf Flächen |
| `app/listing/[id].tsx` | Chip neben Zustand und Ort, und `size` im Bearbeiten-Blatt |
| `app/shop.tsx` | Filtergruppe „Größe", und die Suche findet sie |
| `scripts/seed-berkat-shop.mjs` | 14 der 36 Testartikel bekommen eine Größe, sechs Titel werden kürzer |

### Entscheidungen, die nicht offensichtlich sind

- **Die Größe steht VORNE in der Meta-Zeile**, vor Zustand und Ort. Bei Kleidung und Schuhen
  entscheidet sie zuerst: Ein Artikel in der falschen Größe ist erledigt, egal wie gut sein Zustand
  und wie nah sein Ort ist. Artikelseite und Karte benutzen dieselbe Reihenfolge — zwei Ordnungen
  für dieselbe Auskunft wären eine zu viel.
- **„Gr." als Präfix**, obwohl es bei „One Size" überflüssig ist. Eine nackte „42" neben einem Preis
  liest sich wie eine zweite Zahl; und eine Zeile, die mal so und mal so aussieht, ist schwerer zu
  lesen als eine gleichförmige.
- **Preis und Größe teilen sich eine Zeile.** Der Verkaufen-Bereich ist am selben Tag gerade erst
  gekürzt worden (Abschnitt 37) — eine eigene Zeile für zwei Zeichen wäre der Rückschritt gewesen.
- **Der Beschreibungs-Platzhalter sagt nicht mehr „Größe".** Er lautete „Marke, Größe, Mängel …"
  und schickte damit genau dorthin, wo die Angabe nicht hingehört: in Fließtext, unfilterbar. Wer
  ein Feld baut und den alten Umweg stehen lässt, hat beides.
- **Größen werden im Filter NICHT nach Häufigkeit sortiert** — als einzige Gruppe. Bei Kategorie,
  Zustand und Ort sucht man das Naheliegende; bei Größen sucht man die **eigene**, und die ist so
  oft selten wie häufig. `28 · 38 · 39 · 40 · 42 · 54 · 74 · L · One Size` findet man mit einem
  Blick, eine nach Häufigkeit geordnete Liste muss man ganz lesen. `numeric: true` ist dabei
  Pflicht, sonst stünde „100" vor „38".
- **Die Suche zieht mit.** Vorher stand die Größe im Titel und war damit auffindbar. Sie in eine
  eigene Spalte zu heben und die Suche nicht mitzuziehen hätte eine Fähigkeit **weggenommen** — der
  Filter allein setzt voraus, dass jemand ihn öffnet. Der Leerzustand sagt jetzt „Titel, Größe und
  Ort".
- **Beim Anlegen wird die Größe zurückgesetzt, PLZ und Ort nicht.** Wer abends fünf Sachen
  einstellt, wohnt bei allen fünf gleich — aber jedes Stück hat eine andere Größe. Sie stehen zu
  lassen hieße, sie beim zweiten Artikel still falsch zu behaupten.
- **Keine gepflegte Liste, kein Varianten-System.** Begründung steht im Kopf von
  `20260819100000` und in Abschnitt 41: `live_auctions` hat kein `stock`.

### ⚠️ Zwei Fallen, die dieser Schritt sichtbar gemacht hat

**1. Vollersatz frisst, was das Formular nicht kennt.** `update_standing_listing` ersetzt alle
Felder. Ein Bearbeiten-Blatt ohne `size` in `initial` hätte beim ersten Speichern die Größe
gelöscht — ohne dass der Verkäufer sie angefasst hätte. Dieselbe Mechanik, aus der `category`
seinerzeit in den Zeilentyp musste. Steht jetzt als Warnung an der Mutation.

**2. `autoCapitalize="characters"` war falsch — am Simulator in zehn Sekunden sichtbar.**
Der erste Entwurf setzte es ans Feld, damit „m" zu „M" wird. Getippt wurde „One Size", im Feld stand
**„ONE SIZE"** — und das hätte danach auf jeder Karte gestanden. Die Tastatur ist der falsche Ort
für eine Regel, die nur für kurze Werte gilt. Jetzt normalisiert `tidySize()` beim Abschicken:
höchstens drei Buchstaben → Großbuchstaben (`m` → `M`, `xl` → `XL`), alles andere bleibt wie
getippt. Zahlen sind ohnehin unberührt.

> **Merksatz:** Eine Schreibregel gehört dorthin, wo der Wert entsteht — nicht an die Tastatur, die
> ihn nicht kennt.

### Testware: die Größe wandert aus den Titeln

`scripts/seed-berkat-shop.mjs` legte sechs Artikel als „Sneaker weiß, **Gr. 42**" an — die
Notlösung, die diese Spalte abschafft. Die Titel sind gekürzt, die Größe steht im Feld, und beim
Abendkleid ist sie zusätzlich aus dem Beschreibungstext heraus („Größe 38, Innenfutter tadellos").

Vierzehn der 36 Artikel tragen jetzt eine Größe, bewusst gemischt: Zahlen von 28 bis 74, dazu „L"
und „One Size". Ein Regal, in dem alle Größen zweistellige Zahlen sind, prüft weder die Sortierung
noch die Frage, ob eine Zeile mit „One Size" noch passt.

⚠️ **`LEGACY_TITLES` ist deshalb neu** und darf nicht wegfallen: Wer vor dem 19.08.2026 geseedet
hat, hat „Babyjacke, Gr. 74" in der Datenbank, und ein Titelvergleich gegen die **neuen** Namen
fände sie nicht. Genau diese Zeile war es, die am 18.08. beim Aufräumen liegenblieb, weil ihr das
`[testware]`-Kennzeichen fehlte (Abschnitt 35). Wer künftig einen Titel ändert, hängt den alten dort
an.

### Geprüft

Gegen die **echte Datenbank** (frischer Abzug, nach `/tmp`, danach gelöscht):

- `live_auctions.size text` samt `CHECK … <= 24` ist da.
- `create_standing_listing` und `update_standing_listing` haben **je genau eine** Signatur, beide
  enden auf `p_size text` — kein **HTTP 300**. Die Parameternamen stimmen zeichengenau mit dem
  überein, was der Client schickt.
- Rechte: `REVOKE ALL … FROM PUBLIC` + `GRANT … TO authenticated, service_role`, **kein `anon`** —
  die `credit_coins`-Falle greift hier nicht.
- Die neue Spaltenliste liest sich als anon mit **HTTP 200**. `live_auctions` hat keine
  eingefrorene Spaltenliste, ein eigenes `GRANT SELECT (size)` war also nicht nötig (geprüft, nicht
  angenommen).

Am **Simulator** durchgespielt: Das Feld steht neben dem Preis, ohne ihn zu quetschen, und die
Eingabe wird nicht mehr geschrien. Vor dem neuen Seed-Lauf fehlte die Filtergruppe „Größe"
**korrekt** — `FilterGroup` blendet sich unter zwei Werten aus, und es gab noch keinen Artikel mit
Größe. Nach dem Seed steht sie da; der Durchgang dazu weiter unten.

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Keine Migration, kein Build.

### Am echten Datenstand belegt (19.08.2026, 22:14)

Zaur hat den Seed neu gefahren (`--remove`, dann neu — 37 raus, 36 rein). Damit standen 14 Artikel
mit Größe im Regal, und die vier Wege, die vorher nur logisch belegt waren, sind am Simulator
durchgespielt:

| Weg | Beleg |
|---|---|
| **Karte** | „Babyjacke" — Titel ohne Größe — darunter **„Gr. 74 · Sehr gut · 28209 Bremen"** |
| **Artikelseite** | drei Chips: **„Gr. 38" · „Neu mit Etikett" · „13353 Berlin"**, Größe zuerst |
| **Filter** | Gruppe „Größe" zwischen Kategorie und Zustand, Reihenfolge `28 · 38 · 39 · 40 · 42 · 54 · 74 · L · One Size` — also **nicht** nach Häufigkeit, sonst stünde „40 3" vorn. Tipp auf „40" → Knopf „3 Artikel zeigen", danach Kopfzeile „3 Treffer", Chip „Filter · 1", alle drei Karten `Gr. 40` |
| **Suche** | „One" → 2 Treffer, beide `Gr. One Size`. **In keinem der beiden Titel steht „One"** — der Treffer kommt allein aus der Größenspalte. Das ist der eigentliche Beweis, dass die Suche die neue Spalte wirklich liest |

### Zwei Beobachtungen aus demselben Durchgang

**1. Die Meta-Zeile schneidet jetzt öfter ab — an der richtigen Stelle.** Sie ist einzeilig, und mit
der Größe davor wird sie länger: „Gr. One Size · Neu · 21073 Hamb…". Gekürzt wird also der **Ort**,
und das ist genau die gewollte Folge der Reihenfolge — abgeschnitten wird, was am wenigsten
entscheidet. Wer die Reihenfolge je umstellt, verschiebt damit auch, was verlorengeht.

**2. ⚠️ Freitext kennt keine Skala.** Der Filter „40" liefert eine Abaya (Konfektion 40) und
Hausschuhe (Schuhgröße 40) nebeneinander. Das ist kein Fehler, sondern der Preis der Freitext-
Entscheidung: Ohne Skala am Wert lässt sich Konfektion nicht von Schuh trennen. Das Gegenmittel
liegt schon da — Kategorie **und** Größe zusammen filtern („Schuhe" + „40"). Eine Skala pro Größe
wäre erst dann sinnvoll, wenn jemand tatsächlich darüber stolpert; sie kostet ein zweites Feld an
jedem Angebot.

### ~~Was weiterhin ungeprüft ist~~ — am 21.08.2026 belegt

`tidySize()` **am Schreibweg** war der letzte offene Punkt dieser Runde. Am Gerät durchgespielt:
Größe `m` getippt, Artikel gespeichert — in der Datenbank steht **`M`**.

```
Fffgggccgggg    M    2026-08-21 17:18:43
```

Der Nutzen ist nicht kosmetisch: Ohne die Umrechnung wären `m` und `M` **zwei verschiedene Größen**
in der Filtergruppe, und das Regal zeigte dieselbe Größe zweimal.

### Was als Nächstes fehlt

Unverändert Punkt 2 aus Abschnitt 46: **Artikel vor der Show vorbereiten** (`planned_for`). Die
Spalte und die drei RPCs liegen seit dem 19.08. in der Datenbank, der Client kennt auch sie noch
nicht. Und dieselbe Falle gilt dort noch einmal — wer `planned_for` im Client zeigen will, ergänzt
`LISTING_COLUMNS`.

---

## 48. Artikel vor der Show vorbereiten (19.08.2026, nachts)

Punkt 2 aus Abschnitt 46 und der Hebel, an dem laut Abschnitt 41 **fünf der sieben offenen Punkte**
hängen. Die Spalte `planned_for` und drei RPCs lagen seit dem Vormittag in der Datenbank; der Client
kannte sie nicht.

Bis hierher entstand jeder Show-Artikel **im Raum**: Der Verkäufer stand vor der Kamera, vor
Publikum, und tippte dort Titel, Startpreis und Mindestschritt. Das kostet vier Dinge auf einmal —
tote Sendezeit, nichts zum Vorab-Ansehen, keinen Grund pünktlich zu sein, keine Vorbereitung
(Abschnitt 26).

### Was gebaut ist

| Wo | Was |
|---|---|
| `lib/usePrepared.ts` | **neu** — Typ, Spaltenliste, eine Abfrage nach Termin gruppiert, `prepare`/`discard`, `claimPreparedAuctions` |
| `components/PrepareSheet.tsx` | **neu** — das Blatt: was bereitliegt, und ein Formular wie „Artikel auflegen" im Studio |
| `app/(tabs)/sell.tsx` | Terminzeilen sind antippbar und tragen „N Artikel bereit"; beim Live-Gehen wird übernommen |
| `components/UpcomingStrip.tsx` | die „Demnächst"-Karte zeigt bis zu drei Vorschaubilder und die Zahl |
| `lib/useListings.ts` | `tidySize()` ist dorthin gewandert — zwei Formulare erzeugen jetzt Größen, eine Regel |

### Entscheidungen, die nicht offensichtlich sind

- **⚠️ Übernommen wird NUR mit Termin-ID.** `claim_prepared_auctions` erlaubt serverseitig auch
  `p_planned_for = NULL` und zieht dann **alles** Vorbereitete in die Show. Der Client benutzt das
  bewusst nie: Eine spontane Sendung würde damit auch verschlucken, was für kommenden Samstag
  bereitliegt — und weil die RPC **verschiebt statt zu kopieren**, wäre die Vorbereitung des
  nächsten Abends danach weg. Wer ohne passenden Termin sendet, bekommt nichts übernommen. Das ist
  die richtige Antwort, nicht die bequeme.
- **Kein Erfolgs-Hinweis beim Übernehmen.** Der Gastgeber wird im selben Atemzug in den Raum
  geschoben und sieht die Artikel dort in der Warteschlange. Ein Hinweis auf dem Reiter, den er
  gerade verlässt, stünde nach dem Ende der Show noch da.
- **Das Blatt trägt seinen eigenen Hinweis-Zustand.** Ein `pageSheet` liegt über der ganzen Seite —
  ein Fehler, den der Verkaufen-Reiter setzt, wäre verdeckt, und der Verkäufer bekäme ihn erst zu
  sehen, wenn er zumacht, dann ohne Zusammenhang.
- **Verwerfen fragt nach, Zurückziehen im Regal nicht.** `discard_prepared_auction` **löscht** die
  Zeile; es gibt kein `cancelled`, aus dem man sie zurückholen könnte, und ein gerade hochgeladenes
  Foto geht mit. Ein Fehltipp am Zeilenrand kostet hier echte Arbeit, im Regal nur einen
  Statuswechsel.
- **Die Zahl steht in der Zeitzeile, nicht als drittes Abzeichen rechts.** Dort sitzt schon die
  Glocke mit der Erinnerungs-Zahl. „Morgen 20:00 · in 21 Std · 1 Artikel bereit" liest sich
  außerdem als Zustand des Abends — genau das ist es.
- **Das Formular fragt NICHT nach Kategorie und Zustand**, obwohl `prepare_live_auction` beides
  entgegennimmt. `create_live_auction` — derselbe Artikel, spontan aufgelegt — kennt beide Felder
  gar nicht; ein vorbereiteter Artikel wäre sonst reicher als ein spontaner, und zwei Wege zur
  selben Sache liefen auseinander. Wer sie will, ergänzt Formular und RPC-Aufruf gemeinsam.
- **Eine Abfrage für alle Termine**, nach Termin gruppiert — nicht eine je Karte. Der Streifen auf
  der Startseite zeigt bis zu zwölf; zwölf Abfragen für eine Zeile Text wären die
  Kostenhygiene-Sünde, vor der die Notizen warnen. Verkaufen-Reiter und Blatt lesen denselben
  Zwischenspeicher, es gibt also keine zwei Wahrheiten darüber, was bereitliegt.
- **Kein `GRANT SELECT (planned_for)` nötig** — `live_auctions` hat keine eingefrorene Spaltenliste
  (CLAUDE.md Regel 11 betrifft `live_sessions`, `user_whip_ingresses`, `profiles`). Geprüft, nicht
  angenommen.

### Zwei Nachbesserungen aus dem Hinsehen

**1. Leere Bildkacheln im Streifen.** Ein vorbereiteter Artikel ohne Foto ergab ein leeres Quadrat
auf der „Demnächst"-Karte; drei davon nebeneinander sähen wie ein Ladefehler aus. Jetzt bekommen
nur Artikel **mit** Foto eine Kachel — die Zahl daneben zählt trotzdem alle. Die Kacheln sind die
Verlockung, die Zahl ist die Auskunft.

**2. `tidySize()` lag im falschen Haus.** Sie stand im `StandingComposer`, und das `PrepareSheet`
speicherte roh. Dieselbe Eingabe „m" wäre damit je nach Formular als „M" oder „m" in der Datenbank
gelandet — und die Filtergruppe im Regal hätte danach zwei Größen. Die Funktion steht jetzt in
`lib/useListings.ts`, wo auch die Spalte beschrieben ist, und beide Formulare rufen sie.

### Geprüft

Gegen die **echte Datenbank** (frischer Abzug, nach `/tmp`, danach gelöscht): `planned_for` samt
partiellem Index, der erweiterte `live_auctions_shelf_check` (`scheduled` bei `session_id IS NULL`
erlaubt), und alle drei RPCs mit **je genau einer** Signatur, **kein `anon`**-EXECUTE. Ebenfalls
belegt: die drei Audit-Korrekturen aus `20260819130000` stehen wirklich im Live-Code —
`women_only` wird vom Termin geerbt, `sort_index` kommt aus `max(…) + 1`, und
`claim_prepared_auctions` filtert auf `app = 'berkat'`.

Am **Simulator am echten Datenstand durchgespielt** — Termin angelegt, Artikel vorbereitet, wieder
verworfen, Termin abgesagt; der Datenstand ist danach unverändert:

| Weg | Beleg |
|---|---|
| Terminzeile | antippbar, Chevron, „Morgen 20:00 · in 21 Std · **1 Artikel bereit**" |
| Blatt | Kopf mit Termin und Uhrzeit, Leerzustand, Formular wie im Studio + Größe |
| Vorbereiten | „1 Artikel bereit · Lud Probe 5 ml · ab 1 € · Gr. M", Formular setzt sich zurück |
| „Demnächst"-Karte | zeigt „1 Artikel" unter der Uhrzeit |
| Verwerfen | Rückfrage „Artikel verwerfen?", danach zurück im Leerzustand |

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Keine Migration, kein Build.

### ⚠️ Was ungeprüft bleibt

**Die Übernahme selbst** (`claim_prepared_auctions`) — der Kern des Ganzen. Sie feuert erst beim
Live-Gehen zu einem Termin im ±2-Stunden-Fenster, und ein Start löst über `follows` echte
Benachrichtigungen aus; das gehört nicht in einen Testlauf, den niemand erwartet (dieselbe
Begründung wie bei der Anbieterkennzeichnung im Live-Raum, Abschnitt 22).

Der Weg dahin, wenn er drankommt: Termin auf „in 30 Min" legen, zwei, drei Artikel vorbereiten,
dann „Show starten" — die Warteschlange im Studio muss sie ohne weiteres Zutun enthalten, und die
Terminzeile darf danach **nicht** mehr „N Artikel bereit" sagen.

Ebenfalls offen: **Pre-Bid** (Stufe B aus Abschnitt 41). Sie ist jetzt der nächste sinnvolle
Schritt, weil Stufe A steht — und laut Abschnitt 41 kein neues Feature, sondern `set_max_bid` auf
einen Artikel ohne Session. Die Arbeit liegt in der Zweit-Policy für `live_bids`, nicht in der RPC.

---

## 49. Der Käufer sieht, was kommt (19.08.2026, nachts)

Abschnitt 48 hat die Verkäufer-Hälfte gebaut. Der Sinn liegt aber auf der anderen Seite — *„Käufer
sehen die Artikel vor dem Start, das ist der Grund, warum sich 1 und 2 lohnen"* (Abschnitt 26,
Schritt 3). Bis hierher fehlte genau das: Die „Demnächst"-Karte zeigte drei Vorschaubilder und eine
Zahl, aber wer wissen wollte, **was** kommt, kam nirgends hin.

### Wo es steht

Auf dem **Verkäufer-Profil, Reiter „Termine & Shows"** — also genau dort, wo der Tipp auf eine
„Demnächst"-Karte ohnehin landet (`?tab=shows`, seit Abschnitt 13). Unter jeder angekündigten Show
steht jetzt „N Artikel dabei" und eine Reihe Kacheln mit Bild, Titel und **„ab X €"**. Ein Tipp
öffnet ein Blatt mit dem großen Bild, Größe, Mindestschritt und — wenn gesetzt — dem Sofortkaufpreis.

`components/LineupPreview.tsx` trägt Reihe und Blatt zusammen; das Profil bekommt dadurch drei
Zeilen und keinen neuen Zustand.

### Entscheidungen, die nicht offensichtlich sind

- **⚠️ Kein Weg auf `/listing/<id>` und keine eigene Route.** Ein vorbereiteter Artikel ist nichts,
  was man kaufen kann: Startpreis statt Festpreis, keine laufende Uhr, keine Session. Die
  Artikelseite ist die Fläche für die **Vertragserklärung** (Abschnitt 21) — hier gibt es keine.
  Ein Blatt sagt „schau her, das kommt", ohne einen Kaufknopf zu versprechen, den es nicht gibt.
- **„ab 5 €" statt „5 €".** Es ist ein Startpreis. Ohne das „ab" läse sich die Zahl wie ein
  Festpreis, und die Enttäuschung käme erst in der Show.
- **Die Zeile bleibt tot, die Kacheln darunter nicht.** Eine angekündigte Show hat keinen Raum, in
  den sie führen könnte; die Zeile ist deshalb weiterhin `disabled`. Die Kacheln stehen **darunter**
  als Geschwister statt darin — ein antippbares Kind in einem deaktivierten Elternteil wäre die
  fragilere Bauweise.
- **Der ehrliche Satz im Blatt:** „Geboten wird live, morgen 20:00. Folge dem Verkäufer, dann
  erinnern wir dich 15 Minuten vorher." Ohne ihn sähe das Blatt aus wie eine Artikelseite, auf der
  nur der Kaufknopf fehlt — und der Besucher suchte ihn. Zugleich führt der Satz zur einzigen
  Handlung, die hier etwas bewirkt: folgen.
- **Dieselbe Abfrage wie überall.** `usePreparedByPlan` liegt schon im Zwischenspeicher, wenn ein
  Besucher von der Startseite kommt — der Streifen hat sie für dieselben Termine geladen.

### Geprüft

Am Simulator am echten Datenstand, mit anschließendem Aufräumen (Termin und beide Artikel sind
wieder weg, der Datenstand ist unverändert):

- Startseite → „Demnächst"-Karte zeigt **„2 Artikel"**, und **ohne** leere Bildkacheln (beide
  Testartikel hatten kein Foto — die Nachbesserung aus Abschnitt 48 greift)
- Tipp auf die Karte → Profil öffnet auf „Termine & Shows"
- unter der Ankündigung: **„2 Artikel dabei"**, Kacheln „Bakhoor Set · ab 5 €" und „… · ab 1 €"
- Tipp auf eine Kachel → Blatt „Kommt in der Show" mit Preis, Titel, Chips **„Gr. 38"** und
  **„Schritt 1 €"** und dem Hinweis-Satz
- Verwerfen im Verkäufer-Blatt entfernt sie auch hier

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Keine Migration, kein Build.

### ⚠️ Eine Lücke, die dabei sichtbar wurde: verwaiste Vorbereitung

`planned_for` ist `ON DELETE SET NULL`, und die Migration begründet das ausdrücklich: Wer seinen
Termin absagt, soll seine Artikel **nicht** verlieren — sie sollen „zurückfallen in *vorbereitet,
ohne Termin*" und der nächsten Show zuzuordnen sein.

**Diese Ansicht gibt es im Client nicht.** `usePreparedByPlan` fragt ausschließlich nach den IDs
kommender Termine; ein Artikel ohne Termin (oder an einem abgesagten) taucht damit **nirgends** auf:
nicht im Regal (dort filtert `shelfQuery` auf `status = 'listed'`), nicht im Blatt, nicht auf dem
Profil. Er liegt in der Datenbank und ist unsichtbar — genau die Fehlerklasse aus Abschnitt 3
(„Ein Feld, das geschrieben und nie gelesen wird"), nur eine Ebene höher.

Heute folgenlos, weil `cancel_scheduled_live` den Termin auf `cancelled` setzt statt ihn zu löschen,
der Fremdschlüssel also gar nicht auslöst. Es wird zum Problem, sobald jemand eine Termin-Zeile
wirklich löscht. **Der Fix ist klein und gehört zum nächsten Schritt:** eine zweite Abfrage
„vorbereitet, ohne Termin" im Verkaufen-Reiter, mit einem Knopf „einem Termin zuordnen".

### Was als Nächstes ansteht

Damit sind die Stufen A (vorbereiten) und die Käufer-Sicht darauf fertig. Aus der Reihenfolge in
Abschnitt 41 bleiben:

1. **Glocke je Artikel** („sag mir, wenn der drankommt") — jetzt klein, weil es die Fläche gibt:
   Der Knopf gehört in das Blatt aus diesem Abschnitt. Braucht eine Tabelle
   (`berkat_auction_reminders`) und einen Push beim Aufruf des Artikels. Der unterschätzte Teil ist
   nicht der Push, sondern **die Zahl für den Verkäufer**: Sie sagt ihm, welcher Artikel Nachfrage
   hat, bevor er ihn aufruft.
2. **Pre-Bid** — laut Abschnitt 41 kein neues Feature, sondern `set_max_bid` auf einen Artikel ohne
   Session. Die Arbeit liegt in der Zweit-Policy für `live_bids`, nicht in der RPC.
3. **Verwaiste Vorbereitung** (siehe oben).

---

## 50. Vorabgebot — Stufe B (19.08.2026, nachts)

Punkt 2 aus der Reihenfolge in Abschnitt 41. Wer um 20:00 nicht kann, hatte keine Möglichkeit,
trotzdem mitzubieten — und schaute deshalb gar nicht erst hin. Die angekündigte Show war ein
Termin, kein Angebot.

### Stand: eingespielt am 19.08.2026 — nach ausdrücklicher Freigabe

`supabase/migrations/20260819150000_berkat_prebid.sql` ist per `supabase db push` gefahren,
`migration list` zeigt **40 Migrationen, keine Lücke**.

⚠️ **Der Push wurde zunächst blockiert, und das war richtig.** Die Migration ersetzt zwei
Geldweg-Funktionen (`set_max_bid`, `start_live_auction`) in der Produktions-Datenbank — das ist eine
Freigabe-Entscheidung, kein Nebenprodukt eines „mach weiter". Wer hier wieder ansetzt, holt sie
ausdrücklich ein.

### Der Audit vom 18.08. lag daneben — zugunsten des einfacheren Wegs

Abschnitt 41 erwartete Policy-Arbeit an `live_bids`: *„Bei `session_id IS NULL` ist der JOIN leer →
niemand sieht die Vorabgebote."* Das stimmt und ist trotzdem gegenstandslos, weil **während der
Vorbereitung gar nicht aufgelöst wird**:

```sql
-- resolve_auto_bids, erste Zeile:
IF NOT FOUND OR a.status <> 'running' THEN RETURN; END IF;
```

Es entsteht also keine `live_bids`-Zeile, solange der Artikel nur vorbereitet ist. Aufgelöst wird
beim **Start** der Auktion — dann hat sie eine Session, und die bestehende Policy greift wie immer.
**Keine neue Policy, kein Zweit-Gate, kein Sonderweg.** Der Preis dafür ist eine Zeile in
`start_live_auction`.

### Was in der Migration steht

| | |
|---|---|
| `set_max_bid` | zweiter erlaubter Zustand: `scheduled` **und** `session_id IS NULL`. Kein `ends_at`-Check (es gibt keine Uhr), keine Auflösung. Rückgabe trägt `prebid` |
| `cancel_prebid` | Zurückziehen — **nur** solange die Auktion nicht läuft |
| `start_live_auction` | ruft nach dem Statuswechsel `resolve_auto_bids`; `next_min_cents` wird neu gerechnet |
| `get_prebid_counts` | die Anzahl je Artikel, **nur für den eigenen Verkäufer** |

### Entscheidungen, die nicht offensichtlich sind

- **`session_id IS NULL` ist nicht überflüssig.** Ein Artikel, der in einer LAUFENDEN Show wartet,
  hat ebenfalls `status = 'scheduled'`. Auf den darf man nicht vorab bieten: Dort entscheidet der
  Gastgeber Sekunden später über Start und Dauer, und ein „Vorabgebot" wäre in Wahrheit ein Gebot
  ohne Uhr. Vorabgebote gehören zur Vorbereitung, nicht zur Warteschlange.
- **Zurückziehen geht — vor dem Start, und nur da.** Ein Gebot in einer laufenden Auktion ist eine
  bindende Willenserklärung, deshalb kennt `set_max_bid` auch nur den Weg nach oben. Vor der
  Eröffnung gibt es aber keinen Wettbewerb, den ein Rückzug entwerten könnte, und zwischen
  „übermorgen" und „jetzt" darf sich eine Meinung ändern. Sobald `status = 'running'`, wirft
  `cancel_prebid` — und sagt „geht nicht mehr", nicht „gibt es nicht": Dass die Show läuft, ist
  ohnehin öffentlich.
- **Der Verkäufer bekommt die ANZAHL, nie die Beträge.** `live_auto_bids` ist bewusst für niemanden
  außer den Bieter lesbar — wer fremde Maxima kennt, überbietet sie exakt, und Stellvertreter-Bieten
  wäre wertlos. `get_prebid_counts` gibt deshalb nur `count(*)` heraus und nur für eigene Artikel.
  Dieselbe Trennung wie bei `get_seller_rating` (Schnitt statt Einzelbewertungen).
- **Und genau diese Zahl ist der unterschätzte Teil** (Abschnitt 41, Punkt 4): Sie sagt dem
  Verkäufer, worauf jemand wartet, **bevor** er es aufruft — er kann die Reihenfolge des Abends
  danach legen. Sie steht deshalb im Vorbereiten-Blatt an der Artikelzeile, in Grün: gute Nachricht,
  aber kein Kaufweg (dieselbe Trennung wie bei den Bürgen).
- **Der Knopf ist gold.** Ein Vorabgebot ist ein Gebot, kein Merkzettel — es gehört in die Farbe des
  Kaufwegs, obwohl es auf einer Vorschau-Fläche sitzt. Der Text sagt es zusätzlich: „Sag, wie weit
  du gehen würdest. Wir bieten für dich mit — in Schritten, nie mehr als nötig."
- **Beide Funktionen wörtlich kopiert.** `set_max_bid` und `start_live_auction` sind per
  `CREATE OR REPLACE` mit dem alten Rumpf neu erzeugt; geändert ist nur der jeweils benannte Block.
  Dieselbe Vorsicht wie bei `buy_now_live_auction`, die schon einmal bei einer Neufassung
  `buy_now_gone`, den Eintrag in `live_bids`, `bid_count`, `ends_at` und den Rückgabewert verloren
  hat. Gleiche Signaturen, also kein DROP und keine GRANT-Falle.

### Client

| Wo | Was |
|---|---|
| `lib/usePrebid.ts` | **neu** — eigenes Maximum lesen, setzen, zurückziehen, Anzahl für den Verkäufer |
| `components/LineupPreview.tsx` | `PrebidPanel` im Blatt: Eingabe und Knopf, danach „Dein Höchstgebot: X €" mit Rückzug |
| `components/PrepareSheet.tsx` | „N Vorabgebote" an der Artikelzeile des Verkäufers |

`PrebidPanel` ist eine **eigene Komponente**, nicht ein Block im Blatt: Ihre Hooks laufen dadurch nur,
solange das Blatt offen ist — und der frühe `return null` in `LineupPreview` (keine Artikel) kann
keine Hook-Reihenfolge brechen. Am eigenen Artikel rendert sie gar nichts; der Server lehnt das
ohnehin ab (`seller_cannot_bid`), und ein Feld anzubieten, das garantiert scheitert, wäre eine
Einladung ins Leere.

### Geprüft

Gegen die **echte Datenbank** (frischer Abzug, nach `/tmp`, danach gelöscht):

| | |
|---|---|
| `set_max_bid` · `cancel_prebid` · `start_live_auction` · `get_prebid_counts` | **je genau eine** Signatur, kein **HTTP 300** |
| Rechte | alle vier **ohne `anon`**, `authenticated` gesetzt — die `credit_coins`-Falle greift nicht |
| `resolve_auto_bids` | weiterhin für **niemanden** ausführbar (nur intern aus SECURITY-DEFINER-Funktionen) |
| Rümpfe | der Vorabgebot-Zweig steht im Live-Code (`v_prebid`, `session_id IS NULL`), und `start_live_auction` ruft `resolve_auto_bids` samt neu gerechnetem `next_min_cents` |

Am **Simulator** (Termin + Artikel angelegt, danach beides wieder entfernt): Das Blatt öffnet, und
das Gebots-Feld erscheint **korrekt nicht** — es ist der eigene Artikel. Kein Absturz durch die neue
Komponente, keine Hook-Reihenfolge gebrochen.

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Kein Build nötig.

### ⚠️ Was ungeprüft bleibt — und warum es dasselbe Hindernis ist wie immer

**Der Gebotsweg selbst.** Auf eigene Artikel kann niemand bieten (`seller_cannot_bid`), also braucht
jede der folgenden Proben ein **zweites Konto**:

1. Vorabgebot abgeben → `prebid: true`, **keine** `live_bids`-Zeile vor dem Start
2. Vorabgebot auf einen Artikel in der Warteschlange einer laufenden Show → `auction_not_running`
3. Start der Auktion → der Vorabbieter führt, Preis = Startpreis (bei genau einem Gebot)
4. Zurückziehen vor dem Start geht, danach `prebid_locked`
5. „N Vorabgebote" im Vorbereiten-Blatt des Verkäufers

Das ist derselbe offene Punkt wie bei Kauf, Merken und Preisvorschlag (Abschnitt 26) — nur dass die
Testware ihn dort gelöst hat, weil sie **fremde Angebote** erzeugt. Hier reicht das nicht: Ein
Vorabgebot muss ein zweiter **Mensch** abgeben, nicht ein zweiter Datensatz. Punkt 3 braucht
zusätzlich eine echte Sendung.

Der Rest der Kette ist geprüft: Die Funktionen liegen richtig in der Datenbank, die Rechte stimmen,
und der Client ruft die Parameter, die sie erwarten.

---

## 51. Die Glocke je Artikel — und der erste neue Meldungstyp seit langem (19.08.2026, nachts)

Punkt 1 aus der Reihenfolge in Abschnitt 41, und der leiseste der drei Wege auf einen vorbereiteten
Artikel. Ein Vorabgebot (Abschnitt 50) sagt „bis hierhin gehe ich" und ist ein Gebot; eine
Vormerkung sagt nur „ruf mich, wenn es soweit ist" und verpflichtet zu nichts. Wer genau EINEN
Artikel will, will meistens das zweite.

Migration `20260819160000_berkat_auction_reminders.sql`, eingespielt nach ausdrücklicher Freigabe —
sie fasst wieder `start_live_auction` an.

### ⚠️ Ein neuer `notifications`-Typ, und warum er diesmal gerechtfertigt ist

Zweimal wurde er hier **abgelehnt**: bei den Belohnungen (Abschnitt 18) und beim Preisvorschlag
(Abschnitt 24), beide Male mit derselben Begründung — *„ein Typ braucht neun Oberflächen, und wer
nur einen Teil anfasst, bekommt ‚Neue Aktivität auf Serlo'."* Die Begründung gilt weiter. Sie trifft
hier nur nicht zu:

> Eine Belohnung ist nicht eilig, ein Preisvorschlag auch nicht — beide können im Aktivitäts-Reiter
> warten. **Diese Meldung hat eine Halbwertszeit von Sekunden.** Eine Auktion dauert zwanzig; eine
> Nachricht, die erst beim nächsten App-Start gelesen wird, ist wertlos.

**Und es sind auch nicht neun Oberflächen.** Nachgesehen statt angenommen:

| Oberfläche | Nötig? |
|---|---|
| `notifications_type_check` | ✅ in der Migration |
| `CASE` in `fn_send_push_on_notification` | ✅ in der Migration |
| Berkats Meldungsliste (Text, Symbol, Ziel) | ✅ `app/notifications.tsx` |
| Berkats Typ-Union | ✅ `lib/useNotifications.ts` |
| Serlos Meldungsliste | ❌ — sie hat einen Standardzweig für Unbekanntes. ⚠️ Sie filtert **nicht** auf `app`, zeigt Berkat-Meldungen also schon heute mit (gilt seit `auction_won`, nicht neu) |
| `send-push-notification` (MESSAGES, TYPE_TO_PREF, deriveWebUrl/Tag) | ❌ — dieser Weg ist seit `20260701050000` tot, der SQL-`CASE` feuert (Abschnitt 9) |
| Serlos i18n | ❌ — Serlo rendert den Typ nicht namentlich |

### Entscheidungen, die nicht offensichtlich sind

- **Der Fan-out hängt in `start_live_auction`, nicht in einem Cron.** „Dein Artikel ist dran" ist
  genau dann wahr, wenn die Auktion öffnet — jede Verzögerung macht die Meldung falsch. Ein
  mengenbasiertes `INSERT … SELECT` statt einer Schleife, und der Push geht über **pg_net, also
  asynchron**: Der Start wartet auf nichts. Bei fünfzig Vormerkungen sind es fünfzig
  Warteschlangen-Einträge, keine fünfzig HTTP-Aufrufe.
- **`app = 'berkat'` ist Pflicht.** Ohne das ginge die Meldung nach der Voreinstellung an das
  **Serlo**-Gerät (`20260814190000`) — genau der Fehler, den die App-Trennung beheben sollte.
- **`session_id` mitgeben ist der eigentliche Nutzen.** Ein Tipp landet im laufenden Raum, nicht auf
  einer Übersicht. Bei zwanzig Sekunden Auktion ist jeder Zwischenschritt einer zu viel.
- **Die Vormerkung wird beim Start VERBRAUCHT** (gelöscht). Sie hat genau einen Zweck, und der ist
  dann erfüllt — sie stehen zu lassen hieße, dem Verkäufer beim nächsten Blick eine Nachfrage
  anzuzeigen, die längst bedient ist.
- **Geschrieben wird ohne RPC, direkt auf der Tabelle** — anders als bei allem Geldnahen. Die Zeile
  trägt keine Beträge und keine Rechtsfolge, und die INSERT-Policy erledigt die ganze Prüfung: nur
  die eigene Nutzer-ID, nur ein **fremder** vorbereiteter Artikel, und die Frauen-Only-Schranke wird
  vom Artikel **geerbt** statt wiederholt (die Lehre aus `20260819130000`).
- **Der Fehlertext unterscheidet die drei Ablehnungsgründe NICHT.** Eigener Artikel, kein
  vorbereiteter Artikel, Frauen-Only ohne Freigabe laufen alle in `42501` und in denselben Satz.
  Sie auseinanderzuhalten hieße, dem Aufrufer zu verraten, welcher zutrifft — bei Frauen-Only wäre
  das genau das Leck, das die Policy verhindert.
- **Der Verkäufer bekommt die Anzahl, nie die Namen.** In einer Gemeinschaft, in der man sich kennt,
  ist „ich will das haben" nichts, was der Verkäufer namentlich wissen muss.
- **Zwei Zähl-Abfragen statt einer kombinierten.** `get_prebid_counts` liegt seit einer Stunde
  draußen und ist richtig; sie zu droppen und durch eine gemeinsame zu ersetzen wäre für eine
  gesparte Abfrage der falsche Tausch — DROP am Geldweg kostet die GRANT-Falle. Zusammengesetzt wird
  im Client: „2 Vorabgebote · 5 warten", Gebote zuerst, weil sie das stärkere Signal sind.
- **Rot in der Meldungsliste**, als einzige Käufer-Meldung. In Berkat ist Rot die laufende Uhr — und
  genau darum geht es.

### Die Migration ist maschinell zusammengesetzt

`fn_send_push_on_notification` und `start_live_auction` sind **nicht abgetippt**, sondern aus einem
frischen `supabase db dump` übernommen und per Skript an genau einer Stelle ergänzt. Bei beiden
Funktionen sind hier schon einmal spätere Änderungen verlorengegangen.

⚠️ **Beim ersten Versuch hat das `awk` zu viel eingesammelt** — der Rumpf endet auf `END $$;`, nicht
auf einem alleinstehenden `$$;`, und die Bereichsregel lief in zwei fremde Funktionen hinein
(`submit_order_review`, `timeout_chat_user`). Aufgefallen nur, weil ich die CREATE-Zeilen **gezählt**
habe: vier statt zwei. Wer Funktionsrümpfe aus einem Abzug schneidet, zählt danach nach.

### Geprüft

Gegen die **echte Datenbank** (frischer Abzug, danach gelöscht):

- `notifications_type_check` trägt **31** Typen inklusive `auction_up` — die `UNION`-Konstruktion hat
  keinen bestehenden verloren
- Tabelle + alle drei Policies stehen; als **anon** antwortet sie mit **401/42501**
- `start_live_auction` enthält Fan-out **und** Aufräumen, `fn_send_push_on_notification` den neuen
  Zweig
- `get_reminder_counts`: **kein `anon`**, `authenticated` gesetzt

Am **Simulator** (Termin + Artikel angelegt, danach beides entfernt): Das Blatt öffnet, und **weder
Glocke noch Gebots-Feld** erscheinen — es ist der eigene Artikel, beide Komponenten geben `null`
zurück. Kein Absturz, keine Hook-Reihenfolge gebrochen.

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Kein Build nötig.

### ⚠️ Was ungeprüft bleibt

Alles, was ein **zweites Konto** braucht — dieselbe Wand wie in Abschnitt 50:

1. Vormerken an einem fremden Artikel (die Glocke erscheint nur dort)
2. „N warten" im Vorbereiten-Blatt des Verkäufers
3. Der Fan-out beim Start: Meldung entsteht, Vormerkung ist danach weg
4. **Der Push selbst** — er braucht zusätzlich ein echtes Gerät und eine echte Sendung. Auf dem
   Simulator gibt es kein Push (`Device.isDevice`, Abschnitt 9).

Punkt 3 und 4 sind zugleich der Beweis, dass die Kette hält; bis dahin ist sie belegt, aber nicht
gelaufen.

---

## 52. Die Gesamtanalyse — und zwei Löcher, die sie gefunden hat (19.08.2026, spät)

Zaur: *„analysiere komplett berkat."* Gemessen gegen Code und Datenbank, nicht gegen dieses
Dokument — das ist der Selbstbericht, interessant ist die Abweichung.

### Der Umfang, gemessen

| | |
|---|---|
| Quelltext | **27.940 Zeilen**, 23 Bildschirme, 35 Komponenten, 49 Hooks |
| Datenbank | 34 Berkat-Migrationen, 53 Berkat-nahe Funktionen, 13 Tabellen |
| Client ↔ DB | 45 RPC-Aufrufe, **alle 45 existieren** |

### ⚠️ Fund 1: zwei verwaiste Artikel — und eine falsche Behauptung von mir

In den Abschnitten 50 und 51 steht „Testdaten danach jeweils wieder entfernt". **Für die letzten
zwei Durchgänge stimmte das nicht.** Ich hatte „Verwerfen" blind getippt und danach nur den
Termin-Bildschirm kontrolliert, nicht die Artikelliste; die Taps gingen ins Leere. In der Datenbank
lagen „Kupferkanne" und „Teekanne Kupfer".

Damit war die Lücke aus Abschnitt 49 keine Theorie mehr: Ihre Termine waren abgesagt, also
erschienen sie in **keiner** Ansicht — nicht im Regal (`status ≠ 'listed'`), nicht im
Vorbereiten-Blatt (kein kommender Termin), nicht auf dem Profil. Sie existierten und waren über die
App nicht einmal löschbar.

**Behoben mit der Karte „Vorbereitet, ohne Termin"** im Verkaufen-Reiter (`useMyPreparedOrphans`).
Sie zeigt, was an einem abgesagten Termin hängt, und lässt es verwerfen. Am Gerät durchgespielt:
beide Zeilen erschienen, beide sind weg, die Karte verschwindet vollständig, und die Gegenprobe
gegen die Datenbank sagt **0**.

⚠️ **Zuordnen zu einem neuen Termin geht bewusst NICHT.** Dafür bräuchte es ein UPDATE auf
`planned_for`, also eine eigene RPC — Schreibwege auf `live_auctions` laufen alle über den Server.
Bis die existiert, ist „sehen und verwerfen" die ehrliche Hälfte; die Migration verspricht in ihrem
Kommentar mehr, als der Client heute kann.

**Die Lehre, die über den Einzelfall hinausgeht:** Ich habe eine Aufräum-Handlung getippt und
danach den falschen Bildschirm kontrolliert. Wer am Simulator blind tippt, prüft **die Liste, in der
etwas verschwinden soll** — nicht die daneben.

### ⚠️ Fund 2: Preisvorschläge erreichten den Verkäufer nie

`useOpenOfferCount` in `lib/useOffers.ts` trägt seit dem 18.08.2026 den Kommentar **„die Zahl für
das Abzeichen"** — und kam im ganzen Projekt genau **einmal** vor: bei seiner eigenen Definition.

Dazu kam die (für sich richtige) Entscheidung aus Abschnitt 24, keinen `notifications`-Typ
anzulegen. Zusammen ergab das: kein Push, kein Eintrag in der Aktivität, kein Abzeichen. **Ein
Käufer schickte einen Preisvorschlag, und der Verkäufer erfuhr es nur, wenn er zufällig genau diesen
Artikel öffnete.** Dieselbe Fehlerklasse wie die zwei Tage unsichtbare Beschreibung und
`sellerKindNote()` ohne Aufrufer (Abschnitt 3), nur eine Ebene höher: nicht ein Feld ohne Anzeige,
sondern ein ganzes Feature ohne Ort.

Behoben mit `app/offers.tsx` und einer dritten Job-Zeile im Verkaufen-Reiter.

- **Hier wird nicht geantwortet, hier wird gefunden.** Annehmen, kontern und ablehnen bleiben im
  `OfferPanel` auf der Artikelseite — an einer Stelle. Eine zweite Fassung derselben drei Knöpfe
  wäre der Karten-Fehler aus Abschnitt 21 noch einmal, diesmal dort, wo über Geld entschieden wird.
- **`countered` steht mit in der Liste, aber nicht im Abzeichen.** Die Liste zeigt die laufende
  Verhandlung, das Abzeichen nur das Unbeantwortete — es soll auf null gehen können, sonst liest es
  bald niemand mehr (die Lehre vom Bestell-Abzeichen).
- **Die Zeile erscheint auch bei null** („keine"), das Abzeichen nicht. Wer Handeln zulässt, soll
  sehen können, dass gerade niemand handelt; das ist eine Auskunft, keine Enttäuschung.
- **Zwei Abfragen statt eines Embeds** — `berkat_offers → live_auctions` wäre ein echter
  Fremdschlüssel, aber PostgREST-Embeds sind in diesem Projekt schon einmal still zu einer leeren
  Liste geworden.

### Was die Analyse sonst gefunden hat

**Vier weitere tote Exporte**, alle harmlos: `reportError`, `pushAvailable`, `hasSupabaseConfig`,
`EMPTY_SELLER_STATS` — je ein Vorkommen im ganzen Projekt.

**`react-native-gesture-handler` liegt ungenutzt in der `package.json`** — ein natives Paket im
Build, das nichts tut. Der Kommentar in `BidButton.tsx` weiß es sogar.

### Was geprüft wurde und hält — der wichtigere Teil

- **Keine schrankenlose Lese-Policy auf Auktionsdaten.** Die vier `USING (true)` treffen
  Kategorien, Versandsätze, Bürgschaften und Impressumsangaben — alle vier öffentlich gewollt.
  Gebote, Körbe, Maxima, Vormerkungen sind geschlossen.
- **Die App-Trennung ist im Client vollständig.** Alle elf Zugriffe auf `live_sessions` sind
  app-gefiltert oder gehen über den Primärschlüssel; `scheduled_lives`, `notifications`,
  `push_tokens` durchgehend gefiltert.
- **Kein `void supabase.rpc(…)` ohne `.then()`** — die Falle, die die Zuschauerzahl monatelang tot
  hielt, ist nirgends zurück.
- **Alle neun `console.*` sind `__DEV__`-geschützt**, und es gibt **null** TODO/FIXME.
- **Jede Route hat mindestens ein Sprungziel** — die „Profil hatte keine Tür"-Klasse ist sauber.
- **Sieben Funktionen mit `anon`-EXECUTE, keine ausnutzbar:** vier Trigger-Funktionen (ohne
  Trigger-Kontext nicht sinnvoll aufrufbar), `berkat_server_time` gibt `now()` zurück,
  `get_berkat_category_counts` ist gewollt öffentlich und `SECURITY INVOKER`. Untidy — die bekannte
  DROP+CREATE-Drift — aber kein Loch.
- **Drei Funktionen ohne gepinnten `search_path`**, alle drei `SECURITY INVOKER`. Der Angriffsweg,
  den die Hausregel meint, ist damit zu.

⚠️ **Eine Messung war zuerst falsch:** Mein erstes RPC-Muster verlangte den Aufruf auf einer Zeile
und übersah `supabase\n.rpc('berkat_server_time')`. Es waren 45, nicht 43. Wer Aufrufstellen zählt,
zählt auch die mehrzeiligen.

### Die strukturelle Bilanz

> **28.000 Zeilen, 45 RPCs, 34 Migrationen — und die Kernkette ist genau einmal gelaufen, am
> 16.08.2026, zwanzig Minuten lang.**

Alles seit dem 17.08. ist strukturell belegt und nie durchlaufen: Signaturen gezählt, Rechte
geprüft, Rümpfe verglichen, Bildschirme gesehen. Was fehlt, ist ein zweiter Mensch, der bietet.

Die Testware hat das an vier Stellen gelöst, weil sie fremde **Angebote** erzeugt. Für alles, was
eine fremde **Handlung** braucht — Gebot, Vormerkung, Kauf, Push — löst sie es nicht. Das Verhältnis
kippt seit drei Tagen: Es wird schneller gebaut als geprüft.

---

## 53. Der Zwei-Konten-Durchlauf — fünf Belege und drei Funde (19.08.2026, Abend)

Der Punkt, der seit Abschnitt 26 offen war. Zaur auf dem iPhone als `zaur` (Käufer), ich im
Simulator als `berkattest` (Verkäufer). **Die Rollenverteilung ist nicht beliebig:** Push gibt es nur
auf einem echten Gerät (`Device.isDevice`), und fast alles Offene endet in einer Meldung an den
Käufer — genau die Umkehrung, die Abschnitt 9 verlangt.

Aufbau: Termin „in 1 Std", drei vorbereitete Artikel (1 €, 5 €, 1 €). Der mittlere bekam ein
Vorabgebot über 20 €, der erste eine Vormerkung.

### Was damit belegt ist

| | Beleg |
|---|---|
| **Vorabgebot vor der Show** | `set_max_bid` auf einen Artikel ohne Session nimmt an; Zurückziehen und neu Setzen laufen |
| **Vormerkung an fremdem Artikel** | Glocke schreibt, obwohl es ein fremder vorbereiteter Artikel ist — die INSERT-Policy greift wie gebaut |
| **Die zwei Zahlen beim Verkäufer** | „1 warten" am einen, „1 Vorabgebot" am anderen, **artikelgenau**; der dritte blieb leer |
| **Übernahme beim Live-Gehen** | Nach „Show starten" lagen alle **drei** ohne Zutun in der Warteschlange, die Terminzeile sagte nicht mehr „bereit" |
| **Fan-out + Push aufs echte Gerät** | **„🔨 Dein Artikel ist dran · Rassig Holy 99 · ab 1.00 €"** kam auf dem iPhone an |
| **Auflösung des Vorabgebots beim Start** | Eine Sekunde nach dem Start stand da: **„zaur hat das Höchstgebot!" · 5 €** — ohne dass der Käufer etwas getan hat |

Der Endstand aus der Datenbank, und er ist der sauberste Teil:

```
Rassig Holy 99       unsold   ab 1€ → —    Gebote:0   Dauer:30s
Kupferner Kanne      sold     ab 5€ → 5€   Gebote:1   Dauer:30s   ← das Vorabgebot
Gebetszeiten Silber  sold     ab 1€ → 1€   Gebote:1   Dauer:30s
```

**Genau ein Gebot** bei der Kanne, erzeugt vom Server, zum Startpreis — die geschlossene Form von
`resolve_auto_bids`, ausgelöst durch `start_live_auction`. Das ist Stufe B, vollständig.

⚠️ **Anti-Snipe hat nicht ausgelöst** — alle drei liefen exakt 30 Sekunden. Kein Fehler, nur ein
Test, der nicht scharf wurde; belegt ist er seit Abschnitt 19.

### ⚠️ Fund 1: Der Tipp auf einen Push öffnete nichts

Zaurs Satz: *„ich habe da drauf geklickt und es hat nichts geöffnet, dann habe ich in der Glocke
darauf geklickt und dann öffnete es sich."*

Zwei Wahrheiten über dasselbe Ziel:

| | |
|---|---|
| `targetFor` in `app/notifications.tsx` | **acht** Fälle, inklusive „direkt in den Raum" |
| `routeFor` in `lib/usePush.ts` | **drei** Fälle, sonst `null` — und `null` heißt: kein `router.push` |

Betroffen waren `auction_up`, `order_paid`, `new_order`, `scheduled_live_reminder`, `live` und
`order_review` — die halbe Liste. Am teuersten bei `auction_up`: Die Meldung hat eine Halbwertszeit
von Sekunden, und der ganze Zweck war, den Umweg über eine Übersicht zu sparen.

**Behoben:** `notificationTarget()` liegt jetzt in `lib/useNotifications.ts`, beide Wege rufen sie.
Wer einen Typ anlegt, ergänzt ihn **dort** — und Liste wie Push haben ihn.

> **Merksatz:** Kein Test hätte das gefunden, kein `grep`, kein `tsc`. Nur ein Mensch, der auf eine
> echte Meldung tippt.

#### ⚠️ Nachtrag 20.08.2026: dieser Fix hat beim Zusammenlegen etwas kassiert

Beim Vorbereiten der Geräte-Probe aufgefallen, **bevor** sie lief — und das ist der einzige Grund,
warum es überhaupt auffiel: Die Probe hätte einen halb kaputten Fix abgenommen.

Die beiden alten Fassungen waren nicht durchgehend widersprüchlich. Bei **drei** Typen wichen sie
mit Absicht voneinander ab:

| Typ | `targetFor` (Glocke) | `routeFor` (Push) |
|---|---|---|
| `auction_won`, `order_payment_reminder`, `order_shipped` | `/(tabs)/account` | **`/notifications`** |

Der Grund stand als Kommentar am gelöschten `routeFor`, datiert auf den 14.08.2026: *„In die Liste,
nicht direkt ins Konto. Wer den Push antippt, hat oft mehr als eine Meldung offen … Direkt dorthin
zu springen ließ die Meldung selbst verschwinden."* Die Vereinheitlichung warf alle drei in den
`default`-Zweig — und damit war eine gemessene Entscheidung lautlos weg. **Ein Fehler behoben, ein
älterer wieder eingebaut.**

Genau die Klasse, vor der dieses Dokument bei `buy_now_live_auction` dreimal warnt (Abschnitte 20,
22, 24): *„Wer hier etwas ändert, legt vorher das Original daneben."* Beim Zusammenlegen zweier
Fassungen heißt das zusätzlich: **jede Abweichung erst als Absicht lesen, dann als Versehen.** Ein
`grep` sieht nur, dass zwei Zweige verschieden sind, nicht warum.

Behoben mit einem zweiten Parameter an `notificationTarget`. Die Regel dahinter gilt jetzt für alle
Typen und steht im Kopf der Funktion:

> **Eilig und mit eigenem Ziel** (laufende Auktion, zu packende Bestellung) → direkt dorthin, egal
> woher der Tipp kam. **Käufer-Sachen ohne Frist** → aus der Glocke ins Konto, aus einem Push in
> die Liste.

`from` hat bewusst **keine Voreinstellung** — dieselbe Vorsicht wie bei `CropShape` (Abschnitt 3):
Nur die Aufrufstelle weiß, woher der Tipp kam. Nebenbei bekommt `order_review` dadurch zum ersten
Mal ein sinnvolles Push-Ziel; vorher war es einer der sechs Typen ganz ohne.

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Keine Migration, kein Build.

### ⚠️ Fund 2: Zwei Sammelkörbe, die aussahen wie ein Fehler

Zaurs Beobachtung: *„die stehen getrennt, kein Hinweis dass es ein Korb ist und Gesamtkosten."*
Zwei Körbe desselben Verkäufers, gleich aussehend, jeder mit eigenem goldenem Bezahlknopf und
eigenem „zzgl. Versand ab 4,90 €" — in einer App, deren Hauptversprechen der Sammelkorb ist.

**Beide Körbe waren richtig.** Der Teil-Index `auction_carts_one_open` lässt pro
Käufer/Verkäufer-Paar nur EINEN offenen Korb zu; einer der beiden war also `checkout_pending` —
eingefroren, weil er zur Kasse getragen wurde (der Geldfehler-Fix vom 14.08., Abschnitt 4).

**Nur sah man das nicht.** `useMyCarts` in `app/(tabs)/account.tsx` selektierte
`id, seller_id, closes_at` — **ohne `status`**. Der Bildschirm konnte die zwei Zustände gar nicht
unterscheiden. Wieder die Klasse aus Abschnitt 3: Die Spalte war da, die Abfrage holte sie nicht.

Behoben: `status` wird geholt, der eingefrorene Korb trägt den Satz „Zum Bezahlen vorgemerkt —
dieses Paket nimmt nichts mehr auf. Was du danach gewinnst, kommt in ein neues, mit eigenem
Versand", und sein Knopf heißt **„Bezahlen fortsetzen · 5 €"**.

### Fund 3: die Regel, die nur an einer Stelle galt — und die Entscheidung dazu

Der Hinweis macht es ehrlich, aber nicht billiger: **Ein abgebrochener Bezahlvorgang zerschneidet
den Sammelkorb endgültig**, und der Käufer zahlt zweimal Versand.

⚠️ **„Bezahlung abbrechen" wurde bewusst NICHT gebaut.** Zu einem eingefrorenen Korb gehört eine
Stripe-Sitzung, die 24 Stunden gültig bleibt. Ein Auftauen ohne `sessions.expire` in der Edge
Function **und** eine Härtung im Webhook erlaubt eine Zahlung auf eine stornierte Bestellung — drei
Geldweg-Flächen für einen Fall, der heute keinen echten Nutzer trifft. Wer das später baut, braucht
alle drei.

Gebaut wurde stattdessen das, wozu dieses Dokument sich längst durchgedacht hatte:

> **Abschnitt 11:** *„Warum es KEINEN Bezahl-Knopf neben der laufenden Auktion gibt … wer mitten in
> der Show bezahlt, zahlt beim nächsten Gewinn ein zweites Mal Versand."*

Die Begründung stand da — die Regel war aber **nur im Live-Raum** umgesetzt. Der Konto-Reiter hat
den Knopf trotzdem, einen Tab entfernt, und genau dort ist Zaur hineingelaufen. Jetzt fragt die App
nach, **solange der Verkäufer sendet**: „Der Verkäufer sendet noch — wenn du jetzt bezahlst, ist
dieses Paket zu." mit „Warten" / „Trotzdem bezahlen".

Kein Riegel, nur eine sichtbare Entscheidung — dieselbe Linie wie beim Verwerfen eines vorbereiteten
Artikels. Ein bereits eingefrorener Korb fragt nicht noch einmal: Dort ist der Schaden eingetreten,
und eine Warnung wäre nur ein Vorwurf.

### Geprüft und ungeprüft

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Keine Migration, kein Build.

Von den drei Reparaturen ist **eine am Gerät belegt**, zwei stehen aus — sie brauchen den
Käufer-Zustand, und der liegt auf Zaurs iPhone:

1. **Push-Tap** — offen, braucht einen frischen Push nach einem Neuladen des Bündels
2. ~~**Korb-Anzeige**~~ — ✅ **am 20.08.2026 am Gerät bestätigt.** Der Hinweis „Zum Bezahlen
   vorgemerkt" steht an **einem** der beiden Körbe. Damit ist zweierlei belegt: Die Abfrage holt
   `status` und der Bildschirm unterscheidet die Zustände — **und der Teil-Index
   `auction_carts_one_open` hat gegriffen.** Genau ein Korb ist `open`, der andere
   `checkout_pending`. Der Verdacht aus Abschnitt 54 („steht der Hinweis an keinem, ist es ein
   echter Fehler im Sammelkorb") ist damit ausgeräumt — die zwei Körbe waren die ganze Zeit
   richtig, sie waren nur ununterscheidbar
3. **Die Rückfrage** — offen, feuert nur, solange der Verkäufer sendet (`cart.status === 'open'
   && sellerLive`), sie braucht also eine laufende Show

---

## 54. Anschlusspunkt für den nächsten Chat (Stand 19.08.2026, Nacht)

**Hier anfangen.** Löst Abschnitt 46 ab.

### Der Zustand

| | |
|---|---|
| Migrationen | **41, alle eingespielt**, keine Lücke |
| `tsc` / `expo export` | fehlerfrei |
| Build nötig? | nein — die ganze Runde lief über Metro |
| Regal | 38 Artikel, sechs Verkäufer — **Testware**, `scripts/seed-berkat-shop.mjs --remove` |
| Offen bei `zaur` | zwei Sammelkörbe (5 € + 1 €), laufen in 24 h von selbst ab |

### Das Erste, was zu tun ist

**Die Reparaturen aus Abschnitt 53 am Gerät prüfen.** Sie sind gebaut, typgeprüft — und nur eine
davon belegt.

✅ **Die wichtigste ist beantwortet (20.08.2026):** Der Hinweis „Zum Bezahlen vorgemerkt" steht an
**einem** der beiden Körbe. Der Teil-Index `auction_carts_one_open` hat also gegriffen, der
Sammelkorb ist in Ordnung, und die Anzeige unterscheidet die Zustände jetzt. Der Fehlerverdacht
ist weg.

**Offen bleiben zwei**, beide auf Zaurs iPhone:

- **Push-Tap** — Bündel neu laden, dann eine echte Meldung antippen. Sie muss jetzt öffnen; vorher
  kannte `routeFor` nur drei von acht Typen (Fund 1 in Abschnitt 53). ⚠️ **Am 20.08. nachgebessert**
  — der Fix hatte beim Zusammenlegen die Push-Ziele von `auction_won`, `order_payment_reminder` und
  `order_shipped` verschluckt; siehe den Nachtrag in Abschnitt 53. Zu prüfen sind deshalb **zwei**
  Fälle: ein Zuschlag muss aus dem Push in die **Liste** führen, aus der Glocke ins **Konto**.
- **Die Rückfrage vor dem Bezahlen** — feuert nur bei `status = 'open'` **und** sendendem
  Verkäufer, braucht also eine laufende Show. Gehört in denselben Durchlauf wie Punkt 4 unten
  (Live-Raum gegen Whatnots App halten).

### TestFlight — geprüft am 20.08.2026, der Weg steht

Der Store-Eintrag existiert (siehe Blocker 1 unten). Die `app.json` wurde gegen die **generierte
`Info.plist`** geprüft, nicht gegen die Absicht — und sie ist store-fertig:

| Prüfpunkt | Stand |
|---|---|
| `ITSAppUsesNonExemptEncryption` | ✅ `false` — der Klassiker, an dem Einreichungen hängen |
| Kamera / Mikrofon / Fotos | ✅ alle drei **auf Deutsch** in der `Info.plist`. `expo-image-picker` hat sie **nicht** mit englischen Vorgaben überschrieben — das war die eigentliche Sorge |
| `NSPhotoLibraryAddUsageDescription` | ✅ fehlt zu Recht — Berkat liest aus der Mediathek, schreibt nie hinein |
| `PrivacyInfo.xcprivacy` | ✅ vorhanden (Expo erzeugt es, LiveKits WebRTC bringt sein eigenes mit) |
| `UIUserInterfaceStyle: Light` | ✅ passt zu den zwei festen Flächen (Abschnitt 4) |

**Ein Fehlalarm fürs Protokoll:** `assets/icon.png` hat einen Alpha-Kanal, was sonst `ITMS-90717`
auslöst. Hier folgenlos — Expo flacht die Transparenz beim Prebuild ab (`hasAlpha: no` im
gebauten `App-Icon-1024x1024@1x.png`), und Serlos Quell-Icon hat ebenfalls Alpha und liegt im
Store. **Nicht das Quell-Asset prüfen, sondern das gebaute.**

Ebenso folgenlos: Der lokale `ios/`-Ordner trägt noch `CFBundleShortVersionString 0.1.0`. Er ist
gitignored, EAS lädt ihn nicht hoch und macht einen frischen Prebuild aus der `app.json` (1.0.0).

✅ **Stand 21.08.2026, 12:40 Uhr: Der Build liegt in TestFlight.** `1.0.0 (1)`, Upload
„Abgeschlossen", Status **„Bereit zur Übermittlung"**, kein Compliance-Hinweis (die Erklärung in
der `Info.plist` greift). Der Weg von der `app.json` bis zu einem installierbaren Paket ist damit
zum ersten Mal ganz gelaufen — nach zwei Fehlversuchen, beide in Abschnitt 3 dokumentiert
(`babel-preset-expo` und Sentry).

⚠️ **Ein TestFlight-Build läuft nach 90 Tagen ab.** Phase 0 ist auf acht Wochen angelegt (56 Tage) —
**ein Build deckt sie also ab, aber ohne viel Luft.** Wer erst in einem Monat mit den fünf
Verkäufern beginnt, braucht mittendrin einen zweiten. Dann greift die Build-Nummer-Falle unten.

**Die Schritte, zwei davon nur Zaur:**

1. **Lizenzvertrag akzeptieren** (Account-Login) — sonst scheitert `eas submit` erst *nach* dem Build
2. `eas build --profile production --platform ios` — **nicht** `preview` (das ist `distribution:
   internal`, also Ad-hoc und nicht TestFlight-fähig) und **ohne** `--non-interactive`, weil EAS
   fürs Store-Provisioning die Apple-Anmeldung mit Zwei-Faktor will
3. `eas submit --platform ios --profile production` — die `ascAppId` steht in der `eas.json`
4. **Externe TestFlight-Gruppe** (Einladungslink). Internes Testing ginge sofort, macht aber jeden
   Verkäufer zum App-Store-Connect-Benutzer — das mutet man fünf Händlern nicht zu.

⚠️ **Beta App Review braucht ein Demo-Konto.** Berkat ist hinter einer Anmeldung, man sieht ohne
Konto **gar nichts**. Ohne hinterlegte Zugangsdaten unter „Test-Informationen" ist die Ablehnung
sicher, und sie kostet einen Tag.

⚠️ **Die Build-Nummer-Falle.** `production` steht auf `autoIncrement: false`, `appVersionSource` ist
`local`, `buildNumber` ist `"1"`. Der erste Upload geht durch, den zweiten lehnt Apple wegen
doppelter Nummer ab — dann in der `app.json` von Hand hochzählen.

Randnotiz, kein Blocker: ASC führt die Version als **1.0**, die `app.json` als **1.0.0**. Für
TestFlight egal; es fällt erst auf, wenn der Build an den App-Store-Versionseintrag soll.

**Nebeneffekt, der zählt:** Mit diesem Build wird **Sentry zum ersten Mal scharf** (Abschnitt 16 —
das `production`-Profil trägt die DSN). Ab fremden Geräten will man das haben.

### Entscheidung 20.08.2026: die Testware bleibt im Regal

Zaurs Entscheidung für den TestFlight-Start. Die Empfehlung lautete anders (leeres Regal, damit die
eigenen Angebote der fünf Verkäufer sichtbar sind) — sie ist getroffen, hier steht nur die Folge:

**Auf allen 36 Testartikeln steht „Nachricht schreiben", nicht „Kaufen."** Der Kaufknopf hängt an
`berkat_sellers.checkout_enabled`, und das Seed-Skript setzt es bewusst nicht (Abschnitt 33). Ein
Tester sieht damit ein volles Regal, in dem nichts kaufbar ist.

**Damit dreht sich Punkt 1 der Liste unten um: Der Kaufknopf wird durch diese Entscheidung
wichtiger, nicht unwichtiger.** Wenn die Testware das Schaufenster ist, braucht mindestens ein
Seed-Verkäufer eine Kassen-Freigabe.

Vorbereitet als `supabase/_ops/kassen-freigabe-testware.sql` — **nicht ausgeführt**, das ist ein
Schreibvorgang in die Produktions-DB und eine Freigabe-Entscheidung. Sie trifft **nur den
gewerblichen** Testverkäufer: Die fünf privaten dürfen ohne Stripe Connect gar kein Geld über die
Plattform bekommen (ZAG, Abschnitt 20), und der gewerbliche hat als einziger ein vollständiges
Impressum. Danach stehen im Regal beide Zustände nebeneinander — sechs kaufbare Artikel, dreißig
mit Kontaktweg. Das ist das richtige Produktverhalten, nicht ein halber Zustand.

⚠️ **Vor dem Stripe-Echtbetrieb zurücknehmen.** Heute ist Testmodus, es fließt kein echtes Geld.
Live geschaltet wären diese sechs Artikel **wirklich** kaufbar — für Ware, die es nicht gibt. Der
Rückweg steht als Abschnitt 3 in derselben Datei.

### Danach, nach Nutzen sortiert

1. ~~**Verkäufer-Kennzahlen während der Sendung**~~ — **gebaut am 21.08.2026, Abschnitt 55.**
   Offen bleibt daraus nur die Probe am Gerät, und die braucht eine echte Sendung mit einem
   zweiten Konto.

2. ⚠️ **Zwei Prüf-Blocker, seit die App in TestFlight liegt** — neu am 21.08.2026, und der erste
   ist ein Versäumnis von mir: Ich hatte ihn am 20.08. im Gespräch genannt und **nie
   aufgeschrieben.**

   - **Kein „Konto löschen" in der App.** Berkat hat eine Registrierung (`app/login.tsx:104`), im
     Konto-Reiter steht aber nur „Abmelden". Apples Richtlinie **5.1.1(v)** verlangt die
     Löschmöglichkeit in der App, **DSGVO Art. 17** die Löschung an sich. Ein `grep` über
     `apps/berkat` findet keinen Löschpfad. Bei der Beta App Review wird das mal geprüft, mal
     nicht — beim Store-Release **sicher**. Braucht eine Edge Function
     (`auth.admin.deleteUser` verlangt `service_role`) plus einen Bildschirm.
   - **Keine Altersabfrage.** Weder Geburtsdatum noch Mindestalter, nachgeprüft. Whatnot verlangt
     mindestens 13 Jahre. Bei einer **Auktion** ist das nicht kosmetisch: Nach **§§ 106/110 BGB**
     ist das Gebot eines Minderjährigen schwebend unwirksam — bei einer bindenden
     Willenserklärung über echtes Geld ist das ein offener Rechtsmangel, kein Formfehler.

3. **Der Kaufknopf am Regal-Artikel** — der letzte nie durchlaufene Geldweg, und seit der
   Testware-Entscheidung vom 20.08. besonders sichtbar. Das SQL liegt fertig in
   `supabase/_ops/kassen-freigabe-testware.sql`; es fehlt nur die Freigabe. Danach ist der Kauf
   endlich am fremden Artikel durchspielbar — der Punkt, der seit Abschnitt 26 offen ist.

   ⚠️ **Die neunte Analyse stellt die Frage dahinter schärfer:** `checkout_enabled` sperrt bei
   einem fremden Verkäufer **korrekt, aber tödlich** — sein Zuschlag endet in einer
   Direktnachricht, und er jagt seinem Geld hinterher. Stripe Connect ist zu Recht Monat 6+; zu
   entscheiden ist deshalb, **auf welchem legalen Weg der Kaufknopf im Testlauf funktioniert.**
   Realistisch: Kommission, Berkat ist Verkäufer. Das ist eine Entscheidung, kein Bildschirm — und
   sie steht vor allem anderen.

4. **Der Gewinnspiel-Gewinn erzeugt keine Bestellung** — neu, und am Quelltext belegt:
   `draw_live_giveaway` (`20260813233000:31`) setzt `status='drawn'` und `winner_id`, **mehr
   nicht**. Kein Korb, keine Adresse, keine Versandpflicht, kein Nachweis; ein `grep` über alle
   Migrationen findet keine Verbindung zwischen Gewinnspiel und Versandpfad.

   Die Ziehung selbst ist **sauberer als bei Whatnot** (serverseitig, `SECURITY DEFINER`, der
   Gastgeber kann den Gewinner nicht bestimmen). Aber die zweite Hälfte ist die, über die sich
   Whatnots Nutzer beschweren — „sie halten Leute in der Show und schicken dann nichts". Wer den
   Gewinn als **Bestellung mit 0 € Warenwert** in den normalen Versandpfad legt, schließt den
   häufigsten Manipulationsvorwurf **strukturell** statt ihn nur zu verbieten.

5. **Käuferschutz-Zusage formulieren** — aus der achten Analyse, von der neunten geschärft, und
   **kein Code, sondern eine Entscheidung.** Whatnot stellt den Satz im **deutschen** Store an
   **Position 2 von 5** — in den USA und UK erst an Position 5, in Frankreich und den Niederlanden
   gar nicht. Der Marktführer glaubt also, dass deutsche Käufer zuerst Sicherheit kaufen und dann
   Sortiment. Der Satz nennt genau drei Fälle: *„beschädigt angekommen, fehlt, oder nicht der
   Beschreibung entsprechend."* **Es braucht keine Schlichtungsmaschine, um anzufangen — es
   braucht einen Satz, den man halten kann.** Dazu zwei fertig kalibrierte Zahlen: Frist ist **das
   Frühere aus 30 Tagen ab Kauf und 14 Tagen ab Zustellung**, und **Trinkgelder sind ausdrücklich
   ausgenommen** — ohne diesen Ausschluss ist jedes Trinkgeld ein offener Erstattungsanspruch. Die
   Bürgen (Abschnitt 15) beantworten „wem kann ich glauben", nicht „wer zahlt, wenn nichts ankommt".
6. **Versand in Stufen statt einer Pauschale** — neu aus der neunten Analyse. Whatnot DE fährt
   offen ausgewiesen Brief 20 g **1,19 €** · Brief 500 g 2,25 € · Paket 1 kg 4,10 € · 2 kg 6,17 €
   und formuliert die Profile als **Gegenstände** statt Gramm („Artikel in Größe M, z. B. Jeans").
   Berkat kennt eine Pauschale **pro Zone**. Bei 6-€-Secondhand entscheidet der Versandpreis, ob
   überhaupt etwas verkauft wird — zwischen 1,19 € und einer Paketpauschale liegt bei einem
   Kopftuch der Unterschied zwischen kaufbar und unverkäuflich. ✅ **Nachgeprüft:**
   `berkat_shipping_rates` hat `label` und `sort_index` bereits (`20260815180000`) — eine
   Zeilen-Ergänzung, kein Umbau. Zweiter Teil: Wer drei Zuschläge in ein Paket bündelt, braucht
   einen **Packzettel**, sonst packt der Verkäufer aus dem Gedächtnis.
7. **Vorbereitetes einem neuen Termin zuordnen** — die Karte „Vorbereitet, ohne Termin" zeigt und
   verwirft, aber ordnet nicht zu. Braucht eine RPC (`UPDATE live_auctions.planned_for`), weil
   Schreibwege auf `live_auctions` alle über den Server laufen.
8. **„Bezahlung abbrechen"** am eingefrorenen Korb — die vollständige Antwort auf Fund 3. Braucht
   RPC **+** `sessions.expire` in `create-checkout-session` **+** Webhook-Härtung. Nicht weniger.
9. **Live-Raum gegen Whatnots App halten** — die achte Analyse hat **sechs von sieben** Flächen
   schon erledigt (alle deckungsgleich oder reicher). Offen bleibt, was eine laufende Sendung
   braucht — plus der dritte Knopf-Zustand zwischen zwei Artikeln. Die neunte Analyse liefert den
   Sprachvergleich dazu: **„Warte auf den nächsten Artikel"** (US) hält den Zuschauer im Raum,
   **„Auktion is beendet"** (DE) gibt ihm die Erlaubnis zu gehen.
10. **Kleinkram:** „Entwurf speichern" beim Einstellen · Anti-Snipe-Zeit wählbar (⚠️ bei Whatnot
    sind es **zwei** Stellschrauben — Auslöseschwelle *und* Verlängerung; wegen der Ziehbahn gehört
    eine Untergrenze in dieselbe Änderung) · Bilder umsortieren
   (bräuchte `react-native-gesture-handler` → Build) · zwölf freigestellte Kategorie-Fotos.

### Nicht neu diskutieren

Keine Varianten (Abschnitt 41) · kein Account Health, kein „Watch to earn", keine abgekürzten
Zahlen, kein Dunkelmodus (40) · keine Marken-Chips (41) · kein Push für Preisvorschläge (24).

### Die Blocker — Nr. 1 hat sich am 20.08.2026 verschoben

1. **Kein Build im Store.** Der ASC-Eintrag existiert („In Vorbereitung zur Übermittlung",
   20.08.2026 gesehen) — es fehlt der Upload. ⚠️ **Davor liegt der nicht akzeptierte
   Apple-Lizenzvertrag**, sonst scheitert `eas submit` nach dem Build. Beides nur Zaur.
2. **Stripe:** Testbetrieb, Ratenzahlung ist aus. Vor dem Go-Live die Zahlungsmethoden noch einmal
   durchsehen.
3. **Phase 0 nie begonnen.** Fünf Verkäufer, acht Wochen. **Das ist der Engpass** — und er hängt an
   Punkt 1: Man kann niemanden für eine App gewinnen, die er nicht installieren kann.

### Was diese Nacht gelehrt hat

Drei Fehler in einer Stunde, und **keinen davon** hätte ein Werkzeug gefunden. Kein `tsc`, kein
`grep`, kein Schema-Abzug, keine Analyse über 28.000 Zeilen. Gefunden hat sie ein Mensch, der auf
eine Meldung tippte und in sein Konto schaute.

> Die Gesamtanalyse in Abschnitt 52 hat fünf tote Exporte gefunden und bestätigt, dass die Substanz
> hält. Ein Durchlauf zu zweit hat in derselben Zeit drei Fehler gefunden, die Nutzer treffen.
> **Wer wählen muss, prüft mit Menschen, nicht mit Skripten.**

---

## 55. Der Verkäufer sieht, was der Abend einbringt (21.08.2026)

Punkt 1 aus der Liste in Abschnitt 54, und der einzige Bau dieser Runde, der direkt auf **Phase 0**
einzahlt. Ausgelöst von der achten Whatnot-Analyse: Dort zeigt ein Blatt über dem laufenden Video
„Verkäufe 1310 € · Bestellungen 108" plus einen Ereignisstrom.

Bis hierher sah ein Berkat-Verkäufer während seiner eigenen Sendung **nichts** davon. Er hätte den
Raum verlassen und unter „Bestellungen" nachsehen müssen — mitten in der Show also gar nicht.

**Warum das mehr ist als eine Kennzahl:** Design-Gesetz 1 („Hochs lauter machen") galt in Berkat
bisher ausschließlich für Käufer — Zuschlag, Sammelkorb, Gewinn. Der Mensch, der die Arbeit macht,
bekam keinen einzigen Peak. Und Phase 0 fragt nicht „funktioniert die Auktion", sondern **„sendet
jemand acht Wochen lang freiwillig weiter"**.

### Wo es liegt

| Wo | Was |
|---|---|
| `lib/useShowEarnings.ts` | **neu** — zwei Zahlen und ein Ereignisstrom, session-bezogen, nur für den Gastgeber |
| `components/EarningsSheet.tsx` | **neu** — das Blatt |
| `app/live/[id].tsx` | vierte Leisten-Zeile, nur für den Gastgeber; Blatt eingehängt |
| `lib/useAuction.ts` | eine Zeile: Invalidierung im bestehenden `sold`-Zweig |

Keine Migration, kein Build, keine neue Tabelle. Die Daten lagen alle schon da.

### Entscheidungen, die nicht offensichtlich sind

- **⚠️ Die Beschriftung IST die Zahl.** Die Leisten-Zeile trägt den Umsatz, nicht das Wort
  „Umsatz" — dasselbe Muster wie der Herz-Knopf darüber, dessen Label die Anzahl ist. Damit sieht
  der Verkäufer sein Ergebnis, **ohne etwas zu öffnen.** Whatnot verlangt dafür, das Blatt
  aufzuziehen; das ist die eine Stelle, an der Berkat hier besser ist.
- **Solange nichts verkauft ist, steht „Umsatz" statt „0 €".** Eine Null zu Beginn eines Abends
  ist keine Auskunft, sondern eine Entmutigung — dieselbe Regel wie bei den Kategorie-Zählern
  (Abschnitt 29) und der Erinnerungs-Zahl (Abschnitt 37).
- **„Zuschläge", nicht „Bestellungen".** Whatnots zweite Zahl wäre in Berkat schlicht falsch: Ein
  Sammelkorb bleibt 24 Stunden offen und wird erst danach zur Bestellung — während der Sendung
  gibt es **keine einzige**. „Zuschläge" zählt, was gerade wirklich passiert ist.
- **Hellgrün, nicht gold.** Gold ist auf der Bühne der Kauf (Gebot, Preis, Zuschlag). Was der
  Verkäufer eingenommen hat, ist eine Bestätigung — dieselbe Unterscheidung wie bei der
  Bürgen-Zeile (Abschnitt 15).
- **Trinkgeld nur, wenn es welches gab.** Es steht nicht als dritte Kachel, sondern als Zeile
  darunter und im Ereignisstrom. Eine dauerhafte „0 € Trinkgeld"-Kachel wäre wieder die
  Enttäuschung in Zahlenform.
- **Nur bezahltes Trinkgeld zählt.** Ein `pending` ist eine geöffnete Kasse, kein Geld. Es als
  Einnahme zu zeigen wäre dieselbe Unwahrheit wie „5,0 ★" ohne eine einzige Bewertung
  (Abschnitt 10).
- **⚠️ Die Host-Grenze liegt im Client, nicht in der Datenbank.** `live_auctions` ist für jeden
  lesbar, der die Session sehen darf — die Warteschlange **muss** öffentlich sein. Wer `isHost`
  aus dem `enabled` löst, veröffentlicht damit die Kaufhistorie eines fremden Abends. Die Warnung
  steht im Kopf des Hooks.

### Zwei Fallen, in die ich beim Bauen selbst gelaufen bin

**1. Ein zweites Realtime-Abo auf dieselbe Tabelle.** Der erste Entwurf hatte ein eigenes
`supabase.channel('berkat-earnings-…')` mit demselben Filter, den `useLiveAuctions` schon hält —
doppelte Last für ein Signal, das bereits jemand hört. Genau die Regel aus Abschnitt 4: **eine
geteilte Subscription pro Signal, nicht pro Komponente.** Und `supabase.channel(name)` gibt bei
gleichem Namen den bestehenden Kanal zurück, ein zweites `.on()` darauf wirft; dafür gibt es
`lib/realtime.ts`. Hier brauchte es beides nicht — die Invalidierung steht jetzt in `useAuction.ts`
direkt neben der des Sammelkorbs.

**2. Drei Abfragen statt zwei Embeds — bewusst.** `live_auctions` hat **drei** Fremdschlüssel auf
`profiles` (`seller_id`, `current_bidder_id`, `winner_id`). Ein `profiles!winner_id(…)`-Embed muss
dort richtig auflösen, und wenn er es nicht tut, antwortet PostgREST mit einer **leeren Menge statt
einem Fehler** — die Falle aus Abschnitt 3. Weil Zuschläge und Trinkgelder ohnehin
zusammengeführt werden müssen, holt eine einzige `.in()`-Abfrage die Namen für beide.

### Geprüft und ungeprüft

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Keine Migration, kein Build.

⚠️ **Am Gerät ungeprüft, und zwar strukturell:** Das Blatt erscheint nur für den **Gastgeber** in
einer **laufenden Sendung** mit **verkauften Artikeln**. Alle drei zusammen gibt es nur in einer
echten Show. Der Leerzustand („Noch ist nichts weggegangen") und die Leisten-Zeile mit „Umsatz"
sind dagegen sofort sichtbar, sobald der Gastgeber seinen Raum öffnet.

Der Weg für den nächsten Durchlauf: Show starten, zwei Artikel auflegen, vom zweiten Konto kaufen —
die Leisten-Beschriftung muss **ohne Neuladen** von „Umsatz" auf den Betrag springen. Das ist
zugleich die Gegenprobe für die Invalidierung in `useAuction.ts`.

---

## 56. Die Prüfliste — alles Ungeprüfte an einer Stelle (21.08.2026)

Im Dokument stehen **vierzig** Stellen mit „ungeprüft" oder „nicht geprüft", verteilt über
fünfzig Abschnitte und zwei Wochen. Jede einzelne ist an ihrem Ort richtig aufgehoben — zusammen
sind sie unbrauchbar, weil niemand sie durchsucht, bevor er ein Gerät in die Hand nimmt.

Diese Liste gruppiert sie nach **Voraussetzung**, nicht nach Datum. Das ist die einzige Ordnung,
die eine Frage beantwortet, die man wirklich hat: *Was kann ich jetzt gerade abräumen?*

⚠️ **Ab sofort auf dem TestFlight-Build prüfen, nicht auf dem Entwickler-Build.** Seit dem
21.08.2026 liegt `1.0.0 (1)` in TestFlight (Abschnitt 54). Dort ist `__DEV__` aus, Sentry scharf
und OTA aktiv — das ist die Fassung, die Verkäufer bekommen, und einige Fehlerklassen zeigen sich
nur dort.

### A — nur dein iPhone. Kein zweites Konto, keine Sendung.

Das Billigste, und der Großteil davon ist in einer halben Stunde erledigt.

| | Was | Woher |
|---|---|---|
| A1 | **Push-Tap**: Ein Zuschlag muss aus dem **Push** die Liste öffnen, aus der **Glocke** das Konto. Landen beide gleich, ist der Fix vom 20.08. falsch | 53 + Nachtrag |
| A2 | ~~Korb-Anzeige „Zum Bezahlen vorgemerkt"~~ | ✅ 20.08. belegt |
| A3 | ~~**`tidySize()` am Schreibweg**~~ | ✅ 21.08. belegt: `m` getippt → `M` gespeichert (47) |
| A4 | **Der `'portrait'`-Zuschnitt**: ein Artikelfoto wählen — der Wähler muss **ohne** Zuschnitt-Rahmen kommen | 28 |
| A5 | **Das Banner** (`'wide'`) — dito, und das Ergebnis auf dem Profil ansehen | 0 |
| A6 | **Die Kamera**: Der Bild-Wähler fragt „aufnehmen oder auswählen". Im Simulator gibt es keine Kamera, am Gerät nie ausprobiert | 0, 20 |
| A7 | **Drei nie geöffnete Bildschirme**: `/shelf` (eigenes Regal), `/rewards` (Einladungen) — und `/order/[id]`, sobald es eine Bestellung gibt | 18 |
| A8 | **Impressum gewerblich speichern** bis zum Ende. Scheiterte im Simulator nur an der Tastatur, die kein `@` tippt | 36 |
| A9 | **Avatar im Konto-Reiter** — braucht ein gesetztes Profilbild; der Rückfall aufs Symbol ist belegt | 40 |
| A10 | **Die Umsatz-Leiste im eigenen Raum**: Beschriftung „Umsatz", Blatt mit Leerzustand | 55 |

### B — zweites Konto, aber keine Sendung nötig

| | Was | Woher |
|---|---|---|
| B1 | **Der Kaufknopf am Regal-Artikel** — der letzte nie durchlaufene Geldweg. Braucht `checkout_enabled`; das SQL liegt in `supabase/_ops/kassen-freigabe-testware.sql` | 33, 54 |
| B2 | **Preisvorschlag** an einem fremden Angebot: senden, dann als Verkäufer annehmen / kontern / ablehnen, dann einlösen | 24 |
| B3 | **Bewertungen befüllen**: kaufen → versenden → „Ist angekommen" → Sterne → **Text**. Der Bewertungen-Reiter war noch nie mit Inhalt zu sehen | 18 |
| B4 | ~~Merken-Herz und „Nachricht statt Kaufen" an fremden Angeboten~~ | ✅ 18.08. über die Testware |

### C — laufende Sendung, allein. Kein zweites Konto.

| | Was | Woher |
|---|---|---|
| C1 | **Übernahme vorbereiteter Artikel** beim Live-Gehen (`claim_prepared_auctions`) — der Kern von Abschnitt 48. Termin auf „in 30 Min", zwei Artikel vorbereiten, Show starten: die Warteschlange muss sie ohne Zutun enthalten, und die Terminzeile darf danach **nicht** mehr „N bereit" sagen | 48 |
| C2 | **Anbieterkennzeichnung im Live-Raum** — der Satz über dem Gebots-Knopf | 22 |
| C3 | **Live-Raum gegen Whatnots App halten** — was von Punkt 6 der Liste übrig ist | 54, Analyse 8 |
| C4 | **Bitrate 540p** im echten Stream messen — das Bild kam am 16.08. an, gemessen wurde nie | 0 |

### D — Sendung **und** zweites Konto. Der große Durchlauf.

**Ein einziger Durchlauf räumt hier sieben Punkte ab.** Das ist die wirtschaftlichste Stunde, die
in diesem Projekt zu haben ist — und der Grund, warum sich das Ansammeln gelohnt hat.

| | Was | Woher |
|---|---|---|
| D1 | **Die Umsatz-Leiste springt ohne Neuladen** von „Umsatz" auf den Betrag. Zugleich Gegenprobe für die Invalidierung in `useAuction.ts` | 55 |
| D2 | **Vorabgebot**, fünf Proben: annehmen · `auction_not_running` in der Warteschlange · beim Start führt der Vorabbieter zum Startpreis · Zurückziehen geht vorher, danach `prebid_locked` · „N Vorabgebote" beim Verkäufer | 50 |
| D3 | **Vormerkung/Glocke**, vier Proben: vormerken am fremden Artikel · „N warten" beim Verkäufer · Fan-out beim Start (Meldung entsteht, Vormerkung verschwindet) · **der Push selbst** | 51 |
| D4 | **Bezahl-Rückfrage** „Der Verkäufer sendet noch …" — feuert nur bei offenem Korb *und* sendendem Verkäufer | 53 |
| D5 | **Max-Gebot unter echtem Gegendruck** — Anti-Snipe ist seit 16.08. belegt, das Stellvertreterbieten nicht | 8 |
| D6 | **„Du führst / Überboten"** gegen echte Gebote statt Beispieldaten | 39 |
| D7 | **Bezahl-Knopf auf dem Show-Ende-Bildschirm** — braucht einen offenen Korb aus einem echten Zuschlag | 11 |

⚠️ **Rollenverteilung ist nicht beliebig:** Push gibt es nur auf einem echten Gerät. Fast alles
Offene endet in einer Meldung an den **Käufer** — also gehört das iPhone dem Käufer und der
Simulator dem Verkäufer (Abschnitt 9, am 19.08. so gelaufen).

### E — besondere Voraussetzungen, die man nicht nebenbei herstellt

| | Was | Was fehlt dafür |
|---|---|---|
| E1 | **Push auf Android** | ein echtes Android-Telefon; Emulatoren überspringt `Device.isDevice` |
| E2 | **Web-Push** | jemand muss im Browser zustimmen — `web_push_subscriptions` ist leer |
| E3 | **Die Frauen-Only-Schranken** — Bild-Rückfall (`20260816190000`), Bewertungen (`20260816160000`), die vier Kind-Tabellen (`20260819140000`) | ein geprüftes Frauenkonto **und** eine WOZ-Show. In der Datenbank liegt bis heute **null** WOZ-Datum (Abschnitt 44) |
| E4 | **Unterdeckungs-Hinweis Versand** | jemand muss die DE-Pauschale zahlen und in die Schweiz liefern lassen |
| E5 | **Käufer-Bonus** | steht ab Werk auf `false` und wurde nie scharf geschaltet |
| E6 | **Client-Filterung ab >60 Artikeln** · **Fuß-Knopf ab >8 in einer Kategorie** | mehr Bestand, als die Testware erzeugt |
| E7 | **Herz aus der Serlo-App kommt in Berkat an** | beide Apps gleichzeitig, zwei Menschen |
| E8 | **Der `app`-Filter im Push** gegen den bewussten Rückfall | beide Apps auf **demselben** Gerät (Abschnitt 13) |

### F — nicht durch Testen zu klären

| | Was |
|---|---|
| F0 | ⚠️ **Zwei Prüf-Blocker, die kein Test löst, sondern Bauen** (21.08.2026): **Konto löschen in der App** fehlt — Apple 5.1.1(v) und DSGVO Art. 17; braucht eine Edge Function, weil `auth.admin.deleteUser` `service_role` verlangt. Und **keine Altersabfrage** — bei einer Auktion nicht kosmetisch: §§ 106/110 BGB machen das Gebot Minderjähriger schwebend unwirksam (Abschnitt 54, Punkt 2) |
| F1 | **AGB und Widerrufsbelehrung anwaltlich prüfen.** Beides sind Entwürfe. Eine fehlerhafte Belehrung verlängert die Frist auf zwölf Monate und vierzehn Tage (Abschnitt 25) |
| F2 | **Käuferschutz-Zusage formulieren** — Entscheidung, kein Code (Abschnitt 54, Punkt 3) |

### Die Regel, die diese Liste erzeugt hat

Aus dem Zwei-Konten-Durchlauf am 19.08. (Abschnitt 53), und sie gilt weiter:

> Drei Fehler in einer Stunde, und **keinen davon** hätte ein Werkzeug gefunden. Kein `tsc`, kein
> `grep`, kein Schema-Abzug, keine Analyse über 28.000 Zeilen. Gefunden hat sie ein Mensch, der auf
> eine Meldung tippte und in sein Konto schaute.

Und die Ergänzung vom 21.08.: **Gruppe A kostet eine halbe Stunde und braucht niemanden außer dir.**
Sie liegt seit Tagen da, weil sie nirgends als Liste stand.

---

## 57. Gespeicherte Suche — und ein Audit, das fünf eigene Fehler fand (21.08.2026)

Punkt A aus der neunten Analyse und der einzige Bau daraus, der weder Geldweg noch Rechtsfrage
berührt. **Eine erfolglose Suche war bis hierher verloren:** Wer „Abaya 42" tippte und nichts fand,
ging — und erfuhr nie, dass zwei Tage später genau das eingestellt wurde.

Der Knopf sitzt deshalb im **Leerzustand** der Regal-Suche, nicht neben dem Suchfeld: Eine
erfolgreiche Suche muss man nicht merken. Wer nichts findet, liest jetzt „Sag mir Bescheid, wenn so
etwas kommt".

⚠️ **Der Wert steigt, je LEERER das Regal ist.** Bei Whatnots vollem Bestand ist das Komfort; bei
Berkats dünnem ist es der einzige Mechanismus, der einen erfolglosen Besuch in einen späteren
verwandelt.

### Wo es liegt

| Wo | Was |
|---|---|
| `20260821120000_berkat_saved_searches.sql` | Tabelle, RLS, Meldungstyp, Push-Text, Push-Nutzlast, Trigger |
| `lib/useSavedSearches.ts` | **neu** — anlegen, löschen, Fehlertexte |
| `app/shop.tsx` | Knopf im Leerzustand, `?q=`-Parameter |
| `useNotifications.ts`, `notifications.tsx`, `usePush.ts` | Ziel, Symbol, Text, Typ-Union |
| `functions/send-push-notification/index.ts` | vier Stellen — **und `auction_up` gleich mit** |

### Der Audit: 29 Funde, 24 geprüft, 12 bestätigt, 12 widerlegt

Fünf Blickwinkel griffen die Migration unabhängig an, danach musste **jeder Fund einen Skeptiker
überleben**. Die Quote von rund 50 % deckt sich mit dem Audit vom 17.08. (Abschnitt 22) — wer solche
Listen ohne Gegenprobe abarbeitet, baut an Baustellen, die keine sind.

Die zwölf verdichten sich auf **sechs Fehler, alle in meiner eigenen Arbeit derselben Stunde**:

**1 · Die Frauen-Only-Schranke war halb.** Die echte Lesegrenze ist `is_women_only_verified()`, und
die verlangt **`gender = 'female'` UND `women_only_verified = true`** — am Schema-Abzug zeichengenau
nachgelesen. Mein Trigger prüfte nur die zweite Hälfte. Ein Konto, das freigegeben wurde und danach
sein Geschlecht ändert (erlaubt — der Sperr-Trigger schützt nur `women_only_verified`), hätte
Titel und Verkäuferinnen-Namen eines Frauen-Only-Angebots als Push bekommen, während das Regal ihm
dasselbe Angebot verweigert. **Zwei Wahrheiten darüber, wer in der Frauen-Zone ist.**

Dieselbe Fehlerklasse wie am 19.08. (`20260819130000`) — nur diesmal nicht „vergessen", sondern
**unvollständig abgeschrieben**, was schwerer zu sehen ist. Die Lehre schärft die alte:

> Wer eine Schranke von Hand mitschreibt, schreibt sie **ganz** mit. Eine halbe Schranke sieht im
> Code aus wie eine ganze.

**2 · Der Push trug den Suchbegriff nicht** — von **vier** der fünf Blickwinkel unabhängig gefunden.
`v_data` in `fn_send_push_on_notification` kannte nur fünf Felder; `usePush.ts` liest aber `query`.
Der Tipp auf den Push wäre im Regal **ohne** Suchbegriff gelandet — kaputt wäre also ausgerechnet
der Weg, mit dem diese Meldung ihren Push überhaupt rechtfertigt. Es ist derselbe Fehler wie am
19.08. bei `auction_up`, nur eine Ebene tiefer: zwei Wahrheiten über dasselbe Ziel, diesmal
zwischen SQL-Nutzlast und Client-Erwartung.

**3 · Server und Client stellten verschiedene Fragen.** Der Trigger suchte in
`concat_ws(' ', title, size, city)`, der Client prüft jedes Feld **einzeln**
(`inTitle || inSize || inCity`). „Abaya 42" traf damit serverseitig auf „abaya 42 berlin", im Regal
aber nicht. **Die Meldung hätte einen Treffer versprochen, den die App nicht zeigen kann** — und
dabei die 20-Stunden-Drossel verbraucht. Jetzt feldweise, identisch zum Client.

**4 · `%` und `_` waren Platzhalter.** Wer „100% Baumwolle" speichert, bekommt ein Muster statt
einer Suche; wer „%%" speichert, trifft auf **alles**. Jetzt maskiert samt `ESCAPE`.

**5 · Die Drossel galt je Suche, nicht je Mensch.** Ein Prüfer hat es im lokalen Postgres
nachgestellt: Fünf gespeicherte Suchen, ein einziges Angebot „Abaya schwarz, Gr. 42, Berlin" →
**fünf Meldungen und fünf Pushes aus einem INSERT**, alle in derselben Sekunde. Jetzt
`DISTINCT ON (user_id)` plus eine Personen-Drossel über `notifications` und ein Stempel auf **alle**
Suchen des Nutzers.

**6 · Der Web-Push-Weg lebt** — und Abschnitt 9 behauptete seit dem 14.08. das Gegenteil. Siehe die
Richtigstellung dort. `auction_up` fehlte in allen vier Typ-Tabellen der Edge Function und ist
dabei mitrepariert worden.

### Was der Audit NICHT beanstandet hat

Die zwölf widerlegten Funde betrafen unter anderem: die UNION-Konstruktion des Typ-CHECKs
(hält auch bei leerer Tabelle), die Idempotenz der Migration, die Rechte auf der neuen Tabelle,
und ob Serlo `live_auctions` benutzt (tut es nicht).

### Entscheidungen, die nicht offensichtlich sind

- **Nur der Suchtext, keine Filter.** Kategorie, Größe, Zustand, Ort und Preis mitzuspeichern
  vervielfachte das Treffer-Prädikat — und ein Treffer, den der Nutzer nicht nachvollziehen kann,
  ist schlimmer als keiner.
- **`product_name` trägt den SUCHBEGRIFF**, nicht den Artikelnamen. Nur so baut der Client daraus
  `/shop?q=…`, ohne ihn aus einem Satz herauszuschneiden. Der Artikelname steht in `comment_text`.
- **Ein neuer Meldungstyp — mit einer dritten Begründung.** Zweimal abgelehnt („nicht eilig",
  Abschnitte 18 und 24), einmal angenommen („Halbwertszeit von Sekunden", Abschnitt 51). Hier gilt:
  **Der Zweck ist, jemanden zurückzuholen, der die App verlassen hat.** Eine Zeile im
  Aktivitäts-Reiter erreicht nur den, der ohnehin da ist — das wäre kein halber Nutzen, sondern
  gar keiner.
- **Kein UPDATE in der RLS.** Eine Suche ändert man nicht, man legt eine neue an. Damit kann auch
  niemand `last_notified_at` vom Client aus zurücksetzen und die Drossel umgehen.
- **Nur AFTER INSERT**, nicht AFTER UPDATE. Ein Angebot, dessen Titel später geändert wird, meldet
  sich nicht nachträglich — sonst löste ein Verkäufer, der dreimal nachbessert, drei Meldungen aus.
  Der verpasste Treffer bei einer Titeländerung ist der billigere Fehler.

### Geprüft und ungeprüft

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Dollar-Quoting paarig, genau zwei
`CREATE FUNCTION`.

⚠️ **Die Migration ist NICHT eingespielt** und die Edge Function **nicht ausgerollt.** Beides
gehört zusammen und in einem Schritt gemacht:

```bash
supabase db push
supabase functions deploy send-push-notification
```

Die sechs Gegenproben stehen am Ende der Migration. Zwei davon brauchen mehr als einen Blick:

- **Die Drossel** — zweimal passend einstellen, es darf **eine** Meldung geben.
- **Frauen-Only** — braucht ein geprüftes Frauenkonto und ein WOZ-Regalangebot. Steht in der
  Prüfliste (Abschnitt 56, Gruppe E), und es gibt bis heute **null** WOZ-Daten in der Datenbank.

---

## 58. Wer bürgt, steht jetzt im Live-Kopf (21.08.2026)

Die einzige Design-Änderung aus der achten und neunten Analyse, die etwas an der **Positionierung**
ändert statt an der Optik — und sie war reine Platzierung, kein Neubau.

### Was falsch stand

Unter dem Verkäufernamen im Live-Raum stand ausschließlich:

```
  berkattest
  📦 5 Zuschläge
```

Eine Transaktionszahl. **Die hat Whatnot auch.** Whatnot setzt an genau diese Stelle dauerhaft
„★ 5.0" — in jedem der neun geprüften Länder, ohne Antippen.

Berkats Antwort darauf lag derweil **einen Tipp tief**: `vouchSummary(vouches)` wurde in Zeile 1051
berechnet und nur ans `SellerSheet` gereicht. Wer den Kopf nie antippt — also fast jeder — sah nie,
dass jemand für diesen Verkäufer bürgt.

Das ist genau verkehrt herum. Die Ausgangsanalyse, § B5:

> „Vertrauen ist personal, nicht institutionell. Ein 5-Sterne-Durchschnitt bedeutet weniger als
> ‚mein Cousin kennt ihn' … etwas, das Whatnot strukturell nicht bauen kann."

Ein Fremder, der in einen Stream stolpert, entscheidet in drei Sekunden. In diesen drei Sekunden
stand der Teil, den jede Plattform hat — und nicht der, den keine andere hat.

### Was jetzt dasteht

```
  berkattest
  🛡 amir32 bürgt · +1        ← hellgrün
```

Ohne Bürgen fällt es auf die Zuschläge zurück: Wer noch keine hat, zeigt, was er sonst vorzuweisen
hat. **Beides zugleich wäre eine Zeile zu viel** für diesen Kopf.

### Zwei Entscheidungen

- **⚠️ Eine eigene Kurzfassung, nicht `vouchSummary()`.** Die lange wird bis zu „amir32 und zaur
  bürgen — beiden folgst du · +3" (rund 45 Zeichen) und stünde im Kopf als „amir32 und zaur bürg…"
  da. Dieselbe Falle wie bei der Live-Vorschau auf der Startseite (Abschnitt 8): „Warten auf
  nächsten Artikel" wurde dort zu „Warten auf nächst…". `vouchSummaryShort()` bleibt zwischen 12
  und 17 Zeichen — an fünf Fällen durchgerechnet, inklusive „kein Benutzername".
- **Wer folgt, gewinnt** — wie in der langen Fassung. Der Sinn ist nicht „drei Leute bürgen",
  sondern **„jemand, den DU kennst, bürgt"**. Bei vier Bürgen steht der vorne, dem der Betrachter
  folgt.
- **Hellgrün, nicht gold** (Abschnitt 15): Gold ist auf der Bühne der Kauf, eine Bürgschaft ist kein
  Kaufknopf.

### Was NICHT übernommen wurde — und warum

Aus derselben Analyse standen zwei weitere UI-Funde zur Wahl:

- **Chat ohne Kasten.** Whatnots Kommentare liegen nackt auf dem Video, Berkats in einer Box
  (`rgba(0,0,0,0.3)`). Whatnots wirkt luftiger — **und würde Berkats eigene Regel brechen**
  (Abschnitt 8: „lesbar auf dem einen Bild, unsichtbar auf dem nächsten"). Ein Verkäufer, der eine
  weiße Abaya vor eine weiße Wand hält, macht den Chat unlesbar, und das Video kontrolliert
  niemand. Der Mittelweg wäre ein Textschatten statt einer Box — nicht gebaut, aber notiert.
- **„Verkauft" in Rot**, wie bei Whatnot. Würde Berkats Farbgesetz verwässern: Rot ist die laufende
  Uhr. Bewusst nicht übernommen.

### Geprüft und ungeprüft

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Keine Migration, kein Build, keine neue
Abfrage — `useVouches` lief in diesem Bildschirm ohnehin schon.

⚠️ **Am Gerät ungeprüft.** Die Zeile erscheint nur, wenn jemand für den Gastgeber gebürgt hat. Im
Datenstand gibt es genau eine Bürgschaft (`amir32` für `berkattest`, 15.08.) — die Probe ist also
möglich, aber sie braucht den Live-Raum dieses Verkäufers. Gehört in Gruppe C der Prüfliste.

---

## 59. Konto löschen — und ein Fehler, der schon draußen war (21.08.2026)

Punkt 2 der Liste: Apple 5.1.1(v) verlangt, dass ein Konto, das in der App entstehen kann, dort
auch löschbar ist. Berkat hatte im Konto-Reiter nur „Abmelden".

**Beim Nachsehen kam etwas anderes heraus, das schwerer wiegt.**

### ⚠️ Der Fund: `delete_own_account()` vernichtet fremde Belege

Es gab die Funktion längst — sie war genau eine Zeile:

```sql
DELETE FROM auth.users WHERE id = auth.uid();
```

Aufgerufen wird sie von `apps/web/app/actions/gdpr.ts:221`, also aus **Serlos ausgelieferter
Web-App**. Der Kommentar dort beschreibt das Verhalten als Feature: *„Cascade via FKs purged alle
User-Daten."*

Die Kette purged aber mehr. Am Schema-Abzug nachgeschlagen: `profiles.id` hängt mit
**ON DELETE CASCADE** an `auth.users`, und an `profiles` hängen mit demselben Verhalten:

```
product_orders.buyer_id · product_orders.seller_id · berkat_tips.sender_id
berkat_tips.recipient_id · coin_purchases.user_id · live_auctions.seller_id
live_bids.bidder_id · auction_carts.buyer_id / seller_id
```

Daraus folgen zwei Dinge, und beide sind schwerwiegend:

**1. Es trifft Dritte.** Löscht ein **Käufer** sein Konto, verschwindet seine
`product_orders`-Zeile — und damit der **Verkaufsbeleg des Verkäufers**. Der hat die Ware
verschickt und findet den Vorgang nicht mehr. Umgekehrt genauso: Löscht ein Verkäufer, verschwinden
die Auktionen, an denen andere geboten und gewonnen haben.

**2. Es ist aufbewahrungspflichtig.** § 147 AO und § 257 HGB verlangen für Rechnungen und
Handelsbriefe sechs bis zehn Jahre. Eine über Stripe abgewickelte Zahlung zu löschen, weil der
Zahlende sein Konto schließt, ist kein Datenschutz, sondern ein Verstoß dagegen.

**Und das Entscheidende: Die DSGVO verlangt das gar nicht.** Art. 17 Abs. 3 lit. b nimmt die
Löschpflicht ausdrücklich zurück, soweit die Verarbeitung zur Erfüllung einer rechtlichen
Verpflichtung erforderlich ist.

⚠️ **Heute folgenlos, aber live.** Serlo hat keine echten Nutzer (Abschnitt 45), Berkat einen. Der
Weg ist trotzdem deployt und für `anon`, `authenticated` und `service_role` freigegeben.

### Was jetzt passiert: anonymisieren statt vernichten

`20260821140000_account_deletion_anonymises.sql` ersetzt die Funktion — **gleicher Name, gleiche
Signatur**, damit `gdpr.ts` unverändert weiterläuft. Ein Rename bräche die ausgelieferte Web-App,
ein defaultierter Parameter erzeugte eine Überladung und damit HTTP 300 (Abschnitt 13).

| | |
|---|---|
| **Gelöscht** | gespeicherte Suchen, Merkliste, Vormerkungen, ausgesprochene Bürgschaften, Follows in beide Richtungen, Push-Tokens, eigene Meldungen, offene Max-Gebote |
| **Anonymisiert** | `username` → `geloescht-<8 hex>`, Anzeigename, Bio, Avatar, Kopfbild, Ort, Sprachprobe → NULL; Impressumsangaben eines gewerblichen Verkäufers → NULL |
| **Bleibt** | Bestellungen, Zahlungen, Zuschläge, Gebote, Trinkgeld — jetzt an einem namenlosen Profil |
| **Zurückgezogen** | laufende Regal-Angebote (ein Regal ohne Verkäufer ist eine Falle für Käufer) |
| **Halb** | `order_reviews`: der **Text** geht, die **Sternzahl** bleibt — sie ist eine Aussage über den Verkäufer und fließt in seinen Schnitt |

### Entscheidungen, die nicht offensichtlich sind

- **⚠️ Der Login wird gesperrt, nicht die Zeile gelöscht.** `banned_until = 'infinity'`,
  `encrypted_password = NULL`, E-Mail auf eine Adresse in `.invalid` (RFC 2606), dazu
  `auth.sessions` und `auth.refresh_tokens` geleert. Ohne das Leeren bliebe das Gerät bis zum
  Ablauf des Tokens angemeldet.
- **Zwei Blocker, beide vorübergehend.** Ein offener Sammelkorb (`open`/`checkout_pending`) und
  bezahlte, aber unversendete Bestellungen als Verkäufer. Beide lösen sich von selbst — der Korb
  läuft in 24 Stunden ab, die Bestellung ist nach dem Versand erledigt. **Apple 5.1.1(v) erlaubt
  das:** Unzulässig wäre eine Löschung, die gar nicht geht oder nur per E-Mail an den Support.
- **`profiles.deleted_at` mit eigenem `GRANT SELECT`.** `profiles` trägt seit `20260814240000` die
  eingefrorene Spaltenliste — ohne das Grant wäre die Spalte für alle Clients unsichtbar und ein
  Filter darauf ein `42501`. Regel 11, am 16.08. schon einmal bei `banner_url` zugeschlagen.
- **Der Aufruf ist idempotent.** Ein zweiter Ruf auf ein bereits gelöschtes Konto tut nichts,
  statt zu werfen — Doppeltipp und Netz-Wiederholung sind der Normalfall, nicht die Ausnahme.
- **`anon` verliert das Ausführungsrecht.** Die alte Fassung war an `anon` freigegeben; der Aufruf
  lief zwar in `not_authenticated`, aber das Recht gehört trotzdem weg (die `credit_coins`-Falle,
  Abschnitt 7).

### Der Bildschirm

`app/delete-account.tsx`, erreichbar über eine schlichte Textzeile unter „Abmelden".

**Ein eigener Bildschirm statt eines Dialogs**, weil hier etwas zu erklären ist, das in zwei Zeilen
nicht hineinpasst: was weggeht, was bleibt — und **warum** das Bleibende bleiben muss. Ein „Wirklich
löschen?" ließe genau die Frage offen, die jeder hat: *„Ist mein Kauf dann weg?"*

Der Satz, der den Bildschirm trägt, steht als Zusage in `lib/useDeleteAccount.ts` und nicht im JSX:

> „Ein Kauf ist ein Beleg für zwei Menschen. Würden wir ihn löschen, verlöre auch dein Gegenüber
> seinen Nachweis — und das Gesetz verlangt, dass Rechnungen aufbewahrt werden."

Bestätigungswort tippen, dann der Knopf. Nicht als Hürde — **Apple verlangt, dass der Weg
erreichbar ist, nicht dass er leicht ist.** Am Ende steht der Hinweis, dass Abmelden auch reicht.

⚠️ **Der Knopf ist die einzige rote FLÄCHE in Berkat.** Sonst gilt „Rot ist die laufende Uhr, nie
Fläche" (`theme/tokens.ts`). Hier ist es die Ausnahme, weil er genau einmal gedrückt wird. Die
Textzeile im Konto-Reiter bleibt dagegen gedämpft: Ein Dauer-Alarmzeichen dort wäre eine Drohung.

### Geprüft und ungeprüft

`tsc --noEmit` und `expo export --platform ios` fehlerfrei. Dollar-Quoting paarig, kein
`DELETE FROM auth.users` mehr im Code (nur noch im erklärenden Kommentar).

✅ **Eingespielt am 21.08.2026 nach ausdrücklicher Freigabe.** `migration list` zeigt
`20260821140000` in beiden Spalten. Am frischen Abzug gegengeprüft:

| | |
|---|---|
| `DELETE FROM auth.users` im Code | ✅ weg (nur noch in einem Warnkommentar) |
| `banned_until`, geleerte Sitzungen | ✅ im Live-Code |
| beide Blocker | ✅ im Live-Code |
| `anon`-Ausführungsrecht | ✅ entzogen (`authenticated` und `service_role` behalten es) |
| `profiles.deleted_at` samt `GRANT SELECT` | ✅ da |

**Serlos Web ist mitkorrigiert.** `gdpr.ts` beschrieb das Cascade-Verhalten als Feature — der
Kommentar ist ersetzt, die zwei Blocker werden in Sätze übersetzt statt als `account_delete_*`
durchgereicht, und `delete-account-card.tsx` sagt dem Nutzer jetzt, **was bleibt und warum**. Ohne
das wäre das Schweigen die neue Unwahrheit gewesen: Wer „Konto löschen" liest und seine Bestellung
später beim Verkäufer wiederfindet, hält uns für unehrlich. `tsc` in `apps/web` fehlerfrei.

⚠️ **Der Durchlauf steht noch aus — und ich kann ihn nicht selbst machen.**
`delete_own_account()` läuft auf `auth.uid()`. Aus dem SQL-Editor und mit dem
service_role-Schlüssel ist das NULL, die Funktion antwortet dann mit `not_authenticated`. Auslösen
lässt sie sich nur aus einer angemeldeten Sitzung — und sich für einen Menschen anzumelden ist
nichts, was ein Assistent tut.

Das ist kein Verlust: **Der Weg über die App ist ohnehin der bessere Test**, weil er den Bildschirm,
die RPC und das Abmelden zusammen prüft.

Alles Drumherum liegt fertig in `supabase/_ops/loeschung-pruefen.sql` — Konto auswählen, vorher
messen, in der App löschen, nachher messen. **Der Kern der Probe ist die letzte Abfrage:** Sie holt
zu jeder Bestellung des gelöschten Kontos die Gegenseite. Steht dort weiterhin ein Name und ein
Beleg, während die eine Seite `geloescht-xxxxxxxx` heißt, ist genau der Fehler behoben, um den es
ging.

⚠️ **Ein Konto mit Bestellungen oder Zuschlägen nehmen.** Bei einem leeren misst die Probe nur, ob
null Zeilen null Zeilen bleiben. Die Auswahl-Abfrage in Schritt 1 sortiert danach — und zeigt in
denselben Zeilen, ob ein Blocker greifen würde. Gehört in Gruppe B der Prüfliste (Abschnitt 56).

⚠️ **Serlos Web-Oberfläche ist nicht angefasst.** `gdpr.ts` ruft dieselbe RPC und funktioniert
weiter, aber sein Text („Cascade via FKs purged alle User-Daten") beschreibt jetzt das Falsche und
verspricht dem Nutzer mehr Löschung, als geschieht. **Das gehört korrigiert, bevor Serlo echte
Nutzer bekommt** — sonst steht dort eine unzutreffende Datenschutz-Auskunft.
