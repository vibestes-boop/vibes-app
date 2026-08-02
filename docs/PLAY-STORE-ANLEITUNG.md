# Google Play — Schritt für Schritt bis zum geschlossenen Test

> Stand: 30. Juli 2026 · Für Zaur. Alles, was **du** im Browser machst, ist mit 👤 markiert.
> Was schon fertig ist, steht unter „Bereits erledigt".

---

## Bereits erledigt (musst du nicht mehr tun)

| Was | Wo |
|---|---|
| Store-Paket gebaut, signiert, hochladbar | AAB, Version 1.31.0, versionCode 48 |
| Firebase + Push verdrahtet | Projekt `serlo-199be`, FCM-Schlüssel auf EAS |
| Unnötige Berechtigungen entfernt | „Über anderen Apps anzeigen", Foto-Standort, Musikdateien |
| Build-Nummer erhöht sich automatisch | sonst würde der 2. Upload abgewiesen |
| Kinderschutz-Richtlinie veröffentlicht | https://www.serlo.ch/kinderschutz |
| Konto-Löschseite veröffentlicht | https://www.serlo.ch/konto-loeschen |
| AGB-Klausel gegen anstößige Inhalte | https://www.serlo.ch/terms § 4 |
| Screenshots im Play-Format | `~/Downloads/serlo-play/screenshots/` (6 Stück, 1080×1920) |
| App-Icon 512×512 | `~/Downloads/serlo-play/icon-512.png` |
| Feature-Grafik 1024×500 | `~/Downloads/serlo-play/feature-graphic-1024x500.png` |

---

## Schritt 0 👤 — Die eine Frage, die den Zeitplan entscheidet (5 Min)

Öffne https://play.google.com/console → **Alle Apps** → schau ins Dashboard.

