/**
 * Root.tsx — Registriert alle Serlo Remotion-Compositions
 *
 * Starte das Studio mit: npm run studio
 * Render einzeln mit:    npm run render:gifters / render:preview / render:intro
 */

import React from 'react';
import { Composition } from 'remotion';
import { BRAND } from './brand';

import { WeeklyTopGifters } from './compositions/WeeklyTopGifters';
import { AppStorePreview } from './compositions/AppStorePreview';
import { LiveStreamIntro } from './compositions/LiveStreamIntro';

export function RemotionRoot() {
  return (
    <>
      {/* ── 1. Weekly Top Gifters ──────────────────────────────────────────────
          Wöchentlich generiertes Leaderboard-Video für Social Media.
          Echtdaten via: npm run render:gifters -- --props='{"gifters":[...]}'
          Oder via scripts/render-weekly.ts (Supabase-Integration).
      */}
      <Composition
        id="WeeklyTopGifters"
        component={WeeklyTopGifters}
        durationInFrames={BRAND.fps * 30}   // 30 Sekunden
        fps={BRAND.fps}
        width={BRAND.width}
        height={BRAND.height}
        defaultProps={{
          weekLabel: 'Diese Woche',
        }}
      />

      {/* ── 2. App Store Preview ──────────────────────────────────────────────
          30s Feature-Showcase für App Store / Google Play.
          Statisch — kein Props-Override nötig.
      */}
      <Composition
        id="AppStorePreview"
        component={AppStorePreview}
        durationInFrames={BRAND.fps * 30}   // 30 Sekunden
        fps={BRAND.fps}
        width={BRAND.width}
        height={BRAND.height}
        defaultProps={{}}
      />

      {/* ── 3. Live Stream Intro ──────────────────────────────────────────────
          5s Branded Intro. Als WebM rendern für OBS Browser-Source.
          Mit hostName-Prop personalisierbar per Host.
      */}
      <Composition
        id="LiveStreamIntro"
        component={LiveStreamIntro}
        durationInFrames={BRAND.fps * 5}    // 5 Sekunden
        fps={BRAND.fps}
        width={BRAND.width}
        height={BRAND.height}
        defaultProps={{
          hostName: undefined,
          primaryColor: '#EF4444',
        }}
      />

      {/* ── 4. Live Stream Intro (Gold-Variant) ───────────────────────────────
          Gleiche Composition, andere Farbe — für VIP/Gold-Hosts.
      */}
      <Composition
        id="LiveStreamIntroGold"
        component={LiveStreamIntro}
        durationInFrames={BRAND.fps * 5}
        fps={BRAND.fps}
        width={BRAND.width}
        height={BRAND.height}
        defaultProps={{
          hostName: undefined,
          primaryColor: BRAND.gold,
        }}
      />
    </>
  );
}
