'use client';

import { useEffect, useState, useTransition } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CoinIcon } from '@/components/ui/coin-icon';
import { X, Loader2 } from 'lucide-react';
import { sendLiveGift } from '@/app/actions/live';
import type { ActiveCoHostSSR } from '@/lib/data/live';
import { useBattleStore } from './live-battle-store';
import type { BattleTeam } from './live-battle-store';

// -----------------------------------------------------------------------------
// LiveGiftPicker — v1.w.UI.181 (battle mode added)
//
// Recipient-Logik:
//  • Normal: Host = Recipient
//  • Mit 1 aktivem CoHost (non-battle): Auswahl Host | CoHost (segmented control)
//  • Battle-Mode: 🔴 HOST / 🔵 GUEST team picker (Short-Video-style colored pills)
//    After a successful gift, broadcasts battle-gift event via store's sendBattleGift.
// -----------------------------------------------------------------------------

interface GiftCatalogRow {
  id: string;
  name: string;
  coin_cost: number;
  emoji: string | null;
  lottie_url: string | null;
  color: string | null;
  season_tag: string | null;
  available_from: string | null;
  available_until: string | null;
}

const LOCAL_GIFT_VIDEO_URLS: Record<string, string> = {
  chechen_tower_premium: '/gifts/chechen_tower_premium.mp4',
};

function getLocalGiftVideoUrl(giftId: string): string | null {
  return LOCAL_GIFT_VIDEO_URLS[giftId] ?? null;
}

export interface LiveGiftPickerProps {
  sessionId: string;
  hostId: string;
  hostName: string;
  cohosts: ActiveCoHostSSR[];
  onClose: () => void;
}

