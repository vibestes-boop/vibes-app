/**
 * MusicPickerSheet.tsx — Premium Music Picker
 * Features: Search · Favoriten · Trending-Tab · Progress-Timer · BPM · Genre-Colors
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  Modal,
  Animated,
  PanResponder,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Music2, Check, Volume2, Search, Heart, Flame } from 'lucide-react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import type { MusicTrack } from '@/lib/useMusicPicker';
import { MUSIC_LIBRARY, GENRES, useAudioPlayer, useFavorites } from '@/lib/useMusicPicker';

const { height: SH } = Dimensions.get('window');


// Neutrale Album-Art Farben — kein Genre-Farbsystem
const NEUTRAL_GRAD: [string, string] = ['#1e1e2e', '#2a2a3a'];

// ─── Equalizer Bars ───────────────────────────────────────────────────────────
function EqualizerBars({ color, active }: { color: string; active: boolean }) {
  const bars = [useRef(new Animated.Value(4)).current, useRef(new Animated.Value(10)).current, useRef(new Animated.Value(7)).current];
  useEffect(() => {
    if (!active) {
      bars.forEach((b) => Animated.timing(b, { toValue: 4, duration: 200, useNativeDriver: false }).start());
      return;
    }
    const durations = [320, 250, 400];
    const anims = bars.map((b, i) => Animated.loop(Animated.sequence([
      Animated.timing(b, { toValue: 18, duration: durations[i], useNativeDriver: false }),
      Animated.timing(b, { toValue: 4,  duration: durations[i], useNativeDriver: false }),
    ])));
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 20, gap: 2 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: 3, borderRadius: 2, backgroundColor: color, height: b, opacity: active ? 1 : 0.25 }} />
      ))}
    </View>
  );
}

// ─── Album Art (neutral dunkel) ──────────────────────────────────────────────
function AlbumArt({ playing }: { playing: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!playing) { Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }).start(); return; }
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.05, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <LinearGradient colors={NEUTRAL_GRAD} style={art.box} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {playing
          ? <EqualizerBars color="rgba(255,255,255,0.8)" active />
          : <Music2 size={17} color="rgba(255,255,255,0.35)" strokeWidth={2} />
        }
      </LinearGradient>
    </Animated.View>
  );
}
const art = StyleSheet.create({ box: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function PreviewProgress({ progressSec, totalSec }: { progressSec: number; totalSec: number }) {
  const pct = Math.min(1, progressSec / Math.min(30, totalSec));
  return (
    <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 1, marginTop: 4, overflow: 'hidden' }}>
      <View style={{ height: 2, width: `${pct * 100}%`, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
    </View>
  );
}

// ─── Track Row (neutral) ──────────────────────────────────────────────────────
function TrackRow({
  track, isSelected, isPlaying, isFav, progressSec, onTap, onFavToggle,
}: {
  track: MusicTrack; isSelected: boolean; isPlaying: boolean;
  isFav: boolean; progressSec: number; onTap: () => void; onFavToggle: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 130, useNativeDriver: true }),
    ]).start();
    impactAsync(ImpactFeedbackStyle.Light);
    onTap();
  };

  const handleFav = () => {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 160, useNativeDriver: true }),
    ]).start();
    impactAsync(ImpactFeedbackStyle.Medium);
    onFavToggle();
  };

  const dur = `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={handlePress}>
        <View style={[row.wrap, isSelected && row.wrapSelected]}>
          {/* Links: aktiver Balken */}
          <View style={[row.accent, (isSelected || isPlaying) && row.accentActive]} />

          {/* Album Art */}
          <AlbumArt playing={isPlaying} />

          {/* Info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {track.trending && (
                <View style={row.trendBadge}>
                  <Flame size={9} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
                </View>
              )}
              <Text style={[row.title, (isSelected || isPlaying) && row.titleActive]} numberOfLines={1}>
                {track.title}
              </Text>
            </View>
            <Text style={row.meta} numberOfLines={1}>
              {track.genre}  ·  {track.bpm} BPM  ·  {track.mood}
            </Text>
            {isPlaying && <PreviewProgress progressSec={progressSec} totalSec={track.duration} />}
          </View>

          {/* Rechts: Equalizer oder Dauer */}
          <View style={row.right}>
            {isPlaying
              ? <EqualizerBars color="rgba(255,255,255,0.7)" active />
              : <Text style={[row.dur, isSelected && row.durActive]}>{dur}</Text>
            }
          </View>

          {/* Favorit-Herz */}
          <Pressable onPress={handleFav} hitSlop={10}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Heart
                size={15}
                color={isFav ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.18)'}
                fill={isFav ? 'rgba(255,255,255,0.8)' : 'none'}
                strokeWidth={2}
              />
            </Animated.View>
          </Pressable>

          {/* Check-Badge */}
          {isSelected && (
            <View style={row.check}>
              <Check size={10} color="#000" strokeWidth={3.5} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const row = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingRight: 14, marginHorizontal: 8, borderRadius: 16, marginBottom: 3, gap: 10, paddingLeft: 0 },
  wrapSelected: { backgroundColor: 'rgba(255,255,255,0.06)' },
  accent: { width: 3, height: 50, borderRadius: 2, marginLeft: 8, backgroundColor: 'transparent' },
  accentActive: { backgroundColor: 'rgba(255,255,255,0.4)' },
  title: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  titleActive: { color: '#fff', fontWeight: '700' },
  meta: { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 2 },
  right: { alignItems: 'center', justifyContent: 'center', minWidth: 34 },
  dur: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },
  durActive: { color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.85)' },
  trendBadge: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: 2 },
});

