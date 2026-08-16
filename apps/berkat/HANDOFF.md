# Berkat — Übergabe

**Stand: 16.08.2026** · Eigenständige Live-Auktions-App im Repo `vibes-app`, teilt sich das
Supabase-Backend mit Serlo.

Die Grundlage ist [`WHATNOT-ANALYSE.md`](WHATNOT-ANALYSE.md) — Strategie, Psychologie, Technik und
ein Phasenplan mit Abbruchkriterien. **Phase 1 ist gebaut, Phase 0 nie begonnen** — siehe unten.

> **Wer nicht lesen, sondern arbeiten will:** [`LEITFADEN.md`](LEITFADEN.md) — was nach einer
> Änderung zu tun ist, welche Befehle, welche Verdächtigen bei welchem Fehler, und was man nie tut.
> Dieses Dokument hier ist der Zustandsbericht; der Leitfaden ist die Bedienungsanleitung.

---

## 0. Wo du gerade stehst — 16.08.2026

Der Einstieg für einen frischen Chat. Die Abschnitte 1–17 sind die Begründungen; hier steht nur,
was gilt.

### Gebaut und am echten Datenstand geprüft

| Bereich | Stand |
|---|---|
| Auktion, Gebote, Anti-Snipe, Zuschlag, Sammelkorb | ✅ |
| Kasse — öffnet **in der App**, bezahlen am Show-Ende | ✅ (Abschnitt 11) |
| Versand — Zonen-Pauschale pro Paket, bis in die Datenbank | ✅ `shipping_cents 490` belegt (14) |
| Sendeplan — Termine, wöchentliche Reihen, Erinnerungs-Push | ✅ bis auf den Sperrbildschirm (13) |
| Bürgen — Vertrauen mit Namen statt Sterne | ✅ (15) |
| **Dauerangebote** — kaufbar ohne laufende Show | ✅ Kauf gelaufen (17) |
| **Verkäufer-Suche** — findet auch, wer nicht sendet | ✅ (17, Nachtrag) |
| Fehlerüberwachung (Sentry) | ✅ eingebaut, **scharf erst ab dem nächsten Build** (16) |
| Meldungen — Glocke, Ziel je Typ | ✅ (17, Nachtrag) |
| **Fünf Reiter** — Kategorien und Aktivität dazu | ✅ (18) |
| **Kategorien** — 12 Ober-, 61 Unterkategorien, Aufklappen | ✅ am Datenstand geprüft (18) |
| **Einladungen** — Verkäufer-Bonus scharf, Käufer-Bonus **aus** | ✅ (18) |
| **Profil** — Reiter, Bewertungstexte, Banner, Teilen, Sperren | ✅ (18) |

### Was ausdrücklich NICHT geprüft ist

- Der **Unterdeckungs-Hinweis** beim Versand (feuert nur, wenn jemand DE zahlt und in die CH liefert)
- **Push auf Android** — nie auf einem echten Gerät gesehen
- **Web-Push** — `web_push_subscriptions` ist leer, es hat nie jemand zugestimmt
- **Echtes Video** — der Simulator hat keine Kamera
- Die **gesenkte Bitrate** (540p) im echten Stream

### Drei Blocker — keiner davon ist Code

1. **Kein Store-Eintrag.** Berkat ist in keinem Store. Verkäufer und Publikum **können die App nicht
   installieren**; alles Gebaute ist für genau eine Person erreichbar. TestFlight braucht Apples
   Anmeldung mit Zwei-Faktor — das kann nur Zaur.
