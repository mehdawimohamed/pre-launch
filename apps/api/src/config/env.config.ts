import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  TRUST_TUNNEL_PROXY: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((val) => val === 'true' || val === '1'),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),

  // Google OAuth Client ID for ID token audience validation
  GOOGLE_CLIENT_ID: z.string().default('placeholder-google-client-id.apps.googleusercontent.com'),

  // Admin emails allowlist (comma-separated, case-insensitive)
  ADMIN_EMAILS: z
    .string()
    .default('admin@example.com')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),

  // Session lifetime in seconds (default: 7 days = 604800s)
  SESSION_LIFETIME_SECONDS: z.coerce.number().int().positive().default(604800),

  // Cookie Secure flag override for local dev without HTTPS
  COOKIE_SECURE_OVERRIDE: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((val) => (val !== undefined ? val === 'true' || val === '1' : undefined)),
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

export function validateConfig(rawEnv: Record<string, unknown> = process.env): AppConfig {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`[ConfigValidationError] Environment validation failed: ${issues}`);
  }
  return result.data;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = validateConfig();
  }
  return cachedConfig;
}

export function setTestConfig(config: AppConfig | null): void {
  cachedConfig = config;
}
