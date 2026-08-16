# Berkat — Store-Material

**Stand: 16.08.2026** · Alles, was App Store Connect und die Google Play Console an Texten,
Angaben und Entscheidungen verlangen. Eine Datei für beide Plattformen, weil sich rund 80 %
davon decken — was nur eine Seite betrifft, ist markiert.

> Die Rechtstexte, auf die hier verwiesen wird, liegen unter `apps/berkat-web/` und müssen
> **vor der Einreichung** veröffentlicht sein. Beide Stores prüfen die Datenschutz-URL
> automatisch; eine 404 ist eine sofortige Ablehnung.

---

## 0. Was noch fehlt, bevor eingereicht werden kann

| Was | Wer | Warum es blockiert |
|---|---|---|
| Goldene Platzhalter in `impressum.html` und `datenschutz.html` füllen | Zaur | Pflichtfeld beider Stores, und die Seite ist sonst abmahnfähig |
| Website neu veröffentlichen (`wrangler pages deploy`) | Zaur | siehe oben |
| App-Eintrag in App Store Connect anlegen (`com.berkat.app`) | Zaur | Apple-Anmeldung mit Zwei-Faktor |
| `ascAppId` aus dem neuen Eintrag in `eas.json` eintragen | dann ich | `eas submit` weiß sonst nicht wohin |
| Demo-Zugang für die Prüfung | Zaur | Die App zeigt ohne Konto nichts — ohne Zugang lehnt Apple ab |
| Screenshots mit echtem Inhalt | gemeinsam | siehe Abschnitt 6 |

---

## 1. Name, Untertitel, Schlüsselwörter

| Feld | Wert | Grenze |
|---|---|---|
| App-Name | `Berkat: Live-Auktionen` | 30 Zeichen (22 genutzt) |
| Untertitel *(nur iOS)* | `Der Preis entsteht live` | 30 Zeichen (23 genutzt) |
| Kurzbeschreibung *(nur Android)* | `Live-Auktionen mit echten Menschen. Der Preis entsteht vor Publikum.` | 80 Zeichen (67 genutzt) |

**Schlüsselwörter** *(nur iOS, 100 Zeichen, kommagetrennt, **keine** Leerzeichen nach den Kommas)*:

```
auktion,bieten,live,shopping,marktplatz,verkaufen,secondhand,parfum,mode,halal,livestream,kaufen
```

⚠️ **Wörter aus Name und Untertitel gehören nicht in die Schlüsselwörter** — Apple indexiert
beide Felder ohnehin, und eine Wiederholung verschenkt Zeichen. Deshalb steht „Berkat" dort
nicht, und „Preis" ebenfalls nicht.

---

## 2. Beschreibung

Erste drei Zeilen entscheiden — mehr sieht niemand, bevor er „mehr" antippt.

```
Auf Berkat entsteht der Preis vor Publikum. Eine Person sendet live, legt einen Artikel auf,
und was er wert ist, entscheidet der Raum. Verkauft wird der Abend, nicht der Katalog.

WIE ES LÄUFT

Ein Verkäufer geht live und zeigt, was er hat — in die Kamera, nicht als Katalogfoto. Für
jeden Artikel läuft eine Uhr. Wer das höchste Gebot hält, wenn sie abläuft, bekommt ihn.
Bietet in den letzten Sekunden noch jemand, verlängert sich die Uhr: Niemand gewinnt, weil er
den schnelleren Daumen hatte.

EIN PAKET STATT VIELER

Alles, was du an einem Abend bei einem Verkäufer gewinnst, sammelt sich 24 Stunden und geht in
einer einzigen Sendung raus. Erst am Ende zahlst du — einmal Versand, nicht fünfmal. Ohne das
wäre eine Auktion ab 1 Euro gar nicht möglich, weil das Porto teurer wäre als die Ware.

AUKTION, KEIN GLÜCKSSPIEL

Keine Überraschungskisten, kein Glücksrad, keine Lose. Die Spannung liegt im Preis, nie im
Inhalt — du weißt immer, worauf du bietest. Das ist eine bewusste Entscheidung und keine
fehlende Funktion.

RÄUME NUR FÜR FRAUEN

Geprüfte Sendungen, in denen Verkäuferinnen ohne fremdes Publikum senden. Wer dort zuschaut
oder kauft, ist für Außenstehende nicht sichtbar.

VERTRAUEN MIT NAMEN

Statt einer Sternzahl in Winzschrift steht unter jedem Verkäufer, WER für ihn bürgt — mit
Namen, öffentlich, jederzeit widerrufbar. Dazu die Zahlen, die ohnehin entstehen: wie schnell
er versendet, wie viele Zuschläge er hatte, was Käufer geschrieben haben.

AUCH ZWISCHEN DEN SENDUNGEN

Was ein Verkäufer dauerhaft anbietet, liegt auf seinem Profil und ist jederzeit kaufbar —
auch wenn gerade niemand sendet.

Berkat ist auf Deutsch. Bezahlt wird mit Karte über einen zertifizierten Zahlungsdienstleister;
Kartendaten erreichen unsere Systeme zu keinem Zeitpunkt.
```

