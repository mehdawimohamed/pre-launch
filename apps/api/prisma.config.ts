import { defineConfig } from 'prisma/config';

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

