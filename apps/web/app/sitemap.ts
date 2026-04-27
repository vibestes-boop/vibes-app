import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// sitemap.xml — dynamisch generiert.
//
// Strategie:
//   Static:   /, /explore, /shop, /live, /guilds, /login, /signup
//   Dynamic:  Top-1000 Profile | Top-5000 Posts | Top-500 Produkte | Top-200 Hashtags
// Google schluckt bis zu 50.000 URLs / Sitemap — für Phase 2 ist das mehr als
// genug. In Phase 13 splitten wir in Sitemap-Index (users.xml, posts.xml,
// shop.xml, tags.xml separat).
//
// Wird mit `revalidate: 3600` gecacht — 1× pro Stunde frisch, spart Supabase-Load.
// -----------------------------------------------------------------------------

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  // Static-Routes zuerst — die crawlt Google immer.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`,        changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/explore`, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${baseUrl}/shop`,    changeFrequency: 'daily',   priority: 0.9 },
    { url: `${baseUrl}/live`,    changeFrequency: 'hourly',  priority: 0.8 },
    { url: `${baseUrl}/guilds`,  changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${baseUrl}/people`, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${baseUrl}/login`,   changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/signup`,  changeFrequency: 'monthly', priority: 0.5 },
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

    // Shop-Produkte (aktiv, sortiert nach Verkäufen — SEO-relevante Produktseiten)
    const { data: products } = await supabase
      .from('products')
      .select('id, updated_at')
      .eq('is_active', true)
      .order('sold_count', { ascending: false })
      .limit(500);

    const productRoutes: MetadataRoute.Sitemap =
      (products ?? []).map((p) => ({
        url: `${baseUrl}/shop/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.65,
      }));

    // Trending Hashtags — Top 200 nach Post-Count
    const { data: hashtags } = await supabase
      .from('post_hashtags')
      .select('tag')
      .limit(200);

    // Deduplizieren und als Set → unique Tags
    const uniqueTags = [...new Set((hashtags ?? []).map((h) => h.tag as string))];
    const hashtagRoutes: MetadataRoute.Sitemap = uniqueTags.map((tag) => ({
      url: `${baseUrl}/t/${encodeURIComponent(tag)}`,
      changeFrequency: 'daily' as const,
      priority: 0.55,
    }));

    dynamicRoutes = [...profileRoutes, ...postRoutes, ...productRoutes, ...hashtagRoutes];
  } catch {
    // Wenn Supabase zickt — wenigstens die statischen Routes liefern.
    dynamicRoutes = [];
  }

  return [...staticRoutes, ...dynamicRoutes];
}
