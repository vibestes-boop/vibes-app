import { ScrollView,StyleSheet } from 'react-native';
import { SlidingLabel, SlidingPill, SpringPressable, useSlidingSelection } from '@/components/ui/SlidingSelection';
import { useTheme } from '@/lib/useTheme';
import { useI18n } from '@/lib/i18n';

export function ExploreTagChips({
  tags,
  activeTag,
  onSelectTag,
}: {
  tags: string[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
}) {
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  // Auswahl gleitet als Kapsel wie in der unteren Leiste; „Alle“ hat den Schlüssel ''
  const selection = useSlidingSelection(activeTag ?? '');

  const chip = {
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
    marginRight: 0,
  } as const;

  // Die gewählte Option ist durchsichtig, darunter liegt die gleitende Kapsel
  const chipActive = {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  } as const;

  const chipText = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.tagScroll}
      contentContainerStyle={s.tagScrollContent}
    >
      <SlidingPill selection={selection} style={[s.pill, { backgroundColor: colors.text.primary }]} />
      <SpringPressable
        style={[chip, !activeTag && chipActive]}
        onLayout={selection.onLayoutFor('')}
        accessibilityRole="button" accessibilityState={{ selected: !activeTag }}
        onPress={() => onSelectTag(null)}
      >
        <SlidingLabel selection={selection} optionKey="" color={colors.text.secondary} activeColor={colors.bg.primary} style={chipText}>{t('explore.all')}</SlidingLabel>
      </SpringPressable>
      {tags.map((tag) => (
        <SpringPressable
          key={tag}
          onLayout={selection.onLayoutFor(tag)}
          accessibilityRole="button" accessibilityState={{ selected: activeTag === tag }}
          style={[chip, activeTag === tag && chipActive]}
          onPress={() => onSelectTag(activeTag === tag ? null : tag)}
        >
          <SlidingLabel selection={selection} optionKey={tag} color={colors.text.secondary} activeColor={colors.bg.primary} style={chipText}>{tag}</SlidingLabel>
        </SpringPressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pill: { borderRadius: 20 },
  tagScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 4 },
  tagScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
