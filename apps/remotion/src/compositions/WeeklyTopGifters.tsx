/**
 * WeeklyTopGifters — 30s animiertes Leaderboard-Video
 *
 * Aufbau:
 *   0s  –  3s  : Intro-Text "Diese Woche" + Untertitel fade in
 *   3s  –  25s : 5 Einträge fliegen nacheinander von rechts rein (1.5s Abstand)
 *   25s –  30s : Outro — Serlo-Logo + "Danke für eure Unterstützung ❤️"
 *
 * Daten-Injection: Props `gifters` — kann aus Supabase-Skript befüllt werden,
 * Default sind realistische Mock-Daten.
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Sequence,
  AbsoluteFill,
  Audio,
} from 'remotion';
import { BRAND, COIN, fmtCoins } from '../brand';
import { FadeIn, SlideIn, ScaleIn, FadeInOut, Reveal, PulseLoop } from '../lib/animations';
import { AUDIO, VOLUME, audioAvailable } from '../lib/audio';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Gifter {
  rank: number;
  username: string;
  avatarColor: string;
  avatarInitial: string;
  coins: number;
  avatarUrl?: string;
}

export interface WeeklyTopGiftersProps {
  gifters?: Gifter[];
  weekLabel?: string;
}

// ─── Mock-Daten ───────────────────────────────────────────────────────────────

const DEFAULT_GIFTERS: Gifter[] = [
  { rank: 1, username: 'aslanbek_99',  avatarColor: '#8B5CF6', avatarInitial: 'A', coins: 48200 },
  { rank: 2, username: 'ramzan_live',  avatarColor: '#EF4444', avatarInitial: 'R', coins: 31500 },
  { rank: 3, username: 'madina_vibes', avatarColor: '#F59E0B', avatarInitial: 'M', coins: 22800 },
  { rank: 4, username: 'sultan_94',    avatarColor: '#10B981', avatarInitial: 'S', coins: 15100 },
  { rank: 5, username: 'zarema_x',     avatarColor: '#3B82F6', avatarInitial: 'Z', coins: 9400  },
];

// ─── Rank-Helpers ─────────────────────────────────────────────────────────────

function rankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

// ─── GifterRow ────────────────────────────────────────────────────────────────

function GifterRow({ gifter, delay }: { gifter: Gifter; delay: number }) {
  const frame = useCurrentFrame();

  const enterFrame = Math.max(0, frame - delay);
  const coinProgress = interpolate(enterFrame, [8, 55], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const displayedCoins = Math.round(gifter.coins * coinProgress);

  const isTop3 = gifter.rank <= 3;

  return (
    <SlideIn delay={delay} from="right" distance={300} feel="soft">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '28px 40px',
        marginBottom: 16,
        background: gifter.rank === 1
          ? 'linear-gradient(135deg, rgba(245,166,35,0.12) 0%, rgba(26,26,26,1) 60%)'
          : BRAND.cardBg,
        borderRadius: 24,
        border: `1.5px solid ${gifter.rank === 1 ? 'rgba(245,166,35,0.3)' : BRAND.border}`,
        boxShadow: gifter.rank === 1
          ? `0 0 40px rgba(245,166,35,0.15), inset 0 0 0 1px rgba(245,166,35,0.12)`
          : 'none',
      }}>
        {/* Rank */}
        <div style={{ width: 64, textAlign: 'center', fontSize: isTop3 ? 48 : 36, lineHeight: 1 }}>
          {rankEmoji(gifter.rank)}
        </div>

        {/* Avatar */}
        <div style={{
          width: 88, height: 88,
          borderRadius: '50%',
          background: gifter.avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 38, fontWeight: 700, color: '#fff',
          border: gifter.rank === 1 ? `3px solid ${BRAND.gold}` : '3px solid rgba(255,255,255,0.1)',
          flexShrink: 0, overflow: 'hidden',
          boxShadow: gifter.rank === 1 ? `0 0 20px rgba(245,166,35,0.4)` : 'none',
        }}>
          {gifter.avatarUrl
            ? <img src={gifter.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : gifter.avatarInitial}
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 40, fontWeight: 700, color: BRAND.white,
            fontFamily: BRAND.fontFamily, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.5px',
          }}>
            @{gifter.username}
          </div>
          <div style={{ fontSize: 26, color: BRAND.textMuted, fontFamily: BRAND.fontFamily, marginTop: 6 }}>
            Gesamt dieser Woche
          </div>
        </div>

        {/* Coins */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: isTop3 ? 44 : 38,
            fontWeight: 800,
            color: gifter.rank === 1 ? BRAND.gold : gifter.rank === 2 ? '#E0E0E0' : BRAND.white,
            fontFamily: BRAND.fontFamily,
            letterSpacing: '-1px',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {COIN} {fmtCoins(displayedCoins)}
          </div>
        </div>
      </div>
    </SlideIn>
  );
}

// ─── IntroScreen ──────────────────────────────────────────────────────────────

