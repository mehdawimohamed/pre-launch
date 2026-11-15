import path from 'node:path';
import { createRequire } from 'node:module';
import type { NextConfig } from 'next';

// Next.js only reads env files from its own directory (apps/web).
// Load the single root .env via @next/env loadEnvConfig pointed at the repo root.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require(require.resolve('@next/env', { paths: [require.resolve('next')] }));
const projectDir = path.resolve(__dirname, '..', '..');
loadEnvConfig(projectDir);

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
