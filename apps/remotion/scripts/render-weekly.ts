/**
 * render-weekly.ts
 *
 * Holt die Top-5-Gifter der aktuellen Woche aus Supabase
 * und rendert automatisch das WeeklyTopGifters-Video.
 *
 * Verwendung:
 *   npx ts-node scripts/render-weekly.ts
 *
 * Voraussetzungen:
 *   SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env
 *   npm install @supabase/supabase-js ts-node dotenv @remotion/renderer --save-dev
 *
 * Output: out/weekly-top-gifters-YYYY-WW.mp4
 */

import { createClient } from '@supabase/supabase-js';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// ─── Woche berechnen ──────────────────────────────────────────────────────────

function getWeekBounds(): { from: string; to: string; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, …
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // ISO-Wochennummer
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const weekNum = Math.ceil((((now.getTime() - jan4.getTime()) / 86400000) + jan4.getDay() + 1) / 7);

  return {
    from: monday.toISOString(),
    to: sunday.toISOString(),
    label: `KW ${weekNum} · ${now.getFullYear()}`,
  };
}

// ─── Supabase: Top 5 Gifter der Woche ────────────────────────────────────────

async function fetchTopGifters(supabaseUrl: string, serviceKey: string) {
  const supabase = createClient(supabaseUrl, serviceKey);
  const { from, to, label } = getWeekBounds();

  const { data, error } = await supabase
    .from('live_gifts')
    .select('sender_id, coin_cost, profiles!live_gifts_sender_id_fkey(username, avatar_url)')
    .gte('created_at', from)
    .lte('created_at', to);

  if (error || !data) throw new Error(`Supabase error: ${error?.message}`);

  // Aggregieren nach sender_id
  const totals = new Map<string, { username: string; avatar_url: string | null; total: number }>();
  for (const row of data as any[]) {
    const uid = row.sender_id;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const username = profile?.username ?? uid.slice(0, 8);
    const existing = totals.get(uid);
    if (existing) {
      existing.total += row.coin_cost ?? 0;
    } else {
      totals.set(uid, { username, avatar_url: profile?.avatar_url ?? null, total: row.coin_cost ?? 0 });
    }
  }

  // Top 5 sortieren
  const AVATAR_COLORS = ['#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#3B82F6'];
  const sorted = [...totals.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([, v], i) => ({
      rank: i + 1,
      username: v.username,
      avatarColor: AVATAR_COLORS[i],
      avatarInitial: v.username[0]?.toUpperCase() ?? '?',
      coins: v.total,
      avatarUrl: v.avatar_url ?? undefined,
    }));

  return { gifters: sorted, weekLabel: label };
}

// ─── Render ───────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.');
    process.exit(1);
  }

  console.log('📊 Hole Top-5-Gifter aus Supabase...');
  const { gifters, weekLabel } = await fetchTopGifters(supabaseUrl, serviceKey);

  if (gifters.length === 0) {
    console.log('⚠️ Keine Gifter diese Woche gefunden. Nutze Demo-Daten.');
  } else {
    console.log(`✅ ${gifters.length} Gifter gefunden:`);
    gifters.forEach((g) => console.log(`   #${g.rank} @${g.username} — ${g.coins} Coins`));
  }

  const now = new Date();
  const weekStr = `${now.getFullYear()}-W${String(Math.ceil(now.getDate() / 7)).padStart(2, '0')}`;
  const outFile = path.join(process.cwd(), 'out', `weekly-top-gifters-${weekStr}.mp4`);

  console.log('\n🎬 Bundle wird erstellt...');
  const bundleLocation = await bundle(path.join(process.cwd(), 'src/index.ts'));

  console.log('🎞️ Video wird gerendert...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'WeeklyTopGifters',
    inputProps: { gifters, weekLabel },
  });

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outFile,
    inputProps: { gifters, weekLabel },
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   ${(progress * 100).toFixed(0)}% gerendert…`);
    },
  });

  console.log(`\n✅ Fertig! Video gespeichert: ${outFile}`);
  console.log('   👆 Direkt in Social Media posten oder in der App teilen!');
}

main().catch((err) => {
  console.error('❌ Render fehlgeschlagen:', err);
  process.exit(1);
});
