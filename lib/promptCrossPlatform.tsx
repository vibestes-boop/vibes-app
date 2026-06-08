/**
 * Cross-platform Ersatz für Alert.prompt (iOS-only).
 * Auf iOS: nativer Alert.prompt.
 * Auf Android: custom Modal mit TextInput.
 *
 * Usage:
 *   promptCrossPlatform({ title, message, onConfirm, keyboardType, secureText })
 *
 * Das Modal wird programmatisch über einen globalen State gesteuert.
 * Einbinden: <PromptModal /> einmal in app/_layout.tsx mounten.
 */
import React, { createContext, useContext, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type PromptOptions = {
  title: string;
  message?: string;
  onConfirm: (value: string) => void;
  onCancel?: () => void;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  secureText?: boolean;
  placeholder?: string;
};

type PromptContextValue = {
  show: (opts: PromptOptions) => void;
};

const PromptContext = createContext<PromptContextValue>({ show: () => {} });

export function usePrompt() {
  return useContext(PromptContext);
}

/** Globaler Provider — einmal in app/_layout.tsx einbinden */
export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<PromptOptions | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const show = (options: PromptOptions) => {
    if (Platform.OS === 'ios') {
      // iOS: nativer Alert.prompt
      Alert.prompt(
        options.title,
        options.message,
        options.onConfirm,
        options.secureText ? 'secure-text' : 'plain-text',
        undefined,
        options.keyboardType,
      );
      return;
    }
    // Android: custom Modal
    setValue('');
    setOpts(options);
    setVisible(true);
  };

  const handleConfirm = () => {
    setVisible(false);
    opts?.onConfirm(value);
  };

  const handleCancel = () => {
    setVisible(false);
    opts?.onCancel?.();
  };

  return (
    <PromptContext.Provider value={{ show }}>
      {children}
      {Platform.OS !== 'ios' && (
        <Modal
          transparent
          animationType="fade"
          visible={visible}
          statusBarTranslucent
          onRequestClose={handleCancel}
        >
          <KeyboardAvoidingView behavior="padding" style={s.overlay}>
            <View style={s.card}>
              {opts?.title ? <Text style={s.title}>{opts.title}</Text> : null}
              {opts?.message ? <Text style={s.message}>{opts.message}</Text> : null}
              <TextInput
                ref={inputRef}
                style={s.input}
                value={value}
                onChangeText={setValue}
                placeholder={opts?.placeholder ?? ''}
                placeholderTextColor="rgba(0,0,0,0.35)"
                keyboardType={opts?.keyboardType ?? 'default'}
                secureTextEntry={opts?.secureText ?? false}
                autoFocus
                onSubmitEditing={handleConfirm}
                returnKeyType="done"
              />
              <View style={s.buttons}>
                <Pressable style={s.btnCancel} onPress={handleCancel}>
                  <Text style={s.btnCancelText}>Abbrechen</Text>
                </Pressable>
                <Pressable style={s.btnOk} onPress={handleConfirm}>
                  <Text style={s.btnOkText}>OK</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </PromptContext.Provider>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  card:         { width: 300, backgroundColor: '#fff', borderRadius: 14, padding: 20, gap: 12 },
  title:        { fontSize: 17, fontWeight: '700', color: '#000', textAlign: 'center' },
  message:      { fontSize: 13, color: 'rgba(0,0,0,0.55)', textAlign: 'center' },
  input:        { borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#000' },
  buttons:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancel:    { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center' },
  btnCancelText:{ fontSize: 15, fontWeight: '600', color: '#000' },
  btnOk:        { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#000', alignItems: 'center' },
  btnOkText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
});
