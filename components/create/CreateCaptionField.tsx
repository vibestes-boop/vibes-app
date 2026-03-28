import { View, Text, TextInput } from 'react-native';
import { CREATE_CAPTION_MAX } from './createConstants';
import { createStyles as styles } from './createStyles';

export function CreateCaptionField({
  usernameInitial,
  caption,
  onChangeCaption,
}: {
  usernameInitial: string;
  caption: string;
  onChangeCaption: (t: string) => void;
}) {
  return (
    <>
      <View style={styles.captionWrapper}>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>{usernameInitial}</Text>
        </View>
        <TextInput
          style={styles.captionInput}
          placeholder="Was ist dein Vibe heute? ✨"
          placeholderTextColor="#4B5563"
          value={caption}
          onChangeText={onChangeCaption}
          multiline
          maxLength={CREATE_CAPTION_MAX}
        />
      </View>
      <Text style={styles.charCount}>
        {caption.length}/{CREATE_CAPTION_MAX}
      </Text>
    </>
  );
}
