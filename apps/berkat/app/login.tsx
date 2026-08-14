// Anmelden und Registrieren — ein Bildschirm, zwei Modi.
//
// Wer bei Serlo ein Konto hat, kommt hier mit denselben Daten rein; das war der
// Grund, das Backend zu teilen. Wer keins hat, legt hier eines an — bis zum
// 14.08.2026 ging das gar nicht, und damit war für jeden fremden Käufer schon
// vor dem ersten Gebot Schluss.
//
// Zwei Modi statt zwei Bildschirmen, weil sich die Masken nur um ein Feld
// unterscheiden. Google und Apple brauchen native Konfiguration und kommen
// später dazu.

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
  if (message.includes('already registered') || message.includes('already been registered'))
    return 'Diese E-Mail hat schon ein Konto. Melde dich einfach an.';
  if (message.includes('Password should be'))
    return 'Das Passwort ist zu kurz — mindestens sechs Zeichen.';
  if (message.includes('valid email') || message.includes('invalid format'))
    return 'Die E-Mail sieht nicht richtig aus.';
  if (message.includes('network') || message.includes('fetch'))
    return 'Keine Verbindung. Prüf kurz dein Netz.';
  return 'Hat nicht geklappt. Versuch es noch einmal.';
}

/** Buchstaben, Ziffern, Punkt, Strich, Unterstrich — 3 bis 24 Zeichen. */
const NAME_PATTERN = /^[\p{L}0-9._-]{3,24}$/u;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Gesetzt, wenn das Konto steht, aber noch auf die Bestätigungsmail wartet. */
  const [awaitingMail, setAwaitingMail] = useState<string | null>(null);

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError(null);
  };

  const signIn = async () => {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError(readableAuthError(authError.message));
      return;
    }
    router.back();
  };

  const signUp = async () => {
    const name = username.trim();
    if (!NAME_PATTERN.test(name)) {
      setError('Der Name braucht 3 bis 24 Zeichen — Buchstaben, Ziffern, Punkt, Strich.');
      return;
    }
    if (password.length < 6) {
      setError('Das Passwort braucht mindestens sechs Zeichen.');
      return;
    }

    // Vorab nachsehen, ob der Name frei ist. Nötig ist das nicht — die
    // Datenbank hängt bei einer Kollision eine Ziffer an, statt die
    // Registrierung scheitern zu lassen. Aber jemandem stillschweigend „max1"
    // zu geben, obwohl er „max" wollte, ist die schlechtere Auskunft.
    const { data: taken } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', name)
      .maybeSingle();
    if (taken) {
      setError(`„${name}" ist schon vergeben. Nimm einen anderen.`);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: name } },
    });
    if (authError) {
      setError(readableAuthError(authError.message));
      return;
    }

    // Ist die E-Mail-Bestätigung abgeschaltet, kommt die Sitzung sofort mit und
    // man ist drin. Sonst wartet das Konto auf den Link im Postfach. Beides
    // kommt vor, je nach Einstellung im Projekt — deshalb nicht raten, sondern
    // nachsehen.
    if (data.session) {
      router.back();
      return;
    }
    setAwaitingMail(email.trim());
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('E-Mail und Passwort ausfüllen.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await signIn();
      } else {
        await signUp();
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Konto steht, Postfach wartet ──────────────────────────────────────────
  if (awaitingMail) {
    return (
      <View style={[styles.screen, styles.center, { padding: space.xl }]}>
        <BerkatMark size={44} color={ui.brand} />
        <Text style={styles.title}>Fast geschafft</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          Wir haben dir eine Mail an {awaitingMail} geschickt. Ein Tipp auf den Link
          darin, dann kannst du mitbieten.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            setAwaitingMail(null);
            setMode('login');
            setPassword('');
          }}
        >
          <Text style={styles.buttonText}>Zur Anmeldung</Text>
        </Pressable>
      </View>
    );
  }

  const registering = mode === 'register';

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
        <Text style={styles.title}>
          {registering ? 'Konto anlegen' : 'Willkommen bei Berkat'}
        </Text>
        <Text style={styles.subtitle}>
          {registering
            ? 'Damit kannst du mitbieten und dein Paket bezahlen. Dein Konto gilt auch bei Serlo.'
            : 'Dein Serlo-Konto gilt hier auch — dieselbe E-Mail, dasselbe Passwort.'}
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {registering ? (
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Dein Name im Chat"
            placeholderTextColor={ui.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            style={styles.input}
          />
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
          placeholder={registering ? 'Passwort — mindestens 6 Zeichen' : 'Passwort'}
          placeholderTextColor={ui.textMuted}
          autoCapitalize="none"
          autoComplete={registering ? 'new-password' : 'current-password'}
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
            <Text style={styles.buttonText}>{registering ? 'Konto anlegen' : 'Anmelden'}</Text>
          )}
        </Pressable>

        <Pressable onPress={switchMode} hitSlop={8} style={styles.switchRow}>
          <Text style={styles.switchText}>
            {registering ? 'Schon ein Konto? Anmelden' : 'Noch kein Konto? Eins anlegen'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md },
  top: { flexDirection: 'row', paddingHorizontal: space.md, paddingBottom: space.sm },
  body: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.md },
  title: { fontSize: 24, fontWeight: '600', color: ui.text, marginTop: space.sm },
  subtitle: { fontSize: 14, color: ui.textMuted, marginBottom: space.sm, lineHeight: 20 },
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
  switchRow: { alignItems: 'center', paddingVertical: space.sm },
  switchText: { fontSize: 14, fontWeight: '600', color: ui.brand },
  errorBox: {
    backgroundColor: ui.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: ui.live,
    padding: space.md,
  },
  errorText: { fontSize: 13, color: ui.text },
});
