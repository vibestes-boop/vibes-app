// Einen Artikel dauerhaft anbieten — unabhängig von einer Show.
//
// Steht bewusst im Verkaufen-Reiter und NICHT im Studio einer laufenden
// Sendung: Der Sinn eines Dauerangebots ist ja gerade, dass es ohne Sendung
// existiert. Wer es nur während einer Show anlegen könnte, hätte den Zweck
// verfehlt.
//
// Kein Bild-Zwang. Ein Verkäufer, der abends schnell drei Sachen einstellt,
// bricht sonst nach dem ersten ab — und ein Angebot ohne Foto ist immer noch
// besser als keines.

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, ShoppingBag } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { euroToCents } from '../lib/useStudio';
import { pickAndUpload } from '../lib/uploadImage';
import { CategoryPicker } from './CategoryPicker';

type Props = {
  busy: boolean;
  /** Nur geprüfte Frauen dürfen Frauen-Only setzen — der Server prüft es nochmal. */
  canWomenOnly: boolean;
  onCreate: (input: {
    title: string;
    priceCents: number;
    womenOnly: boolean;
    category: string | null;
    imageUrl: string | null;
  }) => void;
};

export function StandingComposer({ busy, canWomenOnly, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [openParent, setOpenParent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const cents = price.trim() ? euroToCents(price) : null;
  // Der Server lehnt alles bis 1 € ab. Das vorher zu sagen ist freundlicher,
  // als es sich als Fehlermeldung abzuholen.
  const priceOk = cents !== null && cents > 100;
  // `uploading` blockiert mit: Wer währenddessen abschickt, verlöre das Bild,
  // weil `imageUrl` erst nach dem Hochladen gesetzt wird.
  const canCreate = title.trim().length >= 2 && priceOk && !busy && !uploading;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <ShoppingBag size={18} color={ui.text} />
        <Text style={s.title}>Dauerhaft anbieten</Text>
      </View>
      <Text style={s.body}>
        Bleibt auf deinem Profil kaufbar, auch wenn du nicht sendest. Zwischen zwei Shows ist
        das alles, was jemand bei dir tun kann.
      </Text>

      {/* Bild links, Titel rechts — dieselbe Anordnung wie bei „Artikel
          auflegen" darüber. Dass die beiden Formulare unterschiedlich aussahen,
          war der Grund für die Verwechslung am 16.08.2026: Der einzige
          Bild-Wähler auf dem Bildschirm gehörte zur Show, und es sah aus, als
          müsse man ihn auch für ein Dauerangebot benutzen. */}
      <View style={s.titleRow}>
        <Pressable
          style={s.picker}
          disabled={uploading}
          onPress={() => {
            setUploading(true);
            setUploadError(null);
            void pickAndUpload('article')
              .then((url) => {
                if (url) setImageUrl(url);
              })
              .catch((error: unknown) =>
                setUploadError(
                  error instanceof Error ? error.message : 'Das Bild kam nicht durch.',
                ),
              )
              .finally(() => setUploading(false));
          }}
          accessibilityRole="button"
          accessibilityLabel={imageUrl ? 'Foto ändern' : 'Foto wählen'}
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
        </Pressable>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Silberring, handgemacht"
          placeholderTextColor={ui.textMuted}
          style={[s.input, s.titleInput]}
          maxLength={140}
          multiline
        />
      </View>

      {/* Kein Bild-ZWANG, aber ein deutlicher Hinweis. In der Show hältst du
          den Artikel in die Kamera — hier gibt es keine Kamera, das Foto IST
          die Auslage. */}
      {!imageUrl && !uploading ? (
        <Text style={s.photoHint}>
          Ohne Foto sehen Fremde nur ein graues Feld — hier gibt es keine Kamera, die es zeigt.
        </Text>
      ) : null}
      {uploadError ? <Text style={s.warn}>{uploadError}</Text> : null}

      <View style={s.row}>
        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="Preis in €"
          placeholderTextColor={ui.textMuted}
          keyboardType="decimal-pad"
          style={[s.input, { flex: 1, marginTop: 0 }]}
        />
        {canWomenOnly ? (
          <View style={s.switchWrap}>
            <Text style={s.switchLabel}>Frauen-Only</Text>
            <Switch value={womenOnly} onValueChange={setWomenOnly} />
          </View>
        ) : null}
      </View>

      {price.trim() && !priceOk ? (
        <Text style={s.warn}>Über 1 € — darunter lohnt sich der Versand für niemanden.</Text>
      ) : null}

      {/* Kategorie ist freiwillig, aber der einzige Weg in den Kategorien-
          Reiter. Ohne sie liegt der Artikel nur auf dem eigenen Profil — und
          wer den Verkäufer noch nicht kennt, findet ihn dort nie. */}
      <CategoryPicker
        value={category}
        onChange={setCategory}
        openParent={openParent}
        onOpenParent={setOpenParent}
      />

      <Pressable
        style={[s.primary, !canCreate && s.primaryOff]}
        disabled={!canCreate}
        onPress={() => {
          onCreate({ title, priceCents: cents!, womenOnly, category, imageUrl });
          setTitle('');
          setPrice('');
          setWomenOnly(false);
          setCategory(null);
          setOpenParent(null);
          setImageUrl(null);
          setUploadError(null);
        }}
        accessibilityRole="button"
        accessibilityLabel="Artikel dauerhaft anbieten"
      >
        <Text style={s.primaryText}>Ins Regal legen</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: ui.line,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: 16, fontWeight: '700', color: ui.text },
  body: { fontSize: 13, color: ui.textMuted, marginTop: space.xs, lineHeight: 19 },

  input: {
    marginTop: space.md,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
    color: ui.text,
  },
  titleRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  titleInput: { flex: 1, minHeight: 76 },
  picker: {
    width: 76,
    minHeight: 76,
    marginTop: space.md,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoHint: { fontSize: 11, color: ui.textMuted, marginTop: space.sm, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  switchWrap: { alignItems: 'center', gap: 2 },
  switchLabel: { fontSize: 11, color: ui.textMuted },

  warn: { fontSize: 12, color: ui.live, marginTop: space.sm },

  primary: {
    marginTop: space.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryOff: { opacity: 0.45 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
});
