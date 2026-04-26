import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Messages-Data-Layer — SSR-Reads für `/messages` und `/messages/[id]`.
//
// Design:
//  1. `conversations`-Tabelle hat PK-Invariant `participant_1 < participant_2`
//     (Native-Schema aus `supabase/messages.sql`). Normalisierung für
//     "get or create" passiert im Server-Action-Layer — die SSR-Reads vertrauen
//     der DB-Ordnung und lesen stur die andere Participant-ID.
//  2. Conversation-Liste kommt aus Native-RPC `get_conversations()` — dieselbe
//     Batched-Query die Native nutzt: letzte-Message + Unread-Count + Other-User
//     in einem Call. Vermeidet N+1.
//  3. Thread-Initial-Load begrenzt auf letzte 80 Messages chronologisch ASC —
//     Realtime-Client subscribed danach `messages-{id}`-Channel und appendet
//     neue Messages am Ende. Ältere per Scroll-Load-More.
//  4. Message-Reactions werden in einer separaten Aggregation gelesen und
//     clientseitig pro Message gemappt (vermeidet doppeltes Row-Join auf
//     Message-Level bei 80 Messages × N Reactions).
// -----------------------------------------------------------------------------

export interface ConversationPreview {
  id: string;
  other_user_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  other_verified: boolean;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_self: boolean;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  post_id: string | null;
  reply_to_id: string | null;
  story_media_url: string | null;
  read: boolean;
  created_at: string;
}

export interface MessageWithContext extends MessageRow {
  reply_to: {
    id: string;
    sender_id: string;
    content: string | null;
    image_url: string | null;
  } | null;
  post: {
    id: string;
    video_url: string | null;
    thumbnail_url: string | null;
    caption: string | null;
    author_username: string | null;
  } | null;
}

export interface ReactionAggregate {
  message_id: string;
  emoji: string;
  count: number;
  by_me: boolean;
}

export interface ConversationHeader {
  id: string;
  participant_1: string;
  participant_2: string;
  other_user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
  };
  is_self: boolean;
}

// -----------------------------------------------------------------------------
// getConversations — delegiert an Native-RPC `get_conversations()`. Gibt pro
// Zeile bereits Other-User + letzte Message + Unread-Count zurück. Sortiert
// nach `last_message_at DESC` innerhalb der RPC.
// -----------------------------------------------------------------------------

export const getConversations = cache(async (): Promise<ConversationPreview[]> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc('get_conversations');
  if (error || !data) return [];

  // Native-RPC-Shape lies 1:1 ein. Zusätzliches Feld `is_self` wird für
  // "Meine Notizen"-Label auf der Liste abgeleitet.
  return (data as Array<{
    id: string;
    other_user_id: string;
    other_username: string;
    other_display_name: string | null;
    other_avatar_url: string | null;
    other_verified: boolean | null;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number | string;
  }>).map((row) => ({
    id: row.id,
    other_user_id: row.other_user_id,
    other_username: row.other_username,
    other_display_name: row.other_display_name ?? null,
    other_avatar_url: row.other_avatar_url ?? null,
    other_verified: Boolean(row.other_verified),
    last_message: row.last_message,
    last_message_at: row.last_message_at,
    unread_count: typeof row.unread_count === 'string'
      ? parseInt(row.unread_count, 10)
      : row.unread_count,
    is_self: row.other_user_id === user.id,
  }));
});

// -----------------------------------------------------------------------------
// getConversationHeader — Header-Fetch für `/messages/[id]`. Validiert dabei
// implizit die Membership (RLS lässt die Zeile nur lesen wenn der Viewer
// Participant ist → `null` heißt 404/redirect).
// -----------------------------------------------------------------------------

export const getConversationHeader = cache(
  async (conversationId: string): Promise<ConversationHeader | null> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: conv } = await supabase
      .from('conversations')
      .select('id, participant_1, participant_2')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conv) return null;

    const otherId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .eq('id', otherId)
      .maybeSingle();

    if (!profile) return null;

    return {
      id: conv.id,
      participant_1: conv.participant_1,
      participant_2: conv.participant_2,
      other_user: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url ?? null,
        verified: Boolean(profile.verified),
      },
      is_self: otherId === user.id,
    };
  },
);

