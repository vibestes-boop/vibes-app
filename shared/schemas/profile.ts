import { z } from 'zod';

// Username regex: lowercase, numbers, underscore, 3-24 chars
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, 'Nur a-z, 0-9, _ erlaubt (3-24 Zeichen)');

export const profileUpdateSchema = z.object({
  username:     usernameSchema.optional(),
  display_name: z.string().trim().max(60).nullable().optional(),
  bio:          z.string().trim().max(200).nullable().optional(),
  avatar_url:   z.string().url().nullable().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
