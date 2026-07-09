import { useI18n } from '@/lib/i18n';
import { LinearGradient } from 'expo-linear-gradient';
import { Send,X } from 'lucide-react-native';
import { ActivityIndicator,Pressable,StyleSheet,Text,View } from 'react-native';
import { useAnimatedStyle,useSharedValue,withTiming } from 'react-native-reanimated';
import { createStyles as styles } from './createStyles';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

export function CreateHeader({
  title: titleProp,
  onClose,
  onPost,
  uploading,
}: {
  title?: string;
  onClose: () => void;
  onPost: () => void;
  uploading: boolean;
}) {
  const { t: tr } = useI18n();
  const title = titleProp ?? tr('create.newVibe');
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
            colors={['#CCCCCC', '#FFFFFF']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Send size={14} stroke="#fff" strokeWidth={2.5} />
              <Text style={styles.postBtnText}>{tr('create.publish')}</Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
