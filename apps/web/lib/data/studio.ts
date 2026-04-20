import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Studio-Data-Layer — SSR-Reads für `/studio/*` (Creator-Dashboard).
//
// Design:
//  1. Cross-Platform-Parität: Delegiert wo möglich an Native-RPCs aus
//     `creator_analytics.sql` + `creator_earnings.sql` + `creator_studio_pro.sql`.
//  2. Periodenauswahl via `period` = 7 | 28 | 90 Tage. Native nutzt dieselben
//     Werte als Tabs — die UI-Texte (7T/28T/90T) sind konsistent.
//  3. RPC-Fallback: Wenn ein Creator-RPC fehlt (z.B. in Staging), loggen wir
//     silent und returnen leeres Objekt statt die ganze Seite zu kippen. Das
//     ist wichtig weil /studio ein Composite-Dashboard ist und eine kaputte
//     Metric nicht alle anderen mitreißen soll.
//  4. KEINE Write-Hooks — nur Reads. Mutations landen in Server-Actions
//     (`app/actions/studio.ts`) für moderation + payout-stubs.
// -----------------------------------------------------------------------------

export type Period = 7 | 28 | 90;

// -----------------------------------------------------------------------------
// Overview — KPI-Cards für /studio
// -----------------------------------------------------------------------------

export interface CreatorOverview {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalFollowers: number;
  newFollowers: number;
  prevViews: number;
  prevLikes: number;
  prevComments: number;
  prevFollowers: number;
}

export const getCreatorOverview = cache(
  async (period: Period = 28): Promise<CreatorOverview | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.rpc('get_creator_overview', {
      p_user_id: user.id,
      p_days: period,
    });
    if (error || !data || !Array.isArray(data) || data.length === 0) return null;

    const r = data[0] as {
      total_views?: number;
      total_likes?: number;
      total_comments?: number;
      total_followers?: number;
      new_followers?: number;
      prev_views?: number;
      prev_likes?: number;
      prev_comments?: number;
      prev_followers?: number;
    };
    return {
      totalViews: Number(r.total_views ?? 0),
      totalLikes: Number(r.total_likes ?? 0),
      totalComments: Number(r.total_comments ?? 0),
      totalFollowers: Number(r.total_followers ?? 0),
      newFollowers: Number(r.new_followers ?? 0),
      prevViews: Number(r.prev_views ?? 0),
      prevLikes: Number(r.prev_likes ?? 0),
      prevComments: Number(r.prev_comments ?? 0),
      prevFollowers: Number(r.prev_followers ?? 0),
    };
  },
);

// -----------------------------------------------------------------------------
// Earnings — Diamanten-Balance + Top-Gift + Top-Supporter
// -----------------------------------------------------------------------------

export interface CreatorEarnings {
  diamondsBalance: number;
  totalGifted: number;
  periodGifts: number;
  periodDiamonds: number;
  topGiftName: string | null;
  topGiftEmoji: string | null;
  topGifterName: string | null;
}

export const getCreatorEarnings = cache(
  async (period: Period = 28): Promise<CreatorEarnings | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.rpc('get_creator_earnings', {
      p_user_id: user.id,
      p_days: period,
    });
    if (error || !data || !Array.isArray(data) || data.length === 0) return null;

    const r = data[0] as {
      diamonds_balance?: number;
      total_gifted?: number;
      period_gifts?: number;
      period_diamonds?: number;
      top_gift_name?: string | null;
      top_gift_emoji?: string | null;
      top_gifter_name?: string | null;
    };
    return {
      diamondsBalance: Number(r.diamonds_balance ?? 0),
      totalGifted: Number(r.total_gifted ?? 0),
      periodGifts: Number(r.period_gifts ?? 0),
      periodDiamonds: Number(r.period_diamonds ?? 0),
      topGiftName: r.top_gift_name ?? null,
      topGiftEmoji: r.top_gift_emoji ?? null,
      topGifterName: r.top_gifter_name ?? null,
    };
  },
);

// -----------------------------------------------------------------------------
// Top-Posts — Best-Performing Posts im Zeitraum
// -----------------------------------------------------------------------------

export interface TopPost {
  postId: string;
  caption: string | null;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  rank: number;
}

