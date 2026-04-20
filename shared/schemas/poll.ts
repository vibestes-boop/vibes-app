import { z } from 'zod';

/**
 * Constraints matching DB CHECK-Constraints in `live_polls`:
 *   question: 3..140 chars
 *   options:  2..4 array, each 1..60 chars
 */
export const livePollCreateSchema = z.object({
  question: z.string().trim().min(3).max(140),
  options: z
    .array(z.string().trim().min(1).max(60))
    .min(2, 'Mindestens 2 Antwort-Optionen')
    .max(4, 'Maximal 4 Antwort-Optionen'),
});

export type LivePollCreateInput = z.infer<typeof livePollCreateSchema>;