// -----------------------------------------------------------------------------
// getConversationMessages — Initial-Load, letzten 80 Messages chronologisch
// aufsteigend. Inner-Join auf `reply_to` und `post` (beide nullable).
// -----------------------------------------------------------------------------

const MESSAGE_COLUMNS =
  'id, conversation_id, sender_id, content, image_url, post_id, reply_to_id, story_media_url, read, created_at';

export const getConversationMessages = cache(
  async (conversationId: string, limit = 80): Promise<MessageWithContext[]> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // DESC-Query dann reverse — so bekommen wir die NEUESTEN N messages und
    // zeigen sie dann oldest-to-newest im UI.
    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    const messages = [...data].reverse() as MessageRow[];

    // Reply-Targets + Posts nachladen
    const replyIds = messages.map((m) => m.reply_to_id).filter((x): x is string => !!x);
    const postIds = messages.map((m) => m.post_id).filter((x): x is string => !!x);

    const [replyMap, postMap] = await Promise.all([
      replyIds.length > 0
        ? supabase
            .from('messages')
            .select('id, sender_id, content, image_url')
            .in('id', replyIds)
            .then(({ data }) => new Map((data ?? []).map((r) => [r.id, r])))
        : Promise.resolve(new Map()),
      postIds.length > 0
        ? supabase
            .from('posts')
            .select('id, video_url:media_url, thumbnail_url, caption, author:profiles!posts_author_id_fkey(username)')
            .in('id', postIds)
            .then(({ data }) => {
              const m = new Map<string, MessageWithContext['post']>();
              (data ?? []).forEach((p) => {
                const author = Array.isArray(p.author) ? p.author[0] : p.author;
                m.set(p.id, {
                  id: p.id,
                  video_url: p.video_url ?? null,
                  thumbnail_url: p.thumbnail_url ?? null,
                  caption: p.caption ?? null,
                  author_username: author?.username ?? null,
                });
              });
              return m;
            })
        : Promise.resolve(new Map()),
    ]);

    return messages.map((msg) => ({
      ...msg,
      reply_to: msg.reply_to_id ? replyMap.get(msg.reply_to_id) ?? null : null,
      post: msg.post_id ? postMap.get(msg.post_id) ?? null : null,
    }));
  },
);

// -----------------------------------------------------------------------------
// getOlderMessages — Cursor-basierter Load für Scroll-Up-Infinite-Scroll.
//
// Lädt Messages mit created_at < `before` (ISO-Timestamp der ältesten aktuell
// sichtbaren Message). +1-Trick für hasMore-Detection ohne Extra-Count-Query.
// Nicht mit React.cache() — Cursor-Queries sind per Request frisch und würden
// mit falschen Params gecacht werden.
// -----------------------------------------------------------------------------

const OLDER_MESSAGES_PAGE = 40;

