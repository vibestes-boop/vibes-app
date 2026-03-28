import { ScrollView, Pressable, Text } from 'react-native';
import { exploreStyles as styles } from './exploreStyles';

export function ExploreTagChips({
  tags,
  activeTag,
  onSelectTag,
}: {
  tags: string[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tagScroll}
      contentContainerStyle={styles.tagScrollContent}
    >
      <Pressable style={[styles.tagChip, !activeTag && styles.tagChipActive]} onPress={() => onSelectTag(null)}>
        <Text style={[styles.tagChipText, !activeTag && styles.tagChipTextActive]}>Alle</Text>
      </Pressable>
      {tags.map((tag) => (
        <Pressable
          key={tag}
          style={[styles.tagChip, activeTag === tag && styles.tagChipActive]}
          onPress={() => onSelectTag(activeTag === tag ? null : tag)}
        >
          <Text style={[styles.tagChipText, activeTag === tag && styles.tagChipTextActive]}>{tag}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
