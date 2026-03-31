import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, User, Zap } from 'lucide-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { appleSignIn } from '@/lib/useAppleSignIn';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // ── Keyboard-Navigation Refs ────────────────────────────────────
  const emailRef    = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleRegister = async () => {
    if (!email || !password || !username) {
      Alert.alert('Fehler', 'Bitte alle Felder ausfüllen.');
      return;
    }
    if (username.length < 3) {
      Alert.alert('Fehler', 'Username muss mindestens 3 Zeichen lang sein.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Fehler', 'Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) {
      setLoading(false);
      Alert.alert('Registrierung fehlgeschlagen', error.message);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: username.toLowerCase().replace(/\s/g, '_'),
        explore_vibe: 0.5,
        brain_vibe: 0.5,
      });

      if (profileError) {
        // Auth-User existiert, aber Profil-Insert ist fehlgeschlagen.
        // Auth-Account löschen damit kein Zombie-User entsteht, der sich
        // nie mehr einloggen kann (fetchProfile → null → stuck).
        await supabase.auth.signOut();
        setLoading(false);
        if (profileError.code === '23505') {
          Alert.alert('Fehler', 'Dieser Benutzername ist bereits vergeben. Bitte wähle einen anderen.');
        } else {
          Alert.alert('Fehler', 'Konto konnte nicht erstellt werden. Bitte versuche es erneut.');
        }
        return;
      }
    }

    setLoading(false);
    Alert.alert(
      'Fast geschafft! 🎉',
      'Bestätige deine E-Mail und logge dich dann ein.',
      [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#000000', '#0d0016', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoArea}>
          <Zap size={32} stroke="#22D3EE" strokeWidth={2} fill="#22D3EE" />
          <Text style={styles.logoText}>Werde Teil von Vibes</Text>
          <Text style={styles.tagline}>Dein KI-gematchter Feed wartet auf dich</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <User size={18} stroke="#4B5563" strokeWidth={1.8} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#4B5563"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Mail size={18} stroke="#4B5563" strokeWidth={1.8} />
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="E-Mail"
              placeholderTextColor="#4B5563"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={18} stroke="#4B5563" strokeWidth={1.8} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Passwort (min. 6 Zeichen)"
              placeholderTextColor="#4B5563"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
          </View>

          <Pressable
            onPress={handleRegister}
            style={styles.registerBtn}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Account erstellen"
            accessibilityState={{ disabled: loading }}
          >
            <LinearGradient
              colors={['#0891B2', '#22D3EE']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.registerBtnText}>Account erstellen</Text>
            }
          </Pressable>

          {/* ── Apple Sign-In Divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oder</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Apple Sign-In (nur iOS) ── */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={16}
              style={styles.appleBtn}
              onPress={appleSignIn}
            />
          )}

          <Link href="/(auth)/login" asChild>
          <Pressable
              style={styles.loginLink}
              accessibilityRole="link"
              accessibilityLabel="Einloggen"
            >
              <Text style={styles.loginText}>
                Bereits registriert?{' '}
                <Text style={styles.loginHighlight}>Einloggen</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 60,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 44,
    gap: 8,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  tagline: {
    color: '#4B5563',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  form: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  registerBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 6,
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loginText: {
    color: '#4B5563',
    fontSize: 14,
  },
  loginHighlight: {
    color: '#22D3EE',
    fontWeight: '600',
  },
  // ── Divider & Apple ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    fontWeight: '500',
  },
  appleBtn: {
    width: '100%',
    height: 54,
  },
});