export async function getOlderMessages(
  conversationId: string,
  before: string,
  limit = OLDER_MESSAGES_PAGE,
): Promise<{ messages: MessageWithContext[]; hasMore: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { messages: [], hasMore: false };

  // +1 um zu prüfen ob es noch ältere gibt, ohne COUNT-Query.
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .lt('created_at', before)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (error || !data) return { messages: [], hasMore: false };

  const hasMore = data.length > limit;
  const rows = (hasMore ? data.slice(0, limit) : data).reverse() as MessageRow[];

  // Reply-Targets + Posts nachladen — gleiche Logik wie getConversationMessages.
  const replyIds = rows.map((m) => m.reply_to_id).filter((x): x is string => !!x);
  const postIds  = rows.map((m) => m.post_id).filter((x): x is string => !!x);

  const [replyMap, postMap] = await Promise.all([
    replyIds.length > 0
      ? supabase
          .from('messages')
          .select('id, sender_id, content, image_url')
          .in('id', replyIds)
          .then(({ data: d }) => new Map((d ?? []).map((r) => [r.id, r])))
      : Promise.resolve(new Map()),
    postIds.length > 0
      ? supabase
          .from('posts')
          .select('id, video_url:media_url, thumbnail_url, caption, author:profiles!posts_author_id_fkey(username)')
          .in('id', postIds)
          .then(({ data: d }) => {
            const m = new Map<string, MessageWithContext['post']>();
            (d ?? []).forEach((p) => {
              const author = Array.isArray(p.author) ? p.author[0] : p.author;
              m.set(p.id, {
                id: p.id,
                video_url: (p as { video_url?: string | null }).video_url ?? null,
                thumbnail_url: p.thumbnail_url ?? null,
                caption: p.caption ?? null,
                author_username: (author as { username?: string } | null)?.username ?? null,
              });
            });
            return m;
          })
      : Promise.resolve(new Map()),
  ]);

  const messages = rows.map((msg) => ({
    ...msg,
    reply_to: msg.reply_to_id ? (replyMap.get(msg.reply_to_id) ?? null) : null,
    post:     msg.post_id     ? (postMap.get(msg.post_id)      ?? null) : null,
  }));

  return { messages, hasMore };
}

// -----------------------------------------------------------------------------
// getConversationReactions — Reactions für die initial geladenen Messages.
// Gruppiert nach (message_id, emoji), zählt Rows und flaggt `by_me`.
// -----------------------------------------------------------------------------

export const getConversationReactions = cache(
  async (conversationId: string): Promise<ReactionAggregate[]> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Reactions können nur auf Messages in dieser Conversation sein, also
    // joinen wir auf messages und filtern.
    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji, messages!inner(conversation_id)')
      .eq('messages.conversation_id', conversationId);

    if (error || !data) return [];

    // Aggregation (message_id, emoji) → { count, by_me }
    const agg = new Map<string, { count: number; by_me: boolean }>();
    for (const row of data as Array<{ message_id: string; user_id: string; emoji: string }>) {
      const key = `${row.message_id}|${row.emoji}`;
      const curr = agg.get(key) ?? { count: 0, by_me: false };
      curr.count += 1;
      if (row.user_id === user.id) curr.by_me = true;
      agg.set(key, curr);
    }

    return Array.from(agg.entries()).map(([key, val]) => {
      const [message_id, emoji] = key.split('|');
      return { message_id, emoji, count: val.count, by_me: val.by_me };
    });
  },
);

// -----------------------------------------------------------------------------
// getUnreadDMCount — Summe über alle Conversations für den Navbar-Badge.
// Wird von Sidebar-Badge genutzt.
// -----------------------------------------------------------------------------

export const getUnreadDMCount = cache(async (): Promise<number> => {
  const conversations = await getConversations();
  return conversations.reduce((sum, c) => sum + c.unread_count, 0);
});

// -----------------------------------------------------------------------------
// getProductShareContext — Für `/messages/[id]?productId=…` (Shop-Chat-Button
// Deeplink, gespiegelt von v1.26.5 Native). Lädt Minimal-Felder zum Rendern
// einer Product-Share-Card in der Composer-Bar, damit der User nur noch
// "Senden" klicken muss.
// -----------------------------------------------------------------------------

export interface ProductShareContext {
  id: string;
  title: string;
  cover_url: string | null;
  price_coins: number;
  sale_price_coins: number | null;
  seller_username: string;
}

export const getProductShareContext = cache(
  async (productId: string): Promise<ProductShareContext | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('products')
      .select(
        'id, title, cover_url, price_coins, sale_price_coins, seller:profiles!products_seller_id_fkey(username)',
      )
      .eq('id', productId)
      .maybeSingle();

    if (!data) return null;
    const seller = Array.isArray(data.seller) ? data.seller[0] : data.seller;
    return {
      id: data.id,
      title: data.title,
      cover_url: data.cover_url ?? null,
      price_coins: data.price_coins,
      sale_price_coins: data.sale_price_coins ?? null,
      seller_username: seller?.username ?? '',
    };
  },
);
