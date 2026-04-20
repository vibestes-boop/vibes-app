export interface Gift {
  id: string;
  name: string;
  emoji: string;
  coinCost: number;
  lottieUrl: string | null;
  tier: 'common' | 'rare' | 'epic' | 'legendary';
  season?: string | null;
}

export interface SentGift {
  id: string;
  session_id: string;
  sender_id: string;
  receiver_id: string;
  gift_id: string;
  coin_cost: number;
  combo_count: number;
  created_at: string;
}
