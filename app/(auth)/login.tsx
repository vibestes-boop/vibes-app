import { GoogleGlyph } from '@/components/ui/GoogleGlyph';
import { supabase } from '@/lib/supabase';
import { appleSignIn } from '@/lib/useAppleSignIn';
import { ENABLE_GOOGLE_LOGIN,googleSignIn } from '@/lib/useGoogleSignIn';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Lock,Mail,Zap } from 'lucide-react-native';
import { useState } from 'react';
import {
ActivityIndicator,
Alert,
KeyboardAvoidingView,
Platform,
Pressable,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';
import {
FadeInDown,
useAnimatedStyle,
useSharedValue,
withTiming,
} from 'react-native-reanimated';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

export default function LoginScreen() {
  useThemedStatusBar('light');
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.almost'), t('auth.fillEmailPassword'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert(t('auth.loginFailed'), error.message);
  };

  const handleGoogle = async () => {
    setLoading(true);
    await googleSignIn(); // Erfolg → onAuthStateChange navigiert; Abbruch/Fehler im Hook behandelt
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert(t('common.almost'), t('auth.enterEmailFirst'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: 'vibes://reset-password',
    });
    setLoading(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      setResetSent(true);
    }
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

      {/* ── Logo ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(500)} style={styles.logoArea}>
        <Zap size={36} stroke="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
        <Text style={styles.logoText}>Serlo</Text>
        <Text style={styles.tagline}>{t('auth.tagline')}</Text>
      </Animated.View>

      {/* ── Form ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.form}>
        <View style={styles.inputWrapper}>
          <Mail size={18} stroke="#4B5563" strokeWidth={1.8} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor="#4B5563"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Lock size={18} stroke="#4B5563" strokeWidth={1.8} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor="#4B5563"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {/* E-Mail Login Button */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPressIn={() => { btnScale.value = withTiming(0.96, { duration: 80 }); }}
            onPressOut={() => { btnScale.value = withTiming(1, { duration: 80 }); }}
            onPress={handleLogin}
            style={styles.loginBtn}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t('auth.login')}
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
              : <Text style={styles.loginBtnText}>{t('auth.login')}</Text>
            }
          </Pressable>
        </Animated.View>

        {/* Passwort vergessen */}
        {resetSent ? (
          <View style={styles.resetSentBox}>
            <Text style={styles.resetSentText}>{t('auth.resetSent')}</Text>
          </View>
        ) : (
          <Pressable
            onPress={handleForgotPassword}
            style={styles.forgotBtn}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t('auth.forgot')}
            accessibilityState={{ disabled: loading }}
          >
            <Text style={styles.forgotText}>{t('auth.forgot')}</Text>
          </Pressable>
        )}

        {/* ── Divider ── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Apple Sign-In (nur iOS) ── */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
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
            accessibilityLabel={t('auth.googleLogin')}
            accessibilityState={{ disabled: loading }}
          >
            <GoogleGlyph />
            <Text style={styles.googleBtnText}>{t('auth.googleLogin')}</Text>
          </Pressable>
        )}

        {/* ── Registrieren-Link ── */}
        <Link href="/(auth)/register" asChild>
          <Pressable
            style={styles.registerLink}
            accessibilityRole="link"
            accessibilityLabel={t('auth.registerNow')}
          >
            <Text style={styles.registerText}>
              {t('auth.noAccount')}{' '}
              <Text style={styles.registerHighlight}>{t('auth.registerNow')}</Text>
            </Text>
          </Pressable>
        </Link>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 52,
    gap: 8,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '600',
    letterSpacing: -2,
  },
  tagline: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    gap: 14,
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
    fontWeight: '400',
  },
  loginBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 6,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // ── Divider ──
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
  // ── Apple Sign-In ──
  appleBtn: {
    width: '100%',
    height: 54,
  },
  // ── Google Sign-In (gleicher Look wie der Apple-Button: weiß, 54 hoch) ──
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
  registerLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  registerText: {
    color: '#4B5563',
    fontSize: 14,
  },
  registerHighlight: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  forgotText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  resetSentBox: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52,211,153,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resetSentText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
});