// ─── Volume Slider ─────────────────────────────────────────────────────────────
function VolumeSlider({ volume, onChange, color }: { volume: number; onChange: (v: number) => void; color: string }) {
  const widthRef  = useRef(0);
  const startValRef = useRef(volume); // Wert beim ersten Touch

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: (evt) => {
      if (!widthRef.current) return;
      // Anfangswert aus Touch-Position berechnen
      const initial = Math.max(0, Math.min(1, evt.nativeEvent.locationX / widthRef.current));
      startValRef.current = initial;
      onChange(initial);
    },

    onPanResponderMove: (_, gestureState) => {
      if (!widthRef.current) return;
      // Delta vom Start-Punkt addieren → kein Springen mehr
      const next = Math.max(0, Math.min(1, startValRef.current + gestureState.dx / widthRef.current));
      onChange(next);
    },
  })).current;

  return (
    <View style={vol.row}>
      <Volume2 size={15} color="rgba(255,255,255,0.35)" strokeWidth={2} />
      <View
        style={vol.trackWrap}
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        <View style={vol.track}>
          <LinearGradient colors={[color, `${color}88`]} style={[vol.fill, { width: `${volume * 100}%` as any }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          <View style={[vol.thumb, { left: `${volume * 100}%` as any, borderColor: color }]} />
        </View>
      </View>
      <Text style={[vol.pct, { color }]}>{Math.round(volume * 100)}%</Text>
    </View>
  );
}
const vol = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  trackWrap: { flex: 1, paddingVertical: 10 },
  track: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'visible' },
  fill: { height: 4, borderRadius: 2 },
  thumb: { position: 'absolute', top: -7, width: 18, height: 18, borderRadius: 9, backgroundColor: '#0A0A12', borderWidth: 2.5, transform: [{ translateX: -9 }] },
  pct: { fontSize: 12, fontWeight: '700', minWidth: 36, textAlign: 'right' },
});

// ─── Tab-System ──────────────────────────────────────────────────────────────
type TabId = 'trending' | 'alle' | 'favoriten' | string;

// ─── Main Sheet ───────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  selectedTrack: MusicTrack | null;
  audioVolume: number;  // 0..1, persistiert
  onSelect: (track: MusicTrack | null, volume: number) => void;
  onClose: () => void;
}

