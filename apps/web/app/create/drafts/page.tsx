import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { FileText, ArrowLeft } from 'lucide-react';
import { getUser } from '@/lib/auth/session';
import { getMyDrafts } from '@/lib/data/posts';
import { DraftRowActions } from '@/components/create/draft-row-actions';

// -----------------------------------------------------------------------------
// /create/drafts — Cloud-Draft-Liste. Nutzt `post_drafts`-Tabelle, RLS sorgt
// dafür dass nur eigene Drafts sichtbar sind. Resume-Editing via
// `/create?draftId=…`. Löschen per Server-Action `deleteDraft`.
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export default async function DraftsPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/create/drafts');

  const drafts = await getMyDrafts();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 lg:px-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href={'/create' as Route}
          className="grid h-9 w-9 place-items-center rounded-full border hover:bg-muted"
          aria-label="Zurück"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Entwürfe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {drafts.length === 0
              ? 'Noch keine gespeicherten Entwürfe.'
              : `${drafts.length} gespeichert — auch auf deinem Handy sichtbar.`}
          </p>
        </div>
      </header>

      {drafts.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-muted">
            <FileText className="h-8 w-8" />
          </div>
          <p className="max-w-md text-sm">
            Du hast noch keine Entwürfe. Schreib einen Post in{' '}
            <Link href={'/create' as Route} className="text-foreground underline">
              /create
            </Link>{' '}
            und speichere ihn über den „Entwurf"-Button — er taucht dann hier und
            auf deinem Handy auf.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/30"
            >
              <Link
                href={`/create?draftId=${d.id}` as Route}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                <div className="relative h-16 w-16 flex-none overflow-hidden rounded-lg bg-muted">
                  {d.thumbnail_url ? (
                    <Image src={d.thumbnail_url} alt="" fill className="object-cover" sizes="64px" />
                  ) : d.media_url && d.media_type === 'image' ? (
                    <Image src={d.media_url} alt="" fill className="object-cover" sizes="64px" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                      <FileText className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {d.caption?.trim() || <span className="italic text-muted-foreground">Ohne Caption</span>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatRelative(d.updated_at)}</span>
                    {d.media_type && <span>· {d.media_type === 'video' ? 'Video' : 'Bild'}</span>}
                    {d.tags && d.tags.length > 0 && <span>· {d.tags.length} Tag{d.tags.length === 1 ? '' : 's'}</span>}
                  </div>
                </div>
              </Link>
              <DraftRowActions draftId={d.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `vor ${days} Tagen`;
  return d.toLocaleDateString('de-DE');
}
