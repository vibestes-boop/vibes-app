/**
 * Alle Kategorien auf einmal — als Blatt über der Startseite.
 *
 * ⚠️ WARUM ES DAS GIBT (21.09.2026)
 * Die Leiste auf der Startseite ist waagerecht und zeigt zwölf Oberkategorien.
 * Wer die letzte sucht, wischt an elf vorbei — und sieht nie, was es überhaupt
 * gibt. Zaur hat das an Kleinanzeigen gezeigt: Dort sitzt am Ende der Leiste
 * ein Pfeil, und dahinter liegt genau diese Liste.
 *
 * Der Kategorien-Reiter unten zeigt dasselbe, aber er ist ein Ortswechsel. Wer
 * gerade stöbert, will die Liste sehen und weiterstöbern — nicht den Reiter
 * wechseln und den Platz in der Liste verlieren.
 *
 * ⚠️ DIE UNTERTITEL SIND ECHT, NICHT GETEXTET.
 * Kleinanzeigen schreibt „Wohnungen, Häuser & Grundstücke" unter „Immobilien" —
 * das sind deren Unterkategorien. Berkats Baum hat seit `20260816150000`
 * zweiundsiebzig Einträge, also Kinder. Die ersten drei ergeben die Zeile.
 * Ein von Hand gepflegter Untertitel je Kategorie wäre eine zweite Wahrheit,
 * die beim nächsten neuen Kind veraltet.
 *
 * ⚠️ DIE BILDER SIND DIESELBEN WIE ÜBERALL SONST.
 * Im ersten Anlauf stand hier ein Strichsymbol, während Leiste, Reiter und
 * Interessen-Auswahl längst die freigestellten Motive aus
 * `assets/categories/` tragen. Zaur hat es sofort gesehen. Dieselbe Kategorie
 * muss auf jeder Fläche dasselbe Gesicht haben — sonst lernt niemand, sie am
 * Bild zu erkennen, und jede Fläche sieht nach einer eigenen App aus.
 * `categoryArt()` ist die eine Quelle; wer ein Motiv tauscht, ändert nur dort.
 */

import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { categoryArt } from '../theme/categoryArt';
import { useCategoryTree, type CategoryNode } from '../lib/useCategories';
import { radius, space, ui } from '../theme/tokens';
import { useReducedMotion } from '../lib/useReducedMotion';
import { PressFeedback } from './PressFeedback';
import { SheetHeader } from './SheetHeader';

/**
 * „Abaya & Jilbab" — aus den Kindern.
 *
 * ⚠️ Zwei, nicht drei. Mit dem Bestand („4 kaufbar") rechts daneben bleibt für
 * drei kein Platz; im Simulator brach die Zeile bei jeder Kategorie ab
 * („Abaya & Jilbab, Hijab & Tüc…"). Ein Untertitel, der immer abschneidet,
 * sieht aus wie ein Fehler statt wie eine Auskunft.
 */
function childLine(node: CategoryNode): string | null {
  const names = node.children.slice(0, 2).map((c) => c.name);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  // ⚠️ Komma, sobald ein Kind selbst ein „&" trägt. Berkats Baum hat solche
  // Namen — „Abaya & Jilbab", „Hijab & Tücher". Mit „&" verbunden wurde daraus
  // „Abaya & Jilbab & Hijab & Tücher", und niemand sieht mehr, wo das eine
  // aufhört und das andere anfängt. Im Simulator genau so gelesen.
  const joiner = names.some((n) => n.includes('&')) ? ', ' : ' & ';
  return names.join(joiner);
}

export function CategorySheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (slug: string) => void;
}) {
  // Erst laden, wenn das Blatt aufgeht. Die Startseite hat die Leiste schon;
  // den ganzen Baum braucht sie nur hier.
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { tree } = useCategoryTree(visible);
  const nodes = useMemo(() => tree.filter((n) => n.parent_slug === null), [tree]);

  return (
    /* ⚠️ Helles Blatt wie `ShelfPickSheet`, NICHT `StageSheet`.
       Im ersten Anlauf stand hier `StageSheet` — das ist die Fläche des
       LIVE-RAUMS und dunkel. Über der hellen Startseite sah die
       Kategorie-Liste damit aus wie ein Stück aus einer anderen App. Die
       Bühne ist dunkel, weil dort ein Video läuft; hier läuft keines. */
    <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Blatt schließen" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <SheetHeader title="Kategorien" onClose={onClose} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.group}>
          {nodes.map((node, index) => {
            const art = categoryArt(node.slug);
            const Icon = art.icon;
            const line = childLine(node);
            // Live schlägt alles: Wo jemand sendet, ist das die Auskunft, die
            // zählt — dieselbe Regel wie in der Leiste und im Reiter.
            const badge =
              node.live_count > 0
                ? `${node.live_count} live`
                : node.listing_count
                  ? `${node.listing_count} kaufbar`
                  : null;
            return (
              <PressFeedback
                key={node.slug}
                style={[styles.row, index === nodes.length - 1 && styles.rowLast]}
                onPress={() => {
                  onSelect(node.slug);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={badge ? `${node.name}, ${badge}` : node.name}
              >
                <View style={[styles.art, { backgroundColor: art.tint }]}>
                  {/* `contentFit="contain"` — die Motive sind freigestellt und
                      nicht quadratisch. Ein `cover` würde einer Tasche den
                      Henkel abschneiden. */}
                  {art.photo ? (
                    <Image
                      source={art.photo}
                      style={styles.photo}
                      contentFit="contain"
                      enforceEarlyResizing
                      transition={0}
                      accessible={false}
                    />
                  ) : (
                    <Icon size={22} color={ui.brand} />
                  )}
                </View>
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={styles.name}>{node.name}</Text>
                  {line ? (
                    <Text numberOfLines={1} style={styles.line}>{line}</Text>
                  ) : null}
                </View>
                {/* ⚠️ Nur wenn es etwas zu zeigen gibt. Eine „0 kaufbar" wäre
                    eine Enttäuschung in Zahlenform — dieselbe Regel wie überall
                    sonst in Berkat. */}
                {badge ? (
                  <Text style={[styles.badge, node.live_count > 0 && styles.badgeLive]}>
                    {badge}
                  </Text>
                ) : null}
                <ChevronRight size={18} color={ui.textMuted} />
              </PressFeedback>
            );
          })}
        </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    overflow: 'hidden',
    backgroundColor: ui.card,
    borderTopLeftRadius: radius.phone,
    borderTopRightRadius: radius.phone,
    paddingHorizontal: space.md,
    maxHeight: '80%',
  },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  content: { paddingBottom: space.md },
  /* Dasselbe Muster wie Konto, Versand und Benachrichtigungen: Die Gruppe
     trägt die Fläche, die Zeile nur eine Haarlinie. */
  /* Auf dem weissen Blatt braucht die Gruppe keine zweite weisse Fläche —
     die Haarlinien allein tragen die Gliederung. */
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  rowLast: { borderBottomWidth: 0 },
  /* 48 statt 44: Ein Strichsymbol trägt bei 44 px, ein Motiv mit Material und
     Schattenwurf braucht die vier Punkte mehr, sonst wird es zum Fleck. */
  art: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '88%', height: '88%' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.text },
  line: { fontSize: 12, lineHeight: 17, color: ui.textMuted },
  badge: { fontSize: 12, lineHeight: 17, color: ui.textMuted },
  badgeLive: { color: ui.live, fontWeight: '700' },
});
