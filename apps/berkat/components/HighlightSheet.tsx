// Ein Highlight anlegen.
//
// ── ZWEI QUELLEN, UND DIE REIHENFOLGE IST DIE AUSSAGE ────────────────────────
//
// Oben „Foto hinzufügen", darunter erst die eigenen Stories. Instagram macht es
// andersherum, und für Instagram stimmt das auch — dort hat jeder ein Archiv.
// Berkats Fall ist der umgekehrte: Der Verkäufer, für den diese Funktion gebaut
// ist, hat heute NULL Stories und soll sein Profil trotzdem jetzt füllen. Wer
// ihm zuerst ein leeres Archiv zeigt, hat ihm gesagt, er sei zu früh dran.
//
// ⚠️ Die Story-Reihe fehlt deshalb ganz, solange es keine Stories gibt — statt
// als leerer Kasten dazustehen. Dieselbe Regel wie beim Ring.
//
// `Modal` statt einer Absolut-Ebene: Auf Android bekommen überstehende Ebenen
// über der Navigationsleiste keine Berührungen (Übergabe, Abschnitt 3).

import { useEffect, useState } from 'react';
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
import { Image } from 'expo-image';
import { Check, ImagePlus, X } from 'lucide-react-native';

import {
  HIGHLIGHT_ITEMS_MAX,
  HIGHLIGHT_TITLE_MAX,
  type HighlightItem,
} from '../lib/useHighlights';
import { radius, ratio, space, ui } from '../theme/tokens';

const THUMB = 66;

type Props = {
  visible: boolean;
  /** Die eigenen Stories als Vorlage. Leer ist der Normalfall am Anfang. */
  archive: HighlightItem[];
  busy: boolean;
  /** Hochladen läuft — die ganze Auswahl ist so lange gesperrt. */
  uploading: boolean;
  /** Was schiefging, in einem Satz. `null` = alles in Ordnung. */
  notice: string | null;
  onPickPhoto: () => void;
  /** Vom Bildschirm gehalten, damit ein Upload das Blatt überlebt. */
  items: HighlightItem[];
  onChangeItems: (items: HighlightItem[]) => void;
  onCreate: (title: string) => void;
  onClose: () => void;
};

