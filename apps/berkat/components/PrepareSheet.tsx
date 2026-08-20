// „Artikel für diesen Abend vorbereiten" — das Blatt hinter einem Termin.
//
// Bis hierher entstand jeder Show-Artikel IM Raum: Der Verkäufer stand vor der
// Kamera, vor Publikum, und tippte dort Titel, Startpreis und Mindestschritt.
// Das kostet tote Sendezeit bei jedem einzelnen Artikel — und die
// „Demnächst"-Karte hatte nichts zu zeigen außer Titel und Bild.
//
// Dasselbe Blatt-Muster wie das Wann-Blatt im Sendeplan, das Filter-Blatt im
// Regal und das Bearbeiten-Blatt der Artikelseite: Die Arbeit wandert eine
// Ebene tiefer, die Übersicht zeigt nur das Ergebnis.
//
// ⚠️ Das Formular fragt bewusst NICHT nach Kategorie und Zustand, obwohl die RPC
// beides entgegennimmt. `create_live_auction` — derselbe Artikel, spontan
// aufgelegt — kennt beide Felder gar nicht; ein vorbereiteter Artikel wäre sonst
// reicher als ein spontaner, und zwei Wege zur selben Sache liefen auseinander.
// Wer sie will, ergänzt Formular und `usePrepared.prepare` gemeinsam.

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, Package, Plus, X } from 'lucide-react-native';

import { formatEuro } from '../lib/useAuction';
import { tidySize } from '../lib/useListings';
import { usePrebidCounts } from '../lib/usePrebid';
import { useReminderCounts } from '../lib/useReminders';
import { euroToCents } from '../lib/useStudio';
import { formatSlot, type PlannedShow } from '../lib/useSchedule';
import { pickAndUpload } from '../lib/uploadImage';
import type { PreparedAuction } from '../lib/usePrepared';
import { radius, space, ui } from '../theme/tokens';

/** Gespiegelt aus `prepare_live_auction` — dort wirft es `too_many_prepared`. */
const MAX_PREPARED = 50;

/**
 * „2 Vorabgebote · 5 warten" — oder nichts.
 *
 * Eigene Funktion, weil hier drei Fälle zusammenkommen (nur Gebote, nur
 * Vormerkungen, beides) und ein verschachteltes Ternary im JSX genau die Art
 * Zeile wäre, die beim nächsten Umbau falsch wird. Null wird nie genannt: Eine
 * Zahl, die „niemand" bedeutet, ist eine Enttäuschung in Zahlenform.
 */
function demandLabel(bids?: number, watching?: number): string | null {
  const parts: string[] = [];
  if (bids) parts.push(bids === 1 ? '1 Vorabgebot' : `${bids} Vorabgebote`);
  if (watching) parts.push(`${watching} warten`);
  return parts.length ? parts.join(' · ') : null;
}

export type PrepareInput = {
  title: string;
  startCents: number;
  incrementCents: number;
  buyNowCents: number | null;
  imageUrl: string | null;
  size: string | null;
};

type Props = {
  /** `null` heißt: Blatt zu. Der Termin ist zugleich der Titel darüber. */
  plan: PlannedShow | null;
  items: PreparedAuction[];
  busy: boolean;
  /**
   * ⚠️ Muss HIER hinein, nicht auf den Reiter darunter.
   *
   * Ein `pageSheet` liegt über der ganzen Seite: Ein Hinweis, den der
   * Verkaufen-Reiter setzt, wäre vom Blatt verdeckt — der Verkäufer bekäme
   * seinen Fehler erst zu sehen, wenn er zumacht, und dann ohne Zusammenhang.
   */
  notice: string | null;
  onDismissNotice: () => void;
  onClose: () => void;
  onPrepare: (input: PrepareInput) => void;
  onDiscard: (item: PreparedAuction) => void;
};

