<!--
  Herkunft: Chat-Sitzung „Whatnot-Analyse: Strategie, Psychologie, Struktur",
  13.08.2026, auf die Frage „Analysiere es bis auf Grundstrategie. Psychologie.
  Struktur, Technik, Alles." — https://www.whatnot.com/

  Am 15.08.2026 aus dem Sitzungsverlauf gerettet und hier abgelegt. Vorher
  existierte sie NUR in diesem Chat; die Übergabe verwies an drei Stellen auf
  „die Ausgangsanalyse", die im Repo nirgends lag. Wer sie sucht, sucht ab jetzt
  hier.

  Wortlaut unverändert. Sie stammt aus der Zeit VOR der eigenständigen
  Berkat-App und spricht deshalb teils von Serlo/Vibes.
-->

# Whatnot — Vollanalyse und Machbarkeit für Berkat

> Stand der Analyse: **13.08.2026**. Was seither gebaut wurde, steht in
> [HANDOFF.md](HANDOFF.md). Die Zahlen und Beobachtungen hier sind eine
> Momentaufnahme und altern.

Ich habe die Seite live seziert (Netzwerk-Layer, GraphQL-Antworten, Live-Room-UI) und parallel Geschäftszahlen, Engineering-Blog und Rechtslage recherchiert. Hier die vollständige Analyse.

---

# Whatnot — Vollanalyse

## 0. Der Kern in einem Satz

Whatnot ist **kein Shop mit Video**, sondern **Twitch, bei dem der Checkout im Chat liegt**. Der strategische Trick: Sie haben nicht den E-Commerce um Live erweitert, sondern das *Unterhaltungsformat* zur Primärware gemacht und den Verkauf als Nebenprodukt der Sendezeit eingesammelt. Deshalb messen sie sich an Minuten (95 min/Tag pro User), nicht an Sessions.

---

## 1. Grundstrategie

### 1.1 Die fünf Entscheidungen, die alles tragen

| # | Entscheidung | Warum sie funktioniert |
|---|---|---|
| 1 | **Start in einer besessenen Mikro-Nische** (Pokémon, Funko, Sportkarten) | Sammler haben (a) hohe Kauffrequenz, (b) hohe emotionale Beteiligung, (c) bestehende Community-Rituale ("Breaks"). Erster Stream: 5.000 $ Funko Pops in wenigen Stunden. |
| 2 | **Angebot kuratieren statt maximieren** | Verkäufer müssen sich *bewerben*; historisch <50 % Annahme. Kein "jeder kann posten"-Marktplatz. Qualität der Sendung = Qualität des Produkts. |
| 3 | **Format vor Katalog** | eBay hat den besseren Katalog. Whatnot hat den besseren Abend. Ein Katalog ist kopierbar, ein Kreis von 400 Zuschauern, die den Verkäufer beim Vornamen kennen, nicht. |
| 4 | **Kategorien-Sequenzierung entlang der Emotion** | Sammelkarten → Sneaker → Comics → **Mode** → **Beauty** → Elektronik → Schmuck → *Lebensmittel*. Immer entlang „Es gibt eine Community und ein Preis-Ritual", nie entlang „großer TAM". Beauty +791 %, Elektronik +444 %, Frauenmode +223 % (2025). |
| 5 | **Take-Rate zuerst, Werbung später** | 8 % Provision ab Tag 1 = ehrliches Umsatzmodell ohne Anzeigenverkauf. Ads (Boost) kamen erst 2023 obendrauf, als das Inventar (Aufmerksamkeit) schon existierte. |

### 1.2 Das Flywheel (und wo es klemmt)

```
Verkäufer sendet häufiger
        ↓
mehr Live-Stunden im Feed
        ↓
Feed hat mehr zu ranken → bessere Personalisierung
        ↓
Käufer bleibt länger (95 min/Tag)
        ↓
höhere GMV pro Verkäufer (13k $/Monat bei 3-4×/Woche)
        ↓
Verkäufer sendet häufiger  ⟲
```

Der **Engpass ist immer Angebot, nie Nachfrage.** Deshalb bezahlt Whatnot faktisch die Verkäufer-Seite: 0 %-Provisionstage, reduzierte Provision auf Beträge über 1.500 $, 4 % für australische Zeitfenster, kostenlose Versandlabels, Seller Academy, dedizierter Support. Jeder Rabatt ist Angebots-Akquise, kein Preiskampf.

### 1.3 Der Geographie-Trick (habe ich live beobachtet)

Im **deutschen** Feed sind fast alle Shows US-Shows — erkennbar am 🇺🇸-Präfix im Titel, mit live umgerechneten Preisen (`29 $ ≈ 25,14 €`, eigene GraphQL-Operation `LiveGetCurrencyConversionRates`). Whatnot löst das Cold-Start-Problem eines neuen Landes, indem es **bestehendes US-Angebot importiert und mit Flagge kennzeichnet**, statt auf lokale Verkäufer zu warten. Ergebnis: europäische Verkäuferbasis +600 % YoY, Frankreich +888 %.

> Für Serlo direkt übertragbar: Die tschetschenische Diaspora ist über DE/AT/TR/FR/RU verteilt. Länder-Feeds mit Flaggen-Marker + Währungsumrechnung statt getrennter Märkte.

---

## 2. Die Zahlen (Stand August 2026)

| Kennzahl | Wert |
|---|---|
| Bewertung | **20 Mrd. $** (Series G, 545 Mio. $, Aug. 2026) — vorher 11,5 Mrd. (Okt. 2025) |
| GMV 2024 → 2025 → H1 2026 | 3 Mrd. → **8 Mrd.** → **8 Mrd. in 6 Monaten** |
| Umsatz | auf Kurs >1 Mrd. $/Jahr (2024: 359 Mio.) — **nicht profitabel** |
| Marktanteil Live-Commerce (NA+EU) | ~60 % von ~22 Mrd. $ |
| Nutzungszeit | **95 Min./Tag** |
| Monatsretention | **>80 %** |
| Neue Accounts 2025 | ~20 Mio. · 650.000/Woche |
| Erstkäufer | +285 % YoY |
| Verkäufer 3-4×/Woche | 13.000 $/Monat · DE: **475 €/Sendestunde** |
| Peak-Skala | 583.000 gleichzeitige Zuschauer (MrBeast-Show) · 125 Käufe/Sekunde (Black Friday) |

**Take-Rate-Mathematik:** 8 % Provision (US/CA/AU; UK/EU 6,67 %) + 2,9 % + 0,30 $. Effektiv ~11 % bei 100 $-Artikeln, **~17 % bei 5 $-Artikeln**. Genau deshalb ist „$1 Start" so lukrativ für die Plattform: viele kleine Transaktionen = höchste effektive Rate.

---

## 3. Psychologie — die eigentliche Maschine

### 3.1 Die Auktion als Dopamin-Taktgeber

Der „**$1 Start**" (in fast jedem Titel im Feed: `$1 STARTS`, `Startet bei 1 €`) ist die zentrale Erfindung. Er wirkt auf vier Ebenen gleichzeitig:

1. **Einstiegshürde ~0** → jeder darf mitspielen, Kaufentscheidung wird zur Teilnahmeentscheidung.
2. **Endowment ab Sekunde 1** → wer bietet, *besitzt gefühlt schon*; jedes Überbieten ist ein Verlust, nicht ein entgangener Gewinn (Verlustaversion > Kaufwiderstand).
3. **Sozialer Wettbewerb** → man verliert nicht gegen einen Preis, sondern gegen `@nicole_lee_ann`, die im Chat sitzt.
4. **Zeitdruck ohne Schuldgefühl** → nicht „nur noch heute", sondern „gleich ist es weg" — echte, nicht fabrizierte Knappheit. Das ist der Unterschied zu Fake-Urgency: es fühlt sich nicht manipulativ an, weil es real ist.

### 3.2 Der Sponsor-Trick — Trinkgeld als Ware getarnt

Der wichtigste Fund im Netzwerk-Layer. In dem Stream, den ich geöffnet habe (`dailyupgrades`, 1.032 Zuschauer), sind **die drei obersten Shop-Artikel keine Produkte**:

| Artikel | Preis | Beschreibung | verkauft |
|---|---|---|---|
| „$25 AMAZON GIFTCARD SPONSORED" | **29 $** | *„Bless the chat with a $25 amazon GIFTCARD"* | **745×** |
| „$40 AMAZON GIFTCARD SPONSORED" | **50 $** | *„…and get promoted from our mods and host"* | 59× |
| „$100 AMAZON GIFTCARD SPONSOR" | **100 $** | *„…get promoted by our hosts and mods"* | 89× |

Der Zuschauer zahlt **über Nennwert**, damit der Host *jemand anderem* etwas schenkt — und bekommt dafür Status (Shoutout durch Host und Mods). Das ist exakt Twitchs „Gifted Subs", aber als **Listing** modelliert: Es läuft durch den normalen Checkout, ist steuerlich sauber, und **Whatnot kassiert seine 8 % darauf**. Trinkgeld ohne Trinkgeld-Produkt zu bauen.

> Serlo hat Coins + Gifts. Der Whatnot-Move wäre: **„Gift für den Chat"** — der Zuschauer kauft ein Geschenk, das der Host im Stream *verlost*, und wird namentlich als Sponsor eingeblendet. Kombiniert Umsatz, Status und Reichweite in einem Objekt.

### 3.3 Loyalty als Battle-Pass (aus der GraphQL-Antwort ausgelesen)

Jeder Verkäufer hat ein **eigenes, saisonales Treueprogramm** — `GetLoyaltyProgramForSeller`. Struktur:

