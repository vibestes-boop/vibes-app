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
import { glassPillBase, glassAvatarFallback } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';
import { getUnreadDmCount } from '@/app/actions/messages';
import { getUnreadNotificationCount } from '@/app/actions/notifications';
import { DmInboxPill } from '@/components/layout/dm-inbox-pill';
import { NotifBellPill } from '@/components/layout/notif-bell-pill';

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
//
// v1.w.UI.13: Alle drei Trigger (Coins, Avatar, Login/Signup) bauen jetzt auf
// `glassPillBase` aus `lib/ui/glass-pill.ts` auf — einheitlicher Surface-Look,
// einheitliche Höhe (h-9), einheitliche Icon-Größe (h-4 w-4), einheitlicher
// Open-State (data-[state=open] via Radix), einheitlicher Focus-Ring. Früher
// lebten drei leicht divergente Copy-Paste-Blöcke im File.
// -----------------------------------------------------------------------------

export async function TopRightActions() {
  const [user, t, locale] = await Promise.all([getUser(), getT(), getLocale()]);
  const [profile, balance, initialUnreadDms, initialUnreadNotifs] = user
    ? await Promise.all([getProfile(), getMyCoinBalance(), getUnreadDmCount(), getUnreadNotificationCount()])
    : [null, null, 0, 0];
  const coinsFormatted = (balance?.coins ?? 0).toLocaleString(LOCALE_INTL[locale]);

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-40 flex items-center gap-2">
      {user ? (
        <>
          <Link
            href="/coin-shop"
            aria-label={t('header.coinsAria', { count: coinsFormatted })}
            title={t('header.topUpCoins')}
            className={cn(
              glassPillBase,
              'pointer-events-auto hidden h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold sm:flex',
            )}
          >
            <Coins className="h-4 w-4 text-brand-gold" aria-hidden="true" />
            <span aria-hidden="true">{coinsFormatted}</span>
            <span aria-hidden="true" className="text-[10px] text-white/70">
              +
            </span>
          </Link>
          {/* DM + Notifications Badges (v1.w.UI.75 / v1.w.UI.76 / v1.w.UI.93).
              Server-seitige Initial-Counts für flicker-freies erstes Paint;
              DMs: 30s-Polling; Notifs: Realtime (postgres_changes INSERT) + 60s-Fallback. */}
          <DmInboxPill initialCount={initialUnreadDms} viewerId={user.id} />
          <NotifBellPill initialCount={initialUnreadNotifs} viewerId={user.id} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t('header.accountMenu')}
                className={cn(
                  glassPillBase,
                  'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full p-0.5',
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className={glassAvatarFallback}>
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
            className={cn(
              glassPillBase,
              'pointer-events-auto h-9 rounded-full px-3.5 text-xs font-semibold hover:text-white',
            )}
          >
            <Link href="/login">{t('auth.login')}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="pointer-events-auto h-9 rounded-full px-3.5 text-xs font-semibold shadow-elevation-2 transition-colors duration-base ease-out-expo"
          >
            <Link href="/signup">{t('auth.signup')}</Link>
          </Button>
        </>
      )}
    </div>
  );
}
