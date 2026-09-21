/**
 * Die Wischreihe über dem Raster — Zaurs „Galerie".
 *
 * ⚠️ WARUM SIE AM 21.09.2026 ERST ABGELEHNT UND DANN GEBAUT WURDE
 * Zaur hat die Reihe aus der Kleinanzeigen-App gezeigt: kleinere Kärtchen,
 * waagerecht zu wischen. Ich habe sie zunächst nicht gebaut, weil Berkats
 * „Neu entdecken" damals alles zeigte, was da war — eine Reihe darüber hätte
 * dieselben Artikel ein zweites Mal ins Bild gezogen.
 *
 * Die Reihe gibt es jetzt, aber nicht als zweite Ansicht derselben Artikel:
 * `splitShelf` in `lib/shelfSplit.ts` gibt ihr ausschließlich den Überhang —
 * die Angebote, die unter dem Raster gar nicht erst erschienen wären. Ein
 * Artikel steht auf der Startseite genau einmal. Wer diese Reihe irgendwo
 * anders einhängt, muss dieselbe Bedingung mitbringen.
 *
 * ⚠️ DIE KARTE KOMMT VON AUSSEN (`renderCard`), SIE ENTSTEHT NICHT HIER.
 * `ListingCard` trägt die Anbieterkennzeichnung nach Art. 246d § 1 EGBGB, das
 * Merken-Herz, „Verkauft"/„Weg" und „Deins". Eine eigene, kleinere Karte für
 * die Reihe zu schreiben hieße, all das ein zweites Mal zu pflegen — genau der
 * Fehler, für den es `ListingCard` überhaupt gibt (vier auseinandergelaufene
 * Fassungen, Übergabe Abschnitt 18). Die Reihe ist eine Fläche, kein Inhalt.
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { Listing } from '../lib/useListings';
import { space, ui } from '../theme/tokens';

export function ShelfRail({
  items,
  renderCard,
  title = 'Zuletzt eingestellt',
}: {
  items: Listing[];
  renderCard: (listing: Listing) => ReactNode;
  /**
   * ⚠️ Die Reihe ist eine FLAECHE, kein Inhalt — sie sagt nicht selbst, was
   * sie zeigt. Seit dem 21.09.2026 traegt sie auch „Mehr von <Verkaeufer>" auf
   * der Artikelseite; dort stand vorher ein Raster mit voller Kartengroesse,
   * das den halben Bildschirm fuellte fuer etwas, das man im Vorbeigehen
   * ansieht.
   */
  title?: string;
}) {
  const { width, fontScale } = useWindowDimensions();

  /**
   * Schmaler als eine Rasterkarte — das war Zaurs eigenes Wort: „diese
   * kärtchen sind kleiner". Eine Rasterkarte ist hier rund 183 pt breit; 126
   * lässt drei Karten stehen, und die angeschnittene dritte ist das einzige
   * verlässliche Zeichen dafür, dass sich etwas wischen lässt.
   *
   * ⚠️ Der Unterschied muss AUF EINEN BLICK sichtbar sein. Im ersten Anlauf
   * standen hier 140 pt mit der vollen Rasterkarte — im Simulator sah die
   * Reihe aus wie das Raster, nur waagerecht, und nahm die halbe Höhe des
   * Bildschirms ein. Deshalb zusätzlich `layout="tile"`.
   *
   * ⚠️ Wächst mit der Schrift. Bei 200 % Systemschrift passt in 126 pt kein
   * Titel mehr, und die Karte bräche in fünf Zeilen um. Die Deckelung auf
   * `width - 72` verhindert das Gegenteil: eine Karte, die breiter ist als der
   * Bildschirm, zeigt nie einen Nachbarn und sieht aus wie ein Fehler.
   */
  const cardWidth = Math.min(width - 72, Math.round(126 * Math.max(1, fontScale)));

  if (items.length === 0) return null;

  return (
    <View key={fontScale} style={s.wrap}>
      {/* ⚠️ „Zuletzt", nicht „Frisch".
          Im Simulator trug der NEUESTE Artikel des Bestands „vor 5 Wochen
          eingestellt". Über einem fünf Wochen alten Teppich ist „frisch" ein
          Versprechen, das der Bestand nicht hält — und Berkats Design-Gesetz
          verbietet ausdrücklich, Betrieb vorzutäuschen, wo keiner ist.
          „Zuletzt eingestellt" benennt die Sortierung und bleibt bei jedem
          Bestand wahr. Nebenbei unterscheidet es sich von „Neu entdecken"
          direkt darunter; zweimal „neu" auf einem Bildschirm wäre Lärm. */}
      <Text accessibilityRole="header" style={s.heading}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Das rechte Polster gehört in den Inhalt, nicht an die Fläche: An der
        // Fläche endete das Wischen einen Fingerbreit vor der letzten Karte.
        contentContainerStyle={s.row}
      >
        {items.map((listing) => (
          // `stretch` und eine feste Breite: Ohne gleiche Höhe steht die Reihe
          // unten ausgefranst, weil ein zweizeiliger Titel die Karte verlängert.
          <View key={`rail:${listing.id}`} style={{ width: cardWidth }}>
            {renderCard(listing)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: space.xs, marginBottom: space.md },
  /* Dieselbe Größe wie „Jetzt live" und „Neu entdecken" — die Reihe ist ein
     Abschnitt der Startseite, keine Beilage. */
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: ui.text,
    marginBottom: space.sm,
  },
  row: { gap: space.md, paddingRight: space.md, alignItems: 'stretch' },
});