export function HighlightSheet({
  visible,
  archive,
  busy,
  uploading,
  notice,
  onPickPhoto,
  items,
  onChangeItems,
  onCreate,
  onClose,
}: Props) {
  const [title, setTitle] = useState('');

  // Beim Öffnen zurücksetzen. Ohne das stünde nach einem Abbrechen beim
  // nächsten Mal der verworfene Titel wieder da — derselbe Fehler, den
  // `ProfileEditSheet` schon einmal hatte.
  useEffect(() => {
    if (visible) setTitle('');
  }, [visible]);

  const voll = items.length >= HIGHLIGHT_ITEMS_MAX;
  const chosen = new Set(items.map((i) => i.media_url));

  const toggle = (item: HighlightItem) => {
    if (chosen.has(item.media_url)) {
      onChangeItems(items.filter((i) => i.media_url !== item.media_url));
    } else if (!voll) {
      onChangeItems([...items, item]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Schliessen" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.wrap}
      >
        <View style={s.sheet}>
          <View style={s.grabber} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.title}>Neues Highlight</Text>
            <Text style={s.sub}>
              Bleibt auf deinem Profil stehen — auch wenn eine Story längst abgelaufen ist.
            </Text>

            {/* ── Titel ─────────────────────────────────────────────────────
                Steht zuerst, weil er die Frage beantwortet, die die Auswahl
                erst sinnvoll macht: WOFÜR sammle ich hier Bilder. */}
            <Text style={s.label}>Name</Text>
            <TextInput
              value={title}
              onChangeText={(text) => setTitle(text.slice(0, HIGHLIGHT_TITLE_MAX))}
              placeholder="z. B. Abayas"
              placeholderTextColor={ui.textMuted}
              style={s.input}
              maxLength={HIGHLIGHT_TITLE_MAX}
              returnKeyType="done"
            />

            {/* ── Ausgewählt ────────────────────────────────────────────────
                Nur sichtbar, wenn etwas drin ist. Ein leerer Kasten mit der
                Überschrift „Ausgewählt" erklärt nur sich selbst. */}
            {items.length > 0 ? (
              <>
                <Text style={s.label}>
                  Ausgewählt · {items.length}
                  {items.length === HIGHLIGHT_ITEMS_MAX ? ' (mehr geht nicht)' : ''}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.strip}>
                    {items.map((item, i) => (
                      <View key={item.media_url} style={s.chosenWrap}>
                        <View style={s.thumb}>
                          <Image
                            source={{ uri: item.thumbnail_url ?? item.media_url }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={120}
                          />
                        </View>
                        {/* Das erste Bild ist das Titelbild. Ohne diesen Hinweis
                            ist die Reihenfolge eine unsichtbare Regel — und der
                            Verkäufer wundert sich, warum ausgerechnet DAS Foto
                            auf seiner Scheibe steht. */}
                        {i === 0 ? (
                          <View style={s.coverTag}>
                            <Text style={s.coverTagText}>Titelbild</Text>
                          </View>
                        ) : null}
                        <Pressable
                          hitSlop={8}
                          style={s.remove}
                          onPress={() => onChangeItems(items.filter((x) => x.media_url !== item.media_url))}
                          accessibilityRole="button"
                          accessibilityLabel="Bild entfernen"
                        >
                          <X size={12} color={ui.card} strokeWidth={3} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : null}

            {/* ── Foto hinzufügen ───────────────────────────────────────── */}
            <Pressable
              style={[s.add, (uploading || voll) && s.addOff]}
              onPress={onPickPhoto}
              disabled={uploading || voll}
              accessibilityRole="button"
              accessibilityLabel="Foto hinzufügen"
            >
              {uploading ? (
                <ActivityIndicator color={ui.brand} />
              ) : (
                <>
                  <ImagePlus size={18} color={voll ? ui.textMuted : ui.text} />
                  <Text style={[s.addText, voll && s.addTextOff]}>
                    {voll ? `Höchstens ${HIGHLIGHT_ITEMS_MAX} Bilder` : 'Foto hinzufügen'}
                  </Text>
                </>
              )}
            </Pressable>

            {/* ── Aus den eigenen Stories ───────────────────────────────── */}
            {archive.length > 0 ? (
              <>
                <Text style={s.label}>Aus deinen Stories</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.strip}>
                    {archive.map((item) => {
                      const on = chosen.has(item.media_url);
                      return (
                        <Pressable
                          key={item.media_url}
                          onPress={() => toggle(item)}
                          disabled={uploading || (voll && !on)}
                          style={({ pressed }) => [s.thumb, on && s.thumbOn, pressed && s.pressed]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={on ? 'Bild abwählen' : 'Bild auswählen'}
                        >
                          <Image
                            source={{ uri: item.thumbnail_url ?? item.media_url }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={120}
                          />
                          {on ? (
                            <View style={s.check}>
                              <Check size={12} color={ui.card} strokeWidth={3} />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            ) : null}

            {notice ? <Text style={s.notice}>{notice}</Text> : null}

            <Pressable
              style={[s.primary, (busy || uploading || items.length === 0) && s.primaryOff]}
              disabled={busy || uploading || items.length === 0}
              onPress={() => onCreate(title)}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={ui.goldInk} />
              ) : (
                <Text style={s.primaryText}>Anlegen</Text>
              )}
            </Pressable>

            <Pressable style={s.ghost} onPress={onClose} accessibilityRole="button">
              <Text style={s.ghostText}>Abbrechen</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: ui.scrim },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: ui.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: ui.lineStrong,
    marginBottom: space.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: ui.text },
  sub: { fontSize: 12, color: ui.textMuted, marginTop: 4, lineHeight: 17 },

  label: { fontSize: 11, color: ui.textMuted, marginTop: space.lg, marginBottom: 6 },
  input: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    fontSize: 15,
    color: ui.text,
  },

  strip: { flexDirection: 'row', gap: space.sm, paddingVertical: 2 },
  chosenWrap: { position: 'relative' },
  thumb: {
    width: THUMB,
    height: THUMB / ratio.card,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  thumbOn: { borderWidth: 2, borderColor: ui.brand },
  pressed: { opacity: 0.6 },
  check: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: ui.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: ui.onImage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverTag: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: ui.overlay,
  },
  coverTagText: { fontSize: 9, fontWeight: '700', color: ui.overlayMuted },

  add: {
    marginTop: space.md,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: ui.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  addOff: { opacity: 0.6 },
  addText: { fontSize: 14, fontWeight: '600', color: ui.text },
  addTextOff: { color: ui.textMuted, fontWeight: '500' },

  notice: { fontSize: 12, color: ui.live, marginTop: space.md, lineHeight: 17 },

  primary: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  primaryOff: { opacity: 0.5 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
  ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
});
