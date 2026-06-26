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

import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useCallback,useState } from 'react';
import { useAuthStore } from './authStore';
import { supabase } from './supabase';

// ─── Download digitaler Produkte ──────────────────────────────────────────────

import { Linking } from 'react-native';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type ProductCategory = 'digital' | 'physical' | 'service' | 'collectible';

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
  // Echter Euro-Preis (optional). Nur für Vorbestell-/Cash-Produkte
  // (sale_mode <> 'coins') relevant — UI zeigt ihn statt „Preis siehe
  // Beschreibung". Kommt via get_shop_products RPC als number zurück.
  price_eur?: number | null;
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
  // v1.x — Verkaufsart: 'coins' = Coin-Kauf (Standard) · 'preorder' =
  // Sammelbestellung (kein Geld, „Vormerken") · 'cash' = echtes Geld (Phase 1).
  sale_mode?: 'coins' | 'preorder' | 'cash';
  // Joined vom get_shop_products RPC
  seller_username?: string;
  seller_avatar?:   string;
  seller_verified?: boolean;
}

export interface SavedProduct extends Product {
  saved_at: string;
}

// v1.x — Vermietbare Shop-Werbe-Banner (Karussell). DB: shop_banners.
export interface ShopBanner {
  id:         string;
  tag:        string | null;
  title:      string;
  subtitle:   string | null;
  image_url:  string | null;
  bg_color:   string;
  link:       string | null;   // '/route', '/route?x=y' oder 'tab:<key>'
  sort_order: number;
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

// ─── Euro-Preis-Formatter ─────────────────────────────────────────────────────
// Ganze Beträge ohne Nachkommastellen (12 €), krumme mit zweien (7,90 €).
// null/ungültig → null (Aufrufer rendert dann den Fallback).
export function formatEur(value: number | null | undefined): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const hasFraction = Math.round(n * 100) % 100 !== 0;
  return (
    n.toLocaleString('de-DE', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    }) + ' €'
  );
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
  const limit = opts?.limit ?? 30;
  return useQuery<Product[]>({
    queryKey: ['shop-products', opts?.sellerId ?? null, opts?.category ?? null, limit],
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_shop_products', {
        p_seller_id: opts?.sellerId ?? null,
        p_category:  opts?.category  ?? null,
        p_limit:     limit,
        p_offset:    0,
      });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

// ─── Werbe-Banner (Karussell) ─────────────────────────────────────────────────
// Vermietbare Fläche unter den Menü-Shortcuts. RPC filtert serverseitig auf
// aktive + im Zeitfenster liegende Banner. Leere Liste → Karussell rendert nicht.

export function useShopBanners() {
  return useQuery<ShopBanner[]>({
    queryKey: ['shop-banners'],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_shop_banners');
      // Vor der Migration existiert die RPC nicht → leise leer (kein Crash).
      if (error) return [];
      return (data ?? []) as ShopBanner[];
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
      // #3-Fix: auch den öffentlichen Shop-Browse/Explore invalidieren, sonst
      // erscheint ein neu erstelltes Produkt erst nach Ablauf der staleTime.
      qc.invalidateQueries({ queryKey: ['shop-products'] });
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

      // Verkäufer-Benachrichtigung erledigt die buy_product-RPC serverseitig.

      return { success: true, orderId: data.order_id, newBalance: data.new_balance };
    } catch {
      return { success: false, error: 'network_error' };
    } finally {
      setIsBuying(false);
    }
  }, [qc]);

  return { buyProduct, isBuying };
}

// ─── Vorbestellung: Interesse vormerken (kein Geld) ──────────────────────────

export type InterestError =
  | 'not_authenticated' | 'product_not_found' | 'product_inactive'
  | 'not_preorder' | 'cannot_preorder_own' | 'network_error';

export type InterestResult =
  | { success: true }
  | { success: false; error: InterestError };

export function useExpressInterest() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const qc = useQueryClient();

  const expressInterest = useCallback(async (
    productId: string,
    quantity = 1,
    note?: string,
  ): Promise<InterestResult> => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('express_product_interest', {
        p_product_id: productId,
        p_quantity:   Math.max(1, Math.min(Math.round(quantity) || 1, 999)),
        p_note:       note?.trim() || null,
      });
      if (error || !data) return { success: false, error: 'network_error' };
      if (!data.success) return { success: false, error: (data.error ?? 'network_error') as InterestError };
      await qc.invalidateQueries({ queryKey: ['shop-products'] });
      return { success: true };
    } catch {
      return { success: false, error: 'network_error' };
    } finally {
      setIsSubmitting(false);
    }
  }, [qc]);

  return { expressInterest, isSubmitting };
}

// ─── Vorbestellung: eigenen Status prüfen + zurücknehmen ─────────────────────
// Unverbindliche Vormerkung muss reversibel sein. RLS „preorders_owner_all"
// erlaubt dem Käufer Lesen + Löschen der eigenen Zeile — keine RPC nötig.

