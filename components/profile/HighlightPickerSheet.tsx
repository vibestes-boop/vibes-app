/**
 * HighlightPickerSheet.tsx — Multi-Select
 *
 * • Mehrere Stories gleichzeitig auswählen (wie Instagram)
 * • Auswahlzähler im Header
 * • Reihenfolge-Anzeige in der Kreis-Auswahl
 * • Cover = erste ausgewählte Story
 * • Swipe-to-Close mit Handle-Bar-PanResponder
 */
import {
  Modal, View, Text, Pressable, ScrollView, Animated, PanResponder,
  StyleSheet, Dimensions, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState, useCallback, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HighlightItem } from '@/lib/useStoryHighlights';

const { width: W, height: SCREEN_H } = Dimensions.get('window');
const COLS = 3;
const GAP  = 2;
const CELL = (W - GAP * (COLS + 1)) / COLS;

const CLOSE_THRESHOLD_Y  = 100;
const CLOSE_THRESHOLD_VY = 0.5;

export type StoryItem = {
  id: string;
  media_url: string;
  media_type: string;
  thumbnail_url?: string | null;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

export function HighlightPickerSheet({
  visible, stories, posts = [], onClose, onConfirm,
}: {
  visible: boolean;
  stories: StoryItem[];
  posts?: StoryItem[];
  onClose: () => void;
  /** items: alle ausgewählten Medien (mind. 1), title: vergebener Name */
  onConfirm: (items: HighlightItem[], title: string) => void;
}) {
  const insets = useSafeAreaInsets();
  // Multi-Select: Array statt single item
  const [selected, setSelected] = useState<StoryItem[]>([]);
  const [step, setStep] = useState<'pick' | 'name'>('pick');
  const [title, setTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'stories' | 'posts'>('stories');

  const currentItems = activeTab === 'stories' ? stories : posts;

  const sheetY = useRef(new Animated.Value(SCREEN_H)).current;

  const reset = () => {
    setSelected([]);
    setStep('pick');
    setTitle('');
    setActiveTab('stories');
  };

  // Entrance-Animation
  useEffect(() => {
    if (visible) {
      sheetY.setValue(SCREEN_H);
      Animated.spring(sheetY, {
        toValue: 0, useNativeDriver: true, damping: 26, stiffness: 210,
      }).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(sheetY, {
      toValue: SCREEN_H, duration: 230, useNativeDriver: true,
    }).start(() => {
      reset();
      onClose();
    });
  }, [onClose, sheetY]); // eslint-disable-line react-hooks/exhaustive-deps

  // PanResponder nur auf Handle-Bar
  const handleBarPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => false,
      onPanResponderGrant: () => { (sheetY as any).stopAnimation(); },
      onPanResponderMove: (_, g) => { if (g.dy > 0) sheetY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_THRESHOLD_Y || g.vy > CLOSE_THRESHOLD_VY) {
          dismissSheet();
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 250 }).start();
        }
      },
    })
  ).current;

  // Story antippen → zur Auswahl hinzufügen / entfernen
  const handleSelect = (item: StoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(prev => {
      const idx = prev.findIndex(s => s.id === item.id);
      if (idx >= 0) {
        // Auswahl aufheben
        return prev.filter(s => s.id !== item.id);
      }
      // Hinzufügen
      return [...prev, item];
    });
  };

  const handleWeiter = () => {
    if (selected.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('name');
  };

  const handleSave = () => {
    if (selected.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const finalTitle = title.trim() || 'Highlight';
    // Items in der Reihenfolge der Auswahl
    const items: HighlightItem[] = selected.map(s => ({
      media_url:     s.media_url,
      media_type:    (s.media_type === 'video' ? 'video' : 'image') as 'image' | 'video',
      thumbnail_url: s.thumbnail_url ?? null,
    }));
    reset();
    onClose();
    onConfirm(items, finalTitle);
  };

  const selCount = selected.length;
  const coverItem = selected[0]; // Erste Auswahl = Cover

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismissSheet}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={dismissSheet} />

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
            { transform: [{ translateY: sheetY }] },
          ]}
        >
          {/* Handle-Bar: Drag-Zone */}
          <View {...handleBarPan.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={dismissSheet} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Abbrechen</Text>
            </Pressable>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.headerTitle}>
                {step === 'pick' ? 'Highlight erstellen' : 'Highlight benennen'}
              </Text>
              {step === 'pick' && selCount > 0 && (
                <Text style={styles.headerSub}>
                  {selCount} {selCount === 1 ? 'ausgewählt' : 'ausgewählt'}
                </Text>
              )}
            </View>

            {step === 'pick' ? (
              <Pressable
                onPress={handleWeiter}
                style={[styles.headerBtn, selCount === 0 && styles.headerBtnDisabled]}
                disabled={selCount === 0}
              >
                <Text style={[styles.headerBtnTextAccent, selCount === 0 && styles.headerBtnTextDisabled]}>
                  Weiter
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleSave} style={styles.headerBtn}>
                <Text style={styles.headerBtnTextAccent}>Fertig</Text>
              </Pressable>
            )}
          </View>

          <ScrollView
            scrollEnabled={step === 'pick'}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Tab-Switcher: Stories / Posts */}
            {step === 'pick' && (
              <View style={styles.tabRow}>
                <Pressable
                  style={[styles.tab, activeTab === 'stories' && styles.tabActive]}
                  onPress={() => { setSelected([]); setActiveTab('stories'); }}
                >
                  <Text style={[styles.tabText, activeTab === 'stories' && styles.tabTextActive]}>
                    Stories ({stories.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
                  onPress={() => { setSelected([]); setActiveTab('posts'); }}
                >
                  <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
                    Posts ({posts.length})
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Story-Auswahl Grid — Multi-Select */}
            {step === 'pick' && (
              <View style={styles.grid}>
                {currentItems.length === 0 ? (
                  <Text style={styles.emptyTabText}>
                    {activeTab === 'stories' ? 'Keine Stories vorhanden.' : 'Keine Posts mit Medien.'}
                  </Text>
                ) : (
                  Array.from({ length: Math.ceil(currentItems.length / COLS) }, (_, rowIdx) => (
                    <View key={rowIdx} style={styles.row}>
                      {currentItems.slice(rowIdx * COLS, rowIdx * COLS + COLS).map((item) => {
                        const selIdx = selected.findIndex(s => s.id === item.id);
                        const isSelected = selIdx >= 0;
                        const orderNum = selIdx + 1;

                        return (
                          <Pressable key={item.id} onPress={() => handleSelect(item)} style={styles.cell}>
                            <LinearGradient colors={['#0e2233', '#1a1a2e']} style={StyleSheet.absoluteFill} />
                            <Image
                              source={{ uri: item.thumbnail_url || item.media_url }}
                              style={StyleSheet.absoluteFill}
                              contentFit="cover"
                            />
                            <View style={styles.dateBadge}>
                              <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                            </View>
                            <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
                              {isSelected ? <Text style={styles.selectNum}>{orderNum}</Text> : null}
                            </View>
                            {isSelected && <View style={styles.selectedOverlay} />}
                            {isSelected && selIdx === 0 && selCount > 1 && (
                              <View style={styles.coverBadge}>
                                <Text style={styles.coverBadgeText}>Cover</Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Naming-Step */}
            {step === 'name' && (
              <View style={styles.nameStep}>
                {/* Cover-Vorschau (erstes ausgewähltes Item) */}
                {coverItem && (
                  <View style={styles.previewWrap}>
                    <Image
                      source={{ uri: coverItem.thumbnail_url || coverItem.media_url }}
                      style={styles.previewThumb}
                      contentFit="cover"
                    />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFill} />
                    {selCount > 1 && (
                      <View style={styles.itemCountBadge}>
                        <Text style={styles.itemCountText}>{selCount} Medien</Text>
                      </View>
                    )}
                  </View>
                )}

                <Text style={styles.nameLabel}>Name des Highlights</Text>
                <TextInput
                  style={styles.nameInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="z.B. Sommer 2025, Reisen …"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  maxLength={32}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  blurOnSubmit={false}
                  selectionColor="#FFFFFF"
                />
                <Text style={styles.charCount}>{title.length}/32</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%', minHeight: 400,
  },
  handleArea: { paddingVertical: 14, alignItems: 'center' },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn:             { minWidth: 72 },
  headerBtnDisabled:     { opacity: 0.35 },
  headerBtnText:         { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  headerBtnTextAccent:   { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'right' },
  headerBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
  headerTitle:           { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  headerSub:             { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Grid
  grid: { gap: GAP, paddingHorizontal: GAP, paddingTop: GAP },
  row:  { flexDirection: 'row', gap: GAP },
  cell: { width: CELL, height: CELL * 1.5, backgroundColor: '#1a1a2e', overflow: 'hidden' },

  dateBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  dateText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Runden Auswahlkreis mit Nummer
  selectCircle: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  selectCircleActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  selectNum: { color: '#000', fontSize: 12, fontWeight: '900' },

  selectedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Cover-Badge (nur wenn mehrere ausgewählt)
  coverBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(29,185,84,0.85)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  coverBadgeText: { color: '#000', fontSize: 10, fontWeight: '800' },

  // Name-Step
  nameStep: { padding: 24, gap: 16 },
  previewWrap: {
    width: 120, height: 180, borderRadius: 12,
    overflow: 'hidden', alignSelf: 'center',
  },
  previewThumb:     { width: '100%', height: '100%' },
  itemCountBadge: {
    position: 'absolute', bottom: 8, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  itemCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  nameLabel:  { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 17, fontWeight: '500',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)',
  },
  charCount: { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'right' },

  // Tab-Switcher
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
  },
  tabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  emptyTabText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
});
