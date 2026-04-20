/**
 * components/live/TopGifterBadge.tsx
 *
 * Zeigt die Top-3 Gifter einer Live-Session als kompakte Badge-Leiste an.
 * Erscheint links unten im Live-Screen (Host + Viewer).
 *
 *  🥇 @wolf_borz    1.2K 💎
 *  🥈 @zurka99       780 💎
 *  🥉 @akhmat08      340 💎
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Image } from 'expo-image';
import type { TopGifter } from '@/lib/useGifts';

interface Props {
  topGifters: TopGifter[];
  /** Vollständige Liste für Modal */
  allGifters?: TopGifter[];
  /**
   * v1.22.1 — TikTok-Style kompakte Variante für die TopBar:
   * zwei überlappende Avatare mit Coin-Badge. Öffnet auf Tap dasselbe Modal.
   */
  compact?: boolean;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function TopGifterBadge({ topGifters, allGifters, compact }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const top3 = topGifters.slice(0, 3);

  if (top3.length === 0) return null;

  return (
    <>
      {compact ? (
        /* TikTok-Style: 2 Avatare überlappend, Coin-Badge unten */
        <Pressable
          onPress={() => setModalVisible(true)}
          style={s.compactWrap}
          hitSlop={6}
        >
          {top3.slice(0, 2).map((gifter, i) => (
            <View
              key={gifter.userId}
              style={[s.compactAvatarWrap, i > 0 && { marginLeft: -10 }]}
            >
              {gifter.avatarUrl ? (
                <Image
                  source={{ uri: gifter.avatarUrl }}
                  style={s.compactAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[s.compactAvatar, s.avatarFallback]}>
                  <Text style={s.compactAvatarInitial}>
                    {gifter.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={s.compactCoinBadge}>
                <Text style={s.compactCoinText}>
                  {fmtCoins(gifter.totalCoins)}
                </Text>
              </View>
            </View>
          ))}
        </Pressable>
      ) : (
        /* Klassische vertikale Badge-Leiste (Viewer unten links) */
        <Pressable onPress={() => setModalVisible(true)} style={s.container} hitSlop={8}>
          <Text style={s.labelRow}>🏆 Top-Spender</Text>
          {top3.map((gifter, i) => (
            <View key={gifter.userId} style={s.row}>
              {/* Avatar */}
              {gifter.avatarUrl ? (
                <Image
                  source={{ uri: gifter.avatarUrl }}
                  style={s.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>
                    {gifter.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={s.medal}>{MEDALS[i]}</Text>
              <Text style={s.username} numberOfLines={1}>
                @{gifter.username}
              </Text>
              <Text style={s.coins}>{fmtCoins(gifter.totalCoins)} 💎</Text>
            </View>
          ))}
        </Pressable>
      )}

      {/* Vollständiges Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={s.overlay} onPress={() => setModalVisible(false)}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>🏆 Beste Unterstützer</Text>
            {(allGifters ?? topGifters).map((gifter, i) => (
              <View key={gifter.userId} style={s.modalRow}>
                <Text style={s.modalRank}>#{i + 1}</Text>
                {gifter.avatarUrl ? (
                  <Image source={{ uri: gifter.avatarUrl }} style={s.modalAvatar} contentFit="cover" />
                ) : (
                  <View style={[s.modalAvatar, s.avatarFallback]}>
                    <Text style={s.avatarInitial}>{gifter.username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={s.modalUsername} numberOfLines={1}>@{gifter.username}</Text>
                <Text style={s.modalCoins}>{fmtCoins(gifter.totalCoins)} 💎</Text>
              </View>
            ))}
            <Text style={s.modalClose}>Tippen zum Schließen</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCoins(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // v1.22.1 — kompakte TikTok-Style Variante (TopBar, rechts neben Viewer-Count)
  compactWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactAvatarWrap: {
    width: 26,
    height: 26,
    position: 'relative',
  },
  compactAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.55)',
  },
  compactAvatarInitial: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  compactCoinBadge: {
    position: 'absolute',
    bottom: -3,
    left: -2,
    right: -2,
    backgroundColor: '#fbbf24',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  compactCoinText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#1f1300',
    letterSpacing: 0.2,
  },

  container: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    padding: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    maxWidth: 180,
  },
  labelRow: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  avatarFallback: {
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  medal: {
    fontSize: 12,
  },
  username: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  coins: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#1e1e2e',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  modalRank: {
    width: 24,
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  modalUsername: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  modalCoins: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fbbf24',
  },
  modalClose: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 11,
    marginTop: 8,
  },
});
