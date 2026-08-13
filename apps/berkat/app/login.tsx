// Anmeldung gegen dieselbe Supabase-Instanz wie Serlo.
//
// Wer dort ein Konto hat, kommt hier mit denselben Daten rein — das war der
// Grund, das Backend zu teilen. Google und Apple brauchen native Konfiguration
// und kommen dazu, sobald die App das erste Mal als Dev-Build läuft.

import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { BerkatMark } from '../components/BerkatMark';
import { ui, radius, space } from '../theme/tokens';

function readableAuthError(message: string): string {
  if (message.includes('Invalid login credentials'))
    return 'E-Mail oder Passwort stimmt nicht.';
  if (message.includes('Email not confirmed'))
    return 'Die E-Mail ist noch nicht bestätigt. Schau in dein Postfach.';
  if (message.includes('network') || message.includes('fetch'))
    return 'Keine Verbindung. Prüf kurz dein Netz.';
  return 'Anmeldung hat nicht geklappt. Versuch es noch einmal.';
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('E-Mail und Passwort ausfüllen.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (authError) {
      setError(readableAuthError(authError.message));
      return;
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Schließen">
          <X size={22} color={ui.textMuted} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <BerkatMark size={44} color={ui.brand} />
        <Text style={styles.title}>Willkommen bei Berkat</Text>
        <Text style={styles.subtitle}>
          Dein Serlo-Konto gilt hier auch — dieselbe E-Mail, dasselbe Passwort.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="name@beispiel.de"
          placeholderTextColor={ui.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Passwort"
          placeholderTextColor={ui.textMuted}
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        <Pressable
          style={[styles.button, busy && styles.buttonBusy]}
          disabled={busy}
          onPress={submit}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={ui.goldInk} />
          ) : (
            <Text style={styles.buttonText}>Anmelden</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  top: { flexDirection: 'row', paddingHorizontal: space.md, paddingBottom: space.sm },
  body: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.md },
  title: { fontSize: 24, fontWeight: '600', color: ui.text, marginTop: space.sm },
  subtitle: { fontSize: 14, color: ui.textMuted, marginBottom: space.sm },
  input: {
    backgroundColor: ui.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: ui.line,
    paddingHorizontal: space.md,
    paddingVertical: 13,
    fontSize: 16,
    color: ui.text,
  },
  button: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  buttonBusy: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '600', color: ui.goldInk },
  errorBox: {
    backgroundColor: ui.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: ui.live,
    padding: space.md,
  },
  errorText: { fontSize: 13, color: ui.text },
});
