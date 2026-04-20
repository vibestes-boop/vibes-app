/**
 * app/creator/scheduled-lives.tsx — Creator Studio: Geplante Lives
 *
 * v1.26.0 — Scheduled Lives.
 *
 * Liste aller eigenen scheduled/reminded/live Einträge mit:
 *   • Titel + Beschreibungs-Vorschau
 *   • Scheduled-At Label ("in 2h 13min" / "Morgen 14:30" / "Mo 09:00")
 *   • Status-Badge (blau=scheduled, amber=reminded, green=live, grau=expired, rot=cancelled)
 *   • Reschedule via DateTimePicker Modal (erbt presetOptions von scheduled.tsx)
 *   • Cancel mit Confirm-Alert
 *   • Bei Status='reminded': "Jetzt live gehen" Shortcut → live/start?scheduledId=…
 *
 * Design: konsistent mit app/creator/scheduled.tsx (gleicher Look-and-Feel).
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Radio, AlertTriangle, Edit2,
  X as XIcon, Sparkles, ChevronUp, ChevronDown,
  Video, CheckCircle2, Circle, BellRing,
} from 'lucide-react-native';
import { useTheme } from '@/lib/useTheme';
import {
  useScheduledLives, scheduledLiveLabel,
  type ScheduledLive,
} from '@/lib/useScheduledLives';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScheduledLivesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const {
    list, upcoming, liveNow, isLoading, refetch,
    rescheduleLive, isRescheduling,
    cancelScheduledLive, isCancelling,
  } = useScheduledLives();

  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledLive | null>(null);

  const handleCancel = (live: ScheduledLive) => {
    Alert.alert(
      'Live absagen?',
      `„${live.title.slice(0, 60)}${live.title.length > 60 ? '…' : ''}" wird nicht stattfinden. Follower erhalten keinen Reminder mehr.`,
      [
        { text: 'Behalten', style: 'cancel' },
        {
          text:  'Absagen',
          style: 'destructive',
          onPress: async () => {
            try { await cancelScheduledLive(live.id); }
            catch (e: any) {
              Alert.alert('Fehler', e?.message ?? 'Konnte nicht abgesagt werden.');
            }
          },
        },
      ],
    );
  };

  const handleRescheduleSave = async (newTime: Date) => {
    if (!rescheduleTarget) return;
    if (newTime.getTime() < Date.now() + 5 * 60_000) {
      Alert.alert('Ungültig', 'Zeitpunkt muss mindestens 5 Minuten in der Zukunft liegen.');
      return;
    }
    try {
      await rescheduleLive(rescheduleTarget.id, newTime);
      setRescheduleTarget(null);
    } catch (e: any) {
      Alert.alert('Fehler', e?.message ?? 'Konnte nicht umgeplant werden.');
    }
  };

  const handleGoLive = (live: ScheduledLive) => {
    // Deep-Link zu live/start mit vorausgefüllten Feldern
    router.push({
      pathname: '/live/start',
      params: {
        scheduledLiveId: live.id,
        title:           live.title,
        allowComments:   live.allowComments ? '1' : '0',
        allowGifts:      live.allowGifts    ? '1' : '0',
        womenOnly:       live.womenOnly     ? '1' : '0',
      },
    } as any);
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
            <Radio size={12} color={colors.text.primary} strokeWidth={2} />
            <Text style={[s.headerBadgeText, { color: colors.text.primary }]}>Geplante Lives</Text>
          </View>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: 60 }} />
      ) : list.length === 0 ? (
        <EmptyState colors={colors} onCreate={() => router.push('/live/start' as any)} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.accent.primary} />}
          ListHeaderComponent={
            <View style={{ marginBottom: 6 }}>
              <Text style={[s.summary, { color: colors.text.muted }]}>
                {upcoming.length} geplant
                {liveNow.length > 0 && ` · ${liveNow.length} live`}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ScheduledLiveRow
              live={item}
              colors={colors}
              onReschedule={() => setRescheduleTarget(item)}
              onCancel={() => handleCancel(item)}
              onGoLive={() => handleGoLive(item)}
              isCancelling={isCancelling}
            />
          )}
        />
      )}

      {/* Reschedule Modal */}
      <RescheduleModal
        visible={!!rescheduleTarget}
        initialTime={rescheduleTarget ? new Date(rescheduleTarget.scheduledAt) : new Date(Date.now() + 3600_000)}
        onClose={() => setRescheduleTarget(null)}
        onSave={handleRescheduleSave}
        colors={colors}
        isSaving={isRescheduling}
      />
    </View>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ScheduledLiveRow({
  live, colors, onReschedule, onCancel, onGoLive, isCancelling,
}: {
  live: ScheduledLive; colors: any;
  onReschedule: () => void; onCancel: () => void; onGoLive: () => void;
  isCancelling: boolean;
}) {
  const statusBadge = (() => {
    switch (live.status) {
      case 'scheduled':  return { label: 'Geplant',       bg: 'rgba(59,130,246,0.14)',  fg: '#3B82F6', icon: Circle };
      case 'reminded':   return { label: 'Reminder raus', bg: 'rgba(251,191,36,0.14)',  fg: '#F59E0B', icon: BellRing };
      case 'live':       return { label: 'Live',          bg: 'rgba(34,197,94,0.14)',   fg: '#22C55E', icon: Radio };
      case 'expired':    return { label: 'Verfallen',     bg: 'rgba(120,120,120,0.14)', fg: colors.text.muted, icon: AlertTriangle };
      case 'cancelled':  return { label: 'Abgesagt',      bg: 'rgba(239,68,68,0.14)',   fg: '#EF4444', icon: XIcon };
      default:           return { label: live.status,     bg: 'rgba(120,120,120,0.14)', fg: colors.text.muted, icon: Circle };
    }
  })();

  const StatusIcon = statusBadge.icon;
  const isActionable = live.status === 'scheduled' || live.status === 'reminded';
  const canGoLive    = live.status === 'reminded' || live.status === 'scheduled';

  return (
    <View style={[s.row, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <View style={{ flex: 1, gap: 8 }}>
        {/* Status + Zeit */}
        <View style={s.rowTopLine}>
          <View style={[s.statusBadge, { backgroundColor: statusBadge.bg }]}>
            <StatusIcon size={10} color={statusBadge.fg} strokeWidth={2.5} />
            <Text style={[s.statusBadgeText, { color: statusBadge.fg }]}>{statusBadge.label}</Text>
          </View>
          <Text style={[s.timeLabel, { color: colors.text.primary }]}>
            {scheduledLiveLabel(live.scheduledAt)}
          </Text>
        </View>

        {/* Titel */}
        <Text style={[s.title, { color: colors.text.primary }]} numberOfLines={2}>
          {live.title}
        </Text>

        {/* Beschreibung */}
        {live.description && (
          <Text style={[s.description, { color: colors.text.secondary }]} numberOfLines={2}>
            {live.description}
          </Text>
        )}

        {/* Option-Chips */}
        <View style={s.chipRow}>
          {live.allowGifts && (
            <View style={[s.chip, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
              <Sparkles size={10} color={colors.text.muted} strokeWidth={2} />
              <Text style={[s.chipText, { color: colors.text.muted }]}>Geschenke</Text>
            </View>
          )}
          {!live.allowComments && (
            <View style={[s.chip, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
              <Text style={[s.chipText, { color: colors.text.muted }]}>Chat aus</Text>
            </View>
          )}
          {live.womenOnly && (
            <View style={[s.chip, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
              <Text style={[s.chipText, { color: colors.text.muted }]}>Nur Frauen</Text>
            </View>
          )}
          {live.status === 'reminded' && (
            <View style={[s.chip, { backgroundColor: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.25)' }]}>
              <CheckCircle2 size={10} color="#F59E0B" strokeWidth={2} />
              <Text style={[s.chipText, { color: '#F59E0B' }]}>Follower benachrichtigt</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {isActionable && (
          <View style={s.actionsRow}>
            {canGoLive && (
              <Pressable
                onPress={onGoLive}
                style={[s.actionBtn, s.actionPrimary, { backgroundColor: colors.text.primary }]}
                accessibilityRole="button"
              >
                <Video size={12} color={colors.bg.primary} strokeWidth={2.5} />
                <Text style={[s.actionText, { color: colors.bg.primary }]}>Jetzt live gehen</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onReschedule}
              style={[s.actionBtn, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}
              accessibilityRole="button"
            >
              <Edit2 size={12} color={colors.text.primary} strokeWidth={2} />
              <Text style={[s.actionText, { color: colors.text.primary }]}>Umplanen</Text>
            </Pressable>
            <Pressable
              onPress={onCancel}
              disabled={isCancelling}
              style={[s.actionBtn, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle, opacity: isCancelling ? 0.5 : 1 }]}
              accessibilityRole="button"
            >
              <XIcon size={12} color="#EF4444" strokeWidth={2} />
              <Text style={[s.actionText, { color: '#EF4444' }]}>Absagen</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ colors, onCreate }: { colors: any; onCreate: () => void }) {
  return (
    <View style={s.emptyWrap}>
      <View style={[s.emptyIcon, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        <Radio size={28} color={colors.text.muted} strokeWidth={1.5} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.text.primary }]}>Noch keine geplanten Lives</Text>
      <Text style={[s.emptySub, { color: colors.text.muted }]}>
        Plane deinen nächsten Stream — Follower bekommen 15 Minuten vorher einen Reminder.
      </Text>
      <Pressable
        onPress={onCreate}
        style={[s.emptyCta, { backgroundColor: colors.text.primary }]}
        accessibilityRole="button"
      >
        <Sparkles size={14} color={colors.bg.primary} strokeWidth={2.5} />
        <Text style={[s.emptyCtaText, { color: colors.bg.primary }]}>Live planen</Text>
      </Pressable>
    </View>
  );
}

// ─── Reschedule Modal ─────────────────────────────────────────────────────────
// (Gleiches Layout wie app/creator/scheduled.tsx, nur strengere Min-Delta: 5min)

function presetOptions(): { label: string; at: Date }[] {
  const now = new Date();
  const opts: { label: string; at: Date }[] = [];

  const in1h  = new Date(now.getTime() + 60 * 60 * 1000);
  const in3h  = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  opts.push({ label: 'in 1 h', at: in1h });
  opts.push({ label: 'in 3 h', at: in3h });

  const today20 = new Date(now);  today20.setHours(20, 0, 0, 0);
  if (today20.getTime() > now.getTime() + 5 * 60_000) opts.push({ label: 'Heute 20:00', at: today20 });

  const tom = new Date(now); tom.setDate(tom.getDate() + 1);
  const t9  = new Date(tom); t9.setHours(9, 0, 0, 0);
  const t20 = new Date(tom); t20.setHours(20, 0, 0, 0);
  opts.push({ label: 'Morgen 09:00', at: t9 });
  opts.push({ label: 'Morgen 20:00', at: t20 });

  const next7 = new Date(now); next7.setDate(next7.getDate() + 7); next7.setHours(20, 0, 0, 0);
  opts.push({ label: 'In 1 Woche', at: next7 });

  return opts;
}

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

  React.useEffect(() => {
    if (visible) setDate(initialTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const presets = presetOptions();
  const minDateMs = Date.now() + 5 * 60_000;          // Min 5 min
  const maxDateMs = Date.now() + 30 * 24 * 3600 * 1000; // Max 30 Tage

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
            Mindestens 5 Minuten, höchstens 30 Tage in der Zukunft.
          </Text>

          <View style={[ms.dateCard, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
            <Text style={[ms.dateBig, { color: colors.text.primary }]}>{formatDateFull(date)}</Text>
            <Text style={[ms.dateHint, { color: colors.text.muted }]}>
              {scheduledLiveLabel(date.toISOString())}
            </Text>
          </View>

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

  row: {
    flexDirection: 'row', gap: 12, padding: 12,
    borderRadius: 14, borderWidth: 1,
  },

  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  timeLabel: { flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  title: { fontSize: 15, fontWeight: '800', lineHeight: 19 },
  description: { fontSize: 13, fontWeight: '500', lineHeight: 18 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  chipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  actionPrimary: { borderWidth: 0 },
  actionText: { fontSize: 11, fontWeight: '700' },

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
