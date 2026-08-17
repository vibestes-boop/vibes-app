// „Jetzt kaufbar" — der Laden eines Verkäufers zwischen den Shows.
//
// Steht bewusst ÜBER „Zuletzt verkauft": Das eine ist Ware, das andere ein
// Beleg. Wer auf ein Profil kommt, während niemand sendet, soll etwas tun
// können und nicht nur Vergangenheit lesen.
//
// Der Kauf landet im selben Sammelkorb wie ein Zuschlag aus der Show. Deshalb
// steht unter dem Knopf auch derselbe Satz — wer heute Abend noch etwas
// ersteigert, zahlt trotzdem nur einmal Versand.

import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock, ShoppingBag, MessageCircle } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { formatEuro } from '../lib/useAuction';
import { conditionLabel } from '../lib/useBerkatSeller';
import type { StandingListing } from '../lib/useStanding';

/**
 * Die Zeile unter dem Preis: Zustand, Ort, Anbietertyp.
 *
 * Als eine Funktion für beide Ansichten (Raster und Liste). Zwei Fassungen
 * derselben Auskunft laufen auseinander, sobald jemand nur eine anfasst — und
 * die Anbieterkennzeichnung ist die eine Angabe, die nach Art. 246d § 1 EGBGB
 * an JEDEM Angebot stehen muss, nicht nur an dem, das gerade gepflegt wurde.
 *
 * Reihenfolge nach Nutzen: Zustand entscheidet über den Kauf, der Ort über die
 * Abholung, der Anbietertyp über die Rechte. Wer nur eine Zeile liest, liest
 * die wichtigste.
 */
function metaLine(item: StandingListing): string | null {
  const teile = [
    conditionLabel(item.condition),
    [item.postal_code, item.city].filter(Boolean).join(' ') || null,
  ].filter(Boolean);
  return teile.length ? teile.join(' · ') : null;
}

type Props = {
  listings: StandingListing[];
  /** Der Betrachter ist der Verkäufer — dann Zurückziehen statt Kaufen. */
  isOwner: boolean;
  signedIn: boolean;
  busyId: string | null;
  onBuy: (listing: StandingListing) => void;
  /**
   * Kontakt statt Kasse.
   *
   * Ein Privatverkäufer kann ohne Stripe Connect gar kein Geld über die
   * Plattform bekommen — läuft es über das Konto des Betreibers, ist das nach
   * ZAG erlaubnispflichtig. Sein Angebot bekommt deshalb keinen Kaufknopf,
   * sondern einen Weg zu ihm. Der Server weist einen Kaufversuch zusätzlich mit
   * `contact_seller` ab; das hier ist die Oberfläche dazu, nicht die Schranke.
   */
  onContact: (listing: StandingListing) => void;
  onCancel: (listing: StandingListing) => void;
  /**
   * Was bei einem leeren Regal stehen soll. Ohne diesen Text bleibt die
   * Komponente unsichtbar.
   *
   * Am 16.08.2026 aufgefallen: Ein leeres Regal war von „gibt es hier gar
   * nicht" nicht zu unterscheiden — ausgerechnet auf dem EIGENEN Profil, also
   * genau dort, wo die Aufforderung stehen müsste, eines zu füllen. Auf einem
   * fremden Profil bleibt es richtig, nichts zu zeigen: „Dieser Verkäufer hat
   * nichts" ist eine Auskunft, die niemand braucht.
   */
  emptyText?: string | null;
  /**
   * `grid` zeigt große quadratische Bilder in zwei Spalten, `list` die
   * kompakten Zeilen mit 52-px-Vorschau.
   *
   * Der Unterschied ist keine Geschmacksfrage, sondern folgt der Frage, die der
   * Bildschirm beantwortet:
   *   • Auf dem PROFIL stöbert ein Fremder — „was soll ich mir ansehen?".
   *     Dort trägt das Bild.
   *   • Unter `/shelf` verwaltet der Verkäufer sein eigenes Regal — „welches
   *     davon ziehe ich zurück?". Dort ist das Bild nur Wiedererkennung, und
   *     eine Zeile zeigt mehr Artikel auf einmal.
   *
   * Am 16.08.2026 nachgemessen: Whatnot benutzt beide Größen, nur an den
   * jeweils richtigen Stellen.
   */
  layout?: 'list' | 'grid';
};

