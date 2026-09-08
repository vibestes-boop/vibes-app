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
import { ProductPhoto } from './ProductPhoto';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CalendarClock, Camera, Heart, Lock } from 'lucide-react-native';

import { formatEuro } from '../lib/useAuction';
import { conditionLabel } from '../lib/useBerkatSeller';
import {
  isShowItem,
  listingImages,
  listingMeta,
  listingPrice,
  type Listing,
} from '../lib/useListings';
import { formatSlot } from '../lib/useSchedule';
import { radius, ratio, space, ui } from '../theme/tokens';
import { PressFeedback } from './PressFeedback';

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
   * `search` für größere Suchzeilen, `row` zum Arbeiten („welches davon meine ich?" — das Bild ist nur
   * Wiedererkennung). Die Regel steht in HANDOFF 18.
   */
  layout?: 'grid' | 'row' | 'search';
  /** Eigener Artikel — bekommt eine ruhige Markierung statt eines Kaufwegs. */
  mine?: boolean;
  /**
   * Wie viele Menschen sich den Artikel gemerkt haben.
   *
   * ⚠️ NICHT der eigene Zustand — das ist `saved`. Diese Zahl sagt „andere
   * finden das interessant", und genau darin liegt ihr Wert bei dünnem
   * Bestand: Sie unterscheidet die Artikel, die jemand beachtet, von denen,
   * die nur herumliegen (Whatnot zeigt sie an derselben Ecke, Analyse 13).
   *
   * ⚠️ `undefined` oder 0 heißt: nichts anzeigen. Eine Null ist kein Stand,
   * sondern eine Enttäuschung in Zahlenform — dieselbe Regel wie bei den
   * Kategorie-Zählern und der Umsatz-Leiste.
   */
  saveCount?: number;
  onPress: () => void;
  /**
   * Nur in `row`: der Zurückziehen-Knopf im eigenen Regal.
   *
   * Er sitzt bewusst NEBEN der Fläche, die zum Artikel führt, nicht darin —
   * sonst löste ein Tipp auf den Knopf beides aus.
   */
  trailing?: ReactNode;
  /**
   * Das Merken-Herz (in `grid` und `search`, nur fremde Artikel). Beides zusammen setzen:
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
  saveCount,
  onToggleSaved,
}: Props) {
  const { fontScale } = useWindowDimensions();
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

  // Show-Ware: Preis und Datum kommen aus derselben Quelle wie überall
  // (`listingPrice`), damit Karte, Artikelseite und Suche nicht auseinanderlaufen.
  const show = isShowItem(listing) ? listing.show : null;
  const price = listingPrice(listing);
  const priceText = `${price.from ? 'ab ' : ''}${formatEuro(price.cents)}`;

  /**
   * Ein Regal-Artikel ohne Festpreis — nicht kaufbar und seit dem 25.08.2026
   * auch nicht auffindbar (`BROWSABLE` in `useListings.ts`).
   *
   * ⚠️ Die Zeile erscheint NUR dem Besitzer. Ein Fremder, der über einen alten
   * Merk-Eintrag hierherkommt, sieht schlicht „—" — die Aufgabe gehört dem
   * Verkäufer, nicht ihm.
   */
  const needsPrice = !isShowItem(listing) && listing.buy_now_cents === null;

  // ⚠️ Der Termin gehört IN die Vorlesung, nicht daneben. Wer die Karte hört
  // statt sieht, bekommt sonst „Kleid, ab 1 €" — und hält es für kaufbar.
  const label = `${listing.title}, ${priceText}${
    show ? `, in einer Sendung am ${formatSlot(show.scheduled_at)}` : ''
  }${sellerName ? `, von ${sellerName}` : ''}${kind ? `, ${kind}` : ''}`;

  if (layout === 'row' || layout === 'search') {
    return (
      <View key={fontScale} style={[s.rowWrap, layout === 'search' && s.searchCard]}>
        <PressFeedback kind="card"
          style={[s.row]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <View style={[s.rowThumb, layout === 'search' && s.searchPhoto]}>
            <ProductPhoto uri={listing.image_url} style={StyleSheet.absoluteFill} compact thumbnail />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.titleRow}>
              <Text numberOfLines={2} style={[s.rowTitle, layout === 'search' && s.searchTitle]}>
                {listing.title}
              </Text>
              {listing.women_only ? <Lock size={12} color={ui.success} /> : null}
            </View>
            {/* Auch hier `priceText` statt des nackten Festpreises. Die
                Zeilen-Fassung bekommt heute keine Show-Ware zu sehen
                (`useSellerListings` bleibt beim Regal), aber ein Preis, der
                nur in einem von zwei Layouts stimmt, ist eine Falle, die
                still auf ihren Tag wartet. */}
            <Text style={[s.rowPrice, layout === 'search' && s.searchPrice]}>{priceText}</Text>
            {show ? (
              <Text numberOfLines={1} style={s.rowShow}>
                In der Sendung {formatSlot(show.scheduled_at)}
              </Text>
            ) : null}
            {/* ⚠️ Der Satz sagt die FOLGE, nicht den Zustand. „Kein Preis" wäre
                eine Beschreibung, die man wegliest; „niemand kann ihn finden"
                ist der Grund, etwas zu tun. Warm bleiben und handlungsleitend —
                Design-Gesetz 2: Tiefs wärmer machen. */}
            {mine && needsPrice ? (
              <Text numberOfLines={2} style={s.rowWarn}>
                Ohne Preis findet ihn niemand — tipp drauf und trag einen ein.
              </Text>
            ) : null}
            {meta ? (
              <Text numberOfLines={2} style={s.meta}>
                {meta}
              </Text>
            ) : null}
            {/* In der Zeilen-Fassung steht kein Verkäufername — hier bleibt
                das Etikett allein und braucht seinen eigenen Abstand. Es an die
                Meta-Zeile zu hängen wäre falsch: Die ist einzeilig gekürzt, und
                ausgerechnet die Rechtsangabe würde als Erstes abgeschnitten. */}
            {kind ? <Text style={[s.kind, s.kindAlone]}>{kind}</Text> : null}
            {mine && layout === 'search' ? <Text style={s.searchOwn}>Deins</Text> : null}
          </View>
        </PressFeedback>

        {layout === 'search' && onToggleSaved && !mine ? (
          <PressFeedback onPress={onToggleSaved} accessibilityRole="button"
            accessibilityLabel={saved ? 'Artikel aus Merkliste entfernen' : 'Artikel merken'}
            accessibilityState={{ selected: saved }}
            style={[s.searchSave]}>
            <Heart size={20} color={saved ? ui.brand : ui.textMuted} fill={saved ? ui.brand : 'none'} />
          </PressFeedback>
        ) : null}
        {trailing ?? null}
      </View>
    );
  }

  return (
    <PressFeedback kind="card"
      // iOS kann nach einem Schriftwechsel alte Textmaße behalten. Nur diese
      // zustandsfreie Karte neu aufbauen; Filter und Listenposition bleiben stehen.
      key={fontScale}
      style={[s.cell]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={s.thumb}>
        <ProductPhoto uri={listing.image_url} style={StyleSheet.absoluteFill} thumbnail />
        {listing.women_only ? (
          <View style={s.lock}>
            <Lock size={11} color={ui.successInk} />
          </View>
        ) : null}
        {/* ⚠️ Was WEG ist, muss es sagen — sonst sieht ein verkaufter Artikel
            aus wie ein kaufbarer. Im Zeilen-Layout trug das bisher der
            `trailing`-Bereich, den es hier nicht gibt; als die Merkliste am
            24.08.2026 auf das Gitter umgestellt wurde, wäre die Auskunft sonst
            stumm verschwunden. Und genau sie ist der Zweck einer Merkliste:
            „Das, was du wolltest, ist weg."

            Unten links, weil das die einzige freie Ecke ist — Schloss oben
            links, Herz oben rechts, „Deins" unten rechts.

            ⚠️ HIER STAND `status !== 'listed'`, UND DAS WÄRE AM 25.08.2026 ZUM
            FEHLER GEWORDEN. Solange es nur `listed`, `sold` und `cancelled`
            gab, war „alles andere ist weg" richtig. Mit `scheduled` im Stöbern
            hätte dieselbe Zeile jeden für Freitag vorbereiteten Artikel als
            **„Weg"** ausgezeichnet — also genau das Gegenteil dessen, was er
            ist. Die Bedingung nennt die zwei Zustände deshalb beim Namen.
            Eine Negation deckt keinen Fall ab, den es noch nicht gibt. */}
        {listing.status === 'sold' || listing.status === 'cancelled' ? (
          <View style={s.gonePill}>
            <Text style={s.gonePillText}>
              {listing.status === 'sold' ? 'Verkauft' : 'Weg'}
            </Text>
          </View>
        ) : null}

        {/* Dieselbe Ecke, der umgekehrte Fall: nicht „war mal da", sondern
            „kommt noch". Beide schliessen sich aus — was verkauft ist, ist
            für keinen Abend mehr vorbereitet.

            ⚠️ Bewusst NICHT in Bernstein. `tokens.ts` sagt es ausdrücklich:
            eine Signalfarbe wirkt nur, solange sie selten ist, und in einem
            Raster ist sie das nie. Die Pille trägt deshalb die milchige
            Auflage wie ihre Nachbarn, nur mit der Ereignis-Tinte
            (`overlayUrgent`, auf 4,83:1 nachgemessen — Abschnitt 8). */}
        {show ? (
          <View style={[s.gonePill, s.showPill]}>
            <CalendarClock size={10} color={ui.overlayUrgent} />
            <Text style={s.showPillText}>{formatSlot(show.scheduled_at)}</Text>
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
          <PressFeedback
            style={[s.heart, saveCount && saveCount > 0 ? s.heartWide : null]}
            hitSlop={6}
            onPress={onToggleSaved}
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            accessibilityLabel={saved ? 'Nicht mehr merken' : 'Merken'}
          >
            {/* ⚠️ Zustand UND Zahl in EINEM Element.
                Eine zweite Herz-Pille mit der Zahl wäre der naheliegende Weg
                gewesen — und hätte zwei Herzen auf eine Karte gesetzt, die
                Verschiedenes bedeuten: „habe ICH gemerkt" und „andere haben
                gemerkt". Dasselbe Zeichen, zwei Aussagen, ist eine Falle.
                Whatnot setzt beides in ein Element (Analyse 13); der Knopf
                wird dafür zur Pille, sobald es etwas zu zählen gibt. */}
            <Heart
              size={14}
              color={saved ? ui.success : ui.overlayMuted}
              fill={saved ? ui.success : 'transparent'}
            />
            {saveCount && saveCount > 0 ? (
              <Text style={s.heartCount}>{saveCount}</Text>
            ) : null}
          </PressFeedback>
        ) : null}

        {/* Mehr als ein Foto: die Zahl sagt „hier gibt es mehr zu sehen" —
            und nur dann. Eine „1" wäre Lärm. */}
        {imageCount > 1 ? (
          <View style={[
            s.countPill,
            (show || listing.status === 'sold' || listing.status === 'cancelled') &&
              { bottom: space.sm + 30 * fontScale },
          ]}>
            <Camera size={10} color={ui.overlayMuted} />
            <Text style={s.countPillText}>{imageCount}</Text>
          </View>
        ) : null}

      </View>

      {/* Zwei Titelzeilen halten Preise im Raster auf gleicher Höhe.
          Die Höhe folgt der Systemschrift, damit größere Schrift Platz behält. */}
      <Text numberOfLines={2} style={[s.title, { minHeight: 40 * fontScale }]}>
        {listing.title}
      </Text>
      {/* ⚠️ Der Preis bleibt UNTER dem Bild, nicht darauf.
          Am 22.08.2026 gefragt und bewusst so entschieden: Ein Preis, der sich
          BEWEGT, gehört aufs Bild — dort steht er auf den Live-Karten, neben
          der Uhr, als Teil des Ereignisses. Ein FESTER Preis gehört zu den
          Fakten: Er wird zusammen mit Größe, Zustand und Ort gelesen, und ihn
          allein hochzuziehen zerreißt den Block.
          Dazu die Lesbarkeit: Auf einem fremden Foto bräuchte er die milchige
          Auflage (Abschnitt 8); hier steht er dunkel auf Sand. Für das Merkmal,
          das die meisten Käufe entscheidet, ist das die bessere Fläche. */}
      {/* ⚠️ „ab" ist kein Schmuckwort. Ein Festpreis sagt „dafür gehört es
          dir", ein Startpreis „dort fängt das Bieten an" — dieselbe Zahl,
          zwei völlig verschiedene Zusagen. Ohne den Vorsatz sähe ein Kleid,
          das Freitag ab 1 € versteigert wird, aus wie ein Kleid für 1 €. */}
      <Text style={s.price}>{priceText}</Text>
      <Text numberOfLines={2} style={[s.meta, { minHeight: 32 * fontScale }]}>
        {meta ?? ' '}
      </Text>
      <View style={s.byline}>
        {sellerName ? <Text numberOfLines={1} style={s.seller}>{sellerName}</Text> : null}
        {kind ? <Text style={s.kind}>{kind}</Text> : null}
      </View>
    </PressFeedback>
  );
}

