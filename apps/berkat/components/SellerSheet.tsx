// Wer ist der Mensch da vorne?
//
// Öffnet sich beim Tippen auf den Kopf im Live-Raum. Oben die Zahlen, an denen
// ein Fremder entscheidet, ob er diesem Verkäufer Geld schickt — darunter alles,
// was man mit ihm tun kann.
//
// Die Reihenfolge der Zeilen ist nicht beliebig: erst das Freundliche
// (Trinkgeld, Profil, Nachricht, Erwähnen), dann mit Abstand das Unfreundliche
// (Sperren, Melden). Wer jemanden melden will, sucht danach; wer nur stöbert,
// soll nicht als Erstes über „Sperren" stolpern.
//
// Das Sheet sitzt auf der Bühne, ist also dunkel — anders als beim Vorbild, wo
// es weiß über dem Video liegt. Berkats Gesetz kennt zwei feste Flächen, und
// der Live-Raum ist die dunkle.

import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AtSign,
  Ban,
  ChevronLeft,
  CircleUser,
  Flag,
  Gift,
  MessageSquare,
  Star,
  Tag,
  Truck,
  X,
} from 'lucide-react-native';
import { stage, radius, space } from '../theme/tokens';
import { Avatar } from './Avatar';
import {
  formatRating,
  formatShipTime,
  type SellerStats,
} from '../lib/useSellerStats';
import { REPORT_REASONS, type ReportReason } from '../lib/useSellerActions';

type Props = {
  visible: boolean;
  sellerId: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  stats?: SellerStats;
  isBlocked: boolean;
  /** Nicht anzeigen, wenn man sich selbst ansieht */
  isSelf: boolean;
  follow: { canFollow: boolean; isFollowing: boolean; busy: boolean; toggle: () => void };
  onClose: () => void;
  onTip: () => void;
  onProfile: () => void;
  onMessage: () => void;
  onMention: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onReport: (reason: ReportReason) => void;
};

