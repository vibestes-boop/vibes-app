/**
 * components/live/GiftPicker.tsx
 *
 * Premium Bottom-Sheet: Geschenk-Auswahl während eines Livestreams.
 * Unterstützt Light & Dark Mode. Coin-Balance + Katalog + Senden.
 */

import React, { memo, useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
  Image as RNImage,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCoins, RARITY_META, type GiftItem, type GiftRarity } from '@/lib/gifts';
import { Sparkles } from 'lucide-react-native';
import { useCoinsWallet, useSendGift } from '@/lib/useGifts';
import { useGiftCatalog } from '@/lib/useGiftCatalog';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Lottie optional — nur in Dev Build verfügbar
let LottieView: React.ComponentType<{ source: object; autoPlay: boolean; loop: boolean; style: object }> | null = null;
try { LottieView = require('lottie-react-native').default; } catch (_) {}

interface GiftPickerProps {
  visible:        boolean;
  onClose:        () => void;
  recipientId:    string;
  recipientName:  string;
  liveSessionId:  string;
  /** channelRef aus useGiftStream — PFLICHT für Broadcast! */
  channelRef:     React.MutableRefObject<RealtimeChannel | null>;
  onGiftSent?:    (giftId: string) => void;
  initialCoins?:  number;
  /** Wenn gesetzt: Battle-Modus — User wählt zwischen Host/Guest-Team vor dem Senden.
   *  Das Geschenk geht an die gewählte Partei, Coins werden via onBattleGift
   *  in die jeweilige Battle-Score einbezahlt. */
  battleMode?: {
    hostId:        string;
    hostName:      string;
    coHostId:      string;
    coHostName:    string;
    /** Callback — wird nach erfolgreichem Versand aufgerufen, triggert
     *  sendBattleGift(team, coins) aus useBattle. */
    onBattleGift: (team: 'host' | 'guest', coins: number) => void;
  };
  /** v1.27.1 — Regulärer Duet-Modus (nicht Battle): CoHost ist aktiv im Frame,
   *  Viewer soll zwischen Host und CoHost als Empfänger wählen können.
   *  Unterschied zu battleMode: kein Score-Split, kein Kampf-Styling — dezente
   *  Pills mit @-Handles, Header bleibt "Geschenke". Wenn battleMode UND
   *  duetMode beide gesetzt sind, gewinnt battleMode (mutually exclusive by
   *  convention in watch/[id].tsx). */
  duetMode?: {
    hostId:        string;
    hostName:      string;
    coHostId:      string;
    coHostName:    string;
  };
}

// ─── Gift Card ───────────────────────────────────────────────────────────────

/**
 * GiftCard
 *
 * Perf:
 *  - `memo`: Parent-Renders überspringen (Coin-Ticks, Filter-Wechsel triggern
 *    sonst ein volles Re-Render aller Karten).
 *  - Stabile `onSelect(gift)`-Signatur statt per-Item-Closure im Parent — die
 *    Row bindet das `gift` intern via useCallback, dadurch bleibt die
 *    `onPress`-Prop referentiell identisch.
 *  - Lottie loopt NUR für die ausgewählte Karte; andere Karten spielen die
 *    Animation einmal ab und frieren ein (massive GPU-Einsparung bei 20+
 *    sichtbaren Karten mit Lottie-Assets gleichzeitig).
 */
