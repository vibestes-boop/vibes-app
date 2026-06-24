import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { Boxes, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const metadata: Metadata = {
  title: 'Vorbestellungen · Serlo',
  description: 'Gesammeltes Interesse an deinen Sammelbestellungen.',
};

export const dynamic = 'force-dynamic';

type Summary = {
  product_id: string;
  title: string;
  cover_url: string | null;
  interested_count: number | string;
  total_quantity: number | string;
};

type Interest = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  quantity: number;
  note: string | null;
  status: string;
  created_at: string;
};

export default async function PreordersPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/studio/shop/preorders');

  const supabase = await createClient();
  const { data: summaryData } = await supabase.rpc('get_my_preorder_summary');
  const summary = (summaryData ?? []) as Summary[];

  // Namensliste pro Produkt (zum Anschreiben) — wenige Produkte, daher seriell ok.
  const lists = await Promise.all(
    summary.map(async (s) => {
      const { data } = await supabase.rpc('get_product_preorders', {
        p_product_id: s.product_id,
      });
      return [s.product_id, (data ?? []) as Interest[]] as const;
    }),
  );
  const listMap = new Map(lists);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <Link
        href={'/studio/shop' as Route}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Shop-Studio
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Boxes className="h-6 w-6 text-primary" />
        Vorbestellungen
      </h1>
      <p className="mb-8 mt-1 text-sm text-muted-foreground">
        Gesammeltes Interesse an deinen Sammelbestellungen — kein Geld geflossen.
        Sobald genug zusammenkommt: bestellen, anschreiben, bei Lieferung kassieren.
      </p>

      {summary.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-8 w-8" strokeWidth={1.75} />}
          title="Noch keine Vorbestellungen"
          description="Markiere im Shop-Studio ein Produkt als „Vorbestellung“ (Menü → Als Vorbestellung). Dann sammeln sich hier die Interessenten."
          size="md"
          bordered
        />
      ) : (
        <div className="space-y-4">
          {summary.map((s) => {
            const people = listMap.get(s.product_id) ?? [];
            const count = Number(s.interested_count);
            const qty = Number(s.total_quantity);
            return (
              <div key={s.product_id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/shop/${s.product_id}` as Route}
                    className="line-clamp-1 font-semibold hover:underline"
                  >
                    {s.title}
                  </Link>
                  <span className="flex-none rounded-full bg-amber-600/15 px-2.5 py-1 text-xs font-medium text-amber-700 tabular-nums dark:text-amber-400">
                    {count} {count === 1 ? 'Person' : 'Leute'} · {qty} Flaschen
                  </span>
                </div>

                {people.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Noch niemand vorgemerkt.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y">
                    {people.map((p) => (
                      <li key={p.user_id} className="flex items-center gap-3 py-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.avatar_url ?? undefined} alt="" />
                          <AvatarFallback className="text-xs">
                            {p.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <Link
                          href={`/u/${p.username}` as Route}
                          className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                        >
                          @{p.username}
                          {p.note ? (
                            <span className="ml-1 font-normal text-muted-foreground">
                              — {p.note}
                            </span>
                          ) : null}
                        </Link>
                        <span className="flex-none text-sm font-semibold tabular-nums">
                          {p.quantity}×
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
