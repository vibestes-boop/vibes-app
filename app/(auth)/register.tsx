import { GoogleGlyph } from '@/components/ui/GoogleGlyph';
import { supabase } from '@/lib/supabase';
import { appleSignIn } from '@/lib/useAppleSignIn';
import { ENABLE_GOOGLE_LOGIN,googleSignIn } from '@/lib/useGoogleSignIn';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { Link,useRouter } from 'expo-router';
import { Lock,Mail,User,Zap } from 'lucide-react-native';
import { useRef,useState } from 'react';
import {
ActivityIndicator,
Alert,
KeyboardAvoidingView,
Linking,
Platform,
Pressable,
ScrollView,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';
export default function RegisterScreen() {
  useThemedStatusBar('light');
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // ── Keyboard-Navigation Refs ────────────────────────────────────
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleRegister = async () => {
    if (!email || !password || !username) {
      Alert.alert(t('common.almost'), t('auth.fillAll'));
      return;
    }
    if (username.length < 3) {
      Alert.alert(t('common.almost'), t('auth.usernameMin3'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.almost'), t('auth.passwordMin6'));
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) {
      setLoading(false);
      // Benutzername bereits vergeben
      if (error.message?.includes('duplicate') || (error as any).code === '23505') {
        Alert.alert(t('auth.usernameTakenTitle'), t('auth.usernameTakenText'));
      } else {
        Alert.alert(t('common.error'), error.message);
      }
      return;
    }

    // ✅ Kein manueller profiles.insert() nötig!
    // Der Datenbank-Trigger 'on_auth_user_created' (handle_new_user) erstellt
    // das Profil automatisch beim auth.signUp() — manueller Insert würde
    // mit "duplicate key" fehlschlagen (Primary Key Konflikt).

    setLoading(false);
    Alert.alert(
      t('auth.almostDoneTitle'),
      t('auth.confirmEmailText'),
      [{ text: t('common.ok'), onPress: () => router.replace('/(auth)/login') }]
    );

  };

  const handleGoogle = async () => {
    setLoading(true);
    await googleSignIn(); // Erster Google-Login = Signup; onAuthStateChange navigiert
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          <Zap size={32} stroke="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
          <Text style={styles.logoText}>{t('auth.registerTitle')}</Text>
          <Text style={styles.tagline}>{t('auth.registerTagline')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <User size={18} stroke="#4B5563" strokeWidth={1.8} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.usernamePlaceholder')}
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
              placeholder={t('auth.emailPlaceholder')}
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
              placeholder={t('auth.passwordMinPlaceholder')}
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
            accessibilityLabel={t('auth.createAccount')}
            accessibilityState={{ disabled: loading }}
          >
            <LinearGradient
              colors={['#CCCCCC', '#FFFFFF']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.registerBtnText}>{t('auth.createAccount')}</Text>
            }
          </Pressable>

          {/* Apple UGC (1.2): EULA-Zustimmung + Null-Toleranz-Hinweis */}
          <Text style={styles.legalText}>
            {t('auth.legalPrefix')}
            <Text style={styles.legalLink} onPress={() => Linking.openURL('https://www.serlo.ch/terms').catch(() => {})}>
              {t('auth.legalTerms')}
            </Text>
            {t('auth.legalAnd')}
            <Text style={styles.legalLink} onPress={() => Linking.openURL('https://www.serlo.ch/privacy').catch(() => {})}>
              {t('auth.legalPrivacy')}
            </Text>
            {t('auth.legalSuffix')}
          </Text>

          {/* ── Apple Sign-In Divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
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

          {/* ── Google Sign-In (gated: erst ab Build mit expo-web-browser sichtbar) ── */}
          {ENABLE_GOOGLE_LOGIN && (
            <Pressable
              onPress={handleGoogle}
              disabled={loading}
              style={styles.googleBtn}
              accessibilityRole="button"
              accessibilityLabel={t('auth.googleRegister')}
              accessibilityState={{ disabled: loading }}
            >
              <GoogleGlyph />
              <Text style={styles.googleBtnText}>{t('auth.googleRegister')}</Text>
            </Pressable>
          )}

          <Link href="/(auth)/login" asChild>
            <Pressable
              style={styles.loginLink}
              accessibilityRole="link"
              accessibilityLabel={t('auth.loginNow')}
            >
              <Text style={styles.loginText}>
                {t('auth.hasAccount')}{' '}
                <Text style={styles.loginHighlight}>{t('auth.loginNow')}</Text>
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
    fontWeight: '600',
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
  legalText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
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
    color: '#FFFFFF',
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
  googleBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleBtnText: {
    color: '#111114',
    fontSize: 17,
    fontWeight: '600',
  },
});