export function LiveGiftPicker({
  sessionId,
  hostId,
  hostName,
  cohosts,
  onClose,
}: LiveGiftPickerProps) {
  const [gifts, setGifts] = useState<GiftCatalogRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<'host' | 'cohost'>('host');
  const [battleTeam, setBattleTeam] = useState<BattleTeam>('host');
  const [error, setError] = useState<string | null>(null);
  const [sentFlash, setSentFlash] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { isBattle, sendBattleGift } = useBattleStore();
  const activeCoHost = cohosts[0] ?? null;
  const showRecipientSwitch = Boolean(activeCoHost) && !isBattle;

  // -----------------------------------------------------------------------------
  // Katalog + Balance laden
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    async function load() {
      const [catalogRes, authRes] = await Promise.all([
        supabase
          .from('gift_catalog')
          .select('id, name, emoji, lottie_url, coin_cost, color, season_tag, available_from, available_until')
          .order('sort_order', { ascending: true })
          .order('coin_cost', { ascending: true }),
        supabase.auth.getUser(),
      ]);

      if (catalogRes.data) {
        const now = Date.now();
        setGifts(
          (catalogRes.data as GiftCatalogRow[]).filter((gift) => {
            const startsAt = gift.available_from ? Date.parse(gift.available_from) : null;
            const endsAt = gift.available_until ? Date.parse(gift.available_until) : null;
            return (startsAt === null || startsAt <= now) && (endsAt === null || endsAt > now);
          }),
        );
      }

      const userId = authRes.data.user?.id;
      if (!userId) {
        setBalance(0);
        setLoading(false);
        return;
      }

      const { data: wallet, error: walletErr } = await supabase
        .from('coins_wallets')
        .select('coins')
        .eq('user_id', userId)
        .maybeSingle();

      if (walletErr) {
        console.warn('[LiveGiftPicker] coin balance unavailable', walletErr);
      }
      setBalance(typeof wallet?.coins === 'number' ? wallet.coins : 0);
      setLoading(false);
    }
    load();
  }, []);

  // -----------------------------------------------------------------------------
  // Send-Handler
  // -----------------------------------------------------------------------------
  const handleSend = () => {
    if (!selectedId) return;
    setError(null);
    const gift = gifts.find((g) => g.id === selectedId);
    if (!gift) return;

    // Battle mode: recipient = the chosen team's user id
    const recipientId = isBattle
      ? (battleTeam === 'guest' && activeCoHost ? activeCoHost.user_id : hostId)
      : (recipient === 'cohost' && activeCoHost ? activeCoHost.user_id : hostId);

    startTransition(async () => {
      const result = await sendLiveGift(sessionId, recipientId, selectedId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBalance(result.data.newBalance);
      window.dispatchEvent(
        new CustomEvent('serlo:live-gift-sent', {
          detail: {
            sessionId,
            giftLogId: result.data.giftLogId,
            giftId: gift.id,
            senderName: 'Du',
            giftName: gift.name,
            giftEmoji: gift.emoji,
            giftLottieUrl: gift.lottie_url,
            giftVideoUrl: getLocalGiftVideoUrl(gift.id),
            coinCost: gift.coin_cost,
          },
        }),
      );
      // Broadcast battle-gift score event
      if (isBattle && sendBattleGift) {
        sendBattleGift(battleTeam, gift.coin_cost);
      }
      setSentFlash(true);
      window.setTimeout(() => setSentFlash(false), 1200);
    });
  };

  const selected = gifts.find((g) => g.id === selectedId);
  const canAfford = selected && balance !== null ? balance >= selected.coin_cost : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 xl:items-end xl:bg-black/20 xl:p-6 xl:pb-28"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:rounded-2xl xl:max-h-[620px] xl:max-w-[520px] xl:rounded-[18px] xl:border-white/10 xl:bg-[#3e352d]/95 xl:text-white xl:shadow-[0_22px_70px_rgba(0,0,0,0.38)] xl:backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 xl:border-white/10">
          <div>
            <h2 className="text-base font-semibold">Geschenk senden</h2>
            <p className="mt-0.5 hidden text-xs text-white/55 xl:block">
              Wähle ein Gift und unterstütze den Stream direkt.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {balance !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm tabular-nums xl:bg-white/10">
                <CoinIcon className="h-4 w-4 text-amber-500" />
                {balance.toLocaleString('de-DE')}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 hover:bg-muted xl:hover:bg-white/10"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Battle team picker — 🔴/🔵 Short-Video-style pills */}
        {isBattle && (
          <div className="flex items-center justify-center gap-2 border-b bg-black/5 px-4 py-2 dark:bg-white/5 xl:border-white/10 xl:bg-white/[0.04]">
            <span className="text-[11px] font-medium text-muted-foreground xl:text-white/55">Team wählen:</span>
            <div className="inline-flex gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setBattleTeam('host')}
                className={`rounded-full px-3 py-1 transition-all ${
                  battleTeam === 'host'
                    ? 'bg-battle-host text-white shadow-sm'
                    : 'border border-battle-host/40 text-battle-host hover:bg-battle-host/10'
                }`}
              >
                🔴 {hostName}
              </button>
              <button
                type="button"
                onClick={() => setBattleTeam('guest')}
                className={`rounded-full px-3 py-1 transition-all ${
                  battleTeam === 'guest'
                    ? 'bg-battle-guest text-black shadow-sm'
                    : 'border border-battle-guest/40 text-battle-guest hover:bg-battle-guest/10'
                }`}
              >
                🔵 {activeCoHost?.profile?.username ?? 'Guest'}
              </button>
            </div>
          </div>
        )}

        {/* Recipient-Switch (nur bei CoHost ohne Battle) */}
        {showRecipientSwitch && (
          <div className="flex items-center justify-center gap-2 border-b px-4 py-2 xl:border-white/10">
            <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs font-medium xl:border-white/10 xl:bg-white/10">
              <button
                type="button"
                onClick={() => setRecipient('host')}
                className={`rounded-full px-3 py-1 transition-colors ${
                  recipient === 'host' ? 'bg-background shadow xl:bg-white xl:text-[#2f261f]' : 'text-muted-foreground xl:text-white/60'
                }`}
              >
                Host · {hostName}
              </button>
              <button
                type="button"
                onClick={() => setRecipient('cohost')}
                className={`rounded-full px-3 py-1 transition-colors ${
                  recipient === 'cohost' ? 'bg-background shadow xl:bg-white xl:text-[#2f261f]' : 'text-muted-foreground xl:text-white/60'
                }`}
              >
                Guest
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 xl:p-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground xl:text-white/55">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : gifts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground xl:text-white/55">
              Keine Geschenke im Katalog.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-4">
              {gifts.map((gift) => (
                <GiftCard
                  key={gift.id}
                  gift={gift}
                  selected={gift.id === selectedId}
                  onSelect={() => setSelectedId(gift.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 xl:border-white/10">
          {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
          {sentFlash && (
            <p className="mb-2 text-xs font-semibold text-green-600 dark:text-green-400">
              Geschenk gesendet. Weiter antippen für Combo.
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground xl:text-white/55">
              {selected ? (
                <>
                  <span className="font-semibold text-foreground xl:text-white">{selected.name}</span> ·{' '}
                  <CoinIcon className="inline h-3 w-3 text-amber-500" />{' '}
                  {selected.coin_cost.toLocaleString('de-DE')}
                </>
              ) : (
                'Wähle ein Geschenk.'
              )}
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!selected || !canAfford || isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 xl:min-w-28 xl:justify-center"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : !canAfford && selected ? (
                'Zu wenig Coins'
              ) : (
                'Senden'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// GiftCard
// -----------------------------------------------------------------------------

function GiftCard({
  gift,
  selected,
  onSelect,
}: {
  gift: GiftCatalogRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col items-center gap-1 rounded-xl border p-2 transition-all ${
        selected
          ? 'border-primary bg-primary/10 shadow-md xl:border-battle-host xl:bg-battle-host/[0.14]'
          : 'hover:border-muted-foreground/50 xl:border-white/10 xl:bg-white/[0.06] xl:hover:border-white/25 xl:hover:bg-white/[0.09]'
      }`}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-lg text-3xl"
        style={{ backgroundColor: gift.color ? `${gift.color}18` : undefined }}
      >
        <span aria-hidden="true">{gift.emoji ?? '🎁'}</span>
      </div>
      <p className="line-clamp-1 w-full text-center text-[11px] font-medium xl:text-white/90">{gift.name}</p>
      <p className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400 xl:text-amber-300">
        <CoinIcon className="h-2.5 w-2.5" />
        {gift.coin_cost.toLocaleString('de-DE')}
      </p>
    </button>
  );
}
