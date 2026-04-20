/**
 * components/live/CreatorToolsSheet.tsx
 *
 * v1.22.0 — TikTok-Style "Creator Tools" Grid-Sheet.
 *
 * Ein einzelner "+"-Button in der Host-Toolbar öffnet dieses Sheet; darin
 * sind alle Creator-Werkzeuge als Grid-Kacheln angeordnet (Poll, Sticker,
 * Produkt, Goal, Shop, Record, Moderation-Feinschliff, Co-Host-Kontrollen
 * während Duet, usw.).
 *
 * Vorteile:
 *   • Nicht-störend — Stream bleibt frei während Host nicht aktiv werkzelt
 *   • Skalierbar — weitere Tools (z.B. Q&A, Musik) passen einfach rein
 *   • TikTok-Parität — User sind das Pattern gewöhnt
 *
 * Konfiguration via `tools`-Array → jede Kachel definiert Icon, Label,
 * aktiver-Farbton, optionales Badge, Tap- und Long-Press-Handler.
 * Tap schließt das Sheet automatisch (außer bei explizit `keepOpen: true`).
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
import { BlurView } from 'expo-blur';
import { X as XIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const COLUMNS    = 3;
const GRID_PAD   = 18;      // Sheet-Innenrand
const GAP        = 12;      // Abstand zwischen Kacheln
const CELL_SIZE  = (SCREEN_W - (GRID_PAD * 2) - (GAP * (COLUMNS - 1))) / COLUMNS;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreatorToolItem {
  /** Eindeutiger Schlüssel (für .map key). */
  key:           string;
  /** Angezeigter Label-Text unter der Icon-Box. */
  label:         string;
  /** Icon-Element (z.B. <Smile size={26} stroke="#fff" />). */
  icon:          React.ReactNode;
  /** Hauptaktion. Standard: Sheet wird danach geschlossen. */
  onPress:       () => void;
  /** Optionale Zweit-Aktion (Long-Press). Schließt das Sheet ebenfalls. */
  onLongPress?:  () => void;
  /** Ist das Tool gerade aktiv? (Färbt das Icon-Feld). */
  active?:       boolean;
  /** Eigene Akzentfarbe für Aktiv-Highlight (z.B. '#fbbf24'). */
  accentColor?:  string;
  /** Kleines Badge oben-rechts (z.B. Queue-Anzahl). */
  badge?:        string | number;
  /** Schaltet das Tool aus (z.B. während Loading). */
  disabled?:     boolean;
  /** Wenn true, bleibt das Sheet offen nach Tap. */
  keepOpen?:     boolean;
  /** Zerstörerische Aktion (rote Akzentfarbe). */
  destructive?:  boolean;
}

interface Props {
  visible:  boolean;
  onClose:  () => void;
  tools:    CreatorToolItem[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CreatorToolsSheet({ visible, onClose, tools }: Props) {
  const handlePress = (tool: CreatorToolItem) => {
    if (tool.disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tool.onPress();
    if (!tool.keepOpen) onClose();
  };

  const handleLongPress = (tool: CreatorToolItem) => {
    if (tool.disabled || !tool.onLongPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    tool.onLongPress();
    if (!tool.keepOpen) onClose();
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
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Creator Tools</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <XIcon size={18} color="#fff" strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>

          {/* Grid */}
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {tools.map((tool) => {
              const accent = tool.destructive
                ? '#ef4444'
                : tool.accentColor ?? '#fbbf24';
              const isActive = !!tool.active;
              return (
                <Pressable
                  key={tool.key}
                  onPress={() => handlePress(tool)}
                  onLongPress={tool.onLongPress ? () => handleLongPress(tool) : undefined}
                  delayLongPress={400}
                  disabled={tool.disabled}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      opacity: tool.disabled ? 0.4 : pressed ? 0.75 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconBox,
                      isActive && {
                        backgroundColor: hexWithAlpha(accent, 0.28),
                        borderColor:     hexWithAlpha(accent, 0.55),
                      },
                    ]}
                  >
                    {tool.icon}
                    {tool.badge !== undefined && tool.badge !== null && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{String(tool.badge)}</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.label,
                      isActive && { color: accent, fontWeight: '800' },
                    ]}
                    numberOfLines={1}
                  >
                    {tool.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Wandelt '#fbbf24' + 0.28 → 'rgba(251,191,36,0.28)'.
 * Einfacher als `color-string`, weil wir keine neue Dep wollen.
 */
function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight:        SCREEN_H * 0.68,
    minHeight:        SCREEN_H * 0.36,
    borderTopLeftRadius:  22,
    borderTopRightRadius: 22,
    overflow:         'hidden',
    backgroundColor:  'rgba(10,10,12,0.85)',
    borderTopWidth:   1,
    borderColor:      'rgba(255,255,255,0.08)',
  },
  header: {
    paddingTop:    8,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  grabber: {
    alignSelf:       'center',
    width:           38,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom:    10,
  },
  headerRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
  },
  title: {
    color:        '#fff',
    fontSize:     16,
    fontWeight:   '800',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width:         30,
    height:        30,
    borderRadius:  15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems:    'center',
    justifyContent:'center',
  },
  grid: {
    padding:       GRID_PAD,
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           GAP,
  },
  cell: {
    width:          CELL_SIZE,
    alignItems:     'center',
    gap:            6,
  },
  iconBox: {
    width:          CELL_SIZE - 18,
    height:         CELL_SIZE - 18,
    borderRadius:   18,
    backgroundColor:'rgba(255,255,255,0.06)',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.08)',
    alignItems:     'center',
    justifyContent: 'center',
  },
  badge: {
    position:       'absolute',
    top:            -4,
    right:          -4,
    minWidth:       20,
    height:         20,
    paddingHorizontal: 5,
    borderRadius:   10,
    backgroundColor:'#ef4444',
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    2,
    borderColor:    'rgba(10,10,12,0.95)',
  },
  badgeText: {
    color:          '#fff',
    fontSize:       10,
    fontWeight:     '800',
    letterSpacing:  0.2,
  },
  label: {
    color:          'rgba(255,255,255,0.82)',
    fontSize:       11,
    fontWeight:     '700',
    textAlign:      'center',
  },
});
