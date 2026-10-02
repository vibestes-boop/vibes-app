import type { Metadata, Route } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { ArrowUpRight, ChevronRight, Radio, ShieldCheck, ShoppingBag, Users, Network, Sparkles } from 'lucide-react';
import { getPublicTrendingHashtags, getPublicForYouFeed, getDiscoverPeople, getPublicDiscoverPeople } from '@/lib/data/feed';
import { hasSupabaseAuthCookie } from '@/lib/auth/cookies';
import { getUser, getProfile } from '@/lib/auth/session';
import { getPublicShopPreviewProducts } from '@/lib/data/shop';
import { FollowButton } from '@/components/profile/follow-button';
import { ExplorePostGrid } from '@/components/explore/explore-post-grid';
import { DiscoverHero, DiscoverToolbar } from '@/components/explore/discover-hero';
import { CoinIcon } from '@/components/ui/coin-icon';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';

export const revalidate = 0;
const EXPLORE_SEED = 12;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('explore.metaTitle'), description: t('explore.metaDescription') };
}

export default async function ExplorePage() {
  const [hashtags, preview, t, locale] = await Promise.all([
    getPublicTrendingHashtags(6), getPublicForYouFeed({ limit: EXPLORE_SEED }), getT(), getLocale(),
  ]);
  const pathways = [
    { href: '/guilds', icon: Network, title: t('nav.guilds'), text: t('explore.pathGuildHint') },
    { href: '/live', icon: Radio, title: t('explore.pathLive'), text: t('explore.pathLiveHint') },
    { href: '/people', icon: Users, title: t('explore.pathPeople'), text: t('explore.pathPeopleHint') },
    { href: '/shop', icon: ShoppingBag, title: t('explore.pathShop'), text: t('explore.pathShopHint') },
  ];

  return (
    <main className="discover-main">
      <DiscoverToolbar />
      <div className="discover-content">
        <DiscoverHero />
        <nav className="discover-pathways" aria-label={t('explore.pathwaysLabel')}>
          {pathways.map(({ href, icon: Icon, title, text }) => (
            <Link key={href} href={href as Route} className="discover-pathway">
              <span className="discover-pathway-icon"><Icon size={20} strokeWidth={1.65} /></span>
              <span><strong>{title}</strong><small>{text}</small></span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <div className="discover-columns">
          <section id="community-posts" className="discover-feed" aria-labelledby="discover-feed-title">
            <div className="discover-section-heading">
              <div><p className="discover-eyebrow">{t('explore.feedEyebrow')}</p><h2 id="discover-feed-title">{t('explore.feedTitle')}</h2></div>
              <span className="discover-section-icon"><Sparkles size={20} strokeWidth={1.5} /></span>
            </div>
            <ExplorePostGrid initialPosts={preview} initialHasMore={preview.length >= EXPLORE_SEED} />
          </section>

          <aside className="discover-aside" aria-label={t('explore.communityAside')}>
            <Suspense fallback={<div className="discover-panel discover-people-loading" aria-busy="true"><h2>{t('explore.peopleTitle')}</h2><div /><div /><div /></div>}>
              <CommunityPanel />
            </Suspense>
            {hashtags.length > 0 && (
              <section className="discover-panel discover-trends">
                <p className="discover-eyebrow">{t('explore.trendsEyebrow')}</p>
                <h2>{t('explore.trendingHashtags')}</h2>
                <ol>{hashtags.map((h, index) => <li key={h.tag}>
                  <Link href={`/t/${encodeURIComponent(h.tag)}` as Route}>
                    <span className="discover-trend-number">{String(index + 1).padStart(2, '0')}</span>
                    <span><strong>#{h.tag}</strong><small>{h.post_count.toLocaleString(LOCALE_INTL[locale])} {t('explore.posts')}</small></span>
                    <ArrowUpRight size={15} />
                  </Link>
                </li>)}</ol>
              </section>
            )}
            <Link href="/guilds" className="discover-roots-card">
              <Image src="/discover/kezenoy.webp" alt={t('explore.lakeAlt')} fill sizes="(max-width: 1000px) 100vw, 300px" />
              <div><span className="discover-eyebrow">{t('explore.rootsEyebrow')}</span><h2>{t('explore.rootsTitle')}</h2><span className="discover-roots-link">{t('explore.rootsCta')}<ArrowUpRight size={16} /></span></div>
            </Link>
            <div className="discover-photo-credits">
              <span>{t('explore.photoCredits')}: </span>
              <a href="https://commons.wikimedia.org/wiki/File:Шарой_сверху.jpg" target="_blank" rel="noreferrer">Serpuhovichok</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a><br />
              <a href="https://commons.wikimedia.org/wiki/File:Lake_Kezenoyam,_2017_(1).jpg" target="_blank" rel="noreferrer">Natalianaumenko</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>
            </div>
          </aside>
        </div>
        <Suspense fallback={null}><CommunityShop /></Suspense>
      </div>
    </main>
  );
}

async function CommunityPanel() {
  const t = await getT();
  const viewer = await hasSupabaseAuthCookie() ? await getUser() : null;
  const [people, profile] = await Promise.all([
    viewer ? getDiscoverPeople(4) : getPublicDiscoverPeople(4),
    viewer ? getProfile() : Promise.resolve(null),
  ]);
  const isWozVerified = !!(profile as { gender?: string; women_only_verified?: boolean } | null)?.women_only_verified && (profile as { gender?: string } | null)?.gender === 'female';
  return <>
    <section className="discover-panel discover-people">
      <p className="discover-eyebrow">{t('explore.peopleEyebrow')}</p>
      <div className="discover-panel-heading"><h2>{t('explore.peopleTitle')}</h2><Users size={18} /></div>
      <p className="discover-panel-intro">{t('explore.peopleHint')}</p>
      {people.length ? <ul>{people.map(person => <li key={person.id} className="discover-person">
        <Link href={`/u/${person.username}` as Route} className="discover-person-profile">
          {person.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.avatar_url} alt="" width={40} height={40} loading="lazy" />
          ) : <span className="discover-avatar">{(person.display_name ?? person.username ?? '?').slice(0, 1).toUpperCase()}</span>}
          <span><strong>{person.display_name ?? person.username}</strong><small>@{person.username}</small></span>
        </Link>
        <div className="discover-follow"><FollowButton isAuthenticated={!!viewer} isFollowing={false} isSelf={false} username={person.username} targetUserId={person.id} /></div>
      </li>)}</ul> : <p className="discover-panel-intro">{t('explore.noSuggestedPeople')}</p>}
      <Link href="/people" className="discover-panel-link">{t('explore.allPeople')}<ArrowUpRight size={16} /></Link>
    </section>
    {viewer && <Link href="/woz" className="discover-panel discover-woz"><ShieldCheck size={24} /><span><strong>Women-Only Zone</strong><small>{t(isWozVerified ? 'explore.wozVerifiedHint' : 'explore.wozUnverifiedHint')}</small></span><ChevronRight size={17} /></Link>}
  </>;
}

async function CommunityShop() {
  const [products, t, locale] = await Promise.all([getPublicShopPreviewProducts(6).catch(() => []), getT(), getLocale()]);
  if (!products.length) return null;
  return <section className="discover-shop">
    <div className="discover-section-heading"><div><p className="discover-eyebrow">{t('explore.shopEyebrow')}</p><h2>{t('explore.shopTitle')}</h2></div><Link href="/shop">{t('explore.shopCta')}<ArrowUpRight size={17} /></Link></div>
    <ul>{products.map(product => <li key={product.id}><Link href={`/shop/${product.id}` as Route} className="discover-product">
      <div className="discover-product-image">{product.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.cover_url} alt={product.title} loading="lazy" width={240} height={240} />
      ) : <ShoppingBag size={34} />}{product.sale_price_coins != null && <span>Sale</span>}</div>
      <strong>{product.title}</strong><span className="discover-product-price"><CoinIcon className="h-3.5 w-3.5" />{(product.sale_price_coins ?? product.price_coins).toLocaleString(LOCALE_INTL[locale])}</span>
    </Link></li>)}</ul>
  </section>;
}