export function PrepareSheet({
  plan,
  items,
  busy,
  notice,
  onDismissNotice,
  onClose,
  onPrepare,
  onDiscard,
}: Props) {
  const [title, setTitle] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [increment, setIncrement] = useState('');
  const [buyNow, setBuyNow] = useState('');
  const [size, setSize] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Das Nachfrage-Signal, zweistufig: Wer geboten hat, und wer nur wartet.
  // Beides nur als ANZAHL — Beträge und Namen sieht niemand außer dem Bieter
  // selbst (`usePrebid.ts`, `useReminders.ts`).
  //
  // Zwei Abfragen statt einer: `get_prebid_counts` liegt seit einer Stunde
  // draußen und ist richtig. Sie durch eine kombinierte zu ersetzen hieße, eine
  // frisch ausgelieferte Funktion am Geldweg zu droppen — für eine gesparte
  // Abfrage ist das der falsche Tausch.
  const ids = items.map((i) => i.id);
  const { data: prebids } = usePrebidCounts(ids);
  const { data: watchers } = useReminderCounts(ids);

  // Der Server verlangt mindestens 1 €. Das vorher zu sagen ist freundlicher,
  // als es sich als Fehlermeldung abzuholen — dieselbe Regel wie im
  // `StandingComposer`.
  const startCents = startPrice.trim() ? euroToCents(startPrice) : 100;
  const startOk = startCents !== null && startCents >= 100;
  const full = items.length >= MAX_PREPARED;
  const canSubmit = title.trim().length >= 2 && startOk && !busy && !uploading && !full;

  const addImage = () => {
    if (uploading) return;
    setUploading(true);
    setUploadError(null);
    void pickAndUpload('article', 'portrait')
      .then((url) => {
        if (url) setImageUrl(url);
      })
      .catch((error: unknown) =>
        setUploadError(error instanceof Error ? error.message : 'Das Bild kam nicht durch.'),
      )
      .finally(() => setUploading(false));
  };

  const submit = () => {
    onPrepare({
      title,
      startCents: startCents!,
      // Der Mindestschritt hat serverseitig eine Untergrenze von 1 € und
      // dieselbe Vorgabe; leer lassen soll deshalb nicht scheitern, sondern das
      // Übliche bedeuten.
      incrementCents: increment.trim() ? (euroToCents(increment) ?? 100) : 100,
      buyNowCents: buyNow.trim() ? euroToCents(buyNow) : null,
      imageUrl,
      // Dieselbe Schreibregel wie im Regal-Formular — sonst hätte die
      // Filtergruppe später „M" und „m" als zwei Größen.
      size: tidySize(size),
    });
    setTitle('');
    setStartPrice('');
    setIncrement('');
    setBuyNow('');
    setSize('');
    setImageUrl(null);
    setUploadError(null);
  };

  /**
   * ⚠️ Mit Rückfrage, anders als das Zurückziehen im Regal.
   *
   * `discard_prepared_auction` LÖSCHT die Zeile — es gibt kein `cancelled`, aus
   * dem man sie zurückholen könnte. Und weggeworfen wird damit auch ein Foto,
   * das gerade hochgeladen wurde. Ein Fehltipp am Rand der Zeile kostet hier
   * echte Arbeit, im Regal nur einen Statuswechsel.
   */
  const confirmDiscard = (item: PreparedAuction) => {
    // Schließendes Anführungszeichen oben („…“), nicht das gerade Zollzeichen.
    // Am Gerät im Dialog aufgefallen: `„Lud Probe 5 ml"` sah aus wie ein
    // vergessener String — dieselbe Hauskonvention wie in den Rechtstexten.
    Alert.alert('Artikel verwerfen?', `„${item.title}“ ist danach weg.`, [
      { text: 'Behalten', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: () => onDiscard(item) },
    ]);
  };

  return (
    <Modal
      visible={plan !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={s.sheet}>
        <View style={s.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headTitle}>Artikel vorbereiten</Text>
            {plan ? (
              <Text numberOfLines={1} style={s.headSub}>
                {plan.title} · {formatSlot(plan.scheduled_at)}
              </Text>
            ) : null}
          </View>
          <Pressable hitSlop={10} onPress={onClose} accessibilityRole="button" accessibilityLabel="Schließen">
            <X size={22} color={ui.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingBottom: space.xl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          {notice ? (
            <Pressable style={s.notice} onPress={onDismissNotice}>
              <Text style={s.noticeText}>{notice}</Text>
            </Pressable>
          ) : null}

          {/* ── Was schon bereitliegt. Steht ÜBER dem Formular: Wer das Blatt
              zum zweiten Mal öffnet, will zuerst sehen, was er hat. ───────── */}
          {items.length > 0 ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>
                {items.length === 1 ? '1 Artikel bereit' : `${items.length} Artikel bereit`}
              </Text>
              {items.map((item) => (
                <View key={item.id} style={s.itemRow}>
                  <View style={s.itemThumb}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={100}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={s.itemTitle}>
                      {item.title}
                    </Text>
                    <Text numberOfLines={1} style={s.itemMeta}>
                      {[
                        `ab ${formatEuro(item.start_price_cents)}`,
                        item.size ? `Gr. ${item.size}` : null,
                        item.buy_now_cents ? `sofort ${formatEuro(item.buy_now_cents)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {/* Das Nachfrage-Signal, und der eigentliche Grund, warum
                        die Zahl dem VERKÄUFER gehört: Er sieht, worauf jemand
                        wartet, BEVOR er es aufruft — und kann die Reihenfolge
                        des Abends danach legen. Nur wenn es etwas zu melden
                        gibt; „0 warten" wäre eine Enttäuschung in Zahlenform.

                        Gebote zuerst: Sie sind das stärkere Signal — wer bietet,
                        hat sich schon festgelegt, wer wartet, schaut nur zu. */}
                    {demandLabel(prebids?.get(item.id), watchers?.get(item.id)) ? (
                      <Text style={s.itemDemand}>
                        {demandLabel(prebids?.get(item.id), watchers?.get(item.id))}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => confirmDiscard(item)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} verwerfen`}
                  >
                    <X size={16} color={ui.textMuted} />
                  </Pressable>
                </View>
              ))}
              {/* Die eigentliche Auskunft dieses Blattes — sie sagt, wozu das
                  Ganze gut ist, und steht deshalb bei der Ware, nicht im Kopf. */}
              <Text style={s.claimNote}>
                Beim Start dieser Show liegen sie automatisch in deiner Warteschlange.
              </Text>
            </View>
          ) : (
            <View style={s.empty}>
              <Package size={26} color={ui.lineStrong} />
              <Text style={s.emptyTitle}>Noch nichts vorbereitet</Text>
              <Text style={s.emptyBody}>
                Leg heute schon an, was du am Abend verkaufst — dann tippst du nicht vor
                laufender Kamera. Deine Zuschauer sehen vorab, was kommt.
              </Text>
            </View>
          )}

          {/* ── Das Formular. Gleiche Anordnung wie „Artikel auflegen" im
              Studio: Bild links, Titel rechts, darunter die Preise in einer
              Zeile. Wer beides kennt, findet sich sofort zurecht. ─────────── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Artikel hinzufügen</Text>

            <View style={s.titleRow}>
              <Pressable
                style={s.picker}
                onPress={addImage}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel={imageUrl ? 'Bild wechseln' : 'Bild wählen'}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                  />
                ) : null}
                {uploading ? (
                  <ActivityIndicator color={ui.brand} />
                ) : imageUrl ? null : (
                  <ImagePlus size={20} color={ui.textMuted} />
                )}
                {imageUrl && !uploading ? (
                  <Pressable
                    onPress={() => setImageUrl(null)}
                    hitSlop={10}
                    style={s.thumbClear}
                    accessibilityRole="button"
                    accessibilityLabel="Bild entfernen"
                  >
                    <X size={13} color={ui.card} />
                  </Pressable>
                ) : null}
              </Pressable>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Seidenschal, handbestickt"
                placeholderTextColor={ui.textMuted}
                style={[s.input, s.titleInput]}
                maxLength={140}
                multiline
              />
            </View>

            <View style={s.priceRow}>
              <View style={s.priceField}>
                <Text style={s.fieldLabel}>Startpreis</Text>
                <TextInput
                  value={startPrice}
                  onChangeText={setStartPrice}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={ui.textMuted}
                  style={s.input}
                />
              </View>
              <View style={s.priceField}>
                <Text style={s.fieldLabel}>Schritt</Text>
                <TextInput
                  value={increment}
                  onChangeText={setIncrement}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={ui.textMuted}
                  style={s.input}
                />
              </View>
              <View style={s.priceField}>
                <Text style={s.fieldLabel}>Sofort</Text>
                <TextInput
                  value={buyNow}
                  onChangeText={setBuyNow}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={ui.textMuted}
                  style={s.input}
                />
              </View>
              <View style={s.priceField}>
                <Text style={s.fieldLabel}>Größe</Text>
                <TextInput
                  value={size}
                  onChangeText={setSize}
                  placeholder="—"
                  placeholderTextColor={ui.textMuted}
                  style={s.input}
                  maxLength={24}
                />
              </View>
            </View>

            {startPrice.trim() && !startOk ? (
              <Text style={s.warn}>Der Startpreis muss mindestens 1 € sein.</Text>
            ) : null}
            {uploadError ? <Text style={s.warn}>{uploadError}</Text> : null}
            {full ? (
              <Text style={s.warn}>
                Fünfzig Artikel sind das Maximum für einen Abend — das reicht für jede Show. 🙂
              </Text>
            ) : null}

            <Pressable
              style={[s.primary, !canSubmit && s.primaryOff]}
              disabled={!canSubmit}
              onPress={submit}
              accessibilityRole="button"
              accessibilityLabel="Artikel vorbereiten"
            >
              <Plus size={17} color={ui.goldInk} />
              <Text style={s.primaryText}>Vorbereiten</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: ui.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  headTitle: { fontSize: 17, fontWeight: '700', color: ui.text },
  headSub: { fontSize: 12, color: ui.textMuted, marginTop: 2 },

  notice: {
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  noticeText: { fontSize: 13, color: ui.text, lineHeight: 18 },

  card: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: ui.line,
    padding: space.lg,
    marginBottom: space.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: ui.text },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
  },
  // 44 Punkte: Hier wird gearbeitet („welches davon meine ich?"), nicht
  // gestöbert — die Größenregel aus HANDOFF 18.
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  itemTitle: { fontSize: 14, fontWeight: '600', color: ui.text },
  itemMeta: { fontSize: 11, color: ui.textMuted, marginTop: 2 },
  // Grün, nicht gold: Es ist eine gute Nachricht, aber kein Kaufweg — dieselbe
  // Trennung wie bei den Bürgen (HANDOFF 15).
  itemDemand: { fontSize: 11, fontWeight: '700', color: ui.success, marginTop: 2 },
  claimNote: { fontSize: 11, color: ui.textMuted, marginTop: space.md, lineHeight: 16 },

  empty: { alignItems: 'center', paddingVertical: space.lg, marginBottom: space.md },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: space.sm },
  emptyBody: {
    fontSize: 12,
    color: ui.textMuted,
    textAlign: 'center',
    marginTop: space.xs,
    lineHeight: 18,
    paddingHorizontal: space.md,
  },

  input: {
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
    color: ui.text,
  },
  titleRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm, marginTop: space.md },
  titleInput: { flex: 1, minHeight: 68 },
  picker: {
    width: 68,
    minHeight: 68,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbClear: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ui.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },

  priceRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  priceField: { flex: 1, minWidth: 0 },
  fieldLabel: { fontSize: 11, color: ui.textMuted, marginBottom: 4 },

  warn: { fontSize: 12, color: ui.live, marginTop: space.sm },

  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
  },
  primaryOff: { opacity: 0.45 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
});
