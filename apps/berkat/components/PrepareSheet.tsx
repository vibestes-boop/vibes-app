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

import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, Package, X } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { formatEuro } from '../lib/useAuction';
import { tidySize } from '../lib/useListings';
import { ShelfPickSheet } from './ShelfPickSheet';
import { usePrebidCounts } from '../lib/usePrebid';
import { useReminderCounts } from '../lib/useReminders';
import { euroToCents } from '../lib/useStudio';
import { formatSlot, type PlannedShow } from '../lib/useSchedule';
import { pickAndUpload } from '../lib/uploadImage';
import type { PreparedAuction } from '../lib/usePrepared';
import { radius, space, ui } from '../theme/tokens';
import { PressFeedback } from './PressFeedback';
import { FeedbackState } from './FeedbackState';
import { ActionButton } from './ActionButton';
import { useSellerDraft } from '../lib/useSellerDraft';
import { prepareErrorText } from '../lib/usePrepared';
import { useReducedMotion } from '../lib/useReducedMotion';
import { FormInput } from './FormInput';

/** Gespiegelt aus `prepare_live_auction` — dort wirft es `too_many_prepared`. */
const MAX_PREPARED = 50;
const EMPTY_DRAFT = { title: '', startPrice: '', increment: '', buyNow: '', size: '', imageUrl: null as string | null };

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
  loading?: boolean;
  readError?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
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
  onPrepare: (input: PrepareInput) => Promise<void>;
  onDiscard: (item: PreparedAuction) => void;
  /**
   * ⚠️ Absagen stand bis zum 21.08.2026 NUR im Ankündigen-Blatt, als kleines
   * ✕ unter dem Formular — also hinter einem Knopf, der „neuen Termin anlegen"
   * verspricht. Am Gerät gemeldet: „nächste Termine kann man nicht löschen,
   * nachdem sie angelegt wurden."
   *
   * Es gehört hierher, weil DIES der Bildschirm eines Termins ist: Wer ihn
   * antippt, sieht seinen Abend — und was man ansehen kann, muss man auch
   * absagen können.
   */
  onCancelPlan: (plan: PlannedShow) => void;
};

export function PrepareSheet(props: Props) {
  const userId = useSession(s => s.userId);
  const draftPlan = useRef<string | null>(null);
  if (props.plan) draftPlan.current = props.plan.id;
  return <PrepareSheetForm key={`${userId ?? 'guest'}:${draftPlan.current ?? 'none'}`} {...props} userId={userId} />;
}

