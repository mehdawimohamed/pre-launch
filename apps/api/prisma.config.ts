import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from 'prisma/config';

// Load root .env so prisma commands work from apps/api
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Fallback URL is acceptable ONLY for build/cli operations that do not require
    // a running database connection (e.g., `prisma generate`).
    // Runtime execution and live migrations in production/CI must supply DATABASE_URL.
    url:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgrespassword@localhost:5432/crowdfunding_test?schema=public',
  },
});
