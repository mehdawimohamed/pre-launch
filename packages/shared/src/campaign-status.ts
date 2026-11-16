/**
 * Campaign status constants and valid transitions.
 */
export const CAMPAIGN_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'unpublished'] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/**
 * Status transitions allowed for the campaign owner (creator):
 *   draft     → pending  (submit for review)
 *   rejected  → pending  (resubmit after fixing)
 */
export const OWNER_SUBMITTABLE_STATUSES: readonly CampaignStatus[] = ['draft', 'rejected'];
