import { useRef } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Search, X, SlidersHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getExploreStyles } from './exploreStyles';
import type { ExploreSortMode } from '@/lib/useExplore';
import { useTheme } from '@/lib/useTheme';

export function ExploreSearchBar({
  query,
  onQueryChange,
  sortMode,
  onOpenSort,
}: {
  query: string;
  onQueryChange: (t: string) => void;
  sortMode: ExploreSortMode;
  onOpenSort: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const { colors } = useTheme();
  const styles = getExploreStyles(colors);

  return (
    <View style={styles.searchRow}>
      <View style={styles.searchBar}>
        <View style={styles.searchBlur}>
          <Search size={18} color={colors.icon.muted} strokeWidth={2} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Suche nach Nutzern oder Posts…"
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
              hitSlop={8}
            >
              <X size={16} color={colors.icon.muted} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenSort();
        }}
        style={[styles.filterBtn, sortMode !== 'forYou' && styles.filterBtnActive]}
        hitSlop={6}
      >
        <SlidersHorizontal
          size={18}
          color={sortMode !== 'forYou' ? '#FFFFFF' : colors.icon.muted}
          strokeWidth={2}
        />
        {sortMode !== 'forYou' && <View style={styles.filterDot} />}
      </Pressable>
    </View>
  );
}
