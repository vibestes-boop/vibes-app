import Link from 'next/link';
import {
  LogOut,
  Settings,
  User as UserIcon,
  Coins,
  Receipt,
  LayoutDashboard,
  Users,
  FileText,
  Clock,
  Store,
  Radio,
  Bookmark,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { getUser, getProfile } from '@/lib/auth/session';
import { getMyCoinBalance } from '@/lib/data/payments';
import { signOut } from '@/app/actions/auth';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';

// -----------------------------------------------------------------------------
// TopRightActions — schwebender Cluster oben rechts über allen Seiten.
//
// v1.w.UI.11 TikTok-Parity: Ersetzt die rechte Hälfte des früheren SiteHeader
// (Coins-Pill + Avatar-Dropdown + Logout). Der komplette Header fällt weg; die
// Sidebar übernimmt auf xl+ die Navigation, hier schweben nur noch die Account-
// Actions als Glass-Pills über dem Content.
//
// Position: `fixed top-3 right-3 z-40` — sitzt über allem, blockiert aber nur
// den unteren rechten Bereich unter sich. Auf dunklem Feed-Canvas lesbar
// (weißer Text, schwarz-transparenter Pill-Hintergrund); auf hellen Seiten
// (Shop/Profile) immer noch lesbar dank backdrop-blur + ring.
//
// Logged-out-State zeigt Login/Signup-Pills. Mobile (< md): Avatar-Dropdown und
// Logout bleiben erreichbar; die große Sidebar-Nav ist mobile eh nicht da, also
// enthält der Dropdown auch die zweiten Nav-Slots (Mein Shop, Gemerkt, etc.)
// damit mobile Nutzer nicht abgeschnitten sind.
// -----------------------------------------------------------------------------

export async function TopRightActions() {
  const [user, t, locale] = await Promise.all([getUser(), getT(), getLocale()]);
  const [profile, balance] = user
    ? await Promise.all([getProfile(), getMyCoinBalance()])
    : [null, null];
  const coinsFormatted = (balance?.coins ?? 0).toLocaleString(LOCALE_INTL[locale]);

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-40 flex items-center gap-2">
      {user ? (
        <>
          <Link
            href="/coin-shop"
            aria-label={t('header.coinsAria', { count: coinsFormatted })}
            title={t('header.topUpCoins')}
            className="pointer-events-auto hidden items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-black/60 sm:flex"
          >
            <Coins className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
            <span aria-hidden="true">{coinsFormatted}</span>
            <span aria-hidden="true" className="text-[10px] text-white/70">
              +
            </span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t('header.accountMenu')}
                className="pointer-events-auto flex items-center rounded-full bg-black/40 p-0.5 ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-zinc-800 text-white">
                    {(profile?.username ?? user.email ?? '?').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {profile?.display_name ?? profile?.username ?? 'Account'}
                </span>
                <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={profile?.username ? `/u/${profile.username}` : '/onboarding'}>
                  <UserIcon className="h-4 w-4" />
                  <span>{t('menu.myProfile')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/studio">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>{t('menu.creatorStudio')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/guilds">
                  <Users className="h-4 w-4" />
                  <span>{t('menu.guilds')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/*
               * Power-User-Items: früher in der großen Sidebar, jetzt hier im
               * Dropdown. Auf Desktop (xl+) stehen sie als Tertiary-Quicklinks,
               * auf Mobile sind sie oft die einzige Zugangsroute (MobileBottomNav
               * hat nur 5 Slots).
               */}
              <DropdownMenuItem asChild>
                <Link href="/create/drafts">
                  <FileText className="h-4 w-4" />
                  <span>Entwürfe</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/create/scheduled">
                  <Clock className="h-4 w-4" />
                  <span>Geplant</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/studio/shop">
                  <Store className="h-4 w-4" />
                  <span>Mein Shop</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/studio/live">
                  <Radio className="h-4 w-4" />
                  <span>Live-Studio</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/shop/saved">
                  <Bookmark className="h-4 w-4" />
                  <span>Gemerkt</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/coin-shop">
                  <Coins className="h-4 w-4" />
                  <span>Coin-Shop</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/billing">
                  <Receipt className="h-4 w-4" />
                  <span>{t('menu.payments')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  <span>{t('menu.settings')}</span>
                </Link>
              </DropdownMenuItem>
              <LocaleSwitcher />
              <DropdownMenuSeparator />
              <form action={signOut}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full cursor-pointer">
                    <LogOut className="h-4 w-4" />
                    <span>{t('menu.logout')}</span>
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="pointer-events-auto h-8 rounded-full bg-black/40 px-3 text-white ring-1 ring-white/10 backdrop-blur-md hover:bg-black/60 hover:text-white"
          >
            <Link href="/login">{t('auth.login')}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="pointer-events-auto h-8 rounded-full px-3"
          >
            <Link href="/signup">{t('auth.signup')}</Link>
          </Button>
        </>
      )}
    </div>
  );
}
