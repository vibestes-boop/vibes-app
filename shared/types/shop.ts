export type ProductCategory = 'physical' | 'digital' | 'service' | 'collectible';

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  category: ProductCategory;
  price_coins: number;
  sale_price_coins: number | null;
  stock: number; // -1 = unlimited
  cover_url: string | null;
  image_urls: string[];
  free_shipping: boolean;
  location: string | null;
  women_only: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductWithSeller extends Product {
  seller: {
    id: string;
    username: string;
    avatar_url: string | null;
    verified: boolean;
  };
}

export interface ShopReview {
  id: string;
  product_id: string;
  buyer_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string | null;
  created_at: string;
}
