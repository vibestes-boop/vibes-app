/**
 * AppStorePreview — 30s App Store Preview Video (9:16)
 *
 * 4 Feature-Screens à 7.5s, je mit animiertem Mock-UI:
 *   0s  – 7.5s : Feed — vertikaler Video-Feed mit Like-Burst
 *   7.5s – 15s : Live — Stream-UI mit Chat + Gift-Regen
 *   15s – 22.5s: Geschenke — Gift-Picker mit Coin-Animation
 *   22.5s – 30s: Community — Guilds + Stories
 *
 * Jeder Screen hat: Title-Fade, Mock-UI-Slide, Feature-Highlight-Pill
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
  Sequence,
} from 'remotion';
import { BRAND, COIN, fmtCoins } from '../brand';
import { SlideIn, ScaleIn, FadeInOut } from '../lib/animations';

// ─── Helper: Screen-Wrapper ───────────────────────────────────────────────────

function ScreenWrapper({ children, enterFrame, exitFrame, color }: {
  children: React.ReactNode;
  enterFrame: number;
  exitFrame: number;
  color: string;
}) {
  return (
    <FadeInOut
      enterFrame={enterFrame}
      exitFrame={exitFrame}
      fadeInDuration={15}
      fadeOutDuration={10}
      style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, ${color}18 0%, ${BRAND.darkBg} 40%)`,
      }}
    >
      {children}
    </FadeInOut>
  );
}

// ─── Feature-Pill ─────────────────────────────────────────────────────────────

function FeaturePill({ text, emoji, delay, color }: {
  text: string; emoji: string; delay: number; color: string;
}) {
  return (
    <SlideIn delay={delay} from="bottom" distance={20} feel="punchy">
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        background: `${color}22`,
        border: `1.5px solid ${color}55`,
        borderRadius: 100,
        padding: '14px 28px',
        fontSize: 32,
        fontFamily: BRAND.fontFamily,
        color: BRAND.white,
        fontWeight: 600,
      }}>
        <span style={{ fontSize: 36 }}>{emoji}</span>
        {text}
      </div>
    </SlideIn>
  );
}

// ─── Screen 1: Feed ───────────────────────────────────────────────────────────

function FeedScreen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Simulated scroll
  const scrollY = interpolate(frame, [20, fps * 6], [0, -340], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });

  // Like-burst at frame 60
  const likeScale = spring({ frame: Math.max(0, frame - 60), fps, config: { damping: 10, stiffness: 200, mass: 0.5 }, from: 0, to: 1 });
  const likeOpacity = interpolate(frame, [60, 65, 100, 115], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const posts = [
    { user: '@aslanbek_99', likes: '48.2K', color: '#8B5CF6', text: 'Serlo ist das beste! 🔥' },
    { user: '@madina_vibes', likes: '31.5K', color: '#EF4444', text: 'Live jetzt! Kommt vorbei 👋' },
    { user: '@ramzan_live', likes: '22.8K', color: '#F59E0B', text: 'Neues Video ist da 🎬' },
  ];

  return (
    <AbsoluteFill>
      {/* Phone Mock */}
      <div style={{
        position: 'absolute',
        top: 180,
        left: '50%',
        transform: `translateX(-50%)`,
        width: 560,
        height: 1100,
        borderRadius: 52,
        background: '#111',
        border: '3px solid rgba(255,255,255,0.12)',
        overflow: 'hidden',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Status Bar */}
        <div style={{ background: '#000', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <span style={{ color: '#fff', fontSize: 22, fontWeight: 600 }}>9:41</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {['▪▪▪▪', '📶', '🔋'].map((s, i) => (
              <span key={i} style={{ color: '#fff', fontSize: 18 }}>{s}</span>
            ))}
          </div>
        </div>
        {/* Feed Posts */}
        <div style={{ transform: `translateY(${scrollY}px)`, transition: 'none' }}>
          {posts.map((p, i) => (
            <div key={i} style={{
              height: 400,
              background: `linear-gradient(135deg, ${p.color}44, #111)`,
              position: 'relative',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: 20,
            }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>{p.user}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>{p.text}</div>
              </div>
              <div style={{ position: 'absolute', right: 16, bottom: 60, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36 }}>❤️</div>
                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{p.likes}</div>
                </div>
                <div style={{ fontSize: 36 }}>💬</div>
                <div style={{ fontSize: 36 }}>↗️</div>
              </div>
            </div>
          ))}
        </div>
        {/* Like-Burst Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          opacity: likeOpacity,
        }}>
          <div style={{ fontSize: 160, transform: `scale(${likeScale})` }}>❤️</div>
        </div>
      </div>

      {/* Texte */}
      <div style={{
        position: 'absolute',
        bottom: 180,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{ fontSize: 72, fontWeight: 900, color: BRAND.white, fontFamily: BRAND.fontFamily }}>
          Dein Feed
        </div>
        <FeaturePill text="Endlos scrollen" emoji="📱" delay={30} color={BRAND.gold} />
        <FeaturePill text="Doppelklick zum Liken" emoji="❤️" delay={50} color={BRAND.red} />
      </div>
    </AbsoluteFill>
  );
}

// ─── Screen 2: Live ───────────────────────────────────────────────────────────

function LiveScreen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chatMessages = [
    { user: 'sultan_94', text: 'Aaaa das ist so gut! 🔥', delay: 10 },
    { user: 'zarema_x', text: 'Salam! Wann kommt das nächste?', delay: 30 },
    { user: 'aslanbek_99', text: '❤️❤️❤️', delay: 55 },
    { user: 'madina_vibes', text: 'Best stream ever 🙌', delay: 80 },
    { user: 'ramzan_live', text: 'Subbed! Danke für den Stream!', delay: 105 },
  ];

  // Gift regen — multiple falling gifts
  const giftPositions = [0.2, 0.5, 0.75, 0.35, 0.6].map((x, i) => ({
    x,
    startFrame: 40 + i * 15,
    emoji: ['🎁', '💎', '👑', '🌹', '🚀'][i],
  }));

  return (
    <AbsoluteFill>
      {/* Live Stream BG */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, #1a0030 0%, #0d1117 50%, #001a20 100%)',
      }} />

      {/* Stream Host Visual */}
      <div style={{
        position: 'absolute',
        top: 180,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 560,
        height: 780,
        borderRadius: 32,
        background: 'linear-gradient(135deg, #8B5CF644, #EF444422)',
        border: '2px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Host Avatar */}
        <div style={{
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8B5CF6, #EF4444)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 80,
          border: '4px solid rgba(255,255,255,0.3)',
        }}>
          🎤
        </div>

        {/* LIVE Badge */}
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: BRAND.red,
          color: '#fff',
          fontSize: 22,
          fontWeight: 800,
          padding: '8px 18px',
          borderRadius: 8,
          letterSpacing: 2,
          fontFamily: BRAND.fontFamily,
        }}>
          ● LIVE
        </div>

        {/* Viewer Count */}
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          fontSize: 22,
          fontWeight: 600,
          padding: '8px 16px',
          borderRadius: 8,
          fontFamily: BRAND.fontFamily,
        }}>
          👁 {Math.round(interpolate(frame, [0, 100], [842, 1247], { extrapolateRight: 'clamp' }))}
        </div>

        {/* Chat Overlay */}
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {chatMessages.map((msg, i) => {
            const msgOpacity = interpolate(Math.max(0, frame - msg.delay), [0, 10], [0, 1], { extrapolateRight: 'clamp' });
            return (
              <div key={i} style={{
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(8px)',
                borderRadius: 12,
                padding: '8px 14px',
                opacity: msgOpacity,
                fontSize: 20,
                color: '#fff',
                fontFamily: BRAND.fontFamily,
              }}>
                <span style={{ color: BRAND.gold, fontWeight: 700 }}>@{msg.user}</span>
                {' '}{msg.text}
              </div>
            );
          })}
        </div>

        {/* Gift Rain */}
        {giftPositions.map((g, i) => {
          const gFrame = Math.max(0, frame - g.startFrame);
          const y = interpolate(gFrame, [0, 80], [-40, 820], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.in(Easing.quad),
          });
          const gOpacity = interpolate(gFrame, [0, 5, 60, 80], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${g.x * 100}%`,
              top: y,
              fontSize: 48,
              opacity: gOpacity,
              transform: `rotate(${gFrame * 3}deg)`,
            }}>
              {g.emoji}
            </div>
          );
        })}
      </div>

      {/* Bottom Text */}
      <div style={{
        position: 'absolute',
        bottom: 140,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{ fontSize: 72, fontWeight: 900, color: BRAND.white, fontFamily: BRAND.fontFamily }}>
          Live gehen
        </div>
        <FeaturePill text="Live streamen" emoji="📡" delay={20} color={BRAND.red} />
        <FeaturePill text="Live-Geschenke erhalten" emoji="🎁" delay={40} color={BRAND.gold} />
      </div>
    </AbsoluteFill>
  );
}

// ─── Screen 3: Geschenke ──────────────────────────────────────────────────────

function GiftsScreen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const gifts = [
    { emoji: '🌹', name: 'Rose', price: 10, color: '#EF4444' },
    { emoji: '💎', name: 'Diamant', price: 500, color: '#3B82F6' },
    { emoji: '👑', name: 'Krone', price: 1000, color: '#F59E0B' },
    { emoji: '🚀', name: 'Rakete', price: 250, color: '#8B5CF6' },
    { emoji: '🎯', name: 'Ziel', price: 50, color: '#10B981' },
    { emoji: '🏆', name: 'Pokal', price: 2000, color: '#F5A623' },
  ];

  // Coin counter animation
  const coins = Math.round(interpolate(frame, [0, fps * 5], [0, 48200], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  }));

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, #0d0020 0%, #111 50%)',
      }} />

      {/* Coin Balance */}
      <div style={{
        position: 'absolute',
        top: 160,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ fontSize: 36, color: BRAND.textMuted, fontFamily: BRAND.fontFamily }}>
          Dein Guthaben
        </div>
        <div style={{
          fontSize: 100,
          fontWeight: 900,
          color: BRAND.gold,
          fontFamily: BRAND.fontFamily,
          letterSpacing: '-3px',
        }}>
          {COIN} {fmtCoins(coins)}
        </div>
      </div>

      {/* Gift Grid */}
      <div style={{
        position: 'absolute',
        top: 400,
        left: 60,
        right: 60,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 24,
      }}>
        {gifts.map((g, i) => {
          const delay = i * 8;
          const gFrame = Math.max(0, frame - delay);
          const scale = spring({ frame: gFrame, fps, config: { damping: 14, stiffness: 140 }, from: 0, to: 1 });
          const opacity = interpolate(gFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
          const isHighlighted = i === 1 && frame > 80; // Diamant highlighted
          return (
            <div key={i} style={{
              background: isHighlighted ? `${g.color}33` : BRAND.cardBg,
              border: `2px solid ${isHighlighted ? g.color : BRAND.border}`,
              borderRadius: 24,
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              transform: `scale(${scale}) ${isHighlighted ? 'scale(1.05)' : ''}`,
              opacity,
              boxShadow: isHighlighted ? `0 0 32px ${g.color}44` : 'none',
            }}>
              <div style={{ fontSize: 72 }}>{g.emoji}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: BRAND.white, fontFamily: BRAND.fontFamily }}>
                {g.name}
              </div>
              <div style={{ fontSize: 24, color: BRAND.gold, fontWeight: 600, fontFamily: BRAND.fontFamily }}>
                {COIN} {g.price}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Text */}
      <div style={{
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{ fontSize: 72, fontWeight: 900, color: BRAND.white, fontFamily: BRAND.fontFamily }}>
          Geschenke
        </div>
        <FeaturePill text="Creator unterstützen" emoji={COIN} delay={20} color={BRAND.gold} />
      </div>
    </AbsoluteFill>
  );
}

// ─── Screen 4: Community ──────────────────────────────────────────────────────

function CommunityScreen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const guilds = [
    { name: 'Tschetschenien', emoji: '🏔️', members: '12.4K', color: '#10B981' },
    { name: 'Musik & Talent', emoji: '🎵', members: '8.2K', color: '#8B5CF6' },
    { name: 'Sport & Fitness', emoji: '💪', members: '6.1K', color: '#EF4444' },
    { name: 'Kochen & Essen', emoji: '🍖', members: '4.8K', color: '#F59E0B' },
  ];

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, #001020 0%, #111 50%)',
      }} />

      {/* Stories Row */}
      <div style={{
        position: 'absolute',
        top: 180,
        left: 0,
        right: 0,
        display: 'flex',
        gap: 24,
        padding: '0 48px',
        overflowX: 'hidden',
      }}>
        {['A', 'R', 'M', 'S', 'Z', 'T'].map((initial, i) => {
          const delay = i * 8;
          const f = Math.max(0, frame - delay);
          const scale = spring({ frame: f, fps, config: { damping: 12, stiffness: 160 } });
          const colors = ['#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#F5A623'];
          const isLive = i === 1 || i === 3;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transform: `scale(${scale})` }}>
              <div style={{
                width: 110,
                height: 110,
                borderRadius: '50%',
                background: colors[i],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 46,
                fontWeight: 700,
                color: '#fff',
                border: isLive ? `3px solid ${BRAND.red}` : '3px solid rgba(255,255,255,0.15)',
                boxShadow: isLive ? `0 0 20px ${BRAND.red}66` : 'none',
              }}>
                {initial}
              </div>
              {isLive && (
                <div style={{ background: BRAND.red, color: '#fff', fontSize: 18, fontWeight: 800, padding: '4px 12px', borderRadius: 6, letterSpacing: 1 }}>
                  LIVE
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Guild Cards */}
      <div style={{
        position: 'absolute',
        top: 480,
        left: 48,
        right: 48,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {guilds.map((g, i) => {
          const delay = i * 12;
          const f = Math.max(0, frame - delay);
          const translateX = interpolate(f, [0, 20], [-120, 0], {
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          });
          const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              background: BRAND.cardBg,
              border: `1.5px solid ${BRAND.border}`,
              borderRadius: 20,
              padding: '20px 28px',
              transform: `translateX(${translateX}px)`,
              opacity,
            }}>
              <span style={{ fontSize: 52 }}>{g.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 34, fontWeight: 700, color: BRAND.white, fontFamily: BRAND.fontFamily }}>
                  {g.name}
                </div>
                <div style={{ fontSize: 24, color: BRAND.textMuted, fontFamily: BRAND.fontFamily }}>
                  {g.members} Mitglieder
                </div>
              </div>
              <div style={{
                background: `${g.color}22`,
                border: `1px solid ${g.color}55`,
                borderRadius: 100,
                padding: '8px 20px',
                fontSize: 24,
                color: g.color,
                fontWeight: 600,
                fontFamily: BRAND.fontFamily,
              }}>
                Beitreten
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom */}
      <div style={{
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{ fontSize: 72, fontWeight: 900, color: BRAND.white, fontFamily: BRAND.fontFamily }}>
          Community
        </div>
        <FeaturePill text="Guilds beitreten" emoji="🏔️" delay={20} color="#10B981" />
        <FeaturePill text="Serlo — Jetzt downloaden" emoji="⬇️" delay={40} color={BRAND.gold} />
      </div>
    </AbsoluteFill>
  );
}

// ─── Haupt-Komposition ────────────────────────────────────────────────────────

export function AppStorePreview() {
  const { fps } = useVideoConfig();
  const SEGMENT = fps * 7.5; // 7.5s pro Screen

  return (
    <AbsoluteFill style={{ background: BRAND.darkBg, fontFamily: BRAND.fontFamily }}>
      {/* Screen 1: Feed */}
      <Sequence from={0} durationInFrames={SEGMENT + 15}>
        <ScreenWrapper enterFrame={0} exitFrame={SEGMENT} color={BRAND.gold}>
          <FeedScreen />
        </ScreenWrapper>
      </Sequence>

      {/* Screen 2: Live */}
      <Sequence from={SEGMENT - 15} durationInFrames={SEGMENT + 15}>
        <ScreenWrapper enterFrame={0} exitFrame={SEGMENT} color={BRAND.red}>
          <LiveScreen />
        </ScreenWrapper>
      </Sequence>

      {/* Screen 3: Gifts */}
      <Sequence from={SEGMENT * 2 - 15} durationInFrames={SEGMENT + 15}>
        <ScreenWrapper enterFrame={0} exitFrame={SEGMENT} color="#8B5CF6">
          <GiftsScreen />
        </ScreenWrapper>
      </Sequence>

      {/* Screen 4: Community */}
      <Sequence from={SEGMENT * 3 - 15} durationInFrames={SEGMENT + 15}>
        <ScreenWrapper enterFrame={0} exitFrame={SEGMENT} color="#10B981">
          <CommunityScreen />
        </ScreenWrapper>
      </Sequence>
    </AbsoluteFill>
  );
}
