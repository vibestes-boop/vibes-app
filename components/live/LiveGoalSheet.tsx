/**
 * LiveGoalSheet — Cross-Platform-Ersatz für zwei aufeinanderfolgende Alert.prompt
 * beim Setzen eines Live-Ziels (Coin-Goal / Like-Goal).
 *
 * Hintergrund: Alert.prompt funktioniert nur auf iOS. Auf Android silenter Fail.
 * Lösung: Bottom-Sheet Modal mit zwei TextInput-Feldern statt zwei modale Dialoge.
 */
import { useEffect,useRef,useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LC } from '@/lib/liveColors';

type GoalType = 'gift_value' | 'likes';

type Props = {
  type: GoalType;
  visible: boolean;
  onClose: () => void;
  onSubmit: (params: { target: number; title: string }) => Promise<void> | void;
};

export function LiveGoalSheet({ type, visible, onClose, onSubmit }: Props) {
  const [targetStr, setTargetStr] = useState('');
  const [rewardTitle, setRewardTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const targetRef = useRef<TextInput>(null);

  // Felder beim Öffnen zurücksetzen
  useEffect(() => {
    if (visible) {
      setTargetStr('');
      setRewardTitle('');
      setError('');
      setLoading(false);
      // kurzes Delay damit Modal-Animation durch ist
      setTimeout(() => targetRef.current?.focus(), 300);
    }
  }, [visible]);

  const typeLabel = type === 'gift_value' ? 'Coin-Ziel' : 'Like-Ziel';
  const typeIcon = type === 'gift_value' ? '💎' : '❤️';
  const typePlaceholder = type === 'gift_value' ? 'z.B. 500' : 'z.B. 1000';

  const handleSubmit = async () => {
    setError('');
    const target = parseInt(targetStr.trim(), 10);
    if (!target || target <= 0) {
      setError('Bitte einen gültigen Zielwert eingeben.');
      return;
    }
    if (!rewardTitle.trim()) {
      setError('Bitte eine Belohnungs-Beschreibung eingeben.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ target, title: rewardTitle.trim() });
      onClose();
    } catch {
      setError('Ziel konnte nicht gesetzt werden. Versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={s.backdrop} onPress={() => { Keyboard.dismiss(); onClose(); }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.kav}
        pointerEvents="box-none"
      >
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>🎯 {typeLabel} setzen</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Schließen">
              <Text style={s.closeBtn}>✕</Text>
            </Pressable>
          </View>

          {/* Zielwert */}
          <Text style={s.label}>{typeIcon} Zielwert</Text>
          <TextInput
            ref={targetRef}
            style={s.input}
            placeholder={typePlaceholder}
            placeholderTextColor={LC.text.muted}
            value={targetStr}
            onChangeText={setTargetStr}
            keyboardType="number-pad"
            returnKeyType="next"
            onSubmitEditing={() => (document as any)?.querySelector?.('') /* no-op — next input via layout */}
            maxLength={7}
            accessibilityLabel={`${typeLabel} eingeben`}
          />

          {/* Belohnungs-Beschreibung */}
          <Text style={[s.label, { marginTop: 16 }]}>🎁 Belohnung bei Erreichen</Text>
          <TextInput
            style={s.input}
            placeholder='z.B. "Ich tanze 30 Sekunden"'
            placeholderTextColor={LC.text.muted}
            value={rewardTitle}
            onChangeText={setRewardTitle}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            maxLength={100}
            accessibilityLabel="Belohnungs-Beschreibung eingeben"
          />

          {/* Fehler */}
          {error ? <Text style={s.errorText}>{error}</Text> : null}

          {/* Buttons */}
          <View style={s.btnRow}>
            <Pressable
              style={s.cancelBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
            >
              <Text style={s.cancelBtnText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              style={[s.submitBtn, loading && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Ziel setzen"
            >
              <Text style={s.submitBtnText}>{loading ? 'Wird gesetzt…' : 'Ziel setzen'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LC.bg.dimOverlay,
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: LC.bg.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: LC.border.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    color: LC.text.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    color: LC.text.muted,
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    color: LC.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: LC.bg.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LC.border.default,
    color: LC.text.primary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: LC.accent.danger,
    fontSize: 13,
    marginTop: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LC.border.default,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: LC.text.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: LC.accent.purple,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: LC.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