export const getCreatorTopPosts = cache(
  async (sort: 'views' | 'likes' | 'comments' = 'views', limit = 10): Promise<TopPost[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_creator_top_posts', {
      p_user_id: user.id,
      p_sort: sort,
      p_limit: limit,
    });
    if (error || !data) return [];

    return (data as Array<Record<string, unknown>>).map((r) => ({
      postId: String(r.post_id),
      caption: (r.caption as string | null) ?? null,
      mediaUrl: (r.media_url as string | null) ?? null,
      mediaType: (r.media_type as 'image' | 'video' | null) ?? null,
      thumbnailUrl: (r.thumbnail_url as string | null) ?? null,
      viewCount: Number(r.view_count ?? 0),
      likeCount: Number(r.like_count ?? 0),
      commentCount: Number(r.comment_count ?? 0),
      createdAt: String(r.created_at),
      rank: Number(r.rank ?? 0),
    }));
  },
);

// -----------------------------------------------------------------------------
// Follower-Growth — Tages-Granularität für Line-Chart
// -----------------------------------------------------------------------------

export interface FollowerGrowthPoint {
  day: string;
  newFollowers: number;
}

export const getFollowerGrowth = cache(
  async (period: Period = 28): Promise<FollowerGrowthPoint[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_creator_follower_growth', {
      p_user_id: user.id,
      p_days: period,
    });
    if (error || !data) return [];

    return (data as Array<{ day: string; new_followers: number }>).map((r) => ({
      day: String(r.day),
      newFollowers: Number(r.new_followers ?? 0),
    }));
  },
);

// -----------------------------------------------------------------------------
// Peak-Hours — 7×24 Heatmap (weekday × hour_of_day × engagement_count)
// -----------------------------------------------------------------------------

export interface PeakHoursCell {
  weekday: number; // 0=Mo, 6=So (Native-Konvention)
  hour: number; // 0..23 UTC
  engagement: number;
}

export const getPeakHours = cache(
  async (period: Period = 28): Promise<PeakHoursCell[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_creator_engagement_hours', {
      p_user_id: user.id,
      p_days: period,
    });
    if (error || !data) return [];

    return (data as Array<{ weekday: number; hour_of_day: number; engagement_count: number }>).map(
      (r) => ({
        weekday: Number(r.weekday ?? 0),
        hour: Number(r.hour_of_day ?? 0),
        engagement: Number(r.engagement_count ?? 0),
      }),
    );
  },
);

// -----------------------------------------------------------------------------
// Watch-Time — Estimate (Views × 8s Schätzung, wie Native)
// -----------------------------------------------------------------------------

export interface WatchTimeEstimate {
  totalSecondsEst: number;
  totalViews: number;
  avgSecondsPerView: number;
}

export const getWatchTime = cache(
  async (period: Period = 28): Promise<WatchTimeEstimate | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.rpc('get_creator_watch_time_estimate', {
      p_user_id: user.id,
      p_days: period,
    });
    if (error || !data || !Array.isArray(data) || data.length === 0) return null;

    const r = data[0] as {
      total_seconds_est?: number;
      total_views?: number;
      avg_seconds_per_view?: number;
    };
    return {
      totalSecondsEst: Number(r.total_seconds_est ?? 0),
      totalViews: Number(r.total_views ?? 0),
      avgSecondsPerView: Number(r.avg_seconds_per_view ?? 8),
    };
  },
);

// -----------------------------------------------------------------------------
// Gift-History — Letzte N empfangene Gifts
// -----------------------------------------------------------------------------

export interface GiftHistoryRow {
  giftName: string;
  giftEmoji: string;
  diamondValue: number;
  senderName: string | null;
  senderAvatar: string | null;
  createdAt: string;
}

export const getCreatorGiftHistory = cache(
  async (limit = 20): Promise<GiftHistoryRow[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_creator_gift_history', {
      p_user_id: user.id,
      p_limit: limit,
    });
    if (error || !data) return [];

    return (data as Array<Record<string, unknown>>).map((r) => ({
      giftName: String(r.gift_name ?? ''),
      giftEmoji: String(r.gift_emoji ?? ''),
      diamondValue: Number(r.diamond_value ?? 0),
      senderName: (r.sender_name as string | null) ?? null,
      senderAvatar: (r.sender_avatar as string | null) ?? null,
      createdAt: String(r.created_at),
    }));
  },
);

// -----------------------------------------------------------------------------
// Shop-Revenue — Aggregiert aus `orders` (seller-role). Für /studio/revenue
// nutzen wir die Raw-Orders plus Analytics-Summary.
// -----------------------------------------------------------------------------