export function SellerSheet({
  visible,
  sellerId,
  username,
  avatarUrl,
  stats,
  isBlocked,
  isSelf,
  follow,
  onClose,
  onTip,
  onProfile,
  onMessage,
  onMention,
  onBlock,
  onUnblock,
  onReport,
}: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'main' | 'report'>('main');

  // Beim Öffnen immer vorne anfangen. Ohne das stünde beim zweiten Öffnen noch
  // die Gründe-Liste da, und man würde jemanden melden, den man ansehen wollte.
  useEffect(() => {
    if (visible) setView('main');
  }, [visible]);

  const name = username ?? 'Verkäufer';

  const confirmBlock = () => {
    Alert.alert(
      `${name} sperren?`,
      'Ihr seht dann nichts mehr voneinander — auch nicht im Chat. Du kannst das jederzeit zurücknehmen.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Sperren', style: 'destructive', onPress: onBlock },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom || space.md }]}>
          <View style={styles.grabber} />

          {view === 'report' ? (
            <>
              <View style={styles.head}>
                <Pressable onPress={() => setView('main')} hitSlop={10} accessibilityLabel="Zurück">
                  <ChevronLeft size={22} color={stage.text} />
                </Pressable>
                <Text style={styles.title}>Was ist passiert?</Text>
                <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Schließen">
                  <X size={20} color={stage.textMuted} />
                </Pressable>
              </View>

              <Text style={styles.explain}>
                Deine Meldung geht nur an uns — {name} erfährt nicht, von wem sie kam.
              </Text>

              <ScrollView style={styles.reasonList} bounces={false}>
                {REPORT_REASONS.map((r) => (
                  <Pressable
                    key={r.key}
                    style={styles.reasonRow}
                    onPress={() => onReport(r.key)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.reasonText}>{r.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              {/* Kopf: wer, und der einzige Knopf, der hier oben hingehört. */}
              <View style={styles.identity}>
                <Avatar uri={avatarUrl} name={username} size={48} ring />
                <Text numberOfLines={1} style={styles.name}>
                  {name}
                </Text>
                {follow.canFollow ? (
                  <Pressable
                    onPress={() => follow.toggle()}
                    disabled={follow.busy}
                    style={[styles.followPill, follow.isFollowing && styles.followPillActive]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.followText, follow.isFollowing && styles.followTextActive]}
                    >
                      {follow.isFollowing ? 'Folgt' : 'Folgen'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Die drei Zahlen. Jede zeigt „—" statt einer erfundenen Zahl,
                  solange es nichts zu zeigen gibt. */}
              <View style={styles.tiles}>
                <Tile
                  icon={<Star size={18} color={stage.text} />}
                  value={formatRating(stats?.rating ?? null)}
                  label={
                    stats?.ratingCount
                      ? `${stats.ratingCount} ${stats.ratingCount === 1 ? 'Bewertung' : 'Bewertungen'}`
                      : 'Noch keine Bewertung'
                  }
                />
                <Tile
                  icon={<Truck size={18} color={stage.text} />}
                  value={formatShipTime(stats?.shipHours ?? null)}
                  label={stats?.shipSamples ? 'Versandzeit' : 'Noch nichts versendet'}
                />
                <Tile
                  icon={<Tag size={18} color={stage.text} />}
                  value={String(stats?.sold ?? 0)}
                  label={stats?.sold === 1 ? 'Zuschlag' : 'Zuschläge'}
                />
              </View>

              <View style={styles.rows}>
                <Row
                  icon={<Gift size={19} color={stage.gold} />}
                  label="Trinkgeld"
                  hint="Danke sagen, ohne etwas zu kaufen"
                  onPress={onTip}
                  disabled={isSelf}
                />
                <Row
                  icon={<CircleUser size={19} color={stage.text} />}
                  label="Profil anzeigen"
                  onPress={onProfile}
                />
                <Row
                  icon={<MessageSquare size={19} color={stage.text} />}
                  label="Nachricht"
                  onPress={onMessage}
                  disabled={isSelf}
                />
                <Row
                  icon={<AtSign size={19} color={stage.text} />}
                  label="Im Chat erwähnen"
                  onPress={onMention}
                />

                {/* Abstand vor dem Unfreundlichen — nicht aus Kosmetik: Ein
                    „Sperren" direkt unter „Erwähnen" wird verrutscht getroffen. */}
                {!isSelf ? (
                  <View style={styles.dangerGroup}>
                    <Row
                      icon={<Ban size={19} color={stage.textMuted} />}
                      label={isBlocked ? 'Sperre aufheben' : 'Sperren'}
                      muted
                      onPress={isBlocked ? onUnblock : confirmBlock}
                    />
                    <Row
                      icon={<Flag size={19} color={stage.textMuted} />}
                      label="Melden"
                      muted
                      onPress={() => setView('report')}
                    />
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Tile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.tile}>
      {icon}
      <Text style={styles.tileValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.tileLabel}>
        {label}
      </Text>
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
  muted,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onPress: () => void;
  muted?: boolean;
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, muted && styles.rowLabelMuted]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: stage.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: stage.lineStrong,
    marginTop: space.sm,
    marginBottom: space.sm,
  },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '700', color: stage.text },
  explain: { fontSize: 13, color: stage.textMuted, lineHeight: 19, marginTop: space.sm },

  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  name: { flex: 1, fontSize: 19, fontWeight: '700', color: stage.text },
  followPill: {
    borderRadius: radius.pill,
    backgroundColor: stage.gold,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  followPillActive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: stage.lineStrong },
  followText: { fontSize: 14, fontWeight: '700', color: stage.goldInk },
  followTextActive: { color: stage.textMuted },

  tiles: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    backgroundColor: stage.surfaceHigh,
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  tileValue: { fontSize: 20, fontWeight: '700', color: stage.text, marginTop: 2 },
  tileLabel: { fontSize: 11, color: stage.textMuted, lineHeight: 15 },

  rows: { marginTop: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 11,
  },
  rowPressed: { opacity: 0.55 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: stage.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: stage.text },
  rowLabelMuted: { color: stage.textMuted, fontWeight: '500' },
  rowHint: { fontSize: 12, color: stage.textMuted, marginTop: 1 },

  dangerGroup: {
    marginTop: space.md,
    paddingTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: stage.line,
  },

  reasonList: { marginTop: space.md, marginBottom: space.sm },
  reasonRow: {
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: stage.line,
  },
  reasonText: { fontSize: 15, color: stage.text },
});
