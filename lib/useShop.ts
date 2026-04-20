/**
 * lib/useShop.ts — Mini-Shop Hooks
 *
 * useMyProducts:          Creator lädt eigene Produkte
 * useShopProducts:        Käuferin browsed alle aktiven Produkte
 * useCreateProduct:       Creator erstellt ein Produkt
 * useUpdateProduct:       Creator bearbeitet ein Produkt
 * useDeleteProduct:       Creator löscht ein Produkt
 * useBuyProduct:          Käuferin kauft ein Produkt (RPC: buy_product)
 * useSavedProduct:        Prüft + toggled ob Produkt gespeichert ist
 * useSavedProducts:       Lädt alle gespeicherten Produkte der Userin
 * useReportProduct:       Meldet ein Produkt (RPC: create_report)
 * useDownloadDigitalProduct: Download-URL für digitale Produkte
 */

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type ProductCategory = 'digital' | 'physical' | 'service';

export interface Product {
  id:          string;
  seller_id:   string;
  title:       string;
  description: string | null;
  price_coins: number;
  // v1.26.3: Angebots-Preis (optional). Wenn gesetzt, ist dies der aktuell
  // gültige Verkaufspreis; price_coins bleibt „Originalpreis" für die
  // durchgestrichene Anzeige. buy_product RPC bucht sale_price_coins ab.
  sale_price_coins: number | null;
  category:    ProductCategory;
  cover_url:   string | null;
  image_urls:  string[];         // Zusätzliche Bilder (Galerie)
  file_url:    string | null;    // Digitale Produkte
  is_active:   boolean;
  stock:       number;           // -1 = unbegrenzt
  women_only:  boolean;
  free_shipping: boolean;        // v1.26.3: „Gratis Versand"-Label für physische Produkte
  location:    string | null;    // v1.26.3: Produkt-Standort (Freitext, z.B. „Berlin, DE")
  sold_count:  number;
  created_at:  string;
  avg_rating:   number | null; // Durchschnitt aus product_reviews
  review_count: number;        // Anzahl Bewertungen
  // Joined vom get_shop_products RPC
  seller_username?: string;
  seller_avatar?:   string;
  seller_verified?: boolean;
}

export interface SavedProduct extends Product {
  saved_at: string;
}

export interface CreateProductInput {
  title:       string;
  description: string;
  price_coins: number;
  category:    ProductCategory;
  cover_url:   string | null;
  image_urls:  string[];        // Galerie-Bilder
  file_url:    string | null;
  stock:       number;
  women_only:  boolean;
  // v1.26.2: Aktivierungs-Status ist jetzt Teil des Edit-Flows (statt
  // separatem Eye-Icon-Quick-Toggle, der zu versehentlichen Deaktivierungen
  // geführt hat). Bei create optional (Default true via DB-Spalte).
  is_active?:  boolean;
  // v1.26.3: Richer Shop-Cards. Alle optional, nullable in DB.
  sale_price_coins?: number | null;  // < price_coins (DB-CHECK); null = kein Angebot
  free_shipping?:    boolean;        // nur relevant für category=physical
  location?:         string | null;  // Freitext-Ort, z.B. „Berlin, DE"
}

// ─── Eigene Produkte laden (Creator) ─────────────────────────────────────────

export function useMyProducts() {
  const user = useAuthStore((s) => s.user);
  return useQuery<Product[]>({
    queryKey: ['my-products', user?.id],
    enabled:  !!user?.id,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

// ─── Alle aktiven Produkte (Käuferin / Explore) ───────────────────────────────

export function useShopProducts(opts?: {
  sellerId?:  string;
  category?:  ProductCategory;
  limit?:     number;
}) {
  return useQuery<Product[]>({
    queryKey: ['shop-products', opts?.sellerId, opts?.category],
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_shop_products', {
        p_seller_id: opts?.sellerId ?? null,
        p_category:  opts?.category  ?? null,
        p_limit:     opts?.limit     ?? 30,
        p_offset:    0,
      });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

// ─── Produkt erstellen ────────────────────────────────────────────────────────

export function useCreateProduct() {
  const user = useAuthStore((s) => s.user);
  const qc   = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      if (!user?.id) throw new Error('Nicht eingeloggt');
      const { data, error } = await supabase
        .from('products')
        .insert({ ...input, seller_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-products'] });
    },
  });
}

// ─── Produkt bearbeiten ───────────────────────────────────────────────────────

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CreateProductInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-products'] });
      qc.invalidateQueries({ queryKey: ['shop-products'] });
    },
  });
}