- **Saisons** mit Enddatum („Saison 8 endet am 1. September") → periodischer Reset = wiederkehrender Grind, kein sattes Plateau.
- **5 Stufen**: Bronze → Silber → Gold → Platin → Diamant.
- **Drei Fortschrittsachsen** (das ist der psychologisch entscheidende Teil):
  - `MONEY_AMOUNT_PURCHASED` (z. B. 60 $)
  - `NUM_PURCHASES` (z. B. 3 Käufe)
  - **`SHOWS_WATCHED`** (z. B. 3 Shows) ← **Zuschauen allein zahlt auf den Fortschritt ein**
- **Belohnungen**: Rabattgutschein *für den nächsten Kauf* (10 % → 15 % → 25 $ → 35 $) **plus Stufen-Abzeichen am Avatar**.

Drei Mechaniken in einem: Der Gutschein ist ein **offener Kreis** (Zeigarnik — man hat etwas Unabgeschlossenes liegen), das Abzeichen ist **öffentlicher Status im Chat**, und `SHOWS_WATCHED` macht **bloße Anwesenheit belohnungsfähig** — genau die Metrik, die den Feed füttert.

### 3.4 Community Boost — Zuschauer finanzieren Werbung

Zuschauer zahlen auf ein Ziel ein; der Verkäufer bekommt **kein Geld**, sondern Werbebudget in gleicher Höhe. Whatnot behält also 100 % des Cashflows, der Fan bekommt das Gefühl, „seinen" Verkäufer groß gemacht zu haben. Ziel nicht in 30 Tagen erreicht → automatische Rückerstattung (Kickstarter-Mechanik: Risiko null, Beteiligung maximal). Astroturfing über Zweitaccounts ist ausdrücklich sanktioniert.

### 3.5 Parasoziale Bindung als Retention-Motor

Was ich im Live-Room gesehen habe: Namen statt Nummern, Moderatoren mit sichtbarem `Mod`-Badge aus der Community, Verkäufer mit **5,0 Sterne bei 75.924 Bewertungen**, direkte Ansprache im Chat („Womens hoka?" → beantwortet). Die 80 % Monatsretention kommen nicht vom Katalog — sie kommen daher, dass **donnerstags um 14:30 dieselbe Person dieselbe Show macht**. Retention ist hier ein *Sendeplan*, kein Feature.

### 3.6 Die Zone, in der es kippt — und was daraus zu lernen ist

Whatnot steht seit März 2026 unter Beschuss: **über 30 Nutzer** haben Schiedsverfahren eingeleitet (*Lesko v. Whatnot*), Vorwurf: unerlaubte Lotterie nach California Penal Code 319 (Einsatz + Zufall + Preis) durch „Breaks" und „Repacks"; teilweise mit RICO-Bezug. Die NYT berichtete.

Whatnots eigene Reaktion (März 2025, also *vor* der Klagewelle) ist die brauchbarste Vorlage, die es gibt:

- **Verboten**: versteckte Preise, Chase-Spots, Zufallsräder, randomisierte Verteilung.
- **Verboten**: Werbung mit Floor-/Ceiling-/Durchschnittswert eines Überraschungssets.
- **Erlaubt nur**, wenn *jeder mögliche Inhalt vorab offengelegt* ist und der Käufer weiß, welche Box er kauft.

**Die Trennlinie, die daraus folgt:** Spannung darüber, *wie viel* du zahlst (Auktion) ist legitim. Spannung darüber, *was* du bekommst (Zufallsbox) ist Glücksspiel. Whatnot hat den ersten Teil zum Geschäftsmodell gemacht und wird für den zweiten verklagt.

> Das ist der direkte Prüfstein für Serlos Design-Gesetz #4. Auktion, Live-Deal, Gift-Goal: sauber. Mystery-Box, Glücksrad, Loot-Coin: rote Linie — technisch trivial, rechtlich und moralisch teuer.

---

## 4. Struktur

### 4.1 Wer zahlt wen

```
KÄUFER ──── Artikelpreis + Versand ──────────────► WHATNOT
   │                                                  │
   ├──── Sponsor-Listing (Giveaway) ────► VERKÄUFER ◄─┤ 8 % + 2,9 % + 0,30 $
   │                                                  │
   └──── Community Boost ─────────────────────────────┤ 100 % bleibt (→ Ad-Credit)
                                                      │
VERKÄUFER ──── Boost-Gebot (Ad-Auktion) ──────────────┘
```

Drei Erlösquellen aus **einer** Zuschauerbeziehung. Das ist die eigentliche strukturelle Eleganz: Die Aufmerksamkeit wird dreifach monetarisiert, ohne dass eine Quelle die andere kannibalisiert.

### 4.2 Das Ads-Produkt

- **Boost**: Echtzeit-Auktion um Position 1 im Kategorie-Feed für **15 Minuten**. Gewinner-Ermittlung = Gebot × einfache Qualitäts-Heuristik (nicht reines Höchstgebot — verhindert, dass Geld schlechte Shows nach oben spült).
- Der Verkäufer sieht **live, wer gerade in seiner Kategorie mitbietet** und eine dynamische Preisspanne → macht den Verkäufer selbst süchtig nach dem Auktions-Loop. Sie verkaufen Verkäufern ihr eigenes Produkt.
- **Promote Full Show**: Stundenbudget, Impressionsschätzung, Dashboard mit Spend/Impressions/Clicks.
- Gemeldet: **~30 % ROI**, Ausgaben +20 % pro Monat.
- Impression zählt ab **200 ms sichtbar im Viewport** — sauber definiert, nicht geschummelt.

### 4.3 Zwei Konversionsschwellen, sauber getrennt

Ich konnte den kompletten Stream **ohne Account** sehen — Video, Chat, Produktliste, Preise. Der Login-Wall erscheint exakt an einer Stelle: *„Um an Shows teilzunehmen, musst du dich anmelden oder registrieren."*

**Zuschauen kostenlos, Mitmachen registriert.** Die Registrierung wird nicht an der Tür verlangt, sondern im Moment maximalen Verlangens — wenn der Artikel gerade läuft. Die Web-Startseite hingegen ist ein reiner **App-Download-Funnel**, weil die App die Push-Berechtigung hat und Push das Retention-Werkzeug Nr. 1 ist.

---

## 5. Technik (selbst gemessen)

### 5.1 Frontend

| Beobachtung | Detail |
|---|---|
| Framework | **Next.js App Router**, Routen-Segmente `app/[locale]/(main-layout)/browse/page-*.js` |
| i18n | 7 Locales über Pfad-Segment (`/de-DE/live/…`), inkl. en-GB/en-AU separat |
| Assets | selbst gehostet unter `/cdn/assets/<build-hash>/_next/…` — kein Fremd-CDN im kritischen Pfad |
| Bilder | **Thumbor-Syntax**: `images.whatnot.com/fit-in/384x0/filters:format(webp)/…` — daneben noch ein Alt-System mit signierten Base64-Payloads (AWS Serverless Image Handler). Zwei Generationen koexistieren. |

### 5.2 API-Schicht

Ein einziger Endpunkt, aber mit einem Detail, das ich klauen würde:

```
POST /services/graphql/?operationName=BrowseFeed&ssr=0
```

Der **Operation-Name steht in der Query-String**, obwohl der Body ein POST ist — dadurch sind CDN-Routing, Rate-Limits, Datadog-Traces und Fehlerraten **pro Operation** sichtbar, ohne den Body zu parsen. `ssr=0` markiert Client- vs. Server-Aufrufe.

Relay-Konventionen durchgehend: Base64-Global-IDs (`TGlzdGluZ05vZGU6MTA2NjY2MTk0Mw==` = `ListingNode:1066661943`), Cursor-Connections, `edges/node/pageInfo`.

**Das Feed-Schema trägt Ranking-Telemetrie im Vertrag:**

```json
"sessionId", "rankingRequestId", "returnBatchId",
"relevanceExplanation": null, "debugInfo": null
```

Jedes gelieferte Element weiß, aus welchem Ranking-Batch es kam — Attribution und A/B-Auswertung sind Teil der API, nicht nachträgliches Logging. `relevanceExplanation` deutet auf ein internes Debug-/Erklärbarkeits-Tooling.

**Server-driven UI:** `Section` mit `sectionType: SHOP_PRODUCTS`, `sectionStyle: TEXT_ONLY`, `sectionContentStyle: TILE` — Layout kommt vom Server, kein App-Update für Feed-Umbauten.

**Das Listing-Modell** (der Kern der Domäne):

```
transactionType: BUY_IT_NOW | AUCTION
transactionProps: { auction, giveaway, offers, isOfferable }
break, breakSpot                 ← Karten-Breaks als First-Class-Konzept
activeTimedListingEvent / upcomingTimedListingEvent  ← Flash-Sale-Timer
quantity, compareAtPrice, localizedPrice, userBookmark
structure: INDIVIDUAL_ITEM
version: "01KZXH7T7ETDB6ECZDV03XZPT6"   ← ULID als Optimistic-Concurrency-Marker
updatedAtMs
```

Ein Artikel-Typ, sechs Verkaufsmodi. Kein separates „Auktions-Objekt" — das ist der Grund, warum sie Formate so schnell ausrollen können.

### 5.3 Video

Aus dem `UnauthStreamCredentials`-Token dekodiert:

```
streamService: "ivs"
resource:   arn:aws:ivs:us-east-1:…:stage/5CeJeS5yxCDr
whip_url:   https://….global-bm.whip.live-video.net
events_url: wss://global.events.live-video.net
capabilities: { allow_subscribe: true }
```

**Amazon IVS Real-Time (Stages) über WebRTC/WHIP**, nicht HLS. Latenzziel laut AWS-Fallstudie **≤ 500 ms** — bei einer Auktion ist Latenz kein Komfort-, sondern ein **Fairness-Problem**: 3 Sekunden HLS-Verzögerung würde bedeuten, dass Zuschauer auf einen Zuschlag bieten, der längst gefallen ist. Bewusst diversifiziert (kein Single-Vendor). Aufzeichnungen nach S3.

> Serlo nutzt bereits LiveKit (WebRTC) — architektonisch dieselbe Wahl, aus demselben Grund. Der WHIP-Ingress, den du in v1.w.UI.36 gebaut hast, ist exakt Whatnots Ingest-Pfad.

### 5.4 Backend & Daten

- **Elixir** für den Live-Service (Echtzeit, hohe Verbindungszahl), **Python** für das Haupt-Backend. Klare Trennung: Zustandsmaschine der Sendung ≠ Geschäftslogik.
- **Kafka** + Streaming-Verarbeitung, **dbt** + Data Warehouse, Monte Carlo für Data-Observability, Data Contracts.
- **Celery-Queues nach Nachrichtentyp und Priorität** — Auktions-Push überholt Marketing-Kampagnen strukturell, nicht durch Zufall.

### 5.5 Feed-Ranking

Sie formulieren das Ranking als eine Frage: *„Wie wahrscheinlich schaut oder kauft dieser Käufer in dieser Show?"* Der For-You-Feed macht **50 % der GMV**.

Der entscheidende Umbau: **Batch → Online-Inferenz**. Vorher tägliche O(n·m)-Vorhersage für alle Käufer-Verkäufer-Paare (24 h veraltet, keine Show-Features, Cold-Start-Problem). Jetzt Vorhersage zur Request-Zeit mit Session-Features (wer sonst Pokémon kauft, aber gerade Vinyl sucht, bekommt Vinyl-Shows).

Ergebnis: **FYF-GMV +7,5 %, Bestellungen +5,2 %, Watches >10 min +3,7 %.** Feature-Store: Chalk. Neue-Nutzer-Heuristik komplett abgeschafft zugunsten eines einheitlichen Modells (+10 % Engagement für Neuanmeldungen). Juli 2026: Zukauf des Recommendation-Startups **Shaped** (Real-Time-Retrieval), Latenz von ~1 Tag auf Minuten, Ziel Echtzeit.

### 5.6 Benachrichtigungen — die Retention-Pipeline

Komponierbare Schichten, jede filtert/modifiziert den Batch:

```
ExpirationFilter → RecipientLoader → ChannelSelector →
NotificationSettingsFilter → ExperimentLayer →
TemplateDataLoader → Renderer → RateLimiter
```

Bemerkenswert: Einzelne Nachrichtentypen haben **ML-basierte RecipientFilter**, die entscheiden, ob ein bestimmter Nutzer diese Nachricht überhaupt bekommen soll — Unterdrückung als Modell, nicht als Regel. Messbarer Effekt: **+1,2 % DAU, +7,9 % Erstkäufer.**

### 5.7 Betrieb, Telemetrie, Abwehr

| Sache | Was ich gesehen habe | Warum es klug ist |
|---|---|---|
| **First-Party-Proxy** | `/reroute/segment_cdn/…`, `/reroute/datadog/…`, `/reroute/statsig/…` + eigener Event-Sink `/services/events/v1/m` | Alle Telemetrie läuft über die eigene Domain → adblocker-resistent, First-Party-Cookies, ein Failure-Domain weniger |
| **Feature-Flags** | Statsig (Client-SDK) | Experimente + Kill-Switches getrennt vom Deploy |
| **Remote-Config** | `/api/v1/realtime/settings`, alle **60 s** gepollt | Siehe unten |
| **Bot-Abwehr** | **Kasada** (`x-kpsdk-*`, eigener Fingerprint-Endpunkt, lieferte mir ein 429) | Auktionsplattform ohne Bot-Schutz = Snipe-Bots und Fake-Zuschauerzahlen |
| **Monitoring** | Datadog RUM + Logs, Web-Vitals **pro Screen** gesampelt | `/live/?` → TTI-Sampling 100 %, Rest 10 %. VIP-Verkäufer-Dashboard: 100 %. |

Die Remote-Config im Klartext ist die lehrreichste Datei des Tages:

```json
{ "killSwitches": {},
  "locationReload": { "globalLimit": 10, "disabledKeys": [] },
  "webVitalsObserver": { "vipSeller": { "sampleRateByScreen": {"/dashboard/live/?": 1} },
                         "timeToInteractive": { "sampleRate": 0.1,
                                                "sampleRateByScreen": {"/live/?": 1} } },
  "refreshAppVersions": [],
  "live": { "idsRequiringAuth": [] },
  "appVersion": "20260813-1004" }
```

Drei Dinge daran sind Gold: `locationReload.globalLimit: 10` ist ein **Circuit-Breaker gegen Reload-Schleifen** (ein Bug, der die Seite neu lädt, kann maximal 10× zuschlagen). `refreshAppVersions` erzwingt Client-Aktualisierung ohne Store-Deploy. `live.idsRequiringAuth` erlaubt, **einzelne Streams** kurzfristig hinter Login zu stellen — Missbrauchsschutz auf Stream-Ebene, per Config, ohne Deploy.

---

## 6. Was davon konkret für Serlo/Vibes zählt

Du hast bereits: LiveKit-Streams, Gifts, Coins, Co-Host, Polls, Gift-Goals, Shop, Guilds, Feed-Algorithmus v5. Die Lücke ist nicht Technik — es ist **Format und Rhythmus**.

**Die vier größten Hebel, nach Verhältnis Wirkung/Aufwand:**

1. **Sendeplan statt Zufallsstreams.** Whatnots gesamte Retention hängt an planbaren, wiederkehrenden Shows („Top Shelf Thursday", „Heute um 14:30"). Du hast bereits geplante Streams im Feed-Konzept — was fehlt, ist das *Ritual*: benannte, wiederkehrende Sendungen + Erinnerungs-Push. Kostet fast nichts, verändert alles.
2. **„Gift für den Chat" als Listing.** Dein Coin-/Gift-System kann das schon technisch. Neu ist nur die Semantik: Der Zuschauer kauft ein Geschenk, das der Host *verlost*, und wird namentlich als Sponsor eingeblendet. Umsatz + Status + Reichweite in einem Objekt. Whatnot verkauft davon 745 Stück in einem einzigen Stream.
3. **Saisonales Treueprogramm pro Creator** — mit `SHOWS_WATCHED` als eigener Fortschrittsachse. Belohnt Anwesenheit, nicht nur Ausgaben; die Saison-Grenze erzeugt den Wieder-Einstieg. Passt exakt auf dein Design-Gesetz #1 (Hochs feiern: Stufenaufstieg = Number-Rollup + Spring + Haptik) und liefert dir zugleich das Statusabzeichen aus Gesetz #4 (Teip ⛰️, Streak 🔥, jetzt + Stufe).
4. **Ein Listing-Typ, mehrere Verkaufsmodi.** Whatnots `transactionType` + `transactionProps` an *einem* Objekt ist der Grund, warum sie Formate in Tagen ausrollen. Dein `products`-Schema hat schon `sale_price_coins`, `stock`, `free_shipping` — der nächste Schritt wäre `transaction_type: BUY_NOW | AUCTION | GIVEAWAY` statt separater Tabellen.

**Aus dem Betriebs-Handbuch direkt übernehmbar:**

- **Remote-Config mit Kill-Switches**, alle 60 s gepollt (bei dir: eine `app_config`-Tabelle + Realtime-Sub). Du hast bereits die Erfahrung, dass stille 400er dich Wochen kosten — ein Kill-Switch pro Feature ist die Versicherung dagegen.
- **`operationName` in der Query-String** — bei dir das Äquivalent: RPC-Name im PostgREST-Log-Kontext, damit Supabase-Logs pro Operation auswertbar sind (deine Notiz zu stillen 400ern zeigt genau diesen Schmerz).
- **Reload-Circuit-Breaker** mit hartem Limit.
- **Ranking-Telemetrie im API-Vertrag** (`rankingRequestId` pro Feed-Item) — dein Feed-v5 mit gewolltem Jitter ist ohne Batch-ID praktisch nicht auswertbar.

**Und die rote Linie:** Auktion und Live-Deal sind sauber — der Nervenkitzel betrifft den *Preis*. Sobald der Nervenkitzel den *Inhalt* betrifft (Mystery-Box, Glücksrad, Loot-Coin), landest du auf derselben Seite wie Whatnot im *Lesko*-Verfahren. Bei einer jungen, eng vernetzten Community mit hohem Vertrauensanteil ist das kein Restrisiko, sondern ein Existenzrisiko.

---

## Quellen

- [Whatnot valued at $20 billion as live shopping continues to boom — CNBC](https://www.cnbc.com/2026/08/07/whatnot-live-shopping-valuation-20-billion.html) · [Series G, 545 Mio. $ — Tubefilter](https://www.tubefilter.com/2026/08/07/whatnot-series-g-funding-round-545-million-live-shopping/) · [PYMNTS](https://www.pymnts.com/news/investment-tracker/2026/live-commerce-platform-whatnot-raises-545-million-to-speed-ai-expansion/)
- [Whatnot revenue, valuation & funding — Sacra](https://sacra.com/c/whatnot/) · [Business Breakdown & Founding Story — Contrary Research](https://research.contrary.com/company/whatnot)
- [2026 State of Live Selling Report — Whatnot Blog](https://blog.teamwhatnot.com/unitedstates/2026livesellingreport) · [Analyse — Value Added Resource](https://www.valueaddedresource.net/whatnot-2026-live-selling-report/) · [Tubefilter](https://www.tubefilter.com/2026/01/28/whatnot-state-of-live-selling-report-2026-shopping-ecommerce/)
- [Whatnot Fees 2026 — Voolist](https://www.voolist.com/blog/whatnot-fees-2026) · [Fees & commissions — Whatnot Help Center](https://help.whatnot.com/hc/en-us/sections/44398189207565-Fees-commissions) · [Community Boost](https://help.whatnot.com/hc/en-us/articles/30706277083021-Community-Boost) · [Promote Tools](https://help.whatnot.com/hc/en-us/articles/34443991672589-Promote-Tools)
- [Building Whatnot's First Ads Product — Boosted Livestreams](https://medium.com/whatnot-engineering/building-whatnots-first-ads-product-boosted-livestreams-a2b8b6a0b790) · [Evolving Feed Ranking at Whatnot](https://medium.com/whatnot-engineering/evolving-feed-ranking-at-whatnot-25adb116aeb6) · [The New User Dilemma](https://medium.com/whatnot-engineering/the-new-user-dilemma-why-we-killed-our-heuristics-what-we-built-instead-0d7a834fda5f) · [Whatamix: Blendable feed construction](https://medium.com/whatnot-engineering/whatamix-blendable-feed-construction-2c94c21f6635) · [Powering real-time magic moments through notifications](https://medium.com/whatnot-engineering/powering-real-time-magic-moments-through-notifications-36cd833f898e) · [Scaling Whatnot: Largest Live Shopping Stream in US History](https://medium.com/whatnot-engineering/scaling-whatnot-behind-the-largest-live-shopping-stream-in-us-history-040a458f538c)
- [Whatnot bolsters live stream resiliency with Amazon IVS — AWS](https://aws.amazon.com/blogs/media/whatnot-bolsters-real-time-live-stream-resiliency-with-amazon-ivs/) · [Scaling our Data Stack with Kafka](https://medium.com/whatnot-engineering/scaling-our-data-stack-with-kafka-and-real-time-stream-processing-56554dcbb0fc)
- [Whatnot Acquires AI Recommendation Startup Shaped — The AI Insider](https://theaiinsider.tech/2026/07/27/whatnot-acquires-ai-recommendation-startup-shaped-to-boost-live-commerce-personalization/) · [Modern Retail zur Recommendation-Engine](https://www.modernretail.co/technology/marketplace-briefing-how-whatnots-ai-powered-recommendation-system-gives-it-a-competitive-edge/)
- [Card Break Roulette: Whatnot Accused of Running a Gambling Scheme — Hoodline](https://hoodline.com/2026/03/card-break-roulette-whatnot-accused-of-running-a-gambling-scheme/) · [Whatnot Lawsuit 2026: PC 319 Analyse — Slab-Z](https://www.slab-z.com/post/whatnot-lawsuit-2026-gambling-legal-analysis) · [Whatnots Surprise-Set-/Gambling-Policy](https://pokemastermates.com/blogs/news/whatnots-surprise-set-gambling-policy-update-what-every-seller-needs-to-know) · [WhatNot Addiction? — Birches Health](https://bircheshealth.com/resources/whatnot-auctions-addiction)
- Eigene Messung: `whatnot.com` (Browse-Feed, Live-Room `dailyupgrades`), Netzwerk- und GraphQL-Analyse, 13.08.2026

---

Ich habe deine Codebasis durchgesehen (223 Migrationen, ~13.100 Dateien) — das Fundament ist deutlich weiter, als der Rest der Frage vermuten lässt. Hier die ehrliche Bewertung.

---

# Kann ich das jetzt separat bauen?

## Kurzantwort

**Bauen: ja. Separat: nein — noch nicht.**

Du hast ~70 % der Maschine schon in Serlo. Eine zweite App gibt dir von den fehlenden 30 % **nichts geschenkt**, kostet aber das komplette Fundament nochmal. Und: Whatnot selbst hat es genauso gemacht — sie hatten einen laufenden Marktplatz und haben im Sommer 2020 *Livestreaming als Feature* eingebaut. Nicht umgekehrt.

Die zwei Dinge, die dieses Projekt töten können, sind **beide nicht technisch**. Dazu unten.

---

## 1. Inventur: Was du schon hast

| Baustein | Status in Serlo | Datei/Tabelle |
|---|---|---|
| Live-Video (WebRTC) | ✅ LiveKit + persistenter WHIP-Ingress (OBS) | `user_whip_ingresses`, `livekit-token` |
| Live-Moderation | ✅ Timeout, Slow-Mode, Pin, Shadowban, Server-Mute, Mods, CoHost | `live_moderators`, `livekit-moderate` |
| Produkt im Stream | ✅ Shop-Modus + Produktkarten aufs Video platzierbar | `live_placed_products`, `shop_enabled` |
| Produktkatalog | ✅ Preis, Angebotspreis, Stock, Bilder, Versand, Ort, Frauen-Only | `products` (20 Spalten) |
| **Echte €-Bestellungen** | ✅ Statusmaschine inkl. `disputed`/`refunded`, Versandadresse, Tracking | `product_orders` |
| **Marktplatz-Schema** | ✅ vorgebaut: `stripe_connect_id`, `kyc_status`, `platform_fee_bps` | `seller_accounts` |
| Zahlungen | ✅ Stripe (Web) + RevenueCat (App), Webhook-Härtung, Idempotenz | `web_coin_orders` |
| Bewertungen / Streit | ✅ `product_reviews`, Dispute-Migration, Admin-Support-Threads | |
| Werbefläche | ✅ vermietbares Banner-Karussell mit Zeitfenstern + Klickzähler | `shop_banners` |
| **Frauen-Only-System** | ✅ Antrag → Admin-Freigabe, server-erzwungen | `women_only_approval` |
| Push | ✅ Expo + Web-Push, 3 Surfaces | `push_tokens` |
| Web-Pendant | ✅ Next.js mit `/shop`, `/live`, `/studio`, `/woz` | `apps/web` |
| Rechtsseiten | ✅ Impressum, Widerruf, Datenschutz, Kinderschutz | |

**Das ist mehr, als Whatnot 2020 hatte.**

## 2. Was fehlt — sechs Bausteine

| # | Fehlt | Schwere | Bemerkung |
|---|---|---|---|
| 1 | **Auktion** — Gebot, Timer, Anti-Snipe-Verlängerung, Zuschlag | 🟡 mittel | Existiert bei dir **null** (geprüft). Aber: reine Postgres-Arbeit — RPC mit `FOR UPDATE`, Broadcast, serverseitige Uhr. Die Logik ist kleiner als dein CoHost-System. |
| 2 | **Stripe Connect** (Auszahlung an Dritte) | 🟡 mittel | Feld existiert, ist nur nicht angeschlossen. Express-Onboarding = Stripe macht KYC. |
| 3 | **1-Tap-Checkout im Stream** | 🟢 klein | Zahlungsmethode hinterlegt, Kauf ohne Stream zu verlassen. |
| 4 | **Sammelversand** — mehrere Gewinne eines Käufers = **ein** Paket | 🟡 mittel | Whatnot löst das über einen offenen „Warenkorb pro Verkäufer, 24 h". Ohne das ist Auktion wirtschaftlich unmöglich (5 € Ware, 5 € Versand). |
| 5 | **Verkäufer-Onboarding** (Antrag, LUCID, USt-ID, Steuer-ID) | 🟡 mittel | Pflicht, siehe Recht unten. |
| 6 | Boost/Ads, Loyalty-Saison, Sponsor-Gift | 🟢 klein | Alles Aufsatz, kein Fundament. Später. |

---

## 3. Die unmöglichen Sachen — vollständige Liste

Wie gewünscht: aufgeschrieben, mit Urteil. **🔴 = ausschließen · 🟠 = teuer, aber lösbar · 🟢 = lösbar**

### A · Geld und Recht (Deutschland/EU)

| # | Problem | Urteil | Lösung / Ausschluss |
|---|---|---|---|
| A1 | **Fremdes Geld weiterleiten = erlaubnispflichtiges Zahlungsgeschäft** (ZAG). Wenn Käufergeld auf *deinem* Konto landet und du es an Verkäufer weiterreichst, brauchst du eine BaFin-Erlaubnis. | 🟢 | **Nie selbst.** Stripe Connect (Express) — Stripe ist lizenziert, hält das Geld, macht Auszahlung + KYC. Deine `stripe_connect_id`-Spalte ist genau dafür da. Kein eigenes Treuhandkonto. Niemals. |
| A2 | **Coins als Zahlmittel für echte Ware von Dritten = E-Geld** → Lizenzpflicht. | 🔴 | **Hart ausschließen.** Coins bleiben ausschließlich für Digitales (Gifts, Sticker, Boosts). Physische Ware = immer €/Stripe. Du hast diese Trennung in `shop_real_money_orders` schon sauber dokumentiert — sie darf **nie** aufgeweicht werden, auch nicht „nur für die Auktion". |
| A3 | **DAC7 / PStTG**: ab dem ersten Drittverkäufer musst du Verkäuferdaten (Name, Adresse, Steuer-ID, IBAN, Umsätze) erheben und **jährlich ans BZSt melden** — ab 30 Verkäufen oder 2.000 €/Jahr pro Verkäufer. Bußgeld bis 50.000 €. | 🟢 | Pflichtfelder ins Onboarding + ein Jahres-Export-Report. Muss **vor** dem ersten Drittverkäufer stehen, nicht danach. |
| A4 | **§ 25e UStG**: Du haftest für nicht abgeführte Umsatzsteuer deiner Verkäufer, wenn du USt-ID/Bescheinigung nicht erfasst. | 🟢 | USt-ID als Pflichtfeld, Gültigkeitsprüfung beim Onboarding. |
| A5 | **Widerrufsrecht gilt auch bei Online-Auktionen.** Eine Online-Auktion ist rechtlich *keine* Versteigerung (§ 34b GewO) — der Käufer darf 14 Tage widerrufen. | 🟠 | **Nicht lösbar, nur einkalkulieren.** Das ist der größte Formatbruch gegenüber Whatnot-US. Konsequenz: Rücksendequote als feste Kostenposition, klare Rücksende-Regeln, keine Ware, die durch Rückgabe wertlos wird (Kosmetik geöffnet, Lebensmittel). |
| A6 | **GPSR** (seit 12/2024): jedes Angebot braucht Hersteller, EU-Verantwortlichen, Warnhinweise. Marktplätze müssen das erzwingen. | 🟢 | Pflichtfelder am Listing, Sperr-Möglichkeit. |
| A7 | **Verpackungsgesetz/LUCID**: Du darfst Verkäufer **ohne LUCID-Nummer nicht listen** (Prüfpflicht des Marktplatzes). | 🟢 | LUCID-Nummer Pflichtfeld beim Verkäufer-Onboarding. |
| A8 | **Elektro (WEEE/EAR), Batterien, Lebensmittel, Alkohol** | 🔴 | **Kategorien ausschließen.** Whatnot macht Elektronik und Essen — du kannst das nicht tragen. |
| A9 | Kosmetik/Parfüm von Dritten (CPNP, EU-Verantwortlicher) | 🟠 | Kategorie **zunächst nur für dich selbst** (du hast die Compliance für SERLO schon). Drittverkäufer erst später. |
| A10 | Grenzüberschreitend (Diaspora in DE/AT/FR/BE) → OSS-Registrierung ab 10.000 € | 🟢 | Buchhaltungsaufgabe, kein Softwareproblem. |
| A11 | Minderjährige bieten mit → schwebend unwirksame Verträge | 🟢 | Altersbestätigung beim Bieten, Verkäufer verifiziert. |

### B · Kultur und Zielgruppe

| # | Problem | Urteil | Lösung / Ausschluss |
|---|---|---|---|
| B1 | **Frauen vor der Kamera.** Das kaufkräftigste Segment (Mode, Beauty, Schmuck, Kinderausstattung) wird in deiner Community überwiegend von Frauen betrieben — die aber oft nicht mit Gesicht vor fremde Männer treten wollen. Whatnots Format setzt Gesicht voraus. **Ohne Lösung ist die halbe Marktseite tot.** | 🟢 | **Dein größter Vorteil, nicht dein Problem.** Drei Modi: (a) **WOZ-Live** — geprüfte Frauen-Only-Streams, kein Replay, kein Mitschnitt (dein `women_only_approval` + `live_recordings`-Flag = fast fertig); (b) **Hände-/Produktkamera** — Ware im Bild, Stimme drüber, kein Gesicht; (c) Voice-only mit Standbild. Technisch ein UI-Modus. Kulturell der Grund, warum es dich gibt. |
| B2 | **Glücksspiel = haram + rechtlich riskant.** Mystery-Box, Glücksrad, Loot-Coin. Whatnot wird genau dafür gerade verklagt. | 🔴 | **Kompromisslos ausschließen** — und daraus ein Verkaufsargument machen: „Kein Glücksspiel, nur echte Ware." Die Auktion selbst ist islamrechtlich unproblematisch (Muzāyada ist überliefert). Nur der *Zufall über den Inhalt* ist das Problem, nicht der *Wettbewerb über den Preis*. |
| B3 | **Riba** — Klarna/BNPL/Ratenzahlung mit Zinsen | 🔴 | Ausschließen. Vereinfacht ohnehin die Integration. |
| B4 | Kategorie-Tabus (Alkohol, Schwein, freizügige Kleidung) | 🟢 | Kategorie-Policy + deine bestehende Moderations-Pipeline. |
| B5 | **Vertrauen ist personal, nicht institutionell.** Ein 5-Sterne-Durchschnitt bedeutet in der Community weniger als „mein Cousin kennt ihn." | 🟢 | **Bürgen-System**: bestehende, verifizierte Nutzer bürgen sichtbar für einen neuen Verkäufer. Das ist Teip-Logik statt anonymer Sterne — und etwas, das Whatnot strukturell nicht bauen kann. Baut auf `follows` + `guilds` auf. |
| B6 | Streit wird über Vermittler geregelt, nicht über Formulare | 🟢 | Vermittler-Rolle im Dispute-Flow (angesehener Nutzer statt nur Admin). |
| B7 | **Marktgröße.** Tschetschenen in Europa: grob 200–300k, davon Deutschland ~60–80k. Bei realistisch 1–2 % aktiven Käufern reden wir über **wenige hundert Menschen**. Mit 8 % Provision trägt das keine Firma. | 🟠 | **Siehe Abschnitt 4 — das ist der eigentliche Knackpunkt.** |

### C · Betrieb und Technik

| # | Problem | Urteil | Lösung / Ausschluss |
|---|---|---|---|
| C1 | **LiveKit-Kosten skalieren mit Zuschauer × Minuten.** Live-Shopping bedeutet lange Sessions. 300 Zuschauer × 3 h = 54.000 Zuschauerminuten pro Show. | 🟠 | **Vor dem Bauen rechnen.** Trick: Video darf 2–3 s hinterherhinken, wenn der **Auktionszustand nicht aus dem Video gelesen wird**, sondern als serverseitig autoritatives Overlay kommt. Dann: WebRTC nur für kleine Shows, HLS-Distribution ab ~200 Zuschauern. Whatnot braucht diesen Trick nicht — die haben 545 Mio. $. |
| C2 | **Auktion braucht eine serverseitige Uhr.** Client-Timer = Betrug. | 🟢 | Zuschlag per pg_cron/Edge-Function gegen `ends_at`, Gebote per RPC mit Row-Lock, Anti-Snipe: jedes Gebot in den letzten 10 s verlängert um 10 s. |
| C3 | Bot-Gebote / Fake-Zuschauer | 🟢 | Du hast bereits Viewer-Dedup (`live_session_viewers`) und Rate-Limits. Für Gebote: Konto muss Zahlungsmethode hinterlegt haben. |
| C4 | **Du kannst nicht hand-programmieren.** 13.100 Dateien sind schon jetzt viel. | 🟠 | **Der stärkste Grund gegen eine zweite App.** Zweite Codebasis = zweite CI, zweite Store-Präsenz, zweite Review-Runde, doppelte Wartung — bei gleichem Ergebnis. |
| C5 | App-Store-Provision auf Auktionen? | 🟢 | **Nein.** Physische Ware ist von IAP ausgenommen (0 % Apple). Coins für Digitales bleiben IAP. Mischung ist erlaubt, muss getrennt bleiben — ist sie bei dir. |
| C6 | Versandlabels/Retouren automatisieren | 🟠 | Heute nur manuelle Tracking-Nummer (`lib/tracking.ts`). Erste Phase: reicht. Ab ~50 Bestellungen/Woche: Sendcloud o. ä. |

---

## 4. Die zwei echten Killer

Alles oben ist Arbeit. **Das hier sind die zwei Dinge, die entscheiden, ob es überhaupt geht.**

### Killer 1: Der Markt ist zu klein

Tschetschenen allein tragen keinen Marktplatz. Das ist keine Meinung, das ist Arithmetik.

**Lösung, die ich empfehle:** Nicht „App für Tschetschenen", sondern **„Live-Basar für die muslimische Diaspora im deutschsprachigen Raum"** — mit tschetschenischem Kern als Startzelle. Türkisch, arabisch, bosnisch, albanisch, kurdisch, dagestanisch: **dieselben Bedürfnisse** — Frauen-Only-Räume, kein Glücksspiel, halal-Kategorien, Vertrauensnetze, Muttersprache. Der Markt ist 50–100× größer, das Produkt ist **identisch**.

Whatnot hat genau so angefangen: Pokémon-Sammler waren die Startzelle, nicht der Markt.

Deine Startzelle bleibt tschetschenisch, weil du dort Vertrauen hast. Die Architektur muss aber von Tag 1 mehrsprachig und mehr-community-fähig sein — du hast bereits DE/EN/RU und `profiles.locale`.

### Killer 2: Die Verkäuferseite

Whatnot lehnt >50 % der Bewerber ab — weil Zehntausende sich bewerben. Du brauchst **5 bis 10 Menschen, die verlässlich jede Woche zur selben Zeit senden.** Kein Code der Welt ersetzt das.

**Das ist dein Vorab-Test, und er kostet 0 €:**

> Finde **fünf** Händler aus deinem Umfeld (Parfüm, Kleidung, Schmuck, Kinderartikel, Haushalt), die zusagen, **acht Wochen lang wöchentlich zwei Stunden zu senden** — im *bestehenden* Serlo, mit Sofortkauf, ohne Auktion.
>
> Schaffst du diese fünf nicht → bau die Auktion nicht. Schaffst du sie → du hast einen Sendeplan, und die Auktion ist dann die richtige nächste Investition.

Das ist derselbe Test, den Whatnots erste Show war: 5.000 $ Funko Pops an einem Abend. Erst danach kam die Plattform.

---

## 5. Warum nicht separat — und wann doch

**Gegen eine zweite App:**
- 70 % des Fundaments existiert und wäre komplett neu zu bauen
- Die Nutzer sind dieselben Menschen — zweite App = zweiter Download, zweites Login, kalter Feed, Community von null
- Dein Startvorteil *ist* die bestehende Community. Eine neue App wirft ihn weg.
- Wartungslast doppelt, bei einem Ein-Personen-Team

**Der ehrliche Gegenpunkt:** Serlo ist Videofeed + Stories für junge Erwachsene. Ein Handelsplatz ist eine andere Versprechung, und ein 90-€-Parfümkauf neben einem Gift-Overlay kann Vertrauen kosten.

**Antwort darauf:** Trenne die **Oberfläche**, nicht die Codebasis. Eigener Tab, eigene Bildsprache, eigene Web-Domain, eigene Store-Screenshots — eine Codebasis, ein Login, eine Community. Abspalten kannst du später mit echten Zahlen. Umgekehrt geht es nicht.

---

## 6. Konkreter Weg

| Phase | Inhalt | Abbruchkriterium |
|---|---|---|
| **0 — Sendeplan** (4–8 Wo, kein Code) | 5 Verkäufer, feste Termine, Sofortkauf im bestehenden Live-Shop-Modus | <3 Verkäufer senden nach 4 Wochen regelmäßig → **stoppen** |
| **1 — Auktion** | Gebots-RPC, Server-Timer, Anti-Snipe, Sammelversand-Fenster (24 h/Verkäufer), 1-Tap-Kauf | Auktionen erzielen nicht mehr als Sofortkauf → Format streichen |
| **2 — Marktplatz** | Stripe Connect Express, Verkäufer-Onboarding mit LUCID/USt-ID/Steuer-ID, DAC7-Report, Bürgen-System | — |
| **3 — Wachstum** | WOZ-Live ausbauen, Loyalty-Saison, Sponsor-Gift, Boost | — |

**Was du in Phase 1 bewusst *nicht* baust:** Ads, Loyalty, Replay, Breaks, Mystery — alles davon ist Aufsatz und lenkt vom einzigen ab, was zählt: bekommt eine Auktion in deiner Community mehr Geld für dieselbe Ware als ein Festpreis?

---

**Zusammengefasst:** Technisch ist nichts an diesem Projekt unmöglich. Rechtlich sind vier Dinge auszuschließen (Coins für echte Ware, Zufalls-Mechaniken, BNPL, regulierte Kategorien) und sechs sind Pflichtfelder im Onboarding. Das echte Risiko ist die Marktgröße — lösbar, indem der Kreis von „tschetschenisch" auf „muslimische Diaspora, tschetschenischer Kern" geweitet wird — und die Verkäuferseite, die du **ohne eine Zeile Code in acht Wochen testen kannst**.

---

Beides steht. Kurz, was die Entscheidungen sind:

## Die sieben Stellen, an denen Berkat besser ist als Whatnot

1. **Vertrauen statt Sterne** — Bürgen und Verkaufszahl direkt unter dem Namen. Whatnot zeigt „5,0 ★" in Winzschrift; in deiner Community entscheidet, *wer für jemanden bürgt*.
2. **Frauen-Only sichtbar im Stream** — Schloss-Badge im Video. Whatnot hat dafür kein Konzept, du hast das System schon gebaut.
3. **Chat schmal, unten links** — das Gespräch stört den Handel nicht. Whatnot gibt dem Chat eine ganze Spalte, die mit dem Kauf um Aufmerksamkeit konkurriert.
4. **Sammelkorb-Leiste** — „3 Artikel · 1 Paket · noch 22 h". Das löst genau das Problem, das Auktionen mit 5-€-Ware sonst wirtschaftlich unmöglich macht: dreimal Versand. Bei Whatnot versteckt sich das im Warenkorb.
5. **„Als Nächstes"** — die kommenden Artikel als Streifen. Der stärkste Verweilhebel überhaupt, und Whatnot hat ihn **nicht**. Man bleibt, weil man weiß, was kommt.
6. **Aktuelles Gebot mit Namen** direkt über dem Button — der Gegner ist ein Mensch, keine Zahl.
7. **Der Preis ist der Button.** Volle Breite, 52 px, Daumenzone, Countdown als Balken *im* Button. Kein Zielen, kein Suchen nach dem Timer.

Der wichtigste Zustand ist „Du führst": Der Button **hört auf, ein Button zu sein**. Bei Whatnot kannst du dich selbst überbieten — das kostet Käufer Geld und erzeugt hinterher Ärger. Und „Letzte Sekunden" zeigt die Anti-Snipe-Regel offen an, statt sie zu verstecken.

## Zum Logo

Die Kornähre ist das Bild für Berkat selbst — Fülle, Ernte, Segen — und wird in allen Zielgemeinschaften gelesen, **ohne ein religiöses Symbol zu sein**. Kein Halbmond, keine Kalligrafie: funktioniert damit auch für Käufer außerhalb der Community und in jedem App Store. Sieben Körner, geometrisch statt botanisch, hält bis 24 px.

Gold auf Tiefgrün ist bewusst das Gegenteil von Whatnots Signalgelb — das liest sich als Jahrmarkt, deins soll sich als Basar lesen. Terrakotta ist ausschließlich für „live" und „überboten" reserviert: Dringlichkeit ist ein Zustand, keine Grundfarbe.

---

## Wie ich es anlege

`apps/berkat/` als **eigenständige Expo-App** im bestehenden Repo — eigene Bundle-ID (`com.berkat.app` / `app.berkat.market`), eigener Name, eigenes Icon, eigener Store-Eintrag, eigene UI. Self-contained mit eigenem `package.json` und `node_modules`, genau wie `apps/web` — das ist die Struktur, die in deinem Repo schon funktioniert, und sie schützt dich vor dem Dependency-Chaos, das dich beim Web-Build schon einmal erwischt hat. Gemeinsam bleibt nur das Supabase-Backend: deine Nutzer sind mit ihrem Account sofort drin.

**Wenn Logo und Farben so passen, baue ich als Nächstes:**

1. App-Gerüst — `apps/berkat/` mit Expo Router, Theme-Tokens aus dieser Palette, Icon/Splash aus dem Ähren-Mark
2. Supabase-Anbindung + Login gegen dieselbe DB
3. Den Live-Auktions-Screen genau wie oben, mit allen fünf Button-Zuständen
4. Die Auktions-Migration: `live_auctions` + `live_bids`, Gebots-RPC mit Row-Lock, serverseitiger Zuschlag, Anti-Snipe-Verlängerung, Sammelkorb-Fenster

Sag, ob Ähre und Farben bleiben oder ob du etwas anderes im Kopf hattest — danach lege ich los.

---
---

# Zweite Analyse: die Nicht-Live-Seite (18.08.2026)

> Die Analyse oben endet an der Live-Sendung. Sie ist damit vollständig für die
> Frage „wie funktioniert Whatnot" — und **blind für die Frage, an der Berkat am
> 17./18.08.2026 zwei Tage gearbeitet hat**: Was passiert, wenn niemand sendet?
> Diese Ergänzung schließt die Lücke. Quellen am Ende, alle aus Whatnots
> Hilfe-Center und Verkäufer-Dokumentation.

## 0. Der Befund in einem Satz

Whatnot hat **exakt dasselbe Zwei-Regale-Modell wie Berkat** — und sagt offen,
dass das stille Regal schlecht sichtbar ist.

## 1. Zwei Regale, benannt

| Whatnot | Berkat |
|---|---|
| **Profile Shop** — Buy-It-Now, jederzeit kaufbar, erscheint in Kategorie-Browse **und Suche** | Regal (`session_id IS NULL`, `status='listed'`) |
| **Live Shop** — Artikel, die einer Show zugeordnet sind | Show-Artikel (`session_id` gesetzt) |
| Umschalter **„Reserve for Live"** | ❌ fehlt (HANDOFF 17 führt es als bewusste Lücke) |

⚠️ **Whatnot hat die Semantik im Juli 2026 gedreht** — und die neue ist die
bessere: Früher blieb ein reservierter Artikel *auch* im Profile Shop, heute
**verschiebt** der Schalter ihn. Wer beides will, legt ohne Reservierung an und
**importiert später in die Show**. Damit ist „wo liegt es" jederzeit eindeutig;
die alte Fassung hatte einen Artikel an zwei Orten mit einer Wahrheit.

Wer den Umschalter in Berkat baut, baut ihn so: ein `UPDATE` auf `session_id`,
kein Duplikat.

## 2. Was sie haben und wir nicht

| Was | Bewertung für Berkat |
|---|---|
| **Preisvorschlag** („Accept offers", Schalter je Angebot: annehmen / kontern / ablehnen) | **Bauen.** Siehe Korrektur unten. |
| **Varianten** (Größe/Farbe an EINEM Artikel) | Wichtig, aber erst mit echtem Verkäufer — Abaya, Hijab, Mode und Schuhe sind Berkats reale Kategorien, und ein Verkäufer mit fünf Größen legt heute fünf Angebote an. |
| **„Sudden Death"** (Anti-Snipe als Schalter je Auktion) | Klein. Berkat verlängert immer; Whatnot lässt wählen. |
| **Seller Hub**: Analytics (Käufer, Stream-Leistung, Erlöse, Retention), Sammel-Versandetiketten, CSV-Massenupload, Barcode-/Slab-Scan, **Snap Listings (Beta)** — Fotos rein, Titel und Beschreibung automatisch | Nur **Analytics** ist relevant. Der Rest sind Werkzeuge für Verkäufer mit hunderten Artikeln; die gibt es hier nicht. |
| **Flash Sale** (befristeter Rabatt während der Show) | Später, gehört zum Live-Format. |
| Volle Seller-Hub-Freischaltung **erst nach der ersten Show** | Interessantes Gating — Berkats „Deine ersten Schritte" macht dasselbe weicher. |

## 3. Zwei Regeln, die sie härter ziehen

**Mindestens ein Foto ist Pflicht**, Katalogbilder sind verboten, das Foto muss
den Artikel **ganz und unverdeckt** zeigen. Berkat verlangt bewusst keins („wer
abends schnell drei Sachen einstellt, bricht sonst nach dem ersten ab").

Das bleibt für Phase 0 richtig — aber Whatnots Grund ist nicht Ästhetik, sondern
**Streitfälle**: Wer falsch beschreibt, wird zurückbelastet, und die
Käuferschutz-Richtlinie hängt am Foto. Sobald bei Berkat der erste Streit über
einen Zustand entsteht, ist die Regel fällig.

**Zustands-Leitfäden je Kategorie** (Sneaker, Taschen, Elektronik, Mode). Berkat
hat sechs Zustands-Slugs und keinen Satz dazu, was „Sehr gut" heißt — bei einem
Privatverkauf ohne Gewährleistung ist genau diese Angabe das, woran der
Verkäufer gemessen wird. Der Composer sagt das sogar, liefert aber keinen Maßstab.

## 4. ⚠️ Der Satz, der wehtut

> *„Most buyers come to Whatnot expecting a live show, so visibility for still
> listings can lag."*

Whatnot macht 8 Mrd. $ GMV, hat 20 Mio. neue Konten im Jahr und seit Juli 2026
eine zugekaufte KI-Empfehlungsmaschine — und schafft es **trotzdem nicht**, das
stille Regal gut sichtbar zu machen. Berkats gesamte Marktplatz-Wette liegt auf
genau diesem Regal, begründet mit „94 % der Zeit sendet niemand".

Das entwertet die Wette nicht, aber es verschiebt sie. Der Unterschied ist real:
Bei Whatnot **konkurriert** das stille Regal mit hunderten laufenden Shows um
dieselbe Aufmerksamkeit. Bei Berkat gibt es diese Konkurrenz nicht — es gibt
gar keine Shows. Das Regal ist hier nicht die zweite Wahl, sondern die einzige.

**Die Lehre bleibt: Ein Regal erzeugt keine Nachfrage.** Es hält Nachfrage, die
schon da ist. Bei Whatnot kommt sie aus dem Live-Feed. Bei Berkat muss sie von
außen kommen, und dafür gibt es genau zwei gebaute Werkzeuge: den **Sendeplan**
(Erinnerung an Follower) und den **geteilten Artikel-Link** (WhatsApp-Gruppen,
seit 18.08. draußen). Der Link ist das erste Werkzeug, das Nachfrage *holt*
statt sie umzuverteilen — und damit wichtiger, als seine Größe vermuten lässt.

## 5. Korrektur einer eigenen Empfehlung

Am 18.08.2026 stand in einer Shop-Analyse: *„Was ich ausdrücklich NICHT bauen
würde: … strukturierter Preisvorschlag."* Begründet war das mit der
Angebotszahl — es liegen zwei Artikel in der Datenbank.

**Das war der falsche Maßstab.** Der Preisvorschlag ist keine Skalen-Funktion,
sondern eine **Kultur**-Funktion: Handeln ist in dieser Community und auf
Kleinanzeigen die Norm, nicht die Ausnahme. Und Berkat hat den Weg dafür bereits
halb gebaut — der „Nachricht"-Knopf am Privatangebot ist genau das, nur
unstrukturiert. Ein Vorschlag mit Betrag ist derselbe Weg mit Zahl statt
Fließtext, plus einem Zustand, den beide Seiten sehen.

Whatnot führt ihn als Schalter je Angebot: annehmen, kontern, ablehnen.

## Quellen (Recherche 18.08.2026)

- [Create product listings](https://help.whatnot.com/hc/en-us/articles/9779149424269-How-to-list-products-on-Whatnot) · [Adding and Managing Items in your Profile Shop](https://help.whatnot.com/hc/en-us/articles/9779149424269-Adding-and-Managing-Items-in-your-Profile-Shop)
- [Receive and respond to offers on Buy It Now products](https://help.whatnot.com/hc/en-us/articles/14578719543821-Receive-and-respond-to-offers-on-Buy-It-Now-products)
- [Whatnot Listing Guidelines](https://help.whatnot.com/hc/en-us/articles/360061195612-Whatnot-Listing-Guidelines) · [Listing conditions and expectations](https://help.whatnot.com/hc/en-us/articles/30211858455437-Listing-conditions-and-expectations-on-Whatnot)
- [Variants for Sellers](https://help.whatnot.com/hc/en-us/articles/34889029544845-Variants-for-Sellers)
- [Inside the Whatnot Seller Hub 2026 — CLOSO](https://closo.co/blogs/platform-specific-guides/inside-the-whatnot-seller-hub-a-survival-guide-for-live-auctions-in-2026)
- [How does Whatnot work — nifty.ai](https://nifty.ai/post/how-does-whatnot-work) · [Whatnot app guide — Vendoo](https://blog.vendoo.co/whatnot-app-a-guide-for-sellers-and-buyers)

---
---

# Dritte Analyse: die deutsche Rechtsmaschine (18.08.2026)

> Beide bisherigen Analysen haben etwas übersehen: **Whatnot ist als
> `Whatnot Europe Ltd.` (Irland, Registernummer 723475) im EU-Markt** und musste
> damit exakt die Probleme lösen, an denen Berkat seit dem 17.08. arbeitet.
> Grundlage ist ihr EU-Vertragswerk, im Volltext gelesen (PDF, Quelle unten).

## 1. Wie sie „privat oder gewerblich" beantworten

Berkat hat sich das selbst hergeleitet und ist bei einer Selbsterklärung
gelandet. Whatnot auch, wörtlich:

> *„Whatnot zeigt über die App an, ob es sich bei den Verkäufern gemäß ihren
> **Selbsterklärungen** um Verbraucher oder um gewerbliche Verkäufer handelt."*

Dasselbe Modell, unabhängig gefunden — eine Bestätigung für `seller_kind`.

Davor steht bei ihnen aber ein Riegel, den Berkat nicht hat:

> *„Verkäufer aus der EU **müssen in der EU für Umsatzsteuerzwecke registriert
> sein**, um auf Whatnot verkaufen zu können."*

⚠️ Zwei Klauseln in EINEM Dokument, die sich reiben: Die eine sieht Verbraucher
als Verkäufer vor, die andere verlangt von jedem EU-Verkäufer eine
USt-Registrierung, die ein Privatmensch nicht hat. Das lässt sich von außen
nicht auflösen, und so zu tun wäre falsch. Die operative Wirkung ist trotzdem
eindeutig: **Der USt-Riegel steht beim Onboarding, die Selbsterklärung erst
danach.**

**Berkat geht bewusst den anderen Weg** (Zaur am 17.08.: „nicht nur
Gewerbetreibende, sondern auch private Leute"). Das ist der schwerere, und
Whatnot hat ihn mit acht Milliarden Umsatz nicht genommen. Kein Argument
dagegen — aber es heißt: **Für einen Marktplatz mit echten Privatverkäufern gibt
es hier kein Vorbild zum Abschauen.**

## 2. Der Geldweg — eine Konstruktion, die Berkat nicht kennt

> *„Jeder Verkäufer ernennt hiermit Whatnot zu seinem **Inkassobeauftragten** für
> den begrenzten Zweck, Zahlungen von Käufern entgegenzunehmen … jede Zahlung,
> die Whatnot im Namen des Verkäufers erhält, [gilt] als direkte Zahlung an den
> Verkäufer. … Mit der Zahlung an Whatnot erlischt die Zahlungsverpflichtung des
> Käufers gegenüber dem Verkäufer."*

Das ist die klassische Antwort auf genau das ZAG-Problem, um das Berkats
`checkout_enabled` gebaut ist (Analyse A1, Übergabe Abschnitt 22): Wer als
Inkassobeauftragter im Namen des Verkäufers kassiert, erbringt kein
Zahlungsgeschäft im eigenen Namen, und der Käufer ist mit der Zahlung an die
Plattform befreit.

⚠️ **Im Verkäufer-Absatz steht allerdings: „Dieser eingeschränkte Auftrag gilt
nur für Verkäufer, die eine ‚United States person' sind."** Im käuferseitigen
Absatz derselben Klausel fehlt die Einschränkung. Das sieht nach einer unsauber
lokalisierten US-Fassung aus.

**Für Berkat heißt das: Die Konstruktion ist bekannt und gängig, ihre deutsche
Wirksamkeit ist aus diesem Dokument aber NICHT ableitbar.** Das gehört einem
Anwalt vorgelegt. Der gebaute Weg (Stripe Connect) bleibt der sichere.

## 3. Was passiert, wenn es schiefgeht

| Whatnot | Berkat |
|---|---|
| **Der Verkäufer trägt die Kosten der Rückerstattung**, ausdrücklich | ungeregelt |
| **Vertragsstrafe 15 % der Transaktion, mindestens 12 €** | — |
| Auszahlung **bis 30 Tage** einbehalten | — |
| Artikel entfernen, Transaktionen annullieren, Kauf/Verkauf sperren | nur Sperren |
| Rückbuchungs- und Ersatzkosten dem Verkäufer belasten | — |
| Whatnot ist **nicht Partei** und verkauft selbst keine Waren | Berkat **ist** heute selbst Verkäufer |

Die letzte Zeile ist die wichtigste und wird leicht übersehen: Solange der
Betreiber selbst verkauft, ist Berkat **Verkäufer und Plattform in einer
Person** — eine ganz andere Rechtslage als Whatnots reine Vermittlerrolle. Die
Trennung entsteht erst mit dem ersten Drittverkäufer, und **erst dann** brauchen
die Zeilen darüber ein Gegenstück.

## 4. Der Vertragsschluss steht bei ihnen im Text

> *„Die Abgabe eines Gebots ist bindend und führt, wenn das Gebot bei Ablauf der
> Angebotsdauer das Höchstgebot ist, **direkt zum Abschluss eines
> Kaufvertrags**."*

Und zum Anti-Snipe, feiner als unsere Umsetzung: Bei ≤ 10 Sekunden springt der
Zähler auf **eine vom Verkäufer festzulegende Zeit**; daneben gibt es „Sudden
Death" ganz ohne Verlängerung. Berkat hat `extendSeconds: 10` fest verdrahtet
(`theme/tokens.ts`).

## 5. Zwei Kleinigkeiten mit Folgen

- **Preise sind brutto:** *„Die Preise für Inlandskäufe sind in der EU inklusive
  Umsatzsteuer."* Berkat rechnet in Cent und sagt zur Steuer nichts.
- **Einfuhrumsatzsteuer unter 150 €** zieht Whatnot selbst ein (IOSS). Das ist
  die steuerliche Maschinerie hinter dem Geographie-Trick aus der ersten
  Analyse — und der Bauplan, sobald Berkat über Grenzen verkauft (DE/AT/TR/FR/RU).

## 6. Was daraus folgt

1. **AGB, Widerrufsbelehrung und ein Text zum Vertragsschluss** auf
   `berkat-web`. Dort standen bis zum 18.08.2026 nur Impressum und Datenschutz —
   bei einer Auktion, in der ein Gebot bindend ist, die klaffendste Lücke.
2. **Anti-Snipe-Zeit vom Verkäufer wählbar**, plus „Sudden Death". Klein, und es
   macht aus einer Hausregel eine Entscheidung.
3. **Vor dem ersten Drittverkäufer** die Durchsetzungsseite: wer trägt die
   Rückerstattung, was passiert bei Nichtlieferung.
4. **Nicht kopieren:** den USt-Riegel am Eingang. Er würde genau die
   Privatverkäufer aussperren, die Berkats erklärter Zweck sind.

Was diese Analyse **nicht** kann: sagen, ob Whatnots Inkasso-Konstruktion in
Deutschland trägt. Das ist eine Anwaltsfrage. Hier steht nur, was sie ihren
Nutzern vorlegen.

## Quelle

- [Whatnot Servicebedingungen für Nutzer in der EU oder im Vereinigten Königreich](https://whatnot.pactsafe.io/versions/67991d177a099bf2be49a58f.pdf) — PDF, im Volltext gelesen (`pdftotext -layout`), 18.08.2026

---
---

# Vierte Analyse: das Design (18.08.2026)

> Die drei Analysen davor haben Strategie, Sortiment und Recht seziert und dabei
> nie gefragt, **wie das Ding eigentlich aussieht**. Diese hier misst es nach:
> Farben, Schriftgrößen, Radien und Trefferflächen am laufenden Objekt
> ausgelesen, nicht geschätzt. Methode und Grenzen stehen am Ende — sie sind für
> die Bewertung wichtiger als üblich.

## 0. Der Befund in einem Satz

Whatnots Oberfläche ist **absichtlich unauffällig** — eine graue, dichte,
gleichförmige Liste, deren einzige Aufgabe es ist, hinter der Ware zu
verschwinden. Die Farbe im Bild kommt von den Verkäufern, nicht von der
Plattform.

## 1. Die Messung

Am 18.08.2026 im Browse-Feed und in zwei laufenden Live-Räumen ausgelesen:

| | Wert | Häufigkeit |
|---|---|---|
| Schrift | `system-ui` — **kein eigener Font** | durchgehend |
| Schriftgrößen | 11 / 12 / 13 / 14 px | 12 px 106×, 13 px 53×, 14 px 51× |
| Größte Schrift | **24 px, genau einmal** pro Seite | 1× |
| Schriftgewicht | **600** | 160× — gegen 63× Regular, 23× Bold |
| Radius | **8 px**, sonst Pille | 58× / 36× |
| Grundfläche | Weiß, Grau `#F3F3F3` | 57× |
| Signalgelb | `#FFE414` | **2–3× pro Seite** |
| Rot | `#ED2C28` | 28–31× |
| Kaufknopf | 188 × 36 px, Fläche `rgba(0,0,0,0.05)` | 25× in einer Liste |
| Video | 451 × 801 = **9:16, auch auf 1440 px Desktop** | |

Drei Zahlen daraus tragen die ganze Analyse:

**Eine Schriftgröße.** 12 bis 14 px machen praktisch alles. Es gibt genau *eine*
große Zeile pro Seite. Die Hierarchie entsteht nicht durch Größe.

**Ein Gewicht.** 600 ist nicht die Betonung, sondern die **Grundschrift** — es
kommt 2,5-mal häufiger vor als Regular. Wenn fast alles halbfett ist, betont
Fettschrift nichts mehr. Die Hierarchie entsteht also auch nicht durch Gewicht.

**Sie entsteht durch Farbe und Position** — und zwar sehr sparsam: Gelb erscheint
zwei- bis dreimal auf einer ganzen Seite.

## 2. Der wichtigste Fund: der Kaufknopf ist grau

In einer Show mit 25 Artikeln steht neben jedem ein Knopf. Er ist
**`rgba(0,0,0,0.05)`** — ein Grau, das man kaum sieht. Das Signalgelb ist
daneben für **„Folgen"** reserviert (85 × 24 px).

Whatnot färbt also nicht den Kauf, sondern die **Beziehung**.

Der Grund ist arithmetisch: 25 gelbe Knöpfe untereinander sind keine
Hervorhebung mehr, sondern eine Wand. Eine Signalfarbe funktioniert nur, solange
sie selten ist. Wer sie an jede Zeile schreibt, hat sie abgeschafft.

⚠️ **Das steht in direktem Widerspruch zu Berkats Regel** „Gold ist der Kauf"
(`theme/tokens.ts`). Der Widerspruch löst sich über den Ort auf, und die
Auflösung ist die eigentliche Lehre:

| Ort | Wie viele Kaufwege gleichzeitig? | Farbe |
|---|---|---|
| Live-Raum | **einer** — es läuft genau ein Artikel | Gold ist richtig |
| Artikelseite | **einer** — die Leiste unten | Gold ist richtig |
| Regal, Kategorie, Suchergebnis | **viele nebeneinander** | Gold wäre eine Wand |

Berkat kommt damit heute durch, weil auf den Karten im Regal **gar kein
Kaufknopf** sitzt — man tippt die Karte an, gekauft wird auf der Artikelseite.
Das ist unbeabsichtigt genau die richtige Lösung. **Sie darf nicht kippen:** Wer
später „Sofortkauf" direkt auf die Regal-Karte legt, muss ihn grau machen, nicht
gold. Sonst ist Gold nach dem ersten vollen Regal keine Auszeichnung mehr.

## 3. Die drei Regeln, die dahinterstehen

**Die Plattform tritt zurück, die Ware schreit.** Whatnots UI ist grau und
neutral — die Show-Cover dagegen sind selbstgemachte Poster im
YouTube-Thumbnail-Stil: Versalien, Rahmen, Knallfarben, mit der Mechanik im Bild
(„$1 DOLLAR STARTS", „3 FREE GIVEAWAYS ALL SHOW", „500 MASSIVE SLABS"). Der
Kontrast ist die Gestaltung. Eine bunte Plattform plus bunte Cover ergäbe Brei.

**Die Person steht über der Ware.** Auf jeder Show-Karte im Feed steht der
Verkäufer mit Avatar und Namen **über** dem Cover, nicht darunter. Auf der Karte
steht **kein Preis und kein Produkt** — man wählt den Abend, nicht den Artikel.

**Wärme statt Bestand.** Die Kategorie-Kacheln zeigen „15.216 Zuschauer", nicht
„412 Artikel". Gezählt wird, wo etwas los ist.

## 4. Die mobile Wand — der schärfste Unterschied zur Erwartung

Auf dem Telefon zeigt `whatnot.com` **keinen Stream**. Statt des Live-Raums
erscheint eine dunkle Seite mit einer Verkäufer-Karte:

```
        [Avatar]
         ★ 5
      blairscloset
  5030 Follower | 6546 Artikel verkauft
 „Nimm an dieser Live-Show teil, um zu bieten,
  zu kaufen, zu chatten …"
     [ Weiter auf Whatnot ]   ← gelb, volle Breite
```

Auf dem Desktop läuft derselbe Stream ohne Anmeldung komplett durch. Die
Trennung ist also keine Rechte-, sondern eine **Geräte**-Entscheidung: Wer ein
Telefon hat, soll die App installieren, weil dort die Push-Berechtigung liegt.

Bemerkenswert ist, **womit** diese Wand überzeugt: drei Zahlen — Sterne,
Follower, verkaufte Artikel. Kein Produktbild, kein Preis, kein Sortiment. Genau
die Stelle, an der Berkats Bürgen-System (Übergabe § 15) das kulturell stärkere
Argument hat: „Wer bürgt für ihn" schlägt „6546 Artikel verkauft" in einer
Gemeinschaft, in der man sich kennt.

Nebenbefund gegenüber der ersten Analyse (13.08.): Der Login-Wall ist schärfer
geworden. Er stand damals „exakt an einer Stelle" — beim Mitmachen. Heute
springt im Desktop-Raum nach etwa einer halben Minute Zuschauen ein Modal auf
(„Mach mit bei Whatnot!"), zusätzlich zum Balken im Video.

## 5. Was Whatnot bewusst NICHT tut

- **Keinen eigenen Font.** 20 Mrd. $ Bewertung, `system-ui`. Berkat macht es
  genauso — das ist keine Sparmaßnahme, sondern die Entscheidung, die
  Ladezeit und Plattform-Vertrautheit über Markenschrift zu stellen.
- **Keine großen Überschriften.** Eine 24-px-Zeile pro Seite, sonst nichts über
  16 px.
- **Keine Bewegung in der Fläche.** Die einzige Animation ist das Video selbst.
- **Keine zweite Radius-Stufe.** 8 px oder Pille, nichts dazwischen.

## 6. Wo Berkat abweicht — und ob das ein Fehler ist

| | Whatnot | Berkat | Urteil |
|---|---|---|---|
| Grundfläche | Weiß/Grau, neutral | Sand `#FAF7F2`, warm | **Berkats Weg.** Das ist die „Basar statt Jahrmarkt"-Entscheidung und der einzige Punkt, an dem die Plattform sichtbar sein soll. |
| Radien | 8 px + Pille | 8/12/16/26 + Pille | Whatnot hat recht. Vier Stufen sind drei mehr, als jemand unterscheiden kann. |
| Schriftgrößen | 11–14 px, eine 24er | 11–22 px, viele Stufen | Whatnot hat recht — aber Berkat ist eine Telefon-App, 12 px wären dort zu klein. Die Lehre ist die **Anzahl** der Stufen, nicht ihr Wert. |
| Kategorie-Zähler | Zuschauer | „1 kaufbar", leer wenn nichts da | **Zu ändern.** Siehe unten. |
| Kaufknopf im Raster | grau, auf der Karte | keiner, Karte führt zur Seite | Berkats Lösung ist besser — solange sie so bleibt. |
| Cover | Verkäufer-Poster, schreiend | Foto, quadratisch | Offen. Berkat hat keine Cover-Kultur, und sie lässt sich nicht verordnen. |

**Der eine Punkt, der sich lohnt: die Kategorie-Kacheln.** Berkat zeigt heute
„1 kaufbar" — und bei leeren Kategorien gar nichts. Zwölf Kacheln, von denen
zehn keinen Zähler tragen, lesen sich wie ein Fehler, nicht wie ein Angebot.
Whatnots Zahl beantwortet dagegen „wo ist was los". Berkat kann das nicht
kopieren (es sind keine Zuschauer da), aber die Frage lässt sich anders
beantworten — etwa mit dem nächsten Termin in dieser Kategorie („Do 20:00")
statt mit einer Bestandszahl. Der Sendeplan ist gebaut, die Daten liegen vor.

## 7. Methode und Grenzen

Gelesen wurden `whatnot.com/de-DE/browse`, die Kategorie-Seiten Frauenmode und
Trading Card Games sowie drei Live-Räume (`blairscloset`, `legacy_auction_house`,
`crazy4tcg`), im Browser bei 1440 × 900 und 375 × 812. Farben, Schriftgrößen,
Gewichte, Radien und Knopfmaße wurden per `getComputedStyle` über alle sichtbaren
Elemente ausgezählt, nicht nach Augenmaß geschätzt.

Drei Einschränkungen, die das Ergebnis begrenzen:

1. **Es ist die Web-Fassung, nicht die App.** Whatnots eigentliches Produkt ist
   die native App; die Startseite ist ein reiner Download-Funnel. Für Berkat,
   das selbst eine App ist, ist das der falsche Vergleichsgegenstand — nur eben
   der einzige zugängliche.
2. **Kein Gebots-Overlay gesehen.** In keinem der drei Räume lief während des
   Zuschauens eine Auktion. Ausgerechnet der Bildschirm, der Berkats Kern ist,
   fehlt in dieser Analyse.
3. **Kein Konto.** Alles ohne Anmeldung, also ohne Warenkorb, Kasse,
   Verkäufer-Ansicht und ohne die eingeloggte Fassung des Live-Raums.

## Quelle

- Eigene Messung: `whatnot.com` — Browse-Feed, Kategorien Frauenmode und Trading
  Card Games, Live-Räume `blairscloset`, `legacy_auction_house`, `crazy4tcg`;
  `getComputedStyle`-Auszählung bei 1440 × 900 und 375 × 812, 18.08.2026

---

## Nachtrag zur vierten Analyse: die App (18.08.2026, spät)

⚠️ **Die Analyse oben hat die Web-Fassung vermessen. Das war die falsche Quelle.** Whatnots
Produkt ist die App; die Website ist ein Download-Funnel mit eigenem, viel konventionellerem
Layout. Was unten steht, korrigiert und ergänzt sie — Grundlage sind die offiziellen
Store-Screenshots (DE) und die Produktbilder aus Whatnots eigenem Blog.

### Woher man App-Bilder bekommt, ohne die App zu installieren

```bash
curl -s "https://itunes.apple.com/search?term=whatnot&entity=software&country=de&limit=1" \
  | python3 -c "import json,sys; [print(u) for u in json.load(sys.stdin)['results'][0]['screenshotUrls']]"
```

Die URLs enden auf `/320x480bb.jpg` — durch `/900x0w.jpg` ersetzen und man bekommt sie in voller
Breite. Play Store: Paketname ist `com.whatnot_mobile` (nicht `com.whatnot*`, das 404t). Der
Produktblog `blog.teamwhatnot.com` liefert die Feed-Bilder in Presse-Qualität, hell **und** dunkel.

### Der Live-Raum ist randloses Vollbild

Kein Kasten, keine Spalten, kein schwarzer Rahmen — das Video füllt den Bildschirm, und **alles
liegt als Overlay darauf**:

| Wo | Was |
|---|---|
| oben links | Avatar, Name, ★-Bewertung |
| oben rechts | rotes Zuschauer-Badge, Chevron zum Schließen |
| rechte Kante | Icon-Spalte **mit Beschriftung**: Ton, Teilen, Zahlung, Shop (mit Artikelzahl) |
| links unten | Chat — **ohne Kasten, ohne Hintergrund**, nur Text mit Schatten, runde Avatare |
| darüber | Zuschlag-Meldung als farbige Zeile („… hat den Zuschlag!") |
| unten | Artikelzeile: Bild, Titel, „1 Verfügbar · Zustand neu mit Etikett", Preis, Countdown, Versandkosten |
| ganz unten | **gelber Knopf über die volle Breite: „Biete 40 € ≫"** |

Der Gebots-Knopf ist gelb und dominant — das **bestätigt** die Ortsregel aus Abschnitt 2 oben,
statt sie zu widerlegen: Signalfarbe dort, wo es genau einen Kaufweg gibt; Grau im Regal, wo
fünfundzwanzig nebeneinanderliegen.

### Die Kategorie-Leiste im Feed — der schärfste Unterschied zu Berkat

Whatnots Leiste besteht aus kleinen **hochformatigen** Kacheln, die waagerecht scrollen. Jede
trägt den Namen oben und darunter ein **freigestelltes Objekt auf einem eigenen Farbverlauf** —
Sneaker auf Beige, Pullover auf Blau, Pflanze auf Lila, Tasche auf Braun. Zwei Sonderfälle:
„For You" ist gelb und zeigt **den eigenen Avatar**, „Following" ein gelbes Herz.

**Der inhaltliche Unterschied ist wichtiger als der optische:** Whatnots Leiste ist eine
**Entdeckungs**-Leiste — sie zeigt alle Kategorien, immer, unabhängig davon, ob dort gerade jemand
sendet. Berkats `CategoryRail` ist ein **Filter für laufende Shows**: Sie wird aus `shows`
aufgebaut und ist deshalb genau dann leer, wenn ohnehin nichts läuft — also fast immer. Am
18.08.2026 wurde sie deshalb ausgeblendet, sobald sie nur noch „Für dich" enthielt. Das war
richtig gegen das leere Gerüst, behebt aber nur das Symptom: **Die Leiste beantwortet die falsche
Frage.**

### Show-Karten im Feed

Zwei Spalten, hochformatig, **Verkäufername mit Avatar über der Karte** — das hat Berkat schon,
samt Begründung im Quelltext („bei Live-Shopping kauft man den Menschen, nicht das Bild"). Oben
links auf dem Bild ein rotes Badge `Live 143`, das Zustand und Zahl in einem Element führt.

### Was Berkat bewusst anders lässt

Whatnots App hat einen **Dunkelmodus** (der Blog zeigt beide Fassungen nebeneinander). Berkat hat
bewusst keinen — zwei feste Flächen, `ui` hell und `stage` dunkel, damit heller Text auf heller
Fläche strukturell unmöglich ist (Übergabe, Abschnitt 4). Das bleibt richtig; es ist eine
Entscheidung, keine Lücke.

### Was daraus folgt

1. **Kategorie-Kacheln mit freigestellten Produktfotos** statt Konturicons — und zwar als
   Entdeckungs-Leiste, die auch ohne laufende Show trägt. Das ist der größte sichtbare Abstand.
   Freistellen genügt, 3D-Renderings sind es bei Whatnot nur teilweise.
2. **Live-Raum gegen die App halten** — Vollbild, Chat ohne Kasten, beschriftete Icon-Spalte,
   Gebots-Knopf über die volle Breite. Steht noch aus, weil dafür eine laufende Show nötig ist.
3. **Ein Teil des Abstands ist Inhalt, nicht Gestaltung.** Whatnots Bilder zeigen Models,
   Studiolicht und volle Regale; Berkats Testdaten zeigen ein Strandfoto und ein leeres Feld. Wer
   das Design an diesen Bildern misst, optimiert am falschen Ende.

## Quellen

- Offizielle App-Screenshots (DE), iTunes Search API, App-ID `1488269261`, 18.08.2026
- Google Play, Paket `com.whatnot_mobile`
- `blog.teamwhatnot.com` — Produktbilder „Explore Tiles" und Versand-Ansicht, hell und dunkel

---

## Fünfte Analyse: die übrigen Flächen der App (18.08.2026, nachts)

Quelle sind Whatnots eigene Produktbilder aus dem Blog (`blog.teamwhatnot.com`, Artikel
`freshlook`, `sellerhome`, `built-for-live-listings`, `capture-buyer-intent-and-drive-sales`) —
Presse-Qualität, teils mit Vorher/Nachher. Google Bilder war nicht nutzbar: Die Bildersuche
verlangt ein CAPTCHA, und das wird nicht gelöst. Der Umweg über Blog und Stores ist ohnehin die
bessere Quelle, weil dort die Bildschirme unverkleinert und offiziell stehen.

### Der Feed — und was auf der Show-Karte steht

Das wichtigste Bild (`PinnedListing_2`) zeigt den Feed mit vollen Karten:

| Element | Whatnot | Berkat |
|---|---|---|
| Verkäufer mit Avatar über der Karte | ✔ | ✔ |
| rotes Live-Badge mit Zuschauerzahl | `Live 2.1k` | `Live · 23` ✔ |
| **laufender Artikel auf der Karte** | Name, Preis, **roter Countdown `00:08`** | ✔ `LivePreview` |
| Titel unter der Karte, zwei Zeilen | ✔ | ✔ |
| Kategorie darunter als Link | blau | ✔ `cardCategory` |
| Cover | verkäufergemachtes Poster | Foto |

**Das ist der überraschendste Befund der ganzen Design-Arbeit: Bei der Feed-Karte ist Berkat
gleichauf — an einer Stelle sogar reicher.** `LivePreview` kennt drei Zustände (läuft / verkauft /
als Nächstes) und lässt den Preis hochzählen; Whatnots Karte zeigt nur den laufenden Artikel. Wer
also findet, die App „komme nicht ran", misst nicht diese Fläche, sondern die Bilder darauf.

### Der Shop im Live-Raum — hier liegt echter Abstand

`Before+After.png` zeigt Whatnots eigenen Umbau. Die Liste hinter dem „Shop"-Knopf hat:

- **eine Suche über die Artikel der Show** („Search shop…")
- **Filterchips**: `Sort`, `Auction`, `Buy Now`, `Sold` — man kann also nur die Auktionen sehen
- **Attribute als Chips** je Zeile: `Brands: Nike, New Balance +4` · `Sizes: 7M, 7.5M, 8M +8` ·
  `Condition: New, New w/Tag`
- **eine Glocke je Artikel** — „sag mir Bescheid, wenn der drankommt"
- **das Video läuft klein weiter**, während die Liste offen ist

Der Vorher-Zustand ist lehrreich: graue Platzhalter, „Random Pull A/B/C/D", keine Bilder. Whatnot
hatte dasselbe Problem wie Berkat heute — Artikel entstehen in Eile — und hat es nicht durch
Gestaltung gelöst, sondern durch **Vorbereitung vor der Show** (Abschnitt 26 der Übergabe).

### Verkäufer-Profil

`BIN.png` zeigt die Reiter `Shop | Shows | Reviews` — Berkat hat sie (Übergabe 18), dort heißen sie
Angebote / Shows / Bewertungen. Neu für Berkat wären:

- Suche **im** Shop eines Verkäufers plus Filter `Sort`, `Buy it Now`, `Category`
- `Multiple Options` statt eines Preises, Knopf **„Select Options"** — das ist die Varianten-Frage
  aus Abschnitt 26, hier als fertige Lösung: Varianten machen aus dem Kaufknopf einen Auswahlknopf.
- Ein **Produktvideo im Vollbild** mit fester Kaufleiste unten, außerhalb jeder Sendung. Das ist
  die Nicht-Live-Seite aus der zweiten Analyse, konsequent zu Ende gebaut.

### Kleinigkeiten, die auffallen

- Der **Konto-Reiter zeigt den eigenen Avatar**, kein Symbol. Berkat hat dort `CircleUser`.
  Winzig, aber es ist der einzige Reiter, der von *mir* handelt.
- Neue Funktionen werden über ein **Erklär-Blatt** eingeführt (Bild, Titel, zwei Sätze, ein Knopf)
  — z. B. „A Week of Hearts" für die Herz-Geste, die Berkat auch hat.
- Die Zuschauerzahl wird **abgekürzt** (`2.1k`), Berkat schreibt sie aus. Ab vierstellig lohnt das.

### Was daraus folgt — ehrlich sortiert

**Kein Handlungsbedarf** (Berkat ist gleichauf): Feed-Karte, Live-Badge, laufender Artikel mit
Countdown, Kategorie auf der Karte, Profil-Reiter, fünf Reiter unten, Filterpillen im
Kategorien-Reiter.

**Echte Lücken, nach Nutzen sortiert:**

1. **Filter und Suche im Regal** — Berkats `/shop` ist eine flache Liste ohne jede Sortierung. Bei
   zwei Artikeln egal, ab fünfzig unbrauchbar. Whatnots Chips (`Auktion`, `Sofortkauf`, `Verkauft`,
   `Sortierung`) sind die naheliegende Vorlage und brauchen keine Migration.
2. **Artikel vor der Show vorbereiten** — steht als größte Lücke schon in Übergabe 26. Whatnots
   Vorher/Nachher belegt, dass sie dasselbe Problem hatten.
3. **Varianten** (Größe, Farbe) mit „Optionen wählen" statt Kaufknopf — für Abaya, Hijab, Schuhe
   der Normalfall, nicht die Ausnahme.
4. **Attribute als Chips** (Marke, Größe) neben dem Zustand, den Berkat schon hat.
5. **Der eigene Avatar im Konto-Reiter** — eine Zeile, rein kosmetisch.

**Nicht übernehmen:** die abgekürzte Zuschauerzahl (bei zweistelligen Zahlen wäre `2.1k` eine
Behauptung), und die Poster-Cover lassen sich nicht verordnen — sie entstehen, wenn Verkäufer
merken, dass es sich lohnt.

## Quellen

- `blog.teamwhatnot.com/canada-blog/` — `built-for-live-listings` (Vorher/Nachher der Shop-Liste),
  `capture-buyer-intent-and-drive-sales` (angepinnter Artikel im Feed), `sellerhome`, `freshlook`;
  Bilder über `?format=1500w`, 18.08.2026

---

## Sechste Analyse: der Verkäufer-Bereich (19.08.2026)

Quelle: `blog.teamwhatnot.com/unitedstates/sellerhome`, offizielle Produktbilder.

### Whatnots „Seller Hub" ist ein ÜBERBLICK, kein Formular

```
Seller Hub                                    ☰
┌──────────────────┐ ┌──────────────────┐
│ Create a Product │ │ Schedule a Show  │     ← zwei Einstiege, mehr nicht
└──────────────────┘ └──────────────────┘

Shipments
  Ready for Dropoff · 2 due tomorrow      11 ›

Account Health                          View All
  On-Time Shipment  Fulfillment Success  Policy
  100 %             100 %                Excellent

Upcoming Shows                          View All
  [Today 6:00PM 🔖24] [4/2 6:00PM 🔖24] …
```

**Die beiden Kacheln oben sind nur Türen.** Das Anlegen eines Produkts und das Planen einer Show
passieren auf eigenen Bildschirmen. Der Hub selbst beantwortet eine andere Frage: **„Wie läuft mein
Geschäft?"** — Sendungen mit Frist, drei Kennzahlen, die nächsten Termine.

### Berkats Verkaufen-Reiter ist das Formular

| | |
|---|---|
| 1 | „Deine ersten Schritte" — Fortschrittsbalken, vier Zeilen |
| 2 | **„Mach die Show auf"** — Titelfeld, großer Cover-Wähler, Kategorie-Chips, Erklärtext, „Show starten" |
| 3 | **„Nächsten Termin ankündigen"** — Bild + Titel, zwei Erklärtexte, Wann-Zeile, „Ankündigen" |
| 4 | „Bestellungen · 3 zu packen" / „Dein Regal · 9 kaufbar" |

Zwei **volle Formulare** direkt untereinander, zusammen anderthalb Bildschirmhöhen. Das ist die
eigentliche Antwort auf Zaurs Kritik vom 18.08. („sehr viele Auswahlfelder, dadurch wird die Seite
sehr lang und unübersichtlich") — **nicht die Kacheln im Sendeplan waren das Problem**, die sind
seit Abschnitt 27 im Blatt. Das Problem ist, dass die Übersichtsseite zwei Formulare IST.

Verschärfend: Die beiden Formulare sehen fast gleich aus — Bild links, Titel rechts, Knopf unten.
Der Unterschied ist allein „jetzt" gegen „später". Wer den Reiter zum ersten Mal öffnet, sieht
zweimal dasselbe und muss den Unterschied aus den Überschriften erschließen.

### Was Berkat schon hat — und zwar gleichwertig

Das Verkäufer-**Profil** ist praktisch deckungsgleich: drei Statistik-Kacheln (Bewertung,
Versandzeit, Verkäufe), Follower-Zeile, Bio, „Message" und „Tip Me" nebeneinander, Reiter
`Shop | Shows | Reviews`. Berkat hat dieselbe Anordnung — plus die Bürgen, die Whatnot fehlen.

### Zwei Dinge, die Whatnot dort hat und Berkat nicht

1. **Account Health.** Drei Zahlen: pünktliche Sendungen, erfolgreiche Abwicklung,
   Richtlinien-Stand. Das ist Verkäufer-**Führung** — es sagt, woran man gemessen wird, bevor
   jemand sich beschwert. Berkat hat nichts davon.
2. **Die Lesezeichen-Zahl auf Termin-Karten** (`🔖 24`). Sie zeigt dem Verkäufer, **wie viele
   Menschen für diesen Termin erinnert werden.** Das ist das stärkste Motivations-Signal im ganzen
   Hub: Es macht aus einer Ankündigung eine Erwartung. Berkats Sendeplan zeigt Termine ohne diese
   Zahl — dabei liegt sie in `scheduled_lives` bereits vor (die Erinnerungen werden ja verschickt).

### Nebenbefund: das Gebots-UI, endlich gesehen

Im selben Bild ein laufender Live-Raum mit Auktion. Unten:

```
[🚌] No Cancellations!! #9        $16
     $5.25 Shipping + Taxes    00:01 ⟵ rot
  ( Custom )  [ Bid: $16 ≫ ]  ⟵ gelb, breit
```

**Zwei Knöpfe: ein Schnellgebot zum nächsten Schritt und „Custom" für einen eigenen Betrag.** Der
Countdown steht klein an der Artikelzeile, nicht groß im Bild. Berkat löst das mit einer Ziehbahn
(bewusst, siehe Übergabe: „Ein Bildschirm, auf dem Tippen die normale Geste ist, darf keinen Kauf
mit demselben Tippen auslösen") — die Entscheidung bleibt richtig, aber der zweite Weg für einen
**eigenen Betrag** fehlt bei Berkat.

Außerdem im Bild: „Watch to earn 00:36" (Zuschauen wird belohnt) und „Show Notes". Beides bewusst
nicht für Berkat — das erste ist eine Aufmerksamkeits-Prämie, die zur ethischen Linie in der
Übergabe (§ Design-Gesetz 4) nicht passt.

### Was daraus für den Verkaufen-Reiter folgt

1. **Die zwei Formulare hinter Einstiege legen.** Der Reiter zeigt dann: was ansteht (Bestellungen,
   Regal), was kommt (Termine), und zwei Knöpfe „Show starten" / „Termin ankündigen". Das ist
   Whatnots Aufteilung und löst „lang und unübersichtlich" an der Wurzel.
2. **Erklärtexte kürzen.** Drei mehrzeilige Hinweise stehen zwischen den Feldern
   („Ohne Kategorie …", „Wer dir folgt …", „Ohne Bild …"). Sie sind alle richtig — aber sie
   erklären, bevor jemand gefragt hat.
3. **Die Lesezeichen-Zahl an die Termine.** Billig, weil die Daten vorliegen, und es ist das
   Signal, das einen Verkäufer wiederkommen lässt.
4. **Account Health** — erst sinnvoll, wenn es echte Verkäufer mit echten Sendungen gibt. Nicht
   jetzt.

## Quelle

- `blog.teamwhatnot.com/unitedstates/sellerhome` — Seller Hub, Verkäufer-Profil und Live-Raum mit
  laufender Auktion, 19.08.2026
