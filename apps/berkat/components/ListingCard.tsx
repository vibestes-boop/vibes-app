// Die eine Karte für ein Angebot — überall dieselbe.
//
// WARUM SIE ES GEBEN MUSS
// Bis zum 17.08.2026 gab es sie viermal abgeschrieben: im Marktplatz-Raster,
// auf der Kategorie-Seite und zweimal in `StandingShelf` (Raster und Liste).
// Vier Fassungen derselben Auskunft, jede mit eigener Meta-Zeile und eigener
// Anbieterkennzeichnung — und sie waren bereits auseinandergelaufen:
//
//   • drei zeigten den Verkäufernamen, das Regal auf dem Profil nicht
//   • „Deins" (Kategorie) vs. „von dir" (Marktplatz) vs. Zurückziehen-Knopf (Regal)
//   • die Kategorie-Seite baute ihre Meta-Zeile zweimal im selben JSX auf
//
// Das ist keine Kosmetik: Die Anbieterkennzeichnung ist nach Art. 246d § 1 EGBGB
// an JEDEM Angebot Pflicht. Vier Stellen, an denen sie stehen muss, sind drei zu
// viele — es genügt, dass eine davon beim nächsten Umbau vergessen wird.
//
// ⚠️ DIE KARTE HAT KEINEN KAUFKNOPF, UND DAS IST DER PUNKT.
// Sie ist ein Weg zum Artikel, sonst nichts. Ein Kauf ist eine bindende
// Willenserklärung über echtes Geld — am 16.08.2026 bekam schon das GEBOT eine
// Ziehbahn statt eines Tippers, mit der Begründung: „Ein Bildschirm, auf dem
// Tippen die normale Geste ist, darf keinen Kauf mit demselben Tippen
// auslösen." In einem Stöber-Raster ist Tippen die normale Geste. Der Kauf
// gehört deshalb auf die Artikelseite, wo er die einzige Handlung ist und die
// Rechtsfolge danebensteht.

import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Heart, Lock } from 'lucide-react-native';

import { formatEuro } from '../lib/useAuction';
import { conditionLabel } from '../lib/useBerkatSeller';
import { listingImages, listingMeta, type Listing } from '../lib/useListings';
import { radius, ratio, space, ui } from '../theme/tokens';

type Props = {
  listing: Listing;
  /**
   * Nur setzen, wo Artikel VERSCHIEDENER Verkäufer nebeneinander liegen
   * (Marktplatz, Kategorie). Im Regal eines Verkäufers steht sein Name schon
   * im Kopf der Seite — ihn an jede Karte zu schreiben wäre Lärm.
   */
  sellerName?: string | null;
  /**
   * `grid` zum Stöbern („was soll ich mir ansehen?" — das Bild IST der Inhalt),
   * `row` zum Arbeiten („welches davon meine ich?" — das Bild ist nur
   * Wiedererkennung). Die Regel steht in HANDOFF 18.
   */
  layout?: 'grid' | 'row';
  /** Eigener Artikel — bekommt eine ruhige Markierung statt eines Kaufwegs. */
  mine?: boolean;
  onPress: () => void;
  /**
   * Nur in `row`: der Zurückziehen-Knopf im eigenen Regal.
   *
   * Er sitzt bewusst NEBEN der Fläche, die zum Artikel führt, nicht darin —
   * sonst löste ein Tipp auf den Knopf beides aus.
   */
  trailing?: ReactNode;
  /**
   * Das Merken-Herz (nur `grid`, nur fremde Artikel). Beides zusammen setzen:
   * Ohne `onToggleSaved` erscheint kein Herz — auf dem eigenen Regal und in
   * Listen ohne Merk-Funktion soll die Karte nichts versprechen.
   */
  saved?: boolean;
  onToggleSaved?: () => void;
};

