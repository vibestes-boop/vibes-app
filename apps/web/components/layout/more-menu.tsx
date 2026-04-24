'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  MoreHorizontal,
  Settings,
  Coins,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// MoreMenu — v1.w.UI.12 TikTok-Parity.
//
// Footer-Trigger in der FeedSidebar: öffnet auf Klick ein Dropdown nach oben
// (side="top", align="start"), damit das Panel über der Sidebar-Footer-Zeile
// erscheint statt nach unten aus dem Viewport zu laufen.
//
// MVP-Scope (agreed mit User): vier Einträge — Einstellungen, Coin-Shop,
// Dark-Mode-Toggle, Abmelden. Weitere Power-User-Items (Entwürfe, Mein Shop,
// Creator-Studio) bleiben im Avatar-Dropdown des `TopRightActions`; hier
// landen nur die Aktionen, die ein TikTok-Viewer unter „…"-Button erwartet.
//
// Click-Toggle statt Hover — konsistent mit dem Comment-Panel-Pattern aus
// v1.w.UI.11 Phase C und funktioniert auf Touch-Targets.
// -----------------------------------------------------------------------------

export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Weitere Optionen"
          className={cn(
            // v1.w.UI.13: duration-base + ease-out-expo für konsistente
            // Motion-Kurve mit den Glass-Pills im TopRightActions. Der
            // MoreMenu lebt in der Sidebar auf hellem/getintetem Canvas
            // (bg-muted via Hover) — bleibt damit Token-basiert, braucht
            // aber kein Glass-Pattern (kein schwebendes Element).
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-base ease-out-expo',
            'text-muted-foreground hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            // Open-State: controlled `open` triggert den Hervorhebungs-State
            // sofort; Radix' `data-[state=open]`-Selector dient als Backup
            // für den kurzen Frame zwischen Controlled-Update und Portal-Mount.
            'data-[state=open]:bg-muted data-[state=open]:text-foreground',
            open && 'bg-muted text-foreground',
          )}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" />
          <span>Mehr</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            <span>Einstellungen</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/coin-shop">
            <Coins className="h-4 w-4" />
            <span>Coins</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          /*
           * `onSelect(e.preventDefault())` verhindert das Auto-Close des Menus.
           * Darkmode soll in-place kippen, damit der User den Effekt sofort
           * sieht, ohne das Menu jedes Mal neu aufzuklappen.
           */
          onSelect={(event) => {
            event.preventDefault();
            setTheme(isDark ? 'light' : 'dark');
          }}
          aria-label={isDark ? 'Zu hellem Modus wechseln' : 'Zu dunklem Modus wechseln'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{isDark ? 'Hellmodus' : 'Dunkelmodus'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="h-4 w-4" />
              <span>Abmelden</span>
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