// ─── Produkt (de)aktivieren ───────────────────────────────────────────────────

export function useToggleProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-products'] });
      qc.invalidateQueries({ queryKey: ['shop-products'] });
    },
  });
}

// ─── Produkt löschen ──────────────────────────────────────────────────────────

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-products'] });
    },
  });
}

// ─── Produkt kaufen ───────────────────────────────────────────────────────────

export type BuyResult =
  | { success: true;  orderId: string; newBalance: number }
  | { success: false; error: 'insufficient_coins' | 'no_wallet' | 'cannot_buy_own' | 'product_not_found' | 'out_of_stock' | 'network_error' };

export function useBuyProduct() {
  const [isBuying, setIsBuying] = useState(false);
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const buyProduct = useCallback(async (
    productId: string,
    quantity = 1,
  ): Promise<BuyResult> => {
    setIsBuying(true);
    try {
      const { data, error } = await supabase.rpc('buy_product', {
        p_product_id: productId,
        p_quantity:   quantity,
      });
      if (error || !data) return { success: false, error: 'network_error' };
      if (data.error) return { success: false, error: data.error as 'insufficient_coins' | 'no_wallet' | 'cannot_buy_own' | 'product_not_found' | 'out_of_stock' | 'network_error' };

      // Cache invalidieren
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['my-orders'] }),
        qc.invalidateQueries({ queryKey: ['shop-products'] }),
      ]);

      // Verkäufer benachrichtigen (fire & forget)
      supabase
        .from('products')
        .select('title, creator_id')
        .eq('id', productId)
        .single()
        .then(({ data: product }) => {
          if (!product?.creator_id || !user?.id) return;
          supabase.from('notifications').insert({
            recipient_id:  product.creator_id,
            sender_id:     user.id,
            type:          'new_order',
            product_name:  product.title,
            comment_text:  product.title,
          }).then();
        });

      return { success: true, orderId: data.order_id, newBalance: data.new_balance };
    } catch {
      return { success: false, error: 'network_error' };
    } finally {
      setIsBuying(false);
    }
  }, [qc, user]);

  return { buyProduct, isBuying };
}

// ─── Bestellungen laden ───────────────────────────────────────────────────────

export interface Order {
  id:             string;
  buyer_id:       string;
  seller_id:      string;
  product_id:     string;
  quantity:       number;
  total_coins:    number;
  status:         'pending' | 'completed' | 'cancelled' | 'refunded';
  delivery_notes: string | null;
  download_url:   string | null;
  created_at:     string;
  // Joined
  product?: Pick<Product, 'id' | 'title' | 'cover_url' | 'category'>;
}

