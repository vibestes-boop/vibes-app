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
  // Verkaufsart: 'coins' = Coin-Kauf (Standard) · 'preorder' = €-Vorbestellung
  // (erst vormerken, später per Stripe zahlen). price_eur ist nur bei 'preorder'
  // relevant; PostgREST schreibt beide Spalten direkt (kein RPC).
  sale_mode?:  'coins' | 'preorder' | 'cash';
  price_eur?:  number | null;        // €-Preis bei Vorbestellung (> 0)
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

// ─── Einzelnes Produkt per ID (deep-link-fest) ────────────────────────────────
// get_shop_products liefert nur eine begrenzte Browse-Liste (Limit + women_only-
// Gate) → für Deep-Links (Shoppable Post, geteilter Link, eigenes Produkt) reicht
// das nicht. Dieser Hook lädt das Produkt direkt per ID. RLS erlaubt: aktives
// Produkt für alle (women_only-Gate greift weiter), eigenes Produkt immer (Owner-
// Policy) — so sieht der Verkäufer auch sein eigenes verknüpftes Produkt.
export function useProduct(productId: string | null) {
  return useQuery<Product | null>({
    queryKey: ['product', productId],
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, seller:profiles!seller_id (username, avatar_url, is_verified)')
        .eq('id', productId)
        .maybeSingle();
      if (error || !data) return null;
      const d = data as any;
      return {
        ...d,
        image_urls:      d.image_urls ?? [],
        avg_rating:      d.avg_rating ?? null,
        review_count:    d.review_count ?? 0,
        seller_username: d.seller?.username ?? undefined,
        seller_avatar:   d.seller?.avatar_url ?? undefined,
        seller_verified: d.seller?.is_verified ?? undefined,
      } as Product;
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
      // Guild-Runden-Karte: Fortschritt sofort auffrischen (RollupNumber zählt hoch)
      qc.invalidateQueries({ queryKey: ['active-preorder-round'] });
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
      // Nur OFFENE Vormerkungen zählen als „vorgemerkt" — nach Durchlauf der
      // Bestellung (shipped/cancelled) darf erneut vorgemerkt werden (Repeat-Kauf).
      const { data } = await supabase
        .from('product_preorders')
        .select('product_id')
        .eq('product_id', productId)
        .eq('user_id', user!.id)
        .in('status', ['interested', 'notified'])
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
      // Guild-Runden-Karte: Fortschritt/„Du bist dabei" zurücksetzen
      qc.invalidateQueries({ queryKey: ['active-preorder-round'] });
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
        // Stornierte Coin-Bestellungen ausblenden — meist alte Test-Käufe von
        // gelöschten Produkten („Unbekanntes Produkt / Storniert"), reiner Ballast.
        .neq('status', 'cancelled')
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
  // Bewertungen (nur bei status='delivered'). my_review = was ICH abgegeben habe,
  // received_review = was die Gegenseite über mich schrieb.
  my_review?:       OrderReview | null;
  received_review?: OrderReview | null;
  // Streit-Meldung an dieser Bestellung (open bevorzugt), falls vorhanden.
  dispute?:         OrderDispute | null;
}

export interface OrderReview {
  rating: number;
  comment: string | null;
}

export interface OrderDispute {
  id: string;
  status: 'open' | 'resolved' | 'dismissed';
  reason: string;
  reporter_id: string;
}

const PRODUCT_ORDER_SELECT = '*, product:products(id, title, cover_url)';

// Bewertungen für gelieferte Bestellungen nachladen und an die Orders hängen.
async function attachOrderReviews(orders: ProductOrder[], viewerId: string): Promise<void> {
  const ids = orders.filter((o) => o.status === 'delivered').map((o) => o.id);
  if (ids.length === 0) return;
  const { data } = await supabase
    .from('order_reviews')
    .select('order_id, reviewer_id, rating, comment')
    .in('order_id', ids);
  const map = new Map<string, { mine: OrderReview | null; theirs: OrderReview | null }>();
  for (const r of (data ?? []) as Array<{ order_id: string; reviewer_id: string; rating: number; comment: string | null }>) {
    const e = map.get(r.order_id) ?? { mine: null, theirs: null };
    if (r.reviewer_id === viewerId) e.mine = { rating: r.rating, comment: r.comment };
    else e.theirs = { rating: r.rating, comment: r.comment };
    map.set(r.order_id, e);
  }
  for (const o of orders) {
    const e = map.get(o.id);
    o.my_review = e?.mine ?? null;
    o.received_review = e?.theirs ?? null;
  }
}

// Streit-Meldungen an die Bestellungen hängen (open bevorzugt, sonst neueste).
async function attachOrderDisputes(orders: ProductOrder[]): Promise<void> {
  const ids = orders.filter((o) => ['paid', 'shipped', 'delivered'].includes(o.status)).map((o) => o.id);
  if (ids.length === 0) return;
  const { data } = await supabase
    .from('order_disputes')
    .select('id, order_id, status, reason, reporter_id, created_at')
    .in('order_id', ids)
    .order('created_at', { ascending: false });
  const map = new Map<string, OrderDispute>();
  for (const d of (data ?? []) as Array<{ id: string; order_id: string; status: OrderDispute['status']; reason: string; reporter_id: string }>) {
    const ex = map.get(d.order_id);
    if (!ex || (d.status === 'open' && ex.status !== 'open')) {
      map.set(d.order_id, { id: d.id, status: d.status, reason: d.reason, reporter_id: d.reporter_id });
    }
  }
  for (const o of orders) o.dispute = map.get(o.id) ?? null;
}

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
      const orders = (data ?? []) as ProductOrder[];
      await attachOrderReviews(orders, user!.id);
      await attachOrderDisputes(orders);
      return orders;
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
      const orders = (data ?? []) as ProductOrder[];
      await attachOrderReviews(orders, user!.id);
      await attachOrderDisputes(orders);
      return orders;
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
// ─── Guild-Commerce: Sammelbestellungs-Runden ────────────────────────────────
// Die „Runde" = Zaurs realer Bestell-Zyklus als Objekt (Ziel, Deadline,
// Fortschritt). Guild zeigt sie als „Jetzt aktiv"-Karte; Vorbestellen selbst
// läuft unverändert über express_product_interest.

export interface PreorderRoundParticipant {
  username:   string | null;
  avatar_url: string | null;
}

export interface ActivePreorderRound {
  id:                string;
  product_id:        string;
  title:             string;
  target_qty:        number;
  closes_at:         string;
  status:            'open' | 'closed' | 'arrived';
  reserved_qty:      number;
  participant_count: number;
  me_joined:         boolean;
  participants:      PreorderRoundParticipant[];
  product: {
    id:        string;
    title:     string;
    cover_url: string | null;
    price_eur: number | null;
  } | null;
}

export function useActivePreorderRound() {
  const user = useAuthStore((s) => s.user);
  return useQuery<ActivePreorderRound | null>({
    queryKey: ['active-preorder-round'],
    enabled:  !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_preorder_round');
      // Fehler (z.B. Migration noch nicht ausgeführt) → Karte bleibt einfach weg.
      if (error) return null;
      return (data ?? null) as ActivePreorderRound | null;
    },
  });
}

export function useCreatePreorderRound() {
  const qc = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);
  const createRound = useCallback(async (
    productId: string,
    targetQty: number,
    closesAt:  Date,
    title?:    string,
  ): Promise<{ roundId?: string; error?: string }> => {
    setIsWorking(true);
    try {
      const { data, error } = await supabase.rpc('create_preorder_round', {
        p_product_id: productId,
        p_target_qty: Math.max(1, Math.min(Math.round(targetQty) || 1, 9999)),
        p_closes_at:  closesAt.toISOString(),
        p_title:      title?.trim() || null,
      });
      if (error) return { error: 'network_error' };
      if (!(data as any)?.success) return { error: (data as any)?.error ?? 'network_error' };
      qc.invalidateQueries({ queryKey: ['active-preorder-round'] });
      return { roundId: (data as any).round_id };
    } finally {
      setIsWorking(false);
    }
  }, [qc]);
  return { createRound, isWorking };
}

