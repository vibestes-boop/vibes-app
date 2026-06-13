import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { SW, SH, shared } from './sharedStyles';

const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '';
const GIPHY_SEARCH = (q: string) =>
  `https://api.giphy.com/v1/stickers/${q ? 'search' : 'trending'}?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`;

type GiphyItem = { id: string; images: { fixed_width_small: { url: string; width: string; height: string } } };
export type StickerOverlay = { id: string; url: string; x: number; y: number };

export function StickerSheet({ visible, onAdd, onClose }: {
  visible: boolean;
  onAdd: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    loadStickers('');
  }, [visible]);

  const loadStickers = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(GIPHY_SEARCH(q));
      const json = await res.json();
      setItems(json.data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const onSearch = (text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => loadStickers(text), 400);
  };

  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={shared.overlay} /></TouchableWithoutFeedback>
      <View style={s.sheet}>
        <View style={shared.handle} />
        <Text style={shared.title}>Sticker</Text>
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            placeholder="Sticker suchen…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={onSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        {loading ? (
          <View style={s.loadWrap}><Text style={s.loadText}>Lädt…</Text></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.stickerGrid}>
            <View style={s.stickerGridInner}>
              {items.map(item => {
                const img = item.images.fixed_width_small;
                return (
                  <Pressable key={item.id} onPress={() => { onAdd(img.url); onClose(); }} style={s.stickerBtn}>
                    <Image source={{ uri: img.url }} style={s.stickerImg} contentFit="contain" cachePolicy="memory-disk" />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet:           { backgroundColor: '#0c0c16', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 40, maxHeight: SH * 0.65 },
  searchRow:       { paddingHorizontal: 16, marginBottom: 12 },
  searchInput:     { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  loadWrap:        { height: 120, alignItems: 'center', justifyContent: 'center' },
  loadText:        { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  stickerGrid:     { paddingHorizontal: 16, paddingBottom: 16 },
  stickerGridInner:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stickerBtn:      { width: (SW - 32 - 24) / 4, height: (SW - 32 - 24) / 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stickerImg:      { width: '85%', height: '85%' },
});
