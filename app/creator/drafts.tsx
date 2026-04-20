/**
 * app/creator/drafts.tsx — Creator Studio: Cloud-Entwürfe
 *
 * v1.20.0 — Creator-Studio Pro.
 *
 * Listet alle cloud-synchronisierten Post-Entwürfe.
 *   • Thumbnail + Caption + Tag-Previews
 *   • "Bearbeiten" → routet in den Editor mit ?draftId=…
 *   • "Löschen" mit Confirm-Alert
 *   • Realtime-Sync: wenn ein anderes Gerät einen Draft anlegt, erscheint er hier.
 *
 * Design: App-native Monochrom-Stil (konsistent mit dashboard.tsx).
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, FileText, Trash2, Edit2,
  Play, Sparkles, ChevronRight, Cloud,
} from 'lucide-react-native';
import { useTheme } from '@/lib/useTheme';
import { usePostDraftsCloud, type CloudDraft } from '@/lib/usePostDraftsCloud';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DraftsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const {
    drafts, isLoading, refetch,
    deleteDraft, isDeleting,
  } = usePostDraftsCloud();

  const handleDelete = (d: CloudDraft) => {
    Alert.alert(
      'Entwurf löschen?',
      d.caption ? `„${d.caption.slice(0, 60)}${d.caption.length > 60 ? '…' : ''}"` : 'Dieser Entwurf wird gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text:  'Löschen',
          style: 'destructive',
          onPress: async () => {
            try { await deleteDraft(d.id); }
            catch (e: any) {
              Alert.alert('Fehler', e?.message ?? 'Konnte nicht gelöscht werden.');
            }
          },
        },
      ],
    );
  };

  const handleEdit = (d: CloudDraft) => {
    router.push({ pathname: '/create', params: { draftId: d.id } } as any);
  };

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
        </Pressable>

        <View style={s.headerCenter}>
          <View style={[s.headerBadge, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
            <FileText size={12} color={colors.text.primary} strokeWidth={2} />
            <Text style={[s.headerBadgeText, { color: colors.text.primary }]}>Entwürfe</Text>
          </View>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* Cloud-Hinweis */}
      {drafts.length > 0 && (
        <View style={[s.cloudHint, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <Cloud size={12} color={colors.text.muted} strokeWidth={2} />
          <Text style={[s.cloudHintText, { color: colors.text.muted }]}>
            Cloud-synchronisiert — auf allen Geräten verfügbar
          </Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: 60 }} />
      ) : drafts.length === 0 ? (
        <EmptyState colors={colors} onCreate={() => router.push('/create' as any)} />
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.accent.primary} />}
          renderItem={({ item }) => (
            <DraftRow
              draft={item}
              colors={colors}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
              isDeleting={isDeleting}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function DraftRow({
  draft, colors, onEdit, onDelete, isDeleting,
}: {
  draft: CloudDraft; colors: any;
  onEdit: () => void; onDelete: () => void;
  isDeleting: boolean;
}) {
  const updatedRel = relativeTime(draft.updatedAt);

  return (
    <Pressable
      onPress={onEdit}
      style={[s.row, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
    >
      {/* Thumbnail */}
      <View style={[s.thumb, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
        {(draft.thumbnailUrl || draft.mediaUrl)
          ? <Image source={{ uri: draft.thumbnailUrl ?? draft.mediaUrl! }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <FileText size={16} color={colors.text.muted} strokeWidth={1.5} />
        }
        {draft.mediaType === 'video' && (
          <View style={s.videoTag}>
            <Play size={8} color="#fff" strokeWidth={2.5} />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[s.caption, { color: colors.text.primary }]} numberOfLines={2}>
          {draft.caption?.trim() || '(kein Text)'}
        </Text>

        {/* Tags */}
        {draft.tags.length > 0 && (
          <View style={s.tagRow}>
            {draft.tags.slice(0, 3).map((t) => (
              <View key={t} style={[s.tagPill, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
                <Text style={[s.tagPillText, { color: colors.text.secondary }]}>#{t}</Text>
              </View>
            ))}
            {draft.tags.length > 3 && (
              <Text style={[s.tagPillText, { color: colors.text.muted }]}>+{draft.tags.length - 3}</Text>
            )}
          </View>
        )}

        <Text style={[s.metaLine, { color: colors.text.muted }]}>
          {draft.mediaType ? draft.mediaType === 'video' ? 'Video · ' : 'Bild · ' : ''}
          Zuletzt bearbeitet {updatedRel}
        </Text>

        {/* Actions */}
        <View style={s.actionsRow}>
          <Pressable
            onPress={onEdit}
            style={[s.actionBtn, { backgroundColor: colors.text.primary }]}
            accessibilityRole="button"
          >
            <Edit2 size={11} color={colors.bg.primary} strokeWidth={2.5} />
            <Text style={[s.actionText, { color: colors.bg.primary }]}>Weiter</Text>
          </Pressable>

          <Pressable
            onPress={onDelete}
            disabled={isDeleting}
            style={[s.actionBtn, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle, borderWidth: 1, opacity: isDeleting ? 0.5 : 1 }]}
            accessibilityRole="button"
          >
            <Trash2 size={11} color="#EF4444" strokeWidth={2} />
            <Text style={[s.actionText, { color: '#EF4444' }]}>Löschen</Text>
          </Pressable>
        </View>
      </View>

      <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} style={{ alignSelf: 'center' }} />
    </Pressable>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ colors, onCreate }: { colors: any; onCreate: () => void }) {
  return (
    <View style={s.emptyWrap}>
      <View style={[s.emptyIcon, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        <FileText size={28} color={colors.text.muted} strokeWidth={1.5} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.text.primary }]}>Keine Entwürfe</Text>
      <Text style={[s.emptySub, { color: colors.text.muted }]}>
        Speichere Posts als Entwurf, um später weiterzumachen. Entwürfe werden auf all deinen Geräten synchronisiert.
      </Text>
      <Pressable
        onPress={onCreate}
        style={[s.emptyCta, { backgroundColor: colors.text.primary }]}
        accessibilityRole="button"
      >
        <Sparkles size={14} color={colors.bg.primary} strokeWidth={2.5} />
        <Text style={[s.emptyCtaText, { color: colors.bg.primary }]}>Post erstellen</Text>
      </Pressable>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now  = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'gerade eben';
  if (mins < 60)  return `vor ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `vor ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `vor ${days} Tg`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700' },

  cloudHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  cloudHintText: { fontSize: 11, fontWeight: '600' },

  // Row
  row: {
    flexDirection: 'row', gap: 12, padding: 12,
    borderRadius: 14, borderWidth: 1,
  },
  thumb: {
    width: 72, height: 96, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  videoTag: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },

  caption: { fontSize: 14, fontWeight: '600', lineHeight: 19 },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tagPill: {
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  tagPillText: { fontSize: 10, fontWeight: '600' },

  metaLine: { fontSize: 10, fontWeight: '500' },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  actionText: { fontSize: 11, fontWeight: '700' },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12,
    marginTop: 8,
  },
  emptyCtaText: { fontSize: 13, fontWeight: '800' },
});