2. **Stripe-Zugang.** Konto ist `acct_1Tk85WDimgI7k5Md` („brandwerkx"), die Wiederherstellung läuft
   per Ausweis. Alles ist **Testbetrieb** (`cs_test_`, nie echtes Geld). Danach zuerst: Klarna,
   Billie und Scalapay abschalten — **in Test- UND Live-Modus getrennt** (Riba, Analyse § B3).
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
| `HANDOFF.md` (hier) | Zustand, Entscheidungen, Fallen — Abschnitte 1–17 |
| [`LEITFADEN.md`](LEITFADEN.md) | Befehle, „muss ich bauen?", Fehlersuche nach Symptom |
| [`WHATNOT-ANALYSE.md`](WHATNOT-ANALYSE.md) | Strategie, Psychologie, Phasenplan |
| [`STRATEGIE-VERKAEUFER-UND-GELD.md`](STRATEGIE-VERKAEUFER-UND-GELD.md) | Verkäufer gewinnen, Erlösquellen, Kostenrechnung mit geprüften Tarifen |

⚠️ **Nicht committet ist nur `deno.lock`** — die Datei war schon vor dem 15.08. geändert und gehört
nicht zu dieser Arbeit.

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
| Migrationen | 13 Stück, alle eingespielt — Abschnitt 5 |
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
`tsc` nicht sieht. Aktueller Stand: **3173 Module, fehlerfrei**.

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

### `refreshing={isRefetching}` lässt Listen hängen aussehen

Der Aktualisierungs-Kreisel springt sonst bei jedem Hintergrund-Abruf an. Für Ziehen-zum-Aktualisieren
immer einen eigenen `pulling`-Zustand nehmen.

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

Vierzehn Migrationen, **alle eingespielt und verzeichnet** (Stand 15.08.2026). Der Weg bleibt: SQL
im Editor ausführen, danach `supabase migration repair --status applied <version>`.

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
| `20260816120000_berkat_categories.sql` | `berkat_categories`, `live_auctions.category`, `get_berkat_category_counts`, `create_standing_listing` mit Kategorie (DROP+CREATE) — Abschnitt 18 |
| `20260816130000_berkat_rewards.sql` | Einladungen, Versand-Gutschriften, Verkäufer-Vergünstigungen, `berkat_reward_policy` (Käufer-Bonus ab Werk **aus**) — Abschnitt 18 |
| `20260816150000_berkat_category_tree.sql` | `parent_slug` + Wächter gegen die dritte Ebene, 12 Eltern / 61 Kinder, Zähler mit Aufrollen — Abschnitt 18 |
| `20260816160000_berkat_seller_reviews_public.sql` | `get_seller_reviews` — Bewertungstexte öffentlich, nur Berkat-Bestellungen, Frauen-Only geschützt — Abschnitt 18 |
| `20260816170000_profiles_banner.sql` | **Serlo-weit:** `profiles.banner_url` + **`GRANT SELECT`** — ohne das wäre die Spalte für alle Clients unsichtbar, siehe unten |

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

- **Echtes Video** — der Simulator hat keine Kamera, das Bild blieb schwarz
- **Ob ein Herz aus der Serlo-App in Berkat ankommt** — der Broadcast-Vertrag ist gebaut, aber nie
  über beide Apps gemessen
- **Max-Gebot und Anti-Snipe** unter echtem Gegendruck (zwei Menschen, die gleichzeitig bieten)
- **Der Vorschau-Zustand „gerade zugeschlagen"** — braucht ein Gebot vom zweiten Konto. Der
  Kontrast über echtem Foto ist am 15.08. gemessen und behoben (Abschnitt 8).

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
- **Web-Push ist für alle Nicht-DM-Typen tot** — der Fan-out lebte in eben dieser Edge Function.
  Betrifft Serlo genauso wie Berkat, eigener Schritt.
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

### Was ungeprüft ist

- **Alles Sichtbare.** Aufklappen der Kategorien, die neuen Profil-Reiter, das Bearbeiten-Blatt,
  der Banner-Upload, die zwei neuen Verkäufer-Bildschirme und das Reiter-Abzeichen — nichts
  davon lief auf einem Gerät.
- **Der Bewertungen-Reiter ist zwangsläufig leer**, es gibt noch keinen einzigen Text.
- **Die Frauen-Only-Schranke bei den Bewertungen** — die Gegenprobe steht am Ende von
  `20260816160000`.
- **Der Käufer-Bonus** wurde nie scharf geschaltet, also nie durchlaufen.

### Ein Ärgernis fürs Protokoll

`npx expo export` wählt den Einstiegspunkt **nicht deterministisch**: mal `index.ts`
(3938 Module), mal `expo-router/entry.js` (3671). Der Unterschied sind die ~270 Module des
LiveKit-`registerGlobals`-Blocks, den nur `index.ts` lädt — und `index.ts` ist laut
`package.json` der richtige Einstieg. Beide Läufe sind fehlerfrei, die Ursache ist ungeklärt.
Ob `eas update` davon betroffen ist, wurde **nicht** geprüft.