function IntroScreen() {
  return (
    <AbsoluteFill style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 24, padding: '0 80px',
    }}>
      {/* Hintergrund-Glow */}
      <div style={{
        position: 'absolute',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,166,35,0.14) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />

      <FadeIn delay={20} duration={20}>
        <div style={{
          fontSize: 34, fontWeight: 600, color: BRAND.gold,
          letterSpacing: 10, textTransform: 'uppercase', fontFamily: BRAND.fontFamily,
        }}>
          Diese Woche
        </div>
      </FadeIn>

      <SlideIn delay={0} from="bottom" distance={60} feel="soft">
        <div style={{
          fontSize: 116, fontWeight: 900, color: BRAND.white,
          textAlign: 'center', lineHeight: 1.0,
          fontFamily: BRAND.fontFamily, letterSpacing: '-4px',
        }}>
          Top{'\n'}Gifter
        </div>
      </SlideIn>

      <Reveal delay={30} direction="left" duration={25}>
        <div style={{
          width: 220, height: 4, borderRadius: 2,
          background: `linear-gradient(90deg, ${BRAND.gold}, ${BRAND.goldLight})`,
          boxShadow: `0 0 16px rgba(245,166,35,0.5)`,
        }} />
      </Reveal>

      <FadeIn delay={40} duration={20}>
        <div style={{
          fontSize: 32, color: BRAND.textMuted, fontFamily: BRAND.fontFamily,
          textAlign: 'center', lineHeight: 1.5,
        }}>
          Danke an alle, die Serlo{'\n'}zum Leben erwecken! ❤️
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

// ─── OutroScreen ──────────────────────────────────────────────────────────────

function OutroScreen() {
  return (
    <AbsoluteFill style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 32, padding: '0 80px',
    }}>
      <div style={{
        position: 'absolute', width: 900, height: 900, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,166,35,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <ScaleIn delay={0} feel="punchy">
        <div style={{
          fontSize: 148, fontWeight: 900,
          background: `linear-gradient(135deg, ${BRAND.gold} 0%, ${BRAND.goldLight} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontFamily: BRAND.fontFamily, letterSpacing: '-4px',
          filter: `drop-shadow(0 0 40px rgba(245,166,35,0.3))`,
        }}>
          Serlo
        </div>
      </ScaleIn>

      <FadeIn delay={15} duration={20}>
        <div style={{
          fontSize: 42, color: BRAND.white, fontFamily: BRAND.fontFamily,
          textAlign: 'center', lineHeight: 1.4, fontWeight: 500,
        }}>
          Bis nächste Woche! 🙌
        </div>
      </FadeIn>

      <FadeIn delay={25} duration={20}>
        <div style={{ fontSize: 30, color: BRAND.textMuted, fontFamily: BRAND.fontFamily, letterSpacing: 1 }}>
          serlo.app
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

// ─── Board-Header ─────────────────────────────────────────────────────────────

function BoardHeader({ weekLabel }: { weekLabel: string }) {
  return (
    <div style={{ marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <FadeIn delay={0} duration={20}>
        <div style={{
          fontSize: 28, color: BRAND.gold, letterSpacing: 6,
          textTransform: 'uppercase', fontWeight: 600, fontFamily: BRAND.fontFamily,
        }}>
          {weekLabel}
        </div>
      </FadeIn>
      <SlideIn delay={5} from="bottom" distance={40} feel="soft">
        <div style={{
          fontSize: 76, fontWeight: 900, color: BRAND.white,
          letterSpacing: '-2px', fontFamily: BRAND.fontFamily, lineHeight: 1,
        }}>
          Top Gifter 🏆
        </div>
      </SlideIn>
    </div>
  );
}

// ─── Haupt-Komposition ────────────────────────────────────────────────────────

export function WeeklyTopGifters({
  gifters = DEFAULT_GIFTERS,
  weekLabel = 'KW ' + new Date().toISOString().slice(0, 10),
}: WeeklyTopGiftersProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const INTRO_END   = fps * 3;
  const BOARD_START = fps * 3;
  const BOARD_END   = fps * 25;
  const OUTRO_START = fps * 25;

  return (
    <AbsoluteFill style={{ background: BRAND.darkBg, fontFamily: BRAND.fontFamily, overflow: 'hidden' }}>
      {/* Subtiler Hintergrund */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(circle at 20% 15%, rgba(245,166,35,0.05) 0%, transparent 50%),
          radial-gradient(circle at 80% 85%, rgba(239,68,68,0.03) 0%, transparent 50%)
        `,
      }} />

      {/* ── INTRO ── */}
      {frame < INTRO_END + 15 && (
        <FadeInOut enterFrame={0} exitFrame={INTRO_END} fadeInDuration={10} fadeOutDuration={15}
          style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <IntroScreen />
        </FadeInOut>
      )}

      {/* ── LEADERBOARD ── */}
      {frame >= BOARD_START - 5 && frame < OUTRO_START + 15 && (
        <FadeInOut enterFrame={BOARD_START - 5} exitFrame={BOARD_END}
          fadeInDuration={20} fadeOutDuration={15}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '80px 48px 48px' }}>
          <Sequence from={BOARD_START}>
            <BoardHeader weekLabel={weekLabel} />
          </Sequence>
          <div style={{ flex: 1 }}>
            {gifters.map((gifter, i) => {
              const rowStart = BOARD_START + i * (fps * 1.5);
              return (
                <Sequence key={gifter.rank} from={Math.max(0, rowStart - 10)}>
                  <GifterRow gifter={gifter} delay={10} />
                </Sequence>
              );
            })}
          </div>
        </FadeInOut>
      )}

      {/* ── OUTRO ── */}
      {frame >= OUTRO_START - 10 && (
        <FadeInOut enterFrame={OUTRO_START - 10} exitFrame={durationInFrames}
          fadeInDuration={20} fadeOutDuration={0}
          style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <Sequence from={OUTRO_START}>
            <OutroScreen />
          </Sequence>
        </FadeInOut>
      )}

      {/* ── AUDIO ── */}
      {audioAvailable('leaderboardBg') && (
        <Audio src={AUDIO.leaderboardBg} volume={VOLUME.bg} loop />
      )}
      {audioAvailable('fanfare') && (
        <Sequence from={BOARD_START} durationInFrames={fps * 2}>
          <Audio src={AUDIO.fanfare} volume={VOLUME.effect} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}
