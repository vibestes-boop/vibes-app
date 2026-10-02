import { GlassSurface } from '@/components/ui/GlassSurface';
import type { ExploreSortMode } from '@/lib/useExplore';
import { useTheme } from '@/lib/useTheme';
import * as Haptics from 'expo-haptics';
import { Search,SlidersHorizontal,X } from 'lucide-react-native';
import { useRef } from 'react';
import { Pressable,TextInput,View,useWindowDimensions } from 'react-native';
import { getExploreStyles } from './exploreStyles';
import { useI18n } from '@/lib/i18n';

export function ExploreSearchBar({
  query,
  onQueryChange,
  sortMode,
  onOpenSort,
  compact = false,
}: {
  query: string;
  onQueryChange: (t: string) => void;
  sortMode: ExploreSortMode;
  onOpenSort: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<TextInput>(null);
  const { fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = getExploreStyles(colors);

  return (
    <View style={[styles.searchRow, compact && { flex: 1, marginHorizontal: 0, marginVertical: 0, gap: 8 }]}>
      <GlassSurface radius={25} style={[styles.searchBar, { backgroundColor: 'transparent', borderWidth: 0, overflow: 'visible' }]}>
        <View style={[styles.searchBlur, compact && { paddingVertical: 0, gap: 8, minHeight: 46 }]}>
          <Search size={18} color={colors.icon.muted} strokeWidth={2} />
          {/* Keep the native input font in sync when Dynamic Type changes. */}
          <TextInput
            ref={inputRef}
            allowFontScaling={false}
            style={[styles.searchInput, { fontSize: (compact ? 14 : 15) * fontScale, minHeight: Math.max(46, Math.ceil(20 * fontScale + 12)) }]}
            value={query}
            onChangeText={onQueryChange}
            accessibilityLabel={t('explore.searchPlaceholder')}
            placeholder={t(compact ? 'explore.searchShort' : 'explore.searchPlaceholder')}
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                onQueryChange('');
                inputRef.current?.blur();
              }}
              hitSlop={12}
              accessibilityRole="button" accessibilityLabel={t('explore.clearSearch')}
            >
              <X size={16} color={colors.icon.muted} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </GlassSurface>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenSort();
        }}
        style={[styles.filterBtn, { backgroundColor: 'transparent', borderWidth: 0 }]}
        hitSlop={6}
        accessibilityRole="button" accessibilityLabel={t('nativeUi.sort')}
      >
        <GlassSurface radius={23} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
        <SlidersHorizontal
          size={18}
          color={sortMode !== 'forYou' ? colors.accent.primary : colors.icon.muted}
          strokeWidth={2}
        />
        {sortMode !== 'forYou' && <View style={styles.filterDot} />}
      </Pressable>
    </View>
  );
}