export function useClosePreorderRound() {
  const qc = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);
  const closeRound = useCallback(async (
    roundId: string,
    status: 'closed' | 'arrived' = 'closed',
  ): Promise<{ error?: string }> => {
    setIsWorking(true);
    try {
      const { data, error } = await supabase.rpc('close_preorder_round', {
        p_round_id: roundId,
        p_status:   status,
      });
      if (error) return { error: 'network_error' };
      if (!(data as any)?.success) return { error: (data as any)?.error ?? 'network_error' };
      qc.invalidateQueries({ queryKey: ['active-preorder-round'] });
      return {};
    } finally {
      setIsWorking(false);
    }
  }, [qc]);
  return { closeRound, isWorking };
}

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
      // Auch die „Ware ist da → Zahlung anfordern"-Liste auffrischen, sonst bleibt
      // die Gruppe stehen und der „Anfordern"-Button ändert sich nicht.
      qc.invalidateQueries({ queryKey: ['preorder-groups'] });
      return { created: (data as any)?.created ?? 0, skipped: (data as any)?.skipped ?? 0 };
    } finally {
      setIsWorking(false);
    }
  }, [qc]);
  return { markPayable, isWorking };
}

// Verkäufer: Shop-Statistik (Parität mit Web getShopAnalytics) — pro Produkt
// sold_count + Coin-Einnahmen (12,5% Anteil aus `orders`, kalibriert) + Echtgeld-Umsatz (€)
// aus `product_orders` (paid/shipped/delivered). Reine Frontend-Aggregation
// (kein RPC), seller-scoped via .eq('seller_id', …) + RLS.
export interface ShopAnalyticsRow {
  product_id:    string;
  title:         string;
  cover_url:     string | null;
  sold_count:    number;
  revenue_coins: number;
  revenue_eur:   number;
}
export interface ShopAnalytics {
  rows:              ShopAnalyticsRow[];
  totalSold:         number;
  totalRevenueCoins: number;
  totalRevenueEur:   number;
}