export function useMyPreorder(productId: string) {
  const user = useAuthStore((s) => s.user);
  const qc   = useQueryClient();
  const [isCancelling, setIsCancelling] = useState(false);

  const { data: preordered = false } = useQuery<boolean>({
    queryKey: ['my-preorder', productId, user?.id],
    enabled:  !!user?.id && !!productId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('product_preorders')
        .select('product_id')
        .eq('product_id', productId)
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  // Cache-Update statt Refetch — der Screen weiß sofort Bescheid.
  const setPreordered = useCallback((val: boolean) => {
    if (user?.id) qc.setQueryData(['my-preorder', productId, user.id], val);
  }, [productId, user?.id, qc]);

  const cancel = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    setIsCancelling(true);
    const { error } = await supabase
      .from('product_preorders')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', user.id);
    setIsCancelling(false);
    if (!error) {
      qc.setQueryData(['my-preorder', productId, user.id], false);
      qc.invalidateQueries({ queryKey: ['shop-products'] });
    }
    return !error;
  }, [productId, user?.id, qc]);

  return { preordered, cancel, isCancelling, setPreordered };
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

// ─── Echtgeld-Bestellungen (physische Ware / Parfüm, Phase 1) ─────────────────
// Getrennt vom coin-basierten Order-System (useMyOrders). Tabelle: product_orders.

export type ProductOrderStatus =
  | 'reserved' | 'payment_requested' | 'paid' | 'shipped'
  | 'delivered' | 'cancelled' | 'refunded' | 'disputed';

export interface ProductOrder {
  id:               string;
  buyer_id:         string;
  seller_id:        string;
  product_id:       string | null;
  quantity:         number;
  unit_price_eur:   number;
  amount_eur:       number;
  status:           ProductOrderStatus;
  ship_name:        string | null;
  ship_street:      string | null;
  ship_zip:         string | null;
  ship_city:        string | null;
  ship_country:     string | null;
  tracking_carrier: string | null;
  tracking_number:  string | null;
  created_at:       string;
  paid_at:          string | null;
  shipped_at:       string | null;
  delivered_at:     string | null;
  product?: { id: string; title: string; cover_url: string | null } | null;
}

const PRODUCT_ORDER_SELECT = '*, product:products(id, title, cover_url)';

// Käufer: eigene Echtgeld-Bestellungen (Status + Tracking = Wiederkehr-Hook)
export function useMyProductOrders() {
  const user = useAuthStore((s) => s.user);
  return useQuery<ProductOrder[]>({
    queryKey: ['product-orders', 'buyer', user?.id],
    enabled:  !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_orders')
        .select(PRODUCT_ORDER_SELECT)
        .eq('buyer_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ProductOrder[];
    },
  });
}

// Verkäufer: eingehende Echtgeld-Bestellungen (zum Versenden)
export function useSellerProductOrders() {
  const user = useAuthStore((s) => s.user);
  return useQuery<ProductOrder[]>({
    queryKey: ['product-orders', 'seller', user?.id],
    enabled:  !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_orders')
        .select(PRODUCT_ORDER_SELECT)
        .eq('seller_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ProductOrder[];
    },
  });
}

// Käufer: Bestellung bezahlen → Stripe Checkout öffnen
export function usePayProductOrder() {
  const [isPaying, setIsPaying] = useState(false);
  const pay = useCallback(async (orderId: string): Promise<{ error?: string }> => {
    setIsPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { order_id: orderId },
      });
      if (error || !data?.url) return { error: 'checkout_failed' };
      await Linking.openURL(data.url as string);
      return {};
    } catch {
      return { error: 'network_error' };
    } finally {
      setIsPaying(false);
    }
  }, []);
  return { pay, isPaying };
}

// Käufer: Empfang bestätigen (shipped → delivered)
export function useConfirmOrderDelivered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc('confirm_order_delivered', { p_order_id: orderId });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-orders'] }); },
  });
}

// Verkäufer: „Ware ist da" → Zahlungsaufforderungen aus Vormerkungen erzeugen
export function useMarkPreordersPayable() {
  const qc = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);
  const markPayable = useCallback(async (productId: string): Promise<{ created?: number; skipped?: number; error?: string }> => {
    setIsWorking(true);
    try {
      const { data, error } = await supabase.rpc('mark_preorders_payable', { p_product_id: productId });
      if (error) return { error: 'network_error' };
      if ((data as any)?.error) return { error: (data as any).error };
      qc.invalidateQueries({ queryKey: ['product-orders'] });
      return { created: (data as any)?.created ?? 0, skipped: (data as any)?.skipped ?? 0 };
    } finally {
      setIsWorking(false);
    }
  }, [qc]);
  return { markPayable, isWorking };
}

// Verkäufer: versendet (+ Tracking)
export function useSetOrderShipped() {
  const qc = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);
  const setShipped = useCallback(async (
    orderId: string, carrier?: string, tracking?: string,
  ): Promise<{ error?: string }> => {
    setIsWorking(true);
    try {
      const { data, error } = await supabase.rpc('set_order_shipped', {
        p_order_id: orderId,
        p_carrier:  carrier?.trim() || null,
        p_tracking: tracking?.trim() || null,
      });
      if (error) return { error: 'network_error' };
      if ((data as any)?.error) return { error: (data as any).error };
      qc.invalidateQueries({ queryKey: ['product-orders'] });
      return {};
    } finally {
      setIsWorking(false);
    }
  }, [qc]);
  return { setShipped, isWorking };
}
