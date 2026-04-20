/**
 * components/live/StickerPicker.tsx
 *
 * v1.22.0 — Emoji-Sticker-Auswahl für Host im Live-Stream.
 *
 * Host öffnet dieses Modal → tippt auf Emoji → Sticker wird am
 * Stream platziert (Default-Position, dann frei verschiebbar).
 *
 * Kategorien: Emotion, Reaktion, Symbole, Spaß (siehe STICKER_CATALOG).
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { X as XIcon } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { STICKER_CATALOG } from '@/lib/useLiveStickers';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COLS = 6;
const CELL_SIZE = Math.floor((SCREEN_W - 48 - (GRID_COLS - 1) * 8) / GRID_COLS);

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick:  (emoji: string) => void;
}

export function StickerPicker({ visible, onClose, onPick }: Props) {
  const handlePick = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPick(emoji);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Sticker platzieren</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <XIcon size={18} color="#fff" strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {STICKER_CATALOG.map((cat) => (
              <View key={cat.category} style={styles.section}>
                <Text style={styles.sectionTitle}>{cat.category}</Text>
                <View style={styles.grid}>
                  {cat.emojis.map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => handlePick(emoji)}
                      style={({ pressed }) => [
                        styles.cell,
                        { opacity: pressed ? 0.55 : 1 },
                      ]}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '72%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,10,12,0.85)',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width:  CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: Math.floor(CELL_SIZE * 0.55),
  },
});
