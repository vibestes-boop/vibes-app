import { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  Heart,
  MessageCircle,
  UserPlus,
  CheckCheck,
  Radio,
  Bell,
  AtSign,
  Check,
  X,
} from "lucide-react-native";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import * as ExpoNotifications from 'expo-notifications';
import {
  useNotifications,
  useMarkAllRead,
  useMarkOneRead,
  type AppNotification,
} from "@/lib/useNotifications";
import { useRespondFollowRequest } from "@/lib/useFollowRequest";

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d >= 1) return `${d}d`;
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}min`;
  return "Jetzt";
}

function actionLabel(n: AppNotification): string {
  switch (n.type) {
    case "like":
      return "hat deinen Post geliked";
    case "follow":
      return "folgt dir jetzt";
    case "comment":
      return n.comment_text
        ? `hat kommentiert: "${n.comment_text}"`
        : "hat deinen Post kommentiert";
    case "mention":
      return "hat dich in einem Kommentar erwähnt";
    case "dm":
      return n.comment_text
        ? `hat dir geschrieben: "${n.comment_text}"`
        : "hat dir eine Nachricht geschickt";
    case "follow_request":
      return "möchte dir folgen";
    case "follow_request_accepted":
      return "hat deine Follow-Anfrage akzeptiert";
    case "live":
      return "ist jetzt live 🔴 Schau rein!";
    case "live_invite":
      return "hat dich zu einem Live eingeladen 🔴";
    default:
      return "";
  }
}

// Gruppierte Notification (für aggregierte Like-Benachrichtigungen)
type GroupedNotif = AppNotification & { _extraCount: number };

function groupNotifications(notifs: AppNotification[]): GroupedNotif[] {
  const GROUPABLE: AppNotification['type'][] = ['like'];
  const groups = new Map<string, AppNotification[]>();
  const result: GroupedNotif[] = [];
  const consumed = new Set<string>();

  // Gruppiere by (type + post_id)
  for (const n of notifs) {
    if (!GROUPABLE.includes(n.type) || !n.post_id) continue;
    const key = `${n.type}:${n.post_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }

  // Finale Liste aufbauen (Reihenfolge aus Original erhalten)
  for (const n of notifs) {
    if (!GROUPABLE.includes(n.type) || !n.post_id) {
      result.push({ ...n, _extraCount: 0 });
      continue;
    }
    const key = `${n.type}:${n.post_id}`;
    if (consumed.has(key)) continue; // bereits als Gruppe verarbeitet
    consumed.add(key);
    const group = groups.get(key)!;
    result.push({ ...group[0], _extraCount: group.length - 1 });
  }

  return result;
}


function TypeIcon({ type }: { type: AppNotification["type"] }) {
  const cfg = (
    {
      like:                     { Icon: Heart,         bg: "rgba(244,114,182,0.18)", color: "#F472B6" },
      comment:                  { Icon: MessageCircle, bg: "rgba(34,211,238,0.18)",  color: "#22D3EE" },
      mention:                  { Icon: AtSign,        bg: "rgba(139,92,246,0.18)",  color: "#A78BFA" },
      dm:                       { Icon: MessageCircle, bg: "rgba(251,191,36,0.18)",  color: "#FBBF24" },
      follow:                   { Icon: UserPlus,      bg: "rgba(52,211,153,0.18)",  color: "#34D399" },
      follow_request:           { Icon: UserPlus,      bg: "rgba(251,191,36,0.18)",  color: "#FBBF24" },
      follow_request_accepted:  { Icon: UserPlus,      bg: "rgba(52,211,153,0.18)",  color: "#34D399" },
      live:                     { Icon: Radio,         bg: "rgba(239,68,68,0.18)",   color: "#EF4444" },
      live_invite:              { Icon: Radio,         bg: "rgba(239,68,68,0.18)",   color: "#EF4444" },
    } as Record<string, { Icon: React.ElementType; bg: string; color: string }>
  )[type] ?? { Icon: Bell, bg: "rgba(255,200,0,0.15)", color: "#FBBF24" };

  return (
    <View style={[styles.typeIcon, { backgroundColor: cfg.bg }]}>
      <cfg.Icon size={14} color={cfg.color} strokeWidth={2} />
    </View>
  );
}

// ── Notification-Karte ─────────────────────────────────────────────────────

