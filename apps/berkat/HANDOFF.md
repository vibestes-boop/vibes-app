# Berkat — Übergabe

**Stand: 14.08.2026** · Eigenständige Live-Auktions-App im Repo `vibes-app`, teilt sich das
Supabase-Backend mit Serlo.

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
| Website | `apps/berkat-web/` — vier statische Seiten, **noch nicht veröffentlicht** (siehe dortige README) |
| Bundle-IDs | iOS `com.berkat.app` · Android `app.berkat.market` |
| EAS-Projekt | `@zaurhat/berkat` (`fb4e0381-264d-4cfd-8c3c-691987346915`) |
| Backend | dieselbe Supabase-Instanz wie Serlo (`llymwqfgujwkoxzqxrlm`) |
| Migrationen | 7 Stück — **zwei davon noch nicht eingespielt**, siehe Abschnitt 5 |
| Git | Branch `berkat`, drei Commits, **nicht gepusht** |

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
`tsc` nicht sieht. Aktueller Stand: **3170 Module, fehlerfrei**.

---

## 3. Fallen, die schon zugeschlagen haben

Diese Liste ist der wertvollste Teil des Dokuments.

### `supabase db push` ist verboten

`supabase migration list` meldet **61 Migrationen als nicht eingespielt**, beginnend bei
`20260614190000`. Das ist eine **Tracking-Lücke, kein fehlendes Schema** — die Tabellen existieren
nachweislich in der Live-DB (gegen die REST-API geprüft). Das Tracking blieb bei
`buy_product_wallet_lock` (`20260613120000`) stehen; alles danach wurde per SQL-Editor eingespielt.

**Ein `db push` würde alle 62 erneut fahren** und bei der ersten nicht-idempotenten Anweisung
mittendrin abbrechen.

Richtiger Weg für neue Migrationen:

1. SQL im Supabase-SQL-Editor ausführen
2. `supabase migration repair --status applied <version>`

Für die Drift selbst liegt eine eigene Aufgabe bereit (siehe Abschnitt 7).

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

Sieben Migrationen, **alle eingespielt und im Tracking vermerkt**:

| Datei | Inhalt |
|---|---|
| `20260813150000_berkat_live_auctions.sql` | `live_auctions`, `live_bids`, `auction_carts`, Gebots-/Zuschlag-RPCs, `berkat_server_time()` |
| `20260813220000_berkat_max_bids.sql` | `live_auto_bids`, `set_max_bid`, `resolve_auto_bids`, `place_live_bid` neu |
| `20260813233000_berkat_giveaways.sql` | `live_giveaways`, `live_giveaway_entries`, drei RPCs |
| `20260814000000_berkat_cart_checkout.sql` | `product_orders.cart_id` + `.title`, Trigger „bezahlt → Korb zu", `checkout_auction_cart` |
| `20260814010000_berkat_mark_shipped.sql` | `mark_order_shipped` |
| `20260814120000_live_reactions_rls.sql` | `live_reactions_select` von `USING(true)` auf Session-Vererbung |
| `20260814130000_berkat_edit_auction.sql` | `update_live_auction` |

Die letzten beiden kamen am 14.08. dazu. Die Reaktions-Migration schloss ein Leck: Die Lese-Policy
stand auf `USING(true)`, und weil jede Zeile `session_id` und `user_id` trägt, konnte jedes Konto
die Teilnehmerliste jedes Frauen-Only-Raums auslesen. Folgenlos umzustellen, weil **niemand die
Tabelle liest** — App und Web schreiben nur hinein, gezeigt werden Reaktionen über den
Broadcast-Kanal.

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
| Anmeldung | E-Mail/Passwort gegen dieselbe Supabase-Instanz. Google/Apple fehlen |
| Startseite | Suche, Kategorie-Leiste mit zwei Größen (schrumpft beim Scrollen), Show-Karten |
| Live-Raum | Video, Kamera-Vorschau vor dem Senden, Kamera-Steuerung, Chat mit Eingabe, wegwischbare Kommentare, Sammelkorb-Leiste, „Als Nächstes", Shop-Zettel |
| Auktion | Gebot, Anti-Snipe (+10 s), Sofortkauf, Max-Gebot, Zuschlag, „Du führst" |
| Verkäufer-Regie | Show starten/beenden, Artikel auflegen mit Bild, **nachträglich ändern**, **Starten aus dem Raum heraus**, Dauer 20/30/60 s |
| Reaktionen | Herz-Knopf **und Tippen aufs Bild**, fliegende Herzen, Zähler — auf Serlos Broadcast-Vertrag, also plattformübergreifend |
| Gewinnspiel | anlegen, mitmachen, ziehen — Teilnahme immer kostenlos |
| Kleines Fenster | echtes Video, läuft über alle Reiter weiter |
| Bezahlen | Sammelkorb → eine Bestellung → Stripe → Adresse → `paid` |
| Versand | Bestellliste mit Adresse, Sendungsnummer, Verfolgungs-Link |
| Zuschauerzahl, Folgen, Teilen | fertig |

