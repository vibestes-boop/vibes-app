'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { CoinIcon } from '@/components/ui/coin-icon';
import {
  LogOut,
  Settings,
  User as UserIcon,
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
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { NotificationsDrawer } from '@/components/notifications/notifications-drawer';
import { TopRightActionsFrame } from '@/components/top-right-actions-frame';
import { DmInboxPill } from '@/components/layout/dm-inbox-pill';
import { NotifBellPill } from '@/components/layout/notif-bell-pill';
import { useI18n } from '@/lib/i18n/client';
import { LOCALE_INTL } from '@/lib/i18n/config';
import { glassPillBase, glassAvatarFallback } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

type ProfileSummary = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type AuthShellState =
  | { status: 'loading'; user: null; profile: null; coins: 0 }
  | { status: 'anonymous'; user: null; profile: null; coins: 0 }
  | { status: 'authenticated'; user: User; profile: ProfileSummary | null; coins: number };

async function loadBrowserSupabase(): Promise<SupabaseClient> {
  const { createClient } = await import('@/lib/supabase/client');
  return createClient() as unknown as SupabaseClient;
}

export function AppAuthShell() {
  const pathname = usePathname();
  const [state, setState] = useState<AuthShellState>({
    status: 'loading',
    user: null,
    profile: null,
    coins: 0,
  });
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const loadSeqRef = useRef(0);

  const getSupabase = useCallback(async () => {
    if (!supabaseRef.current) {
      supabaseRef.current = await loadBrowserSupabase();
    }
    return supabaseRef.current;
  }, []);

  const loadAccount = useCallback(
    async (user: User) => {
      const seq = loadSeqRef.current + 1;
      loadSeqRef.current = seq;
      setState({ status: 'authenticated', user, profile: null, coins: 0 });

      const supabase = await getSupabase();
      const [profileResult, walletResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('coins_wallets')
          .select('coins')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (loadSeqRef.current !== seq) return;

      const profile = profileResult.data
        ? ({
            username: profileResult.data.username ?? null,
            display_name: profileResult.data.display_name ?? null,
            avatar_url: profileResult.data.avatar_url ?? null,
          } satisfies ProfileSummary)
        : null;
      const coins =
        typeof walletResult.data?.coins === 'number'
          ? walletResult.data.coins
          : 0;

      setState({ status: 'authenticated', user, profile, coins });
    },
    [getSupabase],
  );

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      const supabase = await getSupabase();
      if (!active) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (session?.user) {
        void loadAccount(session.user);
      } else {
        setState({ status: 'anonymous', user: null, profile: null, coins: 0 });
      }

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        if (nextSession?.user) {
          void loadAccount(nextSession.user);
        } else {
          loadSeqRef.current += 1;
          setState({ status: 'anonymous', user: null, profile: null, coins: 0 });
        }
      });

      unsubscribe = () => data.subscription.unsubscribe();
    })();

    return () => {
      active = false;
      loadSeqRef.current += 1;
      unsubscribe?.();
    };
  }, [getSupabase, loadAccount]);

  const hideGlobalChrome =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname?.startsWith('/auth/') ||
    pathname?.startsWith('/reset-password');

  const viewerId = state.status === 'authenticated' ? state.user.id : null;

  return (
    <>
      {!hideGlobalChrome && <TopRightActionsClient state={state} getSupabase={getSupabase} />}
      {!hideGlobalChrome && (
        <MobileBottomNav isAuthed={state.status === 'anonymous' ? false : state.status === 'authenticated' ? true : null} />
      )}
      {/* Globale Notifications-Drawer — immer gemountet, öffnet sich per Zustand-Store */}
      <NotificationsDrawer viewerId={viewerId} />
    </>
  );
}

function TopRightActionsClient({
  state,
  getSupabase,
}: {
  state: AuthShellState;
  getSupabase: () => Promise<SupabaseClient>;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();

  async function handleSignOut() {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    router.push('/' as Route);
    router.refresh();
  }

  if (state.status === 'loading') {
    return (
      <TopRightActionsFrame>
        <div
          aria-hidden="true"
          className="pointer-events-none hidden h-9 w-32 rounded-full bg-black/20 backdrop-blur-lg sm:block"
        />
      </TopRightActionsFrame>
    );
  }

  if (state.status === 'anonymous') {
    return (
      <TopRightActionsFrame>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            glassPillBase,
            'pointer-events-auto h-9 rounded-full bg-black/70 px-3.5 text-xs font-semibold hover:bg-black/85 hover:text-white',
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
      </TopRightActionsFrame>
    );
  }

  const { user, profile, coins } = state;
  const coinsFormatted = coins.toLocaleString(LOCALE_INTL[locale]);

  return (
    <TopRightActionsFrame>
      {/*
       * Kompakt-Stack: Coins/DM/Bell rücken hinter den Avatar (je ~40% vom
       * rechten Nachbarn verdeckt, -mr-3.5 = 14px bei 36px-Pills) und fahren
       * bei Hover über die Gruppe auf ihre normalen Positionen auseinander.
       * Paint-Order = DOM-Order: Avatar (letztes Kind) liegt oben.
       */}
      <div className="group pointer-events-auto flex items-center">
        <Link
          href="/coin-shop"
          aria-label={t('header.coinsAria', { count: coinsFormatted })}
          title={t('header.topUpCoins')}
          className={cn(
            glassPillBase,
            'hidden h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold sm:flex',
            '-mr-3.5 transition-[margin] duration-200 group-hover:mr-2',
          )}
        >
          <CoinIcon className="h-4 w-4 text-brand-gold" aria-hidden="true" />
          <span aria-hidden="true">{coinsFormatted}</span>
          <span aria-hidden="true" className="text-[10px] text-white/70">
            +
          </span>
        </Link>
        <span className="-mr-3.5 flex transition-[margin] duration-200 group-hover:mr-2">
          <DmInboxPill initialCount={0} viewerId={user.id} />
        </span>
        <span className="-mr-3.5 flex transition-[margin] duration-200 group-hover:mr-2">
          <NotifBellPill initialCount={0} viewerId={user.id} />
        </span>

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
              <CoinIcon className="h-4 w-4" />
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
          <DropdownMenuItem asChild>
            <button type="button" onClick={handleSignOut} className="w-full cursor-pointer">
              <LogOut className="h-4 w-4" />
              <span>{t('menu.logout')}</span>
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </TopRightActionsFrame>
  );
}
