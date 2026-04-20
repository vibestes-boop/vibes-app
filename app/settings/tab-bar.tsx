/**
 * app/settings/tab-bar.tsx — Tab Bar anpassen (Facebook-Modell)
 *
 * Echtzeit-Vorschau: Am unteren Bildschirmrand erscheint eine 1:1-Kopie der
 * echten Tab Bar, die sich sofort aktualisiert wenn der User Slot 2 oder 4 auswählt.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, Lock, Pin, Plus, Zap, User } from 'lucide-react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import {
  useTabBarStore,
  TAB_FEATURES,
  ALL_TAB_FEATURES,
  type TabFeature,
} from '@/lib/tabBarStore';
import { useTheme } from '@/lib/useTheme';

// ─── Echter Tab Bar – Vorschau-Komponente (1:1 der echten CustomTabBar) ────────

function TabBarPreview({ slot2, slot4, colors }: {
  slot2: TabFeature;
  slot4: TabFeature;
  colors: any;
}) {
  const insets = useSafeAreaInsets();
  const s2 = TAB_FEATURES[slot2];
  const s4 = TAB_FEATURES[slot4];
  const S2Icon = s2.icon;
  const S4Icon = s4.icon;

  // Slot 2 als "aktiv" highlighten (so der User sieht was er gerade auswählt)
  const [activeSlot, setActiveSlot] = useState<2 | 4 | null>(null);

  return (
    <View style={[
      pb.container,
      {
        borderTopColor: colors.tabBar?.border ?? colors.border.subtle,
        backgroundColor: colors.tabBar?.bg ?? colors.bg.elevated,
        paddingBottom: Math.max(insets.bottom, 8),
      }
    ]}>
      {/* Label */}
      <View style={pb.labelRow}>
        <View style={[pb.dot, { backgroundColor: colors.text.primary }]} />
        <Text style={[pb.label, { color: colors.text.muted }]}>Live-Vorschau</Text>
        <View style={[pb.dot, { backgroundColor: colors.text.primary }]} />
      </View>

      {/* Tab Bar — identisch mit der echten */}
      <View style={pb.inner}>

        {/* Slot 1 — Feed (fest) */}
        <View style={pb.tabItem}>
          <View style={pb.iconWrap}>
            <Zap size={22} color={colors.tabBar?.active ?? colors.text.primary}
              strokeWidth={0} fill={colors.tabBar?.active ?? colors.text.primary} />
          </View>
          <View style={[pb.activeDot, { backgroundColor: colors.tabBar?.active ?? colors.text.primary }]} />
          <Text style={[pb.tabLabel, { color: colors.tabBar?.active ?? colors.text.primary }]}>Feed</Text>
        </View>

        {/* Slot 2 — wählbar */}
        <Pressable
          style={[pb.tabItem, activeSlot === 2 && pb.tabItemHighlight]}
          onPress={() => setActiveSlot(a => a === 2 ? null : 2)}
          accessibilityLabel={`Slot 2: ${s2.label}`}
        >
          <View style={pb.iconWrap}>
            <S2Icon size={22}
              color={colors.tabBar?.inactive ?? colors.text.muted}
              strokeWidth={1.8}
              fill="transparent"
            />
          </View>
          <Text style={[pb.tabLabel, { color: colors.tabBar?.inactive ?? colors.text.muted }]}>
            {s2.label}
          </Text>
          {/* "Anpassbar" Indikator */}
          <View style={[pb.customBadge, { backgroundColor: colors.accent.primary }]}>
            <Pin size={8} color="#fff" strokeWidth={2.5} />
          </View>
        </Pressable>

        {/* Slot 3 — + Create (fest) */}
        <View style={pb.createTab}>
          <View style={pb.createOuter}>
            <View style={[pb.createShadow, { borderColor: colors.text.primary }]} />
            <View style={[pb.createBtn, { backgroundColor: colors.text.primary }]}>
              <Plus size={18} color={colors.bg.primary} strokeWidth={3} />
            </View>
          </View>
        </View>

        {/* Slot 4 — wählbar */}
        <Pressable
          style={[pb.tabItem, activeSlot === 4 && pb.tabItemHighlight]}
          onPress={() => setActiveSlot(a => a === 4 ? null : 4)}
          accessibilityLabel={`Slot 4: ${s4.label}`}
        >
          <View style={pb.iconWrap}>
            <S4Icon size={22}
              color={colors.tabBar?.inactive ?? colors.text.muted}
              strokeWidth={1.8}
              fill="transparent"
            />
          </View>
          <Text style={[pb.tabLabel, { color: colors.tabBar?.inactive ?? colors.text.muted }]}>
            {s4.label}
          </Text>
          <View style={[pb.customBadge, { backgroundColor: colors.accent.primary }]}>
            <Pin size={8} color="#fff" strokeWidth={2.5} />
          </View>
        </Pressable>

        {/* Slot 5 — Profil (fest) */}
        <View style={pb.tabItem}>
          <View style={pb.iconWrap}>
            <User size={22}
              color={colors.tabBar?.inactive ?? colors.text.muted}
              strokeWidth={1.8}
              fill="transparent"
            />
          </View>
          <Text style={[pb.tabLabel, { color: colors.tabBar?.inactive ?? colors.text.muted }]}>Profil</Text>
        </View>

      </View>
    </View>
  );
}

