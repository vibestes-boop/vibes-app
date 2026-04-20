import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// sitemap.xml — dynamisch generiert.
//
// Strategie: Top-1000 Profile nach Follower-Count + Top-5000 Posts nach
// view_count. Google schluckt bis zu 50.000 URLs / Sitemap — für Phase 2 ist
// das mehr als genug. In Phase 13 splitten wir in Sitemap-Index (users.xml,
// posts.xml, shop.xml separat).
//
// Wird mit `revalidate: 3600` gecacht — 1× pro Stunde frisch, spart Supabase-Load.
// -----------------------------------------------------------------------------

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  // Static-Routes zuerst — die crawlt Google immer.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`,       changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/login`,  changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/signup`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  let dynamicRoutes: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();

    // Profile
    const { data: profiles } = await supabase
      .from('profiles')
      .select('username, updated_at')
      .order('follower_count', { ascending: false })
      .limit(1000);

    const profileRoutes: MetadataRoute.Sitemap =
      (profiles ?? []).map((p) => ({
        url: `${baseUrl}/u/${p.username}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));

    // Posts (nur die, für die public Reads erlaubt sind — RLS macht das für uns)
    const { data: posts } = await supabase
      .from('posts')
      .select('id, created_at')
      .order('view_count', { ascending: false })
      .limit(5000);

    const postRoutes: MetadataRoute.Sitemap =
      (posts ?? []).map((p) => ({
        url: `${baseUrl}/p/${p.id}`,
        lastModified: p.created_at ? new Date(p.created_at) : undefined,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));

    dynamicRoutes = [...profileRoutes, ...postRoutes];
  } catch {
    // Wenn Supabase zickt — wenigstens die statischen Routes liefern.
    dynamicRoutes = [];
  }

  return [...staticRoutes, ...dynamicRoutes];
}
