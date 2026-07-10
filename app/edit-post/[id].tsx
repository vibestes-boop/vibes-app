import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useUpdatePost } from '@/lib/usePostManagement';
import { useMyProducts } from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useWomenOnly } from '@/lib/useWomenOnly';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { ArrowLeft,Check,ShoppingBag,X } from 'lucide-react-native';
import { useEffect,useState } from 'react';
import {
ActivityIndicator,Alert,KeyboardAvoidingView,Platform,
Pressable,
ScrollView,
StyleSheet,
Switch,
Text,
TextInput,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';

const SUGGESTED_TAGS = [
  'Tech', 'Design', 'AI', 'Art', 'Music',
  'Travel', 'Nature', 'Fitness', 'Photography', 'Gaming',
  'Lifestyle', 'Architecture', 'Food', 'Fashion', 'Meme',
];

type PostData = {
  caption: string | null;
  tags: string[];
  women_only: boolean;
  product_id: string | null;
};

export default function EditPostScreen() {
  useThemedStatusBar('auto');
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [loading, setLoading]   = useState(true);
  const [caption, setCaption]   = useState('');
  const [tags, setTags]         = useState<string[]>([]);
  const [womenOnly, setWomenOnly] = useState(false);
  const [linkedProductId, setLinkedProductId] = useState<string | null>(null);
  const { canAccessWomenOnly } = useWomenOnly();

  // Eigene Produkte für den „Produkt verknüpfen"-Picker (Shoppable Posts #2).
  const { data: myProducts = [] } = useMyProducts();

  const { mutateAsync: updatePost, isPending: saving } = useUpdatePost();

  useEffect(() => {
    if (!id) return;
    supabase
      .from('posts')
      .select('caption, tags, women_only, product_id')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          Alert.alert(t('create.oops'), t('posts.loadFailed'));
          setLoading(false);
          return;
        }
        const p = data as PostData | null;
        setCaption(p?.caption ?? '');
        setTags(p?.tags ?? []);
        setWomenOnly(p?.women_only ?? false);
        setLinkedProductId(p?.product_id ?? null);
        setLoading(false);
      });
  }, [id]);

  const toggleTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updatePost({ postId: id, caption: caption.trim(), tags });
      // women_only + product_id separat speichern (updatePost kennt sie nicht).
      // product_id NULL = Verknüpfung entfernt (FK ist ON DELETE SET NULL).
      await supabase.from('posts').update({ women_only: womenOnly, product_id: linkedProductId }).eq('id', id);
      router.back();
    } catch {
      Alert.alert(t('create.oops'), t('posts.saveFailed'));
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: colors.bg.primary, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.text.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, { backgroundColor: colors.bg.primary, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerBtn}
            hitSlop={12}
          >
            <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Post bearbeiten</Text>
          <Pressable
            onPress={handleSave}
            style={[styles.headerBtn, styles.saveBtn, { backgroundColor: colors.text.primary }]}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={colors.bg.primary} />
              : <Check size={20} color={colors.bg.primary} strokeWidth={2.5} />
            }
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Caption */}
          <Text style={[styles.label, { color: colors.text.secondary }]}>Caption</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.bg.input, borderColor: colors.border.default }]}>
            <TextInput
              style={[styles.captionInput, { color: colors.text.primary }]}
              value={caption}
              onChangeText={setCaption}
              placeholder="Was möchtest du teilen?"
              placeholderTextColor={colors.text.muted}
              multiline
              maxLength={300}
            />
            {caption.length > 0 && (
              <Pressable
                onPress={() => setCaption('')}
                style={styles.clearBtn}
                hitSlop={8}
              >
                <X size={14} color={colors.text.muted} />
              </Pressable>
            )}
          </View>
          <Text style={[styles.charCount, { color: colors.text.muted }]}>{caption.length}/300</Text>

          {/* Tags */}
          <Text style={[styles.label, { marginTop: 24, color: colors.text.secondary }]}>Tags</Text>
          <Text style={[styles.tagHint, { color: colors.text.muted }]}>Bis zu 4 Tags auswählen</Text>
          <View style={styles.tagsWrap}>
            {SUGGESTED_TAGS.map((tag) => {
              const active = tags.includes(tag);
              const disabled = !active && tags.length >= 4;
              return (
                <Pressable
                  key={tag}
                  onPress={() => !disabled && toggleTag(tag)}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: active ? colors.bg.elevated : colors.bg.subtle,
                      borderColor: active ? colors.border.strong : colors.border.default,
                      opacity: disabled ? 0.35 : 1,
                    },
                  ]}
                >
                  <Text style={[
                    styles.tagChipText,
                    { color: active ? colors.text.primary : colors.text.muted },
                  ]}>
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Produkt verknüpfen (Shoppable Posts #2) — nur wenn eigene Produkte da sind.
              Tippen verknüpft/entfernt; die Karte erscheint dann über dem Post. */}
          {myProducts.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 24, color: colors.text.secondary }]}>Produkt verknüpfen</Text>
              <Text style={[styles.tagHint, { color: colors.text.muted }]}>
                {linkedProductId ? 'Tippe das Produkt erneut, um es zu entfernen' : 'Optional — verlinke eins deiner Produkte'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {myProducts.map((p) => {
                  const active = linkedProductId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setLinkedProductId(active ? null : p.id);
                      }}
                      style={[
                        styles.prodChip,
                        {
                          backgroundColor: active ? colors.bg.elevated : colors.bg.subtle,
                          borderColor: active ? colors.text.primary : colors.border.default,
                        },
                      ]}
                    >
                      {p.cover_url ? (
                        <Image source={{ uri: p.cover_url }} style={styles.prodImg} contentFit="cover" cachePolicy="memory-disk" />
                      ) : (
                        <View style={[styles.prodImg, styles.prodImgFallback, { backgroundColor: colors.bg.elevated }]}>
                          <ShoppingBag size={14} color={colors.text.muted} strokeWidth={2} />
                        </View>
                      )}
                      <Text style={[styles.prodText, { color: active ? colors.text.primary : colors.text.secondary }]} numberOfLines={1}>
                        {p.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Women-Only Toggle — nur für verifizierte Frauen */}
          {canAccessWomenOnly && (
            <>
              <Text style={[styles.label, { marginTop: 24, color: colors.text.secondary }]}>Women-Only</Text>
              <View style={[styles.womenOnlyRow, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: womenOnly ? colors.accent.rose : colors.text.primary }}>
                    {womenOnly ? '🌸 Nur für Frauen aktiv' : '🌸 Women-Only'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>
                    {womenOnly ? 'Nur verifizierte Frauen sehen diesen Post' : 'Für alle sichtbar'}
                  </Text>
                </View>
                <Switch
                  value={womenOnly}
                  onValueChange={setWomenOnly}
                  trackColor={{ false: 'rgba(0,0,0,0.1)', true: `${colors.accent.rose}80` }}
                  thumbColor={womenOnly ? colors.accent.rose : '#ccc'}
                />
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    borderRadius: 20,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 8,
  },
  captionInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  clearBtn: {
    paddingTop: 16,
    paddingLeft: 4,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  tagHint: {
    fontSize: 12,
    marginBottom: 12,
    marginTop: -4,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  womenOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  prodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 220,
  },
  prodImg: {
    width: 30,
    height: 30,
    borderRadius: 999,
  },
  prodImgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodText: {
    fontSize: 13.5,
    fontWeight: '600',
    flexShrink: 1,
  },
});
