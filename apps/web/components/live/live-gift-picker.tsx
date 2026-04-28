'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { createBrowserClient } from '@supabase/ssr';
import { X, Coins, Loader2 } from 'lucide-react';
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
//  • Battle-Mode: 🔴 HOST / 🔵 GUEST team picker (TikTok-style colored pills)
//    After a successful gift, broadcasts battle-gift event via store's sendBattleGift.
// -----------------------------------------------------------------------------

interface GiftCatalogRow {
  id: string;
  name: string;
  coin_cost: number;
  image_url: string | null;
  animation_url: string | null;
  season: string | null;
  active: boolean;
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
      const [catalogRes, balanceRes] = await Promise.all([
        supabase
          .from('live_gift_catalog')
          .select('id, name, coin_cost, image_url, animation_url, season, active')
          .eq('active', true)
          .order('coin_cost', { ascending: true }),
        supabase.rpc('get_my_coin_balance'),
      ]);

      if (catalogRes.data) setGifts(catalogRes.data as GiftCatalogRow[]);
      if (typeof balanceRes.data === 'number') setBalance(balanceRes.data);
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Geschenk senden</h2>
          <div className="flex items-center gap-3">
            {balance !== null && (
              <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                <Coins className="h-4 w-4 text-amber-500" />
                {balance.toLocaleString('de-DE')}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 hover:bg-muted"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Battle team picker — 🔴/🔵 TikTok-style pills */}
        {isBattle && (
          <div className="flex items-center justify-center gap-2 border-b bg-black/5 px-4 py-2 dark:bg-white/5">
            <span className="text-[11px] font-medium text-muted-foreground">Team wählen:</span>
            <div className="inline-flex gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setBattleTeam('host')}
                className={`rounded-full px-3 py-1 transition-all ${
                  battleTeam === 'host'
                    ? 'bg-[#FF2D6D] text-white shadow-sm'
                    : 'border border-[#FF2D6D]/40 text-[#FF2D6D] hover:bg-[#FF2D6D]/10'
                }`}
              >
                🔴 {hostName}
              </button>
              <button
                type="button"
                onClick={() => setBattleTeam('guest')}
                className={`rounded-full px-3 py-1 transition-all ${
                  battleTeam === 'guest'
                    ? 'bg-[#00D4FF] text-black shadow-sm'
                    : 'border border-[#00D4FF]/40 text-[#00D4FF] hover:bg-[#00D4FF]/10'
                }`}
              >
                🔵 {activeCoHost?.profile?.username ?? 'Guest'}
              </button>
            </div>
          </div>
        )}

        {/* Recipient-Switch (nur bei CoHost ohne Battle) */}
        {showRecipientSwitch && (
          <div className="flex items-center justify-center gap-2 border-b px-4 py-2">
            <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setRecipient('host')}
                className={`rounded-full px-3 py-1 transition-colors ${
                  recipient === 'host' ? 'bg-background shadow' : 'text-muted-foreground'
                }`}
              >
                Host · {hostName}
              </button>
              <button
                type="button"
                onClick={() => setRecipient('cohost')}
                className={`rounded-full px-3 py-1 transition-colors ${
                  recipient === 'cohost' ? 'bg-background shadow' : 'text-muted-foreground'
                }`}
              >
                Guest
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : gifts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Keine Geschenke im Katalog.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
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
        <div className="border-t px-4 py-3">
          {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
          {sentFlash && (
            <p className="mb-2 text-xs font-semibold text-green-600 dark:text-green-400">
              Geschenk gesendet. Weiter antippen für Combo.
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {selected ? (
                <>
                  <span className="font-semibold text-foreground">{selected.name}</span> ·{' '}
                  <Coins className="inline h-3 w-3 text-amber-500" />{' '}
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
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
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
        selected ? 'border-primary bg-primary/10 shadow-md' : 'hover:border-muted-foreground/50'
      }`}
    >
      <div className="relative h-14 w-14 overflow-hidden">
        {gift.image_url ? (
          <Image
            src={gift.image_url}
            alt={gift.name}
            fill
            sizes="56px"
            className="object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted text-2xl">
            🎁
          </div>
        )}
      </div>
      <p className="line-clamp-1 w-full text-center text-[11px] font-medium">{gift.name}</p>
      <p className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
        <Coins className="h-2.5 w-2.5" />
        {gift.coin_cost.toLocaleString('de-DE')}
      </p>
    </button>
  );
}