export function ListingCard({
  listing,
  sellerName,
  layout = 'grid',
  mine = false,
  onPress,
  trailing,
  saved = false,
  onToggleSaved,
}: Props) {
  const imageCount = listingImages(listing).length;
  const meta = listingMeta(listing, conditionLabel(listing.condition));
  // Nur das Etikett, nicht der ganze Satz: Die Rechtsfolge („kein
  // Widerrufsrecht") steht auf der Artikelseite, also dort, wo die
  // Vertragserklärung abgegeben wird. Auf einer Stöber-Karte wäre sie eine
  // Zeile, die niemand liest — und sie hätte dort auch keine Wirkung.
  const kind =
    listing.seller_kind === 'private'
      ? 'Privatverkauf'
      : listing.seller_kind === 'business'
        ? 'Gewerblich'
        : null;

  const label = `${listing.title}, ${formatEuro(listing.buy_now_cents)}${
    sellerName ? `, von ${sellerName}` : ''
  }`;

  if (layout === 'row') {
    return (
      <View style={s.rowWrap}>
        <Pressable
          style={({ pressed }) => [s.row, pressed && s.pressed]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <View style={s.rowThumb}>
            {listing.image_url ? (
              <Image
                source={{ uri: listing.image_url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={120}
              />
            ) : null}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.titleRow}>
              <Text numberOfLines={2} style={s.rowTitle}>
                {listing.title}
              </Text>
              {listing.women_only ? <Lock size={12} color={ui.success} /> : null}
            </View>
            <Text style={s.rowPrice}>{formatEuro(listing.buy_now_cents)}</Text>
            {meta ? (
              <Text numberOfLines={1} style={s.meta}>
                {meta}
              </Text>
            ) : null}
            {kind ? <Text style={s.kind}>{kind}</Text> : null}
          </View>
        </Pressable>

        {trailing ?? null}
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [s.cell, pressed && s.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={s.thumb}>
        {listing.image_url ? (
          <Image
            source={{ uri: listing.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={140}
          />
        ) : null}
        {listing.women_only ? (
          <View style={s.lock}>
            <Lock size={11} color={ui.successInk} />
          </View>
        ) : null}
        {/* Auf dem eigenen Artikel: ein stilles Zeichen statt eines Knopfes.
            Verwaltet wird im Regal, nicht beim Stöbern. */}
        {mine ? (
          <View style={s.minePill}>
            <Text style={s.minePillText}>Deins</Text>
          </View>
        ) : null}

        {/* Das Merken-Herz. Ein Pressable IM Pressable — der innere gewinnt,
            der Tipp aufs Herz öffnet also nicht die Seite. Gefüllt in Grün:
            Gemerkt ist eine Bestätigung, keine Dringlichkeit (rot) und kein
            Kauf (gold). */}
        {!mine && onToggleSaved ? (
          <Pressable
            style={s.heart}
            hitSlop={6}
            onPress={onToggleSaved}
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            accessibilityLabel={saved ? 'Nicht mehr merken' : 'Merken'}
          >
            <Heart
              size={14}
              color={saved ? ui.success : ui.overlayMuted}
              fill={saved ? ui.success : 'transparent'}
            />
          </Pressable>
        ) : null}

        {/* Mehr als ein Foto: die Zahl sagt „hier gibt es mehr zu sehen" —
            und nur dann. Eine „1" wäre Lärm. */}
        {imageCount > 1 ? (
          <View style={s.countPill}>
            <Camera size={10} color={ui.overlayMuted} />
            <Text style={s.countPillText}>{imageCount}</Text>
          </View>
        ) : null}
      </View>

      {sellerName ? (
        <Text numberOfLines={1} style={s.seller}>
          {sellerName}
        </Text>
      ) : null}
      <Text numberOfLines={2} style={s.title}>
        {listing.title}
      </Text>
      <Text style={s.price}>{formatEuro(listing.buy_now_cents)}</Text>
      {meta ? (
        <Text numberOfLines={1} style={s.meta}>
          {meta}
        </Text>
      ) : null}
      {kind ? <Text style={s.kind}>{kind}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  pressed: { opacity: 0.7 },

  // ── Raster ───────────────────────────────────────────────────────────────
  cell: { flex: 1 },
  thumb: {
    aspectRatio: ratio.card,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  lock: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: ui.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minePill: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: ui.overlay,
  },
  // Auf `ui.overlay` gilt `overlayMuted` — das Etikett liegt über einem fremden
  // Foto, und das ist EINE VON ZWEI Stellen, an denen Berkat Text auf Bild
  // setzt (die andere ist die Live-Vorschau auf den Show-Karten; die
  // vollständige Liste steht an `ui.overlay` in `theme/tokens.ts`).
  //
  // Nachgerechnet für diese Pille: `overlayMuted` hält 4,92:1 über dem
  // dunkelsten und 5,62:1 über dem hellsten Bildpunkt, die 4,5:1 für 10 pt/700
  // sind also über die ganze Fläche gehalten. `textMuted` käme auf 3,79:1.
  minePillText: { fontSize: 10, fontWeight: '700', color: ui.overlayMuted },
  heart: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ui.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: ui.overlay,
  },
  countPillText: { fontSize: 10, fontWeight: '700', color: ui.overlayMuted },

  seller: { fontSize: 11, color: ui.textMuted, marginTop: 6 },
  title: { fontSize: 14, fontWeight: '600', color: ui.text, marginTop: 1 },
  price: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: 2 },

  // ── Zeile ────────────────────────────────────────────────────────────────
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 6,
    minWidth: 0,
  },
  rowThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: ui.text },
  rowPrice: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: 2 },

  // ── Beides ───────────────────────────────────────────────────────────────
  meta: { fontSize: 11, color: ui.textMuted, marginTop: 2 },
  /* Bewusst unauffällig: Die Angabe MUSS dastehen, sie ist aber keine Werbung.
     Ein Privatverkauf ist nicht schlechter als ein gewerblicher — er hat nur
     andere Rechte, und die stehen auf der Artikelseite. */
  kind: { fontSize: 11, color: ui.textMuted, marginTop: 1, fontWeight: '600' },
});
