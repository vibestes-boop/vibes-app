// „Problem melden" — das Blatt an der Bestellung.
//
// ⚠️ ES VERSPRICHT EINEN VORGANG, KEIN GELD. Jeder Satz hier ist danach
// ausgesucht: „wir sehen es uns an" und „meist am selben Tag" sind Aussagen
// über Bearbeitung, nicht über Erstattung. Die Käuferschutz-Zusage steht auf
// Fassung A (`STRATEGIE-VERKAEUFER-UND-GELD.md`, Abschnitt 8) — und solange sie
// dort steht, darf hier nichts stehen, das nach Garantie klingt.
//
// Wer das je ändert, ändert eine Rechtsfrage und nicht einen Text.

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Check, ImagePlus, X } from 'lucide-react-native';

import { BUYER_DISPUTE_REASONS, type DisputeReason } from '../lib/useDispute';
import { pickAndUploadEvidence, useEvidenceUri } from '../lib/uploadEvidence';
import { radius, ratio, space, ui } from '../theme/tokens';

type Props = {
  visible: boolean;
  busy: boolean;
  /** Steht schon ein Fall offen, ist das Blatt eine Änderung, keine Neuanlage. */
  existingReason?: DisputeReason | null;
  existingDetail?: string | null;
  /** Pfad im privaten Eimer — oder eine `https://`-Adresse aus dem Altbestand. */
  existingImage?: string | null;
  /** Wird für den Ablageort des Belegs gebraucht (`<melder>/<bestellung>/…`). */
  orderId: string;
  /** Worum es geht — damit man sieht, was man da meldet. */
  orderTitle?: string | null;
  orderAmount?: string | null;
  onClose: () => void;
  onSubmit: (reason: DisputeReason, detail: string | null, imageUrl: string | null) => void;
};

