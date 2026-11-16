export * from './categories';
export * from './campaign-status';
export * from './campaign.schema';
export * from './slug';

import { z } from 'zod';

export const healthCheckSchema = z.object({
  status: z.literal('ok'),
});

export type HealthCheckResponse = z.infer<typeof healthCheckSchema>;
