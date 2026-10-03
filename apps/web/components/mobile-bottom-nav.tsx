'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { Zap, Compass, Plus, MessageCircle, UserRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

// Same stable destinations as the native app. Account state changes the login
// destination, never the position or meaning of a tab.
export function MobileBottomNav({ isAuthed, viewerUsername }: {
  isAuthed: boolean | null;
  viewerUsername?: string | null;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const slots = [
    { href: '/', label: t('nav.feed'), icon: Zap },
    { href: '/explore', label: t('nav.explore'), icon: Compass },
    { href: '/create', label: t('nav.create'), icon: Plus, protected: true },
    { href: '/messages', label: t('nav.messages'), icon: MessageCircle, protected: true },
    { href: '/profile', label: t('nav.profile'), icon: UserRound, protected: true },
  ];

  return (
    <nav aria-label={t('nav.main')} className="serlo-mobile-dock xl:hidden">
      <ul>
        {slots.map(({ href, label, icon: Icon, protected: gated }) => {
          const ownProfile = href === '/profile' && !!viewerUsername && (
            pathname === `/u/${viewerUsername}` || pathname.startsWith(`/u/${viewerUsername}/`)
          );
          const active = pathname === href || ownProfile || (href !== '/' && pathname.startsWith(`${href}/`));
          const destination = gated && isAuthed === false ? `/login?next=${encodeURIComponent(href)}` : href;
          return (
            <li key={href}>
              <Link href={destination as Route} aria-current={active ? 'page' : undefined} aria-label={label}>
                <span className={href === '/create' ? 'serlo-dock-create' : 'serlo-dock-icon'}>
                  <Icon size={24} strokeWidth={active ? 2.1 : 1.7} aria-hidden="true" />
                </span>
                <span className="serlo-dock-label">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