function GiftCardComponent({
  gift,
  selected,
  canAfford,
  onSelect,
  isDark,
}: {
  gift: GiftItem;
  selected: boolean;
  canAfford: boolean;
  onSelect: (gift: GiftItem) => void;
  isDark: boolean;
}) {
  const accent = gift.color ?? '#f59e0b';
  const rarity = gift.rarity ?? 'common';
  const rarityMeta = RARITY_META[rarity];
  const hasGlow    = rarity !== 'common';

  const handlePress = useCallback(() => {
    if (!canAfford) return;
    onSelect(gift);
  }, [canAfford, onSelect, gift]);

  return (
    <Pressable
      onPress={canAfford ? handlePress : undefined}
      style={({ pressed }) => [
        card.wrap,
        isDark ? card.wrapDark : card.wrapLight,
        // v1.17.0: Rarity-Border überschreibt den Default, wenn nicht "common"
        hasGlow && {
          borderColor: rarityMeta.border,
          shadowColor: rarityMeta.glow,
          shadowOpacity: 0.9,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        },
        selected && { borderColor: accent, backgroundColor: isDark ? `${accent}22` : `${accent}14` },
        !canAfford && card.disabled,
        pressed && canAfford && { opacity: 0.75, transform: [{ scale: 0.96 }] },
      ]}
    >
      {/* v1.17.0: Season-Badge (top-left) wenn Gift ein season_tag hat */}
      {gift.seasonTag && (
        <View style={card.seasonBadge} pointerEvents="none">
          <Sparkles size={9} color="#fff" strokeWidth={2.4} />
        </View>
      )}

      {/* Gift Visual */}
      <View style={card.visual}>
        {LottieView && gift.lottieAsset ? (
          <LottieView
            source={gift.lottieAsset as object}
            autoPlay
            loop={selected}
            style={card.lottie}
          />
        ) : gift.imageAsset ? (
          <RNImage source={gift.imageAsset} style={card.image} resizeMode="contain" />
        ) : (
          <Text style={card.emoji}>{gift.emoji}</Text>
        )}
      </View>

      {/* Name */}
      <Text
        style={[card.name, isDark ? card.nameDark : card.nameLight]}
        numberOfLines={1}
      >
        {gift.name}
      </Text>

      {/* Cost */}
      <View style={card.costRow}>
        <Text style={card.coinGlyph}>🪙</Text>
        <Text style={[card.cost, !canAfford && card.costLow]}>
          {formatCoins(gift.coinCost)}
        </Text>
      </View>

      {/* Selected ring */}
      {selected && (
        <View style={[card.ring, { borderColor: accent }]} pointerEvents="none" />
      )}
    </Pressable>
  );
}

const GiftCard = memo(GiftCardComponent);

// ─── Rarity Filter Chip ──────────────────────────────────────────────────────

const RARITY_ORDER: GiftRarity[] = ['common', 'rare', 'epic', 'legendary'];

function RarityChip({
  rarity,
  active,
  onPress,
  isDark,
}: {
  rarity: 'all' | GiftRarity;
  active: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  const label = rarity === 'all' ? 'Alle' : RARITY_META[rarity].label;
  const glow  = rarity === 'all' ? (isDark ? '#fff' : '#000') : RARITY_META[rarity].border;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        card.chip,
        {
          backgroundColor: active
            ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)')
            : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
          borderColor: active ? glow : 'transparent',
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[card.chipText, { color: isDark ? '#fff' : '#111827' }]}>{label}</Text>
    </Pressable>
  );
}

// ─── GiftPicker ──────────────────────────────────────────────────────────────

