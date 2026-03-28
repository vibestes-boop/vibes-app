import { View, Text, Pressable } from 'react-native';
import { Tag } from 'lucide-react-native';
import { CREATE_SUGGESTED_TAGS, CREATE_MAX_TAGS } from './createConstants';
import { createStyles as styles } from './createStyles';

export function CreateTagPicker({
  selectedTags,
  onToggleTag,
}: {
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}) {
  return (
    <View style={styles.tagsSection}>
      <View style={styles.tagsSectionHeader}>
        <Tag size={14} stroke="#6B7280" strokeWidth={1.8} />
        <Text style={styles.tagsSectionTitle}>Tags (max. {CREATE_MAX_TAGS})</Text>
      </View>
      <View style={styles.tagsList}>
        {CREATE_SUGGESTED_TAGS.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => onToggleTag(tag)}
              style={[styles.tagChip, active && styles.tagChipActive]}
            >
              <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
