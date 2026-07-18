import { useAuthStore } from '@/lib/authStore';
import { uploadAvatar } from '@/lib/uploadMedia';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Camera,User } from 'lucide-react-native';
import { useState } from 'react';
import {
ActivityIndicator,KeyboardAvoidingView,Platform,
Pressable,
ScrollView,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';

export default function OnboardingUsername() {
  useThemedStatusBar('light');
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuthStore();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pickAvatar = async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 3) {
      setError(t('onboarding.usernameMin'));
      return;
    }
    if (!/^[a-z0-9_]+$/i.test(trimmed)) {
      setError(t('onboarding.usernameChars'));
      return;
    }

    const userId = profile?.id ?? session?.user?.id;
    const accessToken = session?.access_token;

    __DEV__ && console.log('[Username] userId:', userId ?? 'NULL');
    __DEV__ && console.log('[Username] token:', accessToken ? accessToken.substring(0, 20) + '...' : 'FEHLT');

    if (!userId || !accessToken) {
      setError(t('onboarding.sessionExpired'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      let avatarUrl = profile?.avatar_url ?? null;
      if (avatarUri) {
        avatarUrl = (await uploadAvatar(userId, avatarUri)).url;
      }

      // Direkter REST-Aufruf — umgeht den Supabase-Client-Proxy komplett
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

      __DEV__ && console.log('[Username] direct fetch to:', supabaseUrl + '/rest/v1/profiles');

      const res = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({ id: userId, username: trimmed, avatar_url: avatarUrl, onboarding_complete: true }),

      });

      const resText = await res.text();
      __DEV__ && console.log('[Username] fetch status:', res.status, resText.substring(0, 200));

      if (!res.ok) {
        if (resText.includes('23505') || resText.includes('unique')) {
          setError(t('onboarding.usernameTaken'));
        } else {
          setError(`Fehler ${res.status}: ${resText.substring(0, 100)}`);
        }
        return;
      }

      // Profil direkt aus der Response parsen — kein Supabase-Client-Call nötig
      try {
        const parsed = JSON.parse(resText);
        const profileData = Array.isArray(parsed) ? parsed[0] : parsed;
        if (profileData?.id) {
          const { setProfile } = useAuthStore.getState();
          setProfile(profileData);
          __DEV__ && console.log('[Username] profile set from response:', profileData.username);
        }
      } catch {
        // Parsing-Fehler ignorieren — Navigation trotzdem fortsetzen
      }

      __DEV__ && console.log('[Username] navigate to interests');
      router.push('/(onboarding)/interests');

    } catch (e: any) {
      __DEV__ && console.error('[Username] catch:', e?.message ?? e);
      setError(e?.message ?? t('onboarding.networkError'));
    } finally {
      setLoading(false);
    }
  };



  const initials = username ? username[0].toUpperCase() : '?';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={['#0A0A0A', '#0d0520', '#0A0A0A']}
          style={StyleSheet.absoluteFill}
        />

        {/* Step indicator – jetzt 4 Schritte */}
        <View style={styles.stepRow}>
          <View style={[styles.step, styles.stepDone]} />
          <View style={[styles.step, styles.stepActive]} />
          <View style={styles.step} />
          <View style={styles.step} />
        </View>

        <Text style={styles.title}>{t('onboarding.usernameTitle')}</Text>
        <Text style={styles.sub}>{t('onboarding.usernameSub')}</Text>

        {/* Avatar Picker */}
        <Pressable style={styles.avatarWrap} onPress={pickAvatar}>
          {avatarUri || profile?.avatar_url ? (
            <Image
              source={{ uri: avatarUri ?? profile?.avatar_url ?? '' }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <BlurView intensity={30} tint="dark" style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </BlurView>
          )}
          <View style={styles.avatarBadge}>
            <Camera size={14} color="#fff" strokeWidth={2} />
          </View>
        </Pressable>

        {/* Username Input */}
        <View style={styles.inputWrap}>
          <View style={styles.inputPrefix}>
            <User size={16} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
            <Text style={styles.atSign}>@</Text>
          </View>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(t) => { setUsername(t); setError(''); }}
            placeholder={t('onboarding.usernamePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.inputHint}>
          {t('onboarding.usernamePublicHint')}
        </Text>

        {/* CTA */}
        <Pressable style={styles.btn} onPress={handleContinue} disabled={loading}>
          <LinearGradient
            colors={loading ? ['#4B5563', '#4B5563'] : ['#CCCCCC', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('onboarding.next')}</Text>
            }
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  inner: { paddingHorizontal: 24, gap: 20 },
  stepRow: {
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
    marginBottom: 8,
  },
  step: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepDone: { backgroundColor: '#FFFFFF' },
  stepActive: { backgroundColor: '#CCCCCC' },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  sub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
    marginTop: -8,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginVertical: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A0A0A',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    height: 56,
  },
  inputPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  atSign: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    color: '#F87171',
    marginTop: -8,
  },
  inputHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    lineHeight: 18,
    marginTop: -8,
  },
  btn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  btnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