const s = StyleSheet.create({

  // ── Raster ───────────────────────────────────────────────────────────────
  cell: { flex: 1, minWidth: 0, paddingBottom: space.sm },
  thumb: {
    aspectRatio: ratio.card,
    borderRadius: radius.lg,
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
  // Gleiche Sprache wie `minePill`: `ui.overlay` als Grund, `overlayMuted` als
  // Schrift. Das ist die dokumentierte Ausnahme für Text auf fremdem Foto —
  // hier NICHT durch Theme-Farben ersetzen, die im Hellmodus verschwinden.
  gonePill: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: ui.overlay,
  },
  gonePillText: { fontSize: 10, fontWeight: '700', color: ui.overlayMuted },
  /** Erbt Sitz und Fläche von `gonePill` — nur Symbol und Tinte kommen dazu. */
  showPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  showPillText: { fontSize: 10, fontWeight: '700', color: ui.overlayUrgent },
  heart: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 32,
    minHeight: 32,
    borderRadius: radius.pill,
    backgroundColor: ui.overlay,
  },
  // Mit Zahl wird aus dem Kreis eine Pille — die Breite kommt vom Inhalt.
  heartWide: { paddingHorizontal: 8 },
  heartCount: { fontSize: 11, fontWeight: '700', color: ui.overlayMuted },
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

  // Anbietername und Typ bekommen eigene Zeilen, auch bei schmalen Karten.
  byline: { gap: 2, marginTop: space.sm },
  seller: { fontSize: 11, lineHeight: 15, color: ui.textMuted },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: ui.text,
    marginTop: space.sm,
  },
  price: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: ui.text, marginTop: 4 },

  // ── Zeile ────────────────────────────────────────────────────────────────
  searchCard: { backgroundColor: ui.card, padding: space.md, borderRadius: radius.lg },
  searchPhoto: { width: 76, height: 94, borderRadius: radius.md },
  searchTitle: { fontSize: 15, lineHeight: 21 },
  searchPrice: { fontSize: 18, lineHeight: 24 },
  searchOwn: { fontSize: 12, fontWeight: '600', color: ui.brand, marginTop: 4 },
  searchSave: { width: 44, height: 44, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
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
  rowShow: { fontSize: 12, fontWeight: '600', color: ui.live, marginTop: 2 },
  rowWarn: { fontSize: 12, fontWeight: '600', color: ui.live, marginTop: 2 },

  // ── Beides ───────────────────────────────────────────────────────────────
  meta: { fontSize: 12, lineHeight: 16, color: ui.textMuted, marginTop: 2 },
  /* Bewusst unauffällig: Die Angabe MUSS dastehen, sie ist aber keine Werbung.
     Ein Privatverkauf ist nicht schlechter als ein gewerblicher — er hat nur
     andere Rechte, und die stehen auf der Artikelseite. */
  kind: { fontSize: 11, color: ui.textMuted, fontWeight: '600' },
  kindAlone: { marginTop: 1 },
});