function NotifCard({ item }: { item: AppNotification }) {
  const { mutate: markOne } = useMarkOneRead();
  const { mutate: respond, isPending: responding } = useRespondFollowRequest();

  const handlePress = () => {
    impactAsync(ImpactFeedbackStyle.Light);
    if (!item.read) markOne(item.id);

    if (item.type === "dm" && item.conversation_id) {
      // Direkt zur DM-Konversation
      router.push({
        pathname: "/messages/[id]",
        params: {
          id: item.conversation_id,
          username: item.sender?.username ?? '',
          avatarUrl: item.sender?.avatar_url ?? '',
        },
      });
    } else if (item.type === "live" || item.type === "live_invite") {
      const sessionId = item.session_id;
      if (sessionId) {
        router.push({ pathname: "/live/watch/[id]", params: { id: sessionId } });
      }
    } else if (
      (item.type === "follow" || item.type === "follow_request" || item.type === "follow_request_accepted")
      && item.sender?.id
    ) {
      router.push({ pathname: "/user/[id]", params: { id: item.sender.id } });
    } else if (item.post_id) {
      router.push({
        pathname: "/post/[id]",
        params: {
          id: item.post_id,
          openComments: (item.type === 'comment' || item.type === 'mention') ? '1' : '0',
        },
      });
    }
  };

  const senderName = item.sender?.username
    ? `@${item.sender.username}`
    : "Jemand";
  const initial = (item.sender?.username ?? "?")[0].toUpperCase();

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.card, !item.read && styles.cardUnread]}
      accessibilityRole="button"
      accessibilityLabel={`Benachrichtigung von ${senderName}: ${actionLabel(item)}`}
    >
      {/* Ungelesen-Indikator */}
      {!item.read && <View style={styles.unreadDot} />}

      {/* Avatar + Typ-Icon */}
      <View style={styles.avatarWrap}>
        {item.sender?.avatar_url ? (
          <Image
            source={{ uri: item.sender.avatar_url }}
            style={styles.avatar}
            accessibilityLabel={`${senderName} Profilbild`}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <View style={styles.typeIconPos}>
          <TypeIcon type={item.type} />
        </View>
      </View>

      {/* Text */}
      <View style={styles.textWrap}>
        <Text style={styles.cardText} numberOfLines={2}>
          <Text style={styles.senderName}>{senderName}</Text>
          {(item as GroupedNotif)._extraCount > 0 && (
            <Text style={styles.actionText}>{` und ${(item as GroupedNotif)._extraCount} weitere`}</Text>
          )}{" "}
          <Text style={styles.actionText}>{actionLabel(item)}</Text>
        </Text>
        <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
      </View>

      {/* Post-Thumbnail (bei like/comment) */}
      {item.post_thumb && item.type !== "follow" && item.type !== "follow_request" && (
        <Image
          source={{ uri: item.post_thumb }}
          style={styles.postThumb}
          contentFit="cover"
          accessibilityLabel="Post-Vorschaubild"
        />
      )}

      {/* Follow-Request: Annehmen / Ablehnen */}
      {item.type === "follow_request" && item.sender?.id && (
        <View style={{ flexDirection: 'column', gap: 6, marginLeft: 8 }}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              respond({
                requestId: item.id, // notification id als Referenz
                senderId: item.sender!.id,
                accept: true,
              });
              markOne(item.id);
            }}
            disabled={responding}
            style={{
              backgroundColor: 'rgba(52,211,153,0.15)',
              borderRadius: 10,
              padding: 7,
              borderWidth: 1,
              borderColor: 'rgba(52,211,153,0.4)',
            }}
            accessibilityRole="button"
            accessibilityLabel="Anfrage annehmen"
          >
            <Check size={14} color="#34D399" strokeWidth={2.5} />
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              respond({
                requestId: item.id,
                senderId: item.sender!.id,
                accept: false,
              });
              markOne(item.id);
            }}
            disabled={responding}
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              borderRadius: 10,
              padding: 7,
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.3)',
            }}
            accessibilityRole="button"
            accessibilityLabel="Anfrage ablehnen"
          >
            <X size={14} color="#EF4444" strokeWidth={2.5} />
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

// ── Hauptscreen ────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const {
    data: notifs = [],
    isLoading,
    refetch,
    isRefetching,
  } = useNotifications();
  const { mutate: markAll } = useMarkAllRead();

  // Beim Verlassen des Tabs alle als gelesen markieren — nicht beim Öffnen,
  // damit der User erst sehen kann was neu ist, bevor alles markiert wird.
  useFocusEffect(
    useCallback(() => {
      // Badge auf 0 setzen wenn User den Notifications-Tab öffnet
      try { ExpoNotifications.setBadgeCountAsync(0); } catch { /* Expo Go stub */ }
      return () => {
        // Wird aufgerufen wenn User den Tab verlässt
        markAll();
      };
    }, [markAll]),
  );

  const unreadCount = notifs.filter((n) => !n.read).length;
  const groupedNotifs = groupNotifications(notifs);

  const renderItem = useCallback(
    ({ item }: { item: GroupedNotif }) => <NotifCard item={item} />,
    [],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Aktivität</Text>
        {unreadCount > 0 && (
          <Pressable
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Light);
              markAll();
            }}
            style={styles.markAllBtn}
            accessibilityRole="button"
            accessibilityLabel="Alle als gelesen markieren"
          >
            <CheckCheck size={15} color="#22D3EE" strokeWidth={2} />
            <Text style={styles.markAllText}>Alle gelesen</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#22D3EE" size="large" />
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.center}>
          <Bell size={52} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Noch keine Aktivität</Text>
          <Text style={styles.emptyDesc}>
            Hier siehst du Likes, Kommentare und neue Follower.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/explore' as never)}
            style={styles.emptyBtn}
            accessibilityRole="button"
            accessibilityLabel="Leute entdecken"
          >
            <Text style={styles.emptyBtnText}>Leute entdecken</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={groupedNotifs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={70}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#22D3EE"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050508",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(34,211,238,0.1)",
  },
  markAllText: {
    color: "#22D3EE",
    fontSize: 12,
    fontWeight: "600",
  },
  list: {
    paddingBottom: 100,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 76,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    position: "relative",
  },
  cardUnread: {
    backgroundColor: "rgba(34,211,238,0.04)",
  },
  unreadDot: {
    position: "absolute",
    left: 4,
    top: "50%",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#22D3EE",
    marginTop: -2.5,
  },
  avatarWrap: {
    position: "relative",
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  avatarFallback: {
    backgroundColor: "rgba(34,211,238,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#22D3EE",
    fontSize: 18,
    fontWeight: "700",
  },
  typeIconPos: {
    position: "absolute",
    bottom: -2,
    right: -2,
  },
  typeIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#050508",
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  senderName: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  actionText: {
    color: "rgba(255,255,255,0.65)",
    fontWeight: "400",
  },
  timeText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontWeight: "500",
  },
  postThumb: {
    width: 46,
    height: 56,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyDesc: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.4)',
    backgroundColor: 'rgba(34,211,238,0.1)',
  },
  emptyBtnText: { color: '#22D3EE', fontSize: 14, fontWeight: '600' },
});