export function PrepareSheetForm({
  plan,
  items,
  busy,
  loading = false,
  readError = false,
  retrying = false,
  onRetry,
  notice,
  onDismissNotice,
  onClose,
  onPrepare,
  onDiscard,
  onCancelPlan,
  userId,
}: Props & { userId: string | null }) {
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const form = useSellerDraft(EMPTY_DRAFT);
  const { title, startPrice, increment, buyNow, size, imageUrl } = form.draft;
  const setTitle = (value: string) => form.setField('title', value);
  const setStartPrice = (value: string) => form.setField('startPrice', value);
  const setIncrement = (value: string) => form.setField('increment', value);
  const setBuyNow = (value: string) => form.setField('buyNow', value);
  const setSize = (value: string) => form.setField('size', value);
  const setImageUrl = (value: string | null) => form.setField('imageUrl', value);
  const saving = busy || form.busy;
  const unavailable = loading || readError;
  const uploadLock = useRef(false);
  const [uploading, setUploading] = useState(false);
  // Der zweite Weg, einen Artikel an diesen Abend zu hängen: nicht neu tippen,
  // sondern aus dem eigenen Regal holen (`20260821160000`).
  const [shelfOpen, setShelfOpen] = useState(false);
  const myUserId = userId;
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
  const canSubmit = title.trim().length >= 2 && startOk && !saving && !uploading && !full && !unavailable;

  const addImage = () => {
    if (uploadLock.current || saving || unavailable) return;
    uploadLock.current = true;
    setUploading(true);
    setUploadError(null);
    void pickAndUpload('article', 'portrait')
      .then((url) => {
        if (url) setImageUrl(url);
      })
      .catch((error: unknown) =>
        setUploadError(error instanceof Error ? error.message : 'Das Bild kam nicht durch.'),
      )
      .finally(() => { uploadLock.current = false; setUploading(false); });
  };

  const submit = () => {
    if (!canSubmit || !plan || uploadLock.current) return;
    void form.submit(async snapshot => {
      await onPrepare({
        title: snapshot.title,
        startCents: snapshot.startPrice.trim() ? euroToCents(snapshot.startPrice)! : 100,
        incrementCents: snapshot.increment.trim() ? (euroToCents(snapshot.increment) ?? 100) : 100,
        buyNowCents: snapshot.buyNow.trim() ? euroToCents(snapshot.buyNow) : null,
        imageUrl: snapshot.imageUrl,
        size: tidySize(snapshot.size),
      });
    }, error => prepareErrorText(error instanceof Error ? error.message : String(error)));
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
      animationType={reducedMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={s.sheet}>
        <View key={`head-${fontScale}`} style={s.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text key={`copy-0-${fontScale}`} style={s.headTitle}>Artikel vorbereiten</Text>
            {plan ? (
              <Text key={`copy-1-${fontScale}`} style={s.headSub}>
                {plan.title} · {formatSlot(plan.scheduled_at)}
              </Text>
            ) : null}
          </View>
          {/* ⚠️ „Fertig", NICHT ✕.
              Ein ✕ heißt auf jeder Plattform „verwerfen, nichts behalten" — und
              genau so fühlte es sich an: Man legt einen Artikel an, er ist
              gespeichert, und der einzige Ausgang sieht aus wie ein Abbruch.
              Hier wird nichts gesammelt und am Ende abgeschickt; jeder Artikel
              ist in dem Moment in der Datenbank, in dem er in der Liste
              erscheint. Der ehrliche Ausgang heißt deshalb „Fertig".
              Am Gerät gemeldet, 21.08.2026. */}
          <PressFeedback style={s.doneButton} hitSlop={10} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fertig">
            <Text key={`copy-2-${fontScale}`} style={s.done}>Fertig</Text>
          </PressFeedback>
        </View>

        <ScrollView
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={{ padding: space.md, paddingBottom: space.xl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          {notice ? (
            <PressFeedback style={s.notice} onPress={onDismissNotice}>
              <Text key={`copy-3-${fontScale}`} style={s.noticeText}>{notice}</Text>
            </PressFeedback>
          ) : null}

          {/* ── Was schon bereitliegt. Steht ÜBER dem Formular: Wer das Blatt
              zum zweiten Mal öffnet, will zuerst sehen, was er hat. ───────── */}
          {unavailable ? <FeedbackState title={readError ? 'Vorbereitung gerade nicht erreichbar' : 'Vorbereitete Artikel werden geladen'} loading={loading}
            body={readError ? 'Dein Entwurf bleibt erhalten. Lade den aktuellen Stand erneut.' : undefined}
            action={readError && onRetry ? { label: 'Erneut laden', onPress: onRetry, busy: retrying } : undefined} /> : null}
          {items.length > 0 ? (
            <View style={s.card}>
              <Text key={fontScale} style={s.cardTitle}>
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
                    <Text key={`copy-4-${fontScale}`} numberOfLines={1} style={s.itemTitle}>
                      {item.title}
                    </Text>
                    <Text key={`copy-5-${fontScale}`} numberOfLines={1} style={s.itemMeta}>
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
                      <Text key={`copy-6-${fontScale}`} style={s.itemDemand}>
                        {demandLabel(prebids?.get(item.id), watchers?.get(item.id))}
                      </Text>
                    ) : null}
                  </View>
                  <PressFeedback
                    style={s.removeButton}
                    hitSlop={8}
                    onPress={() => confirmDiscard(item)}
                    disabled={saving || unavailable}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} verwerfen`}
                  >
                    <X size={16} color={ui.textMuted} />
                  </PressFeedback>
                </View>
              ))}
              {/* Die eigentliche Auskunft dieses Blattes — sie sagt, wozu das
                  Ganze gut ist, und steht deshalb bei der Ware, nicht im Kopf. */}
              <Text key={`copy-7-${fontScale}`} style={s.claimNote}>
                Beim Start dieser Show liegen sie automatisch in deiner Warteschlange.
              </Text>
            </View>
          ) : !unavailable ? (
            <View style={s.empty}>
              <Package size={26} color={ui.lineStrong} />
              <Text key={`copy-8-${fontScale}`} style={s.emptyTitle}>Deine Artikel für die Show</Text>
              <Text key={`copy-9-${fontScale}`} style={s.emptyBody}>
                Wähle Artikel aus deinem Regal oder bereite unten einen neuen Artikel vor.
                Deine Zuschauer können vorab sehen, was kommt.
              </Text>
            </View>
          ) : null}

          {/* ── Aus dem Regal holen. Steht ÜBER dem Formular, weil es der
              billigere Weg ist: Wer den Artikel schon einmal eingestellt hat,
              soll ihn nicht ein zweites Mal tippen. Erst wenn es ihn dort nicht
              gibt, ist das Formular darunter dran. ────────────────────────── */}
          <PressFeedback
            style={s.shelfButton}
            disabled={saving || unavailable}
            onPress={() => setShelfOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Artikel aus dem Regal holen"
          >
            <Package size={17} color={ui.text} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text key={`copy-10-${fontScale}`} style={s.shelfButtonText}>Aus dem Regal holen</Text>
              <Text key={`copy-11-${fontScale}`} style={s.shelfButtonHint}>
                Was du schon anbietest — startet in der Show bei 1 €
              </Text>
            </View>
          </PressFeedback>

          {/* ── Das Formular. Gleiche Anordnung wie „Artikel auflegen" im
              Studio: Bild links, Titel rechts, darunter die Preise in einer
              Zeile. Wer beides kennt, findet sich sofort zurecht. ─────────── */}
          <View style={s.card}>
            <Text key={`copy-12-${fontScale}`} style={s.cardTitle}>Artikel hinzufügen</Text>

            <View style={s.titleRow}>
              <PressFeedback
                style={s.picker}
                onPress={addImage}
                disabled={uploading || saving || unavailable}
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
                  <PressFeedback
                    onPress={() => setImageUrl(null)}
                    hitSlop={10}
                    style={s.thumbClear}
                    accessibilityRole="button"
                    accessibilityLabel="Bild entfernen"
                  >
                    <X size={13} color={ui.card} />
                  </PressFeedback>
                ) : null}
              </PressFeedback>

              <FormInput
                editable={!saving}
                allowFontScaling={false}
                accessibilityLabel="Artikelname"
                value={title}
                onChangeText={setTitle}
                placeholder="Seidenschal, handbestickt"
                placeholderTextColor={ui.textMuted}
                style={[s.input, s.titleInput, { fontSize: s.input.fontSize * fontScale }]}
                maxLength={140}
                multiline
              />
            </View>

            <View style={[s.priceRow, fontScale > 1.3 && s.priceRowLarge]}>
              <View style={[s.priceField, fontScale > 1.3 && s.priceFieldLarge]}>
                <Text key={`copy-13-${fontScale}`} style={s.fieldLabel}>Startpreis</Text>
                <FormInput
                editable={!saving}
                allowFontScaling={false}
                  accessibilityLabel="Startpreis in Euro"
                value={startPrice}
                  onChangeText={setStartPrice}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={ui.textMuted}
                  style={[s.input, { fontSize: s.input.fontSize * fontScale }]}
                />
              </View>
              <View style={[s.priceField, fontScale > 1.3 && s.priceFieldLarge]}>
                <Text key={`copy-14-${fontScale}`} style={s.fieldLabel}>Schritt</Text>
                <FormInput
                editable={!saving}
                allowFontScaling={false}
                  accessibilityLabel="Gebotsschritt in Euro"
                value={increment}
                  onChangeText={setIncrement}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={ui.textMuted}
                  style={[s.input, { fontSize: s.input.fontSize * fontScale }]}
                />
              </View>
              <View style={[s.priceField, fontScale > 1.3 && s.priceFieldLarge]}>
                <Text key={`copy-15-${fontScale}`} style={s.fieldLabel}>Sofort</Text>
                <FormInput
                editable={!saving}
                allowFontScaling={false}
                  accessibilityLabel="Sofortkaufpreis in Euro"
                value={buyNow}
                  onChangeText={setBuyNow}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={ui.textMuted}
                  style={[s.input, { fontSize: s.input.fontSize * fontScale }]}
                />
              </View>
              <View style={[s.priceField, fontScale > 1.3 && s.priceFieldLarge]}>
                <Text key={`copy-16-${fontScale}`} style={s.fieldLabel}>Größe</Text>
                <FormInput
                editable={!saving}
                allowFontScaling={false}
                  accessibilityLabel="Größe"
                value={size}
                  onChangeText={setSize}
                  placeholder="—"
                  placeholderTextColor={ui.textMuted}
                  style={[s.input, { fontSize: s.input.fontSize * fontScale }]}
                  maxLength={24}
                />
              </View>
            </View>

            {startPrice.trim() && !startOk ? (
              <Text key={`copy-17-${fontScale}`} style={s.warn}>Der Startpreis muss mindestens 1 € sein.</Text>
            ) : null}
            {uploadError ? <Text key={`copy-18-${fontScale}`} style={s.warn}>{uploadError}</Text> : null}
            {full ? (
              <Text key={`copy-19-${fontScale}`} style={s.warn}>
                Fünfzig Artikel sind das Maximum für einen Abend — das reicht für jede Show. 🙂
              </Text>
            ) : null}

            {form.error ? <FeedbackState title="Speichern nicht bestätigt" body={form.error} /> : null}
            <ActionButton label={form.busy ? 'Wird gespeichert …' : 'Artikel vorbereiten'} onPress={submit}
              busy={form.busy} disabled={!canSubmit} style={{ marginTop: space.lg }} />
          </View>

          {/* ── Den Abend absagen. Ganz unten und als Textzeile, nicht als rote
              Fläche: Rot ist in Berkat die laufende Uhr, und die einzige rote
              FLÄCHE ist das Löschen des Kontos (Abschnitt 59). Ein Termin ist
              zurücknehmbar, das darf nicht aussehen wie ein Notausgang. ───── */}
          {plan ? (
            <PressFeedback
              style={s.cancelPlan}
              disabled={saving || unavailable}
              onPress={() => {
                // ⚠️ `Alert.alert`, NICHT `Alert.prompt` — das gibt es nur auf
                // iOS (CLAUDE.md, Regel 5).
                Alert.alert(
                  'Termin absagen?',
                  items.length > 0
                    ? `„${plan.title}" wird abgesagt. Deine ${
                        items.length === 1 ? 'vorbereiteter Artikel bleibt' : `${items.length} vorbereiteten Artikel bleiben`
                      } erhalten — sie rutschen zu „ohne Termin" und lassen sich dem nächsten Abend zuordnen.`
                    : `„${plan.title}" wird abgesagt. Wer dir folgt, bekommt dann keine Erinnerung mehr.`,
                  [
                    { text: 'Behalten', style: 'cancel' },
                    {
                      text: 'Absagen',
                      style: 'destructive',
                      onPress: () => onCancelPlan(plan),
                    },
                  ],
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={`${plan.title} absagen`}
            >
              <Text key={`copy-20-${fontScale}`} style={s.cancelPlanText}>Diesen Termin absagen</Text>
            </PressFeedback>
          ) : null}
        </ScrollView>
      </View>

      {/* Ein durchsichtiges Modal über einem `pageSheet` — dieselbe
          Verschachtelung wie bei den Blättern im Live-Raum. Es liegt HIER
          drin und nicht im Verkaufen-Reiter, weil es den Termin braucht, der
          nur an dieser Stelle bekannt ist. */}
      {plan ? (
        <ShelfPickSheet
          visible={shelfOpen}
          onClose={() => setShelfOpen(false)}
          sellerId={myUserId}
          target={{ planId: plan.id }}
          targetLabel={`für ${formatSlot(plan.scheduled_at)}`}
        />
      ) : null}
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

  // Bewusst kein goldener Knopf: Gold trägt in Berkat den Kauf und das
  // Abschicken. Der Weg ins Regal ist eine Abkürzung, keine Handlung mit Folgen.
  shelfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: ui.line,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  shelfButtonText: { fontSize: 15, fontWeight: '600', color: ui.text },
  shelfButtonHint: { fontSize: 12, color: ui.textMuted, marginTop: 1 },

  doneButton: { minWidth: 44, minHeight: 44, paddingHorizontal: space.sm, justifyContent: 'center', alignItems: 'center' },
  done: { fontSize: 16, fontWeight: '600', color: ui.brand },
  cancelPlan: { alignItems: 'center', paddingVertical: space.lg },
  cancelPlanText: { fontSize: 13, fontWeight: '600', color: ui.live },

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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ui.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },

  priceRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  priceField: { flex: 1, minWidth: 0 },
  priceRowLarge: { flexWrap: 'wrap' },
  priceFieldLarge: { flexBasis: '45%', flexGrow: 1 },
  removeButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, color: ui.textMuted, marginBottom: 4 },

  warn: { fontSize: 12, color: ui.live, marginTop: space.sm },

});