export function useShopAnalytics() {
  const user = useAuthStore((s) => s.user);
  return useQuery<ShopAnalytics>({
    queryKey: ['shop-analytics', user?.id],
    enabled:  !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const sellerId = user!.id;

      const { data: products } = await supabase
        .from('products')
        .select('id, title, cover_url, sold_count')
        .eq('seller_id', sellerId);
      const prods = (products ?? []) as Array<{ id: string; title: string; cover_url: string | null; sold_count: number | null }>;

      // Coin-Einnahmen aus abgeschlossenen Coin-Käufen (12,5% Verkäufer-Anteil, kalibriert).
      const { data: coinRows } = await supabase
        .from('orders')
        .select('product_id, total_coins')
        .eq('seller_id', sellerId)
        .eq('status', 'completed');
      const coinByProduct = new Map<string, number>();
      for (const r of coinRows ?? []) {
        const pid = (r as any).product_id as string;
        coinByProduct.set(pid, (coinByProduct.get(pid) ?? 0) + ((r as any).total_coins ?? 0));
      }

      // Echtgeld-Umsatz (€) aus bezahlten+ Bestellungen.
      const { data: eurRows } = await supabase
        .from('product_orders')
        .select('product_id, amount_eur')
        .eq('seller_id', sellerId)
        .in('status', ['paid', 'shipped', 'delivered']);
      const eurByProduct = new Map<string, number>();
      for (const r of eurRows ?? []) {
        const pid = (r as any).product_id as string | null;
        if (!pid) continue;
        eurByProduct.set(pid, (eurByProduct.get(pid) ?? 0) + Number((r as any).amount_eur ?? 0));
      }

      const rows: ShopAnalyticsRow[] = prods
        .map((p) => ({
          product_id:    p.id,
          title:         p.title,
          cover_url:     p.cover_url,
          sold_count:    p.sold_count ?? 0,
          revenue_coins: Math.round((coinByProduct.get(p.id) ?? 0) * 0.125),
          revenue_eur:   eurByProduct.get(p.id) ?? 0,
        }))
        .sort((a, b) => (b.revenue_eur - a.revenue_eur) || (b.sold_count - a.sold_count));

      return {
        rows,
        totalSold:         rows.reduce((s, r) => s + r.sold_count, 0),
        totalRevenueCoins: rows.reduce((s, r) => s + r.revenue_coins, 0),
        totalRevenueEur:   rows.reduce((s, r) => s + r.revenue_eur, 0),
      };
    },
  });
}

