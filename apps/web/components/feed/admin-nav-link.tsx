'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// -----------------------------------------------------------------------------
// AdminNavLink — Admin-Panel-Link in der FeedSidebar.
//
// Self-contained: fetcht is_admin einmalig via Supabase-Browser-Client.
// Rendert nichts wenn der User kein Admin ist oder nicht eingeloggt.
// Kein Prop-Threading durch die gesamte Shell nötig.
// v1.w.UI.215
// -----------------------------------------------------------------------------

export function AdminNavLink() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();

      if (!cancelled && (data as { is_admin?: boolean } | null)?.is_admin) {
        setIsAdmin(true);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  if (!isAdmin) return null;

  const active = pathname.startsWith('/admin');

  return (
    <Link
      href={'/admin' as Route}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Shield className="h-5 w-5 shrink-0" />
      <span>Admin-Panel</span>
    </Link>
  );
}
