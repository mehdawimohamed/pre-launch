import path from 'node:path';
import { createRequire } from 'node:module';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Next.js only reads env files from its own directory (apps/web).
// Load the single root .env via @next/env loadEnvConfig pointed at the repo root.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require(
  require.resolve('@next/env', { paths: [require.resolve('next')] }),
);
const projectDir = path.resolve(__dirname, '..', '..');
loadEnvConfig(projectDir);

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    // Baseline security headers
    // Note: CSP is structured so ad domains (e.g. Google AdSense) can be injected later when ads are enabled.
    const isDev = process.env.NODE_ENV !== 'production';

    const cspDirectives = [
      "default-src 'self'",
      // Google Identity Services GSI client script
      "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client" + (isDev ? " 'unsafe-eval'" : ""),
      // Styles from self and inline
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com data:",
      // Images: self, data URIs, and Google account profile pictures
      "img-src 'self' data: https://lh3.googleusercontent.com https://*.googleusercontent.com",
      // Connect: self and backend NestJS API
      `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'} https://accounts.google.com/gsi/`,
      // Frame / Iframe: Google Sign-In button uses an iframe from accounts.google.com
      "frame-src 'self' https://accounts.google.com/gsi/",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ];

    const cspString = cspDirectives.join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspString,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