export function StandingShelf({
  listings,
  isOwner,
  signedIn,
  busyId,
  onBuy,
  onContact,
  onCancel,
  emptyText,
  layout = 'list',
}: Props) {
  if (listings.length === 0) {
    if (!emptyText) return null;
    return (
      <View style={s.wrap}>
        <View style={s.head}>
          <ShoppingBag size={16} color={ui.text} />
          <Text style={s.title}>Jetzt kaufbar</Text>
        </View>
        <Text style={s.empty}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <ShoppingBag size={16} color={ui.text} />
        <Text style={s.title}>Jetzt kaufbar</Text>
        <Text style={s.count}>{listings.length}</Text>
      </View>

      {layout === 'grid' ? (
        <View style={s.grid}>
          {listings.map((item) => {
            const busy = busyId === item.id;
            return (
              <View key={item.id} style={s.cell}>
                <View style={s.cellThumb}>
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={140}
                    />
                  ) : null}
                  {item.women_only ? (
                    <View style={s.cellLock}>
                      <Lock size={11} color={ui.successInk} />
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={s.cellTitle}>
                  {item.title}
                </Text>
                <Text style={s.cellPrice}>{formatEuro(item.buy_now_cents)}</Text>
                {metaLine(item) ? (
                  <Text numberOfLines={1} style={s.meta}>
                    {metaLine(item)}
                  </Text>
                ) : null}
                {item.seller_kind ? (
                  <Text style={s.kind}>
                    {item.seller_kind === 'private' ? 'Privatverkauf' : 'Gewerblich'}
                  </Text>
                ) : null}

                {isOwner ? (
                  <Pressable
                    style={s.cellGhost}
                    disabled={busy}
                    onPress={() => onCancel(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} zurückziehen`}
                  >
                    {busy ? (
                      <ActivityIndicator color={ui.textMuted} />
                    ) : (
                      <Text style={s.ghostText}>Zurückziehen</Text>
                    )}
                  </Pressable>
                ) : item.seller_kind === 'private' ? (
                  <Pressable
                    style={[s.cellContact, !signedIn && s.buyOff]}
                    disabled={!signedIn}
                    onPress={() => onContact(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} — Verkäufer anschreiben`}
                  >
                    <MessageCircle size={15} color={ui.text} />
                    <Text style={s.contactText}>Nachricht</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[s.cellBuy, (busy || !signedIn) && s.buyOff]}
                    disabled={busy || !signedIn}
                    onPress={() => onBuy(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} für ${formatEuro(item.buy_now_cents)} kaufen`}
                  >
                    {busy ? (
                      <ActivityIndicator color={ui.goldInk} />
                    ) : (
                      <Text style={s.buyText}>Kaufen</Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          })}
          {/* Hält die letzte Spalte offen, wenn die Anzahl ungerade ist. */}
          {listings.length % 2 === 1 ? <View style={s.cell} /> : null}
        </View>
      ) : (
      listings.map((item) => {
        const busy = busyId === item.id;
        return (
          <View key={item.id} style={s.row}>
            <View style={s.thumb}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={120}
                />
              ) : null}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.titleRow}>
                <Text numberOfLines={2} style={s.itemTitle}>
                  {item.title}
                </Text>
                {item.women_only ? <Lock size={12} color={ui.success} /> : null}
              </View>
              <Text style={s.price}>{formatEuro(item.buy_now_cents)}</Text>
              {metaLine(item) ? (
                <Text numberOfLines={1} style={s.meta}>
                  {metaLine(item)}
                </Text>
              ) : null}
              {item.seller_kind ? (
                <Text style={s.kind}>
                  {item.seller_kind === 'private' ? 'Privatverkauf' : 'Gewerblich'}
                </Text>
              ) : null}
            </View>

            {isOwner ? (
              <Pressable
                style={s.ghost}
                disabled={busy}
                onPress={() => onCancel(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} zurückziehen`}
              >
                {busy ? (
                  <ActivityIndicator color={ui.textMuted} />
                ) : (
                  <Text style={s.ghostText}>Zurückziehen</Text>
                )}
              </Pressable>
            ) : item.seller_kind === 'private' ? (
              <Pressable
                style={[s.contact, !signedIn && s.buyOff]}
                disabled={!signedIn}
                onPress={() => onContact(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} — Verkäufer anschreiben`}
              >
                <MessageCircle size={15} color={ui.text} />
                <Text style={s.contactText}>Nachricht</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[s.buy, (busy || !signedIn) && s.buyOff]}
                disabled={busy || !signedIn}
                onPress={() => onBuy(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} für ${formatEuro(item.buy_now_cents)} kaufen`}
              >
                {busy ? (
                  <ActivityIndicator color={ui.goldInk} />
                ) : (
                  <Text style={s.buyText}>Kaufen</Text>
                )}
              </Pressable>
            )}
          </View>
        );
      })
      )}

      {/* Derselbe Satz wie im Live-Raum, und er stimmt aus demselben Grund:
          Ein Kauf hier landet im gleichen Paket wie ein Zuschlag heute Abend. */}
      <Text style={s.hint}>
        {isOwner
          ? 'Diese Artikel bleiben kaufbar, auch wenn du nicht sendest.'
          : 'Kommt in dasselbe Paket wie deine Zuschläge — du zahlst nur einmal Versand.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.lg,
    marginTop: space.md,
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: ui.text },
  count: { fontSize: 12, fontWeight: '700', color: ui.textMuted },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitle: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: ui.text },
  price: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: 2 },

  buy: {
    minWidth: 84,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyOff: { opacity: 0.45 },
  /* Kontakt ist KEIN Kauf — deshalb nicht gold. Gold ist in Berkat der
     Kaufweg (Gebot, Preis, Zuschlag); ein „schreib ihm mal" ist eine ruhige
     Handlung und sieht auch so aus. */
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  cellContact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    marginTop: space.sm,
  },
  contactText: { fontSize: 13, fontWeight: '700', color: ui.text },

  meta: { fontSize: 11, color: ui.textMuted, marginTop: 2 },
  /* Bewusst unauffällig: Die Angabe MUSS dastehen, sie ist aber keine Werbung.
     Ein Privatverkauf ist nicht schlechter als ein gewerblicher — er hat nur
     andere Rechte, und das steht ausführlich auf der Artikelseite. */
  kind: { fontSize: 11, color: ui.textMuted, marginTop: 1, fontWeight: '600' },

  buyText: { fontSize: 14, fontWeight: '700', color: ui.goldInk },

  ghost: {
    minWidth: 84,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 12, fontWeight: '600', color: ui.textMuted },

  hint: { fontSize: 11, color: ui.textMuted, marginTop: space.xs, lineHeight: 16 },
  empty: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },

  // ── Raster-Fassung fürs Stöbern ──────────────────────────────────────────
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xs },
  // `48%` statt `flex: 1`: In einem umbrechenden Flex-Container würde `flex: 1`
  // eine einzelne Karte in der letzten Zeile auf volle Breite ziehen.
  cell: { width: '48%' },
  cellThumb: {
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  cellLock: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: ui.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellTitle: { fontSize: 14, fontWeight: '600', color: ui.text, marginTop: 6 },
  cellPrice: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: 2 },
  cellBuy: {
    marginTop: space.sm,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellGhost: {
    marginTop: space.sm,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
