import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { Boxes, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  PreorderContactButton,
  PreorderNotifyAllButton,
  PreorderRequestPaymentButton,
} from '@/components/shop/preorder-contact';

export const metadata: Metadata = {
  title: 'Vorbestellungen · Serlo',
  description: 'Gesammeltes Interesse an deinen Sammelbestellungen.',
};

export const dynamic = 'force-dynamic';

// „zuletzt angefordert vor X" — kompakt.
function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'gerade eben';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `vor ${mins} Min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std`;
  const days = Math.floor(hrs / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

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

  // €-Preis je Produkt (für „Zahlung anfordern"). get_my_preorder_summary liefert
  // ihn nicht → separat aus products laden.
  const priceMap = new Map<string, number | null>();
  if (summary.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, price_eur')
      .in('id', summary.map((s) => s.product_id));
    for (const p of prods ?? []) {
      priceMap.set(p.id as string, (p.price_eur as number | null) ?? null);
    }
  }

  // Pro Produkt: wie viele Bestellungen schon „handled" (angefordert/bezahlt/
  // versandt/geliefert) und wie viele warten noch auf Zahlung (payment_requested)
  // + jüngster Anfrage-Zeitpunkt (#4). Ein Produkt verschwindet aus dieser Liste,
  // sobald niemand mehr offen ist UND keine Zahlung mehr aussteht (alles bezahlt
  // → läuft unter „Bestellungen" als Versand weiter).
  const HANDLED = ['payment_requested', 'paid', 'shipped', 'delivered'];
  const ordersMap = new Map<string, { handled: number; waiting: number; lastAt: string | null }>();
  if (summary.length > 0) {
    const { data: reqOrders } = await supabase
      .from('product_orders')
      .select('product_id, status, created_at')
      .eq('seller_id', user.id)
      .in('status', HANDLED)
      .in('product_id', summary.map((s) => s.product_id));
    for (const o of reqOrders ?? []) {
      const pid = o.product_id as string | null;
      if (!pid) continue;
      const cur = ordersMap.get(pid) ?? { handled: 0, waiting: 0, lastAt: null };
      cur.handled += 1;
      if (o.status === 'payment_requested') {
        cur.waiting += 1;
        const at = o.created_at as string;
        if (!cur.lastAt || at > cur.lastAt) cur.lastAt = at;
      }
      ordersMap.set(pid, cur);
    }
  }

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
        Gesammeltes Interesse an deinen Sammelbestellungen. Schreib Interessenten
        an („Alle anschreiben“) und sobald die Ware da ist, fordere die Zahlung an —
        daraus werden bezahlbare Bestellungen, die du dann unter{' '}
        <Link href={'/studio/orders?role=seller' as Route} className="font-medium text-foreground hover:underline">
          Bestellungen
        </Link>{' '}
        versendest.
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
            // Wie viele wurden noch NICHT angeschrieben (status='interested')?
            const interestedCount = people.filter((p) => p.status === 'interested').length;
            const ord = ordersMap.get(s.product_id);
            const handledCount = ord?.handled ?? 0;
            const waitingCount = ord?.waiting ?? 0;
            const newCount = Math.max(0, count - handledCount); // #2/#3
            // Verschwindet, sobald nichts mehr offen UND keine Zahlung aussteht
            // (alles bezahlt → unten in „Bestellungen" als Versand).
            if (newCount === 0 && waitingCount === 0) return null;
            return (
              <div key={s.product_id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/shop/${s.product_id}` as Route}
                    className="line-clamp-1 font-semibold hover:underline"
                  >
                    {s.title}
                  </Link>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="rounded-full bg-amber-600/15 px-2.5 py-1 text-xs font-medium text-amber-700 tabular-nums dark:text-amber-400">
                      {count} {count === 1 ? 'Person' : 'Leute'} · {qty} Flaschen
                    </span>
                    <PreorderNotifyAllButton
                      productId={s.product_id}
                      title={s.title}
                      count={interestedCount}
                    />
                    <PreorderRequestPaymentButton
                      productId={s.product_id}
                      title={s.title}
                      priceEur={priceMap.get(s.product_id) ?? null}
                      requestedCount={handledCount}
                      waitingCount={waitingCount}
                      peopleCount={count}
                    />
                  </div>
                </div>

                {/* #1 Zähler (wartende Zahlungen) + #2/#3 neu + #4 Zeitstempel */}
                {(waitingCount > 0 || (handledCount > 0 && newCount > 0)) && (
                  <p
                    className={
                      handledCount > 0 && newCount > 0
                        ? 'mt-2 text-xs font-medium text-foreground'
                        : 'mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {waitingCount > 0 ? `✓ ${waitingCount} ${waitingCount === 1 ? 'wartet' : 'warten'} auf Zahlung` : ''}
                    {handledCount > 0 && newCount > 0 ? `${waitingCount > 0 ? ' · ' : ''}${newCount} neu` : ''}
                    {ord?.lastAt ? ` · zuletzt ${timeAgo(ord.lastAt)}` : ''}
                  </p>
                )}

                {people.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Noch niemand vorgemerkt.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y">
                    {people.map((p) => (
                      <li key={p.user_id} className="flex items-center gap-2.5 py-2">
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
                        {p.status === 'notified' ? (
                          <span className="flex-none rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            ✓ angeschrieben
                          </span>
                        ) : null}
                        <span className="flex-none text-sm font-semibold tabular-nums">
                          {p.quantity}×
                        </span>
                        <PreorderContactButton buyerId={p.user_id} productId={s.product_id} />
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