export function MusicPickerSheet({ visible, selectedTrack, audioVolume, onSelect, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [volume, setVolumeState] = useState(audioVolume);
  const { playingId, progressSec, toggle, stop, setVolume } = useAudioPlayer();
  const { isFav, toggle: toggleFav } = useFavorites();
  const insets = useSafeAreaInsets();
  const searchRef = useRef<TextInput>(null);

  // Nur 3 Tabs: Trending | Alle | Favoriten
  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'trending',  label: '🔥 Trending' },
    { id: 'alle',      label: 'Alle' },
    { id: 'favoriten', label: '♥ Favoriten' },
  ];

  const filteredTracks = useMemo(() => {
    let base = MUSIC_LIBRARY;
    if (activeTab === 'trending') base = MUSIC_LIBRARY.filter((t) => t.trending);
    else if (activeTab === 'favoriten') base = MUSIC_LIBRARY.filter((t) => isFav(t.id));
    else if (activeTab !== 'alle') base = MUSIC_LIBRARY.filter((t) => t.genre === activeTab);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q) ||
        t.mood.toLowerCase().includes(q)
      );
    }
    return base;
  }, [activeTab, searchQuery, isFav]);

  const handleClose = async () => { await stop(); onClose(); };

  const handleTap = async (track: MusicTrack) => {
    onSelect(track, volume);
    await toggle(track);
  };

  // Volume-Änderung: sofort auf laufende Preview anwenden
  const handleVolumeChange = (v: number) => {
    setVolumeState(v);
    setVolume(v);  // ändert laufende Audio-Instanz live
  };

  // Neutral — kein lila Markenton
  const accent = 'rgba(255,255,255,0.7)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={[s.sheet, { paddingBottom: insets.bottom + 4 }]}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.hIcon}>
              <Music2 size={18} color="rgba(255,255,255,0.8)" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.hTitle}>Sound auswählen</Text>
              <Text style={s.hSub} numberOfLines={1}>
                {selectedTrack ? `♪ ${selectedTrack.title}  ·  ${selectedTrack.bpm} BPM` : 'Tippe zum Abspielen & Auswählen'}
              </Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={14} style={s.closeBtn}>
              <X size={16} color="rgba(255,255,255,0.45)" strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={s.searchRow}>
            <Search size={14} color="rgba(255,255,255,0.3)" strokeWidth={2} />
            <TextInput
              ref={searchRef}
              style={s.searchInput}
              placeholder="Tracks suchen..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
                <X size={13} color="rgba(255,255,255,0.3)" strokeWidth={2.5} />
              </Pressable>
            )}
          </View>

          {/* Tabs */}
          {searchQuery.length === 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.tabs}>
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <Pressable key={tab.id} onPress={() => { impactAsync(ImpactFeedbackStyle.Light); setActiveTab(tab.id); }}
                    style={[s.tab, active && s.tabActive]}>
                    <Text style={[s.tabTxt, active && s.tabTxtActive]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Kein Sound */}
          <Pressable
            style={[s.noSound, !selectedTrack && s.noSoundActive]}
            onPress={() => { stop(); onSelect(null, volume); impactAsync(ImpactFeedbackStyle.Light); }}
          >
            <Text style={{ fontSize: 20 }}>🔇</Text>
            <Text style={[s.noSoundTxt, !selectedTrack && { color: '#fff' }]}>Kein Sound</Text>
            {!selectedTrack && <Check size={14} color="rgba(255,255,255,0.7)" strokeWidth={3} />}
          </Pressable>

          {/* Leere Favoriten-Hinweis */}
          {activeTab === 'favoriten' && filteredTracks.length === 0 && (
            <View style={s.emptyFav}>
              <Text style={{ fontSize: 34 }}>♡</Text>
              <Text style={s.emptyFavTxt}>Noch keine Favoriten</Text>
              <Text style={s.emptyFavSub}>Tippe das Herz-Symbol um Tracks zu speichern</Text>
            </View>
          )}

          {/* Track List */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {filteredTracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                isSelected={selectedTrack?.id === track.id}
                isPlaying={playingId === track.id}
                isFav={isFav(track.id)}
                progressSec={playingId === track.id ? progressSec : 0}
                onTap={() => handleTap(track)}
                onFavToggle={() => { toggleFav(track.id); impactAsync(ImpactFeedbackStyle.Light); }}
              />
            ))}
          </ScrollView>

          {/* Volume — live verknüpft mit Vorschau + gespeichert beim Auswählen */}
          <VolumeSlider volume={volume} onChange={handleVolumeChange} color="rgba(255,255,255,0.55)" />

          {/* Confirm — speichert Track + gewählte Lautstärke */}
          {selectedTrack && (
            <Pressable onPress={() => { onSelect(selectedTrack, volume); handleClose(); }} style={s.confirm}>
              <View style={s.confirmInner}>
                <Music2 size={16} color="#fff" strokeWidth={2.5} />
                <Text style={s.confirmTxt}>„{selectedTrack.title}" verwenden  ·  {Math.round(volume * 100)}%</Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Sheet Styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    backgroundColor: '#0A0A12',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    height: SH * 0.82, flexDirection: 'column',
  },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  hIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  hTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.4 },
  hSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },

  // Tabs
  tabs: { flexDirection: 'row', gap: 7, paddingHorizontal: 12, paddingBottom: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.22)' },
  tabTxt: { color: 'rgba(255,255,255,0.38)', fontSize: 12, fontWeight: '600' },
  tabTxtActive: { color: '#fff', fontWeight: '800' },

  // No Sound
  noSound: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginBottom: 5 },
  noSoundActive: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  noSoundTxt: { flex: 1, color: 'rgba(255,255,255,0.28)', fontSize: 13, fontWeight: '600' },

  // Empty Favorites
  emptyFav: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyFavTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyFavSub: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },

  // Confirm
  confirm: { marginHorizontal: 14, marginTop: 4, borderRadius: 18, overflow: 'hidden' },
  confirmInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  confirmTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
});