**Siehst du irgendwo „Produktionszugriff beantragen" mit einem Fortschrittsbalken
(z. B. „0 von 12 Testern")?**

- **JA** → Die 12-Tester-Regel gilt für dich. Rechne ab Upload mit ~3 Wochen
  (14 Tage Test + bis zu 7 Tage Prüfung). Mach trotzdem sofort weiter — jeder
  Tag Verzögerung ist ein Tag weniger Puffer.
- **NEIN** → Dein Konto ist älter als der 13.11.2023 und von der Regel befreit.
  Du kannst nach der Prüfung direkt veröffentlichen. Den geschlossenen Test
  solltest du trotzdem machen, aber ohne Zeitdruck.

---

## Schritt 1 👤 — App anlegen (10 Min)

1. Play Console → **Alle Apps** → **App erstellen**
2. Ausfüllen:
   - **App-Name:** `Serlo`
   - **Standardsprache:** Deutsch (Deutschland) – de-DE
   - **App oder Spiel:** App
   - **Kostenlos oder kostenpflichtig:** Kostenlos
   - Beide Erklärungen abhaken (Programmrichtlinien, US-Exportgesetze)
3. **App erstellen**

Die beiden alten Einträge namens „Vibes" (Paket `app.vibes.social`) sind Leichen
aus dem März und gehören zu einem toten Paketnamen. Lösch sie über
**App-Einstellungen → Erweitert → App löschen** — oder lass sie einfach liegen,
sie stören nicht.

---

## Schritt 2 👤 — Store-Eintrag ausfüllen (30 Min)

**Play Console → Wachstum → Hauptbereich des Store-Eintrags**

### App-Name (max. 30 Zeichen)
```
Serlo
```

### Kurzbeschreibung (max. 80 Zeichen)
```
Live-Streams, Videos und Shop — für deine Community.
```

### Vollständige Beschreibung (max. 4000 Zeichen)
```
Serlo ist die App für deine Community.

Schau Live-Streams, entdecke kurze Videos und bleib mit den Menschen in
Verbindung, die dir wichtig sind. Alles an einem Ort, auf Deutsch, Russisch,
Englisch und Tschetschenisch.

LIVE GEHEN UND ZUSCHAUEN
Starte deinen eigenen Live-Stream oder schau anderen zu. Chatte mit,
schick Geschenke und hol dir Gäste dazu — zu zweit im Bild, wenn ihr wollt.

VIDEOS UND BEITRÄGE
Kurze Videos, Fotos und Stories. Nimm direkt in der App auf, schneide,
setz Text drauf und teile — oder sieh dir einfach an, was deine Community postet.

CLANS
Gruppen für Familie, Freunde, Teip oder Interessen. Eigener Feed,
eigene Rangliste, eigene Regeln.

SHOP
Entdecke Produkte aus deiner Community und bestell direkt. Sammelbestellungen
machen es günstiger, wenn viele mitmachen.

NACHRICHTEN
Direktnachrichten mit Bildern, GIFs und Sprachnachrichten. Teile Beiträge
und Produkte direkt im Chat.

DEINE SPRACHE
Serlo spricht Deutsch, Russisch, Englisch und Tschetschenisch. Die App stellt
sich automatisch auf die Sprache deines Handys ein — ändern kannst du es
jederzeit in den Einstellungen.

SICHER UNTERWEGS
Melden und Blockieren mit einem Tipp. Chat-Moderation in Live-Streams.
Ein geschützter Bereich nur für Frauen, mit geprüftem Zugang.
Wir prüfen gemeldete Inhalte innerhalb von 24 Stunden.

Serlo ist ab 17 Jahren. Kontakt und rechtliche Angaben: www.serlo.ch
```

### Grafiken
| Feld | Datei |
|---|---|
| App-Symbol | `~/Downloads/serlo-play/icon-512.png` |
| Feature-Grafik | `~/Downloads/serlo-play/feature-graphic-1024x500.png` |
| Telefon-Screenshots | alle 6 aus `~/Downloads/serlo-play/screenshots/` |

Mindestens 2 Screenshots sind Pflicht, 6 sind besser.

### Russische Übersetzung (optional, aber empfohlen)
**Store-Eintrag → Übersetzungen verwalten → Eigene Übersetzung hinzufügen → Russisch**

App-Name (Achtung: „Serlo" ist im russischen Store belegt, deshalb wie bei Apple):
```
Serlo: комьюнити и эфиры
```
Kurzbeschreibung:
```
Эфиры, видео и магазин — для твоего комьюнити.
```

---

## Schritt 3 👤 — Pflicht-Formulare (60–90 Min)

**Play Console → Richtlinien und Programme → App-Inhalt**

### 3.1 Datenschutzerklärung
```
https://www.serlo.ch/privacy
```

### 3.2 App-Zugriff
Wähle **„Alle oder einige Funktionen sind eingeschränkt"** und trag das
Prüfer-Konto ein (dasselbe wie bei Apple):
- Name der Anweisung: `Anmeldung`
- Nutzername + Passwort: dein Review-Konto
- Anweisungen:
```
Die App ist vollständig hinter der Anmeldung. Bitte mit den angegebenen
Zugangsdaten per E-Mail und Passwort anmelden (nicht über Google).
Danach sind Feed, Clans, Shop, Nachrichten und Live-Bereich zugänglich.
```

### 3.3 Anzeigen
**Nein**, die App enthält keine Werbung.

### 3.4 Inhaltsklassifizierung (Fragebogen)
Kategorie: **Soziales Netzwerk / Kommunikation**. Ehrlich antworten:
- Nutzer können Inhalte erstellen und teilen: **Ja**
- Nutzer können miteinander kommunizieren: **Ja**
- Standort wird geteilt: **Nein**
- Käufe digitaler Güter: **Ja** (Coins sind angelegt, auch wenn aktuell deaktiviert)
- Gewalt, Sexualität, Drogen, Glücksspiel: **Nein**

Erwartetes Ergebnis: USK 16 oder USK 18 / PEGI 16. Beides ist in Ordnung.

### 3.5 Zielgruppe
Zielaltersgruppe: **18 und älter**. Damit entfallen die zusätzlichen
Kinder-Auflagen. Auf die Frage, ob die App Kinder ansprechen soll: **Nein**.

### 3.6 Kinderschutz-Standards ⚠️ neu und Pflicht
```
https://www.serlo.ch/kinderschutz
```
Als Ansprechpartner deine E-Mail eintragen.

### 3.7 Datenlöschung
```
https://www.serlo.ch/konto-loeschen
```
Ankreuzen: Nutzer können sowohl **in der App** als auch **über diese Seite**
die Löschung veranlassen.

### 3.8 Datensicherheit (das längste Formular)

⚠️ **Erste Frage: „Werden in deiner App erforderliche Nutzerdaten erhoben oder
geteilt?" → JA.** Die Voreinstellung ist „Nein" und wäre eine Falschangabe —
Google wertet das als Richtlinienverstoß und kann die App auch nachträglich
entfernen.

Danach erscheint der Kategorienbaum. **Nur diese Häkchen setzen** (jede Zeile
gegen den echten Code geprüft, Stand 01.08.2026):

| Kategorie | Ankreuzen | Warum |
|---|---|---|
| **Standort** | ❌ nichts | Standort-Berechtigung wurde komplett entfernt |
| **Personenbezogene Daten** | ✅ Name · ✅ E-Mail-Adresse · ✅ Nutzer-IDs · ✅ Adresse | Konto + Lieferadresse im Shop (`update_order_shipping_address`) |
| | ❌ Telefonnummer, Herkunft, Religion, sexuelle Orientierung, politische Ansichten | wird nirgends erhoben |
| **Finanzinformationen** | ✅ Kaufhistorie · ❌ Zahlungsinformationen | Bestellungen ja; Kartendaten laufen extern über Stripe, nie durch die App |
| **Gesundheit und Fitness** | ❌ nichts | |
| **Nachrichten** | ✅ Andere In-App-Nachrichten · ❌ E-Mails, SMS | Direktnachrichten und Live-Chat |
| **Fotos und Videos** | ✅ Fotos · ✅ Videos | Beiträge, Stories, Profilbild |
| **Audiodateien** | ✅ Sprachaufnahmen · ❌ Musikdateien | Video-Ton, Live-Streams, Sprachnachrichten |
| **Dateien und Dokumente** | ❌ nichts | |
| **Kalender / Kontakte** | ❌ nichts | keine Berechtigung im Manifest |
| **App-Aktivitäten** | ✅ App-Interaktionen · ✅ Andere nutzergenerierte Inhalte | Feed-Algorithmus (Verweildauer), Beiträge und Kommentare |
| | ❌ In-App-Suchverlauf | Suche wird nicht gespeichert (nachgeprüft) |
| | ❌ Installierte Apps, Andere Aktionen | |
| **Web-Browsing** | ❌ nichts | |
| **App-Informationen und Leistung** | ✅ Absturzprotokolle · ✅ Diagnose | Sentry |
| **Geräte- oder andere IDs** | ✅ | Push-Token |

**Für JEDE angekreuzte Datenart dann:**
- Erhoben: **Ja** · Geteilt: **Nein**
- Verarbeitung: **Daten werden dauerhaft gespeichert** (nicht „nur temporär")
- Pflicht oder optional:
  - **Pflicht:** Name, E-Mail, Nutzer-IDs, Geräte-IDs
  - **Optional:** alles andere
- Zweck:
  - Name, E-Mail, Nutzer-IDs, Adresse, Fotos, Videos, Audio, Nachrichten,
    Kaufhistorie, nutzergenerierte Inhalte → **App-Funktionalität**
  - App-Interaktionen → **App-Funktionalität** + **Personalisierung**
  - Absturzprotokolle, Diagnose → **Analysen**

**Warum überall „Geteilt: Nein":** Supabase, Cloudflare, LiveKit und Sentry sind
Auftragsverarbeiter (Dienstleister), keine Empfänger im Sinne von Google. Das
zählt ausdrücklich nicht als Weitergabe.

**Abschnitt Sicherheitspraktiken (am Ende):**
- Verschlüsselung bei der Übertragung: **Ja**
- Nutzer können Löschung ihrer Daten beantragen: **Ja**
- Unabhängige Sicherheitsüberprüfung: **Nein** (optionales Gütesiegel, brauchst du nicht)
- UPI-Zahlungen: **Nein** (nur für Finanz-Apps in Indien)

---

## Schritt 4 👤 — Geschlossenen Test anlegen und hochladen (30 Min)

1. **Test → Geschlossener Test → Neue Version erstellen**
2. Bei **App-Signatur**: „Von Google Play verwalten" bestätigen (Standard)
3. AAB hochladen — die Datei kommt von mir (Link im Chat)
4. **Versionsname:** `1.31.0`
5. **Versionshinweise:**
```
<de-DE>
Erste Android-Version von Serlo. Live-Streams, Videos, Clans, Shop und
Nachrichten — alles was du von der iPhone-App kennst.
</de-DE>
```
6. **Speichern** → **Version überprüfen** → **Einführung für geschlossenen Test starten**

Ab jetzt läuft die Prüfung. Sie dauert meist 1–3 Tage. Erst **danach** können
deine Tester installieren.

---

## Schritt 5 👤 — Die 12 Tester einladen (20 Min)

### Erst die Liste anlegen
**Test → Geschlossener Test → Tester** → Reiter **E-Mail-Liste** →
**E-Mail-Liste erstellen**

- Listenname: `Serlo Community-Tester`
- Trag alle 12 **Gmail-Adressen** ein, mit Komma getrennt
- Speichern, Liste anhaken

⚠️ **Wichtig:** Es muss die Google-Adresse sein, mit der die Person im Play Store
angemeldet ist. Eine andere E-Mail funktioniert nicht — der Tester sieht dann
„App nicht gefunden".

### Dann den Link kopieren
Auf derselben Seite steht unten **„Link zum Beitreten"** — etwa
`https://play.google.com/apps/testing/app.serlo.social`.
Diesen Link brauchen deine Tester.

### Nachricht zum Weiterleiten (WhatsApp)

```
Salam! 👋

Serlo gibt es jetzt auch für Android — und du bist einer der Ersten.

Damit Google die App freigibt, brauche ich 12 Leute, die sie 14 Tage lang
installiert haben. Du musst nichts weiter tun, als sie draufzulassen und
ab und zu reinzuschauen.

So machst du mit (2 Minuten):

1. Öffne diesen Link auf dem Handy:
   👉 [LINK HIER EINFÜGEN]
2. Tippe auf "Become a tester" / "Tester werden"
3. Dann auf "Download it on Google Play" — die App installiert sich normal
   über den Play Store

Wichtig: Bitte nutze dieselbe Google-Adresse, die du mir geschickt hast,
sonst findet der Play Store die App nicht.

Und bitte: Lass sie die vollen 14 Tage drauf. Wenn du sie vorher löschst,
zählt es leider nicht und wir fangen von vorne an. 🙏

Wenn dir was auffällt — irgendwas sieht komisch aus, hakt oder stürzt ab —
schick mir einfach einen Screenshot. Genau dafür ist der Test da.

Danke dir! 🙏
```

---

## Schritt 6 👤 — Während der 14 Tage

- **Nicht deinstallieren lassen.** Wer zwischendurch aussteigt, zählt nicht mehr.
  Google zählt nur, wer **durchgehend** angemeldet ist. Deshalb 12 als Minimum —
  lade lieber 15 ein.
- **Fehler dürfen behoben werden.** Google empfiehlt sogar ausdrücklich, während
  des Tests Updates einzuspielen. Das setzt die Uhr **nicht** zurück. Schick mir
  einfach die Screenshots, ich baue neue Versionen.
- **Tester sollen die App wirklich benutzen.** Reines Installieren reicht seit
  2025 nicht mehr — Google schaut auf Aktivität. Bitte sie, ab und zu ein Video
  anzuschauen oder etwas zu posten.

---

## Schritt 7 👤 — Nach 14 Tagen

**Dashboard → „Produktionszugriff beantragen"** → Formular ausfüllen
(Fragen zum Test: was habt ihr getestet, was habt ihr gelernt, was habt ihr
geändert). Prüfung dauert meist bis zu 7 Tage. Danach kannst du auf Produktion
veröffentlichen.

---

## Was du für den Antrag später brauchst

Notier dir während des Tests kurz:
- Wie viele Tester, wie lange
- Welche Rückmeldungen kamen
- Was daraufhin geändert wurde

Genau das fragt Google im Formular ab.

---

## Termin: erledigt, kein Handlungsbedarf

**31.08.2026 (Android-16-Pflicht für neue Apps): bereits erfüllt.**
Die App zielt auf **API 36 (Android 16)** — bestätigt sowohl im Code
(`react-native/gradle/libs.versions.toml`: `targetSdk = "36"`) als auch von der
Play Console selbst beim Upload von versionCode 48 („Ziel-SDK 36").

Frühere Notiz „Android 15, Migration nötig" war ein Lesefehler: Der Wert 35 ist
nur Expos Rückfallwert, überschrieben wird er vom Versionskatalog von React
Native 0.81. Es steht keine Migration und kein Fristverlängerungsantrag an.

## Kennzahlen des ersten Bundles (versionCode 48)

| | |
|---|---|
| Download-Größe pro Gerät | **101 MB** (die 206 MB der AAB-Datei enthalten alle Prozessor-Varianten) |
| Geschätzte Downloadzeit | 58 Sekunden |
| Unterstützte Geräte | ab Android 7 (API 24) |
| Ziel-SDK | 36 (Android 16) |