export function GiftPicker({
  visible,
  onClose,
  recipientId,
  recipientName,
  liveSessionId,
  channelRef,
  onGiftSent,
  initialCoins,
  battleMode,
  duetMode,
}: GiftPickerProps) {
  const insets       = useSafeAreaInsets();
  const router       = useRouter();
  const scheme       = useColorScheme();
  const isDark       = scheme === 'dark';

  const { coins: walletCoins, loading: walletLoading, refetch } = useCoinsWallet();
  const coins    = (initialCoins !== undefined && initialCoins > 0) ? initialCoins : walletCoins;
  const { sendGift, isSending } = useSendGift();
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  // v1.27.1 — Recipient-Auswahl (vorher `battleTeam`): Host vs Guest.
  // Wird geteilt zwischen battleMode (Score-Split) und duetMode (reines Gifting).
  // Battle gewinnt bei gleichzeitigem Setzen (mutually exclusive by convention).
  const dualMode = battleMode ?? duetMode ?? null;
  const [recipientChoice, setRecipientChoice] = useState<'host' | 'guest'>('host');
  // v1.17.0: Rarity-Filter — default "all"
  const [rarityFilter, setRarityFilter] = useState<'all' | GiftRarity>('all');

  // v1.18.0: DB-backed Katalog (Saison + Rarity aus DB, Assets lokal gemerged).
  // Initial-Load zeigt lokalen Fallback bis die DB-Antwort da ist.
  const { catalog: activeCatalog } = useGiftCatalog();

  const filteredCatalog = React.useMemo(() => {
    if (rarityFilter === 'all') return activeCatalog;
    return activeCatalog.filter((g) => (g.rarity ?? 'common') === rarityFilter);
  }, [activeCatalog, rarityFilter]);

  const seasonGifts = React.useMemo(
    () => activeCatalog.filter((g) => !!g.seasonTag),
    [activeCatalog],
  );

  // v1.27.1 — Wenn CoHost mid-picker die Session verlässt (dualMode wird null),
  // fällt die Auswahl sauber zurück auf 'host', damit ein noch-nicht-gesendetes
  // Gift nicht an eine tote userId geht.
  React.useEffect(() => {
    if (!dualMode && recipientChoice !== 'host') {
      setRecipientChoice('host');
    }
  }, [dualMode, recipientChoice]);

  // Effektiver Empfänger: in Battle/Duet-Modus nach Recipient-Choice, sonst default.
  const effectiveRecipientId   = dualMode ? (recipientChoice === 'host' ? dualMode.hostId   : dualMode.coHostId)   : recipientId;
  const effectiveRecipientName = dualMode ? (recipientChoice === 'host' ? dualMode.hostName : dualMode.coHostName) : recipientName;

  const handleSend = useCallback(async () => {
    if (!selectedGift || isSending) return;

    const result = await sendGift(effectiveRecipientId, liveSessionId, selectedGift.id, channelRef);

    if (result.success) {
      refetch();
      onGiftSent?.(selectedGift.id);
      // Battle-Scoring: NUR im echten battleMode Coins in Team-Score einzahlen.
      // Im duetMode wird kein Score geführt — Gift geht einfach an den gewählten
      // Empfänger, Punkt. Guard auf battleMode (nicht dualMode!) ist kritisch.
      if (battleMode) {
        battleMode.onBattleGift(recipientChoice, selectedGift.coinCost);
      }
      setSelectedGift(null);
      onClose();
    } else {
      const messages: Record<string, string> = {
        insufficient_coins:   `Nicht genug Coins. Du hast ${formatCoins(coins)}, benötigst ${formatCoins(selectedGift.coinCost)}.`,
        no_wallet:            'Wallet nicht gefunden. Bitte melde dich erneut an.',
        cannot_gift_yourself: 'Du kannst dir selbst keine Geschenke senden.',
        gift_not_found:       'Dieses Geschenk ist leider nicht verfügbar. Bitte starte die App neu.',
        gifts_disabled:       'Geschenke sind für diesen Stream deaktiviert.',
        network_error:        'Verbindungsfehler. Bitte versuche es erneut.',
      };
      const msg = messages[result.error] ?? (__DEV__ ? `Fehler: ${result.error}` : 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      // In DEV: echten Supabase-Error anhängen damit wir die Ursache sofort sehen
      const detailSuffix = __DEV__ && 'detail' in result && result.detail
        ? `\n\n[DEV] ${result.detail}`
        : '';
      Alert.alert('Fehler', msg + detailSuffix);
    }
  }, [selectedGift, isSending, sendGift, effectiveRecipientId, liveSessionId, channelRef, onGiftSent, refetch, coins, onClose, battleMode, recipientChoice]);

  const bg    = isDark ? '#0F0F14' : '#FFFFFF';
  const divBg = isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6';
  const handleBg = isDark ? 'rgba(255,255,255,0.16)' : '#D1D5DB';
  const titleClr = isDark ? '#FFFFFF' : '#111827';
  const subClr   = isDark ? 'rgba(255,255,255,0.45)' : '#6B7280';

  const hasSelection = !!selectedGift;
  const accent       = selectedGift?.color ?? '#f43f5e';

  // Stabile renderItem-Closure + stabile onSelect-Ref → `memo(GiftCard)`
  // überspringt Re-Renders aller Karten deren Props (selected/canAfford)
  // sich nicht verändert haben. Ohne das würde jeder Coin-Tick oder
  // Filter-Wechsel die gesamte Grid neu bauen (inkl. Lottie-Remount).
  const selectedId = selectedGift?.id ?? null;
  const renderGiftItem = useCallback(
    ({ item }: { item: GiftItem }) => (
      <GiftCard
        gift={item}
        selected={selectedId === item.id}
        canAfford={coins >= item.coinCost}
        onSelect={setSelectedGift}
        isDark={isDark}
      />
    ),
    [selectedId, coins, isDark],
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={s.backdrop}
        onPress={() => { setSelectedGift(null); onClose(); }}
      >
        <Pressable
          style={[s.sheet, { backgroundColor: bg, paddingBottom: insets.bottom + 16 }]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[s.handle, { backgroundColor: handleBg }]} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Text style={[s.title, { color: titleClr }]}>
                {battleMode ? '⚔️ Battle-Geschenk' : 'Geschenke'}
              </Text>
              <Text style={[s.subtitle, { color: subClr }]}>
                an @{effectiveRecipientName}
              </Text>
            </View>

            {/* Coin Balance */}
            <View style={s.balanceRow}>
              {walletLoading ? (
                <ActivityIndicator size="small" color="#f59e0b" />
              ) : (
                <View style={[s.balancePill, isDark ? s.balancePillDark : s.balancePillLight]}>
                  <Text style={s.balanceCoin}>🪙</Text>
                  <Text style={[s.balanceNum, { color: isDark ? '#FCD34D' : '#B45309' }]}>
                    {formatCoins(coins)}
                  </Text>
                </View>
              )}
              <Pressable
                style={[s.addBtn, isDark ? s.addBtnDark : s.addBtnLight]}
                onPress={() => { onClose(); setTimeout(() => router.push('/coin-shop'), 300); }}
              >
                <Text style={[s.addBtnText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                  + Coins
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Divider */}
          <View style={[s.divider, { backgroundColor: divBg }]} />

          {/* Battle Team Picker — nur im Battle-Modus, rot vs blau mit Flames */}
          {battleMode && (
            <View style={s.teamRow}>
              <Pressable
                style={[
                  s.teamPill,
                  { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2' },
                  recipientChoice === 'host' && s.teamPillActive,
                  recipientChoice === 'host' && { borderColor: '#EF4444' },
                ]}
                onPress={() => setRecipientChoice('host')}
              >
                <Text style={[
                  s.teamEmoji,
                  recipientChoice === 'host' && { transform: [{ scale: 1.15 }] },
                ]}>🔴</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.teamLabel, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>TEAM HOST</Text>
                  <Text
                    style={[s.teamName, { color: titleClr }]}
                    numberOfLines={1}
                  >@{battleMode.hostName}</Text>
                </View>
              </Pressable>
              <Pressable
                style={[
                  s.teamPill,
                  { backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#DBEAFE' },
                  recipientChoice === 'guest' && s.teamPillActive,
                  recipientChoice === 'guest' && { borderColor: '#3B82F6' },
                ]}
                onPress={() => setRecipientChoice('guest')}
              >
                <Text style={[
                  s.teamEmoji,
                  recipientChoice === 'guest' && { transform: [{ scale: 1.15 }] },
                ]}>🔵</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.teamLabel, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>TEAM GUEST</Text>
                  <Text
                    style={[s.teamName, { color: titleClr }]}
                    numberOfLines={1}
                  >@{battleMode.coHostName}</Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* v1.27.1 — Duet-Recipient-Picker (regulärer Duet, kein Battle).
              Dezentere Optik als Battle: keine Flames, keine aggressiven Farben.
              Segmented-Control-artig: nur Accent auf der aktiven Pille. */}
          {!battleMode && duetMode && (
            <View style={s.duetRow}>
              <Pressable
                style={[
                  s.duetPill,
                  {
                    backgroundColor: recipientChoice === 'host'
                      ? (isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6')
                      : (isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFA'),
                    borderColor: recipientChoice === 'host'
                      ? (isDark ? 'rgba(255,255,255,0.22)' : '#D1D5DB')
                      : 'transparent',
                  },
                ]}
                onPress={() => setRecipientChoice('host')}
              >
                <Text style={[
                  s.duetLabel,
                  { color: recipientChoice === 'host' ? titleClr : subClr },
                ]} numberOfLines={1}>@{duetMode.hostName}</Text>
                <Text style={[
                  s.duetSubLabel,
                  { color: recipientChoice === 'host' ? subClr : 'transparent' },
                ]}>Host</Text>
              </Pressable>
              <Pressable
                style={[
                  s.duetPill,
                  {
                    backgroundColor: recipientChoice === 'guest'
                      ? (isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6')
                      : (isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFA'),
                    borderColor: recipientChoice === 'guest'
                      ? (isDark ? 'rgba(255,255,255,0.22)' : '#D1D5DB')
                      : 'transparent',
                  },
                ]}
                onPress={() => setRecipientChoice('guest')}
              >
                <Text style={[
                  s.duetLabel,
                  { color: recipientChoice === 'guest' ? titleClr : subClr },
                ]} numberOfLines={1}>@{duetMode.coHostName}</Text>
                <Text style={[
                  s.duetSubLabel,
                  { color: recipientChoice === 'guest' ? subClr : 'transparent' },
                ]}>Guest</Text>
              </Pressable>
            </View>
          )}

          {/* v1.17.0: Saison-Karussell — nur sichtbar wenn aktive Season-Gifts existieren */}
          {seasonGifts.length > 0 && (
            <View style={card.seasonRow}>
              <View style={card.seasonHeader}>
                <Sparkles size={12} color="#10B981" strokeWidth={2.4} />
                <Text style={[card.seasonTitle, { color: isDark ? '#fff' : '#111827' }]}>
                  Saison
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
              >
                {seasonGifts.map((g) => (
                  <View key={g.id} style={{ width: 78 }}>
                    <GiftCard
                      gift={g}
                      selected={selectedGift?.id === g.id}
                      canAfford={coins >= g.coinCost}
                      onSelect={setSelectedGift}
                      isDark={isDark}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* v1.17.0: Rarity-Filter — "Alle" + 4 Stufen */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingVertical: 4 }}
          >
            {(['all', ...RARITY_ORDER] as const).map((r) => (
              <RarityChip
                key={r}
                rarity={r}
                active={rarityFilter === r}
                onPress={() => setRarityFilter(r)}
                isDark={isDark}
              />
            ))}
          </ScrollView>

          {/* Gift Grid */}
          <FlatList
            data={filteredCatalog}
            numColumns={4}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={s.grid}
            columnWrapperStyle={s.gridRow}
            renderItem={renderGiftItem}
          />

          {/* Send Button */}
          <Pressable
            onPress={handleSend}
            disabled={!hasSelection || isSending}
            style={[s.sendWrap, !hasSelection && s.sendWrapInactive]}
          >
            <LinearGradient
              colors={hasSelection ? [accent, shiftHue(accent, 20)] : [isDark ? '#1F2937' : '#E5E7EB', isDark ? '#1F2937' : '#E5E7EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.sendBtn}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : hasSelection ? (
                <Text style={s.sendBtnText}>
                  {selectedGift!.emoji}{'  '}Senden · 🪙 {formatCoins(selectedGift!.coinCost)}
                </Text>
              ) : (
                <Text style={[s.sendBtnText, { color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF' }]}>
                  Wähle ein Geschenk aus
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Hilfsfunktion: Hue leicht verschieben für Gradient-Effekt
function shiftHue(hex: string, amount: number): string {
  return hex; // Simplified: für Gradient reicht der gleiche Ton
}

// ─── Card StyleSheet ──────────────────────────────────────────────────────────

const card = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    margin: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  wrapDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  wrapLight: {
    backgroundColor: '#F9FAFB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  disabled: { opacity: 0.38 },
  visual: {
    width: 56, height: 56,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 5,
  },
  lottie: { width: 56, height: 56, backgroundColor: 'transparent' },
  image:  { width: 48, height: 48 },
  emoji:  { fontSize: 32 },
  name: { fontSize: 10, fontWeight: '600', textAlign: 'center', marginBottom: 3, lineHeight: 13 },
  nameDark:  { color: 'rgba(255,255,255,0.85)' },
  nameLight: { color: '#374151' },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  coinGlyph: { fontSize: 9 },
  cost: { color: '#f59e0b', fontSize: 10, fontWeight: '700' },
  costLow: { color: '#9CA3AF' },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  // v1.17.0: Season-Badge top-left auf GiftCard
  seasonBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  // v1.17.0: Season-Carousel-Header
  seasonRow: {
    marginTop: 4,
    marginBottom: 4,
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  seasonTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // v1.17.0: Rarity-Chip
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.2,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// ─── Sheet StyleSheet ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  // ─ Header ─
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: { gap: 1 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: '500' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  balancePillDark:  { backgroundColor: 'rgba(245,158,11,0.12)' },
  balancePillLight: { backgroundColor: '#FEF3C7' },
  balanceCoin: { fontSize: 13 },
  balanceNum: { fontSize: 13, fontWeight: '800' },
  addBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  addBtnDark:  { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.25)' },
  addBtnLight: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  addBtnText:  { fontSize: 12, fontWeight: '700' },
  // ─ Divider ─
  divider: { height: 1, marginBottom: 12, marginHorizontal: -16 },
  // ─ Battle Team Picker ─
  teamRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  teamPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  teamPillActive: {
    // Border-Farbe wird inline gesetzt (Team-spezifisch)
  },
  teamEmoji: { fontSize: 22 },
  teamLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 1 },
  teamName:  { fontSize: 13, fontWeight: '700' },
  // v1.27.1 — Duet-Recipient-Picker (nicht-Battle). Segmented-Control-Optik.
  duetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  duetPill: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  duetLabel: { fontSize: 13, fontWeight: '700', maxWidth: '100%' },
  duetSubLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 1 },
  // ─ Grid ─
  grid: { paddingBottom: 16 },
  gridRow: { gap: 0 },
  // ─ Send Button ─
  sendWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 4,
  },
  sendWrapInactive: { opacity: 0.9 },
  sendBtn: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
