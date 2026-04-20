/**
 * app/creator/scheduled.tsx — Creator Studio: Geplante Posts
 *
 * v1.20.0 — Creator-Studio Pro.
 *
 * Liste aller pending/publishing/failed scheduled posts mit:
 *   • Thumbnail + Caption-Vorschau
 *   • Publish-At Label ("in 2h 13min" / "Morgen 14:30" / "Mo 09:00")
 *   • Status-Badge (gelb=pending, rot=failed)
 *   • Reschedule via DateTimePicker Modal
 *   • Cancel mit Confirm-Alert
 *   • Failed-Post: "Neu versuchen" → reschedule auf +1min
 *
 * Design: App-native Monochrom-Stil (konsistent mit dashboard.tsx).
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Clock, AlertTriangle, Edit2,
  X as XIcon, Play, RotateCw, Sparkles,
  ChevronUp, ChevronDown,
} from 'lucide-react-native';
import { useTheme } from '@/lib/useTheme';
import {
  useScheduledPosts, scheduledPostLabel,
  type ScheduledPost,
} from '@/lib/useScheduledPosts';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScheduledPostsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const {
    list, pending, failed, isLoading, refetch,
    reschedulePost, isRescheduling,
    cancelScheduledPost, isCancelling,
  } = useScheduledPosts();

  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledPost | null>(null);

  const handleCancel = (post: ScheduledPost) => {
    Alert.alert(
      'Plan abbrechen?',
      post.caption
        ? `„${post.caption.slice(0, 60)}${post.caption.length > 60 ? '…' : ''}" wird nicht veröffentlicht.`
        : 'Dieser geplante Post wird nicht veröffentlicht.',
      [
        { text: 'Behalten', style: 'cancel' },
        {
          text:  'Abbrechen',
          style: 'destructive',
          onPress: async () => {
            try { await cancelScheduledPost(post.id); }
            catch (e: any) {
              Alert.alert('Fehler', e?.message ?? 'Konnte nicht abgebrochen werden.');
            }
          },
        },
      ],
    );
  };

  const handleRescheduleSave = async (newTime: Date) => {
    if (!rescheduleTarget) return;
    if (newTime.getTime() < Date.now() + 60_000) {
      Alert.alert('Ungültig', 'Zeitpunkt muss mindestens 1 Minute in der Zukunft liegen.');
      return;
    }
    try {
      await reschedulePost(rescheduleTarget.id, newTime);
      setRescheduleTarget(null);
    } catch (e: any) {
      Alert.alert('Fehler', e?.message ?? 'Konnte nicht umgeplant werden.');
    }
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
            <Clock size={12} color={colors.text.primary} strokeWidth={2} />
            <Text style={[s.headerBadgeText, { color: colors.text.primary }]}>Geplante Posts</Text>
          </View>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: 60 }} />
      ) : list.length === 0 ? (
        <EmptyState colors={colors} onCreate={() => router.push('/create' as any)} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.accent.primary} />}
          ListHeaderComponent={
            <View style={{ marginBottom: 6 }}>
              <Text style={[s.summary, { color: colors.text.muted }]}>
                {pending.length} geplant{failed.length > 0 && ` · ${failed.length} fehlgeschlagen`}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ScheduledRow
              post={item}
              colors={colors}
              onReschedule={() => setRescheduleTarget(item)}
              onCancel={() => handleCancel(item)}
              isCancelling={isCancelling}
            />
          )}
        />
      )}

      {/* Reschedule Modal */}
      <RescheduleModal
        visible={!!rescheduleTarget}
        initialTime={rescheduleTarget ? new Date(rescheduleTarget.publishAt) : new Date(Date.now() + 3600_000)}
        onClose={() => setRescheduleTarget(null)}
        onSave={handleRescheduleSave}
        colors={colors}
        isSaving={isRescheduling}
      />
    </View>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ScheduledRow({
  post, colors, onReschedule, onCancel, isCancelling,
}: {
  post: ScheduledPost; colors: any;
  onReschedule: () => void; onCancel: () => void;
  isCancelling: boolean;
}) {
  const statusBadge = (() => {
    switch (post.status) {
      case 'pending':     return { label: 'Geplant',      bg: 'rgba(251,191,36,0.14)', fg: '#F59E0B' };
      case 'publishing':  return { label: 'Wird gepostet…', bg: 'rgba(34,197,94,0.14)',  fg: '#22C55E' };
      case 'failed':      return { label: 'Fehler',       bg: 'rgba(239,68,68,0.16)',  fg: '#EF4444' };
      default:            return { label: post.status,    bg: 'rgba(120,120,120,0.14)', fg: colors.text.muted };
    }
  })();

  return (
    <View style={[s.row, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      {/* Thumbnail */}
      <View style={[s.thumb, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
        {(post.thumbnailUrl || post.mediaUrl)
          ? <Image source={{ uri: post.thumbnailUrl ?? post.mediaUrl! }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <Play size={14} color={colors.text.muted} strokeWidth={2} />
        }
        {post.mediaType === 'video' && (
          <View style={s.videoTag}>
            <Text style={s.videoTagText}>VIDEO</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 6 }}>
        <View style={s.rowTopLine}>
          <View style={[s.statusBadge, { backgroundColor: statusBadge.bg }]}>
            <Text style={[s.statusBadgeText, { color: statusBadge.fg }]}>{statusBadge.label}</Text>
          </View>
          <Text style={[s.timeLabel, { color: colors.text.primary }]}>
            {scheduledPostLabel(post.publishAt)}
          </Text>
        </View>

        <Text style={[s.caption, { color: colors.text.secondary }]} numberOfLines={2}>
          {post.caption?.trim() || '(kein Text)'}
        </Text>

        {post.status === 'failed' && post.lastError && (
          <View style={[s.errorBox, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }]}>
            <AlertTriangle size={11} color="#EF4444" strokeWidth={2} />
            <Text style={s.errorText} numberOfLines={2}>
              {post.lastError}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={s.actionsRow}>
          <Pressable
            onPress={onReschedule}
            style={[s.actionBtn, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}
            accessibilityRole="button"
          >
            {post.status === 'failed'
              ? <RotateCw size={12} color={colors.text.primary} strokeWidth={2} />
              : <Edit2 size={12} color={colors.text.primary} strokeWidth={2} />
            }
            <Text style={[s.actionText, { color: colors.text.primary }]}>
              {post.status === 'failed' ? 'Neu versuchen' : 'Umplanen'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            disabled={isCancelling}
            style={[s.actionBtn, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle, opacity: isCancelling ? 0.5 : 1 }]}
            accessibilityRole="button"
          >
            <XIcon size={12} color="#EF4444" strokeWidth={2} />
            <Text style={[s.actionText, { color: '#EF4444' }]}>Abbrechen</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ colors, onCreate }: { colors: any; onCreate: () => void }) {
  return (
    <View style={s.emptyWrap}>
      <View style={[s.emptyIcon, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        <Clock size={28} color={colors.text.muted} strokeWidth={1.5} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.text.primary }]}>Keine geplanten Posts</Text>
      <Text style={[s.emptySub, { color: colors.text.muted }]}>
        Plane deine Posts für später — sie werden automatisch zum gewählten Zeitpunkt veröffentlicht.
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

// ─── Reschedule Modal ─────────────────────────────────────────────────────────

/** Presets: "in X Stunden", "heute 20:00", "morgen 09:00", … */
function presetOptions(): { label: string; at: Date }[] {
  const now = new Date();
  const opts: { label: string; at: Date }[] = [];

  const in1h  = new Date(now.getTime() + 60 * 60 * 1000);
  const in3h  = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  opts.push({ label: 'in 1 h', at: in1h });
  opts.push({ label: 'in 3 h', at: in3h });

  const today20 = new Date(now);  today20.setHours(20, 0, 0, 0);
  if (today20.getTime() > now.getTime() + 60_000) opts.push({ label: 'Heute 20:00', at: today20 });

  const tom = new Date(now); tom.setDate(tom.getDate() + 1);
  const t9  = new Date(tom); t9.setHours(9, 0, 0, 0);
  const t14 = new Date(tom); t14.setHours(14, 0, 0, 0);
  const t20 = new Date(tom); t20.setHours(20, 0, 0, 0);
  opts.push({ label: 'Morgen 09:00', at: t9 });
  opts.push({ label: 'Morgen 14:00', at: t14 });
  opts.push({ label: 'Morgen 20:00', at: t20 });

  const next7 = new Date(now); next7.setDate(next7.getDate() + 7); next7.setHours(9, 0, 0, 0);
  opts.push({ label: 'In 1 Woche', at: next7 });

  return opts;
}

/** Pad + format "DD.MM.YYYY HH:MM" */
function formatDateFull(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} · ${hh}:${mi}`;
}

function Stepper({
  label, onInc, onDec, colors,
}: { label: string; onInc: () => void; onDec: () => void; colors: any }) {
  return (
    <View style={[ms.stepper, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
      <Pressable onPress={onDec} hitSlop={10} style={ms.stepperBtn}>
        <ChevronDown size={14} color={colors.text.primary} strokeWidth={2.5} />
      </Pressable>
      <Text style={[ms.stepperLabel, { color: colors.text.primary }]}>{label}</Text>
      <Pressable onPress={onInc} hitSlop={10} style={ms.stepperBtn}>
        <ChevronUp size={14} color={colors.text.primary} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function RescheduleModal({
  visible, initialTime, onClose, onSave, colors, isSaving,
}: {
  visible: boolean;
  initialTime: Date;
  onClose: () => void;
  onSave: (d: Date) => void;
  colors: any;
  isSaving: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<Date>(initialTime);

  // Re-init date when modal (re-)opens
  React.useEffect(() => {
    if (visible) setDate(initialTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const presets = presetOptions();
  const minDateMs = Date.now() + 60_000;
  const maxDateMs = Date.now() + 60 * 24 * 3600 * 1000;

  const clamp = (d: Date) => {
    const t = Math.max(minDateMs, Math.min(maxDateMs, d.getTime()));
    return new Date(t);
  };
  const bumpDays    = (days: number)    => setDate((d) => clamp(new Date(d.getTime() + days * 24 * 3600 * 1000)));
  const bumpHours   = (hours: number)   => setDate((d) => clamp(new Date(d.getTime() + hours * 3600 * 1000)));
  const bumpMinutes = (minutes: number) => setDate((d) => clamp(new Date(d.getTime() + minutes * 60 * 1000)));

  const valid = date.getTime() >= minDateMs && date.getTime() <= maxDateMs;

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose} />
      <View style={[ms.sheetWrap, { paddingBottom: insets.bottom + 16 }]}>
        <View style={[ms.sheet, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <View style={[ms.handle, { backgroundColor: colors.border.subtle }]} />
          <Text style={[ms.heading, { color: colors.text.primary }]}>Zeitpunkt wählen</Text>
          <Text style={[ms.sub, { color: colors.text.muted }]}>
            Mindestens 1 Minute, höchstens 60 Tage in der Zukunft.
          </Text>

          {/* Großer Datum/Zeit Anzeige */}
          <View style={[ms.dateCard, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
            <Text style={[ms.dateBig, { color: colors.text.primary }]}>{formatDateFull(date)}</Text>
            <Text style={[ms.dateHint, { color: colors.text.muted }]}>
              {scheduledPostLabel(date.toISOString())}
            </Text>
          </View>

          {/* Presets */}
          <Text style={[ms.sectionLabel, { color: colors.text.muted }]}>SCHNELLAUSWAHL</Text>
          <View style={ms.presetRow}>
            {presets.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => setDate(clamp(p.at))}
                style={[ms.preset, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}
              >
                <Text style={[ms.presetText, { color: colors.text.primary }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Feinsteuerung */}
          <Text style={[ms.sectionLabel, { color: colors.text.muted }]}>FEINSTEUERUNG</Text>
          <View style={ms.stepperRow}>
            <Stepper label="Tag −/+"   onDec={() => bumpDays(-1)}    onInc={() => bumpDays(1)}    colors={colors} />
            <Stepper label="Std −/+"  onDec={() => bumpHours(-1)}   onInc={() => bumpHours(1)}   colors={colors} />
            <Stepper label="Min −/+"  onDec={() => bumpMinutes(-15)} onInc={() => bumpMinutes(15)} colors={colors} />
          </View>

          <View style={ms.actions}>
            <Pressable
              onPress={onClose}
              style={[ms.btn, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}
            >
              <Text style={[ms.btnText, { color: colors.text.primary }]}>Abbrechen</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(date)}
              disabled={isSaving || !valid}
              style={[ms.btn, { backgroundColor: colors.text.primary, opacity: (isSaving || !valid) ? 0.5 : 1 }]}
            >
              <Text style={[ms.btnText, { color: colors.bg.primary }]}>
                {isSaving ? 'Speichert…' : 'Speichern'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
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

  summary: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, paddingHorizontal: 4 },

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
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  videoTagText: { color: '#fff', fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },

  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  timeLabel: { flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  caption: { fontSize: 13, fontWeight: '500', lineHeight: 18 },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
  },
  errorText: { flex: 1, color: '#EF4444', fontSize: 11, fontWeight: '500' },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, borderWidth: 1,
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

const ms = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, paddingTop: 10, paddingBottom: 16, paddingHorizontal: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  heading: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 8 },

  dateCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8,
    alignItems: 'center', gap: 4,
  },
  dateBig: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  dateHint: { fontSize: 12, fontWeight: '600' },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 14, marginBottom: 8, paddingLeft: 2 },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  presetText: { fontSize: 12, fontWeight: '700' },

  stepperRow: { flexDirection: 'row', gap: 8 },
  stepper: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', paddingVertical: 8, gap: 4,
  },
  stepperBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  stepperLabel: { fontSize: 11, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 14, fontWeight: '800' },
});