export function DisputeSheet({
  visible,
  busy,
  existingReason,
  existingDetail,
  existingImage,
  orderId,
  orderTitle,
  orderAmount,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<DisputeReason | null>(existingReason ?? null);
  const [detail, setDetail] = useState(existingDetail ?? '');
  // `photo` hält den PFAD, nicht die Adresse — die entsteht erst zum Ansehen
  // und läuft nach fünf Minuten ab (`lib/uploadEvidence.ts`).
  const [photo, setPhoto] = useState<string | null>(existingImage ?? null);
  const photoUri = useEvidenceUri(photo);
  const [uploading, setUploading] = useState(false);

  /**
   * ⚠️ Zuschnitt `portrait`, also GAR KEIN Rahmen — wie im Chat.
   * Ein Beleg ist genau das, was die Kamera gesehen hat; ein quadratischer
   * Rahmen schnitte ein Viertel der Höhe weg, und darin liegt womöglich der
   * Schaden (Übergabe 65, am Gerät gemeldet).
   *
   * ⚠️ Und der Weg führt in den PRIVATEN Eimer, nicht nach R2. Bis zum
   * 23.08.2026 landete ein Beleg im selben öffentlichen Regal wie Show-Cover —
   * weltweit abrufbar, wer die Adresse hat.
   */
  const addPhoto = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const path = await pickAndUploadEvidence(orderId);
      if (path) setPhoto(path);
    } catch {
      /* Der Wähler meldet sich selbst; hier gibt es nichts zu sagen. */
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.head}>
          <Text style={s.headTitle}>Problem melden</Text>
          {/* „Fertig" wäre hier falsch — anders als beim Vorbereiten-Blatt wird
              hier NICHTS gespeichert, bevor man abschickt. Ein ✕ ist die
              ehrliche Beschriftung (Übergabe 62, Fund 4). */}
          <Pressable hitSlop={10} onPress={onClose} accessibilityLabel="Abbrechen">
            <Text style={s.cancel}>Abbrechen</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingBottom: space.xl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ⚠️ Erst zeigen, WORUM es geht. Das Blatt öffnet sich aus einer
              Bestellseite heraus, aber es deckt sie vollständig zu — ohne diese
              Zeile meldet man ins Blaue, und bei zwei ähnlichen Bestellungen
              weiß man nicht mehr, welche man erwischt hat. */}
          {orderTitle ? (
            <View style={s.about}>
              <Text numberOfLines={1} style={s.aboutTitle}>
                {orderTitle}
              </Text>
              {orderAmount ? <Text style={s.aboutAmount}>{orderAmount}</Text> : null}
            </View>
          ) : null}

          <Text style={s.lead}>Was ist passiert?</Text>

          {BUYER_DISPUTE_REASONS.map((r) => {
            const active = reason === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={[s.row, active && s.rowOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.rowText, active && s.rowTextOn]}>{r.label}</Text>
                {active ? <Check size={18} color={ui.brand} /> : null}
              </Pressable>
            );
          })}

          <Text style={s.label}>Was genau? (freiwillig)</Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder="Ein, zwei Sätze reichen."
            placeholderTextColor={ui.textMuted}
            style={s.input}
            multiline
            maxLength={2000}
          />
          {/* ⚠️ HIER, nicht nur im Chat. Der Moment, in dem jemand das Foto zur
              Hand hat, ist der Moment, in dem er meldet. Ihn dafür in einen
              anderen Bildschirm zu schicken, verliert die Hälfte der Belege —
              und ein Foto am VORGANG überlebt die Unterhaltung, wird von
              Betreibern gelesen und steht beim Klären zur Verfügung. */}
          <Text style={s.label}>Foto vom Problem (hilft am meisten)</Text>
          {photo ? (
            <View style={s.photoWrap}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.photo} contentFit="cover" />
              ) : (
                /* Die Signatur ist noch unterwegs — eine leere Fläche in der
                   Grösse des Bildes, damit das Blatt nicht springt. */
                <View style={s.photo} />
              )}
              <Pressable
                style={s.photoRemove}
                onPress={() => setPhoto(null)}
                hitSlop={8}
                accessibilityLabel="Foto entfernen"
              >
                <X size={14} color={ui.bg} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={s.photoAdd}
              onPress={() => void addPhoto()}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Foto hinzufügen"
            >
              {uploading ? (
                <ActivityIndicator color={ui.textMuted} />
              ) : (
                <>
                  <ImagePlus size={20} color={ui.textMuted} />
                  <Text style={s.photoAddText}>Foto hinzufügen</Text>
                </>
              )}
            </Pressable>
          )}

          <Pressable
            style={[s.primary, (!reason || busy) && s.primaryOff]}
            disabled={!reason || busy || uploading}
            onPress={() => reason && onSubmit(reason, detail.trim() || null, photo)}
            accessibilityRole="button"
            accessibilityLabel="Problem melden"
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.primaryText}>Melden</Text>
            )}
          </Pressable>

          {/* ⚠️ Der einzige Satz, der eine Erwartung setzt — und er setzt
              bewusst nur die, die einlösbar ist. */}
          <Text style={s.promise}>
            Der Verkäufer wird sofort benachrichtigt und meldet sich bei dir. Deine gesetzlichen
            Rechte bleiben davon unberührt.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: ui.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  headTitle: { fontSize: 17, fontWeight: '700', color: ui.text },
  cancel: { fontSize: 16, color: ui.textMuted },

  // Worum es geht — ruhig, weil es Zustand ist und keine Handlung.
  about: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.lg,
  },
  aboutTitle: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: ui.text },
  aboutAmount: { fontSize: 13, color: ui.textMuted },

  lead: { fontSize: 15, fontWeight: '700', color: ui.text, marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ui.line,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    marginBottom: 6,
  },
  rowOn: { borderColor: ui.brand, backgroundColor: ui.sunken },
  rowText: { fontSize: 15, color: ui.text },
  rowTextOn: { fontWeight: '700', color: ui.brand },

  label: { fontSize: 12, color: ui.textMuted, marginTop: space.md, marginBottom: space.xs },
  input: {
    minHeight: 90,
    textAlignVertical: 'top',
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ui.line,
    padding: space.md,
    fontSize: 15,
    color: ui.text,
  },
  hint: { fontSize: 12, color: ui.textMuted, marginTop: space.sm, lineHeight: 17 },

  // Gestrichelter Rahmen: Es ist eine Ablagefläche, kein Knopf mit Folgen —
  // dieselbe Sprache wie bei Whatnots „Photos / Scan" (elfte Analyse).
  photoAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ui.lineStrong,
  },
  photoAddText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
  photoWrap: { alignSelf: 'flex-start' },
  photo: {
    width: 120,
    aspectRatio: ratio.card,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /**
   * ⚠️ NICHT GOLD. Gold trägt in Berkat den Kauf — Gebot, Preis, Zuschlag,
   * „Jetzt kaufen". Ein Problem zu melden ist kein Kauf, und am Gerät sah der
   * goldene Knopf aus wie einer (21.08.2026). Dunkelgrün ist die Farbe für
   * „Handlung mit Gewicht, aber kein Geld" — dieselbe wie beim Bürgen-Knopf
   * ohne Kaufbezug und bei „Fertig".
   */
  primary: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: ui.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  primaryOff: { opacity: 0.45 },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  promise: { fontSize: 12, color: ui.textMuted, marginTop: space.md, lineHeight: 17 },
});
