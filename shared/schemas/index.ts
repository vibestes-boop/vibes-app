/**
 * shared/schemas/index.ts
 *
 * Zod-Schemas für Form-Validation, die beide Apps nutzen.
 * Zod ist dependency-lose Runtime-Validation mit TypeScript-Type-Inference.
 *
 * Usage:
 *   import { productCreateSchema } from '@shared/schemas';
 *   const result = productCreateSchema.safeParse(formData);
 */

export * from './product';
export * from './poll';
export * from './profile';
