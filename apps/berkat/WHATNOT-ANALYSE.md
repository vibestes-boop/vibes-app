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

---

## Siebte Analyse: Vorabgebote, der Aktivitäts-Reiter und Scheingebote (19.08.2026)

Quellen: `blog.teamwhatnot.com/unitedstates/new-tools-from-discovery-to-delivery` und
`…/taking-on-shill-bidding`.

### 1. Pre-Bid — bieten, bevor die Show läuft

Die Shop-Liste einer **angekündigten** Show zeigt jeden Artikel mit `Qty`, Preis, „0 bids" und einem
Knopf **„Pre-Bid"**. Daneben eine **Glocke mit Zähler** (`🔔 5`) — so viele Menschen wollen
benachrichtigt werden, wenn dieser Artikel drankommt.

**Das ist der wirtschaftliche Grund hinter der Reservieren-Lücke aus Abschnitt 26.** Artikel vor
der Show anzulegen ist nicht nur Bequemlichkeit für den Verkäufer — es macht die Zeit **vor** der
Sendung verkaufsfähig:

- Der Käufer bindet sich, bevor die Show beginnt. Er hat dann einen Grund, pünktlich zu sein.
- Der Verkäufer sieht an der Glockenzahl, **welcher Artikel Nachfrage hat**, bevor er ihn aufruft —
  er kann die Reihenfolge danach legen.
- Ein Artikel mit Vorabgeboten startet nicht bei null Interesse.

Berkat kann heute nichts davon: `create_live_auction` verlangt eine laufende Session, also gibt es
vor der Show keinen Artikel, auf den man bieten könnte.

### 2. Der Aktivitäts-Reiter: Kontostand statt Ereignis-Strom

Whatnots `Activity` hat vier Unterreiter — **`Purchases | Bids | Offers | Saved`** — und zeigt unter
`Bids` die eigenen laufenden Gebote:

```
[Filter 1] [Upcoming] [All] [Outbid] [Winning]

 [Bild]  🟢 Winning
         90s Single Stitch Keep Swinging Duck…
         Showtime: 4/1, 9:00 PM
         Your Max: $3     Current Bid: $1

 [Bild]  🔴 Outbid
         90s Single Stitch Colt American Firear…
         Showtime: 4/1, 9:00 PM
         Current Bid: $6
```

