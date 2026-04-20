import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/useTheme';

export function ExploreTagChips({
  tags,
  activeTag,
  onSelectTag,
}: {
  tags: string[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
}) {
  const { colors, isDark } = useTheme();

  const chip = {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
    marginRight: 0,
  } as const;

  const chipActive = {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  } as const;

  const chipText = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  };

  const chipTextActive = {
    color: colors.bg.primary,
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.tagScroll}
      contentContainerStyle={s.tagScrollContent}
    >
      <Pressable
        style={[chip, !activeTag && chipActive]}
        onPress={() => onSelectTag(null)}
      >
        <Text style={[chipText, !activeTag && chipTextActive]}>Alle</Text>
      </Pressable>
      {tags.map((tag) => (
        <Pressable
          key={tag}
          style={[chip, activeTag === tag && chipActive]}
          onPress={() => onSelectTag(activeTag === tag ? null : tag)}
        >
          <Text style={[chipText, activeTag === tag && chipTextActive]}>{tag}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tagScroll: { maxHeight: 44, marginBottom: 8 },
  tagScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
