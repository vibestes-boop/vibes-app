/**
 * components/live/LivePollStartSheet.tsx
 *
 * v1.18.0 — Bottom-Sheet in dem der Host eine Live-Poll erstellt.
 *
 * Layout:
 *   Frage (TextInput, max 140 Zeichen)
 *   2-4 Optionen (TextInput pro Zeile, "+ Option hinzufügen")
 *   Primary-Button: "Umfrage starten"
 */

import React, { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, Plus, X as XIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCreateLivePoll } from '@/lib/useLivePolls';

interface Props {
  visible:    boolean;
  onClose:    () => void;
  sessionId:  string;
  onCreated?: (pollId: string) => void;
}

const MAX_OPTIONS = 4;
const MIN_OPTIONS = 2;

export function LivePollStartSheet({ visible, onClose, sessionId, onCreated }: Props) {
  const insets = useSafeAreaInsets();
  const { createPoll, isCreating } = useCreateLivePoll();

  const [question, setQuestion] = useState('');
  const [options, setOptions]   = useState<string[]>(['', '']);

  const reset = useCallback(() => {
    setQuestion('');
    setOptions(['', '']);
  }, []);

  const handleClose = useCallback(() => {
    if (isCreating) return;
    reset();
    onClose();
  }, [isCreating, onClose, reset]);

  const addOption = useCallback(() => {
    if (options.length >= MAX_OPTIONS) return;
    Haptics.selectionAsync();
    setOptions((prev) => [...prev, '']);
  }, [options.length]);

  const removeOption = useCallback(
    (idx: number) => {
      if (options.length <= MIN_OPTIONS) return;
      Haptics.selectionAsync();
      setOptions((prev) => prev.filter((_, i) => i !== idx));
    },
    [options.length],
  );

  const updateOption = useCallback((idx: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }, []);

  const canSubmit =
    question.trim().length >= 3 &&
    options.filter((o) => o.trim().length > 0).length >= MIN_OPTIONS;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isCreating) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const id = await createPoll({
        sessionId,
        question: question.trim(),
        options:  options.map((o) => o.trim()).filter((o) => o.length > 0),
      });
      onCreated?.(id);
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Fehler', err?.message ?? 'Umfrage konnte nicht erstellt werden');
    }
  }, [canSubmit, isCreating, createPoll, sessionId, question, options, onCreated, reset, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable onPress={() => {}} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <BarChart3 size={18} color="#a78bfa" strokeWidth={2.4} />
              <Text style={styles.title}>Umfrage starten</Text>
              <Pressable onPress={handleClose} hitSlop={12} style={styles.headerClose}>
                <XIcon size={18} color="#fff" strokeWidth={2.2} />
              </Pressable>
            </View>

            <Text style={styles.label}>Frage</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="z.B. Welches Thema als nächstes?"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.input}
              maxLength={140}
              multiline
            />
            <Text style={styles.charCount}>{question.length} / 140</Text>

            <Text style={[styles.label, { marginTop: 14 }]}>Antworten ({options.length})</Text>
            {options.map((opt, idx) => (
              <View key={idx} style={styles.optionRow}>
                <Text style={styles.optionIdx}>{idx + 1}</Text>
                <TextInput
                  value={opt}
                  onChangeText={(v) => updateOption(idx, v)}
                  placeholder={`Option ${idx + 1}`}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.optionInput}
                  maxLength={40}
                />
                {options.length > MIN_OPTIONS && (
                  <Pressable onPress={() => removeOption(idx)} hitSlop={12} style={styles.optionRemove}>
                    <XIcon size={14} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
                  </Pressable>
                )}
              </View>
            ))}

            {options.length < MAX_OPTIONS && (
              <Pressable onPress={addOption} style={styles.addOptionBtn}>
                <Plus size={14} color="#a78bfa" strokeWidth={2.4} />
                <Text style={styles.addOptionText}>Option hinzufügen</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || isCreating}
              style={({ pressed }) => [
                styles.submitBtn,
                { opacity: !canSubmit ? 0.45 : pressed ? 0.7 : 1 },
              ]}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Umfrage starten</Text>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#0F0F14',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  headerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    minHeight: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  charCount: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  optionIdx: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(139,92,246,0.25)',
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
  optionInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  optionRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    marginTop: 4,
  },
  addOptionText: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: 18,
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
