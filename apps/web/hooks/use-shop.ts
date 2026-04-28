'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  toggleSaveProduct,
  buyProduct,
  submitReview,
  deleteReview,
  reportProduct,
  toggleProductActive,
  deleteProduct,
  getMyReviewAction,
  type ActionResult,
  type BuyResult,
} from '@/app/actions/shop';
import type { ShopProduct } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// Shop-Client-Mutations — Optimistic wo es visuell wichtig ist (Save-Toggle),
// server-first wo Korrektheit regiert (Buy, Review, Delete).
// -----------------------------------------------------------------------------

function unwrap<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

// -----------------------------------------------------------------------------
// useToggleSaveProduct — Merken-Button. Setzt saved_by_me in allen Shop-Caches.
// -----------------------------------------------------------------------------

type SaveArgs = { productId: string; saved: boolean };

export function useToggleSaveProduct() {
  const qc = useQueryClient();

  const patchCaches = (productId: string, nextSaved: boolean) => {
    // Alle Shop-Listen- UND Detail-Keys matchen. Weicher Predicate, damit wir
    // den exakten Key nicht kennen müssen (Catalog, Merchant, Saved-List, Detail).
    qc.setQueriesData<ShopProduct[] | ShopProduct | undefined>(
      { predicate: (q) => q.queryKey[0] === 'shop' || q.queryKey[0] === 'product' },
      (prev) => {
        if (!prev) return prev;
        if (Array.isArray(prev)) {
          return prev.map((p) => (p.id === productId ? { ...p, saved_by_me: nextSaved } : p));
        }
        if (prev.id === productId) return { ...prev, saved_by_me: nextSaved };
        return prev;
      },
    );
  };

  return useMutation({
    mutationFn: async ({ productId, saved }: SaveArgs) =>
      unwrap(await toggleSaveProduct(productId, saved)),
    onMutate: async ({ productId, saved }) => {
      await qc.cancelQueries({ queryKey: ['shop'] });
      const snapshot = qc.getQueriesData({ queryKey: ['shop'] });
      patchCaches(productId, !saved);
      return { snapshot };
    },
    onSuccess: ({ saved }) => {
      toast.success(saved ? 'Gemerkt' : 'Nicht mehr gemerkt');
    },
    onError: (err, vars, ctx) => {
      // Rollback: die vorher geschnappten Snapshots zurückspielen
      if (ctx?.snapshot) {
        for (const [key, data] of ctx.snapshot) qc.setQueryData(key, data);
      }
      // Zusätzlich den optimistic Patch in den nicht-gesnapshotteten Listen
      // wieder umdrehen (saved bleibt = alter Zustand):
      patchCaches(vars.productId, vars.saved);
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ['shop', 'saved'] });
      qc.invalidateQueries({ queryKey: ['product', vars.productId] });
    },
  });
}

// -----------------------------------------------------------------------------
// useBuyProduct — kein Optimistic, weil wir den Order-Id und new_balance vom
// Server brauchen. Success-Callback kann vom Caller übernommen werden (Confirm-
// Modal schließen, Toast, Redirect auf /studio/orders, …).
// -----------------------------------------------------------------------------

type BuyArgs = { productId: string; quantity: number };

export function useBuyProduct(opts?: { onSuccess?: (r: BuyResult) => void }) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, quantity }: BuyArgs) =>
      unwrap(await buyProduct(productId, quantity)),
    onSuccess: (result, vars) => {
      toast.success('Kauf erfolgreich');
      qc.invalidateQueries({ queryKey: ['shop'] });
      qc.invalidateQueries({ queryKey: ['product', vars.productId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['coin-balance'] });
      opts?.onSuccess?.(result);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Kauf fehlgeschlagen');
    },
  });
}

// -----------------------------------------------------------------------------
// useMyReview — für ReviewDialog auf der Orders-Page (client-side fetch).
// productId=null → skip.
// -----------------------------------------------------------------------------

export function useMyReview(productId: string | null) {
  return useQuery({
    queryKey: ['my-review', productId],
    queryFn: () => getMyReviewAction(productId!),
    enabled: !!productId,
    staleTime: 60_000,
  });
}

// -----------------------------------------------------------------------------
// useSubmitReview
// -----------------------------------------------------------------------------

type ReviewArgs = { productId: string; rating: number; comment?: string | null };

export function useSubmitReview() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: ReviewArgs) => unwrap(await submitReview(args)),
    onSuccess: (_d, vars) => {
      toast.success('Bewertung gespeichert');
      qc.invalidateQueries({ queryKey: ['reviews', vars.productId] });
      qc.invalidateQueries({ queryKey: ['product', vars.productId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Bewertung fehlgeschlagen');
    },
  });
}

export function useDeleteReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: string) => unwrap(await deleteReview(reviewId)),
    onSuccess: () => {
      toast.success('Bewertung gelöscht');
      qc.invalidateQueries({ queryKey: ['reviews', productId] });
      qc.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
}

// -----------------------------------------------------------------------------
// useReportProduct
// -----------------------------------------------------------------------------

export function useReportProduct() {
  return useMutation({
    mutationFn: async (args: { productId: string; reason: string }) =>
      unwrap(await reportProduct(args)),
    onSuccess: () => toast.success('Gemeldet. Danke für dein Feedback.'),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Melden fehlgeschlagen'),
  });
}

// -----------------------------------------------------------------------------
// useToggleProductActive + useDeleteProduct — Studio-CRUD-Mutations.
// -----------------------------------------------------------------------------

export function useToggleProductActive() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { productId: string; nextActive: boolean }) =>
      unwrap(await toggleProductActive(args.productId, args.nextActive)),
    onMutate: async ({ productId, nextActive }) => {
      await qc.cancelQueries({ queryKey: ['shop', 'my'] });
      const prev = qc.getQueryData<ShopProduct[]>(['shop', 'my']);
      if (prev) {
        qc.setQueryData<ShopProduct[]>(
          ['shop', 'my'],
          prev.map((p) => (p.id === productId ? { ...p, is_active: nextActive } : p)),
        );
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['shop', 'my'], ctx.prev);
      toast.error(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    },
    onSuccess: (_d, { nextActive }) => {
      toast.success(nextActive ? 'Produkt aktiviert' : 'Produkt deaktiviert');
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => unwrap(await deleteProduct(productId)),
    onSuccess: () => {
      toast.success('Produkt gelöscht');
      qc.invalidateQueries({ queryKey: ['shop'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen'),
  });
}