export function useMyOrders(role: 'buyer' | 'seller' = 'buyer') {
  const user = useAuthStore((s) => s.user);
  return useQuery<Order[]>({
    queryKey: ['my-orders', user?.id, role],
    enabled:  !!user?.id,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const col = role === 'buyer' ? 'buyer_id' : 'seller_id';
      const { data, error } = await supabase
        .from('orders')
        .select('*, product:products(id, title, cover_url, category, file_url)')
        .eq(col, user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });
}

// ─── Download digitaler Produkte ──────────────────────────────────────────────

import { Linking } from 'react-native';

export function useDownloadDigitalProduct() {
  const [isLoading, setIsLoading] = useState(false);

  const download = async (orderId: string): Promise<{ error?: string }> => {
    setIsLoading(true);
    try {
      // 1. Storage-Pfad vom Server holen (Sicherheitscheck im RPC)
      const { data, error } = await supabase.rpc('generate_download_url', {
        p_order_id: orderId,
      });
      if (error || !data) return { error: 'rpc_error' };
      if ((data as any).error) return { error: (data as any).error };

      const { bucket, file_path } = data as { bucket: string; file_path: string };

      // 2. Signed URL erstellen (1 Stunde gültig)
      const { data: signed, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(file_path, 3600);

      if (signErr || !signed?.signedUrl) return { error: 'signed_url_error' };

      // 3. Im System-Browser öffnen (Download startet automatisch)
      await Linking.openURL(signed.signedUrl);
      return {};
    } catch {
      return { error: 'network_error' };
    } finally {
      setIsLoading(false);
    }
  };

  return { download, isLoading };
}

// ─── Gespeichertes Produkt (Bookmark) ────────────────────────────────────────

export function useSavedProduct(productId: string) {
  const user = useAuthStore((s) => s.user);
  const qc   = useQueryClient();

  const { data: saved = false, isLoading } = useQuery<boolean>({
    queryKey: ['saved-product', productId, user?.id],
    enabled:  !!user?.id && !!productId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_product_saved', {
        p_product_id: productId,
      });
      if (error) throw error;
      return !!data;
    },
  });

  const toggle = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    // Optimistisches Update
    const nextSaved = !saved;
    qc.setQueryData(['saved-product', productId, user.id], nextSaved);

    const { data, error } = await supabase.rpc('toggle_save_product', {
      p_product_id: productId,
    });

    if (error) {
      // Rollback
      qc.setQueryData(['saved-product', productId, user.id], saved);
      return saved;
    }

    const result = data as { saved: boolean } | null;
    const actual = result?.saved ?? nextSaved;
    qc.setQueryData(['saved-product', productId, user.id], actual);

    // Saved-Products-Liste invalidieren
    qc.invalidateQueries({ queryKey: ['saved-products', user.id] });

    return actual;
  }, [saved, productId, user?.id, qc]);

  return { saved, toggle, isLoading };
}

// ─── Alle gespeicherten Produkte ─────────────────────────────────────────────

export function useSavedProducts() {
  const user = useAuthStore((s) => s.user);
  return useQuery<SavedProduct[]>({
    queryKey: ['saved-products', user?.id],
    enabled:  !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_saved_products', {
        p_limit:  50,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as SavedProduct[];
    },
  });
}

// ─── Produkt melden ──────────────────────────────────────────────────────────

export type ReportReason =
  | 'spam'
  | 'fake_product'
  | 'inappropriate'
  | 'scam'
  | 'intellectual_property'
  | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam',                 label: 'Spam / Werbung'         },
  { key: 'fake_product',         label: 'Gefälschtes Produkt'    },
  { key: 'inappropriate',        label: 'Unangemessener Inhalt'  },
  { key: 'scam',                 label: 'Betrug'                 },
  { key: 'intellectual_property',label: 'Urheberrechtsverletzung'},
  { key: 'other',                label: 'Sonstiges'              },
];

export function useReportProduct() {
  const [isReporting, setIsReporting] = useState(false);

  const report = async (
    productId: string,
    reason: ReportReason
  ): Promise<{ success: boolean; error?: string }> => {
    setIsReporting(true);
    try {
      const { data, error } = await supabase.rpc('create_report', {
        p_target_type: 'product',
        p_target_id:   productId,
        p_reason:      reason,
      });
      if (error) return { success: false, error: 'network_error' };
      if ((data as any)?.error) return { success: false, error: (data as any).error };
      return { success: true };
    } catch {
      return { success: false, error: 'network_error' };
    } finally {
      setIsReporting(false);
    }
  };

  return { report, isReporting };
}
