import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CheckCircle2,Lock,Zap } from 'lucide-react-native';
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
useAnimatedStyle,
useSharedValue,
withTiming,
} from 'react-native-reanimated';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

export default function ResetPasswordScreen() {
  useThemedStatusBar('light');
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handleReset = async () => {
    if (!password || !confirm) {
      Alert.alert(t('common.almost'), t('auth.rpFillBoth'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('auth.rpTooShortTitle'), t('auth.rpMin8'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('auth.rpMismatchTitle'), t('auth.rpMismatch'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      setDone(true);
      setTimeout(() => router.replace('/(tabs)'), 2200);
    }
  };

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <LinearGradient
          colors={['#000000', '#0d0016', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <CheckCircle2 size={60} stroke="#34D399" strokeWidth={1.5} />
        <Text style={styles.doneTitle}>{t('auth.rpChanged')}</Text>
        <Text style={styles.doneSub}>{t('auth.rpRedirect')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#000000', '#0d0016', '#000000']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.logoArea}>
        <Zap size={32} stroke="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
        <Text style={styles.title}>{t('auth.rpTitle')}</Text>
        <Text style={styles.sub}>{t('auth.rpSub')}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputWrapper}>
          <Lock size={18} stroke="#4B5563" strokeWidth={1.8} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.rpNewPlaceholder')}
            placeholderTextColor="#4B5563"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
          />
        </View>

        <View style={styles.inputWrapper}>
          <Lock size={18} stroke="#4B5563" strokeWidth={1.8} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.rpConfirmPlaceholder')}
            placeholderTextColor="#4B5563"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />
        </View>

        <Animated.View style={btnStyle}>
          <Pressable
            onPressIn={() => {
              btnScale.value = withTiming(0.96, { duration: 80 });
            }}
            onPressOut={() => {
              btnScale.value = withTiming(1, { duration: 80 });
            }}
            onPress={handleReset}
            style={styles.btn}
            disabled={loading}
          >
            <LinearGradient
              colors={['#CCCCCC', '#FFFFFF']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('auth.rpSave')}</Text>
            }
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  doneContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
    gap: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -1.5,
  },
  sub: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
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
  btn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -1,
  },
  doneSub: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
  },
});
