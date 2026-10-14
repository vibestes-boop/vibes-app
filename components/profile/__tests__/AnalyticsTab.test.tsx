/**
 * AnalyticsTab.test.tsx — Render-Probe für „Ø pro Post" und die Engagement-
 * Spalte der Top-Inhalte (14.10.2026).
 *
 * Die Top-Beiträge waren bis zur Migration 20261014140000 immer leer, deshalb
 * fielen zwei Fehler nie auf: „Ø pro Post" teilte durch die Zahl der Top-
 * Beiträge, und „Abschlussrate" las ein Feld, das die RPC nicht liefert (0 %).
 * Dieser Test rendert den Tab so, wie er mit Daten aussieht.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/useTheme', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => new Proxy({}, { get: () => '#000000' }) }),
    isDark: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/lib/useAnalytics', () => ({
  ...jest.requireActual('@/lib/useAnalytics'),
  useCreatorOverview: jest.fn(),
  useCreatorTopPosts: jest.fn(),
  useFollowerGrowth: () => ({ data: [] }),
  useCreatorEarnings: () => ({ data: undefined, isLoading: false }),
  useCreatorGiftHistory: () => ({ data: [] }),
}));

import { AnalyticsTab } from '@/components/profile/AnalyticsTab';
import { useCreatorOverview, useCreatorTopPosts, type TopPost } from '@/lib/useAnalytics';

// Knoten des gerenderten Baums (react-test-renderer bringt hier keine Typen mit)
interface TreeNode {
  type: unknown;
  props: Record<string, any>;
  findAll: (match: (n: TreeNode) => boolean) => TreeNode[];
}
const tree = () => screen.UNSAFE_root as unknown as TreeNode;

const post = (p: Partial<TopPost> & Pick<TopPost, 'post_id'>): TopPost => ({
  caption: null, media_url: null, media_type: 'image', thumbnail_url: null,
  view_count: 0, like_count: 0, comment_count: 0,
  created_at: '2026-10-13T12:00:00Z', rank: 1, ...p,
});

const TOP: TopPost[] = [
  // ER 3 % · Video ohne Vorschaubild → kein Bild aus der Video-URL
  post({ post_id: 'p1', caption: 'Video', media_type: 'video', media_url: 'https://cdn.test/v.mp4',
         view_count: 100, like_count: 2, comment_count: 1, rank: 1 }),
  // ER 10 % · höchster Wert → voller Balken
  post({ post_id: 'p2', caption: 'Bild', media_url: 'https://cdn.test/b.jpg',
         view_count: 50, like_count: 3, comment_count: 2, rank: 2 }),
  // keine Aufrufe → 0 %
  post({ post_id: 'p3', caption: 'Neu', thumbnail_url: 'https://cdn.test/t.jpg', rank: 3 }),
];

function renderTab(avgViewsPerPost: number | null) {
  (useCreatorOverview as jest.Mock).mockReturnValue({
    isLoading: false,
    data: {
      total_views: 1000, total_likes: 30, total_comments: 10,
      prev_views: 0, prev_likes: 0, prev_comments: 0,
      total_followers: 5, new_followers: 1, prev_followers: 0,
      engagement_rate: 7.5, views_delta: null, likes_delta: null,
      comments_delta: null, followers_delta: null,
      posts_in_period: avgViewsPerPost === null ? null : 40,
      avg_views_per_post: avgViewsPerPost,
    },
  });
  (useCreatorTopPosts as jest.Mock).mockReturnValue({ data: TOP, isLoading: false });
  return render(
    <AnalyticsTab
      userId="me-1" period={28} onPeriodChange={() => {}}
      contentSort="views" onContentSortChange={() => {}} onPostPress={() => {}}
    />,
  );
}

describe('AnalyticsTab — Top-Inhalte mit Daten', () => {
  it('„Ø pro Post" kommt aus der Übersicht, nicht aus der Länge der Top-Liste', () => {
    renderTab(25);
    expect(screen.getByText('analytics.perPost:25')).toBeTruthy();   // nicht 1000 / 3
  });

  it('Ø unbekannt → keine Unterzeile statt einer falschen Zahl', () => {
    renderTab(null);
    expect(screen.queryByText(/^analytics\.perPost/)).toBeNull();
  });

  it('Spalte zeigt die Engagement-Rate je Beitrag statt 0 % „Abschlussrate"', () => {
    renderTab(25);
    expect(screen.getByText('analytics.postEngagement')).toBeTruthy();
    // Zeile für Zeile (die „0%" der Skala im Gesamt-Balken nicht mitzählen)
    const rateRows = tree()
      .findAll((n) => n.type === View && StyleSheet.flatten(n.props.style)?.gap === 6
                      && StyleSheet.flatten(n.props.style)?.flexDirection === 'row');
    expect(rateRows).toHaveLength(3);
    const labels = rateRows.map((row) =>
      row.findAll((n) => typeof n.props.children === 'string')[0].props.children);
    expect(labels).toEqual(['3.0%', '10%', '0%']);

    // Balken relativ zum stärksten Beitrag: 3 % → 30 %, 10 % → 100 %, 0 → 0 %
    const widths = rateRows.map((row) =>
      row.findAll((n) => n.type === View && StyleSheet.flatten(n.props.style)?.height === '100%')
        .map((n) => StyleSheet.flatten(n.props.style).width)[0]);
    expect(widths).toEqual(['30%', '100%', '0%']);
  });

  it('Video-URL wird nie als Vorschaubild geladen', () => {
    renderTab(25);
    const uris = tree()
      .findAll((n) => typeof n.props?.source?.uri === 'string')
      .map((n) => n.props.source.uri as string);
    expect(uris).not.toContain('https://cdn.test/v.mp4');
    expect(uris).toEqual(expect.arrayContaining(['https://cdn.test/b.jpg', 'https://cdn.test/t.jpg']));
  });
});
