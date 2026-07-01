/**
 * components/live/CreatorToolsSheet.tsx
 *
 * v1.30 — Gruppiertes, „lebendiges" Creator-Tools-Sheet.
 *
 * Ein „+"-Button in der Host-Toolbar öffnet dieses Sheet. Die Werkzeuge sind
 * in benannte Sektionen gruppiert (Engagement / Verkaufen / Stream & Chat /
 * Co-Host …) und als 2-spaltige Quer-Kacheln dargestellt:
 *   [farbiger Icon-Chip]  Titel
 *                         Status-Zeile (Aus · 2 aktiv · 5s …)
 *
 * Gegenüber dem alten 3-spaltigen Grau-Raster:
 *   • Jede Kachel trägt ihre Akzentfarbe dauerhaft (Chip-Tint) → kein
 *     toter grauer Block mehr.
 *   • Status-Zeile zeigt auf einen Blick, was gerade läuft.
 *   • Aktive Tools: accent-getönte Fläche + accent-Rahmen + accent-Status.
 *   • Sektionen schaffen Hierarchie und sind beliebig erweiterbar.
 *
 * Konfiguration via `tools`-Array → jede Kachel definiert Icon, Label,
 * Gruppe, Status, aktiver-Farbton, optionales Badge, Tap- und Long-Press.
 * Tap schließt das Sheet automatisch (außer bei `keepOpen: true`).
 */

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { X as XIcon } from 'lucide-react-native';
import React from 'react';
import {
Dimensions,
Modal,
Pressable,
ScrollView,
StyleSheet,
Text,
View,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GRID_PAD = 16;     // Sheet-Innenrand
const GAP      = 8;       // Abstand zwischen Kacheln
const TILE_W   = (SCREEN_W - GRID_PAD * 2 - GAP) / 2;   // 2 Spalten

const DEFAULT_ACCENT = '#fbbf24';
const FALLBACK_GROUP  = 'Mehr';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreatorToolItem {
  /** Eindeutiger Schlüssel (für .map key). */
  key:           string;
  /** Angezeigter Label-Text. */
  label:         string;
  /** Icon-Element (z.B. <Smile size={26} stroke="#fff" />). */
  icon:          React.ReactNode;
  /** Sektion zur Gruppierung (z.B. 'Engagement'). Fehlt → 'Mehr'. */
  group?:        string;
  /** Status-Zeile unter dem Label (z.B. 'Aus', '2 aktiv', '5s'). */
  status?:       string;
  /** Hauptaktion. Standard: Sheet wird danach geschlossen. */
  onPress:       () => void;
  /** Optionale Zweit-Aktion (Long-Press). Schließt das Sheet ebenfalls. */
  onLongPress?:  () => void;
  /** Ist das Tool gerade aktiv? (Färbt die Kachel). */
  active?:       boolean;
  /** Eigene Akzentfarbe für Tint/Aktiv-Highlight (z.B. '#fbbf24'). */
  accentColor?:  string;
  /** Kleines Badge oben-rechts am Chip (z.B. Queue-Anzahl). */
  badge?:        string | number;
  /** Schaltet das Tool aus (z.B. während Loading). */
  disabled?:     boolean;
  /** Wenn true, bleibt das Sheet offen nach Tap. */
  keepOpen?:     boolean;
  /** Zerstörerische Aktion (rote Akzentfarbe). */
  destructive?:  boolean;
}

interface Props {
  visible:    boolean;
  onClose:    () => void;
  tools:      CreatorToolItem[];
  /** Optionaler Header-Untertitel (z.B. '@review läuft · 12 Zuschauer'). */
  subtitle?:  string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CreatorToolsSheet({ visible, onClose, tools, subtitle }: Props) {
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

  // Tools nach Gruppe bündeln — Reihenfolge der Erst-Erscheinung bleibt erhalten.
  const groups: { name: string; items: CreatorToolItem[] }[] = [];
  for (const tool of tools) {
    const name = tool.group ?? FALLBACK_GROUP;
    let bucket = groups.find((g) => g.name === name);
    if (!bucket) { bucket = { name, items: [] }; groups.push(bucket); }
    bucket.items.push(tool);
  }

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
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Creator Tools</Text>
                {subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                ) : null}
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <XIcon size={18} color="#fff" strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>

          {/* Sektionen */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {groups.map((group) => (
              <View key={group.name} style={styles.section}>
                <Text style={styles.sectionLabel}>{group.name}</Text>
                <View style={styles.sectionGrid}>
                  {group.items.map((tool) => {
                    const accent = tool.destructive
                      ? '#ef4444'
                      : tool.accentColor ?? DEFAULT_ACCENT;
                    const isActive = !!tool.active;
                    return (
                      <Pressable
                        key={tool.key}
                        onPress={() => handlePress(tool)}
                        onLongPress={tool.onLongPress ? () => handleLongPress(tool) : undefined}
                        delayLongPress={400}
                        disabled={tool.disabled}
                        style={({ pressed }) => [
                          styles.tile,
                          {
                            width:           TILE_W,
                            backgroundColor: isActive ? hexWithAlpha(accent, 0.12) : 'rgba(255,255,255,0.05)',
                            borderColor:     isActive ? hexWithAlpha(accent, 0.5)  : 'rgba(255,255,255,0.08)',
                            opacity:         tool.disabled ? 0.4 : pressed ? 0.8 : 1,
                            transform:       [{ scale: pressed ? 0.97 : 1 }],
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.chip,
                            { backgroundColor: hexWithAlpha(accent, isActive ? 0.26 : 0.18) },
                          ]}
                        >
                          {tool.icon}
                          {tool.badge !== undefined && tool.badge !== null && (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>{String(tool.badge)}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.tileText}>
                          <Text style={styles.tileTitle} numberOfLines={1}>{tool.label}</Text>
                          {tool.status ? (
                            <Text
                              style={[styles.tileStatus, isActive && { color: accent }]}
                              numberOfLines={1}
                            >
                              {tool.status}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
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
    maxHeight:        SCREEN_H * 0.74,
    minHeight:        SCREEN_H * 0.34,
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
    fontSize:     17,
    fontWeight:   '600',
    letterSpacing: 0.3,
  },
  subtitle: {
    color:      'rgba(255,255,255,0.45)',
    fontSize:   12,
    fontWeight: '600',
    marginTop:  2,
  },
  closeBtn: {
    width:         30,
    height:        30,
    borderRadius:  15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems:    'center',
    justifyContent:'center',
  },
  scrollContent: {
    paddingHorizontal: GRID_PAD,
    paddingTop:        14,
    paddingBottom:     24,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    color:         'rgba(255,255,255,0.4)',
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 0.3,
    marginBottom:  9,
    marginLeft:    2,
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           GAP,
  },
  tile: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    paddingVertical:   11,
    paddingHorizontal: 12,
    borderRadius:  14,
    borderWidth:   1,
  },
  chip: {
    width:          38,
    height:         38,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
  },
  tileText: {
    flex:      1,
    minWidth:  0,
  },
  tileTitle: {
    color:      '#fff',
    fontSize:   13.5,
    fontWeight: '700',
  },
  tileStatus: {
    color:      'rgba(255,255,255,0.42)',
    fontSize:   11.5,
    fontWeight: '500',
    marginTop:  1,
  },
  badge: {
    position:       'absolute',
    top:            -5,
    right:          -5,
    minWidth:       18,
    height:         18,
    paddingHorizontal: 4,
    borderRadius:   9,
    backgroundColor:'#ef4444',
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    2,
    borderColor:    'rgba(10,10,12,0.95)',
  },
  badgeText: {
    color:          '#fff',
    fontSize:       10,
    fontWeight:     '600',
    letterSpacing:  0.2,
  },
});
