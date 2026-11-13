import { z } from 'zod';

/**
 * Shared schemas and contracts placeholder for crowdfunding MVP.
 */
export const healthCheckSchema = z.object({
  status: z.literal('ok'),
});

export type HealthCheckResponse = z.infer<typeof healthCheckSchema>;

