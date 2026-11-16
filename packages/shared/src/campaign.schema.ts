import { z } from 'zod';
import { CAMPAIGN_CATEGORIES } from './categories';

// ─── Story (Tiptap JSON) validation ────────────────────────────────

/**
 * Allowed Tiptap node types.
 * Rejects anything not in this set (e.g. script, iframe, rawHtml, codeBlock).
 */
export const ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'hardBreak',
  'horizontalRule',
  'image',
]);

/** Allowed Tiptap mark types. */
export const ALLOWED_MARK_TYPES = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'link',
  'code',
]);

/**
 * Recursively validates a Tiptap JSON node tree.
 * Rejects any node or mark type not in the allowlists, and any link with a non-http(s) scheme.
 */
export function validateStoryNode(node: unknown, path: string): string[] {
  const errors: string[] = [];
  if (typeof node !== 'object' || node === null) {
    errors.push(`${path}: expected an object`);
    return errors;
  }

  const n = node as Record<string, unknown>;

  if (typeof n.type !== 'string') {
    errors.push(`${path}: missing "type" property`);
    return errors;
  }

  if (!ALLOWED_NODE_TYPES.has(n.type)) {
    errors.push(`${path}: disallowed node type "${n.type}"`);
    return errors;
  }

  // Validate marks
  if (Array.isArray(n.marks)) {
    for (let i = 0; i < n.marks.length; i++) {
      const mark = n.marks[i] as Record<string, unknown>;
      if (typeof mark.type !== 'string' || !ALLOWED_MARK_TYPES.has(mark.type)) {
        errors.push(`${path}.marks[${i}]: disallowed mark type "${String(mark.type)}"`);
      }
      // Validate link marks: only http(s) URLs
      if (mark.type === 'link') {
        const attrs = mark.attrs as Record<string, unknown> | undefined;
        if (attrs && typeof attrs.href === 'string') {
          if (!isHttpUrl(attrs.href)) {
            errors.push(`${path}.marks[${i}]: link href must be http(s), got "${attrs.href}"`);
          }
        }
      }
    }
  }

  // Validate image src
  if (n.type === 'image') {
    const attrs = n.attrs as Record<string, unknown> | undefined;
    if (attrs && typeof attrs.src === 'string') {
      if (!isHttpUrl(attrs.src)) {
        errors.push(`${path}: image src must be http(s), got "${attrs.src}"`);
      }
    }
  }

  // Recurse into children
  if (Array.isArray(n.content)) {
    for (let i = 0; i < n.content.length; i++) {
      errors.push(...validateStoryNode(n.content[i], `${path}.content[${i}]`));
    }
  }

  return errors;
}

// ─── URL validation helpers ────────────────────────────────────────

/**
 * Returns true when the string is a valid http: or https: URL.
 * Rejects javascript:, data:, and all other schemes.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const httpUrlSchema = z.string().refine(isHttpUrl, {
  message: 'URL must use the http or https scheme',
});

// ─── Sub-schemas ───────────────────────────────────────────────────

export const campaignLinkSchema = z.object({
  label: z.string().min(1).max(120),
  url: httpUrlSchema,
});

export type CampaignLink = z.infer<typeof campaignLinkSchema>;

/**
 * Story is a Tiptap JSON document.
 * The root must be a "doc" node. We cap serialized size at 100 000 bytes (matching the DB CHECK).
 */
export const storySchema = z
  .unknown()
  .refine(
    (val): val is Record<string, unknown> =>
      typeof val === 'object' && val !== null && (val as Record<string, unknown>).type === 'doc',
    { message: 'Story root must be a "doc" node' },
  )
  .superRefine((val, ctx) => {
    const errors = validateStoryNode(val, 'story');
    for (const err of errors) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err,
      });
    }
    const size = new TextEncoder().encode(JSON.stringify(val)).length;
    if (size >= 100_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Story exceeds the 100 KB size limit',
      });
    }
  });

// ─── Campaign schemas ──────────────────────────────────────────────

export const createCampaignSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(120, 'Title must be at most 120 characters'),
  pitch: z
    .string()
    .min(10, 'Pitch must be at least 10 characters')
    .max(280, 'Pitch must be at most 280 characters'),
  category: z.enum(CAMPAIGN_CATEGORIES),
  story: storySchema,
  goalTnd: z.number().int().positive('Goal must be greater than 0'),
  deadline: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: 'Deadline must be in the future',
  }),
  teamInfo: z.string().max(2000).optional().nullable(),
  links: z
    .array(campaignLinkSchema)
    .max(5, 'At most 5 links allowed')
    .default([]),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = createCampaignSchema.partial();

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
