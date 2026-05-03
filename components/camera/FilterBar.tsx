/**
 * FilterBar — horizontaler Filter-Selektor für die Kamera
 * Zeigt Color-Filter + Sticker als scrollbare Chips
 */

import React, { useState } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { FILTER_CATALOG, type CameraFilter, type FilterCategory } from '@/lib/cameraFilters';

interface FilterBarProps {
  selectedFilter: CameraFilter | null;
  onFilterSelect: (filter: CameraFilter) => void;
}

const CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: 'color',   label: 'Filter' },
  { id: 'sticker', label: 'Sticker' },
  { id: 'frame',   label: 'Rahmen' },
  { id: 'shader',  label: 'Effekte' },
];

export function FilterBar({ selectedFilter, onFilterSelect }: FilterBarProps) {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('color');

  const visibleFilters = FILTER_CATALOG.filter(f => f.category === activeCategory);

  return (
    <View style={styles.container}>
      {/* Kategorie Tabs */}
      <View style={styles.categoryRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setActiveCategory(cat.id)}
            style={[styles.categoryTab, activeCategory === cat.id && styles.categoryTabActive]}
          >
            <Text style={[styles.categoryLabel, activeCategory === cat.id && styles.categoryLabelActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleFilters.map(filter => {
          const isSelected = selectedFilter?.id === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              onPress={() => onFilterSelect(filter)}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              activeOpacity={0.7}
            >
              <Text style={styles.filterEmoji}>{filter.emoji}</Text>
              <Text style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  categoryTabActive: {
    backgroundColor: '#fff',
  },
  categoryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: '#000',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  filterChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    minWidth: 64,
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterChipSelected: {
    backgroundColor: 'rgba(168, 85, 247, 0.3)',
    borderColor: '#a855f7',
  },
  filterEmoji: {
    fontSize: 22,
  },
  filterLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterLabelSelected: {
    color: '#fff',
  },
});
