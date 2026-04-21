import Link from 'next/link';
import { UserX, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getT } from '@/lib/i18n/server';

// -----------------------------------------------------------------------------
// /u/[username] — 404.
// Wird von `notFound()` in page.tsx getriggert, wenn getPublicProfile null gibt.
// `robots: noindex` setzen wir bereits in generateMetadata, also reicht hier UI.
// -----------------------------------------------------------------------------

export default async function ProfileNotFound() {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <UserX className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('profile.nfTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.nfHint')}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <Search className="h-4 w-4" />
            {t('profile.nfHome')}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/signup">{t('profile.nfSignup')}</Link>
        </Button>
      </div>
    </main>
  );
}
