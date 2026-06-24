'use client';

// -----------------------------------------------------------------------------
// MobileBottomNav — 5-Slot-Tab-Bar am unteren Viewport-Rand, nur sichtbar
// unterhalb `md` (< 768px).
//
// Slot-Modell — Parität mit der nativen App-Bottom-Nav (lib/tabBarStore):
//   Feed (fest) | Slot 2 | Create (fest) | Slot 4 | Profil (fest)
//
// Slot 2 + 4 sind in der App user-anpassbar und werden seit der nav_slot-
// Migration nach `profiles.nav_slot_2/4` gesynct. Diese Komponente liest die
// Wahl client-seitig und rendert dieselben Slots wie die App. Fallback (Spalten
// noch leer / Migration nicht angewandt / nicht eingeloggt): guild / shop.
//
// Notifications („Inbox") sind kein Default-Slot (in der App ebenso) — auf Web
// weiter über die Glocke in der Kopfzeile erreichbar.
//
// Safe-Area: `pb-[env(safe-area-inset-bottom)]` respektiert iOS-Home-Indicator.
// -----------------------------------------------------------------------------

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  Compass,
  PlusSquare,
  Users,
  User as UserIcon,
  ShoppingBag,
  MessageCircle,
  Bell,
  Video,
  Flower2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';
import { createClient } from '@/lib/supabase/client';

// TabFeature-Keys aus lib/tabBarStore (App) — die anpassbaren Slot-2/4-Optionen.
type NavFeature =
  | 'guild'
  | 'messages'
  | 'shop'
  | 'explore'
  | 'notifications'
  | 'live'
  | 'women_only';

const VALID_FEATURES: NavFeature[] = [
  'guild', 'messages', 'shop', 'explore', 'notifications', 'live', 'women_only',
];

const asFeature = (v: unknown, fallback: NavFeature): NavFeature =>
  typeof v === 'string' && (VALID_FEATURES as string[]).includes(v)
    ? (v as NavFeature)
    : fallback;

type RenderSlot = {
  href: string;
  label: string;
  icon: typeof Home;
  primary?: boolean;
};

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/profile') {
    return pathname === '/profile' || pathname === '/onboarding' || pathname.startsWith('/u/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({
  isAuthed,
}: {
  isAuthed: boolean | null;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  // Nav-Config aus der DB (Slot 2/4). Defensiv: schlägt der Read fehl (Spalte
  // fehlt noch / nicht eingeloggt), bleibt `null` → Defaults greifen.
  const { data: navConfig } = useQuery({
    queryKey: ['mobile-nav-config'],
    enabled: isAuthed === true,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('nav_slot_2, nav_slot_4')
        .eq('id', user.id)
        .maybeSingle();
      if (error) return null;
      return data as { nav_slot_2: string | null; nav_slot_4: string | null } | null;
    },
  });

  // TabFeature → Web-Route + Icon + Label. Spiegelt lib/tabBarStore (App).
  const featureSlot = useMemo(() => {
    return (f: NavFeature): RenderSlot => {
      switch (f) {
        case 'guild':         return { href: '/guilds',        icon: Users,         label: t('nav.guilds') };
        case 'messages':      return { href: '/messages',      icon: MessageCircle, label: t('nav.messages') };
        case 'shop':          return { href: '/shop',          icon: ShoppingBag,   label: t('nav.shop') };
        case 'explore':       return { href: '/explore',       icon: Compass,       label: t('nav.explore') };
        case 'notifications': return { href: '/notifications', icon: Bell,          label: t('nav.inbox') };
        case 'live':          return { href: '/live',          icon: Video,         label: t('nav.live') };
        case 'women_only':    return { href: '/women-only',    icon: Flower2,       label: 'WOZ' };
      }
    };
  }, [t]);

  const slots: RenderSlot[] = useMemo(() => {
    if (isAuthed === false) {
      // Logged-out: Feed | Explore | Shop (3 Slots).
      return [
        { href: '/',        label: t('nav.feed'),    icon: Home },
        { href: '/explore', label: t('nav.explore'), icon: Compass },
        { href: '/shop',    label: t('nav.shop'),    icon: ShoppingBag },
      ];
    }
    // Authed: Feed | Slot2 | Create | Slot4 | Profil (Slot 2/4 aus DB, Default guild/shop).
    return [
      { href: '/',        label: t('nav.feed'),    icon: Home },
      featureSlot(asFeature(navConfig?.nav_slot_2, 'guild')),
      { href: '/create',  label: t('nav.create'),  icon: PlusSquare, primary: true },
      featureSlot(asFeature(navConfig?.nav_slot_4, 'shop')),
      { href: '/profile', label: t('nav.profile'), icon: UserIcon },
    ];
  }, [isAuthed, navConfig?.nav_slot_2, navConfig?.nav_slot_4, featureSlot, t]);

  return (
    <nav
      aria-label={t('nav.main')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 md:hidden',
        'pb-[env(safe-area-inset-bottom)]',
        'border-t border-border/60 bg-background/90 backdrop-blur-lg',
      )}
    >
      <ul className="flex items-stretch justify-around">
        {slots.map((slot, i) => {
          const Icon = slot.icon;
          const active = isActive(pathname, slot.href);

          const sharedClassName = cn(
            'flex h-14 flex-col items-center justify-center gap-0.5',
            'transition-colors duration-fast ease-out-expo',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            slot.primary || active
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          );
          const innerContent = slot.primary ? (
            // Serlo-Marken-Plus (Pink→Lila), konsistent mit der nativen
            // App-Bottom-Nav (NICHT TikToks cyan/rot — Trade-Dress).
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-rose to-brand-purple text-white shadow-elevation-2">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : (
            <>
              <Icon
                className={cn('h-5 w-5', active ? 'stroke-[2.25]' : 'stroke-[1.75]')}
                aria-hidden="true"
              />
              <span className={cn('text-[10px] leading-none', active ? 'font-semibold' : 'font-medium')}>
                {slot.label}
              </span>
            </>
          );

          return (
            <li key={`${slot.href}-${i}`} className="flex-1">
              <Link
                href={slot.href as Route}
                aria-current={active ? 'page' : undefined}
                aria-label={slot.label}
                className={sharedClassName}
              >
                {innerContent}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