### Was fehlt

1. **Kategorien- und Aktivitäts-Reiter** — zwei von Whatnots fünf; bewusst weggelassen, solange
   sie keinen Inhalt hätten
2. **Google-/Apple-Anmeldung**
3. **Eigene Erfolgsseite: gebaut, aber nicht veröffentlicht.** Die Seiten liegen in
   `apps/berkat-web/`, die Weiche in `create-checkout-session` steht. Beides greift erst nach
   den drei Schritten in Abschnitt 8. Bis dahin landet der Käufer weiter auf
   `serlo.ch/shop/success` — das ist Absicht und kein Versehen, siehe dort. am Vorschaubild

---

## 7. Offene Punkte außerhalb des Codes

### Migrations-Tracking begradigen — vorbereitet, wartet auf einen Klick

Es sind **61** (nicht 62), von `20260614190000` bis `20260716130000`. Zu jeder gibt es eine Datei.

Vorbereitet liegt alles unter `supabase/_ops/`: eine **Nur-Lese-Abfrage** für den SQL-Editor, die
75 Funktionen, 24 Policies, 21 Indizes, 2 Speicher-Eimer, 6 gelöschte Indizes, 3 gelöschte
Funktionen und eine Spalten-Nullbarkeit in den Systemtabellen nachschlägt — plus die Anleitung.
Leeres Ergebnis heißt: gefahrlos markieren. Zeilen heißen: genau die fehlen.

**Warum nicht einfach markieren:** Eine Migration als eingespielt zu markieren, die es nicht ist,
macht die Lücke für immer unsichtbar. Bei `drop_debug_coin_backdoors` hieße das, die Hintertüren
lägen weiter in der Produktivdatenbank.

19 der 61 sind bereits belegt: Ihre Tabellen und Spalten wurden am 14.08. über die REST-Schnittstelle
geprüft, alle vorhanden. Die Abfrage deckt weitere 38 ab. Vier lassen sich prinzipiell nicht über
die bloße Existenz eines Objekts prüfen — sie sind in der README benannt.

### Der Schema-Abzug ist zwei Monate alt

`supabase/schema_live.sql` stammt vom **14.06.2026** und ist damit älter als fast alle 61
Migrationen — obwohl CLAUDE.md ihn als Quelle der Wahrheit führt. Wer dort eine Spalte nachschlägt,
prüft gegen einen veralteten Stand. Erneuern geht mit `supabase db dump`, das braucht aber Docker
Desktop (auf diesem Rechner nicht installiert).

### Berkat pushen

Eingecheckt ist alles: Branch `berkat`, drei Commits. **Gepusht ist nichts** — das braucht eine
ausdrückliche Freigabe. `.env` ist über `apps/berkat/.gitignore` ausgeschlossen und liegt nicht im
Commit; `node_modules`, `ios/` und `android/` ebenso wenig.

### Stripe-Modus prüfen

Unklar, ob Test- oder Live-Schlüssel gesetzt sind (Secret, nicht auslesbar). Im Live-Modus ist
jeder Testkauf echtes Geld. Zu sehen im Stripe-Dashboard oben rechts.

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

### Website veröffentlichen — drei Schritte, in dieser Reihenfolge

Die Reihenfolge ist keine Empfehlung, sondern Bedingung: Wer Schritt 3 vor Schritt 1 macht,
schickt Käufer direkt nach dem Bezahlen auf eine tote Seite. Deshalb ist die Weiche in der
Function auch ausdrücklich einzuschalten und nicht Standard.

1. `npx wrangler pages deploy apps/berkat-web --project-name berkat-live`
2. `supabase secrets set BERKAT_SUCCESS_URL=https://berkat-live.pages.dev/bezahlt
   BERKAT_CANCEL_URL=https://berkat-live.pages.dev/abgebrochen`
3. `supabase functions deploy create-checkout-session`

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

### Dann: eine echte Show mit zwei Geräten

Alles Übrige aus dem Code ist beisammen. Was jetzt zählt, ist der Durchlauf:

1. Gerät A: Show starten → live gehen → Artikel auflegen → starten
2. Gerät B (anderes Konto): bieten, kontern, Max-Gebot setzen
3. Zuschlag abwarten → Gerät B: Konto → Deine Pakete → bezahlen
4. Gerät A: Verkaufen → Bestellungen → Adresse prüfen → als versendet markieren

Damit ist die gesamte Kette einmal durchlaufen. Was dabei hakt, ist wichtiger als jedes weitere
Feature.

Zwei Dinge lassen sich dabei gleich mitprüfen, weil sie sich ohne zweites Gerät nicht beurteilen
lassen: ob die Herzen an der richtigen Stelle losfliegen (der Abstand in `FloatingHearts` ist an
den Aufbau der rechten Leiste gebunden, nicht gemessen), und ob ein Herz aus der Serlo-App
tatsächlich in Berkat ankommt.