Berkats Aktivität ist etwas anderes: ein **Ereignis-Strom** („Neu im Angebot", „X ist live",
„jemand hat ins Regal gelegt"). Er beantwortet *was ist passiert*, Whatnots beantwortet *wo stehe
ich*.

⚠️ **Daraus folgt eine konkrete Lücke.** Berkat hat Stellvertreter-Gebote (`set_max_bid`,
`live_auto_bids`, seit `20260813220000`) — aber **keinen Bildschirm, auf dem jemand sieht, wo er
mitbietet.** Wer ein Höchstgebot setzt und die App schließt, hat keinen Ort, an dem steht, ob er
noch führt. Das ist dasselbe Muster wie bei der Beschreibung und beim Impressum: Der Server kann
es, die Oberfläche fragt nie danach.

Die zwei Zeilen, die dort fehlen, sind genau die aus Whatnots Liste: **„Du führst" / „Überboten"**
und **„Dein Höchstgebot: X"**.

Nebenbefund aus dem Test mit Testware: Neun Meldungen „Neu im Angebot" untereinander, alle „vor 10
Std", von zwei Verkäufern. Bei zwanzig Verkäufern wäre der Strom unlesbar. Er braucht früher oder
später eine Bündelung („amir32 hat 6 Artikel eingestellt").

### 3. Scheingebote — was Whatnot tut, und was Berkat hat

Eigener Artikel im Blog (`taking-on-shill-bidding`). Shill Bidding heißt: bieten ohne Kaufabsicht,
nur um den Preis zu treiben — durch den Verkäufer selbst **oder durch Vertraute**.

Whatnots Maßnahmen, soweit sie sie offenlegen (sie sagen ausdrücklich, dass sie nicht alles
verraten):

| | |
|---|---|
| Erkennung | Konto-Informationen, **Geräte-Fingerprints**, Verbindungen zwischen Konten, Bieter- und Stornierungsmuster gegen Normalverhalten, Anomalie-Erkennung in Echtzeit |
| Ausbau | Zahl der Signale zur proaktiven Erkennung **verfünffacht** |
| Sanktion | bis zur dauerhaften Sperrung |
| Ergebnis in sechs Monaten | Shill-Aktivität **−80 %**, Meldungen über verdächtiges Bieten **−45 %**, Trust-&-Safety-Team verdoppelt |

**Berkats Stand:** `place_live_bid` wirft `seller_cannot_bid` — der Verkäufer kann nicht auf seine
eigene Ware bieten, serverseitig geprüft, seit der ersten Migration. Das deckt den **direkten**
Fall ab.

Der Fall über **Vertraute** ist offen: Ein zweites Konto eines Freundes, das den Preis hochtreibt
und am Ende nicht zahlt, wird von nichts erkannt. Was Berkat dagegen strukturell hat, ist das
Bürgen-System — wer bürgt, hängt mit seinem Namen dran — und die Größe: In einer Gemeinschaft, in
der man sich kennt, ist ein Komplize teurer als der Gewinn.

**Kein Handlungsbedarf jetzt**, aber es gehört auf die Liste für den Tag, an dem echtes Geld
fließt. Der billigste erste Schritt wäre nicht Erkennung, sondern eine **Kennzahl**: Wie oft gewinnt
ein Konto und zahlt dann nicht? Das ist eine Abfrage auf `auction_carts`, keine Anomalie-Erkennung.

### Was daraus folgt

1. **Eigene Gebote sichtbar machen** — der kleinste Eingriff mit echtem Nutzen. Die Daten liegen in
   `live_auto_bids` und `live_bids`; es fehlt eine Liste mit „Du führst / Überboten".
2. **Pre-Bid** — hängt an der Reservieren-Lücke (Abschnitt 26) und ist deren eigentliche
   Rechtfertigung. Erst Artikel vor der Show, dann Gebote darauf.
3. **Nicht-Zahler-Quote** als stille Kennzahl, bevor Scheingebote ein Thema werden.

## Quellen

- `blog.teamwhatnot.com/unitedstates/new-tools-from-discovery-to-delivery` (Pre-Bid, Shop-Liste,
  Aktivitäts-Reiter), `…/taking-on-shill-bidding` (Zahlen und Maßnahmen), 19.08.2026

---

## Achte Analyse: die App selbst, aus dem Store (21.08.2026)

### 0. Der Befund in einem Satz

**Berkat ist an sechs von sieben verglichenen Flächen deckungsgleich oder reicher — und hat genau
eine Lücke, die auf Phase 0 einzahlt: Der Verkäufer sieht während seiner Sendung nicht, was sie
einbringt.**

### 1. Die Quelle — und warum nicht Google Bilder

Zaur bat um eine Bildersuche. Der Abschnitt „Nachtrag zur vierten Analyse" hat für genau diese
Frage schon eine bessere Quelle gefunden, und die gilt weiter:

> **Bei einer App ist die Web-Fassung nicht die Quelle.** Die offiziellen Store-Screenshots sind
> kostenlos, offiziell, aktuell und in der Landessprache.

Eine Bildersuche mischt Marketingmaterial, Blog-Aufnahmen und alte Fassungen — man weiß bei keinem
Treffer, von wann er ist. Der Store weiß es:

```bash
curl -s "https://itunes.apple.com/search?term=whatnot&entity=software&country=de&limit=1"
```

**Version 26.34.5, veröffentlicht am 20.08.2026** — also am Tag vor dieser Analyse. Fünf
iPhone-Screenshots, deutsche Fassung. Die Miniaturen kommen als `320x480bb.jpg`; ersetzt man das
im Pfad durch `1000x0w.png`, liefert derselbe Server 1000 × 2173 — groß genug, um Beschriftungen
zu lesen. **Das ist der ganze Trick, und er kostet zwei Befehle.**

### 2. Was deckungsgleich ist — der entlastende Teil

Am Berkat-Quelltext gegengeprüft, nicht geschätzt:

| | Whatnot | Berkat |
|---|---|---|
| Reiter unten | Startseite · Kategorien · Verkaufen · Aktivität · Benutzerkonto | **identisch** |
| Kategorie-Kachel | Name oben, Bild mittig, Zahl unten | identisch |
| Zahl auf der Kachel | „98 Zuschauer" + roter Live-Punkt | identisch |
| Gebots-Knopf | „Biete 40 € »", gelb, volle Breite, Ziehbahn | **„Gebot: 40 €"** — und bei Überbieten **„Kontern: 40 €"**, was Whatnot nicht unterscheidet |
| Icon-Spalte rechts | beschriftet (Ton, Teilen, Zahlung und Versand, Shop) | ebenfalls beschriftet (`railLabel`) |
| Verkauft | Preis + „Verkauft" in Rot | identisch |
| Meta-Zeile am Artikel | „1 Verfügbar · Größe 7 Neu mit Box" | „Gr. 42 · Sehr gut · 28209 Bremen" — zusätzlich **der Ort** |

⚠️ **Zwei vermutete Lücken waren keine.** Ich hatte „Gebots-Knopf nennt den Betrag nicht" und
„Icon-Spalte ohne Beschriftung" auf der Liste; beides steht seit Langem im Code. **Ein Vergleich
gegen die eigene App ist wertlos, wenn man sie aus dem Gedächtnis vergleicht.**

**Und eine offene Frage ist beantwortet:** Whatnots Kategorie-Kacheln tragen **freigestellte
Produktfotos auf hellem Grund** — Jacke, Vase, Sneaker, Spielkonsole. Keine 3D-Renderings. Das
bestätigt die Korrektur aus der Fünften Analyse und ist die billigere Herstellung.

### 3. Der Fund: Der Verkäufer sieht seinen Umsatz während der Sendung

Screenshot 5 zeigt ein Blatt über dem laufenden Video — die Sicht des **Verkäufers**:

```
  € Verkäufe            Bestellungen
    1310 €                 108              ← die Summe in Grün

  Beobachtung | Aktivität
  [Alle] [Auktion] [Geschenk] [Angebote] [Label]

  gardenkid29   5 € Trinkgeld gegeben!          1m
  mistique einen kauf getätigt                  1m   [Bild]
    22 € · Hoya Compacta Rope
  malik93 einen kauf getätigt                   2m   [Bild]
    12 € · Donkey Tail Succulent
```

**Berkat hat davon nichts.** Wer zwei Stunden sendet, weiß am Ende nicht, wie es lief — er müsste
die Sendung verlassen und in „Bestellungen" nachsehen.

**Warum das mehr ist als eine Kennzahl:** Die Sechste Analyse hat „Account Health" abgelehnt, und
das war richtig — drei Kennzahlen über null Vorgänge sind nichts. Das hier ist keine Bilanz,
sondern eine **Rückmeldung im Moment des Tuns**. Design-Gesetz Nr. 1 verlangt, Hochs lauter zu
machen; in Berkat gilt das bisher **nur für Käufer**. Der Mensch, der die Arbeit macht, bekommt
keinen einzigen Peak.

Und genau daran hängt Phase 0. Die Frage dort lautet nicht „funktioniert die Auktion", sondern
**„sendet jemand acht Wochen lang freiwillig weiter"**. Was das entscheidet, ist zu sehen, dass es
sich lohnt — während es sich lohnt, nicht am nächsten Tag in einer Liste.

**Die Daten liegen alle schon da:** `auction_carts` (bezahlt/offen), `live_auctions` mit
`status='sold'` und `current_bid_cents`, `berkat_tips`. Es fehlt eine Abfrage und ein Blatt.

### 4. Käuferschutz — als einer von fünf Store-Screenshots

Ein eigener Bildschirm im Onboarding: gelbes Schild, Überschrift **„Whatnot Käuferschutz"**, dann
*„Wir unterstützen dich, wenn dein Artikel beschädigt ankommt, fehlt, oder nicht der Beschreibung
entspricht."*

Die Dritte Analyse hat die Durchsetzungsmaschine schon beschrieben, und Abschnitt 25 der Übergabe
führt „Durchsetzungsseite" als offen. Neu ist die **Gewichtung**: Whatnot verbrennt einen von fünf
Store-Screenshots darauf — also eines der fünf Dinge, mit denen sie überhaupt werben.

Für Berkat ist das kein Kopiervorschlag, sondern eine Frage: **Vertrauen ist das Kernargument, und
die Antwort auf „was, wenn es schiefgeht" fehlt.** Die Bürgen (Abschnitt 15) beantworten „wem kann
ich glauben", nicht „wer zahlt, wenn nichts ankommt". Solange Zaur selbst der einzige Verkäufer
ist, ist das folgenlos. Ab dem ersten Drittverkäufer ist es die erste Frage, die jemand stellt.

### 5. Drei Kleinigkeiten, die auffielen

- **Drei Knopf-Zustände in der Show**, nicht zwei: „Biete 40 €" (läuft) · **„Warten Auf Den
  Nächsten Artikel"** (grau, zwischen Artikeln) · **„Auktion is beendet"** (grau, danach). Der
  mittlere ist der interessante — er sagt dem Zuschauer, dass Dableiben sich lohnt.
- **Versand als Betrag an der Artikelkarte**: „4.13 € Versand & Steuern". Berkat schreibt „zzgl.
  Versand ab 4,90 €" — vager, aber ehrlicher, solange die Zone erst an der Kasse feststeht
  (Abschnitt 14).
- **Shop-Symbol mit Anzahl** (`56`) — wie viele Artikel im Regal dieser Sendung liegen.

### 6. Was ausdrücklich NICHT zu übernehmen ist

**„1 Verfügbar".** Whatnot braucht die Angabe, weil sie Bestände führen. Bei Berkat ist jedes
Angebot genau ein Stück; die Zeile stünde konstant auf „1" und wäre Lärm. Die Entscheidung gegen
Varianten (Übergabe, Abschnitt 41) wird durch diesen Screenshot **bestätigt**, nicht erschüttert.

### 7. Ein Fund fürs Selbstvertrauen

Whatnots deutsche Lokalisierung ist an zwei Stellen kaputt, beide in den Store-Screenshots von
gestern:

> „tiffanytang **is hat** den Zuschlag!" · „Auktion **is** beendet"

Beim Übersetzen ist das englische „is" stehen geblieben. **Eine Firma mit 8 Mrd. $ Umsatz liefert
gebrochenes Deutsch in ihrem eigenen Schaufenster aus.** Das ist kein Grund zur Häme, sondern eine
Größenordnung: Der Abstand zu Berkat ist an vielen Stellen kleiner als die Zahlen vermuten lassen —
und an der Sprache ist er umgekehrt.

### Was daraus folgt

1. **Verkäufer-Kennzahlen während der Sendung** — die einzige Lücke dieser Runde, die auf den
   Engpass einzahlt. Zwei Zahlen und eine Ereignisliste aus vorhandenen Daten.
2. **Käuferschutz-Zusage formulieren** — kein Code, eine Entscheidung. Fällig vor dem ersten
   Drittverkäufer.
3. **Knopf-Zustand „Warten auf den nächsten Artikel"** prüfen, falls Berkat dort heute nichts sagt.

### Quellen

- Apple App Store, `Whatnot: Shop, Sell, Connect` von Whatnot Inc., **Version 26.34.5**
  (20.08.2026), deutsche Store-Screenshots, abgerufen am 21.08.2026 über
  `itunes.apple.com/search?term=whatnot&entity=software&country=de`
- Bewertung zum Zeitpunkt des Abrufs: 4,59 bei 7.187 Bewertungen (deutscher Store)

---

## Neunte Analyse: die Regeln hinter der App — Geld, Streit und Versand (21.08.2026)

### 0. Der Befund in einem Satz

**Die acht bisherigen Analysen haben Whatnots Oberfläche vermessen; diese hier hat zum ersten Mal
das Regelwerk dahinter gelesen — und der Abstand liegt nicht bei den Funktionen, sondern bei den
drei Sätzen, die Whatnot für den Fall aufgeschrieben hat, dass etwas schiefgeht: wer erstattet,
wer haftet, bis wann darf man sich melden. Berkat hat diese Sätze nicht, und ab dem ersten fremden
Verkäufer sind sie die erste Frage.**

Zweiter Befund, unbequemer: **Eine ganze Reihe der Empfehlungen, die die Vorarbeit als „jetzt
bauen" ausgibt, ist längst gebaut.** Vorabgebote mitsamt Verkäufer-Ansicht, der Ereignis-Strom im
Umsatz-Blatt, der Versandeinzug an der Kasse — alles im Repo, alles nachprüfbar. Das ist derselbe
Fehler wie in der achten Analyse („Ein Vergleich gegen die eigene App ist wertlos, wenn man sie
aus dem Gedächtnis vergleicht"), diesmal in größerem Maßstab. Abschnitt 2 räumt das auf, bevor
Abschnitt 3 etwas empfiehlt.

---

### 1. Die Quellen — und was sie nicht hergeben

Diese Runde stützt sich auf fünf verschiedene Sorten Material, und die sind **unterschiedlich viel
wert**. Das ist keine Formalie: Drei Viertel der eindrucksvollen Zahlen stammen aus der schwächsten
Sorte.

| Sorte | Was daraus folgt |
|---|---|
| **Store-Screenshots** (DE/US/FR/NL, v26.34.5) | gesehen. Belastbar für Oberfläche und Wortlaut. |
| **Hilfe-Center**, `help.whatnot.com`, Stand Juli/August 2026 | gelesen. Belastbar für Regeln, Fristen, Beträge. |
| **Web-Fassung** `whatnot.com/de-DE` | gesehen. Belastbar für Filter, Artikel- und Profilaufbau. |
| **Verkäufer-Blog** `blog.teamwhatnot.com` | **Werbung.** Whatnots Zweck dort ist, Verkäufer zu gewinnen. |
| **App-Store-Rezensionen** (128 DE, 500 US, 450 GB) | Meinungen. Belastbar als Häufung, nicht als Einzelfall. |

**Fünfzehn Funde der Vorarbeit ruhen ausschließlich auf dem Blog** — der siebenfache Umsatz durch
Vorabgebote, +45 % Bestellwert, 475 € pro Stunde in Deutschland, 40- bis 70-facher Ertrag durch
Sendefrequenz, −80 % Scheingebote, −83 % Nachbelastungen. Keine davon ist geprüft, keine hat einen
Bildschirm dahinter, und alle stammen von der Partei, die daraus Werbung macht. Der Satz „die
7-fach-Zahl ist der stärkste belegte Hebel im ganzen Material" ist deshalb falsch: Sie ist
**behauptet**, nicht belegt. Als Erwartungs-Messlatte („so viel glauben Verkäufer verdienen zu
können") taugt sie; als Begründung für eine Bauentscheidung nicht.

#### Was nur vermutet ist — und vermutet bleibt

- Die **„56"** am Shop-Symbol im Live-Raum. Belegt ist nur, dass dort eine Zahl steht.
- Der Filter **„Label"** im Verkäufer-Blatt (in DE und FR unübersetzt geblieben — spricht für einen
  internen Begriff, vermutlich Versandetikett).
- Der **Doppelpfeil** auf dem Gebotsknopf (vermutlich eine Wisch-Andeutung).
- **„3 Mrd. € = Europa-Summe"** — DE, FR und NL nennen dieselbe Zahl, der Schluss ist naheliegend,
  aber nirgends geschrieben.

#### Eine Vermutung ist inzwischen belegt

Die achte Runde notierte, ein einzelner gelb gesetzter Chat-Kommentar sei „vermutlich eine
Frage-Hervorhebung". Das steht im Hilfe-Center: Chat-Filter `Questions`, und Fragen werden
zusätzlich gelb hervorgehoben (`help.whatnot.com/hc/en-us/articles/23951958152461`, Stand
21.04.2026). **Nicht mehr vermutet.**

#### Wo die Suche ins Leere lief

Ehrlich benannt, weil die Lücken erklären, warum manches unten fehlt:

1. **Der Feed der App** — der wichtigste Bildschirm einer Live-Shopping-App. Die Web-Fassung hat
   keinen: `whatnot.com/de-DE/browse` enthält null Links auf `/live/`, es ist das Gegenstück zum
   App-Reiter „Kategorien", nicht zur Startseite. Wer den Whatnot-Feed beurteilen will, darf das
   Web dafür nicht heranziehen.
2. **Android und der Play Store** — kommen im gesamten Material nicht vor.
3. **Technische Qualität**: Streamstabilität, Latenz, Bildqualität, Akku, Abstürze. Für eine
   LiveKit-App wäre das die operativ wertvollste Quelle, und sie wurde nicht angefasst.
4. **Die ersten sechzig Sekunden** — Registrierung, Interessenauswahl, Telefonprüfung.

#### Zwei Korrekturen an der Vorarbeit, die Empfehlungen kippen

- **Premier Shop** war aus einem Suchtreffer-Schnipsel zitiert (die Seite selbst antwortete 403).
  Gelesen (`.../articles/31084236928909`, Stand 18.08.2026) sieht es anders aus: Zugang verlangt in
  90 Tagen **10 Sendungen, 250 Bestellungen und 50.000 € Umsatz**, die Leistungshürden sind
  **95 % pünktlich und 99 % mangelfrei**. Das ist kein Qualitätsprogramm für kleine Verkäufer,
  sondern ein Volumenprogramm mit Service-Anstrich. Die Empfehlung „für Berkat übernehmbar" beruhte
  auf der halben Regel.
- **Zwei Schwellenwert-Sätze wurden verwechselt.** 80 % / 95 % sind die Sanktions**untergrenzen**
  im Account-Health-Dashboard (`.../articles/34468945178381`) — die Grenze zum Rauswurf, nicht ein
  Ziel. 95 % / 99 % sind die Premier-Hürden. Die Vorarbeit nennt 80/95 „die Schwellen" und empfiehlt
  sie als Ankerwerte.
- **Provisionssatz.** „Aus 8 % werden 7,2 %" rechnet mit dem **US-Satz**. In EU/UK liegt die
  Provision bei **6,67 % + MwSt** (`.../articles/4847069165965`, Stand 11.08.2026); dort wären es
  6,0 %.

#### Ein Widerspruch im Material, den ich nicht auflösen kann

Drei Funde beschreiben **drei unvereinbare Bündelungs-Modelle** als Whatnots Verhalten:

1. automatische Bündelung **pro Show** mit Differenzberechnung vor dem Kauf
   (`help.whatnot.com/hc/de/articles/21927521730317`),
2. **Weekly Bundling** mit beidseitigem Opt-in, in Deutschland freigeschaltet
   (`.../articles/37012119661709`, Stand 13.05.2026),
3. „gebündelt wird das Paket, **nicht die Abrechnung**" — Belege pro Artikel
   (`Troubleshoot shipping costs as a buyer`).

Zwei dieser Funde vergeben gegensätzliche Urteile über Berkat, und derselbe Mechanismus
(*incremental shipping*) wird einmal als Vorbild und einmal als Ursache der Beschwerden verkauft.
**Was ein deutscher Käufer heute tatsächlich erlebt, ist aus diesem Material nicht zu beantworten.**
Ich führe es als offen und stütze darauf keine Empfehlung.

---

### 2. Was Berkat schon hat — der entlastende Teil

Alles hier am Quelltext gegengeprüft, nicht geschätzt. Vier Punkte davon stehen in der Vorarbeit
als Lücke.

#### 2.1 Vier Empfehlungen sind bereits gebaut

| Empfehlung der Vorarbeit | Stand im Repo |
|---|---|
| „Vorabgebote als Verkäufer-Ansicht" | `components/PrepareSheet.tsx:56` zeigt **„2 Vorabgebote · 5 warten"** artikelgenau; `lib/usePrebid.ts`, Migration `20260819150000_berkat_prebid.sql` |
| „Ereignis-Strom im Verkäufer-Blatt" | `lib/useShowEarnings.ts:31` liefert `events` mit `kind: 'sale' \| 'tip'`, `components/EarningsSheet.tsx` rendert sie mit Avatar, Name und Zeit |
| „Versand an der Kasse wirklich einziehen" | `supabase/functions/create-checkout-session/index.ts:214` ruft `get_cart_shipping_options_for_checkout` und setzt `shipping_options[…]`; `app/order/[id].tsx:140` zeigt `order.shipping_cents` |
| „Bestellanzahl neben den Umsatz" | bewusst abgelehnt und begründet, siehe 2.2 |

Der Versand-Punkt ist der lehrreichste: Die Vorarbeit zitiert den **Kommentarkopf** von
`20260815180000_berkat_shipping_rates.sql` („die Kasse zieht noch nichts ein") und hält ihn für den
Ist-Zustand. Der Kopf beschreibt den Stand **an dem Tag, an dem die Datei geschrieben wurde**; die
Kasse zog eine Migration später nach (`20260815190000_shipping_options_service_role.sql`, sonst
`42501` zur Laufzeit). **Migrations-Kommentare sind Zeitzeugen, kein Systemzustand.**

#### 2.2 „Bestellungen" wäre in Berkat schlicht falsch

Whatnot zeigt „Verkäufe 1310 € · Bestellungen 108". Die Vorarbeit empfiehlt, die zweite Zahl zu
übernehmen — „108 Bestellungen erzählt an einem schwachen Abend eine freundlichere Geschichte".
`components/EarningsSheet.tsx` hat die Frage bereits entschieden, und zwar richtig: Ein Sammelkorb
bleibt 24 Stunden offen und wird erst danach zur Bestellung. **Während der Sendung gibt es keine
einzige.** Deshalb steht dort „Zuschläge" — die Zahl, die zählt, was gerade wirklich passiert ist.
Whatnots Zahl ist nur deshalb möglich, weil dort jeder Kauf sofort eine Bestellung ist.

#### 2.3 Der klarste Vorsprung: Anbieterkennzeichnung und Impressum

Whatnots deutscher Hilfe-Artikel zum Impressum (`help.whatnot.com/hc/de/articles/24898437653261`)
zählt die sechs Pflichtangaben korrekt auf — und löst das Problem dann mit einem Satz: der
Verkäufer bekomme „in deiner Whatnot Bio genügend Platz für ein Impressum". Ein **Freitextfeld**.
Keine Prüfung, keine Unterscheidung privat/gewerblich, keine Rechtsfolge. Der Artikel trägt den
Stand **13. März 2024** und ist damit der mit Abstand älteste im ganzen Verkäuferbereich, während
Gebühren, Versand und Käuferschutz im August 2026 aktualisiert wurden.

Auf zwei geprüften Artikelseiten (`whatnot.com/de-DE/listing/…`) fand sich kein Wort zu
privat/gewerblich, keine Widerrufsbelehrung, kein Verkäufer-Impressum. Berkat hat strukturierte
Felder mit ausgewiesener Rechtsfolge nach Art. 246d EGBGB. **Das ist ein Anwerbe-Argument gegenüber
Verkäufern, die Abmahnungen fürchten — kein Kopiervorschlag.**

Eine Einschränkung, die dazugehört: Geprüft ist die **Anzeige**. Die *Erhebung* hat Whatnot sehr
wohl — Rechtsname wie im Ausweis, Fulfillment-Adresse und behördliche Ausweisprüfung beim
Verkäufer-Antrag (`.../articles/8442834600333`, Stand 10.08.2026). Und bei GPSR, DAC7 und DSA
Art. 30 liegt Whatnot vor Berkat. Der Vorsprung ist real, aber schmaler als dreimal behauptet.

#### 2.4 Weitere Bestätigungen ohne Handlungsbedarf

- **Sammelkorb gegen Weekly Bundling.** Berkat ist architektonisch voraus: kein doppeltes Opt-in,
  24 Stunden statt einer Woche, Einfrieren an der Kasse. Whatnots Anleitung besteht zur Hälfte aus
  Warnungen, wie man offene und geschlossene Bündel nicht verwechselt, und empfiehlt, Etiketten
  Montagfrüh zu ziehen.
- **Gold = Kauf, Rot = live, Grün = Bestätigung.** Deckt sich mit dem Marktführer (Gebotsknopf
  gelb, Live-Pille rot, Umsatzzahl grün). Berkats Farbgesetz ist bestätigt. Einzige Abweichung:
  Whatnot färbt „Verkauft" **rot** — das würde Berkats Regel verwässern, dort passt Gold oder Grün.
- **Ziehbahn statt Tipp.** Whatnot hat in v26.34.0 (August 2026) noch versehentliche Gebote
  („ich habe nur gescrollt, da wechselte der Knopf auf Bieten") und fehlendes Zuschlag-Feedback
  („es zeigt nicht deutlich, wenn du gewonnen hast, also bietest du gegen dich selbst" — der
  Rezensent kaufte fünf Paar desselben Schuhs). Berkat hat beides gelöst: `BidButton.tsx` macht aus
  „Du führst" keinen Knopf, `AuctionPanel.tsx` zeigt „hat den Zuschlag!". Das darf ohne
  Übertreibung in der Store-Beschreibung stehen.
- **Die Nische ist nicht leer — aber sie ist französisch.** Die Suche nach „abaya" liefert im
  deutschen Store aktive Verkäufer mit genau diesem Sortiment (Abaya 50 €, „Tapis Nabawi" 35–45 €,
  Koran-Hüllen 25 €, „Musc Nabawi" 50 €). Beschreibungen wie *„toute taille dispos 52 au 60"* —
  ohne deutschsprachige Ansprache, ohne Bürgen, ohne Frauen-Only. **Der Satz „für diese Gemeinschaft
  gibt es nichts" stimmt so nicht; der Abstand ist Sprache und Vertrauensform, nicht Sortiment.**
- **Deutschland ist Whatnots schwächster großer Markt.** 7.188 Bewertungen bei 4,59 gegen 1.003.258
  bei 4,74 in den USA, 68.531 in UK, 33.419 in Frankreich. Mit Österreich (674) und der Schweiz
  (343) kommt der ganze DACH-Raum auf rund 8.200. Unterstützte Sprachen: NL, EN, FR, DE, JA — kein
  Russisch, kein Türkisch, kein Arabisch, obwohl die App im russischen und türkischen Store
  verfügbar ist.

#### 2.5 Eine Korrektur an der eigenen Fundlage: Berkat hat Sterne

Zwei Funde bauen den Gegensatz auf „Whatnot antwortet mit einer Dezimalzahl, Berkat mit Namen von
Bürgen". Das stimmt nicht: `components/RatingStars.tsx`, `components/ReviewSheet.tsx` und die
Migration `20260816160000_berkat_seller_reviews_public.sql` existieren, `app/seller/[id].tsx`
rendert `stats.rating` im Profilkopf. **Berkat hat beide Währungen.** Die Frage ist damit nicht
„Sterne kopieren oder nicht", sondern: welche der beiden führt, wenn sie sich widersprechen.

Ebenso halb erledigt ist die empfohlene „Vertrauenszeile im Live-Kopf": `app/live/[id].tsx:1051`
übergibt `vouchLine={vouchSummary(vouches)}` bereits — nur an das `SellerSheet`, also **ein Antippen
tief**. Das ist eine Platzierungsfrage, keine Neuentwicklung.

---

### 3. Die Funde, nach Nutzen

Die Sortierung folgt einer einzigen Frage: **Warum sendet ein Verkäufer kein zweites Mal?** Alles,
was darauf nicht einzahlt, ist nicht A.

#### Korb A — jetzt

**A1 · Der Kauf-Knopf muss bei fremder Ware funktionieren**
*Whatnot:* Es gibt keine Kasse. Zahlungsmittel und Lieferadresse liegen **vor dem ersten Gebot** im
Konto; der Zuschlag belastet die Karte, die zum Zeitpunkt der Gebotsabgabe Standard war. Die Regel
im Hilfe-Center heißt wörtlich „you bid, you buy" (`.../articles/14932924544141`).
*Berkat:* `20260817120000_berkat_checkout_gate.sql` — `checkout_enabled` ist die ZAG-Schranke, kein
Eintrag heißt **gesperrt**. Ein fremder Verkäufer landet heute zwangsläufig bei `contact_seller`,
also bei „Nachricht schreiben" statt „Kaufen".
*Folgt daraus:* Ein Verkäufer, dessen Zuschlag in einer DM endet, jagt sein Geld hinterher — der
zuverlässigste Weg, nach einer Sendung aufzuhören. Stripe Connect ist laut
`STRATEGIE-VERKAEUFER-UND-GELD.md` zu Recht Monat 6+; die Entscheidung, die **jetzt** ansteht, ist
eine andere: **auf welchem legalen Weg der Kauf-Knopf im Testlauf funktioniert.** Realistisch:
Kommission, Berkat ist Verkäufer. Das ist eine Entscheidung, kein Bildschirm.

**A2 · Zahlungsmittel vor dem ersten Gebot, Zuschlag = Kauf**
*Whatnot:* Gebote sind bindend und nicht zurückziehbar; der nicht zahlende Käufer existiert dort
nicht, weil er strukturell nicht entstehen kann. Statt eines Mahnwesens gibt es einen Storno-Weg:
Käufer beantragt binnen **24 Stunden**, Verkäufer antwortet binnen **48 Stunden**, keine Antwort =
Kauf steht (`.../articles/9810585575693`).
*Berkat:* Die Existenz von `20260814200000_berkat_payment_reminder` ist der Beweis, dass es den
nicht zahlenden Höchstbietenden gibt.
*Folgt daraus:* Nichts entmutigt einen Verkäufer schneller als ein gefeierter Zuschlag, der nie Geld
wird. Die drei Zahlen 24 h / 48 h / „keine Antwort = Kauf steht" sind ein fertig kalibrierter
Ablauf. Der kleine Trick dazu: **solange ein Stornoantrag offen ist, lässt sich kein Versandetikett
erzeugen** — verhindert Doppelarbeit.

**A3 · Gestufter Versand mit Brief-Preis, ein Beleg, ein Packzettel**
*Whatnot DE, offen im Hilfe-Center:* Brief 20 g **1,19 €** · Brief 50 g 1,38 € · Brief 500 g 2,25 €
· Paket 1 kg 4,10 € · 2 kg 6,17 € · 5 kg 6,56 € (`.../hc/de/articles/21927521730317`). Die
Versandprofile sind als **Gegenstände** formuliert, nicht als Gramm: „Artikel in Größe M (z. B.
Jeans, Pullover)", „Einzelner kleiner Schuhkarton", „Rechteckige Schmuckbox".
*Berkat:* Der Einzug läuft (siehe 2.1) — aber `berkat_shipping_rates` kennt eine Pauschale **pro
Zone**, nicht mehrere Stufen.
*Folgt daraus:* Bei 6-€-Secondhand entscheidet der Versandpreis, ob überhaupt etwas verkauft wird.
Der Abstand zwischen 1,19 € und einer Paketpauschale ist bei einem Kopftuch der Unterschied zwischen
kaufbar und unverkäuflich. Die Tabelle hat bereits `label` und `sort_index`, also ist das eine
Zeilen-Ergänzung, kein Umbau. **Zweiter Teil, wichtiger:** Der Sammelkorb bündelt drei Zuschläge in
ein Paket — dann braucht er auch **einen Packzettel mit den Attributen je Artikel**, sonst packt der
Verkäufer aus dem Gedächtnis. Whatnot lässt die Attribute ausdrücklich bis auf den Packzettel
durchlaufen; das ist der Teil dieser Blog-Meldung, der auch ohne die Werbezahlen daneben stimmt.

**A4 · Zwei Ereignisarten im Umsatz-Blatt ergänzen, plus @-Knopf**
*Whatnot:* Ein filterbarer Strom im Verkäufer-Blatt (Alle / Auktion / Geschenk / Angebote / Label)
und eine Zuschauerliste mit Aktivitäts-Reiter: Raids, **neue Follower**, Trinkgelder,
Auktionsgewinne, Käufe. Neben jedem Namen ein **@-Knopf**, der den Zuschauer im Chat markiert.
*Berkat:* `lib/useShowEarnings.ts` kennt `sale` und `tip`. Es fehlen **neuer Follower** und
**Preisvorschlag** — beide existieren bereits als Vorgang (`20260818120000_berkat_offers.sql`).
*Folgt daraus:* Die Arbeit ist zu 70 % getan; was fehlt, sind zwei Zeilen im selben Strom. Der
@-Knopf ist die eigentliche Entdeckung: den Käufer beim Namen im Chat ansprechen, ohne ihn
abzutippen. **Namen nennen ist in dieser Gemeinschaft der ganze Verkauf**, und das ist genau
Berkats Tonfall.

**A5 · Auktionsdauer und Nachschlagzeit als Verkäufer-Stellschrauben**
*Whatnot:* Beim Start einer Auktion setzt der Verkäufer drei Werte — Startgebot, Mindestdauer und
**„Counter bid time"**: wenn weniger als 10 Sekunden übrig sind, setzt jedes neue Gebot den Timer
auf **diesen frei gewählten Wert** zurück. Optional „Sudden Death": Ende bei 00:01 ohne
Verlängerung, im Käufer-Bild mit einem 💀 markiert (`.../articles/9779931101837`).
*Berkat:* +10 Sekunden fest.
*Folgt daraus:* Die 10 Sekunden sind bei Whatnot die **Auslöseschwelle**, nicht die Verlängerung —
zwei Stellschrauben, nicht eine. 40 Kinderjacken und ein teures Einzelstück brauchen verschiedenes
Tempo, und eine Sendung, die sich totzieht, verliert das Publikum, das die zweite tragen müsste.
⚠️ **Wechselwirkung:** Die Ziehbahn dauert länger als ein Tipp; sehr kurze Werte wären unfair. Eine
Untergrenze gehört in dieselbe Änderung.
*(Der separat gemeldete „Sieben-Sekunden-Timer" beschreibt vermutlich dieselbe Stellschraube, gibt
aber selbst einen Datumskonflikt zu — 05.05.2026 gegen Mai 2024. Ich stütze nichts darauf.)*

**A6 · Entwurf speichern, plus zwei Angebots-Klassen**
*Whatnot:* „Publish" **oder** „Save Draft"; Entwürfe liegen unter Inventory → Drafts. Einbahnstraße:
ein veröffentlichtes Angebot lässt sich nicht in einen Entwurf zurückverwandeln, nur deaktivieren.
Und die Typentrennung für Angebote aus einer laufenden Sendung heraus: **Quality Listing**
(wiederverwendbar, in der Suche auffindbar) gegen **Temporary Listing** (nur Grunddaten, verfällt
mit der Sendung) — Entwürfe gibt es für Temporary Listings ausdrücklich nicht
(`.../articles/9779149424269`, Stand 07.08.2026).
*Folgt daraus:* Das ist die Antwort auf einen Konflikt, den Berkat auch hat: Der Verkäufer will
während der Sendung in zwanzig Sekunden etwas einstellen, die Plattform will saubere Daten fürs
Regal. Whatnot löst das **nicht** mit weniger Pflichtfeldern für alle, sondern mit zwei Klassen und
einem Anreiz — Suche und Flash-Sale nur für die gute Version. 15 Einzelstücke in einer vollen Maske
sind zwei Stunden Tipparbeit vor einer 60-Minuten-Sendung, und Vorbereitungsaufwand ist der
Abbruchgrund, den Zaurs eigene Strategie unter „Zu aufwendig" führt.
*Gegengewicht, das dazugehört:* Whatnot schreibt selbst, rund 90 % ihrer Angebote seien generisch
(„item as shown"), aber **91 % der Neukäufer** hätten ihren ersten Kauf auf einem nicht-generischen
Angebot gemacht. Das ist eine Blog-Zahl und damit Selbstauskunft — aber sie ist ein Argument
dagegen, das Schnell-Angebot zu weit abzumagern.

**A7 · Probesendung und ein überlebensfähiger Stream**
*Whatnot:* „Rehearsal Mode" für simulierte Auktionen ohne echte Sendung; „Closing the app or browser
only pauses your show" — Beenden ist ein bewusster Akt über More → End Show; eine beendete Sendung
lässt sich **innerhalb von 2 Stunden neu starten** (`.../articles/9778927885581`).
*Folgt daraus:* Fünf Menschen, die noch nie live vor Fremden gesprochen haben, brauchen einen Raum
zum Üben — in einer Gemeinschaft, in der man sich kennt, ist die Hemmschwelle **höher**, nicht
niedriger. Und ein Absturz mitten in einer laufenden Auktion mit wartenden Bietern ist der teuerste
Moment im ganzen Produkt. Das Neustartfenster ist die Versicherung dagegen.

**A8 · Vor der Tür sichtbar machen, was heute Abend drankommt**
*Whatnot:* Auf jeder Karte einer angekündigten Sendung sitzt ein Lesezeichen-Knopf mit **Zahl**
(aria-label „Diese Show merken"; gesehen: 287, 457, 123, 305, 5). Das Merken ist anonym — sichtbar
ist nur die Summe. Derselbe Knopf merkt drei Dinge: eine Sendung, ein einzelnes Angebot **oder eine
Suche**; die gespeicherte Suche meldet sich, wenn neue passende Artikel eingestellt werden
(`.../hc/de/articles/9780885421069`).
*Berkat:* Merkliste und Glocke je Artikel gibt es; die Merken-Zahl am Termin und die gespeicherte
Suche nicht.
*Folgt daraus:* Die Merken-Zahl macht aus einem Termin ein Ereignis und ist ein `COUNT` auf einer
Tabelle, die es für die Erinnerung ohnehin geben muss. ⚠️ **Berkats eigene Regel greift hier:**
„2 gemerkt" entmutigt — erst ab einer Schwelle anzeigen. Die **gespeicherte Suche** ist der stärkere
der beiden Funde: Sie ist das einzige Werkzeug im ganzen Material, das eine erfolglose Suche in
einen späteren Besuch verwandelt, statt sie zu verlieren. In einem dünn besetzten Regal ist das mehr
wert als in einem vollen.

**A9 · Obergrenze für Erinnerungs-Pushes**
*Whatnot:* Auf dem Verkäuferprofil sitzt eine Glocke mit drei Stufen — Alle / **Personalisiert** /
Keine. Personalisiert ist ausdrücklich der **Standard** (`.../hc/de/articles/9429224729101`).
*Folgt daraus:* Whatnot hat die Erfahrung schon gemacht und drosselt per Voreinstellung. Bei einem
Verkäufer, der dreimal die Woche sendet, ist „jedes Mal" der schnellste Weg, die Push-Berechtigung
zu verlieren. Bei einem Verkäufer folgenlos; ab dem dritten, dem dieselben Leute folgen, wird es der
Grund, warum in Woche 5 niemand mehr kommt. Die Auffanglösung ist nicht Personalisierung, sondern
eine **Obergrenze pro Nutzer und Tag**.

**A10 · Ein Gewinnspiel-Gewinn muss eine echte Bestellung erzeugen**
*Whatnot:* Drei unabhängige Stellen im Material beschreiben dieselbe Lücke. Der Analytics-Artikel:
„Orders — **Gewinnspiele zählen nicht**". Die Gebührenseite: bei 0 € Bestellwert keine Provision,
den Versand trägt der Verkäufer. Und die Rezensionen: „Die Gewinnspiele sind das Schlimmste — sie
halten Leute in der Show und schicken dann nichts" (US, 18.08.2026, 3★); „mehrere
Gewinnspiel-Artikel wurden nie versendet" (US, 10.08.2026, 1★).
*Berkat:* `draw_live_giveaway` (`20260813233000_berkat_giveaways.sql:219`) setzt `status='drawn'`
und `winner_id` — **mehr nicht**. Keine Bestellung, keine Adresse, keine Versandpflicht, kein
Nachweis. Der Gewinn läuft an Sammelkorb und `mark_shipped` vorbei.
*Folgt daraus:* Die Ziehung selbst ist bei Berkat sauberer als bei Whatnot — sie läuft serverseitig
als `SECURITY DEFINER`, der Gastgeber kann den Gewinner nicht bestimmen. Aber die zweite Hälfte ist
die, über die sich Leute beschweren. Wer sie schließt — **Gewinn erzeugt eine Bestellung mit 0 €
Warenwert im normalen Versandpfad** — hat den häufigsten Manipulationsvorwurf gegen Whatnot
strukturell ausgeschlossen statt nur verboten. Drei Blickwinkel hatten je ein Drittel dieses
Befunds; zusammengesetzt ist es der billigste Fund der Runde.

**A11 · Fester wöchentlicher Sendeplatz als Bedingung des Testlaufs** — *Betrieb, kein Code.*
Die Frequenz-These (3–4 Sendungen pro Woche gegen 1–2 im Monat) ist **Whatnots Selbstauskunft** und
nicht geprüft. Sie taugt trotzdem als Arbeitshypothese, weil sie zu dem passt, was Berkat ohnehin
gebaut hat: Sendeplan, wöchentliche Reihen, Erinnerungs-Push. Die ehrliche Fassung lautet: *Prüfe
sie nach vier Wochen am eigenen Sendeplan, statt sie zu glauben.* Die Zusage „jede Woche derselbe
Slot" ist die richtige Testlauf-Bedingung, auch wenn die Zahl daneben Werbung ist.

**A12 · Ein benannter Mensch, der auf Deutsch binnen 24 Stunden antwortet** — *Betrieb, kein Code.*
Whatnots Support ist E-Mail und Textbaustein: kein Telefon, kein Live-Chat mit Menschen; 37 von 517
negativen Rezensionen (7,2 %) drehen sich darum, 23 davon seit Juni 2026. Zwei Bilder daraus: „einige
Tage nach der Anfrage kam nur eine Umfrage, wie zufrieden man mit dem Support sei, und das Ticket
wurde geschlossen" (DE, 09.07.2025); die Aufforderung, auf die Support-Mail zu antworten — deren
Antwort mehrfach als unzustellbar zurückkam (GB, 13.08.2026). Der teure Teil skaliert erst bei
Zehntausenden. Bis dahin ist ein erreichbarer Mensch der billigste Vorsprung im ganzen Material —
und die Ticket-Schließung-mit-Umfrage ist genau die kalte Geste, die Design-Gesetz „Fehler nie kalt"
verbietet.

#### Korb B — vor dem ersten fremden Verkäufer

Gate für den Start des Testlaufs, nicht Motor. Läuft der Testlauf als Kommission (Berkat ist
Verkäufer), zeigen die meisten dieser Pflichten auf Zaur — das macht sie **einfacher, nicht
kleiner**.

- **Käuferschutz als EIN einhaltbarer Satz.** Whatnot verbrennt darauf einen von fünf deutschen
  Store-Screenshots — und zwar an **Position 2 von 5**, während er im US- und UK-Store an Position 5
  steht und in Frankreich und den Niederlanden ganz fehlt (samt zugehörigem Absatz im
  Beschreibungstext). Der Marktführer glaubt also, dass deutsche Käufer zuerst Sicherheit und dann
  Sortiment kaufen. Der Satz selbst ist kurz: *„Wir unterstützen dich, wenn dein Artikel beschädigt
  ankommt, fehlt, oder nicht der Beschreibung entspricht."* Genau drei Fälle. **Es braucht keine
  Schlichtungsmaschine, um anzufangen — es braucht einen Satz, den man halten kann.** Die Bürgen
  beantworten „wem kann ich glauben", nicht „wer zahlt, wenn nichts ankommt".
- **Haftungsmatrix mit der Kategorie „unklar → Plattform trägt"**
  (`.../articles/360061195412`). Der wichtigste Gedanke ist nicht die Liste, sondern dass eine
  Erstattung an den Käufer **nicht automatisch heißt, der Verkäufer sei schuld**. In einer
  Gemeinschaft, in der man sich kennt, ist ein Verfahren ohne Schuldreflex kulturell wichtiger als
  das Geld.
- **Fristen: das FRÜHERE aus 30 Tagen ab Kauf oder 14 Tagen ab Zustellung** — Trinkgelder
  **ausdrücklich ausgenommen** (`.../articles/360061194552`). Die Konstruktion ist der Kniff: Sie
  deckelt gleichzeitig die Hängepartie beim nie zugestellten Paket und die Prüffrist nach Erhalt.
  Der Trinkgeld-Ausschluss betrifft Berkat direkt — ohne ihn ist jedes Trinkgeld ein offener
  Erstattungsanspruch. Ebenfalls dort für Deutschland ausformuliert: Rücksendekosten trägt der
  Käufer und werden von der Erstattung abgezogen.
- **Widerrufsfähigkeit am EINZELNEN Angebot**, nicht nur am Anbieter, plus benannter Knopf in den
  Bestelldetails („Withdraw and return item"). Bei Berkat ist die Ableitung **billiger als bei
  Whatnot**, weil die Anbieterart bereits strukturiert erfasst ist. Dazu die Zusage an den
  Verkäufer: **Widerruf zählt nicht gegen deine Bewertung** — sonst erlebt ein Verkäufer, den man
  persönlich kennt, den Widerruf als Kränkung.
- **Storno-Ablauf mit Pflicht-Grund, Notizfeld an den Käufer, Erlass der ersten Gebühr.**
  Secondhand-Einzelstücke sind genau die Warenart, bei der „doch nicht mehr da" garantiert vorkommt.
  Whatnot verlangt einen Grund und legt dem Verkäufer die Worte in den Mund (1–2 Sätze, sachlich,
  klarer nächster Schritt, mit Beispieltext) statt ihn schweigen zu lassen. Ein stornierter Zuschlag
  ist der kälteste Moment, den ein Käufer erleben kann.
- ⚠️ **Keine reine Stornoquote als Kennzahl.** Ein Lehrstück über Anreize: Whatnot berechnet 3 € oder
  3 % und droht bei hoher Quote mit Kontostrafen — mit dem Ergebnis, dass Verkäufer **grundsätzlich
  jede Stornierung ablehnen**. Genau das schildert die Käuferseite mehrfach (US 13.08.2026, GB
  27.07.2026, DE 25.06.2026). Die Quote sollte schlechte Verkäufer treffen und macht stattdessen aus
  jedem einen, der niemals storniert. Für Berkat sofort relevant, weil der Sammelkorb 24 Stunden
  offen ist: Das Zeitfenster für „ich habe mich vertan" ist da, die Regel dafür fehlt.
- **Erstattung fallbezogen entscheiden, nie kontobezogen.** Die schärfste Beschwerde im ganzen
  Datensatz, sieben direkte Treffer über drei Länder: „nun heißt es, es sei keine Rückerstattung
  möglich aufgrund meines Verlaufes" (DE, 07.01.2025); „je mehr du kaufst, desto mehr Pakete kommen
  nicht an" (US, 18.08.2026). Whatnots eigene Richtlinie stützt es: Käufer mit Anzeichen von
  Erstattungs-Missbrauch können abgelehnt werden, die Beurteilung liegt vollständig in Whatnots
  Ermessen, eine Zahl wird nicht veröffentlicht. **Das trifft ausgerechnet die besten Kunden — und
  in einer Diaspora-Gemeinschaft wandert so eine Geschichte in einem Abend durch alle Gruppen.**
- **Beweislast bei „zugestellt, aber nie angekommen" nicht beim Käufer.** Auspack-Video als
  zulässiger Beweis, feste statt verschiebbarer Frist. Berkat hat `mark_shipped`, aber keine Regel
  für den Fall danach. Ein Käufer reichte Zeitleiste, Screenshots und Video ein — statt darauf
  einzugehen, verwies Whatnots Team auf seine „Aktivität" (GB, 29.07.2026).
- **Abgabe-Beleg beim Einliefern** (Foto oder Scan des Etiketts in der App). Braucht keinen
  Zahlungsdienstleister und keine Schlichtungsinstanz und entschärft den häufigsten Streitfall,
  bevor überhaupt geschlichtet wird. *(Die Wirkungszahlen dazu — −60 % Tickets, −71 % „nie
  versendet" — stammen aus dem Blog und sind Selbstauskunft.)*
- **Gefahrgut beim Einstellen klären.** Whatnots Hazmat-Liste nennt Lithium-Batterien, **Parfum**
  und Nagellack. Berkat schließt Elektro und Batterien aus, **Parfüm aber nicht** — und Parfüm ist
  im Paketversand beschränkt. Das muss geklärt sein, bevor jemand Musc verschickt.
- **Konditionen des Testlaufs vorher schriftlich.** Die sauberste Abwanderungs-Geschichte im
  Material: Ein kleiner Verkäufer entschied sich wegen einer ausgelobten Startprämie von 150 € für
  Whatnot, machte 500 € Umsatz — und bekam die Prämie nicht, weil sein Stream „privat und nicht
  öffentlich" gewesen sei (DE, 08.02.2025, 1★). Sein Schluss: „Habe jetzt schon keine Lust mehr und
  das Streamen wieder aufgegeben." Eine ausgelobte Zahl mit nachgeschobenem Ablehnungsgrund.
  „0 % dauerhaft" ist ein Versprechen und gehört als solches festgehalten.
- **Konto in der App löschbar, Zahlungsart entfernbar.** Bei Whatnot geht beides nicht: „man kann
  seine Zahlungsinformationen nur ändern, indem man sie ersetzt … das Konto kann man nicht löschen"
  (DE, 20.03.2025). Für Berkat ist das **kein Vergleichspunkt, sondern ein Prüfblocker**: Apples
  Richtlinie 5.1.1(v) verlangt eine Löschmöglichkeit in der App, DSGVO Art. 17 verlangt die
  Löschung. `grep` über `apps/berkat` findet **keinen Löschpfad**. Die App liegt seit heute in
  TestFlight; das kommt bei der Prüfung.
- **Nie ohne nennbaren Grund sperren, Einspruch ohne Login erreichbar.** Zwölf Treffer, darunter
  Sperren Minuten nach der Anmeldung. In einer kleinen Gemeinschaft ist eine grundlose Sperre nicht
  ein verlorener Nutzer, sondern eine Familie.
- **Vertrauenszeile im Live-Kopf — dorthin, wo Whatnot die Sternzahl setzt.** Bei Whatnot steht
  unter dem Verkäufernamen dauerhaft ein Stern mit Dezimalzahl (5.0, 4.8, 4.9), ohne Antippen, in
  jedem Land an derselben Stelle. Nicht die Zahl kopieren — die **Platzierung**. Berkat übergibt
  `vouchLine` bereits, nur ein Antippen tief.
- ⚠️ **Ein Bürge bietet beim Verbürgten nicht mit.** Berkats Nähe wirkt in beide Richtungen: Ein
  Verkäufer-Teardown beschreibt genau den Effekt des offenen Bietens unter Klarnamen — befreundete
  Konten treiben Preise hoch, und umgekehrt bietet niemand gegen einen Bekannten, was die Erlöse
  drückt. Das ist der Preis des Bürgen-Modells und gehört bedacht, bevor der erste fremde Verkäufer
  da ist.
- **Altersfrage bewusst entscheiden.** Whatnot trägt 12+ in allen neun geprüften Ländern, und das
  Feld `advisories` enthält **genau einen** Eintrag: „Frequent/Intense Contests". Keine Gewalt, keine
  Sprache, kein simuliertes Glücksspiel — die häufigen Gewinnspiele allein tragen die Einstufung.
  Berkat schließt Zufallsmechaniken aus und wäre bei seltenen Gewinnspielen niedriger einstufbar.
  **Zweite Hälfte derselben Frage:** Whatnot verlangt mindestens 13 Jahre. In `apps/berkat` gibt es
  weder Geburtsdatum noch Altersabfrage — bei einer Auktion ist das nicht kosmetisch, §§ 106/110 BGB
  machen das Gebot eines Fünfzehnjährigen schwebend unwirksam.
- **Adressänderung bei offenem Sammelkorb.** Bei Whatnot erzeugt sie ein neues Bündel, die alten
  Bestellungen gehen an die alte Anschrift. Im 24-Stunden-Fenster ein realistischer Fall.

#### Korb C — später

Richtig, aber setzt Publikum, Verkäuferzahl oder Datenmenge voraus, die es nicht gibt.

- **Video-Quittung.** Der stärkste Einzelfund, den kein Blickwinkel gehoben hat: Whatnot legt an
  jede Bestellung den **Ausschnitt der Aufzeichnung, in dem genau dieser Artikel aufgerufen wurde**
  — 60 Tage, für Käufer in der App, für Verkäufer im Hub (`.../articles/12165139226893`, Stand
  17.03.2026). Das ist Streitbeweis („so wurde es gezeigt und gesagt") und Freude in einem, und es
  hängt an der Auktion, nicht an einer Replay-Infrastruktur. Es setzt aber Aufzeichnung voraus, und
  die steht auf Berkats Fehlliste — deshalb C und nicht A.
- **Kamera-Nahaufnahme im Live-Raum.** Whatnot hat Zoom in drei Stufen (0,5× / normal / nah), beide
  Werkzeuge standardmäßig aus (`.../articles/7692049973133`). Für Secondhand — Stoff, Naht, Makel
  zeigen — ist die Nahaufnahme das eigentliche Verkaufswerkzeug. In Berkats Live-Raum gibt es nur
  den Kamerawechsel. Kein Abbruchgrund, aber näher an A als der Rest dieser Liste.
- **Unbeantwortete Suchen dem Verkäufer zeigen.** „Danach wurde gefragt, es gab nichts" ist bei
  kleinem Bestand aussagekräftiger als eine Bestenliste — und die naheliegende Kleinform von
  Whatnots Trend-Ansicht aus 900.000 Suchen täglich, die bei Berkats Größe nur entmutigen würde.
- **„Mehr von diesem Verkäufer" unter dem Artikel** — auf Whatnots Artikelseite stehen dort zehn
  weitere Angebote mit Preis. Erhöht den Korb mit einer Abfrage, wirkt aber erst bei gefülltem Regal.
- **Chat-Filter „Fragen"/„Käufer", `/slow`, `/hide`, Mute-Words pro Sendung.** Löst ein Problem, das
  erst bei Erfolg auftritt: In einem schnellen Chat gehen genau die zwei Nachrichtenarten unter, die
  Geld bringen. `/hide` — eine Nachricht, die nur Verkäufer und Moderatoren sehen — ist der Teil,
  der für Frauen-Only-Räume später wirklich zählt: leise abstimmen, ohne zweite App.
- **Kaufknopf wird zwischen zwei Artikeln zum Zustandstext.** Der Sprachvergleich zeigt, wie viel an
  einem Wort hängt: „Warte auf den nächsten Artikel" (US) hält den Zuschauer im Raum, „Auktion is
  beendet" (DE) gibt ihm die Erlaubnis zu gehen. Wenn Berkat dort eine Lücke hat, gehört der
  vorwärtsgewandte Satz hin — möglichst mit dem Namen des nächsten Artikels.
- **Marke als eigene Filter-Achse.** Berkat filtert Kategorie, Größe, Zustand, Ort, Preis. Bei
  Secondhand-Mode ist die Marke oft das, was der Käufer eintippt. Ein Freitextfeld mit Vorschlägen
  genügt, lohnt aber erst bei dreistelliger Angebotszahl.
- **Zustandsvokabular pro Kategorie.** Whatnots deutsche CSV-Vorlage führt **157 kategoriespezifische
  Zustands-Sets**: „Near Mint" für eine Jacke ist Unsinn, „Neu mit Etikett" für eine Vase auch.
  Richtig, aber Berkats 61 Unterkategorien sind heute wichtiger als die Feinheit.
- **Facetten aus dem vorhandenen Bestand erzeugen, nicht aus dem Katalog.** Whatnots Shop-Reiter
  eines Verkäufers zeigt bei Zustand nur die drei Werte, die dieser Verkäufer wirklich hat. Ein
  Filter „Größe 46" mit null Treffern ist schlimmer als kein Filter — er sieht aus wie ein leeres
  Geschäft. Dasselbe gilt für die Zuschauerzahl an der Kategorie-Kachel: **nur zeigen, wenn sie
  größer null ist**, nie „0 Zuschauer" schreiben.
- **Sortierung „Zuschauer: wenige zuerst".** Auf Whatnots Kategorieseite ein echter Hebel für kleine
  Verkäufer, die sonst nie oben stehen. Bei fünf Sendungen sieht man ohnehin alle.
- **Abholung mit Übergabecode.** Für eine ortsdichte Diaspora wäre sie der Normalfall, nicht die
  Ausnahme, und der Code ist zugleich der Übergabe-Beweis, den Berkat sonst nirgends hat (7 Tage
  Frist, danach automatisch abgeschlossen). **Sie steht hier statt in A, weil `HANDOFF.md` sie
  begründet abgelehnt hat**: Sie bräche `get_cart_shipping_options`, die Stripe-Adressabfrage und
  `mark_order_shipped`. Wer sie baut, fasst den Geldweg ein zweites Mal an. ⚠️ Whatnots **öffentliche
  Abholadresse** ist ausdrücklich nicht zu übernehmen — in Frauen-Only-Kontexten kann die
  Wohnadresse einer Verkäuferin nicht im Stream stehen. Treffpunkt statt Adresse, oder Adresse erst
  nach dem Zuschlag an genau einen Käufer.
- **Team-Rollen.** Whatnot hat vier (Owner / Admin / Seller / **Support** — Versand und Nachrichten,
  aber ausdrücklich kein Live). Ohne Rollen heißt Mithilfe heute: Zugangsdaten weitergeben. Für
  Familienbetriebe und Frauen-Only die richtige Vorlage, nur nicht in Woche 1.
- **Wero als Zahlungsart.** Das europäische Sofortzahlverfahren der Banken steht in Whatnots
  deutscher Liste. Direkt vom Konto, weder Karte noch Kredit — der natürliche Gegenentwurf zu BNPL
  und religiös der sauberste Weg. Gehört auf den Tisch, wenn der Zahlungsweg ohnehin angefasst wird.
- **Auszahlung „4 Tage nach Label-Erstellung".** Whatnot hat für **Deutschland als einziges Land**
  keine Kopplung an die Zustellbestätigung — vermutlich weil deutsche Zustelldaten unzuverlässig
  sind. Das ist die fertige Antwort auf die schwerste Connect-Frage (wann gibt man das Geld frei,
  ohne den Käuferschutz zu verlieren), aber Connect ist Monat 6+.
- **Gebührensätze** (6,67 % + MwSt auf den Artikelpreis, 2,42 % + 0,25 € auf den **Gesamtbetrag
  inklusive Versand**). Die zweite Zahl ist die, die Verkäufer nicht erwarten — Whatnot beantwortet
  sie mit einer eigenen FAQ-Zeile. Im Testlauf gilt 0 %; wer sie später einführt, sollte sie heute
  benennen können.
- **Account Health als stille Betreiber-Kennzahl** (Anker: 80 % pünktlich, 95 % mangelfrei — die
  Sanktionsgrenzen, nicht die Ziele). Dazu die kostenlose Entwurfsregel, die Whatnot am 13.02.2026
  selbst nachgezogen hat: **eine Kennzahl darf nur messen, was der Verkäufer beeinflussen kann.**
  Verkäufer, die pünktlich abgaben, wurden vorher von verspäteten Carrier-Scans bestraft.
- **„Estimated" gegen „Completed Earnings"** im Verkäufer-Dashboard. Ein Verkäufer, der Geld
  erwartet, will wissen **wann** — nicht wie hoch die Kurve ist. Braucht einen Auszahlungsweg.
- **Nachricht-Anfragen von Fremden getrennt.** Bei Berkat wiegt das schwerer als bei Whatnot: Weil
  Privatangebote „Nachricht schreiben" statt „Kaufen" zeigen, **ist der Posteingang der
  Verkaufskanal**. Bemerkenswert dazu: Whatnot verbietet in DMs ausdrücklich Zahlung, Verkauf und
  Kontaktdaten außerhalb der Plattform — „wir können Streit nicht schlichten, wenn er außerhalb
  stattfindet". Berkat drängt den Privathandel derzeit genau dorthin. Das ist keine Empfehlung,
  sondern eine Konsequenz von A1: Mit einem funktionierenden Kauf-Knopf löst sich es von selbst.

---

### 4. Was ausdrücklich NICHT zu übernehmen ist

- **Mystery Box, Blind Box, Breaks, „Überraschungssets".** Steht auf der Ausschlussliste, und das
  Material stützt die Entscheidung, statt sie nur zu bestätigen: Whatnot muss Zufallsprodukte in
  **mindestens fünf getrennten Richtlinien** gesondert behandeln — aus dem verkäufergeführten
  Support herausnehmen, vom Widerrufsrecht ausnehmen, eine eigene Wertermittlung mit
  letztverbindlicher Entscheidung aufbauen, einen eigenen Stornoweg für nicht gefüllte Breaks bauen,
  eine eigene Kategorie-Richtlinie für Münzen schreiben. Das ist der laufende Regelaufwand, den der
  Verzicht spart, **sichtbar an den Ausnahmelisten, nicht behauptet.**
  ⚠️ **Ableitung, die fehlte:** Deutsche Rezensenten zählen auch **Käufer-Gewinnspiele** zum
  Loscharakter, weil sie als Köder vor dem Einsatz stehen. Berkats Gewinnspiel muss deshalb strikt
  einsatzfrei bleiben — kein Kauf, kein Kommentarzwang, keine Kopplung an ein Gebot. Und das Verbot
  gehört in die **Einstellregeln**, sonst kommt „Überraschungspaket" als selbst eingestellter Artikel
  durch die Hintertür.
- **Klarna, Affirm, BNPL.** Riba, rote Linie. Whatnot führt beides in der deutschen Liste.
- **Guthaben oder Gutscheine mit Geldwert als Zahlmittel.** 22 Beschwerden in vier Ländern, vier
  verschiedene Fehlerbilder: 10 £ Guthaben **und** 12 £ von der Karte abgebucht; „20 € Gutschein
  stand da, und jetzt soll ich 9 € bezahlen"; Guthaben gilt nur für die Ware, nicht den Versand.
  Berkat ist durch den Coin-Ausschluss strukturell immun. Die einzige offene Flanke ist die Anzeige
  in `app/rewards.tsx`: **Wenn dort je ein Betrag steht, muss der angezeigte der abgerechnete sein**,
  und es muss vorher dastehen, ob Versand mitgedeckt ist.
- **Rewards Club mit Saison-Reset und „Häufigkeit der Aufrufe".** Aufgebauten Status alle drei Monate
  wegzunehmen erzeugt Verlustangst; Belohnung fürs bloße Zuschauen ist Aufmerksamkeits-Prämie.
  Beides verstößt gegen die ethische Linie. Der brauchbare Kern — **Zugang zu geschlossenen
  Sendungen für Stammkunden** — passt dagegen zu Frauen-Only und ist Zugehörigkeit statt Rabattjagd;
  er gehört nach C, sobald es einen Stammkundenstamm gibt.
- **Community Boost.** Der Fund, den kein Blickwinkel gehoben hat und der am dichtesten an Berkats
  Grenze liegt: Zuschauer zahlen Beiträge, die „wie Trinkgeld funktionieren, aber auf einen
  Werbe-Boost mitten in der Sendung einzahlen" (`.../articles/30706277083021`, 30.07.2026) — mit
  Zielbalken, animiertem Rahmen, „Booster"-Abzeichen. Ziel-Mechanik plus Status plus Geld ohne Ware,
  direkt neben Berkats echtem Trinkgeld. **Nicht bauen.** Berkats Trinkgeld ist Dank, kein Einsatz.
- **Bezahlte Sichtbarkeit / Boost-Ranking.** Whatnots Promote Tools verteilen Plätze im Feed über
  eine **Gebotsauktion** („based on your bid competitiveness"), nur US/CA/UK. Der meistgenannte
  Abwanderungsgrund kleiner Verkäufer ist genau das: Geld ausgeben, um überhaupt vorzukommen. *(Zur
  Ehrlichkeit: Die Rezensenten-Klage „Sichtbarkeit ist käuflich" ist für den deutschen Markt derzeit
  gar nicht zutreffend, weil das Produkt dort nicht verfügbar ist.)*
- **„Lifetime Spend Distribution", Rewards-Stufen der Anwesenden, Peer-Benchmarks.** Dem Verkäufer
  zu zeigen, wie zahlungskräftig die gerade Anwesenden sind, ist in einer Gemeinschaft, in der man
  sich beim Namen kennt, eine Zumutung — Whatnot verbirgt es selbst, wenn zu wenige im Raum sind.
- **Öffentliche Fünf-Stufen-Ampel mit Sperrandrohung.** Eine Beschämungsmaschine unter Menschen, die
  sich persönlich kennen. Die Zahlen führt der Betreiber; dem Verkäufer zeigt man den nächsten
  Schritt. *(Whatnot selbst zeigt beide Quoten nur dem Verkäufer, nicht den Käufern — das ist der
  übernehmbare Teil.)*
- **Varianten und Bestandsführung.** Bis zu 2.000 Kombinationen pro Angebot. Bei Secondhand
  existiert jedes Stück einmal; Whatnot führt das Feld selbst nur als Optionalfeld. Der einzige
  interessante Splitter ist die **Größenanfrage während der Sendung** — bei Berkat keine
  Variantenauswahl, sondern ein leichtes Signal „Hast du das in 38?", das im Chat sonst untergeht.
- **Shopify-Vertriebskanal und Warenwirtschafts-Schnittstelle.** Zielt auf Serienhändler mit
  Lagersystem — weder Berkats Markt noch mit dem Verzicht auf Bestandsführung vereinbar. Die
  Reihenfolge lautet: erst Auszahlung, dann alles andere.
- **CSV-Massenimport.** Setzt Desktop und öffentlich erreichbare Bild-URLs voraus, die Berkats
  Verkäuferinnen am Handy nicht haben. Der Weg zur schnellen Massenanlage führt über die Kamera.
  *(Zwei Spalten der deutschen Vorlage sind trotzdem eine Notiz wert: „Stückpreis" — der
  Einkaufspreis, aus dem Whatnot die Marge rechnet — und „Artikelnummer".)*

---

### 5. Was daraus folgt

1. **Entscheiden, wie im Testlauf Geld fließt** — Kommission, Berkat als Verkäufer. Ohne das endet
   jeder Zuschlag bei fremder Ware in einer DM, und `checkout_enabled` sperrt korrekt, aber tödlich.
   Keine Zeile Code, aber die Voraussetzung für alles Weitere.
2. **Den Käuferschutz-Satz schreiben** — drei benannte Fälle, eine Zusage, die man halten kann.
   Whatnot stellt ihn im deutschen Store an Position 2 von 5; das ist der Hinweis, wie sehr dieser
   Markt zuerst Sicherheit kauft. Dazu die zwei Fristen (30 / 14, das Frühere) und der
   Trinkgeld-Ausschluss. Fällig **vor** dem ersten Drittverkäufer.
3. **Die zwei Prüf-Blocker schließen**, bevor die App aus TestFlight herauswächst: **Kontolöschung
   in der App** (Apple 5.1.1(v), DSGVO Art. 17 — heute nicht vorhanden) und die **Altersfrage**
   (Whatnot: mindestens 13; Berkat hat kein Geburtsdatum, und ein Gebot Minderjähriger ist nach
   §§ 106/110 BGB schwebend unwirksam).
4. **Den Gewinnspiel-Gewinn in den normalen Versandpfad legen.** `draw_live_giveaway` setzt heute nur
   `winner_id`; eine Bestellung mit 0 € Warenwert schließt den häufigsten Manipulationsvorwurf gegen
   Whatnot strukturell, statt ihn nur zu verbieten. Der billigste Fund dieser Runde.
5. **Versand in Stufen, mit Brief-Preis, und ein Packzettel je Sammelkorb-Paket.** Der Einzug läuft
   bereits; was fehlt, sind Zeilen in `berkat_shipping_rates` und ein Zettel, der das Paket
   beschreibt. Bei 6-€-Ware entscheidet das darüber, ob überhaupt etwas verkauft wird.

*Nicht auf dieser Liste, obwohl die Vorarbeit es fordert:* Vorabgebots-Ansicht, Ereignis-Strom und
Versandeinzug — die stehen im Repo. Und die Empfehlung, „Bestellungen" neben den Umsatz zu setzen,
war schon einmal geprüft und richtig abgelehnt.

---

### Quellen

**App Store, v26.34.5 (veröffentlicht 20.08.2026), abgerufen 21.08.2026**
- `itunes.apple.com/search?term=whatnot&entity=software&country=…` für us, gb, de, fr, nl, ca, au,
  at, ch — Felder `description`, `advisories`, `contentAdvisoryRating`, `averageUserRating`,
  `userRatingCount`, `languageCodesISO2A`
- Store-Screenshots DE (5), US (5), FR (4) über `1000x0w.png`; der Käuferschutz-Screenshot fehlt in
  FR und NL vollständig
- Rezensions-RSS: 128 DE, 500 US, 450 GB (`sortBy=mostRecent`), roh gelesen

**Hilfe-Center `help.whatnot.com` (Stand jeweils angegeben)**
- `/articles/4847069165965` Gebühren EU/UK (11.08.2026) · `/articles/360061604191` Auszahlung
  (13.08.2026) · `/articles/9778927885581` Show anlegen (10.08.2026) · `/articles/9779931101837`
  Auktion starten (18.07.2026) · `/articles/14932924544141` Bieten (14.05.2026)
- `/articles/360061194552` Käuferschutz (17.06.2026) · `/articles/360061195412` Verkäuferschutz
  (17.06.2026) · `/articles/360061603971` Storno (12.08.2026) · `/articles/9810585575693`
  Storno annehmen/ablehnen (13.08.2026)
- `/articles/9779149424269` Angebote anlegen (07.08.2026) · `/articles/37012119661709` Weekly
  Bundling (13.05.2026) · `/articles/26310231704333` Free Pickup (21.01.2026) ·
  `/articles/34468945178381` Account Health (18.08.2026) · `/articles/31084236928909` Premier Shop
  (18.08.2026) · `/articles/8442834600333` Verkäufer-Antrag (10.08.2026)
- `/articles/23951958152461` Show-Management inkl. Frage-Hervorhebung (21.04.2026) ·
  `/articles/21988369770637` Moderations-Befehle (18.03.2026) · `/articles/47552166935181`
  Live-Analytics (15.08.2026) · `/articles/12165139226893` Aufzeichnung und Video-Quittung
  (17.03.2026) · `/articles/7692049973133` Kamera-Werkzeuge (19.03.2026) ·
  `/articles/30706277083021` Community Boost (30.07.2026)
- Deutsch: `/hc/de/articles/24898437653261` Impressum (**13.03.2024**) ·
  `/hc/de/articles/21927521730317` Versandpreise DE · `/hc/de/articles/9429224729101`
  Benachrichtigungen · `/hc/de/articles/9780885421069` Lesezeichen ·
  `/hc/de/articles/37362516423053` Zahlungsmethoden

**Web `whatnot.com/de-DE`, 21.08.2026** — `/browse` (DOM-Zählung: 0 Links auf `/live/`),
`/tag/womens_fashion` (Filtergruppen einzeln aufgeklappt), `/search?query=abaya`, zwei
Artikelseiten, `/user/dealhubuk` mit `/shop` und `/reviews`

**Verkäufer-Blog `blog.teamwhatnot.com` — Selbstauskunft, ungeprüft.** Alle Wachstums- und
Wirkungszahlen dieser Analyse, die aus dieser Quelle stammen, sind im Text als solche gekennzeichnet.

**Berkat-Repo, am 21.08.2026 gegengeprüft** — `components/PrepareSheet.tsx`,
`components/EarningsSheet.tsx`, `lib/useShowEarnings.ts`, `lib/usePrebid.ts`,
`components/RatingStars.tsx`, `app/live/[id].tsx:1051`, `app/order/[id].tsx:140`,
`supabase/functions/create-checkout-session/index.ts:203-225`, Migrationen `20260813233000`
(Gewinnspiele), `20260815180000`/`20260815190000` (Versand), `20260816160000` (Bewertungen),
`20260817120000` (Kassen-Schranke), `20260819150000` (Vorabgebote); `HANDOFF.md` Abschnitt
„Was bewusst NICHT gebaut wurde"
---

## Zehnte Analyse: wie ein Verkäufer bei Whatnot Artikel anlegt (21.08.2026)

Quelle: fünf Bildschirmfotos aus der laufenden App (Verkäufer-Sicht im Live-Raum), von Zaur
bereitgestellt. Es ist die erste Analyse, die den **Anlege-Weg** zeigt — bisher war nur der
Verkäufer-Bereich als Übersicht bekannt (sechste Analyse).

### Was auf den Bildern steht

**1 · „Live Listings" — die Warteschlange im Raum**

```
        Live Listings                      ✕
 ┌──────────────────────────────────────────┐
 │ 🔍 Search…                               │
 └──────────────────────────────────────────┘
  Auction   Buy Now   Giveaway   Sold   Offers
  ────────
  1 Item
 ┌────────┐  LEGO city space
 │        │  US$10
 │  Bild  │  0 bids
 │        │
 └────────┘        [ Start Auction ]  (…)  (📌)
 ──────────────────────────────────────────────
 ┌────────┐  LEGO gardening …                 (+)  ← gelb, schwebend
```

Fünf Reiter nach **Zustand**, eine Suche, große quadratische Bilder, und die drei Handlungen je
Artikel stehen auf einer **eigenen Zeile** unter dem Text: Starten, Mehr, Anheften.

⚠️ „1 Item" steht über einer Liste mit sichtbar drei Artikeln. Was die Zahl zählt, ist aus dem Bild
**nicht erkennbar** — ich nenne sie hier, ohne sie zu deuten.

**2 · Das „+" öffnet drei benannte Wege**

```
                Create
  ⚡  Create Temporary Listing
      Quickly add a listing that will expire when your show ends.
  🏷  Create Quality Listing
      Create a listing with photos and details.
  ⤵  Import from Inventory
```

**3–5 · „Create Quality Listing"** — ein langes Formular mit klebender Fußzeile:

| Abschnitt | Felder |
|---|---|
| Media | Ablagefläche „Photos / Scan", **„1 photo required"**, Zähler „Photos: 0/8", darunter Chips **„Recent Categories"** |
| Product Details | Category\* (Auswahl), Title\*, Description\*, Quantity Available (−/+) |
| Pricing | Segment **Buy It Now / Auction / Giveaway**, Starting Bid\*, Schalter **Sudden Death**, Schalter **Reserve for Live** + **Select Show\*** |
| Shipping | Versandprofil |
| Fußzeile | `Cancel` · `Publish` (blass, bis die Pflichtfelder stehen) + „Complete key information fields … counts towards your Premier Shop status." |

Das Blatt „Add Media" bietet: Upload Media · Take Photos · **Scan a Barcode or Slab** („New") mit
dem Zusatz „To import photos and details".

### ⚠️ Der wichtigste Fund: „Reserve for Live" ist ein SCHALTER, kein Umzug

Das ist der Befund, der Berkat unmittelbar betrifft — und er kam am selben Tag, an dem wir die
Regal-↔-Show-Brücke gebaut haben (Übergabe 62).

Bei Whatnot existiert ein Artikel **einmal**. Ein Schalter am Artikel entscheidet, ob er nur
innerhalb einer Sendung kaufbar ist, und ein Auswahlfeld daneben sagt, **in welcher**. Beides
**beim Anlegen**, in derselben Maske wie Preis und Bild.

Berkat modelliert dieselbe Sache als **Zustandswechsel**: `listed` ↔ `scheduled`, verschoben durch
zwei RPCs, ausgelöst an vier Oberflächen. Fachlich ist das Ergebnis dasselbe, und unser Weg hat
einen echten Vorteil — der Doppelverkauf ist über `live_auctions_shelf_check` **strukturell**
ausgeschlossen, weil eine Zeile nicht beides sein kann.

**Aber eine Lücke bleibt, und die Bilder zeigen sie:** Bei Berkat kann man einen Artikel **nur
nachträglich** einer Show zuordnen. Wer im Regal-Formular etwas einstellt, hat dort keine
Möglichkeit zu sagen „das ist für Samstag". Er muss speichern, den Verkaufen-Reiter öffnen, den
Termin antippen, „Aus dem Regal holen" — für etwas, das er in dem Moment schon wusste, als er es
eintippte.

> **Die Lehre: Eine Zuordnung, die der Mensch beim Anlegen bereits im Kopf hat, gehört ins
> Anlege-Formular.** Ein nachträglicher Weg ist die Reparatur, kein Ersatz.

Der Bau dafür ist klein, weil die Serverseite steht: ein Auswahlfeld „Für welchen Abend?" im
`StandingComposer`, und nach `create_standing_listing` ein `move_listing_to_show` mit der Termin-ID.
Zwei Rufe statt einem — akzeptabel, weil der zweite fehlschlagen darf, ohne den ersten zu verlieren.

### Drei Wege, ein Knopf — und Berkat hat alle drei, aber an drei Orten

Whatnots „+" benennt die Wahl, die ein Verkäufer ohnehin trifft:

| Whatnot | Berkats Entsprechung | Wo sie liegt |
|---|---|---|
| Create **Temporary** Listing | „Artikel auflegen" im Studio (`create_live_auction`) | Verkaufen-Reiter, nur bei laufender Show |
| Create **Quality** Listing | `StandingComposer` — Bilder, Zustand, Ort, Beschreibung | eigener Bildschirm `/shelf` |
| **Import from Inventory** | „Aus dem Regal holen" (seit heute, Übergabe 62) | Vorbereiten-Blatt und Artikel-Zettel |

Alle drei existieren. Keiner von ihnen weiß vom anderen. Ein Verkäufer, der zum ersten Mal etwas
anlegen will, muss **wissen**, welcher der drei Orte zu seinem Vorhaben passt — Whatnot fragt ihn
stattdessen in drei Zeilen mit je einem erklärenden Satz.

⚠️ **Das ist dieselbe Fehlerklasse wie Fund 1 des Geräte-Durchlaufs** (Übergabe 62): zwei
Terminlisten mit verschiedenen Fähigkeiten. Auffindbarkeit hängt daran, durch welche Tür man kam.

### Was Berkat REICHER hat — und warum das kein Zufall ist

Ein direkter Feldvergleich `Create Quality Listing` gegen `StandingComposer`:

| Feld | Whatnot | Berkat |
|---|---|---|
| Bilder | bis 8, **eines Pflicht** | bis 8, **keines Pflicht** |
| Kategorie | Pflicht | freiwillig |
| Beschreibung | Pflicht | freiwillig |
| Menge | ja | nein (jedes Stück eine Zeile) |
| **Zustand** | nein | **ja** |
| **PLZ / Ort** | nein | **ja** |
| **Anbietertyp (privat/gewerblich)** | nein | **ja** |
| Versandprofil | ja | Zonen-Pauschale, nicht je Artikel |

Die drei Felder, die nur Berkat hat, sind **kein Mehrwert aus Fleiß, sondern deutsches Recht**:
Zustand und Anbieterkennzeichnung folgen aus Art. 246d § 1 EGBGB und dem Widerrufsrecht, der Ort
aus der Anbieterkennzeichnung. Whatnot braucht sie in den USA nicht. **Wer Berkats Formular als
„zu lang" kürzen will, muss wissen, welche Zeile er streicht.**

Umgekehrt sind zwei von Whatnots Pflichtfeldern ein billiger Gewinn: **ein Bild** und **eine
Kategorie**. Ohne Bild ist ein Regal-Artikel im Raster eine leere Kachel; ohne Kategorie ist er
über die Kategorie-Leiste unauffindbar. Beides steht heute frei — und die Testware zeigt genau
diese Löcher.

### Was NICHT für Berkat ist

- **Scan a Barcode or Slab.** Es importiert Fotos und Daten zu einem Produkt mit Strichcode oder
  einer gerateten Sammelkarte. Berkats Ware ist gebrauchte Kleidung, Parfüm, Deko — Einzelstücke
  ohne Katalog-Eintrag. Der Weg hätte hier nichts zu importieren.
- **„Premier Shop status".** Dieselbe Familie wie „Account Health" aus der sechsten Analyse, und
  dieselbe Antwort: sinnvoll ab echten Verkäufern mit echten Sendungen, nicht in Phase 0. Zusätzlich
  ist die Formulierung eine Statuswährung — Design-Gesetz 4 verlangt hier Vorsicht.
- **Sudden Death.** Es ist das **Gegenteil** von Anti-Snipe: Wer zuletzt bietet, gewinnt sofort.
  Berkat verlängert bewusst um 10 Sekunden, damit niemand durch Timing statt durch Zahlungsbereitschaft
  gewinnt. Whatnot macht es zur Wahl des Verkäufers; Berkat sollte es nicht übernehmen. Die schon
  notierte Kleinigkeit „Anti-Snipe-Zeit wählbar" bleibt davon unberührt — das ist eine Länge, keine
  Umkehr.
- **Menge je Artikel.** Passt zu Neuware aus einem Karton, nicht zu Einzelstücken. Würde bei einer
  Auktion sofort die Frage „wer gewinnt welches Stück" aufwerfen.

### Was der Artikel-Zettel im Raum von Whatnot lernen sollte — später

Heute nicht dringend, weil eine Berkat-Show drei Artikel hat und keine dreißig. Ab dann aber
zwingend, und dann in dieser Reihenfolge:

1. **Reiter nach Zustand** (kommt noch / verkauft). Eine flache Liste mit dreißig Zeilen und einem
   Statuswort je Zeile ist ab etwa zehn Artikeln nicht mehr überschaubar.
2. **Suche im Zettel.** Aus demselben Grund.
3. **Handlungen auf eine eigene Zeile.** Whatnot setzt „Start Auction", „…" und die Nadel unter den
   Text statt daneben. Berkat quetscht heute Titel, Status und „Starten" in eine Zeile — mit einem
   zweiten Knopf („Ins Regal legen", seit heute) wird das eng.

### Was daraus folgt — nach Nutzen sortiert

1. **Termin-Auswahl ins Regal-Formular** („Reserve for Live"). Der Server kann es bereits; es fehlt
   ein Auswahlfeld. Schließt die Lücke, die Übergabe 62 offen gelassen hat.
2. **Bild und Kategorie zur Pflicht machen** — zwei Zeilen Prüfung, und sie beheben zwei sichtbare
   Löcher (leere Kacheln, unauffindbare Artikel).
3. **Ein gemeinsamer Einstieg mit drei benannten Wegen.** Berkat hat alle drei Wege, aber keiner
   erklärt sich. Whatnots Formulierung ist übernehmbar, die Wege sind es schon.
4. **„Recent Categories"-Chips.** Wer zwanzig Abayas einstellt, wählt zwanzigmal dieselbe Kategorie
   aus 61. Billig, spürbar.
5. Reiter und Suche im Artikel-Zettel — **erst ab echtem Bestand**.

### Quelle

Fünf Bildschirmfotos der Whatnot-App, Verkäufer-Sicht, 21.08.2026: „Live Listings" mit
Reitern und Aktionen je Zeile, das „Create"-Blatt hinter dem „+", „Create Quality Listing"
(Product Details / Pricing / Media) und das Blatt „Add Media".

---

## Elfte Analyse: „Seller Provided Support" — wie ein Streit abläuft (21.08.2026)

Quelle: fünf Bildschirmfotos der Whatnot-App, Verkäufer-Sicht: Posteingang mit drei Reitern, ein
offener Support-Fall und das Erstattungs-Blatt.

⚠️ **Diese Analyse trifft eine Lücke, keine Verbesserung.** Ein `grep` über `apps/berkat` findet
**null** Treffer für Erstattung, Rückgabe oder Reklamation. Berkat hat für den Fall „die Ware kam
kaputt an" **keinen Weg** — weder für den Käufer noch für den Verkäufer, weder in der App noch in
der Datenbank. Wer heute ein Problem hat, schreibt eine Direktnachricht, und Zaur regelt es von
Hand. Das trägt bei fünf Verkäufern und bei fünfzig nicht mehr.

Zugleich steht „Käuferschutz-Zusage formulieren" seit dem 21.08. als **Punkt 1** unter „Danach, nach
Nutzen sortiert" (Übergabe 61) und als **F2** in der Prüfliste — als Entscheidung, nicht als Code.
Diese Bilder zeigen, was die Entscheidung kostet, sobald sie gefallen ist.

### Was auf den Bildern steht

**1 · Drei getrennte Posteingänge**

```
   All Messages | Customer Support | Whatnot Support
 ⚠ Messages from Whatnot, employees of Whatnot, or outside partners
   like postal carriers will never be sent here.
   [Newest ⌄] [Purchases] [Unread]
```

Im Reiter „Whatnot Support" steht der Gegensatz: *„Our team will only contact you through this
inbox or from a whatnot.com email address"* — und die Absender tragen ein **Verifiziert-Häkchen**.

**2 · Der Reiter „Customer Support" trägt Kennzahlen**

```
 Total Support Requests    Response Rate      Customer Satisfaction
          1                    100 %                 100 %
   Last 90 days             Target 95 %           Target 85 %
```

**3 · Der Fall selbst — und er ist KEINE Nachricht**

```
   whatnot_emma
   Lifetime Spend $247 · Refunds 0 · Cancellations 0
        4 total orders     $0 refunded    $0 cancelled

   Request Details                        How to Respond
   The item was damaged in transit            ← Grund aus fester Liste
   „The item got broken in shipping…"         ← Freitext des Käufers
   Items in Request (1)
     [Bild] Apple Wireless Earbuds… #625263584 · $75.46
     [Foto des Käufers]                       ← Beleg

   Quick Actions:  [ Offer a Refund ]  [ Send a Replacement ]
```

**4 · Das Erstattungs-Blatt rechnet vor**

```
 ⦿ Refund the full listing price
   You are responsible for the full refund, including shipping and processing fees.
   ┌ Return the item to me                                    [AN] ┐
   │ A return label will be generated and included in the cost.    │
 ○ Offer a partial refund
   Agree on a partial refund … If declined, a full refund will be
   issued after return.

   Total Refund Cost                                        $75.46
   Your adjusted payout for this order will be             −$4.76
   [ Submit Refund ]
```

### Die vier Ideen, auf die es ankommt

**1 · Ein Streit ist ein OBJEKT, keine Nachricht.**

Der Fall trägt einen **Grund aus fester Liste**, den Freitext des Käufers, die **konkrete
Bestellposition** samt Nummer und Betrag, und **Fotos als Beleg**. Erst dadurch ist er zählbar
(„Total Support Requests"), messbar („Response Rate") und entscheidbar — die zwei Knöpfe darunter
wissen ja, worauf sie sich beziehen.

Eine Direktnachricht kann nichts davon. Sie hat keinen Zustand, keine Verbindung zur Bestellung und
keine Frist.

**2 · Der Verkäufer sieht, WER vor ihm steht — bevor er entscheidet.**

„Lifetime Spend $247, 4 Bestellungen, 0 Erstattungen" beantwortet die Frage, die jeder Verkäufer in
diesem Moment hat: *Ist das ein Stammkunde oder jemand, der das jede Woche macht?* Alle drei Zahlen
liegen in Berkat bereits in `product_orders` — es ist eine Abfrage, kein neues Feld.

⚠️ **Und genau hier ist Berkats Lage anders als Whatnots.** In einer engen Diaspora-Gemeinschaft ist
„diese Person hat dreimal Geld zurückverlangt" kein Datenpunkt, sondern **Gerede**. Whatnots Käufer
sind einander fremd; Berkats kennen sich womöglich. Wer diese Kachel baut, sollte sie auf das
beschränken, was der Verkäufer für SEINE Entscheidung braucht — und das ist die Beziehung zu **ihm**
(„bei dir schon dreimal gekauft"), nicht das Verhalten der Person auf der ganzen Plattform.

**3 · Das Blatt sagt, was es den Verkäufer kostet — vor dem Knopf.**

`Total Refund Cost $75.46` und darunter `Your adjusted payout will be −$4.76`. Die **negative** Zahl
ist der ehrliche Teil: Der Verkäufer zahlt drauf, weil die Gebühren nicht zurückkommen.

> **Das ist die Lehre für die Käuferschutz-Zusage:** Was auch immer Berkat verspricht — der
> Verkäufer muss die Zahl sehen, BEVOR er zustimmt. Eine Zusage, deren Kosten erst auf der
> Abrechnung auftauchen, ist die zuverlässigste Art, einen Verkäufer zu verlieren. Und Verkäufer zu
> halten ist Phase 0.

**4 · Die Eskalationsleiter steht in einem Satz.**

„Teilerstattung — wird sie abgelehnt, gibt es nach Rücksendung die volle." Ein Ablauf, kein
Ermessen. Beide Seiten wissen vorher, wo es endet.

### ⚠️ Der Fund, der nicht in der Gestaltung liegt: Betrugsschutz

Die Warnzeile steht auf **jedem** der drei Reiter, und sie ist keine Höflichkeit:

> „Messages from Whatnot, employees of Whatnot, or outside partners like postal carriers will never
> be sent here."

Dazu der eigene Reiter für echte Support-Post, ein Verifiziert-Häkchen am Absender und die Ansage,
dass Kontakt nur von einer `whatnot.com`-Adresse kommt.

Das ist die Abwehr gegen den häufigsten Marktplatz-Betrug: sich als Plattform ausgeben und zu einer
Zahlung oder Anmeldung außerhalb drängen.

**Berkat ist dafür anfälliger als Whatnot, nicht weniger.** Der ganze Bau steht auf „Vertrauen ist
personal" — Bürgen, Teip, geschlossene Gemeinschaft. Genau diese Nähe macht die Masche wirksam: Eine
Nachricht „hier ist Berkat, dein Konto muss bestätigt werden" wirkt in einer Gemeinschaft, in der
man den Betreiber persönlich kennt, glaubwürdiger als bei einem anonymen Konzern.

Berkat hat heute **eine** Nachrichtenliste (geteilt mit Serlo), keinen Begriff von „offiziell", kein
Häkchen und keinen Hinweis. **Das ist der billigste und wertvollste Punkt dieser ganzen Analyse.**

### Was für Berkat NICHT gilt

- **Rücksendeetiketten.** Whatnot erzeugt eines und rechnet es in die Erstattung ein. Berkats
  Versand ist eine Zonen-Pauschale ohne Anbindung an einen Dienstleister
  (`berkat_shipping_rates`) — es gibt nichts, was ein Etikett erzeugen könnte. Eine Rücksendung
  müsste vorerst „ihr regelt das miteinander" heißen.
- **Ein eigener Reiter „Berkat Support".** Es gibt kein Support-Team, es gibt Zaur. Ein Reiter, der
  eine Abteilung suggeriert, verspricht mehr als da ist.
- **„Customer Satisfaction" mit Zielwert.** Braucht Volumen. Bei drei Fällen im Quartal ist eine
  Prozentzahl keine Auskunft, sondern Zufall — dieselbe Begründung wie bei „Account Health"
  (sechste Analyse) und bei den Kategorie-Zählern.
- **„Send a Replacement".** Setzt Lagerware in Stückzahlen voraus. Berkats Ware sind Einzelstücke;
  einen Ersatz gibt es meistens gar nicht.

### Was daraus folgt — nach Nutzen sortiert

1. **Die Warnzeile und der Begriff „offiziell".** Ein fester Hinweis über der Nachrichtenliste
   („Berkat schreibt dir nie hier und fragt nie nach Passwort oder Zahlung") und, sobald es je ein
   offizielles Konto gibt, ein Häkchen daran. Kostet fast nichts, verhindert den einen Angriff, der
   das Produkt an seiner Wurzel trifft. **Unabhängig von allem anderen baubar.**
2. **Die Käuferschutz-Zusage entscheiden** (F2, Übergabe 61) — und dabei den Satz aus Punkt 3
   mitnehmen: Der Verkäufer sieht die Zahl vor dem Knopf. Ohne diese Entscheidung ist alles Weitere
   Code ohne Regel.
3. **Der Streit als Objekt**, sobald es echte Bestellungen gibt: Grund aus fester Liste, Bezug auf
   die Bestellposition, Fotos, Zustand. Die Tabelle ist klein; der Aufwand steckt in den Zuständen
   und in der Frist.
4. **Käufer-Kontext für den Verkäufer** — aber auf die Beziehung zu IHM beschränkt, nicht auf die
   Plattform (siehe die Warnung oben).
5. **Antwortquote mit Zielwert** — erst mit Volumen, und dann als Führung („woran wirst du
   gemessen"), nicht als Punktestand.

### Quelle

Fünf Bildschirmfotos der Whatnot-App, Verkäufer-Sicht, 21.08.2026: Posteingang „All Messages",
Reiter „Customer Support" mit Kennzahlen, Reiter „Whatnot Support", ein offener „Support Request"
mit Käufer-Kontext und Belegfoto, sowie das Blatt „Offer a Refund".

### Nachtrag: die GESTALTUNG dieser fünf Bildschirme

Der Teil oben beschreibt die Mechanik. Hier steht, wie sie gebaut ist — und was davon Berkat
betrifft.

**1 · Farbdisziplin: Gelb kommt höchstens EINMAL pro Bildschirm vor.**

Im Posteingang trägt es der „Compose"-Knopf, im Erstattungs-Blatt „Submit Refund". Die beiden
„Quick Actions" im Streitfall — *Offer a Refund*, *Send a Replacement* — sind **grau**, obwohl sie
die wichtigsten Knöpfe des Bildschirms sind. Der Grund ist erkennbar: Sie sind **Wahlmöglichkeiten**,
die Verpflichtung kommt erst im Blatt danach.

Das ist wörtlich Berkats eigenes Gesetz („Gold trägt den Kauf") — Whatnot wendet es strenger an, als
Berkat es bis heute tat. Genau daran ist am 21.08.2026 die goldene Kalender-Scheibe auf dem
Verkäufer-Profil gescheitert (Übergabe 62, Fund 5).

**2 · Eine Kennzahlen-Karte, zwei Bedeutungen.**

Derselbe Baustein trägt einmal die Zahlen des **Verkäufers** (Anfragen / Antwortquote /
Zufriedenheit) und einmal die des **Käufers** (Lifetime Spend / Refunds / Cancellations). Immer
dreispaltig, ohne Trennstriche, und immer dreistufig:

```
   kleines graues Label        ← was ist das
       GROSSE ZAHL             ← der Wert
   kleine graue Zeile          ← Einordnung („Last 90 days", „Target 95 %")
```

⚠️ **Die dritte Stufe ist der eigentliche Trick.** „100 %" allein ist eitel; „100 % · Target 95 %"
ist eine Auskunft darüber, ob es reicht. Berkat hat denselben Baustein auf dem Verkäufer-Profil
(★ 5,0 · *2 Bewertungen* — Symbol, Zahl, Einordnung) und damit dieselbe Sprache. Wer die Karte
anderswo wiederverwendet, sollte die dritte Zeile nicht weglassen.

**3 · Der Warnhinweis ist je Reiter ein anderer.**

Randlos über die volle Breite, ohne Rundung, hellgraue Fläche, Warndreieck links, drei Zeilen grau.
Nicht wegtippbar. Und im Reiter „Whatnot Support" steht der **umgekehrte** Satz („nur hier oder von
einer whatnot.com-Adresse"). Ein Hinweis, der weiß, wo er steht, statt eines globalen Satzes.

**4 · Der Streitfall ist eine KARTE im Nachrichtenstrom.**

Der stärkste Gestaltungszug der fünf Bilder. Der Fall steht dort, wo eine Sprechblase stünde — mit
Datumstrenner darüber, Absendername darüber, kleinem Avatar links. Er hat also seinen Platz in der
Zeit. Aber statt Text trägt er Überschrift, Grund, Zitat, Positionsliste und Nummer.

Das Belegfoto ist **eine eigene Nachricht** darunter, nicht Teil der Karte — deshalb hat es seinen
eigenen Avatar daneben. Sauber getrennt: Die Karte ist die Behauptung, das Foto der Beleg.

**5 · Auswahlknöpfe stehen RECHTS, nicht links.**

Ungewöhnlich, und der Grund ist Typografie: Unter jeder Option steht ein Erklärsatz. Läge der
Auswahlknopf links, müsste der Satz entweder eingerückt werden oder mit dem Titel kollidieren. Rechts
bleibt der ganze Textblock bündig links.

**Verschachtelung drückt Whatnot durch einen KASTEN aus, nicht durch Einrückung:** „Return the item
to me" liegt in einem gerahmten Feld unter seiner Elternoption. Berkat macht dasselbe schon bei
`offerRow` im Regal-Formular (Text links, Schalter rechts).

**6 · Reiter: Text mit Unterstrich, waagerecht rollbar.**

Der dritte Reiter ist **angeschnitten** — das ist die Auskunft „da ist noch mehr", genau wie beim
Demnächst-Roller (Übergabe 62, Fund 6). Aktiv = fett schwarz plus Unterstrich; inaktiv = grau. Keine
Pillen, keine Fläche. Berkat nutzt dasselbe auf dem Verkäufer-Profil.

**7 · Der schwebende Knopf ist BESCHRIFTET — hier.**

„✎ Compose" als Pille mit Text. In den „Live Listings" (zehnte Analyse) war derselbe Knopf ein
nacktes „+". Der Unterschied ist der Kontext: Im Artikel-Zettel ist offensichtlich, was ein Plus tut;
in einem Posteingang ist es das nicht. **Beschriftung dort, wo der Ort die Handlung nicht schon
erklärt.**

**8 · Offizielle Konten sehen anders aus als Menschen.**

Whatnot Support hat ein **rundes Quadrat** mit der Marke, Menschen haben **Kreise**. Dazu ein Häkchen
hinter dem Namen. Die Form allein trägt schon die Unterscheidung, bevor jemand den Namen liest.

Und `hltoolsdirect` trägt einen **Lorbeerkranz um den Avatar** statt eines Abzeichens daneben —
Status als Schmuck am Bild, nicht als weitere Spalte in einer ohnehin engen Zeile.

**9 · Die Geld-Zeile: Bezeichnung links, Betrag rechts, Folge als graue Unterzeile.**

```
 Total Refund Cost ⓘ                       $75.46
 Your adjusted payout for this order will be −$4.76
```

⚠️ **Die negative Zahl ist NICHT rot.** Sie ist eine Auskunft, kein Fehler. Rot hätte daraus einen
Alarm gemacht, und der Verkäufer hätte den Knopf darunter als gefährlich gelesen statt als teuer.
Berkat hat dieselbe Linie („Rot ist die laufende Uhr, nie Fläche") und dieselbe Ausnahme nur beim
Löschen des Kontos.

### ⚠️ Zwei Lücken in Berkats eigenem Posteingang, beim Vergleich gefunden

Der Vergleich ging an `app/messages/index.tsx`, und dort steht in jeder Zeile genau zweierlei:

```
  [Avatar 46]  username
               vor 3 Std
```

| | Whatnot | Berkat |
|---|---|---|
| Vorschau der letzten Nachricht | ja, eine Zeile, gekürzt | **fehlt** |
| Ungelesen erkennbar | Punkt am rechten Rand je Zeile | **fehlt** — es gibt nur die Gesamtzahl an der Glocke |
| Zeitstempel | **neben** dem Namen (`name · 15m`) | in einer eigenen zweiten Zeile |

**Die fehlende Vorschau ist die teurere von beiden.** Ohne sie ist der Posteingang nicht sortierbar:
Man muss **jede** Unterhaltung öffnen, um zu wissen, worum es geht. Bei drei Unterhaltungen fällt das
nicht auf, bei dreißig ist die Liste wertlos. Und Berkats zweite Zeile ist ohnehin schon da — sie
trägt nur die Uhrzeit statt des Textes.

Der fehlende Ungelesen-Punkt ist der zweite Teil desselben Problems: Der Zähler an der Glocke sagt
„drei neue", die Liste sagt nicht, **welche**.

Beides ist unabhängig von der ganzen Streit-Maschinerie baubar und braucht keine Migration —
`messages` trägt den Text, und `useDirectMessages` liest die Unterhaltungen ohnehin schon.

### Zweiter Durchgang durch dieselben fünf Bilder (21.08.2026, nachts)

Auf Nachfrage noch einmal angesehen, diesmal jede Behauptung gegen Berkats Code geprüft statt
vermutet. Das Ergebnis stellt die Rangfolge um.

#### ⚠️ Der Fund, der alles andere schlägt: `messages.image_url` GIBT ES SCHON

Whatnots ganzer Streit-Ablauf ruht auf **einem Foto des Käufers** — „es kam kaputt an" plus Beleg.
Berkats Nachrichten sind reiner Text, dachte ich. Am Schema-Abzug nachgesehen:

```sql
CREATE TABLE "public"."messages" (
  … "content" "text" NOT NULL,
      "image_url" "text",        ← existiert, von Serlo angelegt
```

Und weiter, in `lib/useDirectMessages.ts`:

```ts
.select('id, conversation_id, sender_id, content, image_url, created_at, read')
export type DirectMessage = { … image_url: string | null; … }
```

**Die Spalte ist da, die Abfrage holt sie, der Typ trägt sie — und kein Bildschirm zeigt sie an.**
Es gibt auch keinen Weg, eine zu senden.

Das ist wörtlich die Fehlerklasse aus Übergabe Abschnitt 3 („Ein Feld, das geschrieben und nie
gelesen wird"), nur spiegelverkehrt: Die Kette ist an **jedem** Glied vollständig außer am letzten.
Die Probe von damals gilt unverändert:

> **Zeig mir den Bildschirm, auf dem dieser Wert steht.**

Es gibt ihn nicht. Damit ist „der Käufer kann zeigen, was kaputt ist" **keine Migration und keine
neue Tabelle**, sondern zwei Handgriffe im Client: senden (`pickAndUpload` gibt es, `r2-sign` auch)
und in der Blase zeichnen.

⚠️ **Und es ist der einzige Teil des Streit-Ablaufs, der VOR der Käuferschutz-Entscheidung gebaut
werden kann** — weil er nichts verspricht. Ein Foto ist ein Beleg, keine Zusage.

⚠️ **Aber `messages` gehört Serlo mit.** Serlos App und Web lesen dieselbe Tabelle. Bevor Berkat
`image_url` schreibt, gehört geprüft, was Serlos Clients mit einer Zeile ohne `content` tun — eine
Nachricht, die dort als leere Blase erscheint, wäre ein Fehler in einer ausgelieferten App.

#### Wo Berkat sonst schlechter ist

| | Whatnot | Berkat |
|---|---|---|
| **Datumstrenner im Verlauf** | „Today, 01:10 PM" mittig | **fehlt** — jede Blase trägt ihre Uhrzeit, aber nie den Tag |
| **Sortieren / Filtern im Posteingang** | `Newest ⌄` · `Purchases` · `Unread`, und der Satz wechselt je Reiter | **gar nichts** |
| **ⓘ an erklärungsbedürftigen Zahlen** | dreimal auf zwei Bildschirmen, immer gleich | nirgends — dabei hat Berkat genau solche Zahlen |
| **Farbe für „Hilfe/Verweis"** | Blau, streng getrennt von Gelb (Verpflichtung) und Grau (Wahl) | keine eigene; `ui.brand` trägt Verweise **und** aktive Chips |
| **Abschnitts-Überschrift über Handlungen** | „Quick Actions" | Knöpfe stehen ohne Ansage da |

**Der Datumstrenner ist der billigste davon** und wird mit der Zeit teurer: Eine Unterhaltung, die
sich über Wochen zieht, ist ohne ihn nicht lesbar — man sieht „14:20" und weiß nicht, ob das heute
oder im Juli war.

**Der ⓘ-Gedanke ist ein System, kein Symbol.** Whatnot setzt ihn überall dort, wo eine Zahl stimmt,
aber ihre Grundlage nicht sichtbar ist („Response Rate", „Customer Satisfaction", „Total Refund
Cost"). Berkat hat davon mindestens drei: **„Versandzeit < 1 Std"** (woraus gerechnet?),
**„★ 5,0"** (aus zwei Bewertungen — steht daneben, gut), **„Umsatz"** in der Live-Leiste (brutto?
nach Versand? vor Gebühren?). Bei der Umsatz-Zahl ist es keine Kosmetik: Der Verkäufer trifft
danach Entscheidungen.

#### Wo Berkat BESSER ist — und was man deshalb nicht „verbessern" darf

**Die Zeitangaben.** Whatnot zeigt „15m", „29m", „10/7/25" — eine Zahl mit Buchstabe und ein
US-Datum. Berkat hat eine echte Leiter:

```
gerade eben → vor 12 Min → vor 3 Std → gestern → 12.08.
```

Das ist sprachlich richtig, kulturell passend und ohne Nachdenken lesbar. **Nicht anfassen.**

Ebenso besser: Berkats **Leerzustände** sind Sätze mit einer Handlung darin („Schreib ihm die erste
Nachricht 👋"), Whatnots Reiter zeigt bei einem Eintrag einfach weiße Fläche.

#### Was zu übernehmen wäre — neu sortiert

1. **Foto in einer Nachricht senden und anzeigen.** Kein Schema, kein Versprechen, und es ist die
   Grundlage jedes späteren Streit-Ablaufs. ⚠️ Vorher Serlos Umgang mit `image_url` prüfen.
2. **Datumstrenner im Verlauf.** Billig, wird ohne ihn mit jedem Tag schlechter.
3. **Filter „Ungelesen" im Posteingang.** Fast geschenkt, seit die Zeile den Zustand kennt.
4. **ⓘ als System** — zuerst an der Umsatz-Zahl, weil dort Entscheidungen dranhängen.
5. **Eine eigene Farbe für Verweise**, damit `ui.brand` nicht gleichzeitig „aktiv" und „hier
   entlang" bedeutet.

---

## Vierzehnte Analyse: warum die App „unfertig" aussieht (22.08.2026)

Zaurs Satz war nicht „mir fehlt eine Funktion", sondern **„meine App sieht immer noch unvollständig
aus"**. Das ist eine andere Frage als alle dreizehn Analysen davor — die haben Funktionen und
Abläufe verglichen. Diese vergleicht **Fertigkeit**.

### 0. Der Befund in einem Satz

> Der Abstand liegt nicht bei den Funktionen und kaum bei der Gestaltung der einzelnen Fläche.
> Er liegt darin, dass **nichts miteinander fluchtet** — und dass an drei Stellen ein Bild
> vorgesehen ist, wo heute ein Strichsymbol steht.

Zwei der drei Ursachen waren Code und sind am selben Tag behoben. Die dritte ist ein Auftrag an
Zaur, kein Bau.

### 1. Die Quelle

Whatnots **aktuelle** fünf Store-Bilder für Deutschland, Fassung `26.34.5` vom **20.08.2026** —
also zwei Tage neuer als die der achten Analyse. Geholt über die iTunes-Search-Schnittstelle, wie
in HANDOFF 28 beschrieben, und diesmal in 900 px statt als Vorschaubild.

⚠️ **Bild 2 ist neu.** Wo am 21.08. noch der Käuferschutz-Kasten an anderer Stelle stand, liegt
jetzt ein eigener Screenshot dafür an **Position 2 von 5**. Der Marktführer hat seine deutsche
Store-Seite in diesen zwei Tagen umsortiert und Sicherheit noch weiter nach vorn gezogen. Das ist
die zweite unabhängige Bestätigung der Käuferschutz-Entscheidung (Fassung A, HANDOFF 68).

**Und zum ersten Mal die eigene App daneben, nicht aus der Erinnerung:** Berkat lief während der
Analyse im Simulator (`berkattest`, echter Datenstand, 32 Angebote). Startseite, Kategorien-Reiter,
Marktplatz und Artikelseite als Bildschirmfotos. Das ist der Unterschied zu allen dreizehn
Analysen davor — sie verglichen Whatnots Bilder gegen **Berkats Quelltext**.

### 2. ⚠️ Ursache 1: Das Raster war kein Raster

Der teuerste Befund, und er ist in jedem Bildschirmfoto sichtbar, sobald man einmal darauf zeigt.

`ListingCard` ließ den Titel frei wachsen (`numberOfLines={2}`, keine feste Höhe), und Byline wie
Meta-Zeile erschienen nur, wenn sie Inhalt hatten. In einer zweispaltigen Liste heißt das:

```
links:  Byline · Titel (2 Zeilen) · Preis · Meta
rechts: Byline · Titel (1 Zeile)  · Preis · Meta
```

Die beiden Karten sind **verschieden hoch**. Der Preis der linken steht damit 18 Punkte tiefer als
der der rechten, die Meta-Zeilen ebenso — und weil die Reihe so hoch ist wie ihre höchste Karte,
klafft unter der kürzeren eine Lücke, die es unter der anderen nicht gibt. Am echten Datenstand
gemessen: Auf `/shop` standen „85 €" und „54 €" nebeneinander mit **42 Punkten Höhenunterschied**.

Das Auge sucht auf einer Rasterseite Spalten. Findet es keine, liest es „unfertig" — auch wenn
jede einzelne Karte für sich richtig gebaut ist. **Genau das war der Eindruck, um den es ging.**

**Behoben:** Titel auf feste zwei Zeilen (`lineHeight: 18, height: 36`), Byline und Meta-Zeile
stehen immer, auch leer. Kostet bei einem einzeiligen Titel eine Leerzeile; das ist der Preis
dafür, dass ein Raster ein Raster ist.

⚠️ **`lineHeight` MUSS dabeistehen.** Ohne ihn rechnet iOS die Zeilenhöhe aus der Schrift, und die
feste `height` schneidet die zweite Zeile an, statt sie zu tragen.

Dieselbe Krankheit hatte der Kategorien-Reiter: „Mode" ist einzeilig, „Taschen & Accessoires"
zweizeilig — die Bildflächen darunter standen in derselben Reihe auf zwei Höhen. Ebenfalls behoben.

### 3. ⚠️ Ursache 2: Zwei Quellen für dasselbe Kategoriebild

Der Kopf von `theme/categoryArt.ts` verspricht wörtlich:

> „WER DIE FOTOS EINSETZT, ÄNDERT NUR DIESE DATEI … Beide Flächen lesen es über `categoryArt()`."

**Das stimmte für eine der beiden Flächen.** `CategoryRail` auf der Startseite liest sie; der
Kategorien-Reiter hatte eine **eigene `ICONS`-Tabelle**, die weder den Farbton noch das Foto
kannte.

Die Folge wäre erst in dem Moment aufgefallen, in dem es wehtut: Zaur legt seine zwölf
freigestellten Bilder in `categoryArt.ts` — und der **Kategorien-Reiter bleibt, wie er ist**. Also
genau die Fläche, die fast nur aus diesen Kacheln besteht und die neben Whatnots Kachelwand am
deutlichsten abfällt.

Das ist die Familie aus HANDOFF 21 (die viermal abgeschriebene Angebots-Karte), eine Ebene höher:
**Zwei Quellen für dieselbe Auskunft laufen auseinander, und man merkt es erst, wenn eine von
beiden gepflegt wird.** Ein Kommentar, der Einheit behauptet, ist kein Riegel — er ist die
Erklärung dafür, warum niemand nachgesehen hat.

**Behoben:** Der Reiter liest `categoryArt()`, die `ICONS`-Tabelle ist weg, und die Bildfläche
zeigt `photo`, sobald es eines gibt.

### 4. Der Vergleich, den man nicht wegdiskutieren kann

Whatnots Kategorie-Kachel und Berkats, nebeneinander:

| | Whatnot | Berkat (vorher) | Berkat (jetzt) |
|---|---|---|---|
| Fläche | graue Karte | weiße Karte | weiße Karte |
| Bild | **freigestelltes Produktfoto**, füllt ~60 % | Strichsymbol, 44 px, ~15 % | Strichsymbol 52 px auf **getöntem Feld** |
| Zahl | „98 Zuschauer" mit rotem Punkt | „7 kaufbar" | „7 kaufbar" |
| Anordnung | Name oben, Bild Mitte, Zahl unten | gleich | gleich |

**Die Anordnung war nie das Problem — sie ist seit dem 18.08. identisch zu Whatnots.** Es fehlt
genau eine Zutat: das Bild. Zwölf weiße Kästen mit dünnen Strichsymbolen lesen sich als
Einstellungs-Menü, dieselbe Anordnung mit Objekten darin liest sich als Laden.

Der Farbton (`tint`) lag seit dem 18.08. ungenutzt in der Datei und ist jetzt in Gebrauch. Er
schließt die Lücke nicht, er macht sie erträglich: Das Raster hat wieder Flächen statt Umrisse.

⚠️ **Der Einwand, der im Code stand, war für Grau richtig und für diese Töne falsch:** „Ein grauer
Kasten hinter einem Symbol sähe aus wie ein Bild, das nicht geladen hat." Die zwölf Töne in
`categoryArt.ts` sind gedeckte Verwandte der Sandfläche; sie lesen sich als Fläche, nicht als
Fehler. Rückgängig ist es eine Zeile.

### 5. Was die Bildschirmfotos sonst gezeigt haben

**Berkat ist reicher, nicht ärmer.** Auf der Marktplatz-Karte steht, was Whatnot dort nicht hat:
Verkäufername, Anbietertyp (Pflicht nach Art. 246d § 1 EGBGB), Größe, Zustand, Ort, Bilderzähler,
Merken-Herz mit Zahl. Whatnots Kachel trägt Titel, Bild, Zuschauerzahl.

**Der Ton ist besser.** „Gerade ist niemand live · Aus dem Regal — rund um die Uhr kaufbar, auch
ohne Sendung" ist ein Satz, der weiterhilft. Whatnots Leerzustände sind weiße Flächen.

**Zwei Dinge, die auffielen und NICHT behoben sind:**

1. ⚠️ **Der einzige Knopf auf der Artikelseite ist eine Kontur.** Bei 30 der 32 Angebote heißt er
   „Nachricht schreiben" und ist eine weiße Pille mit dünnem Rand. Gold ist zu Recht dem Kauf
   vorbehalten (HANDOFF 20) — aber *ungefüllt* ist die Form für „zweitrangig", und hier ist es die
   einzige Handlung der Seite. Whatnots CTA ist immer **gefüllt**, auch der graue. Ein gefülltes
   Dunkelgrün wäre der Mittelweg: nicht der Kaufweg, aber auch keine Skizze. **Entscheidung, kein
   Bau.**
2. **Die Startseite endet in Leere.** Nach acht Angeboten kommt „Alle 32 Angebote ansehen" und
   darunter eine handbreite leere Sandfläche bis zur Leiste. Ein Fußbereich, der nichts trägt,
   ist der letzte Eindruck des Bildschirms.

### 6. Was daraus folgt — nach Nutzen sortiert

1. ✅ **Feste Kartenhöhe** (erledigt) — die größte Wirkung pro Zeile Code, die diese App je hatte.
2. ✅ **Eine Quelle fürs Kategoriebild** (erledigt) — ohne das wären die zwölf Fotos verpufft.
3. ⏳ **Die zwölf freigestellten Fotos.** Das ist jetzt der ganze verbleibende Abstand auf dieser
   Fläche, und er ist kein Code. Anforderungen unverändert (HANDOFF 41, Punkt 5): freigestellt,
   PNG mit Transparenz, quadratisch, min. 400 × 400, ein Gegenstand, gleiche Blickrichtung.
   ⚠️ Und: **„Schuhe" trägt heute ein Paket-Symbol.** Selbst als Platzhalter ist das falsch — es
   liest sich als „hier hat jemand kein Symbol gefunden".
4. ⏳ **Gefüllter CTA auf der Artikelseite** — eine Entscheidung über eine Farbe, kein Umbau.
5. ⏳ **Der Fuß der Startseite.**

### 7. Die Lehre

Dreizehn Analysen haben Whatnots Bilder gegen Berkats **Quelltext** gehalten. Diese hat sie gegen
Berkats **Bildschirm** gehalten — und die zwei teuersten Funde des Tages waren beide von der Sorte,
die man im Quelltext nicht sieht: Eine fehlende `height` und eine Tabelle, die es zweimal gibt.

> **Wer wissen will, warum etwas unfertig aussieht, muss es ansehen.** Ein Kommentar, der Einheit
> behauptet, und eine Karte, die für sich richtig gebaut ist, überstehen jede Code-Prüfung —
> nebeneinander gelegt fallen sie in zehn Sekunden auf.

Das ist dieselbe Lehre wie am 19.08. („wer wählen muss, prüft mit Menschen, nicht mit Skripten",
HANDOFF 54), nur für Gestaltung statt für Abläufe.

### Quellen

- `itunes.apple.com/search?term=whatnot&entity=software&country=de` — Whatnot `26.34.5`,
  Stand 20.08.2026, fünf deutsche Store-Bilder in 900 px
- Berkat im iOS-Simulator (iPhone 17, iOS 26.3), Konto `berkattest`, echter Datenstand mit
  32 Angeboten: Startseite, Kategorien, `/shop`, Artikelseite
