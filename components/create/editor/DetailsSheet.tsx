import {
  ArrowRight,
  Clock as ClockIcon,
  Download,
  FileText as FileTextIcon,
  Globe,
  Lock,
  MessageCircle,
  Repeat2,
  ShoppingBag,
  Users,
} from 'lucide-react-native';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type LinkableProduct = { id: string; title: string; cover_url: string | null };

import type { PostSettingsState } from '@/components/create';
import { GlassSheet, useEditorSheet } from './sharedStyles';

const TAG_OPTIONS = ['#vibes','#music','#chill','#art','#life','#travel','#food','#fitness','#coding','#fashion'];

export function DetailsSheet({
  visible, onClose, caption, onCaption, selectedTags, onToggleTag,
  settings, onSettings, onPost, uploading,
  onSchedule, onSaveDraft, busyDraft, busySchedule,
  products, linkedProductId, onLinkProduct,
}: {
  visible: boolean; onClose: () => void;
  caption: string; onCaption: (s: string) => void;
  selectedTags: string[]; onToggleTag: (t: string) => void;
  settings: PostSettingsState; onSettings: (s: PostSettingsState) => void;
  onPost: () => void; uploading: boolean;
  onSchedule?: () => void;
  onSaveDraft?: () => void;
  busyDraft?: boolean;
  busySchedule?: boolean;
  // Shoppable Posts (#2): eigene Shop-Produkte zum Verknüpfen.
  products?: LinkableProduct[];
  linkedProductId?: string | null;
  onLinkProduct?: (id: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useEditorSheet();
  const privacyOptions = [
    { id: 'public',  label: 'Öffentlich',  icon: Globe },
    { id: 'friends', label: 'Freunde',      icon: Users },
    { id: 'private', label: 'Privat',       icon: Lock  },
  ] as const;

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={ds.overlay} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ds.sheetWrap}>
        <GlassSheet style={[ds.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={[ds.handle, { backgroundColor: t.border }]} />
          <Text style={[ds.heading, { color: t.text }]}>Details</Text>

          <TextInput
            style={[ds.captionInput, { backgroundColor: t.fill, color: t.text }]}
            placeholder="Was ist dein Vibe? #tags @mention"
            placeholderTextColor={t.textMuted}
            value={caption}
            onChangeText={onCaption}
            multiline
            maxLength={500}
          />

          <Text style={[ds.sectionLabel, { color: t.textMuted }]}>Tags</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ds.tagScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {TAG_OPTIONS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => onToggleTag(tag)}
                  style={[ds.tag, { backgroundColor: active ? t.fillActive : t.fill, borderColor: active ? t.accent : t.border }]}
                >
                  <Text style={[ds.tagText, { color: active ? t.text : t.textSecondary }]}>{tag}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {products && products.length > 0 && onLinkProduct && (
            <>
              <Text style={[ds.sectionLabel, { color: t.textMuted }]}>Produkt verknüpfen</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ds.tagScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                {products.map((p) => {
                  const active = linkedProductId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => onLinkProduct(active ? null : p.id)}
                      style={[ds.prod, { backgroundColor: active ? t.fillActive : t.fill, borderColor: active ? t.accent : t.border }]}
                    >
                      {p.cover_url ? (
                        <Image source={{ uri: p.cover_url }} style={ds.prodImg} contentFit="cover" />
                      ) : (
                        <View style={[ds.prodImg, ds.prodImgFallback, { backgroundColor: t.fill }]}>
                          <ShoppingBag size={14} color={t.textSecondary} strokeWidth={2} />
                        </View>
                      )}
                      <Text style={[ds.prodText, { color: active ? t.text : t.textSecondary }]} numberOfLines={1}>{p.title}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Text style={[ds.sectionLabel, { color: t.textMuted }]}>Sichtbarkeit</Text>
          <View style={ds.privacyRow}>
            {privacyOptions.map(({ id, label, icon: Icon }) => {
              const active = settings.privacy === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => onSettings({ ...settings, privacy: id })}
                  style={[ds.privacyBtn, { backgroundColor: active ? t.fillActive : t.fill, borderColor: active ? t.accent : 'transparent' }]}
                >
                  <Icon size={14} color={active ? t.text : t.textSecondary} strokeWidth={2} />
                  <Text style={[ds.privacyText, { color: active ? t.text : t.textSecondary }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={ds.toggleRow}>
            {([
              { key: 'allowComments', icon: MessageCircle, label: 'Kommentare' },
              { key: 'allowDownload', icon: Download,       label: 'Download'    },
              { key: 'allowDuet',    icon: Repeat2,        label: 'Duet'        },
            ] as const).map(({ key, icon: Icon, label }) => {
              const active = settings[key as keyof PostSettingsState] as boolean;
              return (
                <Pressable
                  key={key}
                  onPress={() => onSettings({ ...settings, [key]: !settings[key as keyof PostSettingsState] })}
                  style={[ds.toggle, { backgroundColor: active ? t.fillActive : t.fill }]}
                >
                  <Icon size={13} color={active ? t.text : t.textSecondary} strokeWidth={2} />
                  <Text style={[ds.toggleText, { color: active ? t.text : t.textSecondary }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => { onClose(); onPost(); }}
            disabled={uploading}
            style={({ pressed }) => [ds.postBtn, { backgroundColor: t.accent }, pressed && { opacity: 0.85 }]}
          >
            <Text style={ds.postBtnText}>{uploading ? 'Wird hochgeladen…' : 'Jetzt posten'}</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>

          {(onSchedule || onSaveDraft) && (
            <View style={ds.secondaryActions}>
              {onSchedule && (
                <Pressable
                  onPress={onSchedule}
                  disabled={uploading || busySchedule}
                  style={({ pressed }) => [ds.secondaryBtn, { backgroundColor: t.fill, borderColor: t.border }, pressed && { opacity: 0.85 }, (uploading || busySchedule) && { opacity: 0.5 }]}
                >
                  <ClockIcon size={14} color={t.text} strokeWidth={2} />
                  <Text style={[ds.secondaryBtnText, { color: t.text }]}>
                    {busySchedule ? 'Plane…' : 'Planen'}
                  </Text>
                </Pressable>
              )}
              {onSaveDraft && (
                <Pressable
                  onPress={onSaveDraft}
                  disabled={uploading || busyDraft}
                  style={({ pressed }) => [ds.secondaryBtn, { backgroundColor: t.fill, borderColor: t.border }, pressed && { opacity: 0.85 }, (uploading || busyDraft) && { opacity: 0.5 }]}
                >
                  <FileTextIcon size={14} color={t.text} strokeWidth={2} />
                  <Text style={[ds.secondaryBtnText, { color: t.text }]}>
                    {busyDraft ? 'Speichert…' : 'Entwurf'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </GlassSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ds = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 0 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  heading: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 16 },
  captionInput: { borderRadius: 14, marginHorizontal: 16, padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginLeft: 20, marginBottom: 10 },
  tagScroll: { marginBottom: 20 },
  tag: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 13, fontWeight: '600' },
  prod: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 12, borderWidth: 1, maxWidth: 200 },
  prodImg: { width: 30, height: 30, borderRadius: 8 },
  prodImgFallback: { alignItems: 'center', justifyContent: 'center' },
  prodText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  privacyRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  privacyText: { fontSize: 12, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10 },
  toggleText: { fontSize: 11, fontWeight: '600' },
  postBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 16, borderRadius: 16 },
  postBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondaryActions: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 10 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, paddingVertical: 13, borderRadius: 14,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700' },
});
