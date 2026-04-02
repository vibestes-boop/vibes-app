import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { X, Send } from 'lucide-react-native';
import { createStyles as styles } from './createStyles';

export function CreateHeader({
  title = 'Neuer Vibe',
  onClose,
  onPost,
  uploading,
}: {
  title?: string;
  onClose: () => void;
  onPost: () => void;
  uploading: boolean;
}) {
  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  return (
    <View style={styles.header}>
      <Pressable onPress={onClose} style={styles.closeBtn}>
        <X size={20} stroke="#9CA3AF" strokeWidth={2} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Animated.View style={sendStyle}>
        <Pressable
          onPressIn={() => {
            sendScale.value = withTiming(0.88, { duration: 80 });
          }}
          onPressOut={() => {
            sendScale.value = withTiming(1, { duration: 80 });
          }}
          onPress={onPost}
          disabled={uploading}
          style={styles.postBtn}
        >
          <LinearGradient
            colors={['#0891B2', '#22D3EE']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Send size={14} stroke="#fff" strokeWidth={2.5} />
              <Text style={styles.postBtnText}>Posten</Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
