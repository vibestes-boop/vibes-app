/**
 * GifPicker.tsx
 * Giphy-powered GIF search modal for DMs.
 * Falls back to trending GIFs when search is empty.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { X, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');
const ITEM_W = (W - 4) / 2;

// Giphy API — kostenloses Konto unter https://developers.giphy.com/
// API Key in .env als EXPO_PUBLIC_GIPHY_API_KEY eintragen
const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // public test key
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

type GifResult = {
  id: string;
  title: string;
  url: string;       // full GIF URL
  preview: string;   // smaller preview
  aspectRatio: number;
};

async function fetchGiphy(query: string, offset: number = 0): Promise<{ gifs: GifResult[]; total: number }> {
  const endpoint = query.trim()
    ? `${GIPHY_BASE}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=24&offset=${offset}&rating=pg-13&lang=de`
    : `${GIPHY_BASE}/trending?api_key=${GIPHY_KEY}&limit=24&offset=${offset}&rating=pg-13`;

  const res = await fetch(endpoint);
  if (!res.ok) throw new Error('Giphy API Fehler');
  const json = await res.json();

  const gifs: GifResult[] = (json.data ?? []).map((r: any) => {
    const original  = r.images?.original;
    const preview   = r.images?.fixed_width_small ?? r.images?.fixed_width ?? original;
    const w = Number(original?.width ?? 1);
    const h = Number(original?.height ?? 1);
    return {
      id:          r.id,
      title:       r.title ?? '',
      url:         original?.url ?? '',
      preview:     preview?.url ?? original?.url ?? '',
      aspectRatio: w / Math.max(h, 1),
    };
  }).filter((g: GifResult) => !!g.url);

  return { gifs, total: json.pagination?.total_count ?? 0 };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
};

export default function GifPicker({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery]   = useState('');
  const [gifs, setGifs]     = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, reset: boolean = true) => {
    const currentOffset = reset ? 0 : offset;
    setLoading(true);
    try {
      const { gifs: newGifs } = await fetchGiphy(q, currentOffset);
      setGifs((prev) => reset ? newGifs : [...prev, ...newGifs]);
      setOffset(currentOffset + newGifs.length);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [offset]);

  // Load trending on open
  useEffect(() => {
    if (visible) { setQuery(''); load('', true); }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val, true), 400);
  };

  const handleSelect = (gif: GifResult) => {
    onSelect(gif.url);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>GIF</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color="rgba(255,255,255,0.6)" strokeWidth={2} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Search size={16} color="rgba(255,255,255,0.35)" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={handleQueryChange}
              placeholder="GIF suchen…"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCorrect={false}
              returnKeyType="search"
            />
            {!!query && (
              <Pressable onPress={() => handleQueryChange('')} hitSlop={8}>
                <X size={14} color="rgba(255,255,255,0.35)" strokeWidth={2} />
              </Pressable>
            )}
          </View>

          {/* Grid */}
          {loading && gifs.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color="#22D3EE" />
            </View>
          ) : (
            <FlatList
              data={gifs}
              keyExtractor={(g) => g.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 2 }}
              contentContainerStyle={{ gap: 2, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
              onEndReached={() => { if (!loading) load(query, false); }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={loading ? <ActivityIndicator color="#22D3EE" style={{ marginTop: 12 }} /> : null}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={[styles.gifItem, { height: ITEM_W / item.aspectRatio }]}
                >
                  <Image
                    source={{ uri: item.preview }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    autoplay
                  />
                </Pressable>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 80,
    backgroundColor: '#0F0F14',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifItem: {
    width: ITEM_W,
    backgroundColor: '#1a1a24',
    overflow: 'hidden',
  },
});
