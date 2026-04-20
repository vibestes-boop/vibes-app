/**
 * HighlightNameSheet.tsx
 *
 * Leichtgewichtiger Bottom Sheet NUR für Highlight-Benennung.
 * Wird verwendet wenn ein POST zu einem Highlight hinzugefügt wird.
 * Stories nutzen den vollen HighlightPickerSheet (mit Grid).
 *
 * Keyboard: KeyboardAvoidingView + keyboardShouldPersistTaps="always"
 */
import {
  Modal, View, Text, Pressable, ScrollView,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function HighlightNameSheet({
  visible,
  mediaUrl,
  mediaType,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  mediaUrl: string;
  mediaType: string;
  onClose: () => void;
  onConfirm: (title: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');

  const handleClose = () => {
    setTitle('');
    onClose();
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const finalTitle = title.trim() || 'Highlight';
    setTitle('');
    onClose();
    onConfirm(finalTitle);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ScrollView
            scrollEnabled={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={handleClose} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Abbrechen</Text>
              </Pressable>
              <Text style={styles.headerTitle}>Highlight benennen</Text>
              <Pressable onPress={handleSave} style={styles.headerBtn}>
                <Text style={styles.headerBtnAccent}>Fertig</Text>
              </Pressable>
            </View>

            {/* Inhalt */}
            <View style={styles.body}>
              {/* Thumbnail Preview */}
              {mediaUrl ? (
                <View style={styles.previewWrap}>
                  <LinearGradient colors={['#0e2233', '#1a1a2e']} style={StyleSheet.absoluteFill} />
                  <Image source={{ uri: mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFill} />
                </View>
              ) : null}

              <Text style={styles.label}>Name des Highlights</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="z.B. Sommer 2025, Best of …"
                placeholderTextColor="rgba(255,255,255,0.3)"
                maxLength={32}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
                blurOnSubmit={false}
                selectionColor="#FFFFFF"
              />
              <Text style={styles.charCount}>{title.length}/32</Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn:     { minWidth: 72 },
  headerBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  headerBtnAccent: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'right' },
  headerTitle:   { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  body:          { padding: 24, gap: 16 },
  previewWrap: {
    width: 120, height: 180, borderRadius: 12,
    overflow: 'hidden', alignSelf: 'center',
  },
  label:     { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 17, fontWeight: '500',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)',
  },
  charCount: { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'right' },
});
