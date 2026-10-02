import { useTheme } from '@/lib/useTheme';
import type { ThemeColors } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoogleGlyph } from '@/components/ui/GoogleGlyph';
import { supabase } from '@/lib/supabase';
import { appleSignIn } from '@/lib/useAppleSignIn';
import { ENABLE_GOOGLE_LOGIN,googleSignIn } from '@/lib/useGoogleSignIn';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Lock,Mail } from 'lucide-react-native';
import { useState } from 'react';
import {
ActivityIndicator,
Alert,
KeyboardAvoidingView,
Platform,
Pressable,
ScrollView,
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
  useThemedStatusBar('auto');
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors);
  const { t, locale, setLocale } = useI18n();
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[colors.bg.primary, colors.bg.primary]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      {/* ── Sprach-Toggle (vor dem Login erreichbar — Neulinge!) ── */}
      <View style={styles.langSwitch}>
        {(['de', 'ru', 'en', 'ce'] as const).map((loc) => {
          const active = locale === loc;
          return (
            <Pressable
              key={loc}
              onPress={() => setLocale(loc)}
              style={[styles.langBtn, active && styles.langBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.langTxt, active && styles.langTxtActive]}>
                {loc.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Logo ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(500)} style={styles.logoArea}>

        <Text style={styles.logoText}>serlo.</Text>
        <Text style={styles.tagline}>{t('nativeUi.community')}</Text>
      </Animated.View>

      {/* ── Form ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.form}>
        <View style={styles.inputWrapper}>
          <Mail size={18} stroke={colors.icon.muted} strokeWidth={1.8} />
          <TextInput
            style={styles.input}
            accessibilityLabel={t('auth.emailPlaceholder')}
            textContentType="emailAddress"
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={colors.text.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Lock size={18} stroke={colors.icon.muted} strokeWidth={1.8} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={setPassword}
            textContentType="password"
            accessibilityLabel={t('auth.passwordPlaceholder')}
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
              colors={[colors.accent.primary, colors.accent.primary]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {loading
              ? <ActivityIndicator color={colors.bg.primary} />
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
            buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg.primary,
  },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoArea: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  logoText: {
    color: c.text.primary,
    fontSize: 42,
    fontWeight: '600',
    letterSpacing: -2,
  },
  tagline: {
    color: c.text.muted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  form: {
    gap: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg.secondary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border.default,
  },
  input: {
    flex: 1,
    color: c.text.primary,
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
    color: c.bg.primary,
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
    backgroundColor: c.border.strong,
  },
  dividerText: {
    color: c.text.muted,
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
    backgroundColor: c.text.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleBtnText: {
    color: c.bg.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  registerText: {
    color: c.text.muted,
    fontSize: 14,
  },
  registerHighlight: {
    color: c.text.primary,
    fontWeight: '600',
  },
  forgotBtn: {
    minHeight: 44, justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  forgotText: {
    color: c.text.muted,
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
  langSwitch: {
    alignSelf: 'flex-end',
    marginBottom: 28,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: c.bg.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border.default,
  },
  langBtnActive: {
    backgroundColor: c.text.primary,
    borderColor: c.text.primary,
  },
  langTxt: {
    color: c.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  langTxtActive: {
    color: c.bg.primary,
  },
});