*(rund 1.700 Zeichen — Apple erlaubt 4.000, Google 4.000. Kurz ist Absicht: Was danach käme,
liest niemand.)*

---

## 3. Kategorie, Alter, Adressen

| Feld | Wert |
|---|---|
| Kategorie primär | **Einkaufen** (iOS) / **Shopping** (Android) |
| Kategorie sekundär *(nur iOS)* | Lifestyle |
| Support-URL | `https://berkat-live.pages.dev/` |
| Marketing-URL | `https://berkat-live.pages.dev/` |
| Datenschutz-URL | `https://berkat-live.pages.dev/datenschutz.html` |
| Copyright *(nur iOS)* | `2026 ` + Anbietername aus dem Impressum |

### Altersfreigabe — die Antworten, auf die es ankommt

Berkat hat **nutzergenerierte Inhalte** (Live-Video, Chat, Profiltexte, Bilder). Das ist die
einzige Frage, die die Einstufung wirklich bewegt. Die ehrliche Antwort lautet **ja, mit
Moderation**: Es gibt einen Wortfilter, Melden, Sperren, Stummschalten und einen Host, der
seinen eigenen Raum moderiert.

⚠️ **Nicht ankreuzen:** Glücksspiel, Wetten, simuliertes Glücksspiel. Eine Auktion ist keines
davon — der Gegenstand steht fest, nur der Preis ist offen. Genau deshalb gibt es in Berkat
bewusst keine Mystery-Boxen und kein Glücksrad. Wer hier aus Vorsicht „ja" ankreuzt, holt sich
eine 18+-Einstufung für etwas, das gar nicht stattfindet.

Erwartete Einstufung: **jugendfrei ab der mittleren Stufe** wegen der ungefilterten
Live-Interaktion. Die genaue Stufe vergibt der Fragebogen, nicht wir.

---

## 4. App Privacy (iOS) / Data Safety (Android)

Die Angaben decken sich mit `datenschutz.html`. **Beide Stores gleichen sie stichprobenartig
gegen das tatsächliche Verhalten der App ab** — falsche Angaben sind ein Ablehnungsgrund, und
zwar auch noch Monate später.

| Datenart | Wird erhoben | Mit Konto verknüpft | Zweck |
|---|---|---|---|
| E-Mail-Adresse | ja | ja | Anmeldung |
| Name / Anzeigename | ja | ja | Profil, öffentlich |
| Lieferadresse | ja | ja | Versand |
| Fotos und Videos | ja | ja | Artikelbilder, Profil |
| Andere Nutzerinhalte | ja | ja | Chat, Bewertungen, Bürgschaften |
| Nutzer-Kennung | ja | ja | Kontoführung |
| Kaufhistorie | ja | ja | Bestellungen |
| Absturz- und Fehlerdaten | ja | **nein** | Fehlerbehebung |
| Leistungsdaten | ja (Stichprobe 15 %) | **nein** | Fehlerbehebung |

**Zahlungsdaten: nein.** Kartennummer, Ablaufdatum und Prüfziffer werden ausschließlich auf
der Seite des Zahlungsdienstleisters eingegeben und erreichen Berkat nicht. Es ist auch kein
Zahlungs-SDK eingebettet — die Kasse ist eine Webseite über der App.

**Tracking: nein.** Keine Werbung, keine Werbe-IDs, keine Weitergabe an Datenbroker, kein
plattformübergreifendes Verfolgen. In Apples Formular also **„Data Not Used to Track You"**,
und `NSUserTrackingUsageDescription` wird nicht gebraucht.

**Warum Diagnosedaten NICHT verknüpft sind:** Die Fehlerüberwachung meldet bewusst ohne Beträge,
Adressen und Nutzer-Kennungen — nur die Stelle im Programm und den Fehlercode. Am 16.08.2026
gegengeprüft: In `lib/report.ts` gibt es **kein `Sentry.setUser()`** und kein `sendDefaultPii`,
und im ganzen Projekt hängt nichts eine Kontokennung an eine Meldung. Die Fehlermeldungen sind
damit keiner Person zuzuordnen.

⚠️ Wer je `Sentry.setUser()` einbaut — auch nur „zum Debuggen" —, macht diese Angabe falsch und
muss sie in beiden Stores ändern. Eine unzutreffende App-Privacy-Angabe ist auch Monate nach der
Freigabe noch ein Ablehnungsgrund.

---

## 5. Hinweise für die Prüfung *(App Review Notes)*

Text zum Einfügen in App Store Connect:

