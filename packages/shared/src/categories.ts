/**
 * Canonical campaign categories for the crowdfunding MVP.
 * Validated both on the API and in the web form.
 */
export const CAMPAIGN_CATEGORIES = [
  'art',
  'technology',
  'design',
  'film-video',
  'music',
  'games',
  'food',
  'fashion',
  'publishing',
  'community',
  'education',
  'other',
] as const;

export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number];
