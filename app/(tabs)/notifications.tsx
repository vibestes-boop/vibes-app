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
  Gem,
  ShoppingBag,
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
import { useTheme } from '@/lib/useTheme';

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
    case "gift":
      return n.gift_emoji && n.gift_name
        ? `hat dir ${n.gift_emoji} ${n.gift_name} geschickt!`
        : "hat dir ein Geschenk geschickt 🎁";
    case "new_order":
      return n.comment_text
        ? `hat bestellt: ${n.comment_text}`
        : "hat ein Produkt in deinem Shop gekauft 🛍";
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
      like:                     { Icon: Heart,         bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      comment:                  { Icon: MessageCircle, bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      mention:                  { Icon: AtSign,        bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      dm:                       { Icon: MessageCircle, bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      follow:                   { Icon: UserPlus,      bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      follow_request:           { Icon: UserPlus,      bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      follow_request_accepted:  { Icon: Check,         bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      live:                     { Icon: Radio,         bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      live_invite:              { Icon: Radio,         bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      gift:                     { Icon: Gem,           bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
      new_order:                { Icon: ShoppingBag,   bg: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.75)" },
    } as Record<string, { Icon: React.ElementType; bg: string; color: string }>
  )[type] ?? { Icon: Bell, bg: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" };

  return (
    <View style={[styles.typeIcon, { backgroundColor: cfg.bg }]}>
      <cfg.Icon size={14} color={cfg.color} strokeWidth={2} />
    </View>
  );
}

// ── Datum-Section Header ──────────────────────────────────────────────────
type ListItem = GroupedNotif | { _sectionHeader: string; id: string };

function buildListWithSections(notifs: GroupedNotif[]): ListItem[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 6 * 86400_000);

  const sections: { label: string; items: GroupedNotif[] }[] = [
    { label: 'Heute', items: [] },
    { label: 'Diese Woche', items: [] },
    { label: 'Älter', items: [] },
  ];

  for (const n of notifs) {
    const d = new Date(n.created_at);
    if (d >= today) sections[0].items.push(n);
    else if (d >= weekAgo) sections[1].items.push(n);
    else sections[2].items.push(n);
  }

  const result: ListItem[] = [];
  for (const sec of sections) {
    if (!sec.items.length) continue;
    result.push({ _sectionHeader: sec.label, id: `header_${sec.label}` });
    result.push(...sec.items);
  }
  return result;
}

// ── Notification-Karte ─────────────────────────────────────────────────────

function NotifCard({ item }: { item: AppNotification }) {
  const { mutate: markOne } = useMarkOneRead();
  const { mutate: respond, isPending: responding } = useRespondFollowRequest();
  const { colors } = useTheme();

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
    } else if (item.type === "gift" && item.sender?.id) {
      // Gift → Sender-Profil öffnen
      router.push({ pathname: "/user/[id]", params: { id: item.sender.id } });
    } else if (item.type === "new_order") {
      router.push('/shop/orders' as any);
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
          <Text style={[styles.senderName, { color: colors.text.primary }]}>{senderName}</Text>
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
  const { colors } = useTheme();
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
  const listData = buildListWithSections(groupedNotifs);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if ('_sectionHeader' in item) {
        return (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionHeaderText, { color: colors.text.muted }]}>{item._sectionHeader}</Text>
          </View>
        );
      }
      return <NotifCard item={item as GroupedNotif} />;
    },
    [colors],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Aktivität</Text>
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
            <CheckCheck size={15} color={colors.text.primary} strokeWidth={2} />
            <Text style={[styles.markAllText, { color: colors.text.primary }]}>Alle gelesen</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
        <ActivityIndicator color={colors.text.primary} size="large" />
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.center}>
          <Bell size={52} color={colors.icon.muted} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Noch keine Aktivität</Text>
          <Text style={[styles.emptyDesc, { color: colors.text.muted }]}>
            Hier siehst du Likes, Kommentare und neue Follower.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/explore' as never)}
            style={styles.emptyBtn}
            accessibilityRole="button"
            accessibilityLabel="Leute entdecken"
          >
            <Text style={[styles.emptyBtnText, { color: colors.text.primary }]}>Leute entdecken</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={70}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.text.primary}
            />
          }
          ItemSeparatorComponent={({ leadingItem }) =>
            '_sectionHeader' in (leadingItem ?? {}) ? null
            : <View style={[styles.separator, { backgroundColor: colors.border.subtle }]} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // backgroundColor via inline (theme-aware)
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
    // color via inline (theme-aware)
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
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  markAllText: {
    color: "#FFFFFF",
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
    backgroundColor: "rgba(29,185,84,0.04)",
  },
  unreadDot: {
    position: "absolute",
    left: 4,
    top: "50%",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#007AFF',
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
    backgroundColor: '#E8E8ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#555',
    fontSize: 18,
    fontWeight: '700',
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
    // borderColor via inline in NotifCard
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
    color: "#FFFFFF",   // bleibt weiß — wird von NotifCard inline überschrieben wenn nötig
    fontWeight: "700",
  },
  actionText: {
    color: "rgba(150,150,150,0.9)",  // neutrales grau — lesbar auf beiden Hintergründen
    fontWeight: "400",
  },
  timeText: {
    color: "rgba(130,130,130,0.9)",  // neutrales grau
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
    // color via inline (theme-aware)
    fontSize: 18,
    fontWeight: "700",
  },
  emptyDesc: {
    // color via inline (theme-aware)
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
    borderColor: 'rgba(120,120,128,0.3)',
    backgroundColor: 'rgba(120,120,128,0.1)',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600' },
});
