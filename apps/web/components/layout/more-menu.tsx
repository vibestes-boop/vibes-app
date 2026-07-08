'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { Route } from 'next';
import { useTheme } from 'next-themes';
import { CoinIcon } from '@/components/ui/coin-icon';
import {
  MoreHorizontal,
  Settings,
  Moon,
  Sun,
  LogOut,
  Bookmark,
  X,
  User,
  HelpCircle,
  FileText,
  Shield,
} from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// MoreMenu — left-side sliding drawer panel (Short-Video-style).
//
// Controlled component: open state + toggle/close callbacks come from the
// parent (FeedSidebar). The panel slides in BESIDE the icon strip
// (left-14 = 56px offset so it doesn't overlap the collapsed sidebar).
// Click outside or press X to close.
// -----------------------------------------------------------------------------

interface Item {
  label: string;
  href?: Route;
  icon: React.ReactNode;
  onClick?: () => void;
  keepOpen?: boolean;
  variant?: 'default' | 'danger';
}

export function MoreMenu({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => { setMounted(true); }, []);

  const items: Item[] = [
    { label: 'Einstellungen',     href: '/settings' as Route,        icon: <Settings className="h-5 w-5" /> },
    { label: 'Coins',             href: '/coin-shop' as Route,       icon: <CoinIcon className="h-5 w-5" /> },
    { label: 'Gespeichert',       href: '/saved' as Route,           icon: <Bookmark className="h-5 w-5" /> },
    { label: 'Profil bearbeiten', href: '/settings/profile' as Route, icon: <User className="h-5 w-5" /> },
    {
      label: isDark ? 'Hellmodus' : 'Dunkelmodus',
      icon: isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />,
      onClick: () => setTheme(isDark ? 'light' : 'dark'),
      keepOpen: true,
    },
    { label: 'Datenschutz',          href: '/privacy' as Route, icon: <Shield className="h-5 w-5" /> },
    { label: 'Nutzungsbedingungen',  href: '/terms' as Route,   icon: <FileText className="h-5 w-5" /> },
    { label: 'Widerrufsbelehrung',   href: '/widerruf' as Route, icon: <FileText className="h-5 w-5" /> },
    { label: 'Hilfe & Support',      href: '/support' as Route, icon: <HelpCircle className="h-5 w-5" /> },
  ];

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        aria-label="Weitere Optionen"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          'text-foreground hover:bg-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-muted',
        )}
      >
        <span className="flex w-8 shrink-0 justify-center">
          <MoreHorizontal className="h-5 w-5" />
        </span>
        {!open && <span>Mehr</span>}
      </button>

      {/* Backdrop + drawer rendered in a portal so fixed positioning works correctly
          regardless of any overflow/transform on parent containers */}
      {mounted && createPortal(
        <>
          {/* Backdrop — beginnt erst rechts der Icon-Leiste (left-20), damit
              der Strip nicht abgedunkelt wird und farblich zum Panel passt */}
          <div
            className={cn(
              'fixed inset-y-0 left-20 right-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300',
              open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
            )}
            onClick={onClose}
            aria-hidden
          />

          {/*
           * Clip-Container an der Kante der Icon-Leiste (left-20 = 80px).
           * overflow-hidden schneidet das Panel links ab, sodass es beim
           * Öffnen aus der Sidebar HERAUSKLAPPT (Short-Video-Verhalten) statt von
           * außerhalb des Bildschirms hereinzurutschen. w-72 statt w-64,
           * damit der rechte Schatten des Panels nicht mit abgeschnitten wird.
           */}
          <div
            className="pointer-events-none fixed left-20 top-0 z-50 h-[100dvh] w-72 overflow-hidden"
            aria-hidden={!open}
          >
            <div
              role="dialog"
              aria-label="Mehr Optionen"
              aria-modal="true"
              className={cn(
                'flex h-full w-64 flex-col bg-card',
                'transition-transform duration-300 ease-out',
                // shadow-2xl nur im Open-State: geschlossen ragt der Schatten
                // sonst über die Panel-Kante in den Clip-Container und zeichnet
                // einen vertikalen Schatten auf die Sidebar.
                open
                  ? 'pointer-events-auto translate-x-0 shadow-2xl'
                  : 'pointer-events-none -translate-x-full',
              )}
            >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <span className="text-base font-semibold">Einstellungen</span>
              <button
                type="button"
                aria-label="Schließen"
                onClick={onClose}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Items */}
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
              {items.map((item) => {
                const inner = (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {item.icon}
                    </span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </>
                );

                const cls = cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                  'text-foreground hover:bg-muted',
                  item.variant === 'danger' && 'text-destructive hover:bg-destructive/10',
                );

                if (item.href) {
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onClose}
                      className={cls}
                    >
                      {inner}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.onClick?.();
                      if (!item.keepOpen) onClose();
                    }}
                    className={cn(cls, 'w-full text-left')}
                  >
                    {inner}
                  </button>
                );
              })}
            </nav>

            {/* Sign out */}
            <div className="border-t p-3">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-destructive transition-colors hover:bg-destructive/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                    <LogOut className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium">Abmelden</span>
                </button>
              </form>
            </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