export interface ShopRevenueSummary {
  totalOrders: number;
  completedOrders: number;
  totalCoinsEarned: number;
  pendingCoins: number;
  refundedCoins: number;
  uniqueBuyers: number;
}

export interface ShopOrderRow {
  id: string;
  createdAt: string;
  status: string;
  productTitle: string | null;
  totalCoins: number;
  quantity: number;
  buyerUsername: string | null;
}

/** Aggregiert Shop-Orders des Sellers im gewählten Zeitraum (days) */
export const getShopRevenue = cache(
  async (period: Period = 28): Promise<ShopRevenueSummary> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        totalOrders: 0,
        completedOrders: 0,
        totalCoinsEarned: 0,
        pendingCoins: 0,
        refundedCoins: 0,
        uniqueBuyers: 0,
      };
    }

    const sinceIso = new Date(Date.now() - period * 86_400_000).toISOString();

    const { data, error } = await supabase
      .from('orders')
      .select('id, buyer_id, total_coins, status, created_at')
      .eq('seller_id', user.id)
      .gte('created_at', sinceIso);

    if (error || !data) {
      return {
        totalOrders: 0,
        completedOrders: 0,
        totalCoinsEarned: 0,
        pendingCoins: 0,
        refundedCoins: 0,
        uniqueBuyers: 0,
      };
    }

    const buyers = new Set<string>();
    let completed = 0;
    let earned = 0;
    let pending = 0;
    let refunded = 0;

    for (const o of data) {
      buyers.add(o.buyer_id as string);
      const cost = Number(o.total_coins ?? 0);
      if (o.status === 'completed') {
        completed += 1;
        earned += cost;
      } else if (o.status === 'pending') {
        pending += cost;
      } else if (o.status === 'refunded') {
        refunded += cost;
      }
    }

    return {
      totalOrders: data.length,
      completedOrders: completed,
      totalCoinsEarned: earned,
      pendingCoins: pending,
      refundedCoins: refunded,
      uniqueBuyers: buyers.size,
    };
  },
);

/** Letzte N Shop-Orders des Sellers mit Produkt-Titel + Buyer-Username — für Tabelle + CSV-Export */
export const getShopOrdersDetailed = cache(
  async (period: Period = 28, limit = 200): Promise<ShopOrderRow[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const sinceIso = new Date(Date.now() - period * 86_400_000).toISOString();

    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, created_at, status, total_coins, quantity, buyer:profiles!orders_buyer_id_fkey(username), product:products(title)',
      )
      .eq('seller_id', user.id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((r) => {
      const buyerRaw = r.buyer;
      const productRaw = r.product;
      const buyer = Array.isArray(buyerRaw) ? buyerRaw[0] : buyerRaw;
      const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;
      return {
        id: String(r.id),
        createdAt: String(r.created_at),
        status: String(r.status ?? ''),
        productTitle: (product?.title as string | null) ?? null,
        totalCoins: Number(r.total_coins ?? 0),
        quantity: Number(r.quantity ?? 1),
        buyerUsername: (buyer?.username as string | null) ?? null,
      };
    });
  },
);

// -----------------------------------------------------------------------------
// Live-Sessions-Historie — Für /studio/live bereits vorhanden. Wir re-
// exportieren hier nur einen Counter für die Dashboard-Cards.
// -----------------------------------------------------------------------------

export const getMyLiveSessionsCount = cache(async (period: Period = 28): Promise<number> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const sinceIso = new Date(Date.now() - period * 86_400_000).toISOString();
  const { count } = await supabase
    .from('live_sessions')
    .select('id', { head: true, count: 'exact' })
    .eq('host_id', user.id)
    .gte('started_at', sinceIso);

  return count ?? 0;
});

// -----------------------------------------------------------------------------
// Scheduled + Drafts Counters — für Dashboard-Row
// -----------------------------------------------------------------------------

export const getMyScheduledCount = cache(async (): Promise<{ pending: number; failed: number }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { pending: 0, failed: 0 };

  const [pRes, fRes] = await Promise.all([
    supabase
      .from('scheduled_posts')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'pending'),
    supabase
      .from('scheduled_posts')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'failed'),
  ]);

  return {
    pending: pRes.count ?? 0,
    failed: fRes.count ?? 0,
  };
});

export const getMyDraftsCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from('post_drafts')
    .select('id', { head: true, count: 'exact' });

  return count ?? 0;
});
