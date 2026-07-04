import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { SW, SH, GlassSheet, useEditorSheet } from './sharedStyles';

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

  const t = useEditorSheet();
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={t.overlay} /></TouchableWithoutFeedback>
      <GlassSheet style={s.sheet}>
        <View style={t.handle} />
        <Text style={t.title}>Sticker</Text>
        <View style={s.searchRow}>
          <TextInput
            style={[s.searchInput, { backgroundColor: t.fill, color: t.text, borderColor: t.border }]}
            placeholder="Sticker suchen…"
            placeholderTextColor={t.textMuted}
            value={query}
            onChangeText={onSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        {loading ? (
          <View style={s.loadWrap}><Text style={[s.loadText, { color: t.textMuted }]}>Lädt…</Text></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.stickerGrid}>
            <View style={s.stickerGridInner}>
              {items.map(item => {
                const img = item.images.fixed_width_small;
                return (
                  <Pressable key={item.id} onPress={() => { onAdd(img.url); onClose(); }} style={[s.stickerBtn, { backgroundColor: t.fill }]}>
                    <Image source={{ uri: img.url }} style={s.stickerImg} contentFit="contain" cachePolicy="memory-disk" />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </GlassSheet>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet:           { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 40, maxHeight: SH * 0.65 },
  searchRow:       { paddingHorizontal: 16, marginBottom: 12 },
  searchInput:     { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1 },
  loadWrap:        { height: 120, alignItems: 'center', justifyContent: 'center' },
  loadText:        { fontSize: 14 },
  stickerGrid:     { paddingHorizontal: 16, paddingBottom: 16 },
  stickerGridInner:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stickerBtn:      { width: (SW - 32 - 24) / 4, height: (SW - 32 - 24) / 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stickerImg:      { width: '85%', height: '85%' },
});