// ─── Haupt-Screen ─────────────────────────────────────────────────────────────

export default function TabBarCustomizeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const slot2 = useTabBarStore((s) => s.slot2);
  const slot4 = useTabBarStore((s) => s.slot4);
  const setSlot2 = useTabBarStore((s) => s.setSlot2);
  const setSlot4 = useTabBarStore((s) => s.setSlot4);

  // Wie viel Platz braucht die Vorschau unten? Ca. 80 + safe area
  const previewHeight = 80 + Math.max(insets.bottom, 8);

  const handleSelect = (slot: 2 | 4, feature: TabFeature) => {
    impactAsync(ImpactFeedbackStyle.Light);
    // Kein Konflikt: wenn Feature schon im anderen Slot → tauschen
    if (slot === 2 && feature === slot4) {
      setSlot4(slot2);
      setSlot2(feature);
    } else if (slot === 4 && feature === slot2) {
      setSlot2(slot4);
      setSlot4(feature);
    } else {
      if (slot === 2) setSlot2(feature);
      else            setSlot4(feature);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={16}
          accessibilityRole="button" accessibilityLabel="Zurück">
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Tab Bar anpassen</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Scrollbarer Inhalt — am unteren Rand Platz für Vorschau lassen */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: previewHeight + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.desc, { color: colors.text.muted }]}>
          Wähle was du in Slot 2 und Slot 4 sehen möchtest.
          Die Vorschau unten aktualisiert sich sofort.
        </Text>

        {/* ── Slot 2 wählen ── */}
        <Text style={[styles.sectionLabel, { color: colors.text.primary }]}>
          Slot 2 — links vom +
        </Text>
        <FeatureList
          features={ALL_TAB_FEATURES}
          selected={slot2}
          onSelect={(f) => handleSelect(2, f)}
          colors={colors}
        />

        {/* ── Slot 4 wählen ── */}
        <Text style={[styles.sectionLabel, { color: colors.text.primary }]}>
          Slot 4 — rechts vom +
        </Text>
        <FeatureList
          features={ALL_TAB_FEATURES}
          selected={slot4}
          onSelect={(f) => handleSelect(4, f)}
          colors={colors}
        />
      </ScrollView>

      {/* ── Echtzeit-Tab-Bar-Vorschau (fixiert am unteren Rand) ── */}
      <TabBarPreview slot2={slot2} slot4={slot4} colors={colors} />
    </View>
  );
}

// ─── Feature-Liste ────────────────────────────────────────────────────────────

function FeatureList({
  features, selected, onSelect, colors,
}: {
  features: TabFeature[];
  selected: TabFeature;
  onSelect: (f: TabFeature) => void;
  colors: any;
}) {
  return (
    <View style={[styles.featureList, { borderColor: colors.border.subtle }]}>
      {features.map((f, i) => {
        const meta = TAB_FEATURES[f];
        const Icon = meta.icon;
        const isSelected = f === selected;
        const isLast = i === features.length - 1;
        return (
          <Pressable
            key={f}
            onPress={() => onSelect(f)}
            style={[
              styles.featureRow,
              !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle },
              isSelected && { backgroundColor: `${colors.accent.primary}10` },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={meta.label}
          >
            <View style={[styles.featureIconWrap, isSelected && { backgroundColor: `${colors.accent.primary}20` }]}>
              <Icon size={20} color={isSelected ? colors.accent.primary : colors.text.secondary} strokeWidth={1.8} />
            </View>
            <Text style={[styles.featureLabel, { color: isSelected ? colors.accent.primary : colors.text.primary }]}>
              {meta.label}
            </Text>
            {isSelected && (
              <Check size={18} color={colors.accent.primary} strokeWidth={2.5} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 24 },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 10, marginTop: 8,
  },

  featureList: {
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  featureIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(120,120,128,0.1)',
  },
  featureLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
});

// ── Preview-Bar-Styles ────────────────────────────────────────────────────────

const pb = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  labelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingTop: 6, paddingBottom: 2,
  },
  dot: { width: 4, height: 4, borderRadius: 2, opacity: 0.3 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.5 },

  inner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 6,
    paddingHorizontal: 4,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
    position: 'relative',
  },
  tabItemHighlight: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 9, fontWeight: '600', letterSpacing: 0.2, marginTop: 2,
  },
  activeDot: {
    width: 4, height: 4, borderRadius: 2,
    marginTop: 2,
  },
  customBadge: {
    position: 'absolute', top: 0, right: 8,
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },

  createTab: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  createOuter: {
    width: 50, height: 32, position: 'relative',
  },
  createShadow: {
    position: 'absolute', top: 3, left: 3, right: -3, bottom: -3,
    borderRadius: 10, borderWidth: 2, backgroundColor: 'transparent',
  },
  createBtn: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
});