// Verkäufer: alle offenen Vorbesteller eines Produkts per DM anschreiben
// (notify_preorder_buyers: schreibt allen mit status='interested' eine DM +
// setzt sie auf 'notified'; umgeht den DM-Cooldown + RLS via SECURITY DEFINER).
// Reine DM/Heads-up — erzeugt KEINE bezahlbare Order (das macht markPayable).
// „Sammelbestellung offen" ankündigen: pingt Vormerker + Speicherer eines
// Produkts mit Deep-Link aufs Produkt (announce_preorder_round-RPC).
export function useAnnouncePreorderRound() {
  const qc = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);
  const announce = useCallback(async (
    productId: string, message?: string,
  ): Promise<{ notified?: number; error?: string }> => {
    setIsWorking(true);
    try {
      const { data, error } = await supabase.rpc('announce_preorder_round', {
        p_product_id: productId,
        p_message:    message ?? null,
      });
      if (error) return { error: 'network_error' };
      if ((data as any)?.error) return { error: (data as any).error };
      qc.invalidateQueries({ queryKey: ['preorder-groups'] });
      return { notified: (data as any)?.notified ?? 0 };
    } finally {
      setIsWorking(false);
    }
  }, [qc]);
  return { announce, isWorking };
}

export function useNotifyPreorderBuyers() {
  const qc = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);
  const notifyBuyers = useCallback(async (
    productId: string, message: string,
  ): Promise<{ notified?: number; error?: string }> => {
    setIsWorking(true);
    try {
      const { data, error } = await supabase.rpc('notify_preorder_buyers', {
        p_product_id: productId,
        p_message:    message,
      });
      if (error) return { error: 'network_error' };
      if ((data as any)?.success === false) return { error: (data as any)?.error ?? 'failed' };
      qc.invalidateQueries({ queryKey: ['preorder-groups'] });
      return { notified: (data as any)?.notified ?? 0 };
    } finally {
      setIsWorking(false);
    }
  }, [qc]);
  return { notifyBuyers, isWorking };
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

// Verkäufer: offene Vormerkungen gruppiert pro Produkt (für „Ware ist da") —
// inkl. Personen, Flaschen, wer + seit wann. Parität mit Web getMyPreorderGroups.
// WICHTIG: KEIN profiles-Embed — product_preorders.user_id zeigt auf auth.users,
// nicht profiles (PostgREST findet die Beziehung nicht → PGRST200). Namen daher
// separat per .in() laden.
export interface PreorderGroup {
  id:        string; // product id
  title:     string;
  cover_url: string | null;
  price_eur: number | null;
  people:    number;
  bottles:   number;
  buyers:    string[];
  first_at:  string;
}

