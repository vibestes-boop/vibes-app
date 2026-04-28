import { z } from 'zod';

export const productCategoryEnum = z.enum(['physical', 'digital', 'service', 'collectible']);

// -----------------------------------------------------------------------------
// Base-Object separiert, damit wir es für `.partial()` (productUpdateSchema)
// wiederverwenden können — `.refine()`/`.superRefine()` wrappen das Schema in
// `ZodEffects`, das kein `.partial()` kennt. Refines werden auf beiden Schemas
// separat angehängt.
// -----------------------------------------------------------------------------

const productBaseSchema = z.object({
  title:            z.string().trim().min(3, 'Titel mindestens 3 Zeichen').max(80),
  description:      z.string().trim().max(2000).optional().nullable(),
  category:         productCategoryEnum,
  price_coins:      z.number().int().positive().max(10_000_000),
  sale_price_coins: z.number().int().positive().nullable().optional(),
  stock:            z.number().int().min(-1).max(999_999), // -1 = unlimited
  cover_url:        z.string().url().nullable().optional(),
  image_urls:       z.array(z.string().url()).max(10).default([]),
  free_shipping:    z.boolean().default(false),
  location:         z.string().trim().max(120).nullable().optional(),
  women_only:       z.boolean().default(false),
});

// Typisiertes Refine-Input für beide Varianten — bei `.partial()` sind alle
// Felder optional, also müssen die Checks mit `null/undefined` umgehen können.
type ProductRefineInput = {
  price_coins?: number;
  sale_price_coins?: number | null;
  category?: z.infer<typeof productCategoryEnum>;
  free_shipping?: boolean;
};

// -----------------------------------------------------------------------------
// Refine-Callbacks als standalone Funktionen — bewusst NICHT in einen
// generischen Helper gewrappt. Grund: ein Helper `<T extends z.ZodType<X>>`
// fixiert zods `Output` auf X, wodurch `z.infer<typeof productCreateSchema>`
// fälschlich auf `ProductRefineInput` (4 Felder) statt auf den vollen
// productBaseSchema-Output kollabiert. Inline-Applikation auf beide Schemas
// hält Output korrekt bei (full / Partial<full>) und kostet nur ein paar
// Zeilen Duplikation.
// -----------------------------------------------------------------------------
const refineSalePriceLessThanPrice: (d: ProductRefineInput) => unknown = (d) =>
  d.sale_price_coins == null ||
  d.price_coins == null ||
  d.sale_price_coins < d.price_coins;
const refineSalePriceErr = {
  path: ['sale_price_coins'],
  message: 'Angebotspreis muss kleiner als Original-Preis sein',
};

const refineFreeShippingPhysicalOnly: (d: ProductRefineInput) => unknown = (d) =>
  d.category === 'physical' || !d.free_shipping;
const refineFreeShippingErr = {
  path: ['free_shipping'],
  message: 'Gratis-Versand nur bei physischen Produkten',
};

export const productCreateSchema = productBaseSchema
  .refine(refineSalePriceLessThanPrice, refineSalePriceErr)
  .refine(refineFreeShippingPhysicalOnly, refineFreeShippingErr);
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productBaseSchema
  .partial()
  .refine(refineSalePriceLessThanPrice, refineSalePriceErr)
  .refine(refineFreeShippingPhysicalOnly, refineFreeShippingErr);
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
