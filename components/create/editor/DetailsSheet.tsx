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
        <View style={[ds.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={ds.handle} />
          <Text style={ds.heading}>Details</Text>

          <TextInput
            style={ds.captionInput}
            placeholder="Was ist dein Vibe? #tags @mention"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={caption}
            onChangeText={onCaption}
            multiline
            maxLength={500}
          />

          <Text style={ds.sectionLabel}>Tags</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ds.tagScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {TAG_OPTIONS.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => onToggleTag(tag)}
                style={[ds.tag, selectedTags.includes(tag) && ds.tagActive]}
              >
                <Text style={[ds.tagText, selectedTags.includes(tag) && ds.tagTextActive]}>{tag}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {products && products.length > 0 && onLinkProduct && (
            <>
              <Text style={ds.sectionLabel}>Produkt verknüpfen</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ds.tagScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                {products.map((p) => {
                  const active = linkedProductId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => onLinkProduct(active ? null : p.id)}
                      style={[ds.prod, active && ds.prodActive]}
                    >
                      {p.cover_url ? (
                        <Image source={{ uri: p.cover_url }} style={ds.prodImg} contentFit="cover" />
                      ) : (
                        <View style={[ds.prodImg, ds.prodImgFallback]}>
                          <ShoppingBag size={14} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                        </View>
                      )}
                      <Text style={[ds.prodText, active && ds.prodTextActive]} numberOfLines={1}>{p.title}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Text style={ds.sectionLabel}>Sichtbarkeit</Text>
          <View style={ds.privacyRow}>
            {privacyOptions.map(({ id, label, icon: Icon }) => (
              <Pressable
                key={id}
                onPress={() => onSettings({ ...settings, privacy: id })}
                style={[ds.privacyBtn, settings.privacy === id && ds.privacyBtnActive]}
              >
                <Icon size={14} color={settings.privacy === id ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth={2} />
                <Text style={[ds.privacyText, settings.privacy === id && ds.privacyTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={ds.toggleRow}>
            {([
              { key: 'allowComments', icon: MessageCircle, label: 'Kommentare' },
              { key: 'allowDownload', icon: Download,       label: 'Download'    },
              { key: 'allowDuet',    icon: Repeat2,        label: 'Duet'        },
            ] as const).map(({ key, icon: Icon, label }) => (
              <Pressable
                key={key}
                onPress={() => onSettings({ ...settings, [key]: !settings[key as keyof PostSettingsState] })}
                style={[ds.toggle, (settings[key as keyof PostSettingsState] as boolean) && ds.toggleActive]}
              >
                <Icon size={13} color={(settings[key as keyof PostSettingsState] as boolean) ? '#fff' : 'rgba(255,255,255,0.35)'} strokeWidth={2} />
                <Text style={[ds.toggleText, (settings[key as keyof PostSettingsState] as boolean) && ds.toggleTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => { onClose(); onPost(); }}
            disabled={uploading}
            style={({ pressed }) => [ds.postBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={ds.postBtnText}>{uploading ? 'Wird hochgeladen…' : 'Jetzt posten'}</Text>
            <ArrowRight size={18} color="#000" strokeWidth={2.5} />
          </Pressable>

          {(onSchedule || onSaveDraft) && (
            <View style={ds.secondaryActions}>
              {onSchedule && (
                <Pressable
                  onPress={onSchedule}
                  disabled={uploading || busySchedule}
                  style={({ pressed }) => [ds.secondaryBtn, pressed && { opacity: 0.85 }, (uploading || busySchedule) && { opacity: 0.5 }]}
                >
                  <ClockIcon size={14} color="#fff" strokeWidth={2} />
                  <Text style={ds.secondaryBtnText}>
                    {busySchedule ? 'Plane…' : 'Planen'}
                  </Text>
                </Pressable>
              )}
              {onSaveDraft && (
                <Pressable
                  onPress={onSaveDraft}
                  disabled={uploading || busyDraft}
                  style={({ pressed }) => [ds.secondaryBtn, pressed && { opacity: 0.85 }, (uploading || busyDraft) && { opacity: 0.5 }]}
                >
                  <FileTextIcon size={14} color="#fff" strokeWidth={2} />
                  <Text style={ds.secondaryBtnText}>
                    {busyDraft ? 'Speichert…' : 'Entwurf'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ds = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0e0e18', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 0 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  heading: { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 16 },
  captionInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, marginHorizontal: 16, padding: 14, color: '#fff', fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 20 },
  sectionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginLeft: 20, marginBottom: 10 },
  tagScroll: { marginBottom: 20 },
  tag: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tagActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' },
  tagText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  tagTextActive: { color: '#fff' },
  prod: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', maxWidth: 200 },
  prodActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.35)' },
  prodImg: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  prodImgFallback: { alignItems: 'center', justifyContent: 'center' },
  prodText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  prodTextActive: { color: '#fff' },
  privacyRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'transparent' },
  privacyBtnActive: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' },
  privacyText: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '600' },
  privacyTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  toggleActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  toggleText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  postBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', marginHorizontal: 16, paddingVertical: 16, borderRadius: 16 },
  postBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  secondaryActions: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 10 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 13, borderRadius: 14,
  },
  secondaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
