/**
 * app/admin/reports.tsx — Content-Reports verwalten
 *
 * - Tab: Ausstehend / Überprüft / Abgelehnt
 * - Pro Report: Inhalt anzeigen, akzeptieren oder ablehnen mit optionaler Notiz
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Alert, TextInput, Modal, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Flag, CheckCircle, XCircle, Clock, FileText } from 'lucide-react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useAdminReports, useAdminResolveReport, type ContentReport } from '@/lib/useAdmin';
import { useTheme } from '@/lib/useTheme';

type ReportTab = 'pending' | 'reviewed' | 'dismissed' | 'actioned';

const TAB_META: { key: ReportTab; label: string; icon: any }[] = [
  { key: 'pending',   label: 'Ausstehend', icon: Clock },
  { key: 'reviewed',  label: 'Überprüft',  icon: CheckCircle },
  { key: 'dismissed', label: 'Abgelehnt',  icon: XCircle },
  { key: 'actioned',  label: 'Behoben',    icon: Flag },
];

const TARGET_LABEL = {
  post: 'Post',
  user: 'Nutzer',
  live: 'Live',
};

export default function AdminReportsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<ReportTab>('pending');
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const { data: reports = [], isLoading, refetch, isRefetching } = useAdminReports(activeTab as any);
  const { mutateAsync: resolveReport } = useAdminResolveReport();

  const handleResolve = useCallback(async (status: 'reviewed' | 'dismissed' | 'actioned') => {
    if (!selectedReport) return;
    setResolving(true);
    try {
      await resolveReport({ reportId: selectedReport.id, status: status as any, adminNote: adminNote.trim() || undefined });
      impactAsync(ImpactFeedbackStyle.Medium);
      setSelectedReport(null);
      setAdminNote('');
    } catch {
      Alert.alert('Fehler', 'Aktion fehlgeschlagen.');
    } finally {
      setResolving(false);
    }
  }, [selectedReport, adminNote, resolveReport]);

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>Content Reports</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tabs */}
      <View style={[s.tabRow, { borderBottomColor: colors.border.subtle }]}>
        {TAB_META.map(tab => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.key}
              style={[s.tab, isActive && [s.tabActive, { borderBottomColor: colors.text.primary }]]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Icon size={13} color={isActive ? colors.text.primary : colors.text.muted} strokeWidth={2} />
              <Text style={[s.tabLabel, { color: isActive ? colors.text.primary : colors.text.muted }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent.primary} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Flag size={40} color={colors.text.muted} strokeWidth={1.2} />
              <Text style={[s.emptyText, { color: colors.text.muted }]}>Keine Reports</Text>
            </View>
          }
          renderItem={({ item: report }) => {
            const date = new Date(report.created_at).toLocaleDateString('de-DE');
            return (
              <Pressable
                style={[s.reportCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
                onPress={() => {
                  if (activeTab === 'pending') {
                    setSelectedReport(report);
                    setAdminNote(report.admin_note ?? '');
                  }
                }}
                accessibilityRole="button"
              >
                <View style={s.reportHeader}>
                  <View style={[s.typeBadge, { backgroundColor: colors.bg.primary }]}>
                    <FileText size={11} color={colors.text.muted} strokeWidth={2} />
                    <Text style={[s.typeLabel, { color: colors.text.muted }]}>
                      {TARGET_LABEL[report.target_type]}
                    </Text>
                  </View>
                  <Text style={[s.reportDate, { color: colors.text.muted }]}>{date}</Text>
                </View>

                <Text style={[s.reportReason, { color: colors.text.primary }]}>
                  „{report.reason}"
                </Text>
                <Text style={[s.reportMeta, { color: colors.text.muted }]}>
                  von @{(report.reporter as any)?.username ?? 'Unbekannt'}
                </Text>

                {report.admin_note && (
                  <View style={[s.noteBox, { backgroundColor: colors.bg.primary }]}>
                    <Text style={[s.noteText, { color: colors.text.muted }]}>Notiz: {report.admin_note}</Text>
                  </View>
                )}

              {activeTab === 'pending' && (
                <Text style={[s.tapHint, { color: colors.text.muted }]}>Tippen zum Bearbeiten →</Text>
              )}
              </Pressable>
            );
          }}
        />
      )}

      {/* ── Resolve Modal ── */}
      <Modal
        visible={!!selectedReport}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}
      >
        <Pressable style={s.overlay} onPress={() => setSelectedReport(null)}>
          <View style={[s.resolveSheet, { backgroundColor: colors.bg.elevated }]}>
            <Text style={[s.sheetTitle, { color: colors.text.primary }]}>Report bearbeiten</Text>
            <Text style={[s.sheetReason, { color: colors.text.muted }]}>
              „{selectedReport?.reason}"
            </Text>

            <Text style={[s.sheetLabel, { color: colors.text.primary }]}>Admin-Notiz (optional)</Text>
            <TextInput
              style={[s.noteInput, { color: colors.text.primary, backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}
              placeholder="z.B. Inhalt entfernt, Nutzer verwarnt"
              placeholderTextColor={colors.text.muted}
              value={adminNote}
              onChangeText={setAdminNote}
              multiline
              numberOfLines={3}
            />

            <View style={s.resolveBtns}>
              <Pressable
                style={[s.actionBtn, { borderColor: colors.border.subtle }]}
                onPress={() => handleResolve('dismissed')}
                disabled={resolving}
              >
                <XCircle size={15} color={colors.text.muted} strokeWidth={2} />
                <Text style={[s.actionBtnText, { color: colors.text.muted }]}>Ablehnen</Text>
              </Pressable>
              <Pressable
                style={[s.actionBtn, { borderColor: colors.border.subtle }]}
                onPress={() => handleResolve('reviewed')}
                disabled={resolving}
              >
                <CheckCircle size={15} color={colors.text.primary} strokeWidth={2} />
                <Text style={[s.actionBtnText, { color: colors.text.primary }]}>Überprüft</Text>
              </Pressable>
              <Pressable
                style={[s.actionBtnFilled, { backgroundColor: colors.text.primary }]}
                onPress={() => {
                  Alert.alert(
                    'Maßnahme ergreifen',
                    'Welche Aktion wurde durchgeführt?',
                    [
                      { text: 'User gebannt',  onPress: () => handleResolve('actioned') },
                      { text: 'Post gelöscht', onPress: () => handleResolve('actioned') },
                      { text: 'Verwarnung',    onPress: () => handleResolve('actioned') },
                      { text: 'Abbrechen', style: 'cancel' },
                    ]
                  );
                }}
                disabled={resolving}
              >
                {resolving
                  ? <ActivityIndicator color={colors.bg.primary} />
                  : <>
                      <Flag size={15} color={colors.bg.primary} strokeWidth={2} />
                      <Text style={[s.actionBtnText, { color: colors.bg.primary }]}>Maßnahme</Text>
                    </>
                }
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },

  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: {},
  tabLabel: { fontSize: 12, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },

  reportCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 6,
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeLabel: { fontSize: 10, fontWeight: '700' },
  reportDate: { fontSize: 11 },
  reportReason: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  reportMeta: { fontSize: 11 },
  noteBox: { borderRadius: 8, padding: 8 },
  noteText: { fontSize: 11 },
  tapHint: { fontSize: 11, fontWeight: '600', textAlign: 'right' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  resolveSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12,
  },
  sheetTitle:  { fontSize: 18, fontWeight: '800' },
  sheetReason: { fontSize: 14, lineHeight: 20 },
  sheetLabel:  { fontSize: 13, fontWeight: '700' },
  noteInput: {
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, textAlignVertical: 'top', minHeight: 80,
  },
  resolveBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1,
  },
  actionBtnFilled: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 13, borderRadius: 12,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
});