export function useMyPreorderGroups() {
  const user = useAuthStore((s) => s.user);
  return useQuery<PreorderGroup[]>({
    queryKey: ['preorder-groups', user?.id],
    enabled:  !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_preorders')
        .select('product_id, user_id, quantity, created_at, product:products!inner(id, title, cover_url, price_eur, seller_id)')
        .eq('product.seller_id', user!.id)
        .in('status', ['interested', 'notified'])
        .order('created_at', { ascending: true });
      if (error) throw error;

      type PreP = { id: string; title: string; cover_url: string | null; price_eur: number | null };
      const rows = (data ?? []) as Array<{
        product_id: string;
        user_id: string;
        quantity: number;
        created_at: string;
        product: PreP | PreP[] | null;
      }>;

      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const nameById = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);
        for (const p of profs ?? []) {
          if (p.username) nameById.set(p.id as string, p.username as string);
        }
      }

      const groups = new Map<string, PreorderGroup>();
      for (const row of rows) {
        const product = Array.isArray(row.product) ? row.product[0] : row.product;
        if (!product) continue;
        let g = groups.get(row.product_id);
        if (!g) {
          g = {
            id: product.id,
            title: product.title,
            cover_url: product.cover_url,
            price_eur: product.price_eur,
            people: 0,
            bottles: 0,
            buyers: [],
            first_at: row.created_at,
          };
          groups.set(row.product_id, g);
        }
        g.people += 1;
        g.bottles += row.quantity ?? 1;
        const uname = nameById.get(row.user_id);
        if (uname) g.buyers.push(uname);
      }
      return [...groups.values()];
    },
  });
}

// Käufer: Bestellung stornieren (nur solange unbezahlt — RPC erzwingt das).
export function useCancelProductOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc('cancel_product_order', { p_order_id: orderId });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-orders'] }); },
  });
}

export interface ShippingAddressInput {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

// Käufer: Lieferadresse ändern (nur solange bezahlt + nicht versendet — RPC-Gate).
export function useUpdateOrderShippingAddress() {
  const qc = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);
  const update = useCallback(async (
    orderId: string, addr: ShippingAddressInput,
  ): Promise<{ error?: string }> => {
    setIsWorking(true);
    try {
      const { data, error } = await supabase.rpc('update_order_shipping_address', {
        p_order_id: orderId,
        p_name: addr.name,
        p_street: addr.street,
        p_zip: addr.zip,
        p_city: addr.city,
        p_country: addr.country,
      });
      if (error) return { error: 'network_error' };
      if ((data as any)?.error) return { error: (data as any).error };
      qc.invalidateQueries({ queryKey: ['product-orders'] });
      return {};
    } finally {
      setIsWorking(false);
    }
  }, [qc]);
  return { update, isWorking };
}

// Bewertung abgeben (Käufer↔Verkäufer, nur nach Lieferung — RPC erzwingt das).
export function useSubmitOrderReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { orderId: string; rating: number; comment?: string }) => {
      const { data, error } = await supabase.rpc('submit_order_review', {
        p_order_id: vars.orderId,
        p_rating: Math.round(vars.rating),
        p_comment: vars.comment?.trim() || null,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-orders'] }); },
  });
}

// Aggregierte Order-Bewertung eines Users (öffentliche Reputation, für Profil).
export interface OrderRatingAgg {
  sellerAvg: number | null;
  sellerCount: number;
  buyerAvg: number | null;
  buyerCount: number;
}

export function useOrderRating(userId: string | undefined) {
  return useQuery<OrderRatingAgg>({
    queryKey: ['order-rating', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc('get_order_rating', { p_user_id: userId });
      const row = (Array.isArray(data) ? data[0] : data) as
        | { seller_avg: number | null; seller_count: number; buyer_avg: number | null; buyer_count: number }
        | null
        | undefined;
      return {
        sellerAvg: row?.seller_avg != null ? Number(row.seller_avg) : null,
        sellerCount: Number(row?.seller_count ?? 0),
        buyerAvg: row?.buyer_avg != null ? Number(row.buyer_avg) : null,
        buyerCount: Number(row?.buyer_count ?? 0),
      };
    },
  });
}

// Problem an einer Bestellung melden (Käufer/Verkäufer, ab Bezahlung — RPC-Gate).
export function useReportOrderDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { orderId: string; reason: string; detail?: string }) => {
      const { data, error } = await supabase.rpc('report_order_dispute', {
        p_order_id: vars.orderId,
        p_reason: vars.reason,
        p_detail: vars.detail?.trim() || null,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-orders'] }); },
  });
}