```
Berkat ist ein Marktplatz für Live-Auktionen über physische Waren (Parfüm, Mode, Schmuck,
Haushalt). Käufer bieten während einer Live-Sendung; wer die Auktion gewinnt, bekommt die Ware
per Post geliefert.

ZAHLUNGEN
Es werden ausschließlich PHYSISCHE Waren verkauft, die außerhalb der App versandt werden. Die
Bezahlung läuft nach Richtlinie 3.1.5(a) über einen externen Zahlungsdienstleister. Es gibt
keine digitalen Inhalte, keine Abonnements und keine In-App-Währung.

TRINKGELD
Zuschauer können einem Verkäufer freiwillig Trinkgeld geben. Der Betrag geht zu 100 Prozent an
den Empfänger; es wird keine Provision einbehalten, und es wird dadurch kein Inhalt und keine
Funktion freigeschaltet.

NUTZERGENERIERTE INHALTE
Live-Chat und Live-Video sind moderiert: automatischer Wortfilter, Melden von Nutzern und
Inhalten mit Gründeauswahl, Sperren einzelner Nutzer, Stummschalten und Entfernen durch den
Host, sowie serverseitige Durchsetzung. Nutzungsbedingungen mit Null-Toleranz-Klausel liegen
unter der angegebenen Adresse.

FRAUEN-ONLY-RÄUME
Einzelne Sendungen sind nur für geprüfte Nutzerinnen zugänglich. Das ist ein kultureller
Schutzraum für die Zielgruppe, kein Ausschluss aufgrund eines geschützten Merkmals im Sinne
von Richtlinie 1.1.1 — jede Person kann die Prüfung beantragen.

TESTZUGANG
Die App zeigt ohne Anmeldung keine Inhalte. Zugangsdaten stehen im Feld „Anmeldedaten".
Zum Ausprobieren einer Auktion sind ZWEI Konten nötig, weil der Server niemanden auf eigene
Artikel bieten lässt.
```

⚠️ **Der Absatz zum Trinkgeld ist nicht optional.** Apple verlangt für Trinkgeld an Ersteller
grundsätzlich In-App-Kauf und lässt es außerhalb nur zu, wenn der volle Betrag beim Empfänger
landet. Das stimmt heute, weil es keine Provision gibt. **Sobald eine Provision eingeführt
wird, muss dieser Punkt neu bewertet werden** — sonst wird aus einer korrekten Angabe eine
falsche.

---

## 6. Screenshots

**Pflichtformat iOS:** 6,9 Zoll, **1320 × 2868** (iPhone 17 Pro Max). Andere Größen rechnet
Apple herunter. Android verlangt mindestens zwei Aufnahmen, 16:9 oder 9:16, mindestens 1080 px
an der langen Kante — dieselben Bilder passen.

### Das Problem, das keine Technik löst

Der wichtigste Screenshot einer Live-Shopping-App ist der Raum mit laufender Auktion und
echtem Video. Der Simulator hat **keine Kamera**, das Bild bliebe schwarz. Und die App zeigt
gerade insgesamt wenig: keine laufende Sendung, ein Termin, zwei Regal-Artikel.

**Screenshots einer leeren App verkaufen nichts.** Deshalb braucht es vorher eine kurze
Sendung mit echtem Inhalt — siehe Abschnitt 7.

### Die geplante Reihenfolge

Die erste Aufnahme trägt die halbe Entscheidung; die letzte sieht fast niemand.

| # | Bildschirm | Was sie beantwortet |
|---|---|---|
| 1 | Live-Raum, Auktion läuft, Uhr rot | „Was ist das hier?" |
| 2 | Live-Raum, Zuschlag mit Preis | „Was passiert, wenn ich gewinne?" |
| 3 | Startseite mit Live-Karten und „Demnächst" | „Ist da was los?" |
| 4 | Verkäufer-Profil mit Bürgen und Kacheln | „Kann ich dem Geld schicken?" |
| 5 | Sammelkorb / Bezahlen | „Wie komme ich an meine Sachen?" |
| 6 | Kategorien | „Gibt es, was ich suche?" |

---

## 7. Die Inhalts-Sitzung — 20 Minuten, die vieles auf einmal erledigen

Zaur sendet vom iPhone, ich nehme vom Simulator als Zuschauer auf. Das liefert nicht nur die
Screenshots, sondern schließt zugleich vier Punkte, die die HANDOFF seit Tagen als ungeprüft
führt:

- **echtes Video** — im Simulator nie zu sehen
- **die gedeckelte Bitrate** (540p) unter echten Bedingungen
- **Anti-Snipe und Max-Gebot** unter echtem Gegendruck
- **der Vorschau-Zustand „gerade zugeschlagen"** auf den Show-Karten

Ablauf: Drei bis vier Artikel mit Foto auflegen, live gehen, vom zweiten Konto bieten,
Zuschlag abwarten, in den Sammelkorb, bezahlen. Genau der Durchlauf aus HANDOFF Abschnitt 8 —
nur diesmal mit Kamera und mit Aufnahmen davon.

---

## 8. Version und Build

`app.json` steht seit dem 16.08.2026 auf **1.0.0**, Build **1**.

Vorher war es `0.1.0` (Build 4) — das waren die Entwickler-Builds. Eine erste öffentliche
Fassung als `0.1.0` einzureichen sähe aus wie ein Versehen, und App Store Connect verlangt je
Versionsnummer eindeutige Build-Nummern; mit einem frischen Eintrag ist Build 1 der saubere
Anfang.

⚠️ Das iOS-Produktionsprofil hat `autoIncrement: false`. Die Build-Nummer kommt also aus
`app.json` und muss **vor jedem weiteren Upload derselben Version von Hand hochgezählt**
werden, sonst weist App Store Connect ihn ab.
