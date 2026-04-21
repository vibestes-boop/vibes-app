import Link from 'next/link';
import {
  LogOut,
  Settings,
  User as UserIcon,
  Coins,
  Receipt,
  LayoutDashboard,
  Users,
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
import { DesktopNav, MobileNav } from '@/components/main-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { getUser, getProfile } from '@/lib/auth/session';
import { getMyCoinBalance } from '@/lib/data/payments';
import { signOut } from '@/app/actions/auth';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';

export async function SiteHeader() {
  const [user, t, locale] = await Promise.all([getUser(), getT(), getLocale()]);
  // Parallelisieren: Profil + Coin-Saldo kommen aus zwei verschiedenen Tabellen
  // (`profiles` vs. `coins_wallets`). Ein früher Versuch, `coins_balance` direkt
  // im Profile-Select mitzuziehen, schlug fehl weil die Spalte nicht existiert.
  const [profile, balance] = user
    ? await Promise.all([getProfile(), getMyCoinBalance()])
    : [null, null];
  const coinsFormatted = (balance?.coins ?? 0).toLocaleString(LOCALE_INTL[locale]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <MobileNav isAuthed={!!user} />
          <Link href="/" className="font-serif text-xl font-medium tracking-tight">
            Serlo
          </Link>
          <DesktopNav isAuthed={!!user} />
        </div>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/coin-shop"
                aria-label={t('header.coinsAria', { count: coinsFormatted })}
                title={t('header.topUpCoins')}
                className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-gold/50 hover:bg-brand-gold/5 hover:text-foreground sm:flex"
              >
                <Coins className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                <span aria-hidden="true">{coinsFormatted}</span>
                <span aria-hidden="true" className="text-[10px] text-muted-foreground/70">+</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-border bg-card p-0.5 pr-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={t('header.accountMenu')}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                      <AvatarFallback>
                        {(profile?.username ?? user.email ?? '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium sm:inline">
                      @{profile?.username ?? '…'}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
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
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t('auth.login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">{t('auth.signup')}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
