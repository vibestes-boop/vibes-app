# Berkat — Übergabe

**Stand: 15.08.2026** · Eigenständige Live-Auktions-App im Repo `vibes-app`, teilt sich das
Supabase-Backend mit Serlo.

Die Grundlage ist [`WHATNOT-ANALYSE.md`](WHATNOT-ANALYSE.md) — Strategie, Psychologie, Technik und
ein Phasenplan mit Abbruchkriterien. **Phase 1 ist bis auf einen Punkt gebaut** (Abschnitt 8).

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

Betroffen sind zwei Tabellen: `live_sessions` und `user_whip_ingresses` (`stream_key`,
`20260426000000`). Wer einer davon eine Spalte hinzufügt, hängt an dieselbe Migration:

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

Dreizehn Migrationen, **alle eingespielt und verzeichnet** (Stand 15.08.2026). Der Weg bleibt: SQL
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
| Bezahlen | Sammelkorb → eine Bestellung → Stripe → Adresse → `paid` → eigene Erfolgsseite |
| Versand (Verkäufer) | Bestellliste mit Adresse, Sendungsnummer, Verfolgungs-Link |
| Kauf-Übersicht (Käufer) | „Gekauft" im Konto: Zustand, Artikel, Sendungsnummer |
| Zuschauerzahl, Folgen, Teilen | fertig |

**Die gesamte Kette ist am 14.08.2026 einmal komplett durchlaufen** — Show starten, live gehen,
Artikel auflegen, von einem zweiten Konto bieten, Zuschlag, Sammelkorb, Stripe-Zahlung (Testkarte),
eigene Erfolgsseite, Benachrichtigung an den Verkäufer, als versendet markieren, und die Sendung
beim Käufer sichtbar.

### Was fehlt

Kurz, und nichts davon blockiert den nächsten Schritt.

1. **1-Tap-Kauf im Stream** — der letzte offene Punkt aus Phase 1. Heute: Sammelkorb → Konto →
   Browser → Stripe. Whatnot: ein Tippen, ohne den Stream zu verlassen. Siehe Abschnitt 8.
2. **Kategorien- und Aktivitäts-Reiter** — zwei von Whatnots fünf; bewusst weggelassen, solange
   sie keinen Inhalt hätten
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
| **0 — Sendeplan** | 5 Verkäufer, feste Termine, 4–8 Wochen, **kein Code** | ⏳ nie gemacht |
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

**1. 1-Tap-Kauf im Stream.** Der letzte offene Punkt aus Phase 1, laut Analyse „klein". Macht aus
dem Kauf einen Reflex statt eines Ausflugs in den Browser — und schließt Phase 1 sauber ab.

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

1. **Eigene Benachrichtigungsliste in Berkat** — es gibt keine. Der Konto-Tab zeigt Körbe samt Frist,
   und der Gewinner sieht im Raum einen `won`-Zustand mit Erfolgs-Haptik, aber keine Historie. Wer
   einen Push wegwischt, findet ihn nirgends wieder.
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
