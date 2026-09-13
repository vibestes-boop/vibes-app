# Live-Raum · Umbau vom 13.09.2026

Ausgangspunkt: echte Host-Screenshots aus Build 15. Analyse mit 18 Befunden unter
`outputs/berkat-live-audit-2026-09-13/ANALYSE.md`. Testartikel-Richtigkeit, Bildmotiv
und Streamingqualität wurden nicht bewertet.

## Änderungen

- Ein gemeinsamer Aufbau mit einer Tastatursteuerung. Composer ist ein eigener
  unterer Bereich, unabhängig von Kommentarmenge und Aktionsleiste. Artikel,
  Preis und Restzeit bleiben im Schreibmodus sichtbar. Tastatur aus/ein und
  Schriftwechsel ersetzen weder Eingabeinstanz noch Entwurf.
- Host-Werkzeuge stehen im Kopfbereich innerhalb des Layouts. Sendestatus und
  Mikrofon sind direkt sichtbar; Kamera an/aus und Wechsel liegen im Werkzeugblatt.
  Keine absolute Kamera-Leiste über den Kommentaren.
- Ein kompakter, öffnender Artikelbereich ersetzt große Produktkarte, nächste
  Artikelzeile, separaten Preisblock und passive Host-Gebotspille. Host zeigt
  Preis/Gebotsanzahl/Restzeit. Ohne Auktion gibt es eine echte Startaktion.
- Zuschauer behalten Verkaufs-/Versandangaben beim Gebot. Mit großer Schrift
  öffnet „Gebot & Details“ ein Blatt mit vollständigem Titel, aktuellem Preis,
  Restzeit und Hinweisen vor der tatsächlichen Gebotsaktion. Öffnen allein bietet
  nichts. Die bestehenden Quote-/Doppeltipp-/Gestensperren bleiben erhalten.
- Shop enthält die Warteschlange. Rechts verbleiben Herz, Shop und Mehr. Teilen,
  Umsatz, Chatverlauf und Kommentar-Sichtbarkeit sind im Zusatzmenü erreichbar.
  Beim Schreiben entfällt die Seitenleiste. Modale Folgeaktionen warten auf den
  abgeschlossenen iOS-Schließvorgang.
- Zwei kompakte Beiträge; bei Tastatur/großer Schrift eine. Namen stehen
  beim Text. Lange Beiträge sind vollständig im separaten Verlauf erreichbar;
  dieser umfasst die vom bestehenden Chat-Hook geladenen Beiträge (bis zu 40).
  Wischen zum Ausblenden bleibt erhalten. Senden hebt sich erst bei Entwurf hervor.
- Abdunklung richtet sich nach dem tatsächlichen unteren Bereich. Zuschauerzahl
  und Nebenaktionen sind neutral. Es gibt keinen festen 340-Punkte-Schatten mehr.
- Kamerawechsel liest die tatsächliche Spur, mit der bestätigten Auswahl als
  Rückfall. Kamera/Mikrofonbefehle sind synchron serialisiert, Fehler sichtbar und
  wiederholbar. Späte Vorgänge dürfen keinen neuen Raumzustand überschreiben.
  Die Steuerung beendet beim Verlassen keine vom Provider gehaltenen Spuren.
- Der fälschlich immer auf 30 Sekunden bezogene Balken ist entfernt; die
  serverbezogene Restzeit bleibt. Kein Sofortkaufversprechen ohne angebotene Aktion.
- Doppelte React-Schlüssel im Max-Gebotsknopf und nach Schriftwechsel abgeschnittene
  Beschriftungen korrigiert. Lange Blätter erhalten eine gemessene, begrenzte Höhe
  mit festem Schließen-Knopf und eigener Scrollfläche.

## Prüfung

TypeScript und 390 lokale Tests bestanden, davon 22 neu. Neue Tests nutzen lokale
Kamera-/Promise-Doubles und die tatsächlichen Komponentenrückrufe: Frontkamera,
Spurauswahl, fehlende Spur, Doppeltipps/gleichzeitige Befehle, Ablehnung/Wiederholung,
Unmount/neuer Teilnehmer, Host-/Zuschauer-/Schreibmodus, leer/verkauft/Zuschlag,
Gebotsdialog bei großer Schrift und erhaltene/gesperrte Kommentareingaben.

Native Prüfung im iPhone-17-Simulator, iOS 26.3, extra-large (Fontscale 1.118) und
accessibility-medium. Vollständige Host-Steuerung, beide Rollen, laufender Artikel,
leerer Host-Zustand, Verbindungsfehler, Kamera-Werkzeugfehler/Wiederholung,
Artikelblatt, Chatverlauf und Gebotsdialog. Zusätzlich frischer App-Start.
Die Aktionen der temporären Prüfroute bleiben lokal; kein LiveKit-Broadcast,
kein reales Gebot, kein echter Kommentar und kein Kamera-/Mikrofonmitschnitt.

| Native Beobachtung | Ergebnis |
| --- | --- |
| Eingabe über Tastatur, Host mit 0 / 1 / 5 Beiträgen | jeweils 4 pt |
| Eingabe über Tastatur, Zuschauer mit großer Schrift | 4 pt |
| Host-Artikelbereich, extra-large | 64 pt |
| Zuschauer-Artikelbereich inkl. Hinweise/Gebotsleiste, extra-large | 170 pt |
| Host ohne Artikel, große Schrift | 81 pt |
| Kompakter Artikel bei Tastatur/großer Schrift | 90 pt |
| Zuschauer mit langem Titel, großer Schrift, geschlossenem Gebotsdialog | 190 pt |

Das sind Layoutwerte aus der lokalen Prüfroute, keine Messungen einer echten
Videoübertragung. Die zusätzliche Messbeschriftung im Bild gehört zur Prüfroute.
Die Prüfroute ist vor dem Release-Build archiviert; Systemschrift wiederhergestellt.
Screenshots und Logs liegen in `outputs/berkat-live-rebuild`.

## Noch auf dem iPhone prüfen

Echte laufende Show als Host und Zuschauer: frontseitiger Einstieg → erster
Kamerawechsel, Mikrofon an/aus, Chat senden, Tippen/Schließen der Tastatur und
Gesten im längeren Verlauf/Artikelblatt. Simulator-Scrollversuche über die
Automatisierung zeigten keinen verlässlichen Positionswechsel; deshalb ist die
reale Scrollgeste nicht als bestanden dokumentiert. Netzwerk-, Kamera- und
Mikrofonverhalten sind durch lokale Doubles nicht vollständig abgedeckt.
