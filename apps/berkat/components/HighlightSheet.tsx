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

import { useWindowDimensions, ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Image } from 'expo-image';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ImagePlus, X } from 'lucide-react-native';

import { SheetHeader } from './SheetHeader';
import { PressFeedback } from './PressFeedback';
import { useReducedMotion } from '../lib/useReducedMotion';
import { HIGHLIGHT_ITEMS_MAX, HIGHLIGHT_TITLE_MAX, type HighlightItem } from '../lib/useHighlights';
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
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
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
    <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Schliessen" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.wrap}
        pointerEvents="box-none"
      >
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <SheetHeader title="Neues Highlight" subtitle="Deine Lieblingsmomente bleiben auf deinem Profil." onClose={onClose} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* ── Titel ─────────────────────────────────────────────────────
                Steht zuerst, weil er die Frage beantwortet, die die Auswahl
                erst sinnvoll macht: WOFÜR sammle ich hier Bilder. */}
            <Text key={`copy-0-${fontScale}`} style={s.label}>Name</Text>
            <TextInput allowFontScaling={false}
              value={title}
              onChangeText={(text) => setTitle(text.slice(0, HIGHLIGHT_TITLE_MAX))}
              placeholder="z. B. Abayas"
              placeholderTextColor={ui.textMuted}
              style={[s.input, { fontSize: s.input.fontSize * fontScale, lineHeight: s.input.fontSize * 1.4 * fontScale }]}
              maxLength={HIGHLIGHT_TITLE_MAX}
              returnKeyType="done"
            />

            {/* ── Ausgewählt ────────────────────────────────────────────────
                Nur sichtbar, wenn etwas drin ist. Ein leerer Kasten mit der
                Überschrift „Ausgewählt" erklärt nur sich selbst. */}
            {items.length > 0 ? (
              <>
                <Text key={`copy-1-${fontScale}`} style={s.label}>
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
                            transition={reducedMotion ? 0 : 120}
                          />
                        </View>
                        {/* Das erste Bild ist das Titelbild. Ohne diesen Hinweis
                            ist die Reihenfolge eine unsichtbare Regel — und der
                            Verkäufer wundert sich, warum ausgerechnet DAS Foto
                            auf seiner Scheibe steht. */}
                        {i === 0 ? (
                          <View style={s.coverTag}>
                            <Text key={`copy-2-${fontScale}`} style={s.coverTagText}>Titelbild</Text>
                          </View>
                        ) : null}
                        <PressFeedback
                          hitSlop={8}
                          style={s.remove}
                          onPress={() => onChangeItems(items.filter((x) => x.media_url !== item.media_url))}
                          accessibilityRole="button"
                          accessibilityLabel="Bild entfernen"
                        >
                          <View style={s.removeDisc}><X size={16} color={ui.card} strokeWidth={2.5} /></View>
                        </PressFeedback>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : null}

            {/* ── Foto hinzufügen ───────────────────────────────────────── */}
            <PressFeedback
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
                  <Text key={`copy-3-${fontScale}`} style={[s.addText, voll && s.addTextOff]}>
                    {voll ? `Höchstens ${HIGHLIGHT_ITEMS_MAX} Bilder` : 'Foto hinzufügen'}
                  </Text>
                </>
              )}
            </PressFeedback>

            {/* ── Aus den eigenen Stories ───────────────────────────────── */}
            {archive.length > 0 ? (
              <>
                <Text key={`copy-4-${fontScale}`} style={s.label}>Aus deinen Stories</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.strip}>
                    {archive.map((item) => {
                      const on = chosen.has(item.media_url);
                      return (
                        <PressFeedback
                          key={item.media_url}
                          onPress={() => toggle(item)}
                          disabled={uploading || (voll && !on)}
                          style={[s.thumb, on && s.thumbOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={on ? 'Bild abwählen' : 'Bild auswählen'}
                        >
                          <Image
                            source={{ uri: item.thumbnail_url ?? item.media_url }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={reducedMotion ? 0 : 120}
                          />
                          {on ? (
                            <View style={s.check}>
                              <Check size={12} color={ui.card} strokeWidth={3} />
                            </View>
                          ) : null}
                        </PressFeedback>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            ) : null}

            {notice ? <Text key={`copy-5-${fontScale}`} style={s.notice}>{notice}</Text> : null}

          </ScrollView>
          <View style={s.footer}>
            <PressFeedback
              style={[s.primary, { marginTop: 0 }, (busy || uploading || items.length === 0) && s.primaryOff]}
              disabled={busy || uploading || items.length === 0}
              onPress={() => onCreate(title)}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={ui.goldInk} />
              ) : (
                <Text key={`copy-6-${fontScale}`} style={s.primaryText}>Anlegen</Text>
              )}
            </PressFeedback>

            <PressFeedback style={s.ghost} onPress={onClose} accessibilityRole="button">
              <Text key={`copy-7-${fontScale}`} style={s.ghostText}>Abbrechen</Text>
            </PressFeedback>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: ui.scrim },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    overflow: 'hidden',
    maxHeight: '88%',
    backgroundColor: ui.card,
    borderTopLeftRadius: radius.phone,
    borderTopRightRadius: radius.phone,
    padding: space.lg,
    paddingBottom: space.xl,
  },

  label: { fontSize: 13, color: ui.textMuted, marginTop: space.lg, marginBottom: 6 },
  input: {
    backgroundColor: ui.bg,
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
  removeDisc: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: ui.onImage, alignItems: 'center', justifyContent: 'center' },
  remove: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
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
    minHeight: 48,
    paddingVertical: space.md,
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

  footer: { paddingTop: space.md, marginTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.line },
  primary: {
    minHeight: 50,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  primaryOff: { opacity: 0.5 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
  ghost: { minHeight: 44, paddingVertical: space.sm, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
});
